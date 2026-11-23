// F4-T1 QA oracle (own expectations, written from A-5 / A-8 / A-9 / A-10 / A-12 and plan section 5; no FS / Designer
// helper is used for an expectation). Inputs taken as given: the state, PC.site.analyse's footprint (QA'd in F2) and the
// Designer's data tables (exteriors, roomTints, interiors) as they are.
//   frames  : W -> L by my own toL (F2 oracle), centre = bbox centre of the plot in L, L -> T: X = u - cu, Z = -(v - cv).
//   storeys : index B -1, G 0, 1, 2; pitch = Q8 + 0.2; baseY = index x pitch; floor = baseY + 0.2; walls 1.2 m.
//   core    : A-8 stair 2.5 x 4.0 long side along the longer footprint axis, lift 1.5 x 2.0 beside it across the band,
//             block flush in the named corner (f = low y, l = low x as seen from the street) or centred snapped down 0.5.
//   colours : my sRGB -> linear (IEC 61966-2-1) of the A-10 mix (per-channel sRGB lerp, rounded).
// summarize(world) runs in node (vm with the vendored r128) and in the page (real r128): world-space faces of every mesh.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';
import { mix } from './f3-t3-ref.mjs';

// core + data + three layers and the vendored three@0.128.0 in one vm context (no renderer is made in node)
export function loadPC3() {
  const man = JSON.parse(readFileSync(join(ROOT, 'src/manifest.json'), 'utf8'));
  const ctx = vm.createContext({ console });
  vm.runInContext(readFileSync(join(ROOT, 'tests/vendor/three-r128.min.js'), 'utf8'), ctx, { filename: 'three-r128.min.js' });
  for (const j of man.js) if (['core', 'data', 'three'].includes(j.layer)) vm.runInContext(readFileSync(join(ROOT, 'src', j.file), 'utf8'), ctx, { filename: j.file });
  return { PC: ctx.PC, THREE: ctx.THREE, ctx };
}

