// The fixed generator cases of layout.test.mjs and F3-T1 (sample levels, maximum levels, stretched footprints,
// pinned cases), as plain inputs, for the golden comparison.
export function fixedCases(PC) {
  const rooms = (areas) => areas.map((a, i) => ({ id: 'r' + (i + 1), area: a }));
  const base = { pairs: [], stairs: true, stairPos: 'centre', lift: false };
  const out = [], add = (name, inp) => out.push({ name, inp: JSON.parse(JSON.stringify({ ...base, ...inp })) });
  for (const id of ['G', '1']) add('sample ' + id, PC.plans.input(PC.sample.state(), id));
  const eight = rooms([24, 16, 16, 16, 9, 6, 6, 4]);
  for (const pos of ['centre', 'fl', 'fr', 'bl', 'br']) {
    add('max ' + pos, { W: 10, D: 15, rooms: eight, pairs: [['r1', 'r6']], stairPos: pos, lift: true });
    add('max3 ' + pos, { W: 10, D: 15, rooms: eight, pairs: [['r1', 'r6'], ['r2', 'r7'], ['r3', 'r8']], stairPos: pos, lift: true });
  }
  add('one room', { W: 9.5, D: 15, rooms: rooms([30]) });
  add('no stair', { W: 8, D: 12, rooms: rooms([30, 20, 16, 12]), stairs: false });
  add('wide', { W: 20, D: 10, rooms: rooms([30, 30, 20, 20, 16, 12, 9, 4]) });
  add('deep', { W: 8, D: 20, rooms: rooms([30, 24, 20, 16, 12, 9, 6]) });
  add('CTO low fill', { W: 8.5, D: 16.5, rooms: rooms([42, 36, 16, 4, 4]), stairs: false });
  const def = PC.store.defaults();
  for (const [W, D] of [[6, 18], [18, 6], [15, 5], [5, 15]]) {
    for (const id of ['G', '1']) add(`default ${id} ${W}x${D}`, { W, D, rooms: def.ans.rooms.filter((r) => r.level === id).map((r) => ({ id: r.id, area: PC.levels.roomArea(r) })) });
    const area = W * D - 10;
    add(`eight ${W}x${D}`, { W, D, rooms: rooms([0.2, 0.15, 0.15, 0.12, 0.1, 0.1, 0.08, 0.06].map((f) => Math.round(f * area * 0.8 * 2) / 2)) });
  }
  add('snap-check', { W: 9.5, D: 15.3, rooms: rooms([30, 24, 20, 14, 9, 6, 4]) });
  add('pinned snap reject', { W: 7, D: 16.5, rooms: rooms([16, 30, 9, 9, 14, 9]), pairs: [['r1', 'r6'], ['r2', 'r5']] });
  add('pinned order 2', { W: 6.5, D: 16.5, rooms: rooms([6, 16, 16, 9, 12]), pairs: [['r1', 'r5'], ['r2', 'r4']], stairPos: 'br' });
  add('80 m2 no layout', { W: 9.5, D: 15, rooms: rooms([80]) });
  return out;
}
