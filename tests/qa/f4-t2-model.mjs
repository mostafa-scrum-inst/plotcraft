// F4-T2 QA (node): the F4-T2 house model and its 3D batches, built on the vendored real three@0.128.0 in a vm (no
// renderer), judged by QA's own oracles. TL impl-review focus list (docs/03-tasks/F4-T2/impl-review.md):
//   F furniture: every room = QA's A-11 placement (f3-t3-ref.mjs furnish) mapped to L, Q18 hex, sparse and full in
//     each style; inside its room (0.15 m to each wall), off the core, clear of the entrance gap; in T the furniture
//     batch has one box per piece at floor + y0; Q18 changes colours only (boxes equal) and keeps plan signatures.
//   R roof: flat / pitched / terrace x usable x lift; the model (never pitched when usable, stair head, lift overrun);
//     geometry in T (slab, parapet 0.3 / 1.0, pergola over the back third, 30 degree gable along the longer side with
//     wall-coloured gables, heads 2.4 / 1.2 m); closed with the roof on (horizontal rays from outside hit the facade
//     at every storey height, the door stays open); outward winding of every roof / site triangle.
//   W wall and gate: gate at 25 / 50 / 75 % of the street edge (also slanted and non-rectangular plots), none without
//     the wall; wall segments 0.2 m inside every edge, 1.2 m high, the 3 m gap only at the gate, posts flush with it.
//   S seating: QA's exhaustive 0.5 m search per yard: the chosen yard is the first one with room in the order back,
//     wider side, other side, front; the pad valid; omitted only when nothing fits (warning text, q 17); 3D pieces.
//   P pool water flush with the rim, canopy top 2.4 m on 4 posts, pads; needle: QA's corner walk, L, and its N tip
//     along the W north of Q5 mapped to T by QA's own frame (rotated plots, several Q5 values).
//   B budget: maximum house (4 x 10 rooms of all types, full, lift, pool L, 4 covered cars, wall, gate, seating,
//     usable terrace) <= 18 meshes; sample 12.
// Run: node tests/qa/f4-t2-model.mjs [--only=F,R,...]   (--no-shots accepted and ignored)
import { collector } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';
import * as H from './f4-t1-ref.mjs';
import { furnish, loadTables } from './f3-t3-ref.mjs';
import { grow, rOver, rectIn, bboxL, myGateU, myBlocked, myPads, myYardOrder, myNeedle, distSeg } from './f4-t2-ref.mjs';

const R = collector('F4-T2 model');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean), want = (s) => !only.length || only.includes(s);
const { PC, THREE } = H.loadPC3();
const T3 = loadTables();   // QA's own read of the Designer's tables (furniture, interiors, exteriors, siteColors)
const t0 = Date.now();
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, t = 1e-4) => Math.abs(a - b) <= t;
const cut = (a, n = 6) => a.slice(0, n).concat(a.length > n ? [`... ${a.length} in all`] : []);
const SEAT_TEXT = 'Garden seating does not fit in the yard: it is left out of the 3D scene. Try a lower footprint %, fewer cars or a smaller pool.';

