export function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  return url.href;
}
export function canCapture(value: string): boolean {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !['chromewebstore.google.com'].includes(url.hostname) && !(url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore')); } catch { return false; }
}
export function thumbnailSize(width: number, height: number) {
  if (width <= 0 || height <= 0) throw new Error('无效截图尺寸');
  const target = Math.min(480, width);
  return { width: target, height: Math.max(1, Math.round(height * target / width)) };
}
