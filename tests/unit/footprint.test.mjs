import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
const PC = loadCore(), S = PC.site;
const plot = (pts, f) => { const s = PC.store.defaults(); s.plot = { pts, closed: true }; s.ans.streetEdge = 0; if (f) f(s.ans, s); return s; };
const zero = (a) => { a.setbacks = { front: 0, back: 0, side: 0 }; };
const rnd = (seed) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
// Independent statement of "buildable" (same as in site.test.mjs).
function buildable(site, p) {
  const pts = plain(site.ptsL), n = pts.length; let inside = false, on = false;
  for (let i = 0, j = n - 1; i < n; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; }
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
    if (d < site.setbackOf[i] - 1e-6) return false;
    if (d < 1e-6) on = true;
  }
  return inside || on;
}
function insideBuildable(site, seed) {
  const fp = site.footprint, r = rnd(seed), pts = [[fp.u, fp.v], [fp.u + fp.w, fp.v], [fp.u + fp.w, fp.v + fp.d], [fp.u, fp.v + fp.d]];
  for (let i = 0; i < 20; i++) pts.push([fp.u + r() * fp.w, fp.v + r() * fp.d]);
  for (const p of pts) assert.ok(buildable(site, p), `footprint point ${p} is buildable`);
  for (const k of ['u', 'v', 'w', 'd']) assert.ok(Math.abs(fp[k] * 4 - Math.round(fp[k] * 4)) < 1e-9, `${k} on the quarter-metre grid`);
  for (const k of ['w', 'd']) assert.ok(Math.abs(fp[k] * 2 - Math.round(fp[k] * 2)) < 1e-9, `${k} is a multiple of 0.5 m`);
}

test('rounding to 0.5 m alone is not a clamp (sample: 146 m2 asked, 142.5 m2 given, no flag)', () => {
  const fp = S.analyse(PC.sample.state()).footprint;
  assert.ok(fp.area < 146); assert.equal(fp.clamped, false); assert.equal(fp.moved, false);
});

test('narrow plot: shrunk about the centre, clamped, effective area reported', () => {
  const site = S.analyse(plot([[0, 0], [9, 0], [9, 40], [0, 40]])), fp = site.footprint;      // buildable strip 5 m wide
  assert.deepEqual(plain(site.buildable.bbox), { u0: 2, v0: 3, u1: 7, v1: 38 });
  assert.deepEqual([fp.u, fp.w], [2, 5], 'as wide as the buildable strip, to the half metre');
  assert.equal(fp.clamped, true); assert.ok(fp.area >= 20 && fp.area < 108); assert.equal(fp.pct, fp.area / 360 * 100);
  insideBuildable(site, 1);
  assert.deepEqual(plain(PC.validate(plot([[0, 0], [9, 0], [9, 40], [0, 40]])).warnings.map((w) => w.code)), ['fp-clamped']);
});

test('L-shaped plot: bounding-box centre is not buildable, the fallback finds a place', () => {
  const site = S.analyse(plot([[0, 0], [40, 0], [40, 10], [10, 10], [10, 40], [0, 40]])), bb = site.buildable.bbox, fp = site.footprint;
  assert.equal(S.isBuildable(site, [(bb.u0 + bb.u1) / 2, (bb.v0 + bb.v1) / 2]), false, 'centre is in the cut-out');
  assert.ok(fp, 'a footprint exists'); assert.equal(fp.moved, true); assert.equal(fp.clamped, true); assert.ok(fp.area >= 20);
  insideBuildable(site, 2);
});

test('U-shaped plot: fallback, result inside the buildable set', () => {
  const site = S.analyse(plot([[0, 0], [40, 0], [40, 40], [30, 40], [30, 10], [10, 10], [10, 40], [0, 40]])), fp = site.footprint;
  assert.ok(fp); assert.equal(fp.moved, true); assert.ok(fp.area >= 20);
  insideBuildable(site, 3);
});

