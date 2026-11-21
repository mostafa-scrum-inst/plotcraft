// Runs all QA checks for F4-T1 (house model, 3D shell, stage-5 view). Usage: node tests/qa/run-f4-t1.mjs [--no-shots]
// f4-t1-model.mjs is node only (own A-5 / A-8 / A-9 / A-10 oracle in f4-t1-ref.mjs, shell built on the vendored real r128);
// f4-t1-view.mjs drives the built page with three: 'real' and three: 'mock' (and with three.js unavailable).
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f4-t1-model.mjs', 'f4-t1-view.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F4-T1: FAILED (${bad} suite(s) with failures)` : '\nQA F4-T1: all checks passed'); process.exit(bad ? 1 : 0);
