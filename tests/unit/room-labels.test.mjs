import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

test('F3-T2 roomLabels: every room type plus master, stair and lift; full names match PC.C.ROOM_LABEL', () => {
  const PC = loadCore(), T = plain(PC.data.roomLabels);
  assert.deepEqual(Object.keys(T).sort(), [...PC.C.ROOM_TYPES, 'master', 'stair', 'lift'].sort());
  for (const t of PC.C.ROOM_TYPES) assert.equal(T[t].full, PC.C.ROOM_LABEL[t], t);
  assert.equal(T.master.full, 'Master bedroom');
  for (const [k, v] of Object.entries(T)) {
    assert.deepEqual(Object.keys(v), ['full', 'short', 'tiny'], k);
    assert.ok(v.short.length <= v.full.length && v.tiny.length <= 3 && v.tiny.length <= v.short.length, k);
  }
});

test('F3-T2 roomLabels: short and tiny forms are unique, so labels drawn on one level never collide', () => {
  const T = plain(loadCore().data.roomLabels), vals = Object.values(T);
  assert.equal(new Set(vals.map((v) => v.tiny)).size, vals.length);
  assert.equal(new Set(vals.filter((v, i) => Object.keys(T)[i] !== 'lift').map((v) => v.short)).size, vals.length - 1);
});

test('F3-T2 palette2d editor entries', () => {
  const P = plain(loadCore().data.palette2d);
  for (const k of ['handleStroke', 'ghost', 'snap', 'handleFill', 'selection', 'invalid', 'invalidFill', 'approved']) assert.ok(P.state[k], 'state.' + k);
  assert.equal(P.line.handle, 1.5);
  assert.match(P.font.roomSmall, /^600 10px /);
});
