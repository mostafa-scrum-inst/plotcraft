// QA_GPU (G2): the ultra tier on /gpu (G-plan 6), in the headed Chrome on Xvfb of the other QA_GPU files.
// SwiftShader is a fallback adapter (adapter.info.isFallbackAdapter true), so /gpu runs full here by itself; the ultra
// pages get an init script that reports the same adapter as not a fallback (fakeAdapter), as a real GPU would.
// (t) the gate: fine pointer + not a fallback -> ultra (shadow 4096, textures 1024, anisotropy 16, tree detail 2,
//     the pixel-ratio cap 2); a fallback adapter -> full; a coarse pointer -> full
// (p) parity ultra vs full (/gpu both): the same meshes but the canopies' vertex counts (tree detail 2)
// (i) image, once: ultra against the standard page (r128, full) per Light preset, regions as in parity.mjs, with the
//     wider ULTRA_TOL below (ultra's 4096 shadow map and 1024 textures are sharper than full's, by design)
// (s) shadows and acne: ground points around the house, in a cast shadow or sunlit (raycast on the standard page),
//     on ultra against /gpu full within SHADE_TOL: the shade as dark (a too large bias leaks light: planted
//     -0.005 / 0.3 fails here); acne from a too small bias darkens the sunlit walls (planted 0 / 0 fails (i) by 28)
// (d) the frame probe: forced slow frames (a busy loop in each animation frame) during a flight lower the pixel ratio
//     to 1.5 while it flies and bring it back with one frame at rest; slow throughout -> exactly one quiet downgrade
//     to full (one rebuild, no Building card, pose and selection kept) and never a second; an idle view stays at 0 rAF
// Knobs (measurement only, never in the gate): GPU_BIAS=bias,normalBias (ultra's), GPU_CBUF=byte (ultra's colour
// buffer), GPU_ACNE=1 (plants bias 0 / normal bias 0 on ultra: the acne check must fail).
import { loadCore } from '../helpers/load.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';
import { suite } from '../helpers/browser.mjs';
import { serve, xvfb, launchGpu, openPage, toStage5, ready3d } from '../helpers/gpu.mjs';
import { meshes, regions, closeUp, groundPoints } from '../helpers/gpu-image.mjs';

const T = suite('gpu ultra'), t0 = Date.now();
const PC = loadCore();
const SAMPLE = sampleApproved(PC), MAX = maxHouse(PC);
const PRESETS = [['morning', 8], ['noon', 12], ['evening', 17.5], ['night', 22]];
// ultra vs r128 full (measured in G2, then a margin; docs/03-tasks/G2/outcome.md): unlit regions as parity.mjs (3);
// lit regions 8 (parity.mjs: 6; measured worst 4.0): the sharper 4096 shadow edge and the 1024 textures may move a
// box mean a little more than full does; 8 still fails the planted bias mistakes (outcome.md).
const ULTRA_TOL = { sky: 3, needle: 3, ground: 8, wall: 8, side: 8 };
// shade / lit ground on ultra vs /gpu full, per channel (measured <= 2; G2 outcome.md)
const SHADE_TOL = 3;

