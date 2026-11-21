// F3-T2: the stage-3 plan editor (F3-S2), approval (F3-S3) and the interior stage (F3-S4) with real input: touch
// at 360x640 and the mouse at 1280x800 (TL condition 5), the keyboard at 1280x800. Sample Ground floor (6.2):
// Kitchen r4 at x 0-3.5, y 5.5-9.5 (frame P, metres), Majlis r2 below it at y 0-5, Dining r3 above (pair r3-r4),
// the stair block at x 3.5-6, y 5.5-9.5. Screen up = back (+y). Drags move 0.65 m or more (over the 8 px tap slop at
// about 14 px/m) and end where a snap decides the result. SHOTS=1 writes docs/03-tasks/F3-T2/shots/.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, open, suite, settled, VIEWPORTS } from '../helpers/browser.mjs';
import { ROOT } from '../helpers/load.mjs';
import { gestures } from '../helpers/touch.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e plans-edit'), browser = await launch();
const VPS = [VIEWPORTS[0], VIEWPORTS[2]];
const SHOTS = process.env.SHOTS ? join(ROOT, 'docs', '03-tasks', 'F3-T2', 'shots') : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

async function kit(vp) {
  const o = await open(browser, vp), { page, hook } = o, tag = vp.tag, G = await gestures(page, vp.touch);
  const k = {
    ...o, G, tag,
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(PC.debug.state()))),
    text: (h) => hook(h).evaluate((el) => el.textContent.trim().replace(/\s+/g, ' ')),
    tabs: () => page.evaluate(() => [...document.querySelectorAll('[data-pc="plan-tabs"] [role="tab"]')].map((t) => t.querySelector('[data-pc="tab-state"]').textContent)),
    tab: (name) => page.locator('[data-pc="plan-tabs"] [role="tab"]', { hasText: name }),
    scale: () => page.evaluate(() => PC.debug.view('plan').scale),
    room: async (id) => (await k.state()).plans[await k.level()].rooms.find((r) => r.id === id),
    level: () => page.evaluate(() => PC.debug.planView().level),
    // screen point of a frame-P point of the shown level
    at: (x, y) => page.evaluate(([x, y]) => { const f = PC.debug.site().footprint; return PC.debug.toScreen('plan', f.u + x, f.v + y); }, [x, y]),
    centre: async (id) => { const r = await k.room(id); return k.at(r.x + r.w / 2, r.y + r.h / 2); },
    handle: async (id, kind) => (await page.evaluate((id) => PC.debug.planHandles(id), id)).find((h) => h.kind === kind),
    approve: () => page.evaluate(() => { const b = document.querySelector('[data-pc="btn-approve"]'); return { disabled: b.disabled, aria: b.getAttribute('aria-disabled'), pressed: b.getAttribute('aria-pressed'), approved: b.classList.contains('is-approved'), label: b.textContent.trim() }; }),
    commits: () => page.evaluate(() => window.__commits),
    shot: async (name) => { if (SHOTS && vp.touch) await page.screenshot({ path: join(SHOTS, `${tag}-${name}.png`) }); },
    end: async (label) => {
      for (const fn of ['noPageScroll', 'barInViewport', 'tapTargets']) T.none(await A[fn](page), `${tag} ${label}: ${fn}`);
      T.none(o.problems(), `${tag} ${label}: clean log`); await o.ctx.close();
    }
  };
  return k;
}
async function toStage3(k) {
  await k.act('btn-sample'); await k.act('btn-next'); await k.act('btn-next'); await settled(k.page);
  await k.page.evaluate(() => { window.__commits = 0; PC.store.subscribe(() => { window.__commits++; }); });
}

