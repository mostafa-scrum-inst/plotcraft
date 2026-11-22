// F3-T2 QA (browser): the plan editor as an architect meets it (F3-S2, F3-S3, F3-S4; PM round 6; A-15): select, move,
// resize by each edge with the live readout, footprint and 1.5 m stops, handles (outward on small rooms, 44 px on
// touch), stair not draggable, second finger cancels, pinch, no page scroll, no commit during a drag and one on release,
// overlaps marked on release with the PM texts, approval / toggle / back-to-Draft note / counter / badges / Next lock,
// Regenerate texts, reload, stage 4 (Q18 / Q19) and stage 5 (R5 end to end: tests/e2e/r5.spec.mjs since the A-16 trim). Real input (CDP touch, mouse); expected
// rectangles from QA's own oracle (f3-t2-ref.mjs), texts from goals-and-stories.md round 6.
// Run: node tests/qa/f3-t2-editor.mjs [--no-shots] [--only=360x640,...]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VIEWPORTS, launch, collector } from './lib.mjs';
import { sessions, eq, PAGE } from './session.mjs';
import * as Q from './f2-t1-ref.mjs';
import { fmtArea, stage2Kit, lab } from './stage2kit.mjs';
import { GRID, myMove, myResize, myOverlaps } from './f3-t2-ref.mjs';

const SHOTS = join(ROOT, 'tests/qa/shots/F3-T2'); mkdirSync(SHOTS, { recursive: true });
const noShots = process.argv.includes('--no-shots');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const R = collector('F3-T2 editor');
const session = sessions({ R, shots: SHOTS, noShots });
const { kit } = stage2Kit({ R, session });
const VP = Object.fromEntries(VIEWPORTS.map((v) => [v.tag, v]));
const RUN = [VP['360x640'], VP['640x360'], VP['1280x800']].filter((v) => !only.length || only.includes(v.tag));
const NAMES = { bedroom: 'Bedroom', bathroom: 'Bathroom', kitchen: 'Kitchen', living: 'Living', dining: 'Dining', majlis: 'Majlis', office: 'Office', maid: "Maid's room", storage: 'Storage', laundry: 'Laundry' };
function myNames(a) { const out = {}, num = (id) => parseInt(id.slice(1), 10);
  for (const lv of Q.levelIds(a)) { const g = {}; for (const r of a.rooms.filter((x) => x.level === lv).sort((p, q) => num(p.id) - num(q.id))) { if (r.master) { out[r.id] = 'Master bedroom'; continue; } (g[r.type] = g[r.type] || []).push(r); }
    for (const t in g) g[t].forEach((r, i) => { out[r.id] = NAMES[t] + (g[t].length > 1 ? ' ' + (i + 1) : ''); }); }
  return out; }
const LEVEL = { G: 'Ground floor', 1: 'First floor' };
const HINT = 'Drag a room to move it; tap it, then drag a handle to resize.';
const dims = (r, u) => (u === 'm' ? `${r.w.toFixed(1)} × ${r.h.toFixed(1)} m` : `${(r.w / Q.FT).toFixed(1)} × ${(r.h / Q.FT).toFixed(1)} ft`);
const asked = (room) => (room.size === null ? room.area : Q.ROOM_AREA[room.type][room.size]);
const areaText = (r, room, u) => { const d = fmtArea(r.w * r.h, u), a = fmtArea(asked(room), u); return d === a ? d : `${d} (asked ${a})`; };

// Everything the editor shows, in viewport px. World axes on screen (ex, ey) so drags are given in metres.
const G = () => { const s = PC.debug.state(), v = PC.debug.planView(), site = PC.debug.site(), fp = site.footprint, q = (h) => document.querySelector(`[data-pc="${h}"]`), t = (h) => q(h).textContent.trim().replace(/\s+/g, ' ');
  const sc = (x, y) => PC.debug.toScreen('plan', fp.u + x, fp.v + y), o = sc(0, 0), ex = sc(1, 0), ey = sc(0, 1);
  const box = (r) => { const a = sc(r.x, r.y), b = sc(r.x + r.w, r.y + r.h); return { l: Math.min(a[0], b[0]), r: Math.max(a[0], b[0]), t: Math.min(a[1], b[1]), b: Math.max(a[1], b[1]) }; };
  const p = s.plans[v.level], core = PC.layout.core(fp.w, fp.d, PC.levels.stairsExist(s), s.ans.stairPos, PC.levels.liftExists(s)), btn = q('btn-approve');
  const tab = (id) => { const b = q('plan-tabs').querySelector(`[data-level="${id}"]`); return b ? b.querySelector('[data-pc="tab-state"]').textContent : null; };
  return { s: JSON.parse(JSON.stringify(s)), level: v.level, selected: v.selected, scale: v.scale, W: fp.w, D: fp.d, ax: [[ex[0] - o[0], ex[1] - o[1]], [ey[0] - o[0], ey[1] - o[1]]],
    rooms: p && !p.error ? p.rooms.map((r) => ({ ...r, box: box(r) })) : [], core: { stair: core.stair || null, lift: core.lift || null }, minSnap: !!(PC.plans.ctx && PC.plans.ctx(s, v.level).minSnap === true), stairBox: core.stair ? box(core.stair) : null,
    sel: [t('plan-room-name'), t('plan-room-dims'), t('plan-room-area')], msg: t('plan-msg'), kind: q('plan-msg').dataset.kind, counter: t('plan-counter'), tabs: { G: tab('G'), 1: tab('1') },
    approve: { disabled: btn.disabled, ariaDis: btn.getAttribute('aria-disabled'), pressed: btn.getAttribute('aria-pressed'), label: t('btn-approve-label'), on: btn.classList.contains('is-approved') },
    commits: window.__qaCommits, drag: PC.debug.planDrag(), view: PC.debug.view('plan'), page: [window.scrollX, window.scrollY, window.visualViewport ? window.visualViewport.scale : 1],
    handles: v.selected ? PC.debug.planHandles(v.selected) : [], msgBox: (() => { const b = q('plan-msg').getBoundingClientRect(); return [b.height, q('plan-canvas').getBoundingClientRect().height]; })() }; };
