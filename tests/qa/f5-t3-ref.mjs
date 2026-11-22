// F5-T3a QA reference (QA's own expectations, from the plan, the TL plan review and PM round 14; not from the FS or Designer code).
// Lens shift (TL ruling 2, A-12): PerspectiveCamera.setViewOffset(W + o, H, o, 0, W, H) with o = occl.right, so the principal
// point lands at x = (W - o) / 2; nothing covered -> clearViewOffset (null).
export function myViewOffset(W, H, occl) {
  const o = occl && occl.right > 0 ? Math.round(occl.right) : 0;
  if (!(W > 0 && H > 0) || !o || o >= W) return null;
  return [W + o, H, o, 0, W, H];
}
export const myVisibleAspect = (W, H, occl) => { const v = myViewOffset(W, H, occl); return W > 0 && H > 0 ? (W - (v ? v[2] : 0)) / H : 1; };
// The principal point of a viewOffset camera, in canvas px (x of the projection centre): the sub-window [o, o + W] of a
// (W + o)-wide frame whose centre is at (W + o) / 2 -> canvas x = (W + o) / 2 - o = (W - o) / 2.
export const principalX = (W, v) => (v ? v[0] / 2 - v[2] : W / 2);

// PM round 14 texts (binding)
export const TXT = {
  stopped: 'Saving has stopped: this browser\'s storage is full or blocked. Your work stays on screen but will be lost when you close or reload the page.',
  chip: 'Drafts are not saved on this device',
  chipToast: 'Drafts are not saved on this device. Your work will be lost when you close or reload the page.',
};
// Plan §2 / §4: desktop floating card 320 px + 16 px right margin; short-landscape panel 272 px; collapsed strip 44 px
export const OCCL_DESK = 336, PANEL_640 = 272, STRIP = 44;

// The maximum house (F5-T1 QA fixture: 4 levels x 10 rooms, all extras) with the master bedroom on the second floor, which
// gives the longest caption "Master bedroom · Second floor" (plan §3).
export const MAXMUT = "s.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; s.ans.streetEdge = 0; s.ans.footprintPct = 40; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.usableRoof = true; s.ans.roofType = 'terrace'; s.ans.pool = { on: true, size: 'L' }; s.ans.parking = { cars: 4, covered: true }; s.ans.extras = { wall: true, gate: 'right', seating: true }; s.ans.pairs = []; s.ans.rooms = []; let n = 1; for (const l of ['B', 'G', '1', '2']) for (const ty of ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry']) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: ty === 'bedroom' && l === '2' }); s.ans.nextRoomId = n;";
export const LONGEST = 'Master bedroom · Second floor';

// rectangles {l, t, r, b}
export const inter = (a, b, m = 0.5) => a && b && a.l < b.r - m && b.l < a.r - m && a.t < b.b - m && b.t < a.b - m;
export const inside = (a, b, m = 0.5) => a.l >= b.l - m && a.r <= b.r + m && a.t >= b.t - m && a.b <= b.b + m;
export const fmtR = (r) => (r ? `[${[r.l, r.t, r.r, r.b].map((x) => x.toFixed(0)).join(', ')}]` : 'none');
