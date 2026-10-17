# P1｜中国普通网络首次使用：国内发布决策与交付包

## 结论（2026-10-18）

1. FIELDNOTES 当前 V3.8-P1 的离线计算已经独立于海外服务；但首次安装仍需要一个真实可到达的 HTTPS URL。
2. `GitHub Pages` 作为开发预览可以保留，但不能仅凭美国/代理侧 HTTP 200 宣称中国普通微信、Safari、Chrome 可访问。
3. 不把 QLS/3070 暴露公网，不要求父母妻子连 VPN、代理、Tailscale、RustDesk，也不要求你的两台电脑在线。
4. **优先复用已有的、拥有合法授权的、在中国普通网络可稳定访问的 HTTPS 静态站点**，发布纯静态页面即可。项目按根目录部署。
5. 如需中国大陆 CDN 加速域名，通常需要有效 ICP 备案；没有已备案域名/账号，不要靠申请海外静态网站谎报 P1 完成。

## 交付物

`preview/v38-p1/downloads/FIELDNOTES_V3.8_P1_Domestic_Static_Deploy.zip`

ZIP 解压内容包含 `index.html`、对应 JS/CSS、`data/`、`icons/`、`licenses/`、`sw.js`、`manifest.webmanifest`、`offline-tiles-v38.js`，没有个人照片、密钥、GitHub token 或后端服务。

`preview/v38-p1/tools/build_domestic_static.py` 可以在 QLS 和 RTX3070 使用同一份 Python 脚本重复构建。

## 可选的正式分发路径

| 方案 | 国内首装 | 难度 | 前置条件 |
|---|---|---|---|
| 复用家人/公司已授权的**备案 HTTPS 网站**中的 FIELDNOTES 目录或独立子域名 | 首选，待真机测 | 低 | 网站管理员同意、站点支持上传静态文件和 PWA 路径 |
| 腾讯云 EdgeOne Pages / 阿里云 ESA **国内加速** | 可行但待验收 | 中 | 已备案域名、服务商账号、对应发布配置 |
| 微信小程序 | 长期备选；原生相册保存较明确 | 中高 | 小程序主体/审核/开发适配；不等于当前 H5 可直接打包 |
| GitHub Pages / Render / 其他境外免费静态托管 | 开发测试 | 低 | **不能据此保证中国普通手机无代理能用** |

腾讯 EdgeOne 官方：[Pages 访问及备案规则](https://edgeone.cloud.tencent.com/pages/document/175191784523485184)，[域名 ICP 说明](https://edgeone.ai/zh/document/63620)。

阿里云官方：[ESA 国内加速使用限制](https://help.aliyun.com/zh/edge-security-acceleration/esa/product-overview/limits-on-using-esa)。

腾讯云 COS 官方：[2024 年后新存储桶不能用默认静态网站域名当正常网页发布入口](https://cloud.tencent.cn/document/product/436/32670)。

## 部署步骤（网站运营者仅需操作一次）

1. 拿到具备权限的国内可访问的 HTTPS 静态站点；确认域名和备案/服务商要求符合规定。
2. 下载上面的 ZIP，**解压**，把 ZIP 里的内容上传到站点根目录，保持 `index.html` 在首页位置；不可只上传 ZIP 文件。
3. 检查 MIME：`text/html`、`application/javascript`、`text/css`、`image/png` 和 `application/manifest+json`。
4. 中国普通网络真机访问 → 等待 Service Worker 完成缓存 → 关闭浏览器/主屏幕 App → 飞行模式 → 重启 → 上传相片 → 选择已打包街道范围 → 生成 → 保存。
5. 在安卓微信中 **真实相册保存** 和 iPhone 微信原来已经正常的分享/保存路径分别验收，不把桌面手机模拟验收当真机成功。

## 离线地图边界

地区名称/行政区边界库是全国范围；细街道离线包当前仅预装少量小范围地区（海南陵水、上海黄浦、西安雁塔附近），不能宣传全国细街网离线。没有包的地方按现有逻辑回退真实行政边界。

## 单独需要用户确认的信息

*是否已有一个可由本人合法发布内容的、已备案且中国普通网络可访问的 HTTPS 域名/网站？*

如有，只需一次授权接入和上传；**家人的日常制图不需要再次配置网络**。如没有，不能凭空替用户创建已备案网站，需选择正式域名备案或微信小程序的接入路线。