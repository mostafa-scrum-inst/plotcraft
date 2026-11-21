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
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
