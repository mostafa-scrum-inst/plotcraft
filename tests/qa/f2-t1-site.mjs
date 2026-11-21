// F2-T1 QA: the pure site model (PC.levels, PC.site, PC.validate, PC.sig, the R5 gate) checked in node against QA's
// own reference model (f2-t1-ref.mjs). Run: node tests/qa/f2-t1-site.mjs   (--no-shots is accepted and ignored)
import { collector } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';

const R = collector('F2-T1 site');
const PC = Q.loadPC();
// Round 4 (CD-1, A-6 step 4b): the app announces the 3:1 stretch with PC.C.FOOTPRINT_STRETCH_RATIO. My model follows the
// rule the build claims; without the marker every expectation is the round-3 one.
const STRETCH = PC.C.FOOTPRINT_STRETCH_RATIO !== undefined; Q.setStretch(STRETCH);
// F3-T1 markers: the corrected long-side cap (A-6 step 8, CTO F2 review) and the layout module (parking / pool fix hints).
const CAPX = PC.C.FOOTPRINT_STRETCH_EXTRA !== undefined; Q.setCapExtra(CAPX);
const LAYOUT = typeof PC.layout === 'object';
const hintProblems = Q.hintProblems;   // parking / pool fix hints (PM round 5), see f2-t1-ref.mjs
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const obs = [];
// Open minor bugs (docs/03-tasks/F2-T1/qa-report.md) would be listed here as R.known entries. None open: bugs 1 and 2 were
// fixed in F2-T2 round 2 and are now asserted directly (section 3 "bug 1" checks, section 7 pool-omitted wording).                                             // "correct by the rules, but would surprise an architect"

// ---------- state builders ----------
const SAMPLE = [[0, 0], [20, 0], [20, 30], [8, 30], [0, 26]];
function mk(pts, ans = {}, edge = null) { const s = Q.plain(PC.store.defaults()); s.plot = { pts: Q.ccw(pts), closed: true }; Object.assign(s.ans, Q.plain(ans)); s.ans.streetEdge = edge === null ? Q.defaultStreetEdge(s.plot.pts) : edge; return s; }
const sample = () => Q.plain(PC.sample.state());
const analyse = (s) => { PC.site.clearMemo(); return PC.site.analyse(s); };
const rot = (pts, deg, c = [50, 50]) => { const r = deg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r); return pts.map((p) => [c[0] + (p[0] - c[0]) * cs - (p[1] - c[1]) * sn, c[1] + (p[0] - c[0]) * sn + (p[1] - c[1]) * cs]); };
const shift = (pts, dx, dy) => pts.map((p) => [p[0] + dx, p[1] + dy]);
const rect = (w, h, x = 0, y = 0) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
// QA's own view of a state: frame L, classes, setbacks, lattice figures.
function ref(s) { const e = s.ans.streetEdge, pL = Q.toL(s.plot.pts, e), cls = Q.edgeClasses(pL, e), sb = Q.setbacksOf(cls, s.ans.setbacks); return { e, pL, cls, sb, area: Math.abs(Q.signedArea(pL)) }; }

// ================= 1. the 6.2 sample, figure by figure =================
{ const s = sample(), site = analyse(s), r = ref(s), lat = Q.latticeBuildable(r.pL, r.sb), fp = site.footprint;
  R.check('1 sample: plot 584 m², perimeter 96.94 m', near(site.plotArea, 584) && near(site.perimeter, 96.944, 1e-3) && near(r.area, 584) ? [] : [`${site.plotArea} ${site.perimeter}`]);
  R.check('1 sample: edge classes front / side / back / back / side (mine and the app)', eq(Q.plain(site.edgeClass), ['front', 'side', 'back', 'back', 'side']) && eq(r.cls, ['front', 'side', 'back', 'back', 'side']) ? [] : [JSON.stringify(site.edgeClass)]);
  R.check('1 sample: angled edge is 26.6 degrees off straight back', near(Q.edgeAngle(r.pL, 3), 26.565, 0.01) ? [] : [String(Q.edgeAngle(r.pL, 3))]);
  R.check('1 sample: buildable bounding box u 2-18, v 3-28 (mine and the app)', eq(Q.plain(site.buildable.bbox), { u0: 2, v0: 3, u1: 18, v1: 28 }) && eq(lat.bbox, { u0: 2, v0: 3, u1: 18, v1: 28 }) ? [] : [JSON.stringify(site.buildable.bbox)]);
  // exact area by hand: 16 x 25 minus the corner cut by the angled setback line
  R.check('1 sample: buildable area about 390 m² (389.5 +/- 1.5) and equal to my lattice count', Math.abs(site.buildable.area - 389.5) <= 1.5 && near(site.buildable.area, lat.area, 1e-6) ? [] : [`${site.buildable.area} vs ${lat.area}`]);
  R.check('1 sample: footprint exactly 9.5 x 15 m at u 5.25, v 8; 142.5 m²; 24.4 %; not clamped, not moved', fp && eq([fp.u, fp.v, fp.w, fp.d, fp.area, fp.clamped, fp.moved], [5.25, 8, 9.5, 15, 142.5, false, false]) && near(fp.pct, 142.5 / 584 * 100, 1e-9) && fp.pct.toFixed(1) === '24.4' ? [] : [JSON.stringify(fp)]);
  R.check('1 sample: my arithmetic gives the same size (146 m² target, 16:25)', eq(Q.targetSize(0.25 * 584, 16 / 25), [9.5, 15]));
  R.check('1 sample: footprint lies in the buildable set (my exact test and my sampled test)', Q.rectBuildable(fp, r.pL, r.sb) && Q.rectBuildableSampled(fp, r.pL, r.sb) ? [] : ['outside']);
  R.check('1 sample: needed 120 of 142.5 m² on both levels (mine and PC.levels)', eq(['G', '1'].map((id) => [Q.needed(s.ans, id), PC.levels.needed(s, id)]), [[120, 120], [120, 120]]));
  R.check('1 sample: parking 2 cars = 5 x 5 m at u 11-16, v 0.5-5.5, covered', eq(Q.plain(site.parking), { u: 11, v: 0.5, w: 5, d: 5, cars: 2, covered: true }) ? [] : [JSON.stringify(site.parking)]);
  R.check('1 sample: pool S 6 x 3 m centred behind the house at u 7, v 24', eq(Q.plain(site.pool), { u: 7, v: 24, w: 6, d: 3 }) ? [] : [JSON.stringify(site.pool)]);
  R.check('1 sample: vegetation 146 m² = 25 %, not reduced; nothing omitted', near(site.veg.area, 146) && near(site.veg.pct, 25) && !site.veg.reduced && site.omitted.length === 0 ? [] : [JSON.stringify(site.veg)]);
  R.check('1 sample: area budget 142.5 + 146 + 25 + 18 = 331.5 <= 584', near(fp.area + site.veg.area + 25 + 18, 331.5));
  const v = PC.validate(s); R.check('1 sample: no blocking conflict and no warning', v.blocking.length === 0 && v.warnings.length === 0 ? [] : [JSON.stringify([v.blocking, v.warnings])]);
  R.check('1 sample: summary figures', v.summary && near(v.summary.plotArea, 584) && near(v.summary.footprintArea, 142.5) && near(v.summary.vegArea, 146) && eq(Q.plain(v.summary.levels).map((l) => [l.id, l.needed, l.available]), [['G', 120, 142.5], ['1', 120, 142.5]]) ? [] : [JSON.stringify(v.summary)]);
  // rotated and shifted copies give the same model in frame L
  for (const [name, pts] of [['rotated 30 degrees', rot(shift(SAMPLE, 40, 35), 30)], ['rotated 117 degrees', rot(shift(SAMPLE, 40, 35), 117)], ['shifted', shift(SAMPLE, 61.5, 44.5)], ['rotated 180 degrees', rot(shift(SAMPLE, 40, 35), 180)]]) {
    const s2 = sample(); s2.plot.pts = pts; s2.ans.streetEdge = 0; const t = analyse(s2), f2 = t.footprint;
    R.check(`1 sample ${name}: same classes, footprint, parking, pool, vegetation in frame L`, eq(Q.plain(t.edgeClass), ['front', 'side', 'back', 'back', 'side']) && f2 && [f2.u - 5.25, f2.v - 8, f2.w - 9.5, f2.d - 15].every((x) => Math.abs(x) < 1e-6) && t.parking && near(t.parking.u, 11, 1e-6) && t.pool && near(t.pool.u, 7, 1e-6) && near(t.pool.v, 24, 1e-6) && near(t.veg.area, 146, 1e-6) && PC.validate(s2).blocking.length === 0 ? [] : [JSON.stringify([f2, t.parking, t.pool])]);
  }
}

// ================= 2. reference self-test: my exact rectangle test agrees with brute-force sampling =================
{ let bad = 0, n = 0, seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const L = Q.ccw([[0, 0], [30, 0], [30, 12], [14, 12], [14, 34], [0, 34]]), sb = Q.setbacksOf(Q.edgeClasses(L, 0), { front: 3, back: 2, side: 2 });
  for (let i = 0; i < 400; i++) { const r = { u: rnd() * 28, v: rnd() * 32, w: 0.5 + rnd() * 12, d: 0.5 + rnd() * 12 }; n++; if (Q.rectBuildable(r, L, sb) !== Q.rectBuildableSampled(r, L, sb, 0.1)) { const g = { u: r.u - 0.02, v: r.v - 0.02, w: r.w + 0.04, d: r.d + 0.04 }, k = { u: r.u + 0.02, v: r.v + 0.02, w: r.w - 0.04, d: r.d - 0.04 }; if (Q.rectBuildable(g, L, sb) === Q.rectBuildable(k, L, sb)) bad++; } }
  R.check(`2 QA reference: exact rectangle test = sampled test on ${n} random rectangles (except within 2 cm of the limit)`, bad === 0 ? [] : [`${bad} disagreements`]);
}

