// F3 debt item 1 QA (browser, real input): the stale-plan draft fix and the rejected-draft side key as an architect
// meets them (TL fs-draft-fix-review focus 2-5). 360x640 touch and 1280x800 mouse:
//  - with both floors edited + approved: delete a Ground room / move a room to the other floor / remove the First floor
//    with "move" and with "delete" -> autosave -> reload: Resume is offered, the stored draft parses to the saved state
//    exactly; Resume keeps everything except the floors my fingerprint says changed, which are laid out again (fresh,
//    not edited, not approved, exactly the level's rooms); floors that did not change keep edits and approval; stage 3
//    then changes nothing more;
//  - away and back inside a session (no Resume, no stage 3 in between): the old plans return with edits + approvals,
//    and moving back asks nothing (a stale plan never triggers R5); across reload + Resume the plans are regenerated;
//  - (360x640) forged drafts: a fresh-signature plan with a foreign / unknown room is discarded silently with its raw
//    text under plotcraft.draft.rejected; the same plan with a stale signature is offered, resumes and is laid out
//    again; corrupted draft -> side key; Start new and Load sample leave the side key alone; localStorage throwing.
// Run: node tests/qa/f3-t3-draftui.mjs [--no-shots] [--only=360x640,...]
import { VIEWPORTS, launch, collector, STORAGE_MODES } from './lib.mjs';
import { sessions, eq } from './session.mjs';
import { stage2Kit, lab } from './stage2kit.mjs';

const R = collector('F3-T3 draft UI');
const session = sessions({ R, shots: null, noShots: true });
const { kit } = stage2Kit({ R, session });
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const VP = Object.fromEntries(VIEWPORTS.map((v) => [v.tag, v]));
const RUN = [VP['360x640'], VP['1280x800']].filter((v) => !only.length || only.includes(v.tag));
const SIDE = 'plotcraft.draft.rejected';
const AREA = { bedroom: { S: 12, M: 16, L: 24 }, bathroom: { S: 4, M: 6, L: 9 }, kitchen: { S: 9, M: 14, L: 20 }, living: { S: 20, M: 30, L: 42 }, dining: { S: 12, M: 16, L: 24 }, majlis: { S: 16, M: 24, L: 36 }, office: { S: 9, M: 12, L: 16 }, maid: { S: 6, M: 9, L: 12 }, storage: { S: 4, M: 6, L: 9 }, laundry: { S: 4, M: 6, L: 9 } };
const levelsOf = (a) => [...(a.basement ? ['B'] : []), 'G', ...(a.floors >= 2 ? ['1'] : []), ...(a.floors >= 3 ? ['2'] : [])];
// my fingerprint of what a level's plan is laid out for (A-7): rooms id / type / area, the level's pairs, stairs / lift
function fp(s, lv) { const a = s.ans, on = a.rooms.filter((r) => r.level === lv), ids = new Set(on.map((r) => r.id)), num = (id) => +id.slice(1), ar = (r) => (r.size === null ? r.area : AREA[r.type][r.size]);
  const stairs = levelsOf(a).length + (a.usableRoof ? 1 : 0) >= 2;
  return JSON.stringify([on.map((r) => [r.id, r.type, ar(r)]).sort((x, y) => num(x[0]) - num(y[0])), a.pairs.filter((p) => ids.has(p[0]) && ids.has(p[1])).map((p) => p.slice().sort((x, y) => num(x) - num(y))).sort(), stairs ? [a.stairPos, a.lift ? 1 : 0] : 0]); }

