// PC.view3d against the strict THREE mock (A-10, A-11, G6; F4-T1 plan §4 and §9; TL required items 3 and 9).
import test from 'node:test';
import assert from 'node:assert/strict';
import { load3d } from '../helpers/load3d.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';
import { plain } from '../helpers/load.mjs';

// Opens the sample (or another state) and runs the Building... yield: returns the environment + state log.
function opened(o = {}) {
  const E = load3d(o), log = [];
  const s = o.state ? o.state(E.PC) : sampleApproved(E.PC);
  E.house = E.PC.house.build(s);
  E.res = E.PC.view3d.open(E.house, E.canvas, (x) => log.push(x));
  E.log = log;
  E.ready = () => { E.raf.flush(); E.timer.flush(); E.raf.flush(); };
  if (o.ready !== false) E.ready();
  E.info = () => E.PC.view3d.info();
  E.R = () => E.mock.raw(E.info().renderer);
  return E;
}
const names = (E) => { const n = []; E.info().scene.traverse((x) => n.push(x.name)); return n; };

test('every three file loads without THREE; open() then reports unavailable and requests nothing', () => {
  const E = load3d({ three: false }), log = [];
  assert.equal(typeof E.PC.view3d.open, 'function');
  assert.equal(typeof E.PC.three.BoxBatch, 'function');
  const r = E.PC.view3d.open({ key: 'x' }, E.canvas, (x) => log.push(x));
  assert.deepEqual([r.ok, log], [false, ['unavailable']]);
  assert.equal(E.raf.requested, 0);
});

test('a renderer that cannot start (no WebGL) -> unavailable, no throw; a missing house too', () => {
  const E = load3d(); E.mock.failRenderer = true;
  const log = [], h = E.PC.house.build(sampleApproved(E.PC));
  assert.doesNotThrow(() => E.PC.view3d.open(h, E.canvas, (x) => log.push(x)));
  assert.deepEqual(log, ['unavailable']);
  const F = load3d(), l2 = [];
  F.PC.view3d.open(null, F.canvas, (x) => l2.push(x)); assert.deepEqual(l2, ['unavailable']);
});

test('renderer settings (A-10): pixel ratio capped at 2, sRGB output, PCF soft shadows, setSize with false', () => {
  for (const [dpr, want] of [[3, 2], [1.5, 1.5], [1, 1]]) {
    const E = opened({ dpr }), R = E.R(), r = E.info().renderer;
    assert.equal(R.pixelRatio, want, 'dpr ' + dpr);
    assert.ok(R.calls.filter((c) => c[0] === 'setPixelRatio').every((c) => c[1] <= 2));
    assert.equal(r.outputEncoding, E.THREE.sRGBEncoding); assert.equal(r.shadowMap.enabled, true); assert.equal(r.shadowMap.type, E.THREE.PCFSoftShadowMap);
    assert.equal(R.options.antialias, true); assert.equal(R.options.canvas, E.canvas);
    assert.deepEqual(plain(R.size), [360, 400, false]);
  }
});

test('Building... paints first: building -> (rAF + timeout) -> build -> ready; exactly one render after it', () => {
  const E = opened({ ready: false });
  assert.deepEqual(E.log, ['building']);
  assert.equal(E.info().builds, 0);
  E.raf.flush();
  assert.equal(E.info().builds, 0, 'nothing is built inside the rAF callback (before the paint)');
  E.timer.flush();
  assert.deepEqual([E.log, E.info().builds], [['building', 'ready'], 1]);
  E.raf.flush();
  assert.equal(E.R().renders, 1);
  E.raf.flush(); E.raf.flush();
  assert.equal(E.R().renders, 1, 'idle: no further render');
});

test('close() during the Building... yield builds nothing and requests no frame; reopening restarts it', () => {
  const E = opened({ ready: false });
  E.PC.view3d.close();
  E.raf.flush(); E.timer.flush(); E.raf.flush();
  assert.deepEqual([E.info().builds, E.R().renders, E.log], [0, 0, ['building']]);
  E.PC.view3d.open(E.house, E.canvas, (x) => E.log.push(x));
  E.ready();
  assert.deepEqual([E.info().builds, E.R().renders], [1, 1]);
});

