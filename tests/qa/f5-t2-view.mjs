// F5-T2 QA (browser, vendored real r128): the drone tour in the built page, judged by QA's own oracle (f5-t2-ref.mjs).
// Version-aware: needs PC.three.tour + PC.tourplan (plan §6); without them the suite only notes the skip (no browser).
// Run-time budget (orchestrator, batch 13): <= 25 s with f5-t2-model; later stops are reached with the debug-only
// PC.debug.tourSeek(τ) (ruling 8), never by waiting for real tour time.
//   A 1280x800, one page (TL ruling 3): G1 on desktop (3 taps); then the sample at 22:00 winter with a finder room
//     selected and the Roof on: Start (selection cleared, Roof off, lead-in caption "Overview", look kept, frames above
//     the eye floor without a jump); seeks are paused (pause -> seek -> one dt-0 frame -> read: TL ruling 2): the stop
//     approached sets caption / level / highlight, the silent G -> 1 switch keeps the tour, at τ = tᵢ the target is the
//     stop's look (1 mm) and the eye at most 0.4 m above the plan eye (as-built model, TL ruling 1); Pause by tap,
//     Resume by keyboard, Fast (τ rate 1.8), a Light preset (tour runs on; the tour never calls setLook); ends by a
//     canvas drag (running), a gesture while paused, Stop (pose read / click / read in one task), a level radio, Reset,
//     Roof on, a finder pick, leaving stage 5 (no restart); Fast kept.
//     Then the maximum house in the same page: <= 22 meshes at 3 stops, one highlight geometry between the two basement
//     stops, groundCap hidden, no groundOuter inside the footprint (B-1 class), the room the first visible hit, the
//     highlight drawn (real r128).
//   C 360x640 touch: G1 in 4 taps; caption pause / stop >= 44 px, inside the viewport, mirrored; reload -> Normal speed;
//     with the stored draft G1 takes 5 taps (Load sample confirm).
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
const t0 = Date.now(), TIMES = [], OBS = [], LAP = []; let lapT = Date.now(); const lap = (n) => { const t = Date.now(); LAP.push(`${n} ${((t - lapT) / 1000).toFixed(1)}`); lapT = t; };
const cut = (a, n = 8) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);
const EYE_FLOOR = T.eyeFloorOf(PC.data.vegetation);
// rAF counter + per-frame recorder: [ts, pose, τ]; setLook call counter
const REC = () => { const raf = window.requestAnimationFrame.bind(window); window.__raf = 0; window.__rec = []; window.__recOn = false;
  window.__tau = () => { const t = window.PC && PC.three && PC.three.tour; const s = t && t.state ? t.state() : null; if (s) for (const k of ['tau', 't', 'time', 'elapsed', 'τ']) if (typeof s[k] === 'number') return s[k]; return null; };
  window.requestAnimationFrame = (cb) => { window.__raf++; return raf((ts) => { cb(ts); if (window.__recOn && window.PC && PC.view3d && PC.view3d.pose) window.__rec.push([ts, PC.view3d.pose(), window.__tau(), !!(PC.three.tour && PC.three.tour.running && PC.three.tour.running())]); }); }; };
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
    pose: PC.view3d.pose(), tau: window.__tau ? window.__tau() : null, lead: !!(PC.three.tour && PC.three.tour.state && (PC.three.tour.state() || {}).lead), meshes, geoms: i.renderer.info.memory.geometries, hl: hv ? hl.userData.room || true : null, builds: i.builds }; };
