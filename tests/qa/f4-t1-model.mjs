// F4-T1 QA (node): the house model (PC.house.build, A-9) and the house shell (PC.three.buildShell on the vendored real
// three@0.128.0, no renderer) judged by QA's own oracle in f4-t1-ref.mjs: plot shape, footprint position, storeys at
// Q8 + 0.2, rooms = approved plans (also after an edit + approve, m and ft), stair / lift on every level at my A-8 core,
// Q14 seen from the street in frame T for fl / fr / bl / br / centre (deep and wide footprints, slanted street, lift on
// and off), Q10 exteriors, tints per room type, refusal, mesh budget on the maximum house.
// Run: node tests/qa/f4-t1-model.mjs   (--no-shots accepted and ignored)
import { collector } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';
import * as H from './f4-t1-ref.mjs';

const R = collector('F4-T1 model');
const { PC, THREE } = H.loadPC3();
const D = { exteriors: PC.data.exteriors, roomTints: PC.data.roomTints, interiors: PC.data.interiors };
const t0 = Date.now();

function make(mut) { const s = Q.plain(PC.sample.state()); if (mut) mut(s); s.plans = {}; PC.plans.sync(s); for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; return s; }
const ok = (s) => Object.values(s.plans).every((p) => !p.error);
function shell(house) {
  const world = new THREE.Group(); world.name = 'world';
  const mats = { batch: new THREE.MeshLambertMaterial({ vertexColors: true }), ground: new THREE.MeshLambertMaterial(), groundOuter: new THREE.MeshLambertMaterial() };
  const made = PC.three.buildShell(house, world, mats);
  return { world, made, sum: H.summarize(world) };
}
// the model itself against my expectation (frame L, numbers)
function modelProblems(s, h, X) {
  const P = [], F = X.F, fp = X.fp;
  if (!h) return ['build returned null for a stage-3-valid state'];
  if (Math.abs(h.center[0] - F.cu) > 1e-9 || Math.abs(h.center[1] - F.cv) > 1e-9) P.push(`center ${h.center} != my ${F.cu},${F.cv}`);
  if (Math.abs(h.radius - F.R) > 1e-9) P.push(`radius ${h.radius} != my ${F.R}`);
  if (h.plot.pts.length !== F.pL.length || h.plot.pts.some((p, i) => Math.hypot(p[0] - F.pL[i][0], p[1] - F.pL[i][1]) > 1e-9)) P.push('plot.pts != my W -> L');
  if (['u', 'v', 'w', 'd'].some((k) => h.footprint[k] !== fp[k])) P.push('footprint != site footprint');
  if (h.storeyH !== s.ans.ceilingH || Math.abs(h.pitch - X.pitch) > 1e-12) P.push(`storeyH / pitch ${h.storeyH} / ${h.pitch}`);
  if (h.levels.map((l) => l.id).join() !== X.levels.map((l) => l.id).join()) P.push(`levels ${h.levels.map((l) => l.id)} != ${X.levels.map((l) => l.id)}`);
  for (const L of X.levels) {
    const l = h.levels.find((x) => x.id === L.id); if (!l) continue;
    if (l.index !== L.index || Math.abs(l.baseY - L.baseY) > 1e-12) P.push(`${L.id}: index / baseY ${l.index} / ${l.baseY}`);
    if (l.name !== PC.C.LEVEL_LABEL[L.id]) P.push(`${L.id}: name ${l.name}`);
    const want = L.rooms.map((r) => ({ id: r.id, type: r.type, u: r.L.u, v: r.L.v, w: r.L.w, d: r.L.d }));
    const got = l.rooms.map((r) => ({ id: r.id, type: r.type, u: r.u, v: r.v, w: r.w, d: r.d }));
    if (JSON.stringify(got) !== JSON.stringify(want)) P.push(`${L.id}: rooms != approved plan in L`);
    for (const k of ['stair', 'lift']) if (JSON.stringify(l[k]) !== JSON.stringify(L[k])) P.push(`${L.id}: ${k} ${JSON.stringify(l[k])} != my ${JSON.stringify(L[k])}`);
  }
  if (Math.abs(h.roof.baseY - X.roofBaseY) > 1e-12) P.push(`roof.baseY ${h.roof.baseY} != ${X.roofBaseY}`);
  if (h.exterior !== s.ans.exterior) P.push('exterior');
  return P;
}

