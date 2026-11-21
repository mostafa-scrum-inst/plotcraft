// F1-T2 shell flows: stepper gating, Back/Next, sample, Skip to 3D, draft autosave/resume, storage failures, dialogs.
import { launch, open, suite, settled as pageSettled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const KEY = 'plotcraft.draft.v2', KEY1 = 'plotcraft.draft.v1';   // draft v2 since F2-T3 (A-4)
const T = suite('e2e shell'), browser = await launch();

function tools(vp, o) {
  const { page, hook } = o, tag = vp.tag;
  const t = {
    tag,
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(PC.debug.state()))),
    hidden: (h) => hook(h).evaluate((el) => !!el.closest('[hidden]')),
    text: (h) => hook(h).evaluate((el) => el.textContent.trim()),
    // Real pointer at the element centre (works on aria-disabled steps, which stay tappable by design).
    press: async (h) => { const b = await hook(h).boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2; return vp.touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y); },
    step: (n) => hook('step-' + n).evaluate((el) => ({ current: el.classList.contains('is-current'), done: el.classList.contains('is-done'), locked: el.classList.contains('is-locked'), ariaDisabled: el.getAttribute('aria-disabled'), ariaCurrent: el.getAttribute('aria-current'), disabled: el.disabled })),
    steps: async () => { let s = ''; for (let n = 1; n <= 5; n++) { const x = await t.step(n); s += x.current ? 'C' : x.locked ? 'L' : x.done ? 'D' : '-'; } return s; },
    visibleStages: () => page.evaluate(() => [...document.querySelectorAll('[data-stage]')].filter((s) => !s.hidden).map((s) => s.dataset.stage).join(',')),
    toasts: () => page.evaluate(() => [...document.querySelectorAll('[data-pc="toast-region"] [data-pc="toast-text"]')].map((e) => e.textContent)),
    banners: () => page.evaluate(() => [...document.querySelectorAll('[data-pc="banner-slot"] [data-pc="banner-text"]')].map((e) => e.textContent)),
    stored: () => page.evaluate((k) => { try { return localStorage.getItem(k); } catch (e) { return 'THROWS'; } }, KEY),
    waitSaved: () => page.waitForFunction((k) => localStorage.getItem(k) !== null, KEY, { timeout: 5000 }),
    build5: () => page.evaluate(() => { PC.stages.MAX_BUILT = 5; PC.ui.shell.render(); }),
    layout: async (label) => {
      for (const fn of ['noPageScroll', 'barInViewport', 'stepperOneLine', 'tapTargets']) T.none(await A[fn](page), `${tag} ${label}: ${fn}`);
    },
    end: async (label) => { T.none(o.problems(), `${tag} ${label}: clean log`); await o.ctx.close(); }
  };
  return t;
}