function make(mut) { const s = Q.plain(PC.sample.state()); if (mut) mut(s); s.plans = {}; PC.plans.sync(s); for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true; return s; }
function scene(house) {
  const world = new THREE.Group(); world.name = 'world';
  const mats = { deck: new THREE.MeshLambertMaterial(), batch: new THREE.MeshLambertMaterial({ vertexColors: true }), paving: new THREE.MeshLambertMaterial({ vertexColors: true }), ui: new THREE.MeshBasicMaterial({ vertexColors: true }), tiles: new THREE.MeshLambertMaterial({ vertexColors: true }), ground: new THREE.MeshLambertMaterial(), groundOuter: new THREE.MeshLambertMaterial(), poolWater: new THREE.MeshLambertMaterial(), trunk: new THREE.MeshLambertMaterial(), canopy: new THREE.MeshLambertMaterial(), shrub: new THREE.MeshLambertMaterial(),
    furniture: new THREE.MeshLambertMaterial({ vertexColors: true }), interior: new THREE.MeshLambertMaterial({ vertexColors: true }), lamp: new THREE.MeshLambertMaterial({ vertexColors: true }), glazing: new THREE.MeshLambertMaterial({ vertexColors: true }) };   // F4-T3 vegetation materials (unused before); F6-T2 furniture / interior / lamp / glazing
  const made = PC.three.buildShell(house, world, mats).concat(PC.three.buildInterior(house, world, mats), PC.three.buildRoof(house, world, mats), PC.three.buildSite(house, world, mats));
  world.updateMatrixWorld(true); return { world, made };
}
const meshes = (world) => { const o = []; world.traverse((x) => { if (x.isMesh) o.push(x); }); return o; };
// the items of a batch mesh (userData.items order), each with world-space vertices, normals, colours and its triangles
function itemsOf(m) {
  const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, I = g.index.array, out = []; let base = 0;
  const v3 = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
  for (const [kind, n] of m.userData.items) { const it = { kind, v: [], n: [], c: [], tris: [] };
    for (let i = base; i < base + n; i++) { v3.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); it.v.push([v3.x, v3.y, v3.z]); v3.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); it.n.push([v3.x, v3.y, v3.z]); it.c.push(C ? [C.getX(i), C.getY(i), C.getZ(i)] : null); }
    it.base = base; it.end = base + n; out.push(it); base += n; }
  for (let k = 0; k < I.length; k += 3) { const it = out.find((x) => I[k] >= x.base && I[k] < x.end); if (it) it.tris.push([I[k] - it.base, I[k + 1] - it.base, I[k + 2] - it.base]); }
  for (const it of out) { const xs = it.v.map((p) => p[0]), ys = it.v.map((p) => p[1]), zs = it.v.map((p) => p[2]); it.min = [Math.min(...xs), Math.min(...ys), Math.min(...zs)]; it.max = [Math.max(...xs), Math.max(...ys), Math.max(...zs)]; }
  return out;
}
const sameC = (a, hex) => { const b = H.lin(hex); return a && Math.abs(a[0] - b[0]) < 2e-5 && Math.abs(a[1] - b[1]) < 2e-5 && Math.abs(a[2] - b[2]) < 2e-5; };
const colOf = (it) => it.c[0];
const isCol = (it, hex) => it.c.every((c) => sameC(c, hex));
// T box (X, Y, Z) of an L rectangle
const tb = (F, u0, u1, v0, v1, y0, y1) => ({ min: [F.X(u0), y0, F.Z(v1)], max: [F.X(u1), y1, F.Z(v0)] });
const boxEq = (it, b, t = 2e-4) => [0, 1, 2].every((k) => near(it.min[k], b.min[k], t) && near(it.max[k], b.max[k], t));
// F6-T1c (plan §1-3; marker PC.C.ROOF.copingT): my reading of coping, roofDeck and the deck bands on a flat / terrace roof
const T1C = !!(PC.C.ROOF && PC.C.ROOF.copingT !== undefined), COP_T = 0.05, COP_O = 0.03, DECK_LIFT = 0.01,   /* FS ec12a64 deck z-fight fix: 0.002 -> 0.01 */ BAND_W = 0.35, BAND_K = 0.80, HEAD_W = 0.25, HEAD_K = 0.85;
const areaXZ = (x) => (x.max[0] - x.min[0]) * (x.max[2] - x.min[2]);
const triArea = (x) => x.tris.reduce((a, [i, j, k]) => { const p = x.v[i], q = x.v[j], r = x.v[k]; return a + Math.abs((q[0] - p[0]) * (r[2] - p[2]) - (r[0] - p[0]) * (q[2] - p[2])) / 2; }, 0);
function t1cRoof(tag, it, world, F, E, r, heads) {
  const f = [], { u0, u1, v0, v1, tp, ph, p } = r, yt = tp + ph;
  // coping on the parapet ring: 4 coping boxes yt .. yt + 0.05 covering the ring widened by 0.03 on both faces (union = outer - inner)
  const cop = it.filter((x) => x.kind === 'box' && isCol(x, E.coping) && near(x.min[1], yt, 1e-4));
  const O = tb(F, u0 - COP_O, u1 + COP_O, v0 - COP_O, v1 + COP_O, yt, yt + COP_T), I = tb(F, u0 + p + COP_O, u1 - p - COP_O, v0 + p + COP_O, v1 - p - COP_O, yt, yt + COP_T);
  const ringA = areaXZ(O) - areaXZ(I), gotA = cop.reduce((a, x) => a + areaXZ(x), 0);
  if (cop.length !== 4 || cop.some((x) => !near(x.max[1], yt + COP_T, 1e-4) || [0, 2].some((k) => x.min[k] < O.min[k] - 1e-4 || x.max[k] > O.max[k] + 1e-4) || (x.min[0] < I.max[0] - 1e-4 && x.max[0] > I.min[0] + 1e-4 && x.min[2] < I.max[2] - 1e-4 && x.max[2] > I.min[2] + 1e-4)) || !near(gotA, ringA, 1e-3))
    f.push(`${tag}: coping ${cop.length} boxes, area ${gotA.toFixed(3)} (4 boxes ${COP_T} m thick on the parapet top ${yt.toFixed(2)}, 0.03 m over both faces, area ${ringA.toFixed(3)})`);
  // a cap on each head (stair head 2.4 / lift overrun 1.2): one coping box 0.03 m wider on every side, top .. + 0.05
  for (const [hd, hh] of heads) { const b = tb(F, hd.u - COP_O, hd.u + hd.w + COP_O, hd.v - COP_O, hd.v + hd.d + COP_O, tp + hh, tp + hh + COP_T);
    if (!it.some((x) => x.kind === 'box' && boxEq(x, b) && isCol(x, E.coping))) f.push(`${tag}: no coping cap on the ${hh} m head`); }
  // roofDeck: one face-up quad (kind deck) inside the parapet at slab top + deckLift (0.01), Lambert in exteriors.roof, receives, does not cast
  const dm = []; world.traverse((x) => { if (x.isMesh && x.name === 'roofDeck') dm.push(x); });
  if (dm.length !== 1 || !dm[0].parent || dm[0].parent.name !== 'roof') f.push(`${tag}: ${dm.length} roofDeck meshes (one, in the roof group)`);
  else { const d = dm[0], di = d.userData.items ? itemsOf(d) : [];
    const want = tb(F, u0 + p, u1 - p, v0 + p, v1 - p, tp + DECK_LIFT, tp + DECK_LIFT);
    if (di.length !== 1 || di[0].kind !== 'deck' || !boxEq(di[0], want, 1e-4) || di[0].n.some((n) => n[1] < 0.999)) f.push(`${tag}: roofDeck ${JSON.stringify(di.map((x) => [x.kind, x.min, x.max]))}, one face-up deck quad ${JSON.stringify(want)} expected`);
    // (its material is the scene's mats.deck: colour / map are checked on real r128 in f6-t1-view)
    if (d.castShadow || !d.receiveShadow) f.push(`${tag}: roofDeck cast ${d.castShadow} / receive ${d.receiveShadow} (false / true)`); }
  // deck bands: 4 face-up strips at slab top + 0.013 along the parapet, 0.35 m wide, exteriors.roof x 0.80 at the parapet -> x 1
  const band = it.filter((x) => x.kind === 'deckBand'), yb = tp + DECK_LIFT + 0.003, pb = band.filter((x) => near(x.min[1], yb, 1e-4) && near(x.max[1], yb, 1e-4));
  const Bo = tb(F, u0 + p, u1 - p, v0 + p, v1 - p, yb, yb), Bi = tb(F, u0 + p + BAND_W, u1 - p - BAND_W, v0 + p + BAND_W, v1 - p - BAND_W, yb, yb);
  const inside = (x, B) => [0, 2].every((k) => x.min[k] >= B.min[k] - 1e-4 && x.max[k] <= B.max[k] + 1e-4);
  const par = pb.slice().sort((a, b) => triArea(b) - triArea(a)).slice(0, 4).filter((x) => inside(x, Bo));   // the parapet strips are the 4 largest
  if (band.some((x) => !near(x.min[1], x.max[1], 1e-6) || !near(x.min[1], yb, 1e-4))) f.push(`${tag}: a deckBand strip not flat at slab top + deckLift + 0.003 (0.013)`);
  const L0 = H.lin(E.roof), lum = (c) => c[0] + c[1] + c[2], k = (c) => lum(c) / lum(L0);
  const edgeK = (x) => x.v.map((v, i) => [Math.min(v[0] - Bo.min[0], Bo.max[0] - v[0], v[2] - Bo.min[2], Bo.max[2] - v[2]), x.c[i]]);
  const badK = par.flatMap(edgeK).filter(([dd, c]) => !c || (near(dd, 0, 1e-4) ? !near(k(c), BAND_K, 0.01) : near(dd, BAND_W, 1e-3) ? !near(k(c), 1, 0.01) : false));
  if (par.length < 4) f.push(`${tag}: ${par.length} parapet deck bands (4 expected)`);
  else { const bandA = par.reduce((a, x) => a + triArea(x), 0); if (!near(bandA, areaXZ(Bo) - areaXZ(Bi), 1e-3)) f.push(`${tag}: parapet deck bands cover ${bandA.toFixed(3)} m2, the ${BAND_W} m band is ${(areaXZ(Bo) - areaXZ(Bi)).toFixed(3)}`); }
  if (badK.length) f.push(`${tag}: deck band colour ${badK.slice(0, 2).map(([dd, c]) => `${dd.toFixed(2)} m: x${c ? k(c).toFixed(3) : '?'}`).join(', ')} (roof x ${BAND_K} at the parapet, x 1 at ${BAND_W} m)`);
  // head bands: at most 4 strips per head, each within 0.25 m of the head and clipped to the deck
  if (heads.length) { const Hs = heads.map(([hd]) => tb(F, hd.u - HEAD_W, hd.u + hd.w + HEAD_W, hd.v - HEAD_W, hd.v + hd.d + HEAD_W, yb, yb)), hb = pb.filter((x) => !par.includes(x));
    if (hb.some((x) => !inside(x, Bo) || !Hs.some((Ho) => inside(x, Ho))) || hb.length < heads.length || hb.length > 4 * heads.length) f.push(`${tag}: ${hb.length} head bands for ${heads.length} heads (1..4 each, within ${HEAD_W} m of a head, clipped to the deck)`); }
  // order (plan §1): the opening decals (glass / reveal) stay last in roofBatch
  const firstGlass = it.findIndex((x) => x.kind === 'glass');
  if (firstGlass >= 0 && it.slice(firstGlass).some((x) => ['deckBand'].includes(x.kind) || (x.kind === 'box' && isCol(x, E.coping)))) f.push(`${tag}: coping / deck bands after the opening decals in roofBatch`);
  return f;
}
// outward winding: each triangle's winding normal agrees with its stored normal and points away from the item's centre
function windingProblems(items, tag) {
  const f = [];
  for (const it of items) { if (it.kind === 'quad') continue; const c = [0, 1, 2].map((k) => it.v.reduce((s, p) => s + p[k], 0) / it.v.length);
    for (const [a, b, d] of it.tris) { const A = it.v[a], B = it.v[b], Cc = it.v[d], u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]], n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n);
      if (l < 1e-12) continue; const nn = n.map((x) => x / l), st = it.n[a], m = [(A[0] + B[0] + Cc[0]) / 3 - c[0], (A[1] + B[1] + Cc[1]) / 3 - c[1], (A[2] + B[2] + Cc[2]) / 3 - c[2]];
      if (nn[0] * st[0] + nn[1] * st[1] + nn[2] * st[2] < 0.99) { f.push(`${tag} ${it.kind}: stored normal disagrees with the winding`); break; }
      if (nn[0] * m[0] + nn[1] * m[1] + nn[2] * m[2] < -1e-6) { f.push(`${tag} ${it.kind}: a face points inward`); break; } } }
  return f;
}
// F4-T3 (marker PC.scatter): one InstancedMesh per vegetation kind with items (trunks + canopies for trees, shrubs)
const VEG = (h) => (h.site.trees && h.site.trees.length ? 2 : 0) + (h.site.shrubs && h.site.shrubs.length ? 1 : 0);
const byName = (world, name) => meshes(world).filter((m) => m.name === name);
// F6-T1a (impl-notes §6): pads, seating pad, pool rim and footpath moved to 'paving', the N needle half to 'northNeedle',
// the pitched slopes to 'roofTiles'; the site checks read the union of the site meshes (version-aware: absent before F6).
const F6 = !!(PC.texgen || (PC.C.VIEW3D && PC.C.VIEW3D.tiers)), F6_NEW = ['paving', 'northNeedle', 'roofTiles', 'sky', 'groundRing', 'blobs', 'roofDeck'];
const isNew = (n) => F6_NEW.includes(n) || /^(textured|lamps|glow)-/.test(n) || n === 'glazing';   // F6-T2 meshes (plan §5)   // roofDeck: F6-T1c R2 (flat / terrace roofs)
// F6-T1b (plan §6.1 / §6.2): opening decals and the wall-base skirt stand 0.005-0.05 m proud of the facade, so a ray from
// outside may meet them first (impl-notes T1b); marker PC.C.CONTACT
const T1B = !!PC.C.CONTACT, PROUD = T1B ? 0.09 : 0;   // the sill stands 0.08 m out (designer-plan Q-D1)
const siteItems = (world) => ['siteBatch', 'paving', 'northNeedle'].flatMap((n) => byName(world, n).flatMap(itemsOf));

