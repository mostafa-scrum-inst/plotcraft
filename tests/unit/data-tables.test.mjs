// F3-T3 Designer (with QA): the 3D look, furniture and sky tables (A-10, A-11, A-13) and the stage-2 / stage-4 swatch
// CSS that must carry the same hex values. Rules and ranges are checked, not exact colours, except where CSS = table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore, plain, manifest, SRC } from '../helpers/load.mjs';

const PC = loadCore(), C = plain(PC.C);
const X = plain(PC.data.exteriors), I = plain(PC.data.interiors), T = plain(PC.data.roomTints), S = plain(PC.data.siteColors);
const SKY = plain(PC.data.sky), F = plain(PC.data.furniture), P2 = plain(PC.data.palette2d);
const HEX = /^#[0-9A-F]{6}$/;

// sRGB hex helpers: the A-10 mix rule (per-channel lerp, Math.round) and CIELAB (D65) for ΔE76 / hue / L*.
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const q = rgb(b); return '#' + rgb(a).map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0').toUpperCase()).join(''); };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const lab = (h) => {
  const [r, g, b] = rgb(h).map(lin), f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const hue = (h) => { const [, a, b] = lab(h); return Math.atan2(b, a) * 180 / Math.PI; };

const EXT_KEYS = ['wall', 'wallInner', 'slab', 'roof', 'trim', 'parapet', 'frame', 'door'];   // F6-T1b: + frame, door (Designer A2 / Q-D3)
const INT_KEYS = ['fabric', 'wood', 'accent', 'white', 'metal', 'dark', 'floorMix'];
const SITE_KEYS = ['ground', 'groundOuter', 'paving', 'poolWater', 'poolRim', 'boundaryWall', 'gate', 'carCanopy', 'seating', 'trunk', 'northMarker', 'highlight', 'asphalt', 'glassTop', 'glassBottom'];   // F6-T1a: + asphalt; F6-T1b: + glassTop, glassBottom
const KEY_KEYS = ['h', 'background', 'sunColor', 'sunI', 'hemiSky', 'hemiGround', 'hemiI', 'skyMid', 'skyZenith', 'exposure'];   // F6-T1a: the dome rows + exposure
const SEASON_KEYS = ['elevMax', 'tint', 'tintAmount', 'canopy', 'canopyVisible', 'shrub', 'ground'];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const PIECE_KEYS = ['id', 'w', 'd', 'h', 'y0', 'anchor', 'color', 'sparse'];
const ANCHORS = ['back', 'front', 'left', 'right', 'bl', 'br', 'fl', 'fr', 'center'];
const COLOR_KEYS = ['fabric', 'wood', 'accent', 'white', 'metal', 'dark'];

test('F3-T3 tables: option keys and exact key lists', () => {
  assert.deepEqual(Object.keys(X), C.ENUM.exterior);
  assert.deepEqual(Object.keys(I), C.ENUM.interiorStyle);
  assert.deepEqual(Object.keys(T), [...C.ROOM_TYPES, 'hall', 'stair', 'lift']);
  assert.deepEqual(Object.keys(F), C.ROOM_TYPES);
  assert.deepEqual(Object.keys(S), SITE_KEYS);
  assert.deepEqual(Object.keys(SKY), ['keys', 'seasons', 'groundBounce']);
  assert.deepEqual(Object.keys(SKY.seasons), SEASONS);
  for (const [k, v] of Object.entries(X)) assert.deepEqual(Object.keys(v), EXT_KEYS, k);
  for (const [k, v] of Object.entries(I)) assert.deepEqual(Object.keys(v), INT_KEYS, k);
  for (const k of SKY.keys) assert.deepEqual(Object.keys(k), KEY_KEYS, 'key ' + k.h);
  for (const [k, v] of Object.entries(SKY.seasons)) assert.deepEqual(Object.keys(v), SEASON_KEYS, k);
});

