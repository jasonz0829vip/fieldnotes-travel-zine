#!/usr/bin/env node
'use strict';
/* FIELDNOTES V3.8 deterministic offline map pack builder.
   Same Node.js script works on QLS and RTX3070; no GPU, Git or global tools required.
   The output is data only: a JS resource containing OpenStreetMap vector tiles.
   Official OpenFreeMap offline download limit: 3,000 tiles or 50 MB,
   at most four parallel connections; here concurrency is capped at three.
*/
const fs=require('fs'),path=require('path'),vm=require('vm'),os=require('os'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const input=JSON.parse(fs.readFileSync(path.join(__dirname,'region-manifest.json'),'utf8'));
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'data','china-index-v36.js'),'utf8'),context);
vm.runInNewContext(fs.readFileSync(path.join(root,'data','china-county-v36.js'),'utf8'),context);
const geo=context.window.FN_CHINA.geometry,counties=context.window.FN_CHINA_COUNTIES;
const selected=new Map(),coverage=[];
function pos(lon,lat,z){const n=2**z,r=Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/180;return {x:Math.floor((lon+180)/360*n),y:Math.floor((1-Math.asinh(Math.tan(r))/Math.PI)/2*n),z};}
for(const c of input.packs){
 const item=geo[c.code]||counties[c.code];if(!item)throw Error('Missing mapped location '+c.code);
 const lon=item[0]/1000,lat=item[1]/1000;const tile=pos(lon,lat,c.zoom);
 const arr=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const key=tile.z+'/'+(tile.x+dx)+'/'+(tile.y+dy);selected.set(key,'https://tiles.openfreemap.org/planet/latest/'+key+'.pbf');arr.push(key);
 }
 coverage.push({...c,center:[lon,lat],tileKeys:arr});
}
if(selected.size>3000)throw Error('Exceeds OpenFreeMap offline tile allowance');
const result={},errors=[],arr=Array.from(selected.entries());let index=0,downloaded=0;
const headers={'User-Agent':'FIELDNOTES-V38-OfflinePack-'+os.hostname().replace(/[^a-zA-Z0-9-]/g,'')+'/1.0'};
async function download(key,url){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const res=await fetch(url,{headers,signal:AbortSignal.timeout(14000)});
   if(!res.ok)throw Error('HTTP '+res.status);
   const buf=Buffer.from(await res.arrayBuffer());
   if(buf.length<90||buf.length>1500000)throw Error('Unexpected tile size '+buf.length);
   downloaded+=buf.length;
   if(downloaded>50*1024*1024)throw Error('Exceeded 50 MB offline download limit');
   result[key]=buf.toString('base64');return;
  }catch(e){if(attempt===2){errors.push({key,error:String(e)});return}
   await new Promise(r=>setTimeout(r,800*(attempt+1)));
  }
 }
}
async function worker(){
 while(index<arr.length){
  const i=index++;const [key,url]=arr[i];
  await download(key,url);
 }
}
(async()=>{
 await Promise.all(Array.from({length:Math.min(3,arr.length)},()=>worker()));
 if(errors.length){console.error('DOWNLOAD_FAILURES',JSON.stringify(errors));process.exitCode=1;return;}
 const keys=Object.keys(result).sort();
 const normalized=Object.fromEntries(keys.map(k=>[k,result[k]]));
 const payload={version:'v38-map-pack-1',source:'OpenFreeMap/OpenMapTiles/OpenStreetMap',
  attribution:'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
  regionCount:coverage.length,tileCount:keys.length,byteCount:downloaded,regions:coverage,tiles:normalized};
 const data='/* FIELDNOTES V3.8 - true OSM streets bundled for known areas, not user photos. */\nwindow.FIELDNOTES_OFFLINE_TILES='+JSON.stringify(payload)+';\n';
 fs.writeFileSync(path.join(root,'offline-tiles-v38.js'),data,'utf8');
 const hash=crypto.createHash('sha256').update(data).digest('hex');
 const audit={...payload,tiles:undefined,builtAt:new Date().toISOString(),sha256:hash,filesize:Buffer.byteLength(data),dateSource:'2026-10 OpenFreeMap planet latest'};
 fs.writeFileSync(path.join(root,'tools','offline-pack-audit.json'),JSON.stringify(audit,null,2),'utf8');
 console.log(JSON.stringify({status:'OK',regions:coverage.map(x=>({code:x.code,region:x.region,center:x.center,zoom:x.zoom})),tileCount:keys.length,downloadedBytes:downloaded,outputBytes:Buffer.byteLength(data),sha256:hash}));
})();
