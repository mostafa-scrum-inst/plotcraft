// F5-T3a Designer: site-preview legend line count with every optional entry shown (Parking, Pool, "* set by you").
// node docs/03-tasks/F5-T3/verify/legend.mjs
import { launch, open, settled, VIEWPORTS, LANDSCAPE } from '../../../../tests/helpers/browser.mjs';
const browser = await launch();
for (const vp of [VIEWPORTS[1], VIEWPORTS[2], LANDSCAPE]) for (const mark of ['set by you', 'by you']) {
  const o = await open(browser, vp);
  await o.act('btn-sample'); await o.act('btn-next'); await settled(o.page);
  const r = await o.page.evaluate((mark) => {
    const lg = document.querySelector('[data-pc="site-legend"]');
    for (const li of lg.children) li.hidden = false;
    const m = lg.querySelector('.pc-legend__mark'); m.lastChild.textContent = mark;
    const vis = [...lg.children].filter((li) => getComputedStyle(li).display !== 'none');
    const c = document.querySelector('[data-pc="site-canvas"]').getBoundingClientRect(), l = lg.getBoundingClientRect();
    return { shown: getComputedStyle(lg).display !== 'none', lines: new Set(vis.map((li) => Math.round(li.getBoundingClientRect().top))).size, legendH: Math.round(l.height), legendW: Math.round(l.width), canvasH: Math.round(c.height) };
  }, mark);
  console.log(vp.tag, JSON.stringify(mark), JSON.stringify(r));
  await o.ctx.close();
}
await browser.close();
