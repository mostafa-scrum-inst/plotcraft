// F4-T2 Step 0 QA (node): the core half of the TL's QA focus list (docs/03-tasks/F4-T2/impl-review-step0.md).
// All expectations are QA's own, written from client-decisions.md CD-4 / CD-5 and goals-and-stories.md rounds 8 and 10:
//   A  CD-4: generated 9-10-room plans (every stair position, lift, m and ft states) judged by QA's own layout oracle:
//      every room exactly once, inside the footprint, off the stair / lift, no overlaps, sides >= 1.5 m, area within 25 %.
//   B  generator identity: QA's own seeded stream (1-8 rooms, including first-pass failures that use the retry range)
//      against a vm copy of the pre-Step-0 layout.js (git 726514a), byte-identical results; the maximum house
//      (basement + 3 floors, 10 rooms each, lift) synced, judged and timed.
//   C  CD-5 access with QA's own oracle (point sampling of each inner side against hall / stair / lift; QA's host table
//      from the PM text; QA's adjacency; fixed point), hand cases for every rule and a seeded comparison; sample clean.
//   D  low-fill hint: 48 % shown (whole percent, rounded down), exactly 50 % not shown, sample none, default answers on a
//      large plot shown, same number in m and ft.
//   E  CTO items: a room overlapping only the lift is a problem and blocks approval; a seeded random-op stream of edits
//      where stale-plan edits, unknown ids and rectangles without area are refused and change nothing.
// Run: node tests/qa/f4-t2-s0-core.mjs [--only=A,B,...]   (--no-shots accepted and ignored)
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { ROOT, collector } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';
import { HOSTS, myAccess } from './f4-t2-ref.mjs';

const R = collector('F4-T2 Step 0 core');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (s) => !only.length || only.includes(s);
const PC = Q.loadPC();
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const TOL = 0.011, MIN = 1.5, MAXR = 10;
const t0 = Date.now();
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TYPES = Object.keys(Q.ROOM_AREA), POS = ['centre', 'fl', 'fr', 'bl', 'br'];

// ---------- QA's layout oracle (A-8 / F3-S1) ----------
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > TOL && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > TOL;
function adj(a, b) { const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y), gx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w), gy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
  return (Math.abs(gx) <= 0.02 && oy >= 0.5 - 1e-9) || (Math.abs(gy) <= 0.02 && ox >= 0.5 - 1e-9); }
function layoutProblems(W, D, want, core, rooms) { // want: { id: area }
  const f = [], seen = {};
  for (const r of rooms) { if (!(r.id in want)) { f.push(`unknown room ${r.id}`); continue; } if (seen[r.id]) f.push(`room ${r.id} twice`); seen[r.id] = true;
    if (r.x < -TOL || r.y < -TOL || r.x + r.w > W + TOL || r.y + r.h > D + TOL) f.push(`${r.id} outside the ${W} x ${D} footprint`);
    if (Math.min(r.w, r.h) < MIN - 1e-6) f.push(`${r.id} side ${Math.min(r.w, r.h)} < 1.5 m`);
    if (Math.max(r.w, r.h) / Math.min(r.w, r.h) > 3 + 1e-6) f.push(`${r.id} aspect > 3`);
    if (Math.abs(r.w * r.h - want[r.id]) > 0.25 * want[r.id] + 1e-6) f.push(`${r.id} area ${(r.w * r.h).toFixed(1)} vs ${want[r.id]}`);
    for (const k of ['stair', 'lift']) if (core[k] && overlap(r, core[k])) f.push(`${r.id} overlaps the ${k}`); }
  for (const id in want) if (!seen[id]) f.push(`room ${id} missing`);
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) if (overlap(rooms[i], rooms[j])) f.push(`${rooms[i].id} overlaps ${rooms[j].id}`);
  return f; }

