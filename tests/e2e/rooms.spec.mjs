// F2-T3 increment 2: Rooms group (Q11-Q14, F2-S2) - add / edit / remove rooms, master, pairs, stairs and lift,
// the move / delete / cancel remove-level dialog, Fix on room conflicts, R5 with seeded plans, draft round trip.
// Real input: taps (touch at 360x640 and 640x360) or clicks (1280x800), typing, Enter, selects.
import { launch, open, suite, settled, LANDSCAPE } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e rooms'), browser = await launch();
const VPS = [{ tag: '360x640', w: 360, h: 640, touch: true }, LANDSCAPE, { tag: '768x1024', w: 768, h: 1024, touch: true }, { tag: '1280x800', w: 1280, h: 800, touch: false }];   // 768x1024 since F3-T1 (F2-T3 QA gap)
const SQ = [[0, 0], [20, 0], [20, 20], [0, 20]];

async function kit(vp, o2 = {}) {
  const o = await open(browser, vp), { page, hook } = o, tag = vp.tag;
  const k = {
    ...o, tag,
    tapEl: (loc) => (vp.touch ? loc.tap() : loc.click()),
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(PC.debug.state()))),
    text: (h) => hook(h).evaluate((el) => el.textContent.trim().replace(/\s+/g, ' ')),
    shown: (h) => hook(h).evaluate((el) => !el.closest('[hidden]')),
    radio: (h, v) => k.tapEl(page.locator(`[data-pc="${h}"] label:has(> input[value="${v}"])`)),
    sw: async (h, on) => { if ((await hook(h).isChecked()) !== on) await k.tapEl(page.locator(`label:has(> [data-pc="${h}"])`)); await settled(page); },
    type: async (h, text, root) => { const el = root ? root.locator(`[data-pc="${h}"]`) : hook(h); await el.click(); await el.fill(''); await page.keyboard.type(text); await page.keyboard.press('Enter'); await settled(page); },
    group: (lv) => page.locator(`[data-pc="room-list"] [data-level="${lv}"]`),
    rowOf: (id) => page.locator(`[data-pc="room-list"] [data-room="${id}"]`),
    names: (lv) => page.evaluate((lv) => [...document.querySelectorAll(`[data-pc="room-list"] [data-level="${lv}"] [data-pc="room-name"]`)].map((e) => e.textContent), lv),
    roomsOn: async (lv) => (await k.state()).ans.rooms.filter((r) => r.level === lv),
    levelRows: () => page.evaluate(() => [...document.querySelectorAll('[data-pc="sum-levels"] > *')].map((r) => r.textContent.trim().replace(/\s+/g, ' '))),
    rows: () => page.evaluate(() => [...document.querySelectorAll('[data-pc="conflict-list"] > li')].map((li) => li.dataset.code)),
    seedPlans: () => page.evaluate(() => PC.store.commit((s) => { PC.levels.ids(s).forEach((id) => { s.plans[id] = { sig: PC.sig.level(s, id), rooms: [], unmet: [], edited: true, approved: true, error: null }; }); }, { nav: true })),
    dialogOpen: async () => !(await hook('dialog-layer').evaluate((el) => el.hidden)),
    focused: () => page.evaluate(() => { const e = document.activeElement; return e && [e.dataset.pc, e.closest('[data-room]') && e.closest('[data-room]').dataset.room]; }),
    end: async (label) => {
      for (const fn of ['noPageScroll', 'barInViewport', 'tapTargets']) T.none(await A[fn](page), `${tag} ${label}: ${fn}`);
      T.ok(await page.evaluate(() => { const sc = document.querySelector('[data-stage="2"] .pc-qs__scroll'); return sc.scrollWidth <= sc.clientWidth + 0.5; }), `${tag} ${label}: no horizontal scroll in the questions`);
      T.none(o.problems(), `${tag} ${label}: clean log`); await o.ctx.close();
    }
  };
  if (o2.plot) await page.evaluate((pts) => PC.store.commit((s) => { s.plot = { pts, closed: true }; s.ans.streetEdge = 0; }), o2.plot);
  else await o.act('btn-sample');
  await page.evaluate(() => { PC.stages.MAX_BUILT = 5; PC.ui.shell.render(); });
  await o.act('btn-next'); await o.act('q-tab-rooms'); await settled(page);
  return k;
}

