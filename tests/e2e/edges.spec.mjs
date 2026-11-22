// F2-T3 increment 1: edge-class overrides (F2-S4) in the site preview and the Q6 edge list, their clearing and
// notice, R5, drafts; layout of the tap-mode control (designer-D review). Real input only: taps on labels and
// edges by touch (360x640, 640x360) or mouse (1280x800), the edge list by keyboard.
import { launch, open, suite, settled, LANDSCAPE } from '../helpers/browser.mjs';
import { gestures } from '../helpers/touch.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e edges'), browser = await launch();
const VPS = [{ tag: '360x640', w: 360, h: 640, touch: true }, LANDSCAPE, { tag: '768x1024', w: 768, h: 1024, touch: true }, { tag: '1280x800', w: 1280, h: 800, touch: false }];   // 768x1024 since F3-T1 (F2-T3 QA gap)
const TWELVE = [[0, 0], [30, 0], [30, 8], [26, 8], [26, 14], [30, 14], [30, 24], [18, 24], [18, 20], [10, 20], [10, 24], [0, 24]];

async function kit(vp) {
  const o = await open(browser, vp), { page, hook } = o, tag = vp.tag, G = await gestures(page, vp.touch);
  const k = {
    ...o, G, tag,
    tapEl: (loc) => (vp.touch ? loc.tap() : loc.click()),
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(PC.debug.state()))),
    ov: async () => (await k.state()).ans.edgeOv,
    text: (h) => hook(h).evaluate((el) => el.textContent.trim().replace(/\s+/g, ' ')),
    hidden: (h) => hook(h).evaluate((el) => !!el.closest('[hidden]') || getComputedStyle(el).display === 'none'),
    labels: () => page.evaluate(() => PC.debug.siteLabels().map((l) => ({ text: l.text, x: l.x, y: l.y, w: l.w, h: l.h }))),
    texts: async () => (await k.labels()).map((l) => l.text),
    ticks: () => page.evaluate(() => PC.debug.siteTicks()),
    // The tap-mode control is in the site preview of the Q-site group: after a stage change, wait until the stage
    // has settled and the control is visible (no fixed sleep; under full-run load the tap came too early, F3-T2 QA).
    mode: async (m) => {
      await settled(page);
      if (await hook('q-group-site').evaluate((el) => !!el.closest('[hidden]'))) { await k.act('q-tab-site'); await settled(page); }
      const loc = page.locator(`label:has(> input[name="site-tap-mode"][value="${m}"])`);
      await loc.waitFor({ state: 'visible', timeout: 10000 });
      return k.tapEl(loc);
    },
    site: () => page.evaluate(() => { const s = PC.debug.site(); return s && JSON.parse(JSON.stringify({ edge: s.edge, ptsL: s.ptsL, edgeClass: s.edgeClass, edgeAuto: s.edgeAuto, footprint: s.footprint })); }),
    S: (p) => page.evaluate(([u, v]) => PC.debug.toScreen('site', u, v), p),
    mid: async (i) => { const s = await k.site(), a = s.ptsL[i], b = s.ptsL[(i + 1) % s.ptsL.length]; return k.S([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); },
    tapEdge: async (i) => { await k.G.tap(await k.mid(i)); await settled(page); },
    toasts: () => page.evaluate(() => [...document.querySelectorAll('[data-pc="toast-region"] [data-pc="toast-text"]')].map((t) => t.textContent)),
    noToasts: () => page.evaluate(() => { document.querySelector('[data-pc="toast-region"]').textContent = ''; }),
    seedPlans: () => page.evaluate(() => PC.store.commit((s) => { PC.levels.ids(s).forEach((id) => { s.plans[id] = { sig: PC.sig.level(s, id), rooms: [], unmet: [], edited: true, approved: true, error: null }; }); }, { nav: true })),
    dialogOpen: async () => !(await hook('dialog-layer').evaluate((el) => el.hidden)),
    // A-4 invariant: overrides only on a closed plot, never on the street edge, valid indices, never equal to automatic.
    invariant: async (label) => {
      const bad = await page.evaluate(() => {
        const s = PC.debug.state(), ov = s.ans.edgeOv, keys = Object.keys(ov), f = [];
        if (!keys.length) return f;
        if (!s.plot.closed) f.push('overrides on an open plot');
        const site = PC.site.analyse(s);
        keys.forEach((k2) => { const i = Number(k2); if (!(i >= 0 && i < s.plot.pts.length)) f.push('index ' + k2); if (site && i === site.edge) f.push('street edge ' + k2); if (site && site.edgeAuto[i] === ov[k2]) f.push('equal to automatic ' + k2); });
        return f;
      });
      T.none(bad, `${tag} invariant after ${label}`);
    },
    end: async (label) => {
      for (const fn of ['noPageScroll', 'barInViewport', 'tapTargets']) T.none(await A[fn](page), `${tag} ${label}: ${fn}`);
      T.eq(await page.evaluate(() => [scrollX, scrollY]), [0, 0], `${tag} ${label}: page did not scroll`);
      T.none(o.problems(), `${tag} ${label}: clean log`); await o.ctx.close();
    }
  };
  return k;
}
async function sampleStage2(k) { await k.act('btn-sample'); await k.act('btn-next'); await settled(k.page); }

