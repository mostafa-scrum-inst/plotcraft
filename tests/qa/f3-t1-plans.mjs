// F3-T1 QA (node): the floor-plan generator (PC.layout, A-8) judged by QA's own oracle, the plan sync (PC.plans, A-7)
// and the R5 risk set. The oracle is written from A-8 / F3-S1, independently of PC.layout.check:
//   every requested room exactly once; inside the footprint; no overlap with rooms, stair or lift (0.011 m tolerance);
//   sides >= 1.5 m; aspect <= 3; area within 25 %; the core block where A-8 puts it (Q14: left = low x seen from the
//   street, front = low y); unmet pairs = A-8 adjacency (touch within 0.02 m along 0.5 m or more); 0.5 m snap kept
//   exactly when the snapped layout is still valid and loses no shared wall; deterministic.
// No-layout cases are checked against QA's own exhaustive search over A-8's cells with per-room areas within 25 %.
// Run: node tests/qa/f3-t1-plans.mjs [--sweep=N]   (--no-shots accepted and ignored)
import { collector } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';

const R = collector('F3-T1 plans');
const PC = Q.loadPC();
// F3-T2 (marker PC.stages.MAX_BUILT >= 5; A-8 step 8): after a failed first pass (cell scale 0.8-1.2) the generator
// retries once with PC.C.LAYOUT.retry (0.75-1.25). QA compares every result with the first pass (retry switched off in
// this vm copy): a first-pass success must come out unchanged; a retried success must pass QA's oracle.
const EDITOR = PC.stages.MAX_BUILT >= 5;
// first pass alone: the retry range is set to the first-pass range (0.8-1.2), so a retry repeats the first pass and finds nothing new
function firstPass(inp) { const L = PC.C.LAYOUT, keep = L.retry; if (!keep) return { err: 'PC.C.LAYOUT.retry missing' }; try { L.retry = { ...keep, fMin: L.fMin, fMax: L.fMax }; return PC.layout.generate(inp); } catch (e) { return { err: String(e) }; } finally { L.retry = keep; } }
const N = Number((process.argv.find((a) => a.startsWith('--sweep=')) || '').slice(8)) || 2000;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const TOL = 0.011, MIN = 1.5;
const floor05 = (x) => Math.floor(x * 2 + 1e-9) / 2;

