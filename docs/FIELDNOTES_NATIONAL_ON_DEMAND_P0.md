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
