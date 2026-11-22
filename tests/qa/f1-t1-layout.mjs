// F1-T1 QA: layout, markup contract, focus and reduced-motion checks in headless Chrome.
// Run: node tests/qa/f1-t1-layout.mjs [--no-shots] [--only=360x640]
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VIEWPORTS, THREE_URL, launch, openPage, collector, until, settled } from './lib.mjs';

const INPAGE = readFileSync(join(ROOT, 'tests/qa/inpage.js'), 'utf8');
const SHOTS = join(ROOT, 'tests/qa/shots/F1-T1'); mkdirSync(SHOTS, { recursive: true });
const noShots = process.argv.includes('--no-shots');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const R = collector('F1-T1 layout');
const metrics = {};
// Open minor bugs (see docs/03-tasks/F1-T1/qa-report.md). Remove an entry when the bug is fixed.

const ROOMS8 = [['Ground floor', [['Living', 'living', 'L', 'G'], ['Kitchen', 'kitchen', 'M', 'G'], ['Dining', 'dining', 'M', 'G'], ['Majlis', 'majlis', 'L', 'G'], ['Bathroom', 'bathroom', 'S', 'G'], ['Maid’s room', 'maid', 'exact', 'G'], ['Storage', 'storage', 'S', 'G'], ['Laundry', 'laundry', 'S', 'G']]],
  ['First floor', [['Master bedroom', 'bedroom', 'L', '1'], ['Bedroom 2', 'bedroom', 'M', '1'], ['Bathroom', 'bathroom', 'M', '1']]]];

