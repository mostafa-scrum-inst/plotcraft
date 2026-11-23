// F4-T2: PC.furnish.room (A-11 placement rule) and the furniture in the house model (A-9; plan §4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';

const PC = loadCore(), F = PC.furnish, TYPES = PC.C.ROOM_TYPES, I = PC.C.FURNISH.inset;
const E = 1e-9;
const near = (a, b, msg) => { a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < 1e-9, `${msg || ''} [${i}] ${x} vs ${b[i]}`)); };
const inside = (p, r) => p.x >= r.x + I - E && p.x + p.w <= r.x + r.w - I + E && p.y >= r.y + I - E && p.y + p.d <= r.y + r.h - I + E;
const clash = (p, q) => Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) > 0.01 + E && Math.min(p.y + p.d, q.y + q.d) - Math.max(p.y, q.y) > 0.01 + E;
// rooms of every type: S / M / L areas (square and 1 : 2, both ways), and the 1.5 m minimum side
function rooms(type) {
  const out = [];
  for (const k of PC.C.SIZES) {
    const a = PC.levels.roomArea({ type, size: k, area: null }), s = Math.sqrt(a), l = Math.sqrt(a / 2);
    out.push([s, s], [l, 2 * l], [2 * l, l]);
  }
  out.push([1.5, 1.5], [1.5, 4.5], [4.5, 1.5], [1.5, 3]);
  return out.map(([w, h], i) => ({ x: i * 0.5, y: 2 - i * 0.25, w, h }));
}

test('every piece inside its room, no two overlapping by more than 0.01 m: 10 types x S / M / L and the 1.5 m side, both densities', () => {
  let n = 0;
  for (const t of TYPES) for (const r of rooms(t)) for (const dens of ['full', 'sparse']) {
    const ps = F.room(r, PC.data.furniture[t], dens), at = `${t} ${r.w.toFixed(2)} x ${r.h.toFixed(2)} ${dens}`;
    ps.forEach((p, i) => {
      assert.ok(inside(p, r), `${at}: ${p.kind} inside`);
      assert.ok(p.w > 0 && p.d > 0 && p.y0 + p.h <= 1.1 + E, `${at}: ${p.kind} size`);
      ps.slice(0, i).forEach((q) => assert.ok(!clash(p, q), `${at}: ${p.kind} / ${q.kind}`));
    });
    n += ps.length;
  }
  assert.ok(n > 500, `${n} pieces checked`);
});

test('sparse keeps only sparse pieces, in table order, and has fewer pieces than full for every type at M', () => {
  for (const t of TYPES) {
    const a = PC.levels.roomArea({ type: t, size: 'M', area: null }), s = Math.sqrt(a), r = { x: 0, y: 0, w: s * 1.2, h: s / 1.2 };
    const full = F.room(r, PC.data.furniture[t], 'full'), sp = F.room(r, PC.data.furniture[t], 'sparse');
    assert.ok(sp.length < full.length, `${t}: sparse ${sp.length} < full ${full.length}`);
    const sparseIds = PC.data.furniture[t].filter((p) => p.sparse).map((p) => p.id);
    assert.deepEqual(sp.map((p) => p.kind), sparseIds.filter((id) => sp.some((p) => p.kind === id)), t);
  }
});

