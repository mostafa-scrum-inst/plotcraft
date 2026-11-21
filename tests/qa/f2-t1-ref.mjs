// QA reference model for the site rules (PM 3.1, 4.3; architecture A-5, A-6), written from the documents and NOT from
// src/js/core. Used by f2-t1-site.mjs to check PC.site / PC.validate / PC.sig. Everything here is plain arithmetic.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';

// Fresh PC from the core + data files of the manifest, in a bare context (own loader, not tests/helpers/load.mjs).
export function loadPC() {
  const man = JSON.parse(readFileSync(join(ROOT, 'src/manifest.json'), 'utf8'));
  const ctx = vm.createContext({});
  for (const j of man.js) if (j.layer === 'core' || j.layer === 'data') vm.runInContext(readFileSync(join(ROOT, 'src', j.file), 'utf8'), ctx, { filename: j.file });
  return ctx.PC;
}
export const plain = (x) => JSON.parse(JSON.stringify(x));
export const FT = 0.3048;
export const EPS = 1e-7;

// ---- polygons ----
export const signedArea = (p) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
export const perimeter = (p) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + Math.hypot(b[0] - a[0], b[1] - a[1]); }, 0);
export const ccw = (p) => (signedArea(p) < 0 ? [p[0], ...p.slice(1).reverse()] : p.slice());
export function inPoly(q, p) { // even-odd; boundary counts as inside
  let c = false; const n = p.length;
  for (let i = 0, j = n - 1; i < n; j = i++) { const a = p[i], b = p[j];
    if (distPtSeg(q, a, b) < 1e-9) return true;
    if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < a[0] + (q[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) c = !c; }
  return c;
}
export function distPtSeg(q, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(a[0] + t * dx - q[0], a[1] + t * dy - q[1]); }
const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function segsCrossProper(a, b, c, d) { const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b); return ((o1 > 1e-12 && o2 < -1e-12) || (o1 < -1e-12 && o2 > 1e-12)) && ((o3 > 1e-12 && o4 < -1e-12) || (o3 < -1e-12 && o4 > 1e-12)); }
function distSegSeg(a, b, c, d) { if (segsCrossProper(a, b, c, d)) return 0; return Math.min(distPtSeg(a, c, d), distPtSeg(b, c, d), distPtSeg(c, a, b), distPtSeg(d, a, b)); }
// rect = { u, v, w, d }
export const corners = (r) => [[r.u, r.v], [r.u + r.w, r.v], [r.u + r.w, r.v + r.d], [r.u, r.v + r.d]];
const inRectOpen = (q, r, e = 1e-9) => q[0] > r.u + e && q[0] < r.u + r.w - e && q[1] > r.v + e && q[1] < r.v + r.d - e;
export function distSegRect(a, b, r) { // 0 when the segment enters the rectangle
  if (inRectOpen(a, r, -1e-12) || inRectOpen(b, r, -1e-12)) return 0; const c = corners(r); let m = Infinity;
  for (let i = 0; i < 4; i++) m = Math.min(m, distSegSeg(a, b, c[i], c[(i + 1) % 4])); return m;
}
// Rectangle inside the polygon (boundary contact allowed, tolerance tol).
export function rectInPoly(r, p, tol = 1e-6) {
  const inner = { u: r.u + tol, v: r.v + tol, w: r.w - 2 * tol, d: r.d - 2 * tol }; if (inner.w <= 0 || inner.d <= 0) return false;
  for (const c of corners(inner)) if (!inPoly(c, p)) return false; if (!inPoly([r.u + r.w / 2, r.v + r.d / 2], p)) return false;
  const c = corners(inner); for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if (inRectOpen(a, inner) || inRectOpen(b, inner)) return false; for (let k = 0; k < 4; k++) if (segsCrossProper(a, b, c[k], c[(k + 1) % 4])) return false; }
  return true;
}
export const rectsOverlap = (a, b, tol = 1e-6) => a.u < b.u + b.w - tol && b.u < a.u + a.w - tol && a.v < b.v + b.d - tol && b.v < a.v + a.d - tol;

