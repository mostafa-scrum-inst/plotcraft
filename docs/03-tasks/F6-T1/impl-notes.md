# F6-T1a implementation notes (FS, branch f6t1)

Date: 2026-11-22. Scope: plan.md §A + steps 1–4 and 6 of F6-T1a (pipeline and world). Step 5 (the Designer's ACES
colour retune and the sky golden regeneration) is not in this commit. `roofOnOpen: true` is final (CD-9).

**Status: FS side green. The full run is not green yet:** 7 QA suites fail, and every failure is an expected contract
change listed in §6. QA owns those rows (A-16) and updates them on this branch. The two green full runs (≤ 420 s, and
`QA_FULL=1` ≤ 480 s) come after that, so the T1a impl review is not requested yet.

## 1. What changed

- **Tiers** (`PC.C.VIEW3D.tier` / `tiers`, `PC.three.pickTier`):
  - picked once, when the view first opens;
  - the full tier gets the 2048 shadow map only with a fine pointer and `maxTextureSize ≥ 4096`;
  - lite: 1024 map, no fog, textures 256, pixel ratio ≤ 1.5, the meadow skirt (TL Q-T6 / §A.4).
- **Renderer:**
  - ACES tone mapping, with `toneMappingExposure` set per look (`PC.sky.compute(...).exposure`);
  - `shadowMap.autoUpdate = false` (see §3).
- **Sky** (`core/sky.js` plus data): `skyHorizon` (= `background`), `skyMid`, `skyZenith`, `exposure`.
  - The dome (`three.skyDome`, 24 × 12) is unlit, with `toneMapped: false`, no fog, `depthWrite: false`, `renderOrder −1` and `frustumCulled: false`.
  - Its radius is 0.9 × far, and it follows the eye before every render (TL required change 2).
  - It is repainted in place by `three.skyPaint`.
- **Fog** (full tier): the raw horizon hex (second A-10 exception, Q-T6).
  - `near = rMax + R`, `far = min(near + 8 R, 0.9 × outerK × R / 2)`, set in `applyLook` and on every re-fit (TL required change 1).
- **Textures:**
  - `core/texgen.js` (pure, deterministic, tileable) and `data/textures.js` (Designer specs).
  - Uploaded by `three.texture` as DataTextures with explicit filters, mipmaps, anisotropy min(4, max), and sRGB for the colour maps.
  - Created per build and disposed with it. The pixels are cached per page session, so a context restore re-uploads without regenerating.
  - World UVs in metres via `BoxBatch({ uv: true })`.
- **Meshes:**
  - `paving` (pads, seating pad, pool rim, footpath; textured) is split out of `siteBatch`;
  - `northNeedle` (N half, unlit `mats.ui`);
  - `roofTiles` (pitched slopes) is split out of `roofBatch`;
  - street: footpath, kerb and asphalt (`asphalt` colour);
  - `sky`;
  - `slab` no longer casts.
  - Maximum house: 24 meshes, plus 1 with the highlight.
- **Highlight:** unlit `mats.ui` (A-14, Q-T2); it casts no shadow.
- **UI:** the Roof switch reflects `info().roof` when the view opens.
- **Lint:** the size line `dist/index.html ≤ 627 kB` (C-1.3). The dist is now 573.5 kB (+26.2).

## 2. Numbers

- **Maximum house on real r128, 1280x800, Reset, including the shadow pass:**
  - draw calls 24 (Roof on) / 23 (Roof off), against a limit of 160;
  - triangles 8 433 / 8 229, against 300 000.
