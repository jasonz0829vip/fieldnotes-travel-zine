# FIELDNOTES · 全国按需精细地图（P0 适配器，尚未正式开通）

**当前状态**：PMTiles 瓦片定位、按需缓存、离线取用与逐区删除已接入 V3.9 *开发分支*。正式上线的 V3.9 仍只有原来三处局部 Z13 包；**未启用全国地图，也没有在中国无代理手机上验收**。不能用“架构支持全国”冒充“全国已可用”。

## 产品行为

在原三步界面中，用户仍是“上传照片 → 选择地点 → 六张作品”。当已配置可用地图源：

- 输入的省市区县经已有行政地名库取得**大致行政中心**；若照片经过用户授权包含准确 GPS，则按实际坐标下载。
- 程序先验证 PMTiles HTTP Range archive 包含该坐标并具有真正 Z14 MVT；这是一次通用目录读取，不自动下载精细瓦片。不能下载时明确告知，允许走原有真实行政区轮廓。
- 用户主动点击「下载该地点精细地图」才按 Z14 的 3×3 九瓦片拉取；最大 12 MiB、每瓦片 2 MiB、每地点独立缓存、最多 12 个地区。状态成功后按已保存的真实瓦片绘图，断网可重开。
- 断网时默认使用已下载地区包；没有覆盖就走基础轮廓。接近下载区边缘但不足完整九张覆盖时标注“部分覆盖”，绝不伪装全国预装。
- 设置 → 离线地图管理，能看到每个已缓存地点及大小，允许逐一删除或一键删全部，不删除已经保存到系统相册的照片。

## 成熟组件，不重复造轮子

