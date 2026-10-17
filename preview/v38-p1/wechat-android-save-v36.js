/* FIELDNOTES: Android WeChat in-page image save, no upload, no Apple changes.
   On Android WeChat, a native canvas-generated JPEG DOM <img> is offered for WeChat
   long-press image saving. Normal share/download remain unchanged outside WeChat.
   Actual WeChat X5 saving must be verified on physical Android WeChat device.
*/
(() => {
 'use strict';
 const ua=navigator.userAgent||'';
 if (!/Android/i.test(ua) || !/MicroMessenger/i.test(ua)) return;
 const srcDialog=document.getElementById('v33SaveDialog');
 const shareButton=document.getElementById('v33ShareBtn');
 if (!srcDialog || !shareButton) return;

 const sheet=document.createElement('dialog');
 sheet.id='fnWechatPhotoSheet';
 sheet.setAttribute('aria-label','微信图片保存');
 sheet.innerHTML=[
  '<div class="fn-wx-head"><div><b>高清图片已准备好</b><small>长按下方作品，选择「保存图片」</small></div><button type="button" id="fnWxClose" aria-label="关闭图片预览">✕</button></div>',
  '<div class="fn-wx-picture"><img id="fnWxRealImage" alt="可以在微信中长按保存的旅行作品"></div>',
  '<p class="fn-wx-note" id="fnWxNote">这是实际生成的 JPEG 图片，没有上传到服务器。若没有出现保存图片菜单，请告诉我你的安卓手机型号和微信版本。</p>',
  '<button id="fnWxReturn" type="button" class="fn-wx-back">返回导出窗口</button>'
 ].join('');
 const style=document.createElement('style');
 style.textContent=[
  '#fnWechatPhotoSheet{box-sizing:border-box;position:fixed;inset:0;margin:0;padding:0;border:0;border-radius:0;width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;background:#121915;color:#fff;overflow:auto;overscroll-behavior:contain}',
  '#fnWechatPhotoSheet::backdrop{background:#08100c}',
  '#fnWechatPhotoSheet .fn-wx-head{box-sizing:border-box;position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;padding-top:calc(14px + env(safe-area-inset-top));background:rgba(18,25,21,.96);font-size:15px}',
  '#fnWechatPhotoSheet .fn-wx-head b{display:block;font-size:16px}',
  '#fnWechatPhotoSheet .fn-wx-head small{display:block;font-size:12px;color:#c4d9cb;margin-top:4px}',
  '#fnWechatPhotoSheet .fn-wx-head button{border:1px solid #80968a;background:transparent;color:#fff;border-radius:8px;font-size:19px;padding:8px 14px}',
  '#fnWechatPhotoSheet .fn-wx-picture{padding:12px 10px;display:flex;align-items:center;justify-content:center;min-height:40vh}',
  '#fnWechatPhotoSheet #fnWxRealImage{display:block;max-width:100%;height:auto;max-height:none;object-fit:contain;-webkit-touch-callout:default!important;user-select:auto!important;-webkit-user-select:auto!important;touch-action:auto!important}',
  '#fnWechatPhotoSheet .fn-wx-note{font-size:12px;color:#c5d5ca;margin:4px 16px 14px;line-height:1.6}',
  '#fnWechatPhotoSheet .fn-wx-back{display:block;margin:4px 16px 24px;padding:12px 18px;background:#2d5b42;color:#fff;border:0;border-radius:12px;font-size:14px;width:calc(100% - 32px)}'
 ].join('');
 document.head.append(style);
 document.body.append(sheet);

 const image=sheet.querySelector('#fnWxRealImage');
 const note=sheet.querySelector('#fnWxNote');
 let busy=false;
 const setInfo=(txt,error=false)=>{
  const el=document.querySelector('#v36AndroidExportStatus');
  if(el){el.textContent=txt;el.dataset.error=String(error);}
 };
 async function decode(blob){
  if('createImageBitmap' in window){try{return await createImageBitmap(blob)}catch(_){}}
  const url=URL.createObjectURL(blob);
  try{return await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('图片解码失败'));i.src=url;})}
  finally{setTimeout(()=>URL.revokeObjectURL(url),30000)}
 }
 async function asJPEG(blob){
  const original=await decode(blob);
  const w=original.width||original.naturalWidth,h=original.height||original.naturalHeight;
  if(!w||!h)throw new Error('成品图片尺寸为空');
  // Android WeChat X5 commonly handles image/jpeg data URL better than blob URLs.
  // Protect low-memory handsets by bounding pixels; no original file is overwritten.
  const factor=Math.min(1,Math.sqrt(8200000/(w*h)));
  const W=Math.max(1,Math.floor(w*factor)),H=Math.max(1,Math.floor(h*factor));
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const ctx=cv.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('无法创建手机图片画布');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);ctx.drawImage(original,0,0,W,H);
  if(typeof original.close==='function')original.close();
  const jpeg=cv.toDataURL('image/jpeg',.94);
  if(!jpeg.startsWith('data:image/jpeg;'))throw new Error('手机没有生成可保存的 JPEG');
  return{jpeg,W,H,scaled:factor<1};
 }
 async function show(){
  if(busy)return;
  let prepared=null;try{prepared=typeof v33Prepared!=='undefined'?v33Prepared:null}catch(_){}
  if(!prepared?.blob)return setInfo('请先生成作品，再打开微信保存图片。',true);
  busy=true;setInfo('正在为安卓微信准备可长按保存的真实图片…');
  shareButton.disabled=true;
  try{
   const {jpeg,W,H,scaled}=await asJPEG(prepared.blob);
   image.src=jpeg;image.width=W;image.height=H;
   note.textContent='长按上面的图片，在微信菜单选择「保存图片」。'+(scaled?'为兼容手机内存，预览版缩至 '+W+' × '+H+' 像素。':'当前是 '+W+' × '+H+' 像素高清 JPEG。')+'图片只在当前手机生成，没有上传服务器。';
   sheet.showModal();setInfo('已进入微信长按保存模式。');
  }catch(e){
   setInfo('微信长按版图片准备失败：'+(e?.message||'未知错误')+'。仍可尝试 PNG 下载。',true);
  }finally{busy=false;shareButton.disabled=false}
 }
 // Capture only Android WeChat share clicks; do not affect Chrome or any iOS route.
 shareButton.addEventListener('click',event=>{
  event.preventDefault();event.stopImmediatePropagation();
  void show();
 },true);
 shareButton.textContent='微信内长按保存';
 for(const el of [sheet.querySelector('#fnWxClose'),sheet.querySelector('#fnWxReturn')]){
  el.addEventListener('click',()=>{sheet.close();image.removeAttribute('src');});
 }
 sheet.addEventListener('close',()=>image.removeAttribute('src'));
})();
