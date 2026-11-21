// PC.cam (A-12 + TL F4-T1 rulings 1 and 9): clamps hold after 1000 random operations, aspect-aware reset frames the
// plot and is never clamped, pan / zoom / orbit directions, near plane, lerpPose shortest arc.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
import { sampleApproved } from '../helpers/houses.mjs';

const PC = loadCore(), C = PC.cam, D = Math.PI / 180;
const sample = PC.house.build(sampleApproved(PC));
function bigPlot() {
  const s = sampleApproved(PC, (d) => { d.plot.pts = [[0, 0], [100, 0], [100, 100], [0, 100]]; d.ans.footprintPct = 10; d.ans.vegPct = 10; });
  return PC.house.build(s);
}
const big = bigPlot();

test('1000 seeded random orbit / zoom / pan operations keep every limit (sample and a 100 x 100 m plot)', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (const [h, aspect] of [[sample, 0.5625], [big, 1.6]]) {
    const L = C.limits(h, aspect);
    let p = C.clamp(C.reset(h, aspect), L);
    for (let i = 0; i < 1000; i++) {
      const k = rnd();
      if (k < 0.35) p = C.orbit(p, (rnd() - 0.5) * 4, (rnd() - 0.5) * 4);
      else if (k < 0.6) p = C.zoom(p, Math.exp((rnd() - 0.5) * 4));
      else if (k < 0.9) p = C.pan(p, (rnd() - 0.5) * 2000, (rnd() - 0.5) * 2000, C.metresPerPx(p, 45, 400));
      else p = { target: [p.target[0], (rnd() - 0.2) * 40, p.target[2]], radius: p.radius, theta: p.theta, phi: p.phi };
      p = C.clamp(p, L);
      const eye = C.position(p), b = L.box;
      assert.ok(p.phi >= L.phiMin - 1e-12 && p.phi <= L.phiMax + 1e-12, 'phi ' + p.phi);
      assert.ok(p.radius >= L.rMin - 1e-9 && p.radius <= L.rMax + 1e-9, 'radius');
      assert.ok(p.target[0] >= b.x0 - 1e-9 && p.target[0] <= b.x1 + 1e-9 && p.target[2] >= b.z0 - 1e-9 && p.target[2] <= b.z1 + 1e-9, 'target in plot box');
      assert.ok(p.target[1] >= 0 && p.target[1] <= h.roof.baseY + 1e-9, 'target Y');
      assert.ok(eye[1] >= 1 - 1e-9, 'eye at least 1 m above ground: ' + eye[1]);
      assert.ok(p.theta > -Math.PI - 1e-12 && p.theta <= Math.PI + 1e-12);
    }
  }
});

test('reset: aspect-aware radius frames the plot circle in both half-angles; never clamped; A-12 angles', () => {
  for (const h of [sample, big]) for (const aspect of [0.5625, 1.6]) {
    const p = C.reset(h, aspect), L = C.limits(h, aspect);
    const hv = 22.5 * D, hh = Math.atan(Math.tan(hv) * aspect);
    assert.ok(p.radius * Math.sin(Math.min(hv, hh)) >= h.radius - 1e-9, `fits at aspect ${aspect}`);
    assert.ok(p.radius >= 2.2 * h.radius - 1e-9);
    assert.deepEqual(C.clamp(p, L), C.copy(p), 'reset pose is never clamped');
    assert.deepEqual(plain([p.target, p.theta, p.phi]), [[0, 0, 0], 30 * D, 50 * D]);
  }
  // landscape on a wide aspect falls back to 2.2 R when that already fits
  const wide = C.reset(sample, 3);
  assert.ok(wide.radius >= 2.2 * sample.radius);
});

test('directions: orbit, zoom, pan follow the pointer; eye position formula', () => {
  const p = { target: [0, 0, 0], radius: 10, theta: 0, phi: Math.PI / 2 };
  assert.deepEqual(plain(C.position(p).map((x) => Math.round(x * 1e9) / 1e9 + 0)), [0, 0, 10], 'theta 0 = street side +Z');
  assert.ok(C.position(C.orbit(p, 0.1, 0))[0] > 0, 'positive theta moves the eye to +X');
  assert.equal(C.zoom(p, 0.5).radius, 5);
  const r = C.pan(p, 10, 0, 0.1);           // drag right: target moves left (-X) when looking from +Z
  assert.ok(Math.abs(r.target[0] + 1) < 1e-12 && Math.abs(r.target[2]) < 1e-12);
  const f = C.pan(p, 0, 10, 0.1);           // drag down: target moves away from the eye (-Z)
  assert.ok(Math.abs(f.target[2] + 1) < 1e-12);
  const q = { target: [0, 0, 0], radius: 10, theta: Math.PI / 2, phi: 1 };   // eye on +X: right is -Z
  const r2 = C.pan(q, 10, 0, 0.1); assert.ok(Math.abs(r2.target[2] - 1) < 1e-12 && Math.abs(r2.target[0]) < 1e-12);
  assert.ok(Math.abs(C.metresPerPx(p, 45, 400) - 2 * 10 * Math.tan(22.5 * D) / 400) < 1e-12);
});

test('near plane follows the orbit radius (TL required item 9)', () => {
  assert.equal(C.near({ radius: 4 }), 0.5);
  assert.equal(C.near({ radius: 300 }), 6);
});

test('lerpPose: smoothstep, ends exact, shortest arc across +-PI', () => {
  const a = { target: [0, 0, 0], radius: 10, theta: 170 * D, phi: 0.5 }, b = { target: [4, 2, -2], radius: 20, theta: -170 * D, phi: 1 };
  assert.deepEqual(C.lerpPose(a, b, 0), C.copy(a));
  const e = C.lerpPose(a, b, 1); assert.ok(Math.abs(e.theta - b.theta) < 1e-12 && e.radius === 20);
  const m = C.lerpPose(a, b, 0.5); assert.ok(Math.abs(Math.abs(m.theta) - Math.PI) < 1e-9, 'passes through 180, not 0');
  assert.ok(Math.abs(C.lerpPose(a, b, 0.25).radius - (10 + 10 * 0.15625)) < 1e-12);
});
