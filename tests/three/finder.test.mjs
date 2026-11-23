// F5-T1 room finder against the strict THREE mock with a controllable frame clock (F5-S1; A-12 / A-14 as built;
// F5-T1 plan section 6 and plan review items 1-6, rulings Q1-Q5): flights land on the A-14 pose, redirect from the
// interpolated pose, cancel before the input delta, dt capped at 100 ms, idle afterwards; Roof off, the room's level,
// groundCap for a basement room; the highlight frame; the session look untouched; close / rebuild clear the selection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened } from '../helpers/scene3d.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';
import { itemsOf, rgbOf, sameRgb } from '../helpers/batch.mjs';
import { plain } from '../helpers/load.mjs';

const D = Math.PI / 180;
const V = (E) => E.PC.view3d;
const pose = (E) => V(E).pose();
// Runs frames of `ms` each until the flight ends (or n frames): returns the poses of every frame.
function fly(E, ms = 16, n = 400) {
  const out = [];
  for (let i = 0; i < n && V(E).flying(); i++) { E.raf.tick(ms); out.push(pose(E)); }
  return out;
}
const centre = (E, id) => { const f = E.PC.cam.roomOf(E.house, id), r = f.room; return [E.X(r.u + r.w / 2), f.level.baseY + 0.2 + 0.5, E.Z(r.v + r.d / 2)]; };
const near = (a, b, e = 0.01) => a.every((x, i) => Math.abs(x - b[i]) <= e);
const eye = (E, p) => E.PC.cam.position(p);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const groups = (E) => Object.fromEntries(E.world.children.filter((g) => g.name.startsWith('level-') || g.name === 'roof').map((g) => [g.name, g.visible]));

test('goTo: Roof off, the room\'s level on top, flight of 1.2 s to the A-14 pose (target within 0.01 m), then idle', () => {
  const E = opened(maxHouse);
  V(E).setRoof(true);
  const id = E.house.levels.find((l) => l.id === '1').rooms[3].id, p0 = pose(E);
  assert.equal(E.PC.three.finder.goTo(id), true);
  assert.deepEqual([E.info().roof, E.info().level], [false, '1']);
  assert.deepEqual(groups(E), { 'level-B': true, 'level-G': true, 'level-1': true, 'level-2': false, roof: false });
  assert.equal(E.world.getObjectByName('groundCap').visible, true);
  const f = E.info().flight;
  assert.equal(f.ms, 1200);
  const frames = fly(E);
  const t = frames.length * 16 - 16;              // the first frame of a flight has dt 0
  assert.ok(t >= 1200 && t < 1216, 'lands after 1.2 s: ' + t);
  const p = pose(E);
  assert.ok(near(p.target, centre(E, id)), JSON.stringify(p.target));
  assert.ok(Math.abs(p.theta - p0.theta) < 1e-9 && Math.abs(p.phi - 35 * D) < 1e-9);
  assert.deepEqual(plain(p), plain(f.to), 'exactly `to` at the end');
  assert.equal(V(E).flying(), false);
  E.raf.tick(16);
  assert.equal(E.raf.pending(), 0, 'idle: no frame requested after the flight');
  const r = E.mock.raw(E.info().renderer).renders; E.raf.tick(16); E.raf.tick(16);
  assert.equal(E.mock.raw(E.info().renderer).renders, r);
});

test('a basement room: level B, the ground opened (groundCap hidden), upper levels hidden, phi 15, target below ground; eye >= 1 m on every frame', () => {
  const E = opened(maxHouse), b = E.house.levels.find((l) => l.id === 'B');
  for (const r of [b.rooms[0], b.rooms[9]]) {
    E.PC.three.finder.goTo(r.id);
    assert.equal(E.world.getObjectByName('groundCap').visible, false);
    assert.deepEqual(groups(E), { 'level-B': true, 'level-G': false, 'level-1': false, 'level-2': false, roof: false });
    for (const p of fly(E)) assert.ok(eye(E, p)[1] >= 1 - 1e-9, 'eye ' + eye(E, p)[1]);
    const p = pose(E);
    assert.ok(near(p.target, centre(E, r.id)) && p.target[1] < 0, 'target below ground (ruling Q1)');
    assert.ok(Math.abs(p.phi - 15 * D) < 1e-9);
  }
});

