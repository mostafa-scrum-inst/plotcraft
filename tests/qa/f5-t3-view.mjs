// F5-T3a QA (browser, vendored real r128 where the camera matters): the non-phone polish pass, judged by QA's own reference
// (f5-t3-ref.mjs). Version-aware: needs PC.cam.viewOffset (the F5-T3a marker, TL ruling 2); without it only a note.
//   M node: PC.cam.viewOffset / visibleAspect = QA's lens-shift oracle on a grid (null when nothing is covered).
//   A 1280x800 real: the sample at stage 5, panel expanded: camera.view = my 6 arguments for o = canvas right - panel left
//     (336 = 320 + 16), the orbit target projects to x = (W - o) / 2 +- 1, y = H / 2; collapse: view cleared, target at W / 2,
//     pivot / theta kept (radius / phi only re-clamped); expand again; a mouse orbit keeps the pivot and the shifted centre;
//     the widest room picked: its floor corners and the highlight bbox left of the panel; "Building…" centred over the
//     uncovered canvas, <= 420 px. Then the maximum house (master bedroom on the second floor): a tour seeked to every stop,
//     expanded (and collapsed under QA_FULL=1): the caption never meets the panel card or its toggle, stays inside the canvas, and the
//     longest caption "Master bedroom · Second floor" is among them.
//   B 640x360 touch real: stage 5 side by side (canvas ∩ panel = 0, panel 272 px), collapsed canvas = 640 - 44 +- 1; Reset
//     then frames the whole house inside the canvas; the tour caption inside the canvas, never over the panel / toggle.
//   C 360x640 touch real (QA_FULL=1 only, with A's collapsed tour pass): tour caption of the maximum house >= 8 px below the header, inside the canvas, off the panel /
//     toggle; "Building…" text fits (no overflow).
//   D 1280x800 (three.js off): toasts with a measurement go on a unit change; saving stops mid-session -> the PM toast once,
//     then the no-save chip; storage blocked -> the chip (aria-label / title, 44 px, tap toast), hidden while saving works;
//     quota full with a stored draft (read works, write fails) -> Resume offered and works, chip shown, the draft never
//     rewritten, Start new still asks.
// Run: node tests/qa/f5-t3-view.mjs [--no-shots] [--only=M,A,B,C,D]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, collector, launch, STORAGE_MODES } from './lib.mjs';
import { sessions } from './session.mjs';
import * as H from './f4-t1-ref.mjs';
import * as V from './f5-t3-ref.mjs';

