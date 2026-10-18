#!/usr/bin/env node
/* Browser CI: real Hangzhou Z14 PMTiles served locally with HTTP Range.
   Synthetic photo only; no publication of downloaded OSM test archive. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),fixture=path.join(__dirname,'.national-qa','hangzhou-z14-test.pmtiles');
if(!fs.existsSync(fixture))throw Error('Run build_national_qa_fixture.py first');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.json':'application/json','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const seen=[];
function makeServer(){
 return http.createServer((req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
   const requested=path.resolve(root,'.'+pathname);
   if(requested!==root&&!requested.startsWith(root+path.sep))throw Error('Invalid path');
   const p=fs.statSync(requested).isDirectory()?path.join(requested,'index.html'):requested;
   const content=fs.readFileSync(p),length=content.length;
   const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
   const hdr={'Content-Type':types[path.extname(p)]||'application/octet-stream',
     'Cache-Control':'no-store','Accept-Ranges':'bytes','Access-Control-Allow-Origin':'*',
     'Access-Control-Expose-Headers':'Content-Range,ETag,Accept-Ranges,Content-Length',
     'ETag':'"fieldnotes-national-hangzhou-z14-test"'};
   seen.push({pathname,range:req.headers.range||null});
   if(range){
    const first=Number(range[1]),last=Math.min(length-1,range[2]?Number(range[2]):length-1);
    if(!Number.isSafeInteger(first)||first>=length||last<first){
     res.writeHead(416,{...hdr,'Content-Range':'bytes */'+length});res.end();return;
    }
    res.writeHead(206,{...hdr,'Content-Range':'bytes '+first+'-'+last+'/'+length,
      'Content-Length':last-first+1});
    res.end(content.subarray(first,last+1));return;
   }
   res.writeHead(200,{...hdr,'Content-Length':length});res.end(content);
  }catch(_){res.writeHead(404);res.end('Not found');}
 });
}
(async()=>{
 const srv=makeServer();await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+srv.address().port+'/',url=origin+'tools/.national-qa/hangzhou-z14-test.pmtiles';
 const exe=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
 let browser,context,page;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(exe?{executablePath:exe}:{})});
  context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
  page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(url=>{
   window.FIELDNOTES_NATIONAL_SOURCE={enabled:true,kind:'pmtiles',url,version:'ci-hangzhou-z14',
    attribution:'© OpenStreetMap contributors'};
  },url);
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.FIELDNOTES_NATIONAL_MAP?.configured,{timeout:15000});
  const photo=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=900;c.height=650;const g=c.getContext('2d');
   const grad=g.createLinearGradient(0,0,0,650);
   grad.addColorStop(0,'#7cb8d2');grad.addColorStop(.55,'#e0e7d9');grad.addColorStop(1,'#557a4d');
   g.fillStyle=grad;g.fillRect(0,0,900,650);
   g.fillStyle='#e2ccb4';for(let x=120;x<800;x+=180)g.fillRect(x,110,90,340);
   g.fillStyle='#234a47';g.fillRect(0,480,900,170);
   return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#v36NativeUpload').setInputFiles({name:'public-synthetic-hangzhou.png',
    mimeType:'image/png',buffer:Buffer.from(photo,'base64')});
  await page.waitForFunction(()=>!document.getElementById('v36Picture').hidden,{timeout:15000});
  await page.locator('#v36Location').fill('杭州市');
  await page.locator('#v36Choices button').filter({hasText:'杭州市'}).first().click();
  await page.waitForFunction(()=>document.getElementById('v39MapOffer').dataset.kind==='offer',{timeout:30000});
  const initial=await page.evaluate(async()=>{
   const n=window.FIELDNOTES_NATIONAL_MAP;return {configured:n.configured,regions:(await n.list()).length};
  });
  assert(initial.configured&&initial.regions===0,'No silent download before user consent');
  const prompt=await page.locator('#v39MapMessage').textContent();
  assert(prompt.includes('Z14')&&prompt.includes('12 MB'),prompt);
  await page.locator('#v39MapDownload').click();
  await page.waitForFunction(()=>document.getElementById('v39MapOffer').dataset.kind==='installed',{timeout:65000});
  const downloaded=await page.evaluate(async()=>{
   const n=window.FIELDNOTES_NATIONAL_MAP;return {items:await n.list(),lat:state.centerLat,lon:state.centerLon};
  });
  assert.equal(downloaded.items.length,1);
  assert(downloaded.items[0].tiles>=8&&downloaded.items[0].bytes>10000);
  const built=await page.evaluate(async()=>{
   const d=await window.FIELDNOTES_STREETS.streets(state.centerLon,state.centerLat,'city');
   return {zoom:d.zoom,requestedZoom:d.requestedZoom,sources:d.sources,partial:d.partial,
    roads:d.roads.length,buildings:d.buildings.length,river:d.river.length};
  });
  console.log('NATIONAL_PM_TILES_REAL_HANGZHOU',JSON.stringify(built));
  assert.equal(built.zoom,14,'Expected actual Z14 from national PMTiles cache');
  assert.equal(built.requestedZoom,12);
  assert(built.roads>100&&built.buildings>100,'Expected real roads and buildings outside three samples');
  await page.locator('#v36Generate').click();
  await page.waitForFunction(()=>document.querySelectorAll('#v36Options canvas').length===6 &&
    !document.getElementById('v36Generate').disabled,{timeout:65000});
  const info=await page.evaluate(()=>window.FIELDNOTES_V37_DEBUG?.info);
  assert(info?.detail?.includes('Z14'),JSON.stringify(info));
  console.log('NATIONAL_MAP_UI_READY',JSON.stringify({status:info.status,tiles:info.tiles,detail:info.detail}));
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.FIELDNOTES_NATIONAL_MAP?.configured,{timeout:20000});
  const offline=await page.evaluate(async()=>{
   const n=window.FIELDNOTES_NATIONAL_MAP;await n.ready;
   const d=await window.FIELDNOTES_STREETS.streets(120.154,30.287,'gps');
   return {packs:(await n.list()).length,zoom:d.zoom,roads:d.roads.length,buildings:d.buildings.length};
  });
  assert.equal(offline.packs,1);assert.equal(offline.zoom,14);
  assert(offline.roads>100&&offline.buildings>100);
  console.log('NATIONAL_OFFLINE_REOPEN',JSON.stringify(offline));
  await page.locator('#v39Settings summary').click();
  await page.locator('#fn38StorageBtn').click();
  await page.locator('#fn38StorageDialog').waitFor({state:'visible'});
  const row=page.locator('.fn38PackRow').filter({hasText:'杭州市 · 全国按需地图'});
  await row.getByRole('button',{name:'删除这一区域'}).click();
  await page.waitForTimeout(900);
  const removed=await page.evaluate(async()=>{
   return {packs:(await window.FIELDNOTES_NATIONAL_MAP.list()).length,
    caches:(await caches.keys()).filter(x=>x.startsWith('fn39-national-v1-'))};
  });
  assert.equal(removed.packs,0);assert.equal(removed.caches.length,0);
  assert(errors.length===0,errors.join('; '));
  assert(seen.some(r=>r.pathname.endsWith('.pmtiles')&&r.range),'Expected real PMTiles HTTP Range requests');
  console.log('PASS NATIONAL: true Hangzhou Z14 PMTiles -> opt-in -> offline city/gps -> delete without personal photos');
 }catch(e){
  if(page)await page.screenshot({path:path.join(root,'tools','test-results','national-on-demand-failure.png'),
    fullPage:true}).catch(()=>{});
  throw e;
 }finally{if(context)await context.close();if(browser)await browser.close();await new Promise(ok=>srv.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
