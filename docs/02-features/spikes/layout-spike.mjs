// TL spike (non-binding reference for F3-T1): proves the "cells + column partitions + exhaustive assignment" generator.
// Run: node docs/02-features/spikes/layout-spike.mjs
const STAIR = { w: 2.5, d: 4 }, LIFT = { w: 1.5, d: 2 }, MIN = 1.5, MAXASP = 3, FMIN = 0.8, FMAX = 1.2;
const r2 = x => Math.round(x * 100) / 100;

// footprint W (u) x D (v). Returns core rects + free cells, all in footprint-local coords.
function coreAndCells(W, D, stairs, pos, lift) {
  if (!stairs) return { stair: null, lift: null, cells: [{ id: 'A', x: 0, y: 0, w: W, h: D }] };
  const alongV = D >= W;                       // stair long side along the longer footprint axis
  const sw = alongV ? STAIR.w : STAIR.d, sd = alongV ? STAIR.d : STAIR.w;
  const lw = alongV ? LIFT.w : LIFT.d, ld = alongV ? LIFT.d : LIFT.w;
  // core block bbox (stair + lift side by side across the band)
  const cw = alongV ? sw + (lift ? lw : 0) : sw, cd = alongV ? sd : sd + (lift ? ld : 0);
  const snap = x => Math.floor(x * 2) / 2;
  let cx, cy;
  if (pos === 'centre') { cx = snap((W - cw) / 2); cy = snap((D - cd) / 2); }
  else { cx = pos[1] === 'l' ? 0 : W - cw; cy = pos[0] === 'f' ? 0 : D - cd; }
  const stair = { x: cx, y: cy, w: sw, d: sd };
  const lf = lift ? (alongV ? { x: cx + sw, y: cy, w: lw, d: ld } : { x: cx, y: cy + sd, w: lw, d: ld }) : null;
  const cells = [];
  const add = (id, x, y, w, h) => { if (w >= MIN - 1e-9 && h >= MIN - 1e-9) cells.push({ id, x, y, w, h }); };
  if (alongV) { add('F', 0, 0, W, cy); add('CL', 0, cy, cx, cd); add('CR', cx + cw, cy, W - cx - cw, cd); add('B', 0, cy + cd, W, D - cy - cd); }
  else { add('F', 0, 0, cx, D); add('CL', cx, 0, cw, cy); add('CR', cx, cy + cd, cw, D - cy - cd); add('B', cx + cw, 0, W - cx - cw, D); }
  return { stair, lift: lf, cells };
}

