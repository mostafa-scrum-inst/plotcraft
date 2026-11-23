// F6-T1b QA (node, vendored r128 without a renderer): PC.house.openings and their decals in roofBatch, judged by QA's own
// reading of plan §6.1 / designer-plan A2 / Q-D1 / Q-D3 (no FS helper is used for an expectation). Version-aware: needs
// PC.house.openings (house v 2); without it only a note.
//   O rules per level >= 0 and footprint side, on every case: each opening on its side, inside one room edge (run) of that
//     side; kind by room type (habitable -> glazed 1.2 x 1.4 at sill 0.9, service -> small 0.6 x 0.6 at sill 1.6 when the run
//     > 1.2 m, stair -> slot 0.6 x 1.6, ground front -> door 1.0 x 2.2 centred on site.entrance); heads <= storeyH - 0.3;
//     >= 0.6 m clear of the run ends; glazed count n = max(1, floor((run - 0.6) / 2.6)) on a run >= 2.4 m (none shorter),
//     evenly spaced (equal gaps, symmetric about the run centre) unless the door drops panes; nothing within 0.6 m of the
//     door; no overlaps; sorted by a per level / side; no basement openings; deterministic; the house key follows them.
//   D decals (roofBatch items): one 'glass' quad per non-door opening on the outer wall plane 0.01 m proud, a..b and
//     floor + sill..floor + head, glassTop at the top and glassBottom at the bottom; 4 'reveal' quads per non-door opening;
//     the door leaf in exteriors[x].door at the entrance; nothing of it outside the footprint by more than 0.09 m.
// Run: node tests/qa/f6-t1-model.mjs [--only=O,D]
import { collector } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';
import * as H from './f4-t1-ref.mjs';
import { loadTables } from './f3-t3-ref.mjs';

const R = collector('F6-T1 model');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean), want = (s) => !only.length || only.includes(s);
const { PC, THREE } = H.loadPC3();
const T3 = loadTables();
const t0 = Date.now();
if (!(PC.house && typeof PC.house.openings === 'function')) { R.note('skipped: PC.house.openings absent (F6-T1b not merged)'); process.exit(R.done() ? 0 : 1); }

const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const cut = (a, n = 8) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);
// my own tables (plan §6.1 D-A2, designer-plan A2)
const HAB = ['living', 'dining', 'majlis', 'bedroom', 'office', 'kitchen'], SERV = ['bathroom', 'laundry', 'maid', 'storage'];
const SPEC = { glazed: { w: 1.2, h: 1.4, sill: 0.9 }, small: { w: 0.6, h: 0.6, sill: 1.6 }, slot: { w: 0.6, h: 1.6 }, door: { w: 1.0, h: 2.2, sill: 0 } };
const END = 0.6, PITCH = 2.6, SMALL_MIN = 1.2, DOOR_CLEAR = 0.6, HEAD_GAP = 0.3, SLAB = 0.2;
// F6-T1c W1 (plan §5, house v 3; marker PC.C.OPEN.hallPitch): hall panes on the free runs of a side (its extent minus the
// room, stair and lift runs), glazed, n = max(1, floor((L - 0.6) / 3.9)) on L >= 2.4, evenly spaced 0.6 m clear of the ends
const W1 = !!(PC.C.OPEN && PC.C.OPEN.hallPitch !== undefined), HALL_PITCH = 3.9;

function make(mut) { const s = Q.plain(PC.sample.state()); if (mut) mut(s); s.plans = {}; PC.plans.sync(s); for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; return s; }
const MAXM = (s) => { s.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; s.ans.streetEdge = 0; s.ans.footprintPct = 40; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.usableRoof = true; s.ans.roofType = 'terrace';
  s.ans.pool = { on: true, size: 'L' }; s.ans.parking = { cars: 4, covered: true }; s.ans.extras = { wall: true, gate: 'right', seating: true }; s.ans.interior = { style: 'classic', density: 'full' }; s.ans.pairs = []; s.ans.rooms = []; let n = 1;
  for (const l of ['B', 'G', '1', '2']) for (const ty of Object.keys(Q.ROOM_AREA)) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); s.ans.nextRoomId = n; };
