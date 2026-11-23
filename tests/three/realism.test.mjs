// F6-T1a realism pipeline against the mock (plan sections 2-5 + A; TL plan review required changes 1 and 2; CTO
// C-2 .. C-5; the on-demand shadow map conditions). Tiers and budgets are in budget.test, the moved items in
// site / roof / scene tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened } from '../helpers/scene3d.mjs';
import { maxHouse, sampleApproved } from '../helpers/houses.mjs';

const lin = (E, hex) => { const c = E.PC.three.col(hex); return [c.r, c.g, c.b]; };
const near3 = (a, b, e = 1e-6) => a.every((x, i) => Math.abs(x - b[i]) < e);

test('ACES tone mapping; exposure, the raw fog colour and the sky dome colours follow PC.sky.compute at every look; the dome attribute is repainted in place', () => {
  const E = opened(), PC = E.PC, i = E.info(), r = E.mock.raw(i.renderer), sky = E.world.getObjectByName('sky');
  assert.equal(r.toneMapping, E.THREE.ACESFilmicToneMapping);
  const dome = sky.userData.dome, attr = dome.colors, arr = E.mock.raw(attr).array;
  for (const season of ['summer', 'winter']) for (const hour of [7.5, 12, 17.5, 22]) {
    PC.view3d.setLook({ hour, season });
    const L = PC.sky.compute(hour, season, E.house.northDeg), at = `${season} ${hour}`;
    assert.equal(r.toneMappingExposure, L.exposure, at);
    assert.equal(L.skyHorizon, L.background, at + ' horizon = background');
    const fog = E.mock.raw(i.scene.fog), fc = E.mock.raw(fog.color);
    assert.equal(fc.lin, false, at + ' fog colour raw (A-10, Q-T6)');
    assert.ok(near3([fc.r, fc.g, fc.b], [1, 3, 5].map((k) => parseInt(L.skyHorizon.slice(k, k + 2), 16) / 255)), at + ' fog = horizon hex');
    const h = lin(E, L.skyHorizon), m = lin(E, L.skyMid), z = lin(E, L.skyZenith);
    dome.elev.forEach((e, k) => {
      const want = e <= 0 ? h : PC.three.skyAt(e, h, m, z), got = [arr[3 * k], arr[3 * k + 1], arr[3 * k + 2]];
      assert.ok(near3(got, want, 1e-6), `${at} vertex ${k} at ${e} deg`);
      if (e === 0) assert.ok(near3(got, h, 1e-6)); if (e === 15) assert.ok(near3(got, m, 1e-6)); if (e === 90) assert.ok(near3(got, z, 1e-6));
    });
    assert.equal(E.mock.raw(attr).needsUpdate, true);
  }
  assert.equal(sky.userData.dome.colors, attr, 'the same attribute object (nothing created)');
  assert.equal(E.mock.raw(sky.geometry).attrs.color, E.mock.raw(attr), 'the dome geometry still holds that attribute (none set in applyLook)');
  const sm = E.mock.raw(sky.material);
  assert.deepEqual([sm.__kind, sm.toneMapped, sm.fog, sm.depthWrite, sm.vertexColors, sky.renderOrder, sky.frustumCulled, sky.castShadow, sky.receiveShadow],
    ['MeshBasicMaterial', false, false, false, true, -1, false, false, false]);
});

