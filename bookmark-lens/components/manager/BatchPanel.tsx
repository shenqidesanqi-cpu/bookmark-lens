import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
import type {Node} from '../../lib/bookmarks';
import {batchCounts,readJob,writeJob,recoverJob,JOB_KEY,COMMAND_KEY,type BatchJob} from '../../lib/batch-model';
import {openRunner,runnerActive} from '../../lib/batch-engine';
export default function BatchPanel({all,current,selected,hasFolder,onClose,report}:{all:Node[];current:Node[];selected:Set<string>;hasFolder:boolean;onClose:()=>void;report:(s:string)=>void}){
 const [scope,setScope]=useState<'current'|'selected'|'all'>(selected.size?'selected':'current'),[refresh,setRefresh]=useState(false),[exclusions,setExclusions]=useState(''),[consent,setConsent]=useState(false),[job,setJob]=useState<BatchJob>(),[active,setActive]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;const update=async()=>{const [value,running]=await Promise.all([readJob(),runnerActive()]);if(alive){setJob(value);setActive(running);}};void update();const listener=(changes:Record<string,chrome.storage.StorageChange>)=>{if(changes[JOB_KEY])void update();};chrome.storage.onChanged.addListener(listener);const timer=setInterval(()=>void update(),3000);return()=>{alive=false;clearInterval(timer);chrome.storage.onChanged.removeListener(listener);};},[]);
 const targets=scope==='all'?all:scope==='selected'?all.filter(n=>selected.has(n.id)):current;
 const counts=job?batchCounts(job):undefined;
 async function launch(resume=false){
 if(!consent){report('请先确认自动访问网站与截图说明');return;}if(busy)return;setBusy(true);
 // Must be called directly within the user gesture, before any asynchronous work.
 const permission=chrome.permissions.request({origins:['<all_urls>']});
 try{if(!await permission){report('未授予批量截图权限，任务未开始');return;}
 await navigator.locks.request('bookmark-lens-batch-launch',async()=>{
 if(await runnerActive())throw new Error('已有批量任务正在执行，请先暂停或停止');
 const previous=await readJob();if(!resume&&previous?.status==='ready')throw new Error('任务窗口正在启动，请稍后检查进度');
 let next:BatchJob;
 if(resume){if(!previous)throw new Error('没有可恢复的任务');next=recoverJob(previous);}else{if(!targets.length)throw new Error('当前范围没有可处理书签');next={id:crypto.randomUUID(),status:'ready',items:targets.filter(n=>n.url).map(n=>({id:n.id,title:n.title,url:n.url!,status:'pending'})),refresh,exclusions:exclusions.split('\n').map(s=>s.trim()).filter(Boolean),updatedAt:Date.now(),ownedTabs:[]};}
 await chrome.storage.local.remove(COMMAND_KEY);await openRunner(next);
 });
 }catch(e){report(e instanceof Error?e.message:'无法启动批量任务');}finally{setBusy(false);}}
 async function command(action:'pause'|'stop'){if(!job)return;try{if(active)await chrome.storage.local.set({[COMMAND_KEY]:{jobId:job.id,action,time:Date.now()}});else await writeJob({...recoverJob(job),status:action==='stop'?'stopped':'paused'});}catch{report('保存任务控制状态失败');}}
 return <section className="batch-panel" aria-label="批量生成封面"><div className="batch-heading"><h2>批量生成网站封面</h2><button className="icon" aria-label="关闭批量面板" onClick={onClose}><X size={18}/></button></div><p>会在独立任务窗口逐个访问网站、切换活动标签页并截图。网站可能使用当前 Chrome 登录状态；请先排除私人页面。截图只保存在本机，不上传第三方。</p><div className="batch-fields"><label>处理范围<select value={scope} disabled={active} onChange={e=>setScope(e.target.value as typeof scope)}><option value="current">{hasFolder?'当前文件夹（含子文件夹）':'当前展示范围'}</option><option value="selected">手动勾选（{selected.size}）</option><option value="all">全部书签（{all.length}）</option></select></label><label><input type="checkbox" checked={refresh} disabled={active} onChange={e=>setRefresh(e.target.checked)}/>刷新已有自动封面（默认仅处理无封面书签）</label></div><label className="batch-exclude">排除网址/域名关键词（每行一条）<textarea rows={2} value={exclusions} disabled={active} onChange={e=>setExclusions(e.target.value)} placeholder={'company.example\n/private/'}/></label><p>默认排除非 HTTPS、内网形式地址、带查询参数/片段、登录/后台/付款等敏感路径；不绕过验证码或访问限制。</p><label className="batch-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>我确认只处理可公开访问的网站，并同意主动访问及截图。Chrome 原生跨站截图需可选“所有网站”权限，可在设置中撤销。</label><div className="batch-actions"><button disabled={busy||active||!consent||!targets.length} onClick={()=>void launch()}>开始（{targets.length}）</button><button disabled={!active} onClick={()=>void command('pause')}>暂停</button><button disabled={busy||active||!job||job.status==='done'||!consent} onClick={()=>void launch(true)}>继续 / 安全恢复</button><button disabled={!job||job.status==='done'||job.status==='stopped'} onClick={()=>void command('stop')}>停止</button></div>{job&&counts&&<div className="batch-progress" aria-live="polite"><strong>{active?'正在执行':job.status==='done'?'已完成':job.status==='stopped'?'已停止':'等待确认继续'}</strong><progress max={counts.total||1} value={counts.completed}/><span>{counts.completed}/{counts.total} · 成功 {counts.success} · 失败 {counts.failed} · 跳过 {counts.skipped}</span><p>当前：{job.items.find(i=>i.status==='running')?.url??'—'}</p>{job.error&&<p className="batch-error">{job.error}</p>}<details><summary>任务明细与失败原因</summary><ul>{job.items.map((item,i)=><li key={`${item.id}-${i}`}><span>{item.title||item.url}</span><small>{item.status} {item.reason}</small></li>)}</ul></details></div>}</section>;
}
