// F6-T1b house and garden detail against the mock: openings as decals in roofBatch (plan 6.1, Designer A2 / Q-D1 /
// Q-D3), contact darkening (6.2), blobs, trees and shrubs (6.3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened, close } from '../helpers/scene3d.mjs';
import { maxHouse, sampleApproved } from '../helpers/houses.mjs';
import { rgbOf, sameRgb, itemsOf } from '../helpers/batch.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// every triangle of a single-face item [first, first + n): the geometric normal along the stored one, which is `want`
function faceProblems(E, name, it, want) {
  const g = E.mock.raw(E.mock.raw(E.mesh(name)).geometry), pos = g.attrs.position.array, nor = g.attrs.normal.array, idx = g.index, out = [];
  const P = (i) => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t]; if (a < it.first || a >= it.first + it.n) continue;
    const gN = cross(sub(P(idx[t + 1]), P(a)), sub(P(idx[t + 2]), P(a))), n = [nor[3 * a], nor[3 * a + 1], nor[3 * a + 2]];
    if (dot(gN, n) <= 0) out.push('winding'); if (dot(n, want) < 0.999) out.push('normal ' + n);
  }
  return out;
}

test('openings: per glazed / small / slot opening one glass quad 0.01 m out of its wall plane with the glassTop -> glassBottom gradient, facing out; 4 reveal quads at 0.02 m in frame x 0.65; the door has a leaf and no glass', () => {
  for (const sf of [null, (PC) => maxHouse(PC)]) {
    const E = opened(sf), h = E.house, PC = E.PC, it = E.items('roofBatch'), fp = h.footprint, D = PC.C.OPEN.decal;
    // F6-T2 N2 (TL ruling 2): the glass quads live in "glazing", the reveals stay in roofBatch
    const ex = PC.data.exteriors[h.exterior], SC = PC.data.siteColors, glass = E.items('glazing').filter((x) => x.kind === 'glass'), rev = it.filter((x) => x.kind === 'reveal');
    assert.equal(it.filter((x) => x.kind === 'glass').length, 0, 'no glass left in roofBatch');
    const lit = h.openings.filter((o) => o.kind !== 'door');
    assert.equal(glass.length, lit.length, 'one glass quad per non-door opening');
    assert.equal(rev.length, 4 * lit.length, 'four reveal quads each');
    const planes = { front: [2, 1, E.Z(fp.v)], back: [2, -1, E.Z(fp.v + fp.d)], left: [0, -1, E.X(fp.u)], right: [0, 1, E.X(fp.u + fp.w)] };
    const g = E.mock.raw(E.mock.raw(E.mesh('glazing')).geometry), col = g.attrs.color.array, pos = g.attrs.position.array;
    lit.forEach((o, k) => {
      const q = glass[k], [ax, sg, at] = planes[o.side], lv = h.levels.find((l) => l.id === o.level), y0 = lv.baseY + 0.2;
      const plane = ax === 2 ? [q.z0, q.z1] : [q.x0, q.x1];
      assert.ok(close(plane[0], at + sg * D.glass) && close(plane[1], at + sg * D.glass), `${o.level} ${o.side} glass 0.01 m out`);
      assert.ok(close(q.y0, y0 + o.sill) && close(q.y1, y0 + o.head), 'sill to head');
      const span = ax === 2 ? [q.x0 + h.center[0], q.x1 + h.center[0]] : [-q.z1 + h.center[1], -q.z0 + h.center[1]];
      assert.ok(close(span[0], o.a) && close(span[1], o.b), 'a to b along the wall');
      const n = [0, 0, 0]; n[ax] = sg;
      assert.deepEqual(faceProblems(E, 'glazing', q, n), [], 'faces out of the wall');
      for (let i = q.first; i < q.first + 4; i++) {
        const want = pos[3 * i + 1] > (q.y0 + q.y1) / 2 ? rgbOf(PC, SC.glassTop) : rgbOf(PC, SC.glassBottom);
        assert.ok(sameRgb([col[3 * i], col[3 * i + 1], col[3 * i + 2]], want), 'glass gradient head -> sill');
      }
      const fr = rgbOf(PC, ex.frame).map((c) => c * D.revealK);
      rev.slice(4 * k, 4 * k + 4).forEach((r) => {
        assert.ok(sameRgb(r.side, fr), 'reveal = frame x 0.65');
        const p = ax === 2 ? r.z0 : r.x0; assert.ok(close(p, at + sg * D.revealD), 'reveal at 0.02 m');
      });
    });
    const door = h.openings.filter((o) => o.kind === 'door');
    assert.equal(door.length, 1);
    const leaf = it.filter((x) => x.kind === 'box' && sameRgb(x.side, rgbOf(PC, ex.door)));
    assert.equal(leaf.length, 1, 'one door leaf in exteriors.door');
    assert.ok(close(leaf[0].y1 - leaf[0].y0, door[0].head - door[0].sill) && close(leaf[0].x1 - leaf[0].x0, 1.0), 'leaf 1.0 x 2.2');
    // frames: 4 bars per lit opening (+1 mullion from 1.2 m) + 3 for the door, all in exteriors.frame and proud 0.05 m
    const bars = it.filter((x) => x.kind === 'box' && sameRgb(x.side, rgbOf(PC, ex.frame)));
    assert.equal(bars.length, lit.reduce((s, o) => s + 4 + (o.b - o.a >= 1.2 - 1e-9 ? 1 : 0), 0) + 3, 'frame bars');
    const sills = it.filter((x) => x.kind === 'box' && sameRgb(x.side, rgbOf(PC, ex.trim)) && close(x.y1 - x.y0, D.sillT));
    assert.equal(sills.length, lit.length, 'one sill each, in trim');
  }
});

