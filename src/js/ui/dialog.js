/* In-page messages (R3): PC.ui.dialog.confirm, PC.ui.toast, PC.ui.banner. Native dialogs are never used. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};

  /* ---- confirm dialog ---- */
  var chain = Promise.resolve(), active = null, BACKDROP_MS = 300;

  function focusables(box) {
    return ui.$$('button, input, select, textarea, [tabindex]', box).filter(function (el) {
      return !el.disabled && !el.closest('[hidden]') && el.tabIndex >= 0;
    });
  }
  function onKey(e) {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); active.close(false); return; }
    if (e.key !== 'Tab') return;
    var f = focusables(active.box), i = f.indexOf(document.activeElement);
    if (!f.length) { e.preventDefault(); return; }
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i < 0 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  }
  function present(o) {
    return new Promise(function (resolve) {
      var layer = ui.$('dialog-layer'), box = ui.$('dialog'), app = ui.$('app'), extra = ui.$('dialog-extra');
      var okBtn = ui.$('dialog-ok'), cancelBtn = ui.$('dialog-cancel'), opener = document.activeElement, shownAt = Date.now();
      ui.$('dialog-title').textContent = o.title || 'Confirm';
      ui.$('dialog-text').textContent = o.text || '';
      ui.$('dialog-text').hidden = !o.text;                 // no empty paragraph when a dialog has no sentence
      okBtn.textContent = o.ok || 'Continue';
      cancelBtn.textContent = o.cancel || 'Cancel';
      extra.textContent = '';
      if (o.extra) extra.appendChild(o.extra);
      function close(result) {
        if (!active) return;
        active = null;
        okBtn.removeEventListener('click', yes); cancelBtn.removeEventListener('click', no);
        layer.removeEventListener('click', backdrop); document.removeEventListener('keydown', onKey, true);
        layer.hidden = true; extra.textContent = '';
        app.inert = false; app.removeAttribute('aria-hidden');
        if (opener && opener.focus && document.contains(opener) && !opener.closest('[hidden]')) opener.focus();
        resolve(result);
        if (ui.shell) ui.shell.fixFocusSoon();
      }
      function yes() { close(true); }
      function no() { close(false); }
      // A second tap of a double tap lands on the backdrop: it must not cancel the dialog it has just opened.
      function backdrop(e) { if (e.target === layer && Date.now() - shownAt >= BACKDROP_MS) close(false); }
      active = { box: box, close: close };
      okBtn.addEventListener('click', yes); cancelBtn.addEventListener('click', no);
      layer.addEventListener('click', backdrop); document.addEventListener('keydown', onKey, true);
      app.inert = true; app.setAttribute('aria-hidden', 'true');
      layer.hidden = false;
      cancelBtn.focus();
    });
  }

  ui.dialog = {
    // { title, text, ok, cancel, extra } -> Promise<boolean>. Cancel, Esc and a tap on the backdrop give false.
    // A call made while a dialog is showing waits for its turn.
    confirm: function (o) {
      var p = chain.then(function () { return present(o || {}); });
      chain = p.catch(function () {});
      return p;
    },
    isOpen: function () { return !!active; }
  };

  /* ---- toasts ---- */
  var toasts = [];
  function dropToast(t) {
    clearTimeout(t.timer);
    if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
    var i = toasts.indexOf(t); if (i >= 0) toasts.splice(i, 1);
  }
  // Short message above the action bar. The same text while still visible only restarts its timer.
  ui.toast = function (text, opts) {
    var ms = (opts && opts.ms) || 3500, kind = (opts && opts.kind) || 'info';
    toasts.filter(function (x) { return !x.el.isConnected; }).forEach(dropToast);
    var t = toasts.filter(function (x) { return x.text === text; })[0];
    if (!t) {
      t = { text: text, el: ui.tpl('tpl-toast'), timer: null };
      ui.$('toast-text', t.el).textContent = text;
      t.el.setAttribute('data-kind', kind);
      ui.$('toast-region').appendChild(t.el);
      toasts.push(t);
      while (toasts.length > 2) dropToast(toasts[0]);
    } else clearTimeout(t.timer);
    t.timer = setTimeout(function () { dropToast(t); }, ms);
    return t.el;
  };

  /* ---- banners (one per id, in the banner slot) ---- */
  var banners = {};
  ui.banner = {
    // { id, kind: info|warn|block|ok, text, action: { label, fn } | null }
    show: function (o) {
      var el = banners[o.id];
      if (!el) { el = banners[o.id] = ui.tpl('tpl-banner'); ui.$('banner-slot').appendChild(el); }
      el.setAttribute('data-kind', o.kind || 'info');
      ui.$('banner-text', el).textContent = o.text;
      var btn = ui.$('banner-action', el);
      btn.hidden = !o.action;
      btn.textContent = o.action ? o.action.label : '';
      btn.onclick = o.action ? o.action.fn : null;
      return el;
    },
    hide: function (id) {
      var el = banners[id];
      if (el && el.parentNode) el.parentNode.removeChild(el);
      delete banners[id];
    }
  };
})(globalThis.PC = globalThis.PC || {});