const CASES = [
  ['sample', null],
  ['maximum house (B + 3 floors, 40 rooms)', MAXM],
  ['ceiling 2.4 m (head clamp), pitched, terracotta', (s) => { s.ans.ceilingH = 2.4; s.ans.roofType = 'pitched'; s.ans.usableRoof = false; s.ans.exterior = 'terracotta'; }],
  ['rotated 30 deg plot, grey, ceiling 4.5 m', (s) => { const a = 30 * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a); s.plot.pts = [[0, 0], [24, 0], [24, 34], [0, 34]].map(([x, y]) => [Math.round((x * c - y * sn) * 100) / 100, Math.round((x * sn + y * c) * 100) / 100]); s.ans.exterior = 'grey'; s.ans.ceilingH = 4.5; }],
  ['2 floors + lift, white, 60 %', (s) => { s.ans.floors = 2; s.ans.lift = true; s.ans.exterior = 'white'; s.ans.footprintPct = 60; }],
  ...['fl', 'fr', 'bl', 'br'].map((p) => [`stair ${p} (Q14 corner: slot on a side), 2 floors`, (s) => { s.ans.stairPos = p; s.ans.floors = 2; }]),
];
// seeded fuzz (run lengths across the count / clearance boundaries): plot size, footprint %, floors, stair, lift, ceiling, room mix
{ let a = 20261123 >>> 0; const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const TYPES = Object.keys(Q.ROOM_AREA);
  for (let i = 0; i < 60; i++) { const W = 16 + Math.round(r() * 40), D = 18 + Math.round(r() * 40), fpP = 25 + Math.round(r() * 45), fl = 1 + Math.floor(r() * 3), sp = ['fl', 'fr', 'bl', 'br', 'centre'][Math.floor(r() * 5)], lift = r() < 0.4, ch = [2.4, 2.7, 3, 3.5, 4.5][Math.floor(r() * 5)], nR = 4 + Math.floor(r() * 7), ty = Array.from({ length: nR * fl }, () => TYPES[Math.floor(r() * TYPES.length)]);
    CASES.push([`fuzz ${i} (${W} x ${D} m, ${fpP} %, ${fl} fl, ${sp}${lift ? ' + lift' : ''}, ${ch} m)`, (s) => { s.plot.pts = [[0, 0], [W, 0], [W, D], [0, D]]; s.ans.streetEdge = 0; s.ans.footprintPct = fpP; s.ans.floors = fl; s.ans.stairPos = sp; s.ans.lift = lift; s.ans.ceilingH = ch; s.ans.basement = false; s.ans.pairs = [];
      const lv = ['G', '1', '2'].slice(0, fl); s.ans.rooms = ty.map((t, k) => ({ id: 'r' + (k + 1), type: t, level: lv[k % fl], size: ['S', 'M', 'L'][k % 3], area: null, master: false })); s.ans.nextRoomId = ty.length + 1; }]); } }

// the room edges (runs) on one footprint side of a level: [a0, a1, room]
function runsOf(h, L, side) {
  const fp = h.footprint, out = [];
  for (const r of L.rooms) {
    const on = side === 'front' ? near(r.v, fp.v, 1e-6) : side === 'back' ? near(r.v + r.d, fp.v + fp.d, 1e-6) : side === 'left' ? near(r.u, fp.u, 1e-6) : near(r.u + r.w, fp.u + fp.w, 1e-6);
    if (on) out.push(side === 'front' || side === 'back' ? [r.u, r.u + r.w, r] : [r.v, r.v + r.d, r]);
  }
  return out.sort((x, y) => x[0] - y[0]);
}
const stairRun = (h, L, side, st = L.stair) => { const fp = h.footprint; if (!st) return null;
  const on = side === 'front' ? near(st.v, fp.v) : side === 'back' ? near(st.v + st.d, fp.v + fp.d) : side === 'left' ? near(st.u, fp.u) : near(st.u + st.w, fp.u + fp.w);
  return on ? (side === 'front' || side === 'back' ? [st.u, st.u + st.w] : [st.v, st.v + st.d]) : null; };

