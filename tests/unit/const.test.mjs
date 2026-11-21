import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

test('4.2 room sizes: all 30 values', () => {
  const C = loadCore().C;
  const table = { bedroom: [12, 16, 24], bathroom: [4, 6, 9], kitchen: [9, 14, 20], living: [20, 30, 42], dining: [12, 16, 24],
    majlis: [16, 24, 36], office: [9, 12, 16], maid: [6, 9, 12], storage: [4, 6, 9], laundry: [4, 6, 9] };
  assert.deepEqual(plain(C.ROOM_TYPES), Object.keys(table));
  for (const [t, [S, M, L]] of Object.entries(table)) assert.deepEqual(plain(C.ROOM_SIZE[t]), { S, M, L }, t);
});

test('4.3 numbers', () => {
  const C = loadCore().C;
  assert.deepEqual(plain(C.STAIR), { w: 2.5, d: 4, area: 10 });
  assert.deepEqual(plain(C.LIFT), { w: 1.5, d: 2, area: 3 });
  assert.deepEqual(plain(C.PARKING), { w: 2.5, d: 5, area: 12.5 });
  assert.deepEqual(plain(C.POOL), { S: { w: 3, d: 6, area: 18 }, M: { w: 4, d: 8, area: 32 }, L: { w: 5, d: 10, area: 50 } });
  for (const k of ['STAIR', 'LIFT', 'PARKING']) assert.equal(C[k].w * C[k].d, C[k].area, k);
  for (const k of ['S', 'M', 'L']) assert.equal(C.POOL[k].w * C.POOL[k].d, C.POOL[k].area, k);
  assert.equal(C.POOL_CLEAR, 1);
  assert.deepEqual(plain(C.GRID.m), { square: 1, snap: 0.5 });
  assert.ok(Math.abs(C.GRID.ft.square - 5 * 0.3048) < 1e-12 && C.GRID.ft.snap === 0.3048);
  assert.deepEqual(plain(C.PLAN_SNAP), { m: 0.5, ft: 0.3048 });
  assert.deepEqual(plain(C.PLOT), { minPts: 3, maxPts: 12, extent: 100, minArea: 50 });
  assert.equal(C.BUILDABLE_MIN, 20);
  assert.deepEqual([C.ROOM_MIN_SIDE, C.ROOM_AREA_TOL, C.ROOM_MAX_ASPECT, C.MAX_ROOMS_PER_LEVEL, C.MAX_PAIRS_PER_LEVEL], [1.5, 0.25, 3, 8, 6]);
  assert.equal(C.FT, 0.3048);
});

test('4.1 ranges and choices equal the markup contract values', async () => {
  const C = loadCore().C;
  assert.deepEqual(plain(C.RANGE), { setback: [0, 20], footprintPct: [10, 80], vegPct: [0, 80], ceilingH: [2.4, 4.5], floors: [1, 3], cars: [0, 4], roomArea: [4, 80] });
  const { readFileSync } = await import('node:fs');
  const v = JSON.parse(readFileSync(new URL('../contract/values.json', import.meta.url), 'utf8'));
  const same = (a, b, m) => assert.deepEqual([...a].sort(), [...b].sort(), m);
  same(C.ENUM.unit, v['q-unit'], 'unit'); same(C.ENUM.roofType, v['q-roof'], 'roof'); same(C.ENUM.exterior, v['q-exterior'], 'exterior');
  same(C.ENUM.stairPos, v['q-stair-pos'], 'stair'); same(C.ENUM.gate, v['q-gate'], 'gate'); same(C.ENUM.poolSize, v['q-pool-size'], 'pool');
  same(C.ENUM.interiorStyle, v['q-interior-style'], 'style'); same(C.ENUM.density, v['q-interior-density'], 'density');
  same(C.ROOM_TYPES, v['room-type'], 'types'); same(C.LEVELS, v['room-level'], 'levels');
  same([...C.SIZES, 'exact'], v['room-size'], 'sizes');
});
