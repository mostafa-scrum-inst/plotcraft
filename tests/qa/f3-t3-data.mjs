// F3-T3 QA (node, about 1 s): the 3D look, furniture and sky tables against the architecture text with QA's own oracle
// (f3-t3-ref.mjs). 1 schema (A-10 / A-11 / A-13 key lists, F3-plan "QA should test"); 2 floor mix (A-10) and the
// stage-4 / stage-2 CSS = tables; 3 A-13 season blend over every quarter hour of all four seasons; 4 A-11 placement
// simulation over seeded random rooms (S-L areas, aspect 1:1-3:1, m and ft grids) plus fixed edge rooms.
// Run: node tests/qa/f3-t3-data.mjs [--verbose]
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, collector } from './lib.mjs';
import { loadTables, mix, Lab, dE, hueDeg, floorOf, blend, topLight, isNight, furnish, rng, ch } from './f3-t3-ref.mjs';

const R = collector('F3-T3 data');
// F3-T3 bug 1 (bedroom wardrobe dropped in narrow deep bedrooms) fixed by the Designer (anchor 'fl'); KNOWN entry removed.
const verbose = process.argv.includes('--verbose');
const SRC = process.env.QA_SRC || join(ROOT, 'src');      // QA_SRC: a throwaway copy for mutation runs
const D = loadTables(SRC);
const HEX = /^#[0-9A-F]{6}$/;
const eqKeys = (o, keys) => (JSON.stringify(Object.keys(o)) === JSON.stringify(keys) ? [] : [`keys ${Object.keys(o)} != ${keys}`]);

// From the PM document 4.1 / 4.2 and A-10 / A-11 / A-13 (my own lists, not PC.C)
const TYPES = ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry'];
const AREA = { bedroom: [12, 16, 24], bathroom: [4, 6, 9], kitchen: [9, 14, 20], living: [20, 30, 42], dining: [12, 16, 24], majlis: [16, 24, 36], office: [9, 12, 16], maid: [6, 9, 12], storage: [4, 6, 9], laundry: [4, 6, 9] };
const EXT = ['sand', 'white', 'terracotta', 'grey'], STY = ['modern', 'classic', 'minimal'], SEAS = ['spring', 'summer', 'autumn', 'winter'];
// F6-T1b (impl-notes T1b data keys): exteriors gain frame / door, siteColors glassTop / glassBottom; marker PC.C.CONTACT
const T1B = (() => { try { return /\bCONTACT\s*:/.test(readFileSync(join(SRC, 'js/core/const.js'), 'utf8')); } catch (e) { return false; } })();
// F6-T1c R1 (plan §1, Designer table entered by hand): exteriors gain coping; marker PC.C.ROOF copingT in const.js
const T1C = (() => { try { return /\bcopingT\s*:/.test(readFileSync(join(SRC, 'js/core/const.js'), 'utf8')); } catch (e) { return false; } })();
const COPING = { sand: '#E6DAC4', white: '#F4F2EA', terracotta: '#D9CBB8', grey: '#B9BEC1' };
const EXT_K = ['wall', 'wallInner', 'slab', 'roof', 'trim', 'parapet', ...(T1B ? ['frame', 'door'] : []), ...(T1C ? ['coping'] : [])], INT_K = ['fabric', 'wood', 'accent', 'white', 'metal', 'dark', 'floorMix'];
// F6-T1a (impl-notes §6, plan §4.4 / §4.1): siteColors gains asphalt (street), each sky key gains skyMid / skyZenith (hex)
// and exposure (number). Version-aware on the F6 core module src/js/core/texgen.js.
const F6 = existsSync(join(SRC, 'js/core/texgen.js'));
const SITE_K = ['ground', 'groundOuter', 'paving', 'poolWater', 'poolRim', 'boundaryWall', 'gate', 'carCanopy', 'seating', 'trunk', 'northMarker', 'highlight', ...(F6 ? ['asphalt'] : []), ...(T1B ? ['glassTop', 'glassBottom'] : [])];
const SKY_KK = ['h', 'background', 'sunColor', 'sunI', 'hemiSky', 'hemiGround', 'hemiI', ...(F6 ? ['skyMid', 'skyZenith', 'exposure'] : [])];
const ANCH = ['back', 'front', 'left', 'right', 'bl', 'br', 'fl', 'fr', 'center'], CKEYS = ['fabric', 'wood', 'accent', 'white', 'metal', 'dark'];

