// F5-T2 QA (browser, vendored real r128): the drone tour in the built page, judged by QA's own oracle (f5-t2-ref.mjs).
// Version-aware: needs PC.three.tour + PC.tourplan (plan §6); without them the suite only notes the skip (no browser).
// Run-time budget (orchestrator, batch 13): <= 25 s with f5-t2-model; later stops are reached with the debug-only
// PC.debug.tourSeek(τ) (ruling 8), never by waiting for real tour time.
//   A 1280x800 sample at 22:00 winter, a finder room selected and the Roof on before Start:
//     controls: Start enabled >= 44 px, Pause / Stop disabled before, speed radios live.
//     Start: finder selection cleared, Roof off (UI + scene), Start disabled, Pause / Stop enabled, caption pause / stop
//     shown; every recorded frame: eye >= the eye floor, on my centripetal Catmull-Rom curve at the tour's τ (getPoint,
//     time-linear legs) through my clamp, no jump.
//     Per leg (seek): caption / level / highlight of the stop approached (Overview, All, none on the last leg); the
//     programmatic level switch G -> 1 keeps the tour running (required item 4).
//     Pause by tap (aria-pressed, "Resume tour", caption pause mirrors, pose frozen, no frames); Resume by keyboard
//     (no jump); Fast mid-tour (τ rate 1.8, no jump); a Light preset mid-tour (tour runs on, the tour never calls setLook,
//     lights = the preset's); the look before Start untouched.
//     Ends (each: buttons back to Start, caption and highlight cleared, select "Go to room…", pose / level / Roof kept):
//     a canvas gesture, a gesture while paused, Stop, a level radio (level applied), Reset view, a finder pick (its
//     flight runs), leaving stage 5 (no restart on return). Speed kept for the next tour.
//   B 1280x800 maximum house (40 rooms): meshes <= 22 at stops on B / G / 2; one highlight geometry alive; a basement
//     stop on real r128: the room is the first visible hit from the eye and the highlight is drawn (required item 5).
//   C 360x640 touch, fresh context: G1 path Load sample -> Skip to 3D -> Tour tab -> Start = 4 taps; caption pause /
//     stop >= 44 px and inside the viewport; caption pause pauses (panel button mirrors), caption stop ends; a reload
//     gives Normal speed (round 13: not in the draft); no console errors.
// Run: node tests/qa/f5-t2-view.mjs [--no-shots] [--only=A,B,C]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, collector, launch } from './lib.mjs';
import { sessions } from './session.mjs';
import * as H from './f4-t1-ref.mjs';
import * as T from './f5-t2-ref.mjs';

const R = collector('F5-T2 view');
const noShots = process.argv.includes('--no-shots'), shots = join(ROOT, 'tests/qa/shots/F5-T2');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const { PC } = H.loadPC3();
const HAS = !!(PC.three && PC.three.tour && PC.tourplan && PC.tourplan.build);
if (!HAS) { R.note('skipped: PC.three.tour / PC.tourplan absent (F5-T2 not merged)'); process.exit(R.done() ? 0 : 1); }
if (!noShots) mkdirSync(shots, { recursive: true });
const session = sessions({ R, shots, noShots });
const VP = { phone: { tag: '360x640', w: 360, h: 640, touch: true }, desk: { tag: '1280x800', w: 1280, h: 800, touch: false } };
const t0 = Date.now(), TIMES = [], OBS = [];
const cut = (a, n = 8) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);
const EYE_FLOOR = T.eyeFloorOf(PC.data.vegetation);
// rAF counter + per-frame recorder: [ts, pose, τ]; setLook call counter
const REC = () => { const raf = window.requestAnimationFrame.bind(window); window.__raf = 0; window.__rec = []; window.__recOn = false;
  window.__tau = () => { const t = window.PC && PC.three && PC.three.tour; const s = t && t.state ? t.state() : null; if (s) for (const k of ['tau', 't', 'time', 'elapsed', 'τ']) if (typeof s[k] === 'number') return s[k]; return null; };
  window.requestAnimationFrame = (cb) => { window.__raf++; return raf((ts) => { cb(ts); if (window.__recOn && window.PC && PC.view3d && PC.view3d.pose) window.__rec.push([ts, PC.view3d.pose(), window.__tau()]); }); }; };
