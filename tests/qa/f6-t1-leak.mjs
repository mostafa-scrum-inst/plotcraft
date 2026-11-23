// F6-T1 QA: the CTO's random-operation leak probe as a suite (cto-constraints.md rule 5.1; F4 review probe).
// Real r128 (default stream 960x600, release-step maximum-house stream 1280x800). A seeded stream of operations through the page's own controls and APIs:
//   level radio, Roof switch, Light presets / season, finder pick, Reset, tour start / seek / stop, rebuilds (exterior and
//   ceiling commits: a new house key), stage 5 -> 4 -> 5, WEBGL_lose_context lose / restore, window resize.
// After every operation, once the view is ready:
//   - meshes <= the budget (64 with F6-T1, 40 before: the F4 probe line), +1 for the highlight;
//   - exactly one shadow-casting light; pixel ratio <= 2; the context not left lost;
//   - no frame requested while idle (renders unchanged over two animation frames);
//   - GPU memory: renderer.info.memory.geometries <= the geometries the scene references, textures <= the scene's textures
//     + one shadow map per shadow light (a removed but undisposed object shows as an excess at once);
//   - per house key, the scene's own geometry / texture count is the same on every visit (no growth across rebuilds);
//   - no page error, console error or THREE warning (S.end).
// Default: 50 operations on the sample house (TL Q-T8 / plan §9.5). QA_RELEASE=1 or --max-only: only the 200-op maximum-house stream (release step, <= 300 s; TL ruling F6-T1a gate).
// Run: node tests/qa/f6-t1-leak.mjs [--no-shots] [--seed=N] [--ops=N] [--force]
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, collector, launch } from './lib.mjs';
import { sessions } from './session.mjs';
import * as V from './f6-t1-ref.mjs';
import { MAXMUT } from './f5-t3-ref.mjs';

const R = collector('F6-T1 leak');
// Version-aware: runs with F6-T1 (PC.C.VIEW3D.tiers / PC.texgen); --force runs it on an older build (dry run: it passes on F5).
import * as H from './f4-t1-ref.mjs';
{ const { PC } = H.loadPC3(); if (!((PC.C.VIEW3D && PC.C.VIEW3D.tiers) || PC.texgen) && !process.argv.includes('--force')) { R.note('skipped: PC.C.VIEW3D.tiers / PC.texgen absent (F6-T1 not merged); --force for a dry run'); process.exit(R.done() ? 0 : 1); } }
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? Number(a.slice(k.length + 3)) : d; };
const SEED = arg('seed', 20261122), OPS = arg('ops', 50);
// TL ruling (F6-T1a gate, QA_FULL 545.6 s): the 200-op maximum-house stream (175 s) leaves QA_FULL=1 and is its own release
// step, in its own process: QA_RELEASE=1 or --max-only runs only that stream (limit 300 s, NOTE above 260 s, per process when run-all splits the stream and the rows); every other run only the sample.
const MAXONLY = !!process.env.QA_RELEASE || process.argv.includes('--max-only') || process.argv.includes('--leak-max'), MAX_S = 300, NOTE_S = 260;   // TL (3db2b02 accepted): the release step <= 300 s; TL ruling before the F6-T1c gate: the stream and the release rows run as two parallel processes, NOTE above 260 s on the longer of the two (two in a row go to the TL)
const STREAM_ONLY = process.argv.includes('--stream-only'), ROWS_ONLY = process.argv.includes('--rows-only');
// TL F6-T2 gate ruling (CTO §6.2 a-e): a third release process, --max-only --rows3-only: the 50-op sample stream (moved
// out of the default run: a duplicate of the 200-op maximum-house stream) and then ROWS3 (the former stream rows plus the
// dollhouse-heavy duplicate rows QA moved). No timing-sensitive check runs in it. The stream side is the 200-op stream alone.
const ROWS3_ONLY = process.argv.includes('--rows3-only');
const session = sessions({ R, shots: join(ROOT, 'tests/qa/shots/F6-T1'), noShots: true });
const t0 = Date.now(), TIMES = [];
const cut = (a, n = 8) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);

