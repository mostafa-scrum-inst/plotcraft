// F6-T1 QA (browser, vendored real r128): realism MVP budgets, sky dome, horizon seam and highlight, judged by QA's own
// reference (f6-t1-ref.mjs). Version-aware: needs the F6-T1 tier record (PC.C.VIEW3D.tiers) or PC.texgen; without it the
// suite only notes the skip (--force runs it anyway, for a dry run of the mechanics on an older build).
//   B 1280x800 maximum house, Reset pose, Roof on and off (QA's roofTo helper, independent of roofOnOpen): meshes <= 64,
//     draw calls incl. the shadow pass <= 160, triangles <= 300 000 (one forced frame with info.autoReset off and the
//     shadow map marked for update), transparent meshes <= 2 and only poolWater / blobs, GPU textures <= 12 and the
//     scene's texture memory <= 16 MB (w x h x 4, x 4/3 with mipmaps).
//   S horizon seam (full tier): a low pose (phi max, radius max) at 12 / 17.5 / 22 h summer; the pixels 3 px above and
//     below the horizon row (projected from a far point at eye height) at both canvas edges differ by <= 3 per channel.
//   K sky dome colour: at the same pose, sky pixels at known elevations (unprojected from the camera) read QA's dome colour
//     from compute()'s skyHorizon / skyMid / skyZenith and the elevation rule +- 3 per channel; background = fog = horizon.
//   H highlight: a picked room at 22 h winter: the highlight's pixels (frame with it vs without) read #C2410C +- 2.
// Run: node tests/qa/f6-t1-view.mjs [--no-shots] [--only=B,S,K,H] [--force]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, collector, launch } from './lib.mjs';
import { sessions } from './session.mjs';
import * as H from './f4-t1-ref.mjs';
import * as V from './f6-t1-ref.mjs';
import { MAXMUT } from './f5-t3-ref.mjs';
import { roofTo } from './v3kit.mjs';
import { loadTables } from './f3-t3-ref.mjs';

const R = collector('F6-T1 view');
const noShots = process.argv.includes('--no-shots'), shots = join(ROOT, 'tests/qa/shots/F6-T1'), FORCE = process.argv.includes('--force');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const { PC } = H.loadPC3();
const HAS = !!((PC.C.VIEW3D && PC.C.VIEW3D.tiers) || PC.texgen);
if (!HAS && !FORCE) { R.note('skipped: PC.C.VIEW3D.tiers / PC.texgen absent (F6-T1 not merged)'); process.exit(R.done() ? 0 : 1); }
if (!noShots) mkdirSync(shots, { recursive: true });
const session = sessions({ R, shots, noShots });
const t0 = Date.now(), TIMES = [];
const cut = (a, n = 8) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);
// TL ruling (F6-T1c default run 426 s): B (maximum-house budgets) and the maximum-house part of D run in the release step
// only (QA_RELEASE=1; f6-t1-leak.mjs --rows-only runs this file with --release-only, which runs just those). The sample
// budgets (S) and the sample deck cases stay in the default run.
const REL = !!process.env.QA_RELEASE, RELONLY = process.argv.includes('--release-only');
async function guard(label, fn) { if (ONLY.length && !ONLY.includes(label[0])) return; if (RELONLY ? !'BD'.includes(label[0]) : !REL && label[0] === 'B') return; const t = Date.now(); try { await fn(); } catch (e) { R.check(`${label}: ran to the end`, [String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')]); } TIMES.push(`${label} ${((Date.now() - t) / 1000).toFixed(1)} s`); }

const READY = () => { const i = PC.debug.scene(), q = (h) => document.querySelector(`[data-pc="${h}"]`); return (i.active && !i.lost && !i.building && i.builds > 0 && q('v3-building').hidden && !i.frame && !i.dirty) || !q('v3-unavailable').hidden; };
async function ready(S, ms = 12000) { const ok = await S.until(() => S.page.evaluate(READY), ms); await S.settle(); return ok; }
async function to5(S, mut = '') {
  await S.page.evaluate((m) => { const st = PC.sample.state(); new Function('s', m)(st); st.plans = {}; st.stage = 1; PC.store.replace(st); PC.store.go(2); PC.store.go(3);
    PC.store.commit((s) => { for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; }, { nav: true }); PC.store.go(4); PC.store.go(5); }, mut);
  return ready(S, 20000);
}
const setPose = async (S, which) => { await S.page.evaluate((which) => { const i = PC.debug.scene(), L = PC.view3d.limits(), p = PC.view3d.pose();
  const q = which === 'low' ? { target: p.target.slice(), theta: p.theta, phi: L.phiMax, radius: L.rMax } : PC.cam.reset(i.house, i.size[0] / i.size[1]);
  PC.view3d.animate({ step: () => ({ pose: PC.cam.clamp(q, L), done: true }) }); }, which); return ready(S); };
// canvas pixels: a screenshot decoded in the page; __px[name] = RGBA array, __pw / __ph its size
let PXN = 0;
const shotPx = async (S) => { const buf = await S.page.locator('[data-pc="v3-canvas"]').screenshot(), name = 'p' + PXN++;
  await S.page.evaluate(([b64, n]) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); (window.__px = window.__px || {})[n] = { d: x.getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height }; res(); }; im.src = 'data:image/png;base64,' + b64; }), [buf.toString('base64'), name]);
  return name; };
