// F2-T2: questionnaire Q1-Q10 and Q15-Q17, site preview (Q5, Q6), summary and conflicts, R5 dialog, riders.
import { launch, open, suite, settled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import { gestures } from '../helpers/touch.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e questions'), browser = await launch();
const M2 = '²', DOT = ' · ';

async function kit(vp, o2 = {}) {
  const o = await open(browser, vp), { page, hook } = o, tag = vp.tag, G = await gestures(page, vp.touch);
  const k = {
    ...o, G, tag,
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(PC.debug.state()))),
    ev: (fn, arg) => page.evaluate(fn, arg),
    text: (h) => hook(h).evaluate((el) => el.textContent.trim().replace(/\s+/g, ' ')),
    val: (h) => hook(h).inputValue(),
    hidden: (h) => hook(h).evaluate((el) => !!el.closest('[hidden]')),
    attr: (h, a) => hook(h).getAttribute(a),
    // Type into a text field and leave it (commit event).
    type: async (h, text) => { await hook(h).fill(text); await hook(h).evaluate((el) => el.blur()); await settled(page); },
    // Real input: radios and switches are tapped (clicked with a mouse) on their visible label, as a user does.
    tapEl: (loc) => (vp.touch ? loc.tap() : loc.click()),
    radio: (h, v) => k.tapEl(page.locator(`[data-pc="${h}"] label:has(> input[value="${v}"])`)),
    unit: (u) => k.tapEl(page.locator(`label:has(> [data-pc="unit-${u}"])`)),
    checked: (h) => page.locator(`[data-pc="${h}"] input:checked`).evaluate((el) => el.value),
    sw: async (h, on) => { if ((await hook(h).isChecked()) !== on) await k.tapEl(page.locator(`label:has(> [data-pc="${h}"])`)); },
    // Slider: the value under the thumb (input), and release (change).
    slide: (h, v) => hook(h).evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, v),
    release: async (h) => { await hook(h).evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true }))); await settled(page); },
    rows: () => page.evaluate(() => [...document.querySelectorAll('[data-pc="conflict-list"] > li')].map((li) => ({ kind: li.dataset.kind, code: li.dataset.code, text: li.querySelector('[data-pc="conflict-text"]').textContent }))),
    valid2: () => page.evaluate(() => PC.stages.status(PC.debug.state())[2].valid),
    site: () => page.evaluate(() => { const s = PC.debug.site(); return s && JSON.parse(JSON.stringify({ edge: s.edge, ptsL: s.ptsL, edgeClass: s.edgeClass, footprint: s.footprint })); }),
    S: (p) => page.evaluate(([u, v]) => PC.debug.toScreen('site', u, v), p),
    seedPlans: () => page.evaluate(() => PC.store.commit((s) => { PC.levels.ids(s).forEach((id) => { s.plans[id] = { sig: PC.sig.level(s, id), rooms: [], unmet: [], edited: true, approved: true, error: null }; }); }, { nav: true })),
    dialogOpen: async () => !(await k.hidden('dialog-layer')),
    still: async (label) => T.eq(await page.evaluate(() => ({ y: scrollY, x: scrollX, s: visualViewport ? visualViewport.scale : 1 })), { y: 0, x: 0, s: 1 }, `${tag} ${label}: page did not scroll or zoom`),
    end: async (label) => {
      for (const fn of ['noPageScroll', 'barInViewport', 'stepperOneLine', 'tapTargets']) T.none(await A[fn](page), `${tag} ${label}: ${fn}`);
      T.none(o.problems(), `${tag} ${label}: clean log`); await o.ctx.close();
    }
  };
  if (o2.plot) await page.evaluate((pts) => PC.store.commit((s) => { s.plot = { pts, closed: true }; s.ans.streetEdge = 0; Object.assign(s.ans, window.__ans || {}); }), o2.plot);
  else await o.act('btn-sample');
  if (o2.max5) await page.evaluate(() => { PC.stages.MAX_BUILT = 5; PC.ui.shell.render(); });
  await o.act('btn-next');
  return k;
}
const SQ = [[0, 0], [20, 0], [20, 20], [0, 20]];
const HEADINGS = { 1: 'Measurement unit', 2: 'Setbacks from each boundary', 3: 'Building footprint % of plot', 4: 'Vegetation % of plot', 5: 'North direction (for sun and shadows)',
  6: 'Street-facing side / main entrance edge', 7: 'Number of floors (plus basement and usable roof)', 8: 'Floor-to-ceiling height', 9: 'Roof type', 10: 'Exterior style / colour palette',
  15: 'Parking: number of cars, covered or open', 16: 'Pool and size', 17: 'Extras: garden seating, boundary wall, gate position' };

