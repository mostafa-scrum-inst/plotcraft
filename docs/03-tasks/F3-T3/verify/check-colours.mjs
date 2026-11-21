// F3-T3 Designer verification (not part of run-all): reprints the plan's colour, contrast and light figures from the
// final data files and reruns the furnish simulation under the A-11 placement rule (TL plan-review ruling 3).
// Usage: node docs/03-tasks/F3-T3/verify/check-colours.mjs   (exit 1 when a binding requirement fails)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore, plain, SRC } from '../../../../tests/helpers/load.mjs';

const PC = loadCore();
const X = plain(PC.data.exteriors), I = plain(PC.data.interiors), T = plain(PC.data.roomTints), S = plain(PC.data.siteColors);
const SKY = plain(PC.data.sky), F = plain(PC.data.furniture), P2 = plain(PC.data.palette2d), C = PC.C;
let fail = 0;
const req = (ok, msg) => { if (!ok) { fail++; console.log('  FAIL', msg); } };

// ---- colour helpers (CIELAB D65, ΔE76; WCAG luminance) ----
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (a) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = hex2(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const lab = (h) => {
  const [r, g, b] = hex2(h).map(lin), f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const hue = (h) => { const [, a, b] = lab(h); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };
const chroma = (h) => { const [, a, b] = lab(h); return Math.hypot(a, b); };
const mix = (a, b, t) => { const p = hex2(a), q = hex2(b); return toHex(p.map((v, i) => v + (q[i] - v) * t)); };
const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
const minPair = (obj, keys = Object.keys(obj)) => {
  let m = Infinity, p = '';
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const d = dE(obj[keys[i]], obj[keys[j]]); if (d < m) { m = d; p = keys[i] + '/' + keys[j]; } }
  return [m, p];
};

console.log('== 1.1 exteriors');
for (const [k, e] of Object.entries(X)) {
  console.log(`  ${k.padEnd(10)} wall/grass ${f1(dE(e.wall, S.ground))}  wall/trim ${f1(dE(e.wall, e.trim))}  roof/trim ${f1(dE(e.roof, e.trim))}  wall/snow ${f1(dE(e.wall, SKY.seasons.winter.ground))}`);
  req(dE(e.wall, S.ground) >= 40, k + ' wall vs grass >= 40');
}
console.log('  smallest exterior wall pair ΔE', minPair(Object.fromEntries(Object.entries(X).map(([k, e]) => [k, e.wall]))).map((v) => (typeof v === 'number' ? f1(v) : v)).join(' '));

console.log('== 1.2 / 1.3 interiors, floors (floor = mix(roomTint, wood, floorMix))');
const TYPES = C.ROOM_TYPES;
for (const t of TYPES) {
  const dh = Math.abs(((hue(T[t]) - hue(P2.room[t]) + 540) % 360) - 180), dL = lab(P2.room[t])[0] - lab(T[t])[0];
  console.log(`  ${t.padEnd(9)} 2D ${P2.room[t]} 3D ${T[t]}  hue Δ ${f2(dh)}°  L* −${f1(dL)}  chroma × ${f2(chroma(T[t]) / chroma(P2.room[t]))}`);
  req(dh <= 3 && dL >= 5 && dL <= 12, t + ' tint matches 2D');
}
for (const [st, s] of Object.entries(I)) {
  const fl = {}; for (const t of [...TYPES, 'hall']) fl[t] = mix(T[t], s.wood, s.floorMix);
  const [m, p] = minPair(fl, TYPES), [mh, ph] = minPair(fl);
  let worst = [Infinity, ''];
  for (const t of TYPES) for (const piece of F[t]) { const d = dE(s[piece.color], fl[t]); if (d < worst[0]) worst = [d, `${t}.${piece.id} (${piece.color})`]; }
  const wi = Math.min(...Object.values(X).flatMap((e) => Object.values(fl).map((f) => dE(e.wallInner, f))));
  console.log(`  ${st.padEnd(8)} type pairs min ΔE ${f1(m)} (${p}); incl. hall ${f1(mh)} (${ph}); piece vs own floor min ${f1(worst[0])} ${worst[1]}; wallInner vs floors min ${f1(wi)}; --h-floor ${fl.living}`);
  req(m >= 5.5, st + ' type pairs >= 5.5');
  req(worst[0] >= 10, st + ' piece vs own floor >= 10');
}
for (const c of ['fabric', 'wood', 'accent']) {
  const st = Object.keys(I);
  console.log(`  style ΔE ${c}: ` + st.flatMap((a, i) => st.slice(i + 1).map((b) => `${a}/${b} ${f1(dE(I[a][c], I[b][c]))}`)).join(', '));
}

console.log('== 1.4 site');
console.log(`  groundOuter/grass ${f1(dE(S.groundOuter, S.ground))} /paving ${f1(dE(S.groundOuter, S.paving))} /snow ${f1(dE(S.groundOuter, SKY.seasons.winter.ground))}; paving/grass ${f1(dE(S.paving, S.ground))} /snow ${f1(dE(S.paving, SKY.seasons.winter.ground))}; trunk/snow ${f1(dE(S.trunk, SKY.seasons.winter.ground))}`);

// ---- 3. sky: reference blend (A-13) and a Lambert top-face light estimate ----
console.log('== 3 sky (A-13 day-weighted season blend, groundBounce ' + SKY.groundBounce + ')');
const noonKey = SKY.keys.find((k) => k.h === 12);
function keyAt(h) {
  const K = SKY.keys; let i = 0; while (K[i + 1].h < h) i++;
  const a = K[i], b = K[i + 1], t = (h - a.h) / (b.h - a.h), o = { h };
  for (const k of Object.keys(a)) if (k !== 'h') o[k] = typeof a[k] === 'string' ? mix(a[k], b[k], t) : a[k] + (b[k] - a[k]) * t;
  return o;
}
function look(h, season) {
  const K = keyAt(h), s = SKY.seasons[season], day = Math.min(1, K.sunI / noonKey.sunI), w = s.tintAmount * day;
  return { ...K, sunColor: mix(K.sunColor, s.tint, w), hemiSky: mix(K.hemiSky, s.tint, w), background: mix(K.background, s.tint, w),
    hemiGround: mix(K.hemiGround, s.ground, SKY.groundBounce * day) };
}
function eTop(h, season) {
  const L = look(h, season), E = SKY.seasons[season].elevMax * Math.PI / 180, a = (h - 6) / 12 * Math.PI;
  const sy = Math.max(Math.abs(Math.sin(E) * Math.sin(a)), 0.15);
  return L.sunI * sy * lum(L.sunColor) + L.hemiI * lum(L.hemiSky);
}
const night = SKY.keys.filter((k) => k.h < 5 || k.h > 20);
for (const season of Object.keys(SKY.seasons)) {
  const noon = eTop(12, season), rows = [8, 12, 17.5, 22].map((h) => `${h}h ${f2(eTop(h, season))}`);
  const nMax = Math.max(...night.map((k) => eTop(k.h, season))), bgL = Math.max(...night.map((k) => lab(look(k.h, season).background)[0]));
  console.log(`  ${season.padEnd(6)} E_top ${rows.join('  ')}  noon/night ≥ ${f1(noon / nMax)}  night background L* ≤ ${f1(bgL)}`);
  req(noon / nMax >= 5, season + ' noon >= 5 x night');
  req(bgL <= 15, season + ' night background L* <= 15');
  req(eTop(12, season) > eTop(17.5, season) && eTop(17.5, season) > eTop(22, season), season + ' noon > evening > night');
}
const sc = SKY.seasons;
console.log(`  canopy/ground ΔE spring ${f1(dE(sc.spring.canopy, sc.spring.ground))} summer ${f1(dE(sc.summer.canopy, sc.summer.ground))} autumn ${f1(dE(sc.autumn.canopy, sc.autumn.ground))}; autumn/summer canopy ${f1(dE(sc.autumn.canopy, sc.summer.canopy))}; winter ground L* ${f1(lab(sc.winter.ground)[0])}`);

// ---- 2. furnish simulation, exactly the A-11 placement rule ----
console.log('== 2 furnish simulation (A-11 rule: 0.15 m inset, s 1.00 -> 0.60 by 0.05, overlap > 0.01 m on both axes)');
const CL = 0.15;
function placeOne(p, W, D, s) {
  const w = p.w * s, d = p.d * s, a = p.off ? p.off[0] * s : 0, b = p.off ? p.off[1] * s : 0, x0 = CL, x1 = W - CL, y0 = CL, y1 = D - CL;
  let cx, cy, sx, sy;
  if (p.anchor === 'center') {
    if (W >= D) { sx = w; sy = d; cx = (x0 + x1) / 2 + a; cy = (y0 + y1) / 2 + b; } else { sx = d; sy = w; cx = (x0 + x1) / 2 - b; cy = (y0 + y1) / 2 + a; }
  } else if (p.anchor === 'left' || p.anchor === 'right') {
    sx = d; sy = w; cx = p.anchor === 'left' ? x0 + d / 2 : x1 - d / 2; cy = (y0 + y1) / 2; cx += a; cy += b;
  } else {
    sx = w; sy = d; const back = p.anchor === 'back' || p.anchor[0] === 'b';
    cy = back ? y1 - d / 2 : y0 + d / 2;
    cx = p.anchor.length === 2 ? (p.anchor[1] === 'l' ? x0 + w / 2 : x1 - w / 2) : (x0 + x1) / 2; cx += a; cy += b;
  }
  return { id: p.id, x0: cx - sx / 2, x1: cx + sx / 2, y0: cy - sy / 2, y1: cy + sy / 2, inside: cx - sx / 2 >= x0 - 1e-9 && cx + sx / 2 <= x1 + 1e-9 && cy - sy / 2 >= y0 - 1e-9 && cy + sy / 2 <= y1 + 1e-9 };
}
const overlaps = (r, q) => Math.min(r.x1, q.x1) - Math.max(r.x0, q.x0) > 0.01 && Math.min(r.y1, q.y1) - Math.max(r.y0, q.y0) > 0.01;
function furnish(type, W, D, density) {
  const out = [], dropped = [];
  for (const p of F[type]) {
    if (density === 'sparse' && !p.sparse) continue;
    let got = null;
    for (let i = 20; i >= 12; i--) { const s = i / 20, r = placeOne(p, W, D, s); if (r.inside && !out.some((q) => overlaps(r, q))) { got = { ...r, s }; break; } }
    if (got) out.push(got); else dropped.push(p.id);
  }
  return { out, dropped };
}
let rooms = 0, scaled = [], sparseMiss = [], fullNotMore = [];
for (const t of TYPES) for (const z of C.SIZES) {
  const A = C.ROOM_SIZE[t][z], sh = Math.max(C.ROOM_MIN_SIDE, Math.sqrt(A / 3)), sq = Math.sqrt(A);
  for (const [W, D, form] of [[sq, sq, 'square'], [A / sh, sh, 'wide'], [sh, A / sh, 'deep']]) {
    rooms++;
    const sp = furnish(t, W, D, 'sparse'), fu = furnish(t, W, D, 'full'), tag = `${t} ${z} ${f2(W)}x${f2(D)}`;
    if (sp.dropped.length) sparseMiss.push(`${tag}: ${sp.dropped}`);
    if (!(fu.out.length > sp.out.length)) fullNotMore.push(`${tag}: full ${fu.out.length} sparse ${sp.out.length}`);
    for (const r of sp.out) if (r.s < 1) scaled.push(`${tag} ${r.id} ${r.s.toFixed(2)}`);
    if (process.argv.includes('-v')) console.log(`  ${tag.padEnd(26)} sparse ${sp.out.length}/${F[t].filter((p) => p.sparse).length} full ${fu.out.length}/${F[t].length}${fu.dropped.length ? ' (dropped ' + fu.dropped + ')' : ''}`);
  }
}
console.log(`  rooms ${rooms}; sparse pieces dropped: ${sparseMiss.length ? sparseMiss.join('; ') : 'none'}; full not > sparse: ${fullNotMore.length ? fullNotMore.join('; ') : 'none'}`);
console.log(`  sparse placements scaled: ${scaled.length}${scaled.length ? ' (lowest ' + Math.min(...scaled.map((s) => +s.split(' ').pop())).toFixed(2) + ')' : ''}`);
for (const s of scaled) console.log('    ' + s);
req(rooms === 90 && !sparseMiss.length && !fullNotMore.length, '90 rooms: every sparse piece placed, full > sparse');
// living M vignette (the stage-4 hint): positions in metres, for the SVG
const LM = C.ROOM_SIZE.living.M, lw = 6.4, ld = LM / lw;
console.log(`  living M ${lw} x ${f2(ld)} full: ` + furnish('living', lw, ld, 'full').out.map((r) => `${r.id} [${f2(r.x0)},${f2(r.y0)} ${f2(r.x1 - r.x0)}x${f2(r.y1 - r.y0)}]`).join(' '));

// ---- CSS precompute ----
const css4 = readFileSync(join(SRC, 'css/43-stage-interior.css'), 'utf8');
console.log('== hint CSS  ' + Object.keys(I).map((st) => `${st} --h-floor ${mix(T.living, I[st].wood, I[st].floorMix)}${css4.includes(mix(T.living, I[st].wood, I[st].floorMix)) ? ' (in CSS)' : ' (NOT in CSS)'}`).join(', '));
console.log('== hint text contrast: ink on surface ' + f1(cr('#16212B', '#FFFFFF')));
console.log(fail ? `${fail} requirement(s) FAILED` : 'all binding requirements met');
process.exit(fail ? 1 : 0);
