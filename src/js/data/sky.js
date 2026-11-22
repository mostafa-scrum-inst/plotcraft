/* Sky and season tables (Designer-owned, F3-T3; A-13), read by PC.sky.compute (F4-T3).
   keys: hour key-frames, h strictly increasing from 0 to 24, the last equal to the first. Colours sRGB '#RRGGBB';
   sunI / hemiI are light intensities. Night keys (h < 5 or h > 20): hemiI >= 0.25 so the model stays visible, sunI
   (the moon) at most a quarter of noon. With this rig a sunlit horizontal face gets a light sum of about 1.0 at
   noon, 0.5 in the morning, 0.25 in the evening and 0.12 at night. The 17 / 18 h keys carry more direct and less sky
   light (F5-T3a, QA O-1) so the low evening sun still casts readable shadows on the grass.
   seasons: elevMax = noon sun elevation in degrees; tint / tintAmount blend sunColor, hemiSky and background toward
   the season, weighted by daylight (A-13); canopy / shrub / ground are vegetation and plot-ground colours; winter has
   bare trees (canopyVisible false) with snow on shrubs and ground. Summer (tintAmount 0) is the untinted baseline.
   groundBounce: weight of the season ground in hemiGround at full daylight (snow bounce).
   F6-T1a: background is also the sky dome's horizon row and the fog colour (raw, not tone-mapped: they read as the
   hex); skyMid / skyZenith are the dome's 15 / 90 degree rows (read values too); exposure = toneMappingExposure (ACES).
   The skyMid / skyZenith / exposure values are the Designer plan D1 / C1 table (6 h and 16 h interpolated by FS);
   the Designer retunes them with background under ACES. */
(function (PC) {
  'use strict';
  PC.data.sky = {
    keys: [
      { h: 0, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30, skyMid: '#0F1A2E', skyZenith: '#060B16', exposure: 1.3 },
      { h: 4.5, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30, skyMid: '#0F1A2E', skyZenith: '#060B16', exposure: 1.3 },
      { h: 6, background: '#E8B08A', sunColor: '#FFB27A', sunI: 0.30, hemiSky: '#B6A6C8', hemiGround: '#5A5046', hemiI: 0.36, skyMid: '#C9B9C8', skyZenith: '#5F7FAF', exposure: 1.2 },
      { h: 7.5, background: '#A9CBE6', sunColor: '#FFE2BC', sunI: 0.55, hemiSky: '#C9DCEE', hemiGround: '#7F7564', hemiI: 0.44, skyMid: '#BBD3EA', skyZenith: '#7BA6D6', exposure: 1.1 },
      { h: 12, background: '#8EC3EA', sunColor: '#FFF7E8', sunI: 0.70, hemiSky: '#D6E6F5', hemiGround: '#8F8672', hemiI: 0.48, skyMid: '#A9CDEB', skyZenith: '#5E97D1', exposure: 1.15 },
      { h: 16, background: '#9CC5E4', sunColor: '#FFEBCF', sunI: 0.65, hemiSky: '#D2E0EE', hemiGround: '#8A7F69', hemiI: 0.46, skyMid: '#B3CBE0', skyZenith: '#6390C8', exposure: 1.15 },
      { h: 17, background: '#D8B994', sunColor: '#FFC98A', sunI: 0.75, hemiSky: '#D9C7B8', hemiGround: '#7F6F5C', hemiI: 0.34, skyMid: '#C6C4CF', skyZenith: '#6F86B8', exposure: 1.2 },
      { h: 18, background: '#E59A6E', sunColor: '#FF9A5C', sunI: 0.55, hemiSky: '#A894B8', hemiGround: '#54463E', hemiI: 0.30, skyMid: '#C792A0', skyZenith: '#4E5F95', exposure: 1.2 },
      { h: 19.5, background: '#2C3556', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#6E7BA6', hemiGround: '#2A2A38', hemiI: 0.32, skyMid: '#2E3658', skyZenith: '#151C38', exposure: 1.25 },
      { h: 21, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30, skyMid: '#0F1A2E', skyZenith: '#060B16', exposure: 1.3 },
      { h: 24, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30, skyMid: '#0F1A2E', skyZenith: '#060B16', exposure: 1.3 }
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
