// F4-T3 Light tab with the strict THREE mock (F4-S3; A-13; Designer F4-T3 plan 3; TL F4-T3 plan review Q5 / Q7):
// time slider by touch and keyboard, presets by tap and Space (aria-pressed only on the matching hour), season select,
// HH:MM readout, the "approximate" label, no rebuild and no camera move, the look kept across leaving stage 5; the
// Designer layout check at 360x640; and the PM round 11 vegetation shortfall warning on stage 2. Two viewports, one
// page load each (TL Q7). Folded into view3d.spec (run-all time, TL Q7): view3d.spec calls lookChecks(browser, T).
import { open, settled, VIEWPORTS } from './browser.mjs';
import { gestures } from './touch.mjs';
import { loadCore, plain } from './load.mjs';

let T, browser;
const ready = (page) => page.waitForFunction(() => { const i = PC.debug.scene(); return i.renders > 0 && !i.frame && !i.building; });
const PRESETS = ['morning', 'noon', 'evening', 'night'];
const state = (page) => page.evaluate((P) => {
  const i = PC.debug.scene(), q = (h) => document.querySelector(`[data-pc="${h}"]`);
  return { look: i.look, builds: i.builds, pose: JSON.stringify(PC.debug.cam()), value: q('v3-time').value, out: q('v3-time-out').textContent,
    season: q('v3-season').value, pressed: P.filter((p) => q('v3-preset-' + p).getAttribute('aria-pressed') === 'true'),
    canopies: (() => { const c = i.world.getObjectByName('canopies'); return c ? c.visible : null; })(), sunI: i.scene.getObjectByName('sun').intensity };
}, PRESETS);

