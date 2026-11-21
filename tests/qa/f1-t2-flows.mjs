// F1-T2 QA: shell behaviour (F1-S4, F1-S5, R1, R3, G5) driven through the real UI in headless Chrome.
// Run: node tests/qa/f1-t2-flows.mjs [--no-shots] [--only=360x640]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VIEWPORTS, launch, collector, STORAGE_MODES } from './lib.mjs';
import { sessions, PAGE, sleep, eq, sel, sampleProblems, defaultProblems } from './session.mjs';

const SHOTS = join(ROOT, 'tests/qa/shots/F1-T2'); mkdirSync(SHOTS, { recursive: true });
const noShots = process.argv.includes('--no-shots');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const R = collector('F1-T2 flows');
// (F1-T2 bugs 1 and 2 were listed here as known; fixed in F1-T3 and re-tested on 2026-11-20, entries removed.)
// A-16 trim (F3-T3 first item, docs/03-tasks/F3-T3/qa-trim.md): sections A-H run at 360x640 touch and 1280x800 mouse.
// Their 768x1024 twin is tests/e2e/shell.spec.mjs, which runs gating (A-D: fresh load, locked steps, sample, Next / Back,
// gating table), skipAndEdit (E), drafts (F, G: autosave, Resume, Start new, sample over a draft) and focusAndTaps (H:
// keyboard) at 768x1024 touch; the same behaviours by touch stay here at 360x640.
const MAIN = VIEWPORTS.filter((v) => !['640x360', '768x1024'].includes(v.tag) && (!only || v.tag === only)); // 360x640 touch, 1280x800 mouse
const LAND = VIEWPORTS.find((v) => v.tag === '640x360');

const session = sessions({ R, shots: SHOTS, noShots });

const NEXT = { 1: 'Next: Questions', 2: 'Next: Floor plans', 3: 'Next: Interior', 4: 'Build 3D model' };
// F3-T1 (marker PC.layout, read per session into PAGE.layout): stage 3 is built (MAX_BUILT 3), the sample loads with one
// generated Draft plan per level, Skip lands on stage 3 with every level approved. Without the marker: round-3 expectations.
const L3 = () => PAGE.layout;
// F3-T2 (marker PC.stages.MAX_BUILT >= 5): stages 4-5 open after approvals, stage 4 has a controller, Skip lands on stage 5.
const L5 = () => PAGE.editor;
const SKIP_TO = () => (L5() ? 5 : L3() ? 3 : 2);
const noPlans = (st) => ({ ...st, plans: {} });
// One valid generated plan per plan level: signature equal to the level's own (checked in the page), not approved.
const planProblems = (s, approved) => s.page.evaluate((approved) => { const st = PC.debug.state(), f = [], ids = PC.levels.ids(st); if (Object.keys(st.plans).sort().join() !== ids.slice().sort().join()) f.push('plans for ' + Object.keys(st.plans) + ', levels ' + ids);
  for (const id of ids) { const p = st.plans[id]; if (!p) continue; if (p.sig !== PC.sig.level(st, id)) f.push(id + ': stale signature'); if (p.approved !== approved) f.push(id + ': approved ' + p.approved); if (p.error) f.push(id + ': error ' + p.error); if (!p.rooms || p.rooms.length !== st.ans.rooms.filter((r) => r.level === id).length) f.push(id + ': ' + (p.rooms || []).length + ' placed rooms'); }
  return f; }, approved);