// my free runs: the side's extent minus the union of the room runs, the stair run and the lift run
function freeRuns(h, L, side) {
  const fp = h.footprint, lo = side === 'front' || side === 'back' ? fp.u : fp.v, hi = lo + (side === 'front' || side === 'back' ? fp.w : fp.d);
  const used = [...runsOf(h, L, side).map(([a, b]) => [a, b]), stairRun(h, L, side), stairRun(h, L, side, L.lift)].filter(Boolean).sort((x, y) => x[0] - y[0]);
  const out = []; let at = lo;
  for (const [a, b] of used) { if (a > at + 1e-6) out.push([at, a]); at = Math.max(at, b); }
  if (hi > at + 1e-6) out.push([at, hi]);
  return out;
}
function openingProblems(tag, s, h) {
  const f = [], O = h.openings || [], fp = h.footprint, storeyH = h.storeyH;
  if (h.v !== (W1 ? 3 : 2)) f.push(`${tag}: house.v ${h.v} (${W1 ? 3 : 2} expected)`);
  const levelOf = Object.fromEntries(h.levels.map((l) => [l.id, l]));
  if (O.some((o) => !levelOf[o.level] || levelOf[o.level].index < 0)) f.push(`${tag}: openings on a basement or unknown level: ${JSON.stringify(O.filter((o) => !levelOf[o.level] || levelOf[o.level].index < 0).slice(0, 2))}`);
  const en = h.site.entrance, door = O.filter((o) => o.kind === 'door');
  if (door.length !== 1 || door[0].level !== 'G' || door[0].side !== 'front' || !near(door[0].a, en.u - SPEC.door.w / 2) || !near(door[0].b, en.u + SPEC.door.w / 2) || !near(door[0].sill, 0) || !near(door[0].head, Math.min(SPEC.door.h, storeyH - HEAD_GAP)))
    f.push(`${tag}: door ${JSON.stringify(door)} (one, G front, 1.0 m centred on the entrance u ${en.u}, 0..2.2)`);
  for (const L of h.levels.filter((l) => l.index >= 0)) for (const side of ['front', 'back', 'left', 'right']) {
    const os = O.filter((o) => o.level === L.id && o.side === side), runs = runsOf(h, L, side), sr = stairRun(h, L, side);
    for (let i = 1; i < os.length; i++) { if (os[i].a < os[i - 1].a) f.push(`${tag} ${L.id} ${side}: not sorted by a`); if (os[i].a < os[i - 1].b - 1e-9) f.push(`${tag} ${L.id} ${side}: openings overlap ${os[i - 1].a}..${os[i - 1].b} / ${os[i].a}..${os[i].b}`); }
    const dr = L.id === 'G' && side === 'front' ? door[0] : null;
    for (const o of os) {
      if (o.kind === 'door') continue;
      const sp = SPEC[o.kind]; if (!sp) { f.push(`${tag}: unknown kind ${o.kind}`); continue; }
      if (!near(o.b - o.a, sp.w)) f.push(`${tag} ${L.id} ${side}: ${o.kind} width ${(o.b - o.a).toFixed(3)} != ${sp.w}`);
      const sill = o.kind === 'slot' ? o.sill : sp.sill, head = Math.min(sill + sp.h, storeyH - HEAD_GAP);
      if (o.kind !== 'slot' && !near(o.sill, sp.sill)) f.push(`${tag} ${L.id} ${side}: ${o.kind} sill ${o.sill} != ${sp.sill}`);
      if (!near(o.head, head)) f.push(`${tag} ${L.id} ${side}: ${o.kind} head ${o.head} != min(${(sill + sp.h).toFixed(2)}, storeyH ${storeyH} - 0.3)`);
      if (o.head > storeyH - HEAD_GAP + 1e-9 || o.sill < -1e-9 || o.head <= o.sill) f.push(`${tag} ${L.id} ${side}: ${o.kind} ${o.sill}..${o.head} outside the storey`);
      if (dr && o.b > dr.a - DOOR_CLEAR + 1e-9 && o.a < dr.b + DOOR_CLEAR - 1e-9) f.push(`${tag} G front: ${o.kind} ${o.a}..${o.b} within 0.6 m of the door ${dr.a}..${dr.b}`);
      if (o.kind === 'slot') { if (!sr || o.a < sr[0] - 1e-9 || o.b > sr[1] + 1e-9) f.push(`${tag} ${L.id} ${side}: slot ${o.a}..${o.b} not on a stair edge ${JSON.stringify(sr)}`); continue; }
      const run = runs.find(([a0, a1]) => o.a >= a0 - 1e-9 && o.b <= a1 + 1e-9);
      const fr = !run && W1 ? freeRuns(h, L, side).find(([a0, a1]) => o.a >= a0 - 1e-9 && o.b <= a1 + 1e-9) : null;
      if (fr) { if (o.kind !== 'glazed') f.push(`${tag} ${L.id} ${side}: ${o.kind} on a free (hall) run, glazed expected`);
        if (o.a < fr[0] + END - 1e-9 || o.b > fr[1] - END + 1e-9) f.push(`${tag} ${L.id} ${side}: hall pane ${o.a}..${o.b} closer than 0.6 m to its free run end ${fr[0]}..${fr[1]}`); continue; }
      if (!run) { f.push(`${tag} ${L.id} ${side}: ${o.kind} ${o.a}..${o.b} on no room edge of that side`); continue; }
      const ty = run[2].type, k = HAB.includes(ty) ? 'glazed' : SERV.includes(ty) ? 'small' : null;
      if (k !== o.kind) f.push(`${tag} ${L.id} ${side}: ${o.kind} in a ${ty} (${k} expected)`);
      if (o.a < run[0] + END - 1e-9 || o.b > run[1] - END + 1e-9) f.push(`${tag} ${L.id} ${side}: ${o.kind} ${o.a}..${o.b} closer than 0.6 m to its run end ${run[0]}..${run[1]}`);
    }
    if (sr && !os.some((o) => o.kind === 'slot')) f.push(`${tag} ${L.id} ${side}: the stair is on this side (${sr}) but has no slot`);
    if (!sr && os.some((o) => o.kind === 'slot')) f.push(`${tag} ${L.id} ${side}: a slot with no stair edge`);
    // counts per run (runs not near the door: the door may drop panes); W1: the free runs are hall runs at pitch 3.9
    const HALL = { type: 'living', hall: true, name: 'hall run' };
    for (const [a0, a1, r] of [...runs, ...(W1 ? freeRuns(h, L, side).map(([a, b]) => [a, b, HALL]) : [])]) {
      const P = r.hall ? HALL_PITCH : PITCH;
      const len = a1 - a0, here = os.filter((o) => o.kind !== 'door' && o.kind !== 'slot' && o.a >= a0 - 1e-9 && o.b <= a1 + 1e-9);
      const nearDoor = dr && a1 > dr.a - DOOR_CLEAR - SPEC.glazed.w && a0 < dr.b + DOOR_CLEAR + SPEC.glazed.w;
      if (HAB.includes(r.type)) {
        const n = len < SPEC.glazed.w + 2 * END - 1e-9 ? 0 : Math.max(1, Math.floor((len - END) / P + 1e-9));
        if (nearDoor ? here.length > n : here.length !== n) f.push(`${tag} ${L.id} ${side} ${r.name} run ${len.toFixed(2)} m: ${here.length} panes, ${n} by n = max(1, floor((run - 0.6) / ${P}))${nearDoor ? ' at most (door)' : ''}`);
        if (!nearDoor && here.length >= 1) { const c = here.map((o) => (o.a + o.b) / 2), mid = (a0 + a1) / 2;
          if (!near(c[0] - a0, a1 - c[c.length - 1], 1e-6)) f.push(`${tag} ${L.id} ${side} ${r.name}: panes not symmetric about the run centre ${mid}`);
          for (let i = 2; i < c.length; i++) if (!near(c[i] - c[i - 1], c[1] - c[0], 1e-6)) f.push(`${tag} ${L.id} ${side} ${r.name}: uneven pane spacing`);
          // my reading of "evenly spaced, 0.6 m clear of each run end": the clear span split into n equal slots, a pane centred in each
          const span = len - 2 * END; if (here.length === n && c.some((x, i) => !near(x, a0 + END + span * (i + 0.5) / n, 1e-6))) f.push(`${tag} ${L.id} ${side} ${r.name}: pane centres ${c.map((x) => x.toFixed(3))} != the clear span in ${n} equal slots`); }
      } else if (SERV.includes(r.type)) {
        const n = len > SMALL_MIN + 1e-9 ? 1 : 0;
        if (nearDoor ? here.length > n : here.length !== n) f.push(`${tag} ${L.id} ${side} ${r.name} run ${len.toFixed(2)} m: ${here.length} small panes, ${n} expected`);
      } else if (here.length) f.push(`${tag} ${L.id} ${side} ${r.name} (${r.type}): ${here.length} openings in a room of no opening class`);
    }
  }
  return f;
}

