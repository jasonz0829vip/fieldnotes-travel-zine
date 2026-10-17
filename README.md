## Android V3.6 - Native file picker compatibility fix (2026-10-17)
Photo upload and direct camera capture use full-size native file inputs instead of scripts clicking hidden file elements. Service-worker cache version bumped for PWA update. If an Android in-app browser still blocks file picker, open the site using Chrome. Photos remain on device.

# FIELDNOTES V3.6 · 全国地理一键旅行摄影

手机访问：https://jasonz0829vip.github.io/fieldnotes-travel-zine/

拍照/上传 → 选择省、市或区县 → 一键生成3版 → 不满意直接换一组 → 保存/分享。全程本地处理，无服务器上传照片。

区划名称记录：34省级、342市级、3057区县级。真实地图轮廓：34省级、333市级、2861区县级；缺失轮廓回退到有数据的上级地图并明确标注，不伪造 GPS、道路或区县边界。

安装手机：先在 iPhone Safari 打开 HTTPS 网页，待离线文件加载完成，分享→添加到主屏幕。离线首次启动及保存相册仍建议在 iPhone 真机验证。电脑版需整包保留 data 目录，不能只双击单一 HTML。

编辑算法基于本机照片纹理/亮度、固定地图和模板规则，不具有云端生成式 AI 能力。Windows 和 iPhone 照片都只在本机浏览器内处理。

# FIELDNOTES · Offline Travel Zine Studio

旅行摄影 + 地理地图的离线编辑器。支持照片原图保真、四种排版、海南及中国区域轮廓、导出 PNG。用户照片仅在本设备浏览器内读取、渲染、导出，不会发送给此站点或 GitHub。

## iPhone / iPad 使用

1. 在 Safari 打开 **https://jasonz0829vip.github.io/fieldnotes-travel-zine/**。
2. 等待应用内的“离线文件已缓存”状态提示；保持联网并刷新一次，确保首次缓存就绪。
3. 点击 Safari 分享菜单 → **添加到主屏幕** → 选择作为网页 App 打开。
4. 从主屏幕打开 FIELDNOTES，导入照片，选择原片、轻地图、上方外置版头、画册侧栏等模式。
5. 生成 PNG 后使用系统分享菜单 **存储图像** 或 **存储到文件**。
6. 断开网络或开飞行模式，完全退出后重新从主屏幕打开进行首次离线验证。

**注意：** iOS 会在存储压力下清理离线缓存；重要作品和 `.tzine` 工程请另存。不同版本的 iOS Safari 对主屏幕 PWA、相册保存、HEIC 的支持可能有所差别，需真机验证。

## Windows 版

本项目 `index.html` 可直接保存到 Windows 本地，通过 Chrome 或 Edge 使用，不需要安装服务端。直接双击本地文件无法启用 Service Worker 主屏幕安装，这是浏览器安全策略，并不影响基本照片编辑功能。

## 离线与地理精度

- 完全本地运行：编辑器自身无外部 API 或第三方字体依赖。初次安装 PWA 时需要 HTTPS 网络，缓存成功后可离线运行。
- 中国省级轮廓、海南 19 市县边界内置；地图是区域级地理图，不包含全面的街道水系和等高线。
- 有 EXIF GPS 的 JPEG 可以自动识别；只有城市或景区名称时显示近似区域，不能当作真实拍照 GPS。
- 大照片在 iPhone 上为了避免超出 Canvas 内存限制可能缩小导出尺寸。
- 原片优先模式不会强制加地图；照片和地图是否适合叠加最终由用户自行判断。

## 开源资料

地图资料来自 [Supeset/China-GeoData](https://github.com/Supeset/China-GeoData) 与 [zhChuXiao/ChinaGeoJson](https://github.com/zhChuXiao/ChinaGeoJson)，其 MIT 许可及版权声明见 `THIRD_PARTY_LICENSES.txt`。Natural Earth 几何资料为公有领域。

本仓库只包含编辑器静态文件、安装图标和离线缓存脚本，**不包含任何私人照片、GPS 拍摄记录或用户工程**。

## Android 保存/分享兼容性补丁

安卓端专用 android-save-v36.js：原生 PNG 下载超链接、系统分享失败时弹窗内即时反馈，以及高清图片长按保存入口。
该代码严格限定 Android user-agent 执行，不变更 iPhone/iPad 既有导出逻辑。
Android App 内置浏览器可能禁止文件下载或原生分享；可在 Chrome 打开 HTTPS 页面重试。
Service Worker 缓存版本更新以保证安卓下载到新版脚本。
