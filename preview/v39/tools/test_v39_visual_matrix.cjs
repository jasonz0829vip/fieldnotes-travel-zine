#!/usr/bin/env node
/* V3.9 isolated, privacy-safe visual QA. Uses two synthetic travel compositions,
   never uploads or embeds the user's private hotel/beluga photographs. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const site=path.resolve(__dirname,'..'), out=path.join(__dirname,'visual-qa');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8',
 '.css':'text/css','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const target=path.resolve(site,'.'+pathname);
  if(target!==site&&!target.startsWith(site+path.sep))throw Error('Invalid URL');
  const file=fs.statSync(target).isDirectory()?path.join(target,'index.html'):target;
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(fs.readFileSync(file));
 }catch(_){res.writeHead(404);res.end('Not found');}
});
function fixture(scene){
 // A varied, non-photographic stand-in tests layout and legibility without publishing private photos.
 const portrait=scene==='water';
 return ({scene})=>{
  const portrait=scene==='water',w=portrait?820:1360,h=portrait?1350:880;
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const g=cv.getContext('2d');
  if(portrait){
   const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#b7d5e9');grad.addColorStop(.38,'#58c7ec');grad.addColorStop(1,'#035cac');
   g.fillStyle=grad;g.fillRect(0,0,w,h);
   g.fillStyle='#e8eef1';g.fillRect(0,130,w,250);
   g.fillStyle='#fffaf2';for(let x=45;x<w;x+=104){g.beginPath();g.arc(x,133,12,0,2*Math.PI);g.fill();}
   g.fillStyle='#b6ced7';for(let x=80;x<w;x+=185){g.fillRect(x,230,80,90);}
   g.fillStyle='#d6d6cd';g.beginPath();g.moveTo(0,h*.62);g.lineTo(w*.40,h*.55);g.lineTo(w*.42,h);g.lineTo(0,h);g.closePath();g.fill();
   g.fillStyle='#d7dfe4';g.beginPath();g.ellipse(w*.70,h*.69,w*.16,h*.27,-.12,0,2*Math.PI);g.fill();
   g.beginPath();g.ellipse(w*.67,h*.53,w*.14,h*.15,0,0,2*Math.PI);g.fill();
   g.fillStyle='#1b2539';g.beginPath();g.arc(w*.65,h*.52,6,0,Math.PI*2);g.fill();
   g.fillStyle='#181d2c';g.beginPath();g.ellipse(w*.30,h*.65,w*.17,h*.20,-.55,0,2*Math.PI);g.fill();
   g.fillStyle='#e8ad8f';g.beginPath();g.arc(w*.27,h*.48,w*.075,0,Math.PI*2);g.fill();
   g.strokeStyle='#e8ad8f';g.lineWidth=25;g.beginPath();g.moveTo(w*.31,h*.55);g.lineTo(w*.49,h*.65);g.stroke();
  }else{
   const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#78b7dc');grad.addColorStop(.58,'#d2ece9');grad.addColorStop(1,'#62a15e');
   g.fillStyle=grad;g.fillRect(0,0,w,h);
   g.fillStyle='#ece6d8';g.fillRect(55,80,w-110,390);
   g.fillStyle='#acc3c7';for(let x=100;x<w-80;x+=125)for(let y=112;y<415;y+=100)g.fillRect(x,y,55,70);
   g.fillStyle='#2b7747';g.fillRect(0,460,w,h-460);
   g.strokeStyle='#c2c877';g.lineWidth=3;for(let y=520;y<h;y+=27){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
   g.strokeStyle='#4b6736';g.lineWidth=25;for(let x of [130,350,1080]){g.beginPath();g.moveTo(x,490);g.lineTo(x-30,330);g.stroke();}
   g.fillStyle='#1d7957';for(let x of [130,350,1080]){g.beginPath();g.arc(x-30,310,75,0,Math.PI*2);g.fill();}
   // Central human-like photographic subject silhouette for overlap visibility.
   g.fillStyle='#e0ab88';g.beginPath();g.arc(w*.50,h*.49,60,0,Math.PI*2);g.fill();
   g.fillStyle='#2e674c';g.fillRect(w*.46,h*.55,116,160);
   g.strokeStyle='#313f37';g.lineWidth=31;g.beginPath();g.moveTo(w*.48,h*.73);g.lineTo(w*.44,h*.94);g.moveTo(w*.55,h*.73);g.lineTo(w*.61,h*.94);g.stroke();
  }
  return {png:cv.toDataURL('image/png').split(',')[1],width:w,height:h};
 };
}
function differencePixels(base64Images){
 const descriptors=base64Images.map(x=>x.imageSignature||[]);
 const matrix=[];
 for(let i=0;i<descriptors.length;i++){
  const row=[];
  for(let j=0;j<descriptors.length;j++){
   let sum=0;for(let k=0;k<descriptors[i].length;k++)sum+=Math.abs(descriptors[i][k]-descriptors[j][k]);
   row.push(Math.round(sum/descriptors[i].length));
  }
  matrix.push(row);
 }
 const candidates=[];
 for(let i=0;i<matrix.length;i++)for(let j=i+1;j<matrix.length;j++)candidates.push({a:i+1,b:j+1,difference:matrix[i][j]});
 return {matrix,nearest:candidates.sort((a,b)=>a.difference-b.difference).slice(0,15)};
}
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const baseUrl='http://127.0.0.1:'+server.address().port+'/';
 const executable=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
 let browser;
 const all=[];
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(executable?{executablePath:executable}:{})});
  for(const scene of ['hotel','water']){
   const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow',acceptDownloads:true});
   const page=await ctx.newPage(),errs=[];
   page.on('pageerror',e=>errs.push(e.message));
   await page.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:30000});
   const fixtureData=await page.evaluate(fixture(scene),{scene});
   const img=Buffer.from(fixtureData.png,'base64');
   await page.locator('#v36NativeUpload').setInputFiles({name:'synthetic-'+scene+'.png',mimeType:'image/png',buffer:img});
   await page.waitForFunction(()=>!document.getElementById('v36Picture').hidden,{timeout:30000});
   await page.locator('#v36Location').fill('黄浦区');
   await page.locator('#v36Choices button').filter({hasText:'黄浦区'}).first().click();
   await page.waitForFunction(()=>!document.getElementById('v39MapOffer').hidden,{timeout:12000});
   if(scene==='hotel'){
    await page.locator('#v39MapDownload').click();
    await page.waitForFunction(()=>document.getElementById('v39MapOffer').dataset.kind==='installed',{timeout:30000});
   }else{
    await page.locator('#v39MapSkip').click();
   }
   const outDir=path.join(out,scene);fs.mkdirSync(outDir,{recursive:true});
   let thumbnails=[];
   const times=[];
   for(const batch of [0,1]){
    const t=Date.now();
    await page.locator(batch?'#v36Regenerate':'#v36Generate').click();
    const prefix=batch?'07':'01';
    await page.waitForFunction(p=>document.querySelector('#v36Options b')?.textContent?.startsWith(p)&&!document.getElementById('v36Generate').disabled,{timeout:80000},prefix);
    times.push(Date.now()-t);
    const info=await page.locator('#v36Options button').evaluateAll(options=>options.map((node)=>{
      const canvas=node.querySelector('canvas');
      const scaled=document.createElement('canvas');scaled.width=12;scaled.height=16;
      scaled.getContext('2d').drawImage(canvas,0,0,12,16);
      const pix=scaled.getContext('2d').getImageData(0,0,12,16).data;
      let sum=0;const signature=[];for(let i=0;i<pix.length;i+=4){sum+=pix[i]+pix[i+1]+pix[i+2];signature.push(Math.round((pix[i]*.3+pix[i+1]*.59+pix[i+2]*.11)/16)*16);}
      return {name:node.querySelector('b')?.textContent||'',data:canvas.toDataURL('image/png').split(',')[1],imageSignature:signature,
        pixelMean:Math.round(sum/(pix.length/4)/3),w:canvas.width,h:canvas.height};
    }));
    assert.equal(info.length,6);
    for(let i=0;i<info.length;i++){
     const item=info[i];const name=String(batch*6+i+1).padStart(2,'0');
     fs.writeFileSync(path.join(outDir,name+'.png'),Buffer.from(item.data,'base64'));
     thumbnails.push({name:item.name,imageSignature:item.imageSignature,pixelMean:item.pixelMean,w:item.w,h:item.h});
    }
    await page.screenshot({path:path.join(outDir,'batch'+(batch+1)+'_mobile.png'),fullPage:true,animations:'disabled'});
   }
   const bounceStart=Date.now();
   await page.locator('#v36Regenerate').click();
   await page.waitForFunction(()=>document.querySelector('#v36Options b')?.textContent?.startsWith('01'),{timeout:30000});
   times.push(Date.now()-bounceStart);
   await page.locator('#v36Options button').nth(3).click();
   await page.locator('#v36Save').click();
   await page.locator('#v33SaveDialog').waitFor({state:'visible',timeout:50000});
   const exportDetail=await page.evaluate(()=>({
     width:typeof v33Prepared!=='undefined'?v33Prepared?.width:null,
     height:typeof v33Prepared!=='undefined'?v33Prepared?.height:null,
     bytes:typeof v33Prepared!=='undefined'?v33Prepared?.blob?.size:null,
     type:typeof v33Prepared!=='undefined'?v33Prepared?.blob?.type:null,
     name:typeof v33Prepared!=='undefined'?v33Prepared?.name:null
   }));
   assert.equal(exportDetail.width,fixtureData.width);
   assert.equal(exportDetail.height,fixtureData.height);
   assert(exportDetail.bytes>10000&&exportDetail.type==='image/png');
   const diff=differencePixels(thumbnails);
   const summary={scene,input:[fixtureData.width,fixtureData.height],times_ms:times,export:exportDetail,
    warnings:errs,styles:thumbnails.map(({name,pixelMean,w,h})=>({name,pixelMean,w,h})),
    similarity:diff};
   all.push(summary);
   fs.writeFileSync(path.join(outDir,'results.json'),JSON.stringify(summary,null,2));
   console.log('VISUAL_MATRIX',scene,'times=',times,'export=',exportDetail.width+'x'+exportDetail.height,
    'nearest=',JSON.stringify(diff.nearest.slice(0,5)), 'errors=',errs.length);
   await ctx.close();
  }
  console.log('PASS: landscape/portrait scene, 12 preview canvases, opt-in/skip, full-size PNG exports; human visual review still required');
 }finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
 }
})().catch(err=>{console.error(err);process.exitCode=1;});