// ================= 3. generated plots: footprint properties =================
const PLOTS = {
  'rect 20x30': rect(20, 30), 'rect 30x20': rect(30, 20), 'square 20': rect(20, 20), 'rect 40x25': rect(40, 25), 'rect 15x45': rect(15, 45), 'thin 10x50': rect(10, 50), 'wide 50x10': rect(50, 10),
  'tiny 7x7.5': rect(7, 7.5), 'tiny 8x8': rect(8, 8), 'small 9x12': rect(9, 12), 'strip 6.5x60': rect(6.5, 60), 'big 100x100': rect(100, 100),
  sample: SAMPLE, 'trapezoid slanted street': [[0, 0], [30, 6], [30, 30], [0, 30]], triangle: [[0, 0], [40, 0], [20, 35]], 'thin triangle': [[0, 0], [60, 0], [30, 12]],
  pentagon: [[5, 0], [30, 0], [38, 18], [18, 34], [0, 16]], hexagon: [[10, 0], [30, 0], [40, 17], [30, 34], [10, 34], [0, 17]],
  'rect 20x30 rotated 15': rot(rect(20, 30, 40, 35), 15), 'rect 20x30 rotated 45': rot(rect(20, 30, 40, 35), 45), 'pentagon rotated 73': rot(shift([[5, 0], [30, 0], [38, 18], [18, 34], [0, 16]], 30, 30), 73),
  'L (TL): 40x12 arm + 14x40 arm': [[0, 0], [40, 0], [40, 12], [14, 12], [14, 40], [0, 40]], 'L mirrored': [[0, 0], [40, 0], [40, 40], [26, 40], [26, 12], [0, 12]], 'L arm at the back': [[0, 0], [14, 0], [14, 28], [40, 28], [40, 40], [0, 40]],
  'L small 24x24': [[0, 0], [24, 0], [24, 10], [10, 10], [10, 24], [0, 24]],
  'U open to the back': [[0, 0], [40, 0], [40, 40], [28, 40], [28, 12], [12, 12], [12, 40], [0, 40]], 'U open to the street': [[0, 0], [12, 0], [12, 28], [28, 28], [28, 0], [40, 0], [40, 40], [0, 40]],
  'T shape': [[14, 0], [26, 0], [26, 24], [40, 24], [40, 40], [0, 40], [0, 24], [14, 24]], 'notch at the street': [[0, 0], [12, 0], [12, 8], [22, 8], [22, 0], [36, 0], [36, 30], [0, 30]],
  'comb 3 teeth': [[0, 0], [50, 0], [50, 40], [40, 40], [40, 12], [30, 12], [30, 40], [20, 40], [20, 12], [10, 12], [10, 40], [0, 40]],
  'comb 100x100': [[0, 0], [100, 0], [100, 100], [80, 100], [80, 20], [60, 20], [60, 100], [40, 100], [40, 20], [20, 20], [20, 100], [0, 100]],
  'star 12': [[50, 2], [61, 32], [95, 30], [70, 52], [88, 85], [58, 68], [50, 98], [42, 68], [12, 85], [30, 52], [5, 30], [39, 32]],
  'star rotated 20': rot([[50, 8], [59, 34], [88, 32], [67, 51], [82, 80], [57, 65], [50, 90], [43, 65], [18, 80], [33, 51], [12, 32], [41, 34]], 20),
  'L rotated 33': rot(shift([[0, 0], [40, 0], [40, 12], [14, 12], [14, 40], [0, 40]], 30, 30), 33),
};
const SB = { default: { front: 3, back: 2, side: 2 }, zero: { front: 0, back: 0, side: 0 }, wide: { front: 6, back: 5, side: 4 }, mixed: { front: 1, back: 5, side: 3 } };
const SLOW_REF = new Set(['L (TL): 40x12 arm + 14x40 arm', 'L mirrored', 'L arm at the back', 'L small 24x24', 'U open to the back', 'U open to the street', 'T shape', 'notch at the street', 'comb 3 teeth', 'L rotated 33']);
let cases = 0, worst = [0, ''], fallbackCases = 0, refChecked = 0, tally4b = 0; const convexMoved = []; const tally = { 'buildable-small': 0, 'no-fit': 0, clamped: 0, moved: 0, plain: 0 };
for (const [name, raw] of Object.entries(PLOTS)) for (const [sbName, sb] of Object.entries(SB)) for (const pct of (name.includes('100x100') || name.startsWith('star') ? [25, 80] : [10, 25, 30, 50, 80])) {
  const s = mk(raw, { setbacks: sb, footprintPct: pct, vegPct: 0, parking: { cars: 0, covered: false } }), T = `3 ${name} / setbacks ${sbName} / ${pct} %`; cases++;
  const t0 = process.hrtime.bigint(), site = analyse(s), ms = Number(process.hrtime.bigint() - t0) / 1e6; if (ms > worst[0]) worst = [ms, T];
  const r = ref(s), pr = [];
  if (!eq(Q.plain(site.edgeClass), r.cls)) pr.push(`edge classes ${JSON.stringify(site.edgeClass)} vs mine ${JSON.stringify(r.cls)}`);
  if (!near(site.plotArea, r.area, 1e-6)) pr.push(`plot area ${site.plotArea} vs ${r.area}`);
  const big = r.area > 4000; const lat = big && sbName !== 'default' ? null : Q.latticeBuildable(r.pL, r.sb);
  if (lat) { if (!eq(Q.plain(site.buildable.bbox), lat.bbox)) pr.push(`buildable bbox ${JSON.stringify(site.buildable.bbox)} vs mine ${JSON.stringify(lat.bbox)}`); if (!near(site.buildable.area, lat.area, 1e-6)) pr.push(`buildable area ${site.buildable.area} vs mine ${lat.area}`); if (site.buildable.ok !== (lat.area >= 20 - 1e-9)) pr.push('buildable.ok wrong'); }
  const v = PC.validate(s), codes = v.blocking.map((b) => b.code), fp = site.footprint, A = pct / 100 * r.area;
  if (!site.buildable.ok) { tally['buildable-small']++; if (fp || !codes.includes('buildable-small') || codes.includes('no-fit')) pr.push('buildable < 20 m² must give no footprint and the buildable-small conflict only'); }
  else if (!fp) { tally['no-fit']++; if (!site.noFit || !codes.includes('no-fit')) pr.push('no footprint without the no-fit conflict');
    if (STRETCH && lat && !big) { const w4 = Q.refFootprint(r.pL, r.sb, pct, lat); if (!w4.conflict) pr.push(`no-fit, but my model (with step 4b) finds ${w4.w} x ${w4.d} m`); }
    // nothing of 20 m² may fit: try the three proportions at every 0.5 m centre with my own test (20 m² rectangles)
    if (lat && !big) { const bb = lat.bbox; outer: for (const rr of [Math.max(0.5, Math.min(2, (bb.u1 - bb.u0) / ((bb.v1 - bb.v0) || 1e-9))), 0.5, 2]) { const [w0, d0] = Q.targetSize(A, rr); for (let vv = bb.v0; vv <= bb.v1; vv += 0.5) for (let uu = bb.u0; uu <= bb.u1; uu += 0.5) { const k = Q.shrinkAt([uu, vv], w0, d0, r.pL, r.sb); if (k && k.w * k.d >= 20 - 1e-9) { pr.push(`no-fit, but ${k.w} x ${k.d} m fits at (${uu}, ${vv})`); break outer; } } } } }
  else {
    if (codes.includes('buildable-small') || codes.includes('no-fit')) pr.push('footprint present together with a 20 m² conflict');
    if (!Q.rectBuildable(fp, r.pL, r.sb)) pr.push(`footprint ${JSON.stringify(fp)} is not inside the buildable set (exact test)`);
    if (!Q.rectBuildableSampled(fp, r.pL, r.sb, 0.25, 1e-5)) pr.push('footprint is not inside the buildable set (sampled test)');
    if (!near(fp.area, fp.w * fp.d, 1e-9) || !near(fp.pct, fp.area / r.area * 100, 1e-6)) pr.push('area / pct inconsistent');
    if (fp.area > A + 1e-6) pr.push(`footprint ${fp.area} m² is above the target ${A.toFixed(2)} m²`);
    if (fp.area < 20 - 1e-9) pr.push('footprint under 20 m²');
    for (const x of [fp.w, fp.d]) if (!near(x * 2, Math.round(x * 2), 1e-9) || x < 0.5) pr.push(`side ${x} is not a multiple of 0.5 m`);
    // With the marker: my model (step 4b included) on every lattice case; where 4b ran the 2:1 property checks below do not
    // apply and the result must equal mine exactly (size, centre, clamped, reason, warning wording).
    const w4 = STRETCH && lat && !big ? Q.refFootprint(r.pL, r.sb, pct, lat) : null, ran4b = !!(w4 && w4.ran4b), lenient = STRETCH && !w4;
    if (w4) { if (w4.conflict) pr.push(`my model says ${w4.conflict}, the app gives ${fp.w} x ${fp.d}`);
      else { if (!near(fp.w, w4.w) || !near(fp.d, w4.d) || !near(fp.u + fp.w / 2, w4.centre[0], 1e-6) || !near(fp.v + fp.d / 2, w4.centre[1], 1e-6)) pr.push(`app ${fp.w} x ${fp.d} at (${fp.u + fp.w / 2}, ${fp.v + fp.d / 2}), my model ${w4.w} x ${w4.d} at (${w4.centre})${ran4b ? ' after step 4b' : ''}`);
        if (fp.clamped !== w4.clamped) pr.push(`clamped ${fp.clamped} vs mine ${w4.clamped}${ran4b ? ' (after 4b)' : ''}`);
        if (w4.clamped && fp.reason !== w4.reason && ran4b) pr.push(`reason ${fp.reason} vs mine ${w4.reason}`);
        const cw = v.warnings.find((x) => x.code === 'fp-clamped'); if (cw && ran4b && w4.reason === 'proportion' && !/at most 3 times as long/.test(cw.text)) pr.push('proportion reason without the 3:1 wording: ' + cw.text);
        if (cw && ran4b && w4.reason === 'setbacks' && /3 times/.test(cw.text)) pr.push('setbacks reason with the 3:1 wording'); } }
    // long-side cap per candidate kind (A-6 step 8): step-4 results 2 x (short + 0.5); 4b candidates 3 x short + 0.5 with the
    // F3-T1 marker, 3 x (short + 0.5) before it
    const lim = ran4b ? (w4.kind === 'step4' ? 2 : 3) : lenient ? 3 : 2, bound = Q.capOf(lim, Math.min(fp.w, fp.d));
    if (Math.max(fp.w, fp.d) > bound + 1e-9) pr.push(`proportions ${fp.w} x ${fp.d}: long side over the ${lim === 2 ? '2:1' : '4b'} cap ${bound} m`);
    if (!(ran4b || (lenient && fp.clamped !== undefined && (Math.max(fp.w, fp.d) > 2 * (Math.min(fp.w, fp.d) + 0.5) + 1e-9 || !fp.clamped)))) {
    const bb = site.buildable.bbox, c = [(bb.u0 + bb.u1) / 2, (bb.v0 + bb.v1) / 2], rb = Math.max(0.5, Math.min(2, (bb.u1 - bb.u0) / (bb.v1 - bb.v0)));
    const full = [rb, 0.5, 2].map((x) => Q.targetSize(A, x)), isFull = full.some(([w, d]) => near(fp.w, w) && near(fp.d, d));
    if (!fp.clamped && !isFull) pr.push(`not clamped, yet ${fp.w} x ${fp.d} is smaller than rounding explains (targets ${JSON.stringify(full)})`);
    if (fp.clamped && full.some(([w, d]) => fp.w * fp.d >= w * d - 1e-9) && isFull) pr.push('clamped although it has the full rounded size');
    if (!fp.moved) { if (!near(fp.u + fp.w / 2, c[0], 1e-6) || !near(fp.v + fp.d / 2, c[1], 1e-6)) pr.push('not moved, but not centred on the buildable bounding box');
      const [w0, d0] = full[0]; if (!fp.clamped && !(near(fp.w, w0) && near(fp.d, d0))) pr.push(`centred and unclamped must use the bounding-box proportions (${w0} x ${d0}), got ${fp.w} x ${fp.d}`);
      if (fp.clamped) { const g = { w: fp.w + 0.5, d: fp.d + 0.5 }; if (Q.rectBuildable({ u: c[0] - g.w / 2, v: c[1] - g.d / 2, w: g.w, d: g.d }, r.pL, r.sb)) pr.push(`clamped to ${fp.w} x ${fp.d}, but ${g.w} x ${g.d} still fits about the same centre`);
        // centred and clamped: at least as large as the best centred rectangle of the three allowed proportions when the first keeps under half the target
        const cen = full.map(([w, d]) => Q.shrinkAt(c, w, d, r.pL, r.sb)), first = cen[0]; const bestC = first && first.t * first.t * w0 * d0 >= A / 2 ? first.w * first.d : Math.max(...cen.map((k) => (k ? k.w * k.d : 0)));
        if (fp.area < bestC - 1e-6) pr.push(`centred result ${fp.area} m² is smaller than the ${bestC} m² the rules give at the same centre`); } }
    else { fallbackCases++; if (!SLOW_REF.has(name) && !/^(L|U|T|comb|star|notch)/.test(name)) convexMoved.push(`${name} / ${sbName} / ${pct} %: ${fp.w} x ${fp.d} at u ${fp.u}, v ${fp.v}`); }
    } else if (ran4b) tally4b++;
    if (fp.clamped !== v.warnings.some((w) => w.code === 'fp-clamped')) pr.push('fp-clamped warning does not follow footprint.clamped');
    tally[fp.moved ? 'moved' : fp.clamped ? 'clamped' : 'plain']++;
    // full reference search on the concave plots: same area as my exhaustive three-proportion search
    if (SLOW_REF.has(name) && lat) { const want = Q.refFootprint(r.pL, r.sb, pct, lat); refChecked++;
      if (want.conflict) pr.push(`my reference says ${want.conflict}, the app gives ${fp.w} x ${fp.d}`);
      else { if (!near(fp.area, want.area, 1e-6)) pr.push(`area ${fp.area} m² (${fp.w} x ${fp.d}) differs from my exhaustive search ${want.area} m² (${want.w} x ${want.d} at ${want.centre})`); if (fp.clamped !== want.clamped) pr.push(`clamped ${fp.clamped} vs mine ${want.clamped}`); if (near(fp.area, want.area, 1e-6) && (!near(fp.u + fp.w / 2, want.centre[0], 1e-6) || !near(fp.v + fp.d / 2, want.centre[1], 1e-6))) pr.push(`same area but centre (${fp.u + fp.w / 2}, ${fp.v + fp.d / 2}) instead of the nearest-to-centre (${want.centre})`); } }
    if (!fp.clamped && fp.area < A * 0.8) obs.push(`${name}, setbacks ${sbName}, footprint ${pct} %: asked ${A.toFixed(1)} m², got ${fp.w} x ${fp.d} = ${fp.area} m² (${fp.pct.toFixed(1)} %) with no warning (0.5 m rounding only)`);
  }
  // determinism
  const again = analyse(s); if (!eq(Q.plain({ f: again.footprint, b: again.buildable, c: again.edgeClass }), Q.plain({ f: site.footprint, b: site.buildable, c: site.edgeClass }))) pr.push('second analysis differs');
  R.check(T, pr);
}
// F2-T1 bug 1 (fixed in F2-T2 round 2): the fallback also runs when the centred result rounds under 20 m². The named case
// first, then every generated case in the bug's reach (target under 40 m²) against my exhaustive reference.
{ const s = mk(PLOTS['thin triangle'], { setbacks: SB.mixed, footprintPct: 10, vegPct: 0, parking: { cars: 0, covered: false } }), site = analyse(s), r = ref(s), fp = site.footprint;
  const want = Q.refFootprint(r.pL, r.sb, 10, Q.latticeBuildable(r.pL, r.sb)), codes = PC.validate(s).blocking.map((b) => b.code), pr = [];
  if (want.conflict) pr.push('my reference finds no footprint'); if (!fp) pr.push('app: no footprint'); if (codes.includes('no-fit')) pr.push('no-fit still shown');
  if (fp && !want.conflict) { if (!near(fp.area, want.area, 1e-6) || !near(fp.u + fp.w / 2, want.centre[0], 1e-6) || !near(fp.v + fp.d / 2, want.centre[1], 1e-6)) pr.push(`app ${fp.w} x ${fp.d} at (${fp.u + fp.w / 2}, ${fp.v + fp.d / 2}), mine ${want.w} x ${want.d} at (${want.centre})`); if (fp.area < 20 || fp.area > 36 + 1e-9 || !Q.rectBuildable(fp, r.pL, r.sb) || !Q.rectBuildableSampled(fp, r.pL, r.sb, 0.1)) pr.push(`footprint ${JSON.stringify(fp)} not 20-36 m² inside the buildable set`); }
  R.check(`3 bug 1 fixed: thin triangle, setbacks 1/5/3, 10 % (target 36 m²) gets ${fp ? fp.w + ' x ' + fp.d + ' = ' + fp.area + ' m²' : 'nothing'}, equal to my search, no no-fit`, pr);
  let n = 0; const bad = [];
  for (const [name, raw] of Object.entries(PLOTS)) for (const [sbName, sb] of Object.entries(SB)) for (const pct of [10, 25]) {
    const t = mk(raw, { setbacks: sb, footprintPct: pct, vegPct: 0, parking: { cars: 0, covered: false } }), rt = ref(t); if (pct / 100 * rt.area >= 40 || rt.area > 4000) continue;
    const lat = Q.latticeBuildable(rt.pL, rt.sb), w = Q.refFootprint(rt.pL, rt.sb, pct, lat), st = analyse(t), f = st.footprint; n++;
    const app = !st.buildable.ok ? 'buildable-small' : f ? `${f.w}x${f.d}@${f.u + f.w / 2},${f.v + f.d / 2}` : 'no-fit', mine = w.conflict || `${w.w}x${w.d}@${w.centre[0]},${w.centre[1]}`;
    if (!(app === mine || (f && !w.conflict && near(f.area, w.area, 1e-6) && near(f.u + f.w / 2, w.centre[0], 1e-6) && near(f.v + f.d / 2, w.centre[1], 1e-6)))) bad.push(`${name} / ${sbName} / ${pct} %: app ${app}, mine ${mine}`); }
  R.check(`3 bug 1 reach: all ${n} generated cases with a target under 40 m² equal my exhaustive search (footprint or conflict)`, n >= 10 ? bad : bad.concat([`only ${n} cases`])); }
