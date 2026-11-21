// Runs all QA checks for F2-T3. Usage: node tests/qa/run-f2-t3.mjs [--no-shots]
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f2-t3-site-rooms.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F2-T3: FAILED (${bad} suite(s) with failures)` : '\nQA F2-T3: all checks passed'); process.exit(bad ? 1 : 0);
