// PC.house.build (A-9, CTO H3, F4-T1 plan §3): model = approved plans + PC.layout.core, refusal unless stage 3 is
// reachable and valid, Q14 convention in frame T, follows manual edits, never generates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';

const PC = loadCore();
const tRect = (h, r) => {   // L rectangle -> T bounds through PC.frames.l2t
  const a = PC.frames.l2t(h.center, r.u, r.v, 0), b = PC.frames.l2t(h.center, r.u + r.w, r.v + r.d, 0);
  return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[2], b[2]), z1: Math.max(a[2], b[2]) };
};
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('sample: 2 levels x 7 rooms, rooms = plan rectangles + footprint origin, storeys at Q8 + slab, stair identical', () => {
  const s = sampleApproved(PC), h = PC.house.build(s), fp = PC.site.analyse(s).footprint;
  assert.ok(h);
  assert.deepEqual(plain(h.levels.map((l) => [l.id, l.index, l.baseY, l.rooms.length])), [['G', 0, 0, 7], ['1', 1, 3.2, 7]]);
  assert.equal(h.storeyH, 3); assert.equal(h.pitch, 3.2);
  assert.deepEqual(plain(h.footprint), { u: fp.u, v: fp.v, w: fp.w, d: fp.d });
  const names = PC.levels.roomNames(s);
  for (const l of h.levels) {
    for (const r of l.rooms) {
      const p = s.plans[l.id].rooms.find((x) => x.id === r.id);
      assert.deepEqual([r.u, r.v, r.w, r.d], [fp.u + p.x, fp.v + p.y, p.w, p.h], r.id);
      assert.equal(r.name, names[r.id]); assert.equal(r.type, s.ans.rooms.find((x) => x.id === r.id).type);
      assert.ok(r.furniture.length > 0, r.id + ' furnished (F4-T2)');
    }
    const c = PC.layout.core(fp.w, fp.d, true, s.ans.stairPos, false).stair;
    assert.deepEqual(plain(l.stair), { u: fp.u + c.x, v: fp.v + c.y, w: c.w, d: c.h });
    assert.equal(l.lift, null);
  }
  assert.deepEqual(plain(h.levels[0].stair), plain(h.levels[1].stair));
  assert.deepEqual(plain(h.roof), { type: 'flat', usable: false, baseY: 6.4, stairHead: null, liftHead: null });
  assert.equal(h.exterior, 'sand'); assert.deepEqual(plain(h.interior), { style: 'modern', density: 'full' });
  assert.deepEqual(plain(h.site.entrance), { u: fp.u + fp.w / 2, v: fp.v, w: PC.C.HOUSE.door });
  assert.ok(h.site.parking && h.site.pool, 'sample has parking and pool rectangles');
  const site = PC.site.analyse(s), len = site.ptsL[(site.edge + 1) % site.ptsL.length][0];
  assert.deepEqual([plain(h.site.trees), plain(h.site.shrubs), plain(h.site.gate)], [[], [], { u: len / 2, w: 3 }], 'F4-T2: gate Centre on the street edge');
  assert.ok(h.site.seating && h.site.northMarker, 'F4-T2: the sample seating fits (PM round 10 Q8), north marker present');
  assert.equal(h.northDeg, PC.frames.northL(s));
  assert.ok(h.radius > 0 && h.plot.pts.length === 5);
});

test('Q14 in frame T (CTO H3): fl = min-X / max-Z (street side), br = max-X / min-Z, fr and bl the other two', () => {
  const want = { fl: ['x0', 'z1'], br: ['x1', 'z0'], fr: ['x1', 'z1'], bl: ['x0', 'z0'] };
  for (const pos of Object.keys(want)) {
    const s = sampleApproved(PC, (d) => { d.ans.stairPos = pos; d.ans.lift = true; }), h = PC.house.build(s);
    assert.ok(h, pos);
    const f = tRect(h, h.footprint), st = tRect(h, h.levels[0].stair), lf = tRect(h, h.levels[0].lift);
    const core = { x0: Math.min(st.x0, lf.x0), x1: Math.max(st.x1, lf.x1), z0: Math.min(st.z0, lf.z0), z1: Math.max(st.z1, lf.z1) };
    for (const k of want[pos]) assert.ok(near(core[k], f[k]), `${pos}: core ${k} ${core[k]} = footprint ${k} ${f[k]}`);
    const other = { x0: 'x1', x1: 'x0', z0: 'z1', z1: 'z0' };
    for (const k of want[pos]) assert.ok(!near(core[other[k]], f[other[k]]), `${pos}: not flush on ${other[k]}`);
  }
  // the street side is +Z in T: the footprint's front (v = fp.v) is its max Z
  const h = PC.house.build(sampleApproved(PC));
  assert.ok(near(PC.frames.l2t(h.center, 0, h.footprint.v, 0)[2], tRect(h, h.footprint).z1));
});