// best column-partition layouts of rooms (sorted desc) in a cell; returns null if none valid
// CTO review round 1: an under-filled cell is also tried trimmed to 1.2 x its rooms' area (along w, along h),
// so a big room is not stretched across a cell it cannot fill. Best of full / trimmed-w / trimmed-h wins.
function layoutCell(cell, rooms) {
  if (!rooms.length) return { score: 0, rects: [] };
  const sum = rooms.reduce((s, r) => s + r.area, 0), shapes = [cell];
  if (cell.w * cell.h > FMAX * sum) {
    const tw = FMAX * sum / cell.h, th = FMAX * sum / cell.w;
    if (tw >= MIN) shapes.push({ ...cell, w: tw }); if (th >= MIN) shapes.push({ ...cell, h: th });
  }
  let best = null;
  for (const sh of shapes) { const l = layoutShape(sh, rooms); if (l && (!best || l.score < best.score - 1e-9)) best = l; }
  return best;
}
function layoutShape(cell, rooms) {
  const sum = rooms.reduce((s, r) => s + r.area, 0), ca = cell.w * cell.h;
  const fFill = Math.min(FMAX, ca / sum + 1e-12); if (fFill < FMIN - 1e-9) return null;
  const n = rooms.length; let best = null;
  for (const f of fFill > 1 ? [fFill, 1] : [fFill])
  for (let axis = 0; axis < 2; axis++) {          // 0: columns advance along x, 1: along y
    const L = axis ? cell.h : cell.w, S = axis ? cell.w : cell.h;
    for (let mask = 0; mask < (1 << (n - 1)); mask++) {
      // each group = one column. Thickness candidates: full span (rooms fill the cross dimension) or
      // "square-ish" (largest room square, hall left at the column end). Cheapest valid one per group.
      const cols = []; let ok = true, i = 0, minTotal = 0;
      while (i < n && ok) {
        let j = i; while (j < n - 1 && !(mask & (1 << j))) j++;
        const grp = rooms.slice(i, j + 1), A = grp.reduce((s, r) => s + r.area * f, 0);
        const evalT = t => { let sc = 0; for (const r of grp) { const len = r.area * f / t, a = Math.max(t, len) / Math.min(t, len);
          if (t < MIN - 1e-6 || len < MIN - 1e-6 || a > MAXASP + 1e-6) return null; sc += a - 1; } return { t, sc }; };
        const full = evalT(A / S), tsq = Math.sqrt(grp[0].area * f), sq = A / tsq <= S + 1e-9 && tsq > A / S ? evalT(tsq) : null;
        if (!full && !sq) { ok = false; break; }
        cols.push({ grp, full, sq }); minTotal += (full || sq).t; i = j + 1;
      }
      if (!ok || minTotal > L + 1e-6) continue;
      // upgrade columns to the square-ish option while the cell length allows it (in order: deterministic)
      let total = minTotal; const pick = cols.map(c => c.full || c.sq);
      cols.forEach((c, k) => { if (c.full && c.sq && c.sq.sc < c.full.sc - 1e-9 && total - c.full.t + c.sq.t <= L + 1e-6) { total += c.sq.t - c.full.t; pick[k] = c.sq; } });
      let pos = 0, score = 4 * Math.abs(f - 1) * n; const rects = [];
      cols.forEach((c, k) => { const t = pick[k].t; let off = 0; score += pick[k].sc;
        for (const r of c.grp) { const len = r.area * f / t;
          rects.push(axis ? { id: r.id, x: off, y: pos, w: len, h: t } : { id: r.id, x: pos, y: off, w: t, h: len }); off += len; }
        pos += t; });
      if (!best || score < best.score - 1e-9) best = { score, rects, f };
    }
  }
  return best;
}
const variants = (cell, lay) => [0, 1, 2, 3].map(m => lay.rects.map(r => ({
  id: r.id, w: r.w, h: r.h,
  x: r2(cell.x + (m & 1 ? cell.w - r.x - r.w : r.x)), y: r2(cell.y + (m & 2 ? cell.h - r.y - r.h : r.y)) })));
