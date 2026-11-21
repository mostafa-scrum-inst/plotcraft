// F4-T2 outdoor answers on stage 2 / 3 (PM round 10): Q7 the Gate position control is disabled while Boundary wall
// is off and keeps its value; Q8 the garden-seating warning appears on stage 2 and again on Floor plans when the pad
// does not fit (non-blocking). Touch at 360x640.
import { launch, open, suite, settled, VIEWPORTS } from '../helpers/browser.mjs';
import { loadCore, plain } from '../helpers/load.mjs';

const T = suite('e2e outdoor'), browser = await launch();
const SEAT_CODE = 'seating-omitted', SEAT = 'Garden seating does not fit in the yard: it is left out of the 3D scene. Try a lower footprint %, fewer cars or a smaller pool.';

async function run(vp) {
  const o = await open(browser, vp), { page, act, hook, problems } = o, tag = vp.tag;
  await act('btn-sample'); await act('btn-next'); await settled(page);
  await act('q-tab-outdoor'); await settled(page);
  const gate = () => page.evaluate(() => [...document.querySelectorAll('[data-pc="q-gate"] input')].map((i) => [i.value, i.disabled, i.checked]));
  T.eq(await gate(), [['left', false, false], ['centre', false, true], ['right', false, false]], `${tag} wall on: gate enabled, Centre`);
  await page.locator('label.pc-switch:has([data-pc="q-wall"])').tap(); await settled(page);
  T.eq([await page.evaluate(() => PC.store.get().ans.extras), await gate()], [{ wall: false, gate: 'centre', seating: true }, [['left', true, false], ['centre', true, true], ['right', true, false]]], `${tag} wall off: gate disabled, its value kept (Q7)`);
  await page.locator('label.pc-switch:has([data-pc="q-wall"])').tap(); await settled(page);
  T.eq((await gate()).map((g) => g[1]), [false, false, false], `${tag} wall on again: enabled`);
  T.eq(await page.evaluate(() => PC.validate(PC.store.get()).warnings.length), 0, `${tag} the sample: no warning`);
  // a 16 x 18 m plot at 50 %: the sample rooms fit, a 3 x 3 m pad does not; seating on -> the PM warning, stages 2 and 3
  const s = plain(loadCore().sample.state());
  s.plot.pts = [[0, 0], [16, 0], [16, 18], [0, 18]]; s.ans.streetEdge = 0; s.ans.edgeOv = {}; s.ans.vegPct = 0; s.ans.footprintPct = 50; s.ans.setbacks = { front: 3, back: 2, side: 1 };
  s.ans.parking.cars = 0; s.ans.pool.on = false; s.ans.extras.seating = true; s.stage = 2; s.sampleClean = false;
  await page.evaluate((st) => PC.store.replace(st), s); await settled(page);
  const list = () => page.evaluate(() => document.querySelector('[data-pc="conflict-list"]').textContent);
  T.eq(await page.evaluate(() => { const v = PC.validate(PC.store.get()); return [v.blocking.length, v.warnings.map((w) => w.code)]; }), [0, [SEAT_CODE]], `${tag} only the seating warning`);
  T.ok((await list()).includes(SEAT), `${tag} stage 2: the seating warning (Q8)`);
  T.ok(!(await hook('btn-next').isDisabled()), `${tag} ...non-blocking: Next available`);
  await act('btn-next'); await settled(page);
  const w = await page.evaluate(() => [...document.querySelectorAll('[data-pc="plan-warn-list"] [data-pc="warn-text"]')].map((e) => e.textContent));
  T.ok(w.includes(SEAT), `${tag} stage 3: the warning again (${w.length} warnings)`);
  T.none(problems(), `${tag} no errors`);
  await o.ctx.close();
}

try { await run(VIEWPORTS[0]); } catch (e) { T.ok(false, 'spec crashed: ' + (e && e.stack || e)); } finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