async function addAndEdit(vp) {
  const k = await kit(vp, { plot: SQ }), { page, hook, act, tag } = k;
  T.eq([await k.names('G'), await k.names('1')], [['Living', 'Kitchen', 'Bathroom'], ['Bedroom 1', 'Bedroom 2', 'Bathroom']], `${tag} default rooms listed per level, auto-named`);
  T.eq(await k.text('room-add-size-hint'), 'M bedroom = 16 m²', `${tag} size hint for M bedroom`);
  // add 3 bedrooms on the first floor with the count stepper
  await hook('room-add-level').selectOption('1');
  await act('room-add-count-inc'); await act('room-add-count-inc');
  T.eq(await hook('room-add-count').inputValue(), '3', `${tag} count stepper`);
  const need0 = await k.levelRows();
  await act('btn-room-add'); await settled(page);
  T.eq(await k.names('1'), ['Bedroom 1', 'Bedroom 2', 'Bathroom', 'Bedroom 3', 'Bedroom 4', 'Bedroom 5'], `${tag} count 3 adds Bedroom 3..5`);
  T.eq([await k.group('G').locator('[data-pc="group-count"]').textContent(), await k.group('1').locator('[data-pc="group-count"]').textContent()], ['3 of 10', '6 of 10'], `${tag} group counts`);
  T.ok((await k.levelRows())[1] !== need0[1] && (await k.levelRows())[1].startsWith('First floor 96 m²'), `${tag} summary needed follows (${(await k.levelRows())[1]})`);
  // exact area typed in ft, stored in m2
  await k.tapEl(page.locator('label:has(> input[name="unit-toggle"][value="ft"])')); await settled(page);
  await k.radio('room-add-size', 'exact');
  T.eq([await k.text('room-add-size-hint'), await k.text('room-add-area-unit')], ['Exact area: 43 sq ft to 861 sq ft', 'sq ft'], `${tag} exact area limits in ft`);
  await hook('room-add-type').selectOption('storage');
  await k.type('room-add-area', '100');
  T.ok(!(await k.dialogOpen()), `${tag} Enter in the area field submits nothing`);
  await act('btn-room-add'); await settled(page);
  const st = (await k.roomsOn('1')).at(-1);
  T.eq([st.type, st.size, st.area], ['storage', null, 9.2903], `${tag} 100 sq ft stored as 9.2903 m2`);
  T.eq(await k.text('room-msg'), '', `${tag} no message after a successful add`);
  // 11th room refused inline (4 more on a floor of 7; CD-4: 10 per floor)
  await k.radio('room-add-size', 'M'); for (let i = 0; i < 3; i++) await act('room-add-count-inc');
  const before = await k.state();
  await act('btn-room-add'); await settled(page);
  T.eq([await k.text('room-msg'), await k.state()], ['The First floor has 7 rooms: 3 more fit (10 per floor).', before], `${tag} an 11th room is refused inline, nothing stored`);
  await k.tapEl(page.locator('label:has(> input[name="unit-toggle"][value="m"])')); await settled(page);
  // edit a row: size L, type, exact area with a bad value then a good one (Enter)
  const r5 = k.rowOf('r5');
  await r5.locator('[data-pc="room-size"]').selectOption('L'); await settled(page);
  T.eq([(await k.state()).ans.rooms.find((r) => r.id === 'r5').size, await r5.locator('[data-pc="room-area-hint"]').textContent()], ['L', '24 m²'], `${tag} row size L`);
  await r5.locator('[data-pc="room-size"]').selectOption('exact'); await settled(page);
  T.eq([(await k.state()).ans.rooms.find((r) => r.id === 'r5').area, await r5.locator('[data-pc="room-area"]').inputValue()], [24, '24'], `${tag} Exact starts from the current area`);
  await k.type('room-area', '2', r5);
  T.eq([await r5.locator('[data-pc="room-area"]').getAttribute('aria-invalid'), (await k.state()).ans.rooms.find((r) => r.id === 'r5').area, await k.rows()], ['true', 24, ['field-invalid']], `${tag} 2 m2 refused: marked, conflict, nothing stored`);
  await k.type('room-area', '30', r5);
  T.eq([await r5.locator('[data-pc="room-area"]').getAttribute('aria-invalid'), (await k.state()).ans.rooms.find((r) => r.id === 'r5').area, (await k.rows()).includes('field-invalid')], [null, 30, false], `${tag} 30 m2 stored, conflict cleared`);
  await k.rowOf('r4').locator('[data-pc="room-type"]').selectOption('office'); await settled(page);
  T.eq((await k.names('1'))[0], 'Office', `${tag} type change renames`);
  // master: one per house
  await k.tapEl(k.rowOf('r5').locator('label:has(> [data-pc="room-master"])')); await settled(page);
  await k.tapEl(k.rowOf('r7').locator('label:has(> [data-pc="room-master"])')); await settled(page);
  T.eq((await k.state()).ans.rooms.filter((r) => r.master).map((r) => r.id), ['r7'], `${tag} one master bedroom per house`);
  T.ok((await k.names('1')).includes('Master bedroom'), `${tag} ...named Master bedroom`);
  T.ok(!(await k.rowOf('r4').locator('label:has(> [data-pc="room-master"])').isVisible()), `${tag} no master choice on an office`);
  // pairs: B lists only rooms of A's level; duplicate ignored; cross-level impossible
  await hook('pair-a').selectOption('r1');
  const bOpts = await hook('pair-b').evaluate((el) => [...el.options].map((o) => o.value).filter(Boolean));
  T.eq(bOpts, ['r2', 'r3'], `${tag} second room offers only rooms of the same floor`);
  await hook('pair-b').selectOption('r2'); await act('btn-pair-add'); await settled(page);
  T.eq([(await k.state()).ans.pairs, await page.locator('[data-pc="pair-list"] [data-pc="pair-text"]').allTextContents()], [[['r1', 'r2']], ['Living + Kitchen · Ground floor']], `${tag} pair added`);
  await hook('pair-a').selectOption('r2'); await hook('pair-b').selectOption('r1'); await act('btn-pair-add'); await settled(page);
  T.eq([(await k.state()).ans.pairs.length, await k.text('pair-msg')], [1, 'That pair already exists.'], `${tag} duplicate ignored`);
  // moving a paired room to another level drops its pairs and says so
  await k.rowOf('r2').locator('[data-pc="room-level"]').selectOption('1'); await settled(page);
  T.eq([(await k.state()).ans.pairs, await k.text('room-msg')], [[], 'Its pairs were removed.'], `${tag} a room moved to another floor loses its pairs`);
  // delete a paired room removes the pair
  await hook('pair-a').selectOption('r1'); await hook('pair-b').selectOption('r3'); await act('btn-pair-add'); await settled(page);
  await k.tapEl(k.rowOf('r3').locator('[data-pc="room-delete"]')); await settled(page);
  T.eq([(await k.state()).ans.pairs, (await k.state()).ans.rooms.some((r) => r.id === 'r3')], [[], false], `${tag} deleting a room removes its pair`);
  T.ok(await page.evaluate(() => PC.draft.validState(PC.debug.state())), `${tag} the state is a valid draft`);
  // draft round trip
  await page.evaluate(() => PC.ui.autosave.flush());
  const saved = await k.state(), listed = await k.names('1');
  await page.reload(); await act('btn-resume'); await settled(page);
  const back = await k.state(); delete back.plans; delete saved.plans;            // Resume also lays out the levels (F3-T1 sync)
  T.eq(back, saved, `${tag} reload + Resume: rooms, sizes, master, pairs identical`);
  await act('q-tab-rooms');
  T.eq(await k.names('1'), listed, `${tag} ...and listed again (${listed})`);
  await k.end('add and edit');
}