async function defaultsAndGroups(vp) {
  const k = await kit(vp, { plot: SQ }), { page, hook, act, tag } = k;
  // 1 defaults of 4.1 on a hand-made plot
  T.eq(await page.evaluate(() => document.querySelectorAll('[data-pc="banner-slot"] > *').length), 0, `${tag} no static-preview banner on stage 2`);
  T.eq([await k.checked('q-unit'), await k.val('q-setback-front'), await k.val('q-setback-back'), await k.val('q-setback-side')], ['m', '3.0', '2.0', '2.0'], `${tag} defaults: unit and setbacks`);
  T.eq([await k.val('q-footprint'), await k.text('q-footprint-out'), await k.val('q-veg'), await k.text('q-veg-out')], ['30', '30 %', '20', '20 %'], `${tag} defaults: footprint and vegetation`);
  T.eq([await k.text('q-north-value'), await k.text('q-street-value')], ['0°' + DOT + 'toward the back', 'Edge 1 of 4' + DOT + '20.0 m'], `${tag} defaults: north and street edge readouts`);
  T.eq([await k.checked('q-floors'), await hook('q-basement').isChecked(), await hook('q-usable-roof').isChecked(), await k.val('q-ceiling'), await k.text('q-ceiling-out'), await k.text('q-ceiling-unit')], ['2', false, false, '3', '3.0', 'm'], `${tag} defaults: building`);
  T.eq([await k.checked('q-roof'), await k.checked('q-exterior')], ['flat', 'sand'], `${tag} defaults: roof and exterior`);
  T.eq([await k.val('q-parking-cars'), await hook('q-parking-covered').isChecked(), await hook('q-pool').isChecked(), await k.checked('q-pool-size')], ['1', false, false, 'S'], `${tag} defaults: parking and pool`);
  T.ok(await page.locator('[data-pc="q-pool-size"] input').first().isDisabled(), `${tag} pool size is disabled while the pool is off`);
  T.eq([await hook('q-wall').isChecked(), await k.checked('q-gate'), await hook('q-seating').isChecked()], [true, 'centre', false], `${tag} defaults: extras`);
  T.eq(await k.text('q-pool-size-note'), 'S 3.0 × 6.0 m' + DOT + 'M 4.0 × 8.0 m' + DOT + 'L 5.0 × 10.0 m', `${tag} pool sizes from the constants`);
  T.eq(await page.evaluate(() => document.querySelectorAll('[data-stage="2"] [data-q="18"], [data-stage="2"] [data-q="19"]').length), 0, `${tag} Q18 and Q19 are not on this stage`);
  const heads = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-stage="2"] [data-q]')].map((q) => [q.dataset.q, q.querySelector('h4').textContent.trim()])));
  for (const [q, text] of Object.entries(HEADINGS)) T.eq(heads[q], text, `${tag} Q${q} text matches the brief`);
  // 3 numeric keypad
  for (const h of ['q-setback-front', 'q-setback-back', 'q-setback-side', 'q-parking-cars']) T.eq(await k.attr(h, 'inputmode'), 'decimal', `${tag} ${h} opens a numeric keypad`);
  // 2 groups, tabs, Continue, progress
  const group = () => page.evaluate(() => ['site', 'building', 'rooms', 'outdoor'].map((g) => (document.querySelector(`[data-pc="q-group-${g}"]`).hidden ? '-' : 'X') + (document.querySelector(`[data-pc="q-tab-${g}"]`).getAttribute('aria-selected') === 'true' ? 's' : '-')).join(' '));
  T.eq([await group(), await k.text('q-progress-text'), await k.val('q-progress-bar').catch(() => hook('q-progress-bar').evaluate((e) => String(e.value)))], ['Xs -- -- --', 'Group 1 of 4' + DOT + '17 questions left', '0'], `${tag} group 1 at the start`);
  await act('btn-q-continue-site');
  T.eq([await group(), await k.text('q-progress-text')], ['-- Xs -- --', 'Group 2 of 4' + DOT + '11 questions left'], `${tag} Continue opens Building`);
  await act('btn-q-continue-building');
  T.eq([await group(), await k.text('q-progress-text')], ['-- -- Xs --', 'Group 3 of 4' + DOT + '7 questions left'], `${tag} Continue opens Rooms`);
  // the Rooms group works since F2-T3 (rooms.spec.mjs covers it): Add room adds one M bedroom on the ground floor
  const before = await k.state();
  await act('btn-room-add'); await settled(page);
  T.eq((await k.state()).ans.rooms.length, before.ans.rooms.length + 1, `${tag} Rooms group: Add room adds a room`);
  await act('btn-pair-add');
  T.eq(await k.text('pair-msg'), 'Pick two rooms of the same floor.', `${tag} Rooms group: Add pair without rooms picked explains`);
  await act('btn-q-continue-rooms');
  T.eq([await group(), await k.text('q-progress-text'), await hook('q-progress-bar').evaluate((e) => e.value)], ['-- -- -- Xs', 'Group 4 of 4' + DOT + '3 questions left', 14], `${tag} Continue opens Outdoor`);
  await act('q-tab-site');
  T.eq([await group(), await k.text('q-progress-text')], ['Xs -- -- --', 'Group 1 of 4' + DOT + '6 questions left'], `${tag} tabs work; visited groups no longer count`);
  // sample values (6.2)
  await act('btn-back'); await page.evaluate(() => { document.querySelector('[data-pc="start-panel"]').hidden = false; });
  await act('btn-sample'); await act('dialog-ok'); await act('btn-next');
  T.eq([await k.val('q-footprint'), await k.val('q-veg'), await k.text('q-street-value')], ['25', '25', 'Edge 1 of 5' + DOT + '20.0 m'], `${tag} sample: site answers`);
  T.eq(await k.text('q-progress-text'), 'Group 1 of 4' + DOT + '17 questions left', `${tag} a new project starts the progress again`);
  await act('q-tab-outdoor');
  T.eq([await k.val('q-parking-cars'), await hook('q-parking-covered').isChecked(), await hook('q-pool').isChecked(), await k.checked('q-pool-size'), await hook('q-seating').isChecked()], ['2', true, true, 'S', true], `${tag} sample: outdoor answers`);
  T.ok(await page.locator('[data-pc="q-pool-size"] input').first().isEnabled(), `${tag} pool size enabled while the pool is on`);
  T.eq([await k.text('sum-status'), (await k.rows()).length, await k.attr('summary', 'data-kind')], ['All clear', 0, 'ok'], `${tag} sample: all clear, no rows`);
  T.eq([await k.text('sum-plot'), await k.text('sum-footprint'), await k.text('sum-veg')], ['584 m' + M2, '143 m' + M2 + DOT + '24.4 %', '146 m' + M2 + DOT + '25 %'], `${tag} sample: summary numbers`);
  T.eq(await page.evaluate(() => [...document.querySelectorAll('[data-pc="sum-levels"] > *')].map((r) => r.textContent.trim().replace(/\s+/g, ' '))), ['Ground floor 120 m' + M2 + ' / 143 m' + M2, 'First floor 120 m' + M2 + ' / 143 m' + M2], `${tag} sample: needed / available per level`);
  await k.end('defaults and groups');
}

