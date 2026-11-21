// CD-5 hall access (PM round 10), PC.layout.access / PC.plans.noAccess: >= 0.8 m of a non-exterior side on hall or on
// the stair / lift; otherwise reached through a wall-sharing reached neighbour that is its pair partner or a listed
// host (Bathroom <- Bedroom / Maid's room; Storage / Laundry <- any room but Bathroom / Storage / Laundry); chains
// count. The sample stays warning-free (6.2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

const PC = loadCore(), Y = PC.layout, P = PC.plans;
const acc = (W, D, rooms, core, pairs = [], types = {}) => plain(Y.access(W, D, rooms, core || { stair: null, lift: null }, pairs, types));
const R = (id, x, y, w, h) => ({ id, x, y, w, h });

test('hall contact: 0.8 m opens, 0.79 m does not; exterior sides never count', () => {
  // 10 x 10 floor. b (4 x 4) in the front-left corner: left and front sides are exterior.
  // a covers b's right side fully; c covers b's back side except the last d metres, which face hall.
  for (const [d, open] of [[0.8, true], [0.79, false], [0, false]]) {
    const rooms = [R('b', 0, 0, 4, 4), R('a', 4, 0, 4, 4), R('c', 0, 4, 4 - d, 4)];
    assert.equal(acc(10, 10, rooms).includes('b'), !open, `${d} m of hall`);
  }
  // a floor fully covered by rooms: every outline is exterior or another room, all boxed in; a 1 m hall strip at
  // the back opens all three
  assert.deepEqual(acc(6, 4, [R('x', 0, 0, 2, 4), R('y', 2, 0, 2, 4), R('z', 4, 0, 2, 4)]), ['x', 'y', 'z']);
  assert.deepEqual(acc(6, 5, [R('x', 0, 0, 2, 4), R('y', 2, 0, 2, 4), R('z', 4, 0, 2, 4)]), []);
});

test('stair / lift contact >= 0.8 m gives access; covered sides do not face hall', () => {
  const core = { stair: { x: 4, y: 0, w: 2.5, h: 4 }, lift: null };
  // b in a 4 x 4 corner of a 6.5 x 4 floor: left / front / back exterior, right side on the stair
  assert.deepEqual(acc(6.5, 4, [R('b', 0, 0, 4, 4)], core), []);
  const short = { stair: { x: 4, y: 0, w: 2.5, h: 0.79 }, lift: null }, other = R('o', 4, 0.79, 2.5, 3.21);
  assert.deepEqual(acc(6.5, 4, [R('b', 0, 0, 4, 4), other], short).includes('b'), true, '0.79 m of stair only');
});

test('reached through: pair partner, en-suite (Bathroom <- Bedroom / Maid), service (Storage / Laundry <- living rooms); chains', () => {
  // corridor-free strip: h has hall at the right (x 9..10), so h has access; a..h chain to the left
  const rooms = [R('s', 0, 0, 3, 4), R('m', 3, 0, 3, 4), R('h', 6, 0, 3, 4)];
  const T = (a, b, c) => ({ s: a, m: b, h: c });
  assert.deepEqual(acc(10, 4, rooms, null, [], T('bathroom', 'bedroom', 'living')), ['s', 'm'], 'a bedroom is no host of a bedroom');
  assert.deepEqual(acc(10, 4, rooms, null, [['m', 'h']], T('bathroom', 'bedroom', 'living')), [], 'paired bedroom reached, its en-suite through it (chain)');
  assert.deepEqual(acc(10, 4, rooms, null, [], T('bathroom', 'maid', 'living')), ['s', 'm'], "a maid's room is not reached through a living room");
  assert.deepEqual(acc(10, 4, rooms, null, [], T('storage', 'laundry', 'kitchen')), ['s'], 'laundry through the kitchen; storage not through laundry');
  assert.deepEqual(acc(10, 4, rooms, null, [], T('laundry', 'storage', 'bathroom')), ['s', 'm'], 'never through a bathroom');
  assert.deepEqual(acc(10, 4, rooms, null, [['s', 'm'], ['m', 'h']], T('office', 'office', 'office')), [], 'pairs chain any types');
  assert.deepEqual(plain(PC.C.HALL_ACCESS.hosts.bathroom), ['bedroom', 'maid']);
});

test('the sample (both floors) and the defaults have no warning; noAccess follows edits and is [] for a stale plan', () => {
  const s = plain(PC.sample.state()); P.sync(s);
  for (const id of PC.levels.ids(s)) assert.deepEqual(plain(P.noAccess(s, id)), [], `sample ${id}`);
  // the sample's boxed-in Bathroom (r6) is reached through the Maid's room; as an Office it would be named
  const t = plain(s), r6 = t.plans.G.rooms.find((r) => r.id === 'r6');
  assert.ok(r6, 'sample bathroom');
  t.ans.rooms.find((r) => r.id === 'r6').type = 'office';         // an office is not reached through the maid's room
  t.plans.G.sig = PC.sig.level(t, 'G');                           // type is not a signature input (A-7), so fresh
  assert.deepEqual(plain(P.noAccess(t, 'G')), ['r6'], 'same plan, Office instead of Bathroom: named');
  const st = plain(s); st.ans.footprintPct = 30;                  // a signature input: the plan goes stale
  assert.deepEqual(plain(P.noAccess(st, 'G')), [], 'stale plan: nothing');
});
