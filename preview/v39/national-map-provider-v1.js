/* FIELDNOTES National Map Source v1 (P0 isolated pilot).
 * Data access: local Cache Storage + a vetted, explicitly configured PMTiles archive.
 * No end-user API to the OpenFreeMap public server. No photo/EXIF upload.
 * Absent a verified legal mainland-reachable archive, the national offer stays disabled.
 */
(() => {
 'use strict';
 const ROOT=new URL('./',document.currentScript?.src||location.href);
 const CACHE='fn39-national-tiles-v1', INDEX='data/national-map-index-v1.json';
 const available=location.protocol!=='file:'&&typeof caches!=='undefined';
 const memory=new Map(),bundles=new Map();
 let catalog=[],cachePromise=null,readerModule=null;
 const idRx=/^[a-z0-9][a-z0-9-]{1,40}$/;
 const tileRx=/^(1[0-4]|[5-9])\/\d+\/\d+$/;
 const keyUrl=key=>new URL('__fn_national_tiles__/'+key+'.pbf',ROOT).href;
 const metaUrl=id=>new URL('__fn_national_manifests__/'+encodeURIComponent(id)+'.json',ROOT).href;
 const emit=(kind,meta)=>window.dispatchEvent?.(new CustomEvent('fieldnotes:maps-changed',{detail:{national:true,kind,meta}}));
 const tileAt=(lng,lat,z)=>{
  const n=2**z,u=Math.max(-85.05112878,Math.min(85.05112878,Number(lat)))*Math.PI/180;
  let x=Math.floor((Number(lng)+180)/360*n),y=Math.floor((1-Math.asinh(Math.tan(u))/Math.PI)/2*n);
  return {z,x:Math.min(n-1,Math.max(0,x)),y:Math.min(n-1,Math.max(0,y))};
 };
 const keyOf=t=>t.z+'/'+t.x+'/'+t.y;
 function grid(lng,lat,z){
  const t=tileAt(lng,lat,z),n=2**z,keys=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   let y=t.y+dy;if(y<0||y>=n)continue;
   const x=(t.x+dx+n)%n;keys.push(z+'/'+x+'/'+y);
  }
  return {center:keyOf(t),keys};
 }
 function validLatLon(lng,lat){return Number.isFinite(Number(lng))&&Number.isFinite(Number(lat))&&Number(lng)>=-180&&Number(lng)<=180&&Number(lat)>=-85&&Number(lat)<=85;}
 function sourceFor(lng,lat,level='county'){
  if(level==='province'||!validLatLon(lng,lat))return null;
  return catalog.find(s=>lng>=s.bounds[0]&&lat>=s.bounds[1]&&lng<=s.bounds[2]&&lat<=s.bounds[3])||null;
 }
 function parseSource(src){
  if(!src||!idRx.test(src.id)||typeof src.name!=='string'||!Array.isArray(src.bounds)||src.bounds.length!==4)return null;
  const b=src.bounds.map(Number);
  if(!b.every(Number.isFinite)||b[0]<-180||b[2]>180||b[1]<-85||b[3]>85||b[0]>=b[2]||b[1]>=b[3])return null;
  const z=Number(src.zoom);if(!Number.isInteger(z)||z<10||z>14||src.schema!=='openmaptiles'||src.type!=='pmtiles')return null;
  let url;try{url=new URL(src.url,ROOT);}catch{return null;}
  if(url.protocol!=='https:'&&url.origin!==location.origin)return null;
  // Cross-origin tiles require an explicit source grant and functioning CORS/Range responses.
  if(url.origin!==location.origin&&src.crossOriginApproved!==true)return null;
  if(url.username||url.password)return null;
  return {id:src.id,name:src.name.slice(0,80),bounds:b,zoom:z,type:'pmtiles',
   url:url.href,sourceName:String(src.sourceName||'OSM').slice(0,80),license:'ODbL'};
 }
 async function cache(){if(!available)throw Error('此环境不支持网页离线地图缓存');return cachePromise||(cachePromise=caches.open(CACHE));}
 async function readStored(){
  if(!available)return;
  const c=await cache();
  const ks=await c.keys();
  for(const request of ks){
   if(!request.url.includes('/__fn_national_manifests__/'))continue;
   try{
    const m=await(await c.match(request)).json();
    if(typeof m.id!=='string'||!Array.isArray(m.tiles)||!m.tiles.every(k=>tileRx.test(k))||!Number.isInteger(m.zoom))continue;
    bundles.set(m.id,m);
   }catch(_){}
  }
 }
 const ready=(async()=>{
  if(!available)return;
  await readStored();
  try{
   const response=await fetch(new URL(INDEX,ROOT).href,{credentials:'omit'});
   if(!response.ok)throw Error('No configured national map archive');
   const info=await response.json();
   if(info.version!==1||!Array.isArray(info.sources))throw Error('Catalog mismatch');
   catalog=info.sources.map(parseSource).filter(Boolean);
  }catch(_){catalog=[];}
 })();
 function installedKeys(){
  const found=new Set();
  for(const meta of bundles.values())for(const key of meta.tiles)found.add(key);
  return found;
 }
 function bestInstalled(lng,lat){
  if(!validLatLon(lng,lat))return null;
  const all=installedKeys(),zooms=[...new Set([...bundles.values()].map(m=>m.zoom))].sort((a,b)=>b-a);
  for(const z of zooms){
   const g=grid(lng,lat,z);
   if(all.has(g.center)){
    const count=g.keys.filter(k=>all.has(k)).length;
    return {zoom:z,covered:count,needed:g.keys.length,complete:count===g.keys.length,source:'local-pmtiles-cache'};
   }
  }
  return null;
 }
 function status(lng,lat,level='county'){
  if(level==='province'||!validLatLon(lng,lat))return {kind:'unavailable',reason:'missing-or-coarse-location'};
  const installed=bestInstalled(lng,lat);
  if(installed)return {kind:'installed',...installed};
  const src=sourceFor(lng,lat,level);
  if(!src)return {kind:'unavailable',reason:'no-verified-deployed-archive'};
  if(!available||navigator.onLine===false)return {kind:'offline',reason:'download-unavailable'};
  // The archive's bbox is a candidate, not proof every tile/building exists.
  return {kind:'candidate',sourceId:src.id,name:src.name,zoom:src.zoom,
   coverage:'potential',warning:'范围仅为数据集声明，下载时才校验真实瓦片'};
 }
 async function loadReader(src){
  if(typeof window.FIELDNOTES_TEST_NATIONAL_READER_FACTORY==='function'&&
   /^(localhost|127\.0\.0\.1)$/.test(location.hostname))
   return window.FIELDNOTES_TEST_NATIONAL_READER_FACTORY(src);
  if(!readerModule)readerModule=import('./vendor/pmtiles.bundle.js');
  const module=await readerModule;
  if(typeof module.PMTiles!=='function')throw Error('缺少已审核的 PMTiles 读取组件');
  const archive=new module.PMTiles(src.url);
  const h=await archive.getHeader();
  if(h.minZoom>src.zoom||h.maxZoom<src.zoom||h.tileType!==1)throw Error('地图压缩包缺少指定缩放级别或不是矢量地图');
  return archive;
 }
 async function installAt(lng,lat,placeLabel=''){
  await ready;
  if(!available||navigator.onLine===false)throw Error('当前无法联网下载地图，仍可使用基础地图');
  const src=sourceFor(lng,lat);
  if(!src)throw Error('尚未配置该地点可用的国内地图包，不会虚假提示下载成功');
  const task=grid(lng,lat,src.zoom),c=await cache(),reader=await loadReader(src);
  const proposed=[],failures=[];
  let index=0,bytes=0;
  async function worker(){
   while(index<task.keys.length){
    const key=task.keys[index++],parts=key.split('/').map(Number);
    try{
     const result=await reader.getZxy(parts[0],parts[1],parts[2]);
     if(!result?.data){failures.push(key);continue;}
     const data=new Uint8Array(result.data);
     if(data.byteLength<40||data.byteLength>1500000)throw Error('瓦片大小异常');
     bytes+=data.byteLength;
     if(bytes>12*1024*1024)throw Error('超过单次 12 MB 下载预算');
     proposed.push({key,data});
    }catch(e){
     if(String(e).includes('预算'))throw e;
     failures.push(key);
    }
   }
  }
  await Promise.all([worker(),worker()]);
  if(!proposed.some(p=>p.key===task.center))throw Error('中心瓦片不存在，无法证明该地点有真实精细数据');
  const id=src.id+'-'+task.center.replaceAll('/','-');
  // Transaction metadata is written last; incomplete downloads will never be reported as installed.
  const saved=[],keys=proposed.map(p=>p.key);
  try{
   for(const entry of proposed){
    const r=new Response(entry.data,{headers:{'Content-Type':'application/vnd.mapbox-vector-tile'}});
    await c.put(keyUrl(entry.key),r);
    saved.push(entry.key);memory.set(entry.key,entry.data);
   }
   const meta={id,zoom:src.zoom,sourceId:src.id,placeLabel:String(placeLabel||src.name).slice(0,72),
    centerTile:task.center,tiles:keys,bytes,expected:task.keys.length,installedAt:new Date().toISOString()};
   await c.put(metaUrl(id),new Response(JSON.stringify(meta),{headers:{'Content-Type':'application/json'}}));
   bundles.set(id,meta);
   emit('installed',{id,zoom:meta.zoom});
   return {id,zoom:src.zoom,downloaded:keys.length,expected:task.keys.length,bytes,complete:keys.length===task.keys.length};
  }catch(e){
   const owned=installedKeys();
   for(const k of saved)if(!owned.has(k)){await c.delete(keyUrl(k));memory.delete(k);}
   throw e;
  }
 }
 async function getTile(key){
  if(!tileRx.test(key))return null;
  if(!installedKeys().has(key))return null;
  if(memory.has(key))return memory.get(key);
  if(!available)return null;
  const c=await cache(),r=await c.match(keyUrl(key));
  if(!r)return null;
  const data=new Uint8Array(await r.arrayBuffer());memory.set(key,data);return data;
 }
 function listDownloads(){return [...bundles.values()].map(m=>({
  id:m.id,zoom:m.zoom,label:m.placeLabel,bytes:m.bytes,
  tileCount:m.tiles.length,expected:m.expected,installedAt:m.installedAt
 })).sort((a,b)=>String(b.installedAt).localeCompare(String(a.installedAt)));}
 async function removeBundle(id){
  await ready;
  const old=bundles.get(id);if(!old)return false;
  const c=await cache();await c.delete(metaUrl(id));bundles.delete(id);
  const owned=installedKeys();
  for(const k of old.tiles)if(!owned.has(k)){await c.delete(keyUrl(k));memory.delete(k);}
  emit('removed',{id});return true;
 }
 async function clearAll(){
  await ready;
  if(!available)return false;
  await caches.delete(CACHE);cachePromise=null;memory.clear();bundles.clear();
  emit('all-removed',{});return true;
 }
 function attachStorageSettings(){
  const dialog=document.getElementById('fn38StorageDialog');
  if(!dialog)return;
  const controls=dialog.querySelector('#fn38StorageControls');
  if(!controls||document.getElementById('fnNationalSettings'))return;
  const section=document.createElement('div');section.id='fnNationalSettings';
  const title=document.createElement('strong');title.textContent='其他地点 · 按需下载地图';
  const desc=document.createElement('p');desc.textContent='这里只管理已缓存的真实地图瓦片，不上传照片。删除后如需恢复，须再次联网。';
  const list=document.createElement('div');list.id='fnNationalDownloads';
  const clear=document.createElement('button');clear.type='button';clear.textContent='删除全部其他地点地图';
  clear.addEventListener('click',async()=>{
   if(!confirm('删除所有按需缓存的地点地图？手机相册作品不会删除。'))return;
   await clearAll();await refresh();location.reload();
  });
  section.append(title,desc,list,clear);controls.parentElement.insertBefore(section,controls);
  async function refresh(){
   await ready;list.replaceChildren();
   const items=listDownloads();
   if(!items.length){const p=document.createElement('p');p.textContent='暂无其他地点的离线地图';list.append(p);return;}
   for(const item of items){
    const row=document.createElement('div');row.className='fn38PackRow';
    const label=document.createElement('span');label.textContent=item.label+' · Z'+item.zoom+
     ' · '+(item.bytes/1048576).toFixed(2)+' MB'+(item.tileCount<item.expected?'（局部）':'');
    const button=document.createElement('button');button.type='button';button.textContent='删除';
    button.addEventListener('click',async()=>{
     if(!confirm('删除 '+item.label+' 的已下载地图？'))return;
     button.disabled=true;await removeBundle(item.id);await refresh();location.reload();
    });
    row.append(label,button);list.append(row);
   }
  }
  dialog.addEventListener('close',()=>{});
  const open=document.getElementById('fn38StorageBtn');
  open?.addEventListener('click',refresh);
  document.getElementById('fn38StorageBtnAdvanced')?.addEventListener('click',refresh);
 }
 // Base program must work even when this optional provider is not configured.
 attachStorageSettings();
 window.FIELDNOTES_NATIONAL_MAP=Object.freeze({
  ready,status,bestInstalled,installAt,getTile,listDownloads,removeBundle,clearAll,sourceFor,grid
 });
})();
