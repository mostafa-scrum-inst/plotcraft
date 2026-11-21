/* PC.ui.stages.plot: stage 1 controller. Draws the plot grid, places and closes points, measures, edits corners.
   All rules are in PC.plot; everything is rendered from the store, plus the transient hover / drag below. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};
  var view = null, hover = null, drag = null, note = null, reversed = false, labels = [], chip = '';
  var needFit = true, auto = true, fitting = false;   // auto: the view is still the fitted one (no pan or zoom by the user yet)
  var GRID_MIN_PX = 6;                                // a grid square is never drawn smaller than this
  var PAD = { t: 52, r: 46, b: 40, l: 46 };           // room for the scale chip (top left) and the outside labels
  var TEXT = {
    few: 'Place at least 3 points, then close the shape.',
    ready: 'Tap the first point or press Close shape to finish.',
    closed: 'Plot closed. Drag a corner to adjust it.',
    cross: 'That edge would cross the outline.',
    crossClose: 'Closing here would cross the outline. Move on or undo a point.',
    crossMove: 'A corner cannot be moved across the outline.',
    max: 'A plot can have at most 12 corners.',
    outside: 'Outside the {e} × {e} {u} drawing area.',
    small: 'Plot is too small: {a} (minimum {min}).'
  };

  function st() { return PC.store.get(); }
  function unit() { return st().ans.unit; }
  function drawArea() { var e = PC.C.PLOT.extent; return { x0: 0, y0: 0, x1: e, y1: e }; }
  // Points as shown: the stored ones, with the dragged corner at its current valid position.
  function shown() {
    var pts = st().plot.pts;
    if (!drag) return pts;
    var c = pts.slice(); c[drag.i] = drag.cur; return c;
  }
  // Sets (or clears) the refusal message; it is worded at render time so that it follows the unit (R4).
  function say(key) { note = key || null; }
  function noteText(u) {                                // "100 x 100 m" / "328.1 x 328.1 ft"
    var e = PC.units.toDisplay(PC.C.PLOT.extent, u);
    return TEXT[note].replace(/\{e\}/g, Math.abs(e - Math.round(e)) < 1e-9 ? String(Math.round(e)) : e.toFixed(1)).replace('{u}', PC.units.lenUnit(u));
  }

  /* ---- view ---- */
  function fit() {
    var pts = st().plot.pts;
    fitting = true;
    if (!pts.length) {                                  // empty: about 40 m across, origin at the lower left
      var w = 40, h = w * view.height / view.width;
      view.fit({ x0: -2, y0: -2, x1: w - 2, y1: h - 2 }, 0);
    } else {
      var b = PC.geom.bbox(pts), min = 10;              // a single point still gets a sensible window
      if (b.x1 - b.x0 < min) { b.x0 -= (min - (b.x1 - b.x0)) / 2; b.x1 = b.x0 + min; }
      if (b.y1 - b.y0 < min) { b.y0 -= (min - (b.y1 - b.y0)) / 2; b.y1 = b.y0 + min; }
      view.fit(b, PAD);
    }
    fitting = false; auto = true;
  }

  // Fits as soon as it is asked for and the canvas has a size. Not left to the next animation frame: a tap that
  // arrives before that frame must already meet the view the user (or a test) sees described by toScreen.
  function ensureFit() { if (needFit && view && view.width) { needFit = false; fit(); } }

  function gridText(step, u) {
    return u === 'ft' ? Math.round(step / PC.C.FT) + ' ft' : (Math.round(step * 100) / 100) + ' m';
  }

  function draw(v) {
    ensureFit();
    var s = st(), u = s.ans.unit, P = PC.data.palette2d, D = ui.draw2d, pts = shown(), closed = s.plot.closed, n = pts.length;
    var step = D.gridStep(v.scale, PC.C.GRID[u].square, GRID_MIN_PX), box = drawArea();
    labels = [];
    // Labels keep clear of the floating controls over the canvas: the scale chip and the Fit view button.
    var cv = v.canvas.getBoundingClientRect();
    var opt = { avoid: [ui.$('plot-scale').parentNode, ui.$('plot-fit')].map(function (el) {
      var b = el.getBoundingClientRect();
      return { x: b.left - cv.left - 4, y: b.top - cv.top - 4, w: b.width + 8, h: b.height + 8 };
    }) };
    D.clear(v);
    D.grid(v, step, box);
    D.box(v, box, P.grid.bounds, 1);
    var t = '1 square = ' + gridText(step, u);
    if (t !== chip) { chip = t; ui.$('plot-scale').textContent = t; }

    D.path(v, pts, { closed: closed, fill: P.plot.fill, stroke: closed ? P.plot.stroke : P.plot.open, width: P.line.plot });
    // Live edge to the pointer (mouse and pen), red when the point would be refused.
    var live = null;
    if (!closed && n && hover && !PC.geom.same(hover, pts[n - 1])) {
      var ok = PC.plot.canAdd(pts, hover).ok || (n >= 3 && PC.geom.same(hover, pts[0]) && PC.plot.canClose(pts).ok);
      live = [pts[n - 1], hover];
      D.path(v, live, { stroke: ok ? P.plot.live : P.state.invalid, width: P.line.plot, dash: P.line.dash });
    }
    var fmt = function (len) { return PC.units.fmtLen(len, u); };
    // The area label goes first (it has the best spot), then the edge lengths around it.
    if (closed) {
      var sc = v.toScreen(PC.geom.innerPoint(pts));
      D.label(v, PC.units.fmtArea(Math.abs(PC.geom.area(pts)), u), sc[0], sc[1], labels, opt);
    }
    if (live) D.edgeLabels(v, live, false, fmt, labels, { color: P.plot.live, avoid: opt.avoid });
    D.edgeLabels(v, pts, closed, fmt, labels, opt);
    D.handles(v, pts, { r: closed ? 7 : 5, fill: P.vertex.fill, stroke: P.vertex.stroke, strokeOf: function (i) {
      if (drag && drag.i === i) return P.vertex.active;
      return !closed && i === 0 && n >= 3 ? P.vertex.first : null;
    } });
  }

  /* ---- readouts, buttons, message ---- */
  function render() {
    if (!view) return;
    ensureFit();
    var s = st(), u = s.ans.unit, pts = shown(), closed = s.plot.closed, n = pts.length;
    var a = closed ? Math.abs(PC.geom.area(pts)) : 0, min = PC.C.PLOT.minArea;
    ui.$('plot-area').textContent = closed ? PC.units.fmtArea(a, u) : '–';
    ui.$('plot-perimeter').textContent = closed ? PC.units.fmtLen(PC.geom.perimeter(pts, true), u) : '–';
    ui.$('plot-points').textContent = String(n);
    var snap = PC.C.GRID[u].snap;                         // only the snap step: the scale chip states the square size
    ui.$('plot-grid').textContent = 'Snap ' + (u === 'ft' ? Math.round(snap / PC.C.FT) + ' ft' : snap + ' m');
    ui.$('btn-undo').disabled = n === 0;
    ui.$('btn-clear').disabled = n === 0;
    ui.$('btn-close-shape').disabled = closed || n < PC.C.PLOT.minPts;
    var msg = ui.$('plot-msg'), kind = 'info', text;
    if (note) { text = noteText(u); kind = 'warn'; }
    else if (closed && a < min - 1e-9) { text = TEXT.small.replace('{a}', PC.units.fmtArea(a, u)).replace('{min}', PC.units.fmtArea(min, u)); kind = 'block'; }
    else if (closed) { text = TEXT.closed; kind = 'ok'; }
    else text = n < PC.C.PLOT.minPts ? TEXT.few : TEXT.ready;
    if (msg.textContent !== text) msg.textContent = text;
    msg.setAttribute('data-kind', kind);
    view.invalidate();
  }

  /* ---- actions ---- */
  function closeShape() {
    var pts = st().plot.pts, r = PC.plot.canClose(pts);
    if (!r.ok) { say(r.reason === 'cross' ? 'crossClose' : 'few'); render(); return; }
    var flip = PC.geom.area(pts) < 0;
    say(null); hover = null;
    PC.store.propose(function (s) {
      s.plot.pts = PC.plot.normalise(s.plot.pts);
      s.plot.closed = true;
      s.ans.streetEdge = PC.plot.defaultStreetEdge(s.plot.pts);      // Q6 default, stored on close (A-5)
    }).then(function (done) { if (done) reversed = flip; render(); });
  }

  function addPoint(world) {
    var s = st(), pts = s.plot.pts, n = pts.length, half = PC.C.GRID[s.ans.unit].snap / 2, e = PC.C.PLOT.extent;
    if (world[0] < -half || world[1] < -half || world[0] > e + half || world[1] > e + half) { say('outside'); render(); return; }
    var p = PC.plot.snap(world, s.ans.unit);
    if (n >= PC.C.PLOT.minPts && PC.geom.same(p, pts[0])) { closeShape(); return; }
    var r = PC.plot.canAdd(pts, p);
    if (r.reason === 'same') return;
    if (!r.ok) { say(r.reason); render(); return; }
    say(null); auto = false;                           // drawing has started: the view stays where the user sees it
    PC.store.commit(function (d) { d.plot.pts.push(p); });
  }

  function onTap(world) {
    var s = st(), pts = s.plot.pts;
    if (s.plot.closed) return;
    // A saved draft is still unanswered: ask first. Whatever the answer, this tap places nothing.
    if (PC.store.session.draftPending) { ui.start.guard(); return; }
    if (pts.length >= PC.C.PLOT.minPts) {
      var a = view.toScreen(pts[0]), b = view.toScreen(world), dx = a[0] - b[0], dy = a[1] - b[1];
      if (dx * dx + dy * dy <= 22 * 22) { closeShape(); return; }
    }
    addPoint(world);
  }

  function undo() {
    var s = st();
    if (!s.plot.pts.length) return;
    say(null);
    if (s.plot.closed) {                                // reopen; give back the drawing order if closing reversed it
      var flip = reversed;
      PC.store.propose(function (d) {
        d.plot.closed = false; d.ans.streetEdge = null;
        if (flip) d.plot.pts = [d.plot.pts[0]].concat(d.plot.pts.slice(1).reverse());
      }).then(function (done) { if (done) reversed = false; render(); });
    } else PC.store.commit(function (d) { d.plot.pts.pop(); });
  }

  function clearAll() {
    var s = st();
    if (!s.plot.pts.length) return;
    // R5: the dialog also names the floor plans with edits or an approval the clearing resets (PC.store.atRisk,
    // PM round 6 sentence); one dialog, never two. An open plot has no valid plans, so it clears without asking.
    var cand = JSON.parse(JSON.stringify(s)), clear = function (d) { d.plot.pts = []; d.plot.closed = false; d.ans.streetEdge = null; };
    clear(cand); PC.site.clearOvIfOutlineChanged(s, cand);
    var plans = PC.levels.plansSentence(PC.store.atRisk(cand), [], s);
    var go = s.plot.closed ? ui.dialog.confirm({ title: 'Clear the plot?', text: 'The outline will be removed. This cannot be undone.' + (plans ? ' ' + plans : ''), ok: 'Clear', cancel: 'Cancel' }) : Promise.resolve(true);
    go.then(function (ok) {
      if (!ok) return;
      say(null); reversed = false; hover = null;
      PC.store.commit(clear);
    });
  }

  /* ---- corner drag (closed plot) ---- */
  function hitTest(sx, sy, type) {
    var s = st(), best = null, bd = ui.View2D.hitRadius(type);
    if (!s.plot.closed || drag) return null;
    s.plot.pts.forEach(function (p, i) {
      var a = view.toScreen(p), d = Math.sqrt((a[0] - sx) * (a[0] - sx) + (a[1] - sy) * (a[1] - sy));
      if (d <= bd) { bd = d; best = i; }
    });
    return best;
  }
  function dragStart(i) { var p = st().plot.pts[i]; drag = { i: i, orig: p, cur: p }; say(null); render(); }
  function dragMove(i, world) {
    if (!drag || drag.done) return;
    var s = st(), p = PC.plot.snap(world, s.ans.unit);
    if (PC.geom.same(p, drag.cur)) return;
    var r = PC.plot.canMove(s.plot.pts, i, p, true);
    if (r.ok) { drag.cur = p; say(null); } else say(r.reason === 'cross' ? 'crossMove' : 'outside');   // stays at the last valid position
    render();
  }
  function dragEnd(i, world, cancelled) {
    if (!drag || drag.done) return;
    if (!cancelled) dragMove(i, world);                  // the release point counts too
    var d = drag;
    if (cancelled || PC.geom.same(d.cur, d.orig)) { drag = null; render(); return; }
    d.done = true;                                      // keep showing the new position until the R5 gate has answered
    PC.store.propose(function (s) { s.plot.pts[d.i] = d.cur; })
      .then(function () { drag = null; render(); }, function (e) { drag = null; render(); throw e; });
  }

  ui.stages = ui.stages || {};
  ui.stages.plot = {
    init: function () {
      var canvas = ui.$('plot-canvas');
      canvas.tabIndex = 0;
      canvas.setAttribute('aria-describedby', 'pc-plot-msg');
      ui.$('plot-msg').id = 'pc-plot-msg';
      view = new ui.View2D(canvas, {
        bounds: drawArea(), draw: draw, hitTest: hitTest, onTap: onTap,
        onView: function () { if (!fitting) auto = false; },
        // The canvas changed size (strip shown, rotation): a view the user has not touched is fitted again.
        onResize: function () { if (auto) { needFit = true; ensureFit(); } },
        onHover: function (w) {
          var s = st(), h = w && !s.plot.closed && s.plot.pts.length ? PC.plot.snap(w, s.ans.unit) : null;
          if ((h && hover && PC.geom.same(h, hover)) || (!h && !hover)) return;
          hover = h; view.invalidate();
        },
        onDragStart: dragStart, onDragMove: dragMove, onDragEnd: dragEnd
      });
      ui.View2D.named.plot = view;
      ui.on(ui.$('btn-undo'), 'click', undo);
      ui.on(ui.$('btn-clear'), 'click', clearAll);
      ui.on(ui.$('btn-close-shape'), 'click', closeShape);
      ui.on(ui.$('plot-fit'), 'click', function () { fit(); });
      ui.on(canvas, 'keydown', function (e) {
        if (e.key === 'Backspace') { e.preventDefault(); undo(); }
        else if (e.key === '0') { e.preventDefault(); fit(); }
      });
      // A whole new project (sample, resumed draft, start new): fit the view to it again.
      PC.store.subscribe(function (s, prev, meta) {
        if (meta.replace) { drag = null; hover = null; note = null; reversed = false; needFit = true; ensureFit(); view.invalidate(); }
      });
      Object.assign(PC.debug, { plotLabels: function () { view.drawNow(); return labels.slice(); } });
      ui.shell.register(1, { enter: function () { view.resize(); render(); }, render: render });
    }
  };
})(globalThis.PC = globalThis.PC || {});
