// F3-T2 QA (node): the plan editor's pure operations (PC.plans.moveRect / resizeRect / applyEdit / problems /
// canApprove / approve / unapprove) judged by QA's own snapping and overlap oracle, written from A-15 (TL ruling 9),
// PM 4.3 / 4.4 and F3-S2 / F3-S3, independently of PC.plans.snapEdge:
//   an edge first snaps to the nearest candidate within 0.3 m (ties: the lower value): parallel edges of other rooms
//   whose span overlaps the moving edge's span widened by 0.3 m at each end, the stair and lift edges, the footprint
//   edges (always); otherwise to the nearest grid line (0.5 m / 1 ft from the footprint origin) inside the limits.
//   Limits are hard clamps: inside the footprint, every side >= 1.5 m (resize). A move: on each axis the edge with
//   the nearer neighbour decides (low edge on ties), else the edge needing the smaller grid shift. 0.01 m rounding.
//   Overlap = more than 0.011 m on both axes; adjacency = touching within 0.02 m along 0.5 m or more (A-8).
// Run: node tests/qa/f3-t2-edit.mjs   (--no-shots accepted and ignored)
import { collector } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';

const R = collector('F3-T2 edit');
// Open minor bugs (docs/03-tasks/F3-T2/qa-report.md) would be listed here as R.known entries. None open: bug 1 (ft resize
// short of the wall) was fixed by FS and confirmed; its KNOWN entry was removed (re-confirmed in the A-16 trim).
const PC = Q.loadPC();
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

import { SNAP, MINS, TOL, E, GRID, r2, rnd2, myCands, mySnap, myMove, myResize, ovl, myOverlaps, adj } from './f3-t2-ref.mjs';
const levelPairs = (s, lv) => s.ans.pairs.filter((p) => p.every((id) => (s.ans.rooms.find((r) => r.id === id) || {}).level === lv));
const myUnmet = (s, lv, rooms) => { const by = Object.fromEntries(rooms.map((r) => [r.id, r])); return levelPairs(s, lv).filter((p) => !(by[p[0]] && by[p[1]] && adj(by[p[0]], by[p[1]]))).map(String).sort(); };

// ---------- states under test ----------
function stateOf(mut) { const s = Q.plain(PC.sample.state()); if (mut) mut(s); s.plans = {}; PC.plans.sync(s); return s; }
const envOf = (s, lv, rooms) => { const c = PC.plans.ctx(s, lv); return { W: c.W, D: c.D, grid: GRID[s.ans.unit], core: c.core, rooms, ctx: c }; };
const appCtx = (s, lv, rooms, id) => { const c = PC.plans.ctx(s, lv); c.cands = PC.plans.edgeCands(rooms, id, c); return c; };
const STATES = [];
for (const unit of ['m', 'ft']) for (const pos of ['centre', 'fl', 'fr', 'bl', 'br']) for (const lift of [false, true]) for (const fpPct of [25, 40])
  STATES.push({ tag: `${unit} ${pos}${lift ? '+lift' : ''} ${fpPct} %`, s: stateOf((s) => { s.ans.unit = unit; s.ans.stairPos = pos; s.ans.lift = lift; s.ans.footprintPct = fpPct; }) });

