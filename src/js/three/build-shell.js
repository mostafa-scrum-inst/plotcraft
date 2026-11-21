/* PC.three.buildShell(house, world, mats): the F4-T1 house shell into the `world` group (A-10, F4-T1 plan §5).
   ground: groundOuter (plane, 0.05 m below), groundPlot (ShapeGeometry of the plot with the footprint as a hole),
   groundCap (plane over the footprint, 0.01 m up; hidden for the basement view). Per level a group "level-<id>"
   (userData.index) with "slab" (slab box whose top face is the hall tint + one tint quad per room at 0.015 m) and
   "walls" (exterior walls with the entrance gap on the ground front wall, merged partitions along room edges, stair
   and lift as plain 1.2 m boxes, basement pit walls up to ground level). Empty "roof" and "site" groups (F4-T2).
   L -> T: X = u - cu, Z = -(v - cv) (PC.frames.l2t). Colours: Q10 exteriors, room tints mixed with the Q18 wood
   (one sRGB lerp), stair / lift unmixed (H4, F3-T3 outcome section 7). */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};
  var EPS = 0.011;

  // Union of [a, b] intervals (touching within EPS joins), sorted.
  function union(list) {
    list.sort(function (p, q) { return p[0] - q[0]; });
    var out = [];
    list.forEach(function (s) {
      var last = out[out.length - 1];
      if (last && s[0] <= last[1] + EPS) last[1] = Math.max(last[1], s[1]); else out.push([s[0], s[1]]);
    });
    return out;
  }
  // Intervals minus one interval.
  function minus(list, a, b) {
    var out = [];
    list.forEach(function (s) {
      if (b <= s[0] + EPS || a >= s[1] - EPS) { out.push(s); return; }
      if (a > s[0] + EPS) out.push([s[0], a]);
      if (b < s[1] - EPS) out.push([b, s[1]]);
    });
    return out;
  }

  // Partition segments of one level in L: { u: [[uLine, v0, v1], ...], v: [[vLine, u0, u1], ...] } (exported for tests).
  three.partitions = function (house, level) {
    var fp = house.footprint, t = PC.C.HOUSE.wallT, lines = { u: {}, v: {} };
    function put(axis, at, a, b, lo, hi) {
      if (Math.abs(at - lo) < EPS || Math.abs(at - hi) < EPS) return;        // on the footprint outline: exterior wall
      var k = Math.round(at * 100);
      (lines[axis][k] = lines[axis][k] || { at: at, s: [] }).s.push([a, b]);
    }
    level.rooms.forEach(function (r) {
      put('u', r.u, r.v, r.v + r.d, fp.u, fp.u + fp.w); put('u', r.u + r.w, r.v, r.v + r.d, fp.u, fp.u + fp.w);
      put('v', r.v, r.u, r.u + r.w, fp.v, fp.v + fp.d); put('v', r.v + r.d, r.u, r.u + r.w, fp.v, fp.v + fp.d);
    });
    var core = [level.stair, level.lift].filter(Boolean), out = { u: [], v: [] };
    ['u', 'v'].forEach(function (axis) {
      Object.keys(lines[axis]).sort(function (a, b) { return a - b; }).forEach(function (k) {
        var L = lines[axis][k], s = union(L.s);
        // never along the stair / lift block (its box is there; coplanar tops of two colours would fight)
        core.forEach(function (c) {
          var edges = axis === 'u' ? [c.u, c.u + c.w] : [c.v, c.v + c.d];
          if (edges.some(function (e) { return Math.abs(e - L.at) < EPS; })) s = axis === 'u' ? minus(s, c.v, c.v + c.d) : minus(s, c.u, c.u + c.w);
        });
        var lo = axis === 'u' ? fp.v + t : fp.u + t, hi = axis === 'u' ? fp.v + fp.d - t : fp.u + fp.w - t;
        s.forEach(function (i) { var a = Math.max(lo, i[0]), b = Math.min(hi, i[1]); if (b - a > 0.05) out[axis].push([L.at, a, b]); });
      });
    });
    return out;
  };

  three.buildShell = function (house, world, mats) {
    var H = PC.C.HOUSE, fp = house.footprint, cu = house.center[0], cv = house.center[1];
    var E = PC.data.exteriors[house.exterior], I = PC.data.interiors[house.interior.style], RT = PC.data.roomTints, SC = PC.data.siteColors;
    var mix = three.mixHex, R = house.radius, made = [];
    var X = function (u) { return u - cu; }, Z = function (v) { return -(v - cv); };
    function mesh(geo, mat, name, parent) { var m = new THREE.Mesh(geo, mat); m.name = name; parent.add(m); made.push(m); return m; }
    function group(name, parent) { var g = new THREE.Group(); g.name = name; parent.add(g); return g; }
    // a box from L rectangle [u0, u1] x [v0, v1] and heights [y0, y1]
    function box(b, u0, u1, v0, v1, y0, y1, hex, topHex) { b.add((X(u0) + X(u1)) / 2, (y0 + y1) / 2, (Z(v0) + Z(v1)) / 2, u1 - u0, y1 - y0, v1 - v0, hex, topHex); }

    // ground
    var ground = group('ground', world), flat = -Math.PI / 2;
    var outer = mesh(new THREE.PlaneGeometry(H.outerK * R, H.outerK * R), mats.groundOuter, 'groundOuter', ground);
    outer.rotation.x = flat; outer.position.y = -H.outerDrop;
    var shape = new THREE.Shape();
    house.plot.pts.forEach(function (p, i) { if (i) shape.lineTo(p[0] - cu, p[1] - cv); else shape.moveTo(p[0] - cu, p[1] - cv); });
    shape.closePath();
    var hole = new THREE.Path();
    hole.moveTo(fp.u - cu, fp.v - cv); hole.lineTo(fp.u + fp.w - cu, fp.v - cv); hole.lineTo(fp.u + fp.w - cu, fp.v + fp.d - cv); hole.lineTo(fp.u - cu, fp.v + fp.d - cv);
    hole.closePath();
    shape.holes.push(hole);
    var plot = mesh(new THREE.ShapeGeometry(shape), mats.ground, 'groundPlot', ground);
    plot.rotation.x = flat;
    var cap = mesh(new THREE.PlaneGeometry(fp.w, fp.d), mats.ground, 'groundCap', ground);
    cap.rotation.x = flat; cap.position.set(X(fp.u + fp.w / 2), H.capLift, Z(fp.v + fp.d / 2));
    [outer, plot, cap].forEach(function (m) { m.receiveShadow = true; m.castShadow = false; });

    // levels
    var hall = mix(RT.hall, I.wood, I.floorMix), t = H.wallT;
    house.levels.forEach(function (lv) {
      var g = group('level-' + lv.id, world); g.userData.index = lv.index; g.userData.id = lv.id;
      var floorY = lv.baseY + H.slab, top = floorY + H.wallH, slab = new three.BoxBatch(), walls = new three.BoxBatch();
      box(slab, fp.u, fp.u + fp.w, fp.v, fp.v + fp.d, lv.baseY, floorY, E.slab, hall);
      lv.rooms.forEach(function (r) {
        slab.addQuad(X(r.u + r.w / 2), floorY + H.tintLift, Z(r.v + r.d / 2), r.w, r.d, mix(RT[r.type], I.wood, I.floorMix));
      });
      var u0 = fp.u, u1 = fp.u + fp.w, v0 = fp.v, v1 = fp.v + fp.d;
      if (lv.index < 0) {                         // basement: pit walls from the basement floor to ground level
        box(walls, u0, u1, v0, v0 + t, floorY, 0, E.slab); box(walls, u0, u1, v1 - t, v1, floorY, 0, E.slab);
        box(walls, u0, u0 + t, v0 + t, v1 - t, floorY, 0, E.slab); box(walls, u1 - t, u1, v0 + t, v1 - t, floorY, 0, E.slab);
      } else {
        if (lv.index === 0) {                     // entrance gap in the front wall, centred on the door
          var e = house.site.entrance, a = Math.max(u0, e.u - e.w / 2), b = Math.min(u1, e.u + e.w / 2);
          if (a - u0 > 0.05) box(walls, u0, a, v0, v0 + t, floorY, top, E.wall);
          if (u1 - b > 0.05) box(walls, b, u1, v0, v0 + t, floorY, top, E.wall);
        } else box(walls, u0, u1, v0, v0 + t, floorY, top, E.wall);
        box(walls, u0, u1, v1 - t, v1, floorY, top, E.wall);
        box(walls, u0, u0 + t, v0 + t, v1 - t, floorY, top, E.wall); box(walls, u1 - t, u1, v0 + t, v1 - t, floorY, top, E.wall);
      }
      var parts = three.partitions(house, lv);
      parts.u.forEach(function (s) { box(walls, s[0] - t / 2, s[0] + t / 2, s[1], s[2], floorY, top, E.wallInner); });
      parts.v.forEach(function (s) { box(walls, s[1], s[2], s[0] - t / 2, s[0] + t / 2, floorY, top, E.wallInner); });
      if (lv.stair) box(walls, lv.stair.u, lv.stair.u + lv.stair.w, lv.stair.v, lv.stair.v + lv.stair.d, floorY, top, RT.stair);
      if (lv.lift) box(walls, lv.lift.u, lv.lift.u + lv.lift.w, lv.lift.v, lv.lift.v + lv.lift.d, floorY, top, RT.lift);
      [slab.build(mats.batch, 'slab'), walls.build(mats.batch, 'walls')].forEach(function (m) { if (m) { g.add(m); made.push(m); } });
    });
    group('roof', world);
    group('site', world);
    return made;
  };
})(globalThis.PC = globalThis.PC || {});
