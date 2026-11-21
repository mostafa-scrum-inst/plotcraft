// Shared scenario session for the QA flow suites (F1-T2 onwards): one browser context, real input, state readers.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, openPage, cleanLog, until, settled } from './lib.mjs';

const INPAGE = readFileSync(join(ROOT, 'tests/qa/inpage.js'), 'utf8');
// Draft key and version of the build under test, read from the page when a session opens (A-4: 'plotcraft.draft.v' +
// PC.DRAFT_V; from draft v2 on PC.draft.KEYS lists the current key first, then the older ones it migrates from).
export const PAGE = { V: 1, KEY: 'plotcraft.draft.v1', KEYS: ['plotcraft.draft.v1'], stretch: false, layout: false, editor: false, house: false };   // house: !!(PC.house && PC.house.build) (F4-T1 stage-5 controller)   // editor: PC.stages.MAX_BUILT >= 5 (F3-T2 plan editor and stage 4)   // layout: PC.layout exists (F3-T1)
export let KEY = PAGE.KEY;
// A real pause. Only for durations that are themselves under test (say which in a comment at the call); to wait for the
// UI use s.settle(), s.until(), s.waitDraft() or s.flush().
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const sel = (h) => `[data-pc="${h}"]`;

// R: collector; shots: directory for screenshots; noShots: skip them.
export function sessions({ R, shots, noShots }) {
// One browser context per scenario. Storage persists across reload() inside a context, never across contexts.
async function session(browser, vp, opts = {}) {
  const { ctx, page, log } = await openPage(browser, vp, opts);
  if (!opts.noGoto) { Object.assign(PAGE, await page.evaluate(() => ({ V: PC.DRAFT_V, KEY: PC.draft.KEY, KEYS: (PC.draft.KEYS || [PC.draft.KEY]).slice(), stretch: PC.C.FOOTPRINT_STRETCH_RATIO !== undefined, layout: typeof PC.layout === 'object', editor: PC.stages.MAX_BUILT >= 5, house: !!(PC.house && PC.house.build) }))); KEY = PAGE.KEY; }
  const S = {
    ctx, page, log, vp,
    // Real input at the control's centre (touchscreen tap or mouse click). The control must be rendered and be the hit target
    // there (or own it through its label); aria-disabled controls are tapped too, as a user would.
    act: async (h) => {
      // h: a data-pc hook, or 'css:<selector>' for controls without a hook of their own (radio labels).
      const probe = () => page.evaluate((h) => { const el = document.querySelector(h.startsWith('css:') ? h.slice(4) : `[data-pc="${h}"]`); if (!el || el.closest('[hidden]')) return { err: 'not shown' }; el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); if (!r.width || !r.height) return { err: 'no box' }; const x = r.left + r.width / 2, y = r.top + r.height / 2, hit = document.elementFromPoint(x, y), lab = el.closest('label'); if (!(hit && (hit === el || el.contains(hit) || (lab && lab.contains(hit))))) return { err: 'covered by ' + (hit && (hit.dataset.pc || hit.className)) }; return { x, y }; }, h);
      let p = null; const ok = await until(async () => { p = await probe(); return !p.err; }, 5000);   // wait for the control instead of sleeping
      if (!ok) throw new Error(`act(${h}): ${p.err} after 5 s`);
      if (!vp.touch) { await page.mouse.click(p.x, p.y); await S.settle(); return; }
      // Touch: Chrome drops the synthesized click of a tap that follows an injected touch gesture within ~100 ms (a CDP
      // quirk, see qa-report F1-T3). So confirm that a click reached the control and tap again if it did not. A control
      // that never gets its click (a real bug, e.g. preventDefault on touchstart) still fails here after three taps.
      for (let i = 0; i < 3; i++) {
        await page.evaluate((h) => { const el = document.querySelector(h.startsWith('css:') ? h.slice(4) : `[data-pc="${h}"]`); window.__qaClick = false; (el.closest('label') || el).addEventListener('click', () => { window.__qaClick = true; }, { once: true, capture: true }); }, h);
        await page.touchscreen.tap(p.x, p.y); await S.settle();
        if (await page.evaluate(() => window.__qaClick)) { if (i) S.retaps = (S.retaps || 0) + i; return; }
        p = await probe(); if (p.err) return;                                   // the control went away: the tap was handled
      }
      throw new Error(`act(${h}): three taps produced no click on the control`);
    },
    settle: (o) => settled(page, o),
    until: (pred, ms) => until(pred, ms),
    // Run the debounced autosave now (same function the 400 ms timer calls), so "nothing was written" can be asserted without waiting.
    flush: () => page.evaluate(() => { PC.ui.autosave.flush(); }),
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(PC.debug.state()))),
    // raw / setRaw: the current draft key of the build; rawKey / setRawKey: any key (older draft versions).
    raw: () => S.rawKey(PAGE.KEY),
    setRaw: (v) => S.setRawKey(PAGE.KEY, v),
    rawKey: (k) => page.evaluate((k) => { try { return window.localStorage.getItem(k); } catch (e) { return 'ERR:' + e.name; } }, k),
    setRawKey: (k, v) => page.evaluate(([k, v]) => { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }, [k, v]),
    shown: (h) => page.evaluate((h) => { const el = document.querySelector(`[data-pc="${h}"]`); if (!el || el.closest('[hidden]')) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, h),
    text: (h) => page.evaluate((h) => document.querySelector(`[data-pc="${h}"]`).textContent.trim().replace(/\s+/g, ' '), h),
    stages: () => page.evaluate(() => [...document.querySelectorAll('[data-stage]')].filter((s) => !s.hidden).map((s) => s.dataset.stage).join()),
    step: (n) => page.evaluate((n) => { const b = document.querySelector(`[data-pc="step-${n}"]`); return { cur: b.classList.contains('is-current'), done: b.classList.contains('is-done'), locked: b.classList.contains('is-locked'), ariaCur: b.getAttribute('aria-current'), ariaDis: b.getAttribute('aria-disabled'), disabled: b.disabled, title: b.title, pe: getComputedStyle(b).pointerEvents }; }, n),
    steps: async () => { const o = []; for (let n = 1; n <= 5; n++) { const s = await S.step(n); o.push(s.cur ? 'C' : s.locked ? 'L' : s.done ? 'D' : 'a'); } return o.join(''); },
    bar: () => page.evaluate(() => { const q = (h) => document.querySelector(`[data-pc="${h}"]`); return { back: !q('btn-back').disabled, next: !q('btn-next').disabled && !q('btn-next').hidden, nextHidden: q('btn-next').hidden, label: q('btn-next-label').textContent }; }),
    toasts: () => page.evaluate(() => [...document.querySelectorAll('[data-pc="toast-region"] [data-pc="toast-text"]')].map((t) => t.textContent)),
    // stage 5 with the F4-T1 controller: building / unavailable overlays, panel and canvas shown
    v3: () => page.evaluate(() => { const q = (h) => document.querySelector(`[data-pc="${h}"]`), vis = (h) => { const e = q(h); if (!e || e.hidden || e.closest('[hidden]')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, inView = (h) => { const r = q(h).getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; };
      return { building: vis('v3-building'), unavailable: vis('v3-unavailable'), unavailableInView: vis('v3-unavailable') && inView('v3-unavailable'), panel: vis('v3-panel'), canvas: vis('v3-canvas') }; }),
    banners: () => page.evaluate(() => [...document.querySelectorAll('[data-pc="banner-slot"] [data-pc="banner-text"]')].map((t) => t.textContent)),
    dialogOpen: () => page.evaluate(() => !document.querySelector('[data-pc="dialog-layer"]').hidden),
    focus: () => page.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'BODY' : (a.dataset.pc || a.tagName.toLowerCase() + (a.name ? ':' + a.name : '')); }),
    waitDraft: async (pred, ms = 2500) => { const t0 = Date.now(); for (;;) { const r = await S.raw(); let d = null; try { d = JSON.parse(r); } catch (e) {} if (pred(d, r)) return true; if (Date.now() - t0 > ms) return false; await sleep(60); } },
    reload: async () => { await page.reload(); await S.settle(); },
    layout: async (label, { dialog = false, scope = null } = {}) => {   // scope: an open overlay (sheet) judged on its own // F1-T1 layout rules must hold in live states too
      await S.settle({ motion: true }); // colour transitions (120-180 ms) must have ended before contrast is measured
      await page.evaluate(INPAGE);
      R.check(`${label} no page scroll`, await page.evaluate(() => __qa.C.pageScroll()));
      R.check(`${label} targets >= 44 px`, await page.evaluate(() => __qa.C.targets(44)));
      R.check(`${label} stepper one line`, await page.evaluate(() => __qa.C.stepper()));
      if (!dialog) R.check(`${label} Back/Next in view`, await page.evaluate(() => __qa.C.bar()));
      R.check(`${label} nothing clipped`, await page.evaluate(() => __qa.C.clipped()));
      R.check(`${label} text fits`, await page.evaluate(() => __qa.C.textFit()));
      R.check(`${label} no overlapping controls`, await page.evaluate((sc) => __qa.C.overlap(sc), dialog ? '.pc-dialog-layer' : scope));
      if (scope) R.check(`${label} every control of the open overlay hittable`, await page.evaluate((sc) => __qa.C.hittable(sc), scope));
      R.check(`${label} text contrast >= 4.5`, (await page.evaluate(() => __qa.C.contrast(4.5))).fail);
    },
    shot: async (name) => { if (!noShots) await page.screenshot({ path: join(shots, `${name}-${vp.tag}.png`) }); },
    end: async (label) => { R.check(`${label}: no console errors, native dialogs or stray requests`, cleanLog(log)); await ctx.close(); },
  };
  return S;
}

  return session;
}