const t0 = Date.now();
// ================= 1. snapping and clamps: QA's oracle vs the app, seeded sweep =================
{ const r = rng(321), pr = [], over = [], overMove = [], spanAlt = [], stat = { n: 0, move: 0, resize: 0, edge: 0, grid: 0, ties: 0 }, bad = [], clampBad = [];
  for (const { tag, s } of STATES) for (const lv of ['G', '1']) { const p = s.plans[lv]; if (!p || p.error) { pr.push(`${tag} ${lv}: no plan`); continue; }
    const env = envOf(s, lv, p.rooms);
    for (const room of p.rooms) {
      const ops = [];
      for (let k = 0; k < 8; k++) ops.push(['move', (r() - 0.5) * 6, (r() - 0.5) * 6, false]);
      for (let k = 0; k < 2; k++) ops.push(['move', (r() - 0.5) * 30, (r() - 0.5) * 30, true]);
      for (const kind of ['n', 's', 'e', 'w']) { for (let k = 0; k < 3; k++) ops.push([kind, (r() - 0.5) * 8, (r() - 0.5) * 8, false]); ops.push([kind, (kind === 'e' ? 1 : kind === 'w' ? -1 : 0) * (5 + r() * 15), (kind === 'n' ? 1 : kind === 's' ? -1 : 0) * (5 + r() * 15), true]); }
      for (const [kind, dx, dy, overshoot] of ops) { stat.n++; const ctx = appCtx(s, lv, p.rooms, room.id);
        const app = kind === 'move' ? PC.plans.moveRect(room, dx, dy, ctx).rect : PC.plans.resizeRect(room, kind, dx, dy, ctx).rect;
        const mine = kind === 'move' ? myMove(room, dx, dy, env) : myResize(room, kind, dx, dy, env); stat[kind === 'move' ? 'move' : 'resize']++;
        // hard limits whatever the snap: inside the footprint, sides >= 1.5 (resize), size kept (move), opposite edge kept (resize)
        const lim = []; if (app.x < -E || app.y < -E || app.x + app.w > env.W + 0.005 || app.y + app.h > env.D + 0.005) lim.push('outside the footprint');
        if (kind !== 'move' && Math.min(app.w, app.h) < MINS - 0.005) lim.push('side under 1.5 m'); if (kind === 'move' && (Math.abs(app.w - room.w) > 0.005 || Math.abs(app.h - room.h) > 0.005)) lim.push('size changed by a move');
        if (kind === 'e' && Math.abs(app.x - room.x) > 0.005) lim.push('left edge moved'); if (kind === 'w' && Math.abs(app.x + app.w - room.x - room.w) > 0.005) lim.push('right edge moved');
        if (kind === 'n' && Math.abs(app.y - room.y) > 0.005) lim.push('front edge moved'); if (kind === 's' && Math.abs(app.y + app.h - room.y - room.h) > 0.005) lim.push('back edge moved');
        if ([app.x, app.y, app.w, app.h].some((v) => Math.abs(v * 100 - Math.round(v * 100)) > 1e-6 || Object.is(v, -0))) lim.push('not rounded to 0.01 m (or -0)');
        if (lim.length) clampBad.push(`${tag} ${lv} ${room.id} ${kind} ${dx.toFixed(2)},${dy.toFixed(2)}: ${lim.join(', ')} ${JSON.stringify(app)}`);
        // past the footprint: the raw position lies outside the clamp on some axis
        const past = kind === 'move' ? room.x + dx < 0 || room.x + dx > env.W - room.w || room.y + dy < 0 || room.y + dy > env.D - room.h
          : kind === 'e' ? room.x + room.w + dx > env.W || room.w + dx < MINS : kind === 'w' ? room.x + dx < 0 || room.w - dx < MINS : kind === 'n' ? room.y + room.h + dy > env.D || room.h + dy < MINS : room.y + dy < 0 || room.h - dy < MINS;
        const rec = { tag: `${tag} ${lv} ${room.id} ${kind} d=(${dx.toFixed(2)}, ${dy.toFixed(2)})`, app, mine, room, W: env.W, D: env.D };
        if (eq(app, mine)) continue;
        if (kind === 'move' && past && eq(app, myMove(room, dx, dy, env, 'finger'))) { spanAlt.push(rec); continue; }   // observation: neighbour span taken at the finger, not at the clamped room
        (past ? (kind === 'move' ? overMove : over) : bad).push(rec); void overshoot; } } }
  const show = (l) => l.slice(0, 3).map((x) => `${x.tag}: app ${JSON.stringify(x.app)} mine ${JSON.stringify(x.mine)} (start ${JSON.stringify(x.room)}, footprint ${x.W} x ${x.D})`);
  R.check(`1 ${stat.n} seeded edits (${stat.move} moves, ${stat.resize} edge resizes; ${STATES.length} sample variants x 2 levels, m and ft): every result inside the footprint, sides >= 1.5 m, size / opposite edge kept, 0.01 m rounding`, clampBad.slice(0, 5));
  R.check('1 edits inside the footprint: the app\'s rectangle equals QA\'s snapping oracle (neighbour within 0.3 m with overlapping span, core, footprint; else the grid)', show(bad));
  // overshoot: a drag that goes past the footprint edge. A-15 / plan 4: the clamp is hard and the footprint edge is a candidate,
  // so the edge stops AT the footprint edge, like a move does
  R.check('1 resize past its limit (footprint edge or 1.5 m side): the edge is clamped first, then snapped, so it stops at the footprint edge (a candidate) or at the limit / a candidate there', show(over));
  R.check('1 move past the footprint edge: the room stops flush with it, then snaps as QA\'s oracle says', show(overMove));
  R.note(`1 resizes past their limit that end elsewhere than QA's clamp-then-snap: ${over.length} (m ${over.filter((x) => /^m /.test(x.tag)).length}, ft ${over.filter((x) => /^ft /.test(x.tag)).length}); e.g. ${show(over).slice(0, 1)}`);
  R.note(`1 moves past the footprint where the app takes the neighbours' span at the finger, not at the clamped room: ${spanAlt.length}; e.g. ${show(spanAlt).slice(0, 1)}`);
}