const pxAt = (S, n, pts) => S.page.evaluate(([n, pts]) => { const P = window.__px[n]; return pts.map(([x, y]) => { const i = (Math.round(y) * P.w + Math.round(x)) * 4; return [P.d[i], P.d[i + 1], P.d[i + 2]]; }); }, [n, pts]);
const look = (S, hour, season) => S.page.evaluate(([h, s]) => PC.view3d.setLook({ hour: h, season: s }), [hour, season]).then(() => ready(S));

// ================= B. budgets =================
await guard('B budgets', async () => {
  const browser = await launch();
  try {
    const S = await session(browser, { tag: '1280x800', w: 1280, h: 800, touch: false }, { three: 'real' }), T = 'B 1280x800 real maximum house', f = []; const rows = [];
    if (!(await to5(S, MAXMUT))) f.push('not ready');
    await setPose(S, 'reset');
    for (const on of [true, false]) {
      await roofTo(S, on); await ready(S);
      const b = await S.page.evaluate(() => { const i = PC.debug.scene(), r = i.renderer; let meshes = 0; const tr = [], tex = new Map();
        i.scene.traverse((o) => { if (o.isMesh) { let vis = true; for (let n = o; n; n = n.parent) if (!n.visible) vis = false; meshes++; for (const m of [].concat(o.material || [])) { if (m.transparent && vis) tr.push(o.name || '(unnamed)'); for (const k of ['map', 'alphaMap', 'bumpMap', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'lightMap', 'specularMap']) if (m[k] && m[k].isTexture) tex.set(m[k].uuid, m[k]); } } });
        let bytes = 0; for (const t of tex.values()) { const im = t.image || {}, w = im.width || 0, h = im.height || 0; bytes += w * h * 4 * (t.generateMipmaps && t.minFilter !== THREE.NearestFilter && t.minFilter !== THREE.LinearFilter ? 4 / 3 : 1); }
        const ar = r.info.autoReset; r.info.autoReset = false; r.info.reset(); r.shadowMap.needsUpdate = true; i.renderNow(); const calls = r.info.render.calls, tris = r.info.render.triangles; r.info.autoReset = ar;
        return { meshes, calls, tris, transparent: tr, texN: r.info.memory.textures, sceneTex: tex.size, mb: bytes / 1048576, tier: (PC.view3d.info() || {}).tier || null }; });
      rows.push(`Roof ${on ? 'on' : 'off'}: ${b.meshes} meshes, ${b.calls} calls, ${b.tris} triangles, ${b.texN} GPU textures (${b.sceneTex} scene, ${b.mb.toFixed(1)} MB), transparent [${b.transparent}]`);
      const tag = `Roof ${on ? 'on' : 'off'}`, B = V.BUDGET;
      if (b.meshes > B.meshes) f.push(`${tag}: ${b.meshes} meshes (<= ${B.meshes})`);
      if (b.calls > B.calls) f.push(`${tag}: ${b.calls} draw calls incl. shadow (<= ${B.calls})`);
      if (b.tris > B.tris) f.push(`${tag}: ${b.tris} triangles (<= ${B.tris})`);
      if (b.transparent.length > B.transparent || b.transparent.some((n) => !B.transparentNames.includes(n))) f.push(`${tag}: transparent meshes [${b.transparent}] (<= 2, only ${B.transparentNames})`);
      if (b.texN > B.textures || b.mb > B.texMB) f.push(`${tag}: ${b.texN} textures, ${b.mb.toFixed(1)} MB (<= ${B.textures} / ${B.texMB} MB)`);
      if (on) await S.shot('B-max-house-roof-on');
    }
    R.check(`${T}, Reset pose: meshes <= 64, draw calls incl. the shadow pass <= 160, triangles <= 300 000, transparent <= 2 (poolWater / blobs only), textures <= 12 / 16 MB, Roof on and off`, f);
    R.note(`${T}: ${rows.join('; ')}`);
    await S.end(T);
  } finally { await browser.close(); }
});

