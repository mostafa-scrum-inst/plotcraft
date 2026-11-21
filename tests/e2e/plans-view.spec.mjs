// F3-T1: stage 3 plan view (F3-S1): tabs per plan level, generated plans drawn with every room, read-only room
// selection and readouts, warnings, the no-layout message and its link, Regenerate, plan-fit, sample / Skip / Resume.
// Real input: taps (touch at 360x640, 640x360, 768x1024) and clicks (1280x800), keyboard on the tabs.
import { launch, open, suite, settled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import { gestures } from '../helpers/touch.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e plans-view'), browser = await launch();
const VPS = [VIEWPORTS[0], LANDSCAPE, VIEWPORTS[1], VIEWPORTS[2]];
// Expected names written out here (not taken from the app): sample 6.2.
const NAMES = { G: { r1: 'Living', r2: 'Majlis', r3: 'Dining', r4: 'Kitchen', r5: "Maid's room", r6: 'Bathroom', r7: 'Laundry' },
  1: { r8: 'Master bedroom', r9: 'Bedroom 1', r10: 'Bedroom 2', r11: 'Living', r12: 'Office', r13: 'Bathroom 1', r14: 'Bathroom 2' } };

async function kit(vp) {
  const o = await open(browser, vp), { page, hook } = o, tag = vp.tag, G = await gestures(page, vp.touch);
  const k = {
    ...o, G, tag,
    tapEl: (loc) => (vp.touch ? loc.tap() : loc.click()),
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(PC.debug.state()))),
    text: (h) => hook(h).evaluate((el) => el.textContent.trim().replace(/\s+/g, ' ')),
    tabs: () => page.evaluate(() => [...document.querySelectorAll('[data-pc="plan-tabs"] [role="tab"]')].map((t) => [t.querySelector('[data-pc="tab-name"]').textContent, t.querySelector('[data-pc="tab-state"]').textContent, t.getAttribute('aria-selected')])),
    tab: (name) => page.locator('[data-pc="plan-tabs"] [role="tab"]', { hasText: name }),
    labels: () => page.evaluate(() => PC.debug.planLabels().map((l) => l.text)),
    view: () => page.evaluate(() => PC.debug.view('plan')),
    // screen centre of a room of the shown level
    roomAt: (id) => page.evaluate((id) => { const s = PC.debug.state(), f = PC.debug.site().footprint, lv = PC.debug.planView().level, r = s.plans[lv].rooms.find((q) => q.id === id); return PC.debug.toScreen('plan', f.u + r.x + r.w / 2, f.v + r.y + r.h / 2); }, id),
    end: async (label) => {
      for (const fn of ['noPageScroll', 'barInViewport', 'tapTargets']) T.none(await A[fn](page), `${tag} ${label}: ${fn}`);
      T.none(o.problems(), `${tag} ${label}: clean log`); await o.ctx.close();
    }
  };
  return k;
}
async function toStage3(k) { await k.act('btn-sample'); await k.act('btn-next'); await k.act('btn-next'); await settled(k.page); }