- **Build time (C-4.8; TL ruling and CTO conditions after 17f291e).** There are two checks:
  - **The budget:** `tests/solo/build-time.mjs` measures the maximum house at 1280x800 on real r128, best of 3, from `open()` to the end of the first frame after the build. That covers geometry, materials, cached textures, their GPU upload and the 2048 shadow map.
    - `run-all` runs it only under `QA_FULL=1`, through `spawnSync` before the browser pool starts. The runner therefore enforces that nothing runs beside it, rather than relying on scheduling.
    - The `[C-4.8]` line is printed again at the end of every `QA_FULL` report.
    - Above 380 ms, a NOTE line asks for a TL review.
    - `--only build-time` runs it on its own.
  - **The regression guard:** `view3d-real` keeps a best-of-3 check of ≤ 800 ms in every run. It never counts as meeting the budget.
  - **Measured:**

    | Run | build + first frame | build alone (to `ready`) |
    |---|---:|---:|
    | solo, 4 runs | 105 / 110 / 114 / 132 ms | 6–13 ms |
    | loaded: `view3d-real` alone | — | 324–402 ms |
    | loaded: full run 1 | — | 590–720 ms |

    In `view3d-real` three pages render side by side in one browser, and in the full run three browser files also share the 4 cores.
- **Seam** at 12 / 17.5 / 22 h, phiMax and rMax, both viewports: 0–1 per channel. Both sides of the horizon equal the horizon hex within ±1.
  - Fully fogged ground equals the raw horizon hex in 20 of 25 columns at 1280 and 16 of 25 at 360. The other columns have the house or trees in front.
- **Sky pixel** at about 16° elevation: equal to the dome gradient, ±0.
- **Shadows on demand** (real): hiding the upper storey brightens its former shadow by 63 (1280) / 79 (360) luma.
  - A forced extra shadow update after setLook, a flight or a Roof switch changes 0 pixels.

**Per-suite times** (seconds, real-r128 files, from the full run at `--jobs 3`):

| Suite | before (durations.json, 75775b7) | spike (alone, all on, autoUpdate on) | T1a (full run 1) |
|---|---:|---:|---:|
| qa f4-t1 | 61.2 | 56.5* | 73.0* |
| qa f4-t2 | 27.7 | 48.5 | 37.3* |
| qa f4-t3 | 45.9 | 59.0* | 51.3* |
| qa f5-t1 | 56.5 | 81.8 | 48.5* |
| qa f5-t2 | 44.4 | 62.8 | 37.4* |
| qa f5-t3 | 17.6 | 32.3 | 21.5 |
| e2e view3d | 8.2 | 32.1* | 7.7 |
| e2e view3d-real | 16.9 | 26.0* | 30.1 |
| **total** | **278.4** | **399.0** | **306.8** |

\* The suite failed, so the time may be short.

- **Full run 1 wall time: 418.5 s,** with 7 QA suites failing.
- Most of the saving from spike to T1a comes from the on-demand shadow map: camera-only frames no longer re-draw the 2048 map. The QA_FULL moves account for the rest.
- `view3d-real` grew by about 13 s for the new checks (TL allowance: +15 s).
- The QA suites will change once QA updates its rows, so the gate numbers come from the two green runs.

## 3. On-demand shadow map (TL Q-T8 follow-up, CTO conditions)

- **`shadowsDirty()`** sets `renderer.shadowMap.needsUpdate` and counts `info().shadowUpdates`. It runs:
  - on build;
  - on every `applyLook`, including a re-fit (resize) and the season canopy visibility;
  - on the level selector and the Roof switch (`applyVisibility`, so the finder and tour forcing them are covered too);
  - on a context restore (which rebuilds).
  - A tier switch only ever happens at open, before the build.
- **No update** for orbit, zoom or pan, flights, tour frames, or the highlight.
- **Tests:**
  - `tests/three/realism.test.mjs`: each trigger requests exactly one update, and an orbit or flight frame requests none.
  - `view3d-real`: there is no stale map after setLook, a flight or a Roof switch, and the upper-storey shadow pixel check runs.

## 4. Checks moved to `QA_FULL=1` (TL Q-T8, agreed with QA)

