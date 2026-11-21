// F4-T2 QA (browser): the F4-T2 scene in the built page with the vendored real r128 (three: 'real'), touch at 360x640
// and mouse at 1280x800, judged by QA's own expectations (TL impl-review focus list, docs/03-tasks/F4-T2/impl-review.md):
//   A Roof switch per roof type (flat, pitched, terrace; usable flat with the lift): roof group shown only with Roof on
//     and "All" (hidden on Ground / First), the three roofs render differently, the page builds the same roof batch as
//     QA's node build (f4-t2-model.mjs judges its geometry); stage 2: Pitched unavailable while the roof is usable.
//   B Q18 / Q19 through stage 4: one rebuild, furniture boxes kept with new colours (Q18), fewer boxes (Q19 sparse),
//     approvals kept ("2 of 2").
//   C Q17 wall off: the Gate radios disabled with the value kept (enabled again with it), no wall or gate in the scene.
//   D seating on a tight plot: the PM's warning on stage 2 (row, q 17, Fix opens the Outdoor group) and on Floor plans.
//   E budget: the maximum house <= 18 meshes, no console errors, the loop idle after the build, a WebGL context loss and
//     restore rebuilds the same batches and draws again.
//   F Undo across a tab switch never applies to the other floor.
// Run: node tests/qa/f4-t2-view.mjs [--no-shots] [--only=A,B,...]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, collector, launch } from './lib.mjs';
import { sessions } from './session.mjs';
import * as Q from './f2-t1-ref.mjs';
import * as H from './f4-t1-ref.mjs';
import { loadTables } from './f3-t3-ref.mjs';

const R = collector('F4-T2 view');
const noShots = process.argv.includes('--no-shots'), shots = join(ROOT, 'tests/qa/shots/F4-T2');
if (!noShots) mkdirSync(shots, { recursive: true });
const session = sessions({ R, shots, noShots });
const { PC, THREE } = H.loadPC3();
const T3 = loadTables();
const VP = { phone: { tag: '360x640', w: 360, h: 640, touch: true }, desk: { tag: '1280x800', w: 1280, h: 800, touch: false } };
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const t0 = Date.now(), TIMES = [];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SEAT_TEXT = 'Garden seating does not fit in the yard: it is left out of the 3D scene. Try a lower footprint %, fewer cars or a smaller pool.';
const RAF = () => { const raf = window.requestAnimationFrame.bind(window); window.__raf = 0; window.requestAnimationFrame = (cb) => { window.__raf++; return raf(cb); }; };

const READY = () => { const i = PC.debug.scene(), q = (h) => document.querySelector(`[data-pc="${h}"]`); return (i.active && !i.building && i.builds > 0 && q('v3-building').hidden && !i.frame && !i.dirty) || !q('v3-unavailable').hidden; };
async function ready(S) { const ok = await S.until(() => S.page.evaluate(READY), 8000); await S.settle(); return ok; }
async function to5(S, mut = '') {
  await S.page.evaluate((m) => { const st = PC.sample.state(); new Function('s', m)(st); st.plans = {}; st.stage = 1; PC.store.replace(st); PC.store.go(2); PC.store.go(3);
    PC.store.commit((s) => { for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; }, { nav: true }); PC.store.go(4); PC.store.go(5); }, mut);
  return ready(S);
}
const info = (S) => S.page.evaluate(() => { const i = PC.debug.scene(); return { renders: i.renders, builds: i.builds, restores: i.restores, roof: i.roof, level: i.level, raf: window.__raf }; });
// what the page's world holds: groups' visibility, per-name mesh counts and batch item counts / colours
const W = (S) => S.page.evaluate(() => { const w = PC.debug.scene().world, out = { groups: {}, meshes: 0, names: {}, items: {}, furniture: [] };
  w.children.forEach((g) => { out.groups[g.name] = g.visible; });
  w.traverse((o) => { if (!o.isMesh) return; out.meshes++; out.names[o.name] = (out.names[o.name] || 0) + 1; if (o.userData.items) out.items[o.parent.name + '/' + o.name] = o.userData.items.length;
    if (o.name === 'furniture') { const p = o.geometry.attributes.position.array, c = o.geometry.attributes.color.array; out.furniture.push({ level: o.parent.name, n: o.userData.items.length, pos: Array.from(p.slice(0, 72)).map((x) => Math.round(x * 1000) / 1000), col: Array.from(c.slice(0, 72)).map((x) => Math.round(x * 1e5) / 1e5), allPos: p.length }); } });
  return out; });
