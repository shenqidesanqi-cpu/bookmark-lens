# Bookmark Lens

基于 WXT、React 和 TypeScript 的 Chrome 可视化书签管理插件，采用 Manifest V3。

## 功能

- 独立深色管理页，保留 Chrome 原有文件夹结构，支持搜索、网格与列表切换。
- 保留侧边栏浏览、悬停预览及固定预览。
- 自动获取网站分享图；支持右键保存当前网页预览。
- 自定义封面上传、拖拽和粘贴，支持定位、缩放及本地 WebP 压缩。
- 批量生成封面，支持暂停、继续、停止及持久化进度。
- 图片存储在本机 IndexedDB；用户自定义封面优先，不被自动封面覆盖。

## 开发与检查

需要 Node.js 22+ 和 pnpm。

```bash
git clone https://github.com/shenqidesanqi-cpu/bookmark-lens.git
cd bookmark-lens/bookmark-lens
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## 在 Chrome 安装

1. 构建完成后打开 `chrome://extensions`，启用开发者模式。
2. 点击「加载已解压的扩展程序」，选择源码目录中的 `bookmark-lens/.output/chrome-mv3`。
3. 点击工具栏图标打开独立书签管理页。
4. 更新代码并重新构建后，在扩展管理页点击重新加载。

开发模式运行 `pnpm dev`，加载 `.output/chrome-mv3-dev`。

## 权限与隐私

书签通过 Chrome API 读取并同步。单个书签删除需要用户在界面明确确认。网页截图和自定义封面均在本地处理、缓存，不上传服务器。

自动分享图需要访问对应网站。批量截图由用户主动启动，会依次访问网站并切换任务窗口中的活动标签页，跨站截图需要用户授予可选网站访问权限。请排除私人后台、内网和敏感页面；截图可能包含页面中可见的私人信息。

## 代码

扩展源码、测试及详细开发记录位于 [bookmark-lens](./bookmark-lens)。依赖、构建产物及本地图片缓存不纳入仓库。
