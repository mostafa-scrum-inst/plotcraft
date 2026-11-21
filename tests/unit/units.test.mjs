import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from '../helpers/load.mjs';
const U = loadCore().units;

test('F1-S2 example: 20 x 30 m rectangle in both units', () => {
  assert.deepEqual([U.fmtLen(20, 'm'), U.fmtLen(30, 'm'), U.fmtArea(600, 'm')], ['20.0 m', '30.0 m', '600 m²']);
  assert.deepEqual([U.fmtLen(20, 'ft'), U.fmtLen(30, 'ft'), U.fmtArea(600, 'ft')], ['65.6 ft', '98.4 ft', '6458 sq ft']);
});
test('sample figures and the minimum plot area', () => {
  assert.deepEqual([U.fmtArea(584, 'm'), U.fmtLen(96.944, 'm'), U.fmtLen(8.944, 'm')], ['584 m²', '96.9 m', '8.9 m']);
  assert.deepEqual([U.fmtArea(50, 'm'), U.fmtArea(50, 'ft')], ['50 m²', '538 sq ft']);
  assert.equal(U.fmtLen(1.5, 'ft'), '4.9 ft');
});
test('conversions round-trip; metres pass through', () => {
  for (const v of [0, 0.3048, 1, 2.4, 100]) {
    assert.ok(Math.abs(U.fromDisplay(U.toDisplay(v, 'ft'), 'ft') - v) < 1e-12);
    assert.ok(Math.abs(U.areaFromDisplay(U.areaToDisplay(v, 'ft'), 'ft') - v) < 1e-12);
    assert.equal(U.toDisplay(v, 'm'), v); assert.equal(U.areaFromDisplay(v, 'm'), v);
  }
  assert.ok(Math.abs(U.toDisplay(0.3048, 'ft') - 1) < 1e-12); assert.ok(Math.abs(U.fromDisplay(10, 'ft') - 3.048) < 1e-12);
  assert.deepEqual([U.lenUnit('m'), U.lenUnit('ft'), U.areaUnit('m'), U.areaUnit('ft')], ['m', 'ft', 'm²', 'sq ft']);
});
test('parseNum', () => {
  assert.deepEqual(['3', ' 2.5 ', '2,5', '.5', '-1', '+4', '10.'].map(U.parseNum), [3, 2.5, 2.5, 0.5, -1, 4, 10]);
  for (const t of ['', ' ', 'abc', '1e3', '1.2.3', '2m', null, undefined, '--1', 'NaN', 'Infinity']) assert.equal(U.parseNum(t), null, String(t));
});

test('stepLen and fmtDims', () => {
  assert.deepEqual([U.stepLen('m'), U.stepLen('ft')], [0.5, 0.3048]);
  assert.deepEqual([U.fmtDims(3, 6, 'm'), U.fmtDims(3, 6, 'ft'), U.fmtDims(5, 10, 'ft')], ['3.0 \u00D7 6.0 m', '9.8 \u00D7 19.7 ft', '16.4 \u00D7 32.8 ft']);
});