// ================= 2. targeted snapping cases (focus item 2) =================
{ const pr = [], s = stateOf(), lv = 'G', W = PC.plans.ctx(s, lv).W, D = PC.plans.ctx(s, lv).D, core = PC.plans.ctx(s, lv).core;
  // a free test bed in the sample footprint (9.5 x 15): two rooms in the front band, away from the centre stair
  // a free test bed in the sample footprint (9.5 x 15, centre stair x 3.5-6, y 5.5-9.5): room A 2 x 2 at the front-left corner
  const A = { id: 'rA', x: 0, y: 0, w: 2, h: 2 };
  const resE = (rooms, dx, unit = 'm') => { const t = Q.plain(s); t.ans.unit = unit; const c = PC.plans.ctx(t, lv); c.cands = PC.plans.edgeCands(rooms, 'rA', c); const g = PC.plans.resizeRect(A, 'e', dx, 0, c).rect; return r2(g.x + g.w); };
  const B = (x, y, w = 2, h = 2) => ({ id: 'rB', x, y, w, h }); let g;
  for (const [name, rooms, dx, want] of [
    ['neighbour 0.15 m away, its span 0.25 m beyond A\'s: beats the grid line 0.05 m away', [A, B(2.2, 2.25)], 0.05, 2.2],
    ['neighbour whose span starts 0.4 m beyond A\'s: ignored, grid', [A, B(2.2, 2.4)], 0.05, 2],
    ['edge released 0.4 m from a neighbour: grid', [A, B(2.6, 0.5)], 0.2, 2],
    ['neighbour 0.25 m away beats a grid line 0.05 m away', [A, B(2.3, 0.5)], 0.05, 2.3],
    ['neighbour 0.15 m away, off the grid', [A, B(2.15, 0.5)], 0, 2.15],
    ['two candidates 0.1 m either side: the lower value', [A, B(2.3, 0, 2, 1.5), { id: 'rC', x: 0.1, y: 2, w: 2, h: 2 }], 0.2, 2.1],
    ['m: no candidate near, the 0.5 m grid', [A], 0.62, 2.5]]) if ((g = resE(rooms, dx)) !== want) pr.push(`${name}: east edge at ${g}, expected ${want}`);
  { const v = resE([A], 0.62, 'ft'); if (Math.abs(v - r2(9 * 0.3048)) > 0.005) pr.push(`ft: east edge at ${v} (${(v / 0.3048).toFixed(2)} ft), expected 9 ft = ${r2(9 * 0.3048)} m`); }
  // the core and the footprint are candidates whatever their span
  { const st = core.stair, rooms = [{ id: 'rA', x: st.x - 3.2, y: 0, w: 3, h: 2 }]; const c = PC.plans.ctx(s, lv); c.cands = PC.plans.edgeCands(rooms, 'rA', c); const t = PC.plans.resizeRect(rooms[0], 'e', 0.05, 0, c).rect;
    if (Math.abs(t.x + t.w - st.x) > 1e-9) pr.push(`stair edge ${st.x} 0.15 m away (spans do not overlap): east edge at ${t.x + t.w}, expected the stair edge`); }
  { const rooms = [{ id: 'rA', x: W - 3.25, y: 0, w: 3, h: 2 }]; const t0 = Q.plain(s); t0.ans.unit = 'ft'; const c = PC.plans.ctx(t0, lv); c.cands = PC.plans.edgeCands(rooms, 'rA', c); const t = PC.plans.resizeRect(rooms[0], 'e', 0.1, 0, c).rect;
    if (Math.abs(t.x + t.w - W) > 1e-9) pr.push(`ft, footprint edge ${W} 0.15 m away: east edge at ${t.x + t.w}, expected the footprint edge`); }
  R.check('2 snapping cases: neighbour within 0.3 m beats the grid; only rooms whose span overlaps (+- 0.3 m); 0.4 m goes to the grid; ties take the lower value; 1 ft grid in ft; stair and footprint always', pr);
  void D; }