test('orientation, anchors and the turned centre offset (A-11 rule 2-3); scale steps of 0.05 down to 0.60, then dropped', () => {
  // a 4 x 3 bedroom: bed flush with the back wall, centred along it; wardrobe in the front-left corner
  const bed = F.room({ x: 10, y: 20, w: 4, h: 3 }, PC.data.furniture.bedroom, 'sparse');
  const b = bed.find((p) => p.kind === 'bed'), w = bed.find((p) => p.kind === 'wardrobe');
  near([b.w, b.d, b.x + b.w / 2, b.y + b.d], [1.6, 2.0, 12, 20 + 3 - I], 'bed');
  near([w.x, w.y], [10 + I, 20 + I], 'wardrobe');
  // left / right pieces: w along y, d along x
  const tbl = [{ id: 'L', w: 1.2, d: 0.4, h: 0.5, y0: 0, anchor: 'left', color: 'wood', sparse: true }];
  const L = F.room({ x: 0, y: 0, w: 3, h: 3 }, tbl, 'full')[0];
  near([L.w, L.d, L.x], [0.4, 1.2, I], 'left piece');
  // center with W < D: the piece turns (w along y) and so does its offset: (a, b) -> (+y, -x)
  const din = [{ id: 'table', w: 1.6, d: 0.9, h: 0.75, y0: 0, anchor: 'center', color: 'wood', sparse: true },
    { id: 'chairB', w: 0.45, d: 0.45, h: 0.9, y0: 0, anchor: 'center', color: 'fabric', sparse: true, off: [0, 0.75] }];
  const tall = F.room({ x: 0, y: 0, w: 3, h: 4 }, din, 'full'), wide = F.room({ x: 0, y: 0, w: 4, h: 3 }, din, 'full');
  const cx = (p) => p.x + p.w / 2, cy = (p) => p.y + p.d / 2;
  near([tall[0].w, tall[0].d], [0.9, 1.6], 'tall room: table w along y');
  assert.ok(Math.abs(cx(tall[1]) - (1.5 - 0.75)) < 1e-12 && Math.abs(cy(tall[1]) - 2) < 1e-12, 'tall room: the back chair is at -x');
  assert.ok(Math.abs(cx(wide[1]) - 2) < 1e-12 && Math.abs(cy(wide[1]) - (1.5 + 0.75)) < 1e-12, 'wide room: the back chair is at +y');
  // scale: a 2.0 m piece shifted 0.2 m right in a 2.0 m room (inner 0.15-1.85): 1 + 1.2 s <= 1.85 -> s 0.70 (size and
  // offset scale: centre 1 + 0.2 x 0.70); a 3.0 m one would need s 0.50 and is dropped
  const big = (w) => [{ id: 'x', w, d: 0.5, h: 0.5, y0: 0, anchor: 'front', color: 'wood', sparse: true, off: [0.2, 0] }];
  const s85 = F.room({ x: 0, y: 0, w: 2, h: 2 }, big(2), 'full')[0];
  near([s85.w, s85.d, s85.x + s85.w / 2], [1.4, 0.35, 1.14], 'scaled to 0.70, offset scaled too');
  assert.equal(s85.h, 0.5);
  assert.deepEqual(plain(F.room({ x: 0, y: 0, w: 2, h: 2 }, big(3), 'full')), [], 'needs 0.50: dropped');
});

test('overlap of exactly 0.01 m in doubles (0.0100000000000001) is allowed (TL F3-T3 outcome; A-11 1e-9 slack)', () => {
  const t = [{ id: 'a', w: 0.6, d: 0.5, h: 0.5, y0: 0, anchor: 'fl', color: 'wood', sparse: true },
    { id: 'b', w: 1.11, d: 0.5, h: 0.5, y0: 0, anchor: 'fr', color: 'wood', sparse: true }];
  const [a, b] = F.room({ x: 0, y: 0, w: 2, h: 2 }, t, 'full');
  const ov = (a.x + a.w) - b.x;
  assert.ok(ov > 0.01 && ov < 0.01 + 1e-12, `overlap ${ov}`);
  near([b.w], [1.11], 'b kept at scale 1.00');
});

