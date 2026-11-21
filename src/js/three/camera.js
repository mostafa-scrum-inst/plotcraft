/* PC.three.controls: Pointer Events adapter for the orbit camera (A-12). Pure pose maths lives in PC.cam.
   attach(canvas, api) -> detach(). api: { active(), get(), set(pose) (clamps + invalidates), size() -> [w, h],
   fov, onInput() }. One pointer (mouse left without Shift, or one finger) orbits; mouse right button or Shift+drag
   pans; two pointers pinch (distance ratio -> zoom) and pan (midpoint shift) together; wheel zooms (passive: false,
   preventDefault); context menu suppressed; keys on the focused canvas: arrows orbit, + / - zoom. Every input calls
   api.onInput() (F5: cancels flights and tours). No THREE here. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};
  var D = Math.PI / 180;

  three.controls = {
    attach: function (canvas, api) {
      var pts = new Map(), mode = null, two = null;
      function K() { return PC.C.CAM; }
      function minSide() { var s = api.size(); return Math.max(1, Math.min(s[0], s[1])); }
      function apply(p) { api.set(p); if (api.onInput) api.onInput(); }
      function twoState() { var a = Array.from(pts.values()); return { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2 }; }
      function down(e) {
        if (!api.active()) return;
        if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
        // QA F4T1-2: preventDefault below cancels the click's focus, so a mouse press focuses the canvas itself
        // (keys act on the focused canvas, A-12); touch does not, to keep the on-screen keyboard closed.
        if (e.pointerType === 'mouse' && canvas.focus) canvas.focus({ preventScroll: true });
        if (canvas.setPointerCapture) try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 1) mode = (e.pointerType === 'mouse' && (e.button === 2 || e.shiftKey)) ? 'pan' : 'orbit';
        if (pts.size === 2) { mode = 'two'; two = twoState(); }
        if (e.preventDefault) e.preventDefault();
      }
      function move(e) {
        var q = pts.get(e.pointerId);
        if (!q || !api.active()) return;
        var dx = e.clientX - q.x, dy = e.clientY - q.y;
        q.x = e.clientX; q.y = e.clientY;
        var p = api.get(), s = api.size();
        if (!p || (!dx && !dy)) return;
        if (pts.size >= 2) {
          if (pts.size > 2) return;
          var n = twoState(), mpp = PC.cam.metresPerPx(p, api.fov, s[1]);
          p = PC.cam.zoom(p, two.d / n.d);
          p = PC.cam.pan(p, n.mx - two.mx, n.my - two.my, mpp);
          two = n;
        } else if (mode === 'pan') p = PC.cam.pan(p, dx, dy, PC.cam.metresPerPx(p, api.fov, s[1]));
        else p = PC.cam.orbit(p, -dx * Math.PI / minSide(), -dy * Math.PI / minSide());
        apply(p);
      }
      function up(e) {
        if (!pts.delete(e.pointerId)) return;
        if (canvas.releasePointerCapture) try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }
        if (pts.size === 2) two = twoState();
        else if (pts.size === 1) mode = 'orbit';          // the remaining finger orbits from where it is: no jump
        else mode = null;
      }
      function wheel(e) {
        if (!api.active() || !api.get()) return;
        e.preventDefault();
        apply(PC.cam.zoom(api.get(), Math.exp(e.deltaY * K().wheelK)));
      }
      function menu(e) { e.preventDefault(); }
      function key(e) {
        if (!api.active() || !api.get()) return;
        var p = api.get(), st = K().keyDeg * D, z = K().keyZoom, k = e.key;
        if (k === 'ArrowLeft') p = PC.cam.orbit(p, -st, 0);
        else if (k === 'ArrowRight') p = PC.cam.orbit(p, st, 0);
        else if (k === 'ArrowUp') p = PC.cam.orbit(p, 0, -st);
        else if (k === 'ArrowDown') p = PC.cam.orbit(p, 0, st);
        else if (k === '+' || k === '=') p = PC.cam.zoom(p, 1 / z);
        else if (k === '-' || k === '_') p = PC.cam.zoom(p, z);
        else return;
        e.preventDefault();
        apply(p);
      }
      var L = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up],
        ['wheel', wheel, { passive: false }], ['contextmenu', menu], ['keydown', key]];
      L.forEach(function (l) { canvas.addEventListener(l[0], l[1], l[2]); });
      return function detach() { L.forEach(function (l) { canvas.removeEventListener(l[0], l[1], l[2]); }); pts.clear(); };
    }
  };
})(globalThis.PC = globalThis.PC || {});