// ---------- 1 matrix: plots x Q14 x lift x levels x Q8 ----------
const PLOTS = {
  sample: (s) => {},                                                                        // deep footprint
  wide: (s) => { s.plot.pts = [[0, 0], [40, 0], [40, 22], [0, 22]]; s.ans.streetEdge = 0; },  // wide footprint
  slanted: (s) => { const c = Math.cos(0.5), n = Math.sin(0.5); s.plot.pts = [[0, 0], [20, 0], [20, 30], [8, 30], [0, 26]].map(([x, y]) => [x * c - y * n + 50, x * n + y * c + 10]); s.ans.streetEdge = 0; },
  side: (s) => { s.ans.streetEdge = 1; },                                                   // street on the right edge
};
let built = 0, skipped = 0, deep = 0, wide = 0;
const mProb = [], sProb = [], qProb = [], pos5 = new Set();
for (const [pk, pm] of Object.entries(PLOTS)) for (const pos of ['fl', 'fr', 'bl', 'br', 'centre']) for (const lift of [false, true]) for (const lv of ['2', '3B']) for (const ch of [2.4, 4.5]) {
  const tag = `${pk}/${pos}/${lift ? 'lift' : 'nolift'}/${lv}/${ch}`;
  const s = make((t) => { pm(t); t.ans.stairPos = pos; t.ans.lift = lift; t.ans.ceilingH = ch; if (lv === '3B') { t.ans.floors = 3; t.ans.basement = true; for (const l of ['B', '2']) t.ans.rooms.push({ id: 'r' + t.ans.nextRoomId++, type: 'storage', level: l, size: 'S', area: null, master: false }); } });
  if (!ok(s)) { skipped++; continue; }
  const fp = PC.site.analyse(s).footprint, X = H.expected(s, fp, D), h = PC.house.build(s);
  built++; if (fp.d >= fp.w) deep++; else wide++;
  mProb.push(...modelProblems(s, h, X).map((p) => `${tag}: ${p}`));
  if (!h) continue;
  const { sum } = shell(h);
  sProb.push(...H.shellProblems(sum, X, D).map((p) => `${tag}: ${p}`));
  for (const L of X.levels) {
    const b = H.coreBoxes(sum, L.id, X), fpT = H.tBox(X.F, fp, 0, 0);
    qProb.push(...H.q14Problems(pos, b.stair, b.lift, fpT).map((p) => `${tag} ${L.id}: ${p}`));
  }
  pos5.add(pos + (fp.d >= fp.w ? ':deep' : ':wide'));
}
const cut = (a) => a.slice(0, 8).concat(a.length > 8 ? [`... ${a.length} in all`] : []);
R.check(`1a house model = my oracle (centre, radius, plot in L, footprint, storeys, level order, rooms = approved plans in L, stair / lift = my A-8 core on every level, roof base) over ${built} states`, cut(mProb));
R.check('1b shell (real r128 geometry) = my oracle: slab box per level at baseY..floor, hall top face, one tint quad per room at my mix colour, stair and lift one box each on every level, Q10 exterior extent, entrance gap, no geometry above the 1.2 m walls, groundPlot = plot minus footprint, groundCap, groundOuter', cut(sProb));
R.check('2 Q14 in T from the street (+Z side, viewer facing -Z): fl min X / max Z, fr max X / max Z, bl min X / min Z, br max X / min Z, centre within the 0.5 snap; lift on and off, every level', cut(qProb));
R.check(`2 matrix covered all 5 positions on deep and wide footprints (${[...pos5].sort().join(' ')})`, pos5.size === 10 ? [] : [`only ${pos5.size} of 10`]);
R.note(`matrix: ${built} states built (${deep} deep, ${wide} wide footprints), ${skipped} skipped as no-layout`);