// ================= S, K, H: one page on the sample =================
await guard('S K H sample', async () => {
  const browser = await launch();
  try {
    const S = await session(browser, { tag: '1280x800', w: 1280, h: 800, touch: false }, { three: 'real' }), T = '1280x800 real sample';
    await to5(S); await roofTo(S, true); await setPose(S, 'low');
    const env = await S.page.evaluate(() => { const i = PC.debug.scene(); return { tier: ((PC.view3d.info() || {}).tier || {}).name || (PC.view3d.info() || {}).tier || null, fog: !!i.scene.fog }; });
    // geometry of the low pose: the horizon row and the elevation of chosen pixels
    const GEO = (pts) => { const i = PC.debug.scene(), cam = i.camera, cv = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect(); cam.updateMatrixWorld();
      const e = cam.position.clone(), f = new THREE.Vector3(); cam.getWorldDirection(f); f.y = 0; f.normalize(); const far = e.clone().add(f.multiplyScalar(1e4));
      const h = far.clone().project(cam), yH = (1 - h.y) / 2 * cv.height;
      const el = pts.map(([x, y]) => { const v = new THREE.Vector3(x / cv.width * 2 - 1, 1 - y / cv.height * 2, 0.5).unproject(cam).sub(e).normalize(); return Math.asin(v.y) * 180 / Math.PI; });
      return { yH, w: cv.width, h: cv.height, el }; };
    if (!ONLY.length || ONLY.includes('S') || ONLY.includes('K')) {
      const fS = [], fK = [], seams = [];
      for (const hour of V.SEAM_HOURS) {
        await look(S, hour, 'summer'); const g = await S.page.evaluate(GEO, []), n = await shotPx(S);
        const xs = [Math.round(g.w * 0.03), Math.round(g.w * 0.97)];
        const pts = xs.flatMap((x) => [[x, g.yH - 3], [x, g.yH + 3]]), px = await pxAt(S, n, pts);
        for (let k = 0; k < xs.length; k++) { const d = V.maxDiff(px[2 * k], px[2 * k + 1]); seams.push(`${hour} h x ${xs[k]}: ${d}`); if (env.fog && d > V.SEAM) fS.push(`${hour} h, x ${xs[k]}: above ${px[2 * k]} vs below ${px[2 * k + 1]} differ by ${d} (<= ${V.SEAM})`); }
        // dome colour: pixels at the left edge from the horizon up to the top (no geometry there at this pose)
        const L = await S.page.evaluate(([h]) => PC.sky.compute(h, 'summer', PC.debug.scene().house.northDeg || 0, PC.data.sky), [hour]);
        if (!L.skyHorizon) { fK.push(`${hour} h: compute() has no skyHorizon / skyMid / skyZenith`); continue; }
        const ys = [g.yH - 12, g.yH * 0.6, g.yH * 0.3, 4].filter((y) => y >= 2), sp = ys.map((y) => [xs[0], y]), g2 = await S.page.evaluate(GEO, sp), px2 = await pxAt(S, n, sp);
        sp.forEach((p, k) => { const want = V.domeRGB(g2.el[k], L), d = V.maxDiff(px2[k], want); if (d > V.SKY_TOL) fK.push(`${hour} h, elevation ${g2.el[k].toFixed(1)}°: ${px2[k]} vs my dome ${want} (${d} > ${V.SKY_TOL})`); });
        const bg = await S.page.evaluate(() => { const s = PC.debug.scene().scene; return { bg: s.background && s.background.getHexString ? '#' + s.background.getHexString().toUpperCase() : null, fog: s.fog ? '#' + s.fog.color.getHexString().toUpperCase() : null }; });
        if (bg.bg !== String(L.skyHorizon).toUpperCase() || (env.fog && bg.fog !== String(L.skyHorizon).toUpperCase())) fK.push(`${hour} h: background ${bg.bg}, fog ${bg.fog}, horizon ${L.skyHorizon} (raw, equal)`);
        if (hour === 17.5) await S.shot('S-low-pose-evening');
      }
      if (!ONLY.length || ONLY.includes('S')) { if (!env.fog) R.note(`S tier ${JSON.stringify(env.tier)} has no fog: no seam assertion (plan review Q-T6)`); R.check(`S ${T}, low pose, summer ${V.SEAM_HOURS.join(' / ')} h: the horizon seam <= ${V.SEAM} per channel at both edges (${seams.join(', ')})`, fS); }
      if (!ONLY.length || ONLY.includes('K')) R.check(`K ${T}, low pose: sky pixels at 4 elevations per hour read QA's dome colour (skyHorizon / skyMid / skyZenith, linear lerp by elevation) +- ${V.SKY_TOL}; background and fog = the raw horizon hex`, cut(fK));
    }
    if (!ONLY.length || ONLY.includes('H')) {
      const f = []; await setPose(S, 'reset'); await look(S, 22, 'winter'); await roofTo(S, false);
      const id = await S.page.evaluate(() => { const h = PC.debug.scene().house, r = h.levels.find((l) => l.id === 'G').rooms.slice().sort((a, b) => b.w * b.d - a.w * a.d)[0]; return r.id; });
      if (await S.shown('v3-tab-tour')) await S.act('v3-tab-tour');
      await S.page.selectOption('[data-pc="v3-room"]', id); await S.until(() => S.page.evaluate(() => !(PC.view3d.flying && PC.view3d.flying())), 8000); await ready(S);
      const a = await shotPx(S); await S.page.evaluate(() => { PC.debug.scene().world.getObjectByName('highlight').visible = false; PC.view3d.invalidate(); }); await ready(S); const b = await shotPx(S);
      await S.page.evaluate(() => { PC.debug.scene().world.getObjectByName('highlight').visible = true; PC.view3d.invalidate(); }); await ready(S);
      const m = await S.page.evaluate(([a, b]) => { const A = window.__px[a].d, B = window.__px[b].d, c = []; for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 30) c.push([A[k], A[k + 1], A[k + 2]]);
        const med = (i) => { const v = c.map((p) => p[i]).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; }; return { n: c.length, med: c.length ? [0, 1, 2].map(med) : null }; }, [a, b]);
      const want = V.hex2rgb(V.HIGHLIGHT), d = m.med ? V.maxDiff(m.med, want) : 99;
      if (m.n < 200 || d > V.HL_TOL) f.push(`22 h winter: ${m.n} highlight pixels, median ${m.med} vs ${want} (${d} > ${V.HL_TOL})`);
      R.check(`H ${T}: the highlight of a picked ground-floor room at 22 h winter reads ${V.HIGHLIGHT} +- ${V.HL_TOL} (median of ${m.n} highlight pixels ${m.med})`, f);
      await S.shot('H-highlight-night');
    }
    await S.end(T);
  } finally { await browser.close(); }
});

