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
import { launch, open, suite, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import { ROOT, loadCore } from '../helpers/load.mjs';
import { maxHouse } from '../helpers/houses.mjs';
import { projectPx } from '../helpers/project.mjs';
import { FACTORIES, MATHS } from '../helpers/three-factories.mjs';

const T = suite('e2e view3d-real'), browser = await launch(), SHOTS = process.argv.includes('--shots');
const FULL = !!process.env.QA_FULL;   // F6-T1a (TL Q-T8): checks a QA section covers in the default run are QA_FULL=1 only
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
  // (F6-T1a: the shadow map is drawn on demand, so this test-side caster change asks for one update itself)
  const lit = await frame(page, "['trunks','canopies','shrubs'].forEach((n) => { const m = i.world.getObjectByName(n); if (m) m.castShadow = false; }); i.renderer.shadowMap.needsUpdate = true;");
  const shaded = await frame(page, "['trunks','canopies','shrubs'].forEach((n) => { const m = i.world.getObjectByName(n); if (m) m.castShadow = true; }); i.renderer.shadowMap.needsUpdate = true;");
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
    let k = 0, orange = 0, minX = Infinity, maxX = -Infinity;
    const W = gl.drawingBufferWidth, c = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect(), sc = c.width / W;
    for (let j = 0; j < on.length; j += 4) if (on[j] !== off[j] || on[j + 1] !== off[j + 1] || on[j + 2] !== off[j + 2]) { k++; const x = (j / 4) % W; minX = Math.min(minX, x); maxX = Math.max(maxX, x); if (on[j] > 120 && on[j] - on[j + 1] > 40 && on[j] - on[j + 2] > 70) orange++; }
    const occl = i.occl.right;
    return { k, orange, caption: document.querySelector('[data-pc="v3-caption-text"]').textContent, minX: Math.round(c.left + minX * sc), maxX: Math.round(c.left + maxX * sc),
      panelLeft: occl > 0 ? Math.round(document.querySelector('[data-pc="v3-panel"]').getBoundingClientRect().left) : null };
  });
  T.ok(n.orange >= 40 && n.orange >= 0.6 * n.k && n.caption === 'Living · Ground floor', `${tag} highlight drawn on the real r128: ${n.orange} orange of ${n.k} changed pixels; caption "${n.caption}"`);
  // F5-T3a (TL ruling 2): at desktop width the changed highlight pixels lie left of the floating panel (lens shift)
  if (n.panelLeft !== null) T.ok(n.k > 0 && n.maxX < n.panelLeft, `${tag} highlight bbox x ${n.minX}-${n.maxX} css px, left of the panel at ${n.panelLeft}`);
  await page.evaluate(() => { const s = document.querySelector('[data-pc="v3-room"]'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); PC.view3d.resetView(); });
  await page.waitForFunction(() => !PC.debug.scene().frame && !PC.view3d.selected());
}
// F5-T1 QA B-1 regression: with a basement, the pit is open from above on the real r128. (1) A finder pick on a
// basement edge room: the first VISIBLE object on the ray from the eye to the highlight is the highlight or level B
// (never the ground), and the highlight draws orange pixels. (2) Reset view with the Basement level: the ray from the
// eye to the footprint centre at the basement floor meets level B first, not groundOuter / groundPlot / groundCap.
async function basement(page, tag) {
  const b0 = await page.evaluate(() => PC.debug.scene().builds);
  await page.evaluate((st) => PC.store.replace(st), maxHouse(loadCore()));
  await page.waitForFunction((b) => { const i = PC.debug.scene(); return i.builds > b && !i.building && !i.frame; }, b0, { timeout: 15000 });
  const id = await page.evaluate(() => PC.cam.roomGroups(PC.debug.house())[0].rooms[7].id);
  await page.evaluate((id) => { const s = document.querySelector('[data-pc="v3-room"]'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); }, id);
  await page.waitForFunction(() => !PC.view3d.flying() && !PC.debug.scene().frame, null, { timeout: 15000 });
  const firstHit = `(i, to) => {
    const cam = i.camera, from = cam.position.clone(), dir = to.clone().sub(from).normalize(), rc = new THREE.Raycaster(from, dir, 0.01, from.distanceTo(to) + 0.5);
    const shown = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
    const h = rc.intersectObjects(i.world.children, true).find((x) => shown(x.object));
    if (!h) return null; const path = []; for (let n = h.object; n && n !== i.world; n = n.parent) path.push(n.name); return path.reverse().join('/'); }`;
  const r = await page.evaluate(([fh]) => {
    const hit = new Function('return ' + fh)(), i = PC.debug.scene(), gl = i.renderer.getContext(), m = i.world.getObjectByName('highlight');
    m.geometry.computeBoundingBox(); const c = m.geometry.boundingBox.getCenter(new THREE.Vector3());
    const read = () => { i.renderNow(); const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    const on = read(); m.visible = false; const off = read(); m.visible = true; i.renderNow();
    let orange = 0; for (let j = 0; j < on.length; j += 4) if ((on[j] !== off[j] || on[j + 1] !== off[j + 1]) && on[j] > 120 && on[j] - on[j + 1] > 40 && on[j] - on[j + 2] > 70) orange++;
    // Reset view + Basement: the footprint centre at the basement floor
    PC.view3d.select(null); PC.view3d.setLevel('B'); PC.view3d.resetView(); i.renderNow();
    const h = i.house, fp = h.footprint, lv = h.levels.find((l) => l.id === 'B');
    const mid = new THREE.Vector3(fp.u + fp.w / 2 - h.center[0], lv.baseY + 0.2 + 0.05, -(fp.v + fp.d / 2 - h.center[1]));
    const res = { pick: hit(i, c), orange, reset: hit(i, mid), cap: i.world.getObjectByName('groundCap').visible };
    PC.view3d.setLevel('all'); PC.view3d.resetView();
    return res;
  }, [firstHit]);
  T.ok(r.pick && /^(highlight|level-B)/.test(r.pick) && r.orange >= 40, `${tag} QA B-1: basement pick, first visible hit on the eye -> highlight ray "${r.pick}", ${r.orange} orange pixels`);
  T.ok(r.reset && r.reset.startsWith('level-B') && r.cap === false, `${tag} QA B-1: Reset + Basement, first visible hit towards the pit floor "${r.reset}" (not the ground)`);
  // F5-T2 (TL plan review item 5, required): the tour on the maximum house, sought to the first and the last basement stop (just before
  // it, while that room is the highlighted target) and paused: on the real r128 the first visible hit on the ray from
  // the eye to the highlight is the highlight or level B, and the highlight draws orange pixels.
  await page.evaluate(() => document.querySelector('[data-pc="v3-tour-start"]').click());
  const bs = (await page.evaluate(() => PC.three.tour.state().plan.stops.map((s, k) => [k, s.level, s.t, s.id]).filter((s) => s[1] === 'B')))
    .filter((s, k, a) => k === 0 || k === a.length - 1);   // the first and last basement stops (run-time headroom)
  T.ok(bs.length === 2, `${tag} tour: first and last basement stops checked`);
  for (const [k, , t, id] of bs) {
    // paused, sought, resumed: the first frame after Resume has dt 0, so it shows exactly t - 0.3
    await page.evaluate((t) => { PC.three.tour.pause(); PC.debug.tourSeek(t - 0.3); PC.three.tour.resume(); }, t);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const q = await page.evaluate(([fh]) => {
      PC.three.tour.pause();
      const hit = new Function('return ' + fh)(), i = PC.debug.scene(), gl = i.renderer.getContext(), m = i.world.getObjectByName('highlight');
      if (!m) return { none: true, sel: PC.view3d.selected() };
      m.geometry.computeBoundingBox(); const c = m.geometry.boundingBox.getCenter(new THREE.Vector3());
      const read = () => { i.renderNow(); const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
      const on = read(); m.visible = false; const off = read(); m.visible = true; i.renderNow();
      let orange = 0; for (let j = 0; j < on.length; j += 4) if ((on[j] !== off[j] || on[j + 1] !== off[j + 1]) && on[j] > 120 && on[j] - on[j + 1] > 40 && on[j] - on[j + 2] > 70) orange++;
      const res = { pick: hit(i, c), orange, sel: PC.view3d.selected(), level: i.level, run: PC.three.tour.running() };
      PC.three.tour.resume();
      return res;
    }, [firstHit]);
    T.ok(q.run && q.sel === id && q.level === 'B' && q.pick && /^(highlight|level-B)/.test(q.pick) && q.orange >= 40, `${tag} tour basement stop ${k} (${id}): first visible hit "${q.pick}", ${q.orange} orange pixels, level ${q.level}, highlight ${q.sel}`);
  }
  await page.evaluate(() => PC.three.tour.stop());
}
function notBlank(res, back, msg) {
  const differ = res.out.filter((c) => c.some((v, k) => Math.abs(v - back[k]) > 12)).length;
  const distinct = new Set(res.out.map((c) => c.join())).size;
  T.ok(differ >= 0.3 * res.out.length && distinct >= 3, `${msg}: ${differ} of ${res.out.length} samples differ from the background, ${distinct} distinct colours`);
}

// A-10 colour rule end to end: a MeshBasicMaterial quad with PC.three.col(hex), through the app's own renderer
// factory (sRGB output), reads back as hex +-2 per channel. F6-T1a (CTO C-2, TL Q-T7): the factory tone-maps (ACES),
// so the quad is toneMapped: false, as the UI marks are; a tone-mapped quad must read differently (ACES is on).
async function colourPipeline(page, tag) {
  const hexes = ['#D9C7A3', '#23292F', '#8EC3EA', '#C4704F', '#FFFFFF'];
  const got = await page.evaluate((hexes) => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; cv.style.width = '64px'; cv.style.height = '64px';
    document.body.appendChild(cv);
    const r = PC.three.makeRenderer(cv); r.setSize(64, 64, false);
    const out = hexes.map((h) => {
      const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, 0.1, 10); cam.position.set(0, 0, 1);
      const g = new THREE.PlaneGeometry(10, 10), m = new THREE.MeshBasicMaterial({ color: PC.three.col(h), toneMapped: false });
      sc.add(new THREE.Mesh(g, m));
      const gl = r.getContext(), px = new Uint8Array(4), read = () => { r.render(sc, cam); gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [px[0], px[1], px[2]]; };
      const flat = read(); m.toneMapped = true; m.needsUpdate = true; const aces = read();
      g.dispose(); m.dispose();
      return [flat, aces];
    });
    r.dispose(); cv.remove();
    return out;
  }, hexes);
  hexes.forEach((h, i) => {
    const want = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
    T.ok(got[i][0].every((v, k) => Math.abs(v - want[k]) <= 2), `${tag} colour pipeline ${h} (toneMapped false) reads back as ${got[i][0].join(',')} (+-2)`);
  });
  T.ok(got[0][1].some((v, k) => Math.abs(v - got[0][0][k]) > 4), `${tag} ACES on: a tone-mapped #D9C7A3 quad reads ${got[0][1].join(',')}, not the hex`);
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
  T.ok(s1.calls <= 160 && s1.meshes <= 64, `${tag} draw calls ${s1.calls} <= 160, meshes ${s1.meshes} <= 64 (G6; F6-T1a: CTO C-4.1 / C-4.2)`);
  await colourPipeline(page, tag);
  await realism(page, tag);
  if (vp.w > 900) await detailReal(page, tag);
  // context loss and restore (QA_FULL=1 only since F6-T1a, TL Q-T8: QA f4-t2-view "E budget", f4-t3-view A and the
  // f6-t1 leak suite cover it in the default run; the texture re-creation is in tests/three/scene.test)
  if (FULL) {
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
  }
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
  if (vp.w > 900) { await basement(page, tag); await maxBudget(page, tag); }
  T.none(problems(), `${tag} no page errors, console errors or THREE. warnings`);
  await o.ctx.close();
}

