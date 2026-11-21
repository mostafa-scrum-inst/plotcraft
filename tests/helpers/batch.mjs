// Reads a PC.three.BoxBatch mesh back from the THREE mock: boxes first (24 vertices each), then quads (4 each), in
// the order they were added. Each item: { x0, x1, y0, y1, z0, z1, top: [r, g, b], side: [r, g, b] } in frame T.
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
  for (let b = 0; b < ud.boxes; b++) out.push({ kind: 'box', ...take(24) });
  for (let q = 0; q < ud.quads; q++) out.push({ kind: 'quad', ...take(4) });
  return out;
}
export const rgbOf = (PC, hex) => { const c = PC.three.col(hex); return [c.r, c.g, c.b]; };
export const sameRgb = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