async function edit(vp) {
  const k = await kit(vp), { page, hook, act, tag, G } = k;
  await toStage3(k);
  const s0 = await k.state(), m = await k.scale();
  // the PM's default hint (round 6) on one line at 360 px; otherwise the PM's short form would be required
  const lines = await page.evaluate(() => { const e = document.querySelector('[data-pc="plan-msg"]'), r = document.createRange(); r.selectNodeContents(e); return [e.textContent, r.getClientRects().length]; });
  T.eq(lines, ['Drag a room to move it; tap it, then drag a handle to resize.', vp.w === 360 ? 1 : lines[1]], `${tag} default hint${vp.w === 360 ? ', one line at 360 px' : ''}`);
  // tap selects; the readout names the room with drawn vs asked
  await G.tap(await k.centre('r4')); await settled(page);
  T.eq([await k.text('plan-room-name'), await k.text('plan-room-dims'), await k.text('plan-room-area')], ['Kitchen', '3.5 × 4.0 m', '14 m²'], `${tag} tap selects the Kitchen`);
  await k.shot('1-select');
  // move: 1.0 m towards the street; nothing is committed while dragging; the readout is live
  const c = await k.centre('r4');
  let during = null;
  await G.drag(c, [c[0], c[1] + 1.0 * m], async () => {
    during = { commits: await k.commits(), drag: await page.evaluate(() => PC.debug.planDrag()), dims: await k.text('plan-room-dims'), scroll: await page.evaluate(() => [scrollX, scrollY, document.scrollingElement.scrollTop]) };
    await k.shot('2-drag');
  });
  await settled(page);
  T.eq([during.commits, during.drag && during.drag.kind, during.scroll], [0, 'move', [0, 0, 0]], `${tag} move: no store commit and no page scroll during the drag`);
  T.eq(during.dims, '3.5 × 4.0 m', `${tag} move: the live readout during the drag`);
  let s = await k.state(), r4 = s.plans.G.rooms.find((r) => r.id === 'r4');
  T.eq([r4.x, r4.y, r4.w, r4.h, await k.commits()], [0, 4.5, 3.5, 4, 1], `${tag} move: released on the 0.5 m grid (y 4.5), exactly one commit`);
  T.eq([s.plans.G.edited, s.plans.G.approved], [true, false], `${tag} move: the floor is edited`);
  T.eq(s.plans['1'], s0.plans['1'], `${tag} editing Ground leaves First deep-equal`);
  // the move overlaps the Majlis: marked on release, Approve refused with the reason
  T.eq([await k.text('plan-msg'), await hook('plan-msg').getAttribute('data-kind')], ['Majlis and Kitchen overlap. Move or resize the marked rooms to approve this floor.', 'block'], `${tag} overlap: reason in the message line`);
  T.eq(await k.approve(), { disabled: false, aria: 'true', pressed: 'false', approved: false, label: 'Approve floor' }, `${tag} overlap: Approve aria-disabled`);
  const red = await page.evaluate(([x, y]) => { const c = document.querySelector('[data-pc="plan-canvas"]'), r = c.getBoundingClientRect(), d = c.getContext('2d').getImageData(Math.round((x - r.left) * PC.debug.view('plan').dpr), Math.round((y - r.top) * PC.debug.view('plan').dpr), 1, 1).data; return [d[0], d[1], d[2]]; }, await k.at(1, 4.75));
  T.ok(red[0] > red[1] + 20 && red[0] > red[2] + 20, `${tag} overlap: the overlapping area is tinted red (${red})`);
  await k.shot('3-overlap');
  await (vp.touch ? hook('btn-approve').tap({ force: true }) : hook('btn-approve').click({ force: true })); await settled(page);   // aria-disabled: pressable
  T.eq([(await k.state()).plans.G.approved, await k.text('plan-msg')], [false, 'Majlis and Kitchen overlap. Move or resize the marked rooms to approve this floor.'], `${tag} overlap: pressing Approve approves nothing, the reason stays`);
  // resize the front edge (s handle) 0.65 m back: snaps onto the Majlis wall (y 5); the pair with Dining is broken
  let h = await k.handle('r4', 's');
  await G.drag([h.x, h.y], [h.x, h.y - 0.65 * m]); await settled(page);
  r4 = (await k.state()).plans.G.rooms.find((r) => r.id === 'r4');
  T.eq([r4.x, r4.y, r4.w, r4.h], [0, 5, 3.5, 3.5], `${tag} s handle: the front edge snaps to the Majlis wall, the back edge stays`);
  const warns = () => page.evaluate(() => [...document.querySelectorAll('[data-pc="plan-warn-list"] [data-pc="warn-text"]')].map((e) => e.textContent));
  T.ok((await warns()).includes('Dining and Kitchen are not next to each other.'), `${tag} a broken pair warns`);
  T.eq((await k.approve()).aria, 'false', `${tag} a broken pair does not block Approve`);
  // resize the back edge 0.9 m: within 0.3 m of the Dining wall it lands on it, the pair is restored
  h = await k.handle('r4', 'n');
  await G.drag([h.x, h.y], [h.x, h.y - 0.9 * m], async () => { await k.shot('4-resize'); }); await settled(page);
  s = await k.state(); r4 = s.plans.G.rooms.find((r) => r.id === 'r4');
  T.eq([r4.y + r4.h, s.plans.G.unmet], [9.5, []], `${tag} n handle: snapped onto the Dining wall (9.5), shared wall restored`);
  T.ok(!(await warns()).includes('Dining and Kitchen are not next to each other.'), `${tag} the pair warning is gone`);
  // Approve: tab, counter, button state, message; Next still locked (First is Draft)
  await act('btn-approve'); await settled(page);
  T.eq([(await k.state()).plans.G.approved, await k.tabs(), await k.text('plan-counter'), await k.text('plan-msg')], [true, ['Approved', 'Draft'], '1 of 2 floors approved', 'Ground floor approved.'], `${tag} Approve floor`);
  T.eq(await k.approve(), { disabled: false, aria: 'false', pressed: 'true', approved: true, label: 'Approved' }, `${tag} Approved: pressed state`);
  T.ok(await hook('btn-next').isDisabled(), `${tag} Next locked until every floor is approved`);
  await k.shot('5-approved');
  // an edit on the approved floor returns it to Draft, told once
  h = await k.handle('r4', 'e');
  await G.drag([h.x, h.y], [h.x - 1.2 * m, h.y]); await settled(page);           // raw 2.3: the Dining edge 2.5
  s = await k.state();
  T.eq([s.plans.G.rooms.find((r) => r.id === 'r4').w, s.plans.G.approved, await k.tabs(), await k.text('plan-msg')], [2.5, false, ['Draft', 'Draft'], 'Ground floor is back to Draft. Approve it again when you are done.'], `${tag} edit on an approved floor: back to Draft, told once`);
  h = await k.handle('r4', 'e');
  await G.drag([h.x, h.y], [h.x + 1.2 * m, h.y]); await settled(page);           // raw 3.7: the stair edge 3.5
  T.eq((await k.state()).plans.G.rooms.find((r) => r.id === 'r4').w, 3.5, `${tag} e handle: back onto the stair edge`);
  T.eq(await k.text('plan-msg'), 'Drag a room to move it; tap it, then drag a handle to resize.', `${tag} ...and only once (a further edit shows the hint)`);
  // tapping "Approved" returns the floor to Draft without a dialog
  await act('btn-approve'); await settled(page); await act('btn-approve'); await settled(page);
  T.eq([(await k.state()).plans.G.approved, await k.text('plan-msg'), await k.text('plan-counter'), await page.locator('[data-pc="dialog-layer"]').evaluate((e) => e.hidden)], [false, 'Ground floor is back to Draft.', '0 of 2 floors approved', true], `${tag} tap "Approved": back to Draft, no dialog`);
  // the stair is not editable: a tap on it selects nothing, a drag on it pans the view and changes nothing
  const st = await k.at(4.75, 7.5);
  await G.tap(st); await settled(page);
  T.eq(await k.text('plan-room-name'), 'None selected', `${tag} a tap on the stair selects nothing`);
  const before = await k.state(), v0 = await page.evaluate(() => PC.debug.view('plan'));
  await G.drag(st, [st[0] + 40, st[1]]); await settled(page);
  T.ok(JSON.stringify(await k.state()) === JSON.stringify(before) && (await page.evaluate(() => PC.debug.view('plan'))).ox !== v0.ox, `${tag} a drag on the stair pans; nothing changes`);
  await act('plan-fit'); await settled(page);
  // handle targets: 44 px on touch (press 20 px off the centre grabs it), 10 px with a mouse
  const off = vp.touch ? [20, 26] : [8, 14];
  // (the Majlis left edge is the footprint edge; left of it is the plot margin, inside the canvas)
  const r2 = (await k.state()).plans.G.rooms.find((r) => r.id === 'r2');
  await G.tap(await k.centre('r2')); await settled(page);
  h = await k.handle('r2', 'w');
  const pre = await k.state();
  await G.drag([h.x - off[1], h.y], [h.x - off[1] + 0.7 * m, h.y]); await settled(page);
  T.ok(JSON.stringify((await k.state()).plans) === JSON.stringify(pre.plans), `${tag} a press ${off[1]} px off the handle does not grab it (it pans)`);
  await act('plan-fit'); await settled(page);
  h = await k.handle('r2', 'w');
  await G.drag([h.x - off[0], h.y], [h.x - off[0] + 0.7 * m, h.y]); await settled(page);
  const r2b = (await k.state()).plans.G.rooms.find((r) => r.id === 'r2');
  T.eq([r2b.x, r2b.w, r2b.y, r2b.h], [0.5, 4.5, r2.y, r2.h], `${tag} a press ${off[0]} px off the handle grabs it (left edge to 0.5 m)`);
  // a small room (Laundry 2 x 2 m) keeps separate targets: its handles sit outside it on a phone
  await G.tap(await k.centre('r7')); await settled(page);
  const r7a = (await k.state()).plans.G.rooms.find((r) => r.id === 'r7'), top = (await k.at(r7a.x, r7a.y + r7a.h))[1], hn = await k.handle('r7', 'n'), small = (await k.scale()) * 2 < 66;
  T.ok(!small || Math.abs(top - hn.y - 22) < 0.5, `${tag} small room: the n handle sits 22 px outside its edge (${(top - hn.y).toFixed(1)} px)`);
  await G.drag([hn.x, hn.y], [hn.x, hn.y - 0.7 * m]); await settled(page);
  const r7 = (await k.state()).plans.G.rooms.find((r) => r.id === 'r7');
  T.eq([r7.y, r7.h], [2, 2.5], `${tag} small room: the n handle resizes (not a move)`);
  // touch: a second finger during a drag cancels the edit
  if (vp.touch) {
    const cdp = await page.context().newCDPSession(page), send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: Math.round(p[0]), y: Math.round(p[1]), id: i })) });
    const a = await k.centre('r5'), b4 = await k.state(), n0 = await k.commits();
    await send('touchStart', [a]); for (let i = 1; i <= 6; i++) await send('touchMove', [[a[0] + i * 6, a[1]]]);
    await settled(page);
    await send('touchStart', [[a[0] + 36, a[1]], [a[0] + 80, a[1] - 80]]); await send('touchMove', [[a[0] + 30, a[1]], [a[0] + 100, a[1] - 100]]);   // the second finger inside the canvas
    await send('touchEnd', []); await settled(page);
    T.eq([JSON.stringify((await k.state()).plans) === JSON.stringify(b4.plans), (await k.commits()) - n0, await page.evaluate(() => PC.debug.planDrag())], [true, 0, null], `${tag} a second finger cancels the drag: nothing committed`);
  }
  // reload keeps layouts, edits and approvals
  await page.evaluate(() => PC.store.commit((s) => { PC.plans.approve(s, '1'); }));
  await page.evaluate(() => PC.ui.autosave.flush());
  const saved = await k.state();
  await page.reload(); await act('btn-resume'); await settled(page);
  T.eq((await k.state()).plans, saved.plans, `${tag} reload + Resume keeps layouts, edits and approvals`);
  await k.end('edit');
}

