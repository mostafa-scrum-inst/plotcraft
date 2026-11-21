// Runs all QA checks for F3-T3 (3D look / furniture / sky tables, stage-4 hints, Q10 swatches). Usage: node tests/qa/run-f3-t3.mjs [--no-shots]
// f3-t3-data.mjs is node only (own A-10 mix, A-13 blend and A-11 placement oracle in f3-t3-ref.mjs); f3-t3-look.mjs drives the browser.
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f3-t3-data.mjs', 'f3-t3-look.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F3-T3: FAILED (${bad} suite(s) with failures)` : '\nQA F3-T3: all checks passed'); process.exit(bad ? 1 : 0);
