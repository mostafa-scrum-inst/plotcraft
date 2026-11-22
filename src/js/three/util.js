/* PC.three helpers (A-10, A-11). THREE is touched only inside functions, so this file loads without it.
   - mixHex(a, b, k): the one colour mix of the app (A-10) = PC.sky.mix (core): per-channel lerp of the 0-255 sRGB
     values, Math.round per channel, upper-case '#RRGGBB'.
   - col(hex): sRGB hex -> linear THREE.Color. Every material, vertex and light colour goes through it; the scene
     background does not (A-10).
   - BoxBatch: hand-written merge of boxes and up-facing quads into ONE Mesh with per-vertex colours (A-11).
     add(cx, cy, cz, sx, sy, sz, hex[, topHex]) in frame T (centre and full sizes); topHex colours the top face only
     (the slab's hall tint, TL F4-T1 ruling 6). addQuad(cx, y, cz, sx, sz, hex): horizontal, facing up.
     F4-T2 (TL plan review Q12, required item 3), flat-shaded polygons with outward winding (each face's normal points
     away from the solid's centre): addPrism(cx, cz, sx, sz, y0, rise, alongX, hex, gableHex) a gable over the
     rectangle (ridge along X or Z, two slopes in hex, two triangles in gableHex, the base face down);
     addSeg(x0, z0, x1, z1, thick, y0, y1, hex) an oriented box along a segment; addFlat(pts, y0, y1, hex) a convex
     XZ polygon extruded from y0 to y1. userData.items lists [kind, vertex count] in the order added.
     F6-T1a: new BoxBatch({ uv: true }) adds a 'uv' attribute in world metres (CTO C-3.5): per planar face the two
     in-plane axes e1 = the horizontal tangent (X for horizontal faces) and e2 = n x e1, so a texture with
     repeat = 1 / tileM tiles at real scale across merged boxes; rows run along e1 (the eaves on a slope).
     addPrism(..., part) builds 'slopes' (the two roof slopes only, for roofTiles) or 'rest' (gables and base) or both.
   - texture(kind, size, renderer): a DataTexture from the PC.texgen pixel cache with the explicit r128 settings of C-3.4
     (colour kinds sRGB, blob linear); repeat = 1 / PC.data.textures[kind].tileM.
   - skyDome(radius): the F6-T1a sky geometry, a latitude-longitude sphere (24 x 12, rings every 15 degrees from -90
     to 90, so the horizon and the 15 degree ring are rows), wound to face inwards, with a colour attribute;
     returns { geometry, colors, elev }. skyPaint(dome, L) writes the gradient in place (A-13 / plan review Q-T3:
     linear lerp per vertex): below 0 the horizon, 0..15 horizon -> mid, 15..90 mid -> zenith. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};

  three.mixHex = PC.sky.mix;   // one rule, in core (F4-T3, TL plan review item 2)
  three.col = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };

  // Faces as [normal axis, sign, u axis, v axis] with u x v = normal, so (-u-v, +u-v, +u+v, -u+v) runs counter-clockwise
  // seen from outside. Axes: 0 = X, 1 = Y, 2 = Z. The +Y face is index 2 (the top).
  var FACES = [[0, 1, 1, 2], [0, -1, 2, 1], [1, 1, 2, 0], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 1, 0]];
  var CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

  function BoxBatch(o) {
    this.pos = []; this.nor = []; this.rgb = []; this.idx = []; this.cache = {}; this.items = [];
    this.uv = o && o.uv ? [] : null;
    this.boxes = 0; this.quads = 0; this.prisms = 0; this.segs = 0; this.flats = 0;
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  // In-plane axes of a face with unit normal n (world metres for the uv attribute).
  function basis(n) {
    var e1 = cross([0, 1, 0], n), l = Math.sqrt(dot(e1, e1));
    e1 = l < 1e-6 ? [1, 0, 0] : [e1[0] / l, e1[1] / l, e1[2] / l];
    return [e1, cross(n, e1)];
  }
  function mid(ps) { var c = [0, 0, 0]; ps.forEach(function (p) { c[0] += p[0] / ps.length; c[1] += p[1] / ps.length; c[2] += p[2] / ps.length; }); return c; }
  // One flat convex polygon (3+ points), wound so that its normal points away from `inner` (a point inside the solid).
  BoxBatch.prototype.poly = function (ps, rgb, inner) {
    var n = cross(sub(ps[1], ps[0]), sub(ps[2], ps[0])), l = Math.sqrt(dot(n, n)) || 1;
    n = [n[0] / l, n[1] / l, n[2] / l];
    if (dot(n, sub(mid(ps), inner)) < 0) { ps = ps.slice().reverse(); n = [-n[0], -n[1], -n[2]]; }
    var base = this.pos.length / 3, self = this, B = this.uv && basis(n);
    ps.forEach(function (p) {
      self.pos.push(p[0], p[1], p[2]); self.nor.push(n[0], n[1], n[2]); self.rgb.push(rgb[0], rgb[1], rgb[2]);
      if (B) self.uv.push(dot(p, B[0]), dot(p, B[1]));
    });
    for (var i = 1; i < ps.length - 1; i++) this.idx.push(base, base + i, base + i + 1);
    return ps.length;
  };
  // Side walls, top and bottom of a prism over the XZ outline `ring` (convex) from y0 to y1.
  BoxBatch.prototype.solid = function (ring, y0, y1, rgb) {
    var lo = ring.map(function (p) { return [p[0], y0, p[1]]; }), hi = ring.map(function (p) { return [p[0], y1, p[1]]; });
    var inner = mid(lo.concat(hi)), v = this.poly(hi, rgb, inner) + this.poly(lo, rgb, inner);
    for (var i = 0; i < ring.length; i++) { var j = (i + 1) % ring.length; v += this.poly([lo[i], lo[j], hi[j], hi[i]], rgb, inner); }
    return v;
  };
  BoxBatch.prototype.addSeg = function (x0, z0, x1, z1, thick, y0, y1, hex) {
    var dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, px = -dz / l * thick / 2, pz = dx / l * thick / 2;
    this.items.push(['seg', this.solid([[x0 + px, z0 + pz], [x1 + px, z1 + pz], [x1 - px, z1 - pz], [x0 - px, z0 - pz]], y0, y1, this.color(hex))]);
    this.segs++;
  };
  BoxBatch.prototype.addFlat = function (pts, y0, y1, hex) {
    this.items.push(['flat', this.solid(pts, y0, y1, this.color(hex))]);
    this.flats++;
  };
  BoxBatch.prototype.addPrism = function (cx, cz, sx, sz, y0, rise, alongX, hex, gableHex, part) {
    var hx = sx / 2, hz = sz / 2, y1 = y0 + rise, s = this.color(hex), g = this.color(gableHex || hex), v = 0;
    var b = [[cx - hx, y0, cz - hz], [cx + hx, y0, cz - hz], [cx + hx, y0, cz + hz], [cx - hx, y0, cz + hz]];
    var r0 = alongX ? [cx - hx, y1, cz] : [cx, y1, cz - hz], r1 = alongX ? [cx + hx, y1, cz] : [cx, y1, cz + hz];
    var inner = [cx, y0 + rise / 3, cz];
    var slopes = part !== 'rest', rest = part !== 'slopes';
    if (alongX) {
      if (slopes) v += this.poly([b[0], b[1], r1, r0], s, inner) + this.poly([b[3], b[2], r1, r0], s, inner);
      if (rest) v += this.poly([b[0], b[3], r0], g, inner) + this.poly([b[1], b[2], r1], g, inner);
    } else {
      if (slopes) v += this.poly([b[0], b[3], r1, r0], s, inner) + this.poly([b[1], b[2], r1, r0], s, inner);
      if (rest) v += this.poly([b[0], b[1], r0], g, inner) + this.poly([b[3], b[2], r1], g, inner);
    }
    if (rest) v += this.poly(b, s, inner);
    this.items.push([part === 'slopes' ? 'slopes' : 'prism', v]);
    this.prisms++;
  };
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
      if (this.uv) { var B = basis(nn); this.uv.push(dot(p, B[0]), dot(p, B[1])); }
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  BoxBatch.prototype.add = function (cx, cy, cz, sx, sy, sz, hex, topHex) {
    var c = [cx, cy, cz], h = [sx / 2, sy / 2, sz / 2], side = this.color(hex), top = topHex ? this.color(topHex) : side;
    for (var i = 0; i < 6; i++) this.face(c, h, FACES[i], i === 2 ? top : side);
    this.boxes++; this.items.push(['box', 24]);
  };
  BoxBatch.prototype.addQuad = function (cx, y, cz, sx, sz, hex) {
    this.face([cx, y, cz], [sx / 2, 0, sz / 2], FACES[2], this.color(hex));
    this.quads++; this.items.push(['quad', 4]);
  };
  BoxBatch.prototype.count = function () { return this.items.length; };
  // One Mesh, or null when nothing was added.
  BoxBatch.prototype.build = function (material, name) {
    if (!this.idx.length) return null;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(this.rgb), 3));
    if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(this.uv), 2));
    g.setIndex(this.idx);
    var m = new THREE.Mesh(g, material);
    m.name = name || '';
    m.castShadow = true; m.receiveShadow = true;
    m.userData.boxes = this.boxes; m.userData.quads = this.quads;
    m.userData.prisms = this.prisms; m.userData.segs = this.segs; m.userData.flats = this.flats; m.userData.items = this.items.slice();
    return m;
  };
  three.BoxBatch = BoxBatch;

  three.texture = function (kind, size, renderer) {
    var px = PC.texgen.get(kind, size), t = new THREE.DataTexture(px.data, px.w, px.h, THREE.RGBAFormat), k = 1 / PC.data.textures[kind].tileM;
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(k, k);
    t.encoding = kind === 'blob' ? THREE.LinearEncoding : THREE.sRGBEncoding;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true;
    return t;
  };

  var SKY_W = 24, SKY_H = 12;
  three.skyDome = function (radius) {
    var pos = [], idx = [], elev = [], i, j;
    for (j = 0; j <= SKY_H; j++) {
      var e = -90 + j * 180 / SKY_H, er = e * Math.PI / 180, y = Math.sin(er) * radius, rr = Math.cos(er) * radius;
      for (i = 0; i < SKY_W; i++) { var a = i / SKY_W * 2 * Math.PI; pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr); elev.push(e); }
    }
    // seen from the centre (i grows to the right, j upwards), a0 -> a1 -> b0 runs counter-clockwise: front faces inwards
    for (j = 0; j < SKY_H; j++) for (i = 0; i < SKY_W; i++) {
      var a0 = j * SKY_W + i, a1 = j * SKY_W + (i + 1) % SKY_W, b0 = a0 + SKY_W, b1 = a1 + SKY_W;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
    var g = new THREE.BufferGeometry(), colors = new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3);
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', colors);
    g.setIndex(idx);
    return { geometry: g, colors: colors, elev: elev };
  };
  // The elevation gradient (degrees) between three linear colours [r, g, b]: exported for the tests.
  three.skyAt = function (e, h, m, z) {
    var k, a, b;
    if (e <= 0) return h.slice();
    if (e <= 15) { k = e / 15; a = h; b = m; } else { k = (Math.min(e, 90) - 15) / 75; a = m; b = z; }
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
  three.skyPaint = function (dome, L) {
    var lin = function (hex) { var c = three.col(hex); return [c.r, c.g, c.b]; }, h = lin(L.skyHorizon), m = lin(L.skyMid), z = lin(L.skyZenith);
    var arr = dome.colors.array;
    for (var i = 0; i < dome.elev.length; i++) { var c = three.skyAt(dome.elev[i], h, m, z); arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2]; }
    dome.colors.needsUpdate = true;
  };
})(globalThis.PC = globalThis.PC || {});
