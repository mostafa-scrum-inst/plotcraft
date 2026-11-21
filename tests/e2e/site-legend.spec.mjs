// F2-T2 Designer change (logged against F1-T1): on phones in portrait the site-preview legend is a one-line strip
// under a 176 px canvas instead of an overlay on the drawing. Layout only; the drawing scale is asserted by FS.
import { launch, open, suite, settled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e site-legend'), browser = await launch();
const PHONES = [VIEWPORTS[0], { tag: '360x740', w: 360, h: 740, touch: true }];
// Questions scroller height at hand-over, measured on the tree before this change (legend overlaying a 200 px canvas).
const SCROLL_BEFORE = { '360x640': 173.2, '360x740': 273.2 };
// Wider layouts are untouched: legend overlays the canvas 8 px from its left, right and bottom edges (none in short landscape).
const UNCHANGED = { '768x1024': { canvasH: 240, overlay: true }, '1280x800': { canvasH: 300, overlay: true }, '640x360': { canvasH: 200, overlay: false } };

const measure = (page) => page.evaluate(() => {
  const q = (h) => document.querySelector(`[data-pc="${h}"]`);
  const R = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, h: r.height }; };
  const lg = q('site-legend'), shown = getComputedStyle(lg).display !== 'none';
  return {
    preview: R(q('site-preview')), canvas: R(q('site-canvas')), legend: R(lg), shown, pos: getComputedStyle(lg).position,
    overflow: [lg.scrollWidth, lg.clientWidth],
    // hidden entries (site-legend-mark until an override exists, F2-T3) take no place in the strip
    items: [...lg.children].filter((li) => !li.hidden).map((li) => ({ ...R(li), text: li.textContent.trim(), clipped: li.scrollWidth > li.clientWidth + 0.5 })),
    scroll: R(document.querySelector('[data-stage="2"] .pc-qs__scroll')).h,
    scale: PC.debug.view('site').scale
  };
});

async function stage2(vp, unit) {
  const o = await open(browser, vp);
  await o.act('btn-sample'); await o.act('btn-next');
  await o.page.waitForFunction(() => !document.querySelector('[data-pc="q-group-site"]').hidden && document.querySelector('[data-pc="site-canvas"]').getBoundingClientRect().height > 0, null, { timeout: 3000 });
  if (unit === 'ft') { await o.page.locator('[data-pc="q-unit"] input[value="ft"]').check({ force: true }); await o.page.waitForFunction(() => PC.debug.state().ans.unit === 'ft', null, { timeout: 3000 }); }
  await settled(o.page);
  return o;
}

try {
  for (const vp of PHONES) for (const unit of ['m', 'ft']) {
    const { ctx, page, act, problems } = await stage2(vp, unit), at = `${vp.tag} ${unit}`, m = await measure(page);
    T.eq(m.items.map((i) => i.text), ['Front', 'Back', 'Side', 'Setback', 'Footprint'], `${at}: five legend items`);
    T.eq(new Set(m.items.map((i) => Math.round(i.top))).size, 1, `${at}: legend on one line`);
    for (const i of m.items) {
      T.ok(i.left >= m.legend.left - 0.5 && i.right <= m.legend.right + 0.5 && i.left >= m.preview.left - 0.5 && i.right <= m.preview.right + 0.5,
        `${at}: "${i.text}" inside legend and preview (${i.left.toFixed(1)}-${i.right.toFixed(1)})`);
      T.ok(i.top >= m.legend.top - 0.5 && i.bottom <= m.legend.bottom + 0.5 && !i.clipped, `${at}: "${i.text}" not clipped`);
    }
    T.ok(m.overflow[0] <= m.overflow[1], `${at}: legend content fits its box (${m.overflow[0]} > ${m.overflow[1]})`);
    T.ok(m.pos === 'static' && m.legend.top >= m.canvas.bottom - 0.5, `${at}: legend starts at or below the canvas bottom (${m.legend.top.toFixed(1)} vs ${m.canvas.bottom.toFixed(1)})`);
    T.ok(m.legend.bottom <= m.preview.bottom + 0.5, `${at}: legend inside the preview`);
    T.ok(Math.abs(m.canvas.h - 176) <= 0.5, `${at}: canvas 176 px high (${m.canvas.h})`);
    T.ok(m.preview.h <= 201, `${at}: preview at most 201 px high (${m.preview.h.toFixed(1)})`);
    T.ok(m.scroll >= SCROLL_BEFORE[vp.tag] - 0.5, `${at}: questions area ${m.scroll.toFixed(1)} px >= ${SCROLL_BEFORE[vp.tag]} before the change`);
    T.none(await A.noPageScroll(page), `${at}: no page scroll`);
    T.none(await A.tapTargets(page), `${at}: tap targets`);
    // Collapsed: legend goes with the canvas; expanded again: strip back under the canvas.
    await act('site-preview-toggle'); await page.waitForFunction(() => document.querySelector('[data-pc="site-preview"]').classList.contains('is-collapsed'), null, { timeout: 3000 });
    T.ok(await page.evaluate(() => getComputedStyle(document.querySelector('[data-pc="site-legend"]')).display === 'none'), `${at}: collapsed preview hides the legend`);
    await act('site-preview-toggle'); await page.waitForFunction(() => !document.querySelector('[data-pc="site-preview"]').classList.contains('is-collapsed'), null, { timeout: 3000 });
    await settled(page);
    const m2 = await measure(page);
    T.ok(m2.shown && m2.legend.top >= m2.canvas.bottom - 0.5 && Math.abs(m2.preview.h - m.preview.h) <= 0.5, `${at}: expanded again, same strip`);
    T.none(problems(), `${at}: clean log`);
    await ctx.close();
  }
  for (const vp of [VIEWPORTS[1], VIEWPORTS[2], LANDSCAPE]) for (const unit of ['m', 'ft']) {
    const { ctx, page, problems } = await stage2(vp, unit), at = `${vp.tag} ${unit}`, m = await measure(page), want = UNCHANGED[vp.tag];
    T.ok(Math.abs(m.canvas.h - want.canvasH) <= 0.5, `${at}: canvas height unchanged (${m.canvas.h}, expected ${want.canvasH})`);
    if (want.overlay) {
      T.ok(m.shown && m.pos === 'absolute', `${at}: legend still an overlay`);
      T.ok([m.legend.left - m.canvas.left, m.canvas.right - m.legend.right, m.canvas.bottom - m.legend.bottom].every((d) => Math.abs(d - 8) <= 0.5), `${at}: legend 8 px inside the canvas, at its bottom`);
    } else T.ok(!m.shown, `${at}: legend hidden in short landscape`);
    T.none(await A.noPageScroll(page), `${at}: no page scroll`);
    T.none(problems(), `${at}: clean log`);
    await ctx.close();
  }
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