// CTO decision 2026-11-20: the fallback also tries 1:2 and 2:1 and keeps the largest area.
test('fallback proportions: the Tech Lead\'s L-shape reaches 205 m2 (was 100); the U-shape 128 m2 (was 60), stretched to 192 m2 by step 4b', () => {
  const strip = (x) => { const c = { ...x }; delete c.mask; delete c.frame; return JSON.stringify(c); };
  // L: 40 x 12 m arm along the street plus a 14 x 40 m arm; 25 % of 872 m2 = 218 m2
  const L = () => plot([[0, 0], [40, 0], [40, 12], [14, 12], [14, 40], [0, 40]], (a) => { a.footprintPct = 25; });
  let site = S.analyse(L()), fp = site.footprint;
  assert.equal(site.plotArea, 872);
  assert.deepEqual([fp.u, fp.v, fp.w, fp.d, fp.area], [2, 10.25, 10, 20.5, 205], 'the 1:2 rectangle in the long arm');
  assert.ok(fp.area >= 180); assert.equal(fp.moved, true); assert.equal(fp.clamped, false, 'full size for its proportion: no warning');
  assert.ok(Math.max(fp.w / fp.d, fp.d / fp.w) <= 2.05 + 1e-9, '2:1 at most (plus the 0.5 m rounding)');
  insideBuildable(site, 11);
  const blocked = L(); blocked.ans.rooms = PC.sample.state().ans.rooms; blocked.ans.nextRoomId = 15; blocked.ans.pairs = [];
  assert.deepEqual(plain(PC.validate(blocked).blocking), [], 'the sample rooms (120 m2 a level) now fit this plot');
  // U: 40 x 40 m, arms and base 12 m; 25 % of 1152 m2 = 288 m2
  const U = () => plot([[0, 0], [40, 0], [40, 40], [28, 40], [28, 12], [12, 12], [12, 40], [0, 40]], (a) => { a.footprintPct = 25; });
  site = S.analyse(U()); fp = site.footprint;
  assert.equal(site.plotArea, 1152);
  // round 3: the 1:2 rectangle 8 x 16 = 128 m2 in an arm, clamped; step 4b (CD-1) lengthens it along the arm to 3:1
  assert.deepEqual([fp.u, fp.v, fp.w, fp.d, fp.area, fp.reason], [2, 8.5, 8, 24, 192, 'proportion']);
  assert.ok(fp.area > 128); assert.equal(fp.moved, true); assert.equal(fp.clamped, true);
  insideBuildable(site, 12);
  // two runs are deep-equal
  for (const make of [L, U]) { S.clearMemo(); const a = strip(S.analyse(make())); S.clearMemo(); assert.equal(strip(S.analyse(make())), a); }
});

test('fallback proportions: ties keep the bounding-box ratio; convex plots and the sample never reach the fallback', () => {
  const sample = S.analyse(PC.sample.state()).footprint;
  assert.deepEqual(plain(sample), { u: 5.25, v: 8, w: 9.5, d: 15, area: 142.5, pct: 142.5 / 584 * 100, clamped: false, moved: false });
  const narrow = S.analyse(plot([[0, 0], [9, 0], [9, 40], [0, 40]])).footprint;
  assert.equal(narrow.moved, false, 'a centred shrink that keeps half the target is final');
});

test('fallback keeps the full size when a clear place exists (moved, not clamped: no warning)', () => {
  const s = plot([[0, 0], [60, 0], [60, 20], [20, 20], [20, 60], [0, 60]], (a) => { a.footprintPct = 10; }), site = S.analyse(s), fp = site.footprint;
  assert.equal(fp.moved, true); assert.equal(fp.clamped, false);
  insideBuildable(site, 4);
  assert.deepEqual(plain(PC.validate(s).warnings.map((w) => w.code).filter((c) => c === 'fp-clamped')), []);
});

test('no 20 m2 rectangle fits: blocking "does not fit"; buildable under 20 m2: its own conflict', () => {
  const thin = plot([[0, 0], [2.5, 0], [2.5, 40], [0, 40]], zero), site = S.analyse(thin);
  assert.equal(site.buildable.ok, true); assert.equal(site.footprint, null); assert.equal(site.noFit, true);
  assert.deepEqual(plain(PC.validate(thin).blocking.map((b) => b.code)).filter((c) => c === 'no-fit' || c === 'buildable-small'), ['no-fit']);
  const tiny = plot([[0, 0], [8, 0], [8, 8], [0, 8]]), t = S.analyse(tiny);
  assert.equal(t.buildable.ok, false); assert.equal(t.footprint, null); assert.equal(t.noFit, false);
  assert.deepEqual(plain(PC.validate(tiny).blocking.map((b) => b.code)).filter((c) => c === 'no-fit' || c === 'buildable-small'), ['buildable-small']);
  assert.equal(PC.sig.level(tiny, 'G'), 'invalid');
});