async function stairsAndLevels(vp) {
  let k = await kit(vp, { plot: SQ }), { page, hook, act, tag } = k;
  T.ok(await k.shown('q-stairs-box') && !(await k.shown('q-stairs-none')), `${tag} two floors: stair position and lift shown`);
  await k.radio('q-stair-pos', 'bl'); await settled(page);
  await k.sw('q-lift', true);
  T.eq([(await k.state()).ans.stairPos, (await k.state()).ans.lift], ['bl', true], `${tag} stair position and lift stored`);
  // removing the first floor: move (default), cancel, delete
  await act('q-tab-building');
  const s0 = await k.state();
  await k.radio('q-floors', '1'); await settled(page);
  T.eq([await k.text('dialog-title'), await k.text('level-remove-text'), await hook('level-remove-move').isChecked(), await hook('level-remove-move').isDisabled()],
    ['Remove First floor?', 'The First floor has 3 rooms. Move them to the Ground floor, or delete them?', true, false], `${tag} three-way dialog, move preselected`);
  await act('dialog-cancel'); await settled(page);
  T.eq(await k.state(), s0, `${tag} Cancel keeps the floor and its rooms`);
  await k.radio('q-floors', '1'); await act('dialog-ok'); await settled(page);
  let s = await k.state();
  T.eq([s.ans.floors, s.ans.rooms.filter((r) => r.level === 'G').length, s.ans.rooms.length], [1, 6, 6], `${tag} Remove with move: all rooms on the ground floor`);
  await act('q-tab-rooms');
  T.ok(!(await k.shown('q-stairs-box')) && await k.shown('q-stairs-none'), `${tag} one floor: "single level: no staircase needed"`);
  await act('q-tab-building'); await k.sw('q-usable-roof', true); await act('q-tab-rooms');
  T.ok(await k.shown('q-stairs-box'), `${tag} usable roof: stairs again`);
  await k.end('stairs and levels');
  // delete path and the full-target case on the sample
  k = await kit(vp); ({ page, hook, act, tag } = k);
  await k.seedPlans();
  await act('q-tab-building'); await k.radio('q-floors', '1'); await settled(page);
  T.eq([await hook('level-remove-move').isDisabled(), await hook('level-remove-delete').isChecked(), await k.text('level-remove-text')], [true, true, 'The First floor has 7 rooms. They cannot be moved: the Ground floor would have more than 10 rooms. Delete them?'], `${tag} move disabled with its reason, delete preselected`);
  await act('dialog-ok'); await settled(page);
  s = await k.state();
  T.ok(!(await k.dialogOpen()) && s.ans.floors === 1 && s.ans.rooms.every((r) => r.level === 'G') && !s.plans['1'], `${tag} Remove with delete: one dialog, first floor rooms and plan gone`);
  T.ok(await page.evaluate(() => PC.draft.validState(PC.debug.state())), `${tag} valid draft`);
  await k.end('remove level');
}

