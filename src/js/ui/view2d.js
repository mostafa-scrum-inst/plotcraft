/* PC.ui.View2D: a pannable, zoomable 2D canvas (A-15). World metres with y up <-> CSS pixels. It knows nothing
   about what is drawn: the owner supplies draw(), hitTest() and the gesture callbacks.
   Options: bounds {x0, y0, x1, y1}, maxScale, locked (no pan, pinch, wheel zoom or view keys: the owner sets the
   view; taps and handle drags still work, and the wheel is left to the page), draw(view), onResize(view, first), onView(view),
   hitTest(sx, sy, pointerType) -> handle or null, onTap(world, event), onHover(world | null),
   onDragStart(handle, world), onDragMove(handle, world), onDragEnd(handle, world, cancelled). */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};
  var SLOP = 8, TAP_MS = 700, EDGE = 40;

  function View2D(canvas, o) {
    this.canvas = canvas; this.o = o || {};
    this.ctx = canvas.getContext('2d');
    this.scale = 10; this.ox = 0; this.oy = 0;          // px per metre; screen position of the world origin
    this.width = 0; this.height = 0; this.dpr = 1;
    this._raf = 0; this._ptr = {}; this._n = 0; this._mode = 'idle'; this._g = null;
    this._bind();
    this.resize();
  }
  var V = View2D.prototype;

  View2D.named = {};                                    // views by name, for PC.debug.toScreen
  // Handle hit radius in CSS px: a 44 px target for fingers and pens, tighter for a mouse.
  View2D.hitRadius = function (pointerType) { return pointerType === 'mouse' ? 10 : 22; };

  V.toScreen = function (p) { return [this.ox + p[0] * this.scale, this.oy - p[1] * this.scale]; };
  V.toWorld = function (sx, sy) { return [(sx - this.ox) / this.scale, (this.oy - sy) / this.scale]; };

  V.minScale = function () {
    var b = this.o.bounds;
    if (!b || !this.width) return 0.5;
    return Math.min(this.width / (b.x1 - b.x0), this.height / (b.y1 - b.y0)) * 0.8;
  };
  V.maxScale = function () { return this.o.maxScale || 80; };

  // Keep part of the bounds on screen.
  V._clamp = function () {
    var b = this.o.bounds;
    if (!b || !this.width) return;
    var e = Math.min(EDGE, this.width / 3, this.height / 3), s = this.scale;
    this.ox = Math.min(this.width - e - b.x0 * s, Math.max(e - b.x1 * s, this.ox));
    this.oy = Math.min(this.height - e + b.y1 * s, Math.max(e + b.y0 * s, this.oy));
  };
  V._changed = function () { this._clamp(); if (this.o.onView) this.o.onView(this); this.invalidate(); };

  V.zoomAt = function (sx, sy, factor) {
    var w = this.toWorld(sx, sy);
    this.scale = Math.max(this.minScale(), Math.min(this.maxScale(), this.scale * factor));
    this.ox = sx - w[0] * this.scale; this.oy = sy + w[1] * this.scale;
    this._changed();
  };
  V.panBy = function (dx, dy) { this.ox += dx; this.oy += dy; this._changed(); };

  // Show a world box centred in the canvas minus pad. pad: CSS px, a number or { t, r, b, l }.
  V.fit = function (box, pad) {
    if (!this.width) return;
    var q = typeof pad === 'number' ? { t: pad, r: pad, b: pad, l: pad } : (pad || { t: 0, r: 0, b: 0, l: 0 });
    var k = Math.min(1, 0.7 * this.width / (q.l + q.r || 1), 0.7 * this.height / (q.t + q.b || 1));   // the pad never takes more than 70 % of the canvas
    var l = q.l * k, rr = q.r * k, t = q.t * k, b = q.b * k;
    var bw = Math.max(box.x1 - box.x0, 1e-6), bh = Math.max(box.y1 - box.y0, 1e-6);
    this.scale = Math.max(this.minScale(), Math.min(this.maxScale(), (this.width - l - rr) / bw, (this.height - t - b) / bh));
    this.ox = l + (this.width - l - rr) / 2 - (box.x0 + box.x1) / 2 * this.scale;
    this.oy = t + (this.height - t - b) / 2 + (box.y0 + box.y1) / 2 * this.scale;
    this._changed();
  };

  // Match the bitmap to the CSS size (device pixel ratio capped at 2). The world point at the centre stays there.
  V.resize = function () {
    var w = this.canvas.clientWidth, h = this.canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!w || !h) return false;
    if (w === this.width && h === this.height && dpr === this.dpr) return true;
    var first = !this.width, c = first ? null : this.toWorld(this.width / 2, this.height / 2);
    this.width = w; this.height = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    if (c) { this.ox = w / 2 - c[0] * this.scale; this.oy = h / 2 + c[1] * this.scale; this._clamp(); }
    if (this.o.onResize) this.o.onResize(this, first);
    this.invalidate();
    return true;
  };

  V.invalidate = function () {
    var self = this;
    if (!this._raf) this._raf = requestAnimationFrame(function () { self._raf = 0; self.drawNow(); });
  };
  V.drawNow = function () {
    if (!this.width || !this.o.draw) return;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.o.draw(this);
  };

  /* ---- gestures: Pointer Events only ---- */
  V._pos = function (e) { var r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  V._two = function () {
    var k = Object.keys(this._ptr), a = this._ptr[k[0]], b = this._ptr[k[1]];
    return { d: Math.max(1, Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y))), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  V._cancelDrag = function () {
    var g = this._g;
    if (this._mode === 'drag' && this.o.onDragEnd) this.o.onDragEnd(g.handle, this.toWorld(g.x, g.y), true);
  };

  V._down = function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var p = this._pos(e), o = this.o;
    // A new primary pointer starts a new gesture. Pointers still tracked then never got their up or cancel
    // (capture lost, event dropped): forget them, or every later touch would count as a second finger.
    if (e.isPrimary && this._n) { this._cancelDrag(); this._ptr = {}; this._n = 0; this._mode = 'idle'; this._g = null; }
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    this._ptr[e.pointerId] = p; this._n = Object.keys(this._ptr).length;
    if (o.onHover) o.onHover(null);
    if (this._n === 1) {
      this._g = { x: p.x, y: p.y, x0: p.x, y0: p.y, t: Date.now(), type: e.pointerType,
        handle: o.hitTest ? o.hitTest(p.x, p.y, e.pointerType) : null };
      this._mode = 'pending';
    } else if (this._n === 2) {            // second finger: whatever was going on is off, pinch starts
      this._cancelDrag();
      this._mode = 'pinch'; this._g = this._two();
    }
  };

  V._move = function (e) {
    var p = this._pos(e), o = this.o, g = this._g, t = this._ptr[e.pointerId];
    if (!t) {                               // no button held: hover (mouse and pen)
      if (this._mode === 'idle' && e.pointerType !== 'touch' && o.onHover) o.onHover(this.toWorld(p.x, p.y));
      return;
    }
    t.x = p.x; t.y = p.y;
    if (this._mode === 'pending') {
      var dx = p.x - g.x0, dy = p.y - g.y0;
      if (dx * dx + dy * dy <= SLOP * SLOP) return;
      if (g.handle !== null && g.handle !== undefined) {
        this._mode = 'drag';
        if (o.onDragStart) o.onDragStart(g.handle, this.toWorld(g.x0, g.y0));
      } else this._mode = o.locked ? 'spent' : 'pan';
    }
    if (this._mode === 'drag') { g.x = p.x; g.y = p.y; if (o.onDragMove) o.onDragMove(g.handle, this.toWorld(p.x, p.y)); }
    else if (this._mode === 'pan') { var mx = p.x - g.x, my = p.y - g.y; g.x = p.x; g.y = p.y; this.panBy(mx, my); }
    else if (this._mode === 'pinch' && this._n >= 2 && !o.locked) {
      var n = this._two();
      this.zoomAt(n.x, n.y, n.d / g.d);
      this.panBy(n.x - g.x, n.y - g.y);
      this._g = n;
    }
  };

  V._up = function (e, cancelled) {
    if (!this._ptr[e.pointerId]) return;
    var p = this._pos(e), o = this.o, g = this._g, mode = this._mode;
    delete this._ptr[e.pointerId]; this._n = Object.keys(this._ptr).length;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }
    if (mode === 'drag') { if (o.onDragEnd) o.onDragEnd(g.handle, this.toWorld(p.x, p.y), !!cancelled); }
    else if (mode === 'pending' && !cancelled && Date.now() - g.t <= TAP_MS && o.onTap) o.onTap(this.toWorld(g.x0, g.y0), e);
    // After a pinch the gesture is spent until every pointer is up: a lifted finger never taps.
    this._mode = this._n === 0 ? 'idle' : 'spent';
    if (this._n === 0) this._g = null;
  };

  V._wheel = function (e) {
    if (this.o.locked) return;                       // not consumed: the page may scroll
    e.preventDefault();
    var p = this._pos(e), d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    this.zoomAt(p.x, p.y, Math.exp(-d * 0.0015));
  };

  // Keys on the focused canvas: + / - zoom about the centre, arrows pan.
  V._key = function (e) {
    var step = 40, k = e.key;
    if (this.o.locked || e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === '+' || k === '=') this.zoomAt(this.width / 2, this.height / 2, 1.25);
    else if (k === '-' || k === '_') this.zoomAt(this.width / 2, this.height / 2, 0.8);
    else if (k === 'ArrowLeft') this.panBy(step, 0);
    else if (k === 'ArrowRight') this.panBy(-step, 0);
    else if (k === 'ArrowUp') this.panBy(0, step);
    else if (k === 'ArrowDown') this.panBy(0, -step);
    else return;
    e.preventDefault();
  };

  V._bind = function () {
    var self = this, c = this.canvas;
    c.addEventListener('pointerdown', function (e) { self._down(e); });
    c.addEventListener('pointermove', function (e) { self._move(e); });
    c.addEventListener('pointerup', function (e) { self._up(e, false); });
    c.addEventListener('pointercancel', function (e) { self._up(e, true); });
    // Capture lost without an up (normal releases are already untracked by then): same as a cancel.
    c.addEventListener('lostpointercapture', function (e) { self._up(e, true); });
    c.addEventListener('pointerleave', function () { if (self._mode === 'idle' && self.o.onHover) self.o.onHover(null); });
    c.addEventListener('wheel', function (e) { self._wheel(e); }, { passive: false });
    c.addEventListener('keydown', function (e) { self._key(e); });
    var again = function () { self.resize(); };
    if (window.ResizeObserver) new ResizeObserver(again).observe(c.parentNode || c);
    else window.addEventListener('resize', again);
  };

  ui.View2D = View2D;
})(globalThis.PC = globalThis.PC || {});