// name, stage, setup (runs in page with __qa), extra flags
const SCENARIOS = [
  ['s1-start', 1, () => {}],
  ['s1-resume', 1, ({ S, q }) => { q('resume-box').hidden = false; q('note-nosave').hidden = false; }],
  ['s1-drawn', 1, ({ S, q }) => { q('start-panel').hidden = true; q('btn-close-shape').disabled = false; q('plot-area').textContent = '584 m²'; q('plot-perimeter').textContent = '96.9 m'; q('plot-points').textContent = '5'; }],
  ['s1-strip-msg', 1, ({ S, q }) => { q('start-panel').hidden = true; q('sample-strip').hidden = false; q('plot-area').textContent = '6458 sq ft'; q('plot-perimeter').textContent = '318.0 ft'; q('plot-points').textContent = '12'; q('plot-grid').textContent = 'Snap 1 ft'; q('plot-scale').textContent = '1 square = 5 ft'; const m = q('plot-msg'); m.dataset.kind = 'block'; m.textContent = 'That point would make the outline cross itself. Place it somewhere else.'; }],
  ['s2-site', 2, ({ S }) => { S.group('site'); }],
  ['s2-site-errors', 2, ({ S, q }) => { S.group('site'); for (const k of ['front', 'back', 'side']) { const e = q(`q-setback-${k}-err`); e.hidden = false; e.textContent = 'Enter a number from 0 to 20 m.'; q(`q-setback-${k}`).setAttribute('aria-invalid', 'true'); } q('q-footprint-err').hidden = false; q('q-footprint-err').textContent = 'Footprint % plus vegetation % is over 100.'; }],
  ['s2-site-preview-collapsed', 2, ({ S }) => { S.group('site'); S.collapse('site-preview', 'site-preview-toggle', true); }],
  ['s2-building', 2, ({ S, q }) => { S.group('building'); q('q-roof-note').hidden = false; q('q-usable-roof').checked = true; q('q-roof').querySelector('[value=pitched]').disabled = true; }],
  ['s2-rooms', 2, ({ S, q }, ROOMS8) => { S.group('rooms'); const M = PC.C.MAX_ROOMS_PER_LEVEL || 8, EXTRA = [['Office', 'office', 'S', 'G'], ['Storage 2', 'storage', 'S', 'G'], ['Bathroom 2', 'bathroom', 'S', 'G'], ['Laundry 2', 'laundry', 'S', 'G']]; /* F4-T2 CD-4: a full Ground floor of the build's maximum */ ROOMS8[0][1] = ROOMS8[0][1].concat(EXTRA).slice(0, M); S.rooms(ROOMS8); S.pairs(['Kitchen + Dining', 'Master bedroom + Bathroom (First floor)']); q('room-msg').hidden = false; q('room-msg').textContent = `Ground floor already has ${M} rooms.`; }, { rooms: true }],
  ['s2-rooms-nostairs', 2, ({ S, q }) => { S.group('rooms'); q('q-stairs-box').hidden = true; q('q-stairs-none').hidden = false; }],
  ['s2-outdoor', 2, ({ S, q }) => { S.group('outdoor'); q('q-pool').checked = true; }],
  ['s2-summary-open', 2, ({ S }) => { S.group('site'); S.summary(); S.conflicts([['block', 'Ground floor: needs 160 m², 143 m² available. Remove a room or raise the footprint % (Q3).'], ['block', 'Basement has no rooms. Add a room or switch the basement off (Q7).'], ['warn', 'Parking does not fit between the building and the street. It will be left out.'], ['warn', 'Vegetation reduced to 12 % to fit the plot.']]); S.collapse('summary', 'summary-toggle', false); }, { scope: '.pc-summary' }],
  ['s2-summary-open-rooms', 2, ({ S }) => { S.group('rooms'); S.summary(); S.conflicts([['block', 'Ground floor: needs 160 m\u00b2, 143 m\u00b2 available. Remove a room or raise the footprint % (Q3).'], ['warn', 'Vegetation reduced to 12 % to fit the plot.']]); S.collapse('summary', 'summary-toggle', false); }, { scope: '.pc-summary' }],
  ['s2-summary-closed-conflicts', 2, ({ S }) => { S.group('outdoor'); S.summary(); S.conflicts([['block', 'Basement has no rooms.'], ['warn', 'Vegetation reduced to 12 % to fit the plot.']]); }],
  // round 2 additions: bug-1 single-conflict case, bug-3 longest type names in view, bug-2 worst-case readout values
  ['s2-summary-one-conflict', 2, ({ S, q }) => { S.group('site'); S.summary(); const lv = q('sum-levels'); while (lv.children.length > 2) lv.lastChild.remove(); S.conflicts([['block', 'Ground floor: needs 160 m², 143 m² available.']]); S.collapse('summary', 'summary-toggle', false); }, { scope: '.pc-summary', oneConflict: true }],
  ['s2-rooms-list-scrolled', 2, ({ S, q }) => { S.group('rooms'); S.rooms([['Basement', [['Maid’s room', 'maid', 'exact', 'B'], ['Bathroom', 'bathroom', 'S', 'B'], ['Bedroom', 'bedroom', 'L', 'B']]], ['First floor', [['Master bedroom', 'bedroom', 'L', '1'], ['Bedroom 2', 'bedroom', 'M', '1']]]]); S.pairs(['Master bedroom + Bedroom 2']); q('pair-a').value = 'Master bedroom'; q('pair-b').value = 'Maid’s room'; q('room-list').scrollIntoView({ block: 'start' }); }, { rooms: true }],
  ['s2-rooms-pairs-scrolled', 2, ({ S, q }) => { S.group('rooms'); S.rooms([['First floor', [['Master bedroom', 'bedroom', 'L', '1'], ['Maid’s room', 'maid', 'M', '1']]]]); S.pairs(['Master bedroom + Maid’s room']); q('pair-a').value = 'Master bedroom'; q('pair-b').value = 'Maid’s room'; q('pair-a').scrollIntoView({ block: 'center' }); }],
  ['s1-worst-readout', 1, ({ S, q }) => { q('start-panel').hidden = true; q('plot-area').textContent = '107639 sq ft'; q('plot-perimeter').textContent = '1312.3 ft'; q('plot-points').textContent = '12'; q('plot-grid').textContent = 'Snap 1 ft'; }],
  ['s3-worst-readout', 3, ({ S, q }) => { S.planTabs([['Basement', 'draft', false], ['Ground', 'draft', true], ['First', 'draft', false], ['Second', 'draft', false]]); q('plan-room-name').textContent = 'Master bedroom'; q('plan-room-dims').textContent = '26.2 × 32.8 ft'; q('plan-room-area').textContent = '861 sq ft'; }],
  ['s3', 3, ({ S }) => { S.planTabs([['Ground', 'draft', true], ['First', 'draft', false]]); }],
  ['s3-max', 3, ({ S, q }) => { S.planTabs([['Basement', 'invalid', false], ['Ground', 'approved', true], ['First', 'draft', false], ['Second', 'approved', false]]); q('plan-counter').innerHTML = '<strong>2 of 4</strong> floors approved'; q('plan-room-name').textContent = 'Master bedroom'; q('plan-room-dims').textContent = '16.4 × 19.7 ft'; q('plan-room-area').textContent = '323 sq ft'; S.planWarn(['Kitchen and Dining are not adjacent.', 'Parking was left out.']); q('btn-approve').classList.add('is-approved'); q('btn-approve-label').textContent = 'Approved'; const m = q('plan-msg'); m.dataset.kind = 'block'; m.textContent = 'Rooms overlap. Move or resize the marked rooms before approving.'; }],
  ['s3-warn-open', 3, ({ S }) => { S.planTabs([['Ground', 'draft', true], ['First', 'draft', false]]); S.planWarn(['Kitchen and Dining are not adjacent.', 'Footprint was reduced to fit the buildable area: 120 m², 20.5 %.', 'Parking does not fit and was left out.']); S.collapse('plan-warn-panel', 'plan-warn-toggle', false); }],
  ['s3-error', 3, ({ S, q }) => { S.planTabs([['Ground', 'invalid', true], ['First', 'draft', false]]); q('plan-error').hidden = false; q('btn-approve').disabled = true; }],
  ['s4', 4, () => {}],
  ['s5-view', 5, ({ S }) => { S.v3levels([['B', 'B'], ['G', 'G'], ['1', '1'], ['2', '2']]); S.v3rooms(); }, { panel: true }],
  ['s5-light', 5, ({ S }) => { S.v3pane('light'); }, { panel: true }],
  ['s5-tour', 5, ({ S, q }) => { S.v3pane('tour'); S.v3rooms(); q('v3-tour-pause').disabled = false; q('v3-tour-stop').disabled = false; q('v3-caption').hidden = false; q('v3-caption-text').textContent = 'Master bedroom · First floor'; q('v3-caption-pause').hidden = false; q('v3-caption-stop').hidden = false; }, { panel: true, caption: true }],
  ['s5-collapsed', 5, ({ S, q }) => { S.v3levels([['B', 'B'], ['G', 'G'], ['1', '1'], ['2', '2']]); S.collapse('v3-panel', 'v3-panel-toggle', true); q('v3-caption').hidden = false; }, { caption: true }],
  ['s5-building', 5, ({ S, q }) => { q('v3-building').hidden = false; }],
  ['s5-unavailable', 5, ({ S, q }) => { q('v3-unavailable').hidden = false; }],
  ['x-dialog-confirm', 1, ({ S }) => { S.dialog('Regenerate floor plans?', 'Floor plans affected by this change will be regenerated. Manual room edits and approvals on Ground floor and First floor will be lost.'); }, { dialog: true }],
  ['x-dialog-level-remove', 2, ({ S }) => { S.group('building'); S.dialog('Remove the first floor?', 'This level has rooms. Choose what happens to them.', 'tpl-level-remove'); }, { dialog: true }],
  ['x-toast', 1, ({ S }) => { S.toast('Approve all floors first'); }],
  // A banner on stage 3: only while stage 3 has no controller. With F3-T1 (PC.layout) stage 3 never shows the shell banner
  // (A-15), so the banner layout is checked on stage 4, the first stage that still can show it.
  ['x-banners', 3, ({ S }) => { if (typeof PC.layout === 'object') { S.stage(4); } else S.planTabs([['Ground', 'draft', true], ['First', 'draft', false]]); S.banner('warn', 'Footprint was reduced to fit the buildable area: 120 m², 20.5 %.', 'Review'); }],
];