// The control, its hint, the collapse toggle and the compass never cover the plot outline or a forced label;
// the outline is hittable (the canvas is the element under every vertex and edge point).
async function layoutClear(k, label) {
  const { page, tag } = k;
  const res = await page.evaluate(() => {
    const c = document.querySelector('[data-pc="site-canvas"]').getBoundingClientRect(), f = [];
    const rects = ['site-tap-mode', 'site-tap-hint', 'site-preview-toggle'].map((h) => { const el = document.querySelector(`[data-pc="${h}"]`), b = el.getBoundingClientRect(); return el.hidden || !b.width ? null : { h, x: b.left, y: b.top, w: b.width, hh: b.height }; }).filter(Boolean);
    const d = PC.debug.siteDial(); rects.push({ h: 'compass', x: d.x - d.r, y: d.y - d.r, w: 2 * d.r, hh: 2 * d.r + 14 });
    const s = PC.debug.site(), P = s.ptsL.map((q) => PC.debug.toScreen('site', q[0], q[1])), n = P.length;
    for (let i = 0; i < n; i++) for (const t of [0, 0.25, 0.5, 0.75]) {
      const x = P[i][0] + (P[(i + 1) % n][0] - P[i][0]) * t, y = P[i][1] + (P[(i + 1) % n][1] - P[i][1]) * t;
      const el = document.elementFromPoint(x, y);
      if (!el || el.dataset.pc !== 'site-canvas') f.push(`edge ${i + 1} at ${t}: covered by ${el && (el.dataset.pc || el.className || el.tagName)}`);
    }
    const labels = PC.debug.siteLabels();
    labels.forEach((l) => { const L = { x: c.left + l.x, y: c.top + l.y, w: l.w, h: l.h };
      rects.forEach((r) => { if (L.x < r.x + r.w && r.x < L.x + L.w && L.y < r.y + r.hh && r.y < L.y + L.h) f.push(`label "${l.text}" under ${r.h}`); }); });
    return { f, front: labels.some((l) => l.text === 'front'), scale: PC.debug.view('site').scale };
  });
  T.none(res.f, `${tag} ${label}: outline and labels uncovered`);
  T.ok(res.front, `${tag} ${label}: "front" labelled`);
  return res.scale;
}