async function gating(vp) {
  const o = await open(browser, vp), t = tools(vp, o), { page, hook, act } = o, tag = vp.tag;
  // 1 fresh load
  T.eq(await t.visibleStages(), '1', `${tag} fresh: only stage 1 visible`);
  T.eq(await t.steps(), 'CLLLL', `${tag} fresh: step 1 current, 2-5 locked`);
  const s2 = await t.step(2);
  T.ok(s2.ariaDisabled === 'true' && s2.disabled === false, `${tag} locked step is aria-disabled, not disabled`);
  T.eq((await t.step(1)).ariaCurrent, 'step', `${tag} current step has aria-current`);
  T.ok(await hook('btn-back').isDisabled() && await hook('btn-next').isDisabled(), `${tag} fresh: Back and Next disabled`);
  T.eq(await t.text('btn-next-label'), 'Next: Questions', `${tag} fresh: Next label`);
  T.ok(!(await t.hidden('start-panel')) && await t.hidden('resume-box') && await t.hidden('sample-strip') && await t.hidden('note-nosave'), `${tag} fresh: start panel only`);
  T.eq(await t.banners(), [], `${tag} fresh: no banner on stage 1`);
  await t.layout('fresh');
  // 2 locked steps explain themselves
  await t.press('step-2');
  T.eq((await t.state()).stage, 1, `${tag} locked tap does not navigate`);
  T.eq(await t.toasts(), ['Draw and close the plot first'], `${tag} locked tap shows the reason`);
  await t.press('step-2'); await t.press('step-4');
  T.eq(await t.toasts(), ['Draw and close the plot first'], `${tag} repeated taps do not stack toasts`);
  await t.layout('toast');
  T.eq(await hook('step-3').getAttribute('title'), 'Draw and close the plot first', `${tag} reason also in title`);
  await page.evaluate(() => { document.querySelector('[data-pc="toast-region"]').textContent = ''; });
  await hook('step-3').focus(); await page.keyboard.press('Enter');
  T.eq((await t.state()).stage, 1, `${tag} Enter on a locked step does not navigate`);
  T.ok((await t.toasts()).length === 1, `${tag} Enter on a locked step shows the reason`);
  await page.waitForFunction(() => !document.querySelector('[data-pc="toast-region"]').children.length, null, { timeout: 6000 });
  T.ok(true, `${tag} toast goes away by itself`);
  // 3 sample, Next, Back
  await act('btn-sample');
  T.eq(o.log.dialogs.length, 0, `${tag} sample on an empty project asks nothing`);
  let s = await t.state();
  T.ok(s.sampleClean && s.plot.closed && s.plot.pts.length === 5 && s.ans.rooms.length === 14 && s.stage === 1, `${tag} sample loaded in one tap`);
  T.ok(!(await t.hidden('sample-strip')) && !(await t.hidden('btn-skip3d')) && await t.hidden('start-panel'), `${tag} strip + Skip shown, start panel hidden`);
  T.eq(await t.steps(), 'C--LL', `${tag} sample: steps 2 and 3 unlocked (F3-T1), not "done" before they were visited`);
  T.ok(await hook('btn-next').isEnabled(), `${tag} Next enabled on a valid stage`);
  await t.layout('sample strip');
  T.none(await A.stripClear(page), `${tag} strip covers nothing`);
  const before = await t.state();
  await act('btn-next');
  T.eq(await t.visibleStages(), '2', `${tag} Next opens stage 2`);
  T.eq(await t.steps(), 'DC-LL', `${tag} stage 2: step 1 done`);
  T.ok(await t.hidden('sample-strip'), `${tag} no strip on stage 2`);
  T.eq(await t.banners(), [], `${tag} stage 2 has its controller: no static-preview banner`);
  T.eq(await t.text('btn-next-label'), 'Next: Floor plans', `${tag} stage 2 Next label`);
  T.ok(await hook('btn-next').isEnabled(), `${tag} Next enabled: stage 3 is in this build (F3-T1)`);
  await t.press('step-4');
  T.eq(await t.toasts(), ['Approve all floors first'], `${tag} a locked later stage says why`);
  await t.layout('stage 2 static');
  await act('btn-next');
  T.eq([await t.visibleStages(), await t.banners()], ['3', []], `${tag} Next opens stage 3, which has its controller: no static banner`);
  await act('btn-back');
  await act('btn-back');
  T.eq(await t.visibleStages(), '1', `${tag} Back returns to stage 1`);
  T.eq(await t.banners(), [], `${tag} banner gone on stage 1`);
  T.eq(await t.state(), before, `${tag} back and forward loses nothing`);
  await t.press('step-2');
  T.eq((await t.state()).stage, 2, `${tag} an unlocked step is activatable`);
  await t.press('step-1');
  // 4 full gating with all five stages opened by the test
  await t.build5();
  T.eq(await t.steps(), 'CD-LL', `${tag} 5 stages: 4 and 5 locked without approvals; 2 visited and valid, 3 not yet visited`);
  await t.press('step-4');
  T.eq((await t.state()).stage, 1, `${tag} step 4 locked`);
  T.ok((await t.toasts()).includes('Approve all floors first'), `${tag} step 4 says "Approve all floors first"`);
  await t.press('step-3');
  T.eq(await t.visibleStages(), '3', `${tag} stage 3 opens`);
  T.ok(!(await t.hidden('sample-strip')), `${tag} strip on stage 3`);
  T.ok(await hook('btn-next').isDisabled(), `${tag} stage 3: Next disabled until every floor is approved`);
  T.eq(await t.text('btn-next-label'), 'Next: Interior', `${tag} stage 3 Next label`);
  await page.evaluate(() => PC.store.commit((s) => { const p = (id, a) => ({ sig: PC.sig.level(s, id), rooms: [], unmet: [], edited: false, approved: a, error: null }); s.plans = { G: p('G', true), 1: p('1', false) }; }, { nav: true }));
  T.ok(await hook('btn-next').isDisabled() && (await t.step(4)).locked, `${tag} one floor approved is not enough`);
  await page.evaluate(() => PC.store.commit((s) => { s.plans['1'].approved = true; }, { nav: true }));
  T.eq(await t.steps(), 'DDC--', `${tag} all approved: 4 and 5 unlocked`);
  await act('btn-next');
  T.eq(await t.visibleStages(), '4', `${tag} stage 4 opens`);
  T.eq(await t.text('btn-next-label'), 'Build 3D model', `${tag} stage 4 Next label`);
  T.ok(!(await t.hidden('sample-strip')), `${tag} strip on stage 4`);
  await t.layout('stage 4');
  await act('btn-next');
  T.eq(await t.visibleStages(), '5', `${tag} stage 5 opens`);
  T.ok(await t.hidden('btn-next') && await t.hidden('sample-strip'), `${tag} stage 5: no Next, no strip`);
  T.eq(await t.steps(), 'DDDDC', `${tag} stage 5 stepper`);
  T.ok(await hook('btn-back').isEnabled(), `${tag} stage 5: Back available`);
  await act('btn-back'); await act('btn-back');
  // unapprove from the test: the app must not sit past a locked stage after a reload (clamp), checked in drafts()
  T.eq((await t.state()).stage, 3, `${tag} Back twice from 5`);
  T.ok((await t.state()).sampleClean, `${tag} navigation alone keeps the sample unmodified`);
  await t.end('gating');
}

