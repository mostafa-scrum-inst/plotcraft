// G1 adapter (PC.gfx, G-plan 3.1 / 8): the standard page runs the r128 adapter, every version-specific call goes
// through it, and the /gpu adapter file loads without THREE and without touching anything at load.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load3d } from '../helpers/load3d.mjs';
import { sampleApproved } from '../helpers/houses.mjs';
import { SRC } from '../helpers/load.mjs';

test('the standard page loads the r128 adapter; PC.three.col delegates to PC.gfx.col', () => {
  const E = load3d(), PC = E.PC;
  assert.equal(PC.gfx.name, 'r128');
  assert.equal(PC.gfx.lightK, 1);
  assert.equal(PC.gfx.tier, null, 'the tier comes from the pointer kind (PC.C.VIEW3D.tier) as before');
  const calls = [], col = PC.gfx.col;
  PC.gfx.col = function (hex) { calls.push(hex); return col(hex); };
  const c = PC.three.col('#336699');
  assert.deepEqual(calls, ['#336699']);
  assert.ok(Math.abs(c.r - Math.pow((0x33 / 255 + 0.055) / 1.055, 2.4)) < 1e-6, 'sRGB -> linear, as before');
});

test('open / build / look / precompile reach the adapter (r128: synchronous continuations)', () => {
  const E = load3d(), PC = E.PC, seen = [];
  for (const k of ['make', 'materials', 'look', 'precompile', 'exposure', 'shadowsDirty', 'texSpace', 'maxAniso', 'maxTex', 'watch']) {
    const f = PC.gfx[k];
    PC.gfx[k] = function () { seen.push(k); return f.apply(this, arguments); };
  }
  const log = [], h = PC.house.build(sampleApproved(PC));
  PC.view3d.open(h, E.canvas, (s) => log.push(s));
  E.raf.flush(); E.timer.flush(); E.raf.flush();
  assert.deepEqual(log, ['building', 'ready']);
  for (const k of ['make', 'watch', 'maxTex', 'texSpace', 'maxAniso', 'materials', 'look', 'exposure', 'shadowsDirty', 'precompile']) assert.ok(seen.includes(k), k);
  const i = PC.view3d.info();
  assert.deepEqual([i.gfx, i.compiling, i.building, i.builds], ['r128', false, false, 1]);
});

test('the /gpu adapter file loads without THREE, defines PC.gfx and starts nothing', () => {
  const ctx = vm.createContext({ setTimeout: (f) => f() });
  vm.runInContext(readFileSync(join(SRC, 'gpu/three/gfx-webgpu.js'), 'utf8'), ctx, { filename: 'gfx-webgpu.js' });
  const g = ctx.PC.gfx;
  assert.equal(g.name, 'webgpu');
  assert.equal(g.tier, 'full');
  assert.equal(g.lightK, Math.PI);
  assert.equal(g.available(), false, 'no bootstrap: unavailable');
  let err = null;
  g.make({}, 1, (e) => { err = e; });
  assert.ok(err && /three\.js did not load: missing/.test(err.message), 'make() without the bootstrap reports an error: ' + (err && err.message));
});
