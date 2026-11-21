// F4-T2 site group (A-10; plan §7; TL plan review required item 3; Designer plan 2-4) against the mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened, close } from '../helpers/scene3d.mjs';
import { sampleApproved } from '../helpers/houses.mjs';
import { rgbOf, sameRgb, windingProblems } from '../helpers/batch.mjs';

const st = (f) => (PC) => sampleApproved(PC, f);
const of = (E, items, key, src) => items.filter((i) => sameRgb(i.side, rgbOf(E.PC, (src || E.PC.data.siteColors)[key])));

test('siteBatch + poolWater: the flush water plane at Y 0.03 over exactly the pool, rotated -PI/2; rim 0.3 x 0.1 m outside it', () => {
  const E = opened(), g = E.world.getObjectByName('site'), q = E.house.site.pool;
  assert.deepEqual([...g.children].map((c) => c.name), ['trunks', 'canopies', 'shrubs', 'siteBatch', 'poolWater'], 'F4-T3: the instanced vegetation first');
  const w = E.mesh('poolWater');
  assert.equal(w.rotation.x, -Math.PI / 2); assert.equal(w.position.y, 0.03);
  assert.ok(close(w.position.x, E.X(q.u + q.w / 2)) && close(w.position.z, E.Z(q.v + q.d / 2)));
  assert.deepEqual(Array.from(E.mock.raw(w.geometry).params), [q.w, q.d]);
  const c = E.mock.raw(E.mock.raw(w.material).color);
  assert.ok(c.lin && sameRgb([c.r, c.g, c.b], rgbOf(E.PC, E.PC.data.siteColors.poolWater)));
  const rim = of(E, E.items('siteBatch'), 'poolRim').filter((i) => i.kind === 'box');
  assert.equal(rim.length, 4);
  assert.ok(rim.every((r) => close(r.y0, 0) && close(r.y1, 0.1)));
  const x0 = Math.min(...rim.map((r) => r.x0)), x1 = Math.max(...rim.map((r) => r.x1));
  assert.ok(close(x0, E.X(q.u - 0.3)) && close(x1, E.X(q.u + q.w + 0.3)));
  const off = opened(st((d) => { d.ans.pool.on = false; }));
  assert.equal(off.mesh('poolWater'), null, 'pool off: no water');
  const omitted = opened(st((d) => { d.ans.footprintPct = 50; d.ans.vegPct = 0; }));
  assert.ok(omitted.PC.site.analyse(omitted.state).omitted.includes('pool') && omitted.house.site.pool === null, 'the pool is omitted here');
  assert.equal(omitted.mesh('poolWater'), null, 'omitted: no water');
  assert.equal(of(omitted, omitted.items('siteBatch'), 'poolRim').filter((i) => i.kind === 'box').length, 0, 'omitted: no rim');
});

test('parking: one 0.02 m pad per car; covered adds 5 boxes (canopy at 2.4 m + 4 posts, carCanopy)', () => {
  const E = opened(), it = E.items('siteBatch'), p = E.house.site.parking, pads = of(E, it, 'paving').filter((i) => close(i.y1, 0.02));
  assert.equal(pads.length, p.cars);
  const can = of(E, it, 'carCanopy');
  assert.equal(can.length, p.covered ? 5 : 0);
  assert.ok(close(Math.max(...can.map((c) => c.y1)), 2.4));
  const open = opened(st((d) => { d.ans.parking.covered = false; }));
  assert.equal(of(open, open.items('siteBatch'), 'carCanopy').length, 0);
  assert.equal(open.items('siteBatch').length, it.length - 5);
});

test('boundary wall: one 1.2 x 0.2 m segment per edge centred 0.1 m inside it; the 3 m gate gap at 25 / 50 / 75 % of the street edge with 1.4 m trim posts; wall off: no wall, no posts', () => {
  for (const [gate, k] of [['left', 0.25], ['centre', 0.5], ['right', 0.75]]) {
    const E = opened(st((d) => { d.ans.extras.gate = gate; })), h = E.house, it = E.items('siteBatch'), pts = h.plot.pts, n = pts.length;
    const segs = it.filter((i) => i.kind === 'seg');
    assert.equal(segs.length, n + 1, 'the street edge in two pieces');
    const g = E.mock.raw(E.mock.raw(E.mesh('siteBatch')).geometry), pos = g.attrs.position.array;
    for (const s of segs) {
      assert.ok(close(s.y0, 0) && close(s.y1, 1.2) && sameRgb(s.side, rgbOf(E.PC, E.PC.data.siteColors.boundaryWall)));
      let cx = 0, cz = 0; for (let i = s.first; i < s.first + s.n; i++) { cx += pos[3 * i] / s.n; cz += pos[3 * i + 2] / s.n; }
      const u = cx + h.center[0], v = -cz + h.center[1];
      const d = pts.map((a, i) => { const b = pts[(i + 1) % n], du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv); return ((u - a[0]) * -dv + (v - a[1]) * du) / l; });
      const best = d.reduce((m, x) => (Math.abs(x) < Math.abs(m) ? x : m));
      assert.ok(close(best, 0.1, 1e-4), `centre line ${best} inside its edge`);
      assert.deepEqual(windingProblems(E.mock, E.mesh('siteBatch'), s), []);
    }
    const len = pts[1][0], gu = len * k, street = segs.filter((s) => close(s.z0, E.Z(0.2), 1e-4) && close(s.z1, E.Z(0), 1e-4));
    const gapL = Math.min(...street.map((s) => s.x1).filter((x) => x <= E.X(gu) + 1e-6)), gapR = Math.max(...street.map((s) => s.x0).filter((x) => x >= E.X(gu) - 1e-6));
    assert.ok(close(gapL, E.X(gu - 1.5), 1e-4) && close(gapR, E.X(gu + 1.5), 1e-4), `${gate}: gap ${gapL}..${gapR}`);
    const posts = of(E, it, 'trim', E.PC.data.exteriors[h.exterior]).filter((i) => close(i.y1, 1.4));
    assert.equal(posts.length, 2);
    assert.ok(posts.every((p) => close(p.x1 - p.x0, 0.4) && close(p.z1 - p.z0, 0.4)));
    assert.ok(close(posts[0].x1, E.X(gu - 1.5)) && close(posts[1].x0, E.X(gu + 1.5)), 'posts beside the gap');
  }
  const off = opened(st((d) => { d.ans.extras.wall = false; })), it = off.items('siteBatch');
  assert.equal(it.filter((i) => i.kind === 'seg').length, 0);
  assert.equal(of(off, it, 'trim', off.PC.data.exteriors[off.house.exterior]).filter((i) => close(i.y1, 1.4)).length, 0);
});

