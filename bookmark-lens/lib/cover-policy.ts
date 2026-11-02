/** Reject local/private targets before any automated request. Redirects are also rejected. */
export function publicUrl(value: string): URL {
 const url = new URL(value);
 const h = url.hostname.toLowerCase();
 if (!['http:','https:'].includes(url.protocol) || url.username || url.password || !h.includes('.') || h.endsWith('.') || h.includes(':') || /^\d/.test(h) || /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(h)) throw new Error('仅支持公开网站地址');
 return url;
}
export function coverKey(value: string) { const u=publicUrl(value);u.hash='';return u.href; }
export function originPattern(value: string) { return `${publicUrl(value).origin}/*`; }
export type CoverRecord = { url:string; image?:string; description?:string; fetchedAt:number; error?:string; imageUrl?:string };
export function freshCover(record:CoverRecord) { return Date.now()-record.fetchedAt < (record.error ? 60*60*1000 : 7*24*60*60*1000); }
export function parseCover(html: string, base: string) {
 const template = document.createElement('template');
 template.innerHTML=html;
 const doc=template.content;
 const meta = (key:string) => Array.from(doc.querySelectorAll('meta')).find(n=>(n.getAttribute('property')??n.getAttribute('name')??'').toLowerCase()===key)?.getAttribute('content')?.trim();
 const image = meta('og:image') || meta('twitter:image') || meta('twitter:image:src');
 if(!image)throw new Error('网站未提供分享封面');
 return { imageUrl:publicUrl(new URL(image,base).href).href, description:(meta('og:description')||meta('description')||'').slice(0,500) };
}
