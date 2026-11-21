// F3-T2: R5 end to end (PM R5, F1-S3 "R5 on vertex release") with plans that really hold edits and approvals,
// touch at 360x640 and the mouse at 1280x800. Sample (6.2): plot (0,0) (20,0) (20,30) (8,30) (0,26), footprint
// 9.5 x 15 m. Known from the site model: corner 3 (20,30) moved 1 m back keeps the footprint size (it only moves);
// back setback 1.5 m keeps the size (moves the footprint); corner 2 (20,0) moved to (17,0) changes the size.
import { launch, open, suite, settled, VIEWPORTS } from '../helpers/browser.mjs';
import { gestures } from '../helpers/touch.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e r5'), browser = await launch();
const VPS = [VIEWPORTS[0], VIEWPORTS[2]];
// R5 dialog sentence (PM round 6 rule, F3-T2 review): names only what each level holds.
const BOTH = 'The floor plans of the Ground floor and the First floor will be regenerated, with their manual edits and approvals.';

async function kit(vp) {
  const o = await open(browser, vp), { page, hook } = o, tag = vp.tag, G = await gestures(page, vp.touch);
  const k = {
    ...o, G, tag,
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(PC.debug.state()))),
    text: (h) => hook(h).evaluate((el) => el.textContent.trim().replace(/\s+/g, ' ')),
    dialog: () => page.locator('[data-pc="dialog-layer"]').evaluate((e) => !e.hidden),
    tap: (loc) => (vp.touch ? loc.tap() : loc.click()),
    fp: () => page.evaluate(() => { const f = PC.debug.site().footprint; return [f.w, f.d, f.u, f.v]; }),
    setback: async (side, v) => { await k.act('q-tab-site'); const f = hook('q-setback-' + side); await f.click(); await f.fill(''); await page.keyboard.type(v); await page.keyboard.press('Enter'); await settled(page); },
    P: (p) => page.evaluate(([x, y]) => PC.debug.toScreen('plot', x, y), p),
    end: async (label) => {
      for (const fn of ['noPageScroll', 'barInViewport']) T.none(await A[fn](page), `${tag} ${label}: ${fn}`);
      T.none(o.problems(), `${tag} ${label}: clean log`); await o.ctx.close();
    }
  };
  return k;
}
// Sample on stage 3; Ground edited (Kitchen 0.5 m narrower) and approved, First approved; back to stage 2.
async function seeded(vp) {
  const k = await kit(vp), { page } = k;
  await k.act('btn-sample'); await k.act('btn-next'); await k.act('btn-next'); await settled(page);
  await page.evaluate(() => PC.store.commit((s) => { const r = s.plans.G.rooms.find((q) => q.id === 'r4'); PC.plans.applyEdit(s, 'G', { ...r, w: 3 }); PC.plans.approve(s, 'G'); PC.plans.approve(s, '1'); }));
  k.s3 = await k.state();
  await k.act('btn-back'); await settled(page);
  return k;
}
const kept = (a, b) => JSON.stringify(a.plans) === JSON.stringify(b.plans);

