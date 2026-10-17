#!/usr/bin/env python3
"""Portable fieldnotes static website deploy bundle; identical on QLS and RTX3070."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re, hashlib, json

root=Path(__file__).resolve().parent.parent
files=["index.html","manifest.webmanifest","sw.js","v36-app.js","v36.css","v37-editorial.js",
"v38-map-core.js","p1-art-direction.js","p1-ux.js","offline-tiles-v38.js",
"android-save-v36.js","wechat-android-save-v36.js","THIRD_PARTY_LICENSES.txt",
"OFFLINE_README.txt","P1_DESIGN_NOTES.txt"]
paths=[root/f for f in files]
for dirname in ("data","icons","licenses"):
    paths += [p for p in (root/dirname).rglob("*") if p.is_file()]
for p in paths:
    if not p.is_file(): raise FileNotFoundError(str(p))
html=(root/"index.html").read_text(encoding="utf8")
for s in re.findall(r'<(?:script|link)[^>]+(?:src|href)=["\']\./([^"\']+)',html):
    if not (root/s.split("?")[0]).is_file(): raise ValueError("Missing static asset "+s)
sw=(root/"sw.js").read_text(encoding="utf8")
assert "offline-tiles-v38.js" in sw and "self.addEventListener('install'" in sw
assert "FIELDNOTES_OFFLINE_TILES" in (root/"offline-tiles-v38.js").read_text(encoding="utf8")

instructions="""FIELDNOTES V3.8-P1 - 国内静态网站上传包

请将此 ZIP 解压，将解压后的所有文件和文件夹放在你拥有权限的 HTTPS 静态站点根目录（index.html 在根目录）。
这是单纯的静态网站，不需要 QLS/3070 做远程服务器，也不需要 ChatGPT、代理或国外 API 运行时请求。

要求：
* 网站必须 HTTPS 才能安装 PWA；确认 HTML/JS/CSS/PNG/.webmanifest MIME 类型正确。
* 完整保留 data/、icons/、licenses/ 文件夹，不能只上传 index.html。
* 已预装陵水、上海黄浦、西安雁塔部分中心街道包；其余地区离线时使用真实行政轮廓，并非全国街道离线覆盖。
* 国内网站需要符合托管商的实名、域名、ICP备案等要求；此包本身不替代备案，也未通过中国普通网络真机首装验收。
* 安卓微信最终保存到相册尚需真机核验，苹果现有流程不变。
* 首次打开需联网；等待离线资源缓存完成，随后断网重启验收。
* 照片运算在用户手机本地，不把私人照片上传到服务器。

验收：国内无代理打开 → 等待缓存 → 退出开启飞行模式 → 重新打开 → 选照片/预装地区 → 出图 → 相册保存。
"""
target=root/"downloads"/"FIELDNOTES_V3.8_P1_Domestic_Static_Deploy.zip"
target.parent.mkdir(parents=True,exist_ok=True)
manifest={"product":"FIELDNOTES V3.8 P1","type":"relocatable-static-root",
          "files":{p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
with ZipFile(target,"w",ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(paths):z.write(p,p.relative_to(root).as_posix())
    z.writestr("DEPLOY_CN_README.txt",instructions)
    z.writestr("DEPLOY_MANIFEST.json",json.dumps(manifest,ensure_ascii=False,indent=2))
with ZipFile(target) as z:
    assert z.testzip() is None
    names=z.namelist()
    assert "index.html" in names and "data/china-index-v36.js" in names
    assert not any(x.startswith("tools/") for x in names)
print(json.dumps({"result":"PASS","path":str(target),"bytes":target.stat().st_size,
                  "files":len(names),"sha256":hashlib.sha256(target.read_bytes()).hexdigest()},ensure_ascii=False))
