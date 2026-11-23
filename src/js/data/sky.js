/* Sky and season tables (Designer-owned, F3-T3; A-13), read by PC.sky.compute (F4-T3).
   keys: hour key-frames, h strictly increasing from 0 to 24, the last equal to the first. Colours sRGB '#RRGGBB';
   sunI / hemiI are light intensities. Night keys (h < 5 or h > 20): hemiI >= 0.25 so the model stays visible, sunI
   (the moon) at most a quarter of noon. With this rig a sunlit horizontal face gets a light sum of about 1.0 at
   noon, 0.5 in the morning, 0.25 in the evening and 0.12 at night. The 17 / 18 h keys carry more direct and less sky
   light (F5-T3a, QA O-1) so the low evening sun still casts readable shadows on the grass.
   seasons: elevMax = noon sun elevation in degrees; tint / tintAmount blend sunColor, hemiSky and background toward
   the season, weighted by daylight (A-13); canopy / shrub / ground are vegetation and plot-ground colours; winter has
   bare trees (canopyVisible false) with snow on shrubs and ground. Summer (tintAmount 0) is the untinted baseline.
   F6-T1b: meadow = the outer ground (groundOuter) colour per season (Designer; summer = siteColors.groundOuter,
   winter trampled snow).
   groundBounce: weight of the season ground in hemiGround at full daylight (snow bounce).
   F6-T1a: background is also the sky dome's horizon row and the fog colour (raw, not tone-mapped: they read as the
   hex); F6-T2 N1: indoor = how much indoor light is on (0-1, blended like the rest; Designer plan 2): every emissive
   term (lit glazing, night lift, lamps, glow pools) scales with it, glow is hidden at 0; skyMid / skyZenith are the dome's 15 / 90 degree rows (read values too); exposure = toneMappingExposure (ACES).
   The skyMid / skyZenith / exposure values are the Designer plan D1 / C1 table (6 h and 16 h interpolated by FS);
   the Designer retunes them with background under ACES.
   F6-T1a retune (Designer, verify/retune.mjs): day keys carry about 1.2x the old sun with a light, warm hemiGround (a
   sunlit sandy bounce instead of the dark olive one), so vertical walls are lit from below and the shade side reads
   warm, not olive; exposure 1.1 by day. Canopy / shrub / ground hexes are solved so each reads under ACES and the new
   noon rig what the old one read (summer lawn reads #7FA455, Designer plan C1); noon and 16 h horizons are hazier. */
(function (PC) {
  'use strict';
  PC.data.sky = {
    keys: [
      { h: 0, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30, skyMid: '#0F1A2E', skyZenith: '#060B16', exposure: 1.3, indoor: 0.6 },
      { h: 4.5, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30, skyMid: '#0F1A2E', skyZenith: '#060B16', exposure: 1.3, indoor: 0.3 },
      { h: 6, background: '#E8B08A', sunColor: '#FFB27A', sunI: 0.36, hemiSky: '#B6A6C8', hemiGround: '#8A7A66', hemiI: 0.36, skyMid: '#C9B9C8', skyZenith: '#5F7FAF', exposure: 1.15, indoor: 0.2 },
      { h: 7.5, background: '#A9CBE6', sunColor: '#FFE2BC', sunI: 0.67, hemiSky: '#C9DCEE', hemiGround: '#B3A890', hemiI: 0.44, skyMid: '#BBD3EA', skyZenith: '#7BA6D6', exposure: 1.1, indoor: 0 },
      { h: 12, background: '#B9D6EE', sunColor: '#FFF7E8', sunI: 1.0, hemiSky: '#D6E6F5', hemiGround: '#C9BFA6', hemiI: 0.40, skyMid: '#A9CDEB', skyZenith: '#5E97D1', exposure: 1.05, indoor: 0 },
      { h: 16, background: '#BED6EA', sunColor: '#FFEBCF', sunI: 0.93, hemiSky: '#D2E0EE', hemiGround: '#C2B79C', hemiI: 0.40, skyMid: '#B3CBE0', skyZenith: '#6390C8', exposure: 1.05, indoor: 0 },
      { h: 17, background: '#D8B994', sunColor: '#FFC98A', sunI: 0.99, hemiSky: '#D0D4DC', hemiGround: '#AEB08E', hemiI: 0.44, skyMid: '#C6C4CF', skyZenith: '#6F86B8', exposure: 1.5, indoor: 0 },
      { h: 18, background: '#E59A6E', sunColor: '#FF9A5C', sunI: 0.89, hemiSky: '#BCC4DA', hemiGround: '#A2A684', hemiI: 0.40, skyMid: '#C792A0', skyZenith: '#4E5F95', exposure: 1.65, indoor: 0.35 },
      { h: 19.5, background: '#2C3556', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#6E7BA6', hemiGround: '#2A2A38', hemiI: 0.32, skyMid: '#2E3658', skyZenith: '#151C38', exposure: 1.25, indoor: 1 },
      { h: 21, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30, skyMid: '#0F1A2E', skyZenith: '#060B16', exposure: 1.3, indoor: 1 },
      { h: 24, background: '#0B1626', sunColor: '#9FB3D9', sunI: 0.15, hemiSky: '#7083AD', hemiGround: '#2A3040', hemiI: 0.30, skyMid: '#0F1A2E', skyZenith: '#060B16', exposure: 1.3, indoor: 0.6 }
    ],
    seasons: {
      spring: { elevMax: 52, tint: '#F1F7E4', tintAmount: 0.08, canopy: '#558739', canopyVisible: true, shrub: '#67A344', ground: '#76A953', meadow: '#6F8A58' },
      summer: { elevMax: 72, tint: '#FFF4DE', tintAmount: 0, canopy: '#477338', canopyVisible: true, shrub: '#507A3C', ground: '#668748', meadow: '#6A8550' },
      autumn: { elevMax: 52, tint: '#F6C58E', tintAmount: 0.15, canopy: '#A85D27', canopyVisible: true, shrub: '#8A5A2F', ground: '#877F4D', meadow: '#857D55' },
      winter: { elevMax: 32, tint: '#D3E0F2', tintAmount: 0.20, canopy: '#5F5C53', canopyVisible: false, shrub: '#CDEDFE', ground: '#FFFFFF', meadow: '#E4E8EA' }
    },
    groundBounce: 0.25
  };
})(globalThis.PC = globalThis.PC || {});
