// Reads a PC.three.BoxBatch mesh back from the THREE mock, item by item in the order they were added (userData.items;
// before F4-T2: boxes first, 24 vertices each, then quads, 4 each). Each item: { x0, x1, y0, y1, z0, z1, top: [r, g, b], side: [r, g, b] } in frame T.
export function itemsOf(mock, mesh) {
  const g = mock.raw(mock.raw(mesh).geometry), pos = g.attrs.position.array, col = g.attrs.color.array;
  const ud = mock.raw(mesh).userData, out = [];
  let v = 0;
  const take = (n) => {
    const it = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    for (let i = v; i < v + n; i++) {
      const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
      it.x0 = Math.min(it.x0, x); it.x1 = Math.max(it.x1, x); it.y0 = Math.min(it.y0, y); it.y1 = Math.max(it.y1, y); it.z0 = Math.min(it.z0, z); it.z1 = Math.max(it.z1, z);
    }
    const rgb = (i) => [col[3 * i], col[3 * i + 1], col[3 * i + 2]];
    it.top = n === 24 ? rgb(v + 8) : rgb(v);      // face 2 (+Y) of a box starts at vertex 8
    it.side = rgb(v);
    v += n; return it;
  };
  // F4-T2: userData.items lists every item in the order added ([kind, vertex count]: box, quad, prism, seg, flat)
  if (ud.items) { for (const [kind, n] of ud.items) { const at = v; out.push({ kind, first: at, n, ...take(n) }); } return out; }
  for (let b = 0; b < ud.boxes; b++) out.push({ kind: 'box', ...take(24) });
  for (let q = 0; q < ud.quads; q++) out.push({ kind: 'quad', ...take(4) });
  return out;
}
export const rgbOf = (PC, hex) => { const c = PC.three.col(hex); return [c.r, c.g, c.b]; };
export const sameRgb = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6);

// Outward winding (TL plan review Q12): every triangle of the vertex range [first, first + n) has its geometric normal
// (b - a) x (c - a) along the stored vertex normal and pointing away from the item's centre. -> list of problems.
export function windingProblems(mock, mesh, it) {
  const g = mock.raw(mock.raw(mesh).geometry), pos = g.attrs.position.array, nor = g.attrs.normal.array, idx = g.index;
  const P = (i) => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]], N = (i) => [nor[3 * i], nor[3 * i + 1], nor[3 * i + 2]];
  const c = [0, 0, 0], out = [];                       // the vertex average: inside the (convex) item
  for (let i = it.first; i < it.first + it.n; i++) for (let k = 0; k < 3; k++) c[k] += pos[3 * i + k] / it.n;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, d] = [idx[t], idx[t + 1], idx[t + 2]];
    if (a < it.first || a >= it.first + it.n) continue;
    const gN = cross(sub(P(b), P(a)), sub(P(d), P(a))), m = [(P(a)[0] + P(b)[0] + P(d)[0]) / 3, (P(a)[1] + P(b)[1] + P(d)[1]) / 3, (P(a)[2] + P(b)[2] + P(d)[2]) / 3];
    if (dot(gN, N(a)) <= 0) out.push(`triangle ${t / 3}: winding against its normal`);
    if (dot(N(a), sub(m, c)) <= 0) out.push(`triangle ${t / 3}: normal points inward`);
  }
  return out;
}
