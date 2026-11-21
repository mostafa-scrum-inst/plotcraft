/* Sky and season tables (Designer-owned, F3-T3; A-13), read by PC.sky.compute (F4-T3).
   keys: hour key-frames, h strictly increasing from 0 to 24, the last equal to the first. Colours sRGB '#RRGGBB';
   sunI / hemiI are light intensities. Night keys (h < 5 or h > 20): hemiI >= 0.25 so the model stays visible, sunI
   (the moon) at most a quarter of noon. With this rig a sunlit horizontal face gets a light sum of about 1.0 at
   noon, 0.5 in the morning, 0.25 in the evening and 0.12 at night.
   seasons: elevMax = noon sun elevation in degrees; tint / tintAmount blend sunColor, hemiSky and background toward
   the season, weighted by daylight (A-13); canopy / shrub / ground are vegetation and plot-ground colours; winter has
   bare trees (canopyVisible false) with snow on shrubs and ground. Summer (tintAmount 0) is the untinted baseline.
   groundBounce: weight of the season ground in hemiGround at full daylight (snow bounce). */
(function (PC) {
  'use strict';
  PC.data.sky = {
    keys: [
      { h: 0, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30 },
      { h: 4.5, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30 },
      { h: 6, background: '#E8B08A', sunColor: '#FFB27A', sunI: 0.30, hemiSky: '#B6A6C8', hemiGround: '#5A5046', hemiI: 0.36 },
      { h: 7.5, background: '#A9CBE6', sunColor: '#FFE2BC', sunI: 0.55, hemiSky: '#C9DCEE', hemiGround: '#7F7564', hemiI: 0.44 },
      { h: 12, background: '#8EC3EA', sunColor: '#FFF7E8', sunI: 0.70, hemiSky: '#D6E6F5', hemiGround: '#8F8672', hemiI: 0.48 },
      { h: 16, background: '#9CC5E4', sunColor: '#FFEBCF', sunI: 0.65, hemiSky: '#D2E0EE', hemiGround: '#8A7F69', hemiI: 0.46 },
      { h: 17, background: '#D8B994', sunColor: '#FFC98A', sunI: 0.60, hemiSky: '#D9C7B8', hemiGround: '#7F6F5C', hemiI: 0.42 },
      { h: 18, background: '#E59A6E', sunColor: '#FF9A5C', sunI: 0.40, hemiSky: '#A894B8', hemiGround: '#54463E', hemiI: 0.36 },
      { h: 19.5, background: '#2C3556', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#6E7BA6', hemiGround: '#2A2A38', hemiI: 0.32 },
      { h: 21, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30 },
      { h: 24, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30 }
    ],
    seasons: {
      spring: { elevMax: 52, tint: '#F1F7E4', tintAmount: 0.08, canopy: '#6AA442', canopyVisible: true, shrub: '#8CBF5A', ground: '#9DC46F' },
      summer: { elevMax: 72, tint: '#FFF4DE', tintAmount: 0, canopy: '#4E8A3A', canopyVisible: true, shrub: '#5E9441', ground: '#7FAE55' },
      autumn: { elevMax: 52, tint: '#F6C58E', tintAmount: 0.15, canopy: '#C8702A', canopyVisible: true, shrub: '#A8692F', ground: '#A59B5C' },
      winter: { elevMax: 32, tint: '#D3E0F2', tintAmount: 0.20, canopy: '#6F6A5C', canopyVisible: false, shrub: '#DCE4EA', ground: '#EDF1F4' }
    },
    groundBounce: 0.25
  };
})(globalThis.PC = globalThis.PC || {});
