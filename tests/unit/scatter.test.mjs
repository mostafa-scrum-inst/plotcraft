// F4-T3: PC.scatter.vegetation (A-9; TL F4-T3 plan review items 1 / 5, rulings Q1-Q3; PM round 11 shortfall warning).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';

const PC = loadCore(), G = PC.geom, V = plain(PC.data.vegetation), CLR = V.tree.canopyR * V.scale[1];
const sample = (f) => { const s = plain(PC.sample.state()); if (f) f(s); return s; };
const rect = (pts) => (s) => { s.plot.pts = pts; s.ans.streetEdge = 0; s.ans.edgeOv = {}; };
const grow = (r, k) => ({ u: r.u - k, v: r.v - k, w: r.w + 2 * k, d: r.d + 2 * k });
const inside = (p, r) => p[0] > r.u && p[0] < r.u + r.w && p[1] > r.v && p[1] < r.v + r.d;
const edgeD = (p, pts) => Math.min(...pts.map((a, i) => G.distPointSeg(p, a, pts[(i + 1) % pts.length])));
const SHORT = /^Only .* of planting fits around the building, parking and pool: the 3D garden is smaller than the .* % asked\. Try a lower footprint %, fewer cars or a smaller pool\.$/;

// every rule of A-9 + the plan review on one site
function check(site, extras, at) {
  const both = [PC.site.pathStrip(site, extras)].concat(site.seating ? [grow(site.seating, 0.3)] : []);
  const nm = site.northMarker, pts = site.ptsL;
  const treeNo = [grow(site.footprint, 1 + CLR), ...both, ...(site.parking ? [grow(site.parking, CLR)] : []), ...(site.pool ? [grow(site.pool, PC.C.POOL_CLEAR + CLR)] : [])];
  const shrubNo = [grow(site.footprint, 1), ...both, ...(site.parking ? [site.parking] : []), ...(site.pool ? [grow(site.pool, PC.C.POOL_CLEAR)] : [])];
  const all = site.trees.map((t) => [...t, 1]).concat(site.shrubs.map((t) => [...t, 0]));
  for (const [u, v, s, tree] of all) {
    const p = [u, v], k = tree ? 'tree' : 'shrub';
    assert.ok(G.pointInPoly(p, pts), `${at} ${k} inside`);
    assert.ok(edgeD(p, pts) >= (tree ? CLR + 0.2 : 0.7) - 1e-9, `${at} ${k} ${edgeD(p, pts).toFixed(2)} m from the boundary`);
    assert.ok(s >= V.scale[0] && s <= V.scale[1], `${at} ${k} scale`);
    for (const r of tree ? treeNo : shrubNo) assert.ok(!inside(p, r), `${at} ${k} at ${u.toFixed(2)}, ${v.toFixed(2)} in ${JSON.stringify(r)}`);
    if (nm) assert.ok(Math.hypot(u - nm.u, v - nm.v) >= nm.L / 2 + 0.3 - 1e-9, `${at} ${k} clear of the needle`);
  }
  for (let i = 0; i < all.length; i++) for (let j = 0; j < i; j++) {
    const a = all[i], b = all[j], need = a[3] && b[3] ? 2.4 : a[3] || b[3] ? 1.4 : 1.0;
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) >= need - 1e-9, `${at} spacing ${need}`);
  }
  assert.equal(site.vegPlaced, site.trees.length * 6 + site.shrubs.length * 1.5);
  assert.ok(site.trees.length <= 120 && site.shrubs.length <= 200);
}

test('sample: cover within 20 % of veg.area (A-9), trees and shrubs present, 60 % share to trees, every exclusion and spacing rule', () => {
  const s = sample(), site = PC.site.analyse(s);
  assert.ok(Math.abs(site.vegPlaced - site.veg.area) <= 0.2 * site.veg.area, `${site.vegPlaced} vs ${site.veg.area}`);
  assert.ok(site.trees.length > 0 && site.shrubs.length > 0);
  assert.ok(Math.abs(site.trees.length * 6 - 0.6 * site.veg.area) <= 3 + 1e-9, 'trees round to 60 %');
  check(site, s.ans.extras, 'sample');
  assert.equal(PC.validate(s).warnings.length, 0, 'the sample shows no warning (6.2), no veg-short');
});

