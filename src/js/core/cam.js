/* PC.cam: orbit-camera pose maths (A-12), frame T, plain arrays, angles in radians. Pure.
   pose = { target: [x, y, z], radius, theta, phi }: theta = azimuth about +Y (0 = eye on the +Z / street side,
   positive towards +X), phi = angle from the vertical. The eye is target + radius (sin phi sin theta, cos phi,
   sin phi cos theta). Limits come from the house model and the canvas aspect (the reset radius is aspect-aware,
   TL F4-T1 plan review ruling 1): phi in [5, 85] degrees, radius in [4, rMax], target in the plot bounding box with
   Y in [0, roof base], then phi is lowered until the eye is 1 m or more above ground. */
(function (PC) {
  'use strict';
  var D = Math.PI / 180;
  function K() { return PC.C.CAM; }
  function clampN(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function wrapAngle(a) { a = a % (2 * Math.PI); if (a > Math.PI) a -= 2 * Math.PI; if (a <= -Math.PI) a += 2 * Math.PI; return a; }
  function copy(p) { return { target: [p.target[0], p.target[1], p.target[2]], radius: p.radius, theta: p.theta, phi: p.phi }; }

  var C = PC.cam = {
    // Distance at which the plot's bounding circle fits both half-angles of the view.
    resetRadius: function (house, aspect) {
      var k = K(), hv = k.fov / 2 * D, hh = Math.atan(Math.tan(hv) * (aspect > 0 ? aspect : 1));
      return Math.max(k.resetK * house.radius, k.resetFit * house.radius / Math.sin(Math.min(hv, hh)));
    },
    limits: function (house, aspect) {
      var k = K(), xs = house.plot.pts.map(function (p) { return p[0] - house.center[0]; });
      var zs = house.plot.pts.map(function (p) { return -(p[1] - house.center[1]); });
      return {
        phiMin: k.phiMin * D, phiMax: k.phiMax * D, rMin: k.rMin,
        rMax: Math.max(k.rMaxK * house.radius, k.rMaxReset * C.resetRadius(house, aspect)),
        box: { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: 0, y1: Math.max(0, house.roof.baseY),
          z0: Math.min.apply(null, zs), z1: Math.max.apply(null, zs) },
        eyeMin: k.eyeMin
      };
    },
    reset: function (house, aspect) {
      return { target: [0, 0, 0], radius: C.resetRadius(house, aspect), theta: K().resetTheta * D, phi: K().resetPhi * D };
    },
    clamp: function (p, L) {
      var q = copy(p), b = L.box;
      q.theta = wrapAngle(q.theta);
      q.phi = clampN(q.phi, L.phiMin, L.phiMax);
      q.radius = clampN(q.radius, L.rMin, L.rMax);
      q.target = [clampN(q.target[0], b.x0, b.x1), clampN(q.target[1], b.y0, b.y1), clampN(q.target[2], b.z0, b.z1)];
      var need = L.eyeMin - q.target[1];
      if (need > 0) q.phi = Math.min(q.phi, Math.acos(Math.min(1, need / q.radius)));
      return q;
    },
    position: function (p) {
      var s = Math.sin(p.phi);
      return [p.target[0] + p.radius * s * Math.sin(p.theta), p.target[1] + p.radius * Math.cos(p.phi), p.target[2] + p.radius * s * Math.cos(p.theta)];
    },
    orbit: function (p, dTheta, dPhi) { var q = copy(p); q.theta += dTheta; q.phi += dPhi; return q; },
    zoom: function (p, factor) { var q = copy(p); q.radius *= factor; return q; },
    // Ground-plane pan by a screen drag (px) at mPerPx metres per pixel: the content follows the pointer.
    pan: function (p, dx, dy, mPerPx) {
      var q = copy(p), c = Math.cos(p.theta), s = Math.sin(p.theta);
      q.target[0] += -c * dx * mPerPx - s * dy * mPerPx;
      q.target[2] += s * dx * mPerPx - c * dy * mPerPx;
      return q;
    },
    metresPerPx: function (p, fovDeg, viewH) { return 2 * p.radius * Math.tan(fovDeg / 2 * D) / Math.max(1, viewH); },
    // Near plane that follows the orbit radius (TL ruling, required item 9).
    near: function (p) { return Math.max(K().nearMin, K().nearK * p.radius); },
    // Smoothstep interpolation, shortest arc in theta (F5 flights).
    lerpPose: function (a, b, k) {
      var s = k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k), dT = wrapAngle(b.theta - a.theta);
      return {
        target: [0, 1, 2].map(function (i) { return a.target[i] + (b.target[i] - a.target[i]) * s; }),
        radius: a.radius + (b.radius - a.radius) * s, theta: wrapAngle(a.theta + dT * s), phi: a.phi + (b.phi - a.phi) * s
      };
    },
    copy: copy
  };
})(globalThis.PC = globalThis.PC || {});