async function tapMode(vp) {
  const k = await kit(vp), { page, hook, tag } = k;
  await sampleStage2(k);
  T.eq([await page.evaluate(() => PC.debug.tapMode()), await k.hidden('site-tap-hint'), await page.locator('[data-pc="site-tap-mode"] input:checked').evaluate((e) => e.value)], ['street', true, 'street'], `${tag} default tap mode: street, no hint`);
  let sc = await layoutClear(k, 'street mode');
  if (tag === '360x640') T.ok(sc >= 4.0, `${tag} sample drawn at ${sc.toFixed(2)} px/m with the control present`);
  // street mode: a tap still sets Q6
  await k.tapEdge(2);
  T.eq([(await k.state()).ans.streetEdge, await k.ov()], [2, {}], `${tag} street mode: an edge tap sets Q6`);
  await k.tapEdge(0);
  T.eq((await k.state()).ans.streetEdge, 0, `${tag} ...and back`);
  await k.mode('class');
  // the FS shows the hint (hidden attribute off); in short landscape the Designer's CSS does not render it (TL ruling 4)
  T.eq([await page.evaluate(() => PC.debug.tapMode()), await hook('site-tap-hint').evaluate((el) => el.hidden), await k.text('site-tap-hint')], ['class', false, 'Tap a boundary to switch back / side · * = set by you'], `${tag} Back / side mode: hint on`);
  T.eq(await hook('site-tap-hint').evaluate((el) => el.getBoundingClientRect().height > 0), tag !== '640x360', `${tag} ...rendered except in short landscape`);
  sc = await layoutClear(k, 'class mode, hint shown');
  if (tag === '360x640') T.ok(sc >= 4.0, `${tag} sample drawn at ${sc.toFixed(2)} px/m in Back / side mode`);
  const auto = (await k.site()).edgeAuto;
  for (const i of [1, 2, 3, 4]) {
    await k.tapEdge(i);
    const s = await k.site(), want = auto[i] === 'back' ? 'side' : 'back';
    T.eq([s.edgeClass[i], (await k.ov())[i], (await k.state()).ans.streetEdge], [want, want, 0], `${tag} tap on edge ${i + 1} switches it to ${want}`);
    T.ok((await k.texts()).includes(want + '*'), `${tag} ...labelled "${want}*" (${await k.texts()})`);
    T.ok(!(await k.hidden('site-legend-mark')) || tag === '360x640', `${tag} ...legend explains the mark`);
  }
  // F5-T3a (A-15 as updated): marked labels follow the normal culling; a culled one leaves a "*" tick
  T.eq((await k.texts()).filter((t) => t.endsWith('*')).length + (await k.ticks()).length, 4, `${tag} every overridden edge keeps its label or, when culled, a "*" tick`);
  await layoutClear(k, 'four overrides');
  T.eq((await k.state()).sampleClean, false, `${tag} an override is a real change: Skip to 3D goes`);
  for (const i of [1, 2, 3, 4]) await k.tapEdge(i);
  T.eq([await k.ov(), (await k.texts()).filter((t) => t.endsWith('*')), await k.hidden('site-legend-mark')], [{}, [], true], `${tag} tapping again restores the automatic classes, marks gone`);
  await k.noToasts();
  const before = await k.state();
  await k.tapEdge(0);
  T.eq([await k.state(), await k.toasts()], [before, ['The street edge is always front (change it with Q6)']], `${tag} street-edge tap: hint toast, nothing changes`);
  // a canvas point at least 30 px from every edge, not under a control
  const far = await page.evaluate(() => {
    const c = document.querySelector('[data-pc="site-canvas"]').getBoundingClientRect(), s = PC.debug.site(), P = s.ptsL.map((q) => PC.debug.toScreen('site', q[0], q[1])), n = P.length;
    const dseg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); };
    for (let y = c.top + 10; y < c.bottom - 10; y += 6) for (let x = c.left + 10; x < c.right - 10; x += 6) {
      const el = document.elementFromPoint(x, y);
      if (el && el.dataset.pc === 'site-canvas' && P.every((a, i) => dseg([x, y], a, P[(i + 1) % n]) > 30)) return [x, y];
    }
    return null;
  });
  if (far) { await k.G.tap(far); await settled(page); }
  T.ok(far && JSON.stringify(await k.state()) === JSON.stringify(before), `${tag} a tap away from every edge changes nothing`);
  // a 12-vertex plot: every non-street edge switchable by tap; no forced label under a control
  await page.evaluate((pts) => PC.store.commit((s) => { s.plot = { pts, closed: true }; s.ans.streetEdge = 0; }), TWELVE); await settled(page);
  const n12 = (await k.site()).ptsL.length, auto12 = (await k.site()).edgeAuto;
  for (let i = 1; i < n12; i++) await k.tapEdge(i);
  const ov12 = await k.ov(), s12 = await k.site();
  T.eq(Object.keys(ov12).length, n12 - 1, `${tag} 12-vertex plot: all ${n12 - 1} non-street edges switched by tap`);
  T.ok([...Array(n12).keys()].slice(1).every((i) => s12.edgeClass[i] !== auto12[i]), `${tag} ...each to the other class`);
  await layoutClear(k, '12-vertex plot, every edge overridden');
  await k.invariant('12-vertex taps');
  // tap mode resets on entering stage 2 and on a whole-state replace
  await k.act('btn-back'); await k.act('btn-next'); await settled(page);
  T.eq(await page.evaluate(() => PC.debug.tapMode()), 'street', `${tag} tap mode back to street on entering stage 2`);
  await k.mode('class'); await k.act('btn-back');
  await page.evaluate(() => { document.querySelector('[data-pc="start-panel"]').hidden = false; });
  await k.act('btn-sample'); await k.act('dialog-ok'); await settled(page);
  T.eq(await page.evaluate(() => PC.debug.tapMode()), 'street', `${tag} ...and on Load sample (replace)`);
  await k.end('tap mode');
}

