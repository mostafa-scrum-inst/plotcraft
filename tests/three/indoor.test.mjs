// F6-T2 evening indoor light (CTO 1 / 4 / 8; plan 3; TL rulings 2-3, F4) against the mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened, close } from '../helpers/scene3d.mjs';
import { maxHouse } from '../helpers/houses.mjs';

const EM = ['glazing', 'furniture', 'interior', 'lamp'];
const K = (PC) => ({ glazing: PC.data.indoor.glazing.k, furniture: PC.data.indoor.lift.k, interior: PC.data.indoor.lift.k, lamp: PC.data.indoor.lamp.k });
const glows = (E) => { const g = []; E.world.traverse((o) => { if (/^glow-/.test(o.name)) g.push(o); }); return g; };
const lights = (E) => { const l = []; E.info().scene.traverse((o) => { if (/Light$/.test(E.mock.raw(o).__kind || '')) l.push(o.name); }); return l; };

test('no light but hemi + sun in any tier or look (CTO 1.1); emissive colours set at build, intensity = factor x indoor (0 by day); glow visible only when indoor > 0', () => {
  for (const o of [undefined, { tier: { coarse: 'lite', fine: 'lite' } }]) {
    const E = opened((PC) => maxHouse(PC), null, o), PC = E.PC, M = E.mock, mats = {};
    E.info().meshes.forEach((m) => {
      if (m.name === 'glazing') mats.glazing = m.material;
      if (m.name === 'furniture') mats.furniture = m.material;
      if (/^textured-/.test(m.name)) mats.interior = m.material;
      if (/^lamps-/.test(m.name)) mats.lamp = m.material;
    });
    assert.deepEqual(Object.keys(mats).sort(), [...EM].sort());
    const hex = { glazing: PC.data.indoor.glazing.hex, furniture: PC.data.indoor.lift.hex, interior: PC.data.indoor.lift.hex, lamp: PC.data.indoor.lamp.hex };
    for (const k of EM) { const c = PC.three.col(hex[k]), e = M.raw(mats[k]).emissive; assert.ok(close(e.r, c.r, 1e-9) && close(e.g, c.g, 1e-9) && close(e.b, c.b, 1e-9), k + ' emissive'); }
    for (const hour of [8, 12, 17.5, 19.5, 22, 0]) {
      PC.view3d.setLook({ hour, season: 'summer' });
      const L = PC.sky.compute(hour, 'summer', E.house.northDeg);
      for (const k of EM) assert.ok(close(M.raw(mats[k]).emissiveIntensity, K(PC)[k] * L.indoor, 1e-12), `${hour} h ${k}`);
      assert.deepEqual(lights(E).sort(), ['hemi', 'sun'], hour + ' h lights');
      glows(E).forEach((g) => assert.equal(g.visible, L.indoor > 0, `${hour} h ${g.name}`));
      if (hour === 12) assert.ok(EM.every((k) => M.raw(mats[k]).emissiveIntensity === 0), 'noon: no indoor light');
    }
    assert.equal(glows(E).length, o ? 0 : E.house.levels.length, 'glow per level in full, none in lite (CTO 1.6)');
  }
});

test('an indoor-only change creates nothing and leaves the shadow-update count unchanged (CTO 4, TL F4); the same look again neither', () => {
  const E = opened((PC) => maxHouse(PC)), PC = E.PC, V = PC.view3d, orig = PC.sky.compute;
  V.setLook({ hour: 21, season: 'summer' });
  const n = E.info().shadowUpdates, c = [E.mock.created.geometries.length, E.mock.created.materials.length, E.mock.created.textures.length];
  V.setLook({ hour: 21, season: 'summer' });
  assert.equal(E.info().shadowUpdates, n, 'identical look');
  try {
    for (const k of [0.2, 0.6, 0]) { PC.sky.compute = (...a) => Object.assign(orig(...a), { indoor: k }); V.setLook({ hour: 21 }); }
  } finally { PC.sky.compute = orig; }
  assert.equal(E.info().shadowUpdates, n, 'indoor only');
  assert.deepEqual([E.mock.created.geometries.length, E.mock.created.materials.length, E.mock.created.textures.length], c, 'nothing created');
  V.setLook({ hour: 22 });
  assert.ok(E.info().shadowUpdates > n, 'a sun change still updates');
});