// ---------- QA's core block (A-8 step 1) ----------
// stair 2.5 x 4.0, long side along the longer footprint axis; lift 1.5 x 2.0 beside it across the band; the block
// centred and snapped down to 0.5 m, or flush in the named corner (f = low y, b = high y, l = low x, r = high x).
function coreProblems(W, D, inp, core) {
  const f = [];
  if (!inp.stairs) { if (core.stair || core.lift) f.push('core present without stairs'); return f; }
  const s = core.stair; if (!s) return ['no stair'];
  const alongY = D >= W, long = alongY ? s.h : s.w, short = alongY ? s.w : s.h;
  if (Math.abs(long - 4) > 1e-9 || Math.abs(short - 2.5) > 1e-9) f.push(`stair ${s.w} x ${s.h} (4.0 m must run along the ${alongY ? 'y' : 'x'} axis)`);
  const l = core.lift; if (!!l !== !!inp.lift) f.push(`lift ${l ? 'present' : 'missing'}`);
  let bx = [s.x, s.x + s.w], by = [s.y, s.y + s.h];
  if (l) { if (!eq([Math.min(l.w, l.h), Math.max(l.w, l.h)], [1.5, 2])) f.push(`lift ${l.w} x ${l.h}`);
    // beside the stair across the band: touching it on a side facing the shorter axis, inside the stair's span along the longer axis
    const touch = alongY ? (Math.abs(l.x - (s.x + s.w)) < 1e-9 || Math.abs(l.x + l.w - s.x) < 1e-9) && l.y >= s.y - 1e-9 && l.y + l.h <= s.y + s.h + 1e-9
      : (Math.abs(l.y - (s.y + s.h)) < 1e-9 || Math.abs(l.y + l.h - s.y) < 1e-9) && l.x >= s.x - 1e-9 && l.x + l.w <= s.x + s.w + 1e-9;
    if (!touch) f.push('lift not beside the stair across the band'); bx = [Math.min(bx[0], l.x), Math.max(bx[1], l.x + l.w)]; by = [Math.min(by[0], l.y), Math.max(by[1], l.y + l.h)]; }
  const bw = bx[1] - bx[0], bd = by[1] - by[0], p = inp.stairPos;
  const want = p === 'centre' ? [floor05((W - bw) / 2), floor05((D - bd) / 2)] : [p[1] === 'l' ? 0 : W - bw, p[0] === 'f' ? 0 : D - bd];
  if (Math.abs(bx[0] - want[0]) > 1e-9 || Math.abs(by[0] - want[1]) > 1e-9) f.push(`core block at (${bx[0]}, ${by[0]}), expected (${want}) for ${p}`);
  return f;
}
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > TOL && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > TOL;
// A-8: adjacent when they touch within 0.02 m along 0.5 m or more
function adj(a, b) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const gx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w), gy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
  return (Math.abs(gx) <= 0.02 && oy >= 0.5 - 1e-9) || (Math.abs(gy) <= 0.02 && ox >= 0.5 - 1e-9);
}
function layoutProblems(W, D, inp, core, rooms) {
  const f = [], want = Object.fromEntries(inp.rooms.map((r) => [r.id, r.area])), seen = {};
  for (const r of rooms) { if (!(r.id in want)) { f.push(`unknown room ${r.id}`); continue; } if (seen[r.id]) f.push(`room ${r.id} twice`); seen[r.id] = true;
    if (r.x < -TOL || r.y < -TOL || r.x + r.w > W + TOL || r.y + r.h > D + TOL) f.push(`${r.id} outside the ${W} x ${D} footprint`);
    if (Math.min(r.w, r.h) < MIN - 1e-6) f.push(`${r.id} side ${Math.min(r.w, r.h)} < 1.5 m`);
    if (Math.max(r.w, r.h) / Math.min(r.w, r.h) > 3 + 1e-6) f.push(`${r.id} aspect ${(Math.max(r.w, r.h) / Math.min(r.w, r.h)).toFixed(2)} > 3`);
    if (Math.abs(r.w * r.h - want[r.id]) > 0.25 * want[r.id] + 1e-6) f.push(`${r.id} area ${(r.w * r.h).toFixed(1)} vs ${want[r.id]} (over 25 %)`);
    for (const k of ['stair', 'lift']) if (core[k] && overlap(r, core[k])) f.push(`${r.id} overlaps the ${k}`); }
  for (const id in want) if (!seen[id]) f.push(`room ${id} missing`);
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) if (overlap(rooms[i], rooms[j])) f.push(`${rooms[i].id} overlaps ${rooms[j].id}`);
  return f;
}
const unmetOf = (pairs, rooms) => { const by = Object.fromEntries(rooms.map((r) => [r.id, r])); return pairs.filter((p) => !(by[p[0]] && by[p[1]] && adj(by[p[0]], by[p[1]]))); };
const onGrid = (rooms) => rooms.every((r) => [r.x, r.y, r.x + r.w, r.y + r.h].every((v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-6));
const snapOf = (rooms) => rooms.map((r) => { const s = (v) => Math.round(v * 2) / 2, x = s(r.x), y = s(r.y); return { id: r.id, x, y, w: s(r.x + r.w) - x, h: s(r.y + r.h) - y }; });

// ---------- QA's own search: is there any valid layout in A-8's cells? ----------
// Cells (A-8 step 2) from QA's core; rooms assigned to cells; inside a cell, rooms in columns (either direction), each
// room's area free within 25 % (A-8's generator uses one scale factor per cell; this search is wider on purpose).
function myCells(W, D, core) {
  if (!core.stair) return [{ x: 0, y: 0, w: W, h: D }];
  const blk = [core.stair, core.lift].filter(Boolean), x0 = Math.min(...blk.map((b) => b.x)), y0 = Math.min(...blk.map((b) => b.y)), x1 = Math.max(...blk.map((b) => b.x + b.w)), y1 = Math.max(...blk.map((b) => b.y + b.h));
  const c = D >= W ? [[0, 0, W, y0], [0, y0, x0, y1 - y0], [x1, y0, W - x1, y1 - y0], [0, y1, W, D - y1]] : [[0, 0, x0, D], [x0, 0, x1 - x0, y0], [x0, y1, x1 - x0, D - y1], [x1, 0, W - x1, D]];
  return c.filter((q) => q[2] >= MIN - 1e-9 && q[3] >= MIN - 1e-9).map((q) => ({ x: q[0], y: q[1], w: q[2], h: q[3] }));
}
function cellFits(cell, areas, lo = 0.75, hi = 1.25) { // areas: room areas of this cell; each room's area free in [lo, hi] x its target
  const k = areas.length; if (!k) return true;
  for (const [C, Lc] of [[cell.w, cell.h], [cell.h, cell.w]]) {
    // minimal column thickness for every group (bitmask)
    const tmin = new Array(1 << k).fill(Infinity);
    for (let g = 1; g < 1 << k; g++) { for (let t = MIN; t <= C + 1e-9; t += 0.05) { let sum = 0, ok = true;
        for (let i = 0; i < k && ok; i++) if (g >> i & 1) { const a0 = Math.max(MIN, t / 3, lo * areas[i] / t), a1 = Math.min(3 * t, hi * areas[i] / t); if (a0 > a1 + 1e-9) ok = false; else sum += a0; }
        if (ok && sum <= Lc + 1e-9) { tmin[g] = t; break; } } }
    const best = new Array(1 << k).fill(Infinity); best[0] = 0;
    for (let S = 1; S < 1 << k; S++) { const low = S & -S; for (let G = S; G; G = (G - 1) & S) if (G & low && tmin[G] + best[S ^ G] < best[S]) best[S] = tmin[G] + best[S ^ G]; }
    if (best[(1 << k) - 1] <= C + 1e-9) return true;
  }
  return false;
}
function mySearch(W, D, inp, core, lo = 0.75, hi = 1.25) {
  const cells = myCells(W, D, core), rooms = inp.rooms.slice().sort((a, b) => b.area - a.area), memo = new Map();
  const fits = (ci, list) => { const key = ci + ':' + list.map((r) => r.area).sort().join(); if (!memo.has(key)) memo.set(key, cellFits(cells[ci], list.map((r) => r.area), lo, hi)); return memo.get(key); };
  const load = cells.map(() => []);
  const dfs = (i) => { if (i === rooms.length) return load.every((l, ci) => fits(ci, l));
    for (let ci = 0; ci < cells.length; ci++) { const l = load[ci]; if (l.reduce((s, r) => s + lo * r.area, 0) + lo * rooms[i].area > cells[ci].w * cells[ci].h + 1e-9) continue; l.push(rooms[i]); if (fits(ci, l) && dfs(i + 1)) { l.pop(); return true; } l.pop(); }
    return false; };
  return dfs(0);
}

// ---------- seeded programmes ----------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TYPES = Object.keys(Q.ROOM_AREA), POS = ['centre', 'fl', 'fr', 'bl', 'br'];
// F4-T2 QA-first (CD-4): rooms per floor = PC.C.MAX_ROOMS_PER_LEVEL of the build (8 today, 10 after Step 0.1); pairs stay 6.
const MAXR = PC.C.MAX_ROOMS_PER_LEVEL;
function programme(r, W, D) {
  const stairs = r() < 0.85, lift = stairs && r() < 0.35, pos = POS[Math.floor(r() * 5)], fill = 0.3 + r() * 0.7;
  const coreA = stairs ? 10 + (lift ? 3 : 0) : 0, target = fill * (W * D - coreA), rooms = []; let sum = 0, id = 1;
  while (rooms.length < MAXR && sum < target) { const t = TYPES[Math.floor(r() * TYPES.length)], ex = r() < 0.15; const a = ex ? Math.round((4 + r() * 40) * 2) / 2 : Q.ROOM_AREA[t]['SML'[Math.floor(r() * 3)]]; if (sum + a > target * 1.05 && rooms.length) break; rooms.push({ id: 'r' + id++, area: a }); sum += a; }
  const pairs = []; const np = Math.floor(r() * Math.min(7, rooms.length)); for (let k = 0; k < np; k++) { const a = rooms[Math.floor(r() * rooms.length)].id, b = rooms[Math.floor(r() * rooms.length)].id; if (a !== b && !pairs.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))) pairs.push(PC.store.cmpId(a, b) < 0 ? [a, b] : [b, a]); }
  return { W, D, rooms, pairs, stairs, stairPos: pos, lift, fill: sum / (W * D - coreA) };
}
function judge(inp, tag, pr, stats) {
  const t0 = process.hrtime.bigint(), out = PC.layout.generate(inp), ms = Number(process.hrtime.bigint() - t0) / 1e6, W = inp.W, D = inp.D;
  stats.n++; stats.worst = Math.max(stats.worst, ms);
  if (EDITOR) { const fp = firstPass(inp); stats.retryChecked = (stats.retryChecked || 0) + 1;
    if (fp.err) { stats.retryErr = fp.err; }
    else if (fp.ok) { if (!eq(fp, out)) pr.push(`${tag}: a first-pass success changed with the retry in place`); }
    else if (out.ok) stats.retried = (stats.retried || 0) + 1; }
  pr.push(...coreProblems(W, D, inp, out.core).map((x) => `${tag}: ${x}`));
  if (!out.ok) { stats.none++; const bin = inp.fill > 0.85 ? 'high' : 'low'; stats[bin + 'None']++;
    if (inp.rooms.length <= 8) { if (mySearch(W, D, inp, out.core, 0.8, 1.2)) stats.missed08++; if (mySearch(W, D, inp, out.core)) { stats.missed++; stats.missedList.push(`${tag} (${W} x ${D}, ${inp.rooms.map((r) => r.area).join('/')}, ${inp.stairs ? inp.stairPos + (inp.lift ? '+lift' : '') : 'no stairs'}, fill ${(inp.fill * 100).toFixed(0)} %)`); } }
    return out; }
  pr.push(...layoutProblems(W, D, inp, out.core, out.rooms).map((x) => `${tag}: ${x}`));
  const mine = unmetOf(inp.pairs, out.rooms); if (!eq(mine.map(String).sort(), out.unmet.map(String).sort())) pr.push(`${tag}: unmet ${JSON.stringify(out.unmet)}, my adjacency ${JSON.stringify(mine)}`);
  if (onGrid(out.rooms)) stats.snapped++; else { const s = snapOf(out.rooms); if (!layoutProblems(W, D, inp, out.core, s).length && unmetOf(inp.pairs, s).length <= mine.length) pr.push(`${tag}: left unsnapped although the 0.5 m snap is valid and loses no wall`); }
  if (out.unmet.length) stats.unmet++;
  if (!mySearch(W, D, inp, out.core) && inp.rooms.length) stats.searchNarrow++;   // my search should find what the app found
  return out;
}

