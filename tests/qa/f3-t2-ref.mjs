// F3-T2 QA reference (shared by f3-t2-edit.mjs and f3-t2-editor.mjs): QA's own snapping, clamp and overlap oracle,
// written from A-15 (TL ruling 9), PM 4.3 / 4.4, F3-S2 and A-8; never imports app code.
export const SNAP = 0.3, MINS = 1.5, TOL = 0.011, E = 1e-9, GRID = { m: 0.5, ft: 0.3048 };
export const r2 = (v) => Math.round(v * 100) / 100 + 0;
export const rnd2 = (r) => ({ id: r.id, x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h) });
// ---------- QA's snapping oracle ----------
// candidates on one axis: lines { v, lo, hi, kind } (x-lines span y, y-lines span x)
export function myCands(rooms, id, core, W, D, axis) {
  const out = [], add = (b, kind) => { if (axis === 'x') out.push({ v: b.x, lo: b.y, hi: b.y + b.h, kind }, { v: b.x + b.w, lo: b.y, hi: b.y + b.h, kind }); else out.push({ v: b.y, lo: b.x, hi: b.x + b.w, kind }, { v: b.y + b.h, lo: b.x, hi: b.x + b.w, kind }); };
  rooms.forEach((r) => { if (r.id !== id) add(r, 'room'); }); ['stair', 'lift'].forEach((k) => { if (core[k]) add(core[k], 'core'); }); add({ x: 0, y: 0, w: W, h: D }, 'footprint');
  return out;
}
// one edge: raw position v, its span [s0, s1], limits [lo, hi]. The clamp comes first (hard), then the snap.
export function mySnap(v, s0, s1, cands, grid, lo, hi) {
  const c = Math.min(hi, Math.max(lo, v)); let best = null;
  for (const k of cands) { if (k.v < lo - E || k.v > hi + E) continue; if (k.kind === 'room' && (k.hi < s0 - SNAP - E || k.lo > s1 + SNAP + E)) continue;
    const d = Math.abs(k.v - c); if (d > SNAP + E) continue; if (!best || d < best.d - E || (Math.abs(d - best.d) <= E && k.v < best.v)) best = { v: k.v, d, to: 'edge', kind: k.kind }; }
  if (best) return best;
  const lines = [Math.floor(c / grid), Math.ceil(c / grid)].map((n) => n * grid).filter((g) => g >= lo - E && g <= hi + E);
  if (!lines.length) return { v: c, d: 0, to: 'none' };
  lines.sort((a, b) => Math.abs(a - c) - Math.abs(b - c)); return { v: lines[0], d: Math.abs(lines[0] - c), to: 'grid', tie: lines.length > 1 && Math.abs(Math.abs(lines[0] - c) - Math.abs(lines[1] - c)) < 1e-9 };
}
// span: 'room' = the clamped room's span across the axis (QA's reading of A-15), 'finger' = the unclamped dragged position
export function myMove(start, dx, dy, env, span0 = 'room') {
  const { W, D, grid, rooms, core } = env, r = { ...start };
  const px = Math.min(W - r.w, Math.max(0, start.x + dx)), py = Math.min(D - r.h, Math.max(0, start.y + dy));
  const fy = span0 === 'room' ? py : start.y + dy, fx = span0 === 'room' ? px : start.x + dx;
  for (const [p, s, M, pos, span] of [['x', 'w', W, px, [fy, fy + r.h]], ['y', 'h', D, py, [fx, fx + r.w]]]) {
    const C = myCands(rooms, start.id, core, W, D, p), lo = mySnap(pos, span[0], span[1], C, grid, 0, M - r[s]), hi = mySnap(pos + r[s], span[0], span[1], C, grid, r[s], M);
    let useHi; if (lo.to === 'edge' && hi.to === 'edge') useHi = hi.d < lo.d - E; else if (hi.to === 'edge') useHi = true; else if (lo.to === 'edge') useHi = false; else useHi = hi.d < lo.d - E;
    r[p] = useHi ? hi.v - r[s] : lo.v; }
  return rnd2(r);
}
export function myResize(start, kind, dx, dy, env) {
  const { W, D, grid, rooms, core } = env, r = { ...start }, x1 = r.x + r.w, y1 = r.y + r.h;
  if (kind === 'e' || kind === 'w') { const C = myCands(rooms, start.id, core, W, D, 'x');
    if (kind === 'e') r.w = mySnap(x1 + dx, r.y, y1, C, grid, r.x + MINS, W).v - r.x; else { const v = mySnap(r.x + dx, r.y, y1, C, grid, 0, x1 - MINS).v; r.x = v; r.w = x1 - v; } }
  else { const C = myCands(rooms, start.id, core, W, D, 'y');
    if (kind === 'n') r.h = mySnap(y1 + dy, r.x, x1, C, grid, r.y + MINS, D).v - r.y; else { const v = mySnap(r.y + dy, r.x, x1, C, grid, 0, y1 - MINS).v; r.y = v; r.h = y1 - v; } }
  return rnd2(r);
}
// ---------- QA's overlap / adjacency (A-8) ----------
export const ovl = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > TOL && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > TOL;
export function myOverlaps(rooms, core) { const all = [...rooms, ...['stair', 'lift'].filter((k) => core[k]).map((k) => ({ id: k, ...core[k] }))], out = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (ovl(all[i], all[j]) && !(['stair', 'lift'].includes(all[i].id) && ['stair', 'lift'].includes(all[j].id))) out.push([all[i].id, all[j].id].join('+'));
  return out.sort(); }
export function adj(a, b) { const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y), gx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w), gy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
  return (Math.abs(gx) <= 0.02 && oy >= 0.5 - 1e-9) || (Math.abs(gy) <= 0.02 && ox >= 0.5 - 1e-9); }
