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
  let o2 = PC.house.openings(h);
  if (o.door === undefined) o2 = o2.filter((x) => x.kind !== 'door');   // the door sits off the footprint unless asked for
  // F6-T1c: hall panes (on free runs) are left out unless asked for, so the room-rule tests read rooms only
  return o.hall ? o2 : o2.filter((x) => x.kind !== 'glazed' || inRoom(h, x));
};
const sideRun = (h, r, s) => {
  const fp = h.footprint, at = { front: ['v', fp.v], back: ['v', fp.v + fp.d], left: ['u', fp.u], right: ['u', fp.u + fp.w] }[s];
  const lo = at[0] === 'v' ? r.v : r.u, hi = at[0] === 'v' ? r.v + r.d : r.u + r.w;
  if (Math.abs(lo - at[1]) > 1e-6 && Math.abs(hi - at[1]) > 1e-6) return null;
  return at[0] === 'v' ? [r.u, r.u + r.w] : [r.v, r.v + r.d];
};
const inRoom = (h, x) => h.levels.find((l) => l.id === x.level).rooms.some((r) => { const q = sideRun(h, r, x.side); return q && x.a >= q[0] - 1e-9 && x.b <= q[1] + 1e-9; });
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

test('built houses: v 3 (F6-T1c W1), openings deterministic and in the key; sample counts; max house within the Designer estimate', () => {
  const s = sampleApproved(PC), h = PC.house.build(s), h2 = PC.house.build(sampleApproved(PC));
  assert.equal(h.v, 4);   // F6-T2: v 4 (parts)
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
  // F6-T1c W1: sample 20 -> 24 (Designer prototype); every facade of every above-ground level of the maximum house has openings
  assert.equal(h.openings.length, 24, 'sample with hall panes');
  for (const lv of m.levels) if (lv.index >= 0) for (const sd of ['front', 'back', 'left', 'right']) assert.ok(m.openings.some((x) => x.level === lv.id && x.side === sd), `max ${lv.id} ${sd}`);
  // per side, openings on one level never overlap
  for (const hh of [h, m]) for (const lv of hh.levels) for (const sd of ['front', 'back', 'left', 'right']) {
    const l = hh.openings.filter((x) => x.level === lv.id && x.side === sd);
    for (let i = 1; i < l.length; i++) assert.ok(l[i].a >= l[i - 1].b - 1e-9, `${lv.id} ${sd} overlap`);
  }
});

test('F6-T1c W1 hall panes: free runs (side minus room, stair and lift runs) get n = max(1, floor((L - 0.6) / 3.9)) panes, evenly spaced, 0.6 m clear; none below 2.4 m; the door filter applies', () => {
  const P = O.hallPitch;
  assert.equal(P, 3.9);
  // a 20 m front with one 4 m bedroom at u 0..4: the free run 4..20 (16 m); other sides fully free
  for (const L of [2.39, 2.4, 3.9, 7.8, 12, 16]) {
    const o = mk([room('bedroom', 0, 0, 20 - L, 4)], { hall: true }).filter((x) => x.side === 'front' && x.a >= 20 - L - 1e-9);
    const want = L < O.win.w + 2 * O.endClear - 1e-9 ? 0 : Math.max(1, Math.floor((L - O.endClear) / P));
    assert.equal(o.length, want, `free run ${L}`);
    o.forEach((x, i) => {
      assert.ok(x.kind === 'glazed' && Math.abs(x.b - x.a - 1.2) < 1e-9 && x.sill === 0.9, 'win size');
      const c = (x.a + x.b) / 2, want = 20 - L + O.endClear + (L - 2 * O.endClear) * (i + 0.5) / o.length;
      assert.ok(Math.abs(c - want) < 1e-9, `free run ${L} even spacing`);
    });
  }
  // the stair keeps its slot and the lift is subtracted: a 20 m left side with the stair at v 2..5 and the lift at v 8..10
  const st = { u: 0, v: 2, w: 3, d: 3 }, lf = { u: 0, v: 8, w: 2, d: 2 };
  const left = mk([], { stair: st, lift: lf, hall: true }).filter((x) => x.side === 'left');
  assert.ok(left.every((x) => x.kind === 'slot' || x.b <= 2 + 1e-9 || (x.a >= 5 - 1e-9 && x.b <= 8 + 1e-9) || x.a >= 10 - 1e-9), 'no pane on the stair or lift runs');
  assert.ok(left.some((x) => x.kind === 'slot') && left.some((x) => x.kind === 'glazed' && x.a >= 5 && x.b <= 8), 'slot kept; the 3 m run between stair and lift has one pane');
  assert.equal(left.filter((x) => x.kind === 'glazed' && x.b <= 2 + 1e-9).length, 0, 'the 2 m run below the stair has none');
  // the door filter and the head clamp
  const d = mk([], { door: 10, hall: true, storeyH: 2.4 }).filter((x) => x.side === 'front');
  assert.ok(d.filter((x) => x.kind !== 'door').every((x) => x.b + 0.6 <= 9.5 + 1e-9 || x.a - 0.6 >= 10.5 - 1e-9) && d.every((x) => x.head <= 2.1 + 1e-9));
});
