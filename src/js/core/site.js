/* PC.site: the site model in frame L (A-6): edge classes, buildable set and mask, exact rectangle test,
   vegetation budget. Footprint: site-footprint.js. Parking and pool: site-outdoor.js. Pure. */
(function (PC) {
  'use strict';
  var G = PC.geom;
  var T = {                       // every tolerance of the site maths
    eps: 1e-9, fit: 1e-6, lattice: 0.25, centres: 0.5, bisect: 20, round: 0.5, backCos: Math.cos(40 * Math.PI / 180),
    noPrune: false                // test only (footprint.test.mjs): run the step 4b searches without pruning
  };
  var memo = [];                  // last few results; the R5 gate compares the current and the candidate state

  function r9(x) { return Math.round(x * 1e9) / 1e9; }
  function floor05(x) { return Math.floor((x + T.eps) / T.round) * T.round; }

  // Squared distance from (u, v) to segment ab.
  function d2(u, v, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 < 1e-18 ? 0 : Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / l2));
    var x = a[0] + t * dx - u, y = a[1] + t * dy - v;
    return x * x + y * y;
  }

  // Buildable (definition): inside the plot and at least the edge's setback away from every edge segment.
  function isBuildable(site, p) {
    var pts = site.ptsL, n = pts.length, i, s;
    if (!G.pointInPoly(p, pts)) return false;
    for (i = 0; i < n; i++) {
      s = site.setbackOf[i];
      if (s > 0 && d2(p[0], p[1], pts[i], pts[(i + 1) % n]) < (s - T.eps) * (s - T.eps)) return false;
    }
    return true;
  }

  // Exact: does the rectangle lie in the buildable set?
  function rectFits(site, rect) {
    var pts = site.ptsL, n = pts.length, i, s;
    if (rect.w <= 2 * T.fit || rect.d <= 2 * T.fit) return false;
    if (!G.pointInPoly([rect.u + rect.w / 2, rect.v + rect.d / 2], pts)) return false;
    var inner = { u: rect.u + T.fit, v: rect.v + T.fit, w: rect.w - 2 * T.fit, d: rect.d - 2 * T.fit };
    for (i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      if (G.segHitsRect(a, b, inner)) return false;
      s = site.setbackOf[i];
      if (s > 0 && G.segRectDist(a, b, rect) < s - T.fit) return false;
    }
    return true;
  }

  // Lattice mask: nodes at multiples of 0.25 m. Gives the buildable bounding box, area and candidate centres.
  // Same definition as isBuildable, computed row by row without allocations (160 000 nodes on a 100 m plot).
  function mask(site) {
    var q = T.lattice, pts = site.ptsL, n = pts.length, bb = G.bbox(pts), k;
    var ax = [], ay = [], bx = [], by = [], sb = [], x0 = [], x1 = [], y0 = [], y1 = [], far;
    for (k = 0; k < n; k++) {
      ax.push(pts[k][0]); ay.push(pts[k][1]); bx.push(pts[(k + 1) % n][0]); by.push(pts[(k + 1) % n][1]); sb.push(site.setbackOf[k]);
      far = sb[k] + T.eps;                                 // an edge matters only within its box grown by the setback
      x0.push(Math.min(ax[k], bx[k]) - far); x1.push(Math.max(ax[k], bx[k]) + far);
      y0.push(Math.min(ay[k], by[k]) - far); y1.push(Math.max(ay[k], by[k]) + far);
    }
    var xs = [];
    // Crossings of the horizontal line at height v with the outline (half-open rule), sorted.
    function row(v) {
      xs.length = 0;
      for (var e = 0; e < n; e++) if ((ay[e] > v) !== (by[e] > v)) xs.push(ax[e] + (v - ay[e]) * (bx[e] - ax[e]) / (by[e] - ay[e]));
      xs.sort(function (a, b) { return a - b; });
    }
    function inRow(u, v) {
      var c = 0, e, s, dx, dy, l2, t, px, py, dd, eps2 = T.eps * T.eps;
      for (e = 0; e < xs.length && xs[e] < u; e++) c++;
      var inside = (c & 1) === 1;
      for (e = 0; e < n; e++) {
        if (u < x0[e] || u > x1[e] || v < y0[e] || v > y1[e]) continue;
        dx = bx[e] - ax[e]; dy = by[e] - ay[e]; l2 = dx * dx + dy * dy;      // squared distance to the edge segment
        t = l2 < 1e-18 ? 0 : ((u - ax[e]) * dx + (v - ay[e]) * dy) / l2;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        px = ax[e] + t * dx - u; py = ay[e] + t * dy - v; dd = px * px + py * py;
        s = sb[e];
        if (s > 0) { if (dd < (s - T.eps) * (s - T.eps)) return false; }
        else if (dd < eps2) inside = true;                 // on an edge without setback: the boundary counts as inside
      }
      return inside;
    }
    var i0 = Math.ceil(bb.x0 / q - T.eps), i1 = Math.floor(bb.x1 / q + T.eps), j0 = Math.ceil(bb.y0 / q - T.eps), j1 = Math.floor(bb.y1 / q + T.eps);
    var nu = i1 - i0 + 1, nv = j1 - j0 + 1, bits = new Uint8Array(Math.max(0, nu * nv)), i, j, cells = 0, box = null, u, v;
    for (j = 0; j < nv; j++) {
      v = (j0 + j) * q; row(v);
      for (i = 0; i < nu; i++) {
        u = (i0 + i) * q;
        if (!inRow(u, v)) continue;
        bits[j * nu + i] = 1;
        if (!box) box = { u0: u, v0: v, u1: u, v1: v };
        else { if (u < box.u0) box.u0 = u; if (u > box.u1) box.u1 = u; if (v < box.v0) box.v0 = v; if (v > box.v1) box.v1 = v; }
      }
    }
    var ci0 = Math.floor(bb.x0 / q), ci1 = Math.ceil(bb.x1 / q), cj0 = Math.floor(bb.y0 / q), cj1 = Math.ceil(bb.y1 / q);
    for (j = cj0; j < cj1; j++) { v = (j + 0.5) * q; row(v); for (i = ci0; i < ci1; i++) if (inRow((i + 0.5) * q, v)) cells++; }
    var m = { bits: bits, i0: i0, j0: j0, nu: nu, nv: nv, bbox: box, area: cells * q * q };
    // Is the lattice node nearest to (u, v), rounded towards (cu, cv), buildable? A cheap necessary test.
    m.has = function (i, j) { i -= i0; j -= j0; return i >= 0 && j >= 0 && i < nu && j < nv && bits[j * nu + i] === 1; };
    return m;
  }

  function build(state) {
    var a = state.ans, edge = PC.frames.streetEdge(state), frame = PC.frames.make(state.plot.pts, edge);
    var ptsL = state.plot.pts.map(function (p) { var l = frame.w2l(p); return [r9(l[0]), r9(l[1])]; }), n = ptsL.length;
    var site = { edge: edge, frame: frame, ptsL: ptsL, plotArea: Math.abs(G.area(ptsL)), perimeter: G.perimeter(ptsL, true),
      edgeClass: [], edgeAuto: [], setbackOf: [], buildable: null, footprint: null, noFit: false, parking: null, pool: null,
      veg: null, seating: null, northMarker: null, omitted: [], trees: [], shrubs: [], vegPlaced: 0 };
    // Edge classes: front = street edge; back = outward normal within 40 degrees of straight away from the street
    // (automatic). In effect: the architect's override where there is one (F2-S4), else the automatic class.
    var ov = a.edgeOv || {};
    for (var i = 0; i < n; i++) {
      var p = ptsL[i], q = ptsL[(i + 1) % n], du = q[0] - p[0], dv = q[1] - p[1], len = Math.sqrt(du * du + dv * dv) || 1;
      var auto = i === edge ? 'front' : (-du / len >= T.backCos - T.eps ? 'back' : 'side');   // outward normal = (dv, -du) / len
      var cls = i !== edge && ov[i] ? ov[i] : auto;
      site.edgeAuto.push(auto);
      site.edgeClass.push(cls);
      site.setbackOf.push(cls === 'front' ? a.setbacks.front : cls === 'back' ? a.setbacks.back : a.setbacks.side);
    }
    var m = mask(site);
    site.mask = m;
    site.buildable = { area: m.area, bbox: m.bbox, ok: !!m.bbox && m.area >= PC.C.BUILDABLE_MIN - T.eps };
    PC.site.footprint(site, a.footprintPct);
    if (site.footprint) {
      PC.site.parking(site, a.parking);
      PC.site.pool(site, a.pool);
      PC.site.seating(site, a);
      PC.site.northMarker(site, a);
    }
    // Vegetation: the asked share, or what is left beside the building, parking and pool.
    var used = (site.footprint ? site.footprint.area : 0) + (site.parking ? site.parking.w * site.parking.d : 0) + (site.pool ? site.pool.w * site.pool.d : 0);
    var want = a.vegPct / 100 * site.plotArea, room = Math.max(0, site.plotArea - used), va = Math.min(want, room);
    site.veg = { area: va, pct: va / site.plotArea * 100, reduced: want > room + T.fit };
    // Trees and shrubs (F4-T3, PC.scatter): placed here so stage 2 can warn about a shortfall (PM round 11).
    var vg = PC.scatter.vegetation(site, a.extras);
    site.trees = vg.trees; site.shrubs = vg.shrubs; site.vegPlaced = vg.placed;
    return site;
  }

  PC.site = {
    T: T,
    floor05: floor05,
    isBuildable: isBuildable,
    rectFits: rectFits,

    // Site model of a closed plot (null while the plot is open). Memoised on every input it reads.
    analyse: function (state) {
      if (!state.plot.closed || state.plot.pts.length < PC.C.PLOT.minPts) return null;
      var a = state.ans;
      var key = JSON.stringify([state.plot.pts, PC.frames.streetEdge(state), a.setbacks.front, a.setbacks.back, a.setbacks.side,
        a.footprintPct, a.vegPct, a.parking.cars, a.parking.covered, a.pool.on, a.pool.size, a.edgeOv || {},
        a.extras.wall, a.extras.gate, a.extras.seating]);
      for (var i = 0; i < memo.length; i++) if (memo[i].key === key) {
        var hit = memo.splice(i, 1)[0];
        memo.unshift(hit);                               // most recently used first
        return hit.site;
      }
      var site = build(state);
      memo.unshift({ key: key, site: site });
      if (memo.length > 4) memo.pop();
      return site;
    },
    clearMemo: function () { memo.length = 0; },

    // F2-S4: switch a non-street edge of a closed plot between back and side (inside a store mutator). An override
    // equal to the automatic class is removed. Returns false (nothing changed) for the street edge, an index out of
    // range or an open plot.
    toggleEdge: function (draft, i) {
      var site = PC.site.analyse(draft);
      if (!site || !(i >= 0 && i < site.ptsL.length) || Math.floor(i) !== i || i === site.edge) return false;
      var next = site.edgeClass[i] === 'back' ? 'side' : 'back', ov = draft.ans.edgeOv;
      if (next === site.edgeAuto[i]) delete ov[i]; else ov[i] = next;
      return true;
    },

    // Overrides belong to one outline and one street edge (3.1, A-4): the store calls this on the candidate of every
    // change, after the mutator. Any change of a point, of the point count, of `closed` or of the resolved street
    // edge empties next.ans.edgeOv. Returns true when it cleared something.
    clearOvIfOutlineChanged: function (prev, next) {
      var ov = next.ans.edgeOv;
      if (!ov || !Object.keys(ov).length) return false;
      var a = prev.plot, b = next.plot, same = a.closed === b.closed && a.pts.length === b.pts.length &&
        a.pts.every(function (p, k) { return p[0] === b.pts[k][0] && p[1] === b.pts[k][1]; });
      if (same && b.closed && PC.frames.streetEdge(prev) === PC.frames.streetEdge(next)) return false;
      next.ans.edgeOv = {};
      return true;
    }
  };
})(globalThis.PC = globalThis.PC || {});
