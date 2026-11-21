// F3-T2: plan editing in PC.plans (F3-S2, F3-S3, A-15): snapEdge (neighbour edges whose span overlaps the moving
// edge's span +- 0.3 m, the stair / lift and the footprint within 0.3 m first, then the grid of the unit),
// moveRect / resizeRect (footprint clamp, 1.5 m minimum side), applyEdit, overlaps, approve / unapprove.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

const PC = loadCore(), P = PC.plans;
const synced = (unit = 'm') => { const s = plain(PC.sample.state()); s.ans.unit = unit; P.sync(s); return s; };
const room = (s, lv, id) => s.plans[lv].rooms.find((r) => r.id === id);
const ctxOf = (s, lv, id) => { const c = plain(P.ctx(s, lv)); c.cands = plain(P.edgeCands(s.plans[lv].rooms, id, c)); return c; };
// A synthetic floor: W 9.7 (off the grid), stair at x 6.13 (off the grid); A is the room being edited.
const A = { id: 'a', x: 0, y: 0, w: 4, h: 4 };
function synth(grid, others) {
  const c = { W: 9.7, D: 10, grid, core: { stair: { x: 6.13, y: 6, w: 2.5, h: 4 }, lift: null } };
  c.cands = plain(P.edgeCands([A, ...others], 'a', c));
  return c;
}
const east = (c, raw) => plain(P.resizeRect(A, 'e', raw - 4, 0, c)).rect.w;

for (const [unit, grid, g453] of [['m', 0.5, 4.5], ['ft', 0.3048, 4.57]]) {
  test(`snapEdge (${unit}): neighbour within 0.3 m first, else the ${unit} grid; only neighbours whose span overlaps (+- 0.3 m)`, () => {
    const B = { id: 'b', x: 4.13, y: 0, w: 1.5, h: 4 };                // beside A, its left edge off the grid
    const c = synth(grid, [B]);
    assert.equal(east(c, 4.33), 4.13, '0.2 m from the neighbour: lands exactly on it');
    assert.ok(PC.layout.adjacent({ ...A, w: east(c, 4.33) }, B), 'the shared wall is restored');
    assert.equal(east(c, 4.53), g453, '0.4 m away: the grid instead');
    assert.equal(east(c, 4.38), 4.13, 'a neighbour 0.25 m away beats a nearer grid line');
    const far = synth(grid, [{ id: 'b', x: 4.13, y: 6, w: 1.5, h: 3 }]);   // parallel, 2 m beyond A's span
    assert.notEqual(east(far, 4.33), 4.13, 'a non-overlapping parallel edge 0.2 m away does not snap');
    const near = synth(grid, [{ id: 'b', x: 4.13, y: 4.2, w: 1.5, h: 3 }]); // starts 0.2 m past A's span
    assert.equal(east(near, 4.33), 4.13, 'a span within 0.3 m of the moving span counts');
    const stair = plain(P.resizeRect({ ...A, x: 2, w: 4, y: 6 }, 'e', 0, 0, synth(grid, []))).rect;   // right edge at 6.0
    assert.equal(stair.x + stair.w, 6.13, 'the stair block, 0.13 m away');
    const fp = plain(P.resizeRect({ ...A, x: 5, w: 4 }, 'e', 0.5, 0, synth(grid, []))).rect;          // raw 9.5
    assert.equal(fp.x + fp.w, 9.7, 'the footprint edge, 0.2 m away, beats the grid line on 9.5');
    const tie = plain(P.snapEdge(5, 0, 4, [{ v: 4.8, lo: 0, hi: 4, kind: 'room' }, { v: 5.2, lo: 0, hi: 4, kind: 'room' }], grid, 0, 10));
    assert.equal(tie.v, 4.8, 'equal distances: the lower value');
    const lim = plain(P.snapEdge(4.33, 0, 4, [{ v: 4.13, lo: 0, hi: 4, kind: 'room' }], grid, 4.2, 9));
    assert.notEqual(lim.v, 4.13, 'a candidate outside the allowed range is skipped');
  });
}

