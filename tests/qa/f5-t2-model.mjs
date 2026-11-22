// F5-T2 QA (node): the pure tour plan (core/tourplan.js) and PC.cam.fromEyeLook, judged by QA's own oracle
// (f5-t2-ref.mjs). Version-aware (plan §6): runs only once PC.tourplan exists; without it the suite notes the skip.
//   S  stops: overview first and last, every room once, levels lowest first (B first), nearest-neighbour order with
//      plan-order ties; caption ids / levels; 5 houses (sample, one room, basement house, low 2.4 m ceilings, maximum).
//   E  eyes and looks = mine (1e-6; a central room only by distance / height / street side), eye floor 5.33 m read from
//      PC.data.vegetation (required item 2), every eye >= it; consecutive points >= 0.5 m apart (nudge).
//   T  times (version-aware, T.usePace(PC.C.TOUR)): F5-T2 overview legs 4 s, sample 53.5 s, maximum 144.5 s; F5-T3a 4.5 s,
//      54.5 s, 145.5 s; room legs 3.5 s; speed factors.
//   C  fromEyeLook = mine (1e-9) and round-trips with PC.cam.position; PC.cam.clamp leaves every stop pose unchanged
//      (required item 3); the plan is deterministic.
// Run: node tests/qa/f5-t2-model.mjs [--no-shots]
import { collector } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';
import * as H from './f4-t1-ref.mjs';
import * as T from './f5-t2-ref.mjs';

const R = collector('F5-T2 model');
const { PC } = H.loadPC3();
const PACEV = T.usePace(PC.C.TOUR);   // version-aware pacing (F5-T2 or F5-T3a), QA literals
const t0 = Date.now();
const cut = (a, n = 8) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);
const HAS = !!(PC.tourplan && typeof PC.tourplan.build === 'function');
R.note(`markers: PC.tourplan ${HAS}, PC.three.tour ${!!(PC.three && PC.three.tour)}, PC.cam.fromEyeLook ${!!(PC.cam && PC.cam.fromEyeLook)}`);
if (!HAS) { R.note('skipped: PC.tourplan absent (F5-T2 not merged)'); process.exit(R.done() ? 0 : 1); }