// ---------------- 1. schema ----------------
R.check(`1 exteriors: sand, white, terracotta, grey, each exactly the ${EXT_K.length === 6 ? 'six A-10 roles' : `six A-10 roles + frame / door (F6-T1b)${T1C ? ' + coping (F6-T1c)' : ''}`}, #RRGGBB upper case`,
  [...eqKeys(D.exteriors, EXT), ...EXT.flatMap((e) => [...eqKeys(D.exteriors[e], EXT_K), ...EXT_K.filter((k) => !HEX.test(D.exteriors[e][k])).map((k) => `${e}.${k}`), ...(T1C && D.exteriors[e] && D.exteriors[e].coping !== COPING[e] ? [`${e}.coping ${D.exteriors[e].coping}, Designer table ${COPING[e]}`] : [])])]);
R.check('1 interiors: modern, classic, minimal, exactly fabric..dark + floorMix in [0, 0.3]',
  [...eqKeys(D.interiors, STY), ...STY.flatMap((s) => [...eqKeys(D.interiors[s], INT_K), ...CKEYS.filter((k) => !HEX.test(D.interiors[s][k])).map((k) => `${s}.${k}`), ...(typeof D.interiors[s].floorMix === 'number' && D.interiors[s].floorMix >= 0 && D.interiors[s].floorMix <= 0.3 ? [] : [s + ' floorMix'])])]);
R.check('1 roomTints: the 10 types + hall, stair, lift, all hex', [...eqKeys(D.roomTints, [...TYPES, 'hall', 'stair', 'lift']), ...Object.entries(D.roomTints).filter(([, v]) => !HEX.test(v)).map(([k]) => k)]);
R.check(`1 siteColors: the ${SITE_K.length} A-10 keys${F6 ? ' (asphalt from F6-T1' + (T1B ? ', glassTop / glassBottom from T1b' : '') + ')' : ''}, all hex; ground = summer ground`, [...eqKeys(D.siteColors, SITE_K), ...Object.entries(D.siteColors).filter(([, v]) => !HEX.test(v)).map(([k]) => k), ...(D.siteColors.ground === D.sky.seasons.summer.ground ? [] : ['ground != summer ground'])]);
{ const f = [];
  if (JSON.stringify(Object.keys(D.furniture)) !== JSON.stringify(TYPES)) f.push('types ' + Object.keys(D.furniture));
  for (const t of TYPES) { const L = D.furniture[t] || [], sp = L.filter((p) => p.sparse === true);
    if (L.length > 8 || sp.length < 1 || L.length - sp.length < 2) f.push(`${t}: ${L.length} pieces, ${sp.length} sparse`);
    if (new Set(L.map((p) => p.id)).size !== L.length) f.push(t + ': duplicate id');
    for (const p of L) { const at = t + '.' + p.id, ks = Object.keys(p).filter((k) => k !== 'off').sort().join();
      if (ks !== ['anchor', 'color', 'd', 'h', 'id', 'sparse', 'w', 'y0'].join()) f.push(at + ' keys ' + ks);
      if (!(p.w > 0 && p.d > 0 && p.h > 0 && p.y0 >= 0)) f.push(at + ' sizes');
      if (p.y0 + p.h > 1.1 + 1e-9) f.push(at + ` top ${p.y0 + p.h} > 1.1 m`);
      if (!ANCH.includes(p.anchor)) f.push(at + ' anchor ' + p.anchor);
      if (!CKEYS.includes(p.color)) f.push(at + ' colour ' + p.color);
      if (typeof p.sparse !== 'boolean') f.push(at + ' sparse not written');
      if ('off' in p && !(Array.isArray(p.off) && p.off.length === 2 && p.off.every((v) => Math.abs(v) <= 1.2))) f.push(at + ' off');
      if ('off' in p && L.indexOf(p) === 0) f.push(at + ' off on the first piece (nothing to place it around)'); } }
  R.check('1 furniture: 10 types; per type 1+ sparse, 2+ full-only, 8 at most; A-11 keys; sizes > 0; top <= 1.1 m; known anchors and colour keys; |off| <= 1.2', f); }
{ const K = D.sky.keys, f = [];
  for (const k of K) { if (Object.keys(k).join() !== SKY_KK.join()) f.push('key keys ' + Object.keys(k)); for (const n of ['background', 'sunColor', 'hemiSky', 'hemiGround', ...(F6 ? ['skyMid', 'skyZenith'] : [])]) if (!HEX.test(k[n])) f.push(`${k.h}.${n}`);
    if (F6 && !(typeof k.exposure === 'number' && k.exposure > 0 && k.exposure <= 2)) f.push(`${k.h}.exposure ${k.exposure}`); }
  for (let i = 1; i < K.length; i++) if (!(K[i].h > K[i - 1].h)) f.push('not increasing at ' + K[i].h);
  if (K[0].h !== 0 || K[K.length - 1].h !== 24) f.push('first / last h ' + K[0].h + ' / ' + K[K.length - 1].h);
  const { h: h0, ...a } = K[0], { h: h1, ...b } = K[K.length - 1]; if (JSON.stringify(a) !== JSON.stringify(b)) f.push('h 24 differs from h 0');
  if (!K.some((k) => k.h === 12)) f.push('no noon key');
  if (JSON.stringify(Object.keys(D.sky.seasons)) !== JSON.stringify(SEAS)) f.push('seasons ' + Object.keys(D.sky.seasons));
  if (D.sky.groundBounce !== 0.25) f.push('groundBounce ' + D.sky.groundBounce);
  const E = SEAS.map((s) => D.sky.seasons[s].elevMax).join(); if (E !== '52,72,52,32') f.push('elevMax ' + E);
  R.check('1 sky: key lists, h 0 -> 24 strictly increasing, last = first, noon key, four seasons, elevMax 52/72/52/32, groundBounce 0.25', f); }

