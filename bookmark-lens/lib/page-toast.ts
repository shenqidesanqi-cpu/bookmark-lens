/** Self-contained function serialized by chrome.scripting; no outer references. */
export function showSavedToast(expectedUrl: string) {
  if (location.href !== expectedUrl) return;
  document.getElementById('bookmark-lens-saved-toast')?.remove();
  const host = document.createElement('div');
  host.id = 'bookmark-lens-saved-toast';
  host.style.cssText = 'all:initial!important;position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;z-index:2147483647!important;';
  const shadow = host.attachShadow({mode:'closed'});
  const panel = document.createElement('div');
  panel.setAttribute('role','status');
  panel.setAttribute('aria-live','polite');
  panel.style.cssText = 'display:flex;align-items:center;gap:12px;padding:16px 20px;background:#18181b;color:#fff;border:1px solid #3f3f46;border-radius:12px;box-shadow:0 8px 32px #0003;font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;max-width:calc(100vw - 48px);';
  const check = document.createElement('span');
  check.textContent = '✓';
  check.style.cssText = 'color:#a5b4fc;font-size:20px;';
  const text = document.createElement('span');
  text.textContent = '网页预览已保存';
  const close = document.createElement('button');
  close.textContent = '×';
  close.setAttribute('aria-label','关闭提示');
  close.style.cssText = 'cursor:pointer;border:0;background:transparent;color:#aaa;font:20px/1 sans-serif;padding:4px;margin-left:8px;';
  panel.append(check,text,close);
  shadow.append(panel);
  document.documentElement.append(host);
  const timer = setTimeout(()=>host.remove(),3500);
  close.onclick = ()=>{clearTimeout(timer);host.remove();};
}
