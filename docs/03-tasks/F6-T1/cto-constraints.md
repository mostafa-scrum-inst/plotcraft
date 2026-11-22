# F6-T1 realism upgrade (CD-8): technical constraints

Date: 2026-11-22. Author: CTO. Binding on the Designer look spec (`designer-plan.md`), the TL plan and review, the FS work and QA.

Where a rule needs a decision this document does not make, the TL decides it at the plan review and records it in `architecture.md`. Any deviation from a hard rule (marked **must**) needs the CTO.

## 0. What I measured (real r128, vendored copy, headless Chrome / SwiftShader)
- **Rendering:** `MeshStandardMaterial` combined with a `DataTexture` (mipmapped, repeat-wrapped, `sRGBEncoding`), vertex colours, `PCFSoftShadowMap` at 2048, `ACESFilmicToneMapping` and `Fog`. It renders with zero console messages.
- **Capabilities:** WebGL 2, highp, `maxTextureSize` 8192, max anisotropy 16. These are SwiftShader values, not phone values.
- **ACES changes every material colour.** `#C2410C` through `col()` reads back as (208, 60, 14) with ACES and (194, 65, 12) without it, or with `toneMapped: false`.
- **Fog and background differ when the fog colour goes through `col()`.** With fog = `col(background)`, the horizon read (87, 149, 222) against a background of (158, 201, 240): a visible seam (rule 4.4). [Edit 2026-11-22, after the TL's F6-T1 plan ruling: the cause is the order of r128's shader chunks. Fog is applied after tone mapping and output encoding, so a linear `col()` colour lands darker. (87, 149, 222) is exactly the linear value of (158, 201, 240). So the fog colour is set as raw sRGB hex and is not tone-mapped. It then matches the raw background and an unlit `toneMapped: false` sky dome by construction. ~~Fog on geometry is tone-mapped.~~]
- **`new THREE.DataTexture(...)` defaults** to `NearestFilter`, `generateMipmaps = false`, `flipY = false`. Each of these must be set explicitly (rule 3.4).
- **The dist is 547 KB today.**

## 1. Hard constraints that do not move (brief, A-1/A-3)
1. **Single file.** `dist/index.html` stays one file. The only external reference is the exact cdnjs r128 tag.
   - No fetched images, fonts, HDRIs, glTF or `examples/js` (no `RoomEnvironment`, `EffectComposer`, SSAO, `Sky`, `Water`, `BufferGeometryUtils`).
   - The lint rule "exactly one external URL" and the r128-banner check stay as they are.
2. **Procedural textures only.** Textures are generated at run time from code. No `data:` images embedded as base64 assets either: they bloat the single file and cannot be tested as rules.
3. **Dist growth.** At most **+80 KB** over today's 547 KB for all of F6. The lint gets a size line.
4. **No extra lights and no extra shadow casters.** One `HemisphereLight` plus one `DirectionalLight` sun, the only `castShadow` light. A-13 and the Designer art note assume this rig; ambient or fill lights are not allowed.
5. **Stages 1–4 are untouched by F6.** No 2D, layout or store change. The F6 diff stays inside `three/*`, `data/look3d.js` / `sky.js` / new data files, `core/house.js` (additive fields only, see 7.2), a new pure core module for texture pixels, and stage-5 CSS.

## 2. Allowed r128 features
Every addition goes into `tests/three-mock.js` with its r128 documentation name, approved at the TL plan review (A-16 rule).

