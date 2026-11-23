// F4-T3 QA (browser, vendored real r128): the Light tab, the look in the scene, the session look, the vegetation meshes
// and the shortfall warning in the built page, judged by QA's own oracle (f4-t3-ref.mjs). Version-aware (plan 7): the
// look sections need PC.three.applyLook + PC.sky.compute, the vegetation sections PC.scatter.vegetation; without them
// the suite only notes the skip (no browser), so a main tree without F4-T3 stays green.
//   A 1280x800 Light tab (mouse + keyboard): controls live (room finder / tour still disabled), opens at 12:00 summer with
//     Noon pressed; presets (click, Space) set slider / readout / aria-pressed (only the matching one), arrows step
//     0.25 and clear it, Home 00:00, End 24:00; season select; after each: scene = my oracle (sun / hemisphere colours
//     and intensities, sun direction and distance 2.5 x radius from the footprint centre, raw background, plot ground /
//     canopy / shrub colours, canopies hidden in winter, trunk and groundOuter unchanged); no rebuild, no new geometry
//     / material / mesh, camera pose unchanged; orbit drags between slider steps change only the pose.
//     4 seasons x 4 presets + 0 / 6 / 18 / 24 h: the same, one shadow light (map <= 1024), shadow box (r128's own
//     light-view matrix after a render) holds the content (footprint to the roof base, canopies, shrubs, pool, parking,
//     seating) unless capped at shadowR x radius; refitted between 8 and 17.5 h; setLook time. Mean luminance of the
//     canvas noon > evening > night. Session: kept across stage 4 and back, a Q18 rebuild, a context loss + restore and
//     a whole-state replace; a reload opens at 12:00 summer.
//   B vegetation meshes: InstancedMesh trunks / canopies / shrubs with the model's counts, frustumCulled false, cast and
//     not receive, the Designer's geometry (6 / 8 / 7 segments), every instance where the model puts it (vertex extents
//     per instance: radius x s, trunk 0..2.6 s, canopy 1.4 s..4.2 s, shrub 0..0.8 s); 0 % none (12 meshes);
//     100 x 100 m at 80 % reaches the caps with <= 40 meshes.
//   C 360x640 touch: presets and the slider by tap, readout and scene follow; Light pane layout (F1-T1 rules), panel
//     <= 34 % of the canvas, one row of presets, 44 px targets. Shortfall warning: never on the sample; the PM's text on
//     a short state, on stage 2 (row) and Floor plans, or in the stage-5 panel (the TL's fallback).
//   D (round 1, TL focus list 6 / 7): winter has no canopy pixels; tree shadows darken the frame at 17.5 h; the maximum
//     house with the caps under 24 looks: no create / dispose, setLook mean < 5 ms, the house never clipped by the box.
//   E (exploratory) the Light pane at 640x360 and 768x1024.
// Run: node tests/qa/f4-t3-view.mjs [--no-shots] [--only=A,B,C,D,E]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, collector, launch } from './lib.mjs';
import { sessions } from './session.mjs';
import { roofTo } from './v3kit.mjs';
import * as Q from './f2-t1-ref.mjs';
import * as H from './f4-t1-ref.mjs';
import { loadTables } from './f3-t3-ref.mjs';
import * as V from './f4-t3-ref.mjs';

