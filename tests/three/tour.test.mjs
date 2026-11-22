// F5-T2 drone tour against the strict THREE mock with the controllable frame clock (F5-S2; A-14 as built; F5-T2 plan
// section 5 + plan review items 2-4, rulings Q1-Q9): the whole tour sampled at 60 fps on the sample, the maximum house,
// one room and a basement house: height over the tree tops, every room covered with its level on top, no jump, no
// sharp turn, Pause / Resume / speed / Stop / gesture / close / Reset / rebuild / finder pick, the look untouched,
// the mesh budget, the driver's end(reason) once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened } from '../helpers/scene3d.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';
import { plain } from '../helpers/load.mjs';

const FR = 1000 / 60;
const V = (E) => E.PC.view3d, TR = (E) => E.PC.three.tour;
const basement = (PC) => sampleApproved(PC, (d) => { d.ans.basement = true; for (const t of ['storage', 'laundry']) d.ans.rooms.push(PC.store.room('r' + d.ans.nextRoomId++, t, 'B', 'S')); });
const single = (PC) => sampleApproved(PC, (d) => { d.ans.floors = 1; d.ans.rooms = [d.ans.rooms.find((r) => r.level === 'G')]; d.ans.pairs = []; d.plans = {}; });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// starts a tour from the Reset pose (no lead-in) and records every frame until it ends
function run(E, o = {}) {
  const ends = [], stops = [];
  TR(E).start({ onStop: (s) => stops.push(s), onEnd: (r) => ends.push(r) });
  const frames = [];
  for (let i = 0; i < 20000 && TR(E).running(); i++) {
    E.raf.tick(FR);
    const p = V(E).pose(), st = TR(E).state();
    frames.push({ p, eye: E.PC.cam.position(p), tau: st.running ? st.tau : null, level: E.info().level, cap: E.world.getObjectByName('groundCap').visible, sel: E.info().selected, meshes: E.info().meshCount, stop: st.stop });
    if (o.each) o.each(i, frames[frames.length - 1]);
  }
  return { frames, ends, stops };
}

test('whole tour at 60 fps (sample, maximum house, one room, basement house): eye >= the tree-top floor, every room covered with its level on top, no jump, no sharp turn, then idle', () => {
  for (const st of [null, maxHouse, single, basement]) {
    const E = opened(st), plan = E.PC.tourplan.build(E.house, 360 / 400), floor = E.PC.tourplan.eyeFloor();
    const { frames, ends, stops } = run(E), tag = st ? st.name : 'sample';
    assert.deepEqual(ends, ['done'], tag);
    assert.ok(Math.abs(frames.length * FR / 1000 - plan.duration) < 0.1, `${tag}: ${frames.length} frames for ${plan.duration} s`);
    // height
    const low = frames.find((f) => f.eye[1] < floor - 1e-9);
    assert.equal(low, undefined, `${tag}: eye under the floor`);
    // coverage: a frame where the target is the room's look point within 0.5 m and the room's level is the top visible one
    for (const s of plan.stops.filter((x) => x.kind === 'room')) {
      const hit = frames.find((f) => dist(f.p.target, s.look) <= 0.5 && f.level === s.level && f.sel === s.id && (s.level !== 'B' || f.cap === false));
      assert.ok(hit, `${tag}: room ${s.id} never framed with its level shown`);
    }
    // the stop callbacks: one per stop after the start, in order
    assert.deepEqual(plain(stops.map((s) => s.kind === 'room' ? s.id : 'o')), plain(plan.stops.slice(1).map((s) => s.kind === 'room' ? s.id : 'o')));
    // no jump: per-frame eye step <= 3 x the mean eye speed (path length / time) of this leg or the one before x dt;
    // and consecutive steps differ by less than 25 %; no sharp turn: the
    // eye's direction turns less than 60 degrees between frames
    const s = plan.stops, legOf = (f) => Math.min(s.length - 1, E.PC.tourplan.target(plan, f.tau)), path = {};
    for (let i = 1; i < frames.length; i++) { const k = legOf(frames[i]); path[k] = (path[k] || 0) + dist(frames[i - 1].eye, frames[i].eye); }
    for (let i = 2; i < frames.length; i++) {
      const k = legOf(frames[i]), lm = (j) => j >= 1 && path[j] ? path[j] / (s[j].t - s[j - 1].t) : 0, mean = Math.max(lm(k), lm(k - 1));   // the speed is continuous across a stop
      const a = frames[i - 1].eye, b = frames[i].eye, c = frames[i - 2].eye, step = dist(a, b);
      assert.ok(step <= 3 * mean * FR / 1000 + 1e-6, `${tag}: frame ${i} step ${step.toFixed(3)} m, leg mean ${mean.toFixed(2)} m/s`);
      const prevStep = dist(c, a);
      if (prevStep > 1e-4) assert.ok(Math.abs(step - prevStep) <= 0.25 * prevStep + 0.02, `${tag}: speed jump at frame ${i}: ${prevStep.toFixed(4)} -> ${step.toFixed(4)}`);
      const u = [a[0] - c[0], a[1] - c[1], a[2] - c[2]], v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], nu = Math.hypot(...u), nv = Math.hypot(...v);
      if (nu > 0.005 && nv > 0.005) assert.ok((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (nu * nv) > 0.5, `${tag}: sharp turn at frame ${i}`);
    }
    assert.equal(frames[frames.length - 1].level, 'all', `${tag}: ends on the overview with All`);
    E.raf.tick(FR);
    assert.equal(E.raf.pending(), 0, `${tag}: idle after the tour`);
    assert.deepEqual([E.info().selected, E.info().roof], [null, false]);
  }
});

