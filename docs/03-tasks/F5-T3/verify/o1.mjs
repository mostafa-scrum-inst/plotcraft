// F5-T3a O-1 (Designer verification, not in run-all): QA's shadow metric on real r128 at 1280x800, sample.
// Pixels whose summed |ΔRGB| exceeds 30 when every shadow caster is switched off. Optional key overrides to try
// candidate sky values in the page before they go into sky.js:
//   node docs/03-tasks/F5-T3/verify/o1.mjs '[{"h":17,"sunI":0.75,"hemiI":0.34},{"h":18,"sunI":0.55,"hemiI":0.30}]'
import { launch, open } from '../../../../tests/helpers/browser.mjs';
const over = JSON.parse(process.argv[2] || '[]'), looks = [[17.5, 'summer'], [17, 'summer'], [17.5, 'winter'], [12, 'summer'], [8, 'summer']];
const b = await launch(), { ctx, page, act } = await open(b, { tag: '1280x800', w: 1280, h: 800 }, { three: 'real' });
await act('btn-sample'); await act('btn-skip3d');
await page.waitForFunction(() => document.querySelector('[data-pc="v3-building"]').hidden && !document.querySelector('[data-pc="v3-panel"]').hidden, null, { timeout: 30000 });
await page.evaluate((o) => { for (const k of o) Object.assign(PC.data.sky.keys.find((x) => x.h === k.h), k); }, over);
const shot = async () => page.locator('[data-pc="v3-canvas"]').screenshot();
for (const [hour, season] of looks) {
  await page.evaluate(([h, s]) => { PC.view3d.setLook({ hour: h, season: s }); PC.debug.scene().renderNow(); }, [hour, season]);
  const a = await shot();
  await page.evaluate(() => { const i = PC.debug.scene(); window.__cast = []; i.scene.traverse((o) => { if (o.castShadow && !o.isLight) { window.__cast.push(o); o.castShadow = false; } }); i.renderNow(); });
  const c = await shot();
  await page.evaluate(() => { for (const o of window.__cast) o.castShadow = true; PC.debug.scene().renderNow(); });
  const n = await page.evaluate(async ([x, y]) => {
    const load = (s) => new Promise((r) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); r(g.getImageData(0, 0, im.width, im.height).data); }; im.src = 'data:image/png;base64,' + s; });
    const p = await load(x), q = await load(y); let n30 = 0, mean = 0;
    for (let k = 0; k < p.length; k += 4) { const d = Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]); if (d > 30) n30++; mean += 0.2126 * p[k] + 0.7152 * p[k + 1] + 0.0722 * p[k + 2]; }
    return { n30, mean: +(mean / (p.length / 4)).toFixed(1) };
  }, [a.toString('base64'), c.toString('base64')]);
  console.log(`${season} ${hour} h: ${n.n30} px change > 30 (shadows off), mean luma ${n.mean}`);
}
await ctx.close(); await b.close();
