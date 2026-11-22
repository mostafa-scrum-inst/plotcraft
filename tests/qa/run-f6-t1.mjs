// Runs the QA checks for F6-T1 (realism MVP). Usage: node tests/qa/run-f6-t1.mjs [--no-shots] [--force]
// f6-t1-view.mjs: budgets, horizon seam, sky dome colour, unlit highlight (real r128); f6-t1-leak.mjs: the CTO's
// random-operation leak probe (50 ops on the sample at 960x600; the 200-op maximum-house stream is its own release step: node tests/qa/f6-t1-leak.mjs --max-only, run-all --only leak-max). Both version-aware on the
// F6-T1 tier record / PC.texgen. Roof-independent suites use tests/qa/v3kit.mjs roofTo (TL ruling on roofOnOpen).
import { spawnSync } from 'node:child_process'; import { join } from 'node:path'; import { ROOT } from './lib.mjs';
let bad = 0;
for (const f of ['f6-t1-view.mjs', 'f6-t1-leak.mjs']) { const r = spawnSync('node', [join(ROOT, 'tests/qa', f), ...process.argv.slice(2)], { stdio: 'inherit', cwd: ROOT }); if (r.status) bad++; }
console.log(bad ? `\nQA F6-T1: FAILED (${bad} suite(s) with failures)` : '\nQA F6-T1: all checks passed'); process.exit(bad ? 1 : 0);
