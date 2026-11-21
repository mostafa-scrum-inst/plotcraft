import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

const PC = loadCore();
const wrap = (state, v = PC.DRAFT_V) => JSON.stringify({ v, savedAt: 1700000000000, state });
const sample = () => plain(PC.sample.state());
// One mutation of the sample must make parse() return null.
const rejects = (name, mutate) => test('rejected: ' + name, () => { const s = sample(); mutate(s); assert.equal(PC.draft.parse(wrap(s)), null); });
const accepts = (name, mutate) => test('accepted: ' + name, () => { const s = sample(); mutate(s); assert.notEqual(PC.draft.parse(wrap(s)), null); });

test('key is derived from DRAFT_V; KEYS lists the current key first, then the v1 key', () => {
  assert.equal(PC.DRAFT_V, 2); assert.equal(PC.draft.KEY, 'plotcraft.draft.v2');
  assert.deepEqual(plain(PC.draft.KEYS), ['plotcraft.draft.v2', 'plotcraft.draft.v1']);
});

test('round trip: defaults and sample', () => {
  for (const s of [PC.store.defaults(), PC.sample.state()]) {
    const d = PC.draft.parse(PC.draft.serialize(s, 123));
    assert.equal(d.savedAt, 123); assert.deepEqual(plain(d.state), plain(s));
  }
});

test('round trip with plans, exact areas, basement, ft and a north angle', () => {
  const s = sample();
  s.stage = 3; s.sampleClean = false; s.ans.unit = 'ft'; s.ans.north = 345; s.ans.basement = true;
  s.ans.rooms.push({ id: 'r15', type: 'storage', level: 'B', size: null, area: 7.25, master: false }); s.ans.nextRoomId = 16;
  s.plans = { G: { sig: 'x', rooms: [{ id: 'r1', x: 0, y: 0, w: 6, h: 7 }], unmet: [['r3', 'r4']], edited: true, approved: true, error: null },
    B: { sig: 'invalid', rooms: [], unmet: [], edited: false, approved: false, error: 'no-layout' } };
  assert.deepEqual(plain(PC.draft.parse(wrap(s)).state), s);
});

test('not a draft at all', () => {
  const good = wrap(sample());
  for (const t of [null, undefined, 42, {}, '', 'garbage', '{', good.slice(0, good.length - 7), '[]', 'null', '"text"', '{"v":1}'])
    assert.equal(PC.draft.parse(t), null, String(t).slice(0, 20));
  assert.equal(PC.draft.parse(wrap(sample(), 3)), null, 'wrapper v 3');
  assert.equal(PC.draft.parse(wrap(sample(), 0)), null, 'wrapper v 0');
  assert.equal(PC.draft.parse(JSON.stringify({ savedAt: 1, state: sample() })), null, 'v missing');
  assert.equal(PC.draft.parse(JSON.stringify({ v: 2, savedAt: 'yesterday', state: sample() })), null, 'savedAt type');
  assert.equal(PC.draft.parse(JSON.stringify({ v: 2, savedAt: 1, state: sample(), extra: 1 })), null, 'unknown wrapper key');
  assert.equal(PC.draft.parse(wrap(sample(), 1)), null, 'wrapper v 1 around a v2 state');
});

rejects('state v 3', (s) => { s.v = 3; });
rejects('state v 1 inside a v2 wrapper', (s) => { s.v = 1; });

