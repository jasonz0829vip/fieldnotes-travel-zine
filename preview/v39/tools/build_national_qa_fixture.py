#!/usr/bin/env python3
"""Temporary real Hangzhou Z14 PMTiles fixture for CI (never committed or redistributed).
Uses only 9 OpenFreeMap tiles (~city-centre footprint), two workers and <=12MB.
No user photos or personal GPS. Runs only in ephemeral GitHub Actions.
"""
import concurrent.futures
import gzip
import json
import os
from pathlib import Path
import time
from urllib.request import Request, urlopen
import math

from pmtiles.tile import zxy_to_tileid, Compression, TileType
from pmtiles.writer import write

root=Path(__file__).resolve().parent.parent
out=root/"tools"/".national-qa"
out.mkdir(parents=True,exist_ok=True)
longitude,latitude=120.154,30.287   # Public administration geometry centre: Hangzhou 330100.
z=14
scale=2**z
cx=math.floor((longitude+180)/360*scale)
p=math.radians(latitude)
cy=math.floor((1-math.asinh(math.tan(p))/math.pi)/2*scale)
tile_coords=[(z,cx+dx,cy+dy) for dy in (-1,0,1) for dx in (-1,0,1)]
total=0
def get_tile(tile):
    z,x,y=tile
    url=f"https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf"
    headers={"User-Agent":"FIELDNOTES-PMTiles-National-CI-"+os.environ.get("GITHUB_RUN_ID","dev")+"/1.0"}
    last=None
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers=headers),timeout=22) as response:
                data=response.read(2000001)
            if not 100<=len(data)<=2000000:
                raise ValueError("Unexpected PBF length "+str(len(data)))
            return tile,data
        except Exception as exc:
            last=exc
            time.sleep((attempt+1)*1.5)
    raise RuntimeError(f"map tile {tile} unavailable: {last}")
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    tiles=list(pool.map(get_tile,tile_coords))
total=sum(len(raw) for _,raw in tiles)
if total>12*1024*1024:raise RuntimeError("CI fixture exceeds 12 MB quota")
target=out/"hangzhou-z14-test.pmtiles"
metadata={
    "name":"FIELDNOTES temporary Hangzhou centre nine tiles (real OSM, ephemeral QA)",
    "format":"pbf","minzoom":"14","maxzoom":"14",
    "bounds":"120.0,30.15,120.33,30.42",
    "center":f"{longitude},{latitude},14",
    "attribution":"© OpenStreetMap contributors / OpenMapTiles"
}
header={"tile_type":TileType.MVT,"tile_compression":Compression.GZIP,
        "min_lon_e7":1200000000,"max_lon_e7":1203300000,
        "min_lat_e7":301500000,"max_lat_e7":304200000,
        "center_lon_e7":round(longitude*1e7),
        "center_lat_e7":round(latitude*1e7),"center_zoom":14}
with write(str(target)) as w:
    for (z,x,y),raw in sorted(tiles,key=lambda item:zxy_to_tileid(*item[0])):
        w.write_tile(zxy_to_tileid(z,x,y),gzip.compress(raw,mtime=0))
    w.finalize(header,metadata)
record={"region":"杭州市行政中心附近（测试）","z":z,"center":[longitude,latitude],
 "tile_count":len(tiles),"pbf_download_bytes":total,"archive_bytes":target.stat().st_size,
 "licensing":"CI-only; no PBF/PMTiles artifacts publicly redistributed"}
print("FIELDNOTES_NATIONAL_REAL_FIXTURE",json.dumps(record,ensure_ascii=False))
