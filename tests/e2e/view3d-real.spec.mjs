// F4-T1 (CTO F3 review H2, A-16 "Real r128 in tests"): the app against the REAL three.js r128 (tests/vendor, served
// only on the exact cdnjs URL) in headless Chrome on SwiftShader WebGL. Budget <= 30 s.
// Part A (H1 checkpoint): the strict mock (tests/three-mock.js) conforms to r128 — every whitelisted member exists on a
// real instance, and the mock's maths gives r128's numbers.
// Usage: node tests/e2e/view3d-real.spec.mjs [--shots]   (--shots writes docs/03-tasks/F4-T3/shots/, never in run-all;
// the F4-T1 shots stay as that task's record)
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { launch, open, suite, VIEWPORTS } from '../helpers/browser.mjs';
import { ROOT } from '../helpers/load.mjs';
import { FACTORIES, MATHS } from '../helpers/three-factories.mjs';

const T = suite('e2e view3d-real'), browser = await launch(), SHOTS = process.argv.includes('--shots');
const SHOT_DIR = join(ROOT, 'docs', '03-tasks', 'F4-T3', 'shots');
const countRaf = () => { const o = window.requestAnimationFrame.bind(window); window.__raf = 0; window.requestAnimationFrame = (cb) => { window.__raf++; return o(cb); }; };
const ready = (page) => page.waitForFunction(() => { const i = PC.debug.scene(); return i.renders > 0 && !i.frame && !i.building && !i.lost; }, null, { timeout: 15000 });