// Sample with both floors worked on: one room on each floor 0.5 m narrower (cannot overlap), both approved. Stage 2, Rooms.
// small: the sample cut to 3 rooms per floor (no pairs lost on Ground), laid out again, so "move" can take First's rooms.
async function seeded(browser, vp, small = false) {
  const S = await kit(browser, vp, { keepPlans: true });
  if (small) await S.page.evaluate(() => PC.store.commit((s) => { for (const lv of ['G', '1']) { const keep = s.ans.rooms.filter((r) => r.level === lv).slice(0, 3).map((r) => r.id); for (const r of s.ans.rooms.filter((x) => x.level === lv && !keep.includes(x.id))) PC.levels.removeRoom(s, r.id); } PC.plans.sync(s); }, { nav: true }));
  await S.page.evaluate(() => PC.store.commit((s) => { for (const lv of ['G', '1']) { const q = s.plans[lv].rooms[0]; PC.plans.applyEdit(s, lv, { ...q, w: Math.round((q.w - 0.5) * 100) / 100 }); PC.plans.approve(s, lv); } }));
  S.orig = await S.state();
  if (!(S.orig.plans.G.edited && S.orig.plans.G.approved && S.orig.plans['1'].edited && S.orig.plans['1'].approved)) R.check(`${vp.tag} seed: both floors edited + approved`, ['not seeded']);
  await S.openGroup('rooms');
  return S;
}
const row = (id) => `css:[data-pc="room-list"] [data-room="${id}"]`;
// Answer every dialog the change opens: the R5 question (Continue) and the remove-level question (choice, then OK).
async function answer(S, choice) { const seen = []; for (let i = 0; i < 3; i++) { if (!(await S.until(() => S.dialogOpen(), 1200))) break; const d = await S.dialogText(); seen.push(d.title); if (choice && d.move && !d[choice === 'move' ? 'move' : 'del'].disabled) await S.act(`css:[data-pc="dialog-layer"] label:has([data-pc="level-remove-${choice}"])`); await S.act('dialog-ok'); await S.waitDialog(false); await S.settle(); } return seen; }
// After a change: flush, reload, Resume; compare with my expectation; then stage 3 changes nothing more.
async function reloadAndJudge(S, label) {
  const V = S.vp.tag; await S.flush(); const saved = await S.state();
  await S.reload();
  const offered = await S.shown('resume-box'), parsed = await S.page.evaluate((k) => { const d = PC.draft.parse(localStorage.getItem(k)); return d && JSON.parse(JSON.stringify(d.state)); }, (await S.page.evaluate(() => PC.draft.KEY)));
  R.check(`${V} ${label}: reload offers Resume and the stored draft parses to the saved state exactly`, offered && eq(parsed, saved) ? [] : [JSON.stringify({ offered, parsed: !!parsed })]);
  if (!offered) return null;
  await S.act('btn-resume'); await S.settle();
  const back = await S.state(), f = [], changed = [];
  for (const lv of levelsOf(saved.ans)) { const old = S.orig.plans[lv], p = back.plans[lv], same = old && fp(S.orig, lv) === fp(saved, lv);
    if (same) { if (!eq(p, saved.plans[lv]) || !p.edited || !p.approved) f.push(`${lv}: unchanged floor lost its plan / edits / approval`); }
    else { changed.push(lv); const ids = p ? p.rooms.map((r) => r.id).sort().join() : '-', want = saved.ans.rooms.filter((r) => r.level === lv).map((r) => r.id).sort().join();
      if (!p || p.edited || p.approved || p.error || ids !== want) f.push(`${lv}: changed floor not laid out again for its rooms (${ids} vs ${want}, edited ${p && p.edited}, approved ${p && p.approved})`); } }
  const a = Object.fromEntries(Object.entries(back).filter(([k]) => k !== 'plans')), b = Object.fromEntries(Object.entries(saved).filter(([k]) => k !== 'plans'));
  if (!eq(a, b)) f.push('answers / plot / stage differ after Resume');
  if (!eq(Object.keys(back.plans).sort(), levelsOf(saved.ans).sort())) f.push('plan levels ' + Object.keys(back.plans));
  R.check(`${V} ${label}: Resume keeps answers and the unchanged floors' edits + approvals; the changed floor(s) [${changed}] are laid out again`, f);
  const before3 = await S.state(); await S.act('step-3'); await S.settle(); const at3 = await S.state();
  R.check(`${V} ${label}: entering stage 3 changes no plan`, (await S.stages()) === '3' && eq(at3.plans, before3.plans) ? [] : [JSON.stringify({ st: await S.stages(), diff: Object.keys(at3.plans).filter((k) => !eq(at3.plans[k], before3.plans[k])).map((k) => [k, before3.plans[k], at3.plans[k]]) }).slice(0, 1500)]);
  return { saved, back };
}

