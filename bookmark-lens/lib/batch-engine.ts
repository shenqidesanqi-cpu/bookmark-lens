import {readCustomCover} from './custom-covers';
import {readPreview} from './cache';
import {readCover} from './cover-store';
import {captureTab,saveScreenshot} from './screenshot';
import {batchAllowed,duplicateKey,readJob,writeJob,recoverJob,TICKET_KEY,COMMAND_KEY,type BatchJob,type BatchItem} from './batch-model';
import {flatten} from './bookmark-model';
const LOCK='bookmark-lens-batch-runner';
export async function runnerActive(){return (await navigator.locks.query()).held?.some(lock=>lock.name===LOCK)??false;}
export async function openRunner(job:BatchJob){
 const ticket=crypto.randomUUID();await chrome.storage.session.set({[TICKET_KEY]:{ticket,jobId:job.id}});
 await writeJob({...job,status:'ready'});
 try{await chrome.windows.create({url:chrome.runtime.getURL('/batch.html')+'#'+ticket,type:'normal',width:1100,height:800,focused:true});}
 catch(e){await chrome.storage.session.remove(TICKET_KEY);await writeJob({...job,status:'paused',error:'无法创建任务窗口，请重试'});throw e;}
}
export async function safeClose(job:BatchJob,tabId:number){
 const session=(await chrome.storage.session.get('batchSession')).batchSession;
 if(!job.ownedTabs.includes(tabId)||job.session!==session||job.windowId===undefined)return;
 try{const tab=await chrome.tabs.get(tabId);if(tab.windowId!==job.windowId||tab.id===job.runnerTabId)return;await chrome.tabs.remove(tabId);}catch{/* Already closed. */}
}
function sleep(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal.aborted){reject(new Error('任务已暂停或停止'));return;}const abort=()=>{clearTimeout(timer);reject(new Error('任务已暂停或停止'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});});}
async function loaded(tabId:number,signal:AbortSignal){
 await new Promise<void>((resolve,reject)=>{
 const finish=(error?:Error)=>{clearTimeout(timer);chrome.tabs.onUpdated.removeListener(update);chrome.tabs.onRemoved.removeListener(removed);signal.removeEventListener('abort',abort);error?reject(error):resolve();};
 const update=(id:number,info:chrome.tabs.OnUpdatedInfo)=>{if(id===tabId&&info.status==='complete')finish();};
 const removed=(id:number)=>{if(id===tabId)finish(new Error('临时标签页已关闭'));};const abort=()=>finish(new Error('任务已暂停或停止'));
 const timer=setTimeout(()=>finish(new Error('页面加载超时（30秒）')),30000);
 chrome.tabs.onUpdated.addListener(update);chrome.tabs.onRemoved.addListener(removed);signal.addEventListener('abort',abort,{once:true});
 if(signal.aborted){abort();return;}void chrome.tabs.get(tabId).then(t=>{if(t.status==='complete')finish();}).catch(()=>finish(new Error('标签页不存在')));
 });
}
async function existingCover(item:BatchItem){return Boolean(await readCustomCover(item.id)||(await readPreview(item.url,item.id))?.blob||(await readPreview(item.url))?.image||(await readCover(item.url))?.image);}
export async function runBatch(ticket:string){
 await navigator.locks.request(LOCK,{ifAvailable:true},async lock=>{
 if(!lock)return;
 const authorization=(await chrome.storage.session.get(TICKET_KEY))[TICKET_KEY] as {ticket:string;jobId:string}|undefined;
 let job=await readJob();if(!job||authorization?.ticket!==ticket||authorization.jobId!==job.id||job.status!=='ready'){if(job?.status==='running'||job?.status==='ready')await writeJob(recoverJob(job));return;}
 await chrome.storage.session.remove(TICKET_KEY);
 let session=(await chrome.storage.session.get('batchSession')).batchSession as string|undefined;
 if(!session){session=crypto.randomUUID();await chrome.storage.session.set({batchSession:session});}
 // Only same-session recorded tabs are safe to close; old browser tab IDs are never trusted.
 for(const tabId of job.ownedTabs)await safeClose(job,tabId);
 job={...recoverJob(job),status:'running',error:undefined,session,ownedTabs:[]};
 const runner=await chrome.tabs.getCurrent();if(runner?.id===undefined)throw new Error('任务页不在标签页中');job.windowId=runner.windowId;job.runnerTabId=runner.id;
 const controller=new AbortController();let command:'pause'|'stop'|undefined;
 const listener=(changes:Record<string,chrome.storage.StorageChange>)=>{const value=changes[COMMAND_KEY]?.newValue as {jobId:string;action:'pause'|'stop'}|undefined;if(value?.jobId===job!.id){command=value.action;controller.abort();}};
 chrome.storage.onChanged.addListener(listener);
 const check=()=>{if(controller.signal.aborted)throw new Error('任务已暂停或停止');};
 const commit=async()=>writeJob(job!);
 try{
 await commit();
 if(!await chrome.permissions.contains({origins:['<all_urls>']}))throw new Error('缺少批量截图所需的可选“所有网站”权限');
 const reused=new Map<string,Blob>();
 for(const item of job.items){
 if(item.status!=='pending')continue;check();if(!await chrome.permissions.contains({origins:['<all_urls>']}))throw new Error('批量截图权限已撤销，任务已暂停');let tempId:number|undefined;
 try{
 if(!batchAllowed(item.url,job.exclusions)){item.status='skipped';item.reason='已排除：非公开 HTTPS、敏感路径、查询参数或排除规则';await commit();continue;}
 const current=(await chrome.bookmarks.get(item.id))[0];if(!current?.url||duplicateKey(current.url)!==duplicateKey(item.url)){item.status='skipped';item.reason='书签已删除或地址已变更';await commit();continue;}
 if(await readCustomCover(item.id)){item.status='skipped';item.reason='保留用户自定义封面';await commit();continue;}
 if(!job.refresh&&await existingCover(item)){item.status='skipped';item.reason='已有封面';await commit();continue;}
 const key=duplicateKey(item.url);let cached=reused.get(key);if(!cached){const saved=await readPreview(item.url);if(saved?.taskId===job.id&&saved.blob)cached=saved.blob;}
 item.status='running';await commit();check();
 if(cached){await saveScreenshot(item.url,[item.id],cached,job.id);item.status='success';item.reason='复用本任务相同 URL 截图';await commit();continue;}
 const tab=await chrome.tabs.create({windowId:job.windowId,url:'about:blank',active:true});if(tab.id===undefined)throw new Error('无法创建临时标签页');tempId=tab.id;job.ownedTabs.push(tempId);await commit();check();
 await chrome.tabs.update(tempId,{url:item.url,active:true});await loaded(tempId,controller.signal);await sleep(1800,controller.signal);check();
 const currentTab=await chrome.tabs.get(tempId);if(!currentTab.url||!batchAllowed(currentTab.url,job.exclusions))throw new Error('已跳转至被排除或不支持的页面');
 const [inspection]=await chrome.scripting.executeScript({target:{tabId:tempId},func:()=>({blocked:Boolean(document.querySelector('input[type="password"],iframe[src*="recaptcha"],iframe[src*="hcaptcha"],.g-recaptcha'))||/^(privacy error|site can.t be reached|just a moment|access denied|登录|sign in|login|verify you are human)/i.test(document.title),ready:document.readyState})});
 if(inspection?.result?.blocked||inspection?.result?.ready!=='complete')throw new Error('登录、验证、访问限制或页面未准备好，已跳过');
 const blob=await captureTab(tempId,job.windowId!,currentTab.url);check();
 const latest=(await chrome.bookmarks.get(item.id))[0];if(!latest?.url||duplicateKey(latest.url)!==key)throw new Error('截图期间书签地址已变更');
 if(await readCustomCover(item.id)){item.status='skipped';item.reason='处理期间上传了自定义封面';}else{await saveScreenshot(item.url,[item.id],blob,job.id);check();reused.set(key,blob);item.status='success';item.reason=blob.size>300*1024?'已保存，保留清晰度，略高于 300KB':undefined;}
 }catch(error){if(controller.signal.aborted){item.status='pending';item.reason='已中断，等待用户继续';throw error;}item.status='failed';item.reason=error instanceof Error?error.message:'处理失败';}
 finally{if(tempId!==undefined){await safeClose(job,tempId);job.ownedTabs=job.ownedTabs.filter(id=>id!==tempId);}await commit();}
 }
 job.status='done';
 }catch(error){job.status=command==='stop'?'stopped':'paused';job.error=command?undefined:error instanceof Error?error.message:'任务意外中断';}
 finally{chrome.storage.onChanged.removeListener(listener);for(const id of job.ownedTabs)await safeClose(job,id);job.ownedTabs=[];await commit();}
 });
}
