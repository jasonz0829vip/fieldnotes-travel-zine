/* FIELDNOTES · National on-demand OSM vector tiles via standard PMTiles v3.
 * Powered by upstream Protomaps PMTiles (BSD-3), existing Mapbox Vector Tile/PBF
 * and the existing FIELDNOTES canvas renderer.
 * Disabled until a legally hosted China-reachable HTTPS range endpoint is configured.
 * Only a deliberate "Download" action fetches precise location-related map tiles.
 * No image content, original GPS EXIF, or geocoder text is transmitted.
 */
(() => {
 'use strict';
 const ROOT=new URL('./',document.currentScript?.src||location.href);
 const PREFIX='fn39-national-v1-';
 const Z=14, MAX_BYTES=12*1024*1024, MAX_TILE=2*1024*1024, MAX_REGIONS=12;
 const config=window.FIELDNOTES_NATIONAL_SOURCE||{};
 const validId=/^[a-zA-Z0-9_-]{1,32}$/;
 const sourceId=validId.test(String(config.version||''))?config.version:'not-configured';
 const configured=Boolean(config.enabled&&config.kind==='pmtiles'&&validId.test(String(config.version||'')) &&
   /^https:\/\//.test(config.url||'') && !/[@#]/.test(config.url||'') &&
   typeof window.pmtiles?.PMTiles==='function');
 const supported=typeof caches!=='undefined'&&location.protocol!=='file:';
 const regions=new Map(),tileOwners=new Map();
 let source=null,header=null;
 const cName=(z,x,y)=>PREFIX+sourceId+'-z'+z+'-x'+x+'-y'+y;
 const kTile=(z,x,y)=>z+'/'+x+'/'+y;
 const tileURL=(z,x,y)=>new URL('__national_cache__/'+kTile(z,x,y)+'.pbf',ROOT).href;
 const metaURL=new URL('__national_cache__/manifest.json',ROOT).href;
 const xy=(lon,lat,z=Z)=>{
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>85.05112878||
     Math.abs(lon)>180) return null;
  const n=2**z,p=lat*Math.PI/180;
  return {z,x:Math.min(n-1,Math.max(0,Math.floor((lon+180)/360*n))),
   y:Math.min(n-1,Math.max(0,Math.floor((1-Math.asinh(Math.tan(p))/Math.PI)/2*n)))};
 };
 const neighbors=center=>{
  const a=[];const max=2**center.z;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const x=center.x+dx,y=center.y+dy;
   if(x>=0&&x<max&&y>=0&&y<max)a.push({z:center.z,x,y,key:kTile(center.z,x,y)});
  }
  return a;
 };
 const cacheKey=tile=>tile.key||kTile(tile.z,tile.x,tile.y);
 function indexRegion(record){
  if(!record||record.version!==sourceId||record.zoom!==Z||
     !Array.isArray(record.tiles)||record.tiles.length>9||record.tiles.length<1||
     !Number.isFinite(record.bytes)||record.bytes<0)return;
  regions.set(record.id,record);
  for(const t of record.tiles){
   const key=cacheKey(t);if(!tileOwners.has(key))tileOwners.set(key,new Set());
   tileOwners.get(key).add(record.id);
  }
 }
 function forgetRegion(id){
  const r=regions.get(id);if(!r)return;
  for(const tile of r.tiles){
   const owners=tileOwners.get(cacheKey(tile));owners?.delete(id);
   if(owners?.size===0)tileOwners.delete(cacheKey(tile));
  }
  regions.delete(id);
 }
 const ready=(async()=>{
  if(!supported)return;
  const names=(await caches.keys()).filter(x=>x.startsWith(PREFIX+sourceId+'-'));
  for(const id of names){
   try{
    const r=await (await caches.open(id)).match(metaURL);
    if(!r)continue;
    const record=await r.json();
    if(record.id===id)indexRegion(record);
   }catch(e){console.warn('Unusable offline national map metadata',id,e);}
  }
 })().catch(e=>console.warn('National offline map index unavailable',e));
 function matched(lon,lat){
  const tile=xy(Number(lon),Number(lat));if(!tile)return null;
  const id=cName(tile.z,tile.x,tile.y);
  const record=regions.get(id);
  return {tile,id,record,keys:neighbors(tile).map(t=>t.key)};
 }
 function installedStatus(lon,lat){
  const m=matched(lon,lat);if(!m)return null;
  if(m.record)return {status:m.record.tiles.length===9?'installed':'partial',
   bytes:m.record.bytes,tiles:m.record.tiles.length,tile:m.tile,id:m.id,zoom:Z};
  // A neighboring package may contain some tiles, but never claim full coverage.
  const count=m.keys.filter(k=>tileOwners.has(k)).length;
  return count?{status:'partial',tiles:count,tile:m.tile,id:m.id,zoom:Z}:null;
 }
 function announce(detail){
  window.FIELDNOTES_V37_DEBUG?.invalidate?.();
  window.dispatchEvent?.(new CustomEvent('fieldnotes:maps-changed',{detail}));
 }
 async function openSource(){
  if(!configured)throw Error('全国地图 HTTPS 数据源尚未配置，仍可使用基础轮廓');
  if(!navigator.onLine)throw Error('手机当前离线，不能下载新地图');
  if(!source)source=new window.pmtiles.PMTiles(config.url);
  if(!header)header=await source.getHeader();
  if(header.tileType!==1||header.maxZoom<Z||header.minZoom>Z)
   throw Error('该数据源不是可用的 Z14 矢量地图，不能下载');
  return {source,header};
 }
 async function availability(lon,lat){
  await ready;const m=matched(lon,lat);
  if(!m)return {status:'none',reason:'coordinates'};
  const installed=installedStatus(lon,lat);
  if(installed?.status==='installed')return installed;
  if(!configured||!supported||!navigator.onLine)
   return installed||{status:'none',reason:'not-configured-or-offline'};
  try{
   const {header}=await openSource();
   if(Number(lon)<header.minLon||Number(lon)>header.maxLon||
      Number(lat)<header.minLat||Number(lat)>header.maxLat)
    return installed||{status:'none',reason:'outside-archive'};
  }catch(e){return installed||{status:'none',reason:'source-unreachable',message:String(e?.message||e)};}
  return {status:'downloadable',id:m.id,tile:m.tile,zoom:Z,
   partialTiles:installed?.tiles||0,source:'pmtiles',locationPrecision:'tile-center'};
 }
 async function getCachedTile(z,x,y){
  await ready;const owners=tileOwners.get(kTile(z,x,y));if(!owners?.size)return null;
  for(const id of owners){
   const res=await (await caches.open(id)).match(tileURL(z,x,y));
   if(res){const buf=await res.arrayBuffer();return new Uint8Array(buf);}
  }
  return null;
 }
 function bestZoom(lon,lat){
  const m=matched(lon,lat);if(!m)return null;
  // The exact 3x3 requested tile footprint must be available.
  return m.keys.filter(key=>tileOwners.has(key)).length>=5?Z:null;
 }
 async function install(lon,lat,label='本地地图'){
  if(!supported)throw Error('此运行方式不支持手机持久地图缓存');
  await ready;
  const m=matched(lon,lat);if(!m)throw Error('地图坐标不正确');
  if(regions.has(m.id))return installedStatus(lon,lat);
  if(regions.size>=MAX_REGIONS)throw Error('已保存较多地图，请先在设置中清理不再使用的地区');
  const archive=await openSource();
  const requested=neighbors(m.tile);
  const staged=[];let total=0;let cursor=0;
  // No user's original coordinates are saved. Requests fetch only archived z/x/y tiles.
  async function worker(){
   while(cursor<requested.length){
    const t=requested[cursor++];
    const response=await archive.source.getZxy(t.z,t.x,t.y);
    if(!response?.data)continue;
    const bytes=response.data instanceof Uint8Array?response.data:new Uint8Array(response.data);
    if(!bytes.byteLength||bytes.byteLength>MAX_TILE)throw Error('地图瓦片体积异常，已取消下载');
    total+=bytes.byteLength;
    if(total>MAX_BYTES)throw Error('本地区地图超过 12 MB 下载上限，已取消');
    staged.push({tile:t,bytes});
   }
  }
  await Promise.all([worker(),worker(),worker()]);
  if(!staged.length)throw Error('该区域暂时没有实际矢量地图数据');
  const record={id:m.id,zoom:Z,version:sourceId,tiles:staged.map(x=>x.tile),bytes:total,
   installedAt:new Date().toISOString(),label:String(label||'本地地图').slice(0,36),source:'PMTiles © OpenStreetMap contributors'};
  try{
   const cache=await caches.open(m.id);
   for(const item of staged){
    await cache.put(tileURL(item.tile.z,item.tile.x,item.tile.y),
     new Response(item.bytes,{headers:{'Content-Type':'application/vnd.mapbox-vector-tile'}}));
   }
   // Commit manifest last, so interrupted downloads are not considered complete.
   await cache.put(metaURL,new Response(JSON.stringify(record),{headers:{'Content-Type':'application/json'}}));
  }catch(e){await caches.delete(m.id);throw e;}
  indexRegion(record);announce({kind:'national',installed:true,tiles:record.tiles.length});
  return installedStatus(lon,lat);
 }
 async function removeById(id){
  await ready;
  if(!regions.has(id))return false;
  const success=await caches.delete(id);
  forgetRegion(id);announce({kind:'national',installed:false});
  return success;
 }
 async function remove(lon,lat){
  const m=matched(lon,lat);
  return m?removeById(m.id):false;
 }
 async function list(){
  await ready;return [...regions.values()].map(r=>({
   id:r.id,label:r.label||'本地区域',zoom:r.zoom,tiles:r.tiles.length,bytes:r.bytes,installedAt:r.installedAt}));
 }
 async function clearAll(){
  await ready;
  const all=(await caches.keys()).filter(k=>k.startsWith(PREFIX));
  for(const key of all)await caches.delete(key);
  regions.clear();tileOwners.clear();announce({kind:'national',installed:false});
 }
 window.FIELDNOTES_NATIONAL_MAP=Object.freeze({
  configured,supported,ready,availability,installedStatus,bestZoom,
  getCachedTile,install,remove,removeById,list,clearAll,xy,neighbors,
  sourceDescription:configured?'已配置的 PMTiles 静态地图源':'等待可在中国普通网络访问的数据源'
 });
})();
