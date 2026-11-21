/* PC.three.buildSite(house, world, mats): the "site" group (A-10, F4-T2 plan 7; TL plan review required item 3;
   Designer plan 2-4). Vegetation stays for F4-T3. Items the model leaves out (site.omitted) are null there and absent.
   - "siteBatch" (one mesh): parking pads 0.02 m per car (paving); covered: a 0.1 m canopy with its top at 2.4 m on 4
     posts 0.1 m (carCanopy); pool rim 0.3 m wide, 0.1 m high, outside the water (poolRim); boundary wall 1.2 x 0.2 m
     along every plot edge, centred 0.1 m inside it (BoxBatch.addSeg), with the 3 m gate gap on the street edge and
     two 0.4 x 0.4 x 1.4 m posts beside it (trim; no leaf; no gate without the wall); seating: a 3 x 3 x 0.05 m pad
     (paving), a 0.9 x 0.9 x 0.75 m table and two 1.6 x 0.45 x 0.45 m benches 0.9 m either side (seating), parallel
     to the nearest facade; entrance step 1.2 x 0.6 x 0.15 m in front of the door (trim); north needle: two flat
     triangles 0.04 m high (BoxBatch.addFlat), the N half in northMarker, the S half in poolRim, length L.
   - "poolWater": a flush opaque PlaneGeometry over exactly the pool rectangle at Y 0.03 (rotated -PI/2 about X). */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};

  // The north needle's corners in T (X, Z), doubles: the N tip points along the A-13 north vector (sin N, -cos N).
  three.needle = function (house) {
    var nm = house.site.northMarker;
    if (!nm) return null;
    var r = house.northDeg * Math.PI / 180, nu = Math.sin(r), nv = Math.cos(r), L = nm.L, w = 0.175 * L, c = house.center;
    var T = function (du, dv) { return [nm.u + du - c[0], -(nm.v + dv - c[1])]; };
    return { tipN: T(nu * L / 2, nv * L / 2), tipS: T(-nu * L / 2, -nv * L / 2), east: T(nv * w, -nu * w), west: T(-nv * w, nu * w), L: L };
  };

  three.buildSite = function (house, world, mats) {
    var C = PC.C.SITE, SC = PC.data.siteColors, E = PC.data.exteriors[house.exterior], S = house.site;
    var cu = house.center[0], cv = house.center[1], b = new three.BoxBatch(), g = world.getObjectByName('site'), made = [];
    var X = function (u) { return u - cu; }, Z = function (v) { return -(v - cv); };
    function box(u0, u1, v0, v1, y0, y1, hex) { b.add((X(u0) + X(u1)) / 2, (y0 + y1) / 2, (Z(v0) + Z(v1)) / 2, u1 - u0, y1 - y0, v1 - v0, hex); }

    var p = S.parking;
    if (p) {
      var P = PC.C.PARKING;
      for (var i = 0; i < p.cars; i++) box(p.u + i * P.w, p.u + (i + 1) * P.w, p.v, p.v + p.d, 0, 0.02, SC.paving);
      if (p.covered) {
        var k = 0.1, top = 2.4;
        box(p.u, p.u + p.w, p.v, p.v + p.d, top - 0.1, top, SC.carCanopy);
        [[p.u, p.v], [p.u + p.w - k, p.v], [p.u, p.v + p.d - k], [p.u + p.w - k, p.v + p.d - k]].forEach(function (c) {
          box(c[0], c[0] + k, c[1], c[1] + k, 0.02, top - 0.1, SC.carCanopy);
        });
      }
    }
    var q = S.pool;
    if (q) {
      var rw = 0.3, rh = 0.1;
      box(q.u - rw, q.u + q.w + rw, q.v - rw, q.v, 0, rh, SC.poolRim); box(q.u - rw, q.u + q.w + rw, q.v + q.d, q.v + q.d + rw, 0, rh, SC.poolRim);
      box(q.u - rw, q.u, q.v, q.v + q.d, 0, rh, SC.poolRim); box(q.u + q.w, q.u + q.w + rw, q.v, q.v + q.d, 0, rh, SC.poolRim);
    }
    if (S.wall) {
      var pts = house.plot.pts, n = pts.length, h = C.wallT / 2;
      for (var e = 0; e < n; e++) {
        var a = pts[e], c2 = pts[(e + 1) % n], du = c2[0] - a[0], dv = c2[1] - a[1], l = Math.hypot(du, dv) || 1;
        var iu = -dv / l * h, iv = du / l * h;                                   // inward (counter-clockwise outline)
        var street = Math.abs(a[0]) < 1e-9 && Math.abs(a[1]) < 1e-9 && Math.abs(c2[1]) < 1e-9 && c2[0] > 0;
        var spans = [[0, l]];
        if (street && S.gate) {
          var g0 = S.gate.u - S.gate.w / 2, g1 = S.gate.u + S.gate.w / 2;
          spans = [[0, g0], [g1, l]];
          box(g0 - C.post, g0, 0, C.post, 0, C.postH, E.trim); box(g1, g1 + C.post, 0, C.post, 0, C.postH, E.trim);
        }
        spans.forEach(function (s) {
          if (s[1] - s[0] < 1e-6) return;
          var p0 = [a[0] + du / l * s[0] + iu, a[1] + dv / l * s[0] + iv], p1 = [a[0] + du / l * s[1] + iu, a[1] + dv / l * s[1] + iv];
          b.addSeg(X(p0[0]), Z(p0[1]), X(p1[0]), Z(p1[1]), C.wallT, 0, C.wallH, SC.boundaryWall);
        });
      }
    }
    var st = S.seating;
    if (st) {
      var mu = st.u + st.w / 2, mv = st.v + st.d / 2, pad = 0.05;
      box(st.u, st.u + st.w, st.v, st.v + st.d, 0, pad, SC.paving);
      box(mu - 0.45, mu + 0.45, mv - 0.45, mv + 0.45, pad, pad + 0.75, SC.seating);
      [-0.9, 0.9].forEach(function (o) {
        if (st.along === 'u') box(mu - 0.8, mu + 0.8, mv + o - 0.225, mv + o + 0.225, pad, pad + 0.45, SC.seating);
        else box(mu + o - 0.225, mu + o + 0.225, mv - 0.8, mv + 0.8, pad, pad + 0.45, SC.seating);
      });
    }
    var en = S.entrance;
    box(en.u - 0.6, en.u + 0.6, en.v - 0.6, en.v, 0, 0.15, E.trim);
    var nd = three.needle(house);
    if (nd) {
      b.addFlat([nd.tipN, nd.east, nd.west], 0, 0.04, SC.northMarker);
      b.addFlat([nd.tipS, nd.west, nd.east], 0, 0.04, SC.poolRim);
    }
    var m = b.build(mats.batch, 'siteBatch');
    if (m) { g.add(m); made.push(m); }
    if (q) {
      var water = new THREE.Mesh(new THREE.PlaneGeometry(q.w, q.d), mats.poolWater);
      water.name = 'poolWater'; water.rotation.x = -Math.PI / 2;
      water.position.set(X(q.u + q.w / 2), 0.03, Z(q.v + q.d / 2));
      water.receiveShadow = true; water.castShadow = false;
      g.add(water); made.push(water);
    }
    return made;
  };
})(globalThis.PC = globalThis.PC || {});