// ---------- 3 Q10 exteriors and tints for all 10 room types ----------
{
  const f = [];
  for (const ext of Object.keys(PC.data.exteriors)) for (const style of Object.keys(PC.data.interiors)) {
    const s = make((t) => { t.ans.exterior = ext; t.ans.interior.style = style; });
    const h = PC.house.build(s), X = H.expected(s, PC.site.analyse(s).footprint, D);
    f.push(...H.shellProblems(shell(h).sum, X, D).map((p) => `${ext}/${style}: ${p}`));
  }
  if (Object.keys(PC.data.exteriors).length !== 4) f.push(`exteriors ${Object.keys(PC.data.exteriors)}`);
  R.check('3a four Q10 exteriors x three interior styles: walls, slab and tints in my colours (A-10 mix, sRGB -> linear)', cut(f));
  const types = Object.keys(Q.ROOM_AREA), g = [];
  const s = make((t) => { t.plot.pts = [[0, 0], [40, 0], [40, 40], [0, 40]]; t.ans.footprintPct = 40; t.ans.floors = 3;
    t.ans.rooms = types.flatMap((ty, i) => [{ id: 'r' + (i + 1), type: ty, level: ['G', '1', '2'][i % 3], size: 'S', area: null, master: ty === 'bedroom' }]); t.ans.nextRoomId = types.length + 1; t.ans.pairs = []; });
  if (!ok(s)) g.push('setup: the all-types house has no layout');
  else {
    const h = PC.house.build(s), X = H.expected(s, PC.site.analyse(s).footprint, D), sum = shell(h).sum;
    g.push(...H.shellProblems(sum, X, D));
    const cols = new Set(X.levels.flatMap((l) => l.rooms.map((r) => r.c.map((x) => x.toFixed(5)).join())));
    if (cols.size !== types.length) g.push(`${types.length} room types gave ${cols.size} distinct tints`);
  }
  R.check(`3b tints per room type: a house with all ${types.length} types shows each at its own A-10 colour`, g);
}

// ---------- 4 rooms after an edit + approve, m and ft; refusal ----------
{
  const f = [], s = make(), id = '1', p = s.plans[id];
  // shrink the smallest room by 0.5 m on its width (stays inside, no overlap), edited + approved again
  const r = p.rooms.slice().sort((a, b) => a.w * a.h - b.w * b.h)[0];
  r.w -= 0.5; p.edited = true; p.approved = true;
  const h = PC.house.build(s), X = H.expected(s, PC.site.analyse(s).footprint, D);
  f.push(...modelProblems(s, h, X), ...H.shellProblems(shell(h).sum, X, D));
  const l = h && h.levels.find((x) => x.id === id), hr = l && l.rooms.find((x) => x.id === r.id);
  if (!hr || Math.abs(hr.w - r.w) > 1e-12) f.push('edited width not in the model');
  const ft = Q.plain(s); ft.ans.unit = 'ft'; const hf = PC.house.build(ft);
  if (!hf || hf.key !== h.key || JSON.stringify(hf) !== JSON.stringify(h)) f.push('unit ft changes the model');
  if (h && JSON.stringify(shell(hf).sum) !== JSON.stringify(shell(h).sum)) f.push('unit ft changes the geometry');
  R.check('4a an edited + re-approved plan is what the model and shell show (exact), the same in ft (key and geometry unchanged)', f);
  const g = [], u = Q.plain(s); u.plans['1'].approved = false;
  if (PC.house.build(u) !== null) g.push('an unapproved level still builds');
  const v = Q.plain(s); v.ans.rooms.push({ id: 'r' + v.ans.nextRoomId++, type: 'office', level: 'G', size: 'S', area: null, master: false });
  if (PC.house.build(v) !== null) g.push('a stale ground plan (room added, not synced) still builds');
  const w = Q.plain(s); w.plot.closed = false;
  if (PC.house.build(w) !== null) g.push('an open plot still builds');
  if (PC.house.build(Q.plain(s)).key !== h.key) g.push('key not deterministic');
  const e = Q.plain(s); e.ans.exterior = 'white'; if (PC.house.build(e).key === h.key) g.push('Q10 change keeps the key');
  R.check('4b refusal: null when a level is unapproved, a plan is stale, or the plot is open; key deterministic, changes with Q10', g);
}

