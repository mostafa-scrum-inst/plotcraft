# F4-T3: implementation notes (for the TL implementation review)

Owner: FS. Branch `f4t3` (worktree `/home/user/plotcraft-f4t3`), on 6a5445c. Not merged.

Sources:
- `plan.md`, amended in §0 per `plan-review.md` (required items 1–6, rulings Q1–Q8);
- `designer-plan.md`;
- `camera-decision.md`;
- PM round 11 (shortfall warning; goals-and-stories, copied from the main tree's working copy).

Commits:
1. Step 1 (TL Q8, first commit): plan amendments, `PC.sky` with the Designer goldens and the literal F4-T1 noon
   goldens, while `noonLook` / `noonSunDir` still existed; `PC.data.vegetation`.
2. The rest: scatter, warning, meshes, look, UI, tests, docs; the noon helpers removed.

## 1. What was built

- **`core/sky.js`.**
  - `PC.sky.compute(hour, season, northDeg, tables)` follows A-13: sun path, moon mirror, Y ≥ 0.15 (the horizontal
    part is rescaled so the vector stays unit).
  - Colours use two rounded steps (key lerp, then season blend) with `PC.sky.mix`; `three.mixHex` is an alias.
  - It reproduces the Designer's 16-row table exactly, and `compute(12, 'summer', N)` equals the old noon helpers'
    literal goldens (N = 0 and 90).
  - Also `PC.sky.PRESETS` (8 / 12 / 17.5 / 22) and `DEFAULT`.
- **`PC.data.vegetation`** in `look3d.js` (Designer §1), with its schema test in `data-tables.test.mjs`. The Designer
  may want to own or adjust it.
- **`core/scatter.js`: `PC.scatter.vegetation(site, extras)`.**
  - Seed: FNV of the plot points (1e-6) and the street edge.
  - Candidates: a 1 m jittered grid with 3 draws per node, so the order depends on the plot only. Shuffled.
  - Trees: centres at least `canopyR × scale[1] + 0.2` (1.75 m) from every edge. They clear footprint + 1 m + clr,
    parking + clr and pool + POOL_CLEAR + clr.
  - Shrubs: at least 0.7 m from every edge, and clear of the plain A-9 rectangles (`PC.site.blocked`, now exported
    and returning fresh rectangles).
  - Both kinds: the path strip, the seating pad + 0.3 m and the needle circle L / 2 + 0.3.
  - Spacing 2.4 / 1.4 / 1.0 m.
  - Selection: trees to 60 %, then shrubs to the total, each rounded to the nearest item. Caps 120 / 200.
  - **It runs inside `PC.site.analyse`** (after the vegetation budget), so `site.trees`, `site.shrubs` and
    `site.vegPlaced` exist on stage 2. The memo key is unchanged, since the scatter reads only the site.
    `PC.house.build` copies the three values.
- **Shortfall warning: shown on stage 2** (the TL's choice point; placement is core, so stage 2 works).
  - `veg-short` (warn, q 4, the PM text with {a} / {p} / {q} following the unit). It shows with the F2-S3 warnings and
    again on Floor plans like the others.
  - Condition: `vegPlaced < 0.8 × min(veg.area, capArea)`, with `capArea` = 1 020 m² (the A-9 caps). **Departure to
    confirm:** without the cap term, every large garden would warn, because the 120 / 200 item caps are not "the
    building, parking and pool". The PM text names those, so I left the caps out of the shortfall. The 100 × 100 m
    plot at 80 % reaches the caps with no `veg-short`.
  - It never shows at 0 %. The sample shows no warning: 145.5 of 146 m² placed, 100 %.
- **Shortfall frequency** (TL Q2 report), with `vegPlaced / veg.area` at Q4 10 / 25 / 40 %:

  | Plot | 10 % | 25 % | 40 % |
  |---|---|---|---|
  | sample | 100 % | 100 % (default) | 96 % |
  | 30 × 40 rectangle | 100 % | 100 % | 100 % |
  | rotated | 100 % | 100 % | 92 % |
  | pentagon | 100 % | 100 % | 100 % |
  | trapezoid | 100 % | 100 % | 98 % |
  | 16 × 18 m at 50 % | 99 % | 50 % **warns** | 31 % **warns** |

  - That is 2 warnings in 15 cases, both on the tight 16 × 18 m plot.
  - The sample warns from 50 % up (77 %; 64 % at 60 %).
- **Meshes (`three/build-site.js`).**
  - InstancedMesh `trunks`, `canopies` and `shrubs`, built from the table (6 / 8 / 7 segments). Each instance matrix is
    the T position at Y = base × s with uniform scale s.
  - `frustumCulled = false`; they cast shadows and never receive.
  - A kind with no items gets no mesh and no geometry.
  - Materials `trunk` (fixed), `canopy` and `shrub` (season).
  - Meshes: the sample has 15 (12 + 3), the maximum house 21.
- **`three/look.js`.**
  - `applyLook(ctx, look)` sets:
    - light colours and intensities;
    - the sun position;
    - the raw background;
    - the ground, canopy and shrub colours;
    - canopy visibility;
    - the shadow fit.

    It creates and disposes no geometry, material or mesh, and never touches the camera.
  - `shadowFit(house, eye, dir)` fits the content box in light space: the footprint up to the roof top, parking 2.4 m,
    pool + rim, seating, and every tree and shrub at its scale. The wall is left out. Margin 0.5 m, capped at
    `shadowR × radius`. The fit writes only the six fields plus `updateProjectionMatrix`.
- **`three/scene.js`.**
  - `PC.view3d.setLook` / `look()` hold the session look (Q5). `build()` re-applies it, which covers a rebuild and a
    context restore.
  - The look lives in the view, not the store, so a store replace keeps it, and a page load gives 12:00 summer.
  - `noonLook` / `noonSunDir` are removed. No QA suite calls them (grep).
- **UI (`ui/stage-3d.js`).**
  - `LATER` is now room finder and tour only.
  - The slider (input), presets (click) and season (change) call `setLook`. The readout is HH:MM (00:00–24:00).
  - `aria-pressed` is on the preset whose hour equals the current hour; Noon is pressed on open.
  - `pc-range--sky` is on `v3-time`, with the gradient CSS in `44-stage-3d.css` (stops = sky keys, tested). That is
    the Designer's markup, which I wrote from Designer §3.
- **Mock conformance (item 6).** InstancedMesh (`count`, `setMatrixAt`, `instanceMatrix.needsUpdate`, O3D
  `castShadow` / `receiveShadow`), `CylinderGeometry`, `ConeGeometry`, `Matrix4.compose` and the shadow-camera fields
  were already whitelisted and checked against the vendored r128 by `view3d-real` (factories and the maths probe)
  since F4-T1, so no whitelist change was needed. `setColorAt` is not whitelisted.

## 2. Tests

- **New:**
  - unit: `sky` 9, `scatter` 7;
  - three: `vegetation` 3, `look` 4, `budget` 1;
  - e2e: `view3d-look.spec` 26 (360x640 touch and 1280x800 mouse/keyboard, one load each);
  - `data-tables` +2 (the vegetation table and the slider stops = keys).
- **Updated:**
  - `scene.test`: 15 / 21 meshes, 7 materials, the noon goldens;
  - `site` (group children), `interior` (21), `house` (trees copied), `validate` (13 rules; the 20 × 20 m case now
    also has `veg-short`);
  - `view3d.spec`: DISABLED = room and tour; the Designer muted-style check moved to the room select and Tour, and now
    also asserts that the Light controls are live;
  - `view3d-real`: looks in the existing loads (+0 launches). It checks:
    - mean luma noon > evening > night;
    - 17.5 h vegetation shadows darken the frame;
    - a winter frame equals the frame without canopies, while a summer frame does not;
    - one shadow-casting directional light.

    Total 46/0 in about 6 s. `--shots` now writes `docs/03-tasks/F4-T3/shots/`: 4 exteriors at noon at 1280 px, and
    morning, evening, night, autumn and winter at both viewports, set through the Light controls.
- **Mutations: 20, all caught.** Two of them first survived and were caught after I added tests:
  - moon not mirrored (new exact night-direction test);
  - shortfall threshold at 0.6 (new test at the 80 % line: sample 50 % = 77 % warns, 40 % = 96 % does not).

  The full list:
  - no day factor;
  - moon not mirrored;
  - north sign;
  - single rounding (floats with one round; the golden table catches it);
  - Evening preset at 17;
  - tree clearance without the canopy;
  - seating pad not excluded;
  - tree boundary distance at 0.7 m;
  - a hard-coded clearance (a new test changes `canopyR` in the table);
  - the vegetation % in the seed;
  - shortfall threshold at 0.6;
  - `frustumCulled` true;
  - canopy base wrong;
  - `setLook` rebuilding;
  - a rebuild resetting the look;
  - the shadow box not refitted;
  - `groundOuter` recoloured;
  - canopy always visible.
- **Budgets.**
  - Scatter on 100 × 100 m at 80 %: about 22–42 ms cold (≤ 50 ms, best of 3 asserted).
  - Maximum house build including site and scatter: < 50 ms (asserted).
  - `applyLook`: mean < 5 ms over 32 looks on the maximum house with the caps reached. The first version asserted
    the worst single call and failed once at 15 ms during a parallel full run (JIT); the mean is the stable form.
- **Full run** (`node build.mjs && node tests/run-all.mjs`, `--jobs 3`): see §4.

## 3. For QA (version-aware markers)

- **`PC.three.applyLook`:** `tests/qa/f4-t1-view.mjs` lines 346 / 371 must drop the Light hooks from LATER and from
  the "light" disabled-look check; they are live now.
- **`PC.scatter`:** QA's F4-T2 model suite expected empty `trees` / `shrubs`. The site group now also has `trunks`,
  `canopies` and `shrubs`, the sample has 15 meshes and the maximum house 21. The F4-T1 shell and colour signatures see
  trees in the sample (TL Q6: a QA fixture at vegetation 0 %, or yard masks).
- **`PC.validate.RULES['veg-short']`:** a new warning. QA suites that list exact warnings on states with an asked
  vegetation % the yard can't hold will see it, e.g. f2-t1-site, f2-t2-questions and stage2kit, which mention
  `veg-reduced`. It can show together with `veg-reduced`.
- **Removed:** `PC.three.noonLook` and `noonSunDir`. QA does not use them.

## 4. Full run

Measured below at `--jobs 3`. If it is over 420 s, the look checks fold into `view3d.spec` (TL Q7).
