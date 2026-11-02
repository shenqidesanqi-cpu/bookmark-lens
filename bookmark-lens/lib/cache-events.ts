const channel = typeof chrome !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bookmark-lens-cache') : null;
const listeners = new Set<()=>void>();
channel?.addEventListener('message',()=>listeners.forEach(fn=>fn()));
export function notifyCache() { listeners.forEach(fn=>fn());channel?.postMessage('changed'); }
export function subscribeCache(fn:()=>void) { listeners.add(fn);return ()=>{listeners.delete(fn);}; }