const LIGHTS = () => { const i = PC.debug.scene(), o = []; i.scene.traverse((l) => { if (l.isLight) o.push([l.type, l.color.getHexString(), l.intensity.toFixed(6), l.position.toArray().map((x) => +x.toFixed(6))]); }); const b = i.scene.background; return JSON.stringify({ o, bg: b && b.getHexString ? b.getHexString() : null, look: PC.view3d.look() }); };
const running = (st) => !st.start && st.stop;
const endedProblems = (st, tag) => { const f = []; if (!st.start || st.stop || st.pause || st.pressed === 'true') f.push(`${tag}: buttons start ${st.start} / pause ${st.pause} (${st.pressed}) / stop ${st.stop}, Start expected`);
  if (st.caption !== null) f.push(`${tag}: caption "${st.caption}" left`); if (st.hl) f.push(`${tag}: highlight left on ${st.hl}`); if (st.value !== '') f.push(`${tag}: select "${st.value}"`); return f; };
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
// seek without drift: pause, seek, resume for the one dt-0 frame that shows exactly τ, pause again; `hold` keeps it
// paused for the read (then resume()), otherwise it runs on (FS impl-notes §3: ~117 ms frames move τ ~0.5 s per read)
async function seek(S, tau, { hold = false } = {}) {
  await S.page.evaluate(async ([t, hold]) => { const T = PC.three.tour; T.pause(); PC.debug.tourSeek(t); T.resume(); await new Promise((r) => requestAnimationFrame(() => r())); if (hold) T.pause(); }, [tau, hold]);
  await S.settle(); }
const resume = (S) => S.page.evaluate(() => PC.three.tour.resume());
// Start by the button's own click in the page, then a held seek in the same task (no running frames in between)
async function startAt(S, tau, hold) {
  await S.page.evaluate(async ([t, hold]) => { document.querySelector('[data-pc="v3-tour-start"]').click(); const T = PC.three.tour; T.pause(); PC.debug.tourSeek(t); T.resume(); await new Promise((r) => requestAnimationFrame(() => r())); if (hold) T.pause(); }, [tau, hold]);
  await S.settle(); }

const browser = await launch();