function adjacent(a, b) {
  const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
  const e = 0.02;
  if (Math.abs(a.x + a.w - b.x) < e || Math.abs(b.x + b.w - a.x) < e) return ov(a.y, a.y + a.h, b.y, b.y + b.h) >= 0.5;
  if (Math.abs(a.y + a.h - b.y) < e || Math.abs(b.y + b.h - a.y) < e) return ov(a.x, a.x + a.w, b.x, b.x + b.w) >= 0.5;
  return false;
}
export function generate(W, D, rooms, pairs, stairs, pos, lift) {
  // order 1: area desc. order 2: same, but each paired room pulled directly behind its partner.
  const desc = [...rooms].sort((a, b) => b.area - a.area || (a.id < b.id ? -1 : 1));
  const a = generateOrdered(W, D, desc, pairs, stairs, pos, lift);
  if (!pairs.length || (a.ok && !a.unmet.length)) return a;
  const bumped = [...desc];
  for (const [p, q] of pairs) {
    const i = bumped.findIndex(r => r.id === p), j = bumped.findIndex(r => r.id === q);
    const lo = Math.min(i, j), hi = Math.max(i, j); const [m] = bumped.splice(hi, 1); bumped.splice(lo + 1, 0, m);
  }
  const b = generateOrdered(W, D, bumped, pairs, stairs, pos, lift);
  return b.ok && (!a.ok || b.score < a.score - 1e-9) ? b : a;
}
function generateOrdered(W, D, rs, pairs, stairs, pos, lift) {
  const { stair, lift: lf, cells } = coreAndCells(W, D, stairs, pos, lift);
  const n = rs.length, k = cells.length, memo = new Map();
  const cellLay = (c, mask) => { const key = c * 256 + mask; if (!memo.has(key)) memo.set(key, layoutCell(cells[c], rs.filter((_, i) => mask & (1 << i)))); return memo.get(key); };
  const cands = []; const asg = new Array(n).fill(0); const used = new Array(k).fill(0);
  (function dfs(i) {
    if (i === n) {
      const masks = new Array(k).fill(0); asg.forEach((c, r) => masks[c] |= 1 << r);
      let score = 0; for (let c = 0; c < k; c++) { const l = cellLay(c, masks[c]); if (!l) return; score += l.score; }
      if (stairs && cells.some((c, ci) => c.id[0] === 'C' && !masks[ci])) score -= 2;   // keep a hall beside the stair
      cands.push({ score, masks }); return;
    }
    for (let c = 0; c < k; c++) {
      if ((used[c] + rs[i].area) * FMIN > cells[c].w * cells[c].h + 1e-9) continue;
      asg[i] = c; used[c] += rs[i].area; dfs(i + 1); used[c] -= rs[i].area;
    }
  })(0);
  if (!cands.length) return { ok: false };
  cands.sort((a, b) => a.score - b.score); // stable
  let best = null;
  for (const cd of cands.slice(0, pairs.length ? 60 : 1)) {
    const vs = cd.masks.map((m, c) => variants(cells[c], cellLay(c, m)));
    const combos = pairs.length ? 4 ** k : 1;
    for (let cb = 0; cb < combos; cb++) {
      const rects = []; for (let c = 0; c < k; c++) rects.push(...vs[c][(cb >> (2 * c)) & 3]);
      const by = Object.fromEntries(rects.map(r => [r.id, r]));
      const unmet = pairs.filter(([a, b]) => !adjacent(by[a], by[b]));
      const score = cd.score + 100 * unmet.length;
      if (!best || score < best.score - 1e-9) best = { score, rects, unmet };
      if (!unmet.length) break;
    }
    if (best && best.unmet.length === 0 && best.score <= cd.score + 1e-9) break;
  }
  return { ok: true, score: best.score, stair, lift: lf, cells, rooms: best.rects, unmet: best.unmet, tried: cands.length };
}
function check(W, D, rooms, res) {
  const errs = []; const obs = [res.stair, res.lift].filter(Boolean).map(o => ({ x: o.x, y: o.y, w: o.w, h: o.d }));
  for (const r of rooms) {
    const g = res.rooms.filter(q => q.id === r.id); if (g.length !== 1) { errs.push('missing ' + r.id); continue; }
    const q = g[0], a = q.w * q.h;
    if (Math.abs(a - r.area) / r.area > 0.25) errs.push(`area ${r.id} ${a.toFixed(1)}/${r.area}`);
    if (Math.min(q.w, q.h) < 1.5 - 1e-6) errs.push('min ' + r.id);
    if (Math.max(q.w, q.h) / Math.min(q.w, q.h) > 3 + 1e-6) errs.push('asp ' + r.id);
    if (q.x < -1e-6 || q.y < -1e-6 || q.x + q.w > W + 0.011 || q.y + q.h > D + 0.011) errs.push('outside ' + r.id);
  }
  const all = [...res.rooms, ...obs];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.011 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.011) errs.push('overlap ' + i + ',' + j);
  }
  return errs;
}
const mk = (arr) => arr.map(([id, area]) => ({ id, area }));
const cases = [
  ['sample ground', 9.5, 15, mk([['living', 42], ['majlis', 24], ['dining', 16], ['kitchen', 14], ['maid', 6], ['bath', 4], ['laundry', 4]]), [['kitchen', 'dining']], true, 'centre', false],
  ['sample first', 9.5, 15, mk([['master', 24], ['bed2', 16], ['bed3', 16], ['family', 30], ['office', 12], ['bath1', 6], ['bath2', 6]]), [['master', 'bath1']], true, 'centre', false],
  ['defaults ground 600m2 30%', 11.5, 15.5, mk([['living', 30], ['kitchen', 14], ['bath', 6]]), [], true, 'centre', false],
  ['max 8 rooms + lift', 12, 18, mk([['a', 42], ['b', 36], ['c', 24], ['d', 24], ['e', 20], ['f', 16], ['g', 9], ['h', 9]]), [['a', 'b'], ['g', 'h'], ['c', 'e']], true, 'centre', true],
  ['8 small', 8, 10, mk([['a', 12], ['b', 9], ['c', 9], ['d', 6], ['e', 6], ['f', 4], ['g', 4], ['h', 4]]), [['a', 'd']], true, 'fl', false],
  ['wide, back-right, lift', 16, 8, mk([['a', 30], ['b', 24], ['c', 16], ['d', 14], ['e', 6], ['f', 6]]), [['d', 'c']], true, 'br', true],
  ['single level no stairs', 10, 12, mk([['a', 30], ['b', 16], ['c', 16], ['d', 14], ['e', 6], ['f', 4]]), [['d', 'a']], false, 'centre', false],
  ['tight 97%', 9.5, 15, mk([['a', 42], ['b', 30], ['c', 24], ['d', 16], ['e', 12], ['f', 4.5]]), [], true, 'centre', false],
  ['CTO low-fill case, no stairs', 8.5, 16.5, mk([['a', 42], ['b', 36], ['c', 16], ['d', 4], ['e', 4]]), [], false, 'centre', false],
  ['1 room', 4, 6, mk([['a', 12]]), [], true, 'centre', false],
];
for (const [name, W, D, rooms, pairs, st, pos, lift] of cases) {
  const t = performance.now(); const res = generate(W, D, rooms, pairs, st, pos, lift); const ms = (performance.now() - t).toFixed(1);
  if (!res.ok) { console.log(name, '-> NO LAYOUT', ms + 'ms'); continue; }
  const errs = check(W, D, rooms, res);
  console.log(name, '->', errs.length ? 'ERR ' + errs.join('; ') : 'valid', '| unmet', JSON.stringify(res.unmet), '| assignments', res.tried, '|', ms + 'ms');
  if (name.startsWith('sample')) console.log(res.rooms.map(r => `   ${r.id} x${r.x} y${r.y} ${r2(r.w)}x${r2(r.h)}`).join('\n'));
}