// Approval of every floor, the lock of stage 4, Q18 / Q19, Build 3D model -> stage 5 (3D view; unavailable here), Back.
async function interior(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k;
  await toStage3(k);
  await page.evaluate(() => PC.store.commit((s) => { PC.plans.approve(s, 'G'); }));
  T.eq([await hook('step-4').getAttribute('aria-disabled'), await hook('step-4').getAttribute('title')], ['true', 'Approve all floors first'], `${tag} stage 4 locked while a floor is Draft, with the reason`);
  await (vp.touch ? hook('step-4').tap({ force: true }) : hook('step-4').click({ force: true })); await settled(page);
  T.eq((await k.state()).stage, 3, `${tag} ...a tap on it stays on stage 3`);
  await k.tab('First floor').evaluate((e) => e.click()); await settled(page);
  await act('btn-approve'); await settled(page);
  T.eq([await k.text('plan-msg'), await k.text('plan-counter'), await hook('btn-next').isDisabled()], ['All floors approved. Next: Interior.', '2 of 2 floors approved', false], `${tag} last floor approved: Next unlocked`);
  const sigs = await k.state();
  await act('btn-next'); await settled(page);
  const qs = await page.evaluate(() => [...document.querySelectorAll('[data-stage="4"] [data-q]')].filter((e) => e.getClientRects().length).map((e) => e.dataset.q));
  const checked = await page.evaluate(() => ['q-interior-style', 'q-interior-density'].map((h) => document.querySelector(`[data-pc="${h}"] input:checked`).value));
  T.eq([(await k.state()).stage, qs, checked, await page.evaluate(() => document.querySelectorAll('[data-pc="banner-slot"] > *').length), await k.text('btn-next-label')], [4, ['18', '19'], ['modern', 'full'], 0, 'Build 3D model'], `${tag} stage 4: exactly Q18 and Q19 with the defaults, no static banner`);
  await k.shot('6-interior');
  const tap = (sel) => (vp.touch ? page.locator(sel).tap() : page.locator(sel).click());
  await tap('[data-pc="q-interior-style"] label:has(> input[value="classic"])'); await tap('[data-pc="q-interior-density"] label:has(> input[value="sparse"])'); await settled(page);
  let s = await k.state();
  T.eq([s.ans.interior, s.plans], [{ style: 'classic', density: 'sparse' }, sigs.plans], `${tag} Q18 / Q19 change commits; plans and approvals kept`);
  await act('btn-next'); await settled(page);
  const banners = await page.evaluate(() => [...document.querySelectorAll('[data-pc="banner-slot"] > *')].map((e) => e.textContent.trim()));
  const unavailable = await page.evaluate(() => !document.querySelector('[data-pc="v3-unavailable"]').hidden);
  T.eq([(await k.state()).stage, banners, unavailable, await hook('btn-next').isHidden()], [5, [], true, true], `${tag} Build 3D model opens stage 5 (F4-T1: no banner; three.js aborted here, so the unavailable message)`);
  await k.shot('7-stage5');
  await act('btn-back'); await settled(page);
  s = await k.state();
  T.eq([s.stage, ['G', '1'].map((id) => s.plans[id].approved), await page.evaluate(() => document.querySelector('[data-pc="q-interior-style"] input:checked').value)], [4, [true, true], 'classic'], `${tag} Back to stage 4: approvals and the choice kept`);
  await k.end('interior');
}

