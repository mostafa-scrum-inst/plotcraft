// QA_GPU (G1 items b-f): the /gpu page's flows in a headed Chrome on a private Xvfb display (WebGPU on SwiftShader),
// plus one headless Chrome without the WebGPU flags for the fallback.
// (b) a draft written on the standard page resumes on /gpu, and one written on /gpu resumes on the standard page
// (c) WebGPU flags off: the unavailable card says so and links to the standard page; the CD-12 / shell links
// (d) the three.js import fails (404) or never answers (bootstrap timeout, shortened here) -> unavailable, no hang
// (e) a simulated device loss rebuilds once on a new renderer, and nothing loops
// (f) close or another house while the build compiles leaves no stale build; Roof / level changes made meanwhile stay
import { loadCore } from '../helpers/load.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';
import { suite } from '../helpers/browser.mjs';
import { serve, xvfb, launchGpu, openPage, toStage5, ready3d } from '../helpers/gpu.mjs';

const T = suite('gpu flows'), t0 = Date.now();
const PC = loadCore();
const SAMPLE = sampleApproved(PC), CLASSIC = sampleApproved(PC, (s) => { s.ans.interior.style = 'classic'; }), WHITE = sampleApproved(PC, (s) => { s.ans.exterior = 'white'; });
const MAX = maxHouse(PC);
const info = (page) => page.evaluate(() => { const i = PC.debug.scene(); return { gfx: i.gfx, builds: i.builds, restores: i.restores, renders: i.renders, lost: i.lost, active: i.active, building: i.building, compiling: i.compiling, key: i.house && i.house.key, level: i.level, roof: i.roof, meshCount: i.meshCount }; });
const shown = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); return !!e && !e.closest('[hidden]') && e.getBoundingClientRect().width > 0; }, sel);
const draftOf = (page) => page.evaluate(() => { PC.ui.autosave.flush(); try { return JSON.parse(localStorage.getItem(PC.draft.KEYS[0])); } catch (e) { return null; } });
// Starts stage 5 with `state` and, inside the page, waits for the build's compile window, then runs act(); resolves
// to what the page saw. All in one evaluate so the compile window (~0.1-0.3 s on SwiftShader) is not missed.
const duringCompile = (page, state, act) => page.evaluate(({ state, act }) => new Promise((done) => {
  const s = JSON.parse(JSON.stringify(state)); s.stage = 5;
  PC.store.replace(s);
  const t = performance.now();
  (function poll() {
    const i = PC.debug.scene();
    if (i && i.compiling) { const before = { renders: i.renders, builds: i.builds }; new Function('PC', 'other', act)(PC, null); done({ caught: true, before }); return; }
    if (performance.now() - t > 30000) { done({ caught: false }); return; }
    setTimeout(poll, 0);
  })();
}), { state, act });

