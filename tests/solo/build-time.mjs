// C-4.8 build budget (CTO; TL ruling on F6-T1a): the maximum house builds in <= 400 ms, best of 3, at 1280x800 on the
// real r128, including texture creation and the first frame. run-all runs this file alone under QA_FULL=1, before the
// browser pool starts (nothing else runs beside it), and prints the number in every QA_FULL report. Above 380 ms the
// TL reviews it before anything more is added to the build. The <= 800 ms check in view3d-real is only a regression
// net and never counts as meeting this budget.
import { launch, open, suite, VIEWPORTS } from '../helpers/browser.mjs';
import { loadCore } from '../helpers/load.mjs';
import { maxHouse } from '../helpers/houses.mjs';

const T = suite('solo build-time'), browser = await launch(), vp = VIEWPORTS.find((v) => v.w === 1280);
const isReady = (page) => page.waitForFunction(() => { const i = PC.debug.scene(); return i.renders > 0 && !i.frame && !i.building && !i.lost; }, null, { timeout: 15000 });
try {
  const o = await open(browser, vp, { three: 'real', dpr: 1 }), { page, act, problems } = o;
  await act('btn-sample'); await act('btn-skip3d');
  await isReady(page);
  const b0 = await page.evaluate(() => PC.debug.scene().builds);
  await page.evaluate((st) => PC.store.replace(st), maxHouse(loadCore()));
  await page.waitForFunction((b) => { const i = PC.debug.scene(); return i.builds > b && !i.building && !i.frame; }, b0, { timeout: 15000 });
  const t = await page.evaluate(async () => {
    const V = PC.view3d, h = PC.debug.house(), c = document.querySelector('[data-pc="v3-canvas"]'), out = [];
    for (let k = 0; k < 3; k++) {
      // timed from open() to the end of the first frame after the build (geometry, materials, textures from the
      // cache, their GPU upload and the 2048 shadow map): what opening or rebuilding costs; 'ready' alone is recorded
      const i0 = PC.debug.scene(), r = i0.renders, h2 = Object.assign({}, h, { key: h.key + '-solo' + k }), t0 = performance.now();
      let tr = 0;
      await new Promise((res) => V.open(h2, c, (st) => { if (st === 'ready') { tr = performance.now() - t0; res(); } }));
      await new Promise((res) => { const tick = () => { const i = PC.debug.scene(); if (i.renders > r && !i.frame) res(); else requestAnimationFrame(tick); }; tick(); });
      out.push([tr, performance.now() - t0]);
      await new Promise((res) => setTimeout(res, 200));
    }
    return out;
  });
  const best = Math.min(...t.map((x) => x[1])), list = t.map((x) => x[1].toFixed(0)).join(', ');
  const ready = Math.min(...t.map((x) => x[0]));
  console.log(`  [C-4.8] maximum house build + first frame, solo, best of 3: ${best.toFixed(0)} ms (${list}); budget 400 ms, TL review line 380 ms (build alone, to 'ready': ${ready.toFixed(0)} ms)`);
  if (best > 380) console.log(`  [C-4.8] NOTE ${best.toFixed(0)} ms is above 380 ms: TL review before anything more is added to the build`);
  T.ok(best <= 400, `1280x800 maximum house build + first frame ${best.toFixed(0)} ms (best of ${list}) <= 400 ms (C-4.8, solo)`);
  T.none(problems(), 'no page errors, console errors or THREE. warnings');
  await o.ctx.close();
} finally {
  await browser.close();
}
process.exit(T.done() ? 1 : 0);
