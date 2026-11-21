// The seeded programme stream of the generator sweep (F3-T1): footprints as the site model produces them (up to
// 3:1, long <= 3 x short + 0.5 m, both directions) and room programmes that pass the F2-S3 area validation
// (fill 30-100 %). Shared by layout-sweep.test.mjs and the golden-layout fixture, so both see the same inputs.
export function programmes(C, count = 2400, maxTries = 20000) {
  let seed = 20261120; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = (a) => a[Math.floor(rnd() * a.length)], half = (x) => Math.round(x * 2) / 2;
  function footprint(stretched) {
    const short = half(4 + rnd() * 10);
    const ratio = stretched ? 2 + rnd() * 1 : 1 + rnd();               // 1:1-2:1, or 2:1-3:1
    let long = half(short * ratio);
    if (stretched) long = Math.min(long, Math.floor((3 * short + C.FOOTPRINT_STRETCH_EXTRA) * 2) / 2);
    return rnd() < 0.5 ? [short, long] : [long, short];
  }
  function programme(W, D) {
    const n = 1 + Math.floor(rnd() * 8), types = C.ROOM_TYPES, rooms = [];
    for (let i = 0; i < n; i++) { const t = pick(types); rooms.push({ id: 'r' + (i + 1), area: rnd() < 0.15 ? half(4 + rnd() * 40) : C.ROOM_SIZE[t][pick(C.SIZES)] }); }
    const pairs = [];
    for (let k = 0; k < Math.floor(rnd() * Math.min(6, n)); k++) { const a = pick(rooms).id, b = pick(rooms).id; if (a !== b && !pairs.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))) pairs.push([a, b]); }
    const stairs = rnd() < 0.8, lift = stairs && rnd() < 0.3;
    return { W, D, rooms, pairs, stairs, stairPos: pick(['centre', 'fl', 'fr', 'bl', 'br']), lift };
  }
  const out = []; let tries = 0;
  while (out.length < count && tries < maxTries) {
    tries++;
    const stretched = rnd() < 0.35, [W, D] = footprint(stretched), inp = programme(W, D);
    const need = inp.rooms.reduce((s, r) => s + r.area, 0) + (inp.stairs ? C.STAIR.area : 0) + (inp.lift ? C.LIFT.area : 0), fill = need / (W * D);
    if (fill < 0.3 || fill > 1) continue;                            // the area validation of F2-S3
    out.push({ inp, fill });
  }
  return out;
}

// CD-4 (F4-T2 Step 0): the 9- and 10-room stream, same footprint / area rules, its own seed. The stream above stays
// byte-identical so its golden hashes keep proving that no 1-8-room output changed.
export function programmes10(C, count = 300, maxTries = 20000) {
  let seed = 20261121; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = (a) => a[Math.floor(rnd() * a.length)], half = (x) => Math.round(x * 2) / 2;
  const out = []; let tries = 0;
  while (out.length < count && tries < maxTries) {
    tries++;
    const stretched = rnd() < 0.35, short = half(4 + rnd() * 10), ratio = stretched ? 2 + rnd() : 1 + rnd();
    let long = half(short * ratio);
    if (stretched) long = Math.min(long, Math.floor((3 * short + C.FOOTPRINT_STRETCH_EXTRA) * 2) / 2);
    const [W, D] = rnd() < 0.5 ? [short, long] : [long, short];
    const n = 9 + Math.floor(rnd() * 2), rooms = [];
    for (let i = 0; i < n; i++) { const t = pick(C.ROOM_TYPES); rooms.push({ id: 'r' + (i + 1), area: rnd() < 0.15 ? half(4 + rnd() * 40) : C.ROOM_SIZE[t][pick(C.SIZES)] }); }
    const pairs = [];
    for (let k = 0; k < Math.floor(rnd() * 7); k++) { const a = pick(rooms).id, b = pick(rooms).id; if (pairs.length < 6 && a !== b && !pairs.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))) pairs.push([a, b]); }
    const stairs = rnd() < 0.8, lift = stairs && rnd() < 0.3, inp = { W, D, rooms, pairs, stairs, stairPos: pick(['centre', 'fl', 'fr', 'bl', 'br']), lift };
    const need = rooms.reduce((s, r) => s + r.area, 0) + (stairs ? C.STAIR.area : 0) + (lift ? C.LIFT.area : 0), fill = need / (W * D);
    if (fill < 0.3 || fill > 1) continue;
    out.push({ inp, fill });
  }
  return out;
}

// CD-4 worst-case grid (TL Q1): 10 rooms + lift + 5 pairs, 7 footprints x 3 fills x 5 stair positions = 105 cases.
export function grid10() {
  const fr = [0.16, 0.13, 0.12, 0.11, 0.1, 0.1, 0.08, 0.08, 0.06, 0.06], out = [];
  const pairs = [['r1', 'r9'], ['r2', 'r10'], ['r3', 'r8'], ['r4', 'r7'], ['r5', 'r6']];
  for (const [W, D] of [[10, 15], [12, 16], [15, 10], [8, 20], [14, 14], [6, 18], [18, 6]]) {
    const area = W * D - 13;
    for (const fill of [0.6, 0.75, 0.85]) {
      const rooms = fr.map((f, i) => ({ id: 'r' + (i + 1), area: Math.max(4, Math.round(f * area * fill * 2) / 2) }));
      for (const pos of ['centre', 'fl', 'fr', 'bl', 'br']) out.push({ name: `${W}x${D}@${fill} ${pos}`, inp: { W, D, rooms, pairs, stairs: true, stairPos: pos, lift: true } });
    }
  }
  return out;
}
