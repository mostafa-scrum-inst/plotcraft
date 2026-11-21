// QA shared helpers (reusable across tasks). Independent of the Designer's verify scripts.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIST = join(ROOT, 'dist', 'index.html');
export const DIST_URL = pathToFileURL(DIST).href;
export const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
export const VIEWPORTS = [
  { tag: '360x640', w: 360, h: 640, touch: true },
  { tag: '768x1024', w: 768, h: 1024, touch: true },
  { tag: '1280x800', w: 1280, h: 800, touch: false },
  { tag: '640x360', w: 640, h: 360, touch: true },
];
export const readDist = () => readFileSync(DIST, 'utf8');

export async function launch() {
  const require = createRequire('/opt/npm-tools/node_modules/');
  const { chromium } = require('playwright');
  return chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
}

// Opens dist/index.html. three.js request is aborted (no network here). Records requests, console errors, dialogs.
export async function openPage(browser, vp, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, hasTouch: !!vp.touch, isMobile: false,
    deviceScaleFactor: opts.dpr || 1, reducedMotion: opts.reducedMotion || 'no-preference',
  });
  const page = await ctx.newPage();
  const log = { requests: [], errors: [], dialogs: [] };
  // opts.three === 'mock' (F4-T1 onwards): the exact three.js URL is answered with the FS's THREE mock (tests/three-mock.js,
  // A-16) when that file exists; everything else is aborted as before. Default: abort (three.js unavailable).
  const MOCK = join(ROOT, 'tests/three-mock.js'), mock = opts.three === 'mock' && existsSync(MOCK) ? readFileSync(MOCK, 'utf8') : null;
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('file:')) return route.continue();
    log.requests.push(u);
    if (mock && u === THREE_URL) return route.fulfill({ status: 200, contentType: 'application/javascript', body: mock });
    return route.abort();
  });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource/.test(t) && /ERR_FAILED/.test(t)) return; // the aborted three.js request
    log.errors.push('console.error: ' + t);
  });
  page.on('dialog', (d) => { log.dialogs.push(d.type() + ': ' + d.message()); d.dismiss().catch(() => {}); });
  for (const fn of opts.init || []) await page.addInitScript(fn); // run before the page scripts on every load/reload
  if (opts.noGoto) return { ctx, page, log };
  await page.goto(DIST_URL);
  return { ctx, page, log };
}

// WCAG contrast helpers
export function parseColor(s) {
  s = s.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1);
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  throw new Error('cannot parse colour ' + s);
}
export const over = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1); };
export function lum(c) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
export function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

// Tiny result collector
export function collector(name) {
  // known: [{ re, bug }] = open minor bugs accepted by a QA report; matching problems are listed but do not fail the run.
  const res = { name, pass: 0, fail: 0, failures: [], notes: [], known: [], knownHits: [] };
  res.check = (label, problems) => {
    let list = Array.isArray(problems) ? problems : (problems ? [] : ['failed']);
    list = list.filter((p) => { const k = res.known.find((k) => k.re.test(`${label}: ${p}`)); if (k) res.knownHits.push(`[${k.bug}] ${label}: ${p}`); return !k; });
    if (list.length === 0) res.pass++; else { res.fail++; for (const p of list) res.failures.push(`${label}: ${p}`); }
  };
  res.note = (s) => res.notes.push(s);
  res.done = () => {
    console.log(`\n[${name}] ${res.pass} checks passed, ${res.fail} failed`);
    for (const f of res.failures) console.log('  FAIL ' + f);
    for (const k of res.knownHits) console.log('  KNOWN ' + k);
    for (const n of res.notes) console.log('  note ' + n);
    return res.fail === 0;
  };
  return res;
}

// Problems that must be empty at the end of every scenario (G5): errors, native dialogs, requests other than three.js.
export const cleanLog = (log) => [...log.errors, ...log.dialogs.map((d) => 'native dialog: ' + d), ...log.requests.filter((u) => u !== THREE_URL).map((u) => 'unexpected request: ' + u)];

// localStorage failure modes (init scripts). Written by QA, independent of tests/helpers/browser.mjs.
export const STORAGE_MODES = {
  'getter-throws': () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } }); },
  'undefined': () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { return undefined; } }); },
  'null': () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { return null; } }); },
  'all-throw': () => { for (const m of ['getItem', 'setItem', 'removeItem', 'key', 'clear']) Storage.prototype[m] = function () { throw new DOMException('denied', 'SecurityError'); }; },
  'set-throws': () => { Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; },
  // works at boot, then every write fails (quota reached / permission revoked mid-session)
  'late-fail': () => { const real = Storage.prototype.setItem; let n = 0; Storage.prototype.setItem = function (k, v) { if (++n > 1) throw new DOMException('full', 'QuotaExceededError'); return real.call(this, k, v); }; },
  // reads always fail, writes work
  'get-throws': () => { Storage.prototype.getItem = function () { throw new DOMException('denied', 'SecurityError'); }; },
};