async function rooms(vp) {
  const k = await seeded(vp), { page, act, tag } = k;
  // a first-floor room size: one question naming First only; Ground keeps edits and approval
  await act('q-tab-rooms');
  await page.locator('[data-pc="room-list"] [data-room="r9"] [data-pc="room-size"]').selectOption('L'); await settled(page);
  T.eq([await k.dialog(), await k.text('dialog-text')], [true, 'The floor plan of the First floor will be regenerated, with its approval.'], `${tag} First-floor room change: one question naming only the First floor and only its approval`);
  await act('dialog-ok'); await settled(page);
  await act('q-tab-rooms');
  await page.locator('[data-pc="room-list"] [data-room="r10"] [data-pc="room-size"]').selectOption('L'); await settled(page);
  T.eq(await k.dialog(), false, `${tag} a second layout change in the same visit asks nothing`);
  await act('btn-next'); await settled(page);
  const s = await k.state(), tabs = await page.evaluate(() => [...document.querySelectorAll('[data-pc="plan-tabs"] [data-pc="tab-state"]')].map((e) => e.textContent));
  T.eq([s.plans.G, tabs, s.plans['1'].approved, s.plans['1'].edited], [k.s3.plans.G, ['Approved', 'Draft'], false, false], `${tag} stage 3: Ground as left (edited, approved), First a new Draft`);
  T.ok(JSON.stringify(s.plans['1'].rooms) !== JSON.stringify(k.s3.plans['1'].rooms), `${tag} ...with a new layout`);
  // the next visit to stages 1-2 asks again
  await page.evaluate(() => PC.store.commit((s) => { PC.plans.approve(s, '1'); }));
  await act('btn-back'); await settled(page);
  await k.setback('side', '2.5');
  T.eq([await k.dialog(), await k.text('dialog-text')], [true, BOTH], `${tag} after returning to stage 3 the next visit asks again`);
  // Cancel on a setback change restores the value; nothing resets
  const before = await k.state();
  await act('dialog-cancel'); await settled(page);
  T.eq([kept(await k.state(), before), (await k.state()).ans.setbacks.side, await k.page.locator('[data-pc="q-setback-side"]').inputValue()], [true, 2, '2.0'], `${tag} Cancel restores the setback; nothing resets`);
  // a back setback that only moves the footprint asks nothing; edits and approvals kept; the preview moves it
  const fp0 = await k.fp();
  await k.setback('back', '1.5');
  const fp1 = await k.fp(), s2 = await k.state();
  T.eq([await k.dialog(), fp1.slice(0, 2), fp1[3] !== fp0[3], kept(s2, before)], [false, fp0.slice(0, 2), true, true], `${tag} back setback 1.5: no question, same size, the footprint moved, plans kept`);
  await act('btn-next'); await settled(page);
  T.ok(kept(await k.state(), before), `${tag} ...and stage 3 keeps every edit and approval`);
  await act('btn-back'); await settled(page);
  // Q10 (appearance) asks nothing and keeps approvals
  await act('q-tab-building');
  await k.tap(page.locator('[data-pc="q-exterior"] label:has(> input[value="white"])')); await settled(page);
  T.eq([await k.dialog(), (await k.state()).ans.exterior, kept(await k.state(), before)], [false, 'white', true], `${tag} Q10 change: no question, approvals kept`);
  // Q6 asks and resets every level
  await act('q-tab-site'); await act('q-street-next'); await settled(page);
  T.eq([await k.dialog(), await k.text('dialog-text')], [true, BOTH], `${tag} Q6 change asks, naming every level`);
  await act('dialog-ok'); await settled(page);
  await act('btn-next'); await settled(page);
  const s3 = await k.state();
  T.ok(['G', '1'].every((id) => !s3.plans[id].approved && !s3.plans[id].edited && s3.plans[id].sig !== before.plans[id].sig), `${tag} Q6: every level regenerated as a Draft`);
  await k.end('rooms / setbacks / Q6 / Q10');
}

async function vertex(vp) {
  const c = await kit(vp);                                         // untouched sample: Clear names no plans
  await c.act('btn-sample'); await c.act('btn-clear'); await settled(c.page);
  T.eq(await c.text('dialog-text'), 'The outline will be removed. This cannot be undone.', `${vp.tag} Clear on the untouched sample: no plans sentence (atRisk)`);
  await c.act('dialog-cancel'); await c.end('clear untouched');
  const k = await seeded(vp), { page, act, tag, G } = k;
  await act('step-1'); await settled(page);
  // a corner move that keeps the footprint size: no question, plans kept
  await G.drag(await k.P([20, 30]), await k.P([20, 31]), null, 10); await settled(page);
  let s = await k.state();
  T.eq([await k.dialog(), s.plot.pts[2], kept(s, k.s3)], [false, [20, 31], true], `${tag} corner moved 1 m (same footprint size): no question, plans kept`);
  // a size-changing corner move asks; Cancel returns the corner
  const pts = s.plot.pts;
  await G.drag(await k.P([20, 0]), await k.P([17, 0]), null, 10); await settled(page);
  T.eq([await k.dialog(), await k.text('dialog-text')], [true, BOTH], `${tag} size-changing corner release asks (F1-S3)`);
  await act('dialog-cancel'); await settled(page);
  s = await k.state();
  T.eq([s.plot.pts, kept(s, k.s3)], [pts, true], `${tag} Cancel returns the corner; nothing resets`);
  // drawn back where it was: a press on the old corner position grabs it again
  await G.drag(await k.P([20, 0]), await k.P([19, 0]), null, 10); await settled(page);
  T.eq(await k.dialog(), true, `${tag} the returned corner is drawn and grabbable at (20, 0)`);
  await act('dialog-cancel'); await settled(page);
  // Clear with approved plans: one dialog, the plans sentence names what each holds; Cancel keeps everything
  await act('btn-clear'); await settled(page);
  T.eq([await k.text('dialog-title'), await k.text('dialog-text')], ['Clear the plot?', 'The outline will be removed. This cannot be undone. The floor plans of the Ground floor and the First floor will be regenerated, with their manual edits and approvals.'], `${tag} Clear: one dialog with the plans sentence`);
  await act('dialog-cancel'); await settled(page);
  T.ok(kept(await k.state(), k.s3) && (await k.state()).plot.closed, `${tag} Clear cancelled: plot and plans kept`);
  await k.end('vertex / clear');
}

try {
  for (const vp of VPS) { await rooms(vp); await vertex(vp); }
} catch (e) { T.ok(false, 'spec crashed: ' + e.message); }
await browser.close();
process.exit(T.done() ? 1 : 0);