// Draft v2 (F2-T3, A-4): edge overrides and the v1 migration.
const v1 = (f) => { const s = sample(); s.v = 1; delete s.ans.edgeOv; if (f) f(s); return JSON.stringify({ v: 1, savedAt: 5, state: s }); };
test('a v1 draft is migrated: no overrides, version 2, otherwise identical', () => {
  const d = PC.draft.parse(v1());
  assert.ok(d); assert.equal(d.savedAt, 5); assert.equal(d.state.v, 2); assert.deepEqual(plain(d.state.ans.edgeOv), {});
  assert.deepEqual(plain(d.state), sample());
  assert.equal(PC.draft.parse(v1((s) => { s.ans.edgeOv = {}; })), null, 'a v1 state that already has edgeOv is not v1');
  assert.equal(PC.draft.parse(v1((s) => { s.stage = 9; })), null, 'migrated, then validated strictly');
});
test('v2 round trip with overrides', () => {
  const s = sample(); s.ans.setbacks = { front: 3, back: 5, side: 1 }; s.ans.edgeOv = { 3: 'side', 1: 'back' }; s.sampleClean = false;
  assert.deepEqual(plain(PC.draft.parse(wrap(s)).state), s);
});
test('an override equal to the automatic class is dropped, not rejected', () => {
  const s = sample(); s.ans.edgeOv = { 1: 'side', 3: 'side' };           // edge 1 is automatically a side, edge 3 a back
  assert.deepEqual(plain(PC.draft.parse(wrap(s)).state.ans.edgeOv), { 3: 'side' });
});
rejects('override on the street edge', (s) => { s.ans.edgeOv = { 0: 'back' }; });
rejects('override on the default street edge (null)', (s) => { s.ans.streetEdge = null; s.ans.edgeOv = { [PC.plot.defaultStreetEdge(s.plot.pts)]: 'side' }; });
rejects('override index out of range', (s) => { s.ans.edgeOv = { 5: 'side' }; });
rejects('override index not a whole number', (s) => { s.ans.edgeOv = { '1.5': 'side' }; });
rejects('override with an unknown value', (s) => { s.ans.edgeOv = { 1: 'front' }; });
rejects('edgeOv not an object', (s) => { s.ans.edgeOv = []; });
rejects('edgeOv missing', (s) => { delete s.ans.edgeOv; });
rejects('override on an open plot', (s) => { s.plot.closed = false; s.ans.streetEdge = null; s.ans.edgeOv = { 1: 'back' }; });
rejects('stage 0', (s) => { s.stage = 0; });
rejects('stage 6', (s) => { s.stage = 6; });
rejects('stage 2.5', (s) => { s.stage = 2.5; });
rejects('stage as text', (s) => { s.stage = '2'; });
rejects('sampleClean not boolean', (s) => { s.sampleClean = 1; });
rejects('unknown top-level key', (s) => { s.extra = true; });
rejects('missing plans', (s) => { delete s.plans; });
rejects('unknown ans key', (s) => { s.ans.colour = 'red'; });
rejects('missing ans key', (s) => { delete s.ans.lift; });
rejects('13 points', (s) => { s.plot.pts = Array.from({ length: 13 }, (_, i) => [i, i * i % 7]); });
rejects('closed with 2 points', (s) => { s.plot.pts = [[0, 0], [5, 5]]; s.ans.streetEdge = null; });
rejects('point with 3 numbers', (s) => { s.plot.pts[1] = [20, 0, 0]; });
rejects('point not finite', (s) => { s.plot.pts[1] = [20, null]; });
rejects('bow-tie closed plot', (s) => { s.plot.pts = [[0, 0], [10, 10], [10, 0], [0, 10]]; s.ans.streetEdge = null; });
rejects('clockwise closed plot', (s) => { s.plot.pts.reverse(); });
rejects('open outline that crosses itself', (s) => { s.plot = { pts: [[0, 0], [10, 0], [10, 10], [5, -5]], closed: false }; s.ans.streetEdge = null; });
rejects('point right of the drawing area', (s) => { s.plot.pts[1] = [100.5, 0]; });
rejects('point below the drawing area', (s) => { s.plot.pts[0] = [0, -1]; });
rejects('repeated corner', (s) => { s.plot.pts[3] = [20, 30]; });
accepts('plot touching the area bounds', (s) => { s.plot.pts = [[0, 0], [100, 0], [100, 100], [0, 100]]; });
rejects('unknown plot key', (s) => { s.plot.holes = []; });
rejects('unit', (s) => { s.ans.unit = 'yd'; });
rejects('setback 21', (s) => { s.ans.setbacks.front = 21; });
rejects('setback negative', (s) => { s.ans.setbacks.side = -1; });
rejects('setback as text', (s) => { s.ans.setbacks.back = '2'; });
rejects('footprint 9', (s) => { s.ans.footprintPct = 9; });
rejects('footprint 81', (s) => { s.ans.footprintPct = 81; });
rejects('vegetation 81', (s) => { s.ans.vegPct = 81; });
rejects('north 20 (not a multiple of 15)', (s) => { s.ans.north = 20; });
rejects('north 360', (s) => { s.ans.north = 360; });
rejects('street edge 5 of 5', (s) => { s.ans.streetEdge = 5; });
rejects('street edge on an open plot', (s) => { s.plot.closed = false; });
rejects('floors 4', (s) => { s.ans.floors = 4; });
rejects('floors 0', (s) => { s.ans.floors = 0; });
rejects('basement as text', (s) => { s.ans.basement = 'no'; });
rejects('ceiling 2.3', (s) => { s.ans.ceilingH = 2.3; });
rejects('ceiling 4.6', (s) => { s.ans.ceilingH = 4.6; });
rejects('roof type', (s) => { s.ans.roofType = 'dome'; });
rejects('exterior', (s) => { s.ans.exterior = 'pink'; });
rejects('stair position', (s) => { s.ans.stairPos = 'middle'; });
rejects('cars 5', (s) => { s.ans.parking.cars = 5; });
rejects('cars 1.5', (s) => { s.ans.parking.cars = 1.5; });
rejects('pool size', (s) => { s.ans.pool.size = 'XL'; });
rejects('gate', (s) => { s.ans.extras.gate = 'top'; });
rejects('interior style', (s) => { s.ans.interior.style = 'baroque'; });
rejects('density', (s) => { s.ans.interior.density = 'empty'; });
rejects('duplicate room id', (s) => { s.ans.rooms[1].id = 'r1'; });
rejects('room id format', (s) => { s.ans.rooms[0].id = 'room1'; });
rejects('room id not below nextRoomId', (s) => { s.ans.nextRoomId = 14; });
rejects('room type', (s) => { s.ans.rooms[0].type = 'garage'; });
rejects('room on a level that does not exist', (s) => { s.ans.rooms[0].level = '2'; });
rejects('room on the basement without a basement', (s) => { s.ans.rooms[0].level = 'B'; });
rejects('room with size and area', (s) => { s.ans.rooms[0].area = 20; });
rejects('room with neither size nor area', (s) => { s.ans.rooms[0].size = null; });
rejects('exact area 3', (s) => { s.ans.rooms[0].size = null; s.ans.rooms[0].area = 3; });
rejects('exact area 81', (s) => { s.ans.rooms[0].size = null; s.ans.rooms[0].area = 81; });
rejects('master on a kitchen', (s) => { s.ans.rooms[3].master = true; });
rejects('unknown room key', (s) => { s.ans.rooms[0].name = 'Lounge'; });
rejects('9 rooms on one level', (s) => { s.ans.rooms.push({ id: 'r15', type: 'storage', level: 'G', size: 'S', area: null, master: false }, { id: 'r16', type: 'storage', level: 'G', size: 'S', area: null, master: false }); s.ans.nextRoomId = 17; });
rejects('pair across levels', (s) => { s.ans.pairs.push(['r1', 'r8']); });
rejects('pair with an unknown room', (s) => { s.ans.pairs.push(['r1', 'r99']); });
rejects('pair of a room with itself', (s) => { s.ans.pairs.push(['r1', 'r1']); });
rejects('pair not in id order', (s) => { s.ans.pairs[1] = ['r13', 'r8']; });
rejects('duplicate pair', (s) => { s.ans.pairs.push(['r3', 'r4']); });
rejects('7 pairs on one level', (s) => { s.ans.pairs = [['r1', 'r2'], ['r1', 'r3'], ['r1', 'r4'], ['r1', 'r5'], ['r1', 'r6'], ['r1', 'r7'], ['r2', 'r3']]; });
rejects('plan for a level that does not exist', (s) => { s.plans = { 2: { sig: '', rooms: [], unmet: [], edited: false, approved: false, error: null } }; });
// A stale plan may list rooms deleted or moved since it was generated (A-7: the signature decides validity);
// a fresh plan (current signature) may not, and ids must stay well formed.
const plan = (s, sig, rooms, unmet = []) => { s.plans = { G: { sig: sig === 'fresh' ? PC.sig.level(s, 'G') : sig, rooms, unmet, edited: false, approved: false, error: null } }; };
const box = (id) => ({ id, x: 0, y: 0, w: 4, h: 4 });
rejects('fresh plan room from another level', (s) => plan(s, 'fresh', [box('r1'), box('r8')]));
rejects('fresh plan room that does not exist', (s) => plan(s, 'fresh', [box('r1'), box('r77')]));
rejects('fresh plan unmet pair naming another level', (s) => plan(s, 'fresh', [box('r1')], [['r1', 'r8']]));
accepts('fresh plan with rooms of its level only', (s) => plan(s, 'fresh', [box('r1'), box('r2')], [['r1', 'r2']]));
accepts('stale plan room from another level', (s) => plan(s, '', [box('r8')], [['r3', 'r8']]));
accepts('stale plan room that no longer exists', (s) => plan(s, '', [box('r77')], [['r77', 'r1']]));
rejects('stale plan room id malformed', (s) => plan(s, '', [box('room1')]));
rejects('stale plan room id not a string', (s) => plan(s, '', [box(7)]));
rejects('stale plan unmet id malformed', (s) => plan(s, '', [box('r1')], [['r1', 'x2']]));
rejects('stale plan unmet pair of one room', (s) => plan(s, '', [box('r1')], [['r1', 'r1']]));
rejects('stale plan unmet entry not a pair', (s) => plan(s, '', [box('r1')], [['r1']]));
rejects('plan room with zero width', (s) => { s.plans = { G: { sig: '', rooms: [{ id: 'r1', x: 0, y: 0, w: 0, h: 4 }], unmet: [], edited: false, approved: false, error: null } }; });
rejects('plan room listed twice', (s) => { s.plans = { G: { sig: '', rooms: [{ id: 'r1', x: 0, y: 0, w: 4, h: 4 }, { id: 'r1', x: 4, y: 0, w: 4, h: 4 }], unmet: [], edited: false, approved: false, error: null } }; });
rejects('plan error value', (s) => { s.plans = { G: { sig: '', rooms: [], unmet: [], edited: false, approved: false, error: 'oops' } }; });
rejects('plan approved as text', (s) => { s.plans = { G: { sig: '', rooms: [], unmet: [], edited: false, approved: 'yes', error: null } }; });
rejects('plan without sig', (s) => { s.plans = { G: { rooms: [], unmet: [], edited: false, approved: false, error: null } }; });
rejects('plans as an array', (s) => { s.plans = []; });

