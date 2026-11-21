/* PC.ui.qedges: the Q6 edge list (F2-S4, keyboard and no-canvas alternative): one row per plot edge with its
   number, length and class in effect; a switch button per non-street edge ("Make side" / "Make back") with a full
   accessible name; focus on a row highlights that edge in the site preview. Rows are updated in place while the
   number of edges stays the same, so focus survives a switch and the return from an R5 dialog. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {}, api = null, rows = [], list = null, toggle = null;

  function other(cls) { return cls === 'back' ? 'side' : 'back'; }
  function build(n) {
    list.textContent = ''; rows = [];
    for (var i = 0; i < n; i++) {
      var li = ui.tpl('tpl-edge-row'), btn = ui.$('edge-switch', li);
      li.setAttribute('data-edge', String(i));
      (function (k) {
        ui.on(btn, 'click', function () { api.toggleEdge(k); });
        ui.on(li, 'focusin', function () { ui.qpreview.focusEdge(k); });
        ui.on(li, 'focusout', function (e) { if (!li.contains(e.relatedTarget)) ui.qpreview.focusEdge(null); });
      })(i);
      list.appendChild(li);
      rows.push({ li: li, name: ui.$('edge-name', li), cls: ui.$('edge-class', li), btn: btn });
    }
  }

  ui.qedges = {
    // a: { toggleEdge(i) }
    init: function (a) {
      api = a; list = ui.$('q-edges'); toggle = ui.$('q-edges-toggle');
      ui.on(toggle, 'click', function () {
        var open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        list.classList.toggle('is-collapsed', !open);
      });
    },
    render: function (state) {
      if (!list) return;
      var site = PC.site.analyse(state), U = PC.units, unit = state.ans.unit, ov = state.ans.edgeOv || {};
      if (!site) { if (rows.length) build(0); return; }
      var pts = site.ptsL, n = pts.length;
      if (rows.length !== n) build(n);
      rows.forEach(function (r, i) {
        var len = U.fmtLen(PC.geom.dist(pts[i], pts[(i + 1) % n]), unit), cls = site.edgeClass[i], street = i === site.edge, mine = !!ov[i] && !street;
        var name = 'Edge ' + (i + 1) + ' · ' + len, clsText = street ? 'front (street)' : cls + (mine ? ' (set by you)' : '');
        if (r.name.textContent !== name) r.name.textContent = name;
        if (r.cls.textContent !== clsText) r.cls.textContent = clsText;
        var txt = street ? 'Street edge' : 'Make ' + other(cls), label = street ? 'Edge ' + (i + 1) + ', ' + len + ', front (street edge, set with Q6)'
          : 'Edge ' + (i + 1) + ', ' + len + ', ' + cls + (mine ? ' (set by you)' : '') + ': make ' + other(cls);
        if (r.btn.textContent !== txt) r.btn.textContent = txt;
        if (r.btn.getAttribute('aria-label') !== label) r.btn.setAttribute('aria-label', label);
        r.btn.hidden = street;                               // the street row has no switch (pre-step D)
        r.li.classList.toggle('is-set', mine);
      });
    }
  };
})(globalThis.PC = globalThis.PC || {});
