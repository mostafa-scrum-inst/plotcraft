// Screenshots of stage 2 for review. Run: node docs/03-tasks/F2-T2/shots.mjs
import { launch, open, settled } from '../../../tests/helpers/browser.mjs';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('./shots/', import.meta.url));
const VPS = [{ tag: '360x640', w: 360, h: 640, touch: true }, { tag: '640x360', w: 640, h: 360, touch: true }, { tag: '768x1024', w: 768, h: 1024, touch: true }, { tag: '1280x800', w: 1280, h: 800, touch: false }];
const b = await launch();
for (const vp of VPS) for (const unit of ['m', 'ft']) {
  const o = await open(b, vp), { page, act, hook } = o;
  const shot = async (n) => { await settled(page); await page.screenshot({ path: `${out}${n}-${unit}-${vp.tag}.png` }); };
  await act('btn-sample'); if (unit === 'ft') await hook('unit-ft').check({ force: true });
  await act('btn-next');
  await shot('site');
  await page.evaluate(() => { PC.store.commit((s) => { s.ans.north = 60; s.ans.streetEdge = 1; }); });
  await shot('site-edge2-north');
  await page.evaluate(() => { PC.store.commit((s) => { s.ans.north = null; s.ans.streetEdge = 0; }); });
  await act('q-tab-building'); await shot('building');
  await act('q-tab-outdoor'); await shot('outdoor');
  await page.evaluate(() => { PC.store.commit((s) => { s.ans.footprintPct = 70; s.ans.vegPct = 45; s.ans.floors = 3; s.ans.setbacks.side = 7; s.ans.parking.cars = 4; }); });
  await act('q-tab-site'); await act('summary-toggle'); await shot('summary-conflicts');
  console.log(vp.tag, unit, o.problems().join(' | ') || 'clean');
  await o.ctx.close();
}
await b.close();
