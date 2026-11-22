// F6-T1 QA reference (own expectations, from docs/03-tasks/F6-T1/plan.md, plan-review.md, cto-constraints.md and
// designer-plan.md; no FS helper is used for an expectation).
//   budgets (C-4 / plan §8, maximum house): meshes <= 64 (budget.test line; G6 150), draw calls <= 160 including the shadow
//     pass, triangles <= 300 000, transparent meshes <= 2 and only poolWater / blobs (Q-T5), textures <= 12 and <= 16 MB.
//   sky dome (plan §4.1 / D1, Q-T3): vertex colour by elevation e (deg): e < 0 horizon; 0..15 horizon -> mid; >= 15 mid ->
//     zenith over 15..90; the lerp is linear-space (GPU interpolation of col() vertex colours), output toneMapped: false,
//     so a sky pixel is sRGB(lerp(lin(a), lin(b), t)). Read +-3 per channel (TL Q-T7).
//   horizon seam (C-4.4): the pixel just above vs just below the horizon at a low pose differs by <= 3 per channel at
//     12 / 17.5 / 22 h (full tier; no seam assertion in lite).
//   highlight (Q-T2): unlit, reads #C2410C +-2 at every hour.
export const BUDGET = { meshes: 64, calls: 160, tris: 300000, transparent: 2, transparentNames: ['poolWater', 'blobs'], textures: 12, texMB: 16 };
export const BUDGET_F4 = { meshes: 40 };   // before F6-T1 (F4 review probe line)
export const HIGHLIGHT = '#C2410C', SEAM = 3, SKY_TOL = 3, HL_TOL = 2, SEAM_HOURS = [12, 17.5, 22];

export const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).replace('#', '').padStart(6, '0').slice(i - 1, i + 1), 16));
export const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const srgb = (l) => { const c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); };
const lerpLin = (a, b, t) => { const A = hex2rgb(a).map(lin), B = hex2rgb(b).map(lin); return A.map((x, i) => srgb(x + (B[i] - x) * t)); };
// sky pixel (sRGB triple) at elevation e (degrees) for the look's three stops
export function domeRGB(e, L) {
  if (e < 0) return hex2rgb(L.skyHorizon);
  if (e < 15) return lerpLin(L.skyHorizon, L.skyMid, e / 15);
  return lerpLin(L.skyMid, L.skyZenith, Math.min(1, (e - 15) / 75));
}
export const maxDiff = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));

// mulberry32: the leak suite's operation stream is reproducible from its seed
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