// Renders now and samples a 9 x 9 grid of the app canvas in the same task (no preserveDrawingBuffer needed).
const sample = (page) => page.evaluate(() => {
  const i = PC.debug.scene(), gl = i.renderer.getContext();
  i.renderNow();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(4), out = [];
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) { gl.readPixels(Math.floor(W * a / 10), Math.floor(H * b / 10), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); out.push([px[0], px[1], px[2]]); }
  // the app's own scene.background, alone: world hidden for one render (the default view shows little sky)
  i.world.visible = false; i.renderNow();
  gl.readPixels(W >> 1, H >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const sky = [px[0], px[1], px[2]];
  i.world.visible = true; i.renderNow();
  return { out, sky, calls: i.renderer.info.render.calls, pr: i.renderer.getPixelRatio(), W, cw: i.renderer.domElement.clientWidth, meshes: i.meshCount };
});
const bg = (page) => page.evaluate(() => { const h = PC.sky.compute(12, 'summer', 0).background; return [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)); });
// F4-T3: renders now and reads the whole buffer: mean luma and a checksum (for "same frame" / "darker" checks).
const frame = (page, prep) => page.evaluate((prep) => {
  const i = PC.debug.scene(), gl = i.renderer.getContext();
  if (prep) (new Function('i', prep))(i);
  i.renderNow();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let sum = 0, h = 0;
  for (let k = 0; k < px.length; k += 4) { sum += 0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]; h = (h * 31 + px[k] + px[k + 1] * 7 + px[k + 2] * 13) >>> 0; }
  return { luma: sum / (W * H), hash: h };
}, prep || '');
// F4-T3 look checks on the real r128 (TL F4-T3 plan review Q7 / other checks): in this page load, no new launch.
async function looks(page, tag) {
  const set = (hour, season) => page.evaluate((l) => PC.view3d.setLook(l), { hour, season });
  const L = {};
  for (const [k, h] of [['noon', 12], ['evening', 17.5], ['night', 22]]) { await set(h, 'summer'); L[k] = (await frame(page)).luma; }
  T.ok(L.noon > L.evening && L.evening > L.night, `${tag} mean luma noon ${L.noon.toFixed(1)} > evening ${L.evening.toFixed(1)} > night ${L.night.toFixed(1)}`);
  // vegetation shadows at 17.5 h: casting trunks / canopies / shrubs darken the frame
  await set(17.5, 'summer');
  const lit = await frame(page, "['trunks','canopies','shrubs'].forEach((n) => { const m = i.world.getObjectByName(n); if (m) m.castShadow = false; });");
  const shaded = await frame(page, "['trunks','canopies','shrubs'].forEach((n) => { const m = i.world.getObjectByName(n); if (m) m.castShadow = true; });");
  T.ok(shaded.luma < lit.luma - 0.05, `${tag} 17.5 h: vegetation shadows darken the ground (${shaded.luma.toFixed(2)} < ${lit.luma.toFixed(2)})`);
  // winter: no canopy pixels (= the frame with the canopies removed); summer: canopies show
  await set(12, 'winter');
  const w = await frame(page), wNo = await frame(page, "i.world.getObjectByName('canopies').visible = false;");
  await set(12, 'summer');
  const sm = await frame(page), smNo = await frame(page, "i.world.getObjectByName('canopies').visible = false;");
  await page.evaluate(() => PC.view3d.setLook({ hour: 12, season: 'summer' }));
  T.ok(w.hash === wNo.hash && sm.hash !== smNo.hash, `${tag} winter frame has no canopy pixels; summer frame has`);
  let casters = await page.evaluate(() => { let n = 0; PC.debug.scene().scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) n++; if (o.isLight && !o.isDirectionalLight && o.castShadow) n += 100; }); return n; });
  T.eq(casters, 1, `${tag} one shadow-casting directional light`);
}
// F5-T1 (plan section 6): after a pick on a ground-floor room and the flight, the highlight shows in the real frame:
// pixels that change when the highlight is hidden, and are #C2410C-like (red well above green and blue).
async function highlight(page, tag) {
  await page.evaluate(() => { const s = document.querySelector('[data-pc="v3-room"]'); s.value = 'r1'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => !PC.view3d.flying() && !PC.debug.scene().frame, null, { timeout: 15000 });
  const n = await page.evaluate(() => {
    const i = PC.debug.scene(), gl = i.renderer.getContext(), m = i.world.getObjectByName('highlight');
    const read = () => { i.renderNow(); const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    const on = read(); m.visible = false; const off = read(); m.visible = true; i.renderNow();
    let k = 0, orange = 0;
    for (let j = 0; j < on.length; j += 4) if (on[j] !== off[j] || on[j + 1] !== off[j + 1] || on[j + 2] !== off[j + 2]) { k++; if (on[j] > 120 && on[j] - on[j + 1] > 40 && on[j] - on[j + 2] > 70) orange++; }
    return { k, orange, caption: document.querySelector('[data-pc="v3-caption-text"]').textContent };
  });
  T.ok(n.orange >= 40 && n.orange >= 0.6 * n.k && n.caption === 'Living · Ground floor', `${tag} highlight drawn on the real r128: ${n.orange} orange of ${n.k} changed pixels; caption "${n.caption}"`);
  await page.evaluate(() => { const s = document.querySelector('[data-pc="v3-room"]'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); PC.view3d.resetView(); });
  await page.waitForFunction(() => !PC.debug.scene().frame && !PC.view3d.selected());
}
function notBlank(res, back, msg) {
  const differ = res.out.filter((c) => c.some((v, k) => Math.abs(v - back[k]) > 12)).length;
  const distinct = new Set(res.out.map((c) => c.join())).size;
  T.ok(differ >= 0.3 * res.out.length && distinct >= 3, `${msg}: ${differ} of ${res.out.length} samples differ from the background, ${distinct} distinct colours`);
}

// A-10 colour rule end to end: a MeshBasicMaterial quad with PC.three.col(hex), through the app's own renderer
// factory (sRGB output), reads back as hex +-2 per channel.
async function colourPipeline(page, tag) {
  const hexes = ['#D9C7A3', '#23292F', '#8EC3EA', '#C4704F', '#FFFFFF'];
  const got = await page.evaluate((hexes) => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; cv.style.width = '64px'; cv.style.height = '64px';
    document.body.appendChild(cv);
    const r = PC.three.makeRenderer(cv); r.setSize(64, 64, false);
    const out = hexes.map((h) => {
      const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, 0.1, 10); cam.position.set(0, 0, 1);
      const g = new THREE.PlaneGeometry(10, 10), m = new THREE.MeshBasicMaterial({ color: PC.three.col(h) });
      sc.add(new THREE.Mesh(g, m));
      r.render(sc, cam);
      const gl = r.getContext(), px = new Uint8Array(4);
      gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      g.dispose(); m.dispose();
      return [px[0], px[1], px[2]];
    });
    r.dispose(); cv.remove();
    return out;
  }, hexes);
  hexes.forEach((h, i) => {
    const want = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
    T.ok(got[i].every((v, k) => Math.abs(v - want[k]) <= 2), `${tag} colour pipeline ${h} reads back as ${got[i].join(',')} (+-2)`);
  });
}

