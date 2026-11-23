/* Furniture block sets (Designer-owned, F3-T3), A-11 schema, read by PC.furnish.room (F4-T2). Metres; y0 = height
   above the floor; w = size along the anchor wall, d = depth into the room; color = a key of PC.data.interiors[style];
   sparse: true = also shown at Q19 "Sparse" (always written). off: [a, b] (optional) = shift after anchoring, in room
   axes (a to the right, b to the back) or, for center pieces, along the piece's (w, d) axes; scaled with the piece.
   A piece with off follows the piece it is placed around. Placement rule: A-11 (0.15 m inset, scale 1.00 -> 0.60 in
   0.05 steps, overlap > 0.01 m on both axes drops). Every piece is at most 1.1 m high (cut walls are 1.2 m) and at
   least 0.05 m, so it reads as a block from above. Each type: 1 or more sparse, 2 or more full-only, 8 at most.
   F6-T2 I1 (Designer plan 3, TL review Q5): parts: a template of PC.data.furnitureParts (the piece is drawn as those
   boxes inside its envelope; no parts = one box). face (optional): which side of the piece is its back (z = 1), turned
   from the anchor's default: 'front', 'left' or 'right' (chairs that face a table or desk). Heights raised for parts
   (bed 1.0, tvUnit 1.1, majlis seats 0.7, side tables 0.95, desks 1.1 with the lamp), all <= 1.1 m.
   furnitureParts: [x0, x1, z0, z1, y0, y1, role, k, mat] in fractions of the piece (x across, z from the front at 0
   to the back at 1, y up), each 0..1 so every part stays inside the envelope. role: 'main' (the piece's colour key),
   another PC.data.interiors key, or a literal '#RRGGBB'; k scales the colour's value; mat: 'plain', 'planks' or
   'weave' (interior atlas cells) or 'lamp' (the lamp shade material). No two parts share a face plane facing the same
   way where they overlap (unit-tested: no z-fight). */