// ================= 3. a shared wall restored by the snap; pair leaves the warning list =================
{ const pr = [], s = stateOf(), lv = '1', p = s.plans[lv], pair = levelPairs(s, lv)[0];
  if (!pair) pr.push('sample First floor has no pair'); else {
    const by = Object.fromEntries(p.rooms.map((r) => [r.id, r])), a = by[pair[0]], b = by[pair[1]];
    if (!adj(a, b)) pr.push('sample pair not adjacent to start with');
    // pull a away from b along the shared wall's normal by 1.0 m, then drag back to 0.2 m off: snap restores the wall
    const ax0 = Math.abs(a.x + a.w - b.x) < 0.02 || Math.abs(b.x + b.w - a.x) < 0.02 ? 'x' : 'y', sign = 1;
    // move the room on the high side of the wall away (+1 m) and back (-0.8 m)
    const [lo0, hi0] = ax0 === 'x' ? (a.x < b.x ? [a, b] : [b, a]) : (a.y < b.y ? [a, b] : [b, a]), ax = ax0; void lo0;
    const t = Q.plain(s), ctx1 = appCtx(t, lv, t.plans[lv].rooms, hi0.id), away = PC.plans.moveRect(hi0, ax === 'x' ? sign * 1.0 : 0, ax === 'y' ? sign * 1.0 : 0, ctx1).rect;
    const res1 = PC.plans.applyEdit(t, lv, away); const u1 = myUnmet(t, lv, t.plans[lv].rooms);
    if (!res1.changed || !u1.includes(pair.join())) pr.push(`moving ${hi0.id} 1 m away: unmet by my adjacency ${JSON.stringify(u1)}`);
    if (!eq(t.plans[lv].unmet.map(String).sort(), u1)) pr.push(`app unmet ${JSON.stringify(t.plans[lv].unmet)} vs my adjacency ${JSON.stringify(u1)}`);
    const moved = t.plans[lv].rooms.find((r) => r.id === hi0.id), ctx2 = appCtx(t, lv, t.plans[lv].rooms, hi0.id), back = PC.plans.moveRect(moved, ax === 'x' ? -sign * 0.8 : 0, ax === 'y' ? -sign * 0.8 : 0, ctx2).rect;
    PC.plans.applyEdit(t, lv, back); const u2 = myUnmet(t, lv, t.plans[lv].rooms);
    if (u2.includes(pair.join())) pr.push(`dragged back to 0.2 m off: wall not restored, ${hi0.id} at ${JSON.stringify(back)} vs ${JSON.stringify(hi0)}`);
    if (!eq(t.plans[lv].unmet.map(String).sort(), u2)) pr.push(`after restoring: app unmet ${JSON.stringify(t.plans[lv].unmet)} vs mine ${JSON.stringify(u2)}`); }
  R.check('3 sample First floor pair: moving a room 1 m away breaks it (unmet by my adjacency), dragging it back to 0.2 m off restores the wall and the pair leaves unmet', pr); }

