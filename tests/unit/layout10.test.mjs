// CD-4 (F4-T2 Step 0): 10 rooms per plan level. The generator re-proof the TL asked for (plan-review Q1):
// - the memo-key regression (at >= 9 rooms the old key ci * 256 + mask collided: a room went missing, or a pair
//   naming it threw);
// - the worst-case grid (10 rooms + lift + 5 pairs, 7 footprints x 3 fills x 5 stair positions): every case lays
//   out, valid by check, worst < 300 ms (best of 3);
// - the seeded 9-10-room stream (300 programmes): no invalid result, no-layout <= 5 % at <= 85 % fill;
// - both deep-equal to the golden hashes recorded after the key fix and BEFORE the speed-ups (exactness, TL Q1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadCore, plain } from '../helpers/load.mjs';
import { programmes10, grid10 } from '../helpers/programmes.mjs';

const PC = loadCore(), Y = PC.layout, C = PC.C;
const GOLD = JSON.parse(readFileSync(new URL('./fixtures/layout-golden10.json', import.meta.url), 'utf8'));
const hash = (x) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
const valid = (inp, res) => plain(Y.check(inp.W, inp.D, res.core, inp.rooms, res.rooms));
const best3 = (inp) => { let b = Infinity, r; for (let k = 0; k < 3; k++) { const t = performance.now(); r = plain(Y.generate(inp)); b = Math.min(b, performance.now() - t); } return [b, r]; };

test('memo key (CD-4): 9 and 10 rooms with pairs naming r9 / r10 return every room once, valid', () => {
  assert.equal(C.MAX_ROOMS_PER_LEVEL, 10);
  const fr = [0.16, 0.13, 0.12, 0.11, 0.1, 0.1, 0.08, 0.08, 0.06, 0.06], area = 150 - 13;
  for (const n of [9, 10]) {
    const rooms = fr.slice(0, n).map((f, i) => ({ id: 'r' + (i + 1), area: Math.max(4, Math.round(f * area * 0.6 * 2) / 2) }));
    const pairs = [['r1', 'r9'], ['r2', 'r' + n], ['r3', 'r8']];
    const inp = { W: 10, D: 15, rooms, pairs, stairs: true, stairPos: 'centre', lift: true }, res = plain(Y.generate(inp));
    assert.equal(res.ok, true, `${n} rooms`);
    assert.deepEqual(res.rooms.map((r) => r.id).sort(), rooms.map((r) => r.id).sort(), `${n} rooms: every room once`);
    assert.deepEqual(valid(inp, res), [], `${n} rooms valid`);
  }
});

test('worst-case grid at 10 rooms (105 cases): all laid out and valid, worst < 300 ms (best of 3 when over), outputs = golden (key fix, before speed-ups)', () => {
  const g = grid10(); let worst = 0, at = '';
  assert.equal(g.length, 105);
  g.forEach((c, i) => {
    const t = performance.now(), res = plain(Y.generate(c.inp)); let ms = performance.now() - t;
    if (ms >= 300) ms = Math.min(ms, best3(c.inp)[0]);              // best of 3 when noisy (A-16)
    assert.equal(res.ok, true, c.name); assert.deepEqual(valid(c.inp, res), [], c.name);
    assert.equal(hash(res), GOLD.grid[i], `${c.name}: output unchanged`);
    if (ms > worst) { worst = ms; at = c.name; }
  });
  console.log(`  10-room grid: worst ${worst.toFixed(0)} ms (${at})`);
  assert.ok(worst < 300, `worst ${worst.toFixed(0)} ms at ${at}`);
});

test('seeded 9-10-room stream (300): no invalid result, no-layout <= 5 % at <= 85 % fill, worst < 300 ms, outputs = golden, <= 10 s', () => {
  const t0 = Date.now(), list = programmes10(C); let n85 = 0, f85 = 0, worst = 0, fails = 0;
  assert.equal(list.length, 300); assert.equal(GOLD.p10.length, 300);
  list.forEach(({ inp, fill }, i) => {
    const t = performance.now(); let res = plain(Y.generate(inp)), dt = performance.now() - t;
    if (dt >= 300) dt = Math.min(dt, best3(inp)[0]);                 // best of 3 when noisy (A-16)
    worst = Math.max(worst, dt);
    if (res.ok) assert.deepEqual(valid(inp, res), [], JSON.stringify(inp)); else fails++;
    assert.equal(hash(res), GOLD.p10[i], `programme ${i}: output unchanged`);
    if (fill <= 0.85) { n85++; if (!res.ok) f85++; }
  });
  const secs = (Date.now() - t0) / 1000;
  console.log(`  9-10 stream: 300 in ${secs.toFixed(1)} s, worst ${worst.toFixed(0)} ms, no-layout ${fails} (${f85} of ${n85} at <= 85 %)`);
  assert.ok(f85 / n85 <= 0.05); assert.ok(worst < 300, `worst ${worst.toFixed(0)} ms`); assert.ok(secs <= 10, `${secs.toFixed(1)} s (over 10 s: own run-all step, TL Q1)`);
});
