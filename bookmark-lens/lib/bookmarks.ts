import { useCallback, useEffect, useState } from 'react';
export { flatten } from './bookmark-model';
import type { Node } from './bookmark-model';
export type { Node } from './bookmark-model';
export function useBookmarks() {
 const [tree,setTree]=useState<Node[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{ try { if (!globalThis.chrome?.bookmarks) throw new Error('请在 Chrome 扩展中打开 Bookmark Lens。'); setTree((await chrome.bookmarks.getTree())[0]?.children ?? []); setError(''); } catch(e){setError(e instanceof Error?e.message:'读取书签失败');} finally{setLoading(false);} },[]);
 useEffect(()=>{void refresh(); if(!globalThis.chrome?.bookmarks)return; let timer: ReturnType<typeof setTimeout>; const sync=()=>{clearTimeout(timer);timer=setTimeout(()=>void refresh(),100);}; const events=[chrome.bookmarks.onCreated,chrome.bookmarks.onRemoved,chrome.bookmarks.onChanged,chrome.bookmarks.onMoved,chrome.bookmarks.onChildrenReordered,chrome.bookmarks.onImportEnded]; events.forEach(e=>e.addListener(sync)); return()=>{clearTimeout(timer);events.forEach(e=>e.removeListener(sync));};},[refresh]);
 return {tree,loading,error,refresh};
}
export function domain(url=''){try{return new URL(url).hostname || url;}catch{return url;}}
export function safeUrl(url=''){try{return ['http:','https:','ftp:','file:'].includes(new URL(url).protocol);}catch{return false;}}
export async function openBookmark(node:Node){if(node.url && safeUrl(node.url))await chrome.tabs.create({url:node.url});else throw new Error('此地址类型不支持直接打开。');}