// F6-T1a real-r128 checks (plan 9.2; TL review; CTO C-4.2 .. C-4.4, C-4.8; on-demand shadow conditions).
// Seam: pose at phiMax (5 deg above the horizon) and rMax, columns near both edges (clear of the house and trees); the pixels 2 px above and
// below the horizon line differ by <= 3 per channel and equal the horizon hex +-3, at noon, evening and night. Sky: a
// pixel near the top equals the dome gradient at its ray elevation (+-3). Shadows: with the sun at 14 h, top-down, ground
// points in the upper storey's shadow (outside the footprint) brighten when the level selector hides the upper levels.
async function realism(page, tag) {
  await page.evaluate(() => { const V = PC.view3d, p = V.pose(); V.flyTo(Object.assign({}, p, { phi: V.limits().phiMax, radius: V.limits().rMax }), 1); });
  await page.waitForFunction(() => !PC.view3d.flying() && !PC.debug.scene().frame, null, { timeout: 15000 });
  for (const hour of [12, 17.5, 22]) {
    const r = await page.evaluate((hour) => {
      PC.view3d.setLook({ hour, season: 'summer' });
      const i = PC.debug.scene(), gl = i.renderer.getContext(), cam = i.camera, L = PC.sky.compute(hour, 'summer', i.house.northDeg);
      i.renderNow();
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(4), read = (x, y) => { gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [px[0], px[1], px[2]]; };
      const e = cam.position, t = PC.view3d.pose().target, f = new THREE.Vector3(t[0] - e.x, 0, t[2] - e.z).normalize();
      const hz = e.clone().add(f.multiplyScalar(cam.far * 0.5)).project(cam), yH = Math.round((hz.y + 1) / 2 * H);
      const cols = [0.03, 0.08, 0.92, 0.97].map((k) => Math.floor(W * k)), out = cols.map((x) => [read(x, yH + 2), read(x, yH - 2)]);
      // fully fogged ground (view depth beyond fog.far, inside the outer ground and the far plane): per column the row nearest the
      // horizon whose ray meets the ground there; it must read the raw horizon hex (a linearised fog colour does not;
      // the house and trees stand in front of some columns, so half of them is the bar)
      const fog = i.scene.fog, edge = PC.C.HOUSE.outerK * i.house.radius / 2 * 0.98, fogged = [];
      for (let x = Math.floor(W * 0.02); x < W * 0.98; x += Math.floor(W * 0.04)) {
        for (let y = yH - 1; y > Math.max(0, yH - 200); y--) {
          const dir = new THREE.Vector3(x / W * 2 - 1, y / H * 2 - 1, 0.5).unproject(cam).sub(e);
          if (dir.y >= 0) continue;
          const k = (-0.05 - e.y) / dir.y, P = e.clone().add(dir.multiplyScalar(k));
          if (Math.abs(P.x) > edge || Math.abs(P.z) > edge) continue;
          const z = -P.clone().applyMatrix4(cam.matrixWorldInverse).z;
          if (z >= cam.far * 0.98) continue;   // clipped by the far plane: the dome shows there
          if (z > fog.far + 0.5) fogged.push(read(x, y));
          break;
        }
      }
      // a sky pixel near the top: its ray elevation and the dome colour there (linear lerp, back to sRGB)
      const yS = H - Math.max(3, Math.floor(H * 0.03)), ndc = new THREE.Vector3(0, yS / H * 2 - 1, 0.5).unproject(cam).sub(e).normalize();
      const el = Math.asin(ndc.y) * 180 / Math.PI, lin = (h) => { const c = PC.three.col(h); return [c.r, c.g, c.b]; };
      const g = PC.three.skyAt(el, lin(L.skyHorizon), lin(L.skyMid), lin(L.skyZenith)), c = new THREE.Color(g[0], g[1], g[2]).convertLinearToSRGB();
      return { out, fogged, yH, H, horizon: [1, 3, 5].map((k) => parseInt(L.skyHorizon.slice(k, k + 2), 16)), sky: read(W >> 1, yS), skyWant: [c.r, c.g, c.b].map((v) => Math.round(v * 255)), el };
    }, hour);
    const d = (a, b) => Math.max(...a.map((v, k) => Math.abs(v - b[k])));
    const seam = Math.max(...r.out.map(([a, b]) => d(a, b))), off = Math.max(...r.out.flat().map((p) => d(p, r.horizon)));
    T.ok(r.yH > 4 && r.yH < r.H - 4 && seam <= 3 && off <= 3, `${tag} ${hour} h horizon seam ${seam} <= 3 per channel, both sides = horizon ${r.horizon} +-${off} (row ${r.yH} of ${r.H})`);
    const fogOk = r.fogged.filter((p) => d(p, r.horizon) <= 3).length;
    T.ok(r.fogged.length >= 8 && fogOk >= Math.max(6, 0.5 * r.fogged.length), `${tag} ${hour} h fully fogged ground = raw horizon hex +-3 in ${fogOk} of ${r.fogged.length} columns (A-10 / Q-T6 raw fog colour)`);
    T.ok(d(r.sky, r.skyWant) <= 3, `${tag} ${hour} h sky pixel at ${r.el.toFixed(1)} deg ${r.sky} = dome ${r.skyWant} +-3 (TL Q-T7)`);
  }
  // shadows on demand: no stale shadow map after a look change, a camera flight or a Roof switch (a forced shadow
  // update changes no pixel), and a level change re-draws it (the upper storey's shadow leaves the ground)
  const stale = (how) => page.evaluate((how) => {
    const i = PC.debug.scene(), V = PC.view3d, gl = i.renderer.getContext();
    if (how === 'look') V.setLook({ hour: 14, season: 'summer' });
    if (how === 'roof') { V.setRoof(false); }
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, read = () => { i.renderNow(); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
    const a = read(); i.renderer.shadowMap.needsUpdate = true; const b = read();
    if (how === 'roof') V.setRoof(true);
    let n = 0; for (let j = 0; j < a.length; j += 4) if (Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) + Math.abs(a[j + 2] - b[j + 2]) > 6) n++;
    return n;
  }, how);
  const st = [await stale('look')];
  await page.evaluate(() => { const V = PC.view3d; V.flyTo(Object.assign({}, V.pose(), { phi: V.limits().phiMin }), 1); });
  await page.waitForFunction(() => !PC.view3d.flying() && !PC.debug.scene().frame, null, { timeout: 15000 });
  st.push(await stale('flight'), await stale('roof'));
  T.eq(st, [0, 0, 0], `${tag} on-demand shadows: a forced shadow update changes no pixel after setLook, a flight, a Roof switch`);
  const lv = await page.evaluate(() => {
    const i = PC.debug.scene(), h = i.house, gl = i.renderer.getContext(), PIT = h.levels[1] ? h.levels[1].baseY - h.levels[0].baseY : 3;
    const s = PC.sky.compute(14, 'summer', h.northDeg).sunDir, fp = h.footprint, top = h.levels[h.levels.length - 1];
    const cu = h.center[0], cv = h.center[1], W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(4), pts = [];
    // ground points in the shadow of the upper storey: footprint corners / edge midpoints at heights inside that
    // storey, thrown along the sun ray onto the ground; kept when on screen
    for (const a of [0, 0.5, 1]) for (const b of [0, 0.5, 1]) for (const k of [0.3, 0.6, 0.9]) {
      if (a === 0.5 && b === 0.5) continue;
      const y = top.baseY + k * PIT, x = fp.u + a * fp.w - cu, z = -(fp.v + b * fp.d - cv);
      const n = new THREE.Vector3(x - s[0] * y / s[1], 0.02, z - s[2] * y / s[1]).project(i.camera);
      const X = Math.round((n.x + 1) / 2 * W), Y = Math.round((n.y + 1) / 2 * H);
      if (X > 2 && Y > 2 && X < W - 2 && Y < H - 2) pts.push([X, Y]);
    }
    const luma = () => { i.renderNow(); return pts.map(([X, Y]) => { gl.readPixels(X, Y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]; }); };
    const all = luma(), u0 = i.shadowUpdates;
    PC.view3d.setLevel(h.levels[0].id === 'B' ? 'G' : h.levels[0].id);
    const low = luma(), u1 = PC.debug.scene().shadowUpdates;
    PC.view3d.setLevel('all');
    return { all, low, updates: u1 - u0, top: top.id, n: pts.length };
  });
  const gain = Math.max(0, ...lv.low.map((v, k) => v - lv.all[k]));
  T.ok(lv.updates >= 1 && gain >= 8, `${tag} on-demand shadows: hiding the levels above the ground floor re-draws the shadow map (${lv.updates} update), ground in the ${lv.top} storey's shadow brightens by ${gain.toFixed(1)} (>= 8, best of ${lv.n} points)`);
  await page.evaluate(() => { PC.view3d.setLook({ hour: 12, season: 'summer' }); PC.view3d.resetView(); });
  await ready(page);
}

