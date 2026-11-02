import { canCapture } from './capture-utils';
import { exportCover, defaultCrop } from './cover-edit';
import { readPreview, savePreview } from './cache';
/** Capture exactly the intended active tab; never activate a user tab. */
export async function captureTab(tabId:number,windowId:number,expectedUrl:string) {
 if(!canCapture(expectedUrl))throw new Error('此页面不支持截图');
 const check=async()=>{const tab=(await chrome.tabs.query({active:true,windowId}))[0];if(tab?.id!==tabId||tab.url!==expectedUrl)throw new Error('活动页面已改变，截图已丢弃');};
 await check();
 const data=await chrome.tabs.captureVisibleTab(windowId,{format:'png'});
 await check();
 const original=await(await fetch(data)).blob();
 const result=await exportCover(original,defaultCrop,original.size);
 if(result.blob.type!=='image/webp')throw new Error('浏览器无法编码 WebP，请保留原有封面后重试');
 return result.blob;
}
export async function saveScreenshot(url:string,bookmarkIds:string[],blob:Blob,taskId?:string) {
 const existing=await readPreview(url);
 await savePreview(url,{image:'',blob,taskId,description:existing?.description??'',savedAt:Date.now(),bookmarkIds:[...new Set([...(existing?.bookmarkIds??[]),...bookmarkIds])]});
 const saved=await readPreview(url);
 if(!saved?.blob||saved.blob.size!==blob.size||saved.taskId!==taskId)throw new Error('截图缓存写入验证失败');
}
