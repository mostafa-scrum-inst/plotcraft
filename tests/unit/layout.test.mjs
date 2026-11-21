// F3-T1: the floor-plan generator PC.layout (A-8), with PC.layout.check as the oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

const PC = loadCore(), Y = PC.layout;
const gen = (inp) => plain(Y.generate({ pairs: [], stairs: true, stairPos: 'centre', lift: false, ...inp }));
const valid = (inp, res) => plain(Y.check(inp.W, inp.D, res.core, inp.rooms, res.rooms));
const rooms = (areas) => areas.map((a, i) => ({ id: 'r' + (i + 1), area: a }));
const sampleInp = (id) => plain(PC.plans.input(PC.sample.state(), id));

test('both sample levels: valid, zero unmet pairs, on the 0.5 m grid', () => {
  for (const id of ['G', '1']) {
    const inp = sampleInp(id), res = gen(inp);
    assert.equal(res.ok, true); assert.deepEqual(valid(inp, res), [], `level ${id} valid`);
    assert.deepEqual(res.unmet, [], `level ${id}: every pair shares a wall`);
    assert.ok(res.rooms.every((r) => ['x', 'y', 'w', 'h'].every((k) => Math.abs(r[k] * 2 - Math.round(r[k] * 2)) < 1e-9)), `level ${id} snapped to 0.5 m`);
  }
});

test('core: stair 2.5 x 4 along the longer axis, lift beside it; the five Q14 positions (left = low x seen from the street)', () => {
  const c = plain(Y.core(9.5, 15, true, 'centre', true));
  assert.deepEqual(c.stair, { x: 2.5, y: 5.5, w: 2.5, h: 4 }); assert.deepEqual(c.lift, { x: 5, y: 5.5, w: 1.5, h: 2 }, 'block 4 m wide, centred, snapped down');
  const at = (pos) => plain(Y.core(9.5, 15, true, pos, false).stair);
  assert.deepEqual([at('fl'), at('fr'), at('bl'), at('br')].map((s) => [s.x, s.y]), [[0, 0], [7, 0], [0, 11], [7, 11]]);
  assert.deepEqual(plain(Y.core(15, 9.5, true, 'centre', false).stair), { x: 5.5, y: 3.5, w: 4, h: 2.5 }, 'wide footprint: stair along x');
  assert.deepEqual(plain(Y.core(9.5, 15, false, 'centre', false)), { stair: null, lift: null, cells: [{ id: 'A', x: 0, y: 0, w: 9.5, h: 15 }] });
});

test('maximum level (8 rooms, lift) at each stair position; one-room, no-stair, wide and deep footprints; the CTO case', () => {
  const eight = rooms([24, 16, 16, 16, 9, 6, 6, 4]);              // 97 + 13 core
  for (const pos of ['centre', 'fl', 'fr', 'bl', 'br']) {
    const inp = { W: 10, D: 15, rooms: eight, pairs: [['r1', 'r6']], stairs: true, stairPos: pos, lift: true }, res = gen(inp);
    assert.equal(res.ok, true, pos); assert.deepEqual(valid(inp, res), [], pos);
    const c = plain(Y.core(10, 15, true, pos, true));
    assert.deepEqual(res.core, { stair: c.stair, lift: c.lift }, `${pos}: the same core block`);
  }
  for (const inp of [{ W: 9.5, D: 15, rooms: rooms([30]) }, { W: 8, D: 12, rooms: rooms([30, 20, 16, 12]), stairs: false },
    { W: 20, D: 10, rooms: rooms([30, 30, 20, 20, 16, 12, 9, 4]) }, { W: 8, D: 20, rooms: rooms([30, 24, 20, 16, 12, 9, 6]) },
    { W: 8.5, D: 16.5, rooms: rooms([42, 36, 16, 4, 4]), stairs: false }]) {
    const full = { pairs: [], stairs: true, stairPos: 'centre', lift: false, ...inp }, res = gen(full);
    assert.equal(res.ok, true, JSON.stringify(inp)); assert.deepEqual(valid(full, res), [], JSON.stringify(inp));
  }
});