const browser = await launch();
try {
  for (const vp of MAIN) {
    const V = vp.tag;

    // ============ A. fresh load ============
    { const s = await session(browser, vp);
      R.check(`${V} A fresh: state is the 4.1 defaults`, defaultProblems(await s.state()));
      R.check(`${V} A fresh: only stage 1 shown`, (await s.stages()) === '1');
      R.check(`${V} A fresh: stepper = current + 4 locked`, (await s.steps()) === 'CLLLL' ? [] : [await s.steps()]);
      const pr = []; for (let n = 2; n <= 5; n++) { const st = await s.step(n); if (st.ariaDis !== 'true' || st.disabled || st.pe === 'none') pr.push(`step ${n}: aria-disabled=${st.ariaDis} disabled=${st.disabled} pointer-events=${st.pe}`); if (st.title !== 'Draw and close the plot first') pr.push(`step ${n} title "${st.title}"`); }
      const s1 = await s.step(1); if (s1.ariaCur !== 'step' || s1.ariaDis) pr.push('step 1 aria ' + JSON.stringify(s1));
      R.check(`${V} A fresh: locked steps are aria-disabled, tappable and carry the reason`, pr);
      const bar = await s.bar(); R.check(`${V} A fresh: Back and Next disabled, label "Next: Questions"`, !bar.back && !bar.next && !bar.nextHidden && bar.label === NEXT[1] ? [] : [JSON.stringify(bar)]);
      const vis = {}; for (const h of ['start-panel', 'btn-sample', 'resume-box', 'note-nosave', 'sample-strip', 'btn-skip3d']) vis[h] = await s.shown(h);
      R.check(`${V} A fresh: start panel with sample button; no resume box, no-save note or strip`, eq(vis, { 'start-panel': true, 'btn-sample': true, 'resume-box': false, 'note-nosave': false, 'sample-strip': false, 'btn-skip3d': false }) ? [] : [JSON.stringify(vis)]);
      R.check(`${V} A fresh: no draft key, toast, banner or dialog`, (await s.raw()) === null && !(await s.toasts()).length && !(await s.banners()).length && !(await s.dialogOpen()) ? [] : [`raw=${await s.raw()} toasts=${await s.toasts()} banners=${await s.banners()}`]);
      await s.layout(`${V} A fresh`);
      // an empty project is never saved, even after a change
      await s.act('unit-ft'); await s.flush(); /* run the debounced autosave now instead of waiting for its 400 ms timer */
      R.check(`${V} A unit toggle on an empty project: state changes, radio follows, nothing saved`, (await s.state()).ans.unit === 'ft' && (await s.page.isChecked(sel('unit-ft'))) && (await s.raw()) === null ? [] : [`unit=${(await s.state()).ans.unit} raw=${await s.raw()}`]);
      await s.reload(); R.check(`${V} A reload of an empty project: clean start, no resume box`, !(await s.shown('resume-box')) && (await s.stages()) === '1');
      await s.end(`${V} A`); }

    // ============ B. locked steps explain themselves; Next disabled does nothing ============
    { const s = await session(browser, vp);
      for (const n of [2, 3, 4, 5]) {
        await s.act('step-' + n); await s.settle();
        R.check(`${V} B tap locked step ${n}: stays on stage 1, toast says why`, (await s.state()).stage === 1 && (await s.stages()) === '1' && eq(await s.toasts(), ['Draw and close the plot first']) ? [] : [`stage=${(await s.state()).stage} toasts=${JSON.stringify(await s.toasts())}`]);
      }
      R.check(`${V} B toast: visible, inside viewport, above the action bar, region is a polite live region`, await s.page.evaluate(() => { const f = [], t = document.querySelector('[data-pc="toast-region"] .pc-toast'), reg = document.querySelector('[data-pc="toast-region"]'); if (!t) return ['no toast element']; const r = t.getBoundingClientRect(), bar = document.querySelector('.pc-bar').getBoundingClientRect(); if (r.width < 40 || r.height < 20) f.push('toast not rendered'); if (r.left < 0 || r.right > innerWidth || r.top < 0) f.push('toast outside viewport'); if (r.bottom > bar.top + 1) f.push(`toast overlaps the action bar (${r.bottom} > ${bar.top})`); if (reg.getAttribute('aria-live') !== 'polite' && reg.getAttribute('role') !== 'status') f.push('toast region not live'); for (const h of ['btn-back', 'btn-next']) { const b = document.querySelector(`[data-pc="${h}"]`).getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); if (!hit || !hit.closest(`[data-pc="${h}"]`)) f.push(h + ' covered by toast'); } return f; }));
      await s.layout(`${V} B toast shown`); await s.shot('B-locked-toast');
      R.check(`${V} B toast disappears by itself (3.5 s timer)`, (await s.until(async () => (await s.toasts()).length === 0, 8000)) ? [] : [JSON.stringify(await s.toasts())]);
      // disabled Next: a forced activation must not navigate
      await s.page.evaluate(() => document.querySelector('[data-pc="btn-next"]').click()); await s.page.dispatchEvent(sel('btn-next'), 'click');
      R.check(`${V} B disabled Next cannot be activated`, (await s.state()).stage === 1);
      // keyboard on a locked step
      await s.page.focus(sel('step-3')); await s.page.keyboard.press('Enter'); await s.settle(); const t1 = await s.toasts(); await s.until(async () => (await s.toasts()).length === 0, 8000); await s.page.keyboard.press('Space'); await s.settle(); const t2 = await s.toasts();
      R.check(`${V} B Enter and Space on a focused locked step give the reason`, eq(t1, ['Draw and close the plot first']) && eq(t2, ['Draw and close the plot first']) && (await s.state()).stage === 1 ? [] : [JSON.stringify([t1, t2])]);
      await s.end(`${V} B`); }

    // ============ C. sample: one tap; Next / Back / step navigation loses nothing ============
    { const s = await session(browser, vp);
      await s.act('btn-sample'); await s.settle();
      R.check(`${V} C sample loads with one tap and no confirmation on an empty project`, !(await s.dialogOpen()));
      const st0 = await s.state();
      R.check(`${V} C sample equals PM 6.2 (plot, answers, rooms, pairs, outdoor, interior)`, sampleProblems(st0));
      R.check(`${V} C sample: stage 1, sampleClean`, st0.stage === 1 && st0.sampleClean === true ? [] : [`stage ${st0.stage} clean ${st0.sampleClean}`]);
      R.check(`${V} C sample: strip + Skip shown, start panel hidden`, (await s.shown('sample-strip')) && (await s.shown('btn-skip3d')) && !(await s.shown('start-panel')));
      if (L3()) R.check(`${V} C sample (F3-T1): one valid Draft plan per level, generated at load`, await planProblems(s, false));
      R.check(`${V} C sample: stepper current / available / ${L3() ? 'available (stage 3 built) / locked x2' : 'locked x3'}`, (await s.steps()) === (L3() ? 'CaaLL' : 'CaLLL') ? [] : [await s.steps()]);
      let bar = await s.bar(); R.check(`${V} C sample: Next enabled`, bar.next && !bar.back && bar.label === NEXT[1] ? [] : [JSON.stringify(bar)]);
      await s.layout(`${V} C sample on stage 1`); await s.shot('C-sample-stage1');
      await s.act('step-3'); await s.settle();
      if (L3()) { R.check(`${V} C tap step 3 with stages 1-2 valid (F3-T1): stage 3 opens, no "not built yet" notice, plans unchanged`, (await s.state()).stage === 3 && (await s.stages()) === '3' && !(await s.banners()).length && eq(noPlans({ ...(await s.state()), stage: 1 }), noPlans(st0)) ? [] : [`stage ${(await s.state()).stage}`, JSON.stringify(await s.banners())]);
        await s.act('step-1'); await s.settle(); }
      else R.check(`${V} C tap step 3 with stages 1-2 valid: locked with the interim build reason`, eq(await s.toasts(), ['Not available in this build yet']) && (await s.state()).stage === 1 ? [] : [JSON.stringify(await s.toasts())]);
      await s.act('step-5'); await s.settle();
      R.check(`${V} C tap step 5: reason of the first invalid earlier stage`, (await s.toasts()).includes('Approve all floors first') && (await s.state()).stage === 1 ? [] : [JSON.stringify(await s.toasts())]);
      await s.act('btn-next'); await s.settle();
      const st2 = await s.state();
      R.check(`${V} C Next: stage 2 only, everything else unchanged`, (await s.stages()) === '2' && eq(noPlans({ ...st2, stage: 1 }), noPlans(st0)) && (!L3() || eq(st2.plans, st0.plans)) ? [] : [`stages ${await s.stages()}`]);
      R.check(`${V} C stage 2: strip hidden, stepper done/current/locked`, !(await s.shown('sample-strip')) && (await s.steps()) === (L3() ? 'DCaLL' : 'DCLLL') ? [] : [`strip ${await s.shown('sample-strip')} steps ${await s.steps()}`]);
      bar = await s.bar(); R.check(`${V} C stage 2: Back enabled, Next "Next: Floor plans" ${L3() ? 'enabled (stage 3 built)' : 'disabled (stage 3 not built)'}`, bar.back && bar.next === L3() && bar.label === NEXT[2] ? [] : [JSON.stringify(bar)]);
      R.check(`${V} C stage 2 has its controller since F2-T2: no "not built yet" notice there`, (await s.banners()).length === 0 ? [] : [JSON.stringify(await s.banners())]);
      await s.layout(`${V} C stage 2 with banner`); await s.shot('C-stage2');
      await s.act('btn-back'); await s.settle();
      R.check(`${V} C Back: stage 1, state identical to before, strip back, banner gone`, eq(await s.state(), st0) && (await s.stages()) === '1' && (await s.shown('sample-strip')) && !(await s.banners()).length ? [] : ['state differs or UI wrong']);
      R.check(`${V} C visited valid stage 2 now reads as done`, (await s.steps()) === (L3() ? 'CDDLL' : 'CDLLL') || (L3() && (await s.steps()) === 'CDaLL') ? [] : [await s.steps()]);
      for (let i = 0; i < 3; i++) { await s.act('step-2'); await s.act('step-1'); }
      R.check(`${V} C stepper navigation back and forth x3 loses nothing`, eq(await s.state(), st0));
      await s.act('step-1'); await s.until(async () => (await s.toasts()).length === 0, 8000); await s.act('step-1'); await s.settle(); R.check(`${V} C tapping the current step does nothing (no navigation, no toast)`, eq(await s.state(), st0) && !(await s.toasts()).length ? [] : [JSON.stringify(await s.toasts())]);
      await s.end(`${V} C`); }

    // ============ D. full gating table with all five stages opened by the test (MAX_BUILT is 2 in this build) ============
    { const s = await session(browser, vp);
      await s.act('btn-sample');
      // Seeded plans carry the real level signature (PC.sig.level): since F2-T1 a plan with any other sig is stale and can
      // never make stage 3 valid. (Edit made by FS in F2-T1, reviewed and confirmed by QA on 2026-11-20: it changes only how
      // the test seeds plans, not what is asserted. tests/qa/ changes go through QA from now on.)
      const plan = (approved) => ({ sig: 'qa', rooms: [], unmet: [], edited: false, approved, error: null });
      await s.page.evaluate((p) => { PC.stages.MAX_BUILT = 5; PC.store.commit((st) => { st.plans = { G: { ...p, sig: PC.sig.level(st, 'G') }, 1: { ...p, sig: PC.sig.level(st, '1') } }; }, { nav: true }); }, plan(false));
      R.check(`${V} D plans unapproved: 1-3 open, 4-5 locked`, (await s.steps()) === 'CaaLL' ? [] : [await s.steps()]);
      await s.act('step-4'); await s.settle(); R.check(`${V} D locked step 4 says "Approve all floors first"`, eq(await s.toasts(), ['Approve all floors first']) && (await s.step(4)).title === 'Approve all floors first' ? [] : [JSON.stringify(await s.toasts())]);
      await s.act('btn-next'); await s.act('btn-next'); await s.settle();
      let bar = await s.bar(); R.check(`${V} D stage 3: label "Next: Interior", Next disabled until floors approved, strip shown`, (await s.stages()) === '3' && bar.label === NEXT[3] && !bar.next && (await s.shown('sample-strip')) ? [] : [JSON.stringify(bar) + ' stages ' + await s.stages()]);
      R.check(`${V} D stage 3 ${L3() ? 'has its controller (F3-T1): no' : 'has no controller yet: the'} "not built yet" notice${L3() ? '' : ' is shown (TL condition 1)'}`, eq(await s.banners(), L3() ? [] : ['This stage is not built yet: static preview']) ? [] : [JSON.stringify(await s.banners())]);
      await s.page.evaluate((p) => PC.store.commit((st) => { st.plans.G = { ...p, sig: PC.sig.level(st, 'G') }; }, { nav: true }), plan(true));
      R.check(`${V} D one of two floors approved: Next still disabled`, !(await s.bar()).next);
      await s.page.evaluate((p) => PC.store.commit((st) => { st.plans['1'] = { ...p, sig: PC.sig.level(st, '1') }; }, { nav: true }), plan(true));
      R.check(`${V} D all floors approved: Next enabled, steps 4-5 open`, (await s.bar()).next && (await s.steps()) === 'DDCaa' ? [] : [await s.steps()]);
      await s.act('btn-next'); await s.settle(); bar = await s.bar();
      R.check(`${V} D stage 4: label "Build 3D model", strip shown`, (await s.stages()) === '4' && bar.label === NEXT[4] && bar.next && (await s.shown('sample-strip')) ? [] : [JSON.stringify(bar)]);
      R.check(`${V} D stage 4 ${L5() ? 'has its controller (F3-T2): no notice' : '(no controller): notice shown, exactly once'}`, eq(await s.banners(), L5() ? [] : ['This stage is not built yet: static preview']) ? [] : [JSON.stringify(await s.banners())]);
      await s.layout(`${V} D stage 4 with strip`);
      await s.act('btn-next'); await s.settle(); bar = await s.bar();
      R.check(`${V} D stage 5: Next hidden, Back enabled, strip hidden, steps 1-4 done`, (await s.stages()) === '5' && bar.nextHidden && bar.back && !(await s.shown('sample-strip')) && (await s.steps()) === 'DDDDC' ? [] : [JSON.stringify(bar) + await s.steps()]);
      R.check(`${V} D stage 5 (no controller): notice shown`, eq(await s.banners(), ['This stage is not built yet: static preview']) ? [] : [JSON.stringify(await s.banners())]);
      await s.layout(`${V} D stage 5`);
      await s.act('btn-back'); await s.settle(); R.check(`${V} D Back from stage 5 opens stage 4`, (await s.stages()) === '4' && (await s.state()).stage === 4);
      await s.act('btn-back'); await s.act('btn-back'); await s.settle();
      R.check(`${V} D back on stage 2: strip hidden (strip is for stages 1, 3, 4 only)`, (await s.stages()) === '2' && !(await s.shown('sample-strip')));
      R.check(`${V} D back on stage 2 (has a controller): the notice is gone again`, (await s.banners()).length === 0 ? [] : [JSON.stringify(await s.banners())]);
      R.check(`${V} D navigation kept sampleClean`, (await s.state()).sampleClean === true);
      // a plan with an error blocks stage 4 again and the app leaves the now-locked stage only by user action
      await s.page.evaluate(() => PC.store.commit((st) => { st.plans.G.error = 'no-layout'; }, { nav: true }));
      R.check(`${V} D floor with a layout error locks stages 4-5`, (await s.steps()) === 'DCaLL' ? [] : [await s.steps()]);
      await s.end(`${V} D`); }

    // ============ E. Skip to 3D and "unmodified sample" ============
    { const s = await session(browser, vp);
      await s.act('btn-sample'); const st0 = await s.state();
      R.check(`${V} E exactly one Skip button in the document`, (await s.page.locator(sel('btn-skip3d')).count()) === 1);
      await s.act('btn-skip3d'); await s.settle(); let st = await s.state();
      R.check(`${V} E Skip (this build): lands on stage ${SKIP_TO()} = highest built stage${L3() ? ', every level approved' : ''}, sample still unmodified`, st.stage === SKIP_TO() && st.sampleClean && eq(noPlans({ ...st, stage: 1 }), noPlans(st0)) ? [] : [`stage ${st.stage} clean ${st.sampleClean}`]);
      if (L3()) R.check(`${V} E Skip (F3-T1): one valid plan per level, all approved`, await planProblems(s, true));
      if (L3()) await s.act('step-2');   // from the stage Skip opened back to stage 2 (the next Back goes to 1)
      await s.act('btn-back'); R.check(`${V} E back on stage 1 the strip is still offered`, await s.shown('sample-strip'));
      await s.act('unit-m'); R.check(`${V} E re-selecting the current unit is not a change`, (await s.state()).sampleClean && (await s.shown('sample-strip')));
      await s.act('unit-ft'); await s.settle(); st = await s.state();
      // F1-S5 as amended in PM round 3: the unit (header toggle or Q1) is display only and keeps the sample unmodified;
      // every other change ends it for good.
      R.check(`${V} E unit toggle (header): sample stays unmodified, strip and Skip stay, only the unit changed`, st.sampleClean === true && st.ans.unit === 'ft' && (await s.shown('sample-strip')) && (await s.shown('btn-skip3d')) && eq(noPlans({ ...st, ans: { ...st.ans, unit: 'm' } }), noPlans(st0)) ? [] : [`clean ${st.sampleClean} unit ${st.ans.unit}`]);
      await s.act('btn-next'); await s.settle();
      { const q1 = `[data-pc="q-unit"] input[value="m"]`, box = await s.page.evaluate((q) => { const el = document.querySelector(q), lab = el.closest('label') || el; lab.scrollIntoView({ block: 'center' }); const r = lab.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, q1); if (vp.touch) await s.page.touchscreen.tap(box[0], box[1]); else await s.page.mouse.click(box[0], box[1]); await s.settle(); }
      st = await s.state(); R.check(`${V} E unit changed back through Q1 on stage 2: same setting as the header, sample still unmodified`, st.ans.unit === 'm' && st.sampleClean === true && (await s.page.isChecked(sel('unit-m'))) && eq(noPlans({ ...st, stage: 1 }), noPlans(st0)) ? [] : [`unit ${st.ans.unit} clean ${st.sampleClean}`]);
      await s.act('btn-back'); await s.act('unit-ft'); R.check(`${V} E back on stage 1 the strip is still offered after two unit changes`, (await s.shown('sample-strip')) && (await s.shown('btn-skip3d')));
      await s.waitDraft((d) => d && d.state.ans.unit === 'ft' && d.state.sampleClean === true); await s.reload(); await s.act('btn-resume');
      R.check(`${V} E unit change survives reload + Resume with the sample still unmodified (Skip offered)`, (await s.state()).ans.unit === 'ft' && (await s.state()).sampleClean && (await s.shown('sample-strip')));
      // a real modification: Undo reopens the plot. That must end "unmodified", and nothing brings it back.
      // F3-T1: Skip approved every level, so this outline change asks R5 (Continue): approved plans are really reset
      const answerR5 = async (label) => { if (!L3()) return; const open = await s.until(() => s.dialogOpen(), 1500); R.check(`${V} E ${label} with approved plans (after Skip): the R5 question is asked`, !!open && /Regenerate floor plans/.test(await s.text('dialog-title'))); if (open) { await s.act('dialog-ok'); await s.settle(); } };
      await s.act('btn-undo'); await answerR5('Undo'); st = await s.state();
      R.check(`${V} E a real change (Undo reopens the plot) ends the unmodified sample: strip and Skip gone`, st.sampleClean === false && !st.plot.closed && !(await s.shown('sample-strip')) && !(await s.shown('btn-skip3d')) ? [] : [`clean ${st.sampleClean}`]);
      await s.act('btn-close-shape'); st = await s.state();
      R.check(`${V} E restoring the same outline does not bring Skip back`, st.plot.closed && eq(st.plot.pts, st0.plot.pts) && st.sampleClean === false && !(await s.shown('sample-strip')) ? [] : [`clean ${st.sampleClean}`]);
      await s.act('unit-m'); await s.act('unit-ft'); await s.act('unit-m'); R.check(`${V} E unit changes after a real change do not bring Skip back`, !(await s.state()).sampleClean && !(await s.shown('sample-strip')));
      await s.act('btn-next'); await s.act('btn-back'); R.check(`${V} E still gone after navigating`, !(await s.shown('sample-strip')));
      await s.waitDraft((d) => d && d.state.sampleClean === false && d.state.plot.closed); await s.reload(); await s.act('btn-resume'); await s.settle();
      R.check(`${V} E still gone after reload + Resume`, !(await s.state()).sampleClean && !(await s.shown('sample-strip')));
      // store level: any non-navigation commit ends it; navigation and the unit option do not
      await s.reload(); await s.act('btn-startnew'); await s.act('dialog-ok'); await s.act('btn-sample');
      R.check(`${V} E store rule: nav commit and unit commit keep the flag, every other answer ends it`, await s.page.evaluate(() => { const f = [], S = PC.store, fresh = () => S.replace(PC.sample.state()); fresh(); S.commit((d) => { d.stage = 2; }, { nav: true }); if (!S.get().sampleClean) f.push('nav commit ended it'); S.commit((d) => { d.ans.unit = 'ft'; }, { keepSample: true }); if (!S.get().sampleClean) f.push('unit commit ended it');
        const changes = { vegPct: (d) => { d.ans.vegPct = 30; }, north: (d) => { d.ans.north = 90; }, ceiling: (d) => { d.ans.ceilingH = 3.3; }, roof: (d) => { d.ans.roofType = 'terrace'; }, exterior: (d) => { d.ans.exterior = 'white'; }, cars: (d) => { d.ans.parking.cars = 1; }, pool: (d) => { d.ans.pool.on = false; }, wall: (d) => { d.ans.extras.wall = false; }, interior: (d) => { d.ans.interior.style = 'classic'; }, footprint: (d) => { d.ans.footprintPct = 30; }, setback: (d) => { d.ans.setbacks.front = 4; }, room: (d) => { d.ans.rooms[0].size = 'M'; }, vertex: (d) => { d.plot.pts[2] = [20, 31]; } };
        for (const k in changes) { fresh(); S.commit(changes[k]); if (S.get().sampleClean) f.push(k + ' kept the flag'); } fresh(); return f; }));
      await s.end(`${V} E`); }
    { // Skip with all stages open and plans present approves every level and reaches stage 5
      const s = await session(browser, vp); await s.act('btn-sample');
      await s.page.evaluate(() => { PC.stages.MAX_BUILT = 5; const p = { sig: 'qa', rooms: [], unmet: [], edited: false, approved: false, error: null }; PC.store.commit((st) => { st.plans = { G: { ...p, sig: PC.sig.level(st, 'G') }, 1: { ...p, sig: PC.sig.level(st, '1') } }; }, { nav: true }); });
      await s.act('btn-skip3d'); await s.settle(); const st = await s.state();
      R.check(`${V} E Skip with plans: approves all levels, opens stage 5, sample stays unmodified`, st.stage === 5 && st.plans.G.approved && st.plans['1'].approved && st.sampleClean && (await s.stages()) === '5' ? [] : [`stage ${st.stage}`]);
      await s.end(`${V} E2`); }

    // ============ F. draft autosave, resume, start new ============
    { const s = await session(browser, vp);
      await s.act('btn-sample');
      R.check(`${V} F draft written automatically after loading the sample`, await s.waitDraft((d) => d && d.state && d.state.plot.pts.length === 5));
      const w = JSON.parse(await s.raw()), stA = await s.state();
      R.check(`${V} F draft wrapper {v:${PAGE.V}, savedAt, state} holds the exact state (key ${PAGE.KEY})`, w.v === PAGE.V && w.state.v === PAGE.V && typeof w.savedAt === 'number' && Math.abs(w.savedAt - Date.now()) < 60000 && eq(w.state, stA) && eq(Object.keys(w).sort(), ['savedAt', 'state', 'v']) ? [] : ['wrapper ' + Object.keys(w)]);
      await s.act('btn-next'); R.check(`${V} F current stage is saved too`, await s.waitDraft((d) => d && d.state.stage === 2));
      // F3-T1: mark the Ground floor plan approved and edited (signature unchanged); Resume must keep it, not regenerate it
      if (L3()) { await s.page.evaluate(() => PC.store.commit((st) => { if (st.plans.G) { st.plans.G.approved = true; st.plans.G.edited = true; } }, { nav: true })); await s.flush(); }
      const saved = await s.raw(), stB = await s.state();
      await s.reload();
      R.check(`${V} F reload: app starts on defaults with the resume offer`, defaultProblems(await s.state()).concat((await s.shown('resume-box')) && (await s.shown('btn-resume')) && (await s.shown('btn-startnew')) && (await s.shown('start-panel')) ? [] : ['resume box missing']));
      R.check(`${V} F reload: offer is in-page (no dialog), tells date and stage`, !(await s.dialogOpen()) && /^Saved .*stage 2 of 5/.test(await s.text('resume-meta')) ? [] : [await s.text('resume-meta')]);
      R.check(`${V} F pending draft marked in session`, await s.page.evaluate(() => PC.store.session.draftPending === true));
      await s.layout(`${V} F resume offer`); await s.shot('F-resume-offer');
      await s.act('unit-ft'); await s.flush(); /* run the debounced autosave now instead of waiting for its 400 ms timer */
      R.check(`${V} F a change made while the offer is unanswered does not overwrite the saved draft`, (await s.raw()) === saved);
      await s.act('step-2'); await s.settle(); R.check(`${V} F with the offer pending, locked steps still explain themselves`, (await s.toasts()).includes('Draw and close the plot first'));
      await s.act('btn-resume'); await s.settle();
      R.check(`${V} F Resume restores plot, answers, stage and sample flag exactly`, eq(await s.state(), stB) ? [] : ['state after resume differs from saved state']);
      if (L3()) R.check(`${V} F Resume (F3-T1) keeps the stored plans as they were (Ground floor still approved and edited: not regenerated)`, (await s.page.evaluate(() => { const p = PC.debug.state().plans.G; return p && p.approved && p.edited; })));
      R.check(`${V} F Resume: stage 2 shown, resume box and start panel gone, unit radio follows the draft`, (await s.stages()) === '2' && !(await s.shown('resume-box')) && (await s.page.isChecked(sel('unit-m'))) && (await s.steps()) === (L3() ? 'DCaLL' : 'DCLLL') ? [] : [await s.stages() + ' ' + await s.steps()]);
      R.check(`${V} F Resume keeps the stored draft`, await s.waitDraft((d) => d && eq(d.state, stB)));
      // change + immediate reload (inside the 400 ms debounce) must not lose the change
      await s.act('unit-ft'); await s.reload();
      const w2 = JSON.parse(await s.raw()); R.check(`${V} F change followed at once by reload is saved (flush on page hide)`, w2 && w2.state.ans.unit === 'ft' && w2.state.sampleClean === true ? [] : ['unit in draft: ' + (w2 && w2.state.ans.unit) + ', sampleClean ' + (w2 && w2.state.sampleClean)]);

      // ---- Start new: Cancel / Esc / backdrop keep the draft; OK clears it
      const before = await s.raw();
      await s.act('btn-startnew'); await s.settle();
      R.check(`${V} F Start new asks in an in-page dialog`, (await s.dialogOpen()) && (await s.text('dialog-title')) === 'Start a new project?' && /deleted/i.test(await s.text('dialog-text')) && (await s.text('dialog-ok')) === 'Start new' && (await s.text('dialog-cancel')) === 'Cancel' ? [] : [await s.text('dialog-title')]);
      R.check(`${V} F dialog semantics: role=dialog, aria-modal, labelled; app inert and aria-hidden; focus on Cancel`, await s.page.evaluate(() => { const f = [], d = document.querySelector('[data-pc="dialog"]'), app = document.querySelector('[data-pc="app"]'); if (d.getAttribute('role') !== 'dialog' || d.getAttribute('aria-modal') !== 'true') f.push('role/modal'); const l = document.getElementById(d.getAttribute('aria-labelledby')); if (!l || !l.textContent.trim()) f.push('label'); if (!app.inert) f.push('app not inert'); if (app.getAttribute('aria-hidden') !== 'true') f.push('app not aria-hidden'); if (document.activeElement !== document.querySelector('[data-pc="dialog-cancel"]')) f.push('focus on ' + (document.activeElement.dataset.pc || document.activeElement.tagName)); return f; }));
      await s.layout(`${V} F dialog open`, { dialog: true }); await s.shot('F-startnew-dialog');
      R.check(`${V} F dialog box inside viewport, buttons hittable`, await s.page.evaluate(() => { const f = [], d = document.querySelector('[data-pc="dialog"]').getBoundingClientRect(); if (d.left < 0 || d.top < 0 || d.right > innerWidth + 0.5 || d.bottom > innerHeight + 0.5) f.push('dialog outside viewport'); for (const h of ['dialog-ok', 'dialog-cancel']) { const b = document.querySelector(`[data-pc="${h}"]`), r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!hit || !b.contains(hit)) f.push(h + ' not hittable'); } return f; }));
      // the app behind cannot be operated: raw taps on a step, on Resume and on the unit toggle
      const behind = await s.page.evaluate(() => ['step-2', 'btn-resume', 'unit-m', 'btn-sample'].map((h) => { const r = document.querySelector(`[data-pc="${h}"]`).getBoundingClientRect(); return [h, r.left + r.width / 2, r.top + r.height / 2]; }));
      const dbox = await s.page.evaluate(() => { const r = document.querySelector('[data-pc="dialog"]').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
      await sleep(320); // thing under test: backdrop taps are ignored for the first 300 ms after a dialog opens
      const stBehind = await s.state(); let hitBackdrop = false;
      for (const [h, x, y] of behind) { if (x > dbox[0] && x < dbox[2] && y > dbox[1] && y < dbox[3]) continue; if (h !== 'step-2') continue; if (vp.touch) await s.page.touchscreen.tap(x, y); else await s.page.mouse.click(x, y); hitBackdrop = true; }
      await s.settle();
      R.check(`${V} F tap behind the dialog: nothing behind is activated, the tap on the backdrop cancels`, eq(await s.state(), stBehind) && !(await s.toasts()).length && hitBackdrop && !(await s.dialogOpen()) && (await s.raw()) === before && (await s.shown('resume-box')) ? [] : [`open=${await s.dialogOpen()} toasts=${await s.toasts()}`]);
      await s.act('btn-startnew'); await s.settle(); await s.act('dialog-cancel'); await s.settle();
      R.check(`${V} F Cancel: dialog closed, draft kept, offer still there, focus back on Start new`, !(await s.dialogOpen()) && (await s.raw()) === before && (await s.shown('resume-box')) && (await s.focus()) === 'btn-startnew' && await s.page.evaluate(() => !document.querySelector('[data-pc="app"]').inert && !document.querySelector('[data-pc="app"]').hasAttribute('aria-hidden')) ? [] : [`focus ${await s.focus()}`]);
      await s.act('btn-startnew'); await s.settle(); await s.page.keyboard.press('Escape'); await s.settle();
      R.check(`${V} F Esc: same as Cancel`, !(await s.dialogOpen()) && (await s.raw()) === before && (await s.shown('resume-box')) && (await s.focus()) === 'btn-startnew' ? [] : [`focus ${await s.focus()}`]);
      // focus trap
      await s.act('btn-startnew'); await s.settle(); const trail = [];
      for (let i = 0; i < 7; i++) { await s.page.keyboard.press(i < 4 ? 'Tab' : 'Shift+Tab'); trail.push(await s.focus()); }
      R.check(`${V} F Tab / Shift+Tab stay inside the dialog and reach both buttons`, trail.every((t) => t === 'dialog-ok' || t === 'dialog-cancel') && trail.includes('dialog-ok') && trail.includes('dialog-cancel') ? [] : [trail.join(' > ')]);
      await s.page.focus(sel('dialog-ok')); await s.page.keyboard.press('Enter'); await s.settle();
      R.check(`${V} F Start new confirmed (keyboard): draft key removed, defaults, offer gone, start panel shown`, (await s.raw()) === null && defaultProblems(await s.state()).length === 0 && !(await s.shown('resume-box')) && (await s.shown('start-panel')) && !(await s.dialogOpen()) ? [] : [`raw ${await s.raw()}`]);
      R.check(`${V} F Start new: pending flag cleared, unit radio back to m`, await s.page.evaluate(() => PC.store.session.draftPending === false && document.querySelector('[data-pc="unit-m"]').checked));
      const fAfter = await s.focus(); R.check(`${V} F after Start new focus is on a visible control (not lost to <body>)`, fAfter !== 'BODY' ? [] : ['focus is on <body>: the opener (Start new) was hidden and nothing else was focused']);
      await s.flush(); await s.reload();
      R.check(`${V} F after Start new a reload shows no offer`, !(await s.shown('resume-box')) && (await s.raw()) === null);
      await s.end(`${V} F`); }

    // ============ G. sample over an existing draft / project asks first ============
    { const s = await session(browser, vp);
      await s.act('btn-sample'); await s.act('unit-ft'); await s.waitDraft((d) => d && d.state.ans.unit === 'ft'); const saved = await s.raw();
      await s.reload(); await s.act('btn-sample'); await s.settle();
      R.check(`${V} G sample over a pending draft asks for confirmation`, (await s.dialogOpen()) && (await s.text('dialog-title')) === 'Load the sample project?' && /replaces/i.test(await s.text('dialog-text')) ? [] : ['no dialog']);
      await s.shot('G-sample-over-draft');
      await s.act('dialog-cancel'); await s.settle();
      R.check(`${V} G Cancel: draft and offer untouched, nothing loaded`, (await s.raw()) === saved && (await s.shown('resume-box')) && (await s.state()).plot.pts.length === 0);
      await s.act('btn-sample'); await s.settle(); await s.act('dialog-ok'); await s.settle();
      const st = await s.state(); R.check(`${V} G OK: sample loaded fresh (unmodified, metres), offer gone`, sampleProblems(st).length === 0 && st.sampleClean && st.ans.unit === 'm' && !(await s.shown('resume-box')) && (await s.shown('sample-strip')) ? sampleProblems(st) : ['not the clean sample']);
      R.check(`${V} G the stored draft is now the sample`, await s.waitDraft((d) => d && d.state.sampleClean === true && d.state.ans.unit === 'm'));
      await s.end(`${V} G`); }

    // ============ H. keyboard-only pass ============
    { const s = await session(browser, vp);
      const tabTo = async (hook, max = 60) => { for (let i = 0; i < max; i++) { await s.page.keyboard.press('Tab'); if ((await s.focus()) === hook) return true; } return false; };
      R.check(`${V} H Tab reaches "Load sample project"`, await tabTo('btn-sample'));
      await s.page.keyboard.press('Enter'); await s.settle();
      R.check(`${V} H Enter loads the sample`, (await s.state()).sampleClean === true);
      const f1 = await s.focus(); R.check(`${V} H focus after keyboard "Load sample" stays on a visible control`, f1 !== 'BODY' ? [] : ['focus dropped to <body> when the start panel was hidden']);
      await s.page.focus(sel('btn-skip3d')); await s.page.keyboard.press('Enter'); await s.settle();
      R.check(`${V} H keyboard "Skip to 3D": stage opens and focus is on a visible control`, (await s.state()).stage === SKIP_TO() && (await s.focus()) !== 'BODY' ? [] : [`stage ${(await s.state()).stage} focus on <body>`]);
      await s.page.focus(sel('btn-back')); await s.page.keyboard.press('Enter'); await s.settle();
      for (let k = 0; k < 4 && (await s.state()).stage > 1; k++) { await s.page.focus(sel('btn-back')); await s.page.keyboard.press('Enter'); await s.settle(); }   // Skip landed on stage 3 or 5
      R.check(`${V} H keyboard Back to stage 1: focus is on a visible control`, (await s.state()).stage === 1 && (await s.focus()) !== 'BODY' ? [] : ['focus on <body>']);
      R.check(`${V} H Tab reaches Next`, await tabTo('btn-next')); await s.page.keyboard.press('Enter'); await s.settle();
      R.check(`${V} H Enter on Next opens stage 2`, (await s.state()).stage === 2);
      R.check(`${V} H focus after the stage change is on a visible control`, (await s.focus()) !== 'BODY' ? [] : ['focus on <body>']);
      await s.page.focus(sel('step-1')); await s.page.keyboard.press('Enter'); await s.settle(); R.check(`${V} H Enter on a reachable step navigates`, (await s.state()).stage === 1);
      await s.page.focus(sel('unit-m')); await s.page.keyboard.press('ArrowRight'); await s.settle();
      R.check(`${V} H arrow key on the unit toggle switches to ft`, (await s.state()).ans.unit === 'ft' && (await s.page.isChecked(sel('unit-ft'))));
      R.check(`${V} H after the keyboard unit change the sample is still unmodified and Skip is still offered`, (await s.state()).sampleClean && (await s.shown('btn-skip3d')));
      await s.end(`${V} H`); }
  }

  // ============ I. corrupted / old / empty drafts are discarded silently (360x640 and 1280x800) ============
  const GOOD = await (async () => { const s = await session(browser, VIEWPORTS[0]); await s.act('btn-sample'); await s.waitDraft((d) => !!d); const r = await s.raw(); await s.ctx.close(); return r; })();
  const mut = (fn) => { const d = JSON.parse(GOOD); fn(d); return JSON.stringify(d); };
  const BAD = {
    'garbage text': 'not json at all', 'truncated JSON': GOOD.slice(0, Math.floor(GOOD.length / 2)), 'empty string': '', 'JSON null': 'null', 'JSON array': '[]', 'JSON number': '42', 'JSON string': '"draft"', 'empty object': '{}',
    'wrapper v 0 (old format)': mut((d) => { d.v = 0; }), [`wrapper v ${PAGE.V + 1} (newer format)`]: mut((d) => { d.v = PAGE.V + 1; }), 'wrapper v "1" (string)': mut((d) => { d.v = '1'; }), 'no wrapper (bare state)': JSON.stringify(JSON.parse(GOOD).state),
    'savedAt missing': mut((d) => { delete d.savedAt; }), 'savedAt string': mut((d) => { d.savedAt = 'yesterday'; }), 'savedAt null': mut((d) => { d.savedAt = null; }),
    'state missing': mut((d) => { delete d.state; }), [`state.v ${PAGE.V + 1}`]: mut((d) => { d.state.v = PAGE.V + 1; }), 'unknown key in state': mut((d) => { d.state.extra = 1; }), 'unknown key in ans': mut((d) => { d.state.ans.colour = 'red'; }), 'ans key missing (older schema)': mut((d) => { delete d.state.ans.interior; }),
    'stage 9': mut((d) => { d.state.stage = 9; }), 'stage "2"': mut((d) => { d.state.stage = '2'; }), 'unit yard': mut((d) => { d.state.ans.unit = 'yd'; }), 'footprint 95 %': mut((d) => { d.state.ans.footprintPct = 95; }), 'setback -1': mut((d) => { d.state.ans.setbacks.front = -1; }), 'floors 4': mut((d) => { d.state.ans.floors = 4; }), 'north 10 deg': mut((d) => { d.state.ans.north = 10; }),
    'closed plot with 2 points': mut((d) => { d.state.plot.pts = [[0, 0], [5, 5]]; }), '13 points': mut((d) => { d.state.plot.pts = Array.from({ length: 13 }, (_, i) => [i, i * i % 7]); }), 'point with a string': mut((d) => { d.state.plot.pts[1] = ['20', 0]; }), 'plot 500 m wide': mut((d) => { d.state.plot.pts[1] = [500, 0]; }), 'pts not an array': mut((d) => { d.state.plot.pts = 'x'; }),
    'duplicate room id': mut((d) => { d.state.ans.rooms[1].id = 'r1'; }), 'room on a level that does not exist': mut((d) => { d.state.ans.rooms[0].level = 'B'; }), 'room type pantry': mut((d) => { d.state.ans.rooms[0].type = 'pantry'; }), 'pair across levels': mut((d) => { d.state.ans.pairs = [['r1', 'r8']]; }), 'markup in an enum': mut((d) => { d.state.ans.exterior = '<img src=x onerror=alert(1)>'; }),
    'valid draft of an empty plot': mut((d) => { d.state.plot = { pts: [], closed: false }; d.state.ans.streetEdge = null; d.state.sampleClean = false; }),
    '__proto__ key': GOOD.replace('{"v":' + PAGE.V, '{"__proto__":{"polluted":true},"v":' + PAGE.V), 'large junk (1 MB)': 'x'.repeat(1 << 20),
  };
  // Draft v2 (A-4, F2-T3): a v2 wrapper that breaks the edgeOv rules is discarded like any other bad draft.
  if (PAGE.V >= 2) Object.assign(BAD, {
    'v2: state.v 1 inside a v2 wrapper': mut((d) => { d.state.v = 1; }),
    'v2: edgeOv value "front"': mut((d) => { d.state.ans.edgeOv = { 1: 'front' }; }), 'v2: edgeOv index out of range': mut((d) => { d.state.ans.edgeOv = { 9: 'side' }; }),
    'v2: edgeOv on the street edge': mut((d) => { d.state.ans.edgeOv = { 0: 'side' }; }), 'v2: edgeOv not an object': mut((d) => { d.state.ans.edgeOv = ['back']; }),
    'v2: edgeOv on an open plot': mut((d) => { d.state.plot.closed = false; d.state.ans.streetEdge = null; d.state.sampleClean = false; d.state.ans.edgeOv = { 1: 'back' }; }),
    'v2: edgeOv missing': mut((d) => { delete d.state.ans.edgeOv; }) });
  const V1KEY = 'plotcraft.draft.v1';
  const asV1 = (fn) => mut((d) => { d.v = 1; d.state.v = 1; delete d.state.ans.edgeOv; if (fn) fn(d); });
  for (const vp of VIEWPORTS.filter((v) => ['360x640', '1280x800'].includes(v.tag) && (!only || v.tag === only))) {
    const s = await session(browser, vp);
    await s.setRaw(GOOD); await s.reload(); R.check(`${vp.tag} I control: a valid stored draft is offered`, await s.shown('resume-box'));
    if (PAGE.V >= 2) {
      const both = async () => [await s.rawKey(PAGE.KEY), await s.rawKey(V1KEY)];
      // a v1 draft (round 3) resumes, migrated: no overrides, version 2, saved back under the v2 key, v1 key gone
      await s.setRaw(null); await s.setRawKey(V1KEY, asV1()); await s.reload();
      const off = await s.shown('resume-box'); if (off) await s.act('btn-resume'); await s.settle(); await s.flush();
      { const st = await s.state(), [k2, k1] = await both(), w2 = k2 && JSON.parse(k2);
        R.check(`${vp.tag} I v2: a stored v1 draft is offered and resumes migrated (v 2, edgeOv {}), saved as v2, v1 key removed`, off && st.v === 2 && eq(st.ans.edgeOv, {}) && sampleProblems(st).length === 0 && w2 && w2.v === 2 && w2.state.v === 2 && k1 === null ? [] : [`offered ${off}, v ${st.v}, edgeOv ${JSON.stringify(st.ans.edgeOv)}, v2 key ${k2 ? 'v ' + w2.v : 'none'}, v1 key ${k1 ? 'still there' : 'gone'}`, ...sampleProblems(st)]); }
      // v1 and v2 both stored: v2 wins
      await s.setRaw(GOOD); await s.setRawKey(V1KEY, asV1((d) => { d.state.plot.pts = [[0, 0], [20, 0], [20, 20], [0, 20]]; d.state.ans.streetEdge = 0; d.state.sampleClean = false; })); await s.reload();
      { const off2 = await s.shown('resume-box'); if (off2) await s.act('btn-resume'); await s.settle(); const st = await s.state();
        R.check(`${vp.tag} I v2: v1 and v2 drafts both stored: the v2 one is resumed`, off2 && st.plot.pts.length === 5 ? [] : [`offered ${off2}, ${st.plot.pts.length} points`]); }
      // v1 stored, Start new, reload: nothing offered, both keys gone
      await s.setRaw(null); await s.setRawKey(V1KEY, asV1()); await s.reload();
      if (await s.shown('resume-box')) { await s.act('btn-startnew'); if (await s.dialogOpen()) await s.act('dialog-ok'); }
      await s.flush(); await s.reload();
      { const [k2, k1] = await both(); R.check(`${vp.tag} I v2: v1 draft, Start new, reload: nothing offered, both keys removed`, !(await s.shown('resume-box')) && k2 === null && k1 === null ? [] : [`offered ${await s.shown('resume-box')}, v2 ${k2 ? 'present' : 'gone'}, v1 ${k1 ? 'present' : 'gone'}`]); }
      // an override equal to the automatic class is normalised away, a real one is kept
      await s.setRaw(mut((d) => { d.state.ans.edgeOv = { 1: 'side' }; })); await s.reload(); if (await s.shown('resume-box')) await s.act('btn-resume'); await s.settle();
      R.check(`${vp.tag} I v2: edgeOv equal to the automatic class (edge 2 = side) resumes normalised to {}`, eq((await s.state()).ans.edgeOv, {}) && (await s.state()).plot.pts.length === 5 ? [] : [JSON.stringify((await s.state()).ans.edgeOv)]);
      await s.flush(); await s.setRaw(mut((d) => { d.state.ans.edgeOv = { 1: 'back' }; })); await s.reload(); if (await s.shown('resume-box')) await s.act('btn-resume'); await s.settle();
      R.check(`${vp.tag} I v2: a real override (edge 2 -> back) resumes as stored`, eq((await s.state()).ans.edgeOv, { 1: 'back' }) ? [] : [JSON.stringify((await s.state()).ans.edgeOv)]);
      await s.flush(); await s.setRaw(GOOD); await s.setRawKey(V1KEY, null); await s.reload();
    }
    for (const [name, text] of Object.entries(BAD)) {
      await s.setRaw(text); await s.reload(); await s.settle();
      const pr = defaultProblems(await s.state()); if (await s.shown('resume-box')) pr.push('resume offered'); if ((await s.raw()) !== null) pr.push('key not removed'); if (await s.dialogOpen()) pr.push('dialog shown'); if ((await s.toasts()).length || (await s.banners()).length) pr.push('message shown'); if ((await s.stages()) !== '1') pr.push('not on stage 1'); if (!(await s.shown('start-panel'))) pr.push('no start panel');
      if (await s.page.evaluate(() => ({}).polluted !== undefined)) pr.push('Object.prototype polluted');
      R.check(`${vp.tag} I bad draft "${name}": clean start, key removed, no message`, pr);
    }
    await s.act('btn-sample'); R.check(`${vp.tag} I app fully usable after discarding a bad draft`, await s.waitDraft((d) => d && d.state.plot.pts.length === 5));
    // drafts that are valid but point at a stage that is not reachable open on the last reachable stage
    for (const [name, fn, want] of [['saved on stage 5', (d) => { d.state.stage = 5; }, L3() ? 3 : 2], ['stage 2 with an open plot', (d) => { d.state.stage = 2; d.state.plot.closed = false; d.state.ans.streetEdge = null; d.state.sampleClean = false; }, 1], ['stage 2 with a 6 m2 plot', (d) => { d.state.stage = 2; d.state.plot.pts = [[0, 0], [3, 0], [3, 2], [0, 2]]; d.state.sampleClean = false; }, 1]]) {
      await s.setRaw(mut(fn)); await s.reload(); const off = await s.shown('resume-box'); if (off) await s.act('btn-resume'); await s.settle();
      R.check(`${vp.tag} I draft ${name}: resumes on stage ${want}`, off && (await s.state()).stage === want && (await s.stages()) === String(want) ? [] : [`offered=${off} stage=${(await s.state()).stage}`]);
      await s.flush(); // write this resume's autosave now, or its page-hide flush would overwrite the next injected draft
    }
    R.check(`${vp.tag} I small-plot draft: stage 1 invalid, step 2 locked with the size reason`, (await s.step(2)).title === 'The plot is too small (minimum 50 m²)' && !(await s.bar()).next ? [] : [(await s.step(2)).title]);
    await s.end(`${vp.tag} I`);
  }

  // ============ J. localStorage unavailable or throwing: the app must work fully (360x640 and 1280x800) ============
  for (const vp of VIEWPORTS.filter((v) => ['360x640', '1280x800'].includes(v.tag) && (!only || v.tag === only))) {
    for (const mode of ['getter-throws', 'undefined', 'null', 'all-throw', 'set-throws', 'late-fail', 'get-throws']) {
      const s = await session(browser, vp, { init: [STORAGE_MODES[mode]] }); const T = `${vp.tag} J storage ${mode}`;
      const noStore = !mode.startsWith('late');
      R.check(`${T}: starts normally on stage 1 with defaults`, defaultProblems(await s.state()).concat((await s.stages()) === '1' && !(await s.dialogOpen()) && !(await s.toasts()).length ? [] : ['not a clean stage 1']));
      if (noStore) R.check(`${T}: discreet "drafts are not saved" note shown, no resume offer`, (await s.shown('note-nosave')) && !(await s.shown('resume-box')) && /not saved/i.test(await s.text('note-nosave')) ? [] : [`note=${await s.shown('note-nosave')}`]);
      else R.check(`${T}: no note while storage still works`, !(await s.shown('note-nosave')));
      if (noStore && mode === 'getter-throws') { await s.layout(`${T} start`); await s.shot('J-nosave-note'); }
      await s.act('step-3'); await s.settle(); R.check(`${T}: locked step explains itself`, eq(await s.toasts(), ['Draw and close the plot first']));
      await s.act('btn-sample'); await s.settle(); R.check(`${T}: sample loads`, sampleProblems(await s.state()));
      await s.act('btn-next'); await s.settle(); await s.act('btn-back'); await s.act('unit-ft'); await s.flush(); /* run the debounced autosave now instead of waiting for its 400 ms timer */
      const st = await s.state(); R.check(`${T}: navigation and unit change work through the session`, st.stage === 1 && st.ans.unit === 'ft' && st.sampleClean === true && st.plot.pts.length === 5 && (await s.shown('btn-skip3d')) ? [] : [`stage ${st.stage} unit ${st.ans.unit}`]);
      R.check(`${T}: adapter reports unavailable after the failure`, await s.page.evaluate(() => PC.ui.storage.available === false));
      await s.page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); }); await s.settle();
      await s.reload(); await s.settle();
      R.check(`${T}: reload starts clean again without errors`, (await s.stages()) === '1' && !(await s.dialogOpen()));
      if (noStore) R.check(`${T}: nothing was stored`, !(await s.shown('resume-box')));
      await s.end(T);
    }
  }
  { // an existing draft + writes failing (quota full): what happens to the draft?
    const s = await session(browser, VIEWPORTS[0]); await s.setRaw(GOOD); await s.ctx.addInitScript(STORAGE_MODES['set-throws']); await s.reload();
    const offered = await s.shown('resume-box'); R.note(`storage full with an existing draft: resume offered = ${offered}, note shown = ${await s.shown('note-nosave')}, draft still stored = ${(await s.raw()) === GOOD}`);
    await s.end('360x640 J quota with existing draft'); }

  // ============ K. toasts: at most two, same text does not stack ============
  { const s = await session(browser, VIEWPORTS[0]);
    for (let i = 0; i < 5; i++) await s.act('step-2');
    R.check('360x640 K five taps on a locked step show one toast', (await s.toasts()).length === 1 ? [] : [JSON.stringify(await s.toasts())]);
    await s.page.evaluate(() => { PC.ui.toast('Second message'); PC.ui.toast('Third message that is rather long so that it has to wrap onto a second line on a phone'); }); await s.settle();
    const t = await s.toasts(); R.check('360x640 K never more than two toasts, oldest dropped', t.length === 2 && !t.includes('Draw and close the plot first') ? [] : [JSON.stringify(t)]);
    await s.layout('360x640 K two toasts'); await s.shot('K-two-toasts');
    R.check('360x640 K toasts do not cover Back/Next', await s.page.evaluate(() => { const f = []; for (const h of ['btn-back', 'btn-next']) { const b = document.querySelector(`[data-pc="${h}"]`).getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); if (!hit || !hit.closest(`[data-pc="${h}"]`)) f.push(h + ' covered'); } return f; }));
    await s.end('360x640 K'); }

  // ============ L. dialog queue and double activation ============
  { const s = await session(browser, VIEWPORTS[0]); await s.setRaw(GOOD); await s.reload();
    const r = await s.page.evaluate(() => { const b = document.querySelector('[data-pc="btn-sample"]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await s.page.touchscreen.tap(r[0], r[1]); await s.page.touchscreen.tap(r[0], r[1]); await s.settle();
    const open = await s.dialogOpen(), st = await s.state();
    R.check('360x640 L double tap on "Load sample project" over a draft leaves the confirmation on screen', open ? [] : ['the second tap lands on the backdrop and cancels the dialog at once: the user sees nothing happen']);
    R.check('360x640 L double tap on Load sample never loads the sample without an explicit OK', st.plot.pts.length === 0 && (await s.raw()) === GOOD);
    if (open) { await s.page.keyboard.press('Escape'); await s.settle(); }
    R.check('360x640 L after dismissing, no second dialog is left behind and the app is operable', !(await s.dialogOpen()) && await s.page.evaluate(() => !document.querySelector('[data-pc="app"]').inert));
    await s.end('360x640 L'); }

  // ============ M. short landscape sanity (layout of live states) ============
  if (!only) { const s = await session(browser, LAND); await s.setRaw(GOOD); await s.reload();
    await s.layout('640x360 M resume offer'); await s.act('btn-startnew'); await s.settle(); await s.layout('640x360 M dialog', { dialog: true }); await s.shot('M-dialog'); await s.act('dialog-cancel');
    await s.act('btn-resume'); await s.settle(); await s.layout('640x360 M sample with strip'); await s.shot('M-sample-strip');
    R.check('640x360 M strip (Skip) visible and hittable in the action bar row', await s.page.evaluate(() => { const b = document.querySelector('[data-pc="btn-skip3d"]'), r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit && b.contains(hit) ? [] : ['Skip not hittable']; }));
    await s.end('640x360 M'); }
} finally { await browser.close(); }
process.exit(R.done() ? 0 : 1);