async function fixAndR5(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k;
  // empty second floor: Fix lands on the add form, set to that floor
  await act('q-tab-building'); await k.radio('q-floors', '3'); await settled(page);
  T.eq(await k.rows(), ['floor-empty'], `${tag} third floor without rooms blocks`);
  if (await hook('summary-toggle').isVisible() && (await hook('summary-toggle').getAttribute('aria-expanded')) === 'false') await act('summary-toggle');
  await k.tapEl(page.locator('[data-pc="conflict-list"] li[data-code="floor-empty"] [data-pc="conflict-goto"]')); await settled(page);
  T.eq([await k.shown('q-group-rooms'), await hook('room-add-level').inputValue(), (await k.focused())[0]], [true, '2', 'room-add-type'], `${tag} Fix: Rooms open, add form set to the Second floor, type focused`);
  await act('btn-room-add'); await settled(page);
  T.eq(await k.rows(), [], `${tag} adding a room there clears it`);
  // needed over available: Fix focuses that level's first room
  await page.evaluate(() => PC.store.commit((s) => { s.ans.footprintPct = 15; }));
  const codes = await k.rows();
  T.ok(codes.includes('level-over'), `${tag} level-over (${codes})`);
  if (await hook('summary-toggle').isVisible() && (await hook('summary-toggle').getAttribute('aria-expanded')) === 'false') await act('summary-toggle');
  await k.tapEl(page.locator('[data-pc="conflict-list"] li[data-code="level-over"] [data-pc="conflict-goto"]').first()); await settled(page);
  const lvl = await page.evaluate(() => PC.validate(PC.debug.state()).blocking.find((c) => c.code === 'level-over').level);
  T.eq(await k.focused(), ['room-type', (await k.roomsOn(lvl))[0].id], `${tag} Fix on level-over focuses the first room of ${lvl}`);
  await k.end('fix');
  // R5 with seeded plans: a room change asks once per visit, naming only the level it touches
  const k2 = await kit(vp), p2 = k2.page;
  await k2.seedPlans();
  const s0 = await k2.state();
  await k2.rowOf('r9').locator('[data-pc="room-size"]').selectOption('L'); await settled(p2);
  T.eq([await k2.dialogOpen(), await k2.text('dialog-text')], [true, 'The floor plan of the First floor will be regenerated, with its manual edits and approval.'], `${tag} a room size change asks, naming the First floor only`);
  await k2.act('dialog-cancel'); await settled(p2);
  T.eq([await k2.state(), await k2.rowOf('r9').locator('[data-pc="room-size"]').inputValue()], [s0, 'M'], `${tag} Cancel: state and row as before`);
  await k2.rowOf('r9').locator('[data-pc="room-size"]').selectOption('L'); await k2.act('dialog-ok'); await settled(p2);
  await k2.act('btn-room-add'); await settled(p2);
  T.eq([await k2.dialogOpen(), (await k2.state()).ans.rooms.length], [false, 15], `${tag} a later room change in the visit applies without asking`);
  await k2.end('R5 rooms');
}