// ---- frame L (A-5): origin = start of the street edge, u along it, v = u turned +90 degrees (inward for a CCW plot) ----
export function toL(pts, edge) { const a = pts[edge], b = pts[(edge + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l; return pts.map((p) => [(p[0] - a[0]) * ux + (p[1] - a[1]) * uy, -(p[0] - a[0]) * uy + (p[1] - a[1]) * ux]); }
// Q6 default (4.1): edge with the lowest midpoint; tie: the longer; still tied: lowest index.
export function defaultStreetEdge(p) { let best = 0, by = Infinity, bl = 0; p.forEach((a, i) => { const b = p[(i + 1) % p.length], y = (a[1] + b[1]) / 2, l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (y < by - 1e-9 || (Math.abs(y - by) <= 1e-9 && l > bl + 1e-9)) { best = i; by = y; bl = l; } }); return best; }

// ---- 3.1 edge classes: back when the outward direction is within 40 degrees of straight away from the street ----
export function edgeClasses(pL, edge) { // pL: CCW polygon in L
  return pL.map((a, i) => { if (i === edge) return 'front'; const b = pL[(i + 1) % pL.length], du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv); const nx = dv / l, ny = -du / l; // outward normal of a CCW polygon
    const ang = Math.acos(Math.max(-1, Math.min(1, ny))) * 180 / Math.PI; // angle to (0, +1)
    return ang <= 40 + 1e-7 ? 'back' : 'side'; });
}
export const edgeAngle = (pL, i) => { const a = pL[i], b = pL[(i + 1) % pL.length], du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv); return Math.acos(Math.max(-1, Math.min(1, -du / l))) * 180 / Math.PI; };
export const setbacksOf = (classes, sb) => classes.map((c) => (c === 'front' ? sb.front : c === 'back' ? sb.back : sb.side));

