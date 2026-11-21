// F3-T3 QA oracle, written from docs/02-features/architecture.md (A-10 look tables and the one mix rule, A-11 placement
// rule, A-13 key-frame interpolation + day-weighted season blend). Imports no app code and none of the Designer's helpers
// (tests/unit/data-tables.test.mjs, docs/03-tasks/F3-T3/verify/check-colours.mjs).
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';

// The three data files (plus palette2d for the 2D tints), each run alone in a bare context: PC.data.* as plain JSON.
export function loadTables(src = join(ROOT, 'src')) {
  const ctx = vm.createContext({ PC: { data: {} } });
  ctx.globalThis = ctx;
  for (const f of ['palette2d.js', 'look3d.js', 'furniture.js', 'sky.js']) vm.runInContext(readFileSync(join(src, 'js/data', f), 'utf8'), ctx, { filename: f });
  return JSON.parse(JSON.stringify(ctx.PC.data));
}

// ---- colour: sRGB hex, the A-10 mix rule, CIELAB (D65) ----
export const ch = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const hex = (c) => '#' + c.map((v) => v.toString(16).toUpperCase().padStart(2, '0')).join('');
export const mix = (a, b, t) => { const p = ch(a), q = ch(b); return hex(p.map((v, i) => Math.round(v + (q[i] - v) * t))); };
const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
export const Y = (h) => { const [r, g, b] = ch(h).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export function Lab(h) {
  const [r, g, b] = ch(h).map(toLin);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Yv = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Yv) - 16, 500 * (f(X) - f(Yv)), 200 * (f(Yv) - f(Z))];
}
export const dE = (a, b) => { const p = Lab(a), q = Lab(b); return Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2); };
export const hueDeg = (h) => { const [, a, b] = Lab(h); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };
export const rgbCss = (h) => `rgb(${ch(h).join(', ')})`;

// ---- A-10 floor of a room: mix(roomTints[type or hall], wood, floorMix); stair / lift unmixed ----
export function floorOf(D, style, type) {
  if (type === 'stair' || type === 'lift') return D.roomTints[type];
  const I = D.interiors[style]; return mix(D.roomTints[type] || D.roomTints.hall, I.wood, I.floorMix);
}

// ---- A-13 ----
const NUM = ['sunI', 'hemiI'], COL = ['background', 'sunColor', 'hemiSky', 'hemiGround'];
export function keyAt(sky, hour) {
  const K = sky.keys; let i = K.length - 2;
  for (let j = 0; j < K.length - 1; j++) if (hour >= K[j].h && hour <= K[j + 1].h) { i = j; break; }
  const a = K[i], b = K[i + 1], t = b.h === a.h ? 0 : (hour - a.h) / (b.h - a.h), o = { h: hour };
  for (const n of NUM) o[n] = a[n] + (b[n] - a[n]) * t;
  for (const n of COL) o[n] = mix(a[n], b[n], t);
  return o;
}
export function blend(sky, hour, season) {
  const K = keyAt(sky, hour), s = sky.seasons[season], noon = sky.keys.find((k) => k.h === 12), day = Math.min(1, K.sunI / noon.sunI);
  return { sunI: K.sunI, hemiI: K.hemiI, day,
    sunColor: mix(K.sunColor, s.tint, s.tintAmount * day), hemiSky: mix(K.hemiSky, s.tint, s.tintAmount * day), background: mix(K.background, s.tint, s.tintAmount * day),
    hemiGround: mix(K.hemiGround, s.ground, sky.groundBounce * day), canopyColor: s.canopy, canopyVisible: s.canopyVisible, shrubColor: s.shrub, groundColor: s.ground };
}
// A-13 sun path (north = +y, east = +x, so no rotation matters for the up component): s.y = sin(E) sin(a); the moon
// direction at night has |s.y|; Y kept at 0.15 or more.
export function sunUp(sky, hour, season) { const E = sky.seasons[season].elevMax * Math.PI / 180, a = (hour - 6) / 12 * Math.PI; return Math.max(0.15, Math.abs(Math.sin(E) * Math.sin(a))); }
// Light on a horizontal top face (Lambert, linear luminance): sun * cos(incidence) + hemisphere sky term.
export function topLight(sky, hour, season) { const L = blend(sky, hour, season); return L.sunI * sunUp(sky, hour, season) * Y(L.sunColor) + L.hemiI * Y(L.hemiSky); }
export const isNight = (h) => h < 5 || h > 20;

// ---- A-11 placement rule ----
export const INSET = 0.15, OVERLAP = 0.01, SCALES = Array.from({ length: 9 }, (_, k) => (100 - 5 * k) / 100);
// One piece at scale s in the inner rectangle of a W x D room: returns its rectangle (centre-based) in frame P.
export function pose(p, s, W, D) {
  const x0 = INSET, x1 = W - INSET, y0 = INSET, y1 = D - INSET, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  let fx, fy, wAlongX = true;
  if (p.anchor === 'left' || p.anchor === 'right') { fx = p.d * s; fy = p.w * s; }
  else if (p.anchor === 'center') { wAlongX = W >= D; fx = (wAlongX ? p.w : p.d) * s; fy = (wAlongX ? p.d : p.w) * s; }
  else { fx = p.w * s; fy = p.d * s; }
  let cx = mx, cy = my;
  switch (p.anchor) {
    case 'back': cy = y1 - fy / 2; break;
    case 'front': cy = y0 + fy / 2; break;
    case 'left': cx = x0 + fx / 2; break;
    case 'right': cx = x1 - fx / 2; break;
    case 'bl': cx = x0 + fx / 2; cy = y1 - fy / 2; break;
    case 'br': cx = x1 - fx / 2; cy = y1 - fy / 2; break;
    case 'fl': cx = x0 + fx / 2; cy = y0 + fy / 2; break;
    case 'fr': cx = x1 - fx / 2; cy = y0 + fy / 2; break;
    case 'center': break;
    default: throw new Error('unknown anchor ' + p.anchor);
  }
  const [a, b] = p.off || [0, 0];
  if (p.anchor === 'center' && !wAlongX) { cy += a * s; cx -= b * s; } else { cx += a * s; cy += b * s; }
  return { id: p.id, s, l: cx - fx / 2, r: cx + fx / 2, f: cy - fy / 2, b: cy + fy / 2 };
}
const inside = (q, W, D) => q.l >= INSET - 1e-9 && q.r <= W - INSET + 1e-9 && q.f >= INSET - 1e-9 && q.b <= D - INSET + 1e-9;
// eps: an overlap of exactly 0.01 m is allowed by A-11 ("more than 0.01 m"); floating-point noise must not turn it into a clash
export let EPS = 1e-9; export const setEps = (e) => { EPS = e; };
const clash = (q, o) => Math.min(q.r, o.r) - Math.max(q.l, o.l) > OVERLAP + EPS && Math.min(q.b, o.b) - Math.max(q.f, o.f) > OVERLAP + EPS;
// Places a table (density 'full' | 'sparse') in a W x D room. placed: [{ id, s, l, r, f, b }], dropped: [id].
export function furnish(table, W, D, density) {
  const placed = [], dropped = [];
  for (const p of table.filter((x) => density === 'full' || x.sparse)) {
    let got = null;
    for (const s of SCALES) { const q = pose(p, s, W, D); if (inside(q, W, D) && !placed.some((o) => clash(q, o))) { got = q; break; } }
    if (got) placed.push(got); else dropped.push(p.id);
  }
  return { placed, dropped };
}

// Seeded PRNG (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
