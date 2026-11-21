import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
const G = loadCore().geom;
const SAMPLE = [[0, 0], [20, 0], [20, 30], [8, 30], [0, 26]];
const L = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];

test('area (signed), perimeter, bbox', () => {
  assert.equal(G.area(SAMPLE), 584); assert.equal(G.area([...SAMPLE].reverse()), -584);
  assert.equal(G.perimeter(SAMPLE, true).toFixed(2), '96.94'); assert.equal(G.perimeter(SAMPLE, false).toFixed(2), '70.94');
  assert.equal(G.perimeter([[0, 0]], true), 0);
  assert.deepEqual(plain(G.bbox(SAMPLE)), { x0: 0, y0: 0, x1: 20, y1: 30 });
  assert.equal(G.area([[0, 0], [20, 0], [20, 30], [0, 30]]), 600);
});
test('segRelation', () => {
  const R = (a, b, c, d) => G.segRelation(a, b, c, d);
  assert.equal(R([0, 0], [4, 4], [0, 4], [4, 0]), 'cross');
  assert.equal(R([0, 0], [4, 0], [2, 0], [2, 3]), 'touch', 'T contact');
  assert.equal(R([0, 0], [4, 0], [4, 0], [6, 2]), 'touch', 'shared end');
  assert.equal(R([0, 0], [4, 0], [4, 0], [8, 0]), 'touch', 'collinear, end to end');
  assert.equal(R([0, 0], [4, 0], [2, 0], [8, 0]), 'overlap');
  assert.equal(R([0, 0], [4, 0], [4, 0], [1, 0]), 'overlap', 'folded back');
  assert.equal(R([0, 0], [4, 0], [5, 0], [8, 0]), 'none', 'collinear apart');
  assert.equal(R([0, 0], [4, 0], [0, 1], [4, 1]), 'none', 'parallel');
  assert.equal(R([0, 0], [4, 0], [5, -1], [5, 1]), 'none', 'line crosses, segment does not');
  assert.equal(R([0, 0], [0, 4], [0, 2], [0, 6]), 'overlap', 'vertical');
  assert.equal(R([0, 0], [4, 0], [2, 1e-12], [2, 3]), 'touch', 'within tolerance');
  // symmetric
  assert.equal(R([0, 4], [4, 0], [0, 0], [4, 4]), 'cross'); assert.equal(R([2, 0], [2, 3], [0, 0], [4, 0]), 'touch');
});
test('pointInPoly: convex, concave, boundary', () => {
  assert.equal(G.pointInPoly([10, 15], SAMPLE), true); assert.equal(G.pointInPoly([2, 29], SAMPLE), false, 'cut corner');
  assert.equal(G.pointInPoly([7, 7], L), false, 'notch'); assert.equal(G.pointInPoly([2, 8], L), true);
  assert.equal(G.pointInPoly([10, 2], L), true, 'on an edge'); assert.equal(G.pointInPoly([0, 0], L), true, 'on a corner');
  assert.equal(G.pointInPoly([-1, 5], L), false); assert.equal(G.pointInPoly([11, 2], L), false);
});
test('distances, centroid, same', () => {
  assert.equal(G.dist([0, 0], [3, 4]), 5);
  assert.equal(G.distPointSeg([2, 3], [0, 0], [4, 0]), 3); assert.equal(G.distPointSeg([7, 4], [0, 0], [4, 0]), 5);
  assert.equal(G.distPointSeg([1, 1], [2, 2], [2, 2]).toFixed(4), '1.4142');
  assert.deepEqual(plain(G.centroid([[0, 0], [4, 0], [4, 2], [0, 2]])), [2, 1]);
  assert.deepEqual(plain(G.centroid([[0, 0], [4, 0]])), [2, 0], 'degenerate: vertex mean');
  assert.equal(G.same([1, 2], [1 + 1e-12, 2]), true); assert.equal(G.same([1, 2], [1.0001, 2]), false);
});
test('innerPoint is inside and keeps clear of the edges, also for a concave plot', () => {
  for (const pts of [SAMPLE, L, [[0, 0], [30, 0], [30, 2], [2, 2], [2, 20], [0, 20]]]) {
    const p = G.innerPoint(pts);
    assert.ok(G.pointInPoly(p, pts));
    const d = Math.min(...pts.map((a, i) => G.distPointSeg(p, a, pts[(i + 1) % pts.length])));
    assert.ok(d >= 0.5, `clearance ${d}`);
  }
  assert.deepEqual(plain(G.innerPoint([[0, 0], [4, 0], [4, 2], [0, 2]])), [2, 1], 'centroid for a rectangle');
});
