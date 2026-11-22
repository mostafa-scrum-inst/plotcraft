# F6-T1 realism pass: Designer plan (CD-8)

Date: 2026-11-22. Author: Designer. Aligned with `cto-constraints.md` (0d2cef1); each rule cited as C-x.y.
Before shots: `before/` (16 PNGs, real r128 from tests/vendor, SwiftShader), made by `verify/shots.mjs`:
sample + G6 maximum house × noon / evening (17.5 h, summer) × 1280x800 / 360x640 × panel open / closed, Reset view.

## 1. What the before shots show (why it reads "far from realistic")

Ranked by how much each costs the picture, measured on the shots.

1. **It is a dollhouse, not a house.**
   - Exterior walls are 1.2 m (`HOUSE.wallH`), cut away to show the plan. The roof is off by default.
   - There are no windows, door or eaves, so every view is a plan model from above. Nothing reads as a building.
2. **There is no sky and no world.**
   - At the Reset pose the frame is about 55 % `groundOuter` (`#B3B0A6`, a flat grey-beige square, 36 R wide). The sky (`#8EC3EA` at noon) is never in view.
   - In the evening the whole surround turns flat brown (`#62504A`-ish), and there is no horizon or haze.
3. **The lighting is flat.**
   - Lambert, no tone mapping, and every face of a kind is one colour.
   - Nothing grounds the objects: no contact darkening where walls meet the ground or slab, or under trees.
   - Shadows exist (PCFSoft 1024) but are faint at noon.
4. **The materials are plain fills.** Grass, paving, walls, roof and the car canopy are uniform fills with no grain, joints or tiles, which gives a plastic toy look at every zoom.
5. **The vegetation is "lollipop" cones.**
   - Every tree is one 8-sided cone on a 6-sided straight trunk, all in the same green. Shrubs are single cones.
   - Repetition and identical colour are what make it read as synthetic.
6. **The pool is a flat blue rectangle.** There is no rim depth, specular or depth tint.

Baseline numbers, measured on real r128 at 1280x800 at the Reset pose, for one frame including the shadow pass:

| House | Roof | Draw calls | Triangles | Meshes |
|---|---|---|---|---|
| Sample | off | 24 | 6 391 | 15 |
| Sample | on | 26 | 6 703 | 15 |
| Max house | off | 36 | 15 254 | 21 |
| Max house | on | 38 | 15 662 | 21 |

The limits are 160 calls and 300 000 triangles (C-4.2, C-4.3), so there is a lot of room.

## 2. Principles of the target look

- **Daylight architectural render, not photoreal.** The aim is a soft-shadowed, slightly warm daylight model: matte plaster, readable materials at 1–3 m scale, a hazy horizon. It is not a game look. No bloom and no saturation boost.
- **Colour stays in the look tables (C-3.3).**
  - Textures are neutral greyscale detail (value ±6–12 %), multiplied by `material.color` or vertex colour.
  - Q10, Q18 and the seasons stay colour changes, and `applyLook` never swaps a texture.
- **Targets are written as read-back pixels**, since ACES (C-2) shifts every input hex.
  - "Reads" below means the sRGB value in a real-r128 noon shot (summer 12 h, sunlit horizontal face unless stated), ±6 per channel.
  - The input hexes in `look3d.js` / `sky.js` are then retuned until the shots hit the targets. `verify/shots.mjs` gains a probe list for this.
- **Two tiers (C-4.7).**
  - `full`: desktop and, until CD-7 says otherwise, phones too.
  - `lite`: Lambert, textures at 256 or none, no normal or roughness maps, no fog, shadow map 1024, maxDpr 1.5.
  - Every item below is marked **F** (full only) or **F+L** (both tiers).

## 3. Items by area

Each item gives its look, its cost (meshes / draw calls / triangles / texture memory / dist bytes), its phone risk and its tier. Impact is estimated as how much of the before-shot "unrealism" it removes.

### A. Building: exterior mode, openings and detail (largest impact)

#### A1. Exterior mode: full-height walls while Roof is on (F+L)

- **Look and behaviour:**
  - Each level's exterior wall goes from 1.2 m to the storey height (`ceilingH` + slab, so about 3.2 m) whenever the roof group is visible (Roof on and All).
  - Otherwise the cutaway stays as today: a level picked, a finder pick, the tour (which turns the Roof off) and Basement.
  - Partitions stay at 1.2 m, since they are invisible behind full walls anyway.
