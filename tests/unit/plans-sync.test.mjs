// F3-T1: PC.plans.sync (A-7): regenerates exactly the missing or stale levels, keeps the others, leaves plans alone
// while a signature is 'invalid', deletes plans of removed levels. Entering stage 3 syncs in the same nav commit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, loadWith, manifest, plain } from '../helpers/load.mjs';

const PC = loadCore();
const synced = () => { const s = plain(PC.sample.state()); PC.plans.sync(s); return s; };
const mark = (s) => { for (const id of Object.keys(s.plans)) { s.plans[id].edited = true; s.plans[id].approved = true; } return s; };
const changed = (a, b) => Object.keys(b.plans).filter((id) => JSON.stringify(a.plans[id]) !== JSON.stringify(b.plans[id])).sort();

test('the sample syncs to two valid Draft plans with no unmet pairs', () => {
  const s = synced();
  assert.deepEqual(Object.keys(s.plans).sort(), ['1', 'G']);
  for (const id of ['G', '1']) {
    const p = s.plans[id];
    assert.equal(p.sig, PC.sig.level(s, id)); assert.deepEqual([p.error, p.edited, p.approved, p.unmet], [null, false, false, []]);
    const inp = PC.plans.input(s, id), core = PC.layout.core(inp.W, inp.D, inp.stairs, inp.stairPos, inp.lift);
    assert.deepEqual(plain(PC.layout.check(inp.W, inp.D, core, inp.rooms, p.rooms)), []);
  }
  assert.ok(PC.draft.validState(s), 'a valid draft with plans');
});

test('only stale levels regenerate; edits and approval kept elsewhere', () => {
  const a = mark(synced()), b = plain(a);
  b.ans.rooms.find((r) => r.id === 'r9').size = 'L'; PC.plans.sync(b);
  assert.deepEqual(changed(a, b), ['1'], 'a first-floor room: only the first floor');
  assert.deepEqual([b.plans['1'].edited, b.plans['1'].approved, b.plans.G.approved], [false, false, true]);
  const c = plain(a); c.ans.footprintPct = 30; PC.plans.sync(c);
  assert.deepEqual(changed(a, c), ['1', 'G'], 'Q3: every level');
  const d = plain(a); d.ans.streetEdge = 2; PC.plans.sync(d);
  assert.deepEqual(changed(a, d), ['1', 'G'], 'Q6: every level');
  const e = plain(a); e.ans.setbacks.back = 2.25; PC.plans.sync(e);
  assert.deepEqual(changed(a, e), [], 'a setback change that only moves the footprint: none');
  const f = plain(a); f.ans.exterior = 'white'; f.ans.unit = 'ft'; PC.plans.sync(f);
  assert.deepEqual(changed(a, f), [], 'appearance: none');
});

test('removed levels lose their plan; an open plot (signature invalid) leaves stored plans alone', () => {
  const a = mark(synced()), b = plain(a);
  b.ans.floors = 1; PC.levels.prune(b); b.plans['1'] = a.plans['1'];         // a stray plan of a removed level
  PC.plans.sync(b);
  assert.deepEqual(Object.keys(b.plans), ['G']);
  const o = plain(a); o.plot.closed = false; o.ans.streetEdge = null; o.ans.edgeOv = {};
  PC.plans.sync(o);
  assert.deepEqual(plain(o.plans), plain(a.plans), 'nothing created, nothing replaced');
});

test('regenerate: a fresh Draft for one level only', () => {
  const a = mark(synced()), b = plain(a);
  assert.equal(PC.plans.regenerate(b, '1'), true);
  assert.deepEqual([b.plans['1'].edited, b.plans['1'].approved, b.plans.G.approved], [false, false, true]);
  assert.deepEqual(b.plans['1'].rooms, a.plans['1'].rooms, 'deterministic: the same layout');
});