test('TL required change 2: the dome follows the eye before every render, radius 0.9 x far, never clipped at rMax on any aspect', () => {
  for (const size of [[360, 640], [1280, 800], [300, 900]]) {
    const E = opened((PC) => maxHouse(PC), null, { size }), V = E.PC.view3d, sky = E.world.getObjectByName('sky'), cam = E.info().camera;
    const rad = Math.max(...E.mock.raw(E.mock.raw(sky.geometry).attrs.position).array.map(Math.abs).filter((x, k, a) => true)), R = E.house.radius;
    assert.ok(Math.abs(E.PC.C.VIEW3D.skyK * cam.far - 0.9 * E.PC.C.CAM.farK * R) < 1e-9);
    assert.ok(rad <= 0.9 * cam.far + 1e-6 && rad < cam.far, `${size}: dome radius ${rad.toFixed(1)} < far ${cam.far}`);
    const L = V.limits(), p = V.pose();
    for (const radius of [p.radius, L.rMax]) {
      V.flyTo(Object.assign({}, p, { radius }), 1); E.raf.tick(16); E.raf.tick(16);
      assert.ok(near3([sky.position.x, sky.position.y, sky.position.z], [cam.position.x, cam.position.y, cam.position.z], 1e-9), `${size}: dome on the eye at radius ${radius.toFixed(1)}`);
    }
  }
});

test('TL required change 1: fog near = rMax + R, far = min(near + fogSpanK R, 0.9 outerK R / 2); every house and plot vertex nearer than near at Reset and at rMax on the narrowest aspect; re-applied on a re-fit, lite has no fog', () => {
  for (const size of [[300, 900], [360, 640], [1280, 800]]) {
    const E = opened((PC) => maxHouse(PC), null, { size }), PC = E.PC, V = PC.view3d, h = E.house, R = h.radius, fog = E.info().scene.fog;
    const L = V.limits(), near = L.rMax + R, far = Math.min(near + PC.C.VIEW3D.fogSpanK * R, 0.9 * PC.C.HOUSE.outerK * R / 2);
    assert.deepEqual([fog.near, fog.far], [near, far], `${size}`);
    const fp = h.footprint, cu = h.center[0], cv = h.center[1], top = h.roof.baseY + 3;
    const pts = h.plot.pts.map((q) => [q[0] - cu, 0, -(q[1] - cv)]);
    for (const u of [fp.u, fp.u + fp.w]) for (const v of [fp.v, fp.v + fp.d]) for (const y of [0, top]) pts.push([u - cu, y, -(v - cv)]);
    const reset = V.pose();
    for (const pose of [reset, Object.assign({}, reset, { radius: L.rMax })]) {
      const e = PC.cam.position(pose), worst = Math.max(...pts.map((q) => Math.hypot(q[0] - e[0], q[1] - e[1], q[2] - e[2])));
      assert.ok(worst < fog.near, `${size} radius ${pose.radius.toFixed(1)}: farthest vertex ${worst.toFixed(1)} < near ${fog.near.toFixed(1)}`);
    }
    // a re-fit (resize) re-applies the look: new limits, new range, nothing created, not counted as a look
    const looks = E.info().looks, geos = E.mock.created.geometries.length;
    E.ro.trigger(size[1], size[0]);
    const L2 = V.limits();
    assert.equal(fog.near, L2.rMax + R); assert.equal(E.info().looks, looks); assert.equal(E.mock.created.geometries.length, geos);
  }
  const lite = opened(null, null, { tier: { coarse: 'lite', fine: 'lite' } });
  assert.equal(lite.info().scene.fog, null);
});