async function skipAndEdit(vp) {
  const o = await open(browser, vp), t = tools(vp, o), { page, hook, act } = o, tag = vp.tag;
  // 10 Skip to 3D
  await act('btn-sample');
  await act('btn-skip3d');
  let s = await t.state();
  T.eq([s.stage, s.sampleClean, s.plans.G.approved, s.plans['1'].approved], [5, true, true, true], `${tag} Skip approves the generated plans, lands on the last built stage (5 since F3-T2, a static preview) and keeps the sample unmodified`);
  T.eq(await page.evaluate(() => [...document.querySelectorAll('[data-pc="banner-slot"] > *')].map((e) => e.textContent.trim())), ['This stage is not built yet: static preview'], `${tag} Skip: stage 5 shows the not-built banner`);
  await t.press('step-1');
  T.ok(!(await t.hidden('btn-skip3d')), `${tag} Skip still offered back on stage 1`);
  await t.build5();
  await page.evaluate(() => PC.store.commit((s) => { const p = (id) => ({ sig: PC.sig.level(s, id), rooms: [], unmet: [], edited: false, approved: false, error: null }); s.plans = { G: p('G'), 1: p('1') }; }, { nav: true }));
  await act('btn-skip3d');
  s = await t.state();
  T.eq([s.stage, s.plans.G.approved, s.plans['1'].approved, s.sampleClean], [5, true, true, true], `${tag} with all stages built, Skip approves every level and opens 3D`);
  await t.press('step-1');
  T.ok(!(await t.hidden('sample-strip')), `${tag} strip is back on stage 1 after Skip`);
  // switching the unit is display only and keeps the sample unmodified (F1-S5 as amended); any other edit ends it
  await hook('unit-ft').check({ force: true });
  s = await t.state();
  T.eq([s.ans.unit, s.sampleClean], ['ft', true], `${tag} unit toggle keeps the sample unmodified`);
  T.ok(!(await t.hidden('sample-strip')) && !(await t.hidden('btn-skip3d')), `${tag} Skip is still offered after a unit change`);
  await hook('unit-m').check({ force: true });
  T.ok((await t.state()).sampleClean, `${tag} ...and after switching back`);
  await page.evaluate(() => PC.store.commit((st) => { st.ans.vegPct = 30; }));
  T.ok(await t.hidden('sample-strip') && !(await t.state()).sampleClean, `${tag} any other change removes Skip`);
  await page.evaluate(() => PC.store.commit((st) => { st.ans.vegPct = 25; }));
  await hook('unit-ft').check({ force: true }); await hook('unit-m').check({ force: true });
  T.ok(await t.hidden('sample-strip') && !(await t.state()).sampleClean, `${tag} ...for good`);
  T.eq(await hook('unit-m').isChecked(), true, `${tag} header toggle reflects the state`);
  await t.end('skip');
}

