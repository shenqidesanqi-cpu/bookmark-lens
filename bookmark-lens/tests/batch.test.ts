import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {batchAllowed,batchCounts,recoverJob,type BatchJob} from '../lib/batch-model';
import {safeClose} from '../lib/batch-engine';
import {saveScreenshot} from '../lib/screenshot';
import {readPreview} from '../lib/cache';
import {saveCustomCover,readCustomCover} from '../lib/custom-covers';
const job:BatchJob={id:'batch-test',status:'running',items:[{id:'1',title:'One',url:'https://example.com',status:'running'},{id:'2',title:'Two',url:'https://example.org',status:'success'},{id:'3',title:'Three',url:'https://example.net',status:'failed'},{id:'4',title:'Four',url:'https://example.edu',status:'skipped'}],refresh:false,exclusions:[],updatedAt:1,ownedTabs:[10],windowId:4,runnerTabId:9,session:'session'};
test('batch excludes private, non-web, sensitive and explicitly excluded URLs',()=>{
 for(const url of ['http://example.com','https://localhost','https://127.0.0.1','https://app.internal','https://example.com/admin','https://example.com/?token=secret','https://example.com/#account','chrome://settings'])assert.equal(batchAllowed(url,[]),false,url);
 assert.equal(batchAllowed('https://example.com/docs',['example.com']),false);
 assert.equal(batchAllowed('https://developer.chrome.com/docs/extensions/',[]),true);
});
test('recovery never marks interrupted work successful and counts terminal states',()=>{
 const recovered=recoverJob(job);assert.equal(recovered.status,'paused');assert.equal(recovered.items[0]?.status,'pending');assert.equal(recovered.items[1]?.status,'success');assert.equal(job.items[0]?.status,'running');
 assert.deepEqual(batchCounts(recovered),{total:4,success:1,failed:1,skipped:1,completed:3});
});
test('cleanup only closes recorded tabs in same session and task window',async()=>{
 const removed:number[]=[];Object.assign(globalThis,{chrome:{storage:{session:{get:async()=>({batchSession:'session'})}},tabs:{get:async(id:number)=>({id,windowId:id===10?4:5}),remove:async(id:number)=>{removed.push(id);}}}});
 await safeClose(job,999);await safeClose({...job,session:'old-browser'},10);await safeClose({...job,windowId:5},10);await safeClose({...job,ownedTabs:[9]},9);assert.deepEqual(removed,[]);
 await safeClose(job,10);assert.deepEqual(removed,[10]);
});
test('verified Blob screenshot storage associates IDs without replacing custom cover',async()=>{
 Object.assign(globalThis,{chrome:{storage:{local:{get:async()=>({}),remove:async()=>{}}}}});
 const custom={blob:new Blob(['custom']),originalSize:6,finalSize:6,width:10,height:10,reduction:0};await saveCustomCover('a',custom);
 const blob=new Blob(['webp'],{type:'image/webp'});await saveScreenshot('https://example.com/',['a','b'],blob,'task');
 const saved=await readPreview('https://example.com/');assert.equal(saved?.blob?.type,'image/webp');assert.equal(saved?.blob?.size,4);assert.equal(saved?.taskId,'task');assert.deepEqual(saved?.bookmarkIds,['a','b']);assert.equal(await(await readCustomCover('a'))?.blob.text(),'custom');
});

