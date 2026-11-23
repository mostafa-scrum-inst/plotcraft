// F4-T3 QA oracle (own expectations; no FS / Designer helper is imported for an expectation). Written from
// docs/03-tasks/F4-T3/plan.md, plan-review.md (TL rulings), designer-plan.md (the vegetation table and the 16-row sky
// golden table, typed in here by QA) and architecture A-9 / A-13.
//   sky     : A-13 key lerp + day-weighted season blend, both with the A-10 mix rounded per channel (two rounded steps,
//             f3-t3-ref keyAt / blend, QA-passed in F3-T3); sun path s = e cos a + (y sin E - n cos E) sin a with
//             n = (sin N, 0, -cos N), e = n turned 90 degrees clockwise from above = (cos N, 0, sin N); moon mirror
//             (-x, |y|, -z) when y < 0; Y clamped to 0.15 (either "clamp then renormalise" (plan 4) or "Y exactly 0.15,
//             horizontal rescaled" (A-13 "kept at 0.15 or more"): both accepted, the variant is reported).
//   scatter : the TL's rules on the item centre (plan-review rulings 1 and 3), spacing, counts and the stop rule.
//   warning : the PM's shortfall text (goals-and-stories round 11), with the F2 number formats (fmtArea, 1 decimal %).
import * as Q from './f2-t1-ref.mjs';
import { keyAt, blend, mix } from './f3-t3-ref.mjs';
import { grow, myPath, distSeg, inPolyL } from './f4-t2-ref.mjs';

// ---- Designer §1: PC.data.vegetation (typed from designer-plan.md) ----
export const VEG_TABLE = { tree: { trunkR: 0.12, trunkH: 2.6, canopyR: 1.35, canopyY0: 1.4, canopyH: 2.8, trunkSeg: 6, canopySeg: 8 }, shrub: { r: 0.7, h: 0.8, seg: 7 }, scale: [0.85, 1.15] };
// F6-T1b (designer-plan E1 / E2, plan §6.2 C5; hand-entered): tapered leaning trunks, lump canopies and shrubs, tint, blobs
export const VEG_T1B = { taper: 0.6, leanDeg: 4, lumps: [[0, 2.95, 0, 1.2], [0.45, 2.35, 0.15, 0.85], [-0.40, 2.45, -0.25, 0.80]], squashY: 0.7, treeValue: [0.88, 1.08], shrubValue: [0.94, 1.06], blobTreeK: 1.1, blobShrubK: 1.2 };
export const CLEAR = VEG_TABLE.tree.canopyR * VEG_TABLE.scale[1];   // 1.5525 (TL ruling: the tree clearance)
export const TREE_EDGE = CLEAR + 0.2, SHRUB_EDGE = 0.7;               // 1.7525 / 0.7 m from every plot edge
export const SPACE = { tt: 2.4, st: 1.4, ss: 1.0 }, TREE_A = 6, SHRUB_A = 1.5, CAP = { trees: 120, shrubs: 200 }, POOL_CLEAR = 1;
export const PRESETS = { morning: 8, noon: 12, evening: 17.5, night: 22 };
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

