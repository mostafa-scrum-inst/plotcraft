// F2-T2 QA: questionnaire Q1-Q10 and Q15-Q17, site preview, live summary and conflicts, R5 dialogs (F2-S1, F2-S3, R4, R5)
// driven through the real UI (touch taps, CDP touch drags, keyboard typing; mouse at 1280x800) in headless Chrome.
// Expectations come from QA's own reference model (f2-t1-ref.mjs) and QA's own reading of the stories, not from the app.
// Run: node tests/qa/f2-t2-questions.mjs [--no-shots] [--only=A,B,...]   (sections A..H, see below)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VIEWPORTS, launch, collector, CANVAS_SPY, touchDriver } from './lib.mjs';
import { sessions, eq, sampleProblems } from './session.mjs';
import * as Q from './f2-t1-ref.mjs';

const SHOTS = join(ROOT, 'tests/qa/shots/F2-T2'); mkdirSync(SHOTS, { recursive: true });
const noShots = process.argv.includes('--no-shots');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (sec) => !only.length || only.includes(sec);
const R = collector('F2-T2 questions');
// Open minor bugs (docs/03-tasks/F2-T2/qa-report.md): listed as KNOWN, do not fail the run. Remove an entry when fixed.
// (F2-T2 bug 2 was listed here; fixed by the Designer in round 3 and re-tested on 2026-11-20, entry removed.)
// (F2-T3 D finding 1, the tap-mode control over the 640x360 drawing, was listed here; fixed by the FS in increment 1 and
// re-tested on 2026-11-20, entry removed.)

const session = sessions({ R, shots: SHOTS, noShots });
const VP = Object.fromEntries(VIEWPORTS.map((v) => [v.tag, v]));
const PHONE = VP['360x640'], LAND = VP['640x360'], TAB = VP['768x1024'], DESK = VP['1280x800'];
import { M2, DOT, LEVEL, lab, fmtLen, fmtArea, r1, streetOf, expectFor, northText, northStored, sizeChanges, lOf, READ, syncProblems, stage2Kit, seedPlans, hintProblems } from './stage2kit.mjs';
const { sync, kit } = stage2Kit({ R, session });

const U_PLOT = [[0, 0], [40, 0], [40, 40], [28, 40], [28, 12], [12, 12], [12, 40], [0, 40]];
const THIN = [[0, 0], [10, 0], [10, 50], [0, 50]];
const ROT = [[10, 0], [33.5, 8.6], [26.6, 27.4], [3.2, 18.8]];        // a 25 x 20 m rectangle turned by 20 degrees (approximately)

