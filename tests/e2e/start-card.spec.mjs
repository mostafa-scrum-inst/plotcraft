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
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