test('frames are smooth: no frame moves a pose parameter more than 1.5 x (its whole change) x dt / 1.2 s, each one monotone', () => {
  const E = opened(), id = 'r10', from = pose(E);
  E.PC.three.finder.goTo(id);
  const to = E.info().flight.to, frames = [from, ...fly(E)];
  const dTh = (a, b) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d <= -Math.PI) d += 2 * Math.PI; return d; };
  const comps = (p) => [p.target[0], p.target[1], p.target[2], p.radius, p.phi];
  const whole = comps(to).map((x, i) => x - comps(from)[i]), wTh = dTh(from.theta, to.theta);
  for (let k = 1; k < frames.length; k++) {
    const a = comps(frames[k - 1]), b = comps(frames[k]);
    whole.forEach((w, i) => {
      const d = b[i] - a[i];
      assert.ok(Math.abs(d) <= 1.5 * Math.abs(w) * 16 / 1200 + 1e-9, `frame ${k} comp ${i}: ${d} vs ${w}`);
      assert.ok(d * w >= -1e-12, `frame ${k} comp ${i} monotone`);
    });
    assert.ok(Math.abs(dTh(frames[k - 1].theta, frames[k].theta)) <= 1.5 * Math.abs(wTh) * 16 / 1200 + 1e-9);
  }
});

test('a second goTo mid-flight starts from the current interpolated pose: no jump across the redirect, lands on the new room', () => {
  const E = opened(maxHouse), L = E.house.levels, a = L[3].rooms[0].id, b = L[0].rooms[5].id;
  E.PC.three.finder.goTo(a);
  for (let i = 0; i < 30; i++) E.raf.tick(16);
  const mid = pose(E), eMid = eye(E, mid);
  assert.equal(V(E).flying(), true);
  E.PC.three.finder.goTo(b);
  assert.deepEqual(plain(E.info().flight.from), plain(mid), 'from = the interpolated pose');
  assert.equal(E.info().flight.t, 0);
  const frames = fly(E), path = dist(eMid, eye(E, E.info().flight ? E.info().flight.to : pose(E)));
  let prev = eMid, worst = 0;
  for (const p of frames) { const e = eye(E, p); worst = Math.max(worst, dist(prev, e)); prev = e; }
  // eye speed bound: smoothstep peaks at 1.5 x the mean speed; the orbit arc adds at most the radius x the angle
  const p = pose(E), arc = Math.abs(mid.theta - p.theta) * Math.max(mid.radius, p.radius) + Math.abs(mid.phi - p.phi) * Math.max(mid.radius, p.radius);
  assert.ok(worst <= 1.5 * (dist(mid.target, p.target) + Math.abs(mid.radius - p.radius) + arc) * 16 / 1200 + 1e-6, 'worst step ' + worst + ' path ' + path);
  assert.ok(near(p.target, centre(E, b)));
  assert.equal(E.info().selected, b);
});

test('an input cancels BEFORE its delta (plan review item 2): wheel = the interpolated pose x the zoom factor; pointer-down and keys cancel; the pose then stays', () => {
  for (const kind of ['wheel', 'pointer', 'key']) {
    const E = opened(), K = E.PC.C.CAM;
    E.PC.three.finder.goTo('r1');
    for (let i = 0; i < 25; i++) E.raf.tick(16);
    const mid = pose(E);
    if (kind === 'wheel') {
      E.canvas.dispatch('wheel', { deltaY: 100 });
      const p = pose(E);
      assert.ok(Math.abs(p.radius - mid.radius * Math.exp(100 * K.wheelK)) < 1e-9, 'radius = interpolated x factor');
      assert.deepEqual(plain(p.target), plain(mid.target)); assert.equal(p.theta, mid.theta);
    } else if (kind === 'pointer') {
      E.canvas.dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, clientX: 10, clientY: 10 });
      assert.deepEqual(plain(pose(E)), plain(mid));
      E.canvas.dispatch('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 10 });
      assert.ok(pose(E).theta < mid.theta && Math.abs(pose(E).radius - mid.radius) < 1e-9, 'the drag orbits from the interpolated pose');
      E.canvas.dispatch('pointerup', { pointerId: 1 });
    } else {
      E.canvas.dispatch('keydown', { key: 'ArrowLeft' });
      assert.ok(Math.abs(pose(E).theta - (mid.theta - K.keyDeg * D)) < 1e-9);
    }
    assert.equal(V(E).flying(), false, kind);
    const after = pose(E);
    for (let i = 0; i < 10; i++) E.raf.tick(16);
    assert.deepEqual(plain(pose(E)), plain(after), kind + ': the pose stops changing');
    assert.equal(E.raf.pending(), 0, kind + ': no frames requested');
    assert.equal(E.info().selected, 'r1', kind + ': a gesture keeps the selection (ruling Q3)');
  }
  // a key the canvas does not use does not cancel
  const E = opened();
  E.PC.three.finder.goTo('r1'); E.raf.tick(16);
  E.canvas.dispatch('keydown', { key: 'Tab' });
  assert.equal(V(E).flying(), true);
});

