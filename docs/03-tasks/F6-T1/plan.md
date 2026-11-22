# F6-T1 plan: realism MVP (CD-8), implementation (FS)

Date: 2026-11-22. Owner: FS. Status: **APPROVED with 2 required changes** (`plan-review.md`, 0c0a33b); amended in §A below (binding; it supersedes the text where they differ), no re-review.

## A. Amendments after the TL plan review (binding)

1. **Fog range (required change 1).**
   - The fixed `near = 4 R` / `far = 14 R` of §4.2 is replaced, and `fogNearK` / `fogFarK` are dropped from §2:
     - `near = limits.rMax + R`;
     - `far = min(near + fogSpanK × R, 0.9 × outerK × R / 2)`, with `PC.C.VIEW3D.fogSpanK = 8`.
   - Both are computed in `applyLook` from the current limits. `ctx` gains `limits`.
   - The resize path (`refit`) re-applies the stored look, which creates nothing.
   - Test: at the narrowest sweep aspect, every house vertex is nearer than `near` from the eye at Reset and at `rMax`.
2. **The sky dome follows the camera (required change 2).**
   - It is not centred at the origin with radius 0.8 × far, as §4.1 said. Instead `sky.position.copy(camera.position)` runs before each render, the radius is `0.9 × camera.far`, and `frustumCulled = false`, `depthWrite: false`, `renderOrder = -1`.
   - `skyK` is 0.9.
   - Because the radius is fixed per build (`farK × R`), the dome geometry is built per build.
   - Test: the dome radius is below `far`, and it is never clipped at `rMax` on any aspect.
3. **Rulings Q-T1..Q-T9 as in `plan-review.md`:**
   - two tasks with one publish;
   - an unlit `mats.ui` for the highlight and the N half of `northNeedle` (A-14 updated);
   - per-vertex linear gradients;
   - `blobs.count` set in `applyLook`, shrubs first;
   - transparency set `poolWater` + `blobs`;
   - raw fog colour (A-10);
   - the check renames in §9.2 / §9.4 approved in principle, with before and after numbers at the impl review;
   - run-time buy-back by the spike numbers, the `QA_FULL=1` moves agreed with QA;
   - `PC.house.openings` in `house.js`.
4. **The meadow skirt (§4.3) is `lite` only.** Full keeps a plain `groundOuter` (fogged), with the B-1 hole unchanged. There is no seam assertion in `lite`.
5. **Slab shadows.** `slab` stops casting (C-4.2). The Designer judges this in the shots; if it reads wrong, upper slabs may cast again, with the call counted.
6. **Added mutations:**
   - fog range fixed at 4 R: the portrait near test fails;
   - the dome not following the camera: the clip test fails;
   - `blobs` with trees first: the winter test fails.
7. **Designer answers (9c6cb51) for T1b:**
   - decal windows plus a 0.06 m reveal ring (`frame` × 0.65, at 0.02 m out);
   - lumps refitted inside `canopyR`;
   - a new `door` key per exterior.
   - **PM (a33ab26):** no help line, and Roof stays off after the finder or the tour.
8. **Contract-change reader lists** are required in the impl notes for:
   - `PC.sky.compute` (new fields);
   - the `PC.view3d.info()` additions;
   - `house.v` / `house.openings`;
   - the highlight material;
   - `siteBatch` → `paving` / `northNeedle`;
   - `roofBatch` slopes → `roofTiles`.

Sources:
- `cto-constraints.md` (0d2cef1), cited as C-x.y; binding.
- `designer-plan.md` (41c1636), cited as D-§ / item ids A1..F2; MVP = its §5 items 1–7.
- A-9 / A-10 / A-11 / A-13 / A-14 / A-16 in `architecture.md`.
- The code as it stands at 75775b7.

Scope: the seven MVP items, both tiers, the budgets and lifecycle of C-4 / C-5, and the tests within the 420 s line. Post-MVP items (the MeshStandard switch, B3 / B5 / B6 / B7, A3 / A4, F1, the cypress, Standard glazing, the envMap spike) are not in this plan. Their hooks are left open where it is free (the material table, the tier record).

Assumption (orchestrator, batch 16): stage 5 opens with **Roof on**. The client's decision card is pending. The default is one data value, `PC.C.VIEW3D.roofOnOpen: true` (§2), so a "no" is a one-line data change plus the test expectations listed in §9.3.

## 0. Findings from the code that change the Designer's costing

1. **A1 is mostly built already.**
   - `build-roof.js` already puts the exterior wall bands of every above-ground level (floorY + 1.2 → baseY + pitch, `exteriors.wall`) into `roofBatch`. That is F4-T2 plan review Q10.
   - So with Roof on and All, today's house already has full-height exterior walls. What makes it read as a dollhouse is that the roof is **off by default**, and that the walls have no openings.
   - A1 therefore costs **0 new meshes**, not +4. The bands stay in `roofBatch`, which is visible exactly when the exterior mode is (Roof on + All, C-6.2). No `walls-upper` mesh is needed, and the level groups are untouched.
