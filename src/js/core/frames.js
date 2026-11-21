/* PC.frames: coordinate frames of A-5. W = grid metres; L = street-local (u along the street edge, v inward);
   T = three.js (X = u - cu, Y = height, Z = -(v - cv)). */
(function (PC) {
  'use strict';
  PC.frames = {
    // Frame L for the street edge pts[i] -> pts[i + 1] of a counter-clockwise polygon.
    make: function (pts, edgeIndex) {
      var n = pts.length, a = pts[edgeIndex], b = pts[(edgeIndex + 1) % n];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / l, uy = dy / l;                    // u; v = u turned +90 degrees = (-uy, ux)
      return {
        origin: [a[0], a[1]], ux: ux, uy: uy,
        w2l: function (p) { var x = p[0] - a[0], y = p[1] - a[1]; return [x * ux + y * uy, -x * uy + y * ux]; },
        l2w: function (q) { return [a[0] + q[0] * ux - q[1] * uy, a[1] + q[0] * uy + q[1] * ux]; }
      };
    },

    // The street edge in use: the stored index, else the default rule.
    streetEdge: function (state) {
      var e = state.ans.streetEdge;
      return e === null ? PC.plot.defaultStreetEdge(state.plot.pts) : e;
    },

    // North in L: degrees clockwise from +v, seen from above. 0 when Q5 is at its default.
    northL: function (state) {
      var n = state.ans.north;
      if (n === null) return 0;
      var f = PC.frames.make(state.plot.pts, PC.frames.streetEdge(state)), r = n * Math.PI / 180;
      var wx = Math.sin(r), wy = Math.cos(r);          // north as a W vector (clockwise from grid +y)
      var deg = Math.atan2(wx * f.ux + wy * f.uy, -wx * f.uy + wy * f.ux) * 180 / Math.PI;
      return ((Math.round(deg * 1e6) / 1e6) % 360 + 360) % 360;
    },

    // Direction of +v (straight back from the street) as a W angle: degrees clockwise from grid +y.
    backW: function (state) {
      var f = PC.frames.make(state.plot.pts, PC.frames.streetEdge(state));
      return ((Math.atan2(-f.uy, f.ux) * 180 / Math.PI) % 360 + 360) % 360;
    },
    // Q5 value (W angle, multiple of 15) for a north that points degL clockwise from +v.
    northToW: function (state, degL) {
      var s = PC.C.NORTH_STEP, w = Math.round((degL + PC.frames.backW(state)) / s) * s;
      return ((w % 360) + 360) % 360;
    },
    // Q5 one step (dir = +1 clockwise, -1 anticlockwise) from the current value; from the default it starts at
    // the default direction rounded to the step.
    northStep: function (state, dir) {
      var s = PC.C.NORTH_STEP, n = state.ans.north, base = n === null ? Math.round(PC.frames.backW(state) / s) * s : n;
      return (((base + dir * s) % 360) + 360) % 360;
    },

    // L point at height h -> T coordinates; center = [cu, cv] (plot bounding-box centre in L).
    l2t: function (center, u, v, h) { return [u - center[0], h, -(v - center[1])]; }
  };
})(globalThis.PC = globalThis.PC || {});
