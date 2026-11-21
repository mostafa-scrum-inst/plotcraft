// The F4-T1 house shell against the mock (A-10, A-11, F4-T1 plan §5, TL ruling 6): ground planes and their rotation /
// offsets, slab + hall top face + room tints, Q10 / Q18 colours, partitions merged (independent oracle), entrance gap,
// stair / lift boxes, basement pit, tints follow an edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { load3d } from '../helpers/load3d.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';
import { itemsOf, rgbOf, sameRgb } from '../helpers/batch.mjs';
import { plain } from '../helpers/load.mjs';

function built(stateFn) {
  const E = load3d(), s = stateFn ? stateFn(E.PC) : sampleApproved(E.PC);
  E.house = E.PC.house.build(s);
  E.PC.view3d.open(E.house, E.canvas, () => {});
  E.raf.flush(); E.timer.flush(); E.raf.flush();
  E.world = E.PC.view3d.info().world;
  E.level = (id) => E.world.getObjectByName('level-' + id);
  E.items = (id, name) => itemsOf(E.mock, E.level(id).children.find((m) => m.name === name));
  return E;
}
const near = (a, b, e = 2e-5) => Math.abs(a - b) < e;   // positions are Float32 in the batch
const H = { slab: 0.2, wallH: 1.2, t: 0.15 };

test('ground: three planes rotated -PI/2 about X at the A-10 offsets; the plot shape has the footprint as its one hole', () => {
  const E = built(), g = E.world.getObjectByName('ground'), h = E.house, fp = h.footprint;
  const [outer, plot, cap] = ['groundOuter', 'groundPlot', 'groundCap'].map((n) => g.getObjectByName(n));
  for (const m of [outer, plot, cap]) { assert.equal(m.rotation.x, -Math.PI / 2); assert.equal(m.receiveShadow, true); assert.equal(m.castShadow, false); }
  assert.deepEqual(plain([outer.position.y, plot.position.y, cap.position.y]), [-0.05, 0, 0.01]);
  const sg = E.mock.raw(plot.geometry);
  assert.deepEqual(plain(sg.outline), plain(h.plot.pts.map((p) => [p[0] - h.center[0], p[1] - h.center[1]])));
  assert.equal(sg.holes.length, 1);
  const hole = plain(sg.holes[0]), cu = h.center[0], cv = h.center[1];
  assert.deepEqual(hole, [[fp.u - cu, fp.v - cv], [fp.u + fp.w - cu, fp.v - cv], [fp.u + fp.w - cu, fp.v + fp.d - cv], [fp.u - cu, fp.v + fp.d - cv]]);
  assert.deepEqual(plain(E.mock.raw(cap.geometry).params), [fp.w, fp.d]);
  assert.ok(near(cap.position.x, fp.u + fp.w / 2 - cu) && near(cap.position.z, -(fp.v + fp.d / 2 - cv)));
  const col = (m) => E.mock.raw(m.material.color), want = (hex) => rgbOf(E.PC, hex);
  assert.ok(sameRgb([col(plot).r, col(plot).g, col(plot).b], want(E.PC.data.siteColors.ground)));
  assert.ok(sameRgb([col(outer).r, col(outer).g, col(outer).b], want(E.PC.data.siteColors.groundOuter)));
});