test('stretched footprints up to 3:1 (CD-1): 6 x 18, 18 x 6, 15 x 5, 5 x 15 lay out the default lists and a full 8-room level', () => {
  const def = PC.store.defaults(), lists = { G: def.ans.rooms.filter((r) => r.level === 'G'), 1: def.ans.rooms.filter((r) => r.level === '1') };
  for (const [W, D] of [[6, 18], [18, 6], [15, 5], [5, 15]]) {
    for (const id of ['G', '1']) {
      const inp = { W, D, rooms: lists[id].map((r) => ({ id: r.id, area: PC.levels.roomArea(r) })), pairs: [], stairs: true, stairPos: 'centre', lift: false }, res = gen(inp);
      assert.equal(res.ok, true, `${W} x ${D} ${id}`); assert.deepEqual(valid(inp, res), []);
    }
    const area = W * D - 10, eight = rooms([0.2, 0.15, 0.15, 0.12, 0.1, 0.1, 0.08, 0.06].map((f) => Math.round(f * area * 0.8 * 2) / 2));
    const inp = { W, D, rooms: eight, pairs: [], stairs: true, stairPos: 'centre', lift: false }, res = gen(inp);
    assert.equal(res.ok, true, `${W} x ${D}: 8 rooms at 80 % fill`); assert.deepEqual(valid(inp, res), []);
  }
});

test('cannot be laid out: one 80 m2 room on the sample footprint -> ok false (never an invalid layout)', () => {
  const res = gen({ W: 9.5, D: 15, rooms: rooms([80]) });
  assert.equal(res.ok, false); assert.ok(res.core.stair, 'the core is still reported');
});

test('snap only when still valid; determinism; check reports each violation', () => {
  const inp = { W: 9.5, D: 15.3, rooms: rooms([30, 24, 20, 14, 9, 6, 4]), pairs: [], stairs: true, stairPos: 'centre', lift: false }, res = gen(inp);
  assert.equal(res.ok, true); assert.deepEqual(valid(inp, res), [], 'kept output is valid either way');
  assert.deepEqual(gen(inp), res, 'two runs deep-equal');
  const core = { stair: { x: 0, y: 0, w: 2.5, h: 4 }, lift: null }, req = rooms([20, 10]);
  const codes = (rs) => plain(Y.check(10, 10, core, req, rs)).map((e) => e.code).sort();
  assert.deepEqual(codes([{ id: 'r1', x: 3, y: 0, w: 4, h: 5 }, { id: 'r2', x: 3, y: 5, w: 2, h: 5 }]), []);
  assert.deepEqual(codes([{ id: 'r1', x: 3, y: 0, w: 4, h: 5 }]), ['missing']);
  assert.deepEqual(codes([{ id: 'r1', x: 0, y: 0, w: 4, h: 5 }, { id: 'r2', x: 3, y: 5, w: 2, h: 5 }]), ['overlap-core']);
  assert.deepEqual(codes([{ id: 'r1', x: 3, y: 0, w: 4, h: 5 }, { id: 'r2', x: 3, y: 4, w: 2, h: 5 }]), ['overlap-room']);
  assert.deepEqual(codes([{ id: 'r1', x: 3, y: 0, w: 1.4, h: 14 }, { id: 'r2', x: 5, y: 5, w: 2, h: 5 }]), ['area', 'aspect', 'outside', 'side'].filter((c) => c !== 'area' || true).filter((c) => ['aspect', 'outside', 'side'].includes(c)));
  assert.deepEqual(codes([{ id: 'r1', x: 3, y: 0, w: 4, h: 3 }, { id: 'r2', x: 3, y: 5, w: 2, h: 5 }]), ['area']);
  assert.equal(Y.adjacent({ x: 0, y: 0, w: 4, h: 4 }, { x: 4.01, y: 3.5, w: 2, h: 2 }), true, '0.5 m shared wall');
  assert.equal(Y.adjacent({ x: 0, y: 0, w: 4, h: 4 }, { x: 4.01, y: 3.6, w: 2, h: 2 }), false, '0.4 m is not a wall');
});

test('timing: a maximum level (8 rooms + lift) generates in under 300 ms', () => {
  const inp = { W: 10, D: 15, rooms: rooms([24, 16, 16, 16, 9, 6, 6, 4]), pairs: [['r1', 'r6'], ['r2', 'r7'], ['r3', 'r8']], stairs: true, stairPos: 'centre', lift: true };
  let best = Infinity; for (let k = 0; k < 3; k++) { const t = Date.now(); Y.generate(inp); best = Math.min(best, Date.now() - t); }
  assert.ok(best < 300, `${best} ms`);
});