// ---------- 5 no stairs; usable roof makes one floor a stair house ----------
{
  const f = [];
  const one = make((t) => { t.ans.floors = 1; t.ans.rooms = t.ans.rooms.filter((r) => r.level === 'G'); t.ans.pairs = t.ans.pairs.filter((pr) => pr.every((x) => t.ans.rooms.some((r) => r.id === x))); });
  if (!ok(one)) f.push('setup one floor'); else { const h = PC.house.build(one), X = H.expected(one, PC.site.analyse(one).footprint, D); f.push(...modelProblems(one, h, X).map((p) => '1 floor: ' + p), ...H.shellProblems(shell(h).sum, X, D).map((p) => '1 floor: ' + p)); if (X.levels[0].stair) f.push('oracle: stair on a single level'); }
  const roof = make((t) => { t.ans.floors = 1; t.ans.usableRoof = true; t.ans.roofType = 'flat'; t.ans.rooms = t.ans.rooms.filter((r) => r.level === 'G'); t.ans.pairs = t.ans.pairs.filter((pr) => pr.every((x) => t.ans.rooms.some((r) => r.id === x))); t.ans.stairPos = 'br'; });
  if (!ok(roof)) f.push('setup usable roof'); else { const h = PC.house.build(roof), X = H.expected(roof, PC.site.analyse(roof).footprint, D), sum = shell(h).sum; f.push(...modelProblems(roof, h, X).map((p) => 'roof: ' + p), ...H.shellProblems(sum, X, D).map((p) => 'roof: ' + p)); const b = H.coreBoxes(sum, 'G', X); f.push(...H.q14Problems('br', b.stair, b.lift, H.tBox(X.F, X.fp, 0, 0))); if (!b.stair) f.push('roof: no stair'); }
  R.check('5 one floor: no stair or lift anywhere; one floor + usable roof: a stair (Q14 br) on the ground floor', f);
}

// ---------- 6 maximum house: mesh budget, shadow flags ----------
{
  const f = [];
  const s = make((t) => { t.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; t.ans.footprintPct = 40; t.ans.floors = 3; t.ans.basement = true; t.ans.lift = true;
    const per = ['bedroom', 'bedroom', 'bathroom', 'office', 'storage', 'laundry', 'maid', 'bathroom'];
    t.ans.rooms = []; t.ans.pairs = []; let n = 1; for (const l of ['B', 'G', '1', '2']) for (const ty of per) t.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); t.ans.nextRoomId = n; });
  if (!ok(s)) f.push('setup: maximum house has no layout');
  else {
    const h = PC.house.build(s), X = H.expected(s, PC.site.analyse(s).footprint, D), { made, sum } = shell(h);
    f.push(...modelProblems(s, h, X), ...H.shellProblems(sum, X, D));
    if (h.levels.some((l) => l.rooms.length !== 8)) f.push('not 8 rooms per level');
    if (sum.length > 40) f.push(`${sum.length} meshes > 40`);
    if (made.length !== sum.length) f.push(`tracked ${made.length} != meshes in the world ${sum.length}`);
    R.note(`maximum house (B + 3 floors, lift, 8 rooms each): ${sum.length} meshes`);
  }
  R.check('6 maximum house (basement + 3 floors + lift, 8 rooms per level): shell = my oracle, <= 40 meshes, every mesh tracked for disposal', f);
}
R.note(`node run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
