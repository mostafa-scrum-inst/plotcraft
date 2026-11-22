/* PC.three.buildSite(house, world, mats): the "site" group (A-10, F4-T2 plan 7; TL plan review required item 3;
   Designer plan 2-4). Vegetation stays for F4-T3. Items the model leaves out (site.omitted) are null there and absent.
   - "siteBatch" (one mesh): parking pads 0.02 m per car (paving); covered: a 0.1 m canopy with its top at 2.4 m on 4
     posts 0.1 m (carCanopy); pool rim 0.3 m wide, 0.1 m high, outside the water (poolRim); boundary wall 1.2 x 0.2 m
     along every plot edge, centred 0.1 m inside it (BoxBatch.addSeg), with the 3 m gate gap on the street edge and
     two 0.4 x 0.4 x 1.4 m posts beside it (trim; no leaf; no gate without the wall); seating: a 3 x 3 x 0.05 m pad
     (paving), a 0.9 x 0.9 x 0.75 m table and two 1.6 x 0.45 x 0.45 m benches 0.9 m either side (seating), parallel
     to the nearest facade; entrance step 1.2 x 0.6 x 0.15 m in front of the door (trim); north needle: two flat
     triangles 0.04 m high (BoxBatch.addFlat), the N half in northMarker, the S half in poolRim, length L.
   - "poolWater": a flush opaque PlaneGeometry over exactly the pool rectangle at Y 0.03 (rotated -PI/2 about X).
   - Vegetation (F4-T3; A-11; Designer F4-T3 plan 1): InstancedMesh "trunks", "canopies", "shrubs" from the model's
     trees / shrubs, geometry from PC.data.vegetation (trunk cylinder, canopy cone with its base at canopyY0, shrub
     cone), one instance matrix per item = translate (u, base x s, v) x uniform scale s. frustumCulled false (the
     instances spread beyond the geometry's own bounds); cast, never receive. A kind with no items gets no mesh.
     Materials mats.trunk / mats.canopy / mats.shrub are recoloured by applyLook (look.js).
   F6-T1a (plan sections 3.3, 4.4, 5.4; TL plan review):
   - "paving" (one mesh, mats.paving with the paving map, world UVs, receives only): the parking pads and the seating pad
     (siteColors.paving), the pool rim (poolRim), moved here from siteBatch, plus the street footpath.
   - "northNeedle": the needle's N half (northMarker) on mats.ui (unlit, toneMapped false: the UI colour exactly, as
     the highlight); the S half stays in siteBatch.
   - Street along the street edge (the plot edge from (0, 0) along +u at v = 0), outside the plot and across the
     groundOuter square: a 1.5 m footpath quad at Y 0.02 (paving), a 0.15 x 0.12 m kerb (siteBatch, paving colour) and
     an 8 m asphalt quad at Y -0.03 (siteBatch, siteColors.asphalt), above groundOuter at -0.05. None when the plot has
     no such edge or reaches below v = 0. */
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

  // The street strip in T (plan 4.4): x0..x1 across the groundOuter square, z0 = the street edge, then the footpath,
  // the kerb and the road towards +Z, each clamped to the square. Null without a street edge.
  three.street = function (house) {
    var pts = house.plot.pts, n = pts.length, cu = house.center[0], cv = house.center[1], hs = PC.C.HOUSE.outerK * house.radius / 2, e = -1;
    for (var i = 0; i < n; i++) {
      var a = pts[i], c = pts[(i + 1) % n];
      if (Math.abs(a[0]) < 1e-9 && Math.abs(a[1]) < 1e-9 && Math.abs(c[1]) < 1e-9 && c[0] > 0) e = i;
    }
    if (e < 0 || pts.some(function (p) { return p[1] < -1e-6; })) return null;
    var z0 = cv, k = function (z) { return Math.min(z, hs); }, W = PC.C.STREET;
    if (z0 >= hs) return null;
    return { x0: -hs, x1: hs, z0: z0, zPath: k(z0 + W.path), zKerb: k(z0 + W.path + W.kerb), zRoad: k(z0 + W.path + W.kerb + W.road) };
  };

  // F6-T1b: a deterministic number in [0, 1) per item and salt (FNV of the item position: survives rebuilds, C-3.3)
  three.vegRand = function (it, salt) { return parseInt(PC.house.hash(it[0].toFixed(3) + ',' + it[1].toFixed(3) + ',' + salt), 16) / 4294967296; };

  // F4-T3 instanced vegetation; F6-T1b (plan 6.3, Designer E1 / E2 / C5): tapered trunks leaning +-leanDeg about a
  // seeded horizontal axis (about the base), canopies of 3 flat-shaded lumps (detail = the tier's treeDetail), shrubs
  // of 2 squashed lumps, a per-instance colour (value factor and a warm / cool tilt; seasons still set
  // material.color), and "blobs": one InstancedMesh of flat quads (the blob texture, one opacity), shrubs first so
  // that applyLook can show only the shrubs' blobs in winter (blobs.count).
  three.buildVegetation = function (house, g, mats, opt) {
    var V = PC.data.vegetation, T = V.tree, S = V.shrub, cu = house.center[0], cv = house.center[1], out = [], rnd = three.vegRand;
    var detail = opt && opt.tier ? opt.tier.treeDetail : 1;
    function inst(name, geo, mat, items, place, tint) {
      if (!items.length) return null;
      var mesh = new THREE.InstancedMesh(geo(), mat, items.length), m = new THREE.Matrix4();
      items.forEach(function (it, i) {
        var p = place(it), s = it[2];
        m.compose(new THREE.Vector3(it[0] - cu + p.dx, p.y, -(it[1] - cv) + p.dz), p.q, new THREE.Vector3(s, s, s));
        mesh.setMatrixAt(i, m);
        if (tint) {
          var v = tint.value[0] + (tint.value[1] - tint.value[0]) * rnd(it, name + 'v'), t = (rnd(it, name + 't') * 2 - 1) * tint.tilt;
          var c = three.col('#FFFFFF'); c.r = v * (1 + t); c.g = v; c.b = v * (1 - t);   // a linear factor on material.color
          mesh.setColorAt(i, c);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.name = name; mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = false;
      g.add(mesh); out.push(mesh);
      return mesh;
    }
    var trees = house.site.trees, shrubs = house.site.shrubs, still = new THREE.Quaternion();
    // the trunk geometry is centred on its own origin; leaning about the base moves that centre by R(0, h/2, 0)
    inst('trunks', function () { return new THREE.CylinderGeometry(T.trunkR * T.taper, T.trunkR, T.trunkH, T.trunkSeg); }, mats.trunk, trees, function (it) {
      var a = rnd(it, 'axis') * 2 * Math.PI, th = (rnd(it, 'lean') * 2 - 1) * T.leanDeg * Math.PI / 180, ax = Math.cos(a), az = Math.sin(a), y = T.trunkH / 2 * it[2];
      var q = new THREE.Quaternion(); q.setFromAxisAngle(new THREE.Vector3(ax, 0, az), th);
      return { q: q, dx: -az * y * Math.sin(th), dz: ax * y * Math.sin(th), y: y * Math.cos(th) };
    });
    inst('canopies', function () { return three.lumps(T.lumps, detail, 1); }, mats.canopy, trees, function () { return { q: still, dx: 0, dz: 0, y: 0 }; }, V.tint.tree);
    inst('shrubs', function () { return three.lumps(S.lumps, 0, S.squashY); }, mats.shrub, shrubs, function () { return { q: still, dx: 0, dz: 0, y: 0 }; }, V.tint.shrub);
    // blobs: shrubs first, then trees; a unit plane turned face-up, scaled to the blob diameter
    var B = V.blob, all = shrubs.map(function (it) { return [it, B.shrubK * S.r]; }).concat(trees.map(function (it) { return [it, B.treeK * T.canopyR]; }));
    if (all.length && mats.blob) {
      var bm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mats.blob, all.length), mm = new THREE.Matrix4(), up = new THREE.Quaternion();
      up.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      all.forEach(function (e, i) {
        var d = 2 * e[1] * e[0][2];
        mm.compose(new THREE.Vector3(e[0][0] - cu, PC.C.VIEW3D.blobY, -(e[0][1] - cv)), up, new THREE.Vector3(d, d, 1));
        bm.setMatrixAt(i, mm);
      });
      bm.instanceMatrix.needsUpdate = true;
      bm.name = 'blobs'; bm.frustumCulled = false; bm.castShadow = false; bm.receiveShadow = false; bm.renderOrder = 1;
      bm.userData.shrubs = shrubs.length; bm.userData.all = all.length;
      g.add(bm); out.push(bm);
    }
    return out;
  };

  three.buildSite = function (house, world, mats, opt) {
    var C = PC.C.SITE, SC = PC.data.siteColors, E = PC.data.exteriors[house.exterior], S = house.site;
    var cu = house.center[0], cv = house.center[1], b = new three.BoxBatch(), pv = new three.BoxBatch({ uv: true }), g = world.getObjectByName('site'), made = [];
    var X = function (u) { return u - cu; }, Z = function (v) { return -(v - cv); };
    function box(u0, u1, v0, v1, y0, y1, hex, to) { (to || b).add((X(u0) + X(u1)) / 2, (y0 + y1) / 2, (Z(v0) + Z(v1)) / 2, u1 - u0, y1 - y0, v1 - v0, hex); }

    var p = S.parking;
    if (p) {
      var P = PC.C.PARKING;
      for (var i = 0; i < p.cars; i++) box(p.u + i * P.w, p.u + (i + 1) * P.w, p.v, p.v + p.d, 0, 0.02, SC.paving, pv);
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
      box(q.u - rw, q.u + q.w + rw, q.v - rw, q.v, 0, rh, SC.poolRim, pv); box(q.u - rw, q.u + q.w + rw, q.v + q.d, q.v + q.d + rw, 0, rh, SC.poolRim, pv);
      box(q.u - rw, q.u, q.v, q.v + q.d, 0, rh, SC.poolRim, pv); box(q.u + q.w, q.u + q.w + rw, q.v, q.v + q.d, 0, rh, SC.poolRim, pv);
    }
    var segs = [];
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
          segs.push([X(p0[0]), Z(p0[1]), X(p1[0]), Z(p1[1])]);
        });
      }
    }
    var st = S.seating;
    if (st) {
      var mu = st.u + st.w / 2, mv = st.v + st.d / 2, pad = 0.05;
      box(st.u, st.u + st.w, st.v, st.v + st.d, 0, pad, SC.paving, pv);
      box(mu - 0.45, mu + 0.45, mv - 0.45, mv + 0.45, pad, pad + 0.75, SC.seating);
      [-0.9, 0.9].forEach(function (o) {
        if (st.along === 'u') box(mu - 0.8, mu + 0.8, mv + o - 0.225, mv + o + 0.225, pad, pad + 0.45, SC.seating);
        else box(mu + o - 0.225, mu + o + 0.225, mv - 0.8, mv + 0.8, pad, pad + 0.45, SC.seating);
      });
    }
    var en = S.entrance;
    box(en.u - 0.6, en.u + 0.6, en.v - 0.6, en.v, 0, 0.15, E.trim);
    var nd = three.needle(house), nb = new three.BoxBatch();
    if (nd) {
      nb.addFlat([nd.tipN, nd.east, nd.west], 0, 0.04, SC.northMarker);
      b.addFlat([nd.tipS, nd.west, nd.east], 0, 0.04, SC.poolRim);
    }
    var sr = three.street(house);
    if (sr) {
      pv.addQuad((sr.x0 + sr.x1) / 2, 0.02, (sr.z0 + sr.zPath) / 2, sr.x1 - sr.x0, sr.zPath - sr.z0, SC.paving);
      b.add((sr.x0 + sr.x1) / 2, 0.035, (sr.zPath + sr.zKerb) / 2, sr.x1 - sr.x0, 0.17, sr.zKerb - sr.zPath, SC.paving);
      b.addQuad((sr.x0 + sr.x1) / 2, -0.03, (sr.zKerb + sr.zRoad) / 2, sr.x1 - sr.x0, sr.zRoad - sr.zKerb, SC.asphalt);
    }
    // F6-T1b C4: boundary-wall skirts on both faces, appended after every other siteBatch item
    var K = PC.C.CONTACT, sh = Math.min(K.skirtH, C.wallH);
    segs.forEach(function (sg) {
      var dx = sg[2] - sg[0], dz = sg[3] - sg[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, o = C.wallT / 2 + K.skirtOut;
      [1, -1].forEach(function (sd) {
        var ox = nx * o * sd, oz = nz * o * sd;
        b.addWallQuad([sg[0] + ox, sg[1] + oz], [sg[2] + ox, sg[3] + oz], 0, sh, [nx * sd, nz * sd],
          b.shade(SC.boundaryWall, K.skirtK + (1 - K.skirtK) * sh / K.skirtH), b.shade(SC.boundaryWall, K.skirtK), 'skirt');
      });
    });
    three.buildVegetation(house, g, mats, opt).forEach(function (x) { made.push(x); });
    var m = b.build(mats.batch, 'siteBatch');
    if (m) { g.add(m); made.push(m); }
    var pm = pv.build(mats.paving, 'paving');
    if (pm) { pm.castShadow = false; g.add(pm); made.push(pm); }
    var nm = nb.build(mats.ui, 'northNeedle');
    if (nm) { nm.castShadow = false; nm.receiveShadow = false; g.add(nm); made.push(nm); }
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