async function keyboardList(vp) {
  const k = await kit(vp), { page, hook, tag } = k;
  await sampleStage2(k);
  const focused = () => page.evaluate(() => { const e = document.activeElement; return e && (e.getAttribute('aria-label') || e.dataset.pc); });
  await hook('q-edges-toggle').focus(); await page.keyboard.press('Enter');
  T.eq(await hook('q-edges-toggle').getAttribute('aria-expanded'), 'true', `${tag} edge list opens by keyboard`);
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-pc="q-edges"] > li')].map((li) => [li.querySelector('[data-pc="edge-name"]').textContent, li.querySelector('[data-pc="edge-class"]').textContent, li.querySelector('[data-pc="edge-switch"]').hidden]));
  T.eq(rows, [['Edge 1 · 20.0 m', 'front (street)', true], ['Edge 2 · 30.0 m', 'side', false], ['Edge 3 · 12.0 m', 'back', false], ['Edge 4 · 8.9 m', 'back', false], ['Edge 5 · 26.0 m', 'side', false]], `${tag} one row per edge: number, length, class; street row has no switch`);
  await page.keyboard.press('Tab');
  T.eq([await focused(), await page.evaluate(() => PC.debug.siteFocusEdge())], ['Edge 2, 30.0 m, side: make back', 1], `${tag} Tab reaches edge 2: full accessible name, edge highlighted in the drawing`);
  await page.keyboard.press('Enter'); await settled(page);
  T.eq([await k.ov(), await focused(), await page.evaluate(() => PC.debug.siteFocusEdge())], [{ 1: 'back' }, 'Edge 2, 30.0 m, back (set by you): make side', 1], `${tag} Enter switches it; focus stays on the same switch`);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press(' '); await settled(page);
  T.eq([await k.ov(), await focused(), await page.evaluate(() => PC.debug.siteFocusEdge())], [{ 1: 'back', 3: 'side' }, 'Edge 4, 8.9 m, side (set by you): make back', 3], `${tag} Space switches the 8.9 m angled edge`);
  const tk = (await k.ticks()).map((t) => t.edge), tx = await k.texts();
  T.ok((tx.includes('side*') || tk.includes(3)) && (tx.includes('back*') || tk.includes(1)), `${tag} drawing marks follow: labels or ticks (${tx}; ticks ${tk})`);
  await k.tapEl(page.locator('label:has(> [data-pc="unit-ft"])')); await settled(page);
  T.eq([await k.ov(), await page.evaluate(() => document.querySelectorAll('[data-pc="edge-switch"]')[3].getAttribute('aria-label'))], [{ 1: 'back', 3: 'side' }, 'Edge 4, 29.3 ft, side (set by you): make back'], `${tag} unit switch keeps overrides; names in ft`);
  await hook('q-north-reset').focus(); await settled(page);
  T.eq(await page.evaluate(() => PC.debug.siteFocusEdge()), null, `${tag} leaving the list removes the highlight`);
  await k.end('keyboard list');
}

async function liveAndR5(vp) {
  const k = await kit(vp), { page, hook, tag } = k;
  await sampleStage2(k);
  await page.evaluate(() => PC.store.commit((s) => { s.ans.setbacks = { front: 3, back: 5, side: 1 }; })); await settled(page);
  const fp0 = (await k.site()).footprint, sum0 = await k.text('sum-footprint'), rows0 = await page.evaluate(() => document.querySelector('[data-pc="conflict-list"]').textContent);
  T.eq([fp0.w, fp0.d], [10.5, 13], `${tag} back 5 / sides 1: 10.5 x 13 m`);
  await k.seedPlans();
  await k.mode('class');
  await k.tapEdge(3);
  T.ok(await k.dialogOpen(), `${tag} a size-changing switch asks (R5)`);
  T.eq(await k.text('dialog-title'), 'Regenerate floor plans?', `${tag} ...the R5 question`);
  await k.act('dialog-cancel'); await settled(page);
  T.eq([await k.ov(), (await k.site()).edgeClass[3], (await k.texts()).includes('side*')], [{}, 'back', false], `${tag} Cancel restores the class and its label`);
  await k.tapEdge(3); await k.act('dialog-ok'); await settled(page);
  const fp1 = (await k.site()).footprint;
  T.eq([await k.ov(), fp1.w, fp1.d, fp1.area], [{ 3: 'side' }, 10.5, 13.5, 141.75], `${tag} Continue: angled edge side, setback 1 m along it, footprint 10.5 x 13.5 m`);
  T.ok((await k.text('sum-footprint')) !== sum0 && (await k.text('sum-footprint')).startsWith('142 m'), `${tag} summary follows (${await k.text('sum-footprint')})`);
  await k.tapEdge(3);
  T.eq([await k.dialogOpen(), await k.ov(), (await k.site()).footprint, await k.text('sum-footprint'), await page.evaluate(() => document.querySelector('[data-pc="conflict-list"]').textContent)], [false, {}, fp0, sum0, rows0], `${tag} switching back: no second question this visit, every figure restored exactly`);
  // equal setbacks: never asks
  await page.evaluate(() => PC.store.commit((s) => { s.ans.setbacks = { front: 3, back: 2, side: 2 }; }));
  await k.act('btn-back'); await k.act('btn-next');        // stage 3 is not entered, so re-seed for a fresh visit
  await page.evaluate(() => { PC.store.session.r5Confirmed = false; }); await k.seedPlans(); await k.mode('class');
  for (const i of [1, 2, 3, 4]) { await k.tapEdge(i); T.ok(!(await k.dialogOpen()), `${tag} equal setbacks: switching edge ${i + 1} never asks`); }
  await k.end('live and R5');
}