R.check(`3 generator covered every outcome (cases ${cases}: ${JSON.stringify(tally)}; fallback ${fallbackCases}; exhaustive reference on ${refChecked}${STRETCH ? `; step 4b ran in ${tally4b}` : ''})`, Object.values(tally).every((n) => n > 0) && fallbackCases > 5 && refChecked > 50 && (!STRETCH || tally4b > 10) ? [] : [JSON.stringify(tally), 'step 4b ' + tally4b]);
R.note(STRETCH ? 'round-4 branch: PC.C.FOOTPRINT_STRETCH_RATIO present, step 4b expected' : 'round-3 branch: no stretch marker, 2:1 expectations');
R.note(`F3-T1 markers: corrected cap ${CAPX ? 'present' : 'absent'}, PC.layout ${LAYOUT ? 'present (fix hints expected)' : 'absent'}`);
// ================= 3b. A-6 step 4b: the PM / CTO / TL examples (3.1, F2-S3; TL answer 1) =================
// Each row: plot, street edge, %, then [round-3 result from my model, round-4 result from the PM text]: w, d, clamped, wording.
for (const [name, pts, pct, r3, r4] of [
  ['10 x 50 m at 20 % (PM: 6 x 16.5 = 99 m², not clamped, no warning)', rect(10, 50), 20, [6, 12, true, 'setbacks'], [6, 16.5, false, null]],
  ['10 x 50 m at 24 % (PM: 6 x 18.5 = 111 m², the 1:3 try, proportion wording)', rect(10, 50), 24, [6, 12, true, 'setbacks'], [6, 18.5, true, 'proportion']],
  ['10 x 50 m at 30 % (PM: 6 x 18 = 108 m², 21.6 %, proportion wording)', rect(10, 50), 30, [6, 12, true, 'setbacks'], [6, 18, true, 'proportion']],
  ['50 x 10 m at 30 %, street on the 50 m edge (PM: 15 x 5 = 75 m²)', rect(50, 10), 30, [10, 5, true, 'setbacks'], [15, 5, true, 'proportion']],
  ['20 x 30 m at 80 % (PM: 16 x 24.5 = 392 m², setbacks wording, the 3:1 try gives only 200 m²)', rect(20, 30), 80, [16, 24.5, true, 'setbacks'], [16, 24.5, true, 'setbacks']],
  ['10 x 20 m at 50 %, buildable 6 x 15 m (TL: 6 x 15 = 90 m²)', rect(10, 20), 50, [6, 12, true, 'setbacks'], [6, 15, true, 'setbacks']]]) {
  const want = STRETCH ? r4 : r3;
  for (const unit of ['m', 'ft']) {
    const s = mk(pts, { footprintPct: pct, vegPct: 0, parking: { cars: 0, covered: false }, pool: { on: false, size: 'S' } }, 0); s.ans.unit = unit; s.ans.rooms = [{ id: 'r1', type: 'storage', level: 'G', size: 'S', area: null, master: false }]; s.ans.floors = 1;
    const fp = analyse(s).footprint, r = ref(s), mine = Q.refFootprint(r.pL, r.sb, pct, Q.latticeBuildable(r.pL, r.sb)), w = PC.validate(s).warnings.find((x) => x.code === 'fp-clamped'), pr = [];
    if (!eq([mine.w, mine.d, mine.clamped], want.slice(0, 3))) pr.push(`my model gives ${mine.w} x ${mine.d} clamped ${mine.clamped} (the documents say ${want.slice(0, 3)})`);
    if (!fp || !eq([fp.w, fp.d, fp.clamped], want.slice(0, 3))) pr.push(`app gives ${fp ? `${fp.w} x ${fp.d} clamped ${fp.clamped}` : 'no footprint'}`);
    if (!want[2] && w) pr.push('warning shown: ' + w.text);
    if (want[2] && !w) pr.push('no clamped warning');
    if (w) { if (!w.text.includes(Q.fmtArea(want[0] * want[1], unit))) pr.push(`warning lacks ${Q.fmtArea(want[0] * want[1], unit)}: ${w.text}`);
      if (STRETCH && want[3] === 'proportion' && !(/at most 3 times as long as it is wide/.test(w.text) && !/footprint %/.test(w.text))) pr.push('not the proportion wording: ' + w.text);
      if (want[3] === 'setbacks' && !/reduced to fit inside the setbacks/.test(w.text)) pr.push('not the setbacks wording: ' + w.text);
      if (STRETCH && want[3] === 'proportion' && fp && fp.reason !== 'proportion') pr.push('reason ' + fp.reason); }
    R.check(`3b ${STRETCH ? 'round 4' : 'round 3'}: ${name} (${unit})`, pr);
  }
}
R.check(`3 performance: slowest analysis ${worst[0].toFixed(0)} ms (${worst[1]}) is under 500 ms`, worst[0] < 500 ? [] : ['too slow']);
R.note(`generated plots: ${cases} cases, outcomes ${JSON.stringify(tally)}, slowest ${worst[0].toFixed(0)} ms`);
// the two named results of the CTO decision
{ const s = mk(PLOTS['L (TL): 40x12 arm + 14x40 arm'], { footprintPct: 25 }), fp = analyse(s).footprint; R.check('3 TL L-shape at 25 %: at least 180 m² (10 x 20.5 expected), fallback moved it', fp && fp.area >= 180 && fp.moved ? [] : [JSON.stringify(fp)]); R.note(`TL L-shape: ${fp.w} x ${fp.d} = ${fp.area} m² at u ${fp.u}, v ${fp.v}, clamped ${fp.clamped}`);
  const u = mk(PLOTS['U open to the back'], { footprintPct: 30 }), fu = analyse(u).footprint; R.note(`U-shape 40x40: ${fu.w} x ${fu.d} = ${fu.area} m², clamped ${fu.clamped}, moved ${fu.moved}`); }

