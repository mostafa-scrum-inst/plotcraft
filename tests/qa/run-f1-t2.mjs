// Runs all QA checks for F1-T2. Usage: node tests/qa/run-f1-t2.mjs [--no-shots]   (exit code 0 = pass)
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f1-t2-flows.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F1-T2: FAILED (${bad} suite(s) with failures)` : '\nQA F1-T2: all checks passed'); process.exit(bad ? 1 : 0);
