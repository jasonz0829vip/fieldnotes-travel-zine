/* FIELDNOTES V3.6 — offline location hierarchy and one-click three-photo compositions.
   Source datasets are separate from photo content. No generative image editing is performed. */
(()=>{
'use strict';
const $36=id=>document.getElementById(id);
const src=window.FN_CHINA,countyDB=window.FN_CHINA_COUNTIES;
if(!src||!countyDB){const el=$36('v36Status');if(el)el.textContent='全国离线地图库未加载，请保持全部文件在同一文件夹中。';return;}
const records=src.records.map(([code,name])=>({code,name,level:code.endsWith('0000')?'province':code.endsWith('00')?'city':'county'}));
const byCode=new Map(records.map(r=>[r.code,r]));
const decoded=new Map(),variants=[];
let chosen=null,drawRound=0,feedback='balanced',generating=false,lastPhotoToken=0,selected=0;
function dataFor(code){return src.geometry[code]||countyDB[code]||null;}
function decode(s){let i=0,x=0,y=0,points=[];
 while(i<s.length){const read=()=>{let shift=0,result=0,b=0;do{if(i>=s.length)throw Error('invalid polyline');b=s.charCodeAt(i++)-63;result|=(b&31)<<shift;shift+=5;}while(b>=32&&shift<=35);return result&1?~(result>>1):result>>1;};x+=read();y+=read();points.push([x/1000,y/1000]);}
 return points;
}
function asFeature(code){
 if(decoded.has(code))return decoded.get(code);
 const a=dataFor(code);if(!a)return null;
 try{const rings=a[2].map(decode).filter(r=>r.length>=4);if(!rings.length)return null;
 let minX=180,maxX=-180,minY=90,maxY=-90;
 for(const ring of rings)for(const p of ring){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
 const f={name:byCode.get(code)?.name||'',code,center:[a[0]/1000,a[1]/1000],bb:[minX,minY,maxX,maxY],rings};decoded.set(code,f);return f;
 }catch(e){console.error('Geometry decode failure',code,e);return null;}
}
function geometryFallback(code){
 if(!code)return null;
 const tries=[code];if(!code.endsWith('0000')){if(!code.endsWith('00'))tries.push(code.slice(0,4)+'00');tries.push(code.slice(0,2)+'0000');}
 for(const candidate of tries){const f=asFeature(candidate);if(f)return{feature:f,code:candidate,approx:candidate!==code};}
 return null;
}
function parentOf(r){
 const p=byCode.get(r.code.slice(0,2)+'0000');if(r.level==='province')return'中国';if(r.level==='city')return p?.name||'中国';
 const c=byCode.get(r.code.slice(0,4)+'00');return[c?.name,p?.name].filter(Boolean).join(' · ')||'中国';
}
function clean(s){return String(s||'').normalize('NFKC').trim().toLowerCase().replace(/[\s,，·、./]/g,'');}
function stem(s){return clean(s).replace(/特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|自治州|自治县|黎族|苗族|土家族|蒙古族|省|地区|盟|市|区|县|旗/g,'');}
function rank(query){
 const q=clean(query);if(!q)return [];
 const q0=stem(q),results=[];
 for(const r of records){
  const name=clean(r.name),short=stem(r.name);
  if(!name)continue;
  const full=q===name,shortExact=q===short;
  const containsName=q.includes(name),endsName=q.endsWith(name);
  const validShort=short.length>=2;
  const containsShort=validShort&&q.includes(short),endsShort=validShort&&q.endsWith(short);
  const startsName=name.startsWith(q),startsShort=validShort&&short.startsWith(q0)&&q0.length>=2;
  if(!(full||shortExact||containsName||containsShort||startsName||startsShort))continue;
  let score=full?540:shortExact?500:endsName?425:endsShort?370:containsName?200:containsShort?115:startsName?80:45;
  score+=Math.min(25,short.length*5);
  const province=byCode.get(r.code.slice(0,2)+'0000');
  const city=byCode.get(r.code.slice(0,4)+'00');
  if(province&&province!==r){const ps=stem(province.name);if(ps.length>=2&&q.includes(ps))score+=120;}
  if(city&&city!==r&&city!==province){const cs=stem(city.name);if(cs.length>=2&&q.includes(cs))score+=95;}
  if(r.level==='county')score+=6;else if(r.level==='city')score+=3;
  results.push({r,score});
 }
 return results.sort((a,b)=>b.score-a.score||a.r.name.localeCompare(b.r.name,'zh')).slice(0,10).map(x=>x.r);
}
function status(text,error=false){const el=$36('v36Status');if(el){el.textContent=text;el.classList.toggle('v36-warn',error);}}
function applyRecord(r){
 if(!r)return false;const geo=geometryFallback(r.code);chosen=r;
 const text=[r.name,parentOf(r)].filter(x=>x&&x!=='中国').join(', ');
 $36('v36Location').value=r.name;$36('v36Choices').hidden=true;
 $36('placeName').value=text;$36('latInput').value='';$36('lonInput').value='';
 state.v36RegionCode=r.code;state.cityLabel=text;state.exact=false;state.gpsFromPhoto=false;state.locationSource='city';
 state.viewMode='province';state.atlas=true;state.pin=!!geo&&!geo.approx;
 if(geo){state.centerLon=geo.feature.center[0];state.centerLat=geo.feature.center[1];
  const note=geo.approx?'已选择 '+r.name+'；该层级没有匹配的真实边界，使用 '+(byCode.get(geo.code)?.name||'上级区域')+' 的轮廓，不绘制虚假的区县红点。':'已选择 '+r.name+'（'+parentOf(r)+'），使用该层级的真实行政边界；标记仅代表大致区域。';
  setNotice(note,geo.approx?'warn':'success');setPrecision(note,geo.approx);status(note,geo.approx);
 }else{state.centerLon=null;state.centerLat=null;state.pin=false;status('已识别 '+r.name+'，但该区域暂无可用边界，不会伪造地图。',true);}
 $36('v36Chosen').textContent='定位层级：'+(r.level==='province'?'省级':r.level==='city'?'市级':'区县级')+' · '+r.name;
 schedule();return true;
}
function syncRegionFromGPS(){
 if(state.centerLat==null||state.centerLon==null)return;
 $36('v36Chosen').textContent='照片 GPS '+state.centerLat.toFixed(4)+'°N · '+state.centerLon.toFixed(4)+'°E（设备记录）';
 status('已使用照片 EXIF 中的 GPS。如需改为省、市或区县，可以手动搜索。');
}
const formerSync=syncLocation;
syncLocation=function(){
 const a=$36('latInput').value.trim(),b=$36('lonInput').value.trim();
 if(a&&b){state.v36RegionCode=null;chosen=null;const ok=formerSync();syncRegionFromGPS();return ok;}
 const typed=$36('placeName').value.trim();const r=chosen&&typed.includes(chosen.name)?chosen:rank(typed)[0];
 if(r)return applyRecord(r);
 return formerSync();
};
const priorProvince=v3Province;
v3Province=function(){if(state.v36RegionCode){const match=geometryFallback(state.v36RegionCode);if(match)return match.feature;}return priorProvince();};
const priorTitle=v3TitleParts;
v3TitleParts=function(){if(state.v36RegionCode){const r=byCode.get(state.v36RegionCode);if(r){const p=parentOf(r).split(' · ');return[r.name,p[0]||'中国',p[1]||'中国'];}}return priorTitle();};
function showSuggestions(q){
 const box=$36('v36Choices');box.replaceChildren();const matches=rank(q);
 if(!q||!matches.length){box.hidden=true;return;}
 const frag=document.createDocumentFragment();
 for(const r of matches){const b=document.createElement('button');b.type='button';b.className='v36-suggest';
  const label=document.createElement('b');label.textContent=r.name;const meta=document.createElement('small');meta.textContent=parentOf(r)+(dataFor(r.code)?' · 有真实边界':' · 上级边界');
  b.append(label,meta);b.addEventListener('click',()=>{applyRecord(r);$36('v36Location').blur();});frag.append(b);}
 box.append(frag);box.hidden=false;
}
function waitPhoto(file){
 const token=++lastPhotoToken,oldImage=state.image;let elapsed=0;
 const tick=()=>{if(token!==lastPhotoToken)return;
  if(state.image&&state.image!==oldImage&&state.photoName===file.name){photoLoaded();return;}
  if(elapsed++<120)setTimeout(tick,120);else status('照片读取未完成，请重试或检查照片格式。',true);
 };setTimeout(tick,150);
}
function photoLoaded(){
 $36('v36Picture').hidden=false;$36('v36Initial').hidden=true;
 const c=$36('v36Original'),w=680,h=Math.round(w*state.photoH/state.photoW);c.width=w;c.height=h;c.getContext('2d').drawImage(state.image,0,0,w,h);
 $36('v36Filename').textContent=state.photoName+' · '+state.photoW+' × '+state.photoH;
 status('照片已载入。确认拍摄地区后，一键生成三种真实排版。');
 $36('v36Results').hidden=true;variants.length=0;drawRound=0;
 if(state.gpsFromPhoto)syncRegionFromGPS();
 else{const p=$36('v36Location').value.trim();if(p){const hit=rank(p)[0];if(hit)applyRecord(hit);}}
}
const keys=['v35Sidecar','v32NoMap','v32Micro','frameMode','styleMode','theme','area','opacity','wash','typeScale','posX','posY','v32BeforePreview','guides','rotation','v32Tone','v32Exposure','v32Contrast','v32Saturation','v32Warm','viewMode'];
function snapshot(){return Object.fromEntries(keys.map(k=>[k,state[k]]));}
function configure(o){Object.assign(state,o);state.guides=false;state.v32BeforePreview=false;}
function dimsFor(){return state.v35Sidecar?v35PanelDims():state.frameMode?v31FrameDims():{w:state.photoW,h:state.photoH};}
function drawVariant(c,cfg,width){
 const old=snapshot();try{configure(cfg);const d=dimsFor(),W=Math.round(width),H=Math.max(70,Math.round(W*d.h/d.w));
  c.width=W;c.height=H;paint(c.getContext('2d'),W,H,{preview:false});return[W,H];
 }finally{Object.assign(state,old);}
}
function planConfigs(){
 const a=state.v32Analysis||v32Analyze({keepChoice:true});
 const busy=!a||a.texture>32||a.lowTexture>33;const spot=a?.best||{x:.30,y:.65},round=drawRound%5;
 const colors=['ivory','ink','blue','sage','rose'];
 const safe=feedback==='original'||feedback==='outside',mapArea=feedback==='map'?22:feedback==='original'?9:14;
 const recommended=busy||feedback==='outside'?'sidecar':'light';
 const shared={posX:spot.x,posY:spot.y,opacity:feedback==='original'?73:90,wash:feedback==='original'?0:15,typeScale:101,rotation:0};
 const make=(label,desc,kind,mode,theme,area)=>({label,desc,kind,cfg:{...shared,v35Sidecar:kind==='sidecar',v32NoMap:kind==='clean',v32Micro:kind==='light',frameMode:kind==='frame',styleMode:mode,theme,area,viewMode:'province'}});
 const A=make('01 · 推荐','照片优先 · 降低视觉干扰',recommended,'light',colors[round],mapArea);
 const B=make('02 · 杂志','地理版头 · 原片完整保留',safe?'sidecar':'frame',feedback==='editorial'?'editorial':'minimal',colors[(round+1)%5],17);
 const C=make('03 · 创意','旅行印刷感 · 设计更鲜明',feedback==='outside'?'sidecar':feedback==='original'?'clean':'poster','postcard',colors[(round+2)%5],feedback==='map'?25:19);
 if(feedback==='original')C.desc='极简纯照片 · 不强加地图';
 return[A,B,C];
}
function selectVariant(i){
 if(!variants[i])return;selected=i;const v=variants[i];for(const [j,btn] of [...$36('v36Options').children].entries())btn.classList.toggle('active',j===i);
 configure(v.cfg);state.v32Variant=v.kind==='frame'?'frame':'light';
 $36('v36SelectedLabel').textContent=v.label+' · '+v.desc;
 drawVariant($36('v36Hero'),v.cfg,Math.min(1100,Math.max(660,Math.round(state.photoW*.75))));schedule();
}
function generate(){
 if(generating)return;
 if(!state.image){status('请先拍照或上传照片。',true);return;}
 const q=$36('v36Location').value.trim();
 if(q&&(!chosen||chosen.name!==q)){const matches=rank(q);if(matches.filter(r=>clean(r.name)===clean(q)).length>1){status('这个地名在多个城市存在，请先在建议列表中选择正确的省市。',true);showSuggestions(q);return;}const r=matches[0];if(r)applyRecord(r);else{status('地名未能离线识别，请改用省、市或区县名称。',true);return;}}
 if(!chosen&&(state.centerLat==null||state.centerLon==null)){status('还缺拍摄地点。可以只填省，不要求填写市或区。',true);$36('v36Location').focus();return;}
 generating=true;$36('v36Generate').disabled=true;
 try{
  if($36('v36AutoTone').checked){if(state.v32Analysis)v32AutoTone();}else v32SetTone('original');
  variants.splice(0,variants.length,...planConfigs());const out=$36('v36Options');out.replaceChildren();
  variants.forEach((o,i)=>{const btn=document.createElement('button');btn.type='button';btn.className='v36-option';
   const canvas=document.createElement('canvas'),label=document.createElement('b'),caption=document.createElement('small');label.textContent=o.label;caption.textContent=o.desc;
   btn.append(canvas,label,caption);out.append(btn);drawVariant(canvas,o.cfg,480);btn.addEventListener('click',()=>selectVariant(i));});
  $36('v36Results').hidden=false;selectVariant(0);
  status('已生成第 '+(drawRound+1)+' 组：3 种真实本地合成。原照片未重画，地理精度按数据标注。');
  $36('v36Results').scrollIntoView({block:'start',behavior:'smooth'});
 }catch(e){status('合成失败：'+e.message,true);console.error(e);}finally{generating=false;$36('v36Generate').disabled=false;}
}
function regenerate(reason){
 feedback=reason;drawRound++;const messages={balanced:'替换构图与地图配色',original:'更多保留原片',editorial:'增强杂志感',outside:'地图放照片外',soft:'更柔和的配色',map:'地图更明显'};
 $36('v36Feedback').textContent='当前方向：'+(messages[reason]||messages.balanced);
 if(reason==='soft')feedback='balanced';
 generate();
}
function init(){
 $36('v36Upload').addEventListener('click',()=>$36('photoFile').click());
 $36('v36Camera').addEventListener('click',()=>$36('v36CameraInput').click());
 $36('v36CameraInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;photoFile(f);waitPhoto(f);e.target.value='';});
 $36('photoFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)waitPhoto(f);});
 // Watch the existing editor's photo metadata, so first import works even if the legacy handler runs before this listener.
 let lastShownImage=null;
 new MutationObserver(()=>{if(state.image&&state.image!==lastShownImage){lastShownImage=state.image;photoLoaded();}})
  .observe($36('photoMeta'),{childList:true,subtree:true,characterData:true});
 const loc=$36('v36Location');
 loc.addEventListener('input',()=>{chosen=null;showSuggestions(loc.value);$36('v36Chosen').textContent='可只输入省、市或区县；从建议中选择可避免重名误匹配。';});
 loc.addEventListener('focus',()=>showSuggestions(loc.value));
 $36('v36LocationClear').addEventListener('click',()=>{loc.value='';chosen=null;state.v36RegionCode=null;showSuggestions('');loc.focus();});
 $36('v36Generate').addEventListener('click',()=>{drawRound=0;feedback='balanced';generate();});
 $36('v36Regenerate').addEventListener('click',()=>regenerate('balanced'));
 for(const b of document.querySelectorAll('[data-v36feedback]'))b.addEventListener('click',()=>regenerate(b.dataset.v36feedback));
 $36('v36Save').addEventListener('click',()=>{if(!variants[selected])return status('请先一键生成作品。',true);$36('v33DockExport').click();});
 $36('v36Advanced').addEventListener('click',()=>{document.body.classList.remove('v36-basic');document.body.classList.add('v36-advanced');resizePreview();schedule();document.querySelector('.layout')?.scrollIntoView({block:'start'});});
 $36('v36BackButton').addEventListener('click',()=>{document.body.classList.remove('v36-advanced');document.body.classList.add('v36-basic');$36('v36Flow').scrollIntoView({block:'start'});});
 $36('v36AtlasCount').textContent='离线内置 '+src.stats.province+' 省级、'+src.stats.city+' 市级、'+src.stats.county+' 区县级地名；真实轮廓 '+src.stats.province+' 省级、'+src.stats.geoCity+' 市级、'+src.stats.geoCounty+' 区县级。';
 status('第一步拍照或上传。地点可以只选省级；所有照片均在设备本地处理。');
}
init();
window.FIELDNOTES_V36_TEST={rank,applyRecord,asFeature,geometryFallback,generate,regenerate,getSelected:()=>selected,getVariants:()=>variants,coverage:src.stats,recordsCount:records.length};
})();

// BRIDGE_SYNC_V36