// ---- 2D canvas test aids (F1-T3 onwards) ----
// Init script: records what is drawn on every 2D canvas in the last frame (text, line segments, circles), independent of
// the app's own debug hooks. Read with page.evaluate(() => __spy.frame('plot-canvas')).
export const CANVAS_SPY = () => {
  const P = CanvasRenderingContext2D.prototype, frames = new WeakMap();
  const f = (ctx) => { let r = frames.get(ctx.canvas); if (!r) { r = { texts: [], segs: [], arcs: [], n: 0 }; frames.set(ctx.canvas, r); } return r; };
  const wrap = (name, fn) => { const orig = P[name]; P[name] = function (...a) { try { fn(this, a); } catch (e) {} return orig.apply(this, a); }; };
  wrap('fillRect', (c, a) => { const s = c.getTransform().a || 1; if (a[0] === 0 && a[1] === 0 && a[2] * s >= c.canvas.width - 1 && a[3] * s >= c.canvas.height - 1) { const r = f(c); r.texts = []; r.segs = []; r.arcs = []; r.n++; } });
  wrap('fillText', (c, a) => { f(c).texts.push({ text: String(a[0]), x: a[1], y: a[2], font: c.font, fill: String(c.fillStyle), w: c.measureText(String(a[0])).width, align: c.textAlign, base: c.textBaseline }); });
  let last = null;
  wrap('moveTo', (c, a) => { last = [a[0], a[1]]; });
  wrap('lineTo', (c, a) => { if (last) f(c).segs.push([last[0], last[1], a[0], a[1]]); last = [a[0], a[1]]; });
  wrap('arc', (c, a) => { f(c).arcs.push({ x: a[0], y: a[1], r: a[2] }); });
  window.__spy = { frame: (hook) => { const cv = document.querySelector(`[data-pc="${hook}"]`); const r = frames.get(cv) || { texts: [], segs: [], arcs: [], n: 0 }; return JSON.parse(JSON.stringify(r)); } };
};

// Real multi-touch through CDP (Chrome turns it into Pointer Events). No settle delays: callers add waits on purpose.
export async function touchDriver(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: Math.round(p[0] * 10) / 10, y: Math.round(p[1] * 10) / 10, id: p[2] === undefined ? i : p[2] })) });
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // Pacing between injected touch events is done in animation frames of the page (Chrome delivers touch moves
  // frame-aligned), never in fixed sleeps. holdMs in tap() is the one real duration: it is the press length under test.
  const frames = (n = 1) => page.evaluate((n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const hold = (ms) => page.waitForTimeout(ms); // press duration (the thing under test: tap limit 700 ms)
  return {
    send,
    tap: async (p, holdMs = 0) => { await send('touchStart', [p]); if (holdMs) await hold(holdMs); else await frames(1); await send('touchEnd', []); },
    // one finger a -> b; whileDown() runs with the finger still down at b
    drag: async (a, b, { steps = 8, whileDown = null } = {}) => { await send('touchStart', [a]); for (let i = 1; i <= steps; i++) { await send('touchMove', [lerp(a, b, i / steps)]); await frames(1); } await frames(2); if (whileDown) await whileDown(); await send('touchEnd', []); },
    // two fingers (a0,b0) -> (a1,b1); lift: 'both' | 'second-first' | 'first-first'
    two: async (a0, b0, a1, b1, { steps = 8, lift = 'both' } = {}) => {
      await send('touchStart', [[...a0, 0]]); await frames(1); await send('touchStart', [[...a0, 0], [...b0, 1]]);
      for (let i = 1; i <= steps; i++) { await send('touchMove', [[...lerp(a0, a1, i / steps), 0], [...lerp(b0, b1, i / steps), 1]]); await frames(1); }
      await frames(2);
      if (lift === 'second-first') { await send('touchEnd', [[...a1, 0]]); await frames(3); } else if (lift === 'first-first') { await send('touchEnd', [[...b1, 1]]); await frames(3); }
      await send('touchEnd', []);
    },
  };
}

// ---- waiting without fixed sleeps (A-16) ----
// Poll a node-side predicate (sync or async) until it is truthy; returns its value, or false after ms.
export async function until(pred, ms = 5000, every = 25) { const t0 = Date.now(); for (;;) { const v = await pred(); if (v) return v; if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, every)); } }
// Page has rendered what the last input caused: two animation frames, one timer turn, and no finite CSS transition /
// animation still running (colour transitions would falsify contrast readings).
export const settled = (page, { motion = false } = {}) => page.evaluate((motion) => new Promise((resolve) => {
  const t0 = performance.now(); let n = 0;
  const busy = () => motion && document.getAnimations && document.getAnimations().some((a) => a.playState === 'running' && !(a.effect && a.effect.getComputedTiming().iterations === Infinity));
  const tick = () => { n++; if (n >= 2 && (!busy() || performance.now() - t0 > 3000)) setTimeout(resolve, 0); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}), motion);