// ---- Designer §2: the golden table (season, hour, background, sunColor, sunI, hemiSky, hemiGround, hemiI) ----
export const SKY_GOLD = [
  ['spring', 8, '#ABCDE6', '#FEE5C3', 0.567, '#CDDFEE', '#878768', 0.444], ['spring', 12, '#96C7EA', '#FEF7E8', 0.7, '#D8E7F4', '#939671', 0.48],
  ['spring', 17.5, '#E0AE87', '#FEB679', 0.5, '#C4B2BB', '#736E53', 0.39], ['spring', 22, '#0F1A29', '#A0B4D9', 0.15, '#7285AE', '#303843', 0.3],
  ['summer', 8, '#A6CAE6', '#FFE4C1', 0.567, '#CADDEF', '#818263', 0.444], ['summer', 12, '#8EC3EA', '#FFF7E8', 0.7, '#D6E6F5', '#8B906B', 0.48],
  ['summer', 17.5, '#DFAA81', '#FFB273', 0.5, '#C1AEB8', '#6E6A4E', 0.39], ['summer', 22, '#0B1626', '#9FB3D9', 0.15, '#7083AD', '#2F3741', 0.3],
  ['autumn', 8, '#B0C9DB', '#FEE0BB', 0.567, '#CFDAE3', '#887E64', 0.444], ['autumn', 12, '#9EC3DC', '#FEF0DB', 0.7, '#DBE1E6', '#958B6D', 0.48],
  ['autumn', 17.5, '#E1AD82', '#FEB476', 0.5, '#C7B0B4', '#756650', 0.39], ['autumn', 22, '#131C29', '#A2B4D7', 0.15, '#7485AC', '#313642', 0.3],
  ['winter', 8, '#ADCEE8', '#F8E3C9', 0.567, '#CBDDEF', '#979083', 0.444], ['winter', 12, '#9CC9EC', '#F6F2EA', 0.7, '#D5E5F4', '#A7A193', 0.48],
  ['winter', 17.5, '#DDB291', '#F9B985', 0.5, '#C4B5C0', '#81766B', 0.39], ['winter', 22, '#141F2F', '#A1B5DA', 0.15, '#7487B0', '#343A4A', 0.3],
];
// F5-T3a O-1 (Designer, f5t3-des 331707f): keys 17 (sunI 0.75, hemiI 0.34) and 18 (0.55, 0.30); only the 17.5 h rows change
// (reproduced independently by mySky on the modified keys before adoption)
export const O1_KEYS = { 17: [0.75, 0.34], 18: [0.55, 0.30] }, F4T3_KEYS = { 17: [0.60, 0.42], 18: [0.40, 0.36] };
const O1_ROWS = { spring: ['#E0B088', '#FEB77B', 0.65, '#C5B3BB', '#767355', 0.32], summer: ['#DFAA81', '#FFB273', 0.65, '#C1AEB8', '#6F6E4F', 0.32],
  autumn: ['#E2AE83', '#FEB577', 0.65, '#C8B1B2', '#786A50', 0.32], winter: ['#DDB496', '#F7BB8B', 0.65, '#C4B7C3', '#887E74', 0.32] };
export const SKY_GOLD_O1 = SKY_GOLD.map((r) => (r[1] === 17.5 ? [r[0], r[1], ...O1_ROWS[r[0]]] : r));
const keysAre = (sky, K) => [17, 18].every((h) => { const k = (sky.keys || []).find((x) => x.h === h); return k && Math.abs(k.sunI - K[h][0]) < 1e-9 && Math.abs(k.hemiI - K[h][1]) < 1e-9; });
// which golden applies to this build's sky table: { rows, o1 } or null (keys match neither version)
// F6-T1a Designer ACES retune (f6t1 20c9238, C-6.5; values entered by hand from the Designer's table, never copied from the
// generated GOLD literals): changed key fields, the season materials, the noon look and the two generated rows the Designer
// gave to compare with (summer 12 h and 17.5 h). Detected by keys 17 (sunI 0.91, hemiI 0.42) and 18 (0.67, 0.36).
export const R6_KEYS = { 17: [0.91, 0.42], 18: [0.67, 0.36] };
export const R6_KEY_EDITS = {
  6: { sunI: 0.36, hemiGround: '#8A7A66', exposure: 1.15 }, 7.5: { sunI: 0.67, hemiGround: '#B3A890', exposure: 1.1 },
  12: { background: '#B9D6EE', sunI: 0.85, hemiGround: '#C9BFA6', exposure: 1.1 }, 16: { background: '#BED6EA', sunI: 0.79, hemiGround: '#C2B79C', exposure: 1.1 },
  17: { sunI: 0.91, hemiGround: '#B3A089', hemiI: 0.42, exposure: 1.4 }, 18: { sunI: 0.67, hemiGround: '#8F7868', hemiI: 0.36, exposure: 1.45 },
  19.5: { exposure: 1.25 }, 0: { exposure: 1.3 }, 4.5: { exposure: 1.3 }, 21: { exposure: 1.3 }, 24: { exposure: 1.3 } };
