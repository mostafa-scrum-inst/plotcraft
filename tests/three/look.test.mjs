// F4-T3: PC.three.applyLook / PC.view3d.setLook (A-13, A-11; plan section 5; TL F4-T3 plan review Q4 / Q5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened } from '../helpers/scene3d.mjs';
import { sampleApproved } from '../helpers/houses.mjs';
import { plain } from '../helpers/load.mjs';

const eqc = (a, b) => ['r', 'g', 'b'].every((c) => Math.abs(a[c] - b[c]) < 1e-9);
function snapshot(E) {
  const objs = []; E.info().scene.traverse((o) => objs.push(o));
  const cam = E.info().camera;
  return { objs, geos: E.mock.created.geometries.length, mats: E.mock.created.materials.length, disposed: E.mock.created.geometries.reduce((n, g) => n + g.disposed, 0) + E.mock.created.materials.reduce((n, m) => n + m.disposed, 0),
    pose: JSON.stringify(E.PC.view3d.pose()), cam: [cam.position.x, cam.position.y, cam.position.z, cam.near, cam.far].join(), builds: E.info().builds };
}

test('setLook: lights, background, ground / canopy / shrub colours and canopy visibility follow PC.sky.compute; nothing created, disposed or moved', () => {
  const E = opened(), PC = E.PC, sc = E.info().scene, before = snapshot(E), col = (h) => PC.three.col(h);
  const outer = E.world.getObjectByName('groundOuter').material.color.clone(), trunk = E.world.getObjectByName('trunks').material.color.clone();
  for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const hour of [0, 6, 8, 12, 17.5, 22, 24]) {
    PC.view3d.setLook({ hour, season });
    const L = PC.sky.compute(hour, season, E.house.northDeg), sun = sc.getObjectByName('sun'), hemi = sc.getObjectByName('hemi');
    const at = `${season} ${hour}`;
    assert.ok(eqc(sun.color, col(L.sunColor)) && eqc(hemi.color, col(L.hemiSky)) && eqc(hemi.groundColor, col(L.hemiGround)), at);
    assert.deepEqual([sun.intensity, hemi.intensity], [L.sunIntensity, L.hemiIntensity], at);
    const bg = E.mock.raw(sc.background); assert.equal(bg.lin, false, 'background raw');
    assert.ok(Math.abs(bg.r - parseInt(L.background.slice(1, 3), 16) / 255) < 1e-9, at);
    const t = sun.target.position, p = sun.position, d = [p.x - t.x, p.y - t.y, p.z - t.z], len = Math.hypot(...d);
    assert.ok(d.every((x, j) => Math.abs(x / len - L.sunDir[j]) < 1e-9), at + ' direction');
    assert.ok(Math.abs(len - PC.C.VIEW3D.sunDist * E.house.radius) < 1e-9);
    assert.ok(eqc(E.world.getObjectByName('groundPlot').material.color, col(L.groundColor)), at + ' plot ground');
    assert.ok(eqc(E.world.getObjectByName('canopies').material.color, col(L.canopyColor)) && eqc(E.world.getObjectByName('shrubs').material.color, col(L.shrubColor)));
    assert.equal(E.world.getObjectByName('canopies').visible, season !== 'winter', at + ' canopies');
    assert.ok(eqc(E.world.getObjectByName('groundOuter').material.color, outer) && eqc(E.world.getObjectByName('trunks').material.color, trunk), 'groundOuter / trunk unchanged');
    assert.deepEqual(plain(E.info().look), { hour, season });
  }
  const after = snapshot(E);
  assert.equal(after.objs.length, before.objs.length); assert.ok(after.objs.every((o, i) => o === before.objs[i]), 'same objects');
  assert.deepEqual([after.geos, after.mats, after.disposed, after.builds], [before.geos, before.mats, before.disposed, before.builds], 'no create / dispose / rebuild');
  assert.equal(after.pose, before.pose); assert.equal(after.cam, before.cam, 'camera untouched');
  let casters = 0; sc.traverse((o) => { if ((o.name === 'sun' || o.name === 'hemi') && o.castShadow) casters++; });
  assert.equal(casters, 1, 'one shadow light');
});