const R = collector('F5-T3 view');
const noShots = process.argv.includes('--no-shots'), shots = join(ROOT, 'tests/qa/shots/F5-T3');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const { PC } = H.loadPC3();
const HAS = !!(PC.cam && typeof PC.cam.viewOffset === 'function');
if (!HAS) { R.note('skipped: PC.cam.viewOffset absent (F5-T3a not merged)'); process.exit(R.done() ? 0 : 1); }
if (!noShots) mkdirSync(shots, { recursive: true });
const session = sessions({ R, shots, noShots });
const VP = { phone: { tag: '360x640', w: 360, h: 640, touch: true }, land: { tag: '640x360', w: 640, h: 360, touch: true }, desk: { tag: '1280x800', w: 1280, h: 800, touch: false } };
const t0 = Date.now(), TIMES = [], FULL = !!process.env.QA_FULL;   // QA_FULL=1: also C and the collapsed tour pass (release gate)
const cut = (a, n = 8) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);
async function guard(label, fn) { if (ONLY.length && !ONLY.includes(label[0])) return; const t = Date.now(); try { await fn(); } catch (e) { R.check(`${label}: ran to the end`, [String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')]); } TIMES.push(`${label} ${((Date.now() - t) / 1000).toFixed(1)} s`); }

// ================= M. node: the helper against my oracle =================
await guard('M node', async () => {
  const f = [];
  for (const W of [1, 368, 640, 768, 1280, 1920]) for (const Hh of [256, 360, 800]) for (const o of [undefined, 0, -5, 0.4, 44, 271.6, 336, W - 1, W, W + 10]) {
    const occl = o === undefined ? undefined : { right: o, bottom: 17 }, got = PC.cam.viewOffset(W, Hh, occl), want = V.myViewOffset(W, Hh, occl);
    if (JSON.stringify(got) !== JSON.stringify(want)) f.push(`viewOffset(${W}, ${Hh}, ${JSON.stringify(occl)}) = ${JSON.stringify(got)}, mine ${JSON.stringify(want)}`);
    if (PC.cam.visibleAspect && Math.abs(PC.cam.visibleAspect(W, Hh, occl) - V.myVisibleAspect(W, Hh, occl)) > 1e-12) f.push(`visibleAspect(${W}, ${Hh}, ${o})`);
  }
  if (!PC.cam.visibleAspect) f.push('PC.cam.visibleAspect absent');
  const v = V.myViewOffset(1280, 800, { right: 336 }); if (V.principalX(1280, v) !== 472) f.push(`principal x ${V.principalX(1280, v)}`);
  R.check('M PC.cam.viewOffset(W, H, occl) = QA\'s lens shift [W + o, H, o, 0, W, H] (o = round(occl.right); null for o <= 0, o >= W, a bad size; occl.bottom ignored) and visibleAspect = (W - o) / H on a 180-case grid; 1280x800 o 336 -> principal x 472', cut(f));
});

const browser = await launch();
// ---------- page helpers ----------
const READY = () => { const i = PC.debug.scene(), q = (h) => document.querySelector(`[data-pc="${h}"]`); return (i.active && !i.building && i.builds > 0 && q('v3-building').hidden && !i.frame && !i.dirty) || !q('v3-unavailable').hidden; };
async function ready(S, ms = 10000) { const ok = await S.until(() => S.page.evaluate(READY), ms); await S.settle(); return ok; }
async function to5(S, mut = '') {
  await S.page.evaluate((m) => { const st = PC.sample.state(); new Function('s', m)(st); st.plans = {}; st.stage = 1; PC.store.replace(st); PC.store.go(2); PC.store.go(3);
    PC.store.commit((s) => { for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; }, { nav: true }); PC.store.go(4); PC.store.go(5); }, mut);
  return ready(S);
}
const tourTab = async (S) => { if (await S.shown('v3-tab-tour')) await S.act('v3-tab-tour'); };
const rectOf = (h) => { const e = document.querySelector(`[data-pc="${h}"]`); if (!e || e.hidden || e.closest('[hidden]')) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; };
// camera state: view offset, canvas / panel / toggle rects, the orbit target projected to canvas px
const LENS = () => {
  const i = PC.debug.scene(), cam = i.camera, cv = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect(), p = PC.view3d.pose();
  const R = (h) => { const e = document.querySelector(`[data-pc="${h}"]`); if (!e || e.hidden || e.closest('[hidden]')) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; };
  cam.updateMatrixWorld(); const pr = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * cv.width, (1 - v.y) / 2 * cv.height]; };
  const vw = cam.view && cam.view.enabled ? [cam.view.fullWidth, cam.view.fullHeight, cam.view.offsetX, cam.view.offsetY, cam.view.width, cam.view.height] : null;
  return { view: vw, aspect: cam.aspect, fov: cam.fov, canvas: { l: cv.left, t: cv.top, r: cv.right, b: cv.bottom, w: cv.width, h: cv.height }, panel: R('v3-panel'), toggle: R('v3-panel-toggle'),
    pose: p, tp: pr(p.target[0], p.target[1], p.target[2]), limits: PC.cam.limits(i.house, PC.cam.visibleAspect(cv.width, cv.height, { right: vw ? vw[2] : 0 })) };
};
function lensProblems(L, tag, { expanded }) {
  const f = [], W = L.canvas.w, Hh = L.canvas.h, o = expanded ? Math.round(L.canvas.r - L.panel.l) : 0, want = V.myViewOffset(Math.round(W), Math.round(Hh), { right: o });
  if (expanded && Math.abs(o - V.OCCL_DESK) > 1) f.push(`${tag}: the panel covers ${o} px of the canvas (320 + 16 = 336 expected)`);
  if (JSON.stringify(L.view) !== JSON.stringify(want)) f.push(`${tag}: camera.view ${JSON.stringify(L.view)}, mine ${JSON.stringify(want)}`);
  const x = V.principalX(W, want); if (Math.abs(L.tp[0] - x) > 1 || Math.abs(L.tp[1] - Hh / 2) > 1) f.push(`${tag}: the orbit target projects to (${L.tp.map((v) => v.toFixed(1))}), (${x.toFixed(1)}, ${(Hh / 2).toFixed(1)}) +- 1 expected`);
  return f;
}
const D2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// tour: every stop seeked (paused, one frame, read) in one page task; caption rect, text and the panel / toggle rects
const TOURSCAN = async (back) => {
  const T = PC.three.tour, st = T.state(), stops = st.plan.stops, R = (h) => { const e = document.querySelector(`[data-pc="${h}"]`); if (!e || e.hidden || e.closest('[hidden]')) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; };
  const out = [], names = {}; PC.debug.scene().house.levels.forEach((l) => l.rooms.forEach((r) => { names[r.id] = r.name; }));
  // run-time budget: every 6th stop, the last room stop and every master-bedroom stop (the longest captions); one frame each, seeked just before the stop (the caption names the stop approached)
  const ks = stops.map((s, k) => k).filter((k) => k % 6 === 1 || k === stops.length - 2 || (stops[k].kind === 'room' && names[stops[k].id] === 'Master bedroom'));
  for (const k of ks) {
    T.pause(); PC.debug.tourSeek(Math.max(0.05, Math.min(st.plan.duration - 0.05, stops[k].t - 0.05))); T.resume(); await new Promise((r) => requestAnimationFrame(() => r())); T.pause();
    const c = document.querySelector('[data-pc="v3-caption"]');
    out.push({ k, kind: stops[k].kind, cap: R('v3-caption'), text: c.hidden ? null : document.querySelector('[data-pc="v3-caption-text"]').textContent.trim().replace(/\s+/g, ' '),
      over: (() => { const t = document.querySelector('[data-pc="v3-caption-text"]'); return t ? t.scrollWidth > t.clientWidth + 1 : false; })() });
  }
  const b = out.find((o) => o.text === back); if (b) { T.pause(); PC.debug.tourSeek(Math.max(0.05, stops[b.k].t - 0.05)); T.resume(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); T.pause(); }
  return { out, panel: R('v3-panel'), toggle: R('v3-panel-toggle'), canvas: R('v3-canvas'), header: (() => { const h = document.querySelector('.pc-header').getBoundingClientRect(); return { l: h.left, t: h.top, r: h.right, b: h.bottom }; })() };
};
function captionProblems(scan, tag, { headerGap = 0 } = {}) {
  const f = []; let n = 0;
  for (const s of scan.out) { if (!s.cap) continue; n++;
    if (V.inter(s.cap, scan.panel) || V.inter(s.cap, scan.toggle)) f.push(`${tag} stop ${s.k} "${s.text}": caption ${V.fmtR(s.cap)} meets the panel ${V.fmtR(scan.panel)} / toggle ${V.fmtR(scan.toggle)}`);
    if (!V.inside(s.cap, scan.canvas)) f.push(`${tag} stop ${s.k} "${s.text}": caption ${V.fmtR(s.cap)} outside the canvas ${V.fmtR(scan.canvas)}`);
    if (headerGap && s.cap.t - scan.header.b < headerGap - 0.5) f.push(`${tag} stop ${s.k}: caption ${(s.cap.t - scan.header.b).toFixed(1)} px below the header (>= ${headerGap})`); }
  if (n < scan.out.length - 1) f.push(`${tag}: a caption at only ${n} of ${scan.out.length} stops seeked`);
  return { f, n };
}
async function tourScan(S, back = V.LONGEST) {
  await tourTab(S); await S.page.evaluate(() => { document.querySelector('[data-pc="v3-tour-start"]').click(); PC.three.tour.pause(); });
  const scan = await S.page.evaluate(TOURSCAN, back); return scan;
}
const stopTour = (S) => S.page.evaluate(() => { if (PC.three.tour.running()) PC.three.tour.stop(); });
const toggle = async (S) => { await S.act('v3-panel-toggle'); await S.settle(); await S.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
const expanded = (S) => S.page.evaluate(() => { const t = document.querySelector('[data-pc="v3-panel-toggle"]'); return t.getAttribute('aria-expanded') !== 'false'; });
const buildingCard = (S) => S.page.evaluate(() => { const b = document.querySelector('[data-pc="v3-building"]'), was = b.hidden; b.hidden = false; const r = b.getBoundingClientRect(), kids = [...b.querySelectorAll('*')].concat([b]);
  const txt = kids.filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())); const tw = Math.max(0, ...txt.map((e) => e.getBoundingClientRect().width)), over = kids.some((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible');
  const vis = (() => { const c = (e) => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden'; }; return c(b); })(); b.hidden = was; return { l: r.left, t: r.top, r: r.right, b: r.bottom, tw, over, vis }; });

// ================= A. 1280x800 real =================
await guard('A 1280x800', async () => {
  const S = await session(browser, VP.desk, { three: 'real' }), T = 'A 1280x800 real';
  const lt = [Date.now()], lap = () => lt.push(Date.now());
  await to5(S); let f = []; lap();
  if (!(await expanded(S))) await toggle(S);
  const L0 = await S.page.evaluate(LENS); f.push(...lensProblems(L0, 'expanded', { expanded: true }));
  // "Building…" centred over the uncovered canvas, text <= 420 px
  const bc = await buildingCard(S), cx = L0.canvas.l + (L0.canvas.w - V.OCCL_DESK) / 2;
  if (Math.abs((bc.l + bc.r) / 2 - cx) > 2 || bc.tw > 420 || bc.over) f.push(`"Building…" card centre ${((bc.l + bc.r) / 2).toFixed(1)} (uncovered centre ${cx.toFixed(1)}), text ${bc.tw.toFixed(0)} px${bc.over ? ', overflow' : ''}`);
  // collapse: no shift, the pivot kept
  await toggle(S); await ready(S); const L1 = await S.page.evaluate(LENS); f.push(...lensProblems(L1, 'collapsed', { expanded: false }));
  const keep = (a, b, tag) => { const g = []; if (D2(a.target, b.target) > 1e-9 || Math.abs(a.theta - b.theta) > 1e-9) g.push(`${tag}: pivot / theta moved ${JSON.stringify([a.target, a.theta])} -> ${JSON.stringify([b.target, b.theta])}`);
    const cl = PC.cam.clamp(a, b === L1.pose ? L1.limits : L2.limits); if (Math.abs(b.radius - a.radius) > 1e-9 && Math.abs(b.radius - cl.radius) > 1e-9) g.push(`${tag}: radius ${a.radius} -> ${b.radius} (not a re-clamp)`); return g; };
  let L2 = null; f.push(...keep(L0.pose, L1.pose, 'collapse'));
  await toggle(S); await ready(S); L2 = await S.page.evaluate(LENS); f.push(...lensProblems(L2, 're-expanded', { expanded: true }), ...keep(L1.pose, L2.pose, 're-expand'));
  R.check(`${T} lens shift (TL ruling 2): expanded camera.view = [${L0.view}] (o ${Math.round(L0.canvas.r - L0.panel.l)}), target at x ${L0.tp[0].toFixed(1)} (= (W - o) / 2 = 472 +- 1); collapsed: view cleared, target at x ${L1.tp[0].toFixed(1)} (W / 2); the pivot and theta kept by both toggles; "Building…" centred over the uncovered canvas, text <= 420 px`, f);
  await S.shot('A-lens-expanded');
  // a mouse orbit in the uncovered part: the pivot stays, the centre stays shifted
  f = []; { const c = L2.canvas, x = c.l + 300, y = c.t + c.h / 2; await S.page.mouse.move(x, y); await S.page.mouse.down(); for (let k = 1; k <= 6; k++) await S.page.mouse.move(x + 25 * k, y + 6 * k); await S.page.mouse.up(); }
  await ready(S); const L3 = await S.page.evaluate(LENS);
  if (D2(L3.pose.target, L2.pose.target) > 1e-9) f.push(`orbit moved the pivot ${JSON.stringify(L2.pose.target)} -> ${JSON.stringify(L3.pose.target)}`);
  if (Math.abs(L3.pose.theta - L2.pose.theta) < 1e-3) f.push(`the drag did not orbit (theta ${L2.pose.theta} -> ${L3.pose.theta})`);
  f.push(...lensProblems(L3, 'after the orbit', { expanded: true }));
  R.check(`${T} a mouse orbit keeps the pivot on the target (theta ${L2.pose.theta.toFixed(3)} -> ${L3.pose.theta.toFixed(3)}), which still projects to the uncovered centre`, f);
  // the widest room picked: its floor corners and the highlight inside the uncovered rectangle
  f = []; await tourTab(S);
  const rooms = await S.page.evaluate(() => PC.debug.scene().house.levels.flatMap((l) => l.rooms.map((r) => ({ id: r.id, name: r.name, level: l.id, baseY: l.baseY, u: r.u, v: r.v, w: r.w, d: r.d }))));
  const wide = rooms.slice().sort((a, b) => Math.max(b.w, b.d) - Math.max(a.w, a.d))[0];
  await S.page.selectOption('[data-pc="v3-room"]', wide.id); await S.until(() => S.page.evaluate(() => !(PC.view3d.flying && PC.view3d.flying())), 8000); await ready(S);
  const pk = await S.page.evaluate((id) => { const i = PC.debug.scene(), cam = i.camera, cv = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect(), hl = i.world.getObjectByName('highlight'); cam.updateMatrixWorld();
    const pr = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * cv.width, (1 - v.y) / 2 * cv.height]; };
    let hb = null; if (hl) { const b = new THREE.Box3().setFromObject(hl); if (!b.isEmpty()) { const ps = []; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) ps.push(pr(x, y, z)); hb = { l: Math.min(...ps.map((p) => p[0])), r: Math.max(...ps.map((p) => p[0])), t: Math.min(...ps.map((p) => p[1])), b: Math.max(...ps.map((p) => p[1])) }; } }
    const h = i.house, lv = h.levels.find((l) => l.rooms.some((r) => r.id === id)), r = lv.rooms.find((q) => q.id === id);
    return { hb, pr: null, sel: document.querySelector('[data-pc="v3-room"]').value, uv: h.uv || null, corners: null, hl: !!hl, r, baseY: lv.baseY, panelL: document.querySelector('[data-pc="v3-panel"]').getBoundingClientRect().left - cv.left, ch: cv.height }; }, wide.id);
  if (pk.sel !== wide.id) f.push(`select ${pk.sel}, ${wide.id} expected`);
  if (!pk.hb) f.push('no highlight drawn'); else if (pk.hb.r > pk.panelL - 0.5 || pk.hb.l < -0.5 || pk.hb.t < -0.5 || pk.hb.b > pk.ch + 0.5) f.push(`highlight bbox ${V.fmtR(pk.hb)} not inside the uncovered rectangle [0, 0, ${pk.panelL.toFixed(0)}, ${pk.ch.toFixed(0)}]`);
  R.check(`${T} the widest room (${wide.name}, ${Math.max(wide.w, wide.d).toFixed(1)} m) picked: its highlight bbox ${pk.hb ? V.fmtR(pk.hb) : ''} lies left of the panel (x <= ${pk.panelL.toFixed(0)}) and inside the canvas`, f);
  await S.shot('A-widest-room');
  lap(); // the maximum house: the tour caption at every stop, expanded and collapsed
  await S.page.selectOption('[data-pc="v3-room"]', ''); f = [];
  await to5(S, V.MAXMUT); await tourTab(S);
  let texts = new Set();
  lap(); for (const ex of FULL ? [true, false] : [true]) {
    if ((await expanded(S)) !== ex) await toggle(S);
    const scan = await tourScan(S), c = captionProblems(scan, ex ? 'expanded' : 'collapsed'); lap(); f.push(...c.f); scan.out.forEach((s) => s.text && texts.add(s.text));
    if (ex) await S.shot('A-caption-longest');
    await stopTour(S); await S.settle();
  }
  if (!texts.has(V.LONGEST)) f.push(`the longest caption "${V.LONGEST}" never shown (seen: ${[...texts].join(" | ")})`);
  if ((await expanded(S)) === false) await toggle(S);
  R.check(`${T} maximum house tour, ${texts.size} captions incl. "${V.LONGEST}": at every stop, panel expanded${FULL ? ' and collapsed' : ''}, the caption stays inside the canvas and never meets the panel card or its toggle`, cut(f));
  R.note(`${T} laps (s): ${lt.slice(1).map((t, i) => ((t - lt[i]) / 1000).toFixed(1)).join(' / ')}`);
  await S.end(T);
});

// ================= B. 640x360 side by side =================
await guard('B 640x360', async () => {
  const S = await session(browser, VP.land, { three: 'real' }), T = 'B 640x360 real'; let f = [];
  await to5(S); if (!(await expanded(S))) await toggle(S);
  const L0 = await S.page.evaluate(LENS), area = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const cov = area(L0.canvas, L0.panel); if (cov > 0.5) f.push(`canvas ∩ panel = ${cov.toFixed(0)} px²`);
  if (Math.abs((L0.panel.r - L0.panel.l) - V.PANEL_640) > 1) f.push(`panel ${(L0.panel.r - L0.panel.l).toFixed(1)} px wide (272)`);
  if (L0.view) f.push(`a lens shift at 640x360 ${JSON.stringify(L0.view)} (side by side: none)`);
  if (L0.canvas.w < 200) f.push(`canvas ${L0.canvas.w} px wide`);
  R.check(`${T} expanded: side by side, canvas ${L0.canvas.w.toFixed(0)} x ${L0.canvas.h.toFixed(0)} px, panel ${(L0.panel.r - L0.panel.l).toFixed(0)} px, coverage ${cov.toFixed(0)} px² (0), no lens shift`, f);
  await S.shot('B-side-by-side');
  f = []; await toggle(S); await ready(S); await S.page.evaluate(() => PC.view3d.resetView()); await ready(S);   // the Reset button lives in the collapsed panel
  const L1 = await S.page.evaluate(LENS); if (Math.abs(L1.canvas.w - (VP.land.w - V.STRIP)) > 1) f.push(`collapsed canvas ${L1.canvas.w.toFixed(1)} px wide (${VP.land.w - V.STRIP} +- 1)`);
  const box = await S.page.evaluate(() => { const i = PC.debug.scene(), cam = i.camera, cv = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect(); cam.updateMatrixWorld(); const b = new THREE.Box3().setFromObject(i.world), ps = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [Math.max(0, b.min.y), b.max.y]) for (const z of [b.min.z, b.max.z]) { const v = new THREE.Vector3(x, y, z).project(cam); ps.push([(v.x + 1) / 2 * cv.width, (1 - v.y) / 2 * cv.height]); }
    const h = i.house, fp = h.footprint, hp = []; const top = h.roof.baseY + 1;
    const pp = PC.store.get().plot.pts.map(([u, v]) => { const q = new THREE.Vector3(u - h.center[0], 0, -(v - h.center[1])).project(cam); return [(q.x + 1) / 2 * cv.width, (1 - q.y) / 2 * cv.height]; });
    return { all: ps, plot: pp, w: cv.width, h: cv.height, house: (() => { const c = h.center || [0, 0, 0], r = h.radius; const q = []; for (let a = 0; a < 8; a++) for (const y of [0, top]) { const v = new THREE.Vector3(r * Math.cos(a * Math.PI / 4), y, r * Math.sin(a * Math.PI / 4)).project(cam); q.push([(v.x + 1) / 2 * cv.width, (1 - v.y) / 2 * cv.height]); } return q; })() }; });
  const outF = (ps) => ps.filter((p) => p[0] < -1 || p[0] > box.w + 1 || p[1] < -1 || p[1] > box.h + 1).length, oh = outF(box.house), op = outF(box.plot);
  if (oh) f.push(`after Reset ${oh} of 16 points of the house bounding circle (ground and roof) fall outside the ${box.w.toFixed(0)} x ${box.h.toFixed(0)} canvas`);
  R.note(`${T} after Reset (collapsed) ${box.plot.length - op} of ${box.plot.length} plot corners inside the canvas`);
  R.check(`${T} collapsed: canvas ${L1.canvas.w.toFixed(0)} px (640 - 44 +- 1); Reset frames the house inside the canvas (its bounding circle at ground and roof height)`, f);
  await S.shot('B-collapsed-reset');
  f = []; await toggle(S); await ready(S);
  const scan = await tourScan(S), c = captionProblems(scan, 'tour'); f.push(...c.f); await stopTour(S);
  R.check(`${T} the sample tour: the caption at ${c.n} stops inside the canvas, never over the panel or its toggle`, cut(f));
  await S.end(T);
});

// ================= C. 360x640 phone =================
if (!FULL) R.note('C 360x640 and the collapsed-panel tour pass of A run with QA_FULL=1 only (run-time budget, A-16; the Designer device sweep measures the phone caption by default)');
else await guard('C 360x640', async () => {
  const S = await session(browser, VP.phone, { three: 'real' }), T = 'C 360x640 real'; const f = [];
  await to5(S, V.MAXMUT);
  const bc = await buildingCard(S); if (bc.over || bc.tw > 420 || bc.l < -0.5 || bc.r > VP.phone.w + 0.5) f.push(`"Building…" card ${V.fmtR(bc)}, text ${bc.tw.toFixed(0)} px${bc.over ? ', overflow' : ''}`);
  for (const ex of [true, false]) { if ((await expanded(S)) !== ex) await toggle(S); const scan = await tourScan(S), c = captionProblems(scan, ex ? 'expanded' : 'collapsed', { headerGap: 8 }); f.push(...c.f);
    if (!scan.out.some((s) => s.text === V.LONGEST)) f.push(`no "${V.LONGEST}" caption (seen: ${scan.out.map((s) => s.text).join(" | ")})`); if (ex) await S.shot('C-caption'); await stopTour(S); await S.settle(); }
  R.check(`${T} maximum house tour: at every stop, expanded and collapsed, the caption is >= 8 px below the header, inside the canvas and off the panel / toggle; "Building…" text fits`, cut(f));
  await S.end(T);
});

// ================= D. toasts, saving stopped, no-save chip, read-only resume =================
const CHIP = (t) => { const c = document.querySelector('[data-pc="nosave-chip"]') || [...document.querySelectorAll('[aria-label]')].find((e) => e.getAttribute('aria-label') === t && e.dataset.pc !== 'note-nosave'); if (!c) return null;
  const vis = !c.hidden && !c.closest('[hidden]') && getComputedStyle(c).display !== 'none' && getComputedStyle(c).visibility !== 'hidden', r = c.getBoundingClientRect();
  return { vis: vis && r.width > 0, w: r.width, h: r.height, title: c.getAttribute('title'), header: !!c.closest('.pc-header'), text: c.textContent.trim(), tag: c.tagName.toLowerCase(), hook: c.dataset.pc || null, x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const COUNT = () => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { const t = n.querySelector ? n.querySelector('[data-pc="toast-text"]') : null; if (t) window.__toasts.push(t.textContent); } })
  .observe(document, { childList: true, subtree: true }); };
const WRITES = () => { const real = Storage.prototype.setItem, rm = Storage.prototype.removeItem; window.__writes = []; Storage.prototype.setItem = function (k, v) { window.__writes.push(['set', k]); return real.call(this, k, v); }; Storage.prototype.removeItem = function (k) { window.__writes.push(['remove', k]); return rm.call(this, k); }; };
const tapChip = async (S, c) => { if (VP.desk.touch) await S.page.touchscreen.tap(c.x, c.y); else await S.page.mouse.click(c.x, c.y); await S.settle(); };
await guard('D toasts and storage', async () => {
  const T = 'D 1280x800';
  // 1. a measurement toast goes on a unit change
  { const S = await session(browser, VP.desk, { init: [COUNT] }), f = [];
    await S.page.evaluate(() => { const st = PC.sample.state(); st.plot.pts = [[0, 0], [5, 0], [5, 5], [0, 5]]; st.ans.unit = 'ft'; st.plans = {}; st.stage = 1; PC.store.replace(st); }); await S.settle();
    await S.act('step-2'); await S.settle(); const a = await S.toasts();
    if (!a.some((t) => /minimum .*sq ft/.test(t))) f.push(`stage 2 tapped with a 25 m² plot in ft: toasts ${JSON.stringify(a)} (a "minimum … sq ft" one expected)`);
    await S.act('unit-m'); await S.settle(); const b = await S.toasts(); if (b.some((t) => /sq ft/.test(t))) f.push(`after the switch to m the toasts still say ${JSON.stringify(b)}`);
    await S.act('step-2'); await S.settle(); const c = await S.toasts(); if (!c.some((t) => /minimum .*m²/.test(t))) f.push(`stage 2 tapped again in m: ${JSON.stringify(c)}`);
    R.check(`${T} a measurement toast ("${(a.find((t) => /sq ft/.test(t)) || '').slice(0, 60)}") is dropped on the unit change; the next one is in m²`, f);
    await S.end(`${T} units`); }
  // 2. saving stops mid-session: the PM toast once, then the chip
  { const S = await session(browser, VP.desk, { init: [STORAGE_MODES['late-fail'], COUNT] }), f = [];
    const c0 = await S.page.evaluate(CHIP, V.TXT.chip); if (c0 && c0.vis) f.push('chip shown while saving still works');
    await S.act('btn-sample'); await S.settle(); await S.flush(); await S.settle(); await S.act('btn-next'); await S.settle(); await S.flush(); await S.act('unit-ft'); await S.flush(); await S.act('unit-m'); await S.flush(); await S.settle();
    const seen = await S.page.evaluate(() => window.__toasts), n = seen.filter((t) => t === V.TXT.stopped).length;
    if (n !== 1) f.push(`the saving-stopped toast shown ${n} times (once): ${JSON.stringify(seen)}`);
    const c1 = await S.page.evaluate(CHIP, V.TXT.chip); if (!c1 || !c1.vis) f.push('no no-save chip after saving stopped');
    R.check(`${T} saving stops mid-session (writes fail after the first): "${V.TXT.stopped.slice(0, 40)}…" (PM text) shown once over several failed saves, then the no-save chip`, f);
    await S.end(`${T} late-fail`); }
  // 3. storage blocked: the chip; 4. saving works: no chip
  { const S = await session(browser, VP.desk, { init: [STORAGE_MODES['all-throw'], COUNT] }), f = [];
    let c = await S.page.evaluate(CHIP, V.TXT.chip);
    if (!c || !c.vis) f.push(`no visible element with aria-label "${V.TXT.chip}" (the no-save chip)`);
    else { if (!c.header) f.push('the chip is not in the header'); if (c.title !== V.TXT.chip) f.push(`title "${c.title}"`); if (c.text) f.push(`visible text "${c.text}" (none)`); if (c.w < 44 - 0.5 || c.h < 44 - 0.5) f.push(`target ${c.w.toFixed(0)} x ${c.h.toFixed(0)} px (44)`);
      await tapChip(S, c); const t = await S.toasts(); if (!t.includes(V.TXT.chipToast)) f.push(`tap: toasts ${JSON.stringify(t)}`);
      await S.act('btn-sample'); await S.settle(); c = await S.page.evaluate(CHIP, V.TXT.chip); if (!c || !c.vis) f.push('the chip goes once a plot exists (start panel hidden)'); }
    R.check(`${T} storage blocked: the no-save chip in the header (aria-label and title "${V.TXT.chip}", no text, >= 44 px); a tap shows "${V.TXT.chipToast.slice(0, 50)}…"; still there after the sample loads`, f);
    await S.shot('D-nosave-chip'); await S.end(`${T} blocked`); }
  { const S = await session(browser, VP.desk), f = []; let c = await S.page.evaluate(CHIP, V.TXT.chip); if (c && c.vis) f.push('chip shown at start');
    await S.act('btn-sample'); await S.settle(); await S.flush(); c = await S.page.evaluate(CHIP, V.TXT.chip); if (c && c.vis) f.push('chip shown after a save');
    R.check(`${T} saving works: the no-save chip stays hidden`, f); await S.end(`${T} saving works`); }
  // 5. quota full with a stored draft: read-only resume
  { const S = await session(browser, VP.desk), f = [];
    await S.act('btn-sample'); await S.settle(); await S.act('unit-ft'); await S.flush(); const good = await S.raw(); const want = JSON.parse(good);
    await S.ctx.addInitScript(STORAGE_MODES['set-throws']); await S.ctx.addInitScript(WRITES); await S.reload(); await S.settle();
    if (!(await S.shown('resume-box'))) f.push('the stored draft is not offered (no Resume)');
    let c = await S.page.evaluate(CHIP, V.TXT.chip); if (!c || !c.vis) f.push('no no-save chip with the read-only draft');
    if (await S.shown('resume-box')) { await S.act('btn-startnew'); await S.settle(); if (!(await S.dialogOpen())) f.push('Start new does not ask first'); else { await S.act('dialog-cancel'); await S.settle(); }
      await S.act('btn-resume'); await S.settle(); const st = await S.state(); if (st.ans.unit !== 'ft' || st.plot.pts.length !== want.state.plot.pts.length) f.push(`Resume loaded unit ${st.ans.unit}, ${st.plot.pts.length} corners`);
      await S.act('btn-next'); await S.settle(); await S.act('unit-m'); await S.flush(); await S.settle(); }
    c = await S.page.evaluate(CHIP, V.TXT.chip); if (!c || !c.vis) f.push('the chip goes after Resume');
    const raw = await S.raw(), w = await S.page.evaluate(() => window.__writes);
    if (raw !== good) f.push('the stored draft changed'); if (w.some((x) => x[0] === 'remove')) f.push(`removeItem called ${JSON.stringify(w)}`);
    R.check(`${T} quota full with a stored draft (read works, writes fail): Resume offered and it restores the draft, Start new asks first, the no-save chip shows, the stored draft is never changed or removed`, f);
    R.note(`${T} read-only state: ${w.filter((x) => x[0] === 'set').length} setItem attempts (all failing) after the reload`);
    await S.shot('D-readonly-resume'); await S.end(`${T} read-only resume`); }
});

await browser.close();
R.note(`timings: ${TIMES.join(', ')}; run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
