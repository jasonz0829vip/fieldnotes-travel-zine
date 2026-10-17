import {VectorTile} from '@mapbox/vector-tile';
import Pbf from 'pbf';
import {pinyin} from 'pinyin-pro';

const ROOT='https://tiles.openfreemap.org/planet/latest/';
const layerNames=['water','waterway','transportation','transportation_name','place','park','landcover'];
const memory=new Map();
const TILE_CACHE='fieldnotes-street-tiles-v37';
const nameOverrides={'西安':'XI’AN','香港':'HONG KONG','澳门':'MACAU','台湾':'TAIWAN','陵水':'LINGSHUI',
 '上海':'SHANGHAI','北京':'BEIJING','深圳':'SHENZHEN','广州':'GUANGZHOU','苏州':'SUZHOU','杭州':'HANGZHOU','重庆':'CHONGQING',
 '海口':'HAIKOU','三亚':'SANYA','武汉':'WUHAN','成都':'CHENGDU','哈尔滨':'HARBIN','南京':'NANJING','西藏':'TIBET'};
function displayEnglish(name) {
 let s=String(name||'').trim();
 for(const k of Object.keys(nameOverrides))if(s===k||s.startsWith(k)&&s.length<=k.length+3)return nameOverrides[k];
 // Strip standard administrative suffixes; never invent an English named attraction.
 s=s.replace(/(蒙古族|苗族|藏族|土家族|黎族|回族|壮族|维吾尔族|哈萨克族|彝族|白族|布依族|侗族|自治|省|特别行政区|自治区|自治县|自治州|地区|县|市|区|旗)+$/g,'');
 if(!s)return'CHINA';
 try {return pinyin(s,{toneType:'none',separator:''}).replace(/\s/g,'').toUpperCase()}catch(_){return s.toUpperCase()}
}
function xyz(lon,lat,z){
 const n=2**z,lat2=Math.max(-85,Math.min(85,lat))*Math.PI/180;
 return{x:Math.floor((lon+180)/360*n),y:Math.floor((1-Math.asinh(Math.tan(lat2))/Math.PI)/2*n),z};
}
async function tileBytes(url) {
 // Pre-installed street tiles are first-class assets: never contact overseas network for them.
 const match=url.match(/\/(\d+)\/(\d+)\/(\d+)\.pbf(?:\?|$)/);
 const key=match?(match[1]+"/"+match[2]+"/"+match[3]):"";
 const packed=window.FIELDNOTES_OFFLINE_TILES?.tiles?.[key];
 if(packed){
  if(!memory.has(url)){
   const binary=atob(packed),bytes=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   memory.set(url,Promise.resolve(bytes));
  }
  return memory.get(url);
 }
 // Basic app can work offline without QLS/3070, proxy or any server.
 // External tiles are only attempted when explicitly enabled by the user.
 if(window.FIELDNOTES_OFFLINE_FIRST && !window.FIELDNOTES_ALLOW_EXTERNAL_MAPS)
  throw Error("区域尚未安装精细街道数据；自动采用内置真实行政边界");
 if(typeof navigator!=="undefined"&&!navigator.onLine)
  throw Error("当前离线且所选区域暂无精细街道包");
 if(memory.has(url))return memory.get(url);
 let promise=(async()=>{
  if(typeof caches!=='undefined'){
   try{const c=await caches.open(TILE_CACHE),hit=await c.match(url);if(hit)return new Uint8Array(await hit.arrayBuffer())}catch(_){}
  }
  const resp=await fetch(url,{mode:'cors',credentials:'omit',signal:AbortSignal.timeout(9000)});
  if(!resp.ok)throw Error('地图服务 HTTP '+resp.status);
  const cacheCopy=resp.clone();
  const bytes=new Uint8Array(await resp.arrayBuffer());
  if(bytes.length<100||bytes.length>1300000)throw Error('地图图层无效');
  if(typeof caches!=='undefined'){
   try{const c=await caches.open(TILE_CACHE);await c.put(url,cacheCopy)}catch(_){}
  }
  return bytes;
 })();
 memory.set(url,promise);
 try{return await promise}catch(e){memory.delete(url);throw e}
}
function flattened(geometry) {
 if(!geometry||!geometry.coordinates)return[];
 const c=geometry.coordinates,t=geometry.type;
 if(t==='LineString')return[c];
 if(t==='MultiLineString')return c;
 if(t==='Polygon')return c.slice(0,1);
 if(t==='MultiPolygon')return c.map(p=>p[0]);
 return[];
}
function titleLabel(properties){
 const name=properties['name:en']||properties.name_en||properties.name_int||properties.name||'';
 if(!name)return'';
 // Avoid Chinese-only labels when requested editorial style is English.
 if(/[\u3400-\u9fff]/.test(name))return '';
 return String(name).trim().slice(0,56);
}
function parseTile(buf,x,y,z){
 const vt=new VectorTile(new Pbf(buf));
 const result={water:[],river:[],roads:[],parks:[],labels:[]};
 for(const name of layerNames){
  const layer=vt.layers[name];if(!layer)continue;
  const max=Math.min(layer.length,name==='transportation'?1900:name==='place'?60:name==='transportation_name'?120:600);
  for(let i=0;i<max;i++){
   const f=layer.feature(i),p=f.properties||{},geo=f.toGeoJSON(x,y,z).geometry;
   const cls=String(p.class||p.subclass||'').toLowerCase();
   if(name==='transportation') {
    if(f.type!==2||cls==='ferry')continue;
    if(!['motorway','trunk','primary','secondary','tertiary','minor','service','path','track','street','pedestrian'].includes(cls))continue;
    for(const l of flattened(geo))if(l.length>=2)result.roads.push([cls,l]);
   } else if(name==='water'||name==='waterway'){
    for(const l of flattened(geo))if(l.length>=2)(name==='water'?result.water:result.river).push([cls,l]);
   } else if(name==='park'||name==='landcover'){
    if(name==='landcover'&&!['wood','grass','farmland','wetland','forest','park'].includes(cls))continue;
    for(const l of flattened(geo))if(l.length>=3)result.parks.push([cls,l]);
   } else if(name==='place'||name==='transportation_name'){
    if(!['Point','MultiPoint','LineString'].includes(geo.type))continue;
    const label=titleLabel(p);if(!label)continue;
    let c=geo.coordinates;if(geo.type==='LineString')c=c[Math.floor(c.length/2)];
    if(geo.type==='MultiPoint')c=c[0];
    if(!Array.isArray(c)||!Number.isFinite(c[0]))continue;
    result.labels.push([name,label,c,cls]);
   }
  }
 }
 return result;
}
async function streets(lon,lat,level='county'){
 const z=level==='province'?8:level==='city'?12:level==='gps'?14:13;
 const center=xyz(lon,lat,z);const key=z+':'+center.x+':'+center.y;
 const work=[];
 // A compact 3x3 grid is fetched only around an actively selected location.
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const x=center.x+dx,y=center.y+dy;
  work.push({x,y,z,url:ROOT+z+'/'+x+'/'+y+'.pbf'});
 }
 const fetched=await Promise.allSettled(work.map(async t=>parseTile(await tileBytes(t.url),t.x,t.y,t.z)));
 const good=fetched.filter(t=>t.status==='fulfilled').map(t=>t.value);
 if(!good.length)throw Error('当前区域的精细地图暂不可用，稍后重新联网生成');
 const all={water:[],river:[],roads:[],parks:[],labels:[],center:[lon,lat],zoom:z,sources:good.length};
 for(const g of good)for(const n of ['water','river','roads','parks','labels'])all[n].push(...g[n]);
 return all;
}
window.FIELDNOTES_STREETS={streets,displayEnglish,xyz,provider:'OpenFreeMap/OpenMapTiles/OpenStreetMap',license:'ODbL'};
