// F4-T3: PC.sky.compute (A-13; TL F4-T3 plan review item 2 and Q8; Designer plan section 2 golden table; F4-S3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';

const PC = loadCore(), SKY = plain(PC.data.sky), K = (h, s, n) => plain(PC.sky.compute(h, s, n || 0));
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const D = Math.PI / 180;
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / D;
const near = (a, b, e, m) => a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) <= e, `${m} [${i}] ${x} vs ${b[i]}`));

// Designer plan section 2: background, sunColor, sunI, hemiSky, hemiGround, hemiI at the four presets x four seasons.
const GOLD = `spring 8 #ABCDE6 #FEE5C3 0.567 #CDDFEE #878768 0.444
spring 12 #96C7EA #FEF7E8 0.7 #D8E7F4 #939671 0.48
spring 17.5 #E0AE87 #FEB679 0.5 #C4B2BB #736E53 0.39
spring 22 #0F1A29 #A0B4D9 0.15 #7285AE #303843 0.3
summer 8 #A6CAE6 #FFE4C1 0.567 #CADDEF #818263 0.444
summer 12 #8EC3EA #FFF7E8 0.7 #D6E6F5 #8B906B 0.48
summer 17.5 #DFAA81 #FFB273 0.5 #C1AEB8 #6E6A4E 0.39
summer 22 #0B1626 #9FB3D9 0.15 #7083AD #2F3741 0.3
autumn 8 #B0C9DB #FEE0BB 0.567 #CFDAE3 #887E64 0.444
autumn 12 #9EC3DC #FEF0DB 0.7 #DBE1E6 #958B6D 0.48
autumn 17.5 #E1AD82 #FEB476 0.5 #C7B0B4 #756650 0.39
autumn 22 #131C29 #A2B4D7 0.15 #7485AC #313642 0.3
winter 8 #ADCEE8 #F8E3C9 0.567 #CBDDEF #979083 0.444
winter 12 #9CC9EC #F6F2EA 0.7 #D5E5F4 #A7A193 0.48
winter 17.5 #DDB291 #F9B985 0.5 #C4B5C0 #81766B 0.39
winter 22 #141F2F #A1B5DA 0.15 #7487B0 #343A4A 0.3`.split('\n').map((l) => l.split(' '));

test('Designer golden table: 16 rows exact (key lerp rounded, then season blend rounded); intensities = the key lerp to 1e-9', () => {
  const keys = SKY.keys, lerp = (h, f) => { let i = 0; while (keys[i + 1].h < h) i++; const a = keys[i], b = keys[i + 1], t = (h - a.h) / (b.h - a.h); return a[f] + (b[f] - a[f]) * t; };
  for (const [s, h, bg, sun, sunI, sky, gnd, hemiI] of GOLD) {
    const L = K(+h, s), at = `${s} ${h}`;
    assert.deepEqual([L.background, L.sunColor, L.hemiSky, L.hemiGround], [bg, sun, sky, gnd], at);
    assert.ok(Math.abs(L.sunIntensity - lerp(+h, 'sunI')) < 1e-9 && Math.abs(L.hemiIntensity - lerp(+h, 'hemiI')) < 1e-9, at);
    assert.ok(Math.abs(L.sunIntensity - +sunI) < 5e-4 && Math.abs(L.hemiIntensity - +hemiI) < 5e-4, at + ' printed');
  }
});

test('F4-T1 continuity (TL Q8): compute(12, summer) equals the literal goldens of the former noonLook / noonSunDir', () => {
  const L = K(12, 'summer', 0);
  assert.deepEqual([L.sunColor, L.hemiSky, L.hemiGround, L.background], ['#FFF7E8', '#D6E6F5', '#8B906B', '#8EC3EA']);
  assert.deepEqual([L.sunIntensity, L.hemiIntensity, L.moon], [0.7, 0.48, false]);
  near(L.sunDir, [0, 0.9510565162951535, 0.30901699437494745], 1e-12, 'N 0');
  near(K(12, 'summer', 90).sunDir, [-0.30901699437494745, 0.9510565162951535, 0], 1e-12, 'N 90');
});

test('sun path: east at 6, highest at 12 at elevMax pointing away from north, west at 18; Y >= 0.15 and unit everywhere', () => {
  for (const s of SEASONS) {
    const E = SKY.seasons[s].elevMax;
    // north 0: n = -Z, east = +X, south = +Z
    const r = K(6, s).sunDir, n = K(12, s).sunDir, w = K(18, s).sunDir;
    assert.ok(r[0] > 0.98 && Math.abs(r[2]) < 1e-9, `${s} sunrise east`);
    assert.ok(w[0] < -0.98 && Math.abs(w[2]) < 1e-9, `${s} sunset west`);
    assert.ok(Math.abs(Math.asin(n[1]) / D - E) < 1e-9 && n[2] > 0 && Math.abs(n[0]) < 1e-12, `${s} noon elevation ${E}, towards the south (+Z)`);
    for (let h = 0; h <= 24; h += 0.25) {
      const d = K(h, s).sunDir;
      assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-12 && d[1] >= 0.15 - 1e-12, `${s} ${h}`);
      if (h > 6 && h < 18) assert.ok(d[1] <= Math.sin(E * D) + 1e-12, `${s} ${h} not above noon`);
    }
  }
});