test('dt is the real frame delta capped at 100 ms: a 2 s gap is one 100 ms step; a hidden tab pauses and resumes with no jump', () => {
  const E = opened();
  E.PC.three.finder.goTo('r4');
  E.raf.tick(16); E.raf.tick(16);
  assert.equal(E.info().flight.t, 16);
  E.raf.tick(2000);
  assert.equal(E.info().flight.t, 116);
  E.doc.setVisible(false);
  assert.equal(E.raf.pending(), 0, 'hidden: no frame');
  E.raf.clock += 60000;
  E.doc.setVisible(true);
  E.raf.tick(16);
  assert.equal(E.info().flight.t, 216, 'back: one capped step, then it continues');
  fly(E);
  assert.ok(near(pose(E).target, centre(E, 'r4')));
});

test('the session look is never touched (TL rider): lights, background, materials and look() identical after goTo + flight at 22:00 winter', () => {
  const E = opened(), sc = E.info().scene;
  V(E).setLook({ hour: 22, season: 'winter' });
  const snap = () => { const s = sc.getObjectByName('sun'), h = sc.getObjectByName('hemi'), c = (x) => [x.r, x.g, x.b], bg = E.mock.raw(sc.background);
    return JSON.stringify([c(s.color), c(h.color), c(h.groundColor), s.intensity, h.intensity, [s.position.x, s.position.y, s.position.z], [bg.r, bg.g, bg.b],
      c(E.world.getObjectByName('canopies').material.color), E.world.getObjectByName('canopies').visible, c(E.world.getObjectByName('groundPlot').material.color), V(E).look(), E.info().looks]); };
  const before = snap();
  E.PC.three.finder.goTo('r12'); fly(E);
  E.PC.three.finder.goTo('r2'); E.raf.tick(16); E.raf.tick(16);
  E.canvas.dispatch('wheel', { deltaY: 40 });
  assert.equal(snap(), before);
});

test('the highlight (A-14): one mesh `highlight` in world, 4 bars on the room rectangle inside its walls, above the tint, #C2410C, no shadows', () => {
  const E = opened(maxHouse);
  for (const lv of E.house.levels) for (const r of [lv.rooms[0], lv.rooms[7]]) {
    E.PC.three.finder.goTo(r.id);
    const m = E.world.children.filter((c) => c.name === 'highlight');
    assert.equal(m.length, 1);
    assert.equal(m[0], E.info().highlight);
    assert.deepEqual([m[0].castShadow, m[0].receiveShadow, m[0].visible], [false, false, true]);
    const it = itemsOf(E.mock, m[0]), floorY = lv.baseY + 0.2, x0 = E.X(r.u), x1 = E.X(r.u + r.w), z0 = E.Z(r.v + r.d), z1 = E.Z(r.v);
    assert.deepEqual(it.map((i) => i.kind), ['box', 'box', 'box', 'box']);
    for (const b of it) {
      assert.ok(b.x0 >= x0 + 0.15 - 1e-4 && b.x1 <= x1 - 0.15 + 1e-4 && b.z0 >= z0 + 0.15 - 1e-4 && b.z1 <= z1 - 0.15 + 1e-4, `${r.name}: bar inside the room, clear of the walls`);
      assert.ok(Math.abs(b.y0 - (floorY + 0.02)) < 1e-4 && Math.abs(b.y1 - (floorY + 0.06)) < 1e-4, 'above the 0.015 m tint');
      assert.ok(Math.min(b.x1 - b.x0, b.z1 - b.z0) - 0.08 < 1e-4);
      assert.ok(sameRgb(b.top, rgbOf(E.PC, '#C2410C')) && sameRgb(b.side, rgbOf(E.PC, E.PC.data.siteColors.highlight)));
    }
    // the four bars close the frame on all four sides
    const ext = it.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
    assert.ok([ext.x0 - (x0 + 0.15), (x1 - 0.15) - ext.x1, ext.z0 - (z0 + 0.15), (z1 - 0.15) - ext.z1].every((d) => Math.abs(d) < 1e-4));
  }
  E.raf.tick(16); fly(E);
});

