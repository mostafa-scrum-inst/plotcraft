// Runs all QA checks for F2-T1 (pure logic, node only). Usage: node tests/qa/run-f2-t1.mjs [--no-shots]   (flag accepted, ignored)
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f2-t1-site.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F2-T1: FAILED (${bad} suite(s) with failures)` : '\nQA F2-T1: all checks passed'); process.exit(bad ? 1 : 0);