async function view(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k, big = vp.w >= 768;
  await toStage3(k);
  let s = await k.state();
  T.eq([s.stage, await page.evaluate(() => document.querySelectorAll('[data-pc="banner-slot"] > *').length)], [3, 0], `${tag} Next from stage 2 opens stage 3; no static banner`);
  T.eq(await k.tabs(), [['Ground floor', 'Draft', 'true'], ['First floor', 'Draft', 'false']], `${tag} one tab per plan level, Ground selected, Draft`);
  // F3-T2 review ruling 7: fitted to the footprint + 0.5 m with 12 px pads (F3-T1: 1.0 m); side room only for the Fit view button
  const fitInfo = await page.evaluate(() => {
    const f = PC.debug.site().footprint, a = PC.debug.toScreen('plan', f.u, f.v + f.d), b = PC.debug.toScreen('plan', f.u + f.w, f.v), btn = document.querySelector('[data-pc="plan-fit"]').getBoundingClientRect();
    const under = Math.max(a[0], b[0]) > btn.left && Math.min(a[1], b[1]) < btn.bottom;
    const v = PC.debug.view('plan');
    return { scale: v.scale, height: v.height, depth: f.d, under, strip: !document.querySelector('[data-pc="sample-strip"]').closest('[hidden]') };
  });
  if (tag === '360x640') {
    T.ok(fitInfo.strip && fitInfo.scale >= 12, `${tag} sample with the strip showing drawn at ${fitInfo.scale.toFixed(2)} px/m (>= 12)`);
    T.ok(Math.abs(fitInfo.scale - (fitInfo.height - 2 * 12) / (fitInfo.depth + 2 * 0.5)) < 0.01, `${tag} height-bound fit: footprint depth + 2 x 0.5 m in the canvas height - 2 x 12 px`);
  }
  T.ok(!fitInfo.under, `${tag} the footprint is not under the Fit view button`);
  T.eq([await k.text('plan-counter'), await hook('btn-approve').isDisabled(), await k.text('btn-approve-label'), await k.text('plan-msg')], ['0 of 2 floors approved', false, 'Approve floor', 'Drag a room to move it; tap it, then drag a handle to resize.'], `${tag} counter; Approve offered (F3-T2); the editing hint`);
  T.ok(['G', '1'].every((id) => s.plans[id] && s.plans[id].error === null && s.plans[id].rooms.length === 7), `${tag} both sample levels laid out`);
  for (const lv of ['G', '1']) {
    if (lv === '1') { await k.tapEl(k.tab('First floor')); await settled(page); }
    const plan = (await k.state()).plans[lv], L = await k.labels();
    if (big) for (const [id, name] of Object.entries(NAMES[lv])) {
      const r = plan.rooms.find((q) => q.id === id), area = Math.round(r.w * r.h) + ' m²';
      T.eq([L.filter((t) => t === name).length, L.includes(area)], [1, true], `${tag} ${lv}: "${name}" labelled once with its area ${area}`);
    }
    // every room can be tapped: the readout names it with its size and area (the phone path for small rooms)
    for (const [id, name] of Object.entries(NAMES[lv])) {
      const r = plan.rooms.find((q) => q.id === id);
      await k.G.tap(await k.roomAt(id)); await settled(page);
      // drawn vs asked (F3-T2, PM round 6): "(asked …)" only when the two areas format differently
      const asked = Math.round(await page.evaluate((id) => { const q = PC.debug.state().ans.rooms.find((x) => x.id === id); return PC.levels.roomArea(q); }, id)), drawn = Math.round(r.w * r.h);
      T.eq([await k.text('plan-room-name'), await k.text('plan-room-dims'), await k.text('plan-room-area')], [name, r.w.toFixed(1) + ' × ' + r.h.toFixed(1) + ' m', drawn + ' m²' + (asked !== drawn ? ` (asked ${asked} m²)` : '')], `${tag} ${lv}: tap selects ${name}`);
    }
  }
  T.ok(big ? (await k.labels()).includes('Stairs') : true, `${tag} the stair block is drawn and labelled`);
  // tabs by keyboard
  await k.tab('First floor').focus(); await page.keyboard.press('ArrowLeft'); await settled(page);
  T.eq([(await k.tabs()).map((t) => t[2]), await page.evaluate(() => document.activeElement.textContent.trim().startsWith('Ground'))], [['true', 'false'], true], `${tag} ArrowLeft moves to Ground (focus follows)`);
  T.eq(await k.text('plan-room-name'), 'None selected', `${tag} a level change clears the selection`);
  // plan-fit after pan / zoom
  const v0 = await k.view(), box = await hook('plan-canvas').boundingBox(), c = [box.x + box.width / 2, box.y + box.height / 2];
  if (vp.touch) await k.G.two([c[0] - 20, c[1]], [c[0] + 20, c[1]], [c[0] - 60, c[1]], [c[0] + 60, c[1]]);
  else { await page.mouse.move(c[0], c[1]); await page.mouse.wheel(0, -300); await settled(page); }
  T.ok((await k.view()).scale !== v0.scale, `${tag} the plan view zooms`);
  await act('plan-fit'); await settled(page);
  T.eq(await k.view(), v0, `${tag} Fit view gives back the fitted view`);
  // units: the readouts and labels follow ft
  await k.tapEl(page.locator('label:has(> [data-pc="unit-ft"])')); await settled(page);
  await k.G.tap(await k.roomAt('r1')); await settled(page);
  T.eq([await k.text('plan-room-area'), (await k.text('plan-room-dims')).endsWith('ft')], ['414 sq ft (asked 452 sq ft)', true], `${tag} readouts in ft (${await k.text('plan-room-dims')}), drawn vs asked`);
  T.eq((await k.state()).plans, s.plans, `${tag} a unit switch regenerates nothing`);
  await k.end('view');
}