const t0 = Date.now();
// ================= 1. sample levels (6.2): valid, zero unmet, deterministic =================
{ const s = Q.plain(PC.sample.state()), pr = [];
  for (const id of ['G', '1']) { const inp = PC.plans.input(s, id), st = { n: 0, worst: 0, none: 0, lowNone: 0, highNone: 0, missed: 0, missed08: 0, missedList: [], snapped: 0, unmet: 0, searchNarrow: 0 };
    const a = judge(inp, `sample ${id}`, pr, st), b = PC.layout.generate(inp);
    if (!a.ok) pr.push(`sample ${id}: no layout`); else if (a.unmet.length) pr.push(`sample ${id}: unmet ${JSON.stringify(a.unmet)}`);
    if (!eq(a, b)) pr.push(`sample ${id}: second run differs`);
    R.note(`sample ${id}: ${a.ok ? a.rooms.map((r) => `${r.id} ${r.w}x${r.h}@${r.x},${r.y}`).join(' | ') : 'no layout'}; stair ${JSON.stringify(a.core.stair)}`); }
  R.check('1 sample: both levels laid out, valid by my oracle, zero unmet pairs, core where A-8 puts it, deterministic', pr); }

// ================= 2. maximum levels: MAXR rooms + lift at all five stair positions =================
{ const s = Q.plain(PC.sample.state()); s.ans.footprintPct = 50; const fp = PC.site.analyse(s).footprint, pr = [];
  const rooms = [['bedroom', 'M'], ['bedroom', 'M'], ['bathroom', 'S'], ['bathroom', 'M'], ['office', 'S'], ['storage', 'S'], ['laundry', 'S'], ['living', 'M'], ['storage', 'S'], ['bathroom', 'S']].slice(0, MAXR).map(([t, z], i) => ({ id: 'r' + (i + 1), area: Q.ROOM_AREA[t][z] }));
  const pairs = [['r1', 'r3'], ['r2', 'r4'], ['r5', 'r6'], ['r7', 'r8']];
  for (const pos of POS) for (const lift of [false, true]) { const inp = { W: fp.w, D: fp.d, rooms, pairs, stairs: true, stairPos: pos, lift }, st = { n: 0, worst: 0, none: 0, lowNone: 0, highNone: 0, missed: 0, missed08: 0, missedList: [], snapped: 0, unmet: 0, searchNarrow: 0 };
    const out = judge(inp, `max ${pos}${lift ? '+lift' : ''}`, pr, st); if (!out.ok) pr.push(`max ${pos}${lift ? '+lift' : ''}: no layout (fill ${(st.n && inp.rooms.reduce((a, r) => a + r.area, 0) / (fp.w * fp.d - 13) * 100).toFixed(0)} %)`); }
  R.check(`2 maximum level (${MAXR} rooms, ${fp.w} x ${fp.d} m footprint): laid out and valid at all 5 stair positions, with and without lift`, pr); }

