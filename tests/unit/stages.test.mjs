import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

const rect = (w, h) => ({ pts: [[0, 0], [w, 0], [w, h], [0, h]], closed: true });
const setup = (max = 5) => { const PC = loadCore(); PC.stages.MAX_BUILT = max; return PC; };
const flags = (st) => [1, 2, 3, 4, 5].map((n) => (st[n].reachable ? 'r' : '-') + (st[n].valid ? 'v' : '-')).join(' ');

test('empty and open plots: only stage 1, with the reason', () => {
  const PC = setup(), s = PC.store.defaults();
  let st = PC.stages.status(s);
  assert.equal(flags(st), 'r- -v -- -v -v');
  assert.equal(st[1].reason, 'Draw and close the plot first');
  for (const n of [2, 3, 4, 5]) assert.equal(st[n].reason, 'Draw and close the plot first');
  s.plot = { pts: [[0, 0], [10, 0], [10, 10]], closed: false };
  assert.equal(PC.stages.status(s)[2].reachable, false);
});

test('plot area limit: 49 m2 blocks, 50 m2 passes (either winding)', () => {
  const PC = setup(), s = PC.store.defaults();
  s.plot = rect(7, 7);
  let st = PC.stages.status(s);
  assert.equal(st[1].valid, false); assert.match(st[2].reason, /too small \(minimum 50 m/);
  s.plot = rect(5, 10);
  assert.equal(PC.stages.status(s)[1].valid, true); assert.equal(PC.stages.status(s)[2].reachable, true);
  s.plot.pts.reverse();
  assert.equal(PC.stages.status(s)[1].valid, true);
});

test('stage 2: valid when nothing blocks; a blocking conflict locks stage 3', () => {
  const PC = setup(), s = PC.sample.state();
  assert.equal(flags(PC.stages.status(s)), 'rv rv r- -v -v');
  s.ans.floors = 3;                                            // second floor without rooms
  const st = PC.stages.status(s);
  assert.equal(flags(st), 'rv r- -- -v -v');
  assert.equal(st[2].reason, 'Fix the highlighted answers first'); assert.equal(st[3].reason, st[2].reason);
  s.ans.floors = 2;
  assert.equal(PC.stages.status(s)[3].reachable, true);
  const d = PC.store.defaults(); d.plot = rect(20, 20); d.ans.streetEdge = 0;
  assert.equal(PC.stages.status(d)[2].valid, true, 'default answers on a 20 x 20 m plot');
  d.plot = rect(8, 8); assert.equal(PC.stages.status(d)[2].valid, false, 'buildable area under 20 m2');
});

test('stage 3: every plan level approved, without error, signature current', () => {
  const PC = setup(), s = PC.sample.state(), plan = (id, approved, error = null) => ({ sig: PC.sig.level(s, id), rooms: [], unmet: [], edited: false, approved, error });
  assert.equal(PC.stages.status(s)[4].reason, 'Approve all floors first');
  assert.equal(PC.stages.status(s)[5].reason, 'Approve all floors first');
  s.plans = { G: plan('G', true) };
  assert.equal(PC.stages.status(s)[3].valid, false, 'first floor has no plan');
  s.plans['1'] = plan('1', false);
  assert.equal(PC.stages.status(s)[3].valid, false);
  s.plans['1'] = plan('1', true);
  assert.equal(flags(PC.stages.status(s)), 'rv rv rv rv rv');
  s.plans['1'] = plan('1', true, 'no-layout');
  assert.equal(PC.stages.status(s)[3].valid, false);
  s.plans['1'] = plan('1', true);
  s.plans.G.sig = 'something else';
  assert.equal(PC.stages.status(s)[3].valid, false, 'stale signature: not valid even though approved');
  s.plans.G = plan('G', true);
  s.ans.footprintPct = 30;
  assert.equal(PC.stages.status(s)[3].valid, false, 'a layout answer changed: both plans are stale');
  s.ans.footprintPct = 25; s.ans.exterior = 'grey';
  assert.equal(PC.stages.status(s)[3].valid, true, 'an appearance answer keeps them valid');
  s.ans.basement = true; s.ans.rooms.push(PC.store.room('r15', 'storage', 'B', 'S')); s.ans.nextRoomId = 16;
  assert.equal(PC.stages.status(s)[3].valid, false, 'basement has no plan');
  s.plans.B = plan('B', true);
  assert.equal(PC.stages.status(s)[3].valid, true);
});

test('no fail-open guards: stages needs its modules', () => {
  const PC = setup(), s = PC.sample.state(), v = PC.validate, g = PC.sig;
  delete PC.validate; assert.throws(() => PC.stages.status(s)); PC.validate = v;
  s.plans = { G: { sig: g.level(s, 'G'), rooms: [], unmet: [], edited: false, approved: true, error: null } };
  delete PC.sig; assert.throws(() => PC.stages.status(s)); PC.sig = g;
  assert.ok(PC.stages.status(s)[1].valid);
});

test('MAX_BUILT caps reachability with its own reason; default is 5 since F3-T2 (stage 5 a static preview)', () => {
  const PC = loadCore(), s = PC.sample.state();
  assert.equal(PC.stages.MAX_BUILT, 5);
  let st = PC.stages.status(s);
  assert.equal(st[3].reachable, true, 'stage 3 opens from a valid stage 2');
  assert.equal(st[4].reason, 'Approve all floors first', 'stage 4 waits for approval');
  PC.plans.sync(s); PC.levels.ids(s).forEach((id) => { s.plans[id].approved = true; });
  st = PC.stages.status(s);
  assert.deepEqual([st[4].reachable, st[5].reachable], [true, true]);
  assert.equal(PC.stages.skipTarget(s), 5);
  PC.stages.MAX_BUILT = 4; st = PC.stages.status(s);
  assert.equal(st[5].reachable, false); assert.equal(st[5].reason, 'Not available in this build yet');
  assert.equal(PC.stages.skipTarget(s), 4);
});

test('clamp and skipTarget', () => {
  const PC = setup(), s = PC.sample.state(), plan = (id) => ({ sig: PC.sig.level(s, id), rooms: [], unmet: [], edited: false, approved: true, error: null });
  s.stage = 5; assert.equal(PC.stages.clamp(s), 3);
  s.stage = 2; assert.equal(PC.stages.clamp(s), 2);
  assert.equal(PC.stages.skipTarget(s), 3);
  s.plans = { G: plan('G'), 1: plan('1') };
  s.stage = 5; assert.equal(PC.stages.clamp(s), 5); assert.equal(PC.stages.skipTarget(s), 5);
  const e = PC.store.defaults(); e.stage = 4; assert.equal(PC.stages.clamp(e), 1);
});

test('Next labels: one table', () => {
  const PC = setup();
  assert.deepEqual(plain(PC.stages.TEXT.next), { 1: 'Next: Questions', 2: 'Next: Floor plans', 3: 'Next: Interior', 4: 'Build 3D model' });
});

test('small-plot reason follows the unit (R4)', () => {
  const PC = setup(), s = PC.store.defaults();
  s.plot = rect(7, 7);
  assert.equal(PC.stages.status(s)[1].reason, 'The plot is too small (minimum 50 m\u00B2)');
  assert.equal(PC.stages.status(s)[2].reason, 'The plot is too small (minimum 50 m\u00B2)');
  s.ans.unit = 'ft';
  assert.equal(PC.stages.status(s)[1].reason, 'The plot is too small (minimum 538 sq ft)');
});
