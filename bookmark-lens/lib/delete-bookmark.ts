import { removeCustomCover } from './custom-covers';
import type { Node } from './bookmark-model';
/** Only remove a single URL bookmark; never remove a folder or shared URL caches. */
export async function deleteBookmark(node: Node): Promise<string> {
  if (!node.url) throw new Error('此操作只支持删除单个书签');
  await chrome.bookmarks.remove(node.id);
  try { await removeCustomCover(node.id); }
  catch { return '书签已删除，但自定义封面缓存清理失败'; }
  return '书签已删除';
}
