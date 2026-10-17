/* P1: accurately describe six curated designs rather than falsely promising endless new ones. */
(()=>{
 const byId=id=>document.getElementById(id);
 const next=byId('v36Regenerate'),again=byId('v36Generate'),place=byId('v36Location');
 if(!next||!again)return;
 let extraShown=false;
 const reset=()=>{
  extraShown=false;
  next.textContent='↻ 再看 3 种不同版式';
  byId('v36Feedback').textContent='第一组：街网天空 / 水系地理 / 极简坐标；第二组：夜间地图 / 城市蓝图 / 旅行档案。';
 };
 next.addEventListener('click',event=>{
  if(extraShown){
   event.preventDefault();event.stopImmediatePropagation();
   byId('v36Feedback').textContent='6 种精选设计已全部展示。下方可按你的意见重新选择最适合的三种，不会假装无限生成新模板。';
   return;
  }
  extraShown=true;
  next.textContent='六款已展示 · 选择下方修改方向';
 },true);
 again.addEventListener('click',reset,true);
 place?.addEventListener('input',reset);
 for(const id of ['v36NativeUpload','v36CameraInput'])byId(id)?.addEventListener('change',reset);
 reset();
})();
