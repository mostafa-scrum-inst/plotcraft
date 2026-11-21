// F5-T1 QA (node): the pure room-finder parts in core/cam.js, judged by QA's own oracle (f5-t1-ref.mjs). Version-aware
// (plan 9): a section runs only once its marker exists, so a main tree without F5-T1 stays green with notes.
//   G PC.cam.roomGroups (marker): one group per level, lowest first, LEVEL_LABEL labels, rooms in plan order with the
//     plan names; sample 14 rooms / 2 groups, maximum house 40 / 4.
//   P PC.cam.forRoom (marker): every room of 4 houses (sample, sample with a 2 m² room, a basement house with edge
//     rooms, the 40-room maximum house) x 3 current thetas = my A-14 pose through my A-12 clamp (1e-9); theta kept;
//     phi 35 / 15 (basement); radius clamp(1.6 max(w, d) + storeyH, 6, 3 R); eye >= 1.0 m.
//   L limits (marker PC.cam.forRoom): target Y floor = the lowest floorY (-pitch + 0.2 with a basement), 0 without;
//     Reset unchanged.
//   B basement view (plan-review item 1): for every basement room and 8 current thetas the eye -> target segment
//     crosses Y = 0 inside the footprint.
// Run: node tests/qa/f5-t1-model.mjs [--only=G,P,L,B]   (--no-shots accepted and ignored)
import { collector } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';
import * as H from './f4-t1-ref.mjs';
import * as F from './f5-t1-ref.mjs';

const R = collector('F5-T1 model');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean), want = (s) => !only.length || only.includes(s);
const { PC } = H.loadPC3();
const t0 = Date.now();
const cut = (a, n = 8) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);
const HAS = { groups: !!(PC.cam && typeof PC.cam.roomGroups === 'function'), pose: !!(PC.cam && typeof PC.cam.forRoom === 'function') };
R.note(`markers: PC.cam.roomGroups ${HAS.groups}, PC.cam.forRoom ${HAS.pose}, PC.view3d.flyTo ${!!(PC.view3d && PC.view3d.flyTo)}, PC.three.finder ${!!(PC.three && PC.three.finder)}`);

function make(mut) { const s = Q.plain(PC.sample.state()); if (mut) mut(s); s.plans = {}; PC.plans.sync(s); for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; return s; }
const HOUSES = [
  ['sample', null],
  ['sample + a 2 m² storage room', (s) => { s.ans.rooms.push({ id: 'r' + s.ans.nextRoomId++, type: 'storage', level: 'G', size: null, area: 2, master: false }); }],
  ['basement house (B + G + 1 + 2, lift)', (s) => { s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; for (const l of ['B', 'B', 'B', '2']) s.ans.rooms.push({ id: 'r' + s.ans.nextRoomId++, type: 'storage', level: l, size: 'S', area: null, master: false }); }],
  ['maximum house (40 rooms)', (s) => { s.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; s.ans.streetEdge = 0; s.ans.footprintPct = 40; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.usableRoof = true; s.ans.roofType = 'terrace'; s.ans.pairs = []; s.ans.rooms = []; let n = 1;
    for (const l of ['B', 'G', '1', '2']) for (const ty of Object.keys(Q.ROOM_AREA)) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); s.ans.nextRoomId = n; }],
];
const built = HOUSES.map(([tag, mut]) => { const s = make(mut); return { tag, s, h: PC.house.build(s) }; });
for (const b of built) if (!b.h) R.check(`${b.tag}: house built`, ['no house']);
const ok = built.filter((b) => b.h);

// ================= G. room groups =================
if (want('G')) {
  if (!HAS.groups) R.note('G skipped: PC.cam.roomGroups absent (F5-T1 not merged)');
  else {
    const f = [];
    for (const { tag, h } of ok) {
      const got = PC.cam.roomGroups(h), mine = F.myGroups(h);
      const norm = (g) => (g || []).map((x) => ({ level: x.level, label: x.label, rooms: (x.rooms || []).map((r) => ({ id: r.id, name: r.name })) }));
      if (JSON.stringify(norm(got)) !== JSON.stringify(mine)) f.push(`${tag}: ${JSON.stringify(norm(got)).slice(0, 300)} vs mine ${JSON.stringify(mine).slice(0, 300)}`);
    }
    const n = (b) => F.myGroups(b.h).reduce((s, g) => s + g.rooms.length, 0);
    if (n(ok[0]) !== 14 || F.myGroups(ok[0].h).length !== 2) f.push(`sample: ${n(ok[0])} rooms in ${F.myGroups(ok[0].h).length} groups (14 / 2)`);
    const mx = ok.find((b) => /maximum/.test(b.tag)); if (mx && (n(mx) !== 40 || F.myGroups(mx.h).length !== 4)) f.push(`maximum: ${n(mx)} rooms in ${F.myGroups(mx.h).length} groups (40 / 4)`);
    R.check(`G roomGroups on ${ok.length} houses = one group per level, lowest first, LEVEL_LABEL labels, rooms in plan order with the plan names (sample 14 / 2, maximum 40 / 4)`, cut(f));
  }
}

