/* PC.C: every number of the PM stories file, section 4. Metres and square metres. The only place they live. */
(function (PC) {
  'use strict';
  PC.C = {
    FT: 0.3048,                                   // 1 ft in metres
    ROOM_TYPES: ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry'],
    ROOM_LABEL: { bedroom: 'Bedroom', bathroom: 'Bathroom', kitchen: 'Kitchen', living: 'Living', dining: 'Dining',
      majlis: 'Majlis', office: 'Office', maid: "Maid's room", storage: 'Storage', laundry: 'Laundry' },
    ROOM_SIZE: {                                  // 4.2
      bedroom: { S: 12, M: 16, L: 24 }, bathroom: { S: 4, M: 6, L: 9 }, kitchen: { S: 9, M: 14, L: 20 },
      living: { S: 20, M: 30, L: 42 }, dining: { S: 12, M: 16, L: 24 }, majlis: { S: 16, M: 24, L: 36 },
      office: { S: 9, M: 12, L: 16 }, maid: { S: 6, M: 9, L: 12 }, storage: { S: 4, M: 6, L: 9 },
      laundry: { S: 4, M: 6, L: 9 }
    },
    SIZES: ['S', 'M', 'L'],
    LEVELS: ['B', 'G', '1', '2'],
    LEVEL_LABEL: { B: 'Basement', G: 'Ground floor', 1: 'First floor', 2: 'Second floor' },
    ENUM: {                                       // 4.1 allowed values (equal to the markup values)
      unit: ['m', 'ft'], roofType: ['flat', 'pitched', 'terrace'], exterior: ['sand', 'white', 'terracotta', 'grey'],
      stairPos: ['centre', 'fl', 'fr', 'bl', 'br'], gate: ['left', 'centre', 'right'], poolSize: ['S', 'M', 'L'],
      interiorStyle: ['modern', 'classic', 'minimal'], density: ['sparse', 'full']
    },
    RANGE: {                                      // 4.1 ranges [min, max]
      setback: [0, 20], footprintPct: [10, 80], vegPct: [0, 80], ceilingH: [2.4, 4.5], floors: [1, 3],
      cars: [0, 4], roomArea: [4, 80]
    },
    NORTH_STEP: 15,
    STAIR: { w: 2.5, d: 4.0, area: 10 },          // 4.3
    LIFT: { w: 1.5, d: 2.0, area: 3 },
    PARKING: { w: 2.5, d: 5.0, area: 12.5 },
    POOL: { S: { w: 3, d: 6, area: 18 }, M: { w: 4, d: 8, area: 32 }, L: { w: 5, d: 10, area: 50 } },
    POOL_CLEAR: 1,
    GRID: { m: { square: 1, snap: 0.5 }, ft: { square: 1.524, snap: 0.3048 } },   // ft mode: 5 ft squares, snap 1 ft
    PLAN_SNAP: { m: 0.5, ft: 0.3048 },
    PLAN_EDGE_SNAP: 0.3,                          // 4.4: a dragged edge snaps to a neighbouring edge within 0.3 m first (A-15)
    PLOT: { minPts: 3, maxPts: 12, extent: 100, minArea: 50 },
    BUILDABLE_MIN: 20,
    ROOM_MIN_SIDE: 1.5, ROOM_AREA_TOL: 0.25, ROOM_MAX_ASPECT: 3,
    MAX_ROOMS_PER_LEVEL: 8, MAX_PAIRS_PER_LEVEL: 6,
    // A-8 generator: room scale range, shared wall (length, tolerance), overlap tolerance, assignments tried for pairs
    LAYOUT: { fMin: 0.8, fMax: 1.2, adjMin: 0.5, adjTol: 0.02, overlapTol: 0.011, topAssignments: 60,
      retry: { fMin: 0.75, fMax: 1.25 } },          // 4.4: retry only when the first pass finds no layout (F3-T2)
    FOOTPRINT_ROUND: 0.5, FOOTPRINT_MAX_RATIO: 2, FOOTPRINT_STRETCH_RATIO: 3, FOOTPRINT_STRETCH_EXTRA: 0.5, BACK_ANGLE: 40
  };
})(globalThis.PC = globalThis.PC || {});
