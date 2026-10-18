#!/usr/bin/env node
/* FIELDNOTES map-first read-only research: compare existing Z13 packs vs legal-size Z14 local-area tiles.
 * No personal photographs, uploaded GPS tracks, or output map tiles.
 * Respect OpenFreeMap quick-start rules: <=3000 tiles or 50MB per download, max 4 parallel, unique user-agent.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {VectorTile}=require('@mapbox/vector-tile');
const Pbf=require('pbf');
const root=path.resolve(__dirname,'..'),resultFile=path.join(__dirname,'map-z14-audit-results.json');
const CATALOG=[
 {code:'469028',region:'海南陵水中心',center:[110.037,18.505]},
 {code:'310101',region:'上海黄浦中心',center:[121.49,31.223]},
 {code:'610113',region:'西安雁塔中心',center:[108.927,34.213]}
];
const MAX_TILES=27,MAX_BYTES=50*1024*1024,MAX_PER_TILE=1.5*1024*1024,MAX_CONCURRENT=3;
const sourceURL='https://tiles.openfreemap.org/planet/latest/';
const userAgent='FIELDNOTES-Z14-MapDetailAudit-GitHub-'+String(process.env.GITHUB_RUN_ID||'local').replace(/[^0-9]/g,'')+'/1.0';
function tile(lon,lat,z){const n=2**z,a=Math.min(85.0511,Math.max(-85.0511,lat))*Math.PI/180;
 return {z,x:Math.floor((lon+180)/360*n),y:Math.floor((1-Math.asinh(Math.tan(a))/Math.PI)/2*n)};}
function tiles(center,z){const c=tile(center[0],center[1],z),out=[];
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)out.push(z+'/'+(c.x+dx)+'/'+(c.y+dy));
 return out;
}
function measure(buf,at){
 const t=new VectorTile(new Pbf(buf)),stats={bytes:buf.byteLength,byLayer:{}};
 for(const layer of ['transportation','water','waterway','building']){
  const src=t.layers[layer];
  if(!src){stats.byLayer[layer]={features:0,rings:0};continue;}
  let rings=0,geometryCommands=0;
  if(layer==='building'&&src.length<=10000){
   for(let i=0;i<src.length;i++){
    // Polygon rings include holes; count is not synonymous with number of buildings.
    const geometry=src.feature(i).loadGeometry();
    rings+=geometry.length;
    for(const x of geometry)geometryCommands+=x.length;
   }
  }
  stats.byLayer[layer]={features:src.length,rings,vertices:geometryCommands};
 }
 stats.tile=at;return stats;
}
function summary(items,region,zoom){
 const t={zoom,region,tiles:items.length,
  bytes:items.reduce((a,x)=>a+x.bytes,0),
  areaKm2:9*Math.pow((40075016.686*Math.cos(region.center[1]*Math.PI/180))/2**zoom/1000,2),
  layers:{}};
 for(const layer of ['transportation','water','waterway','building']){
  const features=items.reduce((a,x)=>a+x.byLayer[layer].features,0);
  const rings=items.reduce((a,x)=>a+x.byLayer[layer].rings,0);
  const vertices=items.reduce((a,x)=>a+x.byLayer[layer].vertices,0);
  t.layers[layer]={features,rings,vertices,featureDensityPerKm2:+(features/t.areaKm2).toFixed(2),
   ringDensityPerKm2:+(rings/t.areaKm2).toFixed(2)};
 }
 t.areaKm2=+t.areaKm2.toFixed(2);return t;
}
(async()=>{
 const local={};
 for(const region of CATALOG){
  const file=path.join(root,'packs',region.code+'.js'),ctx={window:{FIELDNOTES_REGISTER_REGION_PACK(pack){this.pack=pack;}}};
  // Use a detached VM for the existing trusted local pack, never connect to a server.
  vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);
  const pack=ctx.window.pack;if(!pack||pack.tileKeys.length!==9)throw Error('Malformed bundled pack '+region.code);
  local[region.code]=summary(pack.tileKeys.map(key=>measure(Buffer.from(pack.tiles[key],'base64'),key)),region,13);
 }
 const requests=CATALOG.flatMap(region=>tiles(region.center,14).map(key=>({region,key})));
 if(requests.length>MAX_TILES||MAX_CONCURRENT>4)throw Error('Request outside OpenFreeMap limits');
 let cursor=0,total=0;const answers={};const problems=[];
 async function worker(){
  while(cursor<requests.length){
   const item=requests[cursor++];
   try{
    const response=await fetch(sourceURL+item.key+'.pbf',{
      headers:{'User-Agent':userAgent},
      signal:AbortSignal.timeout(22000)
    });
    if(!response.ok)throw Error('HTTP '+response.status);
    const b=Buffer.from(await response.arrayBuffer());
    if(b.length<50||b.length>MAX_PER_TILE)throw Error('Unusual PBF size '+b.length);
    total+=b.length;if(total>MAX_BYTES)throw Error('Exceeds official 50MB/download limit');
    (answers[item.region.code]||=[]).push(measure(b,item.key));
    await new Promise(resolve=>setTimeout(resolve,125));
   }catch(e){problems.push({tile:item.key,reason:String(e)});}
  }
 }
 await Promise.all(Array.from({length:MAX_CONCURRENT},()=>worker()));
 const result={date:new Date().toISOString(),mode:'research-only/no-photos/no-tile-redistribution',
   origin:'OpenFreeMap OpenMapTiles',requestedTiles:requests.length,receivedTiles:requests.length-problems.length,
   downloadedBytes:total,limits:{tiles:MAX_TILES,bytes:MAX_BYTES,concurrency:MAX_CONCURRENT},
   byRegion:CATALOG.map(region=>{
    const a=local[region.code],z14=(answers[region.code]||[]).length===9?
      summary(answers[region.code],region,14):null;
    return {region:region.region,code:region.code,z13:a,z14};
   }),errors:problems};
 fs.writeFileSync(resultFile,JSON.stringify(result,null,2));
 for(const entry of result.byRegion){
  const a=entry.z13,b=entry.z14;
  console.log('MAP_Z14_RESEARCH',entry.region,JSON.stringify({
    z13KB:Math.round(a.bytes/1024),z14KB:b?Math.round(b.bytes/1024):null,
    z13Rings:a.layers.building.rings,z14Rings:b?.layers.building.rings,
    z13RingsKm2:a.layers.building.ringDensityPerKm2,
    z14RingsKm2:b?.layers.building.ringDensityPerKm2,
    z14Roads:b?.layers.transportation.features}));
 }
 console.log('MAP_Z14_REQUESTS',JSON.stringify({requests:requests.length,received:result.receivedTiles,
  bytes:total,errors:problems.length}));
 if(problems.length){console.warn('Z14 audit incomplete',JSON.stringify(problems));process.exitCode=2;return;}
 if(result.byRegion.some(x=>!x.z14?.layers?.building?.rings)){
  console.warn('Z14 building data missing, inspect before investing in download UI');process.exitCode=3;return;
 }
 console.log('PASS Z14 research: within provider limits; geometry compared, no private data and no tile payload archived');
})().catch(e=>{console.error(e);process.exitCode=1;});