async function problems(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k;
  await k.act('btn-sample');
  // first floor: one 80 m2 room only -> cannot be laid out around the stair; a seeded unmet pair on the ground floor
  await page.evaluate(() => PC.store.commit((s) => { s.ans.rooms = s.ans.rooms.filter((r) => r.level !== '1'); s.ans.pairs = s.ans.pairs.filter((p) => p[0] !== 'r8'); PC.levels.addRooms(s, { type: 'living', level: '1', size: null, area: 80, count: 1 }); }));
  await act('btn-next'); await act('btn-next'); await settled(page);
  T.eq(await k.tabs(), [['Ground floor', 'Draft', 'false'], ['First floor', 'Cannot be laid out', 'true']], `${tag} the level with a problem is shown first; its tab says so`);
  T.eq([await hook('plan-error').isVisible(), await k.text('plan-error-text')], [true, 'This floor could not be laid out. Try fewer or smaller rooms on this level, another stair position, or a larger footprint.'], `${tag} no-layout message names the three fixes`);
  await act('btn-goto-rooms'); await settled(page);
  const f = await page.evaluate(() => { const e = document.activeElement; return [PC.debug.state().stage, e && e.dataset.pc, e && e.closest('[data-level]') && e.closest('[data-level]').dataset.level]; });
  T.eq(f, [2, 'room-type', '1'], `${tag} the link opens stage 2 at the First floor room list`);
  await act('btn-next'); await settled(page);
  T.eq((await k.tabs())[1][2], 'true', `${tag} back on stage 3 the previous level stays selected`);
  // warnings: an unmet pair (seeded into a valid plan) and the F2 warnings repeated
  await page.evaluate(() => PC.store.commit((s) => { s.plans.G.unmet = [['r3', 'r4']]; s.ans.parking.cars = 4; }, { nav: true }));
  await k.tapEl(k.tab('Ground floor')); await settled(page);
  const ws = await page.evaluate(() => [...document.querySelectorAll('[data-pc="plan-warn-list"] [data-pc="warn-text"]')].map((e) => e.textContent));
  T.ok(ws.includes('Dining and Kitchen are not next to each other. Drag one against the other to join them.'), `${tag} unmet pair listed (${ws})`);
  T.ok(ws.some((w) => w.startsWith('Parking does not fit')) || !(await page.evaluate(() => PC.validate(PC.debug.state()).warnings.length)), `${tag} F2 warnings repeated`);
  T.eq(await k.text('plan-warn-count'), String(ws.length), `${tag} the chip counts them`);
  await k.end('problems');
}