test('lite groundOuter: the B-1 footprint hole kept, inner ring white, the skirt outer vertices = horizon / meadow colour (clamped) at every look, in place', () => {
  const E = opened(null, null, { tier: { coarse: 'lite', fine: 'lite' } }), PC = E.PC, o = E.world.getObjectByName('groundOuter'), sk = o.userData.skirt;
  const g = E.mock.raw(E.mock.raw(o).geometry), pos = g.attrs.position.array, col = E.mock.raw(sk.colors).array, h = E.house, fp = h.footprint;
  assert.deepEqual([o.rotation.x, o.position.y, o.receiveShadow, o.castShadow], [-Math.PI / 2, -0.05, true, false]);
  const cu = h.center[0], cv = h.center[1], inHole = (x, y) => x > fp.u - cu + 1e-6 && x < fp.u + fp.w - cu - 1e-6 && y > fp.v - cv + 1e-6 && y < fp.v + fp.d - cv - 1e-6;
  // every triangle stays outside the footprint (its centroid is not inside the hole)
  for (let t = 0; t < g.index.length; t += 3) {
    const c = [0, 1].map((a) => (pos[3 * g.index[t] + a] + pos[3 * g.index[t + 1] + a] + pos[3 * g.index[t + 2] + a]) / 3);
    assert.ok(!inHole(c[0], c[1]), 'no triangle over the footprint');
  }
  for (const [hour, season] of [[12, 'summer'], [22, 'winter']]) {
    PC.view3d.setLook({ hour, season });
    const L = PC.sky.compute(hour, season, h.northDeg), hz = lin(E, L.skyHorizon), m = lin(E, L.meadowColor), want = hz.map((x, k) => Math.min(1, x / m[k]));
    for (let k = 0; k < col.length / 3; k++) {
      const c = [col[3 * k], col[3 * k + 1], col[3 * k + 2]];
      if (sk.outer.includes(k)) assert.ok(near3(c, want), `outer ${k}`); else assert.ok(near3(c, [1, 1, 1]), `inner ${k}`);
    }
  }
});

test('textures (C-3.4): explicit filters, mipmaps, anisotropy min(4, max), sRGB colour maps, repeat 1 / tileM, the texgen cached pixels; disposed with each rebuild, counts constant over 20 rebuilds', () => {
  const E = opened(), PC = E.PC, t = E.info().textures.map((x) => E.mock.raw(x));
  assert.deepEqual([...t.map((x) => x.image.width)], [512, 512, 512, 64, 512, 512]);
  // F6-T2 I2: the interior atlas: clamped, repeat 1 (tiling by geometry), sRGB, mipmaps, the cached pixels
  const at = t[5];
  assert.deepEqual([at.encoding, at.wrapS, at.wrapT, E.mock.raw(at.repeat).x, at.generateMipmaps, at.image.data === PC.texgen.get('interior', 512).data], [3001, 1001, 1001, 1, true, true], 'interior atlas');   // F6-T1b: + the blob (64 px, linear, clamped, no repeat); F6-T1c: + membrane (flat sample roof)
  const bl = t[3];
  assert.deepEqual([bl.encoding, bl.wrapS, bl.wrapT, E.mock.raw(bl.repeat).x, bl.image.data === PC.texgen.get('blob', 64).data], [3000, 1001, 1001, 1, true], 'blob');
  for (const [x, kind] of [0, 1, 2, 4].map((k) => [t[k], ['grass', 'meadow', 'paving', 0, 'membrane'][k]])) {
    assert.deepEqual([x.magFilter, x.minFilter, x.generateMipmaps, x.anisotropy, x.encoding, x.wrapS, x.wrapT, x.uploads], [1006, 1008, true, 4, 3001, 1000, 1000, 1], kind);
    assert.ok(Math.abs(E.mock.raw(x.repeat).x - 1 / PC.data.textures[kind].tileM) < 1e-12, kind + ' repeat');
    assert.equal(x.image.data, PC.texgen.get(kind, 512).data, kind + ' cached pixels');
  }
  const ground = E.mock.raw(E.world.getObjectByName('groundPlot').material), outer = E.mock.raw(E.world.getObjectByName('groundOuter').material);
  assert.deepEqual([E.mock.raw(ground.map).image.data, E.mock.raw(outer.map).image.data], [PC.texgen.get('grass', 512).data, PC.texgen.get('meadow', 512).data]);
  const live = () => [E.mock.created.geometries.filter((g) => !g.disposed).length, E.mock.created.materials.filter((m) => !m.disposed).length, E.mock.created.textures.filter((x) => !x.disposed).length];
  const before = live(), gen = PC.texgen.generated;
  for (let k = 0; k < 20; k++) {
    const h2 = JSON.parse(JSON.stringify(E.house)); h2.key = 'leak-' + k;
    PC.view3d.close(); PC.view3d.open(h2, E.canvas, () => {}); E.raf.flush(); E.timer.flush();
    assert.deepEqual(live(), before, 'rebuild ' + k);
  }
  assert.equal(PC.texgen.generated, gen, 'pixels generated once per page session');
  const low = opened(null, null, {});
  low.mock.raw(low.info().renderer);    // anisotropy is capped by the renderer's maximum
  assert.equal(Math.min(4, low.info().renderer.capabilities.getMaxAnisotropy()), 4);
});

