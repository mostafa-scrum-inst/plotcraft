// F5-T3a O-1: prints the 16 preset rows of tests/unit/sky.test.mjs GOLD from PC.data.sky with the A-13 reference
// (the same key lerp + day-weighted season blend as tests/unit/data-tables.test.mjs `look`). Generated, never typed:
//   node docs/03-tasks/F5-T3/verify/golden.mjs            -> rows; --check compares with sky.test.mjs GOLD
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore, plain, ROOT } from '../../../../tests/helpers/load.mjs';
const SKY = plain(loadCore().data.sky);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const q = rgb(b); return '#' + rgb(a).map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0').toUpperCase()).join(''); };
const noon = SKY.keys.find((k) => k.h === 12), r3 = (x) => String(+x.toFixed(3));
function look(h, s) {
  const K = SKY.keys; let i = 0; while (K[i + 1].h < h) i++;
  const a = K[i], b = K[i + 1], t = (h - a.h) / (b.h - a.h), k = {};
  for (const n of Object.keys(a)) k[n] = typeof a[n] === 'string' ? mix(a[n], b[n], t) : a[n] + (b[n] - a[n]) * t;
  const S = SKY.seasons[s], day = Math.min(1, k.sunI / noon.sunI), w = S.tintAmount * day;
  return [mix(k.background, S.tint, w), mix(k.sunColor, S.tint, w), r3(k.sunI), mix(k.hemiSky, S.tint, w), mix(k.hemiGround, S.ground, SKY.groundBounce * day), r3(k.hemiI)];
}
const rows = [];
for (const s of ['spring', 'summer', 'autumn', 'winter']) for (const h of [8, 12, 17.5, 22]) rows.push([s, h, ...look(h, s)].join(' '));
if (process.argv.includes('--check')) {
  const src = readFileSync(join(ROOT, 'tests/unit/sky.test.mjs'), 'utf8'), gold = /const GOLD = `([^`]*)`/.exec(src)[1].split('\n');
  const diff = rows.filter((r, i) => r !== gold[i]);
  console.log(diff.length ? `${diff.length} row(s) differ:\n` + rows.map((r, i) => (r !== gold[i] ? `- ${gold[i]}\n+ ${r}` : null)).filter(Boolean).join('\n') : 'sky.test GOLD = generated rows');
  process.exit(diff.length ? 1 : 0);
}
console.log(rows.join('\n'));
