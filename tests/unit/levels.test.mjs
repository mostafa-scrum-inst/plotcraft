import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
const PC = loadCore(), L = PC.levels;
const st = (f) => { const s = PC.store.defaults(); f(s.ans, s); return s; };

test('ids for every Q7 combination; the roof is never a plan level', () => {
  for (const floors of [1, 2, 3]) for (const basement of [false, true]) for (const usableRoof of [false, true]) {
    const s = st((a) => { a.floors = floors; a.basement = basement; a.usableRoof = usableRoof; });
    assert.deepEqual(plain(L.ids(s)), [...(basement ? ['B'] : []), ...['G', '1', '2'].slice(0, floors)]);
  }
  assert.deepEqual(['B', 'G', '1', '2'].map(L.name), ['Basement', 'Ground floor', 'First floor', 'Second floor']);
  assert.equal(PC.stages.levelIds, undefined, 'the interim list is gone');
});

test('stairs exist with 2+ levels counting basement and usable roof; lift only with stairs', () => {
  const one = (extra) => st((a) => { a.floors = 1; a.lift = true; Object.assign(a, extra); });
  assert.equal(L.stairsExist(one({})), false); assert.equal(L.liftExists(one({})), false, 'no lift without stairs');
  assert.equal(L.stairsExist(one({ usableRoof: true })), true);
  assert.equal(L.stairsExist(one({ basement: true })), true); assert.equal(L.liftExists(one({ basement: true })), true);
  assert.equal(L.stairsExist(PC.store.defaults()), true); assert.equal(L.liftExists(PC.store.defaults()), false);
});

test('room areas and needed area', () => {
  assert.equal(L.roomArea({ type: 'living', size: 'L', area: null }), 42);
  assert.equal(L.roomArea({ type: 'living', size: null, area: 33.5 }), 33.5);
  const d = PC.store.defaults();
  assert.equal(L.needed(d, 'G'), 30 + 14 + 6 + 10); assert.equal(L.needed(d, '1'), 16 + 16 + 6 + 10);
  const lift = st((a) => { a.lift = true; }); assert.equal(L.needed(lift, 'G'), 63);
  const flat = st((a) => { a.floors = 1; a.rooms = a.rooms.filter((r) => r.level === 'G'); }); assert.equal(L.needed(flat, 'G'), 50, 'one level: no stair allowance');
  const s = PC.sample.state(); assert.equal(L.needed(s, 'G'), 120); assert.equal(L.needed(s, '1'), 120);
  assert.equal(L.needed(d, '2'), 10, 'a level without rooms needs only the stair');
});

test('room names: single, numbered per level and type, master outside the numbering', () => {
  assert.deepEqual(plain(L.roomNames(PC.store.defaults())), { r1: 'Living', r2: 'Kitchen', r3: 'Bathroom', r4: 'Bedroom 1', r5: 'Bedroom 2', r6: 'Bathroom' });
  const n = plain(L.roomNames(PC.sample.state()));
  assert.deepEqual([n.r8, n.r9, n.r10, n.r11, n.r12, n.r13, n.r14], ['Master bedroom', 'Bedroom 1', 'Bedroom 2', 'Living', 'Office', 'Bathroom 1', 'Bathroom 2']);
  assert.deepEqual([n.r1, n.r5, n.r6], ['Living', "Maid's room", 'Bathroom']);
  const one = st((a) => { a.rooms[3].master = true; });
  assert.deepEqual([L.roomNames(one).r4, L.roomNames(one).r5], ['Master bedroom', 'Bedroom'], 'one other bedroom: no number');
});

test('prune: nothing may point at a level that no longer exists', () => {
  const s = PC.sample.state(); s.plans = { G: { sig: 'x' }, 1: { sig: 'y' } };
  s.ans.floors = 1;
  const removed = L.prune(s);
  assert.equal(removed.length, 7); assert.ok(s.ans.rooms.every((r) => r.level === 'G')); assert.equal(s.ans.rooms.length, 7);
  assert.deepEqual(plain(s.ans.pairs), [['r3', 'r4']], 'pairs of removed rooms go too'); assert.deepEqual(Object.keys(s.plans), ['G']);
  delete s.plans.G; s.plans = {}; assert.equal(PC.draft.validState(s), true);
  const t = PC.sample.state(); assert.equal(L.prune(t).length, 0); assert.deepEqual(plain(t), plain(PC.sample.state()), 'no-op when every level exists');
});