const pixel = ([x, y]) => { const c = document.querySelector('[data-pc="plan-canvas"]'), b = c.getBoundingClientRect(), k = c.width / b.width; return [...c.getContext('2d').getImageData(Math.round((x - b.left) * k), Math.round((y - b.top) * k), 1, 1).data]; };

const centre = (b) => [(b.l + b.r) / 2, (b.t + b.b) / 2];
const toScr = (P, dx, dy) => [dx * P.ax[0][0] + dy * P.ax[1][0], dx * P.ax[0][1] + dy * P.ax[1][1]];
const add = (a, d) => [a[0] + d[0], a[1] + d[1]];
// QA's handle spots (DP 4): the edge midpoints; under 66 px in that direction 22 px outside the room
function myHandle(P, id, kind) { const r = P.rooms.find((x) => x.id === id), b = r.box, [cx, cy] = centre(b), wide = b.r - b.l >= 66, tall = b.b - b.t >= 66;
  const mid = { n: [r.x + r.w / 2, r.y + r.h], s: [r.x + r.w / 2, r.y], e: [r.x + r.w, r.y + r.h / 2], w: [r.x, r.y + r.h / 2] }[kind];
  // screen point of the world edge midpoint
  const sx = cx + (mid[0] - (r.x + r.w / 2)) * P.ax[0][0] + (mid[1] - (r.y + r.h / 2)) * P.ax[1][0], sy = cy + (mid[0] - (r.x + r.w / 2)) * P.ax[0][1] + (mid[1] - (r.y + r.h / 2)) * P.ax[1][1];
  const small = kind === 'e' || kind === 'w' ? !wide : !tall, d = Math.hypot(sx - cx, sy - cy) || 1;
  return small ? [sx + (sx - cx) / d * 22, sy + (sy - cy) / d * 22] : [sx, sy]; }

