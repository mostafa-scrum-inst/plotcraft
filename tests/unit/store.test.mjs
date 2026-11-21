import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

const fresh = () => { const PC = loadCore(); PC.store.init(); return PC; };

test('default state equals section 4.1', () => {
  const PC = fresh(), s = plain(PC.store.get()), R = (id, type, level) => ({ id, type, level, size: 'M', area: null, master: false });
  assert.deepEqual(s, {
    v: 2, stage: 1, sampleClean: false, plot: { pts: [], closed: false },
    ans: {
      unit: 'm', setbacks: { front: 3, back: 2, side: 2 }, footprintPct: 30, vegPct: 20, north: null, streetEdge: null, edgeOv: {},
      floors: 2, basement: false, usableRoof: false, ceilingH: 3, roofType: 'flat', exterior: 'sand',
      rooms: [R('r1', 'living', 'G'), R('r2', 'kitchen', 'G'), R('r3', 'bathroom', 'G'), R('r4', 'bedroom', '1'), R('r5', 'bedroom', '1'), R('r6', 'bathroom', '1')],
      nextRoomId: 7, pairs: [], stairPos: 'centre', lift: false,
      parking: { cars: 1, covered: false }, pool: { on: false, size: 'S' },
      extras: { wall: true, gate: 'centre', seating: false }, interior: { style: 'modern', density: 'full' }
    },
    plans: {}
  });
  // Default ground floor: Living M 30 + Kitchen M 14 + Bathroom M 6 = 50 m2 of rooms (60 with the stair allowance).
  const g = s.ans.rooms.filter((r) => r.level === 'G').reduce((a, r) => a + PC.C.ROOM_SIZE[r.type][r.size], 0);
  assert.equal(g, 50);
});

test('commit clones: the previous state object is untouched and frozen', () => {
  const PC = fresh(), before = PC.store.get();
  const after = PC.store.commit((s) => { s.ans.footprintPct = 40; s.plot.pts.push([1, 2]); });
  assert.notEqual(after, before);
  assert.equal(before.ans.footprintPct, 30); assert.equal(before.plot.pts.length, 0);
  assert.equal(PC.store.get().ans.footprintPct, 40);
  assert.ok(Object.isFrozen(after) && Object.isFrozen(after.ans.rooms[0]) && Object.isFrozen(after.plot.pts));
  assert.throws(() => { 'use strict'; after.ans.footprintPct = 1; });
});

test('a commit that changes nothing is ignored', () => {
  const PC = fresh(); let calls = 0;
  PC.store.replace(PC.sample.state());
  PC.store.subscribe(() => calls++);
  const a = PC.store.get();
  assert.equal(PC.store.commit((s) => { s.ans.unit = 'm'; }), a);
  assert.equal(calls, 0); assert.equal(PC.store.get().sampleClean, true);
});

test('sampleClean: cleared by a real commit, kept by navigation', () => {
  const PC = fresh();
  PC.store.replace(PC.sample.state());
  assert.equal(PC.store.get().sampleClean, true);
  PC.stages.MAX_BUILT = 5;
  assert.equal(PC.store.go(2), true);
  assert.equal(PC.store.get().sampleClean, true);
  PC.store.commit((s) => { s.ans.unit = 'ft'; });
  assert.equal(PC.store.get().sampleClean, false);
  PC.store.commit((s) => { s.ans.unit = 'm'; });
  assert.equal(PC.store.get().sampleClean, false, 'never comes back');
});

test('subscribers: get state, previous state and meta; unsubscribe; one failing listener does not stop the others', () => {
  const PC = fresh(), seen = [];
  const off = PC.store.subscribe((s, prev, meta) => seen.push([s.ans.vegPct, prev.ans.vegPct, meta.nav, meta.replace]));
  PC.store.commit((s) => { s.ans.vegPct = 30; });
  PC.store.replace(PC.store.defaults());
  off();
  PC.store.commit((s) => { s.ans.vegPct = 40; });
  assert.deepEqual(seen, [[30, 20, false, false], [20, 30, false, true]]);
  let reached = false;
  PC.store.subscribe(() => { throw new Error('boom'); });
  PC.store.subscribe(() => { reached = true; });
  assert.throws(() => PC.store.commit((s) => { s.ans.vegPct = 50; }), /boom/);
  assert.ok(reached); assert.equal(PC.store.get().ans.vegPct, 50);
});

test('a throwing mutator leaves the state untouched', () => {
  const PC = fresh(), a = PC.store.get();
  assert.throws(() => PC.store.commit((s) => { s.ans.floors = 3; throw new Error('x'); }), /x/);
  assert.equal(PC.store.get(), a);
});

test('propose is a pass-through for now and resolves true', async () => {
  const PC = fresh();
  assert.equal(await PC.store.propose((s) => { s.ans.floors = 3; }), true);
  assert.equal(PC.store.get().ans.floors, 3);
  const h = () => true; PC.store.setConfirmHandler(h); assert.equal(PC.store.confirmHandler(), h);
});

test('go: refuses a locked stage; back and forward changes nothing but the stage', () => {
  const PC = fresh();
  assert.equal(PC.store.go(2), false); assert.equal(PC.store.get().stage, 1);
  PC.store.replace(PC.sample.state());
  const strip = (s) => { const c = plain(s); delete c.stage; delete c.plans; return c; }, before = strip(PC.store.get());
  assert.equal(PC.store.go(2), true); assert.equal(PC.store.get().stage, 2);
  assert.equal(PC.store.go(3), true, 'stage 3 since F3-T1 (and its plans are generated)');
  assert.equal(PC.store.go(4), false, 'beyond MAX_BUILT / not approved');
  assert.equal(PC.store.go(1), true);
  assert.deepEqual(strip(PC.store.get()), before);
  assert.equal(PC.store.go(1), true, 'same stage is a no-op');
});

test('cmpId orders ids numerically', () => {
  const PC = fresh();
  assert.deepEqual(['r13', 'r8', 'r2', 'r100'].sort(PC.store.cmpId), ['r2', 'r8', 'r13', 'r100']);
});

test('keepSample: a normal commit that only leaves the sample flag alone (unit change, F1-S5)', () => {
  const PC = fresh(); PC.store.replace(PC.sample.state());
  const seen = [];
  PC.store.subscribe((s, prev, meta) => seen.push([meta.nav, meta.replace, meta.cancelled]));
  PC.store.commit((s) => { s.ans.unit = 'ft'; }, { keepSample: true });
  assert.equal(PC.store.get().ans.unit, 'ft'); assert.equal(PC.store.get().sampleClean, true);
  assert.deepEqual(seen, [[false, false, false]], 'subscribers are told like for any commit (autosave included)');
  PC.store.commit((s) => { s.ans.unit = 'm'; }, { keepSample: true }); assert.equal(PC.store.get().sampleClean, true);
  PC.store.commit((s) => { s.ans.vegPct = 30; }); assert.equal(PC.store.get().sampleClean, false, 'any other change ends it');
  PC.store.commit((s) => { s.ans.unit = 'ft'; }, { keepSample: true }); assert.equal(PC.store.get().sampleClean, false, 'and it never comes back');
});