test('seating: pad 3 x 3 x 0.05 (paving), table 0.9 x 0.75 and two benches 0.9 m either side (seating); absent when off', () => {
  const E = opened(st((d) => { d.ans.extras.seating = true; })), it = E.items('siteBatch'), s = E.house.site.seating;
  assert.ok(s);
  const pad = of(E, it, 'paving').find((i) => close(i.y1, 0.05));
  assert.ok(pad && close(pad.x1 - pad.x0, 3) && close(pad.z1 - pad.z0, 3));
  const seat = of(E, it, 'seating');
  assert.equal(seat.length, 3);
  const table = seat.find((i) => close(i.y1, 0.8)), benches = seat.filter((i) => close(i.y1, 0.5));
  assert.ok(table && benches.length === 2);
  const cz = E.Z(s.v + s.d / 2);
  assert.deepEqual(benches.map((b) => ((b.z0 + b.z1) / 2 - cz).toFixed(3)).sort(), ['-0.900', '0.900']);
  assert.ok(benches.every((b) => close(b.x1 - b.x0, 1.6)), 'along u in the back yard');
  const no = opened(st((d) => { d.ans.extras.seating = false; }));
  assert.equal(of(no, no.items('siteBatch'), 'seating').length, 0);
});

test('entrance step: 1.2 x 0.6 x 0.15 m on the street side of the front wall (+Z), centred on the door (trim)', () => {
  const E = opened(), e = E.house.site.entrance, it = E.items('siteBatch');
  const step = it.find((i) => close(i.y1, 0.15) && close(i.x1 - i.x0, 1.2));
  assert.ok(step);
  assert.ok(close((step.x0 + step.x1) / 2, E.X(e.u)) && close(step.z0, E.Z(e.v)) && close(step.z1, E.Z(e.v) + 0.6));
});

test('north needle: two flat triangles 0.04 m high, N half northMarker / S half poolRim; the N tip is the A-13 north vector and turns by exactly dN', () => {
  const tip = (E) => { const n = E.PC.three.needle(E.house), m = E.house.site.northMarker, c = [E.X(m.u), E.Z(m.v)]; return [n.tipN[0] - c[0], n.tipN[1] - c[1]]; };
  const a = opened(), b = opened(st((d) => { d.ans.north = 45; }));
  for (const E of [a, b]) {
    const N = E.house.northDeg * Math.PI / 180, t = tip(E), L = E.house.site.northMarker.L;
    assert.ok(Math.abs(t[0] - Math.sin(N) * L / 2) < 1e-9 && Math.abs(t[1] + Math.cos(N) * L / 2) < 1e-9, 'tip = (sin N, -cos N) L / 2');
    const flats = E.items('siteBatch').filter((i) => i.kind === 'flat');
    assert.equal(flats.length, 2);
    assert.ok(flats.every((f) => close(f.y0, 0) && close(f.y1, 0.04)));
    assert.ok(sameRgb(flats[0].side, rgbOf(E.PC, E.PC.data.siteColors.northMarker)) && sameRgb(flats[1].side, rgbOf(E.PC, E.PC.data.siteColors.poolRim)));
    flats.forEach((f) => assert.deepEqual(windingProblems(E.mock, E.mesh('siteBatch'), f), []));
  }
  const ang = (t) => Math.atan2(t[0], -t[1]) * 180 / Math.PI, dN = b.house.northDeg - a.house.northDeg;
  assert.ok(Math.abs(((ang(tip(b)) - ang(tip(a)) - dN) % 360 + 540) % 360 - 180) < 1e-9, `turned by dN = ${dN}`);
});
