// ad-hoc probe helper: node tests/qa/probe.mjs <viewportTag> '<js run in page after __qa load>'
import { readFileSync } from 'node:fs'; import { join } from 'node:path';
import { ROOT, VIEWPORTS, launch, openPage } from './lib.mjs';
const vp = VIEWPORTS.find((v) => v.tag === process.argv[2]); const b = await launch();
const { page } = await openPage(b, vp); await page.evaluate(readFileSync(join(ROOT, 'tests/qa/inpage.js'), 'utf8'));
const out = await page.evaluate(process.argv[3]); console.log(JSON.stringify(out, null, 1));
if (process.argv[4]) await page.screenshot({ path: process.argv[4] });
await b.close();