test('F3-T3 tables: value types (colours #RRGGBB upper case; the few numbers in range)', () => {
  const colours = [...Object.values(X).flatMap(Object.values), ...Object.values(T), ...Object.values(S),
    ...Object.values(I).flatMap((v) => COLOR_KEYS.map((k) => v[k])),
    ...SKY.keys.flatMap((k) => [k.background, k.sunColor, k.hemiSky, k.hemiGround, k.skyMid, k.skyZenith]),
    ...Object.values(SKY.seasons).flatMap((s) => [s.tint, s.canopy, s.shrub, s.ground])];
  for (const c of colours) assert.match(c, HEX);
  for (const [k, v] of Object.entries(I)) assert.ok(typeof v.floorMix === 'number' && v.floorMix >= 0 && v.floorMix <= 0.3, k + ' floorMix');
  for (const k of SKY.keys) for (const n of ['h', 'sunI', 'hemiI']) assert.ok(Number.isFinite(k[n]), n);
  for (const k of SKY.keys) assert.ok(k.sunI >= 0 && k.sunI <= 1.5 && k.hemiI >= 0 && k.hemiI <= 1.5, 'intensities at ' + k.h);
  for (const k of SKY.keys) assert.ok(k.exposure >= 0.5 && k.exposure <= 2, 'F6-T1a exposure at ' + k.h);
  assert.deepEqual(SEASONS.map((s) => SKY.seasons[s].elevMax), [52, 72, 52, 32]);
  for (const s of SEASONS) {
    const v = SKY.seasons[s];
    assert.ok(v.tintAmount >= 0 && v.tintAmount <= 0.5, s + ' tintAmount');
    assert.equal(typeof v.canopyVisible, 'boolean', s);
  }
  assert.equal(SKY.groundBounce, 0.25);
});

test('F3-T3 roomTints: 3D tints match the 2D tints (hue within 3 degrees, L* 5-12 lower); distinct after every floorMix', () => {
  for (const t of C.ROOM_TYPES) {
    const dh = Math.abs(((hue(T[t]) - hue(P2.room[t])) % 360 + 540) % 360 - 180), dL = lab(P2.room[t])[0] - lab(T[t])[0];
    assert.ok(dh <= 3, `${t} hue off by ${dh.toFixed(2)}`);
    assert.ok(dL >= 5 && dL <= 12, `${t} L* lower by ${dL.toFixed(1)}`);
  }
  for (const [st, v] of Object.entries(I)) {
    const fl = C.ROOM_TYPES.map((t) => [t, mix(T[t], v.wood, v.floorMix)]);
    for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) {
      const d = dE(fl[i][1], fl[j][1]);
      assert.ok(d >= 5.5, `${st}: ${fl[i][0]} / ${fl[j][0]} floors ΔE ${d.toFixed(1)}`);
    }
  }
});

test('F3-T3 siteColors.ground equals the summer ground (build-time grass before applyLook)', () => {
  assert.equal(S.ground, SKY.seasons.summer.ground);
});

test('F3-T3 furniture: A-11 schema, counts, height cap, sparse set fits the S room', () => {
  for (const t of C.ROOM_TYPES) {
    const L = F[t], ids = L.map((p) => p.id);
    assert.ok(L.length >= 3 && L.length <= 8, `${t}: ${L.length} pieces`);
    assert.equal(new Set(ids).size, ids.length, t + ' ids unique');
    for (const p of L) {
      const at = `${t}.${p.id}`;
      assert.deepEqual(Object.keys(p).filter((k) => k !== 'off'), PIECE_KEYS, at);
      assert.ok(p.w > 0 && p.d > 0 && p.h >= 0.05 && p.y0 >= 0 && p.y0 + p.h <= 1.1 + 1e-9, at + ' sizes');
      assert.ok(ANCHORS.includes(p.anchor), at + ' anchor');
      assert.ok(COLOR_KEYS.includes(p.color), at + ' colour');
      assert.equal(typeof p.sparse, 'boolean', at + ' sparse');
      if ('off' in p) assert.ok(Array.isArray(p.off) && p.off.length === 2 && p.off.every((v) => Number.isFinite(v) && Math.abs(v) <= 1.2), at + ' off');
    }
    const sp = L.filter((p) => p.sparse), Sm2 = C.ROOM_SIZE[t].S;
    assert.ok(sp.length >= 1 && L.length - sp.length >= 2, `${t}: ${sp.length} sparse, ${L.length - sp.length} full-only`);
    for (const p of sp) assert.ok(Math.max(p.w, p.d) <= Math.sqrt(Sm2) - 0.3 + 1e-9, `${t}.${p.id} too large for the S room`);
    const area = sp.reduce((a, p) => a + p.w * p.d, 0);
    assert.ok(area <= 0.4 * Sm2 + 1e-9, `${t}: sparse area ${area.toFixed(2)} > 40 % of ${Sm2}`);
  }
});

