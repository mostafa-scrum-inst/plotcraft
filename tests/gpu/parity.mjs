// QA_GPU (G1 items a and g): the /gpu page (three.js 0.180 WebGPU) against the standard page (vendored r128) in one
// headed Chrome on a private Xvfb display (tests/helpers/gpu.mjs says why), both at tier full, 640x480, dpr 1.
// (a) parity: the sample and the house fixtures give the same meshes on both pages: names, kinds, vertex and index
//     counts, instance counts, visibility.
// (g) image: per Light preset (morning, noon, evening, night) the mean sRGB colour of five regions (sky, outer
//     ground, the two exterior walls that face the camera (one sunlit, one not, depending on the hour: they catch a
//     wrong sun direction or shadow), the north needle seen from above) on /gpu (render-target readback through
//     PC.view3d.capture, converted to sRGB in JS) against the standard page (WebGL readPixels), per channel.
//     Tolerances (measured in G1, then a margin; see docs/03-tasks/G1/outcome.md):
//       unlit (sky dome, north needle: no light, no tone mapping): 3 per channel, the A-10 / F6-T1 colour-rule bar;
//       lit (ground, walls): 6 per channel: r128 lights Lambert per vertex (Gouraud) and r180 per fragment, and the two
//       PCF soft-shadow filters and texture filtering differ; a colour-space, light-unit (x PI), exposure or
//       tone-mapping mistake moves these regions by 20 or more per channel (G1 measurements), so 6 still catches them.
import { loadCore } from '../helpers/load.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';
import { suite } from '../helpers/browser.mjs';
import { serve, xvfb, launchGpu, openPage, toStage5, ready3d } from '../helpers/gpu.mjs';

const T = suite('gpu parity'), t0 = Date.now();
const PC = loadCore();
const FIXTURES = [
  ['sample', sampleApproved(PC)],
  ['sample pitched roof', sampleApproved(PC, (s) => { s.ans.roofType = 'pitched'; })],
  ['maximum house', maxHouse(PC)]
];
const PRESETS = [['morning', 8], ['noon', 12], ['evening', 17.5], ['night', 22]];
const TOL = { sky: 3, needle: 3, ground: 6, wall: 6, side: 6 };
// GPU_MUTATE=<name> (measurement only, never in the gate): plants one adapter mistake on /gpu to show the image check
// catches it: lightK (no x PI), exposure (ignored), col (sRGB converted twice), tone (no output nodes: no per-material
// ACES, r180 fog before it).
const MUTATE = {
  lightK: () => { PC.gfx.lightK = 1; },
  exposure: () => { PC.gfx.exposure = function () {}; },
  col: () => { PC.gfx.col = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); }; },
  tone: () => { PC.gfx.materials = function () {}; }
}[process.env.GPU_MUTATE || ''];

// The scene as plain data: every mesh in world order.
const meshes = (page) => page.evaluate(() => {
  const out = [];
  PC.debug.scene().world.traverse((m) => {
    if (!m.geometry) return;
    const g = m.geometry, inst = m.isInstancedMesh ? m.count : null;
    out.push([m.name, m.isInstancedMesh ? 'instanced' : 'mesh', g.attributes.position.count, g.index ? g.index.count : 0, inst, m.visible]);
  });
  return out;
});

// Region boxes in canvas pixels (top-left origin), projected with the page's own camera (both pages share pose and
// size), then the mean colour of each box from a full-frame sRGB pixel array.
const regions = (page, kind, close) => page.evaluate(async ({ kind, close }) => {
  const i = PC.debug.scene(), W = i.size[0], H = i.size[1], cam = i.camera, h = i.house;
  let px;
  if (kind === 'gpu') {
    const c = await new Promise((r) => PC.view3d.capture(r));
    if (!c) return null;
    px = c.data;
  } else {
    i.renderNow();
    const gl = i.renderer.getContext(), raw = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    px = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) px.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  }
  const at = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  const mean = (cx, cy, r) => {
    const s = [0, 0, 0]; let n = 0;
    for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++) for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = (y * W + x) * 4; s[0] += px[k]; s[1] += px[k + 1]; s[2] += px[k + 2]; n++;
    }
    return s.map((v) => +(v / Math.max(1, n)).toFixed(1));
  };
  const fp = h.footprint, cu = h.center[0], cv = h.center[1], e = cam.position;
  // the exterior wall face that looks most at the camera, its middle at 2 m (ground storey, Roof on)
  const faces = [[fp.u + fp.w / 2, fp.v, 0, 1], [fp.u + fp.w / 2, fp.v + fp.d, 0, -1], [fp.u, fp.v + fp.d / 2, -1, 0], [fp.u + fp.w, fp.v + fp.d / 2, 1, 0]]
    .map(([u, v, nx, nz]) => { const X = u - cu, Z = -(v - cv), n = [nx, -nz], d = [e.x - X, e.z - Z], l = Math.hypot(d[0], d[1]); return { X: X + n[0] * 0.05, Z: Z + n[1] * 0.05, s: (n[0] * d[0] + n[1] * d[1]) / l }; })
    .sort((a, b) => b.s - a.s);
  // the north half of the needle (unlit mats.ui): the centroid of its triangle tipN, east, west (build-site.js); the
  // close-up pose (closeUp below) puts it in the middle of the frame
  const nd = PC.three.needle(h), needle = nd ? at((nd.tipN[0] + nd.east[0] + nd.west[0]) / 3, 0.04, (nd.tipN[1] + nd.east[1] + nd.west[1]) / 3) : null;
  if (close) return { needle: needle ? mean(needle[0], needle[1], 2) : null, needleAt: needle };
  return {
    sky: mean(W / 2, Math.max(4, H * 0.015), 3),
    ground: mean(W * 0.9, H * 0.45, 5),
    wall: mean(...at(faces[0].X, 2, faces[0].Z), 2), side: mean(...at(faces[1].X, 2, faces[1].Z), 2), W, H
  };
}, { kind, close });
// The camera at the closest radius, looking down at the needle's north half (same pose on both pages), or back to the reset view.
const closeUp = (page, on) => page.evaluate((on) => {
  if (!on) { PC.view3d.resetView(); return; }
  const nd = PC.three.needle(PC.view3d.house()), p = PC.view3d.pose();
  const c = [(nd.tipN[0] + nd.east[0] + nd.west[0]) / 3, 0, (nd.tipN[1] + nd.east[1] + nd.west[1]) / 3];
  PC.view3d.flyTo({ target: c, radius: 0.1, theta: p.theta, phi: 0 }, 1);   // clamped to the closest, steepest pose: from above
}, on);