- `view3d.spec`: the Roof switch by touch (old lines 84–92). The default run now checks instead that the view opens with the Roof on, and the Space key test runs off → on.
- `view3d-real.spec`: context loss and restore (old 195–205). The default run still covers it through QA f4-t2-view E, f4-t3-view A, and `scene.test` (texture re-creation).
- The loop-idle block stays in the default run (QA).
- QA implements its own rows.

## 5. Mutation proofs (each applied once, reverted; `tests` = node three tests, `real` = view3d-real)

| Mutation | Caught by |
|---|---|
| level shadow trigger dropped | three: on-demand test; real: 0 updates, stale map after Roof switch |
| shadow update missed after applyLook | three: on-demand test; real: stale map after setLook (1 046 / 1 648 px) |
| textures not disposed | three: textures (20-rebuild leak), context loss |
| `encoding` dropped from colour maps | three: textures |
| `toneMapped: false` dropped from `mats.ui` | three: finder highlight, north needle |
| `toneMapped: false` dropped from the sky | three: ACES/dome test; real: seam ±38, sky pixel |
| fog colour linearised (`col()`) | three: mock colour audit (5 tests); real: fogged ground 0 of 25 columns |
| fog fixed at 4 R / 12 R | three: TL required change 1 |
| dome not following the camera | three: TL required change 2 |
| sky attribute recreated in applyLook | three: ACES/dome test (geometry attribute identity) |
| tier ignored (always full) | three: tiers, fog/lite, lite skirt |
| second `castShadow` light | three: G6 final, tiers, finder rider, controls tests (mock audit) |

## 6. Contract changes and readers (A-16)

- **`PC.sky.compute`** gains `skyHorizon`, `skyMid`, `skyZenith`, `exposure`; each key in `data/sky.js` gains `skyMid`, `skyZenith`, `exposure`.
  - Readers: QA f3-t3-data ("sky: key lists": the key-key set), Designer `verify/golden.mjs`, `tests/unit/sky`, `tests/unit/data-tables`.
- **`PC.data.siteColors`** gains `asphalt`, and `groundOuter` is now `#8E9E6A` (meadow).
  - Readers: QA f3-t3-data (12-key list), QA f4-t3 oracle (groundOuter).
- **`PC.view3d.info()` / `PC.debug.scene()`** gain `tier`, `textures`, `shadowUpdates`; `roof` is true on open (`roofOnOpen`, CD-9).
  - Readers: QA f1-t1 static defaults (v3-roof checked), f4-t1-view A/G, f4-t2-view A (Roof switch "off on open"), f5-t1/f5-t2 (meshes).
- **Shadow map** is 2048 on fine pointers (it was ≤ 1024).
  - Reader: QA f4-t3-view A ("one shadow light (map ≤ 1024)").
- **Shadow map on demand:** a test that toggles `castShadow` itself must set `renderer.shadowMap.needsUpdate = true`.
  - Reader: QA f4-t3-view D (17.5 h tree shadows read 0 px).
- **Mesh counts:** the maximum house has 24 meshes (25 with the highlight); the sample has 18.
  - Readers: QA f4-t2-model B, f4-t2-view E, f4-t3-view B, f5-t1-view A, f5-t2-view B.
- **Highlight material:** MeshBasic, `toneMapped: false`, shared `mats.ui`.
  - Readers: the finder, tour and highlight pixel checks (orange is now exact, also at night).
- **`siteBatch` → `paving` / `northNeedle`:** pads, seating pad, pool rim, footpath, and the N needle half moved.
  - Reader: QA f4-t2-model S / P (pads, rim, needle).
- **`roofBatch` slopes → `roofTiles`.**
  - Reader: QA f4-t2-model (the roof batch compare).
- **`house.v`:** unchanged in T1a.

## 7. Not committed

`docs/03-tasks/F6-T1/verify/retune.mjs` (Designer's, untracked), and the QA shot and metrics files rewritten by test runs (restored).