// Waits (max 2 s) until the layout key (scroll offsets of every scroller + boxes of every interactive element) is the
// same in two consecutive animation frames.
const stable = (page) => page.evaluate(() => new Promise((resolve) => {
  const key = () => JSON.stringify([...document.querySelectorAll('*')].filter((a) => a.scrollTop || a.scrollLeft).map((a) => [a.scrollTop, a.scrollLeft]).concat(__qa.interactive().map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })));
  const t0 = performance.now(); let last = key();
  const tick = () => { const k = key(); if (k === last || performance.now() - t0 > 2000) resolve(); else { last = k; requestAnimationFrame(tick); } };
  requestAnimationFrame(() => requestAnimationFrame(tick));
}));
// Stage-5 states (F4-T1): with the stage-5 controller (marker !!(PC.house && PC.house.build)) the panel is hidden while
// three.js is unavailable, so these states load the FS's THREE mock (lib openPage three: 'mock'); s5-unavailable keeps
// the aborted request and is the controller's real unavailable state. Before the controller the mock changes nothing.
const threeFor = (name, stage) => (stage === 5 && name !== 's5-unavailable' ? { three: 'mock' } : {});
const v3settle = (page) => page.evaluate(() => new Promise((res) => { if (!(PC.house && PC.house.build)) return res(); const t0 = performance.now(), q = (h) => document.querySelector(`[data-pc="${h}"]`);
  const tick = () => (q('v3-building').hidden || performance.now() - t0 > 3000 ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }));
// Default-run trim (TL, F6-T1 margin ruling, docs/03-tasks/F6-T1/qa-default-trim.md rows 4 and 5): at 640x360 and
// 1280x800 the layout scenarios s5-building, x-banners, s5-light and s5-tour run in the release step only (QA_RELEASE=1;
// f6-t1-leak.mjs --max-only runs this file with --release-only, which runs just those). 360x640 keeps every scenario.
const REL = !!process.env.QA_RELEASE, RELONLY = process.argv.includes('--release-only'), RELSCN = ['s5-building', 'x-banners', 's5-light', 's5-tour'];
const scnRun = (vp, name) => { const twin = ['640x360', '1280x800'].includes(vp.tag) && RELSCN.includes(name); return RELONLY ? twin : REL || !twin; };
const browser = await launch();
try {
  // ================= markup contract (once, pristine document) =================
  if (!RELONLY) {
    const { ctx, page, log } = await openPage(browser, VIEWPORTS[0]);
    await until(() => log.requests.length > 0, 3000); await settled(page);   // the three.js request has been attempted
    R.check('only network request is the three.js tag', log.requests.length === 1 && log.requests[0] === THREE_URL ? [] : ['requests: ' + JSON.stringify(log.requests)]);
    R.check('no page errors on load with three.js unavailable', log.errors);
    R.check('placeholder boot shows stage 1 only', await page.evaluate(() => { const v = [...document.querySelectorAll('[data-stage]')].filter((s) => !s.hidden).map((s) => s.dataset.stage); return v.join() === '1' ? [] : ['visible stages: ' + v.join()]; }));
    R.check('exactly five stage sections, data-stage 1..5 in order', await page.evaluate(() => { const v = [...document.querySelectorAll('main > section[data-stage]')].map((s) => s.dataset.stage).join(); return v === '1,2,3,4,5' ? [] : [v]; }));
    R.check('globals: only PC added; PC.data.palette2d present', await page.evaluate(() => { const f = []; if (typeof PC !== 'object') f.push('PC missing'); else { if (!PC.data || !PC.data.palette2d) f.push('palette2d missing'); const want = PC.C.FOOTPRINT_STRETCH_RATIO === undefined ? 1 : 2; /* draft v2 lands with the round-4 site rules (F2-T3 increment 1) */ if (PC.DRAFT_V !== want) f.push(`DRAFT_V ${PC.DRAFT_V}, expected ${want}`); if (PC.draft.KEY !== 'plotcraft.draft.v' + want) f.push('draft key ' + PC.draft.KEY); } if (typeof THREE !== 'undefined') f.push('THREE defined?'); return f; }));

    const hooksPath = existsSync(join(ROOT, 'tests/contract/hooks.json')) ? 'tests/contract/hooks.json' : 'docs/03-tasks/F1-T1/verify/hooks.json'; // contract moved to tests/contract in F1-T2
    const hooks = JSON.parse(readFileSync(join(ROOT, hooksPath), 'utf8')); R.note('hook contract read from ' + hooksPath);
    R.check('hooks.json: every document hook exists exactly once; template parts exactly once in their template; nothing unlisted', await page.evaluate((hooks) => {
      const f = [], count = (root, h) => root.querySelectorAll(`[data-pc="${h}"]`).length;
      const seen = {}; for (const h of hooks.document) { seen[h] = (seen[h] || 0) + 1; const n = count(document, h); if (n !== 1) f.push(`${h}: ${n} in document`); }
      for (const h in seen) if (seen[h] > 1) f.push(`${h} listed ${seen[h]} times in hooks.json`);
      const listed = new Set(hooks.document); for (const el of document.querySelectorAll('[data-pc]')) if (!listed.has(el.dataset.pc)) f.push(`unlisted hook in document: ${el.dataset.pc}`);
      const tpls = [...document.querySelectorAll('template')]; for (const t of tpls) if (!t.dataset.pc || !(t.dataset.pc in hooks.templates)) f.push(`template not in hooks.json: ${t.dataset.pc}`);
      for (const [t, parts] of Object.entries(hooks.templates)) { const el = document.querySelector(`template[data-pc="${t}"]`); if (!el) { f.push(`template ${t} missing`); continue; } if (el.content.childElementCount !== 1) f.push(`template ${t} has ${el.content.childElementCount} root elements`); for (const p of parts) { const n = count(el.content, p); if (n !== 1) f.push(`${t} > ${p}: ${n}`); } const lp = new Set(parts); for (const c of el.content.querySelectorAll('[data-pc]')) if (!lp.has(c.dataset.pc)) f.push(`unlisted part ${t} > ${c.dataset.pc}`); for (const p of parts) if (listed.has(p)) f.push(`template part ${p} collides with a document hook`); }
      for (const el of document.querySelectorAll('[data-pc]')) if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(el.dataset.pc)) f.push(`hook not kebab-case: ${el.dataset.pc}`);
      return f;
    }, hooks));

    // Choice values written from architecture A-4 by QA (not from the Designer's values.json).
    const A4 = {
      'unit-toggle': ['m', 'ft'], 'q-unit': ['m', 'ft'], 'q-floors': ['1', '2', '3'], 'q-roof': ['flat', 'pitched', 'terrace'], 'q-exterior': ['sand', 'white', 'terracotta', 'grey'],
      'room-add-type': ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry'], 'room-add-level': ['B', 'G', '1', '2'], 'room-add-size': ['S', 'M', 'L', 'exact'],
      'q-stair-pos': ['centre', 'fl', 'fr', 'bl', 'br'], 'q-pool-size': ['S', 'M', 'L'], 'q-gate': ['left', 'centre', 'right'], 'q-interior-style': ['modern', 'classic', 'minimal'], 'q-interior-density': ['sparse', 'full'],
      'v3-season': ['spring', 'summer', 'autumn', 'winter'], 'v3-tour-speed': ['slow', 'normal', 'fast'], 'v3-level': ['all'],
      'tpl-room-row>room-type': ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry'], 'tpl-room-row>room-level': ['B', 'G', '1', '2'], 'tpl-room-row>room-size': ['S', 'M', 'L', 'exact'],
    };
    const DEFAULTS = { 'unit-toggle': 'm', 'q-unit': 'm', 'q-floors': '2', 'q-roof': 'flat', 'q-exterior': 'sand', 'room-add-size': 'M', 'q-stair-pos': 'centre', 'q-pool-size': 'S', 'q-gate': 'centre', 'q-interior-style': 'modern', 'q-interior-density': 'full', 'v3-tour-speed': 'normal', 'v3-level': 'all', 'room-add-level': 'G' };
    R.check('choice values equal the A-4 state values (set-equal, no extras)', await page.evaluate((A4) => {
      const f = [];
      for (const [key, want] of Object.entries(A4)) {
        let el; if (key.includes('>')) { const [t, p] = key.split('>'); el = document.querySelector(`template[data-pc="${t}"]`).content.querySelector(`[data-pc="${p}"]`); } else el = document.querySelector(`[data-pc="${key}"]`);
        if (!el) { f.push(key + ' missing'); continue; }
        const got = el.tagName === 'SELECT' ? [...el.options].map((o) => o.value) : [...el.querySelectorAll('input[type=radio]')].map((i) => i.value);
        if ([...got].sort().join() !== [...want].sort().join()) f.push(`${key}: got [${got}] want [${want}]`);
        if (new Set(got).size !== got.length) f.push(`${key}: duplicate values`);
      }
      return f;
    }, A4));
    R.check('static defaults equal section 4.1 defaults', await page.evaluate((D) => {
      const f = []; const q = (h) => document.querySelector(`[data-pc="${h}"]`);
      for (const [k, v] of Object.entries(D)) { const el = q(k); const got = el.tagName === 'SELECT' ? el.value : (el.querySelector('input:checked') || {}).value; if (got !== v) f.push(`${k}: default ${got}, want ${v}`); }
      const num = { 'q-setback-front': 3, 'q-setback-back': 2, 'q-setback-side': 2, 'q-footprint': 30, 'q-veg': 20, 'q-ceiling': 3, 'q-parking-cars': 1 }; for (const [k, v] of Object.entries(num)) if (parseFloat(q(k).value) !== v) f.push(`${k}: ${q(k).value}, want ${v}`);
      const sw = { 'q-basement': false, 'q-usable-roof': false, 'q-lift': false, 'q-parking-covered': false, 'q-pool': false, 'q-wall': true, 'q-seating': false, 'v3-roof': false }; if (PC.C.VIEW3D && PC.C.VIEW3D.roofOnOpen !== undefined) delete sw['v3-roof'];   /* F6-T1: stage 5 sets the switch from roofOnOpen on its first enter (f4-t1-view checks it) */ for (const [k, v] of Object.entries(sw)) if (q(k).checked !== v) f.push(`${k}: checked ${q(k).checked}, want ${v}`);
      const rng = { 'q-footprint': [10, 80], 'q-veg': [0, 80], 'q-ceiling': [2.4, 4.5] }; for (const [k, [a, b]] of Object.entries(rng)) if (+q(k).min !== a || +q(k).max !== b) f.push(`${k}: range ${q(k).min}-${q(k).max}, want ${a}-${b}`);
      return f;
    }, DEFAULTS));
    R.check('preset buttons carry hours 8 / 12 / 17.5 / 22', await page.evaluate(() => { const w = { morning: '8', noon: '12', evening: '17.5', night: '22' }, f = []; for (const k in w) { const v = document.querySelector(`[data-pc="v3-preset-${k}"]`).value; if (v !== w[k]) f.push(`${k}: ${v}`); } return f; }));
    R.check('questionnaire: Q1-Q17 in four groups in brief order, Q18-Q19 only on stage 4', await page.evaluate(() => {
      const f = [], g = (h) => [...document.querySelector(`[data-pc="${h}"]`).querySelectorAll('[data-q]')].map((e) => e.dataset.q).join();
      const want = { 'q-group-site': '1,2,3,4,5,6', 'q-group-building': '7,8,9,10', 'q-group-rooms': '11,13,14', 'q-group-outdoor': '15,16,17' };
      for (const k in want) if (g(k) !== want[k]) f.push(`${k}: ${g(k)}`);
      if (!/Q12/.test(document.querySelector('[data-pc="q-group-rooms"]').textContent)) f.push('Q12 not labelled inside the Rooms group');
      const s4 = [...document.querySelector('[data-stage="4"]').querySelectorAll('[data-q]')].map((e) => e.dataset.q).join(); if (s4 !== '18,19') f.push('stage 4: ' + s4);
      if (document.querySelector('[data-stage="2"] [data-q="18"], [data-stage="2"] [data-q="19"]')) f.push('Q18/Q19 in stage 2');
      return f;
    }));
    const BRIEF = { 1: 'Measurement unit', 2: 'Setbacks from each boundary', 3: 'Building footprint % of plot', 4: 'Vegetation % of plot', 5: 'North direction (for sun and shadows)', 6: 'Street-facing side / main entrance edge', 7: 'Number of floors (plus basement and usable roof', 8: 'Floor-to-ceiling height', 9: 'Roof type', 10: 'Exterior style / colour palette', 11: 'Room list: type, count, floor', 13: 'Must-be-adjacent pairs', 14: 'Staircase position preference; lift', 15: 'Parking: number of cars, covered or open', 16: 'Pool', 17: 'Extras: garden seating, boundary wall, gate position', 18: 'Interior style preset', 19: 'Furniture density' };
    R.check('question wording matches the brief', await page.evaluate((B) => { const f = []; for (const [n, t] of Object.entries(B)) { const el = document.querySelector(`[data-q="${n}"] .pc-q__label`); if (!el || !el.textContent.startsWith(t)) f.push(`Q${n}: "${el && el.textContent}"`); } return f; }, BRIEF));
    R.check('document integrity: unique ids, label/aria references resolve, icons resolve, radio names', await page.evaluate(() => {
      const f = [], all = [...document.querySelectorAll('*')], tcontent = [...document.querySelectorAll('template')].flatMap((t) => [...t.content.querySelectorAll('*')]);
      const ids = {}; for (const el of all) if (el.id) ids[el.id] = (ids[el.id] || 0) + 1; for (const id in ids) if (ids[id] > 1) f.push(`duplicate id ${id}`);
      for (const el of tcontent) if (el.id) f.push(`id inside template (would duplicate when cloned): ${el.id}`);
      for (const el of all) { for (const a of ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby']) { const v = el.getAttribute(a); if (v) for (const id of v.split(/\s+/)) if (!document.getElementById(id)) f.push(`${a}="${id}" on ${el.tagName} has no target`); } }
      for (const u of [...all, ...tcontent]) if (u.tagName.toLowerCase() === 'use') { const h = u.getAttribute('href'); if (!h || !document.querySelector(`symbol${h}`)) f.push(`<use href="${h}"> has no symbol`); }
      const syms = [...document.querySelectorAll('symbol')].map((s) => s.id); if (new Set(syms).size !== syms.length) f.push('duplicate symbol ids');
      const groups = {}; for (const r of document.querySelectorAll('input[type=radio]')) { const g = r.closest('[role=radiogroup]'); if (!g) { f.push(`radio ${r.name} outside a radiogroup`); continue; } (groups[r.name] = groups[r.name] || new Set()).add(g); if (!r.name) f.push('radio without name'); }
      for (const n in groups) if (groups[n].size > 1) f.push(`radio name ${n} used in ${groups[n].size} groups`);
      for (const g of document.querySelectorAll('[role=radiogroup]')) if (new Set([...g.querySelectorAll('input[type=radio]')].map((r) => r.name)).size > 1) f.push(`radiogroup ${g.dataset.pc} mixes names`);
      for (const b of [...all, ...tcontent]) { if (!b.matches || !b.matches('button, select, input, canvas, [role=dialog], [role=radiogroup], [role=tablist]')) continue; if (b.tagName === 'BUTTON' && b.getAttribute('type') !== 'button') f.push(`button without type=button: ${b.dataset.pc}`);
        const lab = b.getAttribute('aria-label') || (b.getAttribute('aria-labelledby') && document.getElementById(b.getAttribute('aria-labelledby').split(' ')[0]) || {}).textContent || (b.tagName === 'BUTTON' ? b.textContent.trim() : '') || (b.id && document.querySelector(`label[for="${b.id}"]`) ? 'x' : '') || (b.closest('label') ? b.closest('label').textContent.trim() : '');
        if (!lab && !document.contains(b) && (b.dataset.pc === 'banner-action' || (b.closest('label') && b.closest('label').querySelector('[data-pc]')))) continue; /* template part named by the controller */
        if (!lab) f.push(`no accessible name: ${b.tagName.toLowerCase()} ${b.dataset.pc || b.name || b.className}`); }
      for (const t of document.querySelectorAll('input[type=text]')) if (t.getAttribute('inputmode') !== 'decimal') f.push(`numeric text input without inputmode=decimal: ${t.dataset.pc}`);
      if (document.querySelectorAll('h1').length !== 1) f.push('h1 count ' + document.querySelectorAll('h1').length);
      for (const s of document.querySelectorAll('[data-stage]')) if (!s.getAttribute('aria-labelledby')) f.push('stage without heading label ' + s.dataset.stage);
      return f;
    }));
    R.check('stepper markup: 5 buttons; locked steps are aria-disabled, not disabled, and keep pointer events', await page.evaluate(() => { const f = []; for (let i = 1; i <= 5; i++) { const b = document.querySelector(`[data-pc="step-${i}"]`); if (b.tagName !== 'BUTTON') f.push(`step-${i} is ${b.tagName}`); if (b.disabled) f.push(`step-${i} natively disabled`); if (b.classList.contains('is-locked')) { if (b.getAttribute('aria-disabled') !== 'true') f.push(`step-${i} locked without aria-disabled`); if (getComputedStyle(b).pointerEvents === 'none') f.push(`step-${i} pointer-events none`); } } return f; }));
    R.check('messages carry data-kind; dialog is role=dialog aria-modal; toast region is live', await page.evaluate(() => { const f = [], q = (h) => document.querySelector(`[data-pc="${h}"]`); for (const h of ['plot-msg', 'plan-msg', 'plan-error']) if (!/^(info|warn|block|ok)$/.test(q(h).dataset.kind || '')) f.push(h + ' data-kind'); const d = q('dialog'); if (d.getAttribute('role') !== 'dialog' || d.getAttribute('aria-modal') !== 'true') f.push('dialog role'); if (!q('dialog-layer').hidden) f.push('dialog layer visible by default'); if (q('toast-region').getAttribute('aria-live') !== 'polite') f.push('toast aria-live'); for (const h of ['sample-strip', 'resume-box', 'note-nosave', 'v3-building', 'v3-unavailable', 'v3-caption', 'plan-error']) if (!q(h).hidden) f.push(h + ' should be hidden by default'); return f; }));
    await ctx.close();
  }

  // ================= layout per viewport and scenario =================
  // run-time trim (QA batch 13, TL F5-T2 ruling 3): 768x1024 only with QA_FULL=1 (standing condition: before each feature
  // review and whenever shell / layout CSS changes); 360x640, 640x360 and 1280x800 by default
  for (const vp of VIEWPORTS.filter((v) => process.env.QA_FULL || v.tag !== '768x1024' || only === v.tag)) {
    if (only && vp.tag !== only) continue;
    metrics[vp.tag] = {};
    for (const [name, stage, setup, flags = {}] of SCENARIOS) {
      if (!scnRun(vp, name)) continue;
      const { ctx, page, log } = await openPage(browser, vp, threeFor(name, stage));
      await page.evaluate(INPAGE);
      if (stage === 5) { await page.evaluate(() => __qa.S.stage(5)); await v3settle(page); }
      if (name === 's5-unavailable' && (await page.evaluate(() => !!(PC.house && PC.house.build)))) R.check(`${vp.tag} s5-unavailable is the controller's own state (three.js blocked): message shown, panel hidden`, await page.evaluate(() => { const q = (h) => document.querySelector(`[data-pc="${h}"]`); return !q('v3-unavailable').hidden && (q('v3-panel').hidden || q('v3-panel').closest('[hidden]') || q('v3-panel').getBoundingClientRect().height === 0) ? [] : ['unavailable ' + !q('v3-unavailable').hidden + ', panel shown']; }));
      await page.evaluate(({ stage, setup, ROOMS8 }) => { __qa.S.stage(stage); (0, eval)('(' + setup + ')')(Object.assign({ q: __qa.q }, __qa), ROOMS8); __qa.S.paint(); }, { stage, setup: setup.toString(), ROOMS8 });
      if (stage === 5) await v3settle(page);
      await settled(page, { motion: true }); // transitions ended
      const T = `${vp.tag} ${name}`;
      if (!noShots) await page.screenshot({ path: join(SHOTS, `${name}-${vp.tag}.png`) });
      R.check(`${T} no page scroll`, await page.evaluate(() => __qa.C.pageScroll()));
      R.check(`${T} targets >= 44 px`, await page.evaluate(() => __qa.C.targets(44)));
      R.check(`${T} stepper on one line`, await page.evaluate(() => __qa.C.stepper()));
      if (!flags.dialog) R.check(`${T} Back/Next in view and not covered`, await page.evaluate(() => __qa.C.bar()));
      R.check(`${T} nothing clipped`, await page.evaluate(() => __qa.C.clipped()));
      R.check(`${T} text fits`, await page.evaluate(() => __qa.C.textFit()));
      R.check(`${T} no overlapping controls`, await page.evaluate((sc) => __qa.C.overlap(sc), flags.dialog ? '.pc-dialog-layer' : flags.scope || null));
      const con = await page.evaluate(() => __qa.C.contrast(4.5));
      R.check(`${T} rendered text contrast >= 4.5`, con.fail);
      metrics[vp.tag][name] = { minContrast: +con.min.toFixed(2), textNodes: con.n, disabledLow: con.low };
      R.check(`${T} system fonts (computed)`, await page.evaluate(() => __qa.C.fonts()));
      if ([1, 3, 5].includes(stage) || (stage === 2 && /site(?!-preview)/.test(name))) {
        // F1-T1 rule amended (A-15, F1-T1 plan.md, TL 2026-11-20): the stage-2 site canvas in phone portrait is checked by
        // C.siteStrip (canvas >= 176 and full width, preview box >= 200, strip off the canvas); everything else stays at 200.
        const strip = await page.evaluate(() => __qa.C.siteStripApplies());
        const want = stage === 2 && vp.w <= 599 && vp.h >= 481;   // own reading of the media query, not the page's
        R.check(`${T} site-strip exception applies exactly when the phone-portrait query should match`, strip === want ? [] : [`page says ${strip}, expected ${want}`]);
        R.check(`${T} canvas visible area >= 200 px${strip ? ' (site canvas: amended rule below)' : ''}`, await page.evaluate(() => __qa.C.canvasMin(200)));
        if (strip) {
          R.check(`${T} site preview (amended): canvas >= 176 px high, full width; box >= 200 px; one-line strip not overlapping the canvas`, await page.evaluate(() => __qa.C.siteStrip()));
          metrics[vp.tag][name].siteStrip = await page.evaluate(() => __qa.C.siteStripMetrics());
        }
      }
      if (flags.panel) {
        const m = await page.evaluate(() => __qa.C.v3panel()); metrics[vp.tag][name].panel = m;
        if (vp.tag === '360x640') R.check(`${T} 3D panel height <= a third of the canvas`, m.heightShare <= 1 / 3 + 0.001 ? [] : [`${m.panelH} / ${m.canvasH} = ${(m.heightShare * 100).toFixed(1)} %`]);
        else if (m.areaShare > 1 / 3 + 0.001) R.note(`${T}: 3D panel covers ${(m.areaShare * 100).toFixed(1)} % of the canvas area (limit is defined at 360x640 only)`);
      }
      if (flags.oneConflict) R.check(`${T} single conflict row and its Fix button are visible without scrolling the page`, await page.evaluate(() => { const f = [], st = __qa.q('stage-container').getBoundingClientRect(), body = document.querySelector('#pc-summary-body'); body.scrollTop = 1e5; const b = __qa.q('conflict-goto', __qa.q('conflict-list')), r = b.getBoundingClientRect(), t = __qa.q('conflict-text', __qa.q('conflict-list')).getBoundingClientRect(); if (r.bottom > st.bottom + 0.5 || t.bottom > st.bottom + 0.5) f.push(`conflict row bottom ${Math.round(Math.max(r.bottom, t.bottom))} below stage bottom ${Math.round(st.bottom)}`); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!(hit && b.contains(hit))) f.push('Fix button covered by ' + __qa.desc(hit)); const tg = __qa.q('summary-toggle').getBoundingClientRect(); if (tg.top < st.top - 0.5) f.push('summary toggle pushed above the stage'); body.scrollTop = 0; return f; }));
      if (flags.caption) R.check(`${T} caption clear of panel and inside viewport`, await page.evaluate(() => { const X = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top); const c = __qa.q('v3-caption').getBoundingClientRect(), p = __qa.q('v3-panel').getBoundingClientRect(), f = []; if (X(c, p)) f.push('caption overlaps panel'); if (c.left < 0 || c.right > innerWidth) f.push('caption outside viewport'); return f; }));
      if (flags.dialog) R.check(`${T} dialog inside viewport, buttons reachable, backdrop covers app`, await page.evaluate(() => { const f = [], d = __qa.q('dialog').getBoundingClientRect(), l = __qa.q('dialog-layer').getBoundingClientRect(); if (d.left < 0 || d.top < 0 || d.right > innerWidth + 0.5 || d.bottom > innerHeight + 0.5) f.push(`dialog box ${d.left},${d.top},${d.right},${d.bottom}`); if (l.width < innerWidth || l.height < innerHeight) f.push('layer does not cover viewport'); const nx = __qa.q('btn-next').getBoundingClientRect(); const hit = document.elementFromPoint(nx.left + nx.width / 2, nx.top + nx.height / 2); if (hit && __qa.q('btn-next').contains(hit)) f.push('Next is clickable behind the dialog'); return f; }));
      // last (it scrolls inner containers)
      // Hit test only on a still layout: every scroll position and control box unchanged over two frames (a group switch,
      // a late render or a scroll still in flight would otherwise put another element under a control's centre). A miss is
      // tried once more after the page has settled again; a miss that then passes is reported as a note, not hidden.
      const sc = flags.dialog ? '.pc-dialog-layer' : flags.scope || null;
      await stable(page);
      let hitF = await page.evaluate((sc) => __qa.C.hittable(sc), sc);
      if (hitF.length) { await settled(page, { motion: true }); await stable(page); const again = await page.evaluate((sc) => __qa.C.hittable(sc), sc); if (!again.length) R.note(`${T}: transient hit-test miss, passed on retry: ${hitF.join(' | ')}`); hitF = again; }
      R.check(`${T} every control hittable at its centre`, hitF);
      R.check(`${T} open sheets and panels lie inside the stage`, await page.evaluate(() => __qa.C.insideStage(['summary', 'plan-warn-panel', 'v3-panel', 'site-preview', 'start-panel', 'plan-error', 'v3-caption'])));
      R.check(`${T} no console errors / native dialogs`, [...log.errors, ...log.dialogs]);
      await ctx.close();
    }
    // stepper in every position (states: done / current / locked)
    if (!RELONLY) for (let n = 1; n <= 5; n++) {
      const { ctx, page } = await openPage(browser, vp); await page.evaluate(INPAGE); await page.evaluate((n) => __qa.S.stage(n), n);
      R.check(`${vp.tag} stepper one line with stage ${n} current`, await page.evaluate(() => __qa.C.stepper()));
      R.check(`${vp.tag} stage ${n}: step states are visually distinct (icon or style per state)`, await page.evaluate((n) => { const f = []; for (let i = 1; i <= 5; i++) { const b = __qa.q('step-' + i), cs = getComputedStyle(b); const done = __qa.rendered(b.querySelector('.pc-step__i-done')), lock = __qa.rendered(b.querySelector('.pc-step__i-lock')); if (i < n && !done) f.push(`step ${i} done without check icon`); if (i > n && b.classList.contains('is-locked') && !lock) f.push(`step ${i} locked without lock icon`); if (i > n && !b.classList.contains('is-locked') && lock) f.push(`step ${i} reachable but shows a lock`);   /* real stages (F3-T1, F3-T2) open later steps */ if (i === n) { if (done || lock) f.push(`current step ${i} shows a state icon`); if (cs.borderBottomColor === 'rgba(0, 0, 0, 0)') f.push('current step has no underline'); if (!__qa.rendered(b.querySelector('.pc-step__label'))) f.push('current step has no label'); } } return f; }, n));
      if (!noShots && vp.tag === '360x640') await page.screenshot({ path: join(SHOTS, `stepper-${n}-${vp.tag}.png`), clip: { x: 0, y: 0, width: vp.w, height: 100 } });
      await ctx.close();
    }
    // sample strip on the build's strip stages ([1,3,4] until F4-T2 Step 0.7, [1,3] after; marker PC.ui.shell.STRIP_STAGES / PC.C.STRIP_STAGES): stage must still fit
    const STRIPS = await (async () => { const { ctx, page } = await openPage(browser, vp); const r = await page.evaluate(() => (PC.ui && PC.ui.shell && PC.ui.shell.STRIP_STAGES) || PC.C.STRIP_STAGES || [1, 3, 4]); await ctx.close(); return r.slice(); })();
    if (!RELONLY) for (const n of STRIPS) {
      const { ctx, page } = await openPage(browser, vp); await page.evaluate(INPAGE); await page.evaluate((n) => { __qa.S.stage(n); __qa.q('sample-strip').hidden = false; if (n === 1) __qa.q('start-panel').hidden = true; if (n === 3) __qa.S.planTabs([['Ground', 'approved', true], ['First', 'approved', false]]); __qa.S.paint(); }, n);
      const T = `${vp.tag} strip on stage ${n}`;
      R.check(`${T} no page scroll`, await page.evaluate(() => __qa.C.pageScroll()));
      R.check(`${T} targets`, await page.evaluate(() => __qa.C.targets(44)));
      R.check(`${T} Back/Next`, await page.evaluate(() => __qa.C.bar()));
      R.check(`${T} no overlap`, await page.evaluate(() => __qa.C.overlap()));
      R.check(`${T} clipped`, await page.evaluate(() => __qa.C.clipped()));
      if (n !== 4) R.check(`${T} canvas >= 200`, await page.evaluate(() => __qa.C.canvasMin(200)));
      R.check(`${T} btn-skip3d unique and hittable`, await page.evaluate(() => { const all = document.querySelectorAll('[data-pc="btn-skip3d"]'); const b = all[0].getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return all.length === 1 && hit && all[0].contains(hit) ? [] : ['skip button count ' + all.length + ' / covered']; }));
      if (!noShots) await page.screenshot({ path: join(SHOTS, `strip-s${n}-${vp.tag}.png`) });
      await ctx.close();
    }
  }

  // ================= focus (keyboard) =================
  if (!RELONLY) for (const vp of VIEWPORTS.filter((v) => ['360x640', '1280x800'].includes(v.tag) && (!only || v.tag === only))) {
    for (const [name, stage, setup] of SCENARIOS.filter((s) => ['s1-resume', 's2-site', 's2-building', 's2-rooms', 's2-outdoor', 's3-max', 's4', 's5-view', 's5-light', 's5-tour'].includes(s[0]))) {
      const { ctx, page } = await openPage(browser, vp, threeFor(name, stage)); await page.evaluate(INPAGE);
      if (stage === 5) { await page.evaluate(() => __qa.S.stage(5)); await v3settle(page); }
      await page.evaluate(({ stage, setup, ROOMS8 }) => { __qa.S.stage(stage); (0, eval)('(' + setup + ')')(Object.assign({ q: __qa.q }, __qa), ROOMS8); __qa.S.paint(); }, { stage, setup: setup.toString(), ROOMS8 });
      if (stage === 5) await v3settle(page);
      const seen = [], problems = []; let shot = 0;
      for (let i = 0; i < 160; i++) {
        await page.keyboard.press('Tab');
        const s = await page.evaluate(() => __qa.C.focusState());
        if (!s) { if (seen.length) break; else continue; }
        if (seen.includes(s.el) && s.el === seen[0]) break; seen.push(s.el);
        if (!s.rendered) problems.push(`${s.el} takes focus but is not rendered`);
        else if (!s.indicator) problems.push(`${s.el} has no visible focus indicator`);
        else { if (s.indicator.w < 2) problems.push(`${s.el} ring ${s.indicator.w}px`); if (s.indicator.color !== 'rgb(194, 65, 12)') problems.push(`${s.el} ring colour ${s.indicator.color}`); if (s.sides < 2) problems.push(`${s.el} focus ring clipped on ${4 - s.sides} of 4 sides`); else if (s.sides < 4) R.note(`${vp.tag} ${name}: focus ring of ${s.el} clipped on ${4 - s.sides} side(s)`); }
        if (!s.inViewport) problems.push(`${s.el} focused outside the viewport (not scrolled into view)`);
        if (!noShots && vp.tag === '360x640' && shot < 3 && [3, 9, 15].includes(i)) { await page.screenshot({ path: join(SHOTS, `focus-${name}-${i}-${vp.tag}.png`) }); shot++; }
      }
      R.check(`${vp.tag} ${name} focus visible on all ${seen.length} tab stops`, problems);
      R.check(`${vp.tag} ${name} tab order reaches controls`, seen.length >= 5 ? [] : ['only ' + seen.length + ' tab stops: ' + seen.join(', ')]);
      R.check(`${vp.tag} ${name} tabbing never scrolls the page`, await page.evaluate(() => (scrollX || scrollY || __qa.q('app').scrollTop || __qa.q('stage-container').scrollTop) ? [`scroll ${scrollX},${scrollY} app ${__qa.q('app').scrollTop} stages ${__qa.q('stage-container').scrollTop}`] : []));
      metrics[vp.tag][name] = Object.assign(metrics[vp.tag][name] || {}, { tabStops: seen.length });
      await ctx.close();
    }
  }
  // mouse click must not leave a ring on buttons (focus-visible), keyboard must
  if (!RELONLY) {
    const { ctx, page } = await openPage(browser, VIEWPORTS[2]); await page.evaluate(INPAGE);
    await page.click('[data-pc="btn-sample"]');
    R.check('mouse click shows no focus ring on a button', await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle === 'none' ? [] : ['ring after mouse click']));
    await ctx.close();
  }

  // ================= reduced motion =================
  if (!RELONLY) {
    const a = await openPage(browser, VIEWPORTS[0]); await a.page.evaluate(INPAGE); await a.page.evaluate(() => { for (const s of document.querySelectorAll('[data-stage]')) s.hidden = false; __qa.q('v3-building').hidden = false; __qa.q('dialog-layer').hidden = false; __qa.S.toast('x'); });
    const n = await a.page.evaluate(() => __qa.C.motionPresent()); R.check('motion exists without the preference (control)', n > 0 ? [] : ['no transitions/animations found at all']); R.note(`elements with transition/animation by default: ${n}`); await a.ctx.close();
    const b = await openPage(browser, VIEWPORTS[0], { reducedMotion: 'reduce' }); await b.page.evaluate(INPAGE); await b.page.evaluate(() => { for (const s of document.querySelectorAll('[data-stage]')) s.hidden = false; __qa.q('v3-building').hidden = false; __qa.q('dialog-layer').hidden = false; __qa.S.toast('x'); });
    R.check('prefers-reduced-motion: no transitions or animations anywhere', await b.page.evaluate(() => __qa.C.motion())); await b.ctx.close();
  }
  // canvases: touch-action none (R2 groundwork)
  if (!RELONLY) { const a = await openPage(browser, VIEWPORTS[0]); await a.page.evaluate(INPAGE); R.check('canvases have touch-action: none', await a.page.evaluate(() => __qa.C.touchAction())); await a.ctx.close(); }
} finally { await browser.close(); }

if (!REL) R.note('at 640x360 and 1280x800 the layout scenarios s5-building, x-banners, s5-light and s5-tour run in the release step only (QA_RELEASE=1, f6-t1-leak.mjs --max-only; TL default-run trim)');
if (!RELONLY) writeFileSync(join(SHOTS, 'metrics.json'), JSON.stringify(metrics, null, 1));
for (const vp in metrics) for (const n in metrics[vp]) { const m = metrics[vp][n]; if (m.panel) console.log(`panel ${vp} ${n}: ${m.panel.panelW}x${m.panel.panelH} on canvas ${m.panel.canvasW}x${m.panel.canvasH} -> height ${(m.panel.heightShare * 100).toFixed(1)} %, area ${(m.panel.areaShare * 100).toFixed(1)} %`); if (m.disabledLow && m.disabledLow.length) console.log(`disabled-low-contrast ${vp} ${n}: ${m.disabledLow.join(' | ')}`); }
let minC = 99; for (const vp in metrics) for (const n in metrics[vp]) if (metrics[vp][n].minContrast) minC = Math.min(minC, metrics[vp][n].minContrast); console.log('lowest rendered text contrast (enabled text): ' + minC);
process.exit(R.done() ? 0 : 1);
