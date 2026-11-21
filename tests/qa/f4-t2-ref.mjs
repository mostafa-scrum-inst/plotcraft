// QA's own CD-5 hall-access oracle (F4-T2 Step 0), written from client-decisions.md CD-5 and the PM's round-10
// refinement in goals-and-stories.md, independently of PC.layout.access: each inner side (not on the footprint
// outline) is sampled every STEP m and probed OFF m outside; a probe in no room and no core block is hall, one in the
// stair / lift is core contact. Access: hall >= 0.8 m or core contact >= 0.8 m (each in total over the sides).
// Reached through a reached neighbour sharing a wall (A-8 adjacency) that is a must-be-adjacent partner or a host of
// its type (fixed point). Used by f4-t2-s0-core.mjs (node) and f4-t2-s0-ui.mjs (page).
const TYPES = ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry'];
export const HOSTS = { bathroom: ['bedroom', 'maid'], storage: TYPES.filter((t) => !['bathroom', 'storage', 'laundry'].includes(t)), laundry: TYPES.filter((t) => !['bathroom', 'storage', 'laundry'].includes(t)) };
export function adj(a, b) { const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y), gx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w), gy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
  return (Math.abs(gx) <= 0.02 && oy >= 0.5 - 1e-9) || (Math.abs(gy) <= 0.02 && ox >= 0.5 - 1e-9); }
const inside = (b, x, y) => x > b.x + 1e-9 && x < b.x + b.w - 1e-9 && y > b.y + 1e-9 && y < b.y + b.h - 1e-9;
export function contact(W, D, rooms, core, r, STEP = 0.002, OFF = 0.012) {
  let hall = 0, touch = 0; const others = rooms.filter((o) => o.id !== r.id), cores = [core.stair, core.lift].filter(Boolean);
  const sides = [[r.x, r.y, 0, 1, r.h, -1, 0], [r.x + r.w, r.y, 0, 1, r.h, 1, 0], [r.x, r.y, 1, 0, r.w, 0, -1], [r.x, r.y + r.h, 1, 0, r.w, 0, 1]];
  for (const [x0, y0, dx, dy, len, nx, ny] of sides) {
    if ((nx && (Math.abs(x0) < 0.02 || Math.abs(x0 - W) < 0.02)) || (ny && (Math.abs(y0) < 0.02 || Math.abs(y0 - D) < 0.02))) continue;   // exterior side
    for (let t = STEP / 2; t < len; t += STEP) { const px = x0 + dx * t + nx * OFF, py = y0 + dy * t + ny * OFF;
      if (cores.some((b) => inside(b, px, py))) touch += STEP; else if (!others.some((b) => inside(b, px, py)) && px > 0 && px < W && py > 0 && py < D) hall += STEP; }
  }
  return { hall, touch };
}
export function myAccess(W, D, rooms, core, pairs, types) {
  const reached = {}, info = {};
  for (const r of rooms) { const c = contact(W, D, rooms, core, r); info[r.id] = c; reached[r.id] = c.hall >= 0.8 - 0.004 || c.touch >= 0.8 - 0.004; }
  const paired = (a, b) => pairs.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
  for (let ch = true; ch;) { ch = false; for (const r of rooms) if (!reached[r.id] && rooms.some((n) => n.id !== r.id && reached[n.id] && adj(r, n) && (paired(r.id, n.id) || (HOSTS[types[r.id]] || []).includes(types[n.id])))) { reached[r.id] = true; ch = true; } }
  return { ids: rooms.filter((r) => !reached[r.id]).map((r) => r.id), info };
}
export const ACCESS_TEXT = (name) => `The ${name} has no way in from the hall or stairs. Move or resize a neighbouring room to open one.`;
export const LOWFILL_TEXT = (p, level) => `Rooms fill only ${p} % of the ${level}. Add rooms, choose larger sizes, or lower the footprint % (Q3).`;

