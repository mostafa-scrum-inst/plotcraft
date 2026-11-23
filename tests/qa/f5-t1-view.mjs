// F5-T1 QA (browser, vendored real r128): the room finder in the built page, judged by QA's own oracle (f5-t1-ref.mjs).
// Version-aware: everything needs PC.view3d.flyTo + PC.three.finder (plan 9); without them the suite only notes the skip
// (no browser), so a main tree without F5-T1 stays green.
//   A 1280x800 mouse + keyboard, the sample at 22:00 winter:
//     the select: enabled, >= 44 px, "Go to room…" (value "") first, one optgroup per level lowest first (LEVEL_LABEL),
//     the plan names in plan order; tour controls still disabled.
//     A pick by keyboard (ArrowDown on the focused select) and by selection: Roof off, the room's level selected (UI +
//     scene), caption "<room> · <level>" with the tour buttons hidden, the select keeps the room, focus stays on it;
//     the flight (every frame recorded): 1.0-1.5 s, no step longer than 2 x the mean speed x dt, eye >= 1 m on every
//     frame, lands on my A-14 pose (1e-6), loop idle afterwards; the highlight mesh (child of world, no shadows, #C2410C,
//     inside the room rectangle just above its floor, close to its edges); the look (lights, background) untouched.
//     Redirect mid-flight: continuous, lands on the second room with the interpolated theta kept.
//     Cancel mid-flight: wheel (the gesture acts on the interpolated pose: radius x the wheel factor, target kept, no snap),
//     mouse down, arrow key: the flight stops at once and stays stopped. Orbit keeps the selection.
//     Clearing (highlight, caption, select back to "Go to room…"): "All", another level, Reset view, Roof on, "Go to
//     room…", a rebuild (Q10 while open), a context restore; leaving stage 5 mid-flight stops it for good.
//     Re-selection: renderer geometries constant (the old highlight disposed); real pixels: the highlight shows.
//   B 1280x800 maximum house (40 rooms): 40 options in 4 groups; a basement room opens the ground (level B, groundCap
//     hidden) at phi 15 degrees; meshes +1 with a selection and <= 40.
//   C 360x640 touch: select >= 44 px; a pick (native picker: selectOption) gives the caption; "Master bedroom · First
//     floor" inside the viewport with no page scroll; Light / View panes unchanged; no console errors.
// Run: node tests/qa/f5-t1-view.mjs [--no-shots] [--only=A,B,C]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, collector, launch } from './lib.mjs';
import { sessions } from './session.mjs';
import { roofTo } from './v3kit.mjs';
import * as H from './f4-t1-ref.mjs';
import * as F from './f5-t1-ref.mjs';

const R = collector('F5-T1 view');
const noShots = process.argv.includes('--no-shots'), shots = join(ROOT, 'tests/qa/shots/F5-T1');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const { PC } = H.loadPC3();
const HAS = !!(PC.view3d && typeof PC.view3d.flyTo === 'function' && PC.three && PC.three.finder);
if (!HAS) { R.note('skipped: PC.view3d.flyTo / PC.three.finder absent (F5-T1 not merged)'); process.exit(R.done() ? 0 : 1); }
if (!noShots) mkdirSync(shots, { recursive: true });
const session = sessions({ R, shots, noShots });
const VP = { phone: { tag: '360x640', w: 360, h: 640, touch: true }, desk: { tag: '1280x800', w: 1280, h: 800, touch: false } };
const t0 = Date.now(), TIMES = [];
const cut = (a, n = 8) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// rAF counter + a per-frame pose recorder (window.__rec while window.__recOn)
const REC = () => { const raf = window.requestAnimationFrame.bind(window); window.__raf = 0; window.__rec = []; window.__recOn = false;
  window.requestAnimationFrame = (cb) => { window.__raf++; return raf((ts) => { cb(ts); if (window.__recOn && window.PC && PC.view3d && PC.view3d.pose) { const fl = PC.debug && PC.debug.scene ? PC.debug.scene().flight : null; window.__rec.push([ts, PC.view3d.pose(), PC.view3d.flying ? PC.view3d.flying() : null, fl ? fl.t : null]); } }); }; };