const READY = () => { const i = PC.debug.scene(), q = (h) => document.querySelector(`[data-pc="${h}"]`); return PC.store.get().stage === 5 && ((i.active && !i.lost && !i.building && i.builds > 0 && q('v3-building').hidden && !i.frame && !i.dirty) || !q('v3-unavailable').hidden); };
const to5 = (S, mut) => S.page.evaluate((m) => { const st = PC.sample.state(); new Function('s', m)(st); st.plans = {}; st.stage = 1; PC.store.replace(st); PC.store.go(2); PC.store.go(3);
  PC.store.commit((s) => { for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; }, { nav: true }); PC.store.go(4); PC.store.go(5); }, mut);
// invariants read in the page
const PROBE = () => {
  const i = PC.debug.scene(), r = i.renderer, geo = new Set(), tex = new Set(); let meshes = 0, shadowLights = 0, hl = false, transparent = [];
  i.scene.traverse((o) => {
    if (o.isMesh || o.isInstancedMesh) { meshes++; if (o.name === 'highlight') hl = true; }
    if (o.geometry) geo.add(o.geometry.uuid);
    if (o.isLight && o.castShadow) shadowLights++;
    for (const m of [].concat(o.material || [])) { if (m.transparent && o.isMesh && !(/^glow-/.test(o.name) && m.blending === THREE.AdditiveBlending && !m.depthWrite)) transparent.push(o.name);   // F6-T2 N4: glow-* is additive, no depth write (plan transparent rule)
 for (const k of ['map', 'alphaMap', 'bumpMap', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'lightMap', 'specularMap', 'envMap']) if (m[k] && m[k].isTexture) tex.add(m[k].uuid); }
  });
  if (i.scene.background && i.scene.background.isTexture) tex.add(i.scene.background.uuid);
  return { meshes, hl, shadowLights, transparent, sceneGeo: geo.size, sceneTex: tex.size, memGeo: r.info.memory.geometries, memTex: r.info.memory.textures, pr: r.getPixelRatio(), lost: !!i.lost,
    key: i.house ? i.house.key : null, renders: i.renders, frame: !!i.frame, f6: !!(PC.C.VIEW3D && PC.C.VIEW3D.tiers) };
};
// one operation in the page (all but resize): returns its name
const OP = ([k, x, y]) => {
  const q = (h) => document.querySelector(`[data-pc="${h}"]`), pickOf = (arr) => arr[Math.floor(x * arr.length) % arr.length];
  const T = PC.three.tour, running = T && T.running && T.running();
  switch (k) {
    case 'level': { const ins = [...q('v3-level').querySelectorAll('input')].filter((e) => !e.disabled); const e = pickOf(ins); if (e) e.click(); return `level ${e && e.value}`; }
    case 'roof': q('v3-roof').click(); return 'roof';
    case 'preset': { const p = pickOf(['morning', 'noon', 'evening', 'night']); q('v3-preset-' + p).click(); return `preset ${p}`; }
    case 'season': { const s = q('v3-season'); if (!s) return 'season (none)'; const o = pickOf([...s.options]); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return `season ${o.value}`; }
    case 'pick': { const s = q('v3-room'), o = [...s.querySelectorAll('option')].filter((e) => e.value); const e = pickOf(o); if (!e || s.disabled) return 'pick (none)'; s.value = e.value; s.dispatchEvent(new Event('change', { bubbles: true })); return `pick ${e.value}`; }
    case 'reset': q('v3-reset').click(); return 'reset';
    case 'tour': { if (!T) return 'tour (none)'; if (!running) { q('v3-tour-start').click(); if (T.running()) T.pause(); return 'tour start (paused)'; } if (y < 0.5) { const st = T.state(); T.pause(); PC.debug.tourSeek(st.duration * x); T.resume(); requestAnimationFrame(() => T.pause()); return 'tour seek (paused)'; } T.stop(); return 'tour stop'; }
    case 'rebuild': { const ex = pickOf(['sand', 'white', 'terracotta', 'grey']), ch = [2.8, 3, 3.2][Math.floor(y * 3) % 3]; PC.store.commit((s) => { s.ans.exterior = ex; s.ans.ceilingH = ch; }); return `rebuild ${ex} ${ch}`; }
    case 'reopen': PC.store.go(4); PC.store.go(5); return 'stage 4 -> 5';
    case 'lose': { const g = PC.debug.scene().renderer.getContext(), e = g.getExtension('WEBGL_lose_context'); window.__lc = e; e.loseContext(); setTimeout(() => e.restoreContext(), 30 + 100 * y); return 'context lose / restore'; }
  }
  return k;
};
const WEIGHTS = [['level', 3], ['roof', 2], ['preset', 2], ['season', 1], ['pick', 3], ['reset', 1], ['tour', 2], ['rebuild', 2], ['reopen', 1], ['lose', 1], ['resize', 1]];
const kindOf = (u) => { const tot = WEIGHTS.reduce((s, w) => s + w[1], 0); let a = u * tot; for (const [k, w] of WEIGHTS) { if (a < w) return k; a -= w; } return 'level'; };

