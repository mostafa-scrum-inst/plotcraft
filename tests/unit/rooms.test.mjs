// F2-T3 increment 2: room list helpers of PC.levels (F2-S2) and the remove-level dialog texts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

const PC = loadCore(), L = PC.levels;
const sample = () => plain(PC.sample.state());
const fresh = () => { const s = plain(PC.store.defaults()); s.plot = { pts: [[0, 0], [20, 0], [20, 20], [0, 20]], closed: true }; s.ans.streetEdge = 0; return s; };
const names = (s) => plain(L.roomNames(s));

test('addRooms: count, auto names, unique increasing ids, nextRoomId; exact area in m2', () => {
  const s = fresh();
  const r = L.addRooms(s, { type: 'bedroom', level: '1', size: 'M', area: null, count: 3 });
  assert.equal(r.ok, true); assert.deepEqual(plain(r.ids), ['r7', 'r8', 'r9']); assert.equal(s.ans.nextRoomId, 10);
  const n = names(s);
  assert.deepEqual(['r4', 'r5', 'r7', 'r8', 'r9'].map((id) => n[id]), ['Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bedroom 4', 'Bedroom 5']);
  const e = L.addRooms(s, { type: 'storage', level: 'G', size: null, area: PC.units.areaFromDisplay(100, 'ft'), count: 1 });
  assert.equal(e.ok, true);
  const room = s.ans.rooms.filter((x) => x.id === e.ids[0])[0];
  assert.deepEqual([room.size, room.area], [null, 9.2903], 'typed in sq ft, stored in m2 (4 decimals)');
  assert.ok(PC.draft.validState(s));
});

test('addRooms refusals leave the draft untouched: full level (free count), area range, count, level', () => {
  const s = sample(), before = JSON.stringify(s);
  assert.deepEqual(plain(L.addRooms(s, { type: 'bedroom', level: 'G', size: 'M', area: null, count: 4 })), { ok: false, reason: 'full', free: 3, have: 7 });
  for (const a of [3.99, 80.01, NaN]) assert.equal(L.addRooms(s, { type: 'office', level: 'G', size: null, area: a, count: 1 }).reason, 'area', `area ${a}`);
  for (const c of [0, 1.5, 11]) assert.equal(L.addRooms(s, { type: 'office', level: 'G', size: 'S', area: null, count: c }).reason, 'count', `count ${c}`);
  assert.equal(L.addRooms(s, { type: 'office', level: 'B', size: 'S', area: null, count: 1 }).reason, 'level', 'no basement');
  assert.equal(JSON.stringify(s), before);
  for (const a of [4, 80]) assert.equal(L.addRooms(sample(), { type: 'office', level: 'G', size: null, area: a, count: 1 }).ok, true, `area ${a} accepted`);
  assert.equal(L.addRooms(sample(), { type: 'bedroom', level: 'G', size: 'M', area: null, count: 3 }).ok, true, 'the 10th room fits');
});

test('updateRoom: a type away from bedroom clears master', () => {
  const s = sample();
  assert.deepEqual(plain(L.updateRoom(s, 'r8', { type: 'office' })), { ok: true, pairsDropped: 0 });
  assert.equal(s.ans.rooms.filter((r) => r.id === 'r8')[0].master, false);
});

test('updateRoom: level move to a level with room keeps the room, drops its pairs; full target refused', () => {
  const s = sample(); L.removeRoom(s, 'r7');                         // ground floor: 6 rooms
  const r = L.updateRoom(s, 'r13', { level: 'G' });
  assert.deepEqual(plain(r), { ok: true, pairsDropped: 1 }, 'r8 + r13 pair removed');
  assert.deepEqual(plain(s.ans.pairs), [['r3', 'r4']]);
  L.addRooms(s, { type: 'office', level: 'G', size: 'S', area: null, count: 3 });     // ground floor: 10
  const before = JSON.stringify(s);
  assert.deepEqual(plain(L.updateRoom(s, 'r14', { level: 'G' })), { ok: false, reason: 'full', free: 0 });
  assert.equal(JSON.stringify(s), before);
  assert.equal(L.updateRoom(s, 'r9', { size: null, area: 20 }).ok, true);
  assert.deepEqual(['size', 'area'].map((k) => s.ans.rooms.filter((x) => x.id === 'r9')[0][k]), [null, 20]);
  assert.equal(L.updateRoom(s, 'r9', { size: 'L', area: null }).ok, true);
  assert.deepEqual(['size', 'area'].map((k) => s.ans.rooms.filter((x) => x.id === 'r9')[0][k]), ['L', null]);
  assert.equal(L.updateRoom(s, 'r9', { size: null, area: 90 }).reason, 'area');
  assert.equal(L.updateRoom(s, 'r99', { type: 'office' }).reason, 'missing');
  assert.ok(PC.draft.validState(s));
});

