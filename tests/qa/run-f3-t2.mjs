// Runs all QA checks for F3-T2 (plan editor, approval, interior stage, generator retry). Usage: node tests/qa/run-f3-t2.mjs [--no-shots]
// The retry cases live in f3-t1-plans.mjs section 7 (run by run-f3-t1.mjs); this runner covers the editor itself.
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f3-t2-edit.mjs', 'f3-t2-editor.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F3-T2: FAILED (${bad} suite(s) with failures)` : '\nQA F3-T2: all checks passed'); process.exit(bad ? 1 : 0);
