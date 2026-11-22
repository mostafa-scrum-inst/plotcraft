// PC.tourplan (F5-T2; A-14 as built; F5-T2 plan section 2 + plan review items 2-3, rulings Q2-Q5): stop order,
// eye / look construction, the eye floor from the vegetation table, the nudge, leg times; PC.cam.fromEyeLook; the
// clamp does not bite at any stop; the debug seek is never called by product code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore, plain, SRC } from '../helpers/load.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';

const PC = loadCore(), P = PC.tourplan, K = PC.C.TOUR;
const sample = PC.house.build(sampleApproved(PC));
const maxH = PC.house.build(maxHouse(PC));
const basementH = PC.house.build(sampleApproved(PC, (d) => {
  d.ans.basement = true;
  for (const t of ['storage', 'laundry']) d.ans.rooms.push(PC.store.room('r' + d.ans.nextRoomId++, t, 'B', 'S'));
}));
const lowCeiling = PC.house.build(sampleApproved(PC, (d) => { d.ans.ceilingH = 2.4; }));
// one room: the sample with every room but the first removed from the programme
const single = PC.house.build(sampleApproved(PC, (d) => {
  d.ans.floors = 1; d.ans.rooms = [d.ans.rooms.find((r) => r.level === 'G')]; d.ans.pairs = []; d.plans = {};
}));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const rooms = (h) => h.levels.reduce((n, l) => n + l.rooms.length, 0);

test('eye floor (plan review item 2): (canopyY0 + canopyH) x scale max + treeGap, read from the table', () => {
  const v = PC.data.vegetation;
  assert.equal(P.eyeFloor(), (v.tree.canopyY0 + v.tree.canopyH) * v.scale[1] + K.treeGap);
  assert.ok(Math.abs(P.eyeFloor() - 5.33) < 1e-9, 'today 4.83 + 0.5');
  const old = v.scale[1]; v.scale[1] = 1.5;
  try { assert.ok(Math.abs(P.eyeFloor() - (4.2 * 1.5 + 0.5)) < 1e-9, 'follows the table'); } finally { v.scale[1] = old; }
});

test('stops: overview, every room exactly once, levels ascending (basement first), overview last; deterministic', () => {
  for (const h of [sample, maxH, basementH, single]) {
    const p = P.build(h, 0.5625), s = p.stops;
    assert.deepEqual([s[0].kind, s[s.length - 1].kind], ['overview', 'overview']);
    const r = s.slice(1, -1);
    assert.ok(r.every((x) => x.kind === 'room'));
    assert.equal(r.length, rooms(h));
    assert.equal(new Set(r.map((x) => x.id)).size, rooms(h), 'each room once');
    const idx = r.map((x) => h.levels.find((l) => l.id === x.level).index);
    assert.ok(idx.every((v, i) => !i || v >= idx[i - 1]), 'levels ascending');
    for (const x of r) assert.equal(PC.cam.roomOf(h, x.id).level.id, x.level);
    assert.deepEqual(plain(P.build(h, 0.5625)), plain(p), 'same plan twice');
  }
  assert.equal(P.build(maxH, 1).stops[1].level, 'B');
  assert.equal(P.build(basementH, 1).stops[1].level, 'B');
});

test('nearest-neighbour order: each next room on a level is the closest (XZ) to the previous stop\'s eye, ties by plan order', () => {
  for (const h of [sample, maxH]) {
    const s = P.build(h, 1).stops, X = (r) => r.u + r.w / 2 - h.center[0], Z = (r) => -(r.v + r.d / 2 - h.center[1]);
    for (let i = 1; i < s.length - 1; i++) {
      const lv = h.levels.find((l) => l.id === s[i].level), done = new Set(s.slice(1, i).map((x) => x.id));
      const left = lv.rooms.filter((r) => !done.has(r.id)), prev = s[i - 1].eye;
      const d = (r) => (X(r) - prev[0]) ** 2 + (Z(r) - prev[2]) ** 2, best = Math.min(...left.map(d));
      const first = left.find((r) => d(r) < best + 1e-9);
      assert.equal(s[i].id, first.id, `stop ${i}`);
    }
  }
});

