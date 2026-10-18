#!/usr/bin/env node
/* FIELDNOTES V3.9 browser acceptance: native photo import, optional maps, 6+6 actual canvases.
   Local synthetic photograph only. Not a domestic physical-phone test. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const output=path.join(__dirname,'test-results');
fs.mkdirSync(output,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.json':'application/json','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.txt':'text/plain'};
function makeServer(){
 return http.createServer((req,res)=>{
  try{
   const parsed=new URL(req.url,'http://localhost');
   const f=path.resolve(root,'.'+decodeURIComponent(parsed.pathname));
   if(f!==root&&!f.startsWith(root+path.sep))throw Error('Unsafe request');
   const file=fs.statSync(f).isDirectory()?path.join(f,'index.html'):f;
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
   res.end(fs.readFileSync(file));
  }catch(_){res.writeHead(404);res.end('Not found');}
 });
}
async function snap(page,name){try{await page.screenshot({path:path.join(output,name),fullPage:true,animations:'disabled',timeout:15000});}catch(error){console.warn('Could not save screenshot',name,error.message);}}
async function selectPlace(page,place){
 await page.locator('#v36Location').fill(place);
 const choices=page.locator('#v36Choices');
 await choices.waitFor({state:'visible',timeout:8000});
 const candidate=choices.locator('button').filter({hasText:place}).first();
 await candidate.click();
 await page.waitForFunction(()=>!document.getElementById('v39MapOffer').hidden,{timeout:12000});
}
async function fingerprint(page){
 return page.locator('#v36Options canvas').evaluateAll(canvases=>canvases.map(canvas=>{
  const p=document.createElement('canvas');p.width=50;p.height=60;
  const ctx=p.getContext('2d');ctx.drawImage(canvas,0,0,50,60);
  const data=ctx.getImageData(0,0,50,60).data;
  let a=2166136261;for(let i=0;i<data.length;i+=4){a^=data[i];a=Math.imul(a,16777619);a^=data[i+1];a=Math.imul(a,16777619);}
  return a>>>0;
 }));
}
(async()=>{
 const server=makeServer();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port+'/';
 const exe=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(f=>fs.existsSync(f));
 let browser,context,page;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(exe?{executablePath:exe}:{})});
  context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
  page=await context.newPage();
  page.on('pageerror',err=>console.warn('UI page error:',err.message));
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#v36Generate').waitFor({state:'visible',timeout:20000});
  assert.equal(await page.locator('#v39MapOffer').count(),1);
  assert((await page.locator('.v39-generate-panel h2').innerText()).includes('03'));
  const catalog=await page.evaluate(()=>{
   const a=window.FIELDNOTES_V37_PLAN({round:0}),b=window.FIELDNOTES_V37_PLAN({round:1});
   const ids=[...a,...b].map(x=>x.cfg.p1Kind||x.cfg.v37Preset);
   return {lengths:[a.length,b.length],ids,unique:new Set(ids).size};
  });
  assert.deepEqual(catalog.lengths,[6,6]);
  assert.equal(catalog.unique,12,'12 styles must map to 12 actual render presets');

  const imageData=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=940;c.height=720;
   const ctx=c.getContext('2d');
   const sky=ctx.createLinearGradient(0,0,0,720);sky.addColorStop(0,'#81b5dd');sky.addColorStop(.45,'#c5e5dc');sky.addColorStop(1,'#efdfb7');
   ctx.fillStyle=sky;ctx.fillRect(0,0,940,720);
   ctx.fillStyle='#2e554f';ctx.fillRect(95,255,165,465);
   ctx.fillStyle='#365f58';ctx.fillRect(290,175,170,545);
   ctx.fillStyle='#d6bb93';ctx.fillRect(505,330,150,390);
   ctx.fillStyle='#49635f';ctx.fillRect(690,200,160,520);
   ctx.fillStyle='#fcf1d1';for(let y=280;y<650;y+=55)for(let x=120;x<850;x+=44)ctx.fillRect(x,y,15,18);
   return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#v36NativeUpload').setInputFiles({
   name:'fieldnotes-synthetic-photo.png',mimeType:'image/png',buffer:Buffer.from(imageData,'base64')
  });
  await page.waitForFunction(()=>!document.getElementById('v36Picture').hidden,{timeout:14000});

  await selectPlace(page,'黄浦区');
  const details=await page.locator('#v39MapMessage').innerText();
  console.log('Region prompt:',details);
  assert(details.includes('上海')||details.includes('黄浦'),'expected relevant Chinese region prompt');
  const offerVisible=await page.locator('#v39MapDownload').isVisible();
  assert(offerVisible,'Shanghai Huangpu must offer its mapped center-local street pack, not claim nationwide coverage');
  assert.equal((await page.evaluate(async()=>await caches.keys())).filter(x=>x.startsWith('fn38p1-pack-')).length,0,
   'no silent street download on location selection');
  await snap(page,'v39-map-offer-mobile.png');

  await page.locator('#v39MapDownload').click();
  await page.waitForFunction(()=>document.getElementById('v39MapOffer').dataset.kind==='installed',{timeout:20000});
  const installed=await page.evaluate(async()=>{
   const manager=window.FIELDNOTES_PACK_MANAGER,spec=manager.catalog.find(x=>x.code==='310101');
   const info=await manager.installedInfo(spec);
   return {bytes:info?.bytes||0,tiles:Object.keys(window.FIELDNOTES_OFFLINE_TILES.tiles||{}).length};
  });
  assert(installed.bytes>1000000&&installed.tiles===9);
  console.log('Loaded optional Shanghai streets',installed);

  await page.locator('#v36Generate').click();
  await page.waitForFunction(()=>document.querySelectorAll('#v36Options .v36-option').length===6,{timeout:65000});
  await page.waitForFunction(()=>!document.getElementById('v36Generate').disabled,{timeout:65000});
  assert.equal(await page.locator('#v36Options canvas').count(),6);
  let labels=await page.locator('#v36Options .v36-option b').allTextContents();
  assert(labels[0].startsWith('01')&&labels[5].startsWith('06'),JSON.stringify(labels));
  const hashes0=await fingerprint(page);
  assert.equal(new Set(hashes0).size,6,'first six thumbnails should be visually nonidentical');
  await page.evaluate(()=>{document.querySelector('#v36Options canvas').dataset.reusedMark='original-preview';});
  await snap(page,'v39-six-styles-first-group-mobile.png');

  await page.locator('#v36Regenerate').click();
  await page.waitForFunction(()=>document.querySelectorAll('#v36Options .v36-option').length===6&&document.querySelector('#v36Options b')?.textContent?.startsWith('07'),{timeout:65000});
  labels=await page.locator('#v36Options .v36-option b').allTextContents();
  assert(labels[0].startsWith('07')&&labels[5].startsWith('12'),JSON.stringify(labels));
  const hashes1=await fingerprint(page);
  assert.equal(new Set([...hashes0,...hashes1]).size,12,'all twelve thumbnails must be nonidentical');
  await snap(page,'v39-six-styles-second-group-mobile.png');

  await page.locator('#v36Regenerate').click();
  await page.waitForFunction(()=>document.querySelector('#v36Options canvas')?.dataset.reusedMark==='original-preview',{timeout:30000});
  assert.equal(await page.evaluate(()=>window.FIELDNOTES_V36_TEST.getCachedGroups()),2,
    'both batches must be cached rather than re-rendering all thumbnails');
  await page.locator('#v39Settings summary').click();
  await page.locator('#fn38StorageBtn').waitFor({state:'visible',timeout:8000});
  console.log('PASS: 3-step location offer, opt-in real pack, 6+6 distinct presets, cyclic cached preview');

  await page.locator('#v36Location').fill('杭州');
  const area=page.locator('#v36Choices');
  await area.waitFor({state:'visible',timeout:8000});
  await area.locator('button').filter({hasText:'杭州市'}).first().click();
  await page.waitForFunction(()=>document.getElementById('v39MapOffer').dataset.kind==='base',{timeout:12000});
  assert(!(await page.locator('#v39MapDownload').isVisible()),
    'unavailable region must not offer phantom street download');
  console.log('PASS: no city-wide false coverage claim for an unbundled district/city');

  await snap(page,'v39-three-steps-complete-mobile.png');
 }catch(error){if(page)await snap(page,'v39-failure-diagnostic.png');throw error;}
 finally{if(context)await context.close();if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