test('openings follow the exterior choice: frame and door keys per Q10 exterior; the glass keys are site colours', () => {
  for (const ex of ['sand', 'white', 'terracotta', 'grey']) {
    const E = opened((PC) => { const s = maxHouse(PC); s.ans.exterior = ex; return s; }), PC = E.PC, it = E.items('roofBatch');
    assert.ok(it.some((x) => x.kind === 'box' && sameRgb(x.side, rgbOf(PC, PC.data.exteriors[ex].door))), ex + ' door');
    assert.ok(it.some((x) => x.kind === 'box' && sameRgb(x.side, rgbOf(PC, PC.data.exteriors[ex].frame))), ex + ' frame');
  }
});

// ---- 6.2 contact darkening ------------------------------------------------------------------------------------
const itemsIn = (E, name, parent) => { const m = E.mesh(name, parent); return m ? itemsOf(E.mock, m) : []; };
const vertIn = (E, mesh, i) => {
  const g = E.mock.raw(E.mock.raw(mesh).geometry), a = g.attrs;
  return { p: [a.position.array[3 * i], a.position.array[3 * i + 1], a.position.array[3 * i + 2]], n: [a.normal.array[3 * i], a.normal.array[3 * i + 1], a.normal.array[3 * i + 2]], c: [a.color.array[3 * i], a.color.array[3 * i + 1], a.color.array[3 * i + 2]] };
};
const scaled = (c, k) => c.map((x) => x * k);