// Maximum house (loaded by basement()): draw calls <= 160 and triangles <= 300 000 for one frame incl. the shadow pass,
// Reset, Roof on and off (CTO C-4.2 / C-4.3); build <= 400 ms best of 3 at 1280x800 incl. texture creation (C-4.8).
// F6-T1b on real r128 (plan 6.1 - 6.3): the blob plane draws (hiding it brightens pixels; winter keeps only the
// shrubs' blobs, so fewer), instanceColor exists on canopies and shrubs, and glass decals (a quarter in from the jamb,
// 35 % up) read darker than the wall
// beside them where both are the first hit from the eye (at least half of the visible pairs).
async function detailReal(page, tag) {
  await page.evaluate(() => { PC.view3d.setLook({ hour: 12, season: 'summer' }); PC.view3d.resetView(); });
  await ready(page);
  const r = await page.evaluate(() => {
    const i = PC.debug.scene(), gl = i.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, w = i.world;
    const grab = () => { i.renderNow(); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
    const blobs = w.getObjectByName('blobs'), darker = () => { const a = grab(); blobs.visible = false; const b = grab(); blobs.visible = true; let n = 0; for (let j = 0; j < a.length; j += 4) if (b[j] + b[j + 1] + b[j + 2] - a[j] - a[j + 1] - a[j + 2] > 6) n++; return n; };
    const summer = darker(); PC.view3d.setLook({ hour: 12, season: 'winter' }); const winter = darker(), wc = blobs.count; PC.view3d.setLook({ hour: 12, season: 'summer' });
    const tinted = ['canopies', 'shrubs'].map((n) => { const m = w.getObjectByName(n); const c = m && m.instanceColor; return !!(c && c.itemSize === 3 && c.array instanceof Float32Array && c.count >= m.count); });
    // glass vs wall
    const h = i.house, fp = h.footprint, cu = h.center[0], cv = h.center[1], cam = i.camera, rc = new THREE.Raycaster(), px = new Uint8Array(4), D = PC.C.OPEN.decal;
    i.renderNow();
    const at = (o, s, y) => {   // a point on the opening's wall at s along it (plan metres), height y, 0.012 m out
      const P = { front: [s - cu, -(fp.v - cv) + 0.012], back: [s - cu, -(fp.v + fp.d - cv) - 0.012], left: [fp.u - cu - 0.012, -(s - cv)], right: [fp.u + fp.w - cu + 0.012, -(s - cv)] }[o.side];
      return new THREE.Vector3(P[0], y, P[1]);
    };
    const look = (p, want) => {
      const d = p.clone().sub(cam.position), L = d.length(); rc.set(cam.position, d.normalize());
      const hit = rc.intersectObjects(w.children, true).find((x) => x.object.visible && !/^(sky|blobs)$/.test(x.object.name));
      if (!hit || !want.test(hit.object.name) || Math.abs(hit.distance - L) > 0.05) return null;
      const n = p.clone().project(cam), X = Math.round((n.x + 1) / 2 * W), Y = Math.round((n.y + 1) / 2 * H);
      if (X < 1 || Y < 1 || X >= W - 1 || Y >= H - 1) return null;
      gl.readPixels(X, Y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2];
    };
    let pairs = 0, ok = 0;
    for (const o of h.openings) {
      if (o.kind !== 'glazed') continue;
      const lv = h.levels.find((l) => l.id === o.level), y0 = lv.baseY + 0.2, y = y0 + o.sill + (o.head - o.sill) * 0.35;
      const g = look(at(o, o.a + (o.b - o.a) * 0.25, y), /^roofBatch$/);   // a quarter in: clear of a centre mullion
      const wl = [look(at(o, o.a - D.frame - 0.25, y), /^(walls|roofBatch)$/), look(at(o, o.b + D.frame + 0.25, y), /^(walls|roofBatch)$/)].filter((x) => x != null);
      if (g == null || !wl.length) continue;
      pairs++; if (g < Math.max(...wl) - 10) ok++;
    }
    return { summer, winter, wc, all: blobs.userData.all, shrubs: blobs.userData.shrubs, tinted, pairs, ok };
  });
  T.ok(r.summer > 50 && r.winter < r.summer && r.wc === r.shrubs, `${tag} F6-T1b blobs draw: ${r.summer} px darkened in summer, ${r.winter} in winter (count ${r.wc} = ${r.shrubs} shrubs of ${r.all})`);
  T.eq(r.tinted, [true, true], `${tag} F6-T1b instanceColor on canopies and shrubs (real r128)`);
  T.ok(r.pairs >= 2 && r.ok >= Math.ceil(r.pairs / 2), `${tag} F6-T1b glass decals darker than the wall beside them in ${r.ok} of ${r.pairs} visible pairs`);
  console.log(`  [record] ${tag} F6-T1b: blobs ${r.summer} / ${r.winter} px, glass pairs ${r.ok} / ${r.pairs}`);
  // F6-T1c R2: the deck draws over the slab top without depth fighting, at Reset and at rMax. Inside the deck (inset
  // past the bands), the frame with the deck hidden shows the slab top in exteriors.slab; with the deck shown at most
  // 2 % of those pixels may still read the same (a z-fight shows the slab through)
  const deckAt = (far) => page.evaluate(async (far) => {
    const V = PC.view3d; if (far) V.flyTo(Object.assign({}, V.pose(), { radius: V.limits().rMax }), 1);
    await new Promise((res) => { const w = () => (!V.flying() && !PC.debug.scene().frame ? res() : requestAnimationFrame(w)); w(); });
    const i = PC.debug.scene(), gl = i.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, h = i.house, fp = h.footprint, R = PC.C.ROOF;
    const d = i.world.getObjectByName('roofDeck'), k = R.parapetT + PC.C.CONTACT.deckW + 0.3, y = h.roof.baseY + R.slab, cu = h.center[0], cv = h.center[1];
    const grab = () => { i.renderNow(); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
    const a = grab(); d.visible = false; const b = grab(); d.visible = true;
    const P = [[fp.u + k, fp.v + k], [fp.u + fp.w - k, fp.v + k], [fp.u + fp.w - k, fp.v + fp.d - k], [fp.u + k, fp.v + fp.d - k]].map((q) => { const n = new THREE.Vector3(q[0] - cu, y, -(q[1] - cv)).project(i.camera); return [(n.x + 1) / 2 * W, (n.y + 1) / 2 * H]; });
    const inside = (x, yy) => { let c = false; for (let m = 0, n = 3; m < 4; n = m++) { const [xi, yi] = P[m], [xj, yj] = P[n]; if ((yi > yy) !== (yj > yy) && x < (xj - xi) * (yy - yi) / (yj - yi) + xi) c = !c; } return c; };
    let n = 0, same = 0;
    for (let yy = 0; yy < H; yy += 2) for (let x = 0; x < W; x += 2) {
      if (!inside(x + 0.5, yy + 0.5)) continue;
      const o = (yy * W + x) * 4; n++;
      if (Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2]) <= 6) same++;
    }
    if (far) V.resetView();
    return { n, same };
  }, far);
  const near = await deckAt(false), far = await deckAt(true);
  await ready(page);
  T.ok(near.n > 200 && far.n > 50 && near.same <= 0.02 * near.n && far.same <= 0.02 * far.n, `${tag} F6-T1c roofDeck draws over the slab top: ${near.n - near.same} / ${near.n} deck pixels change at Reset, ${far.n - far.same} / ${far.n} at rMax (<= 2 % unchanged: no z-fight)`);
}

