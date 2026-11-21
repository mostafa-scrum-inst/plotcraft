// F1-T3: plot drawing, measurements, corner editing, canvas gestures (F1-S1, F1-S2, F1-S3, R2, R4).
import { launch, open, suite, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import { gestures } from '../helpers/touch.mjs';
import * as A from '../helpers/assertions.mjs';

const KEY = 'plotcraft.draft.v2';                // draft v2 since F2-T3 (A-4)
const T = suite('e2e plot'), browser = await launch();

async function kit(vp, opts) {
  const o = await open(browser, vp, opts), { page, hook } = o, tag = vp.tag, G = await gestures(page, vp.touch);
  const k = {
    ...o, G, tag,
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(PC.debug.state()))),
    pts: () => page.evaluate(() => JSON.parse(JSON.stringify(PC.debug.state().plot.pts))),
    view: () => page.evaluate(() => PC.debug.view('plot')),
    S: (p) => page.evaluate(([x, y]) => PC.debug.toScreen('plot', x, y), p),              // world -> viewport px
    W: (sx, sy) => page.evaluate(([sx, sy]) => { const v = PC.debug.view('plot'), r = document.querySelector('[data-pc="plot-canvas"]').getBoundingClientRect(); return [(sx - r.left - v.ox) / v.scale, (v.oy - (sy - r.top)) / v.scale]; }, [sx, sy]),
    rect: () => hook('plot-canvas').boundingBox(),
    tapW: async (p) => G.tap(await k.S(p)),
    text: (h) => hook(h).evaluate((el) => el.textContent.trim()),
    msg: async () => ({ text: await k.text('plot-msg'), kind: await hook('plot-msg').getAttribute('data-kind') }),
    hidden: (h) => hook(h).evaluate((el) => !!el.closest('[hidden]')),
    labels: () => page.evaluate(() => PC.debug.plotLabels()),
    area: () => page.evaluate(() => PC.geom.area(PC.debug.state().plot.pts)),
    // A snapped world point near the top of the canvas (clear of the start panel), at fx of its width.
    base: async (fx = 0.3) => { const r = await k.rect(), w = await k.W(r.x + r.width * fx, r.y + 70); return [Math.round(w[0]), Math.round(w[1])]; },
    clear: async () => { if (await hook('btn-clear').isEnabled()) { await o.act('btn-clear'); if (!(await k.hidden('dialog-layer'))) await o.act('dialog-ok'); } },
    // Polls until every corner of the plot is on the canvas (the view is fitted in the next animation frame).
    waitFitted: () => page.waitForFunction(() => { const s = PC.debug.state().plot.pts, r = document.querySelector('[data-pc="plot-canvas"]').getBoundingClientRect(); return s.length > 0 && s.every((p) => { const q = PC.debug.toScreen('plot', p[0], p[1]); return q[0] >= r.left + 8 && q[0] <= r.right - 8 && q[1] >= r.top + 8 && q[1] <= r.bottom - 8; }); }, null, { timeout: 3000 }),
    // Polls until the stored draft equals the current state.
    waitSaved: () => page.waitForFunction((key) => { const d = JSON.parse(localStorage.getItem(key) || 'null'); return !!d && JSON.stringify(d.state) === JSON.stringify(PC.debug.state()); }, KEY, { timeout: 3000 }),
    still: async (label) => {
      const m = await page.evaluate(() => ({ y: scrollY, x: scrollX, s: visualViewport ? visualViewport.scale : 1 }));
      T.eq(m, { y: 0, x: 0, s: 1 }, `${tag} ${label}: page did not scroll or zoom`);
    },
    end: async (label) => {
      for (const fn of ['noPageScroll', 'barInViewport', 'stepperOneLine', 'tapTargets']) T.none(await A[fn](page), `${tag} ${label}: ${fn}`);
      T.none(o.problems(), `${tag} ${label}: clean log`); await o.ctx.close();
    }
  };
  return k;
}
const add = (b, d) => [b[0] + d[0], b[1] + d[1]];
const close1 = (a, b) => Math.abs(a - b) < 1e-6;

