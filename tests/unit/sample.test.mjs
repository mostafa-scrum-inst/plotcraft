import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

test('sample reproduces section 6.2', () => {
  const PC = loadCore(), s = plain(PC.sample.state()), a = s.ans, C = PC.C;
  // plot
  assert.deepEqual(s.plot, { pts: [[0, 0], [20, 0], [20, 30], [8, 30], [0, 26]], closed: true });
  assert.equal(PC.geom.area(s.plot.pts), 584, 'area, counter-clockwise');
  const len = s.plot.pts.map((p, i) => { const q = s.plot.pts[(i + 1) % 5]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
  assert.deepEqual(len.map((l) => l.toFixed(1)), ['20.0', '30.0', '12.0', '8.9', '26.0']);
  assert.equal(len.reduce((x, y) => x + y, 0).toFixed(1), '96.9');
  // site and building
  assert.deepEqual(a.setbacks, { front: 3, back: 2, side: 2 });
  assert.deepEqual([a.footprintPct, a.vegPct, a.north, a.streetEdge], [25, 25, null, 0]);
  assert.deepEqual([a.floors, a.basement, a.usableRoof, a.ceilingH, a.roofType, a.exterior], [2, false, false, 3, 'flat', 'sand']);
  assert.equal(a.unit, 'm');
  // rooms
  const lvl = (id) => a.rooms.filter((r) => r.level === id), area = (r) => C.ROOM_SIZE[r.type][r.size];
  assert.deepEqual(lvl('G').map((r) => [r.type, r.size, area(r)]), [['living', 'L', 42], ['majlis', 'M', 24], ['dining', 'M', 16], ['kitchen', 'M', 14], ['maid', 'S', 6], ['bathroom', 'S', 4], ['laundry', 'S', 4]]);
  assert.deepEqual(lvl('1').map((r) => [r.type, r.size, area(r)]), [['bedroom', 'L', 24], ['bedroom', 'M', 16], ['bedroom', 'M', 16], ['living', 'M', 30], ['office', 'M', 12], ['bathroom', 'M', 6], ['bathroom', 'M', 6]]);
  assert.equal(a.rooms.length, 14);
  for (const id of ['G', '1']) {
    const rooms = lvl(id).reduce((x, r) => x + area(r), 0);
    assert.equal(rooms, 110, id); assert.equal(rooms + C.STAIR.area, 120, id);
  }
  assert.deepEqual(a.rooms.filter((r) => r.master).map((r) => r.id), ['r8']);
  assert.ok(a.rooms.every((r) => r.area === null));
  assert.deepEqual(a.rooms.map((r) => r.id), Array.from({ length: 14 }, (_, i) => 'r' + (i + 1)));
  assert.equal(a.nextRoomId, 15);
  // adjacency: Kitchen + Dining; Master bedroom + Bathroom 1 (first bathroom on the first floor)
  const t = (id) => a.rooms.find((r) => r.id === id);
  assert.deepEqual(a.pairs.map((p) => p.map((id) => t(id).type + '@' + t(id).level)), [['dining@G', 'kitchen@G'], ['bedroom@1', 'bathroom@1']]);
  assert.equal(t(a.pairs[1][0]).master, true);
  assert.equal(a.pairs[1][1], lvl('1').find((r) => r.type === 'bathroom').id);
  assert.deepEqual([a.stairPos, a.lift], ['centre', false]);
  // outdoor and interior
  assert.deepEqual(a.parking, { cars: 2, covered: true });
  assert.deepEqual(a.pool, { on: true, size: 'S' });
  assert.deepEqual(a.extras, { wall: true, gate: 'centre', seating: true });
  assert.deepEqual(a.interior, { style: 'modern', density: 'full' });
  // 6.2 area budget
  assert.equal(a.footprintPct + a.vegPct, 50);
  assert.equal(a.parking.cars * C.PARKING.area, 25); assert.equal(C.POOL[a.pool.size].area, 18);
  // loader state
  assert.deepEqual([s.stage, s.sampleClean, s.plans], [1, true, {}]);
});

test('sample is a valid draft state, a fresh copy each time, and passes stages 1 and 2', () => {
  const PC = loadCore();
  assert.equal(PC.draft.validState(PC.sample.state()), true);
  const a = PC.sample.state(); a.ans.rooms.pop(); a.plot.pts.pop();
  assert.equal(PC.sample.state().ans.rooms.length, 14); assert.equal(PC.sample.state().plot.pts.length, 5);
  const st = PC.stages.status(PC.sample.state());
  assert.ok(st[1].valid && st[2].valid && st[2].reachable);
});
