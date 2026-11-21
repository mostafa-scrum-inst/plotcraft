// F5-T1 QA oracle (own expectations; no FS helper is used for an expectation). Written from docs/03-tasks/F5-T1/plan.md,
// plan-review.md (required items 1-6, rulings Q1-Q5), goals-and-stories round 12 (caption, dropdown state) and
// architecture A-12 / A-14 as amended by the plan review. Inputs taken as given: the house model (QA'd in F4-T1 / F4-T2:
// levels with baseY, rooms in frame L with their plan names, footprint, centre, radius, storeyH) and the A-12 limits
// fields except the target Y floor, which is judged here.
//   pose    : target = [X(room centre u), floorY + 0.5, Z(room centre v)], floorY = baseY + 0.2 (slab); theta = the
//             current theta; phi = 35 degrees (15 for a basement room); radius = clamp(1.6 max(w, d) + storeyH, 6, 3 R);
//             then my own A-12 clamp (phi, radius, target box with Y in [lowest floorY, roof base], eye >= 1.0 m).
//   groups  : one group per level, lowest first, label = LEVEL_LABEL, rooms in plan order with their plan names.
//   caption : "<room name> · <LEVEL_LABEL>".
export const SLAB = 0.2, D2R = Math.PI / 180;
export const LEVEL_LABEL = { B: 'Basement', G: 'Ground floor', 1: 'First floor', 2: 'Second floor' };
export const ORDER = { B: -1, G: 0, 1: 1, 2: 2 };
export const HL_HEX = '#C2410C';
export const captionOf = (name, level) => `${name} · ${LEVEL_LABEL[level]}`;
export const X = (h, u) => u - h.center[0], Z = (h, v) => -(v - h.center[1]);
export const floorYOf = (lv) => lv.baseY + SLAB;
export const lowestFloorY = (h) => Math.min(0, ...h.levels.map(floorYOf));
export function myGroups(h) {
  return h.levels.slice().sort((a, b) => ORDER[a.id] - ORDER[b.id]).map((l) => ({ level: l.id, label: LEVEL_LABEL[l.id], rooms: l.rooms.map((r) => ({ id: r.id, name: r.name })) }));
}
export function roomOf(h, id) { for (const l of h.levels) for (const r of l.rooms) if (r.id === id) return { room: r, level: l }; return null; }
// unclamped A-14 pose
export function myRawPose(h, id, current) {
  const { room: r, level: l } = roomOf(h, id), base = l.id === 'B';
  return { target: [X(h, r.u + r.w / 2), floorYOf(l) + 0.5, Z(h, r.v + r.d / 2)], theta: current.theta, phi: (base ? 15 : 35) * D2R,
    radius: Math.min(Math.max(1.6 * Math.max(r.w, r.d) + h.storeyH, 6), 3 * h.radius) };
}
// my A-12 clamp with the plan-review Y floor; L = the app's limits (phi / radius / x-z box / eyeMin taken as given)
export function myClamp(p, L, h) {
  const q = { target: p.target.slice(), radius: p.radius, theta: p.theta, phi: p.phi }, b = L.box;
  q.phi = Math.min(Math.max(q.phi, L.phiMin), L.phiMax); q.radius = Math.min(Math.max(q.radius, L.rMin), L.rMax);
  q.target = [Math.min(Math.max(q.target[0], b.x0), b.x1), Math.min(Math.max(q.target[1], lowestFloorY(h)), Math.max(0, h.roof.baseY)), Math.min(Math.max(q.target[2], b.z0), b.z1)];
  const need = L.eyeMin - q.target[1]; if (need > 0) q.phi = Math.min(q.phi, Math.acos(Math.min(1, need / q.radius)));
  return q;
}
export const eyeOf = (p) => [p.target[0] + p.radius * Math.sin(p.phi) * Math.sin(p.theta), p.target[1] + p.radius * Math.cos(p.phi), p.target[2] + p.radius * Math.sin(p.phi) * Math.cos(p.theta)];
const wrap = (a) => { const t = 2 * Math.PI; return ((a % t) + t) % t; };
export const angDiff = (a, b) => { const d = Math.abs(wrap(a) - wrap(b)); return Math.min(d, 2 * Math.PI - d); };
export function poseDiff(a, b, tol = 1e-6) {
  if (!a || !b) return 'missing pose';
  const f = [];
  if (a.target.some((x, i) => Math.abs(x - b.target[i]) > tol)) f.push(`target ${a.target.map((x) => x.toFixed(3))} vs ${b.target.map((x) => x.toFixed(3))}`);
  if (Math.abs(a.radius - b.radius) > tol) f.push(`radius ${a.radius.toFixed(3)} vs ${b.radius.toFixed(3)}`);
  if (angDiff(a.theta, b.theta) > tol) f.push(`theta ${(a.theta / D2R).toFixed(2)} vs ${(b.theta / D2R).toFixed(2)} deg`);
  if (Math.abs(a.phi - b.phi) > tol) f.push(`phi ${(a.phi / D2R).toFixed(2)} vs ${(b.phi / D2R).toFixed(2)} deg`);
  return f.join(', ');
}
// distance between two poses: eye distance + target distance (metres)
export const poseDist = (a, b) => { const e = eyeOf(a), f = eyeOf(b); return Math.hypot(e[0] - f[0], e[1] - f[1], e[2] - f[2]) + Math.hypot(a.target[0] - b.target[0], a.target[1] - b.target[1], a.target[2] - b.target[2]); };
// basement view (plan-review item 1): the eye -> target segment crosses Y = 0 inside the footprint (T)
export function pitCrossing(h, p) {
  const e = eyeOf(p), t = p.target; if (!(e[1] > 0 && t[1] < 0)) return { ok: e[1] >= 0 && t[1] >= 0, at: null };
  const k = e[1] / (e[1] - t[1]), x = e[0] + (t[0] - e[0]) * k, z = e[2] + (t[2] - e[2]) * k, fp = h.footprint;
  const x0 = X(h, fp.u), x1 = X(h, fp.u + fp.w), z0 = Z(h, fp.v + fp.d), z1 = Z(h, fp.v);
  return { ok: x > x0 + 1e-9 && x < x1 - 1e-9 && z > z0 + 1e-9 && z < z1 - 1e-9, at: [x, z] };
}