async function scene(vp, dpr) {
  const tag = `${vp.tag}@${dpr}`, o = await open(browser, vp, { three: 'real', dpr, init: countRaf }), { page, act, problems } = o;
  await act('btn-sample'); await act('btn-skip3d');
  await ready(page);
  T.eq(await page.evaluate(() => [THREE.REVISION, document.querySelector('[data-pc="v3-unavailable"]').hidden]), ['128', true], `${tag} real r128 running, 3D available`);
  const back = await bg(page);
  const s1 = await sample(page);
  notBlank(s1, back, `${tag} not blank`);
  T.ok(s1.sky.every((v, k) => Math.abs(v - back[k]) <= 2), `${tag} sky ${s1.sky.join(',')} = the raw background hex (A-10: background not linearised)`);
  T.ok(s1.pr <= 2 && (dpr < 2 || s1.pr === 2), `${tag} renderer pixel ratio ${s1.pr} (<= 2)`);
  T.ok(Math.abs(s1.W - Math.round(s1.cw * Math.min(dpr, 2))) <= 1, `${tag} drawing buffer ${s1.W} = canvas ${s1.cw} x ${Math.min(dpr, 2)}`);
  T.ok(s1.calls <= 80 && s1.meshes <= 40, `${tag} draw calls ${s1.calls} <= 80, meshes ${s1.meshes} <= 40 (G6)`);
  await colourPipeline(page, tag);
  // context loss and restore
  await page.evaluate(() => { window.__lose = PC.debug.scene().renderer.getContext().getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
  await page.waitForFunction(() => PC.debug.scene().lost);
  const lostAt = await page.evaluate(() => { window.__raf = 0; return PC.debug.scene().renders; });
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(200);              // "no frame while lost" has no state to poll
  T.eq(await page.evaluate(() => [window.__raf, PC.debug.scene().renders]), [0, lostAt], `${tag} context lost: no frames requested`);
  await page.evaluate(() => window.__lose.restoreContext());
  await page.waitForFunction((n) => { const i = PC.debug.scene(); return i.restores === 1 && !i.lost && i.renders > n && !i.frame; }, lostAt);
  T.eq(await page.evaluate(() => PC.debug.scene().builds), 2, `${tag} restore rebuilt the scene`);
  notBlank(await sample(page), back, `${tag} renders again after restore`);
  // hidden: no frames
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); window.__raf = 0; });
  await page.locator('[data-pc="v3-canvas"]').focus(); await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);              // the measurement itself: nothing is requested while hidden
  T.eq(await page.evaluate(() => window.__raf), 0, `${tag} hidden: no requestAnimationFrame`);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await ready(page);
  await looks(page, tag);
  await highlight(page, tag);
  if (SHOTS) {
    mkdirSync(SHOT_DIR, { recursive: true });
    const exts = vp.w > 900 ? ['sand', 'white', 'terracotta', 'grey'] : ['sand'];
    for (const ext of exts) {
      const n = await page.evaluate((ext) => { const b = PC.debug.scene().builds; PC.store.commit((s) => { s.ans.exterior = ext; }); return b; }, ext);
      if (ext !== 'sand') await page.waitForFunction((n) => PC.debug.scene().builds > n, n);
      await page.evaluate(() => PC.view3d.resetView());
      await ready(page);
      await page.screenshot({ path: join(SHOT_DIR, `${vp.tag}-${ext}-noon.png`) });
    }
    for (const [name, hour, season] of [['morning', 8, 'spring'], ['evening', 17.5, 'summer'], ['night', 22, 'summer'], ['autumn', 12, 'autumn'], ['winter', 12, 'winter']]) {
      // through the Light controls, so the panel in the shot shows the look
      if (await page.locator('[data-pc="v3-tab-light"]').isVisible()) await page.locator('[data-pc="v3-tab-light"]').click();
      await page.evaluate((l) => {
        const t = document.querySelector('[data-pc="v3-time"]'), se = document.querySelector('[data-pc="v3-season"]');
        t.value = String(l.hour); t.dispatchEvent(new Event('input', { bubbles: true }));
        se.value = l.season; se.dispatchEvent(new Event('change', { bubbles: true }));
      }, { hour, season });
      await ready(page);
      await page.screenshot({ path: join(SHOT_DIR, `${vp.tag}-${name}.png`) });
    }
    await page.evaluate(() => {
      const t = document.querySelector('[data-pc="v3-time"]'), se = document.querySelector('[data-pc="v3-season"]');
      t.value = '12'; t.dispatchEvent(new Event('input', { bubbles: true })); se.value = 'summer'; se.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  T.none(problems(), `${tag} no page errors, console errors or THREE. warnings`);
  await o.ctx.close();
}

// The mock side of the conformance check, in node.
function mockSide() {
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync(join(ROOT, 'tests', 'three-mock.js'), 'utf8'), ctx);
  return { WHITELIST: JSON.parse(JSON.stringify(ctx.__threeMock.WHITELIST)), maths: MATHS(ctx.THREE, ctx.__threeMock.raw) };
}

async function conformance(page, tag) {
  const M = mockSide();
  const fac = Object.entries(FACTORIES).map(([k, f]) => [k, f.toString()]);
  const real = await page.evaluate(({ WL, fac, maths }) => {
    const T = window.THREE, canvas = () => document.createElement('canvas'), missing = [], noFactory = [];
    const F = Object.fromEntries(fac.map(([k, src]) => [k, (0, eval)('(' + src + ')')]));
    for (const [row, members] of Object.entries(WL)) {
      if (!F[row]) { noFactory.push(row); continue; }
      const o = F[row](T, canvas());
      for (const m of members) if (!(m in o)) missing.push(row + '.' + m);
    }
    const out = (0, eval)('(' + maths + ')')(T, (x) => x);
    return { rev: T.REVISION, missing, noFactory, out };
  }, { WL: M.WHITELIST, fac, maths: MATHS.toString() });
  T.eq(real.rev, '128', `${tag} real THREE.REVISION`);
  T.eq(real.noFactory, [], `${tag} every whitelist row has a factory`);
  T.eq(real.missing, [], `${tag} every whitelisted member exists on real r128 (the mock allows nothing r128 lacks)`);
  const bad = [];
  T.eq(real.out.length, M.maths.length, `${tag} maths probe length`);
  real.out.forEach((r, i) => { if (!(Math.abs(r - M.maths[i]) <= 1e-9 * Math.max(1, Math.abs(r)))) bad.push(`#${i}: real ${r} mock ${M.maths[i]}`); });
  T.none(bad.slice(0, 8), `${tag} mock maths equals r128 (Color, Matrix4.compose, makeTranslation, Vector3, CatmullRomCurve3 x4 + 2-point) to 1e-9`);
}

try {
  {
    const vp = VIEWPORTS[2], { ctx, page, problems } = await open(browser, vp, { three: 'real' });
    await conformance(page, `${vp.tag} conformance:`);
    T.none(problems(), `${vp.tag} conformance: no errors / THREE warnings`);
    await ctx.close();
  }
  await Promise.all([scene(VIEWPORTS[0], 3), scene(VIEWPORTS[2], 1)]);
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