// Data files hold literals only (A-2 data layer: "any code other than assigning literals to PC.data.*" is forbidden).
// My own reader: the IIFE body must be nothing but 'use strict' and PC.data.<name> = <literal>; statements, and each
// literal must parse as JSON once single quotes and bare keys are converted (so no call, identifier or expression).
{ const f = [];
  for (const file of ['look3d.js', 'furniture.js', 'sky.js']) {
    const t = readFileSync(join(SRC, 'js/data', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const m = /^\s*\(function \(PC\) \{\s*'use strict';([\s\S]*)\}\)\(globalThis\.PC = globalThis\.PC \|\| \{\}\);\s*$/.exec(t);
    if (!m) { f.push(file + ': not a single IIFE'); continue; }
    let body = m[1].trim(); const re = /^PC\.data\.(\w+) = /;
    while (body.length) {
      const h = re.exec(body); if (!h) { f.push(`${file}: statement other than PC.data.x = literal: ${body.slice(0, 40)}`); break; }
      body = body.slice(h[0].length); let depth = 0, i = 0, q = false;
      for (; i < body.length; i++) { const c = body[i]; if (q) { if (c === "'") q = false; continue; } if (c === "'") q = true; else if (c === '{' || c === '[') depth++; else if (c === '}' || c === ']') depth--; else if (c === ';' && depth === 0) break; }
      const lit = body.slice(0, i).trim(); body = body.slice(i + 1).trim();
      const json = lit.replace(/'([^']*)'/g, (_, x) => JSON.stringify(x)).replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":');
      try { JSON.parse(json); } catch (e) { f.push(`${file} PC.data.${h[1]}: not a pure literal (${e.message.slice(0, 60)})`); }
    }
  }
  R.check('1 look3d / furniture / sky: one IIFE of PC.data.x = <pure literal> statements (no calls, identifiers or expressions)', f); }