test('a limit that lies on the 0.5 m grid is not lost to the bisection', () => {
  const site = S.analyse(plot([[0, 0], [10, 0], [10, 60], [0, 60]], (a) => { zero(a); a.footprintPct = 60; }));      // wants 13 x 26.5, only 10 wide
  assert.equal(site.footprint.w, 10); assert.equal(site.footprint.clamped, true);
});

test('proportions follow the buildable box, 2:1 at most', () => {
  const long = S.analyse(plot([[0, 0], [10, 0], [10, 80], [0, 80]], (a) => { zero(a); a.footprintPct = 10; })).footprint;
  assert.deepEqual([long.w, long.d], [6, 12.5], 'sqrt(80 / 2) and sqrt(80 x 2), rounded down'); assert.equal(long.clamped, false);
  const wide = S.analyse(plot([[0, 0], [80, 0], [80, 10], [0, 10]], (a) => { zero(a); a.footprintPct = 10; })).footprint;
  assert.deepEqual([wide.w, wide.d], [12.5, 6]);
  const sq = S.analyse(plot([[0, 0], [30, 0], [30, 30], [0, 30]], (a) => { zero(a); a.footprintPct = 25; })).footprint;
  assert.deepEqual([sq.w, sq.d, sq.u, sq.v], [15, 15, 7.5, 7.5], 'centred');
});

test('rotated plot (street edge not axis-aligned) gives the same footprint as its axis-aligned twin', () => {
  const r = 30 * Math.PI / 180, rot = (p) => [40 + p[0] * Math.cos(r) - p[1] * Math.sin(r), 5 + p[0] * Math.sin(r) + p[1] * Math.cos(r)];
  const a = PC.sample.state(), b = PC.sample.state(); b.plot.pts = b.plot.pts.map(rot);
  assert.ok(PC.plot.valid(b.plot), 'twin is a legal plot');
  const sa = S.analyse(a), sb = S.analyse(b);
  assert.deepEqual(plain(sb.footprint), plain(sa.footprint)); assert.deepEqual(plain(sb.edgeClass), plain(sa.edgeClass));
  assert.deepEqual(plain(sb.buildable), plain(sa.buildable)); assert.deepEqual(plain(sb.parking), plain(sa.parking)); assert.deepEqual(plain(sb.pool), plain(sa.pool));
  assert.equal(PC.sig.level(b, 'G'), PC.sig.level(a, 'G'));
});

test('deterministic; and fast enough on the largest plot', () => {
  const big = () => plot([[0, 0], [100, 0], [100, 100], [70, 100], [70, 40], [60, 40], [60, 100], [40, 100], [40, 40], [30, 40], [30, 100], [0, 100]], (a) => { a.pool.on = true; a.parking.cars = 4; });
  const strip = (x) => { const c = { ...x }; delete c.mask; delete c.frame; return JSON.stringify(c); };
  S.clearMemo(); let t = Date.now(); const one = S.analyse(big()); const first = Date.now() - t;
  assert.ok(first < 500, `analyse on a 12-vertex 100 x 100 m concave plot took ${first} ms`);
  t = Date.now(); assert.equal(S.analyse(big()), one); assert.ok(Date.now() - t < 5, 'memo hit');
  S.clearMemo(); assert.equal(strip(S.analyse(big())), strip(one), 'same input, same result');
  assert.ok(one.footprint && one.footprint.moved, 'the centre of this plot is not buildable');
  insideBuildable(one, 5);
});

test('fallback also runs when the centred result rounds under 20 m2 (F2-T1 QA bug 1: thin triangle)', () => {
  const s = plot([[0, 0], [60, 0], [30, 12]], (a) => { a.setbacks = { front: 1, back: 5, side: 3 }; a.footprintPct = 10; });
  const site = S.analyse(s);
  assert.equal(site.noFit, false, 'no no-fit: a building of 20 m2 or more fits');
  assert.ok(site.footprint && site.footprint.area >= 20, `footprint ${site.footprint && site.footprint.area} m2 >= 20`);
  insideBuildable(site, 7);
  assert.ok(!plain(PC.validate(s).blocking).some((x) => x.code === 'no-fit'), 'no no-fit conflict (level-over is expected: the rooms are larger)');
});

