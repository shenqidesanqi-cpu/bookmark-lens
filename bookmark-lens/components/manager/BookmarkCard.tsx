import {deleteBookmark} from '../../lib/delete-bookmark';
import CoverEditor from './CoverEditor';
import {useCustomCover} from '../../lib/useCustomCover';
import {saveCustomCover,removeCustomCover,coverSource} from '../../lib/custom-covers';

import {useEffect,useRef,useState} from 'react';
import {ExternalLink,Image,RefreshCw,ShieldCheck,MoreHorizontal,Upload} from 'lucide-react';
import {domain,openBookmark,type Node} from '../../lib/bookmarks';
import {authorizeSite,fetchCover} from '../../lib/covers';
import {usePreview} from '../../lib/usePreview';
import Favicon from '../Favicon';
import Highlight from '../Highlight';
export default function BookmarkCard({node,query,onDetails,report,selected,onToggle}:{node:Node;selected?:boolean;onToggle?:()=>void;query:string;onDetails:(n:Node)=>void;report:(message:string)=>void}) {
 const url=node.url!;const {screenshot,cover,loading,error,reload}=usePreview(url,node.id,true);const [busy,setBusy]=useState(false);
 const custom=useCustomCover(node.id);
 const {image,label}=coverSource(custom,screenshot?.image,cover?.image);
 const [menu,setMenu]=useState(false),[processing,setProcessing]=useState(false),[dragging,setDragging]=useState(false);
 const input=useRef<HTMLInputElement>(null),menuRoot=useRef<HTMLDivElement>(null),lock=useRef(false),dragDepth=useRef(0);
 useEffect(()=>{if(!menu)return;const close=(event:PointerEvent)=>{if(!menuRoot.current?.contains(event.target as globalThis.Node))setMenu(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[menu]);
 const [editor,setEditor]=useState<{file?:File}|null>(null);
 function upload(file?:File){if(file){setMenu(false);setEditor({file});}}
 const [deleting,setDeleting]=useState(false);
 async function removeBookmark(){
  if(deleting)return;
  if(!window.confirm(`确定从 Chrome 中删除书签“${node.title||domain(url)}”？\n此操作会同步到 Chrome 书签，请确认后再删除。`))return;
  setDeleting(true);
  try{report(await deleteBookmark(node));setMenu(false);}catch(e){report(`删除失败：${e instanceof Error?e.message:'请重试'}`);}finally{setDeleting(false);}
 }
 async function restore(){try{await removeCustomCover(node.id);setMenu(false);report('已删除自定义封面，恢复已有自动预览');}catch{report('删除封面失败，请重试');}}

 async function enable(){setBusy(true);try{const target=cover?.imageUrl&&cover.error?.includes('其他域名')?cover.imageUrl:url;const granted=await authorizeSite(target);if(!granted){report('未授权网站访问，保留本地预览');return;}const result=await fetchCover(url,true);if(result.error)report(result.error);await reload();}catch(e){report(e instanceof Error?e.message:'获取封面失败');}finally{setBusy(false);}}
 return <article className={`bookmark-card ${dragging?'cover-dragging':''}`} aria-busy={processing}><div className="cover-area" onDragEnter={e=>{if(!e.dataTransfer.types.includes('Files'))return;e.preventDefault();dragDepth.current++;setDragging(true);}} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect=processing?'none':'copy';}}} onDragLeave={e=>{e.preventDefault();if(--dragDepth.current<=0){dragDepth.current=0;setDragging(false);}}} onDrop={e=>{e.preventDefault();dragDepth.current=0;setDragging(false);if(e.dataTransfer.files.length!==1){report('每次请选择一张封面图片');return;}void upload(e.dataTransfer.files[0]);}}><button className="cover" disabled={processing} onClick={()=>void openBookmark(node).catch(e=>report(e.message))} aria-label={`打开 ${node.title}`}><span className="cover-inner">{loading?<span className="skeleton"/>:image?<img src={image} alt={`${node.title} 的${label}`}/>:<span className="cover-placeholder"><Image size={26}/><span>{domain(url)}</span><small>{error||cover?.error||'暂无封面 · 授权后自动获取'}</small></span>}</span>{image&&<span className="source-label">{label}</span>}</button>{onToggle&&<label className="batch-check"><input type="checkbox" aria-label={`选择 ${node.title}`} checked={Boolean(selected)} onChange={onToggle}/></label>}<button className="cover-upload-shortcut" disabled={processing} aria-label={`更换 ${node.title} 的封面`} onClick={()=>input.current?.click()}><Upload size={14}/>更换封面</button>{(processing||dragging)&&<div className="cover-upload-overlay" role="status">{processing?<><RefreshCw size={22} className="spin"/>正在压缩并保存…</>:<><Upload size={26}/>松开以上传自定义封面</>}</div>}</div><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/><div className="card-meta"><Favicon url={url}/><button className="card-title" onClick={()=>void openBookmark(node).catch(e=>report(e.message))}><strong title={node.title}><Highlight text={node.title||domain(url)} query={query}/></strong><small title={url}><Highlight text={query?url:domain(url)} query={query}/></small></button><div className="card-menu-root" ref={menuRoot} onKeyDown={e=>{if(e.key==='Escape'){setMenu(false);menuRoot.current?.querySelector<HTMLButtonElement>('button')?.focus();}}}><button className="icon" disabled={processing} aria-label={`${node.title} 的更多操作`} aria-expanded={menu} aria-haspopup="true" onClick={()=>setMenu(!menu)}><MoreHorizontal size={18}/></button>{menu&&<div className="card-menu"><button onClick={()=>{setMenu(false);setEditor({});}}>编辑封面</button><button onClick={()=>{setMenu(false);input.current?.click();}}>上传自定义封面</button>{custom&&<><button onClick={()=>void restore()}>删除自定义封面</button><button onClick={()=>void restore()}>恢复自动封面</button></>}<button onClick={()=>{setMenu(false);onDetails(node);}}>查看详情</button><button className="delete-bookmark" disabled={deleting} onClick={()=>void removeBookmark()}>{deleting?'删除中…':'删除书签'}</button></div>}</div></div><div className="card-tools"><span>{custom?'自定义封面 · 仅保存在本机':screenshot?'截图保存在本机':cover?.image?'网站提供的分享配图':'按站点授权，不使用第三方截图'}</span><button disabled={busy} onClick={()=>void enable()} title={cover?.imageUrl&&cover.error?.includes('其他域名')?`授权图片来源：${new URL(cover.imageUrl).origin}`:'允许读取此网站并获取分享图'}>{busy?<RefreshCw className="spin" size={13}/>:<ShieldCheck size={13}/>} {busy?'获取中':cover?.error?.includes('其他域名')?'授权图片域名':cover?.image?'刷新封面':'获取封面'}</button></div>{editor&&<CoverEditor bookmarkId={node.id} title={node.title} initialFile={editor.file} initialImage={screenshot?.image??cover?.image} onClose={()=>setEditor(null)} report={report}/>}</article>;
}