| Feature | Status | Conditions |
|---|---|---|
| `outputEncoding = sRGBEncoding` | stays | unchanged |
| `toneMapping = ACESFilmicToneMapping`, `toneMappingExposure` | **allowed** | Every `look3d` hex and `sky` value must be **retuned under ACES**, since today's values assume no tone mapping. `highlight` and any UI-matched colour (north marker, selection) use `toneMapped: false`, so 2D and 3D still share one orange. The `view3d-real` colour-pipeline check (hex ± 2) moves to a `toneMapped: false` quad. Exposure is a data value (`PC.data.sky` key or season value), applied by `applyLook`. |
| `MeshStandardMaterial` (`color`, `vertexColors`, `map`, `roughness`, `metalness`, `roughnessMap`, `normalMap`, `normalScale`, `envMapIntensity`) | **allowed** for the house, site and ground batches | `metalness` is 0 except the `metal` furniture key and gate/railings (≤ 0.6). Without an environment map, metals read dark, so keep them few and small. `MeshLambertMaterial` stays allowed (vegetation instances may keep it). `MeshPhysicalMaterial`: no. |
| `envMap` through the core `PMREMGenerator.fromScene` | **spike only** | Built from a small procedural gradient scene once per build, never in `applyLook`. Regenerated on context restore, cost measured on the maximum house. In F6-T1 only behind a TL-approved spike with numbers; if it is skipped, the hemisphere light carries the ambient. |
| `DataTexture` (`RGBAFormat`, `wrapS/T = RepeatWrapping`, `repeat`, `encoding`, `magFilter`, `minFilter`, `generateMipmaps`, `anisotropy`, `needsUpdate`, `dispose`) | **allowed**, preferred over `CanvasTexture` | Pixels come from a **pure core function** (rule 3.2). `CanvasTexture` only with a TL reason. |
| `Fog` (linear) | **allowed** | Colour and range set in `applyLook` only; range scales with `house.radius`. Must not show a horizon seam (rule 4.4). `FogExp2`: no. |
| `InstancedMesh` | stays | `frustumCulled = false` (A-11). More instanced kinds are allowed (window frames, posts, shrubs by type, paving stones), each counting as one mesh. `setColorAt` (r128 has it): allowed per instance (e.g. tree tint variation), and the mock must enforce its signature. |
| Transparency | **at most 2 transparent meshes** | ~~`poolWater` and one glazing mesh~~ [Edit 2026-11-22, accepting the TL's ruling: `poolWater` and the instanced contact-shadow `blobs` (alpha map, `depthWrite: false`, fixed `renderOrder`). Glazing is opaque in both tiers. A transparent glazing mesh later must replace one of the two. The mock asserts this by name on the maximum house.] No sorting of many transparent objects. |
| Shadow type | `PCFSoftShadowMap` stays | `VSMShadowMap`: no (cost and light bleeding). |
| Post-processing, SSAO, bloom, reflections, `CubeCamera` | **no** | Contact darkening is **baked**: vertex-colour darkening at wall bases and slab edges, or texture darkening. |

## 3. Textures: memory, generation and rules
1. **Budget.**
   - At most **12 textures** in the scene at once.
   - Each texture is a power of two, at most **512 × 512**. One ground or grass texture may be 1024 × 1024.
   - Total GPU texture memory ≤ **16 MB** including mipmaps (RGBA: 512² ≈ 1.4 MB, 1024² ≈ 5.6 MB).
   - Normal and roughness maps count towards all three limits.
   - The mock test sums `w × h × 4 × 4/3` over every texture of the maximum house.
2. **Generation.**
   - A pure core module (for example `core/texgen.js`) returns `{ w, h, data: Uint8Array }` from a deterministic seeded function per texture kind: plaster, brick or stone, roof tiles, timber floor, tiles, paving, grass, water ripple, normal maps.
   - It is node-tested: size, value ranges, tileability (opposite edges continuous), and determinism through a hash.
   - Generation time for all textures ≤ **150 ms in node**, measured in a unit test with best of 3.
   - Generated **once per page session**: the pixel cache lives in the module. Textures (GPU objects) are created on build and restore from the cached pixels.
3. **Colour with texture.** Textures are **detail, mostly neutral (grey)**. The colour still comes from the look tables through vertex colours or `material.color`, through `PC.three.col`. So Q10 / Q18 and the seasons stay colour changes without new textures (rule 6.3). Colour maps use `encoding = sRGBEncoding`; normal and roughness maps stay linear.
4. **Filters set explicitly** (r128 `DataTexture` defaults are Nearest with no mipmaps):
   - `magFilter = LinearFilter`;
   - `minFilter = LinearMipmapLinearFilter`;
   - `generateMipmaps = true`;
   - `anisotropy = min(4, capabilities.getMaxAnisotropy())`.
5. **UVs.** `BoxBatch` gains world-space UVs (metres / tile size from data), so textures tile at real scale across merged boxes. One texture per material means one batch per material. Batches split by **material**, not by object.

## 4. Mesh, draw-call and frame budgets (revising A-11's test line; G6's 150 stays)
1. **Meshes.** The G6 acceptance number stays **150 meshes** for the maximum house (`goals-and-stories.md` G6). The regression assertion in `budget.test` rises from **≤ 40 to ≤ 64**. Splitting batches by material (walls, floors, roof, glazing, frames, ground, paving and so on) justifies this: today 21 + 1 highlight; a realistic split is about 4 levels × 6–7 + site and ground 10–12 + vegetation 3–6 ≈ 50. An instanced mesh counts as one.
2. **Draw calls.** New assertion: `renderer.info.render.calls` for one frame of the maximum house **≤ 160**, including the shadow pass. It is measured on real r128 in `view3d-real` (Reset pose, Roof on and off). Shadow casting is limited to geometry that matters: walls, roof, furniture, trees. Ground, floors, paving, water and glazing receive only.
3. **Triangles.** ≤ **300 000** for the maximum house (`renderer.info.render.triangles`, the same frame). Vegetation detail (multi-cone trees, shrub clumps) is where this goes; it stays instanced.
4. **Horizon.** If fog is used, a pixel read at the horizon against the sky must differ by ΔE (or a per-channel difference) ≤ 3 at noon, evening and night. As ruled by the TL: the sky dome is unlit and `toneMapped: false`, with `fog: false`, and it follows the camera. The fog colour is the dome's horizon colour as raw hex (see the §0 edit). The fog range comes from the camera's maximum distance, so the house is never fogged on portrait phones. The seam check stays as stated.
5. **Shadow map.**
   - Sun shadow map **1024 on phones** (coarse pointer).
   - **2048 allowed on desktop** (fine pointer and `maxTextureSize ≥ 4096`).
   - Both are values in `PC.C.VIEW3D`.
   - The shadow camera fit (`fitShadow`) stays as it is.
6. **Pixel ratio.**
   - The cap stays `min(devicePixelRatio, 2)` (`maxDpr`).
   - Add `maxDprCoarse` (default 2) so the phone check can lower phones to 1.5 by data alone.
7. **Quality tiers** (the CD-7 phone check is still pending, so the fallback must exist before the evidence does).
   - Two tiers in data, `full` and `lite`: `lite` = no normal or roughness maps, textures at 256 or no textures, shadow map 1024, `maxDpr` 1.5, no fog, Lambert allowed.
   - The tier is chosen once at `open` from data (`PC.C.VIEW3D.tier = { coarse: 'full', fine: 'full' }`), so the phone result can switch phones to `lite` by a data change, with no code or review cycle.
   - Both tiers are mock-tested (budget, names, one shadow light). A real-r128 smoke test renders `lite` once.
   - No automatic frame-time switching in F6-T1; it is too hard to test here.
8. **Build time.** Opening or rebuilding the maximum house stays **≤ 400 ms on SwiftShader** at 1280x800, measured in `view3d-real` (best of 3) and recorded, including texture creation from the cache. The look change (`setLook`) stays at a mean < 5 ms (QA's F4-T3 check).

## 5. Lifecycle: context loss, rebuild and disposal
1. **Every rebuild** (house key change, Q10/Q18/Q19, restore) disposes every geometry, material **and texture** it created.
   - The renderer memory counters (`info.memory.geometries`, `info.memory.textures`) must return to the same values after N rebuilds.
   - My real-r128 random-operation probe (F4 review: 91 rebuilds, 18 context losses) becomes a **QA suite check**: 200 operations, geometry and texture counts constant, at most one shadow light, mesh budget, no idle frames.
2. **Context loss.** `webglcontextlost` → stop. `webglcontextrestored` → rebuild from the house model **and recreate the textures from the cached pixels**; no pixel regeneration. Test: lose, restore, the texture count equals the count before, and the frame is not blank.
3. **No GPU object outside a build.** `applyLook`, `select`, flights and tours never create or dispose geometry, materials or textures, except the existing highlight geometry per pick (A-14).

## 6. What must stay unchanged
1. **APIs:** `PC.house.build` schema (additive only; `v` bumped if fields are added, and `house.key` covers them), `PC.view3d` (every member used by `stage-3d`, the finder and the tour), `PC.cam`, `PC.tourplan`, `PC.three.tour`, `PC.three.finder` / `highlight`, `PC.debug.scene/house/cam/tourSeek`.
2. **Scene names** asserted by tests stay: `hemi`, `sun`, `world`, `groundOuter`, `groundPlot`, `groundCap`, `level-*`, `roof`, `site`, `poolWater`, `trunks`, `canopies`, `shrubs`, `highlight`. New meshes get new names. Visibility rules stay:
   - level selector hides the levels above;
   - Basement hides `groundCap`, and `groundOuter` keeps its footprint hole (B-1);
   - Roof only with "All".
   - QA's magenta leak check must stay green on every new ground or paving mesh.
3. **Look semantics (A-13):** `setLook({ hour, season })` → `PC.sky.compute` → `applyLook`, which changes light colours, intensities and position, background or sky, fog colour and range, exposure, material colours and canopy visibility only. It never creates geometry, never touches the camera, and keeps 12 h summer on load. Seasons stay colour and visibility changes: no texture swaps in `applyLook`.
4. **Finder and tour:** no behaviour change. The F5 tests stay green unmodified, except pixel thresholds as in rule 6.5. `highlight` stays visible at night (`toneMapped: false`, and checked at 22 h).
5. **Goldens and pixel thresholds.**
   - `tests/unit/fixtures/layout-golden.json` must **not** change (F6 touches no layout).
   - `sky.test` 16-row golden: may be regenerated **only** when the Designer changes `sky.js` values, and only through the documented generator. The TL review lists the changed rows with old and new values. QA updates its independent sky oracle by hand from the new table and never copies app output.
   - Pixel checks: luma order noon > evening > night, "shadows darken the ground", winter shows no canopy pixels, the magenta leak check, the colour pipeline. They must still pass. A threshold may change only with TL approval, with before and after numbers recorded in the impl review. No check is deleted.
   - New reference shots go to `docs/03-tasks/F6-T1/shots/`, next to `before/` (the same poses: 4 exteriors at noon, morning / evening / night, autumn / winter, 360 and 1280).
6. **Hooks and contract:** `tests/contract/*` unchanged unless stage-5 markup moves (hook names never change).

## 7. Tests and run time
1. **Default run ≤ 420 s** at `--jobs 3` (aaaddae baseline 398.8 s). `QA_FULL=1` ≤ 480 s. **New tests buy back their own time.**
   - New mock tests (node) are cheap and free.
   - New real-r128 checks **fold into `view3d-real.spec`** (16.9 s today; +15 s allowed) and QA's `run-f4-t3` / `run-f5-*` page loads. Anything beyond that is paid for by moving existing checks behind `QA_FULL=1`, as F5-T2 did.
   - SwiftShader is slower with PBR and textures, so every real-r128 suite's time is re-measured and `tests/durations.json` updated in the same change.
2. **Required new tests:**
   - texgen unit (size, determinism, tileability, time);
   - mock: budget on the maximum house in both tiers, texture memory sum, one shadow light, names, no GPU objects created in `applyLook`;
   - real r128: draw calls and triangles, horizon seam, `toneMapped: false` colour pipeline, context-loss texture recreation, build time;
   - QA: the random-operation leak suite (rule 5.1).
3. **Mutation proofs** (TL lists them): textures not disposed on rebuild; texture missing `sRGBEncoding`; `toneMapped: false` dropped from the highlight; a second shadow light; fog not updated by `applyLook`; tier ignored.

## 8. Publishing and the phone gate (CD-7)
- The CD-7 phone check should run on the **upgraded** build, since F6 changes exactly what a phone GPU pays for.
  - If the client has not done it yet: tell him to wait for the F6 publish (one check, not two).
  - If he has already done it on v7: F4 closes on those a–c answers as ruled. F6 still needs one short repeat of a–b on the upgraded build before its review closes. "Turning the view stays smooth" is the item that matters.
- If the phone check shows stalls: switch phones to the `lite` tier by data (rule 4.7), republish, and re-check. This is not a code change.
- Republish at the end of the batch (client rule), with the before/after shots in the batch note.

VERDICT: APPROVED (constraints set; the Designer spec and TL plan are reviewed against them)