async function drafts(vp) {
  const o = await open(browser, vp), t = tools(vp, o), { page, hook, act } = o, tag = vp.tag;
  // nothing is saved for an empty project
  await hook('unit-ft').check({ force: true });
  await page.evaluate(() => PC.ui.autosave.flush());                              // write now instead of waiting out the debounce
  T.eq(await t.stored(), null, `${tag} an empty project is not saved`);
  await hook('unit-m').check({ force: true });
  // 5 autosave + resume
  await act('btn-sample'); await act('btn-next');
  await t.waitSaved();
  const saved = await t.state();
  const raw = JSON.parse(await t.stored());
  T.ok(raw.v === 2 && raw.state.v === 2 && typeof raw.savedAt === 'number' && raw.state.stage === 2, `${tag} draft wrapper { v, savedAt, state }`);
  await page.reload();
  T.ok(!(await t.hidden('resume-box')) && !(await t.hidden('btn-resume')) && !(await t.hidden('btn-startnew')), `${tag} reload offers Resume / Start new`);
  T.ok((await t.text('resume-meta')).startsWith('Saved '), `${tag} resume box says when it was saved`);
  T.eq((await t.state()).plot.pts.length, 0, `${tag} nothing is restored before the user chooses`);
  await t.layout('resume box');
  // 7 sample over a pending draft asks first
  await act('btn-sample');
  T.ok(!(await t.hidden('dialog-layer')), `${tag} sample over a draft opens the in-page dialog`);
  T.eq(await t.text('dialog-title'), 'Load the sample project?', `${tag} dialog title`);
  T.ok(await page.evaluate(() => document.activeElement === document.querySelector('[data-pc="dialog-cancel"]')), `${tag} dialog focuses Cancel`);
  T.ok(await page.evaluate(() => document.querySelector('[data-pc="app"]').inert === true), `${tag} page behind the dialog is inert`);
  await t.layout('dialog');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  T.ok(await page.evaluate(() => !!document.activeElement.closest('[data-pc="dialog"]')), `${tag} Tab stays inside the dialog`);
  await act('dialog-cancel');
  T.ok(await t.hidden('dialog-layer') && !(await t.hidden('resume-box')), `${tag} Cancel keeps the draft pending`);
  T.eq((await t.state()).plot.pts.length, 0, `${tag} Cancel loads nothing`);
  T.ok(await page.evaluate(() => document.activeElement === document.querySelector('[data-pc="btn-sample"]')), `${tag} focus returns to the opener`);
  T.ok(await page.evaluate(() => document.querySelector('[data-pc="app"]').inert === false), `${tag} page usable again`);
  // autosave is suspended while the draft is unanswered
  await hook('unit-ft').check({ force: true }); await page.evaluate(() => PC.ui.autosave.flush());
  T.eq(JSON.parse(await t.stored()).state.stage, 2, `${tag} the saved draft is untouched while unanswered`);
  await hook('unit-m').check({ force: true });
  // guard for F1-T3
  const g = page.evaluate(() => PC.ui.start.guard());
  await hook('dialog-layer').waitFor({ state: 'visible' });
  T.eq(await t.text('dialog-title'), 'Start a new project?', `${tag} guard asks the Start-new question`);
  await page.keyboard.press('Escape');
  T.eq(await g, false, `${tag} guard resolves false on Esc`);
  // Resume
  await act('btn-resume');
  T.eq(await t.state(), saved, `${tag} Resume restores stage and data exactly`);
  T.eq(await t.visibleStages(), '2', `${tag} Resume opens the saved stage`);
  T.eq(await page.evaluate(() => PC.ui.start.guard()), true, `${tag} guard passes when nothing is pending`);
  // 6 Start new
  await page.reload();
  await act('btn-startnew');
  T.ok(!(await t.hidden('dialog-layer')), `${tag} Start new asks in-page`);
  await act('dialog-cancel');
  T.ok((await t.stored()) !== null && !(await t.hidden('resume-box')), `${tag} Start new + Cancel keeps the draft`);
  await act('btn-startnew'); await page.keyboard.press('Escape');
  T.ok(await t.hidden('dialog-layer') && (await t.stored()) !== null, `${tag} Esc cancels`);
  await act('btn-startnew');
  await page.mouse.click(5, 5);
  T.ok(!(await t.hidden('dialog-layer')), `${tag} a backdrop tap right after opening is ignored (double-tap guard)`);
  await page.waitForTimeout(350);                                 // kept on purpose: the feature under test is a 300 ms guard
  await page.mouse.click(5, 5);
  T.ok(await t.hidden('dialog-layer') && (await t.stored()) !== null, `${tag} a tap on the backdrop cancels`);
  await act('btn-startnew'); await act('dialog-ok');
  T.ok((await t.stored()) === null && await t.hidden('resume-box') && !(await t.hidden('start-panel')), `${tag} Start new + OK deletes the draft`);
  T.eq((await t.state()).plot.pts.length, 0, `${tag} clean project after Start new`);
  await page.reload();
  T.ok(await t.hidden('resume-box'), `${tag} no resume offer after Start new`);
  // sample over a non-empty current project asks too
  await act('btn-sample');
  await page.evaluate(() => { document.querySelector('[data-pc="start-panel"]').hidden = false; });
  await act('btn-sample');
  T.ok(!(await t.hidden('dialog-layer')), `${tag} sample over the current project asks first`);
  await act('dialog-ok');
  T.ok((await t.state()).sampleClean, `${tag} confirmed: sample loaded again`);
  // a draft saved past a stage that is now locked opens on the last reachable stage
  await page.evaluate(() => { PC.stages.MAX_BUILT = 5; PC.store.commit((s) => { s.stage = 4; }, { nav: true }); });
  await page.waitForFunction((k) => { const d = JSON.parse(localStorage.getItem(k) || 'null'); return !!d && d.state.stage === 4; }, KEY, { timeout: 5000 });
  await page.reload();
  await act('btn-resume');
  T.eq((await t.state()).stage, 3, `${tag} resumed stage is clamped to what this build can open (stage 4 locked: floors not approved)`);
  await t.end('drafts');
}