test('one highlight geometry per pick, the old one disposed exactly once; close() disposes the last and clears; nothing left over (ruling Q5)', () => {
  const E = opened(), made = [];
  for (const id of ['r1', 'r2', 'r9', 'r9']) { E.PC.three.finder.goTo(id); made.push(E.info().highlight); }
  const disposed = () => made.map((m) => E.mock.raw(E.mock.raw(m).geometry).disposed);
  assert.deepEqual(disposed(), [1, 1, 1, 0]);
  assert.equal(E.info().highlightsMade, 4);
  assert.equal(E.info().meshCount, 29, 'sample 28 (F6-T1a: + sky, paving, northNeedle; F6-T1b: + groundRing, blobs; F6-T1c: + roofDeck; F6-T2: + glazing, 2 x (textured, lamps, glow)) + highlight');
  const hm = E.mock.raw(E.mock.raw(made[3]).material);
  assert.deepEqual([hm.__kind, hm.toneMapped, hm.fog, hm.vertexColors], ['MeshBasicMaterial', false, false, true], 'F6-T1a / TL Q-T2: the highlight is unlit, not tone-mapped, not fogged');
  let cleared = 0; V(E).setOnSelect((x) => { if (x === null) cleared++; });
  V(E).close();
  assert.deepEqual(disposed(), [1, 1, 1, 1]);
  assert.deepEqual([E.info().selected, E.info().highlight, V(E).flying(), cleared, E.info().meshCount], [null, null, false, 1, 28]);
  assert.equal(E.world.getObjectByName('highlight'), undefined);
  // reopening (same house: no rebuild) neither resumes the flight nor brings the highlight back
  const p = pose(E);
  V(E).open(E.house, E.canvas, () => {}); E.raf.tick(16); E.raf.tick(16);
  assert.deepEqual([V(E).flying(), E.info().selected, E.info().builds], [false, null, 1]);
  assert.deepEqual(plain(pose(E)), plain(p));
});

test('a rebuild (new house, context restore) cancels the flight and clears the selection; Reset view cancels; clear() hides the highlight; unknown ids do nothing', () => {
  const E = opened();
  let cleared = 0; V(E).setOnSelect((x) => { if (x === null) cleared++; });
  E.PC.three.finder.goTo('r3'); E.raf.tick(16);
  const h = E.info().highlight;
  E.canvas.dispatch('webglcontextlost', {}); E.canvas.dispatch('webglcontextrestored', {});
  assert.deepEqual([V(E).flying(), E.info().selected, cleared, E.info().restores], [false, null, 1, 1]);
  assert.equal(E.mock.raw(E.mock.raw(h).geometry).disposed, 1);
  E.PC.three.finder.goTo('r3'); E.raf.tick(16);
  const other = E.PC.house.build(sampleApproved(E.PC, (d) => { d.ans.exterior = 'white'; }));
  V(E).open(other, E.canvas, () => {}); E.raf.flush(); E.timer.flush(); E.raf.flush();
  assert.deepEqual([V(E).flying(), E.info().selected, cleared], [false, null, 2]);
  E.PC.three.finder.goTo('r5'); E.raf.tick(16);
  V(E).resetView();
  assert.equal(V(E).flying(), false);
  assert.deepEqual(plain(pose(E)), plain(E.PC.cam.reset(other, 360 / 400)));
  E.PC.three.finder.clear();
  assert.deepEqual([E.info().selected, E.world.getObjectByName('highlight')], [null, undefined]);
  assert.equal(E.PC.three.finder.goTo('nope'), false);
  assert.equal(V(E).flying(), false);
});
