// F4-T2 Step 0 QA (browser): the UI half of the TL's QA focus list (docs/03-tasks/F4-T2/impl-review-step0.md), driven
// with real input (CDP touch at 360x640 and 640x360, mouse at 1280x800). Expectations are QA's own, from
// goals-and-stories.md rounds 8 and 10 and client-decisions.md CD-4 / CD-5; rectangles from QA's editor oracle
// (f3-t2-ref.mjs), access from QA's CD-5 oracle (f4-t2-ref.mjs).
//   A  CD-4: 10 rooms on one floor at 360x640 - every room labelled, no two labels overlapping, each inside its room.
//   U  one-step Undo: after a move and a resize, restores the approval ("... approved again."), one step only, focus on
//      Regenerate; hidden after Regenerate, an R5 reset, approve / unapprove, a floor-tab switch (and back), leaving
//      stage 3 and a Load-sample replace; tool row not taller, canvas scale unchanged (>= 14 px/m on phones).
//   C  CD-5 live: a drag that boxes a room in shows the PM's exact line (numbered name where the type repeats),
//      Undo removes it, Approve still works with it shown; the sample shows none.
//   L  low fill: default answers on a 40 x 40 m plot show the hint, same text in m and ft; 48 % shown, 50 % not.
//   M  ft minimum: shrinking an edge stops at exactly 1.5 m (4.9 ft) with no guide line; m unchanged.
//   O  lift-only overlap: marked, Approve disabled.   S  sample strip: Skip from stages 1 and 3 opens stage 5.
// Run: node tests/qa/f4-t2-s0-ui.mjs [--no-shots] [--only=360x640,...] [--sec=A,U,...]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VIEWPORTS, launch, collector } from './lib.mjs';
import { sessions, eq } from './session.mjs';
import * as Q from './f2-t1-ref.mjs';
import { stage2Kit } from './stage2kit.mjs';
import { GRID, myMove, myResize, myOverlaps } from './f3-t2-ref.mjs';
import { myAccess, ACCESS_TEXT, LOWFILL_TEXT } from './f4-t2-ref.mjs';

const SHOTS = join(ROOT, 'tests/qa/shots/F4-T2'); mkdirSync(SHOTS, { recursive: true });
const noShots = process.argv.includes('--no-shots');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const secs = (process.argv.find((a) => a.startsWith('--sec=')) || '').slice(6).split(',').filter(Boolean), want = (s) => !secs.length || secs.includes(s);
const R = collector('F4-T2 Step 0 UI');
const session = sessions({ R, shots: SHOTS, noShots });
const { kit } = stage2Kit({ R, session });
const VP = Object.fromEntries(VIEWPORTS.map((v) => [v.tag, v]));
// run-time trim (QA batch 13, TL F5-T2 ruling 3): 640x360 only with QA_FULL=1 (standing condition: before each feature
// review and whenever the Step 0 editor / CD-5 / low-fill code changes); 360x640 touch and 1280x800 mouse by default
// TL ruling after the 488 s QA_FULL gate (F6-T1a): 640x360 leaves QA_FULL=1 and runs in the release step (QA_RELEASE=1,
// --only=640x360 from f6-t1-leak.mjs --max-only)
const RUN = [VP['360x640'], ...(process.env.QA_RELEASE ? [VP['640x360']] : []), VP['1280x800']].filter((v) => !only.length || only.includes(v.tag));
const NAMES = { bedroom: 'Bedroom', bathroom: 'Bathroom', kitchen: 'Kitchen', living: 'Living', dining: 'Dining', majlis: 'Majlis', office: 'Office', maid: "Maid's room", storage: 'Storage', laundry: 'Laundry' };
function myNames(a) { const out = {}, num = (id) => parseInt(id.slice(1), 10);
  for (const lv of Q.levelIds(a)) { const g = {}; for (const r of a.rooms.filter((x) => x.level === lv).sort((p, q) => num(p.id) - num(q.id))) { if (r.master) { out[r.id] = 'Master bedroom'; continue; } (g[r.type] = g[r.type] || []).push(r); }
    for (const t in g) g[t].forEach((r, i) => { out[r.id] = NAMES[t] + (g[t].length > 1 ? ' ' + (i + 1) : ''); }); }
  return out; }