test('mesh budget: the maximum house stays at 22 meshes or fewer through the tour; one highlight geometry per room stop, each disposed once', () => {
  const E = opened(maxHouse), made = new Set();
  const { frames } = run(E, { each: () => { const h = E.info().highlight; if (h) made.add(h); } });
  assert.ok(frames.every((f) => f.meshes <= 22));
  assert.equal(made.size, 40);
  for (const m of made) assert.equal(E.mock.raw(E.mock.raw(m).geometry).disposed, 1);
});

test('Pause freezes the pose and requests no frames; Resume continues from the same point with dt 0; speed changes act without a jump', () => {
  const E = opened();
  TR(E).start({});
  for (let i = 0; i < 100; i++) E.raf.tick(FR);
  TR(E).pause(); E.raf.tick(FR);
  const p = V(E).pose(), tau = TR(E).state().tau;
  for (let i = 0; i < 5; i++) E.raf.tick(FR);
  assert.deepEqual(plain(V(E).pose()), plain(p)); assert.equal(TR(E).state().tau, tau); assert.equal(E.raf.pending(), 0, 'paused: no frames');
  assert.equal(TR(E).state().paused, true);
  E.raf.clock += 30000;
  TR(E).resume(); E.raf.tick(FR);
  assert.equal(TR(E).state().tau, tau, 'first frame after Resume has dt 0');
  E.raf.tick(FR);
  assert.ok(Math.abs(TR(E).state().tau - tau - FR / 1000) < 1e-9);
  // speed: fast advances tau 1.8 x
  const a = V(E).pose(), t0 = TR(E).state().tau;
  TR(E).setSpeed('fast'); E.raf.tick(FR);
  assert.ok(Math.abs(TR(E).state().tau - t0 - 1.8 * FR / 1000) < 1e-9);
  assert.ok(dist(E.PC.cam.position(a), E.PC.cam.position(V(E).pose())) < 0.5, 'no jump on a speed change');
  TR(E).setSpeed('slow'); E.raf.tick(FR);
  TR(E).setSpeed('normal');
  assert.equal(TR(E).speed(), 'normal');
});

