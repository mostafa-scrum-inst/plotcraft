/* PC.three helpers (A-10, A-11). THREE is touched only inside functions, so this file loads without it.
   - mixHex(a, b, k): the one colour mix of the app (A-10): per-channel lerp of the 0-255 sRGB values, Math.round per
     channel, upper-case '#RRGGBB'. Pure (no THREE).
   - col(hex): sRGB hex -> linear THREE.Color. Every material, vertex and light colour goes through it; the scene
     background does not (A-10).
   - BoxBatch: hand-written merge of boxes and up-facing quads into ONE Mesh with per-vertex colours (A-11).
     add(cx, cy, cz, sx, sy, sz, hex[, topHex]) in frame T (centre and full sizes); topHex colours the top face only
     (the slab's hall tint, TL F4-T1 ruling 6). addQuad(cx, y, cz, sx, sz, hex): horizontal, facing up. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};

  function hex2(n) { return ('0' + n.toString(16).toUpperCase()).slice(-2); }
  three.mixHex = function (a, b, k) {
    var out = '#';
    for (var i = 1; i < 7; i += 2) {
      var x = parseInt(a.slice(i, i + 2), 16), y = parseInt(b.slice(i, i + 2), 16);
      out += hex2(Math.round(x + (y - x) * k));
    }
    return out;
  };
  three.col = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };

  // Faces as [normal axis, sign, u axis, v axis] with u x v = normal, so (-u-v, +u-v, +u+v, -u+v) runs counter-clockwise
  // seen from outside. Axes: 0 = X, 1 = Y, 2 = Z. The +Y face is index 2 (the top).
  var FACES = [[0, 1, 1, 2], [0, -1, 2, 1], [1, 1, 2, 0], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 1, 0]];
  var CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

  function BoxBatch() { this.pos = []; this.nor = []; this.rgb = []; this.idx = []; this.boxes = 0; this.quads = 0; this.cache = {}; }
  BoxBatch.prototype.color = function (hex) {
    var c = this.cache[hex];
    if (!c) { var k = three.col(hex); c = this.cache[hex] = [k.r, k.g, k.b]; }
    return c;
  };
  BoxBatch.prototype.face = function (c, h, f, rgb) {
    var n = f[0], s = f[1], u = f[2], v = f[3], base = this.pos.length / 3;
    for (var i = 0; i < 4; i++) {
      var p = [c[0], c[1], c[2]];
      p[n] += s * h[n]; p[u] += CORNERS[i][0] * h[u]; p[v] += CORNERS[i][1] * h[v];
      var nn = [0, 0, 0]; nn[n] = s;
      this.pos.push(p[0], p[1], p[2]); this.nor.push(nn[0], nn[1], nn[2]); this.rgb.push(rgb[0], rgb[1], rgb[2]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  BoxBatch.prototype.add = function (cx, cy, cz, sx, sy, sz, hex, topHex) {
    var c = [cx, cy, cz], h = [sx / 2, sy / 2, sz / 2], side = this.color(hex), top = topHex ? this.color(topHex) : side;
    for (var i = 0; i < 6; i++) this.face(c, h, FACES[i], i === 2 ? top : side);
    this.boxes++;
  };
  BoxBatch.prototype.addQuad = function (cx, y, cz, sx, sz, hex) {
    this.face([cx, y, cz], [sx / 2, 0, sz / 2], FACES[2], this.color(hex));
    this.quads++;
  };
  BoxBatch.prototype.count = function () { return this.boxes + this.quads; };
  // One Mesh, or null when nothing was added.
  BoxBatch.prototype.build = function (material, name) {
    if (!this.idx.length) return null;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(this.rgb), 3));
    g.setIndex(this.idx);
    var m = new THREE.Mesh(g, material);
    m.name = name || '';
    m.castShadow = true; m.receiveShadow = true;
    m.userData.boxes = this.boxes; m.userData.quads = this.quads;
    return m;
  };
  three.BoxBatch = BoxBatch;
})(globalThis.PC = globalThis.PC || {});
