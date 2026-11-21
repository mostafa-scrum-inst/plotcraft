import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
const PC = loadCore(), V = PC.validate;
const codes = (list) => plain(list).map((x) => x.code);
const sample = (f) => { const s = PC.sample.state(); if (f) f(s.ans, s); return s; };
const only = (s, code) => plain(V(s).blocking).concat(plain(V(s).warnings)).filter((x) => x.code === code);

test('sample: nothing blocking, no warnings; open plot: empty result', () => {
  const v = V(sample()); assert.deepEqual(codes(v.blocking), []); assert.deepEqual(codes(v.warnings), []);
  const open = V(PC.store.defaults()); assert.deepEqual(plain(open), { blocking: [], warnings: [], summary: null });
  assert.deepEqual(plain(V.blocking(sample())), []);
});

test('floor-empty and basement-empty: named level, clears when a room is added', () => {
  const s = sample((a) => { a.floors = 3; });
  assert.deepEqual(only(s, 'floor-empty'), [{ code: 'floor-empty', q: 11, level: '2', text: 'Second floor has no rooms: add a room there or reduce the number of floors.' }]);
  s.ans.rooms.push(PC.store.room('r15', 'storage', '2', 'S')); s.ans.nextRoomId = 16;
  assert.deepEqual(only(s, 'floor-empty'), []);
  const b = sample((a) => { a.basement = true; });
  assert.deepEqual(only(b, 'basement-empty').map((x) => [x.q, x.level]), [[11, 'B']]); assert.match(only(b, 'basement-empty')[0].text, /basement has no rooms/);
  b.ans.basement = false; assert.deepEqual(only(b, 'basement-empty'), []);
  const g = sample((a) => { a.rooms = a.rooms.filter((r) => r.level !== 'G'); a.pairs = [['r8', 'r13']]; });
  assert.deepEqual(only(g, 'floor-empty').map((x) => x.level), ['G']);
});

test('buildable-small and no-fit', () => {
  const s = sample((a) => { a.setbacks = { front: 14, back: 13, side: 9 }; });           // 2 x 3 m left
  const b = only(s, 'buildable-small'); assert.equal(b.length, 1); assert.equal(b[0].q, 2);
  assert.match(b[0].text, /^Buildable area is \d+ m² \(minimum 20 m²\): reduce the setbacks or redraw the plot\.$/);
  assert.deepEqual(only(s, 'level-over'), [], 'no needed/available conflict without a footprint');
  s.ans.unit = 'ft'; assert.match(only(s, 'buildable-small')[0].text, /minimum 215 sq ft/);
  s.ans.setbacks = { front: 3, back: 2, side: 2 }; assert.deepEqual(only(s, 'buildable-small'), []);
  const thin = PC.store.defaults(); thin.plot = { pts: [[0, 0], [2.5, 0], [2.5, 40], [0, 40]], closed: true }; thin.ans.streetEdge = 0; thin.ans.setbacks = { front: 0, back: 0, side: 0 };
  assert.deepEqual(only(thin, 'no-fit'), [{ code: 'no-fit', q: 2, level: null, text: 'The building does not fit this plot: reduce the setbacks or redraw the plot.' }]);
});

test('fp-veg-over: footprint % + vegetation % above 100', () => {
  const s = sample((a) => { a.footprintPct = 60; a.vegPct = 45; });
  assert.deepEqual(only(s, 'fp-veg-over'), [{ code: 'fp-veg-over', q: 3, level: null, text: 'Footprint 60 % + vegetation 45 % is more than 100 %: lower one of them.' }]);
  s.ans.vegPct = 40; assert.deepEqual(only(s, 'fp-veg-over'), [], 'exactly 100 is allowed');
});

