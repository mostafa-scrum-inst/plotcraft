import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

const fresh = () => { const PC = loadCore(); PC.store.init(PC.sample.state()); return PC; };
const sigs = (PC, s) => Object.fromEntries(PC.levels.ids(s).map((id) => [id, PC.sig.level(s, id)]));
const changed = (PC, f) => { const a = PC.sample.state(), b = PC.sample.state(); f(b.ans, b); const x = sigs(PC, a), y = sigs(PC, b); return plain(PC.levels.ids(a)).filter((id) => x[id] !== y[id]); };
const PLAN = (sig, approved = true) => ({ sig, rooms: [], unmet: [], edited: true, approved, error: null });
// Gives every level a valid, approved plan (as F3 will); returns the handler log.
function withPlans(PC, answer = true) {
  PC.store.commit((s) => { PC.levels.ids(s).forEach((id) => { s.plans[id] = PLAN(PC.sig.level(s, id)); }); }, { nav: true });
  const asked = [];
  PC.store.setConfirmHandler((q) => { asked.push(q); return Promise.resolve(typeof answer === 'function' ? answer(asked.length) : answer); });
  return asked;
}

test('content: footprint size and street edge, core, rooms and pairs of the level in numeric id order', () => {
  const PC = fresh(), s = PC.sample.state();
  assert.deepEqual(JSON.parse(PC.sig.level(s, '1')), { fp: [9.5, 15, 0], core: ['centre', 0],
    rooms: [['r8', 'bedroom', 24], ['r9', 'bedroom', 16], ['r10', 'bedroom', 16], ['r11', 'living', 30], ['r12', 'office', 12], ['r13', 'bathroom', 6], ['r14', 'bathroom', 6]], pairs: [['r8', 'r13']] });
  assert.equal(PC.sig.level(s, '2'), 'invalid', 'level that does not exist'); assert.equal(PC.sig.level(s, 'B'), 'invalid');
  const open = PC.sample.state(); open.plot.closed = false; open.ans.streetEdge = null; assert.equal(PC.sig.level(open, 'G'), 'invalid', 'open plot');
  const flat = PC.sample.state(); flat.ans.floors = 1; flat.ans.rooms = flat.ans.rooms.filter((r) => r.level === 'G'); flat.ans.pairs = [['r3', 'r4']];
  assert.equal(JSON.parse(PC.sig.level(flat, 'G')).core, 0, 'single level: no core');
  const nul = PC.sample.state(); nul.ans.streetEdge = null; assert.equal(PC.sig.level(nul, 'G'), PC.sig.level(s, 'G'), 'null street edge = resolved default');
});

test('appearance answers never change a signature (Q1, Q4, Q5, Q8, Q9, Q10, Q15-Q19), nor do names or the master flag', () => {
  const PC = fresh();
  const cases = { Q1: (a) => { a.unit = 'ft'; }, Q4: (a) => { a.vegPct = 60; }, Q5: (a) => { a.north = 135; }, Q8: (a) => { a.ceilingH = 4; }, Q9: (a) => { a.roofType = 'terrace'; },
    Q10: (a) => { a.exterior = 'terracotta'; }, Q15: (a) => { a.parking = { cars: 4, covered: false }; }, Q16: (a) => { a.pool = { on: false, size: 'L' }; },
    Q17: (a) => { a.extras = { wall: false, gate: 'left', seating: false }; }, Q18: (a) => { a.interior.style = 'classic'; }, Q19: (a) => { a.interior.density = 'sparse'; },
    'usable roof (stairs already exist)': (a) => { a.usableRoof = true; }, master: (a) => { a.rooms[7].master = false; a.rooms[8].master = true; },
    stage: (a, s) => { s.stage = 2; s.sampleClean = false; } };
  for (const [q, f] of Object.entries(cases)) assert.deepEqual(changed(PC, f), [], q);
});