// ---------------- 2. floor mix (A-10) and CSS = tables ----------------
// My floors for every style: the 10 types + hall mixed, stair / lift as they are.
{ const f = [], rows = [];
  for (const st of STY) {
    const fl = Object.fromEntries([...TYPES, 'hall', 'stair', 'lift'].map((t) => [t, floorOf(D, st, t)]));
    if (fl.stair !== D.roomTints.stair || fl.lift !== D.roomTints.lift) f.push(st + ' stair/lift mixed');
    let min = Infinity, pair = '';
    for (let i = 0; i < TYPES.length; i++) for (let j = i + 1; j < TYPES.length; j++) { const d = dE(fl[TYPES[i]], fl[TYPES[j]]); if (d < min) { min = d; pair = TYPES[i] + '/' + TYPES[j]; } }
    rows.push(`${st} min type pair ΔE ${min.toFixed(1)} (${pair})`); if (min < 5.5) f.push(`${st}: ${pair} floors ΔE ${min.toFixed(1)} < 5.5`);
    // the mix really moves toward the wood by floorMix of the gap, channel by channel (rounding <= 0.5)
    for (const t of [...TYPES, 'hall']) { const a = ch(D.roomTints[t]), w = ch(D.interiors[st].wood), g = ch(fl[t]); a.forEach((v, i) => { if (Math.abs(g[i] - (v + (w[i] - v) * D.interiors[st].floorMix)) > 0.5) f.push(`${st}.${t} channel ${i}`); }); }
  }
  R.check('2 floor mix: hall and the 10 types mixed with the style wood by floorMix, stair / lift unmixed, type floors ΔE >= 5.5 in every style', f);
  R.note('floor mix: ' + rows.join('; ')); }
// 3D tints read as the 2D tints (TL ruling 2): hue within 3 degrees, darker
{ const f = []; for (const t of TYPES) { const dh = Math.abs(((hueDeg(D.roomTints[t]) - hueDeg(D.palette2d.room[t])) + 540) % 360 - 180), dl = Lab(D.palette2d.room[t])[0] - Lab(D.roomTints[t])[0]; if (dh > 3 || dl < 5 || dl > 12) f.push(`${t} hue ${dh.toFixed(1)} L* -${dl.toFixed(1)}`); }
  R.check('2 roomTints follow the 2D tints: same hue (<= 3 degrees), L* 5-12 lower', f); }
