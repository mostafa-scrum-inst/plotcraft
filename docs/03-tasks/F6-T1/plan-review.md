# F6-T1 plan review (TL, step 3b), 2026-11-22

Reviewed: `plan.md` (FS, 7a3d02e), against:
- `cto-constraints.md` (binding; C-x.y);
- `designer-plan.md` (D-§);
- the `before/` shots;
- CD-8;
- A-9 … A-16 in `architecture.md`.

The plan is strong:
- its §0 code findings are correct; I checked §0.3 in the vendored r128, where every built-in fragment shader ends `tonemapping → encodings → fog`;
- it keeps the level batches and every model oracle byte-stable;
- it puts the phone fallback (`lite`) in data, as C-4.7 requires;
- it orders the work so that the run-time spike decides the buy-back before the code is built.

Two technical points must change (required items 1 and 2). The rest is approved with the rulings below. They go into `plan.md` before step 2. No re-review: I check them at the F6-T1a implementation review.

## Required changes

1. **Fog range from the camera's real reach, not a fixed 4 R.**
   - `limits.rMax = max(3 R, 1.2 × reset radius)`, and the Reset radius on a portrait canvas reaches about 3.6 R at 360x490 and more on narrower canvases. A fixed `near = 4 R` therefore fogs the far side of the plot at Reset on phones.
   - **Rule:**
     - `near = rMax + R`;
     - `far = min(near + fogSpanK × R, 0.9 × outerHalf)`, with `outerHalf = outerK × R / 2`; `fogSpanK` is data, default 8;
     - both are computed in `applyLook` from the current limits.
   - The resize path (which already re-fits the limits) re-applies the stored look. That creates nothing and keeps the C-2 rule ("set in `applyLook` only").
   - Test: at the narrowest aspect the sweep uses, every house vertex is nearer than `near` from the eye at Reset and at `rMax`.
2. **The sky dome follows the camera.**
   - The eye can be up to `rMax` from the origin (above 3 R on portrait), so a dome of 16 R centred at the origin crosses `camera.far = 20 R` on its far side and gets clipped.
   - **Rule:**
     - `sky.position.copy(camera.position)` before each render (a transform, not a GPU object);
     - radius = `0.9 × camera.far`;
     - `frustumCulled = false`, `depthWrite: false`, `renderOrder = -1`.
   - The dome's horizon row then sits at eye height, which is what the fog meets.
   - Test: the dome is never clipped at `rMax` on any aspect (its radius plus 0 is below `far`).

## Rulings on §11 (TL)

1. **Q-T1, two tasks with one publish: approved.**
   - F6-T1a (pipeline and world) and F6-T1b (house and garden) each get an implementation review and two green full runs.
   - One publish after T1b, so the CD-7 phone check runs once, on the upgraded build (C-8).
   - QA runs one round per phase. T1a's QA round must not wait for T1b.
2. **Q-T2, unlit highlight (`MeshBasicMaterial`, `toneMapped: false`, `fog: false`): approved.**
   - It reads `#C2410C` ± 2 at every hour, so the 22 h check holds trivially.
   - The `northNeedle` N half uses the same `mats.ui`.
   - A-14 is updated: the highlight is an unlit UI mark.
3. **Q-T3, per-vertex linear lerp for the sky gradient: approved.**
   - A-10's one-mix rule (`PC.sky.mix`, rounded sRGB) governs look-table colours: keys, seasons and table-to-table blends. Per-vertex render gradients (sky dome, glass, skirts) interpolate in linear space, as the GPU does.
   - The three sky colours themselves still come from `compute` through the one mix.
4. **Q-T4, `applyLook` setting `blobs.count`: approved.**
   - It is visibility-like and creates nothing.
   - Shrub instances come first, so `count = nShrubs` hides exactly the tree blobs.
   - Test: in winter, `count = nShrubs`, and the instance order is shrubs first.
5. **Q-T5, transparency set: approved, recorded in A-11, CTO informed.**
   - At most 2 transparent meshes: `poolWater` (post-MVP F1) and `blobs`. Glazing is opaque in both tiers. A later transparent glazing mesh must replace one of them.
   - The limit in C-2 is unchanged (2); only the named members change. I sent the CTO a note with an objection window before the T1a implementation review.
   - Mock: ≤ 2 transparent meshes, by name.
6. **Q-T6, raw fog colour as a second exception beside `scene.background`: approved** (A-10, recorded).
   - The reason is the r128 shader order: fog mixes into the encoded output.
   - The dome uses `toneMapped: false` with `col(hex)` vertex colours. Both then output the table hex, so the seam is about 0.
   - The "fog colour linearised" mutation must fail the seam check.
   - In the `lite` tier (no fog) there is no seam assertion. Its meadow skirt is judged on the shots.
     - With `vertexColors` the skirt colour is multiplied by the meadow material colour, so it cannot equal the horizon exactly.
     - Use the skirt only in `lite`. Full is fogged anyway and keeps a plain `groundOuter`, with the B-1 footprint hole unchanged.