// ================= 4. edge classes at the 40 degree limit =================
for (const [deg, want] of [[0, 'back'], [25, 'back'], [39, 'back'], [40, 'back'], [41, 'side'], [60, 'side'], [90, 'side']]) {
  // a quadrilateral whose top edge is tilted by `deg` from parallel to the street
  const t = Math.tan(deg * Math.PI / 180), W = 20, pts = deg === 90 ? [[0, 0], [20, 0], [20, 30], [0, 30]] : [[0, 0], [W, 0], [W, 20], [0, 20 + W * t]];
  if (pts.some((p) => p[1] > 100)) continue; const s = mk(pts, {}, 0), site = analyse(s), i = deg === 90 ? 1 : 2, a = Q.edgeAngle(Q.toL(s.plot.pts, 0), i);
  R.check(`4 edge tilted ${deg} degrees from "straight back" is a ${want} edge and takes the ${want} setback`, near(a, deg, 1e-6) && site.edgeClass[i] === want && site.setbackOf[i] === s.ans.setbacks[want] ? [] : [`angle ${a} class ${site.edgeClass[i]}`]);
}
{ const s = mk(rect(20, 30), {}, 1), site = analyse(s); R.check('4 Q6 on another edge: classes turn with it (front on edge 1, back opposite, sides between)', eq(Q.plain(site.edgeClass), ['side', 'front', 'side', 'back']) && near(site.footprint.w * site.footprint.d, site.footprint.area) ? [] : [JSON.stringify(site.edgeClass)]);
  const d = mk(rect(20, 30)); R.check('4 default street edge of a rectangle is its bottom edge; tie rules', d.ans.streetEdge === 0 && PC.plot.defaultStreetEdge(d.plot.pts) === 0 && PC.plot.defaultStreetEdge(Q.ccw([[0, 0], [10, 0], [10, 5], [30, 5], [30, 0], [40, 0], [40, 30], [0, 30]])) === Q.defaultStreetEdge(Q.ccw([[0, 0], [10, 0], [10, 5], [30, 5], [30, 0], [40, 0], [40, 30], [0, 30]])) ? [] : ['default edge']); }

// ================= 5. parking, pool, vegetation =================
function outdoorProblems(s, site, label) {
  const r = ref(s), fp = site.footprint, pr = [], a = s.ans; if (!fp) return pr; const cx = fp.u + fp.w / 2, strip = { u: cx - 1, v: 0, w: 2, d: fp.v };
  const us = r.pL.map((p) => p[0]), vs = r.pL.map((p) => p[1]), u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const grid = (lo, hi) => { const o = []; for (let x = Math.ceil(lo / 0.5 - 1e-9) * 0.5; x <= hi + 1e-9; x += 0.5) o.push(Math.round(x * 2) / 2); return o; };
  // ---- parking ----
  if (a.parking.cars > 0) { const w = a.parking.cars * 2.5, d = 5, okPos = (p) => Q.rectInPoly(p, r.pL) && !Q.rectsOverlap(p, fp);
    const front = [], side = []; for (const v of grid(0.5, fp.v - d)) for (const u of [...grid(u0, u1 - w), ...(v === 0.5 ? [cx + 1, cx - 1 - w] : [])]) { const p = { u, v, w, d }; if (okPos(p)) front.push(p); }   // A-6: 'directly right / left of the strip' only at v = 0.5
    for (const u of [...grid(fp.u + fp.w, u1 - w), ...grid(u0, fp.u - w)]) { const p = { u, v: 0.5, w, d }; if ((u >= fp.u + fp.w - 1e-9 || u + w <= fp.u + 1e-9) && okPos(p)) side.push(p); }
    const free = front.filter((p) => !Q.rectsOverlap(p, strip)), P = site.parking, omitted = site.omitted.includes('parking');
    if (P) { if (omitted) pr.push('parking placed and omitted'); if (!near(P.w, w) || !near(P.d, d) || P.cars !== a.parking.cars || P.covered !== a.parking.covered) pr.push('parking size / flags ' + JSON.stringify(P));
      if (!Q.rectInPoly(P, r.pL)) pr.push('parking is not inside the plot'); if (Q.rectsOverlap(P, fp)) pr.push('parking overlaps the building'); if (P.v < 0.5 - 1e-9) pr.push('parking closer than 0.5 m to the street');
      const inFront = P.v + P.d <= fp.v + 1e-9, beside = P.u >= fp.u + fp.w - 1e-9 || P.u + P.w <= fp.u + 1e-9; if (!inFront && !(beside && near(P.v, 0.5))) pr.push('parking is neither in the front yard nor in a side yard next to the street: ' + JSON.stringify(P));
      const cover = Math.max(0, Math.min(P.u + P.w, strip.u + 2) - Math.max(P.u, strip.u)) * (P.v < fp.v ? 1 : 0), hits = Q.rectsOverlap(P, strip);
      if (hits && (free.length || side.length)) pr.push(`parking covers ${cover} m of the entrance strip although a strip-free place exists (e.g. ${JSON.stringify(free[0] || side[0])})`);
      if (hits) { const cov = (p) => Math.max(0, Math.min(p.u + p.w, strip.u + 2) - Math.max(p.u, strip.u)), sameV = front.filter((p) => near(p.v, P.v)), least = Math.min(...sameV.map(cov)), any = Math.min(...front.map(cov)); if (cover > least + 1e-9) pr.push(`last resort covers ${cover} m of the strip; ${least} m was possible at the same distance from the street`); else if (cover > any + 1e-9) obs.push(`${label}: last-resort parking covers ${cover} m of the entrance strip at v ${P.v}; ${any} m would be possible further from the street (the rule prefers nearest the street)`); }
      if (inFront && !near(P.v, Math.min(...front.map((p) => p.v)), 1e-9) && free.length) { /* lowest v first */ if (free.some((p) => p.v < P.v - 1e-9)) pr.push('parking is not as close to the street as possible'); }
    } else { if (!omitted) pr.push('no parking and no "omitted" entry'); if (front.length || side.length) pr.push(`parking omitted although it fits, e.g. ${JSON.stringify(front[0] || side[0])}`); }
  } else if (site.parking || site.omitted.includes('parking')) pr.push('0 cars but parking present / omitted');
  // ---- pool ----
  if (a.pool.on) { const [sht, lng] = Q.POOL[a.pool.size], clear = (p) => ({ u: p.u - 1, v: p.v - 1, w: p.w + 2, d: p.d + 2 }), okPos = (p) => { const k = clear(p); return Q.rectInPoly(k, r.pL) && !Q.rectsOverlap(k, fp) && !(site.parking && Q.rectsOverlap(k, site.parking)); };
    const spots = []; const back = fp.v + fp.d + 1;
    for (const v of [back, ...grid(back, v1 - sht)]) for (const u of [cx - lng / 2, ...grid(u0, u1 - lng)]) { const p = { u, v, w: lng, d: sht }; if (okPos(p)) spots.push(p); }
    for (const v of grid(v0, v1 - lng)) for (const u of [...grid(fp.u + fp.w + 1, u1 - sht), ...grid(u0, fp.u - 1 - sht)]) { const p = { u, v, w: sht, d: lng }; if (okPos(p)) spots.push(p); }
    const P = site.pool, omitted = site.omitted.includes('pool');
    if (P) { if (omitted) pr.push('pool placed and omitted'); const dims = [Math.min(P.w, P.d), Math.max(P.w, P.d)]; if (!near(dims[0], sht) || !near(dims[1], lng)) pr.push(`pool ${P.w} x ${P.d}, size ${a.pool.size} is ${sht} x ${lng}`);
      const k = clear(P); if (!Q.rectInPoly(k, r.pL)) pr.push('pool clearance is not inside the plot'); if (Q.rectsOverlap(k, fp)) pr.push('pool clearance overlaps the building'); if (site.parking && Q.rectsOverlap(k, site.parking)) pr.push('pool clearance overlaps the parking');
      const behind = P.v >= back - 1e-9, beside = P.u >= fp.u + fp.w + 1 - 1e-9 || P.u + P.w <= fp.u - 1 + 1e-9; if (!behind && !beside) pr.push('pool is neither behind nor beside the building: ' + JSON.stringify(P)); if (behind && !near(P.w, lng)) pr.push('behind the house the long side must run along the street'); if (!behind && beside && !near(P.d, lng)) pr.push('beside the house the long side must run inward');
    } else { if (!omitted) pr.push('no pool and no "omitted" entry'); if (spots.length) pr.push(`pool omitted although it fits, e.g. ${JSON.stringify(spots[0])}`); }
  } else if (site.pool || site.omitted.includes('pool')) pr.push('pool off but present / omitted');
  // ---- vegetation ----
  const used = fp.area + (site.parking ? site.parking.w * site.parking.d : 0) + (site.pool ? site.pool.w * site.pool.d : 0), want = a.vegPct / 100 * r.area, room = Math.max(0, r.area - used), exp = Math.min(want, room);
  if (!near(site.veg.area, exp, 1e-6) || !near(site.veg.pct, exp / r.area * 100, 1e-6) || site.veg.reduced !== (want > room + 1e-6)) pr.push(`vegetation ${JSON.stringify(site.veg)}, expected ${exp.toFixed(2)} m², reduced ${want > room + 1e-6}`);
  const v = PC.validate(s), w = v.warnings.map((x) => x.code);
  for (const [code, on] of [['parking-omitted', site.omitted.includes('parking')], ['pool-omitted', site.omitted.includes('pool')], ['veg-reduced', site.veg.reduced]]) if (w.includes(code) !== on) pr.push(`warning ${code} ${w.includes(code) ? 'shown' : 'missing'}`);
  return pr;
}
{ // named cases
  for (const [cars, wantU, maxCover] of [[1, null, 0], [2, [11, 16], 0], [3, [11, 18.5], 0], [4, [0, 10], 1]]) { const s = sample(); s.ans.parking = { cars, covered: true }; const site = analyse(s), P = site.parking, cover = P ? Math.max(0, Math.min(P.u + P.w, 11) - Math.max(P.u, 9)) : -1;
    R.check(`5 sample with ${cars} car(s): placed${wantU ? ` at u ${wantU[0]}-${wantU[1]}` : ''}, entrance strip covered by at most ${maxCover} m`, P && cover <= maxCover + 1e-9 && (!wantU || (near(P.u, wantU[0]) && near(P.u + P.w, wantU[1]))) ? outdoorProblems(s, site, `sample ${cars} cars`) : [JSON.stringify(P)]); }
  { const s = mk(rect(20, 20)), site = analyse(s), P = site.parking, fp = site.footprint; R.check('5 default answers on a 20 x 20 m plot: the one car goes into a side yard next to the street (front yard is under 5.5 m deep)', P && fp && fp.v < 5.5 && near(P.v, 0.5) && (P.u >= fp.u + fp.w - 1e-9 || P.u + P.w <= fp.u + 1e-9) ? outdoorProblems(s, site) : [JSON.stringify([fp, P])]); }
  { const s = mk(rect(12, 14), { setbacks: { front: 1, back: 1, side: 1 }, footprintPct: 60, parking: { cars: 2, covered: false }, pool: { on: true, size: 'L' }, vegPct: 30 }), site = analyse(s), v = PC.validate(s);
    R.check('5 crowded 12 x 14 m plot: parking and pool omitted with both warnings, nothing blocking for that reason', site.omitted.includes('parking') && site.omitted.includes('pool') && v.warnings.some((w) => w.code === 'parking-omitted') && v.warnings.some((w) => w.code === 'pool-omitted') ? outdoorProblems(s, site) : [JSON.stringify(site.omitted)]); }
  { const s = sample(); s.ans.vegPct = 60; s.ans.footprintPct = 40; s.ans.parking.cars = 4; s.ans.pool.size = 'L'; const site = analyse(s), used = site.footprint.area + 50 + (site.pool ? 50 : 0);
    R.check('5 vegetation is reduced to what is left beside building, parking and pool, with the effective % in the warning', site.veg.reduced && near(site.veg.area, 584 - used) && PC.validate(s).warnings.some((w) => w.code === 'veg-reduced' && w.text.includes(Q.fmtArea(site.veg.area, 'm')) && w.text.includes((Math.round(site.veg.pct * 10) / 10) + ' %')) ? outdoorProblems(s, site) : [JSON.stringify(site.veg)]); }
}
let outN = 0; for (const [name, raw] of Object.entries(PLOTS)) { if (name.includes('100x100') || name.startsWith('star')) continue; for (const cars of [1, 2, 4]) for (const size of ['S', 'L']) for (const [sbName, sb] of [['default', SB.default], ['mixed', SB.mixed]]) {
  const s = mk(raw, { setbacks: sb, footprintPct: 25, vegPct: 40, parking: { cars, covered: false }, pool: { on: true, size } }), site = analyse(s); outN++;
  R.check(`5 ${name} / setbacks ${sbName} / ${cars} car(s) / pool ${size}: parking, pool and vegetation rules`, outdoorProblems(s, site, `${name} / setbacks ${sbName} / ${cars} cars`)); } }
