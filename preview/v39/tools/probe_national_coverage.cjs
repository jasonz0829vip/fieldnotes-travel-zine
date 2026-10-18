#!/usr/bin/env node
/* Bounded, anonymous map-source feasibility research for FIELDNOTES.
 * This is NOT the end-user download backend. Downloads 1 Z14 vector tile near each
 * well-known public landmark/municipal centre. Does not store tile payloads or photos.
 * OpenFreeMap research cap: <= 3000 tiles / 50 MiB, max 4 parallel, unique UA.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const OUT=path.join(__dirname,'national-map-probe-results.json');
const PLACES=[
 {name:'北京',lng:116.3974,lat:39.9087,type:'metropolis'},
 {name:'上海',lng:121.4737,lat:31.2304,type:'metropolis'},
 {name:'广州',lng:113.2644,lat:23.1291,type:'metropolis'},
 {name:'深圳',lng:114.0579,lat:22.5431,type:'metropolis'},
 {name:'杭州',lng:120.1551,lat:30.2741,type:'metropolis'},
 {name:'成都',lng:104.0665,lat:30.5728,type:'metropolis'},
 {name:'西安',lng:108.9398,lat:34.3416,type:'metropolis'},
 {name:'青岛',lng:120.3826,lat:36.0671,type:'coastal'},
 {name:'厦门',lng:118.0894,lat:24.4798,type:'coastal'},
 {name:'三亚',lng:109.5119,lat:18.2528,type:'coastal'},
 {name:'海口',lng:110.1999,lat:20.0442,type:'coastal'},
 {name:'拉萨',lng:91.1322,lat:29.6604,type:'high-altitude'},
 {name:'乌鲁木齐',lng:87.6168,lat:43.8256,type:'inland'},
 {name:'哈尔滨',lng:126.6425,lat:45.7560,type:'northeast'},
 {name:'上海松江',lng:121.2277,lat:31.0322,type:'suburb'},
 {name:'青海高原样点',lng:98.50,lat:36.70,type:'rural'}
];
const LIMIT=16,MAX_BYTES=50*1024*1024,CONCURRENCY=2;
function xyz(lon,lat,z){const n=2**z,u=Math.max(-85,Math.min(85,lat))*Math.PI/180;
 return {z,x:Math.floor((lon+180)/360*n),y:Math.floor((1-Math.asinh(Math.tan(u))/Math.PI)/2*n)};}
(async()=>{
 const [{VectorTile},pbfModule]=await Promise.all([import('@mapbox/vector-tile'),import('pbf')]);
 const Pbf=pbfModule.default||pbfModule.Pbf;
 if(PLACES.length>LIMIT||CONCURRENCY>4)throw Error('Beyond audit cap');
 let ix=0,total=0;
 const results=new Array(PLACES.length),agent='FIELDNOTES-CN-Bounded-MapProbe-'+String(process.env.GITHUB_RUN_ID||'local');
 async function worker(){
  while(ix<PLACES.length){
   const idx=ix++,p=PLACES[idx],t=xyz(p.lng,p.lat,14),k=t.z+'/'+t.x+'/'+t.y;
   const item={name:p.name,type:p.type,z:t.z,tile:k,success:false,
     layers:{transportation:0,water:0,waterway:0,building:0}};
   try{
    const url='https://tiles.openfreemap.org/planet/latest/'+k+'.pbf';
    const response=await fetch(url,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length<50||bytes.length>1500000)throw Error('Unexpected byte length '+bytes.length);
    total+=bytes.length;if(total>MAX_BYTES)throw Error('Safety download limit reached');
    const mvt=new VectorTile(new Pbf(bytes));
    for(const k of Object.keys(item.layers))item.layers[k]=mvt.layers[k]?.length||0;
    item.bytes=bytes.length;item.success=true;
    item.hasRoads=item.layers.transportation>0;item.hasBuildings=item.layers.building>0;
    item.hasWater=item.layers.water+item.layers.waterway>0;
   }catch(e){item.error=String(e).slice(0,160);}
   results[idx]=item;console.log('NATIONAL_PROBE',JSON.stringify(item));
   await new Promise(resolve=>setTimeout(resolve,130));
  }
 }
 await Promise.all(Array.from({length:CONCURRENCY},()=>worker()));
 const ok=results.filter(x=>x.success),geom=ok.filter(x=>x.hasRoads||x.hasBuildings||x.hasWater);
 const result={generatedAt:new Date().toISOString(),researchOnly:true,
  endUserNationalAvailabilityVerified:false,chinaNoVPNReachabilityVerified:false,
  provider:'OpenFreeMap/OpenMapTiles/OSM, CI benchmark only (not final CDN)',
  requested:results.length,reachable:ok.length,withSomeGeometry:geom.length,bytes:total,
  records:results};
 fs.writeFileSync(OUT,JSON.stringify(result,null,2));
 console.log('NATIONAL_PROBE_SUMMARY',JSON.stringify({requested:results.length,reachable:ok.length,withSomeGeometry:geom.length,downloadedBytes:total}));
 if(ok.length<12)throw Error('National provider technical probe incomplete; investigate failures');
 if(geom.length<10)throw Error('Not enough locations with real geographic detail; do not promise full coverage');
 console.log('PASS: multi-region technical data availability probed without storing downloaded map tiles');
})().catch(e=>{console.error(e);process.exitCode=1;});