test('skirts: ground level only, the slab edge and the wall base on all 4 sides (front split at the door), x skirtK at the ground -> x 1 at skirtH, skirtOut proud, facing out', () => {
  for (const ex of ['sand', 'grey']) {
    const E = opened((PC) => { const s = maxHouse(PC); s.ans.exterior = ex; return s; }), h = E.house, PC = E.PC, C = PC.C.CONTACT, X = PC.data.exteriors[ex];
    const g0 = h.levels.find((l) => l.index === 0), floorY = g0.baseY + PC.C.HOUSE.slab, k = (y) => C.skirtK + (1 - C.skirtK) * Math.min(1, y / C.skirtH);
    const parent = E.world.getObjectByName('level-' + g0.id), sk = itemsIn(E, 'walls', parent).filter((x) => x.kind === 'skirt');
    for (const lv of h.levels) if (lv.index !== 0) assert.equal(itemsIn(E, 'walls', E.world.getObjectByName('level-' + lv.id)).filter((x) => x.kind === 'skirt').length, 0, lv.id);
    const slabS = sk.filter((x) => close(x.y0, 0) && close(x.y1, floorY)), wallS = sk.filter((x) => close(x.y0, floorY) && close(x.y1, C.skirtH));
    assert.deepEqual([slabS.length, wallS.length, sk.length], [4, 5, 9], 'slab edge x 4, wall base x 5 (door gap)');
    const fp = h.footprint, cx = E.X(fp.u + fp.w / 2), cz = E.Z(fp.v + fp.d / 2), m = E.mesh('walls', parent);
    for (const it of sk) {
      const isSlab = it.y1 <= floorY + 1e-5, hex = isSlab ? X.slab : X.wall;
      for (let i = it.first; i < it.first + 4; i++) {
        const v = vertIn(E, m, i), want = scaled(rgbOf(PC, hex), close(v.p[1], 0) ? k(0) : k(v.p[1]));
        assert.ok(sameRgb(v.c, want), `${ex} skirt gradient at y ${v.p[1]}`);
        assert.ok(v.n[0] * (v.p[0] - cx) + v.n[2] * (v.p[2] - cz) > 0, 'faces out');
      }
      const out = close(it.z0, it.z1) ? Math.min(Math.abs(it.z0 - E.Z(fp.v + fp.d)), Math.abs(it.z0 - E.Z(fp.v))) : Math.min(Math.abs(it.x0 - E.X(fp.u)), Math.abs(it.x0 - E.X(fp.u + fp.w)));
      assert.ok(close(out, C.skirtOut, 1e-4), 'skirtOut proud of the wall face');
    }
  }
});

