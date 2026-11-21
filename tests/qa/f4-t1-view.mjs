// F4-T1 QA (browser): stage 5 in the built page with three: 'real' (vendored r128, byte-identical to the cdnjs file) and
// three: 'mock', judged by QA's own oracle (f4-t1-ref.mjs). TL impl-review focus list:
//   A acceptance (real geometry = my oracle; opens on All with the Roof off; level selector matrix incl. Basement with
//     the ground cap hidden; Q10 exteriors; rooms after an edit + approve, m and ft), mock at 360x640;
//   B Q14 in 3D (5 positions, lift on, real geometry); C gestures (touch 360x640 / 640x360, mouse 1280x800, random-run
//     clamps, no page scroll / zoom, Reset framing); D loop (rAF while idle / stage 4 / hidden, one frame on return, pose
//     kept, no rebuild for the same key, Q10 through stage 2 -> rebuild with the pose kept); E unavailable (aborted
//     three.js, mock failRenderer, real r128 without WebGL); F G6 on the maximum house at dpr 3; G disabled controls
//     (computed styles, pixels of the slider thumb, taps do nothing), level labels at 360 px with 5 options, the
//     stage-2 stepper icons disabled at a limit.
// Run: node tests/qa/f4-t1-view.mjs [--no-shots] [--only=A,B,...]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, collector, launch, touchDriver } from './lib.mjs';
import { sessions } from './session.mjs';
import * as Q from './f2-t1-ref.mjs';
import * as H from './f4-t1-ref.mjs';

const R = collector('F4-T1 view');
// Open minor bugs accepted by docs/03-tasks/F4-T1/qa-report.md (listed as KNOWN, they do not fail the run):
R.known.push({ re: /return to stage 5: exactly one frame.*renders \+2, builds (\d+) -> \1,/, bug: 'F4T1-1 second identical frame on return (ResizeObserver)' });
R.known.push({ re: /a click on the model focuses the canvas/, bug: 'F4T1-2 a mouse click does not focus the canvas' });
const noShots = process.argv.includes('--no-shots'), shots = join(ROOT, 'tests/qa/shots/f4-t1');
if (!noShots) mkdirSync(shots, { recursive: true });
const session = sessions({ R, shots, noShots });
const { PC } = H.loadPC3();
const D = { exteriors: PC.data.exteriors, roomTints: PC.data.roomTints, interiors: PC.data.interiors };
const VP = { phone: { tag: '360x640', w: 360, h: 640, touch: true }, land: { tag: '640x360', w: 640, h: 360, touch: true }, desk: { tag: '1280x800', w: 1280, h: 800, touch: false } };
const DEG = Math.PI / 180, t0 = Date.now();
const cut = (a) => a.slice(0, 8).concat(a.length > 8 ? [`... ${a.length} in all`] : []);
const RAF = () => { const raf = window.requestAnimationFrame.bind(window); window.__raf = 0; window.requestAnimationFrame = (cb) => { window.__raf++; return raf(cb); }; };
const FAIL_MOCK = () => { let m; Object.defineProperty(window, '__threeMock', { configurable: true, get() { return m; }, set(v) { m = v; if (v) v.failRenderer = true; } }); };
const NO_WEBGL = () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; };