test('house model: furniture per room in L, colours = the Q18 hex; Q18 changes colours only, Q19 sparse fewer; 40 rooms in < 50 ms', () => {
  const s = sampleApproved(PC), h = PC.house.build(s), fp = h.footprint;
  for (const l of h.levels) for (const r of l.rooms) {
    const p = s.plans[l.id].rooms.find((x) => x.id === r.id);
    const want = F.room(p, PC.data.furniture[r.type], 'full');
    assert.deepEqual(plain(r.furniture.map((q) => [q.kind, q.u, q.v, q.w, q.d, q.h, q.y0])), plain(want.map((q) => [q.kind, fp.u + q.x, fp.v + q.y, q.w, q.d, q.h, q.y0])), r.id);
    const st = Object.assign({}, PC.data.interiors.modern, PC.data.interiors.modern.rooms[r.type]);   // F6-T2 I3: the room palette
    r.furniture.forEach((q, i) => assert.equal(q.color, st[want[i].color]));
  }
  const c = PC.house.build(sampleApproved(PC, (d) => { d.ans.interior.style = 'classic'; }));
  const boxes = (x) => x.levels.map((l) => l.rooms.map((r) => r.furniture.map((q) => [q.kind, q.u, q.v, q.w, q.d, q.h, q.y0, (q.parts || []).map((t) => [t.u, t.v, t.w, t.d, t.y0, t.h, t.mat])])));
  assert.deepEqual(plain(boxes(c)), plain(boxes(h)), 'Q18: boxes deep-equal');
  assert.notDeepEqual(c.levels[0].rooms[0].furniture.map((q) => q.color), h.levels[0].rooms[0].furniture.map((q) => q.color), 'Q18: colours differ');
  assert.notEqual(c.key, h.key);
  const sp = PC.house.build(sampleApproved(PC, (d) => { d.ans.interior.density = 'sparse'; }));
  const count = (x) => x.levels.reduce((n, l) => n + l.rooms.reduce((m, r) => m + r.furniture.length, 0), 0);
  assert.ok(count(sp) < count(h), `sparse ${count(sp)} < full ${count(h)}`);
  const m = maxHouse(PC); PC.house.build(m);
  let best = Infinity;
  for (let i = 0; i < 3; i++) { const t0 = performance.now(), mh = PC.house.build(m); best = Math.min(best, performance.now() - t0); assert.equal(mh.levels.reduce((n, l) => n + l.rooms.length, 0), 40); }
  assert.ok(best < 50, `maximum house built in ${best.toFixed(1)} ms`);
});

// F6-T2 I1 / I3 (Designer plan 3; CTO 2.1; TL review Q5): parts from shared templates, inside the envelope; room palettes.
const PARTS = PC.data.furnitureParts;
test('F6-T2 part templates: fractions in [0, 1] and ordered, known roles and mats, no coplanar same-facing overlap (no z-fight)', () => {
  const ROLES = ['main', 'fabric', 'wood', 'accent', 'white', 'metal', 'dark'], MATS = ['plain', 'planks', 'weave', 'lamp'];
  for (const [name, T] of Object.entries(PARTS)) {
    for (const t of T) {
      assert.equal(t.length, 9, name);
      for (const [i, j] of [[0, 1], [2, 3], [4, 5]]) assert.ok(t[i] >= 0 && t[j] <= 1 && t[j] - t[i] > 0.005, `${name} ${t}`);
      assert.ok(ROLES.includes(t[6]) || /^#[0-9A-F]{6}$/.test(t[6]), `${name} role ${t[6]}`);
      assert.ok(t[7] > 0.5 && t[7] < 1.5 && MATS.includes(t[8]), `${name} ${t}`);
    }
    // two parts' faces on the same plane, facing the same way, overlapping in area -> z-fight
    const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 1e-9;
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) for (let ax = 0; ax < 3; ax++) for (const side of [0, 1]) {
      const p = T[i], q = T[j], o = [0, 1, 2].filter((k) => k !== ax);
      if (Math.abs(p[2 * ax + side] - q[2 * ax + side]) > 1e-9) continue;
      assert.ok(!o.every((k) => ov(p[2 * k], p[2 * k + 1], q[2 * k], q[2 * k + 1])), `${name}: parts ${i} and ${j} share a face (axis ${ax}, side ${side})`);
    }
  }
  const used = new Set(TYPES.flatMap((t) => PC.data.furniture[t].filter((p) => p.parts).map((p) => p.parts)));
  assert.deepEqual([...used].sort(), Object.keys(PARTS).sort(), 'every template is used');
});

