/* 3D look tables (Designer-owned, F3-T3; A-10). Every colour is sRGB '#RRGGBB' upper case; F4 converts each through
   PC.three.col (scene.background takes the raw hex). One mix rule for the whole app: per-channel lerp of the 0-255
   sRGB values, Math.round per channel.
   The hex values are the colours a horizontal face shows in sun at summer noon under the PC.data.sky rig (top-face
   light sum about 1.0): extra lights or higher intensities wash out the pastels.
   - exteriors (Q10): wall = exterior walls; wallInner = partitions and any walls around stair / lift; slab = slab
     edges and basement pit walls; roof = roof slab, gable, pergola; trim = entrance step, door reveal, gate posts;
     parapet = parapets and the stair head; F6-T1b (Designer A2 / Q-D3): frame = pane and door frames, door = the
     door leaf. siteColors.glassTop / glassBottom: the opaque glass gradient (head -> sill). wall / trim equal the stage-2 Q10 swatches (41-stage-questions.css).
   - interiors (Q18): furniture colour keys of PC.data.furniture; floorMix (0-0.3, the only number) mixes the style's
     wood into every room and hall floor: floor = mix(roomTints[type or 'hall'], wood, floorMix). Stair and lift are
     not mixed. fabric / wood / accent / metal / dark equal the stage-4 hint chips (43-stage-interior.css).
   - interiors[style].rooms[type] (F6-T2 I3, Designer plan 3): per-room fabric / accent over the style's (others fall
     back to the style); the Q18 chips keep showing the style base.
   - indoor (F6-T2 N2-N5, Designer plan 2): emissive hexes and factors (x sky indoor): glazing (lit windows), lift
     (night lift on furniture and floors), lamp (shades), pool (glow colour; poolK per instance group); litShare =
     the share of lit panes per opening kind, seeded per opening.
   - floors (F6-T2 I2, Designer plan 3, TL F1): the floor kind per room type (hall: planks), the kind hex per
     style, tint = the share of the room's roomTints hex mixed in (PM fallback: raise it); rugs: lift over the floor,
     living [share of room w, share of d, max w, max d] centred on the coffee table, bed [w, d] at each bed's foot,
     dining = the table plus diningPad per side; colour = mix(accent, fabric, accentMix) of the room palette.
   - roomTints: 3D floor tint per room type = the 2D tint of palette2d.room at the same CIELAB hue, L* 8 lower,
     chroma x 1.6 (the 2D pastels would wash out under the noon sun); hall by the same L* step (no extra chroma); stair / lift as in 2D.
   - siteColors: fixed site colours. ground is the build-time plot grass and equals sky.seasons.summer.ground;
     groundOuter (outside the plot) is never seasonal; gate is for a gate leaf (posts use exteriors.trim);
     highlight is the F5 selection colour (the 2D selection orange).
     F6-T1a: groundOuter is the meadow (Designer plan D3, meadow texture); asphalt is the street road; highlight and
     northMarker are drawn unlit and not tone-mapped (read as the hex); every other hex is retuned under ACES.
   - vegetation (F4-T3, Designer plan section 1): sizes in metres at instance scale 1 and segment counts. Tree = trunk
     cylinder (trunkR, Y 0 to trunkH) + canopy cone (canopyR, canopyH, base at canopyY0); shrub = cone (r, h, base at
     Y 0); per-instance uniform scale in [scale[0], scale[1]]. Colours are not here: trunk = siteColors.trunk, canopy and
     shrub = sky.seasons[s]. The scatter's tree clearance is canopyR x scale[1] (TL F4-T3 plan review).
     F6-T1b: taper, lean, lumps, tint and blob (Designer E1 / E2 / C5; Designer-owned values). */
