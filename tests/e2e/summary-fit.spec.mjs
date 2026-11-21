// F2-T2 Designer fix (QA F2-T2 bug 2): every stage-2 summary figure is shown in full (no ellipsis), at every
// viewport, in m and ft, with the sample and with the largest realistic figures (100 x 100 m plot, 4 levels).
import { launch, open, suite, settled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e summary-fit'), browser = await launch();
const CASES = [
  { name: 'sample 3 floors 10 %', ans: { floors: 3, footprintPct: 10 } },
  { name: '100 x 100 m worst', plot: [[0, 0], [100, 0], [100, 100], [0, 100]], ans: { footprintPct: 80, vegPct: 20, floors: 3, basement: true, setbacks: { front: 0, back: 0, side: 0 } } }
];

const measure = (page) => page.evaluate(() => {
  const body = document.querySelector('[data-pc="summary"] .pc-sheet__body');
  const out = [];
  for (const dd of body.querySelectorAll('dd')) {
    const cell = dd.closest('.pc-tb__cell'), r = dd.getBoundingClientRect(), c = cell.getBoundingClientRect(), dt = cell.querySelector('dt').getBoundingClientRect();
    const hit = !(r.right <= dt.left || dt.right <= r.left || r.bottom <= dt.top || dt.bottom <= r.top);
    out.push({ label: cell.querySelector('dt').textContent.trim(), text: dd.textContent.trim(), sw: dd.scrollWidth, cw: dd.clientWidth,
      inside: r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5, hit, lines: (() => { const g = document.createRange(); g.selectNodeContents(dd); return new Set([...g.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.bottom))).size; })() });
  }
  return { rows: out, bodyOverflow: body.scrollWidth > body.clientWidth + 0.5 };
});

try {
  for (const vp of [VIEWPORTS[0], VIEWPORTS[1], VIEWPORTS[2], LANDSCAPE]) for (const cs of CASES) for (const unit of ['m', 'ft']) {
    const { ctx, page, act, hook, problems } = await open(browser, vp), at = `${vp.tag} ${cs.name} ${unit}`;
    if (cs.plot) await page.evaluate((pts) => PC.store.commit((s) => { s.plot = { pts, closed: true }; s.ans.streetEdge = 0; }), cs.plot);
    else await act('btn-sample');
    await page.evaluate(([a, u]) => PC.store.commit((s) => { Object.assign(s.ans, JSON.parse(JSON.stringify(a))); s.ans.unit = u; }), [cs.ans, unit]);
    await act('btn-next');
    await page.waitForFunction(() => !document.querySelector('[data-stage="2"]').hidden && document.querySelectorAll('[data-pc="sum-levels"] > *').length > 0, null, { timeout: 3000 });
    const sheet = await page.evaluate(() => getComputedStyle(document.querySelector('[data-pc="summary-toggle"]')).cursor !== 'default');
    if (sheet) { await act('summary-toggle'); await page.waitForFunction(() => !document.querySelector('[data-pc="summary"]').classList.contains('is-collapsed'), null, { timeout: 3000 }); }
    await settled(page);
    const m = await measure(page), sfx = unit === 'ft' ? 'sq ft' : 'm²';
    T.ok(m.rows.length >= (cs.plot ? 8 : 7), `${at}: summary has its rows (${m.rows.length})`);
    T.ok(m.rows.some((r) => r.text.includes(sfx)), `${at}: figures in ${unit}`);
    for (const r of m.rows) {
      T.ok(r.sw <= r.cw + 0.5, `${at}: "${r.label}" figure "${r.text}" shown in full (${r.sw} > ${r.cw})`);
      T.ok(r.inside && !r.hit, `${at}: "${r.label}" figure inside its row, clear of its label`);
      T.ok(r.lines <= 1, `${at}: "${r.label}" figure on one line`);
    }
    T.ok(!m.bodyOverflow, `${at}: summary body does not scroll sideways`);
    T.none(await A.noPageScroll(page), `${at}: no page scroll`);
    T.none(await A.barInViewport(page), `${at}: Back / Next in view`);
    T.none(problems(), `${at}: clean log`);
    void hook; await ctx.close();
  }
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