test('F6-T2 I2 floors in textured-<level>: the hall (FL.kind.hall, tile after PM Q4) over the footprint, each room tiled on its cell grid (areas add up, UVs inside the cell minus half a texel), the T1b ring as vertex colour (x ringK at the walls -> x 1 at ringW); footprint ring: groundRing x footK at the house -> x 1 at w, unshadowing, the ground map', () => {
  const E = opened(), h = E.house, PC = E.PC, C = PC.C.CONTACT, H = PC.C.HOUSE, FL = PC.data.floors, RT = PC.data.roomTints, FS = FL[h.interior.style];
  const e = 0.5 / 512, cells = {};   // the texgen layout inset by half a texel, computed here (not through atlasCells)
  PC.texgen.cells(512).forEach((c) => { cells[c.name] = { u0: c.u0 + e, v0: c.v0 + e, u1: c.u1 - e, v1: c.v1 - e }; });
  for (const lv of h.levels) {
    const parent = E.world.getObjectByName('level-' + lv.id), m = E.mesh('textured-' + lv.id, parent), it = itemsOf(E.mock, m), uv = E.mock.raw(E.mock.raw(m).geometry).attrs.uv.array;
    const y = lv.baseY + H.slab + H.tintLift, area = (q) => (q.x1 - q.x0) * (q.z1 - q.z0);
    const hall = it.filter((x) => x.kind === 'hallFloor'), fl = it.filter((x) => x.kind === 'floor');
    assert.ok(close(hall.reduce((a, q) => a + area(q), 0), h.footprint.w * h.footprint.d, 1e-6), lv.id + ' hall covers the footprint');
    assert.ok(hall.every((q) => close(q.y0, y)) && fl.every((q) => close(q.y0, y + 0.01)), 'floor heights');
    const hc = cells[FL.kind.hall];   // PM Q4: the hall takes a neutral non-plank kind
    assert.notEqual(FL.kind.hall, 'planks', 'hall not planks (PM Q4)');
    for (const q of hall) for (let i = q.first; i < q.first + 4; i++) { const u = uv[2 * i], w = uv[2 * i + 1]; assert.ok(u >= hc.u0 - 1e-9 && u <= hc.u1 + 1e-9 && w >= hc.v0 - 1e-9 && w <= hc.v1 + 1e-9, lv.id + ' hall uv in its kind cell'); }
    lv.rooms.forEach((r) => {
      const kind = FL.kind[r.type], c = cells[kind], hex = rgbOf(PC, PC.three.mixHex(FS[kind], RT[r.type], FL.tint));
      const x0 = E.X(r.u), x1 = E.X(r.u + r.w), z0 = E.Z(r.v + r.d), z1 = E.Z(r.v), k = Math.min(C.ringW, Math.min(r.w, r.d) / 2 - 0.01);
      const mine = fl.filter((q) => q.x0 >= x0 - 1e-5 && q.x1 <= x1 + 1e-5 && q.z0 >= z0 - 1e-5 && q.z1 <= z1 + 1e-5);
      assert.ok(close(mine.reduce((a, q) => a + area(q), 0), r.w * r.d, 1e-6), `${r.id} tiles cover the room`);
      for (const q of mine) {
        assert.ok(q.x1 - q.x0 <= PC.data.textures.interior[kind].tileM + 1e-6 && q.z1 - q.z0 <= PC.data.textures.interior[kind].tileM + 1e-6, 'one cell tile at most');
        for (let i = q.first; i < q.first + 4; i++) {
          const v = vertIn(E, m, i), u = uv[2 * i], w = uv[2 * i + 1];
          assert.ok(u >= c.u0 - 1e-9 && u <= c.u1 + 1e-9 && w >= c.v0 - 1e-9 && w <= c.v1 + 1e-9, `${r.id} uv in its cell`);
          const dd = Math.min(v.p[0] - x0, x1 - v.p[0], v.p[2] - z0, z1 - v.p[2]), f = C.ringK + (1 - C.ringK) * Math.min(1, dd / k);
          assert.ok(sameRgb(v.c, scaled(hex, f)), `${r.id} floor colour / ring`);
          assert.ok(v.n[1] > 0.999, 'face up');
        }
      }
    });
  }
  const ring = E.mesh('groundRing'), ri = itemsOf(E.mock, ring), fp = h.footprint, w = PC.three.footRingW(h);
  assert.deepEqual([ri.length, ri.every((x) => x.kind === 'ring'), ring.castShadow, ring.receiveShadow, ring.material === E.info().meshes.find((x) => x.name === 'groundRing').material], [4, true, false, true, true]);
  assert.equal(E.mock.raw(ring.material).map, E.mock.raw(E.mesh('groundPlot').material).map, 'the ground map');
  for (const q of ri) for (let i = q.first; i < q.first + 4; i++) {
    const v = vertIn(E, ring, i), onFp = v.p[0] >= E.X(fp.u) - 1e-5 && v.p[0] <= E.X(fp.u + fp.w) + 1e-5 && v.p[2] >= E.Z(fp.v + fp.d) - 1e-5 && v.p[2] <= E.Z(fp.v) + 1e-5;
    assert.ok(sameRgb(v.c, onFp ? [C.footK, C.footK, C.footK] : [1, 1, 1]), 'x footK at the house, x 1 at the outer edge');
    if (!onFp) assert.ok(close(Math.max(E.X(fp.u) - v.p[0], v.p[0] - E.X(fp.u + fp.w), E.Z(fp.v + fp.d) - v.p[2], v.p[2] - E.Z(fp.v)), w, 1e-4), 'outer edge at w');
  }
  // setback 0: no ring, the plot hole is the footprint
  const tight = opened(null, (hh) => { hh.footprint = { ...hh.footprint, u: hh.plot.pts[0][0], v: hh.plot.pts[0][1] }; });
  assert.equal(tight.PC.three.footRingW(tight.house), 0); assert.equal(tight.mesh('groundRing'), null);
});