// TL Q-T8: the default 50-op stream runs at 960x600 (less fill per frame); the release-step maximum-house stream at 1280x800
const VP_DEF = { tag: '960x600', w: 960, h: 600, touch: false }, VP_FULL = { tag: '1280x800', w: 1280, h: 800, touch: false };
async function probeRun(browser, label, mut, n, seed, vp = VP_FULL) {
  const S = await session(browser, vp, { three: 'real' }), f = [], rnd = V.rng(seed), seen = {}, kinds = {};
  await to5(S, mut); if (!(await S.until(() => S.page.evaluate(READY), 15000))) f.push('not ready after the first open');
  let builds0 = await S.page.evaluate(() => PC.debug.scene().builds), maxGeo = 0, maxTex = 0, worst = 0;
  for (let k = 0; k < n && f.length < 12; k++) {
    const kind = kindOf(rnd()), x = rnd(), y = rnd(); let name = kind, t = Date.now();
    if (kind === 'resize') { const W = Math.round(vp.w * (0.75 + x * 0.3)), H = Math.round(vp.h * (0.8 + y * 0.25)); await S.page.setViewportSize({ width: W, height: H }); name = `resize ${W}x${H}`; await S.settle(); await S.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))); }
    else name = await S.page.evaluate(OP, [kind, x, y]);
    kinds[kind] = (kinds[kind] || 0) + 1;
    if (!(await S.until(() => S.page.evaluate(READY), 12000))) { f.push(`op ${k} ${name}: not ready after 12 s`); continue; }
    const p = await S.page.evaluate(PROBE); await S.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const p2 = await S.page.evaluate(PROBE); worst = Math.max(worst, Date.now() - t);
    const B = (p.f6 ? V.BUDGET.meshes : V.BUDGET_F4.meshes) + (p.hl ? 1 : 0), tag = `op ${k} ${name}`;
    if (p.meshes > B) f.push(`${tag}: ${p.meshes} meshes (<= ${B})`);
    if (p.shadowLights !== 1) f.push(`${tag}: ${p.shadowLights} shadow-casting lights`);
    if (p.pr > 2 + 1e-9) f.push(`${tag}: pixel ratio ${p.pr}`);
    if (p.lost) f.push(`${tag}: context left lost`);
    if (p2.renders !== p.renders || p2.frame) f.push(`${tag}: ${p2.renders - p.renders} renders while idle`);
    if (p.memGeo > p.sceneGeo) f.push(`${tag}: GPU geometries ${p.memGeo} > ${p.sceneGeo} in the scene (undisposed)`);
    if (p.memTex > p.sceneTex + p.shadowLights) f.push(`${tag}: GPU textures ${p.memTex} > ${p.sceneTex} in the scene + ${p.shadowLights} shadow map`);
    if (p.f6 && (p.transparent.length > V.BUDGET.transparent || p.transparent.some((t) => !V.BUDGET.transparentNames.includes(t)))) f.push(`${tag}: transparent meshes ${p.transparent}`);
    const own = [p.sceneGeo - (p.hl ? 1 : 0), p.sceneTex];
    if (p.key) { if (!seen[p.key]) seen[p.key] = own; else if (seen[p.key][0] !== own[0] || seen[p.key][1] !== own[1]) f.push(`${tag}: house ${String(p.key).slice(0, 12)}… now ${own[0]} geometries / ${own[1]} textures, ${seen[p.key][0]} / ${seen[p.key][1]} on its first visit`); }
    maxGeo = Math.max(maxGeo, p.memGeo); maxTex = Math.max(maxTex, p.memTex);
  }
  const end = await S.page.evaluate(PROBE), builds = (await S.page.evaluate(() => PC.debug.scene().builds)) - builds0, restores = await S.page.evaluate(() => PC.debug.scene().restores);
  R.check(`${label}: ${n} seeded operations (seed ${seed}; ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ')}): ${builds} builds, ${restores} context restores; meshes within budget, one shadow light, pixel ratio <= 2, never left lost, idle between operations, GPU geometries <= the scene's (max ${maxGeo}, end ${end.memGeo}) and textures <= the scene's + shadow map (max ${maxTex}, end ${end.memTex}), per-house counts constant over ${Object.keys(seen).length} house keys`, cut(f));
  R.note(`${label}: slowest operation ${worst} ms; end ${end.meshes} meshes, ${end.sceneGeo} scene geometries, ${end.sceneTex} scene textures`);
  await S.end(label);
}

