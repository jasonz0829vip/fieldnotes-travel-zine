#!/usr/bin/env node
/* Rebuild region-specific JavaScript from the already-published V3.8 offline tiles.
   No network requests; identical inputs produce identical outputs on QLS and RTX3070. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'offline-tiles-v38.js'), 'utf8');
const marker = 'window.FIELDNOTES_OFFLINE_TILES=';
const start = source.indexOf(marker);
if (start < 0) throw Error('Legacy V3.8 tile object not found');
const suffix = source.slice(start + marker.length).trim().replace(/;\s*$/, '');
const atlas = JSON.parse(suffix);
if (atlas.version !== 'v38-map-pack-1' || atlas.regions.length !== 3 || Object.keys(atlas.tiles).length !== 27)
  throw Error('Unexpected source atlas; inspect before repacking');
const outDir = path.join(root, 'packs');
fs.mkdirSync(outDir, {recursive:true});
for (const region of atlas.regions) {
  if (region.tileKeys.length !== 9 || !region.tileKeys.every(key => typeof atlas.tiles[key] === 'string'))
    throw Error('Missing or unexpected tile data in ' + region.code);
  const pack = {
    version:atlas.version, code:region.code, key:region.key, region:region.region,
    zoom:region.zoom, center:region.center, source:atlas.source, attribution:atlas.attribution,
    tileKeys:region.tileKeys,
    tiles:Object.fromEntries(region.tileKeys.map(key => [key, atlas.tiles[key]]))
  };
  const output = '/* FIELDNOTES V3.8 P1, ' + region.region + ': independently removable offline street pack.\n' +
    '   OpenStreetMap contributors (ODbL), OpenFreeMap / OpenMapTiles attribution preserved. */\n' +
    'window.FIELDNOTES_REGISTER_REGION_PACK(' + JSON.stringify(pack) + ');\n';
  fs.writeFileSync(path.join(outDir, region.code + '.js'), output);
  console.log(region.code, region.region, region.tileKeys.length, Buffer.byteLength(output));
}