async function keyboard(vp) {
  const k = await kit(vp, { plot: SQ }), { page, hook, tag } = k;
  await hook('room-add-count').focus(); await hook('room-add-count').fill(''); await page.keyboard.type('2'); await page.keyboard.press('Enter'); await settled(page);
  T.eq([await hook('room-add-count').inputValue(), (await k.state()).ans.rooms.length], ['2', 6], `${tag} Enter in the count field adds nothing by itself`);
  await hook('btn-room-add').focus(); await page.keyboard.press('Enter'); await settled(page);
  T.eq((await k.state()).ans.rooms.length, 8, `${tag} Enter on Add room adds 2`);
  await k.rowOf('r4').locator('[data-pc="room-master"]').focus(); await page.keyboard.press(' '); await settled(page);
  T.eq((await k.state()).ans.rooms.filter((r) => r.master).map((r) => r.id), ['r4'], `${tag} Space on Master`);
  T.eq(await k.focused(), ['room-master', 'r4'], `${tag} focus stays on the same control after the update`);
  await k.rowOf('r7').locator('[data-pc="room-delete"]').focus(); await page.keyboard.press('Enter'); await settled(page);
  T.ok(!(await k.state()).ans.rooms.some((r) => r.id === 'r7'), `${tag} Enter on delete removes the room`);
  await k.end('keyboard');
}