test('level-over: both numbers, in the current unit, per level, clears after shrinking a room', () => {
  const s = sample((a) => { a.rooms[0].size = null; a.rooms[0].area = 80; });          // ground: 148 + 10 = 158 of 142.5
  let c = only(s, 'level-over');
  assert.deepEqual(c, [{ code: 'level-over', q: 11, level: 'G', text: 'Ground floor: needs 158 m², 143 m² available. Remove or shrink rooms, or raise the footprint %.' }]);
  s.ans.unit = 'ft'; assert.match(only(s, 'level-over')[0].text, /^Ground floor: needs 1701 sq ft, 1534 sq ft available\./);
  s.ans.unit = 'm'; s.ans.rooms[0].area = 60; assert.deepEqual(only(s, 'level-over'), [], '138 of 142.5 fits');
  s.ans.rooms[0].area = 64.5; assert.deepEqual(only(s, 'level-over'), [], 'exactly 142.5 of 142.5 fits');
  s.ans.rooms[0].area = 64.8;                                                           // 142.8 against 142.5: both round to 143
  assert.match(only(s, 'level-over')[0].text, /needs 142\.8 m², 142\.5 m² available/, 'one decimal when the whole numbers are equal');
  const lift = sample((a) => { a.lift = true; a.rooms[0].size = null; a.rooms[0].area = 64; });   // 132 + 10 + 3 = 145
  assert.match(only(lift, 'level-over')[0].text, /needs 145 m², 143 m²/, 'lift allowance counts');
});

test('level-over names a fix that can work: footprint % while free, setbacks once the plot is the limit', () => {
  const free = sample((a) => { a.rooms[0].size = null; a.rooms[0].area = 80; });
  assert.equal(PC.site.analyse(free).footprint.clamped, false);
  assert.match(only(free, 'level-over')[0].text, /available\. Remove or shrink rooms, or raise the footprint %\.$/);
  const narrow = PC.store.defaults(); narrow.plot = { pts: [[0, 0], [9, 0], [9, 40], [0, 40]], closed: true }; narrow.ans.streetEdge = 0;
  narrow.ans.rooms[0].size = 'L'; narrow.ans.rooms[1].size = 'L';                       // ground needs 42 + 20 + 6 + 10 = 78
  const fp = PC.site.analyse(narrow).footprint;
  assert.equal(fp.clamped, true); assert.ok(fp.area < 78);
  const c = only(narrow, 'level-over').filter((x) => x.level === 'G');
  assert.equal(c[0].text, `Ground floor: needs 78 m², ${Math.round(fp.area)} m² available. Remove or shrink rooms, or reduce the setbacks (the building is already as large as this plot allows).`);
  assert.doesNotMatch(c[0].text, /footprint %/);
});

test('field-invalid comes from the session set and names the limits in the current unit', () => {
  const s = sample();
  PC.store.session.invalidFields = { 'setback-front': { q: 2, label: 'Front setback', min: 0, max: 20, unitKind: 'len' }, footprint: { q: 3, label: 'Footprint', min: 10, max: 80, unitKind: 'pct' } };
  assert.deepEqual(only(s, 'field-invalid'), [
    { code: 'field-invalid', q: 3, level: null, text: 'Footprint: enter a number from 10 % to 80 %.' },
    { code: 'field-invalid', q: 2, level: null, text: 'Front setback: enter a number from 0.0 m to 20.0 m.' }]);
  s.ans.unit = 'ft'; assert.match(only(s, 'field-invalid')[1].text, /from 0\.0 ft to 65\.6 ft/);
  PC.store.session.invalidFields = { area: { q: 12, label: 'Room area', min: 4, max: 80, unitKind: 'area' }, cars: { q: 15, label: 'Cars', min: 0, max: 4, unitKind: 'count' } };
  assert.deepEqual(only(s, 'field-invalid').map((x) => x.text), ['Room area: enter a number from 43 sq ft to 861 sq ft.', 'Cars: enter a number from 0 to 4.']);
  assert.equal(PC.stages.status(s)[2].valid, false, 'an invalid field blocks stage 2');
  PC.store.session.invalidFields = {}; assert.deepEqual(only(s, 'field-invalid'), []); assert.equal(PC.stages.status(s)[2].valid, true);
});