(function (PC) {
  'use strict';
  PC.data.exteriors = {
    sand: { wall: '#D9C7A3', wallInner: '#F3EDE0', slab: '#A89F8E', roof: '#9C7E5E', trim: '#B89F78', parapet: '#B49A72', frame: '#5A5048', door: '#6B4A32', coping: '#E6DAC4' },
    white: { wall: '#F2F0EA', wallInner: '#F8F7F3', slab: '#B3B5B1', roof: '#7F878C', trim: '#C9CCC8', parapet: '#E3E0C9', frame: '#3A3F44', door: '#4E5A63', coping: '#F4F2EA' },
    terracotta: { wall: '#C4704F', wallInner: '#F4E9DE', slab: '#A3958A', roof: '#6E3A2A', trim: '#8F4A32', parapet: '#995744', frame: '#E8E2D6', door: '#4A3426', coping: '#D9CBB8' },
    grey: { wall: '#9BA1A6', wallInner: '#EEF0F0', slab: '#8D9398', roof: '#454B51', trim: '#5F676E', parapet: '#72787D', frame: '#1F2428', door: '#2E3439', coping: '#B9BEC1' }
  };
  PC.data.interiors = {
    modern: { fabric: '#3B4652', wood: '#4E3D33', accent: '#C8742F', white: '#F2F1EC', metal: '#8A9299', dark: '#23292F', floorMix: 0.10,
      rooms: { bedroom: { fabric: '#5C6B7A', accent: '#D9A441' }, majlis: { fabric: '#7A2E2E', accent: '#C9A54A' }, dining: { fabric: '#8A7E70' }, office: { fabric: '#2F3A44', accent: '#4F7A6A' } } },
    classic: { fabric: '#E3D3B5', wood: '#7A4A2E', accent: '#8E3B33', white: '#F7F1E6', metal: '#B08D45', dark: '#3A2A22', floorMix: 0.15,
      rooms: { bedroom: { fabric: '#CDB8A6', accent: '#6E4A6B' }, majlis: { fabric: '#8E3B33', accent: '#B08D45' }, dining: { fabric: '#A6845C' }, office: { fabric: '#4A3A2C', accent: '#2F4A3A' } } },
    minimal: { fabric: '#C9CDCF', wood: '#C8A878', accent: '#8FA698', white: '#FAFAF8', metal: '#AEB3B5', dark: '#6E7477', floorMix: 0.10,
      rooms: { bedroom: { fabric: '#DCD9D2', accent: '#8FA698' }, majlis: { fabric: '#B9A48A', accent: '#6F8A7A' }, dining: { fabric: '#E0DDD6' }, office: { fabric: '#9AA3A8', accent: '#C8A878' } } }
  };
  PC.data.indoor = {
    glazing: { hex: '#FFB866', k: 0.9 }, lift: { hex: '#FFB070', k: 0.08 }, lamp: { hex: '#FFD9A8', k: 1.4, color: '#F2EBDD', gate: 0.25 },
    pool: { hex: '#FFB870', lampK: 0.20, roomK: 0.14, spillK: 0.12, patchK: 0.35, lampD: 2.2, roomD: 0.6, spillW: 2.0, spillD: 1.4, patchOut: 0.01, patchPad: 0.1 },
    litShare: { glazed: 0.75, small: 0.4, slot: 1 }
  };
  PC.data.floors = {
    kind: { living: 'planks', dining: 'planks', bedroom: 'planks', office: 'planks', hall: 'planks', majlis: 'carpet',
      kitchen: 'tile', bathroom: 'tile', laundry: 'tile', storage: 'tile', maid: 'tile' },
    modern: { planks: '#8A6E55', tile: '#B9B7B2', carpet: '#6B5A4C' },
    classic: { planks: '#9A6A44', tile: '#D8CBB4', carpet: '#7A2F2C' },
    minimal: { planks: '#C9AE86', tile: '#E3E1DC', carpet: '#A89C88' },
    tint: 0.12,
    rug: { lift: 0.01, living: [0.55, 0.5, 2.4, 1.7], bed: [1.6, 1.0], diningPad: 0.6, accentMix: 0.5 }
  };
  PC.data.roomTints = {
    bedroom: '#B8CCE7', bathroom: '#A1D8D1', kitchen: '#E5D179', living: '#BFD7A0', dining: '#EBC097',
    majlis: '#D5BCE2', office: '#D1CD9D', maid: '#EABBC5', storage: '#CAC4B9', laundry: '#A8D2E9',
    hall: '#D9D6CE', stair: '#C5CBD0', lift: '#AEB7BB'
  };
  PC.data.siteColors = {
    ground: '#668748', groundOuter: '#6A8550', paving: '#C1B4A1', poolWater: '#398BB5', poolRim: '#F1E3C1',
    boundaryWall: '#B5A990', gate: '#3B4652', carCanopy: '#838D93', seating: '#7E664C', trunk: '#5B4636',
    northMarker: '#16212B', highlight: '#C2410C', asphalt: '#5D6063',
    glassTop: '#9FB6C6', glassBottom: '#34495A'
  };
  PC.data.vegetation = {
    tree: { trunkR: 0.12, trunkH: 2.6, canopyR: 1.35, canopyY0: 1.4, canopyH: 2.8, trunkSeg: 6, canopySeg: 8,
      // F6-T1b (Designer E1, Q-D2): trunk top radius x taper, lean +-leanDeg; canopy lumps [x, y, z, r] at unit scale
      // inside canopyR radially and between canopyY0 and canopyY0 + canopyH
      taper: 0.6, leanDeg: 4, lumps: [[0, 2.95, 0, 1.2], [0.45, 2.35, 0.15, 0.85], [-0.40, 2.45, -0.25, 0.80]] },
    shrub: { r: 0.7, h: 0.8, seg: 7,
      // F6-T1b (E2): two lumps [x, y, z, r] squashed to squashY (inside r, below h)
      squashY: 0.7, lumps: [[-0.15, 0.36, 0, 0.55], [0.2, 0.3, 0.1, 0.45]] },
    scale: [0.85, 1.15],
    // F6-T1b per-instance colour (E1 / E2): value factor range and a warm / cool tilt (+-tilt on R, -+ on B)
    tint: { tree: { value: [0.88, 1.08], tilt: 0.04 }, shrub: { value: [0.94, 1.06], tilt: 0.03 } },
    // F6-T1b blobs (C5): one opacity (one material), radius treeK x canopyR x s / shrubK x r x s, texture size px
    blob: { opacity: 0.26, treeK: 1.1, shrubK: 1.2, size: 64 }
  };
})(globalThis.PC = globalThis.PC || {});
