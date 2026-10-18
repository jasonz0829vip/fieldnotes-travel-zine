#!/usr/bin/env node
/* Cross-city national provider contract: real PMTiles built from ODbL Hainan OSM data.
 * Used only in CI on a loopback HTTP Range server. Never publishes user photos or
 * downloaded tiles. Tests Haikou, NOT one of the old three demo regions.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const archive=process.env.FN_PMTILES_FILE;
if(!archive||!fs.existsSync(archive))throw Error('FN_PMTILES_FILE must refer to the isolated Hainan build');
const types={'.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8',
 '.json':'application/json','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
let partialReads=0;
const index={version:1,sources:[{
 id:'hainan-real-osm-ci',name:'海南省 OpenStreetMap 独立研究包',
 type:'pmtiles',schema:'openmaptiles',zoom:14,
 bounds:[108,18,111.5,20.4],url:'./maps/hainan.pmtiles',
 sourceName:'Geofabrik/OpenStreetMap'
}]};
function server(){
 return http.createServer((req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1'),pathname=decodeURIComponent(url.pathname);
   if(pathname==='/data/national-map-index-v1.json'){
    const body=JSON.stringify(index);res.writeHead(200,{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'});res.end(body);return;
   }
   if(pathname==='/maps/hainan.pmtiles'){
    const stat=fs.statSync(archive),range=req.headers.range;
    res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Type','application/octet-stream');
    if(range){
     const match=/^bytes=(\d+)-(\d*)$/.exec(range);
     if(!match)throw Error('Unsupported Range header '+range);
     const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1;
     if(start<0||end<start||start>=stat.size){res.writeHead(416);res.end();return;}
     partialReads++;
     res.writeHead(206,{'Content-Range':'bytes '+start+'-'+end+'/'+stat.size,'Content-Length':end-start+1});
     fs.createReadStream(archive,{start,end}).pipe(res);return;
    }
    throw Error('PMTiles must be read via bounded HTTP Range, not entire archive');
   }
   const file=path.resolve(root,'.'+pathname);
   if(!(file===root||file.startsWith(root+path.sep)))throw Error('Invalid path');
   const target=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
   res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});
   res.end(fs.readFileSync(target));
  }catch(_){res.writeHead(404);res.end('Not found');}
 });
}
(async()=>{
 const srv=server();await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
 const address='http://127.0.0.1:'+srv.address().port+'/';
 const exe=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
 let browser,ctx,page;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(exe?{executablePath:exe}:{})});
  ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
  page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(address,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.FIELDNOTES_NATIONAL_MAP?.ready,{timeout:10000});
  const present=await page.evaluate(async()=>{
   await window.FIELDNOTES_NATIONAL_MAP.ready;
   return window.FIELDNOTES_NATIONAL_MAP.status(110.1999,20.0442,'city');
  });
  assert.equal(present.kind,'candidate','Archive must be discoverable beyond the three legacy regions');
  const png=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=900;c.height=700;const g=c.getContext('2d');
   g.fillStyle='#86c8de';g.fillRect(0,0,900,700);g.fillStyle='#e2e8e1';g.fillRect(60,100,600,400);
   g.fillStyle='#42675c';g.fillRect(180,210,150,400);
   return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#v36NativeUpload').setInputFiles({name:'nonprivate-haikou-scene.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>!document.getElementById('v36Picture').hidden,{timeout:20000});
  await page.locator('#v36Location').fill('海口市');
  await page.locator('#v36Choices button').filter({hasText:'海口市'}).first().click();
  await page.waitForFunction(()=>document.getElementById('v39MapOffer').dataset.kind==='offer',{timeout:12000});
  assert((await page.locator('#v39MapMessage').innerText()).includes('已配置'));
  await page.locator('#v39MapDownload').click();
  await page.waitForFunction(()=>document.getElementById('v39MapOffer').dataset.kind==='installed',{timeout:80000});
  const stored=await page.evaluate(async()=>{
   const m=window.FIELDNOTES_NATIONAL_MAP,entry=m.listDownloads()[0];
   const p=m.bestInstalled(state.centerLon,state.centerLat);
   return {count:m.listDownloads().length,entry,coverage:p};
  });
  assert.equal(stored.count,1,'Haikou must be a dynamic download, not an old fixed pack');
  assert.equal(stored.entry.zoom,14);
  assert(stored.entry.tileCount>=1&&stored.entry.bytes>1000);
  assert.equal(stored.coverage.zoom,14);
  assert(partialReads>=1,'Browser must read PMTiles using HTTP Range, not fetch full archive');
  await page.locator('#v36Generate').click();
  await page.waitForFunction(()=>document.querySelectorAll('#v36Options canvas').length===6&&!document.getElementById('v36Generate').disabled,{timeout:80000});
  const geographic=await page.evaluate(()=>{
   const d=window.FIELDNOTES_V37_DEBUG?.getMap?.();
   return {zoom:d?.zoom,roads:d?.roads?.length||0,buildings:d?.buildings?.length||0,sources:d?.sources||0};
  });
  assert.equal(geographic.zoom,14);
  assert(geographic.roads>10,'Haikou real road geometry must be drawn');
  await page.screenshot({path:path.join(__dirname,'haikou-real-national-preview.png'),fullPage:true,animations:'disabled'});

  await ctx.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:25000});
  const offline=await page.evaluate(async()=>{
   await window.FIELDNOTES_NATIONAL_MAP.ready;
   return window.FIELDNOTES_NATIONAL_MAP.bestInstalled(110.1999,20.0442);
  });
  assert(offline?.zoom===14,'Local Z14 tiles must survive offline PWA reload');

  const deleted=await page.evaluate(async()=>{
   const m=window.FIELDNOTES_NATIONAL_MAP,id=m.listDownloads()[0].id;
   await m.removeBundle(id);
   return {remaining:m.listDownloads().length,coverage:m.bestInstalled(110.1999,20.0442)};
  });
  assert.equal(deleted.remaining,0);
  assert.equal(deleted.coverage,null);
  assert.equal(errors.length,0,errors.join(' / '));
  console.log('NATIONAL_PM_REAL',JSON.stringify({place:'海口市',zoom:geographic.zoom,
   tileCount:stored.entry.tileCount,downloadedBytes:stored.entry.bytes,
   roads:geographic.roads,buildings:geographic.buildings,
   archiveBytes:fs.statSync(archive).size,httpRangeReads:partialReads,
   cachedOffline:true,removed:true}));
  console.log('PASS national: Haikou real PMTiles Z14 -> photo previews -> offline cache -> regional deletion');
 }catch(e){
  if(page)await page.screenshot({path:path.join(__dirname,'haikou-national-failure.png'),fullPage:true}).catch(()=>{});
  throw e;
 }finally{if(ctx)await ctx.close();if(browser)await browser.close();await new Promise(ok=>srv.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
