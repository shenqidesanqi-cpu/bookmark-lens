import { notifyCache } from './cache-events';
import { normalizeUrl } from './capture-utils';
export type PreviewData = { image: string; blob?: Blob; taskId?: string; description: string; savedAt: number; bookmarkIds?: string[] };
type RecordData = PreviewData & { url: string };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('bookmark-lens', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('previews', { keyPath: 'url' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function operation<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('previews', mode);
    const request = action(tx.objectStore('previews'));
    if(mode==='readwrite')tx.addEventListener('complete',notifyCache);
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error('本地数据库操作失败')); };
  });
}
export async function readPreview(url: string, bookmarkId?: string): Promise<PreviewData | null> {
  const key = normalizeUrl(url);
  const cached = await operation<RecordData | undefined>('readonly', store => store.get(key));
  if (cached) {
    if (bookmarkId && !cached.bookmarkIds?.includes(bookmarkId)) {
      cached.bookmarkIds = [...(cached.bookmarkIds ?? []), bookmarkId];
      await savePreview(url, cached);
    }
    return cached;
  }
  // Migrate the previous version's cache only after a successful IndexedDB write.
  const legacyKey = 'preview:' + url;
  const legacy = (await chrome.storage.local.get(legacyKey))[legacyKey] as PreviewData | undefined;
  if (legacy?.image?.startsWith('data:image/')) {
    await savePreview(url, { ...legacy, bookmarkIds: bookmarkId ? [bookmarkId] : [] });
    await chrome.storage.local.remove(legacyKey);
    return legacy;
  }
  return null;
}
export async function savePreview(url: string, data: PreviewData) {
  await operation('readwrite', store => store.put({ ...data, url: normalizeUrl(url) }));
}
export async function removePreview(url: string) {
  await operation('readwrite', store => store.delete(normalizeUrl(url)));
  const legacy = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(legacy).filter(key => {
    if (!key.startsWith('preview:')) return false;
    try { return normalizeUrl(key.slice(8)) === normalizeUrl(url); } catch { return false; }
  }));
}
export async function clearPreviews() {
  await operation('readwrite', store => store.clear());
  const values = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(values).filter(k => k.startsWith('preview:')));
}
