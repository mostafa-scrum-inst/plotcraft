// G1 build targets and their lint (G-plan 4): one shell, two pages; the /gpu page's bootstrap is the only exemption.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shellFor, scriptsFor, TARGETS, GPU_URL as BUILD_GPU_URL } from '../../build-targets.mjs';
import { scanHtml, scanExternal, scanExternalGpu, scanBudget, scanVendor, GPU_BOOT, GPU_URL, THREE_TAG, lintProject } from '../lint-constraints.mjs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const man = JSON.parse(read('src/manifest.json'));
const std = read('dist/index.html'), gpu = read('dist/gpu/index.html');

test('shellFor keeps only the target\'s blocks, without the marker lines', () => {
  const src = 'a\n<!--@IF standard-->\nS\n<!--@END-->\n<!--@IF gpu-->\nG\n<!--@END-->\nb\n';
  assert.equal(shellFor(src, 'standard'), 'a\nS\nb\n');
  assert.equal(shellFor(src, 'gpu'), 'a\nG\nb\n');
  assert.throws(() => shellFor('<!--@IF other-->\nx\n<!--@END-->\n', 'gpu'), /unknown target/);
  assert.deepEqual(TARGETS, ['standard', 'gpu']);
  assert.equal(BUILD_GPU_URL, GPU_URL);
});

test('scripts per target: manifest.js stays the standard list; the adapters swap places', () => {
  const s = scriptsFor(man, 'standard').map((j) => j.file), g = scriptsFor(man, 'gpu').map((j) => j.file);
  assert.deepEqual(s, man.js.map((j) => j.file), 'the standard page = manifest.js, in order');
  assert.ok(s.includes('js/three/gfx-r128.js') && !s.includes('gpu/three/gfx-webgpu.js'));
  assert.ok(g.includes('gpu/three/gfx-webgpu.js') && !g.includes('js/three/gfx-r128.js'));
  assert.equal(g.indexOf('gpu/three/gfx-webgpu.js'), s.indexOf('js/three/gfx-r128.js'), 'same slot');
  assert.deepEqual(g.filter((f) => f !== 'gpu/three/gfx-webgpu.js'), s.filter((f) => f !== 'js/three/gfx-r128.js'), 'everything else shared, same order');
});

test('built pages: one inline script per file, the right adapter and the right three.js reference on each', () => {
  for (const [html, t] of [[std, 'standard'], [gpu, 'gpu']]) {
    const files = scriptsFor(man, t).map((j) => j.file), at = files.map((f) => html.indexOf(`<script>/* ${f} */\n`));
    assert.ok(at.every((i, k) => i > 0 && (k === 0 || i > at[k - 1])), t + ': every file once, in order');
  }
  assert.equal(std.split(THREE_TAG).length, 2, 'standard: the r128 tag');
  assert.ok(!std.includes(GPU_URL) && !std.includes('PC.boot3d'), 'standard: no bootstrap');
  assert.ok(!gpu.includes('three.js/r128') && gpu.includes('<script>' + GPU_BOOT + '</script>'), 'gpu: the bootstrap, no r128');
  assert.ok(std.includes('data-alt="gpu"') && std.includes('High-end 3D (WebGPU)'), 'standard: the CD-12 link (href set by shell.js)');
  assert.ok(gpu.includes('data-alt="standard"') && gpu.includes('Standard version') && gpu.includes('This device or browser does not support WebGPU.'), 'gpu: links back + CD-11 text');
  for (const h of [std, gpu]) assert.ok(!/\shref\s*=\s*"(?!#|data:)/.test(h), 'no href besides #fragments and data: (A-3, QA F1-T1)');
  assert.deepEqual([scanExternal(std, 's'), scanExternalGpu(gpu, 'g'), scanBudget(gpu, 'g'), scanVendor(gpu, 'g')], [[], [], [], []]);
  assert.deepEqual(lintProject().violations, []);
});

test('gpu lint: only the exact bootstrap is exempt, and only from import-dynamic / ui-no-three', () => {
  assert.deepEqual(scanHtml(gpu, 'g', {}, 'gpu'), []);
  assert.ok(scanHtml(gpu, 's', {}, 'standard').some((v) => v.includes('import-dynamic')), 'the same text on the standard page fails');
  const changed = gpu.replace(GPU_BOOT, GPU_BOOT.replace("settle('failed')", "settle('broken')"));
  assert.ok(scanHtml(changed, 'g', {}, 'gpu').some((v) => v.includes('import-dynamic')), 'a changed bootstrap loses the exemption');
  const plant = (needle, add) => { assert.ok(gpu.includes(needle), needle); return scanHtml(gpu.replace(needle, needle + add), 'g', {}, 'gpu'); };
  assert.ok(plant('/* js/main.js */', '\nimport("./x.js");').some((v) => v.includes('import-dynamic')), 'an app script may not import');
  assert.ok(plant('/* js/main.js */', '\nfetch("/x");').some((v) => v.includes('fetch')));
  assert.ok(plant('/* gpu/three/gfx-webgpu.js */', '\nalert(1);').some((v) => v.includes('native-dialog')), 'the gpu adapter keeps every rule');
  assert.equal(scanExternalGpu(gpu.replace('</body>', '<img src="https://example.com/a.png"></body>'), 'g').length, 2, 'an extra URL / src');
  assert.ok(scanExternalGpu(gpu.replace('</body>', THREE_TAG + '</body>'), 'g').length >= 1, 'the r128 tag on /gpu');
  assert.ok(scanExternalGpu(gpu.replace(GPU_URL, GPU_URL.replace('0.180.0', '0.181.0')), 'g').length >= 1, 'another version');
  assert.equal(scanVendor('/** Copyright 2010-2025 Three.js Authors */', 'x').length, 1, 'the 0.180 banner never inlined');
});
