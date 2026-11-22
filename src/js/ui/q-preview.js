/* PC.ui.qpreview: the site preview of stage 2 (frame L, street at the bottom): plot, setback zone, footprint,
   parking, pool, edges by class, compass. Always fitted; no pan or zoom. Drag the compass = Q5. Tap an edge = Q6,
   or, in tap mode "Back / side", switch that edge's class (F2-S4). */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {}, view = null, api = null, labels = [], ticks = [], area = null, dragNorth = null, focusEdge = null;
  var PAD = { t: 26, r: 30, b: 26, l: 30 }, DIAL = 20;

  function site() { return PC.site.analyse(api.state()); }
  // Page elements that float over the canvas, as canvas rectangles: the collapse button, the tap-mode control and its
  // hint (F2-T3), and on a phone the legend. which: optional list of hooks.
  var FLOATING = ['site-preview-toggle', 'site-tap-mode', 'site-tap-hint', 'site-legend'];
  function overlays(which) {
    var c = view.canvas.getBoundingClientRect(), out = [];
    (which || FLOATING).forEach(function (h) {
      var el = ui.$(h), b = el.getBoundingClientRect();
      if (el.hidden || getComputedStyle(el).visibility === 'hidden' || !b.width || !b.height || b.right <= c.left || b.left >= c.right || b.bottom <= c.top || b.top >= c.bottom) return;
      out.push({ x: b.left - c.left - 3, y: b.top - c.top - 3, w: b.width + 6, h: b.height + 6, hook: h });
    });
    return out;
  }
  // The compass sits in the top right corner, left of the collapse button when that is there.
  function dial() {
    var x = view.width - DIAL - 10, y = DIAL + 10;
    overlays(['site-preview-toggle']).forEach(function (o) { if (o.y < y + DIAL && o.x + o.w > x - DIAL && o.y + o.h < view.height / 2) x = o.x - DIAL - 8; });
    return { x: x, y: y };
  }
  function dialRect() { var d = dial(); return { x: d.x - DIAL - 4, y: d.y - DIAL - 4, w: 2 * DIAL + 8, h: 2 * DIAL + 22 }; }
  // Canvas height taken at the bottom by an overlay (the legend on a phone, the tap hint elsewhere).
  function bottomCover() {
    var h = 0;
    overlays(['site-tap-hint', 'site-legend']).forEach(function (o) { if (o.y > view.height / 2) h = Math.max(h, view.height - o.y); });
    return h;
  }
  // Does the plot as drawn now touch a canvas rectangle?
  function plotHits(ptsL, r) {
    var G = PC.geom, sp = ptsL.map(function (p) { return view.toScreen(p); }), n = sp.length, i, box = { u: r.x, v: r.y, w: r.w, d: r.h };
    for (i = 0; i < n; i++) if (G.segHitsRect(sp[i], sp[(i + 1) % n], box)) return true;
    return G.pointInPoly([r.x, r.y], sp) || G.pointInPoly([r.x + r.w / 2, r.y + r.h / 2], sp);
  }
  function rectPts(r) { return [[r.u, r.v], [r.u + r.w, r.v], [r.u + r.w, r.v + r.d], [r.u, r.v + r.d]]; }

  function fit() {
    var s = site();
    if (!s || !view.width) return;
    var b = PC.geom.bbox(s.ptsL), d = dial(), pad = { t: PAD.t, r: PAD.r, b: PAD.b + bottomCover(), l: PAD.l };
    view.fit(b, pad);
    // Leave the corner with the compass free when the plot would reach under it.
    var top = view.toScreen([b.x1, b.y1]);
    if (top[0] > d.x - DIAL - 6 && top[1] < d.y + DIAL + 6) { pad.r = view.width - d.x + DIAL + 12; pad.l = Math.max(pad.l, pad.r); view.fit(b, pad); }
    // Keep the drawing clear of the floating controls (tap mode top left, collapse button and compass top right) with a margin,
    // so an edge tap never lands on, or is snapped by touch adjustment to, a control (A-15, designer-D review).
    // Grow one pad step by step, only as far as needed; keep the larger drawing, ties to the smaller move.
    // (The margin is for touch adjustment, which snaps a tap to a nearby page control; the compass is drawn on the
    // canvas, so it only needs no overlap.)
    var M = 8, ctl = overlays(['site-tap-mode', 'site-preview-toggle']).map(function (o) { return { x: o.x - M, y: o.y - M, w: o.w + 2 * M, h: o.h + 2 * M }; }).concat([dialRect()]);
    var hits = function () { return ctl.some(function (r) { return plotHits(s.ptsL, r); }); };
    if (ctl.length && hits()) {
      var base = { t: pad.t, r: pad.r, b: pad.b, l: pad.l }, best = null;
      ['l', 't', 'r'].forEach(function (key) {
        for (var k = 1; k <= 80; k++) {
          var p2 = { t: base.t, r: base.r, b: base.b, l: base.l }; p2[key] += 4 * k;
          view.fit(b, p2);
          if (hits()) continue;
          if (!best || view.scale > best.scale + 1e-9 || (Math.abs(view.scale - best.scale) <= 1e-9 && k < best.k)) best = { pad: p2, scale: view.scale, k: k };
          break;
        }
      });
      view.fit(b, best ? best.pad : base);
    }
  }

  // Labels that are always drawn: the street edge ("front") and every overridden edge ("side*"), however short the
  // edge. Free spots first (outside, then inside the edge); forced only as a last resort, and never over the
  // compass or a floating control (TL plan-review ruling 6).
  // One edge label with the normal culling (as draw2d.edgeLabels): none when the edge is too short for it or no
  // spot beside it is free. Returns true when drawn.
  function edgeLabel(v, a, b, text, avoid) {
    var D = ui.draw2d, g = v.ctx, o = { avoid: avoid }, vis = D.clipToView(v, v.toScreen(a), v.toScreen(b), 2);
    if (!vis) return false;
    g.font = PC.data.palette2d.font.label;
    var tw = g.measureText(text).width, p = vis[0], q = vis[1], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.sqrt(dx * dx + dy * dy);
    if (l < tw + 20) return false;
    var off = 13 + Math.abs(dy / l) * (tw / 2 - 4), along = [0.5, 0.35, 0.65, 0.22, 0.78], k, s2;
    for (k = 0; k < along.length; k++) for (s2 = 1; s2 >= -1; s2 -= 2) {
      var sx = p[0] + dx * along[k] - dy / l * off * s2, sy = p[1] + dy * along[k] + dx / l * off * s2;
      if (D.labelFree(v, D.labelRect(v, text, sx, sy, o), labels, o)) { D.label(v, text, sx, sy, labels, o); return true; }
    }
    return false;
  }
  // The "*" tick of an overridden edge whose label was culled: 6 px across the edge at its midpoint, on the inner
  // side, in the edge's class colour, 2 px wide.
  function ovTick(v, pts, i, color) {
    var n = pts.length, a = v.toScreen(pts[i]), b = v.toScreen(pts[(i + 1) % n]), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    var m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], nx = -dy / l, ny = dx / l, scr = pts.map(function (p) { return v.toScreen(p); });
    if (!PC.geom.pointInPoly([m[0] + nx * 3, m[1] + ny * 3], scr)) { nx = -nx; ny = -ny; }
    var g = v.ctx;
    g.save(); g.setLineDash([]); g.lineCap = 'butt'; g.lineWidth = 2; g.strokeStyle = color;
    g.beginPath(); g.moveTo(m[0], m[1]); g.lineTo(m[0] + nx * 6, m[1] + ny * 6); g.stroke(); g.restore();
    ticks.push({ edge: i, x: m[0], y: m[1], dx: nx, dy: ny });
  }
  // The footprint area label (F5-T3a, Designer spec): the lighter area font / colour; on two lines ("108" / "m²",
  // 14 px apart) when one line is wider than the footprint less 8 px; outside the footprint on the street side
  // (centred, 4 px off its street edge, no leader) when two lines do not fit either.
  function areaLabel(v, fp, text, avoid) {
    var D = ui.draw2d, P = PC.data.palette2d, o = { avoid: avoid, font: P.font.area, color: P.label.area };
    var cs = [[fp.u, fp.v], [fp.u + fp.w, fp.v], [fp.u + fp.w, fp.v + fp.d], [fp.u, fp.v + fp.d]].map(function (p) { return v.toScreen(p); });
    var xs = cs.map(function (p) { return p[0]; }), w = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    var c = v.toScreen([fp.u + fp.w / 2, fp.v + fp.d / 2]), sp = text.lastIndexOf(' '), lines = [text.slice(0, sp), text.slice(sp + 1)];
    if (D.labelRect(v, text, c[0], c[1], o).w <= w - 8) { area = D.label(v, text, c[0], c[1], labels, o) ? { mode: 'one', lines: [text] } : null; return; }
    var wide = Math.max(D.labelRect(v, lines[0], 0, 0, o).w, D.labelRect(v, lines[1], 0, 0, o).w);
    if (wide <= w - 8) {
      var r0 = D.labelRect(v, lines[0], c[0], c[1] - 7, o), r1 = D.labelRect(v, lines[1], c[0], c[1] + 7, o);
      r0.h = r1.h = 14; r0.y = c[1] - 14; r1.y = c[1];
      if (D.labelFree(v, r0, labels, o) && D.labelFree(v, r1, labels, o)) {
        D.label(v, lines[0], c[0], c[1] - 7, null, o); D.label(v, lines[1], c[0], c[1] + 7, null, o);
        labels.push(r0, r1); area = { mode: 'two', lines: lines };
      } else area = null;
      return;
    }
    // outside, street side: the street edge is v = fp.v (frame L); outward = from the centre to that edge's midpoint
    var m = v.toScreen([fp.u + fp.w / 2, fp.v]), dx = m[0] - c[0], dy = m[1] - c[1], l = Math.sqrt(dx * dx + dy * dy) || 1, r = D.labelRect(v, text, 0, 0, o);
    dx /= l; dy /= l;
    var off = 4 + Math.abs(dx) * r.w / 2 + Math.abs(dy) * r.h / 2, x = m[0] + dx * off, y = m[1] + dy * off;
    area = D.label(v, text, x, y, labels, o) ? { mode: 'outside', lines: [text], x: x, y: y } : null;
  }
  function forcedLabel(v, a, b, text, avoid) {
    var D = ui.draw2d, vis = D.clipToView(v, v.toScreen(a), v.toScreen(b), 2), o = { avoid: avoid };
    if (!vis) return;
    var p = vis[0], q = vis[1], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    v.ctx.font = PC.data.palette2d.font.label;
    var off = 13 + Math.abs(dy / l) * (v.ctx.measureText(text).width / 2 - 4), spots = [], k, t, sd;
    [[0.5, 1], [0.35, 1], [0.65, 1], [0.2, 1], [0.8, 1], [0.5, 2], [0.2, 2], [0.8, 2]].forEach(function (tk) { [1, -1].forEach(function (s2) {
      spots.push([p[0] + dx * tk[0] - dy / l * off * tk[1] * s2, p[1] + dy * tk[0] + dx / l * off * tk[1] * s2]);
    }); });
    for (k = 0; k < spots.length; k++) if (D.label(v, text, spots[k][0], spots[k][1], labels, o)) return;
    // Last resort: a spot clear of the overlays and of the labels already placed (it may touch the canvas border),
    // then one clear of the overlays alone (TL increment-1 review, change 2).
    var hit = function (list) { return list.some(function (r) { return t.x < r.x + r.w && r.x < t.x + t.w && t.y < r.y + r.h && r.y < t.y + t.h; }); };
    for (sd = 0; sd < 2; sd++) for (k = 0; k < spots.length; k++) {
      t = D.labelRect(v, text, spots[k][0], spots[k][1], o);
      if (!hit(avoid) && (sd === 1 || !hit(labels))) { D.label(v, text, spots[k][0], spots[k][1], labels, { avoid: avoid, force: true }); return; }
    }
  }

  function drawCompass(v, deg) {
    var g = v.ctx, P = PC.data.palette2d, d = dial(), a = deg * Math.PI / 180, sx = Math.sin(a), cy = -Math.cos(a), R = DIAL;
    g.beginPath(); g.arc(d.x, d.y, R, 0, Math.PI * 2);
    g.fillStyle = P.canvas; g.fill(); g.lineWidth = 1.5; g.strokeStyle = dragNorth !== null ? P.state.selection : P.north.stroke; g.stroke();
    var tip = [d.x + sx * (R - 3), d.y + cy * (R - 3)], px = -cy, py = sx;                 // (px, py): across the arrow
    g.beginPath(); g.moveTo(tip[0], tip[1]);
    g.lineTo(d.x - sx * 6 + px * 6, d.y - cy * 6 + py * 6); g.lineTo(d.x - sx * 2, d.y - cy * 2); g.lineTo(d.x - sx * 6 - px * 6, d.y - cy * 6 - py * 6);
    g.closePath(); g.fillStyle = P.north.fill; g.fill();
    g.font = P.font.label; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = P.north.text;
    g.fillText('N', d.x, d.y + R + 9);
  }

  function draw(v) {
    var s = site(), D = ui.draw2d, P = PC.data.palette2d, state = api.state(), unit = state.ans.unit;
    labels = []; ticks = []; area = null;
    D.clear(v);
    // F5-T3a: the Parking / Pool legend entries only when the drawing has them (PM round 14)
    ui.$('site-legend-parking').hidden = !(s && s.parking);
    ui.$('site-legend-pool').hidden = !(s && s.pool);
    if (!s) return;
    var pts = s.ptsL, n = pts.length, i;
    var avoid = [dialRect()].concat(overlays()), ov = state.ans.edgeOv || {};
    D.path(v, pts, { closed: true, fill: P.plot.fill, stroke: 'rgba(0,0,0,0)', width: 0 });
    D.setbackZone(v, pts, s.setbackOf, { color: P.setback.line, alpha: 0.14 });
    if (s.parking) D.path(v, rectPts(s.parking), { closed: true, fill: P.parking.fill, stroke: P.parking.stroke, width: 1.5, dash: P.line.dash });
    if (s.pool) D.path(v, rectPts(s.pool), { closed: true, fill: P.pool.fill, stroke: P.pool.stroke, width: 1.5 });
    if (s.footprint) D.path(v, rectPts(s.footprint), { closed: true, fill: P.footprint.fill, stroke: P.footprint.stroke, width: 2 });
    for (i = 0; i < n; i++) {                              // edges by class: front thick, sides dotted
      var cls = s.edgeClass[i];
      D.path(v, [pts[i], pts[(i + 1) % n]], { stroke: P.edge[cls], width: cls === 'front' ? 4 : 2, dash: cls === 'side' ? [2, 3] : null });
    }
    if (focusEdge !== null && focusEdge < n)                // the edge focused in the Q6 edge list (F2-S4 keyboard)
      D.path(v, [pts[focusEdge], pts[(focusEdge + 1) % n]], { stroke: P.edge.focus, width: P.line.edgeFocus });
    // Labels, most important first: street (always shown), overridden edges, the footprint area, the other edges.
    // F5-T3a (A-15 as updated): an overridden edge's "*" label follows the normal culling; when it is culled, a "*"
    // tick marks the edge's midpoint (the Q6 edge list stays the full reference).
    forcedLabel(v, pts[s.edge], pts[(s.edge + 1) % n], 'front', avoid);
    for (i = 0; i < n; i++) if (ov[i] && i !== s.edge && !edgeLabel(v, pts[i], pts[(i + 1) % n], s.edgeClass[i] + '*', avoid))
      ovTick(v, pts, i, P.edge[s.edgeClass[i]]);
    if (s.footprint) areaLabel(v, s.footprint, PC.units.fmtArea(s.footprint.area, unit), avoid);
    D.edgeLabels(v, pts, true, function (len, k) { return k === s.edge || (ov[k] && k !== s.edge) ? null : s.edgeClass[k]; }, labels, { avoid: avoid });
    drawCompass(v, dragNorth !== null ? dragNorth : PC.frames.northL(state));
  }

  // Nearest plot edge within reach of a screen point, or -1.
  function edgeAt(world, type) {
    var s = site(), best = -1, bd = ui.View2D.hitRadius(type) / view.scale, n = s ? s.ptsL.length : 0, i, dd;
    for (i = 0; i < n; i++) { dd = PC.geom.distPointSeg(world, s.ptsL[i], s.ptsL[(i + 1) % n]); if (dd <= bd) { bd = dd; best = i; } }
    return best;
  }
  // Pointer -> north angle in L, snapped as the stored value will be (15 degree steps in W, A-4), so the arrow
  // does not jump on release when the street edge is slanted.
  function angleAt(world) {
    var p = view.toScreen(world), d = dial(), st = api.state();
    var deg = Math.atan2(p[0] - d.x, -(p[1] - d.y)) * 180 / Math.PI;
    return PC.frames.northL({ plot: st.plot, ans: { north: PC.frames.northToW(st, deg), streetEdge: st.ans.streetEdge } });
  }

  ui.qpreview = {
    // a: { state() -> state to draw (may carry pending values), setStreet(i), northLive(degL | null), northSet(degL),
    //      tapMode() -> 'street' | 'class', toggleEdge(i), streetTapped() }
    init: function (a) {
      api = a;
      var canvas = ui.$('site-canvas'), box = ui.$('site-preview'), toggle = ui.$('site-preview-toggle');
      view = new ui.View2D(canvas, {
        locked: true, draw: draw,
        onResize: function () { fit(); },
        hitTest: function (sx, sy, type) {
          var d = dial(), r = Math.max(DIAL + 2, ui.View2D.hitRadius(type));
          return (sx - d.x) * (sx - d.x) + (sy - d.y) * (sy - d.y) <= r * r ? 'north' : null;
        },
        onTap: function (world, ev) {
          var i = edgeAt(world, ev.pointerType), st = site();
          if (i < 0 || !st) return;
          if (api.tapMode() === 'class') { if (i === st.edge) api.streetTapped(); else api.toggleEdge(i); }
          else if (i !== st.edge) api.setStreet(i);
        },
        onDragStart: function (h, world) { dragNorth = angleAt(world); api.northLive(dragNorth); view.invalidate(); },
        onDragMove: function (h, world) { var a2 = angleAt(world); if (a2 !== dragNorth) { dragNorth = a2; api.northLive(a2); view.invalidate(); } },
        onDragEnd: function (h, world, cancelled) {
          var a2 = dragNorth; dragNorth = null; api.northLive(null);
          if (!cancelled && a2 !== null) api.northSet(a2);
          view.invalidate();
        }
      });
      ui.View2D.named.site = view;
      ui.on(toggle, 'click', function () {
        var hide = !box.classList.contains('is-collapsed');
        box.classList.toggle('is-collapsed', hide); toggle.setAttribute('aria-expanded', String(!hide));
        if (!hide) { view.resize(); fit(); view.invalidate(); }
      });
      Object.assign(PC.debug, {
        siteLabels: function () { view.drawNow(); return labels.slice(); },
        siteTicks: function () { view.drawNow(); return ticks.slice(); },
        siteArea: function () { view.drawNow(); return area; },
        // Edge highlighted from the Q6 edge list, or null.
        siteFocusEdge: function () { return focusEdge; },
        // North angle in L the compass arrow shows now (during a drag: the one under the finger).
        siteNorth: function () { return dragNorth !== null ? dragNorth : PC.frames.northL(api.state()); },
        // Compass centre in viewport coordinates and its radius.
        siteDial: function () { var r = view.canvas.getBoundingClientRect(), d = dial(); return { x: r.left + d.x, y: r.top + d.y, r: DIAL }; }
      });
    },
    // Called on every stage render and on enter: size, fit and redraw now (not in a later frame).
    render: function () { if (!view) return; view.resize(); fit(); view.invalidate(); },
    // Highlight one edge (index) or none (null): focus in the Q6 edge list.
    focusEdge: function (i) { if (focusEdge === i) return; focusEdge = i; if (view) view.invalidate(); }
  };
})(globalThis.PC = globalThis.PC || {});
