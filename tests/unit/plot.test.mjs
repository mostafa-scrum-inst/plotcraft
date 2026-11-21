import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
const PC = loadCore(), P = PC.plot;
const SQ = [[0, 0], [10, 0], [10, 10], [0, 10]];

test('snap: 0.5 m in m mode, 1 ft in ft mode, clamped into the area', () => {
  assert.deepEqual(plain(P.snap([3.2, 7.76], 'm')), [3, 8]); assert.deepEqual(plain(P.snap([3.25, 7.74], 'm')), [3.5, 7.5]);
  assert.deepEqual(plain(P.snap([1, 1], 'ft')), [0.9144, 0.9144]); assert.deepEqual(plain(P.snap([0.46, 3.05], 'ft')), [0.6096, 3.048]);
  assert.deepEqual(plain(P.snap([-3, 104], 'm')), [0, 100]);
  assert.deepEqual(plain(P.snap([100.2, 100.9], 'ft')), [100, 100], 'beyond the last 1 ft line: clamped onto the 100 m bound, off the lattice');
  assert.deepEqual(plain(P.snap([99.95, 99.9], 'ft')), [99.9744, 99.9744], '328 ft, the last lattice line inside');
  assert.deepEqual(plain(P.snap([99.7, 5], 'ft')), [99.6696, 4.8768], 'last lattice column below the bound');
  const p = P.snap([12.3456789, 0.3048 * 7], 'ft'); assert.equal(p[1], 2.1336);
});
test('canAdd', () => {
  const R = (pts, p) => P.canAdd(pts, p).reason || 'ok';
  assert.equal(R([], [1, 1]), 'ok'); assert.equal(R([[1, 1]], [1, 1]), 'same');
  assert.equal(R([[0, 0], [10, 0], [10, 10]], [5, 12]), 'ok');
  assert.equal(R([[0, 5], [10, 5], [10, 15], [0, 15]], [5, 0]), 'cross', 'new edge crosses the first edge');
  assert.equal(R([[0, 0], [10, 0], [10, 10]], [5, 0]), 'cross', 'lands on an older edge');
  assert.equal(R([[0, 0], [10, 0], [10, 10]], [10, 0]), 'cross', 'lands on an older corner');
  assert.equal(R([[0, 0], [10, 0], [10, 10]], [0, 0]), 'cross', 'first corner: closing is not adding');
  assert.equal(R([[0, 0], [10, 0]], [4, 0]), 'cross', 'folds back along the last edge');
  assert.equal(R([[0, 0], [10, 0]], [14, 0]), 'ok', 'straight on');
  assert.equal(R([[0, 0]], [100.5, 3]), 'outside'); assert.equal(R([[0, 0]], [3, -0.5]), 'outside'); assert.equal(R([[0, 0]], [100, 100]), 'ok');
  const twelve = Array.from({ length: 12 }, (_, i) => [i * 2, (i % 2) * 3 + i]);
  assert.equal(R(twelve.slice(0, 11), [40, 40]), 'ok', '12th is allowed'); assert.equal(R(twelve, [40, 40]), 'max', '13th is refused');
});
test('canClose', () => {
  const R = (pts) => P.canClose(pts).reason || 'ok';
  assert.equal(R([]), 'few'); assert.equal(R([[0, 0], [5, 0]]), 'few'); assert.equal(R(SQ), 'ok'); assert.equal(R([[0, 0], [5, 0], [0, 5]]), 'ok');
  assert.equal(R([[0, 0], [10, 0], [10, 10], [5, -5]]), 'cross', 'closing edge would cross');
  assert.equal(R([[0, 0], [10, 0], [10, 10], [20, 0]]), 'cross', 'closing edge runs along the first edge (collinear touch)');
  assert.equal(R([[0, 0], [10, 0], [5, 5], [-5, -5]]), 'cross', 'closing edge passes through a corner');
  assert.equal(R([[0, 0], [5, 0], [10, 0]]), 'cross', 'all on one line');
  assert.equal(R([[0, 0], [10, 0], [10, 10], [5, 0]]), 'cross');
});
test('canMove', () => {
  const Q = [[10, 10], [20, 10], [20, 20], [10, 20]], R = (i, p) => P.canMove(Q, i, p, true).reason || 'ok';
  assert.equal(R(2, [22, 23]), 'ok'); assert.equal(R(2, [15, 15]), 'ok', 'concave is fine');
  assert.equal(R(2, [15, 5]), 'cross'); assert.equal(R(2, [10, 10]), 'cross', 'onto another corner'); assert.equal(R(2, [15, 10]), 'cross', 'onto an edge');
  assert.equal(R(2, [101, 10]), 'outside'); assert.equal(R(0, [-1, 0]), 'outside');
  assert.equal(P.canMove([[0, 0], [10, 0], [10, 10]], 2, [5, 0], true).ok, false, 'flat triangle');
  // a closed plot must stay counter-clockwise: a corner pulled through the opposite side is refused (CTO finding)
  const tri = [[0, 10], [10, 10], [5, 20]];
  assert.ok(PC.geom.area(tri) > 0);
  assert.deepEqual(plain(P.canMove(tri, 2, [5, 0], true)), { ok: false, reason: 'cross' }, 'apex moved across the base would give area -50');
  assert.equal(P.canMove(tri, 2, [5, 10.5], true).ok, true, 'still on the same side');
  assert.equal(P.canMove(tri, 2, [5, 0], false).ok, true, 'an open outline has no orientation yet');
  let flipped = 0;
  for (let i = 0; i < 4; i++) for (let x = 0; x <= 20; x++) for (let y = 0; y <= 20; y++) {      // 10 x 10 m square, every corner to every node of a 21 x 21 grid
    const sq = [[5, 5], [15, 5], [15, 15], [5, 15]], r = P.canMove(sq, i, [x, y], true);
    if (r.ok) { const q = sq.slice(); q[i] = [x, y]; if (PC.geom.area(q) <= 0) flipped++; assert.ok(P.valid({ pts: q, closed: true }), `accepted move ${i} -> ${x},${y} is a valid plot`); }
  }
  assert.equal(flipped, 0, 'no accepted corner move turns the square clockwise or flat');
  assert.deepEqual(Q, [[10, 10], [20, 10], [20, 20], [10, 20]], 'input untouched');
});
test('normalise: counter-clockwise, first point kept, input untouched', () => {
  const cw = [[0, 0], [0, 10], [10, 10], [10, 0]], out = plain(P.normalise(cw));
  assert.deepEqual(out, [[0, 0], [10, 0], [10, 10], [0, 10]]); assert.ok(PC.geom.area(out) > 0);
  assert.deepEqual(cw, [[0, 0], [0, 10], [10, 10], [10, 0]]);
  assert.deepEqual(plain(P.normalise(SQ)), SQ);
});
test('defaultStreetEdge: lowest midpoint; tie -> longer; still tied -> lowest index', () => {
  assert.equal(P.defaultStreetEdge([[0, 0], [20, 0], [20, 30], [8, 30], [0, 26]]), 0, 'sample');
  assert.equal(P.defaultStreetEdge([[10, 10], [0, 10], [0, 0], [10, 0]]), 2, 'bottom edge is index 2');
  // two edges with equal midpoint height, different length: [0,2]-[4,0] (mid y 1, len 4.47) and [4,0]-[12,2] (mid y 1, len 8.25)
  assert.equal(P.defaultStreetEdge([[0, 2], [4, 0], [12, 2], [6, 10]]), 1, 'longer wins');
  // equal height and length: lowest index
  assert.equal(P.defaultStreetEdge([[0, 2], [4, 0], [8, 2], [4, 10]]), 0, 'lowest index');
});
test('valid: for drafts', () => {
  const V = (pts, closed) => P.valid({ pts, closed });
  assert.equal(V([], false), true); assert.equal(V([[1, 1], [5, 1]], false), true); assert.equal(V(SQ, true), true);
  assert.equal(V([...SQ].reverse(), true), false, 'clockwise closed plot');
  assert.equal(V([[0, 0], [10, 10], [10, 0], [0, 10]], true), false, 'bow tie');
  assert.equal(V([[0, 0], [10, 0], [10, 10], [5, -5]], false), false, 'open outline crossing itself');
  assert.equal(V([[0, 0], [10, 0], [10, 100.5]], false), false, 'outside'); assert.equal(V([[0, -1], [10, 0], [10, 10]], true), false);
  assert.equal(V([[0, 0], [10, 0], [0, 0]], false), false, 'repeated corner');
});
