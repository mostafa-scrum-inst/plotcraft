// PC.three.controls through PC.view3d on the stub canvas (A-12, F4-S2): pointer / wheel / key sequences move the pose
// the right way, prevent page scroll / zoom / menu, request one frame per input, and a lifted finger causes no jump.
import test from 'node:test';
import assert from 'node:assert/strict';
import { load3d } from '../helpers/load3d.mjs';
import { sampleApproved } from '../helpers/houses.mjs';

function env() {
  const E = load3d(), h = E.PC.house.build(sampleApproved(E.PC));
  E.PC.view3d.open(h, E.canvas, () => {});
  E.raf.flush(); E.timer.flush(); E.raf.flush();
  E.pose = () => E.PC.view3d.pose();
  E.ev = (type, p) => E.canvas.dispatch(type, Object.assign({ pointerId: 1, pointerType: 'touch', button: 0, clientX: 0, clientY: 0, shiftKey: false }, p));
  E.drag = (id, a, b, extra = {}) => {
    E.ev('pointerdown', { pointerId: id, clientX: a[0], clientY: a[1], ...extra });
    E.ev('pointermove', { pointerId: id, clientX: (a[0] + b[0]) / 2, clientY: (a[1] + b[1]) / 2, ...extra });
    E.ev('pointermove', { pointerId: id, clientX: b[0], clientY: b[1], ...extra });
    E.ev('pointerup', { pointerId: id, clientX: b[0], clientY: b[1], ...extra });
  };
  return E;
}

test('one finger / mouse left drag orbits: right -> theta decreases, down -> phi decreases; pointer captured', () => {
  const E = env(), p0 = E.pose();
  E.ev('pointerdown', { clientX: 100, clientY: 200 });
  assert.ok(E.canvas.captured.has(1));
  E.ev('pointermove', { clientX: 140, clientY: 200 });
  assert.ok(E.pose().theta < p0.theta && E.pose().radius === p0.radius);
  E.ev('pointerup', { clientX: 140, clientY: 200 });
  assert.ok(!E.canvas.captured.has(1));
  const p1 = E.pose();
  E.drag(2, [100, 200], [100, 230], { pointerType: 'mouse' });
  assert.ok(E.pose().phi < p1.phi);
  assert.deepEqual(E.pose().target, p1.target);
});

test('a mouse press focuses the canvas without scrolling (keys work after a click); touch does not (QA F4T1-2)', () => {
  const E = env();
  E.ev('pointerdown', { pointerType: 'touch' }); E.ev('pointerup', {});
  assert.equal(E.canvas.focused, null);
  E.ev('pointerdown', { pointerId: 2, pointerType: 'mouse' });
  assert.deepEqual({ ...E.canvas.focused }, { preventScroll: true });
  E.ev('pointerup', { pointerId: 2, pointerType: 'mouse' });
});

test('mouse right-drag and Shift+drag pan (target moves, radius / angles unchanged)', () => {
  for (const extra of [{ button: 2 }, { shiftKey: true }]) {
    const E = env(), p0 = E.pose();
    E.drag(1, [100, 100], [160, 100], { pointerType: 'mouse', ...extra });
    const p = E.pose();
    assert.notDeepEqual(p.target, p0.target);
    assert.deepEqual([p.radius, p.theta, p.phi], [p0.radius, p0.theta, p0.phi]);
    // content follows the pointer: dragging right moves the target along -right
    const right = [Math.cos(p0.theta), -Math.sin(p0.theta)], d = [p.target[0] - p0.target[0], p.target[2] - p0.target[2]];
    assert.ok(d[0] * right[0] + d[1] * right[1] < 0);
  }
});

test('two fingers: spreading zooms in, a parallel drag pans; lifting one finger causes no jump', () => {
  const E = env(), p0 = E.pose();
  E.ev('pointerdown', { pointerId: 1, clientX: 150, clientY: 200 });
  E.ev('pointerdown', { pointerId: 2, clientX: 210, clientY: 200 });
  E.ev('pointermove', { pointerId: 1, clientX: 120, clientY: 200 });
  E.ev('pointermove', { pointerId: 2, clientX: 240, clientY: 200 });
  const p1 = E.pose();
  assert.ok(p1.radius < p0.radius, 'pinch out zooms in');
  assert.equal(p1.theta, p0.theta, 'no orbit while two fingers are down');
  E.ev('pointermove', { pointerId: 1, clientX: 120, clientY: 240 });
  E.ev('pointermove', { pointerId: 2, clientX: 240, clientY: 240 });
  const p2 = E.pose();
  assert.notDeepEqual(p2.target, p1.target, 'parallel drag pans');
  assert.ok(Math.abs(p2.radius - p1.radius) < 1e-9);
  E.ev('pointerup', { pointerId: 2, clientX: 240, clientY: 240 });
  E.ev('pointermove', { pointerId: 1, clientX: 121, clientY: 240 });
  const p3 = E.pose();
  assert.ok(Math.abs(p3.theta - p2.theta) < 0.05, 'the remaining finger continues from where it is (1 px, not a jump)');
  E.ev('pointerup', { pointerId: 1, clientX: 121, clientY: 240 });
});

test('wheel zooms with preventDefault (passive: false); context menu suppressed', () => {
  const E = env(), p0 = E.pose();
  assert.equal(E.canvas.listeners('wheel')[0].o.passive, false);
  const w = E.canvas.dispatch('wheel', { deltaY: 100 });
  assert.ok(w.defaultPrevented && E.pose().radius > p0.radius);
  E.canvas.dispatch('wheel', { deltaY: -300 });
  assert.ok(E.pose().radius < p0.radius * Math.exp(100 * 0.0015));
  assert.ok(E.canvas.dispatch('contextmenu').defaultPrevented);
});

test('keys: arrows orbit, + / - zoom, all prevented; other keys untouched', () => {
  const E = env(), K = (key) => E.canvas.dispatch('keydown', { key });
  let p = E.pose(), e;
  e = K('ArrowLeft'); assert.ok(e.defaultPrevented && E.pose().theta < p.theta); p = E.pose();
  e = K('ArrowRight'); assert.ok(E.pose().theta > p.theta); p = E.pose();
  e = K('ArrowUp'); assert.ok(E.pose().phi < p.phi); p = E.pose();
  e = K('ArrowDown'); assert.ok(E.pose().phi > p.phi); p = E.pose();
  e = K('+'); assert.ok(e.defaultPrevented && E.pose().radius < p.radius); p = E.pose();
  e = K('-'); assert.ok(E.pose().radius > p.radius); p = E.pose();
  e = K('Tab'); assert.ok(!e.defaultPrevented); assert.deepEqual(E.pose(), p);
});

test('each input requests exactly one frame; many moves in one frame coalesce; clamps hold (no flip, no ground)', () => {
  const E = env(), n = E.raf.requested;
  E.ev('pointerdown', { clientX: 10, clientY: 10 });
  for (let i = 1; i <= 20; i++) E.ev('pointermove', { clientX: 10, clientY: 10 + i * 40 });
  assert.equal(E.raf.requested, n + 1);
  E.raf.flush();
  const p = E.pose(), eye = E.PC.cam.position(p);
  assert.ok(p.phi <= 85 * Math.PI / 180 + 1e-12 && p.phi >= 5 * Math.PI / 180 - 1e-12 && eye[1] >= 1 - 1e-9);
  E.ev('pointerup', { clientX: 10, clientY: 810 });
  let calls = 0; E.PC.view3d.setOnInput(() => calls++);
  E.canvas.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(calls, 1, 'onInput hook (F5 flight cancel)');
});