async function clearing(vp) {
  const k = await kit(vp), { page, hook, tag } = k;
  await sampleStage2(k);
  const make = async () => { await k.mode('class'); await k.tapEdge(3); T.eq(await k.ov(), { 3: 'side' }, `${tag} override made`); await k.noToasts(); };
  const want = (why) => ['Back / side choices were reset because ' + why];
  // Q6 by button and by tap
  await make(); await k.act('q-street-next'); await settled(page);
  T.eq([await k.ov(), await k.toasts()], [{}, want('the street edge changed')], `${tag} Q6 next clears overrides, notice once`);
  await k.invariant('Q6 next'); await k.act('q-street-prev'); await settled(page);
  await make(); await k.mode('street'); await k.tapEdge(2);
  T.eq([await k.ov(), await k.toasts()], [{}, want('the street edge changed')], `${tag} Q6 by edge tap clears them`);
  await k.invariant('Q6 tap');
  await page.evaluate(() => PC.store.commit((s) => { s.ans.streetEdge = 0; }));
  // stage 1: corner drag, undo (reopen), clear
  const plotPt = (p) => page.evaluate(([x, y]) => PC.debug.toScreen('plot', x, y), p);
  await make(); await k.act('btn-back'); await settled(page);
  await k.G.drag(await plotPt([20, 30]), await plotPt([20, 32]));
  await settled(page);
  T.eq([(await k.state()).plot.pts[2], await k.ov(), await k.toasts()], [[20, 32], {}, want('the outline changed')], `${tag} a corner drag clears them`);
  await k.invariant('corner drag');
  await k.act('btn-next'); await settled(page); await make(); await k.act('btn-back'); await settled(page);
  await k.act('btn-undo'); await settled(page);
  T.eq([(await k.state()).plot.closed, await k.ov(), await k.toasts()], [false, {}, want('the outline changed')], `${tag} Undo (reopen) clears them`);
  await k.invariant('reopen');
  await k.act('btn-close-shape'); await settled(page);
  T.eq(await k.ov(), {}, `${tag} re-closing the identical outline brings nothing back`);
  await k.act('btn-next'); await settled(page); await make(); await k.act('btn-back'); await settled(page);
  await k.act('btn-clear'); await k.act('dialog-ok'); await settled(page);
  T.eq([(await k.state()).plot.pts.length, await k.ov(), await k.toasts()], [0, {}, want('the outline changed')], `${tag} Clear clears them`);
  await k.invariant('clear');
  // replace never announces: Load sample, Start new, Resume over a state with overrides
  await k.act('btn-sample'); await k.act('btn-next'); await settled(page); await make();
  await k.act('btn-back'); await page.evaluate(() => { document.querySelector('[data-pc="start-panel"]').hidden = false; });
  await k.act('btn-sample'); await k.act('dialog-ok'); await settled(page);
  T.eq([await k.ov(), await k.toasts()], [{}, []], `${tag} Load sample over overrides: none left, no notice`);
  await k.invariant('load sample');
  // the same over a different outline (the replace changes the outline: still no notice)
  await k.act('btn-next'); await page.evaluate((pts) => PC.store.commit((s) => { s.plot = { pts, closed: true }; s.ans.streetEdge = 0; }), TWELVE); await settled(page);
  await k.mode('class'); await k.tapEdge(5); T.eq(Object.keys(await k.ov()).length, 1, `${tag} override on the 12-vertex plot`);
  await k.noToasts(); await k.act('btn-back'); await page.evaluate(() => { document.querySelector('[data-pc="start-panel"]').hidden = false; });
  await k.act('btn-sample'); await k.act('dialog-ok'); await settled(page);
  T.eq([await k.ov(), await k.toasts()], [{}, []], `${tag} Load sample over a different outline with overrides: no notice`);
  await k.act('btn-next'); await settled(page); await make();
  await page.evaluate(() => PC.ui.autosave.flush());
  const saved = await k.state();
  await page.reload(); await k.act('btn-resume'); await settled(page);
  T.eq([(await k.state()).ans.edgeOv, await k.toasts()], [{ 3: 'side' }, []], `${tag} reload + Resume: overrides restored exactly, no notice`);
  T.eq(await k.state(), saved, `${tag} ...the whole state`);
  T.eq((await k.state()).stage, 2, `${tag} ...resumed on stage 2`);
  T.ok((await k.texts()).includes('side*') || (await k.ticks()).some((t) => t.edge === 3), `${tag} ...and marked (label or tick)`);
  await page.evaluate(() => PC.ui.autosave.flush());
  await page.reload(); await k.noToasts(); await k.act('btn-startnew'); await k.act('dialog-ok'); await settled(page);
  T.eq([await k.ov(), await k.toasts()], [{}, []], `${tag} Start new: none left, no notice`);
  await k.invariant('start new');
  // with seeded plans: an outline change that also clears a size-changing override asks once at most
  await k.act('btn-sample'); await k.act('btn-next');
  await page.evaluate(() => PC.store.commit((s) => { s.ans.setbacks = { front: 3, back: 5, side: 1 }; }));
  await k.mode('class'); await k.tapEdge(3); await k.seedPlans(); await k.act('btn-back');
  let dialogs = 0;
  await page.evaluate(() => { window.__dlg = 0; new MutationObserver(() => { if (!document.querySelector('[data-pc="dialog-layer"]').hidden) window.__dlg++; }).observe(document.querySelector('[data-pc="dialog-layer"]'), { attributes: true }); });
  await k.G.drag(await plotPt([0, 26]), await plotPt([0, 24]));
  await settled(page);
  if (await k.dialogOpen()) { await k.act('dialog-ok'); await settled(page); }
  dialogs = await page.evaluate(() => window.__dlg);
  T.ok(dialogs <= 1, `${tag} vertex move + clearing with valid plans: ${dialogs} dialog(s), at most one`);
  T.eq(await k.ov(), {}, `${tag} ...overrides cleared in the same change`);
  await k.invariant('drag with plans');
  await k.end('clearing');
}

