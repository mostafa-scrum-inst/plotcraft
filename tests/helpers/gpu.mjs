// QA_GPU helpers (G1): the built pages over a local http server (WebGPU needs a secure context: file: and data: get
// no adapter), headless Chrome with the SwiftShader WebGPU adapter, three.js routed to the vendored copies.
//   - the /gpu page's cdnjs import of three.js 0.180.0 -> tests/vendor/three-0.180.0/ (and its ./three.core.min.js)
//   - the standard page's r128 tag -> tests/vendor/three-r128.min.js (real r128, A-16)
// Nothing else may leave the page: every other non-local request is aborted and reported.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './load.mjs';
import { THREE_URL, VENDOR_THREE } from './browser.mjs';

export const GPU_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/';
export const GPU_URL = GPU_BASE + 'three.webgpu.min.js';
const VENDOR180 = join(ROOT, 'tests', 'vendor', 'three-0.180.0');
export const WEBGPU_ARGS = ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--use-vulkan=swiftshader',
  '--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-default-browser-check'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json' };

// Serves dist/ (standard page at /index.html, the /gpu page at /gpu/index.html). Resolves to { url, close }.
export function serve() {
  const dist = join(ROOT, 'dist');
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = normalize(join(dist, p));
    if (!f.startsWith(dist) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(f));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((d) => server.close(d)) })));
}

// A private X display (Xvfb) for a headed browser. Measured in G1: in headless Chrome a WebGPU device that presents
// to a canvas is lost ("destroyed") within a few frames on the SwiftShader adapter; a headed Chrome on Xvfb with
// --use-vulkan=swiftshader keeps it. Resolves to { display, stop }.
export function xvfb() {
  return new Promise((ok, fail) => {
    const p = spawn('Xvfb', ['-displayfd', '1', '-screen', '0', '1600x1000x24', '-nolisten', 'tcp'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    const t = setTimeout(() => fail(new Error('Xvfb did not start')), 10000);
    p.stdout.on('data', (d) => { out += d; const m = /^(\d+)\n/.exec(out); if (m) { clearTimeout(t); ok({ display: ':' + m[1], stop: () => p.kill() }); } });
    // no Xvfb: fail (an explicit QA_GPU run never skips) and say what is missing (G1 round 2, N1)
    p.on('error', (e) => { clearTimeout(t); fail(e && e.code === 'ENOENT' ? new Error('QA_GPU needs Xvfb (apt install xvfb); the /gpu suite cannot run headless (device lost)') : e); });
  });
}

// webgpu: false launches without the WebGPU flags (navigator.gpu stays, requestAdapter() gives null).
// display: an X display from xvfb() (headed); without one the browser is headless (no canvas presentation).
export async function launchGpu({ webgpu = true, display = null } = {}) {
  const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
  return chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: !display, env: display ? Object.assign({}, process.env, { DISPLAY: display }) : process.env,
    args: webgpu ? WEBGPU_ARGS : ['--no-sandbox'] });
}

// opts: page 'gpu' | 'standard'; three180 'vendor' (default) | '404' | 'hang'; vp { w, h }; init(fn) before scripts;
// ctx: reuse a browser context (shared localStorage between the two pages, as on the artifact origin).
export async function openPage(browser, base, opts = {}) {
  const vp = opts.vp || { w: 1280, h: 800 };
  const ctx = opts.ctx || await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const log = { errors: [], requests: [], warnings: [] };
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    log.requests.push(u);
    if (u === THREE_URL) return route.fulfill({ contentType: 'application/javascript', body: readFileSync(VENDOR_THREE, 'utf8') });
    if (u.startsWith(GPU_BASE)) {
      if (opts.three180 === '404') return route.fulfill({ status: 404, body: 'not found' });
      if (opts.three180 === 'hang') return;                                   // never answered: the bootstrap's timeout
      const f = join(VENDOR180, u.slice(GPU_BASE.length));
      if (existsSync(f)) return route.fulfill({ contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(f, 'utf8') });
    }
    return route.abort();
  });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') { if (opts.three180 === '404' && /Failed to load resource|404/.test(t)) return; log.errors.push('console.error: ' + t); }
    else if (m.type() === 'warning' && /THREE\./.test(t)) log.warnings.push(t);
  });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(base + (opts.page === 'standard' ? '/index.html' : '/gpu/index.html'));
  const problems = () => [...log.errors, ...log.warnings.map((w) => 'THREE warning: ' + w),
    ...log.requests.filter((u) => u !== THREE_URL && !u.startsWith(GPU_BASE)).map((u) => 'unexpected request: ' + u)];
  return { ctx, page, log, problems };
}

// Puts a ready stage-5 state in the store (the approved sample, or a fixture state from tests/helpers/houses.mjs).
export const toStage5 = (page, state) => page.evaluate((st) => {
  const s = st ? JSON.parse(JSON.stringify(st)) : JSON.parse(JSON.stringify(PC.sample.state()));
  PC.plans.sync(s);
  for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true;
  s.stage = 5;
  PC.store.replace(s);
}, state || null);

// Waits for a ready 3D view (a frame drawn, nothing building or compiling) or for 'unavailable'.
export const ready3d = (page, ms = 60000) => page.waitForFunction(() => {
  const u = document.querySelector('[data-pc="v3-unavailable"]');
  if (u && !u.hidden) return 'unavailable';
  const i = PC.debug && PC.debug.scene && PC.debug.scene();
  return i && i.renders > 0 && !i.frame && !i.building && !i.compiling ? 'ready' : false;
}, null, { timeout: ms, polling: 50 }).then((h) => h.jsonValue());