// decals in roofBatch (item kinds) against the openings
function decalProblems(tag, s, h) {
  const f = [], world = new THREE.Group(); world.name = 'world';
  const M = () => new THREE.MeshLambertMaterial({ vertexColors: true });
  const mats = { batch: M(), paving: M(), ui: new THREE.MeshBasicMaterial({ vertexColors: true }), tiles: M(), ground: new THREE.MeshLambertMaterial(), groundOuter: new THREE.MeshLambertMaterial(), groundRing: M(), poolWater: new THREE.MeshLambertMaterial(), trunk: new THREE.MeshLambertMaterial(), canopy: new THREE.MeshLambertMaterial(), shrub: new THREE.MeshLambertMaterial(), blob: new THREE.MeshBasicMaterial() };
  PC.three.buildShell(h, world, mats); PC.three.buildRoof(h, world, mats); world.updateMatrixWorld(true);
  const rb = world.getObjectByName('roofBatch'); if (!rb) return [`${tag}: no roofBatch`];
  const sum = H.summarize(world).find((m) => m.name === 'roofBatch'), items = []; let v = 0;
  for (const [k, n] of sum.kinds || []) { const P = sum.pos.slice(3 * v, 3 * (v + n)), C = sum.col ? sum.col.slice(3 * v, 3 * (v + n)) : [];
    const xs = [], ys = [], zs = []; for (let i = 0; i < P.length; i += 3) { xs.push(P[i]); ys.push(P[i + 1]); zs.push(P[i + 2]); }
    items.push({ kind: k, min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)], max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)], P, C }); v += n; }
  const nonDoor = h.openings.filter((o) => o.kind !== 'door'), glass = items.filter((x) => x.kind === 'glass'), rev = items.filter((x) => x.kind === 'reveal');
  if (glass.length !== nonDoor.length) f.push(`${tag}: ${glass.length} glass quads for ${nonDoor.length} panes`);
  if (rev.length !== 4 * nonDoor.length) f.push(`${tag}: ${rev.length} reveal quads, 4 x ${nonDoor.length} expected`);
  const fp = h.footprint, cu = h.center[0], cv = h.center[1], X = (u) => u - cu, Z = (vv) => -(vv - cv), G = 0.01;
  const gTop = H.lin(T3.siteColors.glassTop), gBot = H.lin(T3.siteColors.glassBottom), same = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 2e-5);
  const levelOf = Object.fromEntries(h.levels.map((l) => [l.id, l]));
  const left = glass.slice();
  for (const o of nonDoor) {
    const L = levelOf[o.level], fy = L.baseY + SLAB, y0 = fy + o.sill, y1 = fy + o.head;
    const box = o.side === 'front' ? { min: [X(o.a), y0, Z(fp.v) + G], max: [X(o.b), y1, Z(fp.v) + G] } : o.side === 'back' ? { min: [X(o.a), y0, Z(fp.v + fp.d) - G], max: [X(o.b), y1, Z(fp.v + fp.d) - G] }
      : o.side === 'left' ? { min: [X(fp.u) - G, y0, Z(o.b)], max: [X(fp.u) - G, y1, Z(o.a)] } : { min: [X(fp.u + fp.w) + G, y0, Z(o.b)], max: [X(fp.u + fp.w) + G, y1, Z(o.a)] };
    const k = left.findIndex((x) => [0, 1, 2].every((i) => near(x.min[i], box.min[i], 1e-4) && near(x.max[i], box.max[i], 1e-4)));
    if (k < 0) { f.push(`${tag}: no glass quad for ${o.level} ${o.side} ${o.kind} ${o.a}..${o.b} at ${JSON.stringify(box)}`); continue; }
    const g = left.splice(k, 1)[0];
    for (let i = 0; i < g.P.length / 3; i++) { const y = g.P[3 * i + 1], c = g.C.slice(3 * i, 3 * i + 3); if (near(y, y1, 1e-4) ? !same(c, gTop) : near(y, y0, 1e-4) ? !same(c, gBot) : true) { f.push(`${tag}: glass ${o.level} ${o.side} ${o.a}: vertex colour at y ${y.toFixed(3)} not glassTop above / glassBottom below`); break; } }
  }
  // the door leaf: a box in the exterior's door colour across the entrance, at the front plane
  const E = T3.exteriors[s.ans.exterior], dc = H.lin(E.door), d = h.openings.find((o) => o.kind === 'door');
  const leaf = items.filter((x) => x.kind === 'box' && x.C.length && same(x.C.slice(0, 3), dc));
  if (!d || leaf.length !== 1) f.push(`${tag}: ${leaf.length} door-coloured boxes (one leaf expected)`);
  else { const l = leaf[0]; if (!near(l.min[0], X(d.a), 1e-3) || !near(l.max[0], X(d.b), 1e-3) || !near(l.min[1], SLAB + d.sill, 1e-3) && !near(l.min[1], d.sill, 1e-3) || l.max[2] > Z(fp.v) + 0.09 || l.min[2] < Z(fp.v) - 0.2) f.push(`${tag}: door leaf ${JSON.stringify([l.min, l.max].map((p) => p.map((x) => +x.toFixed(3))))} not the 1.0 m door at the front plane`); }
  // nothing of the decals more than 0.09 m outside the footprint (sill 0.08, Q-D1)
  const out = items.filter((x) => ['glass', 'reveal'].includes(x.kind) || (x.kind === 'box' && x.max[1] < (h.roof ? h.roof.baseY : 99))).filter((x) => x.min[0] < X(fp.u) - 0.09 - 1e-6 || x.max[0] > X(fp.u + fp.w) + 0.09 + 1e-6 || x.min[2] < Z(fp.v + fp.d) - 0.09 - 1e-6 || x.max[2] > Z(fp.v) + 0.09 + 1e-6);
  if (out.length) f.push(`${tag}: ${out.length} decal items more than 0.09 m outside the footprint (e.g. ${out[0].kind} ${JSON.stringify(out[0].min)})`);
  return f;
}

