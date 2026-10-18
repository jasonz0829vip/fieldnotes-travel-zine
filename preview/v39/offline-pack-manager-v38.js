/* FIELDNOTES P1 · independently cached maps and explicit storage cleanup.
   No uploaded photos, GPS or image projects are stored here. */
(() => {
  'use strict';
  const ROOT = new URL('./', document.currentScript?.src || location.href);
  const PREFIX = 'fn38p1-';
  const PACKS = Object.freeze([
    {code:'469028',key:'lingshui-center',name:'海南·陵水',zoom:13,center:[110.037,18.505]},
    {code:'310101',key:'shanghai-huangpu',name:'上海·黄浦',zoom:13,center:[121.49,31.223]},
    {code:'610113',key:'xian-yanta',name:'西安·雁塔',zoom:13,center:[108.927,34.213]}
  ]);
  const fileMode = location.protocol === 'file:';
  const supported = !fileMode && typeof caches !== 'undefined';
  const registry = window.FIELDNOTES_OFFLINE_TILES || {tiles:{},regions:[]};
  registry.tiles ||= {};
  registry.regions ||= [];
  window.FIELDNOTES_OFFLINE_TILES = registry;
  const loaded = new Set();
  let busy = false;
  let dialog, list, message, footprint, openButton;
  const packUrl = spec => new URL('packs/' + spec.code + '.js', ROOT).href;
  const packCache = spec => PREFIX + 'pack-' + spec.code + '-20261018-1';
  const friendly = bytes => bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(2) + ' MB';

  function registerPack(pack) {
    const spec = PACKS.find(x => x.code === pack?.code);
    if (!spec || pack.version !== 'v38-map-pack-1' ||
        !Array.isArray(pack.tileKeys) || pack.tileKeys.length !== 9 ||
        !pack.tiles || Object.keys(pack.tiles).length !== 9 ||
        !pack.tileKeys.every(k => /^\d+\/\d+\/\d+$/.test(k) && typeof pack.tiles[k] === 'string')) {
      throw Error('街道包结构或版本不正确');
    }
    Object.assign(registry.tiles, pack.tiles);
    if (!registry.regions.some(x => x.code === spec.code)) {
      registry.regions.push({code:spec.code,key:spec.key,region:spec.name,zoom:spec.zoom,
        tileKeys:[...pack.tileKeys]});
    }
    loaded.add(spec.code);
  }
  window.FIELDNOTES_REGISTER_REGION_PACK = registerPack;

  async function executePack(response, spec) {
    const blob = await response.blob();
    if (blob.size < 1000 || blob.size > 5 * 1024 * 1024) throw Error('地图包大小异常');
    const objectUrl = URL.createObjectURL(blob);
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = objectUrl;
        script.onload = () => { script.remove(); resolve(); };
        script.onerror = () => { script.remove(); reject(Error('浏览器未能加载本地地图包')); };
        document.head.append(script);
      });
      if (!loaded.has(spec.code)) throw Error('街道包没有正确注册');
    } finally { URL.revokeObjectURL(objectUrl); }
  }

  async function loadStaticPack(spec) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = packUrl(spec);
      script.onload = () => { script.remove(); resolve(); };
      script.onerror = () => { script.remove(); reject(Error('缺少本地文件 ' + spec.code + '.js')); };
      document.head.append(script);
    });
    if (!loaded.has(spec.code)) throw Error('本地街道包无效');
  }

  async function installedInfo(spec) {
    if (!supported) return null;
    const keys = await caches.keys();
    if (!keys.includes(packCache(spec))) return null;
    const response = await (await caches.open(packCache(spec))).match(packUrl(spec));
    if (!response) return null;
    const blob = await response.clone().blob();
    return {response, bytes:blob.size};
  }

  // Derive availability from actual three-by-three OSM tile footprints, not a whole city name.
  // Only the center tile guarantees a complete surrounding 3x3; neighboring tiles are partial.
  function matchLocation(lon, lat, level = 'county') {
    if (level === 'province' || !Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    const xyz = window.FIELDNOTES_STREETS?.xyz;
    if (typeof xyz !== 'function') return null;
    for (const spec of PACKS) {
      const at = xyz(lon, lat, spec.zoom), center = xyz(spec.center[0], spec.center[1], spec.zoom);
      const dx = Math.abs(at.x - center.x), dy = Math.abs(at.y - center.y);
      if (dx === 0 && dy === 0) return {spec,coverage:'center',complete:true};
      if (dx <= 1 && dy <= 1) return {spec,coverage:'edge',complete:false};
    }
    return null;
  }

  function notifyMapsChanged(code, installed) {
    window.FIELDNOTES_V37_DEBUG?.invalidate?.();
    if (typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('fieldnotes:maps-changed',{detail:{code,installed}}));
    }
  }

  function updateSummary() {
    const el = document.getElementById('v36AtlasCount');
    if (!el) return;
    const prefix = el.textContent.split(' · ')[0];
    const installed = registry.regions.map(x => x.region);
    el.textContent = prefix + (installed.length
      ? ' · 已装精细街道：' + installed.join('、') + '（均为中心局部区域）'
      : ' · 精细街道地图可按地区下载；其他地点使用真实行政轮廓。');
  }

  const ready = (async () => {
    if (fileMode) {
      for (const spec of PACKS) {
        try { await loadStaticPack(spec); } catch (e) { console.warn('本地街道包未加载',spec.code,e); }
      }
      return;
    }
    if (!supported) return;
    const available = await caches.keys();
    for (const spec of PACKS) {
      if (!available.includes(packCache(spec))) continue;
      try {
        const entry = await installedInfo(spec);
        if (!entry) { await caches.delete(packCache(spec)); continue; }
        await executePack(entry.response, spec);
      } catch (e) {
        console.warn('损坏或已回收的地图包，回退行政边界',spec.code,e);
        await caches.delete(packCache(spec));
      }
    }
  })().catch(e => console.warn('地图缓存检查失败；基础地图继续可用', e));

  // Before the editorial wrapper runs, guard against a fast user click during cold offline startup.
  const streets = window.FIELDNOTES_STREETS;
  if (streets?.streets) {
    const original = streets.streets;
    streets.streets = async function (...args) {
      await ready;
      return original.apply(this, args);
    };
  }
  ready.then(() => { updateSummary(); if (dialog?.open) render(); });

  function setMessage(value, error = false) {
    if (!message) return;
    message.textContent = value;
    message.dataset.error = String(error);
  }

  async function render() {
    if (!dialog || !list) return;
    list.replaceChildren();
    for (const spec of PACKS) {
      let info = null;
      try { info = await installedInfo(spec); } catch (_) {}
      const row = document.createElement('div');
      row.className = 'fn38PackRow';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = spec.name;
      const detail = document.createElement('small');
      detail.textContent = fileMode ? 'Windows 离线目录自带 · 请在文件管理器删除'
        : info ? '已下载：' + friendly(info.bytes) + ' · 仅覆盖中心局部街道'
          : '未下载 · 全国行政区轮廓仍可使用';
      copy.append(title,detail);
      row.append(copy);
      if (!fileMode) {
        const action = document.createElement('button');
        action.type = 'button';
        action.disabled = busy || !supported;
        action.textContent = info ? '删除地图' : '下载地图';
        action.addEventListener('click', () => run(() => info ? remove(spec) : install(spec)));
        row.append(action);
      }
      list.append(row);
    }
    if (footprint) {
      if (!supported) footprint.textContent = fileMode
        ? '本地文件模式无法删除磁盘文件；删除解压目录即可彻底移除地图和程序。'
        : '当前浏览器未提供可管理的离线缓存；基础行政地图仍可用。';
      else {
        let bytes = 0;
        for (const spec of PACKS) {
          try { bytes += (await installedInfo(spec))?.bytes || 0; } catch (_) {}
        }
        let site = '';
        if (navigator.storage?.estimate) {
          try {
            const estimate = await navigator.storage.estimate();
            if (Number.isFinite(estimate.usage)) site = '；本网站总占用约 ' + friendly(estimate.usage) + '（包含同域名其他版本）';
          } catch (_) {}
        }
        footprint.textContent = '已安装街道文件约 ' + friendly(bytes) + site + '。实际释放空间由系统统计，可能有延迟。';
      }
    }
    updateSummary();
  }

  async function run(action) {
    if (busy) return;
    busy = true;
    await render();
    try { await action(); }
    catch (e) { setMessage('操作未完成：' + (e?.message || String(e)), true); }
    finally { busy = false; await render(); }
  }

  async function install(spec) {
    if (!supported) throw Error('此运行方式不支持下载缓存');
    const url = packUrl(spec);
    const response = await fetch(url, {cache:'no-store',credentials:'omit'});
    if (!response.ok || new URL(response.url).origin !== location.origin) {
      throw Error('国内网络无法下载地图包（HTTP ' + response.status + '）');
    }
    const blob = await response.blob();
    if (blob.size < 1000 || blob.size > 5 * 1024 * 1024) throw Error('地图包异常，未安装');
    const name = packCache(spec);
    await (await caches.open(name)).put(url, new Response(blob,{headers:{'Content-Type':'application/javascript'}}));
    try {
      await executePack(new Response(blob), spec);
    } catch (e) { await caches.delete(name); throw e; }
    notifyMapsChanged(spec.code,true);
    setMessage(spec.name + ' 已缓存到本机（' + friendly(blob.size) + '）。断网重新打开仍可使用。');
  }

  async function remove(spec) {
    if (!supported) throw Error('本地磁盘文件需在文件管理器中删除');
    await caches.delete(packCache(spec));
    const region = registry.regions.find(x => x.code === spec.code);
    for (const key of region?.tileKeys || []) delete registry.tiles[key];
    registry.regions = registry.regions.filter(x => x.code !== spec.code);
    loaded.delete(spec.code);
    notifyMapsChanged(spec.code,false);
    setMessage(spec.name + ' 的独立离线缓存已删除。页面将刷新，以清掉内存中的地图数据。');
    setTimeout(() => location.reload(), 650);
  }

  async function clearMaps() {
    if (!supported) throw Error('本地磁盘文件需在文件管理器中删除');
    if (!confirm('删除本版本下载的全部街道地图？基础离线制图仍可使用，已导出到相册的照片不受影响。')) return;
    for (const spec of PACKS) await caches.delete(packCache(spec));
    registry.tiles = {};
    registry.regions = [];
    loaded.clear();
    setMessage('全部已下载地图已删除。页面将刷新以清掉内存地图数据。');
    setTimeout(() => location.reload(), 650);
  }

  async function clearApplication() {
    if (!supported) throw Error('本地磁盘文件需在文件管理器中删除');
    if (!confirm('这将清除 FIELDNOTES V3.8-P1 的离线程序及街道缓存。以后必须联网重新打开才能安装；不会删除手机相册、下载文件或其他版本的网页。确定继续？')) return;
    const keys = await caches.keys();
    for (const name of keys.filter(x => x.startsWith(PREFIX))) await caches.delete(name);
    const scope = ROOT.href;
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration(scope);
      if (registration?.scope === scope) await registration.unregister();
    }
    registry.tiles = {}; registry.regions = []; loaded.clear();
    setMessage('本版本离线缓存已删除。关闭本页后需联网重新打开；如需彻底移除桌面入口，请再删除主屏幕图标。浏览器 HTTP 缓存可能需在系统网站数据中清理。');
  }

  function makeButton(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => run(handler));
    return button;
  }
  function mount() {
    const existing = document.getElementById('v33InstallBtn');
    if (!existing) return;
    const style = document.createElement('style');
    style.textContent = '#fn38StorageDialog{border:0;border-radius:15px;background:#fafaf6;color:#243e34;max-width:min(530px,calc(100vw - 16px));width:100%;max-height:85dvh;overflow:auto;padding:19px;box-shadow:0 25px 85px #152b2855}' +
      '#fn38StorageDialog::backdrop{background:#071b17a8}' +
      '#fn38StorageDialog h2{font-size:19px;margin:0 0 12px}' +
      '#fn38StorageDialog p{font-size:12px;line-height:1.6;color:#62746a}' +
      '.fn38PackRow{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #e1e8df;padding:12px 0}' +
      '.fn38PackRow strong{display:block;font-size:13px}.fn38PackRow small{display:block;color:#74867c;font-size:11px;margin-top:5px;line-height:1.5}' +
      '#fn38StorageDialog button{background:white;border:1px solid #b8c9bb;border-radius:8px;padding:9px 12px;cursor:pointer;color:#28523c;font-size:12px}' +
      '#fn38StorageDialog button:disabled{opacity:.5}' +
      '#fn38StorageDialog .fn38Danger{color:#b4473b;border-color:#e4b6ae}' +
      '#fn38StorageDialog .fn38Controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}' +
      '#fn38StorageStatus[data-error=true]{color:#b4473b}';
    document.head.append(style);
    const holder = document.createElement('div');
    holder.className = 'v33InstallAction';
    // The normal phone flow hides the legacy .layout. Put its entry in the visible simple UI.
    const basic = document.querySelector('#v39Settings .v39-settings-panel') || document.querySelector('#v36Flow .v36-extras');
    openButton = document.createElement('button');
    openButton.id = 'fn38StorageBtn';
    openButton.type = 'button';
    openButton.textContent = '🗺 离线地图 / 存储管理';
    if (basic) basic.append(openButton);
    else holder.append(openButton);
    const advancedButton = document.createElement('button');
    advancedButton.id = 'fn38StorageBtnAdvanced';
    advancedButton.type = 'button';
    advancedButton.textContent = '🗺 离线地图 / 存储管理';
    holder.append(advancedButton);
    existing.parentElement.insertAdjacentElement('afterend', holder);
    dialog = document.createElement('dialog');
    dialog.id = 'fn38StorageDialog';
    dialog.setAttribute('aria-label','离线地图与存储管理');
    dialog.innerHTML = '<h2>离线地图与存储管理</h2>' +
      '<p>精细街道按地区独立下载和删除；没有下载的地区仍可使用全国真实行政区轮廓。不会上传你的照片。</p>' +
      '<div id="fn38StorageList"></div><p id="fn38StorageFootprint"></p>' +
      '<div class="fn38Controls" id="fn38StorageControls"></div>' +
      '<p id="fn38StorageStatus" role="status" aria-live="polite"></p>';
    document.body.append(dialog);
    list = dialog.querySelector('#fn38StorageList');
    footprint = dialog.querySelector('#fn38StorageFootprint');
    message = dialog.querySelector('#fn38StorageStatus');
    const controls = dialog.querySelector('#fn38StorageControls');
    const mapClear = makeButton('删除所有街道地图',clearMaps);
    const allClear = makeButton('清除本版本离线程序和地图',clearApplication);
    allClear.className = 'fn38Danger';
    if (fileMode || !supported) {mapClear.disabled = true;allClear.disabled = true;}
    controls.append(mapClear,allClear,makeButton('关闭',async () => dialog.close()));
    for (const entry of [openButton, advancedButton]) entry.addEventListener('click', async () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open','');
      await ready; await render();
    });
    dialog.addEventListener('click', event => {if (event.target === dialog) dialog.close();});
  }
  mount();
  window.FIELDNOTES_PACK_MANAGER = Object.freeze({catalog:PACKS,ready,install,remove,clearMaps,clearApplication,installedInfo,matchLocation,refresh:render});
})();