7. **Q-T7, the "sky = raw background hex" check (F4-T1, `view3d-real`): approved in principle.**
   - It becomes "the sky sample pixel = the dome's computed colour at that elevation (from `compute` and the gradient rule) ± 3 per channel".
   - The other threshold renames in §9.4 are also approved in principle:
     - calls ≤ 160;
     - meshes ≤ 64;
     - the colour-pipeline check moves to a `toneMapped: false` quad.
   - Before and after numbers go in the T1a implementation review. No check is deleted.
8. **Q-T8, the run-time buy-back: approved, with this sequence.**
   - The spike (step 1) reports per-suite real-r128 times, draw calls, build time and the seam, before step 2.
   - From those numbers I agree the `QA_FULL=1` moves with QA, which owns them under A-16. Candidates:
     - the 200-operation leak suite on the maximum house (50 on the sample by default);
     - real-r128 checks duplicated across files, listed by QA.
   - Targets per phase: two green full runs ≤ 420 s, `QA_FULL=1` ≤ 480 s, and `tests/durations.json` refreshed.
   - FS's own real-r128 additions stay within C-7.1's +15 s in `view3d-real`.
9. **Q-T9, `PC.house.openings` in `house.js`: approved.**
   - It is additive (`v: 2`, inside the key) and within the CTO's listed diff.
   - If `house.js` crosses the 300-line lint warning, that is accepted as a warning. Do not split it into a new module: C-1.5 lists the allowed files.

## Other rulings and checks

- **Roof on at open (`roofOnOpen: true`).** Approved as the working default while the client's card is pending. The FS-owned expectations are as in §9.3. QA makes its suites independent of the default with a `roofTo(on)` helper, version-aware, as was done for `v3-roof`.
- **Mock whitelist (§9.1).** Every listed row is approved. Each is checked against the vendored r128 by the conformance part of `view3d-real`. `setColorAt(i, Color)` has its signature enforced, and `sky.position.copy` is already covered.
- **Shadow casting per C-4.2.** Approved as listed. Turning `castShadow` off on `slab` changes the cutaway look: upper floors no longer shade lower rooms. The Designer confirms it in the shots. If it reads wrong, upper slabs may cast (they are "walls/roof-like"), with the call counted.
- **Textures and world UVs.** Approved:
  - 5 textures, about 5.6 MB in full, within 12 and 16 MB;
  - `sRGBEncoding` on colour maps;
  - the blob texture linear;
  - explicit filters;
  - pixel caching in `PC.texgen`;
  - GPU textures disposed per build;
  - restore re-uploads with no regeneration (the counter test).
- **Openings as decals in `roofBatch`.** Approved technically, with the look for the Designer to judge (Q-D1). The rule table (D-A2), the head clamp and `house.v = 2` with the openings inside the key are fine. The layout golden must not change (C-6.5).
- **Contact darkening.** Items are appended (first-N-items-unchanged tests). The 5 mm proud skirt is fine for depth precision at the stated near plane.
- **Trees.** Lumps inside `canopyR` and below 4.2 m (Q-D2) are required before the T1b build. `mergeGeos` is in-house (no `BufferGeometryUtils`). `setColorAt` is seeded by position.
- **Dist.** A lint line `dist/index.html ≤ 627 KB` (C-1.3).
- **Mutations.** The §10 list is approved. Add:
  - fog range fixed at 4 R: the portrait near-plane test fails;
  - sky dome not following the camera: the clip test fails;
  - `blobs` order trees-first: the winter test fails.
- **Contract-change reader lists (A-16).** Required for `PC.sky.compute` (new fields), `PC.view3d.info()` additions, `house.v` / `house.openings`, the highlight material, and the moves from `siteBatch` to `paving` / `northNeedle` and from `roofBatch` slopes to `roofTiles`.

## Forwarded, with answers (bind FS)
- **PM** (round 15, a33ab26):
  - Q-P1: no stage-5 help line. The story text changes only if the client says yes to Roof on at open; the wording is ready. Otherwise `roofOnOpen` flips to false.
  - Q-P2: no change. After the finder or the tour, Roof stays off.
- **Designer** (designer-plan.md §8, 9c6cb51):
  - Q-D1: decals accepted. Glass sits 0.01 m out, frame bars 0.05 m out, and the sill 0.08 m out and 0.04 m thick. Add a 0.06 m reveal ring, in `frame` darkened by 35 %, at 0.02 m out. Fall back to splitting the upper band only on z-fighting.
  - Q-D2: lumps refitted inside `canopyR` 1.35 m and between 1.4 and 4.2 m in height. The data is unchanged.
  - Q-D3: a new `door` key per exterior.
  - The Designer was told that the transparency limit is 2. That supersedes the CTO's earlier note allowing 3.
- **CTO** (9030f68): Q-T5, the raw fog colour and required changes 1 and 2 are accepted. C-4.4 and §0 are corrected, and the seam check (≤ 3 per channel at noon, evening and night) stays. The test for required change 2 checks the dome against `far` at `rMax`, with `frustumCulled` false.

VERDICT: APPROVED