test('F6-T2 parts in the model: inside the envelope for every type at S / M / L and the 1.5 m rooms, every density; colours resolved', () => {
  const st = PC.data.interiors.classic;
  for (const type of TYPES) for (const room of rooms(type)) {
    const table = PC.data.furniture[type];
    for (const q of F.room(room, table, 'full')) {
      const row = table.find((t) => t.id === q.kind);
      const pc = { kind: q.kind, u: q.x, v: q.y, w: q.w, d: q.d, h: q.h, y0: q.y0 };
      const parts = PC.house.parts(pc, row, q.color, Object.assign({}, st, st.rooms[type]), room.w >= room.h);
      if (!row.parts) { assert.equal(parts, null); continue; }
      assert.equal(parts.length, PARTS[row.parts].length);
      for (const t of parts) {
        const at = `${type} ${q.kind} ${room.w.toFixed(2)}x${room.h.toFixed(2)}`;
        assert.ok(t.u >= pc.u - E && t.u + t.w <= pc.u + pc.w + E && t.v >= pc.v - E && t.v + t.d <= pc.v + pc.d + E, at + ' plan');
        assert.ok(t.y0 >= pc.y0 - E && t.y0 + t.h <= pc.y0 + pc.h + E && t.y0 + t.h <= 1.1 + E, at + ' height');
        assert.match(t.color, /^#[0-9A-F]{6}$/);
      }
    }
  }
});

test('F6-T2 part orientation: the back (z = 1) at the anchor wall, faces turned for chairs; the desk lamp at the back', () => {
  const s = sampleApproved(PC), h = PC.house.build(s);
  for (const l of h.levels) for (const r of l.rooms) for (const q of r.furniture) {
    const row = PC.data.furniture[r.type].find((t) => t.id === q.kind);
    if (!row.parts || row.anchor === 'center' || row.face) continue;
    // the template's last box with z1 = 1 (a back part) touches the anchor wall side of the envelope
    const back = { back: (t) => t.v + t.d, bl: (t) => t.v + t.d, br: (t) => t.v + t.d, front: (t) => -t.v, fl: (t) => -t.v, fr: (t) => -t.v, left: (t) => -t.u, right: (t) => t.u + t.w }[row.anchor];
    const zs = PARTS[row.parts].map((t) => t[3]), i = zs.indexOf(1), j = zs.indexOf(Math.min(...zs));
    assert.ok(back(q.parts[i]) >= back(q.parts[j]) - E, `${r.type} ${q.kind}`);
    assert.ok(Math.abs(back(q.parts[i]) - back({ u: q.u, v: q.v, w: q.w, d: q.d })) < 1e-9, `${r.type} ${q.kind} back on the wall side`);
  }
  // dining (maximum house): chairF faces the table (its back at the front, low v), chairL its back at low u
  const mx = PC.house.build(maxHouse(PC)), dns = mx.levels.flatMap((l) => l.rooms).filter((r) => r.type === 'dining' && r.w >= r.d);
  assert.ok(dns.length && dns.every((r) => r.furniture.some((q) => q.kind === 'chairF')), 'a dining room with chairF, along u');
  for (const dn of dns) for (const q of dn.furniture.filter((x) => x.kind === 'chairF' || x.kind === 'chairL')) {
    const backPart = q.parts[5];   // chair: the back is the 6th box
    if (q.kind === 'chairF') assert.ok(Math.abs(backPart.v - q.v) < q.d * 0.05 + E, 'chairF back at low v');
    else assert.ok(Math.abs(backPart.u - q.u) < q.w * 0.05 + E, 'chairL back at low u');
  }
});

test('F6-T2 I3 room palettes: room types with an override take it, others the style; Q18 changes colours, never parts', () => {
  const h = PC.house.build(sampleApproved(PC, (d) => { d.ans.interior.style = 'classic'; })), I = PC.data.interiors.classic;
  for (const l of h.levels) for (const r of l.rooms) for (const q of r.furniture) {
    const row = PC.data.furniture[r.type].find((t) => t.id === q.kind), o = I.rooms[r.type] || {};
    assert.equal(q.color, o[row.color] || I[row.color], `${r.type} ${q.kind}`);
  }
});
