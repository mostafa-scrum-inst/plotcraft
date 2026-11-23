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

// F6-T1a (CTO C-3.1, C-4.1, C-2 transparency; plan section 8): textures <= 12 and <= 16 MB with mipmaps; at most two
// transparent meshes, only poolWater and blobs (TL ruling Q-T5).
const MB = (E) => E.info().textures.reduce((n, t) => { const r = E.mock.raw(t).image; return n + r.width * r.height * 4 * 4 / 3; }, 0) / 1048576;
function texBudget(E, at) {
  const ts = E.info().textures;
  assert.ok(ts.length <= 12, `${at} ${ts.length} textures`); assert.ok(MB(E) <= 16, `${at} ${MB(E).toFixed(2)} MB`);
  const tr = E.info().meshes.filter((m) => m.material.transparent).map((m) => m.name);
  assert.ok(tr.length <= 2 && tr.every((n) => n === 'poolWater' || n === 'blobs'), `${at} transparent: ${tr}`);
}

test('G6 final (F6-T1a): maximum house + capped vegetation, every look applied: <= 64 meshes (27; F6-T1b: + groundRing, blobs; F6-T1c: + roofDeck), counts = model, one shadow light (map 2048 on a fine pointer), pixel ratio <= 2, textures 4 / 4.02 MB (F6-T1b: + blob 64 px), nothing created or moved, applyLook mean < 5 ms', () => {
  const E = opened((PC) => biggest(PC)), PC = E.PC, sc = E.info().scene;
  assert.equal(E.info().tier.name, 'full'); texBudget(E, 'full');
  assert.deepEqual([E.info().textures.length, +MB(E).toFixed(2)], [4, 4.02]);
  const texs = E.mock.created.textures.length;
  assert.equal(E.house.levels.reduce((n, l) => n + l.rooms.length, 0), 40);
  assert.deepEqual([E.house.site.trees.length, E.house.site.shrubs.length], [120, 200], 'caps reached');
  const objs = []; sc.traverse((o) => objs.push(o));
  const geos = E.mock.created.geometries.length, mats = E.mock.created.materials.length, pose = JSON.stringify(PC.view3d.pose());
  let total = 0, n = 0;
  for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const hour of [8, 12, 17.5, 22, 0, 6, 18, 24]) {
    const t0 = performance.now(); PC.view3d.setLook({ hour, season }); total += performance.now() - t0; n++;
    const i = E.info(), at = `${season} ${hour}`;
    assert.ok(i.meshCount <= 64, at); assert.equal(i.meshCount, 27, at);
    assert.equal(E.world.getObjectByName('trunks').count, 120); assert.equal(E.world.getObjectByName('canopies').count, 120); assert.equal(E.world.getObjectByName('shrubs').count, 200);
    let casters = 0, maps = []; sc.traverse((o) => { if ((o.name === 'sun' || o.name === 'hemi') && o.castShadow) { casters++; maps.push(o.shadow.mapSize.x, o.shadow.mapSize.y); } });
    assert.equal(casters, 1, at); assert.ok(maps.every((m) => m === 2048));
    assert.ok(E.mock.raw(E.info().renderer).pixelRatio <= 2);
    const now = []; sc.traverse((o) => now.push(o));
    assert.ok(now.length === objs.length && now.every((o, k) => o === objs[k]), at + ' same objects');
    assert.deepEqual([E.mock.created.geometries.length, E.mock.created.materials.length, E.mock.created.textures.length], [geos, mats, texs], at + ' nothing created');
    assert.equal(JSON.stringify(PC.view3d.pose()), pose, at + ' camera untouched');
  }
  // mean over the 32 looks (the first call includes JIT warm-up; run-all runs files side by side)
  assert.ok(total / n < 5, `applyLook mean ${(total / n).toFixed(2)} ms over ${n} looks (mock)`);
  assert.equal(E.info().builds, 1);
});

test('F6-T1a tiers on the maximum house: lite (by data, either pointer) = 1024 map, no fog, 256 textures, pixel ratio <= 1.5, lite groundOuter skirt; a coarse pointer keeps 1024 in full; budgets hold in both', () => {
  for (const [o, want] of [
    [{ tier: { coarse: 'full', fine: 'lite' }, dpr: 3 }, { name: 'lite', map: 1024, fog: false, tex: 256, dpr: 1.5 }],
    [{ tier: { coarse: 'lite', fine: 'full' }, coarse: true, dpr: 3 }, { name: 'lite', map: 1024, fog: false, tex: 256, dpr: 1.5 }],
    [{ coarse: true, dpr: 3 }, { name: 'full', map: 1024, fog: true, tex: 512, dpr: 2 }],
    [{ maxTex: 2048 }, { name: 'full', map: 1024, fog: true, tex: 512, dpr: 1 }]
  ]) {
    const E = opened((PC) => biggest(PC), null, o), i = E.info(), sun = i.scene.getObjectByName('sun'), at = JSON.stringify(o);
    assert.deepEqual([i.tier.name, sun.shadow.mapSize.x, !!i.scene.fog, E.mock.raw(i.textures[0]).image.width, E.mock.raw(i.renderer).pixelRatio], [want.name, want.map, want.fog, want.tex, want.dpr], at);
    assert.equal(i.meshCount, 27, at); texBudget(E, at);
    const outer = i.world.getObjectByName('groundOuter');
    assert.equal(!!outer.userData.skirt, want.name === 'lite', at + ' skirt only in lite');
    for (const [hour, season] of [[12, 'summer'], [22, 'winter']]) E.PC.view3d.setLook({ hour, season });
  }
});

test('F5-T1 (TL rider): with a room selected the maximum house has 28 meshes (27 + highlight, F6-T1c) <= 64, through every look; the highlight is no shadow caster', () => {
  const E = opened((PC) => biggest(PC)), PC = E.PC;
  for (const lv of E.house.levels) {
    PC.three.finder.goTo(lv.rooms[lv.rooms.length - 1].id);
    for (const [hour, season] of [[12, 'summer'], [22, 'winter']]) {
      PC.view3d.setLook({ hour, season });
      const i = E.info();
      assert.ok(i.meshCount <= 64); assert.equal(i.meshCount, 28, lv.id);
      assert.equal(i.meshes.filter((m) => m.name === 'highlight').length, 1);
    }
    assert.equal(E.info().highlight.castShadow, false);
  }
  PC.three.finder.clear();
  assert.equal(E.info().meshCount, 27);
});
