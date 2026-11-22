// F5-T3a Designer: drone-tour pacing, measured on the real tour code (core + three/tour.js) in node with the strict THREE
// mock and its controllable 60 fps clock (as tests/three/tour.test.mjs). No pixels, so it runs in seconds; the eyes-on
// frames are F5-T3b's phone pass.
// Houses: sample, G6 maximum house, sample + basement (2 rooms). Canvas: desktop 1280x690 and phone 360x490 (the stage-5
// canvas sizes at 1280x800 / 360x640). Reports:
//   - duration at normal speed;
//   - view rotation rate: the angle between successive view directions (look - eye) per second, max and 95th
//     percentile, separately for the overview legs (first, last) and the room legs;
//   - room coverage at each room stop: the room's box (floor to storey top) projected with the stop pose, PC.C.CAM.fov
//     and the canvas aspect, its convex hull clipped to the canvas, as a share of it (occlusion ignored: upper bound).
//   node docs/03-tasks/F5-T3/verify/tour.mjs ['{"roomLeg":4.5}']
import { load3d } from '../../../../tests/helpers/load3d.mjs';
import { sampleApproved, maxHouse } from '../../../../tests/helpers/houses.mjs';

const over = JSON.parse(process.argv.slice(2).find((a) => a.startsWith('{')) || '{}');
const FR = 1000 / 60;
const HOUSES = {
  sample: (PC) => sampleApproved(PC),
  max: (PC) => maxHouse(PC),
  basement: (PC) => sampleApproved(PC, (d) => { d.ans.basement = true; for (const t of ['storage', 'laundry']) d.ans.rooms.push(PC.store.room('r' + d.ans.nextRoomId++, t, 'B', 'S')); })
};
const SIZES = { '1280x800': [1280, 690], '360x640': [360, 490] };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nz = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };

function coverage(PC, house, lv, r, pose, aspect) {
  const e = PC.cam.position(pose), fw = nz(sub(pose.target, e)), rt = nz(cross(fw, [0, 1, 0])), up = cross(rt, fw), t = Math.tan(PC.C.CAM.fov / 2 * Math.PI / 180);
  const x0 = r.u - house.center[0], z0 = -(r.v - house.center[1]), y0 = lv.baseY, pts = [];
  for (const x of [x0, x0 + r.w]) for (const y of [y0, y0 + house.storeyH]) for (const z of [z0, z0 - r.d]) {
    const v = sub([x, y, z], e), d = dot(v, fw); if (d > 0.05) pts.push([dot(v, rt) / (d * t * aspect), dot(v, up) / (d * t)]);
  }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const X = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const p of pts) { while (lo.length >= 2 && X(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.slice().reverse()) { while (hi.length >= 2 && X(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  let poly = lo.slice(0, -1).concat(hi.slice(0, -1));
  for (const [ax, s] of [[0, 1], [0, -1], [1, 1], [1, -1]]) {
    const inside = (p) => s * p[ax] <= 1, cut = (a, b) => { const k = (s - a[ax]) / (b[ax] - a[ax]); return [a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1])]; }, out = [];
    poly.forEach((b, i) => { const a = poly[(i + poly.length - 1) % poly.length]; if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b)); });
    poly = out;
  }
  let A = 0; poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; A += p[0] * q[1] - q[0] * p[1]; });
  return Math.abs(A) / 2 / 4;
}

const stat = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? { max: +b[b.length - 1].toFixed(1), p95: +b[Math.floor(0.95 * (b.length - 1))].toFixed(1) } : null; };
for (const [vp, size] of Object.entries(SIZES)) for (const [name, fn] of Object.entries(HOUSES)) {
  const E = load3d({ size }), PC = E.PC;
  Object.assign(PC.C.TOUR, over);
  const s = fn(PC), house = PC.house.build(s);
  PC.view3d.open(house, E.canvas, () => {}); E.raf.flush(); E.timer.flush(); E.raf.flush();
  const aspect = size[0] / size[1], plan = PC.tourplan.build(house, aspect), T = PC.three.tour;
  T.start({});
  const frames = [];
  for (let i = 0; i < 40000 && T.running(); i++) { E.raf.tick(FR); const st = T.state(); frames.push({ p: PC.view3d.pose(), tau: st.running ? st.tau : plan.duration }); }
  const rot = { overview: [], room: [] };
  for (let i = 1; i < frames.length; i++) {
    const d0 = nz(sub(frames[i - 1].p.target, PC.cam.position(frames[i - 1].p))), d1 = nz(sub(frames[i].p.target, PC.cam.position(frames[i].p)));
    const leg = Math.min(plan.stops.length - 1, PC.tourplan.target(plan, frames[i].tau)), kind = leg === 1 || leg === plan.stops.length - 1 ? 'overview' : 'room';
    rot[kind].push(Math.acos(Math.max(-1, Math.min(1, dot(d0, d1)))) * 180 / Math.PI / (FR / 1000));
  }
  const covers = [];
  for (const st of plan.stops.filter((x) => x.kind === 'room')) {
    const f = frames.reduce((b, x) => (Math.abs(x.tau - st.t) < Math.abs(b.tau - st.t) ? x : b), frames[0]);
    const lv = house.levels.find((l) => l.id === st.level), r = lv.rooms.find((q) => q.id === st.id);
    covers.push({ id: `${st.level}:${st.id}`, c: coverage(PC, house, lv, r, f.p, aspect) });
  }
  const cmin = covers.reduce((m, c) => (c.c < m.c ? c : m), covers[0]);
  console.log(JSON.stringify({ vp, house: name, rooms: covers.length, duration: +plan.duration.toFixed(1), rotOverview: stat(rot.overview), rotRoom: stat(rot.room),
    coverMin: `${cmin.id} ${(cmin.c * 100).toFixed(1)}%`, coverMedian: +(covers.map((c) => c.c).sort((a, b) => a - b)[covers.length >> 1] * 100).toFixed(1),
    under8: covers.filter((c) => c.c < 0.08).map((c) => `${c.id} ${(c.c * 100).toFixed(1)}%`) }));
}
