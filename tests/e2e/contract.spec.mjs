// The built page against the machine-readable UI contract (tests/contract/hooks.json, values.json).
import { readFileSync } from 'node:fs';
import { launch, open, suite, VIEWPORTS } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const read = (f) => JSON.parse(readFileSync(new URL('../contract/' + f, import.meta.url), 'utf8'));
const hooks = read('hooks.json'), values = read('values.json');
const T = suite('e2e contract'), browser = await launch();
try {
  const { ctx, page, problems } = await open(browser, VIEWPORTS[2]);
  T.none(await A.hookContract(page, hooks), 'hooks.json matches the page');
  T.none(await A.choiceValues(page, values), 'values.json matches the page');
  T.ok(Array.isArray(hooks.document) && hooks.document.length >= 200, 'contract lists the document hooks');
  T.none(problems(), 'no errors, native dialogs or stray requests');
  await ctx.close();
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
