// F1-T3 QA: plot drawing, measurements, vertex editing (F1-S1..S3, R2, R4) through real touch / mouse input.
// Run: node tests/qa/f1-t3-plot.mjs [--no-shots] [--only=360x640]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VIEWPORTS, launch, collector, STORAGE_MODES, CANVAS_SPY, touchDriver } from './lib.mjs';
import { sessions, KEY, sleep, eq, sel, defaultProblems } from './session.mjs';

const SHOTS = join(ROOT, 'tests/qa/shots/F1-T3'); mkdirSync(SHOTS, { recursive: true });
const noShots = process.argv.includes('--no-shots');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const R = collector('F1-T3 plot');
const base = sessions({ R, shots: SHOTS, noShots });
const MAIN = VIEWPORTS.filter((v) => v.tag !== '640x360' && (!only || v.tag === only));
const LAND = VIEWPORTS.find((v) => v.tag === '640x360');
// A-16 trim (F3-T3 first item, docs/03-tasks/F3-T3/qa-trim.md): sections A-G run at 360x640 (touch) and 1280x800 (mouse)
// only. Their 768x1024 twin is tests/e2e/plot.spec.mjs (drawing, gesturesAndUnits, ftDrawing, draftsAndGuard run at
// 768x1024 touch); the same behaviours by touch stay here at 360x640. O, L and N keep 768x1024 (their e2e twins,
// noFlip and borderLabels, were removed from plot.spec instead; N is the only Fit-view check with a 640x360 run).
const MAIN_AG = MAIN.filter((v) => v.tag !== '768x1024');
const FT = 0.3048;
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const samePts = (a, b, tol = 1e-6) => a.length === b.length && a.every((p, i) => near(p[0], b[i][0], tol) && near(p[1], b[i][1], tol));
// independent geometry (shoelace etc.), not PC.geom
const area = (p) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
const perim = (p) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + Math.hypot(b[0] - a[0], b[1] - a[1]); }, 0);
const fmtLen = (m, u) => (u === 'ft' ? (m / FT).toFixed(1) + ' ft' : m.toFixed(1) + ' m');
const fmtArea = (m2, u) => (u === 'ft' ? Math.round(m2 / (FT * FT)) + ' sq ft' : Math.round(m2) + ' m²');

// ---- plot invariants, checked after EVERY tap, drag and button press of this suite (independent of PC.plot) ----
const orient = (a, b, c) => { const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return Math.abs(v) < 1e-9 ? 0 : Math.sign(v); };
const onSeg = (a, b, p) => orient(a, b, p) === 0 && p[0] >= Math.min(a[0], b[0]) - 1e-9 && p[0] <= Math.max(a[0], b[0]) + 1e-9 && p[1] >= Math.min(a[1], b[1]) - 1e-9 && p[1] <= Math.max(a[1], b[1]) + 1e-9;
const segsMeet = (a, b, c, d) => { const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b); if (o1 !== o2 && o3 !== o4) return true; return onSeg(a, b, c) || onSeg(a, b, d) || onSeg(c, d, a) || onSeg(c, d, b); };
function plotInvariants(st, legacy = false) {   // legacy: a pre-F1-T3 draft may be closed with streetEdge null (TL ruling)
  const f = [], p = st.plot.pts, n = p.length, closed = st.plot.closed, se = st.ans.streetEdge;
  if (n > 12) f.push(`${n} corners`);
  for (const q of p) if (!(q.length === 2 && q.every((v) => typeof v === 'number' && isFinite(v) && v >= -1e-9 && v <= 100 + 1e-9))) f.push('corner outside 0..100: ' + JSON.stringify(q));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (near(p[i][0], p[j][0], 1e-9) && near(p[i][1], p[j][1], 1e-9)) f.push(`corners ${i} and ${j} coincide`);
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) { const a = p[i], b = p[(i + 1) % n], c = p[j], d = p[(j + 1) % n]; const nb = j === i + 1 || (closed && i === 0 && j === m - 1);
    if (!nb) { if (segsMeet(a, b, c, d)) f.push(`edges ${i} and ${j} cross or touch`); }
    else { const far1 = j === i + 1 ? a : b, far2 = j === i + 1 ? d : c; if (j === i + 1 ? (onSeg(c, d, far1) || onSeg(a, b, far2)) : (onSeg(c, d, far1) || onSeg(a, b, far2))) f.push(`neighbouring edges ${i} and ${j} fold back`); } }
  if (closed) { if (n < 3) f.push('closed with under 3 corners'); if (!(area(p) > 1e-9)) f.push(`closed plot is not counter-clockwise (signed area ${area(p).toFixed(3)})`); if (!(legacy && se === null) && !(Number.isInteger(se) && se >= 0 && se < n)) f.push('closed plot without a valid street edge: ' + se); }
  else if (se !== null) f.push('open outline with a street edge: ' + se);
  if (st.stage >= 2 && !(closed && Math.abs(area(p)) >= 50 - 1e-9)) f.push(`stage ${st.stage} with an invalid plot`);
  if (st.sampleClean && !samePts(p, [[0, 0], [20, 0], [20, 30], [8, 30], [0, 26]], 0)) f.push('sampleClean with a changed plot');
  return f;
}

// Session with canvas helpers. Input: touchscreen / CDP touch on touch viewports, mouse otherwise.
// F3-T1 (PC.layout): Resume runs the plan sync, which generates a Draft plan for every plan level that has none, so a
// resumed state may carry plans the saved draft did not. Plans are compared apart: every one must match its level's signature.
const noPlans = (st) => ({ ...st, plans: {} });
const plansOk = (page) => page.evaluate(() => { const st = PC.debug.state(); return Object.keys(st.plans).every((id) => st.plans[id].sig === PC.sig.level(st, id)); });
async function plotSession(browser, vp, opts = {}) {
  const s = await base(browser, vp, { ...opts, init: [CANVAS_SPY, ...(opts.init || [])] });
  const page = s.page; s.touch = vp.touch ? await touchDriver(page) : null;
  s.scr = (x, y) => page.evaluate(([x, y]) => PC.debug.toScreen('plot', x, y), [x, y]);
  s.view = () => page.evaluate(() => PC.debug.view('plot'));
  s.canvasBox = () => page.evaluate(() => { const r = document.querySelector('[data-pc="plot-canvas"]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  s.onCanvas = (p) => page.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return !!h && h.getAttribute('data-pc') === 'plot-canvas'; }, p);
  // The canvas has taken its new size after a viewport change (ResizeObserver ran, bitmap matches the CSS size).
  s.resized = async (w) => { const ok = await s.until(() => page.evaluate((w) => { const c = document.querySelector('[data-pc="plot-canvas"]'), v = PC.debug.view('plot'); return innerWidth === w && c.clientWidth > 0 && v.width === c.clientWidth && v.height === c.clientHeight && c.width === Math.round(c.clientWidth * Math.min(devicePixelRatio, 2)); }, w), 5000); await s.settle(); return ok; };
  s.raf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  s.frame = async () => { await s.raf(); return page.evaluate(() => __spy.frame('plot-canvas')); };
  s.texts = async () => (await s.frame()).texts.map((t) => t.text);
  s.pts = async () => (await s.state()).plot.pts;
  s.tapAt = async (p) => { if (vp.touch) await page.touchscreen.tap(p[0], p[1]); else await page.mouse.click(p[0], p[1]); await s.settle(); };
  // Tap a world point. It must be on the canvas and not covered by anything.
  s.tapW = async (x, y) => { const p = await s.scr(x, y); if (!(await s.onCanvas(p))) throw new Error(`tapW(${x},${y}): screen point ${p.map(Math.round)} is not on the free canvas`); await s.tapAt(p); };
  s.draw = async (pts) => { for (const [x, y] of pts) await s.tapW(x, y); };
  // Make world points visible with a margin (keyboard zoom-out / arrows on the focused canvas are allowed controls).
  s.reveal = async (pts, margin = 30) => { await page.focus(sel('plot-canvas')); for (let i = 0; i < 12; i++) { const c = await s.canvasBox(); let ok = true; for (const [x, y] of pts) { const p = await s.scr(x, y); if (p[0] < c.x + margin || p[0] > c.x + c.w - margin || p[1] < c.y + margin + 30 || p[1] > c.y + c.h - margin) ok = false; } if (ok) return true; await page.keyboard.press('-'); await s.settle(); } return false; };
  // One-pointer drag in screen coordinates; whileDown runs before release.
  s.dragScr = async (a, b, whileDown) => { if (vp.touch) await s.touch.drag(a, b, { whileDown }); else { await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(a[0] + (b[0] - a[0]) * i / 8, a[1] + (b[1] - a[1]) * i / 8); await s.settle(); if (whileDown) await whileDown(); await page.mouse.up(); } await s.settle(); };
  s.dragW = async (from, to, whileDown) => s.dragScr(await s.scr(...from), await s.scr(...to), whileDown);
  s.msg = () => page.evaluate(() => { const m = document.querySelector('[data-pc="plot-msg"]'); return { text: m.textContent.trim(), kind: m.getAttribute('data-kind') }; });
  s.readout = () => page.evaluate(() => Object.fromEntries(['plot-area', 'plot-perimeter', 'plot-points', 'plot-scale'].map((h) => [h.slice(5), document.querySelector(`[data-pc="${h}"]`).textContent.trim()])));
  s.btn = () => page.evaluate(() => Object.fromEntries(['btn-undo', 'btn-clear', 'btn-close-shape', 'btn-next'].map((h) => [h.slice(4), !document.querySelector(`[data-pc="${h}"]`).disabled])));
  s.noScroll = () => page.evaluate(() => (scrollX || scrollY || (window.visualViewport && Math.abs(visualViewport.scale - 1) > 1e-3) || document.querySelector('[data-pc="app"]').scrollTop || document.querySelector('[data-pc="stage-container"]').scrollTop) ? [`scroll ${scrollX},${scrollY} zoom ${window.visualViewport && visualViewport.scale}`] : []);
  // Labels of the last frame as rectangles (from the recorded fillText calls), with overlap / clipping problems.
  s.labelProblems = async () => { const f = await s.frame(), c = await s.canvasBox(), pr = []; const rects = f.texts.map((t) => ({ text: t.text, x: t.x - t.w / 2, y: t.y - 8, w: t.w, h: 16 }));
    for (let i = 0; i < rects.length; i++) { const a = rects[i]; if (a.x < 0 || a.y < 0 || a.x + a.w > c.w || a.y + a.h > c.h) pr.push(`label "${a.text}" leaves the canvas`); for (let j = i + 1; j < rects.length; j++) { const b = rects[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) pr.push(`labels "${a.text}" and "${b.text}" overlap`); } }
    const chip = await page.evaluate(() => { const e = document.querySelector('.pc-plot__scale'), r = e.getBoundingClientRect(), cv = document.querySelector('[data-pc="plot-canvas"]').getBoundingClientRect(); return { x: r.left - cv.left, y: r.top - cv.top, w: r.width, h: r.height }; });
    for (const a of rects) if (a.x < chip.x + chip.w && chip.x < a.x + a.w && a.y < chip.y + chip.h && chip.y < a.y + a.h) pr.push(`label "${a.text}" is under the scale chip`);
    const fitb = await page.evaluate(() => { const e = document.querySelector('[data-pc="plot-fit"]'); if (!e || e.closest('[hidden]')) return null; const r = e.getBoundingClientRect(), cv = document.querySelector('[data-pc="plot-canvas"]').getBoundingClientRect(); return { x: r.left - cv.left, y: r.top - cv.top, w: r.width, h: r.height }; });
    if (fitb) for (const a of rects) if (a.x < fitb.x + fitb.w && fitb.x < a.x + a.w && a.y < fitb.y + fitb.h && fitb.y < a.y + a.h) pr.push(`label "${a.text}" is under the Fit view button`);
    for (const t of f.texts) if (!/^600 12px (ui-monospace|"?SF Mono)/.test(t.font) && !/12px/.test(t.font)) pr.push(`label "${t.text}" font ${t.font}`);
    return pr; };
  // A canvas point at least 45 px from every corner handle and from the overlays (safe start for a pan).
  s.freeSpot = async () => { const c = await s.canvasBox(), pts = await s.pts(), scr = []; for (const p of pts) scr.push(await s.scr(...p)); for (const fy of [0.55, 0.4, 0.7, 0.3, 0.8]) for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) { const q = [c.x + c.w * fx, c.y + c.h * fy]; if (scr.every((k) => Math.hypot(k[0] - q[0], k[1] - q[1]) > 45) && (await s.onCanvas(q))) return q; } throw new Error('no free spot on the canvas'); };
  // Every edge of pts (world, closed or open) must have its own label with the right text, close to the edge.
  s.edgeLabelProblems = async (pts, closed, u, minPx = 0) => { const f = await s.frame(), c = await s.canvasBox(), pr = [], used = new Set(); const n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) { const a = pts[i], b = pts[(i + 1) % n], want = fmtLen(Math.hypot(b[0] - a[0], b[1] - a[1]), u); const A = await s.scr(...a), B = await s.scr(...b); const ax = A[0] - c.x, ay = A[1] - c.y, bx = B[0] - c.x, by = B[1] - c.y;
      const dist = (t) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((t.x - ax) * dx + (t.y - ay) * dy) / L)); return Math.hypot(t.x - (ax + k * dx), t.y - (ay + k * dy)); };
      let best = -1, bd = 1e9; f.texts.forEach((t, j) => { if (used.has(j) || t.text !== want) return; const d = dist(t); if (d < bd) { bd = d; best = j; } });
      if (best < 0) { if (Math.hypot(bx - ax, by - ay) >= minPx) pr.push(`edge ${i} (${want}) has no label`); } else if (bd > 48) pr.push(`edge ${i} (${want}): nearest matching label is ${Math.round(bd)} px away`); else used.add(best); }
    return pr; };
  // Invariant hook: wrap every input helper. A violation is reported once per operation, with the operation named.
  s.ops = 0; const guard = (name, fn) => async (...a) => { const r = await fn(...a); s.ops++; const bad = plotInvariants(await s.state(), s.legacy); if (bad.length) R.check(`${vp.tag} invariant after ${name}(${JSON.stringify(a).slice(0, 60)})`, bad); return r; };
  // F3-T1: the sample loads with generated Draft plans. This suite is about drawing and editing the outline, not plans, so
  // after Load sample the plans are dropped (navigation commit, sampleClean kept) and edits behave as before F3-T1.
  { const act0 = s.act; s.act = async (h) => { await act0(h); if (s.keepPlans) return; await page.evaluate(() => { const st = PC.debug.state(); if (typeof PC.layout === 'object' && st.sampleClean && st.stage < 3 && Object.keys(st.plans).length && document.querySelector('[data-pc="dialog-layer"]').hidden) PC.store.commit((d) => { d.plans = {}; }, { nav: true }); }); }; }
  for (const k of ['act', 'tapAt', 'dragScr']) s[k] = guard(k, s[k]);
  // End of scenario: the state must still be a draft that resumes (a state the app let the user reach must never be
  // discarded on reload), then the usual clean-log check.
  const end0 = s.end; s.end = async (label, { resume = true } = {}) => {
    const pre = await s.state(), usable = await page.evaluate(() => PC.ui.storage.available && !PC.store.session.draftPending);
    R.check(`${label}: plot invariants hold at the end (${s.ops} operations checked)`, plotInvariants(pre, s.legacy));
    if (resume && usable && pre.plot.pts.length && !opts.init) {
      await s.flush(); await page.reload(); await s.settle(); const offered = await s.shown('resume-box');
      if (offered) await s.act('btn-resume');
      await s.settle(); const post = await s.state();
      R.check(`${label}: the final state survives a reload (draft offered and resumed exactly)`, offered && eq(noPlans(post), noPlans(pre)) && (await plansOk(page)) ? [] : [offered ? 'resumed state differs' : `draft was DISCARDED on reload: ${JSON.stringify(pre.plot)}`]);
    }
    return end0(label);
  };
  return s;
}
const RECT = [[0, 0], [20, 0], [20, 30], [0, 30]];
const SAMPLE = [[0, 0], [20, 0], [20, 30], [8, 30], [0, 26]];
const count = (arr, v) => arr.filter((x) => x === v).length;