async function fieldsAndUnits(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k;
  // 4 setbacks: typing, steppers, units
  const fp0 = (await k.site()).footprint;
  await k.type('q-setback-front', '4');
  T.eq((await k.state()).ans.setbacks.front, 4, `${tag} typed setback is stored`);
  T.eq(await k.val('q-setback-front'), '4.0', `${tag} ...and shown with one decimal`);
  T.ok((await k.site()).footprint.v !== fp0.v, `${tag} the footprint follows the setback`);
  await act('q-setback-front-inc'); T.eq((await k.state()).ans.setbacks.front, 4.5, `${tag} + adds 0.5 m`);
  await act('q-setback-front-dec'); await act('q-setback-front-dec'); T.eq((await k.state()).ans.setbacks.front, 3.5, `${tag} - takes 0.5 m`);
  T.ok((await k.state()).sampleClean === false, `${tag} an answer ends the unmodified sample`);
  await k.radio('q-unit', 'ft');
  let s = await k.state();
  T.eq([s.ans.unit, s.ans.setbacks.front, await k.val('q-setback-front'), await k.text('q-setback-front-unit'), await hook('unit-ft').isChecked()], ['ft', 3.5, '11.5', 'ft', true], `${tag} unit switch converts the display and stores nothing`);
  T.eq(await k.text('q-pool-size-note'), 'S 9.8 × 19.7 ft' + DOT + 'M 13.1 × 26.2 ft' + DOT + 'L 16.4 × 32.8 ft', `${tag} pool sizes in feet`);
  T.eq([await k.text('sum-plot'), await k.text('q-street-value')], ['6286 sq ft', 'Edge 1 of 5' + DOT + '65.6 ft'], `${tag} summary and readouts in feet`);
  await k.type('q-setback-front', '10');
  T.eq([(await k.state()).ans.setbacks.front, await k.val('q-setback-front')], [3.048, '10.0'], `${tag} 10 ft is stored as 3.048 m`);
  await hook('q-setback-front').focus(); await hook('q-setback-front').evaluate((el) => { el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); });
  T.eq((await k.state()).ans.setbacks.front, 3.048, `${tag} leaving an untouched field rewrites nothing`);
  await act('q-setback-front-inc');
  T.ok(Math.abs((await k.state()).ans.setbacks.front - 11 * 0.3048) < 1e-9, `${tag} + adds 1 ft in ft mode`);
  await k.type('q-setback-front', '10'); await k.radio('q-unit', 'm');
  T.eq([await k.val('q-setback-front'), (await k.state()).ans.setbacks.front], ['3.0', 3.048], `${tag} back in metres: shown rounded, stored exactly`);
  await hook('q-setback-front').focus(); await hook('q-setback-front').evaluate((el) => { el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); });
  T.eq((await k.state()).ans.setbacks.front, 3.048, `${tag} ...and still not rewritten by a blur`);
  // 5 invalid entries stay in the field and block
  for (const bad of ['', 'abc', '-1', '25', '3,5,1']) {
    const before = await k.state();
    await k.type('q-setback-back', bad);
    T.eq(await k.state(), before, `${tag} "${bad}" is never committed`);
    T.eq([await k.attr('q-setback-back', 'aria-invalid'), await k.hidden('q-setback-back-err'), await k.text('q-setback-back-err'), await k.val('q-setback-back')], ['true', false, 'Enter a number from 0.0 m to 20.0 m.', bad], `${tag} "${bad}": marked, explained, text kept`);
    T.eq((await k.rows()).filter((r) => r.code === 'field-invalid'), [{ kind: 'block', code: 'field-invalid', text: 'Back setback: enter a number from 0.0 m to 20.0 m.' }], `${tag} "${bad}": conflict row`);
    T.ok(!(await k.valid2()) && await hook('btn-next').isDisabled(), `${tag} "${bad}": stage 2 is not valid`);
  }
  T.eq([await k.text('sum-status'), await k.attr('summary', 'data-kind')], ['1 to fix', 'block'], `${tag} status counts the invalid field`);
  await k.radio('q-unit', 'ft');
  T.eq([await k.val('q-setback-back'), await k.text('q-setback-back-err')], ['3,5,1', 'Enter a number from 0.0 ft to 65.6 ft.'], `${tag} invalid text survives a re-render; limits follow the unit`);
  await k.radio('q-unit', 'm');
  await k.type('q-setback-back', '2,5');
  T.eq([(await k.state()).ans.setbacks.back, await k.attr('q-setback-back', 'aria-invalid'), await k.hidden('q-setback-back-err'), (await k.rows()).length, await k.valid2()], [2.5, null, true, 0, true], `${tag} a valid entry (decimal comma) clears everything without reload`);
  await act('q-tab-outdoor');
  for (const bad of ['1.5', '5', 'x']) {
    await k.type('q-parking-cars', bad);
    T.eq([(await k.state()).ans.parking.cars, await k.text('q-parking-cars-err'), await k.attr('q-parking-cars', 'aria-invalid')], [2, 'Enter a number from 0 to 4.', 'true'], `${tag} cars "${bad}" is invalid (whole numbers 0-4, no unit in the limits)`);
  }
  T.eq((await k.rows()).map((r) => r.text), ['Number of cars: enter a number from 0 to 4.'], `${tag} cars conflict row`);
  await act('q-parking-cars-inc');
  T.eq([(await k.state()).ans.parking.cars, await k.val('q-parking-cars'), await k.valid2()], [3, '3', true], `${tag} the stepper recovers from an invalid entry`);
  await k.type('q-parking-cars', '0'); T.eq((await k.state()).ans.parking.cars, 0, `${tag} 0 cars is valid`);
  await act('q-parking-cars-dec'); T.eq((await k.state()).ans.parking.cars, 0, `${tag} the stepper stops at the limit`);
  // 6 sliders: live while dragging, stored on release
  await act('q-tab-site');
  const sumBefore = await k.text('sum-footprint'), fpBefore = (await k.state()).ans.footprintPct;
  await k.slide('q-footprint', 40); await settled(page);
  T.eq([await k.text('q-footprint-out'), (await k.state()).ans.footprintPct], ['40 %', fpBefore], `${tag} slider: label follows, nothing stored while dragging`);
  T.ok((await k.text('sum-footprint')) !== sumBefore, `${tag} slider: summary follows live (${await k.text('sum-footprint')})`);
  await k.release('q-footprint');
  T.eq((await k.state()).ans.footprintPct, 40, `${tag} slider: stored on release`);
  // condition 1: one analysis per frame; a slow one stops live updates for the rest of the drag
  await page.evaluate(() => { window.__seen = []; const a = PC.site.analyse; window.__slow = 0; PC.site.analyse = function (s) { if (!Object.isFrozen(s)) { window.__seen.push(s.ans.vegPct); const t = performance.now(); while (performance.now() - t < window.__slow) { /* burn */ } } return a(s); }; });
  await hook('q-veg').evaluate((el) => { for (const v of [26, 27, 28, 29, 30]) { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); } });   // five moves before the next frame
  await settled(page);
  T.eq(await page.evaluate(() => [...new Set(window.__seen)]), [30], `${tag} five moves inside one frame cost one analysis (the last value)`);
  await page.evaluate(() => { window.__seen = []; window.__slow = 70; });
  await k.slide('q-veg', 31); await settled(page);
  const n1 = await page.evaluate(() => { const n = window.__seen.length; window.__slow = 0; return n; });
  const vegLive = await k.text('sum-veg');
  await k.slide('q-veg', 40); await settled(page); await k.slide('q-veg', 45); await settled(page);
  T.eq([await page.evaluate(() => window.__seen.length), await k.text('q-veg-out'), await k.text('sum-veg')], [n1, '45 %', vegLive], `${tag} after a slow analysis (> 50 ms) the drag only moves the label`);
  await k.release('q-veg');
  T.ok((await k.state()).ans.vegPct === 45 && (await k.text('sum-veg')).endsWith('45 %'), `${tag} ...and everything catches up on release`);
  await k.slide('q-veg', 20); await settled(page);
  T.ok((await k.text('sum-veg')).endsWith('20 %'), `${tag} the next drag is live again`);
  await k.release('q-veg');
  // ceiling slider in both units
  await act('q-tab-building');
  T.eq([await k.attr('q-ceiling', 'min'), await k.attr('q-ceiling', 'max'), await k.attr('q-ceiling', 'step')], ['2.4', '4.5', '0.1'], `${tag} ceiling slider in metres`);
  await k.unit('ft');
  T.eq([await k.attr('q-ceiling', 'min'), await k.attr('q-ceiling', 'max'), await k.attr('q-ceiling', 'step'), await k.text('q-ceiling-out'), await k.text('q-ceiling-unit'), (await k.state()).ans.ceilingH], ['8', '14.5', '0.5', '9.8', 'ft', 3], `${tag} ceiling slider in feet: 8.0-14.5 step 0.5; nothing stored by the switch`);
  await k.slide('q-ceiling', 10); await k.release('q-ceiling');
  T.eq([(await k.state()).ans.ceilingH, await k.text('q-ceiling-out')], [3.048, '10.0'], `${tag} 10 ft ceiling stored as 3.048 m`);
  await k.slide('q-ceiling', 14.5); await k.release('q-ceiling');
  T.ok((await k.state()).ans.ceilingH <= 4.5 && (await page.evaluate(() => PC.draft.validState(PC.debug.state()))), `${tag} top of the ft range stays inside 4.5 m`);
  await k.unit('m');
  // 9 usable roof and Pitched
  await k.radio('q-roof', 'pitched');
  T.eq((await k.state()).ans.roofType, 'pitched', `${tag} roof type stored`);
  await k.sw('q-usable-roof', true);
  s = await k.state();
  T.eq([s.ans.usableRoof, s.ans.roofType, await k.hidden('q-roof-note'), await page.locator('[data-pc="q-roof"] input[value="pitched"]').isDisabled(), await k.checked('q-roof')], [true, 'flat', false, true, 'flat'], `${tag} usable roof: Pitched -> Flat, note shown, Pitched disabled`);
  await k.radio('q-roof', 'terrace');
  T.eq([(await k.state()).ans.roofType, await k.hidden('q-roof-note')], ['terrace', true], `${tag} the note goes once a roof is chosen`);
  await k.sw('q-usable-roof', false);
  T.ok(await page.locator('[data-pc="q-roof"] input[value="pitched"]').isEnabled(), `${tag} Pitched is available again without a usable roof`);
  await k.radio('q-exterior', 'grey'); await k.sw('q-basement', false);
  T.eq((await k.state()).ans.exterior, 'grey', `${tag} exterior stored`);
  // 14 persistence: groups, stages, reload
  await act('q-tab-outdoor'); await k.sw('q-pool', false); await k.radio('q-gate', 'left'); await k.sw('q-wall', false); await k.sw('q-parking-covered', false);
  const saved = await k.state();
  await act('btn-back'); await act('btn-next');
  T.eq(await k.state(), saved, `${tag} stage 1 and back: answers kept`);
  await page.waitForFunction((want) => { const d = JSON.parse(localStorage.getItem(PC.draft.KEY) || 'null'); return !!d && JSON.stringify(d.state) === want; }, JSON.stringify(saved), { timeout: 4000 });
  await page.reload(); await act('btn-resume');
  T.eq({ ...(await k.state()), plans: {} }, { ...saved, plans: {} }, `${tag} reload + Resume: answers kept (Resume also lays out the levels)`);
  await act('q-tab-outdoor');
  T.eq([await hook('q-pool').isChecked(), await k.checked('q-gate'), await hook('q-wall').isChecked(), await k.val('q-parking-cars')], [false, 'left', false, '0'], `${tag} controls show the resumed answers`);
  await act('q-tab-building');
  T.eq([await k.checked('q-roof'), await k.checked('q-exterior'), await k.text('q-ceiling-out')], ['terrace', 'grey', '4.4'], `${tag} ...in every group`);
  await k.still('fields');
  await k.end('fields and units');
}