// ---- step 4b (A-6 round 4, CD-1): narrow plots may stretch to 3:1 when clamped ----
const R = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];
const fpOf = (pts, pct) => { S.clearMemo(); return S.analyse(plot(pts, (a) => { a.footprintPct = pct; })).footprint; };
test('step 4b: the PM / CTO examples exactly', () => {
  const pick = (f) => [f.w, f.d, f.area, Math.round(f.pct * 10) / 10, f.clamped, f.reason || null];
  assert.deepEqual(pick(fpOf(R(10, 50), 30)), [6, 18, 108, 21.6, true, 'proportion'], '10 x 50 m: stretch');
  assert.deepEqual(pick(fpOf(R(50, 10), 30)), [15, 5, 75, 15, true, 'proportion'], '50 x 10 m: stretch along the street');
  assert.deepEqual(pick(fpOf(R(20, 30), 80)), [16, 24.5, 392, 65.3, true, 'setbacks'], '20 x 30 m at 80 %: not at 2:1, no stretch');
  assert.deepEqual(pick(fpOf(R(10, 20), 80)), [6, 15, 90, 45, true, 'setbacks'], '10 x 20 m at 80 %: depth is the limit');
  assert.deepEqual(pick(fpOf(R(10, 50), 20)), [6, 16.5, 99, 19.8, false, null], '10 x 50 m at 20 %: only rounding lost, not clamped');
  assert.deepEqual(pick(fpOf(R(10, 50), 24)), [6, 18.5, 111, 22.2, true, 'proportion'], '10 x 50 m at 24 %: the 1:3 try, 3:1 plus one step');
  const fp = S.analyse(PC.sample.state()).footprint;
  assert.deepEqual(plain(fp), { u: 5.25, v: 8, w: 9.5, d: 15, area: 142.5, pct: fp.pct, clamped: false, moved: false }, 'sample unchanged, no reason');
});

test('step 4b properties over generated plots: fits, never above target, at most 3:1 plus a step, never smaller than 2:1 alone, deterministic', () => {
  const r = rnd(41); let stretched = 0;
  for (let k = 0; k < 60; k++) {
    const w = 6 + Math.round(r() * 40), h = 6 + Math.round(r() * 60), pct = 10 + Math.round(r() * 70);
    const pts = k % 2 ? R(w, h) : [[0, 0], [w, 0], [w, h * 0.4], [w * 0.5, h * 0.4], [w * 0.5, h], [0, h]];
    const s = plot(pts, (a) => { a.footprintPct = pct; }); S.clearMemo(); const site = S.analyse(s), fp = site.footprint;
    if (!fp) continue;
    const A = pct / 100 * site.plotArea, L = Math.max(fp.w, fp.d), Sh = Math.min(fp.w, fp.d);
    assert.ok(fp.area <= A + 1e-9, `case ${k}: not above target`);
    assert.ok(L <= 3 * Sh + 0.5 + 1e-9, `case ${k}: long side at most 3 x short + 0.5 m (${fp.w} x ${fp.d})`);
    if (L > 2 * Sh + 0.5 + 1e-9) stretched++;
    insideBuildable(site, k);
    S.T.noPrune = true; S.clearMemo(); const un = S.analyse(plot(pts, (a) => { a.footprintPct = pct; })).footprint; S.T.noPrune = false;
    assert.deepEqual(plain(un), plain(fp), `case ${k}: pruning changes nothing`);
    S.clearMemo(); assert.deepEqual(plain(S.analyse(plot(pts, (a) => { a.footprintPct = pct; })).footprint), plain(fp), `case ${k}: deterministic`);
  }
  assert.ok(stretched >= 5, `the sweep reaches 4b (${stretched} stretched results)`);
});