2. **Opaque glass means windows need not be holes.**
   - Glazing is opaque in both tiers (D-A2; transparency, §7).
   - So a window is a dark-glass quad with a vertical gradient, plus frame and sill boxes. They sit **proud of the intact wall face** (glass 0.01 m, frame 0.05 m), and all of them go in `roofBatch`.
   - The parts below 1.2 m (for example a sill at 0.9 m) sit on the outer face of the level's 1.2 m wall. Because they live in `roofBatch`, they vanish in the cutaway with everything else of the exterior mode.
   - Result: no wall run is split, the level `walls` / `slab` batches stay byte-identical, and every model oracle on them (shell.test, QA f4-t1-model / f4-t2-model) keeps passing.
   - The look cost is the lost reveal depth. The 0.05 m proud frame gives a shadow line instead. The Designer judges this in the shots (Q-D1).
3. **Fog in r128 is applied after tone mapping and sRGB encoding.**
   - Checked in `tests/vendor/three-r128.min.js`: every built-in fragment shader ends `tonemapping_fragment` → `encodings_fragment` → `fog_fragment`.
   - So `fogColor` mixes directly into the **output** sRGB value. A fog colour of `col(hex)` (linear) therefore reads darker. That explains the CTO's measurement (C-0): `col('#9EC9F0')` is linear (0.34, 0.58, 0.87), which encodes as (87, 149, 222).
   - **Seam-free rule (proposed for A-13):**
     - `scene.fog.color = new THREE.Color(horizonHex)`, raw like `scene.background` (A-10's existing exception).
     - The sky dome uses `toneMapped: false` with vertex colours `col(hex)`, so it reads its table hex exactly, as the colour-pipeline quad does.
     - Fully fogged geometry and the dome's horizon row then both output the horizon hex, so the seam is about 0 by construction (C-4.4 asks for ≤ 3).
   - This also makes the Designer's sky table (D1) a table of **read values**, with no ACES retune needed for the sky.
4. **The pool is opaque today.**
   - `poolWater` is a `MeshLambertMaterial` without `transparent`. D-F1's "opacity 0.85 (transparent 1 of 2, as today)" is wrong about today. F1 is post-MVP.
   - So in the MVP the only transparent mesh is `blobs`. See §7 for the mismatch.
5. **The tree lumps leave the scatter's clearance.**
   - The lump layout in D-E1 reaches 0.55 + 0.9 = 1.45 m and √(0.5² + 0.3²) + 0.85 ≈ 1.43 m from the trunk axis.
   - The scatter's clearance radius is `canopyR` = 1.35 (TL F4-T3 plan review), so canopies could clip walls and the house.
   - The lumps must fit inside `canopyR` and below `canopyY0 + canopyH` (4.2 m). The tour's eye floor and `fitShadow` read those two numbers. See Q-D2.
6. **There is no `site.streetEdge` in the model.** The street is the plot edge from (0, 0) along +u at v = 0, as in `build-site.js`. The street band (D3) is built from that edge, so no new house field is needed for it.
7. **The setback can be 0** (`setback: [0, 20]`). The footprint ring (C4) and the street band clamp to the free distance (§5.2).

## 1. Work list, owners, phasing

The MVP is too big for one review cycle. It touches every look value (the ACES retune), adds a new core module, new geometry in four builders, and run-time pressure on every real-r128 suite. I propose **two tasks in one batch**, each with its own impl review and full run. There is **one publish, after F6-T1b**: the client does the CD-7 phone check once, on the upgraded build (C-8).

| Phase | Items | FS | Designer | QA |
|---|---|---|---|---|
| **F6-T1a: pipeline and world** | tiers (§2); Roof-on default (MVP 1, the switch part); ACES + exposure + light retune (MVP 4); 2048 desktop shadows; sky dome + fog + meadow + street (MVP 3); `core/texgen.js` + grass / paving / roof tiles / meadow textures with world UVs (MVP 7); `toneMapped: false` UI marks; the budget, texture, lifecycle and tier tests; lint size line | code, mock whitelist, tests | `sky.js` (horizon / mid / zenith / exposure keys), the ACES retune of `look3d.js` / `sky.js` to the D-C1 read targets, texture pixel specs, golden regeneration through `docs/03-tasks/F5-T3/verify/golden.mjs`, shots | sky oracle by hand; Roof-on expectations; random-operation leak suite (C-5.1) |
| **F6-T1b: house and garden** | windows / door / frames (MVP 2, `PC.house.openings`); contact darkening + blobs (MVP 5); trees and shrubs (MVP 6) | code, tests | `frame` keys, lump layout inside `canopyR`, variation ranges, blob opacities, retune of the new keys, after shots | model oracles for the new items |

- **Order inside F6-T1a:** step 1 is a measuring spike (§10). ACES + 2048 + 4 textures go on the real r128 behind a data flag, and every real-r128 suite is timed. **The run-time buy-back (§9.5) is agreed before the rest is built.**
- **Why this split:**
  - T1a is mostly data and pipeline, and the retune has to be done once, after ACES is in.
  - T1b is geometry whose colours are tuned under the finished pipeline.
- **Alternative:** one task with both phases. It saves one review cycle, but the impl review then covers about 1 500 lines of diff and two retunes. The TL decides (Q-T1).

## 2. Tiers, defaults and the data record (`core/const.js`, `PC.C.VIEW3D`)

```
VIEW3D: { maxDpr: 2, maxDprCoarse: 2, shadowMap: 1024, shadowMapFine: 2048, shadowBias, shadowNormalBias, sunDist, shadowK, shadowR,
  roofOnOpen: true,
  tier: { coarse: 'full', fine: 'full' },
  tiers: {
    full: { tex: 512, fog: true,  treeDetail: 1, shrubDetail: 0, fineShadow: true },
    lite: { tex: 256, fog: false, treeDetail: 0, shrubDetail: 0, fineShadow: false, maxDpr: 1.5 }
  },
  fogNearK: 4, fogFarK: 14, skyK: 0.8 }
```

- **Choice, once, at the first `PC.view3d.open`** (renderer creation), through a pure `PC.view3d.pickTier(env)`:
  - `env = { coarse: matchMedia('(pointer: coarse)').matches, maxTex: capabilities.maxTextureSize }`.
  - It returns `{ name, tex, fog, treeDetail, shrubDetail, shadowMap, maxDpr }`.
  - `shadowMap` = `shadowMapFine` only when the tier allows it, the pointer is fine and `maxTex ≥ 4096`; otherwise 1024 (C-4.5).
  - `maxDpr` = min(`maxDpr`, `maxDprCoarse` on coarse pointers, the tier's own cap) (C-4.6).
- **The tier is stored in `S.tier`** and listed in `PC.view3d.info().tier`. There is no frame-time switching (C-4.7).
- **Tests choose the tier** by setting `PC.C.VIEW3D.tier` before the first open: the mock creates a fresh environment per test, and real r128 uses a fresh page.
- **MVP materials stay Lambert in both tiers.** The MeshStandard switch is post-MVP (D-§5). So in the MVP the tiers differ in texture size, fog, shadow map, pixel ratio and tree lump detail. That is enough for the CD-7 fallback, and it keeps `lite` a pure data switch (C-8).
- **`roofOnOpen`:**
  - `scene.js` initialises `S.roof = V().roofOnOpen` once per page session.
  - `stage-3d.js` sets `v3-roof.checked` from `PC.view3d.info().roof` on its first `enter`.
  - The session rule (A-4: the roof toggle survives leaving and returning) is unchanged.
  - The finder and the tour still turn the roof off (A-14). Reset view keeps it.
  - A "no" from the client means setting it to `false`, plus the test expectations in §9.3.

## 3. Light, tone and shadows (MVP 4; `scene.js`, `look.js`, `core/sky.js`, `data/sky.js`)

1. **Renderer setup:**
   - `makeRenderer` sets `toneMapping = THREE.ACESFilmicToneMapping`.
   - `shadow.mapSize` comes from the tier (§2).
   - `setPixelRatio` uses the tier's cap.
   - `outputEncoding` stays `sRGBEncoding`.
2. **Exposure:**
   - A new sky key field `exposure`, lerped in `PC.sky.keyAt` like `sunI`.
   - `compute` returns `exposure`, `skyHorizon`, `skyMid`, `skyZenith`.
   - The three sky colours get the same day-weighted season tint as `background` today, and `background` becomes an alias of `skyHorizon`.
   - `applyLook` writes `ctx.renderer.toneMappingExposure = L.exposure`; `ctx` gains `renderer`.
   - The fields are additive, so `compute`'s existing fields keep their meaning (C-6.3).
3. **UI-matched colours stay out of tone mapping (C-2):**
   - New material `mats.ui = MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false })`.
   - The highlight is built with it instead of `mats.batch`. It is unlit, so it reads `#C2410C` ± 2 at every hour, including 22 h. The night check is now trivially true (Q-T2).
   - The north needle's N half moves out of `siteBatch` into a new mesh `northNeedle` with `mats.ui` (+1 mesh). The S half stays in `siteBatch` in `poolRim`.
4. **Retune (Designer, data only):**
   - Every `look3d` hex and `sky` key is retuned to the D-C1 read targets: sunlit and shade wall, lawn, lawn in shade, paving, pool, white wall without clipping, terracotta.
   - The `sun : hemi` balance goes to about 2.2 at noon (D-C2).
   - The O-1 keys (17 / 18 h) keep QA's ≥ 15 000 px metric.
   - The probe list goes into `docs/03-tasks/F6-T1/verify/shots.mjs`.
   - FS adds no code for this beyond the exposure field.
5. **Shadows:**
   - 2048 on fine-pointer desktops, 1024 otherwise (C-4.5). PCFSoft, `fitShadow` unchanged.
   - Shadow casting follows C-4.2:
     - cast: level `walls`, `roofBatch`, furniture, `trunks`, `canopies`, `shrubs`, `siteBatch` (walls, canopy, posts, seating);
     - receive only: the ground meshes, `paving`, `poolWater`, `slab`;
     - neither: `sky`, `blobs`, `northNeedle`, `highlight`.
   - Today `BoxBatch.build` sets cast and receive on every batch. `slab` and `paving` turn `castShadow` off.

## 4. Sky dome, fog, meadow, street (MVP 3; `scene.js`, `look.js`, `build-shell.js`, `build-site.js`)

1. **`sky` mesh:**
   - Built in `buildShell`, in a new group `skyGroup` under `world` (`ground` stays as it is).
   - Geometry: `SphereGeometry(skyK × camera.far, 24, 12)`, with camera far = `farK × R`, so skyK 0.8 gives 16 R.
   - Material: `MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, toneMapped: false, depthWrite: false })`.
   - `renderOrder = -1`, `frustumCulled = false`, no shadows. It is centred at the world origin and never moves: the eye stays within about 3 R of the origin, and a far side of 16 + 3 < 20 R is never clipped.
   - Everything else draws over it, because it writes no depth.
   - Vertex colours:
     - elevation ≥ 15°: mix horizon → mid → zenith by elevation (D1);
     - elevation 0° → 15°: horizon → mid;
     - below 0°: horizon.
   - **`applyLook` rewrites the colour attribute in place** (`array.set` + `needsUpdate`). No GPU object is created or disposed (C-5.3).
   - The mix is the linear lerp of `col()` values per vertex: the A-10 `mixHex` rule applies to look-table colours, not to per-vertex gradients (Q-T3).
2. **Fog (full tier only):**
   - `scene.fog = new THREE.Fog()` is created once in `setup` when the tier has fog; otherwise `null`.
   - `applyLook` sets `fog.color = new THREE.Color(L.skyHorizon)`, **raw** (§0.3), `near = fogNearK × R` and `far = fogFarK × R`.
   - The range is fixed per house, set in `applyLook` only, and never changes on zoom (C-2: "range scales with house.radius"):
     - near 4 R sits beyond the farthest eye position (rMax = 3 R) plus the house, so the house is never fogged;
     - far 14 R lies inside the `groundOuter` half-width of 18 R, so the meadow edge is fully fogged into the horizon.
   - The Designer's zoom-scaled range (D2) would need a per-frame write outside `applyLook`, so I propose the fixed range. If the Designer wants a denser haze, they lower `fogFarK`.
3. **Meadow:**
   - `groundOuter` keeps its shape (the square of `outerK × R` with the footprint hole: B-1, the magenta leak check).
   - It takes the meadow colour (`siteColors.groundOuter` retuned to D3) and the B8 texture.
   - **Lite (no fog):** the meadow edge would show against the dome. `groundOuter` gains a vertex-colour skirt: the square's outer 30 % is built as quad strips merged into the same geometry, with `vertexColors` on. The outer ring's vertices are recoloured to the horizon in `applyLook` in place, and the inner ones stay white (the material colour multiplies).
   - Full also gets the skirt, so the two tiers share one geometry.
4. **Street (in `siteBatch` and `paving`; +0 meshes beyond `paving`):**
   - Along the street edge (v = 0, u from the plot's min to max), outside the plot:
     - a 1.5 m footpath (in `paving`, B2 texture);
     - a 0.15 m kerb, 0.12 m high (`siteBatch`, `paving` colour);
     - an 8 m asphalt band (`siteBatch`, new key `siteColors.asphalt`).
   - The band is laid at y −0.03 / −0.02, above `groundOuter` at −0.05, so the two never fight.
   - Only along the edge's own length, clamped to the `groundOuter` square.
   - QA's magenta leak check covers the new ground items (C-6.2).

## 5. Textures and world UVs (MVP 7; new `core/texgen.js`, `util.js`, the builders)

1. **`core/texgen.js` (pure, core layer, no THREE):**
   - API: `PC.texgen.make(kind, size, seed)` → `{ w, h, data: Uint8Array(w × h × 4) }`.
   - Kinds in the MVP:
     - `grass` (B1), `paving` (B2), `tiles` (B4), `meadow` (B8): greyscale around 0.5–0.85 value, alpha 255;
     - `blob` (C5): a 64² radial alpha with RGB 0.
   - **Determinism:** a seeded PRNG (mulberry32), seed = hash(kind) by default.
   - **Tileability:** the noise is periodic over the tile (lattice value noise on a wrapped grid). Joints and rows are laid on a grid that divides the size.
   - **Cache:** `PC.texgen.get(kind, size)` memoises per page session, so pixels are generated once (C-3.2).
   - **Specs** (value ranges, tile metres, joint widths) live in `PC.data.textures` (new `data/textures.js`, Designer-owned), as `{ kind: { tileM, ... } }`.
2. **GPU side, `PC.three.texture(kind, tier)` (util.js), per build:**
   - Creates a `DataTexture` from the cached pixels.
   - Sets `RGBAFormat`, `RepeatWrapping`, `repeat = 1 / tileM`, `encoding = sRGBEncoding` (all MVP maps are colour maps), `LinearFilter`, `LinearMipmapLinearFilter`, `generateMipmaps = true`, `anisotropy = min(4, getMaxAnisotropy())` and `needsUpdate = true` (C-3.4).
   - The blob texture uses `LinearEncoding`, since its alpha is data.
   - Textures are tracked in `S.textures` and disposed in `dispose()` with the meshes and materials (C-5.1).
3. **World UVs:**
   - `BoxBatch` gains a `uv` attribute in **metres**: per face, the two in-plane world axes. Quads and flats use X / Z.
   - `addPrism` slopes use (along the ridge, along the slope), so tile rows run along the eaves.
   - `ShapeGeometry` already gives shape-space UVs in metres, so `groundPlot` / `groundOuter` need none.
   - `groundCap` is a PlaneGeometry: its uv is rescaled in place at build to (w, d) metres.
   - `repeat = 1 / tileM` turns metres into tiles.
4. **Material and mesh split (MVP only):**

   | Mesh | Material | Texture | Change |
   |---|---|---|---|
   | `groundPlot`, `groundCap` | `mats.ground` (Lambert, colour from look) | grass | `map` added; season colour still via `material.color` (C-3.3) |
   | `groundOuter` | `mats.groundOuter` (Lambert, `vertexColors` for the skirt) | meadow | |
   | `paving` (new, in `site`) | `mats.paving` (Lambert, `vertexColors`) | paving | parking pads, the seating pad, the pool rim and the footpath move here from `siteBatch` |
   | `roofTiles` (new, in `roof`, pitched roofs only) | `mats.tiles` (Lambert, `vertexColors`) | tiles | the two slopes move out of `roofBatch`; gables, bands and windows stay |
   | everything else | as today | none | |

   - The walls get no texture in the MVP (B3 plaster is post-MVP), so the level batches are untouched.
5. **Budget:**
   - Full: 4 × 512² + 64² = 5 textures, ≈ 5.6 MB with mipmaps.
   - Lite: 4 × 256² + 64², ≈ 1.4 MB.
   - Both are under 12 textures and 16 MB (C-3.1). The mock test sums `w × h × 4 × 4/3` over the textures of the maximum house.
6. **Time:** the unit test generates all five at 512 (blob at 64), best of 3, and requires ≤ 150 ms (C-3.2; Designer target ≤ 60).

## 6. House and garden (F6-T1b; MVP 2, 5, 6)

### 6.1 Openings (`core/house.js`, additive; house `v: 2`)

`PC.house.openings(house)` is pure and fills `house.openings`, a list of `{ level, side: 'front'|'back'|'left'|'right', a, b, kind, sill, head }` in L. It runs inside `build`, before the key hash, so the key covers it (C-6.1).

**Runs:**
- For each level with index ≥ 0, and each footprint side, the runs are the room edges lying on that side (within EPS), clipped by the partitions.
- The stair rectangle on a side gives a `slot` run. The lift gives none.

**Rule (D-A2):**

| Room type | Kind | Size | Sill | Count and spacing |
|---|---|---|---|---|
| habitable (living, dining, majlis, bedroom, office, kitchen) | `window` | 1.2 m wide | 0.9 m (head 2.3 m) | n = max(1, floor((run − 0.6) / 2.6)), evenly spaced, 0.6 m clear of each run end |
| service (bathroom, laundry, maid, storage) | `small` | 0.6 × 0.6 m | 1.6 m | 1 when run > 1.2 m |
| stair core | `slot` | 0.6 × 1.6 m | | 1 |
| ground front | `door` | 1.0 × 2.2 m | | at `site.entrance` |

- A run shorter than the window + 1.2 m gets no window. Openings closer than 0.6 m to the door frame are dropped.
- The head is clamped to the storey: head ≤ storeyH − 0.3.
- Unit tests: counts per run length, spacing, clearances, determinism, the key changes with the openings, and the layout golden unchanged (C-6.5).

**Build (`build-roof.js`, all in `roofBatch`, §0.2):**
- Per opening:
  - a glass quad on the outer wall face, 0.01 m proud, with a vertical vertex gradient from `glassTop` to `glassBottom` (new `siteColors` keys, Designer);
  - 4 frame bars, 0.06 m profile and 0.05 m proud, in `exteriors[x].frame` (new key);
  - a mullion for widths ≥ 1.2 m;
  - a sill 0.04 × 0.08 m in `trim`.
- The door: a leaf box 1.0 × 2.2 m at the outer plane in `exteriors[x].frame` (Q-D3), with a frame in the same key.
- `BoxBatch` gains `addQuadV(...)`: a vertical quad with a top and bottom colour.

**Cost (Designer estimate):** about 9 primitives per window, so the max house adds about 9 500 triangles and 0 meshes.

### 6.2 Contact darkening (C4) and blobs (C5)

**New items are appended after the existing ones** in each batch, as new item kinds (`skirt`, `ring`). The existing boxes keep their order, vertices and colours, and the oracles filter by `userData.items` kind.

1. **Wall base skirt:**
   - For every ground-level exterior wall and the boundary wall: a vertical quad 0.6 m high on each outer face, 0.005 m proud.
   - Vertex colours: the face colour × 0.82 at the bottom, × 1.0 at the top (D: −18 % fading to 0 by 0.6 m; one gradient, not two steps).
   - They go in the level-G `walls` batch and in `siteBatch`.
   - Depth precision at 50 m with near 0.5 m is about 0.3 mm, so 5 mm does not fight.
2. **Floor ring:**
   - Per room, a 0.3 m ring of 4 trapezoid quads on the tint quad (tintLift + 0.003).
   - Outer vertices at × 0.9 of the tint, inner at × 1.0. In the `slab` batch.
3. **Footprint ring:**
   - `groundPlot` gains `vertexColors`.
   - Its hole is the footprint grown by w, where w = min(0.8, free distance to the plot outline − 0.05), and a ring of quads fills the band. Vertex colours: × 0.8 at the footprint, × 1.0 at the outer edge. w = 0 at setback 0.
   - The season colour stays `material.color`.
4. **`blobs`:**
   - One `InstancedMesh` of a unit `PlaneGeometry` at y 0.02.
   - Material: `MeshBasicMaterial({ color: black, map: blob, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false })`, `renderOrder = 1`.
   - Instances: shrubs first, then trees, with radius 1.2 × r × s or 1.1 × canopyR × s.
   - Per-kind opacity is not possible on one material, so the shrub/tree difference goes into the instance colour (`setColorAt` grey 0.22 / 0.28 × the map).
   - **Winter:** `applyLook` sets `blobs.count = nShrubs` when `canopyVisible` is false, and the full count otherwise. That is a count, not a GPU object (Q-T4).

### 6.3 Trees and shrubs (E1, E2; `build-site.js`, `data/look3d.js`)

- **Trunks:** `CylinderGeometry(trunkR × taper, trunkR, trunkH, 6)`. Per instance, a lean of ±`leanDeg` about a seeded axis (a quaternion in the instance matrix).
- **Canopies:**
  - Built by a new `PC.three.mergeGeos(list)` (util.js; no `BufferGeometryUtils`, C-1.1).
  - 3 `IcosahedronGeometry(r, tier.treeDetail)` lumps at the Designer's offsets, fitted inside `canopyR` (Q-D2). The result is non-indexed with `computeVertexNormals()`, which gives flat faces.
- **Shrubs:** 2 squashed `IcosahedronGeometry(1, 0)` lumps.
- **Colour variation:**
  - `setColorAt` per instance: a value factor in [0.88, 1.08] and a hue shift of ±4°.
  - The seed is the FNV hash of the item's position, so it is deterministic and survives rebuilds.
  - Seasons still set `material.color` (C-3.3).
  - The mock enforces `setColorAt(index, Color)`.
- **Ranges and offsets** live in `PC.data.vegetation` (new fields `lumps`, `shrubLumps`, `taper`, `leanDeg`, `tint`), Designer-owned.
- **Triangles (max house, full):** about 120 × 240 + 200 × 40 + trunks ≈ 38 000, about 76 000 with the shadow pass. Lite uses lump detail 0, about 12 000. The limit is 300 000.

## 7. Transparent meshes: the 2 vs 3 mismatch (for the TL)

The constraint and the Designer plan agree on the number but not on which meshes:

- **The CTO's limit (C-2)** is "at most 2 transparent meshes: `poolWater` and one glazing mesh".
- **The Designer (D-C5, D-F1)** uses `poolWater` (made transparent in F1) and `blobs`, with glazing opaque.
- **Allowing every named member of both lists** gives three (`poolWater`, glazing, `blobs`), over the limit.
- **Today none is transparent** (§0.4). In this MVP only `blobs` is.

**Proposal:**
- The TL records in A-11 that the limit is **2 transparent meshes: `poolWater` (F1, post-MVP) and `blobs`; glazing stays opaque in both tiers**.
- A transparent glazing mesh later would have to replace one of them.
- The constraint table names glazing explicitly and the transparency row is not marked **must**, so the TL can decide. I suggest a one-line CTO note anyway (Q-T5).
- The mock test asserts that ≤ 2 meshes of the maximum house have `material.transparent` and that their names are in the allowed set.

## 8. Budgets and lifecycle (C-4, C-5)

**Expected counts, max house (terrace, so no `roofTiles`), Roof on:**

| | Today | F6-T1a | F6-T1b | Limit |
|---|---|---|---|---|
| Meshes | 21 | 24 (`sky`, `paving`, `northNeedle`) | 25 (`blobs`) | ≤ 64 (budget.test; G6 150) |
| Draw calls (real r128, incl. shadow) | 38 | ≈ 41 | ≈ 44 | ≤ 160 |
| Triangles | 15 662 | ≈ 17 000 | ≈ 100 000 | ≤ 300 000 |
| Textures / memory | 0 | 4 / 5.6 MB | 5 / 5.6 MB | ≤ 12 / 16 MB |
| Transparent meshes | 0 | 0 | 1 | ≤ 2 |

A selection adds `highlight` (+1). A pitched roof adds `roofTiles` (+1).

**Lifecycle:**
- `dispose()` adds `S.textures`.
- The sky and skirt colour attributes belong to their own geometries and are disposed with them.
- Context restore runs `build(S.house)`, which recreates the textures from `PC.texgen` cached pixels with no regeneration. The test asserts that the `texgen` generation counter stays the same.
- The only per-pick object is still `highlight` (C-5.3).

**Dist:** estimated +25 KB (texgen about 7, data about 3, three about 12, core about 3). The lint gets the line `dist/index.html ≤ 627 KB` (547 + 80; C-1.3).

## 9. Tests

### 9.1 New node tests (no run-time cost to speak of)

- **`unit/texgen.test`:** sizes; value ranges per kind; tileability (|edge row − opposite edge row| ≤ the kind's step); determinism (FNV of the pixels per kind, a golden of 5 hashes regenerated only with a spec change); the cache returns the same object; time ≤ 150 ms best of 3.
- **`unit/house.test` (openings):** the rule table; clearances; head clamp; determinism; `v === 2`; the layout golden untouched.
- **`unit/sky.test`:** the new fields (`exposure` lerp, horizon / mid / zenith tint blend). The 16-row golden is regenerated by the Designer (§9.4).
- **`three/budget.test` (both tiers):**
  - exact mesh counts (§8) and ≤ 64;
  - one shadow light, with map 2048 (fine) or 1024 (coarse / lite);
  - texture count ≤ 12 and memory ≤ 16 MB;
  - transparent ≤ 2 by name;
  - nothing created in 32 looks (geometries, materials **and textures**);
  - `applyLook` mean < 5 ms.
- **`three/look.test`:** exposure, raw fog colour and range written by `applyLook`; the sky colour attribute rewritten in place (same object, `needsUpdate`); `blobs.count` in winter; lite has no fog.
- **`three/scene.test`:**
  - opens with `roof = roofOnOpen`, and the visibility table with the roof on;
  - rebuild ×20: `created` minus `disposed` constant for geometries, materials and textures;
  - restore: textures recreated, generation counter unchanged;
  - `pickTier` table.
- **`three/shell|site|roof.test`:** world UVs in metres; new names; existing items unchanged (the first N items equal the F5 build); skirt / ring / window items; the street clamp; the footprint ring at setback 0.
- **`three/vegetation.test`:** lumps inside `canopyR` and ≤ `canopyY0 + canopyH` at every scale; `setColorAt` deterministic.
- **Mock (`tests/three-mock.js`, whitelist rows for the TL review):**
  - `WebGLRenderer.toneMapping`, `toneMappingExposure`, `capabilities.maxTextureSize`, `capabilities.getMaxAnisotropy`;
  - `ACESFilmicToneMapping`, `BackSide`, `RGBAFormat`, `RepeatWrapping`, `LinearFilter`, `LinearMipmapLinearFilter`, `LinearEncoding`;
  - `DataTexture(data, w, h, format)` with `wrapS / wrapT / repeat / encoding / magFilter / minFilter / generateMipmaps / anisotropy / needsUpdate / dispose`;
  - `Fog(color, near, far)`, `Scene.fog`;
  - `Material.toneMapped`, `fog`, `map`, `transparent`, `opacity`, `depthWrite`, `side`; `Object3D.renderOrder`;
  - `SphereGeometry(r, ws, hs)`, `IcosahedronGeometry(r, detail)`, `CylinderGeometry(rTop, rBottom, h, seg)` (already used);
  - `BufferGeometry.computeVertexNormals`, `BufferAttribute.array / needsUpdate`;
  - `InstancedMesh.setColorAt(i, Color)` (signature enforced) and `count`.
  - The conformance part of `view3d-real` checks each row on real r128 automatically.

### 9.2 Real r128 (folded into `view3d-real.spec`, ≤ +15 s; C-7.1)

All of these run in the existing page loads except the lite smoke test:

| Check | Where | Est. |
|---|---|---|
| draw calls ≤ 160 and triangles ≤ 300 000, Reset pose, Roof on and off, on the maximum house (loaded once through the existing helpers) | new max-house load | 4 s |
| build time ≤ 400 ms best of 3, max house, recorded | same load | 2 s |
| horizon seam ≤ 3 per channel at 12 / 17.5 / 22 h: the pixel just above vs just below the horizon at a low-phi pose | existing load | 1.5 s |
| colour pipeline on a `toneMapped: false` quad (moves, C-2); highlight orange at 22 h | existing | 0.5 s |
| context loss: `info.memory.textures` before = after restore; frame not blank | existing loss test | 0.3 s |
| lite smoke: fresh page with `tier.fine = 'lite'`, renders non-blank, no fog, map 1024, pixel ratio ≤ 1.5 | new page | 4 s |
| **total** | | **≈ 12 s** |

**The F4-T1 "sky = raw background hex" check** (line 190) cannot hold once the dome covers the background. It becomes "the pixel at the sky sample = the dome's computed colour at that elevation ± 3". This needs TL approval, with before and after recorded (C-6.5). It is not deleted.

### 9.3 Expectations that change with Roof on at open (no check removed)

- **FS-owned:**
  - `three/scene.test` line 225 ("opens on All, roof off");
  - `e2e/view3d.spec` lines 85–92 and 169–172 (the switch taps now go on → off → on; the check is the same).
- **QA-owned (QA edits):**
  - `qa/f4-t1-view` (86, 155, 396–399), `qa/f4-t2-view` (68–75, 161), `qa/f5-t1-view` (155), `qa/f5-t2-view` (173–187), `qa/f1-t1-layout` (122, the switch list);
  - any reference frame taken at the Reset pose: F5-T3 refs, O-1 metric pose.
- **Suggested helper:** `PC.debug.scene().roof` plus a QA helper `roofTo(on)` that taps only when needed, so the suites stay independent of the default (version-aware, as was done for `v3-roof` in F4-T2).

### 9.4 Golden and reference regeneration list

| File / check | Change | By whom | Rule |
|---|---|---|---|
| `tests/unit/fixtures/layout-golden.json` | **none** | | C-6.5 |
| `tests/unit/sky.test` 16-row golden + the F4-T1 continuity literals (line 40) | regenerated | Designer through `docs/03-tasks/F5-T3/verify/golden.mjs` | TL lists changed rows old → new; QA updates its sky oracle by hand |
| `unit/texgen.test` pixel hashes | new | FS | changes only with a `data/textures.js` change |
| `three/budget.test`: 21 → 24 / 25, ≤ 40 → ≤ 64, map ≤ 1024 → by tier | numbers | FS | C-4.1 |
| `view3d-real`: calls ≤ 80 → ≤ 160, meshes ≤ 40 → ≤ 64, sky = dome, colour pipeline quad `toneMapped: false` | thresholds | FS | TL approval, before/after in the impl review |
| `view3d-real` pixel checks (luma order, shadows darken, winter canopy, magenta leak) | thresholds kept; re-measured | FS / QA | a threshold changes only with TL approval |
| QA `f3-t3-data` (look3d key set), `f4-t2-model` (slopes → `roofTiles`; paving items → `paving`; `roofBatch` window items; `siteBatch` skirt and street), `f4-t3` sky oracle, O-1 metric | oracle updates | QA | |
| `docs/03-tasks/F6-T1/shots/` | new after shots, same poses as `before/` | Designer | C-6.5 |
| `tests/durations.json` | refreshed with `--write-durations` after each phase's green full run | FS / QA | A-16 |
| `tests/contract/*` | none (no hook changes) | | C-6.6 |

### 9.5 Run time (420 s line; 480 s with QA_FULL=1)

- **Baseline:** 405.3 / 412.2 s at 75775b7, with longest-first scheduling at its floor (F5-T3c). That leaves **8–15 s of headroom**.
- **Expected cost:**
  - view3d-real +12 s of work;
  - the SwiftShader slowdown from ACES, textures and 2048 shadows on every real-r128 file. That is about 270 s of the 1 170 s of browser work (view3d, view3d-real, QA f4-t1/t2/t3, f5-t1/t2/t3), so +10 % is about +27 s of work;
  - the QA leak suite;
  - all divided by 3 jobs, about **+15 to +20 s of wall time**.
- **That breaks 420 s.** New tests have to buy back their own time (C-7.1):
  1. The F6-T1a spike (§10 step 1) measures the real slowdown first.
  2. The QA leak suite runs 50 operations on the sample house by default, with 200 operations on the maximum house behind `QA_FULL=1` (QA's call).
  3. Real-r128 checks already covered by another file (for example the F4-T1 roof-switch pixel diff, now redundant with view3d's) move behind `QA_FULL=1`. That is QA's call; each move is listed in the QA report.
- **Target:** two green full runs ≤ 420 s at each phase's impl review, and the QA_FULL run ≤ 480 s.

## 10. Steps

**F6-T1a:**
1. **Spike** (½ day):
   - ACES + exposure, 2048 shadows and 4 textures at 512 on the real r128, behind `tier` data.
   - Measure each real-r128 suite, draw calls, build time and the horizon seam with the raw fog colour (§0.3).
   - Report the numbers to the TL, with the buy-back agreed (§9.5).
2. Mock whitelist, tier record and `pickTier`, renderer setup, `roofOnOpen`, `mats.ui` (highlight, `northNeedle`).
3. `PC.sky` fields and `applyLook` (exposure, fog, sky attribute); sky dome, meadow skirt, street; the Designer's sky tables.
4. `core/texgen.js` + `data/textures.js`, world UVs, `paving` / `roofTiles` split, `PC.three.texture`, disposal.
5. Designer retune + golden regeneration. FS reruns the pixel checks.
6. Tests §9.1–9.3, lint size line, focused runs, two full runs, durations refresh, impl notes (including the contract-change reader list, A-16: `PC.sky.compute` fields, `PC.view3d.info()` additions, `house.v`), commit.

**F6-T1b:**
1. `PC.house.openings` + unit tests.
2. Windows and door in `roofBatch`.
3. Skirts, rings, footprint ring, blobs.
4. Trees and shrubs.
5. Designer keys and retune; shots.
6. Tests, two full runs, durations, impl notes, commit. Then one publish for the batch (C-8).

**Mutation proofs (C-7.3; each run once, reverted, listed in the impl notes):**
- textures not disposed on rebuild;
- `encoding` dropped from the grass map;
- `toneMapped: false` dropped from `mats.ui`;
- a second `castShadow` light;
- fog not updated in `applyLook`;
- the tier ignored (always full);
- fog colour linearised (`col()`): the seam check fails;
- sky attribute recreated in `applyLook`: the nothing-created assertion fails;
- an opening rule off by one (n formula): the house test fails.

## 11. Open questions

**For the TL:**
- **Q-T1:** two tasks (F6-T1a pipeline and world, F6-T1b house and garden) with one publish after T1b, or one task? I recommend two.
- **Q-T2:** the highlight on an unlit `MeshBasicMaterial` with `toneMapped: false`. It stays exactly `#C2410C`, at night too. Today it is lit (Lambert) and dims at night. This is a small A-14 change.
- **Q-T3:** the sky gradient lerps linear colours per vertex. Does the A-10 one-mix rule cover look-table colours only?
- **Q-T4:** may `applyLook` set `blobs.count` (winter hides the tree blobs)? It is visibility-like and creates nothing. The alternative is two blob meshes, which breaks the transparency limit (§7).
- **Q-T5:** the transparency set (§7): `poolWater` + `blobs`, glazing opaque. Record it in A-11, with or without a CTO note?
- **Q-T6:** the raw fog colour as a second A-10 exception beside `scene.background` (§0.3).
- **Q-T7:** the sky check change in `view3d-real` (§9.2) and the threshold renames in §9.4. Can they be approved in the plan review, with numbers at the impl review?
- **Q-T8:** the run-time buy-back (§9.5): agree that the spike numbers decide how much QA moves behind `QA_FULL=1` before step 2 starts.
- **Q-T9:** `PC.house.openings` lives in `house.js` (inside the CTO's listed diff) rather than a new core module. Do you agree?

**For the PM:**
- **Q-P1:** Roof on at open (the decision card is pending; this plan assumes yes, reversible by `roofOnOpen`). Does the stage-5 help text or the F4-S1 / F4-S2 story text need a line ("the view opens on the outside of your house; switch Roof off to see inside")?
- **Q-P2:** with Roof on at open, the finder and the tour still switch the roof off, and it stays off after they end (A-14, PM Q12). Should the end of a tour restore Roof on instead? I recommend no change, since the camera and level also stay.

**For the Designer:**
- **Q-D1:** windows as proud decals on an intact wall (§0.2) instead of split walls. Is it acceptable in the shots? If not, the band in `roofBatch` can be split around the upper part only; the level walls still stay intact.
- **Q-D2:** please fit the tree lumps inside `canopyR` (1.35 m) radially and ≤ 4.2 m in height at scale 1 (§0.5), or raise `canopyR`. Raising it changes the scatter and therefore the trees in every house, but not the layout golden.
- **Q-D3:** door leaf colour: `frame`, or a new `door` key?