// F1-T2 QA minors (fixed in F1-T3) and the test gaps QA listed.
async function focusAndTaps(vp) {
  const o = await open(browser, vp), t = tools(vp, o), { page, hook, act } = o, tag = vp.tag;
  const focused = () => page.evaluate(() => { const e = document.activeElement; return { pc: e && e.dataset ? e.dataset.pc || e.tagName : 'none', ok: !!e && e !== document.body && !e.disabled && !e.closest('[hidden]') }; });
  const settled = async () => { await pageSettled(page); return focused(); };       // after the app's zero-delay focus check
  // Space on a locked step
  await hook('step-2').focus(); await page.keyboard.press('Space');
  T.ok((await t.state()).stage === 1 && (await t.toasts()).length === 1, `${tag} Space on a locked step: reason, no navigation`);
  // a toast never covers Back / Next
  const gap = await page.evaluate(() => { const a = document.querySelector('[data-pc="toast-region"]').lastElementChild.getBoundingClientRect(), b = document.querySelector('[data-pc="btn-next"]').getBoundingClientRect(); return b.top - a.bottom; });
  T.ok(gap >= 0, `${tag} toast sits above the action bar (gap ${gap.toFixed(0)} px)`);
  // bug 1: keyboard focus never falls to <body>
  await hook('btn-sample').focus(); await page.keyboard.press('Enter');
  let f = await settled();
  T.ok(f.ok, `${tag} keyboard: after Load sample focus is on a usable control (${f.pc})`);
  await hook('btn-next').focus(); await page.keyboard.press('Enter');
  f = await settled();
  T.ok((await t.state()).stage === 2 && f.ok && f.pc === 'btn-next', `${tag} keyboard: Next to stage 2 keeps focus on Next (enabled there since F3-T1)`);
  await page.keyboard.press('Enter');
  f = await settled();
  T.ok((await t.state()).stage === 3 && f.ok, `${tag} keyboard: after Next (disabled on stage 3 until approval) focus is on a usable control (${f.pc})`);
  T.eq(f.pc, 'step-3', `${tag} ...the current step`);
  await page.keyboard.press('Shift+Tab'); await hook('step-1').focus(); await page.keyboard.press('Enter');
  await hook('btn-skip3d').focus(); await page.keyboard.press('Enter');
  f = await settled();
  T.ok((await t.state()).stage === 5 && f.ok, `${tag} keyboard: after Skip to 3D (stage 5) focus is on a usable control (${f.pc})`);
  // page-hide flush: a change followed at once by a reload is saved
  await hook('step-1').focus(); await page.keyboard.press('Enter');
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await hook('unit-ft').check({ force: true });
  await page.reload();
  const raw = await t.stored();
  T.ok(raw !== null && JSON.parse(raw).state.ans.unit === 'ft', `${tag} a change made right before leaving the page is saved (page-hide flush)`);
  // bug 1 (d): Start new confirmed by keyboard
  await hook('btn-startnew').focus(); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');          // Cancel -> OK
  f = await settled();
  T.ok((await t.stored()) === null && f.ok, `${tag} keyboard: after Start new + OK focus is on a usable control (${f.pc})`);
  // pointer users are left alone: no focus is moved for them
  await act('btn-sample'); await act('btn-next');
  f = await settled();
  T.ok(f.pc !== 'step-2', `${tag} pointer use does not move focus to the stepper (${f.pc})`);
  // bug 2: a double tap on a dialog opener leaves the dialog open
  await page.waitForFunction((k) => localStorage.getItem(k) !== null, KEY);
  await page.reload();
  const b = await hook('btn-sample').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  if (vp.touch) { await page.touchscreen.tap(x, y); await page.touchscreen.tap(x, y); } else { await page.mouse.click(x, y); await page.mouse.click(x, y); }
  await pageSettled(page);
  T.ok(!(await t.hidden('dialog-layer')), `${tag} double tap on Load sample: the question stays open`);
  T.eq((await t.state()).plot.pts.length, 0, `${tag} ...and nothing was loaded`);
  await act('dialog-ok');
  T.ok((await t.state()).sampleClean && await t.hidden('dialog-layer'), `${tag} ...one answer is enough (no second question queued)`);
  await t.end('focus and taps');
}

