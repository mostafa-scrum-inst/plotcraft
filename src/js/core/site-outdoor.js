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

  // ---- F4-T2: gate, path strip, garden seating, north marker (A-9; PM round 10 Q7 / Q8; Designer plan 2) ----
  function grow(r, k) { return { u: r.u - k, v: r.v - k, w: r.w + 2 * k, d: r.d + 2 * k }; }
  // Gate centre u on the street edge (L: the edge runs from (0, 0) to (len, 0)), or null: no gate without the wall
  // (Q7). Left / Centre / Right as seen from the street = 25 / 50 / 75 % of the edge from its low-u end.
  PC.site.gateU = function (site, extras) {
    if (!extras.wall) return null;
    var e = site.ptsL[(site.edge + 1) % site.ptsL.length], k = { left: 0.25, centre: 0.5, right: 0.75 }[extras.gate];
    return e[0] * (k === undefined ? 0.5 : k);
  };
  // The path between the street edge and the entrance (door centre), 2 m wide, spanning the gate when there is one.
  PC.site.pathStrip = function (site, extras) {
    var fp = site.footprint, cx = fp.u + fp.w / 2, g = PC.site.gateU(site, extras), h = PC.C.SITE.pathHalf;
    var a = Math.min(cx, g === null ? cx : g) - h, b = Math.max(cx, g === null ? cx : g) + h, y0 = G.bbox(site.ptsL).y0;
    return { u: a, v: y0, w: b - a, d: fp.v - y0 };
  };
  // What a yard item must stay clear of: footprint + 1 m, parking, pool + clearance, the path strip.
  function blocked(site, extras) {
    var out = [grow(site.footprint, 1), PC.site.pathStrip(site, extras)];
    if (site.parking) out.push(site.parking);
    if (site.pool) out.push(grow(site.pool, PC.C.POOL_CLEAR));
    return out;
  }

  // Seating: a 3 x 3 m pad, back yard first, then the wider side yard, the other side yard, the front yard; in each
  // yard the 0.5 m position nearest the yard's middle. Inside the plot with C.SITE.edgeClear to the edge (the wall
  // stands inside it). None -> omitted (warning, PM round 10 Q8). `along`: the benches' axis, parallel to the
  // nearest facade ('u' in the back / front yard, 'v' beside the building).
  PC.site.seating = function (site, ans) {
    if (!ans.extras.seating) return;
    var Z = PC.C.SITE.seat, k = PC.C.SITE.edgeClear, fp = site.footprint, bb = G.bbox(site.ptsL), no = blocked(site, ans.extras);
    var cx = fp.u + fp.w / 2, cv = fp.v + fp.d / 2, bk = fp.v + fp.d + 1, rt = fp.u + fp.w + 1, lf = fp.u - 1;
    function ok(r) { return G.rectInPoly(grow(r, k), site.ptsL) && !no.some(function (x) { return G.rectsOverlap(r, x); }); }
    function yard(us, vs, along) {
      for (var j = 0; j < vs.length; j++) for (var i = 0; i < us.length; i++) {
        var r = { u: us[i], v: vs[j], w: Z, d: Z };
        if (ok(r)) { site.seating = { u: r.u, v: r.v, w: Z, d: Z, along: along }; return true; }
      }
      return false;
    }
    var sides = [
      function () { return yard(scan(rt, bb.x1 - Z, (rt + bb.x1 - Z) / 2), scan(bb.y0, bb.y1 - Z, cv - Z / 2), 'v'); },
      function () { return yard(scan(bb.x0, lf - Z, (bb.x0 + lf - Z) / 2), scan(bb.y0, bb.y1 - Z, cv - Z / 2), 'v'); }
    ];
    if (bb.x1 - rt < lf - bb.x0) sides.reverse();
    if (yard(scan(bb.x0, bb.x1 - Z, cx - Z / 2), scan(bk, bb.y1 - Z, (bk + bb.y1 - Z) / 2), 'u')) return;
    if (sides[0]() || sides[1]()) return;
    if (yard(scan(bb.x0, bb.x1 - Z, cx - Z / 2), scan(bb.y0, fp.v - 1 - Z, (bb.y0 + fp.v - 1 - Z) / 2), 'u')) return;
    site.omitted.push('seating');
  };

  // North marker (Designer plan 2): a needle of length L = clamp(0.06 x max bbox side, 1.5, 3). Candidates: the
  // plot bbox corners front-left, front-right, back-left, back-right, each moved inward along the diagonal in 0.25 m
  // steps until the needle's circle (radius L / 2) plus the wall and 0.5 m lies inside the plot. The first candidate
  // whose circle is clear of the yard items wins; none clear -> the first one found (never omitted).
  PC.site.northMarker = function (site, ans) {
    var M = PC.C.SITE.marker, bb = G.bbox(site.ptsL), pts = site.ptsL, n = pts.length;
    var L = Math.min(M.max, Math.max(M.min, M.k * Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0))), r = L / 2, room = r + M.spare + PC.C.SITE.wallT;
    var no = blocked(site, ans.extras).concat(site.seating ? [site.seating] : []), first = null, diag = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0);
    function fits(p) {
      if (!G.pointInPoly(p, pts)) return false;
      for (var i = 0; i < n; i++) if (G.distPointSeg(p, pts[i], pts[(i + 1) % n]) < room - 1e-9) return false;
      return true;
    }
    function clear(p) {
      return !no.some(function (x) {
        var dx = Math.max(x.u - p[0], 0, p[0] - x.u - x.w), dy = Math.max(x.v - p[1], 0, p[1] - x.v - x.d);
        return dx * dx + dy * dy < r * r;
      });
    }
    var corners = [[bb.x0, bb.y0, 1, 1], [bb.x1, bb.y0, -1, 1], [bb.x0, bb.y1, 1, -1], [bb.x1, bb.y1, -1, -1]];
    for (var c = 0; c < corners.length; c++) {
      var k = corners[c], p = null;
      for (var t = 0; t <= diag; t += M.step) {
        var q = [k[0] + k[2] * t / Math.SQRT2, k[1] + k[3] * t / Math.SQRT2];
        if (fits(q)) { p = q; break; }
      }
      if (!p) continue;
      if (!first) first = p;
      if (clear(p)) { first = p; break; }
    }
    if (!first) first = [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2];
    site.northMarker = { u: first[0], v: first[1], L: L };
  };
})(globalThis.PC = globalThis.PC || {});
