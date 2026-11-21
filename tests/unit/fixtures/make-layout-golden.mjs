// Writes layout-golden.json: the generator's output before the F3-T2 retry. Run it ONLY before a deliberate
// change of the first pass (node tests/unit/fixtures/make-layout-golden.mjs); layout-golden.test.mjs then proves
// that every success recorded here is unchanged. Sweep successes are stored as short hashes; fixed cases in full.
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadCore, plain } from '../../helpers/load.mjs';
import { programmes } from '../../helpers/programmes.mjs';
import { fixedCases } from './layout-cases.mjs';

const PC = loadCore(), Y = PC.layout;
const h = (x) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
const sweep = programmes(PC.C).map(({ inp }) => { const r = plain(Y.generate(inp)); return r.ok ? h(r) : null; });
const fixed = fixedCases(PC).map(({ name, inp }) => ({ name, inp, out: plain(Y.generate(inp)) }));
writeFileSync(new URL('./layout-golden.json', import.meta.url), JSON.stringify({ note: 'F3-T1 generator output (before the F3-T2 retry); see make-layout-golden.mjs', sweep, fixed }) + '\n');
console.log(`golden: ${sweep.filter(Boolean).length} sweep successes of ${sweep.length}, ${fixed.length} fixed cases (${fixed.filter((f) => f.out.ok).length} ok)`);