async function regenerateAndResume(vp) {
  const k = await kit(vp), { page, act, tag } = k;
  await toStage3(k);
  const plan0 = (await k.state()).plans.G;
  await page.evaluate(() => PC.store.commit((s) => { s.plans.G.edited = true; s.plans.G.rooms[0].x += 0.5; }, { nav: true }));
  const edited = (await k.state()).plans.G;
  await act('btn-regenerate'); await settled(page);
  T.eq(await k.text('dialog-title'), 'Regenerate this floor?', `${tag} Regenerate asks after an edit`);
  await act('dialog-cancel'); await settled(page);
  T.eq((await k.state()).plans.G, edited, `${tag} Cancel keeps the edited plan`);
  await act('btn-regenerate'); await act('dialog-ok'); await settled(page);
  T.eq((await k.state()).plans.G, plan0, `${tag} Regenerate gives back the generated layout (deterministic), edits gone`);
  await act('btn-regenerate'); await settled(page);
  T.ok(await page.locator('[data-pc="dialog-layer"]').evaluate((e) => e.hidden), `${tag} an unedited floor regenerates without asking`);
  // Resume keeps stored plans (no regeneration)
  await page.evaluate(() => PC.store.commit((s) => { s.plans['1'].edited = true; }, { nav: true }));
  await page.evaluate(() => PC.ui.autosave.flush());
  const saved = await k.state();
  await page.reload(); await act('btn-resume'); await settled(page);
  T.eq((await k.state()).plans, saved.plans, `${tag} reload + Resume keeps the plans as stored`);
  // Skip to 3D on a fresh sample: plans approved, lands on stage 5 (MAX_BUILT 5; the 3D view since F4-T1)
  const k2 = await kit(vp); await k2.act('btn-sample'); await k2.act('btn-skip3d'); await settled(k2.page);
  const st2 = await k2.state();
  T.eq([st2.stage, ['G', '1'].map((id) => st2.plans[id].approved)], [5, [true, true]], `${tag} Skip to 3D: every level approved, stage 5`);
  await k2.act('step-3'); await settled(k2.page);
  T.eq([(await k2.tabs()).map((t) => t[1]), await k2.text('plan-counter')], [['Approved', 'Approved'], '2 of 2 floors approved'], `${tag} Skip: stage 3 shows both approved`);
  await k2.end('skip');
  await k.end('regenerate and resume');
}

// R5 as decided by the PM in round 5 (A-7, F3-T1 plan-review addendum): only levels with edits or an approval
// are asked about and named; untouched generated Drafts regenerate silently.
async function r5Rules(vp) {
  let k = await kit(vp), { page, hook, act, tag } = k;
  const dialog = () => page.locator('[data-pc="dialog-layer"]').evaluate((e) => !e.hidden);
  const setback = async (v) => { await act('q-tab-site'); const f = hook('q-setback-side'); await f.click(); await f.fill(''); await page.keyboard.type(v); await page.keyboard.press('Enter'); await settled(page); };
  // 1 after Load sample: a size-changing edit asks nothing; stage 3 shows regenerated Drafts
  await k.act('btn-sample'); await act('btn-next');
  const p0 = await k.state();
  await setback('2.5');
  T.eq([await dialog(), (await k.state()).ans.setbacks.side], [false, 2.5], `${tag} 1: after Load sample a size-changing edit asks nothing`);
  await act('btn-next'); await settled(page);
  const p1 = (await k.state()).plans;
  T.ok(p1.G.sig !== p0.plans.G.sig && p1.G.approved === false && (await k.tabs()).every((t) => t[1] === 'Draft'), `${tag} 1: stage 3 shows regenerated Drafts`);
  // 2 one approved + one untouched: the question names only the approved one; Cancel restores; Continue applies
  await page.evaluate(() => PC.store.commit((s) => { s.plans.G.approved = true; }, { nav: true }));
  await act('btn-back');
  const s2 = await k.state();
  await setback('2');
  T.eq([await dialog(), await k.text('dialog-text')], [true, 'The floor plan of the Ground floor will be regenerated, with its approval.'], `${tag} 2: names only the approved Ground floor`);
  await act('dialog-cancel'); await settled(page);
  T.eq([await k.state(), await hook('q-setback-side').inputValue()], [s2, '2.5'], `${tag} 2: Cancel restores`);
  await setback('2'); await act('dialog-ok'); await settled(page);
  T.eq((await k.state()).ans.setbacks.side, 2, `${tag} 2: Continue applies`);
  await k.end('r5 1-2');
  // 3 Q7: plans sentence only for edited / approved levels, hidden when none
  k = await kit(vp); ({ page, hook, act, tag } = k);
  await k.act('btn-sample'); await act('btn-next'); await act('btn-next'); await act('btn-back');
  await page.evaluate(() => PC.store.commit((s) => { s.ans.basement = true; PC.levels.addRooms(s, { type: 'storage', level: 'B', size: 'S', area: null, count: 1 }); }));
  await act('btn-next'); await act('btn-back'); await act('q-tab-building');                       // the basement plan exists, untouched
  await k.tapEl(page.locator('label:has(> [data-pc="q-basement"])')); await settled(page);
  T.eq([await dialog(), await hook('dialog-text').evaluate((e) => e.hidden), await k.text('level-remove-text')], [true, true, 'The Basement has 1 room. Move it to the Ground floor, or delete it?'], `${tag} 3: no edited or approved plan: no plans sentence (paragraph hidden)`);
  await act('dialog-cancel'); await settled(page);
  await page.evaluate(() => PC.store.commit((s) => { s.plans.B.edited = true; }, { nav: true }));
  await k.tapEl(page.locator('label:has(> [data-pc="q-basement"])')); await settled(page);
  T.eq(await k.text('dialog-text'), 'The floor plan of the Basement will be lost, with its manual edits.', `${tag} 3: only the edited Basement is named, with what it has (PM round 6)`);
  await act('dialog-cancel'); await settled(page);
  await k.end('r5 3');
  // 4 after Skip to 3D: the first size-changing edit asks, naming every level
  k = await kit(vp); ({ page, hook, act, tag } = k);
  await k.act('btn-sample'); await act('btn-skip3d'); await settled(page);
  await act('step-2'); await settled(page);
  await setback('2.5');
  T.eq(await k.text('dialog-text'), 'The floor plans of the Ground floor and the First floor will be regenerated, with their approvals.', `${tag} 4: after Skip (approvals) the first size-changing edit names every level`);
  await act('dialog-cancel'); await settled(page);
  await k.end('r5 4');
}

