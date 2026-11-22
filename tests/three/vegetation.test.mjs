// F4-T3: the instanced vegetation in the site group (A-11; Designer F4-T3 plan 1; TL F4-T3 plan review item 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened } from '../helpers/scene3d.mjs';
import { sampleApproved } from '../helpers/houses.mjs';
import { plain } from '../helpers/load.mjs';

const KINDS = [['trunks', 'trees'], ['canopies', 'trees'], ['shrubs', 'shrubs']];

test('trunks / canopies / shrubs: one instance per model item, frustumCulled false, cast without receive, materials trunk / canopy / shrub', () => {
  const E = opened(), raw = E.mock.raw, V = plain(E.PC.data.vegetation), det = E.info().tier.treeDetail;
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
  assert.ok(mats.length === 12, 'batch, ground, groundOuter, paving, ui, sky (F6-T1a), poolWater, trunk, canopy, shrub, groundRing, blob (F6-T1b)');
  // geometry from the table, not literals: the trunk tapers (F6-T1b), canopies and shrubs are flat-shaded lumps
  const g = (n) => raw(E.world.getObjectByName(n).geometry);
  assert.deepEqual([...g('trunks').params], [V.tree.trunkR * V.tree.taper, V.tree.trunkR, V.tree.trunkH, V.tree.trunkSeg]);
  const verts = (n) => g(n).attrs.position.array.length / 3;
  assert.equal(verts('canopies'), V.tree.lumps.length * 20 * 4 ** det * 3, 'canopy: lumps x icosahedron at the tier detail');
  assert.equal(verts('shrubs'), V.shrub.lumps.length * 20 * 3, 'shrub: lumps x icosahedron, detail 0');
  assert.ok(info.meshCount === 20);   // F6-T1b: + groundRing, blobs
});

test('instance matrices: trunks lean at most leanDeg about their base on the ground at the item, scale s; canopies and shrubs unrotated at the item, scale s', () => {
  const E = opened(), raw = E.mock.raw, V = plain(E.PC.data.vegetation), h2 = V.tree.trunkH / 2;
  const len = (e, c) => Math.hypot(e[4 * c], e[4 * c + 1], e[4 * c + 2]);
  for (const [name, list] of KINDS) {
    const M = raw(E.world.getObjectByName(name)).matrices, items = E.house.site[list];
    let leaned = 0;
    items.forEach(([u, v, s], i) => {
      const e = M[i];
      for (const c of [0, 1, 2]) assert.ok(Math.abs(len(e, c) - s) < 1e-9, `${name} ${i} scale`);
      if (name === 'trunks') {
        const base = [e[12] - e[4] * h2, e[13] - e[5] * h2, e[14] - e[6] * h2];
        assert.ok(Math.abs(base[0] - E.X(u)) < 1e-9 && Math.abs(base[1]) < 1e-9 && Math.abs(base[2] - E.Z(v)) < 1e-9, `trunk ${i} base on the ground at the item`);
        const lean = Math.acos(Math.min(1, e[5] / s)) * 180 / Math.PI;
        assert.ok(lean <= V.tree.leanDeg + 1e-9, `trunk ${i} lean ${lean}`);
        if (lean > 0.5) leaned++;
      } else {
        assert.ok(Math.abs(e[1]) + Math.abs(e[2]) + Math.abs(e[4]) + Math.abs(e[6]) + Math.abs(e[8]) + Math.abs(e[9]) < 1e-12, 'no rotation');
        assert.ok(Math.abs(e[12] - E.X(u)) < 1e-9 && Math.abs(e[13]) < 1e-9 && Math.abs(e[14] - E.Z(v)) < 1e-9, `${name} ${i} origin at the item`);
      }
    });
    if (name === 'trunks' && items.length > 2) assert.ok(leaned >= 1, 'some trunks lean');
  }
});

test('no items of a kind -> no mesh of that kind (vegetation 0 %: the F4-T2 12 meshes + the F6-T1a 3 + groundRing); sample has trees and shrubs', () => {
  const E = opened((PC) => sampleApproved(PC, (d) => { d.ans.vegPct = 0; }));
  for (const [name] of KINDS.concat([['blobs']])) assert.equal(E.world.getObjectByName(name), undefined, name);
  assert.equal(E.info().meshCount, 16);
  assert.equal(E.mock.created.geometries.filter((g) => /Cylinder|Cone/.test(E.mock.raw(g).__kind || '')).length, 0, 'no vegetation geometry made');
});