accepts('range edges', (s) => { s.ans.setbacks = { front: 0, back: 20, side: 20 }; s.ans.footprintPct = 80; s.ans.vegPct = 0; s.ans.ceilingH = 4.5; s.ans.parking.cars = 0; s.ans.floors = 1; s.ans.rooms = s.ans.rooms.filter((r) => r.level === 'G'); s.ans.pairs = [['r3', 'r4']]; });
accepts('product conflicts are legal drafts (a floor without rooms)', (s) => { s.ans.rooms = s.ans.rooms.filter((r) => r.level === 'G'); s.ans.pairs = [['r3', 'r4']]; });
accepts('street edge null (drafts saved before the plot stage stores it)', (s) => { s.ans.streetEdge = null; });
accepts('open plot in progress', (s) => { s.plot = { pts: [[0, 0], [4, 0]], closed: false }; s.ans.streetEdge = null; });
accepts('values converted from feet', (s) => { s.ans.ceilingH = 2.7432; s.ans.setbacks.front = 3.048; });

test('isEmpty: no point placed', () => {
  assert.equal(PC.draft.isEmpty(PC.store.defaults()), true);
  assert.equal(PC.draft.isEmpty(PC.sample.state()), false);
  const s = PC.store.defaults(); s.plot.pts.push([1, 1]); assert.equal(PC.draft.isEmpty(s), false);
});