// ---- buildable set (definition): inside the plot and at least the edge's setback from every edge segment ----
export function buildable(q, pL, sbOf, tol = 1e-9) { if (!inPoly(q, pL)) return false; for (let i = 0; i < pL.length; i++) if (sbOf[i] > 0 && distPtSeg(q, pL[i], pL[(i + 1) % pL.length]) < sbOf[i] - tol) return false; return true; }
// Exact: the whole rectangle is buildable.
export function rectBuildable(r, pL, sbOf, tol = 1e-6) { if (!rectInPoly(r, pL, tol)) return false; for (let i = 0; i < pL.length; i++) if (sbOf[i] > 0 && distSegRect(pL[i], pL[(i + 1) % pL.length], r) < sbOf[i] - tol) return false; return true; }
// The same by brute force (dense boundary + interior samples): used to cross-check rectBuildable itself.
export function rectBuildableSampled(r, pL, sbOf, step = 0.1, tol = 1e-6) { const nx = Math.max(2, Math.ceil(r.w / step)), ny = Math.max(2, Math.ceil(r.d / step)); for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) { const q = [r.u + r.w * i / nx, r.v + r.d * j / ny]; const qi = [Math.min(r.u + r.w - tol, Math.max(r.u + tol, q[0])), Math.min(r.v + r.d - tol, Math.max(r.v + tol, q[1]))]; if (!buildable(qi, pL, sbOf, 2 * tol)) return false; } return true; }
// Lattice figures as A-6 defines them: nodes at multiples of 0.25 m; bbox = extent of buildable nodes; area = buildable cell centres x 0.0625.
export function latticeBuildable(pL, sbOf, q = 0.25) {
  const us = pL.map((p) => p[0]), vs = pL.map((p) => p[1]), u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs); let box = null, cells = 0;
  for (let j = Math.ceil(v0 / q - 1e-9); j * q <= v1 + 1e-9; j++) for (let i = Math.ceil(u0 / q - 1e-9); i * q <= u1 + 1e-9; i++) { const u = i * q, v = j * q; if (!buildable([u, v], pL, sbOf)) continue; if (!box) box = { u0: u, v0: v, u1: u, v1: v }; else { box.u0 = Math.min(box.u0, u); box.u1 = Math.max(box.u1, u); box.v0 = Math.min(box.v0, v); box.v1 = Math.max(box.v1, v); } }
  for (let j = Math.floor(v0 / q); j < Math.ceil(v1 / q); j++) for (let i = Math.floor(u0 / q); i < Math.ceil(u1 / q); i++) if (buildable([(i + 0.5) * q, (j + 0.5) * q], pL, sbOf)) cells++;
  return { bbox: box, area: cells * q * q };
}
export const floor05 = (x) => Math.floor((x + 1e-9) / 0.5) * 0.5;
// Target size for a proportion r = width : depth (A-6 step 2).
export const targetSize = (A, r) => [Math.max(0.5, floor05(Math.sqrt(A * r))), Math.max(0.5, floor05(Math.sqrt(A / r)))];
// Largest rectangle with proportions w0 : d0 about a centre, as { w, d } rounded down to 0.5 m (steps 3 and 5), or null.
export function shrinkAt(c, w0, d0, pL, sbOf) { const at = (t) => rectBuildable({ u: c[0] - w0 * t / 2, v: c[1] - d0 * t / 2, w: w0 * t, d: d0 * t }, pL, sbOf); if (at(1)) return { w: w0, d: d0, t: 1 }; if (!buildable(c, pL, sbOf)) return null; let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (at(m)) lo = m; else hi = m; } if (lo <= 0) return null; let w = floor05(w0 * lo + 1e-3), d = floor05(d0 * lo + 1e-3); if (!(w > 0 && d > 0 && rectBuildable({ u: c[0] - w / 2, v: c[1] - d / 2, w, d }, pL, sbOf))) { w = floor05(w0 * lo); d = floor05(d0 * lo); } return { w, d, t: lo }; }
// A-6 step 4b (round 4, CD-1) is applied only when the app carries its marker PC.C.FOOTPRINT_STRETCH_RATIO (the suites set
// this from the app under test), so the model matches the rule the build claims to implement.
let STRETCH = false;
export const setStretch = (on) => { STRETCH = !!on; };
export const stretchOn = () => STRETCH;
// A-6 step 8 as corrected by the CTO at the F2 feature review (marker PC.C.FOOTPRINT_STRETCH_EXTRA, F3-T1): 4b candidates
// are capped at 3 x short + 0.5 m; without the marker the increment-1 cap 3 x (short + 0.5 m). Step-4 results keep 2 x (short + 0.5).
let CAPX = false;
export const setCapExtra = (on) => { CAPX = !!on; };
export const capExtraOn = () => CAPX;
export const capOf = (limit, short) => (limit === 3 && CAPX ? 3 * short + 0.5 : limit * (short + 0.5));
// Reference footprint by exhaustive search (steps 2-6 incl. the three-proportion fallback and, with STRETCH, step 4b).
// Slow: small plots only. Written from the A-6 / PM 3.1 text, independently of site-footprint.js.
export function refFootprint(pL, sbOf, pct, lat, opts = {}) {
  const stretch = opts.stretch === undefined ? STRETCH : opts.stretch;
  const A = pct / 100 * Math.abs(signedArea(pL)); if (!lat.bbox || lat.area < 20 - 1e-9) return { conflict: 'buildable-small' };
  const bb = lat.bbox, Wb = bb.u1 - bb.u0, Db = bb.v1 - bb.v0, c = [(bb.u0 + bb.u1) / 2, (bb.v0 + bb.v1) / 2], rb = Db > 0 ? Math.max(0.5, Math.min(2, Wb / Db)) : 2;
  const fits = (cc, w, d) => rectBuildable({ u: cc[0] - w / 2, v: cc[1] - d / 2, w, d }, pL, sbOf);
  let cands = null;
  const centres = () => { if (cands) return cands; cands = []; for (let v = Math.ceil(bb.v0 / 0.5) * 0.5; v <= bb.v1 + 1e-9; v += 0.5) for (let u = Math.ceil(bb.u0 / 0.5) * 0.5; u <= bb.u1 + 1e-9; u += 0.5) if (buildable([u, v], pL, sbOf)) cands.push([u, v, (u - c[0]) ** 2 + (v - c[1]) ** 2]); cands.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]); return cands; };
  // Fallback search for one proportion: the centre (nearest c first) giving the largest t, strict improvement only.
  const searchOne = (r) => { const [w, d] = targetSize(A, r); let bt = 0, bc = null; const c0 = shrinkAt(c, w, d, pL, sbOf); if (c0) { bt = c0.t; bc = c; }
    for (const k of centres()) { if (bt >= 1) break; const probe = Math.min(1, bt + 1e-6); if (!rectBuildable({ u: k[0] - w * probe / 2, v: k[1] - d * probe / 2, w: w * probe, d: d * probe }, pL, sbOf)) continue; const s = shrinkAt(k, w, d, pL, sbOf); if (s && s.t > bt) { bt = s.t; bc = [k[0], k[1]]; } }
    if (!bc) return null; const fin = shrinkAt(bc, w, d, pL, sbOf); return fin && { w: fin.w, d: fin.d, area: fin.w * fin.d, centre: bc, clamped: fin.t < 1, moved: bc !== c, fallback: true }; };
  // Steps 3-4 for a list of proportions: centred try with the first, accepted if full, or shrunk but keeping half the
  // target and rounding to 20 m2 or more; otherwise the fallback over every proportion of the list, largest area first.
  // A-6 step 8 (TL ruling, F2-T3 increment-1 review): after the final rounding the long side is at most
  // limit x (short + 0.5 m), limit 2 for step-4 results and 3 for the 4b candidates; a longer side is shortened about
  // the same centre to floor05(limit x (short + 0.5)). Applied to every candidate before candidates are compared.
  const cap = (x, limit) => { if (!x) return x; const sh = Math.min(x.w, x.d), mx = capOf(limit, sh); if (Math.max(x.w, x.d) <= mx + 1e-9) return x; const L = floor05(mx); return x.w >= x.d ? { ...x, w: L, area: L * x.d, capped: true } : { ...x, d: L, area: x.w * L, capped: true }; };
  const stepFour = (rs, limit) => { const [w0, d0] = targetSize(A, rs[0]), cen = cap(shrinkAt(c, w0, d0, pL, sbOf), limit);
    if (cen && (cen.t >= 1 || cen.t * cen.t * w0 * d0 >= A / 2) && cen.w * cen.d >= 20 - 1e-9) return { w: cen.w, d: cen.d, area: cen.w * cen.d, centre: c, clamped: cen.t < 1, moved: false, fallback: false, capped: !!cen.capped };
    let best = null; for (const r of rs) { const x = cap(searchOne(r), limit); if (x && (!best || x.area > best.area + 1e-9)) best = x; } return best; };
  let res = stepFour([rb, 0.5, 2], 2);
  if (stretch && res && res.clamped) {
    const step4 = { ...res, kind: 'step4' }, out = [step4], long = Math.max(step4.w, step4.d), short = Math.min(step4.w, step4.d), alongU = step4.w >= step4.d;
    // (a) stretch: at its proportion limit -> same centre and short side, long side +0.5 m while it fits, up to min(3 x short, A / short)
    if (step4.w !== step4.d && long >= 2 * short - 0.5 - 1e-9) { const lim = Math.min(3 * short, A / short); let L = long;
      while (L + 0.5 <= lim + 1e-9 && fits(step4.centre, alongU ? L + 0.5 : short, alongU ? short : L + 0.5)) L += 0.5;
      out.push({ ...step4, w: alongU ? L : short, d: alongU ? short : L, area: L * short, stretched: L > long, kind: 'stretch' }); }
    // (b) 3:1 and 1:3, each by steps 3-4 (centred try, then the fallback for that proportion)
    for (const r of [3, 1 / 3]) { const x = stepFour([r], 3); if (x) out.push({ ...x, try: r === 3 ? '3:1' : '1:3', kind: r === 3 ? '3:1' : '1:3' }); }
    res = out.reduce((b, x) => (x.area > b.area + 1e-9 ? x : b), out[0]);
    // clamped after 4b: only rounding lost (long side = floor05(A / short side)) is not a clamp
    const lg = Math.max(res.w, res.d), sh = Math.min(res.w, res.d), alongU2 = res.w >= res.d;
    res = { ...res, ran4b: true, step4, clamped: Math.abs(lg - floor05(A / sh)) > 1e-9 };
    if (res.clamped) res.reason = lg >= 3 * sh - 0.5 - 1e-9 && fits(res.centre, alongU2 ? lg + 0.5 : sh, alongU2 ? sh : lg + 0.5) ? 'proportion' : 'setbacks';
    res.moved = res.centre !== c && (res.centre[0] !== c[0] || res.centre[1] !== c[1]);
  }
  return res && res.area >= 20 - 1e-9 ? res : { conflict: 'no-fit' };
}

