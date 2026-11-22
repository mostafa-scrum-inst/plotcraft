/* PC.three.buildShell(house, world, mats): the F4-T1 house shell into the `world` group (A-10, F4-T1 plan §5).
   ground: groundOuter (square of outerK x R, 0.05 m below, with the footprint as a hole: F5-T1 QA B-1), groundPlot (ShapeGeometry of the plot with the footprint as a hole),
   groundCap (plane over the footprint, 0.01 m up; hidden for the basement view). Per level a group "level-<id>"
   (userData.index) with "slab" (slab box whose top face is the hall tint + one tint quad per room at 0.015 m) and
   "walls" (exterior walls with the entrance gap on the ground front wall, merged partitions along room edges, stair
   and lift as plain 1.2 m boxes, basement pit walls up to ground level). Empty "roof" and "site" groups, filled by
   build-roof.js / build-site.js; build-interior.js adds each level's "furniture" batch (F4-T2).
   L -> T: X = u - cu, Z = -(v - cv) (PC.frames.l2t). Colours: Q10 exteriors, room tints mixed with the Q18 wood
   (one sRGB lerp), stair / lift unmixed (H4, F3-T3 outcome section 7).
   F6-T1a (plan sections 3-5 + review): opt = { tier } (PC.view3d's tier record).
   - "sky": the dome (PC.three.skyDome, radius skyK x farK x R) directly under world, unlit, toneMapped false, no fog,
     depthWrite false, renderOrder -1, frustumCulled false, no shadows; scene.js moves it to the eye before each
     render and look.js paints it.
   - groundPlot / groundOuter take the grass / meadow maps through their materials (ShapeGeometry UVs are shape
     metres). Lite tier only (TL ruling Q-T6): groundOuter is a hand-built ring with the same footprint hole whose
     outer 30 % (a skirt) carries vertex colours that look.js fades to the horizon; full keeps the ShapeGeometry.
   - slab batches receive shadows but no longer cast them (CTO C-4.2). */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};
  var EPS = 0.011;
  function V() { return PC.C.VIEW3D; }

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

  // Lite groundOuter (plan review Q-T6): the square of half-width hs minus the footprint rectangle in shape
  // coordinates, as 4 inner trapezoids out to 0.7 hs and a 4-trapezoid skirt from 0.7 hs to hs. Counter-clockwise in
  // shape space (normal +Z before the -PI/2 turn). Returns the mesh; userData.skirt = { colors, outer } for look.js.
  function skirtGround(hs, fx0, fx1, fy0, fy1, mat) {
    var a = 0.7 * hs, pos = [], col = [], uv = [], idx = [], outer = [];
    function quad(ps, outerFlags) {
      var b = pos.length / 3;
      ps.forEach(function (p, i) { pos.push(p[0], p[1], 0); uv.push(p[0], p[1]); col.push(1, 1, 1); if (outerFlags && outerFlags[i]) outer.push(b + i); });
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    quad([[-a, -a], [a, -a], [fx1, fy0], [fx0, fy0]]); quad([[a, -a], [a, a], [fx1, fy1], [fx1, fy0]]);
    quad([[a, a], [-a, a], [fx0, fy1], [fx1, fy1]]); quad([[-a, a], [-a, -a], [fx0, fy0], [fx0, fy1]]);
    var O = [1, 1, 0, 0];
    quad([[-hs, -hs], [hs, -hs], [a, -a], [-a, -a]], O); quad([[hs, -hs], [hs, hs], [a, a], [a, -a]], O);
    quad([[hs, hs], [-hs, hs], [-a, a], [a, a]], O); quad([[-hs, hs], [-hs, -hs], [-a, -a], [-a, a]], O);
    var g = new THREE.BufferGeometry(), colors = new THREE.Float32BufferAttribute(new Float32Array(col), 3), nor = [];
    for (var i = 0; i < pos.length / 3; i++) nor.push(0, 0, 1);
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(nor), 3));
    g.setAttribute('color', colors);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uv), 2));
    g.setIndex(idx);
    var m = new THREE.Mesh(g, mat);
    m.userData.skirt = { colors: colors, outer: outer };
    return m;
  }

  three.buildShell = function (house, world, mats, opt) {
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
    // the footprint as a Path in shape coordinates (x = u - cu, y = v - cv; the -PI/2 turn maps y to -Z)
    function footHole() {
      var p = new THREE.Path();
      p.moveTo(fp.u - cu, fp.v - cv); p.lineTo(fp.u + fp.w - cu, fp.v - cv); p.lineTo(fp.u + fp.w - cu, fp.v + fp.d - cv); p.lineTo(fp.u - cu, fp.v + fp.d - cv);
      p.closePath();
      return p;
    }
    // F5-T1 QA B-1: groundOuter has the footprint as a hole too (it was a full plane, so it covered the basement pit
    // once groundCap is hidden); a square of outerK x R around the plot centre, 0.05 m down
    var sq = new THREE.Shape(), hs = H.outerK * R / 2;
    sq.moveTo(-hs, -hs); sq.lineTo(hs, -hs); sq.lineTo(hs, hs); sq.lineTo(-hs, hs); sq.closePath();
    sq.holes.push(footHole());
    var lite = opt && opt.tier && !opt.tier.fog, outer;
    if (lite) {
      outer = skirtGround(hs, fp.u - cu, fp.u + fp.w - cu, fp.v - cv, fp.v + fp.d - cv, mats.groundOuter);
      outer.name = 'groundOuter'; ground.add(outer); made.push(outer);
    } else outer = mesh(new THREE.ShapeGeometry(sq), mats.groundOuter, 'groundOuter', ground);
    outer.rotation.x = flat; outer.position.y = -H.outerDrop;
    var shape = new THREE.Shape();
    house.plot.pts.forEach(function (p, i) { if (i) shape.lineTo(p[0] - cu, p[1] - cv); else shape.moveTo(p[0] - cu, p[1] - cv); });
    shape.closePath();
    shape.holes.push(footHole());
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
      var sm = g.getObjectByName('slab');
      if (sm) sm.castShadow = false;                       // CTO C-4.2: floors receive only
    });
    group('roof', world);
    group('site', world);
    var dome = three.skyDome(V().skyK * PC.C.CAM.farK * R), sky = new THREE.Mesh(dome.geometry, mats.sky);
    sky.name = 'sky'; sky.renderOrder = -1; sky.frustumCulled = false; sky.castShadow = false; sky.receiveShadow = false;
    sky.userData.dome = dome;
    world.add(sky); made.push(sky);
    return made;
  };
})(globalThis.PC = globalThis.PC || {});