test('layout answers: every level on footprint size, street edge, stairs; only the touched level on rooms, sizes, pairs', () => {
  const PC = fresh(), all = ['G', '1'];
  assert.deepEqual(changed(PC, (a) => { a.footprintPct = 30; }), all, 'Q3');
  assert.deepEqual(changed(PC, (a) => { a.streetEdge = 1; }), all, 'Q6');
  assert.deepEqual(changed(PC, (a) => { a.stairPos = 'fl'; }), all, 'Q14 position');
  assert.deepEqual(changed(PC, (a) => { a.lift = true; }), all, 'Q14 lift');
  assert.deepEqual(changed(PC, (a) => { a.setbacks.back = 3; }), all, 'Q2 that alters the depth');
  assert.deepEqual(changed(PC, (a, s) => { s.plot.pts[1] = [16, 0]; s.plot.pts[2] = [16, 30]; }), all, 'plot change that alters the size');
  assert.deepEqual(changed(PC, (a) => { a.rooms.push(PC.store.room('r15', 'storage', 'G', 'S')); a.nextRoomId = 16; }), ['G'], 'Q11 add');
  assert.deepEqual(changed(PC, (a) => { a.rooms = a.rooms.filter((r) => r.id !== 'r14'); }), ['1'], 'Q11 remove');
  assert.deepEqual(changed(PC, (a) => { a.rooms[1].type = 'office'; }), ['G'], 'Q11 type');
  assert.deepEqual(changed(PC, (a) => { a.rooms[8].size = 'L'; }), ['1'], 'Q12 size');
  assert.deepEqual(changed(PC, (a) => { a.rooms[8].size = null; a.rooms[8].area = 17; }), ['1'], 'Q12 exact');
  assert.deepEqual(changed(PC, (a) => { a.rooms[8].size = null; a.rooms[8].area = 16; }), [], 'exact area equal to the M value changes nothing');
  assert.deepEqual(changed(PC, (a) => { a.pairs.push(['r1', 'r2']); }), ['G'], 'Q13 add');
  assert.deepEqual(changed(PC, (a) => { a.pairs = [['r3', 'r4']]; }), ['1'], 'Q13 remove');
  assert.deepEqual(changed(PC, (a) => { a.rooms[6].level = '1'; }), all, 'moving a room touches both levels');
  assert.deepEqual(changed(PC, (a) => { a.floors = 3; }), [], 'Q7 added floor: existing levels untouched');
  // stairs appear: one floor alone has none; a usable roof (or a basement) brings them
  const one = () => { const s = PC.sample.state(); s.ans.floors = 1; s.ans.rooms = s.ans.rooms.filter((r) => r.level === 'G'); s.ans.pairs = [['r3', 'r4']]; return s; };
  const a = one(), b = one(); b.ans.usableRoof = true; assert.notEqual(PC.sig.level(a, 'G'), PC.sig.level(b, 'G'), 'stairs appearing resets the level');
});

test('a change that only moves the footprint resets nothing and asks nothing (CTO round 2)', async () => {
  const PC = fresh(), asked = withPlans(PC), before = plain(PC.store.get().plans);
  // back setback 2 -> 2.25 m: buildable box 16 x 24.75, size still 9.5 x 15.0, footprint v 8 -> 7.875
  const moved = PC.sample.state(); moved.ans.setbacks.back = 2.25; const fp = PC.site.analyse(moved).footprint;
  assert.deepEqual([fp.u, fp.v, fp.w, fp.d], [5.25, 7.875, 9.5, 15], 'the footprint really moves and keeps its size');
  assert.deepEqual(changed(PC, (a) => { a.setbacks.back = 2.25; }), []);
  assert.equal(await PC.store.propose((s) => { s.ans.setbacks.back = 2.25; }), true);
  assert.equal(PC.store.get().ans.setbacks.back, 2.25); assert.equal(asked.length, 0, 'no question');
  assert.deepEqual(plain(PC.store.get().plans), before, 'plans, edits and approvals untouched');
  assert.equal(PC.stages.status(PC.store.get())[3].valid, true, 'every level still approved and valid');
  // vertex (8,30) -> (8.5,30): area 583, size still 9.5 x 15.0
  assert.equal(await PC.store.propose((s) => { s.plot.pts[3] = [8.5, 30]; }), true);
  assert.equal(asked.length, 0); assert.deepEqual(plain(PC.store.get().plans), before);
  const f2 = PC.site.analyse(PC.store.get()).footprint; assert.deepEqual([f2.w, f2.d], [9.5, 15]); assert.equal(PC.site.analyse(PC.store.get()).plotArea, 583);
  // counter-case: back setback 3 m makes the building 14.5 m deep -> it does ask
  assert.equal(await PC.store.propose((s) => { s.ans.setbacks.back = 3; }), true);
  assert.equal(asked.length, 1); assert.deepEqual(plain(asked[0].levels), ['G', '1']);
});

