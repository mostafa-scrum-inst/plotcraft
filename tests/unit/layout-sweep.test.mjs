// F3-T1: seeded sweep of the floor-plan generator (A-8, F3 plan): at least 2 000 programmes that pass the area
// validation, on footprints as the site model produces them since CD-1 (up to 3:1, long <= 3 x short + 0.5 m,
// both directions). Every result is ok and valid by check, or ok: false. Prints the no-layout rates and the time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { programmes } from '../helpers/programmes.mjs';

const PC = loadCore(), Y = PC.layout, C = PC.C;
const GOLD = JSON.parse(readFileSync(new URL('./fixtures/layout-golden.json', import.meta.url), 'utf8'));
const hash = (x) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);

test('sweep: >= 2000 validated programmes; no invalid result; no-layout <= 5 % at <= 85 % fill (overall and beyond 2:1)', () => {
  const t0 = Date.now(), stat = { all: [0, 0, 0, 0], wide: [0, 0, 0, 0] };   // [n <=85, fail <=85, n >85, fail >85]
  let count = 0, worst = 0, recovered = 0, formerFail = 0, changed = [];
  for (const { inp, fill } of programmes(C)) {
    const { W, D } = inp;
    const L = Math.max(W, D), S = Math.min(W, D);
    assert.ok(L <= 3 * S + C.FOOTPRINT_STRETCH_EXTRA + 1e-9, `footprint ${W} x ${D} within the corrected bound`);
    const t = Date.now(); let res;
    try { res = plain(Y.generate(inp)); } catch (e) { assert.fail(`exception on ${JSON.stringify(inp)}: ${e.message}`); }
    let dt = Date.now() - t;
    for (let k = 0; k < 2 && dt >= 300; k++) { const t2 = Date.now(); Y.generate(inp); dt = Math.min(dt, Date.now() - t2); }   // best of 3 when noisy (A-16)
    worst = Math.max(worst, dt);
    if (res.ok) assert.deepEqual(plain(Y.check(W, D, res.core, inp.rooms, res.rooms)), [], `valid layout for ${JSON.stringify(inp)}`);
    // F3-T2 retry: every F3-T1 success is byte-identical (golden hash); former failures may now lay out
    if (GOLD.sweep[count]) { if (hash(res) !== GOLD.sweep[count]) changed.push(count); } else { formerFail++; if (res.ok) recovered++; }
    const k = fill <= 0.85 ? 0 : 2;
    for (const g of L > 2 * S + 1e-9 ? ['all', 'wide'] : ['all']) { stat[g][k]++; if (!res.ok) stat[g][k + 1]++; }
    count++;
  }
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '-') + ' %';
  const secs = (Date.now() - t0) / 1000;
  console.log(`  sweep: ${count} programmes in ${secs.toFixed(1)} s (worst ${worst} ms)`);
  console.log(`  no-layout at <= 85 % fill: ${pct(stat.all[1], stat.all[0])} of ${stat.all[0]}; above 85 %: ${pct(stat.all[3], stat.all[2])} of ${stat.all[2]}`);
  console.log(`  retry (F3-T2): former failures recovered ${recovered} of ${formerFail}; F3-T1 successes changed ${changed.length}`);
  console.log(`  beyond 2:1: <= 85 %: ${pct(stat.wide[1], stat.wide[0])} of ${stat.wide[0]}; above: ${pct(stat.wide[3], stat.wide[2])} of ${stat.wide[2]}`);
  assert.ok(count >= 2000, `${count} programmes`);
  assert.equal(GOLD.sweep.length, count, 'the golden stream has the same programmes');
  assert.deepEqual(changed, [], 'every F3-T1 success unchanged (retry on failure only)');
  assert.ok(recovered >= 10, `the retry recovers former failures (${recovered})`);
  assert.ok(stat.all[1] / stat.all[0] <= 0.05, 'overall no-layout at <= 85 % fill');
  assert.ok(stat.wide[0] >= 300 && stat.wide[1] / stat.wide[0] <= 0.05, 'beyond 2:1 no-layout at <= 85 % fill');
  assert.ok(worst < 300, `worst case ${worst} ms`);
  assert.ok(secs < 30, `sweep time ${secs.toFixed(1)} s (over 30 s it moves to its own run-all step)`);
});