test('scene graph names, sample = 7 meshes, one shadow light with a 1024 map, lights from the noon table', () => {
  const E = opened(), n = names(E), i = E.info();
  for (const k of ['world', 'ground', 'groundOuter', 'groundPlot', 'groundCap', 'level-G', 'level-1', 'slab', 'walls', 'roof', 'site', 'hemi', 'sun']) assert.ok(n.includes(k), k);
  assert.equal(i.meshCount, 7);
  let shadow = 0; i.scene.traverse((x) => { if (x.name === 'sun' || x.name === 'hemi') { if (x.castShadow) shadow++; } });
  assert.equal(shadow, 1);
  const sun = i.scene.getObjectByName('sun');
  assert.deepEqual([sun.shadow.mapSize.x, sun.shadow.mapSize.y], [1024, 1024]);
  const L = E.PC.three.noonLook(), k = E.PC.data.sky.keys.find((x) => x.h === 12);
  assert.equal(L.hemiGround, E.PC.three.mixHex(k.hemiGround, E.PC.data.sky.seasons.summer.ground, E.PC.data.sky.groundBounce));
  const col = (h) => E.PC.three.col(h), eqc = (a, b) => ['r', 'g', 'b'].every((c) => Math.abs(a[c] - b[c]) < 1e-9);
  const hemi = i.scene.getObjectByName('hemi');
  assert.ok(eqc(hemi.color, col(k.hemiSky)) && eqc(hemi.groundColor, col(L.hemiGround)) && eqc(sun.color, col(k.sunColor)));
  assert.deepEqual([hemi.intensity, sun.intensity], [k.hemiI, k.sunI]);
  const bg = E.mock.raw(i.scene.background); assert.equal(bg.lin, false, 'background raw');
  assert.ok(Math.abs(bg.r - parseInt(k.background.slice(1, 3), 16) / 255) < 1e-9);
  // sun above the footprint centre, towards the south (away from north) at the summer elevation
  const s = E.PC.three.noonSunDir(E.house.northDeg, 72), t = sun.target.position, p = sun.position;
  const d = [p.x - t.x, p.y - t.y, p.z - t.z], len = Math.hypot(...d);
  assert.ok(d.every((x, j) => Math.abs(x / len - s[j]) < 1e-9));
  assert.ok(Math.abs(Math.asin(s[1]) - 72 * Math.PI / 180) < 1e-12);
});

test('G6 maximum house (3 floors + basement, 8 rooms, lift): no mock exception, <= 40 meshes (11 in F4-T1)', () => {
  const E = opened({ state: (PC) => maxHouse(PC), dpr: 3 });
  assert.equal(E.info().meshCount, 11);
  assert.ok(E.info().meshCount <= 40);
  assert.equal(E.R().renders, 1);
  assert.equal(E.R().pixelRatio, 2);
});

test('on-demand loop: idle requests nothing; close / hidden stop frames; reopen keeps the pose without a rebuild', () => {
  const E = opened(), base = E.raf.requested;
  E.raf.flush(); E.raf.flush();
  assert.equal(E.raf.requested, base, 'idle: zero frame requests');
  E.canvas.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(E.raf.requested, base + 1, 'one input -> one frame');
  E.canvas.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(E.raf.requested, base + 1, 'no second request while one is pending');
  E.raf.flush();
  const pose = E.PC.view3d.pose();
  E.PC.view3d.close();
  assert.equal(E.raf.pending(), 0);
  const n = E.raf.requested;
  E.canvas.dispatch('keydown', { key: 'ArrowLeft' }); E.PC.view3d.invalidate();
  assert.equal(E.raf.requested, n, 'closed: input requests no frame');
  E.PC.view3d.open(E.house, E.canvas, () => {});
  E.raf.flush();
  assert.deepEqual(E.PC.view3d.pose(), pose, 'same pose after reopen');
  assert.equal(E.info().builds, 1, 'same key: no rebuild');
  // hidden tab
  E.canvas.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(E.raf.pending(), 1);
  E.doc.setVisible(false);
  assert.equal(E.raf.pending(), 0, 'hidden cancels the pending frame');
  const m = E.raf.requested;
  E.canvas.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(E.raf.requested, m, 'hidden: input requests no frame');
  E.doc.setVisible(true);
  assert.equal(E.raf.requested, m + 1, 'visible again: one frame');
  E.raf.flush(); assert.equal(E.raf.pending(), 0);
});

test('resize: setSize(w, h, false) + aspect follow the canvas; 0 x 0 is skipped; pixel ratio re-applied', () => {
  const E = opened();
  E.ro.trigger(640, 360);
  assert.deepEqual(plain(E.R().size), [640, 360, false]);
  assert.ok(Math.abs(E.info().camera.aspect - 640 / 360) < 1e-12);
  const calls = E.R().calls.length;
  E.ro.trigger(0, 0);
  assert.equal(E.R().calls.length, calls, 'hidden stage: no setSize');
  E.setDpr(3); E.ro.trigger(500, 300);
  assert.equal(E.R().pixelRatio, 2);
});

