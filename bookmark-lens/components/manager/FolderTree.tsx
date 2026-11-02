import {ChevronDown,ChevronRight,Folder} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import type {Node} from '../../lib/bookmarks';
export default function FolderTree({nodes,selected,onSelect,depth=0}:{nodes:Node[];selected:string|null;onSelect:(id:string)=>void;depth?:number}) {
 const [expanded,setExpanded]=useState<Set<string>>(()=>new Set(depth===0?nodes.map(n=>n.id):[]));
 const initialized=useRef(false);
 useEffect(()=>{if(depth===0&&!initialized.current&&nodes.length){initialized.current=true;setExpanded(new Set(nodes.map(n=>n.id)));}},[depth,nodes]);
 return <ul className="folder-tree">{nodes.filter(n=>!n.url).map(n=>{const children=(n.children??[]).filter(c=>!c.url),open=expanded.has(n.id);return <li key={n.id}><div className={`folder-row ${selected===n.id?'selected':''}`} style={{paddingLeft:12+depth*20}}><button className="folder-select" onClick={()=>onSelect(n.id)} aria-current={selected===n.id?'page':undefined}><Folder size={18}/><span title={n.title}>{n.title||'未命名文件夹'}</span></button>{children.length>0&&<button className="icon" aria-label={`${open?'折叠':'展开'} ${n.title}`} aria-expanded={open} onClick={()=>setExpanded(previous=>{const next=new Set(previous);if(open)next.delete(n.id);else next.add(n.id);return next;})}>{open?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>}</div>{open&&children.length>0&&<FolderTree nodes={children} selected={selected} onSelect={onSelect} depth={depth+1}/>}</li>;})}</ul>;
}
