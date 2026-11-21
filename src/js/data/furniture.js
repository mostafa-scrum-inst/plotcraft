/* Furniture block sets (Designer-owned, F3-T3), A-11 schema, read by PC.furnish.room (F4-T2). Metres; y0 = height
   above the floor; w = size along the anchor wall, d = depth into the room; color = a key of PC.data.interiors[style];
   sparse: true = also shown at Q19 "Sparse" (always written). off: [a, b] (optional) = shift after anchoring, in room
   axes (a to the right, b to the back) or, for center pieces, along the piece's (w, d) axes; scaled with the piece.
   A piece with off follows the piece it is placed around. Placement rule: A-11 (0.15 m inset, scale 1.00 -> 0.60 in
   0.05 steps, overlap > 0.01 m on both axes drops). Every piece is at most 1.1 m high (cut walls are 1.2 m) and at
   least 0.05 m, so it reads as a block from above. Each type: 1 or more sparse, 2 or more full-only, 8 at most. */
(function (PC) {
  'use strict';
  PC.data.furniture = {
    bedroom: [
      { id: 'bed', w: 1.6, d: 2.0, h: 0.5, y0: 0, anchor: 'back', color: 'fabric', sparse: true },
      { id: 'wardrobe', w: 1.2, d: 0.6, h: 1.1, y0: 0, anchor: 'left', color: 'wood', sparse: true },
      { id: 'sideL', w: 0.45, d: 0.45, h: 0.5, y0: 0, anchor: 'bl', color: 'wood', sparse: false },
      { id: 'sideR', w: 0.45, d: 0.45, h: 0.5, y0: 0, anchor: 'br', color: 'wood', sparse: false },
      { id: 'dresser', w: 1.0, d: 0.45, h: 0.8, y0: 0, anchor: 'right', color: 'wood', sparse: false },
      { id: 'armchair', w: 0.7, d: 0.7, h: 0.8, y0: 0, anchor: 'fr', color: 'accent', sparse: false }
    ],
    bathroom: [
      { id: 'toilet', w: 0.4, d: 0.65, h: 0.45, y0: 0, anchor: 'bl', color: 'white', sparse: true },
      { id: 'shower', w: 0.85, d: 0.85, h: 0.1, y0: 0, anchor: 'br', color: 'metal', sparse: true },
      { id: 'basin', w: 0.55, d: 0.45, h: 0.85, y0: 0, anchor: 'fl', color: 'white', sparse: true },
      { id: 'cabinet', w: 0.45, d: 0.3, h: 0.9, y0: 0, anchor: 'fr', color: 'wood', sparse: false },
      { id: 'mat', w: 0.5, d: 0.35, h: 0.05, y0: 0, anchor: 'center', color: 'accent', sparse: false },
      { id: 'basket', w: 0.4, d: 0.35, h: 0.45, y0: 0, anchor: 'front', color: 'fabric', sparse: false }
    ],
    kitchen: [
      { id: 'counter', w: 1.9, d: 0.6, h: 0.9, y0: 0, anchor: 'bl', color: 'white', sparse: true },
      { id: 'fridge', w: 0.7, d: 0.7, h: 1.1, y0: 0, anchor: 'fr', color: 'metal', sparse: true },
      { id: 'island', w: 1.2, d: 0.7, h: 0.9, y0: 0, anchor: 'center', color: 'wood', sparse: false },
      { id: 'pantry', w: 0.6, d: 0.6, h: 1.1, y0: 0, anchor: 'left', color: 'wood', sparse: false },
      { id: 'sideCounter', w: 1.2, d: 0.6, h: 0.9, y0: 0, anchor: 'right', color: 'white', sparse: false },
      { id: 'stoolL', w: 0.4, d: 0.4, h: 0.65, y0: 0, anchor: 'center', color: 'dark', sparse: false, off: [-0.3, -0.6] },
      { id: 'stoolR', w: 0.4, d: 0.4, h: 0.65, y0: 0, anchor: 'center', color: 'dark', sparse: false, off: [0.3, -0.6] }
    ],
    living: [
      { id: 'sofa', w: 2.2, d: 0.9, h: 0.75, y0: 0, anchor: 'back', color: 'fabric', sparse: true },
      { id: 'coffeeTable', w: 1.1, d: 0.6, h: 0.4, y0: 0, anchor: 'center', color: 'wood', sparse: true },
      { id: 'tvUnit', w: 1.8, d: 0.45, h: 0.5, y0: 0, anchor: 'front', color: 'dark', sparse: false },
      { id: 'armchairL', w: 0.8, d: 0.8, h: 0.8, y0: 0, anchor: 'left', color: 'accent', sparse: false },
      { id: 'armchairR', w: 0.8, d: 0.8, h: 0.8, y0: 0, anchor: 'right', color: 'accent', sparse: false },
      { id: 'sideTable', w: 0.45, d: 0.45, h: 0.5, y0: 0, anchor: 'bl', color: 'wood', sparse: false }
    ],
    dining: [
      { id: 'table', w: 1.6, d: 0.9, h: 0.75, y0: 0, anchor: 'center', color: 'wood', sparse: true },
      { id: 'chairB', w: 0.45, d: 0.45, h: 0.9, y0: 0, anchor: 'center', color: 'fabric', sparse: true, off: [0, 0.75] },
      { id: 'chairF', w: 0.45, d: 0.45, h: 0.9, y0: 0, anchor: 'center', color: 'fabric', sparse: true, off: [0, -0.75] },
      { id: 'chairL', w: 0.45, d: 0.45, h: 0.9, y0: 0, anchor: 'center', color: 'fabric', sparse: false, off: [-1.075, 0] },
      { id: 'chairR', w: 0.45, d: 0.45, h: 0.9, y0: 0, anchor: 'center', color: 'fabric', sparse: false, off: [1.075, 0] },
      { id: 'sideboard', w: 1.4, d: 0.45, h: 0.8, y0: 0, anchor: 'back', color: 'wood', sparse: false }
    ],
    majlis: [
      { id: 'seatBack', w: 2.6, d: 0.8, h: 0.35, y0: 0, anchor: 'back', color: 'fabric', sparse: true },
      { id: 'lowTable', w: 1.0, d: 0.6, h: 0.3, y0: 0, anchor: 'center', color: 'wood', sparse: true },
      { id: 'seatLeft', w: 2.0, d: 0.8, h: 0.35, y0: 0, anchor: 'left', color: 'fabric', sparse: false },
      { id: 'seatRight', w: 2.0, d: 0.8, h: 0.35, y0: 0, anchor: 'right', color: 'fabric', sparse: false },
      { id: 'sideFL', w: 0.4, d: 0.4, h: 0.4, y0: 0, anchor: 'fl', color: 'accent', sparse: false },
      { id: 'sideFR', w: 0.4, d: 0.4, h: 0.4, y0: 0, anchor: 'fr', color: 'accent', sparse: false }
    ],
    office: [
      { id: 'desk', w: 1.4, d: 0.7, h: 0.75, y0: 0, anchor: 'back', color: 'wood', sparse: true },
      { id: 'chair', w: 0.55, d: 0.55, h: 0.9, y0: 0, anchor: 'back', color: 'dark', sparse: true, off: [0, -0.75] },
      { id: 'shelf', w: 1.2, d: 0.4, h: 1.1, y0: 0, anchor: 'left', color: 'wood', sparse: false },
      { id: 'cabinet', w: 0.45, d: 0.6, h: 0.7, y0: 0, anchor: 'br', color: 'metal', sparse: false },
      { id: 'armchair', w: 0.7, d: 0.7, h: 0.8, y0: 0, anchor: 'fr', color: 'accent', sparse: false }
    ],
    maid: [
      { id: 'bed', w: 0.9, d: 2.0, h: 0.5, y0: 0, anchor: 'bl', color: 'fabric', sparse: true },
      { id: 'cupboard', w: 0.8, d: 0.55, h: 1.1, y0: 0, anchor: 'fr', color: 'wood', sparse: true },
      { id: 'desk', w: 0.9, d: 0.45, h: 0.75, y0: 0, anchor: 'right', color: 'wood', sparse: false },
      { id: 'chair', w: 0.45, d: 0.45, h: 0.9, y0: 0, anchor: 'right', color: 'dark', sparse: false, off: [-0.5, 0] },
      { id: 'rug', w: 1.0, d: 0.6, h: 0.05, y0: 0, anchor: 'center', color: 'accent', sparse: false }
    ],
    storage: [
      { id: 'shelvesBack', w: 1.6, d: 0.45, h: 1.1, y0: 0, anchor: 'back', color: 'metal', sparse: true },
      { id: 'shelvesLeft', w: 1.2, d: 0.45, h: 1.1, y0: 0, anchor: 'left', color: 'metal', sparse: false },
      { id: 'shelvesRight', w: 1.2, d: 0.45, h: 1.1, y0: 0, anchor: 'right', color: 'metal', sparse: false },
      { id: 'crate', w: 0.5, d: 0.5, h: 0.4, y0: 0, anchor: 'fl', color: 'wood', sparse: false }
    ],
    laundry: [
      { id: 'washer', w: 0.6, d: 0.6, h: 0.85, y0: 0, anchor: 'bl', color: 'white', sparse: true },
      { id: 'dryer', w: 0.6, d: 0.6, h: 0.85, y0: 0, anchor: 'bl', color: 'white', sparse: true, off: [0.65, 0] },
      { id: 'basket', w: 0.45, d: 0.35, h: 0.4, y0: 0, anchor: 'fr', color: 'accent', sparse: false },
      { id: 'rack', w: 1.0, d: 0.4, h: 1.0, y0: 0, anchor: 'front', color: 'metal', sparse: false }
    ]
  };
})(globalThis.PC = globalThis.PC || {});