const READY = () => { const i = PC.debug.scene(), q = (h) => document.querySelector(`[data-pc="${h}"]`); return (i.active && !i.building && i.builds > 0 && q('v3-building').hidden && !i.frame && !i.dirty) || !q('v3-unavailable').hidden; };
async function ready(S, ms = 8000) { const ok = await S.until(() => S.page.evaluate(READY), ms); await S.settle(); return ok; }
const landed = (S) => S.until(() => S.page.evaluate(() => !PC.view3d.flying() && !PC.debug.scene().frame && !PC.debug.scene().dirty), 12000);
async function to5(S, mut = '') {
  await S.page.evaluate((m) => { const st = PC.sample.state(); new Function('s', m)(st); st.plans = {}; st.stage = 1; PC.store.replace(st); PC.store.go(2); PC.store.go(3);
    PC.store.commit((s) => { for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; }, { nav: true }); PC.store.go(4); PC.store.go(5); }, mut);
  return ready(S);
}
async function guard(label, fn) { if (ONLY.length && !ONLY.includes(label[0])) return; if (RELONLY && label[0] !== 'A') return; const t = Date.now(); try { await fn(); } catch (e) { R.check(`${label}: ran to the end`, [String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')]); } TIMES.push(`${label} ${((Date.now() - t) / 1000).toFixed(1)} s`); }
const viewTab = async (S) => { if (await S.shown('v3-tab-view')) await S.act('v3-tab-view'); };
const tourTab = async (S) => { if (await S.shown('v3-tab-tour')) await S.act('v3-tab-tour'); };
const pick = (v) => `css:[data-pc="v3-level"] label:has(input[value="${v}"])`;

// ---------- page reads ----------
const HOUSE = () => { const h = PC.debug.scene().house; return { levels: h.levels.map((l) => ({ id: l.id, baseY: l.baseY, rooms: l.rooms.map((r) => ({ id: r.id, name: r.name, u: r.u, v: r.v, w: r.w, d: r.d })) })), footprint: h.footprint, center: h.center, radius: h.radius, storeyH: h.storeyH, roof: { baseY: h.roof.baseY } }; };
const LIMITS = () => { const i = PC.debug.scene(); return PC.cam.limits(i.house, i.size[0] / i.size[1]); };
const SELECT = () => { const s = document.querySelector('[data-pc="v3-room"]'), r = s.getBoundingClientRect();
  return { disabled: s.disabled, h: r.height, w: r.width, value: s.value, first: s.options[0] ? [s.options[0].value, s.options[0].textContent.trim()] : null,
    groups: [...s.querySelectorAll('optgroup')].map((g) => ({ label: g.label, rooms: [...g.querySelectorAll('option')].map((o) => ({ id: o.value, name: o.textContent.trim() })) })),
    loose: [...s.children].filter((c) => c.tagName === 'OPTION').length, tour: ['v3-tour-start', 'v3-tour-pause', 'v3-tour-stop'].filter((k) => !document.querySelector(`[data-pc="${k}"]`).disabled) }; };
const STATE = () => { const i = PC.debug.scene(), q = (h) => document.querySelector(`[data-pc="${h}"]`), w = i.world, hl = w.getObjectByName('highlight'), cap = w.getObjectByName('groundCap'), chk = q('v3-level').querySelector('input:checked');
  let meshes = 0; w.traverse((o) => { if (o.isMesh) meshes++; });
  const out = { roof: i.roof, roofUi: q('v3-roof').checked, level: i.level, levelUi: chk ? chk.value : null, cap: cap ? cap.visible : null, caption: q('v3-caption').hidden ? null : q('v3-caption-text').textContent.trim().replace(/\s+/g, ' '),
    capText: q('v3-caption').textContent.trim().replace(/\s+/g, ' '), tourBtns: ['v3-caption-pause', 'v3-caption-stop'].filter((k) => !q(k).hidden), value: q('v3-room').value, focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.pc : null,
    flying: PC.view3d.flying(), pose: PC.view3d.pose(), meshes, builds: i.builds, geoms: i.renderer.info.memory.geometries, hl: null };
  if (hl) { let vis = true; for (let n = hl; n; n = n.parent) if (!n.visible) vis = false; hl.updateMatrixWorld(true); const P = hl.geometry.attributes.position, C = hl.geometry.attributes.color, e = hl.matrixWorld.elements, xs = [], ys = [], zs = [], cols = new Set();
    for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k); xs.push(e[0] * x + e[4] * y + e[8] * z + e[12]); ys.push(e[1] * x + e[5] * y + e[9] * z + e[13]); zs.push(e[2] * x + e[6] * y + e[10] * z + e[14]); if (C) cols.add([C.getX(k), C.getY(k), C.getZ(k)].map((c) => c.toFixed(5)).join()); }
    const m = hl.material, mc = m && m.color && !m.vertexColors ? [m.color.r, m.color.g, m.color.b].map((c) => c.toFixed(5)).join() : null;
    out.hl = { parentIsWorld: hl.parent === w, visible: vis, cast: hl.castShadow, recv: hl.receiveShadow, n: P.count, x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)], z: [Math.min(...zs), Math.max(...zs)], cols: [...cols], mc }; }
  return out; };
const LIGHTS = () => { const i = PC.debug.scene(), o = []; i.scene.traverse((l) => { if (l.isLight) o.push([l.type, l.color.getHexString(), l.groundColor ? l.groundColor.getHexString() : '', l.intensity, l.position.toArray().map((x) => +x.toFixed(9))]); }); const b = i.scene.background; return { o, bg: b && b.getHexString ? b.getHexString() : null, look: PC.view3d.look ? PC.view3d.look() : i.look }; };
// choose a room programmatically (the select's own change event) and read the pose at that moment in the same task
const chooseIn = (S, id) => S.page.evaluate((id) => { const before = PC.view3d.pose(); window.__rec = []; window.__recOn = true; const s = document.querySelector('[data-pc="v3-room"]'); s.value = id; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); return { before, after: PC.view3d.pose(), t: performance.now() }; }, id);
const recStop = (S) => S.page.evaluate(() => { window.__recOn = false; return window.__rec; });

