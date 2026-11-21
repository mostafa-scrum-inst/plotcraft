# F4-T3 plan: vegetation, time of day, seasons (FS)

Date: 2026-11-21. Owner: FS. Status: **draft for the TL plan review.**

Sources:
- F4-plan "F4-T3" (scope, files, QA list);
- TL routing in `docs/03-tasks/F4-T2/outcome-review.md`, items 1–7;
- architecture A-9 (scatter, exclusions), A-10 (scene, colour rule, whitelist), A-11 (instancing, budget, shadows) and
  A-13 (sky model, verbatim);
- goals-and-stories round 11: F4-S1 vegetation and F4-S3 re-read with no text change; the default-camera decision;
- `camera-decision.md` (PM + Designer: Reset stays on the street side, option (a); a possible one-line hint);
- `designer-plan.md` (Designer, F4-T3 colour and vegetation tables): **pending.** Where this plan needs a value from it
  (sizes, colours, the hint line), it uses the F4-T2 Designer plan §4 "Vegetation (for planning)" and the existing
  `PC.data.sky` until that lands;
- the F4-T2 outcome §3 APIs.

## 1. Scope

- Vegetation:
  - the seeded scatter `PC.scatter.vegetation` fills `house.site.trees` / `shrubs`;
  - instanced `trunks`, `canopies` and `shrubs` in the site group.
- `PC.sky.compute`, exactly per A-13.
- `three/look.js` `applyLook`. It recolours and moves the lights only: no rebuild and no camera change. It also refits
  the shadow camera.