test('boundary wall skirts: both faces of every wall run at the end of siteBatch, x skirtK at the ground', () => {
  const E = opened(), PC = E.PC, C = PC.C.CONTACT, it = E.items('siteBatch'), sk = it.filter((x) => x.kind === 'skirt');
  assert.ok(E.house.site.wall && sk.length >= 2 && sk.length % 2 === 0, `${sk.length} wall skirts`);
  assert.ok(it.slice(it.length - sk.length).every((x) => x.kind === 'skirt'), 'appended last');
  const m = E.mesh('siteBatch'), base = rgbOf(PC, PC.data.siteColors.boundaryWall);
  for (const q of sk) for (let i = q.first; i < q.first + 4; i++) { const v = vertIn(E, m, i); if (close(v.p[1], 0)) assert.ok(sameRgb(v.c, scaled(base, C.skirtK)), 'ground edge'); }
});

// ---- 6.3 blobs, trees, shrubs ----------------------------------------------------------------------------------
test('blobs: one instanced plane per shrub then per tree at blobY, diameter 2 x K x r x s, black x the blob map, transparent without depth write, renderOrder 1; winter shows only the shrubs; at most 2 transparent meshes', () => {
  const E = opened(), PC = E.PC, V = PC.data.vegetation, S = E.house.site, b = E.world.getObjectByName('blobs'), raw = E.mock.raw;
  assert.ok(b && raw(b).__kind === 'InstancedMesh');
  assert.deepEqual([b.count, b.renderOrder, b.castShadow, b.receiveShadow, b.frustumCulled], [S.shrubs.length + S.trees.length, 1, false, false, false]);
  const mt = b.material;
  assert.deepEqual([mt.transparent, mt.depthWrite, mt.toneMapped, mt.opacity, raw(mt.map).image.width], [true, false, false, V.blob.opacity, V.blob.size]);
  const M = raw(b).matrices, list = S.shrubs.map((it) => [it, V.blob.shrubK * V.shrub.r]).concat(S.trees.map((it) => [it, V.blob.treeK * V.tree.canopyR]));
  list.forEach(([it, r], i) => {
    const e = M[i], d = 2 * r * it[2];
    assert.ok(close(Math.hypot(e[0], e[1], e[2]), d, 1e-9) && close(Math.hypot(e[8], e[9], e[10]), 1, 1e-9) && close(Math.abs(e[9]), 1, 1e-9), `blob ${i}: face-up, diameter`);
    assert.ok(close(e[12], E.X(it[0]), 1e-9) && close(e[13], PC.C.VIEW3D.blobY, 1e-9) && close(e[14], E.Z(it[1]), 1e-9), `blob ${i} position`);
  });
  PC.view3d.setLook({ hour: 12, season: 'winter' }); assert.equal(b.count, S.shrubs.length, 'winter: shrubs only');
  PC.view3d.setLook({ hour: 12, season: 'summer' }); assert.equal(b.count, list.length, 'summer: all');
  for (const sf of [null, (P) => maxHouse(P)]) {
    const F = opened(sf); let n = 0;
    for (const x of F.info().meshes) if (x.material.transparent && !/^glow-/.test(x.name)) n++;   // F6-T2: additive glow outside the cap (CTO 1.2d)
    assert.ok(n <= 2, `${n} transparent meshes (TL Q-T5)`);
  }
});