// expected pose for a pick from `cur`
const expectPose = (h, L, id, cur) => F.myClamp(F.myRawPose(h, id, cur), L, h);
// the flight's frames (one entry per rAF timestamp, the last callback's pose). TL ruling (a): progress is the sum of the
// capped steps (dt <= CAM.dtMax, A-12 anti-jump rule): it reaches the 1.2 s flight within 1.0-1.5 s of summed steps; the
// wall clock is judged only when the mean frame time is <= 100 ms (SwiftShader: 130-250 ms, recorded as an observation)
const DTMAX = (PC.C.CAM && PC.C.CAM.dtMax) || 100;
function flightProblems(rec, tag, { full = true } = {}) {
  const byTs = new Map(); for (const r of rec) byTs.set(r[0], r); const fr = [...byTs.values()].sort((a, b) => a[0] - b[0]);
  const f = [], moving = []; let prev = null;
  for (const [ts, p] of fr) { if (prev && F.poseDist(prev[1], p) > 1e-9) moving.push([ts, prev[1], p, ts - prev[0]]); prev = [ts, p]; }
  if (!moving.length) return { f: [`${tag}: no frame moved`] };
  const path = moving.reduce((s, m) => s + F.poseDist(m[1], m[2]), 0), summed = moving.reduce((s, m) => s + Math.min(DTMAX, m[3]), 0) / 1000,
    wall = (moving[moving.length - 1][0] - moving[0][0] + moving[0][3]) / 1000, frameMs = moving.reduce((s, m) => s + m[3], 0) / moving.length, mean = path / 1.2;
  if (full && (summed < 1.0 || summed > 1.5)) f.push(`${tag}: flight ${summed.toFixed(2)} s of summed capped steps (1.2 s planned)`);
  if (full && frameMs <= 100 && (wall < 1.0 || wall > 1.5)) f.push(`${tag}: flight ${wall.toFixed(2)} s wall clock at ${frameMs.toFixed(0)} ms frames (1.2 s planned)`);
  for (const [, a, b, dt] of moving) { const st = F.poseDist(a, b); if (st > 2 * mean * Math.min(Math.max(dt, 1000 / 60), DTMAX) / 1000 + 1e-3) { f.push(`${tag}: a ${st.toFixed(2)} m step in ${dt.toFixed(0)} ms (mean speed ${mean.toFixed(2)} m/s): jump`); break; } }
  const low = fr.find(([, p]) => F.eyeOf(p)[1] < 1 - 1e-6); if (low) f.push(`${tag}: eye at ${F.eyeOf(low[1])[1].toFixed(3)} m during the flight`);
  return { f, summed, wall, frameMs, path, frames: moving.length };
}
function selectedProblems(st, h, id, tag, before = null) {
  const f = [], { room: r, level: lv } = F.roomOf(h, id), want = F.captionOf(r.name, lv.id);
  if (st.roof || st.roofUi) f.push(`${tag}: Roof still on (${st.roof} / ${st.roofUi})`);
  if (st.level !== lv.id || st.levelUi !== lv.id) f.push(`${tag}: level ${st.level} / radio ${st.levelUi}, room on ${lv.id}`);
  if (lv.id === 'B' && st.cap !== false) f.push(`${tag}: groundCap visible for a basement room`);
  if (st.caption !== want) f.push(`${tag}: caption "${st.caption}", expected "${want}"`);
  if (st.tourBtns.length) f.push(`${tag}: tour buttons shown in the caption ${st.tourBtns}`);
  if (st.value !== id) f.push(`${tag}: select shows "${st.value}"`);
  const hl = st.hl, fy = F.floorYOf(lv), x0 = F.X(h, r.u), x1 = F.X(h, r.u + r.w), z0 = F.Z(h, r.v + r.d), z1 = F.Z(h, r.v);
  if (!hl) f.push(`${tag}: no highlight mesh`);
  else { if (!hl.parentIsWorld || !hl.visible || hl.cast || hl.recv) f.push(`${tag}: highlight parent world ${hl.parentIsWorld}, visible ${hl.visible}, cast ${hl.cast}, receive ${hl.recv}`);
    const lin = H.lin(F.HL_HEX).map((c) => c.toFixed(5)).join(); if (!(hl.cols.length === 1 && hl.cols[0] === lin) && hl.mc !== lin) f.push(`${tag}: highlight colours ${JSON.stringify(hl.cols.slice(0, 3))} / ${hl.mc}, want ${F.HL_HEX}`);
    if (hl.x[0] < x0 - 1e-6 || hl.x[1] > x1 + 1e-6 || hl.z[0] < z0 - 1e-6 || hl.z[1] > z1 + 1e-6) f.push(`${tag}: highlight X ${hl.x.map((x) => x.toFixed(2))} Z ${hl.z.map((x) => x.toFixed(2))} outside the room X ${[x0, x1].map((x) => x.toFixed(2))} Z ${[z0, z1].map((x) => x.toFixed(2))}`);
    else if (hl.x[0] > x0 + 0.3 || hl.x[1] < x1 - 0.3 || hl.z[0] > z0 + 0.3 || hl.z[1] < z1 - 0.3) f.push(`${tag}: highlight not along the room edges (more than 0.3 m inside)`);
    if (hl.y[0] < fy + 0.015 || hl.y[1] > fy + 0.12) f.push(`${tag}: highlight Y ${hl.y.map((x) => x.toFixed(3))}, floor ${fy.toFixed(2)} (above the tint, below 0.12)`); }
  return f;
}
const clearedProblems = (st, tag) => { const f = []; if (st.caption !== null) f.push(`${tag}: caption "${st.caption}" still shown`); if (st.value !== '') f.push(`${tag}: select "${st.value}"`); if (st.hl && st.hl.visible) f.push(`${tag}: highlight still shown`); return f; };

const browser = await launch();
const PXDIFF = ([a, b]) => Promise.all([a, b].map((s) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); res(x.getImageData(0, 0, im.width, im.height).data); }; im.src = 'data:image/png;base64,' + s; }))).then(([p, q]) => { let n = 0; for (let k = 0; k < p.length; k += 4) if (Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]) > 30) n++; return n; });
// F6-T1 run-time moves (TL Q-T8, docs/03-tasks/F6-T1/qa-full-moves.md): the mouse-down and arrow-key cancels and the
// frame-by-frame flight judgement after the first pick run with QA_FULL=1 only (the wheel cancel and the keyboard pick's
// recorded flight stay in the default run; every pick still lands on my pose).
// TL ruling (F6-T1c run-time debt): step 6 of A (the maximum house) runs in the release step only (QA_RELEASE=1;
// f6-t1-leak.mjs --stream-only runs this file with --release-only, which runs A whole: the sample part, then step 6).
const REL = !!process.env.QA_RELEASE, RELONLY = process.argv.includes('--release-only');
const FULL = !!process.env.QA_FULL, flightMore = (rec, tag, o) => (FULL ? flightProblems(rec, tag, o).f : []);
const OBS = [], LAP = []; let lapT = Date.now(); const lap = (n) => { const t = Date.now(); LAP.push(`${n} ${((t - lapT) / 1000).toFixed(1)}`); lapT = t; };
const MAXMUT = "s.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; s.ans.streetEdge = 0; s.ans.footprintPct = 40; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.usableRoof = true; s.ans.roofType = 'terrace'; s.ans.pool = { on: true, size: 'L' }; s.ans.parking = { cars: 4, covered: true }; s.ans.extras = { wall: true, gate: 'right', seating: true }; s.ans.pairs = []; s.ans.rooms = []; let n = 1; for (const l of ['B', 'G', '1', '2']) for (const ty of ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry']) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); s.ans.nextRoomId = n;";