// ---------- QA's programmes ----------
function programme(r, W, D, { min = 1, max = 8, fillLo = 0.3, fillHi = 1 } = {}) {
  const stairs = r() < 0.85, lift = stairs && r() < 0.35, pos = POS[Math.floor(r() * 5)], fill = fillLo + r() * (fillHi - fillLo);
  const coreA = stairs ? 10 + (lift ? 3 : 0) : 0, target = fill * (W * D - coreA), rooms = []; let sum = 0, id = 1;
  while (rooms.length < max && (sum < target || rooms.length < min)) { const t = TYPES[Math.floor(r() * TYPES.length)], ex = r() < 0.15; const a = ex ? Math.round((4 + r() * 40) * 2) / 2 : Q.ROOM_AREA[t]['SML'[Math.floor(r() * 3)]]; if (sum + a > target * 1.05 && rooms.length >= min) break; rooms.push({ id: 'r' + id++, area: a, type: t }); sum += a; }
  const pairs = []; const np = Math.floor(r() * Math.min(7, rooms.length)); for (let k = 0; k < np; k++) { const a = rooms[Math.floor(r() * rooms.length)].id, b = rooms[Math.floor(r() * rooms.length)].id; if (a !== b && pairs.length < 6 && !pairs.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))) pairs.push(PC.store.cmpId(a, b) < 0 ? [a, b] : [b, a]); }
  return { W, D, rooms: rooms.map(({ id, area }) => ({ id, area })), types: Object.fromEntries(rooms.map((x) => [x.id, x.type])), pairs, stairs, stairPos: pos, lift, fill: sum / (W * D - coreA) };
}
const inpOf = (p) => ({ W: p.W, D: p.D, rooms: p.rooms, pairs: p.pairs, stairs: p.stairs, stairPos: p.stairPos, lift: p.lift });
const ms = (f) => { const a = process.hrtime.bigint(), v = f(); return [v, Number(process.hrtime.bigint() - a) / 1e6]; };

// ================= A. CD-4: 9-10 rooms per plan =================
if (want('A')) {
  R.check('A PC.C.MAX_ROOMS_PER_LEVEL is 10 and MAX_PAIRS_PER_LEVEL stays 6 (CD-4)', PC.C.MAX_ROOMS_PER_LEVEL === 10 && PC.C.MAX_PAIRS_PER_LEVEL === 6);
  const r = rng(4210), pr = [], st = { n: 0, ok: 0, by: { 9: [0, 0], 10: [0, 0] }, worst: 0 };
  for (let i = 0; i < 300; i++) {
    const W = 9 + Math.round(r() * 22) / 2, D = 9 + Math.round(r() * 22) / 2, n = 9 + (i % 2), p = programme(r, W, D, { min: n, max: n, fillLo: 0.4, fillHi: 0.9 });
    if (p.rooms.length !== n) continue;
    let out, t; try { [out, t] = ms(() => PC.layout.generate(inpOf(p))); } catch (e) { pr.push(`#${i}: generate threw ${e.message}`); continue; }
    st.n++; st.worst = Math.max(st.worst, t); st.by[n][0]++;
    if (!out.ok) continue; st.ok++; st.by[n][1]++;
    pr.push(...layoutProblems(W, D, Object.fromEntries(p.rooms.map((x) => [x.id, x.area])), out.core, out.rooms).map((x) => `#${i} (${W} x ${D}, ${n} rooms, ${p.stairs ? p.stairPos + (p.lift ? '+lift' : '') : 'no stairs'}): ${x}`));
  }
  R.check(`A ${st.n} seeded 9-10-room programmes (${st.ok} laid out): every laid-out plan passes QA's oracle (each room once, inside, off the core, no overlaps, sides, area)`, pr.slice(0, 8));
  R.note(`A 9 rooms: ${st.by[9][1]} of ${st.by[9][0]} laid out; 10 rooms: ${st.by[10][1]} of ${st.by[10][0]}; slowest generate ${st.worst.toFixed(0)} ms`);
  // the app's own path: a state with 10 rooms on the Ground floor, every stair position, lift on / off, m and ft
  const f = [], cnt = { ok: 0, n: 0 };
  for (const unit of ['m', 'ft']) for (const pos of POS) for (const lift of [false, true]) for (const pct of [50, 60]) {
    const s = Q.plain(PC.sample.state()); s.ans.unit = unit; s.ans.stairPos = pos; s.ans.lift = lift; s.ans.footprintPct = pct;
    s.plot.pts = [[0, 0], [30, 0], [30, 36], [0, 36]];
    let id = s.ans.nextRoomId; const add = ['office', 'storage', 'bedroom'];
    for (let k = 0; s.ans.rooms.filter((x) => x.level === 'G').length < 10; k++) s.ans.rooms.push({ id: 'r' + id++, type: add[k % 3], level: 'G', size: 'S', area: null, master: false });
    s.ans.nextRoomId = id; s.plans = {}; PC.plans.sync(s); cnt.n++;
    const p = s.plans.G, c = PC.plans.ctx(s, 'G'), wantA = Object.fromEntries(s.ans.rooms.filter((x) => x.level === 'G').map((x) => [x.id, x.area !== null ? x.area : Q.ROOM_AREA[x.type][x.size]]));
    if (!p || p.error) { f.push(`${unit} ${pos}${lift ? '+lift' : ''} ${pct} %: no layout (${p && p.error})`); continue; }
    cnt.ok++; f.push(...layoutProblems(c.W, c.D, wantA, c.core, p.rooms).map((x) => `${unit} ${pos}${lift ? '+lift' : ''} ${pct} %: ${x}`));
    if (p.rooms.length !== 10) f.push(`${unit} ${pos}: ${p.rooms.length} rooms drawn`);
  }
  R.check(`A state path: 10 Ground-floor rooms on a 30 x 36 m plot, 5 stair positions x lift x m/ft x 50/60 %: ${cnt.ok} of ${cnt.n} laid out, each passes QA's oracle`, cnt.ok === cnt.n ? f : f.concat(`only ${cnt.ok} of ${cnt.n} laid out`));
}