async function previewAndConflicts(vp) {
  const k = await kit(vp, { max5: true }), { page, hook, act, tag } = k;
  const view = () => page.evaluate(() => PC.debug.view('site'));
  const mid = async (i) => { const s = await k.site(), a = s.ptsL[i], b = s.ptsL[(i + 1) % s.ptsL.length]; return k.S([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); };
  const fitted = async () => { const s = await k.site(), r = await hook('site-canvas').boundingBox(); let ok = true; for (const p of s.ptsL) { const q = await k.S(p); ok = ok && q[0] >= r.x + 4 && q[0] <= r.x + r.width - 4 && q[1] >= r.y + 4 && q[1] <= r.y + r.height - 4; } return ok; };
  // 15 preview: fitted, labelled, locked
  T.ok(await fitted(), `${tag} preview: the whole plot is on the canvas`);
  let L = (await page.evaluate(() => PC.debug.siteLabels())).map((l) => l.text);
  T.ok(L.includes('front') && L.includes('side') && L.includes('143 m' + M2), `${tag} preview: edge classes and footprint area labelled (${L})`);
  const v0 = await view(), box = await hook('site-canvas').boundingBox(), c = [box.x + box.width / 2, box.y + box.height / 2];
  await k.G.drag(c, [c[0] + 40, c[1] + 20]);
  if (vp.touch) await k.G.two([c[0] - 20, c[1]], [c[0] + 20, c[1]], [c[0] - 60, c[1]], [c[0] + 60, c[1]]);
  else {
    await page.evaluate(() => { window.__wheel = null; window.addEventListener('wheel', (e) => { window.__wheel = e.defaultPrevented; }, { once: true }); });
    await page.mouse.move(c[0], c[1]); await page.mouse.wheel(0, 200); await settled(page);
    T.eq(await page.evaluate(() => window.__wheel), false, `${tag} preview: the mouse wheel is left to the page`);
  }
  T.eq(await view(), v0, `${tag} preview: no pan or zoom`);
  const before = await k.state();
  // 7 Q6: tap an edge
  const fpc = await (async () => { const f = (await k.site()).footprint; return k.S([f.u + f.w / 2, f.v + f.d / 2]); })();
  await k.G.tap(fpc);
  T.eq((await k.state()).ans.streetEdge, 0, `${tag} a tap away from every edge (on the footprint) changes nothing`);
  for (const i of [1, 2, 4, 0]) {
    await k.G.tap(await mid(i));
    const s = await k.site();
    T.eq([(await k.state()).ans.streetEdge, s.edge, s.edgeClass[i]], [i, i, 'front'], `${tag} tap on edge ${i + 1} makes it the street edge`);
    T.ok(await fitted(), `${tag} ...and the preview is fitted again`);
    T.ok((await k.text('q-street-value')).startsWith('Edge ' + (i + 1) + ' of 5'), `${tag} ...readout follows`);
  }
  await act('q-street-next'); T.eq((await k.state()).ans.streetEdge, 1, `${tag} next edge button`);
  await act('q-street-prev'); await act('q-street-prev'); T.eq((await k.state()).ans.streetEdge, 4, `${tag} previous edge wraps`);
  await act('q-street-next');
  // 8 Q5: steps and compass
  await act('q-north-cw'); T.eq([(await k.state()).ans.north, await k.text('q-north-value')], [15, '15° clockwise from the back'], `${tag} north: one step clockwise`);
  await act('q-north-ccw'); await act('q-north-ccw'); T.eq((await k.state()).ans.north, 345, `${tag} north: anticlockwise wraps`);
  await act('q-north-reset'); T.eq([(await k.state()).ans.north, await k.text('q-north-value')], [null, '0°' + DOT + 'toward the back'], `${tag} north: reset to the default`);
  const d = await page.evaluate(() => PC.debug.siteDial());
  let live = null;
  await k.G.drag([d.x, d.y - 8], [d.x + 60, d.y + 2], async () => { live = { north: (await k.state()).ans.north }; });
  const n = (await k.state()).ans.north;
  T.eq(live.north, null, `${tag} compass: nothing stored while dragging`);
  T.ok(n === 90 || n === 75 || n === 105, `${tag} compass: dragged to the east, stored on release (${n})`);
  T.eq(n % 15, 0, `${tag} compass: 15 degree steps`);
  T.eq(await view(), await view(), `${tag} compass drag does not move the view`);
  await act('q-north-reset');
  T.eq((await k.state()).ans, before.ans, `${tag} back to the sample answers`);
  // 10 conflicts and warnings
  await act('q-tab-building'); await k.radio('q-floors', '3');
  let rows = await k.rows();
  T.eq(rows, [{ kind: 'block', code: 'floor-empty', text: 'Second floor has no rooms: add a room there or reduce the number of floors.' }], `${tag} third floor without rooms blocks`);
  T.eq([await k.text('sum-status'), await k.attr('summary', 'data-kind'), await k.valid2(), await hook('btn-next').isDisabled()], ['1 to fix', 'block', false, true], `${tag} ...status, Next disabled`);
  await k.radio('q-floors', '2');
  T.eq([(await k.rows()).length, await k.text('sum-status'), await hook('btn-next').isEnabled()], [0, 'All clear', true], `${tag} ...and clears without reload; Next enabled`);
  await act('q-tab-site');
  await k.slide('q-footprint', 60); await k.release('q-footprint'); await k.slide('q-veg', 45); await k.release('q-veg');
  T.ok((await k.rows()).some((r) => r.code === 'fp-veg-over' && r.text === 'Footprint 60 % + vegetation 45 % is more than 100 %: lower one of them.'), `${tag} footprint % + vegetation % over 100 blocks`);
  // 11 Fix: collapses the sheet, opens the group, shows and focuses the question
  await act('q-tab-outdoor'); await act('summary-toggle');
  T.eq(await k.attr('summary-toggle', 'aria-expanded'), 'true', `${tag} summary sheet opens`);
  await page.locator('[data-pc="conflict-list"] li[data-code="fp-veg-over"] [data-pc="conflict-goto"]').click();
  await settled(page);
  const fix = await page.evaluate(() => { const b = document.querySelector('[data-stage="2"] [data-q="3"]'), r = b.getBoundingClientRect(), bar = document.querySelector('[data-pc="btn-next"]').getBoundingClientRect();
    return { collapsed: document.querySelector('[data-pc="summary"]').classList.contains('is-collapsed'), expanded: document.querySelector('[data-pc="summary-toggle"]').getAttribute('aria-expanded'), group: !document.querySelector('[data-pc="q-group-site"]').hidden, inView: r.top >= 0 && r.top < bar.top - 40, focus: b.contains(document.activeElement) }; });
  T.eq(fix, { collapsed: true, expanded: 'false', group: true, inView: true, focus: true }, `${tag} Fix: sheet closed, group opened, question in view and focused`);
  await k.slide('q-footprint', 25); await k.release('q-footprint'); await k.slide('q-veg', 25); await k.release('q-veg');
  await k.type('q-setback-front', '14'); await k.type('q-setback-back', '13'); await k.type('q-setback-side', '9');
  rows = await k.rows();
  T.ok(rows.some((r) => r.code === 'buildable-small' && /^Buildable area is \d+ m. \(minimum 20 m.\): reduce the setbacks or redraw the plot\.$/.test(r.text)), `${tag} buildable area under 20 m2 blocks (${rows.map((r) => r.code)})`);
  await k.type('q-setback-front', '3'); await k.type('q-setback-back', '2'); await k.type('q-setback-side', '2');
  T.eq((await k.state()).ans, before.ans, `${tag} every conflict cleared, sample answers again`);
  // rows always equal PC.validate, for a plot that does not fit and for the four warnings
  const same = async (label, codes) => {
    const want = await page.evaluate(() => { const v = PC.validate(PC.debug.state()); return v.blocking.map((c) => ({ kind: 'block', code: c.code, text: c.text })).concat(v.warnings.map((c) => ({ kind: 'warn', code: c.code, text: c.text }))); });
    const got = await k.rows();
    T.eq(got, want, `${tag} ${label}: rows equal PC.validate`);
    T.eq(got.map((r) => r.code), codes, `${tag} ${label}: ${codes.join(', ')}`);
  };
  await page.evaluate(() => PC.store.commit((s) => { s.plot.pts = [[0, 0], [2, 0], [2, 40], [0, 40]]; s.ans.streetEdge = 0; s.ans.setbacks = { front: 0, back: 0, side: 0 }; s.ans.pool.on = false; s.ans.parking.cars = 0; }));
  await same('thin plot', ['no-fit']);
  await page.evaluate(() => PC.store.commit((s) => { s.plot.pts = [[0, 0], [9, 0], [9, 40], [0, 40]]; s.ans.setbacks = { front: 3, back: 2, side: 2 }; s.ans.parking.cars = 4; s.ans.rooms = s.ans.rooms.filter((r) => ['r5', 'r6', 'r13'].includes(r.id)); s.ans.pairs = []; }));
  await same('narrow plot', ['fp-clamped', 'parking-omitted']);
  T.eq([await k.text('sum-status'), await k.attr('summary', 'data-kind'), await k.valid2(), await hook('btn-next').isEnabled()], ['2 warnings', 'warn', true, true], `${tag} warnings do not block`);
  // 9 x 40 m at 25 %: 5 m wide inside the setbacks; step 4b's 1:3 try gives 5 x 16 m, capped at 3 x 5 + 0.5 = 15.5 m (A-6 step 8) and the proportion wording applies (F2-S3 round 4)
  T.ok(/^The building is limited to 5\.0 × 15\.5 m \(\d+ m², \d+(\.\d)? % of the plot\): on this narrow plot it may be at most 3 times/.test((await k.rows())[0].text), `${tag} clamped footprint shows its dimensions, effective area and % (${(await k.rows())[0].text})`);
  await page.evaluate(() => PC.store.commit((s) => { s.plot.pts = [[0, 0], [20, 0], [20, 20], [0, 20]]; s.ans.parking.cars = 1; s.ans.pool = { on: true, size: 'L' }; s.ans.vegPct = 80; s.ans.footprintPct = 20; }));
  await same('square plot', ['veg-reduced', 'pool-omitted']);
  await page.setViewportSize({ width: vp.w + (vp.w > 700 ? -120 : 60), height: vp.h });
  await page.waitForFunction(() => { const s = PC.debug.site(), r = document.querySelector('[data-pc="site-canvas"]').getBoundingClientRect(); return s.ptsL.every((p) => { const q = PC.debug.toScreen('site', p[0], p[1]); return q[0] >= r.left + 4 && q[0] <= r.right - 4 && q[1] >= r.top + 4 && q[1] <= r.bottom - 4; }); }, null, { timeout: 3000 });
  T.ok(true, `${tag} preview is fitted again after a resize`);
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await k.still('preview');
  await k.end('preview and conflicts');
}

async function gateAndRiders(vp) {
  let k = await kit(vp), { page, hook, act, tag } = k;
  // 13 riders: the unit change keeps the sample unmodified
  await k.radio('q-unit', 'ft');
  T.eq([(await k.state()).sampleClean, (await k.state()).ans.unit], [true, 'ft'], `${tag} Q1 radio keeps the sample unmodified`);
  await k.unit('m');
  await act('btn-back');
  T.ok((await k.state()).sampleClean && !(await k.hidden('btn-skip3d')), `${tag} Skip to 3D is still offered after unit changes`);
  T.eq(await k.text('plot-grid'), 'Snap 0.5 m', `${tag} plot readout states the snap step only`);
  await k.unit('ft');
  T.eq([await k.text('plot-grid'), (await k.state()).sampleClean], ['Snap 1 ft', true], `${tag} ...in feet too`);
  await k.unit('m'); await act('btn-next');
  // 12 R5 with valid plans (seeded with real signatures; none exist in the product before F3-T1)
  await k.seedPlans();
  const s0 = await k.state();
  await act('q-tab-building'); await k.radio('q-exterior', 'white'); await act('q-tab-site');
  T.ok(!(await k.dialogOpen()) && (await k.state()).ans.exterior === 'white', `${tag} an appearance answer (Q10) never asks`);
  await k.type('q-setback-back', '2.25');
  T.ok(!(await k.dialogOpen()) && (await k.state()).ans.setbacks.back === 2.25, `${tag} a setback change that only moves the footprint does not ask`);
  T.eq((await k.state()).plans, s0.plans, `${tag} ...and leaves the plans alone`);
  const s1 = await k.state();
  await k.type('q-setback-back', '3');
  T.ok(await k.dialogOpen(), `${tag} a setback change that alters the footprint size asks`);
  T.eq([await k.text('dialog-title'), await k.text('dialog-text'), await k.text('dialog-ok'), await k.text('dialog-cancel')], ['Regenerate floor plans?', 'The floor plans of the Ground floor and the First floor will be regenerated, with their manual edits and approvals.', 'Continue', 'Cancel'], `${tag} R5 dialog wording`);
  await act('dialog-cancel'); await settled(page);
  T.eq([await k.state(), await k.val('q-setback-back')], [s1, '2.3'], `${tag} Cancel: state identical, field shows the old value`);
  await k.slide('q-footprint', 40); await k.release('q-footprint');
  T.ok(await k.dialogOpen(), `${tag} it asks again after a Cancel (slider)`);
  await act('dialog-cancel'); await settled(page);
  T.eq([await k.state(), await k.val('q-footprint'), await k.text('q-footprint-out'), await k.text('sum-footprint')], [s1, '25', '25 %', '143 m' + M2 + DOT + '24.4 %'], `${tag} Cancel on a slider: thumb, label and summary back`);
  await k.type('q-setback-back', '3'); await act('dialog-ok'); await settled(page);
  T.eq((await k.state()).ans.setbacks.back, 3, `${tag} Continue applies the change`);
  await k.slide('q-footprint', 30); await k.release('q-footprint');
  T.ok(!(await k.dialogOpen()) && (await k.state()).ans.footprintPct === 30, `${tag} further layout changes in the same visit apply without asking`);
  await k.end('gate');
  // edge tap and Q7 with plans, in a fresh session
  k = await kit(vp); ({ page, hook, act, tag } = k);
  await k.seedPlans();
  const site = await k.site(), a = site.ptsL[1], b = site.ptsL[2];
  await k.G.tap(await k.S([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]));
  T.ok(await k.dialogOpen(), `${tag} Q6 by edge tap asks`);
  await act('dialog-cancel'); await settled(page);
  T.eq((await k.state()).ans.streetEdge, 0, `${tag} ...Cancel keeps the street edge`);
  // Q7 lowered with rooms on the removed level: its own confirmation, no second question
  await act('q-tab-building');
  const before = await k.state();
  await k.radio('q-floors', '1');
  // three-way dialog (F2-T3): the ground floor already has 7 rooms, so moving 7 more is not possible; delete is preselected
  T.eq([await k.text('dialog-title'), await k.text('level-remove-text'), await k.text('dialog-text'), await k.text('dialog-ok'), await hook('level-remove-move').isDisabled(), await hook('level-remove-delete').isChecked()],
    ['Remove First floor?', 'The First floor has 7 rooms. They cannot be moved: the Ground floor would have more than 10 rooms. Delete them?', 'The floor plans of the Ground floor and the First floor will be regenerated or lost, with their manual edits and approvals.', 'Remove', true, true], `${tag} removing a floor with rooms asks with its own dialog`);
  await act('dialog-cancel'); await settled(page);
  T.eq([await k.state(), await k.checked('q-floors')], [before, '2'], `${tag} Cancel keeps the floor`);
  await k.radio('q-floors', '1'); await act('dialog-ok'); await settled(page);
  const s = await k.state();
  T.ok(!(await k.dialogOpen()), `${tag} one dialog, never two`);
  T.eq([s.ans.floors, s.ans.rooms.length, s.ans.pairs, Object.keys(s.plans)], [1, 7, [['r3', 'r4']], ['G']], `${tag} Delete: floor, its rooms, their pairs and its plan are gone`);
  T.ok(await page.evaluate(() => PC.draft.validState(PC.debug.state())), `${tag} the state is still a valid draft`);
  await k.radio('q-floors', '3'); await settled(page);
  T.ok((await k.state()).ans.floors === 3 || await k.dialogOpen(), `${tag} adding floors needs no room dialog`);
  if (await k.dialogOpen()) { await act('dialog-ok'); await settled(page); }
  await k.radio('q-floors', '1'); await settled(page);
  if (await k.dialogOpen()) { await act('dialog-ok'); await settled(page); }
  T.eq([(await k.state()).ans.floors, await page.evaluate(() => PC.draft.validState(PC.debug.state()))], [1, true], `${tag} removing empty floors: no room question, valid state`);
  await k.end('gate 2');
}

// Round 2 (impl-review required change 1): a slider dragged away and back to its start value with a real pointer
// gets no `change`; the gesture must still end, so the control follows the state again.
async function sliderGestureEnd(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k;
  // Thumb centre for a value (thumb 16 px wide, 30-components.css).
  const at = async (h, v) => {
    await hook(h).scrollIntoViewIfNeeded();
    const b = await hook(h).boundingBox(), a = await hook(h).evaluate((el) => [+el.min, +el.max]);
    return [b.x + 8 + (b.width - 16) * (v - a[0]) / (a[1] - a[0]), b.y + b.height / 2];
  };
  const count = (h) => hook(h).evaluate((el) => { const first = !el.__n; el.__n = { input: 0, change: 0 }; if (first) { el.addEventListener('input', () => el.__n.input++); el.addEventListener('change', () => el.__n.change++); } });
  const counted = (h) => hook(h).evaluate((el) => el.__n);
  const awayAndBack = async (h, from, to) => { const a = await at(h, from), b = await at(h, to); await k.G.path([a, b, a]); await settled(page); };
  const sumFor = () => page.evaluate(() => { const s = PC.validate(PC.debug.state()).summary; return Math.round(s.footprintArea) + ' m² · ' + Math.round(s.footprintPct * 10) / 10 + ' %'; });
  // Q3
  await count('q-footprint');
  await awayAndBack('q-footprint', 25, 40);
  let n = await counted('q-footprint');
  T.ok(n.input >= 2 && n.change === 0, `${tag} Q3 drag away and back: inputs ${n.input}, no change event (the case under test)`);
  T.eq([await k.val('q-footprint'), (await k.state()).ans.footprintPct, await k.text('q-footprint-out')], ['25', 25, '25 %'], `${tag} Q3 back on its start value, nothing stored`);
  await page.evaluate(() => PC.store.commit((s) => { s.ans.footprintPct = 40; }));
  await settled(page);
  T.eq([await k.val('q-footprint'), await k.text('q-footprint-out')], ['40', '40 %'], `${tag} Q3 after the gesture: an outside commit (40 %) is shown by slider and label`);
  T.eq(await k.text('sum-footprint'), await sumFor(), `${tag} Q3 after the gesture: the summary shows the stored state, no pending value`);
  const fp40 = await page.evaluate(() => PC.debug.site().footprint.area);
  T.ok(Math.abs(fp40 - (await page.evaluate(() => PC.site.analyse(PC.debug.state()).footprint.area))) < 1e-9 && (await k.text('sum-footprint')).startsWith(Math.round(fp40) + ' m'), `${tag} Q3 summary footprint equals the 40 % footprint`);
  // Q8
  await act('q-tab-building');
  await count('q-ceiling');
  await awayAndBack('q-ceiling', 3.0, 3.8);
  n = await counted('q-ceiling');
  T.ok(n.input >= 2 && n.change === 0, `${tag} Q8 drag away and back: inputs ${n.input}, no change event`);
  T.eq([await k.val('q-ceiling'), (await k.state()).ans.ceilingH], ['3', 3], `${tag} Q8 back on 3.0 m, nothing stored`);
  await k.unit('ft'); await settled(page);
  T.eq([await k.attr('q-ceiling', 'min'), await k.attr('q-ceiling', 'max'), await k.attr('q-ceiling', 'step'), await k.val('q-ceiling'), await k.text('q-ceiling-unit')], ['8', '14.5', '0.5', '10', 'ft'], `${tag} Q8 after the gesture, in ft: 8-14.5 step 0.5, thumb on 10.0 ft`);
  await hook('q-ceiling').focus(); await page.keyboard.press('ArrowRight'); await settled(page);
  const c = (await k.state()).ans.ceilingH;
  T.ok(Math.abs(c - 10.5 * 0.3048) < 1e-4, `${tag} Q8 one ArrowRight from 3.0 m stores 10.5 ft = 3.2004 m (got ${c})`);
  T.eq(await k.text('q-ceiling-out'), '10.5', `${tag} Q8 label 10.5 ft`);
  await k.unit('m'); await settled(page);
  // a drag that does end on a new value still commits once (no double commit, nothing lost)
  await act('q-tab-site');
  await count('q-footprint');
  { const a = await at('q-footprint', 40), b = await at('q-footprint', 30); await k.G.path([a, b]); await settled(page); }
  n = await counted('q-footprint');
  T.ok(n.change === 1 && (await k.state()).ans.footprintPct === 30 && (await k.val('q-footprint')) === '30', `${tag} a drag ending on a new value commits it (change ${n.change}, ${(await k.state()).ans.footprintPct} %)`);
  T.eq(await k.text('sum-footprint'), await sumFor(), `${tag} ...summary follows`);
  await k.end('slider gesture end');
}

// Round 2 (required changes 2-4): R5 dialog names every lost plan; Q5 whole degrees; "front" always labelled; phone scale.
async function round2(vp) {
  let k = await kit(vp), { page, hook, act, tag } = k;
  const affected = (f) => page.evaluate((src) => { const c = JSON.parse(JSON.stringify(PC.debug.state())); (0, eval)('(' + src + ')')(c); return PC.store.affected(c); }, f.toString());
  // basement off on a two-floor house: only the Basement plan
  await page.evaluate(() => PC.store.commit((s) => { s.ans.basement = true; s.ans.rooms.push(PC.store.room('r' + s.ans.nextRoomId++, 'storage', 'B', 'M')); }));
  await k.seedPlans();
  await act('q-tab-building');
  T.eq(await affected((s) => { s.ans.basement = false; PC.levels.prune(s); }), ['B'], `${tag} affected: basement off on two floors`);
  await k.sw('q-basement', false); await settled(page);
  T.eq([await k.text('dialog-title'), await k.text('level-remove-text'), await k.text('dialog-text')], ['Remove Basement?', 'The Basement has 1 room. Move it to the Ground floor, or delete it?', 'The floor plans of the Basement and the Ground floor will be regenerated or lost, with their manual edits and approvals.'], `${tag} basement off, two floors, move: the Ground floor gets the room, so its plan is named too`);
  await k.tapEl(page.locator('label:has(> [data-pc="level-remove-delete"])'));
  T.eq(await k.text('dialog-text'), 'The floor plan of the Basement will be lost, with its manual edits and approval.', `${tag} basement off, two floors, delete: names only the Basement (text follows the choice)`);
  await act('dialog-cancel'); await settled(page);
  T.ok(await hook('q-basement').isChecked() && (await k.state()).ans.basement, `${tag} Cancel keeps the basement`);
  // basement off on a one-floor house: Basement and Ground (the stairs go)
  await page.evaluate(() => PC.store.commit((s) => { s.ans.floors = 1; PC.levels.prune(s); }));
  await k.seedPlans();
  await k.sw('q-basement', false); await settled(page);
  await k.tapEl(page.locator('label:has(> [data-pc="level-remove-delete"])'));
  T.eq([await k.text('dialog-title'), await k.text('dialog-text')], ['Remove Basement?', 'The floor plans of the Basement and the Ground floor will be regenerated or lost, with their manual edits and approvals.'], `${tag} basement off, one floor, delete: names Basement and Ground (the stairs go)`);
  await act('dialog-ok'); await settled(page);
  let s = await k.state();
  T.ok(!(await k.dialogOpen()) && !s.ans.basement && !s.plans.B && s.plans.G && s.plans.G.sig !== (await page.evaluate(() => PC.sig.level(PC.debug.state(), 'G'))), `${tag} Delete: one dialog, basement and its plan gone, ground plan stale`);
  await k.end('R5 own dialog');
  // Q5 readout on a slanted street: whole degrees
  k = await kit(vp); ({ page, hook, act, tag } = k);
  await page.evaluate(() => PC.store.commit((s) => { s.ans.streetEdge = 3; }));
  await act('q-north-cw'); await settled(page);
  const want = await page.evaluate(() => Math.round(PC.frames.northL(PC.debug.state())) % 360);
  T.eq(await k.text('q-north-value'), want + '° clockwise from the back', `${tag} Q5 on the slanted 8.9 m street edge, one step: whole degrees`);
  T.ok(/^\d+° clockwise from the back$/.test(await k.text('q-north-value')), `${tag} ...no decimals (${await k.text('q-north-value')})`);
  // compass on a slanted street: the arrow under the finger is the stored value (no jump on release)
  const d = await page.evaluate(() => PC.debug.siteDial());
  let liveDeg = null;
  await k.G.drag([d.x, d.y - 8], [d.x + 60, d.y + 2], async () => { liveDeg = await page.evaluate(() => PC.debug.siteNorth()); });
  const after = await page.evaluate(() => PC.frames.northL(PC.debug.state()));
  T.ok(liveDeg !== null && Math.abs(liveDeg - after) < 1e-6, `${tag} compass: drawn while dragging ${liveDeg} = stored ${after}`);
  // "front" always labelled: the slanted short edge, and a 10 x 50 m plot
  let L = (await page.evaluate(() => PC.debug.siteLabels())).map((l) => l.text);
  T.ok(L.includes('front'), `${tag} street on the 8.9 m edge carries "front" (${L})`);
  if (tag === '360x640') {
    await page.evaluate(() => PC.store.commit((s) => { s.ans.streetEdge = 0; s.ans.north = null; }));
    await settled(page);
    const v = await page.evaluate(() => PC.debug.view('site'));
    L = (await page.evaluate(() => PC.debug.siteLabels())).map((l) => l.text);
    T.ok(v.scale >= 4.0, `${tag} sample preview drawn at ${v.scale.toFixed(2)} px/m (>= 4.0 after the legend strip)`);
    T.ok(L.includes('back') && L.includes('front'), `${tag} sample preview labels "back" and "front" (${L})`);
  }
  await page.evaluate(() => PC.store.commit((s) => { s.plot = { pts: [[0, 0], [10, 0], [10, 50], [0, 50]], closed: true }; s.ans.streetEdge = 0; s.ans.north = null; }));
  await settled(page);
  L = (await page.evaluate(() => PC.debug.siteLabels())).map((l) => l.text);
  T.ok(L.includes('front'), `${tag} 10 x 50 m plot: "front" labelled (${L})`);
  // Fix on an invalid field focuses that field
  await k.type('q-setback-side', 'abc');
  if ((await k.attr('summary-toggle', 'aria-expanded')) === 'false' && await hook('summary-toggle').isVisible()) await act('summary-toggle');
  await page.locator('[data-pc="conflict-list"] li[data-code="field-invalid"] [data-pc="conflict-goto"]').click(); await settled(page);
  T.eq(await page.evaluate(() => document.activeElement && document.activeElement.dataset.pc), 'q-setback-side', `${tag} Fix on an invalid field focuses the field`);
  await k.type('q-setback-side', '2');
  await k.end('round 2');
}

// F2-T2 QA bug 1: a size-changing answer finished from the keyboard (Enter in a field = the phone's Go / Done key,
// Enter / Space on a stepper) opens the R5 question and leaves it open; it is answered by keyboard as well.
async function keyboardR5(vp) {
  const k = await kit(vp), { page, hook, act, tag } = k;
  await k.seedPlans();
  const s0 = await k.state(), open_ = () => k.dialogOpen();
  const focused = () => page.evaluate(() => document.activeElement && document.activeElement.dataset.pc);
  const enterIn = async (h, text) => { await hook(h).focus(); await hook(h).fill(''); await page.keyboard.type(text); await page.keyboard.press('Enter'); await settled(page); };
  const shown = async () => ({ field: await k.val('q-setback-front'), sum: await k.text('sum-footprint'), area: (await page.evaluate(() => PC.debug.siteLabels())).map((l) => l.text).filter((t) => /m²$/.test(t)) });
  const shown0 = await shown();
  // Enter in the field: the question stays open, nothing stored yet, Cancel has the focus
  await enterIn('q-setback-front', '4');
  T.ok(await open_(), `${tag} Enter in a size-changing field opens the R5 question and it stays open`);
  T.eq([await k.text('dialog-title'), await focused(), await k.state()], ['Regenerate floor plans?', 'dialog-cancel', s0], `${tag} ...Cancel focused, nothing stored yet`);
  // Cancel by Enter on the focused Cancel
  await page.keyboard.press('Enter'); await settled(page);
  T.eq([await open_(), await k.state(), await shown()], [false, s0, shown0], `${tag} Enter on Cancel: state, field, summary and preview as before`);
  // Cancel by Esc
  await enterIn('q-setback-front', '4');
  T.ok(await open_(), `${tag} asks again after a Cancel`);
  await page.keyboard.press('Escape'); await settled(page);
  T.eq([await open_(), await k.state(), await shown()], [false, s0, shown0], `${tag} Esc: state, field, summary and preview as before`);
  // Continue by keyboard: Tab to it, Enter
  await enterIn('q-setback-front', '4');
  for (let i = 0; i < 3 && (await focused()) !== 'dialog-ok'; i++) await page.keyboard.press('Tab');
  T.eq(await focused(), 'dialog-ok', `${tag} Tab reaches Continue inside the dialog`);
  await page.keyboard.press('Enter'); await settled(page);
  let s = await k.state();
  T.eq([await open_(), s.ans.setbacks.front, await k.val('q-setback-front')], [false, 4, '4.0'], `${tag} Continue by keyboard stores 4 m`);
  T.eq(await k.text('sum-footprint'), await page.evaluate(() => { const v = PC.validate(PC.debug.state()).summary; return Math.round(v.footprintArea) + ' m² · ' + Math.round(v.footprintPct * 10) / 10 + ' %'; }), `${tag} ...summary follows`);
  await enterIn('q-setback-side', '2.5');
  T.eq([await open_(), (await k.state()).ans.setbacks.side], [false, 2.5], `${tag} later in the same visit Enter applies without asking`);
  await k.end('keyboard R5 field');
  // steppers by keyboard, Q6 edge buttons, cars by Enter (no R5), in a fresh session
  const k2 = await kit(vp), p2 = k2.page;
  await k2.seedPlans();
  const t0 = await k2.state();
  for (const [h, key, answer] of [['q-setback-side-inc', 'Enter', 'Enter'], ['q-setback-side-inc', ' ', ' '], ['q-street-next', 'Enter', 'Escape'], ['q-street-next', ' ', 'Enter']]) {
    await k2.hook(h).focus(); await p2.keyboard.press(key); await settled(p2);
    T.ok(await k2.dialogOpen(), `${tag} ${JSON.stringify(key)} on ${h} opens the R5 question and it stays open`);
    await p2.keyboard.press(answer); await settled(p2);
    T.eq([await k2.dialogOpen(), await k2.state()], [false, t0], `${tag} ...${JSON.stringify(answer)} cancels it, nothing stored`);
  }
  await k2.act('q-tab-outdoor');
  await k2.hook('q-parking-cars').focus(); await k2.hook('q-parking-cars').fill(''); await p2.keyboard.type('3'); await p2.keyboard.press('Enter'); await settled(p2);
  T.eq([await k2.dialogOpen(), (await k2.state()).ans.parking.cars, await k2.val('q-parking-cars')], [false, 3, '3'], `${tag} Enter in an appearance field (cars) just stores it`);
  await k2.end('keyboard R5 buttons');
}

try {
  // A-16 trim (F3-T3 first item, QA; docs/03-tasks/F3-T3/qa-trim.md): a function no longer runs at a viewport where
  // its twin section in tests/qa/f2-t2-questions.mjs runs with the same input; each keeps at least one viewport here.
  //   keyboardR5          768x1024           (twin: QA K at 360x640, 640x360, 1280x800)
  //   defaultsAndGroups   768x1024           (twin: QA F at 360x640, 768x1024, 1280x800, + QA G layout; kept once for its own checks)
  //   fieldsAndUnits      768x1024, 1280x800 (twin: QA A at 360x640 / 640x360 touch, QA B at 360x640 / 1280x800)
  //   previewAndConflicts 768x1024           (twin: QA C at 360x640, 1280x800 (wheel), 640x360; QA D at 360x640, 1280x800)
  //   gateAndRiders       640x360, 768x1024  (twin: QA E at 360x640, 1280x800)
  //   sliderGestureEnd    768x1024, 1280x800 (twin: QA A Q3 / Q8 "away and back" at 360x640, 640x360)
  //   round2              all three          (no single QA twin: kept)
  const [PH, TAB, DESK] = VIEWPORTS;
  await fieldsAndUnits(TAB); await fieldsAndUnits(DESK);
  await gateAndRiders(LANDSCAPE); await gateAndRiders(TAB);
  await keyboardR5(TAB); await defaultsAndGroups(TAB); await previewAndConflicts(TAB);
  await sliderGestureEnd(TAB); await sliderGestureEnd(DESK);
  for (const vp of [PH, TAB, DESK]) await round2(vp);
} catch (e) { T.ok(false, 'spec crashed: ' + (e && e.stack || e)); } finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