// Label tiers (DP 3): twins of different sizes share one form at every zoom. First floor, Bathroom 2 widened to
// 4.5 m while Bathroom 1 stays 2.5 m; the mouse wheel zooms out step by step.
async function tiers(vp) {
  const k = await kit(vp), { page, hook, tag } = k;
  await toStage3(k);
  await k.tab('First floor').click(); await settled(page);
  await page.evaluate(() => PC.store.commit((s) => { const r = s.plans['1'].rooms.find((q) => q.id === 'r14'); PC.plans.applyEdit(s, '1', { ...r, w: 4.5 }); }));
  const box = await hook('plan-canvas').boundingBox(), c = [box.x + box.width / 2, box.y + box.height / 2];
  const tierOf = (t) => (/^Bathroom \d$/.test(t) ? 'full' : /^Bath \d$/.test(t) ? 'short' : /^Ba\d$/.test(t) ? 'tiny' : null);
  const seen = new Set(); let mixed = [];
  for (let i = 0; i < 14; i++) {
    const L = await page.evaluate(() => PC.debug.planLabels().map((l) => l.text)), t = L.map(tierOf).filter(Boolean);
    if (t.length === 2) { seen.add(t[0]); if (t[0] !== t[1]) mixed.push(`${t} at ${(await k.scale()).toFixed(1)} px/m`); }
    await page.mouse.move(c[0], c[1]); await page.mouse.wheel(0, 120); await settled(page);
  }
  T.eq(mixed, [], `${tag} the two bathrooms always share one label form`);
  T.ok(seen.size >= 2, `${tag} ...across zoom levels that use different forms (${[...seen]})`);
  await k.end('tiers');
}