export const lin1 = (c) => { c /= 255; return c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const lin = (hex) => [1, 3, 5].map((i) => lin1(parseInt(hex.slice(i, i + 2), 16)));
const sameC = (a, b) => a && b && Math.abs(a[0] - b[0]) < 2e-5 && Math.abs(a[1] - b[1]) < 2e-5 && Math.abs(a[2] - b[2]) < 2e-5;
const near = (a, b, t = 1e-4) => Math.abs(a - b) <= t;
export const INDEX = { B: -1, G: 0, 1: 1, 2: 2 };
export const SLAB = 0.2, WALL_H = 1.2, TINT_LIFT = 0.015, CAP_LIFT = 0.01, DOOR = 1.2;

export function frameOf(state) {
  const pts = state.plot.pts, e = state.ans.streetEdge === null || state.ans.streetEdge === undefined ? Q.defaultStreetEdge(pts) : state.ans.streetEdge;
  const pL = Q.toL(pts, e);
  const xs = pL.map((p) => p[0]), ys = pL.map((p) => p[1]);
  const cu = (Math.min(...xs) + Math.max(...xs)) / 2, cv = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.max(...pL.map((p) => Math.hypot(p[0] - cu, p[1] - cv)));
  return { pL, cu, cv, R, X: (u) => u - cu, Z: (v) => -(v - cv), box: { x0: Math.min(...xs) - cu, x1: Math.max(...xs) - cu, z0: -(Math.max(...ys) - cv), z1: -(Math.min(...ys) - cv) } };
}
// my A-8 core in P
export function myCore(W, D, stairs, pos, lift) {
  if (!stairs) return { stair: null, lift: null };
  const deep = D >= W, sw = deep ? 2.5 : 4, sd = deep ? 4 : 2.5, lw = deep ? 1.5 : 2, ld = deep ? 2 : 1.5;
  const bw = deep ? sw + (lift ? lw : 0) : sw, bd = deep ? sd : sd + (lift ? ld : 0);
  let x, y;
  if (pos === 'centre') { x = Q.floor05((W - bw) / 2); y = Q.floor05((D - bd) / 2); } else { x = pos[1] === 'l' ? 0 : W - bw; y = pos[0] === 'f' ? 0 : D - bd; }
  return { stair: { x, y, w: sw, h: sd }, lift: lift ? (deep ? { x: x + sw, y, w: lw, h: ld } : { x, y: y + sd, w: lw, h: ld }) : null, block: { x, y, w: bw, h: bd } };
}
// T box of an L rectangle between heights
export const tBox = (F, r, y0, y1) => ({ min: [F.X(r.u), y0, F.Z(r.v + r.d)], max: [F.X(r.u + r.w), y1, F.Z(r.v)] });
const P2L = (fp, r) => ({ u: fp.u + r.x, v: fp.v + r.y, w: r.w, d: r.h });

// Expected model of a state, my own construction.
export function expected(state, fp, D) {
  const a = state.ans, F = frameOf(state), ids = Q.levelIds(a), stairs = Q.stairsExist(a), lift = !!a.lift && stairs, pitch = a.ceilingH + SLAB;
  const core = myCore(fp.w, fp.d, stairs, a.stairPos, lift), I = D.interiors[a.interior.style], E = D.exteriors[a.exterior], RT = D.roomTints;
  const types = Object.fromEntries(a.rooms.map((r) => [r.id, r.type]));
  return {
    F, fp, pitch, core, E, hall: lin(mix(RT.hall, I.wood, I.floorMix)), stairC: lin(RT.stair), liftC: lin(RT.lift),
    // F6-T2 I2 (PM Q4): floors = mix(floors[style][kind], roomTints[type], floors.tint), the hall floor of kind kind.hall
    ...(T2(D) ? { hallFloor: lin(mix(D.floors[a.interior.style][D.floors.kind.hall], RT.hall, D.floors.tint)), hallKind: D.floors.kind.hall } : {}),
    roofBaseY: (INDEX[ids[ids.length - 1]] + 1) * pitch,
    levels: ids.map((id) => {
      const index = INDEX[id], baseY = index * pitch, floorY = baseY + SLAB;
      return { id, index, baseY, floorY, top: floorY + WALL_H,
        stair: core.stair && P2L(fp, core.stair), lift: core.lift && P2L(fp, core.lift),
        rooms: state.plans[id].rooms.map((r) => ({ id: r.id, type: types[r.id], L: P2L(fp, r), c: lin(mix(RT[types[r.id]], I.wood, I.floorMix)),
          ...(T2(D) ? { kind: D.floors.kind[types[r.id]], fc: lin(mix(D.floors[a.interior.style][D.floors.kind[types[r.id]]], RT[types[r.id]], D.floors.tint)) } : {}) })) };
    })
  };
}

// ---------- geometry summary (runs in node or in the page; no THREE needed) ----------
export const SUMMARIZE = `(function (world) {
  world.updateMatrixWorld(true);
  var out = [];
  function vis(o) { for (var n = o; n; n = n.parent) if (!n.visible) return false; return true; }
  world.traverse(function (o) {
    if (!o.isMesh && !o.isInstancedMesh) { return; }
    var g = o.geometry, p = g.getAttribute('position'), c = g.getAttribute('color'), nn = g.getAttribute('normal'), e = o.matrixWorld.elements, idx = g.getIndex();
    var pos = [], col = c ? Array.prototype.slice.call(c.array) : null, nor = [];
    for (var i = 0; i < p.count; i++) {
      var x = p.array[3 * i], y = p.array[3 * i + 1], z = p.array[3 * i + 2];
      pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      if (nn) { var a = nn.array[3 * i], b = nn.array[3 * i + 1], d = nn.array[3 * i + 2]; nor.push(e[0] * a + e[4] * b + e[8] * d, e[1] * a + e[5] * b + e[9] * d, e[2] * a + e[6] * b + e[10] * d); }
    }
    var path = []; for (var q = o.parent; q && q !== world; q = q.parent) path.unshift(q.name);
    var m = o.material, mc = m && m.color && !m.vertexColors ? [m.color.r, m.color.g, m.color.b] : null;
    out.push({ name: o.name, path: path.join('/'), group: path[path.length - 1] || '', visible: vis(o), castShadow: !!o.castShadow, receiveShadow: !!o.receiveShadow,
      pos: pos, col: col, nor: nor, idx: idx ? Array.prototype.slice.call(idx.array) : null, mc: mc, vertexColors: !!(m && m.vertexColors), mat: m && m.type,
      kinds: o.userData && o.userData.items ? o.userData.items.map(function (x) { return [x[0], x[1]]; }) : null });
  });
  return out;
})`;
export const summarize = (world) => (0, eval)(SUMMARIZE)(world);

// faces of a batch mesh: groups of 4 vertices (each face planar, axis aligned, one colour)
// F6-T1b (plan §6.2: new items are appended as new kinds and the oracles filter by userData.items kind): the contact
// skirt / floor ring and the opening decals (glass, reveal) are set aside in m.extra; the rest is judged as before.
export const NEW_KINDS = ['skirt', 'ring', 'glass', 'reveal'];
function splitKinds(m) {
  if (!m.kinds || !m.kinds.some(([k]) => NEW_KINDS.includes(k))) return { m, extra: [] };
  const pos = [], col = m.col ? [] : null, nor = [], extra = []; let v = 0;
  for (const [k, n] of m.kinds) {
    const sl = (a) => (a && a.length ? a.slice(3 * v, 3 * (v + n)) : []);
    if (NEW_KINDS.includes(k)) { const P = sl(m.pos), C = sl(m.col); const ys = [], xs = [], zs = []; for (let i = 0; i < P.length; i += 3) { xs.push(P[i]); ys.push(P[i + 1]); zs.push(P[i + 2]); }
      extra.push({ kind: k, n, min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)], max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)], pos: P, col: C }); }
    else { pos.push(...sl(m.pos)); if (col) col.push(...sl(m.col)); nor.push(...sl(m.nor)); }
    v += n;
  }
  return { m: { ...m, pos, col, nor }, extra };
}
export function faces(m0) {
  const { m, extra } = splitKinds(m0);
  const f = [], bad = [];
  if (m.pos.length % 12) bad.push(`${m.path}/${m.name}: ${m.pos.length / 3} vertices, not a multiple of 4`);
  for (let i = 0; i + 12 <= m.pos.length; i += 12) {
    const P = [0, 1, 2, 3].map((k) => m.pos.slice(i + 3 * k, i + 3 * k + 3)), min = [0, 1, 2].map((a) => Math.min(...P.map((p) => p[a]))), max = [0, 1, 2].map((a) => Math.max(...P.map((p) => p[a])));
    const c = m.col ? m.col.slice(i, i + 3) : null, n = m.nor.length ? m.nor.slice(i, i + 3).map((x) => Math.round(x)) : null;
    if (m.col) for (let k = 1; k < 4; k++) if (!sameC(c, m.col.slice(i + 3 * k, i + 3 * k + 3))) { bad.push(`${m.path}/${m.name}: face ${i / 12} has two colours`); break; }
    f.push({ min, max, c, n });
  }
  return { f, bad, extra };
}
const fmt = (b) => `[${b.min.map((x) => x.toFixed(3))}]..[${b.max.map((x) => x.toFixed(3))}]`;
const boxEq = (a, b, t = 2e-4) => [0, 1, 2].every((i) => near(a.min[i], b.min[i], t) && near(a.max[i], b.max[i], t));
const union = (fs) => fs.length ? { min: [0, 1, 2].map((i) => Math.min(...fs.map((f) => f.min[i]))), max: [0, 1, 2].map((i) => Math.max(...fs.map((f) => f.max[i]))) } : null;

