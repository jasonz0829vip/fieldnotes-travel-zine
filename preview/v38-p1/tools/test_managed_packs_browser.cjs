#!/usr/bin/env node
/* Real Chromium smoke test for Cache Storage and offline PWA behavior.
   Runs in CI; NOT a substitute for testing physical Chinese phones. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.json':'application/json','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json',
  '.txt':'text/plain'};
function server() {
  return http.createServer((req,res)=>{
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      const decoded=decodeURIComponent(url.pathname);
      const target=path.resolve(root,'.'+decoded);
      if(!(target===root||target.startsWith(root+path.sep))) throw Error('Invalid path');
      const file=fs.statSync(target).isDirectory()?path.join(target,'index.html'):target;
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream',
        'Cache-Control':'no-store'});
      res.end(fs.readFileSync(file));
    }catch(error){res.writeHead(404);res.end('Not found');}
  });
}
(async()=>{
  const srv=server();
  await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
  const address='http://127.0.0.1:'+srv.address().port+'/';
  const exe=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p));
  let browser;
  try {
    browser=await chromium.launch({headless:true,args:['--no-sandbox'],
      ...(exe?{executablePath:exe}:{})});
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
    const page=await context.newPage();
    page.on('pageerror',e=>console.warn('Browser page error:',e.message));
    await page.goto(address,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('#fn38StorageBtn',{state:'attached',timeout:15000});
    const ready=await page.evaluate(async()=>{
      await window.FIELDNOTES_PACK_MANAGER.ready;
      await navigator.serviceWorker.ready;
      return {maps:Object.keys(window.FIELDNOTES_OFFLINE_TILES.tiles).length,
        names:await caches.keys()};
    });
    assert.equal(ready.maps,0,'initially no detailed street map should be downloaded');
    assert(!ready.names.some(name=>name.startsWith('fn38p1-pack-')));

    if (await page.locator('#v39Settings').count()) {
      await page.locator('#v39Settings summary').click();
    }
    await page.locator('#fn38StorageBtn').click();
    await page.locator('#fn38StorageDialog').waitFor({state:'visible'});
    const shanghai=page.locator('.fn38PackRow').filter({hasText:'上海·黄浦'});
    await shanghai.getByRole('button',{name:'下载地图'}).click();
    await page.waitForFunction(()=>window.FIELDNOTES_OFFLINE_TILES?.regions?.some(x=>x.code==='310101'));
    const state=await page.evaluate(async()=>{
      const pack=window.FIELDNOTES_PACK_MANAGER.catalog.find(x=>x.code==='310101');
      const info=await window.FIELDNOTES_PACK_MANAGER.installedInfo(pack);
      return {size:info?.bytes||0,count:Object.keys(window.FIELDNOTES_OFFLINE_TILES.tiles).length};
    });
    assert(state.size>1000000&&state.count===9,'Shanghai map pack must be really persisted');

    await page.locator('#fn38StorageDialog .fn38Controls button').last().click();
    await context.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.FIELDNOTES_OFFLINE_TILES?.regions?.some(x=>x.code==='310101'),{timeout:15000});
    const offlineCount=await page.evaluate(async()=>{
      await window.FIELDNOTES_PACK_MANAGER.ready;
      return Object.keys(window.FIELDNOTES_OFFLINE_TILES.tiles).length;
    });
    assert.equal(offlineCount,9,'cold offline open must restore cached street data');

    if (await page.locator('#v39Settings').count()) {
      await page.locator('#v39Settings summary').click();
    }
    await page.locator('#fn38StorageBtn').click();
    await page.locator('.fn38PackRow').filter({hasText:'上海·黄浦'})
      .getByRole('button',{name:'删除地图'}).click();
    await page.waitForTimeout(850);
    const after=await page.evaluate(async()=>{
      if(window.FIELDNOTES_PACK_MANAGER)await window.FIELDNOTES_PACK_MANAGER.ready;
      return {keys:await caches.keys(),tiles:Object.keys(window.FIELDNOTES_OFFLINE_TILES?.tiles||{}).length};
    });
    assert(!after.keys.some(name=>name.startsWith('fn38p1-pack-310101-')));
    assert.equal(after.tiles,0,'removed pack must stay removed after reload');
    assert(after.keys.some(name=>name.startsWith('fn38p1-offline-shell-')),'shell survives map deletion');

    console.log('PASS Chromium: online install -> offline cold restart -> delete region -> shell preserved');
    await context.close();
  }finally{if(browser)await browser.close();await new Promise(resolve=>srv.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});