// The release step also carries the rows the TL moved out of QA_FULL=1 after the 488 s gate (F6-T1a): each in its own
// process with QA_RELEASE=1, one after the other in a chain that runs beside the stream (TL ruling before the F6-T1c gate: two
// parallel processes; --stream-only / --rows-only run one side). The whole step stays <= 300 s (NOTE above 260 s on the longer side). It runs in every implementation-review gate (with QA_FULL) and at release.
const RELEASE_ROWS = [['f4-t1-view.mjs', '--no-shots', '--release-only'], ['f5-t3-view.mjs', '--no-shots', '--release-only'], ['f4-t2-s0-ui.mjs', '--no-shots', '--only=640x360'],
  // TL default-run trim (docs/03-tasks/F6-T1/qa-default-trim.md rows 1-7): the desktop / landscape twins moved out of the default run
  ['f2-t3-site-rooms.mjs', '--no-shots', '--release-only'], ['f1-t3-plot.mjs', '--no-shots', '--release-only'], ['f1-t1-layout.mjs', '--no-shots', '--release-only'],
  // TL ruling (F6-T1c default run 426 s): the maximum-house parts of the T1c rows
  ['f6-t1-model.mjs', '--release-only'], ['f6-t1-view.mjs', '--no-shots', '--release-only'],
  // TL ruling (F6-T1c, part b): 1280x800 logic passes of f2-t2 and f1-t2
  ['f2-t2-questions.mjs', '--no-shots', '--release-only'], ['f1-t2-flows.mjs', '--no-shots', '--release-only']];
// ROWS3 (TL F6-T1c run-time debt; TL F6-T2 gate ruling: out of the stream process into the third one, --rows3-only, after
// the sample stream); --max-only alone runs the stream, RELEASE_ROWS, the sample stream, then these.
const ROWS3 = [['f3-t2-editor.mjs', '--no-shots', '--release-only'], ['f3-t1-stage3.mjs', '--no-shots', '--release-only'], ['f3-t3-look.mjs', '--no-shots', '--release-only'],
  /* f4-t1-view F G6 rides with its existing --release-only row on the rows side */ ['f4-t2-view.mjs', '--no-shots', '--release-only'], ['f4-t3-view.mjs', '--no-shots', '--release-only'], ['f5-t1-view.mjs', '--no-shots', '--release-only']];
