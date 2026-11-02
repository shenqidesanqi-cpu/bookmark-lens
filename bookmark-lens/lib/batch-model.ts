import {publicUrl} from './cover-policy';
import {normalizeUrl} from './capture-utils';
export type TaskStatus='pending'|'running'|'success'|'failed'|'skipped';
export type BatchItem={id:string;title:string;url:string;status:TaskStatus;reason?:string};
export type BatchJob={id:string;status:'ready'|'running'|'paused'|'stopped'|'done';items:BatchItem[];refresh:boolean;exclusions:string[];updatedAt:number;session?:string;windowId?:number;runnerTabId?:number;ownedTabs:number[];error?:string};
export const JOB_KEY='batchJob',COMMAND_KEY='batchCommand',TICKET_KEY='batchTicket';
export function batchAllowed(value:string,exclusions:string[]) {
 try {const url=publicUrl(value);if(url.protocol!=='https:')return false;
 if(/(login|signin|sign-in|auth|oauth|account|admin|dashboard|checkout|payment|captcha|verify)/i.test(url.pathname))return false;
 if(url.search||url.hash)return false;
 return !exclusions.some(s=>s.trim()&&value.toLowerCase().includes(s.trim().toLowerCase()));
 }catch{return false;}
}
export function batchCounts(job:BatchJob){const count=(s:TaskStatus)=>job.items.filter(i=>i.status===s).length;return {total:job.items.length,success:count('success'),failed:count('failed'),skipped:count('skipped'),completed:count('success')+count('failed')+count('skipped')};}
export function recoverJob(job:BatchJob):BatchJob{return {...job,status:'paused',items:job.items.map(i=>i.status==='running'?{...i,status:'pending',reason:'上次中断，等待确认继续'}:i),updatedAt:Date.now(),error:'任务已中断。确认后才能继续，不会自动访问网站。'};}
export function duplicateKey(url:string){return normalizeUrl(url);}
export async function readJob(){return (await chrome.storage.local.get(JOB_KEY))[JOB_KEY] as BatchJob|undefined;}
export async function writeJob(job:BatchJob){job.updatedAt=Date.now();await chrome.storage.local.set({[JOB_KEY]:job});}
