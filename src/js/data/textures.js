/* Procedural texture specs (Designer-owned, F6-T1; Designer plan B; CTO C-3), read by PC.texgen (core/texgen.js).
   Values are fractions of the grey value: value = base x (1 + terms), clamped, so a texture only modulates the
   look-table colour (C-3.3). tileM = metres per texture repeat (world UVs are in metres, repeat = 1 / tileM).
   - grass (B1, groundPlot): value noise octaves [cells per tile, amplitude] + blade dashes (bladeLen px, one per
     bladeEvery px, +-blades).
   - paving (B2, paving mesh): slabs x slabs per tile with 1 px joints at `joint`, per-slab +-slab, speckle +-speckle.
   - tiles (B4, pitched roofTiles): rows x perRow per tile, staggered by half a tile; a lineW px shadow line at the
     bottom of each row at `line`, 1 px joints at `joint`, per-tile +-tile.
   - meadow (B8, groundOuter): low-frequency octaves.
   - blob (C5, T1b): radial alpha (1 - r)^power. */
(function (PC) {
  'use strict';
  PC.data.textures = {
    grass: { tileM: 3, base: 0.86, noise: [[4, 0.10], [16, 0.05]], blades: 0.06, bladeLen: 3, bladeEvery: 40 },
    paving: { tileM: 2.4, base: 0.92, slabs: 4, joint: -0.28, slab: 0.05, speckle: 0.03 },
    tiles: { tileM: 1.5, base: 0.9, rows: 5, perRow: 6, lineW: 2, line: -0.30, joint: -0.15, tile: 0.06 },
    meadow: { tileM: 12, base: 0.9, noise: [[3, 0.045], [12, 0.025]] },   // F6-T1a shots: 0.08 read as camouflage patches
    blob: { power: 1.5 }
  };
})(globalThis.PC = globalThis.PC || {});
