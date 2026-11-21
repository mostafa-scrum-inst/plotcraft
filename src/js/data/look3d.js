/* 3D look tables (Designer-owned, F3-T3; A-10). Every colour is sRGB '#RRGGBB' upper case; F4 converts each through
   PC.three.col (scene.background takes the raw hex). One mix rule for the whole app: per-channel lerp of the 0-255
   sRGB values, Math.round per channel.
   The hex values are the colours a horizontal face shows in sun at summer noon under the PC.data.sky rig (top-face
   light sum about 1.0): extra lights or higher intensities wash out the pastels.
   - exteriors (Q10): wall = exterior walls; wallInner = partitions and any walls around stair / lift; slab = slab
     edges and basement pit walls; roof = roof slab, gable, pergola; trim = entrance step, door reveal, gate posts;
     parapet = parapets and the stair head. wall / trim equal the stage-2 Q10 swatches (41-stage-questions.css).
   - interiors (Q18): furniture colour keys of PC.data.furniture; floorMix (0-0.3, the only number) mixes the style's
     wood into every room and hall floor: floor = mix(roomTints[type or 'hall'], wood, floorMix). Stair and lift are
     not mixed. fabric / wood / accent / metal / dark equal the stage-4 hint chips (43-stage-interior.css).
   - roomTints: 3D floor tint per room type = the 2D tint of palette2d.room at the same CIELAB hue, L* 8 lower,
     chroma x 1.6 (the 2D pastels would wash out under the noon sun); hall by the same L* step (no extra chroma); stair / lift as in 2D.
   - siteColors: fixed site colours. ground is the build-time plot grass and equals sky.seasons.summer.ground;
     groundOuter (outside the plot) is never seasonal; gate is for a gate leaf (posts use exteriors.trim);
     highlight is the F5 selection colour (the 2D selection orange).
   - vegetation (F4-T3, Designer plan section 1): sizes in metres at instance scale 1 and segment counts. Tree = trunk
     cylinder (trunkR, Y 0 to trunkH) + canopy cone (canopyR, canopyH, base at canopyY0); shrub = cone (r, h, base at
     Y 0); per-instance uniform scale in [scale[0], scale[1]]. Colours are not here: trunk = siteColors.trunk, canopy and
     shrub = sky.seasons[s]. The scatter's tree clearance is canopyR x scale[1] (TL F4-T3 plan review). */
(function (PC) {
  'use strict';
  PC.data.exteriors = {
    sand: { wall: '#D9C7A3', wallInner: '#F3EDE0', slab: '#A89F8E', roof: '#9C7E5E', trim: '#B89F78', parapet: '#CDB993' },
    white: { wall: '#F2F0EA', wallInner: '#F8F7F3', slab: '#B3B5B1', roof: '#7F878C', trim: '#C9CCC8', parapet: '#E2E0D9' },
    terracotta: { wall: '#C4704F', wallInner: '#F4E9DE', slab: '#A3958A', roof: '#6E3A2A', trim: '#8F4A32', parapet: '#B9654A' },
    grey: { wall: '#9BA1A6', wallInner: '#EEF0F0', slab: '#8D9398', roof: '#454B51', trim: '#5F676E', parapet: '#8C9298' }
  };
  PC.data.interiors = {
    modern: { fabric: '#3B4652', wood: '#4E3D33', accent: '#C8742F', white: '#F2F1EC', metal: '#8A9299', dark: '#23292F', floorMix: 0.10 },
    classic: { fabric: '#E3D3B5', wood: '#7A4A2E', accent: '#8E3B33', white: '#F7F1E6', metal: '#B08D45', dark: '#3A2A22', floorMix: 0.15 },
    minimal: { fabric: '#C9CDCF', wood: '#C8A878', accent: '#8FA698', white: '#FAFAF8', metal: '#AEB3B5', dark: '#6E7477', floorMix: 0.10 }
  };
  PC.data.roomTints = {
    bedroom: '#B8CCE7', bathroom: '#A1D8D1', kitchen: '#E5D179', living: '#BFD7A0', dining: '#EBC097',
    majlis: '#D5BCE2', office: '#D1CD9D', maid: '#EABBC5', storage: '#CAC4B9', laundry: '#A8D2E9',
    hall: '#D9D6CE', stair: '#C5CBD0', lift: '#AEB7BB'
  };
  PC.data.siteColors = {
    ground: '#7FAE55', groundOuter: '#B3B0A6', paving: '#CFC8BA', poolWater: '#3FA7C9', poolRim: '#E6E1D6',
    boundaryWall: '#CDC4B2', gate: '#3B4652', carCanopy: '#A3ABB1', seating: '#9A7A55', trunk: '#5B4636',
    northMarker: '#16212B', highlight: '#C2410C'
  };
  PC.data.vegetation = {
    tree: { trunkR: 0.12, trunkH: 2.6, canopyR: 1.35, canopyY0: 1.4, canopyH: 2.8, trunkSeg: 6, canopySeg: 8 },
    shrub: { r: 0.7, h: 0.8, seg: 7 },
    scale: [0.85, 1.15]
  };
})(globalThis.PC = globalThis.PC || {});