test('glow-<level> (TL ruling 3): additive instances [pools][spill][patches]; spill on Ground only; dollhouse count = pools + spill, exterior = all; composes with the level selector and Basement; lit panes seeded per opening', () => {
  const E = opened((PC) => maxHouse(PC)), PC = E.PC, V = PC.view3d, h = E.house, panes = E.world.getObjectByName('glazing').userData.panes;
  V.setLook({ hour: 22 });
  for (const lv of h.levels) {
    const g = E.world.getObjectByName('glow-' + lv.id), r = g.userData.ranges, lit = panes.filter((p) => p.level === lv.id && PC.three.litPane(h, p)).length;
    assert.ok(r.pools > 0 && r.all === r.pools + r.spill + lit, lv.id + ' ranges');
    if (lv.id !== 'G') assert.equal(r.spill, 0, lv.id + ' no spill above Ground');
    const mt = E.mock.raw(g.material);
    assert.deepEqual([mt.blending, mt.transparent, mt.depthWrite, g.castShadow, g.receiveShadow, mt.map === E.mock.raw(E.world.getObjectByName('blobs').material).map], [2, true, false, false, false, true], 'additive, the blob map');
    assert.equal(g.count, r.all, 'exterior (Roof on, All): every instance');
    assert.equal(g.geometry, E.world.getObjectByName('blobs').geometry, 'the blobs\' plane (no renderer geometry created by the first night frame)');
  }
  const inner = () => h.levels.map((lv) => { const L = E.world.getObjectByName('level-' + lv.id); return [E.mesh('furniture', L), E.mesh('textured-' + lv.id, L)].map((m) => m.visible); });
  assert.deepEqual(inner(), h.levels.map(() => [false, false]), 'exterior: furniture and textured floors not drawn (enclosed; gate time)');
  V.setRoof(false);
  assert.deepEqual(inner(), h.levels.map(() => [true, true]), 'dollhouse: drawn');
  for (const lv of h.levels) { const g = E.world.getObjectByName('glow-' + lv.id); assert.equal(g.count, g.userData.ranges.pools + g.userData.ranges.spill, lv.id + ' dollhouse: no window patches'); }
  V.setRoof(true); V.setLevel('G');
  for (const lv of h.levels) { const g = E.world.getObjectByName('glow-' + lv.id); assert.equal(g.count, g.userData.ranges.pools + g.userData.ranges.spill, 'a level selected: dollhouse'); }
  const vis = (id) => E.world.getObjectByName('level-' + id).visible && E.world.getObjectByName('glow-' + id).visible;
  assert.deepEqual(h.levels.map((l) => vis(l.id)), h.levels.map((l) => l.index <= 0), 'level G: the glow of B and G only');
  V.setLevel('B');
  assert.deepEqual(h.levels.map((l) => vis(l.id)), h.levels.map((l) => l.index < 0), 'Basement: only the basement glow');
  V.setLook({ hour: 12 });
  assert.ok(glows(E).every((g) => !g.visible), 'noon: hidden');
  // the lit share: deterministic per opening, near the data share on the maximum house
  const share = panes.filter((p) => p.kind === 'glazed'), on = share.filter((p) => PC.three.litPane(h, p)).length;
  assert.ok(on / share.length > 0.6 && on / share.length < 0.9, `glazed lit ${on} / ${share.length}`);
  assert.ok(panes.filter((p) => p.kind === 'slot').every((p) => PC.three.litPane(h, p)), 'stair slots always lit');
  const again = opened((P) => maxHouse(P)), p2 = again.world.getObjectByName('glazing').userData.panes;
  assert.equal(JSON.stringify(p2.map((p) => again.PC.three.litPane(again.house, p))), JSON.stringify(panes.map((p) => PC.three.litPane(h, p))), 'same panes lit across builds');
});

test('the build precompiles the night-only glow programs (CTO 1.2, TL): compile() sees every glow mesh, which is hidden again afterwards; the glazing receives without casting', () => {
  const E = opened((PC) => maxHouse(PC)), R = E.mock.raw(E.info().renderer);
  assert.ok(R.compiles >= 1);
  const last = R.compiled[R.compiled.length - 1];
  for (const lv of E.house.levels) assert.ok(last.includes('glow-' + lv.id), 'compiled with glow-' + lv.id + ' shown');
  assert.ok(glows(E).every((g) => !g.visible), 'hidden again at noon');
  const gz = E.world.getObjectByName('glazing');
  assert.deepEqual([gz.castShadow, gz.receiveShadow, E.mock.raw(gz.material).__kind, E.mock.raw(gz.material).vertexColors], [false, true, 'MeshLambertMaterial', true]);
});
