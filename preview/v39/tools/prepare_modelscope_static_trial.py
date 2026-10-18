#!/usr/bin/env python3
"""Prepare a no-domain ModelScope Static Studio trial with an embedded, zero-photo hosting probe.
Does not create a ModelScope account, deploy, or contain API tokens.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json, re

root=Path(__file__).resolve().parent.parent
source=root/"downloads"/"FIELDNOTES_V3.9_Managed_Maps_Static_Deploy.zip"
assert source.exists(), "Run build_domestic_static.py first"
probe=root/"tools"/"hosting-probe.html"
assert probe.exists()
destination=root/"downloads"/"FIELDNOTES_V39_MODELSCOPE_STATIC_TRIAL.zip"

# Deterministic 128 KiB identity bytes, generated during CI and never committed as a binary blob.
challenge=bytearray()
for n in range(131072//32):
    challenge.extend(hashlib.sha256(("FIELDNOTES-MODELSCOPE-RANGE-v1-"+str(n)).encode()).digest())
assert len(challenge)==131072

readme="""FIELDNOTES · ModelScope Static trial / 2026-10-18

NO DOMAIN NEEDED FOR THE TRIAL:
1. Create a PRIVATE Studio on the Mainland ModelScope site (https://modelscope.cn/studios/create).
2. Choose SDK type Static, with built files (no Node/Python server or GPU).
3. Upload the *contents* of this ZIP to the Studio repository root so index.html sits at root.
4. Launch the Studio and use its actual direct app URL, rather than guessing an ms.show host.
5. On the PHONE using mobile data and no proxy, go to <actual-app-URL>/probe/ and tap Start.
6. Confirm real HTTP 206 Range, service worker, cache, and loading. Copy diagnostic JSON only if desired.
7. Test Safari iPhone and Chrome Android independently. WeChat embedded browser/gallery save needs separate testing.

IMPORTANT:
- This build does NOT enable nationwide map data: national-map-source.js is intentionally enabled:false.
- No personal photos, remote user data or secrets are included.
- Do not rely on a third-party Studio for long-term data archive until its file-size, CORS, Range, uptime and licensing terms are verified.
- Never add access keys into front-end JavaScript or a public Git repo.
- This is a test bundle, not an assertion of China production availability.

Uses upstream ModelScope official ms-studio-deploy Skill:
https://github.com/modelscope/modelscope-skills/blob/main/skills/ms-studio-deploy/SKILL.md
"""

with ZipFile(source) as upstream, ZipFile(destination,"w",ZIP_DEFLATED,compresslevel=9) as out:
    files=set(upstream.namelist())
    for p in sorted(files):
        if p.startswith("tools/") or p.startswith("/") or ".." in Path(p).parts:
            raise AssertionError("Unsafe app artifact path: "+p)
        out.writestr(p,upstream.read(p))
    out.writestr("probe/index.html",probe.read_bytes())
    out.writestr("probe/range-proof.bin",challenge,compress_type=ZIP_STORED)
    out.writestr("MODELSCOPE_DEPLOY_README.txt",readme.encode())
    info={"version":"fieldnotes-ms-static-probe-v1",
          "probe_bytes":len(challenge),
          "probe_sha256":hashlib.sha256(challenge).hexdigest(),
          "source_sha256":hashlib.sha256(source.read_bytes()).hexdigest(),
          "app_files":len(files),"map_provider_enabled":False}
    out.writestr("MODELSCOPE_PROBE_MANIFEST.json",json.dumps(info,indent=2).encode())

with ZipFile(destination) as z:
    assert z.testzip() is None
    names=set(z.namelist())
    assert {"index.html","sw.js","national-map-provider.js","national-map-source.js",
            "vendor/pmtiles.js","licenses/pmtiles.BSD3.txt",
            "probe/index.html","probe/range-proof.bin"}<=names
    assert "enabled:false" in z.read("national-map-source.js").decode()
    assert len(z.read("probe/range-proof.bin"))==131072
    assert all(not n.startswith("tools/") for n in names)
    print(json.dumps({"result":"PASS","bundle":str(destination),
      "bytes":destination.stat().st_size,"files":len(names),
      "manifest":info},ensure_ascii=False))
