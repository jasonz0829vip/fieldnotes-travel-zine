#!/usr/bin/env node
'use strict';
// Node-only verification, same for QLS and RTX3070. No browser or cloud required.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=m=>{console.error('FAIL',m);process.exit(1)};
const ctx={window:{}};
vm.runInNewContext(read('offline-tiles-v38.js'),ctx,{timeout:15000});
const p=ctx.window.FIELDNOTES_OFFLINE_TILES;
if(!p)fail('No bundled map pack');
if(p.regionCount!==3||p.tileCount!==27)fail('Unexpected count');
const keys=Object.keys(p.tiles);
if(keys.length!==p.tileCount)fail('Missing tile bytes');
let total=0;
for(const [k,b]of Object.entries(p.tiles)){
 if(!/^\d+\/\d+\/\d+$/.test(k))fail('Invalid tile key '+k);
 const bytes=Buffer.from(b,'base64');
 if(bytes.length<90||bytes.length>1500000)fail('Invalid PBF tile '+k);
 total+=bytes.length;
}
if(total!==p.byteCount)fail('Wrong tile byte count');
for(const r of p.regions){
 if(r.tileKeys.length!==9||r.tileKeys.some(k=>!p.tiles[k]))fail('Incomplete region pack '+r.region);
}
const sw=read('sw.js'),html=read('index.html'),compiled=read('v38-map-core.js');
const m=sw.match(/const CACHE='([^']+)'/),i=html.match(/const V33_CACHE_KEY='([^']+)'/);
if(!m||!i||m[1]!==i[1])fail('Service worker and UI cache version mismatch');
for(const resource of ['offline-tiles-v38.js','v38-map-core.js','v37-editorial.js'])
 if(!html.includes('src="./'+resource+'"')||!sw.includes("'./"+resource+"'"))fail('Missing resource '+resource);
if(!compiled.includes('FIELDNOTES_OFFLINE_TILES'))fail('Compiled map renderer is not offline-first');
if(!html.includes('FIELDNOTES'))fail('Invalid HTML');
const hash=crypto.createHash('sha256').update(read('offline-tiles-v38.js')).digest('hex');
const info={result:'PASS',regions:p.regions.map(r=>r.region),tiles:keys.length,bytes:total,
 sha256:hash,swCache:m[1],node:process.version};
console.log(JSON.stringify(info));
