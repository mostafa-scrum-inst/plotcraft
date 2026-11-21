// Runs the QA checks for F5-T1. Usage: node tests/qa/run-f5-t1.mjs [--no-shots]
// f5-t1-model.mjs: node (room groups, A-14 finder pose through QA's A-12 clamp, target Y floor, basement eye line);
// f5-t1-view.mjs: real r128 in the page (room select, picks, flight, cancel, clearing, highlight, budget, phone caption).
// Both are version-aware: without the F5-T1 markers (PC.cam.forRoom, PC.view3d.flyTo, PC.three.finder) they only note the skip.
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f5-t1-model.mjs', 'f5-t1-view.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F5-T1: FAILED (${bad} suite(s) with failures)` : '\nQA F5-T1: all checks passed'); process.exit(bad ? 1 : 0);