test('gate: no plans, never asks', async () => {
  const PC = fresh(), asked = []; PC.store.setConfirmHandler((q) => { asked.push(q); return true; });
  assert.equal(await PC.store.propose((s) => { s.ans.footprintPct = 40; }), true);
  assert.equal(PC.store.get().ans.footprintPct, 40); assert.equal(asked.length, 0);
});

test('gate: asks once per visit, names only the affected levels; Continue applies', async () => {
  const PC = fresh(), asked = withPlans(PC);
  assert.equal(await PC.store.propose((s) => { s.ans.rooms[8].size = 'L'; }), true);
  assert.equal(asked.length, 1); assert.deepEqual(plain(asked[0].levels), ['1']);
  assert.equal(asked[0].title, 'Regenerate floor plans?');
  assert.equal(asked[0].text, 'The floor plan of the First floor will be regenerated, with its manual edits and approval.');
  assert.deepEqual([asked[0].ok, asked[0].cancel], ['Continue', 'Cancel']);
  assert.equal(PC.store.get().ans.rooms[8].size, 'L'); assert.equal(PC.store.get().sampleClean, false);
  assert.equal(await PC.store.propose((s) => { s.ans.footprintPct = 30; }), true);
  assert.equal(asked.length, 1, 'same visit: applied without asking'); assert.equal(PC.store.get().ans.footprintPct, 30);
  assert.equal(PC.stages.status(PC.store.get())[3].valid, false, 'the plans are stale now');
});

test('gate: Cancel leaves the identical state and tells subscribers once', async () => {
  const PC = fresh(), asked = withPlans(PC, false), before = PC.store.get(), seen = [];
  PC.store.subscribe((s, prev, meta) => seen.push([s === before, prev === before, meta.cancelled]));
  assert.equal(await PC.store.propose((s) => { s.ans.footprintPct = 30; s.ans.stairPos = 'bl'; }), false);
  assert.equal(PC.store.get(), before, 'same state object'); assert.deepEqual(seen, [[true, true, true]]);
  assert.equal(asked.length, 1); assert.match(asked[0].text, /Ground floor and the First floor .* their manual edits and approvals/);
  assert.equal(PC.store.session.r5Confirmed, false);
  assert.equal(await PC.store.propose((s) => { s.ans.footprintPct = 30; }), false); assert.equal(asked.length, 2, 'asks again after a Cancel');
  assert.equal(PC.store.get().sampleClean, true, 'a cancelled change is not an edit');
});

test('gate: asks again after stage 3 was entered, and after a whole-state replace', async () => {
  const PC = fresh(); PC.stages.MAX_BUILT = 5; const asked = withPlans(PC);
  await PC.store.propose((s) => { s.ans.pairs.push(['r1', 'r2']); });
  assert.equal(asked.length, 1); assert.equal(PC.store.session.r5Confirmed, true);
  PC.store.commit((s) => { s.plans.G = PLAN(PC.sig.level(s, 'G')); }, { nav: true });          // as plans.sync + approval would
  assert.equal(PC.store.go(2), true); assert.equal(PC.store.go(3), true); assert.equal(PC.store.session.r5Confirmed, false);
  PC.store.go(2);
  await PC.store.propose((s) => { s.ans.pairs.push(['r1', 'r3']); });
  assert.equal(asked.length, 2, 'new visit to stages 1-2');
  PC.store.replace(PC.sample.state()); assert.equal(PC.store.session.r5Confirmed, false);
});

test('gate: a stale plan does not ask; a removed level with a valid plan does; an appearance change never does', async () => {
  const PC = fresh(), asked = withPlans(PC);
  PC.store.commit((s) => { s.plans['1'].sig = 'old'; }, { nav: true });
  await PC.store.propose((s) => { s.ans.rooms[8].size = 'L'; });
  assert.equal(asked.length, 0, 'first floor plan was already stale');
  await PC.store.propose((s) => { s.ans.exterior = 'white'; s.ans.unit = 'ft'; });
  assert.equal(asked.length, 0);
  await PC.store.propose((s) => { s.ans.floors = 1; s.ans.rooms = s.ans.rooms.filter((r) => r.level === 'G'); s.ans.pairs = [['r3', 'r4']]; s.ans.usableRoof = true; });
  assert.equal(asked.length, 0, 'the removed level had only a stale plan; ground keeps stairs through the usable roof');
  const P2 = fresh(), a2 = withPlans(P2);
  await P2.store.propose((s) => { s.ans.floors = 1; s.ans.rooms = s.ans.rooms.filter((r) => r.level === 'G'); s.ans.pairs = [['r3', 'r4']]; });
  assert.equal(a2.length, 1); assert.deepEqual(plain(a2[0].levels), ['G', '1'], 'first floor removed, ground loses its stair');
  const P3 = fresh(), a3 = withPlans(P3);
  await P3.store.propose((s) => { s.plot.closed = false; s.ans.streetEdge = null; });
  assert.equal(a3.length, 1, 'reopening the plot invalidates every plan');
});