test('eye and look per A-14: room eye outward at max(baseY, 0) + storeyH + 2.5 (basement: 1.5 m inward at storeyH + 4), never under the eye floor; look at floorY + 0.5', () => {
  const floor = P.eyeFloor();
  for (const h of [sample, maxH, basementH, lowCeiling]) {
    const fpc = [h.footprint.u + h.footprint.w / 2 - h.center[0], -(h.footprint.v + h.footprint.d / 2 - h.center[1])];
    for (const lv of h.levels) for (const r of lv.rooms) {
      const st = P.roomStop(h, lv, r), c = [r.u + r.w / 2 - h.center[0], -(r.v + r.d / 2 - h.center[1])];
      assert.deepEqual(plain(st.look), [c[0], lv.baseY + 0.2 + 0.5, c[1]]);
      const hz = Math.hypot(st.eye[0] - c[0], st.eye[2] - c[1]), out = Math.hypot(st.eye[0] - fpc[0], st.eye[2] - fpc[1]) - Math.hypot(c[0] - fpc[0], c[1] - fpc[1]);
      if (lv.index < 0) {
        assert.ok(Math.abs(hz - 1.5) < 1e-9 && st.eye[1] === Math.max(floor, h.storeyH + 4));
        assert.ok(out <= 1e-9, 'basement eye towards the footprint centre');
      } else {
        assert.ok(Math.abs(hz - (0.6 * Math.max(r.w, r.d) + 2)) < 1e-9);
        assert.equal(st.eye[1], Math.max(floor, Math.max(lv.baseY, 0) + h.storeyH + 2.5));
        assert.ok(out >= -1e-9, 'away from the footprint centre');
      }
      assert.ok(st.eye[1] >= floor);
    }
  }
  // the low ceiling lifts ground eyes to the floor (2.4 + 2.5 = 4.9 < 5.33)
  assert.equal(P.roomStop(lowCeiling, lowCeiling.levels[0], lowCeiling.levels[0].rooms[0]).eye[1], floor);
});

test('leg times (TL ruling Q2): rooms + 1 legs, overview legs 4 s, room legs 3.5 s; sample 53.5 s (30-90 s), maximum 144.5 s; no consecutive points closer than 0.5 m', () => {
  for (const [h, want] of [[sample, 53.5], [maxH, 144.5], [single, 8]]) {
    const p = P.build(h, 0.5625), s = p.stops;
    assert.equal(p.duration, want);
    assert.equal(s[0].t, 0);
    s.forEach((x, i) => { if (i) assert.equal(x.t - s[i - 1].t, i === 1 || i === s.length - 1 ? 4 : 3.5); });
    for (let i = 1; i < s.length; i++) { assert.ok(dist(s[i].eye, s[i - 1].eye) >= 0.5 - 1e-9); assert.ok(dist(s[i].look, s[i - 1].look) >= 0.5 - 1e-9); }
  }
  const d = P.build(sample, 1).duration;
  assert.ok(d >= 30 && d <= 90);
  for (const [k, f] of Object.entries(K.speeds)) assert.ok(d / f > 0, k);
  assert.deepEqual(plain(K.speeds), { slow: 0.6, normal: 1, fast: 1.8 });
  // one room: overview -> room -> overview
  assert.deepEqual(plain(P.build(single, 1).stops.map((x) => x.kind)), ['overview', 'room', 'overview']);
});

test('the nudge: a coincident point is moved 0.5 m along the leg (+X when equal)', () => {
  const h = JSON.parse(JSON.stringify(single)), r = h.levels[0].rooms[0];
  // centre the room on the reset target (0, 0): its look then coincides in XZ with the overview look
  r.u = h.center[0] - r.w / 2; r.v = h.center[1] - r.d / 2;
  const s = P.build(h, 1).stops;
  for (let i = 1; i < s.length; i++) assert.ok(dist(s[i].look, s[i - 1].look) >= 0.5 - 1e-9);
});