test('five-site driver is sequential, records a failed site, cleans only owned tabs, and supports pause/resume/stop',async()=>{
 const {runBatch}=await import('../lib/batch-engine');
 const originalDocument=globalThis.document,originalBitmap=globalThis.createImageBitmap,originalSetTimeout=globalThis.setTimeout;
 const local:Record<string,unknown>={},session:Record<string,unknown>={batchTicket:{ticket:'ticket',jobId:'driver'},batchSession:'driver-session'};
 const changes=new Set<(value:Record<string,chrome.storage.StorageChange>)=>void>();
 const event={addListener:()=>{},removeListener:()=>{}};
 let nextId=100,activeTab=99,maxTemporary=0,captures=0,failUrl='',interruptAt=0,updates=0,interruptAction='pause';
 const tabs=new Map<number,{id:number;windowId:number;url:string;status:string}>([[99,{id:99,windowId:8,url:'chrome-extension://extension/batch.html',status:'complete'}],[999,{id:999,windowId:1,url:'https://user.example.com',status:'complete'}]]);
 const removed:number[]=[];
 const items=Array.from({length:5},(_,i)=>({id:`driver-${i}`,title:`Public ${i}`,url:`https://site${i}.example.com/`,status:'pending' as const}));
 const makeJob=():BatchJob=>({id:'driver',status:'ready',items:structuredClone(items),refresh:true,exclusions:[],updatedAt:1,ownedTabs:[]});
 local.batchJob=makeJob();
 Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name:string,_options:unknown,callback:(lock:unknown)=>unknown)=>callback({}),query:async()=>({held:[]})}});
 const canvas={width:0,height:0,getContext:()=>({fillRect:()=>{},drawImage:()=>{},fillStyle:''}),toBlob:(cb:(blob:Blob)=>void)=>cb(new Blob(['webp-result'],{type:'image/webp'}))};
 Object.assign(globalThis,{document:{createElement:()=>canvas},createImageBitmap:async()=>({width:1920,height:1080,close:()=>{}})});
 globalThis.setTimeout=((fn:()=>void,ms:number)=>originalSetTimeout(fn,ms===1800?0:ms)) as typeof setTimeout;
 Object.assign(globalThis,{chrome:{
  permissions:{contains:async()=>true},
  storage:{local:{get:async(key:string)=>key?{[key]:structuredClone(local[key])}:structuredClone(local),set:async(values:Record<string,unknown>)=>{Object.assign(local,structuredClone(values));},remove:async()=>{}},session:{get:async(key:string)=>({[key]:session[key]}),set:async(values:Record<string,unknown>)=>Object.assign(session,values),remove:async(key:string)=>{delete session[key];}},onChanged:{addListener:(fn:(value:Record<string,chrome.storage.StorageChange>)=>void)=>changes.add(fn),removeListener:(fn:(value:Record<string,chrome.storage.StorageChange>)=>void)=>changes.delete(fn)}},
  bookmarks:{get:async(id:string)=>[items.find(i=>i.id===id)]},
  scripting:{executeScript:async({target}:{target:{tabId:number}})=>{if(tabs.get(target.tabId)?.url===failUrl)throw new Error('network failure');return [{result:{blocked:false,ready:'complete'}}];}},
  tabs:{onUpdated:event,onRemoved:event,getCurrent:async()=>tabs.get(99),get:async(id:number)=>{if(!tabs.has(id))throw new Error('missing');return tabs.get(id);},query:async()=>[tabs.get(activeTab)],
   create:async({url,windowId}:{url:string;windowId:number})=>{const t={id:nextId++,url,windowId,status:'complete'};tabs.set(t.id,t);activeTab=t.id;maxTemporary=Math.max(maxTemporary,tabs.size-2);return t;},
   update:async(id:number,{url}:{url:string})=>{tabs.get(id)!.url=url;updates++;if(updates===interruptAt)changes.forEach(fn=>fn({batchCommand:{newValue:{jobId:'driver',action:interruptAction}}}));return tabs.get(id);},
   captureVisibleTab:async()=>{captures++;return 'data:image/png;base64,AAAA';},
   remove:async(id:number)=>{removed.push(id);tabs.delete(id);activeTab=99;}}
 }});
 try{
  failUrl=items[2]!.url;await runBatch('ticket');
  let result=local.batchJob as BatchJob;assert.equal(result.status,'done');assert.deepEqual(batchCounts(result),{total:5,success:4,failed:1,skipped:0,completed:5});assert.equal(captures,4);assert.equal(maxTemporary,1);assert.equal(removed.length,5);assert.ok(tabs.has(999));assert.equal(tabs.size,2);
  // New job: pause before capture, then explicitly resume after an interrupted attempt.
  failUrl='';local.batchJob={...makeJob(),id:'driver'};session.batchTicket={ticket:'pause',jobId:'driver'};interruptAt=updates+1;
  // Remove previous task linkage so this run really creates a temporary tab.
  for(const item of items){const blob=new Blob(['old'],{type:'image/webp'});await saveScreenshot(item.url,[item.id],blob,'previous');}
  await runBatch('pause');result=local.batchJob as BatchJob;assert.equal(result.status,'paused');assert.equal(result.items[0]?.status,'pending');assert.equal(tabs.size,2);
  interruptAt=0;session.batchTicket={ticket:'resume',jobId:'driver'};local.batchJob={...result,status:'ready'};await runBatch('resume');result=local.batchJob as BatchJob;assert.equal(result.status,'done');assert.equal(batchCounts(result).success,5);
  for(const item of items)await saveScreenshot(item.url,[item.id],new Blob(['old'],{type:'image/webp'}),'previous');
  local.batchJob=makeJob();session.batchTicket={ticket:'stop',jobId:'driver'};interruptAction='stop';interruptAt=updates+1;await runBatch('stop');assert.equal((local.batchJob as BatchJob).status,'stopped');assert.equal(tabs.size,2);assert.ok(tabs.has(999));assert.equal(changes.size,0);
  // No one-time ticket: merely loading a runner can never restart site visits.
  const before=updates;local.batchJob={...makeJob(),status:'running'};await runBatch('without-ticket');assert.equal(updates,before);assert.equal((local.batchJob as BatchJob).status,'paused');
 }finally{Object.assign(globalThis,{document:originalDocument,createImageBitmap:originalBitmap});globalThis.setTimeout=originalSetTimeout;}
});