test('gate: proposals are serialised and evaluated against the then-current state; no handler = pass-through; no-op = nothing', async () => {
  const PC = fresh(), order = []; let release;
  PC.store.commit((s) => { PC.levels.ids(s).forEach((id) => { s.plans[id] = PLAN(PC.sig.level(s, id)); }); }, { nav: true });
  PC.store.setConfirmHandler(() => { order.push('asked'); return new Promise((r) => { release = r; }); });
  const p1 = PC.store.propose((s) => { s.ans.footprintPct = 30; }).then((r) => { order.push('first ' + r); });
  const p2 = PC.store.propose((s) => { s.ans.footprintPct += 5; }).then((r) => { order.push('second ' + r); });
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(order, ['asked'], 'the second waits for the first answer'); assert.equal(PC.store.get().ans.footprintPct, 25);
  release(true); await p1; await p2;
  assert.deepEqual(order, ['asked', 'first true', 'second true']); assert.equal(PC.store.get().ans.footprintPct, 35, '30, then + 5');
  let calls = 0; PC.store.subscribe(() => calls++);
  assert.equal(await PC.store.propose(() => {}), true); assert.equal(calls, 0, 'no-op');
  const P2 = fresh(); P2.store.commit((s) => { s.plans.G = PLAN(P2.sig.level(s, 'G')); }, { nav: true });
  assert.equal(P2.store.confirmHandler(), null); assert.equal(await P2.store.propose((s) => { s.ans.footprintPct = 30; }), true); assert.equal(P2.store.get().ans.footprintPct, 30);
  await assert.rejects(P2.store.propose(() => { throw new Error('bad mutator'); }), /bad mutator/);
  assert.equal(await P2.store.propose((s) => { s.ans.vegPct = 10; }), true, 'the queue survives a failed proposal');
});

test('PC.store.affected(candidate): the gate\'s computation, removed levels included, lowest level first', () => {
  const PC = fresh(); withPlans(PC);
  const cand = (f) => { const c = plain(PC.store.get()); f(c); return c; };
  assert.deepEqual(plain(PC.store.affected(cand(() => {}))), []);
  assert.deepEqual(plain(PC.store.affected(cand((s) => { s.ans.exterior = 'white'; s.ans.unit = 'ft'; }))), [], 'appearance');
  assert.deepEqual(plain(PC.store.affected(cand((s) => { s.ans.rooms[8].size = 'L'; }))), ['1']);
  assert.deepEqual(plain(PC.store.affected(cand((s) => { s.ans.floors = 1; PC.levels.prune(s); }))), ['G', '1'], 'first floor removed, ground loses its stair');
  assert.deepEqual(plain(PC.store.affected(cand((s) => { s.ans.floors = 1; s.ans.usableRoof = true; PC.levels.prune(s); }))), ['1'], 'stairs kept through the usable roof');
  PC.store.commit((s) => { s.plans['1'].sig = 'old'; }, { nav: true });
  assert.deepEqual(plain(PC.store.affected(cand((s) => { s.ans.floors = 1; PC.levels.prune(s); }))), ['G'], 'a stale plan is never named');
  // the gate names exactly this set
  const asked = []; PC.store.setConfirmHandler((q) => { asked.push(q); return false; });
  const change = (s) => { s.ans.footprintPct = 30; };
  const want = plain(PC.store.affected(cand(change)));
  return PC.store.propose(change).then((r) => { assert.equal(r, false); assert.deepEqual(plain(asked[0].levels), want); assert.deepEqual(want, ['G']); });
});