// init scripts (strings: run before the page's scripts)
const fakeAdapter = ({ fallback = false, coarse = false } = {}) => ({ content: `(() => {
  const orig = GPU.prototype.requestAdapter;
  GPU.prototype.requestAdapter = function () {
    return orig.apply(this, arguments).then((ad) => {
      if (!ad) return ad;
      const i = ad.info, c = {};
      for (const k of ['vendor', 'architecture', 'device', 'description', 'subgroupMinSize', 'subgroupMaxSize']) c[k] = i[k];
      c.isFallbackAdapter = ${fallback};
      Object.defineProperty(ad, 'info', { value: c });
      return ad;
    });
  };
  if (${coarse}) {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => /pointer\\s*:\\s*(fine|coarse)/.test(q) ? { matches: /coarse/.test(q), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q);
  }
})();` });
// window.__slow ms of busy work at the start of the next window.__slowN animation frames; window.__raf counts requests
const slowFrames = { content: `(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__slow = 0; window.__slowN = 0; window.__raf = 0;
  window.requestAnimationFrame = (f) => { window.__raf++; return raf((t) => {
    if (window.__slow > 0 && window.__slowN > 0) { window.__slowN--; const e = performance.now() + window.__slow; while (performance.now() < e); }
    f(t);
  }); };
})();` };
const knobs = (page) => page.evaluate(({ bias, cbuf, acne }) => {
  const u = PC.C.VIEW3D.tiers.ultra;
  if (bias) { u.shadowBias = bias[0]; u.shadowNormalBias = bias[1]; }
  if (acne) { u.shadowBias = 0; u.shadowNormalBias = 0; }
  if (cbuf) u.colorBuffer = cbuf;
}, { bias: process.env.GPU_BIAS ? process.env.GPU_BIAS.split(',').map(Number) : null, cbuf: process.env.GPU_CBUF || null, acne: !!process.env.GPU_ACNE });
const tierOf = (page) => page.evaluate(() => {
  const i = PC.debug.scene(), sun = i.scene.getObjectByName('sun'), r = i.renderer;
  return { name: i.tier.name, gfxTier: PC.gfx.tier, shadow: sun.shadow.mapSize.x, bias: [sun.shadow.bias, sun.shadow.normalBias], tex: i.textures.map((t) => t.image.width),
    aniso: Math.max(...i.textures.map((t) => t.anisotropy)), treeDetail: i.tier.treeDetail, maxDpr: i.tier.maxDpr, pr: r.getPixelRatio(),
    colorBuffer: r.getColorBufferType() === THREE.HalfFloatType ? 'half' : r.getColorBufferType() === THREE.UnsignedByteType ? 'byte' : String(r.getColorBufferType()) };
});
const sceneInfo = (page) => page.evaluate(() => { const i = PC.debug.scene(); return { tier: i.tier.name, builds: i.builds, restores: i.restores, retiers: i.retiers, renders: i.renders, prCap: i.prCap, pr: i.renderer.getPixelRatio(), pose: i.pose, selected: i.selected, frame: i.frame, compiling: i.compiling, stats: Object.assign({}, PC.gfx.stats) }; });
const idle = (page) => page.evaluate(() => new Promise((r) => setTimeout(() => { const a = window.__raf; setTimeout(() => r(window.__raf - a), 1500); }, 300)));
const fly = (page, ms) => page.evaluate((ms) => { const p = PC.view3d.pose(); PC.view3d.flyTo({ target: p.target, radius: p.radius * 0.8, theta: p.theta + 60, phi: p.phi }, ms); }, ms);
const flyBack = (page, ms) => page.evaluate((ms) => { const p = PC.view3d.pose(); PC.view3d.flyTo({ target: p.target, radius: p.radius / 0.8, theta: p.theta - 60, phi: p.phi }, ms); }, ms);
const rested = (page) => page.waitForFunction(() => !PC.view3d.animation() && !PC.debug.scene().frame && !PC.debug.scene().compiling, null, { timeout: 60000, polling: 50 });

