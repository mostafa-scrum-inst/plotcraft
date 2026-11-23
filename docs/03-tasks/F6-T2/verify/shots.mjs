// F6-T2 Designer: interior and evening-lighting shots on real r128 (SwiftShader). Sample + maximum house, summer.
//   node docs/03-tasks/F6-T2/verify/shots.mjs [outDir]   (default docs/03-tasks/F6-T2/before)
// Poses: (a) Roof off, level G and level 1, Reset view, noon / 19.5 h / 22 h; (b) "Go to room" close-ups (living G,
// bedroom 1, kitchen G, majlis G) at noon and 22 h, highlight hidden; (c) Roof on exterior at 19.5 / 22 h (windows).
import { launch, open, VIEWPORTS } from '../../../../tests/helpers/browser.mjs';
import { loadCore } from '../../../../tests/helpers/load.mjs';
import { sampleApproved, maxHouse } from '../../../../tests/helpers/houses.mjs';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'before'));
mkdirSync(OUT, { recursive: true });
const PC = loadCore(), HOUSES = { sample: sampleApproved(PC), max: maxHouse(PC) };
const browser = await launch();
const settle = (page) => page.waitForFunction(() => { const i = PC.debug.scene(); return i && !i.building && !i.frame && !PC.view3d.flying(); }, null, { timeout: 30000 })
  .then(() => page.waitForTimeout(300)).then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
for (const vp of [VIEWPORTS[2], VIEWPORTS[0]]) for (const [hn, st] of Object.entries(HOUSES)) {
  const o = await open(browser, vp, { three: 'real' }), { page } = o;
  await page.evaluate((st) => PC.store.replace(st), st);
  await page.waitForFunction(() => { const i = PC.debug.scene(); return i && i.renders > 0 && !i.building; }, null, { timeout: 30000 });
  const shot = async (name) => { await settle(page); await page.screenshot({ path: join(OUT, `${hn}-${name}-${vp.tag}.jpg`), quality: 82 }); };
  const look = (hour) => page.evaluate((hour) => PC.view3d.setLook({ hour, season: 'summer' }), hour);
  const pose = (level, roof) => page.evaluate(([l, r]) => { PC.view3d.setRoof(r); PC.view3d.setLevel(l); PC.view3d.resetView(); }, [level, roof]);
  const collapse = async () => { if (!(await page.evaluate(() => document.querySelector('[data-pc="v3-panel"]').classList.contains('is-collapsed')))) await o.act('v3-panel-toggle'); };
  await collapse();
  // (a) dollhouse levels
  for (const lv of ['G', '1']) for (const [ln, h] of [['noon', 12], ['dusk', 19.5], ['night', 22]]) {
    if (hn === 'max' && h === 19.5) continue;
    await pose(lv, false); await look(h); await shot(`lv${lv}-${ln}`);
  }
  // (c) exterior after sunset
  for (const [ln, h] of [['dusk', 19.5], ['night', 22]]) { await pose('all', true); await look(h); await shot(`ext-${ln}`); }
  // (b) room close-ups through the finder, highlight hidden
  if (vp.tag === '1280x800' || hn === 'sample') {
    const rooms = await page.evaluate(() => {
      const h = PC.debug.house(), out = {};
      h.levels.forEach((lv) => lv.rooms.forEach((r) => { const k = r.type + '-' + lv.id; if (!(k in out)) out[k] = r.id; }));
      return out;
    });
    const want = hn === 'sample' ? ['living-G', 'bedroom-1', 'kitchen-G', 'majlis-G'] : ['living-G', 'bedroom-1'];
    for (const k of want) {
      const id = rooms[k]; if (!id) { console.log(hn, 'no room', k, Object.keys(rooms)); continue; }
      for (const [ln, h] of [['noon', 12], ['night', 22]]) {
        await page.evaluate(() => PC.view3d.resetView()); await look(h);
        await page.evaluate((id) => { const s = document.querySelector('[data-pc="v3-room"]'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); }, id);
        await settle(page);
        await page.evaluate(() => { const i = PC.debug.scene(), m = i.world.getObjectByName('highlight'); if (m) m.visible = false; i.renderNow(); });
        await page.screenshot({ path: join(OUT, `${hn}-room-${k}-${ln}-${vp.tag}.jpg`), quality: 82 });
        await page.evaluate(() => { const s = document.querySelector('[data-pc="v3-room"]'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); });
      }
    }
  }
  const errs = o.problems(); if (errs.length) console.log(hn, vp.tag, errs);
  await o.ctx.close();
}
await browser.close();
console.log('wrote', OUT);
