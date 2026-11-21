// F4-T2 outdoor items in the site model (A-9; PM round 10 Q7 / Q8; Designer plan 2): gate, path strip, garden
// seating (+ its F2-S3 warning), north marker; the house model's roof heads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
import { sampleApproved } from '../helpers/houses.mjs';

const PC = loadCore(), G = PC.geom;
const sample = (f) => { const s = plain(PC.sample.state()); if (f) f(s); return s; };
const grow = (r, k) => ({ u: r.u - k, v: r.v - k, w: r.w + 2 * k, d: r.d + 2 * k });
const SEAT_TEXT = 'Garden seating does not fit in the yard: it is left out of the 3D scene. Try a lower footprint %, fewer cars or a smaller pool.';
function cramped(f) {   // a 10 x 12 m plot: nothing of the yard fits
  return sample((s) => { s.plot.pts = [[0, 0], [10, 0], [10, 12], [0, 12]]; s.ans.streetEdge = 0; s.ans.edgeOv = {}; s.ans.vegPct = 0; s.ans.setbacks = { front: 3, back: 2, side: 1 }; if (f) f(s); });
}

test('gate: Left / Centre / Right at 25 / 50 / 75 % of the street edge from its low-u end (left as seen from the street); none without the wall (Q7)', () => {
  for (const [g, k] of [['left', 0.25], ['centre', 0.5], ['right', 0.75]]) {
    const s = sampleApproved(PC, (d) => { d.ans.extras.gate = g; }), site = PC.site.analyse(s), len = site.ptsL[(site.edge + 1) % site.ptsL.length][0];
    assert.equal(site.ptsL[site.edge][0], 0); assert.equal(site.ptsL[site.edge][1], 0); assert.equal(site.ptsL[(site.edge + 1) % site.ptsL.length][1], 0);
    assert.deepEqual(plain(PC.house.build(s).site.gate), { u: len * k, w: 3 }, g);
  }
  const off = PC.house.build(sampleApproved(PC, (d) => { d.ans.extras.wall = false; d.ans.extras.gate = 'left'; }));
  assert.deepEqual([off.site.wall, off.site.gate], [false, null]);
});

test('seating: 3 x 3 pad on the sample in the back yard, inside the plot with 0.3 m to the edge, clear of footprint + 1 m, parking, pool + clearance and the path strip', () => {
  for (const g of ['left', 'centre', 'right']) {
    const s = sample((d) => { d.ans.extras.gate = g; }), site = PC.site.analyse(s), st = site.seating, fp = site.footprint;
    assert.ok(st, g); assert.deepEqual([st.w, st.d, st.along], [3, 3, 'u']);
    assert.ok(st.v >= fp.v + fp.d + 1 - 1e-9, 'back yard');
    assert.ok(G.rectInPoly(grow(st, 0.3), site.ptsL), 'inside with the edge clearance');
    for (const x of [grow(fp, 1), site.parking, grow(site.pool, PC.C.POOL_CLEAR), PC.site.pathStrip(site, s.ans.extras)]) assert.ok(!G.rectsOverlap(st, x), JSON.stringify(x));
  }
  assert.equal(PC.validate(sample()).warnings.length, 0, 'the sample has no warning (6.2; PM round 10 Q8)');
  assert.equal(PC.site.analyse(sample((d) => { d.ans.extras.seating = false; })).seating, null, 'seating off: none');
});

test('seating that does not fit: omitted, the PM warning (Q17), absent from the model; other outdoor items unaffected', () => {
  const s = cramped(), site = PC.site.analyse(s);
  assert.ok(site.omitted.includes('seating') && site.seating === null);
  const w = PC.validate(s).warnings.find((x) => x.code === 'seating-omitted');
  assert.ok(w); assert.equal(w.text, SEAT_TEXT); assert.equal(w.q, 17); assert.equal(PC.validate.RULES['seating-omitted'].kind, 'warn');
  assert.ok(!PC.validate(cramped((d) => { d.ans.extras.seating = false; })).warnings.some((x) => x.code === 'seating-omitted'), 'off: no warning');
});

test('path strip: 2 m wide between the street and the door, widened to the gate; without the wall it is the door strip', () => {
  const s = sample((d) => { d.ans.extras.gate = 'left'; }), site = PC.site.analyse(s), fp = site.footprint, cx = fp.u + fp.w / 2;
  const len = site.ptsL[(site.edge + 1) % site.ptsL.length][0], p = PC.site.pathStrip(site, s.ans.extras);
  assert.ok(Math.abs(p.u - (len * 0.25 - 1)) < 1e-9 && Math.abs(p.u + p.w - (cx + 1)) < 1e-9 && Math.abs(p.v + p.d - fp.v) < 1e-9);
  const q = PC.site.pathStrip(site, { wall: false, gate: 'left', seating: true });
  assert.ok(Math.abs(q.u - (cx - 1)) < 1e-9 && Math.abs(q.w - 2) < 1e-9);
});

test('north marker: L = clamp(0.06 x max bbox side, 1.5, 3); its circle + 0.5 m + the wall inside the plot; clear on the sample; never omitted', () => {
  const site = PC.site.analyse(sample()), m = site.northMarker, b = G.bbox(site.ptsL);
  assert.ok(Math.abs(m.L - Math.min(3, Math.max(1.5, 0.06 * Math.max(b.x1 - b.x0, b.y1 - b.y0)))) < 1e-12);
  const room = m.L / 2 + 0.5 + 0.2, pts = site.ptsL;
  assert.ok(G.pointInPoly([m.u, m.v], pts) && pts.every((p, i) => G.distPointSeg([m.u, m.v], p, pts[(i + 1) % pts.length]) >= room - 1e-9));
  assert.ok(m.u < (b.x0 + b.x1) / 2 && m.v < (b.y0 + b.y1) / 2, 'front-left on the sample');
  const big = sample((d) => { d.plot.pts = [[0, 0], [80, 0], [80, 60], [0, 60]]; d.ans.streetEdge = 0; d.ans.edgeOv = {}; });
  assert.equal(PC.site.analyse(big).northMarker.L, 3);
  const small = PC.site.analyse(cramped());
  assert.ok(small.northMarker && small.northMarker.L === 1.5, 'cramped: still drawn');
  assert.deepEqual(plain(PC.house.build(sampleApproved(PC)).site.northMarker), plain(m));
});

test('roof heads: stair head and lift overrun on a usable roof only; a usable roof is never pitched in the model', () => {
  const u = PC.house.build(sampleApproved(PC, (d) => { d.ans.usableRoof = true; d.ans.lift = true; d.ans.roofType = 'terrace'; }));
  const fp = u.footprint, c = PC.layout.core(fp.w, fp.d, true, u.levels[0] && 'centre', true);
  assert.ok(u.roof.stairHead && u.roof.liftHead);
  assert.deepEqual(plain(u.roof.stairHead), plain(u.levels[u.levels.length - 1].stair));
  assert.deepEqual(plain(u.roof.liftHead), plain(u.levels[u.levels.length - 1].lift));
  assert.ok(c.stair);
  const p = PC.house.build(sampleApproved(PC, (d) => { d.ans.usableRoof = true; d.ans.roofType = 'pitched'; }));
  assert.equal(p.roof.type, 'flat');
  const n = PC.house.build(sampleApproved(PC, (d) => { d.ans.lift = true; }));
  assert.deepEqual([n.roof.stairHead, n.roof.liftHead], [null, null], 'not usable: no heads');
});
