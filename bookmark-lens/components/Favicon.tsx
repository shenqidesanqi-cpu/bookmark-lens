import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
export default function Favicon({url}:{url:string}) {
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[url]);
 return <span className="favicon">{failed || !globalThis.chrome?.runtime ? <Globe size={18}/> : <img alt="" width="24" height="24" src={`${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(url)}&size=32`} onError={()=>setFailed(true)}/>}</span>;
}
