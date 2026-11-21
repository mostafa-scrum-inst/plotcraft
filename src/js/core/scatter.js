/* PC.scatter.vegetation(site, extras): seeded tree and shrub positions in frame L (A-9; F4-T3 plan section 2 and the
   TL plan review: item 1 clearances from PC.data.vegetation, item 5 seed, rulings Q1 / Q3).
   - Seed: FNV-1a 32 of the plot points (rounded 1e-6) and the street edge -> mulberry32. Not the vegetation %, so a
     Q4 change keeps the candidate order and the garden grows or shrinks by additions and removals.
   - Candidates: a 1 m grid over the plot bbox (centres at half metres), each jittered +-0.35 m, with a scale in
     data.vegetation.scale; 3 PRNG draws per grid node whether kept or not (the order depends on the plot only). Kept:
     inside the plot and >= 0.7 m from every edge. Then a Fisher-Yates shuffle.
   - Exclusions on the item centre. Both kinds: the path strip, the seating pad + 0.3 m, the needle circle L / 2 + 0.3.
     Trees (clr = canopyR x scale[1]): footprint + 1 m + clr, parking + clr, pool + POOL_CLEAR + clr, and clr + 0.2 m
     from every plot edge. Shrubs: footprint + 1 m, parking, pool + POOL_CLEAR (PC.site.blocked).
   - Spacing between centres: tree-tree 2.4 m, tree-shrub 1.4 m, shrub-shrub 1.0 m (hash grid).
   - Selection: trees (6 m2 each) while placed + 3 <= 0.6 x veg.area, at most 120; then shrubs (1.5 m2) while
     placed + 0.75 <= veg.area, at most 200 (rounds to the nearest item).
   Returns { trees: [[u, v, s]], shrubs: [[u, v, s]], placed } (placed in m2, the counting areas). */
(function (PC) {
  'use strict';
  var G = PC.geom;
  var C = { grid: 1, jitter: 0.35, edge: 0.7, wallGap: 0.2, treeA: 6, shrubA: 1.5, treeShare: 0.6, maxTrees: 120,
    maxShrubs: 200, seatGap: 0.3, needleGap: 0.3, tt: 2.4, ts: 1.4, ss: 1.0, cell: 2.5 };

  function fnv(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // The seed text: the plot points rounded to 1e-6 and the street edge. The candidates depend on nothing else.
  function seedText(site) {
    return JSON.stringify([site.ptsL.map(function (p) { return [Math.round(p[0] * 1e6), Math.round(p[1] * 1e6)]; }), site.edge]);
  }
  function seedOf(site) { return fnv(seedText(site)); }
  function grow(r, k) { return { u: r.u - k, v: r.v - k, w: r.w + 2 * k, d: r.d + 2 * k }; }
  function inRect(p, r) { return p[0] > r.u && p[0] < r.u + r.w && p[1] > r.v && p[1] < r.v + r.d; }
  function edgeDist(p, pts) {
    var m = Infinity;
    for (var i = 0; i < pts.length; i++) m = Math.min(m, G.distPointSeg(p, pts[i], pts[(i + 1) % pts.length]));
    return m;
  }

  // Candidate points of a plot: [u, v, scale, edgeDistance], shuffled. Depends on the plot only, so the last result is
  // kept, keyed on the full seed text (not its 32-bit hash, so a collision cannot reuse another plot's points; TL F4-T3
  // implementation review finding 7). Frozen: the selection only reads it.
  var memo = { key: null, out: null, hits: 0 };
  function candidates(site) {
    var key = seedText(site);
    if (memo.key === key) { memo.hits++; return memo.out; }
    var out = Object.freeze(build(site, key).map(Object.freeze));
    memo.key = key; memo.out = out;
    return out;
  }
  function build(site, key) {
    var rnd = mulberry32(fnv(key)), V = PC.data.vegetation, bb = G.bbox(site.ptsL), out = [], g = C.grid;
    for (var y = Math.floor(bb.y0) + g / 2; y < bb.y1; y += g) {
      for (var x = Math.floor(bb.x0) + g / 2; x < bb.x1; x += g) {
        var p = [x + (rnd() * 2 - 1) * C.jitter, y + (rnd() * 2 - 1) * C.jitter], s = V.scale[0] + rnd() * (V.scale[1] - V.scale[0]);
        if (!G.pointInPoly(p, site.ptsL)) continue;
        var e = edgeDist(p, site.ptsL);
        if (e >= C.edge) out.push([p[0], p[1], s, e]);
      }
    }
    for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }

  function vegetation(site, extras) {
    var res = { trees: [], shrubs: [], placed: 0 };
    if (!site || !site.footprint || !site.veg || !(site.veg.area > 0)) return res;
    var V = PC.data.vegetation, clr = V.tree.canopyR * V.scale[1], A = site.veg.area;
    var both = [PC.site.pathStrip(site, extras)];
    if (site.seating) both.push(grow(site.seating, C.seatGap));
    var shrubNo = PC.site.blocked(site, extras).concat(both);
    var treeNo = [grow(site.footprint, 1 + clr)].concat(both);
    if (site.parking) treeNo.push(grow(site.parking, clr));
    if (site.pool) treeNo.push(grow(site.pool, PC.C.POOL_CLEAR + clr));
    var nm = site.northMarker, nr = nm ? nm.L / 2 + C.needleGap : 0;
    function free(p, no) {
      if (nm && Math.hypot(p[0] - nm.u, p[1] - nm.v) < nr) return false;
      for (var i = 0; i < no.length; i++) if (inRect(p, no[i])) return false;
      return true;
    }
    var grid = {};
    function key(i, j) { return i + ',' + j; }
    function spaced(p, tree) {
      var ci = Math.floor(p[0] / C.cell), cj = Math.floor(p[1] / C.cell);
      for (var i = ci - 1; i <= ci + 1; i++) for (var j = cj - 1; j <= cj + 1; j++) {
        var b = grid[key(i, j)];
        if (b) for (var k = 0; k < b.length; k++) {
          var q = b[k], need = tree ? (q[2] ? C.tt : C.ts) : (q[2] ? C.ts : C.ss);
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) < need) return false;
        }
      }
      return true;
    }
    function put(p, tree) { var k = key(Math.floor(p[0] / C.cell), Math.floor(p[1] / C.cell)); (grid[k] = grid[k] || []).push([p[0], p[1], tree]); }
    var cand = candidates(site), used = [], i, p;
    for (i = 0; i < cand.length && res.trees.length < C.maxTrees && res.placed + C.treeA / 2 <= C.treeShare * A; i++) {
      p = cand[i];
      if (p[3] < clr + C.wallGap || !free(p, treeNo) || !spaced(p, true)) continue;
      res.trees.push([p[0], p[1], p[2]]); put(p, true); used[i] = true; res.placed += C.treeA;
    }
    for (i = 0; i < cand.length && res.shrubs.length < C.maxShrubs && res.placed + C.shrubA / 2 <= A; i++) {
      p = cand[i];
      if (used[i] || !free(p, shrubNo) || !spaced(p, false)) continue;
      res.shrubs.push([p[0], p[1], p[2]]); put(p, false); res.placed += C.shrubA;
    }
    return res;
  }

  function capArea() { return C.maxTrees * C.treeA + C.maxShrubs * C.shrubA; }
  PC.scatter = { vegetation: vegetation, capArea: capArea, memo: function () { return { key: memo.key, hits: memo.hits }; }, seedText: seedText, candidates: candidates, seedOf: seedOf, mulberry32: mulberry32, C: C };
})(globalThis.PC = globalThis.PC || {});