async function pixels(S) { const buf = await S.page.locator('[data-pc="v3-canvas"]').screenshot(); return buf; }
// a raw tap / click at a control's centre (for disabled controls, where S.act would wait for a click event)
const rawTap = async (S, sel) => { const b = await S.page.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel); if (S.vp.touch) await S.page.touchscreen.tap(...b); else await S.page.mouse.click(...b); await S.settle(); };
const viewTab = async (S) => { if (await S.shown('v3-tab-view')) await S.act('v3-tab-view'); };
const pick = (v) => `css:[data-pc="v3-level"] label:has(input[value="${v}"])`;
async function guard(label, fn) { if (ONLY.length && !ONLY.includes(label[0])) return; const t = Date.now(); try { await fn(); } catch (e) { R.check(`${label}: ran to the end`, [String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')]); } TIMES.push(`${label} ${((Date.now() - t) / 1000).toFixed(1)} s`); }
// QA's node build of the same state (vm r128): the roof batch's item count
function nodeRoofItems(state) { const s = Q.plain(state), h = PC.house.build(s); if (!h) return null; const world = new THREE.Group(); world.name = 'world';
  const mats = { batch: new THREE.MeshLambertMaterial({ vertexColors: true }), ground: new THREE.MeshLambertMaterial(), groundOuter: new THREE.MeshLambertMaterial(), poolWater: new THREE.MeshLambertMaterial() };
  PC.three.buildShell(h, world, mats); const m = PC.three.buildRoof(h, world, mats)[0]; return m ? m.userData.items.length : 0; }

const browser = await launch();
try {
// ================= A. Roof switch per roof type =================
for (const vp of [VP.phone, VP.desk]) await guard(`A roof ${vp.tag}`, async () => {
  const S = await session(browser, vp, { three: 'real' }), T = `A ${vp.tag}`, f = [], imgs = {};
  for (const [name, mut] of [['flat', "s.ans.roofType = 'flat';"], ['pitched', "s.ans.roofType = 'pitched';"], ['terrace', "s.ans.roofType = 'terrace';"], ['usable flat + lift', "s.ans.roofType = 'flat'; s.ans.usableRoof = true; s.ans.lift = true;"]]) {
    await to5(S, mut); await viewTab(S); await S.act(pick('all')); await ready(S);
    let w = await W(S), i = await info(S);
    if (i.roof || w.groups.roof) f.push(`${name}: opens with the roof shown`);
    await S.act('v3-roof'); await ready(S); w = await W(S); i = await info(S);
    if (!i.roof || !w.groups.roof) f.push(`${name}: Roof on with All: roof group ${w.groups.roof}`);
    const st = await S.state(), nItems = nodeRoofItems(st); if (w.items['roof/roofBatch'] !== nItems) f.push(`${name}: page roofBatch ${w.items['roof/roofBatch']} items vs QA's node build ${nItems}`);
    imgs[name] = await pixels(S); await S.shot(`A-roof-${name.replace(/\W+/g, '-')}`);
    for (const lv of ['G', '1']) { await S.act(pick(lv)); await ready(S); const w2 = await W(S); if (w2.groups.roof) f.push(`${name}: roof shown with level ${lv}`); }
    await S.act(pick('all')); await ready(S); if (!(await W(S)).groups.roof) f.push(`${name}: roof not back on All`);
    await S.act('v3-roof'); await ready(S); if ((await W(S)).groups.roof) f.push(`${name}: Roof off still shows it`);
  }
  const names = Object.keys(imgs); for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) if (Buffer.compare(imgs[names[a]], imgs[names[b]]) === 0) f.push(`${names[a]} and ${names[b]} render identically`);
  R.check(`${T}: Roof switch (real r128): off on open, on shows the roof group with All only (hidden on Ground / First, back on All, off again); flat / pitched / terrace / usable render differently; the page's roof batch = QA's node build`, f);
  // stage 2: Pitched unavailable while the roof is usable; usable on with Pitched switches to Flat
  await to5(S, "s.ans.roofType = 'pitched';"); await S.act('step-2'); await S.act('q-tab-building');
  const before = (await S.state()).ans.roofType;
  await S.act('q-usable-roof'); await S.settle();
  const g = await S.page.evaluate(() => { const s = PC.debug.state(), p = document.querySelector('[data-pc="q-roof"] input[value="pitched"]'); return { type: s.ans.roofType, usable: s.ans.usableRoof, dis: p.disabled, note: !document.querySelector('[data-pc="q-roof-note"]').hidden }; });
  await rawTap(S, '[data-pc="q-roof"] label:has(input[value="pitched"])'); const after = (await S.state()).ans.roofType;
  R.check(`${T}: stage 2: with Pitched chosen, turning the usable roof on switches to Flat (note shown) and Pitched stays disabled (a tap changes nothing)`, before === 'pitched' && g.usable && g.type === 'flat' && g.dis && g.note && after === 'flat' ? [] : [JSON.stringify({ before, ...g, after })]);
  await S.end(T);
});

// ================= B. Q18 / Q19 through stage 4 =================
for (const vp of [VP.phone, VP.desk]) await guard(`B interior ${vp.tag}`, async () => {
  const S = await session(browser, vp, { three: 'real' }), T = `B ${vp.tag}`, f = [];
  await to5(S); const w0 = await W(S), b0 = (await info(S)).builds;
  await S.act('btn-back'); await S.settle(); await S.act('css:[data-pc="q-interior-style"] label:has(input[value="classic"])'); await S.act('btn-next'); await ready(S);
  const w1 = await W(S), i1 = await info(S), st = await S.state();
  if (i1.builds !== b0 + 1) f.push(`Q18: builds ${b0} -> ${i1.builds}`);
  if (st.ans.interior.style !== 'classic') f.push('Q18 not classic');
  if (!eq(w1.furniture.map((x) => [x.level, x.n, x.pos, x.allPos]), w0.furniture.map((x) => [x.level, x.n, x.pos, x.allPos]))) f.push('Q18: furniture boxes changed');
  if (eq(w1.furniture.map((x) => x.col), w0.furniture.map((x) => x.col))) f.push('Q18: furniture colours unchanged');
  // QA's expectation of one colour: the first piece of the first furnished level is col(classic[key])
  const approved = Object.values(st.plans).every((p) => p.approved);
  if (!approved) f.push('Q18: an approval was lost');
  await S.act('btn-back'); await S.settle(); await S.act('css:[data-pc="q-interior-density"] label:has(input[value="sparse"])'); await S.act('btn-next'); await ready(S);
  const w2 = await W(S), n = (w) => w.furniture.reduce((a, x) => a + x.n, 0);
  if (!(n(w2) < n(w1))) f.push(`Q19 sparse: ${n(w2)} boxes vs full ${n(w1)}`);
  if (!Object.values((await S.state()).plans).every((p) => p.approved)) f.push('Q19: an approval was lost');
  await S.act('step-3'); await S.settle(); const ctr = await S.text('plan-counter');
  if (!/2 of 2/.test(ctr)) f.push(`counter "${ctr}"`);
  R.check(`${T}: Q18 classic on stage 4 -> one rebuild, furniture boxes equal with new colours; Q19 sparse -> fewer boxes (${n(w1)} -> ${n(w2)}); approvals kept ("2 of 2")`, f);
  await S.end(T);
});

// ================= C. wall off: gate disabled =================
await guard('C gate', async () => {
  const S = await session(browser, VP.phone, { three: 'real' }), T = 'C 360x640', f = [];
  await to5(S, "s.ans.extras.gate = 'right';"); let w = await W(S);
  await S.act('step-2'); await S.act('q-tab-outdoor');
  const g = () => S.page.evaluate(() => [...document.querySelectorAll('[data-pc="q-gate"] input')].map((i) => [i.value, i.disabled, i.checked]));
  const on0 = await g(); await S.act('q-wall'); await S.settle(); const off = await g(), sOff = (await S.state()).ans.extras;
  await rawTap(S, '[data-pc="q-gate"] label:has(input[value="left"])'); const tapped = (await S.state()).ans.extras.gate;
  await S.shot('C-gate-disabled');
  await S.act('step-5'); await ready(S); w = await W(S); const items = await S.page.evaluate(() => { const m = PC.debug.scene().world.getObjectByName('siteBatch'); return m.userData.items.filter((x) => x[0] === 'seg').length; });
  await S.act('step-2'); await S.act('q-tab-outdoor'); await S.act('q-wall'); await S.settle(); const on1 = await g();
  if (on0.some((x) => x[1]) || !on0.find((x) => x[0] === 'right')[2]) f.push(`wall on: ${JSON.stringify(on0)}`);
  if (!off.every((x) => x[1]) || !off.find((x) => x[0] === 'right')[2] || sOff.wall || sOff.gate !== 'right') f.push(`wall off: ${JSON.stringify(off)} ${JSON.stringify(sOff)}`);
  if (tapped !== 'right') f.push(`a tap on the disabled Left changed the gate to ${tapped}`);
  if (items) f.push(`wall off: ${items} wall segments in the scene`);
  if (on1.some((x) => x[1]) || !on1.find((x) => x[0] === 'right')[2]) f.push(`wall on again: ${JSON.stringify(on1)}`);
  R.check(`${T}: Q17 wall off: the three Gate radios disabled, Right kept (a tap on Left does nothing), no wall in the scene; wall on again: enabled with Right`, f);
  await S.end(T);
});

// ================= D. seating warning on a tight plot =================
for (const vp of [VP.phone, VP.desk]) await guard(`D seating ${vp.tag}`, async () => {
  const S = await session(browser, vp, { three: 'real' }), T = `D ${vp.tag}`, f = [];
  await S.page.evaluate(() => { const st = PC.sample.state(); st.plot.pts = [[0, 0], [16, 0], [16, 18], [0, 18]]; st.ans.streetEdge = 0; st.ans.footprintPct = 50; st.plans = {}; st.stage = 1; PC.store.replace(st); PC.store.go(2); });
  await S.settle();
  const rows = await S.page.evaluate(() => [...document.querySelectorAll('[data-pc="conflict-list"] > li')].map((li) => ({ kind: li.dataset.kind, code: li.dataset.code, text: li.querySelector('[data-pc="conflict-text"]').textContent, aria: li.querySelector('[data-pc="conflict-goto"]').getAttribute('aria-label') })));
  const row = rows.find((r) => r.code === 'seating-omitted');
  if (!row || row.text !== SEAT_TEXT || row.kind !== 'warn' || row.aria !== 'Fix: go to question 17') f.push(`stage 2 row ${JSON.stringify(row)} (rows ${JSON.stringify(rows.map((r) => r.code))})`);
  if (row) { await S.page.evaluate(() => { const b = [...document.querySelectorAll('[data-pc="conflict-list"] > li')].find((li) => li.dataset.code === 'seating-omitted'); b.querySelector('[data-pc="conflict-goto"]').dataset.qa = '1'; });
    // the summary may be collapsed on phones: open it first when the Fix button is hidden
    if (!(await S.page.evaluate(() => { const b = document.querySelector('[data-qa="1"]'); return !b.closest('[hidden]') && b.getBoundingClientRect().height > 0; }))) await S.act('summary-toggle').catch(() => {});
    await S.act('css:[data-qa="1"]'); await S.settle();
    const at = await S.page.evaluate(() => { const g = ['site', 'building', 'rooms', 'outdoor'].find((x) => !document.querySelector(`[data-pc="q-group-${x}"]`).hidden), q = document.querySelector('[data-q="17"]'), r = q.getBoundingClientRect(); return { g, inView: r.top < innerHeight && r.bottom > 0, focus: q.contains(document.activeElement) }; });
    if (at.g !== 'outdoor' || !at.inView) f.push(`Fix: group ${at.g}, Q17 in view ${at.inView}`); }
  await S.shot('D-seating-warning');
  await S.act('btn-next'); await S.settle();
  const pw = await S.page.evaluate(() => [...document.querySelectorAll('[data-pc="plan-warn-list"] li')].map((li) => li.textContent.trim().replace(/\s+/g, ' ')));
  if (!pw.includes(SEAT_TEXT)) f.push(`Floor plans warnings ${JSON.stringify(pw)}`);
  R.check(`${T}: 16 x 18 m plot at 50 %: "${SEAT_TEXT.slice(0, 40)}…" on stage 2 (warn row, Fix to question 17 opens the Outdoor group with Q17 in view) and again on Floor plans`, f);
  await S.end(T);
});

// ================= E. budget on the maximum house =================
await guard('E budget', async () => {
  const S = await session(browser, VP.desk, { three: 'real', init: [RAF] }), T = 'E 1280x800 maximum house', f = [];
  const ok = await to5(S, "s.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; s.ans.streetEdge = 0; s.ans.footprintPct = 40; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.usableRoof = true; s.ans.roofType = 'terrace'; s.ans.pool = { on: true, size: 'L' }; s.ans.parking = { cars: 4, covered: true }; s.ans.extras = { wall: true, gate: 'right', seating: true }; s.ans.interior = { style: 'classic', density: 'full' }; s.ans.pairs = []; s.ans.rooms = []; let n = 1; for (const l of ['B', 'G', '1', '2']) for (const ty of ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry']) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); s.ans.nextRoomId = n;");
  let w = await W(S); const st = await S.state();
  if (!ok || st.ans.rooms.length !== 40) f.push(`setup: ready ${ok}, ${st.ans.rooms.length} rooms`);
  if (w.meshes > 18) f.push(`${w.meshes} meshes > 18`);
  await S.act('v3-roof'); await ready(S);
  const idle = async (ms = 600) => { await S.page.evaluate(() => { window.__raf = 0; }); const r0 = (await info(S)).renders; await S.page.waitForTimeout(ms); const i = await info(S); return { raf: i.raf, renders: i.renders - r0 }; };   // the idle span is under test
  let z = await idle(); if (z.raf || z.renders) f.push(`idle after the build: ${JSON.stringify(z)}`);
  const names0 = (await W(S)).names, i0 = await info(S), img0 = await pixels(S);
  await S.page.evaluate(() => { const gl = PC.debug.scene().renderer.getContext(); window.__lc = gl.getExtension('WEBGL_lose_context'); window.__lc.loseContext(); });
  await S.until(() => S.page.evaluate(() => PC.debug.scene().lost), 3000);
  await S.page.evaluate(() => window.__lc.restoreContext());
  await S.until(async () => (await info(S)).restores > i0.restores, 5000); await ready(S);
  const i1 = await info(S), names1 = (await W(S)).names, img1 = await pixels(S);
  if (i1.restores !== i0.restores + 1 || i1.renders <= i0.renders) f.push(`restore: ${JSON.stringify([i0, i1])}`);
  if (!eq(names1, names0)) f.push(`restore: meshes ${JSON.stringify(names0)} -> ${JSON.stringify(names1)}`);
  if (i1.builds !== i0.builds + 1) f.push(`restore: builds ${i0.builds} -> ${i1.builds} (the scene rebuilds its batches on restore)`);
  if (Buffer.compare(img0, img1) !== 0) f.push('restore: the frame after the restore differs from the one before');
  z = await idle(); if (z.raf || z.renders) f.push(`idle after the restore: ${JSON.stringify(z)}`);
  R.check(`${T} (40 rooms, terrace usable, pool L, 4 covered cars, wall, gate, seating; real r128): ${w.meshes} meshes <= 18, loop idle after the build, a context loss + restore rebuilds once, the same batches (${Object.keys(names0).length} names), the same frame, idle again`, f);
  await S.shot('E-max-roof'); await S.end(T);
});

// ================= F. Undo across a tab switch =================
for (const vp of [VP.phone, VP.desk]) await guard(`F undo ${vp.tag}`, async () => {
  const S = await session(browser, vp, {}), T = `F ${vp.tag}`, f = [];
  await S.page.evaluate(() => { const st = PC.sample.state(); st.plans = {}; st.stage = 1; PC.store.replace(st); PC.store.go(2); PC.store.go(3); }); await S.settle();
  const drag = async (id, dy) => { const p = await S.page.evaluate(([id, dy]) => { const s = PC.debug.state(), v = PC.debug.planView(), fp = PC.debug.site().footprint, r = s.plans[v.level].rooms.find((x) => x.id === id); return [PC.debug.toScreen('plan', fp.u + r.x + r.w / 2, fp.v + r.y + r.h / 2), PC.debug.toScreen('plan', fp.u + r.x + r.w / 2, fp.v + r.y + r.h / 2 + dy)]; }, [id, dy]);
    if (vp.touch) { const c = await S.page.context().newCDPSession(S.page); const send = (type, pts) => c.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q) => ({ x: q[0], y: q[1] })) }); await send('touchStart', [p[0]]); for (let k = 1; k <= 8; k++) await send('touchMove', [[p[0][0] + (p[1][0] - p[0][0]) * k / 8, p[0][1] + (p[1][1] - p[0][1]) * k / 8]]); await send('touchEnd', []); }
    else { await S.page.mouse.move(...p[0]); await S.page.mouse.down(); for (let k = 1; k <= 8; k++) await S.page.mouse.move(p[0][0] + (p[1][0] - p[0][0]) * k / 8, p[0][1] + (p[1][1] - p[0][1]) * k / 8); await S.page.mouse.up(); }
    await S.settle(); };
  const tab = async (lv) => { await S.act(`css:[data-pc="plan-tabs"] [data-level="${lv}"]`); await S.settle(); };
  const undoShown = () => S.shown('plan-undo');
  await tab('G'); const g0 = JSON.stringify((await S.state()).plans.G); await drag('r7', 2.3); const g1 = JSON.stringify((await S.state()).plans.G);
  if (g1 === g0 || !(await undoShown())) f.push('G edit: no change or no Undo');
  await tab('1'); if (await undoShown()) f.push('Undo shown on the First floor after a Ground edit');
  const p1 = JSON.stringify((await S.state()).plans['1']); await drag('r12', 1.5); const p2 = JSON.stringify((await S.state()).plans['1']);
  await S.act('plan-undo'); const s3 = await S.state();
  if (JSON.stringify(s3.plans['1']) !== p1) f.push('Undo on First did not restore the First floor');
  if (JSON.stringify(s3.plans.G) !== g1) f.push('Undo on First changed the Ground floor');
  await tab('G'); if (await undoShown()) f.push('Undo shown on Ground again');
  if (p2 === p1) f.push('First edit did not change the plan');
  R.check(`${T}: edit Ground, switch to First (no Undo), edit First, Undo: only the First floor is restored, Ground keeps its edit; back on Ground no Undo`, f);
  await S.end(T);
});
} finally { await browser.close(); }
R.note('sections: ' + TIMES.join(', '));
R.note(`runtime ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
