/* PC.sky: the time-of-day and season model (A-13, F4-T3). Pure: hex strings and numbers only (core layer).
   - mix(a, b, k): the one colour mix of the app (A-10): per-channel lerp of the 0-255 sRGB values, Math.round per
     channel, upper-case '#RRGGBB'. PC.three.mixHex is an alias.
   - compute(hour, season, northDeg, tables): sun path a = (hour - 6) / 12 x PI, s = e cos a + (y sin E - n cos E) sin a
     with n = (sin N, 0, -cos N) in frame T and e = n turned 90 degrees clockwise seen from above; at night (s.y < 0)
     the moon (-s.x, |s.y|, -s.z); the direction's Y kept at 0.15 or more (the horizontal part rescaled, still unit).
     Colours: the key-frame lerp with mix (rounded per channel), then the day-weighted season blend with mix again
     (rounded again; TL F4-T3 plan review item 2, the Designer's golden table): day = min(1, K.sunI / noon sunI);
     sunColor / hemiSky / background toward season.tint by tintAmount x day; hemiGround toward season.ground by
     groundBounce x day. Intensities are the key values. Vegetation and ground colours are the season's as they are.
     F6-T1a (additive): skyHorizon (= background), skyMid and skyZenith (the sky dome's 0 / 15 / 90 degree rows, each
     key lerp then the same season blend as background) and exposure (the key lerp; renderer.toneMappingExposure). */
(function (PC) {
  'use strict';
  var D = Math.PI / 180, MIN_Y = 0.15;
  var COLS = ['background', 'sunColor', 'hemiSky', 'hemiGround', 'skyMid', 'skyZenith'];

  function hex2(n) { var s = n.toString(16).toUpperCase(); return s.length < 2 ? '0' + s : s; }
  function mix(a, b, k) {
    var out = '#';
    for (var i = 1; i < 7; i += 2) {
      var x = parseInt(a.slice(i, i + 2), 16), y = parseInt(b.slice(i, i + 2), 16);
      out += hex2(Math.round(x + (y - x) * k));
    }
    return out;
  }

  // Key-frame interpolation at hour h (0..24).
  function keyAt(keys, h) {
    var i = 0;
    while (i < keys.length - 2 && keys[i + 1].h < h) i++;
    var a = keys[i], b = keys[i + 1], t = (h - a.h) / (b.h - a.h), k = {};
    COLS.forEach(function (n) { k[n] = mix(a[n], b[n], t); });
    k.sunI = a.sunI + (b.sunI - a.sunI) * t;
    k.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
    k.exposure = a.exposure + (b.exposure - a.exposure) * t;
    return k;
  }

  // Unit light direction in T (from the scene towards the light) and whether it is the moon.
  function sunDir(hour, elevDeg, northDeg) {
    var a = (hour - 6) / 12 * Math.PI, E = elevDeg * D, N = northDeg * D;
    var n = [Math.sin(N), 0, -Math.cos(N)], e = [Math.cos(N), 0, Math.sin(N)];
    var ca = Math.cos(a), sa = Math.sin(a), s = [0, 0, 0];
    for (var i = 0; i < 3; i++) s[i] = e[i] * ca + ((i === 1 ? Math.sin(E) : 0) - n[i] * Math.cos(E)) * sa;
    var moon = s[1] < 0;
    if (moon) s = [-s[0], -s[1], -s[2]];
    if (s[1] < MIN_Y) {
      var hl = Math.hypot(s[0], s[2]), k = Math.sqrt(1 - MIN_Y * MIN_Y) / hl;
      s = [s[0] * k, MIN_Y, s[2] * k];
    }
    return { dir: s, moon: moon };
  }

  function compute(hour, season, northDeg, tables) {
    var T = tables || PC.data.sky, h = Math.min(24, Math.max(0, +hour || 0)), se = T.seasons[season] || T.seasons.summer;
    var noon = T.keys.filter(function (x) { return x.h === 12; })[0];
    var K = keyAt(T.keys, h), day = Math.min(1, K.sunI / noon.sunI), w = se.tintAmount * day, sd = sunDir(h, se.elevMax, northDeg || 0);
    return {
      hour: h, season: T.seasons[season] ? season : 'summer',
      sunDir: sd.dir, moon: sd.moon,
      sunColor: mix(K.sunColor, se.tint, w), sunIntensity: K.sunI,
      hemiSky: mix(K.hemiSky, se.tint, w), hemiGround: mix(K.hemiGround, se.ground, T.groundBounce * day), hemiIntensity: K.hemiI,
      background: mix(K.background, se.tint, w),
      skyHorizon: mix(K.background, se.tint, w), skyMid: mix(K.skyMid, se.tint, w), skyZenith: mix(K.skyZenith, se.tint, w), exposure: K.exposure,
      canopyColor: se.canopy, canopyVisible: se.canopyVisible, shrubColor: se.shrub, groundColor: se.ground
    };
  }

  PC.sky = { mix: mix, compute: compute, sunDir: sunDir, keyAt: keyAt, MIN_Y: MIN_Y };
  // Session defaults and presets (A-13; F4-S3).
  PC.sky.DEFAULT = { hour: 12, season: 'summer' };
  PC.sky.PRESETS = { morning: 8, noon: 12, evening: 17.5, night: 22 };
})(globalThis.PC = globalThis.PC || {});
