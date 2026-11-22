// PC.house.openings (F6-T1b, plan 6.1, Designer A2, TL Q-T9): house v 2, openings derived from the approved plans
// only (the layout golden is unchanged, C-6.5), inside the key, deterministic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';

const PC = loadCore(), O = PC.C.OPEN;
const HAB = ['living', 'dining', 'majlis', 'bedroom', 'office', 'kitchen'], SVC = ['bathroom', 'laundry', 'maid', 'storage'];
// a minimal one-level house for rule tests: rooms in L on a 20 x 12 footprint at (0, 0)
const mk = (rooms, o = {}) => {
  const h = {
    footprint: { u: 0, v: 0, w: 20, d: 12 }, storeyH: o.storeyH || 3,
    levels: [{ id: 'G', index: 0, rooms, stair: o.stair || null, lift: o.lift || null }].concat(o.extra || []),
    site: { entrance: { u: o.door === undefined ? 50 : o.door, v: 0, w: 1.2 } }
  };
  const o2 = PC.house.openings(h);
  return o.door === undefined ? o2.filter((x) => x.kind !== 'door') : o2;   // the door sits off the footprint unless asked for
};
const room = (type, u, v, w, d) => ({ id: type + u + v, type, u, v, w, d });

test('habitable runs: n = max(1, floor((run - 0.6) / 2.6)) panes 1.2 m wide, evenly spaced, 0.6 m clear of each end; none below 2.4 m', () => {
  for (const L of [2.39, 2.4, 3, 3.79, 5.8, 6.0, 8.4, 10.99, 13]) {
    const o = mk([room('bedroom', 0, 0, L, 4)]).filter((x) => x.side === 'front');
    const want = L < O.win.w + 2 * O.endClear ? 0 : Math.max(1, Math.floor((L - O.endClear) / O.pitch));
    assert.equal(o.length, want, `run ${L}`);
    o.forEach((x) => {
      assert.ok(Math.abs(x.b - x.a - 1.2) < 1e-9 && x.kind === 'glazed' && x.sill === 0.9 && Math.abs(x.head - 2.3) < 1e-9, `run ${L} size`);
      assert.ok(x.a >= 0.6 - 1e-9 && x.b <= L - 0.6 + 1e-9, `run ${L} clear of the ends`);
    });
    for (let i = 1; i < o.length; i++) {
      const gap = (o[i].a + o[i].b) / 2 - (o[i - 1].a + o[i - 1].b) / 2;
      assert.ok(Math.abs(gap - (L - 1.2) / o.length) < 1e-9, `run ${L} even spacing`);
      assert.ok(o[i].a - o[i - 1].b > 0.5, `run ${L} panes apart`);
    }
  }
  for (const t of HAB) assert.equal(mk([room(t, 0, 0, 6, 4)]).filter((x) => x.side === 'front').length, 2, t);
});

test('service runs: one 0.6 x 0.6 small pane at sill 1.6 when the run is longer than 1.2 m; other types none', () => {
  for (const t of SVC) {
    assert.equal(mk([room(t, 0, 0, 1.2, 4)]).filter((x) => x.side === 'front').length, 0, t + ' 1.2');
    const o = mk([room(t, 0, 0, 3, 4)]).filter((x) => x.side === 'front');
    assert.deepEqual(plain(o.map((x) => [x.kind, +(x.b - x.a).toFixed(9), x.sill, +x.head.toFixed(9), (x.a + x.b) / 2])), [['small', 0.6, 1.6, 2.2, 1.5]], t);
  }
  for (const t of ['hall', 'stair', 'lift']) assert.equal(mk([room(t, 0, 0, 8, 4)]).length, 0, t);
});

test('sides: front v = fp.v, back v = fp.v + fp.d, left u = fp.u, right u = fp.u + fp.w; inner rooms none; a corner room has two', () => {
  const o = mk([room('living', 0, 0, 6, 6), room('bedroom', 14, 6, 6, 6), room('office', 8, 4, 4, 4)]);
  assert.deepEqual(plain([...new Set(o.map((x) => x.side))].sort()), ['back', 'front', 'left', 'right']);
  assert.equal(o.filter((x) => (x.side === 'front' || x.side === 'back') && x.a >= 8 && x.b <= 12).length, 0, 'the inner office has none');
  assert.ok(o.filter((x) => x.side === 'left').every((x) => x.b <= 6), 'left runs along v of the living room');
});

test('stair slot on a side the stair touches; the lift none; the door at site.entrance drops openings within 0.6 m of its frame', () => {
  const st = { u: 0, v: 5, w: 3, d: 2 }, lf = { u: 18, v: 5, w: 2, d: 2 };
  const o = mk([], { stair: st, lift: lf });
  assert.deepEqual(plain(o.map((x) => [x.side, x.kind, x.a, x.b, x.sill, x.head])), [['left', 'slot', 5.7, 6.3, 0.5, 2.1]]);
  const d = mk([room('living', 0, 0, 12, 4)], { door: 6 }).filter((x) => x.side === 'front');
  const door = d.find((x) => x.kind === 'door');
  assert.deepEqual(plain([door.a, door.b, door.sill, door.head]), [5.5, 6.5, 0, 2.2]);
  assert.ok(d.filter((x) => x.kind !== 'door').every((x) => x.b + 0.6 <= 5.5 + 1e-9 || x.a - 0.6 >= 6.5 - 1e-9), 'clear of the door frame');
  assert.ok(d.length >= 2, 'the other panes stay');
});

test('heads clamped to storeyH - 0.3; basements have none', () => {
  const o = mk([room('living', 0, 0, 6, 4)], { storeyH: 2.4, extra: [{ id: 'B', index: -1, rooms: [room('storage', 0, 0, 6, 4)], stair: null }] });
  assert.ok(o.every((x) => x.head <= 2.1 + 1e-9 && x.level === 'G'));
});

test('built houses: v 2, openings deterministic and in the key; sample counts; max house within the Designer estimate', () => {
  const s = sampleApproved(PC), h = PC.house.build(s), h2 = PC.house.build(sampleApproved(PC));
  assert.equal(h.v, 2);
  assert.deepEqual(plain(h.openings), plain(h2.openings)); assert.equal(h.key, h2.key);
  const strip = JSON.parse(JSON.stringify(h)); strip.key = ''; strip.openings = [];
  assert.notEqual(PC.house.hash(JSON.stringify(strip)), h.key, 'the key covers the openings');
  const by = (hh) => hh.openings.reduce((m, x) => { m[x.kind] = (m[x.kind] || 0) + 1; return m; }, {});
  const c = by(h);
  assert.equal(c.door, 1);
  assert.ok(c.glazed >= 8 && c.glazed <= 40, `sample panes ${c.glazed}`);
  h.openings.forEach((x) => { assert.ok(x.b > x.a && x.head > x.sill && ['front', 'back', 'left', 'right'].includes(x.side)); });
  const m = PC.house.build(maxHouse(PC)), cm = by(m);
  assert.ok(m.openings.length <= 140 && m.openings.every((x) => x.level !== 'B'), `max house ${m.openings.length} openings ${JSON.stringify(cm)}`);
  // per side, openings on one level never overlap
  for (const hh of [h, m]) for (const lv of hh.levels) for (const sd of ['front', 'back', 'left', 'right']) {
    const l = hh.openings.filter((x) => x.level === lv.id && x.side === sd);
    for (let i = 1; i < l.length; i++) assert.ok(l[i].a >= l[i - 1].b - 1e-9, `${lv.id} ${sd} overlap`);
  }
});