// ---------- page helpers ----------
// A stage-3-valid project reached for real: the sample (changed by mut), stage 2 -> 3 (sync), every level approved, 4, 5.
async function to5(S, mut = '') {
  await S.page.evaluate((m) => { const st = PC.sample.state(); new Function('s', m)(st); st.plans = {}; st.stage = 1; PC.store.replace(st); PC.store.go(2); PC.store.go(3);
    PC.store.commit((s) => { for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; }, { nav: true }); PC.store.go(4); PC.store.go(5); }, mut);
  return ready(S);
}
const READY = () => { const i = PC.debug.scene(), q = (h) => document.querySelector(`[data-pc="${h}"]`); return (i.active && !i.building && i.builds > 0 && q('v3-building').hidden && !i.frame && !i.dirty) || !q('v3-unavailable').hidden; };
async function ready(S) { const ok = await S.until(() => S.page.evaluate(READY), 8000); await S.settle(); return ok; }
const info = (S) => S.page.evaluate(() => { const i = PC.debug.scene(), c = document.querySelector('[data-pc="v3-canvas"]'); return { renders: i.renders, builds: i.builds, active: i.active, frame: i.frame, level: i.level, roof: i.roof, size: i.size, pose: PC.debug.cam(), cw: c.clientWidth, ch: c.clientHeight, raf: window.__raf }; });
const world = (S) => S.page.evaluate(`${H.SUMMARIZE}(PC.debug.scene().world)`);
const visOnly = (S) => S.page.evaluate(() => { const w = PC.debug.scene().world, cap = w.getObjectByName('groundCap'); return { groups: w.children.map((g) => [g.name, g.visible]), cap: cap && cap.visible }; });
async function expect(S) { const s = await S.state(); return { s, X: H.expected(s, PC.site.analyse(s).footprint, D) }; }
const levelUi = (S) => S.page.evaluate(() => [...document.querySelectorAll('[data-pc="v3-level"] label')].map((l) => { const i = l.querySelector('input'); return { v: i.value, text: l.textContent.trim(), aria: i.getAttribute('aria-label'), checked: i.checked }; }));
const pick = (v) => `css:[data-pc="v3-level"] label:has(input[value="${v}"])`;
// my reset radius and rMax (A-12) for the canvas aspect
function myReset(F, aspect) { const hv = 22.5 * DEG, hh = Math.atan(Math.tan(hv) * aspect), r = Math.max(2.2 * F.R, 1.05 * F.R / Math.sin(Math.min(hv, hh))); return { r, rMax: Math.max(3 * F.R, 1.2 * r) }; }
const poseEq = (a, b, t = 1e-9) => a && b && Math.abs(a.radius - b.radius) <= t && Math.abs(a.theta - b.theta) <= t && Math.abs(a.phi - b.phi) <= t && a.target.every((x, i) => Math.abs(x - b.target[i]) <= t);
const pf = (p) => p ? `t[${p.target.map((x) => x.toFixed(2))}] r${p.radius.toFixed(2)} th${(p.theta / DEG).toFixed(1)} ph${(p.phi / DEG).toFixed(1)}` : 'null';
const pageView = (S) => S.page.evaluate(() => ({ scrollY: Math.round(scrollY), scrollX: Math.round(scrollX), scale: visualViewport ? visualViewport.scale : 1, docScroll: document.scrollingElement.scrollTop }));
// Reset framing: every plot corner (ground) and the footprint at the roof base project inside the canvas
function framing(p, X, aspect) {
  const F = X.F, f = [], pts = F.pL.map((q) => [F.X(q[0]), 0, F.Z(q[1])]), fp = X.fp;
  for (const [u, v] of [[fp.u, fp.v], [fp.u + fp.w, fp.v], [fp.u + fp.w, fp.v + fp.d], [fp.u, fp.v + fp.d]]) pts.push([F.X(u), X.roofBaseY, F.Z(v)]);
  let ext = 0;
  for (const q of pts) { const n = H.project(p, aspect, 45, q); if (!n || Math.abs(n[0]) > 1 || Math.abs(n[1]) > 1) f.push(`point ${q.map((x) => x.toFixed(1))} projects outside (${n && n.map((x) => x.toFixed(2))})`); else ext = Math.max(ext, Math.abs(n[0]), Math.abs(n[1])); }
  if (ext < 0.6) f.push(`plot fills only ${(ext * 100).toFixed(0)} % of the half view`);
  return f;
}
// screenshot of an element -> RGBA pixels (decoded in the page, data: URL, no network)
async function pixels(S, sel) {
  const buf = await S.page.locator(sel).screenshot();
  return S.page.evaluate((b64) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); res({ w: im.width, h: im.height, d: Array.from(x.getImageData(0, 0, im.width, im.height).data) }); }; im.src = 'data:image/png;base64,' + b64; }), buf.toString('base64'));
}
const countNear = (px, rgb, tol = 40) => { let n = 0; for (let i = 0; i < px.d.length; i += 4) if (Math.abs(px.d[i] - rgb[0]) + Math.abs(px.d[i + 1] - rgb[1]) + Math.abs(px.d[i + 2] - rgb[2]) < tol) n++; return n; };
const differ = (a, b) => { if (a.w !== b.w || a.h !== b.h) return true; let n = 0; for (let i = 0; i < a.d.length; i += 4) if (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2]) > 30) n++; return n > 4; };
const TIMES = [], ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);   // --only=A,C: sections by letter (mutation runs)
async function guard(label, fn) { if (ONLY.length && !ONLY.includes(label[0])) return; const t = Date.now(); try { await fn(); } catch (e) { R.check(`${label}: ran to the end`, [String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')]); } TIMES.push(`${label} ${((Date.now() - t) / 1000).toFixed(1)} s`); }

const browser = await launch();

// ================= A + B: acceptance and Q14 with real r128 =================
for (const vp of [VP.desk, VP.phone]) await guard(`A ${vp.tag}`, async () => {
  const S = await session(browser, vp, { three: 'real' }), T = `A ${vp.tag} real`;
  R.check(`${T}: 3D view ready (Building... gone, frame drawn)`, await to5(S) ? [] : ['not ready after 8 s']);
  let i = await info(S), { s, X } = await expect(S);
  const v3 = await S.v3(), ui = await levelUi(S);
  R.check(`${T}: canvas and panel shown, no overlay`, v3.canvas && v3.panel && !v3.building && !v3.unavailable ? [] : [JSON.stringify(v3)]);
  R.check(`${T}: opens on All with the Roof off (UI and scene)`, ui[0] && ui[0].v === 'all' && ui[0].checked && ui.filter((x) => x.checked).length === 1 && i.level === 'all' && !i.roof && !(await S.page.evaluate(() => document.querySelector('[data-pc="v3-roof"]').checked)) ? [] : [JSON.stringify(ui), i.level, i.roof]);
  R.check(`${T}: level options = All + the house's levels lowest first (short label, full aria-label)`, JSON.stringify(ui.map((x) => [x.v, x.text, x.aria])) === JSON.stringify([['all', 'All', 'All floors'], ['G', 'Ground', 'Ground floor'], ['1', 'First', 'First floor']]) ? [] : [JSON.stringify(ui)]);
  R.check(`${T}: scene geometry = my oracle (plot shape, footprint, storeys, rooms = approved plans, tints, stair, Q10 walls)`, cut(H.shellProblems(await world(S), X, D, { level: 'all' })));
  R.check(`${T}: canvas backing store = CSS size x pixel ratio 1`, await S.page.evaluate(() => { const c = document.querySelector('[data-pc="v3-canvas"]'); return c.width === c.clientWidth && c.height === c.clientHeight && PC.debug.scene().renderer.getPixelRatio() === 1; }));
  await S.shot('a-sample');
  if (vp === VP.desk) {
    // exteriors: commit Q10 while open -> rebuild, pose kept, walls in the new colour, the pictures differ
    const pics = {}, f = [];
    for (const ext of ['white', 'terracotta', 'grey', 'sand']) {
      const before = await info(S);
      await S.page.evaluate((e) => PC.store.commit((st) => { st.ans.exterior = e; }), ext); await ready(S);
      const after = await info(S), ex = await expect(S);
      if (after.builds !== before.builds + 1) f.push(`${ext}: builds ${before.builds} -> ${after.builds}`);
      if (!poseEq(before.pose, after.pose)) f.push(`${ext}: pose ${pf(before.pose)} -> ${pf(after.pose)}`);
      f.push(...H.shellProblems(await world(S), ex.X, D).map((p) => `${ext}: ${p}`));
      pics[ext] = await S.page.locator('[data-pc="v3-canvas"]').screenshot();
    }
    const ks = Object.keys(pics); for (let a = 0; a < ks.length; a++) for (let b = a + 1; b < ks.length; b++) if (pics[ks[a]].equals(pics[ks[b]])) f.push(`${ks[a]} and ${ks[b]} render the same picture`);
    R.check(`${T}: four Q10 exteriors: each a rebuild with the pose kept, walls in its colour, four different pictures`, f);
    // edit + approve, then m and ft
    const g = [];
    await S.page.evaluate(() => { PC.store.go(3); PC.store.commit((st) => { const p = st.plans['1'], r = p.rooms.slice().sort((a, b) => a.w * a.h - b.w * b.h)[0]; r.w -= 0.5; p.edited = true; p.approved = true; }); PC.store.go(4); PC.store.go(5); });
    await ready(S); ({ s, X } = await expect(S));
    if (!s.plans['1'].edited || !s.plans['1'].approved) g.push('setup: plan 1 not edited + approved');
    g.push(...H.shellProblems(await world(S), X, D));
    const b0 = (await info(S)).builds, n0 = (await info(S)).renders, w0 = JSON.stringify(await world(S));
    await S.act('css:[data-pc="unit-toggle"] label:has(input[value="ft"])'); await ready(S);
    if ((await S.state()).ans.unit !== 'ft') g.push('unit toggle did not switch to ft');
    if ((await info(S)).builds !== b0) g.push('unit ft rebuilt the scene');
    if ((await info(S)).renders !== n0) g.push(`unit ft drew ${(await info(S)).renders - n0} frame(s) of an unchanged model`);
    if (JSON.stringify(await world(S)) !== w0) g.push('unit ft changed the geometry');
    R.check(`${T}: rooms after an edit + approve = the edited plan; ft (toggle in the header) keeps the same model without a rebuild or a frame`, g);
  }
  // level matrix on B + G + 1 + 2 with lift
  await to5(S, "s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; for (const l of ['B', '2']) s.ans.rooms.push({ id: 'r' + s.ans.nextRoomId++, type: 'storage', level: l, size: 'S', area: null, master: false });");
  ({ X } = await expect(S));
  const ui2 = await levelUi(S), m = [];
  if (ui2.map((x) => x.v).join() !== 'all,B,G,1,2') m.push('options ' + ui2.map((x) => x.v));
  for (const v of ['B', 'G', '1', '2', 'all']) {
    const r0 = (await info(S)).renders;
    await S.act(pick(v)); await ready(S);
    const i2 = await info(S), w = await world(S);
    if (i2.level !== v) m.push(`${v}: scene level ${i2.level}`);
    if (i2.renders !== r0 + 1) m.push(`${v}: ${i2.renders - r0} renders for one change`);
    m.push(...H.shellProblems(w, X, D, { level: v }).map((p) => `${v}: ${p}`));
  }
  R.check(`${T}: level selector matrix on Basement + 3 floors + lift (level k shown iff k <= selected; Basement hides the ground cap and the levels above; roof hidden; one frame per change)`, cut(m));
  // Q14 in 3D (desk only: 5 rebuilds)
  if (vp === VP.desk) {
    const q = [];
    for (const pos of ['fl', 'fr', 'bl', 'br', 'centre']) {
      await to5(S, `s.ans.stairPos = '${pos}'; s.ans.lift = true;`);
      const ex = await expect(S), w = await world(S), fpT = H.tBox(ex.X.F, ex.X.fp, 0, 0);
      if (ex.s.ans.stairPos !== pos) q.push(`${pos}: setup`);
      for (const L of ex.X.levels) { const b = H.coreBoxes(w, L.id, ex.X); q.push(...H.q14Problems(pos, b.stair, b.lift, fpT).map((p) => `${pos} ${L.id}: ${p}`)); }
      q.push(...H.shellProblems(w, ex.X, D).map((p) => `${pos}: ${p}`));
      if (pos === 'fl') await S.shot('b-q14-fl');
    }
    R.check(`B ${vp.tag} real: Q14 seen from the street in the rendered scene for fl / fr / bl / br / centre (stair + lift block in its corner of T on every level, all geometry = my oracle)`, cut(q));
  }
  R.check(`${T}: no THREE.* warnings from r128`, S.log.threeWarnings);
  await S.end(T);
});

// mock: DOM acceptance and the visibility matrix at 360x640
await guard('A mock', async () => {
  const S = await session(browser, VP.phone, { three: 'mock' }), T = 'A 360x640 mock', f = [];
  if (!(await to5(S, "s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; for (const l of ['B', '2']) s.ans.rooms.push({ id: 'r' + s.ans.nextRoomId++, type: 'storage', level: l, size: 'S', area: null, master: false });"))) f.push('not ready');
  const ui = await levelUi(S), i = await info(S);
  if (!ui[0].checked || i.level !== 'all' || i.roof) f.push('not on All with the roof off');
  for (const v of ['B', 'G', '1', '2', 'all']) {
    await S.act(pick(v)); await ready(S);
    const w = await visOnly(S), want = { B: -1, G: 0, 1: 1, 2: 2, all: 9 }[v];
    for (const [n, vis] of w.groups) { if (n.startsWith('level-')) { const k = { 'level-B': -1, 'level-G': 0, 'level-1': 1, 'level-2': 2 }[n]; if (vis !== (k <= want)) f.push(`${v}: ${n} visible ${vis}`); } if (n === 'roof' && vis) f.push(`${v}: roof visible`); }
    if (w.cap !== (v !== 'B')) f.push(`${v}: groundCap ${w.cap}`);
  }
  R.check(`${T}: opens on All, roof off; level matrix (mock scene graph)`, f);
  await S.end(T);
});

// ================= C: gestures =================
async function gestures(vp) {
  const S = await session(browser, vp, { three: 'mock' }), T = `C ${vp.tag}`;
  await to5(S);
  const { X } = await expect(S), F = X.F;
  let i = await info(S); const aspect = i.cw / i.ch, mine = myReset(F, aspect), c = await S.page.evaluate(() => { const r = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect(), p = document.querySelector('[data-pc="v3-panel"]').getBoundingClientRect();
    // the part of the canvas the panel does not cover (panel beside it in landscape, over its foot in portrait)
    const side = p.left > r.left + r.width * 0.3 && p.top < r.top + r.height * 0.5; return { x: r.left, y: r.top, w: r.width, h: r.height, fx: r.left, fy: r.top, fw: side ? p.left - r.left : r.width, fh: side ? r.height : Math.min(r.bottom, p.top) - r.top }; });
  const mid = [c.fx + c.fw / 2, c.fy + c.fh / 2], P = () => info(S).then((x) => x.pose), td = vp.touch ? await touchDriver(S.page) : null;
  // Reset pose and framing at open
  const p0 = i.pose;
  R.check(`${T}: first open = reset pose (target plot centre, theta 30, phi 50, my aspect-aware radius ${mine.r.toFixed(2)})`, p0 && p0.target.every((x) => Math.abs(x) < 1e-9) && Math.abs(p0.theta - 30 * DEG) < 1e-9 && Math.abs(p0.phi - 50 * DEG) < 1e-9 && Math.abs(p0.radius - mine.r) < 1e-6 ? [] : [pf(p0)]);
  R.check(`${T}: reset view frames the whole plot and the house up to the roof base`, framing(p0, X, aspect));
  const f = [];
  const drag = async (a, b, opt = {}) => { if (td) await td.drag(a, b, { steps: 8 }); else { if (opt.shift) await S.page.keyboard.down('Shift'); await S.page.mouse.move(...a); await S.page.mouse.down({ button: opt.button || 'left' }); for (let k = 1; k <= 8; k++) await S.page.mouse.move(a[0] + (b[0] - a[0]) * k / 8, a[1] + (b[1] - a[1]) * k / 8); await S.page.mouse.up({ button: opt.button || 'left' }); if (opt.shift) await S.page.keyboard.up('Shift'); } await S.settle(); };
  // orbit horizontal: theta only; the near side of the model follows the finger (moves right on a right drag)
  let a = await P(); const nearPt = (p) => [p.target[0] + 3 * Math.sin(p.theta), 0, p.target[2] + 3 * Math.cos(p.theta)];
  const sx0 = H.project(a, aspect, 45, nearPt(a));
  await drag(mid, [mid[0] + 60, mid[1]]); let b = await P();
  if (!(Math.abs(b.theta - a.theta) > 1e-3 && Math.abs(b.phi - a.phi) < 1e-9 && b.radius === a.radius && poseEq({ ...a, theta: 0, phi: 0 }, { ...b, theta: 0, phi: 0 }))) f.push(`horizontal orbit ${pf(a)} -> ${pf(b)}`);
  const sx1 = H.project(b, aspect, 45, nearPt(a)); if (!(sx1 && sx0 && sx1[0] > sx0[0])) f.push(`right drag moved the near side of the model ${sx0 && sx1 ? (sx1[0] > sx0[0] ? 'right' : 'left') : '?'}`);
  const rate = Math.abs(b.theta - a.theta) / 60;
  a = b; await drag(mid, [mid[0], mid[1] + 50]); b = await P();
  if (!(Math.abs(b.phi - a.phi) > 1e-3 && Math.abs(b.theta - a.theta) < 1e-9 && b.radius === a.radius)) f.push(`vertical orbit ${pf(a)} -> ${pf(b)}`);
  R.check(`${T}: one ${td ? 'finger' : 'mouse button'} drag orbits (horizontal -> theta only, the near side follows the drag; vertical -> phi only)`, f);
  if (td) {
    const g = [], d0 = 60;
    a = await P(); await td.two([mid[0] - d0 / 2, mid[1]], [mid[0] + d0 / 2, mid[1]], [mid[0] - d0, mid[1]], [mid[0] + d0, mid[1]], { steps: 8 }); await S.settle(); b = await P();
    if (!(Math.abs(b.radius / a.radius - 0.5) < 0.05)) g.push(`pinch out x2: radius ratio ${(b.radius / a.radius).toFixed(3)} (want 0.5)`);
    if (Math.hypot(b.target[0] - a.target[0], b.target[2] - a.target[2]) > 0.2) g.push(`pinch about a fixed midpoint moved the target ${pf(a)} -> ${pf(b)}`);
    a = b; await td.two([mid[0] - d0, mid[1]], [mid[0] + d0, mid[1]], [mid[0] - d0 / 2, mid[1]], [mid[0] + d0 / 2, mid[1]], { steps: 8 }); await S.settle(); b = await P();
    if (!(Math.abs(b.radius / a.radius - 2) < 0.2)) g.push(`pinch in /2: radius ratio ${(b.radius / a.radius).toFixed(3)} (want 2)`);
    R.check(`${T}: pinch zooms by the finger distance ratio (out x2 -> radius / 2, in -> x 2), target kept`, g);
    // two-finger pan: content follows the fingers
    const h = []; a = await P(); const gp = [a.target[0], 0, a.target[2]], s0 = H.project(a, aspect, 45, gp);
    await td.two([mid[0] - 40, mid[1]], [mid[0] + 40, mid[1]], [mid[0] - 40 + 50, mid[1]], [mid[0] + 40 + 50, mid[1]], { steps: 8 }); await S.settle(); b = await P();
    const s1 = H.project(b, aspect, 45, gp), dpx = s1 && s0 ? (s1[0] - s0[0]) / 2 * c.w : 0;
    if (Math.abs(b.radius / a.radius - 1) > 0.02) h.push(`pan changed the radius ${(b.radius / a.radius).toFixed(3)}`);
    if (Math.abs(b.theta - a.theta) > 1e-9 || Math.abs(b.phi - a.phi) > 1e-9) h.push('pan orbited');
    if (!(dpx > 40 && dpx < 60)) h.push(`ground point under the fingers moved ${dpx.toFixed(1)} px for a 50 px pan`);
    R.check(`${T}: two-finger pan: the ground point follows the fingers (~50 px), no zoom or orbit`, h);
    // lift one finger: no jump, the remaining finger orbits from where it is
    const j = [], A0 = [mid[0] - 40, mid[1]], B0 = [mid[0] + 40, mid[1]];
    await td.send('touchStart', [[...A0, 0]]); await S.page.evaluate(() => new Promise((r) => requestAnimationFrame(r))); await td.send('touchStart', [[...A0, 0], [...B0, 1]]);
    for (let k = 1; k <= 6; k++) { await td.send('touchMove', [[A0[0] - 4 * k, A0[1], 0], [B0[0] + 4 * k, B0[1], 1]]); await S.page.evaluate(() => new Promise((r) => requestAnimationFrame(r))); }
    await S.settle(); const pA = await P();
    await td.send('touchEnd', [[A0[0] - 24, A0[1], 0]]); await S.settle(); const pB = await P();
    await td.send('touchMove', [[A0[0] - 24 + 3, A0[1], 0]]); await S.settle(); const pC = await P();
    await td.send('touchEnd', []); await S.settle();
    if (!poseEq(pA, pB, 1e-9)) j.push(`lifting the second finger changed the pose ${pf(pA)} -> ${pf(pB)}`);
    if (Math.abs(pC.theta - pB.theta) > 3 * rate * 1.5 + 1e-9 || pC.radius !== pB.radius) j.push(`first 3 px move after the lift: theta ${((pC.theta - pB.theta) / DEG).toFixed(2)} deg (3 px of orbit = ${(3 * rate / DEG).toFixed(2)}), radius ${pB.radius.toFixed(3)} -> ${pC.radius.toFixed(3)}`);
    R.check(`${T}: lifting one of two fingers: no jump, the other finger continues as a 3 px orbit`, j);
  } else {
    const g = [];
    for (const [lab, opt] of [['right-drag', { button: 'right' }], ['Shift+drag', { shift: true }]]) {
      a = await P(); await drag(mid, [mid[0] + 50, mid[1] + 20], opt); b = await P();
      if (Math.abs(b.theta - a.theta) > 1e-9 || Math.abs(b.phi - a.phi) > 1e-9 || b.radius !== a.radius || poseEq(a, b)) g.push(`${lab}: not a pure pan ${pf(a)} -> ${pf(b)}`);
      const s0 = H.project(a, aspect, 45, [a.target[0], 0, a.target[2]]), s1 = H.project(b, aspect, 45, [a.target[0], 0, a.target[2]]);
      if (!(s0 && s1 && s1[0] > s0[0])) g.push(`${lab}: content did not follow the pointer to the right`);
    }
    R.check(`${T}: right-drag and Shift+drag pan (content follows the pointer), no orbit / zoom; context menu suppressed`, g.concat(await S.page.evaluate(() => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.querySelector('[data-pc="v3-canvas"]').dispatchEvent(e); return e.defaultPrevented ? [] : ['contextmenu not prevented']; })));
    const w = []; a = await P(); await S.page.mouse.move(...mid); await S.page.mouse.wheel(0, 100); await S.settle(); b = await P();
    if (!(b.radius > a.radius * 1.02 && b.theta === a.theta)) w.push(`wheel down: radius ${a.radius.toFixed(2)} -> ${b.radius.toFixed(2)}`);
    a = b; await S.page.mouse.wheel(0, -100); await S.settle(); b = await P(); if (!(b.radius < a.radius)) w.push('wheel up did not zoom in');
    R.check(`${T}: wheel zooms (down = out, up = in), page does not scroll`, w.concat((await pageView(S)).scrollY ? ['page scrolled'] : []));
    await S.page.mouse.click(...mid); await S.settle();
    R.check(`${T}: a click on the model focuses the canvas (so the arrow keys work after it)`, (await S.page.evaluate(() => document.activeElement && document.activeElement.dataset.pc === 'v3-canvas')) ? [] : ['canvas not focused by a click (pointerdown preventDefault also cancels the focus)']);
    // keys: the canvas focused from the keyboard (Tab order: Shift+Tab from Reset view's row is not stable, so focus() as the Tab target would)
    const k = []; await S.page.evaluate(() => document.querySelector('[data-pc="v3-canvas"]').focus()); await S.settle();
    const key = async (name) => { const x = await P(); await S.page.keyboard.press(name); await S.settle(); return [x, await P()]; };
    let [x, y] = await key('ArrowLeft'); const dl = y.theta - x.theta; [x, y] = await key('ArrowRight'); const dr = y.theta - x.theta;
    if (!(Math.abs(Math.abs(dl) - 5 * DEG) < 1e-9 && Math.abs(dl + dr) < 1e-9)) k.push(`ArrowLeft / Right theta ${(dl / DEG).toFixed(3)} / ${(dr / DEG).toFixed(3)} deg`);
    [x, y] = await key('ArrowUp'); const du = y.phi - x.phi; [x, y] = await key('ArrowDown'); const dd = y.phi - x.phi;
    if (!(Math.abs(Math.abs(du) - 5 * DEG) < 1e-9 && Math.abs(du + dd) < 1e-9)) k.push(`ArrowUp / Down phi ${(du / DEG).toFixed(3)} / ${(dd / DEG).toFixed(3)} deg`);
    [x, y] = await key('+'); if (Math.abs(y.radius - x.radius / 1.1) > 1e-9) k.push(`+ radius ${x.radius} -> ${y.radius}`);
    [x, y] = await key('-'); if (Math.abs(y.radius - x.radius * 1.1) > 1e-9) k.push(`- radius ${x.radius} -> ${y.radius}`);
    R.check(`${T}: keys on the focused canvas: arrows orbit 5 deg each way, + / - zoom by 1.1`, k);
  }
  // random run: every pose after every gesture inside the limits
  const rnd = (() => { let s = 1234 + c.w; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
  const bad = []; let n = 0;
  const inC = () => [c.fx + 70 + rnd() * (c.fw - 140), c.fy + 20 + rnd() * (c.fh - 40)];   // two-finger spans of +-60 px stay on the free canvas
  for (let k = 0; k < 20; k++) {
    const op = rnd(), A = inC(), B = [A[0] + (rnd() - 0.5) * 600, A[1] + (rnd() - 0.5) * 600].map((v, ix) => Math.max(ix ? c.fy + 2 : c.fx + 62, Math.min(ix ? c.fy + c.fh - 2 : c.fx + c.fw - 62, v)));
    if (td) { if (op < 0.4) await td.drag(A, B, { steps: 6 }); else if (op < 0.7) { const s = rnd() < 0.5 ? 0.2 : 3; await td.two([A[0] - 30, A[1]], [A[0] + 30, A[1]], [A[0] - 30 * s, A[1]], [A[0] + 30 * s, A[1]], { steps: 6 }); } else await td.two([A[0] - 30, A[1]], [A[0] + 30, A[1]], [B[0] - 30, B[1]], [B[0] + 30, B[1]], { steps: 6 }); }
    else { if (op < 0.35) await drag(A, B); else if (op < 0.55) await drag(A, B, { button: 'right' }); else if (op < 0.8) { await S.page.mouse.move(...A); await S.page.mouse.wheel(0, (rnd() - 0.5) * 2400); } else { await S.page.evaluate(() => document.querySelector('[data-pc="v3-canvas"]').focus()); for (let z = 0; z < 6; z++) await S.page.keyboard.press(['ArrowUp', 'ArrowDown', 'ArrowLeft', '+', '-'][Math.floor(rnd() * 5)]); } }
    await S.settle(); n++;
    bad.push(...H.poseProblems(await P(), F, X.roofBaseY, mine.rMax).map((p) => `op ${k}: ${p}`));
  }
  const pv = await pageView(S);
  R.check(`${T}: ${n} random gestures: phi 5..85, eye >= 1 m, radius 4..rMax ${mine.rMax.toFixed(1)}, target in the plot box and 0..roof base after every one`, cut(bad));
  R.check(`${T}: after all gestures the page is not scrolled or zoomed (scrollY 0, visualViewport.scale 1)`, pv.scrollY === 0 && pv.scrollX === 0 && pv.docScroll === 0 && pv.scale === 1 ? [] : [JSON.stringify(pv)]);
  await S.act('v3-reset'); const pr = await P();
  R.check(`${T}: Reset view after the run: reset pose again and the plot framed`, poseEq(pr, p0, 1e-9) ? framing(pr, X, aspect) : [pf(pr) + ' != ' + pf(p0)]);
  await S.layout(`${T} stage 5 after gestures`);
  await S.end(T);
}
for (const vp of [VP.phone, VP.land, VP.desk]) await guard(`C ${vp.tag}`, () => gestures(vp));

// ================= D: render loop (real r128) =================
await guard('D loop', async () => {
  const S = await session(browser, VP.desk, { three: 'real', init: [RAF] }), T = 'D 1280x800 real';
  await to5(S);
  const idle = async (ms = 600) => { await S.page.evaluate(() => { window.__raf = 0; }); const r0 = (await info(S)).renders; await S.page.waitForTimeout(ms); const i = await info(S); return { raf: i.raf, renders: i.renders - r0 }; };   // the idle span is the thing under test
  let z = await idle(); R.check(`${T}: idle open view: 0 rAF and 0 renders in 600 ms`, z.raf === 0 && z.renders === 0 ? [] : [JSON.stringify(z)]);
  await S.page.mouse.move(640, 300); await S.page.mouse.down(); await S.page.mouse.move(700, 320, { steps: 4 }); await S.page.mouse.up(); await S.settle();
  const pose = (await info(S)).pose, b0 = (await info(S)).builds;
  await S.act('btn-back'); z = await idle();
  const st4 = await S.stages();
  R.check(`${T}: Back to stage 4: stage 4 shown, view inactive, 0 rAF and 0 renders in 600 ms`, st4 === '4' && !(await info(S)).active && z.raf === 0 && z.renders === 0 ? [] : [st4, JSON.stringify(z)]);
  const r1 = (await info(S)).renders; await S.act('btn-next'); await ready(S); let i = await info(S);
  R.check(`${T}: return to stage 5: exactly one frame, no rebuild (same key), pose kept`, i.renders === r1 + 1 && i.builds === b0 && poseEq(i.pose, pose) ? [] : [`renders +${i.renders - r1}, builds ${b0} -> ${i.builds}, ${pf(pose)} -> ${pf(i.pose)}`]);
  // hidden: input while hidden draws nothing; becoming visible draws one frame
  await S.page.evaluate(() => { window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); window.__raf = 0; });
  const r2 = (await info(S)).renders; await S.page.mouse.move(640, 300); await S.page.mouse.wheel(0, 200); await S.page.waitForTimeout(400);
  i = await info(S); const hid = { raf: i.raf, renders: i.renders - r2, radiusChanged: i.pose.radius !== pose.radius };
  await S.page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }); await S.settle(); await S.settle();
  i = await info(S);
  R.check(`${T}: hidden page: a wheel input changes the pose but requests no frame (0 rAF, 0 renders); visible again: exactly one frame`, hid.raf === 0 && hid.renders === 0 && i.renders === r2 + 1 ? [] : [JSON.stringify(hid), `after visible +${i.renders - r2}`]);
  // Q10 through stage 2 (real input) -> rebuild with the pose kept
  const pk = (await info(S)).pose, bq = (await info(S)).builds;
  await S.act('step-2'); await S.act('q-tab-building'); await S.act('css:[data-pc="q-exterior"] label:has(input[value="terracotta"])');
  const ans = (await S.state()).ans; await S.act('step-5'); await ready(S); i = await info(S);
  const { X } = await expect(S);
  R.check(`${T}: Q10 changed in stage 2 (terracotta) and back to 5: one rebuild, pose kept, walls terracotta`, ans.exterior === 'terracotta' && i.builds === bq + 1 && poseEq(i.pose, pk) ? H.shellProblems(await world(S), X, D) : [`exterior ${ans.exterior}, builds ${bq} -> ${i.builds}, ${pf(pk)} -> ${pf(i.pose)}`]);
  z = await idle(); R.check(`${T}: idle after the rebuild: 0 rAF, 0 renders`, z.raf === 0 && z.renders === 0 ? [] : [JSON.stringify(z)]);
  await S.end(T);
});

// ================= E: 3D unavailable =================
for (const [name, vp, opts] of [['aborted three.js', VP.phone, {}], ['mock failRenderer', VP.desk, { three: 'mock', init: [FAIL_MOCK] }], ['real r128, no WebGL', VP.phone, { three: 'real', init: [NO_WEBGL] }]]) await guard(`E ${name}`, async () => {
  const S = await session(browser, vp, opts), T = `E ${vp.tag} ${name}`;
  await to5(S);
  const v = await S.v3(), txt = await S.text('v3-unavailable');
  R.check(`${T}: in-page message shown in view, canvas and panel hidden, no Building...`, v.unavailable && v.unavailableInView && !v.canvas && !v.panel && !v.building ? [] : [JSON.stringify(v)]);
  R.check(`${T}: message says the 3D view is unavailable and the earlier stages still work`, /3D view unavailable/.test(txt) && /earlier stages/.test(txt) ? [] : [txt]);
  await S.layout(`${T} stage 5`);
  const f = [];
  await S.act('btn-back'); if ((await S.stages()) !== '4') f.push('Back -> ' + (await S.stages()));
  for (const n of [3, 2, 1]) { await S.act('step-' + n); if ((await S.stages()) !== String(n)) f.push(`step ${n} -> ${await S.stages()}`); }
  await S.act('step-2'); await S.act('q-tab-building'); await S.act('css:[data-pc="q-exterior"] label:has(input[value="grey"])');
  if ((await S.state()).ans.exterior !== 'grey') f.push('Q10 not changeable in stage 2');
  await S.act('step-5'); if ((await S.stages()) !== '5' || !(await S.v3()).unavailable) f.push('back on 5: message not shown again');
  R.check(`${T}: stages 1-4 usable (Back, stepper 3 / 2 / 1, a stage-2 answer), back on 5 the message again`, f);
  if (name.startsWith('real')) { const e = S.log.errors.filter((x) => /THREE\.WebGLRenderer/.test(x)); if (e.length) R.note(`${T}: r128 itself logs ${JSON.stringify(e[0])} when WebGL cannot start (library message, accepted)`); S.log.errors = S.log.errors.filter((x) => !/THREE\.WebGLRenderer: Error creating WebGL context/.test(x)); }
  await S.end(T);
});

// ================= F: G6 on the maximum house at dpr 3 =================
await guard('F G6', async () => {
  const S = await session(browser, VP.phone, { three: 'real', dpr: 3 }), T = 'F 360x640 dpr 3 real';
  await to5(S, "s.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; s.ans.footprintPct = 40; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.pairs = []; s.ans.rooms = []; let n = 1; for (const l of ['B', 'G', '1', '2']) for (const ty of ['bedroom', 'bedroom', 'bathroom', 'office', 'storage', 'laundry', 'maid', 'bathroom']) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); s.ans.nextRoomId = n;");
  const { s, X } = await expect(S);
  const g = await S.page.evaluate(() => { const i = PC.debug.scene(), c = document.querySelector('[data-pc="v3-canvas"]'); let meshes = 0, casters = 0, lights = 0; const sh = []; i.scene.traverse((o) => { if (o.isMesh) meshes++; if (o.isLight) { lights++; if (o.castShadow) { casters++; sh.push([o.type, o.shadow.mapSize.x, o.shadow.mapSize.y]); } } });
    return { meshes, casters, lights, sh, pr: i.renderer.getPixelRatio(), bw: c.width, cw: c.clientWidth, bh: c.height, chh: c.clientHeight, shadowOn: i.renderer.shadowMap.enabled, dpr: devicePixelRatio }; });
  const f = [];
  if (s.ans.rooms.length !== 32 || X.levels.length !== 4) f.push('setup: not the maximum house');
  f.push(...cut(H.shellProblems(await world(S), X, D)));
  if (g.meshes > 40) f.push(`${g.meshes} meshes`);
  if (g.casters !== 1 || g.sh[0][0] !== 'DirectionalLight' || g.sh[0][1] !== 1024 || g.sh[0][2] !== 1024) f.push(`shadow casters ${JSON.stringify(g.sh)}`);
  if (!(g.dpr === 3 && g.pr === 2 && g.bw === g.cw * 2 && g.bh === g.chh * 2)) f.push(`dpr ${g.dpr}: pixel ratio ${g.pr}, backing ${g.bw}x${g.bh} for ${g.cw}x${g.chh}`);
  R.check(`${T}: maximum house (B + 3 floors + lift, 32 rooms) = my oracle, ${g.meshes} meshes <= 40, one shadow light (sun, 1024 map), pixel ratio capped at 2`, f);
  await S.shot('f-max-dpr3');
  await S.end(T);
});

// ================= G: disabled controls, level labels at 360 px, stage-2 stepper icons =================
await guard('G controls', async () => {
  const S = await session(browser, VP.phone, { three: 'real' }), T = 'G 360x640';
  await to5(S, "s.ans.floors = 3; s.ans.basement = true; for (const l of ['B', '2']) s.ans.rooms.push({ id: 'r' + s.ans.nextRoomId++, type: 'storage', level: l, size: 'S', area: null, master: false });");
  // level labels with 5 options
  const ui = await levelUi(S);
  R.check(`${T}: 5 level options All / Basement / Ground / First / Second with full aria-labels`, JSON.stringify(ui.map((x) => [x.text, x.aria])) === JSON.stringify([['All', 'All floors'], ['Basement', 'Basement'], ['Ground', 'Ground floor'], ['First', 'First floor'], ['Second', 'Second floor']]) ? [] : [JSON.stringify(ui)]);
  R.check(`${T}: every level label on one line, not truncated, inside the viewport`, await S.page.evaluate(() => [...document.querySelectorAll('[data-pc="v3-level"] label')].flatMap((l) => { const t = l.querySelector('.pc-seg__txt'), r = l.getBoundingClientRect(), f = []; if (t.scrollWidth > t.clientWidth + 1) f.push(`${t.textContent} truncated`); const rg = document.createRange(); rg.selectNodeContents(t); const lines = new Set([...rg.getClientRects()].map((x) => Math.round(x.top))); if (lines.size !== 1) f.push(`${t.textContent} on ${lines.size} lines`); if (r.left < 0 || r.right > innerWidth) f.push(`${t.textContent} outside the viewport`); return f; })));
  await S.layout(`${T} View tab, 5 levels`);
  await S.shot('g-view-5levels');
  // disabled set
  const LATER = ['v3-time', 'v3-preset-morning', 'v3-preset-noon', 'v3-preset-evening', 'v3-preset-night', 'v3-season', 'v3-room', 'v3-tour-start', 'v3-tour-pause', 'v3-tour-stop', 'v3-roof'];
  const dis = await S.page.evaluate((L) => ({ hooks: L.filter((h) => !document.querySelector(`[data-pc="${h}"]`).disabled), speed: [...document.querySelectorAll('[data-pc="v3-tour-speed"] input')].filter((i) => !i.disabled).map((i) => i.value),
    live: ['v3-reset', 'v3-panel-toggle', 'v3-tab-view', 'v3-tab-light', 'v3-tab-tour'].filter((h) => document.querySelector(`[data-pc="${h}"]`).disabled) }), LATER);
  R.check(`${T}: later controls disabled (time, 4 presets, season, room finder, tour start / pause / stop, speed radios, Roof); Reset, panel toggle and tabs live`, dis.hooks.length || dis.speed.length || dis.live.length ? [JSON.stringify(dis)] : []);
  // looks disabled: computed styles (TL condition 1) and pixels, disabled vs the same control enabled
  const css = async () => S.page.evaluate(() => { const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), q = (h) => document.querySelector(`[data-pc="${h}"]`), cs = (e) => getComputedStyle(e);
    const toRgb = (hex) => { const d = document.createElement('i'); d.style.color = hex; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    return { sunk: toRgb(v('--sunk')), ink3: toRgb(v('--ink-3')), range: cs(q('v3-time')).cursor, out: cs(q('v3-time-out')).color,
      sel: ['v3-season', 'v3-room'].map((h) => [cs(q(h)).backgroundColor, cs(q(h)).color, cs(q(h)).cursor]), icons: ['v3-preset-morning', 'v3-preset-noon', 'v3-preset-evening', 'v3-preset-night', 'v3-tour-pause', 'v3-tour-stop'].map((h) => cs(q(h).querySelector('.pc-i')).opacity) }; });
  await S.act('v3-tab-light');
  const c1 = await css(), f = [];
  if (c1.range !== 'not-allowed') f.push(`slider cursor ${c1.range}`);
  if (c1.out !== c1.ink3) f.push(`time readout ${c1.out} != --ink-3 ${c1.ink3}`);
  c1.sel.forEach(([bg, co, cu], k) => { if (bg !== c1.sunk || co !== c1.ink3 || cu !== 'not-allowed') f.push(`${['season', 'room'][k]} select ${bg} / ${co} / ${cu}`); });
  if (c1.icons.some((o) => Number(o) > 0.5 + 1e-6)) f.push(`icon opacities ${c1.icons}`);
  // slider thumb pixels: no accent-blue thumb while disabled; enabled (temporarily) it has one
  const thumbDis = await pixels(S, '[data-pc="v3-time"]');
  await S.page.evaluate(() => { document.querySelector('[data-pc="v3-time"]').disabled = false; }); await S.settle({ motion: true });
  const thumbOn = await pixels(S, '[data-pc="v3-time"]');
  await S.page.evaluate(() => { document.querySelector('[data-pc="v3-time"]').disabled = true; }); await S.settle({ motion: true });
  const accent = [0x1b, 0x4f, 0x8f], nOn = countNear(thumbOn, accent), nDis = countNear(thumbDis, accent);
  if (!(nOn > 50 && nDis < 5)) f.push(`accent pixels on the slider: enabled ${nOn}, disabled ${nDis}`);
  R.check(`${T}: disabled Light controls look disabled: slider not-allowed with no accent thumb (pixels), readout --ink-3, selects --sunk / --ink-3 / not-allowed, preset icons <= 0.5 opacity`, f);
  // every disabled control renders differently from the same control enabled
  const g = [];
  for (const [tab, hooks] of [['light', ['v3-preset-morning', 'v3-preset-night', 'v3-season']], ['tour', ['v3-room', 'v3-tour-start', 'v3-tour-pause', 'css:[data-pc="v3-tour-speed"]']], ['view', ['css:.pc-switch:has([data-pc="v3-roof"])']]]) {
    await S.act('v3-tab-' + tab);
    for (const h of hooks) {
      const sel = h.startsWith('css:') ? h.slice(4) : `[data-pc="${h}"]`, set = (on) => S.page.evaluate(([s, on]) => { const e = document.querySelector(s); (e.matches('input,select,button') ? [e] : [...e.querySelectorAll('input')]).forEach((x) => { x.disabled = !on; }); }, [sel, on]);
      const a = await pixels(S, sel); await set(true); await S.settle({ motion: true }); const b = await pixels(S, sel); await set(false); await S.settle({ motion: true });
      if (!differ(a, b)) g.push(`${h} looks the same disabled and enabled`);
    }
    if (tab === 'light' || tab === 'tour') await S.shot(`g-${tab}-disabled`);
  }
  R.check(`${T}: each disabled control (presets, season, room finder, tour start / pause, speed radios, Roof) renders differently from itself enabled`, g);
  // taps on disabled controls do nothing
  await S.act('v3-tab-light');
  const before = await S.page.evaluate(() => [document.querySelector('[data-pc="v3-time"]').value, document.querySelector('[data-pc="v3-time-out"]').textContent]);
  const box = await S.page.evaluate(() => { const r = document.querySelector('[data-pc="v3-time"]').getBoundingClientRect(); return [r.left + r.width * 0.85, r.top + r.height / 2]; });
  await S.page.touchscreen.tap(...box); await S.settle();
  const night = await S.page.evaluate(() => { const r = document.querySelector('[data-pc="v3-preset-night"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await S.page.touchscreen.tap(...night); await S.settle();
  const after = await S.page.evaluate(() => [document.querySelector('[data-pc="v3-time"]').value, document.querySelector('[data-pc="v3-time-out"]').textContent]);
  R.check(`${T}: tapping the disabled slider and the Night preset changes nothing (12 / 12:00)`, JSON.stringify(before) === JSON.stringify(after) && after[0] === '12' && after[1] === '12:00' ? [] : [JSON.stringify([before, after])]);
  await S.layout(`${T} Light tab`); await S.act('v3-tab-tour'); await S.layout(`${T} Tour tab`);
  // stage-2 stepper icons disabled at a limit (generic .pc-btn--icon:disabled rule)
  const h = [];
  await S.act('step-2'); await S.act('q-tab-site');
  await S.page.evaluate(() => PC.store.commit((s) => { s.ans.setbacks.front = 0; s.ans.setbacks.back = 20; }));
  await S.settle({ motion: true });
  const st = await S.page.evaluate(() => ['q-setback-front-dec', 'q-setback-front-inc', 'q-setback-back-inc', 'q-setback-back-dec'].map((k) => { const b = document.querySelector(`[data-pc="${k}"]`), i = b.querySelector('.pc-i'); return [k, b.disabled || b.getAttribute('aria-disabled') === 'true', getComputedStyle(i).opacity, getComputedStyle(b).cursor]; }));
  // The steppers clamp at a limit and are never disabled (q-fields), so the generic .pc-btn--icon:disabled rule does not reach
  // them today; no icon button outside stage 5 is disabled in this state. A forced-disabled stepper is shot for the look.
  if (st.some((x) => x[1])) h.push(`disabled at the limit: ${st.filter((x) => x[1]).map((x) => x[0])}`);
  if (st.some((x) => Number(x[2]) !== 1)) h.push(`icon opacities ${st.map((x) => x[2])}`);
  const others = await S.page.evaluate(() => [...document.querySelectorAll('.pc-btn--icon')].filter((b) => (b.disabled || b.getAttribute('aria-disabled') === 'true') && !b.closest('[data-stage="5"]')).map((b) => b.dataset.pc));
  if (others.length) h.push(`disabled icon buttons outside stage 5: ${others}`);
  await S.act('q-setback-front-dec'); if ((await S.state()).ans.setbacks.front !== 0) h.push('minus at 0 changed the setback');
  R.check(`${T}: stage-2 setback steppers at a limit (front 0, back 20) stay enabled at full icon opacity and clamp; no icon button outside stage 5 is disabled`, h);
  await S.page.evaluate(() => { document.querySelector('[data-pc="q-setback-front-dec"]').disabled = true; }); await S.settle({ motion: true });
  await S.shot('g-stage2-stepper-forced-disabled');
  await S.page.evaluate(() => { document.querySelector('[data-pc="q-setback-front-dec"]').disabled = false; }); await S.settle({ motion: true });
  await S.layout(`${T} stage 2 steppers at a limit`);
  await S.shot('g-stage2-steppers-limit');
  await S.end(T);
});

await browser.close();
R.note(`browser run ${((Date.now() - t0) / 1000).toFixed(1)} s (${TIMES.join(', ')})`);
process.exit(R.done() ? 0 : 1);
