// F6-T1 Designer: the 3D look on real r128 (SwiftShader), sample + G6 maximum house, noon + evening (17.5 h), summer,
// 1280x800 + 360x640, Reset view, panel collapsed (the model unobstructed) and expanded (as the user first sees it).
//   node docs/03-tasks/F6-T1/verify/shots.mjs [outDir] [--all]   (default docs/03-tasks/F6-T1/before)
import { launch, open, VIEWPORTS } from '../../../../tests/helpers/browser.mjs';
import { loadCore } from '../../../../tests/helpers/load.mjs';
import { sampleApproved, maxHouse } from '../../../../tests/helpers/houses.mjs';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || join(dirname(fileURLToPath(import.meta.url)), '..', 'before'));
mkdirSync(OUT, { recursive: true });
const PC = loadCore(), HOUSES = { sample: sampleApproved(PC), max: maxHouse(PC) };
const LOOKS = { noon: 12, evening: 17.5 };
const browser = await launch();
for (const vp of [VIEWPORTS[2], VIEWPORTS[0]]) for (const [hn, st] of Object.entries(HOUSES)) {
  const o = await open(browser, vp, { three: 'real' }), { page } = o;
  await page.evaluate((st) => PC.store.replace(st), st);
  await page.waitForFunction(() => { const i = PC.debug.scene(); return i && i.renders > 0 && !i.building; }, null, { timeout: 30000 });
  for (const [ln, hour] of Object.entries(LOOKS)) {
    await page.evaluate((hour) => PC.view3d.setLook({ hour, season: 'summer' }), hour);
    for (const panel of ['open', 'closed']) {
      const collapsed = () => page.evaluate(() => document.querySelector('[data-pc="v3-panel"]').classList.contains('is-collapsed'));
      if (await collapsed()) await o.act('v3-panel-toggle');
      if (await o.hook('v3-tab-view').isVisible()) await o.act('v3-tab-view');
      await o.act('v3-reset');   // Reset lives in the View pane: open the panel first, then collapse for the clean frame
      if (panel === 'closed') await o.act('v3-panel-toggle');
      await page.waitForTimeout(400);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.screenshot({ path: join(OUT, `${hn}-${ln}-${vp.tag}-${panel}.jpg`), quality: 82 });
    }
  }
  const errs = o.problems(); if (errs.length) console.log(hn, vp.tag, errs);
  await o.ctx.close();
}
// The C-6.5 set beyond the core grid (after-shots): sample, 1280x800 and 360x640, panel closed: morning 8 h and night
// 22 h (summer), autumn and winter at noon, and the four Q10 exteriors at noon.
if (process.argv.includes('--all')) for (const vp of [VIEWPORTS[2], VIEWPORTS[0]]) {
  const extra = [['morning', 8, 'summer', 'sand'], ['night', 22, 'summer', 'sand'], ['autumn', 12, 'autumn', 'sand'], ['winter', 12, 'winter', 'sand'],
    ['white', 12, 'summer', 'white'], ['terracotta', 12, 'summer', 'terracotta'], ['grey', 12, 'summer', 'grey']];
  for (const [name, hour, season, ext] of extra) {
    const o = await open(browser, vp, { three: 'real' }), { page } = o, st = JSON.parse(JSON.stringify(HOUSES.sample));
    st.ans.exterior = ext;
    await page.evaluate((st) => PC.store.replace(st), st);
    await page.waitForFunction(() => { const i = PC.debug.scene(); return i && i.renders > 0 && !i.building; }, null, { timeout: 30000 });
    await page.evaluate(([hour, season]) => PC.view3d.setLook({ hour, season }), [hour, season]);
    if (await o.hook('v3-tab-view').isVisible()) await o.act('v3-tab-view');
    await o.act('v3-reset'); await o.act('v3-panel-toggle');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `sample-${name}-${vp.tag}-closed.jpg`), quality: 82 });
    await o.ctx.close();
  }
}
await browser.close();
console.log('wrote', OUT);
