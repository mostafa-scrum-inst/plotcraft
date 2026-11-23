// F4-T3 QA (node): the sky model, the vegetation scatter and the shortfall warning, judged by QA's own oracle
// (tests/qa/f4-t3-ref.mjs). Version-aware (plan 7): each section runs only once its marker exists, so the suite is green
// (with notes) on a main tree without F4-T3.
//   O oracle self-check (always): my A-13 (two rounded mix steps) reproduces the Designer's 16-row golden table.
//   K PC.sky.compute (marker): the 16 golden rows exactly (hex; intensities 1e-9 vs my lerp, 5e-4 vs the rounded table);
//     my oracle on 0..24 h in 0.25 h steps plus off-grid / out-of-range hours x 4 seasons x 5 north values (colours exact,
//     numbers and sunDir 1e-9); north + 90 degrees rotates sunDir by 90 degrees about Y; the F4-T1 opening look as
//     literals; PC.sky.mix (and three.mixHex) = the A-10 rule; pure (tables unchanged, plain JSON out).
//   D PC.data.vegetation (marker) = the Designer's table.
//   V PC.scatter.vegetation (marker): house.site.trees / shrubs on 4 plot shapes x vegetation % x pool / parking /
//     seating: every centre inside the plot, trees >= 1.7525 m and shrubs >= 0.7 m from every edge, outside footprint
//     + 1 (+ c for trees), path strip, parking (+ c), pool + 1 (+ c), seating + 0.3, needle circle L/2 + 0.3; spacing
//     2.4 / 1.4 / 1.0; scale 0.85..1.15; caps; vegPlaced = 6 nT + 1.5 nS; the stop rule (exact counts on roomy plots,
//     caps 120 / 200 on 100 x 100 m at 80 %); sample cover within 20 %; 0 % empty; deterministic; a Q4 change keeps the
//     tree order (seed without Q4: the trees at a lower % are all kept at a higher %).
//   W shortfall warning (marker PC.scatter + the warning in PC.validate; otherwise the view suite checks the stage-5
//     panel): shown iff vegPlaced < 0.8 x veg.area and Q4 > 0, the PM's text exactly (m and ft), never on the sample.
//   X (round 1, TL focus list): concave plots (L, U, rotated L); Q4 sweep (trees never move; shrubs observed); shortfall
//     together with veg-reduced and never above the cap line; stage-2 sweep timing; warm memo output = a fresh load.
// Run: node tests/qa/f4-t3-model.mjs [--only=O,K,...]   (--no-shots accepted and ignored)
import { collector } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';
import * as H from './f4-t1-ref.mjs';
import { loadTables } from './f3-t3-ref.mjs';
import * as V from './f4-t3-ref.mjs';

const R = collector('F4-T3 model');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean), want = (s) => !only.length || only.includes(s);
const { PC } = H.loadPC3();
const T3 = loadTables(), SKY = T3.sky, GOLD = V.skyGold(SKY), GROWS = GOLD ? GOLD.rows : [];
const MATS = (GOLD && GOLD.mats) || V.SEASON_MATS, NOON = (GOLD && GOLD.noon) || V.NOON_GOLD;   // F6-T1a retune: the Designer's hand table
const t0 = Date.now();
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LOOK_KEYS = ['sunDir', 'sunColor', 'sunIntensity', 'hemiSky', 'hemiGround', 'hemiIntensity', 'background', 'canopyColor', 'canopyVisible', 'shrubColor', 'groundColor'];
const lookNear = (a, b) => LOOK_KEYS.every((k) => (k === 'sunDir' ? a.sunDir.every((x, i) => Math.abs(x - b.sunDir[i]) <= 1e-9) : typeof b[k] === 'number' ? Math.abs(a[k] - b[k]) <= 1e-9 : typeof b[k] === 'boolean' ? a[k] === b[k] : String(a[k]).toUpperCase() === String(b[k]).toUpperCase()));
const cut = (a, n = 8) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);
const HAS = { sky: !!(PC.sky && typeof PC.sky.compute === 'function'), scatter: !!(PC.scatter && typeof PC.scatter.vegetation === 'function'), look: !!(PC.three && typeof PC.three.applyLook === 'function'), vegTable: !!PC.data.vegetation };
R.note(`markers: PC.sky.compute ${HAS.sky}, PC.scatter.vegetation ${HAS.scatter}, PC.three.applyLook ${HAS.look}, PC.data.vegetation ${HAS.vegTable}`);

function make(mut, plans = true) { const s = Q.plain(PC.sample.state()); if (mut) mut(s); s.plans = {}; if (plans) { PC.plans.sync(s); for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; } return s; }