test('on-demand shadow map (CTO conditions): autoUpdate false; build, every applyLook, the level selector, the Roof switch (finder and tour too), a re-fit and a context restore request one update; orbit, zoom, flight and tour frames do not; the highlight casts no shadow', () => {
  const E = opened((PC) => maxHouse(PC)), PC = E.PC, V = PC.view3d, sm = E.mock.raw(E.mock.raw(E.info().renderer).shadowMap), R = E.mock.raw(E.info().renderer);
  assert.equal(sm.autoUpdate, false);
  const n = () => E.info().shadowUpdates, frame = () => { E.raf.tick(16); };
  frame();
  const triggers = [
    ['setLook', () => V.setLook({ hour: 17.5 })],
    ['season (canopy visibility)', () => V.setLook({ season: 'winter' })],
    ['level G', () => V.setLevel('G')], ['level all', () => V.setLevel('all')],
    ['roof off', () => V.setRoof(false)], ['roof on', () => V.setRoof(true)],
    ['finder pick (roof off, level)', () => PC.three.finder.goTo(E.house.levels[1].rooms[0].id)],
    ['re-fit', () => E.ro.trigger(500, 700)],
    ['context restore', () => { E.canvas.dispatch('webglcontextlost'); E.canvas.dispatch('webglcontextrestored'); }]
  ];
  for (const [name, fn] of triggers) {
    const a = n(); fn();
    assert.ok(n() > a, name + ' requests a shadow update');
    const s0 = R.shadowRenders; frame(); E.raf.flush(3);
    assert.equal(R.shadowRenders, s0 + 1, name + ': the next frames draw the shadow map exactly once');
  }
  PC.three.finder.goTo(E.house.levels[1].rooms[0].id);
  assert.equal(E.info().highlight.castShadow, false);
  // camera-only frames: orbit keys, zoom, a flight
  for (let k = 0; k < 120; k++) frame();
  const a = n(), s0 = R.shadowRenders;
  for (const key of ['ArrowLeft', 'ArrowUp', '+', '-']) { E.canvas.dispatch('keydown', { key }); frame(); }
  V.flyTo(Object.assign({}, V.pose(), { radius: V.pose().radius * 1.3 }), 500);
  for (let k = 0; k < 40; k++) frame();
  assert.deepEqual([n(), R.shadowRenders, sm.needsUpdate], [a, s0, false], 'no shadow work for camera moves');
  // the tour: its own stops change level / roof (updates); its frames between stops do not
  PC.three.tour.start({});
  let frames = 0, stops = 0, last = n();
  for (let k = 0; k < 400 && PC.three.tour.running(); k++) { frame(); frames++; if (n() !== last) { stops++; last = n(); } }
  assert.ok(stops > 0 && stops < frames / 5, `tour: ${stops} update requests over ${frames} frames`);
});

test('roofOnOpen: the view opens with the Roof on (exterior mode); the session keeps a switched-off Roof across a rebuild', () => {
  const E = opened(), V = E.PC.view3d;
  assert.deepEqual([E.info().roof, E.world.getObjectByName('roof').visible], [true, true]);
  V.setRoof(false);
  const h2 = E.PC.house.build(sampleApproved(E.PC, (d) => { d.ans.exterior = 'grey'; }));
  V.close(); V.open(h2, E.canvas, () => {}); E.raf.flush(); E.timer.flush();
  assert.deepEqual([E.info().builds, E.info().roof, E.world.getObjectByName('roof').visible], [2, false, false]);
});