// ================= 4. applyEdit, problems, canApprove, approve: random operation sequences =================
{ const r = rng(77), pr = [], inv = [], cnt = { edit: 0, noop: 0, approve: 0, refused: 0, unapprove: 0, regen: 0, overlapStates: 0 };
  for (let run = 0; run < 60; run++) { const base = STATES[run % STATES.length].s, s = Q.plain(base);
    for (let k = 0; k < 40; k++) { const lv = r() < 0.5 ? 'G' : '1', p = s.plans[lv]; if (!p || p.error) continue; const before = Q.plain(s), op = r();
      if (op < 0.6) { const room = p.rooms[Math.floor(r() * p.rooms.length)], ctx = appCtx(s, lv, p.rooms, room.id), kind = ['move', 'move', 'n', 's', 'e', 'w'][Math.floor(r() * 6)], dx = (r() - 0.5) * 6, dy = (r() - 0.5) * 6;
        const rect = kind === 'move' ? PC.plans.moveRect(room, dx, dy, ctx).rect : PC.plans.resizeRect(room, kind, dx, dy, ctx).rect, res = PC.plans.applyEdit(s, lv, rect), same = eq(rnd2(rect), rnd2(room));
        if (same) { cnt.noop++; if (res.changed || !eq(s, before)) pr.push(`run ${run}: a no-op edit changed the state`); }
        else { cnt.edit++; const q = s.plans[lv];
          if (!res.changed || !q.edited || q.approved || res.wasApproved !== before.plans[lv].approved) pr.push(`run ${run}: applyEdit flags ${JSON.stringify({ res, edited: q.edited, approved: q.approved, was: before.plans[lv].approved })}`);
          for (const o of Object.keys(s.plans)) if (o !== lv && !eq(s.plans[o], before.plans[o])) pr.push(`run ${run}: editing ${lv} changed level ${o}`);
          if (!eq(s.ans, before.ans) || q.sig !== before.plans[lv].sig) pr.push(`run ${run}: an edit changed answers or the signature`);
          if (!eq(q.unmet.map(String).sort(), myUnmet(s, lv, q.rooms))) pr.push(`run ${run}: unmet ${JSON.stringify(q.unmet)} vs my adjacency ${JSON.stringify(myUnmet(s, lv, q.rooms))}`);
          const others = q.rooms.filter((x) => x.id !== rect.id); if (!eq(others, before.plans[lv].rooms.filter((x) => x.id !== rect.id))) pr.push(`run ${run}: other rooms moved`); } }
      else if (op < 0.8) { const mine = myOverlaps(p.rooms, PC.plans.ctx(s, lv).core), ok = PC.plans.approve(s, lv); if (mine.length) cnt.overlapStates++;
        if (ok === !!mine.length) pr.push(`run ${run}: approve ${ok} with my overlaps ${JSON.stringify(mine)}`); ok ? cnt.approve++ : cnt.refused++;
        const why = PC.plans.canApprove(before, lv); if (why !== (mine.length ? 'overlap' : '')) pr.push(`run ${run}: canApprove "${why}" with my overlaps ${JSON.stringify(mine)}`);
        const app = PC.plans.problems(before, lv).map((x) => x.ids.join('+')).sort(); if (!eq(app, mine)) pr.push(`run ${run}: problems ${JSON.stringify(app)} vs mine ${JSON.stringify(mine)}`); }
      else if (op < 0.92) { const was = p.approved, ok = PC.plans.unapprove(s, lv); cnt.unapprove++; if (ok !== was || s.plans[lv].approved) pr.push(`run ${run}: unapprove`); if (!eq(s.plans[lv].rooms, before.plans[lv].rooms)) pr.push(`run ${run}: unapprove moved rooms`); }
      else { PC.plans.regenerate(s, lv); cnt.regen++; const q = s.plans[lv]; if (q.edited || q.approved) pr.push(`run ${run}: regenerate left flags`); for (const o of Object.keys(s.plans)) if (o !== lv && !eq(s.plans[o], before.plans[o])) pr.push(`run ${run}: regenerate ${lv} changed ${o}`); }
      // invariant: approved => no overlaps (QA's overlap), current signature, no error; and it survives a draft round trip
      for (const id of Object.keys(s.plans)) { const q = s.plans[id]; if (q.approved && (q.error || q.sig !== PC.sig.level(s, id) || myOverlaps(q.rooms, PC.plans.ctx(s, id).core).length)) inv.push(`run ${run} step ${k}: ${id} approved with overlaps / stale / error`); } }
    const back = PC.draft.parse(PC.draft.serialize(s, 0)); const st = back && (back.state || back); if (!st || !eq(st.plans, s.plans)) pr.push(`run ${run}: plans differ after a draft round trip (reload)`); }
  R.check(`4 ${cnt.edit} edits, ${cnt.noop} no-op releases, ${cnt.approve} approvals, ${cnt.refused} refusals (${cnt.overlapStates} with overlaps), ${cnt.unapprove} un-approves, ${cnt.regen} regenerates: applyEdit flags, unmet by my adjacency, other levels and rooms untouched; problems / canApprove equal my overlaps`, [...new Set(pr)].slice(0, 6));
  R.check('4 invariant "approved => no overlaps (QA overlap), current signature, no error" after every operation and across a draft round trip', inv.slice(0, 5)); }