// CSS parsed from the source files with my own reader: every rule body for a selector, comments removed
const cssDecl = (file) => { const css = readFileSync(join(SRC, 'css', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) { const sels = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')), props = {}; for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) props[d[1]] = d[2].trim().toUpperCase(); out.push({ sels, props }); }
  return (sel) => Object.assign({}, ...out.filter((r) => r.sels.includes(sel)).map((r) => r.props)); };
{ const q = cssDecl('43-stage-interior.css'), f = [];
  const want = (st) => { const I = D.interiors[st]; return { '--h-fabric': I.fabric, '--h-wood': I.wood, '--h-accent': I.accent, '--h-metal': I.metal, '--h-dark': I.dark, '--h-floor': floorOf(D, st, 'living') }; };
  const cmp = (sel, st) => { const got = q(sel), w = want(st); for (const k in w) if (got[k] !== w[k]) f.push(`${sel} ${k} ${got[k]} != ${w[k]}`); };
  for (const st of STY) cmp('.pc-hint--' + st, st);
  cmp('.pc-hint--density', 'modern');
  for (const st of ['classic', 'minimal']) cmp(`.pc-interior:has(input[name="q-interior-style"][value="${st}"]:checked) .pc-hint--density`, st);
  R.check('2 stage-4 CSS: Q18 hint properties = PC.data.interiors + my living floor mix; Q19 vignettes Modern by default and Classic / Minimal by :has()', f); }
{ const q = cssDecl('41-stage-questions.css'), f = [];
  for (const e of EXT) { const got = q('.pc-sw-' + e), X = D.exteriors[e]; for (const [k, v] of [['--x-wall', X.wall], ['--x-trim', X.trim], ['--x-roof', X.roof]]) if (got[k] !== v) f.push(`${e} ${k} ${got[k]} != ${v}`); }
  R.check('2 stage-2 Q10 swatch CSS = exteriors wall / trim / roof', f); }

// ---------------- 3. A-13 season blend, all four seasons, every quarter hour ----------------
{ const S = D.sky, noonKey = S.keys.find((k) => k.h === 12), f = [], rows = [];
  for (const k of S.keys.filter((k) => isNight(k.h))) if (!(k.hemiI >= 0.25 && k.sunI <= 0.25 * noonKey.sunI)) f.push('night key ' + k.h);
  for (const s of SEAS) {
    let twi = -1, maxL = -1, minRatio = Infinity, minHemi = Infinity; const noon = topLight(S, 12, s);
    // "night" = from the first night key after dusk to the last one before dawn (A-13 night keys: h < 5 or h > 20);
    // the 20:00-21:00 stretch interpolates dusk into night and is reported, not judged
    const nk = S.keys.filter((k) => isNight(k.h)).map((k) => k.h), nFrom = Math.min(...nk.filter((h) => h > 12)), nTo = Math.max(...nk.filter((h) => h < 12));
    for (let q = 0; q <= 96; q++) { const h = q / 4, L = blend(S, h, s); minHemi = Math.min(minHemi, L.hemiI);
      if (h > 20 && h < nFrom) twi = Math.max(twi, Lab(L.background)[0]);
      if (h >= nFrom || h <= nTo) { maxL = Math.max(maxL, Lab(L.background)[0]); minRatio = Math.min(minRatio, noon / topLight(S, h, s)); } }
    rows.push(`${s}: night background L* <= ${maxL.toFixed(1)} (20:00-21:00 twilight up to ${twi.toFixed(1)}), noon/night light >= ${minRatio.toFixed(2)}, hemiI >= ${minHemi.toFixed(2)}`);
    if (maxL > 15) f.push(`${s} night background L* ${maxL.toFixed(1)} > 15`);
    if (minRatio < 5) f.push(`${s} noon/night ${minRatio.toFixed(2)} < 5`);
    if (minHemi < 0.25) f.push(`${s} hemiI ${minHemi} < 0.25 (model not visible)`);
    const p = [12, 17.5, 22].map((h) => topLight(S, h, s)); if (!(p[0] > p[1] && p[1] > p[2])) f.push(`${s} presets noon/evening/night ${p.map((x) => x.toFixed(3))}`);
    // noon: the full tint; summer is the untinted baseline
    const n = blend(S, 12, s), K = S.keys.find((k) => k.h === 12), sv = S.seasons[s];
    if (n.background !== mix(K.background, sv.tint, sv.tintAmount) || n.hemiGround !== mix(K.hemiGround, sv.ground, 0.25)) f.push(s + ' noon blend');
  }
  if (blend(S, 12, 'summer').background !== noonKey.background) f.push('summer noon tinted');
  // without the day factor the winter night would lift (the reason for the rule): check mine bites on it
  const undamped = mix(S.keys[0].background, S.seasons.winter.tint, S.seasons.winter.tintAmount);
  rows.push(`winter midnight background L* ${Lab(blend(S, 0, 'winter').background)[0].toFixed(1)} (without the day factor ${Lab(undamped)[0].toFixed(1)})`);
  R.check('3 A-13 blend, all four seasons, 97 hours each: night background L* <= 15, noon >= 5 x every night hour (top-face light), hemiI >= 0.25 always, presets noon > evening > night, noon tint = tintAmount, summer untinted', f);
  R.note('sky: ' + rows.join('; ')); }
{ const s = D.sky.seasons, f = [], green = (h) => { const x = hueDeg(h); return x > 95 && x < 160; };
  if (!(green(s.spring.canopy) && green(s.summer.canopy))) f.push(`spring/summer canopy hue ${hueDeg(s.spring.canopy).toFixed(0)}/${hueDeg(s.summer.canopy).toFixed(0)}`);
  if (!(dE(s.autumn.canopy, s.summer.canopy) >= 20 && hueDeg(s.autumn.canopy) < 80)) f.push('autumn canopy');
  if (s.winter.canopyVisible !== false || !s.spring.canopyVisible || !s.summer.canopyVisible || !s.autumn.canopyVisible) f.push('canopyVisible');
  if (!(Lab(s.winter.ground)[0] >= 90 && Lab(s.winter.shrub)[0] >= 85)) f.push('winter not snowy');
  R.check('3 F4-S3 seasons: green spring / summer canopies, autumn canopy warm and ΔE >= 20 from summer, winter bare (canopyVisible false) with snow ground and shrubs', f); }

// ---------------- 4. A-11 placement simulation ----------------
const GRIDS = { m: 0.5, ft: 0.3048 };
const low = [], dropsS = [], notMore = [], lowFull = {}; let rooms = 0, sMin = 1;
const band = {}; let bandRooms = 0;   // tolerance-band rooms: reported, not judged (outside the TL's S-L brief)
function room(t, W, D2, tag) {
  const sp = furnish(D.furniture[t], W, D2, 'sparse'), fu = furnish(D.furniture[t], W, D2, 'full');
  if (/band/.test(tag)) { bandRooms++; for (const id of sp.dropped) { const k = `${t}.${id}`; band[k] = band[k] || { n: 0, ex: `${W.toFixed(2)} x ${D2.toFixed(2)}` }; band[k].n++; } return; }
  rooms++;
  if (sp.dropped.length) dropsS.push(`${t} ${tag} ${W.toFixed(2)} x ${D2.toFixed(2)}: ${sp.dropped}`);
  if (!(fu.placed.length > sp.placed.length)) notMore.push(`${t} ${tag} ${W.toFixed(2)} x ${D2.toFixed(2)}: full ${fu.placed.length} <= sparse ${sp.placed.length}`);
  for (const p of sp.placed) { sMin = Math.min(sMin, p.s); if (p.s < 0.75 - 1e-9) low.push({ k: `${t}.${p.id}`, s: p.s, room: `${W.toFixed(2)} x ${D2.toFixed(2)} ${tag}` }); }
  for (const p of fu.placed) if (p.s < 0.75 - 1e-9) lowFull[`${t}.${p.id}`] = Math.min(lowFull[`${t}.${p.id}`] || 1, p.s);
}
const rnd = rng(0xF3753);
// area uniform over S..L (150 rooms per type and unit), and over the generator's tolerance band 0.75 S..S (A-8 / PM 4.4
// area tolerance 25 %; 50 per type and unit); aspect uniform 1..3, either orientation, sides snapped to the unit's grid
// (>= 1.5 m, aspect <= 3)
for (const [u, g] of Object.entries(GRIDS)) for (const t of TYPES) for (let n = 0; n < 200; n++) {
  const band = n >= 150, lo = band ? 0.75 * AREA[t][0] : AREA[t][0], hi = band ? AREA[t][0] : AREA[t][2];
  for (let tries = 0; tries < 50; tries++) {
    const A = lo + rnd() * (hi - lo), k = 1 + 2 * rnd(), long = Math.sqrt(A * k), short = A / long;
    const sn = (v) => Math.round(v / g) * g, L = sn(long), Sh = sn(short);
    if (Sh < 1.5 - 1e-9 || L / Sh > 3 + 1e-9) continue;
    const tg = `${u}${band ? ' tolerance band' : ''}`; if (rnd() < 0.5) room(t, L, Sh, tg + ' wide'); else room(t, Sh, L, tg + ' deep');
    break;
  }
}
// fixed edge rooms: the exact S / M / L area as a square, as 3:1 wide and deep, and at the 1.5 m minimum side
for (const t of TYPES) AREA[t].forEach((A, i) => {
  // the generator keeps every side >= 1.5 m (PM 4.4), so a 3:1 room whose short side would be under 1.5 m is 1.5 m x A / 1.5
  const sz = 'SML'[i], sq = Math.sqrt(A), sh = Math.max(1.5, Math.sqrt(A / 3)), lg = A / sh;
  room(t, sq, sq, sz + ' square'); if (lg / sh <= 3 + 1e-9) { room(t, lg, sh, sz + ' 3:1 wide'); room(t, sh, lg, sz + ' 3:1 deep'); }
  if (A / 1.5 / 1.5 <= 3 && sh > 1.5) { room(t, A / 1.5, 1.5, sz + ' 1.5 m deep'); room(t, 1.5, A / 1.5, sz + ' 1.5 m wide'); }
});
// rooms the F3-T1 generator really produces (QA probe over 2 934 generated layouts, 19 948 rooms: the only sparse drops
// were bedrooms like 2.5 x 4 m, an S bedroom 17 % under its area, inside the 25 % tolerance) and their ft twin 8 x 16 ft
room('bedroom', 2.5, 4, 'generated S'); room('bedroom', 2.5, 4.5, 'generated S'); room('bedroom', 8 * 0.3048, 16 * 0.3048, 'ft 8 x 16 ft');
R.check(`4 A-11 simulation over ${rooms} rooms (2 x 1500 random S-L rooms on the m and ft grids, aspect 1:1-3:1, plus fixed square / 3:1 / 1.5 m / generated rooms): every sparse piece placed`, dropsS);
R.note(`A-11 tolerance band (${bandRooms} rooms of 0.75 S..S, not judged): sparse drops ` + (Object.entries(band).map(([k, b]) => `${k} x${b.n} (e.g. ${b.ex})`).join(', ') || 'none'));
R.check('4 A-11 simulation: in every room full places more pieces than sparse', notMore);
{ const by = {}; for (const x of low) { const b = by[x.k] || (by[x.k] = { n: 0, s: 1, room: '' }); b.n++; if (x.s < b.s) { b.s = x.s; b.room = x.room; } }
  const list = Object.entries(by).map(([k, b]) => `${k} in ${b.n} room(s), lowest s ${b.s.toFixed(2)} (${b.room})`);
  R.note(`A-11 sparse pieces placed below s 0.75 (QA focus 2): ${list.length ? list.join('; ') : 'none'}; lowest sparse scale ${sMin.toFixed(2)}`);
  R.note('A-11 full-set pieces below s 0.75 (informational): ' + (Object.entries(lowFull).map(([k, s]) => `${k} ${s.toFixed(2)}`).join(', ') || 'none'));
  if (verbose) for (const x of low) console.log('  low', x.k, x.s, x.room); }
// Hand-checked placements (worked by hand from A-11, so the simulation itself is pinned): a 4 x 3 m dining room
{ const r = furnish(D.furniture.dining, 4, 3, 'full'), by = Object.fromEntries(r.placed.map((p) => [p.id, p])), f = [];
  const near = (p, l, fr, rr, b) => p && [p.l - l, p.f - fr, p.r - rr, p.b - b].every((d) => Math.abs(d) < 1e-9);
  if (!near(by.table, 1.2, 1.05, 2.8, 1.95)) f.push('table ' + JSON.stringify(by.table));
  if (!near(by.chairB, 1.775, 2.025, 2.225, 2.475)) f.push('chairB ' + JSON.stringify(by.chairB));
  if (!near(by.chairL, 0.7, 1.275, 1.15, 1.725)) f.push('chairL ' + JSON.stringify(by.chairL));
  // a 3 x 4 m (deep) room: the table turns, chairB's offset (0, 0.75) turns to (-0.75, 0)
  const q = furnish(D.furniture.dining, 3, 4, 'sparse'), b2 = Object.fromEntries(q.placed.map((p) => [p.id, p]));
  if (!near(b2.table, 1.05, 1.2, 1.95, 2.8)) f.push('deep table ' + JSON.stringify(b2.table));
  if (!near(b2.chairB, 0.525, 1.775, 0.975, 2.225)) f.push('deep chairB ' + JSON.stringify(b2.chairB));
  R.check('4 my placement rule reproduces hand-worked A-11 poses (dining 4 x 3 m full; 3 x 4 m sparse with the turned centre offset)', f); }

process.exit(R.done() ? 0 : 1);
