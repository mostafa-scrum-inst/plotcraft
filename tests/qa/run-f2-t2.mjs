// Runs all QA checks for F2-T2. Usage: node tests/qa/run-f2-t2.mjs [--no-shots]
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f2-t2-questions.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F2-T2: FAILED (${bad} suite(s) with failures)` : '\nQA F2-T2: all checks passed'); process.exit(bad ? 1 : 0);
