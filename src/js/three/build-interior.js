/* PC.three.buildInterior(house, world, mats): one "furniture" batch per level group (A-10, F4-T2 plan 6), from the
   model's pieces (PC.furnish via PC.house.build): a box per piece from floorY + y0 to floorY + y0 + h, its colour the
   model's resolved Q18 hex (through PC.three.col in the batch). A level without pieces gets no mesh. Cast + receive. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};

  three.buildInterior = function (house, world, mats) {
    var H = PC.C.HOUSE, cu = house.center[0], cv = house.center[1], made = [];
    house.levels.forEach(function (lv) {
      var b = new three.BoxBatch(), floorY = lv.baseY + H.slab;
      lv.rooms.forEach(function (r) {
        r.furniture.forEach(function (p) {
          b.add(p.u + p.w / 2 - cu, floorY + p.y0 + p.h / 2, -(p.v + p.d / 2 - cv), p.w, p.h, p.d, p.color);
        });
      });
      var m = b.build(mats.batch, 'furniture');
      if (m) { world.getObjectByName('level-' + lv.id).add(m); made.push(m); }
    });
    return made;
  };
})(globalThis.PC = globalThis.PC || {});
