import { notifyCache } from './cache-events';
import { coverKey, type CoverRecord } from './cover-policy';
async function run<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('bookmark-lens-covers',1);r.onupgradeneeded=()=>r.result.createObjectStore('covers',{keyPath:'url'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 return new Promise((resolve,reject)=>{const tx=db.transaction('covers',mode);const r=action(tx.objectStore('covers'));tx.oncomplete=()=>{db.close();resolve(r.result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error);};});
}
export function readCover(url:string){return run<CoverRecord|undefined>('readonly',s=>s.get(coverKey(url)));}
export async function writeCover(record:CoverRecord){await run('readwrite',s=>s.put(record));notifyCache();}
export async function removeCover(url:string){await run('readwrite',s=>s.delete(coverKey(url)));notifyCache();}