async function run(vp) {
  const o = await open(browser, vp, { three: 'mock' }), { page, act, hook, problems } = o, tag = vp.tag + ' mock look';
  await act('btn-sample'); await act('btn-skip3d'); await ready(page);
  if (await hook('v3-tab-light').isVisible()) { await act('v3-tab-light'); await settled(page); }   // wide layouts show every pane
  let s = await state(page);
  const pose0 = s.pose, builds0 = s.builds;
  T.eq([s.look, s.value, s.out, s.season, s.pressed, s.canopies], [{ hour: 12, season: 'summer' }, '12', '12:00', 'summer', ['noon'], true], `${tag} opens at 12:00 summer, Noon pressed, canopies shown`);
  T.eq(await page.evaluate(() => document.querySelector('[data-pc="v3-pane-light"] .pc-v3note').textContent), 'approximate — not real solar data', `${tag} the label (F4-S3)`);
  T.ok(await page.evaluate(() => document.querySelector('[data-pc="v3-time"]').classList.contains('pc-range--sky')), `${tag} day / night track class`);
  // presets
  await act('v3-preset-evening'); await settled(page);
  s = await state(page);
  T.eq([s.look.hour, s.value, s.out, s.pressed], [17.5, '17.5', '17:30', ['evening']], `${tag} Evening: 17.5, 17:30, only Evening pressed`);
  T.eq([s.builds, s.pose], [builds0, pose0], `${tag} no rebuild, camera untouched`);
  if (vp.touch) {
    // Designer check: panel <= 34 % of the canvas, presets in one row, 44 px targets
    const lay = await page.evaluate((P) => {
      const r = (h) => document.querySelector(`[data-pc="${h}"]`).getBoundingClientRect(), pan = r('v3-panel'), can = r('v3-canvas');
      const tops = P.map((p) => Math.round(r('v3-preset-' + p).top)), all = [...P.map((p) => 'v3-preset-' + p), 'v3-time', 'v3-season'].map(r);
      return { share: pan.height / can.height, row: new Set(tops).size, min: Math.min(...all.map((b) => Math.min(b.width, b.height))) };
    }, PRESETS);
    T.ok(lay.share <= 0.34 && lay.row === 1 && lay.min >= 44 - 0.5, `${tag} panel ${(lay.share * 100).toFixed(1)} % of the canvas, one preset row, targets >= 44 px (${lay.min.toFixed(1)})`);
    // touch the slider near its left quarter: the hour follows the slider, no preset pressed
    const b = await hook('v3-time').boundingBox();
    await page.touchscreen.tap(b.x + b.width * 0.27, b.y + b.height / 2); await settled(page);
    s = await state(page);
    T.ok(s.look.hour > 2 && s.look.hour < 10 && String(s.look.hour) === s.value && s.pressed.length === (PRESETS.some((p) => ({ morning: 8 })[p] === s.look.hour) ? 1 : 0), `${tag} tap on the slider: ${s.value} h, readout ${s.out}`);
    // orbit while the slider moves: no errors
    const G = await gestures(page, true), cb = await hook('v3-canvas').boundingBox();
    await G.drag([cb.x + cb.width / 2 - 50, cb.y + cb.height / 3], [cb.x + cb.width / 2 + 50, cb.y + cb.height / 3]);
    await page.touchscreen.tap(b.x + b.width * 0.6, b.y + b.height / 2); await settled(page);
    T.ok((await state(page)).pose !== pose0, `${tag} orbit moved the camera; the slider kept working`);
  } else {
    // keyboard: arrows step 0.25, Home 0, End 24; a preset by Space
    await hook('v3-time').focus();
    await page.keyboard.press('ArrowRight'); await settled(page);
    s = await state(page);
    T.eq([s.look.hour, s.out, s.pressed], [17.75, '17:45', []], `${tag} ArrowRight: 17:45, the preset clears`);
    await page.keyboard.press('Home'); await settled(page);
    T.eq((await state(page)).out, '00:00', `${tag} Home: 00:00`);
    await page.keyboard.press('End'); await settled(page);
    s = await state(page);
    T.eq([s.look.hour, s.out], [24, '24:00'], `${tag} End: 24:00`);
    await hook('v3-preset-night').focus(); await page.keyboard.press('Space'); await settled(page);
    s = await state(page);
    T.eq([s.look.hour, s.pressed, s.out], [22, ['night'], '22:00'], `${tag} Night by Space`);
    await page.mouse.move(400, 300); await page.mouse.down(); await page.mouse.move(470, 320, { steps: 4 }); await page.mouse.up();
  }
  // season
  await hook('v3-season').selectOption('winter'); await settled(page);
  s = await state(page);
  T.eq([s.look.season, s.canopies, s.builds], ['winter', false, builds0], `${tag} Winter: canopies hidden, no rebuild`);
  // leave stage 5 and return: the look is kept (session, TL Q5)
  const kept = s.look;
  await act('btn-back'); await settled(page);
  await act('btn-next'); await ready(page); await settled(page);
  s = await state(page);
  T.eq([s.look, s.season, s.canopies], [kept, 'winter', false], `${tag} back to stage 4 and forward: the look is kept`);
  T.none(problems(), `${tag} no errors`);
  if (vp.touch) {
    // PM round 11: the shortfall warning on stage 2 (the sample shows none)
    T.eq(await page.evaluate(() => PC.validate(PC.store.get()).warnings.length), 0, `${tag} sample: no warning`);
    const st = plain(loadCore().sample.state());
    st.ans.vegPct = 60; st.ans.footprintPct = 40; st.stage = 2; st.sampleClean = false;
    await page.evaluate((x) => PC.store.replace(x), st); await settled(page);
    const list = await page.evaluate(() => document.querySelector('[data-pc="conflict-list"]').textContent);
    T.ok(/Only \d+ m² \([\d.]+ % of the plot\) of planting fits around the building, parking and pool: the 3D garden is smaller than the [\d.]+ % asked\./.test(list), `${tag} stage 2: the shortfall warning`);
    T.eq(await page.evaluate(() => PC.view3d.look()), kept, `${tag} a store replace does not reset the look`);
  }
  await o.ctx.close();
}

export async function lookChecks(b, suiteT) {
  browser = b; T = suiteT;
  try { await run(VIEWPORTS[0]); await run(VIEWPORTS[2]); } catch (e) { T.ok(false, 'look checks crashed: ' + (e && e.stack || e)); }
}
