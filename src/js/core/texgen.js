/* PC.texgen: procedural detail-texture pixels (F6-T1, CTO C-3.2; Designer plan B). Pure: numbers and typed arrays
   only (core layer, no 3D library). make(kind, size[, spec, seed]) -> { w, h, data: Uint8Array(w x h x 4) }, RGBA.
   - Colour kinds (grass, paving, tiles, meadow; F6-T1c membrane): neutral grey detail, value = base x (1 + sum of the kind's terms),
     clamped to 0..1, alpha 255. The colour still comes from the look tables (C-3.3); the texture multiplies it.
   - blob: radial alpha (RGB 0) for the contact-shadow quads (T1b), alpha = (1 - r)^1.5 with r = distance / half.
   - Every term is periodic over the tile, so opposite edges continue (tileable): value noise on a wrapped lattice of
     `cells` x `cells`, joints / rows on grids that divide the tile.
   - Deterministic: mulberry32 seeded by seed (default: FNV-1a of the kind). get(kind, size) caches the pixels per
     page session (C-3.2: generated once); `generated` counts real generations (the restore test reads it).
   Specs are PC.data.textures (Designer-owned, data/textures.js). */
(function (PC) {
  'use strict';
  // Local aliases: the inner loops must not look up globals (slow in sandboxed contexts such as the node tests).
  var M = Math, floor = M.floor, round = M.round, min = M.min, max = M.max, pow = M.pow, hypot = M.hypot, imul = M.imul;
  var F32 = Float32Array, U8 = Uint8Array;
  function fnv(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = imul(h, 0x01000193) >>> 0; }
    return h;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = imul(t ^ (t >>> 15), t | 1);
      t ^= t + imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  // Periodic value noise in [-1, 1] over size x size px, `cells` lattice cells per side (wrapped).
  function noise(size, cells, r) {
    var lat = new F32(cells * cells), out = new F32(size * size), i, x, y;
    for (i = 0; i < lat.length; i++) lat[i] = r() * 2 - 1;
    for (y = 0; y < size; y++) {
      var fy = y / size * cells, y0 = floor(fy), ty = smooth(fy - y0), y1 = (y0 + 1) % cells;
      for (x = 0; x < size; x++) {
        var fx = x / size * cells, x0 = floor(fx), tx = smooth(fx - x0), x1 = (x0 + 1) % cells;
        var a = lat[y0 * cells + x0], b = lat[y0 * cells + x1], c = lat[y1 * cells + x0], d = lat[y1 * cells + x1];
        out[y * size + x] = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
      }
    }
    return out;
  }
  function addNoise(f, size, octaves, r) {
    (octaves || []).forEach(function (o) { var n = noise(size, o[0], r); for (var i = 0; i < f.length; i++) f[i] += n[i] * o[1]; });
  }
  // Per-cell random values in [-1, 1] for an integer grid (seeded once per kind).
  function cellRand(n, r) { var a = new F32(n); for (var i = 0; i < n; i++) a[i] = r() * 2 - 1; return a; }

  var KINDS = {
    grass: function (S, size, r, f) {
      addNoise(f, size, S.noise, r);
      var n = round(size * size / S.bladeEvery);
      for (var k = 0; k < n; k++) {
        var x = floor(r() * size), y = floor(r() * size), s = (r() < 0.5 ? -1 : 1) * S.blades;
        for (var j = 0; j < S.bladeLen; j++) f[((y + j) % size) * size + x] += s;
      }
    },
    paving: function (S, size, r, f) {
      var sp = size / S.slabs, per = cellRand(S.slabs * S.slabs, r);
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var cx = floor(x / sp), cy = floor(y / sp), i = y * size + x;
        f[i] += per[cy * S.slabs + cx] * S.slab + (r() * 2 - 1) * S.speckle;
        if (x % sp === 0 || y % sp === 0) f[i] += S.joint;
      }
    },
    tiles: function (S, size, r, f) {
      var rh = size / S.rows, tw = size / S.perRow, per = cellRand(S.rows * S.perRow, r);
      for (var y = 0; y < size; y++) {
        var row = floor(y / rh), inRow = y - row * rh, off = row % 2 ? tw / 2 : 0;
        for (var x = 0; x < size; x++) {
          var xs = (x + off) % size, col = floor(xs / tw), i = y * size + x;
          f[i] += per[row * S.perRow + col] * S.tile;
          if (inRow >= rh - S.lineW) f[i] += S.line;
          else if (xs - col * tw < 1) f[i] += S.joint;
        }
      }
    },
    meadow: function (S, size, r, f) { addNoise(f, size, S.noise, r); },
    // F6-T1c R2: membrane sheets along v, a 1 px seam column every size / (tileM / sheetW) px
    membrane: function (S, size, r, f) {
      addNoise(f, size, S.mottle, r);
      var sp = size / (S.tileM / S.sheetW);
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var i = y * size + x;
        f[i] += (r() * 2 - 1) * S.speckle;
        if (x % sp === 0) f[i] += S.seam;
      }
    }
  };

  function make(kind, size, spec, seed) {
    var S = spec || PC.data.textures[kind], data = new U8(size * size * 4), r = rng(seed === undefined ? fnv(kind) : seed), i;
    if (!S) throw new Error('texgen: unknown kind ' + kind);
    if (kind === 'blob') {
      var half = size / 2;
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var d = hypot(x + 0.5 - half, y + 0.5 - half) / half, a = d >= 1 ? 0 : pow(1 - d, S.power);
        data[(y * size + x) * 4 + 3] = round(a * 255);
      }
      return { w: size, h: size, data: data };
    }
    var f = new F32(size * size);
    KINDS[kind](S, size, r, f);
    for (i = 0; i < f.length; i++) {
      var v = round(min(1, max(0, S.base * (1 + f[i]))) * 255), o = i * 4;
      data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
    }
    return { w: size, h: size, data: data };
  }

  var cache = {};
  PC.texgen = {
    KINDS: ['grass', 'paving', 'tiles', 'meadow', 'membrane', 'blob'],
    generated: 0,
    make: make,
    get: function (kind, size) {
      var k = kind + '@' + size;
      if (!cache[k]) { cache[k] = make(kind, size); PC.texgen.generated++; }
      return cache[k];
    },
    hash: function (t) {   // FNV-1a over the pixel bytes, 8 hex digits (determinism goldens)
      var h = 0x811c9dc5;
      for (var i = 0; i < t.data.length; i++) { h ^= t.data[i]; h = imul(h, 0x01000193) >>> 0; }
      return ('0000000' + h.toString(16)).slice(-8);
    }
  };
})(globalThis.PC = globalThis.PC || {});
