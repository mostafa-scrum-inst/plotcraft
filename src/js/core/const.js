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
    VEG_SHORT: 0.8,                    // F4-T3, PM round 11: warn when placed planting < 80 % of veg.area
    GRID: { m: { square: 1, snap: 0.5 }, ft: { square: 1.524, snap: 0.3048 } },   // ft mode: 5 ft squares, snap 1 ft
    PLAN_SNAP: { m: 0.5, ft: 0.3048 },
    PLAN_EDGE_SNAP: 0.3,                          // 4.4: a dragged edge snaps to a neighbouring edge within 0.3 m first (A-15)
    PLOT: { minPts: 3, maxPts: 12, extent: 100, minArea: 50 },
    BUILDABLE_MIN: 20,
    ROOM_MIN_SIDE: 1.5, ROOM_AREA_TOL: 0.25, ROOM_MAX_ASPECT: 3,
    MAX_ROOMS_PER_LEVEL: 10, MAX_PAIRS_PER_LEVEL: 6,   // CD-4: 10 rooms per plan level (was 8)
    // CD-5 hall access (PM round 10): a room has access with >= min m of a non-exterior side on hall or on the stair /
    // lift; one without is reached through a wall-sharing neighbour that is reached when they are a must-be-adjacent
    // pair or the neighbour's type is listed for it here (en-suite and service rooms). Chains count.
    HALL_ACCESS: { min: 0.8, hosts: {
      bathroom: ['bedroom', 'maid'],
      storage: ['bedroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid'],
      laundry: ['bedroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid'] } },
    LOW_FILL: 0.5,                                // PM round 8: a level whose drawn rooms + core fill less than this gets a hint
    // A-8 generator: room scale range, shared wall (length, tolerance), overlap tolerance, assignments tried for pairs
    LAYOUT: { fMin: 0.8, fMax: 1.2, adjMin: 0.5, adjTol: 0.02, overlapTol: 0.011, topAssignments: 60,
      retry: { fMin: 0.75, fMax: 1.25 } },          // 4.4: retry only when the first pass finds no layout (F3-T2)
    // 3D (F4-T1; A-9, A-10, A-12). HOUSE: slab 0.2 m (pitch = Q8 + slab; floor at baseY + slab), dollhouse walls
    // 1.2 m x 0.15 m, entrance door 1.2 m wide, z-offsets of A-10. CAM: angles in degrees, see A-12.
    HOUSE: { slab: 0.2, wallH: 1.2, wallT: 0.15, door: 1.2, tintLift: 0.015, capLift: 0.01, outerDrop: 0.05, outerK: 36 },
    // F6-T1b openings (Designer plan A2, plan 6.1): pane 1.2 x 1.4 (sill 0.9, head 2.3), small 0.6 x 0.6 (sill 1.6),
    // stair slot 0.6 x 1.6 (sill 0.5), door 1.0 x 2.2; endClear from run ends / partitions, pitch per pane,
    // smallMin run for a small pane, doorClear from the door frame, heads <= storeyH - headGap.
    // F6-T1b contact darkening (Designer C4, plan 6.2): wall-base skirts skirtH tall, x skirtK at the ground, skirtOut
    // proud; floor rings ringW wide, x ringK at the walls, ringLift over the tint; the footprint ring footW (at most)
    // wide, footGap clear of the plot outline, x footK at the footprint.
    CONTACT: { skirtH: 0.6, skirtK: 0.82, skirtOut: 0.005, ringW: 0.3, ringK: 0.9, ringLift: 0.003, footW: 0.8, footGap: 0.05, footK: 0.8,
      // F6-T1c R3: the parapet band on the deck deckW wide (x deckK at the parapet), the head bands headW (x headK),
      // bandLift over the deck (0.013 m over the slab top since deckLift 0.01)
      deckW: 0.35, deckK: 0.80, headW: 0.25, headK: 0.85, bandLift: 0.003 },
    OPEN: { win: { w: 1.2, h: 1.4, sill: 0.9 }, small: { w: 0.6, h: 0.6, sill: 1.6 }, slot: { w: 0.6, h: 1.6, sill: 0.5 },
      door: { w: 1.0, h: 2.2 }, endClear: 0.6, pitch: 2.6, smallMin: 1.2, doorClear: 0.6, headGap: 0.3,
      hallPitch: 3.9,   // F6-T1c W1: hall panes on free runs (no room, stair or lift), 1.5 x pitch
      // the decals (Q-D1): glass / reveal band offsets out of the wall plane, frame profile and proud depth, sill
      decal: { glass: 0.01, reveal: 0.06, revealD: 0.02, revealK: 0.65, frame: 0.06, proud: 0.05, mullionMin: 1.2,
        sillT: 0.04, sillOut: 0.08, sillOver: 0.02, leaf: 0.04 } },
    // F4-T2 (A-9, A-10, A-11; TL plan review, Designer plan). FURNISH: the A-11 placement rule. ROOF: slab, parapets
    // (0.3 m, 1.0 m when walkable or a terrace), pergola over the back third, 30 degree gable, stair head 2.4 m, lift
    // overrun 1.2 m. SITE: boundary wall 1.2 x 0.2 m inside the edge, gate 3 m with 0.4 x 1.4 m posts, seating pad
    // 3 m, north needle L = clamp(0.06 x max bbox side, 1.5, 3) with 0.5 m spare from the wall.
    FURNISH: { inset: 0.15, overlap: 0.01, scales: [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6] },
    ROOF: { slab: 0.2, parapet: 0.3, parapetHigh: 1.0, parapetT: 0.15, pitchDeg: 30, pergolaH: 2.4, post: 0.15, beam: 0.1,
      beamStep: 0.6, stairHead: 2.4, liftHead: 1.2,
      // F6-T1c (Designer R1 / R2): coping copingT thick, copingOver past both parapet faces; the flat slab dripOut
      // proud of the wall plane; the roof deck quad deckLift over the slab top (0.002 z-fought the slab top at Reset, Designer shots)
      copingT: 0.05, copingOver: 0.03, dripOut: 0.04, deckLift: 0.01 },
    // F6-T1a street strip outside the street edge (Designer plan D3): footpath, kerb, road widths in m
    STREET: { path: 1.5, kerb: 0.15, road: 8 },
    SITE: { wallH: 1.2, wallT: 0.2, gateW: 3, post: 0.4, postH: 1.4, seat: 3, edgeClear: 0.3, pathHalf: 1,
      marker: { k: 0.06, min: 1.5, max: 3, spare: 0.5, step: 0.25 } },
    CAM: { fov: 45, nearMin: 0.5, nearK: 0.02, farK: 20, phiMin: 5, phiMax: 85, rMin: 4, rMaxK: 3, rMaxReset: 1.2,
      eyeMin: 1, resetK: 2.2, resetFit: 1.05, resetTheta: 30, resetPhi: 62, keyDeg: 5, keyZoom: 1.1, wheelK: 0.0015 ,
      // F5-T1 (A-14 + plan review item 1): finder pose, flight time, frame-delta cap
      finderLift: 0.5, finderK: 1.6, finderRMin: 6, finderPhi: 35, finderPhiB: 15, flightMs: 1200, dtMax: 100 },
    // F5-T2 drone tour (A-14 as built, plan review): leg times in s at normal speed, speed factors, eye construction
    // (m), the tree gap over the canopy tops (eye floor from PC.data.vegetation), the A-14 nudge, the lead-in flight
    TOUR: { overviewLeg: 4.5, roomLeg: 3.5, speeds: { slow: 0.6, normal: 1, fast: 1.8 }, eyeOut: 2, eyeOutK: 0.6, eyeUp: 2.5,
      bEyeIn: 1.5, bEyeUp: 2.5, centralEps: 0.5, treeGap: 0.5, floorSoft: 1, phiSoft: 3, minGap: 0.5, leadInMs: 1200, leadInSkip: 0.5 },
    VIEW3D: { maxDpr: 2, shadowMap: 1024, shadowBias: -0.0005, shadowNormalBias: 0.02, sunDist: 2.5, shadowK: 2.5, shadowR: 1.2,
      // F6-T1a (CTO C-4.5 .. C-4.7; plan section 2 and review): phones (coarse pointer) and the lite tier keep a 1024
      // shadow map, fine pointers with maxTextureSize >= 4096 get shadowMapFine; maxDprCoarse caps coarse pointers.
      // tier: per pointer kind, chosen once when the view first opens (a phone result switches phones to lite by data).
      // roofOnOpen: stage 5 opens with the Roof on (client card pending; false restores the F4 default).
      // Fog (full tier): near = limits.rMax + R, far = min(near + fogSpanK x R, 0.9 x outerK x R / 2) (TL required
      // change 1). Sky dome radius skyK x camera.far, centred on the eye every frame (required change 2).
      maxDprCoarse: 2, shadowMapFine: 2048, roofOnOpen: true, tier: { coarse: 'full', fine: 'full' },
      tiers: {
        full: { tex: 512, fog: true, fineShadow: true, maxDpr: 2, treeDetail: 1 },
        lite: { tex: 256, fog: false, fineShadow: false, maxDpr: 1.5, treeDetail: 0 }
      },
      fogSpanK: 8, skyK: 0.9, blobY: 0.02 },
    FOOTPRINT_ROUND: 0.5, FOOTPRINT_MAX_RATIO: 2, FOOTPRINT_STRETCH_RATIO: 3, FOOTPRINT_STRETCH_EXTRA: 0.5, BACK_ANGLE: 40
  };
})(globalThis.PC = globalThis.PC || {});