// ================= O. oracle self-check =================
if (want('O')) {
  const f = [];
  if (!GOLD) f.push(`sky keys 17 / 18 are ${JSON.stringify(SKY.keys.filter((k) => k.h === 17 || k.h === 18).map((k) => [k.h, k.sunI, k.hemiI]))}: neither the F4-T3, the O-1 nor the F6-T1a retune values; QA golden not updated`);
  for (const [season, h, bg, sc, si, hs, hg, hi] of GROWS) {
    const m = V.mySky(h, season, 0, SKY), tag = `${season} ${h}`;
    for (const [k, w] of [['background', bg], ['sunColor', sc], ['hemiSky', hs], ['hemiGround', hg]]) if (m[k] !== w) f.push(`${tag} ${k}: mine ${m[k]}, golden ${w}`);
    if (Math.abs(m.sunIntensity - si) > 5e-4 || Math.abs(m.hemiIntensity - hi) > 5e-4) f.push(`${tag} intensities ${m.sunIntensity} / ${m.hemiIntensity}`);
  }
  for (const s of V.SEASONS) { const m = V.mySky(12, s, 0, SKY), w = MATS[s]; if (m.groundColor !== w[0] || (w[2] && m.canopyColor !== w[1]) || m.canopyVisible !== w[2] || m.shrubColor !== w[3]) f.push(`${s} materials ${JSON.stringify([m.groundColor, m.canopyColor, m.canopyVisible, m.shrubColor])}`); }
  // F6-T1 (designer-plan B8): groundOuter becomes meadow #8E9E6A, retuned to #727E58 (20c9238); version-aware
  // F6-T1c G1 (Designer, 66c5d87; marker PC.C.ROOF.copingT): groundOuter = summer meadow #6A8550, spring meadow #6F8A58
  const T1C = !!(PC.C.ROOF && PC.C.ROOF.copingT !== undefined);
  const GO = T1C ? V.G1_MEADOW.summer : GOLD && GOLD.r6 ? '#727E58' : (PC.texgen || (PC.C.VIEW3D && PC.C.VIEW3D.tiers)) ? '#8E9E6A' : '#B3B0A6';
  if (T1C) for (const [se, w] of Object.entries(V.G1_MEADOW)) { const m = SKY.seasons[se] && SKY.seasons[se].meadow; if (String(m).toUpperCase() !== w) f.push(`${se} meadow ${m}, G1 table ${w}`); }
  if (T3.siteColors.groundOuter !== GO) f.push(`groundOuter ${T3.siteColors.groundOuter}, expected ${GO}`);
  if (GOLD && GOLD.r6) {   // the retune's changed key fields and site colours = the Designer's hand table (C-6.5)
    for (const [h, ed] of Object.entries(GOLD.edits || V.R6_KEY_EDITS)) { const k = SKY.keys.find((x) => Math.abs(x.h - Number(h)) < 1e-9); if (!k) { f.push(`no sky key at ${h} h`); continue; }
      for (const [n, w] of Object.entries(ed)) if (typeof w === 'number' ? Math.abs(k[n] - w) > 1e-9 : String(k[n]).toUpperCase() !== w) f.push(`key ${h} h ${n} ${k[n]}, table ${w}`); }
    for (const [n, w] of Object.entries(T1C ? { ...V.R6_SITE, groundOuter: V.G1_MEADOW.summer } : V.R6_SITE)) if (String(T3.siteColors[n]).toUpperCase() !== w) f.push(`siteColors.${n} ${T3.siteColors[n]}, table ${w}`);
    if (SKY.groundBounce !== undefined && Math.abs(SKY.groundBounce - 0.25) > 1e-9) f.push(`groundBounce ${SKY.groundBounce}`); }
  const n = V.mySky(12, 'summer', 0, SKY); for (const k in NOON) if (n[k] !== NOON[k]) f.push(`noon ${k} ${n[k]}`);
  R.check(`O QA oracle (A-13, two rounded A-10 mix steps) reproduces the Designer\'s ${GROWS.length}-row golden table (${GOLD && GOLD.r6 ? `F6-T1${GOLD.r7 ? 'b' : 'a'} retune rows; key edits and site colours = the hand table` : GOLD && GOLD.o1 ? 'O-1 17.5 h rows' : 'F4-T3 rows'}), the season material table and the ${GOLD && GOLD.r6 ? 'retuned' : 'F4-T1'} noon look`, f);
}

