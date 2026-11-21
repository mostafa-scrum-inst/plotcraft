// F4-T2 step 0 on stage 3 with real input: touch at 360x640 and the mouse at 1280x800. Sample First floor (6.2):
// Bedroom r9 at x 5.5-9.5, y 0-4 (frame P, metres) with the hall strip y 4-5.5 above it, the Office r12 at y 5.5.
// - CD-5 (PM round 10): dragging r9's back edge 1.5 m onto the Office closes its way in -> the warning appears,
//   Approve stays available; dragging it back removes the warning.
// - One-step Undo (`plan-undo`, PM rounds 8 and 10): hidden until an edit, restores the plan (and the approval the edit
//   cleared), moves the focus to Regenerate, hides again; a floor-tab switch drops it.
// - The pair hint text (0.4) is checked in plans-edit / plans-view; the low-fill hint (0.3) here, on a First floor
//   reduced to four rooms (44 %).
import { launch, open, suite, settled, VIEWPORTS } from '../helpers/browser.mjs';
import { gestures } from '../helpers/touch.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e plans-step0'), browser = await launch();
const VPS = [VIEWPORTS[0], VIEWPORTS[2]];
const NO_WAY = 'has no way in from the hall or stairs. Move or resize a neighbouring room to open one.';

async function kit(vp) {
  const o = await open(browser, vp), { page, hook } = o, G = await gestures(page, vp.touch);
  const k = {
    ...o, G, tag: vp.tag,
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(PC.debug.state()))),
    text: (h) => hook(h).evaluate((el) => el.textContent.trim().replace(/\s+/g, ' ')),
    warns: () => page.evaluate(() => [...document.querySelectorAll('[data-pc="plan-warn-list"] [data-pc="warn-text"]')].map((e) => e.textContent)),
    tab: (name) => page.locator('[data-pc="plan-tabs"] [role="tab"]', { hasText: name }).evaluate((e) => e.click()),
    scale: () => page.evaluate(() => PC.debug.view('plan').scale),
    level: () => page.evaluate(() => PC.debug.planView().level),
    room: async (id) => (await k.state()).plans[await k.level()].rooms.find((r) => r.id === id),
    at: (x, y) => page.evaluate(([x, y]) => { const f = PC.debug.site().footprint; return PC.debug.toScreen('plan', f.u + x, f.v + y); }, [x, y]),
    centre: async (id) => { const r = await k.room(id); return k.at(r.x + r.w / 2, r.y + r.h / 2); },
    handle: async (id, kind) => (await page.evaluate((id) => PC.debug.planHandles(id), id)).find((h) => h.kind === kind),
    undoShown: () => hook('plan-undo').evaluate((e) => !e.hidden && e.getClientRects().length > 0),
    focus: () => page.evaluate(() => document.activeElement && document.activeElement.dataset.pc),
    // r9's back edge (n handle) by dy metres; the room is selected first so its handles exist
    backEdge: async (dy) => {
      await k.G.tap(await k.centre('r9')); await settled(page);
      const h = await k.handle('r9', 'n'), m = await k.scale();
      await k.G.drag([h.x, h.y], [h.x, h.y - dy * m]); await settled(page);
    },
    end: async (label) => {
      for (const fn of ['noPageScroll', 'barInViewport', 'tapTargets']) T.none(await A[fn](page), `${vp.tag} ${label}: ${fn}`);
      T.none(o.problems(), `${vp.tag} ${label}: clean log`); await o.ctx.close();
    }
  };
  return k;
}

