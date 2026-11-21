// F4-T3: the instanced vegetation in the site group (A-11; Designer F4-T3 plan 1; TL F4-T3 plan review item 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened } from '../helpers/scene3d.mjs';
import { sampleApproved } from '../helpers/houses.mjs';
import { plain } from '../helpers/load.mjs';

const KINDS = [['trunks', 'trees'], ['canopies', 'trees'], ['shrubs', 'shrubs']];

test('trunks / canopies / shrubs: one instance per model item, frustumCulled false, cast without receive, materials trunk / canopy / shrub', () => {
  const E = opened(), raw = E.mock.raw, V = plain(E.PC.data.vegetation);
  for (const [name, list] of KINDS) {
    const m = E.world.getObjectByName(name), items = E.house.site[list];
    assert.ok(m && E.mock.raw(m).__kind === 'InstancedMesh', name);
    assert.equal(m.parent.name, 'site');
    assert.equal(m.count, items.length, `${name}: count = model`);
    assert.equal(raw(m).matrices.length, items.length);
    assert.equal(m.frustumCulled, false, `${name}: frustumCulled false`);
    assert.deepEqual([m.castShadow, m.receiveShadow], [true, false], name);
    assert.equal(m.instanceMatrix.needsUpdate, true);
  }
  const info = E.info(), mats = E.mock.created.materials;
  assert.equal(E.world.getObjectByName('trunks').material, E.world.getObjectByName('trunks').material);
  assert.ok(mats.length === 7, 'batch, ground, groundOuter, poolWater, trunk, canopy, shrub');
  // geometry from the table, not literals
  const g = (n) => [...raw(E.world.getObjectByName(n).geometry).params];
  assert.deepEqual(g('trunks'), [V.tree.trunkR, V.tree.trunkR, V.tree.trunkH, V.tree.trunkSeg]);
  assert.deepEqual(g('canopies'), [V.tree.canopyR, V.tree.canopyH, V.tree.canopySeg]);
  assert.deepEqual(g('shrubs'), [V.shrub.r, V.shrub.h, V.shrub.seg]);
  assert.ok(info.meshCount === 15);
});

test('instance matrices: T position of the item, uniform scale s, canopy base at canopyY0 x s, trunk and shrub bases on the ground', () => {
  const E = opened(), raw = E.mock.raw, V = plain(E.PC.data.vegetation);
  const base = { trunks: V.tree.trunkH / 2, canopies: V.tree.canopyY0 + V.tree.canopyH / 2, shrubs: V.shrub.h / 2 };
  const half = { trunks: V.tree.trunkH / 2, canopies: V.tree.canopyH / 2, shrubs: V.shrub.h / 2 };
  for (const [name, list] of KINDS) {
    const M = raw(E.world.getObjectByName(name)).matrices, items = E.house.site[list];
    items.forEach(([u, v, s], i) => {
      const e = M[i];
      assert.ok(Math.abs(e[0] - s) < 1e-9 && Math.abs(e[5] - s) < 1e-9 && Math.abs(e[10] - s) < 1e-9, `${name} ${i} scale`);
      assert.ok(Math.abs(e[1]) + Math.abs(e[2]) + Math.abs(e[4]) + Math.abs(e[6]) + Math.abs(e[8]) + Math.abs(e[9]) < 1e-12, 'no rotation');
      assert.ok(Math.abs(e[12] - E.X(u)) < 1e-9 && Math.abs(e[14] - E.Z(v)) < 1e-9 && Math.abs(e[13] - base[name] * s) < 1e-9, `${name} ${i} position`);
      const bottom = e[13] - half[name] * s;
      assert.ok(Math.abs(bottom - (name === 'canopies' ? V.tree.canopyY0 * s : 0)) < 1e-9, `${name} ${i} base`);
    });
  }
});

test('no items of a kind -> no mesh of that kind (vegetation 0 %: the F4-T2 12 meshes); sample has trees and shrubs', () => {
  const E = opened((PC) => sampleApproved(PC, (d) => { d.ans.vegPct = 0; }));
  for (const [name] of KINDS) assert.equal(E.world.getObjectByName(name), undefined, name);
  assert.equal(E.info().meshCount, 12);
  assert.equal(E.mock.created.geometries.filter((g) => /Cylinder|Cone/.test(E.mock.raw(g).__kind || '')).length, 0, 'no vegetation geometry made');
});