// What 6.2 + 4.1 say the sample is, written from the PM document (not from src/js/core/sample.js).
export function sampleProblems(s) {
  const f = [], a = s.ans, AREA = { bedroom: { S: 12, M: 16, L: 24 }, bathroom: { S: 4, M: 6, L: 9 }, kitchen: { S: 9, M: 14, L: 20 }, living: { S: 20, M: 30, L: 42 }, dining: { S: 12, M: 16, L: 24 }, majlis: { S: 16, M: 24, L: 36 }, office: { S: 9, M: 12, L: 16 }, maid: { S: 6, M: 9, L: 12 }, storage: { S: 4, M: 6, L: 9 }, laundry: { S: 4, M: 6, L: 9 } };
  const want = (name, got, exp) => { if (!eq(got, exp)) f.push(`${name}: ${JSON.stringify(got)} != ${JSON.stringify(exp)}`); };
  want('plot', s.plot, { pts: [[0, 0], [20, 0], [20, 30], [8, 30], [0, 26]], closed: true });
  want('v', s.v, PAGE.V); if (PAGE.V >= 2) want('edgeOv', a.edgeOv, {}); want('unit', a.unit, 'm'); want('setbacks', [a.setbacks.front, a.setbacks.back, a.setbacks.side], [3, 2, 2]);
  want('footprint/veg', [a.footprintPct, a.vegPct], [25, 25]); want('north', a.north, null);
  if (!(a.streetEdge === 0 || a.streetEdge === null)) f.push('streetEdge ' + a.streetEdge);
  want('building', [a.floors, a.basement, a.usableRoof, a.ceilingH, a.roofType, a.exterior], [2, false, false, 3, 'flat', 'sand']);
  const lvl = (L) => a.rooms.filter((r) => r.level === L).map((r) => `${r.type}:${r.size}`).sort().join();
  want('ground rooms', lvl('G'), ['living:L', 'majlis:M', 'dining:M', 'kitchen:M', 'maid:S', 'bathroom:S', 'laundry:S'].sort().join());
  want('first rooms', lvl('1'), ['bedroom:L', 'bedroom:M', 'bedroom:M', 'living:M', 'office:M', 'bathroom:M', 'bathroom:M'].sort().join());
  want('room count', a.rooms.length, 14);
  for (const L of ['G', '1']) want(`area ${L}`, a.rooms.filter((r) => r.level === L).reduce((n, r) => n + AREA[r.type][r.size], 0), 110);
  if (a.rooms.some((r) => r.area !== null)) f.push('exact areas present');
  const masters = a.rooms.filter((r) => r.master); want('master', masters.map((r) => `${r.type}:${r.level}:${r.size}`), ['bedroom:1:L']);
  const byId = Object.fromEntries(a.rooms.map((r) => [r.id, r])); if (new Set(a.rooms.map((r) => r.id)).size !== 14) f.push('room ids not unique');
  const pairs = a.pairs.map((p) => p.map((id) => byId[id] ? `${byId[id].type}:${byId[id].level}${byId[id].master ? ':master' : ''}` : '?').sort().join('+')).sort();
  want('pairs', pairs, ['dining:G+kitchen:G', 'bathroom:1+bedroom:1:master'].sort());
  want('stairs', [a.stairPos, a.lift], ['centre', false]); want('parking', a.parking, { cars: 2, covered: true }); want('pool', a.pool, { on: true, size: 'S' });
  want('extras', [a.extras.wall, a.extras.gate, a.extras.seating], [true, 'centre', true]); want('interior', a.interior, { style: 'modern', density: 'full' });
  return f;
}
export const DEFAULT_ROOMS = ['living:G:M', 'kitchen:G:M', 'bathroom:G:M', 'bedroom:1:M', 'bedroom:1:M', 'bathroom:1:M'].sort().join();
export function defaultProblems(s) { // 4.1 defaults, empty project
  const f = [], a = s.ans; const want = (n, g, e) => { if (!eq(g, e)) f.push(`${n}: ${JSON.stringify(g)} != ${JSON.stringify(e)}`); };
  want('stage', s.stage, 1); want('sampleClean', s.sampleClean, false); want('v', s.v, PAGE.V); if (PAGE.V >= 2) want('edgeOv', a.edgeOv, {}); want('plot', s.plot, { pts: [], closed: false }); want('plans', s.plans, {});
  want('site', [a.unit, a.setbacks.front, a.setbacks.back, a.setbacks.side, a.footprintPct, a.vegPct, a.north, a.streetEdge], ['m', 3, 2, 2, 30, 20, null, null]);
  want('building', [a.floors, a.basement, a.usableRoof, a.ceilingH, a.roofType, a.exterior], [2, false, false, 3, 'flat', 'sand']);
  want('rooms', a.rooms.map((r) => `${r.type}:${r.level}:${r.size}`).sort().join(), DEFAULT_ROOMS); want('pairs', a.pairs, []);
  want('rest', [a.stairPos, a.lift, a.parking.cars, a.parking.covered, a.pool.on, a.pool.size, a.extras.wall, a.extras.gate, a.extras.seating, a.interior.style, a.interior.density], ['centre', false, 1, false, false, 'S', true, 'centre', false, 'modern', 'full']);
  return f;
}