const X = await xvfb(), srv = await serve(), browser = await launchGpu({ display: X.display });
try {
  // ---- (b) drafts across the two pages (same origin, so the same localStorage, as on the artifact)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const S1 = await openPage(browser, srv.url, { page: 'standard', ctx });
    await toStage5(S1.page, CLASSIC);
    T.eq(await ready3d(S1.page), 'ready', '(b) standard page ready');
    const keyStd = (await info(S1.page)).key, d1 = await draftOf(S1.page);
    T.ok(d1 && d1.state && d1.state.stage === 5 && d1.state.ans.interior.style === 'classic', '(b) the standard page wrote the draft (stage 5, classic)');
    const G = await openPage(browser, srv.url, { page: 'gpu', ctx });
    T.ok(await shown(G.page, '[data-pc="btn-resume"]'), '(b) /gpu offers Resume for the standard page\'s draft');
    await G.page.click('[data-pc="btn-resume"]');
    T.eq(await ready3d(G.page), 'ready', '(b) /gpu resumed into stage 5 and drew it');
    const gi = await info(G.page);
    T.eq([gi.gfx, gi.key, await G.page.evaluate(() => PC.store.get().ans.interior.style)], ['webgpu', keyStd, 'classic'], '(b) /gpu shows the same house (key) on WebGPU');
    await toStage5(G.page, WHITE);
    T.eq(await ready3d(G.page), 'ready', '(b) /gpu: an edit (white exterior)');
    const keyGpu = (await info(G.page)).key, d2 = await draftOf(G.page);
    T.ok(d2 && d2.state.ans.exterior === 'white', '(b) /gpu wrote the draft');
    const S2 = await openPage(browser, srv.url, { page: 'standard', ctx });
    await S2.page.click('[data-pc="btn-resume"]');
    T.eq(await ready3d(S2.page), 'ready', '(b) the standard page resumed /gpu\'s draft');
    T.eq([(await info(S2.page)).gfx, (await info(S2.page)).key], ['r128', keyGpu], '(b) same house back on r128');
    for (const p of [S1, G, S2]) T.none(p.problems(), '(b) no errors');
    await ctx.close();
  }

  // ---- (d) the module import fails, or never answers
  for (const how of ['404', 'hang']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    // 'hang': the 20 s bootstrap timeout shortened to 0.5 s for the test (the page's own setTimeout, test-only wrapper)
    const init = how === 'hang' ? () => { const st = window.setTimeout; window.setTimeout = function (f, d) { return st.apply(window, [f, d === 20000 ? 500 : d].concat([].slice.call(arguments, 2))); }; } : undefined;
    const P = await openPage(browser, srv.url, { page: 'gpu', ctx, three180: how, init });
    const t1 = Date.now();
    await toStage5(P.page, SAMPLE);
    T.eq(await ready3d(P.page, 15000), 'unavailable', `(d) import ${how}: stage 5 says unavailable`);
    T.ok(Date.now() - t1 < 10000, `(d) import ${how}: within ${Date.now() - t1} ms (no hang)`);
    T.eq(await P.page.evaluate(() => PC.boot3d.state), how === '404' ? 'failed' : 'timeout', `(d) import ${how}: bootstrap state`);
    T.ok(!(await shown(P.page, '[data-pc="v3-building"]')) && await shown(P.page, '#pc-gpu-fallback'), `(d) import ${how}: no Building card, the standard-page link`);
    await P.page.click('[data-pc="btn-back"]');
    T.eq(await P.page.evaluate(() => PC.store.get().stage), 4, `(d) import ${how}: stage 4 still works`);
    T.none(P.problems(), `(d) import ${how}: no page errors`);
    await ctx.close();
  }

  // ---- (e) device loss
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const P = await openPage(browser, srv.url, { page: 'gpu', ctx });
    await toStage5(P.page, SAMPLE);
    T.eq(await ready3d(P.page), 'ready', '(e) ready');
    const a = await info(P.page);
    await P.page.evaluate(() => { window.__oldR = PC.debug.scene().renderer; window.__oldR.onDeviceLost({ api: 'WebGPU', message: 'test: simulated loss', reason: 'unknown' }); });
    T.eq(await P.page.evaluate(() => PC.debug.scene().lost), true, '(e) lost at once: no frames');
    await P.page.waitForFunction(() => PC.debug.scene().restores === 1, null, { timeout: 30000 });
    T.eq(await ready3d(P.page), 'ready', '(e) rebuilt and drawn');
    const b = await info(P.page);
    T.eq([b.restores, b.builds, b.lost, b.key], [1, a.builds + 1, false, a.key], '(e) one restore, one rebuild, same house');
    T.ok(await P.page.evaluate(() => PC.debug.scene().renderer !== window.__oldR), '(e) a new renderer');
    // the old renderer's own device goes ('destroyed' by our dispose) and a late report from it: both ignored
    await P.page.evaluate(() => { window.__oldR.onDeviceLost({ api: 'WebGPU', message: 'late', reason: 'unknown' }); PC.debug.scene().renderer.onDeviceLost({ api: 'WebGPU', message: 'own dispose', reason: 'destroyed' }); });
    await P.page.waitForTimeout(1500);
    const c = await info(P.page);
    T.eq([c.restores, c.builds, c.lost], [1, a.builds + 1, false], '(e) no loop: still one restore after 1.5 s and two ignored reports');
    const px = await P.page.evaluate(() => new Promise((r) => PC.view3d.capture((c) => r(c ? Array.from(c.data.slice(0, 4)) : null))));
    T.ok(px && px[0] + px[1] + px[2] > 100, `(e) the new renderer draws (top-left pixel ${px})`);
    T.none(P.problems(), '(e) no errors');
    await ctx.close();
  }

  // ---- (f) changes while the build compiles
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ref = await openPage(browser, srv.url, { page: 'gpu', ctx });
    await toStage5(ref.page, MAX);
    T.eq(await ready3d(ref.page), 'ready', '(f) reference: the maximum house on a fresh page');
    const refInfo = await info(ref.page), refNames = await ref.page.evaluate(() => { const n = []; PC.debug.scene().world.traverse((o) => n.push(o.name + ':' + o.visible)); return n; });
    await ref.page.close();

    const P = await openPage(browser, srv.url, { page: 'gpu', ctx });
    await P.page.waitForFunction(() => PC.boot3d.state === 'ready');
    // f1: leave stage 5 while it compiles
    const r1 = await duringCompile(P.page, SAMPLE, "document.querySelector('[data-pc=\"btn-back\"]').click();");
    T.ok(r1.caught, '(f1) caught the compile window');
    await P.page.waitForFunction(() => !PC.debug.scene().compiling);
    await P.page.waitForTimeout(300);
    const f1 = await info(P.page);
    T.eq([f1.active, f1.building, f1.renders], [false, false, r1.before.renders], '(f1) closed: no frame drawn when the compile finished');
    T.eq(await P.page.evaluate(() => PC.store.get().stage), 4, '(f1) on stage 4');
    // f2: another house while it compiles (the store change re-opens stage 5 with the maximum house)
    const max = JSON.stringify(MAX);
    const r2 = await duringCompile(P.page, WHITE, `var s = ${max}; s.stage = 5; PC.store.replace(s);`);
    T.ok(r2.caught, '(f2) caught the compile window');
    T.eq(await ready3d(P.page), 'ready', '(f2) ready');
    const f2 = await info(P.page), names = await P.page.evaluate(() => { const n = []; PC.debug.scene().world.traverse((o) => n.push(o.name + ':' + o.visible)); return n; });
    T.eq([f2.key, f2.meshCount], [refInfo.key, refInfo.meshCount], '(f2) the maximum house, its own mesh count');
    T.eq(names, refNames, '(f2) the world is exactly the fresh maximum house (no sample meshes left, same visibility)');
    // f3: Roof off and the ground level picked while it compiles: kept
    const r3 = await duringCompile(P.page, CLASSIC, "PC.view3d.setRoof(false); PC.view3d.setLevel('G');");
    T.ok(r3.caught, '(f3) caught the compile window');
    T.eq(await ready3d(P.page), 'ready', '(f3) ready');
    const f3 = await P.page.evaluate(() => {
      const i = PC.debug.scene(), w = i.world, g = (n) => w.getObjectByName(n);
      let furn = null; w.traverse((o) => { if (o.name === 'furniture' && o.parent && o.parent.name === 'level-G') furn = o.visible; });
      return { roof: i.roof, level: i.level, roofGroup: g('roof').visible, level1: g('level-1').visible, levelG: g('level-G').visible, furn };
    });
    T.eq(f3, { roof: false, level: 'G', roofGroup: false, level1: false, levelG: true, furn: true }, '(f3) Roof off and level G kept after the compile (furniture shown in the dollhouse)');
    T.none(P.problems(), '(f) no errors');
    await ctx.close();
  }
} finally { await browser.close(); await srv.close(); X.stop(); }