// A-13 reference: key-frame interpolation then the day-weighted season blend; E_top = Lambert top-face light sum.
const noonKey = SKY.keys.find((k) => k.h === 12);
function look(h, season) {
  const K = SKY.keys; let i = 0; while (K[i + 1].h < h) i++;
  const a = K[i], b = K[i + 1], t = (h - a.h) / (b.h - a.h), k = {};
  for (const n of KEY_KEYS) k[n] = typeof a[n] === 'string' ? mix(a[n], b[n], t) : a[n] + (b[n] - a[n]) * t;
  const s = SKY.seasons[season], day = Math.min(1, k.sunI / noonKey.sunI), w = s.tintAmount * day;
  return { ...k, sunColor: mix(k.sunColor, s.tint, w), hemiSky: mix(k.hemiSky, s.tint, w), background: mix(k.background, s.tint, w),
    hemiGround: mix(k.hemiGround, s.ground, SKY.groundBounce * day) };
}
function eTop(h, season) {
  const L = look(h, season), E = SKY.seasons[season].elevMax * Math.PI / 180;
  const sy = Math.max(Math.abs(Math.sin(E) * Math.sin((h - 6) / 12 * Math.PI)), 0.15);
  return L.sunI * sy * lum(L.sunColor) + L.hemiI * lum(L.hemiSky);
}

test('F3-T3 sky keys: order, 0..24 closed loop, noon key, night dark but visible in every season after the blend', () => {
  const K = SKY.keys;
  for (let i = 1; i < K.length; i++) assert.ok(K[i].h > K[i - 1].h, 'increasing at ' + K[i].h);
  assert.equal(K[0].h, 0); assert.equal(K[K.length - 1].h, 24);
  for (const n of KEY_KEYS.slice(1)) assert.equal(K[K.length - 1][n], K[0][n], 'last = first: ' + n);
  assert.ok(noonKey, 'a key at h = 12');
  const night = K.filter((k) => k.h < 5 || k.h > 20);
  assert.ok(night.length >= 2);
  for (const k of night) assert.ok(k.hemiI >= 0.25 && k.sunI <= 0.25 * noonKey.sunI, 'night key ' + k.h);
  for (const s of SEASONS) {
    const noon = eTop(12, s);
    for (const k of night) {
      assert.ok(noon >= 5 * eTop(k.h, s), `${s}: noon ${noon.toFixed(2)} vs night ${k.h} ${eTop(k.h, s).toFixed(2)}`);
      assert.ok(lab(look(k.h, s).background)[0] <= 15, `${s}: night background at ${k.h} too light`);
    }
    assert.ok(eTop(12, s) > eTop(17.5, s) && eTop(17.5, s) > eTop(22, s), s + ': presets noon > evening > night');
  }
});

test('F3-T3 seasons: bare winter, autumn colours, snow ground, four distinct looks', () => {
  const s = SKY.seasons;
  assert.equal(s.winter.canopyVisible, false);
  for (const n of ['spring', 'summer', 'autumn']) assert.equal(s[n].canopyVisible, true, n);
  assert.ok(dE(s.autumn.canopy, s.summer.canopy) >= 20);
  assert.ok(lab(s.winter.ground)[0] >= 90);
  assert.equal(new Set(SEASONS.map((n) => s[n].canopy + s[n].ground)).size, 4);
  assert.equal(s.summer.tintAmount, 0);
});