const X = await xvfb(), srv = await serve(), browser = await launchGpu({ display: X.display });
try {
  // ---- (t) the gate
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 240 }, deviceScaleFactor: 1 });
    const fb = await openPage(browser, srv.url, { page: 'gpu', ctx, init: fakeAdapter({ fallback: true }) });
    const co = await openPage(browser, srv.url, { page: 'gpu', ctx, init: fakeAdapter({ coarse: true }) });
    for (const [p, why] of [[fb, 'a fallback adapter'], [co, 'a coarse pointer (adapter not a fallback)']]) {
      await toStage5(p.page, SAMPLE);
      T.eq(await ready3d(p.page), 'ready', `(t) ${why}: ready`);
      const t = await tierOf(p.page);
      T.eq([t.name, t.gfxTier, t.treeDetail], ['full', 'full', 1], `(t) ${why} -> full`);
      T.none(p.problems(), `(t) ${why}: no errors`);
    }
    await ctx.close();
  }

  // ---- (p), (i), (s): ultra, /gpu full and the standard page side by side, 640x480 at dpr 1
  {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
    const U = await openPage(browser, srv.url, { page: 'gpu', ctx, init: fakeAdapter() });
    const F = await openPage(browser, srv.url, { page: 'gpu', ctx });
    const S = await openPage(browser, srv.url, { page: 'standard', ctx });
    await knobs(U.page);
    for (const [name, state] of [['sample', SAMPLE], ['maximum house', MAX]]) {
      const got = {};
      for (const [k, p] of [['ultra', U], ['full', F], ['standard', S]]) {
        await toStage5(p.page, state);
        T.eq(await ready3d(p.page), 'ready', `${name}: ${k} ready`);
        if (k !== 'standard') got[k] = await meshes(p.page);
      }
      const tu = await tierOf(U.page), tf = await tierOf(F.page);
      if (name === 'sample') {
        const st = await U.page.evaluate(() => PC.gfx.stats);
        console.log(`  ultra: ${JSON.stringify(tu)}`);
        console.log(`  ultra warm-up: compileAsync ${st.compileMs.toFixed(0)} ms, pipelines ${st.pipelinesCompiled} / ${st.pipelinesWarm} (precompile meshes shown) / ${st.pipelinesWarm2}, the two warm-up renders ${st.warmMs.toFixed(0)} ms`);
        T.eq([tu.name, tu.gfxTier, tu.shadow, tu.aniso, tu.treeDetail, tu.maxDpr], ['ultra', 'ultra', 4096, 16, 2, 2], '(t) fine pointer + not a fallback -> ultra: shadow 4096, anisotropy 16, tree detail 2, pixel-ratio cap 2');
        T.ok(tu.tex.filter((w) => w === 1024).length >= 4 && !tu.tex.includes(512), `(t) ultra textures 1024 (${tu.tex})`);
        T.ok(tf.tex.includes(512) && !tf.tex.includes(1024) && tf.shadow === 2048 && tf.aniso === 4, `(t) full textures 512 (${tf.tex}), shadow 2048, anisotropy 4`);
        T.eq(tu.colorBuffer, process.env.GPU_CBUF || 'half', '(t) ultra colour buffer');
        // N5: the warm-up built the furniture's / textured parts' shadow pipelines: the dollhouse (Roof off) adds none
        await U.page.evaluate(() => PC.view3d.setRoof(false)); await ready3d(U.page);
        const pOff = await U.page.evaluate(() => PC.debug.scene().renderer._pipelines.caches.size);
        await U.page.evaluate(() => PC.view3d.setRoof(true)); await ready3d(U.page);
        const pOn = await U.page.evaluate(() => PC.debug.scene().renderer._pipelines.caches.size);
        console.log(`  ultra pipelines: ${st.pipelinesWarm2} after the warm-up, ${pOff} with the Roof off, ${pOn} with it on again`);
        T.ok(pOff <= st.pipelinesWarm2 + 1 && pOn === pOff, `(N5) no new pipelines for the dollhouse after the warm-up (${st.pipelinesWarm2} -> ${pOff} -> ${pOn}; +1 allowed for the canvas output pass)`);
      }
      // (p) only the canopies differ (tree detail 2: more vertices, same instance count)
      const diff = got.ultra.map((m, j) => JSON.stringify(m) === JSON.stringify(got.full[j]) ? null : [m, got.full[j]]).filter(Boolean);
      T.eq(got.ultra.length, got.full.length, `(p) ${name}: same mesh count (${got.ultra.length})`);
      T.ok(diff.length > 0 && diff.every(([a, b]) => a[0] === 'canopies' && b[0] === 'canopies' && a[2] > b[2] && a[4] === b[4] && a[1] === b[1] && a[5] === b[5]),
        `(p) ${name}: ultra vs full differ only in the canopies' vertex counts: ${JSON.stringify(diff)}`);
      if (name !== 'sample') continue;
      // (i) + (s) per preset on the sample
      const worst = {}, sh = [];
      for (const [preset, hour] of PRESETS) {
        const r = {};
        for (const [k, p] of [['ultra', U], ['full', F], ['standard', S]]) {
          await p.page.evaluate((hr) => { PC.view3d.setLook({ hour: hr, season: 'summer' }); }, hour);
          await ready3d(p.page);
        }
        const pts = await groundPoints(S.page);
        for (const [k, p] of [['ultra', U], ['full', F], ['standard', S]]) {
          const kind = k === 'standard' ? 'standard' : 'gpu';
          r[k] = await regions(p.page, kind, false);
          r[k].pts = await regions(p.page, kind, false, pts);
          if (k === 'full') continue;
          await closeUp(p.page, true);
          await p.page.waitForFunction(() => !PC.view3d.animation() && !PC.debug.scene().frame);
          Object.assign(r[k], await regions(p.page, kind, true));
          await closeUp(p.page, false);
          await ready3d(p.page);
        }
        for (const reg of ['sky', 'ground', 'wall', 'side', 'needle']) {
          const a = r.ultra[reg], b = r.standard[reg];
          const d = Math.max(...a.map((v, c) => Math.abs(v - b[c])));
          worst[reg] = Math.max(worst[reg] || 0, d);
          console.log(`  ${preset.padEnd(8)} ${reg.padEnd(6)} ultra ${a.map((v) => v.toFixed(0)).join(',').padEnd(12)} r128 ${b.map((v) => v.toFixed(0)).join(',').padEnd(12)} max |d| ${d.toFixed(1)}`);
          T.ok(d <= ULTRA_TOL[reg], `(i) ${preset} ${reg}: ultra ${a} vs r128 full ${b}, max channel difference ${d.toFixed(1)} <= ${ULTRA_TOL[reg]}`);
        }
        // (s) acne on the two wall faces (vertex colours, no texture: a striped self-shadow shows as noise)
        for (const w of ['wallSd', 'sideSd']) {
          console.log(`  ${preset.padEnd(8)} ${w.padEnd(6)} noise ultra ${r.ultra[w].toFixed(2)} full ${r.full[w].toFixed(2)} r128 ${r.standard[w].toFixed(2)}`);
        }
        // (s) shade and noise, ultra vs /gpu full (same renderer: only the tier differs)
        const agg = (k, shade) => {
          const sel = r[k].pts.filter((_, j) => pts[j].shade === shade);
          if (!sel.length) return null;
          return { n: sel.length, mean: [0, 1, 2].map((c) => sel.reduce((s, x) => s + x.mean[c], 0) / sel.length), sd: sel.reduce((s, x) => s + x.sd, 0) / sel.length };
        };
        if (hour === 22) continue;                                  // night: the sun is down, no cast shadow
        for (const shade of [true, false]) {
          const a = agg('ultra', shade), b = agg('full', shade), c = agg('standard', shade);
          if (!a || !b) { console.log(`  ${preset} ${shade ? 'shade' : 'lit'}: no points`); continue; }
          const d = Math.max(...a.mean.map((v, j) => Math.abs(v - b.mean[j])));
          sh.push([preset, shade ? 'shade' : 'lit', a.n, d, a.sd - b.sd]);
          console.log(`  ${preset.padEnd(8)} ${(shade ? 'shade' : 'lit').padEnd(6)} n ${String(a.n).padEnd(3)} ultra ${a.mean.map((v) => v.toFixed(0)).join(',')} sd ${a.sd.toFixed(2)}  full ${b.mean.map((v) => v.toFixed(0)).join(',')} sd ${b.sd.toFixed(2)}  r128 ${c.mean.map((v) => v.toFixed(0)).join(',')} sd ${c.sd.toFixed(2)}`);
          T.ok(d <= SHADE_TOL, `(s) ${preset} ${shade ? 'shade' : 'lit'} ground (${a.n} points): ultra vs full max channel difference ${d.toFixed(1)} <= ${SHADE_TOL}`);
        }
        if (preset === 'evening') T.ok(sh.some((x) => x[0] === 'evening' && x[1] === 'shade' && x[2] >= 3), '(s) evening: at least 3 ground points in the house\'s shadow');
      }
      console.log('  ultra vs r128 worst per region: ' + JSON.stringify(worst));
    }
    for (const [k, p] of [['ultra', U], ['full', F], ['standard', S]]) T.none(p.problems(), `${k} page: no errors, THREE warnings or stray requests`);
    await ctx.close();
  }

  // ---- (d) the frame probe, at dpr 2 (so the 1.5 cap shows), 320x240 css px
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 240 }, deviceScaleFactor: 2 });
    // pixel ratio only: slow moving frames -> 1.5 while flying, 2 at rest with one frame
    // (SwiftShader frames are slow by themselves at this size, so A runs with ultra's probe off: the pixel-ratio rule only)
    const A = await openPage(browser, srv.url, { page: 'gpu', ctx, init: [fakeAdapter(), slowFrames] });
    await A.page.evaluate(() => { PC.C.VIEW3D.tiers.ultra.probe = null; });
    await toStage5(A.page, SAMPLE);
    T.eq(await ready3d(A.page), 'ready', '(d) ready');
    let a0 = await sceneInfo(A.page);
    T.eq([a0.tier, a0.pr, a0.prCap], ['ultra', 2, null], '(d) ultra at pixel ratio 2');
    await A.page.evaluate(() => { window.__slow = 45; window.__slowN = 12; });
    await fly(A.page, 2500);
    await A.page.waitForFunction(() => PC.debug.scene().prCap === 1.5, null, { timeout: 15000, polling: 20 });
    const mid = await sceneInfo(A.page);
    T.eq([mid.pr, mid.stats.lowDpr, mid.tier], [1.5, 1, 'ultra'], '(d) slow frames while flying: pixel ratio 1.5 (one drop)');
    // the renders when the flight's last frame is drawn, then the rest: one more frame at the cap
    const r0 = await A.page.evaluate(() => new Promise((r) => { (function p() { const i = PC.debug.scene(); if (!PC.view3d.animation() && !i.frame) r(i.renders); else setTimeout(p, 2); })(); }));
    await A.page.waitForFunction(() => PC.debug.scene().prCap === null && PC.gfx.stats.rests === 1 && !PC.debug.scene().frame, null, { timeout: 5000, polling: 20 });
    await A.page.waitForTimeout(400);
    const a1 = await sceneInfo(A.page);
    T.eq([a1.pr, a1.prCap, a1.tier, a1.retiers, a1.stats.downgrades], [2, null, 'ultra', 0, 0], '(d) at rest: back to 2, still ultra (probe off on this page)');
    T.eq(a1.renders, r0 + 1, '(d) at rest: one frame at the cap, then nothing');
    T.eq(await idle(A.page), 0, '(d) idle after the flight: 0 animation frames');
    T.none(A.problems(), '(d) no errors');

    // slow throughout: the drop, then one quiet downgrade to full at rest, never a second
    const B = await openPage(browser, srv.url, { page: 'gpu', ctx, init: [fakeAdapter(), slowFrames] });
    await B.page.evaluate(() => {
      window.__cards = 0;
      const el = document.querySelector('[data-pc="v3-building"]');
      new MutationObserver(() => { if (!el.hidden && window.__armed) window.__cards++; }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
    });
    await toStage5(B.page, SAMPLE);
    T.eq(await ready3d(B.page), 'ready', '(d) slow: ready');
    const room = await B.page.evaluate(() => { const lv = PC.view3d.house().levels[0]; PC.view3d.select(lv.rooms[0].id); window.__armed = true; return lv.rooms[0].id; });
    await B.page.evaluate(() => { window.__slow = 45; window.__slowN = 1e9; });
    const b0 = await sceneInfo(B.page);
    for (let k = 0; k < 4 && (await sceneInfo(B.page)).stats.probeMs === 0; k++) { await (k % 2 ? flyBack : fly)(B.page, 1500); await rested(B.page); }
    const poseBefore = (await sceneInfo(B.page)).pose;
    await B.page.waitForFunction(() => PC.debug.scene().retiers === 1, null, { timeout: 10000, polling: 20 });
    await rested(B.page);
    T.eq(await ready3d(B.page), 'ready', '(d) slow: drawn after the downgrade');
    const b1 = await sceneInfo(B.page);
    console.log(`  slow probe: median ${b1.stats.probeMs.toFixed(1)} ms, ${b1.stats.lowDpr} pixel-ratio drop(s), ${b1.stats.downgrades} downgrade(s)`);
    T.eq([b1.tier, b1.retiers, b1.builds, b1.restores, b1.stats.downgrades, await B.page.evaluate(() => PC.gfx.tier)], ['full', 1, b0.builds + 1, 0, 1, 'full'], '(d) slow frames: one downgrade to full, one rebuild, no restore');
    T.ok(b1.stats.probeMs > 24, `(d) the probe median ${b1.stats.probeMs.toFixed(1)} ms > 24`);
    T.eq([b1.selected, JSON.stringify(b1.pose) === JSON.stringify(poseBefore), b1.pr, b1.prCap], [room, true, 2, null], '(d) the selection and the pose kept, pixel ratio 2 (full\'s cap)');
    T.eq(await B.page.evaluate(() => window.__cards), 0, '(d) no Building card (no message)');
    const t2 = await tierOf(B.page);
    T.eq([t2.shadow, t2.treeDetail, t2.tex.includes(1024)], [2048, 1, false], '(d) full after the downgrade: shadow 2048, tree detail 1, textures 512');
    await fly(B.page, 1500); await rested(B.page); await B.page.waitForTimeout(500);
    const b2 = await sceneInfo(B.page);
    T.eq([b2.tier, b2.retiers, b2.stats.downgrades, b2.prCap], ['full', 1, 1, null], '(d) slow frames on full: no second downgrade, no pixel-ratio drop');
    await B.page.evaluate(() => { window.__slow = 0; });
    T.eq(await idle(B.page), 0, '(d) idle after the downgrade: 0 animation frames');
    T.none(B.problems(), '(d) slow: no errors');
    await ctx.close();
  }
} finally { await browser.close(); await srv.close(); X.stop(); }
console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(T.done() ? 1 : 0);
