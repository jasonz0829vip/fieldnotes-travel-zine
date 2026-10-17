/* FIELDNOTES V3.6 Android-only export compatibility.
 * Never runs on iPhone/iPad, never changes the existing Apple save implementation.
 * An Android in-app browser may block Web Share and file downloads; give usable feedback.
 */
(() => {
  'use strict';
  if (!/Android/i.test(navigator.userAgent)) return;
  const byId = id => document.getElementById(id);
  const dialog = byId('v33SaveDialog');
  const actions = dialog?.querySelector('.v33OutputActions');
  const share = byId('v33ShareBtn');
  const legacyDownload = byId('v33DownloadBtn');
  if (!dialog || !actions || !share || !legacyDownload) return;
  const help = dialog.querySelector('.v33DialogHint');
  if (help) help.textContent = '安卓端建议优先使用 Chrome。系统分享若不可用，可直接下载 PNG 文件；App 内置浏览器可能限制下载，请在 Chrome 打开页面。';

  const css = document.createElement('style');
  css.textContent = [
    '#v36AndroidDownload{display:flex;align-items:center;justify-content:center;min-height:48px;padding:9px 8px;',
    'border:1px solid #b7c6b8;background:white;border-radius:10px;color:#2e5140;font-size:13px;font-weight:700;text-decoration:none;text-align:center}',
    '#v36AndroidExportStatus{margin:10px 0 4px;padding:10px 12px;background:#edf4ec;color:#27533b;border-radius:10px;font-size:12px;line-height:1.6}',
    '#v36AndroidExportStatus[data-error="true"]{background:#fff1e6;color:#a14c31}',
    '#v36AndroidExportHint{margin:7px 0 4px;font-size:12px;line-height:1.55;color:#64776b}',
    '#v36AndroidOpenImage{font-size:12px;color:#255641;text-decoration:underline;display:inline-block;margin:4px 0 0}',
    '#v36AndroidDownload:focus-visible,#v36AndroidOpenImage:focus-visible{outline:2px solid #32674b;outline-offset:2px}'
  ].join('');
  document.head.append(css);

  // Replace the misleading scripted download on Android with a real user-tappable native link.
  legacyDownload.hidden = true;
  legacyDownload.style.display = 'none';
  const link = document.createElement('a');
  link.id = 'v36AndroidDownload';
  link.textContent = '下载 PNG 文件';
  link.setAttribute('aria-label', '下载生成的高清 PNG 文件');
  actions.append(link);

  const status = document.createElement('p');
  status.id = 'v36AndroidExportStatus';
  status.role = 'status';
  status.setAttribute('aria-live', 'polite');
  actions.insertAdjacentElement('afterend', status);

  const view = document.createElement('a');
  view.id = 'v36AndroidOpenImage';
  view.textContent = '打开高清图片，长按保存';
  view.target = '_blank';
  view.rel = 'noopener noreferrer';

  const hint = document.createElement('p');
  hint.id = 'v36AndroidExportHint';
  hint.append(view, document.createTextNode('。如果系统提示“请在浏览器打开”，请用 Chrome 打开 FIELDNOTES 再保存；某些 App 内置浏览器禁止下载与文件分享。'));
  status.insertAdjacentElement('afterend', hint);

  function message(text, error = false) {
    status.textContent = text;
    status.dataset.error = String(error);
  }
  function prepared() {
    // The original editor prepares the blob before showing the dialog.
    // Keep its file, name, and high-resolution image unchanged.
    try {
      return typeof v33Prepared !== 'undefined' ? v33Prepared : null;
    } catch (_) {
      return null;
    }
  }
  function refresh() {
    if (!dialog.open) return;
    const result = prepared();
    const url = typeof v33PreparedUrl !== 'undefined' ? v33PreparedUrl : null;
    if (!result || !url) {
      message('正在准备高清图片，请稍后再点保存。', true);
      link.removeAttribute('href');
      view.removeAttribute('href');
      return;
    }
    link.href = url;
    link.download = result.name;
    view.href = url;
    const agent = navigator.userAgent;
    const embedded = /\bwv\b|MicroMessenger|WeChat|QQ\/|Aweme|Douyin|ChatGPT/i.test(agent);
    const direct = typeof navigator.share === 'function';
    const isWechat = /MicroMessenger/i.test(agent);
    share.textContent = isWechat ? '微信内长按保存' : '系统分享 / 保存到相册';
    if (isWechat) {
      message('安卓微信：点击「微信内长按保存」进入高清图片，然后长按作品选择「保存图片」。图片不会上传服务器。');
      return;
    }
    message(embedded
      ? '当前可能处于 App 内置浏览器。可尝试系统分享；如果没有反应，建议在 Chrome 中打开本页面并点击「下载 PNG 文件」。'
      : direct
        ? '高清 PNG 已生成。可点系统分享；也可以直接下载 PNG，或打开大图长按保存。'
        : '高清 PNG 已生成。此浏览器未开放文件分享接口，请点「下载 PNG 文件」，或打开大图长按保存。', !direct);
  }

  // Old share listener is on the bubble phase. Stop only Android events, keeping iOS untouched.
  share.addEventListener('click', event => {
    // Android WeChat has its own real JPEG image long-press route.
    if (/MicroMessenger/i.test(navigator.userAgent)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const r = prepared();
    if (!r) return message('高清图仍在准备中，请稍后重试。', true);
    if (typeof navigator.share !== 'function') {
      return message('当前安卓浏览器未提供系统分享功能。请点「下载 PNG 文件」；若它要求打开浏览器，请改用 Chrome。', true);
    }
    let file;
    try {
      file = new File([r.blob], r.name, {type: 'image/png'});
      if (typeof navigator.canShare === 'function' && !navigator.canShare({files: [file]})) {
        return message('当前浏览器不允许将 PNG 作为文件分享。请改点「下载 PNG 文件」，或在 Chrome 打开页面。', true);
      }
      // Do not await before invoking share(): Android requires a fresh tap/user activation.
      message('正在请求安卓系统分享窗口…');
      const action = navigator.share({files: [file], title: 'FIELDNOTES 旅行摄影'});
      Promise.resolve(action).then(() => {
        message('系统分享流程已完成。如果需要图片进入相册，请在系统分享面板选择保存图片或相册应用。');
      }).catch(e => {
        if (e?.name === 'AbortError') message('你取消了系统分享。图片仍在这里，可以再分享或直接下载。');
        else message('系统分享未成功：' + (e?.message || '浏览器限制') + '。请点「下载 PNG 文件」，或从 Chrome 打开网页。', true);
      });
    } catch (e) {
      message('系统分享不可用：' + (e?.message || '当前浏览器不支持') + '。可以直接下载 PNG。', true);
    }
  }, true);

  link.addEventListener('click', event => {
    if (!link.href || !prepared()) {
      event.preventDefault();
      return message('高清图片未准备好，请关闭窗口后重新生成。', true);
    }
    message('已请求浏览器下载 PNG。通常可在「下载内容」中找到；如果系统要求打开浏览器，请改用 Chrome。');
    // Native <a download> action intentionally continues without JavaScript .click().
  });

  view.addEventListener('click', event => {
    if (!view.href || !prepared()) {
      event.preventDefault();
      return message('高清图尚未准备好，请重新生成。', true);
    }
    message('正在打开高清图片。进入图片页面后，可尝试长按图片保存。');
  });

  new MutationObserver(() => {
    if (dialog.open) refresh();
  }).observe(dialog, {attributes: true, attributeFilter: ['open']});
  if (dialog.open) refresh();
})();