test('canopy and shrub lumps: flat-shaded, every triangle facing away from its lump centre, inside canopyR / shrub r, the canopy between canopyY0 and canopyY0 + canopyH (4.2 m at scale 1)', () => {
  const E = opened(), V = E.PC.data.vegetation, det = E.info().tier.treeDetail;
  for (const [name, L, per, R, ylo, yhi, k] of [['canopies', V.tree.lumps, 20 * 4 ** det, V.tree.canopyR, V.tree.canopyY0, V.tree.canopyY0 + V.tree.canopyH, 1],
    ['shrubs', V.shrub.lumps, 20, V.shrub.r, 0, V.shrub.h, V.shrub.squashY]]) {
    const g = E.mock.raw(E.world.getObjectByName(name).geometry), p = g.attrs.position.array, n = g.attrs.normal.array;
    assert.equal(g.index == null || g.index.length === 0, true, name + ' non-indexed');
    for (let t = 0; t < p.length / 9; t++) {
      const c = L[Math.floor(t / per)], P = (j) => [p[9 * t + 3 * j], p[9 * t + 3 * j + 1], p[9 * t + 3 * j + 2]];
      const m = [0, 1, 2].map((a) => (P(0)[a] + P(1)[a] + P(2)[a]) / 3), N = [n[9 * t], n[9 * t + 1], n[9 * t + 2]];
      const gN = cross(sub(P(1), P(0)), sub(P(2), P(0)));
      assert.ok(dot(gN, N) > 0 && dot(N, sub(m, [c[0], c[1], c[2]])) > 0, `${name} triangle ${t} faces out`);
      for (let j = 0; j < 3; j++) { assert.ok(close(n[9 * t + 3 * j], N[0], 1e-6) && close(n[9 * t + 3 * j + 2], N[2], 1e-6), 'flat'); }
      for (const q of [P(0), P(1), P(2)]) assert.ok(Math.hypot(q[0], q[2]) <= R + 1e-5 && q[1] >= ylo - 1e-5 && q[1] <= yhi + 1e-5, `${name} vertex inside`);
    }
    assert.ok(k > 0);
  }
});

test('per-instance colour: canopies and shrubs tinted within the table value range and tilt, deterministic across rebuilds; trunks untinted', () => {
  const A = opened(), B = opened(), V = A.PC.data.vegetation, raw = A.mock.raw;
  assert.equal(raw(A.world.getObjectByName('trunks')).instanceColor, null, 'r128: null until the first setColorAt');
  for (const [name, T] of [['canopies', V.tint.tree], ['shrubs', V.tint.shrub]]) {
    const m = A.world.getObjectByName(name), c = raw(m).colors;
    assert.equal(c.length, m.count); assert.equal(m.instanceColor.needsUpdate, true);
    for (const [r, g, b] of c) {
      assert.ok(g >= T.value[0] - 1e-9 && g <= T.value[1] + 1e-9 && Math.abs(r / g - 1) <= T.tilt + 1e-9 && close(r + b, 2 * g, 1e-9), `${name} tint ${r} ${g} ${b}`);
    }
    assert.ok(new Set(c.map((x) => x[1].toFixed(4))).size > 1 || c.length < 2, 'varies');
    assert.deepEqual(JSON.stringify(c), JSON.stringify(B.mock.raw(B.world.getObjectByName(name)).colors), 'same on rebuild');
  }
});

// ---- F6-T1c roof detail (plan 1-3, Designer R1-R3, TL plan review) -------------------------------------------------
const roofCase = (f) => opened(f ? (PC) => sampleApproved(PC, f) : null);