test('warnings: clamped footprint, reduced vegetation, parking omitted, pool omitted, each with its figures', () => {
  const narrow = PC.store.defaults(); narrow.plot = { pts: [[0, 0], [9, 0], [9, 40], [0, 40]], closed: true }; narrow.ans.streetEdge = 0; narrow.ans.parking.cars = 4;
  const site = PC.site.analyse(narrow), w = plain(V(narrow).warnings);
  assert.deepEqual(w.map((x) => [x.code, x.q]), [['fp-clamped', 3], ['parking-omitted', 15]]);
  // 9 x 40 m: 5 m wide inside the setbacks; step 4b stretches the house to 5 x 15 m, so the 3:1 limit is what stops it
  assert.equal(w[0].text, `The building is limited to 5.0 × 15.0 m (${Math.round(site.footprint.area)} m², ${Math.round(site.footprint.pct * 10) / 10} % of the plot): on this narrow plot it may be at most 3 times as long as it is wide. Smaller setbacks along its long sides would allow a larger building.`);
  assert.match(w[1].text, /^Parking does not fit/);
  const sq = PC.store.defaults(); sq.plot = { pts: [[0, 0], [20, 0], [20, 20], [0, 20]], closed: true }; sq.ans.streetEdge = 0; sq.ans.pool = { on: true, size: 'L' }; sq.ans.vegPct = 80; sq.ans.footprintPct = 20;
  const v = plain(V(sq).warnings), s2 = PC.site.analyse(sq);
  assert.deepEqual(v.map((x) => [x.code, x.q]), [['veg-reduced', 4], ['pool-omitted', 16]]);
  assert.equal(v[0].text, `Vegetation was reduced to what fits: ${Math.round(s2.veg.area)} m² (${Math.round(s2.veg.pct * 10) / 10} %).`);
  assert.deepEqual(codes(V(sq).blocking), [], 'warnings do not block');
  assert.equal(PC.stages.status(sq)[2].valid, true);
});

test('summary numbers', () => {
  const s = sample((a) => { a.basement = true; }), sum = plain(V(s).summary);
  assert.deepEqual(sum.levels.map((l) => [l.id, l.name, l.needed, l.available]), [['B', 'Basement', 10, 142.5], ['G', 'Ground floor', 120, 142.5], ['1', 'First floor', 120, 142.5]]);
  assert.ok(Math.abs(sum.buildableArea - 389.5) < 1.5); assert.equal(sum.footprintPct.toFixed(1), '24.4');
});

test('rule table: every code has a kind and a text; results are cached only for frozen (store) states', () => {
  for (const [code, r] of Object.entries(V.RULES)) { assert.ok(r.kind === 'block' || r.kind === 'warn', code); assert.ok(r.text.length > 10, code); }
  assert.deepEqual(Object.keys(V.RULES).length, 12);   // F4-T2: seating-omitted (PM round 10 Q8)
  const s = sample(); V(s); s.ans.floors = 3; assert.deepEqual(codes(V(s).blocking), ['floor-empty'], 'a plain object mutated in place is re-evaluated');
  PC.store.init(sample()); const a = V(PC.store.get()); assert.equal(V(PC.store.get()), a, 'same store state: same result object');
});

test('normaliseRoof: usable roof makes Pitched unavailable', () => {
  const a = { usableRoof: true, roofType: 'pitched' }; assert.equal(V.normaliseRoof(a), true); assert.equal(a.roofType, 'flat');
  assert.equal(V.normaliseRoof(a), false);
  const b = { usableRoof: false, roofType: 'pitched' }; assert.equal(V.normaliseRoof(b), false); assert.equal(b.roofType, 'pitched');
  const c = { usableRoof: true, roofType: 'terrace' }; assert.equal(V.normaliseRoof(c), false); assert.equal(c.roofType, 'terrace');
});