function make(mut) { const s = Q.plain(PC.sample.state()); if (mut) mut(s); s.plans = {}; PC.plans.sync(s); for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; return s; }
const ASP = 1.6;
const HOUSES = [
  ['sample', null],
  ['one room', (s) => { s.ans.floors = 1; s.ans.pairs = []; s.ans.rooms = [{ id: 'r1', type: 'living', level: 'G', size: 'M', area: null, master: false }]; s.ans.nextRoomId = 2; }],
  ['basement house', (s) => { s.ans.basement = true; for (const ty of ['storage', 'office', 'laundry']) s.ans.rooms.push({ id: 'r' + s.ans.nextRoomId++, type: ty, level: 'B', size: 'S', area: null, master: false }); }],
  ['low ceilings 2.4 m', (s) => { s.ans.ceilingH = 2.4; }],
  ['maximum house (40 rooms)', (s) => { s.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; s.ans.streetEdge = 0; s.ans.footprintPct = 40; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.usableRoof = true; s.ans.roofType = 'terrace'; s.ans.pairs = []; s.ans.rooms = []; let n = 1;
    for (const l of ['B', 'G', '1', '2']) for (const ty of ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry']) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); s.ans.nextRoomId = n; }],
];
const EYE_FLOOR = T.eyeFloorOf(PC.data.vegetation);
const built = HOUSES.map(([tag, mut]) => { const h = PC.house.build(make(mut)); return { tag, h }; }).filter((b) => b.h || (R.check(`${b.tag}: house built`, ['no house']), false));
const plans = built.map((b) => { let p = null, err = null; try { p = PC.tourplan.build(b.h, ASP); } catch (e) { err = String(e); } return { ...b, p, err }; });

// which nearest-neighbour anchor / metric the plan follows (the plan names "room centres in frame T")
const VARS = [['look', '2d'], ['look', '3d'], ['eye', '2d'], ['eye', '3d']];
const ids = (pl) => (pl.stops || []).map((s) => s.kind === 'overview' ? 'O' : s.id).join();
let VAR = null;
for (const v of VARS) if (plans.every(({ h, p }) => p && ids(p) === ids(T.myTour(h, PC.cam.reset(h, ASP), EYE_FLOOR, { anchor: v[0], metric: v[1] })))) { VAR = v; break; }
const mine = (h) => T.myTour(h, PC.cam.reset(h, ASP), EYE_FLOOR, { anchor: (VAR || VARS[0])[0], metric: (VAR || VARS[0])[1] });
R.note(`nearest-neighbour walk matched with anchor ${VAR ? VAR.join(' / ') : 'none'}; eye floor ${EYE_FLOOR.toFixed(3)} m from the table`);

// ================= S. stops =================
{ const f = [];
  for (const { tag, h, p, err } of plans) {
    if (!p) { f.push(`${tag}: build threw ${err}`); continue; }
    const m = mine(h), st = p.stops || [];
    if (st.length !== m.stops.length) f.push(`${tag}: ${st.length} stops, expected ${m.stops.length}`);
    if (!st.length || st[0].kind !== 'overview' || st[st.length - 1].kind !== 'overview') f.push(`${tag}: first / last stop ${st[0] && st[0].kind} / ${st.length && st[st.length - 1].kind}`);
    const rooms = st.filter((s) => s.kind === 'room').map((s) => s.id), all = h.levels.flatMap((l) => l.rooms.map((r) => r.id));
    if (rooms.length !== all.length || new Set(rooms).size !== all.length || all.some((id) => !rooms.includes(id))) f.push(`${tag}: rooms visited ${rooms.length} (${new Set(rooms).size} distinct) of ${all.length}`);
    const lv = st.filter((s) => s.kind === 'room').map((s) => T.ORDER[s.level]); if (lv.some((x, i) => i && x < lv[i - 1])) f.push(`${tag}: levels not ascending ${st.filter((s) => s.kind === 'room').map((s) => s.level).join('')}`);
    for (const s of st) if (s.kind === 'room') { const r = h.levels.find((l) => l.rooms.some((x) => x.id === s.id)); if (!r || r.id !== s.level) f.push(`${tag}: stop ${s.id} level ${s.level}, room on ${r && r.id}`); }
    if (ids(p) !== ids(m)) f.push(`${tag}: order ${ids(p)} vs mine ${ids(m)}`);
  }
  R.check(`S stops on ${plans.length} houses: overview first and last, every room once, levels lowest first (B first), nearest-neighbour order with plan-order ties (= mine)`, cut(f)); }

// ================= E. eyes and looks =================
{ const f = [], g = []; let n = 0;
  if (Math.abs((plans[0].p && plans[0].p.eyeFloor) - EYE_FLOOR) > 1e-9) f.push(`plan eyeFloor ${plans[0].p && plans[0].p.eyeFloor}, table gives ${EYE_FLOOR}`);
  if (Math.abs(EYE_FLOOR - 5.3299999) > 1e-3) R.note(`table eye floor ${EYE_FLOOR} (5.33 at the F4-T3 table)`);
  for (const { tag, h, p } of plans) { if (!p) continue; const m = mine(h);
    const byId = new Map(m.stops.map((s, i) => [s.kind === 'overview' ? 'O' + (i ? 1 : 0) : s.id, s]));
    p.stops.forEach((s, i) => { const k = s.kind === 'overview' ? 'O' + (i ? 1 : 0) : s.id, w = byId.get(k); n++;
      if (!w) return;
      const nudged = p.stops.some((q, j) => Math.abs(j - i) === 1 && (T.dist(q.eye, w.eye) < T.NUDGE || T.dist(q.look, w.look) < T.NUDGE));
      const tol = nudged ? T.NUDGE + 1e-6 : 1e-6;
      if (T.dist(s.look, w.look) > tol) f.push(`${tag} ${k}: look ${s.look.map((x) => x.toFixed(2))} vs ${w.look.map((x) => x.toFixed(2))}`);
      if (w.central) { const c = T.centreT(h, h.levels.flatMap((l) => l.rooms).find((r) => r.id === s.id)); if (Math.abs(s.eye[1] - w.eye[1]) > tol || s.eye[2] < c[2] - 1e-6) f.push(`${tag} ${k} (central room): eye ${s.eye.map((x) => x.toFixed(2))}, height ${w.eye[1].toFixed(2)} on the street side expected`); }
      else if (T.dist(s.eye, w.eye) > tol) f.push(`${tag} ${k}${w.level === 'B' ? ' (B)' : ''}: eye ${s.eye.map((x) => x.toFixed(2))} vs ${w.eye.map((x) => x.toFixed(2))}`);
      if (s.eye[1] < EYE_FLOOR - 1e-9) g.push(`${tag} ${k}: eye Y ${s.eye[1].toFixed(2)} below the floor ${EYE_FLOOR.toFixed(2)}`);
      if (i && (T.dist(s.eye, p.stops[i - 1].eye) < T.NUDGE - 1e-9 || T.dist(s.look, p.stops[i - 1].look) < T.NUDGE - 1e-9)) g.push(`${tag} stops ${i - 1}-${i}: points closer than 0.5 m`); }); }
  const low = plans.find((b) => /low/.test(b.tag)); if (low && low.p && !low.p.stops.some((s) => s.kind === 'room' && s.level === 'G' && Math.abs(s.eye[1] - EYE_FLOOR) < 1e-9)) g.push('low ceilings: no ground eye lifted to the floor');
  R.check(`E ${n} stops: eye / look = mine (look at floorY + 0.5; eye 0.6 max(w, d) + 2 m out at max(baseY, 0) + storeyH + 2.5, basement 1.5 m in at storeyH + ${T.PACE.bUp}); eye floor = (canopyY0 + canopyH) x scale[1] + 0.5 from the table`, cut(f));
  R.check(`E every stop eye >= the eye floor ${EYE_FLOOR.toFixed(2)} m (2.4 m ceilings: ground eyes lifted onto it); consecutive eyes and looks >= 0.5 m apart`, cut(g)); }

// ================= T. times =================
{ const f = [];
  for (const { tag, h, p } of plans) { if (!p) continue; const m = mine(h);
    p.stops.forEach((s, i) => { if (Math.abs(s.t - m.stops[i].t) > 1e-9) f.push(`${tag} stop ${i}: t ${s.t}, expected ${m.stops[i].t}`); });
    if (Math.abs(p.duration - m.duration) > 1e-9) f.push(`${tag}: duration ${p.duration}, expected ${m.duration}`); }
  const sd = plans[0].p && plans[0].p.duration, mx = plans.find((b) => /maximum/.test(b.tag));
  if (!PACEV) f.push(`PC.C.TOUR overviewLeg ${PC.C.TOUR.overviewLeg} / bEyeUp ${PC.C.TOUR.bEyeUp}: no approved pacing (QA pacing table not updated)`);
  if (!(Math.abs(sd - T.PACE.sample) < 1e-9)) f.push(`sample ${sd} s (${T.PACE.sample})`); if (!(sd >= 30 && sd <= 90)) f.push(`sample ${sd} s outside 30-90 s (F5-S2)`);
  if (mx && mx.p && Math.abs(mx.p.duration - T.PACE.max) > 1e-9) f.push(`maximum ${mx.p.duration} s (${T.PACE.max})`);
  const one = plans.find((b) => /one room/.test(b.tag)); if (one && one.p && (one.p.stops.length !== 3 || one.p.duration !== T.PACE.one)) f.push(`one room: ${one.p.stops.length} stops, ${one.p.duration} s (overview -> room -> overview, ${T.PACE.one} s)`);
  const sp = PC.C.TOUR && (PC.C.TOUR.speed || PC.C.TOUR.speeds); if (sp) { for (const [k, v] of Object.entries(T.SPEED)) if (Math.abs(sp[k] - v) > 1e-9) f.push(`speed ${k} ${sp[k]}, expected ${v}`); } else R.note(`T speed factors not found under PC.C.TOUR (${PC.C.TOUR ? Object.keys(PC.C.TOUR) : 'no TOUR'}); judged in the page`);
  R.check(`T stop times (${T.PACE_NAME} pacing): overview legs ${T.PACE.over} s, room legs 3.5 s; sample ${T.PACE.sample} s (inside 30-90 s), maximum ${T.PACE.max} s, one room ${T.PACE.one} s; speed factors 0.6 / 1 / 1.8`, cut(f)); }

// ================= C. fromEyeLook, clamp at stops, determinism =================
{ const f = [], g = [];
  if (typeof PC.cam.fromEyeLook !== 'function') f.push('PC.cam.fromEyeLook absent');
  for (const { tag, h, p } of plans) { if (!p) continue; const L = PC.cam.limits(h, ASP);
    for (const s of p.stops) { const mineP = T.fromEyeLook(s.eye, s.look);
      if (typeof PC.cam.fromEyeLook === 'function') { const a = PC.cam.fromEyeLook(s.eye, s.look), d = poseD(a, mineP); if (d) f.push(`${tag}: fromEyeLook ${d}`);
        const e = PC.cam.position ? PC.cam.position(a) : null, ev = e && (Array.isArray(e) ? e : [e.x, e.y, e.z]); if (ev && T.dist(ev, s.eye) > 1e-9) f.push(`${tag}: position(fromEyeLook) ${ev.map((x) => x.toFixed(3))} vs eye ${s.eye.map((x) => x.toFixed(3))}`); }
      const c = PC.cam.clamp(mineP, L), d = poseD(c, mineP); if (d) g.push(`${tag} ${s.kind === 'overview' ? 'overview' : s.id}: the clamp moves the stop pose (${d})`); } }
  const again = PC.tourplan.build(plans[0].h, ASP); if (JSON.stringify(again) !== JSON.stringify(plans[0].p)) f.push('sample: a second build differs');
  R.check('C fromEyeLook = mine (1e-9) and PC.cam.position of it returns the eye; the plan is deterministic', cut(f));
  R.check('C PC.cam.clamp leaves every stop pose unchanged on 5 houses (required item 3: the clamp acts only on overshoot)', cut(g)); }
function poseD(a, b) { if (!a || !b) return 'missing'; const o = []; if (a.target.some((x, i) => Math.abs(x - b.target[i]) > 1e-9)) o.push('target'); if (Math.abs(a.radius - b.radius) > 1e-9) o.push(`radius ${a.radius.toFixed(4)} / ${b.radius.toFixed(4)}`);
  if (Math.abs(a.phi - b.phi) > 1e-9) o.push(`phi ${(a.phi * 180 / Math.PI).toFixed(3)} / ${(b.phi * 180 / Math.PI).toFixed(3)}`); const dt = Math.abs(((a.theta - b.theta) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); if (dt > 1e-9) o.push('theta'); return o.join(', '); }
R.note(`node run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