test('setLook marks the frame dirty only: one frame, no rebuild; invalid input keeps the stored values (hour clamped)', () => {
  const E = opened(), n = E.raf.requested, b = E.info().builds;
  E.PC.view3d.setLook({ hour: 17.5 });
  assert.equal(E.raf.requested, n + 1); assert.equal(E.info().builds, b);
  E.PC.view3d.setLook({ hour: NaN, season: 'monsoon' });
  assert.deepEqual(plain(E.PC.view3d.look()), { hour: 17.5, season: 'summer' });
  E.PC.view3d.setLook({ hour: 30 }); assert.equal(E.PC.view3d.look().hour, 24);
});

test('session look (Q5): a rebuild (Q18) and a context restore keep it; opens at 12:00 summer', () => {
  const E = opened(), PC = E.PC;
  assert.deepEqual(plain(PC.view3d.look()), { hour: 12, season: 'summer' });
  PC.view3d.setLook({ hour: 22, season: 'winter' });
  const h2 = PC.house.build(sampleApproved(PC, (d) => { d.ans.interior.style = 'classic'; }));
  PC.view3d.close(); PC.view3d.open(h2, E.canvas, () => {}); E.raf.flush(); E.timer.flush(); E.raf.flush();
  assert.equal(E.info().builds, 2);
  const sun = E.info().scene.getObjectByName('sun'), L = PC.sky.compute(22, 'winter', h2.northDeg);
  assert.ok(eqc(sun.color, PC.three.col(L.sunColor)) && sun.intensity === L.sunIntensity, 'rebuild keeps the look');
  assert.equal(E.world.getObjectByName('canopies').visible, false, 'winter canopies hidden after the rebuild');
  E.canvas.dispatch('webglcontextlost'); E.canvas.dispatch('webglcontextrestored');
  assert.deepEqual(plain(PC.view3d.look()), { hour: 22, season: 'winter' });
  assert.equal(E.world.getObjectByName('canopies').visible, false, 'and the restore');
});

test('shadow box (Q4): every content corner inside the light-view box at 6 / 8 / 12 / 17.5 / 22 h, refitted per look, capped; fields only', () => {
  const E = opened(), PC = E.PC, cam = E.info().scene.getObjectByName('sun').shadow.camera, cap = PC.C.VIEW3D.shadowR * E.house.radius;
  const seen = new Set();
  for (const hour of [6, 8, 12, 17.5, 22]) for (const season of ['summer', 'winter']) {
    PC.view3d.setLook({ hour, season });
    const sun = E.info().scene.getObjectByName('sun'), p = sun.position, eye = [p.x, p.y, p.z];
    const f = PC.three.shadowFit(E.house, eye, PC.sky.compute(hour, season, E.house.northDeg).sunDir), { x, y, z } = f.basis;
    assert.deepEqual([cam.left, cam.right, cam.top, cam.bottom, cam.near, cam.far], [f.left, f.right, f.top, f.bottom, f.near, f.far]);
    for (const c of f.corners) {
      const r = [c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const lx = dt(r, x), ly = dt(r, y), dd = -dt(r, z);
      if (Math.abs(lx) < cap && Math.abs(ly) < cap) assert.ok(lx >= cam.left && lx <= cam.right && ly >= cam.bottom && ly <= cam.top, `${hour} ${season} corner in box`);
      assert.ok(dd >= cam.near && dd <= cam.far, 'depth inside');
    }
    assert.ok(cam.left >= -cap && cam.right <= cap && cam.bottom >= -cap && cam.top <= cap, 'capped');
    seen.add([cam.left, cam.right, cam.top, cam.bottom].map((v) => v.toFixed(3)).join());
  }
  assert.ok(seen.size > 3, 'the box follows the light');
  // the trees and the pool are inside: the box covers the yard, not only the building
  const fp = E.house.footprint, t = E.house.site.trees[0];
  assert.ok(t && (t[0] < fp.u || t[0] > fp.u + fp.w || t[1] < fp.v || t[1] > fp.v + fp.d), 'a tree outside the footprint');
  const fit = PC.three.shadowFit(E.house, [0, 50, 0.01], [0, 1, 0.0002]);
  const xs = fit.corners.map((c) => c[0]);
  assert.ok(Math.min(...xs) <= E.X(t[0]) && Math.max(...xs) >= E.X(t[0]));
});
