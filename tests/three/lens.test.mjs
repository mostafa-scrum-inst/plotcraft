// F5-T3a desktop framing under the floating panel (TL F5-T3a plan review ruling 2, A-12 as amended): a lens shift
// (PerspectiveCamera.setViewOffset) into the uncovered rectangle; poses, pivot and clamps unchanged; the radius fits
// (reset, limits, the tour plan) use the visible aspect. Projection with tests/helpers/project.mjs (checked against real
// r128 in view3d-real's conformance).
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened } from '../helpers/scene3d.mjs';
import { maxHouse } from '../helpers/houses.mjs';
import { projectPx } from '../helpers/project.mjs';
import { plain } from '../helpers/load.mjs';

const FR = 1000 / 60;
const desk = (st) => { const E = opened(st); E.ro.trigger(1280, 800); E.raf.flush(); return E; };
const px = (E, p) => { const i = E.info(), q = E.PC.view3d.pose(); return projectPx(E.PC.cam.position(q), q.target, E.PC.C.CAM.fov, 1280, 800, i.viewOffset, p); };

test('setOcclusion(336) at 1280x800: setViewOffset(1616, 800, 336, 0, 1280, 800), aspect 1616 / 800, the target projects to x = 472 +- 1; the pose is not moved', () => {
  const E = desk(), p0 = plain(E.PC.view3d.pose()), cam = E.mock.raw(E.info().camera);
  assert.equal(E.info().viewOffset, null);
  assert.ok(!cam.view || !cam.view.enabled);
  E.PC.view3d.setOcclusion({ right: 336, bottom: 0 });
  assert.equal(E.raf.pending(), 1, 'one frame requested');
  E.raf.flush();
  assert.deepEqual(plain(E.info().viewOffset), [1616, 800, 336, 0, 1280, 800]);
  assert.deepEqual(plain(cam.view), { enabled: true, fullWidth: 1616, fullHeight: 800, offsetX: 336, offsetY: 0, width: 1280, height: 800 });
  assert.equal(cam.aspect, 1616 / 800);
  assert.deepEqual(plain(E.PC.view3d.pose()), p0, 'pose untouched (pivot stays on the target)');
  const t = px(E, p0.target);
  assert.ok(Math.abs(t[0] - 472) <= 1 && Math.abs(t[1] - 400) <= 1, `target at ${t.map((x) => x.toFixed(1))}`);
  assert.ok(Math.abs(E.info().aspect - 944 / 800) < 1e-12, 'visible aspect');
  // a second identical call does nothing; 0 clears the offset
  E.PC.view3d.setOcclusion({ right: 336 }); assert.equal(E.raf.pending(), 0);
  E.PC.view3d.setOcclusion({ right: 0 }); E.raf.flush();
  assert.equal(E.info().viewOffset, null); assert.equal(cam.view.enabled, false); assert.equal(cam.aspect, 1280 / 800);
  const c = px(E, p0.target); assert.ok(Math.abs(c[0] - 640) <= 1);
});

test('Reset and the tour plan fit the visible aspect; the lens survives a resize', () => {
  const E = desk(), h = E.house;
  E.PC.view3d.setOcclusion({ right: 336 }); E.PC.view3d.resetView(); E.raf.flush();
  assert.equal(E.PC.view3d.pose().radius, E.PC.cam.resetRadius(h, 944 / 800));
  assert.ok(E.PC.cam.resetRadius(h, 944 / 800) >= E.PC.cam.resetRadius(h, 1280 / 800));
  assert.equal(E.PC.view3d.limits().rMax, E.PC.cam.limits(h, 944 / 800).rMax);
  // the plot's bounding circle projects inside the uncovered rectangle after Reset (centre within 1 px of x = 472)
  for (let a = 0; a < 8; a++) {
    const p = [h.radius * Math.cos(a * Math.PI / 4), 0, h.radius * Math.sin(a * Math.PI / 4)], q = px(E, p);
    assert.ok(q[0] >= 0 && q[0] <= 944 && q[1] >= 0 && q[1] <= 800, `circle point ${a} at ${q.map((x) => x.toFixed(0))}`);
  }
  E.PC.three.tour.start({}); E.raf.tick(FR);
  const plan = E.PC.three.tour.state().plan;
  assert.equal(PCdist(E.PC.cam.position(E.PC.cam.reset(h, 944 / 800)), plan.stops[0].eye) < 1e-9 || plan.stops[0].eye[1] === plan.eyeFloor, true, 'overview from the visible-aspect Reset');
  E.PC.three.tour.stop();
  E.ro.trigger(1200, 800); E.raf.flush();
  assert.deepEqual(plain(E.info().viewOffset), [1536, 800, 336, 0, 1200, 800]);
});
function PCdist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

test('a finder pick on the widest room of the maximum house: its four floor corners project into the uncovered rectangle', () => {
  const E = desk(maxHouse), h = E.house;
  E.PC.view3d.setOcclusion({ right: 336 }); E.raf.flush();
  let best = null;
  for (const lv of h.levels) for (const r of lv.rooms) if (!best || r.w > best.r.w) best = { r, lv };
  E.PC.three.finder.goTo(best.r.id);
  for (let i = 0; i < 120 && E.PC.view3d.flying(); i++) E.raf.tick(FR);
  const { r, lv } = best, y = lv.baseY + E.PC.C.HOUSE.slab, X = (u) => u - h.center[0], Z = (v) => -(v - h.center[1]);
  for (const [u, v] of [[r.u, r.v], [r.u + r.w, r.v], [r.u, r.v + r.d], [r.u + r.w, r.v + r.d]]) {
    const q = px(E, [X(u), y, Z(v)]);
    assert.ok(q[0] >= 0 && q[0] <= 944 && q[1] >= 0 && q[1] <= 800 && q[2] > 0, `${r.id} corner at ${q.map((x) => x.toFixed(0))}`);
  }
});

test('a context restore keeps the lens', () => {
  const E = desk();
  E.PC.view3d.setOcclusion({ right: 336 }); E.raf.flush();
  const c = E.canvas;
  c.dispatch('webglcontextlost', {}); c.dispatch('webglcontextrestored', {});
  E.raf.flush(); E.timer.flush(); E.raf.flush();
  const cam = E.mock.raw(E.info().camera);
  assert.ok(cam.view && cam.view.enabled && cam.view.offsetX === 336, 'restored camera has the offset');
});
