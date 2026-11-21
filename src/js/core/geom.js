/* PC.geom: plane geometry on [x, y] points in metres. Pure. */
(function (PC) {
  'use strict';
  var EPS = 1e-9;
  function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
  function dist(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1]; return Math.sqrt(dx * dx + dy * dy); }
  // p is known to be on the line through a and b: is it within the segment?
  function within(p, a, b) {
    return p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS &&
           p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;
  }

  PC.geom = {
    EPS: EPS,
    dist: dist,
    same: function (a, b) { return Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS; },

    // Signed shoelace area: positive for a counter-clockwise polygon.
    area: function (pts) {
      var a = 0, n = pts.length, i, p, q;
      for (i = 0; i < n; i++) { p = pts[i]; q = pts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; }
      return a / 2;
    },

    // Length of the outline; closed adds the edge back to the first point.
    perimeter: function (pts, closed) {
      var s = 0, n = pts.length, i;
      for (i = 0; i + 1 < n; i++) s += dist(pts[i], pts[i + 1]);
      if (closed && n > 1) s += dist(pts[n - 1], pts[0]);
      return s;
    },

    bbox: function (pts) {
      var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      pts.forEach(function (p) {
        if (p[0] < b.x0) b.x0 = p[0]; if (p[0] > b.x1) b.x1 = p[0];
        if (p[1] < b.y0) b.y0 = p[1]; if (p[1] > b.y1) b.y1 = p[1];
      });
      return b;
    },

    // Area centroid of a simple polygon (the vertex mean when the area is zero).
    centroid: function (pts) {
      var a = 0, cx = 0, cy = 0, n = pts.length, i, p, q, f;
      for (i = 0; i < n; i++) {
        p = pts[i]; q = pts[(i + 1) % n]; f = p[0] * q[1] - q[0] * p[1];
        a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
      }
      if (Math.abs(a) < EPS) {
        cx = 0; cy = 0;
        pts.forEach(function (v) { cx += v[0]; cy += v[1]; });
        return n ? [cx / n, cy / n] : [0, 0];
      }
      return [cx / (3 * a), cy / (3 * a)];
    },

    // Even-odd test; points on the boundary count as inside.
    pointInPoly: function (p, pts) {
      var inside = false, n = pts.length, i, j, a, b;
      for (i = 0, j = n - 1; i < n; j = i++) {
        a = pts[i]; b = pts[j];
        if (Math.abs(cross(a, b, p)) < EPS && within(p, a, b)) return true;
        if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      return inside;
    },

    // A point well inside a simple polygon, for a label: the best of the centroid and a coarse lattice,
    // by distance to the nearest edge.
    innerPoint: function (pts) {
      var G = PC.geom, b = G.bbox(pts), n = pts.length, best = null, bd = -1, N = 16, i, j;
      function clearance(p) {
        var d = Infinity, k;
        for (k = 0; k < n; k++) d = Math.min(d, G.distPointSeg(p, pts[k], pts[(k + 1) % n]));
        return d;
      }
      function consider(p, bonus) {
        if (!G.pointInPoly(p, pts)) return;
        var d = clearance(p) * bonus;
        if (d > bd) { bd = d; best = p; }
      }
      consider(G.centroid(pts), 1.25);                  // prefer the centroid unless a lattice point is clearly better
      for (i = 1; i < N; i++) for (j = 1; j < N; j++) consider([b.x0 + (b.x1 - b.x0) * i / N, b.y0 + (b.y1 - b.y0) * j / N], 1);
      return best || G.centroid(pts);
    },

    distPointSeg: function (p, a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      if (l2 < EPS * EPS) return dist(p, a);
      var t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
      return dist(p, [a[0] + t * dx, a[1] + t * dy]);
    },

    /* ---- rectangles { u, v, w, d }: axis-aligned, lower corner (u, v) ---- */

    // Does segment ab have a point in the closed rectangle?
    segHitsRect: function (a, b, r) {
      var t0 = 0, t1 = 1, dx = b[0] - a[0], dy = b[1] - a[1];
      var P = [-dx, dx, -dy, dy], Q = [a[0] - r.u, r.u + r.w - a[0], a[1] - r.v, r.v + r.d - a[1]], i, t;
      for (i = 0; i < 4; i++) {
        if (Math.abs(P[i]) < 1e-12) { if (Q[i] < 0) return false; continue; }
        t = Q[i] / P[i];
        if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
      return true;
    },

    // Shortest distance between segment ab and the rectangle (0 when they meet).
    segRectDist: function (a, b, r) {
      var G = PC.geom;
      if (G.segHitsRect(a, b, r)) return 0;
      function toRect(p) {
        var dx = Math.max(r.u - p[0], 0, p[0] - r.u - r.w), dy = Math.max(r.v - p[1], 0, p[1] - r.v - r.d);
        return Math.sqrt(dx * dx + dy * dy);
      }
      return Math.min(toRect(a), toRect(b),
        G.distPointSeg([r.u, r.v], a, b), G.distPointSeg([r.u + r.w, r.v], a, b),
        G.distPointSeg([r.u + r.w, r.v + r.d], a, b), G.distPointSeg([r.u, r.v + r.d], a, b));
    },

    // Rectangle inside the polygon (touching the boundary is allowed): centre inside and no polygon edge
    // enters the rectangle shrunk by tol.
    rectInPoly: function (r, pts, tol) {
      var G = PC.geom, t = tol === undefined ? 1e-6 : tol, n = pts.length, i;
      if (r.w <= 2 * t || r.d <= 2 * t) return false;
      if (!G.pointInPoly([r.u + r.w / 2, r.v + r.d / 2], pts)) return false;
      var inner = { u: r.u + t, v: r.v + t, w: r.w - 2 * t, d: r.d - 2 * t };
      for (i = 0; i < n; i++) if (G.segHitsRect(pts[i], pts[(i + 1) % n], inner)) return false;
      return true;
    },

    // Do the interiors of two rectangles overlap (by more than tol)?
    rectsOverlap: function (r, s, tol) {
      var t = tol === undefined ? 1e-6 : tol;
      return r.u < s.u + s.w - t && s.u < r.u + r.w - t && r.v < s.v + s.d - t && s.v < r.v + r.d - t;
    },

    // How segments ab and cd meet: 'none', 'cross' (interiors cross), 'touch' (one point in common that is an
    // end of at least one of them) or 'overlap' (collinear with a shared length).
    segRelation: function (a, b, c, d) {
      var d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
      var z1 = Math.abs(d1) < EPS, z2 = Math.abs(d2) < EPS, z3 = Math.abs(d3) < EPS, z4 = Math.abs(d4) < EPS;
      if (z1 && z2 && z3 && z4) {
        var k = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1;
        var lo = Math.max(Math.min(a[k], b[k]), Math.min(c[k], d[k])), hi = Math.min(Math.max(a[k], b[k]), Math.max(c[k], d[k]));
        return hi - lo > EPS ? 'overlap' : (hi - lo > -EPS ? 'touch' : 'none');
      }
      if (!z1 && !z2 && !z3 && !z4) return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0) ? 'cross' : 'none';
      if ((z1 && within(a, c, d)) || (z2 && within(b, c, d)) || (z3 && within(c, a, b)) || (z4 && within(d, a, b))) return 'touch';
      return 'none';
    }
  };
})(globalThis.PC = globalThis.PC || {});
