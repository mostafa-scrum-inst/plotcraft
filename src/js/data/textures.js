/* Procedural texture specs (Designer-owned, F6-T1; Designer plan B; CTO C-3), read by PC.texgen (core/texgen.js).
   Values are fractions of the grey value: value = base x (1 + terms), clamped, so a texture only modulates the
   look-table colour (C-3.3). tileM = metres per texture repeat (world UVs are in metres, repeat = 1 / tileM).
   - grass (B1, groundPlot): value noise octaves [cells per tile, amplitude] + blade dashes (bladeLen px, one per
     bladeEvery px, +-blades).
   - paving (B2, paving mesh): slabs x slabs per tile with 1 px joints at `joint`, per-slab +-slab, speckle +-speckle.
   - tiles (B4, pitched roofTiles): rows x perRow per tile, staggered by half a tile; a lineW px shadow line at the
     bottom of each row at `line`, 1 px joints at `joint`, per-tile +-tile.
   - meadow (B8, groundOuter): low-frequency octaves.
   - blob (C5, T1b): radial alpha (1 - r)^power.
   - membrane (R2, T1c, roofDeck on flat roofs): tileM / sheetW sheets per tile with a 1 px seam at `seam`, mottle
     octaves, speckle +-speckle.
   - interior (I2, T2): the interior atlas, cells (row-major from uv 0, 0) planks (boards boards per tile, perLen
     staggered lengths each, seams, per-board value, lengthwise grain), tile (tiles x tiles with groutW px grout,
     per-tile value, mottle), carpet (tufted octaves) and weave (a 2 px crosshatch +-cross, noise +-noise). */
(function (PC) {
  'use strict';
  PC.data.textures = {
    grass: { tileM: 3, base: 0.86, noise: [[4, 0.10], [16, 0.05]], blades: 0.06, bladeLen: 3, bladeEvery: 40 },
    paving: { tileM: 2.4, base: 0.92, slabs: 4, joint: -0.28, slab: 0.05, speckle: 0.03 },
    tiles: { tileM: 1.5, base: 0.9, rows: 5, perRow: 6, lineW: 2, line: -0.30, joint: -0.15, tile: 0.06 },
    meadow: { tileM: 48, base: 0.9, noise: [[2, 0.05], [6, 0.035], [24, 0.02]] },   // F6-T1c G2: 24 / 8 / 2 m features over one 48 m tile (T1a: 0.08 at 12 m read as camouflage patches)
    // F6-T1c R2 (Designer): the flat roof deck membrane: sheets sheetW m wide along v with a seam, mottle, speckle
    membrane: { tileM: 4, base: 0.9, sheetW: 1.0, seam: -0.12, mottle: [[2, 0.05], [8, 0.025]], speckle: 0.03 },
    blob: { power: 1.5 },
    // F6-T2 I2 (Designer plan 3; CTO atlas condition; TL Q6): one 2 x 2 atlas, each cell 240 / 256 content + 8 / 256
    // wrapped padding per side; tiling comes from geometry (no repeat). Cell means within +-0.05 of each other.
    interior: { pad: 0.03125, cells: ['planks', 'tile', 'carpet', 'weave'],
      planks: { tileM: 1.2, base: 0.89, boards: 8, perLen: 2, seam: -0.25, board: 0.06, grain: 0.04 },
      tile: { tileM: 1.2, base: 0.89, tiles: 2, groutW: 2, grout: -0.30, tile: 0.03, mottle: [[3, 0.04]] },
      carpet: { tileM: 0.5, base: 0.88, noise: [[16, 0.05], [64, 0.06]] },
      weave: { base: 0.88, cross: 0.05, noise: 0.03 } }
  };
})(globalThis.PC = globalThis.PC || {});