test('slab: footprint box in the bottom 0.2 m, top face = mix(hall, wood, floorMix), sides = Q10 slab; tints at +0.015', () => {
  for (const [ext, style] of [['sand', 'modern'], ['white', 'classic'], ['terracotta', 'minimal'], ['grey', 'modern']]) {
    const E = built((PC) => sampleApproved(PC, (d) => { d.ans.exterior = ext; d.ans.interior.style = style; }));
    const h = E.house, fp = h.footprint, cu = h.center[0], cv = h.center[1], I = E.PC.data.interiors[style], RT = E.PC.data.roomTints;
    for (const lv of h.levels) {
      const it = E.items(lv.id, 'slab'), slab = it[0];
      assert.equal(it.filter((x) => x.kind === 'box').length, 1);
      assert.ok(near(slab.x0, fp.u - cu) && near(slab.x1, fp.u + fp.w - cu) && near(slab.z0, -(fp.v + fp.d - cv)) && near(slab.z1, -(fp.v - cv)));
      assert.ok(near(slab.y0, lv.baseY) && near(slab.y1, lv.baseY + H.slab));
      assert.ok(sameRgb(slab.top, rgbOf(E.PC, E.PC.three.mixHex(RT.hall, I.wood, I.floorMix))), `${ext}/${style} hall on the slab top`);
      assert.ok(sameRgb(slab.side, rgbOf(E.PC, E.PC.data.exteriors[ext].slab)), 'slab sides');
      const quads = it.filter((x) => x.kind === 'quad');
      assert.equal(quads.length, lv.rooms.length, 'one tint quad per room, no hall quad');
      lv.rooms.forEach((r, i) => {
        const q = quads[i];
        assert.ok(near(q.y0, lv.baseY + H.slab + 0.015) && near(q.y1, q.y0));
        assert.ok(near(q.x0, r.u - cu) && near(q.x1, r.u + r.w - cu) && near(q.z0, -(r.v + r.d - cv)) && near(q.z1, -(r.v - cv)), r.id);
        assert.ok(sameRgb(q.top, rgbOf(E.PC, E.PC.three.mixHex(RT[r.type], I.wood, I.floorMix))), r.id + ' tint');
      });
    }
  }
});

test('walls: exterior (Q10 wall), entrance gap on the Ground front wall only, stair box unmixed, all 1.2 m from the floor', () => {
  for (const ext of ['sand', 'white', 'terracotta', 'grey']) {
    const E = built((PC) => sampleApproved(PC, (d) => { d.ans.exterior = ext; })), h = E.house, fp = h.footprint, cu = h.center[0], cv = h.center[1];
    const X = E.PC.data.exteriors[ext], RT = E.PC.data.roomTints;
    for (const lv of h.levels) {
      const it = E.items(lv.id, 'walls'), floor = lv.baseY + H.slab;
      assert.ok(it.every((b) => near(b.y0, floor) && near(b.y1, floor + H.wallH)), 'wall height 1.2');
      const ext4 = it.filter((b) => sameRgb(b.side, rgbOf(E.PC, X.wall)));
      const frontZ = -(fp.v - cv), front = ext4.filter((b) => near(b.z1, frontZ));
      if (lv.index === 0) {
        assert.equal(front.length, 2, 'Ground front wall in two pieces');
        const gap = [Math.min(front[0].x1, front[1].x1), Math.max(front[0].x0, front[1].x0)];
        const e = h.site.entrance;
        assert.ok(near(gap[0], e.u - e.w / 2 - cu) && near(gap[1], e.u + e.w / 2 - cu), 'gap centred on the door, 1.2 m');
        assert.equal(ext4.length, 5);
      } else { assert.equal(front.length, 1); assert.equal(ext4.length, 4); }
      const st = it.filter((b) => sameRgb(b.side, rgbOf(E.PC, RT.stair)));
      assert.equal(st.length, 1, 'one stair box');
      const s = lv.stair;
      assert.ok(near(st[0].x0, s.u - cu) && near(st[0].x1, s.u + s.w - cu) && near(st[0].z0, -(s.v + s.d - cv)) && near(st[0].z1, -(s.v - cv)));
    }
  }
});