- **Build:** the upper band (1.2 m → storey top) is one new mesh per level, `walls-upper` in `level-<id>`, with its visibility tied to the roof group's. Toggling needs no rebuild and creates no GPU objects in `applyLook` or the toggle (C-5.3).
- **Cost:** +1 mesh per level (max house +4). About +12 triangles per wall run plus the openings (A2). Max house about +3 000 triangles.
- **Phone risk:** none (same material, few triangles).
- **Product ruling needed (TL / PM, not CTO):** open stage 5 with **Roof on** (exterior first, "this is your house"), instead of today's roof off.
  - This is a stage-5 UI default (`ui/stage-3d.js` line 93 and its callers). The tests that assert "opens on All with the roof off" (view3d.spec, QA f4-t2) would change their expectation, not their check.
  - Without this ruling, A1–A4 show only after a tap on Roof. The client's first impression would stay the dollhouse.
  - **I recommend the change. It is the single largest jump, and it costs no GPU.**

#### A2. Windows and the front door as openings with frames and glass (F+L)

- **Placement rule (new pure function, additive house fields `openings`, C-1.5 / C-6.1):** for each exterior wall run of a room on the ground and upper levels, by room type:

  | Room types | Window | Count and spacing |
  |---|---|---|
  | Habitable: living, dining, majlis, bedroom, office, kitchen | 1.2 m wide, sill 0.9 m, head 2.3 m | n = max(1, floor((run − 0.6) / 2.6)), evenly spaced, at least 0.6 m from a corner or partition |
  | Service: bathroom, laundry, maid, storage | 0.6 × 0.6 m, sill 1.6 m | 1 per run longer than 1.2 m |

  - Basement: none.
  - Stair core walls: one 0.6 × 1.6 m slot.
  - Front door: the existing entrance gap (1.2 m) gets a 1.0 × 2.2 m door leaf and frame. The gap is widened to the full height when A1 is on.
  - Runs shorter than the window + 1.2 m get no window. That is deterministic and testable, and fits the layout golden (C-6.5) because it is only a derived field.
- **Wall build:** the wall run is split around openings into boxes (below sill, above head, piers), all in the existing wall batch.
- **Frame:** 0.06 m profile, 0.05 m proud of the wall face, in a new exterior key `frame`:

  | Q10 exterior | frame | Reads |
  |---|---|---|
  | sand | `#5A5048` | about `#4E453E` |
  | white | `#3A3F44` | about `#30353A` |
  | terracotta | `#E8E2D6` | about `#DCD5C8` |
  | grey | `#1F2428` | about `#1C2024` |

  - One mullion at mid-width for windows of 1.2 m or more.
  - Sill: 0.04 m thick, 0.08 m proud, in `exteriors.trim`.
- **Glass: opaque dark glass (C-2: transparency is kept for water and the blob shadows).**
  - Vertex-colour gradient from the head (`#9FB6C6`, the sky reflection, reads about `#8FA9BB` at noon) to the sill (`#34495A`). This is a fake reflection, with no extra material in lite.
  - In full: a separate `glazing` mesh per level (or one for all levels: see the cost line), MeshStandard roughness 0.08 / metalness 0. With no envMap the sun glint is the only highlight; it is visible in the evening.
  - **Visibility rule:** glass panes are split at 1.2 m. The lower part lives in the level's wall batch (always visible) and the upper part in `walls-upper`.
- **Cost:**
  - Boxes and quads: about 9 per window. The sample has about 22 windows, about 2 300 triangles; the max house about 90 windows, about 9 500 triangles.
  - Meshes: +0 in lite. In full, +1 `glazing` per level, so max house +4; or +1 in total if glazing ignores the level cutaway, which it cannot (C-6.2), so +4.
- **Phone risk:** low (triangles only).

#### A3. Roof detail (F+L)

- **Flat or terrace roof:**
  - Parapet gets a 0.05 m cap, 0.04 m proud on both sides, in `exteriors.trim` (reads one step lighter than the parapet).
  - The roof surface takes the `membrane` texture (B5).
  - A 0.6 m gravel strip inset along the parapet in a darker roof tone (`mix(roof, #000, 0.15)`).
- **Pitched roof:**
  - Eaves overhang 0.45 m on all sides, with a 0.12 m fascia in `trim`.
  - A ridge cap of 0.18 × 0.10 m.
  - Tile texture (B4).
  - Gable faces in the wall colour, not the roof colour (as today).
