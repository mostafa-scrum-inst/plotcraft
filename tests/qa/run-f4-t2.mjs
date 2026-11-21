// Runs all QA checks for F4-T2 (Step 0 so far). Usage: node tests/qa/run-f4-t2.mjs [--no-shots]
// f4-t2-s0-core.mjs is node only (CD-4 plans, generator identity vs pre-Step-0 layout.js, CD-5 / low-fill / CTO items with
// QA's own oracles in f4-t2-ref.mjs); f4-t2-s0-ui.mjs drives the built page (Undo, CD-5 live, low fill, ft minimum, strip).
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f4-t2-s0-core.mjs', 'f4-t2-s0-ui.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F4-T2: FAILED (${bad} suite(s) with failures)` : '\nQA F4-T2: all checks passed'); process.exit(bad ? 1 : 0);
