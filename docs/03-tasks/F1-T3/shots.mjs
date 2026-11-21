// Screenshots of the plot stage for review. Run: node docs/03-tasks/F1-T3/shots.mjs
import { launch, open } from '../../../tests/helpers/browser.mjs';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('./shots/', import.meta.url));
const VPS = [{ tag: '360x640', w: 360, h: 640, touch: true }, { tag: '768x1024', w: 768, h: 1024, touch: true }, { tag: '1280x800', w: 1280, h: 800, touch: false }, { tag: '640x360', w: 640, h: 360, touch: true }];
const HAND = [[4, 14], [26, 14], [26, 22], [16, 22], [16, 31], [4, 31]];
const b = await launch();
for (const vp of VPS) {
  const o = await open(b, vp), { page } = o;
  const tap = async (x, y) => { const [sx, sy] = await page.evaluate(([x, y]) => PC.debug.toScreen('plot', x, y), [x, y]); return vp.touch ? page.touchscreen.tap(sx, sy) : page.mouse.click(sx, sy); };
  const shot = (n) => page.screenshot({ path: `${out}${n}-${vp.tag}.png` });
  await shot('empty');
  for (const p of HAND.slice(0, 4)) await tap(...p);
  if (!vp.touch) { const [sx, sy] = await page.evaluate(() => PC.debug.toScreen("plot", 21.5, 28)); await page.mouse.move(sx, sy); }
  await page.waitForTimeout(80); await shot('hand-open');
  for (const p of HAND.slice(4)) await tap(...p);
  await tap(...HAND[0]); await page.mouse.move(2, 2);
  await page.waitForTimeout(80); await shot('hand-closed');
  await o.hook('unit-ft').check({ force: true }); await page.waitForTimeout(80); await shot('hand-closed-ft');
  await o.hook('unit-m').check({ force: true });
  await o.act('btn-clear'); await o.act('dialog-ok');
  await o.act('btn-sample'); await page.waitForTimeout(80); await shot('sample');
  await o.hook('unit-ft').check({ force: true }); await page.waitForTimeout(80); await shot('sample-ft');
  console.log(vp.tag, o.problems().join(' | ') || 'clean');
  await o.ctx.close();
}
await b.close();