test('near plane follows the orbit radius; far = 20 x house radius', () => {
  const E = opened(), cam = E.info().camera;
  assert.equal(cam.far, 20 * E.house.radius);
  const r = E.PC.view3d.pose().radius;
  assert.ok(Math.abs(cam.near - Math.max(0.5, 0.02 * r)) < 1e-12);
  for (let i = 0; i < 40; i++) E.canvas.dispatch('keydown', { key: '-' });
  E.raf.flush();
  const r2 = E.PC.view3d.pose().radius;
  assert.ok(r2 > r && Math.abs(cam.near - Math.max(0.5, 0.02 * r2)) < 1e-12);
});

test('context loss: preventDefault, no frames; restore rebuilds (old resources disposed once) and renders once', () => {
  const E = opened();
  const geos = E.mock.created.geometries.slice(), mats = E.mock.created.materials.slice();
  const ev = E.canvas.dispatch('webglcontextlost');
  assert.equal(ev.defaultPrevented, true);
  assert.equal(E.info().lost, true);
  const n = E.raf.requested;
  E.canvas.dispatch('keydown', { key: 'ArrowUp' });
  assert.equal(E.raf.requested, n, 'lost: no frames');
  const renders = E.R().renders;
  E.canvas.dispatch('webglcontextrestored');
  assert.deepEqual([E.info().lost, E.info().builds, E.info().restores], [false, 2, 1]);
  assert.equal(geos.length, 7);
  assert.ok(geos.every((g) => g.disposed === 1), 'every first-build geometry disposed exactly once');
  assert.ok(mats.length === 3 && mats.every((m) => m.disposed === 1), 'and every material');
  E.raf.flush();
  assert.equal(E.R().renders, renders + 1);
  assert.equal(E.info().meshCount, 7);
});

test('rebuild for a new key (Q10 changed) disposes everything of the first build exactly once; same key does not rebuild', () => {
  const E = opened();
  const g1 = E.mock.created.geometries.slice(), m1 = E.mock.created.materials.slice();
  const s2 = sampleApproved(E.PC, (d) => { d.ans.exterior = 'grey'; }), h2 = E.PC.house.build(s2);
  E.PC.view3d.close();
  E.PC.view3d.open(h2, E.canvas, () => {}); E.ready();
  assert.equal(E.info().builds, 2);
  assert.ok(g1.every((g) => g.disposed === 1) && m1.every((m) => m.disposed === 1));
  const g2 = E.mock.created.geometries.slice(g1.length);
  assert.ok(g2.length && g2.every((g) => g.disposed === 0));
  E.PC.view3d.open(h2, E.canvas, () => {}); E.ready();
  assert.equal(E.info().builds, 2);
});

test('level selector and roof (A-10): visibility matrix incl. the basement opening', () => {
  const E = opened({ state: (PC) => maxHouse(PC) }), w = E.info().world, V = E.PC.view3d;
  const vis = () => Object.fromEntries(['level-B', 'level-G', 'level-1', 'level-2', 'groundCap', 'roof'].map((k) => [k, w.getObjectByName(k).visible]));
  assert.deepEqual(vis(), { 'level-B': true, 'level-G': true, 'level-1': true, 'level-2': true, groundCap: true, roof: false }, 'opens on All, roof off');
  V.setLevel('1'); assert.deepEqual(vis(), { 'level-B': true, 'level-G': true, 'level-1': true, 'level-2': false, groundCap: true, roof: false });
  V.setLevel('G'); assert.deepEqual(vis(), { 'level-B': true, 'level-G': true, 'level-1': false, 'level-2': false, groundCap: true, roof: false });
  V.setLevel('B'); assert.deepEqual(vis(), { 'level-B': true, 'level-G': false, 'level-1': false, 'level-2': false, groundCap: false, roof: false });
  V.setRoof(true); assert.equal(vis().roof, false, 'roof only with All');
  V.setLevel('all'); assert.deepEqual(vis(), { 'level-B': true, 'level-G': true, 'level-1': true, 'level-2': true, groundCap: true, roof: true });
  V.setRoof(false); assert.equal(vis().roof, false);
  E.raf.flush(); const n = E.raf.requested; V.setLevel('2'); assert.equal(E.raf.requested, n + 1, 'a selection change renders one frame');
});

test('Reset view: the aspect-aware reset pose; colour audit passed on every render (no mock throw)', () => {
  const E = opened();
  for (let i = 0; i < 5; i++) E.canvas.dispatch('keydown', { key: 'ArrowUp' });
  E.raf.flush();
  E.PC.view3d.resetView(); E.raf.flush();
  assert.deepEqual(E.PC.view3d.pose(), E.PC.cam.reset(E.house, 360 / 400));
  assert.ok(E.R().renders >= 2);
});
