// F4-T3: the final G6 budget assertion (F4-plan; TL F4-T3 plan review: counts after every look) on the maximum house
// (CD-4: 4 x 10 rooms, full furniture, lift, usable terrace, pool L, 4 covered cars, wall, gate, seating) on a
// 100 x 100 m plot at 80 % vegetation, so both vegetation caps (120 trees, 200 shrubs) are reached.
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened } from '../helpers/scene3d.mjs';
import { maxHouse } from '../helpers/houses.mjs';

function biggest(PC) {
  const s = maxHouse(PC);
  s.plot = { pts: [[0, 0], [100, 0], [100, 100], [0, 100]], closed: true };
  s.ans.footprintPct = 20; s.ans.vegPct = 80; s.ans.usableRoof = true; s.ans.roofType = 'terrace';
  for (const id of PC.levels.ids(s)) delete s.plans[id];
  PC.plans.sync(s);
  for (const id of PC.levels.ids(s)) s.plans[id].approved = true;
  return s;
}

test('G6 final: maximum house + capped vegetation, every look applied: <= 40 meshes (21), counts = model, one shadow light (map <= 1024), pixel ratio <= 2, nothing created or moved, applyLook mean < 5 ms', () => {
  const E = opened((PC) => biggest(PC)), PC = E.PC, sc = E.info().scene;
  assert.equal(E.house.levels.reduce((n, l) => n + l.rooms.length, 0), 40);
  assert.deepEqual([E.house.site.trees.length, E.house.site.shrubs.length], [120, 200], 'caps reached');
  const objs = []; sc.traverse((o) => objs.push(o));
  const geos = E.mock.created.geometries.length, mats = E.mock.created.materials.length, pose = JSON.stringify(PC.view3d.pose());
  let total = 0, n = 0;
  for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const hour of [8, 12, 17.5, 22, 0, 6, 18, 24]) {
    const t0 = performance.now(); PC.view3d.setLook({ hour, season }); total += performance.now() - t0; n++;
    const i = E.info(), at = `${season} ${hour}`;
    assert.ok(i.meshCount <= 40, at); assert.equal(i.meshCount, 21, at);
    assert.equal(E.world.getObjectByName('trunks').count, 120); assert.equal(E.world.getObjectByName('canopies').count, 120); assert.equal(E.world.getObjectByName('shrubs').count, 200);
    let casters = 0, maps = []; sc.traverse((o) => { if ((o.name === 'sun' || o.name === 'hemi') && o.castShadow) { casters++; maps.push(o.shadow.mapSize.x, o.shadow.mapSize.y); } });
    assert.equal(casters, 1, at); assert.ok(maps.every((m) => m <= 1024));
    assert.ok(E.mock.raw(E.info().renderer).pixelRatio <= 2);
    const now = []; sc.traverse((o) => now.push(o));
    assert.ok(now.length === objs.length && now.every((o, k) => o === objs[k]), at + ' same objects');
    assert.deepEqual([E.mock.created.geometries.length, E.mock.created.materials.length], [geos, mats], at + ' nothing created');
    assert.equal(JSON.stringify(PC.view3d.pose()), pose, at + ' camera untouched');
  }
  // mean over the 32 looks (the first call includes JIT warm-up; run-all runs files side by side)
  assert.ok(total / n < 5, `applyLook mean ${(total / n).toFixed(2)} ms over ${n} looks (mock)`);
  assert.equal(E.info().builds, 1);
});

test('F5-T1 (TL rider): with a room selected the maximum house has 22 meshes (21 + highlight) <= 40, through every look; the highlight is no shadow caster', () => {
  const E = opened((PC) => biggest(PC)), PC = E.PC;
  for (const lv of E.house.levels) {
    PC.three.finder.goTo(lv.rooms[lv.rooms.length - 1].id);
    for (const [hour, season] of [[12, 'summer'], [22, 'winter']]) {
      PC.view3d.setLook({ hour, season });
      const i = E.info();
      assert.ok(i.meshCount <= 40); assert.equal(i.meshCount, 22, lv.id);
      assert.equal(i.meshes.filter((m) => m.name === 'highlight').length, 1);
    }
    assert.equal(E.info().highlight.castShadow, false);
  }
  PC.three.finder.clear();
  assert.equal(E.info().meshCount, 21);
});
