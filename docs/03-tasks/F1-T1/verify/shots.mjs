// F1-T1 verification: assertions at the reference viewports + screenshots. Run: node docs/03-tasks/F1-T1/verify/shots.mjs
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from './assertions.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const dist = join(root, 'dist', 'index.html');
const shots = resolve(here, '../shots');
mkdirSync(shots, { recursive: true });
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
const contract = JSON.parse(readFileSync(join(here, 'hooks.json'), 'utf8'));
const values = JSON.parse(readFileSync(join(here, 'values.json'), 'utf8'));
const demo = readFileSync(join(here, 'demo.js'), 'utf8');

const VIEWPORTS = [
  { w: 360, h: 640, touch: true, assert: true }, { w: 768, h: 1024, touch: true, assert: true },
  { w: 1280, h: 800, touch: false, assert: true }, { w: 640, h: 360, touch: true, assert: true },
  { w: 360, h: 740, touch: true, assert: false }, { w: 1440, h: 900, touch: false, assert: false }
];

// name -> [setup run in the page, extra assertions]
const SCENARIOS = {
  's1-start': [() => { pcDemo.show(1); pcDemo.$('resume-box').hidden = false; pcDemo.$('note-nosave').hidden = false; pcDemo.plot(true); }, []],
  's1': [() => { pcDemo.show(1); pcDemo.plotDone(); pcDemo.plot(false); }, []],
  's1-strip': [() => { pcDemo.show(1); pcDemo.$('sample-strip').hidden = false; pcDemo.plotDone(); pcDemo.plot(false); }, ['stripClear']],
  's2-site': [() => { pcDemo.show(2); pcDemo.fillSummary('ok'); pcDemo.site(); }, ['oneQuestionVisible']],
  's2-site-strip': [() => { pcDemo.show(2); pcDemo.$('sample-strip').hidden = false; pcDemo.fillSummary('ok'); pcDemo.site(); }, ['oneQuestionVisible']],
  's2-building': [() => { pcDemo.show(2); pcDemo.qGroup('building'); pcDemo.fillSummary('ok'); if (pcDemo.$('site-canvas').getBoundingClientRect().width) pcDemo.site(); }, []],
  's2-rooms': [() => { pcDemo.show(2); pcDemo.qGroup('rooms'); pcDemo.fillRooms(); pcDemo.fillSummary('ok'); if (pcDemo.$('site-canvas').getBoundingClientRect().width) pcDemo.site(); }, []],
  's2-rooms-list': [() => { pcDemo.show(2); pcDemo.qGroup('rooms'); pcDemo.fillRooms(); pcDemo.fillSummary('ok'); if (pcDemo.$('site-canvas').getBoundingClientRect().width) pcDemo.site(); document.querySelector('.pc-rgroup').scrollIntoView(); }, []],
  's2-rooms-stairs': [() => { pcDemo.show(2); pcDemo.qGroup('rooms'); pcDemo.fillRooms(); pcDemo.fillSummary('ok'); if (pcDemo.$('site-canvas').getBoundingClientRect().width) pcDemo.site(); document.querySelector('[data-q="13"]').scrollIntoView(); }, []],
  's2-outdoor': [() => { pcDemo.show(2); pcDemo.qGroup('outdoor'); pcDemo.fillSummary('ok'); if (pcDemo.$('site-canvas').getBoundingClientRect().width) pcDemo.site(); }, []],
  's2-summary': [() => { pcDemo.show(2); pcDemo.fillSummary('block'); pcDemo.$('summary').classList.remove('is-collapsed'); pcDemo.$('summary-toggle').setAttribute('aria-expanded', 'true'); pcDemo.site(); pcDemo.$('q-footprint').setAttribute('aria-invalid', 'true'); pcDemo.$('q-footprint-err').hidden = false; pcDemo.$('q-footprint-err').textContent = 'Footprint + vegetation must not exceed 100 %.'; }, []],
  's2-preview-hidden': [() => { pcDemo.show(2); pcDemo.fillSummary('ok'); pcDemo.$('site-preview').classList.add('is-collapsed'); if (pcDemo.$('site-canvas').getBoundingClientRect().width) pcDemo.site(); }, []],
  's3': [() => { pcDemo.show(3); pcDemo.fillPlans('draft'); pcDemo.plan('draft'); }, []],
  's3-invalid': [() => { pcDemo.show(3); pcDemo.fillPlans('invalid'); pcDemo.$('plan-warn-panel').classList.remove('is-collapsed'); pcDemo.plan('invalid'); }, []],
  's3-approved': [() => { pcDemo.show(3); pcDemo.fillPlans('approved'); pcDemo.plan('approved'); }, []],
  's3-error': [() => { pcDemo.show(3); pcDemo.fillPlans('draft'); pcDemo.$('plan-error').hidden = false; pcDemo.plan('draft'); }, []],
  's4': [() => { pcDemo.show(4); }, []],
  's5': [() => { pcDemo.show(5); pcDemo.fill3d(); pcDemo.scene(); }, ['v3PanelThird']],
  's5-light': [() => { pcDemo.show(5); pcDemo.fill3d(); pane('light'); pcDemo.scene(); }, ['v3PanelThird']],
  's5-tour': [() => { pcDemo.show(5); pcDemo.fill3d(); pane('tour'); caption(); pcDemo.scene(); }, ['v3PanelThird', 'captionClear']],
  's5-collapsed': [() => { pcDemo.show(5); pcDemo.fill3d(); caption(); pcDemo.$('v3-panel').classList.add('is-collapsed'); pcDemo.scene(); }, ['captionClear']],
  's5-building': [() => { pcDemo.show(5); pcDemo.fill3d(); pcDemo.$('v3-building').hidden = false; }, []],
  's5-unavailable': [() => { pcDemo.show(5); pcDemo.fill3d(); pcDemo.$('v3-unavailable').hidden = false; pcDemo.$('v3-panel').hidden = true; }, []],
  'x-dialog': [() => { pcDemo.show(2); pcDemo.fillSummary('ok'); pcDemo.site(); pcDemo.$('dialog-layer').hidden = false; pcDemo.$('dialog-title').textContent = 'Remove the first floor?'; pcDemo.$('dialog-text').textContent = 'The first floor has 7 rooms.'; const x = pcDemo.tpl('tpl-level-remove'); pcDemo.part(x, 'level-remove-text').textContent = 'What should happen to them?'; pcDemo.$('dialog-extra').append(x); }, []],
  'x-banners': [() => { pcDemo.show(1); pcDemo.plotDone(); pcDemo.banner('info', 'Floor plans affected by this change will be regenerated.'); pcDemo.banner('warn', 'Vegetation reduced to 18 % to fit the plot.', 'Review'); pcDemo.banner('block', 'Plot too small: 42 m². Minimum is 50 m².'); pcDemo.banner('ok', 'All floors approved.'); pcDemo.toast('Approve all floors first'); pcDemo.plot(false); }, []],
  'x-steps': [() => { pcDemo.show(3); pcDemo.fillPlans('draft'); pcDemo.plan('draft'); }, []]
};
const HELPERS = `
  function pane(n){ ['view','light','tour'].forEach(k => { pcDemo.$('v3-pane-'+k).classList.toggle('is-current', k===n); pcDemo.$('v3-tab-'+k).setAttribute('aria-selected', k===n); }); }
  function caption(){ pcDemo.$('v3-caption').hidden = false; pcDemo.$('v3-caption-text').textContent = 'Master bedroom'; pcDemo.$('v3-caption-pause').hidden = false; pcDemo.$('v3-caption-stop').hidden = false; }
`;