test('entering stage 3: go(3) syncs in the same nav commit; timing on the sample and on a maximum house', () => {
  const P2 = loadCore(); P2.store.init(P2.sample.state()); P2.stages.MAX_BUILT = 3;
  P2.store.go(2);
  const notes = []; P2.store.subscribe((s, prev, meta) => notes.push(meta.nav));
  let t = Date.now(); assert.equal(P2.store.go(3), true); const tSample = Date.now() - t;
  assert.deepEqual(notes, [true], 'one nav commit');
  assert.equal(Object.keys(P2.store.get().plans).length, 2); assert.equal(P2.store.get().sampleClean, true);
  // maximum house: basement + 3 floors, 8 rooms each, lift, on a 30 x 30 m plot at 50 %
  const big = plain(P2.sample.state());
  big.plot = { pts: [[0, 0], [30, 0], [30, 30], [0, 30]], closed: true }; big.ans.streetEdge = 0; big.ans.footprintPct = 50; big.ans.vegPct = 10;
  big.ans.floors = 3; big.ans.basement = true; big.ans.lift = true; big.ans.rooms = []; big.ans.pairs = []; big.ans.nextRoomId = 1;
  for (const lv of ['B', 'G', '1', '2']) P2.levels.addRooms(big, { type: 'bedroom', level: lv, size: 'M', area: null, count: 8 });
  P2.store.replace(big); P2.store.go(2);
  t = Date.now(); assert.equal(P2.store.go(3), true); const tBig = Date.now() - t;
  assert.equal(Object.keys(P2.store.get().plans).length, 4);
  console.log(`  go(3): sample ${tSample} ms, maximum house (4 levels x 8 rooms + lift) ${tBig} ms`);
  assert.ok(tBig < 500, `maximum house ${tBig} ms (TL: over 500 ms must be raised)`);
});

test('no fail-open guards: without plans.js, entering stage 3 throws', () => {
  const files = manifest().js.filter((j) => (j.layer === 'core' || j.layer === 'data') && j.file !== 'js/core/plans.js').map((j) => j.file);
  const P3 = loadWith(files); P3.store.init(P3.sample.state()); P3.stages.MAX_BUILT = 3; P3.store.go(2);
  assert.throws(() => P3.store.go(3));
});

test('R5 (PM round 5): atRisk = affected levels with edits or an approval; the gate asks only for those', async () => {
  const P = loadCore(); P.store.init(P.sample.state()); P.stages.MAX_BUILT = 3; P.store.go(2); P.store.go(3); P.store.go(2);
  const asked = []; let answer = true; P.store.setConfirmHandler((q) => { asked.push(plain(q.levels)); return answer; });
  const cand = (f) => { const c = plain(P.store.get()); f(c); return c; }, bigger = (s) => { s.ans.footprintPct = 30; };
  assert.deepEqual(plain(P.store.affected(cand(bigger))), ['G', '1'], 'affected is unchanged: every valid plan');
  assert.deepEqual(plain(P.store.atRisk(cand(bigger))), [], 'untouched Drafts: nothing at risk');
  assert.equal(await P.store.propose(bigger), true);
  assert.deepEqual([asked, P.store.session.r5Confirmed], [[], false], 'no question, and the once-per-visit question is not used up');
  P.store.go(3); P.store.commit((s) => { s.plans.G.approved = true; }, { nav: true }); P.store.go(2);
  const before = P.store.get(); answer = false;
  assert.equal(await P.store.propose((s) => { s.ans.footprintPct = 25; }), false);
  assert.deepEqual(asked, [['G']], 'one approved + one untouched: names only the approved level');
  assert.equal(P.store.get(), before, 'Cancel restores');
  answer = true;
  assert.equal(await P.store.propose((s) => { s.ans.footprintPct = 25; }), true);
  assert.deepEqual([asked.length, P.store.get().ans.footprintPct, P.store.session.r5Confirmed], [2, 25, true], 'Continue applies and uses up the question');
  P.store.go(3); P.store.commit((s) => { s.plans['1'].edited = true; }, { nav: true });
  assert.deepEqual(plain(P.store.atRisk(cand((s) => { s.ans.rooms.find((r) => r.id === 'r9').size = 'L'; }))), ['1'], 'an edited plan is at risk too');
});