test('removeRoom removes its pairs; setMaster: one per house, bedrooms only', () => {
  const s = sample();
  L.removeRoom(s, 'r4'); assert.deepEqual(plain(s.ans.pairs), [['r8', 'r13']]);
  assert.equal(L.setMaster(s, 'r9', true).ok, true);
  assert.deepEqual(s.ans.rooms.filter((r) => r.master).map((r) => r.id), ['r9'], 'the previous master is off');
  assert.equal(L.setMaster(s, 'r12', true).reason, 'type', 'an office cannot be master');
  L.setMaster(s, 'r9', false); assert.equal(s.ans.rooms.some((r) => r.master), false);
  assert.ok(PC.draft.validState(s));
});

test('addPair: same level only, no self pair, duplicates ignored (either order), id order, 6 per level', () => {
  const s = sample();
  assert.equal(L.addPair(s, 'r1', 'r1').reason, 'self');
  assert.equal(L.addPair(s, 'r1', 'r9').reason, 'levels');
  assert.deepEqual(plain(L.addPair(s, 'r4', 'r3')), { ok: true, dup: true });
  assert.equal(L.addPair(s, 'r7', 'r1').ok, true); assert.deepEqual(plain(s.ans.pairs.at(-1)), ['r1', 'r7']);
  for (const p of [['r1', 'r2'], ['r1', 'r3'], ['r2', 'r5'], ['r6', 'r7']]) assert.equal(L.addPair(s, p[0], p[1]).ok, true);
  assert.equal(L.pairsOn(s, 'G').length, 6);
  assert.deepEqual(plain(L.addPair(s, 'r5', 'r6')), { ok: false, reason: 'max', level: 'G' });
  assert.equal(L.removePair(s, 'r7', 'r1').ok, true); assert.equal(L.pairsOn(s, 'G').length, 5);
  assert.ok(PC.draft.validState(s));
});

test('nearestLevel and moveRooms', () => {
  assert.equal(L.nearestLevel('B', ['G', '1']), 'G');
  assert.equal(L.nearestLevel('2', ['G', '1']), '1');
  assert.equal(L.nearestLevel('1', ['G']), 'G');
  assert.equal(L.nearestLevel('1', ['B', 'G']), 'G');
  const s = sample(); L.removeRoom(s, 'r7'); L.removeRoom(s, 'r6'); L.removeRoom(s, 'r5');   // G: 4 rooms
  assert.deepEqual(plain(L.moveRooms(s, '1', 'G')), { ok: false, reason: 'full' }, '4 + 7 > 8');
  const t = fresh();                                                 // G 3 rooms, 1st 3 rooms
  t.ans.pairs = [['r4', 'r6']];
  assert.deepEqual(plain(L.moveRooms(t, '1', 'G')), { ok: true, moved: 3 });
  assert.deepEqual(L.roomsOn(t, 'G').length, 6); assert.deepEqual(plain(t.ans.pairs), [['r4', 'r6']], 'pairs move with the rooms');
  const u = fresh(); u.ans.pairs = [['r1', 'r2'], ['r1', 'r3'], ['r2', 'r3'], ['r4', 'r5'], ['r4', 'r6'], ['r5', 'r6']];
  L.addRooms(u, { type: 'office', level: 'G', size: 'S', area: null, count: 1 });
  L.addPair(u, 'r3', 'r7');                                          // G: 4 pairs, first floor: 3 -> 7 > 6
  assert.deepEqual(plain(L.moveRooms(u, '1', 'G')), { ok: false, reason: 'pairs' });
});