test('gate: once per visit also for a second, still valid level (F2-T1 test gap)', async () => {
  const PC = fresh(), asked = withPlans(PC);
  assert.equal(await PC.store.propose((s) => { s.ans.rooms[8].size = 'L'; }), true);
  assert.deepEqual(plain(asked.map((q) => q.levels)), [['1']], 'first change: only the first floor');
  const g = PC.store.get().plans.G.sig;
  assert.equal(g, PC.sig.level(PC.store.get(), 'G'), 'the ground floor plan is still valid');
  assert.equal(await PC.store.propose((s) => { s.ans.rooms[3].size = 'S'; }), true);
  assert.equal(asked.length, 1, 'a change to the other, still valid level in the same visit applies without asking');
  assert.equal(PC.store.get().ans.rooms[3].size, 'S');
  assert.notEqual(PC.sig.level(PC.store.get(), 'G'), g, 'and it did make the ground floor plan stale');
});

test('store clears overrides inside the causing change; the gate judges the combined change: one question', async () => {
  const PC = fresh();
  PC.store.commit((s) => { s.ans.setbacks = { front: 3, back: 5, side: 1 }; });
  await PC.store.propose((s) => { PC.site.toggleEdge(s, 3); });
  assert.deepEqual(plain(PC.store.get().ans.edgeOv), { 3: 'side' });
  const asked = withPlans(PC);
  // a vertex move that changes no size by itself (with the override in place the footprint stays 10.5 x 13.5) but
  // clears the override, and the clearing changes the size (back to 10.5 x 13): only the combined change asks
  const move = (s) => { s.plot.pts[2] = [20, 30.5]; };
  { const alone = plain(PC.store.get()); move(alone); assert.deepEqual(plain(PC.store.affected(alone)), [], 'the move alone resets nothing'); }
  const cand = plain(PC.store.get()); move(cand); PC.site.clearOvIfOutlineChanged(PC.store.get(), cand);
  const want = plain(PC.store.affected(cand));
  assert.equal(await PC.store.propose(move), true);
  assert.equal(asked.length, 1, 'one question for the edit and the clearing together');
  assert.ok(want.length > 0, 'the combined change resets the valid plans');
  assert.deepEqual(plain(asked[0].levels), want);
  assert.deepEqual(plain(PC.store.get().ans.edgeOv), {}, 'cleared in the same commit');
  // commit runs the normaliser too; an unrelated commit keeps overrides
  await PC.store.propose((s) => { PC.site.toggleEdge(s, 3); });
  PC.store.commit((s) => { s.ans.exterior = 'white'; });
  assert.deepEqual(plain(PC.store.get().ans.edgeOv), { 3: 'side' });
  PC.store.commit((s) => { s.ans.streetEdge = 1; });
  assert.deepEqual(plain(PC.store.get().ans.edgeOv), {}, 'commit of a Q6 change clears them');
  // replace does not normalise (the draft parser and defaults guarantee the invariant)
  const withOv = plain(PC.store.get()); withOv.ans.streetEdge = 0; withOv.ans.edgeOv = { 3: 'side' };
  PC.store.replace(withOv); assert.deepEqual(plain(PC.store.get().ans.edgeOv), { 3: 'side' });
});

// F3-T2 review: the gate dialog names only what each level holds (the round-6 rule of Clear / remove floor).
test('gate text: edits only, approval only, mixed levels, a removed level', async () => {
  const ask = async (setup, change) => {
    const PC = fresh(), asked = withPlans(PC, false);
    PC.store.commit((s) => { for (const [id, ed, ap] of setup) { s.plans[id].edited = ed; s.plans[id].approved = ap; } }, { nav: true });
    await PC.store.propose(change); return asked[0] && asked[0].text;
  };
  const q3 = (s) => { s.ans.footprintPct = 40; };
  assert.equal(await ask([['G', true, false], ['1', false, false]], q3), 'The floor plan of the Ground floor will be regenerated, with its manual edits.');
  assert.equal(await ask([['G', false, true], ['1', false, false]], q3), 'The floor plan of the Ground floor will be regenerated, with its approval.');
  assert.equal(await ask([['G', true, false], ['1', false, true]], q3), 'The floor plans of the Ground floor and the First floor will be regenerated, with their manual edits and approvals.');
  assert.equal(await ask([['G', false, true], ['1', false, true]], q3), 'The floor plans of the Ground floor and the First floor will be regenerated, with their approvals.');
  assert.equal(await ask([['G', false, false], ['1', false, true]], (s) => { s.ans.rooms = s.ans.rooms.filter((r) => r.level !== '1'); s.ans.pairs = s.ans.pairs.filter((p) => !['r8', 'r13'].includes(p[0])); s.ans.floors = 1; }),
    'The floor plan of the First floor will be lost, with its approval.');
});
