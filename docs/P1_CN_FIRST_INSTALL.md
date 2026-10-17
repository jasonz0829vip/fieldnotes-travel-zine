# P1｜国内首次安装、离线地区包与存储清理（2026-10-18）

## 当前状态（不能提前宣布 P1 完成）

- V3.8-P1 的基础照片编辑及全国行政区轮廓无需远程 API；国内手机首次打开仍必须有可访问的 HTTPS 网页入口，或另行封装安装包。
- 用户没有自有网站或备案域名。**目前没有已验证的、免费无域名且国内长期稳定的 iPhone/Android 共用发布入口**；不得用海外代理侧 HTTP 200 代替国内真机测试。
- 新建独立 P1 存储管理分支：三个精细街道包从原本单一 `offline-tiles-v38.js` 分拆成独立 `packs/469028.js`（陵水）、`packs/310101.js`（上海黄浦）、`packs/610113.js`（西安雁塔）。
- **网页版**首次打开只缓存基础程序、行政区划；精细街道由用户逐地区下载。已下载街道放进每地区独立 Cache Storage。删除单个地区不会删除基础制图；程序更新不会顺带误删地区缓存。
- **Windows file:// 版**将三个街道文件随 ZIP 放在磁盘：浏览器无法删除磁盘文件，需用户在文件管理器删除 packs/ 中对应文件，或直接删除整个解压文件夹。
- 页面“离线地图 / 存储管理”支持查看各地区缓存大小、逐地区删除、删除全部街道地图、清除本版本 PWA 离线程序与地图。全部清理不会直接卸载手机主屏幕图标，也不会删除已导出的系统相册照片和本地下载的工程文件。
- 浏览器 HTTP 磁盘缓存属于浏览器管理，不保证随着 Cache Storage 删除即时释放；若要彻底清除，仍可在系统浏览器网站数据中清除对应站点。存储空间估值可能包括该域名的其他版本。

## 新的静态分发产物

由 `preview/v38-p1/tools/build_domestic_static.py` 生成：

`preview/v38-p1/downloads/FIELDNOTES_V3.8_P1_Managed_Maps_Static_Deploy.zip`

**注意：新的 ZIP 需要实际执行构建脚本后才存在；旧 `FIELDNOTES_V3.8_P1_Domestic_Static_Deploy.zip` 仍是单体街道包，不具备逐地区删除能力。不要拿旧包当新包部署。**

构建步骤（QLS、RTX3070 使用相同脚本；不需要公网服务器）：

1. 可选执行 `node preview/v38-p1/tools/split_offline_packs.cjs`，从旧 V3.8 街道包离线重建三份独立地图数据；无需访问国外地图源。
2. 运行 `node preview/v38-p1/tools/test_managed_packs.cjs`，检查地图数据校验、区域包管理与离线恢复。
3. 运行 `python preview/v38-p1/tools/build_domestic_static.py`，核对 ZIP 清单与 SHA256。
4. 部署时解压，必须保留 `index.html`、`sw.js`、`packs/`、`data/`、`icons/`、`licenses/`，并通过 HTTPS 提供所有文件。

## 不拥有域名时的选择

| 路径 | 现实边界 | 本阶段处理 |
|---|---|---|
| 原有 GitHub Pages 预览 | 免费，但未证实国内普通网络长期可靠 | 保留开发预览；国内无代理真机测试可作为第一步 |
| 腾讯云 CloudBase 默认域名 | 官方明确仅限开发测试，有安全提示中间页、限流等，不可当家人正式入口 | 仅供可行性测试，若不符合需求立即停止 |
| 安卓离线 APK（Capacitor 等成熟封装） | 不需要域名；须验证 Android WebView 的相册导出、离线地区包与安装更新 | 有价值的下一路线，尚未封装与签名 |
| iPhone 原生发布 | 无域名也能做，但分发涉及 Apple 签名、审核或开发者权益；TestFlight 测试包会到期 | 不承诺免费永久可装 |
| 正式大陆 HTTPS 网站（备案域名） | 相对稳定但需要合法域名、托管与备案 | 用户目前没有，不能假设已有 |

官方文档：[CloudBase 默认域名限制](https://docs.cloudbase.net/service/alias)、[iPhone Safari 添加主屏幕网页 App](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)、[TestFlight 90 天有效期](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)。

## 必须通过的真实设备验收

1. **国内无代理安卓 + iPhone**：普通手机网络首次打开、拍照/导入、生成、保存到相册；记录设备型号、系统/浏览器及实际照片保存结果。
2. 只下载上海黄浦街道包；用飞行模式关闭并重启 App 后再次生成；不能有国外地图 API 请求。
3. 在存储管理里删掉上海包，证明该缓存真实消失。断网重新打开，基本行政区轮廓仍可出图，且不会在背后重新下载上海。
4. 删除所有地图包，基础编辑可用；清除本版本离线程序后应明确提示必须联网重新安装。
5. 不能删除其他版本的 Service Worker/cache，也不能删相册作品和工程文件。
6. Android 微信真实相册保存与 iPhone Safari/微信原有分享/保存各自验收，模拟器或 Node 测试不能替代真机。

当前属于**功能改造与自动化测试阶段**，不代表国内手机首次安装入口问题解决或 P1 验收完成。