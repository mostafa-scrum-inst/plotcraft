import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from '../helpers/load.mjs';
const PC = loadCore(), F = PC.frames;
const near = (a, b, m) => assert.ok(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9), `${m}: ${a} vs ${b}`);

test('sample: L equals W (origin (0,0), u = +x, v = +y)', () => {
  const s = PC.sample.state(), f = F.make(s.plot.pts, 0);
  near([f.origin[0], f.origin[1], f.ux, f.uy], [0, 0, 1, 0], 'frame');
  near(f.w2l([8, 30]), [8, 30], 'w2l'); near(f.l2w([5.25, 8]), [5.25, 8], 'l2w');
  assert.equal(F.streetEdge(s), 0); assert.equal(F.northL(s), 0);
});
test('street on the right-hand edge: the plot is at v >= 0, +u runs along the edge', () => {
  const pts = [[0, 0], [20, 0], [20, 30], [0, 30]], f = F.make(pts, 1);        // edge (20,0) -> (20,30)
  near(f.w2l([20, 0]), [0, 0], 'A'); near(f.w2l([20, 30]), [30, 0], 'B'); near(f.w2l([0, 0]), [0, 20], 'far corner inward');
  for (const p of pts) { assert.ok(f.w2l(p)[1] >= -1e-9); near(f.l2w(f.w2l(p)), p, 'round trip'); }
  const g = F.make(pts, 3);                                                   // wrap-around edge (0,30) -> (0,0)
  near(g.w2l([0, 0]), [30, 0], 'wrap'); near(g.w2l([20, 30]), [0, 20], 'wrap inward');
});
test('slanted street edge round-trips and keeps lengths', () => {
  const pts = [[0, 0], [8, 6], [2, 14], [-6, 8]], f = F.make(pts, 0);
  near(f.w2l([8, 6]), [10, 0], 'edge length along u');
  for (const p of pts) near(f.l2w(f.w2l(p)), p, 'round trip');
});
test('northL: stored angle is clockwise from grid +y; result is clockwise from +v', () => {
  const s = PC.sample.state();
  s.ans.north = 90; assert.equal(F.northL(s), 90, 'street at the bottom: same angle');
  s.ans.streetEdge = 1; assert.equal(F.northL(s), 180, 'street on the right: +v points to -x, east is behind');
  s.ans.north = 270; assert.equal(F.northL(s), 0);
  s.ans.north = null; assert.equal(F.northL(s), 0, 'default: straight back');
  s.ans.streetEdge = null; s.ans.north = 45; assert.equal(F.northL(s), 45, 'null street edge resolves to the default edge');
});
test('l2t: X = u - cu, Y = height, Z = -(v - cv)', () => {
  near(F.l2t([10, 15], 10, 15, 0), [0, 0, 0], 'centre'); near(F.l2t([10, 15], 12, 20, 3), [2, 3, -5], 'point');
});

test('Q5 helpers: backW, northStep from the default and from a value, northToW round trip', () => {
  const s = PC.sample.state();
  assert.equal(F.backW(s), 0, 'street at the bottom: back is grid +y');
  assert.equal(F.northStep(s, 1), 15); assert.equal(F.northStep(s, -1), 345);
  s.ans.north = 345; assert.equal(F.northStep(s, 1), 0, 'wraps'); s.ans.north = 0; assert.equal(F.northStep(s, -1), 345);
  s.ans.north = null; s.ans.streetEdge = 1;                       // street on the right-hand edge: back points to grid -x
  assert.equal(F.backW(s), 270); assert.equal(F.northStep(s, 1), 285);
  for (const degL of [0, 15, 90, 180, 345]) { const w = F.northToW(s, degL); s.ans.north = w; assert.equal(F.northL(s), degL, `round trip ${degL}`); }
  const slant = PC.store.defaults(); slant.plot = { pts: [[0, 0], [8, 6], [2, 14], [-6, 8]].map((p) => [p[0] + 10, p[1]]), closed: true }; slant.ans.streetEdge = 0;
  assert.ok(Math.abs(F.backW(slant) - 323.13) < 0.01, 'slanted street edge');
  assert.equal(F.northStep(slant, 1), 345, 'default direction rounded to 15 (330), then one step');
  assert.equal(F.northToW(slant, 0), 330, 'nearest multiple of 15 to 323.13');
});