async function badStorage(vp, mode) {
  const o = await open(browser, vp, { storage: mode }), t = tools(vp, o), { page, act } = o, tag = `${vp.tag} storage=${mode}`;
  // 8
  T.ok(!(await t.hidden('note-nosave')), `${tag}: discreet "not saved" note`);
  T.ok(await t.hidden('resume-box'), `${tag}: no resume box`);
  T.eq(await page.evaluate(() => PC.ui.storage.available), false, `${tag}: adapter reports unavailable`);
  await act('btn-sample'); await act('btn-next');
  T.eq((await t.state()).stage, 2, `${tag}: sample and navigation work`);
  await page.evaluate(() => PC.ui.autosave.flush());                              // the failing write happens now
  await act('btn-back');
  await t.layout(`storage=${mode}`);
  await page.reload();
  T.ok(await t.hidden('resume-box') && (await t.state()).plot.pts.length === 0, `${tag}: clean start after reload`);
  await t.end(`storage=${mode}`);
}

async function corrupt(vp) {
  // 9
  const good = await (async () => { const o = await open(browser, vp); await o.act('btn-sample'); const s = await o.page.evaluate(() => PC.draft.serialize(PC.store.get(), 1)); await o.ctx.close(); return s; })();
  const old = JSON.parse(good); old.v = 0;
  const range = JSON.parse(good); range.state.ans.footprintPct = 95;
  const empty = JSON.parse(good); empty.state.plot = { pts: [], closed: false }; empty.state.ans.streetEdge = null;
  const cases = { garbage: 'not json at all', truncated: good.slice(0, good.length - 20), 'old format': JSON.stringify(old), 'out of range': JSON.stringify(range), 'empty project': JSON.stringify(empty), 'json null': 'null' };
  for (const [name, value] of Object.entries(cases)) {
    const o = await open(browser, vp), t = tools(vp, o), tag = `${vp.tag} draft=${name}`;
    await o.page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, value]);
    await o.page.reload();
    T.ok(await t.hidden('resume-box') && !(await t.hidden('start-panel')), `${tag}: clean start, no offer`);
    T.eq(await t.stored(), null, `${tag}: bad draft removed`);
    T.eq(await t.toasts().then((x) => x.length + 0), 0, `${tag}: no message`);
    T.ok(await t.hidden('note-nosave'), `${tag}: no "not saved" note`);
    T.eq(await t.steps(), 'CLLLL', `${tag}: app usable`);
    await t.end(`draft=${name}`);
  }
}

