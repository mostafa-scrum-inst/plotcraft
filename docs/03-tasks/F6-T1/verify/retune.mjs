// F6-T1 Designer: the ACES retune calculator. Forward model of a Lambert face in r128 (non-physical lights):
//   linear out = albedo_lin x (sunI x sunCol_lin x max(0, n.l) + hemiI x mix(hemiGround, hemiSky, 0.5 n.y + 0.5)_lin)
// then r128's ACESFilmicToneMapping (exposure / 0.6, input matrix, RRT+ODT fit, output matrix, saturate) and the sRGB
// encode. Inverse: per-channel fixed-point on the albedo until the read equals the target (the matrices couple the
// channels, so it iterates). Shadowed faces drop the sun term. Prints, for each probe, the input hex that reads as the
// D-C1 target, and the forward read of the current table hex.
//   node docs/03-tasks/F6-T1/verify/retune.mjs [hour=12] [season=summer]
import { loadCore } from '../../../../tests/helpers/load.mjs';

const pos = process.argv.slice(2).filter((a) => !a.startsWith('{')), over = JSON.parse(process.argv.slice(2).find((a) => a.startsWith('{')) || '{}');
const hour = +(pos[0] || 12), season = pos[1] || 'summer';
// optional '{"sunI":0.95,"hemiI":0.43,"exposure":1.15}' overrides the looked-up values (what-if before editing sky.js)
const PC = loadCore(), L = PC.sky.compute(hour, season, 0), K = PC.sky.keyAt(PC.data.sky.keys, hour);
if (over.sunI != null) L.sunIntensity = over.sunI;
if (over.hemiI != null) L.hemiIntensity = over.hemiI;
if (over.hemiGround) L.hemiGround = PC.sky.mix(over.hemiGround, PC.data.sky.seasons[season].ground, PC.data.sky.groundBounce * Math.min(1, L.sunIntensity / PC.data.sky.keys.find((k) => k.h === 12).sunI));
if (over.hemiSky) L.hemiSky = over.hemiSky;
const exposure = over.exposure != null ? over.exposure : K.exposure != null ? K.exposure : (L.exposure != null ? L.exposure : 1);

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const l2s = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toHex = (v) => '#' + v.map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0').toUpperCase()).join('');
const lin = (h) => hex2(h).map(s2l);
// column-major mat3 as in the GLSL source, applied to a column vector
const IN = [[0.59719, 0.07600, 0.02840], [0.35458, 0.90834, 0.13383], [0.04823, 0.01566, 0.83777]];
const OUT = [[1.60475, -0.10208, -0.00327], [-0.53108, 1.10813, -0.07276], [-0.07367, -0.00605, 1.07602]];
const mul = (M, v) => [0, 1, 2].map((r) => M[0][r] * v[0] + M[1][r] * v[1] + M[2][r] * v[2]);
const fit = (v) => v.map((x) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.4329510) + 0.238081));
const aces = (c) => mul(OUT, fit(mul(IN, c.map((x) => x * exposure / 0.6)))).map((x) => Math.max(0, Math.min(1, x)));

function irradiance(n, shade) {
  const d = L.sunDir, nl = Math.max(0, n[0] * d[0] + n[1] * d[1] + n[2] * d[2]), w = 0.5 * n[1] + 0.5;
  const sun = lin(L.sunColor), sky = lin(L.hemiSky), gr = lin(L.hemiGround);
  return [0, 1, 2].map((i) => (shade ? 0 : L.sunIntensity * sun[i] * nl) + L.hemiIntensity * (gr[i] + (sky[i] - gr[i]) * w));
}
const read = (albedoHex, n, shade) => { const E = irradiance(n, shade), a = lin(albedoHex); return toHex(aces(a.map((x, i) => x * E[i])).map(l2s)); };
function solve(target, n, shade) {
  const E = irradiance(n, shade), t = hex2(target).map(s2l);
  let a = t.map((x, i) => x / Math.max(1e-4, E[i]));
  for (let k = 0; k < 200; k++) {
    const o = aces(a.map((x, i) => x * E[i]));
    a = a.map((x, i) => Math.max(0, Math.min(1, x * (t[i] + 1e-5) / (o[i] + 1e-5))));
  }
  return toHex(a.map(l2s));
}

const UP = [0, 1, 0], SOUTH = [0, 0, 1], EAST = [1, 0, 0];
const E = PC.data.exteriors, S = PC.data.siteColors, SE = PC.data.sky.seasons[season];
// probe: [label, current hex, normal, shaded, D-C1 target read]
const PROBES = [
  ['sand wall, sunlit side (+Z)', E.sand.wall, SOUTH, false, '#E2D3B4'],
  ['sand wall, shade side (+X)', E.sand.wall, EAST, true, '#A89C88'],
  ['white wall, sunlit side', E.white.wall, SOUTH, false, '#F1EFE9'],
  ['terracotta wall, sunlit side', E.terracotta.wall, SOUTH, false, '#C27353'],
  ['lawn (season ground)', SE.ground, UP, false, '#7FA455'],
  ['lawn in tree shadow', SE.ground, UP, true, '#4F6A3A'],
  ['paving', S.paving, UP, false, '#D3CCBE'],
  ['pool water', S.poolWater, UP, false, '#4FA9C8']
];
console.log(`look ${hour} h ${season}: exposure ${exposure}, sunI ${L.sunIntensity.toFixed(3)} hemiI ${L.hemiIntensity.toFixed(3)}, sunDir ${L.sunDir.map((x) => x.toFixed(3))}`);
for (const [label, cur, n, shade, target] of PROBES)
  console.log(`${label.padEnd(30)} table ${cur} reads ${read(cur, n, shade)} | target ${target} needs input ${solve(target, n, shade)}`);
export { read, solve, irradiance };