// ================= A. desk, one page (A-16): sample picks, flight, cancel, clearing; then the maximum house =================
// Real r128 keeps 3 landed picks on the sample (ground by keyboard, first floor, a redirect) and one basement pick on the
// maximum house (TL ruling, 30 s budget); every room of 4 houses is covered by f5-t1-model (forRoom / roomGroups in node).
await guard('A 1280x800', async () => {
  const S = await session(browser, VP.desk, { three: 'real', init: [REC] }), T = 'A 1280x800 real';
  await to5(S); await S.page.evaluate(() => PC.view3d.setLook({ hour: 22, season: 'winter' })); await ready(S); await tourTab(S);
  const h = await S.page.evaluate(HOUSE), L = await S.page.evaluate(LIMITS), groups = F.myGroups(h), sel = await S.page.evaluate(SELECT), f = [];
  if (sel.disabled || sel.h < 44 - 0.5) f.push(`select disabled ${sel.disabled}, ${sel.h} px high`);
  if (!eq(sel.first, ['', 'Go to room…'])) f.push(`first option ${JSON.stringify(sel.first)}`);
  if (!eq(sel.groups, groups.map((g) => ({ label: g.label, rooms: g.rooms })))) f.push(`optgroups ${JSON.stringify(sel.groups).slice(0, 300)} vs mine ${JSON.stringify(groups).slice(0, 300)}`);
  if (sel.loose !== 1) f.push(`${sel.loose} options outside the groups`);
  if (sel.tour.length && !(PC.three && PC.three.tour)) f.push(`tour controls enabled ${sel.tour}`);   // F5-T2 (marker PC.three.tour) makes them live
  R.check(`${T}: room select enabled, ${sel.h.toFixed(0)} px, "Go to room…" first, ${groups.length} optgroups lowest first (LEVEL_LABEL) with the plan names in plan order (14 rooms); tour controls still disabled`, f);
  await S.shot('A-select');
  lap('load');
  // 1. keyboard pick (ground floor)
  await S.page.evaluate(() => PC.debug.scene().renderNow()); const geomsNone = (await S.page.evaluate(STATE)).geoms;
  const g = [], L0 = await S.page.evaluate(LIGHTS), first = groups[0].rooms[0].id, cur0 = await S.page.evaluate(() => PC.view3d.pose());
  await S.page.focus('[data-pc="v3-room"]'); await S.page.evaluate(() => { window.__rec = []; window.__recOn = true; }); await S.page.keyboard.press('ArrowDown'); await landed(S);
  let rec = await recStop(S), st = await S.page.evaluate(STATE);
  if (st.value !== first) g.push(`ArrowDown on the focused select gives "${st.value}", not the first room ${first}`);
  else { const fl = flightProblems(rec, 'keyboard pick'); g.push(...fl.f, ...selectedProblems(st, h, first, 'keyboard pick'));
    const d = F.poseDiff(st.pose, expectPose(h, L, first, cur0)); if (d) g.push(`keyboard pick lands at ${d}`);
    if (st.focus !== 'v3-room') g.push(`focus on ${st.focus} after the pick`);
    OBS.push(`keyboard pick: ${fl.frames} moving frames, mean frame ${fl.frameMs && fl.frameMs.toFixed(0)} ms, ${fl.summed && fl.summed.toFixed(2)} s summed capped steps, ${fl.wall && fl.wall.toFixed(2)} s wall clock${fl.frameMs > 100 ? ' (wall clock not judged: frames > 100 ms)' : ''}`); }
  if (!eq(await S.page.evaluate(LIGHTS), L0)) g.push('the look (lights / background / look()) changed by the pick');
  await S.page.evaluate(() => { window.__raf = 0; }); await S.page.waitForTimeout(300); if (await S.page.evaluate(() => window.__raf)) g.push('frames requested after the flight (loop not idle)');
  await S.shot('A-picked');
  lap('kbd');
  R.check(`${T}: keyboard pick (ArrowDown on the focused select, ground floor): Roof off, the room's level (UI + scene), caption "${F.captionOf(groups[0].rooms[0].name, groups[0].level)}", tour buttons hidden, select keeps the room, focus stays; flight 1.0-1.5 s of summed capped steps without a jump, eye >= 1 m, lands on my A-14 pose; highlight on the room (no shadows, #C2410C); look at 22:00 winter untouched; loop idle after`, cut(g));
  // 2. Roof on through the switch clears (TL Q3); a first-floor pick turns it off again without clearing; the highlight shows in the pixels
  const p = [], up = groups[1].rooms[0];
  await roofTo(S, true); p.push(...clearedProblems(await S.page.evaluate(STATE), 'Roof on'));   // the pick left the Roof off: one tap (F6-T1-safe helper)
  let c = await chooseIn(S, up.id); await landed(S); rec = await recStop(S); st = await S.page.evaluate(STATE);
  p.push(...selectedProblems(st, h, up.id, up.name), ...flightMore(rec, up.name)); let d = F.poseDiff(st.pose, expectPose(h, L, up.id, c.before)); if (d) p.push(`${up.name}: lands at ${d}`);
  const shot = async () => (await S.page.locator('[data-pc="v3-canvas"]').screenshot()).toString('base64');
  const on = await shot(); await S.page.evaluate(() => { PC.debug.scene().world.getObjectByName('highlight').visible = false; PC.debug.scene().renderNow(); }); await S.settle(); const off = await shot();
  await S.page.evaluate(() => { PC.debug.scene().world.getObjectByName('highlight').visible = true; PC.debug.scene().renderNow(); }); await S.settle();
  const nd = await S.page.evaluate(PXDIFF, [on, off]);
  if (nd < 30) p.push(`the highlight changes only ${nd} px of the frame`);
  await S.shot('A-highlight');
  lap('first');
  R.check(`${T}: Roof on through the switch clears the selection (TL Q3); a first-floor pick (${up.name}) turns the Roof off without clearing and follows the rules of 1; the highlight shows in the real r128 frame (${nd} px)`, cut(p));
  // 3. redirect mid-flight; the two re-selections keep the renderer's geometry count (old highlights disposed)
  const r = [], [ra, rb] = [groups[0].rooms[1].id, groups[1].rooms[2].id];
  await S.page.evaluate(() => PC.debug.scene().renderNow()); const g0 = (await S.page.evaluate(STATE)).geoms;
  await chooseIn(S, ra); await S.page.waitForTimeout(500); const mid = await chooseIn(S, rb);
  if (!mid.before || F.poseDist(mid.before, mid.after) > 0.2) r.push(`redirect: pose jumped by ${mid.before && F.poseDist(mid.before, mid.after).toFixed(2)} m at the second pick`);
  await landed(S); rec = await recStop(S); st = await S.page.evaluate(STATE);
  r.push(...flightMore(rec, 'after the redirect', { full: false }));
  d = F.poseDiff(st.pose, expectPose(h, L, rb, mid.before)); if (d) r.push(`redirect lands at ${d}`); r.push(...selectedProblems(st, h, rb, 'redirect'));
  await S.page.evaluate(() => PC.debug.scene().renderNow()); const g1 = (await S.page.evaluate(STATE)).geoms; if (g1 !== g0) r.push(`renderer geometries ${g0} -> ${g1} over 2 re-selections`);
  R.check(`${T}: a second pick 0.5 s into a flight redirects from the interpolated pose (no jump, theta of that moment kept) and lands on the second room; 2 re-selections keep the renderer's geometry count`, cut(r));
  lap('redirect');
  // 4. cancel: wheel, mouse down, key (flights not landed)
  const cc = [], box = await S.page.evaluate(() => { const r = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await chooseIn(S, groups[0].rooms[4].id); await S.page.waitForTimeout(250);
  const w = await S.page.evaluate(() => { const cv = document.querySelector('[data-pc="v3-canvas"]'), a = PC.view3d.pose(), r = cv.getBoundingClientRect(); cv.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true })); return { a, b: PC.view3d.pose(), flying: PC.view3d.flying() }; });
  const k = Math.exp(100 * PC.C.CAM.wheelK);
  if (w.flying) cc.push('wheel: still flying');
  if (Math.abs(w.b.radius - w.a.radius * k) > 1e-6 * w.a.radius || w.b.target.some((x, i) => Math.abs(x - w.a.target[i]) > 1e-9)) cc.push(`wheel: radius ${w.a.radius.toFixed(3)} -> ${w.b.radius.toFixed(3)} (x ${k.toFixed(4)} = ${(w.a.radius * k).toFixed(3)} expected), target moved ${!w.b.target.every((x, i) => Math.abs(x - w.a.target[i]) < 1e-9)}: the delta did not act on the interpolated pose`);
  await S.page.waitForTimeout(150); if (F.poseDist(await S.page.evaluate(() => PC.view3d.pose()), w.b) > 1e-9) cc.push('wheel: the pose kept moving after the cancel');
  let s2 = await S.page.evaluate(STATE); if (s2.caption === null) cc.push('wheel cleared the selection (zoom keeps it)');
  for (const [name, act, id] of (FULL ? [['mouse down', async () => { await S.page.mouse.move(...box); await S.page.mouse.down(); }, groups[0].rooms[5].id], ['ArrowLeft on the canvas', async () => { await S.page.focus('[data-pc="v3-canvas"]'); await S.page.keyboard.press('ArrowLeft'); }, groups[1].rooms[3].id]] : [])) {
    await chooseIn(S, id); await S.page.waitForTimeout(250); await act(); const a = await S.page.evaluate(() => ({ p: PC.view3d.pose(), f: PC.view3d.flying() }));
    await S.page.waitForTimeout(150); const b = await S.page.evaluate(() => PC.view3d.pose()); if (name === 'mouse down') await S.page.mouse.up();
    if (a.f) cc.push(`${name}: still flying`); if (F.poseDist(a.p, b) > 1e-9) cc.push(`${name}: the pose kept moving`); }
  // Tab on the focused canvas does not cancel; a hidden tab mid-flight stops the frames and resumes with one capped step
  await chooseIn(S, groups[1].rooms[1].id); await S.page.waitForTimeout(250); await S.page.focus('[data-pc="v3-canvas"]'); await S.page.keyboard.press('Tab');
  if (!(await S.page.evaluate(() => PC.view3d.flying()))) cc.push('Tab on the focused canvas cancelled the flight');
  const hid = await S.page.evaluate(async () => { const t0 = PC.debug.scene().flight && PC.debug.scene().flight.t, set = (v) => { Object.defineProperty(document, 'visibilityState', { value: v, configurable: true }); Object.defineProperty(document, 'hidden', { value: v === 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); };
    set('hidden'); const tHide = PC.debug.scene().flight && PC.debug.scene().flight.t, r0 = window.__rec.length; await new Promise((r) => setTimeout(r, 350)); const during = window.__rec.slice(r0).filter((e) => e[3] !== null && e[3] !== tHide).length;
    const tBack = PC.debug.scene().flight && PC.debug.scene().flight.t; const r1 = window.__rec.length; set('visible'); await new Promise((r) => setTimeout(r, 250)); delete document.visibilityState; delete document.hidden;
    const after = window.__rec.slice(r1).filter((e) => e[3] !== null); return { t0, tHide, tBack, during, first: after.length ? after[0][3] : null, flying: PC.view3d.flying(), dt: PC.C.CAM.dtMax }; });
  if (hid.during || hid.tBack !== hid.tHide) cc.push(`hidden tab: the flight advanced while hidden (${hid.tHide} -> ${hid.tBack}, ${hid.during} frames)`);
  else if (hid.first === null) { if (!hid.flying && !(await S.page.evaluate(() => PC.view3d.flying()))) {} else cc.push('hidden tab: no frame after the tab came back'); }
  else if (Math.abs(hid.first - hid.tBack - hid.dt) > 1e-6) cc.push(`hidden tab: the first step after return is ${(hid.first - hid.tBack).toFixed(1)} ms (one ${hid.dt} ms capped step expected)`);
  await recStop(S);
  // pan (right drag) keeps the selection
  await S.page.mouse.move(...box); await S.page.mouse.down({ button: 'right' }); await S.page.mouse.move(box[0] + 40, box[1] + 30, { steps: 4 }); await S.page.mouse.up({ button: 'right' }); await S.settle(); s2 = await S.page.evaluate(STATE);
  if (s2.caption === null || s2.value === '') cc.push('a pan drag cleared the selection');
  await recStop(S);
  await S.page.mouse.move(...box); await S.page.mouse.down(); await S.page.mouse.move(box[0] + 80, box[1], { steps: 4 }); await S.page.mouse.up(); await S.settle(); s2 = await S.page.evaluate(STATE);
  if (s2.caption === null || s2.value === '') cc.push('an orbit drag cleared the selection');
  R.check(`${T}: wheel${FULL ? ', mouse down and an arrow key' : ''} mid-flight cancel${FULL ? '' : 's'} at once (wheel: interpolated radius x ${k.toFixed(4)}, target kept, no snap); the pose then stays; Tab does not cancel; a hidden tab mid-flight resumes with one ${PC.C.CAM.dtMax || 100} ms step; zoom, pan and orbit keep the selection`, cc);
  lap('cancel');
  // 5. clearing (each from a fresh pick, flight still running)
  const cl = [], someRoom = groups[0].rooms[2].id;
  await viewTab(S);
  // TL F6-T2 gate ruling (dollhouse-heavy duplicates): the default run keeps "All" and "Go to room…" (the disposal check);
  // another level, Reset view, the rebuild and the context restore clear the same highlight and run in the release step
  const CLEAR_REL = ['another level', 'Reset view', 'a rebuild (Q18 while open)', 'a context restore'];
  for (const [name, act] of [['"All"', () => S.act(pick('all'))], ['another level', () => S.act(pick(groups[1].level))], ['Reset view', () => S.act('v3-reset')],
    ['"Go to room…"', () => S.page.selectOption('[data-pc="v3-room"]', '')], ['a rebuild (Q18 while open)', async () => { const b0 = (await S.page.evaluate(STATE)).builds; await S.page.evaluate(() => PC.store.commit((s) => { s.ans.interior.style = s.ans.interior.style === 'modern' ? 'classic' : 'modern'; })); await S.until(() => S.page.evaluate((b) => PC.debug.scene().builds > b, b0), 5000); await ready(S); if ((await S.page.evaluate(STATE)).builds <= b0) cl.push('Q18: no rebuild'); }],
    ['a context restore', async () => { const b0 = (await S.page.evaluate(STATE)).builds; await S.page.evaluate(() => { const gl = PC.debug.scene().renderer.getContext(); window.__lc = gl.getExtension('WEBGL_lose_context'); window.__lc.loseContext(); }); await S.until(() => S.page.evaluate(() => PC.debug.scene().lost), 3000); await S.page.evaluate(() => window.__lc.restoreContext()); await S.until(() => S.page.evaluate((b) => PC.debug.scene().builds > b, b0), 5000); await ready(S); }]]) {
    if (!REL && CLEAR_REL.includes(name)) continue;
    // F6-T2 TL gate ruling: furniture / textured-* are hidden in exterior mode, so they reach the GPU on the first dollhouse
    // frame; the no-selection baseline is taken right before this pick (the same room was picked in the rows above)
    let geomsBase = geomsNone; if (name === '"Go to room…"') { await S.page.evaluate(() => PC.debug.scene().renderNow()); geomsBase = (await S.page.evaluate(STATE)).geoms; }
    await chooseIn(S, someRoom); await S.settle(); const a = await S.page.evaluate(STATE); if (a.caption === null) { cl.push(`${name}: setup pick not shown`); continue; }
    await act(); await S.settle(); const b = await S.page.evaluate(STATE); cl.push(...clearedProblems(b, name));
    if (name === '"Go to room…"') { await S.page.evaluate(() => PC.debug.scene().renderNow()); const gg = (await S.page.evaluate(STATE)).geoms; if (gg !== geomsBase) cl.push(`"Go to room…": renderer geometries ${gg}, ${geomsBase} with no selection before the pick (the cleared highlight not disposed)`); }
    if (/Reset|rebuild|restore/.test(name) && b.flying) cl.push(`${name}: still flying`);
    lap(name); }
  await recStop(S);
  lap('clearing');
  // leaving stage 5 mid-flight
  await chooseIn(S, someRoom); await S.page.waitForTimeout(300); await S.page.evaluate(() => PC.store.go(4)); await S.settle(); const p4 = await S.page.evaluate(() => PC.view3d.pose());
  await S.page.evaluate(() => PC.store.go(5)); await ready(S); await S.page.waitForTimeout(300); const p5 = await S.page.evaluate(() => ({ p: PC.view3d.pose(), f: PC.view3d.flying() })); await recStop(S);
  if (p5.f || F.poseDist(p4, p5.p) > 1e-6) cl.push(`leaving stage 5 mid-flight: flying ${p5.f} on return, pose moved ${F.poseDist(p4, p5.p).toFixed(3)} m`);
  if (!REL) R.note('A clearing: another level, Reset view, the Q18 rebuild and the context restore run in the release step (TL F6-T2 gate ruling)');
  R.check(`${T}: ${REL ? '' : '(default: "All" and "Go to room…" only) '}"All", another level, Reset view, "Go to room…" (Roof on: check 2), a Q18 rebuild and a context restore each clear the highlight (disposed: geometry count back to the no-selection count), the caption and the select (Reset / rebuild / restore also stop the flight); leaving stage 5 mid-flight stops the flight for good`, cut(cl));
  lap('leave');
  // 6. the maximum house in the same page: 40 rooms, a basement pick (landed), a second-floor pick, mesh budget
  if (REL) {
  const T2 = 'A 1280x800 maximum house', m = [];
  await to5(S, MAXMUT); await tourTab(S);
  const hm = await S.page.evaluate(HOUSE), Lm = await S.page.evaluate(LIMITS), gm = F.myGroups(hm), sm = await S.page.evaluate(SELECT), m0 = (await S.page.evaluate(STATE)).meshes;
  if (sm.groups.length !== 4 || sm.groups.reduce((s, g) => s + g.rooms.length, 0) !== 40 || !eq(sm.groups, gm.map((g) => ({ label: g.label, rooms: g.rooms })))) m.push(`select: ${sm.groups.length} groups, ${sm.groups.reduce((s, g) => s + g.rooms.length, 0)} rooms`);
  const bm = gm[0].rooms[7]; c = await chooseIn(S, bm.id); await landed(S); rec = await recStop(S); st = await S.page.evaluate(STATE);
  m.push(...selectedProblems(st, hm, bm.id, bm.name), ...flightMore(rec, bm.name)); d = F.poseDiff(st.pose, expectPose(hm, Lm, bm.id, c.before)); if (d) m.push(`${bm.name}: lands at ${d}`);
  if (Math.abs(st.pose.phi - 15 * F.D2R) > 1e-6) m.push(`${bm.name}: basement phi ${(st.pose.phi / F.D2R).toFixed(2)} deg`);
  if (!F.pitCrossing(hm, st.pose).ok) m.push(`${bm.name}: the eye line meets ground level outside the footprint`);
  const T2M = PC.data.furnitureParts ? 13 : 0;   // F6-T2 plan §5: + textured / glow / lamps on 4 levels + glazing (40, CTO <= 40; + the highlight)
  if (st.meshes !== m0 + 1 || st.meshes > 40 + (T2M ? 1 : 0)) m.push(`${bm.name}: ${st.meshes} meshes (${m0} + 1 highlight, <= ${40 + (T2M ? 1 : 0)})`);
  const TLN = T2M + (PC.C.ROOF && PC.C.ROOF.copingT !== undefined ? 28 : PC.C.CONTACT ? 27 : (PC.texgen || (PC.C.VIEW3D && PC.C.VIEW3D.tiers)) ? 25 : 22);   // F6-T1a: 24 + the highlight (impl-notes §6); T1b: + groundRing + blobs; T1c: + roofDeck (FS: 27 + highlight)
  if (st.meshes !== TLN) m.push(`${bm.name}: ${st.meshes} meshes with a room selected (${TLN} by the TL count)`);
  const above = await S.page.evaluate(() => { const w = PC.debug.scene().world, o = []; w.traverse((n) => { if (/^level-?(G|1|2)$/i.test(n.name) || (n.userData && ['G', '1', '2'].includes(n.userData.level) && n.parent === w)) { let v = true; for (let q = n; q; q = q.parent) if (!q.visible) v = false; if (v) o.push(n.name || n.userData.level); } }); return o; });
  if (above.length) m.push(`${bm.name}: levels above still visible ${above}`);
  const on2 = await shot(); await S.page.evaluate(() => { PC.debug.scene().world.getObjectByName('highlight').visible = false; PC.debug.scene().renderNow(); }); await S.settle(); const off2 = await shot();
  await S.page.evaluate(() => { PC.debug.scene().world.getObjectByName('highlight').visible = true; PC.debug.scene().renderNow(); }); await S.settle();
  const nd2 = await S.page.evaluate(PXDIFF, [on2, off2]); if (nd2 < 30) { const hit = await S.page.evaluate(() => { const i = PC.debug.scene(), T = THREE, cam = i.camera, hl = i.world.getObjectByName('highlight'); cam.updateMatrixWorld(); hl.geometry.computeBoundingBox(); const c = new T.Vector3(); hl.geometry.boundingBox.getCenter(c); hl.localToWorld(c);
    const rc = new T.Raycaster(cam.position.clone(), c.clone().sub(cam.position).normalize()), h = rc.intersectObjects(i.world.children, true).find((x) => { for (let q = x.object; q; q = q.parent) if (!q.visible) return false; return true; });
    const path = (o) => { const n = []; for (let q = o; q && q !== i.world; q = q.parent) n.unshift(q.name || q.type); return n.join('/'); }; return h ? `${path(h.object)} at Y ${h.point.y.toFixed(2)}` : 'nothing'; });
    m.push(`${bm.name}: the basement highlight changes only ${nd2} px (first visible object on the eye -> highlight line: ${hit})`); }
  await S.shot('A-basement');
  lap('maxbase');
  const tm = gm[3].rooms[9]; await chooseIn(S, tm.id); await S.settle(); st = await S.page.evaluate(STATE); await recStop(S);
  m.push(...selectedProblems(st, hm, tm.id, tm.name)); if (st.cap !== true) m.push(`${tm.name}: groundCap ${st.cap} after leaving the basement`); if (st.meshes !== m0 + 1) m.push(`${tm.name}: ${st.meshes} meshes`);
  // B-1 class (round 2): groundOuter (painted magenta for the check) never shows inside the footprint's screen polygon,
  // for every level choice x Roof off / on x Reset and a low side pose
  const leak = [];
  for (const [lv, roof, side] of [['B', false, false], ['B', false, true], ['all', false, false], ['all', false, true], ['all', true, false], ['all', true, true], ['G', false, true], ['2', true, true]]) {
    const r = await S.page.evaluate(async ([lv, roof, side]) => { const V = PC.view3d, i = PC.debug.scene(), T = THREE, h = i.house, cam = i.camera, asp = i.size[0] / i.size[1];
      V.setLevel(lv); V.setRoof(roof); V.resetView(); if (side) { const p = PC.cam.reset(h, asp); p.theta = 2.2; p.phi = 1.3; p.radius *= 0.8; V.flyTo(PC.cam.clamp(p, PC.cam.limits(h, asp)), 1); } await new Promise((r) => setTimeout(r, side ? 250 : 120));
      const outer = i.world.getObjectByName('groundOuter'), old = outer.material; outer.material = new T.MeshBasicMaterial({ color: 0xff00ff, fog: false, toneMapped: false }); i.renderNow();
      const gl = i.renderer.getContext(), w = gl.drawingBufferWidth, hh = gl.drawingBufferHeight, px = new Uint8Array(w * hh * 4); gl.readPixels(0, 0, w, hh, gl.RGBA, gl.UNSIGNED_BYTE, px); outer.material.dispose(); outer.material = old; i.renderNow();
      const fp = h.footprint, X = (u) => u - h.center[0], Z = (v) => -(v - h.center[1]); cam.updateMatrixWorld();
      const poly = [[fp.u, fp.v], [fp.u + fp.w, fp.v], [fp.u + fp.w, fp.v + fp.d], [fp.u, fp.v + fp.d]].map(([u, v]) => { const q = new T.Vector3(X(u), 0, Z(v)).project(cam); return [(q.x + 1) / 2 * w, (q.y + 1) / 2 * hh]; });
      const inside = (x, y) => { let c = false; for (let a = 0, b = 3; a < 4; b = a++) { const [xa, ya] = poly[a], [xb, yb] = poly[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c; } return c; };
      let mag = 0, magIn = 0; for (let y = 0; y < hh; y += 2) for (let x = 0; x < w; x += 2) { const k = (y * w + x) * 4; if (px[k] > 200 && px[k + 1] < 60 && px[k + 2] > 200) { mag++; if (inside(x, y)) magIn++; } }
      return { mag, magIn }; }, [lv, roof, side]);
    if (r.magIn > 0 || r.mag === 0) leak.push(`level ${lv}, Roof ${roof ? 'on' : 'off'}, ${side ? 'low side' : 'Reset'}: ${r.magIn} groundOuter px inside the footprint (${r.mag} in all)`); }
  m.push(...cut(leak, 4));
  R.check(`${T2}: 40 options in 4 groups; a basement pick opens the ground (level B, groundCap hidden) at phi 15 degrees with the levels above hidden, the eye line into the pit, the highlight in the real r128 frame, and lands on my pose; a second-floor pick follows the rules; meshes ${m0} + 1 = 22 <= 40; groundOuter never inside the footprint (B, All, G, 2 with Roof off / on, Reset and a low side pose: 8 views, B-1 class)`, cut(m));
  }
  await S.end(T);
});

// ================= C. phone: the caption at 360 px (focus 7), "Master bedroom · Basement" =================
await guard('C 360x640', async () => {
  const S = await session(browser, VP.phone, { three: 'real', init: [REC] }), T = 'C 360x640 real', f = [];
  await to5(S, "s.ans.basement = true; const m = s.ans.rooms.find((r) => r.master); m.level = 'B'; s.ans.pairs = s.ans.pairs.filter((p) => !p.includes(m.id));"); await tourTab(S); const h = await S.page.evaluate(HOUSE), sel = await S.page.evaluate(SELECT);
  if (sel.h < 44 - 0.5) f.push(`select ${sel.h} px high`);
  const master = h.levels.flatMap((l) => l.rooms.map((r) => [r, l])).find(([r]) => r.name === 'Master bedroom');
  if (!master || master[1].id !== 'B') f.push(`fixture: Master bedroom on ${master && master[1].id}`);
  else {
    await S.page.selectOption('[data-pc="v3-room"]', master[0].id); await S.settle(); await recStop(S);
    const st = await S.page.evaluate(STATE); f.push(...selectedProblems(st, h, master[0].id, 'Master bedroom'));
    const lay = await S.page.evaluate(() => { const q = (h) => document.querySelector(`[data-pc="${h}"]`), c = q('v3-caption').getBoundingClientRect(), room = q('v3-caption').querySelector('.pc-caption__room'), lev = q('v3-caption').querySelector('.pc-caption__level'), tg = q('v3-panel-toggle'), t = tg && !tg.closest('[hidden]') ? tg.getBoundingClientRect() : null;
      return { l: c.left, r: c.right, t: c.top, b: c.bottom, w: innerWidth, sx: document.scrollingElement.scrollWidth, cw: document.documentElement.clientWidth, room: room ? [room.textContent, room.scrollWidth, room.clientWidth, room.getBoundingClientRect().width] : null,
        lev: lev ? [lev.textContent, lev.scrollWidth, lev.clientWidth, getComputedStyle(lev).textOverflow] : null, tog: t && t.width ? [t.left, t.right, t.top, t.bottom] : null }; });
    if (lay.l < -0.5 || lay.r > lay.w + 0.5 || lay.sx > lay.cw) f.push(`caption ${lay.l.toFixed(0)}..${lay.r.toFixed(0)} in a ${lay.w} px viewport, page scroll width ${lay.sx}`);
    if (!lay.room || lay.room[0] !== 'Master bedroom' || lay.room[1] > lay.room[2] + 1) f.push(`room part ${JSON.stringify(lay.room)} (whole "Master bedroom" expected)`);
    if (!lay.lev || lay.lev[0].trim() !== '· Basement' || lay.lev[3] !== 'ellipsis') f.push(`level part ${JSON.stringify(lay.lev)} (" · Basement", text-overflow ellipsis)`);
    else R.note(`C level part ${lay.lev[1] > lay.lev[2] + 1 ? `ellipsised (${lay.lev[1]} of ${lay.lev[2]} px)` : `fits whole (${lay.lev[1]} px)`} at 360 px`);
    if (lay.tog && !(lay.tog[1] <= lay.l || lay.tog[0] >= lay.r || lay.tog[3] <= lay.t || lay.tog[2] >= lay.b)) f.push(`caption ${[lay.l, lay.r, lay.t, lay.b].map(Math.round)} under the panel toggle ${lay.tog.map(Math.round)}`);
  }
  await S.layout(`${T} Tour tab with a basement room`); await S.shot('C-master-basement');
  R.check(`${T}: select ${sel.h.toFixed(0)} px; a pick through the native picker gives "Master bedroom · Basement" inside the viewport (no page scroll, not under the panel toggle): the room part whole, the level part with text-overflow ellipsis; the rules of A`, cut(f));
  await S.end(T);
});

await browser.close();
for (const o of OBS) R.note(o);
if (process.env.QA_LAPS) R.note(`laps: ${LAP.join(', ')}`);
if (!FULL) R.note('the mouse-down / arrow-key cancels and the per-frame flight judgement after the first pick run with QA_FULL=1 only (TL Q-T8)');
R.note(`sections: ${TIMES.join(', ')}; run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (!REL) R.note('A step 6 (the maximum house) runs in the release step only (QA_RELEASE=1; TL run-time ruling F6-T1c)');
process.exit(R.done() ? 0 : 1);