// ================= 3. footprints up to 3:1 plus one step, both directions =================
{ const pr = [], st = { n: 0, worst: 0, none: 0, lowNone: 0, highNone: 0, missed: 0, missed08: 0, missedList: [], snapped: 0, unmet: 0, searchNarrow: 0 }, r = rng(31);
  for (const [W, D] of [[6, 18.5], [18.5, 6], [4, 12.5], [12.5, 4], [6, 18], [18, 6], [15, 5], [5, 15], [2.5, 8], [8, 2.5]]) for (let k = 0; k < 12; k++) judge(programme(r, W, D), `${W} x ${D} #${k}`, pr, st);
  R.check(`3 footprints up to 3:1 + one step, both directions: ${st.n} programmes, every layout valid by my oracle (no-layout ${st.none}; my search found a layout in ${st.missed} of those, ${st.missed08} within 0.8-1.2)`, pr);
  R.note(`3:1 footprints: ${st.n} programmes, no-layout ${st.none}, unmet-pair layouts ${st.unmet}, my search found a layout the app missed in ${st.missed}${st.missedList.length ? ': ' + st.missedList.slice(0, 3).join('; ') : ''}`); }

// ================= 4. seeded sweep =================
{ const pr = [], st = { n: 0, worst: 0, none: 0, lowNone: 0, highNone: 0, missed: 0, missed08: 0, missedList: [], snapped: 0, unmet: 0, searchNarrow: 0 }, r = rng(2026), det = []; let lowN = 0, highN = 0;
  for (let k = 0; k < N; k++) { const W = 4 + Math.round(r() * 32) / 2, D = 4 + Math.round(r() * 32) / 2, inp = programme(r, W, D); if (inp.fill > 0.85) highN++; else lowN++; const out = judge(inp, `sweep #${k}`, pr, st);
    if (k % 10 === 0 && !eq(out, PC.layout.generate(inp))) det.push(`sweep #${k}`); }
  R.check(`4 sweep: ${st.n} seeded programmes (1-${MAXR} rooms, 0-6 pairs, 5 stair positions, lift, fill 30-100 %): every layout valid by my oracle, unmet pairs match my adjacency, snap kept exactly when valid`, pr);
  R.check(`4 sweep: deterministic (${Math.ceil(N / 10)} programmes run twice)`, det);
  // A-8 is a heuristic (one scale factor 0.8-1.2 per cell, two thickness candidates per column); the product rule is
  // only "area within 25 %". So a no-layout my wider search can solve is reported as a rate, not failed; my search
  // must however find every layout the app finds (else it is not a valid judge).
  R.check(`4 sweep: my search finds a layout wherever the app found one (judge sanity; ${st.searchNarrow} misses)`, st.searchNarrow === 0);
  R.note(`no-layout vs my search: app no-layout ${st.none}; my search (rooms within 25 %) finds a layout in ${st.missed} (${(st.missed / Math.max(1, st.none) * 100).toFixed(0)} %), with the generator's own 0.8-1.2 range per room in ${st.missed08}; e.g. ${st.missedList.slice(0, 4).join('; ')}`);
  R.check(`4 sweep: slowest generation ${st.worst.toFixed(0)} ms (< 500)`, st.worst < 500 ? [] : ['too slow']);
  if (EDITOR) R.check(`4 retry (A-8 step 8): PC.C.LAYOUT.retry present, first-pass successes unchanged, retried successes valid by my oracle (${st.retried || 0} layouts found only by the retry)`, (PC.C.LAYOUT.retry === undefined ? ['PC.C.LAYOUT.retry missing'] : []).concat(st.retryErr ? [`first pass could not be isolated: ${st.retryErr}`] : []));
  R.note(`sweep: ${st.n} programmes; no-layout ${st.lowNone} of ${lowN} at fill <= 85 % (${(st.lowNone / Math.max(1, lowN) * 100).toFixed(1)} %), ${st.highNone} of ${highN} above (${(st.highNone / Math.max(1, highN) * 100).toFixed(1)} %); layouts with unmet pairs ${st.unmet}; on the 0.5 m grid ${st.snapped}; layouts found by the app but outside my search family ${st.searchNarrow}; slowest ${st.worst.toFixed(0)} ms`); }