async function maxBudget(page, tag) {
  const r = await page.evaluate(async () => {
    const V = PC.view3d, i = PC.debug.scene(), out = {};
    V.setLevel('all'); V.resetView();
    for (const on of [true, false]) {
      V.setRoof(on); i.renderer.shadowMap.needsUpdate = true; i.renderNow();
      out[on ? 'on' : 'off'] = [i.renderer.info.render.calls, i.renderer.info.render.triangles];
    }
    V.setRoof(true);
    const h = PC.debug.house(), c = document.querySelector('[data-pc="v3-canvas"]'), t = [];
    for (let k = 0; k < 3; k++) {
      const h2 = Object.assign({}, h, { key: h.key + '-b' + k });
      const t0 = performance.now();
      await new Promise((res) => V.open(h2, c, (st) => { if (st === 'ready') res(); }));
      t.push(performance.now() - t0);
    }
    await new Promise((res) => V.open(h, c, (st) => { if (st === 'ready') res(); }));
    out.build = t; out.meshes = PC.debug.scene().meshCount;
    return out;
  });
  T.ok(r.on[0] <= 160 && r.off[0] <= 160 && r.on[1] <= 300000 && r.off[1] <= 300000, `${tag} maximum house: draw calls ${r.on[0]} / ${r.off[0]} <= 160, triangles ${r.on[1]} / ${r.off[1]} <= 300 000 (Roof on / off)`);
  const best = Math.min(...r.build);
  // Regression guard only (TL ruling; raised to 1200 ms after loaded runs read up to 970 ms): <= 1200 ms in every run, other browser files running beside it. C-4.8 itself
  // (<= 400 ms) is tests/solo/build-time.mjs, which run-all runs alone under QA_FULL=1.
  T.ok(best <= 1200, `${tag} maximum house build ${best.toFixed(0)} ms (best of ${r.build.map((x) => x.toFixed(0)).join(', ')}) <= 1200 ms (regression guard, TL 2026-11-22: loaded runs read 414-970 ms; C-4.8 is the QA_FULL solo step)`);
  console.log(`  [record] ${tag} max house: calls ${r.on[0]} / ${r.off[0]}, triangles ${r.on[1]} / ${r.off[1]}, build best ${best.toFixed(0)} ms (loaded), meshes ${r.meshes}`);
}