// TL increment-1 review: the drawing scale does not depend on the tap mode (640x360: >= 3.5 px/m and equal;
// 360x640: >= 4.0; 1280x800: class mode within 2 % of street mode), with and without overrides; with every
// non-street edge overridden, "front" and the four `*` labels are all drawn and no two labels overlap.
async function scaleAndLabels(vp) {
  const k = await kit(vp), { page, tag } = k;
  await sampleStage2(k);
  const scale = () => page.evaluate(() => PC.debug.view('site').scale);
  const check = (st, cl, label) => {
    if (tag === '360x640') T.ok(st >= 4.0 && cl >= 4.0, `${tag} ${label}: ${st.toFixed(2)} / ${cl.toFixed(2)} px/m, both 4.0 or more`);
    else if (tag === '640x360') T.ok(st >= 3.5 && Math.abs(st - cl) < 1e-9, `${tag} ${label}: ${st.toFixed(2)} / ${cl.toFixed(2)} px/m, 3.5 or more and equal in both modes`);
    else if (label.includes('no overrides')) T.ok(Math.abs(cl - st) / st <= 0.02, `${tag} ${label}: class mode ${cl.toFixed(2)} within 2 % of street mode ${st.toFixed(2)} px/m`);
    // with overrides the legend gains "* set by you" and wraps in street mode (Designer layout): class mode is not smaller
    else T.ok(cl >= st * 0.98, `${tag} ${label}: class mode ${cl.toFixed(2)} not smaller than street mode ${st.toFixed(2)} px/m`);
  };
  const st0 = await scale(); await k.mode('class'); const cl0 = await scale();
  check(st0, cl0, 'sample, no overrides');
  for (const i of [1, 2, 3, 4]) await k.tapEdge(i);
  T.eq(Object.keys(await k.ov()).length, 4, `${tag} all four non-street edges overridden`);
  const cl1 = await scale(); await k.mode('street'); const st1 = await scale();
  check(st1, cl1, 'sample, four overrides');
  T.ok(Math.abs(cl1 - cl0) < 1e-9, `${tag} class mode: overrides do not change the scale (${cl0.toFixed(2)} / ${cl1.toFixed(2)}; the legend is not shown with the hint)`);
  for (const m of ['street', 'class']) {
    await k.mode(m);
    const L = await k.labels(), texts = L.map((l) => l.text), over = [];
    for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
      const p = L[a], q = L[b];
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) over.push(p.text + ' / ' + q.text);
    }
    // F5-T3a (A-15 as updated): a marked label follows the normal culling; a culled one leaves a "*" tick
    const ticks = await page.evaluate(() => PC.debug.siteTicks().length);
    T.ok(texts.includes('front') && texts.filter((t) => t.endsWith('*')).length + ticks === 4, `${tag} ${m} mode: "front"; four overridden edges marked by a label or a tick (${texts}; ${ticks} ticks)`);
    T.none(over, `${tag} ${m} mode: no two labels overlap`);
    await layoutClear(k, `${m} mode, four overrides`);
  }
  if (tag === '360x640') await staircase(k);
  await k.end('scale and labels');
}