- **Usable roof:** a 1.0 m parapet (as today) with a 0.05 m metal top rail (`#6C7378`, metalness 0.4 in full).
- **Cost:** about +200 triangles; +0 meshes (roof batch).
- **Phone risk:** none.

#### A4. Wall base, slab edge and plinth (F+L)

- **Plinth:** 0.3 m high, 0.02 m proud on the ground floor, in `mix(wall, slab, 0.5)`.
- **Slab band:** the edge band between storeys reads 4 % darker than the wall, so the storey lines show.
- **Cost:** about +100 triangles; +0 meshes.

### B. Materials: procedural detail textures (C-3; generated by `core/texgen.js`)

All textures are greyscale, tile at real scale through world UVs (C-3.5), and are 256 in lite and 512 in full.

| # | Texture | Pixels (value ±) | Tile | Used on | Tier |
|---|---|---|---|---|---|
| B1 | grass | 2-octave value noise ±10 % + fine blades (1 px dashes) ±6 %, 3 hue-neutral clusters | 3 m (1024 allowed, but 512 is enough) | `groundPlot` | F+L (L: 256) |
| B2 | paving | 0.6 × 0.6 m slabs with 1 px joints at −28 %, per-slab ±5 %, speckle ±3 % | 2.4 m | paths, pool rim, parking pad | F+L |
| B3 | plaster | low-frequency noise ±4 % + fine grain ±2 % | 2 m | exterior walls, parapets | F |
| B4 | roof tiles | rows 0.30 m with a 2 px shadow line at −30 %, tiles 0.25 m with a staggered joint, per-tile ±6 % | 1.5 m | pitched roof | F+L |
| B5 | membrane | fine speckle ±5 %, faint 1 m sheet seams at −8 % | 2 m | flat roof | F |
| B6 | timber floor | 0.18 m boards, ±7 % per board, grain streaks ±3 % | 1.8 m | room floors (seen in cutaway) | F |
| B7 | water ripple | soft caustic cells ±8 % | 2 m | `poolWater` | F |
| B8 | outer meadow | very low-frequency patches ±8 % | 12 m | `groundOuter` | F+L |

- **Count:** 8 textures in full (limit 12) and 4 in lite (B1, B2, B4, B8).
- **Memory in full:** 8 × 512² × 4 × 4/3 ≈ 11.2 MB, under 16 MB. Lite: 4 × 256² ≈ 0.35 MB.
- **Normal maps:** none in the MVP. A grass or plaster normal map is a later option (counts against the limits; F only).
- **Generation:** the target is ≤ 60 ms in node for all 8 at 512 (C-3.2 allows 150). Code is about 6–8 KB.
- **Phone risk:** low with mipmaps and anisotropy ≤ 4. The 512 textures are the first thing lite drops.

#### Material switch

- **Full:** the house and site batches move to MeshStandardMaterial (roughness by material, metalness 0):

  | Material | Roughness |
  |---|---|
  | plaster | 0.9 |
  | paving | 0.85 |
  | roof tiles | 0.7 |
  | membrane | 0.8 |
  | timber | 0.6 |
  | water | 0.05 |
  | frames | 0.5 |
  | glass | 0.08 |

  Vegetation stays Lambert (C-2).
- **Lite:** Lambert everywhere, plus the opaque glass gradient.
- **Ranking for the TL with shots (C-2):** I will render both on tests/vendor r128 at noon and evening.
  - Standard gives per-pixel sun falloff on large faces and a real specular on water and glass.
  - Lambert's per-vertex lighting flattens large faces. In the MVP the texture detail partly covers that.
- **Batches split by material (C-3.5):** per level `walls` (plaster), `walls-upper`, `floors` (timber + tints, which stays the slab top today), `frames` (frames, sills, door; no texture), and `glazing` (F).
  - Max house: 4 × (5 − 2 existing) = +12.
  - Site adds `paving` (+1).

### C. Lighting and tone (F+L, except fog in lite)

