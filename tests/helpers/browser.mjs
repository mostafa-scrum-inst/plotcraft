// Playwright helpers for tests/e2e (A-16). Headless system Chrome, dist/index.html over file://.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { ROOT } from './load.mjs';

export const DIST = join(ROOT, 'dist', 'index.html');
export const DIST_URL = pathToFileURL(DIST).href;
export const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
export const VIEWPORTS = [
  { tag: '360x640', w: 360, h: 640, touch: true },
  { tag: '768x1024', w: 768, h: 1024, touch: true },
  { tag: '1280x800', w: 1280, h: 800, touch: false }
];
export const LANDSCAPE = { tag: '640x360', w: 640, h: 360, touch: true };

export async function launch() {
  const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
  return chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
}

const STORAGE = {
  // Reading the property itself throws (blocked storage, sandboxed frame).
  throw: () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } }); },
  // Reads work, every write throws (quota).
  quota: () => { Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; }
};

// opts: three 'abort' (default) | 'mock'; storage 'normal' | 'throw' | 'quota'; init: function run before page scripts.
// Returns { ctx, page, log, hook, act, problems }. log collects page errors, console errors, native dialogs, requests.
export async function open(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  const log = { errors: [], dialogs: [], requests: [] };
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('file:')) return route.continue();
    log.requests.push(u);
    if (u === THREE_URL && opts.three === 'mock')
      return route.fulfill({ contentType: 'application/javascript', body: readFileSync(join(ROOT, 'tests', 'three-mock.js'), 'utf8') });
    return route.abort();
  });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // The one accepted console error: the aborted three.js request, only in suites that abort it (A-16).
    if (opts.three !== 'mock' && m.location().url === THREE_URL && /Failed to load resource/.test(m.text())) return;
    log.errors.push('console.error: ' + m.text());
  });
  page.on('dialog', (d) => { log.dialogs.push(d.type() + ': ' + d.message()); d.dismiss().catch(() => {}); });
  if (opts.storage && STORAGE[opts.storage]) await page.addInitScript(STORAGE[opts.storage]);
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(DIST_URL);
  const hook = (h) => page.locator(`[data-pc="${h}"]`);
  const act = (h) => (vp.touch ? hook(h).tap() : hook(h).click());
  // Everything that must be empty at the end of any scenario.
  const problems = () => [
    ...log.errors, ...log.dialogs.map((d) => 'native dialog: ' + d),
    ...log.requests.filter((u) => u !== THREE_URL).map((u) => 'unexpected request: ' + u)
  ];
  return { ctx, page, log, hook, act, problems };
}

// Waits until the page has run its pending zero-delay timers and painted two frames. Use this, not a fixed sleep,
// when the app reacts asynchronously without a state the test could poll (A-16: no fixed sleeps).
export const settled = (page) => page.evaluate(() => new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => r())), 0)));

// Minimal check collector for plain-node spec files.
export function suite(name) {
  let pass = 0; const fails = [];
  const ok = (cond, msg) => { if (cond) pass++; else { fails.push(msg); console.log('  FAIL ' + msg); } };
  return {
    ok,
    eq: (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`),
    none: (list, msg) => ok(list.length === 0, `${msg}: ${list.join(' | ')}`),
    done: () => { console.log(`[${name}] ${pass} passed, ${fails.length} failed`); return fails.length; }
  };
}
