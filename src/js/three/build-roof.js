/* PC.three.buildRoof(house, world, mats): the one roof batch "roofBatch" in the "roof" group (A-10, F4-T2 plan 5;
   TL plan review Q10, required item 2; Designer plan 4). Shown only with the Roof switch on and "All" (scene.js).
   - Exterior wall bands of every above-ground level, from floorY + 1.2 up to baseY + pitch (exteriors.wall), so
     Roof on is a closed exterior and the roof does not float over the 1.2 m dollhouse walls.
   - Flat: 0.2 m slab (roof) + parapet ring 0.3 m x 0.15 m (parapet); 1.0 m when the roof is usable.
   - Terrace: slab + 1.0 m parapet + a pergola over the back third: 4 posts 0.15 m, 2.4 m high, 0.1 m beams every
     0.6 m along the region's longer side (roof).
   - Pitched: a 30 degree gable over the footprint (BoxBatch.addPrism), ridge along the longer side, no overhang,
     slopes in roof, gable triangles in wall. Never usable (the model switches a usable pitched roof to flat).
   - Usable: stair head 2.4 m and lift overrun 1.2 m blocks (parapet) over roof.stairHead / roof.liftHead.
   F6-T1a (plan 5.4): a pitched roof's two slopes go into "roofTiles" (mats.tiles, the tile map on world UVs, rows
   along the eaves); its gables and base stay in roofBatch.
   F6-T1b (plan 6.1, Designer A2 + Q-D1 / Q-D3): house.openings as proud decals, appended after the boxes above (new
   item kinds 'glass', 'reveal'; frames, sills and the door leaf are boxes): per glazed / small / slot opening the
   glass quad 0.01 m out with the glassTop -> glassBottom gradient, a 0.06 m reveal band at 0.02 m in frame x 0.65,
   4 frame bars (0.06 m profile, 0.05 m proud, exteriors.frame), a mullion at mid-width from 1.2 m, and a sill
   0.04 m thick, 0.08 m proud under the bottom bar (exteriors.trim); the door: a 0.04 m leaf in exteriors.door at the
   outer plane with top and side bars in frame. Shown with the rest of roofBatch (exterior mode).
   F6-T1c (plan 1-3, Designer R1-R3, TL plan review): flat / terrace roofs
   - R1: the slab box dripOut proud on every side in exteriors.slab; a coping ring (4 boxes, copingT, copingOver past
     both parapet faces, exteriors.coping) on every parapet ring, and a cap copingOver wider on each head;
   - R3: 'deckBand' face-up strips bandLift over the deck: deckW inside the parapet (x deckK at it -> x 1), headW
     around each head (x headK -> x 1), clipped to the deck;
   - R2: "roofDeck", one face-up quad inside the parapet deckLift over the slab top (world UVs in metres,
     mats.deck: membrane, or the paving map on terrace / usable roofs), receives, does not cast.
   The decals stay the last roofBatch items.
   F6-T2 N2 (plan 3, TL ruling 2): the 'glass' quads move to their own mesh "glazing" in the roof group (mats.glazing:
   Lambert, vertex colours, emissive from build time), receiving shadows without casting; userData.panes lists each
   pane (level, kind, side, centre in T, size, wall axis and sign) for the glow pools. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};

  function openings(house, b, gl, panes) {
    var O = PC.C.OPEN.decal, fp = house.footprint, E = PC.data.exteriors[house.exterior], SC = PC.data.siteColors;
    var cu = house.center[0], cv = house.center[1], byId = {};
    house.levels.forEach(function (lv) { byId[lv.id] = lv; });
    // side -> [normal axis (0 X / 2 Z), outward sign, the wall plane in T]
    var P = { front: [2, 1, -(fp.v - cv)], back: [2, -1, -(fp.v + fp.d - cv)], left: [0, -1, fp.u - cu], right: [0, 1, fp.u + fp.w - cu] };
    var reveal = b.shade(E.frame, O.revealK);
    (house.openings || []).forEach(function (o) {
      var p = P[o.side], ax = p[0], sg = p[1], y0 = byId[o.level].baseY + PC.C.HOUSE.slab, ys = y0 + o.sill, yh = y0 + o.head;
      var mid = (o.a + o.b) / 2, along = ax === 2 ? mid - cu : -(mid - cv), w = o.b - o.a, h = yh - ys;
      // a point at distance d out of the wall plane at the along-wall coordinate t, height y
      function at(t, d) { return ax === 2 ? [t, p[2] + sg * d] : [p[2] + sg * d, t]; }
      function bar(t, y, bw, bh, depth, hex) {   // a box bw along the wall, bh tall, from the plane to depth out
        var c = at(t, depth / 2); b.add(c[0], y, c[1], ax === 2 ? bw : depth, bh, ax === 2 ? depth : bw, hex);
      }
      function quad(t, y, qw, qh, d, top, bot, kind, into) { var c = at(t, d); (into || b).addQuadV(c[0], y, c[1], ax, sg, qw, qh, top, bot, kind); }
      var f = O.frame, hw = w / 2;
      if (o.kind === 'door') {
        bar(along, ys + h / 2, w, h, O.leaf, E.door);
        bar(along, yh + f / 2, w + 2 * f, f, O.proud, E.frame);
        bar(along - hw - f / 2, ys + h / 2, f, h, O.proud, E.frame); bar(along + hw + f / 2, ys + h / 2, f, h, O.proud, E.frame);
        return;
      }
      quad(along, ys + h / 2, w, h, O.glass, SC.glassTop, SC.glassBottom, 'glass', gl);   // F6-T2 N2: in "glazing"
      var pc = at(along, O.glass);
      panes.push({ level: o.level, kind: o.kind, side: o.side, i: panes.length, x: pc[0], y: ys + h / 2, z: pc[1], w: w, h: h, ax: ax, sg: sg });
      var r = O.reveal;   // the reveal band just inside the opening: top, bottom, then the two sides
      quad(along, yh - r / 2, w, r, O.revealD, reveal, reveal, 'reveal'); quad(along, ys + r / 2, w, r, O.revealD, reveal, reveal, 'reveal');
      quad(along - hw + r / 2, ys + h / 2, r, h - 2 * r, O.revealD, reveal, reveal, 'reveal'); quad(along + hw - r / 2, ys + h / 2, r, h - 2 * r, O.revealD, reveal, reveal, 'reveal');
      bar(along, yh + f / 2, w + 2 * f, f, O.proud, E.frame); bar(along, ys - f / 2, w + 2 * f, f, O.proud, E.frame);
      bar(along - hw - f / 2, ys + h / 2, f, h, O.proud, E.frame); bar(along + hw + f / 2, ys + h / 2, f, h, O.proud, E.frame);
      if (w >= O.mullionMin - 1e-9) bar(along, ys + h / 2, f, h, O.proud, E.frame);
      bar(along, ys - f - O.sillT / 2, w + 2 * f + 2 * O.sillOver, O.sillT, O.sillOut, E.trim);
    });
  }

  three.buildRoof = function (house, world, mats) {
    var H = PC.C.HOUSE, R = PC.C.ROOF, fp = house.footprint, roof = house.roof, E = PC.data.exteriors[house.exterior];
    var cu = house.center[0], cv = house.center[1], b = new three.BoxBatch(), t = H.wallT;
    var X = function (u) { return u - cu; }, Z = function (v) { return -(v - cv); };
    function box(u0, u1, v0, v1, y0, y1, hex) { b.add((X(u0) + X(u1)) / 2, (y0 + y1) / 2, (Z(v0) + Z(v1)) / 2, u1 - u0, y1 - y0, v1 - v0, hex); }
    var u0 = fp.u, u1 = fp.u + fp.w, v0 = fp.v, v1 = fp.v + fp.d;
    // a ring of four walls of thickness k just inside the footprint outline, from y0 to y1
    function ring(k, y0, y1, hex) {
      box(u0, u1, v0, v0 + k, y0, y1, hex); box(u0, u1, v1 - k, v1, y0, y1, hex);
      box(u0, u0 + k, v0 + k, v1 - k, y0, y1, hex); box(u1 - k, u1, v0 + k, v1 - k, y0, y1, hex);
    }
    house.levels.forEach(function (lv) {
      if (lv.index >= 0) ring(t, lv.baseY + H.slab + H.wallH, lv.baseY + house.pitch, E.wall);
    });
    var y = roof.baseY, tm = null, deck = null;
    if (roof.type === 'pitched') {
      var alongX = fp.w >= fp.d, rise = Math.tan(R.pitchDeg * Math.PI / 180) * Math.min(fp.w, fp.d) / 2;
      b.addPrism(X(u0 + fp.w / 2), Z(v0 + fp.d / 2), fp.w, fp.d, y, rise, alongX, E.roof, E.wall, 'rest');
      var tl = new three.BoxBatch({ uv: true });
      tl.addPrism(X(u0 + fp.w / 2), Z(v0 + fp.d / 2), fp.w, fp.d, y, rise, alongX, E.roof, E.wall, 'slopes');
      tm = tl.build(mats.tiles, 'roofTiles');
    } else {
      var top = y + R.slab, high = roof.usable || roof.type === 'terrace', p = R.parapetT, dr = R.dripOut, co = R.copingOver;
      var pTop = top + (high ? R.parapetHigh : R.parapet);
      box(u0 - dr, u1 + dr, v0 - dr, v1 + dr, y, top, E.slab);   // R1 drip edge
      ring(p, top, pTop, E.parapet);
      // R1 coping: the parapet ring's footprint widened by copingOver on both faces
      box(u0 - co, u1 + co, v0 - co, v0 + p + co, pTop, pTop + R.copingT, E.coping);
      box(u0 - co, u1 + co, v1 - p - co, v1 + co, pTop, pTop + R.copingT, E.coping);
      box(u0 - co, u0 + p + co, v0 + p + co, v1 - p - co, pTop, pTop + R.copingT, E.coping);
      box(u1 - p - co, u1 + co, v0 + p + co, v1 - p - co, pTop, pTop + R.copingT, E.coping);
      if (roof.type === 'terrace') {
        // pergola over the back third, inside the parapet
        var a0 = u0 + p, a1 = u1 - p, b0 = v0 + fp.d * 2 / 3, b1 = v1 - p, k = R.post, ph = top + R.pergolaH;
        [[a0, b0], [a1 - k, b0], [a0, b1 - k], [a1 - k, b1 - k]].forEach(function (c) { box(c[0], c[0] + k, c[1], c[1] + k, top, ph, E.roof); });
        var longU = a1 - a0 >= b1 - b0, w = R.beam, from = (longU ? b0 : a0) + w / 2, to = (longU ? b1 : a1) - w / 2, s;
        for (s = from; s <= to + 1e-9; s += R.beamStep) {
          if (longU) box(a0, a1, s - w / 2, s + w / 2, ph - w, ph, E.roof);
          else box(s - w / 2, s + w / 2, b0, b1, ph - w, ph, E.roof);
        }
      }
      var heads = [[roof.stairHead, R.stairHead], [roof.liftHead, R.liftHead]].filter(function (h) { return h[0]; });
      heads.forEach(function (h) {
        var r = h[0];
        box(r.u, r.u + r.w, r.v, r.v + r.d, top, top + h[1], E.parapet);
        box(r.u - co, r.u + r.w + co, r.v - co, r.v + r.d + co, top + h[1], top + h[1] + R.copingT, E.coping);
      });
      // R3 bands on the deck rectangle D (inside the parapet), corners [u, v] with their factor
      var C = PC.C.CONTACT, D = [u0 + p, u1 - p, v0 + p, v1 - p], yb = top + R.deckLift + C.bandLift;
      var clamp = function (q) { return [Math.min(D[1], Math.max(D[0], q[0])), Math.min(D[3], Math.max(D[2], q[1]))]; };
      function band(q, ks) {   // q: 4 [u, v] corners, ks: 4 factors
        q = q.map(clamp);
        var ar = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]);
        var ar2 = (q[2][0] - q[0][0]) * (q[3][1] - q[0][1]) - (q[3][0] - q[0][0]) * (q[2][1] - q[0][1]);
        if (Math.abs(ar) + Math.abs(ar2) < 1e-6) return;
        b.addUpQuad(q.map(function (c) { return [X(c[0]), Z(c[1])]; }), yb, ks.map(function (k) { return b.shade(E.roof, k); }), 'deckBand');
      }
      // mitred bands of width w from the edge of rectangle [a0, a1] x [c0, c1]: inward (sg -1, the parapet) or
      // outward (sg +1, around a head); x k at the edge, x 1 at the far side
      function bands(a0, a1, c0, c1, w, sg, k) {
        var A0 = a0 - sg * w, A1 = a1 + sg * w, C0 = c0 - sg * w, C1 = c1 + sg * w, kk = [k, k, 1, 1];
        band([[a0, c0], [a1, c0], [A1, C0], [A0, C0]], kk);
        band([[a1, c0], [a1, c1], [A1, C1], [A1, C0]], kk);
        band([[a1, c1], [a0, c1], [A0, C1], [A1, C1]], kk);
        band([[a0, c1], [a0, c0], [A0, C0], [A0, C1]], kk);
      }
      bands(D[0], D[1], D[2], D[3], C.deckW, -1, C.deckK);
      heads.forEach(function (h) { var r = h[0]; bands(r.u, r.u + r.w, r.v, r.v + r.d, C.headW, 1, C.headK); });
      // R2 the deck quad
      var dk = new three.BoxBatch({ uv: true }), w1 = [1, 1, 1];
      dk.addUpQuad([[X(D[0]), Z(D[2])], [X(D[1]), Z(D[2])], [X(D[1]), Z(D[3])], [X(D[0]), Z(D[3])]], top + R.deckLift, [w1, w1, w1, w1], 'deck');
      if (mats.deck) { deck = dk.build(mats.deck, 'roofDeck'); deck.castShadow = false; deck.receiveShadow = true; }
    }
    var gl = new three.BoxBatch(), panes = [];
    openings(house, b, gl, panes);
    var g = world.getObjectByName('roof'), m = b.build(mats.batch, 'roofBatch'), out = [];
    if (m) { g.add(m); out.push(m); }
    var gm = gl.build(mats.glazing || mats.batch, 'glazing');   // F6-T2 N2 (TL ruling 2): receives, does not cast
    if (gm) { gm.castShadow = false; gm.receiveShadow = true; gm.userData.panes = panes; g.add(gm); out.push(gm); }
    if (tm) { g.add(tm); out.push(tm); }
    if (deck) { g.add(deck); out.push(deck); }
    return out;
  };
})(globalThis.PC = globalThis.PC || {});