test('snapEdge on the sample in ft: the Kitchen edge snaps to the stair (0.2 m) over the 1 ft grid, else to the 1 ft grid', () => {
  const s = synced('ft'), k = room(s, 'G', 'r4'), c = ctxOf(s, 'G', 'r4');
  assert.equal(c.grid, 0.3048);
  const at = (raw) => { const r = plain(P.resizeRect(k, 'e', raw - (k.x + k.w), 0, c)).rect; return r.x + r.w; };
  assert.equal(at(3.3), 3.5, 'stair edge at 3.5 m, although 11 ft = 3.35 m is nearer');
  assert.equal(at(3.1), 3.05, '0.4 m from the stair and 0.6 m from Living / Dining: 10 ft = 3.048 m (0.01 m rounding)');
  assert.ok(Math.abs(at(3.1) / 0.3048 - 10) < 0.02);
});

test('moveRect: clamped at every footprint side; snaps by the nearer edge; the same input gives the same result (live = release)', () => {
  const s = synced(), k = room(s, 'G', 'r2'), c = ctxOf(s, 'G', 'r2');   // Majlis 5 x 5 at the front-left corner
  const mv = (dx, dy) => plain(P.moveRect(k, dx, dy, c)).rect;
  assert.deepEqual([mv(-3, -3).x, mv(-3, -3).y], [0, 0], 'left / front');
  assert.deepEqual([mv(20, 30).x, mv(20, 30).y], [4.5, 10], 'right / back: x + w = W, y + h = D');
  assert.deepEqual(mv(1.13, 2.07), mv(1.13, 2.07));
  const r = mv(1.13, 2.07); assert.ok([r.x, r.y].every((v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9), 'on the grid or a neighbour (all on 0.5 m here)');
  assert.deepEqual([r.w, r.h], [5, 5], 'a move never changes the size');
  const g = plain(P.moveRect(k, 2.4, 0, c));
  assert.equal(g.rect.x + g.rect.w, 7.5, 'raw right edge 7.4: the high edge snaps to the Maid room right edge (0.1 m, span overlaps)');
  assert.ok(g.guides.some((q) => q.axis === 'x' && q.v === 7.5), 'the edge snap reports its guide');
});

test('resizeRect: each edge stops at the footprint and 1.5 m from the opposite edge; the opposite edge never moves', () => {
  const s = synced(), k = room(s, 'G', 'r4'), c = ctxOf(s, 'G', 'r4');   // Kitchen x 0..3.5, y 5.5..9.5
  const rz = (kind, dx, dy) => plain(P.resizeRect(k, kind, dx, dy, c)).rect;
  assert.deepEqual(rz('w', -5, 0), { id: 'r4', x: 0, y: 5.5, w: 3.5, h: 4 }, 'left edge stops at the footprint');
  assert.equal(rz('e', -5, 0).w, 1.5, 'right edge stops 1.5 m from the left');
  assert.equal(rz('e', 20, 0).w, 9.5, 'right edge stops at W');
  assert.deepEqual([rz('w', 5, 0).x, rz('w', 5, 0).w], [2, 1.5], 'left edge stops 1.5 m from the right');
  assert.deepEqual([rz('s', 0, 20).y, rz('s', 0, 20).h], [8, 1.5], 'front edge stops 1.5 m from the back');
  assert.deepEqual([rz('s', 0, -20).y, rz('s', 0, -20).h], [0, 9.5]);
  assert.equal(rz('n', 0, -20).h, 1.5); assert.equal(rz('n', 0, 20).y + rz('n', 0, 20).h, 15, 'back edge stops at D');
  for (const kind of ['n', 's']) { const r = rz(kind, 0, 0.7); assert.deepEqual([r.x, r.w], [0, 3.5], `${kind}: x edges untouched`); }
  for (const kind of ['e', 'w']) { const r = rz(kind, 0.7, 0); assert.deepEqual([r.y, r.h], [5.5, 4], `${kind}: y edges untouched`); }
  const e = rz('e', 0.737, 0); assert.equal(Math.round(e.w * 100), e.w * 100, '0.01 m precision');
});

test('applyEdit: edited, approval cleared, unmet recomputed (break and restore a pair), other levels deep-equal, no-op ignored', () => {
  const s = synced(); s.plans.G.approved = true; s.plans['1'].approved = true; s.plans['1'].edited = true;
  const first = plain(s.plans['1']), k = room(s, 'G', 'r4'), c = ctxOf(s, 'G', 'r4');
  assert.deepEqual(plain(P.applyEdit(s, 'G', { ...k })), { changed: false, wasApproved: true }, 'same rectangle: nothing');
  assert.equal(s.plans.G.approved, true);
  const down = plain(P.moveRect(k, 0, -0.8, c)).rect;                     // Kitchen away from Dining (pair r3-r4)
  assert.equal(down.y + down.h, 9, 'moved to the grid, 0.5 m below the Dining wall');
  assert.deepEqual(plain(P.applyEdit(s, 'G', down)), { changed: true, wasApproved: true });
  assert.deepEqual([s.plans.G.edited, s.plans.G.approved, plain(s.plans.G.unmet)], [true, false, [['r3', 'r4']]], 'pair broken');
  const c2 = ctxOf(s, 'G', 'r4'), back = plain(P.resizeRect(room(s, 'G', 'r4'), 'n', 0, 0.3, c2)).rect;
  assert.equal(back.y + back.h, 9.5, 'back edge 0.2 m from the Dining wall snaps onto it');
  P.applyEdit(s, 'G', back);
  assert.deepEqual(plain(s.plans.G.unmet), [], 'shared wall restored');
  assert.deepEqual(plain(s.plans['1']), first, 'editing Ground never changes First');
  assert.ok(PC.draft.validState(s), 'still a valid draft (no schema change)');
});

test('overlaps: rooms and the core, beyond 0.011 m; Approve refused while any exists; approve / unapprove; hasWork', () => {
  const s = synced(), k = room(s, 'G', 'r4');
  assert.equal(P.canApprove(s, 'G'), ''); assert.deepEqual(plain(P.problems(s, 'G')), []);
  P.applyEdit(s, 'G', { ...k, w: 3.52 });                                  // 0.02 m into the stair (x 3.5)
  assert.deepEqual(plain(P.problems(s, 'G')), [{ code: 'overlap-core', ids: ['r4', 'stair'] }]);
  assert.equal(P.canApprove(s, 'G'), 'overlap'); assert.equal(P.approve(s, 'G'), false); assert.equal(s.plans.G.approved, false);
  P.applyEdit(s, 'G', { ...k, w: 3.51 }); assert.deepEqual(plain(P.problems(s, 'G')), [], '0.01 m is within the tolerance');
  P.applyEdit(s, 'G', { ...k, y: 5.6, h: 4 });                              // 0.1 m into Dining and Living
  assert.deepEqual(plain(P.problems(s, 'G')), [{ code: 'overlap-room', ids: ['r1', 'r4'] }, { code: 'overlap-room', ids: ['r3', 'r4'] }]);
  P.applyEdit(s, 'G', k);
  assert.equal(P.approve(s, 'G'), true); assert.equal(s.plans.G.approved, true);
  assert.equal(P.hasWork(s.plans.G), true);
  assert.equal(P.unapprove(s, 'G'), true); assert.equal(s.plans.G.approved, false); assert.equal(P.unapprove(s, 'G'), false);
  assert.equal(P.hasWork(s.plans.G), true, 'edited'); assert.equal(P.hasWork(synced().plans.G), false, 'untouched Draft');
  const e = synced(); e.plans.G = { ...e.plans.G, error: 'no-layout', rooms: [] }; assert.equal(P.canApprove(e, 'G'), 'none');
  const st = synced(); st.plans.G.sig = 'stale'; assert.equal(P.canApprove(st, 'G'), 'none');
});

test('invariant: approved implies no overlaps, through every operation', () => {
  const s = synced(), ok = () => Object.keys(s.plans).every((id) => !s.plans[id].approved || !P.problems(s, id).length);
  const k = room(s, 'G', 'r4'), c = ctxOf(s, 'G', 'r4');
  const ops = [() => P.approve(s, 'G'), () => P.applyEdit(s, 'G', { ...k, w: 4.5 }), () => P.approve(s, 'G'), () => P.unapprove(s, 'G'),
    () => P.applyEdit(s, 'G', plain(P.moveRect(k, 3, 0, c)).rect), () => P.approve(s, 'G'), () => P.regenerate(s, 'G'), () => P.approve(s, 'G'),
    () => P.applyEdit(s, 'G', { ...room(s, 'G', 'r4'), x: 1 }), () => P.approve(s, '1')];
  for (const op of ops) { op(); assert.ok(ok(), String(op)); }
});

test('stage 5 is reachable after approvals (MAX_BUILT 5); Skip lands there; Q18 / Q19 keep approvals', () => {
  assert.equal(PC.stages.MAX_BUILT, 5);
  const s = synced(); for (const id of ['G', '1']) P.approve(s, id);
  const st = PC.stages.status(s);
  assert.deepEqual([st[3].valid, st[4].reachable, st[5].reachable], [true, true, true]);
  assert.equal(PC.stages.skipTarget(s), 5);
  const t = plain(s); t.ans.interior = { style: 'classic', density: 'sparse' };
  assert.ok(['G', '1'].every((id) => PC.sig.level(t, id) === s.plans[id].sig), 'Q18 / Q19 change no signature');
});

test('resizeRect in ft: an edge dragged past the footprint lands exactly on it (QA F3-T2 bug 1)', () => {
  const s = synced('ft'), k = room(s, 'G', 'r4'), c = ctxOf(s, 'G', 'r4');     // Kitchen x 0..3.5, y 5.5..9.5; W 9.5, D 15
  const rz = (kind, dx, dy) => plain(P.resizeRect(k, kind, dx, dy, c)).rect;
  for (const over of [0.4, 1, 3]) {
    assert.equal(rz('w', -over, 0).x, 0, `left edge ${over} m past the footprint: x 0`);
    assert.equal(rz('s', 0, -(5.5 + over)).y, 0, `front edge ${over} m past: y 0`);
    const e = rz('e', 6 + over, 0); assert.equal(e.x + e.w, 9.5, `right edge ${over} m past: W (9.5 is off the 1 ft grid)`);
    const n = rz('n', 0, 5.5 + over); assert.equal(n.y + n.h, 15, `back edge ${over} m past: D`);
  }
});

test('moveRect: a move past the footprint takes the neighbours\' span from the clamped room, not the finger (QA F3-T2 obs 5)', () => {
  // A dragged 9 m back: the finger span is y 9..13, the clamped room y 6..10. B (y 5..8.5) overlaps the clamped span
  // only (0.5 m from the finger span, beyond the 0.3 m allowance), so A's right edge (raw 4.33) snaps to B's left edge.
  for (const grid of [0.5, 0.3048]) {
    const c = synth(grid, [{ id: 'b', x: 4.13, y: 5, w: 1.5, h: 3.5 }]);
    const r = plain(P.moveRect(A, 0.33, 9, c)).rect;
    assert.equal(r.y, 6, 'clamped at the back');
    assert.equal(r.x + r.w, 4.13, `grid ${grid}: the right edge lands on the neighbour seen from the clamped span`);
  }
});

// ---- F4-T2 Step 0 ----
test('applyEdit guard (CTO F3 round 2): a stale plan or a side <= 0 is refused, nothing stored', () => {
  const s = synced(), before = plain(s.plans.G), r = room(s, 'G', 'r1');
  for (const rect of [{ ...r, w: 0 }, { ...r, h: -1 }]) assert.deepEqual(plain(P.applyEdit(s, 'G', rect)), { changed: false, wasApproved: false });
  assert.deepEqual(plain(s.plans.G), before, 'no side <= 0 stored');
  const st = plain(s); st.ans.footprintPct = 30;                            // the stored G plan is now stale
  assert.notEqual(st.plans.G.sig, PC.sig.level(st, 'G'));
  assert.equal(P.applyEdit(st, 'G', { ...r, x: r.x + 0.5 }).changed, false, 'stale plan refused');
  assert.equal(P.applyEdit(s, 'G', { ...r, x: r.x + 0.5 }).changed, true, 'a fresh plan still edits');
});

test('CTO debt 6: a room overlapping only the lift is reported by overlaps and blocks approve', () => {
  const s = plain(PC.sample.state()); s.ans.lift = true; P.sync(s);
  const lift = plain(P.ctx(s, 'G')).core.lift, r = room(s, 'G', 'r6');
  assert.ok(lift, 'the sample with a lift');
  s.plans.G.rooms = s.plans.G.rooms.map((q) => q.id === 'r6' ? { id: 'r6', x: lift.x, y: lift.y, w: lift.w, h: lift.h } : q);
  assert.deepEqual(plain(P.problems(s, 'G')).filter((q) => q.ids.includes('r6')), [{ code: 'overlap-core', ids: ['r6', 'lift'] }]);
  assert.equal(P.canApprove(s, 'G'), 'overlap'); assert.equal(P.approve(s, 'G'), false);
  assert.ok(r, 'room r6 exists');
});

test('one-step undo: restores the plan and its approval; ends with a new edit, Regenerate, approve / unapprove or an R5 reset', () => {
  // a 0.1 m shrink of the Maid's room: never an overlap, so Approve stays possible
  const edit = (s) => { const b = P.snapshot(s.plans.G), r = room(s, 'G', 'r5'); P.applyEdit(s, 'G', { ...r, w: r.w - 0.1 }); return { level: 'G', before: b, after: P.snapshot(s.plans.G) }; };
  let s = synced(); P.approve(s, 'G'); const orig = plain(s.plans.G);
  let u = edit(s);
  assert.equal(s.plans.G.approved, false); assert.equal(P.undoable(s, u), true);
  assert.equal(P.undoEdit(s, u), true); assert.deepEqual(plain(s.plans.G), orig, 'plan and approval back');
  assert.equal(P.undoable(s, u), false, 'one step: not twice');
  u = edit(s); edit(s);
  assert.equal(P.undoable(s, u), false, 'a second edit ends the first snapshot');
  u = edit(s); P.regenerate(s, 'G'); assert.equal(P.undoable(s, u), false, 'Regenerate');
  u = edit(s); P.approve(s, 'G'); assert.equal(P.undoable(s, u), false, 'approve');
  u = edit(s); s.ans.footprintPct = 30; P.sync(s); assert.equal(P.undoable(s, u), false, 'R5 reset (sync regenerated)');
  assert.equal(P.undoEdit(s, u), false); assert.equal(P.undoable(s, null), false);
});

test('fill (PM round 8): drawn rooms + stair + lift over the footprint; the low-fill hint threshold is strict (< 50 %)', () => {
  const s = synced();
  assert.ok(Math.abs(P.fill(s, 'G') - 0.811) < 0.001 && P.fill(s, '1') > 0.84, 'sample 81 % / 84 %');
  const c = plain(P.ctx(s, 'G')), half = c.W * c.D / 2 - c.core.stair.w * c.core.stair.h;   // 71.25 - 10 = 61.25 = 7 x 8.75
  s.plans.G.rooms = [{ id: 'r1', x: 0, y: 0, w: 7, h: half / 7 }];
  assert.equal(P.fill(s, 'G'), 0.5); assert.equal(P.lowFill(s, 'G'), null, 'exactly 50 %: no hint');
  assert.equal(P.lowFill(s, '1'), null, 'sample First floor: no hint');
  s.plans.G.rooms[0].h -= 0.01; assert.ok(P.fill(s, 'G') < 0.5); assert.equal(P.lowFill(s, 'G'), 49, 'just under: 49 %');
  const st = plain(s); st.ans.footprintPct = 30; assert.equal(P.fill(st, 'G'), null, 'stale plan: none');
});

test('ft minimum (PM round 8 decision 5): a shrinking edge lands exactly on 1.5 m in ft; m unchanged', () => {
  const ft = synth(0.3048, []), m = synth(0.5, []);
  assert.equal(east({ ...ft, minSnap: true }, 1.6), 1.5, 'ft: the 1.5 m limit is a candidate');
  assert.equal(east({ ...ft, minSnap: true }, 1.85), 1.83, 'ft: 0.35 m away the grid still rules (6 ft)');
  assert.equal(east(ft, 1.6), 1.52, 'without the candidate (old behaviour): 5 ft');
  assert.equal(east(m, 1.6), 1.5, 'm: the grid lands there anyway');
  assert.equal(plain(P.ctx(synced('ft'), 'G')).minSnap, true); assert.equal(plain(P.ctx(synced('m'), 'G')).minSnap, false);
  const g = plain(P.resizeRect(A, 'e', 1.6 - 4, 0, { ...ft, minSnap: true })).guides;
  assert.deepEqual(g, [], 'no snap guide for the limit');
});
