import {readJob,writeJob,recoverJob} from '../lib/batch-model';
import {safeClose} from '../lib/batch-engine';
import {captureTab,saveScreenshot} from '../lib/screenshot';
import { showSavedToast } from '../lib/page-toast';
import { canCapture, normalizeUrl, thumbnailSize } from '../lib/capture-utils';
import { readPreview, savePreview } from '../lib/cache';
import { flatten } from '../lib/bookmark-model';
const MENU_ID = 'save-page-preview';
export default defineBackground(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
  chrome.action.onClicked.addListener(() => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('/manager.html') }).catch(console.error);
  });
  const setup = () => chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: '保存当前网页预览', contexts: ['page'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
  });
  chrome.runtime.onInstalled.addListener(setup);
  chrome.tabs.onRemoved.addListener(tabId=>{void (async()=>{const job=await readJob();if(job?.runnerTabId!==tabId)return;for(const id of job.ownedTabs)await safeClose(job,id);if(job.status==='running')await writeJob({...recoverJob(job),ownedTabs:[]});})().catch(console.error);});
  chrome.runtime.onStartup.addListener(()=>{void readJob().then(job=>{if(job&&(job.status==='running'||job.status==='ready'))return writeJob(recoverJob(job));}).catch(console.error);});
  let busy = false;
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID) return;
    void capture(tab);
  });
  async function status(error: string | null) {
    await chrome.storage.local.set({ captureStatus: { error, time: Date.now() } });
    await chrome.action.setBadgeText({ text: error ? '!' : '✓' });
    await chrome.action.setBadgeBackgroundColor({ color: error ? '#DC2626' : '#6366F1' });
    await chrome.action.setTitle({ title: error ? `截图失败：${error}` : '预览已保存 · 打开 Bookmark Lens' });
  }
  async function capture(tab?: chrome.tabs.Tab) {
    if (busy) { await status('正在保存另一张截图，请稍后重试'); return; }
    busy = true;
    try {
      if (!tab?.id || !tab.url || !canCapture(tab.url)) throw new Error('此页面不支持截图，请在普通 HTTP/HTTPS 网页中使用');
      const blob=await captureTab(tab.id,tab.windowId,tab.url);
      const url = normalizeUrl(tab.url);
      const bookmarks = flatten(await chrome.bookmarks.getTree());
      const bookmarkIds = bookmarks.filter(node => { try { return normalizeUrl(node.url!) === url; } catch { return false; } }).map(node => node.id);
      await saveScreenshot(tab.url,bookmarkIds,blob);
      await status(null);
      // Display feedback only after persistence and only in the original page.
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showSavedToast,
          args: [tab.url],
        });
      } catch (notificationError) {
        console.warn('保存成功，页面提示未能显示', notificationError);
      }
    } catch (error) {
      await status(error instanceof Error ? error.message : '截图失败，请重新右键授权后再试');
    } finally { busy = false; }
  }
});
