import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, canCapture, thumbnailSize } from '../lib/capture-utils';
import { readPreview, savePreview, removePreview, clearPreviews } from '../lib/cache';
const legacy: Record<string, unknown> = {};
Object.assign(globalThis, { chrome: { storage: { local: {
  get: async (key: string | null) => key ? { [key]: legacy[key] } : { ...legacy },
  remove: async (keys: string | string[]) => { for (const key of typeof keys === 'string' ? [keys] : keys) delete legacy[key]; },
} } } });
test('normalization retains meaningful URL data and removes fragments', () => {
  assert.equal(normalizeUrl('https://EXAMPLE.com:443/path?q=1#section'), 'https://example.com/path?q=1');
  assert.notEqual(normalizeUrl('https://example.com/?q=1'), normalizeUrl('https://example.com/?q=2'));
  assert.throws(() => normalizeUrl('invalid'));
});
test('capture excludes privileged pages and extension store', () => {
  for (const url of ['chrome://settings', 'file:///tmp/a', 'chrome-extension://id/a', 'https://chromewebstore.google.com/detail/a', 'https://chrome.google.com/webstore/detail/a', 'invalid']) assert.equal(canCapture(url), false);
  assert.equal(canCapture('https://example.com'), true);
});
test('thumbnail preserves ratio without upscaling', () => {
  assert.deepEqual(thumbnailSize(1920,1080), {width:480,height:270});
  assert.deepEqual(thumbnailSize(240,120), {width:240,height:120});
  assert.throws(() => thumbnailSize(0,10));
});
test('IndexedDB cache supports URL aliases, bookmark associations, overwrite, deletion and migration', async () => {
  await clearPreviews();
  const value = {image:'data:image/webp;base64,AAAA',description:'用途',savedAt:1,bookmarkIds:['one']};
  await savePreview('https://example.com/#first',value);
  assert.equal((await readPreview('https://example.com/#second','two'))?.description,'用途');
  assert.deepEqual((await readPreview('https://example.com/'))?.bookmarkIds,['one','two']);
  await savePreview('https://example.com/',{...value,savedAt:2});
  assert.equal((await readPreview('https://example.com/'))?.savedAt,2);
  await removePreview('https://example.com/#third');
  assert.equal(await readPreview('https://example.com/'),null);
  legacy['preview:https://legacy.com/'] = value;
  await readPreview('https://legacy.com/','legacy');
  assert.equal(legacy['preview:https://legacy.com/'],undefined);
  assert.deepEqual((await readPreview('https://legacy.com/'))?.bookmarkIds,['legacy']);
  await clearPreviews();
  assert.equal(await readPreview('https://legacy.com/'),null);
});
