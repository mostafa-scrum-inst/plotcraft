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