// Draft v2 (F2-T3, A-4): drafts saved before edge overrides still resume; v2 wins over v1; removing the draft
// removes both keys, so "Start new" over a not yet migrated v1 draft leaves nothing to offer after a reload.
async function draftV1(vp) {
  const v1 = await (async () => { const o = await open(browser, vp); await o.act('btn-sample'); await o.act('btn-next');
    const s = await o.page.evaluate(() => { const x = JSON.parse(JSON.stringify(PC.store.get())); x.v = 1; delete x.ans.edgeOv; return x; }); await o.ctx.close(); return s; })();
  const wrap = (state, v) => JSON.stringify({ v, savedAt: 1700000000000, state });
  const keys = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('plotcraft.draft')).sort());
  // a v1 draft resumes, with no overrides, and is saved back as v2 under the v2 key only
  let o = await open(browser, vp), t = tools(vp, o), tag = `${vp.tag} v1 draft`;
  await o.page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY1, wrap(v1, 1)]);
  await o.page.reload();
  T.ok(!(await t.hidden('btn-resume')), `${tag}: Resume offered`);
  await o.act('btn-resume');
  const st = await t.state();
  T.eq([st.v, st.ans.edgeOv, st.stage, st.ans.footprintPct], [2, {}, 2, v1.ans.footprintPct], `${tag}: resumed as v2, no overrides, same answers`);
  await o.page.evaluate(() => PC.ui.autosave.flush());
  await o.page.evaluate(() => PC.store.commit((s) => { s.ans.exterior = 'white'; })); await o.page.evaluate(() => PC.ui.autosave.flush());
  T.eq(await keys(o.page), [KEY], `${tag}: the first v2 save removes the v1 key`);
  await t.end('v1 draft resume');
  // v1 and v2 both stored: v2 wins
  o = await open(browser, vp); t = tools(vp, o); tag = `${vp.tag} v1 + v2`;
  const v2 = JSON.parse(JSON.stringify(v1)); v2.v = 2; v2.ans.edgeOv = {}; v2.stage = 1;
  await o.page.evaluate(([a, b]) => { localStorage.setItem(a[0], a[1]); localStorage.setItem(b[0], b[1]); }, [[KEY1, wrap(v1, 1)], [KEY, wrap(v2, 2)]]);
  await o.page.reload(); await o.act('btn-resume');
  T.eq((await t.state()).stage, 1, `${tag}: the v2 draft is the one resumed`);
  await t.end('v1 + v2');
  // v1 stored -> Start new -> reload -> nothing offered
  o = await open(browser, vp); t = tools(vp, o); tag = `${vp.tag} v1 + Start new`;
  await o.page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY1, wrap(v1, 1)]);
  await o.page.reload(); await o.act('btn-startnew'); await o.act('dialog-ok');
  T.eq(await keys(o.page), [], `${tag}: both keys removed`);
  await o.page.reload();
  T.ok(await t.hidden('resume-box'), `${tag}: nothing offered after reload`);
  await t.end('v1 start new');
  // Load sample over a v1 draft: the old draft goes under every key
  o = await open(browser, vp); t = tools(vp, o); tag = `${vp.tag} v1 + Load sample`;
  await o.page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY1, wrap(v1, 1)]);
  await o.page.reload(); await o.act('btn-sample'); await o.act('dialog-ok');
  await o.page.evaluate(() => PC.ui.autosave.flush());
  T.ok(!(await keys(o.page)).includes(KEY1), `${tag}: v1 key gone`);
  await t.end('v1 load sample');
}

try {
  for (const vp of VIEWPORTS) {
    await draftV1(vp);
    await gating(vp); await skipAndEdit(vp); await drafts(vp);
    await badStorage(vp, 'throw'); await badStorage(vp, 'quota'); await focusAndTaps(vp);
  }
  await corrupt(VIEWPORTS[0]); await corrupt(VIEWPORTS[2]);
  // short landscape: shell layout with strip, banner, toast and dialog
  {
    const o = await open(browser, LANDSCAPE), t = tools(LANDSCAPE, o);
    await t.layout('fresh');
    await o.act('btn-sample'); await t.layout('sample strip');
    await t.press('step-4'); await t.layout('toast');
    await o.page.evaluate(() => { document.querySelector('[data-pc="start-panel"]').hidden = false; });
    await o.act('btn-sample'); await t.layout('dialog'); await o.act('dialog-cancel');
    await t.end('landscape');
  }
} catch (e) { T.ok(false, 'spec crashed: ' + (e && e.stack || e)); } finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
