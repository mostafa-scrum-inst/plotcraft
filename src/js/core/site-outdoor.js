/* PC.site.parking / PC.site.pool: where the cars and the pool go (A-6). First candidate that fits wins;
   none -> the item is listed in site.omitted (warning) and left out of the 3D scene. */
(function (PC) {
  'use strict';
  var G = PC.geom;
  // 0.5 m positions from lo to hi, nearest to `near` first (ties: the higher one, i.e. right / back first).
  function scan(lo, hi, near) {
    var s = PC.site.T.centres, out = [], x;
    for (x = Math.ceil(lo / s - 1e-9) * s; x <= hi + 1e-9; x += s) out.push(Math.round(x * 1e6) / 1e6 + 0);                // "+ 0": never minus zero
    return out.sort(function (a, b) { return Math.abs(a - near) - Math.abs(b - near) || b - a; });
  }

  // Parking: cars x 2.5 m along the street by 5 m deep, between the street and the front wall, clear of the
  // 2 m entrance strip in front of the door; else beside the building next to the street.
  PC.site.parking = function (site, ans) {
    if (!ans.cars) return;
    var P = PC.C.PARKING, fp = site.footprint, w = ans.cars * P.w, d = P.d, bb = G.bbox(site.ptsL), v0 = 0.5;
    var cx = fp.u + fp.w / 2, strip = { u: cx - 1, v: 0, w: 2, d: fp.v };
    function ok(r, keepStrip) {
      return G.rectInPoly(r, site.ptsL) && !G.rectsOverlap(r, fp) && !(keepStrip && G.rectsOverlap(r, strip));
    }
    function take(u, v) { site.parking = { u: u, v: v, w: w, d: d, cars: ans.cars, covered: !!ans.covered }; return true; }
    // Front yard, lowest v first. With the strip kept free: nearest to the entrance first. Without it (last
    // resort): farthest from the entrance first, so the block sits against one side and covers the door least.
    function front(keepStrip) {
      var vs = scan(v0, fp.v - d, v0).sort(function (a, b) { return a - b; }), us = scan(bb.x0, bb.x1 - w, cx - w / 2), i, j;
      if (!keepStrip) us.reverse();
      for (j = 0; j < vs.length; j++) for (i = 0; i < us.length; i++) if (ok({ u: us[i], v: vs[j], w: w, d: d }, keepStrip)) return take(us[i], vs[j]);
      return false;
    }
    var deep = v0 + d <= fp.v + 1e-9, u, i, us;
    if (deep && ok({ u: cx + 1, v: v0, w: w, d: d }, true)) return take(cx + 1, v0);          // directly right of the strip
    if (deep && ok({ u: cx - 1 - w, v: v0, w: w, d: d }, true)) return take(cx - 1 - w, v0);  // directly left of it
    if (deep && front(true)) return;
    us = scan(fp.u + fp.w, bb.x1 - w, fp.u + fp.w);                                           // right side yard
    for (i = 0; i < us.length; i++) { u = us[i]; if (ok({ u: u, v: v0, w: w, d: d }, false)) return take(u, v0); }
    us = scan(bb.x0, fp.u - w, fp.u - w);                                                     // left side yard
    for (i = 0; i < us.length; i++) { u = us[i]; if (ok({ u: u, v: v0, w: w, d: d }, false)) return take(u, v0); }
    if (deep && front(false)) return;                                                         // last resort: in front of the door
    site.omitted.push('parking');
  };

  // Pool: behind the building (long side along the street) or beside it (long side inward); its 1 m clearance
  // must be inside the plot and clear of the building and the parking.
  PC.site.pool = function (site, ans) {
    if (!ans.on) return;
    var S = PC.C.POOL[ans.size], c = PC.C.POOL_CLEAR, fp = site.footprint, bb = G.bbox(site.ptsL);
    var lng = Math.max(S.w, S.d), sht = Math.min(S.w, S.d), cx = fp.u + fp.w / 2, cv = fp.v + fp.d / 2;
    function ok(r) {
      var k = { u: r.u - c, v: r.v - c, w: r.w + 2 * c, d: r.d + 2 * c };
      return G.rectInPoly(k, site.ptsL) && !G.rectsOverlap(k, fp) && !(site.parking && G.rectsOverlap(k, site.parking));
    }
    function tryAll(us, vs, w, d) {
      for (var j = 0; j < vs.length; j++) for (var i = 0; i < us.length; i++) {
        if (ok({ u: us[i], v: vs[j], w: w, d: d })) { site.pool = { u: us[i], v: vs[j], w: w, d: d }; return true; }
      }
      return false;
    }
    var back = fp.v + fp.d + c;
    if (tryAll([cx - lng / 2], [back], lng, sht)) return;                                          // centred behind
    if (tryAll(scan(bb.x0, bb.x1 - lng, cx - lng / 2), scan(back, bb.y1 - sht, back), lng, sht)) return;   // back yard
    if (tryAll(scan(fp.u + fp.w + c, bb.x1 - sht, fp.u + fp.w + c), scan(bb.y0, bb.y1 - lng, cv - lng / 2), sht, lng)) return;   // right side yard
    if (tryAll(scan(bb.x0, fp.u - c - sht, fp.u - c - sht), scan(bb.y0, bb.y1 - lng, cv - lng / 2), sht, lng)) return;         // left side yard
    site.omitted.push('pool');
  };
})(globalThis.PC = globalThis.PC || {});
