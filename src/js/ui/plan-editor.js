/* PC.ui.planEditor: the gesture side of the stage-3 plan editor (F3-S2, F3-T2). It turns View2D gestures into
   the pure PC.plans edit operations: a drag that starts on a room selects and moves it, a drag on an edge handle
   of the selected room resizes that edge, anything else pans (View2D). The edited rectangle is transient until
   release; then exactly one store commit (PC.plans.applyEdit). It also draws the selection, handles, the drag
   ghost and snap guides. Corner resize is not in this build (PM round 6). Frame P (footprint-local) throughout.
   host: { view, level(), selected(), select(id), footprint(), changed(), committed(result) }. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};
  var SMALL = 66, PILL = [18, 6], OUT = 22;           // DP 4: under 66 px the handles sit 22 px outside the room

  ui.planEditor = function (host) {
    var drag = null, lastType = 'touch';
    function st() { return PC.store.get(); }
    function plan() { var p = st().plans[host.level()]; return p && !p.error ? p : null; }
    function world(fp, x, y) { return [fp.u + x, fp.v + y]; }
    // Screen box of a frame-P rectangle: { l, r, t, b } (t = back edge, screen y grows downwards).
    function scr(fp, r) {
      var a = host.view.toScreen(world(fp, r.x, r.y + r.h)), c = host.view.toScreen(world(fp, r.x + r.w, r.y));
      return { l: a[0], t: a[1], r: c[0], b: c[1] };
    }
    // The four edge-handle centres of a room on screen; one function for drawing and hit testing (A-15).
    function spots(fp, r) {
      var s = scr(fp, r), cx = (s.l + s.r) / 2, cy = (s.t + s.b) / 2, wide = s.r - s.l >= SMALL, tall = s.b - s.t >= SMALL;
      return [
        { kind: 'n', x: cx, y: tall ? s.t : s.t - OUT, h: true },
        { kind: 's', x: cx, y: tall ? s.b : s.b + OUT, h: true },
        { kind: 'e', x: wide ? s.r : s.r + OUT, y: cy, h: false },
        { kind: 'w', x: wide ? s.l : s.l - OUT, y: cy, h: false }
      ];
    }
    function rectOf(id) {
      var p = plan();
      if (drag && drag.id === id) return drag.cur;
      return p ? p.rooms.filter(function (r) { return r.id === id; })[0] || null : null;
    }

    // -> { kind: 'move' | 'n' | 's' | 'e' | 'w', id } or null (pan). Order: handles of the selected room, then the
    // edge bands of a large selected room, then the body of any room. The stair and lift are never hit.
    function hitTest(sx, sy, type) {
      lastType = type || lastType;
      var fp = host.footprint(), p = plan();
      if (!fp || !p || drag) return null;
      var R = ui.View2D.hitRadius(type), sel = host.selected(), r = sel ? rectOf(sel) : null, best = null, bd = R;
      if (r) {
        spots(fp, r).forEach(function (h) { var d = Math.sqrt((h.x - sx) * (h.x - sx) + (h.y - sy) * (h.y - sy)); if (d <= bd) { bd = d; best = { kind: h.kind, id: sel }; } });
        if (best) return best;
        var s = scr(fp, r), w = s.r - s.l, h = s.b - s.t, inW = Math.min(R, (w - 44) / 2), inH = Math.min(R, (h - 44) / 2);
        var inY = sy >= s.t && sy <= s.b, inX = sx >= s.l && sx <= s.r;
        if (w >= SMALL && inY && sx >= s.r - inW && sx <= s.r + R) return { kind: 'e', id: sel };
        if (w >= SMALL && inY && sx >= s.l - R && sx <= s.l + inW) return { kind: 'w', id: sel };
        if (h >= SMALL && inX && sy >= s.t - R && sy <= s.t + inH) return { kind: 'n', id: sel };
        if (h >= SMALL && inX && sy >= s.b - inH && sy <= s.b + R) return { kind: 's', id: sel };
      }
      var wv = host.view.toWorld(sx, sy), x = wv[0] - fp.u, y = wv[1] - fp.v;
      var inside = function (q) { return x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h; };
      if (r && inside(r)) return { kind: 'move', id: sel };
      var hit = p.rooms.filter(inside);
      return hit.length ? { kind: 'move', id: hit[hit.length - 1].id } : null;
    }

    function onDragStart(h, w) {
      var s = st(), lv = host.level(), p = plan(), ctx = PC.plans.ctx(s, lv);
      if (!p || !ctx) return;
      var start = p.rooms.filter(function (r) { return r.id === h.id; })[0];
      if (!start) return;
      ctx.cands = PC.plans.edgeCands(p.rooms, h.id, ctx);
      drag = { id: h.id, kind: h.kind, level: lv, start: start, cur: start, guides: [], w0: w, ctx: ctx };
      if (host.selected() !== h.id) host.select(h.id);
      host.changed();
    }
    function step(w) {
      var dx = w[0] - drag.w0[0], dy = w[1] - drag.w0[1];
      var res = drag.kind === 'move' ? PC.plans.moveRect(drag.start, dx, dy, drag.ctx) : PC.plans.resizeRect(drag.start, drag.kind, dx, dy, drag.ctx);
      drag.cur = res.rect; drag.guides = res.guides;
    }
    function onDragMove(h, w) { if (!drag) return; step(w); host.changed(); }
    function onDragEnd(h, w, cancelled) {
      if (!drag) return;
      var d = drag, res = null;
      if (!cancelled) step(w);                                  // the release point counts (live = release)
      drag = null;
      var before = PC.plans.snapshot(PC.store.get().plans[d.level]);
      if (!cancelled && d.level === host.level()) PC.store.commit(function (s) { res = PC.plans.applyEdit(s, d.level, d.cur); });
      // before / after: the one-step undo snapshot (F4-T2 Step 0)
      if (res && res.changed) host.committed({ level: d.level, id: d.id, wasApproved: res.wasApproved, before: before, after: PC.plans.snapshot(PC.store.get().plans[d.level]) });
      host.changed();
    }

    // Selection outline, ghost, snap guides and handles, over the drawn plan.
    function drawOverlay(v) {
      var fp = host.footprint(), P = PC.data.palette2d, D = ui.draw2d, sel = host.selected(), r = sel ? rectOf(sel) : null;
      if (!fp) return;
      var box = function (q) { return { x0: fp.u + q.x, y0: fp.v + q.y, x1: fp.u + q.x + q.w, y1: fp.v + q.y + q.h }; };
      if (drag) {
        D.rect(v, box(drag.start), { stroke: P.state.ghost, width: P.line.room, dash: P.line.dash });
        drag.guides.forEach(function (g) {
          var a = g.axis === 'x' ? [[fp.u + g.v, fp.v + g.lo], [fp.u + g.v, fp.v + g.hi]] : [[fp.u + g.lo, fp.v + g.v], [fp.u + g.hi, fp.v + g.v]];
          D.path(v, a, { stroke: P.state.snap, width: P.line.selection, dash: P.line.dash });
        });
      }
      if (!r) return;
      D.rect(v, box(r), { stroke: P.state.selection, width: P.line.selection });
      spots(fp, r).forEach(function (h) {
        var w = h.h ? PILL[0] : PILL[1], hh = h.h ? PILL[1] : PILL[0];
        D.pill(v, h.x, h.y, w, hh, { fill: P.state.handleFill, stroke: P.state.handleStroke, width: P.line.handle });
      });
    }

    return {
      hitTest: hitTest, onDragStart: onDragStart, onDragMove: onDragMove, onDragEnd: onDragEnd, drawOverlay: drawOverlay,
      // The rectangle of a room as drawn now (the transient one while it is dragged).
      rectOf: rectOf,
      dragging: function () { return drag ? { id: drag.id, kind: drag.kind, cur: drag.cur, guides: drag.guides } : null; },
      spots: function (id) { var fp = host.footprint(), r = rectOf(id); return fp && r ? spots(fp, r) : []; },
      cancel: function () { drag = null; },
      pointerType: function () { return lastType; }
    };
  };
})(globalThis.PC = globalThis.PC || {});