// ================= K. PC.sky.compute =================
let VARIANT = 'renorm';
if (want('K')) {
  if (!HAS.sky) R.note('K skipped: PC.sky.compute absent (F4-T3 not merged)');
  else {
    const C = (h, s, n) => PC.sky.compute(h, s, n, PC.data.sky);
    const before = JSON.stringify(PC.data.sky);
    // golden rows
    const g = [];
    for (const [season, h, bg, sc, si, hs, hg, hi] of GROWS) for (const N of [0, 137]) {
      const r = C(h, season, N), tag = `${season} ${h} h N ${N}`;
      for (const [k, w] of [['background', bg], ['sunColor', sc], ['hemiSky', hs], ['hemiGround', hg]]) if (String(r[k]).toUpperCase() !== w) g.push(`${tag} ${k} ${r[k]} != golden ${w}`);
      if (Math.abs(r.sunIntensity - si) > 5e-4 || Math.abs(r.hemiIntensity - hi) > 5e-4) g.push(`${tag} intensities ${r.sunIntensity} / ${r.hemiIntensity} vs ${si} / ${hi}`);
    }
    R.check('K compute() reproduces the Designer\'s 16-row golden table exactly (background, sunColor, hemiSky, hemiGround; intensities to the table\'s 3 decimals), at two north values', cut(g));
    // variant of the Y clamp, from a low-sun case
    const lowH = 6.1, lowR = C(lowH, 'winter', 0).sunDir, vr = V.mySunDir(lowH, 'winter', 0, SKY, 'renorm'), ve = V.mySunDir(lowH, 'winter', 0, SKY, 'exact');
    VARIANT = lowR && Math.abs(lowR[1] - ve[1]) < 1e-9 && Math.abs(lowR[0] - ve[0]) < 1e-9 ? 'exact' : 'renorm';
    R.note(`K Y clamp variant: ${VARIANT === 'exact' ? 'Y exactly 0.15, horizontal rescaled' : 'Y clamped to 0.15 then renormalised (plan 4)'} (sunDir at winter ${lowH} h: ${JSON.stringify(lowR)}; renorm ${JSON.stringify(vr.map((x) => +x.toFixed(6)))}, exact ${JSON.stringify(ve.map((x) => +x.toFixed(6)))})`);
    // dense grid
    const f = [], HOURS = Array.from({ length: 97 }, (_, i) => i / 4).concat([-3, -0.01, 4.4, 5.99, 7.4, 11.9, 12.01, 18.2, 19.6, 20.7, 23.99, 24.01, 30]);
    let n = 0;
    for (const s of V.SEASONS) for (const N of [0, 37, 90, 180, 275.5]) for (const h of HOURS) { n++; f.push(...V.lookDiff(C(h, s, N), V.mySky(h, s, N, SKY, VARIANT), `${s} ${h} h N ${N}`)); }
    R.check(`K compute() = QA's A-13 oracle on ${n} cases (0..24 h in 0.25 h steps + off-grid and out-of-range hours, clamped; 4 seasons; north 0 / 37 / 90 / 180 / 275.5): colours exact, intensities and sunDir 1e-9`, cut(f));
    // properties
    const p = [];
    for (const s of V.SEASONS) for (const N of [0, 37, 90, 200]) for (const h of [0, 3, 6, 8, 12, 15.5, 17.5, 18, 22, 24]) {
      const a = C(h, s, N).sunDir, b = C(h, s, N + 90).sunDir, w = [-a[2], a[1], a[0]];
      if (b.some((x, i) => Math.abs(x - w[i]) > 1e-9)) p.push(`${s} ${h} h: north ${N} -> ${N + 90} gives ${JSON.stringify(b)}, a 90 degree turn about Y of ${JSON.stringify(a)} is ${JSON.stringify(w)}`);
      if (Math.abs(Math.hypot(...a) - 1) > 1e-9 || a[1] < 0.15 - 0.003) p.push(`${s} ${h} h N ${N}: |sunDir| ${Math.hypot(...a)}, Y ${a[1]}`);
    }
    for (const s of V.SEASONS) {
      const E = SKY.seasons[s].elevMax * Math.PI / 180, e6 = C(6, s, 0).sunDir, e18 = C(18, s, 0).sunDir, nn = C(12, s, 0).sunDir;
      if (!(e6[0] > 0.98 && Math.abs(e6[2]) < 1e-9)) p.push(`${s}: 6 h not east (+X at north 0): ${JSON.stringify(e6)}`);
      if (!(e18[0] < -0.98 && Math.abs(e18[2]) < 1e-9)) p.push(`${s}: 18 h not west: ${JSON.stringify(e18)}`);
      if (Math.abs(nn[1] - Math.sin(E)) > 1e-9 || !(nn[2] > 0)) p.push(`${s}: noon elevation ${Math.asin(nn[1]) * 180 / Math.PI} deg or not away from north (+Z at north 0): ${JSON.stringify(nn)}`);
      const z0 = C(0, s, 30), z24 = C(24, s, 30), zm = C(-2, s, 30), zp = C(26, s, 30);
      if (!lookNear(z0, z24)) p.push(`${s}: 24 h != 0 h`); if (!lookNear(zm, z0) || !lookNear(zp, z24)) p.push(`${s}: hours outside 0..24 not clamped`);
    }
    R.check('K properties: north + 90 degrees turns sunDir by 90 degrees about Y (1e-9, 4 seasons x 4 north x 10 hours); unit length; east at 6, west at 18, noon at elevMax away from north; 24 h = 0 h; outside 0..24 clamped', cut(p));
    // F4-T1 continuity, literal goldens
    const c = [], D2 = Math.PI / 180;
    for (const N of [0, 90]) { const r = C(12, 'summer', N); for (const k in NOON) { const w = NOON[k]; if (typeof w === 'number' ? Math.abs(r[k] - w) > 1e-9 : String(r[k]).toUpperCase() !== w) c.push(`N ${N} ${k} ${r[k]} != ${w}`); }
      const w = N === 0 ? [0, Math.sin(72 * D2), Math.cos(72 * D2)] : [-Math.cos(72 * D2), Math.sin(72 * D2), 0]; if (r.sunDir.some((x, i) => Math.abs(x - w[i]) > 1e-12)) c.push(`N ${N} sunDir ${JSON.stringify(r.sunDir)} != ${JSON.stringify(w)}`); }
    R.check('K compute(12, summer) = the F4-T1 opening look (literal colours, intensities, background; sunDir at north 0 and 90 = the F4-T1 noon direction)', c);
    // mix, purity, season fields
    const m = []; const rnd = H && ((seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(97);
    const hx = () => '#' + [0, 0, 0].map(() => Math.floor(rnd() * 256).toString(16).toUpperCase().padStart(2, '0')).join('');
    if (typeof PC.sky.mix !== 'function') m.push('PC.sky.mix missing (plan 4: the mix moves to core)');
    else for (let i = 0; i < 3000; i++) { const a = hx(), b = hx(), t = i < 20 ? [0, 1, 0.5, 0.25, 1 / 3][i % 5] : rnd(); const w = V.mix(a, b, t), g1 = String(PC.sky.mix(a, b, t)).toUpperCase(), g2 = String(PC.three.mixHex(a, b, t)).toUpperCase(); if (g1 !== w || g2 !== w) { m.push(`mix(${a}, ${b}, ${t}) sky ${g1} / three ${g2}, A-10 ${w}`); if (m.length > 4) break; } }
    for (const s of V.SEASONS) { const r = C(9, s, 0), w = MATS[s]; if (r.groundColor !== w[0] || r.canopyVisible !== w[2] || r.shrubColor !== w[3] || (w[2] && r.canopyColor !== w[1])) m.push(`${s}: ${JSON.stringify([r.groundColor, r.canopyColor, r.canopyVisible, r.shrubColor])}`); }
    const r = C(17.5, 'autumn', 45); if (!eq(JSON.parse(JSON.stringify(r)), r)) m.push('result is not plain JSON'); if (JSON.stringify(PC.data.sky) !== before) m.push('PC.data.sky changed by compute');
    R.check('K PC.sky.mix and three.mixHex = the A-10 mix (3000 random pairs); season fields per the Designer\'s material table; compute is pure (plain JSON, tables unchanged)', m);
  }
}

// ================= D. PC.data.vegetation =================
if (want('D')) {
  if (!HAS.vegTable) R.note('D skipped: PC.data.vegetation absent');
  else if (!PC.C.CONTACT) R.check('D PC.data.vegetation = the Designer\'s table (designer-plan 1: trunk 0.12 x 2.6 / 6, canopy 1.35 x 2.8 at 1.4 / 8, shrub 0.7 x 0.8 / 7, scale 0.85..1.15)', eq(PC.data.vegetation, V.VEG_TABLE) && eq(T3.vegetation, V.VEG_TABLE) ? [] : [JSON.stringify(PC.data.vegetation)]);
  else {   // F6-T1b (marker PC.C.CONTACT): the F4-T3 fields unchanged; the new fields = designer-plan E1 / E2 / C5 where it gives values
    const v = PC.data.vegetation, f = [], T = v.tree || {}, Sh = v.shrub || {};
    const base = { tree: Object.fromEntries(Object.keys(V.VEG_TABLE.tree).map((k) => [k, T[k]])), shrub: Object.fromEntries(Object.keys(V.VEG_TABLE.shrub).map((k) => [k, Sh[k]])), scale: v.scale };
    if (!eq(base, V.VEG_TABLE)) f.push(`F4-T3 fields ${JSON.stringify(base)}`);
    if (!eq(T3.vegetation, v)) f.push('page table != the source table');
    if (T.taper !== V.VEG_T1B.taper || T.leanDeg !== V.VEG_T1B.leanDeg || !eq(T.lumps, V.VEG_T1B.lumps)) f.push(`tree taper / lean / lumps ${JSON.stringify([T.taper, T.leanDeg, T.lumps])}`);
    for (const [x, y, z, r] of T.lumps || []) if (Math.hypot(x, z) + r > T.canopyR + 1e-9 || y - r < T.canopyY0 - 1e-9 || y + r > T.canopyY0 + T.canopyH + 1e-9) f.push(`tree lump ${[x, y, z, r]} outside the canopy envelope (Q-D2)`);
    if (Sh.squashY !== V.VEG_T1B.squashY || !Array.isArray(Sh.lumps) || Sh.lumps.length !== 2) f.push(`shrub squashY / lumps ${JSON.stringify([Sh.squashY, Sh.lumps])}`);
    const ICO0 = (1 + Math.sqrt(5)) / 2 / Math.hypot(1, (1 + Math.sqrt(5)) / 2);   // IcosahedronGeometry(1, 0): its highest / lowest vertex is at |y| 0.851
    for (const [x, y, z, r] of Sh.lumps || []) if (Math.hypot(x, z) + r > Sh.r + 1e-9 || y - ICO0 * r * Sh.squashY < -1e-9 || y + ICO0 * r * Sh.squashY > Sh.h + 1e-9) f.push(`shrub lump ${[x, y, z, r]} outside r ${Sh.r} / h ${Sh.h}`);
    const ti = v.tint || {}; if (!eq(ti.tree && ti.tree.value, V.VEG_T1B.treeValue) || !eq(ti.shrub && ti.shrub.value, V.VEG_T1B.shrubValue)) f.push(`tint values ${JSON.stringify(ti)}`);
    const b = v.blob || {}; if (b.treeK !== V.VEG_T1B.blobTreeK || b.shrubK !== V.VEG_T1B.blobShrubK || b.size !== 64 || !(b.opacity > 0 && b.opacity <= 0.5)) f.push(`blob ${JSON.stringify(b)}`);
    R.check('D PC.data.vegetation: the F4-T3 table unchanged; F6-T1b taper 0.6, lean 4 deg, the three Q-D2 tree lumps (inside canopyR, between canopyY0 and canopyY0 + canopyH), 2 shrub lumps squashed 0.7 inside r / h, tint values [0.88, 1.08] / [0.94, 1.06], blob 1.1 / 1.2 x radius, 64 px', f);
  }
}

// ================= V. scatter =================
const PLOTS = [
  ['rect 24 x 34', [[0, 0], [24, 0], [24, 34], [0, 34]]],
  ['rotated 30 deg', (() => { const a = 30 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[0, 0], [24, 0], [24, 34], [0, 34]].map(([x, y]) => [Math.round((x * c - y * s + 30) * 1000) / 1000, Math.round((x * s + y * c) * 1000) / 1000]); })()],
  ['trapezoid, slanted street', [[0, 2], [26, 0], [28, 34], [-2, 32]]],
  ['pentagon (sample)', null],
];
const vegOf = (s) => { const site = PC.site.analyse(s); return site.veg; };
if (want('V')) {
  if (!HAS.scatter) R.note('V skipped: PC.scatter.vegetation absent (house.site.trees / shrubs stay empty)');
  else {
    const f = [], st = { houses: 0, trees: 0, shrubs: 0, short: 0 }, tv = Date.now();
    for (const [pname, pts] of PLOTS) for (const veg of [10, 25, 45]) for (const k of [0, 1, 2]) {
      const tag = `${pname} veg ${veg} % ${['pool S + 2 covered cars + seating', 'no pool, no cars, no seating, no wall', 'pool L + 1 car, seating, gate left'][k]}`;
      const s = make((s) => { if (pts) { s.plot.pts = pts; s.ans.streetEdge = 0; } s.ans.vegPct = veg; s.ans.footprintPct = 25;
        if (k === 1) { s.ans.pool.on = false; s.ans.parking.cars = 0; s.ans.extras = { wall: false, gate: 'centre', seating: false }; }
        if (k === 2) { s.ans.pool = { on: true, size: 'L' }; s.ans.parking = { cars: 1, covered: false }; s.ans.extras = { wall: true, gate: 'left', seating: true }; } });
      const h = PC.house.build(s); if (!h) { f.push(`${tag}: no house`); continue; }
      const F = H.frameOf(s), A = vegOf(s).area, r = V.scatterProblems(h, F.pL, s.ans.extras, A, tag);
      f.push(...r.f); st.houses++; st.trees += r.nT; st.shrubs += r.nS; if (r.placed < 0.8 * A - 1e-9) st.short++;
      if (!eq(h.plot.pts.map((p) => p.map((x) => +x.toFixed(6))), F.pL.map((p) => p.map((x) => +x.toFixed(6))))) f.push(`${tag}: house plot != QA's frame L`);
    }
    R.check(`V ${st.houses} houses (4 plot shapes x vegetation 10 / 25 / 45 % x 3 outdoor sets): every centre inside the plot, trees >= ${V.TREE_EDGE} m / shrubs >= 0.7 m from each edge, outside footprint + 1 (+ c = ${V.CLEAR} for trees), path strip, parking (+ c), pool + 1 (+ c), seating + 0.3, needle circle L/2 + 0.3; spacing 2.4 / 1.4 / 1.0; scale 0.85..1.15; vegPlaced = 6 nT + 1.5 nS; never more than the stop rule allows`, cut(f, 10));
    R.note(`V ${st.houses} houses: ${st.trees} trees, ${st.shrubs} shrubs, ${st.short} below 80 % of veg.area; ${Date.now() - tv} ms`);
    // sample, 0 %, roomy plots (exact counts), caps
    const g = [];
    const smp = make(), hs = PC.house.build(smp), As = vegOf(smp).area, rs = V.scatterProblems(hs, H.frameOf(smp).pL, smp.ans.extras, As, 'sample');
    g.push(...rs.f); if (Math.abs(rs.placed - As) > 0.2 * As + 1e-9) g.push(`sample: placed ${rs.placed} m² vs veg.area ${As.toFixed(2)} m² (more than 20 % off)`);
    if (!rs.nT || !rs.nS) g.push(`sample: ${rs.nT} trees, ${rs.nS} shrubs (F4-S1: the sample shows trees)`);
    const z = PC.house.build(make((s) => { s.ans.vegPct = 0; })); if (z.site.trees.length || z.site.shrubs.length || (typeof z.site.vegPlaced === 'number' && z.site.vegPlaced !== 0)) g.push(`0 %: ${z.site.trees.length} trees, ${z.site.shrubs.length} shrubs, vegPlaced ${z.site.vegPlaced}`);
    if (typeof hs.site.vegPlaced !== 'number' && typeof (PC.site.analyse(smp) || {}).vegPlaced !== 'number') g.push('no vegPlaced in the site model or the house model (TL ruling 2)');
    for (const [tag, mut, exact] of [['60 x 50 m at 10 %', (s) => { s.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; s.ans.streetEdge = 0; s.ans.vegPct = 10; }, true],
      ['100 x 100 m at 80 % (caps)', (s) => { s.plot.pts = [[0, 0], [100, 0], [100, 100], [0, 100]]; s.ans.streetEdge = 0; s.ans.footprintPct = 15; s.ans.vegPct = 80; }, true]]) {
      const s = make(mut), h = PC.house.build(s); if (!h) { g.push(`${tag}: no house`); continue; }
      const A = vegOf(s).area, r = V.scatterProblems(h, H.frameOf(s).pL, s.ans.extras, A, tag); g.push(...r.f);
      if (exact && (r.nT !== r.tMax || r.nS !== r.sMax)) g.push(`${tag}: ${r.nT} trees / ${r.nS} shrubs, the stop rule on a roomy plot gives ${r.tMax} / ${r.sMax} (veg.area ${A.toFixed(1)} m²)`);
      if (/caps/.test(tag) && (r.nT !== 120 || r.nS !== 200)) g.push(`${tag}: ${r.nT} / ${r.nS}, caps 120 / 200`);
    }
    R.check(`V sample (${rs.nT} trees, ${rs.nS} shrubs, ${rs.placed} of ${As.toFixed(1)} m²): rules hold and cover within 20 % of veg.area; 0 % gives no items; vegPlaced in the model; roomy plots give exactly the stop-rule counts; 100 x 100 m at 80 % reaches the caps 120 / 200`, cut(g));
    // determinism + seed without Q4
    const d = [];
    const a1 = PC.house.build(make()), a2 = PC.house.build(make((s) => { s.ans = Q.plain(s.ans); }));
    if (!eq(a1.site.trees, a2.site.trees) || !eq(a1.site.shrubs, a2.site.shrubs) || a1.key !== a2.key) d.push('two separately built sample states differ');
    const key = (t) => t.map((x) => x.map((y) => y.toFixed(9)).join(',')); let prev = null;
    for (const veg of [5, 10, 20, 30, 40]) { const t = key(PC.house.build(make((s) => { s.ans.vegPct = veg; })).site.trees), set = new Set(t);
      if (prev && !(prev.length <= t.length && prev.every((x) => set.has(x)))) d.push(`trees at the lower % are not all kept at ${veg} % (${prev.length} -> ${t.length}, ${prev.filter((x) => !set.has(x)).length} gone): the candidate order changed (seed with Q4?)`); prev = t; }
    const m1 = PC.house.build(make((s) => { s.plot.pts = s.plot.pts.map((p, i) => (i === 2 ? [p[0] + 0.5, p[1]] : p)); }));
    if (m1 && eq(m1.site.trees, a1.site.trees)) d.push('moving one plot corner by 0.5 m left the trees identical (seed ignores the plot points?)');
    R.check('V deterministic: separately built equal states give identical trees, shrubs and house key; a Q4 change keeps the candidate order (5 -> 40 %: every tree, with its scale, kept at each higher %); a plot change reseeds', d);
  }
}

// ================= W. shortfall warning =================
if (want('W')) {
  if (!HAS.scatter) R.note('W skipped: PC.scatter.vegetation absent');
  else {
    const cases = [];
    const P = [['16 x 18', [[0, 0], [16, 0], [16, 18], [0, 18]]], ['20 x 24', [[0, 0], [20, 0], [20, 24], [0, 24]]], ['30 x 30', [[0, 0], [30, 0], [30, 30], [0, 30]]], ['sample', null]];
    for (const [pn, pts] of P) for (const fp of [25, 50]) for (const veg of [0, 15, 45]) for (const full of [true, false]) cases.push([`${pn} fp ${fp} veg ${veg}${full ? ' pool S + 2 cars' : ' bare'}`, (s) => { if (pts) { s.plot.pts = pts; s.ans.streetEdge = 0; } s.ans.footprintPct = fp; s.ans.vegPct = veg; if (!full) { s.ans.pool.on = false; s.ans.parking.cars = 0; } }]);
    for (const veg of [30, 80]) cases.push([`100 x 100 fp 15 veg ${veg} (item caps)`, (s) => { s.plot.pts = [[0, 0], [100, 0], [100, 100], [0, 100]]; s.ans.streetEdge = 0; s.ans.footprintPct = 15; s.ans.vegPct = veg; }]);
    const rows = [];
    for (const [tag, mut] of cases) { const s = make(mut), site = PC.site.analyse(s); if (!site || !site.footprint) continue;
      let placed = null; try { placed = V.vegPlacedOf(PC, s); } catch (e) { placed = null; } if (placed === null) continue;
      const w = PC.validate(s).warnings.filter((x) => V.isShort(x.text)); rows.push({ tag, s, site, placed, w }); }
    const inCore = rows.some((r) => r.w.length);
    const f = [], tally = { on: 0, off: 0, zero: 0 };
    if (!inCore) R.note('W the shortfall warning is not in PC.validate on any case: the view suite looks for it in the stage-5 panel (PM: "if the placement can only be computed in the 3D layer")');
    else for (const r of rows) {
      const should = V.shouldWarn(r.s.ans.vegPct, r.placed, r.site.veg.area); if (r.s.ans.vegPct === 0) tally.zero++; else tally[should ? 'on' : 'off']++;
      if (r.w.length !== (should ? 1 : 0)) { f.push(`${r.tag}: ${r.w.length} shortfall warning(s), placed ${r.placed} of ${r.site.veg.area.toFixed(1)} m² (${(r.placed / r.site.veg.area * 100).toFixed(1)} %)`); continue; }
      if (should) for (const u of ['m', 'ft']) { const s = Q.plain(r.s); s.ans.unit = u; const w = PC.validate(s).warnings.find((x) => V.isShort(x.text)), want = V.shortText(r.placed, r.site.plotArea, r.site.veg.pct, u);
        if (!w || w.text !== want) f.push(`${r.tag} (${u}): "${w && w.text}" != "${want}"`); else if (w.kind && w.kind !== 'warn') f.push(`${r.tag}: kind ${w.kind}`); }
    }
    if (inCore && (!tally.on || !tally.off)) f.push(`case family does not separate: ${JSON.stringify(tally)}`);
    const sw = PC.validate(make()).warnings; if (sw.some((x) => V.isShort(x.text)) || sw.length) f.push(`sample warnings ${JSON.stringify(sw)}`);
    const smpPlaced = V.vegPlacedOf(PC, make()), smpA = PC.site.analyse(make()).veg.area; if (V.shouldWarn(25, smpPlaced, smpA)) f.push(`sample places ${smpPlaced} of ${smpA.toFixed(1)} m² (< 80 %): PM 6.2 says the sample must not show the warning`);
    if (inCore) R.check(`W shortfall warning in PC.validate iff vegPlaced < 0.8 x min(veg.area, cap area 1020 m²) and Q4 > 0 (${rows.length} cases: ${tally.on} short, ${tally.off} not, ${tally.zero} at 0 %), the PM's text exactly in m and ft, a warning (non-blocking); never on the sample`, cut(f));
    else R.check('W sample: no warning at all and placement >= 80 % of veg.area (PM 6.2)', f);
  }
}
// ================= X. impl-review focus extras (round 1) =================
if (want('X') && HAS.scatter) {
  // concave plots (L and U shapes, one rotated): the edge rules and exclusions
  const f = [], cc = [['L shape', [[0, 0], [30, 0], [30, 16], [14, 16], [14, 36], [0, 36]]], ['U shape', [[0, 0], [34, 0], [34, 34], [24, 34], [24, 14], [10, 14], [10, 34], [0, 34]]],
    ['L shape rotated 50 deg', (() => { const a = 50 * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a); return [[0, 0], [30, 0], [30, 16], [14, 16], [14, 36], [0, 36]].map(([x, y]) => [Math.round((x * c - y * sn + 40) * 1000) / 1000, Math.round((x * sn + y * c) * 1000) / 1000]); })()]];
  let nT = 0, nS = 0, nh = 0;
  for (const [pn, pts] of cc) for (const veg of [15, 40]) for (const fp of [25, 35]) {
    const s = make((s) => { s.plot.pts = pts; s.ans.streetEdge = 0; s.ans.vegPct = veg; s.ans.footprintPct = fp; s.ans.parking.cars = 1; }), h = PC.house.build(s);
    if (!h) { f.push(`${pn} veg ${veg} fp ${fp}: no house (${JSON.stringify(PC.validate(s).blocking.map((b) => b.code))})`); continue; }
    const r = V.scatterProblems(h, H.frameOf(s).pL, s.ans.extras, vegOf(s).area, `${pn} veg ${veg} fp ${fp}`); f.push(...r.f); nT += r.nT; nS += r.nS; nh++;
    // a concave notch: no centre outside the polygon even inside the bbox
  }
  R.check(`X concave plots (L, U, L rotated 50 degrees; ${nh} houses, ${nT} trees, ${nS} shrubs): every rule of V holds (edge distances to every edge, exclusions, spacing, stop rule)`, cut(f));
  // Q4 sweep: trees never move (kept or added); shrubs observed
  const obs = []; let prevT = null, prevS = null, moved = 0;
  const k3 = (x) => x.map((y) => y.toFixed(9)).join(',');
  for (const veg of [5, 10, 15, 20, 25, 30, 35, 40, 50, 60]) { const h = PC.house.build(make((s) => { s.ans.vegPct = veg; })), T = h.site.trees.map(k3), S2 = h.site.shrubs.map(k3);
    if (prevT) { const st = new Set(T); moved += prevT.filter((x) => !st.has(x)).length; const ss = new Set(S2), kept = prevS.filter((x) => ss.has(x)).length; obs.push(`${veg} %: trees ${prevT.length}->${T.length}, shrubs ${prevS.length}->${S2.length} (${kept} kept, ${prevS.length - kept} gone, ${S2.length - kept} new)`); }
    prevT = T; prevS = S2; }
  R.check('X Q4 sweep 5..60 % on the sample: no tree ever moves or disappears when the % rises (trees only added)', moved ? [`${moved} trees gone or moved`] : []);
  R.note(`X shrubs over the Q4 sweep (observation): ${obs.join('; ')}`);
  // shortfall together with veg-reduced, and no warning above the cap
  const g = [];
  { let both = 0, red = 0;
    for (const [pn, pts] of [['16 x 18', [[0, 0], [16, 0], [16, 18], [0, 18]]], ['20 x 24', [[0, 0], [20, 0], [20, 24], [0, 24]]], ['sample', null]]) for (const fp of [20, 30, 40, 50]) for (const cars of [0, 2, 4]) {
      const s = make((s) => { if (pts) { s.plot.pts = pts; s.ans.streetEdge = 0; } s.ans.footprintPct = fp; s.ans.vegPct = 100 - fp; s.ans.parking.cars = cars; s.ans.pool = { on: true, size: 'M' }; }), site = PC.site.analyse(s);
      if (!site || !site.footprint || !site.veg.reduced) continue; red++;
      let placed = null; try { placed = V.vegPlacedOf(PC, s); } catch (e) { continue; }
      const w = PC.validate(s).warnings, sh = w.find((x) => V.isShort(x.text)), vr = w.find((x) => x.code === 'veg-reduced'), tag = `${pn} fp ${fp} + veg ${100 - fp}, ${cars} cars, pool M`;
      if (!vr) g.push(`${tag}: no veg-reduced row`);
      if (V.shouldWarn(100 - fp, placed, site.veg.area) !== !!sh) g.push(`${tag}: shortfall ${!!sh}, my rule ${V.shouldWarn(100 - fp, placed, site.veg.area)} (placed ${placed} of ${site.veg.area.toFixed(1)})`);
      if (sh && sh.text !== V.shortText(placed, site.plotArea, site.veg.pct, 'm')) g.push(`${tag}: text "${sh.text}"`);
      if (sh && vr) both++; }
    if (!both) g.push(`no state among ${red} reduced ones shows both warnings`); else R.note(`X ${both} of ${red} vegetation-reduced states also show the shortfall warning`); }
  for (const veg of [20, 50, 80]) { const s = make((s) => { s.plot.pts = [[0, 0], [100, 0], [100, 100], [0, 100]]; s.ans.streetEdge = 0; s.ans.footprintPct = 15; s.ans.vegPct = veg; }), site = PC.site.analyse(s), placed = V.vegPlacedOf(PC, s);
    if (placed < 0.8 * site.veg.area && !(placed >= 0.8 * V.CAP_AREA - 1e-9)) g.push(`100 x 100 at ${veg} %: placed ${placed} below both lines`);
    if (PC.validate(s).warnings.some((x) => V.isShort(x.text))) g.push(`100 x 100 at ${veg} %: shortfall shown although placed ${placed} >= 0.8 x 1020`); }
  R.check('X shortfall with veg-reduced (footprint + vegetation = 100 % on 3 plots x 4 % x 0 / 2 / 4 cars, pool M: shown iff my rule, exact text, both rows together); never above the cap line on 100 x 100 m at 20 / 50 / 80 % (placed >= 816 m²)', g);
  // finding 7: stage-2 sweep timing, memo output identical to a fresh load
  const sw = [];
  for (const [tag, mut] of [['sample', null], ['100 x 100 m veg 20 %', (s) => { s.plot.pts = [[0, 0], [100, 0], [100, 100], [0, 100]]; s.ans.streetEdge = 0; s.ans.vegPct = 20; }]]) {
    let best = Infinity, worst = 0; const base = make(mut, false);
    for (let rep = 0; rep < 3; rep++) { let w = 0; const t1 = Date.now(); for (let fp = 10; fp <= 80; fp++) { const s = Q.plain(base); s.ans.footprintPct = fp; const a = performance.now(); PC.site.analyse(s); PC.validate(s); w = Math.max(w, performance.now() - a); } best = Math.min(best, Date.now() - t1); worst = rep ? Math.min(worst, w) : w; }
    sw.push(`${tag}: ${best} ms for 71 ticks (best of 3), worst tick ${worst.toFixed(1)} ms`);
  }
  R.note(`X stage-2 footprint sweep 10..80 % (analyse + validate, node): ${sw.join('; ')}`);
  const fresh = H.loadPC3().PC, id = [];
  for (const [pn, pts] of PLOTS) for (const fp of [10, 40]) for (const veg of [10, 40]) { const mut = (s) => { if (pts) { s.plot.pts = pts; s.ans.streetEdge = 0; } s.ans.footprintPct = fp; s.ans.vegPct = veg; };
    const a = PC.site.analyse(make(mut, false)), sF = Q.plain(PC.sample.state()); mut(sF); const b = fresh.site.analyse(sF);
    if (JSON.stringify([a.trees, a.shrubs, a.vegPlaced]) !== JSON.stringify([b.trees, b.shrubs, b.vegPlaced])) id.push(`${pn} fp ${fp} veg ${veg}: memo-warm output != a fresh load`); }
  R.check('X finding 7: scatter output with a warm candidate memo (after the sweeps) = a fresh load, 16 states', id);
}
R.note(`node run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