// Lite tier smoke (CTO C-4.7): a fresh page with the tier switched by data before stage 5 opens renders a frame.
async function liteSmoke(vp) {
  const tag = `${vp.tag}@2 lite`, o = await open(browser, vp, { three: 'real', dpr: 2 }), { page, act, problems } = o;
  await page.evaluate(() => { PC.C.VIEW3D.tier = { coarse: 'lite', fine: 'lite' }; });
  await act('btn-sample'); await act('btn-skip3d');
  await ready(page);
  const r = await page.evaluate(() => { const i = PC.debug.scene(), sun = i.scene.getObjectByName('sun'); return [i.tier.name, i.scene.fog, sun.shadow.mapSize.x, i.renderer.getPixelRatio(), i.textures.map((t) => t.image.width)]; });
  T.eq(r, ['lite', null, 1024, 1.5, [256, 256, 256, 64, 256]], `${tag}: tier lite, no fog, map 1024, pixel ratio 1.5, colour textures 256 (+ the 64 px blob, F6-T1b; + membrane on the flat sample, F6-T1c)`);
  const s = await sample(page);
  notBlank(s, s.sky, `${tag} not blank`);
  T.none(problems(), `${tag} no page errors, console errors or THREE. warnings`);
  await o.ctx.close();
}

// F6-T1b (resetPhi 62, TL conditions): the Reset pose frames the whole plot, sample, Roof on, real r128, with the view
// panel collapsed, at 360x640, 640x360 and 1280x800: every plot corner projects inside the canvas, and the pose is
// the A-12 reset (phi = PC.C.CAM.resetPhi). Not asserted: the phone with the dock open (its near edge is cut by about
// 1 px, a known limit until occl.bottom counts, T3b; impl-notes).
async function resetFrame(vp) {
  const tag = `${vp.tag} reset fit`, o = await open(browser, vp, { three: 'real', dpr: 1 }), { page, act, problems } = o;
  await act('btn-sample'); await act('btn-skip3d');
  await ready(page);
  await act('v3-panel-toggle');
  await page.waitForFunction(() => document.querySelector('[data-pc="v3-panel"]').classList.contains('is-collapsed'), null, { timeout: 5000 });
  // the Reset button sits in the collapsed body: its action (PC.view3d.resetView) with the panel collapsed
  await page.evaluate(() => PC.view3d.resetView());
  await page.waitForFunction(() => !PC.view3d.flying() && !PC.debug.scene().frame, null, { timeout: 15000 });
  const r = await page.evaluate(() => {
    const i = PC.debug.scene(), cam = i.camera, h = PC.debug.house(), cr = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect();
    const pts = h.plot.pts.map((q) => { const v = new THREE.Vector3(q[0] - h.center[0], 0, -(q[1] - h.center[1])).project(cam); return [(v.x + 1) / 2 * cr.width, (1 - v.y) / 2 * cr.height]; });
    return { roof: i.roof, phi: PC.view3d.pose().phi, want: PC.C.CAM.resetPhi * Math.PI / 180, margin: Math.min(...pts.map((q) => Math.min(q[0], cr.width - q[0], q[1], cr.height - q[1]))), W: cr.width, H: cr.height };
  });
  T.ok(r.roof && Math.abs(r.phi - r.want) < 1e-9 && r.margin >= 0, `${tag}: Roof on, phi ${(r.phi * 180 / Math.PI).toFixed(1)} deg = resetPhi, every plot corner inside the ${r.W} x ${r.H} canvas (margin ${r.margin.toFixed(0)} px, panel collapsed)`);
  T.none(problems(), `${tag}: no page errors, console errors or THREE. warnings`);
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
  // F5-T3a lens shift: tests/helpers/project.mjs (used by the mock three tests) equals r128's projection with and
  // without setViewOffset, and clearViewOffset restores the plain projection
  const lens = await page.evaluate((src) => {
    const proj = (0, eval)('(' + src + ')'), T3 = window.THREE, out = [];
    for (const [W, H, o] of [[1280, 800, 336], [1280, 800, 0], [944, 700, 120]]) {
      const cam = new T3.PerspectiveCamera(45, W / H, 0.5, 500), eye = [14, 9, 21], tgt = [1, 0.7, -2], vo = o ? [W + o, H, o, 0, W, H] : null;
      cam.position.set(eye[0], eye[1], eye[2]); cam.lookAt(tgt[0], tgt[1], tgt[2]);
      if (vo) { cam.aspect = vo[0] / vo[1]; cam.setViewOffset(vo[0], vo[1], vo[2], vo[3], vo[4], vo[5]); } else cam.clearViewOffset();
      cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      for (const p of [tgt, [6, 0, 3], [-5, 2.5, -7], [0, 0, 0]]) {
        const v = new T3.Vector3(p[0], p[1], p[2]).project(cam), mine = proj(eye, tgt, 45, W, H, vo, p);
        out.push(Math.abs((v.x + 1) / 2 * W - mine[0]), Math.abs((1 - v.y) / 2 * H - mine[1]));
      }
    }
    return Math.max(...out);
  }, projectPx.toString());
  T.ok(lens < 1e-6, `${tag} projectPx equals r128 Vector3.project with setViewOffset / clearViewOffset (max error ${lens.toExponential(1)} px)`);
}

try {
  {
    const vp = VIEWPORTS[2], { ctx, page, problems } = await open(browser, vp, { three: 'real' });
    await conformance(page, `${vp.tag} conformance:`);
    T.none(problems(), `${vp.tag} conformance: no errors / THREE warnings`);
    await ctx.close();
  }
  await Promise.all([scene(VIEWPORTS[0], 3), scene(VIEWPORTS[2], 1), liteSmoke(VIEWPORTS[0])]);
  for (const vp of [VIEWPORTS[0], LANDSCAPE, VIEWPORTS[2]]) await resetFrame(vp);
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
