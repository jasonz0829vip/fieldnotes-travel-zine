/* FIELDNOTES V3.6 — offline location hierarchy and one-click three-photo compositions.
   Source datasets are separate from photo content. No generative image editing is performed. */
(()=>{
'use strict';
const $36=id=>document.getElementById(id);
const src=window.FN_CHINA,countyDB=window.FN_CHINA_COUNTIES;
if(!src||!countyDB){const el=$36('v36Status');if(el)el.textContent='全国离线地图库未加载，请保持全部文件在同一文件夹中。';return;}
const records=src.records.map(([code,name])=>({code,name,level:code.endsWith('0000')?'province':code.endsWith('00')?'city':'county'}));
const byCode=new Map(records.map(r=>[r.code,r]));
const decoded=new Map(),variants=[],batchCache=new Map();
let cachedSignature='',mapPromptSerial=0,offeredMap=null;
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
  // Prefer a province when its abbreviated name collides with a district or city (e.g. 海南省 vs 海南区).
  if(r.level==='province'&&shortExact)score+=90;
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

function invalidatePreviews(){
 batchCache.clear();cachedSignature='';
 if($36('v36Results'))$36('v36Results').hidden=true;
}
function resetMapPrompt(){
 mapPromptSerial++;offeredMap=null;
 const panel=$36('v39MapOffer'),buttons=$36('v39MapActions');
 if(panel)panel.hidden=true;
 if(buttons)buttons.hidden=true;
}
function mapPrompt(text,kind,withButtons=false){
 const panel=$36('v39MapOffer'),message=$36('v39MapMessage'),actions=$36('v39MapActions');
 if(!panel||!message||!actions)return;
 panel.hidden=false;panel.dataset.kind=kind;
 message.textContent=text;actions.hidden=!withButtons;
}
async function checkLocalMap(record=null,levelOverride=null){
 const ticket=++mapPromptSerial;
 const manager=window.FIELDNOTES_PACK_MANAGER;
 const lon=state.centerLon,lat=state.centerLat;
 offeredMap=null;
 if(lon==null||lat==null||!Number.isFinite(Number(lon))||!Number.isFinite(Number(lat))){
  resetMapPrompt();return;
 }
 if(!manager?.matchLocation){
  mapPrompt('已准备基础地理轮廓，可直接生成作品。','base');return;
 }
 try{
  await manager.ready;
  if(ticket!==mapPromptSerial)return;
  const level=levelOverride||record?.level||'city';
  const match=manager.matchLocation(Number(lon),Number(lat),level);
  if(!match){
   const geo=record?.code?geometryFallback(record.code):null;
   const boundary=geo?.approx?'对应区域暂用真实上级行政轮廓':'当前位置可使用基础地理轮廓';
   mapPrompt(boundary+'；暂无可下载的精细街道包，不影响生成。','base');return;
  }
  const spec=match.spec;
  const localFile=location.protocol==='file:';
  const already=localFile
   ? Boolean(window.FIELDNOTES_OFFLINE_TILES?.regions?.some(x=>x.code===spec.code))
   : Boolean(await manager.installedInfo(spec));
  if(ticket!==mapPromptSerial)return;
  if(already){
   mapPrompt('✓ '+spec.name+'中心局部精细街道已在本机。'+(match.complete?'可直接生成。':'当前位置临近预装范围边缘，仅部分街道可用。'),'installed');return;
  }
  if(!navigator.onLine||localFile||typeof caches==='undefined'){
   mapPrompt('当前无法下载'+spec.name+'精细街道包。基础地图可正常出图。','base');return;
  }
  offeredMap=match;
  mapPrompt(spec.name+'中心附近有更精细的街道和水系地图（'+(match.complete?'当前地点位于完整瓦片覆盖中心。':'当前地点在局部覆盖边缘，可能只有部分街道。')+'），下载可提升效果；也可以直接使用基础地图。',match.complete?'offer':'partial',true);
  $36('v39MapDownload').textContent='下载'+spec.name+'地图';
 }catch(e){
  if(ticket!==mapPromptSerial)return;
  mapPrompt('地图状态检查暂时失败，基础地图仍可出图。','base');
 }
}
async function downloadSuggestedMap(){
 const match=offeredMap,manager=window.FIELDNOTES_PACK_MANAGER;
 if(!match||!manager)return;
 const button=$36('v39MapDownload');
 button.disabled=true;
 mapPrompt('正在下载 '+match.spec.name+' 精细街道（只保存在本机，不上传照片）…','offer');
 try{
  await manager.install(match.spec);
  await checkLocalMap(chosen,state.gpsFromPhoto?'gps':null);
 }catch(e){
  offeredMap=match;
  mapPrompt('精细地图下载未成功：'+(e?.message||'请检查网络')+'。不影响使用基础地图。','partial',true);
 }finally{button.disabled=false;}
}

function applyRecord(r){
 if(!r)return false;
 if(chosen?.code!==r.code)invalidatePreviews();
 const geo=geometryFallback(r.code);chosen=r;
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
 schedule();checkLocalMap(r);return true;
}
function syncRegionFromGPS(){
 if(state.centerLat==null||state.centerLon==null)return;
 $36('v36Chosen').textContent='照片 GPS '+state.centerLat.toFixed(4)+'°N · '+state.centerLon.toFixed(4)+'°E（设备记录）';
 status('已使用照片 EXIF 中的 GPS。如需改为省、市或区县，可以手动搜索。');
 checkLocalMap(null,'gps');
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
let v36PresentedImage=null;
function photoLoaded(){
 // File input polling and photo metadata MutationObserver may both signal the same upload.
 // Prevent a late duplicate callback from resetting a finished composition.
 if(!state.image||state.image===v36PresentedImage)return;
 v36PresentedImage=state.image;
 $36('v36Picture').hidden=false;$36('v36Initial').hidden=true;
 const c=$36('v36Original'),w=680,h=Math.round(w*state.photoH/state.photoW);c.width=w;c.height=h;c.getContext('2d').drawImage(state.image,0,0,w,h);
 $36('v36Filename').textContent=state.photoName+' · '+state.photoW+' × '+state.photoH;
 status('照片已载入。确认拍摄地区后，一键生成六种精选版式。');
 invalidatePreviews();variants.length=0;drawRound=0;
 if(state.gpsFromPhoto)syncRegionFromGPS();
 else{const p=$36('v36Location').value.trim();if(p){const hit=rank(p)[0];if(hit)applyRecord(hit);}}
}
const keys=['v35Sidecar','v32NoMap','v32Micro','frameMode','styleMode','theme','area','opacity','wash','typeScale','posX','posY','v32BeforePreview','guides','rotation','v32Tone','v32Exposure','v32Contrast','v32Saturation','v32Warm','viewMode','v37Preset','p1Kind'];
function snapshot(){return Object.fromEntries(keys.map(k=>[k,state[k]]));}
function configure(o){Object.assign(state,o);state.guides=false;state.v32BeforePreview=false;}
function dimsFor(){return state.v35Sidecar?v35PanelDims():state.frameMode?v31FrameDims():{w:state.photoW,h:state.photoH};}
function drawVariant(c,cfg,width){
 const old=snapshot();try{configure(cfg);const d=dimsFor(),W=Math.round(width),H=Math.max(70,Math.round(W*d.h/d.w));
  c.width=W;c.height=H;paint(c.getContext('2d'),W,H,{preview:false});return[W,H];
 }finally{Object.assign(state,old);}
}
function planConfigs(){
 if(typeof window.FIELDNOTES_V37_PLAN==='function')return window.FIELDNOTES_V37_PLAN({round:drawRound,feedback,analysis:state.v32Analysis});
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
 if(!variants[i])return;selected=i;const v=variants[i];
 const cached=batchCache.get(drawRound%2);if(cached)cached.selected=i;
 for(const [j,btn] of [...$36('v36Options').children].entries())btn.classList.toggle('active',j===i);
 configure(v.cfg);state.v32Variant=v.kind==='frame'?'frame':'light';
 $36('v36SelectedLabel').textContent=v.label+' · '+v.desc;
 drawVariant($36('v36Hero'),v.cfg,Math.min(1100,Math.max(660,Math.round(state.photoW*.75))));schedule();
}
async function generate(){
 if(generating)return;
 if(!state.image){status('请先拍照或上传照片。',true);return;}
 const q=$36('v36Location').value.trim();
 if(q&&(!chosen||chosen.name!==q)){const matches=rank(q);if(matches.filter(r=>clean(r.name)===clean(q)).length>1){status('这个地名在多个城市存在，请先在建议列表中选择正确的省市。',true);showSuggestions(q);return;}const r=matches[0];if(r)applyRecord(r);else{status('地名未能离线识别，请改用省、市或区县名称。',true);return;}}
 if(!chosen&&(state.centerLat==null||state.centerLon==null)){status('还缺拍摄地点。可以只填省，不要求填写市或区。',true);$36('v36Location').focus();return;}
 generating=true;$36('v36Generate').disabled=true;
 const oldGenerateLabel=$36('v36Generate').textContent;$36('v36Generate').textContent='正在绘制真实地图…';
 try{
  if(window.FIELDNOTES_V37_PREPARE)await window.FIELDNOTES_V37_PREPARE();
  if($36('v36AutoTone').checked){if(state.v32Analysis)v32AutoTone();}else v32SetTone('original');
  const group=((drawRound%2)+2)%2;
  const signature=JSON.stringify([
   state.photoName,state.photoW,state.photoH,state.centerLon,state.centerLat,
   state.v36RegionCode,state.exact,$36('v36AutoTone').checked,
   window.FIELDNOTES_V37_DEBUG?.renderedVersion?.()||0
  ]);
  if(cachedSignature!==signature){batchCache.clear();cachedSignature=signature;}
  let cached=batchCache.get(group);
  if(!cached){
   const planned=planConfigs();
   if(planned.length!==6)throw Error('当前版式未能生成完整六款，拒绝用重复配色凑数');
   const items=[];
   const previewWidth=innerWidth<=720?320:440;
   planned.forEach((o,i)=>{
    const btn=document.createElement('button');btn.type='button';btn.className='v36-option';
    const canvas=document.createElement('canvas'),label=document.createElement('b'),caption=document.createElement('small');
    label.textContent=o.label;caption.textContent=o.desc;
    btn.append(canvas,label,caption);drawVariant(canvas,o.cfg,previewWidth);
    btn.addEventListener('click',()=>selectVariant(i));items.push(btn);
   });
   cached={planned,items,selected:0};batchCache.set(group,cached);
  }
  variants.splice(0,variants.length,...cached.planned);
  $36('v36Options').replaceChildren(...cached.items);
  $36('v36Results').hidden=false;selectVariant(cached.selected);
  $36('v36Regenerate').textContent=group===0?'↻ 下一组 6 款（07—12）':'↻ 返回第一组（01—06）';
  $36('v36Feedback').textContent='第 '+(group+1)+' 组 · '+(group===0?'01—06':'07—12')+'；下一次切换到另一组，之前的六张预览直接复用。';
  const mapInfo=window.FIELDNOTES_V37_DEBUG?.info;
  const details=mapInfo?.status==='loaded'?('精细真实道路/水系已加载：'+mapInfo.detail):('当前展示真实行政轮廓，不冒充精细街道。');
  status('第 '+(group+1)+' 组 · 六款不同版式。'+details+' 未提供真实 GPS 时，地理坐标代表区域中心。');
  $36('v36Results').scrollIntoView({block:'start',behavior:'smooth'});
 }catch(e){status('合成失败：'+e.message,true);console.error(e);}finally{generating=false;$36('v36Generate').disabled=false;$36('v36Generate').textContent=oldGenerateLabel;}
}
function regenerate(){
 feedback='balanced';drawRound=(drawRound+1)%2;
 generate();
}
function init(){
 // Direct native file inputs prevent Android WebView from blocking scripted clicks.
 $36('v36NativeUpload').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;photoFile(file);waitPhoto(file);e.target.value='';});
  $36('v36CameraInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;photoFile(f);waitPhoto(f);e.target.value='';});
 $36('photoFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)waitPhoto(f);});
 // Watch the existing editor's photo metadata, so first import works even if the legacy handler runs before this listener.
 let lastShownImage=null;
 new MutationObserver(()=>{if(state.image&&state.image!==lastShownImage){lastShownImage=state.image;photoLoaded();}})
  .observe($36('photoMeta'),{childList:true,subtree:true,characterData:true});
 const loc=$36('v36Location');
 loc.addEventListener('input',()=>{
  chosen=null;resetMapPrompt();invalidatePreviews();showSuggestions(loc.value);
  $36('v36Chosen').textContent='请从建议中选择地点，避免重名误匹配。暂不识别街道门牌号。';
 });
 loc.addEventListener('focus',()=>showSuggestions(loc.value));
 $36('v36LocationClear').addEventListener('click',()=>{
  loc.value='';chosen=null;state.v36RegionCode=null;resetMapPrompt();invalidatePreviews();showSuggestions('');loc.focus();
 });
 $36('v39MapDownload').addEventListener('click',downloadSuggestedMap);
 $36('v39MapSkip').addEventListener('click',()=>{
  offeredMap=null;mapPrompt('已选择基础地图。无需下载，直接点击第三步一键出图。','base');
 });
 window.addEventListener('fieldnotes:maps-changed',()=>{
  invalidatePreviews();
  if(chosen||state.gpsFromPhoto)checkLocalMap(chosen,state.gpsFromPhoto?'gps':null);
  status('精细地图已更新，请点击第三步重新生成当前地点作品。');
 });
 $36('v36AutoTone').addEventListener('change',invalidatePreviews);
 $36('v36Generate').addEventListener('click',()=>{drawRound=0;feedback='balanced';generate();});
 $36('v36Regenerate').addEventListener('click',regenerate);
 for(const b of document.querySelectorAll('[data-v36feedback]'))b.addEventListener('click',()=>regenerate(b.dataset.v36feedback));
 $36('v36Save').addEventListener('click',()=>{if(!variants[selected])return status('请先一键生成作品。',true);$36('v33DockExport').click();});
 $36('v36Advanced').addEventListener('click',()=>{document.body.classList.remove('v36-basic');document.body.classList.add('v36-advanced');resizePreview();schedule();document.querySelector('.layout')?.scrollIntoView({block:'start'});});
 $36('v36BackButton').addEventListener('click',()=>{document.body.classList.remove('v36-advanced');document.body.classList.add('v36-basic');$36('v36Flow').scrollIntoView({block:'start'});});
 $36('v36AtlasCount').textContent='离线内置 '+src.stats.province+' 省级、'+src.stats.city+' 市级、'+src.stats.county+' 区县级地名；真实轮廓 '+src.stats.province+' 省级、'+src.stats.geoCity+' 市级、'+src.stats.geoCounty+' 区县级。';
 const packs=window.FIELDNOTES_OFFLINE_TILES?.regions||[];
 $36('v36AtlasCount').textContent+=packs.length
   ? ' · 已下载精细街道：'+packs.map(x=>x.region+'中心局部').join('、')
   : ' · 精细街道可按需下载；其他地区仍使用真实行政区轮廓。';
 status('照片只在本机处理。选好地点后会自动检查精细地图，无须了解缓存或数据包。');
}
init();
window.FIELDNOTES_V36_TEST={rank,applyRecord,asFeature,geometryFallback,generate,regenerate,getSelected:()=>selected,getVariants:()=>variants,coverage:src.stats,recordsCount:records.length,getCachedGroups:()=>batchCache.size,checkLocalMap};
})();

// BRIDGE_SYNC_V36