test('pool-omitted states its clearance through PC.units: 1.0 m / 3.3 ft (F2-T1 QA bug 2)', () => {
  const sq = (unit) => { const s = PC.store.defaults(); s.plot = { pts: [[0, 0], [20, 0], [20, 20], [0, 20]], closed: true }; s.ans.streetEdge = 0; s.ans.pool = { on: true, size: 'L' }; s.ans.vegPct = 80; s.ans.footprintPct = 20; s.ans.unit = unit; return s; };
  assert.ok(only(sq('m'), 'pool-omitted')[0].text.startsWith('The pool with its 1.0 m clearance does not fit behind or beside the building: it is left out of the 3D scene.'));
  assert.ok(only(sq('ft'), 'pool-omitted')[0].text.startsWith('The pool with its 3.3 ft clearance does not fit behind or beside the building: it is left out of the 3D scene.'));
  for (const code of Object.keys(V.RULES)) assert.doesNotMatch(V.RULES[code].text, /\d\s*(m|ft|m²)\b/, `${code}: no literal length or area in the text`);
});

test('fp-clamped: the proportion wording for a 3:1-limited building, the setbacks wording otherwise, in m and ft (F2-S3 round 4)', () => {
  const mk = (w, h, pct, unit) => { const s = PC.store.defaults(); s.plot = { pts: [[0, 0], [w, 0], [w, h], [0, h]], closed: true }; s.ans.streetEdge = 0; s.ans.footprintPct = pct; s.ans.unit = unit; s.ans.parking.cars = 0; return s; };
  assert.deepEqual(only(mk(10, 50, 30, 'm'), 'fp-clamped').map((x) => x.text), ['The building is limited to 6.0 × 18.0 m (108 m², 21.6 % of the plot): on this narrow plot it may be at most 3 times as long as it is wide. Smaller setbacks along its long sides would allow a larger building.']);
  assert.deepEqual(only(mk(10, 50, 30, 'ft'), 'fp-clamped').map((x) => x.text), ['The building is limited to 19.7 × 59.1 ft (1163 sq ft, 21.6 % of the plot): on this narrow plot it may be at most 3 times as long as it is wide. Smaller setbacks along its long sides would allow a larger building.']);
  assert.deepEqual(only(mk(20, 30, 80, 'm'), 'fp-clamped').map((x) => x.text), ['The building was reduced to fit inside the setbacks: 392 m² (65.3 % of the plot).']);
  assert.deepEqual(only(mk(10, 50, 20, 'm'), 'fp-clamped'), [], 'not clamped: no warning');
  assert.equal(only(mk(10, 50, 24, 'm'), 'fp-clamped').length, 1, 'exactly one wording');
  assert.doesNotMatch(V.RULES['fp-clamped'].proportion, /\d\s*(m|ft|m²)\b/, 'no literal unit in the text');
});

test('parking-omitted and pool-omitted end with the PM fix hints (F2 review decision 3), in m and ft', () => {
  const narrow = (unit) => { const s = PC.store.defaults(); s.plot = { pts: [[0, 0], [9, 0], [9, 40], [0, 40]], closed: true }; s.ans.streetEdge = 0; s.ans.parking.cars = 4; s.ans.unit = unit; return s; };
  for (const u of ['m', 'ft']) assert.equal(only(narrow(u), 'parking-omitted')[0].text, 'Parking does not fit between the building and the street: it is left out of the 3D scene. Try fewer cars, a lower footprint % or a larger front setback (it moves the building back from the street).');
  const sq = (unit) => { const s = PC.store.defaults(); s.plot = { pts: [[0, 0], [20, 0], [20, 20], [0, 20]], closed: true }; s.ans.streetEdge = 0; s.ans.pool = { on: true, size: 'L' }; s.ans.vegPct = 80; s.ans.footprintPct = 20; s.ans.unit = unit; return s; };
  assert.equal(only(sq('m'), 'pool-omitted')[0].text, 'The pool with its 1.0 m clearance does not fit behind or beside the building: it is left out of the 3D scene. Try a smaller pool, a lower footprint % or a larger back setback (it moves the building toward the street).');
  assert.match(only(sq('ft'), 'pool-omitted')[0].text, /^The pool with its 3\.3 ft clearance .* Try a smaller pool, a lower footprint % or a larger back setback/);
});