- **C1. ACES filmic tone mapping (C-2).**
  - Exposure as a value per sky key (`exposure`): noon 1.15, morning 1.1, evening 1.2, night 1.3. It is applied by `applyLook` and interpolated by the A-13 key lerp.
  - Every hex is retuned so these target reads hold (summer, sunlit horizontal face):

    | Face | Reads |
    |---|---|
    | sand wall, sunlit side | `#E2D3B4` |
    | sand wall, shade side | `#A89C88` |
    | lawn | `#7FA455` |
    | lawn in tree shadow | `#4F6A3A` |
    | paving | `#D3CCBE` |
    | pool | `#4FA9C8` |
    | white wall, sunlit side | `#F1EFE9` (must not clip to `#FFF`) |
    | terracotta wall | `#C27353` |

  - `highlight` and the north marker use `toneMapped: false`, so the orange stays `#C2410C` (C-2).
- **C2. Sun / hemisphere balance.**
  - Noon `sunI : hemiI` goes from about 1.46 to about 2.2 (sun 0.95, hemi 0.43 before exposure; retuned under ACES).
  - Result: the shade side reads 45–50 % of the sunlit side, not about 70 % as today. That alone gives the model volume.
  - `hemiGround` takes the lawn colour at 30 % (green bounce on wall bottoms).
  - The 17 / 18 h keys keep the F5-T3a O-1 ratio; QA's metric must stay ≥ 15 000 px (C-6.5).
- **C3. Shadows.**
  - PCFSoft stays. Desktop 2048 / phone 1024 (C-4.5, values in `PC.C.VIEW3D`; CTO condition a holds because phones keep 1024).
  - `shadow.normalBias` gets re-checked under the new wall thickness; no acne is allowed in the shots.
  - Target: tree shadow on the lawn at noon reads 60–65 % of the lit lawn.
- **C4. Baked contact darkening (C-2: no SSAO).**
  - Vertex colours in the batches are darkened toward the base of every wall box: bottom 0.25 m at −18 %, fading to 0 at 0.6 m.
  - Floors: −10 % within 0.3 m of walls (a quad ring per room, in the floor batch).
  - Ground: a dark ring around the footprint, 0.8 m wide, −20 % → 0, as vertex colours on the `groundPlot` outline. This needs `groundPlot` with an inner ring of vertices (ShapeGeometry plus 1 ring).
  - **Cost:** about +4 triangles per wall box. Max house about +3 000 triangles; +0 meshes. Phone risk none.
- **C5. Blob shadows under trees and shrubs (F+L).**
  - One InstancedMesh `blobs` of horizontal quads at y 0.02, with a radial alpha texture generated by texgen (64², counts as 1 texture).
  - MeshBasic black, opacity 0.28 trees / 0.22 shrubs, `depthWrite: false`, fixed `renderOrder`.
  - Radius 1.1 × canopyR for trees and 1.2 × r for shrubs.
  - This is transparent mesh 2 of 2 (C-2), so **glazing stays opaque**.
  - **Cost:** +1 mesh, +1 draw call, 2 triangles per tree or shrub. Phone risk: low (overdraw on small quads).

### D. Sky, horizon and surroundings

