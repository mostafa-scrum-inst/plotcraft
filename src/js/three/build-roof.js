/* PC.three.buildRoof(house, world, mats): the one roof batch "roofBatch" in the "roof" group (A-10, F4-T2 plan 5;
   TL plan review Q10, required item 2; Designer plan 4). Shown only with the Roof switch on and "All" (scene.js).
   - Exterior wall bands of every above-ground level, from floorY + 1.2 up to baseY + pitch (exteriors.wall), so
     Roof on is a closed exterior and the roof does not float over the 1.2 m dollhouse walls.
   - Flat: 0.2 m slab (roof) + parapet ring 0.3 m x 0.15 m (parapet); 1.0 m when the roof is usable.
   - Terrace: slab + 1.0 m parapet + a pergola over the back third: 4 posts 0.15 m, 2.4 m high, 0.1 m beams every
     0.6 m along the region's longer side (roof).
   - Pitched: a 30 degree gable over the footprint (BoxBatch.addPrism), ridge along the longer side, no overhang,
     slopes in roof, gable triangles in wall. Never usable (the model switches a usable pitched roof to flat).
   - Usable: stair head 2.4 m and lift overrun 1.2 m blocks (parapet) over roof.stairHead / roof.liftHead. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};

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
    var y = roof.baseY;
    if (roof.type === 'pitched') {
      var alongX = fp.w >= fp.d, rise = Math.tan(R.pitchDeg * Math.PI / 180) * Math.min(fp.w, fp.d) / 2;
      b.addPrism(X(u0 + fp.w / 2), Z(v0 + fp.d / 2), fp.w, fp.d, y, rise, alongX, E.roof, E.wall);
    } else {
      var top = y + R.slab, high = roof.usable || roof.type === 'terrace', p = R.parapetT;
      box(u0, u1, v0, v1, y, top, E.roof);
      ring(p, top, top + (high ? R.parapetHigh : R.parapet), E.parapet);
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
      [[roof.stairHead, R.stairHead], [roof.liftHead, R.liftHead]].forEach(function (h) {
        if (h[0]) box(h[0].u, h[0].u + h[0].w, h[0].v, h[0].v + h[0].d, top, top + h[1], E.parapet);
      });
    }
    var g = world.getObjectByName('roof'), m = b.build(mats.batch, 'roofBatch');
    if (!m) return [];
    g.add(m);
    return [m];
  };
})(globalThis.PC = globalThis.PC || {});
