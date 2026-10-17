/* FIELDNOTES P1 curated visual direction.
 * Real OSM geometry only; photograph rendered unmodified by existing draw function.
 * Three unmistakably different initial compositions and a second trio on regenerate.
 * Never draws fake streets, contours or photo GPS.
 */
(()=>{
 'use strict';
 const oldPaint=paint;
 const sets=[
  [
   ['sky','SKY ATLAS','云际街网 · 全幅淡入'],
   ['coastal','COAST & WATER','海岸地理 · 水系渐变'],
   ['minimal','PURE COORDINATES','极简坐标 · 镜头优先']
  ],[
   ['nocturne','NIGHT CARTOGRAPHY','暗夜金线 · 真实道路'],
   ['blueprint','URBAN BLUEPRINT','城市蓝图 · 内嵌街网'],
   ['journal','FIELD JOURNAL','旅行档案 · 文学排印']
  ]
 ];
 const visibleIds=new Set(sets.flat().map(x=>x[0]));
 let renderCalls=0;
 const palette={
  sky:{road:'#e9f6ff',major:'#ffffff',water:'#afe8f8',green:'#b6dfce',type:'#fffdf3',pin:'#dc5344'},
  coastal:{road:'#edf5dc',major:'#ffffff',water:'#cff9e7',green:'#c7ecd9',type:'#fffbef',pin:'#c64f43'},
  minimal:{road:'#f2f4ef',major:'#ffffff',water:'#c5e9ed',green:'#cfdacb',type:'#fdfcf7',pin:'#c94f42'},
  nocturne:{road:'#bd9c64',major:'#ffdaa0',water:'#7eaab6',green:'#85a897',type:'#ffebc9',pin:'#ed624d'},
  blueprint:{road:'#a0d8e8',major:'#ffffff',water:'#6ea6c3',green:'#96cbbb',type:'#fbffff',pin:'#dc5a49'},
  journal:{road:'#9cb6ae',major:'#e4f3eb',water:'#add8d7',green:'#95c1a8',type:'#fffcee',pin:'#c34f3f'}
 };
 function normName(){
  const all=window.FN_CHINA?.records||[],code=state.v36RegionCode;
  const local=all.find(a=>a[0]===code)?.[1]||state.cityLabel||'';
  const shorter=String(local).split(',')[0].split('·')[0].trim()
   .replace(/黎族苗族自治县|黎族自治县|蒙古族自治县|维吾尔自治区|特别行政区|自治区|自治县|自治州|县|市|省|区$/g,'').trim();
  const names={'陵水':'LINGSHUI','海口':'HAIKOU','三亚':'SANYA','上海':'SHANGHAI','黄浦':'HUANGPU',
   '西安':'XI’AN','雁塔':'YANTA','北京':'BEIJING','杭州':'HANGZHOU','香港':'HONG KONG','南京':'NANJING'};
  return names[shorter]||window.FIELDNOTES_STREETS?.displayEnglish?.(shorter)||shorter||'TRAVEL';
 }
 function precision(){
  const lat=Number(state.centerLat),lon=Number(state.centerLon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return'LOCATION UNAVAILABLE';
  const n=state.exact?4:2;
  return Math.abs(lat).toFixed(n)+'° '+(lat>=0?'N':'S')+'     '+Math.abs(lon).toFixed(n)+'° '+(lon>=0?'E':'W');
 }
 function status(){return state.exact?'PHOTO / USER GPS':'APPROX. REGIONAL CENTER';}
 function mapData(){return window.FIELDNOTES_V37_DEBUG?.getMap?.()||null;}
 function safePhoto(ctx,w,h){
  ctx.clearRect(0,0,w,h);
  v32DrawPhoto(ctx,0,0,w,h);
 }
 function adjustedFont(w,rel,min=10,max=58){return Math.max(min,Math.min(max,w*rel));}
 function bgLum(x,y){
  try{return typeof v35LocalBrightness==='function'?v35LocalBrightness(x,y):125}catch(_){return 125}
 }
 function text(ctx,s,x,y,size,color,opts={}){
  const dark=opts.dark||false;
  ctx.save();
  const family=opts.mono?'"Consolas","Courier New",monospace':opts.serif?'"Baskerville","Palatino Linotype",Georgia,serif':'"Segoe UI",Arial,sans-serif';
  ctx.font=(opts.italic?'italic ':'')+(opts.weight||400)+' '+Math.max(8,Math.round(size))+'px '+family;
  ctx.textBaseline='alphabetic';ctx.textAlign=opts.align||'left';
  ctx.shadowColor=dark?'rgba(250,253,247,.45)':'rgba(10,25,39,.24)';
  ctx.shadowBlur=Math.max(1,size*.12);
  ctx.fillStyle=color;
  const str=String(s);
  if(opts.spaced){
   const gap=opts.spaced*size,chars=Array.from(str),total=chars.reduce((n,c)=>n+ctx.measureText(c).width+gap,0)-gap;
   let at=opts.align==='right'?x-total:opts.align==='center'?x-total/2:x;
   for(const c of chars){ctx.fillText(c,at,y);at+=ctx.measureText(c).width+gap}
  }else ctx.fillText(str,x,y,opts.max||undefined);
  ctx.restore();
 }
 function rectMapPoint(p,rect,lat,lon,span){
  if(!p||!Number.isFinite(p[0])||!Number.isFinite(p[1]))return null;
  const meterX=111320*Math.cos(lat*Math.PI/180),mx=(p[0]-lon)*meterX,my=(lat-p[1])*111320;
  return [rect.x+rect.w/2+mx*rect.w/span,rect.y+rect.h/2+my*rect.w/span];
 }
 function protectedClip(ctx,w,h){
  const regions=state.v32Protected||[];
  if(!regions.length||typeof Path2D==='undefined')return;
  const mask=new Path2D();mask.rect(0,0,w,h);
  for(const r of regions)if(r.w>.015&&r.h>.015)mask.rect(r.x*w,r.y*h,r.w*w,r.h*h);
  ctx.clip(mask,'evenodd');
 }
 function outline(ctx,rect,ink,alpha){
  const get=window.FIELDNOTES_V36_TEST?.geometryFallback;
  const code=state.v36RegionCode,geom=code&&get?.(code)?.feature;
  if(!geom?.rings?.length)return false;
  const bounds=geom.bb,[a,b,c,d]=bounds;
  const cx=(a+c)/2,cy=(b+d)/2,cos=Math.cos(cy*Math.PI/180);
  const extent=Math.max((c-a)*cos,d-b,.01),scale=Math.min(rect.w*.85,rect.h*.85)/extent;
  ctx.save();ctx.strokeStyle=ink;ctx.globalAlpha=alpha;
  ctx.lineWidth=Math.max(.8,rect.w*.0018);ctx.lineJoin='round';
  ctx.beginPath();for(const ring of geom.rings){
   for(let i=0;i<ring.length;i++){const [x,y]=ring[i],px=rect.x+rect.w/2+(x-cx)*cos*scale,py=rect.y+rect.h/2-(y-cy)*scale;
    if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);
   }ctx.closePath();
  }ctx.stroke();ctx.restore();return true;
 }
 function trace(ctx,line,rect,loc,span,close){
  const pts=line;
  if(!pts||pts.length<2)return false;
  let started=false;
  ctx.beginPath();
  const step=pts.length>1200?Math.ceil(pts.length/1200):1;
  for(let j=0;j<pts.length;j+=step){
   const p=rectMapPoint(pts[j],rect,loc.lat,loc.lon,span);if(!p)continue;
   if(!started){ctx.moveTo(p[0],p[1]);started=true}else ctx.lineTo(p[0],p[1]);
  }
  if(close)ctx.closePath();
  return started;
 }
 const classify=kind=>['motorway','trunk','primary','secondary'].includes(kind)?2:
   ['tertiary','minor','street'].includes(kind)?1:0;
 function drawGeometry(ctx,rect,loc,style,params={}){
  const data=mapData(),span=params.span||10500,w=rect.w;
  if(!data||(!data.roads?.length&&!data.water?.length)){
   return outline(ctx,rect,style.road,params.alpha||.5)?'outline':'none';
  }
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  const roads=data.roads||[],water=data.water||[],river=data.river||[],parks=data.parks||[];
  const a=params.alpha===undefined?.75:params.alpha;
  if(params.water!==false){
   ctx.fillStyle=style.water;ctx.globalAlpha=a*(params.waterAlpha||.13);
   let drawn=0;
   for(const [,p] of water){
    if(!p||p.length<3)continue;
    if(trace(ctx,p,rect,loc,span,true)){ctx.fill();drawn++;}if(drawn>210)break;
   }
   ctx.strokeStyle=style.water;ctx.lineWidth=Math.max(.75,w*.0016);ctx.globalAlpha=a*.46;
   for(const [,p]of river)if(trace(ctx,p,rect,loc,span,false))ctx.stroke();
  }
  if(params.parks){
   ctx.fillStyle=style.green;ctx.globalAlpha=a*.11;
   for(const [,p]of parks)if(trace(ctx,p,rect,loc,span,true))ctx.fill();
  }
  if(params.roads!==false){
   for(let phase=0;phase<3;phase++){
    const budget=params.budget||3500,step=Math.max(1,Math.floor(roads.length/budget));
    for(let i=phase;i<roads.length;i+=3*step){
     const [cls,points]=roads[i];
     const category=classify(cls);
     if(params.majorOnly&&category<2)continue;
     if(params.minorOnly&&category>0)continue;
     if(params.coast&&category<2&&i%5!==0)continue;
     if(!trace(ctx,points,rect,loc,span,false))continue;
     ctx.strokeStyle=category===2?style.major:style.road;
     ctx.lineWidth=Math.max(.40,w*(category===2?.0018:category===1?.00094:.00048));
     ctx.globalAlpha=a*(category===2?.80:category===1?.50:.26)*(params.roadFactor||1);
     ctx.stroke();
    }
   }
  }
  ctx.restore();return'detailed';
 }
 function dot(ctx,x,y,w,c){
  const r=Math.max(3.1,w*.004);
  ctx.save();ctx.beginPath();ctx.arc(x,y,r+Math.max(1,w*.0016),0,Math.PI*2);ctx.fillStyle='#fefbf2';ctx.fill();
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();ctx.restore();
 }
 function scale(ctx,x,y,w,rect,span,ink){
  const distance=span<6500?500:span<14000?2000:5000;
  const px=Math.min(w*.19,rect.w*distance/span),u=Math.max(.7,w*.001);
  ctx.save();ctx.strokeStyle=ink;ctx.globalAlpha=.75;ctx.lineWidth=u;ctx.beginPath();
  ctx.moveTo(x,y);ctx.lineTo(x+px,y);ctx.moveTo(x,y-4*u);ctx.lineTo(x,y+4*u);
  ctx.moveTo(x+px,y-4*u);ctx.lineTo(x+px,y+4*u);ctx.stroke();ctx.restore();
  text(ctx,'0',x,y-5*u,adjustedFont(w,.009,8,12),ink,{mono:true});
  text(ctx,(distance/1000)+' km',x+px,y-5*u,adjustedFont(w,.009,8,12),ink,{mono:true,align:'right'});
 }
 function north(ctx,x,y,w,ink){
  const u=w*.0012;ctx.save();ctx.strokeStyle=ink;ctx.lineWidth=Math.max(.8,u);ctx.globalAlpha=.8;
  ctx.beginPath();ctx.moveTo(x,y+12*u);ctx.lineTo(x,y-16*u);ctx.lineTo(x-5*u,y+1*u);ctx.moveTo(x,y-16*u);ctx.lineTo(x+5*u,y+1*u);ctx.stroke();ctx.restore();
  text(ctx,'N',x,y-24*u,adjustedFont(w,.010,9,15),ink,{mono:true,align:'center'});
 }
 function layer(w,h){
  const cv=document.createElement('canvas'),fac=Math.min(1,1550/w);
  cv.width=Math.max(1,Math.round(w*fac));cv.height=Math.max(1,Math.round(h*fac));
  const k=cv.getContext('2d',{alpha:true});if(!k)return null;
  k.scale(fac,fac);return{canvas:cv,ctx:k};
 }
 function transfer(ctx,from,w,h,mask){
  if(!from)return;
  const g=from.ctx;g.save();g.globalCompositeOperation='destination-in';
  if(mask==='sky'){
   const l=g.createLinearGradient(0,0,0,h*.60);
   l.addColorStop(0,'rgba(0,0,0,.88)');l.addColorStop(.52,'rgba(0,0,0,1)');
   l.addColorStop(.82,'rgba(0,0,0,.32)');l.addColorStop(1,'rgba(0,0,0,0)');
   g.fillStyle=l;g.fillRect(0,0,w,h);
   const x=g.createLinearGradient(0,0,w,0);
   x.addColorStop(0,'rgba(0,0,0,.95)');x.addColorStop(.54,'rgba(0,0,0,.82)');
   x.addColorStop(1,'rgba(0,0,0,.10)');
   g.fillStyle=x;g.fillRect(0,0,w,h);
  }else if(mask==='coastal'){
   const r=g.createRadialGradient(w*.70,h*.18,w*.035,w*.70,h*.18,w*.66);
   r.addColorStop(0,'rgba(0,0,0,.92)');r.addColorStop(.55,'rgba(0,0,0,.81)');
   r.addColorStop(.78,'rgba(0,0,0,.25)');r.addColorStop(1,'rgba(0,0,0,0)');
   g.fillStyle=r;g.fillRect(0,0,w,h);
  }else if(mask==='blueprint'){
   const g1=g.createLinearGradient(w*.50,0,w*.97,0);
   g1.addColorStop(0,'rgba(0,0,0,0)');g1.addColorStop(.45,'rgba(0,0,0,.74)');g1.addColorStop(1,'rgba(0,0,0,.96)');
   g.fillStyle=g1;g.fillRect(0,0,w,h);
  }else if(mask==='night'){
   const r=g.createRadialGradient(w*.7,h*.16,w*.04,w*.7,h*.16,w*.76);
   r.addColorStop(0,'rgba(0,0,0,.96)');r.addColorStop(.64,'rgba(0,0,0,.78)');
   r.addColorStop(1,'rgba(0,0,0,0)');
   g.fillStyle=r;g.fillRect(0,0,w,h);
  }else if(mask==='journal'){
   const t=g.createLinearGradient(0,0,0,h*.48);
   t.addColorStop(0,'rgba(0,0,0,.84)');t.addColorStop(.58,'rgba(0,0,0,.55)');t.addColorStop(1,'rgba(0,0,0,0)');
   g.fillStyle=t;g.fillRect(0,0,w,h);
  }
  g.restore();ctx.drawImage(from.canvas,0,0,w,h);
 }
 function commonPhoto(ctx,w,h){
  ctx.clearRect(0,0,w,h);
  v32DrawPhoto(ctx,0,0,w,h);
 }
 function commonLabels(ctx,w,h,name,kind,style){
  const namefont=Math.min(67,adjustedFont(w,w>h?.043:.049,23,66));
  const x=w*.050,y=h*.085,white=bgLum(.09,.08)<170;
  const ink=(kind==='journal'&&bgLum(.75,.08)>167)?'#283c40':(white?style.type:'#283c40');
  text(ctx,name,x,y,namefont,ink,{serif:true,weight:400,spaced:0.045,max:w*.58});
  text(ctx,'CHINA  /  TRAVEL COORDINATES',x,y+namefont*.67,adjustedFont(w,.012,9,17),ink,{spaced:.16});
  text(ctx,precision(),x,y+namefont*1.20,adjustedFont(w,.011,10,16),ink,{mono:true});
  text(ctx,status(),x,y+namefont*1.54,adjustedFont(w,.009,8,12),ink,{mono:true});
 }
 function render(ctx,w,h,kind,options={}){
  const loc={lon:Number(state.centerLon),lat:Number(state.centerLat)},
        name=normName(),style=palette[kind];
  if(!style||!Number.isFinite(loc.lat)||!Number.isFinite(loc.lon))return oldPaint(ctx,w,h,options);
  commonPhoto(ctx,w,h);
  const light=bgLum(.09,.09)>174;const textInk=light?'#2a4954':style.type;
  const span=state.exact?5100:(state.v36RegionCode?.endsWith('00')?15500:10500);
  const l=layer(w,h);if(!l)return;
  const g=l.ctx;protectedClip(g,w,h);
  let rect,mode=kind,geo='';
  if(kind==='sky'){
   rect={x:0,y:0,w:w*.97,h:h*.49};
   geo=drawGeometry(g,rect,loc,style,{alpha:.90,span,parks:true});
   transfer(ctx,l,w,h,'sky');
   commonLabels(ctx,w,h,name,kind,style);
   north(ctx,w*.925,h*.055,w,textInk);scale(ctx,w*.73,h*.138,w,rect,span,textInk);
   if(geo==='detailed')dot(ctx,rect.x+rect.w*.50,rect.y+rect.h*.50,w,style.pin);
  }else if(kind==='coastal'){
   // A corner-integrated marine cartogram: waterways + genuine water polygons, sparse roads.
   rect={x:w*.34,y:-h*.030,w:w*.80,h:h*.53};
   const ink=palette.coastal;
   geo=drawGeometry(g,rect,loc,ink,{alpha:.98,span:span*1.20,roads:false,waterAlpha:.52,parks:true});
   transfer(ctx,l,w,h,'coastal');
   const a=bgLum(.18,.095)>175?'#244c54':'#fff9e7';
   text(ctx,name,w*.05,h*.095,adjustedFont(w,.053,22,64),a,{serif:true,italic:true,spaced:.06,max:w*.6});
   text(ctx,'COAST & WATER  •  GEOGRAPHICAL RECORD',w*.051,h*.12,adjustedFont(w,.012,9,16),a,{spaced:.13,max:w*.62});
   text(ctx,precision(),w*.051,h*.165,adjustedFont(w,.012,10,16),a,{mono:true});
   text(ctx,status(),w*.051,h*.185,adjustedFont(w,.009,9,13),a,{mono:true});
   north(ctx,w*.91,h*.046,w,a);scale(ctx,w*.72,h*.109,w,rect,span*1.18,a);
   if(geo==='detailed')dot(ctx,rect.x+rect.w*.5,rect.y+rect.h*.5,w,style.pin);
  }else if(kind==='minimal'){
   // Photography-forward compact cartographic seal. No full-screen road overlay.
   const radius=Math.min(w*.155,h*.160),cx=w*.80,cy=h*.165;
   ctx.save();ctx.fillStyle=light?'rgba(250,251,248,.56)':'rgba(18,47,54,.40)';
   ctx.beginPath();ctx.arc(cx,cy,radius+8*w/1000,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle=light?'rgba(46,74,81,.5)':'rgba(241,245,236,.63)';
   ctx.lineWidth=Math.max(1,w*.0012);ctx.stroke();ctx.restore();
   g.save();g.beginPath();g.arc(cx,cy,radius,0,Math.PI*2);g.clip();
   rect={x:cx-radius,y:cy-radius,w:radius*2,h:radius*2};
   geo=drawGeometry(g,rect,loc,style,{alpha:.85,span:span*.8,roadFactor:.85,waterAlpha:.20});
   g.restore();ctx.drawImage(l.canvas,0,0,w,h);
   ctx.save();ctx.strokeStyle=light?'#486d78':'#edf4ed';ctx.globalAlpha=.72;
   ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();ctx.restore();
   if(geo==='detailed')dot(ctx,cx,cy,w,style.pin);
   const c=light?'#243e47':'#fafbf3';
   text(ctx,name,w*.052,h*.088,adjustedFont(w,.054,21,60),c,{serif:true,italic:true,max:w*.53});
   text(ctx,'F I E L D N O T E S   /   0 1',w*.054,h*.126,adjustedFont(w,.011,9,15),c,{mono:true});
   text(ctx,precision(),w*.054,h*.166,adjustedFont(w,.012,10,16),c,{mono:true});
   text(ctx,status(),w*.054,h*.189,adjustedFont(w,.010,9,13),c,{mono:true});
  }else if(kind==='nocturne'){
   // A nighttime contrast family: gold major roads, dark translucent vignette.
   ctx.save();const grd=ctx.createLinearGradient(0,0,0,h*.55);
   grd.addColorStop(0,'rgba(5,18,35,.36)');grd.addColorStop(.75,'rgba(5,18,35,.19)');
   grd.addColorStop(1,'rgba(5,18,35,0)');ctx.fillStyle=grd;ctx.fillRect(0,0,w,h*.55);ctx.restore();
   rect={x:w*.20,y:-h*.10,w:w*.98,h:h*.54};
   geo=drawGeometry(g,rect,loc,style,{alpha:.83,span:span*1.06,majorOnly:true,roadFactor:.77,waterAlpha:.06});
   transfer(ctx,l,w,h,'night');
   text(ctx,'N O C T U R N E   /   '+name,w*.050,h*.076,adjustedFont(w,.015,10,21),'#f5d7a9',{mono:true,max:w*.80});
   text(ctx,precision(),w*.050,h*.107,adjustedFont(w,.012,9,16),'#ffe5b7',{mono:true});
   text(ctx,status(),w*.050,h*.128,adjustedFont(w,.009,8,12),'#d6bd90',{mono:true});
   north(ctx,w*.92,h*.058,w,'#f5dfad');scale(ctx,w*.69,h*.144,w,rect,span,'#f5dfad');
   if(geo==='detailed')dot(ctx,rect.x+rect.w*.50,rect.y+rect.h*.50,w,style.pin);
  }else if(kind==='blueprint'){
   // True internal atlas column, not a second external rectangular photograph.
   rect={x:w*.56,y:h*.035,w:w*.43,h:h*.56};
   geo=drawGeometry(g,rect,loc,style,{alpha:.98,span:span*.76,waterAlpha:.12,roadFactor:1.13});
   transfer(ctx,l,w,h,'blueprint');
   // Deliberately technical grid, not a fabricated street map.
   ctx.save();ctx.beginPath();ctx.rect(w*.60,h*.014,w*.38,h*.48);ctx.clip();
   ctx.strokeStyle='#cce9e4';ctx.globalAlpha=.16;ctx.lineWidth=Math.max(.5,w*.00056);
   for(let i=0;i<=12;i++){const x=w*(.60+i*.38/12);ctx.beginPath();ctx.moveTo(x,h*.016);ctx.lineTo(x,h*.49);ctx.stroke();}
   for(let j=0;j<=8;j++){const y=h*(.016+j*.474/8);ctx.beginPath();ctx.moveTo(w*.60,y);ctx.lineTo(w*.98,y);ctx.stroke();}ctx.restore();
   ctx.save();const grad=ctx.createLinearGradient(w*.62,0,w,0);
   grad.addColorStop(0,'rgba(15,71,100,0)');grad.addColorStop(1,'rgba(7,63,104,.13)');
   ctx.fillStyle=grad;ctx.fillRect(w*.62,0,w*.38,h*.52);ctx.restore();
   text(ctx,'GEO  /  '+name,w*.055,h*.078,adjustedFont(w,.030,16,43),'#f6faf8',{mono:true,spaced:.1,max:w*.65});
   text(ctx,'GEOGRAPHY  /  FIELD SURVEY',w*.055,h*.109,adjustedFont(w,.010,9,14),'#e8f5f5',{mono:true});
   text(ctx,precision(),w*.055,h*.146,adjustedFont(w,.012,10,16),'#fbffff',{mono:true});
   text(ctx,status(),w*.055,h*.170,adjustedFont(w,.009,9,12),'#f1f7f7',{mono:true});
   north(ctx,w*.90,h*.059,w,'#fff');if(geo==='detailed')dot(ctx,rect.x+rect.w*.5,rect.y+rect.h*.5,w,style.pin);
  }else if(kind==='journal'){
   // Editorial travel issue. Sparse real major roads as background, no extra canvas mat.
   rect={x:w*.005,y:0,w:w*.63,h:h*.38};
   geo=drawGeometry(g,rect,loc,style,{alpha:.48,span:span*1.08,majorOnly:true,roadFactor:.34,waterAlpha:.09});
   transfer(ctx,l,w,h,'journal');
   const ink=bgLum(.87,.08)>173?'#24434a':'#fcf5e6';
   const rx=w*.948;
   text(ctx,'F I E L D   J O U R N A L   /   0 1',rx,h*.062,adjustedFont(w,.011,9,16),ink,{mono:true,align:'right'});
   text(ctx,name,rx,h*.132,adjustedFont(w,.062,22,66),ink,{serif:true,italic:true,align:'right',max:w*.58});
   ctx.save();ctx.strokeStyle=ink;ctx.globalAlpha=.45;ctx.lineWidth=Math.max(.7,w*.0009);ctx.beginPath();ctx.moveTo(w*.62,h*.153);ctx.lineTo(rx,h*.153);ctx.stroke();ctx.restore();
   text(ctx,precision(),rx,h*.181,adjustedFont(w,.012,10,16),ink,{mono:true,align:'right'});
   text(ctx,status(),rx,h*.208,adjustedFont(w,.010,9,14),ink,{mono:true,align:'right'});
   if(geo==='detailed')dot(ctx,rect.x+rect.w*.50,rect.y+rect.h*.50,w,style.pin);
  }
  // Dataset attribution is visible only when street geometry is actually displayed.
  if(geo==='detailed'){
   const small=adjustedFont(w,.008,8,13);
   text(ctx,'MAP © OpenMapTiles / © OpenStreetMap',w*.985,h*.979,small,bgLum(.94,.94)>165?'#23424e':'#f4f5ef',{align:'right',mono:true});
  }
  renderCalls++;
 }
 const styles=[
  ['sky','Sky Atlas','天空与街网自然融合'],
  ['coastal','Coast & Water','水系地图与柔和地理层'],
  ['minimal','Pure Coordinates','相片优先 · 小型地图坐标章'],
  ['nocturne','Night Cartography','金色路网 · 暗色夜航'],
  ['blueprint','Urban Blueprint','镜头内侧的城市蓝图'],
  ['journal','Field Journal','杂志字号与细线地理档案']
 ];
 window.FIELDNOTES_V37_PLAN=function({round=0,feedback='balanced'}={}){
  const group=((round%2)+2)%2;
  let trio=styles.slice(group*3,group*3+3);
  const ordered=ids=>ids.map(id=>styles.find(x=>x[0]===id));
  if(feedback==='original')trio=ordered(['minimal','journal','coastal']);
  else if(feedback==='editorial')trio=ordered(['journal','minimal','blueprint']);
  else if(feedback==='map')trio=ordered(['sky','coastal','blueprint']);
  else if(feedback==='soft')trio=ordered(['minimal','coastal','journal']);
  return trio.map((t,i)=>({
   label:('0'+(i+1))+' · '+t[1],desc:t[2],kind:'p1',
   cfg:{p1Kind:t[0],v37Preset:null,
    v35Sidecar:false,frameMode:false,v32NoMap:false,v32Micro:false,
    v32Tone:'original',v32Exposure:0,v32Contrast:0,v32Saturation:0,v32Warm:0,
    guides:false,viewMode:'province',styleMode:'light',opacity:100,area:19,wash:0,typeScale:100}
  }));
 };
 paint=function(ctx,w,h,options={}){
  if(!visibleIds.has(state.p1Kind))return oldPaint(ctx,w,h,options);
  const name=state.p1Kind;render(ctx,w,h,name,options);
 };
 window.FIELDNOTES_P1={styles,paintCount:()=>renderCalls,getLocation:()=>({name:normName(),precision:precision(),accurate:state.exact}),coverage:()=>({roads:mapData()?.roads?.length||0,water:mapData()?.water?.length||0}),plan:window.FIELDNOTES_V37_PLAN};
})();