// CTO F3 review, finding 1: room-list changes leave a stale plan listing the old room until the next stage-3 visit;
// the autosaved draft must still restore exactly (it was rejected and Resume silently lost the project).
const synced = (pre = () => {}) => {
  const s = sample(); pre(s); PC.plans.sync(s); s.stage = 2; s.sampleClean = false;
  for (const id of Object.keys(s.plans)) { s.plans[id].edited = true; s.plans[id].approved = true; }
  return s;
};
const roundTrip = (name, change, pre) => test('round trip after ' + name, () => {
  const s = synced(pre); change(s);
  const d = PC.draft.parse(PC.draft.serialize(s, 99));
  assert.notEqual(d, null, 'draft restorable');
  assert.deepEqual(plain(d.state), plain(s));
});
roundTrip('deleting a room', (s) => { assert.equal(PC.levels.removeRoom(s, 'r5').ok, true); assert.ok(s.plans.G.rooms.some((r) => r.id === 'r5')); });
roundTrip('deleting a paired room (stale unmet / pairs)', (s) => {
  s.plans.G.unmet = [['r3', 'r4']]; assert.equal(PC.levels.removeRoom(s, 'r4').ok, true);
});
roundTrip('moving a room to another level', (s) => {
  PC.levels.removeRoom(s, 'r7');
  assert.equal(PC.levels.updateRoom(s, 'r13', { level: 'G' }).ok, true);
  assert.ok(s.plans['1'].rooms.some((r) => r.id === 'r13'));
});
// Removing a level: its own plan is pruned, the plans left list only their own rooms, so the level change by
// itself never hit the bug; these guard it, alone (rooms removed before the sync) and after a room change.
roundTrip('removing a level, rooms moved', (s) => {
  assert.equal(PC.levels.removeLevels(s, (a) => { a.floors = 1; }, 'move').ok, true);
  assert.deepEqual(Object.keys(s.plans), ['G']); assert.ok(s.ans.rooms.some((r) => r.id === 'r8' && r.level === 'G'));
}, (s) => { for (const id of ['r5', 'r6', 'r7', 'r10', 'r12', 'r14']) PC.levels.removeRoom(s, id); });   // G 4 + 4 moved = 8
roundTrip('deleting rooms, then removing a level with its rooms moved', (s) => {
  for (const id of ['r5', 'r6', 'r7', 'r10', 'r12', 'r14']) PC.levels.removeRoom(s, id);
  assert.equal(PC.levels.removeLevels(s, (a) => { a.floors = 1; }, 'move').ok, true);
  assert.ok(s.plans.G.rooms.some((r) => r.id === 'r5'), 'G plan stale, lists a deleted room');
});
roundTrip('removing a level, rooms deleted', (s) => {
  s.ans.basement = true; s.ans.rooms.push({ id: 'r15', type: 'storage', level: 'B', size: 'S', area: null, master: false });
  s.ans.nextRoomId = 16; PC.plans.sync(s);
  assert.ok(s.plans.B.rooms.some((r) => r.id === 'r15'));
  assert.equal(PC.levels.removeLevels(s, (a) => { a.basement = false; }, 'delete').ok, true);
  assert.deepEqual(Object.keys(s.plans).sort(), ['1', 'G']);
});
test('moving a room away and back restores the old signature, plan and edits', () => {
  const s = synced(), before = plain(s.plans['1']);
  PC.levels.removeRoom(s, 'r7'); assert.equal(PC.levels.updateRoom(s, 'r12', { level: 'G' }).ok, true);
  const t = plain(PC.draft.parse(PC.draft.serialize(s, 1)).state);
  assert.equal(PC.levels.updateRoom(t, 'r12', { level: '1' }).ok, true); PC.plans.sync(t);
  assert.deepEqual(t.plans['1'], before);
});