// Keyboard (1280x800): tabs, Approve / un-approve, Regenerate dialog (Esc), stage 4 radios, Build 3D model.
async function keyboard(vp) {
  const k = await kit(vp), { page, hook, tag } = k, key = (x) => page.keyboard.press(x);
  await toStage3(k);
  await page.evaluate(() => PC.store.commit((s) => { s.plans.G.edited = true; }));
  await hook('btn-approve').focus(); await key('Enter'); await settled(page);
  T.eq([(await k.state()).plans.G.approved, (await k.approve()).pressed], [true, 'true'], `${tag} Enter on Approve floor approves`);
  await key('Enter'); await settled(page);
  T.eq((await k.state()).plans.G.approved, false, `${tag} Enter on Approved returns to Draft`);
  await key('Enter'); await settled(page);
  await hook('btn-regenerate').focus(); await key('Enter'); await settled(page);
  T.eq([await k.text('dialog-title'), await k.text('dialog-text')], ['Regenerate this floor?', 'Your manual edits to the Ground floor and its approval will be lost. It will be laid out again from the room list.'], `${tag} Regenerate asks, naming edits and approval (PM round 6)`);
  await key('Escape'); await settled(page);
  T.eq([(await k.state()).plans.G.approved, await page.evaluate(() => document.activeElement.dataset.pc)], [true, 'btn-regenerate'], `${tag} Esc cancels; focus returns to Regenerate`);
  await k.tab('Ground floor').focus(); await key('ArrowRight'); await settled(page);
  T.eq(await k.level(), '1', `${tag} ArrowRight on the tabs shows the First floor`);
  await hook('btn-approve').focus(); await key('Enter'); await settled(page);
  await hook('btn-regenerate').focus(); await key('Enter'); await settled(page);
  T.eq(await k.text('dialog-text'), "The First floor's approval will be cleared. It will be laid out again from the room list.", `${tag} Regenerate on an approved, unedited floor asks too (R5 round 5)`);
  await key('Escape'); await settled(page);
  await hook('btn-next').focus(); await key('Enter'); await settled(page);
  T.eq((await k.state()).stage, 4, `${tag} Enter on Next opens stage 4`);
  await page.locator('[data-pc="q-interior-style"] input:checked').focus(); await key('ArrowRight'); await settled(page);
  T.eq((await k.state()).ans.interior.style, 'classic', `${tag} arrow keys change Q18`);
  await hook('btn-next').focus(); await key('Enter'); await settled(page);
  T.eq((await k.state()).stage, 5, `${tag} Enter on Build 3D model opens stage 5`);
  await k.end('keyboard');
}

try {
  // A-16 trim (F3-T3 first item, QA; docs/03-tasks/F3-T3/qa-trim.md): edit() and interior() no longer run at 1280x800,
  // where their twin tests/qa/f3-t2-editor.mjs sections 1-8 run by mouse (select, move / resize = QA oracle, 10 px handle
  // radius, stair pans, overlap texts + aria-disabled Approve, Approve / Approved toggle, back-to-Draft note, Regenerate
  // texts, reload, stage 4 Q18 / Q19 and stage 5, Back). They keep 360x640 touch here; keyboard() and tiers() keep 1280x800.
  await edit(VPS[0]); await interior(VPS[0]);
  await keyboard(VPS[1]); await tiers(VPS[1]);
} catch (e) { T.ok(false, 'spec crashed: ' + e.message); }
await browser.close();
process.exit(T.done() ? 1 : 0);