// TL increment-2 review: an invalid exact area must not outlive its field (room deleted, size back to S / M / L,
// its level removed with "delete"): no field-invalid row left, stage 2 valid again.
async function staleInvalid(vp) {
  const k = await kit(vp, { plot: SQ }), { page, hook, act, tag } = k;
  const valid2 = () => page.evaluate(() => PC.stages.status(PC.debug.state())[2].valid);
  const bad = async (id) => {
    T.eq(await page.evaluate(() => Object.keys(PC.store.session.invalidFields)), [], `${tag} ${id}: no invalid entry before the case`);
    const row = k.rowOf(id);
    await row.locator('[data-pc="room-size"]').selectOption('exact'); await settled(page);
    await k.type('room-area', '2', row);
    T.ok((await k.rows()).includes('field-invalid') && !(await valid2()), `${tag} ${id}: invalid exact area blocks`);
  };
  const clean = async (label) => T.ok(!(await k.rows()).includes('field-invalid') && await valid2() && !(await page.evaluate(() => Object.keys(PC.store.session.invalidFields).length)), `${tag} ${label}: no field-invalid row, stage 2 valid`);
  await bad('r2');
  await k.tapEl(k.rowOf('r2').locator('[data-pc="room-delete"]')); await settled(page);
  await clean('(a) room deleted');
  await bad('r3');
  await k.rowOf('r3').locator('[data-pc="room-size"]').selectOption('S'); await settled(page);
  await clean('(b) size back to S');
  await bad('r5');
  await act('q-tab-building'); await k.radio('q-floors', '1'); await settled(page);
  await k.tapEl(page.locator('label:has(> [data-pc="level-remove-delete"])')); await act('dialog-ok'); await settled(page);
  T.eq((await k.state()).ans.floors, 1, `${tag} first floor removed with delete`);
  await clean('(c) its level removed');
  await k.end('stale invalid area');
}

// F2-T3 QA gaps (carried into F3-T1): the 7th pair, a move refused by the 6-pair limit, the plans sentence for
// Move versus Delete. Expected texts are written out here, not taken from app helpers.
async function pairLimitsAndPlans(vp) {
  let k = await kit(vp, { plot: SQ }), { page, hook, act, tag } = k;
  await page.evaluate(() => PC.store.commit((s) => {
    PC.levels.addRooms(s, { type: 'office', level: 'G', size: 'S', area: null, count: 2 });     // r7, r8 on the ground floor
    s.ans.pairs = [['r1', 'r2'], ['r1', 'r3'], ['r1', 'r7'], ['r1', 'r8'], ['r2', 'r3'], ['r2', 'r7'], ['r4', 'r5'], ['r4', 'r6'], ['r5', 'r6']];
  }));
  await settled(page);
  await hook('pair-a').selectOption('r3'); await hook('pair-b').selectOption('r7'); await act('btn-pair-add'); await settled(page);
  T.eq([await k.text('pair-msg'), (await k.state()).ans.pairs.length], ['The Ground floor already has 6 pairs, the most per floor.', 9], `${tag} the 7th pair on a floor is refused`);
  await act('q-tab-building'); await k.radio('q-floors', '1'); await settled(page);
  T.eq([await k.text('level-remove-text'), await hook('level-remove-move').isDisabled(), await hook('level-remove-delete').isChecked()],
    ['The First floor has 3 rooms. They cannot be moved: the Ground floor would have more than 6 pairs. Delete them?', true, true], `${tag} move refused by the 6-pair limit, with its reason`);
  await act('dialog-cancel'); await settled(page);
  await k.end('pair limits');
  // plans sentence: Move names the receiving floor, Delete only the removed one (seeded approved plans)
  k = await kit(vp, { plot: SQ }); ({ page, hook, act, tag } = k);
  await page.evaluate(() => PC.store.commit((s) => { s.ans.basement = true; PC.levels.addRooms(s, { type: 'storage', level: 'B', size: 'S', area: null, count: 1 }); }));
  await k.seedPlans();
  await act('q-tab-building'); await k.sw('q-basement', false);
  T.eq([await k.text('level-remove-text'), await k.text('dialog-text')], ['The Basement has 1 room. Move it to the Ground floor, or delete it?',
    'The floor plans of the Basement and the Ground floor will be regenerated or lost, with their manual edits and approvals.'], `${tag} Move: the Ground floor plan is named too`);
  await k.tapEl(page.locator('label:has(> [data-pc="level-remove-delete"])'));
  T.eq(await k.text('dialog-text'), 'The floor plan of the Basement will be lost, with its manual edits and approval.', `${tag} Delete: only the Basement plan`);
  await act('dialog-cancel'); await settled(page);
  await k.end('move vs delete');
}

