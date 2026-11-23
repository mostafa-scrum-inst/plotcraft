/* PC.three.buildInterior(house, world, mats, opt): each level's interior, into its "level-<id>" group (A-10; F4-T2
   plan 6; F6-T2 plan 2 and 3, CTO 2.3: at most 3 furniture materials per level). opt = { cells } (three.atlasCells
   at the tier's texture size). A level without rooms or pieces gets none of its meshes.
   - "furniture" (mats.furniture): plain parts, and pieces without parts as one box from floorY + y0 to + h.
   - "textured-<id>" (mats.interior, the interior atlas; F6-T2 I2): the hall floor over the footprint (planks), the
     room floors tintLift + floorStep above it, the rugs rug.lift above their floor, and the parts with mat 'planks' /
     'weave' (each face mapped onto its cell once). Floors and rugs are split into the cell's tile grid (world-aligned
     in L every tileM, plus the ring lines ringW in from each room edge) so every quad's UVs stay inside one cell tile
     (CTO atlas condition: no repeat, half-texel inset). The T1b floor ring stays a vertex colour: x ringK at the
     wall rising to x 1 at ringW in. Floor colour = mix(floors[style][kind], roomTints[type], floors.tint).
   - "lamps-<id>" (mats.lamp; F6-T2 N5): the lamp shades (mat 'lamp'); never casts or receives shadows.
   Furniture and textured cast and receive. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};
  var FLOOR_STEP = 0.01;   // room floors over the hall floor (the T1c deck lesson: 0.002 z-fought, 0.01 does not)

  // Floor tiles of the rectangle [u0, u1] x [v0, v1] in L at height y: split on the tileM grid and on `lines`.
  function tiles(b, X, Z, u0, u1, v0, v1, y, tileM, rect, colourAt, extraU, extraV, kind) {
    function cuts(a0, a1, extra) {
      var c = [a0, a1].concat(extra.filter(function (x) { return x > a0 + 1e-6 && x < a1 - 1e-6; }));
      for (var k = Math.ceil(a0 / tileM + 1e-9); k * tileM < a1 - 1e-6; k++) c.push(k * tileM);
      return c.sort(function (p, q) { return p - q; }).filter(function (x, i, a) { return i === 0 || x - a[i - 1] > 1e-6; });
    }
    var cu = cuts(u0, u1, extraU), cv = cuts(v0, v1, extraV), du = rect.u1 - rect.u0, dv = rect.v1 - rect.v0;
    for (var i = 0; i < cu.length - 1; i++) for (var j = 0; j < cv.length - 1; j++) {
      var a = cu[i], b2 = cu[i + 1], c = cv[j], d = cv[j + 1], tu = Math.floor((a + b2) / 2 / tileM) * tileM, tv = Math.floor((c + d) / 2 / tileM) * tileM;
      var fu = function (u) { return rect.u0 + (u - tu) / tileM * du; }, fv = function (v) { return rect.v0 + (v - tv) / tileM * dv; };
      var P = [[a, c], [b2, c], [b2, d], [a, d]];
      b.addCellUp(P.map(function (p) { return [X(p[0]), Z(p[1])]; }), y, P.map(function (p) { return colourAt(p[0], p[1]); }),
        P.map(function (p) { return [fu(p[0]), fv(p[1])]; }), kind);
    }
  }

  three.buildInterior = function (house, world, mats, opt) {
    var H = PC.C.HOUSE, C = PC.C.CONTACT, cu = house.center[0], cv = house.center[1], made = [], fp = house.footprint;
    var FL = PC.data.floors, RT = PC.data.roomTints, mix = three.mixHex, style = house.interior.style, FS = FL[style];
    var I = PC.data.interiors[style], T = PC.data.textures.interior, cells = (opt && opt.cells) || three.atlasCells(512);
    var X = function (u) { return u - cu; }, Z = function (v) { return -(v - cv); };
    function floorHex(type) { return mix(FS[FL.kind[type]], RT[type], FL.tint); }
    function put(b, mat, name, g, shadows) {
      var m = b.build(mat, name);
      if (!m) return;
      if (!shadows) { m.castShadow = false; m.receiveShadow = false; }
      g.add(m); made.push(m);
    }
    house.levels.forEach(function (lv) {
      if (!lv.rooms.length) return;
      var g = world.getObjectByName('level-' + lv.id), floorY = lv.baseY + H.slab, y0 = floorY + H.tintLift;
      var plain = new three.BoxBatch(), tex = new three.BoxBatch({ uv: true }), lamps = new three.BoxBatch();
      // hall floor: the whole footprint, FL.kind.hall (PM Q4: a neutral non-plank kind), flat colour
      var hall = tex.color(floorHex('hall')), hk = FL.kind.hall;
      tiles(tex, X, Z, fp.u, fp.u + fp.w, fp.v, fp.v + fp.d, y0, T[hk].tileM, cells[hk], function () { return hall; }, [], [], 'hallFloor');
      // room floors with the ring darkening as vertex colours
      lv.rooms.forEach(function (r) {
        var kind = FL.kind[r.type], hex = floorHex(r.type), k = Math.min(C.ringW, Math.min(r.w, r.d) / 2 - 0.01), u1 = r.u + r.w, v1 = r.v + r.d;
        var at = function (u, v) {
          var dd = Math.min(u - r.u, u1 - u, v - r.v, v1 - v), f = k > 0 ? C.ringK + (1 - C.ringK) * Math.min(1, dd / k) : 1;
          return tex.shade(hex, f);
        };
        var lu = k > 0 ? [r.u + k, u1 - k] : [], lvv = k > 0 ? [r.v + k, v1 - k] : [];
        tiles(tex, X, Z, r.u, u1, r.v, v1, y0 + FLOOR_STEP, T[kind].tileM, cells[kind], at, lu, lvv, 'floor');
      });
      // rugs (decoration, not A-11 pieces), clipped to the room's inner rectangle
      lv.rooms.forEach(function (r) {
        var R = FL.rug, rs = Object.assign({}, I, (I.rooms || {})[r.type]), hex = mix(rs.accent, rs.fabric, R.accentMix), c = tex.color(hex);
        var ins = PC.C.FURNISH.inset, rects = [];
        r.furniture.forEach(function (q) {
          var qu = q.u + q.w / 2, qv = q.v + q.d / 2;
          if (r.type === 'living' && q.kind === 'coffeeTable') {
            var w = Math.min(R.living[2], R.living[0] * r.w), d = Math.min(R.living[3], R.living[1] * r.d);
            rects.push([qu - w / 2, qu + w / 2, qv - d / 2, qv + d / 2]);
          } else if (r.type === 'dining' && q.kind === 'table') {
            rects.push([q.u - R.diningPad, q.u + q.w + R.diningPad, q.v - R.diningPad, q.v + q.d + R.diningPad]);
          } else if (r.type === 'bedroom' && q.kind === 'bed' && q.parts) {
            var hb = q.parts[q.parts.length - 1], bx = hb.u + hb.w / 2 - qu, by = hb.v + hb.d / 2 - qv, alongV = Math.abs(by) >= Math.abs(bx);
            var len = alongV ? q.d : q.w, s = alongV ? Math.sign(by) : Math.sign(bx), fu = alongV ? qu : qu - s * len / 2, fv = alongV ? qv - s * len / 2 : qv;
            var a = R.bed[0] / 2, e = R.bed[1] / 2;
            rects.push(alongV ? [fu - a, fu + a, fv - e, fv + e] : [fu - e, fu + e, fv - a, fv + a]);
          }
        });
        rects.forEach(function (q) {
          var a0 = Math.max(q[0], r.u + ins), a1 = Math.min(q[1], r.u + r.w - ins), b0 = Math.max(q[2], r.v + ins), b1 = Math.min(q[3], r.v + r.d - ins);
          if (a1 - a0 > 0.05 && b1 - b0 > 0.05) tiles(tex, X, Z, a0, a1, b0, b1, y0 + FLOOR_STEP + R.lift, T.carpet.tileM, cells.carpet, function () { return c; }, [], [], 'rug');
        });
      });
      // furniture: parts by mat, pieces without parts as one box
      lv.rooms.forEach(function (r) {
        r.furniture.forEach(function (p) {
          if (!p.parts) { plain.add(X(p.u + p.w / 2), floorY + p.y0 + p.h / 2, Z(p.v + p.d / 2), p.w, p.h, p.d, p.color); return; }
          p.parts.forEach(function (t) {
            var x = X(t.u + t.w / 2), y = floorY + t.y0 + t.h / 2, z = Z(t.v + t.d / 2);
            if (t.mat === 'lamp') lamps.add(x, y, z, t.w, t.h, t.d, t.color);
            else if (t.mat === 'plain') plain.add(x, y, z, t.w, t.h, t.d, t.color);
            else tex.addCellBox(x, y, z, t.w, t.h, t.d, t.color, cells[t.mat], 'part');
          });
        });
      });
      // F6-T2 N5 / TL F2: the gate lamps, shade cubes on the two gate posts, in the ground level's lamps batch
      var S = house.site, SC = PC.C.SITE, gs = PC.data.indoor.lamp.gate;
      if (lv.id === 'G' && S.wall && S.gate) [S.gate.u - S.gate.w / 2 - SC.post / 2, S.gate.u + S.gate.w / 2 + SC.post / 2].forEach(function (u) {
        lamps.add(X(u), SC.postH + gs / 2, Z(SC.post / 2), gs, gs, gs, PC.data.indoor.lamp.color);
      });
      put(plain, mats.furniture, 'furniture', g, true);
      put(tex, mats.interior, 'textured-' + lv.id, g, true);
      put(lamps, mats.lamp, 'lamps-' + lv.id, g, false);
    });
    return made;
  };

  // F6-T2 N4 (plan 3, TL ruling 3; CTO 1.2d): "glow-<id>" per level, full tier only. One InstancedMesh of unit planes
  // (mats.glow: the blob map, additive, no depth write, no shadows), instances in the order [floor pools][ground spill]
  // [window patches]: pools under each lamp (lampD) and in each habitable room without one (roomD x its short side),
  // flat poolY over the floor; spill (Ground only) on the ground outside each lit Ground pane; patches patchOut out of
  // each lit pane, pane + patchPad. Lit = PC.house.hash(key + pane) under litShare[kind]. Per-instance colour =
  // pool.hex x its K (linear); applyLook scales mats.glow.color by indoor and shows the meshes only when indoor > 0.
  // userData.ranges = { pools, spill, all }: dollhouse count = pools + spill, exterior = all (scene.applyVisibility).
  var HABITABLE = { living: 1, dining: 1, bedroom: 1, majlis: 1, office: 1, kitchen: 1, maid: 1 };
  three.litPane = function (house, p) {
    var share = PC.data.indoor.litShare[p.kind];
    return share >= 1 || parseInt(PC.house.hash(house.key + ':' + p.level + ':' + p.side + ':' + p.i), 16) / 4294967296 < (share || 0);
  };
  three.buildGlow = function (house, world, mats, opt) {
    if (!mats.glow || (opt && opt.tier && !opt.tier.fog)) return [];
    var H = PC.C.HOUSE, P = PC.data.indoor.pool, cu = house.center[0], cv = house.center[1], made = [];
    var X = function (u) { return u - cu; }, Z = function (v) { return -(v - cv); };
    var gm = world.getObjectByName('glazing'), panes = gm ? gm.userData.panes : [];
    // one unit plane for every level, the blobs' own when they exist: its buffers are on the GPU from the first frame,
    // so the first night frame uploads only the instance buffers and creates no renderer geometry (CTO 4; QA F4-T3 A)
    var bl = world.getObjectByName('blobs'), geo = null;
    var plane = function () { return geo || (geo = bl ? bl.geometry : new THREE.PlaneGeometry(1, 1)); };
    var up = new THREE.Quaternion(); up.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    var face = { x: new THREE.Quaternion(), z: new THREE.Quaternion() };
    house.levels.forEach(function (lv) {
      var floorY = lv.baseY + H.slab + H.tintLift + 0.03, pools = [], spill = [], patch = [];
      lv.rooms.forEach(function (r) {
        var lit = false;
        r.furniture.forEach(function (q) { (q.parts || []).forEach(function (t) {
          if (t.mat === 'lamp') { lit = true; pools.push([X(t.u + t.w / 2), floorY, Z(t.v + t.d / 2), P.lampD, P.lampD, P.lampK, up]); }
        }); });
        if (!lit && HABITABLE[r.type]) { var d = P.roomD * Math.min(r.w, r.d); pools.push([X(r.u + r.w / 2), floorY, Z(r.v + r.d / 2), d, d, P.roomK, up]); }
      });
      if (lv.id === 'G' && house.site.wall && house.site.gate) {   // the gate lamps' ground pools (spill group)
        var g = house.site.gate, SC = PC.C.SITE;
        [g.u - g.w / 2 - SC.post / 2, g.u + g.w / 2 + SC.post / 2].forEach(function (u) { spill.push([X(u), 0.03, Z(-0.6), P.lampD * 0.6, P.lampD * 0.6, P.spillK, up]); });
      }
      panes.filter(function (p) { return p.level === lv.id && three.litPane(house, p); }).forEach(function (p) {
        var nx = p.ax === 0 ? p.sg : 0, nz = p.ax === 2 ? p.sg : 0, q = new THREE.Quaternion();
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ax === 0 ? p.sg * Math.PI / 2 : (p.sg > 0 ? 0 : Math.PI));
        if (lv.index === 0) spill.push([p.x + nx * (P.spillD / 2 + 0.05), 0.03, p.z + nz * (P.spillD / 2 + 0.05), p.ax === 2 ? P.spillW : P.spillD, p.ax === 2 ? P.spillD : P.spillW, P.spillK, up]);
        patch.push([p.x + nx * P.patchOut, p.y, p.z + nz * P.patchOut, p.w + P.patchPad, p.h + P.patchPad, P.patchK, q]);
      });
      var all = pools.concat(spill, patch);
      if (!all.length) return;
      var m = new THREE.InstancedMesh(plane(), mats.glow, all.length), mm = new THREE.Matrix4(), base = three.col(P.hex);
      all.forEach(function (e, i) {
        var sx = e[3], sz = e[4];
        if (e[6] === up) { mm.compose(new THREE.Vector3(e[0], e[1], e[2]), up, new THREE.Vector3(sx, sz, 1)); }
        else mm.compose(new THREE.Vector3(e[0], e[1], e[2]), e[6], new THREE.Vector3(sx, sz, 1));
        m.setMatrixAt(i, mm);
        var c = base.clone(); c.r *= e[5]; c.g *= e[5]; c.b *= e[5]; m.setColorAt(i, c);
      });
      m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
      m.name = 'glow-' + lv.id; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; m.visible = false;
      m.userData.ranges = { pools: pools.length, spill: spill.length, all: all.length };
      world.getObjectByName('level-' + lv.id).add(m); made.push(m);
    });
    return made;
  };
})(globalThis.PC = globalThis.PC || {});