test('refuses (null) unless stage 3 is reachable and valid', () => {
  const ok = sampleApproved(PC);
  assert.ok(PC.house.build(ok));
  const un = plain(ok); un.plans.G.approved = false;
  assert.equal(PC.house.build(un), null, 'unapproved');
  const stale = plain(ok); stale.ans.footprintPct = 30;
  assert.equal(PC.house.build(stale), null, 'stale (Q3 changed, no sync)');
  const err = plain(ok); err.plans['1'].error = 'no-layout'; err.plans['1'].rooms = [];
  assert.equal(PC.house.build(err), null, 'no-layout');
  const open = plain(ok); open.plot.closed = false;
  assert.equal(PC.house.build(open), null, 'open plot');
  const conflict = plain(ok); conflict.ans.rooms.push(PC.store.room('r99', 'bedroom', 'G', 'L'));   // more rooms than the floor holds
  assert.ok(PC.validate.blocking(conflict).length > 0, 'precondition: a stage-2 blocking conflict');
  assert.equal(PC.house.build(conflict), null, 'stage-2 blocking conflict');
});

test('follows a manual edit (move + resize, then approve)', () => {
  const s = sampleApproved(PC), before = PC.house.build(s), fp = PC.site.analyse(s).footprint;
  const r = s.plans.G.rooms.find((x) => x.id === 'r6');
  // shrink from the left by 0.5 m (a resize that can never overlap a neighbour)
  assert.equal(PC.plans.applyEdit(s, 'G', { id: 'r6', x: r.x + 0.5, y: r.y, w: r.w - 0.5, h: r.h }).changed, true);
  assert.equal(s.plans.G.approved, false);
  assert.equal(PC.house.build(s), null, 'edited, not yet re-approved');
  s.plans.G.approved = true;
  const after = PC.house.build(s), p = s.plans.G.rooms.find((x) => x.id === 'r6'), m = after.levels[0].rooms.find((x) => x.id === 'r6');
  assert.deepEqual([m.u, m.v, m.w, m.d], [fp.u + p.x, fp.v + p.y, p.w, p.h]);
  assert.notEqual(after.key, before.key);
  for (const o of after.levels[0].rooms.filter((x) => x.id !== 'r6')) assert.deepEqual(plain(o), plain(before.levels[0].rooms.find((x) => x.id === o.id)));
});

test('basement, maximum house, roof base', () => {
  const m = maxHouse(PC), h = PC.house.build(m);
  assert.deepEqual(plain(h.levels.map((l) => [l.id, l.index, l.baseY])), [['B', -1, -h.pitch], ['G', 0, 0], ['1', 1, h.pitch], ['2', 2, 2 * h.pitch]]);
  assert.equal(h.roof.baseY, 3 * h.pitch);
  assert.ok(h.levels.every((l) => l.rooms.length === 10 && l.lift && l.stair), "CD-4: 10 rooms per level");
});

test('key: stable for the same state; changed by Q10, Q18, an edit; not by the unit or sampleClean', () => {
  const s = sampleApproved(PC), k = PC.house.build(s).key;
  assert.match(k, /^[0-9a-f]{8}$/);
  assert.equal(PC.house.build(plain(s)).key, k);
  const u = plain(s); u.ans.unit = 'ft'; u.sampleClean = false;
  assert.equal(PC.house.build(u).key, k);
  for (const f of [(d) => { d.ans.exterior = 'white'; }, (d) => { d.ans.interior.style = 'classic'; }, (d) => { d.plans.G.rooms[0].x += 0.01; }]) {
    const d = plain(s); f(d); assert.notEqual(PC.house.build(d).key, k);
  }
});

test('never generates or syncs; does not mutate (frozen state)', () => {
  const P2 = loadCore(), s = sampleApproved(P2);
  P2.layout.generate = () => { throw new Error('generate called'); };
  P2.plans.sync = () => { throw new Error('sync called'); };
  const freeze = (o) => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
  const h = P2.house.build(freeze(s));
  assert.ok(h);
  assert.deepEqual(JSON.parse(JSON.stringify(h)), plain(h));
});

test('TL item 2 (F4-T2 Q6): the refusal needs stage 3 reachable, not only valid (Q4 vegetation makes stage 2 invalid)', () => {
  const s = sampleApproved(PC);
  s.ans.vegPct = 80;                                                       // footprint 25 % + vegetation 80 % > 100 %
  assert.ok(plain(PC.validate.blocking(s)).length > 0, 'a blocking conflict on stage 2');
  const st = PC.stages.status(s);
  assert.deepEqual([st[3].valid, st[3].reachable], [true, false], 'plans fresh and approved, stage 3 not reachable');
  assert.equal(PC.house.build(s), null);
});