- `pmtiles.PMTiles(url).getHeader()/getZxy(z,x,y)`：Protomaps PMTiles JS BSD-3，应用本地带源码构建产物，不依赖国外 CDN 运行。
- 原来 @mapbox/vector-tile / PBF、道路水道建筑 Canvas 渲染器均保留，只增加 Cache Storage 查找。
- 全国地图建库可复用 Planetiler 以 Geofabrik 的 OSM 中国 extract 输出 PMTiles；国内静态托管必须支持 **HTTPS + Accept-Ranges/206 + CORS (若跨域)**，无服务端进程。OSM 数据署名、衍生数据库许可需核实。
- 参考 [Protomaps/PMTiles](https://github.com/protomaps/PMTiles)、[Planetiler](https://github.com/onthegomap/planetiler)、[Geofabrik 中国下载](https://download.geofabrik.de/asia/china.html)。

## 严格的分发边界

`preview/v39/national-map-source.js` 默认 `enabled:false`，`url:''`，所以普通用户不会在海外服务器自动下载，也不会被误导“全国已上线”。只有经过合法数据、国内无代理真机 HTTPS Range 速度和稳定性验证后，才可在独立预览版把有效 `PMTiles` URL 及唯一 `version` 配进该文件。注意不能在网页公共代码里存密钥。

所有图片由用户手机本地合成；用户点击下载精细地图时，外部地图服务将接收到所选择的瓦片区域（瓦片坐标），因此界面明确告知此行为。不会上传照片或完整原始 GPS EXIF。

## 自动化验收

CI 使用 **临时** real OSM 杭州市中心 Z14 九瓦片（OpenFreeMap 限额内），利用官方 Python `pmtiles` writer 构造真实 PMTiles archive，放在 CI 本地 HTTP Range 文件服务器，验证：

1. 用户在“杭州市”选择前不自动下载瓦片；有可用 PMTiles 源时正确提示并经用户点击才读取该地瓦片。
2. 真正的 HTTP Range 206 调用，从非既有三地区读取真实道路、水面和建筑 MVT。
3. 六图采用真实 Z14，飞行模式重启仍有效。
4. 地图在设置中按地区删除，Cache Storage 数据消失，已存其他版本缓存不受影响。
5. **不将临时 OSM PBF / PMTiles archive 上传 GitHub 或作为 artifact 保存**，仅测试日志。个人照片完全不参与测试。

**后续尚须交付**：合法覆盖全国的静态 PMTiles 文件 + 中国普通网络可达的免费或可接受成本托管入口 + 真机安卓微信/iPhone 保存。测试中的临时杭州归属只能证明按坐标读取链路可运行，不能证明全国数据完备。


## 国内无自有域名的现实边界（2026-10-18 核验）

- 官方 Geofabrik 中国 OSM 最新 extract 当前约 **1.5 GB**，不是可以直接塞进手机的离线文件。Planetiler 能把它加工成 PMTiles，但官方建议工作磁盘空间为输入 PBF 的约 5–10 倍，实际产物大小需在真实构建后测量；不要提前许诺几 MB 就可覆盖全国。
- 腾讯云 COS 官方确认 2024-01-01 后新建桶默认域名的静态网站预览被限制；阿里云 OSS 官方确认 2025-03-20 后新开通的大陆地域 bucket 用默认外网域名访问数据接口受到限制。不能把这两类默认域名说成已验收的免费永久公开站点。部署平台的公有 URL 必须分别通过实际 **HTTPS Range 206 / CORS / 无代理中国电信与移动网络** 检测。
- 目前还没有经确认的国内普通网络长期稳定 HTTPS 全国 PMTiles 提供方。请在取得合法数据源和中国内地可用的分发入口前保留 `enabled:false`，PR 不合并到稳定入口。
- OpenFreeMap 官方仅允许用户在每次限定下载中最多 3,000 张瓦片或 50 MB，且最多 4 个并发；研究下载已严格限制并没有将第三方瓦片公开归档。**不得把该公共服务直接当成我们可无上限转载的全国静态数据源。**

来源：[Geofabrik China](https://download.geofabrik.de/asia/china.html)、[Planetiler](https://github.com/onthegomap/planetiler)、[Tencent COS 默认域名政策](https://cloud.tencent.com/document/faq/436/102489)、[Alibaba OSS 域名策略](https://www.alibabacloud.com/help/zh/oss/user-guide/regions-and-endpoints)、[OpenFreeMap ToS](https://openfreemap.org/tos/)。

## 无自有域名的候选分发实测：ModelScope Static Studio

已核验中国魔搭 ModelScope 支持 static 类型的创空间，预编译的 index.html 可托管在平台生成的 Studio 网址下。现成官方部署 Skill：https://github.com/modelscope/modelscope-skills/blob/main/skills/ms-studio-deploy/SKILL.md 。不需要另造服务器或重新写部署工具。

这是一条**候选方案，不是已验证的家庭生产服务**。通过标准：

1. 中国移动/电信普通手机使用无代理网络访问真正的 Static Studio 应用地址；浏览器可访问不能用网页内嵌 iframe 冒充独立可安装 PWA。
2. Safari 与安卓 Chrome 从独立网址进入 /probe/ 并点击“开始自检”，必须同时通过 HTTPS、应用 JS、Service Worker、Cache Storage、真正的 HTTP 206 + Content-Range。安卓微信内置浏览器另测照片保存。
3. 测试真实较小 PMTiles 的 HTTP Range 与跨域 CORS；对 >100MB 文件的 Git LFS、全国地图的长期可用性与托管条款逐项核实。128KB 文件支持 206 不等于全国 GB 级 PMTiles 必定可用。
4. 如果大型地图不能与 Static Studio 同源托管，保留此处轻量 UI，再选择有明确授权的国内地理数据托管方。不为地图重造服务器。

CI 自动生成 FIELDNOTES_V39_MODELSCOPE_STATIC_TRIAL.zip：完整 V3.9 静态程序 + /probe/index.html + 128 KiB 自有字节区间测试文件。无需 Python 服务器、付费 GPU 或额外域名。全国在线地图源仍保持 disabled，不宣称全国覆盖已交付。

其他方案限制：Gitee Pages 官方下线；EdgeOne Pages 无备案默认预览链接面向大陆有短时效；CloudBase 默认域名存在访问中间页和风控；GitHub Pages 不同大陆网络可达性存在波动。
来源：https://modelscope.cn/posts/2382 、https://github.com/modelscope/modelscope-skills 、https://pages.edgeone.ai/zh/document/domain-overview 、https://docs.cloudbase.net/service/alias 、https://gitee.com/oschina/git-osc/issues/I9QF16 。

权限与隐私：目前仅在 GitHub 生成测试包，没有获得用户的 ModelScope 账户授权，不会擅自创建资源或让用户在聊天中发送 API Token。如需使用官方部署 Skill，先授权账号，创建 PRIVATE Static Studio，真实手机验收后才考虑公开。