- **D1. Sky dome (F+L, C-4.4).**
  - `sky`: SphereGeometry with radius 0.9 × camera far, 24 × 12 segments, MeshBasicMaterial with vertexColors, BackSide, `fog: false`, `depthWrite: false`, `castShadow: false`, `frustumCulled: false`. It is centred on the camera target each frame; that is a transform, not geometry, so it is allowed in flights.
  - Vertex colour is a 3-stop gradient by elevation: horizon (0°) → mid (15°) → zenith (90°), recoloured in `applyLook` by rewriting the colour attribute in place (no new GPU object, C-5.3).
  - New sky key fields, with `background` kept as the horizon value so the A-13 tables and the golden generator extend cleanly:

    | Key | Horizon | Mid | Zenith |
    |---|---|---|---|
    | 12 h | `#DCE8F0` | `#A9CDEB` | `#5E97D1` |
    | 7.5 h | `#F2DCC6` | `#BBD3EA` | `#7BA6D6` |
    | 17 h | `#F2CFA8` | `#C6C4CF` | `#6F86B8` |
    | 18 h | `#F4A877` | `#C792A0` | `#4E5F95` |
    | 19.5 h | `#4A4A6A` | `#2E3658` | `#151C38` |
    | night | `#1B2840` | `#0F1A2E` | `#060B16` |

  - The background colour equals the horizon (it shows only under the dome's lower rim).
  - Night stays readable: hemiI ≥ 0.25 (A-13).
  - **Cost:** +1 mesh, +1 draw call, 576 triangles. Phone risk: none.
- **D2. Fog (F only; lite has none, C-4.7).**
  - Linear, colour = the horizon (after the same tone mapping as the dome, so there is no seam). Near 2.2 × R, far 7 × R, with R = house.radius scaled by the zoom radius (`PC.view3d` radius), set in `applyLook` and on zoom.
  - **Must be checked:** fog on zoom is a per-frame uniform, not geometry. If the TL rules that fog range may change only in `applyLook`, use far = 9 × rMax(house) fixed.
  - Horizon seam ≤ 3 per channel at noon, evening and night (C-4.4).
- **D3. Surroundings (F+L).**
  - `groundOuter` becomes meadow: base `#8E9E6A`, which reads about `#8C9A68` at noon, with the B8 texture. It fades into fog (full) or into the dome horizon (lite: a 0.6 vertex-colour fade to the horizon colour over the outer 30 %).
  - The B-1 footprint hole and the magenta leak check stay (C-6.2).
  - **Street (F+L):** an 8 m asphalt band beyond the street edge, which reads `#55595C` with a 0.15 m kerb in `paving` and a 1.5 m footpath in the B2 texture, on 3 quads in the site batch. Cost +0 meshes, +12 triangles.
  - A quiet street turns "a model on a table" into "a plot on a road". The street edge comes from `house.site.streetEdge`.
  - No neighbour houses: they would invent things the client did not ask for.

### E. Landscaping

- **E1. Trees (F+L).**
  - **Trunk:** tapered (rTop 0.6 × rBottom), 6 segments, a slight lean ±4° per instance, in `#5B4636` retuned.
  - **Canopy:** 3 icosahedron lumps instead of one cone. IcosahedronGeometry(1, 1) has 80 triangles, so 3 lumps are 240 triangles, merged into one canopy geometry, instanced.
    - Lump layout at unit scale: centre (0, 2.9, 0) r 1.2; (0.55, 2.3, 0.2) r 0.9; (−0.5, 2.4, −0.3) r 0.85.
    - Flat shading.
  - **Second form, "cypress":** one tall cone r 0.55, h 3.6 (instanced separately, +1 mesh), chosen for every 4th tree near a boundary wall. It gives the Gulf-garden vocabulary (date palm is out of scope: too many triangles for its value).
  - **Colour variation:** per instance through `setColorAt` (C-2), as `material.color` × instance colour in [0.88, 1.08] value with a ±4° hue shift, seeded from the scatter. Seasons still set `material.color` (C-3.3).
  - **Cost:**
    - Canopy triangles 240 per tree. The max house has about 120 trees, so about 29 000 triangles; trunks about 1 400.
    - +1 mesh for the cypress.
    - Shadow pass: the canopy casts, so it is about 2×.
    - Total about 60 000 of the 300 000 allowed.
  - **Phone risk:** medium. This is the largest triangle item. Lite uses IcosahedronGeometry(1, 0) (20 triangles per lump), so 60 per tree.
- **E2. Shrubs (F+L).**
  - Two lumps (IcosahedronGeometry(1, 0)) squashed to y 0.7, in place of the cone.
  - Instance colour variation ±6 %.
  - Cost: 40 triangles per shrub; +0 meshes.
- **E3. Lawn edge (F+L).**
  - A 0.25 m paving-colour mowing strip along the plot boundary walls and around the footprint, in the site batch. It costs +0 meshes and reads as "kept garden".

### F. Water and site details

- **F1. Pool (F+L).**
  - Water surface 0.15 m below the rim. The inner walls go into the site batch in `#7FC3D9` (tile blue) and read darker toward the bottom by vertex colour.
  - Water: base `#3FA7C9` → retuned to read `#4FA9C8`, with opacity 0.85 (transparent 1 of 2, as today).
    - Full: MeshStandard roughness 0.05 plus the B7 ripple as a colour multiplier ±8 %, giving a sun glint.
    - Lite: Lambert as today.
  - Rim: 0.3 m coping in `paving` with the B2 texture.
  - Cost: +40 triangles; +0 meshes.
- **F2. Car canopy, gate and seating.** They take `frames` / `metal` materials (metalness 0.4 in full), with no change to geometry. The canopy roof gets the membrane texture.

## 4. Budget summary (maximum house, Roof on, full tier)

| Item | Meshes | Draw calls (plus shadow casters) | Triangles | Textures |
|---|---|---|---|---|
| Today | 21 | 38 | 15 662 | 0 |
| A1 upper walls | +4 | +8 | +3 000 | — |
| Material split (walls / floors / frames / glazing per level, paving) | +13 | +21 | — | — |
| A2–A4 openings and detail | 0 | 0 | +12 800 | — |
| B textures | 0 | 0 | 0 | 8 + blob 1 = 9, about 11.3 MB |
| C4 contact darkening | 0 | 0 | +3 000 | — |
| C5 blobs | +1 | +1 | +500 | — |
| D1 sky | +1 | +1 | +576 | — |
| D3 street and meadow | 0 | 0 | +40 | — |
| E1 trees (full) + cypress | +1 | +2 | +60 000 (with shadow) | — |
| E2 shrubs | 0 | 0 | +6 000 | — |
| F1 pool | 0 | 0 | +40 | — |
| **Total** | **≈ 41** (limit 64) | **≈ 72** (limit 160) | **≈ 101 000** (limit 300 000) | **9, ≈ 11.3 MB** (limits 12 / 16 MB) |

- **Lite:** the same meshes minus glazing (4), so about 37. About 45 000 triangles. 5 textures, about 0.4 MB.
- **Dist:** texgen about 8 KB, data about 3 KB, build changes about 15 KB, so about +26 KB of the +80 KB allowed (C-1.3).
- **Transparent meshes:** `poolWater` and `blobs`, so 2 of 2. Glazing is opaque.

## 5. MVP: the biggest jump for the cost

The MVP is items 1–7 below, all F+L unless stated. In my estimate they remove about 80 % of the gap.

| # | Item | Why it is in the MVP |
|---|---|---|
| 1 | A1 + the Roof-on default ruling | The house reads as a house. GPU cost about 0. |
| 2 | A2 windows, door and frames (glazing opaque gradient in both tiers; the Standard glazing mesh is post-MVP) | Without openings, full walls read as boxes. A1 needs A2. |
| 3 | D1 sky dome + D3 meadow + street (+ D2 fog in full) | Removes the grey void that fills 55 % of the frame. |
| 4 | C1 ACES + C2 sun / hemi balance + C3 2048 desktop shadows | Volume and believable light, as data plus a retune. |
| 5 | C4 baked contact darkening + C5 blobs | Grounds everything; cheap. |
| 6 | E1 / E2 trees and shrubs (lumps, taper, colour variation) | Kills the lollipop repetition. |
| 7 | B1 grass + B2 paving + B4 roof tiles + B8 meadow textures (Lambert keeps working) | The big surfaces stop looking like plastic. |

**After the MVP, in order:**

1. the MeshStandard switch (with shots, C-2);
2. B3 plaster, B5 membrane, B6 timber, B7 water ripple;
3. A3 roof detail and A4 plinth;
4. F1 pool depth;
5. the cypress form;
6. glazing as a Standard mesh.

**Not proposed:** an envMap (PMREM spike, only if the TL wants it after the MVP shots), normal maps, palms, neighbour houses, animated water (it would need frames while idle).

## 6. Ownership and tests (proposal for the TL plan)

- **Designer:**
  - data: `look3d.js` (frame / plinth keys, roughness, tree variation, texture specs), `sky.js` (horizon / mid / zenith / exposure; sky golden regenerated through `verify/golden.mjs` only, C-6.5);
  - the texgen pixel specs (as in B);
  - the target-read probe list, and before / after shots at the C-6.5 poses into `shots/`;
  - stage-5 CSS, if any.
- **FS:**
  - `core/texgen.js` (pure);
  - `core/house.js` `openings` (additive);
  - `three/*` (batches with UVs, the material split, sky, blobs, tiers, `applyLook` additions);
  - the mock whitelist additions;
  - the budget / texture / tier / leak / context tests.
- **Shots:** I will hold the retune to the target reads in §3.C1 at noon, and render morning, evening, night, autumn and winter for sign-off.

## 7. Phone risk summary (for the CD-7 check on this build)

| Risk | Items |
|---|---|
| Highest | E1 tree triangles in the shadow pass; 512 textures × 8 in full |
| Medium | MeshStandard per-pixel lighting at DPR 2 on large ground faces |
| Low | Fog, blobs, sky, openings |

- **The lite tier exists for this:** a data switch, C-4.7.
- If the phone check stalls, switch phones to lite first, then lower `maxDprCoarse` to 1.5.
