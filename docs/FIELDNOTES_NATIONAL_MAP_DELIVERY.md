# FIELDNOTES 全国按需地图 · 交付门槛与数据接口（2026-10-18）

## 目标，不再以三个局部样板当成“全国覆盖”

面向中国任意地点的旅行摄影编辑器：用户输入省／市／区县或允许读取照片 GPS，系统选择**已验证的精细道路、水系、建筑**矢量地图。用户可以下载所在位置附近的 3×3 个矢量瓦片到 Cache Storage，断网再打开；地图可单独删除。没有数据就用真实行政区划回退，不伪造地理图层，不因缺数据阻止生成作品。

“全国任意地点可以尝试查询” ≠ “全国任何地方都有高精度地理要素” ≠ “中国无代理手机首次打开已验收”。

## 成熟方案的选择

- **原始数据：** [Geofabrik 中国 OSM 数据](https://download.geofabrik.de/asia/china.html)，全国与省级切片，数据 ODbL；全国原始文件约 1.5 GB（大小会变化），不是要求用户手机下载的文件。
- **一次性生成：** [Planetiler](https://github.com/onthegomap/planetiler) 官方 OpenMapTiles profile，将原始 OSM PBF 转为 PMTiles，支持地方、省份、全国。
- **按位置读取：** [PMTiles](https://github.com/protomaps/PMTiles)（浏览器库使用 pmtiles@4.5.0，BSD-3-Clause），HTTP Range 只请求对应矢量瓦片，避免始终在线的自建地图数据库。
- **现有渲染：** 继续使用 FIELDNOTES 原生 Canvas + Mapbox Vector Tile/PBF；绝不迁移整个编辑器。
- **本机缓存：** `fn39-national-tiles-v1` Cache Storage 独立于 V3.9 shell 与原三地区缓存。每地点最多 9 张附近瓦片、单次数据上限 12 MiB，单瓦片 1.5 MB，最多两并发。只有真实中心瓦片下载成功才认定“已缓存”；局部缺失明确提示。

## 真正的源端仍需配置及验收

`preview/v39/data/national-map-index-v1.json` 当前是 `{"version":1,"sources":[]}`。**这意味着线上页面并未因此变成全国可下载地图，默认不会尝试连接外国地图服务。** 只有在存储、许可、国内 HTTPS 服务同时通过验收后，才准添加真实源。

源定义参考（**示例，不是已经上线的公共接口**）：

```json
{
  "version": 1,
  "sources": [
    {
      "id": "china-osm-openmaptiles-202610",
      "name": "中国 OSM 全国矢量地图",
      "schema": "openmaptiles",
      "type": "pmtiles",
      "zoom": 14,
      "bounds": [73.5, 17.0, 135.1, 53.6],
      "url": "https://YOUR-VERIFIED-CN-HTTPS-HOST/china.pmtiles",
      "crossOriginApproved": true,
      "sourceName": "OpenStreetMap / ODbL"
    }
  ]
}
```

`bounds` 仅表示归档大致范围，**不能据此断定当地有真实路、楼或水系**；点击下载后实际检查中心瓦片及地理数据。覆盖一省或全国的 PMTiles 允许局部 Range 读取，但没有 GPS 时必须标注“区域中心、近似位置”。

上线前严格检查：HTTPS、HTTP 206 Range、CORS `Access-Control-Allow-Origin`、合理 Content-Range/Length、元数据 minzoom/maxzoom、实际 OpenMapTiles 层、面向中国联通/电信/移动的网络成功率、带宽和费用、数据源的署名及更新。大陆服务器的网站通常涉及域名备案；用户目前没有自有域名，因此暂不能宣布正式国内分发完成。

## 数据安全与许可

- 用户照片、EXIF、完整 GPS 和生成成品都不会上传给地图源。请求 PMTiles 的字节 Range 仍可能使托管方间接推断请求的是哪片地图，需在隐私说明披露。
- 下载过的位置在本机缓存中可能留下瓦片坐标（近似地理位置）；可以在“设置 → 离线地图管理”按区域或整体清除。删除地图不删除系统相册图片。
- 使用 Geofabrik OSM 派生数据需要 OpenStreetMap 署名，派生数据库遵循 ODbL；Planetiler 和 PMTiles 软件许可证与地图数据许可证分开管理。
- 高德/腾讯/天地图等地图平台不能因其在国内可访问就自动推断“允许抓取并分发离线矢量瓦片”；未获得明确授权不得用来替代 OSM 生成链路。
- 地理数据覆盖率与中国测绘地理信息合规要求需做单独评估，不能把技术试验当发布许可。

## 已完成与尚未完成

- 既有 V3.9：三个中心局部真实 Z13 地图包、三步操作、6+6 作品。
- P0 实测：OpenFreeMap 公开瓦片的小规模匿名基准，16 个地点中 15 个成功取得几何要素，青海高原测试点未返回可用矢量瓦片；此为国外 CI 技术数据探测，不是中国家用手机在线可达性证明，且未来不将公共 OpenFreeMap 作为家用手机运行时依赖。
- P0 开发分支：独立的 PMTiles 归档目录、局部瓦片事务式缓存、断网恢复与按地点清理；通过配置关闭未验收地图源。
- **正在验收：** Geofabrik 海南 OSM 提取文件 → Planetiler PMTiles → 实际“海口市”选地、按需读取、生成、离线和清理。
- **还没有交付：** 经过中国普通网络测试的合法 PMTiles 全国静态分发入口；iPhone/Android 真机首次安装与安卓微信真实保存相册；全国范围的地图质量审美验收。

## 决策门槛

1. CI 先拿一省（海南）测试一次完整 PMTiles；成功再规划省级批量任务，不下载 1.5GB 原始全国文件到所有手机。
2. 确定不依赖 QLS/3070 常开的、符合数据许可与中国网络的 HTTPS 静态存储。未经用户授权不得开收费云服务或购买域名。
3. 只有经过任意城市/县区实地抽样，地图完整、离线删除可测、国内网络真机验证，才把该源列入正式 catalog。
4. 继续以**真实地理质量**（道路/河道/建筑层与主体保护）而不是“模板更多了”作为产品验收依据。
