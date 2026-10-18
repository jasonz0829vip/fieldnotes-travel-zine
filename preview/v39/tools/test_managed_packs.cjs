#!/usr/bin/env node
/* Focused automated tests of P1 removable maps. No phone simulation is claimed. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const manager=read('offline-pack-manager-v38.js');
const html=read('index.html');
const sw=read('sw.js');
const catalog=[
  {code:'469028',name:'海南·陵水'},
  {code:'310101',name:'上海·黄浦'},
  {code:'610113',name:'陕西·西安雁塔'}
];
const sourceText=read('offline-tiles-v38.js').trim();
const marker='window.FIELDNOTES_OFFLINE_TILES=';
const original=JSON.parse(sourceText.slice(sourceText.indexOf(marker)+marker.length).replace(/;\s*$/,''));

function verifyStatic(){
  new vm.Script(manager,{filename:'offline-pack-manager-v38.js'});
  new vm.Script(sw,{filename:'sw.js'});
  assert(!html.includes('<script src="./offline-tiles-v38.js">'));
  assert(html.includes('<script src="./offline-pack-manager-v38.js">'));
  assert(html.indexOf('<script src="./v38-map-core.js">')<html.indexOf('<script src="./offline-pack-manager-v38.js">'));
  assert(html.indexOf('<script src="./offline-pack-manager-v38.js">')<html.indexOf('<script src="./v37-editorial.js">'));
  const match=html.match(/const V33_CACHE_KEY='([^']+)'/);
  assert(match&&sw.includes('const CACHE=\''+match[1]+'\''));
  assert(!sw.includes("'./offline-tiles-v38.js'"));
  assert(sw.includes("k.startsWith('fn39-offline-shell-')"));
  assert(!sw.includes("k.startsWith('fn39-')"));
  let bytes=0;
  const seen=new Set();
  for (const spec of catalog){
    let pack;
    vm.runInNewContext(read('packs/'+spec.code+'.js'),{
      window:{FIELDNOTES_REGISTER_REGION_PACK(value){pack=value;}}
    });
    assert(pack,'pack must register');
    assert.equal(pack.code,spec.code);
    assert.equal(pack.region,spec.name);
    assert.equal(pack.source,original.source);
    assert.equal(pack.attribution,original.attribution);
    assert.equal(pack.tileKeys.length,9);
    for(const key of pack.tileKeys){
      assert(!seen.has(key),'duplicate tile '+key);
      seen.add(key);
      assert.equal(pack.tiles[key],original.tiles[key]);
      bytes+=Buffer.from(pack.tiles[key],'base64').byteLength;
    }
  }
  assert.equal(seen.size,27);
  assert.equal(bytes,1686996);
}

class MemoryCache{
  constructor(){this.entries=new Map();}
  async put(key,response){this.entries.set(String(key),response.clone());}
  async match(key){return this.entries.get(String(key))?.clone();}
}
class MemoryCacheStorage{
  constructor(){this.caches=new Map();}
  async keys(){return [...this.caches.keys()];}
  async open(name){if(!this.caches.has(name))this.caches.set(name,new MemoryCache());return this.caches.get(name);}
  async delete(name){return this.caches.delete(name);}
}
async function createHarness(storage, options={}){
  const blobURLs=new Map();let seq=0,reloads=0,unregistered=0,fetches=0,ctx;
  const ROOT='https://example.test/preview/v38-p1/';
  class TestURL extends URL{}
  TestURL.createObjectURL=blob=>{const id='blob:fieldnotes-test/'+(++seq);blobURLs.set(id,blob);return id;};
  TestURL.revokeObjectURL=id=>{blobURLs.delete(id);};
  const location={href:ROOT+'index.html',origin:'https://example.test',protocol:'https:',
    reload(){reloads++;}};
  const window={
    FIELDNOTES_OFFLINE_TILES:{tiles:{},regions:[]},
    FIELDNOTES_STREETS:{async streets(){return {tileCount:Object.keys(window.FIELDNOTES_OFFLINE_TILES.tiles).length};}}
  };
  const document={
    currentScript:{src:ROOT+'offline-pack-manager-v38.js'},
    getElementById(){return null;},
    createElement(type){
      assert.equal(type,'script');
      return {src:'',onload:null,onerror:null,remove(){}};
    },
    head:{
      append(script){
        (async()=>{
          const blob=blobURLs.get(script.src);
          if(!blob) throw Error('Unexpected script URL '+script.src);
          vm.runInContext(await blob.text(),ctx);
          script.onload?.();
        })().catch(err=>{script.onerror?.(err);});
      }
    }
  };
  const fetch=async url=>{
    fetches++;
    if(options.offline)throw Error('Unexpected network request during offline startup');
    const match=String(url).match(/\/packs\/(\d{6})\.js$/);
    assert(match,'unexpected fetch: '+url);
    const file=path.join(root,'packs',match[1]+'.js');
    const blob=new Blob([fs.readFileSync(file)],{type:'application/javascript'});
    return {ok:true,status:200,url:String(url),async blob(){return blob;}};
  };
  const navigator={storage:{async estimate(){return {usage:1800000};}},
    serviceWorker:{async getRegistration(scope){assert.equal(scope,ROOT);return {
      scope:ROOT,async unregister(){unregistered++;return true;}
    };}}};
  ctx=vm.createContext({
    window,document,location,caches:storage,navigator,Blob,Response,URL:TestURL,fetch,
    confirm:()=>true,setTimeout:fn=>fn(),console
  });
  vm.runInContext(manager,ctx);
  const api=window.FIELDNOTES_PACK_MANAGER;
  assert(api,'manager API exists');
  await api.ready;
  return {api,window,get reloads(){return reloads;},get unregistered(){return unregistered;},
    get fetches(){return fetches;}};
}

async function verifyLifeCycle(){
  const storage=new MemoryCacheStorage();
  let first=await createHarness(storage);
  assert.deepEqual(await storage.keys(),[],'first visit downloads no street tiles');
  const spec=first.api.catalog[1];
  await first.api.install(spec);
  assert.equal(first.window.FIELDNOTES_OFFLINE_TILES.regions.length,1);
  assert.equal(Object.keys(first.window.FIELDNOTES_OFFLINE_TILES.tiles).length,9);
  const installed=await first.api.installedInfo(spec);
  assert(installed?.bytes>1000000,'Shanghai package is individually cached');
  assert.equal(first.fetches,1);

  const offline=await createHarness(storage,{offline:true});
  assert.equal(offline.fetches,0,'restart loads cached map without internet');
  assert.equal(Object.keys(offline.window.FIELDNOTES_OFFLINE_TILES.tiles).length,9);
  assert.equal((await offline.window.FIELDNOTES_STREETS.streets()).tileCount,9);

  await offline.api.remove(offline.api.catalog[1]);
  assert.equal(Object.keys(offline.window.FIELDNOTES_OFFLINE_TILES.tiles).length,0);
  assert.equal((await storage.keys()).filter(k=>k.includes('pack-')).length,0);
  assert.equal(offline.reloads,1);

  await first.api.install(first.api.catalog[0]);
  await first.api.install(first.api.catalog[2]);
  await first.api.clearMaps();
  assert.equal((await storage.keys()).filter(k=>k.includes('pack-')).length,0);

  await first.api.install(first.api.catalog[0]);
  await storage.open('other-app-cache-20261018');
  await storage.open('fn38p1-offline-shell-20261018-2');
  await storage.open('fn38p1-pack-310101-20261018-1');
  await storage.open('fn39-offline-shell-20261018-2');
  await first.api.clearApplication();
  assert.deepEqual(await storage.keys(),[
    'other-app-cache-20261018','fn38p1-offline-shell-20261018-2','fn38p1-pack-310101-20261018-1'
  ], 'deleting V3.9 must never delete legacy V3.8-P1 regional maps or app shell');
  assert.equal(first.unregistered,1);
}

(async()=>{
  verifyStatic();
  await verifyLifeCycle();
  console.log('PASS: 27 OSM tiles intact, no automatic region download, selective install/remove, offline restore, scoped full cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});