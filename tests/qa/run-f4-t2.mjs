// Runs the QA checks for F4-T2 proper. Usage: node tests/qa/run-f4-t2.mjs [--no-shots]   (Step 0: run-f4-t2-step0.mjs)
// f4-t2-model.mjs: node, vm r128 (furniture, roof, wall / gate, seating, pool, needle, budget) with QA's own oracles;
// f4-t2-view.mjs: real r128 in the page (Roof switch, Q18 / Q19, Q17 gate, seating warning, maximum house + context loss,
// Undo across tabs).
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f4-t2-model.mjs', 'f4-t2-view.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F4-T2: FAILED (${bad} suite(s) with failures)` : '\nQA F4-T2: all checks passed'); process.exit(bad ? 1 : 0);