const browser = await launch();
try {
  for (const vp of RUN) {
    const V = vp.tag;
    // ---- A. delete a Ground room ----
    { const S = await seeded(browser, vp); try {
      const id = S.orig.ans.rooms.find((r) => r.level === 'G' && !S.orig.ans.pairs.some((p) => p.includes(r.id))).id;
      await S.act(`${row(id)} [data-pc="room-delete"]`); const asked = await answer(S);
      const s = await S.state(); R.check(`${V} A delete ${id}: the R5 question once, room gone, every plan untouched (the Ground plan now stale)`, asked.length === 1 && !s.ans.rooms.some((r) => r.id === id) && eq(s.plans, S.orig.plans) ? [] : [JSON.stringify({ asked, plansKept: eq(s.plans, S.orig.plans) })]);
      await reloadAndJudge(S, 'A delete a room');
    } catch (e) { R.check(`${V} crashed`, [String(e && e.stack || e).slice(0, 400)]); } finally { await S.end(`${V} A`); } }
    // ---- B. move a room to the other floor ----
    { const S = await seeded(browser, vp); try {   // the smallest unpaired Ground room, so First still fits (stage 3 stays reachable)
      const id = S.orig.ans.rooms.filter((r) => r.level === 'G' && !S.orig.ans.pairs.some((p) => p.includes(r.id))).sort((a, b) => AREA[a.type][a.size] - AREA[b.type][b.size])[0].id;
      await S.page.locator(`[data-pc="room-list"] [data-room="${id}"] [data-pc="room-level"]`).selectOption('1'); await S.settle(); const asked = await answer(S);
      const s = await S.state(); R.check(`${V} B move ${id} to the First floor: asked once, the room is on First, plans untouched`, asked.length === 1 && s.ans.rooms.find((r) => r.id === id).level === '1' && eq(s.plans, S.orig.plans) ? [] : [JSON.stringify({ asked })]);
      await reloadAndJudge(S, 'B move a room');
    } catch (e) { R.check(`${V} crashed`, [String(e && e.stack || e).slice(0, 400)]); } finally { await S.end(`${V} B`); } }
    // ---- C / D. remove the First floor with move / delete ----
    for (const [tag, choice] of [['C', 'move'], ['D', 'delete']]) { const S = await seeded(browser, vp, true); try {
      await S.openGroup('building'); await S.act(lab('q-floors', '1')); const asked = await answer(S, choice);
      const s = await S.state(), firstRooms = S.orig.ans.rooms.filter((r) => r.level === '1').map((r) => r.id);
      const ok = s.ans.floors === 1 && !s.plans['1'] && eq(s.plans.G, S.orig.plans.G) && (choice === 'move' ? firstRooms.every((id) => s.ans.rooms.find((r) => r.id === id).level === 'G') : !s.ans.rooms.some((r) => firstRooms.includes(r.id)));
      R.check(`${V} ${tag} remove the First floor (${choice}): asked (${asked.join(' / ')}), First plan gone, Ground plan untouched, rooms ${choice === 'move' ? 'moved to Ground' : 'deleted'}`, asked.length >= 1 && ok ? [] : [JSON.stringify({ floors: s.ans.floors, plans: Object.keys(s.plans), asked })]);
      await reloadAndJudge(S, `${tag} remove a floor (${choice})`);
    } catch (e) { R.check(`${V} crashed`, [String(e && e.stack || e).slice(0, 400)]); } finally { await S.end(`${V} ${tag}`); } }
    // ---- E. away and back ----
    { const S = await seeded(browser, vp); try {
      const id = S.orig.ans.rooms.find((r) => r.level === '1' && !r.master && !S.orig.ans.pairs.some((p) => p.includes(r.id))).id, sel = S.page.locator(`[data-pc="room-list"] [data-room="${id}"] [data-pc="room-level"]`);
      await sel.selectOption('G'); await S.settle(); const away = await answer(S);
      await sel.selectOption('1'); await S.settle(); const backQ = await answer(S);
      const s = await S.state(); R.check(`${V} E away and back in one session: asked once going away (${away}), nothing coming back; plans are the originals`, away.length === 1 && backQ.length === 0 && eq(s.plans, S.orig.plans) ? [] : [JSON.stringify({ away, backQ })]);
      await S.act('step-3'); await S.settle(); const s3 = await S.state();
      R.check(`${V} E stage 3 after away and back: both floors keep their edits and approvals exactly (A-7)`, eq(s3.plans, S.orig.plans) ? [] : ['plans regenerated']);
      // across reload + Resume (Resume lays stale plans out again, A-7 sync): away, reload, Resume, back
      await S.act('step-2'); await S.openGroup('rooms'); await sel.selectOption('G'); await S.settle(); await answer(S); await S.flush(); await S.reload(); await S.act('btn-resume'); await S.settle();
      const r1 = await S.state(); await S.openGroup('rooms').catch(() => {});
      if ((await S.stages()) !== '2') { await S.act('step-2'); await S.openGroup('rooms'); }
      await S.page.locator(`[data-pc="room-list"] [data-room="${id}"] [data-pc="room-level"]`).selectOption('1'); await S.settle(); const q2 = await answer(S); const r2 = await S.state();
      R.check(`${V} E across reload + Resume: Resume lays both changed floors out again (no edits / approvals), moving back then asks nothing and the plans stay draft`, !r1.plans.G.approved && !r1.plans['1'].approved && !r1.plans['1'].edited && q2.length === 0 && !r2.plans['1'].approved ? [] : [JSON.stringify({ r1: [r1.plans.G.approved, r1.plans['1'].approved], q2 })]);
    } catch (e) { R.check(`${V} crashed`, [String(e && e.stack || e).slice(0, 400)]); } finally { await S.end(`${V} E`); } }
  }

  // ---- F. forged drafts, side key, storage throwing (360x640) ----
  if (!only.length || only.includes('360x640')) {
    const vp = VP['360x640'], S = await kit(browser, vp, { keepPlans: true, stage2: false }); try {
      const K = await S.page.evaluate(() => PC.draft.KEY), base = await S.state();
      // A draft is stored before the app's scripts run on the next load (init script reads a sessionStorage hand-off), so
      // the running page's own autosave can never overwrite it.
      await S.page.addInitScript(`try { if (sessionStorage.qaNext) { localStorage.setItem(${JSON.stringify(K)}, sessionStorage.qaNext); sessionStorage.removeItem('qaNext'); } } catch (e) {}`);
      const write = async (text) => { await S.page.evaluate((t) => { sessionStorage.qaNext = t; }, text); await S.reload(); };
      const ser = (s) => S.page.evaluate((s) => PC.draft.serialize(s, Date.now()), s);
      const side = () => S.rawKey(SIDE), gRoom = base.ans.rooms.find((r) => r.level === 'G').id;
      const look = async () => ({ resume: await S.shown('resume-box'), start: await S.shown('start-panel'), draft: await S.rawKey(K), side: await side() });
      for (const [what, mut] of [['a Ground room', (s) => { s.plans['1'].rooms[0].id = gRoom; }], ['an unknown room', (s) => { s.plans['1'].rooms[0].id = 'r99'; s.ans.nextRoomId = 100; }]]) {
        const s = JSON.parse(JSON.stringify(base)); mut(s); const raw = await ser(s); await write(raw); const L = await look();
        R.check(`360x640 F fresh-signature First plan listing ${what}: discarded silently (no Resume, start panel), draft key gone, raw text under ${SIDE}`, !L.resume && L.start && L.draft === null && L.side === raw ? [] : [JSON.stringify({ ...L, side: L.side && L.side.length })]); }
      { const s = JSON.parse(JSON.stringify(base)); s.plans['1'].rooms[0].id = gRoom; s.plans['1'].sig = 'old'; s.plans['1'].approved = false; const before = await side(); await write(await ser(s)); const L = await look();
        R.check('360x640 F the same plan with a stale signature: Resume offered; the side key is left as it was', L.resume && L.side === before ? [] : [JSON.stringify({ resume: L.resume })]);
        if (L.resume) { await S.act('btn-resume'); await S.settle(); const t = await S.state(), ids = t.plans['1'].rooms.map((r) => r.id).sort().join(), want = t.ans.rooms.filter((r) => r.level === '1').map((r) => r.id).sort().join();
          R.check('360x640 F Resume lays the forged stale First plan out again (exactly its rooms) and keeps the Ground plan', ids === want && eq(t.plans.G, base.plans.G) ? [] : [ids + ' vs ' + want]); } }
      { await write('{"v":2,"savedAt":1,"state":{broken'); const L = await look();
        R.check(`360x640 F corrupted draft: no Resume, draft key gone, raw text under ${SIDE}`, !L.resume && L.draft === null && L.side === '{"v":2,"savedAt":1,"state":{broken' ? [] : [JSON.stringify(L)]);
        await write(await ser(base)); R.check('360x640 F a valid draft afterwards is offered', await S.shown('resume-box'));
        await S.act('btn-startnew'); await answer(S); R.check('360x640 F Start new deletes the draft but leaves the side key', (await S.rawKey(K)) === null && (await side()) === '{"v":2,"savedAt":1,"state":{broken' ? [] : ['side key changed']);
        await write(await ser(base)); await S.act('btn-sample'); await answer(S); await S.flush();
        R.check('360x640 F Load sample over an offered draft leaves the side key alone', (await side()) === '{"v":2,"savedAt":1,"state":{broken' && (await S.state()).sampleClean !== undefined ? [] : ['side key changed']); }
    } catch (e) { R.check(`${V} crashed`, [String(e && e.stack || e).slice(0, 400)]); } finally { await S.end('360x640 F'); }
    for (const mode of ['getter-throws', 'set-throws']) { const T = await session(browser, vp, { init: [STORAGE_MODES[mode]] }); try {
      await T.act('btn-sample'); await T.settle(); R.check(`360x640 F localStorage ${mode}: the sample loads and works (stage 2 reachable), no Resume card`, !(await T.shown('resume-box')) && (await T.state()).plot.closed ? [] : ['broken']);
    } finally { await T.end(`360x640 F ${mode}`); } }
  }
} finally { await browser.close(); }
process.exit(R.done() ? 0 : 1);