R.note(`parking / pool / vegetation rules checked on ${outN} generated cases`);

// ================= 6. levels =================
{ const pr = []; for (const floors of [1, 2, 3]) for (const basement of [false, true]) for (const usableRoof of [false, true]) for (const lift of [false, true]) { const s = sample(); Object.assign(s.ans, { floors, basement, usableRoof, lift }); const a = s.ans;
    if (!eq(Q.plain(PC.levels.ids(s)), Q.levelIds(a))) pr.push(`ids ${floors}/${basement}`); if (PC.levels.stairsExist(s) !== Q.stairsExist(a)) pr.push(`stairs ${floors}/${basement}/${usableRoof}`); if (PC.levels.liftExists(s) !== (Q.stairsExist(a) && lift)) pr.push('lift');
    for (const id of Q.levelIds(a)) if (!near(PC.levels.needed(s, id), Q.needed(a, id))) pr.push(`needed ${id}: ${PC.levels.needed(s, id)} vs ${Q.needed(a, id)}`); }
  R.check('6 levels: ids, stairs (2+ levels counting basement and usable roof), lift only with stairs, needed area, for all 24 combinations', pr);
  const one = sample(); Object.assign(one.ans, { floors: 1, lift: true }); one.ans.rooms = one.ans.rooms.filter((r) => r.level === 'G'); one.ans.pairs = [['r3', 'r4']];
  R.check('6 one floor alone: no stairs, so no stair or lift allowance (needed = rooms only = 110)', PC.levels.needed(one, 'G') === 110 && !PC.levels.stairsExist(one)); one.ans.usableRoof = true; R.check('6 one floor + usable roof: stairs exist (needed 110 + 10 + 3 with lift)', PC.levels.needed(one, 'G') === 123);
  const ex = sample(); ex.ans.rooms[0] = { ...ex.ans.rooms[0], size: null, area: 37.5 }; R.check('6 exact room area is used as given', PC.levels.needed(ex, 'G') === 120 - 42 + 37.5);
  const names = PC.levels.roomNames(sample()); R.check('6 room names: Master bedroom, Bedroom 1 / 2, Bathroom 1 / 2 on the first floor, unnumbered singles', eq([names.r8, names.r9, names.r10, names.r13, names.r14, names.r1, names.r6, names.r11], ['Master bedroom', 'Bedroom 1', 'Bedroom 2', 'Bathroom 1', 'Bathroom 2', 'Living', 'Bathroom', 'Living']) ? [] : [JSON.stringify(names)]); }

// ================= 7. every blocking and warning code alone, in m and ft =================
const metresInFt = new Set();
const QOF = { 'floor-empty': 11, 'basement-empty': 11, 'buildable-small': 2, 'no-fit': 2, 'fp-veg-over': 3, 'level-over': 11, 'fp-clamped': 3, 'veg-reduced': 4, 'parking-omitted': 15, 'pool-omitted': 16 };
function codeCase(name, build, expectBlock, expectWarn, textCheck, fix, opts = {}) {
  for (const unit of ['m', 'ft']) { const s = build(); s.ans.unit = unit; PC.store.session.invalidFields = opts.invalid || {}; const v = PC.validate(s), b = v.blocking.map((x) => x.code), w = v.warnings.map((x) => x.code), pr = [];
    if (!eq(b, expectBlock)) pr.push(`blocking ${JSON.stringify(b)}, expected ${JSON.stringify(expectBlock)}`); if (!eq(w, expectWarn)) pr.push(`warnings ${JSON.stringify(w)}, expected ${JSON.stringify(expectWarn)}`);
    for (const it of [...v.blocking, ...v.warnings]) { if (it.code !== 'field-invalid' && it.q !== QOF[it.code]) pr.push(`${it.code} points at Q${it.q}, expected Q${QOF[it.code]}`); if (/undefined|NaN|\{|\}/.test(it.text)) pr.push('unfilled text: ' + it.text); if (unit === 'ft' && /\d m²|\d m\b/.test(it.text)) metresInFt.add(`${it.code}: "${it.text}"`); if (unit === 'm' && /sq ft| ft\b/.test(it.text)) pr.push('feet in m mode: ' + it.text); }
    const site = PC.site.analyse(s); pr.push(...textCheck(v, unit, s, site));
    const st = PC.stages.status(s); if (st[2].valid !== (expectBlock.length === 0)) pr.push(`stage 2 valid = ${st[2].valid} with blocking ${JSON.stringify(expectBlock)}`); if (expectBlock.length && (st[3].reachable || st[3].reason !== 'Fix the highlighted answers first')) pr.push(`stage 3 reachable / reason "${st[3].reason}"`);
    if (fix) { const f = build(); f.ans.unit = unit; fix(f); PC.store.session.invalidFields = {}; const v2 = PC.validate(f); const left = [...v2.blocking, ...v2.warnings].map((x) => x.code).filter((c) => [...expectBlock, ...expectWarn].includes(c) && !(opts.keep || []).includes(c)); if (left.length) pr.push('still there after the fix: ' + left.join()); }
    PC.store.session.invalidFields = {};
    R.check(`7 ${name} (${unit})`, pr); }
}
const has = (v, code, ...parts) => { const it = [...v.blocking, ...v.warnings].find((x) => x.code === code); if (!it) return [`${code} missing`]; return parts.filter((p) => !it.text.includes(p)).map((p) => `${code} text "${it.text}" lacks "${p}"`); };
codeCase('floor-empty alone: first floor without rooms', () => { const s = sample(); s.ans.rooms = s.ans.rooms.filter((r) => r.level !== '1'); s.ans.pairs = [['r3', 'r4']]; return s; }, ['floor-empty'], [], (v) => has(v, 'floor-empty', 'First floor').concat(v.blocking[0].level === '1' ? [] : ['level ' + v.blocking[0].level]), (s) => { s.ans.rooms.push({ id: 'r20', type: 'bedroom', level: '1', size: 'M', area: null, master: false }); });
codeCase('floor-empty alone: ground floor without rooms', () => { const s = sample(); s.ans.rooms = s.ans.rooms.filter((r) => r.level !== 'G'); s.ans.pairs = [['r8', 'r13']]; return s; }, ['floor-empty'], [], (v) => has(v, 'floor-empty', 'Ground floor'), (s) => { s.ans.floors = 1; s.ans.rooms.forEach((r) => { r.level = 'G'; }); });
codeCase('basement-empty alone', () => { const s = sample(); s.ans.basement = true; return s; }, ['basement-empty'], [], (v) => has(v, 'basement-empty', 'basement').concat(v.blocking[0].level === 'B' ? [] : ['level']), (s) => { s.ans.basement = false; });
codeCase('buildable-small alone: 7 x 7.5 m plot with default setbacks (3 x 2.5 m left)', () => { const s = mk(rect(7, 7.5), { parking: { cars: 0, covered: false } }); s.ans.rooms = [{ id: 'r1', type: 'storage', level: 'G', size: 'S', area: null, master: false }]; s.ans.floors = 1; return s; }, ['buildable-small'], [], (v, u, s, site) => has(v, 'buildable-small', Q.fmtArea(site.buildable.area, u), Q.fmtArea(20, u)).concat(site.footprint ? ['footprint present'] : []), (s) => { s.ans.setbacks = { front: 0, back: 0, side: 0 }; s.ans.footprintPct = 60; }, { keep: [] });
codeCase('no-fit alone: 6.5 x 60 m strip (buildable 2.5 m wide, 137 m², but no 20 m² rectangle within 2:1)', () => { const s = mk(rect(6.5, 60), { parking: { cars: 0, covered: false } }); s.ans.rooms = [{ id: 'r1', type: 'storage', level: 'G', size: 'S', area: null, master: false }]; s.ans.floors = 1; return s; }, ['no-fit'], [], (v, u, s, site) => (site.buildable.ok && site.noFit && !site.footprint ? [] : ['site flags']).concat(has(v, 'no-fit', 'does not fit')), (s) => { s.ans.setbacks.side = 0; });
codeCase('fp-veg-over alone: footprint 60 % + vegetation 50 %', () => { const s = mk(rect(40, 40), { footprintPct: 60, vegPct: 50, parking: { cars: 0, covered: false } }); return s; }, ['fp-veg-over'], ['veg-reduced'], (v) => has(v, 'fp-veg-over', '60', '50', '100'), (s) => { s.ans.vegPct = 40; }, { keep: [] });
codeCase('level-over alone (free variant): sample with a 30 m² room added on the ground floor', () => { const s = sample(); s.ans.rooms.push({ id: 'r15', type: 'living', level: 'G', size: 'M', area: null, master: false }); s.ans.nextRoomId = 16; return s; }, ['level-over'], [], (v, u) => has(v, 'level-over', 'Ground floor', 'needs ' + Q.fmtArea(150, u), Q.fmtArea(142.5, u) + ' available', 'raise the footprint %').concat(v.blocking[0].level === 'G' ? [] : ['level']), (s) => { s.ans.footprintPct = 30; });
codeCase('level-over (clamped variant): 10 x 40 m strip, footprint limited to 6 x 12 m by the setbacks', () => { const s = sample(); s.plot.pts = rect(10, 40); s.ans.streetEdge = 0; s.ans.footprintPct = 50; s.ans.parking.cars = 0; s.ans.pool.on = false; return s; }, ['level-over', 'level-over'], ['fp-clamped'], (v, u, s, site) => (site.footprint.clamped ? [] : ['not clamped']).concat(has(v, 'level-over', 'needs ' + Q.fmtArea(120, u), Q.fmtArea(site.footprint.area, u) + ' available', 'reduce the setbacks')).concat(v.blocking.some((b) => /raise the footprint/.test(b.text)) ? ['offers "raise the footprint %" although the plot is the limit'] : []).concat(has(v, 'fp-clamped', Q.fmtArea(site.footprint.area, u), (Math.round(site.footprint.pct * 10) / 10) + ' %')), (s) => { s.ans.setbacks = { front: 1, back: 1, side: 0 }; s.ans.footprintPct = 50; }, { keep: ['fp-clamped'] });
// A-6 step 8 long-side cap (TL ruling 1, F2-T3 increment-1 review): QA's pentagon, setbacks 6 / 5 / 4 at 25 %. With step 4b the
// 3:1 try rounds to 23 x 7 m (beyond 3 x (7 + 0.5)); capped about its centre to 22.5 x 7 m, still clamped, reason proportion.
{ const s = mk(PLOTS.pentagon, { setbacks: SB.wide, footprintPct: 25, vegPct: 0, parking: { cars: 0, covered: false } }), fp = analyse(s).footprint, r = ref(s), mine = Q.refFootprint(r.pL, r.sb, 25, Q.latticeBuildable(r.pL, r.sb));
  const want = STRETCH ? [CAPX ? 21.5 : 22.5, 7, true, 'proportion'] : [mine.w, mine.d, true, undefined], pr = [];
  if (STRETCH && !eq([mine.w, mine.d, mine.clamped, mine.reason], want)) pr.push(`my model gives ${mine.w} x ${mine.d} ${mine.clamped} ${mine.reason}`);
  if (!fp || !eq([fp.w, fp.d, fp.clamped], want.slice(0, 3)) || (STRETCH && fp.reason !== 'proportion')) pr.push(`app gives ${fp ? `${fp.w} x ${fp.d} clamped ${fp.clamped} reason ${fp.reason}` : 'no footprint'}`);
  if (fp && Math.max(fp.w, fp.d) > Q.capOf(STRETCH ? 3 : 2, Math.min(fp.w, fp.d)) + 1e-9) pr.push('long side beyond the cap');
  R.check(`3c long-side cap (A-6 step 8): pentagon, setbacks 6 / 5 / 4, 25 % -> ${want[0]} x ${want[1]} m${STRETCH ? ', clamped, proportion' : ''}`, pr); }