// ================= A. desk: sample =================
await guard('A 1280x800', async () => {
  const S = await session(browser, VP.desk, { three: 'real', init: [REC] }), T0 = 'A 1280x800 real';
  // G1 on desktop (focus 5): Load sample -> Skip to 3D -> Start = 3 taps; then stopped, and the scenario continues
  { let taps = 0; for (const hk of ['btn-sample', 'btn-skip3d']) { taps++; await S.act(hk); } await ready(S); taps++; await S.act('v3-tour-start'); const g1 = await S.page.evaluate(STATE);
    R.check(`${T0}: G1 Load sample -> Skip to 3D -> Start runs the tour in ${taps} taps (3)`, running(g1) && taps === 3 ? [] : [`${taps} taps, running ${running(g1)}`]);
    await S.act('v3-tour-stop'); await S.page.evaluate(() => PC.view3d.resetView()); await ready(S); }
  await S.page.evaluate(() => PC.view3d.setLook({ hour: 22, season: 'winter' })); await ready(S);
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
  await S.page.evaluate(() => { window.__rec = []; window.__recOn = true; }); await startTour(S); await S.page.waitForTimeout(600);
  let rec = await S.page.evaluate(() => window.__rec.slice()); st = await S.page.evaluate(STATE); f = [];
  if (!running(st) || !st.pause) f.push(`after Start: start ${st.start}, pause ${st.pause}, stop ${st.stop}`);
  if (st.roof || st.roofUi) f.push(`Roof ${st.roof} / switch ${st.roofUi} after Start`);
  if (st.capBtns.length !== 2) f.push(`caption buttons shown: ${st.capBtns}`);
  if ((await S.page.evaluate(LIGHTS)) !== L0) f.push('lights / background / look changed by Start (22:00 winter kept expected)');
  { const n = await S.page.evaluate(() => window.__looks); if (n) f.push(`Start called setLook ${n} times (the tour never calls it)`); }
  if (st.value !== '') f.push(`finder select "${st.value}" after Start (cleared expected)`);
  if (st.tau === null) OBS.push('τ not readable from PC.three.tour.state() (keys tau / t / time / elapsed): the curve match is skipped');
  const fp = frameProblems(rec, stops, 'first 1.2 s'); f.push(...fp.f);
  const lead = st.lead, leg0 = legOf(stops, st.tau || 0), want0 = lead ? T.OVERVIEW : T.stopCaption(h, stops[leg0 + 1]); if (st.caption !== want0) f.push(`caption "${st.caption}" on leg 0 (approaching "${want0}")`);
  await S.shot('A-start'); lap('start');
  R.check(`${T0}: Start clears the finder selection, turns the Roof off (scene + switch), disables Start, enables Pause / Stop, shows the caption's pause / stop, leaves the 22:00 winter look; ${fp.frames} frames: eye >= ${EYE_FLOOR.toFixed(2)} m, no jump (the as-built curve is judged at the stops, TL ruling); caption = the stop approached`, cut(f));
  // per leg by seek: first-floor room (programmatic level switch G -> 1 keeps it running), last leg (Overview)
  const g = [], firstUp = stops.findIndex((s) => s.kind === 'room' && s.level !== stops[1].level);
  for (const k of [firstUp, stops.length - 1]) { if (k < 1) continue; const s = stops[k];
    await seek(S, s.t - 0.3, { hold: true }); st = await S.page.evaluate(STATE); const tag = `leg to stop ${k} (${s.kind === 'overview' ? 'Overview' : s.id})`;
    if (!running(st)) { g.push(`${tag}: the tour ended`); continue; }
    if (st.caption !== T.stopCaption(h, s)) g.push(`${tag}: caption "${st.caption}"`);
    const lv = s.kind === 'overview' ? 'all' : s.level; if (st.level !== lv || st.levelUi !== lv) g.push(`${tag}: level ${st.level} / radio ${st.levelUi}, ${lv} expected`);
    if (s.kind === 'overview' ? st.hl : st.hl !== s.id) g.push(`${tag}: highlight ${st.hl}`);
    if (st.roof) g.push(`${tag}: Roof on`);
    if (s.kind === 'room') { await seek(S, s.t, { hold: true }); st = await S.page.evaluate(STATE); const d = T.dist(st.pose.target, s.look), e = T.eyeOf(st.pose), up = e[1] - s.eye[1], hz = Math.hypot(e[0] - s.eye[0], e[2] - s.eye[2]);
      if (d > 1e-3) g.push(`${tag}: at τ = t ${s.t} the target is ${d.toFixed(4)} m from the stop's look`);
      if (up < -1e-3 || up > 0.4 + 1e-6 || hz > 0.4 + 1e-6) g.push(`${tag}: at τ = t the eye is ${up.toFixed(3)} m above / ${hz.toFixed(3)} m beside the plan eye (lifted <= 0.4 m)`); }
    await resume(S); }
  R.check(`${T0}: seeking (paused) to legs (the first room upstairs, the last leg): caption / level (UI + scene) / highlight of the stop approached ("Overview", All, no highlight on the last leg); at τ = tᵢ the target is the stop's look (1 mm) and the eye at most 0.4 m above the plan eye; the level switch G -> ${stops[firstUp] && stops[firstUp].level} keeps the tour running`, cut(g));
  lap('legs');
  // pause by tap, resume by keyboard, fast, light preset
  const p = []; await seek(S, 6);
  await S.act('v3-tour-pause'); st = await S.page.evaluate(STATE); const pz = st.pose;
  if (st.pressed !== 'true' || !/resume tour/i.test(st.label || '') || st.capPressed !== 'true') p.push(`paused: aria-pressed ${st.pressed}, label "${st.label}", caption pause ${st.capPressed}`);
  await S.page.evaluate(() => { window.__raf = 0; }); await S.page.waitForTimeout(250); const pz2 = await S.page.evaluate(() => ({ p: PC.view3d.pose(), raf: window.__raf }));
  if (T.dist(T.eyeOf(pz), T.eyeOf(pz2.p)) > 1e-9 || pz2.raf) p.push(`paused: pose moved ${T.dist(T.eyeOf(pz), T.eyeOf(pz2.p)).toFixed(3)} m, ${pz2.raf} frames requested`);
  await S.page.evaluate(() => { window.__rec = []; }); await S.page.focus('[data-pc="v3-tour-pause"]'); await S.page.keyboard.press('Enter'); await S.page.waitForTimeout(150);
  st = await S.page.evaluate(STATE); if (st.pressed !== 'false' || !/pause tour/i.test(st.label || '')) p.push(`resumed: aria-pressed ${st.pressed}, label "${st.label}"`);
  rec = await S.page.evaluate(() => window.__rec.slice()); if (rec.length && T.dist(T.eyeOf(rec[0][1]), T.eyeOf(pz)) > 0.3) p.push(`resume: the first frame moved ${T.dist(T.eyeOf(rec[0][1]), T.eyeOf(pz)).toFixed(2)} m from the paused pose`);
  p.push(...frameProblems(rec, stops, 'after Resume').f);
  await S.page.evaluate(() => { window.__rec = []; }); await S.act(speedHook('fast')); await S.page.waitForTimeout(500); rec = await S.page.evaluate(() => window.__rec.slice());
  p.push(...frameProblems(rec, stops, 'after Fast').f);
  const fr = [...new Map(rec.filter((r) => r[2] != null).map((r) => [r[0], r])).values()].sort((a, b) => a[0] - b[0]);
  if (fr.length > 4) { const a = fr[1], b = fr[fr.length - 1]; let capped = 0; for (let k = 2; k < fr.length; k++) capped += Math.min(100, fr[k][0] - fr[k - 1][0]); const rate = (b[2] - a[2]) / (capped / 1000); if (Math.abs(rate - 1.8) > 0.05) p.push(`Fast: τ advances ${rate.toFixed(2)} x the capped frame time (1.8)`); }
  const looks0 = await S.page.evaluate(() => window.__looks);
  await S.act('v3-preset-noon'); await S.page.waitForTimeout(150); st = await S.page.evaluate(STATE); const looks1 = await S.page.evaluate(() => window.__looks);
  if (!running(st)) p.push('a Light preset ended the tour'); if (looks1 - looks0 !== 1) p.push(`setLook called ${looks1 - looks0} times for one preset tap`);
  const lk = await S.page.evaluate(() => PC.view3d.look()); if (lk.hour !== 12 || lk.season !== 'winter') p.push(`look after the noon preset ${JSON.stringify(lk)}`);
  R.check(`${T0}: Pause by tap (aria-pressed true, "Resume tour", caption pause mirrors, pose frozen, no frames requested); Resume by keyboard (no jump); Fast mid-tour (τ rate 1.8 of capped time, no jump); a Light preset mid-tour keeps the tour running and the look is the preset's`, cut(p));
  const lookTour = await S.page.evaluate(() => window.__looks) - looks1;
  lap('pause');
  // ends
  const e = [], box = await S.page.evaluate(() => { const r = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const ENDS = [
    ['a canvas drag', async () => { await S.page.mouse.move(...box); await S.page.mouse.down(); await S.page.mouse.move(box[0] + 30, box[1], { steps: 3 }); await S.page.mouse.up(); }, 'gesture'],
    ['a gesture while paused', async () => { await S.page.mouse.move(...box); await S.page.mouse.down(); await S.page.mouse.up(); }, 'gesture'],
    ['Stop', async () => { const r = await S.page.evaluate(() => { const a = PC.view3d.pose(); document.querySelector('[data-pc="v3-tour-stop"]').click(); return { a, b: PC.view3d.pose() }; }); if (JSON.stringify(r.a) !== JSON.stringify(r.b)) e.push(`Stop: pose changed by the click (${T.dist(T.eyeOf(r.a), T.eyeOf(r.b)).toFixed(4)} m)`); }, 'keep'],
    ['a level radio', () => S.act(pick('all')), 'level'],
    ['Reset view', () => S.act('v3-reset'), 'reset'],
    ['Roof on', () => S.act('v3-roof'), 'roof'],
    ['a finder pick', () => S.page.evaluate(() => { const s = document.querySelector('[data-pc="v3-room"]'), o = s.querySelectorAll('optgroup option'); s.value = o[o.length - 1].value; s.dispatchEvent(new Event('change', { bubbles: true })); }), 'pick'],
  ];
  for (const [name, act, kind] of ENDS) {
    // run-time (frames ~120 ms while a tour runs on SwiftShader): only the canvas drag ends a running tour; the others end
    // a paused one (seek held), which the plan treats the same (a gesture while paused ends it; Stop / radios / Reset / pick)
    await startAt(S, kind === 'level' ? stops[firstUp].t - 0.5 : 8, name !== 'a canvas drag'); const a = await S.page.evaluate(STATE);
    if (!running(a)) { e.push(`${name}: the tour did not start`); continue; }
    await S.page.evaluate(() => { window.__rec = []; window.__recOn = true; }); await act(); await S.settle(); const b = await S.page.evaluate(STATE); const rr = await S.page.evaluate(() => { window.__recOn = false; return window.__rec; }); const lastRun = rr.filter((x) => x[3]).pop(); await S.page.waitForTimeout(250); const c = await S.page.evaluate(STATE);
    if (kind === 'pick') { if (running(b)) e.push(`${name}: still touring`); if (!b.flying && !c.flying && T.dist(c.pose.target, a.pose.target) < 0.5) e.push(`${name}: no finder flight`); if (c.caption === null || c.value === '') e.push(`${name}: the pick's caption / select missing`); lap(name); continue; }
    e.push(...endedProblems(b, name));
    if (kind === 'level') { if (b.level !== 'all') e.push(`${name}: level ${b.level} (All tapped)`); lap(name); continue; }
    if (kind === 'roof') { if (!b.roof || !b.roofUi) e.push(`${name}: Roof ${b.roof} / switch ${b.roofUi} (on expected)`); lap(name); continue; }
    if (kind === 'reset') { if (T.dist(c.pose.target, C.reset.target) > 1e-6) e.push(`${name}: not at Reset`); lap(name); continue; }
    if (b.level !== a.level || b.roof !== a.roof) e.push(`${name}: level ${a.level} -> ${b.level}, Roof ${a.roof} -> ${b.roof} (kept expected)`);
    if (kind !== 'gesture' && lastRun && T.dist(T.eyeOf(lastRun[1]), T.eyeOf(b.pose)) + T.dist(lastRun[1].target, b.pose.target) > 1e-6) e.push(`${name}: the view moved ${T.dist(T.eyeOf(lastRun[1]), T.eyeOf(b.pose)).toFixed(3)} m from the last tour frame`);
    if (T.dist(T.eyeOf(b.pose), T.eyeOf(c.pose)) > 1e-9) e.push(`${name}: the pose kept moving after the end`); lap(name); }
  // leaving stage 5 mid-tour, speed kept
  await startAt(S, 8, false); await S.page.evaluate(() => PC.store.go(4)); await S.settle(); await S.page.evaluate(() => PC.store.go(5)); await ready(S); await S.page.waitForTimeout(300);
  st = await S.page.evaluate(STATE); e.push(...endedProblems(st, 'leaving stage 5 and back')); if (st.speed !== 'fast') e.push(`speed ${st.speed} after leaving and returning (Fast kept)`);
  if (lookTour) e.push(`the tour called setLook ${lookTour} times`);
  R.check(`${T0}: a canvas drag, a gesture while paused, Stop, a level radio (applied), Reset view (applied), Roof on (applied), a finder pick (its flight runs) and leaving stage 5 each end the tour: Start back, caption / highlight cleared, select "Go to room…", pose / level / Roof kept where nothing else applies; no restart on return; Fast kept; the tour never calls setLook`, cut(e));
  lap('leave');
  // ---- B: the maximum house in the same page (one page load per viewport, TL ruling 3) ----
  { const T0 = 'B 1280x800 maximum house', f = [];
  await to5(S, "s.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; s.ans.streetEdge = 0; s.ans.footprintPct = 40; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.usableRoof = true; s.ans.roofType = 'terrace'; s.ans.pool = { on: true, size: 'L' }; s.ans.parking = { cars: 4, covered: true }; s.ans.extras = { wall: true, gate: 'right', seating: true }; s.ans.pairs = []; s.ans.rooms = []; let n = 1; for (const l of ['B', 'G', '1', '2']) for (const ty of ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry']) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); s.ans.nextRoomId = n;");
  const h = await S.page.evaluate(HOUSE), C = await S.page.evaluate(CTX), stops = (await S.page.evaluate((a) => PC.tourplan.build(PC.debug.scene().house, a), C.aspect)).stops;
  lap('maxload'); await startTour(S); let g0 = null;
  for (const k of [1, 5, 35]) { const s = stops[k]; if (!s) continue; await seek(S, s.t - 0.05, { hold: true }); const st = await S.page.evaluate(STATE);
    if (!running(st)) { f.push(`stop ${k}: the tour ended`); break; }
    if (st.meshes > 22) f.push(`stop ${k} (${s.level}): ${st.meshes} meshes (<= 22)`);
    if (s.level === 'B') { if (g0 === null) g0 = st.geoms; else if (st.geoms !== g0) f.push(`stop ${k}: renderer geometries ${g0} -> ${st.geoms} between two basement stops (one highlight alive; same levels shown)`); }
    if (s.level === 'B') {
      if (st.cap !== false) f.push(`stop ${k} (B): groundCap visible`);
      const r = await S.page.evaluate((id) => { const i = PC.debug.scene(), T3 = THREE, cam = i.camera; i.renderNow(); cam.updateMatrixWorld(); const hl = i.world.getObjectByName('highlight'); if (!hl) return { err: 'no highlight' };
        hl.geometry.computeBoundingBox(); const c = new T3.Vector3(); hl.geometry.boundingBox.getCenter(c); hl.localToWorld(c);
        const rc = new T3.Raycaster(cam.position.clone(), c.clone().sub(cam.position).normalize()), hit = rc.intersectObjects(i.world.children, true).find((x) => { for (let q = x.object; q; q = q.parent) if (!q.visible) return false; return true; });
        const path = (o) => { const n = []; for (let q = o; q && q !== i.world; q = q.parent) n.unshift(q.name || q.type); return n.join('/'); };
        return { hit: hit ? path(hit.object) : 'nothing' }; }, s.id);
      if (r.err || !/^(level-B|highlight)/.test(r.hit)) f.push(`stop ${k} (B, ${s.id}): first visible hit towards the room ${r.err || r.hit}`);
      if (k === 1) { const leak = await S.page.evaluate(() => { const i = PC.debug.scene(), T3 = THREE, h = i.house, cam = i.camera, outer = i.world.getObjectByName('groundOuter'), old = outer.material; outer.material = new T3.MeshBasicMaterial({ color: 0xff00ff }); i.renderNow();
          const gl = i.renderer.getContext(), w = gl.drawingBufferWidth, hh = gl.drawingBufferHeight, px = new Uint8Array(w * hh * 4); gl.readPixels(0, 0, w, hh, gl.RGBA, gl.UNSIGNED_BYTE, px); outer.material.dispose(); outer.material = old; i.renderNow();
          const fp = h.footprint, X = (u) => u - h.center[0], Z = (v) => -(v - h.center[1]); cam.updateMatrixWorld();
          const poly = [[fp.u, fp.v], [fp.u + fp.w, fp.v], [fp.u + fp.w, fp.v + fp.d], [fp.u, fp.v + fp.d]].map(([u, v]) => { const q = new T3.Vector3(X(u), 0, Z(v)).project(cam); return [(q.x + 1) / 2 * w, (q.y + 1) / 2 * hh]; });
          const inside = (x, y) => { let c = false; for (let a = 0, b = 3; a < 4; b = a++) { const [xa, ya] = poly[a], [xb, yb] = poly[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c; } return c; };
          let n = 0; for (let y = 0; y < hh; y += 2) for (let x = 0; x < w; x += 2) { const k = (y * w + x) * 4; if (px[k] > 200 && px[k + 1] < 60 && px[k + 2] > 200 && inside(x, y)) n++; } return n; });
        if (leak) f.push(`stop ${k} (B): ${leak} groundOuter px inside the footprint during the tour (B-1 class)`); }
      if (k === 1) { const shot = async () => (await S.page.locator('[data-pc="v3-canvas"]').screenshot()).toString('base64');
      const on = await shot(); await S.page.evaluate(() => { const i = PC.debug.scene(); i.world.getObjectByName('highlight').visible = false; i.renderNow(); }); const off = await shot(); await S.page.evaluate(() => { const i = PC.debug.scene(); i.world.getObjectByName('highlight').visible = true; i.renderNow(); });
      const nd = await S.page.evaluate(([a, b]) => Promise.all([a, b].map((s) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); res(x.getImageData(0, 0, im.width, im.height).data); }; im.src = 'data:image/png;base64,' + s; }))).then(([p, q]) => { let n = 0; for (let k = 0; k < p.length; k += 4) if (Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]) > 30) n++; return n; }), [on, off]);
      if (nd < 30) f.push(`stop ${k} (B): the highlight changes only ${nd} px`); OBS.push(`B basement stop ${s.id}: highlight ${nd} px`); }
      if (k === 1) await S.shot('B-basement-stop'); }
    await resume(S); }
  await S.act('v3-tour-stop');
  R.check(`${T0}: at 3 stops (2 on B, 1 on the second floor) the tour keeps <= 22 meshes and one highlight geometry; a basement stop on real r128: groundCap hidden, no groundOuter inside the footprint (B-1 class), the room is the first visible hit from the eye (both basement stops) and the highlight is drawn (the first)`, cut(f));
  }
  await S.end('A 1280x800 real');
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
  { let t2 = 0; for (const hk of ['btn-sample', 'dialog-ok', 'btn-skip3d']) { if (hk === 'dialog-ok' && !(await S.shown(hk))) continue; t2++; await S.act(hk); } await ready(S); t2++; await S.act('v3-tab-tour'); t2++; await S.act('v3-tour-start'); const g = await S.page.evaluate(STATE);
    if (!running(g) || t2 > 5) f.push(`G1 with a stored draft: ${t2} taps, running ${running(g)} (5 expected)`); else R.note(`C G1 with a stored draft: ${t2} taps`); await S.act('v3-caption-stop'); }
  const sp = await S.page.evaluate(() => (document.querySelector('[data-pc="v3-tour-speed"] input:checked') || {}).value); if (sp !== 'normal') f.push(`speed after a reload ${sp} (Normal: not in the draft)`);
  R.check(`${T0}: G1 Load sample -> Skip to 3D -> Tour tab -> Start in ${taps} taps; caption pause / stop >= 44 px inside the viewport; caption pause pauses (panel Pause mirrors), caption stop ends the tour; a reload gives Normal speed; with the stored draft, Load sample (confirm) -> Skip to 3D -> Tour tab -> Start in 5 taps or fewer`, cut(f));
  await S.end(T0);
});

await browser.close();
for (const o of OBS) R.note(o);
if (process.env.QA_LAPS) R.note(`laps: ${LAP.join(', ')}`);
R.note(`sections: ${TIMES.join(', ')}; run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
