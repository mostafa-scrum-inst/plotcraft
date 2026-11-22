// F6-T1b house and garden detail against the mock: openings as decals in roofBatch (plan 6.1, Designer A2 / Q-D1 /
// Q-D3), contact darkening (6.2), blobs, trees and shrubs (6.3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened, close } from '../helpers/scene3d.mjs';
import { maxHouse } from '../helpers/houses.mjs';
import { rgbOf, sameRgb } from '../helpers/batch.mjs';

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
    const ex = PC.data.exteriors[h.exterior], SC = PC.data.siteColors, glass = it.filter((x) => x.kind === 'glass'), rev = it.filter((x) => x.kind === 'reveal');
    const lit = h.openings.filter((o) => o.kind !== 'door');
    assert.equal(glass.length, lit.length, 'one glass quad per non-door opening');
    assert.equal(rev.length, 4 * lit.length, 'four reveal quads each');
    const planes = { front: [2, 1, E.Z(fp.v)], back: [2, -1, E.Z(fp.v + fp.d)], left: [0, -1, E.X(fp.u)], right: [0, 1, E.X(fp.u + fp.w)] };
    const g = E.mock.raw(E.mock.raw(E.mesh('roofBatch')).geometry), col = g.attrs.color.array, pos = g.attrs.position.array;
    lit.forEach((o, k) => {
      const q = glass[k], [ax, sg, at] = planes[o.side], lv = h.levels.find((l) => l.id === o.level), y0 = lv.baseY + 0.2;
      const plane = ax === 2 ? [q.z0, q.z1] : [q.x0, q.x1];
      assert.ok(close(plane[0], at + sg * D.glass) && close(plane[1], at + sg * D.glass), `${o.level} ${o.side} glass 0.01 m out`);
      assert.ok(close(q.y0, y0 + o.sill) && close(q.y1, y0 + o.head), 'sill to head');
      const span = ax === 2 ? [q.x0 + h.center[0], q.x1 + h.center[0]] : [-q.z1 + h.center[1], -q.z0 + h.center[1]];
      assert.ok(close(span[0], o.a) && close(span[1], o.b), 'a to b along the wall');
      const n = [0, 0, 0]; n[ax] = sg;
      assert.deepEqual(faceProblems(E, 'roofBatch', q, n), [], 'faces out of the wall');
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