// CTO F3 review, finding 1: after the sample is laid out, deleting a room leaves the stored Ground plan listing it
// until the next stage-3 visit. The autosaved draft must still be offered and restore exactly (it was discarded).
async function staleDraft(vp) {
  const k = await kit(vp), { page, act, tag } = k;
  T.ok((await k.state()).plans.G.rooms.some((r) => r.id === 'r5'), `${tag} the sample is laid out (Ground plan lists r5)`);
  await k.tapEl(k.rowOf('r5').locator('[data-pc="room-delete"]')); await settled(page);
  T.ok(!(await k.dialogOpen()) && !(await k.state()).ans.rooms.some((r) => r.id === 'r5'), `${tag} r5 deleted from the room list`);
  await page.evaluate(() => PC.ui.autosave.flush());
  const saved = await k.state();
  T.ok(saved.plans.G.rooms.some((r) => r.id === 'r5'), `${tag} the stored Ground plan is stale and still lists r5`);
  await page.reload(); await settled(page);
  const offered = await k.shown('resume-box');
  T.ok(offered, `${tag} reload: Resume is offered`);
  T.eq(await page.evaluate(() => { const d = PC.draft.parse(localStorage.getItem(PC.draft.KEY)); return d && d.state; }), saved, `${tag} the stored draft parses to the saved state exactly`);
  if (!offered) { await k.ctx.close(); return; }
  await act('btn-resume'); await settled(page);
  const back = await k.state(), want = JSON.parse(JSON.stringify(saved));
  T.eq([back.plans['1'], back.plans.G.sig], [saved.plans['1'], await page.evaluate(() => PC.sig.level(PC.debug.state(), 'G'))], `${tag} Resume: the First floor plan kept, only the Ground plan regenerated`);
  T.ok(!back.plans.G.rooms.some((r) => r.id === 'r5'), `${tag} the regenerated Ground plan no longer lists r5`);
  delete back.plans.G; delete want.plans.G;
  T.eq(back, want, `${tag} Resume restores the state (stage, answers, rooms, pairs, other plans)`);
  await k.end('stale plan draft');
}

try {
  await staleInvalid(VPS[0]);
  await staleDraft(VPS[0]);
  for (const vp of VPS) await pairLimitsAndPlans(vp);
  // A-16 trim (F3-T3 first item, QA; docs/03-tasks/F3-T3/qa-trim.md): these three no longer run at 360x640 and 1280x800,
  // where their twins in tests/qa/f2-t3-site-rooms.mjs run with the same input; they keep 640x360 and 768x1024 here.
  //   addAndEdit      (twin: QA G add form at 360x640, 640x360, 1280x800; QA H / I rows, master, pairs at 360x640, 1280x800)
  //   stairsAndLevels (twin: QA J stairs / lift / single-level note and QA K level removal, both at 360x640 and 1280x800)
  //   fixAndR5        (twin: QA L conflicts and Fix at 360x640, 1280x800; R5 on a room change: QA J / r5.spec rooms() at 360x640, 1280x800)
  for (const vp of [VPS[1], VPS[2]]) { await addAndEdit(vp); await stairsAndLevels(vp); await fixAndR5(vp); }
  await keyboard(VPS[2]);
} catch (e) { T.ok(false, 'spec crashed: ' + (e && e.stack || e)); } finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
