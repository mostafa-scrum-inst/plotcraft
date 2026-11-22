// F5-T2 QA oracle (own expectations; no FS helper is used for an expectation). Written from docs/03-tasks/F5-T2/plan.md
// §2-§4, plan-review.md (required items 1-7, rulings 1-9) and goals-and-stories round 13 (Q10-Q13). Inputs taken as
// given: the house model (QA'd in F4), PC.cam.reset / limits / clamp (QA'd in F4-T1 / F5-T1) and PC.data.vegetation.
//   stops   : overview, then each level from the lowest (B first), rooms in nearest-neighbour order from the previous
//             stop (room centres in frame T, ties by plan order), then the overview again.
//   overview: eye / look of the Reset pose for the aspect.
//   room    : look = room centre at floorY + 0.5 (floorY = baseY + 0.2); eye horizontally 0.6 max(w, d) + 2 from the room
//             centre, away from the footprint centre (street side, +Z, when central), at max(baseY, 0) + storeyH + 2.5;
//             basement: 1.5 m from the room centre towards the footprint centre, at storeyH + 4; then Y >= eyeFloor.
//   eyeFloor: (canopyY0 + canopyH) x scale[1] + 0.5, from PC.data.vegetation (required item 2).
//   times   : 4 s for the two overview legs, 3.5 s per room -> room leg; speed factors slow 0.6, normal 1, fast 1.8.
//   caption : "Overview" at overview stops, "Room · Level" at room stops (round 12 / 13).
import * as F from './f5-t1-ref.mjs';
export const { LEVEL_LABEL, ORDER, captionOf, X, Z, floorYOf, eyeOf } = F;
export const OVERVIEW = 'Overview', LEG_OVER = 4, LEG_ROOM = 3.5, SPEED = { slow: 0.6, normal: 1, fast: 1.8 }, TREE_GAP = 0.5, NUDGE = 0.5;
export const eyeFloorOf = (veg) => (veg.tree.canopyY0 + veg.tree.canopyH) * veg.scale[1] + TREE_GAP;
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function fromEyeLook(eye, look) {
  const dx = eye[0] - look[0], dy = eye[1] - look[1], dz = eye[2] - look[2], r = Math.hypot(dx, dy, dz);
  return { target: look.slice(), radius: r, phi: Math.acos(Math.max(-1, Math.min(1, dy / r))), theta: Math.atan2(dx, dz) };
}
export const centreT = (h, r) => [X(h, r.u + r.w / 2), 0, Z(h, r.v + r.d / 2)];
export const fpCentreT = (h) => { const f = h.footprint; return [X(h, f.u + f.w / 2), 0, Z(h, f.v + f.d / 2)]; };
// room stop eye / look; `central` is true when the room centre is within `eps` of the footprint centre
export function roomStop(h, lv, r, eyeFloor, eps = 1e-6) {
  const c = centreT(h, r), fc = fpCentreT(h), look = [c[0], floorYOf(lv) + 0.5, c[2]];
  let dx = c[0] - fc[0], dz = c[2] - fc[2], n = Math.hypot(dx, dz); const central = n < eps;
  if (central) { dx = 0; dz = 1; n = 1; }
  let eye;
  if (lv.id === 'B') eye = central ? [c[0], h.storeyH + 4, c[2]] : [c[0] - 1.5 * dx / n, h.storeyH + 4, c[2] - 1.5 * dz / n];
  else { const k = 0.6 * Math.max(r.w, r.d) + 2; eye = [c[0] + k * dx / n, Math.max(lv.baseY, 0) + h.storeyH + 2.5, c[2] + k * dz / n]; }
  eye[1] = Math.max(eye[1], eyeFloor);
  return { kind: 'room', id: r.id, level: lv.id, eye, look, central };
}
// the whole plan. anchor: where an overview counts from for the nearest-neighbour walk ('look' | 'eye'); metric '2d' | '3d'
export function myTour(h, resetPose, eyeFloor, { anchor = 'look', metric = '2d' } = {}) {
  const ov = { kind: 'overview', id: null, level: null, eye: eyeOf(resetPose), look: resetPose.target.slice() };
  const stops = [ov]; let prev = anchor === 'eye' ? ov.eye : ov.look;
  const dm = metric === '3d' ? dist : d2;
  for (const lv of h.levels.slice().sort((a, b) => ORDER[a.id] - ORDER[b.id])) {
    const left = lv.rooms.map((r, i) => ({ r, i, s: roomStop(h, lv, r, eyeFloor) }));
    while (left.length) {
      let best = 0; for (let k = 1; k < left.length; k++) { const a = dm(left[k].s.look, prev), b = dm(left[best].s.look, prev); if (a < b - 1e-9 || (Math.abs(a - b) <= 1e-9 && left[k].i < left[best].i)) best = k; }
      const [p] = left.splice(best, 1); stops.push(p.s); prev = p.s.look; }
  }
  stops.push({ ...ov, eye: ov.eye.slice(), look: ov.look.slice() });
  let t = 0; stops.forEach((s, i) => { if (i) t += (i === 1 || i === stops.length - 1) ? LEG_OVER : LEG_ROOM; s.t = t; });
  return { stops, duration: t, eyeFloor };
}
export const stopCaption = (h, s) => s.kind === 'overview' ? OVERVIEW : captionOf(F.roomOf(h, s.id).room.name, s.level);