const browser = await launch();
const t0 = Date.now();
try {
  for (const vp of RUN) {
    const V = vp.tag, touch = vp.touch, S = await kit(browser, vp, { keepPlans: true, stage2: false });
    try {
    const heights = new Set(), canv = new Set();   // message line and canvas heights over every stage-3 reading (fixed message line)
    const P = async () => { const x = await S.page.evaluate(G); if (x.msgBox[0] > 0 && (await S.stages()) === '3') { heights.add(x.msgBox[0].toFixed(1)); canv.add(x.msgBox[1].toFixed(1) + ((await S.shown('sample-strip')) ? ' (with the sample strip)' : '')); } return x; };
    const labelsCover = async () => S.page.evaluate(() => { const s = PC.debug.state(), v = PC.debug.planView(), fp = PC.debug.site().footprint, L = PC.debug.planLabels(), c = document.querySelector('[data-pc="plan-canvas"]').getBoundingClientRect();
      return s.plans[v.level].rooms.filter((r) => { const a = PC.debug.toScreen('plan', fp.u + r.x, fp.v + r.y), b = PC.debug.toScreen('plan', fp.u + r.x + r.w, fp.v + r.y + r.h), x0 = Math.min(a[0], b[0]) - c.left, x1 = Math.max(a[0], b[0]) - c.left, y0 = Math.min(a[1], b[1]) - c.top, y1 = Math.max(a[1], b[1]) - c.top;
        return !L.some((l) => l.x + l.w / 2 >= x0 && l.x + l.w / 2 <= x1 && l.y + l.h / 2 >= y0 && l.y + l.h / 2 <= y1); }).map((r) => r.id); });
    await S.page.evaluate(() => { window.__qaCommits = 0; PC.store.subscribe(() => { window.__qaCommits++; }); });
    for (let i = 0; i < 3 && (await S.stages()) !== '3'; i++) { await S.act('btn-next'); await S.settle(); }
    let A = await P(); const names = myNames(A.s.ans), roomOf = (id) => A.s.ans.rooms.find((r) => r.id === id), env = (X) => ({ W: X.W, D: X.D, grid: GRID[X.s.ans.unit], rooms: X.rooms.map(({ box, ...r }) => r), core: X.core, minSnap: X.minSnap });
    R.check(`${V} 0 sample on stage 3, Ground floor, scale ${A.scale.toFixed(2)} px/m${touch ? ' (>= 14 on phones)' : ''}`, A.level === 'G' && A.rooms.length === 7 && (!touch || A.scale >= 14 - 1e-9) ? [] : [JSON.stringify([A.level, A.rooms.length, A.scale])]);
    // every room labelled at the default fit, both floors, m and ft (DP 3: tiers down to tiny)
    { const un = []; for (const u of ['m', 'ft']) { await S.act('unit-' + u); for (const lv of ['1', 'G']) { await S.act(`css:[data-pc="plan-tabs"] [data-level="${lv}"]`); await S.settle(); const miss = await labelsCover(); if (miss.length) un.push(`${u} ${lv}: ${miss}`); } }
      R.check(`${V} 0 every room on both floors carries a label at the default fit, in m and in ft`, un); await S.act('unit-m'); }
    const rect = (X, id) => { const { box, ...r } = X.rooms.find((x) => x.id === id); return r; };
    // a drag in metres from a screen point; whileDown reads the page with the finger / button still down
    const drag = async (from, dx, dy, during) => { const X = await P(); let mid = null; await S.dragPts(from, add(from, toScr(X, dx, dy)), async () => { await S.settle(); mid = await P(); if (during) await during(mid); }); await S.settle(); return mid; };
    // the app's result must be QA's oracle for the intended delta, give or take the pointer's sub-pixel rounding (+- 0.04 m)
    const oracle = (fn) => { const out = []; for (const a of [0, -0.04, 0.04]) for (const b of [0, -0.04, 0.04]) out.push(JSON.stringify(fn(a, b))); return out; };

    // ---- 1. select by tap; readout drawn vs asked (m) ----
    { const r1 = A.rooms.find((r) => r.id === 'r1'); await S.tapAt(centre(r1.box)); const X = await P();
      R.check(`${V} 1 tap on ${names.r1}: selected, readout name / size / "drawn (asked …)"`, X.selected === 'r1' && eq(X.sel, [names.r1, dims(r1, 'm'), areaText(r1, roomOf('r1'), 'm')]) ? [] : [JSON.stringify(X.sel)]); }

    // ---- 2. move: no commit while dragging, exactly one on release, result = QA's oracle ----
    { const X0 = await P(), c0 = X0.commits, st = rect(X0, 'r7'); let midOk = [];
      await drag(centre(X0.rooms.find((r) => r.id === 'r7').box), 0, 2.3, async (M) => { if (M.commits !== c0) midOk.push(`${M.commits - c0} commit(s) during the drag`); if (!M.drag || M.drag.kind !== 'move' || M.drag.id !== 'r7') midOk.push('no move in progress: ' + JSON.stringify(M.drag)); if (!eq(rect(M, 'r7'), st)) midOk.push('stored rectangle changed during the drag'); if (M.drag && M.sel[1] !== dims(M.drag.cur, 'm')) midOk.push(`readout ${M.sel[1]} not live (${dims(M.drag.cur, 'm')})`); });
      const X = await P(), got = rect(X, 'r7'), exp = oracle((a, b) => myMove(st, a, 2.3 + b, env(X0)));
      R.check(`${V} 2 move ${names.r7} 2.3 m back: no commit during the drag, live readout, one commit on release, rectangle = QA's oracle`, [...midOk, ...(X.commits - c0 === 1 ? [] : [`${X.commits - c0} commits`]), ...(exp.includes(JSON.stringify(got)) ? [] : [`got ${JSON.stringify(got)}, oracle ${exp[0]}`]), ...(X.s.plans.G.edited ? [] : ['not edited'])]);
      if (touch) await S.shot('2-after-move'); }

    // ---- 3. resize by each edge; handles where QA computes them; live readout; stops ----
    { let X = await P(); const hp = []; for (const h of X.handles) { const m = myHandle(X, X.selected, h.kind); if (Math.hypot(m[0] - h.x, m[1] - h.y) > 1) hp.push(`${h.kind}: app ${h.x.toFixed(1)},${h.y.toFixed(1)} mine ${m[0].toFixed(1)},${m[1].toFixed(1)}`); }
      const b = X.rooms.find((r) => r.id === 'r7').box; R.check(`${V} 3 ${names.r7} (${(b.r - b.l).toFixed(0)} x ${(b.b - b.t).toFixed(0)} px): four edge handles where QA puts them (outside the room under 66 px), no corner handles`, X.handles.length === 4 && !hp.length ? [] : [`${X.handles.length} handles`, ...hp]);
      for (const [kind, dx, dy, what] of [['w', -0.8, 0, 'west edge 0.8 m out'], ['n', 0, 1.2, 'back edge 1.2 m out'], ['e', 3, 0, 'east edge 3 m past the footprint'], ['s', 0, 2.5, 'front edge 2.5 m in (past the 1.5 m minimum)']]) {
        X = await P(); const st = rect(X, 'r7'), c0 = X.commits, at = myHandle(X, 'r7', kind), pr = [];
        await drag(at, dx, dy, async (M) => { if (!M.drag || M.drag.kind !== kind) pr.push(`grabbed ${JSON.stringify(M.drag)}`); else if (M.sel[1] !== dims(M.drag.cur, 'm') || M.sel[2] !== areaText(M.drag.cur, roomOf('r7'), 'm')) pr.push(`readout not live: ${JSON.stringify(M.sel)}`); if (M.commits !== c0) pr.push('commit during the drag'); });
        const Y = await P(), got = rect(Y, 'r7'), exp = oracle((a, b) => myResize(st, kind, dx + a, dy + b, env(X)));
        if (!exp.includes(JSON.stringify(got))) pr.push(`got ${JSON.stringify(got)}, oracle ${exp[0]}`); if (Y.commits - c0 !== (eq(got, st) ? 0 : 1)) pr.push(`${Y.commits - c0} commits`);
        if (kind === 'e' && Math.abs(got.x + got.w - Y.W) > 1e-9) pr.push(`east edge at ${got.x + got.w}, footprint ${Y.W}`); if (kind === 's' && Math.abs(got.h - 1.5) > 1e-9) pr.push(`depth ${got.h}, expected the 1.5 m minimum`);
        R.check(`${V} 3 resize ${names.r7} by its ${what}: the ${kind} handle grabs, live readout (m), result = QA's oracle${kind === 'e' ? ', stops at the footprint edge' : kind === 's' ? ', stops at 1.5 m' : ''}`, pr); }
      // handle targets: touch 44 px (a press 18 px off the handle centre along the edge still grabs it); mouse 10 px
      X = await P(); const he = myHandle(X, 'r7', 'e'), off = touch ? [0, 18] : [14, 0], pr = []; let kind = null;
      await drag(add(he, off), -1.0, 0, async (M) => { kind = M.drag ? M.drag.kind : null; });   // 1 m: past the 8 px tap slop at every scale
      if (touch ? kind !== 'e' : kind === 'e') pr.push(`press ${touch ? '18 px along the edge' : '14 px outside'} from the e handle: ${kind}`);
      R.check(`${V} 3 handle target: ${touch ? 'touch press 18 px off the handle centre grabs it (44 px target)' : 'mouse press 14 px off the handle does not grab it (10 px radius)'}`, pr);
      // readout in ft while resizing
      await S.act('unit-ft'); X = await P(); const st = rect(X, 'r7'), ft = [];
      await drag(myHandle(X, 'r7', 'n'), 0, 0.6, async (M) => { if (!M.drag || M.sel[1] !== dims(M.drag.cur, 'ft') || M.sel[2] !== areaText(M.drag.cur, roomOf('r7'), 'ft')) ft.push(JSON.stringify(M.sel)); });
      const Y = await P(), got = rect(Y, 'r7'), exp = oracle((a, b) => myResize(st, 'n', a, 0.6 + b, env(X))); if (!exp.includes(JSON.stringify(got))) ft.push(`got ${JSON.stringify(got)}, oracle ${exp[0]} (1 ft grid)`);
      { const lines = await S.page.evaluate(() => ['plan-room-name', 'plan-room-dims', 'plan-room-area'].map((h) => { const el = document.querySelector(`[data-pc="${h}"]`), rg = document.createRange(); rg.selectNodeContents(el); return new Set([...rg.getClientRects()].map((r) => Math.round(r.top))).size; }));
        R.check(`${V} 3 readout in ft: name, size and "drawn (asked …)" area each on one line (${(await P()).sel.join(' | ')})`, lines.every((n) => n === 1) ? [] : [JSON.stringify(lines)]); }
      R.check(`${V} 3 in ft: live readout "w × h ft" and "drawn (asked …)" in sq ft, the edge lands on the 1 ft grid as QA's oracle says`, ft);
      if (touch) await S.shot('3-resize-ft'); await S.act('unit-m'); }

    // ---- 4. the stair cannot be dragged (a drag there pans); 5. touch: second finger cancels, pinch zooms; no page scroll ----
    // (a selected small room's outward handle may sit over the stair and wins there, by the hit order: observation, see report)
    { const H = await P(), hs = H.handles.filter((h) => h.x >= H.stairBox.l && h.x <= H.stairBox.r && h.y >= H.stairBox.t && h.y <= H.stairBox.b).map((h) => h.kind);
      // TL F5-T3a ruling 5 (hit order: selected-room handles -> rooms -> pan; the stair is never hit): a press on a handle that
      // lies over the stair starts a resize. Moved along the edge only (no size change, no commit), so later steps see the same plan.
      if (hs.length) { const hh = H.handles.find((h) => h.kind === hs[0]), along = hs[0] === 'e' || hs[0] === 'w' ? [0, 1.0] : [1.0, 0]; let k = null;
        await drag([hh.x, hh.y], along[0], along[1], async (M) => { k = M.drag ? M.drag.kind : null; }); const Z = await P();
        R.check(`${V} 4 the selected ${names[H.selected]}'s ${hs[0]} handle lies over the stair: a press there starts a resize (TL F5-T3a ruling 5: handles before the stair, which is never hit); moved along its edge, no change`, k === hs[0] && eq(Z.s.plans, H.s.plans) ? [] : [`grabbed ${k}, plans ${eq(Z.s.plans, H.s.plans) ? 'same' : 'changed'}`]); }
      else R.note(`${V} 4 no handle of the selected room lies over the stair in this state`);
      const c = await S.page.evaluate(() => { const b = document.querySelector('[data-pc="plan-canvas"]').getBoundingClientRect(); return [b.left + 6, b.top + b.height - 6]; }); await S.tapAt(c); }   // tap outside the footprint: selection cleared
    { const X = await P(), c0 = X.commits; let during = null; await S.dragPts(centre(X.stairBox), add(centre(X.stairBox), [30, 20]), async () => { during = (await P()).drag; });
      const Y = await P(); R.check(`${V} 4 drag on the stair (nothing selected): no edit (pans the view), plans unchanged, no commit`, X.selected === null && during === null && !eq(X.view, Y.view) && eq(X.s.plans, Y.s.plans) && Y.commits === c0 ? [] : [JSON.stringify({ during, moved: !eq(X.view, Y.view), commits: Y.commits - c0 })]);
      await S.act('plan-fit'); }
    if (touch) { const X = await P(), c0 = X.commits, a = centre(X.rooms.find((r) => r.id === 'r2').box), pr = [];
      await S.T.send('touchStart', [a]); for (let i = 1; i <= 6; i++) { await S.T.send('touchMove', [[a[0] + 4 * i, a[1] - 3 * i]]); await S.page.evaluate(() => new Promise((r) => requestAnimationFrame(r))); }
      if (!(await P()).drag) pr.push('no move in progress before the second finger');
      await S.T.send('touchStart', [[a[0] + 24, a[1] - 18, 0], [a[0] + 80, a[1] + 40, 1]]); await S.settle(); if ((await P()).drag) pr.push('second finger did not cancel the move');
      await S.T.send('touchEnd', []); await S.settle(); const Y = await P(); if (!eq(X.s.plans, Y.s.plans) || Y.commits !== c0) pr.push('the room did not return / a commit happened');
      R.check(`${V} 5 a second finger during a move cancels it: the room returns, nothing committed`, pr);
      await S.act('plan-fit'); const Z0 = await P(), cv = await S.page.evaluate(() => { const b = document.querySelector('[data-pc="plan-canvas"]').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
      await S.T.two([cv[0] + cv[2] * 0.45, cv[1] + cv[3] * 0.5], [cv[0] + cv[2] * 0.55, cv[1] + cv[3] * 0.5], [cv[0] + cv[2] * 0.3, cv[1] + cv[3] * 0.5], [cv[0] + cv[2] * 0.7, cv[1] + cv[3] * 0.5]); await S.settle();
      const Z = await P(); R.check(`${V} 5 two-finger pinch zooms the plan (${Z0.scale.toFixed(1)} -> ${Z.scale.toFixed(1)} px/m), no edit`, Z.scale > Z0.scale * 1.2 && eq(Z.s.plans, Z0.s.plans) ? [] : ['failed']);
      await S.act('plan-fit'); }
    R.check(`${V} 5 after every gesture the page has not scrolled or zoomed`, eq((await P()).page, [0, 0, 1]) ? [] : [JSON.stringify((await P()).page)]);

    // ---- 6. overlaps: allowed while dragging, marked on release with the PM texts; Approve refused ----
    { await S.act('btn-regenerate'); const open = await S.waitDialog(), d = open ? await S.dialogText() : null;
      R.check(`${V} 6 Regenerate an edited Draft: "Regenerate this floor?" / "Your manual edits to the Ground floor will be lost. It will be laid out again from the room list." / Regenerate, Cancel`, open && d.title === 'Regenerate this floor?' && d.text === 'Your manual edits to the Ground floor will be lost. It will be laid out again from the room list.' && d.ok === 'Regenerate' && d.cancel === 'Cancel' ? [] : [JSON.stringify(d)]);
      if (open) { await S.act('dialog-ok'); await S.waitDialog(false); }
      let X = await P(); R.check(`${V} 6 after Regenerate: a fresh Draft (not edited), the default hint "${HINT}"`, !X.s.plans.G.edited && !X.s.plans.G.approved && X.msg === HINT ? [] : [X.msg]);
      const c0 = X.commits; await S.act('btn-regenerate'); await S.settle(); X = await P(); R.check(`${V} 6 Regenerate an untouched Draft: no dialog, the same deterministic layout`, !(await S.dialogOpen()) && !X.s.plans.G.edited && X.commits - c0 <= 1 ? [] : [`dialog ${await S.dialogOpen()}, commits ${X.commits - c0}`]);
      const r7 = X.rooms.find((r) => r.id === 'r7'), r6 = X.rooms.find((r) => r.id === 'r6'); let midMsg = null, midPx = null;
      // a point inside the r6 / r7 overlap (r6 box, the half towards r7), 20 % from its left: clear of the labels at the room centres
      const ovPt = (M) => { const b = M.rooms.find((r) => r.id === 'r6').box; return [b.l + 0.2 * (b.r - b.l), b.t + 0.25 * (b.b - b.t)]; };
      await drag(centre(r7.box), 0, -1.0, async (M) => { midMsg = M.msg; midPx = await S.page.evaluate(pixel, ovPt(M)); });
      X = await P(); const ov = myOverlaps(X.rooms.map(({ box, ...r }) => r), X.core), pair = [`${names.r7} and ${names.r6}`, `${names.r6} and ${names.r7}`].map((p) => `${p} overlap. Move or resize the marked rooms to approve this floor.`);
      const px = await S.page.evaluate(pixel, ovPt(X));
      R.check(`${V} 6 ${names.r7} dragged onto ${names.r6}: not marked while dragging; on release "${pair[0]}" (block), the room marked (pixel changed)`, eq(ov, ['r6+r7']) && midMsg !== null && !/overlap/.test(midMsg) && pair.includes(X.msg) && X.kind === 'block' && !eq(px, midPx) ? [] : [JSON.stringify({ ov, midMsg, msg: X.msg, kind: X.kind, midPx, px })]);
      await S.act('btn-approve'); const Y = await P();
      R.check(`${V} 6 Approve with an overlap: aria-disabled, pressing it keeps the floor Draft and the reason`, X.approve.ariaDis === 'true' && !X.approve.disabled && !Y.s.plans.G.approved && pair.includes(Y.msg) && Y.tabs.G === 'Draft' ? [] : [JSON.stringify([X.approve, Y.msg])]);
      if (touch) await S.shot('6-overlap');
      // a second overlap: a room over the stairs -> the count text; then only the stair overlap -> the core text
      const r4 = Y.rooms.find((r) => r.id === 'r4'); await drag(centre(r4.box), 1.0, 0); let Z = await P(); const ov2 = myOverlaps(Z.rooms.map(({ box, ...r }) => r), Z.core);
      R.check(`${V} 6 two overlaps: "2 overlaps on this floor. Move or resize the marked rooms to approve it."`, ov2.length === 2 && Z.msg === '2 overlaps on this floor. Move or resize the marked rooms to approve it.' ? [] : [JSON.stringify([ov2, Z.msg])]);
      await drag(centre(Z.rooms.find((r) => r.id === 'r7').box), 0, 1.0); Z = await P(); const ov3 = myOverlaps(Z.rooms.map(({ box, ...r }) => r), Z.core);
      R.check(`${V} 6 only ${names.r4} over the stairs: "${names.r4} overlaps the stairs. Move or resize it to approve this floor."`, eq(ov3, ['r4+stair']) && Z.msg === `${names.r4} overlaps the stairs. Move or resize it to approve this floor.` && Z.approve.ariaDis === 'true' ? [] : [JSON.stringify([ov3, Z.msg])]);
      await S.layout(`${V} 6 stage 3 with an overlap`); }

    // ---- 7. approval: Approve, back-to-Draft once, the toggle, counter, badges, Next lock ----
    { await S.act('btn-regenerate'); if (await S.waitDialog()) { await S.act('dialog-ok'); await S.waitDialog(false); }
      await S.act('btn-approve'); let X = await P(); const bar0 = await S.bar(), st4 = await S.step(4);
      R.check(`${V} 7 Approve: "Ground floor approved.", aria-pressed true, "Approved", tab badge, "1 of 2 floors approved", Next and stage 4 still locked`, X.s.plans.G.approved && X.msg === 'Ground floor approved.' && X.approve.pressed === 'true' && X.approve.label === 'Approved' && X.approve.on && X.tabs.G === 'Approved' && X.counter === '1 of 2 floors approved' && !bar0.next && st4.locked ? [] : [JSON.stringify({ msg: X.msg, a: X.approve, tabs: X.tabs, counter: X.counter, next: bar0.next, locked: st4.locked })]);
      if (touch) await S.shot('7-approved');
      await drag(centre(X.rooms.find((r) => r.id === 'r7').box), 0, 2.3); X = await P();
      R.check(`${V} 7 an edit on the approved floor: back to Draft, told once "Ground floor is back to Draft. Approve it again when you are done.", counter 0 of 2`, !X.s.plans.G.approved && X.s.plans.G.edited && X.msg === 'Ground floor is back to Draft. Approve it again when you are done.' && X.tabs.G === 'Draft' && X.counter === '0 of 2 floors approved' && X.approve.pressed === 'false' ? [] : [JSON.stringify({ msg: X.msg, tabs: X.tabs, counter: X.counter })]);
      await drag(centre(X.rooms.find((r) => r.id === 'r7').box), -0.6, 0); X = await P();
      R.check(`${V} 7 the next edit (already Draft) does not repeat the note: default hint`, X.msg === HINT ? [] : [X.msg]);
      await S.act('btn-approve'); await S.act('btn-approve'); X = await P();
      R.check(`${V} 7 tapping "Approved" un-approves without a dialog: "Ground floor is back to Draft.", aria-pressed false, edits kept`, !(await S.dialogOpen()) && !X.s.plans.G.approved && X.s.plans.G.edited && X.msg === 'Ground floor is back to Draft.' && X.approve.pressed === 'false' && X.approve.label === 'Approve floor' ? [] : [JSON.stringify({ msg: X.msg, a: X.approve })]);
      await S.act('btn-approve'); await S.act('css:[data-pc="plan-tabs"] [data-level="1"]'); await S.act('btn-approve'); X = await P(); const bar = await S.bar(), st = await S.step(4);
      R.check(`${V} 7 First approved too: "All floors approved. Next: Interior.", "2 of 2 floors approved", Next enabled, stage 4 unlocked`, X.msg === 'All floors approved. Next: Interior.' && X.counter === '2 of 2 floors approved' && bar.next && !st.locked ? [] : [JSON.stringify({ msg: X.msg, counter: X.counter, bar, st })]);
      await S.act('btn-regenerate'); const open = await S.waitDialog(), d = open ? await S.dialogText() : null; if (open) { await S.act('dialog-cancel'); await S.waitDialog(false); }
      R.check(`${V} 7 Regenerate on the approved (unedited) First floor asks "The First floor's approval will be cleared. It will be laid out again from the room list."; Cancel keeps it approved`, open && d.text === "The First floor's approval will be cleared. It will be laid out again from the room list." && (await P()).s.plans['1'].approved ? [] : [JSON.stringify(d)]);
      // invariant through the session and a reload
      X = await P(); const inv = ['G', '1'].filter((id) => X.s.plans[id].approved && myOverlaps(X.s.plans[id].rooms, X.core).length);
      await S.flush(); const keep = X.s.plans; await S.reload(); await S.act('btn-resume'); await S.settle(); for (let i = 0; i < 3 && (await S.stages()) !== '3'; i++) { await S.act('step-3'); await S.settle(); }
      const Y = await P(); R.check(`${V} 7 approved => no overlaps (QA overlap); reload + Resume keeps the edited, approved plans exactly`, !inv.length && eq(Y.s.plans, keep) && Y.tabs.G === 'Approved' && Y.tabs['1'] === 'Approved' ? [] : [JSON.stringify({ inv, same: eq(Y.s.plans, keep), tabs: Y.tabs })]);
      await S.page.evaluate(() => { window.__qaCommits = 0; PC.store.subscribe(() => { window.__qaCommits++; }); }); }

    // ---- 8. stage 4 (Q18 / Q19) and stage 5 ----
    { await S.act('btn-next'); await S.settle();
      const g = await S.page.evaluate(() => { const st = document.querySelector('[data-stage="4"]'), val = (h) => { const c = st.querySelector(`[data-pc="${h}"] input:checked`); return c && c.value; };
        return { shown: !st.hidden, qs: [...st.querySelectorAll('.pc-q')].map((q) => q.dataset.q), style: val('q-interior-style'), density: val('q-interior-density'), inputs: st.querySelectorAll('input, select, textarea').length, opts: [...st.querySelectorAll('[data-pc="q-interior-style"] input')].map((i) => i.value).concat([...st.querySelectorAll('[data-pc="q-interior-density"] input')].map((i) => i.value)) }; });
      const bar = await S.bar(); R.check(`${V} 8 stage 4: exactly Q18 and Q19, defaults Modern / Full, no "not built yet" notice, Next "Build 3D model"`, g.shown && eq(g.qs, ['18', '19']) && g.style === 'modern' && g.density === 'full' && (await S.banners()).length === 0 && bar.label === 'Build 3D model' && bar.next ? [] : [JSON.stringify({ g, banners: await S.banners(), bar })]);
      await S.layout(`${V} 8 stage 4`); if (touch) await S.shot('8-stage4');
      const before = await S.state(), other = g.opts.filter((v) => !['modern', 'sparse', 'full'].includes(v))[0];
      await S.act(lab('q-interior-style', other)); await S.act(lab('q-interior-density', 'sparse')); const after = await S.state();
      R.check(`${V} 8 Q18 -> ${other}, Q19 -> sparse: stored, approvals and plans unchanged (appearance)`, after.ans.interior.style === other && after.ans.interior.density === 'sparse' && eq(after.plans, before.plans) && !(await S.dialogOpen()) ? [] : [JSON.stringify(after.ans.interior)]);
      await S.act('btn-next'); await S.settle(); const b5 = await S.page.evaluate(() => { const t = document.querySelector('[data-pc="banner-slot"] [data-pc="banner-text"]'); if (!t) return null; const r = t.getBoundingClientRect(); return { text: t.textContent, inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.width > 0 }; });
      if (PAGE.house) { await S.until(async () => (await S.v3()).unavailable, 3000); const v = await S.v3();   // F4-T1 controller; three.js blocked here
        R.check(`${V} 8 "Build 3D model" opens stage 5 (F4-T1 controller, three.js blocked): no notice, "3D view unavailable" in view, panel hidden`, (await S.stages()) === '5' && !b5 && v.unavailableInView && !v.panel ? [] : [JSON.stringify({ b5, v })]); }
      else R.check(`${V} 8 "Build 3D model" opens stage 5 with "This stage is not built yet: static preview" in view`, (await S.stages()) === '5' && b5 && b5.text === 'This stage is not built yet: static preview' && b5.inView ? [] : [JSON.stringify(b5)]);
      await S.layout(`${V} 8 stage 5`); if (touch) await S.shot('8-stage5');
      await S.act('btn-back'); await S.settle(); R.check(`${V} 8 Back from stage 5 opens stage 4, choices kept`, (await S.stages()) === '4' && (await S.state()).ans.interior.style === other); }

    // ---- 9. R5 end to end: removed in the A-16 trim (F3-T3 first item, docs/03-tasks/F3-T3/qa-trim.md). It ran at
    // 360x640 and 1280x800, exactly the viewports of its twin tests/e2e/r5.spec.mjs, which seeds the same state (Ground
    // edited + approved, First approved) and checks a superset: rooms() "First-floor room change: one question naming only
    // the First floor and only its approval", "stage 3: Ground as left (edited, approved), First a new Draft", "Q10 change:
    // no question, approvals kept"; vertex() "size-changing corner release asks", "Cancel returns the corner; nothing
    // resets" (plus Q6, setback Cancel / move-only, Clear sentence). QA's own R5 wording oracle stays in f2-t1-site.mjs 9.
    // the fixed-height line is the phone-portrait layout (32 px); in the side panels the message does not set the canvas height
    R.check(`${V} 10 ${V === '360x640' ? 'the message line keeps one height (' + [...heights] + ' px) and ' : ''}the canvas never resizes (${[...canv]} px) across hint, overlap, approval and note texts`, (V !== '360x640' || heights.size === 1) && canv.size === ([...canv].some((c) => /strip/.test(c)) ? 2 : 1) ? [] : [JSON.stringify({ heights: [...heights], canvas: [...canv] })]);
    } catch (e) { R.check(`${V} scenario aborted`, [String(e.message).split('\n')[0]]); }
    await S.end(`${V} editor`);
    // a floor with a warning (a broken pair) fits at the same scale on phones (fixed message line; >= 14 px/m)
    if (touch) { const T = await kit(browser, vp, { keepPlans: true, stage2: false }); for (let i = 0; i < 3 && (await T.stages()) !== '3'; i++) { await T.act('btn-next'); await T.settle(); }
      await T.act('css:[data-pc="plan-tabs"] [data-level="1"]'); await T.settle(); let X = await T.page.evaluate(G); const r13 = X.rooms.find((r) => r.id === 'r13');
      await T.dragPts(centre(r13.box), add(centre(r13.box), toScr(X, 1.5, 0))); await T.act('plan-fit'); await T.settle(); X = await T.page.evaluate(G);
      const warn = await T.page.evaluate(() => document.querySelectorAll('[data-pc="plan-warn-list"] > *').length);
      R.check(`${V} 10 First floor with a broken pair (${warn} warning(s)): plan fitted at ${X.scale.toFixed(2)} px/m (>= 14)`, warn >= 1 && X.scale >= 14 - 1e-9 ? [] : [JSON.stringify({ warn, scale: X.scale, unmet: X.s.plans['1'].unmet })]);
      if (vp.tag === '360x640') await T.shot('10-warning'); await T.end(`${V} warnings floor`); }
  }
} finally { await browser.close(); }
R.note(`runtime ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