// CTO F2 finding 1: 8.5 x 30 m plot, 10 %, setbacks 5 / 2 / 3 (buildable 2.5 m wide). The 1:3 try rounds to 2.5 x 8.5 m (3.4 : 1);
// the corrected cap (3 x 2.5 + 0.5 = 8 m) makes it 2.5 x 8 m. Before the marker the increment-1 cap lets 8.5 m through.
{ const s = mk(rect(8.5, 30), { setbacks: { front: 5, back: 2, side: 3 }, footprintPct: 10, vegPct: 0, parking: { cars: 0, covered: false } }, 0), fp = analyse(s).footprint, r = ref(s), mine = Q.refFootprint(r.pL, r.sb, 10, Q.latticeBuildable(r.pL, r.sb));
  const want = !STRETCH ? [mine.w, mine.d] : CAPX ? [2.5, 8] : [2.5, 8.5], pr = [];
  if (STRETCH && !eq([mine.w, mine.d], want)) pr.push(`my model gives ${mine.w} x ${mine.d}`);
  if (!fp || !eq([fp.w, fp.d], want)) pr.push(`app gives ${fp ? `${fp.w} x ${fp.d}` : 'no footprint'}`);
  R.check(`3d long-side cap, CTO case 8.5 x 30 m at 10 %, setbacks 5 / 2 / 3 -> ${want[0]} x ${want[1]} m (${CAPX ? '3 x short + 0.5 m' : 'increment-1 cap'})`, pr); }
// 20 x 30 m at 80 % is clamped by the setbacks in both rule versions (16 x 24.5 m; with step 4b the 14 x 40 m case of round 3 reaches its target)
codeCase('fp-clamped alone (warning): 20 x 30 m plot at 80 %, rooms small enough', () => { const s = mk(rect(20, 30), { footprintPct: 80, vegPct: 0, parking: { cars: 0, covered: false } }); s.ans.rooms = [{ id: 'r1', type: 'living', level: 'G', size: 'S', area: null, master: false }, { id: 'r2', type: 'bedroom', level: '1', size: 'S', area: null, master: false }]; return s; }, [], ['fp-clamped'], (v, u, s, site) => has(v, 'fp-clamped', Q.fmtArea(site.footprint.area, u), (Math.round(site.footprint.pct * 10) / 10) + ' %'), (s) => { s.ans.footprintPct = 10; });
codeCase('veg-reduced alone (warning): 30 % building + 70 % vegetation + 4 cars', () => { const s = mk(rect(30, 30), { footprintPct: 30, vegPct: 70, parking: { cars: 4, covered: false } }); return s; }, [], ['veg-reduced'], (v, u, s, site) => has(v, 'veg-reduced', Q.fmtArea(site.veg.area, u), (Math.round(site.veg.pct * 10) / 10) + ' %'), (s) => { s.ans.vegPct = 40; });
codeCase('parking-omitted alone (warning): 8 x 30 m plot, 4 cars (10 m wide)', () => { const s = mk(rect(8, 30), { setbacks: { front: 3, back: 2, side: 1 }, footprintPct: 20, vegPct: 0, parking: { cars: 4, covered: false }, floors: 1 }); s.ans.rooms = [{ id: 'r1', type: 'storage', level: 'G', size: 'S', area: null, master: false }]; return s; }, [], ['parking-omitted'], (v) => has(v, 'parking-omitted', 'left out').concat(LAYOUT ? hintProblems('parking-omitted', v.warnings.find((x) => x.code === 'parking-omitted').text) : []), (s) => { s.ans.parking.cars = 1; });
codeCase('pool-omitted alone (warning): 16 x 22 m plot, pool L', () => mk(rect(16, 22), { footprintPct: 30, vegPct: 0, parking: { cars: 0, covered: false }, pool: { on: true, size: 'L' } }), [], ['pool-omitted'], (v, u) => has(v, 'pool-omitted', Q.fmtLen(1, u) + ' clearance', { m: '1.0 m clearance', ft: '3.3 ft clearance' }[u], 'left out').concat(u === 'ft' && /\d m\b/.test(([...v.warnings].find((x) => x.code === 'pool-omitted') || {}).text || '') ? ['metres in ft mode (F2-T1 bug 2)'] : []).concat(LAYOUT ? hintProblems('pool-omitted', ([...v.warnings].find((x) => x.code === 'pool-omitted') || {}).text || '') : []), (s) => { s.ans.pool.on = false; });
codeCase('field-invalid from session.invalidFields (length limit follows the unit)', () => sample(), ['field-invalid'], [], (v, u) => { const it = v.blocking[0]; return (it.q === 2 ? [] : ['q ' + it.q]).concat(it.text.includes('Front setback') && it.text.includes(Q.fmtLen(0, u)) && it.text.includes(Q.fmtLen(20, u)) ? [] : ['text ' + it.text]); }, () => {}, { invalid: { 'q-setback-front': { label: 'Front setback', q: 2, min: 0, max: 20, unitKind: 'len' } } });
codeCase('field-invalid for a percentage and an area field together', () => sample(), ['field-invalid', 'field-invalid'], [], (v, u) => (v.blocking.some((b) => b.text.includes('10 %') && b.text.includes('80 %')) && v.blocking.some((b) => b.text.includes(Q.fmtArea(4, u)) && b.text.includes(Q.fmtArea(80, u))) ? [] : [JSON.stringify(v.blocking.map((b) => b.text))]), () => {}, { invalid: { 'q-footprint': { label: 'Footprint', q: 3, min: 10, max: 80, unitKind: 'pct' }, 'room-area': { label: 'Room area', q: 12, min: 4, max: 80, unitKind: 'area' } } });
{ const s = sample(); s.plot.closed = false; s.ans.streetEdge = null; const v = PC.validate(s); R.check('7 open plot: no site model, no conflicts from stage 2 (stage 1 is the blocker)', PC.site.analyse(s) === null && v.blocking.length === 0 && v.summary === null && PC.stages.status(s)[1].valid === false);
  const o = sample(); o.ans.rooms.push({ id: 'r15', type: 'storage', level: 'G', size: null, area: 22.7, master: false }); const vo = PC.validate(o), it = vo.blocking[0];
  R.check('7 level-over shows both numbers and they differ (142.7 vs 142.5 m² both round to 143, so one decimal is shown)', it && it.code === 'level-over' && /142\.7 m².*142\.5 m²/.test(it.text) ? [] : [it && it.text]);
  const w = sample(); w.ans.usableRoof = true; w.ans.roofType = 'pitched'; const changed = PC.validate.normaliseRoof(w.ans); R.check('7 usable roof + pitched is switched to flat (3.3)', changed && w.ans.roofType === 'flat' && !PC.validate.normaliseRoof(w.ans)); }

R.check('7 R4: no message states a length or area in metres while the unit is feet', [...metresInFt]);

