/* PC.three helpers (A-10, A-11). THREE is touched only inside functions, so this file loads without it.
   - mixHex(a, b, k): the one colour mix of the app (A-10) = PC.sky.mix (core): per-channel lerp of the 0-255 sRGB
     values, Math.round per channel, upper-case '#RRGGBB'.
   - col(hex): sRGB hex -> linear THREE.Color (G1: through PC.gfx.col, the adapter of the page). Every material, vertex and light colour goes through it; the scene
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
     F6-T1b: addQuadV(cx, cy, cz, axis, sign, w, h, top, bot, kind) a vertical quad with a top and a bottom colour.
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
  three.col = function (hex) { return PC.gfx.col(hex); };   // G1: the adapter owns the conversion (r128 vs r180)

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
  // F6-T1b (plan 6.1 / 6.2): a vertical quad facing +-X (axis 0) or +-Z (axis 2), centre (cx, cy, cz), w along the
  // wall, h tall, the top two vertices in `top`, the bottom two in `bot` (each a hex or a linear [r, g, b]): the
  // glass gradient, the reveal band, the wall-base skirt. kind names the item ('glass', 'reveal', 'skirt').
  BoxBatch.prototype.rgbOf = function (c) { return typeof c === 'string' ? this.color(c) : c; };
  BoxBatch.prototype.shade = function (hex, k) { var c = this.color(hex); return [c[0] * k, c[1] * k, c[2] * k]; };
  BoxBatch.prototype.addQuadV = function (cx, cy, cz, axis, sign, w, h, top, bot, kind) {
    var t = this.rgbOf(top), b = this.rgbOf(bot), base = this.pos.length / 3, n = [0, 0, 0], self = this;
    n[axis] = sign;
    // corners counter-clockwise seen from outside: along = the horizontal in-plane axis with along x up = n
    var al = axis === 0 ? [0, 0, -sign] : [sign, 0, 0];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (k) {
      var p = [cx + al[0] * k[0] * w / 2, cy + k[1] * h / 2, cz + al[2] * k[0] * w / 2], c = k[1] > 0 ? t : b;
      self.pos.push(p[0], p[1], p[2]); self.nor.push(n[0], n[1], n[2]); self.rgb.push(c[0], c[1], c[2]);
      if (self.uv) { var B = basis(n); self.uv.push(dot(p, B[0]), dot(p, B[1])); }
    });
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.quads++; this.items.push([kind || 'quadV', 4]);
  };
  // F6-T1b (plan 6.2): a vertical quad over the XZ segment p0 -> p1 from y0 to y1 facing the horizontal direction
  // `out` ([x, z]), top colour at y1, bottom at y0 (the boundary-wall skirts, any orientation); and a face-up
  // quadrilateral over 4 XZ points at height y with one colour per corner (the floor rings, the footprint ring).
  BoxBatch.prototype.addWallQuad = function (p0, p1, y0, y1, out, top, bot, kind) {
    var t = this.rgbOf(top), b = this.rgbOf(bot), l = Math.hypot(out[0], out[1]) || 1, n = [out[0] / l, 0, out[1] / l];
    var ps = [[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]];
    var g = cross(sub(ps[1], ps[0]), sub(ps[2], ps[0]));
    if (dot(g, n) < 0) ps = [ps[1], ps[0], ps[3], ps[2]];
    this.corners(ps, n, [b, b, t, t]);
    this.quads++; this.items.push([kind || 'quadV', 4]);
  };
  BoxBatch.prototype.addUpQuad = function (pts, y, rgbs, kind) {
    var ps = pts.map(function (p) { return [p[0], y, p[1]]; }), cs = rgbs.slice(), g = cross(sub(ps[1], ps[0]), sub(ps[2], ps[0]));
    if (g[1] < 0) { ps.reverse(); cs.reverse(); }
    this.corners(ps, [0, 1, 0], cs.map(this.rgbOf, this));
    this.quads++; this.items.push([kind || 'quadUp', 4]);
  };
  BoxBatch.prototype.corners = function (ps, n, cs, uvs) {
    var base = this.pos.length / 3, B = this.uv && !uvs && basis(n), self = this;
    ps.forEach(function (p, i) {
      self.pos.push(p[0], p[1], p[2]); self.nor.push(n[0], n[1], n[2]); self.rgb.push(cs[i][0], cs[i][1], cs[i][2]);
      if (B) self.uv.push(dot(p, B[0]), dot(p, B[1]));
      else if (uvs) self.uv.push(uvs[i][0], uvs[i][1]);
    });
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  // F6-T2 I2 (CTO atlas condition): atlas-mapped geometry in a BoxBatch({ uv: true }). rect = an atlas cell's content
  // { u0, v0, u1, v1 } already inset by half a texel (three.atlasCells). addCellBox maps every face of the box onto the
  // whole cell once (furniture parts); addCellUp is a face-up quad over 4 XZ points with one colour and one uv per
  // corner (floor and rug tiles, each inside one cell tile).
  BoxBatch.prototype.addCellBox = function (cx, cy, cz, sx, sy, sz, hex, rect, kind) {
    var c = [cx, cy, cz], h = [sx / 2, sy / 2, sz / 2], rgb = this.color(hex), self = this;
    var uvs = CORNERS.map(function (k) { return [k[0] < 0 ? rect.u0 : rect.u1, k[1] < 0 ? rect.v0 : rect.v1]; });
    FACES.forEach(function (f) {
      var n = [0, 0, 0], ps = CORNERS.map(function (k) { var p = c.slice(); p[f[0]] += f[1] * h[f[0]]; p[f[2]] += k[0] * h[f[2]]; p[f[3]] += k[1] * h[f[3]]; return p; });
      n[f[0]] = f[1]; self.corners(ps, n, [rgb, rgb, rgb, rgb], uvs);
    });
    this.boxes++; this.items.push([kind || 'cellBox', 24]);
  };
  BoxBatch.prototype.addCellUp = function (pts, y, rgbs, uvs, kind) {
    var ps = pts.map(function (p) { return [p[0], y, p[1]]; }), cs = rgbs.slice(), us = uvs.slice(), g = cross(sub(ps[1], ps[0]), sub(ps[2], ps[0]));
    if (g[1] < 0) { ps.reverse(); cs.reverse(); us.reverse(); }
    this.corners(ps, [0, 1, 0], cs.map(this.rgbOf, this), us);
    this.quads++; this.items.push([kind || 'cellUp', 4]);
  };
  // The interior atlas cells at `size` px, by name, each inset by half a texel (CTO atlas condition).
  three.atlasCells = function (size) {
    var out = {}, e = 0.5 / size;
    PC.texgen.cells(size).forEach(function (c) { out[c.name] = { u0: c.u0 + e, v0: c.v0 + e, u1: c.u1 - e, v1: c.v1 - e }; });
    return out;
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
    var px = PC.texgen.get(kind, size), t = new THREE.DataTexture(px.data, px.w, px.h, THREE.RGBAFormat), tm = PC.data.textures[kind].tileM;
    var k = tm ? 1 / tm : 1, wrap = tm ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;   // F6-T1b: the blob clamps, no repeat
    t.wrapS = wrap; t.wrapT = wrap;
    t.repeat.set(k, k);
    PC.gfx.texSpace(t, kind !== 'blob');
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = Math.min(4, PC.gfx.maxAniso(renderer));
    t.needsUpdate = true;
    return t;
  };

  // F6-T1b (plan 6.3, C-1.1: no BufferGeometryUtils): flat-shaded lumps merged into one non-indexed BufferGeometry.
  // lumps = [[x, y, z, r], ...]; detail 0 = the icosahedron (20 faces), 1 = each face split in 4 and pushed to the
  // sphere (80); squashY scales each lump's height about its own centre. Returns the geometry (position, normal).
  var ICO = (function () {
    var t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    var f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    var nv = v.map(function (p) { var l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; });
    return { v: nv, f: f };
  })();
  function unit(p) { var l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; }
  three.lumpTris = function (detail) {
    var tris = ICO.f.map(function (f) { return [ICO.v[f[0]], ICO.v[f[1]], ICO.v[f[2]]]; });
    for (var d = 0; d < detail; d++) {
      var next = [];
      tris.forEach(function (q) {
        var a = unit([(q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2, (q[0][2] + q[1][2]) / 2]);
        var b = unit([(q[1][0] + q[2][0]) / 2, (q[1][1] + q[2][1]) / 2, (q[1][2] + q[2][2]) / 2]);
        var c = unit([(q[2][0] + q[0][0]) / 2, (q[2][1] + q[0][1]) / 2, (q[2][2] + q[0][2]) / 2]);
        next.push([q[0], a, c], [a, q[1], b], [c, b, q[2]], [a, b, c]);
      });
      tris = next;
    }
    return tris;
  };
  three.lumps = function (lumps, detail, squashY) {
    var tris = three.lumpTris(detail), pos = [], nor = [], k = squashY || 1;
    lumps.forEach(function (L) {
      tris.forEach(function (q) {
        var ps = q.map(function (p) { return [L[0] + p[0] * L[3], L[1] + p[1] * L[3] * k, L[2] + p[2] * L[3]]; });
        var n = cross(sub(ps[1], ps[0]), sub(ps[2], ps[0])), l = Math.sqrt(dot(n, n)) || 1;
        ps.forEach(function (p) { pos.push(p[0], p[1], p[2]); nor.push(n[0] / l, n[1] / l, n[2] / l); });
      });
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(nor), 3));
    return g;
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