// the rows chain, started before the stream so both run side by side; each child's output is printed whole when it ends
function runRow(f, a) { return new Promise((res) => { const t = Date.now(), out = [], c = spawn('node', [join(ROOT, 'tests/qa', f), ...a], { cwd: ROOT, env: { ...process.env, QA_RELEASE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  c.stdout.on('data', (d) => out.push(d)); c.stderr.on('data', (d) => out.push(d));
  c.on('close', (code) => { process.stdout.write(`--- [release] ${f} ${a.join(' ')} ---\n` + Buffer.concat(out).toString()); res({ f, a, code, s: (Date.now() - t) / 1000 }); }); }); }
// --max-only alone: the stream, then the rows (serial, one process). run-all (TL, F6-T1c) runs the two sides as two parallel
// processes: --max-only --stream-only (the stream, no rows) and --max-only --rows-only (the row spawns, no browser here).
const rowsChain = async (list) => { const r = []; for (const [f, ...a] of list) r.push(await runRow(f, a)); return r; };
const SAMPLE = MAXONLY ? ROWS3_ONLY || (!STREAM_ONLY && !ROWS_ONLY) : process.argv.includes('--sample');   // default run: moved (--sample runs it by hand)
// TL condition on 175d20d: the default run keeps a short real-r128 smoke (about 5 s): 10 fixed operations on the sample with
// one 22 h look (the night preset) and one Roof off / on; GPU geometries / textures never exceed the scene's (nothing
// undisposed), no renders while idle, and back at the starting view (Roof on, All, noon) both counts equal the first ones.
const SMOKE_OPS = [['preset', 0.99, 0], ['roof', 0, 0], ['level', 0.6, 0], ['pick', 0.3, 0], ['reset', 0, 0], ['season', 0.6, 0], ['level', 0, 0], ['roof', 0, 0], ['preset', 0.3, 0], ['reset', 0, 0]];
async function smokeRun(browser) {
  const S = await session(browser, VP_DEF, { three: 'real' }), f = [], names = [];
  await to5(S, ''); if (!(await S.until(() => S.page.evaluate(READY), 15000))) f.push('not ready after the first open');
  const p0 = await S.page.evaluate(PROBE), state = () => S.page.evaluate(() => { const i = PC.debug.scene(); return { roof: !!i.roof, level: i.level, h: PC.store.get().ans.view3d ? PC.store.get().ans.view3d.hour : null }; });
  const s0 = await state();
  for (const op of SMOKE_OPS) {
    const name = await S.page.evaluate(OP, op); names.push(name);
    if (!(await S.until(() => S.page.evaluate(READY), 12000))) { f.push(`${name}: not ready after 12 s`); continue; }
    const p = await S.page.evaluate(PROBE); await S.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); const p2 = await S.page.evaluate(PROBE);
    if (p.lost) f.push(`${name}: context left lost`);
    if (p2.renders !== p.renders || p2.frame) f.push(`${name}: ${p2.renders - p.renders} renders while idle`);
    if (p.memGeo > p.sceneGeo) f.push(`${name}: GPU geometries ${p.memGeo} > ${p.sceneGeo} in the scene (undisposed)`);
    if (p.memTex > p.sceneTex + p.shadowLights) f.push(`${name}: GPU textures ${p.memTex} > ${p.sceneTex} in the scene + ${p.shadowLights} shadow map`);
  }
  const p1 = await S.page.evaluate(PROBE), s1 = await state();
  if (s1.roof !== s0.roof || s1.level !== s0.level) f.push(`end view roof ${s1.roof} level ${s1.level}, start ${s0.roof} / ${s0.level} (smoke script)`);
  else if (p1.sceneGeo !== p0.sceneGeo || p1.sceneTex !== p0.sceneTex || p1.memGeo !== p0.memGeo || p1.memTex !== p0.memTex) f.push(`back at the start view: scene ${p1.sceneGeo} / ${p1.sceneTex}, GPU ${p1.memGeo} / ${p1.memTex}; start ${p0.sceneGeo} / ${p0.sceneTex}, GPU ${p0.memGeo} / ${p0.memTex} (geometries / textures)`);
  if (!names.some((n) => n === 'preset night') || names.filter((n) => n === 'roof').length !== 2) f.push(`script ran ${names.join(', ')} (want preset night and Roof off / on)`);
  R.check(`960x600 real sample smoke (default run, TL condition): ${names.join(', ')}: GPU geometries / textures <= the scene's after each, no idle renders, never lost; back at the start view the counts equal the first (${p0.memGeo} / ${p0.memTex})`, cut(f));
  await S.end('smoke');
}
const browser = (ROWS_ONLY && MAXONLY) || (!MAXONLY && !SAMPLE && process.argv.includes('--no-smoke')) ? null : await launch();
try {
  let t = Date.now();
  if (MAXONLY && !ROWS_ONLY && !ROWS3_ONLY) { t = Date.now(); await probeRun(browser, '1280x800 real maximum house (release step)', MAXMUT, 200, SEED + 1); const s = (Date.now() - t) / 1000; TIMES.push(`maximum house ${s.toFixed(1)} s`);
    R.note(`[leak-max] the 200-operation maximum-house stream ran in ${s.toFixed(1)} s`); }
  else if (!MAXONLY) R.note('the 200-operation maximum-house stream is its own release step: QA_RELEASE=1 or --max-only, run-all --only leak-max (TL ruling, F6-T1a gate)');
  t = Date.now();
  if (SAMPLE) { await probeRun(browser, '960x600 real sample', '', OPS, SEED, VP_DEF); TIMES.push(`sample ${((Date.now() - t) / 1000).toFixed(1)} s`); }
  if (!MAXONLY && !process.argv.includes('--no-smoke')) { t = Date.now(); await smokeRun(browser); TIMES.push(`smoke ${((Date.now() - t) / 1000).toFixed(1)} s`); }
  else if (!MAXONLY) R.note('the 50-op sample stream runs in the third release process (f6-t1-leak.mjs --max-only --rows3-only; TL F6-T2 gate ruling, CTO §6.2): a duplicate of the 200-op maximum-house stream');
} finally { if (browser) await browser.close(); }
if (MAXONLY) {
  const streamS = ROWS_ONLY ? 0 : (Date.now() - t0) / 1000, rowsT0 = Date.now(), rows = [...(STREAM_ONLY || ROWS3_ONLY ? [] : await rowsChain(RELEASE_ROWS)), ...(ROWS_ONLY || STREAM_ONLY ? [] : await rowsChain(ROWS3))], rowsS = (Date.now() - rowsT0) / 1000;
  for (const { f, a, code, s: rs } of rows) { TIMES.push(`${f} ${rs.toFixed(1)} s`); R.check(`[release] ${f} ${a.join(' ')} (QA_RELEASE=1): its checks pass (${rs.toFixed(1)} s)`, code === 0 ? [] : [`exit ${code}`]); }
  const all = (Date.now() - t0) / 1000, side = STREAM_ONLY ? '[leak-max] stream' : ROWS_ONLY ? '[release] rows' : ROWS3_ONLY ? '[release] rows3' : '[leak-max] release step (stream + rows, serial)';
  R.note(`${side}: ${all.toFixed(1)} s (${ROWS3_ONLY ? 'sample stream' : 'stream'} ${ROWS_ONLY ? '-' : streamS.toFixed(1) + ' s'}, rows ${STREAM_ONLY ? '-' : rowsS.toFixed(1) + ' s'})`);
  if (all > NOTE_S) R.note(`NOTE ${side} took ${all.toFixed(1)} s > ${NOTE_S} s (TL: two NOTE runs in a row go to the TL)`);
  R.check(`${side}${ROWS_ONLY ? ` (${RELEASE_ROWS.length} release rows)` : STREAM_ONLY ? ' (200-op maximum-house stream)' : ROWS3_ONLY ? ` (50-op sample stream + ${ROWS3.length} rows)` : ` (200-op maximum-house stream + 50-op sample stream + ${RELEASE_ROWS.length + ROWS3.length} release rows)`} runs in ${all.toFixed(1)} s <= ${MAX_S} s (TL limit)`, all <= MAX_S ? [] : [`${all.toFixed(1)} s`]);
}
R.note(`timings: ${TIMES.join(', ')}; run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