// F5-T3a (Designer spec, A-15 as updated) at 360x640 in scaleAndLabels' page: the 12-vertex staircase with every
// non-street edge overridden: no two labels overlap, "front" is always labelled, every overridden edge has its "*"
// label or a tick (6 px, on the inner side, at the midpoint); the footprint area label in the lighter style, on two
// lines or outside on the street side when the footprint is narrow; the Parking / Pool legend entries follow the drawing.
async function staircase(k) {
  const { page, tag } = k;
  await page.evaluate((pts) => PC.store.commit((s) => { s.plot = { pts, closed: true }; s.ans.streetEdge = 0; s.ans.edgeOv = {}; }), TWELVE); await settled(page);
  await page.evaluate(() => PC.store.commit((s) => { const a = PC.debug.site().edgeAuto; for (let i = 1; i < a.length; i++) s.ans.edgeOv[i] = a[i] === 'side' ? 'back' : 'side'; })); await settled(page);
  for (const m of ['street', 'class']) {
    await k.mode(m);
    const r = await page.evaluate(() => {
      const L = PC.debug.siteLabels(), t = PC.debug.siteTicks(), s = PC.debug.site(), over = [];
      for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) { const p = L[a], q = L[b]; if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) over.push(p.text + ' / ' + q.text); }
      const c = document.querySelector('[data-pc="site-canvas"]').getBoundingClientRect(), P = s.ptsL.map((q) => { const v = PC.debug.toScreen('site', q[0], q[1]); return [v[0] - c.left, v[1] - c.top]; });
      const inside = (x, y) => { let k = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) k = !k; return k; };
      return { over, marked: L.filter((l) => l.text.endsWith('*')).length, ticks: t.length, front: L.some((l) => l.text === 'front'), inner: t.every((x) => inside(x.x + x.dx * 4, x.y + x.dy * 4)), n: P.length };
    });
    T.none(r.over, `${tag} staircase, ${m} mode: no two labels overlap`);
    T.ok(r.front && r.marked + r.ticks === r.n - 1 && r.inner, `${tag} staircase, ${m} mode: "front"; ${r.marked} "*" labels + ${r.ticks} ticks = ${r.n - 1} overridden edges; ticks on the inner side`);
  }
  // the area label: lighter style; a narrow footprint takes two lines or the street side
  await page.evaluate(() => PC.store.commit((s) => { s.plot = { pts: [[0, 0], [9, 0], [9, 40], [0, 40]], closed: true }; s.ans.streetEdge = 0; s.ans.edgeOv = {}; })); await settled(page);
  const a = await page.evaluate(() => { const r = PC.debug.siteArea(), f = PC.debug.site().footprint; return { r, fp: f && [f.u, f.v, f.w, f.d], fpw: f ? Math.abs(PC.debug.toScreen('site', f.u + f.w, 0)[0] - PC.debug.toScreen('site', f.u, 0)[0]) : 0 }; });
  T.ok(a.r && (a.r.mode === 'two' || a.r.mode === 'outside') && (a.r.mode !== 'two' || /^\d+$/.test(a.r.lines[0]) && a.r.lines[1] === 'm²'), `${tag} narrow footprint (${a.fpw.toFixed(0)} px wide): area label ${JSON.stringify(a.r)}`);
  // QA F5-T3a B-2: in ft the split is number / unit ("460" / "sq ft")
  // widen the plot until the ft label takes two lines, then check the split
  const aft = await page.evaluate(async () => {
    for (let w = 9; w <= 60; w += 0.5) {
      PC.store.commit((s) => { s.ans.unit = 'ft'; s.plot = { pts: [[0, 0], [w, 0], [w, 40], [0, 40]], closed: true }; s.ans.streetEdge = 0; });
      await new Promise((r) => setTimeout(r, 0));
      const a = PC.debug.siteArea(); if (a && a.mode === 'two') return { w, a };
    }
    return null;
  });
  T.ok(aft && /^\d+$/.test(aft.a.lines[0]) && aft.a.lines[1] === 'sq ft', `${tag} two-line area label in ft: ${JSON.stringify(aft)}`);
  await page.evaluate(() => PC.store.commit((s) => { s.ans.unit = 'm'; })); await settled(page);
  T.ok(await page.evaluate(() => PC.data.palette2d.font.area.startsWith('500 12px ') && PC.data.palette2d.label.area === '#46535F'), `${tag} area label style keys (500 12px, #46535F)`);
  // legend entries follow the drawing
  const leg = () => page.evaluate(() => ['site-legend-parking', 'site-legend-pool'].map((h) => document.querySelector(`[data-pc="${h}"]`).hidden));
  await page.evaluate(() => PC.store.commit((s) => { s.plot = PC.sample.state().plot; s.ans.streetEdge = PC.sample.state().ans.streetEdge; s.ans.pool = { on: false, size: 'M' }; s.ans.parking = { cars: 0, covered: false }; })); await settled(page);
  const off = await leg();
  await page.evaluate(() => PC.store.commit((s) => { s.ans.pool = { on: true, size: 'S' }; s.ans.parking = { cars: 1, covered: false }; })); await settled(page);
  const on = await leg(), drawn = await page.evaluate(() => { const s = PC.debug.site(); return [!!s.parking, !!s.pool]; });
  T.eq([off, on], [[true, true], [!drawn[0], !drawn[1]]], `${tag} Parking / Pool legend entries hidden without them, shown when drawn (${drawn})`);
  // the pool-size note (PM round 14)
  const note = () => page.evaluate(() => document.querySelector('[data-pc="q-pool-size-note"]').textContent);
  const m = await note(); await page.evaluate(() => PC.store.commit((s) => { s.ans.unit = 'ft'; })); await settled(page); const ft = await note();
  await page.evaluate(() => PC.store.commit((s) => { s.ans.unit = 'm'; })); await settled(page);
  // QA F5-T3a B-3: one line at 360 in m and in ft (14 px: the UI font on narrow phones; 12 px is not needed)
  const lines = (u) => page.evaluate(async (u) => { PC.store.commit((s) => { s.ans.unit = u; }); await new Promise((r) => setTimeout(r, 0));
    const e = document.querySelector('[data-pc="q-pool-size-note"]');
    const r = document.createRange(); r.selectNodeContents(e); const tops = new Set([...r.getClientRects()].map((x) => Math.round(x.top))); return [tops.size, getComputedStyle(e).fontSize]; }, u);
  await k.act('q-tab-outdoor'); await settled(page);
  const lm = await lines('m'), lf = await lines('ft');
  await k.act('q-tab-site'); await settled(page);
  await page.evaluate(() => PC.store.commit((s) => { s.ans.unit = 'm'; })); await settled(page);
  T.eq([lm, lf], [[1, '14px'], [1, '14px']], `${tag} pool-size note on one line in m and ft at 14 px (UI font on narrow phones, Designer B-3 rule)`);
  T.eq([m, ft], ['S 3 \u00D7 6 · M 4 \u00D7 8 · L 5 \u00D7 10 m', 'S 9.8 \u00D7 19.7 · M 13.1 \u00D7 26.2 · L 16.4 \u00D7 32.8 ft'], `${tag} pool-size note in the PM format`);
}