// ================= B. generator identity vs pre-Step-0 layout.js =================
if (want('B')) {
  let OLD = null, err = null;
  try {
    const oldSrc = execSync('git show 726514a:src/js/core/layout.js', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const man = JSON.parse(readFileSync(join(ROOT, 'src/manifest.json'), 'utf8')), ctx = vm.createContext({});
    for (const j of man.js) if (j.layer === 'core' || j.layer === 'data') vm.runInContext(j.file === 'js/core/layout.js' ? oldSrc : readFileSync(join(ROOT, 'src', j.file), 'utf8'), ctx, { filename: j.file });
    OLD = ctx.PC;
  } catch (e) { err = String(e.message || e); }
  if (!OLD) R.check('B pre-Step-0 layout.js loads from git 726514a', [err]);
  else {
    const L = PC.C.LAYOUT, firstOnly = (P, inp) => { const C = P.C.LAYOUT, keep = C.retry; C.retry = { ...keep, fMin: C.fMin, fMax: C.fMax }; try { return P.layout.generate(inp); } finally { C.retry = keep; } };
    const r = rng(8086), diff = [], st = { n: 0, ok: 0, none: 0, retried: 0, tNew: 0, tOld: 0, byN: {} };
    for (let i = 0; i < 400; i++) {   // the last 150 at 85-110 % fill, where the first pass fails and the retry range decides
      const hi = i >= 250, W = 6 + Math.round(r() * 28) / 2, D = 6 + Math.round(r() * 28) / 2, p = programme(r, W, D, hi ? { max: 8, fillLo: 0.85, fillHi: 1.1 } : { max: 8, fillLo: 0.3, fillHi: 1.05 }), inp = inpOf(p);
      const [a, ta] = ms(() => PC.layout.generate(inp)), [b, tb] = ms(() => OLD.layout.generate(inp));
      st.n++; st.tNew += ta; st.tOld += tb; st.byN[p.rooms.length] = (st.byN[p.rooms.length] || 0) + 1;
      if (JSON.stringify(a) !== JSON.stringify(b)) diff.push(`#${i} (${W} x ${D}, ${p.rooms.length} rooms ${p.rooms.map((x) => x.area).join('/')}, ${p.stairs ? p.stairPos + (p.lift ? '+lift' : '') : 'no stairs'}): new ${JSON.stringify(a).slice(0, 120)} vs old ${JSON.stringify(b).slice(0, 120)}`);
      if (a.ok) { st.ok++; if (!firstOnly(PC, inp).ok) st.retried++; } else st.none++;
    }
    R.check(`B ${st.n} seeded programmes of 1-8 rooms (sizes ${Object.entries(st.byN).map(([k, v]) => k + ':' + v).join(' ')}): Step 0 generate === pre-Step-0 generate, byte for byte (${st.ok} laid out, ${st.retried} of them only by the retry range 0.75-1.25, ${st.none} no layout)`, diff.slice(0, 5));
    // retry hunt: programmes whose first pass fails and whose retry succeeds (rare in the stream), each compared with the old file
    { const r2 = rng(9091), d2 = []; let found = 0, tried = 0;
      for (; tried < 20000 && found < 15; tried++) { const W = 6 + Math.round(r2() * 20) / 2, D = 6 + Math.round(r2() * 20) / 2, p = programme(r2, W, D, { max: 8, fillLo: 0.85, fillHi: 1.0 }), inp = inpOf(p);
        const a = PC.layout.generate(inp); if (!a.ok || firstOnly(PC, inp).ok) continue; found++;
        const b = OLD.layout.generate(inp); if (JSON.stringify(a) !== JSON.stringify(b)) d2.push(`retry case (${W} x ${D}, ${p.rooms.map((x) => x.area).join('/')}): differs`); }
      R.note(`B retry hunt: ${found} retry-only layouts in ${tried} tries`); R.check(`B retry range: ${found} programmes laid out only by the retry (0.75-1.25), found in ${tried} tries: Step 0 === pre-Step-0 byte for byte`, found >= 10 ? d2 : d2.concat(`only ${found} retry cases found`)); }
    R.note(`B generate total: Step 0 ${st.tNew.toFixed(0)} ms vs pre-Step-0 ${st.tOld.toFixed(0)} ms over ${st.n} programmes`);
  }
  // the maximum house: basement + 3 floors, 10 rooms each, lift (stories: 40 rooms)
  const s = Q.plain(PC.sample.state()); s.ans.basement = true; s.ans.floors = 3; s.ans.lift = true; s.ans.footprintPct = 50; s.plot.pts = [[0, 0], [40, 0], [40, 40], [0, 40]];
  let id = s.ans.nextRoomId; const T = ['bedroom', 'bathroom', 'office', 'storage', 'laundry', 'maid'];
  for (const lv of ['B', 'G', '1', '2']) { let k = 0; while (s.ans.rooms.filter((x) => x.level === lv).length < 10) s.ans.rooms.push({ id: 'r' + id++, type: T[k++ % T.length], level: lv, size: 'S', area: null, master: false }); }
  s.ans.nextRoomId = id; s.plans = {};
  const times = []; let last = null;
  for (let k = 0; k < 3; k++) { const c = Q.plain(s); const [, t] = ms(() => PC.plans.sync(c)); times.push(t); last = c; }
  const f = [];
  for (const lv of ['B', 'G', '1', '2']) { const p = last.plans[lv], c = PC.plans.ctx(last, lv), wantA = Object.fromEntries(last.ans.rooms.filter((x) => x.level === lv).map((x) => [x.id, Q.ROOM_AREA[x.type][x.size]]));
    if (!p || p.error) { f.push(`${lv}: no layout`); continue; } f.push(...layoutProblems(c.W, c.D, wantA, c.core, p.rooms).map((x) => `${lv}: ${x}`)); if (!c.core.lift) f.push(`${lv}: no lift`); }
  R.check(`B maximum house (B + 3 floors x 10 rooms = ${last.ans.rooms.length} rooms, lift) syncs: all four plans laid out and pass QA's oracle`, last.ans.rooms.length === 40 ? f : f.concat(`${last.ans.rooms.length} rooms`));
  R.note(`B maximum house sync (node): ${times.map((t) => t.toFixed(0)).join(' / ')} ms (first / warm runs)`);
}

// ================= C. CD-5 hall access =================
const near08 = (c) => Math.abs(c.hall - 0.8) < 0.01 || Math.abs(c.touch - 0.8) < 0.01;
if (want('C')) {
  R.check('C the host table in PC.C.HALL_ACCESS equals QA\'s reading of the PM text (min 0.8 m; Bathroom <- Bedroom / Maid; Storage, Laundry <- all but Bathroom / Storage / Laundry)', (() => { const A = PC.C.HALL_ACCESS, f = []; if (A.min !== 0.8) f.push('min ' + A.min); for (const k of Object.keys(HOSTS)) if (!eq([...(A.hosts[k] || [])].sort(), [...HOSTS[k]].sort())) f.push(`${k}: ${JSON.stringify(A.hosts[k])}`); for (const k of Object.keys(A.hosts)) if (!HOSTS[k]) f.push(`extra host rule for ${k}`); return f; })());
  // hand cases on a 12 x 12 footprint (no core unless named). A = the room under test in the front-left corner (3 x 3),
  // walled in on its two inner sides by B (east, x 3..6) and C (north, y 3..6); gaps leave hall of exactly the named length.
  const W = 12, Dd = 12, none = { stair: null, lift: null };
  const box = (types, extra = [], pairs = [], core = none, bH = 3, cW = 3) => ({ rooms: [{ id: 'a', x: 0, y: 0, w: 3, h: 3 }, { id: 'b', x: 3, y: 0, w: 3, h: bH }, { id: 'c', x: 0, y: 3, w: cW, h: 3 }, ...extra], types, pairs, core });
  const T = (a, b = 'office', c = 'office') => ({ a, b, c, d: 'office', e: 'office' });
  const CASES = [
    ['0.79 m of hall on one inner side: no access', box(T('office'), [], [], none, 2.21), ['a']],
    ['0.80 m of hall: access', box(T('office'), [], [], none, 2.2), []],
    ['0.40 + 0.40 m on two inner sides: 0.8 m in total counts', box(T('office'), [], [], none, 2.6, 2.6), []],
    ['exterior-only: a corner room walled in on both inner sides', box(T('office')), ['a']],
    ['stair contact 0.8 m (core, not hall)', box(T('office'), [], [], { stair: { x: 3, y: 2.2, w: 2.5, h: 4 }, lift: null }, 2.2), []],
    ['stair contact 0.79 m: none', box(T('office'), [], [], { stair: { x: 3, y: 2.21, w: 2.5, h: 4 }, lift: null }, 2.21), ['a']],
    ['lift contact 1.0 m', box(T('office'), [], [], { stair: { x: 6, y: 2, w: 2.5, h: 4 }, lift: { x: 3, y: 2, w: 1.5, h: 2 } }, 2), []],
    ['pair partner with access reaches a boxed Office', box(T('office'), [], [['a', 'b']]), []],
    ['non-pair Living neighbour does not reach a boxed Office', box(T('office', 'living', 'living')), ['a']],
    ['Bathroom <- Bedroom (en-suite)', box(T('bathroom', 'bedroom', 'office')), []],
    ['Bathroom <- Maid\'s room', box(T('bathroom', 'maid', 'office')), []],
    ['Bathroom <- Living / Office: not a host', box(T('bathroom', 'living', 'office')), ['a']],
    ['Bathroom <- Bathroom: not a host', box(T('bathroom', 'bathroom', 'bathroom')), ['a']],
    ...['bedroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid'].map((h) => [`Storage <- ${h}`, box(T('storage', h, 'bathroom')), []]),
    ...['bedroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid'].map((h) => [`Laundry <- ${h}`, box(T('laundry', h, 'bathroom')), []]),
    ...['bathroom', 'storage', 'laundry'].flatMap((h) => [[`Storage <- ${h}: not a host`, box(T('storage', h, h)), ['a']], [`Laundry <- ${h}: not a host`, box(T('laundry', h, h)), ['a']]]),
    ['a boxed Bedroom is named whatever its neighbours', box(T('bedroom', 'bedroom', 'maid')), ['a']],
    ['a host without access reaches nothing (both named)', box(T('bathroom', 'bedroom', 'office'), [{ id: 'd', x: 6, y: 0, w: 3, h: 3 }, { id: 'e', x: 3, y: 3, w: 3, h: 3 }]), ['a', 'b']],
    // chain: a (Bathroom) <- b (Bedroom, boxed by d and e) <- e (Living, paired with b, has access north)
    ['chain: Bathroom <- Bedroom <- its paired Living', { ...box(T('bathroom', 'bedroom', 'office'), [{ id: 'd', x: 6, y: 0, w: 3, h: 3 }, { id: 'e', x: 3, y: 3, w: 3, h: 3 }], [['b', 'e']]), types: { a: 'bathroom', b: 'bedroom', c: 'office', d: 'office', e: 'living' } }, []],
    ['chain: Storage <- Bathroom? no; Storage <- boxed Office <- paired Living', { rooms: [{ id: 'a', x: 0, y: 0, w: 3, h: 3 }, { id: 'b', x: 3, y: 0, w: 3, h: 3 }, { id: 'c', x: 0, y: 3, w: 3, h: 3 }, { id: 'd', x: 6, y: 0, w: 3, h: 3 }, { id: 'e', x: 3, y: 3, w: 3, h: 3 }], types: { a: 'storage', b: 'office', c: 'bathroom', d: 'storage', e: 'living' }, pairs: [['b', 'e']], core: none }, []],
    ['a pair partner that is itself boxed and unreached does not help', box(T('office'), [{ id: 'd', x: 6, y: 0, w: 3, h: 3 }, { id: 'e', x: 3, y: 3, w: 3, h: 3 }], [['a', 'b']]), ['a', 'b']],
  ];
  const f = [];
  for (const [name, c, exp] of CASES) {
    const app = PC.layout.access(W, Dd, c.rooms, c.core, c.pairs, c.types).slice().sort(), mine = myAccess(W, Dd, c.rooms, c.core, c.pairs, c.types).ids.sort();
    if (!eq(mine, [...exp].sort())) f.push(`${name}: QA oracle ${JSON.stringify(mine)} vs hand ${JSON.stringify(exp)} (oracle check)`);
    if (!eq(app, [...exp].sort())) f.push(`${name}: app ${JSON.stringify(app)}, expected ${JSON.stringify(exp)}`);
  }
  R.note(`C ${CASES.length} hand cases`); R.check(`C ${CASES.length} hand cases (0.79 / 0.80 m, two short gaps, exterior-only, stair / lift contact, pair partner, every host rule both ways, boxed Bedroom, unreached host, chains)`, f);
  // seeded comparison on generated plans + random nudges (overlap-free only; QA sampling within 0.01 m of 0.8 is reported apart)
  const r = rng(555), diff = [], st = { lv: 0, flagged: 0, rooms: 0, named: 0, edge: 0 };
  for (let i = 0; i < 450; i++) {
    const W2 = 8 + Math.round(r() * 20) / 2, D2 = 8 + Math.round(r() * 20) / 2, p = programme(r, W2, D2, { max: 10, fillLo: 0.4, fillHi: 1 }), out = PC.layout.generate(inpOf(p));
    if (!out.ok) continue;
    let rooms = out.rooms;
    if (r() < 0.5) { const k = Math.floor(r() * rooms.length), q = { ...rooms[k] }; q.x = Math.max(0, Math.min(W2 - q.w, Math.round((q.x + (r() - 0.5) * 2) * 10) / 10)); q.y = Math.max(0, Math.min(D2 - q.h, Math.round((q.y + (r() - 0.5) * 2) * 10) / 10));
      const nr = rooms.map((x, j) => (j === k ? q : x)); if (!nr.some((a, ai) => nr.some((b, bi) => bi > ai && overlap(a, b))) && ![out.core.stair, out.core.lift].filter(Boolean).some((b) => overlap(q, b))) rooms = nr; }
    const app = PC.layout.access(W2, D2, rooms, out.core, p.pairs, p.types).slice().sort(), mine = myAccess(W2, D2, rooms, out.core, p.pairs, p.types);
    st.lv++; st.rooms += rooms.length; st.named += app.length; if (app.length) st.flagged++;
    if (!eq(app, mine.ids.slice().sort())) { if (rooms.some((x) => near08(mine.info[x.id]))) st.edge++; else diff.push(`#${i} (${W2} x ${D2}): app ${JSON.stringify(app)} vs QA ${JSON.stringify(mine.ids)}; rooms ${JSON.stringify(rooms)} core ${JSON.stringify(out.core)} pairs ${JSON.stringify(p.pairs)} types ${JSON.stringify(p.types)}`); }
  }
  R.check(`C ${st.lv} seeded laid-out levels (1-10 rooms, half with one room nudged): the app's access list equals QA's oracle`, diff.slice(0, 3));
  R.note(`C seeded: ${st.flagged} of ${st.lv} levels name a room (${(100 * st.flagged / st.lv).toFixed(1)} %), ${st.named} of ${st.rooms} rooms; ${st.edge} differences within QA's 0.01 m sampling band of 0.8 m (not counted)`);
  // the sample: clean on both floors, by the app and by QA's oracle
  const s = Q.plain(PC.sample.state()); PC.plans.sync(s); const types = Object.fromEntries(s.ans.rooms.map((x) => [x.id, x.type])), g = [];
  for (const lv of ['G', '1']) { const c = PC.plans.ctx(s, lv), mine = myAccess(c.W, c.D, s.plans[lv].rooms, c.core, PC.levels.pairsOn(s, lv), types).ids; if (PC.plans.noAccess(s, lv).length) g.push(`${lv}: app names ${PC.plans.noAccess(s, lv)}`); if (mine.length) g.push(`${lv}: QA names ${mine}`); }
  R.check('C the sample: no hall-access warning on the Ground or First floor (6.2), by the app and by QA\'s oracle (the Ground Bathroom is reached through the Maid\'s room)', g);
  const st2 = Q.plain(s); st2.plans.G.sig = 'stale'; R.check('C noAccess is [] for a stale plan and for a missing plan (derived from the drawn, fresh plan only)', eq(PC.plans.noAccess(st2, 'G'), []) && eq(PC.plans.noAccess({ ...st2, plans: {} }, 'G'), []));
}

// ================= D. low-fill hint =================
if (want('D')) {
  const f = [];
  const s = Q.plain(PC.sample.state()); PC.plans.sync(s); const c = PC.plans.ctx(s, 'G'), core = (c.core.stair ? c.core.stair.w * c.core.stair.h : 0) + (c.core.lift ? c.core.lift.w * c.core.lift.h : 0), A = c.W * c.D;
  const withFill = (frac) => { const t = Q.plain(s), rooms = t.plans.G.rooms, rest = frac * A - core, others = rooms.slice(1).reduce((x, r) => x + r.w * r.h, 0); const r0 = rooms[0]; r0.h = (rest - others) / r0.w; return t; };
  if (PC.plans.lowFill(s, 'G') !== null || PC.plans.lowFill(s, '1') !== null) f.push(`sample: ${PC.plans.lowFill(s, 'G')} / ${PC.plans.lowFill(s, '1')}`);
  for (const [frac, exp] of [[0.48, 48], [0.4899, 48], [0.4999, 49], [0.5, null], [0.5001, null], [0.3, 30]]) { const t = withFill(frac), got = PC.plans.lowFill(t, 'G'); if (got !== exp) f.push(`fill ${frac}: ${got}, expected ${exp} (fill ${PC.plans.fill(t, 'G')})`); }
  // default answers on a large plot
  const big = Q.plain(PC.store.defaults());
  big.plot = { pts: [[0, 0], [40, 0], [40, 40], [0, 40]], closed: true }; big.plans = {}; PC.plans.sync(big);
  const lf = Q.levelIds(big.ans).map((lv) => [lv, PC.plans.lowFill(big, lv)]);
  if (!lf.some(([, v]) => v !== null)) f.push(`default answers on a 40 x 40 plot: no level under 50 % (${JSON.stringify(lf)})`);
  const ft = Q.plain(big); ft.ans.unit = 'ft'; ft.plans = {}; PC.plans.sync(ft); const lf2 = Q.levelIds(ft.ans).map((lv) => [lv, PC.plans.lowFill(ft, lv)]);
  if (!eq(lf, lf2)) f.push(`m ${JSON.stringify(lf)} vs ft ${JSON.stringify(lf2)}`);
  R.check('D low fill: 48 % and 49.99 % shown rounded down, exactly 50 % and above not shown; the sample shows none; default answers on a 40 x 40 m plot show it; m and ft give the same percent', f);
  R.note(`D defaults on 40 x 40 m: ${JSON.stringify(lf)}`);
}

// ================= E. CTO items =================
if (want('E')) {
  // lift-only overlap
  const s = Q.plain(PC.sample.state()); s.ans.lift = true; s.plans = {}; PC.plans.sync(s);
  const f = []; let found = null;
  for (const lv of ['G', '1']) { const c = PC.plans.ctx(s, lv), p = s.plans[lv], L = c.core.lift; if (!p || p.error || !L) { f.push(`${lv}: no plan or lift`); continue; }
    outer: for (const r of p.rooms) for (let x = 0; x <= c.W - r.w + 1e-9; x = Math.round((x + 0.1) * 10) / 10) for (let y = 0; y <= c.D - r.h + 1e-9; y = Math.round((y + 0.1) * 10) / 10) {
      const q = { ...r, x, y }; if (!overlap(q, L) || overlap(q, c.core.stair) || p.rooms.some((o) => o.id !== r.id && overlap(q, o))) continue; found = { lv, q }; break outer; }
    if (found) break; }
  if (!found) f.push('no position overlapping only the lift found on the sample with a lift');
  else { const t = Q.plain(s), res = PC.plans.applyEdit(t, found.lv, found.q), pr = PC.plans.problems(t, found.lv);
    if (!res.changed) f.push('edit refused');
    if (!pr.length || !JSON.stringify(pr).includes(found.q.id)) f.push(`problems ${JSON.stringify(pr)} do not name ${found.q.id}`);
    if (PC.plans.canApprove(t, found.lv) !== 'overlap') f.push(`canApprove ${PC.plans.canApprove(t, found.lv)}`);
    if (PC.plans.approve(t, found.lv) !== false || t.plans[found.lv].approved) f.push('approved'); }
  R.check(`E a room moved onto the lift only (${found ? found.lv + ' ' + found.q.id : '-'}): listed as a problem, canApprove "overlap", approve refused`, f);
  // seeded random-op stream with stale-plan edits
  const r = rng(77), bad = [], st = { ok: 0, stale: 0, zero: 0, unknown: 0, missing: 0 };
  let t = Q.plain(PC.sample.state()); PC.plans.sync(t);
  for (let i = 0; i < 400; i++) {
    const lv = r() < 0.5 ? 'G' : '1', p = t.plans[lv], k = r();
    if (k < 0.15) { // make the plan stale: change a room's size on that level without syncing
      const room = t.ans.rooms.find((x) => x.level === lv); room.size = room.size === 'S' ? 'M' : 'S'; room.area = null; if (room.size === null) room.size = 'M';
      const before = JSON.stringify(t.plans), q = { ...p.rooms[0], x: p.rooms[0].x + 0.5 }, res = PC.plans.applyEdit(t, lv, q); st.stale++;
      if (res.changed || JSON.stringify(t.plans) !== before) bad.push(`#${i} stale ${lv}: changed ${res.changed}`);
      t.plans = {}; PC.plans.sync(t); continue; }
    if (!p || p.error) { st.missing++; const before = JSON.stringify(t.plans), res = PC.plans.applyEdit(t, lv, { id: 'r1', x: 0, y: 0, w: 2, h: 2 }); if (res.changed || JSON.stringify(t.plans) !== before) bad.push(`#${i} no plan on ${lv}: changed`); t.plans = {}; PC.plans.sync(t); continue; }
    const j = Math.floor(r() * p.rooms.length), q = { ...p.rooms[j] }, before = JSON.stringify(t.plans);
    if (k < 0.3) { q[r() < 0.5 ? 'w' : 'h'] = r() < 0.5 ? 0 : -1; const res = PC.plans.applyEdit(t, lv, q); st.zero++; if (res.changed || JSON.stringify(t.plans) !== before) bad.push(`#${i} w/h <= 0: changed`); continue; }
    if (k < 0.4) { q.id = 'r999'; const res = PC.plans.applyEdit(t, lv, q); st.unknown++; if (res.changed || JSON.stringify(t.plans) !== before) bad.push(`#${i} unknown id: changed`); continue; }
    q.x = Math.round((q.x + (r() - 0.5) * 2) * 100) / 100; q.y = Math.round((q.y + (r() - 0.5) * 2) * 100) / 100;
    if (r() < 0.2) PC.plans.approve(t, lv);
    const res = PC.plans.applyEdit(t, lv, q); st.ok++;
    const np = t.plans[lv], got = np.rooms.find((x) => x.id === q.id), by = Object.fromEntries(np.rooms.map((x) => [x.id, x]));
    const unmet = PC.levels.pairsOn(t, lv).filter((pq) => by[pq[0]] && by[pq[1]] && !adj(by[pq[0]], by[pq[1]])).map(String).sort();
    if (!res.changed || !eq(got, q) || !np.edited || np.approved || !eq(np.unmet.map(String).sort(), unmet)) bad.push(`#${i} fresh edit: changed ${res.changed} rect ${JSON.stringify(got)} vs ${JSON.stringify(q)} edited ${np.edited} approved ${np.approved} unmet ${JSON.stringify(np.unmet)} vs ${JSON.stringify(unmet)}`);
    if (JSON.stringify(t.plans[lv === 'G' ? '1' : 'G']) !== JSON.stringify(JSON.parse(before)[lv === 'G' ? '1' : 'G'])) bad.push(`#${i}: the other level changed`);
  }
  R.note(`E op stream: ${JSON.stringify(st)}`); R.check(`E seeded op stream (${st.ok} fresh edits, ${st.stale} stale-plan edits, ${st.zero} w/h <= 0, ${st.unknown} unknown ids, ${st.missing} on a level without a plan): stale / empty / unknown edits refused and nothing changes; fresh edits stored with edited, Draft and QA's unmet`, bad.slice(0, 5));
}
R.note(`node run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