export const R6_ROWS = [['summer', 12, '#B9D6EE', '#FFF7E8', 0.85, '#D6E6F5', '#B0B18F', 0.48], ['summer', 17.5, '#DFAA81', '#FFB273', 0.79, '#C1AEB8', '#938B6E', 0.39]];
// [ground, canopy, canopy visible, shrub] as SEASON_MATS (winter canopies stay hidden)
export const R6_MATS = { spring: ['#76A953', '#558739', true, '#67A344'], summer: ['#668748', '#477338', true, '#507A3C'], autumn: ['#877F4D', '#A85D27', true, '#8A5A2F'], winter: ['#FFFFFF', null, false, '#CDEDFE'] };
export const R6_NOON = { sunColor: '#FFF7E8', sunIntensity: 0.85, hemiSky: '#D6E6F5', hemiIntensity: 0.48, background: '#B9D6EE', hemiGround: '#B0B18F' };
export const R6_SITE = { ground: '#668748', groundOuter: '#727E58', paving: '#C1B4A1', poolWater: '#398BB5', poolRim: '#F1E3C1', boundaryWall: '#B5A990', carCanopy: '#838D93', seating: '#7E664C', asphalt: '#5D6063' };
// F6-T1b Designer retune (f6t1 c540c49, hand table): keys 12 / 16 / 17 / 18 change again; 6 / 7.5 h, the season
// materials and the site colours as R6. Detected by keys 17 (sunI 0.99, hemiI 0.44) and 18 (0.89, 0.40).
// F6-T1c G1 + G2 (Designer 66c5d87, entered by hand): meadow per season; summer = siteColors.groundOuter
export const G1_MEADOW = { spring: '#6F8A58', summer: '#6A8550', autumn: '#857D55', winter: '#E4E8EA' };
export const R7_KEYS = { 17: [0.99, 0.44], 18: [0.89, 0.40] };
export const R7_KEY_EDITS = { ...R6_KEY_EDITS,
  12: { background: '#B9D6EE', sunI: 1.0, hemiI: 0.40, hemiGround: '#C9BFA6', exposure: 1.05 }, 16: { background: '#BED6EA', sunI: 0.93, hemiI: 0.40, hemiGround: '#C2B79C', exposure: 1.05 },
  17: { sunI: 0.99, hemiI: 0.44, hemiSky: '#D0D4DC', hemiGround: '#AEB08E', exposure: 1.5 }, 18: { sunI: 0.89, hemiI: 0.40, hemiSky: '#BCC4DA', hemiGround: '#A2A684', exposure: 1.65 } };
export const R7_ROWS = [['summer', 12, '#B9D6EE', '#FFF7E8', 1.0, '#D6E6F5', '#B0B18F', 0.40], ['summer', 17.5, '#DFAA81', '#FFB273', 0.94, '#C6CCDB', '#98A37A', 0.42]];
export const R7_NOON = { ...R6_NOON, sunIntensity: 1, hemiIntensity: 0.4 };
export function skyGold(sky) {
  if (keysAre(sky, R7_KEYS)) return { rows: R7_ROWS, o1: true, r6: true, r7: true, mats: R6_MATS, noon: R7_NOON, edits: R7_KEY_EDITS };
  if (keysAre(sky, F4T3_KEYS)) return { rows: SKY_GOLD, o1: false, mats: SEASON_MATS, noon: NOON_GOLD };
  if (keysAre(sky, O1_KEYS)) return { rows: SKY_GOLD_O1, o1: true, mats: SEASON_MATS, noon: NOON_GOLD };
  if (keysAre(sky, R6_KEYS)) return { rows: R6_ROWS, o1: true, r6: true, mats: R6_MATS, noon: R6_NOON, edits: R6_KEY_EDITS };
  return null;
}
// Designer §2 material colours per season (plot ground, canopy (visible), shrub); groundOuter #B3B0A6 always
export const SEASON_MATS = { spring: ['#9DC46F', '#6AA442', true, '#8CBF5A'], summer: ['#7FAE55', '#4E8A3A', true, '#5E9441'], autumn: ['#A59B5C', '#C8702A', true, '#A8692F'], winter: ['#EDF1F4', null, false, '#DCE4EA'] };
// F4-T1 opening look, literal (what noonLook / noonSunDir gave before F4-T3; TL ruling 8): summer noon
export const NOON_GOLD = { sunColor: '#FFF7E8', sunIntensity: 0.7, hemiSky: '#D6E6F5', hemiIntensity: 0.48, background: '#8EC3EA', hemiGround: '#8B906B' };