- Stage 5 Light tab enabled: time slider, four presets, season select, the "approximate" label.
- The final G6 budget assertion, with looks applied.
- Not in scope:
  - the default camera (option (a), so no A-12 change; the hint line only if the Designer's shots ask for it, §7);
  - the room finder and tour (F5);
  - the lint length debt (`layout.js`, `stage-plans.js`; neither file is opened here).

## 2. Vegetation model (`core/scatter.js`, `PC.scatter`)

`PC.scatter.vegetation(site, extras, seed)` returns `{ trees: [[u, v, s], ...], shrubs: [[u, v, s], ...], area }` in
frame L. `area` is the nominal covered area actually placed. `PC.house.build` calls it and copies the result into
`house.site`.

1. **Seed.** FNV-1a 32 of the plot points rounded to 1e-6, the street edge and the vegetation % gives a mulberry32
   PRNG. The same state gives the same output: byte-identical JSON, unit-tested. The scatter reads only the site model
   (which is memoised; its key already covers the points, street edge, setbacks, footprint %, parking, pool,
   vegetation % and, since F4-T2, `extras`), so **the site memo key needs no new input.** The house key changes with the
   tree list automatically (FNV of the model).
2. **Candidates.**
   - A 1 m grid over the plot bbox, each point jittered by ±0.35 m in u and v from the PRNG, in a fixed row-major order.
   - A point is kept when it is inside the plot and at least 0.7 m from every edge (A-9; `distPointSeg`).
   - The kept points are then shuffled with the PRNG (Fisher–Yates).
3. **Exclusions** (axis-aligned rectangles in L, tested on the item centre). They reuse `blocked()` from
   `site-outdoor.js`, exported as `PC.site.blocked(site, extras)`.
   - Both kinds:
     - footprint + 1 m;
     - `pathStrip` (street to door, widened to the gate);
     - parking;
     - pool + `POOL_CLEAR`;
     - **new:** the seating pad + 0.3 m;
     - **new:** the north needle's circle, `L / 2 + 0.3` (Q3).
   - Trees: footprint + 1 m **+ the canopy radius at its largest scale**, 1.35 × 1.15 = 1.5525 m (TL ruling F4-T2
     plan review; A-9).
   - Shrubs: footprint + 1 m.
4. **Spacing.** An accepted item blocks others nearby, so that instances do not interpenetrate:
   - tree to tree: centres ≥ 2.4 m apart;
   - shrub to tree: centres ≥ 1.4 m apart;
   - shrub to shrub: centres ≥ 1.0 m apart.

   A uniform hash grid of 2.5 m cells keeps this O(n).
5. **Selection.**
   - Walk the shuffled candidates. Place trees until the tree area (6 m² each) reaches `0.6 × veg.area` or 120 trees.
   - Then walk the remaining candidates for shrubs (1.5 m² each) until the total reaches `veg.area` or 200 shrubs.
   - **Stop rule:** add an item only while `placed + itemArea / 2 ≤ target`, so placement rounds to the nearest
     item (cover within 20 % on the sample, A-9 test).
   - Per-instance scale `s` is 0.85–1.15 from the PRNG (Designer).
6. **Shortfall.** When the exclusions leave too little room, `area < veg.area`. No new warning is planned (Q2).
   `site.veg.reduced` already covers the budget clamp, and the model gets `vegPlaced` (m²) so QA can see it.
7. **Performance.** A 100 × 100 m plot at 80 % has about 10 000 candidates. The scatter must stay within the house-build
   budget (≤ 50 ms for the maximum house, best of 3; unit test).

## 3. Vegetation meshes (`three/build-site.js`)

- Three `THREE.InstancedMesh` objects in the site group, named `trunks`, `canopies` and `shrubs`, each with
  `frustumCulled = false` (A-11).
- Geometry (Designer F4-T2 §4, pending a confirmation in the F4-T3 designer plan):
  - **trunk:** `CylinderGeometry(0.12, 0.12, 2.6, 8)`, base at Y 0;
  - **canopy:** `ConeGeometry(1.35, 2.8, 10)` from Y 1.4 to 4.2;
  - **shrub:** `ConeGeometry(0.7, 0.8, 8)`, base at Y 0.
- Each instance matrix is compose(position, identity, uniform scale `s`). The base Y is scaled with the instance, so the
  canopy runs 1.4 s to 4.2 s.
- Materials: `mats.trunk` (`siteColors.trunk`), `mats.canopy` and `mats.shrub` (season colours via `applyLook`).
  Built at summer noon, so the first frame equals the current F4-T2 frame plus the trees.
- Shadows: vegetation casts and does not receive (A-11).
- A count of 0 gives no mesh for that kind, like an empty batch, so the sample with vegetation at 0 % keeps 12 meshes.
  The materials always exist, so `applyLook` never branches on presence.
- Mesh budget:
  - maximum house 18 + 3 = **21**;
  - the sample at its default vegetation % is 12 + 3 = 15;
  - `≤ 40` is asserted (TL).
- Mock (`tests/three-mock.js`, FS-owned): add `InstancedMesh` (count, `setMatrixAt`, `instanceMatrix.needsUpdate`),
  `CylinderGeometry`, `ConeGeometry` and `Matrix4.compose`, with signatures enforced, plus the A-10 whitelist entries in
  the same change.

## 4. Sky model (`core/sky.js`, `PC.sky`)

- `PC.sky.compute(hour, season, northDeg, tables)` follows A-13 **exactly**:
  - sun path `a = (hour − 6) / 12 · π`, `s = e cos a + (y sin E − n cos E) sin a`, with
    `n = (sin N, 0, −cos N)` in T and `e` = n turned 90° clockwise seen from above;
  - moon `(−s.x, |s.y|, −s.z)` when `s.y < 0`;
  - direction Y clamped to at least 0.15, then renormalised;
  - key-frame lerp, per-channel sRGB for colours and linear for numbers;
  - `day = min(1, K.sunI / noonKey.sunI)`;
  - tint blend on `sunColor`, `hemiSky` and `background` with `tintAmount · day`;
  - `hemiGround = mix(K.hemiGround, season.ground, groundBounce · day)`;
  - intensities unchanged;
  - `canopyColor`, `canopyVisible`, `shrubColor` and `groundColor` from the season.
- It returns hex strings and numbers, with no THREE.
- **The colour mix moves to core** as `PC.sky.mix`, with the same code as `three.mixHex`, which becomes an alias so
  that one rule exists once (A-10).
- **Continuity with F4-T1.** `compute(12, 'summer', N)` equals `three.noonLook()` / `noonSunDir()` exactly. Both are
  then removed, and `lights()` calls `compute` through `applyLook`. A unit test pins that the opening frame is
  unchanged: same light colours, intensities, position and background as before.
- **Hour domain.** `hour` is in [0, 24]. 24 equals 0 (the keys' last frame equals the first). Values outside are
  clamped.

## 5. Look (`three/look.js`) and scene hooks (`three/scene.js`)

- `PC.three.applyLook(S, look, house)` writes:
  - sun and hemisphere colours (`col`) and intensities;
  - the sun position `target + sunDir × sunDist × radius` (A-13 2.5);
  - `scene.background` (raw hex);
  - `mats.canopy`, `mats.shrub` and `mats.ground` colours, with `groundOuter` and `trunk` unchanged;
  - `canopies.visible = canopyVisible`;
  - the shadow camera fit (below).

  It **creates and disposes nothing**: no geometry, material or mesh. It never touches the camera, pose or limits. It
  marks the frame dirty only.
- **Shadow fit (TL item 4).**
  - Content box in T:
    - the footprint at full house height;
    - parking and canopy;
    - pool and rim;
    - seating;
    - each tree's canopy circle (radius × s, Y to 4.2 s);
    - shrubs.
  - The boundary wall is excluded (Q4).
  - The box's 8 corners are projected into the light's view (a `lookAt` basis from sunDir). The orthographic `left`,
    `right`, `top` and `bottom` are fitted to them plus a 0.5 m margin; `near` / `far` come from the projected depth.
  - The half-size is capped at `shadowR × house.radius` (the existing A-11 cap, so texels stay useful on large plots).
  - The fit runs on build and on every `applyLook`, because the light direction moves with the hour. There is still one
    shadow light and the map stays at 1024.
- **`PC.view3d.setLook({ hour, season })`** stores the session look, calls `applyLook` and invalidates.
  - `build()` (a Q18 / Q19 rebuild or a context restore) re-applies the stored look, so a rebuild never resets the time.
  - `PC.debug.scene()` gains `look` for tests.
- **G6 budget test** (`tests/three/budget.test.mjs`). It runs on the maximum house: 40 rooms, everything on, vegetation
  at 80 % on a 100 × 100 m plot so the caps are reached.
  - Apply 4 seasons × the 4 presets plus 0 / 6 / 18 / 24 h.
  - After each `applyLook`:
    - meshes ≤ 40;
    - geometry, material and mesh identities and counts unchanged;
    - exactly one shadow light with a map of 1024 or smaller, and a pixel ratio of 2 or less;
    - camera position and target unchanged;
    - `applyLook` under 5 ms.

## 6. UI (`ui/stage-3d.js`)

- Remove `v3-time`, the four presets and `v3-season` from `LATER`. Room finder and tour stay disabled (F5).
- **Slider** (0–24, step 0.25): `input` calls `setLook`, and the frame redraws on demand. The `<output>` shows HH:MM,
  e.g. 17.5 → "17:30", 24 → "24:00".
- **Presets** 8 / 12 / 17.5 / 22: these set the slider and the look. The matching preset gets `aria-pressed="true"`.
  The icon buttons keep 44 px targets.
- **Season select:** `change` calls `setLook`.
- **Label:** "approximate — not real solar data" stays as it is in the markup.
- **Session state** (A-4): hour and season survive leaving and returning to stage 5 in the session, like level and
  Roof. A page load opens at 12:00 in summer. They are not in the draft (Q5).
- Orbit, zoom and pan during a slider drag raise no errors. Neither changes the other: the look never moves the camera,
  and the camera never changes the look.
- **Hint line** (`camera-decision.md`): only if the Designer's F4-T3 sample shots at Reset show the pool and seating
  completely hidden. Then one line, "Drag to turn the model and see the garden.", is added to the View pane as a
  static `pc-v3note`. No camera change.

## 7. QA markers (version-aware, as was done for `v3-roof`)

- **`PC.three.applyLook` exists.** f4-t1-view drops the Light hooks from its LATER set and from the "light" tab
  disabled-look check (lines 346 / 371). QA then expects them enabled.
- **`PC.scatter.vegetation` exists.** QA's F4-T2 model suite stops expecting `trees` / `shrubs` to be empty, and the
  site-group mesh names gain `trunks` / `canopies` / `shrubs` when there are any.
- **`PC.sky.compute` exists.** QA writes its own A-13 oracle.
- Opening frame: unchanged at 12:00 summer, so QA's F4-T1 real-r128 pixel checks stay valid. The exception is a scene
  with vegetation, where trees are new. The sample's default vegetation % should be checked against the F4-T1 shots
  (Q6).

## 8. Tests (FS)

- **`tests/unit/scatter.test.mjs`:**
  - sample cover within 20 % of `veg.area`;
  - no item centre in any exclusion, including the seating pad, needle and path strip; trees use the canopy clearance;
  - every item 0.7 m or more inside the plot;
  - spacing respected;
  - deterministic: two calls and two states built separately are deep-equal;
  - the caps on 100 × 100 m at 80 % (120 / 200);
  - 0 % gives empty lists;
  - the maximum-house build stays under 50 ms with vegetation.
- **`tests/unit/sky.test.mjs`:**
  - east at 6, the highest point at 12 with elevation = `elevMax` pointing away from north, west at 18, for each season;
  - continuity over 0–24 in 0.25 h steps, with jumps of 20° or less except at the documented sun/moon hand-over;
  - north + 90° rotates `sunDir` by 90° about Y (1e-9) at 12 hours and 4 seasons;
  - noon intensity > evening > night;
  - night `hemiI` ≥ 0.25 and night `sunI` ≤ ¼ of noon;
  - a winter night background equals the key background (the `day` factor);
  - four seasons give four distinct looks; winter hides canopies and whitens the ground; autumn canopy ≠ summer;
  - `compute(12, 'summer')` equals the F4-T1 noon look;
  - presets map to 8 / 12 / 17.5 / 22.
- **`tests/three/vegetation.test.mjs`:**
  - instance counts equal the model counts;
  - all three meshes have `frustumCulled === false`;
  - matrices place the canopy base at 1.4 s;
  - cast without receive;
  - vegetation at 0 % gives no instanced meshes.
- **`tests/three/look.test.mjs`:**
  - `applyLook` changes the sun position, colours and background;
  - no create or dispose (counted in the mock);
  - camera pose identical;
  - canopy visibility by season;
  - `groundOuter` unchanged;
  - the shadow box contains every content corner in light space at 6 / 12 / 18 h, and is capped;
  - a rebuild keeps the stored look;
  - opens at 12 / summer.
- **`tests/three/budget.test.mjs`:** as in §5.
- **`tests/e2e/view3d-look.spec.mjs`** (mock):
  - slider by touch at 360 px and by keyboard (arrows step 0.25, Home 0, End 24);
  - presets by tap and Space;
  - season select;
  - the label text;
  - HH:MM output;
  - leave stage 5 and return: the look is kept;
  - no console errors while orbiting during slider input.
- **`view3d-real` additions** (real r128): mean luminance at noon > evening > night; winter shows no canopy pixels; one
  shadow light.
- **Mutations planned:**
  - no `day` factor;
  - moon not mirrored;
  - north sign;
  - the tree clearance without the canopy radius;
  - the seating pad not excluded;
  - `frustumCulled` left true;
  - `applyLook` rebuilding;
  - the rebuild resetting the look;
  - the shadow box not refitted on a time change;
  - presets off by one.
- **Run time.** The full run was 414.5 s against the 420 s target. New browser work goes into one small spec file
  (under 30 s at `--jobs 3`, so off the critical path) and the real-r128 additions stay under 10 s (Q7).

## 9. Files

- **New:** `src/js/core/scatter.js`, `src/js/core/sky.js`, `src/js/three/look.js`.
- **Changed:**
  - `core/house.js` (trees, shrubs, `vegPlaced`);
  - `core/site-outdoor.js` (export `blocked`);
  - `three/build-site.js` (instanced meshes);
  - `three/scene.js` (`setLook`, materials, `lights` → `applyLook`, the noon helpers removed);
  - `three/util.js` (`mixHex` alias);
  - `ui/stage-3d.js`;
  - `src/manifest.json`;
  - `tests/three-mock.js`;
  - the A-9 / A-10 / A-11 / A-13 doc notes.
- **Tests:** as in §8.
- `tests/qa` is not touched.

## 10. Steps

1. `sky.js` and its unit tests, plus the F4-T1 noon equality.
2. `scatter.js` and its unit tests, and the house model.
3. Mock extensions, instanced meshes and their three tests.
4. `look.js`, `setLook` and the shadow fit, with the look and budget tests.
5. UI and the e2e spec, plus the real-r128 additions.
6. Mutations, the focused run, impl notes and the TL implementation review.

## 11. Open questions for the TL

1. **Boundary clearance for trees.** At 0.7 m from the boundary (A-9) a 1.35–1.55 m canopy at Y 1.4–4.2 m overhangs
   the 1.2 m wall and the neighbour's plot by up to 0.85 m. "Canopies stay inside the wall" would need about 1.55 m
   (plus 0.2 m of wall) for trees. **Proposal:** trees ≥ 1.75 m from the boundary and shrubs 0.7 m, with A-9 updated.
2. **Shortfall.** When the exclusions leave room for less than the effective %, should there be a warning?
   **Proposal:** no warning. Record `vegPlaced` in the model and let `veg.reduced` keep covering the budget clamp.
   (PM to confirm if a visible message is wanted.)
3. **Extra exclusions not in A-9:** the needle circle (`L / 2 + 0.3`, so a tree does not hide it) and the seating pad
   + 0.3 m. Also: should trees clear parking and the pool by their canopy radius too? The carport canopy at 2.4 m
   would otherwise intersect a tree canopy. **Proposal:** both added for trees, parking and pool by the canopy radius.
4. **Shadow fit scope.** Should the 1.2 m boundary wall be in the fitted box? Including it makes the box the whole
   plot. **Proposal:** exclude it, refit on every `applyLook` in light space, and keep the `shadowR × radius` cap.
5. **Session look.** Keep hour and season across leaving and returning to stage 5 (like level and Roof), reset on page
   load, not in the draft. Confirm.
6. **Sample vegetation and the F4-T1 pixel checks.** The sample's default vegetation % (25 %) now adds trees to the opening
   frame. Do QA's F4-T1 real-r128 signatures become marker-gated (`PC.scatter`), or should the sample state used there
   pin vegetation at 0 %?
7. **Run-time headroom.** There are 5.5 s to the 420 s target. Is one new e2e spec plus about 10 s of real-r128 checks
   acceptable, or should the look checks go into `view3d.spec` to avoid a new browser process?
8. **Removing `noonLook` / `noonSunDir`.** No QA suite calls them (grep of `tests/qa`). **Proposal:** remove both once
   `compute(12, 'summer')` is proven equal to them in a unit test.