async function access(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k;
  await act('btn-sample'); await act('btn-next'); await act('btn-next'); await settled(page);
  T.eq([await k.undoShown(), (await k.warns()).filter((w) => w.includes(NO_WAY) || w.startsWith('Rooms fill only'))], [false, []], `${tag} Ground floor: no Undo, no access or fill warning`);
  await k.tab('First floor'); await settled(page);
  const s0 = await k.state(), name = await page.evaluate(() => PC.levels.roomNames(PC.debug.state()).r9);
  T.eq([await k.level(), await k.undoShown()], ['1', false], `${tag} First floor shown, no Undo before an edit`);
  // CD-5: the back edge onto the Office (y 5.5) closes the hall strip in front of r9
  await k.backEdge(1.5);
  let s = await k.state(), r9 = s.plans['1'].rooms.find((r) => r.id === 'r9');
  T.eq([r9.y, r9.h], [0, 5.5], `${tag} n handle: r9 now reaches the Office wall (5.5)`);
  T.ok((await k.warns()).includes(`The ${name} ${NO_WAY}`), `${tag} CD-5 warning names the ${name}`);
  T.eq(await hook('btn-approve').getAttribute('aria-disabled'), 'false', `${tag} the access warning does not block Approve`);
  // Undo: shown, restores the plan, message, focus on Regenerate, hidden again, warning gone
  T.ok(await k.undoShown(), `${tag} Undo shown after the edit`);
  T.eq([await hook('plan-undo').getAttribute('aria-label'), await hook('plan-undo').getAttribute('title')], ['Undo last edit', 'Undo last edit'], `${tag} Undo label and tooltip`);
  await act('plan-undo'); await settled(page);
  s = await k.state();
  T.eq(s.plans['1'], s0.plans['1'], `${tag} Undo restores the First floor plan exactly`);
  T.eq([await k.text('plan-msg'), await k.focus(), await k.undoShown()], ['Last edit undone.', 'btn-regenerate', false], `${tag} Undo: message, focus on Regenerate, button hidden`);
  T.ok(!(await k.warns()).some((w) => w.includes(NO_WAY)), `${tag} ...and the access warning is gone`);
  // an edit on an approved floor: Undo brings the approval back
  await act('btn-approve'); await settled(page);
  await k.backEdge(1.5);
  T.eq([(await k.state()).plans['1'].approved, await k.undoShown()], [false, true], `${tag} edit on the approved floor: Draft, Undo shown`);
  await act('plan-undo'); await settled(page);
  s = await k.state();
  T.eq([s.plans['1'].approved, s.plans['1'].rooms, await k.text('plan-msg')], [true, s0.plans['1'].rooms, 'Last edit undone. First floor approved again.'], `${tag} Undo after an approval was cleared: approved again`);
  await act('btn-approve'); await settled(page);                                  // back to Draft for the rest
  // a floor-tab switch drops the snapshot; the edit itself stays and a drag back removes the warning
  await k.backEdge(1.5);
  T.ok(await k.undoShown(), `${tag} Undo shown after another edit`);
  await k.tab('Ground floor'); await settled(page); await k.tab('First floor'); await settled(page);
  T.eq([await k.undoShown(), (await k.warns()).includes(`The ${name} ${NO_WAY}`)], [false, true], `${tag} tab switch: Undo dropped, the edit and its warning stay`);
  await k.backEdge(-1.5);
  r9 = (await k.state()).plans['1'].rooms.find((r) => r.id === 'r9');
  T.eq([r9.h, (await k.warns()).some((w) => w.includes(NO_WAY))], [4, false], `${tag} dragging the edge back removes the warning`);
  await k.end('access + undo');
}

// TL Step 0 review note 1: a dedicated check that a floor-tab switch hides Undo (edit on Ground, First and back).
async function tabSwitch(vp) {
  const k = await kit(vp), { page, act, tag } = k;
  await act('btn-sample'); await act('btn-next'); await act('btn-next'); await settled(page);
  const before = (await k.state()).plans.G, c = await k.centre('r4'), m = await k.scale();
  await k.G.drag(c, [c[0], c[1] + 1.0 * m]); await settled(page);
  T.ok(JSON.stringify((await k.state()).plans.G) !== JSON.stringify(before) && await k.undoShown(), `${tag} Ground edited: Undo shown`);
  await k.tab('First floor'); await settled(page);
  T.eq([await k.level(), await k.undoShown()], ['1', false], `${tag} First floor: no Undo`);
  await k.tab('Ground floor'); await settled(page);
  T.eq([await k.level(), await k.undoShown()], ['G', false], `${tag} back on Ground: Undo stays hidden (dropped by the switch)`);
  await k.end('tab switch');
}

async function lowFill(vp) {
  const k = await kit(vp), { page, act, tag } = k;
  await act('btn-sample');
  await page.evaluate(() => PC.store.commit((s) => { ['r10', 'r11', 'r12'].forEach((id) => PC.levels.removeRoom(s, id)); }));
  await act('btn-next'); await act('btn-next'); await settled(page);
  T.ok(!(await k.warns()).some((w) => w.startsWith('Rooms fill only')), `${tag} Ground floor (81 %): no fill hint`);
  await k.tab('First floor'); await settled(page);
  T.ok((await k.warns()).includes('Rooms fill only 44 % of the First floor. Add rooms, choose larger sizes, or lower the footprint % (Q3).'), `${tag} First floor with four rooms: the fill hint (${await k.warns()})`);
  await k.end('low fill');
}

try {
  for (const vp of VPS) { await access(vp); await lowFill(vp); }
  await tabSwitch(VPS[0]);
} catch (e) { T.ok(false, 'spec crashed: ' + (e && e.stack || e)); } finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
