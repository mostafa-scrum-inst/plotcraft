// Runs the QA checks for F4-T3. Usage: node tests/qa/run-f4-t3.mjs [--no-shots]
// f4-t3-model.mjs: node (sky model vs the Designer's golden table and QA's A-13 oracle, scatter rules, shortfall warning);
// f4-t3-view.mjs: real r128 in the page (Light tab, look in the scene, shadow fit, session look, vegetation meshes,
// phone layout, shortfall warning in the UI). Both are version-aware: without the F4-T3 markers they only note the skip.
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f4-t3-model.mjs', 'f4-t3-view.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F4-T3: FAILED (${bad} suite(s) with failures)` : '\nQA F4-T3: all checks passed'); process.exit(bad ? 1 : 0);