// ================= 8. signatures (A-7) =================
{ const base = sample(), sig = (s) => Q.plain(['G', '1'].map((id) => PC.sig.level(s, id))), b0 = sig(base), pr = [];
  const APPEAR = { 'Q1 unit': (a) => { a.unit = 'ft'; }, 'Q4 vegetation': (a) => { a.vegPct = 40; }, 'Q5 north': (a) => { a.north = 135; }, 'Q8 ceiling': (a) => { a.ceilingH = 3.6; }, 'Q9 roof': (a) => { a.roofType = 'terrace'; }, 'Q10 exterior': (a) => { a.exterior = 'grey'; }, 'Q15 cars': (a) => { a.parking.cars = 4; }, 'Q15 covered': (a) => { a.parking.covered = false; }, 'Q16 pool': (a) => { a.pool = { on: false, size: 'L' }; }, 'Q17 wall': (a) => { a.extras.wall = false; }, 'Q17 gate': (a) => { a.extras.gate = 'left'; }, 'Q17 seating': (a) => { a.extras.seating = false; }, 'Q18 style': (a) => { a.interior.style = 'classic'; }, 'Q19 density': (a) => { a.interior.density = 'sparse'; }, 'Q7 usable roof (stairs already exist)': (a) => { a.usableRoof = true; }, 'master flag': (a) => { a.rooms[7].master = false; a.rooms[8].master = true; }, 'room list order': (a) => { a.rooms.reverse(); }, 'pair order and orientation': (a) => { a.pairs = [['r13', 'r8'], ['r4', 'r3']]; } };
  for (const [n, f] of Object.entries(APPEAR)) { const s = sample(); f(s.ans); if (!eq(sig(s), b0)) pr.push(n + ' changed a signature'); }
  R.check('8 signatures unchanged by every appearance answer, the master flag, list order and pair order', pr);
  const MOVE = { 'back setback 2 -> 2.25 m (footprint moves, same size)': (s) => { s.ans.setbacks.back = 2.25; }, 'vertex (8,30) -> (8.5,30)': (s) => { s.plot.pts[3] = [8.5, 30]; }, 'whole plot shifted and rotated': (s) => { s.plot.pts = rot(shift(SAMPLE, 30, 30), 40); } };
  for (const [n, f] of Object.entries(MOVE)) { const s = sample(); f(s); const fp = analyse(s).footprint; R.check(`8 move-only change keeps every signature: ${n}`, eq(sig(s), b0) && fp && near(fp.w, 9.5) && near(fp.d, 15) ? [] : [JSON.stringify(fp)]); }
  { const s = sample(); s.ans.setbacks.back = 2.25; const f = analyse(s).footprint; R.check('8 ... and the footprint really moved (v 8 -> 7.875)', near(f.v, 7.875) ? [] : [String(f.v)]); }
  const ALL = { 'Q3 footprint 25 -> 30 %': (a) => { a.footprintPct = 30; }, 'Q2 side setback 2 -> 6 m (size changes)': (a) => { a.setbacks.side = 6; }, 'Q14 stair position': (a) => { a.stairPos = 'bl'; }, 'Q14 lift': (a) => { a.lift = true; } };
  for (const [n, f] of Object.entries(ALL)) { const s = sample(); f(s.ans); const g = sig(s); R.check(`8 every level's signature changes: ${n}`, g[0] !== b0[0] && g[1] !== b0[1] ? [] : ['unchanged']); }
  { const s = sample(); s.ans.streetEdge = 2; const g = sig(s); R.check('8 every level changes when the street edge changes (Q6), even on a shape where the size could repeat', g[0] !== b0[0] && g[1] !== b0[1]);
    const sq = mk(rect(30, 30), {}, 0), sq2 = mk(rect(30, 30), {}, 2), fa = analyse(sq).footprint, fb = analyse(sq2).footprint; R.check('8 square plot, opposite street edge: same footprint size, signatures still differ', near(fa.w, fb.w) && near(fa.d, fb.d) && PC.sig.level(sq, 'G') !== PC.sig.level(sq2, 'G')); }
  const ONE = { 'room added on the ground floor': [(a) => { a.rooms.push({ id: 'r15', type: 'storage', level: 'G', size: 'S', area: null, master: false }); }, 0], 'room size changed on the first floor': [(a) => { a.rooms[9].size = 'L'; }, 1], 'room type changed on the ground floor': [(a) => { a.rooms[6].type = 'storage'; }, 0], 'exact area on the first floor': [(a) => { a.rooms[11].size = null; a.rooms[11].area = 13; }, 1], 'pair removed on the ground floor': [(a) => { a.pairs = [['r8', 'r13']]; }, 0], 'pair added on the first floor': [(a) => { a.pairs.push(['r9', 'r14']); }, 1], 'room removed from the first floor': [(a) => { a.rooms = a.rooms.filter((r) => r.id !== 'r12'); }, 1] };
  for (const [n, [f, idx]] of Object.entries(ONE)) { const s = sample(); f(s.ans); const g = sig(s); R.check(`8 only that level's signature changes: ${n}`, g[idx] !== b0[idx] && g[1 - idx] === b0[1 - idx] ? [] : [JSON.stringify(g.map((x, i) => x === b0[i]))]); }
  { const s = sample(); s.ans.rooms[6].level = '1'; const g = sig(s); R.check('8 moving a room to the other floor changes both levels', g[0] !== b0[0] && g[1] !== b0[1]); }
  { const s = sample(); s.ans.rooms[9].size = null; s.ans.rooms[9].area = 16; R.check('8 "M bedroom" and "exact 16 m²" resolve to the same area: same signature', eq(sig(s), b0)); }
  { const s = sample(); s.ans.floors = 3; s.ans.rooms.push({ id: 'r15', type: 'bedroom', level: '2', size: 'M', area: null, master: false }); const g = sig(s); R.check('8 Q7 a third floor: existing levels keep their signature, the new level has one', eq(g, b0) && PC.sig.level(s, '2') !== 'invalid' && PC.sig.level(base, '2') === 'invalid');
    const b = sample(); b.ans.basement = true; b.ans.rooms.push({ id: 'r15', type: 'storage', level: 'B', size: 'M', area: null, master: false }); R.check('8 Q7 basement added: G and 1 unchanged', eq(sig(b), b0) && PC.sig.level(b, 'B') !== 'invalid');
    const o = sample(); o.ans.floors = 1; R.check('8 Q7 down to one floor: stairs disappear, so the ground floor changes and the first floor is invalid', PC.sig.level(o, 'G') !== b0[0] && PC.sig.level(o, '1') === 'invalid');
    const o2 = sample(); o2.ans.floors = 1; o2.ans.usableRoof = true; R.check('8 one floor + usable roof keeps the stairs: ground-floor signature unchanged', PC.sig.level(o2, 'G') === b0[0]); }
  { const s = sample(); s.plot.closed = false; const t = mk(rect(7, 7.5)); R.check('8 "invalid" for an open plot, a plot without footprint and a level that does not exist', PC.sig.level(s, 'G') === 'invalid' && PC.sig.level(t, 'G') === 'invalid' && PC.sig.level(base, 'B') === 'invalid'); }
  { const j = JSON.parse(b0[1]); R.check('8 signature content: [w, d, edge], core, rooms and pairs in numeric id order (r8 before r13)', eq(j.fp, [9.5, 15, 0]) && eq(j.core, ['centre', 0]) && eq(j.rooms.map((r) => r[0]), ['r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14']) && eq(j.pairs, [['r8', 'r13']]) && eq(j.rooms[0], ['r8', 'bedroom', 24]) ? [] : [b0[1]]); }
}

// ================= 9. the R5 gate (PC.store.propose) =================
// my expected plans sentence (PM round 6): name the floors, and only what they have (edits / approval / both; union for several)
const NAME = { B: 'Basement', G: 'Ground floor', 1: 'First floor', 2: 'Second floor' };
const expSentence = (ids, kinds) => { const one = ids.length === 1, ed = kinds.includes('edited'), ap = kinds.includes('approved');
  const what = one ? (ed && ap ? 'its manual edits and approval' : ed ? 'its manual edits' : 'its approval') : (ed && ap ? 'their manual edits and approvals' : ed ? 'their manual edits' : 'their approvals');
  return `The floor plan${one ? '' : 's'} of the ${ids.map((i) => NAME[i]).join(' and the ')} will be regenerated, with ${what}.`; };