// ---- 4.2 / 4.3 numbers, typed in from the PM document ----
export const ROOM_AREA = { bedroom: { S: 12, M: 16, L: 24 }, bathroom: { S: 4, M: 6, L: 9 }, kitchen: { S: 9, M: 14, L: 20 }, living: { S: 20, M: 30, L: 42 }, dining: { S: 12, M: 16, L: 24 }, majlis: { S: 16, M: 24, L: 36 }, office: { S: 9, M: 12, L: 16 }, maid: { S: 6, M: 9, L: 12 }, storage: { S: 4, M: 6, L: 9 }, laundry: { S: 4, M: 6, L: 9 } };
export const POOL = { S: [3, 6], M: [4, 8], L: [5, 10] };
export const levelIds = (a) => (a.basement ? ['B'] : []).concat(['G', '1', '2'].slice(0, a.floors));
export const stairsExist = (a) => levelIds(a).length + (a.usableRoof ? 1 : 0) >= 2;
export const needed = (a, id) => a.rooms.filter((r) => r.level === id).reduce((s, r) => s + (r.size === null ? r.area : ROOM_AREA[r.type][r.size]), 0) + (stairsExist(a) ? 10 : 0) + (stairsExist(a) && a.lift ? 3 : 0);
export const fmtArea = (m2, u) => (u === 'ft' ? Math.round(m2 / (FT * FT)) + ' sq ft' : Math.round(m2) + ' m²');
export const fmtLen = (m, u) => (u === 'ft' ? (m / FT).toFixed(1) + ' ft' : m.toFixed(1) + ' m');

