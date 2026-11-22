// F1-T1 (Designer): on a phone with no draft waiting, the start panel is only a floating "Load sample project" button
// and must leave the plot grid tappable; with a draft waiting the full card (Resume / Start new) is shown.
import { launch, open, suite, VIEWPORTS } from '../helpers/browser.mjs';

const T = suite('e2e start-card'), browser = await launch();
const measure = (page) => page.evaluate(() => {
  const q = (h) => document.querySelector(`[data-pc="${h}"]`);
  const p = q('start-panel').getBoundingClientRect(), c = q('plot-canvas').getBoundingClientRect(), b = q('btn-sample').getBoundingClientRect();
  const covered = Math.max(0, Math.min(p.bottom, c.bottom) - Math.max(p.top, c.top));
  const at = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.dataset.pc || e.closest('[data-pc]')?.dataset.pc || e.tagName) : null; };
  return {
    supportsHas: CSS.supports('selector(:has(*))'), panelHidden: q('start-panel').hidden, resumeHidden: q('resume-box').hidden,
    covered, canvasH: c.height, btn: { w: b.width, h: b.height, bottomGap: c.bottom - b.bottom, centreOff: Math.abs((b.left + b.right) / 2 - (c.left + c.right) / 2) },
    // points beside the button, inside the panel's row, and just above it: all must reach the canvas
    leftOfBtn: at(c.left + 6, (b.top + b.bottom) / 2), rightOfBtn: at(c.right - 6, (b.top + b.bottom) / 2), aboveBtn: at((c.left + c.right) / 2, p.top - 6),
    onBtn: at((b.left + b.right) / 2, (b.top + b.bottom) / 2),
    hintShown: !!document.querySelector('.pc-start__hint').getClientRects().length
  };
});
try {
  { // no draft, phone
    const { ctx, page, problems } = await open(browser, VIEWPORTS[0]);
    const m = await measure(page);
    T.ok(m.supportsHas, 'test browser supports :has()');
    T.ok(!m.panelHidden && m.resumeHidden, 'no draft: start panel shown, resume box hidden');
    T.ok(m.covered <= 60, `no draft at 360x640: start panel covers ${m.covered.toFixed(0)} px of canvas height (limit 60)`);
    T.ok(m.btn.h >= 44 && m.btn.w >= 44, `Load sample button is ${m.btn.w.toFixed(0)}x${m.btn.h.toFixed(0)}`);
    T.ok(m.btn.centreOff <= 1 && m.btn.bottomGap >= 7 && m.btn.bottomGap <= 9, `button at bottom centre (gap ${m.btn.bottomGap.toFixed(1)}, off-centre ${m.btn.centreOff.toFixed(1)})`);
    T.ok(!m.hintShown, 'hint paragraph not shown');
    T.ok(m.leftOfBtn === 'plot-canvas' && m.rightOfBtn === 'plot-canvas' && m.aboveBtn === 'plot-canvas', `grid reachable around the button (${m.leftOfBtn}, ${m.rightOfBtn}, ${m.aboveBtn})`);
    T.ok(m.onBtn === 'btn-sample', `button itself takes the tap (${m.onBtn})`);
    T.none(problems(), 'no errors (no draft)');
    await ctx.close();
  }
  { // draft waiting, phone: the full card stays (forced through the hook, the layout is what is under test)
    const { ctx, page, problems } = await open(browser, VIEWPORTS[0]);
    await page.evaluate(() => { document.querySelector('[data-pc="resume-box"]').hidden = false; });
    const m = await measure(page);
    T.ok(m.hintShown && m.covered > 60, `draft waiting: full card shown (${m.covered.toFixed(0)} px)`);
    T.ok(m.onBtn === 'btn-sample', 'card: Load sample still tappable');
    T.none(problems(), 'no errors (draft)');
    await ctx.close();
  }
  { // desktop: card lives in the side panel, not over the canvas
    const { ctx, page, problems } = await open(browser, VIEWPORTS[2]);
    const m = await measure(page);
    T.ok(m.hintShown, 'desktop: start card in the side panel with its hint');
    T.none(problems(), 'no errors (desktop)');
    await ctx.close();
  }
  // TL ruling 2 (docs/03-tasks/F3-T3/fs-draft-fix-review.md, A-4): a stored draft that parse rejects is not offered,
  // its raw text is kept under plotcraft.draft.rejected before the draft keys go; Load sample leaves the side key alone;
  // an empty draft is removed with no copy; nothing breaks when localStorage throws.
  const SIDE = 'plotcraft.draft.rejected';
  const keys = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  { // corrupted draft under the current key
    const o = await open(browser, VIEWPORTS[0]), { ctx, page, problems } = o;
    const raw = await page.evaluate(() => {
      const s = JSON.parse(JSON.stringify(PC.sample.state())); s.ans.rooms[0].type = 'ballroom';
      const t = PC.draft.serialize(s, 1700000000000); localStorage.setItem(PC.draft.KEY, t); return t;
    });
    await page.reload();
    T.ok(await page.evaluate(() => document.querySelector('[data-pc="resume-box"]').hidden), 'rejected draft: no Resume card');
    T.eq(await keys(page), { [SIDE]: raw }, 'rejected draft: draft key removed, side key holds the raw text exactly');
    await o.act('btn-sample');
    T.eq((await keys(page))[SIDE], raw, 'Load sample leaves the side key alone');
    T.none(problems(), 'rejected draft: clean log');
    await ctx.close();
  }
  // Seeded before the page's scripts, once per context (the init script also runs on reloads).
  const seeded = (items) => open(browser, VIEWPORTS[0], { init: `if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); ${
    Object.entries(items).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join(' ')} }` });
  { // unparseable v1 draft, an older side copy present
    const { ctx, page, problems } = await seeded({ 'plotcraft.draft.v1': '{not json', [SIDE]: 'older copy' });
    T.ok(await page.evaluate(() => document.querySelector('[data-pc="resume-box"]').hidden), 'unparseable v1 draft: no Resume card');
    T.eq(await keys(page), { [SIDE]: '{not json' }, 'unparseable v1 draft: copied over the older copy, draft keys gone');
    T.none(problems(), 'unparseable v1 draft: clean log');
    await ctx.close();
  }
  { // a valid but empty draft: removed as before, no copy
    const { ctx, page, problems } = await open(browser, VIEWPORTS[0]);
    await page.evaluate(() => localStorage.setItem(PC.draft.KEY, PC.draft.serialize(PC.store.defaults(), 1)));
    await page.reload();
    T.eq(await keys(page), {}, 'empty draft: removed with no copy');
    T.none(problems(), 'empty draft: clean log');
    await ctx.close();
  }
  { // localStorage property throws
    const { ctx, page, problems } = await open(browser, VIEWPORTS[0], { storage: 'throw' });
    T.ok(await page.evaluate(() => !PC.ui.storage.available && PC.ui.storage.keepRejected('x') === false), 'storage blocked: keepRejected is a no-op');
    T.none(problems(), 'storage blocked: clean log');
    await ctx.close();
  }
  { // reads work, every write throws (quota), with a corrupted draft stored
    const init = () => {
      if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('plotcraft.draft.v2', '{"v":2,"broken":'); }
      Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };
    };
    const { ctx, page, problems } = await open(browser, VIEWPORTS[0], { init });
    T.ok(await page.evaluate(() => document.querySelector('[data-pc="resume-box"]').hidden && !document.querySelector('[data-pc="start-panel"]').hidden),
      'quota: rejected draft not offered, start panel shown');
    T.ok(await page.evaluate(() => localStorage.getItem('plotcraft.draft.rejected') === null && !PC.ui.storage.available), 'quota: no side copy, storage marked unavailable');
    T.none(problems(), 'quota: clean log');
    await ctx.close();
  }
  // F5-T3a (TL ruling 4): full quota at start with a valid draft stored: the read-only state offers Resume, the
  // no-save note and the header chip show, nothing is ever written, Start new still asks first
  {
    const src = await open(browser, VIEWPORTS[0]);
    await src.act('btn-sample');
    const draft = await src.page.evaluate(() => PC.draft.serialize(PC.store.get(), 1700000000000));
    await src.ctx.close();
    const init = `if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('plotcraft.draft.v2', ${JSON.stringify(draft)}); }
      window.__writes = 0; Storage.prototype.setItem = function () { window.__writes++; throw new DOMException('full', 'QuotaExceededError'); };
      Storage.prototype.removeItem = function () { window.__writes++; throw new DOMException('full', 'QuotaExceededError'); };`;
    const o = await open(browser, VIEWPORTS[0], { init }), { ctx, page, act, hook, problems } = o;
    const vis = (h) => page.evaluate((h) => { const e = document.querySelector(`[data-pc="${h}"]`); return !e.hidden && e.getClientRects().length > 0; }, h);
    T.ok(await page.evaluate(() => PC.ui.storage.canRead && !PC.ui.storage.canWrite && !PC.ui.storage.available), 'read-only: canRead, not canWrite');
    T.eq(await page.evaluate(() => window.__writes), 1, 'read-only: the probe write is the only attempt at boot');
    T.ok(await vis('resume-box') && await vis('note-nosave') && await vis('nosave-chip'), 'read-only: Resume offered, the no-save note and the header chip shown');
    const chip = await hook('nosave-chip').boundingBox();
    T.ok(chip.width >= 44 - 0.5 && chip.height >= 44 - 0.5, `no-save chip ${chip.width.toFixed(0)}x${chip.height.toFixed(0)} px`);
    T.eq(await page.evaluate(() => [document.querySelector('[data-pc="nosave-chip"]').getAttribute('aria-label'), document.querySelector('[data-pc="nosave-chip"]').title]),
      ['Drafts are not saved on this device', 'Drafts are not saved on this device'], 'chip aria-label and title (PM round 14)');
    await act('btn-resume');
    T.ok(await page.evaluate(() => PC.store.get().plot.pts.length > 0 && PC.store.get().sampleClean !== undefined), 'read-only: Resume restores the stored draft');
    await page.evaluate(() => PC.ui.autosave.flush());
    await act('btn-next');
    await page.evaluate(() => PC.ui.autosave.flush());
    T.ok(await vis('nosave-chip'), 'read-only: the chip stays on the next stage');
    await act('nosave-chip');
    T.eq(await page.evaluate(() => [...document.querySelectorAll('[data-pc="toast-text"]')].map((e) => e.textContent)), ['Drafts are not saved on this device. Your work will be lost when you close or reload the page.'], 'chip tap: the PM toast');
    T.eq(await page.evaluate(() => [window.__writes, localStorage.getItem('plotcraft.draft.v2') !== null]), [1, true], 'read-only: no write attempted after the probe (Resume, edits, autosave), the stored draft kept');
    // a reload offers it again; Start new still asks before discarding
    await page.reload();
    await act('btn-startnew');
    T.ok(await vis('dialog-layer'), 'read-only: Start new asks first');
    await act('dialog-cancel');
    T.none(problems(), 'read-only: clean log');
    await ctx.close();
  }
  // F5-T3a: saving stops mid-session -> one toast (PM round 14) and the chip; a unit change drops measurement toasts
  {
    const o = await open(browser, VIEWPORTS[2]), { ctx, page, act, problems } = o;
    const toasts = () => page.evaluate(() => [...document.querySelectorAll('[data-pc="toast-text"]')].map((e) => e.textContent));
    await act('btn-sample'); await page.evaluate(() => PC.ui.autosave.flush());
    T.ok(await page.evaluate(() => document.querySelector('[data-pc="nosave-chip"]').hidden), 'saving works: no chip');
    await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
    await act('btn-next'); await page.evaluate(() => PC.ui.autosave.flush());
    const STOP = 'Saving has stopped: this browser\'s storage is full or blocked. Your work stays on screen but will be lost when you close or reload the page.';
    T.eq(await toasts(), [STOP], 'saving stopped: the PM toast');
    T.ok(await page.evaluate(() => !document.querySelector('[data-pc="nosave-chip"]').hidden), 'saving stopped: the chip appears');
    await page.evaluate(() => { document.querySelectorAll('.pc-toast').forEach((e) => e.remove()); });
    await act('btn-back'); await page.evaluate(() => PC.ui.autosave.flush());
    T.ok(!(await toasts()).includes(STOP), 'saving stopped: shown once per session');
    // unit change: a toast raised with { units: true } goes, others stay
    await page.evaluate(() => { PC.ui.toast('Minimum 538 sq ft', { units: true }); PC.ui.toast('Unrelated note'); });
    await page.locator('label:has(> [data-pc="unit-ft"])').click();
    T.eq((await toasts()).filter((t) => t !== STOP), ['Unrelated note'], 'unit change: the measurement toast is dropped, the other kept');
    T.none(problems(), 'saving stopped: clean log');
    await ctx.close();
  }
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