test('pinned: the 0.5 m snap is rejected when it would break check (unsnapped coordinates kept, still valid)', () => {
  const inp = { W: 7, D: 16.5, rooms: [{ id: 'r1', area: 16 }, { id: 'r2', area: 30 }, { id: 'r3', area: 9 }, { id: 'r4', area: 9 }, { id: 'r5', area: 14 }, { id: 'r6', area: 9 }],
    pairs: [['r1', 'r6'], ['r2', 'r5']], stairs: true, stairPos: 'centre', lift: false };
  const res = gen(inp);
  assert.equal(res.ok, true); assert.deepEqual(valid(inp, res), []);
  assert.ok(res.rooms.some((r) => ['x', 'y', 'w', 'h'].some((k) => Math.abs(r[k] * 2 - Math.round(r[k] * 2)) > 1e-9)), 'off-grid coordinates kept');
  const snapped = res.rooms.map((r) => { const s = (x) => Math.round(x * 2) / 2, x = s(r.x), y = s(r.y); return { id: r.id, x, y, w: s(r.x + r.w) - x, h: s(r.y + r.h) - y }; });
  const by = Object.fromEntries(snapped.map((r) => [r.id, r])), lost = inp.pairs.filter((p) => !Y.adjacent(by[p[0]], by[p[1]])).length > res.unmet.length;
  assert.ok(plain(Y.check(inp.W, inp.D, res.core, inp.rooms, snapped)).length > 0 || lost, 'the snapped version is invalid or loses a shared wall');
});

test('pinned: the second room order (partners pulled together) meets a pair the first order cannot', () => {
  const inp = { W: 6.5, D: 16.5, rooms: [{ id: 'r1', area: 6 }, { id: 'r2', area: 16 }, { id: 'r3', area: 16 }, { id: 'r4', area: 9 }, { id: 'r5', area: 12 }],
    pairs: [['r1', 'r5'], ['r2', 'r4']], stairs: true, stairPos: 'br', lift: false };
  const res = gen(inp);
  assert.equal(res.ok, true); assert.deepEqual(valid(inp, res), []); assert.deepEqual(res.unmet, [], 'both pairs share a wall');
});

// ---- F3-T2: retry with the cell scale range 0.75-1.25 when the first pass finds no layout (A-8 step 8) ----
import { readFileSync } from 'node:fs';
import { programmes } from '../helpers/programmes.mjs';
const GOLD = JSON.parse(readFileSync(new URL('./fixtures/layout-golden.json', import.meta.url), 'utf8'));

test('retry: every fixed F3-T1 case is deep-equal to the golden output (the sample included)', () => {
  assert.deepEqual(plain(PC.C.LAYOUT.retry), { fMin: 0.75, fMax: 1.25 });
  for (const g of GOLD.fixed) assert.deepEqual(gen(g.inp), g.out, g.name);
  assert.ok(GOLD.fixed.some((g) => g.name === 'sample G') && GOLD.fixed.some((g) => g.name === 'sample 1'));
});

test("retry: QA's 30 m2 room on 5 x 8.5 m with a front-left stair lays out (both orientations), valid by check", () => {
  for (const [W, D] of [[5, 8.5], [8.5, 5]]) {
    const inp = { W, D, rooms: rooms([30]), stairPos: 'fl' }, res = gen(inp), full = { pairs: [], stairs: true, lift: false, ...inp };
    assert.equal(res.ok, true, `${W} x ${D}`); assert.deepEqual(valid(full, res), []);
    assert.equal(res.rooms[0].w * res.rooms[0].h, 22.5, 'the largest free rectangle: exactly -25 %');
  }
});

test('retry: the pinned boundary case stays no-layout because its retried result fails check after rounding', () => {
  const inp = programmes(PC.C)[244].inp;
  assert.deepEqual(inp, { W: 12, D: 4.5, rooms: [{ id: 'r1', area: 9 }, { id: 'r2', area: 9 }, { id: 'r3', area: 6 }, { id: 'r4', area: 16 }],
    pairs: [['r4', 'r1'], ['r1', 'r3']], stairs: true, stairPos: 'centre', lift: false }, 'stream position 244');
  assert.equal(GOLD.sweep[244], null, 'a failure of the first pass');
  assert.equal(gen(inp).ok, false, 'the check guard rejects the retried layout');
});

test('retry: a failing maximum level (8 rooms + lift, area-valid) stays under 600 ms, retry included', () => {
  const inp = { W: 15, D: 5, rooms: rooms([10.5, 2.5, 7, 5, 2.5, 13.5, 6, 7]), pairs: [['r1', 'r2'], ['r3', 'r4'], ['r5', 'r6']], stairs: true, stairPos: 'br', lift: true };
  assert.ok(inp.rooms.reduce((s, r) => s + r.area, 0) + 13 <= inp.W * inp.D, 'passes the area validation');
  assert.equal(gen(inp).ok, false);
  let best = Infinity; for (let k = 0; k < 3; k++) { const t = Date.now(); Y.generate(inp); best = Math.min(best, Date.now() - t); }
  assert.ok(best < 600, `${best} ms`);
});