test('every rule on seeded plots: rectangles, a rotated plot, a pentagon, gates, wall off, pool / parking / seating combinations', () => {
  const plots = [[[0, 0], [30, 0], [30, 40], [0, 40]], [[0, 0], [24, 6], [18, 30], [-4, 26]], [[0, 0], [40, 0], [44, 20], [20, 34], [-4, 20]], [[0, 0], [16, 0], [16, 18], [0, 18]]];
  let n = 0;
  for (const pts of plots) for (const veg of [10, 30, 60]) for (const [cars, pool, seat, gate, wall] of [[2, true, true, 'left', true], [0, false, false, 'right', false], [3, true, true, 'centre', true]]) {
    const s = sample((d) => { rect(pts)(d); d.ans.vegPct = veg; d.ans.footprintPct = Math.min(30, 100 - veg); d.ans.parking.cars = cars; d.ans.pool.on = pool; d.ans.extras = { wall, gate, seating: seat }; });
    const site = PC.site.analyse(s);
    if (!site || !site.footprint) continue;
    check(site, s.ans.extras, `${JSON.stringify(pts[1])} ${veg} %`); n++;
  }
  assert.ok(n >= 30, `${n} sites`);
});

test('deterministic: same state -> deep-equal output, also from separately built states; seed = plot points + street edge only (Q4 keeps the order)', () => {
  const a = PC.site.analyse(sample()); PC.site.clearMemo();
  const b = PC.site.analyse(sample());
  assert.notEqual(a, b); assert.deepEqual(plain(a.trees), plain(b.trees)); assert.deepEqual(plain(a.shrubs), plain(b.shrubs));
  // Q4 change: more vegetation keeps every tree placed before (additions only) while the tree target grows
  const lo = PC.site.analyse(sample((d) => { d.ans.vegPct = 10; })), hi = PC.site.analyse(sample((d) => { d.ans.vegPct = 25; }));
  const has = (list, t) => list.some((x) => x[0] === t[0] && x[1] === t[1]);
  assert.ok(lo.trees.every((t) => has(hi.trees, t)), 'Q4 up: the earlier trees stay');
  assert.equal(PC.scatter.seedOf(lo), PC.scatter.seedOf(hi));
  const other = PC.site.analyse(sample((d) => { d.ans.streetEdge = 1; }));
  assert.notEqual(PC.scatter.seedOf(other), PC.scatter.seedOf(lo), 'the street edge is in the seed');
});

test('caps on 100 x 100 m at 80 %: 120 trees, 200 shrubs, no shortfall warning from the caps; 0 % -> empty and never a warning', () => {
  const big = sample((d) => { rect([[0, 0], [100, 0], [100, 100], [0, 100]])(d); d.ans.footprintPct = 20; d.ans.vegPct = 80; });
  const site = PC.site.analyse(big);
  assert.deepEqual([site.trees.length, site.shrubs.length], [120, 200]);
  check(site, big.ans.extras, '100 x 100');
  assert.ok(!PC.validate(big).warnings.some((w) => w.code === 'veg-short'), 'the caps are not a shortfall');
  const zero = sample((d) => { d.ans.vegPct = 0; }), z = PC.site.analyse(zero);
  assert.deepEqual([plain(z.trees), plain(z.shrubs), z.vegPlaced], [[], [], 0]);
  assert.ok(!PC.validate(zero).warnings.some((w) => w.code === 'veg-short'));
});

test('shortfall (PM round 11): placed < 80 % of veg.area -> veg-short (q 4, warn, exact text), with veg-reduced allowed alongside', () => {
  const s = sample((d) => { d.ans.vegPct = 60; d.ans.footprintPct = 40; }), site = PC.site.analyse(s);
  assert.ok(site.vegPlaced < 0.8 * site.veg.area, `${site.vegPlaced} of ${site.veg.area}`);
  const w = plain(PC.validate(s).warnings).find((x) => x.code === 'veg-short');
  assert.ok(w); assert.equal(w.q, 4); assert.equal(PC.validate.RULES['veg-short'].kind, 'warn'); assert.match(w.text, SHORT);
  const r1 = (x) => Math.round(x * 10) / 10;
  assert.ok(w.text.includes(`Only ${Math.round(site.vegPlaced)} m² (${r1(site.vegPlaced / site.plotArea * 100)} % of the plot)`) && w.text.includes(`the ${r1(site.veg.pct)} % asked`));
  const ft = plain(PC.validate({ ...s, ans: { ...s.ans, unit: 'ft' } }).warnings).find((x) => x.code === 'veg-short');
  assert.match(ft.text, /^Only \d+ sq ft /, 'follows the unit (R4)');
  // the 80 % line: the sample at 50 % places 77 % (warning), at 40 % 96 % (none); 10 % places all of it
  const ratio = (v) => { const x = PC.site.analyse(sample((d) => { d.ans.vegPct = v; })); return x.vegPlaced / x.veg.area; };
  assert.ok(ratio(50) > 0.6 && ratio(50) < 0.8 && ratio(40) >= 0.8, `ratios ${ratio(50)} / ${ratio(40)}`);
  assert.ok(PC.validate(sample((d) => { d.ans.vegPct = 50; })).warnings.some((x) => x.code === 'veg-short'), '77 %: warned');
  for (const v of [10, 40]) assert.ok(!PC.validate(sample((d) => { d.ans.vegPct = v; })).warnings.some((x) => x.code === 'veg-short'), v + ' %: none');
});