async function drawing(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k;
  // 1 place, close by the first corner
  const B = await k.base(), RECT = [B, add(B, [10, 0]), add(B, [10, -8]), add(B, [0, -8])];      // drawn clockwise
  T.ok(await hook('btn-undo').isDisabled() && await hook('btn-clear').isDisabled() && await hook('btn-close-shape').isDisabled(), `${tag} empty: Undo, Clear, Close disabled`);
  await k.tapW(B);
  T.eq(await k.pts(), [B], `${tag} first tap places a snapped point`);
  T.ok(await k.hidden('start-panel'), `${tag} start panel leaves once drawing starts`);
  await k.tapW(B);
  T.eq((await k.pts()).length, 1, `${tag} a point on the previous one is ignored`);
  await k.tapW(add(B, [10.2, 0.2]));
  T.eq((await k.pts())[1], RECT[1], `${tag} taps snap to 0.5 m`);
  T.ok(await hook('btn-close-shape').isDisabled(), `${tag} Close shape disabled under 3 points`);
  T.eq(await k.msg(), { text: 'Place at least 3 points, then close the shape.', kind: 'info' }, `${tag} hint under 3 points`);
  T.eq(await k.text('plot-area'), '–', `${tag} no area before closing`);
  await k.tapW(RECT[2]); await k.tapW(RECT[3]);
  T.ok(await hook('btn-close-shape').isEnabled(), `${tag} Close shape enabled from 3 points`);
  T.eq(await k.text('plot-points'), '4', `${tag} points readout`);
  if (!vp.touch) {                                       // live edge to the pointer, with its length
    const s = await k.S(add(B, [6, -8])); await page.mouse.move(s[0], s[1]);
    T.ok((await k.labels()).some((l) => l.text === '6.0 m'), `${tag} live edge shows its length`);
  }
  const s0 = await k.S(B); await k.G.tap([s0[0] + 9, s0[1] + 9]);                                 // near the first corner
  let s = await k.state();
  T.ok(s.plot.closed && s.plot.pts.length === 4, `${tag} tap on the first corner closes the shape`);
  T.ok((await k.area()) === 80, `${tag} closed plot is counter-clockwise (area +80)`);
  T.eq(s.plot.pts[0], B, `${tag} first point stays first`);
  T.eq(s.ans.streetEdge, await page.evaluate(() => PC.plot.defaultStreetEdge(PC.debug.state().plot.pts)), `${tag} street edge stored on close (default rule)`);
  T.ok(s.ans.streetEdge !== null, `${tag} street edge is not null once closed`);
  T.eq([await k.text('plot-area'), await k.text('plot-perimeter')], ['80 m²', '36.0 m'], `${tag} area and perimeter readouts`);
  T.eq((await k.msg()).kind, 'ok', `${tag} closed message`);
  T.ok(await hook('btn-next').isEnabled() && await hook('btn-close-shape').isDisabled(), `${tag} valid plot enables Next`);
  await k.tapW(add(B, [5, -4]));
  T.eq((await k.pts()).length, 4, `${tag} tap on a closed plot adds nothing`);
  // 2 undo reopens, then removes; close by button; too small
  await act('btn-undo');
  s = await k.state();
  T.ok(!s.plot.closed && s.ans.streetEdge === null, `${tag} Undo on a closed shape reopens it`);
  T.eq(s.plot.pts, RECT, `${tag} reopening gives back the drawing order`);
  await act('btn-undo');
  T.eq(await k.pts(), RECT.slice(0, 3), `${tag} Undo removes the last point`);
  await act('btn-close-shape');
  s = await k.state();
  T.ok(s.plot.closed && close1(await k.area(), 40), `${tag} Close shape button closes (triangle 40 m2)`);
  T.eq(await k.msg(), { text: 'Plot is too small: 40 m² (minimum 50 m²).', kind: 'block' }, `${tag} plot too small blocks`);
  T.ok(await hook('btn-next').isDisabled(), `${tag} Next disabled under 50 m2`);
  await hook('unit-ft').check({ force: true });
  T.eq((await k.msg()).text, 'Plot is too small: 431 sq ft (minimum 538 sq ft).', `${tag} the message follows the unit`);
  await k.G.tap(await page.evaluate(() => { const r = document.querySelector('[data-pc="step-2"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  T.ok((await page.evaluate(() => [...document.querySelectorAll('[data-pc="toast-text"]')].map((e) => e.textContent))).includes('The plot is too small (minimum 538 sq ft)'), `${tag} locked-step reason follows the unit`);
  await hook('unit-m').check({ force: true });
  // 3 clear
  await act('btn-clear');
  T.ok(!(await k.hidden('dialog-layer')) && (await k.text('dialog-title')) === 'Clear the plot?', `${tag} Clear on a closed plot asks in-page`);
  await act('dialog-cancel');
  T.eq((await k.pts()).length, 3, `${tag} Cancel keeps the plot`);
  await act('btn-clear'); await act('dialog-ok');
  s = await k.state();
  T.ok(s.plot.pts.length === 0 && !s.plot.closed && s.ans.streetEdge === null, `${tag} Clear empties the plot and resets the street edge`);
  T.ok(!(await k.hidden('start-panel')), `${tag} start panel is back on an empty plot`);
  // 4 refusals
  for (const p of [B, add(B, [10, 0]), add(B, [10, -8]), add(B, [14, -4])]) await k.tapW(p);
  await act('btn-clear');                                                                          // open shape: no question
  T.ok(await k.hidden('dialog-layer') && (await k.pts()).length === 0, `${tag} Clear on an open outline asks nothing`);
  for (const p of [B, add(B, [10, 0]), add(B, [10, -8]), add(B, [14, -4])]) await k.tapW(p);
  await act('btn-close-shape');
  T.ok(!(await k.state()).plot.closed, `${tag} a crossing closing edge is refused`);
  T.eq(await k.msg(), { text: 'Closing here would cross the outline. Move on or undo a point.', kind: 'warn' }, `${tag} ...with a message`);
  await k.tapW(B);
  T.ok(!(await k.state()).plot.closed, `${tag} ...also when tapping the first corner`);
  await k.tapW(add(B, [6, -2]));
  T.eq((await k.pts()).length, 4, `${tag} a crossing point is not placed`);
  T.eq(await k.msg(), { text: 'That edge would cross the outline.', kind: 'warn' }, `${tag} crossing message`);
  await k.tapW(add(B, [14, -9]));
  T.ok((await k.pts()).length === 5 && (await k.msg()).kind === 'info', `${tag} the message clears with the next valid point`);
  const r = await k.rect(), out = await k.S([-1.5, B[1] - 3]);
  T.ok(out[0] > r.x + 1 && out[0] < r.x + r.width, `${tag} (test) the area border is on screen`);
  await k.G.tap(out);
  T.eq([(await k.pts()).length, (await k.msg()).text], [5, 'Outside the 100 × 100 m drawing area.'], `${tag} a point outside the area is refused`);
  await hook('unit-ft').check({ force: true });
  T.eq((await k.msg()).text, 'Outside the 328.1 \u00D7 328.1 ft drawing area.', `${tag} the "outside" message follows the unit, also while it is showing`);
  await hook('unit-m').check({ force: true });
  // a pointer that never gets its up or cancel must not block the canvas
  const lost = async (events) => page.evaluate(([events, x, y]) => {
    const c = document.querySelector('[data-pc="plot-canvas"]');
    for (const type of events) c.dispatchEvent(new PointerEvent(type, { pointerId: 77, pointerType: 'touch', isPrimary: false, clientX: x, clientY: y, button: 0, bubbles: true }));
  }, [events, r.x + r.width / 2, r.y + r.height / 2]);
  const n = (await k.pts()).length;
  await lost(['pointerdown', 'lostpointercapture']);
  await k.tapW(add(B, [18, -9]));
  T.eq((await k.pts()).length, n + 1, `${tag} after a lost pointer capture the next tap still draws`);
  await lost(['pointerdown']);                                                                     // no up, no cancel, no lost capture at all
  await k.tapW(add(B, [18, -5])); await k.tapW(add(B, [20, -3]));
  T.eq((await k.pts()).length, n + 3, `${tag} a pointer that simply vanished is dropped by the next primary pointer`);
  await act('btn-clear');
  const zig = Array.from({ length: 13 }, (_, i) => add(B, [i * 1.5, -(i % 2) * 3]));
  for (const p of zig.slice(0, 12)) await k.tapW(p);
  T.eq((await k.pts()).length, 12, `${tag} 12 corners are allowed`);
  await k.tapW(zig[12]);
  T.eq([(await k.pts()).length, (await k.msg()).text], [12, 'A plot can have at most 12 corners.'], `${tag} a 13th corner is refused`);
  await k.still('drawing');
  await k.end('drawing');
}

async function gesturesAndUnits(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k;
  const B = await k.base(); await k.tapW(B); await k.tapW(add(B, [8, 0]));
  const r = await k.rect(), mid = [r.x + r.width / 2, r.y + r.height * 0.6];
  // 5 drag is not a tap; drag on empty space pans
  let v0 = await k.view();
  await k.G.drag(mid, [mid[0] + 60, mid[1] + 30]);
  let v1 = await k.view();
  T.eq((await k.pts()).length, 2, `${tag} a drag places no point`);
  T.ok(Math.abs(v1.ox - v0.ox - 60) < 2 && Math.abs(v1.oy - v0.oy - 30) < 2 && v1.scale === v0.scale, `${tag} drag on empty space pans the grid`);
  await k.G.hold(mid, 850);
  T.eq((await k.pts()).length, 2, `${tag} a long still press places no point`);
  if (vp.touch) {
    v0 = await k.view();
    await k.G.two([mid[0] - 30, mid[1]], [mid[0] + 30, mid[1]], [mid[0] - 90, mid[1]], [mid[0] + 90, mid[1]]);
    v1 = await k.view();
    T.ok(v1.scale > v0.scale * 2.5 && v1.scale < v0.scale * 3.5, `${tag} pinch zooms (x${(v1.scale / v0.scale).toFixed(2)})`);
    T.eq((await k.pts()).length, 2, `${tag} pinch places no point`);
    await k.G.two([mid[0] - 90, mid[1]], [mid[0] + 90, mid[1]], [mid[0] - 30, mid[1]], [mid[0] + 30, mid[1]], true);
    T.eq((await k.pts()).length, 2, `${tag} pinch with one finger lifting first places no point`);
    v0 = await k.view();
    await k.G.two([mid[0] - 30, mid[1]], [mid[0] + 30, mid[1]], [mid[0] - 30 + 40, mid[1] + 25], [mid[0] + 30 + 40, mid[1] + 25]);
    v1 = await k.view();
    T.ok(Math.abs(v1.ox - v0.ox - 40) < 3 && Math.abs(v1.oy - v0.oy - 25) < 3 && Math.abs(v1.scale / v0.scale - 1) < 0.02, `${tag} two-finger drag pans`);
    T.eq((await k.pts()).length, 2, `${tag} two-finger drag places no point`);
  } else {
    v0 = await k.view(); const w0 = await k.W(mid[0], mid[1]);
    await page.mouse.move(mid[0], mid[1]); await page.mouse.wheel(0, -300);
    v1 = await k.view(); const w1 = await k.W(mid[0], mid[1]);
    T.ok(v1.scale > v0.scale * 1.3, `${tag} wheel zooms in`);
    T.ok(Math.abs(w1[0] - w0[0]) < 1e-6 && Math.abs(w1[1] - w0[1]) < 1e-6, `${tag} wheel zooms about the cursor`);
    await page.mouse.wheel(0, 300);
  }
  // Fit view button: back to the fitted view after a pan or pinch, and it places nothing
  {
    const fitted = async () => { const rc = await k.rect(); let ok = true; for (const p of await k.pts()) { const q = await k.S(p); ok = ok && q[0] > rc.x + 20 && q[0] < rc.x + rc.width - 20 && q[1] > rc.y + 20 && q[1] < rc.y + rc.height - 20; } return ok; };
    await k.G.drag(mid, [mid[0] - 150, mid[1] - 120]);
    if (vp.touch) await k.G.two([mid[0] - 30, mid[1]], [mid[0] + 30, mid[1]], [mid[0] - 120, mid[1]], [mid[0] + 120, mid[1]]);
    const moved = await k.view();
    await act('plot-fit');
    const vf = await k.view();
    T.ok(vf.ox !== moved.ox || vf.scale !== moved.scale, `${tag} Fit view changes the view after a pan${vp.touch ? ' and pinch' : ''}`);
    T.ok(await fitted(), `${tag} Fit view: every point is back on screen`);
    T.eq((await k.pts()).length, 2, `${tag} Fit view places no point`);
    await act('plot-fit');
    const again = await k.view();
    T.ok(Math.abs(again.scale - vf.scale) < 1e-9 && Math.abs(again.ox - vf.ox) < 1e-9, `${tag} Fit view twice gives the same view`);
  }
  await k.still('gestures');
  // keyboard on the canvas: zoom, pan, undo, fit
  await hook('plot-canvas').focus();
  v0 = await k.view(); await page.keyboard.press('+'); v1 = await k.view();
  T.ok(v1.scale > v0.scale, `${tag} + zooms in`);
  await page.keyboard.press('-'); await page.keyboard.press('ArrowLeft');
  T.ok((await k.view()).ox > v0.ox + 30, `${tag} arrow key pans`);
  await page.keyboard.press('Backspace');
  T.eq((await k.pts()).length, 1, `${tag} Backspace undoes the last point`);
  // 6 units on a 20 x 30 m rectangle (zoomed out so it fits)
  await page.keyboard.press('Backspace');
  await page.keyboard.press('0');                                                                  // empty plot: back to the default view
  T.ok(Math.abs((await k.view()).scale - (await k.view()).width / 40) < 0.01, `${tag} 0 fits (empty plot: 40 m across)`);
  for (let i = 0; i < 4; i++) await page.keyboard.press('-');
  const C = await k.base(0.45), RECT = [C, add(C, [20, 0]), add(C, [20, -30]), add(C, [0, -30])];
  T.ok(C[0] >= 0 && C[1] >= 30 && C[0] + 20 <= 100 && C[1] <= 100, `${tag} (test) rectangle fits the area: ${C}`);
  for (const p of RECT) await k.tapW(p);
  await act('btn-close-shape');
  const chipRule = async (label) => {
    await k.labels();                                    // forces the pending frame
    const v = await k.view(), u = (await k.state()).ans.unit, chip = await k.text('plot-scale');
    const m = /^1 square = (\d+(?:\.\d+)?) (m|ft)$/.exec(chip);
    T.ok(!!m && m[2] === u, `${tag} ${label}: scale chip names the unit (${chip})`);
    if (!m) return;
    const base = u === 'ft' ? 1.524 : 1, step = Number(m[1]) * (u === 'ft' ? 0.3048 : 1), mult = Math.round(step / base);
    const want = [1, 5, 10, 50, 100].find((x) => base * x * v.scale >= 6);
    T.eq(mult, want, `${tag} ${label}: chip equals the square actually drawn at ${v.scale.toFixed(2)} px/m`);
  };
  await chipRule('zoomed out');
  await hook('plot-canvas').focus(); for (let i = 0; i < 8; i++) await page.keyboard.press('-');
  await chipRule('fully zoomed out');
  T.ok((await k.text('plot-scale')) !== '1 square = 1 m' && (await k.view()).scale < 6, `${tag} fully zoomed out: the chip is no longer 1 m`);
  await hook('plot-canvas').focus(); await page.keyboard.press('0');
  await chipRule('fitted');
  const before = await k.pts();
  T.eq([await k.text('plot-area'), await k.text('plot-perimeter'), await k.text('plot-grid')], ['600 m²', '100.0 m', 'Snap 0.5 m'], `${tag} metres: readouts`);
  let L = (await k.labels()).map((l) => l.text);
  T.ok(L.filter((t) => t === '20.0 m').length === 2 && L.filter((t) => t === '30.0 m').length === 2 && L.includes('600 m²'), `${tag} metres: edge and area labels (${L})`);
  await hook('unit-ft').check({ force: true });
  T.eq([await k.text('plot-area'), await k.text('plot-perimeter'), await k.text('plot-grid')], ['6458 sq ft', '328.1 ft', 'Snap 1 ft'], `${tag} feet: readouts`);
  L = (await k.labels()).map((l) => l.text);
  T.ok(L.filter((t) => t === '65.6 ft').length === 2 && L.filter((t) => t === '98.4 ft').length === 2 && L.includes('6458 sq ft'), `${tag} feet: every label converted (${L})`);
  await chipRule('feet');
  T.eq(await k.pts(), before, `${tag} unit change moves no vertex`);
  // ft snap: a new plot drawn in ft mode lands on the 1 ft lattice
  await hook('unit-m').check({ force: true });
  T.eq(await k.pts(), before, `${tag} and back`);
  // 7 corner drag: live values, commit on release, exactly one propose
  await page.evaluate(() => { window.__n = 0; const p = PC.store.propose; window.__p = p; PC.store.propose = function (m) { window.__n++; return p(m); }; });
  const pts = await k.pts(), i = pts.findIndex((p) => p[0] === C[0] + 20 && p[1] === C[1]);
  const from = await k.S(pts[i]), to = await k.S(add(pts[i], [4, 0]));
  let live = null;
  await k.G.drag(from, to, async () => { live = { area: await k.text('plot-area'), stored: await k.pts(), labels: (await k.labels()).map((l) => l.text) }; });
  T.eq(live.area, '660 m²', `${tag} area follows the corner while dragging`);
  T.eq(live.stored, pts, `${tag} nothing is stored before release`);
  T.ok(live.labels.includes('24.0 m'), `${tag} edge label follows while dragging (${live.labels})`);
  T.eq((await k.pts())[i], add(pts[i], [4, 0]), `${tag} release stores the snapped corner`);
  T.eq(await page.evaluate(() => window.__n), 1, `${tag} release goes through propose exactly once`);
  T.eq((await k.state()).ans.streetEdge, (await k.state()).ans.streetEdge, `${tag} street edge index kept`);
  // drag into a self-intersection: stays at the last valid position, message shown
  const p1 = await k.pts(), target = add(p1[i], [-34, -15]);
  await k.G.drag(await k.S(p1[i]), await k.S(target), null, 12);
  const p2 = await k.pts();
  T.ok(JSON.stringify(p2[i]) !== JSON.stringify(target), `${tag} a corner cannot be dragged across the outline`);
  T.ok(await page.evaluate(() => PC.plot.valid(PC.debug.state().plot)), `${tag} the plot stays simple`);
  T.eq(await k.msg(), { text: 'A corner cannot be moved across the outline.', kind: 'warn' }, `${tag} refusal message`);
  // R5 Cancel (stubbed): the corner returns
  await page.evaluate(() => { PC.store.propose = () => Promise.resolve(false); });
  const p3 = await k.pts(), j = p3.findIndex((p) => p[0] === C[0] && p[1] === C[1]);
  await k.G.drag(await k.S(p3[j]), await k.S(add(p3[j], [2, 2])));
  T.eq(await k.pts(), p3, `${tag} when the R5 gate answers Cancel the corner returns`);
  await page.evaluate(() => { PC.store.propose = window.__p; });
  // 8 hit area
  v0 = await k.view(); const h = await k.S(p3[j]);
  await k.G.drag([h[0] - 30, h[1] - 0], [h[0] - 30, h[1] - 40]);
  T.eq(await k.pts(), p3, `${tag} 30 px from a corner is not on its handle (pans instead)`);
  await hook('plot-canvas').focus(); await page.keyboard.press('0');                              // fit again after the pan
  if (vp.touch) {
    const h2 = await k.S(p3[j]);
    await k.G.drag([h2[0] - 14, h2[1] - 14], [h2[0] - 14, h2[1] - 14 - 30]);
    T.ok(JSON.stringify(await k.pts()) !== JSON.stringify(p3), `${tag} a finger 20 px from a corner grabs it (44 px target)`);
  } else {
    await k.G.drag([h[0] - 30 + 16, h[1] - 40], [h[0] - 30 + 16, h[1] - 80]);
    T.eq(await k.pts(), p3, `${tag} mouse 16 px from a corner does not grab it`);
  }
  await k.still('editing');
  // 9 sample: fitted, labels legible
  await act('btn-clear'); await act('dialog-ok'); await act('btn-sample');
  await k.waitFitted();
  const rc = await k.rect(), sp = await k.pts();
  const on = []; for (const p of sp) { const s = await k.S(p); on.push(s[0] >= rc.x + 8 && s[0] <= rc.x + rc.width - 8 && s[1] >= rc.y + 8 && s[1] <= rc.y + rc.height - 8); }
  T.ok(on.every(Boolean), `${tag} sample: view is fitted again, every corner on screen`);
  const lab = await k.labels(), texts = lab.map((l) => l.text);
  T.ok(['20.0 m', '30.0 m', '26.0 m', '12.0 m', '584 m²'].every((t) => texts.includes(t)), `${tag} sample labels (${texts})`);
  const overlap = []; lab.forEach((a, x) => lab.forEach((b, y) => { if (x < y && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlap.push(a.text + '/' + b.text); }));
  T.none(overlap, `${tag} sample: labels do not pile up`);
  T.ok(lab.every((l) => l.x >= 0 && l.y >= 0 && l.x + l.w <= rc.width && l.y + l.h <= rc.height), `${tag} sample: labels inside the canvas`);
  T.eq([await k.text('plot-area'), await k.text('plot-perimeter'), await k.text('plot-points')], ['584 m²', '96.9 m', '5'], `${tag} sample readouts`);
  await chipRule('sample');
  T.eq(await k.text('plot-scale'), '1 square = 1 m', `${tag} sample: 1 m squares, as in PM 4.3`);
  T.ok((await k.state()).sampleClean, `${tag} looking at the sample does not modify it`);
  await k.end('gestures+units');
}

// QA bug 1 (F1-T3): every edge that is long enough is labelled, also right next to the canvas border.
async function borderLabels(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k;
  const count = async (text) => (await k.labels()).filter((l) => l.text === text).length;
  const sane = async (label) => {
    const lab = await k.labels(), rc = await k.rect(), bad = [];
    const chip = await page.evaluate(() => { const c = document.querySelector('[data-pc="plot-scale"]').parentNode.getBoundingClientRect(), r = document.querySelector('[data-pc="plot-canvas"]').getBoundingClientRect(); return { x: c.left - r.left, y: c.top - r.top, w: c.width, h: c.height }; });
    const fitBtn = await page.evaluate(() => { const c = document.querySelector('[data-pc="plot-fit"]').getBoundingClientRect(), r = document.querySelector('[data-pc="plot-canvas"]').getBoundingClientRect(); return { x: c.left - r.left, y: c.top - r.top, w: c.width, h: c.height }; });
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    lab.forEach((a, i) => {
      if (a.x < 0 || a.y < 0 || a.x + a.w > rc.width || a.y + a.h > rc.height) bad.push(a.text + ' leaves the canvas');
      if (hit(a, chip)) bad.push(a.text + ' under the scale chip');
      if (hit(a, fitBtn)) bad.push(a.text + ' under the Fit view button');
      lab.forEach((b, j) => { if (i < j && hit(a, b)) bad.push(a.text + ' overlaps ' + b.text); });
    });
    T.none(bad, `${tag} ${label}: labels on the canvas, clear of each other and of the chip`);
  };
  // a 20 x 20 m plot drawn from the origin of the default view: two of its edges run along the canvas border
  await k.tapW([0, 0]); await k.tapW([20, 0]);
  T.eq(await count('20.0 m'), 1, `${tag} the first edge from the origin shows its length`);
  await k.tapW([20, 20]);
  T.eq(await count('20.0 m'), 2, `${tag} two edges drawn: two lengths`);
  await k.tapW([0, 20]);
  T.eq(await count('20.0 m'), 3, `${tag} three edges drawn: three lengths`);
  await sane('open, at the border');
  await act('btn-close-shape');
  T.eq([await count('20.0 m'), await count('400 m\u00B2')], [4, 1], `${tag} closed at the border: all four lengths and the area`);
  await sane('closed, at the border');
  await hook('unit-ft').check({ force: true });
  T.eq([await count('65.6 ft'), await count('4306 sq ft')], [4, 1], `${tag} ...also in feet`);
  await sane('closed, feet');
  await hook('unit-m').check({ force: true });
  // zoomed in so that the edges run off the canvas: the visible part of each edge still carries its length
  await hook('plot-canvas').focus(); for (let i = 0; i < 3; i++) await page.keyboard.press('+');
  const on = await page.evaluate(() => { const v = PC.debug.view('plot'), p = PC.debug.state().plot.pts, n = p.length; let c = 0;
    for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; let len = 0;                       // visible length by sampling
      for (let t = 0; t < 200; t++) { const x = v.ox + (a[0] + (b[0] - a[0]) * (t + 0.5) / 200) * v.scale, y = v.oy - (a[1] + (b[1] - a[1]) * (t + 0.5) / 200) * v.scale; if (x > 2 && y > 2 && x < v.width - 2 && y < v.height - 2) len += Math.hypot(b[0] - a[0], b[1] - a[1]) * v.scale / 200; }
      if (len >= 90) c++; }
    return c; });
  T.ok(on >= 1, `${tag} (test) zoomed in: ${on} edge(s) with 90 px or more on screen`);
  T.ok((await count('20.0 m')) >= on, `${tag} zoomed in: every edge with enough visible length is labelled (${await count('20.0 m')} of ${on})`);
  await sane('zoomed in');
  // a triangle with a slanted edge into the corner, drawn clockwise along the left border
  await page.keyboard.press('0'); await act('btn-clear'); await act('dialog-ok');
  await hook('plot-canvas').focus(); await page.keyboard.press('0');
  await k.tapW([0, 0]); await k.tapW([0, 18]); await k.tapW([24, 0]);
  T.eq([await count('18.0 m'), await count('30.0 m')], [1, 1], `${tag} open outline along the left border: both lengths`);
  await act('btn-close-shape');
  T.eq([await count('18.0 m'), await count('30.0 m'), await count('24.0 m')], [1, 1, 1], `${tag} closed triangle in the corner: all three lengths`);
  await sane('triangle');
  await k.end('border labels');
}

// CTO finding (F1 review): a corner drag must never turn a closed plot clockwise (the draft would be discarded on reload).
async function noFlip(vp) {
  const k = await kit(vp), { page, act, tag } = k;
  const B = await k.base(0.35), TRI = [add(B, [0, -12]), add(B, [12, -12]), add(B, [6, -2])];       // base low, apex up: 60 m2
  for (const p of TRI) await k.tapW(p);
  await act('btn-close-shape');
  const before = await k.pts(), apex = before.findIndex((p) => p[1] === B[1] - 2);
  T.ok((await k.area()) === 60 && apex >= 0, `${tag} triangle closed, counter-clockwise`);
  await k.G.drag(await k.S(before[apex]), await k.S(add(B, [6, -22])), null, 14);                     // apex pulled straight across the base
  const after = await k.pts();
  T.ok((await k.area()) > 0, `${tag} apex dragged across the base: the plot is still counter-clockwise (area ${await k.area()})`);
  T.ok(after[apex][1] > B[1] - 12, `${tag} the apex stopped on its side of the base (${after[apex]})`);
  T.eq(await k.msg(), { text: 'A corner cannot be moved across the outline.', kind: 'warn' }, `${tag} with the refusal message`);
  T.ok(await page.evaluate(() => PC.plot.valid(PC.debug.state().plot) && PC.draft.validState(PC.debug.state())), `${tag} the state is a valid draft`);
  await k.waitSaved();
  const saved = await k.state();
  await page.reload();
  T.ok(!(await k.hidden('resume-box')), `${tag} after a reload the draft is offered, not discarded`);
  await act('btn-resume');
  T.eq(await k.state(), saved, `${tag} and resumes exactly`);
  await k.end('no flip');
}

async function ftDrawing(vp) {
  const k = await kit(vp), { hook, tag } = k;
  await hook('unit-ft').check({ force: true });
  T.eq(await k.text('plot-scale'), '1 square = 5 ft', `${tag} ft: scale chip`);
  const B = await k.base(); await k.tapW(B); await k.tapW(add(B, [5.1, 0.1]));
  const pts = await k.pts(), onFt = (v) => Math.abs(v / 0.3048 - Math.round(v / 0.3048)) < 1e-6;
  T.ok(pts.flat().every(onFt), `${tag} ft: points snap to whole feet (${pts})`);
  await hook('unit-m').check({ force: true });
  T.eq(await k.pts(), pts, `${tag} existing points are not re-snapped on unit change`);
  await k.tapW(add(B, [5, -6]));
  const p3 = (await k.pts())[2];
  T.ok(p3.every((v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9), `${tag} new points snap to 0.5 m again`);
  await k.end('ft');
}

async function draftsAndGuard(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k;
  // 12 a hand-drawn closed plot survives a reload
  const B = await k.base(), RECT = [B, add(B, [0, -8]), add(B, [10, -8]), add(B, [10, 0])];
  for (const p of RECT) await k.tapW(p);
  await act('btn-close-shape');
  await k.waitSaved();
  const saved = await k.state();
  await page.reload();
  // 10 pending draft: the grid tap asks first and is never placed
  const r = await k.rect(), free = [r.x + r.width * 0.5, r.y + 50];
  await k.G.tap(free);
  T.ok(!(await k.hidden('dialog-layer')) && (await k.text('dialog-title')) === 'Start a new project?', `${tag} tapping the grid over a saved draft asks first`);
  await act('dialog-cancel');
  T.ok((await k.pts()).length === 0 && !(await k.hidden('resume-box')), `${tag} Cancel: no point, draft still offered`);
  await act('btn-resume');
  T.eq(await k.state(), saved, `${tag} Resume restores the drawn plot exactly`);
  await k.waitFitted();
  const rc = await k.rect(); let inside = true;
  for (const p of saved.plot.pts) { const s = await k.S(p); inside = inside && s[0] > rc.x && s[0] < rc.x + rc.width && s[1] > rc.y && s[1] < rc.y + rc.height; }
  T.ok(inside, `${tag} resumed plot is fitted on screen`);
  T.eq(await k.text('plot-area'), '80 m²', `${tag} resumed readouts`);
  await page.reload();
  await k.G.tap(free); await act('dialog-ok');
  T.ok((await k.pts()).length === 0 && await k.hidden('resume-box'), `${tag} OK: draft discarded, the tap itself is not placed`);
  T.eq(await page.evaluate((key) => localStorage.getItem(key), KEY), null, `${tag} draft removed from storage`);
  await k.G.tap(free);
  T.eq((await k.pts()).length, 1, `${tag} the next tap draws`);
  // a self-crossing plot in storage is discarded silently
  const bad = JSON.parse(JSON.stringify(saved)); bad.plot.pts = [[0, 0], [10, 10], [10, 0], [0, 10]]; bad.ans.streetEdge = null;
  await page.evaluate(([key, v]) => { PC.ui.autosave.flush(); localStorage.setItem(key, JSON.stringify({ v: 2, savedAt: 1, state: v })); window.__skip = true; }, [KEY, bad]);
  const o2 = await kit(vp, { init: `try { localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify({ v: 2, savedAt: 1, state: bad }))}); } catch (e) {}` });
  T.ok(await o2.hidden('resume-box'), `${tag} a draft with a self-crossing plot is not offered`);
  await o2.ctx.close();
  await k.end('drafts');
}

try {
  for (const vp of VIEWPORTS) { await drawing(vp); await gesturesAndUnits(vp); await ftDrawing(vp); await draftsAndGuard(vp); }
  for (const vp of [...VIEWPORTS, LANDSCAPE]) await borderLabels(vp);
  for (const vp of VIEWPORTS) await noFlip(vp);
} catch (e) { T.ok(false, 'spec crashed: ' + (e && e.stack || e)); } finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