async function summaryDash(vp) {
  const k = await kit(vp), { page, act, tag } = k;
  await k.act('btn-sample'); await act('btn-next'); await act('q-tab-building');
  await k.tapEl(page.locator('[data-pc="q-floors"] label:has(> input[value="3"])')); await settled(page);
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-pc="sum-levels"] > *')].map((r) => r.textContent.trim().replace(/\s+/g, ' ')));
  T.eq(rows[2], 'Second floor – / 143 m²', `${tag} a level with no rooms shows "–" as needed (F2 review decision 4)`);
  await k.end('summary dash');
}

try {
  // A-16 trim (F3-T3 first item, QA; docs/03-tasks/F3-T3/qa-trim.md): a function no longer runs at a viewport where its
  // twin in tests/qa/f3-t1-stage3.mjs / f3-t2-editor.mjs runs with the same input (VPS = 360x640, 640x360, 768x1024, 1280x800).
  //   view                 360x640, 768x1024, 1280x800 (640x360 twin: QA F3-T1 A, tabs / counter / labels / tap readouts
  //                        m and ft / Fit view after pan; kept elsewhere for the fit formula and the >= 768 label checks)
  //   problems             768x1024 (twin: QA F3-T1 B no-layout tab, banner text, "Go to room list" focus, at 360x640,
  //                        640x360, 1280x800; unmet-pair warnings: QA F3-T1 check3 at every viewport)
  //   regenerateAndResume  768x1024 (twin: QA F3-T1 D Regenerate asks after an edit / Cancel / fresh Draft, reload + Resume
  //                        keeps plans, Skip approves both, at 360x640, 1280x800; QA F3-T2 6 Regenerate texts and
  //                        "untouched Draft: no dialog, same deterministic layout" at 360x640, 640x360, 1280x800)
  for (const vp of [VPS[0], VPS[2], VPS[3]]) await view(vp);
  await problems(VPS[2]); await regenerateAndResume(VPS[2]);
  await summaryDash(VPS[0]);
  for (const vp of [VPS[0], VPS[3]]) await r5Rules(vp);
} catch (e) { T.ok(false, 'spec crashed: ' + (e && e.stack || e)); } finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
