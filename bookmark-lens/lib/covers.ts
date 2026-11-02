import { coverKey, freshCover, originPattern, parseCover, publicUrl, type CoverRecord } from './cover-policy';
import { readCover, writeCover } from './cover-store';
const pending=new Map<string,Promise<CoverRecord>>();
let active=0;const queue:Array<()=>void>=[];
async function slot(){if(active<3){active++;return;}await new Promise<void>(resolve=>queue.push(resolve));}
function release(){const next=queue.shift();if(next)next();else active--;}
export async function hasSitePermission(url:string){return chrome.permissions.contains({origins:[originPattern(url)]});}
export function authorizeSite(url:string){return chrome.permissions.request({origins:[originPattern(url)]});}
async function resource(url:string,maxBytes:number,kind:'html'|'image') {
 publicUrl(url);
 if(!await hasSitePermission(url))throw new Error(kind==='image'?'封面位于其他域名，需单独授权':'需授权此网站后获取封面');
 const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error(`网站返回 ${response.status}`);
 const type=response.headers.get('content-type')??'';
 if(kind==='html'&&!type.includes('text/html'))throw new Error('网站未返回 HTML');
 if(kind==='image'&&!/^image\/(png|jpeg|webp|gif|avif)(;|$)/i.test(type))throw new Error('不支持的封面图片类型');
 const reader=response.body?.getReader();if(!reader)throw new Error('响应内容为空');
 const chunks:Uint8Array<ArrayBuffer>[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new Error('网站内容超出大小限制');chunks.push(new Uint8Array(value));}}finally{await reader.cancel();}
 return new Blob(chunks,{type});
}
async function imageData(blob:Blob){
 const bitmap=await createImageBitmap(blob);try{const width=Math.min(960,bitmap.width),height=Math.max(1,Math.round(bitmap.height*width/bitmap.width));if(height>4000)throw new Error('封面比例不适合预览');const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw new Error('无法处理图片');context.drawImage(bitmap,0,0,width,height);return canvas.toDataURL('image/webp',0.82);}finally{bitmap.close();}
}
export function fetchCover(url:string,force=false):Promise<CoverRecord>{
 const key=coverKey(url);const existing=pending.get(key);if(existing)return existing;
 const task=(async()=>{const cached=await readCover(key);if(!force&&cached&&freshCover(cached))return cached;await slot();try{let metadata:{imageUrl:string;description:string}|undefined;
 try{if(!await hasSitePermission(key))throw new Error('需授权此网站后获取封面');metadata=parseCover(await (await resource(key,2*1024*1024,'html')).text(),key);const image=await imageData(await resource(metadata.imageUrl,4*1024*1024,'image'));const result={url:key,image,description:metadata.description,imageUrl:metadata.imageUrl,fetchedAt:Date.now()};await writeCover(result);return result;}
 catch(e){const result={url:key,image:cached?.image,description:cached?.description,imageUrl:metadata?.imageUrl??cached?.imageUrl,fetchedAt:Date.now(),error:e instanceof Error?e.message:'获取封面失败'};await writeCover(result);return result;}
 }finally{release();}})().finally(()=>pending.delete(key));pending.set(key,task);return task;
}