test('performance: the 100 x 100 m scatter <= 50 ms and the maximum house build stays inside its 50 ms budget (best of 3)', () => {
  const big = sample((d) => { rect([[0, 0], [100, 0], [100, 100], [0, 100]])(d); d.ans.footprintPct = 20; d.ans.vegPct = 80; });
  const site = PC.site.analyse(big);
  let best = Infinity;
  for (let i = 0; i < 3; i++) { const t0 = performance.now(); PC.scatter.vegetation(site, big.ans.extras); best = Math.min(best, performance.now() - t0); }
  assert.ok(best <= 50, `scatter ${best.toFixed(1)} ms`);
  const m = maxHouse(PC); PC.house.build(m);
  let hb = Infinity;
  for (let i = 0; i < 3; i++) { PC.site.clearMemo(); const t0 = performance.now(); PC.house.build(m); hb = Math.min(hb, performance.now() - t0); }
  assert.ok(hb < 50, `maximum house ${hb.toFixed(1)} ms with the site and the scatter`);
  assert.ok(PC.house.build(sampleApproved(PC)).site.trees.length > 0);
});

test('clearances come from PC.data.vegetation (TL item 1): a larger canopy in the table moves trees further from the boundary and the building', () => {
  const P2 = loadCore();
  P2.data.vegetation.tree.canopyR = 2.0;
  const clr = 2.0 * P2.data.vegetation.scale[1], s = plain(P2.sample.state()), site = P2.site.analyse(s), fp = site.footprint;
  assert.ok(site.trees.length > 0);
  for (const [u, v] of site.trees) {
    assert.ok(edgeD([u, v], site.ptsL) >= clr + 0.2 - 1e-9, 'boundary from the table');
    assert.ok(!inside([u, v], grow(fp, 1 + clr)), 'footprint clearance from the table');
  }
  assert.ok(PC.site.analyse(sample()).trees.some(([u, v]) => edgeD([u, v], PC.site.analyse(sample()).ptsL) < clr + 0.2), 'the default table places trees closer');
});

test('candidate memo (TL F4-T3 implementation review 7): keyed on the seed text, reused across a footprint % change, frozen, output unchanged', () => {
  const P = loadCore(), S = (f) => { const s = plain(P.sample.state()); if (f) f(s); return s; };
  const a = P.site.analyse(S((d) => { d.ans.footprintPct = 25; })), h0 = P.scatter.memo().hits;
  const c1 = P.scatter.candidates(a);
  const b = P.site.analyse(S((d) => { d.ans.footprintPct = 30; }));
  assert.notEqual(a, b, 'a new site (memo miss in PC.site)');
  assert.equal(P.scatter.candidates(b), c1, 'same frozen candidate array reused');
  assert.ok(P.scatter.memo().hits >= h0 + 2, 'the footprint change hit the candidate memo');
  assert.equal(P.scatter.memo().key, P.scatter.seedText(b), 'keyed on the full seed text, not the 32-bit hash');
  assert.ok(Object.isFrozen(c1) && Object.isFrozen(c1[0]));
  // byte-identical to a fresh build (no memo) for both states
  for (const st of [S((d) => { d.ans.footprintPct = 25; }), S((d) => { d.ans.footprintPct = 30; })]) {
    const fresh = loadCore(), x = fresh.site.analyse(st), y = P.site.analyse(st);
    assert.equal(JSON.stringify([y.trees, y.shrubs, y.vegPlaced]), JSON.stringify([x.trees, x.shrubs, x.vegPlaced]));
  }
  // another plot or street edge: a new key
  const e = P.site.analyse(S((d) => { d.ans.streetEdge = 1; }));
  assert.notEqual(P.scatter.candidates(e), c1); assert.equal(P.scatter.memo().key, P.scatter.seedText(e));
});
