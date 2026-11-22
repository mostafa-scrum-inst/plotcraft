// F6-T1 Designer: the 3D look on real r128 (SwiftShader), sample + G6 maximum house, noon + evening (17.5 h), summer,
// 1280x800 + 360x640, Reset view, panel collapsed (the model unobstructed) and expanded (as the user first sees it).
//   node docs/03-tasks/F6-T1/verify/shots.mjs [outDir]   (default docs/03-tasks/F6-T1/before)
import { launch, open, VIEWPORTS } from '../../../../tests/helpers/browser.mjs';
import { loadCore } from '../../../../tests/helpers/load.mjs';
import { sampleApproved, maxHouse } from '../../../../tests/helpers/houses.mjs';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'before'));
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
      await page.screenshot({ path: join(OUT, `${hn}-${ln}-${vp.tag}-${panel}.png`) });
    }
  }
  const errs = o.problems(); if (errs.length) console.log(hn, vp.tag, errs);
  await o.ctx.close();
}
await browser.close();
console.log('wrote', OUT);