test('removeLevels: move / delete, prune, roof rule; texts of the dialog', () => {
  const s = fresh(), change = (a) => { a.floors = 1; };
  const m = plain(s); assert.equal(L.removeLevels(m, change, 'move').ok, true);
  assert.deepEqual([m.ans.floors, L.roomsOn(m, 'G').length, m.ans.rooms.length], [1, 6, 6]);
  const d = plain(s); assert.equal(L.removeLevels(d, change, 'delete').ok, true);
  assert.deepEqual([d.ans.rooms.length, L.roomsOn(d, 'G').length], [3, 3]);
  const full = sample(), f2 = plain(full);
  assert.deepEqual(plain(L.removeLevels(f2, change, 'move')), { ok: false, reason: 'full', gone: ['1'] });
  assert.equal(L.removalQuestion(full, ['1'], 'G', null), 'The First floor has 7 rooms. Move them to the Ground floor, or delete them?');
  assert.equal(L.removalQuestion(full, ['1'], 'G', 'full'), 'The First floor has 7 rooms. They cannot be moved: the Ground floor would have more than 10 rooms. Delete them?');
  assert.equal(L.removalQuestion(full, ['1'], 'G', 'pairs'), 'The First floor has 7 rooms. They cannot be moved: the Ground floor would have more than 6 pairs. Delete them?');
  const b = fresh(); b.ans.basement = true; b.ans.rooms.push(plain(PC.store.room('r7', 'storage', 'B', 'S'))); b.ans.nextRoomId = 8;
  assert.equal(L.removalQuestion(b, ['B'], 'G', null), 'The Basement has 1 room. Move it to the Ground floor, or delete it?');
  // PM round 6: the sentence names only what the plans hold (edits / approval / both; union for several levels)
  const pl = (edited, approved) => ({ sig: 'x', rooms: [], unmet: [], edited, approved, error: null });
  const ps = { plans: { B: pl(true, true), G: pl(true, false), 1: pl(false, true) } };
  assert.equal(L.plansSentence([], ['B'], ps), '');
  assert.equal(L.plansSentence(['B'], ['B'], ps), 'The floor plan of the Basement will be lost, with its manual edits and approval.');
  assert.equal(L.plansSentence(['G'], [], ps), 'The floor plan of the Ground floor will be regenerated, with its manual edits.');
  assert.equal(L.plansSentence(['1'], [], ps), 'The floor plan of the First floor will be regenerated, with its approval.');
  assert.equal(L.plansSentence(['G', '1'], ['1'], ps), 'The floor plans of the Ground floor and the First floor will be regenerated or lost, with their manual edits and approvals.');
  const ps2 = { plans: { G: pl(false, true), 1: pl(false, true) } };
  assert.equal(L.plansSentence(['G', '1'], [], ps2), 'The floor plans of the Ground floor and the First floor will be regenerated, with their approvals.');
  const ps3 = { plans: { G: pl(true, false), 1: pl(true, false) } };
  assert.equal(L.plansSentence(['G', '1'], ['G', '1'], ps3), 'The floor plans of the Ground floor and the First floor will be lost, with their manual edits.');
  const r = plain(s); r.ans.roofType = 'pitched';
  assert.equal(L.removeLevels(r, (a) => { a.usableRoof = true; }, 'delete').roofSwitched, true);
  assert.equal(r.ans.roofType, 'flat');
});

test('200 random operations keep a valid draft', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const s = fresh(), T = PC.C.ROOM_TYPES, pick = (a) => a[Math.floor(rnd() * a.length)];
  for (let k = 0; k < 200; k++) {
    const ids = s.ans.rooms.map((r) => r.id), lv = L.ids(s), op = Math.floor(rnd() * 7);
    if (op === 0) L.addRooms(s, { type: pick(T), level: pick(lv), size: rnd() < 0.3 ? null : pick(['S', 'M', 'L']), area: 4 + rnd() * 76, count: 1 + Math.floor(rnd() * 3) });
    else if (op === 1 && ids.length) L.removeRoom(s, pick(ids));
    else if (op === 2 && ids.length) L.updateRoom(s, pick(ids), { type: pick(T), level: pick(lv) });
    else if (op === 3 && ids.length) L.setMaster(s, pick(ids), rnd() < 0.7);
    else if (op === 4 && ids.length) L.addPair(s, pick(ids), pick(ids));
    else if (op === 5 && s.ans.pairs.length) { const p = pick(s.ans.pairs); L.removePair(s, p[1], p[0]); }
    else if (op === 6) { const c = plain(s), fl = 1 + Math.floor(rnd() * 3), bs = rnd() < 0.5; if (L.removeLevels(c, (a) => { a.floors = fl; a.basement = bs; }, rnd() < 0.5 ? 'move' : 'delete').ok) Object.assign(s, c); }
    assert.ok(PC.draft.validState(s), `operation ${k} (${op}) keeps a valid draft`);
    assert.ok(s.ans.rooms.filter((r) => r.master).length <= 1, 'one master at most');
  }
});