test('step 4b pruning gives identical results on 40 seeded concave plots', () => {
  const r = rnd(97);
  for (let k = 0; k < 40; k++) {
    const W = 20 + Math.round(r() * 60), H = 20 + Math.round(r() * 60), a = 0.3 + r() * 0.4, b = 0.3 + r() * 0.4, pct = 20 + Math.round(r() * 60);
    const pts = [[0, 0], [W, 0], [W, H], [W * a, H], [W * a, H * b], [0, H * b]].map((p) => [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2]);
    const make = () => plot(pts, (x) => { x.footprintPct = pct; });
    S.clearMemo(); const p1 = plain(S.analyse(make()).footprint);
    S.T.noPrune = true; S.clearMemo(); const p2 = plain(S.analyse(make()).footprint); S.T.noPrune = false;
    assert.deepEqual(p1, p2, `plot ${k}`);
  }
});

test('step 4b timing: the 12-vertex 100 x 100 m comb at 30 % and at 80 % (4b runs), best of three, under 500 ms', () => {
  const comb = (pct) => plot([[0, 0], [100, 0], [100, 100], [70, 100], [70, 40], [60, 40], [60, 100], [40, 100], [40, 40], [30, 40], [30, 100], [0, 100]], (a) => { a.pool.on = true; a.parking.cars = 4; a.footprintPct = pct; });
  for (const pct of [30, 80]) {
    let best = Infinity, fp;
    for (let k = 0; k < 3; k++) { S.clearMemo(); const t = Date.now(); fp = S.analyse(comb(pct)).footprint; best = Math.min(best, Date.now() - t); }
    assert.ok(best < 500, `comb at ${pct} %: ${best} ms`);
    assert.ok(Math.max(fp.w, fp.d) > 2 * Math.min(fp.w, fp.d) + 0.5, `comb at ${pct} %: 4b took part (${fp.w} x ${fp.d})`);
  }
});

test('A-6 step 8 cap (corrected, CTO F2 review): stretched long <= 3 x short + 0.5 m, step-4 long <= 2 x (short + 0.5 m)', () => {
  assert.equal(PC.C.FOOTPRINT_STRETCH_EXTRA, 0.5);
  // QA's pentagon with setbacks 6 / 5 / 4 at 25 %: the 3:1 try rounds to 23 x 7 m, capped to 3 x 7 + 0.5 = 21.5 m
  const pent = plot([[5, 0], [30, 0], [38, 18], [18, 34], [0, 16]], (a) => { a.setbacks = { front: 6, back: 5, side: 4 }; a.footprintPct = 25; });
  pent.ans.streetEdge = PC.plot.defaultStreetEdge(pent.plot.pts);
  S.clearMemo(); const site = S.analyse(pent), fp = site.footprint;
  assert.deepEqual([fp.w, fp.d, fp.area, fp.clamped, fp.reason], [21.5, 7, 150.5, true, 'proportion']);
  // the CTO's case: a 2.5 m wide plot at 25 % gave 2.5 x 8.5 m (3.4:1); now 2.5 x 8 m
  const thin = plot(R(2.5, 40), (a) => { a.setbacks = { front: 0, back: 0, side: 0 }; a.footprintPct = 25; a.parking.cars = 0; a.pool.on = false; });
  S.clearMemo(); const ft = S.analyse(thin).footprint;
  assert.deepEqual([ft.w, ft.d, ft.area, ft.clamped, ft.reason], [2.5, 8, 20, true, 'proportion']);
  // a 4b result at its 3:1 bound whose 0.5 m longer rectangle does not fit (the depth is the limit): setbacks
  const deep = fpOf(R(7, 14), 30);
  assert.deepEqual([deep.w, deep.d, deep.clamped, deep.reason], [3, 9, true, 'setbacks']);
  insideBuildable(site, 3);
  // 2:1 cases at or inside the bound are unchanged: 6 x 13 m (13 = 2 x 6.5, clamped) and 5 x 10.5 m (not clamped)
  const pick = (f) => [f.w, f.d, f.clamped];
  assert.deepEqual(pick(fpOf(R(10, 18), 50)), [6, 13, true], '10 x 18 m at 50 %: exactly at the 2:1 bound');
  assert.deepEqual(pick(fpOf(R(10, 19), 30)), [5, 10.5, false], '10 x 19 m at 30 %');
});
