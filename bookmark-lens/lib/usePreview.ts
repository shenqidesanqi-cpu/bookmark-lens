import { useCallback, useEffect, useState } from 'react';
import { readPreview, type PreviewData } from './cache';
import { subscribeCache } from './cache-events';
import { readCover } from './cover-store';
import { fetchCover, hasSitePermission } from './covers';
import type { CoverRecord } from './cover-policy';
export function usePreview(url:string,id:string,automatic=false) {
 const [screenshot,setScreenshot]=useState<PreviewData|null>(null),[cover,setCover]=useState<CoverRecord>(),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const reload=useCallback(async()=>{const shot=await readPreview(url,id);setScreenshot(shot);try{setCover(await readCover(url));}catch{setCover(undefined);}return shot;},[url,id]);
 useEffect(()=>{let alive=true;setLoading(true);setError('');const load=async()=>{try{const shot=await readPreview(url,id);let record:CoverRecord|undefined;try{record=await readCover(url);if(automatic&&!shot&&await hasSitePermission(url))record=await fetchCover(url);}catch{/* Unsupported URLs remain local-only. */}if(alive){setScreenshot(shot);setCover(record);}}catch{if(alive)setError('无法读取本地预览');}finally{if(alive)setLoading(false);}};void load();const unsubscribe=subscribeCache(()=>{if(alive)void reload().catch(()=>setError('刷新预览失败'));});return()=>{alive=false;unsubscribe();};},[url,id,automatic,reload]);
 const [blobImage,setBlobImage]=useState<{blob:Blob;url:string}>();
 useEffect(()=>{if(!screenshot?.blob){setBlobImage(undefined);return;}const url=URL.createObjectURL(screenshot.blob);setBlobImage({blob:screenshot.blob,url});return()=>URL.revokeObjectURL(url);},[screenshot?.blob]);
 const displayScreenshot=screenshot?{...screenshot,image:screenshot.blob?(blobImage?.blob===screenshot.blob?blobImage.url:''):screenshot.image}:null;
 return {screenshot:displayScreenshot,cover,loading,error,reload};
}
