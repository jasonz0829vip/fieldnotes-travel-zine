#!/usr/bin/env node
/* P0: inspect real bundled OSM MVTs in Chromium. No external network, no private photos. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),screens=path.join(__dirname,'test-results');
fs.mkdirSync(screens,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.json':'application/json','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.txt':'text/plain'};
function server(){
 return http.createServer((req,res)=>{
  try{
   const u=new URL(req.url,'http://127.0.0.1');const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));
   if(!file.startsWith(root+path.sep)&&file!==root)throw Error('Bad path');
   const target=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
   res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});
   res.end(fs.readFileSync(target));
  }catch(_){res.writeHead(404);res.end('Not found');}
 });
}
(async()=>{
 const srv=server();await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
 const address='http://127.0.0.1:'+srv.address().port+'/';
 const exe=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p));
 let browser,context,page;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(exe?{executablePath:exe}:{})});
  context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
  page=await context.newPage();
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(address,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.FIELDNOTES_STREETS?.streets&&!!window.FIELDNOTES_PACK_MANAGER?.ready,{timeout:30000});
  const empty=await page.evaluate(async()=>{
   await window.FIELDNOTES_PACK_MANAGER.ready;
   const manager=window.FIELDNOTES_PACK_MANAGER;
   const match=manager.matchLocation(121.49,31.223,'gps');
   const noMore=manager.matchLocation(120.15,30.26,'city');
   return {exists:!!match,code:match?.spec.code,complete:match?.complete,notCovered:!!noMore,
     tiles:Object.keys(window.FIELDNOTES_OFFLINE_TILES.tiles||{}).length};
  });
  assert(empty.exists&&empty.code==='310101'&&empty.complete&&empty.tiles===0);
  assert(!empty.notCovered,'Hangzhou may not be claimed as Shanghai local coverage');
  // Existing source, no Web API fetch other than local pack file; use the public QA polygon only.
  const installed=await page.evaluate(async()=>{
   const m=window.FIELDNOTES_PACK_MANAGER,spec=m.catalog.find(x=>x.code==='310101');
   await m.install(spec);
   return {bytes:(await m.installedInfo(spec))?.bytes||0,keys:Object.keys(window.FIELDNOTES_OFFLINE_TILES.tiles).length};
  });
  assert(installed.bytes>1000000&&installed.keys===9);
  const map=await page.evaluate(async()=>{
   const f=window.FIELDNOTES_STREETS.streets,lon=121.49,lat=31.223;
   const out={};
   for(const level of ['county','city','gps']){
    const d=await f(lon,lat,level);
    out[level]={zoom:d.zoom,requestedZoom:d.requestedZoom,zoomFallback:d.zoomFallback,
      sources:d.sources,partial:d.partial,roads:d.roads.length,
      water:d.water.length,river:d.river.length,
      buildings:d.buildings?.length||0,
      rings:d.buildings?.slice(0,8).reduce((n,x)=>n+x[1].length,0)};
   }
   return out;
  });
  console.log('MAP_P0_ZOOM_BUILDINGS',JSON.stringify(map));
  assert.equal(map.county.zoom,13);
  assert.equal(map.county.requestedZoom,13);
  assert.equal(map.city.requestedZoom,12);
  assert.equal(map.city.zoom,13,'city must use the installed Z13 instead of trying uncached Z12');
  assert.equal(map.gps.requestedZoom,14);
  assert.equal(map.gps.zoom,13,'GPS must retain real Z13 precision without pretending Z14');
  assert(map.city.zoomFallback&&map.gps.zoomFallback);
  for(const level of ['county','city','gps']){
   const d=map[level];
   assert(d.roads>250,'Missing real road geometry: '+level);
   assert(d.buildings>200,'Building MVT layer decoded too sparsely: '+level);
   assert(d.sources>0);
  }
  // Cold offline restart: all real layers must remain, with no overseas requests.
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  const offline=await page.evaluate(async()=>{
   await window.FIELDNOTES_PACK_MANAGER.ready;
   const d=await window.FIELDNOTES_STREETS.streets(121.49,31.223,'gps');
   return {zoom:d.zoom,buildings:d.buildings.length,roads:d.roads.length,sources:d.sources};
  });
  console.log('MAP_P0_OFFLINE_COLD_RESTART',JSON.stringify(offline));
  assert.equal(offline.zoom,13);
  assert(offline.roads>250&&offline.buildings>200);
  // Rendering pass: count evenodd building fills (distinct from data existence).
  await page.evaluate(()=>{
   const proto=CanvasRenderingContext2D.prototype;
   window.__p0EvenOddCalls=0;
   const old=proto.fill;
   proto.fill=function(rule){if(rule==='evenodd')window.__p0EvenOddCalls++;return old.apply(this,arguments);};
  });
  const png=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=960;c.height=680;
   const k=c.getContext('2d');k.fillStyle='#a9cde0';k.fillRect(0,0,960,680);
   k.fillStyle='#578653';k.fillRect(0,240,960,440);
   k.fillStyle='#f2eddb';k.fillRect(70,65,460,250);
   return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#v36NativeUpload').setInputFiles({name:'synthetic-map-test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>!document.getElementById('v36Picture').hidden,{timeout:25000});
  await page.locator('#v36Location').fill('黄浦区');
  await page.locator('#v36Choices button').filter({hasText:'黄浦区'}).first().click();
  await page.waitForFunction(()=>document.getElementById('v39MapOffer').dataset.kind==='installed',{timeout:15000});
  await page.locator('#v36Generate').click();
  await page.waitForFunction(()=>document.querySelectorAll('#v36Options canvas').length===6&&!document.getElementById('v36Generate').disabled,{timeout:80000});
  const drawn=await page.evaluate(()=>({count:window.__p0EvenOddCalls,info:window.FIELDNOTES_V37_DEBUG?.info,
    map:window.FIELDNOTES_V37_DEBUG?.getMap?.()?.buildings.length||0}));
  console.log('MAP_P0_RENDER',JSON.stringify(drawn));
  assert(drawn.count>0,'No real building polygons were painted into the selected compositions');
  assert(drawn.info?.detail?.includes('Z13'),'Source zoom must be transparently reported');
  await page.screenshot({path:path.join(screens,'map-p0-building-z13-chromium.png'),fullPage:true,animations:'disabled'});
  assert.equal(errors.length,0,errors.join('; '));
  console.log('PASS P0 real MVT: downloaded Z13 matches city/GPS/county, buildings parsed/painted, offline reopens');
 }catch(e){
  if(page)await page.screenshot({path:path.join(screens,'map-p0-failure.png'),fullPage:true}).catch(()=>{});
  throw e;
 }finally{if(context)await context.close();if(browser)await browser.close();await new Promise(ok=>srv.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