test('direction continuous in 0.25 h steps (<= 20 degrees) except the documented sun / moon hand-over at the horizon', () => {
  for (const s of SEASONS) for (let h = 0; h < 24; h += 0.25) {
    const a = K(h, s), b = K(h + 0.25, s);
    if (a.moon !== b.moon) continue;
    assert.ok(ang(a.sunDir, b.sunDir) <= 20, `${s} ${h}: ${ang(a.sunDir, b.sunDir).toFixed(1)} degrees`);
  }
  assert.ok(K(22, 'summer').moon && !K(12, 'summer').moon && K(3, 'winter').moon);
});

test('north + 90 degrees rotates sunDir by 90 degrees about Y (1e-9), every hour and season (F4-S3)', () => {
  for (const s of SEASONS) for (let h = 0; h <= 24; h += 0.5) for (const N of [0, 37, 200]) {
    const a = K(h, s, N).sunDir, b = K(h, s, N + 90).sunDir;
    // clockwise seen from above in T: (x, z) -> (-z, x)
    near(b, [-a[2], a[1], a[0]], 1e-9, `${s} ${h} N ${N}`);
  }
});

test('intensities: noon > evening > night; night hemi >= 0.25 and sun <= a quarter of noon; winter night background stays dark', () => {
  for (const s of SEASONS) {
    const n = K(12, s), e = K(17.5, s), x = K(22, s);
    assert.ok(n.sunIntensity > e.sunIntensity && e.sunIntensity > x.sunIntensity, s);
    for (const h of [0, 2, 4.5, 21, 22, 24]) {
      const L = K(h, s);
      assert.ok(L.hemiIntensity >= 0.25 && L.sunIntensity <= n.sunIntensity / 4 + 1e-12, `${s} ${h}`);
    }
  }
  const key22 = SKY.keys.find((k) => k.h === 21).background;
  assert.equal(K(22, 'winter').background, PC.sky.mix(key22, SKY.seasons.winter.tint, SKY.seasons.winter.tintAmount * (0.15 / 0.7)));
  assert.notEqual(K(22, 'winter').background, PC.sky.mix(key22, SKY.seasons.winter.tint, SKY.seasons.winter.tintAmount), 'the day factor applies');
});

test('seasons: four distinct looks; winter hides canopies and takes the snow ground; autumn canopy differs from summer; presets and defaults', () => {
  const looks = SEASONS.map((s) => JSON.stringify(K(10, s)));
  assert.equal(new Set(looks).size, 4);
  for (const s of SEASONS) {
    const L = K(12, s), t = SKY.seasons[s];
    assert.deepEqual([L.canopyColor, L.canopyVisible, L.shrubColor, L.groundColor], [t.canopy, t.canopyVisible, t.shrub, t.ground]);
  }
  assert.equal(K(12, 'winter').canopyVisible, false);
  assert.notEqual(K(12, 'autumn').canopyColor, K(12, 'summer').canopyColor);
  assert.deepEqual(plain(PC.sky.PRESETS), { morning: 8, noon: 12, evening: 17.5, night: 22 });
  assert.deepEqual(plain(PC.sky.DEFAULT), { hour: 12, season: 'summer' });
  assert.deepEqual(K(0, 'summer').background, K(24, 'summer').background, '24 = 0');
  assert.equal(K(30, 'summer').hour, 24); assert.equal(K(-1, 'summer').hour, 0);
});

test('PC.sky.mix is the A-10 rule (round per channel, upper case)', () => {
  assert.equal(PC.sky.mix('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(PC.sky.mix('#0a0b0c', '#0A0B0C', 0.3), '#0A0B0C');
  assert.equal(PC.sky.mix('#102030', '#203040', 0), '#102030');
});

test('night: the light is the moon (-s.x, |s.y|, -s.z) of the A-13 path, then Y kept at 0.15 (horizontal part rescaled)', () => {
  for (const s of SEASONS) for (const N of [0, 90, 213]) for (const h of [0, 2, 4.5, 19.5, 21, 22, 23.75]) {
    const E = SKY.seasons[s].elevMax * D, n = [Math.sin(N * D), 0, -Math.cos(N * D)], e = [Math.cos(N * D), 0, Math.sin(N * D)], a = (h - 6) / 12 * Math.PI;
    const p = [0, 1, 2].map((i) => e[i] * Math.cos(a) + ((i === 1 ? Math.sin(E) : 0) - n[i] * Math.cos(E)) * Math.sin(a));
    assert.ok(p[1] < 0, 'below the horizon');
    let m = [-p[0], -p[1], -p[2]];
    if (m[1] < 0.15) { const k = Math.sqrt(1 - 0.0225) / Math.hypot(m[0], m[2]); m = [m[0] * k, 0.15, m[2] * k]; }
    const L = K(h, s, N);
    assert.equal(L.moon, true); near(L.sunDir, m, 1e-12, `${s} ${h} N ${N}`);
  }
});