async function badDraft(vp) {
  const k = await kit(vp), { page, tag } = k;
  await sampleStage2(k);
  const good = await page.evaluate(() => PC.draft.serialize(PC.store.get(), 1));
  for (const [name, ov] of [['street edge', { 0: 'back' }], ['index out of range', { 7: 'side' }], ['unknown value', { 1: 'front' }]]) {
    const d = JSON.parse(good); d.state.ans.edgeOv = ov;
    await page.evaluate(([v]) => { PC.ui.autosave.flush(); localStorage.clear(); localStorage.setItem(PC.draft.KEY, v); }, [JSON.stringify(d)]);
    await page.reload();
    T.ok(await k.hidden('resume-box'), `${tag} draft with an override on the ${name}: discarded, nothing offered`);
    // TL ruling 2 (F3 fs-draft-fix-review, A-4): the draft keys go; the raw text is kept under the side key only.
    T.eq(await page.evaluate(() => Object.keys(localStorage).filter((x) => x.startsWith('plotcraft.draft')).sort()), ['plotcraft.draft.rejected'], `${tag} ...and removed`);
    T.eq(await page.evaluate(() => localStorage.getItem('plotcraft.draft.rejected')), JSON.stringify(d), `${tag} ...its raw text kept under the side key`);
  }
  await k.end('bad drafts');
}

try {
  // A-16 trim (F3-T3 first item, QA; docs/03-tasks/F3-T3/qa-trim.md): a function no longer runs at a viewport where its
  // twin section in tests/qa/f2-t3-site-rooms.mjs runs with the same input (VPS = 360x640, 640x360, 768x1024, 1280x800).
  //   scaleAndLabels        all four            (no single QA twin: kept)
  //   tapMode               768x1024            (twin: QA B at 360x640, 640x360 touch and 1280x800 mouse)
  //   keyboardList          640x360, 768x1024   (twin: QA C at 360x640, 1280x800)
  //   liveAndR5, clearing   640x360, 768x1024   (twin: QA D at 360x640, 1280x800)
  for (const vp of VPS) await scaleAndLabels(vp);
  await tapMode(VPS[2]);
  for (const vp of [VPS[1], VPS[2]]) { await keyboardList(vp); await liveAndR5(vp); await clearing(vp); }
  await badDraft(VPS[0]);
} catch (e) { T.ok(false, 'spec crashed: ' + (e && e.stack || e)); } finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