const browser = await launch();
try {
  for (const vp of MAIN_AG) {
    const V = vp.tag;

    // ============ A. draw and close a 20 x 30 m plot; measurements in m and ft (F1-S1, F1-S2, R4) ============
    { const s = await plotSession(browser, vp);
      R.check(`${V} A empty: Close/Undo/Clear disabled, hint shown, readouts empty`, eq(await s.btn(), { undo: false, clear: false, 'close-shape': false, next: false }) && (await s.msg()).text === 'Place at least 3 points, then close the shape.' && eq([(await s.readout()).area, (await s.readout()).points], ['–', '0']) ? [] : [JSON.stringify([await s.btn(), await s.msg(), await s.readout()])]);
      R.check(`${V} A all four corners can be brought into view`, await s.reveal(RECT));
      await s.tapW(0, 0);
      R.check(`${V} A first tap places a snapped point; start panel hides; Undo/Clear enable`, samePts(await s.pts(), [[0, 0]]) && !(await s.shown('start-panel')) && (await s.btn()).undo && (await s.btn()).clear && !(await s.btn())['close-shape'] ? [] : [JSON.stringify(await s.pts())]);
      await s.reveal(RECT);
      // a tap a little off the lattice snaps to 0.5 m
      const off = await s.scr(20.2, 0.15); await s.tapAt(off);
      R.check(`${V} A a tap near (20.2, 0.15) snaps to (20, 0)`, samePts(await s.pts(), [[0, 0], [20, 0]]) ? [] : [JSON.stringify(await s.pts())]);
      R.check(`${V} A the vertex is drawn where it was tapped (within the snap distance)`, await (async () => { const f = await s.frame(), c = await s.canvasBox(), v = await s.view(); const hit = f.arcs.some((a) => Math.hypot(a.x + c.x - off[0], a.y + c.y - off[1]) <= 0.5 * v.scale + 1); return hit ? [] : ['no handle near the tap: ' + JSON.stringify(f.arcs.slice(0, 4))]; })());
      R.check(`${V} A open edge shows its length while drawing`, (await s.texts()).includes('20.0 m') ? [] : [JSON.stringify(await s.texts())]);
      R.check(`${V} A two points: Close shape disabled with the hint`, !(await s.btn())['close-shape'] && (await s.msg()).text === 'Place at least 3 points, then close the shape.' && (await s.readout()).points === '2');
      await s.tapW(20, 0); R.check(`${V} A a tap on the previous point is ignored (no zero-length edge, no message)`, (await s.pts()).length === 2 && (await s.msg()).kind === 'info');
      await s.tapW(20, 30); await s.tapW(0, 30);
      R.check(`${V} A four points: Close enabled, hint changes, still open, Next disabled`, (await s.btn())['close-shape'] && !(await s.btn()).next && (await s.state()).plot.closed === false && /first point|Close shape/.test((await s.msg()).text) ? [] : [JSON.stringify(await s.msg())]);
      await s.shot('A-open-4pts');
      await s.tapW(0, 0); await s.settle();
      const st = await s.state();
      R.check(`${V} A tap on the first vertex closes the shape; points stored exactly, counter-clockwise`, st.plot.closed && samePts(st.plot.pts, RECT) && area(st.plot.pts) > 0 ? [] : [JSON.stringify(st.plot)]);
      R.check(`${V} A street edge stored on close = bottom edge (index 0)`, st.ans.streetEdge === 0 ? [] : ['streetEdge ' + st.ans.streetEdge]);
      let ro = await s.readout(), tx = await s.texts();
      R.check(`${V} A metres: readouts 600 m² / 100.0 m / 4 points`, eq([ro.area, ro.perimeter, ro.points], ['600 m²', '100.0 m', '4']) ? [] : [JSON.stringify(ro)]);
      R.check(`${V} A metres: canvas labels are 20.0 m / 30.0 m / 600 m² and nothing else`, count(tx, '600 m²') === 1 && tx.every((t) => ['20.0 m', '30.0 m', '600 m²'].includes(t)) && count(tx, '20.0 m') <= 2 && count(tx, '30.0 m') <= 2 && tx.length >= 3 ? [] : [JSON.stringify(tx)]);
      R.check(`${V} A metres: labels do not overlap, stay on the canvas and clear of the scale chip`, await s.labelProblems());
      R.check(`${V} A closed: message ok, Next enabled, step 2 unlocked, Close disabled`, (await s.msg()).kind === 'ok' && (await s.btn()).next && !(await s.btn())['close-shape'] && (await s.steps()) === (await s.page.evaluate(() => typeof PC.layout === 'object') ? 'CaaLL' : 'CaLLL') ? [] : [JSON.stringify(await s.msg()) + (await s.steps())]);
      await s.layout(`${V} A closed plot (m)`); await s.shot('A-rect-m');
      await s.act('unit-ft'); await s.settle(); ro = await s.readout(); tx = await s.texts();
      R.check(`${V} A feet: readouts 6458 sq ft / 328.1 ft`, eq([ro.area, ro.perimeter], ['6458 sq ft', '328.1 ft']) ? [] : [JSON.stringify(ro)]);
      R.check(`${V} A feet: canvas labels are 65.6 ft / 98.4 ft / 6458 sq ft and nothing else`, count(tx, '6458 sq ft') === 1 && tx.every((t) => ['65.6 ft', '98.4 ft', '6458 sq ft'].includes(t)) && tx.length >= 3 ? [] : [JSON.stringify(tx)]);
      R.check(`${V} A feet: no label in metres left anywhere`, tx.concat(Object.values(ro)).filter((t) => / m$| m²$/.test(t)));
      R.check(`${V} A feet: stored vertices did not move`, samePts((await s.state()).plot.pts, RECT, 0) ? [] : [JSON.stringify((await s.state()).plot.pts)]);
      R.check(`${V} A feet: labels do not overlap`, await s.labelProblems());
      R.check(`${V} A feet: grid readout "Snap 1 ft" (snap step only, F2-T2 rider), scale chip in ft`, (await s.text('plot-grid')) === 'Snap 1 ft' && /^1 square = \d+ ft$/.test(ro.scale) ? [] : [ro.scale + ' / ' + await s.text('plot-grid')]);
      await s.layout(`${V} A closed plot (ft)`); await s.shot('A-rect-ft');
      await s.act('unit-m'); R.check(`${V} A back to metres: 600 m² again, grid readout "Snap 0.5 m"`, (await s.readout()).area === '600 m²' && (await s.text('plot-grid')) === 'Snap 0.5 m');
      // a tap on a closed plot adds nothing
      await s.tapW(10, 15); R.check(`${V} A a tap on a closed plot changes nothing`, samePts((await s.state()).plot.pts, RECT, 0));
      // Next / Back keeps it
      await s.act('btn-next'); await s.act('btn-back'); await s.settle();
      R.check(`${V} A stage 2 and back: plot, view and labels are as before`, samePts((await s.state()).plot.pts, RECT, 0) && count(await s.texts(), '600 m²') === 1);
      await s.end(`${V} A`); }

    // ============ B. close by button; clockwise input; Undo (also reopening); Clear (F1-S1) ============
    { const s = await plotSession(browser, vp); const CW = [[4, 4], [4, 16], [18, 16], [18, 4]];
      await s.reveal(CW); await s.draw(CW.slice(0, 3));
      R.check(`${V} B three points: Close shape enabled`, (await s.btn())['close-shape']);
      await s.tapW(18, 4); await s.act('btn-close-shape'); await s.settle(); let st = await s.state();
      R.check(`${V} B Close shape button closes; clockwise input is stored counter-clockwise with the first point kept`, st.plot.closed && area(st.plot.pts) > 0 && samePts(st.plot.pts, [[4, 4], [18, 4], [18, 16], [4, 16]]) ? [] : [JSON.stringify(st.plot)]);
      R.check(`${V} B street edge = the bottom edge after normalising`, st.ans.streetEdge === 0 ? [] : ['streetEdge ' + st.ans.streetEdge]);
      R.check(`${V} B readouts 168 m², 52.0 m`, eq([(await s.readout()).area, (await s.readout()).perimeter], ['168 m²', '52.0 m']));
      await s.act('btn-undo'); await s.settle(); st = await s.state();
      R.check(`${V} B Undo on a closed plot reopens it in the drawn order, street edge cleared, readouts empty`, !st.plot.closed && samePts(st.plot.pts, CW) && st.ans.streetEdge === null && (await s.readout()).area === '–' && !(await s.btn()).next ? [] : [JSON.stringify(st.plot)]);
      await s.act('btn-undo'); R.check(`${V} B Undo removes the last point`, samePts(await s.pts(), CW.slice(0, 3)));
      await s.act('btn-undo'); await s.act('btn-undo'); R.check(`${V} B two more Undo: one point left, Close disabled`, (await s.pts()).length === 1 && !(await s.btn())['close-shape']);
      await s.page.focus(sel('plot-canvas')); await s.page.keyboard.press('Backspace'); await s.settle();
      R.check(`${V} B Backspace on the focused canvas = Undo; empty again, Undo/Clear disabled, start panel back`, (await s.pts()).length === 0 && !(await s.btn()).undo && !(await s.btn()).clear && (await s.shown('start-panel')) ? [] : [JSON.stringify(await s.btn())]);
      for (const k of ['Enter', 'Space']) await s.page.keyboard.press(k); R.check(`${V} B Enter / Space on the canvas place nothing (keyboard drawing is out of scope)`, (await s.pts()).length === 0);
      // Clear on an open outline: no question
      await s.reveal(CW); await s.draw(CW.slice(0, 2)); await s.act('btn-clear'); await s.settle();
      R.check(`${V} B Clear on an open outline clears at once`, !(await s.dialogOpen()) && (await s.pts()).length === 0);
      // Clear on a closed plot: in-page confirmation
      await s.reveal(CW); await s.draw(CW); await s.act('btn-close-shape'); await s.settle(); const closed = await s.state();
      await s.act('btn-clear'); await s.settle();
      R.check(`${V} B Clear on a closed plot asks in-page`, (await s.dialogOpen()) && (await s.text('dialog-title')) === 'Clear the plot?' && (await s.text('dialog-ok')) === 'Clear' ? [] : ['no dialog']);
      R.check(`${V} B Clear on a plot without plans: no floor-plans sentence (R5, PM round 6)`, !/floor plan/i.test(await s.text('dialog-text')) ? [] : [await s.text('dialog-text')]);
      await s.layout(`${V} B clear dialog`, { dialog: true }); await s.shot('B-clear-dialog');
      await s.act('dialog-cancel'); await s.settle(); R.check(`${V} B Cancel keeps the plot`, eq(await s.state(), closed));
      await s.act('btn-clear'); await s.settle(); await s.page.keyboard.press('Escape'); await s.settle(); R.check(`${V} B Esc keeps the plot`, eq(await s.state(), closed));
      await s.act('btn-clear'); await s.settle(); await s.act('dialog-ok'); await s.settle(); st = await s.state();
      R.check(`${V} B OK clears: no points, open, street edge null, Next disabled`, st.plot.pts.length === 0 && !st.plot.closed && st.ans.streetEdge === null && !(await s.btn()).next ? [] : [JSON.stringify(st.plot)]);
      // redraw a different shape: street edge is the default of the new shape
      const TRI = [[6, 14], [16, 4], [20, 16]]; await s.reveal(TRI); await s.draw(TRI); await s.act('btn-close-shape'); await s.settle(); st = await s.state();
      const exp = (() => { const p = st.plot.pts; let b = 0, by = 1e9; p.forEach((a, i) => { const c = p[(i + 1) % p.length], y = (a[1] + c[1]) / 2; if (y < by - 1e-9) { by = y; b = i; } }); return b; })();
      R.check(`${V} B cleared and redrawn: street edge is the new default (lowest edge midpoint)`, st.plot.closed && st.ans.streetEdge === exp ? [] : [`streetEdge ${st.ans.streetEdge}, expected ${exp}`]);
      await s.end(`${V} B`); }
    // F3-T2 (marker MAX_BUILT >= 5; PM round 6): Clear names the plans at risk, and only what they have (here: an approval)
    if (await (async () => { const t = await plotSession(browser, vp); const on = await t.page.evaluate(() => PC.stages.MAX_BUILT >= 5); await t.ctx.close(); return on; })()) {
      const s = await plotSession(browser, vp); await s.act('btn-sample'); await s.settle();
      await s.page.evaluate(() => { PC.store.commit((d) => { d.stage = 3; }, { nav: true }); PC.store.commit((d) => { PC.plans.sync(d); }, { nav: true }); PC.store.commit((d) => { d.plans.G.approved = true; d.stage = 1; }, { nav: true }); });
      await s.settle(); s.keepPlans = true; // this branch is about plans: the wrapper must not drop them
      const before = await s.state(); await s.act('btn-clear'); await s.settle();
      R.check(`${V} B Clear with an approved Ground floor: one dialog naming it: "The floor plan of the Ground floor will be regenerated, with its approval."`, (await s.dialogOpen()) && (await s.text('dialog-text')).includes('The floor plan of the Ground floor will be regenerated, with its approval.') && !/First floor/.test(await s.text('dialog-text')) ? [] : [await s.text('dialog-text')]);
      await s.act('dialog-cancel'); await s.settle(); { const after = await s.state(), open = await s.dialogOpen(); R.check(`${V} B Cancel keeps plot and plans`, eq(after, before) && !open ? [] : [open ? 'dialog still open' : `state changed: ${Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k])).map((k) => `${k} ${JSON.stringify(before[k]).slice(0, 120)} -> ${JSON.stringify(after[k]).slice(0, 120)}`).join('; ')}`]); }
      await s.end(`${V} B clear with plans`, { resume: false }); }

    // ============ C. refusals: crossing, closing across, old vertex, 13th point, outside, too small (F1-S1) ============
    { const s = await plotSession(browser, vp);
      const Z = [[2, 2], [12, 2], [12, 12]]; await s.reveal([[2, 2], [14, 14], [-1.5, 5]]); await s.draw(Z);
      await s.tapW(6, 0); let m = await s.msg();
      R.check(`${V} C a vertex whose edge would cross is rejected with an inline message`, samePts(await s.pts(), Z) && m.kind === 'warn' && m.text === 'That edge would cross the outline.' ? [] : [JSON.stringify(m)]);
      await s.tapW(2, 2 + 0); // first vertex: closes a valid triangle? (2,2),(12,2),(12,12) is fine -> use other cases below
      await s.act('btn-undo'); await s.settle();
      await s.tapW(12, 2); m = await s.msg();
      R.check(`${V} C a tap on an older vertex (not the first) is refused as touching the outline`, samePts(await s.pts(), Z) && m.kind === 'warn' ? [] : [JSON.stringify([await s.pts(), m])]);
      await s.tapW(7, 7); R.check(`${V} C a valid point clears the message`, (await s.pts()).length === 4 && (await s.msg()).kind === 'info');
      await s.act('btn-clear'); await s.settle();
      // closing edge crosses: (2,2) (12,2) (4,10) (10,10)
      const BOW = [[2, 2], [12, 2], [4, 10], [10, 10]]; await s.draw(BOW);
      await s.tapW(2, 2); await s.settle(); m = await s.msg();
      R.check(`${V} C closing on the first vertex across the outline is refused`, !(await s.state()).plot.closed && samePts(await s.pts(), BOW) && m.kind === 'warn' && /cross/.test(m.text) ? [] : [JSON.stringify(m)]);
      await s.act('btn-undo'); await s.tapW(10, 10); await s.act('btn-close-shape'); await s.settle(); m = await s.msg();
      R.check(`${V} C Close shape across the outline is refused too`, !(await s.state()).plot.closed && m.kind === 'warn' && /cross/.test(m.text) ? [] : [JSON.stringify(m)]);
      await s.layout(`${V} C refusal message`); await s.shot('C-cross-refused');
      await s.act('btn-clear'); await s.settle();
      // three points on one line cannot be closed
      await s.draw([[2, 2], [8, 2], [14, 2]]); await s.act('btn-close-shape'); await s.settle();
      R.check(`${V} C three points on one line cannot be closed`, !(await s.state()).plot.closed && (await s.msg()).kind === 'warn');
      await s.act('btn-clear'); await s.settle();
      // outside the 100 x 100 m area
      await s.tapW(-1.5, 5); m = await s.msg();
      R.check(`${V} C a point outside the drawing area is refused (m wording)`, (await s.pts()).length === 0 && m.kind === 'warn' && m.text === 'Outside the 100 × 100 m drawing area.' ? [] : [JSON.stringify(m)]);
      await s.act('unit-ft'); await s.settle(); R.check(`${V} C the same message follows the unit (ft wording)`, (await s.msg()).text === 'Outside the 328.1 × 328.1 ft drawing area.' ? [] : [(await s.msg()).text]);
      await s.act('unit-m');
      await s.tapW(-0.2, 5); R.check(`${V} C a tap just outside the border (inside half a snap step) snaps onto the border`, samePts(await s.pts(), [[0, 5]]) ? [] : [JSON.stringify(await s.pts())]);
      await s.act('btn-clear'); await s.settle();
      // 12 corners, 13th refused, then close
      const P12 = [[10, 2], [16, 2], [22, 4], [26, 8], [28, 14], [26, 20], [22, 24], [16, 26], [10, 26], [6, 22], [4, 16], [4, 10]];
      R.check(`${V} C 12-corner outline fits the view`, await s.reveal(P12)); await s.draw(P12);
      R.check(`${V} C 12 points placed`, samePts(await s.pts(), P12) ? [] : [(await s.pts()).length + ' points']);
      await s.tapW(14, 14); m = await s.msg();
      R.check(`${V} C a 13th vertex is refused with an inline message`, (await s.pts()).length === 12 && m.kind === 'warn' && m.text === 'A plot can have at most 12 corners.' ? [] : [JSON.stringify(m)]);
      await s.tapW(10, 2); await s.settle(); let st = await s.state();
      R.check(`${V} C the 12-corner outline still closes on its first vertex`, st.plot.closed && st.plot.pts.length === 12 && near(Math.abs(area(st.plot.pts)), Math.abs(area(P12))));
      R.check(`${V} C 12 corners: readouts match my own shoelace / perimeter`, eq([(await s.readout()).area, (await s.readout()).perimeter], [fmtArea(Math.abs(area(P12)), 'm'), fmtLen(perim(P12), 'm')]) ? [] : [JSON.stringify(await s.readout())]);
      R.check(`${V} C 12 corners: drawn labels do not overlap (short edges may hide)`, await s.labelProblems());
      await s.shot('C-12-corners');
      // too small: 5 x 8 = 40 m2
      await s.act('btn-clear'); await s.settle(); await s.act('dialog-ok'); await s.settle();
      const SMALL = [[4, 4], [9, 4], [9, 12], [4, 12]]; await s.draw(SMALL); await s.act('btn-close-shape'); await s.settle(); m = await s.msg();
      R.check(`${V} C a closed 40 m² plot: blocking message, Next disabled, step 2 locked with the reason`, m.kind === 'block' && m.text === 'Plot is too small: 40 m² (minimum 50 m²).' && !(await s.btn()).next && (await s.step(2)).locked && (await s.step(2)).title === 'The plot is too small (minimum 50 m²)' ? [] : [JSON.stringify(m) + ' / ' + (await s.step(2)).title]);
      await s.act('unit-ft'); await s.settle(); m = await s.msg();
      R.check(`${V} C too small, in feet: 431 sq ft, minimum 538 sq ft, in message and step reason`, m.text === 'Plot is too small: 431 sq ft (minimum 538 sq ft).' && (await s.step(2)).title === 'The plot is too small (minimum 538 sq ft)' && !(await s.btn()).next ? [] : [m.text + ' / ' + (await s.step(2)).title]);
      await s.act('step-2'); await s.settle(); R.check(`${V} C tapping the locked step says the same`, (await s.toasts()).includes('The plot is too small (minimum 538 sq ft)') && (await s.state()).stage === 1 ? [] : [JSON.stringify(await s.toasts())]);
      await s.act('unit-m'); await s.shot('C-too-small');
      // exactly 50 m2 is enough: drag is tested in D; here redraw 5 x 10
      await s.act('btn-clear'); await s.settle(); await s.act('dialog-ok'); await s.settle();
      await s.draw([[4, 4], [9, 4], [9, 14], [4, 14]]); await s.act('btn-close-shape'); await s.settle();
      R.check(`${V} C exactly 50 m² is accepted`, (await s.btn()).next && (await s.msg()).kind === 'ok' && (await s.readout()).area === '50 m²');
      await s.end(`${V} C`); }

    // ============ D. vertex editing on a closed plot (F1-S3) ============
    { const s = await plotSession(browser, vp);
      await s.reveal([[0, 0], [26, 36]]); await s.draw(RECT); await s.tapW(0, 0); await s.settle();
      await s.reveal([[0, 0], [26, 36]]);
      const before = await s.state(); let live = null;
      await s.dragW([20, 30], [24.2, 33.2], async () => { live = { ro: await s.readout(), st: await s.state(), tx: await s.texts() }; });
      const NEW = [[0, 0], [20, 0], [24, 33], [0, 30]]; let st = await s.state();
      R.check(`${V} D while the corner is held: readouts and labels follow live, the stored state is still the old one`, live && live.ro.area === fmtArea(Math.abs(area(NEW)), 'm') && live.ro.perimeter === fmtLen(perim(NEW), 'm') && live.tx.includes(fmtArea(Math.abs(area(NEW)), 'm')) && eq(live.st, before) ? [] : [JSON.stringify(live && live.ro) + ' expected ' + fmtArea(Math.abs(area(NEW)), 'm')]);
      R.check(`${V} D release: corner stored at the snapped position (24, 33), order and street edge kept`, samePts(st.plot.pts, NEW) && st.plot.closed && st.ans.streetEdge === 0 ? [] : [JSON.stringify(st.plot.pts)]);
      R.check(`${V} D after the drag: readouts ${fmtArea(Math.abs(area(NEW)), 'm')} / ${fmtLen(perim(NEW), 'm')}`, eq([(await s.readout()).area, (await s.readout()).perimeter], [fmtArea(Math.abs(area(NEW)), 'm'), fmtLen(perim(NEW), 'm')]) ? [] : [JSON.stringify(await s.readout())]);
      R.check(`${V} D the drag did not scroll or zoom the page`, await s.noScroll());
      await s.shot('D-after-drag');
      // refused drag: corner 3 (0,30) across the right edge towards (30, 5)
      const pre = await s.state(); let held = null;
      await s.dragW([0, 30], [30, 5], async () => { held = await s.msg(); });
      st = await s.state(); const moved = st.plot.pts[3];
      const simple = (p) => { const X = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); }; for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) { if (j === i + 1 || (i === 0 && j === p.length - 1)) continue; if (X(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length])) return false; } return true; };
      R.check(`${V} D a drag across the outline is refused: message shown, corner stays at its last valid position`, held && held.kind === 'warn' && held.text === 'A corner cannot be moved across the outline.' && !samePts([moved], [[30, 5]]) && simple(st.plot.pts) && area(st.plot.pts) > 0 ? [] : [JSON.stringify([held, moved])]);
      R.check(`${V} D only that corner changed`, samePts(st.plot.pts.slice(0, 3), pre.plot.pts.slice(0, 3), 0));
      // drag out of the area: clamps / refuses, never leaves 0..100
      await s.dragW(st.plot.pts[0], [-6, -6]); st = await s.state();
      R.check(`${V} D a corner cannot leave the drawing area`, st.plot.pts.every((p) => p[0] >= 0 && p[1] >= 0 && p[0] <= 100 && p[1] <= 100) ? [] : [JSON.stringify(st.plot.pts)]);
      // hit area: 18 px from the corner still grabs it on touch (44 px target); a mouse needs to be within 10 px
      await s.act('btn-clear'); await s.settle(); await s.act('dialog-ok'); await s.settle(); await s.reveal([[0, 0], [26, 36]]); await s.draw(RECT); await s.tapW(0, 0); await s.settle();
      { const c = await s.scr(20, 30), v = await s.view(); const from = [c[0] + 13, c[1] + 13], to = [from[0] + 4 * v.scale, from[1]]; await s.dragScr(from, to); st = await s.state();
        const grabbed = !samePts(st.plot.pts, RECT);
        R.check(`${V} D grab 18 px away from a corner: ${vp.touch ? 'touch takes the corner (44 px target)' : 'mouse pans instead (10 px radius)'}`, grabbed === !!vp.touch ? [] : [`grabbed=${grabbed} pts=${JSON.stringify(st.plot.pts)}`]); }
      if (vp.touch) { const c = await s.scr(0, 30), v = await s.view(); const from = [c[0] + 20, c[1] + 20], to = [from[0] + 3 * v.scale, from[1]]; const p0 = await s.pts(); await s.dragScr(from, to); R.check(`${V} D grab 28 px away from a corner pans, the corner stays`, samePts(await s.pts(), p0, 0)); }
      // tiny movement on a corner is not a drag
      { const p0 = await s.pts(), c = await s.scr(p0[0][0], p0[0][1]); await s.dragScr(c, [c[0] + 4, c[1] + 3]); R.check(`${V} D a 5 px wobble on a corner changes nothing`, samePts(await s.pts(), p0, 0)); }
      // the R5 gate: release goes through PC.store.propose exactly once; a Cancel answer returns the corner
      { await s.page.evaluate(() => { fitKey: { const real = PC.store.propose; window.__gate = { calls: 0 }; PC.store.propose = function () { window.__gate.calls++; return Promise.resolve(false); }; window.__gate.real = real; } });
        const p0 = await s.state(); const from = p0.plot.pts[1]; await s.dragW(from, [from[0] + 3, from[1] + 2]); await s.settle();
        const calls = await s.page.evaluate(() => { const c = window.__gate.calls; PC.store.propose = window.__gate.real; return c; });
        const f = await s.frame(), cb = await s.canvasBox(), back = await s.scr(...from);
        R.check(`${V} D gate answers Cancel: asked exactly once, state unchanged, corner drawn back at its origin`, calls === 1 && eq(await s.state(), p0) && f.arcs.some((a) => Math.hypot(a.x + cb.x - back[0], a.y + cb.y - back[1]) < 2) ? [] : [`calls=${calls}`]); }
      // feet: a dragged corner snaps to whole feet, the others are not re-snapped
      await s.act('unit-ft'); await s.settle(); { const p0 = await s.pts(); await s.dragW(p0[2], [p0[2][0] + 2.1, p0[2][1] + 1.3]); const p1 = await s.pts(); const ft = p1[2].map((v) => v / FT);
        R.check(`${V} D in feet a dragged corner lands on the 1 ft lattice; other corners untouched`, ft.every((v) => near(v, Math.round(v), 1e-3)) && !samePts([p1[2]], [p0[2]]) && samePts([p1[0], p1[1], p1[3]], [p0[0], p0[1], p0[3]], 0) ? [] : [JSON.stringify(p1)]); }
      await s.end(`${V} D`); }

    // ============ E. gestures: pan, pinch, hold, wheel, lost pointers (R2) ============
    { const s = await plotSession(browser, vp); const c = await s.canvasBox(); const mid = [c.x + c.w / 2, c.y + c.h * 0.4];
      await s.tapAt([c.x + 60, c.y + 80]); const one = await s.pts(); R.check(`${V} E setup: one point`, one.length === 1);
      let v0 = await s.view();
      await s.dragScr([mid[0] - 40, mid[1]], [mid[0] + 40, mid[1] + 30]); let v1 = await s.view();
      R.check(`${V} E a one-pointer drag on empty space pans and places nothing`, (await s.pts()).length === 1 && near(v1.ox - v0.ox, 80, 3) && near(v1.oy - v0.oy, 30, 3) && near(v1.scale, v0.scale) ? [] : [`pts ${(await s.pts()).length} d=${v1.ox - v0.ox},${v1.oy - v0.oy}`]);
      await s.dragScr(mid, [mid[0] + 10, mid[1] + 8]); R.check(`${V} E a 13 px drag is not a tap`, (await s.pts()).length === 1);
      await s.dragScr(mid, [mid[0] + 4, mid[1] + 3]); R.check(`${V} E a 5 px wobble still counts as a tap`, (await s.pts()).length === 2);
      await s.act('btn-undo');
      // hold
      const hold = async (ms) => { if (vp.touch) await s.touch.tap(mid, ms); else { await s.page.mouse.move(mid[0], mid[1]); await s.page.mouse.down(); await sleep(ms); /* press length is the thing under test (tap limit 700 ms) */ await s.page.mouse.up(); } await s.settle(); };
      await hold(950); R.check(`${V} E a press held longer than 700 ms places nothing`, (await s.pts()).length === 1);
      await hold(450); R.check(`${V} E a 450 ms press is still a tap`, (await s.pts()).length === 2); await s.settle(); await s.act('btn-undo');
      if (vp.touch) {
        v0 = await s.view(); await s.touch.two([mid[0] - 30, mid[1]], [mid[0] + 30, mid[1]], [mid[0] - 80, mid[1]], [mid[0] + 80, mid[1]]); await s.settle(); v1 = await s.view();
        R.check(`${V} E pinch out zooms in (x2.67 expected) and places nothing`, (await s.pts()).length === 1 && v1.scale > v0.scale * 2 && v1.scale < v0.scale * 3.2 ? [] : [`scale ${v0.scale} -> ${v1.scale}, pts ${(await s.pts()).length}`]);
        await s.touch.two([mid[0] - 80, mid[1]], [mid[0] + 80, mid[1]], [mid[0] - 30, mid[1]], [mid[0] + 30, mid[1]], { lift: 'second-first' }); await s.settle();
        R.check(`${V} E pinch in with one finger lifted first: nothing placed`, (await s.pts()).length === 1);
        await s.touch.two([mid[0] - 40, mid[1]], [mid[0] + 40, mid[1]], [mid[0] - 40, mid[1] + 50], [mid[0] + 40, mid[1] + 50], { lift: 'first-first' }); await s.settle(); const v2 = await s.view();
        R.check(`${V} E two-finger drag pans without zooming or placing points`, (await s.pts()).length === 1 && near(v2.scale, (await s.view()).scale) ? [] : ['pts ' + (await s.pts()).length]);
        // immediately after a gesture (no settle wait) a tap on the canvas must still work
        await s.touch.drag([mid[0] - 30, mid[1]], [mid[0] + 30, mid[1]]); await s.touch.tap([mid[0], mid[1] + 40]); await s.settle();
        R.check(`${V} E a tap straight after a pan (0 ms apart) is placed`, (await s.pts()).length === 2 ? [] : ['points ' + (await s.pts()).length]);
        await s.touch.two([mid[0] - 30, mid[1]], [mid[0] + 30, mid[1]], [mid[0] - 50, mid[1]], [mid[0] + 50, mid[1]]); await s.touch.tap([mid[0] + 60, mid[1] - 60]); await s.settle();
        R.check(`${V} E a tap straight after a pinch is placed`, (await s.pts()).length === 3 ? [] : ['points ' + (await s.pts()).length]);
        await s.settle(); await s.act('btn-undo'); await s.act('btn-undo');
      } else {
        const w0 = await s.page.evaluate(([x, y]) => { const v = PC.debug.view('plot'), r = document.querySelector('[data-pc="plot-canvas"]').getBoundingClientRect(); return [(x - r.left - v.ox) / v.scale, (v.oy - (y - r.top)) / v.scale]; }, mid);
        v0 = await s.view(); await s.page.mouse.move(mid[0], mid[1]); await s.page.mouse.wheel(0, -300); await s.settle(); v1 = await s.view(); const again = await s.scr(w0[0], w0[1]);
        R.check(`${V} E wheel zooms about the cursor and places nothing`, v1.scale > v0.scale * 1.2 && Math.hypot(again[0] - mid[0], again[1] - mid[1]) < 1.5 && (await s.pts()).length === 1 ? [] : [`scale ${v0.scale}->${v1.scale} drift ${Math.hypot(again[0] - mid[0], again[1] - mid[1])}`]);
        await s.page.mouse.wheel(0, 3000); await s.settle(); const v2 = await s.view(); await s.page.mouse.wheel(0, -30000); await s.settle(); const v3 = await s.view();
        R.check(`${V} E zoom is limited at both ends (whole area visible .. 80 px per metre)`, v2.scale >= Math.min(c.w, c.h) / 100 * 0.79 && v3.scale <= 80.01 ? [] : [`${v2.scale} .. ${v3.scale}`]);
        await s.page.keyboard.press('0'); // canvas not focused: fit via focus
        // right button and middle button do nothing
        await s.page.mouse.click(mid[0], mid[1], { button: 'right' }); await s.page.mouse.click(mid[0], mid[1], { button: 'middle' }); await s.settle();
        R.check(`${V} E right / middle click place nothing`, (await s.pts()).length === 1);
        // live edge to the pointer with its length (desktop)
        await s.page.focus(sel('plot-canvas')); await s.page.keyboard.press('0'); await s.settle();
        const p0 = (await s.pts())[0], h = await s.scr(p0[0] + 6, p0[1]); await s.page.mouse.move(h[0], h[1]); await s.page.mouse.move(h[0] + 1, h[1]); const tx = await s.texts(), f = await s.frame();
        R.check(`${V} E hovering shows the live edge with its length ("6.0 m")`, tx.includes('6.0 m') && f.texts.length === 1 ? [] : [JSON.stringify(tx)]);
        await s.shot('E-live-edge');
        await s.page.mouse.move(c.x + c.w + 30, c.y + 10); R.check(`${V} E leaving the canvas removes the live edge`, (await s.texts()).length === 0);
      }
      R.check(`${V} E gestures never scrolled or zoomed the page`, await s.noScroll());
      // lost / vanished pointers must not kill the canvas
      const fake = (type, id, primary) => s.page.evaluate(([type, id, primary, x, y]) => document.querySelector('[data-pc="plot-canvas"]').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: primary, clientX: x, clientY: y, bubbles: true, button: 0, buttons: 1 })), [type, id, primary, mid[0], mid[1]]);
      await s.page.focus(sel('plot-canvas')); await s.page.keyboard.press('0'); await s.settle();
      const n0 = (await s.pts()).length; const q0 = (await s.pts())[0]; const tapRel = async (dx, dy) => { const x = Math.min(95, q0[0] + dx), y = Math.max(2, q0[1] + dy); await s.tapW(x, y); };
      await fake('pointerdown', 77, true); await tapRel(2, -2);
      R.check(`${V} E a pointer that vanished without pointerup does not block the next tap`, (await s.pts()).length === n0 + 1 ? [] : ['points ' + (await s.pts()).length]);
      await fake('pointerdown', 78, false); await fake('lostpointercapture', 78, false); await tapRel(4, -1);
      R.check(`${V} E a pointer whose capture was lost does not block the next tap`, (await s.pts()).length === n0 + 2 ? [] : ['points ' + (await s.pts()).length]);
      await fake('pointerdown', 79, true); await fake('pointercancel', 79, true); await tapRel(4.5, -3.5);
      R.check(`${V} E a cancelled pointer places nothing itself and does not block the next tap`, (await s.pts()).length === n0 + 3 ? [] : ['points ' + (await s.pts()).length]);
      await s.end(`${V} E`); }

    // ============ F. sample: figures in m and ft, label legibility, scale chip against the drawn grid (F1-S2) ============
    { const s = await plotSession(browser, vp);
      await s.act('btn-sample'); await s.settle();
      const L = SAMPLE.map((a, i) => Math.hypot(SAMPLE[(i + 1) % 5][0] - a[0], SAMPLE[(i + 1) % 5][1] - a[1]));
      for (const u of ['m', 'ft']) {
        if (u === 'ft') { await s.act('unit-ft'); await s.settle(); }
        const ro = await s.readout(), tx = await s.texts(), want = L.map((l) => fmtLen(l, u));
        R.check(`${V} F sample (${u}): readouts ${u === 'm' ? '584 m² / 96.9 m' : '6286 sq ft / 318.1 ft'} / 5 points`, eq([ro.area, ro.perimeter, ro.points], u === 'm' ? ['584 m²', '96.9 m', '5'] : [fmtArea(584, 'ft'), fmtLen(perim(SAMPLE), 'ft'), '5']) ? [] : [JSON.stringify(ro)]);
        R.check(`${V} F sample (${u}): my own figures agree with PM 6.2 (20.0 30.0 12.0 8.9 26.0 m)`, u === 'ft' || eq(want, ['20.0 m', '30.0 m', '12.0 m', '8.9 m', '26.0 m']));
        const missing = want.filter((w) => !tx.includes(w)), extra = tx.filter((t) => !want.includes(t) && t !== fmtArea(584, u));
        R.check(`${V} F sample (${u}): every drawn edge label is a correct edge length; area label ${fmtArea(584, u)} drawn`, extra.concat(tx.includes(fmtArea(584, u)) ? [] : ['area label missing']));
        R.check(`${V} F sample (${u}): the three long edges (20, 30, 26 m) are labelled`, [want[0], want[1], want[4]].filter((w) => !tx.includes(w)).map((w) => 'missing ' + w));
        if (missing.length) R.note(`${V} sample (${u}): edge labels hidden by culling: ${missing.join(', ')}`);
        R.check(`${V} F sample (${u}): labels do not overlap, are inside the canvas and clear of the chip`, await s.labelProblems());
        R.check(`${V} F sample (${u}): label text contrast on the canvas`, (await s.frame()).texts.filter((t) => !/^#16212b$/i.test(t.fill)).map((t) => `${t.text} drawn in ${t.fill}`));
        await s.layout(`${V} F sample (${u})`); await s.shot('F-sample-' + u);
      }
      R.check(`${V} F unit change kept the sample vertices`, samePts((await s.state()).plot.pts, SAMPLE, 0));
      await s.act('unit-m'); await s.settle();
      // scale chip = spacing of the grid actually drawn, at several zoom levels, both units
      await s.page.focus(sel('plot-canvas'));
      const chipCheck = async (tag) => { const f = await s.frame(), v = await s.view(), chip = (await s.readout()).scale, u = (await s.state()).ans.unit; const gridText = await s.text('plot-grid'); if (gridText !== (u === 'ft' ? 'Snap 1 ft' : 'Snap 0.5 m')) return [`${tag}: grid readout "${gridText}"`]; if (/square|\d\s*(m|ft),/.test(gridText)) return [`${tag}: grid readout states a square size ("${gridText}") next to the chip`]; const m = /^1 square = ([\d.]+) (m|ft)$/.exec(chip); if (!m) return [`chip text "${chip}"`]; if (m[2] !== u) return [`chip unit ${m[2]} in ${u} mode`];
        const stepW = Number(m[1]) * (m[2] === 'ft' ? FT : 1); const vert = f.segs.filter((g) => Math.abs(g[0] - g[2]) < 0.01 && Math.abs(g[0] % 1 - 0.5) < 0.01).map((g) => [g[0], Math.round(Math.abs(g[1] - g[3]))]); const hs = {}; for (const [, h] of vert) hs[h] = (hs[h] || 0) + 1; const H = Number(Object.keys(hs).sort((a, b) => hs[b] - hs[a])[0]); // grid lines: pixel-aligned, all of one height
        const xs = [...new Set(vert.filter((g) => g[1] === H).map((g) => g[0]))].sort((a, b) => a - b); const gaps = xs.slice(1).map((x, i) => x - xs[i]); if (gaps.length < 2) return [`${tag}: only ${xs.length} vertical grid lines recorded`];
        const mean = (xs[xs.length - 1] - xs[0]) / gaps.length, want = stepW * v.scale; if (Math.max(...gaps) - Math.min(...gaps) > 1.01) return [`${tag}: uneven grid, gaps ${Math.min(...gaps)}..${Math.max(...gaps)} px`]; const pr = []; if (Math.abs(mean - want) > Math.max(0.6, want * 0.03)) pr.push(`${tag}: chip says ${chip} = ${want.toFixed(2)} px, drawn spacing ${mean.toFixed(2)} px`); if (want < 5.99) pr.push(`${tag}: squares only ${want.toFixed(1)} px`); const base = u === 'ft' ? 5 : 1; if (![1, 5, 10, 50, 100].includes(Math.round(Number(m[1]) / base))) pr.push(`${tag}: odd step ${chip}`); return pr; };
      if (vp.tag === '360x640') R.check(`${V} F fitted sample on the phone reads "1 square = 1 m"`, (await s.readout()).scale === '1 square = 1 m' ? [] : [(await s.readout()).scale]);
      const chips = new Set();
      for (const u of ['m', 'ft']) { if (u === 'ft') await s.act('unit-ft'); await s.page.focus(sel('plot-canvas')); await s.page.keyboard.press('0'); await s.settle();
        for (const key of ['', '-', '-', '-', '-', '+', '+', '+', '+', '+', '+', '+', '+', '+']) { if (key) { await s.page.keyboard.press(key); await s.settle(); } chips.add((await s.readout()).scale); R.check(`${V} F scale chip equals the drawn grid spacing and the grid readout states only the snap step (${u}, zoom step ${key || 'fit'})`, await chipCheck(`${u} ${key}`)); } }
      R.note(`${V} scale chip values seen while zooming: ${[...chips].join(' | ')}`);
      await s.page.keyboard.press('0'); await s.act('unit-m'); await s.settle();
      await s.end(`${V} F`); }
    { const s = await plotSession(browser, vp); await s.act('btn-sample'); await s.settle(); await s.page.focus(sel('plot-canvas'));
      for (const k of ['-', '+', 'ArrowLeft', '0']) await s.page.keyboard.press(k); await s.tapW(10, 15); const c = await s.canvasBox(); await s.dragScr([c.x + 30, c.y + 80], [c.x + 60, c.y + 100]);
      R.check(`${V} F sample still unmodified after zooming, panning and a tap on the plot`, (await s.state()).sampleClean && (await s.shown('sample-strip')) && samePts(await s.pts(), SAMPLE, 0));
      await s.reveal([[0, 0], [24, 34]]); await s.dragW([20, 30], [22, 32]); await s.settle();
      R.check(`${V} F dragging a corner of the sample ends "unmodified": Skip to 3D gone`, !(await s.state()).sampleClean && !(await s.shown('sample-strip')) && samePts([(await s.pts())[2]], [[22, 32]]) ? [] : [JSON.stringify(await s.pts())]);
      await s.end(`${V} F2`); }

    // ============ G. drafts with a hand-drawn plot; pending-draft guard on the first tap ============
    { const s = await plotSession(browser, vp); const OPEN = [[3, 3], [15.5, 3], [15.5, 12.5]];
      await s.reveal(OPEN); await s.draw(OPEN);
      R.check(`${V} G an open outline is saved automatically`, await s.waitDraft((d) => d && d.state.plot.pts.length === 3 && !d.state.plot.closed));
      await s.reload(); await s.settle();
      R.check(`${V} G reload: offer shown, grid empty underneath`, (await s.shown('resume-box')) && (await s.pts()).length === 0);
      await s.shot('G-draft-waiting');
      // guard: a tap on the grid asks first and places nothing, whatever the answer
      const c = await s.canvasBox(), free = [c.x + c.w / 2, c.y + 70]; R.check(`${V} G free grid above the card`, await s.onCanvas(free));
      const raw = await s.raw();
      await s.tapAt(free); await s.settle();
      R.check(`${V} G first tap with a draft waiting: Start-new question, no point`, (await s.dialogOpen()) && (await s.text('dialog-title')) === 'Start a new project?' && (await s.pts()).length === 0);
      await s.act('dialog-cancel'); await s.settle();
      R.check(`${V} G Cancel: draft and offer kept, nothing placed`, (await s.raw()) === raw && (await s.shown('resume-box')) && (await s.pts()).length === 0);
      await s.act('btn-resume'); await s.settle();
      R.check(`${V} G Resume restores the open outline exactly; drawing continues from it`, samePts(await s.pts(), OPEN, 0) && !(await s.state()).plot.closed && (await s.readout()).points === '3' && (await s.texts()).includes('12.5 m') ? [] : [JSON.stringify(await s.pts())]);
      await s.reveal([...OPEN, [3, 12.5]]); await s.tapW(3, 12.5); await s.tapW(3, 3); await s.settle();
      await s.act('unit-ft'); await s.settle(); await s.dragW([15.5, 12.5], [17.2, 14.1]); await s.settle(); const hand = await s.state();
      R.check(`${V} G closed, edited in feet (corner on the ft lattice, off the metre lattice)`, hand.plot.closed && !near(hand.plot.pts[2][0] * 2, Math.round(hand.plot.pts[2][0] * 2), 1e-6));
      await s.waitDraft((d) => d && d.state.plot.closed && eq(d.state.plot, hand.plot)); await s.reload(); await s.settle(); await s.act('btn-resume'); await s.settle();
      R.check(`${V} G reload + Resume restores the hand-drawn closed plot bit for bit, unit and street edge included`, eq(noPlans(await s.state()), noPlans(hand)) && (await plansOk(s.page)) ? [] : ['state differs']);
      R.check(`${V} G resumed plot is drawn and measured (ft)`, (await s.readout()).area === fmtArea(Math.abs(area(hand.plot.pts)), 'ft') && (await s.texts()).includes(fmtArea(Math.abs(area(hand.plot.pts)), 'ft')) ? [] : [JSON.stringify(await s.readout())]);
      // guard, OK path
      await s.waitDraft((d) => !!d); await s.reload(); await s.settle(); const c2 = await s.canvasBox(), free2 = [c2.x + c2.w / 2, c2.y + 70];
      await s.tapAt(free2); await s.settle(); await s.act('dialog-ok'); await s.settle();
      R.check(`${V} G guard answered "Start new": draft removed, offer gone, and that tap placed nothing`, (await s.raw()) === null && !(await s.shown('resume-box')) && (await s.pts()).length === 0 && defaultProblems(await s.state()).length === 0 ? [] : [`raw ${await s.raw()} pts ${(await s.pts()).length}`]);
      await s.tapAt(free2); R.check(`${V} G the next tap draws normally`, (await s.pts()).length === 1);
      await s.end(`${V} G`); }
  }

  // ============ H. bad drafts under the new plot rules (360x640) ============
  { const s = await plotSession(browser, VIEWPORTS[0]);
    await s.act('btn-sample'); await s.waitDraft((d) => !!d); const GOOD = await s.raw(); const mut = (fn) => { const d = JSON.parse(GOOD); d.state.sampleClean = false; fn(d.state); return JSON.stringify(d); };
    const open = (pts) => (st) => { st.plot = { pts, closed: false }; st.ans.streetEdge = null; }, closed = (pts) => (st) => { st.plot = { pts, closed: true }; st.ans.streetEdge = 0; };
    const BAD = {
      'point at x = -0.5': closed([[-0.5, 0], [20, 0], [20, 30], [0, 30]]), 'point at y = 100.5': closed([[0, 0], [20, 0], [20, 100.5], [0, 30]]), 'open outline with a point at x = 101': open([[2, 2], [101, 2]]),
      'clockwise closed plot': closed([[0, 0], [0, 30], [20, 30], [20, 0]]), 'self-crossing closed outline (bow tie)': closed([[0, 0], [20, 20], [20, 0], [0, 20]]), 'self-crossing open outline': open([[0, 0], [20, 0], [10, 10], [10, -0 + 0], [10, 0]].slice(0, 3).concat([[10, -0]]).map((p) => [p[0], Math.abs(p[1])])),
      'open outline crossing itself': open([[2, 2], [12, 2], [12, 12], [6, 0]]), 'open outline touching an older vertex': open([[2, 2], [12, 2], [12, 12], [2, 2]]), 'repeated consecutive point': open([[2, 2], [2, 2], [12, 2]]),
      'closed plot with all points on one line': closed([[0, 0], [10, 0], [20, 0]]), 'closed plot folding back on itself': closed([[0, 0], [20, 0], [10, 0], [10, 10]]), 'NaN-like coordinate (null)': closed([[0, 0], [20, 0], [20, null], [0, 30]]), 'street edge index out of range': (st) => { st.ans.streetEdge = 5; },
    };
    await s.setRaw(GOOD); await s.reload(); R.check('360x640 H control: the valid sample draft is offered', await s.shown('resume-box'));
    for (const [name, fn] of Object.entries(BAD)) { await s.setRaw(mut(fn)); await s.reload(); await s.settle(); const pr = defaultProblems(await s.state()); if (await s.shown('resume-box')) pr.push('resume offered'); if ((await s.raw()) !== null) pr.push('key not removed'); if (await s.dialogOpen()) pr.push('dialog'); if ((await s.toasts()).length) pr.push('toast'); if ((await s.msg()).kind !== 'info') pr.push('plot message ' + JSON.stringify(await s.msg())); R.check(`360x640 H bad draft "${name}": discarded silently`, pr); }
    // legal edge cases must NOT be discarded
    s.legacy = true; // the legal cases below include a closed plot stored without a street edge
    const OKD = { 'point exactly on the border (100, 100)': closed([[80, 80], [100, 80], [100, 100], [80, 100]]), 'open outline of one point': open([[5, 5]]), 'closed plot under 50 m² (legal, just blocks Next)': closed([[4, 4], [9, 4], [9, 12], [4, 12]]), 'closed plot with street edge null (pre-F1-T3 draft)': (st) => { st.ans.streetEdge = null; } };
    for (const [name, fn] of Object.entries(OKD)) { await s.setRaw(mut(fn)); await s.reload(); await s.settle(); const off = await s.shown('resume-box'); if (off) { await s.act('btn-resume'); await s.settle(); } R.check(`360x640 H legal draft "${name}": offered and resumed without error`, off && (await s.pts()).length > 0 ? [] : ['not offered']); await s.flush(); }
    await s.end('360x640 H', { resume: false }); }

  // ============ I. phone start panel in its three states, with a real stored draft (Designer change) ============
  for (const vp of VIEWPORTS.filter((v) => ['360x640', '768x1024'].includes(v.tag) && (!only || v.tag === only))) {
    const V = vp.tag; const cover = (s) => s.page.evaluate(() => { const p = document.querySelector('[data-pc="start-panel"]'), cv = document.querySelector('[data-pc="plot-canvas"]').getBoundingClientRect(); const kids = [...p.children].filter((k) => !k.hidden && k.getBoundingClientRect().height > 0).map((k) => k.getBoundingClientRect()); const top = Math.min(...kids.map((k) => k.top)), bottom = Math.max(...kids.map((k) => k.bottom)); return { covered: Math.round(cv.bottom - top), below: Math.round(bottom - cv.bottom), pe: getComputedStyle(p).pointerEvents, hint: (() => { const h = p.querySelector('.pc-start__hint'); return !!h && h.getBoundingClientRect().height > 0; })(), btn: (() => { const r = document.querySelector('[data-pc="btn-sample"]').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })() }; });
    { const s = await plotSession(browser, vp); const m = await cover(s);
      R.check(`${V} I no draft: only the floating "Load sample project" button, 60 px of canvas or less, container lets taps through`, m.covered <= 60 && m.below <= 0 && !m.hint && m.pe === 'none' && m.btn[3] >= 44 && !(await s.shown('resume-box')) && !(await s.shown('note-nosave')) ? [] : [JSON.stringify(m)]);
      await s.layout(`${V} I start, no draft`); await s.shot('I-start-no-draft');
      const c = await s.canvasBox(); const left = [m.btn[0] - 14, m.btn[1] + m.btn[3] / 2], above = [m.btn[0] + m.btn[2] / 2, m.btn[1] - 12];
      R.check(`${V} I the grid right beside and above the button is free canvas`, (await s.onCanvas(left)) && (await s.onCanvas(above)) ? [] : ['covered']);
      await s.tapAt(above); R.check(`${V} I a tap just above the button draws a point (and does not load the sample)`, (await s.pts()).length === 1 && !(await s.state()).sampleClean);
      await s.act('btn-undo'); await s.settle(); R.check(`${V} I button returns when the grid is empty again`, await s.shown('btn-sample'));
      // the origin corner of the default view is reachable
      const o = await s.scr(0, 0); R.check(`${V} I the origin (0, 0) of the empty grid is visible and not covered`, await s.onCanvas(o)); await s.tapAt(o); R.check(`${V} I first corner can be placed at the origin`, samePts(await s.pts(), [[0, 0]]) ? [] : [JSON.stringify(await s.pts())]);
      await s.end(`${V} I no draft`); }
    { const s = await plotSession(browser, vp, { init: [STORAGE_MODES['getter-throws']] }); const m = await cover(s);
      R.check(`${V} I storage blocked: note + button only, small footprint (measured ${m.covered} px), taps pass through`, m.covered <= 72 && !m.hint && m.pe === 'none' && (await s.shown('note-nosave')) && (await s.shown('btn-sample')) ? [] : [JSON.stringify(m)]);
      R.check(`${V} I storage blocked: note text whole and readable`, await s.page.evaluate(() => { const n = document.querySelector('[data-pc="note-nosave"]'), r = n.getBoundingClientRect(), f = []; if (n.scrollWidth > n.clientWidth + 1) f.push('note text cut'); if (r.left < 0 || r.right > innerWidth) f.push('note outside viewport'); if (parseFloat(getComputedStyle(n).fontSize) < 12) f.push('font ' + getComputedStyle(n).fontSize); return f; }));
      await s.layout(`${V} I start, storage blocked`); await s.shot('I-start-nosave');
      await s.act('btn-sample'); await s.settle(); R.check(`${V} I storage blocked: sample still loads from the floating button`, (await s.pts()).length === 5);
      await s.end(`${V} I no-save`); }
    { const s = await plotSession(browser, vp); await s.act('btn-sample'); await s.waitDraft((d) => !!d); await s.reload(); await s.settle(); const m = await cover(s);
      R.check(`${V} I real stored draft: full card with hint, sample button, Resume and Start new; card takes taps`, m.hint && m.pe !== 'none' && (await s.shown('resume-box')) && (await s.shown('btn-resume')) && (await s.shown('btn-startnew')) && (await s.shown('btn-sample')) && m.below <= 0 ? [] : [JSON.stringify(m)]);
      await s.layout(`${V} I start, draft waiting`); await s.shot('I-start-draft-waiting');
      const card = await s.page.evaluate(() => { const r = document.querySelector('[data-pc="start-panel"]').getBoundingClientRect(); return [r.left + 20, r.top + 14]; }); await s.tapAt(card); await s.settle();
      R.check(`${V} I a tap on the card itself does not reach the grid (no guard dialog, no point)`, !(await s.dialogOpen()) && (await s.pts()).length === 0);
      await s.act('btn-resume'); await s.settle(); R.check(`${V} I Resume from the card works; card gone, plot drawn`, (await s.pts()).length === 5 && !(await s.shown('start-panel')) && (await s.texts()).includes('584 m²'));
      await s.end(`${V} I draft`); }
  }

  // ============ J. resize / rotation, device pixel ratio, short landscape ============
  if (!only || only === '360x640') {
    { const s = await plotSession(browser, VIEWPORTS[0]); const T = [[2, 2], [14, 2], [14, 12]]; await s.reveal(T); await s.draw(T);
      await s.page.setViewportSize({ width: 640, height: 360 }); await s.resized(640);
      const cv = await s.page.evaluate(() => { const c = document.querySelector('[data-pc="plot-canvas"]'); return [c.width, c.height, c.clientWidth, c.clientHeight, devicePixelRatio]; });
      R.check('rotate to 640x360 J canvas bitmap matches its new CSS size', cv[0] === Math.round(cv[2] * Math.min(cv[4], 2)) && cv[1] === Math.round(cv[3] * Math.min(cv[4], 2)) && cv[2] >= 200 && cv[3] >= 200 ? [] : [cv.join()]);
      R.check('rotate to 640x360 J points unchanged and still drawn', samePts(await s.pts(), T, 0) && (await s.frame()).arcs.length === 3);
      await s.reveal([...T, [2, 12]]); const p = await s.scr(2, 12); await s.tapAt(p); const f = await s.frame(), cb = await s.canvasBox();
      R.check('rotate to 640x360 J taps still land where they are drawn', samePts(await s.pts(), [...T, [2, 12]]) && f.arcs.some((a) => Math.hypot(a.x + cb.x - p[0], a.y + cb.y - p[1]) < 3) ? [] : [JSON.stringify(await s.pts())]);
      await s.layout('640x360 J open outline'); await s.shot('J-landscape-open');
      await s.act('btn-close-shape'); await s.settle(); R.check('640x360 J closed: readouts 120 m² / 44.0 m, labels do not overlap', eq([(await s.readout()).area, (await s.readout()).perimeter], ['120 m²', '44.0 m']) ? await s.labelProblems() : [JSON.stringify(await s.readout())]);
      await s.page.setViewportSize({ width: 360, height: 640 }); await s.resized(360); R.check('back to 360x640 J plot intact, labels fine', samePts((await s.state()).plot.pts, [...T, [2, 12]]) ? await s.labelProblems() : ['points changed']);
      await s.end('J rotate'); }
    for (const dpr of [2, 3]) { const s = await plotSession(browser, VIEWPORTS[0], { dpr }); await s.act('btn-sample'); await s.settle();
      const cv = await s.page.evaluate(() => { const c = document.querySelector('[data-pc="plot-canvas"]'); return [c.width, c.clientWidth, c.height, c.clientHeight]; });
      R.check(`360x640 J device pixel ratio ${dpr}: bitmap is CSS size x ${Math.min(dpr, 2)} (capped at 2)`, cv[0] === cv[1] * Math.min(dpr, 2) && cv[2] === cv[3] * Math.min(dpr, 2) ? [] : [cv.join()]);
      const p = await s.scr(20, 30); R.check(`360x640 J dpr ${dpr}: labels and corner positions are in CSS pixels (same layout as dpr 1)`, (await s.texts()).includes('584 m²') ? await s.labelProblems() : ['no area label']);
      await s.reveal([[0, 0], [24, 34]]); await s.dragW([20, 30], [22, 32]); R.check(`360x640 J dpr ${dpr}: corner drag lands on (22, 32)`, samePts([(await s.pts())[2]], [[22, 32]]) ? [] : [JSON.stringify((await s.pts())[2])]);
      if (dpr === 2) await s.shot('J-sample-dpr2');
      await s.end(`360x640 J dpr ${dpr}`); }
    { const s = await plotSession(browser, LAND); await s.act('btn-sample'); await s.settle();
      R.check('640x360 J sample: readouts whole, labels do not overlap', eq([(await s.readout()).area, (await s.readout()).perimeter], ['584 m²', '96.9 m']) ? await s.labelProblems() : [JSON.stringify(await s.readout())]);
      await s.layout('640x360 J sample'); await s.shot('J-landscape-sample'); await s.act('unit-ft'); await s.settle(); await s.layout('640x360 J sample ft'); await s.end('640x360 J'); }
  }

  // ============ L. F1-S2 "each edge shows its length while drawing and after closing": plots at the canvas border, m and ft ============
  for (const vp of VIEWPORTS.filter((v) => !only || v.tag === only)) for (const u of ['m', 'ft']) { const s = await plotSession(browser, vp); const T = `${vp.tag} L (${u})`;
    const H = vp.tag === '640x360' ? 12 : 20, SQ = [[0, 0], [20, 0], [20, H], [0, H]]; if (u === 'ft') { await s.act('unit-ft'); await s.settle(); }
    const SQu = u === 'ft' ? SQ.map((p) => p.map((v) => Math.round(v / FT) * FT)) : SQ;      // what the taps snap to
    await s.tapW(...SQ[0]); await s.tapW(...SQ[1]); if (!vp.touch) await s.page.mouse.move(3, 3);
    R.check(`${T} default view, first edge drawn from the origin shows its length while drawing`, await s.edgeLabelProblems((await s.pts()), false, u));
    R.check(`${T} first edge: label on the canvas, clear of chip and fit button`, await s.labelProblems());
    if (vp.tag === '360x640') await s.shot('L-first-edge-' + u);
    await s.tapW(...SQ[2]); if (!vp.touch) await s.page.mouse.move(3, 3); R.check(`${T} two edges while drawing: both labelled`, await s.edgeLabelProblems(await s.pts(), false, u));
    await s.tapW(...SQ[3]); await s.tapW(...SQ[0]); await s.settle(); const st = await s.state();
    R.check(`${T} closed plot from the origin: all four edges show their own length next to the edge`, st.plot.closed && samePts(st.plot.pts, SQu, 1e-3) ? await s.edgeLabelProblems(st.plot.pts, true, u) : ['not closed as expected: ' + JSON.stringify(st.plot.pts)]);
    R.check(`${T} closed plot from the origin: area label drawn, nothing overlaps, nothing under chip or fit button`, ((await s.texts()).includes(fmtArea(Math.abs(area(st.plot.pts)), u)) ? [] : ['area label missing']).concat(await s.labelProblems()));
    R.check(`${T} label count = 4 edges + area`, (await s.texts()).length === 5 ? [] : [JSON.stringify(await s.texts())]);
    if (vp.tag === '360x640' || vp.tag === '640x360') await s.shot('L-closed-' + u);
    // push the plot against the other borders: pan so that the top-right corner sits near the canvas corner under the fit button
    const c = await s.canvasBox(), tr = await s.scr(...st.plot.pts[2]); let f0 = await s.freeSpot(); await s.dragScr(f0, [f0[0] + (c.x + c.w - 6 - tr[0]), f0[1] + (c.y + 6 - tr[1])]); await s.settle();
    const vis = async (pts) => { const cb = await s.canvasBox(); const out = []; for (let i = 0; i < pts.length; i++) { const A = await s.scr(...pts[i]), B = await s.scr(...pts[(i + 1) % pts.length]); const inx = (p) => p[0] > cb.x + 30 && p[0] < cb.x + cb.w - 30 && p[1] > cb.y + 30 && p[1] < cb.y + cb.h - 30; out.push(Math.hypot(B[0] - A[0], B[1] - A[1]) > 120 && (inx(A) || inx(B) || inx([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]))); } return out; };
    { const pr = await s.edgeLabelProblems(st.plot.pts, true, u), v = await vis(st.plot.pts); R.check(`${T} plot pushed into the top-right corner: every edge with a visible stretch keeps its label; none under the fit button or chip`, pr.filter((p) => v[Number(/edge (\d)/.exec(p)[1])]).concat(await s.labelProblems())); }
    if (vp.tag === '360x640') await s.shot('L-top-right-' + u);
    // and into the bottom-left corner / under the chip side
    const bl = await s.scr(...st.plot.pts[0]); f0 = await s.freeSpot(); await s.dragScr(f0, [f0[0] + (c.x + 8 - bl[0]), f0[1] + (c.y + c.h - 8 - bl[1])]); await s.settle();
    { const pr = await s.edgeLabelProblems(st.plot.pts, true, u), v = await vis(st.plot.pts); R.check(`${T} plot pushed into the bottom-left corner: visible edges keep their labels`, pr.filter((p) => v[Number(/edge (\d)/.exec(p)[1])]).concat(await s.labelProblems())); }
    R.check(`${T} panning placed no point and moved none`, samePts((await s.state()).plot.pts, st.plot.pts, 0));
    await s.end(T); }
  // a right triangle tucked into the origin corner and a plot along the top of the 100 m area (phone)
  if (!only || only === '360x640') { const s = await plotSession(browser, VIEWPORTS[0]); const TRI = [[0, 0], [16, 0], [0, 12]];
    await s.draw(TRI); await s.act('btn-close-shape'); await s.settle();
    R.check('360x640 L corner triangle at the origin: all three edges labelled (20.0 m hypotenuse)', (await s.edgeLabelProblems((await s.state()).plot.pts, true, 'm')).concat(await s.labelProblems()));
    await s.shot('L-corner-triangle'); await s.end('360x640 L triangle'); }

  // ============ O. a corner drag must never turn a closed plot inside out (found by the CTO; fixed in F2-T1) ============
  for (const vp of MAIN) for (const u of (vp.tag === '360x640' ? ['m', 'ft'] : ['m'])) { const s = await plotSession(browser, vp); const T = `${vp.tag} O (${u})`;
    const TRI = [[4, 4], [16, 4], [10, 14]]; await s.reveal([[2, 0.5], [18, 16]]); await s.draw(TRI); await s.act('btn-close-shape'); await s.reveal([[2, 0.5], [18, 16]]);
    if (u === 'ft') await s.act('unit-ft');
    const t0 = await s.state(); let held = null;
    // pull the apex straight through the opposite (bottom) edge: no edge ever crosses, only the orientation would flip
    await s.dragW([10, 14], [10, 1], async () => { held = { msg: await s.msg(), st: await s.state() }; });
    let st = await s.state(); const apex = st.plot.pts[2];
    R.check(`${T} apex dragged through the opposite edge: refused with a message, apex stays on its side`, held && held.msg.kind === 'warn' && apex[1] > 4 + 1e-6 && area(st.plot.pts) > 0 && samePts(st.plot.pts.slice(0, 2), TRI.slice(0, 2), 0) ? [] : [JSON.stringify({ msg: held && held.msg, pts: st.plot.pts, area: area(st.plot.pts) })]);
    R.check(`${T} state is still a valid counter-clockwise plot`, plotInvariants(st));
    R.note(`${T}: apex rests at ${JSON.stringify(apex)} (last valid position), area ${area(st.plot.pts).toFixed(2)} m²`);
    // one jump straight to the far side (single pointer move)
    await s.act('btn-undo'); await s.act('btn-undo'); await s.tapW(10, 14); await s.act('btn-close-shape'); const t1 = await s.state();
    { const a = await s.scr(10, 14), b = await s.scr(10, 0.5); if (vp.touch) await s.touch.drag(a, b, { steps: 1 }); else { await s.page.mouse.move(a[0], a[1]); await s.page.mouse.down(); await s.page.mouse.move(a[0], a[1] + 12); await s.page.mouse.move(b[0], b[1]); await s.page.mouse.up(); } await s.settle(); }
    st = await s.state(); R.check(`${T} apex thrown across in one move: never stored on the far side`, area(st.plot.pts) > 0 && st.plot.pts[2][1] > 4 + 1e-6 ? plotInvariants(st) : [JSON.stringify(st.plot.pts)]);
    // a base corner pulled through the opposite slanted edge
    const p = st.plot.pts; await s.dragW(p[0], [17, 12]); st = await s.state();
    R.check(`${T} base corner dragged through the opposite edge: refused, plot still counter-clockwise`, area(st.plot.pts) > 0 ? plotInvariants(st) : [JSON.stringify(st.plot.pts)]);
    await s.shot('O-flip-refused-' + u);
    await s.end(T); }   // end(): flush, reload, the draft must be offered and resume exactly

  // ============ N. Fit view control (touch has no keyboard "0") ============
  for (const vp of VIEWPORTS.filter((v) => !only || v.tag === only)) { const s = await plotSession(browser, vp); const T = `${vp.tag} N`;
    R.check(`${T} Fit view: one button, named, 44 px or more, inside the canvas area, clear of the scale chip and the start button`, await s.page.evaluate(() => { const f = [], all = document.querySelectorAll('[data-pc="plot-fit"]'), b = all[0]; if (all.length !== 1) return ['count ' + all.length]; const r = b.getBoundingClientRect(), cv = document.querySelector('[data-pc="plot-canvas"]').getBoundingClientRect(); if (r.width < 43.5 || r.height < 43.5) f.push(`size ${r.width}x${r.height}`); if (b.getAttribute('aria-label') !== 'Fit view' || b.type !== 'button') f.push('name/type'); if (r.left < cv.left || r.top < cv.top || r.right > cv.right || r.bottom > cv.bottom) f.push('outside the canvas'); const X = (q) => { const e = document.querySelector(q); if (!e || e.closest('[hidden]')) return false; const o = e.getBoundingClientRect(); return o.width > 0 && !(r.right <= o.left || o.right <= r.left || r.bottom <= o.top || o.bottom <= r.top); }; for (const q of ['.pc-plot__scale', '[data-pc="btn-sample"]', '[data-pc="start-panel"]']) if (X(q)) f.push('overlaps ' + q); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!hit || !b.contains(hit)) f.push('not hittable'); return f; }));
    const d0 = await s.view(); await s.act('plot-fit'); await s.settle();
    R.check(`${T} Fit on an empty project keeps the default view and places nothing`, eq(await s.view(), d0) && (await s.pts()).length === 0 && !(await s.dialogOpen()));
    await s.act('btn-sample'); await s.settle(); const fitted = await s.view(); const c = await s.canvasBox(), mid = [c.x + c.w / 2, c.y + c.h / 2];
    await s.layout(`${T} sample with fit button`);
    R.check(`${T} sample: no label under the fit button or the chip; every edge of 90 px or more labelled`, (await s.labelProblems()).concat(await s.edgeLabelProblems(SAMPLE, true, 'm', 90)));
    if (vp.touch) { await s.touch.two([mid[0] - 30, mid[1]], [mid[0] + 30, mid[1]], [mid[0] - 90, mid[1] - 20], [mid[0] + 90, mid[1] + 20]); await s.settle(); await s.touch.drag([mid[0], mid[1]], [mid[0] - 70, mid[1] + 60]); }
    else { await s.page.mouse.move(mid[0], mid[1]); await s.page.mouse.wheel(0, -900); await s.settle(); await s.dragScr(mid, [mid[0] - 150, mid[1] + 90]); }
    await s.settle(); const moved = await s.view();
    R.check(`${T} after ${vp.touch ? 'pinch and pan' : 'wheel and drag'} the view really changed`, moved.scale > fitted.scale * 1.5 && (Math.abs(moved.ox - fitted.ox) > 20 || Math.abs(moved.oy - fitted.oy) > 20) ? [] : [JSON.stringify([fitted, moved])]);
    if (vp.tag === '360x640') await s.shot('N-zoomed');
    await s.act('plot-fit'); await s.settle(); const back = await s.view();
    R.check(`${T} Fit view returns exactly the fitted view`, near(back.scale, fitted.scale, 1e-6) && near(back.ox, fitted.ox, 1e-6) && near(back.oy, fitted.oy, 1e-6) ? [] : [JSON.stringify([fitted, back])]);
    R.check(`${T} Fit view placed and moved no point; sample still unmodified; no dialog`, samePts(await s.pts(), SAMPLE, 0) && (await s.state()).sampleClean && !(await s.dialogOpen()));
    for (let i = 0; i < 5; i++) { const p = await s.scr(...SAMPLE[i]); if (!(await s.page.evaluate(([x, y, cb]) => x > cb.x && x < cb.x + cb.w && y > cb.y && y < cb.y + cb.h, [p[0], p[1], c]))) R.check(`${T} corner ${i} back on screen`, ['off screen']); }
    if (vp.tag === '360x640') await s.shot('N-after-fit');
    // open outline: the tap on the button must not reach the canvas underneath
    await s.act('btn-undo'); await s.settle(); const n0 = (await s.pts()).length; await s.dragScr(mid, [mid[0] + 40, mid[1] - 30]); await s.settle(); await s.act('plot-fit'); await s.settle();
    R.check(`${T} open outline: Fit view adds no point (the tap does not fall through to the grid)`, (await s.pts()).length === n0 && !(await s.state()).plot.closed);
    await s.page.focus(sel('plot-fit')); await s.page.keyboard.press('+').catch(() => {}); await s.dragScr(mid, [mid[0] + 30, mid[1] + 30]); await s.settle(); await s.page.focus(sel('plot-fit')); await s.page.keyboard.press('Enter'); await s.settle(); const kb = await s.view();
    R.check(`${T} Fit view works from the keyboard (Enter) and shows a focus ring`, near(kb.scale, (await s.view()).scale) && await s.page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return document.activeElement.dataset.pc === 'plot-fit' && cs.outlineStyle !== 'none'; }) ? [] : ['no ring / wrong focus']);
    R.check(`${T} fit never scrolled or zoomed the page`, await s.noScroll());
    await s.end(T); }
  { // with a draft waiting, Fit view is a view action: no guard dialog
    const s = await plotSession(browser, VIEWPORTS[0]); await s.act('btn-sample'); await s.waitDraft((d) => !!d); await s.reload(); await s.settle();
    await s.act('plot-fit'); await s.settle(); R.check('360x640 N draft waiting: Fit view opens no dialog and changes nothing', !(await s.dialogOpen()) && (await s.shown('resume-box')) && (await s.pts()).length === 0);
    await s.layout('360x640 N draft waiting with fit button'); await s.end('360x640 N draft'); }

  // ============ M. unit change while drawing (4.3: existing points are never re-snapped); a drag below 50 m² blocks Next ============
  if (!only || only === '360x640') { const s = await plotSession(browser, VIEWPORTS[0]);
    await s.act('unit-ft'); await s.settle(); await s.tapW(3.1, 3.1); await s.tapW(12.3, 3.1); const a = await s.pts();
    R.check('360x640 M in feet, taps snap to whole feet', a.length === 2 && a.flat().every((v) => near(v / FT, Math.round(v / FT), 1e-3)) && !a.flat().every((v) => near(v * 2, Math.round(v * 2), 1e-6)) ? [] : [JSON.stringify(a)]);
    R.check('360x640 M in feet, the open edge is labelled in feet', (await s.texts()).some((t) => / ft$/.test(t)) || (await s.texts()).length === 0 ? [] : [JSON.stringify(await s.texts())]);
    await s.act('unit-m'); await s.settle(); await s.tapW(12.3, 9.1); const b = await s.pts();
    R.check('360x640 M back in metres: new point on the 0.5 m lattice, earlier points not re-snapped', b.length === 3 && samePts(b.slice(0, 2), a, 0) && b[2].every((v) => near(v * 2, Math.round(v * 2), 1e-6)) ? [] : [JSON.stringify(b)]);
    await s.act('btn-clear'); await s.settle();
    const R0 = [[4, 14], [14, 14], [14, 20], [4, 20]]; await s.draw(R0); await s.act('btn-close-shape'); await s.settle();
    R.check('360x640 M 60 m² plot: Next enabled', (await s.btn()).next && (await s.readout()).area === '60 m²');
    await s.dragW([14, 20], [14, 18]); await s.dragW([4, 20], [4, 18]); await s.settle(); const m = await s.msg();
    R.check('360x640 M corners dragged until the plot is 40 m²: blocking message, Next disabled again', (await s.readout()).area === '40 m²' && m.kind === 'block' && /too small: 40 m²/.test(m.text) && !(await s.btn()).next ? [] : [JSON.stringify([await s.readout(), m])]);
    await s.dragW([14, 18], [14, 22]); await s.settle(); R.check('360x640 M dragged back above 50 m²: Next enabled, message ok', (await s.btn()).next && (await s.msg()).kind === 'ok');
    // a corner cannot be dropped onto another corner
    const p0 = await s.pts(); await s.dragW(p0[1], p0[0]); const p1 = await s.pts(); R.check('360x640 M a corner cannot be dropped onto another corner', new Set(p1.map(String)).size === 4 && Math.abs(area(p1)) > 0 ? [] : [JSON.stringify(p1)]);
    await s.end('360x640 M'); }

  // ============ K. keyboard on the canvas (basic): focusable, zoom, pan, fit, visible focus ============
  if (!only || only === '1280x800') { const s = await plotSession(browser, VIEWPORTS[2]); await s.act('btn-sample'); await s.settle();
    let ok = false; for (let i = 0; i < 40 && !ok; i++) { await s.page.keyboard.press('Tab'); ok = (await s.focus()) === 'plot-canvas'; }
    R.check('1280x800 K Tab reaches the canvas; it has a name and a visible focus ring', ok && await s.page.evaluate(() => { const c = document.activeElement, cs = getComputedStyle(c); return !!c.getAttribute('aria-label') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; }));
    const v0 = await s.view(); await s.page.keyboard.press('+'); const v1 = await s.view(); await s.page.keyboard.press('ArrowLeft'); const v2 = await s.view(); await s.page.keyboard.press('0'); await s.settle(); const v3 = await s.view();
    R.check('1280x800 K + zooms in, arrow pans, 0 fits again', v1.scale > v0.scale && v2.ox !== v1.ox && near(v3.scale, v0.scale, 1e-6) && near(v3.ox, v0.ox, 1e-6) ? [] : [JSON.stringify([v0.scale, v1.scale, v3.scale])]);
    R.check('1280x800 K keys on the canvas never scroll the page or change the plot', (await s.noScroll()).concat(samePts(await s.pts(), SAMPLE, 0) && (await s.state()).sampleClean ? [] : ['plot changed']));
    await s.page.keyboard.press('Backspace'); await s.settle(); R.check('1280x800 K Backspace reopens the closed sample (Undo)', !(await s.state()).plot.closed && (await s.pts()).length === 5);
    await s.end('1280x800 K'); }
} finally { await browser.close(); }
process.exit(R.done() ? 0 : 1);
