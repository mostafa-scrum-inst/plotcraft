// G2 tiers (G-plan 6): per-tier shadowMap / aniso fields keep the standard page's choices (F6-T1a), the ultra record,
// and the /gpu adapter's frame probe (pure JS, run here with a fake renderer, view and timers).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load3d } from '../helpers/load3d.mjs';
import { SRC } from '../helpers/load.mjs';

test('pickTier: the per-tier fields give the F6-T1a choices on full and lite, and the ultra record', () => {
  const PC = load3d().PC, pick = PC.three.pickTier;
  const f = (env) => { const t = pick(env); return [t.name, t.shadowMap, t.maxDpr, t.tex, t.treeDetail, t.aniso, t.shadowBias, t.shadowNormalBias, !!t.probe]; };
  // as before G2: 2048 only on fine pointers with maxTextureSize >= 4096 in the full tier; 1024 otherwise
  assert.deepEqual(f({ coarse: false, maxTex: 16384 }), ['full', 2048, 2, 512, 1, 4, -0.0005, 0.02, false]);
  assert.deepEqual(f({ coarse: true, maxTex: 16384 }), ['full', 1024, 2, 512, 1, 4, -0.0005, 0.02, false]);
  assert.deepEqual(f({ coarse: false, maxTex: 2048 }), ['full', 1024, 2, 512, 1, 4, -0.0005, 0.02, false]);
  assert.deepEqual(f({ coarse: false, maxTex: 16384, force: 'lite' }), ['lite', 1024, 1.5, 256, 0, 4, -0.0005, 0.02, false]);
  assert.deepEqual(f({ coarse: false, maxTex: 8192, force: 'ultra' }), ['ultra', 4096, 2, 1024, 2, 16, -0.0005, 0.01, true]);
  assert.equal(pick({ coarse: false, maxTex: 8192, force: 'nope' }).name, 'full');
});

// The /gpu adapter file in a vm: no THREE needed for frame() and the probe.
function gpuAdapter() {
  const timers = [];
  const ctx = vm.createContext({ setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].f = null; } });
  vm.runInContext(readFileSync(join(SRC, 'gpu/three/gfx-webgpu.js'), 'utf8'), ctx, { filename: 'gfx-webgpu.js' });
  const log = [], view = { busy: () => false, dpr: (k, draw) => log.push(['dpr', k, draw]), retier: (n) => log.push(['retier', n]) };
  const r = { _nodes: { nodeFrame: { frameId: 0, update() { this.frameId++; } } }, info: { autoReset: true, frame: 0, reset() {} } };
  const tier = { moving: { frames: 10, slowMs: 20, dpr: 1.5, gapMs: 250, restMs: 300 }, probe: { frames: 30, slowMs: 24, down: 'full' } };
  let ts = 1000;
  const frames = (n, dt, chained = true) => { for (let k = 0; k < n; k++) { ts += dt; ctx.PC.gfx.frame(r, { ts, chained, tier, view }); } };
  const rest = () => { const t = timers.filter((x) => x.f).pop(), f = t && t.f; timers.forEach((x) => { x.f = null; }); if (f) f(); return !!f; };
  return { g: ctx.PC.gfx, log, frames, rest, timers, tier, view };
}

test('probe: slow moving frames lower the pixel ratio, rest brings it back; fast frames keep ultra', () => {
  const A = gpuAdapter();
  A.frames(1, 5000, false);                                  // the first frame after idle: not timed
  A.frames(9, 40);
  assert.deepEqual(A.log, [], 'nine slow frames: nothing yet');
  A.frames(1, 40);
  assert.deepEqual(A.log, [['dpr', 1.5, false]], 'the tenth: pixel ratio 1.5, drawn by this frame');
  A.frames(25, 10);
  assert.equal(A.g.stats.probeMs, 10, 'probe: 30 moving frames, median 10 ms');
  assert.ok(A.rest());
  assert.deepEqual(A.log, [['dpr', 1.5, false], ['dpr', null, true]], 'rest: the tier cap with one frame, no downgrade');
  A.frames(1, 400, false); A.frames(20, 10);
  assert.equal(A.log.length, 2, 'fast frames later: nothing');
  assert.equal(A.g.stats.downgrades, 0);
});

test('probe: slow throughout -> one downgrade at rest, not while busy, never twice; idle gaps are not timed', () => {
  const A = gpuAdapter();
  A.frames(5, 1000, false);                                  // frames far apart (clicks, not motion): not timed
  assert.equal(A.g.stats.probeMs, 0);
  A.frames(31, 50);
  assert.equal(A.g.stats.probeMs, 50);
  let busy = true;
  A.view.busy = () => busy;
  A.rest();
  assert.deepEqual(A.log, [['dpr', 1.5, false], ['dpr', null, true]], 'busy at rest (an animation): the pixel ratio back, no downgrade yet');
  A.frames(1, 1000, false);                                  // any later frame re-arms the rest timer while one is pending
  busy = false;
  assert.ok(A.rest());
  assert.deepEqual(A.log.slice(2), [['retier', 'full']], 'the downgrade, once');
  assert.equal(A.g.tier, 'full');
  // scene.js then passes the full record (no probe, no moving rule): slow frames change nothing
  delete A.tier.moving; delete A.tier.probe;
  A.frames(40, 50);
  assert.equal(A.rest(), false, 'no rest timer on full');
  assert.equal(A.log.length, 3, 'slow frames on full: nothing more');
  assert.equal(A.g.stats.downgrades, 1);
});