const READY = () => { const i = PC.debug.scene(), q = (h) => document.querySelector(`[data-pc="${h}"]`); return (i.active && !i.building && i.builds > 0 && q('v3-building').hidden && !i.frame && !i.dirty) || !q('v3-unavailable').hidden; };
async function ready(S, ms = 8000) { const ok = await S.until(() => S.page.evaluate(READY), ms); await S.settle(); return ok; }
async function to5(S, mut = '') {
  await S.page.evaluate((m) => { const st = PC.sample.state(); new Function('s', m)(st); st.plans = {}; st.stage = 1; PC.store.replace(st); PC.store.go(2); PC.store.go(3);
    PC.store.commit((s) => { for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; }, { nav: true }); PC.store.go(4); PC.store.go(5); }, mut);
  return ready(S);
}
async function guard(label, fn) { if (ONLY.length && !ONLY.includes(label[0])) return; const t = Date.now(); try { await fn(); } catch (e) { R.check(`${label}: ran to the end`, [String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')]); } TIMES.push(`${label} ${((Date.now() - t) / 1000).toFixed(1)} s`); }
const pick = (v) => `css:[data-pc="v3-level"] label:has(input[value="${v}"])`;
const speedHook = (v) => `css:[data-pc="v3-tour-speed"] label:has(input[value="${v}"])`;
const frame2 = (S) => S.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// ---------- page reads ----------
const HOUSE = () => { const h = PC.debug.scene().house; return { levels: h.levels.map((l) => ({ id: l.id, baseY: l.baseY, rooms: l.rooms.map((r) => ({ id: r.id, name: r.name, u: r.u, v: r.v, w: r.w, d: r.d })) })), footprint: h.footprint, center: h.center, radius: h.radius, storeyH: h.storeyH, roof: { baseY: h.roof.baseY } }; };
const CTX = () => { const i = PC.debug.scene(), a = i.size[0] / i.size[1]; return { reset: PC.cam.reset(i.house, a), limits: PC.cam.limits(i.house, a), aspect: a }; };
const STATE = () => { const i = PC.debug.scene(), q = (h) => document.querySelector(`[data-pc="${h}"]`), w = i.world, hl = w.getObjectByName('highlight'), chk = q('v3-level').querySelector('input:checked');
  let meshes = 0; w.traverse((o) => { if (o.isMesh) meshes++; }); let hv = !!hl; for (let n = hl; n; n = n.parent) if (!n.visible) hv = false;
  const sp = q('v3-tour-speed').querySelector('input:checked');
  return { roof: i.roof, roofUi: q('v3-roof').checked, level: i.level, levelUi: chk ? chk.value : null, cap: (w.getObjectByName('groundCap') || {}).visible,
    caption: q('v3-caption').hidden ? null : q('v3-caption-text').textContent.trim().replace(/\s+/g, ' '), capBtns: ['v3-caption-pause', 'v3-caption-stop'].filter((k) => !q(k).hidden && !q(k).closest('[hidden]')),
    start: !q('v3-tour-start').disabled, pause: !q('v3-tour-pause').disabled, stop: !q('v3-tour-stop').disabled, pressed: q('v3-tour-pause').getAttribute('aria-pressed'), label: q('v3-tour-pause').getAttribute('aria-label'),
    capPressed: q('v3-caption-pause').getAttribute('aria-pressed'), speed: sp ? sp.value : null, value: q('v3-room').value, flying: PC.view3d.flying ? PC.view3d.flying() : null,
    pose: PC.view3d.pose(), tau: window.__tau ? window.__tau() : null, meshes, geoms: i.renderer.info.memory.geometries, hl: hv ? hl.userData.room || true : null, builds: i.builds }; };
const LIGHTS = () => { const i = PC.debug.scene(), o = []; i.scene.traverse((l) => { if (l.isLight) o.push([l.type, l.color.getHexString(), l.intensity.toFixed(6), l.position.toArray().map((x) => +x.toFixed(6))]); }); const b = i.scene.background; return JSON.stringify({ o, bg: b && b.getHexString ? b.getHexString() : null, look: PC.view3d.look() }); };
const running = (st) => !st.start && st.stop;
const endedProblems = (st, tag) => { const f = []; if (!st.start || st.stop || st.pause || st.pressed === 'true') f.push(`${tag}: buttons start ${st.start} / pause ${st.pause} (${st.pressed}) / stop ${st.stop}, Start expected`);
  if (st.caption !== null) f.push(`${tag}: caption "${st.caption}" left`); if (st.hl) f.push(`${tag}: highlight left on ${st.hl}`); if (st.value !== '') f.push(`${tag}: select "${st.value}"`); return f; };
// my expected pose at tour time tau (in the page, with r128's CatmullRomCurve3 'centripetal', getPoint, time-linear legs)
const MYPOSE = ([stops, tau, floor, L]) => { const T3 = THREE, n = stops.length, V = (p) => new T3.Vector3(p[0], p[1], p[2]);
  const ce = new T3.CatmullRomCurve3(stops.map((s) => V(s.eye)), false, 'centripetal'), cl = new T3.CatmullRomCurve3(stops.map((s) => V(s.look)), false, 'centripetal');
  let i = 0; while (i < n - 2 && tau >= stops[i + 1].t) i++; const u = Math.min(1, Math.max(0, (i + (tau - stops[i].t) / (stops[i + 1].t - stops[i].t)) / (n - 1)));
  const e = ce.getPoint(u), l = cl.getPoint(u); e.y = Math.max(e.y, floor);
  const dx = e.x - l.x, dy = e.y - l.y, dz = e.z - l.z, r = Math.hypot(dx, dy, dz);
  return PC.cam.clamp({ target: [l.x, l.y, l.z], radius: r, phi: Math.acos(dy / r), theta: Math.atan2(dx, dz) }, L); };
const legOf = (stops, tau) => { let i = 0; while (i < stops.length - 2 && tau >= stops[i + 1].t) i++; return i; };
function frameProblems(rec, stops, tag, { curve = null } = {}) {
  const f = [], fr = [...new Map(rec.map((r) => [r[0], r])).values()].sort((a, b) => a[0] - b[0]);
  for (const [, p] of fr) if (T.eyeOf(p)[1] < EYE_FLOOR - 1e-6) { f.push(`${tag}: eye at ${T.eyeOf(p)[1].toFixed(2)} m, under the floor ${EYE_FLOOR.toFixed(2)}`); break; }
  for (let k = 1; k < fr.length; k++) { const a = fr[k - 1], b = fr[k], dt = Math.min(100, b[0] - a[0]) / 1000, i = legOf(stops, b[2] == null ? 0 : b[2]);
    const legV = T.dist(stops[i].eye, stops[i + 1].eye) / (stops[i + 1].t - stops[i].t) + T.dist(stops[i].look, stops[i + 1].look) / (stops[i + 1].t - stops[i].t), st = T.dist(T.eyeOf(a[1]), T.eyeOf(b[1]));
    if (st > 3 * 1.8 * legV * Math.max(dt, 1 / 60) + 0.05) { f.push(`${tag}: a ${st.toFixed(2)} m eye step in ${(dt * 1000).toFixed(0)} ms (leg ${i}, chord speed ${legV.toFixed(2)} m/s): jump`); break; } }
  if (curve) for (const [, p, tau, want] of curve) { if (!want) continue; const d = T.dist(T.eyeOf(p), T.eyeOf(want)) + T.dist(p.target, want.target); if (d > 1e-3) { f.push(`${tag}: at τ ${tau.toFixed(3)} the pose is ${d.toFixed(3)} m off my curve`); break; } }
  return { f, frames: fr.length };
}
async function startTour(S) { await S.act('v3-tour-start'); await S.settle(); }
async function seek(S, tau) { await S.page.evaluate((t) => PC.debug.tourSeek(t), tau); await frame2(S); await S.settle(); }

const browser = await launch();

// ================= A. desk: sample =================
await guard('A 1280x800', async () => {
  const S = await session(browser, VP.desk, { three: 'real', init: [REC] }), T0 = 'A 1280x800 real';
  await to5(S); await S.page.evaluate(() => PC.view3d.setLook({ hour: 22, season: 'winter' })); await ready(S);
  const h = await S.page.evaluate(HOUSE), C = await S.page.evaluate(CTX), mine = T.myTour(h, C.reset, EYE_FLOOR), stops = mine.stops;
  const plan = await S.page.evaluate((a) => PC.tourplan.build(PC.debug.scene().house, a), C.aspect);
  if (plan.stops.map((s) => s.id || 'O').join() !== stops.map((s) => s.id || 'O').join()) { const alt = T.myTour(h, C.reset, EYE_FLOOR, { metric: '3d' }); if (plan.stops.map((s) => s.id || 'O').join() === alt.stops.map((s) => s.id || 'O').join()) stops.splice(0, stops.length, ...alt.stops); }
  // controls before
  const c0 = await S.page.evaluate(() => { const q = (h) => document.querySelector(`[data-pc="${h}"]`); return { h: q('v3-tour-start').getBoundingClientRect().height, sp: [...q('v3-tour-speed').querySelectorAll('input')].filter((i) => i.disabled).length }; });
  let st = await S.page.evaluate(STATE), f = [];
  if (!st.start || st.pause || st.stop || c0.h < 43.5 || c0.sp) f.push(`before: start ${st.start} (${c0.h} px), pause ${st.pause}, stop ${st.stop}, ${c0.sp} speed radios disabled`);
  if (st.speed !== 'normal') f.push(`speed ${st.speed} at first (Normal)`);
  R.check(`${T0}: before a tour Start is enabled (>= 44 px), Pause / Stop disabled, speed radios live on Normal`, f);
  // a finder room selected and the Roof on (API), then Start
  await S.page.evaluate(() => { const s = document.querySelector('[data-pc="v3-room"]'); s.value = s.querySelector('optgroup option').value; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await S.until(() => S.page.evaluate(() => !PC.view3d.flying()), 5000); await S.page.evaluate(() => PC.view3d.setRoof(true)); await S.settle();
  await S.page.evaluate(() => { const v = PC.view3d, o = v.setLook; window.__looks = 0; v.setLook = function () { window.__looks++; return o.apply(this, arguments); }; });
  const L0 = await S.page.evaluate(LIGHTS);
  await S.page.evaluate(() => { window.__rec = []; window.__recOn = true; }); await startTour(S); await S.page.waitForTimeout(1200);
  let rec = await S.page.evaluate(() => window.__rec.slice()); st = await S.page.evaluate(STATE); f = [];
  if (!running(st) || !st.pause) f.push(`after Start: start ${st.start}, pause ${st.pause}, stop ${st.stop}`);
  if (st.roof || st.roofUi) f.push(`Roof ${st.roof} / switch ${st.roofUi} after Start`);
  if (st.capBtns.length !== 2) f.push(`caption buttons shown: ${st.capBtns}`);
  if ((await S.page.evaluate(LIGHTS)) !== L0) f.push('lights / background / look changed by Start (22:00 winter kept expected)');
  if (st.value !== '') f.push(`finder select "${st.value}" after Start (cleared expected)`);
  if (st.tau === null) OBS.push('τ not readable from PC.three.tour.state() (keys tau / t / time / elapsed): the curve match is skipped');
  const curve = []; if (st.tau !== null) for (const [ts, p, tau] of rec.filter((r) => r[2] != null).slice(-12)) curve.push([ts, p, tau, await S.page.evaluate(MYPOSE, [stops, tau, EYE_FLOOR, C.limits])]);
  const fp = frameProblems(rec, stops, 'first 1.2 s', { curve: curve.length ? curve : null }); f.push(...fp.f);
  const leg0 = legOf(stops, st.tau || 0.5), want0 = T.stopCaption(h, stops[leg0 + 1]); if (st.caption !== want0) f.push(`caption "${st.caption}" on leg 0 (approaching "${want0}")`);
  await S.shot('A-start');
  R.check(`${T0}: Start clears the finder selection, turns the Roof off (scene + switch), disables Start, enables Pause / Stop, shows the caption's pause / stop, leaves the 22:00 winter look; ${fp.frames} frames: eye >= ${EYE_FLOOR.toFixed(2)} m, no jump${curve.length ? ', on my centripetal Catmull-Rom curve at τ (getPoint, time-linear legs, eye floor, clamp) to 1 mm' : ''}; caption = the stop approached`, cut(f));
  // per leg by seek: first-floor room (programmatic level switch G -> 1 keeps it running), last leg (Overview)
  const g = [], firstUp = stops.findIndex((s) => s.kind === 'room' && s.level !== stops[1].level);
  for (const k of [2, firstUp, stops.length - 1]) { if (k < 1) continue; const s = stops[k];
    await seek(S, s.t - 0.3); st = await S.page.evaluate(STATE); const tag = `leg to stop ${k} (${s.kind === 'overview' ? 'Overview' : s.id})`;
    if (!running(st)) { g.push(`${tag}: the tour ended`); continue; }
    if (st.caption !== T.stopCaption(h, s)) g.push(`${tag}: caption "${st.caption}"`);
    const lv = s.kind === 'overview' ? 'all' : s.level; if (st.level !== lv || st.levelUi !== lv) g.push(`${tag}: level ${st.level} / radio ${st.levelUi}, ${lv} expected`);
    if (s.kind === 'overview' ? st.hl : st.hl !== s.id) g.push(`${tag}: highlight ${st.hl}`);
    if (st.roof) g.push(`${tag}: Roof on`);
    await S.page.waitForTimeout(450); st = await S.page.evaluate(STATE); if (running(st) && st.tau !== null && st.tau >= s.t - 1e-6 && st.tau < s.t + 0.5) { const d = T.dist(st.pose.target, s.look); if (d > 0.6) g.push(`${tag}: target ${d.toFixed(2)} m from the stop's look just after τ ${s.t}`); } }
  R.check(`${T0}: seeking to legs (a room on the same level, the first room upstairs, the last leg): caption / level (UI + scene) / highlight of the stop approached ("Overview", All, no highlight on the last leg); the level switch G -> ${stops[firstUp] && stops[firstUp].level} keeps the tour running`, cut(g));
  // pause by tap, resume by keyboard, fast, light preset
  const p = []; await seek(S, 6);
  await S.act('v3-tour-pause'); st = await S.page.evaluate(STATE); const pz = st.pose;
  if (st.pressed !== 'true' || !/resume tour/i.test(st.label || '') || st.capPressed !== 'true') p.push(`paused: aria-pressed ${st.pressed}, label "${st.label}", caption pause ${st.capPressed}`);
  await S.page.evaluate(() => { window.__raf = 0; }); await S.page.waitForTimeout(350); const pz2 = await S.page.evaluate(() => ({ p: PC.view3d.pose(), raf: window.__raf }));
  if (T.dist(T.eyeOf(pz), T.eyeOf(pz2.p)) > 1e-9 || pz2.raf) p.push(`paused: pose moved ${T.dist(T.eyeOf(pz), T.eyeOf(pz2.p)).toFixed(3)} m, ${pz2.raf} frames requested`);
  await S.page.evaluate(() => { window.__rec = []; }); await S.page.focus('[data-pc="v3-tour-pause"]'); await S.page.keyboard.press('Enter'); await S.page.waitForTimeout(500);
  st = await S.page.evaluate(STATE); if (st.pressed !== 'false' || !/pause tour/i.test(st.label || '')) p.push(`resumed: aria-pressed ${st.pressed}, label "${st.label}"`);
  rec = await S.page.evaluate(() => window.__rec.slice()); if (rec.length && T.dist(T.eyeOf(rec[0][1]), T.eyeOf(pz)) > 0.3) p.push(`resume: the first frame moved ${T.dist(T.eyeOf(rec[0][1]), T.eyeOf(pz)).toFixed(2)} m from the paused pose`);
  p.push(...frameProblems(rec, stops, 'after Resume').f);
  await S.page.evaluate(() => { window.__rec = []; }); await S.act(speedHook('fast')); await S.page.waitForTimeout(700); rec = await S.page.evaluate(() => window.__rec.slice());
  p.push(...frameProblems(rec, stops, 'after Fast').f);
  const fr = [...new Map(rec.filter((r) => r[2] != null).map((r) => [r[0], r])).values()].sort((a, b) => a[0] - b[0]);
  if (fr.length > 4) { const a = fr[1], b = fr[fr.length - 1]; let capped = 0; for (let k = 2; k < fr.length; k++) capped += Math.min(100, fr[k][0] - fr[k - 1][0]); const rate = (b[2] - a[2]) / (capped / 1000); if (Math.abs(rate - 1.8) > 0.05) p.push(`Fast: τ advances ${rate.toFixed(2)} x the capped frame time (1.8)`); }
  const looks0 = await S.page.evaluate(() => window.__looks);
  await S.act('v3-preset-noon'); await S.page.waitForTimeout(300); st = await S.page.evaluate(STATE); const looks1 = await S.page.evaluate(() => window.__looks);
  if (!running(st)) p.push('a Light preset ended the tour'); if (looks1 - looks0 !== 1) p.push(`setLook called ${looks1 - looks0} times for one preset tap`);
  const lk = await S.page.evaluate(() => PC.view3d.look()); if (lk.hour !== 12 || lk.season !== 'winter') p.push(`look after the noon preset ${JSON.stringify(lk)}`);
  R.check(`${T0}: Pause by tap (aria-pressed true, "Resume tour", caption pause mirrors, pose frozen, no frames requested); Resume by keyboard (no jump); Fast mid-tour (τ rate 1.8 of capped time, no jump); a Light preset mid-tour keeps the tour running and the look is the preset's`, cut(p));
  const lookTour = await S.page.evaluate(() => window.__looks) - looks1;
  // ends
  const e = [], box = await S.page.evaluate(() => { const r = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const ENDS = [
    ['a canvas drag', async () => { await S.page.mouse.move(...box); await S.page.mouse.down(); await S.page.mouse.move(box[0] + 30, box[1], { steps: 3 }); await S.page.mouse.up(); }, 'gesture'],
    ['a gesture while paused', async () => { await S.act('v3-tour-pause'); await S.page.mouse.move(...box); await S.page.mouse.down(); await S.page.mouse.up(); }, 'gesture'],
    ['Stop', () => S.act('v3-tour-stop'), 'keep'],
    ['a level radio', () => S.act(pick('all')), 'level'],
    ['Reset view', () => S.act('v3-reset'), 'reset'],
    ['a finder pick', () => S.page.evaluate(() => { const s = document.querySelector('[data-pc="v3-room"]'), o = s.querySelectorAll('optgroup option'); s.value = o[o.length - 1].value; s.dispatchEvent(new Event('change', { bubbles: true })); }), 'pick'],
  ];
  for (const [name, act, kind] of ENDS) {
    await startTour(S); await seek(S, kind === 'level' ? stops[firstUp].t - 0.5 : 8); const a = await S.page.evaluate(STATE);
    if (!running(a)) { e.push(`${name}: the tour did not start`); continue; }
    await act(); await S.settle(); const b = await S.page.evaluate(STATE); await S.page.waitForTimeout(250); const c = await S.page.evaluate(STATE);
    if (kind === 'pick') { if (running(b)) e.push(`${name}: still touring`); if (!b.flying && !c.flying && T.dist(c.pose.target, a.pose.target) < 0.5) e.push(`${name}: no finder flight`); if (c.caption === null || c.value === '') e.push(`${name}: the pick's caption / select missing`); continue; }
    e.push(...endedProblems(b, name));
    if (kind === 'level') { if (b.level !== 'all') e.push(`${name}: level ${b.level} (All tapped)`); continue; }
    if (kind === 'reset') { if (T.dist(c.pose.target, C.reset.target) > 1e-6) e.push(`${name}: not at Reset`); continue; }
    if (b.level !== a.level || b.roof !== a.roof) e.push(`${name}: level ${a.level} -> ${b.level}, Roof ${a.roof} -> ${b.roof} (kept expected)`);
    if (kind !== 'gesture' && T.dist(T.eyeOf(a.pose), T.eyeOf(b.pose)) > 0.5) e.push(`${name}: the view jumped ${T.dist(T.eyeOf(a.pose), T.eyeOf(b.pose)).toFixed(2)} m`);
    if (T.dist(T.eyeOf(b.pose), T.eyeOf(c.pose)) > 1e-9) e.push(`${name}: the pose kept moving after the end`); }
  // leaving stage 5 mid-tour, speed kept
  await startTour(S); await S.page.evaluate(() => PC.store.go(4)); await S.settle(); await S.page.evaluate(() => PC.store.go(5)); await ready(S); await S.page.waitForTimeout(300);
  st = await S.page.evaluate(STATE); e.push(...endedProblems(st, 'leaving stage 5 and back')); if (st.speed !== 'fast') e.push(`speed ${st.speed} after leaving and returning (Fast kept)`);
  if (lookTour) e.push(`the tour called setLook ${lookTour} times`);
  R.check(`${T0}: a canvas drag, a gesture while paused, Stop, a level radio (applied), Reset view (applied), a finder pick (its flight runs) and leaving stage 5 each end the tour: Start back, caption / highlight cleared, select "Go to room…", pose / level / Roof kept where nothing else applies; no restart on return; Fast kept; the tour never calls setLook`, cut(e));
  await S.end(T0);
});

// ================= B. maximum house =================
await guard('B maximum', async () => {
  const S = await session(browser, VP.desk, { three: 'real', init: [REC] }), T0 = 'B 1280x800 maximum house', f = [];
  await to5(S, "s.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; s.ans.streetEdge = 0; s.ans.footprintPct = 40; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.usableRoof = true; s.ans.roofType = 'terrace'; s.ans.pool = { on: true, size: 'L' }; s.ans.parking = { cars: 4, covered: true }; s.ans.extras = { wall: true, gate: 'right', seating: true }; s.ans.pairs = []; s.ans.rooms = []; let n = 1; for (const l of ['B', 'G', '1', '2']) for (const ty of ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry']) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); s.ans.nextRoomId = n;");
  const h = await S.page.evaluate(HOUSE), C = await S.page.evaluate(CTX), stops = (await S.page.evaluate((a) => PC.tourplan.build(PC.debug.scene().house, a), C.aspect)).stops;
  await startTour(S); let g0 = null;
  for (const k of [1, 5, 15, 35]) { const s = stops[k]; if (!s) continue; await seek(S, s.t - 0.05); await S.page.waitForTimeout(150); const st = await S.page.evaluate(STATE);
    if (!running(st)) { f.push(`stop ${k}: the tour ended`); break; }
    if (st.meshes > 22) f.push(`stop ${k} (${s.level}): ${st.meshes} meshes (<= 22)`);
    if (g0 === null) g0 = st.geoms; else if (st.geoms !== g0) f.push(`stop ${k}: renderer geometries ${g0} -> ${st.geoms} (one highlight alive)`);
    if (s.level === 'B') {
      if (st.cap !== false) f.push(`stop ${k} (B): groundCap visible`);
      await S.act('v3-tour-pause');
      const r = await S.page.evaluate((id) => { const i = PC.debug.scene(), T3 = THREE, cam = i.camera; i.renderNow(); cam.updateMatrixWorld(); const hl = i.world.getObjectByName('highlight'); if (!hl) return { err: 'no highlight' };
        hl.geometry.computeBoundingBox(); const c = new T3.Vector3(); hl.geometry.boundingBox.getCenter(c); hl.localToWorld(c);
        const rc = new T3.Raycaster(cam.position.clone(), c.clone().sub(cam.position).normalize()), hit = rc.intersectObjects(i.world.children, true).find((x) => { for (let q = x.object; q; q = q.parent) if (!q.visible) return false; return true; });
        const path = (o) => { const n = []; for (let q = o; q && q !== i.world; q = q.parent) n.unshift(q.name || q.type); return n.join('/'); };
        return { hit: hit ? path(hit.object) : 'nothing' }; }, s.id);
      if (r.err || !/^(level-B|highlight)/.test(r.hit)) f.push(`stop ${k} (B, ${s.id}): first visible hit towards the room ${r.err || r.hit}`);
      const shot = async () => (await S.page.locator('[data-pc="v3-canvas"]').screenshot()).toString('base64');
      const on = await shot(); await S.page.evaluate(() => { const i = PC.debug.scene(); i.world.getObjectByName('highlight').visible = false; i.renderNow(); }); const off = await shot(); await S.page.evaluate(() => { const i = PC.debug.scene(); i.world.getObjectByName('highlight').visible = true; i.renderNow(); });
      const nd = await S.page.evaluate(([a, b]) => Promise.all([a, b].map((s) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); res(x.getImageData(0, 0, im.width, im.height).data); }; im.src = 'data:image/png;base64,' + s; }))).then(([p, q]) => { let n = 0; for (let k = 0; k < p.length; k += 4) if (Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]) > 30) n++; return n; }), [on, off]);
      if (nd < 30) f.push(`stop ${k} (B): the highlight changes only ${nd} px`); OBS.push(`B basement stop ${s.id}: highlight ${nd} px`);
      await S.shot('B-basement-stop'); await S.act('v3-tour-pause'); } }
  await S.act('v3-tour-stop');
  R.check(`${T0}: at stops on B / G / 1 / 2 the tour keeps <= 22 meshes and one highlight geometry; a basement stop on real r128: groundCap hidden, the room is the first visible hit from the eye and the highlight is drawn`, cut(f));
  await S.end(T0);
});

// ================= C. phone, G1 =================
await guard('C 360x640', async () => {
  const S = await session(browser, VP.phone, { three: 'real', init: [REC] }), T0 = 'C 360x640 real', f = [];
  let taps = 0; const tap = async (h) => { taps++; await S.act(h); };
  await tap('btn-sample'); await tap('btn-skip3d'); await ready(S); await tap('v3-tab-tour'); await tap('v3-tour-start'); await S.page.waitForTimeout(400);
  let st = await S.page.evaluate(STATE);
  if (!running(st) || taps > 4) f.push(`G1: ${taps} taps, tour running ${running(st)} (4 expected)`);
  const lay = await S.page.evaluate(() => ['v3-caption-pause', 'v3-caption-stop', 'v3-caption'].map((h) => { const r = document.querySelector(`[data-pc="${h}"]`).getBoundingClientRect(); return [h, r.left, r.right, r.width, r.height]; }));
  for (const [hk, l, r, w, hh] of lay) { if (l < -0.5 || r > 360.5) f.push(`${hk} ${l.toFixed(0)}..${r.toFixed(0)} outside 360 px`); if (hk !== 'v3-caption' && (w < 43.5 || hh < 43.5)) f.push(`${hk} ${w.toFixed(0)} x ${hh.toFixed(0)} px (>= 44)`); }
  await S.act('v3-caption-pause'); st = await S.page.evaluate(STATE); if (st.capPressed !== 'true' || st.pressed !== 'true') f.push(`caption pause: caption ${st.capPressed}, panel ${st.pressed}`);
  await S.shot('C-paused');
  await S.act('v3-caption-stop'); st = await S.page.evaluate(STATE); f.push(...endedProblems(st, 'caption stop'));
  await S.act(speedHook('slow')); await S.page.reload(); await S.until(() => S.page.evaluate(() => !!document.querySelector('[data-pc="v3-tour-speed"]')), 5000);
  const sp = await S.page.evaluate(() => (document.querySelector('[data-pc="v3-tour-speed"] input:checked') || {}).value); if (sp !== 'normal') f.push(`speed after a reload ${sp} (Normal: not in the draft)`);
  R.check(`${T0}: G1 Load sample -> Skip to 3D -> Tour tab -> Start in ${taps} taps; caption pause / stop >= 44 px inside the viewport; caption pause pauses (panel Pause mirrors), caption stop ends the tour; a reload gives Normal speed`, cut(f));
  await S.end(T0);
});

await browser.close();
for (const o of OBS) R.note(o);
R.note(`sections: ${TIMES.join(', ')}; run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
