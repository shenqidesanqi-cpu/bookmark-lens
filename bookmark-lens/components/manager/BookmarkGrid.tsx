import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Node} from '../../lib/bookmarks';
import BookmarkCard from './BookmarkCard';
export default function BookmarkGrid({nodes,view,query,scopeKey,onDetails,report,selection,onToggle}:{nodes:Node[];selection?:Set<string>;onToggle?:(id:string)=>void;scopeKey:string;view:'grid'|'list';query:string;onDetails:(n:Node)=>void;report:(s:string)=>void}) {
 const ref=useRef<HTMLDivElement>(null);const [size,setSize]=useState({width:1000,height:700}),[scroll,setScroll]=useState(0),[focus,setFocus]=useState<number|null>(null);
 useEffect(()=>{const element=ref.current!;const observer=new ResizeObserver(()=>setSize({width:element.clientWidth,height:element.clientHeight}));observer.observe(element);return()=>observer.disconnect();},[]);
 useEffect(()=>{ref.current?.scrollTo(0,0);setScroll(0);setFocus(null);},[scopeKey,query,view]);
 const columns=view==='list'?1:size.width<520?1:size.width<850?2:3;
 const cardWidth=(size.width-(columns-1)*24)/columns;
 const rowHeight=view==='list'?112:Math.ceil(cardWidth*9/16)+124;
 // A live bookmark update must preserve the viewport, including browser clamping at the end.
 useLayoutEffect(()=>{if(ref.current)setScroll(ref.current.scrollTop);setFocus(null);},[nodes]);
 const rows=Math.ceil(nodes.length/columns),start=Math.max(0,Math.floor(Math.min(scroll,Math.max(0,Math.ceil(nodes.length/columns)*rowHeight-size.height))/rowHeight)-1),end=Math.min(rows,Math.ceil((scroll+size.height)/rowHeight)+1);
 const indices=new Set(Array.from({length:Math.max(0,(end-start)*columns)},(_,i)=>start*columns+i).filter(i=>i<nodes.length));if(focus!==null&&focus<nodes.length)indices.add(focus);
 return <div ref={ref} className={`bookmark-viewport ${view}`} onScroll={e=>setScroll(e.currentTarget.scrollTop)} aria-label="可视化书签列表"><div style={{height:rows*rowHeight,position:'relative'}}>{[...indices].sort((a,b)=>a-b).map(i=>{const node=nodes[i];if(!node)return null;return <div key={node.id} onFocus={()=>setFocus(i)} style={{position:'absolute',width:cardWidth,left:(i%columns)*(cardWidth+24),top:Math.floor(i/columns)*rowHeight}}><BookmarkCard selected={selection?.has(node.id)} onToggle={selection&&onToggle?()=>onToggle(node.id):undefined} node={node} query={query} onDetails={onDetails} report={report}/></div>;})}</div></div>;
}