// ---- A-13 ----
export const clampH = (h) => Math.max(0, Math.min(24, h));
// raw sun / moon direction before the Y clamp
export function rawDir(hour, season, northDeg, sky) {
  const N = northDeg * Math.PI / 180, E = sky.seasons[season].elevMax * Math.PI / 180, a = (clampH(hour) - 6) / 12 * Math.PI;
  const n = [Math.sin(N), 0, -Math.cos(N)], e = [Math.cos(N), 0, Math.sin(N)], ca = Math.cos(a), sa = Math.sin(a);
  let s = [0, 1, 2].map((k) => e[k] * ca + ((k === 1 ? Math.sin(E) : 0) - n[k] * Math.cos(E)) * sa);
  if (s[1] < 0) s = [-s[0], Math.abs(s[1]), -s[2]];
  return s;
}
// variant 'renorm': Y = max(Y, 0.15), then normalise; variant 'exact': Y = max(Y, 0.15) exactly, horizontal rescaled
export function mySunDir(hour, season, northDeg, sky, variant = 'renorm') {
  const s = rawDir(hour, season, northDeg, sky);
  if (s[1] >= 0.15) return s;
  if (variant === 'exact') { const h = Math.hypot(s[0], s[2]), k = h ? Math.sqrt(1 - 0.0225) / h : 0; return [s[0] * k, 0.15, s[2] * k]; }
  const v = [s[0], 0.15, s[2]], l = Math.hypot(...v); return v.map((x) => x / l);
}
export function mySky(hour, season, northDeg, sky, variant = 'renorm') {
  const h = clampH(hour), L = blend(sky, h, season);
  return { sunDir: mySunDir(h, season, northDeg, sky, variant), sunColor: L.sunColor, sunIntensity: L.sunI, hemiSky: L.hemiSky, hemiGround: L.hemiGround, hemiIntensity: L.hemiI,
    background: L.background, canopyColor: L.canopyColor, canopyVisible: L.canopyVisible, shrubColor: L.shrubColor, groundColor: L.groundColor };
}
export { keyAt, blend, mix };
// difference list of an app look against mine (colours exact, numbers 1e-9, direction 1e-9)
export function lookDiff(got, want, tag) {
  const f = [];
  if (!got) return [`${tag}: no result`];
  for (const k of ['sunColor', 'hemiSky', 'hemiGround', 'background', 'canopyColor', 'shrubColor', 'groundColor']) if (String(got[k]).toUpperCase() !== want[k]) f.push(`${tag} ${k} ${got[k]} != ${want[k]}`);
  for (const k of ['sunIntensity', 'hemiIntensity']) if (!(Math.abs(got[k] - want[k]) <= 1e-9)) f.push(`${tag} ${k} ${got[k]} != ${want[k]}`);
  if (got.canopyVisible !== want.canopyVisible) f.push(`${tag} canopyVisible ${got.canopyVisible}`);
  if (!Array.isArray(got.sunDir) || got.sunDir.length !== 3 || got.sunDir.some((x, i) => !(Math.abs(x - want.sunDir[i]) <= 1e-9))) f.push(`${tag} sunDir ${JSON.stringify(got.sunDir)} != ${JSON.stringify(want.sunDir.map((x) => +x.toFixed(9)))}`);
  return f;
}
export const hhmm = (h) => `${String(Math.floor(h + 1e-9)).padStart(2, '0')}:${String(Math.round((h - Math.floor(h + 1e-9)) * 60)).padStart(2, '0')}`;

// ---- the PM's shortfall warning (goals-and-stories round 11; F2-S3) ----
export const SHORT_RE = /^Only .+ of planting fits around the building, parking and pool: the 3D garden is smaller than the .+ % asked\. Try a lower footprint %, fewer cars or a smaller pool\.$/;
export const isShort = (text) => SHORT_RE.test(String(text || ''));
const p1 = (x) => String(Math.round(x * 10) / 10);
export const shortText = (placed, plotArea, effPct, unit) => `Only ${Q.fmtArea(placed, unit)} (${p1(placed / plotArea * 100)} % of the plot) of planting fits around the building, parking and pool: the 3D garden is smaller than the ${p1(effPct)} % asked. Try a lower footprint %, fewer cars or a smaller pool.`;
// placed area: the model's vegPlaced (site model first, the house's copy otherwise)
export function vegPlacedOf(PC, state) {
  const site = PC.site.analyse(state); if (site && typeof site.vegPlaced === 'number') return site.vegPlaced;
  const h = PC.house && PC.house.build ? PC.house.build(state) : null; return h && typeof h.site.vegPlaced === 'number' ? h.site.vegPlaced : null;
}
// FS reading (validate.js 'veg-short'): 80 % of min(veg.area, the A-9 cap area 120 x 6 + 200 x 1.5 = 1020 m²), since the
// item caps are not the building, parking or pool taking the room. Accepted by QA as consistent with the PM text.
export const CAP_AREA = CAP.trees * TREE_A + CAP.shrubs * SHRUB_A;
export const shouldWarn = (vegPct, placed, vegArea) => vegPct > 0 && vegArea > 0 && placed !== null && placed < 0.8 * Math.min(vegArea, CAP_AREA) - 1e-9;

