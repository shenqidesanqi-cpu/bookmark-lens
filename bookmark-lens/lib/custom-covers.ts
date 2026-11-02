import { notifyCache } from './cache-events';
import type { CompressionResult } from './image-compression';
import type { Crop } from './cover-edit';
export type EditSource = { source?: Blob; crop?: Crop };
export type CustomCover = CompressionResult & EditSource & { bookmarkId: string; savedAt: number };
async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('bookmark-lens-custom-covers', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('covers', { keyPath: 'bookmarkId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('covers', mode);
    let request: IDBRequest<T>;
    try { request = action(transaction.objectStore('covers')); }
    catch(error) { transaction.abort(); db.close(); reject(error); return; }
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('封面保存失败')); };
  });
}
export function readCustomCover(bookmarkId: string) { return run<CustomCover | undefined>('readonly', store => store.get(bookmarkId)); }
export async function saveCustomCover(bookmarkId: string, result: CompressionResult & EditSource) {
  await run('readwrite', store => store.put({ ...result, bookmarkId, savedAt: Date.now() }));
  notifyCache();
}
export async function removeCustomCover(bookmarkId: string) {
  await run('readwrite', store => store.delete(bookmarkId));
  notifyCache();
}
export function coverSource(custom?: string, screenshot?: string, og?: string) {
  return custom ? { image: custom, label: '自定义封面' } : screenshot ? { image: screenshot, label: '本地截图' } : og ? { image: og, label: '网站分享图' } : { image: undefined, label: '暂无封面' };
}
