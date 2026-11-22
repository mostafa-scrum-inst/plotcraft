// Runs the QA checks for F5-T2. Usage: node tests/qa/run-f5-t2.mjs [--no-shots]
// f5-t2-model.mjs: node (tour plan: stops, eyes / looks, eye floor, times, fromEyeLook, clamp at stops);
// f5-t2-view.mjs: real r128 in the page (Start / Pause / Resume / speed / ends, per-leg caption / level / highlight, budget, basement stop, G1).
// Both are version-aware: without the F5-T2 markers (PC.tourplan, PC.three.tour) they only note the skip.
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f5-t2-model.mjs', 'f5-t2-view.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F5-T2: FAILED (${bad} suite(s) with failures)` : '\nQA F5-T2: all checks passed'); process.exit(bad ? 1 : 0);