const X = await xvfb(), srv = await serve(), browser = await launchGpu({ display: X.display });
try {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
  const P = { gpu: await openPage(browser, srv.url, { page: 'gpu', ctx }), standard: await openPage(browser, srv.url, { page: 'standard', ctx }) };
  const worst = {};
  for (const [name, state] of FIXTURES) {
    const got = {};
    for (const k of ['standard', 'gpu']) {
      if (MUTATE && k === 'gpu') await P[k].page.waitForFunction(() => PC.boot3d.state === 'ready').then(() => P[k].page.evaluate(MUTATE));
      await toStage5(P[k].page, state);
      T.eq(await ready3d(P[k].page), 'ready', `${name}: ${k} page ready`);
      const info = await P[k].page.evaluate(() => { const i = PC.debug.scene(); return { gfx: i.gfx, tier: i.tier.name, key: i.house.key }; });
      T.eq([info.gfx, info.tier], [k === 'gpu' ? 'webgpu' : 'r128', 'full'], `${name}: ${k} renderer and tier`);
      got[k] = { meshes: await meshes(P[k].page), key: info.key };
      // G1 measure (G-plan 3.1): does compileAsync build the shadow-pass pipelines? (pipelines after it / after the
      // warm-up render; the warm-up stays while the second number is larger)
      if (k === 'gpu') { const st = await P[k].page.evaluate(() => PC.gfx.stats); console.log(`  ${name}: compileAsync ${st.compileMs.toFixed(0)} ms, pipelines ${st.pipelinesCompiled} after it, ${st.pipelinesWarm} after the warm-up render`); }
    }
    T.eq(got.gpu.key, got.standard.key, `${name}: same house key`);
    T.ok(got.gpu.meshes.length >= 20, `${name}: ${got.gpu.meshes.length} meshes`);
    T.eq(got.gpu.meshes, got.standard.meshes, `${name}: same meshes (name, kind, vertices, indices, instances, visible)`);
    if (name !== 'sample') continue;
    // (g) per preset, on the sample
    for (const [preset, hour] of PRESETS) {
      const r = {};
      for (const k of ['standard', 'gpu']) {
        await P[k].page.evaluate((hr) => { PC.view3d.setLook({ hour: hr, season: 'summer' }); }, hour);
        await ready3d(P[k].page);
        r[k] = await regions(P[k].page, k, false);
        await closeUp(P[k].page, true);
        await P[k].page.waitForFunction(() => !PC.view3d.animation() && !PC.debug.scene().frame);
        if (r[k]) Object.assign(r[k], await regions(P[k].page, k, true));
        await closeUp(P[k].page, false);
      }
      T.ok(r.gpu && r.standard && r.gpu.needleAt, `${preset}: both pages read back, needle projected`);
      if (!r.gpu || !r.standard) continue;
      for (const reg of ['sky', 'ground', 'wall', 'side', 'needle']) {
        const a = r.gpu[reg], b = r.standard[reg];
        if (!a || !b) { T.ok(false, `${preset} ${reg}: missing`); continue; }
        const d = Math.max(...a.map((v, c) => Math.abs(v - b[c])));
        worst[reg] = Math.max(worst[reg] || 0, d);
        console.log(`  ${preset.padEnd(8)} ${reg.padEnd(6)} gpu ${a.map((v) => v.toFixed(0)).join(',').padEnd(12)} r128 ${b.map((v) => v.toFixed(0)).join(',').padEnd(12)} max |d| ${d.toFixed(1)}`);
        T.ok(d <= TOL[reg], `${preset} ${reg}: /gpu ${a} vs r128 ${b}, max channel difference ${d.toFixed(1)} <= ${TOL[reg]}`);
      }
    }
  }
  console.log('  worst per region: ' + JSON.stringify(worst));
  for (const k of ['standard', 'gpu']) T.none(P[k].problems(), `${k} page: no errors, THREE warnings or stray requests`);
  await ctx.close();
} finally { await browser.close(); await srv.close(); X.stop(); }
console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(T.done() ? 1 : 0);