const LEVEL = { B: 'Basement', G: 'Ground floor', 1: 'First floor', 2: 'Second floor' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const ACCESS_RE = /has no way in from the hall or stairs/, FILL_RE = /^Rooms fill only/;

// what stage 3 shows, viewport px; world axes on screen so drags are given in metres
const G = () => { const s = PC.debug.state(), v = PC.debug.planView(), fp = PC.debug.site().footprint, q = (h) => document.querySelector(`[data-pc="${h}"]`), t = (h) => q(h).textContent.trim().replace(/\s+/g, ' ');
  const sc = (x, y) => PC.debug.toScreen('plan', fp.u + x, fp.v + y), o = sc(0, 0), ex = sc(1, 0), ey = sc(0, 1);
  const box = (r) => { const a = sc(r.x, r.y), b = sc(r.x + r.w, r.y + r.h); return { l: Math.min(a[0], b[0]), r: Math.max(a[0], b[0]), t: Math.min(a[1], b[1]), b: Math.max(a[1], b[1]) }; };
  const p = s.plans[v.level], core = PC.layout.core(fp.w, fp.d, PC.levels.stairsExist(s), s.ans.stairPos, PC.levels.liftExists(s)), btn = q('btn-approve'), undo = q('plan-undo'), row = q('btn-regenerate').parentElement.getBoundingClientRect(), cv = q('plan-canvas').getBoundingClientRect();
  const ub = undo.getBoundingClientRect();
  return { s: JSON.parse(JSON.stringify(s)), level: v.level, selected: v.selected, scale: v.scale, W: fp.w, D: fp.d, ax: [[ex[0] - o[0], ex[1] - o[1]], [ey[0] - o[0], ey[1] - o[1]]],
    rooms: p && !p.error ? p.rooms.map((r) => ({ ...r, box: box(r) })) : [], core: { stair: core.stair || null, lift: core.lift || null }, minSnap: PC.plans.ctx(s, v.level).minSnap === true,
    sel: [t('plan-room-name'), t('plan-room-dims'), t('plan-room-area')], msg: t('plan-msg'), warn: [...q('plan-warn-list').querySelectorAll('li')].map((li) => li.textContent.trim().replace(/\s+/g, ' ')),
    approve: { disabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true', on: btn.classList.contains('is-approved') },
    undo: { shown: !undo.hidden && ub.width > 0, w: ub.width, h: ub.height, label: undo.getAttribute('aria-label'), title: undo.title }, row: row.height, canvas: [cv.width, cv.height],
    focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.pc || null : null, drag: PC.debug.planDrag(), stage: s.stage,
    labels: PC.debug.planLabels(), cvo: [cv.left, cv.top] }; };
const centre = (b) => [(b.l + b.r) / 2, (b.t + b.b) / 2];
const toScr = (P, dx, dy) => [dx * P.ax[0][0] + dy * P.ax[1][0], dx * P.ax[0][1] + dy * P.ax[1][1]];
const add = (a, d) => [a[0] + d[0], a[1] + d[1]];
function myHandle(P, id, kind) { const r = P.rooms.find((x) => x.id === id), b = r.box, [cx, cy] = centre(b), wide = b.r - b.l >= 66, tall = b.b - b.t >= 66;
  const mid = { n: [r.x + r.w / 2, r.y + r.h], s: [r.x + r.w / 2, r.y], e: [r.x + r.w, r.y + r.h / 2], w: [r.x, r.y + r.h / 2] }[kind];
  const sx = cx + (mid[0] - (r.x + r.w / 2)) * P.ax[0][0] + (mid[1] - (r.y + r.h / 2)) * P.ax[1][0], sy = cy + (mid[0] - (r.x + r.w / 2)) * P.ax[0][1] + (mid[1] - (r.y + r.h / 2)) * P.ax[1][1];
  const small = kind === 'e' || kind === 'w' ? !wide : !tall, d = Math.hypot(sx - cx, sy - cy) || 1;
  return small ? [sx + (sx - cx) / d * 22, sy + (sy - cy) / d * 22] : [sx, sy]; }
const rect = (X, id) => { const { box, ...r } = X.rooms.find((x) => x.id === id); return r; };
const envOf = (X) => ({ W: X.W, D: X.D, grid: GRID[X.s.ans.unit], rooms: X.rooms.map(({ box, ...r }) => r), core: X.core, minSnap: X.minSnap });
const oracle = (fn) => { const out = []; for (const a of [0, -0.04, 0.04]) for (const b of [0, -0.04, 0.04]) out.push(JSON.stringify(fn(a, b))); return out; };
const typesOf = (s) => Object.fromEntries(s.ans.rooms.map((r) => [r.id, r.type]));
const pairsOn = (s, lv) => s.ans.pairs.filter((p) => p.every((id) => (s.ans.rooms.find((r) => r.id === id) || {}).level === lv));

const browser = await launch();
const t0 = Date.now();
try {
  for (const vp of RUN) {
    const V = vp.tag, touch = vp.touch;
    const open = async (opts = {}) => { const S = await kit(browser, vp, { keepPlans: true, stage2: false, ...opts });
      S.P = () => S.page.evaluate(G);
      S.toStage3 = async () => { for (let i = 0; i < 4 && (await S.stages()) !== '3'; i++) { await S.act('btn-next'); await S.settle(); } };
      S.drag = async (from, dx, dy, during) => { const X = await S.P(); let mid = null; await S.dragPts(from, add(from, toScr(X, dx, dy)), async () => { await S.settle(); mid = await S.P(); if (during) await during(mid); }); await S.settle(); return mid; };
      S.tab = async (lv) => { await S.act(`css:[data-pc="plan-tabs"] [data-level="${lv}"]`); await S.settle(); };
      S.move = async (id, dx, dy) => { const X = await S.P(); await S.drag(centre(X.rooms.find((r) => r.id === id).box), dx, dy); return X; };
      return S; };

    // ======================= A. CD-4: 10 rooms on one floor, labels at 360x640 =======================
    if (want('A') && V === '360x640') {
      const S = await open();
      await S.page.evaluate(() => PC.store.commit((s) => { let id = s.ans.nextRoomId; const T = ['office', 'storage', 'bedroom']; for (let k = 0; s.ans.rooms.filter((r) => r.level === 'G').length < PC.C.MAX_ROOMS_PER_LEVEL; k++) s.ans.rooms.push({ id: 'r' + id++, type: T[k % 3], level: 'G', size: 'S', area: null, master: false }); s.ans.nextRoomId = id; s.ans.footprintPct = 60; }));
      await S.toStage3(); await S.tab('G');
      for (const u of ['m', 'ft']) { await S.act('unit-' + u); await S.settle(); const X = await S.P(), f = [];
        if (X.rooms.length !== 10) f.push(`${X.rooms.length} rooms drawn`);
        const L = X.labels.map((l) => ({ ...l, cx: X.cvo[0] + l.x + l.w / 2, cy: X.cvo[1] + l.y + l.h / 2, x0: X.cvo[0] + l.x, x1: X.cvo[0] + l.x + l.w, y0: X.cvo[1] + l.y, y1: X.cvo[1] + l.y + l.h }));
        for (const r of X.rooms) if (!L.some((l) => l.cx >= r.box.l && l.cx <= r.box.r && l.cy >= r.box.t && l.cy <= r.box.b)) f.push(`${r.id} has no label`);
        for (const l of L) { const r = X.rooms.find((x) => l.cx >= x.box.l && l.cx <= x.box.r && l.cy >= x.box.t && l.cy <= x.box.b); if (r && (l.x0 < r.box.l - 1 || l.x1 > r.box.r + 1 || l.y0 < r.box.t - 1 || l.y1 > r.box.b + 1)) f.push(`label "${l.text}" spills out of ${r.id}`); }
        const roomAt = (l) => (X.rooms.find((x) => l.cx >= x.box.l && l.cx <= x.box.r && l.cy >= x.box.t && l.cy <= x.box.b) || {}).id;   // the name / area lines of one room are stacked by design
        for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (roomAt(L[i]) !== roomAt(L[j]) && Math.min(L[i].x1, L[j].x1) - Math.max(L[i].x0, L[j].x0) > 0.5 && Math.min(L[i].y1, L[j].y1) - Math.max(L[i].y0, L[j].y0) > 0.5) f.push(`labels "${L[i].text}" and "${L[j].text}" overlap`);
        R.check(`${V} A 10 rooms on the Ground floor (${u}, scale ${X.scale.toFixed(1)} px/m): every room labelled, labels inside their rooms, none overlapping`, f);
        await S.shot(`A-10rooms-${u}`); }
      await S.layout(`${V} A 10 rooms stage 3`); await S.end(`${V} A`);
    }

    // ======================= U. one-step Undo =======================
    if (want('U')) {
      const S = await open(); await S.toStage3(); await S.tab('G');
      let X = await S.P(); const names = myNames(X.s.ans), base = { row: X.row, canvas: X.canvas, scale: X.scale };
      R.check(`${V} U sample, Ground floor: Undo hidden before any edit; scale ${X.scale.toFixed(2)} px/m${touch ? ' (>= 14 on phones)' : ''}`, !X.undo.shown && (!touch || X.scale >= 14 - 1e-9) ? [] : [JSON.stringify([X.undo, X.scale])]);
      // move
      const p0 = JSON.stringify(X.s.plans.G); await S.move('r7', 0, 2.3); X = await S.P();
      const Xs = X; await S.shot('U-shown');
      await S.act('plan-undo'); X = await S.P();
      // the sample strip leaves with the first real edit (sampleClean ends), so the hidden-Undo reference is the state after the Undo
      R.check(`${V} U Undo shown after a move, named "Undo last edit" (aria-label and tooltip)${touch ? ', >= 44 x 44 px' : ''}; with Undo shown vs hidden the tool row is not taller and the canvas size and scale are unchanged${touch ? ' (>= 14 px/m)' : ''}`, Xs.undo.shown && Xs.undo.label === 'Undo last edit' && Xs.undo.title === 'Undo last edit' && (!touch || (Xs.undo.w >= 44 - 0.5 && Xs.undo.h >= 44 - 0.5)) && Xs.row <= X.row + 0.5 && Math.abs(Xs.scale - X.scale) < 1e-6 && eq(Xs.canvas, X.canvas) && (!touch || Xs.scale >= 14 - 1e-9) ? [] : [JSON.stringify({ undo: Xs.undo, row: [Xs.row, X.row], scale: [Xs.scale, X.scale], canvas: [Xs.canvas, X.canvas] })]);
      R.note(`${V} U tool row ${X.row.toFixed(0)} px; scale ${base.scale.toFixed(2)} px/m with the sample strip, ${X.scale.toFixed(2)} without`);
      R.check(`${V} U Undo after a move: the plan is back exactly, "Last edit undone.", Undo hidden, focus on Regenerate`, JSON.stringify(X.s.plans.G) === p0 && X.msg === 'Last edit undone.' && !X.undo.shown && X.focus === 'btn-regenerate' ? [] : [JSON.stringify({ msg: X.msg, undo: X.undo.shown, focus: X.focus, same: JSON.stringify(X.s.plans.G) === p0 })]);
      // resize
      X = await S.P(); await S.tapAt(centre(X.rooms.find((r) => r.id === 'r1').box)); X = await S.P(); const p1 = JSON.stringify(X.s.plans.G), st1 = rect(X, 'r1');
      await S.drag(myHandle(X, 'r1', 'e'), -0.8, 0); X = await S.P(); const resized = !eq(rect(X, 'r1'), st1);
      await S.act('plan-undo'); X = await S.P();
      R.check(`${V} U Undo after a resize (${names.r1} east edge): plan back exactly, Undo hidden`, resized && JSON.stringify(X.s.plans.G) === p1 && !X.undo.shown ? [] : [JSON.stringify({ resized, back: JSON.stringify(X.s.plans.G) === p1, undo: X.undo.shown })]);
      // one step only
      await S.move('r7', 0, 2.3); X = await S.P(); const mid = JSON.stringify(X.s.plans.G); await S.move('r5', 0, 2); await S.act('plan-undo'); X = await S.P();
      R.check(`${V} U two edits then Undo: only the last one is undone, and no second Undo is offered`, JSON.stringify(X.s.plans.G) === mid && !X.undo.shown ? [] : [JSON.stringify({ same: JSON.stringify(X.s.plans.G) === mid, undo: X.undo.shown })]);
      // restored approval: approve (back to a fresh, overlap-free plan first), edit, undo
      await S.act('plan-undo').catch(() => {}); X = await S.P();
      if (!X.approve.disabled) { await S.act('btn-approve'); }
      X = await S.P(); const appr = X.s.plans.G.approved, pA = JSON.stringify(X.s.plans.G);
      await S.move('r7', 0, 2.3); X = await S.P(); const draftAfter = !X.s.plans.G.approved;
      await S.act('plan-undo'); X = await S.P();
      R.check(`${V} U approved floor, edit (back to Draft), Undo: approved again, "Last edit undone. Ground floor approved again."`, appr && draftAfter && X.s.plans.G.approved && JSON.stringify(X.s.plans.G) === pA && X.msg === `Last edit undone. ${cap(LEVEL.G)} approved again.` ? [] : [JSON.stringify({ appr, draftAfter, now: X.s.plans.G.approved, msg: X.msg })]);
      // hide cases
      const hid = [];
      let flip = 1; const after = async (what, fn) => { await S.move('r7', 0, 2.3 * flip); flip = -flip; const a = await S.P(); if (!a.undo.shown) { hid.push(`${what}: Undo not shown after the edit`); return; } await fn(); const b = await S.P(); if (b.undo.shown) hid.push(`${what}: Undo still shown`); };
      await after('approve', async () => { const a = await S.P(); if (!a.approve.disabled) await S.act('btn-approve'); else hid.push('approve: button disabled (overlap?)'); });
      await after('unapprove after approve', async () => { const a = await S.P(); if (!a.approve.disabled) { await S.act('btn-approve'); await S.act('btn-approve'); } });
      await after('floor-tab switch (to First)', async () => { await S.tab('1'); });
      await S.tab('G'); { const b = await S.P(); if (b.undo.shown) hid.push('tab switch and back: Undo shown again'); }
      await after('Regenerate', async () => { await S.act('btn-regenerate'); if (await S.waitDialog()) { await S.act('dialog-ok'); await S.waitDialog(false); } await S.settle(); });
      // R5 happens on stage 2 (answers only change there): Back, change a Ground-floor room's size (the R5 change), Next
      await after('R5 reset (Back, a Ground-floor room size changed on stage 2, Next)', async () => { await S.act('btn-back'); await S.settle(); await S.page.evaluate(() => PC.store.commit((s) => { const r = s.ans.rooms.find((x) => x.id === 'r7'); r.size = r.size === 'S' ? 'M' : 'S'; })); await S.settle(); await S.toStage3(); await S.tab('G'); const b = await S.P(); if (b.s.plans.G.edited) hid.push('R5: the Ground floor was not regenerated'); });
      await after('leaving stage 3 (Back, then Next)', async () => { await S.act('btn-back'); await S.settle(); await S.toStage3(); await S.tab('G'); });
      await after('Load sample (store replace)', async () => { await S.page.evaluate(() => { const s = PC.sample.state(); s.stage = 3; PC.store.replace(s); }); await S.settle(); await S.toStage3(); await S.tab('G'); });
      R.check(`${V} U Undo is hidden after approve, approve + unapprove, a floor-tab switch (and stays hidden back on the floor), Regenerate, an R5 reset, leaving stage 3 and Load sample`, hid);
      await S.end(`${V} U`);
    }

    // ======================= C. CD-5 live =======================
    if (want('C') && V !== '640x360') {
      const S = await open(); await S.toStage3();
      const f0 = []; for (const lv of ['G', '1']) { await S.tab(lv); const X = await S.P(); const a = X.warn.filter((w) => ACCESS_RE.test(w)); if (a.length) f0.push(`${lv}: ${JSON.stringify(a)}`); }
      R.check(`${V} C the sample shows no hall-access line on either floor (6.2)`, f0);
      // find (QA's oracle) a move on the First floor that leaves a numbered room (Bathroom 1 / 2) boxed in, overlap-free
      await S.tab('1'); let X = await S.P(); const names = myNames(X.s.ans), types = typesOf(X.s), env = envOf(X); let pick = null;
      const order = X.rooms.map((r) => r.id);
      search: for (const id of order) for (let dx = -4; dx <= 4; dx += 0.5) for (let dy = -4; dy <= 4; dy += 0.5) { if (!dx && !dy) continue;
        const st = rect(X, id), nr = myMove(st, dx, dy, env), rooms = env.rooms.map((r) => (r.id === id ? nr : r));
        if (myOverlaps(rooms, X.core).length) continue; const acc = myAccess(X.W, X.D, rooms, X.core, pairsOn(X.s, '1'), types).ids;
        if (acc.some((x) => /\d$/.test(names[x]))) { pick = { id, dx, dy, acc }; break search; } }
      if (!pick) R.check(`${V} C a First-floor move boxing in a numbered room exists (QA search)`, ['none found']);
      else {
        await S.move(pick.id, pick.dx, pick.dy); X = await S.P(); const rooms = X.rooms.map(({ box, ...r }) => r), mine = myAccess(X.W, X.D, rooms, X.core, pairsOn(X.s, '1'), types).ids;
        const exp = mine.map((id) => ACCESS_TEXT(names[id])).sort(), got = X.warn.filter((w) => ACCESS_RE.test(w)).sort();
        R.check(`${V} C after dragging ${names[pick.id]} (${pick.dx}, ${pick.dy}) m: one line per boxed room, PM's exact text, numbered names (${mine.map((i) => names[i]).join(', ')})`, eq(got, exp) && mine.length && !myOverlaps(rooms, X.core).length ? [] : [`got ${JSON.stringify(got)}`, `QA ${JSON.stringify(exp)}`]);
        await S.shot('C-access');
        await S.act('plan-undo'); X = await S.P();
        R.check(`${V} C Undo: the hall-access lines are gone again (updated live)`, !X.warn.some((w) => ACCESS_RE.test(w)) ? [] : [JSON.stringify(X.warn)]);
        await S.move(pick.id, pick.dx, pick.dy); X = await S.P(); const shown = X.warn.some((w) => ACCESS_RE.test(w));
        if (!X.approve.disabled) await S.act('btn-approve'); X = await S.P();
        R.check(`${V} C with the hall-access line shown, Approve is enabled and approves the floor (never blocking)`, shown && X.s.plans['1'].approved ? [] : [JSON.stringify({ shown, approved: X.s.plans['1'].approved, disabled: X.approve.disabled })]);
      }
      await S.end(`${V} C`);
    }

    // ======================= L. low fill =======================
    if (want('L') && V !== '640x360') {
      const S = await open({ plot: [[0, 0], [40, 0], [40, 40], [0, 40]], sample: false }); await S.toStage3(); await S.tab('G');
      let X = await S.P(); const pct = await S.page.evaluate(() => PC.plans.lowFill(PC.debug.state(), 'G'));
      const fm = X.warn.filter((w) => FILL_RE.test(w)); await S.act('unit-ft'); await S.settle(); X = await S.P(); const ff = X.warn.filter((w) => FILL_RE.test(w));
      R.check(`${V} L default answers on a 40 x 40 m plot, Ground floor: "${LOWFILL_TEXT(pct, LEVEL.G)}" in m, the same in ft`, pct !== null && eq(fm, [LOWFILL_TEXT(pct, LEVEL.G)]) && eq(ff, fm) ? [] : [JSON.stringify({ pct, fm, ff })]);
      await S.act('unit-m');
      const setFill = (frac) => S.page.evaluate((frac) => PC.store.commit((s) => { const c = PC.plans.ctx(s, 'G'), p = s.plans.G, core = [c.core.stair, c.core.lift].filter(Boolean).reduce((a, b) => a + b.w * b.h, 0), others = p.rooms.slice(1).reduce((a, r) => a + r.w * r.h, 0); p.rooms[0].h = (frac * c.W * c.D - core - others) / p.rooms[0].w; }), frac);
      const f = []; for (const [frac, exp] of [[0.48, 48], [0.5, null]]) { await setFill(frac); X = await S.P(); const got = X.warn.filter((w) => FILL_RE.test(w)), w = exp === null ? [] : [LOWFILL_TEXT(exp, LEVEL.G)]; if (!eq(got, w)) f.push(`fill ${frac}: ${JSON.stringify(got)}`); }
      R.check(`${V} L fill 48 %: "${LOWFILL_TEXT(48, LEVEL.G)}"; fill exactly 50 %: no hint`, f);
      await S.end(`${V} L`);
    }

    // ======================= M. ft minimum =======================
    if (want('M')) {
      const S = await open(); await S.toStage3(); await S.tab('G'); const f = [];
      for (const u of ['ft', 'm']) {
        await S.act('unit-' + u); await S.settle(); let X = await S.P(); await S.tapAt(centre(X.rooms.find((r) => r.id === 'r1').box)); X = await S.P(); const st = rect(X, 'r1');
        let mid = null; await S.drag(myHandle(X, 'r1', 's'), 0, st.h, async (M) => { mid = M; });
        X = await S.P(); const got = rect(X, 'r1'), exp = oracle((a, b) => myResize(st, 's', a, st.h + b, envOf({ ...X, rooms: X.rooms.map((r) => (r.id === 'r1' ? { ...r, ...st } : r)) })));
        if (Math.abs(got.h - 1.5) > 1e-9) f.push(`${u}: height ${got.h} after shrinking past the minimum`);
        if (!exp.includes(JSON.stringify(got))) f.push(`${u}: ${JSON.stringify(got)} vs QA oracle ${exp[0]}`);
        if (mid && mid.drag && mid.drag.guides && mid.drag.guides.length) f.push(`${u}: ${mid.drag.guides.length} guide(s) drawn at the minimum ${JSON.stringify(mid.drag.guides)}`);
        if (u === 'ft' && !/ × 4\.9 ft$/.test(X.sel[1])) f.push(`ft readout ${X.sel[1]}`);
        if (X.minSnap !== (u === 'ft')) f.push(`${u}: minSnap ${X.minSnap}`);
        await S.act('plan-undo');
      }
      R.check(`${V} M shrinking a room's front edge past the minimum stops at exactly 1.5 m in ft ("… × 4.9 ft") and in m, = QA's oracle, no guide line for the minimum`, f);
      await S.end(`${V} M`);
    }

    // ======================= O. lift-only overlap =======================
    if (want('O') && V === '360x640') {
      const S = await open(); await S.page.evaluate(() => PC.store.commit((s) => { s.ans.lift = true; })); await S.toStage3(); await S.tab('G');
      let X = await S.P(); let q = null; const L = X.core.lift, ov = (a, b) => b && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.011 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.011;
      search: for (const r0 of X.rooms) { const r = rect(X, r0.id); for (let x = 0; x <= X.W - r.w + 1e-9; x = Math.round((x + 0.1) * 10) / 10) for (let y = 0; y <= X.D - r.h + 1e-9; y = Math.round((y + 0.1) * 10) / 10) { const c = { ...r, x, y }; if (ov(c, L) && !ov(c, X.core.stair) && !X.rooms.some((o) => o.id !== r.id && ov(c, o))) { q = c; break search; } } }
      if (!q) R.check(`${V} O a position overlapping only the lift exists`, ['none']);
      else { await S.page.evaluate((q) => PC.store.commit((d) => { PC.plans.applyEdit(d, 'G', q); }), q); await S.settle(); X = await S.P();
        R.check(`${V} O ${q.id} overlapping only the lift: Approve disabled, the overlap reported (QA overlap list ${JSON.stringify(myOverlaps(X.rooms.map(({ box, ...r }) => r), X.core))})`, X.approve.disabled && myOverlaps(X.rooms.map(({ box, ...r }) => r), X.core).length > 0 && (await S.page.evaluate(() => PC.plans.canApprove(PC.debug.state(), 'G'))) === 'overlap' ? [] : [JSON.stringify({ approve: X.approve, msg: X.msg, warn: X.warn })]);
        await S.shot('O-lift-overlap'); }
      await S.end(`${V} O`);
    }

    // ======================= S. strip: Skip from stages 1 and 3 =======================
    if (want('S') && V === '360x640') {
      const f = [];
      { const S = await open(); await S.act('btn-skip3d'); await S.settle(); if ((await S.stages()) !== '5') f.push(`from 1: stage ${await S.stages()}`); await S.end(`${V} S1`); }
      { const S = await open(); await S.toStage3(); if (!(await S.shown('btn-skip3d'))) f.push('stage 3: no Skip'); else { await S.act('btn-skip3d'); await S.settle(); if ((await S.stages()) !== '5') f.push(`from 3: stage ${await S.stages()}`); } await S.end(`${V} S3`); }
      { const S = await open(); await S.toStage3(); for (const lv of ['G', '1']) { await S.tab(lv); if (!(await S.P()).s.plans[lv].approved) await S.act('btn-approve'); } await S.act('btn-next'); await S.settle(); const st = await S.stages(); if (st === '4' && ((await S.shown('sample-strip')) || (await S.shown('btn-skip3d')))) f.push('stage 4 shows the strip / Skip'); if (st !== '4') f.push(`could not reach stage 4 (${st})`); await S.end(`${V} S4`); }
      R.check(`${V} S sample: Skip to 3D from stage 1 (2 taps: sample + Skip) and from stage 3 opens stage 5; stage 4 has no strip and no Skip`, f);
    }
  }
} finally { await browser.close(); }
R.note(`runtime ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