// ---------- F4-T2 proper: QA's own yard / gate / needle oracles (frame L, from architecture A-9 + Designer plan 2-3,
// PM round 10 Q7 / Q8). Inputs taken as given: plot in L (QA's own toL), footprint / parking / pool (QA'd in F2). ----------
export const grow = (r, k) => ({ u: r.u - k, v: r.v - k, w: r.w + 2 * k, d: r.d + 2 * k });
export const rOver = (a, b) => Math.min(a.u + a.w, b.u + b.w) - Math.max(a.u, b.u) > 1e-9 && Math.min(a.v + a.d, b.v + b.d) - Math.max(a.v, b.v) > 1e-9;
export function inPolyL(q, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
export function distSeg(q, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy); }
// a rectangle inside a simple polygon: its corners inside (or on the edge) and no polygon vertex strictly inside it
export function rectIn(r, p) {
  const onEdge = (q) => p.some((a, i) => distSeg(q, a, p[(i + 1) % p.length]) < 1e-7);
  if (![[r.u, r.v], [r.u + r.w, r.v], [r.u + r.w, r.v + r.d], [r.u, r.v + r.d]].every((q) => onEdge(q) || inPolyL(q, p))) return false;
  return !p.some((q) => q[0] > r.u + 1e-9 && q[0] < r.u + r.w - 1e-9 && q[1] > r.v + 1e-9 && q[1] < r.v + r.d - 1e-9);
}
export const bboxL = (p) => ({ x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), y0: Math.min(...p.map((q) => q[1])), y1: Math.max(...p.map((q) => q[1])) });
export const GATE_K = { left: 0.25, centre: 0.5, right: 0.75 };
// street edge = L edge 0 from (0, 0) to (len, 0); Left as seen from the street = low u
export const myGateU = (pL, extras) => (extras.wall ? Math.hypot(pL[1][0] - pL[0][0], pL[1][1] - pL[0][1]) * GATE_K[extras.gate] : null);
export function myPath(pL, fp, extras) { const cx = fp.u + fp.w / 2, g = myGateU(pL, extras), a = Math.min(cx, g === null ? cx : g) - 1, b = Math.max(cx, g === null ? cx : g) + 1, y0 = bboxL(pL).y0; return { u: a, v: y0, w: b - a, d: fp.v - y0 }; }
export function myBlocked(pL, fp, parking, pool, extras) { const o = [grow(fp, 1), myPath(pL, fp, extras)]; if (parking) o.push(parking); if (pool) o.push(grow(pool, 1)); return o; }
// every valid 3 x 3 pad on the 0.5 m grid, by yard: back, right, left, front
export function myPads(pL, fp, parking, pool, extras) {
  const bb = bboxL(pL), no = myBlocked(pL, fp, parking, pool, extras), Z = 3, out = { back: [], right: [], left: [], front: [] };
  for (let u = Math.ceil(bb.x0 * 2 - 1e-9) / 2; u <= bb.x1 - Z + 1e-9; u += 0.5) for (let v = Math.ceil(bb.y0 * 2 - 1e-9) / 2; v <= bb.y1 - Z + 1e-9; v += 0.5) {
    const r = { u, v, w: Z, d: Z }; if (!rectIn(grow(r, 0.3), pL) || no.some((x) => rOver(r, x))) continue;
    if (v >= fp.v + fp.d + 1 - 1e-9) out.back.push(r);
    if (u >= fp.u + fp.w + 1 - 1e-9) out.right.push(r);
    if (u + Z <= fp.u - 1 + 1e-9) out.left.push(r);
    if (v + Z <= fp.v - 1 + 1e-9) out.front.push(r);
  }
  return out;
}
// yard order: back, the wider side yard (bbox to footprint + 1 m; ties: right), the other side, front
export function myYardOrder(pL, fp) { const bb = bboxL(pL), right = bb.x1 - (fp.u + fp.w + 1), left = (fp.u - 1) - bb.x0; return ['back'].concat(right >= left ? ['right', 'left'] : ['left', 'right'], ['front']); }
// the needle (Designer plan 2): L, then the corner walk FL, FR, BL, BR along the inward diagonal in 0.25 m steps
export function myNeedle(pL, blocked) {
  const bb = bboxL(pL), L = Math.min(3, Math.max(1.5, 0.06 * Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0))), r = L / 2, room = r + 0.5 + 0.2, diag = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0);
  const fits = (q) => inPolyL(q, pL) && pL.every((a, i) => distSeg(q, a, pL[(i + 1) % pL.length]) >= room - 1e-9);
  const clear = (q) => !blocked.some((x) => { const dx = Math.max(x.u - q[0], 0, q[0] - x.u - x.w), dy = Math.max(x.v - q[1], 0, q[1] - x.v - x.d); return dx * dx + dy * dy < r * r; });
  let first = null, firstClear = null; const found = [];
  for (const [x, y, sx, sy, name] of [[bb.x0, bb.y0, 1, 1, 'FL'], [bb.x1, bb.y0, -1, 1, 'FR'], [bb.x0, bb.y1, 1, -1, 'BL'], [bb.x1, bb.y1, -1, -1, 'BR']]) {
    let p = null; for (let k = 0; k * 0.25 <= diag + 1e-9; k++) { const t = k * 0.25, q = [x + sx * t / Math.SQRT2, y + sy * t / Math.SQRT2]; if (fits(q)) { p = q; break; } }
    if (!p) continue; found.push([name, p, clear(p)]); if (!first) first = p; if (!firstClear && clear(p)) firstClear = [name, p]; }
  return { L, at: firstClear ? firstClear[1] : first, corner: firstClear ? firstClear[0] : (found[0] || [])[0] + ' (none clear)', found };
}
