/* PC.plot: the plot drawing rules of F1 as pure functions. World frame W: metres, y up, area 0..extent. */
(function (PC) {
  'use strict';
  var G = PC.geom;
  function r4(x) { return Math.round(x * 1e4) / 1e4; }

  function inBounds(p) {
    var e = PC.C.PLOT.extent;
    return p[0] >= -G.EPS && p[0] <= e + G.EPS && p[1] >= -G.EPS && p[1] <= e + G.EPS;
  }

  // Outline without self-contact: no repeated corner, no edge crossing or touching another edge,
  // neighbouring edges not folded back onto each other.
  function simple(pts, closed) {
    var n = pts.length, i, j;
    if (closed && n < 3) return false;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) if (G.same(pts[i], pts[j])) return false;
    var m = closed ? n : n - 1;                        // number of edges
    for (i = 0; i < m; i++) for (j = i + 1; j < m; j++) {
      var a = pts[i], b = pts[(i + 1) % n], c = pts[j], d = pts[(j + 1) % n];
      var neighbours = j === i + 1 || (closed && i === 0 && j === m - 1);
      var rel = G.segRelation(a, b, c, d);
      if (neighbours ? rel === 'overlap' : rel !== 'none') return false;
    }
    return true;
  }

  PC.plot = {
    inBounds: inBounds,
    simple: simple,

    // Nearest snap point for the unit (4.3), clamped into the area. Existing points are never re-snapped.
    snap: function (p, unit) {
      var s = PC.C.GRID[unit === 'ft' ? 'ft' : 'm'].snap, e = PC.C.PLOT.extent;
      function one(v) { return r4(Math.max(0, Math.min(e, Math.round(v / s) * s))); }
      return [one(p[0]), one(p[1])];
    },

    // May p become the next corner of the open outline? reason: 'same' (on the previous point, ignore),
    // 'max' (limit reached), 'outside', 'cross' (would cross or touch the outline).
    canAdd: function (pts, p) {
      var n = pts.length;
      if (n && G.same(pts[n - 1], p)) return { ok: false, reason: 'same' };
      if (n >= PC.C.PLOT.maxPts) return { ok: false, reason: 'max' };
      if (!inBounds(p)) return { ok: false, reason: 'outside' };
      if (!simple(pts.concat([p]), false)) return { ok: false, reason: 'cross' };
      return { ok: true };
    },

    // reason: 'few' (under 3 points), 'cross' (closing edge crosses or touches; also all points on one line).
    canClose: function (pts) {
      if (pts.length < PC.C.PLOT.minPts) return { ok: false, reason: 'few' };
      if (!simple(pts, true)) return { ok: false, reason: 'cross' };
      return { ok: true };
    },

    // May corner i move to p? reason: 'outside', 'cross' (self-contact, or a closed plot turned inside out).
    canMove: function (pts, i, p, closed) {
      if (!inBounds(p)) return { ok: false, reason: 'outside' };
      var q = pts.slice(); q[i] = p;
      if (!simple(q, closed)) return { ok: false, reason: 'cross' };
      // A closed plot stays counter-clockwise: a corner pulled through the opposite side would turn it inside out.
      if (closed && G.area(q) <= G.EPS) return { ok: false, reason: 'cross' };
      return { ok: true };
    },

    // Counter-clockwise copy; the first point stays first.
    normalise: function (pts) {
      var c = pts.map(function (p) { return [p[0], p[1]]; });
      return G.area(c) < 0 ? [c[0]].concat(c.slice(1).reverse()) : c;
    },

    // Q6 default: the edge whose midpoint is lowest; tie -> the longer edge; still tied -> the lowest index.
    defaultStreetEdge: function (pts) {
      var best = -1, by = 0, bl = 0, n = pts.length, i;
      for (i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % n], y = (a[1] + b[1]) / 2, l = G.dist(a, b);
        if (best < 0 || y < by - G.EPS || (Math.abs(y - by) <= G.EPS && l > bl + G.EPS)) { best = i; by = y; bl = l; }
      }
      return best;
    },

    // Draft check: every point in the area, no self-contact, counter-clockwise once closed.
    valid: function (plot) {
      if (!plot.pts.every(inBounds) || !simple(plot.pts, plot.closed)) return false;
      return !plot.closed || G.area(plot.pts) > G.EPS;
    }
  };
})(globalThis.PC = globalThis.PC || {});