const R = collector('F4-T3 view');
const noShots = process.argv.includes('--no-shots'), shots = join(ROOT, 'tests/qa/shots/F4-T3');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const { PC } = H.loadPC3();
const T3 = loadTables(), SKY = T3.sky;
const HAS = { look: !!(PC.three && typeof PC.three.applyLook === 'function') && !!(PC.sky && typeof PC.sky.compute === 'function'), scatter: !!(PC.scatter && typeof PC.scatter.vegetation === 'function') };
if (!HAS.look && !HAS.scatter) { R.note('skipped: PC.three.applyLook / PC.sky.compute / PC.scatter.vegetation absent (F4-T3 not merged)'); process.exit(R.done() ? 0 : 1); }
if (!noShots) mkdirSync(shots, { recursive: true });
const session = sessions({ R, shots, noShots });
const VP = { phone: { tag: '360x640', w: 360, h: 640, touch: true }, desk: { tag: '1280x800', w: 1280, h: 800, touch: false } };
const t0 = Date.now(), TIMES = [];
// F6-T1 (impl-notes §6, plan §3): the full tier's shadow map is 2048 on fine pointers (it was <= 1024).
// F6-T1 run-time moves (TL Q-T8, docs/03-tasks/F6-T1/qa-full-moves.md): A's 0 / 6 / 18 / 24 h edge looks and E (640x360,
// 768x1024) run with QA_FULL=1 only (the 16 preset looks stay in the default run).
const FULL = !!process.env.QA_FULL, F6 = !!(PC.texgen || (PC.C.VIEW3D && PC.C.VIEW3D.tiers)), MAPMAX = F6 ? 2048 : 1024, T1BV = !!PC.C.CONTACT, T1CV = !!(PC.C.ROOF && PC.C.ROOF.copingT !== undefined), NEW6 = (F6 ? 3 : 0) + (T1BV ? 1 : 0) + (T1CV ? 1 : 0) /* F6-T1c: + roofDeck on the flat-roof sample */ /* paving, northNeedle, sky (impl-notes §1 meshes; flat-roof sample); T1b groundRing */, EDGE_H = FULL ? [0, 6, 18, 24] : [];
const cut = (a, n = 8) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const RAF = () => { const raf = window.requestAnimationFrame.bind(window); window.__raf = 0; window.requestAnimationFrame = (cb) => { window.__raf++; return raf(cb); }; };
const READY = () => { const i = PC.debug.scene(), q = (h) => document.querySelector(`[data-pc="${h}"]`); return (i.active && !i.building && i.builds > 0 && q('v3-building').hidden && !i.frame && !i.dirty) || !q('v3-unavailable').hidden; };
async function ready(S) { const ok = await S.until(() => S.page.evaluate(READY), 8000); await S.settle(); return ok; }
async function to5(S, mut = '') {
  await S.page.evaluate((m) => { const st = PC.sample.state(); new Function('s', m)(st); st.plans = {}; st.stage = 1; PC.store.replace(st); PC.store.go(2); PC.store.go(3);
    PC.store.commit((s) => { for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; }, { nav: true }); PC.store.go(4); PC.store.go(5); }, mut);
  const ok = await ready(S); await roofTo(S, false);   // F6-T1: reference frames and metrics stay Roof-off, whatever roofOnOpen says (plan §9.3)
  return ok;
}
// TL ruling (F6-T1c run-time debt): the maximum-house part of D runs in the release step only (QA_RELEASE=1;
// f6-t1-leak.mjs --stream-only runs this file with --release-only, which runs D whole).
const REL = !!process.env.QA_RELEASE, RELONLY = process.argv.includes('--release-only');
async function guard(label, fn) { if (ONLY.length && !ONLY.includes(label[0])) return; if (RELONLY && label[0] !== 'D') return; const t = Date.now(); try { await fn(); } catch (e) { R.check(`${label}: ran to the end`, [String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')]); } TIMES.push(`${label} ${((Date.now() - t) / 1000).toFixed(1)} s`); }
const PRESET_HOOK = { 8: 'v3-preset-morning', 12: 'v3-preset-noon', 17.5: 'v3-preset-evening', 22: 'v3-preset-night' };

// ---------- the scene's look, read in the page ----------
const SNAP = () => {
  const i = PC.debug.scene(), sc = i.scene, w = i.world, h = i.house, out = { lights: [], mats: {}, meshIds: [], matIds: [], vis: {} };
  sc.traverse((o) => { if (o.isLight) out.lights.push({ type: o.type, cast: !!o.castShadow, color: [o.color.r, o.color.g, o.color.b], ground: o.groundColor ? [o.groundColor.r, o.groundColor.g, o.groundColor.b] : null, I: o.intensity,
    pos: [o.position.x, o.position.y, o.position.z], target: o.target ? [o.target.position.x, o.target.position.y, o.target.position.z] : null, map: o.shadow && o.castShadow ? [o.shadow.mapSize.x, o.shadow.mapSize.y] : null,
    cam: o.castShadow ? ['left', 'right', 'top', 'bottom', 'near', 'far'].map((k) => o.shadow.camera[k]) : null }); });
  w.traverse((o) => { if (!o.isMesh) return; out.meshIds.push(o.uuid); out.matIds.push(o.material.uuid); if (['groundPlot', 'groundOuter', 'trunks', 'canopies', 'shrubs'].includes(o.name)) { out.mats[o.name] = [o.material.color.r, o.material.color.g, o.material.color.b]; out.vis[o.name] = o.visible; } });
  const b = sc.background; out.bg = b && b.isColor ? [b.r, b.g, b.b] : null;
  out.geoms = i.renderer.info.memory.geometries; out.builds = i.builds; out.look = i.look; out.pose = PC.debug.cam();
  out.house = { radius: h.radius, center: h.center, fp: h.footprint, northDeg: h.northDeg, baseY: h.roof.baseY, site: h.site };
  return out;
};
const snap = (S) => S.page.evaluate(SNAP);
const close3 = (a, b, t) => a && b && a.length === b.length && a.every((x, k) => Math.abs(x - b[k]) <= t);
const raw = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
// my expectation for (hour, season) against a snapshot
function lookProblems(g, hour, season, tag) {
  const f = [], L = V.mySky(hour, season, g.house.northDeg, SKY, VARIANT), sun = g.lights.find((l) => l.type === 'DirectionalLight'), hemi = g.lights.find((l) => l.type === 'HemisphereLight');
  if (!sun || !hemi) return [`${tag}: lights ${g.lights.map((l) => l.type)}`];
  if (!close3(sun.color, H.lin(L.sunColor), 2e-5) || Math.abs(sun.I - L.sunIntensity) > 1e-9) f.push(`${tag}: sun ${sun.color.map((x) => x.toFixed(4))} x ${sun.I}, mine ${L.sunColor} x ${L.sunIntensity}`);
  if (!close3(hemi.color, H.lin(L.hemiSky), 2e-5) || !close3(hemi.ground, H.lin(L.hemiGround), 2e-5) || Math.abs(hemi.I - L.hemiIntensity) > 1e-9) f.push(`${tag}: hemisphere ${L.hemiSky} / ${L.hemiGround} x ${L.hemiIntensity} expected`);
  if (!close3(g.bg, raw(L.background), 1e-6)) f.push(`${tag}: background ${g.bg && g.bg.map((x) => x.toFixed(4))} != raw ${L.background}`);
  const fp = g.house.fp, c = g.house.center, tgt = [fp.u + fp.w / 2 - c[0], 0, -(fp.v + fp.d / 2 - c[1])], d = sun.pos.map((x, k) => x - sun.target[k]), len = Math.hypot(...d);
  if (!close3(sun.target, tgt, 1e-6)) f.push(`${tag}: sun target ${sun.target.map((x) => x.toFixed(3))} != footprint centre ${tgt.map((x) => x.toFixed(3))}`);
  if (Math.abs(len - PC.C.VIEW3D.sunDist * g.house.radius) > 1e-6 || !close3(d.map((x) => x / len), L.sunDir, 1e-6)) f.push(`${tag}: sun at ${d.map((x) => (x / len).toFixed(4))} x ${len.toFixed(2)}, mine ${L.sunDir.map((x) => x.toFixed(4))} x ${(PC.C.VIEW3D.sunDist * g.house.radius).toFixed(2)}`);
  if (g.mats.groundPlot && !close3(g.mats.groundPlot, H.lin(L.groundColor), 2e-5)) f.push(`${tag}: plot ground not ${L.groundColor}`);
  // F6-T1b winter meadow (e775004): groundOuter follows the season's meadow colour; summer = siteColors.groundOuter, winter
  // #E4E8EA (FS / Designer), spring / autumn = the table's meadow key. Before it: groundOuter never changes.
  const MEAD = (SKY.seasons.summer || {}).meadow !== undefined, mw = !MEAD ? T3.siteColors.groundOuter : season === 'summer' ? T3.siteColors.groundOuter : season === 'winter' ? '#E4E8EA' : SKY.seasons[season].meadow;
  if (MEAD && (SKY.seasons.summer.meadow.toUpperCase() !== T3.siteColors.groundOuter.toUpperCase() || SKY.seasons.winter.meadow.toUpperCase() !== '#E4E8EA')) f.push(`${tag}: meadow table summer ${SKY.seasons.summer.meadow} / winter ${SKY.seasons.winter.meadow}`);
  if (!g.mats.groundOuter || !close3(g.mats.groundOuter, H.lin(mw), 2e-5)) f.push(`${tag}: groundOuter ${MEAD ? `not the ${season} meadow ${mw}` : 'changed'}`);
  if (g.mats.trunks && !close3(g.mats.trunks, H.lin(T3.siteColors.trunk), 2e-5)) f.push(`${tag}: trunk colour changed`);
  if (g.mats.canopies) { if (!close3(g.mats.canopies, H.lin(L.canopyColor), 2e-5)) f.push(`${tag}: canopy not ${L.canopyColor}`); if (g.vis.canopies !== L.canopyVisible) f.push(`${tag}: canopies visible ${g.vis.canopies}`); }
  if (g.mats.shrubs && !close3(g.mats.shrubs, H.lin(L.shrubColor), 2e-5)) f.push(`${tag}: shrub not ${L.shrubColor}`);
  if (g.look && (Math.abs(g.look.hour - hour) > 1e-9 || g.look.season !== season)) f.push(`${tag}: debug look ${JSON.stringify(g.look)}`);
  return f;
}
const sameScene = (a, b, tag) => { const f = []; if (b.builds !== a.builds) f.push(`${tag}: builds ${a.builds} -> ${b.builds}`); if (!eq(a.meshIds, b.meshIds) || !eq(a.matIds, b.matIds)) f.push(`${tag}: meshes / materials replaced`); if (b.geoms !== a.geoms) f.push(`${tag}: geometries ${a.geoms} -> ${b.geoms}`);
  const p = a.pose, q = b.pose; if (!(p && q && Math.abs(p.radius - q.radius) < 1e-9 && Math.abs(p.theta - q.theta) < 1e-9 && Math.abs(p.phi - q.phi) < 1e-9 && p.target.every((x, k) => Math.abs(x - q.target[k]) < 1e-9))) f.push(`${tag}: camera pose changed`); return f; };
// shadow box (after a render, r128's own shadow camera matrices) holds the content
const SHADOW = (veg) => { const i = PC.debug.scene(); i.renderNow(); let sun = null; i.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sun = o; });
  const h = i.house, c = h.center, X = (u) => u - c[0], Z = (v) => -(v - c[1]), pts = [], fp = h.footprint, st = h.site;
  const rect = (r, ys, g = 0) => { for (const u of [r.u - g, r.u + r.w + g]) for (const v of [r.v - g, r.v + r.d + g]) for (const y of ys) pts.push([X(u), y, Z(v)]); };
  rect(fp, [0, h.roof.baseY]); if (st.pool) rect(st.pool, [0], 0.3); if (st.parking) rect(st.parking, [0, st.parking.covered ? 2.4 : 0]); if (st.seating) rect(st.seating, [0]);
  for (const t of st.trees || []) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = veg.tree.canopyR * t[2]; pts.push([X(t[0] + r * Math.cos(a)), (veg.tree.canopyY0 + veg.tree.canopyH) * t[2], Z(t[1] + r * Math.sin(a))]); }
  for (const t of st.shrubs || []) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, r = veg.shrub.r * t[2]; pts.push([X(t[0] + r * Math.cos(a)), 0, Z(t[1] + r * Math.sin(a))]); }
  const cam = sun.shadow.camera, m = cam.matrixWorldInverse.elements, cap = PC.C.VIEW3D.shadowR * h.radius, out = { cam: ['left', 'right', 'top', 'bottom', 'near', 'far'].map((k) => cam[k]), cap, out: 0, ex: null, n: pts.length };
  const capX = cam.left <= -cap + 1e-6 || cam.right >= cap - 1e-6, capY = cam.bottom <= -cap + 1e-6 || cam.top >= cap - 1e-6; out.capped = capX || capY;
  for (const p of pts) { const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
    const bad = (!capX && (x < cam.left - 1e-3 || x > cam.right + 1e-3)) || (!capY && (y < cam.bottom - 1e-3 || y > cam.top + 1e-3)) || -z < cam.near - 1e-3 || -z > cam.far + 1e-3; if (bad) { out.out++; out.ex = out.ex || [x, y, -z].map((q) => +q.toFixed(2)); } }
  out.over = [cam.left, cam.right, cam.top, cam.bottom].some((q) => Math.abs(q) > cap + 1e-6);
  return out; };
