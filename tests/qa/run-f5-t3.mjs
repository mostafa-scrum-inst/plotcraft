// Runs the QA checks for F5-T3a. Usage: node tests/qa/run-f5-t3.mjs [--no-shots] [--only=M,A,B,C,D]
// f5-t3-view.mjs: node lens-shift oracle + real r128 pages (desktop lens shift and orbit pivot, 640x360 side by side,
// tour caption vs the panel, toasts / no-save chip / read-only resume). Version-aware on PC.cam.viewOffset.
// Related F5-T3a checks live in their feature suites: f4-t3 (O-1 sky golden + shadow metric), f2-t3 F (A-15 label culling),
// f3-t2-editor 4 (a handle over the stair starts a resize).
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f5-t3-view.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F5-T3: FAILED (${bad} suite(s) with failures)` : '\nQA F5-T3: all checks passed'); process.exit(bad ? 1 : 0);