// ================= 5. sync (A-7) and the R5 risk set (PM round 5) =================
{ const base = () => { const s = Q.plain(PC.sample.state()); s.plans = {}; PC.plans.sync(s); return s; }, pr = [];
  const regen = (s0, mut) => { const s = Q.plain(s0); mut(s); PC.plans.sync(s); return Object.keys(s.plans).filter((id) => !eq(s.plans[id], s0.plans[id]) || !s0.plans[id]).concat(Object.keys(s0.plans).filter((id) => !s.plans[id]).map((id) => '-' + id)).sort(); };
  const s0 = base(); s0.plans.G.approved = true; s0.plans.G.edited = true; s0.plans['1'].approved = true;
  const first = s0.ans.rooms.find((r) => r.level === '1' && !r.master);
  for (const [name, mut, want] of [
    ['first-floor room size change', (s) => { s.ans.rooms.find((r) => r.id === first.id).size = 'L'; }, ['1']],
    ['Q3 footprint 25 -> 30 %', (s) => { s.ans.footprintPct = 30; }, ['1', 'G']],
    ['Q6 street edge', (s) => { s.ans.streetEdge = 1; }, ['1', 'G']],
    ['stair position', (s) => { s.ans.stairPos = 'bl'; }, ['1', 'G']],
    ['lift', (s) => { s.ans.lift = true; }, ['1', 'G']],
    ['back setback 2 -> 2.25 m (moves only)', (s) => { s.ans.setbacks.back = 2.25; }, []],
    ['exterior (appearance)', (s) => { s.ans.exterior = 'white'; }, []],
    ['second floor removed: 2 -> 1 floor (rooms deleted first)', (s) => { s.ans.floors = 1; s.ans.rooms = s.ans.rooms.filter((r) => r.level !== '1'); s.ans.pairs = s.ans.pairs.filter((p) => p.every((id) => s.ans.rooms.some((r) => r.id === id))); }, ['-1', 'G']],
    ['open plot (Undo reopens)', (s) => { s.plot.closed = false; s.ans.streetEdge = null; }, []]]) {
    const got = regen(s0, mut); if (!eq(got, want)) pr.push(`${name}: regenerated ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); }
  R.check('5 sync regenerates exactly the stale levels: room change only First; Q3 / Q6 / stair / lift all; move-only and appearance none; a removed level loses its plan; an open plot leaves plans alone', pr);
  // regenerated plans are fresh Drafts; kept ones keep edits and approval
  { const s = Q.plain(s0); s.ans.rooms.find((r) => r.id === first.id).size = 'L'; PC.plans.sync(s); R.check('5 regenerated First is a fresh Draft; Ground keeps approved + edited', s.plans['1'].approved === false && s.plans['1'].edited === false && s.plans.G.approved && s.plans.G.edited && s.plans['1'].sig === PC.sig.level(s, '1')); }
  // R5 risk set: only edited or approved plans
  { const S = PC.store, f = []; const st = base(); S.replace(st);
    const cand = (mut) => { const c = Q.plain(S.get()); mut(c); return c; };
    if (S.atRisk(cand((c) => { c.ans.footprintPct = 30; })).length) f.push('untouched Drafts are at risk');
    S.commit((d) => { d.plans.G.approved = true; }, { nav: true });
    if (!eq(S.atRisk(cand((c) => { c.ans.footprintPct = 30; })), ['G'])) f.push('approved Ground not the only level at risk: ' + JSON.stringify(S.atRisk(cand((c) => { c.ans.footprintPct = 30; }))));
    S.commit((d) => { d.plans['1'].edited = true; }, { nav: true });
    if (!eq(S.atRisk(cand((c) => { c.ans.rooms.find((r) => r.id === first.id).size = 'L'; })), ['1'])) f.push('a First-floor room change should put only the edited First at risk');
    if (S.atRisk(cand((c) => { c.ans.setbacks.back = 2.25; })).length) f.push('move-only change at risk');
    R.check('5 R5 risk set (PM round 5): untouched Drafts never; approved / edited levels only when their own plan goes stale', f); } }

// ================= 6. go(3) timing on the maximum house =================
{ const s = Q.plain(PC.sample.state()); s.ans.basement = true; s.ans.floors = 3; s.ans.footprintPct = 50; s.ans.lift = true; let id = 30;
  for (const lv of ['B', '2', 'G', '1']) while (s.ans.rooms.filter((r) => r.level === lv).length < MAXR) s.ans.rooms.push({ id: 'r' + id++, type: 'storage', level: lv, size: 'S', area: null, master: false });
  s.ans.nextRoomId = id; s.plans = {}; s.stage = 2; PC.store.replace(s); let best = 1e9;
  for (let k = 0; k < 3; k++) { PC.store.replace({ ...Q.plain(PC.store.get()), plans: {}, stage: 2 }); PC.stages.MAX_BUILT = Math.max(PC.stages.MAX_BUILT, 3); const t = process.hrtime.bigint(); PC.store.go(3); best = Math.min(best, Number(process.hrtime.bigint() - t) / 1e6); }
  const st = PC.store.get(), pr = []; if (st.stage !== 3) pr.push('stage ' + st.stage);
  for (const lv of ['B', 'G', '1', '2']) { const p = st.plans[lv]; if (!p) { pr.push(lv + ': no plan'); continue; } if (p.sig !== PC.sig.level(st, lv)) pr.push(lv + ': stale'); if (!p.error) pr.push(...layoutProblems(...(() => { const inp = PC.plans.input(st, lv); return [inp.W, inp.D, inp, PC.layout.core(inp.W, inp.D, inp.stairs, inp.stairPos, inp.lift), p.rooms]; })()).map((x) => lv + ': ' + x)); }
  const cores = ['B', 'G', '1', '2'].map((lv) => { const inp = PC.plans.input(st, lv); return JSON.stringify(PC.layout.generate(inp).core); });
  if (new Set(cores).size !== 1) pr.push('stair / lift differ between levels');
  R.check(`6 maximum house (basement + 3 floors, ${MAXR} rooms each, lift): go(3) lays out every level in ${best.toFixed(0)} ms (best of 3, < 500), plans valid, one identical core on every level`, best < 500 ? pr : pr.concat([`${best} ms`]));
  R.note(`maximum house: go(3) best of 3 ${best.toFixed(0)} ms; ${['B', 'G', '1', '2'].map((lv) => `${lv} ${st.plans[lv] && (st.plans[lv].error || 'ok, unmet ' + st.plans[lv].unmet.length)}`).join(', ')}`); }

// ================= 7. F3-T2 retry cases (A-8 step 8; PM 4.4 row) =================
if (EDITOR) { const pr = [], st = { n: 0, worst: 0, none: 0, lowNone: 0, highNone: 0, missed: 0, missed08: 0, missedList: [], snapped: 0, unmet: 0, searchNarrow: 0 };
  // QA's F3-T1 case: one 30 m² room on a 5 x 8.5 m footprint, stair front-left: the free rectangle beside the stair is 22.5 m² (-25 %)
  for (const [W, D, pos] of [[5, 8.5, 'fl'], [8.5, 5, 'fl']]) { const inp = { W, D, rooms: [{ id: 'r1', area: 30 }], pairs: [], stairs: true, stairPos: pos, lift: false, fill: 0 };
    const fp = firstPass(inp), out = judge(inp, `30 m² on ${W} x ${D}`, pr, st); if (!out.ok) pr.push(`30 m² on ${W} x ${D}: no layout`); else if (fp.ok) pr.push(`30 m² on ${W} x ${D}: laid out by the first pass already (expected only by the retry)`); }
  // a failing maximum level (8 rooms + lift, area-valid sum but no layout): first pass + retry within 600 ms (best of 3)
  const s = Q.plain(PC.sample.state()), fpr = PC.site.analyse(s).footprint, rooms = Array.from({ length: 8 }, (_, i) => ({ id: 'r' + (i + 1), area: i < 3 ? 36 : 4 }));   // 128 m² of 142.5 (area-valid at 0.75), no layout (probed)
  const inp = { W: fpr.w, D: fpr.d, rooms, pairs: [['r1', 'r2'], ['r3', 'r4']], stairs: true, stairPos: 'centre', lift: true }; let best = 1e9, res = null;
  for (let k = 0; k < 3; k++) { const t = process.hrtime.bigint(); res = PC.layout.generate(inp); best = Math.min(best, Number(process.hrtime.bigint() - t) / 1e6); }
  R.check(`7 retry: QA's 30 m² room on 5 x 8.5 m (stair front-left) lays out only through the retry, both orientations, valid by my oracle; a failing maximum level (8 rooms + lift on ${fpr.w} x ${fpr.d}) answers in ${best.toFixed(0)} ms (< 600, best of 3)`, (res.ok ? ['timing case laid out: pin another failing level'] : []).concat(best < 600 ? pr : pr.concat([`${best} ms`])));
  R.note(`retry timing case: ${res.ok ? 'laid out' : 'no layout'} in ${best.toFixed(0)} ms`); }

R.note(`runtime ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