test('F6-T1c R1: coping on every parapet ring (4 boxes) and head (1 box each), copingT thick, copingOver past both faces, in exteriors.coping; the drip-edge slab dripOut proud in slab; the decals stay last', () => {
  for (const [name, f] of [['flat', null], ['usable', (d) => { d.ans.usableRoof = true; }], ['terrace', (d) => { d.ans.roofType = 'terrace'; }]]) {
    const E = roofCase(f), PC = E.PC, R = PC.C.ROOF, h = E.house, fp = h.footprint, X = PC.data.exteriors[h.exterior], it = E.items('roofBatch');
    const top = h.roof.baseY + R.slab, high = h.roof.usable || h.roof.type === 'terrace', pTop = top + (high ? R.parapetHigh : R.parapet);
    const cop = it.filter((x) => x.kind === 'box' && sameRgb(x.side, rgbOf(PC, X.coping)));
    const heads = [h.roof.stairHead, h.roof.liftHead].filter(Boolean);
    assert.equal(cop.length, 4 + heads.length, `${name}: coping boxes`);
    const ring = cop.filter((x) => close(x.y0, pTop) && close(x.y1, pTop + R.copingT));
    assert.equal(ring.length, 4, name + ' ring on the parapet top');
    const xs = [Math.min(...ring.map((x) => x.x0)), Math.max(...ring.map((x) => x.x1))], zs = [Math.min(...ring.map((x) => x.z0)), Math.max(...ring.map((x) => x.z1))];
    assert.ok(close(xs[1] - xs[0], fp.w + 2 * R.copingOver) && close(zs[1] - zs[0], fp.d + 2 * R.copingOver), name + ' copingOver outside');
    const front = ring.find((x) => close(x.z1, E.Z(fp.v) + R.copingOver));
    assert.ok(front && close(front.z1 - front.z0, R.parapetT + 2 * R.copingOver), name + ' copingOver inside too');
    heads.forEach((r) => assert.ok(cop.some((x) => close(x.x1 - x.x0, r.w + 2 * R.copingOver) && close(x.z1 - x.z0, r.d + 2 * R.copingOver) && close(x.y1 - x.y0, R.copingT)), name + ' head cap'));
    const slab = it.filter((x) => x.kind === 'box' && close(x.y0, h.roof.baseY) && close(x.y1, top));
    assert.ok(slab.length === 1 && sameRgb(slab[0].side, rgbOf(PC, X.slab)) && close(slab[0].x0, E.X(fp.u) - R.dripOut) && close(slab[0].z1, E.Z(fp.v) + R.dripOut), name + ' drip edge');
    const firstDecal = it.findIndex((x) => x.kind === 'reveal');   // F6-T2: the glass moved to glazing; the reveals lead the decals
    assert.ok(firstDecal > 0 && it.slice(0, firstDecal).every((x) => x.kind !== 'reveal') && it.slice(firstDecal).every((x) => ['glass', 'reveal', 'box'].includes(x.kind)), name + ' decals last');
  }
  const P = roofCase((d) => { d.ans.roofType = 'pitched'; }), it = P.items('roofBatch');
  assert.ok(!it.some((x) => sameRgb(x.side, rgbOf(P.PC, P.PC.data.exteriors[P.house.exterior].coping))) && P.mesh('roofDeck') === null && !it.some((x) => x.kind === 'deckBand'), 'pitched: no coping, deck or band');
});

test('F6-T1c R3: deckBand strips bandLift over the deck (deckLift + bandLift over the slab top), deckW inside the parapet x deckK -> x 1; headW around each head x headK -> x 1, clipped to the deck', () => {
  const corner = (pos) => (PC) => { const st = maxHouse(PC, { stairPos: pos }); st.ans.roofType = 'flat'; st.ans.usableRoof = true; return st; };   // heads flush with a footprint corner: their bands clip to the deck
  for (const [name, E] of [['flat', roofCase(null)], ['usable', roofCase((d) => { d.ans.usableRoof = true; })], ['max fl', opened(corner('fl'))], ['max br', opened(corner('br'))]]) {
    const PC = E.PC, R = PC.C.ROOF, C = PC.C.CONTACT, h = E.house, fp = h.footprint, X = PC.data.exteriors[h.exterior], m = E.mesh('roofBatch');
    const bands = itemsOf(E.mock, m).filter((x) => x.kind === 'deckBand'), y = h.roof.baseY + R.slab + R.deckLift + C.bandLift, roofC = rgbOf(PC, X.roof);
    const heads = [h.roof.stairHead, h.roof.liftHead].filter(Boolean);
    assert.ok(bands.length >= 4 && bands.length <= 4 + 4 * heads.length, `${name}: ${bands.length} strips`);
    const D = [E.X(fp.u + R.parapetT), E.X(fp.u + fp.w - R.parapetT), E.Z(fp.v + fp.d - R.parapetT), E.Z(fp.v + R.parapetT)];
    bands.forEach((q, k) => {
      assert.ok(close(q.y0, y) && close(q.y1, y), 'height');
      for (let i = q.first; i < q.first + 4; i++) {
        const v = vertIn(E, m, i);
        assert.ok(v.p[0] >= D[0] - 1e-4 && v.p[0] <= D[1] + 1e-4 && v.p[2] >= D[2] - 1e-4 && v.p[2] <= D[3] + 1e-4, 'on the deck');
        assert.ok(v.n[1] > 0.999, 'face up');
        const ks = k < 4 ? [C.deckK, 1] : [C.headK, 1];
        assert.ok(ks.some((kk) => sameRgb(v.c, scaled(roofC, kk))), 'band colour');
      }
    });
    // the parapet bands: the edge on the parapet's inner face is x deckK, the far edge deckW in is x 1
    for (const q of bands.slice(0, 4)) for (let i = q.first; i < q.first + 4; i++) {
      const v = vertIn(E, m, i), edge = Math.min(v.p[0] - D[0], D[1] - v.p[0], v.p[2] - D[2], D[3] - v.p[2]);
      assert.ok(close(edge, 0, 1e-4) ? sameRgb(v.c, scaled(roofC, C.deckK)) : close(edge, C.deckW, 1e-4) && sameRgb(v.c, roofC), 'deckW band, x deckK at the parapet');
    }
  }
});

