// Ready states for the 3D tests (F4-T1): the sample and the G6 maximum house, synced and approved, stage 5.
import { plain } from './load.mjs';

// Sample (6.2) with every level laid out and approved, as "Skip to 3D" leaves it.
export function sampleApproved(PC, edit) {
  const s = plain(PC.sample.state());
  if (edit) edit(s);
  PC.plans.sync(s);
  for (const id of PC.levels.ids(s)) if (s.plans[id] && !s.plans[id].error) s.plans[id].approved = true;
  s.stage = 5;
  return s;
}

// G6 maximum house: 3 floors + basement, 8 rooms per level, lift, usable roof off, full furniture, pool, 4 covered
// cars, all extras, on a 40 x 40 m plot.
export function maxHouse(PC, o = {}) {
  const s = plain(PC.store.defaults()), a = s.ans, R = PC.store.room;
  s.plot = { pts: [[0, 0], [40, 0], [40, 40], [0, 40]], closed: true };
  a.streetEdge = 0; a.footprintPct = 30; a.vegPct = 20;
  a.floors = 3; a.basement = true; a.lift = true; a.stairPos = o.stairPos || 'centre';
  a.parking = { cars: 4, covered: true }; a.pool = { on: true, size: 'L' }; a.extras = { wall: true, gate: 'centre', seating: true };
  a.interior = { style: 'classic', density: 'full' };
  const types = ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'office', 'storage', 'laundry'];
  let n = 1; a.rooms = [];
  for (const lv of ['B', 'G', '1', '2']) for (const t of types) a.rooms.push(R('r' + n++, t, lv, 'M'));
  a.nextRoomId = n; a.pairs = [];
  PC.plans.sync(s);
  for (const id of PC.levels.ids(s)) s.plans[id].approved = true;
  s.stage = 5;
  return s;
}