// ---- (c) no WebGPU (the flags off): headless, navigator.gpu exists but there is no adapter
{
  const srv2 = await serve(), b2 = await launchGpu({ webgpu: false });
  try {
    const ctx = await b2.newContext({ viewport: { width: 1280, height: 800 } });
    const G = await openPage(b2, srv2.url, { page: 'gpu', ctx });
    T.ok(!(await shown(G.page, '#pc-alt-link')), '(c) /gpu: no shell link before stage 5');
    await toStage5(G.page, SAMPLE);
    T.eq(await ready3d(G.page, 15000), 'unavailable', '(c) /gpu without WebGPU: unavailable');
    const u = await G.page.evaluate(() => ({ text: document.querySelector('[data-pc="v3-unavailable-text"]').textContent, link: document.getElementById('pc-gpu-fallback').textContent, href: document.getElementById('pc-gpu-fallback').href, alt: document.getElementById('pc-alt-link').textContent, altHref: document.getElementById('pc-alt-link').href }));
    T.eq(u, { text: 'This device or browser does not support WebGPU.', link: 'Open the standard 3D view', href: srv2.url + '/index.html', alt: 'Standard version', altHref: srv2.url + '/index.html' }, '(c) the CD-11 message, its link and the shell link to the standard page');
    T.ok(await shown(G.page, '#pc-alt-link'), '(c) /gpu: "Standard version" shown on stage 5');
    await G.page.evaluate(() => PC.ui.autosave.flush());
    await Promise.all([G.page.waitForURL(srv2.url + '/index.html'), G.page.click('#pc-gpu-fallback')]);
    await G.page.click('[data-pc="btn-resume"]');
    T.eq(await ready3d(G.page), 'ready', '(c) the link opens the standard page, the draft resumes on r128');
    T.eq(await G.page.evaluate(() => PC.debug.scene().gfx), 'r128', '(c) standard renderer');
    // CD-12 on the standard page: the WebGPU link on stage 5 where navigator.gpu exists (here: yes, without an adapter)
    const l = await G.page.evaluate(() => ({ text: document.getElementById('pc-alt-link').textContent, href: document.getElementById('pc-alt-link').href }));
    T.eq(l, { text: 'High-end 3D (WebGPU)', href: srv2.url + '/gpu/index.html' }, '(c) the standard page\'s link to /gpu');
    T.ok(await shown(G.page, '#pc-alt-link'), '(c) shown on stage 5 (navigator.gpu exists)');
    await G.page.click('[data-pc="btn-back"]');
    T.ok(!(await shown(G.page, '#pc-alt-link')), '(c) hidden on stage 4');
    T.none(G.problems(), '(c) no errors');
    const N = await openPage(b2, srv2.url, { page: 'standard', ctx, init: () => { Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get() { return undefined; } }); } });
    await toStage5(N.page, SAMPLE);
    T.eq(await ready3d(N.page), 'ready', '(c) standard page, no navigator.gpu: ready');
    T.ok(!(await shown(N.page, '#pc-alt-link')), '(c) no navigator.gpu: no WebGPU link (CD-12)');
    T.none(N.problems(), '(c) no errors');
    await ctx.close();
  } finally { await b2.close(); await srv2.close(); }
}
console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(T.done() ? 1 : 0);