// Independent oracle for partitions: every interior room edge (not on the outline, not along the core block, not
// within the wall thickness of the outline) is covered by exactly one partition box, every partition box lies on a
// room edge line, and boxes on one line do not overlap (shared walls merged).
test('partitions: merged, on room edges only, covering every interior edge (sample and maximum house)', () => {
  for (const fn of [null, (PC) => maxHouse(PC), (PC) => maxHouse(PC, { stairPos: 'fl' })]) {
    const E = built(fn), h = E.house, fp = h.footprint, cu = h.center[0], cv = h.center[1], inner = rgbOf(E.PC, E.PC.data.exteriors[h.exterior].wallInner);
    for (const lv of h.levels) {
      const parts = E.items(lv.id, 'walls').filter((b) => sameRgb(b.side, inner));
      assert.ok(parts.length > 0);
      const lines = parts.map((b) => (near(b.x1 - b.x0, H.t) ? { axis: 'u', at: (b.x0 + b.x1) / 2 + cu, a: -b.z1 + cv, b: -b.z0 + cv } : { axis: 'v', at: -(b.z0 + b.z1) / 2 + cv, a: b.x0 + cu, b: b.x1 + cu }));
      const edges = [];
      for (const r of lv.rooms) edges.push(['u', r.u, r.v, r.v + r.d], ['u', r.u + r.w, r.v, r.v + r.d], ['v', r.v, r.u, r.u + r.w], ['v', r.v + r.d, r.u, r.u + r.w]);
      for (const L of lines) assert.ok(edges.some((e) => e[0] === L.axis && near(e[1], L.at, 0.006)), `${lv.id} partition on a room edge`);
      for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
        const p = lines[i], q = lines[j];
        if (p.axis === q.axis && near(p.at, q.at, 0.006)) assert.ok(Math.min(p.b, q.b) - Math.max(p.a, q.a) < 0.012, `${lv.id} no two boxes overlap on one line`);
      }
      const core = [lv.stair, lv.lift].filter(Boolean), t = H.t;
      const onCore = (axis, at, x) => core.some((c) => (axis === 'u' ? (near(c.u, at, 0.011) || near(c.u + c.w, at, 0.011)) && x > c.v - 0.011 && x < c.v + c.d + 0.011 : (near(c.v, at, 0.011) || near(c.v + c.d, at, 0.011)) && x > c.u - 0.011 && x < c.u + c.w + 0.011));
      for (const [axis, at, a, b] of edges) {
        const lo = axis === 'u' ? fp.u : fp.v, hi = axis === 'u' ? fp.u + fp.w : fp.v + fp.d;
        if (near(at, lo, 0.011) || near(at, hi, 0.011)) continue;
        const sLo = axis === 'u' ? fp.v + t : fp.u + t, sHi = axis === 'u' ? fp.v + fp.d - t : fp.u + fp.w - t;
        for (let k = 1; k < 10; k++) {
          const x = a + (b - a) * k / 10;
          if (x < sLo + 0.02 || x > sHi - 0.02 || onCore(axis, at, x)) continue;
          const cover = lines.filter((L) => L.axis === axis && near(L.at, at, 0.006) && x >= L.a - 1e-6 && x <= L.b + 1e-6);
          assert.equal(cover.length, 1, `${lv.id} edge ${axis}=${at} at ${x} covered once`);
        }
      }
    }
  }
});

test('stair and lift identical on every level; basement pit walls (Q10 slab) from the basement floor to ground level', () => {
  const E = built((PC) => maxHouse(PC)), h = E.house, RT = E.PC.data.roomTints, X = E.PC.data.exteriors[h.exterior];
  const key = (b) => [b.x0, b.x1, b.z0, b.z1].map((v) => v.toFixed(6)).join();
  const core = h.levels.map((lv) => E.items(lv.id, 'walls').filter((b) => sameRgb(b.side, rgbOf(E.PC, RT.stair)) || sameRgb(b.side, rgbOf(E.PC, RT.lift))).map(key).sort().join('|'));
  assert.ok(core.every((c) => c === core[0]) && core[0].split('|').length === 2);
  const B = h.levels[0], pit = E.items('B', 'walls').filter((b) => sameRgb(b.side, rgbOf(E.PC, X.slab)));
  assert.equal(pit.length, 4);
  assert.ok(pit.every((b) => near(b.y0, B.baseY + H.slab) && near(b.y1, 0)), 'pit walls reach Y 0');
  assert.ok(near(B.baseY + H.slab, -h.pitch + 0.2));
  assert.equal(E.items('B', 'walls').filter((b) => sameRgb(b.side, rgbOf(E.PC, X.wall))).length, 0, 'no exterior walls in the basement');
});

test('a moved room moves its tint quad', () => {
  const E1 = built(), r = E1.house.levels[0].rooms.find((x) => x.id === 'r6');
  const E2 = built((PC) => {
    const s = sampleApproved(PC), p = s.plans.G.rooms.find((x) => x.id === 'r6');
    PC.plans.applyEdit(s, 'G', { id: 'r6', x: p.x + 0.5, y: p.y, w: p.w - 0.5, h: p.h }); s.plans.G.approved = true;
    return s;
  });
  const i = E1.house.levels[0].rooms.indexOf(r), q1 = E1.items('G', 'slab').filter((x) => x.kind === 'quad')[i], q2 = E2.items('G', 'slab').filter((x) => x.kind === 'quad')[i];
  assert.ok(near(q2.x0 - q1.x0, 0.5) && near(q2.x1, q1.x1));
});