// ---- scatter rules on the item centre (frame L) ----
// n(T, a): items of area a placed while placed + a / 2 <= T
export const nStop = (T, a) => (T + 1e-9 >= a / 2 ? Math.floor((T - a / 2 + 1e-9) / a) + 1 : 0);
const inR = (q, r) => q[0] > r.u + 1e-9 && q[0] < r.u + r.w - 1e-9 && q[1] > r.v + 1e-9 && q[1] < r.v + r.d - 1e-9;
export function exclusions(pL, site, extras, kind) {
  const c = kind === 'tree' ? CLEAR : 0, o = [['footprint + 1' + (c ? ' + c' : ''), grow(site.footprint, 1 + c)], ['path strip', myPath(pL, site.footprint, extras)]];
  if (site.parking) o.push(['parking' + (c ? ' + c' : ''), grow(site.parking, c)]);
  if (site.pool) o.push(['pool + 1' + (c ? ' + c' : ''), grow(site.pool, POOL_CLEAR + c)]);
  if (site.seating) o.push(['seating + 0.3', grow(site.seating, 0.3)]);
  return o;
}
// problems of one house model's vegetation (trees / shrubs [[u, v, s]]), against QA's rules
export function scatterProblems(house, pL, extras, vegArea, tag) {
  const f = [], st = { ...house.site, footprint: house.footprint }, T = st.trees || [], Sh = st.shrubs || [], nm = st.northMarker;
  const edgeD = (q) => Math.min(...pL.map((a, i) => distSeg(q, a, pL[(i + 1) % pL.length])));
  for (const [kind, list, edge] of [['tree', T, TREE_EDGE], ['shrub', Sh, SHRUB_EDGE]]) {
    const ex = exclusions(pL, st, extras, kind); let bad = 0;
    for (const it of list) {
      const q = [it[0], it[1]], s = it[2], p = [];
      if (!(s >= VEG_TABLE.scale[0] - 1e-12 && s <= VEG_TABLE.scale[1] + 1e-12)) p.push(`scale ${s}`);
      if (!inPolyL(q, pL)) p.push('outside the plot'); else if (edgeD(q) < edge - 1e-9) p.push(`${edgeD(q).toFixed(3)} m from the boundary (< ${edge})`);
      for (const [n, r] of ex) if (inR(q, r)) p.push(`inside ${n}`);
      if (nm && Math.hypot(q[0] - nm.u, q[1] - nm.v) < nm.L / 2 + 0.3 - 1e-9) p.push('inside the needle circle');
      if (p.length && bad++ < 3) f.push(`${tag}: ${kind} at (${q.map((x) => x.toFixed(2))}) ${p.join(', ')}`);
    }
    if (bad > 3) f.push(`${tag}: ${bad} ${kind}s break a rule`);
  }
  const close = (A, B, d, name, same) => { let n = 0, ex = null; for (let i = 0; i < A.length; i++) for (let j = same ? i + 1 : 0; j < B.length; j++) { const D = Math.hypot(A[i][0] - B[j][0], A[i][1] - B[j][1]); if (D < d - 1e-9) { n++; ex = ex || D; } } if (n) f.push(`${tag}: ${n} ${name} pair(s) closer than ${d} m (e.g. ${ex.toFixed(3)})`); };
  close(T, T, SPACE.tt, 'tree-tree', true); close(Sh, T, SPACE.st, 'shrub-tree', false); close(Sh, Sh, SPACE.ss, 'shrub-shrub', true);
  if (T.length > CAP.trees || Sh.length > CAP.shrubs) f.push(`${tag}: ${T.length} trees / ${Sh.length} shrubs over the caps`);
  const placed = TREE_A * T.length + SHRUB_A * Sh.length;
  if (typeof st.vegPlaced === 'number' && Math.abs(st.vegPlaced - placed) > 1e-9) f.push(`${tag}: vegPlaced ${st.vegPlaced} != 6 x ${T.length} + 1.5 x ${Sh.length} = ${placed}`);
  // stop rule (plan 2.5): trees while treeArea + 3 <= 0.6 A (cap 120), then shrubs while total + 0.75 <= A (cap 200)
  const tMax = Math.min(CAP.trees, nStop(0.6 * vegArea, TREE_A)), sMax = Math.min(CAP.shrubs, nStop(vegArea - TREE_A * T.length, SHRUB_A));
  if (T.length > tMax) f.push(`${tag}: ${T.length} trees, the stop rule allows ${tMax} (0.6 x ${vegArea.toFixed(2)} m²)`);
  if (Sh.length > sMax) f.push(`${tag}: ${Sh.length} shrubs, the stop rule allows ${sMax}`);
  return { f, placed, tMax, sMax, nT: T.length, nS: Sh.length };
}