const only = process.argv[2];
let pass = 0, fail = 0; const failures = [];
const check = (label, list) => { if (list.length) { fail++; failures.push(`${label}: ${list.join('; ')}`); } else pass++; };

check('documentHead', A.documentHead(readFileSync(dist, 'utf8')));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch, isMobile: vp.touch, deviceScaleFactor: vp.touch ? 2 : 1 });
  const tag = `${vp.w}x${vp.h}`;
  for (const [name, [setup, extra]] of Object.entries(SCENARIOS)) {
    if (only && !name.startsWith(only)) continue;
    const page = await ctx.newPage(); const errors = [], requests = [];
    page.on('pageerror', e => errors.push('pageerror ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/three\.min\.js|ERR_FAILED/.test(m.text() + (m.location().url || ''))) errors.push('console ' + m.text()); });
    page.on('dialog', d => { errors.push('native dialog'); d.dismiss(); });
    page.on('request', r => { if (!r.url().startsWith('file:')) requests.push(r.url()); });
    await page.route(/^https?:/, r => r.abort());
    await page.goto('file://' + dist);
    await page.addScriptTag({ content: demo });
    await page.evaluate(`(function(){ ${HELPERS}; (${setup.toString()})(); })()`);
    await page.waitForTimeout(250);
    if (vp.assert) {
      for (const fn of ['noPageScroll', 'tapTargets', 'stepperOneLine', 'barInViewport', 'canvasMin']) if (!(fn === 'canvasMin' && name === 'x-banners')) check(`${tag} ${name} ${fn}`, await A[fn](page));
      for (const fn of extra) { if (fn === 'v3PanelThird' && !(vp.w < 900 && vp.h > 480)) continue; check(`${tag} ${name} ${fn}`, await A[fn](page)); }
      if (name === 's1') {
        check(`${tag} hookContract`, await A.hookContract(page, contract));
        check(`${tag} choiceValues`, await A.choiceValues(page, values));
        check(`${tag} requests`, requests.length === 1 && requests[0].includes('three.js/r128/three.min.js') ? [] : ['requests: ' + requests.join(' | ')]);
      }
      check(`${tag} ${name} errors`, errors);
    }
    await page.screenshot({ path: join(shots, `${name}-${tag}.png`) });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`assertions: ${pass} passed, ${fail} failed`);
for (const f of failures) console.log('FAIL ' + f);
process.exit(fail ? 1 : 0);