// F6-T2 I1 / I3 (marker PC.data.furnitureParts; Designer plan 3 and the furniture.js schema text): my own expansion of a
// placed piece into its parts. Back (z = 1) = the anchor wall (back / bl / br +v, front / fl / fr -v, left -u, right +u;
// centre pieces +v, or -u when A-11 turns them in a room deeper than wide), face 'front' flips it, 'right' / 'left' turn
// it to a / -a, a = the back turned clockwise; x runs along a. Fractions map into the envelope (w along u, d along v),
// y = y0 + f h. Colour: role 'main' = the piece's key, a key, or a literal hex, through the room palette
// (interiors[style] with rooms[type] over it), each 0-255 channel x k rounded and clamped (k = 1 keeps the hex).
const T2 = !!PC.data.furnitureParts;
const myShade = (hex, k) => (k === 1 ? hex : '#' + [1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).toUpperCase().padStart(2, '0')).join(''));
const MY_BACK = { back: [0, 1], bl: [0, 1], br: [0, 1], front: [0, -1], fl: [0, -1], fr: [0, -1], left: [-1, 0], right: [1, 0] };
function myParts(p, row, rs, roomWide) {
  const T = row.parts && T3.furnitureParts[row.parts]; if (!T) return null;
  let b = row.anchor === 'center' ? (roomWide ? [0, 1] : [-1, 0]) : MY_BACK[row.anchor];
  const cw = (d) => [d[1], -d[0]];
  if (row.face === 'front') b = [-b[0], -b[1]]; else if (row.face === 'right') b = cw(b); else if (row.face === 'left') b = cw(b).map((x) => -x);
  const a = cw(b);
  const ax = (d, f0, f1) => { const alongU = d[0] !== 0, lo = alongU ? p.u : p.v, L = alongU ? p.w : p.d, s = d[0] || d[1];
    return { alongU, r: s > 0 ? [lo + f0 * L, lo + f1 * L] : [lo + L - f1 * L, lo + L - f0 * L] }; };
  return T.map(([x0, x1, z0, z1, y0, y1, role, k, mat]) => { const A = ax(a, x0, x1), B = ax(b, z0, z1), U = A.alongU ? A.r : B.r, V = A.alongU ? B.r : A.r;
    const hex = role === 'main' ? rs[row.color] : role[0] === '#' ? role : rs[role];
    return { u: U[0], v: V[0], w: U[1] - U[0], d: V[1] - V[0], y0: p.y0 + y0 * p.h, h: (y1 - y0) * p.h, color: myShade(hex, k), mat }; });
}
const partEq = (g, m) => g && m && g.length === m.length && g.every((q, i) => ['u', 'v', 'w', 'd', 'y0', 'h'].every((k) => near(q[k], m[i][k], 1e-9)) && q.color === m[i].color && q.mat === m[i].mat);
// ================= F. furniture =================
if (want('F')) {
  const f = [], cont = [], t3 = [], st = { rooms: 0, pieces: 0, sparse: 0, full: 0, houses: 0 };
  const STATES = [];
  for (const style of ['modern', 'classic', 'minimal']) for (const density of ['full', 'sparse']) STATES.push([`sample ${style} ${density}`, (s) => { s.ans.interior = { style, density }; }]);
  const r = H && ((seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(424242);
  const TYPES = Object.keys(Q.ROOM_AREA);
  for (let i = 0; i < 24; i++) STATES.push([`seeded #${i}`, (s) => { s.plot.pts = [[0, 0], [24 + Math.round(r() * 16), 0], [24 + Math.round(r() * 16), 30 + Math.round(r() * 14)], [0, 30 + Math.round(r() * 14)]]; s.ans.streetEdge = 0; s.ans.unit = r() < 0.5 ? 'm' : 'ft'; s.ans.footprintPct = 40 + Math.round(r() * 20); s.ans.lift = r() < 0.4; s.ans.stairPos = ['centre', 'fl', 'fr', 'bl', 'br'][Math.floor(r() * 5)];
    s.ans.interior = { style: ['modern', 'classic', 'minimal'][i % 3], density: i % 2 ? 'sparse' : 'full' }; s.ans.pairs = []; s.ans.rooms = []; let n = 1;
    for (const lv of ['G', '1']) { const k = 4 + Math.floor(r() * 5); for (let j = 0; j < k; j++) { const t = TYPES[Math.floor(r() * TYPES.length)]; s.ans.rooms.push({ id: 'r' + n++, type: t, level: lv, size: 'SML'[Math.floor(r() * 3)], area: null, master: false }); } } s.ans.nextRoomId = n; }]);
  for (const [tag, mut] of STATES) {
    const s = make(mut), h = PC.house.build(s); if (!h) continue; st.houses++;
    const I = T3.interiors[s.ans.interior.style], F = H.frameOf(s), fp = h.footprint, core = H.myCore(fp.w, fp.d, Q.stairsExist(s.ans), s.ans.stairPos, !!s.ans.lift && Q.stairsExist(s.ans));
    const types = Object.fromEntries(s.ans.rooms.map((x) => [x.id, x.type]));
    const { world } = scene(h);
    for (const lv of h.levels) {
      const mine = [];
      for (const rm of lv.rooms) { st.rooms++;
        const pl = furnish(T3.furniture[types[rm.id]], rm.w, rm.d, s.ans.interior.density).placed, tbl = Object.fromEntries(T3.furniture[types[rm.id]].map((p) => [p.id, p]));
        const RS = T2 ? { ...I, ...((I.rooms || {})[types[rm.id]] || {}) } : I;   // F6-T2 I3: the room type's palette over the style
        const exp = pl.map((p) => ({ kind: p.id, u: rm.u + p.l, v: rm.v + p.f, w: p.r - p.l, d: p.b - p.f, h: tbl[p.id].h, y0: tbl[p.id].y0, color: RS[tbl[p.id].color] }));
        if (T2) for (const g of rm.furniture) { const row = tbl[g.kind], m = row && myParts(g, row, RS, rm.w >= rm.d);
          if (!(m === null ? g.parts === null : partEq(g.parts, m))) { st.badParts = (st.badParts || 0) + 1; if (f.length < 12) f.push(`${tag} ${lv.id} ${rm.id} ${types[rm.id]} ${g.kind} (${row && row.anchor}${row && row.face ? ' face ' + row.face : ''}): parts ${JSON.stringify(g.parts && g.parts.slice(0, 2))} vs mine ${JSON.stringify(m && m.slice(0, 2))}`); } else if (m) st.parts = (st.parts || 0) + m.length; }
        const got = rm.furniture; st.pieces += got.length; st[s.ans.interior.density] += got.length;
        const same = got.length === exp.length && got.every((g, k) => g.kind === exp[k].kind && ['u', 'v', 'w', 'd', 'h', 'y0'].every((q) => near(g[q], exp[k][q], 1e-9)) && g.color === exp[k].color);
        if (!same) f.push(`${tag} ${lv.id} ${rm.id} ${types[rm.id]} ${rm.w}x${rm.d}: model ${JSON.stringify(got.map((g) => [g.kind, +g.u.toFixed(3), +g.v.toFixed(3), +g.w.toFixed(3), +g.d.toFixed(3), g.color]))} vs QA ${JSON.stringify(exp.map((g) => [g.kind, +g.u.toFixed(3), +g.v.toFixed(3), +g.w.toFixed(3), +g.d.toFixed(3), g.color]))}`);
        for (const p of got) {
          if (p.u < rm.u + 0.15 - 1e-9 || p.v < rm.v + 0.15 - 1e-9 || p.u + p.w > rm.u + rm.w - 0.15 + 1e-9 || p.v + p.d > rm.v + rm.d - 0.15 + 1e-9) cont.push(`${tag} ${rm.id} ${p.kind}: less than 0.15 m to a wall`);
          for (const o of lv.rooms) if (o.id !== rm.id && rOver({ u: p.u, v: p.v, w: p.w, d: p.d }, o)) cont.push(`${tag} ${rm.id} ${p.kind} enters ${o.id}`);
          for (const k of ['stair', 'lift']) if (core[k] && rOver({ u: p.u, v: p.v, w: p.w, d: p.d }, { u: fp.u + core[k].x, v: fp.v + core[k].y, w: core[k].w, d: core[k].h })) cont.push(`${tag} ${rm.id} ${p.kind} on the ${k}`);
          if (lv.id === 'G' && rOver({ u: p.u, v: p.v, w: p.w, d: p.d }, { u: h.site.entrance.u - 0.6, v: fp.v - 0.2, w: 1.2, d: 0.35 })) cont.push(`${tag} ${rm.id} ${p.kind} in the entrance gap`);
          mine.push({ ...p, floorY: H.INDEX[lv.id] * h.pitch + 0.2 });
        }
      }
      // T: the level's furniture batch, one box per piece, in order of rooms / pieces
      const g = world.getObjectByName('level-' + lv.id), fm = g ? g.children.filter((m) => m.name === 'furniture') : [];
      if (!mine.length) { if (fm.length) t3.push(`${tag} ${lv.id}: furniture mesh without pieces`); continue; }
      if (fm.length !== 1) { t3.push(`${tag} ${lv.id}: ${fm.length} furniture meshes`); continue; }
      const it = itemsOf(fm[0]);
      if (T2) {   // F6-T2: plain parts (and part-less pieces) in furniture, planks / weave parts in textured-<id>, shades in lamps-<id>
        const want = { plain: [], tex: [], lamp: [] };
        for (const p of mine) { if (!p.parts) { want.plain.push({ ...p, kind: p.kind }); continue; }
          for (const q of p.parts) want[q.mat === 'plain' ? 'plain' : q.mat === 'lamp' ? 'lamp' : 'tex'].push({ ...q, kind: p.kind, floorY: p.floorY }); }
        const one = (name) => { const ms = g.children.filter((m) => m.name === name); return ms.length === 1 ? itemsOf(ms[0]) : (t3.push(`${tag} ${lv.id}: ${ms.length} ${name} meshes`), null); };
        const gate = lv.id === 'G' && h.site.wall && h.site.gate ? 2 : 0;   // TL F2: two gate-lamp shades end lamps-G
        const tx = one('textured-' + lv.id), lm = want.lamp.length + gate ? one('lamps-' + lv.id) : (g.children.some((m) => m.name === 'lamps-' + lv.id) && t3.push(`${tag} ${lv.id}: lamps mesh without lamps`), []);
        const cmp = (name, items, ws) => { if (!items) return;
          if (items.length !== ws.length) { t3.push(`${tag} ${lv.id}: ${name} ${items.length} part items, want ${ws.length}`); return; }
          ws.forEach((q, k) => { if (!boxEq(items[k], tb(F, q.u, q.u + q.w, q.v, q.v + q.d, q.floorY + q.y0, q.floorY + q.y0 + q.h))) t3.push(`${tag} ${lv.id} ${name} ${q.kind} part ${k}: box ${items[k].min.map((x) => x.toFixed(3))}..${items[k].max.map((x) => x.toFixed(3))}`);
            else if (!isCol(items[k], q.color)) t3.push(`${tag} ${lv.id} ${name} ${q.kind} part ${k}: colour not col(${q.color})`); }); };
        if (it.some((x) => x.kind !== 'box')) t3.push(`${tag} ${lv.id}: furniture items not all boxes`);
        cmp('furniture', it, want.plain); st.items = (st.items || 0) + it.length;
        cmp('textured', tx && tx.filter((x) => x.kind === 'part'), want.tex);
        cmp('lamps', lm && lm.slice(0, lm.length - gate), want.lamp);
        if (lm && lm.length - gate !== want.lamp.length) t3.push(`${tag} ${lv.id}: lamps ${lm.length} items, want ${want.lamp.length} + ${gate} gate`);
        if (!fm[0].castShadow || !fm[0].receiveShadow) t3.push(`${tag} ${lv.id}: furniture not cast + receive`);
        const wm = g.children.find((m) => m.name === 'walls'); if (wm && fm[0].material === wm.material) t3.push(`${tag} ${lv.id}: furniture shares the walls' material (F6-T2 N3: its own)`);
        continue;
      }
      if (it.length !== mine.length || it.some((x) => x.kind !== 'box')) { t3.push(`${tag} ${lv.id}: ${it.length} items for ${mine.length} pieces`); continue; }
      mine.forEach((p, k) => { if (!boxEq(it[k], tb(F, p.u, p.u + p.w, p.v, p.v + p.d, p.floorY + p.y0, p.floorY + p.y0 + p.h))) t3.push(`${tag} ${lv.id} ${p.kind}: box ${it[k].min.map((x) => x.toFixed(2))}..${it[k].max.map((x) => x.toFixed(2))}`); else if (!isCol(it[k], p.color)) t3.push(`${tag} ${lv.id} ${p.kind}: colour not col(${p.color})`); });
      if (!fm[0].castShadow || !fm[0].receiveShadow) t3.push(`${tag} ${lv.id}: furniture not cast + receive`);
    }
  }
  R.note(`F houses built: ${st.houses}`); R.check(`F ${st.rooms} rooms in ${st.houses} houses (sample x 3 styles x full / sparse, 24 seeded houses, m and ft): every room's furniture = QA's A-11 placement mapped to L, colour = the Q18 style's hex${T2 ? ` (F6-T2: through the room type's I3 palette; every piece's parts = my expansion of its template, ${st.parts || 0} parts)` : ''}`, cut(f));
  R.check('F every piece keeps 0.15 m to its room\'s walls, enters no other room, the stair or the lift, and stays out of the entrance gap', cut(cont));
  R.check(T2 ? `F 3D (F6-T2): per furnished level one furniture batch with one box per plain part (or part-less piece), the planks / weave parts in textured-<level>, the lamp shades in lamps-<level> (+ 2 gate lamps on G), each at floor + y0 .. + h over the part in my colour; furniture cast + receive (${st.items || 0} furniture boxes)` : 'F 3D: one furniture batch per furnished level, one box per piece at floor + y0 .. + h exactly over the piece, colour col(hex), cast + receive', cut(t3));
  // sparse vs full, Q18 colours only
  const g = [];
  for (const style of ['modern', 'classic', 'minimal']) { const a = PC.house.build(make((s) => { s.ans.interior = { style, density: 'full' }; })), b = PC.house.build(make((s) => { s.ans.interior = { style, density: 'sparse' }; }));
    const n = (h) => h.levels.reduce((x, l) => x + l.rooms.reduce((y, r) => y + r.furniture.length, 0), 0); if (!(n(b) < n(a))) g.push(`${style}: sparse ${n(b)} vs full ${n(a)}`); }
  const base = make((s) => { s.ans.interior = { style: 'modern', density: 'full' }; }), hb = PC.house.build(base);
  for (const style of ['classic', 'minimal']) { const s2 = make((s) => { s.ans.interior = { style, density: 'full' }; }), h2 = PC.house.build(s2);
    const boxes = (h) => h.levels.map((l) => l.rooms.map((r) => r.furniture.map(({ color, parts, ...p }) => ({ ...p, parts: parts ? parts.map(({ color: c, ...q }) => q) : parts })))), cols = (h) => h.levels.flatMap((l) => l.rooms.flatMap((r) => r.furniture.map((p) => p.color)));
    if (!eq(boxes(h2), boxes(hb))) g.push(`${style}: boxes differ from modern`);
    if (eq(cols(h2), cols(hb))) g.push(`${style}: colours equal modern`);
    if (h2.key === hb.key) g.push(`${style}: same key`);
    for (const id of Object.keys(base.plans)) if (PC.sig.level(s2, id) !== PC.sig.level(base, id)) g.push(`${style}: plan signature of ${id} changed (approval would be lost)`); }
  // A-11 edge: pieces overlapping by exactly 0.01 m are allowed ("more than 0.01 m"). Rooms found by QA's own search
  // where the 1e-9 slack decides (QA's furnish with eps +1e-9 vs -1e-9 differ), then the app vs QA on those rooms
  { const e = [], found = []; const { setEps } = await import('./f3-t3-ref.mjs');
    for (const ty of Object.keys(T3.furniture)) for (const dens of ['full', 'sparse']) for (const fixed of [2, 2.5, 3, 3.5, 4, 5]) for (let k = 150; k <= 600; k++) for (const [W, D2] of [[k / 100, fixed], [fixed, k / 100]]) {
      setEps(1e-9); const a = JSON.stringify(furnish(T3.furniture[ty], W, D2, dens).placed.map((p) => p.id)); setEps(-1e-9); const b = JSON.stringify(furnish(T3.furniture[ty], W, D2, dens).placed.map((p) => p.id)); setEps(1e-9);
      if (a !== b && found.length < 40) found.push([ty, dens, W, D2]); }
    for (const [ty, dens, W, D2] of found) { const got = PC.furnish.room({ x: 0, y: 0, w: W, h: D2 }, PC.data.furniture[ty], dens).map((p) => p.kind), mine = furnish(T3.furniture[ty], W, D2, dens).placed.map((p) => p.id); if (!eq(got, mine)) e.push(`${ty} ${dens} ${W} x ${D2}: app ${got} vs QA ${mine}`); }
    R.note(`F exact-overlap rooms found: ${found.length}`); R.check(`F ${found.length} rooms where two pieces touch with exactly 0.01 m of overlap (QA search): the app places what QA places (the overlap is allowed)`, found.length ? cut(e) : ['QA search found no exact-overlap room']); }
  R.check('F Q19 sparse places fewer pieces than full in each style; Q18 changes colours and the key only (boxes equal, plan signatures unchanged)', g);
  R.note(`F pieces: full ${st.full}, sparse ${st.sparse} over ${st.rooms} rooms`);
}

// ================= R. roof =================
if (want('R')) {
  const f = [], cl = [], wd = [];
  const CASES = [];
  for (const type of ['flat', 'pitched', 'terrace']) for (const usable of [false, true]) for (const lift of [false, true]) CASES.push({ type, usable, lift, plot: null });
  CASES.push({ type: 'pitched', usable: false, lift: false, plot: [[0, 0], [40, 0], [40, 22], [0, 22]], tag: 'wide' }, { type: 'pitched', usable: false, lift: true, plot: [[0, 0], [22, 0], [22, 40], [0, 40]], tag: 'deep' }, { type: 'terrace', usable: false, lift: false, plot: [[0, 0], [40, 0], [40, 22], [0, 22]], tag: 'wide' });
  for (const c of CASES) {
    const tag = `${c.type}${c.usable ? ' usable' : ''}${c.lift ? ' +lift' : ''}${c.tag ? ' ' + c.tag : ''}`;
    const s = make((s) => { s.ans.roofType = c.type; s.ans.usableRoof = c.usable; s.ans.lift = c.lift; if (c.plot) { s.plot.pts = c.plot; s.ans.streetEdge = 0; } }), h = PC.house.build(s);
    if (!h) { f.push(`${tag}: no house`); continue; }
    const F = H.frameOf(s), fp = h.footprint, E = T3.exteriors[s.ans.exterior], pitch = s.ans.ceilingH + 0.2, top = Q.levelIds(s.ans).map((id) => H.INDEX[id]).reduce((a, b) => Math.max(a, b)), baseY = (top + 1) * pitch;
    const core = H.myCore(fp.w, fp.d, true, s.ans.stairPos, c.lift), L = (r) => r && { u: fp.u + r.x, v: fp.v + r.y, w: r.w, d: r.h };
    const type = c.usable && c.type === 'pitched' ? 'flat' : c.type;
    // the model
    if (h.roof.type !== type || h.roof.usable !== c.usable || !near(h.roof.baseY, baseY, 1e-9)) f.push(`${tag}: roof ${JSON.stringify(h.roof)}`);
    if (!eq(h.roof.stairHead, c.usable ? L(core.stair) : null)) f.push(`${tag}: stairHead ${JSON.stringify(h.roof.stairHead)}`);
    if (!eq(h.roof.liftHead, c.usable && c.lift ? L(core.lift) : null)) f.push(`${tag}: liftHead ${JSON.stringify(h.roof.liftHead)}`);
    const { world } = scene(h), rm = byName(world, 'roofBatch');
    if (rm.length !== 1 || rm[0].parent.name !== 'roof') { f.push(`${tag}: ${rm.length} roofBatch meshes`); continue; }
    const it = itemsOf(rm[0]); wd.push(...windingProblems(it, tag));
    const bx = (u0, u1, v0, v1, y0, y1) => tb(F, u0, u1, v0, v1, y0, y1), has = (b, hex, what) => { if (!it.some((x) => boxEq(x, b) && isCol(x, hex))) f.push(`${tag}: no ${what}`); };
    // wall bands on every above-ground level: four wall-coloured boxes 0.15 m thick (the A-10 wall) around the outline, floor + 1.2 .. baseY + pitch
    for (const id of Q.levelIds(s.ans).filter((x) => x !== 'B')) { const b0 = H.INDEX[id] * pitch, y0 = b0 + 0.2 + 1.2, y1 = b0 + pitch, k = 0.15, u0 = fp.u, u1 = fp.u + fp.w, v0 = fp.v, v1 = fp.v + fp.d;
      for (const [b, w] of [[bx(u0, u1, v0, v0 + k, y0, y1), 'front'], [bx(u0, u1, v1 - k, v1, y0, y1), 'back'], [bx(u0, u0 + k, v0 + k, v1 - k, y0, y1), 'left'], [bx(u1 - k, u1, v0 + k, v1 - k, y0, y1), 'right']]) has(b, E.wall, `${id} ${w} wall band`); }
    const u0 = fp.u, u1 = fp.u + fp.w, v0 = fp.v, v1 = fp.v + fp.d;
    if (type === 'pitched') {
      const pr = it.filter((x) => x.kind === 'prism'); if (pr.length !== 1) { f.push(`${tag}: ${pr.length} prisms`); continue; }
      const P = pr[0], rise = Math.tan(30 * Math.PI / 180) * Math.min(fp.w, fp.d) / 2, ridge = P.v.filter((p) => near(p[1], baseY + rise, 1e-3));
      if (!near(P.max[1], baseY + rise, 1e-3) || !near(P.min[1], baseY, 1e-4)) f.push(`${tag}: prism y ${P.min[1].toFixed(3)}..${P.max[1].toFixed(3)}, expected ${baseY}..${(baseY + rise).toFixed(3)}`);
      const rx = Math.max(...ridge.map((p) => p[0])) - Math.min(...ridge.map((p) => p[0])), rz = Math.max(...ridge.map((p) => p[2])) - Math.min(...ridge.map((p) => p[2]));
      const alongX = fp.w >= fp.d; if (!(alongX ? near(rx, fp.w, 1e-3) && near(rz, 0, 1e-3) : near(rz, fp.d, 1e-3) && near(rx, 0, 1e-3))) f.push(`${tag}: ridge spans ${rx.toFixed(2)} x ${rz.toFixed(2)} (footprint ${fp.w} x ${fp.d}: along the longer side expected)`);
      if (!boxEq(P, { min: [F.X(u0), baseY, F.Z(v1)], max: [F.X(u1), baseY + rise, F.Z(v0)] }, 1e-3)) f.push(`${tag}: prism not over the footprint (no overhang)`);
      // gables (horizontal normals) in wall, slopes and base in roof
      for (const [a] of P.tris) { const n = P.n[a], col = P.c[a]; if (Math.abs(n[1]) < 1e-3 ? !sameC(col, E.wall) : !sameC(col, E.roof)) { f.push(`${tag}: ${Math.abs(n[1]) < 1e-3 ? 'gable not wall' : 'slope not roof'} colour`); break; } }
      if (it.some((x) => x.kind === 'box' && isCol(x, E.parapet))) f.push(`${tag}: parapet on a pitched roof`);
    } else {
      const tp = baseY + 0.2, ph = c.usable || type === 'terrace' ? 1.0 : 0.3, p = 0.15;
      // F6-T1c R1 (plan §1): the slab box is in exteriors.slab and dripOut 0.04 proud of the footprint on all sides
      const DR = T1C ? 0.04 : 0;
      has(bx(u0 - DR, u1 + DR, v0 - DR, v1 + DR, baseY, tp), T1C ? E.slab : E.roof, T1C ? 'slab (slab colour, 0.04 m drip edge)' : 'slab');
      if (T1C) f.push(...t1cRoof(tag, it, world, F, E, { u0, u1, v0, v1, tp, ph, p }, c.usable ? [[L(core.stair), 2.4], ...(c.lift ? [[L(core.lift), 1.2]] : [])] : []));
      for (const [b, w] of [[bx(u0, u1, v0, v0 + p, tp, tp + ph), 'front'], [bx(u0, u1, v1 - p, v1, tp, tp + ph), 'back'], [bx(u0, u0 + p, v0 + p, v1 - p, tp, tp + ph), 'left'], [bx(u1 - p, u1, v0 + p, v1 - p, tp, tp + ph), 'right']]) has(b, E.parapet, `${w} parapet ${ph} m`);
      if (type === 'terrace') { const a0 = u0 + p, a1 = u1 - p, b0 = v0 + fp.d * 2 / 3, b1 = v1 - p, k = 0.15, hgt = tp + 2.4;
        for (const [cu, cv] of [[a0, b0], [a1 - k, b0], [a0, b1 - k], [a1 - k, b1 - k]]) has(bx(cu, cu + k, cv, cv + k, tp, hgt), E.roof, `pergola post at ${cu.toFixed(2)},${cv.toFixed(2)}`);
        const beams = it.filter((x) => x.kind === 'box' && near(x.max[1], hgt) && near(x.min[1], hgt - 0.1) && isCol(x, E.roof)), longU = a1 - a0 >= b1 - b0, len = longU ? a1 - a0 : b1 - b0, span = longU ? b1 - b0 : a1 - a0;
        const nWant = Math.floor((span - 0.1) / 0.6 + 1e-9) + 1;
        if (beams.length !== nWant || beams.some((x) => !near(longU ? x.max[0] - x.min[0] : x.max[2] - x.min[2], len, 1e-3))) f.push(`${tag}: ${beams.length} beams (expected ${nWant}, each ${len.toFixed(2)} m along the region's longer side)`);
        if (beams.some((x) => x.max[2] > F.Z(b0) + 1e-3 || x.min[2] < F.Z(b1) - 1e-3)) f.push(`${tag}: a beam outside the back third`);
      } else if (it.some((x) => x.kind === 'box' && x.max[1] > tp + ph + (T1C && isCol(x, E.coping) ? 0.05 : 0) + 1e-3 && !(c.usable))) f.push(`${tag}: something above the parapet`);
      if (c.usable) { const sH = L(core.stair); has(bx(sH.u, sH.u + sH.w, sH.v, sH.v + sH.d, tp, tp + 2.4), E.parapet, 'stair head 2.4 m');
        if (c.lift) { const lH = L(core.lift); has(bx(lH.u, lH.u + lH.w, lH.v, lH.v + lH.d, tp, tp + 1.2), E.parapet, 'lift overrun 1.2 m'); } }
      else if (it.some((x) => near(x.max[1], tp + 2.4) && !(type === 'terrace'))) f.push(`${tag}: a stair head on a roof that is not usable`);
    }
    // closed with the roof on: horizontal rays from outside at heights through every storey hit the facade (shell + roof
    // batches, front faces only); at the door (Ground, 0.6 m above the floor) the ray passes the front wall
    const solid = meshes(world).filter((m) => ['roof', 'level-G', 'level-1', 'level-2', 'level-B'].includes(m.parent && m.parent.name) || (m.parent && /^level-/.test(m.parent.name)));
    const rc = new THREE.Raycaster(); const hitAt = (o, d) => { rc.set(new THREE.Vector3(...o), new THREE.Vector3(...d)); rc.far = 100; const hs = rc.intersectObjects(solid, false); return hs.length ? hs[0].distance : Infinity; };
    for (const id of Q.levelIds(s.ans).filter((x) => x !== 'B')) { const b0 = H.INDEX[id] * pitch;
      for (const y of [b0 + 0.2 + 0.3, b0 + 0.2 + 1.0, b0 + 0.2 + 1.5, b0 + pitch - 0.05]) for (const k of [0.15, 0.35, 0.65, 0.85]) {
        const pts = [[[F.X(u0 + k * fp.w), y, F.Z(v0) + 5], [0, 0, -1], 'front'], [[F.X(u0 + k * fp.w), y, F.Z(v1) - 5], [0, 0, 1], 'back'], [[F.X(u0) - 5, y, F.Z(v0 + k * fp.d)], [1, 0, 0], 'left'], [[F.X(u1) + 5, y, F.Z(v0 + k * fp.d)], [-1, 0, 0], 'right']];
        for (const [o, d, side] of pts) { if (id === 'G' && side === 'front' && Math.abs(u0 + k * fp.w - h.site.entrance.u) < 0.7 && y < b0 + 0.2 + 1.2) continue; const t = hitAt(o, d); if (!(t >= 5 - PROUD - 1e-3 && t <= 5.2 + 1e-3)) { cl.push(`${tag} ${id} ${side} at ${k} / y ${y.toFixed(2)}: first hit ${t === Infinity ? 'none' : (t - 5).toFixed(2) + ' m past the facade'}`); } } } }
    { const y = 0.2 + 0.6, o = [F.X(h.site.entrance.u), y, F.Z(v0) + 5];
      if (!T1B) { const t = hitAt(o, [0, 0, -1]); if (t < 5.25) cl.push(`${tag}: the door is closed (ray at the entrance stops ${(t - 5).toFixed(2)} m past the facade)`); }
      else {   // F6-T1b: the entrance gap in the walls stays open, and a door decal (leaf in the exterior's door colour) stands in it
        rc.set(new THREE.Vector3(...o), new THREE.Vector3(0, 0, -1)); rc.far = 100; const hs = rc.intersectObjects(solid, false), wall = hs.find((x) => x.object.name !== 'roofBatch');
        if (wall && wall.distance < 5.25) cl.push(`${tag}: the wall gap at the entrance is closed (${wall.object.name} ${(wall.distance - 5).toFixed(2)} m past the facade)`);
        const first = hs[0], C = first && first.object.geometry.getAttribute('color'), want = H.lin(E.door);
        if (!first || first.object.name !== 'roofBatch' || !C || ![C.getX(first.face.a), C.getY(first.face.a), C.getZ(first.face.a)].every((x, i) => Math.abs(x - want[i]) < 2e-5) || first.distance < 5 - PROUD - 1e-3)
          cl.push(`${tag}: no door leaf (door ${E.door}) at the entrance: first hit ${first ? first.object.name + ' ' + (first.distance - 5).toFixed(2) + ' m' : 'none'}`); } }
  }
  R.check(`R ${CASES.length} roofs (flat / pitched / terrace x usable x lift, wide and deep pitched): model (never pitched when usable; stairHead / liftHead) and roofBatch geometry = QA's expectation (bands, slab, parapets 0.3 / 1.0, pergola, gable, heads)`, cut(f, 10));
  R.check('R roof on = a closed exterior: horizontal rays from all four sides at 0.5 / 1.2 / 1.7 m over each floor and under each next slab hit the facade; the entrance stays open', cut(cl, 8));
  R.check('R roofBatch: every triangle\'s winding agrees with its normal and faces away from its solid (outward winding)', cut(wd));
}

// ================= W. wall and gate =================
const PLOTS = [
  ['rect 24 x 34', [[0, 0], [24, 0], [24, 34], [0, 34]]],
  ['rotated 30 deg', (() => { const a = 30 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[0, 0], [24, 0], [24, 34], [0, 34]].map(([x, y]) => [Math.round((x * c - y * s + 30) * 1000) / 1000, Math.round((x * s + y * c) * 1000) / 1000]); })()],
  ['trapezoid, slanted street', [[0, 2], [26, 0], [28, 34], [-2, 32]]],
  ['pentagon (sample-like)', [[0, 0], [22, 0], [22, 32], [9, 34], [0, 28]]],
];
if (want('W')) {
  const f = [], wd = [];
  for (const [pname, pts] of PLOTS) for (const wall of [true, false]) for (const gate of ['left', 'centre', 'right']) {
    if (!wall && gate !== 'centre') continue;
    const tag = `${pname} wall ${wall ? 'on' : 'off'} gate ${gate}`;
    const s = make((s) => { s.plot.pts = pts; s.ans.streetEdge = 0; s.ans.north = null; s.ans.extras = { ...s.ans.extras, wall, gate }; s.ans.footprintPct = 45; }), h = PC.house.build(s);
    if (!h) { f.push(`${tag}: no house`); continue; }
    const F = H.frameOf(s), pL = F.pL, len = Math.hypot(pL[1][0] - pL[0][0], pL[1][1] - pL[0][1]), gu = myGateU(pL, { wall, gate });
    if (wall ? !(h.site.gate && near(h.site.gate.u, gu, 1e-9) && h.site.gate.w === 3) : h.site.gate !== null) f.push(`${tag}: gate ${JSON.stringify(h.site.gate)}, QA ${gu === null ? 'none' : gu.toFixed(3) + ' (' + gate + ' of ' + len.toFixed(2) + ')'}`);
    if (h.site.wall !== wall) f.push(`${tag}: site.wall ${h.site.wall}`);
    if (s.ans.extras.gate !== gate) f.push(`${tag}: Q17 gate value not kept`);
    const { world } = scene(h), sm = byName(world, 'siteBatch')[0], it = sm ? itemsOf(sm) : [], segs = it.filter((x) => x.kind === 'seg');
    wd.push(...windingProblems(it, tag));
    const toL = (p) => [p[0] + F.cu, -p[2] + F.cv];
    if (!wall) { if (segs.length) f.push(`${tag}: ${segs.length} wall segments without the wall`); if (it.some((x) => x.kind === 'box' && near(x.max[1], 1.4) && isCol(x, T3.exteriors[s.ans.exterior].trim))) f.push(`${tag}: gate posts without the wall`); continue; }
    // each segment: 1.2 m high, 0.2 m thick, inside one plot edge (0 .. 0.2 m from its line), within the edge's span
    const cover = pL.map(() => []);
    for (const sg of segs) { if (!near(sg.min[1], 0) || !near(sg.max[1], 1.2)) f.push(`${tag}: segment height ${sg.min[1]}..${sg.max[1]}`); if (!isCol(sg, T3.siteColors.boundaryWall)) f.push(`${tag}: segment colour`);
      const vs = sg.v.map(toL); let hit = -1;
      for (let e = 0; e < pL.length; e++) { const a = pL[e], b = pL[(e + 1) % pL.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
        const dist = vs.map((q) => (q[0] - a[0]) * -uy + (q[1] - a[1]) * ux), along = vs.map((q) => (q[0] - a[0]) * ux + (q[1] - a[1]) * uy);
        if (dist.every((d) => d >= -1e-3 && d <= 0.2 + 1e-3) && near(Math.max(...dist) - Math.min(...dist), 0.2, 1e-3) && along.every((t) => t >= -1e-3 && t <= l + 1e-3)) { hit = e; cover[e].push([Math.min(...along), Math.max(...along)]); break; } }
      if (hit < 0) f.push(`${tag}: a segment along no plot edge (0.2 m inside)`); }
    pL.forEach((a, e) => { const b = pL[(e + 1) % pL.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]), sp = cover[e].sort((x, y) => x[0] - y[0]); let at = 0; const gaps = [];
      for (const [x0, x1] of sp) { if (x0 > at + 1e-3) gaps.push([at, x0]); at = Math.max(at, x1); } if (at < l - 1e-3) gaps.push([at, l]);
      const want = e === 0 ? [[gu - 1.5, gu + 1.5]] : []; if (gaps.length !== want.length || gaps.some((g, k) => !near(g[0], want[k][0], 1e-3) || !near(g[1], want[k][1], 1e-3))) f.push(`${tag}: edge ${e} gaps ${JSON.stringify(gaps.map((g) => g.map((x) => +x.toFixed(3))))}, expected ${JSON.stringify(want.map((g) => g.map((x) => +x.toFixed(3))))}`); });
    // posts: 0.4 x 0.4 x 1.4 trim, flush with the gap ends, on the street wall line (v 0 .. 0.4 covers the 0 .. 0.2 wall)
    const trim = T3.exteriors[s.ans.exterior].trim;
    for (const [pu0, pu1] of [[gu - 1.5 - 0.4, gu - 1.5], [gu + 1.5, gu + 1.5 + 0.4]]) if (!it.some((x) => x.kind === 'box' && isCol(x, trim) && boxEq(x, tb(F, pu0, pu1, 0, 0.4, 0, 1.4)))) f.push(`${tag}: no post at u ${pu0.toFixed(2)}..${pu1.toFixed(2)}`);
  }
  R.check(`W ${PLOTS.length} plots (rectangle, rotated 30 degrees, slanted trapezoid, pentagon) x gate Left / Centre / Right, wall on and off: gate at 25 / 50 / 75 % of the street edge (none without the wall, Q17 value kept); wall 0.2 m inside every edge, 1.2 m, the 3 m gap only at the gate; 0.4 x 1.4 m posts flush with the gap on the wall line`, cut(f, 10));
  R.check('W siteBatch: outward winding on every item', cut(wd));
}

// ================= S. seating =================
if (want('S')) {
  const f = [], st = { n: 0, by: {}, omitted: 0, nearer: 0 }, r = ((seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(9001);
  const cases = [['sample', null]];
  for (let i = 0; i < 70; i++) cases.push([`seeded #${i}`, (s) => { const W = 16 + Math.round(r() * 20), D2 = 18 + Math.round(r() * 22); s.plot.pts = i % 4 === 3 ? [[0, 0], [W, 0], [W, D2], [W * 0.4, D2 + 3], [0, D2 - 3]] : [[0, 0], [W, 0], [W, D2], [0, D2]]; s.ans.streetEdge = 0;
    s.ans.footprintPct = 30 + Math.round(r() * 30); s.ans.parking = { cars: Math.floor(r() * 5), covered: r() < 0.5 }; s.ans.pool = { on: r() < 0.6, size: 'SML'[Math.floor(r() * 3)] }; s.ans.extras = { wall: r() < 0.7, gate: ['left', 'centre', 'right'][Math.floor(r() * 3)], seating: true };
    s.ans.setbacks = { front: 2 + Math.round(r() * 4), back: 1 + Math.round(r() * 4), side: 1 + Math.round(r() * 3) }; }]);
  // side-yard cases: a tight back yard (back setback 1, a large pool behind) and a trapezoid wider on one side
  for (let i = 0; i < 40; i++) cases.push([`side #${i}`, (s) => { const W = 18 + Math.round(r() * 10), D2 = 20 + Math.round(r() * 10), k = 6 + Math.round(r() * 8);
    s.plot.pts = i % 2 ? [[0, 0], [W, 0], [W + k, D2], [0, D2]] : [[0, 0], [W, 0], [W, D2], [-k, D2]]; s.ans.streetEdge = 0; s.ans.footprintPct = 30 + Math.round(r() * 20);
    s.ans.setbacks = { front: 3 + Math.round(r() * 3), back: 1, side: 1 + Math.round(r() * 2) }; s.ans.parking = { cars: Math.floor(r() * 3), covered: false }; s.ans.pool = { on: r() < 0.7, size: 'SML'[Math.floor(r() * 3)] }; s.ans.extras = { wall: true, gate: 'centre', seating: true }; }]);
  cases.push(['seating off', (s) => { s.ans.extras = { ...s.ans.extras, seating: false }; }]);
  cases.push(['tight 16 x 18 at 50 %', (s) => { s.plot.pts = [[0, 0], [16, 0], [16, 18], [0, 18]]; s.ans.streetEdge = 0; s.ans.footprintPct = 50; }]);
  for (const [tag, mut] of cases) {
    const s = Q.plain(PC.sample.state()); if (mut) mut(s); s.plans = {};
    const site = PC.site.analyse(s); if (!site || !site.footprint) continue; st.n++;
    const F = H.frameOf(s), pL = F.pL, fp = site.footprint, ex = s.ans.extras;
    if (!ex.seating) { if (site.seating || site.omitted.includes('seating')) f.push(`${tag}: seating off but ${JSON.stringify(site.seating)} / omitted ${site.omitted}`); continue; }
    const pads = myPads(pL, fp, site.parking, site.pool, ex), order = myYardOrder(pL, fp), firstYard = order.find((y) => pads[y].length);
    if (!site.seating) { st.omitted++;
      if (firstYard) f.push(`${tag}: omitted, but QA finds ${pads[firstYard].length} pad(s) in the ${firstYard} yard, e.g. ${JSON.stringify(pads[firstYard][0])}`);
      if (!site.omitted.includes('seating')) f.push(`${tag}: no seating and not listed as omitted`);
      continue; }
    const p = site.seating, yardOf = order.filter((y) => pads[y].some((q) => near(q.u, p.u, 1e-9) && near(q.v, p.v, 1e-9)));
    st.by[yardOf[0] || 'invalid'] = (st.by[yardOf[0] || 'invalid'] || 0) + 1;
    if (!yardOf.length) { f.push(`${tag}: pad ${JSON.stringify(p)} is not a valid 0.5 m pad by QA's rules`); continue; }
    if (yardOf[0] !== firstYard && !yardOf.includes(firstYard)) f.push(`${tag}: placed in the ${yardOf[0]} yard, but QA's order ${order.join(' > ')} has room first in the ${firstYard} yard`);
    const alongWant = yardOf.includes(firstYard) && (firstYard === 'back' || firstYard === 'front') ? 'u' : 'v';
    if (p.along !== alongWant || p.w !== 3 || p.d !== 3) f.push(`${tag}: along ${p.along} (${firstYard} yard: ${alongWant}), ${p.w} x ${p.d}`);
  }
  R.check(`S ${st.n} sites (sample, 70 seeded plots with parking / pool / setbacks / gate varied, a tight 16 x 18 m plot, seating off): seating = the first yard with room in QA's order (back, wider side, other side, front) on QA's exhaustive 0.5 m search, a valid pad (0.3 m inside the plot, clear of footprint + 1, parking, pool + 1, path strip), along = the facade's axis; omitted only when nothing fits`, cut(f, 8));
  R.note(`S placements by yard: ${JSON.stringify(st.by)}, omitted ${st.omitted}`);
  R.check('S the cases reach every yard (back, right, left, front) and the omitted branch', ['back', 'right', 'left', 'front'].every((y) => st.by[y] > 0) && st.omitted > 0 ? [] : [JSON.stringify(st.by) + ' omitted ' + st.omitted]);
  // the warning: text, q 17, only when omitted; the sample shows none
  const g = [];
  const tight = Q.plain(PC.sample.state()); tight.plot.pts = [[0, 0], [16, 0], [16, 18], [0, 18]]; tight.ans.streetEdge = 0; tight.ans.footprintPct = 50;
  const tw = PC.validate(tight).warnings, sw = PC.validate(Q.plain(PC.sample.state())).warnings, row = tw.find((x) => x.code === 'seating-omitted');
  if (!PC.site.analyse(tight).omitted.includes('seating')) g.push('tight plot: seating fits (no case)');
  if (!row || row.q !== 17 || row.text !== SEAT_TEXT) g.push(`row ${JSON.stringify(row)}`);
  if (sw.length) g.push(`sample warnings ${JSON.stringify(sw)}`);
  R.check('S tight 16 x 18 m plot at 50 %: seating omitted with the warning "Garden seating does not fit in the yard: …" (kind warn, q 17); the sample has no seating warning', g);
  // 3D: pad, table, benches along the facade axis
  const t = [];
  for (const [tag, mut] of [['sample (back, along u)', null], ['seeded side yard', (s) => { s.plot.pts = [[0, 0], [40, 0], [40, 22], [0, 22]]; s.ans.streetEdge = 0; s.ans.footprintPct = 30; s.ans.pool = { on: false, size: 'S' }; s.ans.setbacks = { front: 3, back: 1, side: 2 }; }]]) {
    const s = make(mut), h = PC.house.build(s); if (!h || !h.site.seating) { t.push(`${tag}: no seating`); continue; }
    const F = H.frameOf(s), p = h.site.seating, it = siteItems(scene(h).world), mu = p.u + 1.5, mv = p.v + 1.5, SC = T3.siteColors;
    const need = [[tb(F, p.u, p.u + 3, p.v, p.v + 3, 0, 0.05), SC.paving, 'pad'], [tb(F, mu - 0.45, mu + 0.45, mv - 0.45, mv + 0.45, 0.05, 0.8), SC.seating, 'table']];
    for (const o of [-0.9, 0.9]) need.push([p.along === 'u' ? tb(F, mu - 0.8, mu + 0.8, mv + o - 0.225, mv + o + 0.225, 0.05, 0.5) : tb(F, mu + o - 0.225, mu + o + 0.225, mv - 0.8, mv + 0.8, 0.05, 0.5), SC.seating, `bench ${o}`]);
    for (const [b, hex, w] of need) if (!it.some((x) => boxEq(x, b) && isCol(x, hex))) t.push(`${tag} (along ${p.along}): no ${w}`);
    R.note(`S 3D ${tag}: seating at ${p.u},${p.v} along ${p.along}`);
  }
  R.check('S 3D: a 3 x 3 x 0.05 m paving pad, a 0.9 x 0.9 x 0.75 m table and two 1.6 x 0.45 x 0.45 m benches 0.9 m either side, long side parallel to the facade', t);
}

// ================= P. pool, parking, needle =================
if (want('P')) {
  const f = [];
  for (const [tag, mut] of [['sample (pool S, 2 covered cars)', null], ['pool L, 4 covered cars', (s) => { s.plot.pts = [[0, 0], [36, 0], [36, 44], [0, 44]]; s.ans.streetEdge = 0; s.ans.pool = { on: true, size: 'L' }; s.ans.parking = { cars: 4, covered: true }; }], ['open parking', (s) => { s.ans.parking = { cars: 3, covered: false }; }], ['pool off', (s) => { s.ans.pool = { on: false, size: 'S' }; }]]) {
    const s = make(mut), h = PC.house.build(s); if (!h) { f.push(`${tag}: no house`); continue; }
    const F = H.frameOf(s), { world } = scene(h), it = siteItems(world), SC = T3.siteColors, q = h.site.pool, p = h.site.parking, water = byName(world, 'poolWater');
    if (!q) { if (water.length) f.push(`${tag}: poolWater without a pool`); if (it.some((x) => isCol(x, SC.poolRim) && x.kind === 'box')) f.push(`${tag}: pool rim without a pool`); }
    else { if (water.length !== 1) { f.push(`${tag}: ${water.length} poolWater meshes`); } else { const w = water[0]; w.geometry.computeBoundingBox(); const bb = new THREE.Box3().setFromObject(w);
        if (!(near(bb.min.y, 0.03) && near(bb.max.y, 0.03) && near(bb.min.x, F.X(q.u)) && near(bb.max.x, F.X(q.u + q.w)) && near(bb.min.z, F.Z(q.v + q.d)) && near(bb.max.z, F.Z(q.v)))) f.push(`${tag}: water ${JSON.stringify([bb.min, bb.max])} not exactly the pool at Y 0.03`);
        if (w.parent.name !== 'site' || w.castShadow || !w.receiveShadow) f.push(`${tag}: water parent / shadows`); }
      // rim: 0.3 m ring, 0.1 m high, outside the water, its inner edge on the water's edge (flush), no overlap with it
      const k = 0.3; for (const [b, w] of [[tb(F, q.u - k, q.u + q.w + k, q.v - k, q.v, 0, 0.1), 'front'], [tb(F, q.u - k, q.u + q.w + k, q.v + q.d, q.v + q.d + k, 0, 0.1), 'back'], [tb(F, q.u - k, q.u, q.v, q.v + q.d, 0, 0.1), 'left'], [tb(F, q.u + q.w, q.u + q.w + k, q.v, q.v + q.d, 0, 0.1), 'right']]) if (!it.some((x) => boxEq(x, b) && isCol(x, SC.poolRim))) f.push(`${tag}: no ${w} rim flush with the water`); }
    if (p) { for (let i = 0; i < p.cars; i++) if (!it.some((x) => boxEq(x, tb(F, p.u + 2.5 * i, p.u + 2.5 * (i + 1), p.v, p.v + p.d, 0, 0.02)) && isCol(x, SC.paving))) f.push(`${tag}: no pad for car ${i + 1}`);
      const can = it.filter((x) => isCol(x, SC.carCanopy));
      if (p.covered) { if (!can.some((x) => boxEq(x, tb(F, p.u, p.u + p.w, p.v, p.v + p.d, 2.3, 2.4)))) f.push(`${tag}: no canopy 0.1 m with its top at 2.4 m over the parking`);
        const posts = can.filter((x) => near(x.max[1], 2.3) && near(x.min[1], 0.02) && near(x.max[0] - x.min[0], 0.1) && near(x.max[2] - x.min[2], 0.1)); if (posts.length !== 4) f.push(`${tag}: ${posts.length} canopy posts`); }
      else if (can.length) f.push(`${tag}: canopy on open parking`); }
  }
  R.check('P pool water = the pool rectangle at Y 0.03 with the 0.3 x 0.1 m rim flush around it (none when the pool is off); a 0.02 m pad per car; covered: a 0.1 m canopy with its top at 2.4 m on 4 posts (none when open)', f);
  // needle
  const g = [], nn = [];
  for (const [pname, pts] of PLOTS) for (const north of [null, 0, 45, 90, 195, 315]) {
    const tag = `${pname} north ${north}`;
    const s = make((s) => { s.plot.pts = pts; s.ans.streetEdge = 0; s.ans.north = north; }), h = PC.house.build(s); if (!h) { g.push(`${tag}: no house`); continue; }
    const F = H.frameOf(s), site = h.site, fp = h.footprint, blocked = myBlocked(F.pL, fp, site.parking, site.pool, s.ans.extras).concat(site.seating ? [site.seating] : []), my = myNeedle(F.pL, blocked), m = site.northMarker;
    if (!m || !near(m.L, my.L, 1e-9) || !near(m.u, my.at[0], 1e-6) || !near(m.v, my.at[1], 1e-6)) g.push(`${tag}: marker ${JSON.stringify(m)}, QA ${JSON.stringify({ u: my.at[0], v: my.at[1], L: my.L, corner: my.corner })}`);
    // N tip along W north (Q5, clockwise from +y; null = +y) mapped to T by QA's own frame
    const it = siteItems(scene(h).world).filter((x) => x.kind === 'flat'), Nh = it.find((x) => isCol(x, T3.siteColors.northMarker)), Sh = it.find((x) => isCol(x, T3.siteColors.poolRim));
    if (!Nh || !Sh || it.length !== 2) { nn.push(`${tag}: ${it.length} flat items`); continue; }
    if (!near(Nh.min[1], 0) || !near(Nh.max[1], 0.04)) nn.push(`${tag}: needle height ${Nh.min[1]}..${Nh.max[1]}`);
    const c = [F.X(m.u), F.Z(m.v)], far = (x) => x.v.reduce((b, p) => (Math.hypot(p[0] - c[0], p[2] - c[1]) > Math.hypot(b[0] - c[0], b[2] - c[1]) ? p : b)), tip = far(Nh), stip = far(Sh);
    const n = north === null ? 0 : north, wN = [Math.sin(n * Math.PI / 180), Math.cos(n * Math.PI / 180)], o = Q.toL([...s.plot.pts, s.plot.pts[0], [s.plot.pts[0][0] + wN[0], s.plot.pts[0][1] + wN[1]]], 0).slice(-2), dL = north === null ? [0, 1] : [o[1][0] - o[0][0], o[1][1] - o[0][1]], dT = [dL[0], -dL[1]];
    const tv = [tip[0] - c[0], tip[2] - c[1]], tl = Math.hypot(...tv);
    if (!near(tl, my.L / 2, 1e-3) || Math.abs(tv[0] / tl - dT[0]) > 1e-4 || Math.abs(tv[1] / tl - dT[1]) > 1e-4) nn.push(`${tag}: N tip ${tv.map((x) => x.toFixed(3))} (length ${tl.toFixed(3)}), QA north in T ${dT.map((x) => x.toFixed(3))} x ${(my.L / 2).toFixed(3)}`);
    const sv = [stip[0] - c[0], stip[2] - c[1]]; if (Math.abs(sv[0] + tv[0]) > 1e-3 || Math.abs(sv[1] + tv[1]) > 1e-3) nn.push(`${tag}: S tip not opposite`);
  }
  R.check(`P north needle on ${PLOTS.length} plots x 6 Q5 values: place and L = QA's corner walk (FL, FR, BL, BR; L = clamp(0.06 x bbox, 1.5, 3); 0.7 m + L/2 from every edge; first corner clear of footprint + 1, path, parking, pool + 1, seating)`, cut(g, 8));
  R.check('P north needle: N half (northMarker) tip at L/2 along Q5\'s W north mapped to T by QA\'s own frame (rotated and slanted plots; Q5 unset = the street edge\'s inward normal, A-4), S half (poolRim) opposite, 0.04 m high', cut(nn, 8));
}

// ================= B. budget =================
if (want('B')) {
  const f = [];
  const smp = make(), hs = PC.house.build(smp), sw0 = scene(hs).world, ms = meshes(sw0).length, nNew = (w) => meshes(w).filter((m) => isNew(m.name)).length;
  const LIM = F6 ? 64 : 18;   // F6-T1: the mesh budget is 64 (plan §8 / C-4); the new meshes are counted by name
  const mx = make((s) => { s.plot.pts = [[0, 0], [60, 0], [60, 50], [0, 50]]; s.ans.streetEdge = 0; s.ans.footprintPct = 40; s.ans.floors = 3; s.ans.basement = true; s.ans.lift = true; s.ans.usableRoof = true; s.ans.roofType = 'terrace';
    s.ans.pool = { on: true, size: 'L' }; s.ans.parking = { cars: 4, covered: true }; s.ans.extras = { wall: true, gate: 'right', seating: true }; s.ans.interior = { style: 'classic', density: 'full' }; s.ans.pairs = []; s.ans.rooms = []; let n = 1;
    for (const l of ['B', 'G', '1', '2']) for (const ty of Object.keys(Q.ROOM_AREA)) s.ans.rooms.push({ id: 'r' + n++, type: ty, level: l, size: 'S', area: null, master: false }); s.ans.nextRoomId = n; });
  const t1 = Date.now(), hm = PC.house.build(mx), tm = Date.now() - t1; let mm = null, tb3 = 0;
  if (!hm) f.push('maximum house: no model'); else { const t2 = Date.now(); const sc = scene(hm); tb3 = Date.now() - t2; mm = meshes(sc.world).length;
    if (mx.ans.rooms.length !== 40) f.push(`${mx.ans.rooms.length} rooms`);
    const vx = VEG(hm); if (mm > LIM + (F6 ? 0 : vx)) f.push(`${mm} meshes > ${LIM}${vx && !F6 ? ` + ${vx} vegetation` : ''}`);
    if (!hm.site.pool || !hm.site.parking || !hm.site.gate || !hm.site.seating || !hm.roof.stairHead || !hm.roof.liftHead) f.push(`items missing: ${JSON.stringify({ pool: !!hm.site.pool, parking: !!hm.site.parking, gate: !!hm.site.gate, seating: !!hm.site.seating, heads: [!!hm.roof.stairHead, !!hm.roof.liftHead] })}`);
    if (hm.levels.some((l) => !l.rooms.every((r) => r.furniture.length))) f.push('a room without furniture'); }
  if (ms !== 12 + VEG(hs) + nNew(sw0)) f.push(`sample: ${ms} meshes (FS reports 12${VEG(hs) ? ` + ${VEG(hs)} vegetation (F4-T3)` : ''}${F6 ? ` + ${nNew(sw0)} F6 (paving / needle / tiles / sky / groundRing / blobs / roofDeck${T2 ? ' / textured / lamps / glazing' : ''})` : ''})`);
  R.check(`B maximum house (4 levels x 10 room types, full, lift, pool L, 4 covered cars, wall, gate, seating, usable terrace): ${mm} meshes <= ${F6 ? '64 (F6-T1 budget)' : '18 (+ vegetation from F4-T3)'}, every item present, every room furnished; sample ${ms} meshes`, f);
  R.note(`B maximum house: ${mm} meshes, sample ${ms}; model ${tm} ms, batches ${tb3} ms (node, r128 without renderer)`);
}
R.note(`node run ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