test('fromEyeLook round-trips with PC.cam.position', () => {
  for (const [e, l] of [[[3, 7, 9], [0, 0.7, 0]], [[-4, 5.3, -1], [2, -2.3, 1]], [[0, 9, 0.001], [0, 0, 0]]]) {
    const p = PC.cam.fromEyeLook(e, l), q = PC.cam.position(p);
    q.forEach((x, i) => assert.ok(Math.abs(x - e[i]) < 1e-9));
    assert.deepEqual(plain(p.target), l);
  }
});

test('the clamp does not bite at any stop (plan review item 3): fromEyeLook at each stop is unchanged by PC.cam.clamp', () => {
  for (const h of [sample, maxH, basementH, lowCeiling, single]) for (const aspect of [0.5625, 1.6]) {
    const L = PC.cam.limits(h, aspect);
    for (const s of P.build(h, aspect).stops) {
      const p = PC.cam.fromEyeLook(s.eye, s.look), q = PC.cam.clamp(p, L);
      assert.ok(Math.abs(p.radius - q.radius) < 1e-9 && Math.abs(p.phi - q.phi) < 1e-9 && Math.abs(p.theta - q.theta) < 1e-9 && p.target.every((x, i) => Math.abs(x - q.target[i]) < 1e-9), `${s.kind} ${s.id} @${aspect}`);
    }
  }
});

test('u(tau): stop i at i / (n - 1) exactly at its time, linear in a middle leg, the end legs eased; target = the stop being approached', () => {
  const p = P.build(sample, 1), n = p.stops.length;
  p.stops.forEach((s, i) => assert.ok(Math.abs(P.u(p, s.t) - i / (n - 1)) < 1e-12));
  assert.equal(P.target(p, 0), 1); assert.equal(P.target(p, 3.99), 1); assert.equal(P.target(p, 4), 2); assert.equal(P.target(p, p.duration), n - 1);
  // linear inside a middle leg; the first and last legs ease from / to rest (slope 0 at the tour's ends, 1 at the joins)
  const mid = (p.stops[3].t + p.stops[4].t) / 2;
  assert.ok(Math.abs(P.u(p, mid) - 3.5 / (n - 1)) < 1e-12);
  const d = 1e-6, slope = (t) => (P.u(p, t + d) - P.u(p, t - d)) / (2 * d) * (n - 1);
  assert.ok(Math.abs((P.u(p, d) - P.u(p, 0)) / d * (n - 1)) < 1e-4, 'starts at rest');
  assert.ok(Math.abs((P.u(p, p.duration) - P.u(p, p.duration - d)) / d * (n - 1)) < 1e-4, 'ends at rest');
  assert.ok(Math.abs(slope(4 - 2 * d) * 4 - 1) < 1e-4 && Math.abs(slope(4 + 2 * d) * 3.5 - 1) < 1e-4, 'slope 1 (per leg) at the first join');
});

test('PC.debug.tourSeek is debug-only (TL ruling Q8): only stage-3d.js defines it, only tour.js implements debugSeek, nothing else calls either', () => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js')) files.push(p); } };
  walk(join(SRC, 'js'));
  for (const f of files) {
    const t = readFileSync(f, 'utf8'), seek = (t.match(/tourSeek/g) || []).length, dbg = (t.match(/debugSeek/g) || []).length;
    if (f.endsWith('ui/stage-3d.js')) assert.deepEqual([seek, dbg], [1, 1], f);
    else if (f.endsWith('three/tour.js')) assert.ok(dbg >= 1, f);   // the implementation (and its header comment)
    else assert.deepEqual([seek, dbg], [0, 0], f);
  }
});
