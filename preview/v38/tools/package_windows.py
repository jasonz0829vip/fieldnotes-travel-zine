#!/usr/bin/env python3
"""Create the same self-contained Windows offline ZIP on QLS or RTX3070.
No dependencies, no user photos, no GPU and no account credentials.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json

root=Path(__file__).resolve().parent.parent
files=("index.html","v36.css","v36-app.js","v37-editorial.js","v38-map-core.js",
       "offline-tiles-v38.js","android-save-v36.js","wechat-android-save-v36.js",
       "manifest.webmanifest","sw.js","THIRD_PARTY_LICENSES.txt","OFFLINE_README.txt")
folders=("data","icons")
output=root/"downloads"/"FIELDNOTES_V3.8_Windows_Offline.zip"
output.parent.mkdir(parents=True,exist_ok=True)
sources=[root/name for name in files]
for folder in folders:
    sources.extend(p for p in (root/folder).rglob("*") if p.is_file())
for file in sources:
    if not file.exists():
        raise FileNotFoundError(file)
with ZipFile(output,"w",ZIP_DEFLATED,compresslevel=9) as archive:
    for file in sorted(sources,key=lambda p:p.as_posix()):
        archive.write(file,file.relative_to(root).as_posix())
with ZipFile(output) as archive:
    damaged=archive.testzip()
    if damaged:
        raise ValueError("Invalid member: "+damaged)
    entries=archive.namelist()
    assert "index.html" in entries and "offline-tiles-v38.js" in entries
    assert not any(name.startswith("tools/") for name in entries)
sha=hashlib.sha256(output.read_bytes()).hexdigest()
print(json.dumps({"result":"PASS","path":str(output),"zipBytes":output.stat().st_size,
                  "entries":len(entries),"sha256":sha},ensure_ascii=False))