// ================= 5. overlap tolerance: 0.02 m is an overlap, 0.01 m is not; core overlaps refuse approval =================
{ const pr = [], s = stateOf(), lv = 'G', p = s.plans[lv], core = PC.plans.ctx(s, lv).core;
  const [a, b] = p.rooms.filter((x) => p.rooms.some((y) => y !== x && adj(x, y))).slice(0, 2);
  const pairAdj = p.rooms.flatMap((x) => p.rooms.filter((y) => y.id > x.id && Math.abs(x.x + x.w - y.x) < 1e-6 && Math.min(x.y + x.h, y.y + y.h) - Math.max(x.y, y.y) > 0.5).map((y) => [x, y]))[0];
  if (!pairAdj) pr.push('no side-by-side pair in the sample Ground floor'); else {
    for (const [by, want] of [[0.01, false], [0.02, true]]) { const t = Q.plain(s), q = t.plans[lv], x = q.rooms.find((r) => r.id === pairAdj[0].id); x.w = r2(x.w + by); t.plans[lv].approved = false;
      const why = PC.plans.canApprove(t, lv), mine = myOverlaps(q.rooms, core); if ((why === 'overlap') !== want || !!mine.length !== want) pr.push(`${by} m into ${pairAdj[1].id}: canApprove "${why}", my overlaps ${JSON.stringify(mine)}`); } }
  { const t = Q.plain(s), q = t.plans[lv], st = core.stair, x = q.rooms[0]; Object.assign(x, { x: st.x - 0.5, y: st.y - 0.5, w: 2, h: 2 }); const why = PC.plans.canApprove(t, lv), ok = PC.plans.approve(t, lv);
    if (why !== 'overlap' || ok || t.plans[lv].approved) pr.push(`room over the stair: canApprove "${why}", approve ${ok}`);
    const codes = PC.plans.problems(t, lv).map((z) => z.code); if (!codes.includes('overlap-core')) pr.push(`codes ${codes}`); }
  { const t = Q.plain(s); t.plans[lv].sig = 'old'; if (PC.plans.canApprove(t, lv) !== 'none' || PC.plans.approve(t, lv)) pr.push('a stale plan can be approved'); }
  { const t = Q.plain(s); t.plans[lv] = { ...t.plans[lv], rooms: [], error: 'no-layout' }; if (PC.plans.canApprove(t, lv) !== 'none' || PC.plans.approve(t, lv)) pr.push('a no-layout level can be approved'); }
  R.check('5 overlap at 0.02 m refuses approval, 0.01 m does not; a room over the stair refuses (overlap-core); stale and no-layout plans cannot be approved', pr); void a; void b; }

R.note(`runtime ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