// Static CSS parse: custom properties declared by the rule whose selector is exactly `sel`.
function props(css, sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('(?:^|[}\\s,])' + esc + '\\s*[,{]([^}]*)', 'm').exec(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  assert.ok(m, 'no rule for ' + sel);
  return Object.fromEntries([...(m[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g))].map((x) => [x[1], x[2].trim().toUpperCase()]));
}
test('F3-T3 CSS equals the tables: stage-4 hint properties and the stage-2 exterior swatches', () => {
  const css4 = readFileSync(join(SRC, 'css/43-stage-interior.css'), 'utf8'), css2 = readFileSync(join(SRC, 'css/41-stage-questions.css'), 'utf8');
  const want = (v) => ({ 'h-fabric': v.fabric, 'h-wood': v.wood, 'h-accent': v.accent, 'h-metal': v.metal, 'h-dark': v.dark, 'h-floor': mix(T.living, v.wood, v.floorMix) });
  for (const [st, v] of Object.entries(I)) assert.deepEqual(props(css4, '.pc-hint--' + st), want(v), st);
  assert.deepEqual(props(css4, '.pc-hint--density'), want(I.modern), 'Q19 default = Modern');
  for (const st of ['classic', 'minimal']) {
    assert.deepEqual(props(css4, `.pc-interior:has(input[name="q-interior-style"][value="${st}"]:checked) .pc-hint--density`), want(I[st]), 'Q19 follows ' + st);
  }
  for (const [k, v] of Object.entries(X)) assert.deepEqual(props(css2, '.pc-sw-' + k), { 'x-wall': v.wall, 'x-trim': v.trim, 'x-roof': v.roof }, k);
});

test('F3-T3 data files are in the manifest data layer, after room-labels, in the order look3d, furniture, sky', () => {
  const files = manifest().js.filter((j) => j.layer === 'data').map((j) => j.file);
  assert.deepEqual(files.slice(files.indexOf('js/data/room-labels.js') + 1, files.indexOf('js/data/room-labels.js') + 4), ['js/data/look3d.js', 'js/data/furniture.js', 'js/data/sky.js']);
});

test('F4-T3 vegetation table (Designer section 1): exact keys, sizes, counting areas within 10 %, canopy on its trunk, bare tree above the wall', () => {
  const V = plain(PC.data.vegetation);
  assert.deepEqual(Object.keys(V), ['tree', 'shrub', 'scale']);
  assert.deepEqual(Object.keys(V.tree), ['trunkR', 'trunkH', 'canopyR', 'canopyY0', 'canopyH', 'trunkSeg', 'canopySeg']);
  assert.deepEqual(Object.keys(V.shrub), ['r', 'h', 'seg']);
  for (const v of [...Object.values(V.tree), ...Object.values(V.shrub)]) assert.ok(typeof v === 'number' && v > 0);
  for (const n of [V.tree.trunkSeg, V.tree.canopySeg, V.shrub.seg]) assert.ok(Number.isInteger(n) && n >= 3);
  assert.ok(Math.abs(Math.PI * V.tree.canopyR ** 2 - 6) <= 0.6, 'tree counts 6 m2 (A-9)');
  assert.ok(Math.abs(Math.PI * V.shrub.r ** 2 - 1.5) <= 0.15, 'shrub counts 1.5 m2 (A-9)');
  assert.ok(V.tree.canopyY0 < V.tree.trunkH, 'canopy sits on its trunk');
  assert.ok(V.tree.trunkH > 1.2, 'bare tree stands above the 1.2 m wall');
  assert.equal(V.scale.length, 2); assert.ok(V.scale[0] >= 0.5 && V.scale[0] < V.scale[1] && V.scale[1] <= 1.5);
});

test('F4-T3 time-slider track (Designer plan 3): both gradients = PC.data.sky.keys, stop at h / 24 in the key background', () => {
  const css = readFileSync(join(SRC, 'css/44-stage-3d.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const want = SKY.keys.map((k) => [k.background, Math.round(k.h / 24 * 100 * 1e4) / 1e4]);
  for (const pseudo of ['::-webkit-slider-runnable-track', '::-moz-range-track']) {
    const m = new RegExp('\\.pc-range--sky' + pseudo + '\\s*\\{[^}]*linear-gradient\\(to right, ([^)]*)\\)').exec(css);
    assert.ok(m, pseudo);
    const got = m[1].split(',').map((x) => x.trim().split(/\s+/)).map(([c, p]) => [c, parseFloat(p)]);
    assert.deepEqual(got, want, pseudo);
  }
});