test('Stop and a gesture end the tour once, leave the camera in place and return orbit control; a gesture while paused ends it too', () => {
  for (const how of ['stop', 'pointer', 'wheel', 'paused-key']) {
    const E = opened(), ends = [];
    TR(E).start({ onEnd: (r) => ends.push(r) });
    for (let i = 0; i < 300; i++) E.raf.tick(FR);
    if (how === 'paused-key') { TR(E).pause(); E.raf.tick(FR); }
    const p = V(E).pose();
    if (how === 'stop') TR(E).stop();
    else if (how === 'pointer') E.canvas.dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, clientX: 5, clientY: 5 });
    else if (how === 'wheel') E.canvas.dispatch('wheel', { deltaY: 50 });
    else E.canvas.dispatch('keydown', { key: 'ArrowLeft' });
    assert.deepEqual(ends, [how === 'stop' ? 'stop' : 'input'], how);
    assert.equal(TR(E).running(), false);
    if (how === 'stop' || how === 'pointer') assert.deepEqual(plain(V(E).pose()), plain(p), how + ': camera stays');
    for (let i = 0; i < 5; i++) E.raf.tick(FR);
    assert.equal(E.raf.pending(), 0);
    assert.equal(E.info().selected, null, how + ': highlight cleared');
    assert.notEqual(E.info().level, undefined);
    // orbit control from there
    const q = V(E).pose(); E.canvas.dispatch('keydown', { key: 'ArrowRight' });
    assert.ok(V(E).pose().theta > q.theta);
    if (how === 'pointer') E.canvas.dispatch('pointerup', { pointerId: 1 });
    TR(E).stop(); assert.equal(ends.length, 1, 'end exactly once');
  }
});

test('close() stops it and reopening does not restart it; Reset, a rebuild, a context restore and a finder pick end it (reasons); the lead-in flies to the overview first', () => {
  const E = opened(), ends = [];
  const go = () => { TR(E).start({ onEnd: (r) => ends.push(r) }); for (let i = 0; i < 30; i++) E.raf.tick(FR); };
  go(); V(E).close();
  V(E).open(E.house, E.canvas, () => {}); E.raf.tick(FR); E.raf.tick(FR);
  assert.equal(TR(E).running(), false);
  go(); V(E).resetView();
  go(); E.canvas.dispatch('webglcontextlost', {}); E.canvas.dispatch('webglcontextrestored', {});
  go(); E.PC.three.finder.goTo('r9');
  assert.equal(E.info().selected, 'r9', 'the pick keeps its own highlight');
  assert.ok(V(E).flying());
  assert.deepEqual(ends, ['close', 'reset', 'build', 'replaced']);
  // lead-in: from a pose away from the overview, the first 1.2 s fly to it and tau stays 0
  for (let i = 0; i < 200; i++) E.raf.tick(FR);
  TR(E).start({});
  assert.equal(TR(E).state().lead, true);
  for (let i = 0; i < 40; i++) E.raf.tick(FR);
  assert.equal(TR(E).state().tau, 0);
  for (let i = 0; i < 40; i++) E.raf.tick(FR);
  assert.equal(TR(E).state().lead, false);
  assert.ok(TR(E).state().tau > 0);
});

test('the look is never touched (rider): setLook mid-tour keeps the progress and the tour does not change the look; the tour never calls setLook', () => {
  const E = opened();
  V(E).setLook({ hour: 22, season: 'winter' });
  const looks0 = E.info().looks;
  TR(E).start({});
  for (let i = 0; i < 200; i++) E.raf.tick(FR);
  const tau = TR(E).state().tau;
  V(E).setLook({ hour: 8, season: 'spring' });
  assert.equal(TR(E).running(), true);
  assert.equal(TR(E).state().tau, tau);
  E.raf.tick(FR);
  assert.ok(TR(E).state().tau > tau);
  for (let i = 0; i < 400; i++) E.raf.tick(FR);
  assert.deepEqual(plain(V(E).look()), { hour: 8, season: 'spring' });
  assert.equal(E.info().looks, looks0 + 1, 'only my one setLook');
});

test('dt capped at 100 ms through a hidden tab; debugSeek changes only tau and the next frame follows; Roof forced off at Start', () => {
  const E = opened();
  V(E).setRoof(true);
  TR(E).start({});
  assert.equal(E.info().roof, false);
  E.raf.tick(FR); E.raf.tick(FR);
  const tau = TR(E).state().tau;
  E.doc.setVisible(false); E.raf.clock += 60000; E.doc.setVisible(true); E.raf.tick(FR);
  assert.ok(Math.abs(TR(E).state().tau - tau - 0.1) < 1e-9);
  const plan = TR(E).state().plan, s = plan.stops[5];
  assert.equal(E.PC.three.tour.debugSeek(s.t), true);
  assert.equal(TR(E).state().tau, s.t);
  E.raf.tick(0);
  assert.ok(dist(V(E).pose().target, s.look) < 1e-6);
  assert.equal(E.info().level, plan.stops[6].level, 'level of the stop being approached');
});