(function (PC) {
  'use strict';
  PC.data.furniture = {
    bedroom: [
      { id: 'bed', w: 1.6, d: 2.0, h: 1.0, y0: 0, anchor: 'back', color: 'fabric', sparse: true, parts: 'bed' },
      { id: 'wardrobe', w: 1.2, d: 0.6, h: 1.1, y0: 0, anchor: 'fl', color: 'wood', sparse: true, parts: 'cabinet' },
      { id: 'sideL', w: 0.45, d: 0.45, h: 0.95, y0: 0, anchor: 'bl', color: 'wood', sparse: false, parts: 'sideLamp' },
      { id: 'sideR', w: 0.45, d: 0.45, h: 0.95, y0: 0, anchor: 'br', color: 'wood', sparse: false, parts: 'sideLamp' },
      { id: 'dresser', w: 1.0, d: 0.45, h: 0.8, y0: 0, anchor: 'right', color: 'wood', sparse: false, parts: 'cabinet' },
      { id: 'armchair', w: 0.7, d: 0.7, h: 0.8, y0: 0, anchor: 'fr', color: 'accent', sparse: false, parts: 'chair1' }
    ],
    bathroom: [
      { id: 'toilet', w: 0.4, d: 0.65, h: 0.45, y0: 0, anchor: 'bl', color: 'white', sparse: true, parts: 'toilet' },
      { id: 'shower', w: 0.85, d: 0.85, h: 0.1, y0: 0, anchor: 'br', color: 'metal', sparse: true, parts: 'shower' },
      { id: 'basin', w: 0.55, d: 0.45, h: 0.85, y0: 0, anchor: 'fl', color: 'white', sparse: true, parts: 'basin' },
      { id: 'cabinet', w: 0.45, d: 0.3, h: 0.9, y0: 0, anchor: 'fr', color: 'wood', sparse: false, parts: 'cabinet' },
      { id: 'mat', w: 0.5, d: 0.35, h: 0.05, y0: 0, anchor: 'center', color: 'accent', sparse: false },
      { id: 'basket', w: 0.4, d: 0.35, h: 0.45, y0: 0, anchor: 'front', color: 'fabric', sparse: false }
    ],
    kitchen: [
      { id: 'counter', w: 1.9, d: 0.6, h: 0.9, y0: 0, anchor: 'bl', color: 'white', sparse: true, parts: 'counter' },
      { id: 'fridge', w: 0.7, d: 0.7, h: 1.1, y0: 0, anchor: 'fr', color: 'metal', sparse: true, parts: 'fridge' },
      { id: 'island', w: 1.2, d: 0.7, h: 0.9, y0: 0, anchor: 'center', color: 'wood', sparse: false, parts: 'counter' },
      { id: 'pantry', w: 0.6, d: 0.6, h: 1.1, y0: 0, anchor: 'left', color: 'wood', sparse: false, parts: 'cabinet' },
      { id: 'sideCounter', w: 1.2, d: 0.6, h: 0.9, y0: 0, anchor: 'right', color: 'white', sparse: false, parts: 'counter' },
      { id: 'stoolL', w: 0.4, d: 0.4, h: 0.65, y0: 0, anchor: 'center', color: 'dark', sparse: false, off: [-0.3, -0.6], parts: 'stool' },
      { id: 'stoolR', w: 0.4, d: 0.4, h: 0.65, y0: 0, anchor: 'center', color: 'dark', sparse: false, off: [0.3, -0.6], parts: 'stool' }
    ],
    living: [
      { id: 'sofa', w: 2.2, d: 0.9, h: 0.75, y0: 0, anchor: 'back', color: 'fabric', sparse: true, parts: 'sofa' },
      { id: 'coffeeTable', w: 1.1, d: 0.6, h: 0.4, y0: 0, anchor: 'center', color: 'wood', sparse: true, parts: 'table' },
      { id: 'tvUnit', w: 1.8, d: 0.45, h: 1.1, y0: 0, anchor: 'front', color: 'dark', sparse: false, parts: 'media' },
      { id: 'armchairL', w: 0.8, d: 0.8, h: 0.8, y0: 0, anchor: 'left', color: 'accent', sparse: false, parts: 'chair1' },
      { id: 'armchairR', w: 0.8, d: 0.8, h: 0.8, y0: 0, anchor: 'right', color: 'accent', sparse: false, parts: 'chair1' },
      { id: 'sideTable', w: 0.45, d: 0.45, h: 0.95, y0: 0, anchor: 'bl', color: 'wood', sparse: false, parts: 'sideLamp' }
    ],
    dining: [
      { id: 'table', w: 1.6, d: 0.9, h: 0.75, y0: 0, anchor: 'center', color: 'wood', sparse: true, parts: 'table' },
      { id: 'chairB', w: 0.45, d: 0.45, h: 0.9, y0: 0, anchor: 'center', color: 'fabric', sparse: true, off: [0, 0.75], parts: 'chair' },
      { id: 'chairF', w: 0.45, d: 0.45, h: 0.9, y0: 0, anchor: 'center', color: 'fabric', sparse: true, off: [0, -0.75], parts: 'chair', face: 'front' },
      { id: 'chairL', w: 0.45, d: 0.45, h: 0.9, y0: 0, anchor: 'center', color: 'fabric', sparse: false, off: [-1.075, 0], parts: 'chair', face: 'left' },
      { id: 'chairR', w: 0.45, d: 0.45, h: 0.9, y0: 0, anchor: 'center', color: 'fabric', sparse: false, off: [1.075, 0], parts: 'chair', face: 'right' },
      { id: 'sideboard', w: 1.4, d: 0.45, h: 0.8, y0: 0, anchor: 'back', color: 'wood', sparse: false, parts: 'cabinet' }
    ],
    majlis: [
      { id: 'seatBack', w: 2.6, d: 0.8, h: 0.7, y0: 0, anchor: 'back', color: 'fabric', sparse: true, parts: 'floorSeat' },
      { id: 'lowTable', w: 1.0, d: 0.6, h: 0.3, y0: 0, anchor: 'center', color: 'wood', sparse: true, parts: 'table' },
      { id: 'seatLeft', w: 2.0, d: 0.8, h: 0.7, y0: 0, anchor: 'left', color: 'fabric', sparse: false, parts: 'floorSeat' },
      { id: 'seatRight', w: 2.0, d: 0.8, h: 0.7, y0: 0, anchor: 'right', color: 'fabric', sparse: false, parts: 'floorSeat' },
      { id: 'sideFL', w: 0.4, d: 0.4, h: 0.95, y0: 0, anchor: 'fl', color: 'accent', sparse: false, parts: 'sideLamp' },
      { id: 'sideFR', w: 0.4, d: 0.4, h: 0.95, y0: 0, anchor: 'fr', color: 'accent', sparse: false, parts: 'sideLamp' }
    ],
    office: [
      { id: 'desk', w: 1.4, d: 0.7, h: 1.1, y0: 0, anchor: 'back', color: 'wood', sparse: true, parts: 'deskLamp' },
      { id: 'chair', w: 0.55, d: 0.55, h: 0.9, y0: 0, anchor: 'back', color: 'dark', sparse: true, off: [0, -0.75], parts: 'chair', face: 'front' },
      { id: 'shelf', w: 1.2, d: 0.4, h: 1.1, y0: 0, anchor: 'left', color: 'wood', sparse: false, parts: 'shelves' },
      { id: 'cabinet', w: 0.45, d: 0.6, h: 0.7, y0: 0, anchor: 'br', color: 'metal', sparse: false, parts: 'cabinet' },
      { id: 'armchair', w: 0.7, d: 0.7, h: 0.8, y0: 0, anchor: 'fr', color: 'accent', sparse: false, parts: 'chair1' }
    ],
    maid: [
      { id: 'bed', w: 0.9, d: 2.0, h: 1.0, y0: 0, anchor: 'bl', color: 'fabric', sparse: true, parts: 'bed1' },
      { id: 'cupboard', w: 0.8, d: 0.55, h: 1.1, y0: 0, anchor: 'fr', color: 'wood', sparse: true, parts: 'cabinet' },
      { id: 'desk', w: 0.9, d: 0.45, h: 1.1, y0: 0, anchor: 'right', color: 'wood', sparse: false, parts: 'deskLamp' },
      { id: 'chair', w: 0.45, d: 0.45, h: 0.9, y0: 0, anchor: 'right', color: 'dark', sparse: false, off: [-0.5, 0], parts: 'chair', face: 'front' },
      { id: 'rug', w: 1.0, d: 0.6, h: 0.05, y0: 0, anchor: 'center', color: 'accent', sparse: false }
    ],
    storage: [
      { id: 'shelvesBack', w: 1.6, d: 0.45, h: 1.1, y0: 0, anchor: 'back', color: 'metal', sparse: true, parts: 'shelves' },
      { id: 'shelvesLeft', w: 1.2, d: 0.45, h: 1.1, y0: 0, anchor: 'left', color: 'metal', sparse: false, parts: 'shelves' },
      { id: 'shelvesRight', w: 1.2, d: 0.45, h: 1.1, y0: 0, anchor: 'right', color: 'metal', sparse: false, parts: 'shelves' },
      { id: 'crate', w: 0.5, d: 0.5, h: 0.4, y0: 0, anchor: 'fl', color: 'wood', sparse: false }
    ],
    laundry: [
      { id: 'washer', w: 0.6, d: 0.6, h: 0.85, y0: 0, anchor: 'bl', color: 'white', sparse: true, parts: 'appliance' },
      { id: 'dryer', w: 0.6, d: 0.6, h: 0.85, y0: 0, anchor: 'bl', color: 'white', sparse: true, off: [0.65, 0], parts: 'appliance' },
      { id: 'basket', w: 0.45, d: 0.35, h: 0.4, y0: 0, anchor: 'fr', color: 'accent', sparse: false },
      { id: 'rack', w: 1.0, d: 0.4, h: 1.0, y0: 0, anchor: 'front', color: 'metal', sparse: false, parts: 'shelves' }
    ]
  };
  PC.data.furnitureParts = {
    sofa: [[0.03, 0.97, 0.05, 0.95, 0, 0.1, 'dark', 1, 'plain'], [0.1, 0.9, 0, 0.8, 0.1, 0.55, 'main', 1, 'weave'], [0, 1, 0.8, 1, 0.1, 1, 'main', 0.9, 'weave'],
      [0, 0.1, 0, 0.8, 0.1, 0.8, 'main', 0.9, 'weave'], [0.9, 1, 0, 0.8, 0.1, 0.8, 'main', 0.9, 'weave'],
      [0.1, 0.5, 0.05, 0.75, 0.55, 0.68, 'main', 1.08, 'weave'], [0.5, 0.9, 0.05, 0.75, 0.55, 0.68, 'main', 1.08, 'weave']],
    chair1: [[0.03, 0.97, 0.05, 0.95, 0, 0.1, 'dark', 1, 'plain'], [0.15, 0.85, 0, 0.75, 0.1, 0.5, 'main', 1, 'weave'], [0, 1, 0.75, 1, 0.1, 1, 'main', 0.9, 'weave'],
      [0, 0.15, 0, 0.75, 0.1, 0.75, 'main', 0.9, 'weave'], [0.85, 1, 0, 0.75, 0.1, 0.75, 'main', 0.9, 'weave'], [0.15, 0.85, 0.05, 0.7, 0.5, 0.64, 'main', 1.08, 'weave']],
    bed: [[0, 1, 0, 0.94, 0, 0.3, 'wood', 1, 'planks'], [0.03, 0.97, 0.03, 0.92, 0.3, 0.5, 'white', 1, 'weave'], [0.02, 0.98, 0, 0.62, 0.45, 0.56, 'main', 1, 'weave'],
      [0.08, 0.46, 0.72, 0.9, 0.5, 0.62, 'white', 1.04, 'weave'], [0.54, 0.92, 0.72, 0.9, 0.5, 0.62, 'white', 1.04, 'weave'], [0, 1, 0.94, 1, 0, 1, 'main', 0.85, 'weave']],
    bed1: [[0, 1, 0, 0.94, 0, 0.3, 'wood', 1, 'planks'], [0.03, 0.97, 0.03, 0.92, 0.3, 0.5, 'white', 1, 'weave'], [0.02, 0.98, 0, 0.62, 0.45, 0.56, 'main', 1, 'weave'],
      [0.2, 0.8, 0.72, 0.9, 0.5, 0.62, 'white', 1.04, 'weave'], [0, 1, 0.94, 1, 0, 1, 'main', 0.85, 'weave']],
    table: [[0, 1, 0, 1, 0.92, 1, 'main', 1, 'planks'], [0.04, 0.1, 0.04, 0.1, 0, 0.92, 'main', 0.85, 'plain'], [0.9, 0.96, 0.04, 0.1, 0, 0.92, 'main', 0.85, 'plain'],
      [0.04, 0.1, 0.9, 0.96, 0, 0.92, 'main', 0.85, 'plain'], [0.9, 0.96, 0.9, 0.96, 0, 0.92, 'main', 0.85, 'plain']],
    chair: [[0.06, 0.14, 0.06, 0.14, 0, 0.5, 'dark', 1, 'plain'], [0.86, 0.94, 0.06, 0.14, 0, 0.5, 'dark', 1, 'plain'], [0.06, 0.14, 0.8, 0.88, 0, 0.5, 'dark', 1, 'plain'],
      [0.86, 0.94, 0.8, 0.88, 0, 0.5, 'dark', 1, 'plain'], [0.04, 0.96, 0.04, 0.9, 0.5, 0.58, 'main', 1, 'weave'], [0.04, 0.96, 0.86, 0.96, 0.58, 1, 'main', 1, 'plain']],
    stool: [[0.08, 0.16, 0.08, 0.16, 0, 0.88, 'dark', 1, 'plain'], [0.84, 0.92, 0.08, 0.16, 0, 0.88, 'dark', 1, 'plain'], [0.08, 0.16, 0.84, 0.92, 0, 0.88, 'dark', 1, 'plain'],
      [0.84, 0.92, 0.84, 0.92, 0, 0.88, 'dark', 1, 'plain'], [0.04, 0.96, 0.04, 0.96, 0.88, 1, 'main', 1.1, 'plain']],
    cabinet: [[0.03, 0.97, 0.1, 1, 0, 0.05, 'dark', 1, 'plain'], [0, 1, 0.05, 1, 0.05, 1, 'main', 1, 'planks'],
      [0.02, 0.49, 0.02, 0.05, 0.07, 0.97, 'main', 1.06, 'plain'], [0.51, 0.98, 0.02, 0.05, 0.07, 0.97, 'main', 1.06, 'plain'],
      [0.44, 0.47, 0, 0.02, 0.45, 0.6, 'metal', 1, 'plain'], [0.53, 0.56, 0, 0.02, 0.45, 0.6, 'metal', 1, 'plain']],
    shelves: [[0, 0.04, 0, 1, 0, 1, 'main', 1, 'planks'], [0.96, 1, 0, 1, 0, 1, 'main', 1, 'planks'], [0.04, 0.96, 0.94, 1, 0, 1, 'main', 0.9, 'plain'],
      [0.04, 0.96, 0, 0.94, 0, 0.04, 'main', 1, 'plain'], [0.04, 0.96, 0, 0.94, 0.33, 0.37, 'main', 1, 'plain'], [0.04, 0.96, 0, 0.94, 0.66, 0.7, 'main', 1, 'plain'],
      [0.04, 0.96, 0, 0.94, 0.96, 1, 'main', 1, 'plain']],
    counter: [[0, 1, 0.08, 1, 0, 0.08, 'dark', 1, 'plain'], [0, 1, 0.02, 1, 0.08, 0.92, 'main', 1, 'plain'], [0, 1, 0, 1, 0.92, 1, 'dark', 1.2, 'plain'],
      [0.02, 0.32, 0, 0.02, 0.12, 0.88, 'main', 0.94, 'plain'], [0.35, 0.65, 0, 0.02, 0.12, 0.88, 'main', 0.94, 'plain'], [0.68, 0.98, 0, 0.02, 0.12, 0.88, 'main', 0.94, 'plain']],
    appliance: [[0, 1, 0.02, 1, 0, 1, 'main', 1, 'plain'], [0.15, 0.85, 0, 0.02, 0.2, 0.8, 'dark', 1, 'plain']],
    fridge: [[0, 1, 0.02, 1, 0, 1, 'main', 1, 'plain'], [0, 1, 0, 0.02, 0.64, 0.66, 'dark', 1, 'plain'], [0.85, 0.9, 0, 0.02, 0.3, 0.6, 'dark', 1, 'plain'],
      [0.85, 0.9, 0, 0.02, 0.7, 0.95, 'dark', 1, 'plain']],
    media: [[0, 1, 0.2, 1, 0, 0.45, 'main', 1, 'plain'], [0.1, 0.9, 0.55, 0.62, 0.45, 1, '#0E1114', 1, 'plain']],
    floorSeat: [[0, 1, 0, 1, 0, 0.5, 'main', 1, 'weave'], [0, 1, 0.75, 1, 0.5, 1, 'main', 0.88, 'weave'],
      [0.12, 0.28, 0.6, 0.75, 0.5, 0.8, 'accent', 1, 'weave'], [0.42, 0.58, 0.6, 0.75, 0.5, 0.8, 'accent', 1, 'weave'], [0.72, 0.88, 0.6, 0.75, 0.5, 0.8, 'accent', 1, 'weave']],
    toilet: [[0.2, 0.8, 0, 0.7, 0, 0.6, 'main', 1, 'plain'], [0, 1, 0.75, 1, 0, 1, 'main', 1, 'plain'], [0.2, 0.8, 0, 0.7, 0.6, 0.66, 'main', 0.96, 'plain']],
    basin: [[0.3, 0.7, 0.4, 1, 0, 0.85, 'main', 1, 'plain'], [0, 1, 0, 1, 0.85, 1, 'main', 1, 'plain']],
    shower: [[0, 1, 0, 1, 0, 0.6, 'main', 1, 'plain'], [0.45, 0.55, 0.45, 0.55, 0.6, 1, 'dark', 1, 'plain']],
    sideLamp: [[0, 1, 0, 1, 0.49, 0.53, 'main', 1, 'planks'], [0.05, 0.15, 0.05, 0.15, 0, 0.49, 'main', 0.85, 'plain'], [0.85, 0.95, 0.05, 0.15, 0, 0.49, 'main', 0.85, 'plain'],
      [0.05, 0.15, 0.85, 0.95, 0, 0.49, 'main', 0.85, 'plain'], [0.85, 0.95, 0.85, 0.95, 0, 0.49, 'main', 0.85, 'plain'],
      [0.37, 0.63, 0.37, 0.63, 0.53, 0.58, 'metal', 1, 'plain'], [0.47, 0.53, 0.47, 0.53, 0.58, 0.79, 'metal', 1, 'plain'], [0.21, 0.79, 0.21, 0.79, 0.79, 1, '#F2EBDD', 1, 'lamp']],
    deskLamp: [[0, 1, 0, 1, 0.64, 0.68, 'main', 1, 'planks'], [0.03, 0.08, 0.04, 0.12, 0, 0.64, 'main', 0.85, 'plain'], [0.92, 0.97, 0.04, 0.12, 0, 0.64, 'main', 0.85, 'plain'],
      [0.03, 0.08, 0.88, 0.96, 0, 0.64, 'main', 0.85, 'plain'], [0.92, 0.97, 0.88, 0.96, 0, 0.64, 'main', 0.85, 'plain'],
      [0.03, 0.12, 0.72, 0.9, 0.68, 0.72, 'metal', 1, 'plain'], [0.065, 0.085, 0.8, 0.83, 0.72, 0.85, 'metal', 1, 'plain'], [0.01, 0.15, 0.66, 0.97, 0.85, 1, '#F2EBDD', 1, 'lamp']]
  };
})(globalThis.PC = globalThis.PC || {});
