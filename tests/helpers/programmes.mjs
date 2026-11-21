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