// F6-T1b marker: the exteriors table gains frame / door (impl-notes T1b data keys)
export const T1B = (D) => Object.values(D.exteriors || {}).some((e) => e && e.frame);
// F6-T2 marker: the floors table (plan I2). My constants (Designer plan I2 cell table, T1b plan §6.2 ring, FS S2 / PM Q4
// heights): hall floor at floor + tintLift, room floors 0.01 above it, rugs 0.01 above those; tiles on the world L grid.
export const T2 = (D) => !!(D.floors && D.floors.kind);
// F6-T2 TL gate ruling (plan-review addendum, 6a37669): furniture and textured-* are hidden in exterior mode (Roof on, level
// All) and drawn in the dollhouse. Marker until FS lands it: scene.js hides them by name (QA_SRC copies respected).
export const EXT_HIDE = (() => { try { return /['"]furniture['"][^\n]*textured-[^\n]*visible\s*=\s*!\s*ext/.test(readFileSync(join(process.env.QA_SRC || join(ROOT, 'src'), 'js/three/scene.js'), 'utf8')); } catch (e) { return false; } })();
const INNER = (n) => n === 'furniture' || /^textured-/.test(n);
export const TILE_M = { planks: 1.2, tile: 1.2, carpet: 0.5 }, RING_W = 0.3, RING_K = 0.9, FLOOR_STEP = 0.01, RUG_LIFT = 0.01, ROOM_INSET = 0.15;
// textured-<level> floors against my oracle: the hall covers the footprint, each room is tiled exactly by its own quads
// (area, inside the room, each quad inside one tileM cell of the L grid), vertex colour = my mix x my ring factor.
function floorProblems(tx, L, X) {
  const P = [], F = X.F, yH = L.floorY + TINT_LIFT, yR = yH + FLOOR_STEP, yG = yR + RUG_LIFT;
  const q = { hallFloor: [], floor: [], rug: [] }; let v = 0;
  for (const [k, n] of tx.kinds || []) {
    if (q[k]) { if (n !== 4) P.push(`${L.id}: ${k} item of ${n} vertices`); else q[k].push([0, 1, 2, 3].map((i) => ({ u: tx.pos[3 * (v + i)] + F.cu, y: tx.pos[3 * (v + i) + 1], v: F.cv - tx.pos[3 * (v + i) + 2], c: tx.col.slice(3 * (v + i), 3 * (v + i) + 3) }))); }
    v += n;
  }
  const bb = (Q) => ({ u0: Math.min(...Q.map((p) => p.u)), u1: Math.max(...Q.map((p) => p.u)), v0: Math.min(...Q.map((p) => p.v)), v1: Math.max(...Q.map((p) => p.v)) });
  const oneCell = (b, t) => Math.floor(b.u0 / t + 1e-6) === Math.floor(b.u1 / t - 1e-6) && Math.floor(b.v0 / t + 1e-6) === Math.floor(b.v1 / t - 1e-6);
  const area = (b) => (b.u1 - b.u0) * (b.v1 - b.v0);
  const tile = (Q, r, y, t, what) => { const f = []; let a = 0;
    for (const Qd of Q) { const b = bb(Qd); a += area(b);
      if (Qd.some((p) => Math.abs(p.y - y) > 1e-5)) { f.push(`${what}: a quad at Y ${Qd[0].y.toFixed(4)}, want ${y.toFixed(4)}`); break; }
      if (b.u0 < r.u - 1e-4 || b.u1 > r.u + r.w + 1e-4 || b.v0 < r.v - 1e-4 || b.v1 > r.v + r.d + 1e-4) { f.push(`${what}: a quad outside`); break; }
      if (!oneCell(b, t)) { f.push(`${what}: quad [${b.u0.toFixed(3)}..${b.u1.toFixed(3)}] x [${b.v0.toFixed(3)}..${b.v1.toFixed(3)}] spans two ${t} m cells`); break; } }
    if (Math.abs(a - r.w * r.d) > 1e-3) f.push(`${what}: quads cover ${a.toFixed(4)} m², want ${(r.w * r.d).toFixed(4)}`);
    return f; };
  const fp = X.fp;
  P.push(...tile(q.hallFloor, fp, yH, TILE_M[X.hallKind], `${L.id} hall floor`).map((x) => x));
  if (q.hallFloor.some((Qd) => Qd.some((p) => !sameC(p.c, X.hallFloor)))) P.push(`${L.id}: hall floor not my ${X.hallKind} / hall mix`);
  const left = q.floor.slice();
  for (const r of L.rooms) {
    const R = r.L, mine = [], k = Math.min(RING_W, Math.min(R.w, R.d) / 2 - 0.01);
    for (let i = left.length - 1; i >= 0; i--) { const b = bb(left[i]), cu = (b.u0 + b.u1) / 2, cv = (b.v0 + b.v1) / 2; if (cu > R.u && cu < R.u + R.w && cv > R.v && cv < R.v + R.d) mine.push(...left.splice(i, 1)); }
    if (!mine.length) { P.push(`${L.id}: no floor quads for ${r.id} (${r.type})`); continue; }
    P.push(...tile(mine, R, yR, TILE_M[r.kind], `${L.id} ${r.id} (${r.type}, ${r.kind})`));
    let bad = 0, ex = '';
    for (const Qd of mine) for (const p of Qd) { const dd = Math.min(p.u - R.u, R.u + R.w - p.u, p.v - R.v, R.v + R.d - p.v), f = k > 0 ? RING_K + (1 - RING_K) * Math.min(1, Math.max(0, dd) / k) : 1, want = r.fc.map((x) => x * f);
      if (!sameC(p.c, want)) { bad++; ex = ex || `at ${dd.toFixed(3)} m from the wall ${p.c.map((x) => x.toFixed(4))} != my ${want.map((x) => x.toFixed(4))}`; } }
    if (bad) P.push(`${L.id}: ${r.id} (${r.type}) floor colour ${bad} vertices off my mix x ring (${ex})`);
    // the ring factor is linear only between the ring lines, so no quad may straddle one (else the shade interpolates wrong)
    if (k > 0) { const lu = [R.u + k, R.u + R.w - k], lv = [R.v + k, R.v + R.d - k];
      if (mine.some((Qd) => { const b = bb(Qd); return lu.some((x) => x > b.u0 + 1e-6 && x < b.u1 - 1e-6) || lv.some((x) => x > b.v0 + 1e-6 && x < b.v1 - 1e-6); })) P.push(`${L.id}: ${r.id} a floor quad straddles a ring line ${k.toFixed(3)} m in`); }
  }
  if (left.length) P.push(`${L.id}: ${left.length} floor quad(s) in no room`);
  for (const Qd of q.rug) { const b = bb(Qd);
    if (Qd.some((p) => Math.abs(p.y - yG) > 1e-5)) { P.push(`${L.id}: a rug quad at Y ${Qd[0].y.toFixed(4)}, want ${yG.toFixed(4)}`); break; }
    if (!L.rooms.some((r) => b.u0 >= r.L.u + ROOM_INSET - 1e-4 && b.u1 <= r.L.u + r.L.w - ROOM_INSET + 1e-4 && b.v0 >= r.L.v + ROOM_INSET - 1e-4 && b.v1 <= r.L.v + r.L.d - ROOM_INSET + 1e-4)) { P.push(`${L.id}: a rug quad outside every room's inset rectangle`); break; }
    if (!oneCell(b, TILE_M.carpet)) { P.push(`${L.id}: a rug quad spans two carpet cells`); break; } }
  return P;
}
// my footprint ring width (plan §6.2 item 3): min(0.8, free distance from the footprint to the plot outline - 0.05), 0 below 0.01
export function myFootW(pL, fp) {
  const cs = [[fp.u, fp.v], [fp.u + fp.w, fp.v], [fp.u + fp.w, fp.v + fp.d], [fp.u, fp.v + fp.d]];
  const seg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  let d = Infinity; for (let i = 0; i < pL.length; i++) { const a = pL[i], b = pL[(i + 1) % pL.length]; for (const c of cs) d = Math.min(d, seg(c, a, b)); for (let j = 0; j < 4; j++) d = Math.min(d, seg(a, cs[j], cs[(j + 1) % 4])); }
  const w = Math.min(0.8, d - 0.05); return w > 0.01 ? w : 0;
}
// Problems of a world summary against my expectation. opts.level: the selected level ('all' | id) -> visibility rules.
export function shellProblems(sum, X, D, opts = {}) {
  const P = [], F = X.F, fpT = tBox(F, X.fp, 0, 0);
  const groups = [...new Set(sum.map((m) => m.group))];
  // levels
  const wantGroups = X.levels.map((l) => 'level-' + l.id), haveGroups = groups.filter((g) => g.startsWith('level-'));
  if (wantGroups.join() !== [...haveGroups].sort((a, b) => wantGroups.indexOf(a) - wantGroups.indexOf(b)).join() || haveGroups.length !== wantGroups.length) P.push(`level groups ${haveGroups} != ${wantGroups}`);
  const otherWall = Object.entries(D.exteriors).filter(([, e]) => e.wall !== X.E.wall).map(([, e]) => lin(e.wall));
  for (const L of X.levels) {
    const ms = sum.filter((m) => m.group === 'level-' + L.id);
    const slab = ms.find((m) => m.name === 'slab'), walls = ms.find((m) => m.name === 'walls');
    if (!slab || !walls) { P.push(`${L.id}: slab ${!!slab} walls ${!!walls}`); continue; }
    const S = faces(slab), W = faces(walls); P.push(...S.bad, ...W.bad);
    if (T2(D)) {   // F6-T2 I2: floors, rings and tints left the slab batch for textured-<level> (a level with rooms only)
      if (S.extra.length) P.push(`${L.id}: ${S.extra.length} ring / extra quads still in the slab batch`);
      const tx = ms.find((m) => m.name === 'textured-' + L.id);
      if (!L.rooms.length) { if (tx) P.push(`${L.id}: textured mesh on a level without rooms`); }
      else if (!tx) P.push(`${L.id}: no textured-${L.id} mesh`);
      else P.push(...floorProblems(tx, L, X));
      const sk = W.extra.filter((e) => e.kind === 'skirt');
      if (L.index === 0 ? !sk.length || sk.some((e) => e.max[1] > L.floorY + 0.6 + 1e-3 && e.max[1] > 0.6 + 1e-3) : sk.length) P.push(`${L.id}: ${sk.length} skirt quads${L.index === 0 ? ' (want some, <= 0.6 m high)' : ' (ground floor only)'}`); }
    else if (T1B(D)) {   // plan §6.2: 4 ring quads per room in the slab batch just above its tint quad; skirts only on the ground floor
      const rings = S.extra.filter((e) => e.kind === 'ring'), sk = W.extra.filter((e) => e.kind === 'skirt');
      if (rings.length !== 4 * L.rooms.length) P.push(`${L.id}: ${rings.length} floor-ring quads, want 4 x ${L.rooms.length} rooms`);
      if (rings.some((e) => e.min[1] < L.floorY + TINT_LIFT - 1e-6 || e.max[1] > L.floorY + TINT_LIFT + 0.01)) P.push(`${L.id}: a floor-ring quad off the tint height`);
      if (L.index === 0 ? !sk.length || sk.some((e) => e.max[1] > L.floorY + 0.6 + 1e-3 && e.max[1] > 0.6 + 1e-3) : sk.length) P.push(`${L.id}: ${sk.length} skirt quads${L.index === 0 ? ' (want some, <= 0.6 m high)' : ' (ground floor only)'}`); }
    // slab box: bottom at baseY, top at floorY with the hall tint, footprint size
    const slabBox = union(S.f.filter((f) => !(f.n && f.n[1] === 1 && near(f.min[1], L.floorY + TINT_LIFT))));
    const wantSlab = tBox(F, X.fp, L.baseY, L.floorY);
    if (!slabBox || !boxEq(slabBox, wantSlab)) P.push(`${L.id}: slab box ${slabBox && fmt(slabBox)} != ${fmt(wantSlab)} (footprint in T, Y baseY ${L.baseY.toFixed(2)}..floor ${L.floorY.toFixed(2)})`);
    const top = S.f.filter((f) => f.n && f.n[1] === 1 && near(f.min[1], L.floorY));
    if (top.length !== 1 || !sameC(top[0].c, X.hall) || !boxEq(top[0], { min: [wantSlab.min[0], L.floorY, wantSlab.min[2]], max: [wantSlab.max[0], L.floorY, wantSlab.max[2]] })) P.push(`${L.id}: slab top face not one hall-tinted footprint face (${top.length})`);
    // tint quads = approved plan rooms (position, size, colour by type)
    const quads = S.f.filter((f) => f.n && f.n[1] === 1 && near(f.min[1], L.floorY + TINT_LIFT)), left = quads.slice();
    for (const r of T2(D) ? [] : L.rooms) {
      const want = tBox(F, r.L, L.floorY + TINT_LIFT, L.floorY + TINT_LIFT), k = left.findIndex((q) => boxEq(q, want));
      if (k < 0) { P.push(`${L.id}: no tint quad for ${r.id} (${r.type}) at ${fmt(want)}`); continue; }
      if (!sameC(left[k].c, r.c)) P.push(`${L.id}: ${r.id} (${r.type}) tint ${left[k].c.map((x) => x.toFixed(4))} != my mix ${r.c.map((x) => x.toFixed(4))}`);
      left.splice(k, 1);
    }
    if (left.length) P.push(`${L.id}: ${left.length} tint quad(s) for no room`);
    // dollhouse: nothing above the 1.2 m walls, nothing below the slab
    const all = union(S.f.concat(W.f));
    const yTop = L.index < 0 ? Math.max(0, L.floorY) : L.top;
    if (all && (all.max[1] > yTop + 2e-4 || all.min[1] < L.baseY - 2e-4)) P.push(`${L.id}: geometry Y ${all.min[1].toFixed(3)}..${all.max[1].toFixed(3)} outside ${L.baseY.toFixed(3)}..${yTop.toFixed(3)}`);
    // stair / lift: one box each, at my core, floor to wall top, on this level
    for (const [k, c] of [['stair', X.stairC], ['lift', X.liftC]]) {
      const fs = W.f.filter((f) => sameC(f.c, c));
      if (!L[k]) { if (fs.length) P.push(`${L.id}: ${k} drawn but none expected`); continue; }
      const want = tBox(F, L[k], L.floorY, L.top), got = union(fs);
      if (fs.length !== 6 || !boxEq(got, want)) P.push(`${L.id}: ${k} ${fs.length} faces at ${got && fmt(got)}, want one box at ${fmt(want)}`);
    }
    // exterior walls: Q10 wall colour on the footprint outline, floor to wall top (basement: pit in the slab colour up to 0)
    const ext = W.f.filter((f) => sameC(f.c, lin(L.index < 0 ? X.E.slab : X.E.wall))), eb = union(ext);
    const wantE = tBox(F, X.fp, L.floorY, L.index < 0 ? 0 : L.top);
    if (!eb || !boxEq(eb, wantE)) P.push(`${L.id}: exterior wall extent ${eb && fmt(eb)} != ${fmt(wantE)}`);
    if (L.index >= 0 && W.f.some((f) => otherWall.some((c) => sameC(f.c, c)))) P.push(`${L.id}: a wall in another exterior's colour`);
    // entrance gap: on the ground floor no front-wall face covers the door centre
    if (L.index === 0) {
      const xd = F.X(X.fp.u + X.fp.w / 2), zf = F.Z(X.fp.v);
      const cover = ext.filter((f) => f.max[2] >= zf - 0.16 && f.min[2] <= zf + 1e-4 && f.min[0] < xd - DOOR / 2 + 0.01 && f.max[0] > xd + DOOR / 2 - 0.01);
      if (cover.length) P.push('G: the front wall has no entrance gap at the door');
    }
    // visibility (level selector): level k shown iff k <= selected index (All: every level)
    if (opts.level) {
      const sel = X.levels.find((l) => l.id === opts.level), topI = sel ? sel.index : Infinity, want = L.index <= topI;
      // exterior mode = Roof on with All: the roof group is shown (EXT_HIDE: the enclosed interior is not drawn there)
      const ext = opts.level === 'all' && sum.some((m) => m.group === 'roof' && m.visible);
      const wantOf = (m) => (EXT_HIDE && INNER(m.name) ? want && !ext : want);
      // F6-T2 N4: glow-<id> is shown only at indoor > 0, so it may be hidden on a shown level, never shown on a hidden one
      if (EXT_HIDE && ms.some((m) => INNER(m.name) && m.visible !== wantOf(m))) P.push(`level ${opts.level}${ext ? ' (exterior: Roof on, All)' : ''}: ${L.id} furniture / textured visible ${ms.filter((m) => INNER(m.name)).map((m) => m.visible)} want ${want && !ext}`);
      else if (ms.some((m) => (/^glow-/.test(m.name) ? m.visible && !want : m.visible !== wantOf(m)))) P.push(`level ${opts.level}: ${L.id} visible ${ms.map((m) => m.visible)} want ${want}`);
    }
  }
  // ground: plot shape with the footprint hole, cap over the footprint (hidden in the basement view), outer plane below
  const gp = sum.find((m) => m.name === 'groundPlot'), cap = sum.find((m) => m.name === 'groundCap'), outer = sum.find((m) => m.name === 'groundOuter');
  if (!gp || !cap || !outer) P.push(`ground meshes plot ${!!gp} cap ${!!cap} outer ${!!outer}`);
  else {
    const V = [], ys = []; for (let i = 0; i < gp.pos.length; i += 3) { V.push([gp.pos[i], gp.pos[i + 2]]); ys.push(gp.pos[i + 1]); }
    if (ys.some((y) => Math.abs(y) > 1e-5)) P.push('groundPlot not at Y 0');
    const plotT = F.pL.map((p) => [F.X(p[0]), F.Z(p[1])]);
    const miss = plotT.filter((q) => !V.some((v) => near(v[0], q[0], 1e-4) && near(v[1], q[1], 1e-4)));
    if (miss.length) P.push(`groundPlot misses plot corners ${JSON.stringify(miss)}`);
    let area = 0; const tri = gp.idx || V.map((_, i) => i), plotPoly = plotT.map((p) => [p[0], -p[1]]);
    let outside = 0, inHole = 0;
    for (let i = 0; i < tri.length; i += 3) {
      const [a, b, c] = [V[tri[i]], V[tri[i + 1]], V[tri[i + 2]]];
      area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
      const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
      if (!Q.inPoly([m[0], -m[1]], plotPoly)) outside++;
      if (m[0] > fpT.min[0] + 1e-6 && m[0] < fpT.max[0] - 1e-6 && m[1] > fpT.min[2] + 1e-6 && m[1] < fpT.max[2] - 1e-6) inHole++;
    }
    const fw = T1B(D) ? myFootW(F.pL, X.fp) : 0, want = Math.abs(Q.signedArea(F.pL)) - (X.fp.w + 2 * fw) * (X.fp.d + 2 * fw);
    if (!near(area, want, 1e-3)) P.push(`groundPlot area ${area.toFixed(3)} != plot - footprint${fw ? ` grown by my ring ${fw.toFixed(3)} m` : ''} ${want.toFixed(3)}`);
    if (T1B(D)) { const rg = sum.find((m) => m.name === 'groundRing');
      if (fw > 0) { if (!rg) P.push(`no groundRing (ring ${fw.toFixed(3)} m)`); else { let ra = 0; const I = rg.idx || rg.pos.map((_, i) => i).filter((i) => i < rg.pos.length / 3);
          for (let i = 0; i < I.length; i += 3) { const [a, b, c] = [I[i], I[i + 1], I[i + 2]].map((j) => [rg.pos[3 * j], rg.pos[3 * j + 2]]); ra += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2; }
          const wantR = (X.fp.w + 2 * fw) * (X.fp.d + 2 * fw) - X.fp.w * X.fp.d; if (!near(ra, wantR, 1e-3)) P.push(`groundRing area ${ra.toFixed(3)} != the band ${wantR.toFixed(3)}`); } }
      else if (rg) P.push('groundRing drawn with no free distance'); }
    if (outside || inHole) P.push(`groundPlot triangles outside the plot ${outside}, inside the footprint ${inHole}`);
    const cb = union(faces({ ...cap, col: null }).f);
    if (!cb || !boxEq(cb, { min: [fpT.min[0], CAP_LIFT, fpT.min[2]], max: [fpT.max[0], CAP_LIFT, fpT.max[2]] })) P.push(`groundCap ${cb && fmt(cb)} not the footprint at Y ${CAP_LIFT}`);
    if (opts.level && cap.visible !== (opts.level !== 'B')) P.push(`level ${opts.level}: groundCap visible ${cap.visible}`);
    const ob = union(faces({ ...outer, col: null }).f);
    if (!ob || ob.min[1] > -0.01 || ob.min[0] > F.box.x0 || ob.max[0] < F.box.x1 || ob.min[2] > F.box.z0 || ob.max[2] < F.box.z1) P.push('groundOuter not below and around the plot');
  }
  const roof = sum.filter((m) => m.group === 'roof');
  if (opts.level && opts.level !== 'all' && roof.some((m) => m.visible)) P.push('roof visible with a single level selected');
  return P;
}

// Q14 seen from the street (A-8 / A-5): the street is the +Z side of T and the viewer there faces -Z, so the viewer's left
// is -X. fl = min X / max Z, fr = max X / max Z, bl = min X / min Z, br = max X / min Z; centre = block centred (snap 0.5).
export function q14Problems(pos, stairT, liftT, fpT) {
  if (!stairT) return ['no stair box'];
  const P = [], b = liftT ? union([stairT, liftT]) : stairT;
  if (pos === 'centre') {
    const cx = (fpT.min[0] + fpT.max[0]) / 2, cz = (fpT.min[2] + fpT.max[2]) / 2, bx = (b.min[0] + b.max[0]) / 2, bz = (b.min[2] + b.max[2]) / 2;
    if (Math.abs(bx - cx) > 0.5 + 1e-6 || Math.abs(bz - cz) > 0.5 + 1e-6) P.push(`centre: block centre (${bx.toFixed(2)}, ${bz.toFixed(2)}) not within 0.5 of the footprint centre (${cx.toFixed(2)}, ${cz.toFixed(2)})`);
    return P;
  }
  const left = pos[1] === 'l', front = pos[0] === 'f';
  if (!near(left ? b.min[0] : b.max[0], left ? fpT.min[0] : fpT.max[0])) P.push(`${pos}: block X ${b.min[0].toFixed(2)}..${b.max[0].toFixed(2)} not flush with the ${left ? 'left (min X)' : 'right (max X)'} wall ${(left ? fpT.min[0] : fpT.max[0]).toFixed(2)}`);
  if (!near(front ? b.max[2] : b.min[2], front ? fpT.max[2] : fpT.min[2])) P.push(`${pos}: block Z ${b.min[2].toFixed(2)}..${b.max[2].toFixed(2)} not flush with the ${front ? 'front (street, max Z)' : 'back (min Z)'} wall ${(front ? fpT.max[2] : fpT.min[2]).toFixed(2)}`);
  return P;
}
// stair / lift T boxes of one level found by colour in a summary
export function coreBoxes(sum, id, X) {
  const w = sum.find((m) => m.group === 'level-' + id && m.name === 'walls'); if (!w) return {};
  const f = faces(w).f; return { stair: union(f.filter((x) => sameC(x.c, X.stairC))), lift: union(f.filter((x) => sameC(x.c, X.liftC))) };
}

// ---------- camera (A-12), my own ----------
const D2R = Math.PI / 180;
export const eyeOf = (p) => [p.target[0] + p.radius * Math.sin(p.phi) * Math.sin(p.theta), p.target[1] + p.radius * Math.cos(p.phi), p.target[2] + p.radius * Math.sin(p.phi) * Math.cos(p.theta)];
// project a T point with a perspective camera at the pose (vertical fov, aspect) -> NDC [x, y] (null behind the eye)
export function project(p, aspect, fovDeg, q) {
  const e = eyeOf(p), t = p.target, f = norm(sub(t, e)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), d = sub(q, e);
  const z = dot(d, f); if (z <= 0) return null;
  const k = 1 / Math.tan(fovDeg / 2 * D2R);
  return [dot(d, r) / z * k / aspect, dot(d, u) / z * k];
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
// clamp problems of one pose (A-12 limits from my own frame)
export function poseProblems(p, F, roofBaseY, rMaxWant) {
  const P = [], phi = p.phi / D2R, e = eyeOf(p);
  if (phi < 5 - 1e-6 || phi > 85 + 1e-6) P.push(`phi ${phi.toFixed(3)}`);
  if (e[1] < 1 - 1e-6) P.push(`eye Y ${e[1].toFixed(3)}`);
  if (p.radius < 4 - 1e-6 || (rMaxWant && p.radius > rMaxWant + 1e-6)) P.push(`radius ${p.radius.toFixed(3)}`);
  const t = p.target, b = F.box;
  if (t[0] < b.x0 - 1e-6 || t[0] > b.x1 + 1e-6 || t[2] < b.z0 - 1e-6 || t[2] > b.z1 + 1e-6 || t[1] < -1e-6 || t[1] > roofBaseY + 1e-6) P.push(`target ${t.map((x) => x.toFixed(2))} outside the plot box`);
  return P;
}