// mean sRGB luminance of the canvas (screenshot decoded in the page)
async function lum(S) {
  const buf = await S.page.locator('[data-pc="v3-canvas"]').screenshot();
  return S.page.evaluate((b64) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, im.width, im.height).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; res(s / (d.length / 4)); }; im.src = 'data:image/png;base64,' + b64; }), buf.toString('base64'));
}
const ctl = (S) => S.page.evaluate((P) => { const q = (h) => document.querySelector(`[data-pc="${h}"]`); return { v: Number(q('v3-time').value), out: q('v3-time-out').textContent.trim(), season: q('v3-season').value,
  pressed: Object.fromEntries(Object.entries(P).map(([h, k]) => [h, q(k).getAttribute('aria-pressed')])), dis: ['v3-time', 'v3-season', ...Object.values(P)].filter((h) => q(h).disabled), later: (PC.three.finder && PC.view3d.flyTo ? [] : ['v3-room']).concat(PC.three.tour && PC.tourplan ? [] : ['v3-tour-start', 'v3-tour-pause', 'v3-tour-stop']).filter((h) => !q(h).disabled), sky: q('v3-time').classList.contains('pc-range--sky') }; }, PRESET_HOOK);
const ctlProblems = (c, hour, season, tag) => { const f = []; if (Math.abs(c.v - hour) > 1e-9 || c.out !== V.hhmm(hour)) f.push(`${tag}: slider ${c.v} / "${c.out}", expected ${hour} / "${V.hhmm(hour)}"`); if (c.season !== season) f.push(`${tag}: season select ${c.season}`);
  for (const [h, st] of Object.entries(c.pressed)) { const want = Math.abs(Number(h) - hour) < 1e-9; if ((st === 'true') !== want) f.push(`${tag}: ${PRESET_HOOK[h]} aria-pressed ${st}`); } return f; };
const lightTab = async (S) => { if (await S.shown('v3-tab-light')) await S.act('v3-tab-light'); };   // tabs exist on narrow layouts only
async function settleLook(S) { await S.settle(); await ready(S); }
let VARIANT = 'renorm';
if (HAS.look) { const lo = PC.sky.compute(6.1, 'winter', 0, PC.data.sky).sunDir, ex = V.mySunDir(6.1, 'winter', 0, SKY, 'exact'); if (Math.abs(lo[1] - ex[1]) < 1e-9 && Math.abs(lo[0] - ex[0]) < 1e-9) VARIANT = 'exact'; }
// a short state for the shortfall check (node, QA's own rule on the model's vegPlaced)
function shortMut() {
  const muts = ["s.plot.pts = [[0, 0], [16, 0], [16, 18], [0, 18]]; s.ans.streetEdge = 0; s.ans.footprintPct = 50; s.ans.vegPct = 45;", "s.plot.pts = [[0, 0], [16, 0], [16, 18], [0, 18]]; s.ans.streetEdge = 0; s.ans.footprintPct = 25; s.ans.vegPct = 45;",
    "s.plot.pts = [[0, 0], [20, 0], [20, 24], [0, 24]]; s.ans.streetEdge = 0; s.ans.footprintPct = 50; s.ans.vegPct = 45;"];
  for (const m of muts) { const s = Q.plain(PC.sample.state()); new Function('s', m)(s); s.plans = {}; PC.plans.sync(s); for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true;
    const site = PC.site.analyse(s), placed = V.vegPlacedOf(PC, s); if (site && V.shouldWarn(s.ans.vegPct, placed, site.veg.area)) return { m, placed, site, s }; }
  return null;
}

const browser = await launch();