const fo = [], fd = [], counts = [];
let skipped = 0;
// TL ruling (F6-T1c default run 426 s): the maximum house runs in the release step only (QA_RELEASE=1; --release-only runs
// just it, from f6-t1-leak.mjs --rows-only); the sample, the named cases and the fuzz houses stay in the default run
const REL = !!process.env.QA_RELEASE, RELONLY = process.argv.includes('--release-only'), isMax = (t) => t.startsWith('maximum house');
const RUN_CASES = CASES.filter(([t]) => (RELONLY ? isMax(t) : REL || !isMax(t)));
for (const [tag, mut] of RUN_CASES) {
  const s = make(mut), h = PC.house.build(s);
  if (!h) { if (tag.startsWith('fuzz')) { skipped++; continue; } fo.push(`${tag}: no house`); continue; }
  if (want('O')) {
    fo.push(...openingProblems(tag, s, h));
    const h2 = PC.house.build(make(mut)); if (JSON.stringify(h2.openings) !== JSON.stringify(h.openings) || h2.key !== h.key) fo.push(`${tag}: openings / key not deterministic`);
    counts.push(`${tag}: ${h.openings.length} (${['glazed', 'small', 'slot', 'door'].map((k) => `${k} ${h.openings.filter((o) => o.kind === k).length}`).join(', ')})`);
  }
  if (want('D')) fd.push(...decalProblems(tag, s, h));
}
if (want('O')) {
  // the key follows the openings: a change that moves only an opening-relevant edge changes the key
  const a = PC.house.build(make()), b = PC.house.build(make((s) => { s.ans.exterior = s.ans.exterior === 'sand' ? 'white' : 'sand'; }));
  if (a.key === b.key) fo.push('the key does not change with the exterior (control)');
  R.check(`O openings (plan §6.1, my rules) on ${RUN_CASES.length} houses: on a room edge of their side, kind by room type, sizes / sill / head (<= storeyH - 0.3), 0.6 m end and door clearances, glazed count and even spacing, one slot per stair edge, one door at the entrance, sorted, no basement, deterministic`, cut(fo));
  R.note(`O counts: ${counts.filter((c) => !c.startsWith('fuzz')).join('; ')}; fuzz ${RUN_CASES.filter(([t]) => t.startsWith('fuzz')).length - skipped} houses built (${skipped} without a model)`);
}
if (want('D')) R.check(`D roofBatch decals: one glass quad per pane on the outer wall plane 0.01 m proud (glassTop above / glassBottom below), 4 reveal quads each, the door leaf in exteriors.door across the entrance, nothing more than 0.09 m outside the footprint (${RUN_CASES.length} houses)`, cut(fd));
R.note(`run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
