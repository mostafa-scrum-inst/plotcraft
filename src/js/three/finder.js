/* PC.three.highlight / PC.three.finder: the F5-T1 room finder (F5-S1; A-14 as built, F5-T1 plan + plan review).
   highlight(house, roomId, material) -> Mesh 'highlight': a thin outline frame on the room rectangle, 4 BoxBatch bars
   (FINDER.bar m wide, FINDER.h high, bottom at floorY + FINDER.lift, so above the room tint at 0.015 m), inset
   FINDER.inset from the room edges, so they sit inside the partitions (0.15 m, centred on the edge) and the exterior
   walls; colour PC.data.siteColors.highlight (#C2410C). A UI mark: casts and receives no shadow. scene.js owns it
   (select / clear, one geometry per pick, the old one disposed; counted in the mesh budget).
   finder.goTo(roomId): Roof off, level = the room's level (a basement room opens the ground), the highlight on the
   room, then a CAM.flightMs flight to PC.cam.forRoom from the current (interpolated) pose. Never touches the look.
   THREE only inside functions. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};
  var F = { bar: 0.08, h: 0.04, lift: 0.02, inset: 0.15 };

  three.highlight = function (house, id, material) {
    var f = PC.cam.roomOf(house, id), r = f.room, b = new three.BoxBatch(), hex = PC.data.siteColors.highlight;
    var cu = house.center[0], cv = house.center[1], y = f.level.baseY + PC.C.HOUSE.slab + F.lift + F.h / 2;
    var u0 = r.u + F.inset, u1 = r.u + r.w - F.inset, v0 = r.v + F.inset, v1 = r.v + r.d - F.inset;
    var w = u1 - u0, d = v1 - v0, X = function (u) { return u - cu; }, Z = function (v) { return -(v - cv); };
    b.add(X(u0 + w / 2), y, Z(v0 + F.bar / 2), w, F.h, F.bar, hex);                       // street-side bar
    b.add(X(u0 + w / 2), y, Z(v1 - F.bar / 2), w, F.h, F.bar, hex);                       // back bar
    b.add(X(u0 + F.bar / 2), y, Z(v0 + d / 2), F.bar, F.h, d - 2 * F.bar, hex);           // side bars between them
    b.add(X(u1 - F.bar / 2), y, Z(v0 + d / 2), F.bar, F.h, d - 2 * F.bar, hex);
    var m = b.build(material, 'highlight');
    m.castShadow = false; m.receiveShadow = false;
    m.userData.room = id;
    return m;
  };
  three.highlight.SIZES = F;

  three.finder = {
    goTo: function (id) {
      var V = PC.view3d, h = V.house(), f = h && PC.cam.roomOf(h, id);
      if (!f) return false;
      V.setRoof(false);
      V.setLevel(f.level.id);
      V.select(id);
      V.flyTo(PC.cam.forRoom(h, id, V.pose(), V.limits()), PC.C.CAM.flightMs);
      return true;
    },
    clear: function () { if (PC.view3d.selected() !== null) PC.view3d.select(null); }
  };
})(globalThis.PC = globalThis.PC || {});