// ================= P. finder pose =================
let SIG = null;
function appPose(h, lv, r, cur, L) {
  const tries = SIG ? [SIG] : ['room', 'room+level', 'id'];
  for (const sig of tries) { let p = null; try { p = PC.cam.forRoom(h, sig === 'id' ? r.id : sig === 'room+level' ? { ...r, level: lv.id } : r, cur, L); } catch (e) { p = null; }
    if (p && Array.isArray(p.target) && typeof p.radius === 'number') { SIG = sig; return p; } }
  return null;
}
if (want('P') || want('B')) {
  if (!HAS.pose) R.note('P / L / B skipped: PC.cam.forRoom absent (F5-T1 not merged)');
  else {
    const f = [], e1 = []; let n = 0;
    for (const { tag, h } of ok) { const L = PC.cam.limits(h, 1.6);
      for (const lv of h.levels) for (const r of lv.rooms) for (const th of [0.3, 2.5, -2]) {
        const cur = { ...PC.cam.reset(h, 1.6), theta: th }, got = appPose(h, lv, r, cur, L), mine = F.myClamp(F.myRawPose(h, r.id, cur), L, h); n++;
        if (!got) { f.push(`${tag} ${r.name}: forRoom gave no pose`); continue; }
        const d = F.poseDiff(got, mine, 1e-9); if (d) f.push(`${tag} ${r.name} (${lv.id}) theta ${th}: ${d}`);
        if (F.eyeOf(got)[1] < 1 - 1e-9) e1.push(`${tag} ${r.name}: eye at ${F.eyeOf(got)[1].toFixed(3)} m`);
      } }
    if (want('P')) { R.check(`P forRoom on ${n} cases (4 houses x every room x 3 current thetas) = my A-14 pose (target room centre at floorY + 0.5, theta kept, phi 35 / basement 15, radius clamp(1.6 max(w, d) + storeyH, 6, 3 R)) through my A-12 clamp, 1e-9; eye >= 1.0 m`, cut(f.concat(e1)));
      R.note(`P forRoom called as forRoom(house, ${SIG === 'id' ? 'roomId' : SIG === 'room+level' ? '{ ...room, level }' : 'room'}, current, limits)`); }
    // L: limits Y floor, Reset unchanged
    const g = [];
    for (const { tag, h } of ok) { const L = PC.cam.limits(h, 1.6), want0 = F.lowestFloorY(h);
      if (!L.box || Math.abs(L.box.y0 - want0) > 1e-9) g.push(`${tag}: target Y floor ${L.box && L.box.y0}, expected ${want0}`);
      const rs = PC.cam.reset(h, 1.6), rc = PC.cam.clamp(rs, L); if (F.poseDiff(rs, rc, 1e-12)) g.push(`${tag}: Reset clamped (${F.poseDiff(rs, rc)})`);
      const low = PC.cam.clamp({ ...rs, target: [0, -50, 0] }, L); if (Math.abs(low.target[1] - want0) > 1e-9) g.push(`${tag}: a pan below ground clamps to Y ${low.target[1]}`);
      if (F.eyeOf(low)[1] < 1 - 1e-9) g.push(`${tag}: eye ${F.eyeOf(low)[1]} below 1 m`); }
    if (want('P')) R.check('L A-12 limits: target Y floor = the lowest floorY (-pitch + 0.2 with a basement, 0 without); Reset is not clamped; a pan below ground stops at the floor with the eye >= 1.0 m', g);
    // B: basement view
    if (want('B')) { const b = []; let nb = 0;
      for (const { tag, h } of ok) { const lv = h.levels.find((l) => l.id === 'B'); if (!lv) continue; const L = PC.cam.limits(h, 1.6);
        for (const r of lv.rooms) for (let k = 0; k < 8; k++) { const cur = { ...PC.cam.reset(h, 1.6), theta: k * Math.PI / 4 }, p = appPose(h, lv, r, cur, L); nb++;
          if (!p) continue; const c = F.pitCrossing(h, p); if (!c.ok) b.push(`${tag} ${r.name} theta ${k * 45}: the eye line meets Y 0 at ${c.at && c.at.map((x) => x.toFixed(2))}, outside the footprint`); } }
      R.check(`B basement rooms (${nb} cases, 8 current thetas): the eye -> target line crosses ground level inside the footprint (phi 15 degrees, plan-review item 1)`, cut(b)); }
  }
}
R.note(`node run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