// ================= D. F6-T1c roofDeck on real r128 (plan §2; marker PC.C.ROOF.copingT) =================
// flat sample: one roofDeck in the roof group, MeshLambertMaterial, no vertex colours, colour = exteriors.roof, its own map
// (membrane, a 5th scene texture); usable terrace: the map is the paving mesh's texture object (no second upload), 4 scene
// textures; pitched: no deck. Receives, does not cast. Sample 21 meshes, maximum house 27.
const T1C = !!(PC.C.ROOF && PC.C.ROOF.copingT !== undefined);
if (T1C) await guard('D deck', async () => {
  const browser = await launch();
  try {
    const S = await session(browser, { tag: '1280x800', w: 1280, h: 800, touch: false }, { three: 'real' }), T = 'D 1280x800 real roofDeck', f = [];
    const T3 = loadTables();
    const probe = () => S.page.evaluate(() => { const i = PC.debug.scene(), tex = new Set(); let meshes = 0, deck = [], pavMap = null;
      i.scene.traverse((o) => { if (!o.isMesh) return; meshes++; for (const m of [].concat(o.material || [])) for (const k of ['map', 'alphaMap', 'bumpMap', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'lightMap']) if (m[k]) tex.add(m[k]);
        if (o.name === 'paving') pavMap = o.material.map || null;
        if (o.name === 'roofDeck') deck.push({ parent: o.parent && o.parent.name, type: o.material.type, vc: !!o.material.vertexColors, col: o.material.color.toArray(), hasMap: !!o.material.map, samePaving: false, cast: o.castShadow, recv: o.receiveShadow, map: o.material.map }); });
      deck = deck.map((d) => ({ ...d, samePaving: !!pavMap && d.map === pavMap, map: undefined }));
      return { meshes, sceneTex: tex.size, deck, roof: i.house && i.house.roof && i.house.roof.type, ext: i.house && i.house.exterior }; });
    const near3 = (a, b) => a && b && a.every((x, k) => Math.abs(x - b[k]) < 2e-4);
    for (const [name, mut, deckWant, mapWant, texWant, meshWant] of [
      ['flat sample', "s.ans.roofType = 'flat'; s.ans.usableRoof = false;", 1, 'own', 5, 21],
      ['usable terrace sample', "s.ans.roofType = 'terrace'; s.ans.usableRoof = true;", 1, 'paving', 4, null],
      ['pitched sample', "s.ans.roofType = 'pitched'; s.ans.usableRoof = false;", 0, null, null, null],
      ['maximum house', MAXMUT, 1, 'paving', null, 27]].filter(([n]) => (RELONLY ? n === 'maximum house' : REL || n !== 'maximum house'))) {
      if (!(await to5(S, mut))) { f.push(`${name}: not ready`); continue; }
      const r = await probe(), st = await S.page.evaluate(() => PC.store.get().ans.exterior), E = T3.exteriors[st || 'sand'];
      if (r.deck.length !== deckWant) { f.push(`${name}: ${r.deck.length} roofDeck meshes (${deckWant})`); continue; }
      if (meshWant !== null && r.meshes !== meshWant) f.push(`${name}: ${r.meshes} meshes (${meshWant})`);
      if (texWant !== null && r.sceneTex !== texWant) f.push(`${name}: ${r.sceneTex} scene textures (${texWant})`);
      for (const d of r.deck) {
        if (d.parent !== 'roof' || d.type !== 'MeshLambertMaterial' || d.vc || !near3(d.col, H.lin(E.roof))) f.push(`${name}: roofDeck ${JSON.stringify({ parent: d.parent, type: d.type, vc: d.vc, col: d.col.map((x) => +x.toFixed(4)) })} (roof group, Lambert, no vertex colours, exteriors.roof ${E.roof})`);
        if (d.cast || !d.recv) f.push(`${name}: roofDeck cast ${d.cast} / receive ${d.recv}`);
        if (!d.hasMap || (mapWant === 'paving') !== d.samePaving) f.push(`${name}: roofDeck map ${d.hasMap ? (d.samePaving ? 'the paving texture object' : 'its own texture') : 'none'} (${mapWant === 'paving' ? 'the paving texture object' : 'its own membrane texture'})`);
      }
    }
    R.check(`${T}${RELONLY ? ' (release step: maximum house)' : ''}: flat sample one roofDeck (Lambert, exteriors.roof, own membrane map, 5 scene textures, 21 meshes), usable terrace on the paving texture object (4 textures), pitched none, maximum house 27 meshes; receives, does not cast`, f);
    await S.end(T);
  } finally { await browser.close(); }
});

if (!REL) R.note('B (maximum-house budgets) and the maximum house of D run in the release step only (QA_RELEASE=1, f6-t1-leak.mjs --rows-only; TL ruling F6-T1c)');
R.note(`timings: ${TIMES.join(', ')}; run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