async function gateTests() {
  const fresh = (plans = ['G', '1']) => { const s = sample(); s.stage = 2; PC.site.clearMemo(); for (const id of plans) s.plans[id] = { sig: PC.sig.level(s, id), rooms: [], unmet: [], edited: true, approved: true, error: null }; PC.store.init(s); PC.store.session.r5Confirmed = false; PC.store.session.invalidFields = {}; const calls = [], notes = []; let answer = true; PC.store.setConfirmHandler((o) => { calls.push(o); return typeof answer === 'function' ? answer(o) : Promise.resolve(answer); }); const un = PC.store.subscribe((st, prev, meta) => notes.push({ meta: Q.plain(meta), same: st === prev })); return { calls, notes, set: (a) => { answer = a; }, un }; };
  { const g = fresh(); g.set(false); const before = PC.store.get(), r = await PC.store.propose((s) => { s.ans.footprintPct = 30; });
    R.check('9 layout change with valid plans: asks once, naming both levels', g.calls.length === 1 && eq(Q.plain(g.calls[0].levels), ['G', '1']) && g.calls[0].text.includes(expSentence(['G', '1'], ['edited', 'approved'])) ? [] : [JSON.stringify(g.calls)]);
    R.check('9 Cancel: resolves false, the very same state object stays, one notification marked cancelled', r === false && PC.store.get() === before && g.notes.length === 1 && g.notes[0].meta.cancelled === true && PC.store.get().ans.footprintPct === 25 && PC.store.session.r5Confirmed === false ? [] : [JSON.stringify(g.notes)]);
    const r2 = await PC.store.propose((s) => { s.ans.footprintPct = 30; }); R.check('9 after a Cancel the next layout change asks again', g.calls.length === 2 && r2 === false); g.un(); }
  { const g = fresh(); const r = await PC.store.propose((s) => { s.ans.footprintPct = 30; });
    R.check('9 Continue: committed, flag set, plans kept in the state but now stale', r === true && PC.store.get().ans.footprintPct === 30 && PC.store.session.r5Confirmed === true && g.notes.length === 1 && !g.notes[0].meta.cancelled && PC.store.get().plans.G.sig !== PC.sig.level(PC.store.get(), 'G'));
    await PC.store.propose((s) => { s.ans.stairPos = 'fl'; }); await PC.store.propose((s) => { s.ans.rooms[0].size = 'M'; });
    R.check('9 further layout changes in the same visit do not ask', g.calls.length === 1 && PC.store.get().ans.stairPos === 'fl'); g.un(); }
  { const g = fresh(); await PC.store.propose((s) => { s.ans.rooms[9].size = 'L'; }); const gValid = PC.store.get().plans.G.sig === PC.sig.level(PC.store.get(), 'G'); await PC.store.propose((s) => { s.ans.rooms[0].size = 'M'; });
    R.check('9 once per visit: after Continue for the first floor, a change to the still-valid ground floor does not ask again', gValid && g.calls.length === 1 && PC.store.get().ans.rooms[0].size === 'M' && PC.store.get().plans.G.sig !== PC.sig.level(PC.store.get(), 'G') ? [] : [`ground plan valid before=${gValid}, questions=${g.calls.length}`]); g.un(); }
  { const g = fresh(); await PC.store.propose((s) => { s.ans.rooms[9].size = 'L'; });
    R.check('9 a change to one floor names only that floor (singular wording)', g.calls.length === 1 && eq(Q.plain(g.calls[0].levels), ['1']) && g.calls[0].text.includes(expSentence(['1'], ['edited', 'approved'])) && !/Ground floor/.test(g.calls[0].text) ? [] : [JSON.stringify(g.calls)]); g.un(); }
  // round 6: only what the floors really have
  { const g = fresh(); PC.store.commit((s) => { s.plans.G.edited = false; s.plans['1'].edited = false; }, { nav: true }); await PC.store.propose((s) => { s.ans.footprintPct = 30; });
    R.check('9 both floors approved, not edited: "with their approvals", no edits named', g.calls.length === 1 && g.calls[0].text.includes(expSentence(['G', '1'], ['approved'])) && !/edit/i.test(g.calls[0].text) ? [] : [JSON.stringify(g.calls)]); g.un(); }
  { const g = fresh(); PC.store.commit((s) => { s.plans['1'].approved = false; }, { nav: true }); await PC.store.propose((s) => { s.ans.rooms[9].size = 'L'; });
    R.check('9 first floor edited, not approved: "with its manual edits", no approval named', g.calls.length === 1 && g.calls[0].text.includes(expSentence(['1'], ['edited'])) && !/approv/i.test(g.calls[0].text) ? [] : [JSON.stringify(g.calls)]); g.un(); }
  { const g = fresh(); PC.store.commit((s) => { s.plans.G.edited = false; s.plans['1'].approved = false; }, { nav: true }); await PC.store.propose((s) => { s.ans.footprintPct = 30; });
    R.check('9 one floor only approved, the other only edited: the union "with their manual edits and approvals"', g.calls.length === 1 && g.calls[0].text.includes(expSentence(['G', '1'], ['edited', 'approved'])) ? [] : [JSON.stringify(g.calls)]); g.un(); }
  { const g = fresh(); for (const f of [(s) => { s.ans.unit = 'ft'; }, (s) => { s.ans.vegPct = 10; }, (s) => { s.ans.exterior = 'white'; }, (s) => { s.ans.setbacks.back = 2.25; }, (s) => { s.plot.pts[3] = [8.5, 30]; }, (s) => { s.ans.parking.cars = 3; }]) await PC.store.propose(f);
    R.check('9 appearance and move-only changes through the gate never ask and are committed', g.calls.length === 0 && PC.store.get().ans.unit === 'ft' && PC.store.get().ans.setbacks.back === 2.25 && g.notes.length === 6);
    const n0 = g.notes.length, st = PC.store.get(), r = await PC.store.propose(() => {}); R.check('9 a proposal that changes nothing: true, no question, no notification, same state', r === true && g.calls.length === 0 && g.notes.length === n0 && PC.store.get() === st); g.un(); }
  { const g = fresh(); PC.store.commit((s) => { s.plans.G.sig = 'old'; s.plans['1'].sig = 'old'; }, { nav: true }); await PC.store.propose((s) => { s.ans.footprintPct = 30; });
    R.check('9 plans that are already stale never trigger the question', g.calls.length === 0 && PC.store.get().ans.footprintPct === 30); g.un(); }
  { const g = fresh(); PC.store.commit((s) => { s.plans.G.sig = 'old'; }, { nav: true }); await PC.store.propose((s) => { s.ans.footprintPct = 30; });
    R.check('9 one stale and one valid plan: only the valid level is named', g.calls.length === 1 && eq(Q.plain(g.calls[0].levels), ['1']) ? [] : [JSON.stringify(g.calls.map((c) => c.levels))]); g.un(); }
  { const g = fresh(); g.set(false); const before = PC.store.get(); await PC.store.propose((s) => { s.ans.floors = 1; s.ans.rooms = s.ans.rooms.filter((r) => r.level === 'G'); s.ans.pairs = [['r3', 'r4']]; });
    R.check('9 removing a planned level asks and names it (and the ground floor, whose stairs disappear)', g.calls.length === 1 && Q.plain(g.calls[0].levels).includes('1') && Q.plain(g.calls[0].levels).includes('G') && PC.store.get() === before ? [] : [JSON.stringify(g.calls.map((c) => c.levels))]); g.un(); }
  { const g = fresh([]); await PC.store.propose((s) => { s.ans.footprintPct = 30; }); R.check('9 no plans at all: no question', g.calls.length === 0 && PC.store.get().ans.footprintPct === 30); g.un(); }
  { const g = fresh(); await PC.store.propose((s) => { s.ans.footprintPct = 30; }); const keep = PC.stages.MAX_BUILT; PC.stages.MAX_BUILT = 5;
    PC.store.commit((s) => { for (const id of ['G', '1']) s.plans[id].sig = PC.sig.level(s, id); }, { nav: true }); const went = PC.store.go(3);
    R.check('9 entering stage 3 ends the visit: the flag is cleared', went === true && PC.store.session.r5Confirmed === false); PC.store.go(2); await PC.store.propose((s) => { s.ans.footprintPct = 35; });
    R.check('9 ... so the next visit to stage 2 asks again', g.calls.length === 2); PC.stages.MAX_BUILT = keep;
    PC.store.session.r5Confirmed = true; PC.store.replace(PC.store.defaults()); R.check('9 replace (sample, resume, start new) clears the flag', PC.store.session.r5Confirmed === false); g.un(); }
  { const g = fresh(); const order = []; let release; g.set(() => new Promise((res) => { order.push('asked'); release = res; }));
    const p1 = PC.store.propose((s) => { s.ans.footprintPct = 30; }).then((r) => { order.push('first ' + r); }), p2 = PC.store.propose((s) => { s.ans.footprintPct = s.ans.footprintPct + 5; }).then((r) => { order.push('second ' + r); });
    await new Promise((r) => setTimeout(r, 20)); const mid = PC.store.get().ans.footprintPct, asked = g.calls.length; release(true); await Promise.all([p1, p2]);
    R.check('9 proposals are serialised: the second waits for the first answer, then applies on top of it without asking again', mid === 25 && asked === 1 && g.calls.length === 1 && eq(order, ['asked', 'first true', 'second true']) && PC.store.get().ans.footprintPct === 35 ? [] : [JSON.stringify([mid, asked, order, PC.store.get().ans.footprintPct])]); g.un(); }
  { const g = fresh(); let n = 0; g.set(() => Promise.resolve(++n > 1)); const p1 = PC.store.propose((s) => { s.ans.footprintPct = 30; }), p2 = PC.store.propose((s) => { s.ans.stairPos = 'br'; }); const [a, b] = await Promise.all([p1, p2]);
    R.check('9 first cancelled, second continued: only the second is applied, each asked separately', a === false && b === true && g.calls.length === 2 && PC.store.get().ans.footprintPct === 25 && PC.store.get().ans.stairPos === 'br'); g.un(); }
  { const g = fresh(); const before = PC.store.get(); let threw = false; try { await PC.store.propose(() => { throw new Error('boom'); }); } catch (e) { threw = true; } const r = await PC.store.propose((s) => { s.ans.vegPct = 5; });
    R.check('9 a throwing mutator rejects, leaves the state, and does not block later proposals', threw && r === true && PC.store.get().ans.vegPct === 5 && PC.store.get().ans.footprintPct === before.ans.footprintPct ? [] : [`threw=${threw} r=${r}`]); g.un(); }
  { const g = fresh(); await PC.store.propose((s) => { s.ans.footprintPct = 30; }); R.check('9 sampleClean ends with a committed proposal', PC.store.get().sampleClean === false); g.un();
    const h = fresh(); h.set(false); await PC.store.propose((s) => { s.ans.footprintPct = 30; }); R.check('9 ... and survives a cancelled one', PC.store.get().sampleClean === true); h.un(); }
  { const g = fresh(); PC.store.setConfirmHandler(null); const r = await PC.store.propose((s) => { s.ans.footprintPct = 30; }); R.check('9 without a confirm handler the change is applied (no silent block)', r === true && PC.store.get().ans.footprintPct === 30); g.un(); }
}
await gateTests();

// ================= 10. regressions =================
{ for (const mod of ['validate', 'sig', 'levels', 'units']) { const P2 = Q.loadPC(), s = Q.plain(P2.sample.state()); s.plans = { G: { sig: 'x', rooms: [], unmet: [], edited: false, approved: true, error: null }, 1: { sig: 'x', rooms: [], unmet: [], edited: false, approved: true, error: null } }; if (mod === 'units') { s.plot.pts = [[0, 0], [5, 0], [5, 5], [0, 5]]; } delete P2[mod]; let threw = false; try { P2.stages.status(s); } catch (e) { threw = true; } R.check(`10 PC.stages fails loudly when PC.${mod} is missing (no silent "valid")`, threw); }
  const s = sample(); s.plans = { G: { sig: 'x', rooms: [], unmet: [], edited: false, approved: true, error: null }, 1: { sig: 'x', rooms: [], unmet: [], edited: false, approved: true, error: null } };
  R.check('10 approved plans with a wrong signature do not make stage 3 valid', PC.stages.status(s)[3].valid === false); for (const id of ['G', '1']) s.plans[id].sig = PC.sig.level(s, id); R.check('10 ... with the right signature they do', PC.stages.status(s)[3].valid === true);
  const tri = [[4, 4], [16, 4], [10, 14]]; R.check('10 canMove refuses a corner pulled through the opposite edge (orientation flip), allows a normal move', PC.plot.canMove(tri, 2, [10, 1], true).ok === false && PC.plot.canMove(tri, 2, [10, 12], true).ok === true && PC.plot.canMove(tri, 0, [17, 12], true).ok === false);
  // memo: alternating between states never returns another state's model
  const a = sample(), b = sample(); b.ans.parking.covered = false; const c = sample(); c.ans.pool.size = 'M'; const d = sample(); d.ans.vegPct = 10; const e = sample(); e.ans.setbacks.front = 4; const f = sample(); f.ans.streetEdge = 2; let bad = 0; PC.site.clearMemo();
  const expect = [a, b, c, d, e, f].map((x) => Q.plain((() => { PC.site.clearMemo(); const t = PC.site.analyse(x); return [t.footprint, t.parking, t.pool, t.veg, t.edge]; })())); PC.site.clearMemo();
  for (let i = 0; i < 60; i++) { const k = (i * 7 + (i % 3)) % 6, t = PC.site.analyse([a, b, c, d, e, f][k]); if (!eq(Q.plain([t.footprint, t.parking, t.pool, t.veg, t.edge]), expect[k])) bad++; }
  R.check('10 the memo never answers for other inputs (60 alternating lookups over 6 states)', bad === 0 ? [] : [`${bad} wrong`]);
}

// ---------- observations for the report ----------
{ const t = mk(rect(10, 50), { footprintPct: 30 }), ft = analyse(t).footprint; obs.push(`10 x 50 m plot at 30 % (150 m²): 2:1 cap gives ${ft.w} x ${ft.d} = ${ft.area} m² (${ft.pct.toFixed(1)} %), clamped ${ft.clamped}`);
  const s4 = sample(); s4.ans.parking.cars = 4; const p4 = analyse(s4).parking; obs.push(`sample with 4 cars: parking u ${p4.u}-${p4.u + p4.w}, i.e. ${Math.max(0, Math.min(p4.u + p4.w, 11) - Math.max(p4.u, 9))} m of the 2 m entrance strip is covered, with no warning`);
  const sq = mk(rect(20, 20)), pq = analyse(sq); obs.push(`default answers on 20 x 20 m: footprint ${pq.footprint.w} x ${pq.footprint.d} at v ${pq.footprint.v}; the car stands in the side yard at u ${pq.parking.u}-${pq.parking.u + pq.parking.w}, v 0.5-5.5, i.e. ${(5.5 - pq.footprint.v).toFixed(2)} m past the front wall line`);
  const e41 = mk([[0, 0], [20, 0], [20, 20], [0, 20 + 20 * Math.tan(41 * Math.PI / 180)]], {}, 0), c41 = analyse(e41); obs.push(`a rear boundary tilted 41 degrees is a "side" (setback ${c41.setbackOf[2]} m), at 40 degrees it is "back" (setback 2 m by default they are equal; with back 5 / side 1 the buildable area jumps)`);
  const z = mk(rect(20, 30), { setbacks: { front: 0, back: 0, side: 0 }, footprintPct: 80 }), fz = analyse(z).footprint; obs.push(`zero setbacks at 80 %: footprint ${fz.w} x ${fz.d} at u ${fz.u}, v ${fz.v} (walls ${fz.u} m from the side boundary); parking then ${analyse(z).omitted.includes('parking') ? 'does not fit (warning)' : 'fits'}`);
  const pl = sample(); pl.ans.pool.size = 'L'; const pp = analyse(pl); obs.push(`sample with pool L: ${pp.pool ? `placed ${pp.pool.w} x ${pp.pool.d} at u ${pp.pool.u}, v ${pp.pool.v}` : 'omitted'}`);
  const U = mk(PLOTS['U open to the street'], { footprintPct: 30 }), fu = analyse(U); obs.push(`U-shaped plot open to the street at 30 %: footprint ${fu.footprint.w} x ${fu.footprint.d} at u ${fu.footprint.u}, v ${fu.footprint.v} (moved ${fu.footprint.moved}); parking ${fu.parking ? `u ${fu.parking.u}, v ${fu.parking.v}` : 'omitted'}`);
}
if (convexMoved.length) obs.push(`convex plots that reached the fallback search (A-6 says they never do): ${convexMoved.length} cases, e.g. ${convexMoved.slice(0, 3).join(' | ')}`);
console.log('\nObservations (correct by the rules; for the report):'); for (const o of [...new Set(obs)].slice(0, 40)) console.log('  - ' + o);
process.exit(R.done() ? 0 : 1);