// Seeded sweep (the F3-T1 acceptance test mirrors this): validated programmes only; prints the failure rate.
if (process.argv.includes('--sweep')) {
  let seed = 12345; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const SIZES = [[12,16,24],[4,6,9],[9,14,20],[20,30,42],[12,16,24],[16,24,36],[9,12,16],[6,9,12],[4,6,9],[4,6,9]];
  const st = { lo: [0, 0], hi: [0, 0], bad: 0, maxMs: 0, pairs: 0, unmet: 0 };
  for (let it = 0; it < 4000; it++) {
    const n = 1 + Math.floor(rnd() * 8), rooms = [];
    for (let i = 0; i < n; i++) rooms.push({ id: 'r' + i, area: SIZES[Math.floor(rnd() * 10)][Math.floor(rnd() * 3)] });
    const stairs = rnd() < 0.85, lift = stairs && rnd() < 0.3, pos = ['centre', 'fl', 'fr', 'bl', 'br'][Math.floor(rnd() * 5)];
    const need = rooms.reduce((s, r) => s + r.area, 0) + (stairs ? 10 : 0) + (lift ? 3 : 0);
    const fill = 0.3 + rnd() * 0.7, ratio = 0.5 + rnd() * 1.5, A = need / fill;
    const W = Math.floor(Math.sqrt(A * ratio) * 2) / 2, D = Math.floor(Math.sqrt(A / ratio) * 2) / 2;
    if (W * D < need || W * D < 20) continue;
    const pairs = n >= 2 && rnd() < 0.5 ? [['r0', 'r1']] : [];
    const t = performance.now(); const res = generate(W, D, rooms, pairs, stairs, pos, lift); st.maxMs = Math.max(st.maxMs, performance.now() - t);
    const b = need / (W * D) <= 0.85 ? st.lo : st.hi; b[0]++;
    if (!res.ok) b[1]++; else { if (check(W, D, rooms, res).length) st.bad++; st.pairs += pairs.length; st.unmet += res.unmet.length; }
  }
  console.log(`sweep: fill<=85% ${st.lo[1]}/${st.lo[0]} no-layout (${(100 * st.lo[1] / st.lo[0]).toFixed(1)}%), fill>85% ${st.hi[1]}/${st.hi[0]} (${(100 * st.hi[1] / st.hi[0]).toFixed(1)}%), invalid ${st.bad}, unmet pairs ${st.unmet}/${st.pairs}, worst ${st.maxMs.toFixed(0)} ms`);
}
