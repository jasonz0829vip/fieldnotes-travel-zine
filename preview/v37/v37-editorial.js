/* FIELDNOTES V3.7 — cartographic photography, not province stickers.
 * Cartography: OpenFreeMap/OpenMapTiles/OpenStreetMap real vector geometries.
 * First use online to fetch 3x3 local tiles, then reuse cached local map tiles offline.
 * This file deliberately doesn't change Android/iPhone photo import/share code.
*/
(()=>{
'use strict';
const base=window.FIELDNOTES_STREETS;
if(!base)return;
const presets=[
 // Each preset changes composition, feature hierarchy, titles, geometry footprint and contrast.
 {id:'sky-atlas',name:'01 · 天空城市肌理',subtitle:'铺展街网 · 空气渐隐',family:'Sky Atlas',anchor:'wide',type:'two-left',palette:'ice',opacity:.62,scale:1.0,roads:1,water:1,labels:2},
 {id:'coastal-water',name:'02 · 海岸水系图志',subtitle:'突出河道与海岸 · 海蓝',family:'Coastal Atlas',anchor:'left',type:'geo-center',palette:'marine',opacity:.72,scale:1.2,roads:.56,water:1.4,labels:3},
 {id:'grand-editorial',name:'03 · 独立杂志',subtitle:'留白文字 · 淡雅街道',family:'Independent Journal',anchor:'right',type:'roman-right',palette:'linen',opacity:.58,scale:1.02,roads:.73,water:.84,labels:2},
 {id:'night-cartography',name:'04 · 夜航金线',subtitle:'金色交通网 · 夜景',family:'Nocturne',anchor:'wide',type:'line-left',palette:'gold',opacity:.71,scale:.95,roads:1.2,water:.5,labels:2},
 {id:'architectural-blueprint',name:'05 · 建筑蓝图',subtitle:'细线交通网络 · 工程美学',family:'Blueprint',anchor:'right',type:'technical',palette:'blueprint',opacity:.80,scale:1.30,roads:1.08,water:.75,labels:1},
 {id:'quiet-documentary',name:'06 · 地理纪录',subtitle:'微字坐标 · 摄影为主',family:'Documentary',anchor:'left',type:'small-left',palette:'ink',opacity:.40,scale:.72,roads:.63,water:.43,labels:1},
 {id:'heritage-atlas',name:'07 · 古典地图志',subtitle:'古铜色路网 · 旧式排印',family:'Heritage',anchor:'left',type:'romance',palette:'sepia',opacity:.55,scale:1.06,roads:.82,water:.7,labels:3},
 {id:'frost-geography',name:'08 · 雪白地貌',subtitle:'冰白水纹 · 克制文字',family:'Frost',anchor:'wide',type:'arrow-top',palette:'frost',opacity:.60,scale:1.25,roads:.62,water:1.18,labels:1},
 {id:'graphic-location',name:'09 · 地图导航',subtitle:'路线层级 · 红点定位',family:'Point & Route',anchor:'right',type:'marker-bold',palette:'slate',opacity:.85,scale:.85,roads:1.3,water:.8,labels:1},
 {id:'green-topology',name:'10 · 植被水网',subtitle:'绿地轮廓 · 道路纹理',family:'Field Survey',anchor:'wide',type:'wide-letter',palette:'sage',opacity:.65,scale:1.05,roads:.66,water:.75,labels:2},
 {id:'city-trace',name:'11 · 城市线描',subtitle:'局部道路 · 高对比线',family:'City Trace',anchor:'right',type:'technical',palette:'mono',opacity:.77,scale:1.38,roads:1.12,water:.52,labels:0},
 {id:'postcard-expedition',name:'12 · 旅行纪行',subtitle:'缩放区域 · 手账式地理标注',family:'Expedition',anchor:'left',type:'romance',palette:'ochre',opacity:.69,scale:.85,roads:.89,water:.65,labels:3}
];
const pigments={
 ice:{road:'#e7f4fa',roadStrong:'#fbfeff',river:'#b5e2fb',water:'#9dcadf',park:'#c8e3d5',text:'#e7faff',minor:'#b2cedc'},
 marine:{road:'#e4f4e9',roadStrong:'#ffffff',river:'#c8efff',water:'#8ccadd',park:'#b7d8c8',text:'#ffffff',minor:'#d0e7e4'},
 linen:{road:'#637782',roadStrong:'#334e62',river:'#4c8da9',water:'#adc6d0',park:'#a0b7a0',text:'#233e4c',minor:'#788d91'},
 gold:{road:'#c7a76b',roadStrong:'#f8e3ab',river:'#b7cee0',water:'#7494a4',park:'#99a28b',text:'#fbe2a5',minor:'#c2a87d'},
 blueprint:{road:'#a5dce9',roadStrong:'#ffffff',river:'#b7e4f1',water:'#87c0dd',park:'#b1d2bf',text:'#f4fdff',minor:'#a4cbd7'},
 ink:{road:'#455d67',roadStrong:'#253f4f',river:'#5f879e',water:'#8fb5c7',park:'#97b4ab',text:'#203746',minor:'#627f88'},
 sepia:{road:'#91765e',roadStrong:'#543d31',river:'#8aa2a8',water:'#b0bdbe',park:'#b1b399',text:'#473d35',minor:'#947962'},
 frost:{road:'#fbffff',roadStrong:'#ffffff',river:'#e2f4ff',water:'#bedfe8',park:'#d3e3df',text:'#ffffff',minor:'#eff7f6'},
 slate:{road:'#aabac8',roadStrong:'#f4f7fc',river:'#a1cade',water:'#a3bac5',park:'#a5bbab',text:'#ffffff',minor:'#c0d1db'},
 sage:{road:'#e3e7d7',roadStrong:'#ffffff',river:'#d9eff4',water:'#b2d5df',park:'#c4dec1',text:'#f2f9eb',minor:'#c4d3b9'},
 mono:{road:'#e0ecef',roadStrong:'#ffffff',river:'#b2d4e0',water:'#afc7d3',park:'#d2ded5',text:'#f8faf9',minor:'#b3cdd1'},
 ochre:{road:'#f3dfb4',roadStrong:'#fff8dc',river:'#c8e3ed',water:'#96c5d7',park:'#c8d9b6',text:'#fff5d8',minor:'#d9cbaa'}
};
let mapResult=null,lastKey='',inflight=null,lastError='',renderedVersion=0;
const mapInfo={status:'idle',location:'',detail:'none',tiles:0};
function selectedRegion(){
 if(!state.v36RegionCode)return null;
 const arr=window.FN_CHINA?.records||[];
 const match=arr.find(x=>x[0]===state.v36RegionCode);
 return match?{code:match[0],name:match[1],level:match[0].endsWith('0000')?'province':match[0].endsWith('00')?'city':'county'}:null;
}
function currentLocation(){
 const lng=Number(state.centerLon),lat=Number(state.centerLat);
 if(!Number.isFinite(lng)||!Number.isFinite(lat))return null;
 const region=selectedRegion();
 return{lon:lng,lat,level:state.exact?'gps':(region?.level||'city'),name:region?.name||state.cityLabel||'',code:region?.code||''};
}
async function prepare(){
 const loc=currentLocation();if(!loc)return null;
 const key=[loc.lon.toFixed(4),loc.lat.toFixed(4),loc.level].join('|');
 if(key===lastKey&&mapResult)return mapResult;
 if(key===lastKey&&inflight)return inflight;
 lastKey=key;mapResult=null;lastError='';
 if(loc.level==='province'){
  mapInfo.status='region';mapInfo.location=loc.name;mapInfo.detail='province';mapInfo.tiles=0;
  return null;
 }
 mapInfo.status='loading';mapInfo.location=loc.name;mapInfo.detail='loading';
 const promise=base.streets(loc.lon,loc.lat,loc.level).then(data=>{
   if(lastKey!==key)return null;
   mapResult=data;lastError='';mapInfo.status='loaded';mapInfo.tiles=data.sources;
   mapInfo.detail=(data.roads.length+' roads · '+data.water.length+' water areas · '+data.river.length+' waterways');
   renderedVersion++;return data;
 }).catch(e=>{
   if(lastKey===key){lastError=e.message;mapInfo.status='unavailable';mapInfo.detail='fallback';}
   return null;
 }).finally(()=>{if(lastKey===key)inflight=null});
 inflight=promise;return promise;
}
window.FIELDNOTES_V37_PREPARE=prepare;
window.FIELDNOTES_V37_MAPINFO=mapInfo;
window.FIELDNOTES_V37_STYLES=presets;
function plans({round=0,feedback='balanced'}={}){
 const baseIndex=((round%4)+4)%4*3;
 const chosen=presets.slice(baseIndex,baseIndex+3);
 return chosen.map((preset,i)=>{
  const moreMap=feedback==='map',original=feedback==='original',soft=feedback==='soft';
  return{
   label: String(i+1).padStart(2,'0')+' · '+preset.family,
   desc:preset.subtitle,
   kind:'v37',
   cfg:{
    v37Preset:preset.id,v35Sidecar:false,frameMode:false,v32NoMap:false,v32Micro:false,viewMode:'province',
    styleMode:'light',theme:'ivory',guides:false,
    opacity:original?58:90,wash:0,typeScale:100,
    area:moreMap?28:18,posX:.5,posY:.24,v32BeforePreview:false,
    v32Tone:'original',v32Exposure:0,v32Contrast:0,v32Saturation:0,v32Warm:0
   }
  };
 });
}
window.FIELDNOTES_V37_PLAN=plans;

function themeFor(preset,w,h) {
 const px=pigments[preset.palette];
 // Use an off-white ink for night/dark skies; on bright sky dark inks remain legible.
 const lum=typeof v35LocalBrightness==='function'?v35LocalBrightness(.28,.12):145;
 if(lum<91 && ['linen','ink','sepia'].includes(preset.palette))
  return {...px,road:'#d5e4e7',roadStrong:'#f6faff',text:'#f6faf9',minor:'#b5cdd0'};
 if(lum>205 && ['frost','blueprint','mono'].includes(preset.palette))
  return {...px,road:'#516e7a',roadStrong:'#243e4e',text:'#304a57',minor:'#728c96'};
 return px;
}
function proj(lon,lat,box,loc,span){
 const metersPerDegreeLon=111320*Math.cos(loc.lat*Math.PI/180);
 return [
  box.cx+(lon-loc.lon)*metersPerDegreeLon*box.w/span,
  box.cy+(loc.lat-lat)*111320*box.w/span
 ];
}
function boxFor(preset,w,h){
 const portrait=h>w*1.18,wide=preset.anchor==='wide',right=preset.anchor==='right';
 const size=(portrait?.91:.84)*preset.scale;
 const bw=Math.min(w*.97,w*size), bh=portrait?h*.46:h*.65;
 return{
  cx:wide?w*.50:right?w*.71:w*.31,
  cy:portrait?h*(wide?.22:right?.235:.235):h*(wide?.29:.285),
  w:bw,
  h:bh,
  portrait
 };
}
function geomPath(ctx,poly,box,loc,span,close){
 if(!Array.isArray(poly)||poly.length<2)return false;
 const step=poly.length>800?Math.ceil(poly.length/800):1;
 ctx.beginPath();let n=0;
 for(let i=0;i<poly.length;i+=step){
  const p=poly[i];if(!p||!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;
  const [x,y]=proj(p[0],p[1],box,loc,span);
  if(n++===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
 }
 if(close)ctx.closePath();return n>=2;
}
function roadmap(ctx,w,h,preset,loc,box,ink){
 const atlas=mapResult;
 if(!atlas)return false;
 const factor=w/1000,span=(loc.level==='gps'?5700:loc.level==='city'?19500:11000);
 const culling={x0:box.cx-box.w*.61,x1:box.cx+box.w*.61,y0:box.cy-box.h*.64,y1:box.cy+box.h*.64};
 const seenWithin=arr=>{
  if(!arr?.length)return false;
  for(let i=0;i<arr.length;i+=Math.max(1,Math.floor(arr.length/6))){
   const p=arr[i];const xy=proj(p[0],p[1],box,loc,span);
   if(xy[0]>=culling.x0&&xy[0]<=culling.x1&&xy[1]>=culling.y0&&xy[1]<=culling.y1)return true;
  }
  return false;
 };
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 // Nature and water shapes are overlaid as true geography, not illustrative decoration.
 const fills=[
  [atlas.parks,ink.park,.055],
  [atlas.water,ink.water,preset.water*.10]
 ];
 for(const [items,paint,alpha] of fills){
  ctx.fillStyle=paint;ctx.globalAlpha=Math.min(.30,alpha*preset.opacity);
  for(const [,poly] of items){if(!seenWithin(poly))continue;
   if(geomPath(ctx,poly,box,loc,span,true))ctx.fill();
  }
 }
 const waterRings=atlas.water.filter(([,p])=>p.length>2);
 ctx.strokeStyle=ink.water;ctx.lineWidth=Math.max(.48,1.08*factor*preset.water);ctx.globalAlpha=preset.opacity*.53;
 for(const [,pts] of waterRings){if(seenWithin(pts)&&geomPath(ctx,pts,box,loc,span,true))ctx.stroke();}
 for(const [klass,pts] of atlas.river){
  if(!seenWithin(pts)||!geomPath(ctx,pts,box,loc,span,false))continue;
  ctx.strokeStyle=ink.river;ctx.lineWidth=Math.max(.85,(klass==='river'?2.5:1.3)*factor*preset.water);
  ctx.globalAlpha=.47*preset.opacity;ctx.stroke();
 }
 const widths={motorway:2.5,trunk:2.2,primary:2.0,secondary:1.55,tertiary:1.2,minor:.82,service:.60,path:.46,track:.38,street:.84,pedestrian:.50};
 // Thin streets first, arterials last; avoids an unstructured bright white spaghetti map.
 const roadLayers=[[],[],[]];
 for(const o of atlas.roads){
  const k=o[0];if(!seenWithin(o[1]))continue;
  const group=['motorway','trunk','primary','secondary'].includes(k)?2:['tertiary','minor','street'].includes(k)?1:0;
  roadLayers[group].push(o);
 }
 for(let group=0;group<3;group++)for(const [cls,poly] of roadLayers[group]){
  if(!geomPath(ctx,poly,box,loc,span,false))continue;
  ctx.lineWidth=Math.max(.55,widths[cls]*factor*.85*preset.roads);
  ctx.strokeStyle=group===2?ink.roadStrong:group===0?ink.minor:ink.road;
  ctx.globalAlpha=preset.opacity*(group===2?.72:group===1?.57:.38);
  ctx.stroke();
 }
 ctx.restore();return true;
}
function provinceOutline(ctx,w,h,preset,loc,box,ink){
 const regionCode=state.v36RegionCode;
 const geo=regionCode&&window.FIELDNOTES_V36_TEST?.geometryFallback(regionCode);
 const f=geo?.feature;
 if(!f?.rings?.length)return false;
 let x0=f.bb[0],x1=f.bb[2],y0=f.bb[1],y1=f.bb[3],centerLon=(x0+x1)/2,centerLat=(y0+y1)/2;
 const cos=Math.cos(centerLat*Math.PI/180),geoWidth=Math.max((x1-x0)*cos,(y1-y0)*1.1,.001);
 const scale=box.w*.71/geoWidth;let cx=box.cx,cy=box.cy;
 ctx.save();
 for(const ring of f.rings){
  if(ring.length<4)continue;
  ctx.beginPath();
  ring.forEach((p,i)=>{const x=cx+(p[0]-centerLon)*cos*scale,y=cy-(p[1]-centerLat)*scale;
   if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});
  ctx.closePath();ctx.strokeStyle=ink.roadStrong;ctx.lineWidth=Math.max(1.1,w*.001);
  ctx.globalAlpha=.70*preset.opacity;ctx.stroke();
 }
 ctx.restore();return true;
}
function atlasMask(ctx,w,h,preset,box){
 // Transparent atmospheric gradient: no rectangular title card, no bottom album mat.
 ctx.save();ctx.globalCompositeOperation='destination-in';
 const grad=ctx.createLinearGradient(0,Math.max(0,box.cy-box.h*.58),0,box.cy+box.h*.56);
 grad.addColorStop(0,'rgba(0,0,0,0.83)');
 grad.addColorStop(.20,'rgba(0,0,0,1)');
 grad.addColorStop(.56,'rgba(0,0,0,.92)');
 grad.addColorStop(.84,'rgba(0,0,0,.35)');
 grad.addColorStop(1,'rgba(0,0,0,0)');
 ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 const lg=ctx.createLinearGradient(0,0,w,0);
 if(preset.anchor==='left'){lg.addColorStop(0,'rgba(0,0,0,.9)');lg.addColorStop(.38,'rgba(0,0,0,1)');lg.addColorStop(.78,'rgba(0,0,0,.2)');lg.addColorStop(1,'rgba(0,0,0,0)');}
 else if(preset.anchor==='right'){lg.addColorStop(0,'rgba(0,0,0,0)');lg.addColorStop(.17,'rgba(0,0,0,.3)');lg.addColorStop(.60,'rgba(0,0,0,1)');lg.addColorStop(1,'rgba(0,0,0,.86)');}
 else{lg.addColorStop(0,'rgba(0,0,0,.5)');lg.addColorStop(.18,'rgba(0,0,0,1)');lg.addColorStop(.82,'rgba(0,0,0,1)');lg.addColorStop(1,'rgba(0,0,0,.5)');}
 ctx.fillStyle=lg;ctx.fillRect(0,0,w,h);
 ctx.restore();
}

function formatCoordinate(lat,lon,exact){
 const ll=n=>Math.abs(n).toFixed(exact?4:2);
 return ll(lat)+'° '+(lat>=0?'N':'S')+'   '+ll(lon)+'° '+(lon>=0?'E':'W');
}
function type(ctx,text,x,y,size,color,{serif=false,italic=false,space=0,align='left',max=null,weight='400'}={}){
 if(!text)return;
 ctx.save();
 ctx.textBaseline='alphabetic';ctx.textAlign=align;
 ctx.fillStyle=color;
 ctx.font=(italic?'italic ':'')+weight+' '+Math.max(8,Math.round(size))+'px '+(serif?'"Palatino Linotype",Georgia,serif':'"Segoe UI",Arial,sans-serif');
 ctx.shadowColor=/^#f/i.test(color)||/^#e/i.test(color)?'rgba(15,24,29,.38)':'rgba(245,248,248,.42)';
 ctx.shadowBlur=Math.max(1,size*.10);
 ctx.shadowOffsetY=0;
 if(space>0){
  let xx=x,chars=Array.from(text),full=chars.reduce((sum,c)=>sum+ctx.measureText(c).width+space,0);
  if(align==='right')xx-=full;else if(align==='center')xx-=full*.5;
  for(const c of chars){ctx.fillText(c,xx,y);xx+=ctx.measureText(c).width+space;}
 }else ctx.fillText(text,x,y,max||undefined);
 ctx.restore();
}
function geomLabel(ctx,w,h,preset,loc,box,ink){
 const d=mapResult?.labels||[];if(!d.length||!preset.labels)return;
 const span=(loc.level==='gps'?5700:loc.level==='city'?19500:11000);
 const usable=[];
 for(const [layer,text,p]of d){
  if(text.length<3||text.length>32)continue;
  const [x,y]=proj(p[0],p[1],box,loc,span);
  if(x<w*.08||x>w*.94||y<h*.07||y>h*.45)continue;
  if(Math.abs(x-box.cx)<w*.025&&Math.abs(y-box.cy)<h*.035)continue;
  const dist=Math.hypot(x-box.cx,y-box.cy);
  usable.push({text,x,y,dist,layer});
 }
 usable.sort((a,b)=>a.dist-b.dist);
 const drawn=[];
 for(const o of usable){
  if(drawn.length>=preset.labels)break;
  if(drawn.some(p=>Math.hypot((o.x-p.x)/1.8,o.y-p.y)<w*.14))continue;
  const size=Math.max(10,Math.min(16,w*.010));
  type(ctx,o.text,o.x,o.y,size,ink.text,{serif:true,italic:true,max:w*.22});
  drawn.push(o);
 }
}
function pin(ctx,w,h,preset,loc,box,ink){
 const x=box.cx,y=box.cy,R=Math.max(4,w*.0048);
 ctx.save();
 ctx.beginPath();ctx.arc(x,y,R+2,0,Math.PI*2);ctx.fillStyle='rgba(254,252,247,.94)';ctx.fill();
 ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.fillStyle='#c94f3b';ctx.fill();
 ctx.shadowColor='rgba(38,17,12,.2)';ctx.shadowBlur=3;ctx.restore();
 const size=Math.max(11,Math.min(21,w*.014));
 const name=base.displayEnglish(loc.name).replace(/(AUTONOMOUS|COUNTY|DISTRICT|PROVINCE).*$/,'').trim();
 let dx=x+R+8,dy=y-6;
 if(dx>w*.76)dx=x-R-8;
 type(ctx,name,dx,dy,size,ink.text,{serif:true,italic:true,align:dx<x?'right':'left',max:w*.23});
}
function compassScale(ctx,w,h,preset,loc,box,ink){
 const d=w/1000,topY=Math.max(20,h*.042),right=w*.93;
 ctx.save();
 ctx.strokeStyle=ink.text;ctx.lineWidth=Math.max(1,w*.0010);ctx.globalAlpha=.80;
 ctx.beginPath();ctx.moveTo(right,topY+17*d);ctx.lineTo(right,topY-8*d);ctx.moveTo(right-5*d,topY+6*d);ctx.lineTo(right,topY-8*d);ctx.lineTo(right+5*d,topY+6*d);ctx.stroke();
 ctx.restore();
 type(ctx,'N',right,topY-17*d,Math.max(10,w*.011),ink.text,{align:'center',serif:true});
 // 1, 2, 5 km scale based on actual degrees-to-metres map projection.
 const span=loc.level==='gps'?5700:loc.level==='city'?19500:11000;
 const distance=loc.level==='gps'?1000:loc.level==='city'?5000:2000;
 const px=box.w*distance/span, x0=w*.74, y0=Math.max(38,h*.097);
 ctx.save();ctx.lineWidth=Math.max(.8,w*.001);ctx.strokeStyle=ink.text;ctx.globalAlpha=.83;
 ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0+px,y0);
 ctx.moveTo(x0,y0-4*d);ctx.lineTo(x0,y0+4*d);
 ctx.moveTo(x0+px,y0-4*d);ctx.lineTo(x0+px,y0+4*d);ctx.stroke();ctx.restore();
 type(ctx,'0',x0,y0-7*d,Math.max(9,w*.008),ink.text,{align:'center',serif:true});
 type(ctx,String(distance/1000)+' km',x0+px,y0-7*d,Math.max(9,w*.008),ink.text,{align:'center',serif:true});
}
function titles(ctx,w,h,preset,loc,box,ink){
 let name=base.displayEnglish(loc.name);
 if(!name||name==='CHINA')name='TRAVEL NOTES';
 const region=selectedRegion(),parentName=region?window.FN_CHINA?.records?.find(r=>r[0]===region.code.slice(0,2)+'0000')?.[1]:'';
 const parent=parentName?base.displayEnglish(parentName):'CHINA';
 const portrait=h>w*1.18,
  small=Math.max(10,Math.min(16,w*.011)), medium=Math.max(14,Math.min(34,w*.024)),
  titleSize=Math.max(21,Math.min(68,w*(portrait?.044:.043)));
 const x0=w*.054, xR=w*.95, ty=portrait?h*.078:h*.096;
 const coordinate=formatCoordinate(loc.lat,loc.lon,state.exact);
 const approximate=state.exact?'PHOTO / USER GPS':'REGIONAL MAP CENTER · APPROX.';
 const baseText=parent==='CHINA'?'CHINA':parent+'  ·  CHINA';
 switch(preset.type){
  case'roman-right':
   type(ctx,'GEOGRAPHIC FIELDNOTE  /  03',xR,ty-small*2.2,small,ink.text,{align:'right',space:1.3});
   type(ctx,name,xR,ty+titleSize*.12,titleSize,ink.text,{serif:true,align:'right',max:w*.51});
   type(ctx,baseText,xR,ty+titleSize*.83,small,ink.text,{align:'right',space:1.5,max:w*.47});
   break;
  case'geo-center':
   type(ctx,name,x0,ty,titleSize*.95,ink.text,{serif:true,italic:true,max:w*.53});
   type(ctx,baseText,x0,ty+titleSize*.67,small,ink.text,{space:1.8});
   break;
  case'technical':
   type(ctx,'A T L A S   /   F I E L D   S U R V E Y',x0,ty-small*2,small,ink.text,{max:w*.50});
   type(ctx,name,x0,ty+titleSize*.25,titleSize*.90,ink.text,{serif:true,max:w*.52});
   type(ctx,coordinate,x0,ty+titleSize*.90,small,ink.text);
   break;
  case'small-left':
   type(ctx,name,x0,ty,titleSize*.72,ink.text,{serif:true,max:w*.45});
   type(ctx,baseText+'  ·  '+coordinate,x0,ty+titleSize*.63,small,ink.text,{max:w*.62});
   break;
  case'line-left':
   type(ctx,name,x0,ty,titleSize,ink.text,{serif:true,space:1.2,max:w*.60});
   type(ctx,coordinate,x0,ty+titleSize*.88,small,ink.text,{space:1});
   break;
  case'arrow-top':
   type(ctx,'N O R T H  /  F I E L D  A T L A S',x0,ty-small*2,small,ink.text,{max:w*.50});
   type(ctx,name,x0,ty,titleSize*.88,ink.text,{serif:true,max:w*.52});
   break;
  case'wide-letter':
   type(ctx,name,x0,ty,titleSize*.80,ink.text,{serif:true,space:3.1,max:w*.70});
   type(ctx,baseText,x0,ty+titleSize*.68,small,ink.text,{space:2});
   break;
  case'marker-bold':
   type(ctx,'LOCATION / '+baseText,xR,ty-small*2,small,ink.text,{align:'right'});
   type(ctx,name,xR,ty,titleSize*.94,ink.text,{align:'right',serif:true,max:w*.42});
   break;
  case'romance':
   type(ctx,name,x0,ty,titleSize*1.02,ink.text,{serif:true,italic:true,space:1.7,max:w*.58});
   type(ctx,baseText,x0,ty+titleSize*.84,small,ink.text,{space:2});
   break;
  default:
   type(ctx,name,x0,ty,titleSize,ink.text,{serif:true,space:1.5,max:w*.62});
   type(ctx,baseText,x0,ty+titleSize*.78,small,ink.text,{space:2});
 }
 const captionY=portrait?h*.158:h*.193;
 if(['roman-right','marker-bold'].includes(preset.type)){
  type(ctx,coordinate,xR,captionY,small,ink.text,{align:'right',space:.9});
  type(ctx,approximate,xR,captionY+small*1.5,Math.max(8,small*.78),ink.text,{align:'right'});
 }else{
  type(ctx,coordinate,x0,captionY,small,ink.text,{space:.9});
  type(ctx,approximate,x0,captionY+small*1.5,Math.max(8,small*.78),ink.text);
 }
}
function credit(ctx,w,h,preset,ink){
 // OSM tile attribution required in exported images. Extremely small editorial metadata line.
 type(ctx,'MAP © OpenMapTiles / © OpenStreetMap',w*.985,h*.982,Math.max(8,Math.min(12,w*.007)),ink.text,{align:'right'});
}
// Atmosphere gradients only touch empty-ish upper photo zones. No opaque map cards.
function atmosphere(ctx,w,h,preset,box){
 const shades={
  'sky-atlas':['#3e7bb0',.08],
  'coastal-water':['#156496',.18],
  'grand-editorial':['#f2e1bb',.25],
  'night-cartography':['#06152c',.58],
  'architectural-blueprint':['#052747',.58],
  'quiet-documentary':['#f1eee5',.37],
  'heritage-atlas':['#ead2ac',.48],
  'frost-geography':['#d6e8f6',.33],
  'graphic-location':['#1d293d',.46],
  'green-topology':['#91ae9e',.29],
  'city-trace':['#092d4b',.35],
  'postcard-expedition':['#e5bf83',.32]
 };
 const t=shades[preset.id]||shades['sky-atlas'],hex=t[0],alpha=t[1];
 if(alpha<.01)return;
 const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
 const fadeH=h*(h>w*1.15?.54:.58);
 // Soft layered gradients rather than rectangular fills.
 ctx.save();
 const vertical=ctx.createLinearGradient(0,0,0,fadeH);
 vertical.addColorStop(0,'rgba('+r+','+g+','+b+','+alpha.toFixed(3)+')');
 vertical.addColorStop(.48,'rgba('+r+','+g+','+b+','+(alpha*.85).toFixed(3)+')');
 vertical.addColorStop(.84,'rgba('+r+','+g+','+b+','+(alpha*.25).toFixed(3)+')');
 vertical.addColorStop(1,'rgba('+r+','+g+','+b+',0)');
 ctx.fillStyle=vertical;ctx.fillRect(0,0,w,fadeH);
 if(preset.anchor!=='wide'){
  const horizontal=ctx.createRadialGradient(box.cx,box.cy,box.w*.1,box.cx,box.cy,box.w*.8);
  horizontal.addColorStop(0,'rgba('+r+','+g+','+b+','+(alpha*.17).toFixed(3)+')');
  horizontal.addColorStop(1,'rgba('+r+','+g+','+b+',0)');
  ctx.fillStyle=horizontal;ctx.fillRect(0,0,w,fadeH);
 }
 ctx.restore();
}

const originalPaint=paint;
paint=function(ctx,w,h,options={}){
 const preset=presets.find(x=>x.id===state.v37Preset);
 if(!preset)return originalPaint(ctx,w,h,options);
 const loc=currentLocation();
 if(!state.image){ctx.clearRect(0,0,w,h);return;}
 const box=boxFor(preset,w,h),ink=themeFor(preset,w,h);
 ctx.clearRect(0,0,w,h);
 if(!options.layerOnly)v32DrawPhoto(ctx,0,0,w,h);
 if(!loc)return;
 // Protect manually marked people, animals and architecture without clearing photo pixels.
 ctx.save();
 if(state.v32Protected?.length){const safe=new Path2D();safe.rect(0,0,w,h);
  for(const r of state.v32Protected)if(r.w>0&&r.h>0)safe.rect(r.x*w,r.y*h,r.w*w,r.h*h);
  ctx.clip(safe,'evenodd');}
 atmosphere(ctx,w,h,preset,box);
 const mapScale=Math.min(1,2200/w);
 const mw=Math.floor(w*mapScale),mh=Math.floor(h*mapScale);
 const layer=document.createElement('canvas');layer.width=mw;layer.height=mh;
 const g=layer.getContext('2d',{alpha:true});if(!g)return;
 g.scale(mapScale,mapScale);
 let available=false;
 if(mapResult&&mapInfo.status==='loaded')available=roadmap(g,w,h,preset,loc,box,ink);
 if(!available)provinceOutline(g,w,h,preset,loc,box,ink);
 // Map labels come from actual OSM features only.
 if(available)geomLabel(g,w,h,preset,loc,box,ink);
 atlasMask(g,w,h,preset,box);
 ctx.drawImage(layer,0,0,w,h);
 ctx.save();
 titles(ctx,w,h,preset,loc,box,ink);
 if(available)pin(ctx,w,h,preset,loc,box,ink);
 compassScale(ctx,w,h,preset,loc,box,ink);
 if(available)credit(ctx,w,h,preset,ink);
 ctx.restore();
 ctx.restore();
};
window.FIELDNOTES_V37_DEBUG={prepare,plans,getMap:()=>mapResult,info:mapInfo,presets,renderedVersion:()=>renderedVersion};
})();