const browser = await launch();
const t0 = Date.now();
try {
  // ======================= A. Item 1: every control by real touch updates value, readout, preview, summary =======================
  if (want('A')) for (const vp of [PHONE, LAND]) {
    const V = vp.tag, S = await kit(browser, vp);
    R.check(`${V} A sample loaded by tap is the 6.2 sample`, sampleProblems(await S.state()));
    await sync(S, 'A sample on stage 2');
    // Q1 by radio (the header toggle is in item 8)
    await S.act(lab('q-unit', 'ft')); R.check(`${V} A Q1 ft stored, sample kept`, (await S.ans()).unit === 'ft' && (await S.state()).sampleClean === true); await sync(S, 'A Q1 -> ft');
    await S.act(lab('q-unit', 'm')); await sync(S, 'A Q1 -> m');
    // Q2: typing, steppers (m)
    await S.type('q-setback-front', '4'); R.check(`${V} A Q2 typed 4 m stored`, (await S.ans()).setbacks.front === 4); await sync(S, 'A Q2 typed');
    await S.act('q-setback-back-inc'); R.check(`${V} A Q2 back + stores 2.5 m`, (await S.ans()).setbacks.back === 2.5); await sync(S, 'A Q2 +');
    await S.act('q-setback-side-dec'); R.check(`${V} A Q2 side - stores 1.5 m`, (await S.ans()).setbacks.side === 1.5); await sync(S, 'A Q2 -');
    // Q3, Q4 by drag; away and back to the start value (no change event) leaves the control following the state
    await S.slide('q-footprint', 40); R.check(`${V} A Q3 dragged to 40 %`, (await S.ans()).footprintPct === 40); await sync(S, 'A Q3 drag');
    await S.slide('q-footprint', 40, { via: 60 }); R.check(`${V} A Q3 away and back: still 40 %`, (await S.ans()).footprintPct === 40); await sync(S, 'A Q3 away and back');
    await S.page.evaluate(() => PC.store.commit((s) => { s.ans.footprintPct = 33; })); await sync(S, 'A Q3 external commit after an away-and-back drag is shown');
    await S.slide('q-veg', 50); R.check(`${V} A Q4 dragged to 50 %`, (await S.ans()).vegPct === 50); await sync(S, 'A Q4 drag');
    // live feedback while the finger is down: label, preview label and summary show the value under the finger, state unchanged
    if (vp.touch) { const g = await S.page.evaluate(() => { const e = document.querySelector('[data-pc="q-footprint"]'); e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
      const pos = (v) => [g.x + 8 + (v - 10) / 70 * (g.w - 16), g.y];
      await S.T.drag(pos(33), pos(50), { steps: 8, whileDown: async () => { await S.settle(); const P = await S.page.evaluate(() => ({ out: document.querySelector('[data-pc="q-footprint-out"]').textContent, fp: document.querySelector('[data-pc="sum-footprint"]').textContent, st: PC.debug.state().ans.footprintPct, texts: __spy.frame('site-canvas').texts.map((t) => t.text) }));
        const s = await S.state(), ex = expectFor({ ...s, ans: { ...s.ans, footprintPct: 50 } }, {}); R.check(`${V} A Q3 live while dragging: label, summary and preview show 50 %, state still 33`, P.out === '50 %' && P.st === 33 && P.fp === `${fmtArea(ex.fp.area, 'm')}${DOT}${r1(ex.fp.pct)} %` && P.texts.includes(fmtArea(ex.fp.area, 'm')) ? [] : [JSON.stringify(P), fmtArea(ex.fp.area, 'm')]); } });
      await S.settle(); await sync(S, 'A Q3 released at 50');
      // Q4 the same way: 50 -> 10 %, summary vegetation follows the finger (my budget with the placed parking and pool)
      const gv = await S.page.evaluate(() => { const e = document.querySelector('[data-pc="q-veg"]'); e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
      const pv = (v) => [gv.x + 8 + v / 80 * (gv.w - 16), gv.y];
      await S.T.drag(pv(50), pv(10), { steps: 8, whileDown: async () => { await S.settle(); const P = await S.page.evaluate(READ), s = P.state, ex = expectFor({ ...s, ans: { ...s.ans, vegPct: 10 } }, P.app);
        R.check(`${V} A Q4 live while dragging: label and summary show 10 %, state still 50`, P.sl['q-veg'].out === '10 %' && s.ans.vegPct === 50 && P.sum.veg === `${fmtArea(ex.veg, 'm')}${DOT}${r1(ex.vegPct)} %` ? [] : [JSON.stringify([P.sl['q-veg'], P.sum.veg, s.ans.vegPct])]); } });
      await S.settle(); await sync(S, 'A Q4 released at 10'); }
    // Q5 buttons and compass
    await S.act('q-north-cw'); await sync(S, 'A Q5 cw'); await S.act('q-north-cw'); await S.act('q-north-ccw'); await sync(S, 'A Q5 cw, cw, ccw');
    R.check(`${V} A Q5 one step clockwise from the default stores 15`, (await S.ans()).north === 15);
    await S.act('q-north-reset'); R.check(`${V} A Q5 reset stores null`, (await S.ans()).north === null); await sync(S, 'A Q5 reset');
    { const d = await S.page.evaluate(() => PC.debug.siteDial()), s0 = await S.state(); let during = null;
      await S.dragPts([d.x, d.y - d.r + 4], [d.x + 30, d.y + 2], async () => { await S.settle(); during = await S.page.evaluate(() => PC.debug.siteNorth()); });
      // the pointer ends 30 px right of and 2 px below the dial centre: 93.8 degrees clockwise from up (= straight back)
      const s1 = await S.state(), exp = northStored(s0, Math.atan2(30, -2) * 180 / Math.PI), arrow = lOf(s0, exp);
      R.check(`${V} A Q5 compass drag stores my snapped value (${exp}); the arrow under the finger (${arrow.toFixed(2)} in L) equals the stored one`, s1.ans.north === exp && Math.abs(during - arrow) < 1e-6 ? [] : [`stored ${s1.ans.north}, arrow during drag ${during}`]);
      await sync(S, 'A Q5 compass'); }
    // Q6 by edge tap and by prev / next
    { await S.tapAt(await S.edgeMid(2)); const s = await S.state(); R.check(`${V} A Q6 tap on edge 3 makes it the street`, s.ans.streetEdge === 2 ? [] : ['streetEdge ' + s.ans.streetEdge]); await sync(S, 'A Q6 edge tap');
      await S.act('q-street-next'); R.check(`${V} A Q6 next -> edge 4`, (await S.ans()).streetEdge === 3); await sync(S, 'A Q6 next');
      await S.act('q-street-prev'); await S.act('q-street-prev'); await S.act('q-street-prev'); R.check(`${V} A Q6 prev x3 -> edge 1`, (await S.ans()).streetEdge === 0); await sync(S, 'A Q6 prev'); }
    // Q7, Q8, Q9, Q10
    await S.openGroup('building');
    await S.act(lab('q-floors', '3')); R.check(`${V} A Q7 3 floors stored`, (await S.ans()).floors === 3); await sync(S, 'A Q7 3 floors');
    await S.act(lab('q-floors', '2')); await sync(S, 'A Q7 back to 2');
    await S.act('q-basement'); R.check(`${V} A Q7 basement on`, (await S.ans()).basement === true); await sync(S, 'A Q7 basement on');
    await S.act('q-basement'); await sync(S, 'A Q7 basement off');
    await S.act(lab('q-roof', 'pitched')); R.check(`${V} A Q9 pitched`, (await S.ans()).roofType === 'pitched'); await sync(S, 'A Q9 pitched');
    await S.act('q-usable-roof'); { const P = await S.page.evaluate(READ); R.check(`${V} A Q7 usable roof on with Pitched -> Flat with note, Pitched disabled`, P.state.ans.usableRoof && P.state.ans.roofType === 'flat' && P.roofNote && P.disabled.roof.pitched ? [] : [JSON.stringify([P.state.ans.roofType, P.roofNote, P.disabled.roof])]); } await sync(S, 'A Q7 usable roof');
    await S.act(lab('q-roof', 'terrace')); R.check(`${V} A Q9 a roof pick hides the note`, !(await S.page.evaluate(READ)).roofNote); await S.act('q-usable-roof'); await sync(S, 'A Q7 usable roof off');
    await S.act(lab('q-exterior', 'terracotta')); R.check(`${V} A Q10 terracotta`, (await S.ans()).exterior === 'terracotta'); await sync(S, 'A Q10');
    await S.slide('q-ceiling', 3.5); R.check(`${V} A Q8 dragged to 3.5 m`, (await S.ans()).ceilingH === 3.5); await sync(S, 'A Q8 m');
    await S.act('unit-ft'); await sync(S, 'A Q8 in ft after the header switch');
    await S.slide('q-ceiling', 12); R.check(`${V} A Q8 dragged to 12 ft stores 3.6576 m`, Math.abs((await S.ans()).ceilingH - 12 * Q.FT) < 1e-9 ? [] : ['ceilingH ' + (await S.ans()).ceilingH]); await sync(S, 'A Q8 ft');
    await S.slide('q-ceiling', 12, { via: 14 }); R.check(`${V} A Q8 ft away and back keeps 3.6576 m`, Math.abs((await S.ans()).ceilingH - 12 * Q.FT) < 1e-9); await sync(S, 'A Q8 ft away and back');
    // Q15-Q17 (still in ft: lengths follow the unit)
    await S.openGroup('outdoor');
    await S.act('q-parking-cars-inc'); R.check(`${V} A Q15 + -> 3 cars`, (await S.ans()).parking.cars === 3); await sync(S, 'A Q15 +');
    await S.type('q-parking-cars', '1'); R.check(`${V} A Q15 typed 1`, (await S.ans()).parking.cars === 1); await sync(S, 'A Q15 typed');
    await S.act('q-parking-cars-dec'); R.check(`${V} A Q15 - -> 0`, (await S.ans()).parking.cars === 0); await sync(S, 'A Q15 -');
    await S.act('q-parking-cars-dec'); R.check(`${V} A Q15 - at 0 stays 0`, (await S.ans()).parking.cars === 0); await S.act('q-parking-cars-inc'); await S.act('q-parking-cars-inc');
    await S.act('q-parking-covered'); R.check(`${V} A Q15 covered off`, (await S.ans()).parking.covered === false); await sync(S, 'A Q15 covered');
    await S.act(lab('q-pool-size', 'M')); R.check(`${V} A Q16 size M`, (await S.ans()).pool.size === 'M'); await sync(S, 'A Q16 M');
    await S.act('q-pool'); R.check(`${V} A Q16 pool off, sizes disabled, M kept`, (await S.ans()).pool.on === false && (await S.ans()).pool.size === 'M'); await sync(S, 'A Q16 off');
    await S.act('q-pool'); await sync(S, 'A Q16 on');
    await S.act('q-wall'); await S.act(lab('q-gate', 'left')); await S.act('q-seating');
    { const a = await S.ans(); R.check(`${V} A Q17 wall off, gate left, seating off`, !a.extras.wall && a.extras.gate === 'left' && !a.extras.seating); } await sync(S, 'A Q17');
    // nothing stale after a unit switch (both ways) and after Resume
    { const a0 = await S.ans(); await S.act('unit-m'); await sync(S, 'A unit -> m'); await S.act('unit-ft'); await sync(S, 'A unit -> ft');
      R.check(`${V} A unit switches m -> ft never commit a length`, eq({ ...(await S.ans()), unit: 'x' }, { ...a0, unit: 'x' })); }
    await S.flush(); const before = (await S.state()).ans; await S.reload();
    await S.act('btn-resume'); await S.until(() => S.page.evaluate(() => !document.querySelector('[data-stage="2"]').hidden), 3000).then(async (ok) => { if (!ok) await S.act('btn-next'); });
    R.check(`${V} A Resume restores every answer`, eq((await S.state()).ans, before) ? [] : ['answers differ after Resume']); await sync(S, 'A after Resume');
    // nothing stale after Load sample (through the real path: stage 1, Clear, Load sample)
    await S.act('step-1'); await S.act('btn-clear'); if (await S.dialogOpen()) await S.act('dialog-ok'); await S.act('btn-sample'); if (await S.dialogOpen()) await S.act('dialog-ok');
    await S.act('btn-next'); await S.settle();
    { const s = await S.state(); R.check(`${V} A Load sample after edits: the sample again (unit stays the user's choice)`, sampleProblems({ ...s, ans: { ...s.ans, unit: 'm' } })); } await sync(S, 'A after Load sample');
    await S.shot('A-end'); await S.end(`${V} A`);
  }

  // ======================= B. Item 3: bad input =======================
  if (want('B')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag, S = await kit(browser, vp, { max5: true });
    // [typed text, unit, expected stored metres or null = refused]; written from 4.1 (0-20 m) and R4, not from the code
    const CASES = [['', 'm', null], ['abc', 'm', null], ['1e2', 'm', null], ['0x10', 'm', null], ['-1', 'm', null], ['25', 'm', null], ['20.01', 'm', null], ['1.2.3', 'm', null], ['3,5,1', 'm', null], ['- 2', 'm', null],
      ['3.', 'm', 3], ['.5', 'm', 0.5], ['3,5', 'm', 3.5], [' 4 ', 'm', 4], ['+2', 'm', 2], ['0', 'm', 0], ['20', 'm', 20], ['20.0', 'm', 20],
      ['10', 'ft', 10 * Q.FT], ['65.6', 'ft', 65.6 * Q.FT], ['65.7', 'ft', null], ['0,5', 'ft', 0.5 * Q.FT], ['-0.1', 'ft', null]];
    for (const [text, unit, exp] of CASES) {
      if ((await S.ans()).unit !== unit) await S.act('unit-' + unit);
      await S.type('q-setback-back', '2'); const before = await S.state();
      await S.type('q-setback-back', text); const P = await S.page.evaluate(READ), bar = await S.bar(), L = `${V} B Q2 "${text}" (${unit})`;
      if (exp === null) {
        const lim = unit === 'ft' ? ['0.0 ft', '65.6 ft'] : ['0.0 m', '20.0 m'];
        R.check(`${L}: refused, state unchanged, text kept, error with limits in ${unit}, conflict row, Next disabled`, [
          ...(eq(P.state, before) ? [] : ['state changed']), ...(P.f['q-setback-back'].v === text ? [] : [`field shows "${P.f['q-setback-back'].v}"`]),
          ...(P.f['q-setback-back'].inv === 'true' ? [] : ['no aria-invalid']), ...(P.f['q-setback-back'].err === `Enter a number from ${lim[0]} to ${lim[1]}.` ? [] : [`error "${P.f['q-setback-back'].err}"`]),
          ...(P.rows.some((r) => r.code === 'field-invalid' && r.q === '2' && r.text === `Back setback: enter a number from ${lim[0]} to ${lim[1]}.`) ? [] : ['row ' + JSON.stringify(P.rows)]),
          ...(bar.next ? ['Next enabled'] : [])]);
      } else R.check(`${L}: stored ${exp.toFixed(4)} m, no error; Next follows the remaining blocking rows`, Math.abs(P.state.ans.setbacks.back - exp) < 1e-9 && !P.f['q-setback-back'].err && !P.rows.some((r) => r.code === 'field-invalid') && bar.next === !P.rows.some((r) => r.kind === 'block') ? [] : [`stored ${P.state.ans.setbacks.back}, err ${P.f['q-setback-back'].err}, next ${bar.next}, rows ${JSON.stringify(P.rows)}`]);
      await sync(S, `B after "${text}" (${unit})`);
    }
    if ((await S.ans()).unit !== 'm') await S.act('unit-m');
    await S.type('q-setback-back', '2');
    // cars: whole numbers 0-4, no unit in the message
    await S.openGroup('outdoor');
    for (const [text, exp] of [['1.5', null], ['5', null], ['-1', null], ['x', null], ['4', 4], ['2,0', 2], ['0', 0]]) {
      await S.type('q-parking-cars', text); const P = await S.page.evaluate(READ), c = P.f['q-parking-cars'];
      if (exp === null) R.check(`${V} B Q15 "${text}" refused with "Enter a number from 0 to 4." (no unit) and a Q15 row`, c.inv === 'true' && c.err === 'Enter a number from 0 to 4.' && c.v === text && P.rows.some((r) => r.code === 'field-invalid' && r.q === '15' && r.text === 'Number of cars: enter a number from 0 to 4.') ? [] : [JSON.stringify(c), JSON.stringify(P.rows)]);
      else R.check(`${V} B Q15 "${text}" stored ${exp}`, P.state.ans.parking.cars === exp && !c.err ? [] : [JSON.stringify(c)]);
    }
    // invalid text survives re-renders (another answer, a group change) and a unit switch (limits re-worded)
    await S.openGroup('site'); await S.type('q-setback-front', '99');
    await S.act('q-north-cw'); await S.openGroup('building'); await S.act(lab('q-exterior', 'white')); await S.openGroup('site');
    let P = await S.page.evaluate(READ);
    R.check(`${V} B invalid text survives other answers and a group change`, P.f['q-setback-front'].v === '99' && P.f['q-setback-front'].inv === 'true' ? [] : [JSON.stringify(P.f['q-setback-front'])]);
    await S.act('unit-ft'); P = await S.page.evaluate(READ);
    R.check(`${V} B invalid text survives a unit switch; error and row re-worded in ft`, P.f['q-setback-front'].v === '99' && P.f['q-setback-front'].err === 'Enter a number from 0.0 ft to 65.6 ft.' && P.rows.some((r) => r.text === 'Front setback: enter a number from 0.0 ft to 65.6 ft.') ? [] : [JSON.stringify(P.f['q-setback-front']), JSON.stringify(P.rows)]);
    await sync(S, 'B invalid in ft');
    // Fix focuses the invalid field (phone: closes the sheet first)
    await S.openGroup('outdoor');
    if (vp.touch) { await S.act('summary-toggle'); }
    await S.act('css:[data-pc="conflict-list"] > li[data-code="field-invalid"] [data-pc="conflict-goto"]');
    { const g = await S.page.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect(), sm = document.querySelector('[data-pc="summary"]'); return { f: a.dataset.pc, inView: r.top >= 0 && r.bottom <= innerHeight, collapsed: sm.classList.contains('is-collapsed') || getComputedStyle(document.querySelector('[data-pc="summary-toggle"]')).display === 'none' }; });
      R.check(`${V} B Fix on the invalid setback: Site group open, the invalid field focused and in view${vp.touch ? ', sheet closed' : ''}`, (await S.group()) === 'site' && g.f === 'q-setback-front' && g.inView && (!vp.touch || g.collapsed) ? [] : [JSON.stringify(g), await S.group()]); }
    // clearing it clears everything without reload; Next comes back
    await S.type('q-setback-front', '10'); P = await S.page.evaluate(READ);
    R.check(`${V} B fixing the text: 10 ft stored as 3.048 m, error, row and Next restored live`, Math.abs(P.state.ans.setbacks.front - 3.048) < 1e-9 && !P.f['q-setback-front'].err && !P.rows.some((r) => r.code === 'field-invalid') && (await S.bar()).next ? [] : [JSON.stringify(P.f['q-setback-front']), JSON.stringify(P.rows)]);
    // leaving an untouched field never rewrites a stored value (3.048 m shows as 3.0 in m)
    await S.act('unit-m'); await S.act('q-setback-front'); await S.page.keyboard.press('Enter'); await S.settle();
    R.check(`${V} B tapping and leaving an untouched field keeps 3.048 m`, (await S.ans()).setbacks.front === 3.048);
    await sync(S, 'B end'); await S.end(`${V} B`);
  }

  // ======================= C. Item 5: site preview =======================
  if (want('C')) {
    for (const vp of [PHONE, DESK, LAND]) {
      const V = vp.tag;
      for (const [name, plot, ans] of [['sample', null, null], ['U-plot', U_PLOT, { setbacks: { front: 3, back: 2, side: 2 } }], ['thin 10x50', THIN, { footprintPct: 30 }], ['rotated rect', ROT, null]]) {
        const S = await kit(browser, vp, plot ? { plot, ans } : {});
        await sync(S, `C ${name} m`); await S.shot(`C-${name.replace(/\W+/g, '-')}-m`);
        await S.act('unit-ft'); await sync(S, `C ${name} ft`); await S.shot(`C-${name.replace(/\W+/g, '-')}-ft`);
        if (name === 'sample' && V === '360x640') R.check(`${V} C sample drawn at 4.0 px per metre or more`, (await S.page.evaluate(() => PC.debug.view('site').scale)) >= 4 - 1e-9 ? [] : ['scale ' + (await S.page.evaluate(() => PC.debug.view('site').scale))]);
        // locked: drag on empty canvas, pinch, wheel leave the view and the state alone; the page does not scroll or zoom
        if (name === 'sample') {
          const v0 = await S.page.evaluate(() => PC.debug.view('site')), st0 = await S.state(), c = await S.page.evaluate(() => { const r = document.querySelector('[data-pc="site-canvas"]').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
          const a = [c[0] + c[2] * 0.15, c[1] + c[3] * 0.5], b = [c[0] + c[2] * 0.35, c[1] + c[3] * 0.7];
          await S.dragPts(a, b);
          if (vp.touch) await S.T.two([c[0] + c[2] * 0.3, c[1] + c[3] * 0.5], [c[0] + c[2] * 0.5, c[1] + c[3] * 0.5], [c[0] + c[2] * 0.2, c[1] + c[3] * 0.4], [c[0] + c[2] * 0.6, c[1] + c[3] * 0.6]);
          await S.settle();
          const v1 = await S.page.evaluate(() => PC.debug.view('site')), pg = await S.page.evaluate(() => ({ x: scrollX, y: scrollY, s: visualViewport.scale }));
          R.check(`${V} C preview locked: drag${vp.touch ? ' and pinch' : ''} change neither the view nor the state; page still`, eq(v0, v1) && eq(st0, await S.state()) && pg.x === 0 && pg.y === 0 && pg.s === 1 ? [] : [JSON.stringify([v0, v1, pg])]);
          if (!vp.touch) {
            await S.page.evaluate(() => { window.__wheel = null; addEventListener('wheel', (e) => { window.__wheel = e.defaultPrevented; }, { once: true }); });
            const col = await S.page.evaluate(() => { const side = document.querySelector('[data-stage="2"] .pc-qs__side'); return side ? [side.scrollTop, side.scrollHeight > side.clientHeight] : null; });
            await S.page.mouse.move(c[0] + c[2] / 2, c[1] + c[3] / 2); await S.page.mouse.wheel(0, 200); await S.settle();
            const after = await S.page.evaluate(() => ({ v: PC.debug.view('site'), p: window.__wheel, side: (document.querySelector('[data-stage="2"] .pc-qs__side') || {}).scrollTop }));
            R.check(`${V} C wheel over the preview: no zoom, event not consumed${col && col[1] ? ', side column scrolls' : ''}`, eq(after.v, v0) && after.p === false && (!(col && col[1]) || after.side > col[0]) ? [] : [JSON.stringify([after, col])]);
          }
          // Q6 hit radius: touch 22 px, mouse 10 px (inside the plot, off the side edge 1 = right edge)
          const [inR, outR] = vp.touch ? [18, 27] : [8, 13];
          await S.tapAt(await S.edgeMid(1, outR)); R.check(`${V} C tap ${outR} px from an edge does nothing`, (await S.ans()).streetEdge === st0.ans.streetEdge);
          await S.tapAt(await S.edgeMid(1, inR)); R.check(`${V} C tap ${inR} px from edge 2 makes it the street`, (await S.ans()).streetEdge === 1 ? [] : ['streetEdge ' + (await S.ans()).streetEdge]);
          await sync(S, 'C after edge tap'); await S.shot('C-sample-street-edge2');
          // Q5 readout on a slanted street (the angled 8.9 m edge = edge 4): whole degrees
          await S.act('q-street-next'); await S.act('q-street-next'); await S.act('q-north-cw'); await sync(S, 'C slanted street, one step clockwise');
          R.check(`${V} C Q5 readout on a slanted street is in whole degrees`, /^\d+° clockwise from the back$/.test(await S.text('q-north-value')) ? [] : [await S.text('q-north-value')]);
          // compass drag on a slanted street: arrow during the drag = stored value after release
          const d = await S.page.evaluate(() => PC.debug.siteDial()), s0 = await S.state(); let during = null;
          await S.dragPts([d.x, d.y - d.r + 4], [d.x - 25, d.y + 12], async () => { await S.settle(); during = await S.page.evaluate(() => PC.debug.siteNorth()); });
          const exp = northStored(s0, Math.atan2(-25, -12) * 180 / Math.PI), s1 = await S.state();
          R.check(`${V} C compass on a slanted street: stored ${exp} (15-degree step in W), arrow does not jump on release`, s1.ans.north === exp && Math.abs(during - lOf(s0, exp)) < 1e-6 ? [] : [`stored ${s1.ans.north}, during ${during}, mine ${lOf(s0, exp)}`]);
          await sync(S, 'C compass slanted');
          // collapse and expand keeps a correct drawing
          if (vp.touch && V === '360x640') { await S.act('site-preview-toggle'); await S.act('site-preview-toggle'); await sync(S, 'C preview collapsed and expanded'); }
        }
        await S.end(`${V} C ${name}`);
      }
    }
  }

  // ======================= D. Item 6: conflicts and warnings through the UI =======================
  if (want('D')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag;
    const blockedNext = async (L, blocked) => { const b = await S.bar(); R.check(`${V} D ${L}: Next ${blocked ? 'disabled' : 'enabled'}`, b.next === !blocked ? [] : [JSON.stringify(b)]); };
    let S = await kit(browser, vp, { max5: true });
    R.check(`${V} D sample: All clear, no rows`, (await S.text('sum-status')) === 'All clear' && (await S.rows()).length === 0); await blockedNext('sample', false);
    // level-over: footprint 10 % on the sample
    await S.slide('q-footprint', 10); { const s = await S.state(), ex = expectFor(s, {}), rows = await S.rows();
      const want2 = ['G', '1'].map((id) => `${LEVEL[id]}: needs ${fmtArea(Q.needed(s.ans, id), 'm')}, ${fmtArea(ex.fp.area, 'm')} available`);
      R.check(`${V} D level-over x2 with my numbers (${want2.join(' | ')}) and the raise-footprint advice`, rows.filter((r) => r.code === 'level-over').length === 2 && want2.every((w) => rows.some((r) => r.text.startsWith(w) && /footprint %/.test(r.text))) ? [] : [JSON.stringify(rows)]); }
    await sync(S, 'D level-over'); await blockedNext('level-over', true);
    if (vp.touch) { await S.act('summary-toggle'); await S.settle({ motion: true }); await S.shot('D-summary-level-over'); await S.layout(`${V} D summary open with conflicts`, { scope: '.pc-summary' }); await S.act('summary-toggle'); }
    await S.act('unit-ft'); { const s = await S.state(), ex = expectFor(s, {}), rows = await S.rows(); R.check(`${V} D level-over in ft: needs ${fmtArea(120, 'ft')}, ${fmtArea(ex.fp.area, 'ft')} available`, rows.some((r) => r.text.startsWith(`Ground floor: needs ${fmtArea(120, 'ft')}, ${fmtArea(ex.fp.area, 'ft')} available`)) && !rows.some((r) => / m²|\d m\b/.test(r.text)) ? [] : [JSON.stringify(rows)]); }
    await sync(S, 'D level-over ft'); await S.act('unit-m');
    await S.slide('q-footprint', 25); await blockedNext('level-over fixed live', false); R.check(`${V} D level-over clears live`, (await S.rows()).length === 0);
    // fp-veg-over + veg-reduced: 80 % + 30 %
    await S.slide('q-footprint', 80); await S.slide('q-veg', 30);
    { const rows = await S.rows(); R.check(`${V} D footprint 80 % + vegetation 30 %: the over-100 block names both numbers`, rows.some((r) => r.code === 'fp-veg-over' && /80/.test(r.text) && /30/.test(r.text) && /100/.test(r.text)) ? [] : [JSON.stringify(rows)]); }
    await sync(S, 'D fp-veg-over'); await blockedNext('fp-veg-over', true);
    { const s = await S.state(), ex = expectFor(s, (await S.page.evaluate(READ)).app); const rows = await S.rows(); const cl = rows.find((r) => r.code === 'fp-clamped');
      R.check(`${V} D 80 % on the sample: clamped warning with my effective area ${fmtArea(ex.fp.area, 'm')} and ${r1(ex.fp.pct)} %`, cl && cl.text.includes(fmtArea(ex.fp.area, 'm')) && cl.text.includes(r1(ex.fp.pct) + ' %') ? [] : [JSON.stringify(rows)]); }
    await S.slide('q-veg', 25); await S.slide('q-footprint', 25);
    // veg-reduced alone: vegetation 80 %
    await S.slide('q-veg', 70); { const s = await S.state(), P = await S.page.evaluate(READ), ex = expectFor(s, P.app), w = P.rows.find((r) => r.code === 'veg-reduced');
      R.check(`${V} D vegetation 70 % (25 + 70 under 100, but no room beside building, parking and pool): reduced to my ${fmtArea(ex.veg, 'm')} / ${r1(ex.vegPct)} % (warning, Next stays enabled)`, w && w.text.includes(fmtArea(ex.veg, 'm')) && w.text.includes(r1(ex.vegPct) + ' %') && !P.rows.some((r) => r.kind === 'block') ? [] : [JSON.stringify(P.rows)]); }
    await blockedNext('veg-reduced', false); await S.slide('q-veg', 25);
    // buildable-small: side setbacks of 10 m on a 20 m wide plot
    await S.type('q-setback-side', '10'); { const rows = await S.rows(); R.check(`${V} D side setbacks 10 m: buildable-small blocks (Q2)`, rows.some((r) => r.code === 'buildable-small') && !rows.some((r) => r.code === 'no-fit') ? [] : [JSON.stringify(rows)]); }
    await sync(S, 'D buildable-small'); await blockedNext('buildable-small', true);
    if (vp.touch) await S.act('summary-toggle');
    await S.openGroup('outdoor');
    await S.act('css:[data-pc="conflict-list"] > li[data-code="buildable-small"] [data-pc="conflict-goto"]');
    { const g = await S.page.evaluate(() => { const a = document.activeElement, blk = document.querySelector('[data-stage="2"] [data-q="2"]'), r = blk.getBoundingClientRect(); return { inQ: blk.contains(a), top: r.top, bottom: r.bottom, h: innerHeight, collapsed: document.querySelector('[data-pc="summary"]').classList.contains('is-collapsed') }; });
      R.check(`${V} D Fix on buildable-small: Site group, Q2 in view and a Q2 control focused${vp.touch ? ', sheet closed' : ''}`, (await S.group()) === 'site' && g.inQ && g.top >= 0 && g.top < g.h && (!vp.touch || g.collapsed) ? [] : [JSON.stringify(g)]); }
    await S.type('q-setback-side', '2'); await blockedNext('buildable-small fixed', false);
    // floor-empty / basement-empty through Q7
    await S.openGroup('building'); await S.act(lab('q-floors', '3'));
    { const rows = await S.rows(); R.check(`${V} D 3 floors: "Second floor has no rooms" blocks`, rows.some((r) => r.code === 'floor-empty' && r.text.startsWith('Second floor has no rooms')) ? [] : [JSON.stringify(rows)]); } await blockedNext('floor-empty', true); await sync(S, 'D floor-empty');
    if (vp.touch && !noShots) { await S.act('summary-toggle'); await S.settle({ motion: true }); await S.shot('D-summary-floor-empty'); await S.act('summary-toggle'); }
    await S.act(lab('q-floors', '2')); await blockedNext('floor-empty fixed', false);
    await S.act('q-basement'); { const rows = await S.rows(); R.check(`${V} D basement on: basement-empty blocks`, rows.some((r) => r.code === 'basement-empty') ? [] : [JSON.stringify(rows)]); } await blockedNext('basement-empty', true);
    await S.act('q-basement'); await blockedNext('basement-empty fixed', false);
    await S.end(`${V} D sample`);
    // parking-omitted (8 x 30 m plot, 4 cars) and pool-omitted (16 x 22 m plot, pool L), both units
    S = await kit(browser, vp, { max5: true, plot: [[0, 0], [8, 0], [8, 30], [0, 30]], ans: { setbacks: { front: 3, back: 2, side: 1 }, footprintPct: 20, vegPct: 0, floors: 1, rooms: [{ id: 'r1', type: 'storage', level: 'G', size: 'S', area: null, master: false }] } });
    await S.openGroup('outdoor'); for (let i = 0; i < 3; i++) await S.act('q-parking-cars-inc');
    { const rows = await S.rows(); R.check(`${V} D 4 cars on an 8 m wide plot: parking left out (warning, Q15)`, rows.some((r) => r.code === 'parking-omitted' && r.kind === 'warn') ? [] : [JSON.stringify(rows)]); } await sync(S, 'D parking-omitted');
    if (S.hasLayout) for (const u of ['m', 'ft']) { if ((await S.ans()).unit !== u) await S.act('unit-' + u); const w = (await S.rows()).find((r) => r.code === 'parking-omitted'); R.check(`${V} D parking-omitted (${u}) ends with a fix hint naming at least two answers (PM round 5)`, hintProblems('parking-omitted', w && w.text)); }
    if ((await S.ans()).unit !== 'm') await S.act('unit-m');
    await S.act('q-parking-cars-dec'); await S.act('q-parking-cars-dec'); await S.act('q-parking-cars-dec'); R.check(`${V} D 1 car: parking warning gone`, !(await S.rows()).some((r) => r.code === 'parking-omitted'));
    await S.end(`${V} D parking`);
    S = await kit(browser, vp, { max5: true, plot: [[0, 0], [16, 0], [16, 22], [0, 22]], ans: { footprintPct: 30, vegPct: 0, parking: { cars: 0, covered: false } } });
    await S.openGroup('outdoor'); await S.act('q-pool'); await S.act(lab('q-pool-size', 'L'));
    for (const u of ['m', 'ft']) { if (u === 'ft') await S.act('unit-ft'); const rows = await S.rows(); R.check(`${V} D pool L on 16 x 22 m: pool left out, clearance "${Q.fmtLen(1, u)}" (${u})`, rows.some((r) => r.code === 'pool-omitted' && r.text.includes(Q.fmtLen(1, u) + ' clearance')) ? [] : [JSON.stringify(rows)]); if (S.hasLayout) R.check(`${V} D pool-omitted (${u}) ends with a fix hint naming at least two answers (PM round 5)`, hintProblems('pool-omitted', (rows.find((r) => r.code === 'pool-omitted') || {}).text)); await sync(S, `D pool-omitted ${u}`); }
    // my own reasoning: S needs 5 x 8 m with its clearance; the back yard is under 5 m deep and the side yards 3.5 m wide, so S is left out too
    await S.act(lab('q-pool-size', 'S')); R.check(`${V} D pool S on 16 x 22 m: still left out (no 5 x 8 m spot)`, (await S.rows()).some((r) => r.code === 'pool-omitted'));
    await S.act('q-pool'); R.check(`${V} D pool off: warning gone`, !(await S.rows()).some((r) => r.code === 'pool-omitted'));
    await S.end(`${V} D pool`);
  }

  // ======================= E. Item 7: R5 with seeded valid plans =======================
  if (want('E')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag;
    let S = await kit(browser, vp, { max5: true }); await seedPlans(S); await sync(S, 'E seeded');
    const names = (t) => ['Ground floor', 'First floor'].every((n) => t.includes(n));
    // Q2 typed -> asks; Cancel button restores everything
    // Enter is the natural way to finish a number on a phone keyboard: the question must stay up for an answer
    let s0 = await S.state(); await S.type('q-setback-front', '4'); await S.settle();
    R.check(`${V} E Q2 typed 4 m + Enter: the R5 question stays open for an answer`, (await S.dialogOpen()) ? [] : [`no dialog after Enter; state ${(await S.ans()).setbacks.front} m, field "${(await S.page.evaluate(READ)).f['q-setback-front'].v}" (the same Enter press answered Cancel)`]);
    if (await S.dialogOpen()) { await S.act('dialog-cancel'); await S.waitDialog(false); }
    s0 = await S.state(); await S.typeAway('q-setback-front', '4'); await S.waitDialog();
    let d = await S.dialogText(); R.check(`${V} E Q2 4 m (size changes): R5 asks once, naming Ground and First floor`, d.title === 'Regenerate floor plans?' && names(d.text) ? [] : [JSON.stringify(d)]);
    await S.act('dialog-cancel'); await S.waitDialog(false); R.check(`${V} E Cancel: state identical, field shows 3.0 again`, eq(await S.state(), s0) && (await S.page.evaluate(READ)).f['q-setback-front'].v === '3.0'); await sync(S, 'E after Cancel (Q2)');
    // Esc
    await S.typeAway('q-setback-side', '6'); R.check(`${V} E side 6 m (my model: 8 x 16 m instead of 9.5 x 15 m): asks`, await S.waitDialog());
    await S.page.keyboard.press('Escape'); await S.waitDialog(false);
    R.check(`${V} E Esc cancels: state identical, side field back to 2.0`, eq(await S.state(), s0) && (await S.page.evaluate(READ)).f['q-setback-side'].v === '2.0'); await sync(S, 'E after Esc (Q2 side)');
    // Q3 slider: Cancel restores thumb, label, preview and summary
    await S.slide('q-footprint', 35); await S.waitDialog(); await S.act('dialog-cancel'); await S.waitDialog(false);
    R.check(`${V} E Q3 drag then Cancel: state identical`, eq(await S.state(), s0)); await sync(S, 'E after Cancel (Q3 slider)');
    // Q6 edge tap: Cancel
    await S.tapAt(await S.edgeMid(1)); await S.waitDialog(); await S.act('dialog-cancel'); await S.waitDialog(false);
    R.check(`${V} E Q6 edge tap then Cancel: state identical`, eq(await S.state(), s0)); await sync(S, 'E after Cancel (Q6 tap)');
    // move-only change (back 2 -> 2.25 m) and Q10 never ask
    await S.typeAway('q-setback-back', '2.25'); R.check(`${V} E back 2 -> 2.25 m (footprint only moves): no question, stored`, !(await S.dialogOpen()) && (await S.ans()).setbacks.back === 2.25);
    { const s = await S.state(); R.check(`${V} E ...and the plans stay valid`, ['G', '1'].every((id) => s.plans[id] && s.plans[id].sig === s0.plans[id].sig) && (await S.page.evaluate(() => ['G', '1'].every((id) => PC.debug.state().plans[id].sig === PC.sig.level(PC.debug.state(), id))))); }
    await S.openGroup('building'); await S.act(lab('q-exterior', 'grey')); R.check(`${V} E Q10 never asks`, !(await S.dialogOpen()) && (await S.ans()).exterior === 'grey');
    await S.openGroup('site');
    // the stepper asks exactly when my model says the size changes; Continue applies; later changes in the visit do not ask
    { const s = await S.state(), asks = sizeChanges(s, (a) => { a.setbacks.side = 2.5; }); await S.act('q-setback-side-inc'); await S.settle();
      R.check(`${V} E side 2 -> 2.5 m by the stepper: my model says the size ${asks ? 'changes, so R5 asks' : 'stays, so no question'}`, (await S.dialogOpen()) === asks);
      if (asks) { await S.act('dialog-ok'); await S.waitDialog(false); } }
    if ((await S.ans()).setbacks.side === 2.5) R.note(`${V} E side stepper went through R5 Continue`);
    s0 = await S.state(); await S.typeAway('q-setback-front', '4'); await S.settle();
    if (await S.dialogOpen()) { await S.act('dialog-ok'); await S.waitDialog(false); }
    R.check(`${V} E Continue: 4 m stored`, (await S.ans()).setbacks.front === 4); await sync(S, 'E after Continue');
    await S.typeAway('q-setback-side', '6'); await S.settle(); R.check(`${V} E second size change in the same visit (side 6 m): no question`, !(await S.dialogOpen()) && (await S.ans()).setbacks.side === 6);
    // a new visit asks again (stage 3 and back), with fresh valid plans
    await S.act('btn-next'); R.check(`${V} E Next to stage 3`, (await S.stages()) === '3' ? [] : [`stages ${await S.stages()}, bar ${JSON.stringify(await S.bar())}, rows ${JSON.stringify(await S.rows())}`]);
    await S.act('btn-back'); await seedPlans(S); await S.openGroup('site');
    { const s = await S.state(), asks = sizeChanges(s, (a) => { a.footprintPct = 10; }); await S.slide('q-footprint', 10); await S.settle();
      R.check(`${V} E new visit: Q3 25 -> 10 % ${asks ? 'asks again (my model: size changes)' : 'does not ask (my model: same size)'}`, (await S.dialogOpen()) === asks && asks); if (await S.dialogOpen()) { await S.act('dialog-ok'); await S.waitDialog(false); } }
    await S.end(`${V} E gate`);
    // Q7 own dialog: 2 -> 1 floor names Ground and First; Cancel keeps; Delete leaves a valid draft; never a second dialog
    S = await kit(browser, vp, { max5: true }); await seedPlans(S); await S.openGroup('building');
    await S.act(lab('q-floors', '1')); await S.waitDialog(); d = await S.dialogText(); s0 = await S.state();
    // my expectations (F2-S2, 4.1 limits, A-7): the First floor's 7 sample rooms cannot move to the Ground floor (7 + 7 > 8 rooms
    // per floor), so only Delete is possible; the plans lost or regenerated are the First floor (removed) and the Ground floor
    // (the stairs go with the only upper floor), i.e. exactly PC.store.affected of the delete result.
    { const a = s0.ans, g = a.rooms.filter((r) => r.level === 'G').length, f1 = a.rooms.filter((r) => r.level === '1').length, pr = [];
      if (d.title !== 'Remove First floor?' || d.ok !== 'Remove' || d.cancel !== 'Cancel') pr.push(`title/buttons ${d.title} / ${d.ok} / ${d.cancel}`);
      if (!d.rooms || !d.rooms.includes(`The First floor has ${f1} rooms.`)) pr.push('room sentence lacks the count: ' + d.rooms);
      if (g + f1 <= 8) pr.push(`test premise: ${g} + ${f1} rooms fit on one floor`);
      if (!(d.move && d.move.disabled && !d.move.checked && d.del && d.del.checked && !d.del.disabled)) pr.push('move should be disabled and delete chosen: ' + JSON.stringify([d.move, d.del]));
      if (!/cannot be moved/.test(d.rooms || '') || !/Ground floor/.test(d.rooms || '') || !/more than 8 rooms/.test(d.rooms || '')) pr.push('the room sentence does not say why moving is impossible (Ground floor over 8 rooms): ' + d.rooms);
      if (!(/Ground floor/.test(d.text) && /First floor/.test(d.text) && !/Basement|Second floor/.test(d.text))) pr.push('plans sentence must name exactly Ground and First floor: ' + d.text);
      if (/rooms/.test(d.text)) pr.push('room text leaked into the plans sentence: ' + d.text);
      R.check(`${V} E Q7 2 -> 1 floor (sample, valid plans): three-way dialog, ${f1} rooms, move refused (Ground floor would exceed 8), Ground and First plans named`, pr); }
    await S.act('dialog-cancel'); await S.waitDialog(false); R.check(`${V} E Cancel keeps the level and the radio`, eq(await S.state(), s0) && (await S.page.evaluate(READ)).radios['q-floors'] === '2'); await sync(S, 'E Q7 cancel');
    await S.act(lab('q-floors', '1')); await S.waitDialog(); await S.act('dialog-ok'); await S.waitDialog(false); await S.settle();
    { const s = await S.state(), open = await S.dialogOpen() || await S.until(() => S.dialogOpen(), 600); await S.flush(); const raw = JSON.parse(await S.raw()), ids = Q.levelIds(raw.ans || raw.state?.ans || s.ans);
      const pr = []; if (open) pr.push('a second dialog is open'); if (s.ans.floors !== 1) pr.push('floors ' + s.ans.floors); if (s.ans.rooms.some((r) => !ids.includes(r.level))) pr.push('room on a removed level'); if (Object.keys(s.plans).some((k) => !ids.includes(k))) pr.push('plan of a removed level');
      if (s.ans.pairs.some((p) => p.some((id) => !s.ans.rooms.find((r) => r.id === id)))) pr.push('pair with a deleted room');
      R.check(`${V} E Remove (delete chosen): one floor, first-floor rooms, pairs and plan gone, no second dialog`, pr); }
    await sync(S, 'E Q7 delete');
    // basement off on a one-floor house with a basement room: Basement and Ground named (the stairs go)
    await S.page.evaluate(() => PC.store.commit((s) => { s.ans.basement = true; s.ans.rooms.push({ id: 'r90', type: 'storage', level: 'B', size: 'S', area: null, master: false }); s.ans.nextRoomId = 91; }));
    await seedPlans(S); await S.act('q-basement'); await S.waitDialog(); d = await S.dialogText();
    // my expectations: 1 room on the Basement; the Ground floor has 7 after the delete above, 7 + 1 <= 8, so moving it there is
    // allowed (offered first); either way the Basement plan is lost and the Ground floor's regenerated (no stairs on a one-floor house).
    { const a = (await S.state()).ans, g = a.rooms.filter((r) => r.level === 'G').length, pr = [];
      if (!/^Remove Basement\?$/.test(d.title) || d.ok !== 'Remove') pr.push(`title/button ${d.title} / ${d.ok}`);
      if (!d.rooms || !d.rooms.includes('The Basement has 1 room.') || !/Ground floor/.test(d.rooms) || /cannot/.test(d.rooms)) pr.push('room sentence: ' + d.rooms);
      if (g + 1 > 8) pr.push('test premise: ground floor full');
      if (!(d.move && !d.move.disabled && d.move.checked)) pr.push('move should be possible and chosen: ' + JSON.stringify(d.move));
      if (!(/Basement/.test(d.text) && /Ground floor/.test(d.text) && !/First floor/.test(d.text))) pr.push('plans sentence must name the Basement and the Ground floor: ' + d.text);
      R.check(`${V} E basement off (one floor, 1 basement room): move to the Ground floor offered (${g} + 1 <= 8), Basement and Ground plans named`, pr);
      // switching to Delete still names the same plans (both remove the Basement and the stairs)
      await S.act('css:[data-pc="dialog-layer"] label:has([data-pc="level-remove-delete"])'); const d2 = await S.dialogText();
      R.check(`${V} E basement dialog, Delete chosen: still the Basement and Ground floor plans`, d2.del.checked && /Basement/.test(d2.text) && /Ground floor/.test(d2.text) ? [] : [JSON.stringify(d2)]); }
    await S.act('dialog-cancel'); await S.waitDialog(false); R.check(`${V} E Cancel keeps the basement`, (await S.ans()).basement === true && (await S.page.evaluate(READ)).sw['q-basement'] === true); await sync(S, 'E basement cancel');
    await S.end(`${V} E levels`);
  }

  // ======================= F. Items 2 and 8: groups, progress, defaults, persistence, riders =======================
  // A-16 trim (F4-T1 QA round): 768x1024 removed here. Twin: tests/e2e/questions.spec.mjs defaultsAndGroups at 768x1024
  // (groups, progress, defaults, Continue, persistence) and gateAndRiders at 768x1024 (Skip / snap riders), as named by
  // the F3-T3 trim. F keeps 360x640 and 1280x800.
  if (want('F')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag;
    let S = await kit(browser, vp, { plot: [[0, 0], [20, 0], [20, 20], [0, 20]] });
    R.check(`${V} F hand-made plot: no banner on stage 2`, (await S.banners()).length === 0);
    { const a = await S.ans(); R.check(`${V} F defaults of 4.1 on a hand-made plot`, eq([a.unit, a.setbacks, a.footprintPct, a.vegPct, a.north, a.floors, a.basement, a.usableRoof, a.ceilingH, a.roofType, a.exterior, a.parking, a.pool, a.extras], ['m', { front: 3, back: 2, side: 2 }, 30, 20, null, 2, false, false, 3, 'flat', 'sand', { cars: 1, covered: false }, { on: false, size: 'S' }, { wall: true, gate: 'centre', seating: false }])); }
    await sync(S, 'F defaults');
    const prog = async () => [await S.text('q-progress-text'), await S.page.evaluate(() => document.querySelector('[data-pc="q-progress-bar"]').value)];
    const P0 = await prog(); R.check(`${V} F progress at start: Group 1 of 4, 17 left, bar 0`, eq(P0, ['Group 1 of 4' + DOT + '17 questions left', 0]) ? [] : [JSON.stringify(P0)]);
    // own expectation: left = questions of the current group + groups never opened (6, 4, 4, 3)
    for (const [btn, g, left] of [['btn-q-continue-site', 2, 11], ['btn-q-continue-building', 3, 7], ['btn-q-continue-rooms', 4, 3], ['q-tab-site', 1, 6], ['q-tab-rooms', 3, 4]]) {
      await S.act(btn); const p = await prog(); R.check(`${V} F ${btn}: Group ${g} of 4, ${left} left, bar ${17 - left}`, eq(p, [`Group ${g} of 4${DOT}${left} question${left === 1 ? '' : 's'} left`, 17 - left]) ? [] : [JSON.stringify(p)]); }
    R.check(`${V} F every text input of stage 2 opens a numeric keypad`, await S.page.evaluate(() => [...document.querySelectorAll('[data-stage="2"] input[type="text"]')].filter((i) => i.getAttribute('inputmode') !== 'decimal').map((i) => i.dataset.pc)));
    // persistence: answers in several groups, through stage 1 and back, and through reload + Resume
    await S.openGroup('site'); await S.type('q-setback-front', '5'); await S.act('q-north-ccw'); await S.openGroup('building'); await S.act(lab('q-roof', 'terrace')); await S.openGroup('outdoor'); await S.act('q-seating');
    const keep = (await S.state()).ans;
    await S.act('step-1'); await S.act('btn-next'); R.check(`${V} F answers survive stage 1 and back`, eq((await S.state()).ans, keep)); await sync(S, 'F back from stage 1');
    await S.flush(); await S.reload(); await S.act('btn-resume'); if ((await S.stages()) !== '2') await S.act('btn-next');
    R.check(`${V} F answers survive reload + Resume`, eq((await S.state()).ans, keep)); await sync(S, 'F after Resume');
    await S.end(`${V} F groups`);
    // riders: unit by header and by Q1 keeps Skip on the sample; any other answer removes it; snap readout
    S = await kit(browser, vp);
    const skip = () => S.shown('btn-skip3d');
    R.check(`${V} F stage 2 Next on the valid sample: ${S.hasLayout ? 'enabled (stage 3 built)' : 'disabled (stage 3 not built yet)'}`, (await S.bar()).next === S.hasLayout ? [] : [JSON.stringify(await S.bar())]);
    await S.act('unit-ft'); await S.act(lab('q-unit', 'm')); R.check(`${V} F unit by header and by Q1 keeps the sample unmodified`, (await S.state()).sampleClean);
    await S.act('step-1'); R.check(`${V} F ...Skip still offered on stage 1`, await skip()); R.check(`${V} F plot readout "Snap 0.5 m" in m`, /Snap 0\.5 m/.test(await S.text('plot-grid')) ? [] : [await S.text('plot-grid')]);
    await S.act('unit-ft'); R.check(`${V} F plot readout "Snap 1 ft" in ft`, /Snap 1 ft/.test(await S.text('plot-grid')) ? [] : [await S.text('plot-grid')]);
    await S.act('btn-next'); await S.openGroup('building'); await S.act(lab('q-exterior', 'white'));
    await S.act('step-1'); R.check(`${V} F another answer (Q10) ends the unmodified sample: Skip gone`, !(await S.state()).sampleClean && !(await skip()));
    await S.end(`${V} F riders`);
  }

  // ======================= G. Item 9: layout of live states at every viewport, screenshots =======================
  if (want('G')) for (const vp of [PHONE, TAB, DESK, LAND]) {
    const V = vp.tag, S = await kit(browser, vp, { max5: true });
    // A-16 trim (F4-T1 QA round): the Site and Rooms groups of the sample in m are no longer judged here. Twins: f2-t3-site-rooms.mjs
    // M "sample street mode (m)" (Site group) and M "rooms sample" (Rooms group): the same sample, the same F1-T1 layout rules
    // (S.layout), at the same four viewports and inputs.
    for (const g of ['building', 'outdoor']) { await S.openGroup(g); await S.layout(`${V} G group ${g}`); await S.shot(`G-${g}-m`); }
    await S.act('unit-ft'); await S.openGroup('site'); await S.layout(`${V} G site in ft`); await S.shot('G-site-ft');
    await S.openGroup('building'); await S.act(lab('q-floors', '3')); await S.openGroup('site'); await S.slide('q-footprint', 10);
    const sheet = await S.page.evaluate(() => getComputedStyle(document.querySelector('[data-pc="summary-toggle"]')).cursor !== 'default' && document.querySelector('[data-pc="summary"]').classList.contains('is-collapsed'));
    if (sheet) await S.act('summary-toggle');
    await S.layout(`${V} G summary with conflicts (ft)`, { scope: sheet ? '.pc-summary' : null }); await S.shot('G-summary-conflicts-ft');
    if (sheet) await S.act('summary-toggle');
    await S.end(`${V} G`);
    // worst-case figures: 100 x 100 m plot in ft, basement + 3 floors, footprint 80 % (5- and 6-digit areas in every row)
    { const W = await kit(browser, vp, { max5: true, plot: [[0, 0], [100, 0], [100, 100], [0, 100]], ans: { unit: 'ft', footprintPct: 80, vegPct: 20, floors: 3, basement: true, setbacks: { front: 0, back: 0, side: 0 } } });
      const sh = await W.page.evaluate(() => getComputedStyle(document.querySelector('[data-pc="summary-toggle"]')).cursor !== 'default' && document.querySelector('[data-pc="summary"]').classList.contains('is-collapsed'));
      if (sh) await W.act('summary-toggle');
      await sync(W, 'G worst-case figures in ft'); await W.layout(`${V} G worst-case summary figures in ft (4 levels)`, { scope: sh ? '.pc-summary' : null }); await W.shot('G-summary-worst-ft');
      await W.end(`${V} G worst`); }
  }

  // ======================= K. Round 2: keyboard regression (Enter / Go in every number field), with and without plans ===
  if (want('K')) for (const vp of [PHONE, LAND, DESK]) {
    const V = vp.tag;
    const FIELDS = [['q-setback-front', 'site', (a) => a.setbacks.front], ['q-setback-back', 'site', (a) => a.setbacks.back], ['q-setback-side', 'site', (a) => a.setbacks.side], ['q-parking-cars', 'outdoor', (a) => a.parking.cars]];
    for (const plans of [false, true]) {
      const S = await kit(browser, vp, { max5: true }), P = plans ? 'plans' : 'no plans';
      if (plans) await seedPlans(S);
      // item 1: every number field takes a value finished with Enter (no plans: stored at once)
      if (!plans) for (const [h, g, rd] of FIELDS) { await S.openGroup(g); const v = h === 'q-parking-cars' ? '3' : '2.5'; await S.type(h, v);
        R.check(`${V} K ${P}: ${h} "${v}" + Enter stored, no dialog`, rd(await S.ans()) === Number(v) && !(await S.dialogOpen())); await sync(S, `K ${P} ${h} Enter`); }
      // item 3: bad text + Enter stays in the field, blocks, never opens a dialog; fixed by Enter again
      for (const [h, g, rd] of FIELDS) { await S.openGroup(g); const before = await S.state(); await S.type(h, h === 'q-parking-cars' ? '1.5' : '25');
        const R0 = await S.page.evaluate(READ); R.check(`${V} K ${P}: ${h} bad text + Enter: refused, marked, conflict row, no dialog, state unchanged`, eq(R0.state, before) && R0.f[h].inv === 'true' && R0.rows.some((r) => r.code === 'field-invalid') && !(await S.dialogOpen()) && !(await S.bar()).next ? [] : [JSON.stringify(R0.f[h]), String(await S.dialogOpen())]);
        await S.type(h, String(rd(before.ans) * (h === 'q-parking-cars' ? 1 : 1))); R.check(`${V} K ${P}: ${h} valid text + Enter clears the conflict, no dialog (same value)`, !(await S.page.evaluate(READ)).rows.some((r) => r.code === 'field-invalid') && !(await S.dialogOpen())); await sync(S, `K ${P} ${h} fixed`); }
      // item 6: a conflict reached and cleared with Enter only
      await S.openGroup('site');
      if (!plans) { await S.type('q-setback-side', '10'); R.check(`${V} K ${P}: side 10 + Enter -> buildable-small, Next disabled`, (await S.rows()).some((r) => r.code === 'buildable-small') && !(await S.bar()).next);
        await S.type('q-setback-side', '2'); R.check(`${V} K ${P}: side 2 + Enter clears it, Next enabled`, (await S.rows()).length === 0 && (await S.bar()).next); await sync(S, `K ${P} conflict cleared`); }
      // item 7: with plans, Enter on a size-changing value leaves the question up; Esc cancels; Enter on Continue applies
      if (plans) {
        for (const [h, v] of [['q-setback-front', '4'], ['q-setback-side', '6']]) {
          const s0 = await S.state(), asks = sizeChanges(s0, (a) => { a.setbacks[h.slice(10)] = Number(v); });
          await S.type(h, v); await S.settle();
          R.check(`${V} K plans: ${h} "${v}" + Enter: the R5 question ${asks ? 'stays open for an answer' : 'does not appear (same size)'}`, (await S.dialogOpen()) === asks ? [] : [`dialog ${await S.dialogOpen()}, stored ${(await S.ans()).setbacks[h.slice(10)]}`]);
          if (asks && await S.dialogOpen()) { R.check(`${V} K plans: ${h}: nothing stored while the question is open`, eq(await S.state(), s0)); await S.page.keyboard.press('Escape'); await S.waitDialog(false);
            R.check(`${V} K plans: ${h}: Esc cancels, state identical`, eq(await S.state(), s0)); await sync(S, `K plans ${h} Esc`); }
        }
        // move-only and cars: Enter stores, never asks
        await S.type('q-setback-back', '2.25'); R.check(`${V} K plans: back 2.25 + Enter (move only): stored, no question`, (await S.ans()).setbacks.back === 2.25 && !(await S.dialogOpen()));
        await S.openGroup('outdoor'); await S.type('q-parking-cars', '3'); R.check(`${V} K plans: cars 3 + Enter: stored, no question`, (await S.ans()).parking.cars === 3 && !(await S.dialogOpen()));
        await S.openGroup('site'); const s0 = await S.state(); await S.type('q-setback-front', '4'); await S.waitDialog();
        // answer with the keyboard: focus is on Cancel; Tab to Continue, Enter
        const foc = await S.focus(); await S.page.keyboard.press(foc === 'dialog-cancel' ? 'Tab' : 'Shift+Tab'); const foc2 = await S.focus(); await S.page.keyboard.press('Enter'); await S.waitDialog(false); await S.settle();
        R.check(`${V} K plans: Enter, then Tab + Enter on Continue: 4 m stored (focus ${foc} -> ${foc2})`, (await S.ans()).setbacks.front === 4 && foc2 === 'dialog-ok' && !eq(await S.state(), s0)); await sync(S, 'K plans continued');
      }
      await S.end(`${V} K ${P}`);
    }
  }
} finally { await browser.close(); }
R.note(`runtime ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