test('F6-T1c R2: roofDeck = one face-up quad inside the parapet deckLift over the slab top, world UVs in metres, Lambert in exteriors.roof, receives without casting; membrane on flat, the paving texture object on usable / terrace', () => {
  for (const [name, f, want] of [['flat', null, 'membrane'], ['usable', (d) => { d.ans.usableRoof = true; }, 'paving'], ['terrace', (d) => { d.ans.roofType = 'terrace'; }, 'paving']]) {
    const E = roofCase(f), PC = E.PC, R = PC.C.ROOF, h = E.house, fp = h.footprint, d = E.mesh('roofDeck'), raw = E.mock.raw;
    assert.ok(d && d.parent.name === 'roof', name);
    assert.deepEqual([d.castShadow, d.receiveShadow, raw(d.material).__kind, raw(d.material).vertexColors], [false, true, 'MeshLambertMaterial', false], name);
    const c = raw(raw(d.material).color);
    assert.ok(sameRgb([c.r, c.g, c.b], rgbOf(PC, PC.data.exteriors[h.exterior].roof)), name + ' roof colour');
    const it = itemsOf(E.mock, d);
    assert.equal(it.length, 1); assert.equal(it[0].kind, 'deck');
    const q = it[0], y = h.roof.baseY + R.slab + R.deckLift;
    assert.ok(close(q.y0, y) && close(q.y1, y) && close(q.x0, E.X(fp.u + R.parapetT)) && close(q.x1, E.X(fp.u + fp.w - R.parapetT)) && close(q.z1, E.Z(fp.v + R.parapetT)), name + ' inside the parapet');
    const g = raw(raw(d).geometry), uv = g.attrs.uv.array, pos = g.attrs.position.array;
    for (let i = 1; i < 4; i++) {
      const du = Math.hypot(uv[2 * i] - uv[0], uv[2 * i + 1] - uv[1]), dp = Math.hypot(pos[3 * i] - pos[0], pos[3 * i + 2] - pos[2]);
      assert.ok(close(du, dp, 1e-4), name + ' UVs in metres');
    }
    const map = raw(raw(d.material).map), paving = raw(raw(E.mesh('paving').material).map);
    if (want === 'paving') assert.equal(map, paving, name + ': the same paving texture object');
    else assert.equal(map.image.data, PC.texgen.get('membrane', 512).data, name + ': membrane');
    assert.equal(E.info().textures.length, want === 'paving' ? 5 : 6, name + ' textures');   // F6-T2: + interior atlas
    E.PC.view3d.setRoof(false); assert.equal(d.parent.visible, false, 'Roof off hides it');
  }
});