// ================= A. Light tab, look, session (desk) =================
if (HAS.look) await guard('A 1280x800', async () => {
  const S = await session(browser, VP.desk, { three: 'real', init: [RAF] }), T = 'A 1280x800 real';
  if (!(await to5(S))) R.check(`${T}: ready`, ['not ready']);
  await lightTab(S);
  let c = await ctl(S), g = await snap(S), f = [];
  if (c.dis.length || c.later.length) f.push(`disabled ${JSON.stringify(c.dis)}, live later controls ${JSON.stringify(c.later)}`);
  f.push(...ctlProblems(c, 12, 'summer', 'open'), ...lookProblems(g, 12, 'summer', 'open'));
  const note = await S.page.evaluate(() => { const n = [...document.querySelectorAll('.pc-v3note')].find((e) => /solar/.test(e.textContent)); return n ? [n.textContent.trim().replace(/\s+/g, ' '), !!(n.offsetWidth && n.offsetHeight)] : null; });
  if (!note || note[0] !== 'approximate — not real solar data' || !note[1]) f.push(`label ${JSON.stringify(note)}`);
  if (!c.sky) f.push('v3-time without pc-range--sky (Designer 3.2)');
  R.check(`${T}: Light controls live (room finder, tour still disabled); opens 12:00 summer, Noon pressed, "approximate — not real solar data" shown; scene = my oracle (12, summer)`, f);
  await S.shot('A-light-open');
  // presets, keys, season
  const base = await snap(S), g2 = [];
  const step = async (how, hour, season, tag) => { await how(); await settleLook(S); const cc = await ctl(S), gg = await snap(S); g2.push(...ctlProblems(cc, hour, season, tag), ...lookProblems(gg, hour, season, tag), ...sameScene(base, gg, tag)); };
  await step(() => S.act('v3-preset-evening'), 17.5, 'summer', 'Evening click');
  await step(async () => { await S.page.focus('[data-pc="v3-time"]'); await S.page.keyboard.press('ArrowRight'); }, 17.75, 'summer', 'ArrowRight');
  await step(() => S.page.keyboard.press('ArrowLeft'), 17.5, 'summer', 'ArrowLeft back on the preset');
  await step(() => S.page.keyboard.press('Home'), 0, 'summer', 'Home');
  await step(() => S.page.keyboard.press('End'), 24, 'summer', 'End');
  await step(async () => { await S.page.focus('[data-pc="v3-preset-night"]'); await S.page.keyboard.press('Space'); }, 22, 'summer', 'Night by Space');
  await step(() => S.act('v3-preset-morning'), 8, 'summer', 'Morning click');
  await step(async () => { await S.page.selectOption('[data-pc="v3-season"]', 'winter'); }, 8, 'winter', 'season winter');
  await step(() => S.act('v3-preset-noon'), 12, 'winter', 'Noon click');
  R.check(`${T}: presets by click and Space, arrows (0.25 h), Home / End, season select: slider, HH:MM readout and aria-pressed (only the matching preset) follow; the scene = my oracle each time; no rebuild, no new geometry / material / mesh, camera unchanged`, cut(g2));
  await S.shot('A-winter-noon');
  // orbit between slider steps
  const o = [];
  { const box = await S.page.evaluate(() => { const r = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    for (let k = 0; k < 3; k++) {
      await S.page.focus('[data-pc="v3-time"]'); const a = await snap(S); await S.page.keyboard.press('ArrowRight'); await settleLook(S); const b = await snap(S);
      o.push(...sameScene(a, b, `slider step ${k}`));
      await S.page.mouse.move(box[0], box[1]); await S.page.mouse.down(); await S.page.mouse.move(box[0] + 60, box[1] + 10, { steps: 4 }); await S.page.mouse.up(); await settleLook(S);
      const cc = await ctl(S), d = await snap(S);
      if (Math.abs(cc.v - (12 + 0.25 * (k + 1))) > 1e-9) o.push(`after drag ${k}: slider ${cc.v}`); o.push(...lookProblems(d, 12 + 0.25 * (k + 1), 'winter', `after drag ${k}`));
      if (eq(d.pose, b.pose)) o.push(`drag ${k} did not orbit`); if (d.builds !== b.builds) o.push(`drag ${k} rebuilt`);
    } }
  R.check(`${T}: orbit drags between slider steps: each step keeps the pose, each drag changes only the pose (look and slider kept), no rebuild`, cut(o));
  // 16 looks + edge hours: scene, shadow fit, timing
  const L = [], sh = [], times = [];
  const veg = PC.data.vegetation || V.VEG_TABLE;
  const b0 = await snap(S);
  for (const season of V.SEASONS) for (const hour of [8, 12, 17.5, 22, ...EDGE_H]) {
    const dt = await S.page.evaluate(([h, s]) => { const t = performance.now(); PC.view3d.setLook({ hour: h, season: s }); return performance.now() - t; }, [hour, season]); times.push(dt);
    const gg = await snap(S); L.push(...lookProblems(gg, hour, season, `${season} ${hour} h`), ...sameScene(b0, gg, `${season} ${hour} h`));
    const sun = gg.lights.filter((l) => l.cast); if (sun.length !== 1 || sun[0].type !== 'DirectionalLight' || Math.max(...sun[0].map) > MAPMAX) L.push(`${season} ${hour} h: shadow lights ${JSON.stringify(sun.map((l) => [l.type, l.map]))}`);
    const s = await S.page.evaluate(SHADOW, veg); if (s.out || s.over) sh.push(`${season} ${hour} h: ${s.out} of ${s.n} content points outside the shadow box ${s.cam.map((x) => x.toFixed(2))} (e.g. light view ${s.ex}), over the cap ${s.over}`);
  }
  await S.page.evaluate(() => PC.view3d.setLook({ hour: 8, season: 'summer' })); const m8 = (await snap(S)).lights.find((l) => l.cast).cam;
  await S.page.evaluate(() => PC.view3d.setLook({ hour: 17.5, season: 'summer' })); const m17 = (await snap(S)).lights.find((l) => l.cast).cam;
  if (eq(m8, m17)) sh.push(`shadow box not refitted between 8 and 17.5 h: ${m8}`);
  R.check(`${T}: 4 seasons x ${4 + EDGE_H.length} hours (presets${EDGE_H.length ? ', 0 / 6 / 18 / 24' : ''}) through setLook: the scene = my oracle, the same meshes / materials / geometries, camera kept, one shadow light (map <= ${MAPMAX})`, cut(L));
  R.check(`${T}: shadow box (r128's light view after a render) holds the content at every look (footprint to the roof base, canopies, shrubs, pool + rim, parking, seating) or is capped at shadowR x radius; refitted between 8 and 17.5 h`, cut(sh));
  times.sort((a, b) => a - b); R.check(`${T}: setLook (applyLook + invalidate) under 16 ms on every look (median ${times[times.length >> 1].toFixed(2)} ms, max ${times[times.length - 1].toFixed(2)} ms)`, times[times.length - 1] < 16 ? [] : [`max ${times[times.length - 1].toFixed(2)} ms`]);
  // luminance
  const lu = {};
  for (const [k, h] of [['noon', 12], ['evening', 17.5], ['night', 22]]) { await S.page.evaluate((h) => PC.view3d.setLook({ hour: h, season: 'summer' }), h); await settleLook(S); lu[k] = await lum(S); await S.shot(`A-summer-${k}`); }
  R.check(`${T}: mean canvas luminance noon ${lu.noon.toFixed(1)} > evening ${lu.evening.toFixed(1)} > night ${lu.night.toFixed(1)} (summer)`, lu.noon > lu.evening && lu.evening > lu.night ? [] : [JSON.stringify(lu)]);
  // session look
  const k = [];
  await S.page.evaluate(() => PC.view3d.setLook({ hour: 22, season: 'autumn' })); await lightTab(S); await S.act('v3-preset-night'); await S.page.selectOption('[data-pc="v3-season"]', 'autumn'); await settleLook(S);
  const chk = async (tag) => { const cc = await ctl(S), gg = await snap(S); k.push(...ctlProblems(cc, 22, 'autumn', tag), ...lookProblems(gg, 22, 'autumn', tag)); return gg; };
  await chk('set');
  await S.act('step-4'); await S.settle(); await S.act('step-5'); await ready(S); await chk('stage 4 and back');
  let bb = (await snap(S)).builds; await S.page.evaluate(() => { PC.store.go(4); PC.store.commit((s) => { s.ans.interior.style = 'classic'; }); PC.store.go(5); }); await ready(S);
  let gg = await chk('Q18 rebuild'); if (gg.builds !== bb + 1) k.push(`Q18: builds ${bb} -> ${gg.builds}`);
  bb = gg.builds; await S.page.evaluate(() => { const gl = PC.debug.scene().renderer.getContext(); window.__lc = gl.getExtension('WEBGL_lose_context'); window.__lc.loseContext(); });
  await S.until(() => S.page.evaluate(() => PC.debug.scene().lost), 3000); await S.page.evaluate(() => window.__lc.restoreContext()); await S.until(() => S.page.evaluate((b) => PC.debug.scene().builds > b, bb), 5000); await ready(S);
  await chk('context restore');
  await to5(S); await chk('whole-state replace (sample loaded again)');
  await S.reload(); await to5(S); await lightTab(S); { const cc = await ctl(S), g3 = await snap(S); k.push(...ctlProblems(cc, 12, 'summer', 'reload'), ...lookProblems(g3, 12, 'summer', 'reload')); }
  R.check(`${T}: session look (22:00 autumn) kept across stage 4 and back, a Q18 rebuild, a context loss + restore and a whole-state replace; a reload opens at 12:00 summer (A-13, TL Q5)`, cut(k));
  await S.end(T);
});

// ================= B. vegetation meshes =================
const INST = (veg) => { const T1B = !!PC.C.CONTACT; const w = PC.debug.scene().world, h = PC.debug.scene().house, c = h.center, out = { meshes: 0, names: [], inst: {}, model: { trees: h.site.trees.length, shrubs: h.site.shrubs.length }, f: [] };
  w.updateMatrixWorld(true);
  // F6-T2 (plan §5 / N4, marker PC.data.furnitureParts): my count of the T2 meshes = per level with rooms textured + glow
  // (full tier), lamps where a piece has a lamp part (G also with the gate lamps: wall + gate), + one glazing with openings.
  // glow-<level> is an additive InstancedMesh on the blob map, not vegetation: kept out of the instanced names.
  if (PC.data.furnitureParts) { const lv = h.levels.filter((l) => l.rooms.length);
    out.t2 = lv.length * 2 + lv.filter((l) => l.rooms.some((r) => r.furniture.some((p) => (p.parts || []).some((q) => q.mat === 'lamp'))) || (l.id === 'G' && h.site.wall && h.site.gate)).length + ((h.openings || []).length ? 1 : 0); } else out.t2 = 0;
  out.glow = [];
  w.traverse((o) => { if (!o.isMesh) return; out.meshes++; if (!o.isInstancedMesh) return; if (/^glow-/.test(o.name)) { out.glow.push(o.name); return; } out.names.push(o.name); const g = o.geometry, P = g.attributes.position;
    out.inst[o.name] = { count: o.count, culled: o.frustumCulled, cast: o.castShadow, recv: o.receiveShadow, type: g.type, par: g.parameters, parent: o.parent && o.parent.name, indexed: !!g.index, icol: !!o.instanceColor };
    if (o.name === 'blobs') return;
    const kind = o.name === 'shrubs' ? 'shrubs' : 'trees', list = h.site[kind], spec = o.name === 'trunks' ? [veg.tree.trunkR, 0, veg.tree.trunkH] : o.name === 'canopies' ? [veg.tree.canopyR, veg.tree.canopyY0, veg.tree.canopyY0 + veg.tree.canopyH] : [veg.shrub.r, 0, veg.shrub.h];
    const M = new THREE.Matrix4(), p = new THREE.Vector3(); let bad = 0;
    for (let k = 0; k < o.count; k++) { o.getMatrixAt(k, M); M.premultiply(o.matrixWorld); const it = list[k]; if (!it) { bad++; continue; } const cx = it[0] - c[0], cz = -(it[1] - c[1]), s = it[2]; let rMax = 0, y0 = Infinity, y1 = -Infinity, rOut = 0;
      for (let j = 0; j < P.count; j++) { p.fromBufferAttribute(P, j).applyMatrix4(M); const r = Math.hypot(p.x - cx, p.z - cz); rMax = Math.max(rMax, r); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      // F6-T1b (plan §6.3, designer-plan E1 / E2): trunks lean <= leanDeg about the base, so they reach at most trunkH x s and
      // dip at most trunkR x s x sin(lean); canopy / shrub lumps sit inside the old envelope (radius, Y range) with no rotation
      let off;
      if (!T1B) off = Math.abs(rMax - spec[0] * s) > 1e-4 || Math.abs(y0 - spec[1] * s) > 1e-4 || Math.abs(y1 - spec[2] * s) > 1e-4;
      else if (o.name === 'trunks') { const up = new THREE.Vector3(0, 1, 0).transformDirection(M), lean = Math.acos(Math.min(1, up.y)) * 180 / Math.PI, sl = Math.sin(veg.tree.leanDeg * Math.PI / 180);
        off = lean > veg.tree.leanDeg + 1e-3 || y0 < -spec[0] * s * sl - 1e-3 || y0 > 1e-4 || y1 > spec[2] * s + spec[0] * (veg.tree.taper || 1) * s * sl + 1e-4 || y1 < spec[2] * s * Math.cos(veg.tree.leanDeg * Math.PI / 180) - 1e-3 || rMax > spec[0] * s + spec[2] * s * sl + 1e-3; }
      else { const e = M.elements, rot = Math.abs(e[1]) + Math.abs(e[2]) + Math.abs(e[4]) + Math.abs(e[6]) + Math.abs(e[8]) + Math.abs(e[9]);
        off = rot > 1e-6 || rMax > spec[0] * s + 1e-4 || y0 < spec[1] * s - 1e-4 || y1 > spec[2] * s + 1e-4; }
      if (off) { if (bad < 3) out.f.push(`${o.name} #${k}: radius ${rMax.toFixed(3)} Y ${y0.toFixed(3)}..${y1.toFixed(3)}, model (${it.map((x) => x.toFixed(2))}) wants ${(spec[0] * s).toFixed(3)} / ${(spec[1] * s).toFixed(3)}..${(spec[2] * s).toFixed(3)}`); bad++; } }
    if (bad > 3) out.f.push(`${o.name}: ${bad} instances off`); });
  return out; };
function instProblems(r, tag) {
  const f = [...r.f.map((x) => `${tag}: ${x}`)], want = { trunks: r.model.trees, canopies: r.model.trees, shrubs: r.model.shrubs }, segs = { trunks: ['CylinderGeometry', 'radialSegments', V.VEG_TABLE.tree.trunkSeg], canopies: ['ConeGeometry', 'radialSegments', V.VEG_TABLE.tree.canopySeg], shrubs: ['ConeGeometry', 'radialSegments', V.VEG_TABLE.shrub.seg] };
  for (const n of ['trunks', 'canopies', 'shrubs']) { const it = r.inst[n];
    if (!want[n]) { if (it) f.push(`${tag}: ${n} mesh with no items`); continue; }
    if (!it) { f.push(`${tag}: no ${n} mesh for ${want[n]} items`); continue; }
    if (it.count !== want[n]) f.push(`${tag}: ${n} count ${it.count} != model ${want[n]}`);
    if (it.culled !== false) f.push(`${tag}: ${n} frustumCulled ${it.culled}`);
    if (!it.cast || it.recv) f.push(`${tag}: ${n} cast ${it.cast} receive ${it.recv}`);
    if (!T1BV) { if (it.type !== segs[n][0] || !it.par || it.par[segs[n][1]] !== segs[n][2]) f.push(`${tag}: ${n} geometry ${it.type} ${JSON.stringify(it.par)}`); }
    else if (n === 'trunks') { const T = PC.data.vegetation.tree, p = it.par || {};   // F6-T1b: tapered cylinder, 6 segments
      if (it.type !== 'CylinderGeometry' || p.radialSegments !== V.VEG_TABLE.tree.trunkSeg || Math.abs(p.radiusTop - V.VEG_TABLE.tree.trunkR * V.VEG_T1B.taper) > 1e-9 || Math.abs(p.radiusBottom - V.VEG_TABLE.tree.trunkR) > 1e-9 || T.taper !== V.VEG_T1B.taper) f.push(`${tag}: trunks geometry ${it.type} ${JSON.stringify(p)}`); }
    else if (it.type !== 'BufferGeometry' || it.indexed || !it.icol) f.push(`${tag}: ${n} geometry ${it.type} indexed ${it.indexed} instanceColor ${it.icol} (F6-T1b: non-indexed lumps with per-instance colour)`); }
  const okNames = ['trunks', 'canopies', 'shrubs', ...(T1BV ? ['blobs'] : [])];
  if (r.names.some((n) => !okNames.includes(n))) f.push(`${tag}: instanced meshes ${r.names}`);
  if (T1BV) { const b = r.inst.blobs, nItems = r.model.trees + r.model.shrubs;   // plan §6.2 item 4: one blob per shrub and tree (not winter here)
    if (nItems ? !b || b.count !== nItems || b.cast || b.recv : b) f.push(`${tag}: blobs ${b ? `count ${b.count}, cast ${b.cast}, receive ${b.recv}` : 'missing'} for ${nItems} items`); }
  return f;
}
if (HAS.scatter) await guard('B vegetation', async () => {
  const S = await session(browser, VP.desk, { three: 'real' }), T = 'B 1280x800 real', veg = PC.data.vegetation || V.VEG_TABLE;
  await to5(S); let r = await S.page.evaluate(INST, veg); const f = instProblems(r, 'sample'), m25 = r.meshes;
  if (!r.model.trees || !r.model.shrubs) f.push(`sample: ${r.model.trees} trees, ${r.model.shrubs} shrubs`);
  await S.shot('B-sample-trees');
  await to5(S, 's.ans.vegPct = 0;'); r = await S.page.evaluate(INST, veg); f.push(...instProblems(r, '0 %')); if (r.names.length || r.meshes !== 12 + NEW6 + r.t2) f.push(`0 %: ${r.meshes} meshes, instanced ${r.names} (${12 + NEW6 + r.t2}, none)`);
  if (m25 !== 12 + NEW6 + 3 + (T1BV ? 1 : 0) + r.t2) f.push(`sample at 25 %: ${m25} meshes (12 + ${NEW6 ? NEW6 + ' F6 + ' : ''}3${T1BV ? ' + blobs' : ''}${r.t2 ? ` + ${r.t2} F6-T2` : ''})`);
  await to5(S, "s.plot.pts = [[0, 0], [100, 0], [100, 100], [0, 100]]; s.ans.streetEdge = 0; s.ans.footprintPct = 15; s.ans.vegPct = 80; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.usableRoof = true; s.ans.roofType = 'terrace'; s.ans.pool = { on: true, size: 'L' }; s.ans.parking = { cars: 4, covered: true }; s.ans.extras = { wall: true, gate: 'right', seating: true }; s.ans.pairs = []; s.ans.rooms = []; let n = 1; for (const l of ['B', 'G', '1', '2']) for (const ty of ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry']) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); s.ans.nextRoomId = n;");
  r = await S.page.evaluate(INST, veg); f.push(...instProblems(r, '100 x 100 m at 80 %, 40 rooms'));
  if (r.model.trees !== 120 || r.model.shrubs !== 200 || r.meshes > 40) f.push(`maximum: ${r.model.trees} trees, ${r.model.shrubs} shrubs, ${r.meshes} meshes (120 / 200 / <= 40)`);
  await S.shot('B-max-garden');
  R.check(`${T}: InstancedMesh trunks / canopies / shrubs = the model (counts, every instance's extents: radius x s, trunk 0..2.6 s, canopy 1.4 s..4.2 s, shrub 0..0.8 s), frustumCulled false, cast not receive, 6 / 8 / 7 segments; sample ${m25} meshes; 0 % none (12); 100 x 100 m at 80 % with 40 rooms: caps 120 / 200, ${r.meshes} meshes <= 40`, cut(f));
  await S.end(T);
});

// ================= C. phone: touch, layout, shortfall =================
await guard('C 360x640', async () => {
  const S = await session(browser, VP.phone, { three: 'real' }), T = 'C 360x640 real';
  await to5(S);
  if (HAS.look) {
    await lightTab(S); const f = [];
    for (const [hook, h] of [['v3-preset-evening', 17.5], ['v3-preset-night', 22], ['v3-preset-noon', 12]]) { await S.act(hook); await settleLook(S); f.push(...ctlProblems(await ctl(S), h, 'summer', `tap ${hook}`), ...lookProblems(await snap(S), h, 'summer', `tap ${hook}`)); }
    const box = await S.page.evaluate(() => { const r = document.querySelector('[data-pc="v3-time"]').getBoundingClientRect(); return [r.left + r.width * 0.25, r.top + r.height / 2]; });
    await S.page.touchscreen.tap(...box); await settleLook(S); const c = await ctl(S);
    if (Math.abs(c.v - 12) < 1e-9 || Math.abs(c.v * 4 - Math.round(c.v * 4)) > 1e-9) f.push(`slider tap at 25 %: value ${c.v}`); else f.push(...ctlProblems(c, c.v, 'summer', 'slider tap'), ...lookProblems(await snap(S), c.v, 'summer', 'slider tap'));
    R.check(`${T}: presets and the slider by tap: readout, aria-pressed and the scene follow (slider tap -> ${c.v} h)`, cut(f));
    await S.layout(`${T} Light tab`); await S.shot('C-light');
    const lay = await S.page.evaluate(() => { const q = (h) => document.querySelector(`[data-pc="${h}"]`), pr = ['v3-preset-morning', 'v3-preset-noon', 'v3-preset-evening', 'v3-preset-night'].map((h) => q(h).getBoundingClientRect()), pn = q('v3-panel').getBoundingClientRect(), cv = q('v3-canvas').getBoundingClientRect();
      return { tops: pr.map((r) => Math.round(r.top)), small: ['v3-time', 'v3-season', 'v3-preset-morning', 'v3-preset-noon', 'v3-preset-evening', 'v3-preset-night'].filter((h) => { const r = q(h).getBoundingClientRect(); return r.height < 44 - 0.5 || r.width < 44 - 0.5; }), ratio: pn.height / cv.height, pn: pn.height, cv: cv.height }; });
    R.check(`${T}: Light pane: presets on one row, every control >= 44 px, panel ${lay.pn.toFixed(0)} px = ${(lay.ratio * 100).toFixed(1)} % of the ${lay.cv.toFixed(0)} px canvas (<= 34 %)`, new Set(lay.tops).size === 1 && !lay.small.length && lay.ratio <= 0.34 + 1e-9 ? [] : [JSON.stringify(lay)]);
  }
  if (HAS.scatter) {
    const g = [], stage5 = () => S.page.evaluate(() => (document.querySelector('[data-stage="5"]') || document.body).innerText);
    const rows = () => S.page.evaluate(() => [...document.querySelectorAll('[data-pc="conflict-list"] > li')].map((li) => ({ kind: li.dataset.kind, text: li.querySelector('[data-pc="conflict-text"]').textContent, aria: li.querySelector('[data-pc="conflict-goto"]').getAttribute('aria-label') })));
    if (/of planting fits/.test(await stage5())) g.push('sample: shortfall text on stage 5');
    await S.act('step-2'); await S.settle(); if ((await rows()).some((r) => V.isShort(r.text))) g.push('sample: shortfall row on stage 2');
    const sm = shortMut(); let where = 'none';
    if (!sm) g.push('no short state found among QA\'s three candidates');
    else { const want = V.shortText(sm.placed, sm.site.plotArea, sm.site.veg.pct, 'm'); await to5(S, sm.m); const t5 = await stage5(); await S.act('step-2'); await S.settle(); const r2 = await rows(), row = r2.find((r) => r.text === want);
      await S.act('btn-next'); await S.settle(); const pw = await S.page.evaluate(() => [...document.querySelectorAll('[data-pc="plan-warn-list"] li')].map((li) => li.textContent.trim().replace(/\s+/g, ' ')));
      if (row) { where = `stage 2 (${row.kind} row, "${row.aria}") + Floor plans`; if (row.kind !== 'warn') g.push(`stage 2 row kind ${row.kind}`); if (!pw.includes(want)) g.push(`stage 2 row but not on Floor plans ${JSON.stringify(pw)}`); }
      else if (t5.replace(/\s+/g, ' ').includes(want)) where = 'stage-5 panel';
      else g.push(`"${want}" neither on stage 2 (${JSON.stringify(r2.map((r) => r.text))}) nor in the stage-5 panel`);
      await S.shot('C-shortfall'); }
    R.check(`${T}: shortfall warning: none on the sample (stage 2, stage 5); on a short state (${sm ? sm.m.replace(/s\.ans\.|s\.plot\./g, '').slice(0, 70) : '-'}; placed ${sm ? sm.placed : '-'} m²) the PM's text, found on ${where}`, cut(g));
  }
  await S.end(T);
});

// ================= E. exploratory: Light pane at 640x360 and 768x1024 (F1-T1 layout rules, 44 px, one line each) =================
if (HAS.look && FULL) for (const vp of [{ tag: '640x360', w: 640, h: 360, touch: true }, { tag: '768x1024', w: 768, h: 1024, touch: true }]) await guard(`E ${vp.tag}`, async () => {
  const S = await session(browser, vp, { three: 'real' }), T = `E ${vp.tag} real`; await to5(S); await lightTab(S);
  await S.act('v3-preset-evening'); await settleLook(S); const f = ctlProblems(await ctl(S), 17.5, 'summer', 'Evening');
  const lay = await S.page.evaluate(() => { const q = (h) => document.querySelector(`[data-pc="${h}"]`); return ['v3-time', 'v3-season', 'v3-preset-morning', 'v3-preset-noon', 'v3-preset-evening', 'v3-preset-night'].map((h) => { const r = q(h).getBoundingClientRect(); return [h, r.width, r.height, r.right <= innerWidth + 0.5 && r.left >= -0.5]; }).filter(([, w, hh, inV]) => w < 43.5 || hh < 43.5 || !inV); });
  if (lay.length) f.push(`controls under 44 px or outside: ${JSON.stringify(lay)}`);
  await S.layout(`${T} Light tab`); await S.shot('E-light');
  R.check(`${T}: Light pane: Evening by tap (17:30, pressed), every control >= 44 px inside the viewport`, f);
  await S.end(T);
});

// ================= D. impl-review focus extras (real r128 pixels, maximum house looks, cap) =================
// screenshots decoded and kept in the page (window.__px), compared there: no megapixel arrays cross the wire
let PXN = 0;
const shotPx = async (S) => { const buf = await S.page.locator('[data-pc="v3-canvas"]').screenshot(), name = 'p' + PXN++; await S.page.evaluate(([b64, n]) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); (window.__px = window.__px || {})[n] = x.getImageData(0, 0, im.width, im.height).data; res(); }; im.src = 'data:image/png;base64,' + b64; }), [buf.toString('base64'), name]); return name; };
const pxDiffIn = (S, an, bn, thr = 30) => S.page.evaluate(([an, bn, thr]) => { const a = window.__px[an], b = window.__px[bn]; let n = 0, d = 0; for (let k = 0; k < a.length; k += 4) { const e = Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]); if (e > thr) n++; d += (0.2126 * (a[k] - b[k]) + 0.7152 * (a[k + 1] - b[k + 1]) + 0.0722 * (a[k + 2] - b[k + 2])); } return { n, dLum: d / (a.length / 4) }; }, [an, bn, thr]);
// F6-T1a: shadows are drawn on demand (shadowMap.autoUpdate false), so a test that toggles castShadow itself asks for the redraw
const setObj = (S, name, key, val) => S.page.evaluate(([n, k, v]) => { const i = PC.debug.scene(); i.world.getObjectByName(n)[k] = v; if (i.renderer && i.renderer.shadowMap) i.renderer.shadowMap.needsUpdate = true; PC.view3d.invalidate(); }, [name, key, val]);
if (HAS.look && HAS.scatter) await guard('D extras', async () => {
  const S = await session(browser, VP.desk, { three: 'real' }), T = 'D 1280x800 real', veg = PC.data.vegetation || V.VEG_TABLE;
  await to5(S); const f = [];
  // winter: no canopy pixels (the frame equals itself with the canopies forced hidden, and differs with them forced shown)
  await S.page.evaluate(() => PC.view3d.setLook({ hour: 12, season: 'winter' })); await ready(S); const w0 = await shotPx(S);
  await setObj(S, 'canopies', 'visible', true); await ready(S); const w1 = await shotPx(S); await setObj(S, 'canopies', 'visible', false); await ready(S); const w2 = await shotPx(S);
  const a = await pxDiffIn(S, w0, w1), b = await pxDiffIn(S, w0, w2); if (!(a.n > 200) || b.n) f.push(`winter frame vs canopies shown: ${a.n} px differ; vs forced hidden: ${b.n} px (0 expected)`);
  await S.shot('D-winter-noon');
  // vegetation shadows at 17.5 h: trees casting vs not
  await S.page.evaluate(() => PC.view3d.setLook({ hour: 17.5, season: 'summer' })); await ready(S); const s0 = await shotPx(S);
  for (const n of ['trunks', 'canopies']) await setObj(S, n, 'castShadow', false); await ready(S); const s1 = await shotPx(S);
  for (const n of ['trunks', 'canopies']) await setObj(S, n, 'castShadow', true); await ready(S);
  // summer 17.5 h: the sun at the 0.15 Y clamp grazes the ground, so shadows are faint (~10 levels per channel; observation O-1): count changes > 6
  const c = await pxDiffIn(S, s0, s1, 6); if (!(c.n > 1000 && c.dLum < 0)) f.push(`17.5 h: tree shadows change ${c.n} px (> 6 levels), mean luma ${c.dLum.toFixed(3)} (shadows should darken)`);
  // F5-T3a O-1 (version-aware): with the O-1 keys the evening shadows must read: >= 15 000 px change by > 30 levels (204 before O-1)
  const allCast = (on) => S.page.evaluate((on) => { const i = PC.debug.scene(); if (!on) { window.__cast = []; i.scene.traverse((o) => { if (o.castShadow && !o.isLight) { window.__cast.push(o); o.castShadow = false; } }); } else for (const o of window.__cast || []) o.castShadow = true; if (i.renderer && i.renderer.shadowMap) i.renderer.shadowMap.needsUpdate = true; PC.view3d.invalidate(); }, on);
  await allCast(false); await ready(S); const s2 = await shotPx(S); await allCast(true); await ready(S);
  const O1 = !!(V.skyGold(SKY) || {}).o1, c30 = await pxDiffIn(S, s0, s2, 30);
  if (O1 && !(c30.n >= 15000)) f.push(`O-1: 17.5 h summer shadows (every caster off) change only ${c30.n} px by > 30 levels (>= 15 000 required)`);
  R.note(`D ${O1 ? 'O-1 merged' : 'O-1 not merged'}: summer 17.5 h shadows (every caster off) change ${c30.n} px by > 30 levels (O-1 target >= 15 000)`);
  await S.shot('D-evening-shadows');
  R.check(`${T}: winter shows no canopy pixels (frame = canopies forced hidden, ${a.n} px differ with them shown); at 17.5 h the trunks and canopies cast shadows that darken the frame (${c.n} px change by > 6 levels, mean luma ${c.dLum.toFixed(2)}${O1 ? `; O-1: ${c30.n} px by > 30 levels, >= 15 000` : ''})`, f);
  // maximum house with the caps: all looks, no create / dispose, mean setLook, the house never clipped by the capped box
  if (REL) {
  const ok = await to5(S, "s.plot.pts = [[0, 0], [100, 0], [100, 100], [0, 100]]; s.ans.streetEdge = 0; s.ans.footprintPct = 15; s.ans.vegPct = 80; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.usableRoof = true; s.ans.roofType = 'terrace'; s.ans.pool = { on: true, size: 'L' }; s.ans.parking = { cars: 4, covered: true }; s.ans.extras = { wall: true, gate: 'right', seating: true }; s.ans.pairs = []; s.ans.rooms = []; let n = 1; for (const l of ['B', 'G', '1', '2']) for (const ty of ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry']) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); s.ans.nextRoomId = n;");
  const g = [], times = [], cap = []; const b0 = await snap(S), mem0 = await S.page.evaluate(() => JSON.stringify(PC.debug.scene().renderer.info.memory));
  if (!ok) g.push('not ready');
  for (const season of V.SEASONS) for (const hour of [6, 8, 12, 17.5, 18, 22]) {
    times.push(await S.page.evaluate(([h, s]) => { const t = performance.now(); PC.view3d.setLook({ hour: h, season: s }); return performance.now() - t; }, [hour, season]));
    const gg = await snap(S); g.push(...sameScene(b0, gg, `${season} ${hour} h`), ...lookProblems(gg, hour, season, `${season} ${hour} h`)); if (gg.meshIds.length > 40) g.push(`${gg.meshIds.length} meshes`);
    if (season === 'summer') { const r = await S.page.evaluate((veg) => { const i = PC.debug.scene(); i.renderNow(); let sun = null; i.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sun = o; }); const h = i.house, c = h.center, fp = h.footprint, cam = sun.shadow.camera, m = cam.matrixWorldInverse.elements; let out = 0;
        for (const u of [fp.u, fp.u + fp.w]) for (const v of [fp.v, fp.v + fp.d]) for (const y of [0, h.roof.baseY + 1.2]) { const p = [u - c[0], y, -(v - c[1])], x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], yy = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]; if (x < cam.left || x > cam.right || yy < cam.bottom || yy > cam.top || -z < cam.near || -z > cam.far) out++; }
        return { out, capped: Math.max(-cam.left, cam.right, -cam.bottom, cam.top) >= PC.C.VIEW3D.shadowR * h.radius - 1e-6 }; }, veg); cap.push(`${hour} h ${r.capped ? 'capped' : 'fitted'}${r.out ? `, ${r.out} house corners outside` : ''}`); if (r.out) g.push(`summer ${hour} h: ${r.out} house corners outside the shadow box`); }
  }
  const mem1 = await S.page.evaluate(() => JSON.stringify(PC.debug.scene().renderer.info.memory)); if (mem1 !== mem0) g.push(`renderer memory ${mem0} -> ${mem1}`);
  const mean = times.reduce((x, y) => x + y, 0) / times.length;
  if (mean >= 5) g.push(`setLook mean ${mean.toFixed(2)} ms`);
  R.check(`${T}: maximum house, 100 x 100 m at 80 % (caps): 24 looks, each = my oracle with the same meshes / materials, renderer memory unchanged (no create / dispose), ${b0.meshIds.length} meshes <= 40, setLook mean ${mean.toFixed(2)} ms < 5; the house (to the roof + 1.2 m) inside the shadow box at 6 / 8 / 12 / 17.5 / 18 / 22 h`, cut(g));
  R.note(`D maximum garden shadow box: ${cap.join(', ')}`);
  await S.page.evaluate(() => PC.view3d.setLook({ hour: 18, season: 'summer' })); await ready(S); await S.shot('D-max-18h');
  }
  await S.end(T);
});

await browser.close();
if (!FULL) R.note('A edge hours 0 / 6 / 18 / 24 and E 640x360 / 768x1024 run with QA_FULL=1 only (TL Q-T8 run-time moves)');
R.note(`sections: ${TIMES.join(', ')}; run ${((Date.now() - t0) / 1000).toFixed(1)} s; sunDir clamp variant ${VARIANT}`);
if (!REL) R.note('D: the maximum house with the caps (24 looks) runs in the release step only (QA_RELEASE=1; TL run-time ruling F6-T1c)');
process.exit(R.done() ? 0 : 1);