// Parking / pool fix hints (PM round 5, F3-T1). The wording is not final; QA checks that the hint names at least two answers
// that really help and none that works against it. Directions measured on the app's site model over 6 400 rectangular cases
// (QA, 2026-11-20): parking left out -> a LARGER front setback helps in 393 cases, a smaller one in 45; fewer cars 315;
// a lower footprint % 795. Pool left out -> a LARGER back setback 392, a smaller one 16; smaller side setbacks 316;
// a smaller pool 324; a lower footprint % 736.
export const HINTS = {
  'parking-omitted': { good: [/fewer cars/i, /lower footprint %/i, /larger front setback/i], bad: [/smaller front setback/i] },
  'pool-omitted': { good: [/smaller pool/i, /lower footprint %/i, /larger back setback/i, /smaller side setbacks?/i], bad: [/smaller back setback/i] },   // a generic "smaller setbacks" is half right (sides) and counts for neither
};
export const hintProblems = (code, text) => { const h = HINTS[code], t = text || '', n = h.good.filter((re) => re.test(t)).length, f = [];
  if (n < 2) f.push(`${code} text names ${n} helpful answer(s): "${t}"`); for (const re of h.bad) if (re.test(t)) f.push(`${code} hint advises ${re.source.replace(/\\|\?/g, '')}, which works against it: "${t}"`); return f; };
