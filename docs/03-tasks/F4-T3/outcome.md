# F4-T3: vegetation, time of day, seasons (outcome)

Owner: FS. Status:
- **PASSED QA** (`qa-report.md`): no bugs, full run 393.8 s at `--jobs 3`, 25 of 26 QA mutations caught. The one
  survivor is equivalent: real r128 already sets `frustumCulled = false` on an InstancedMesh (O-2).
- TL implementation review **APPROVED** (`impl-review.md`). The finding-7 addendum (candidate memo) is closed.
- Plan **APPROVED with required edits** (`plan-review.md`). The edits are applied in `plan.md` §0.
- Commits on `f4t3`:
  - 0e844e1: step 1 (sky model and goldens before the noon helpers were removed; vegetation table);
  - d8877e5: scatter, warning, meshes, look, UI, tests;
  - 7993baf: QA suites merged, look checks folded into `view3d.spec`;
  - 74e64ca: candidate memo.
- Merged into main as b92aec5. QA report f029ac0; TL addendum fc8aea2.

Sources:
- `plan.md` (§0 amendments), `plan-review.md` (required items 1–6, rulings Q1–Q8), `impl-review.md` (+ addendum);
- `designer-plan.md` (vegetation table, 16-row sky golden, Light tab), `camera-decision.md` (PM + Designer);
- PM goals-and-stories round 11 (default camera, F4-S1 / F4-S3 re-read, the shortfall warning);
- TL F4-T2 `outcome-review.md` routing items 1–7;
- architecture A-9, A-10, A-11, A-13, A-16.

## 1. What was built

- **Sky model (`core/sky.js`, A-13).** `PC.sky.compute(hour, season, northDeg, tables)`:
  - Sun path, moon mirror, and the light's Y held at ≥ 0.15 with the horizontal part rescaled.
  - Colours are mixed in two rounded steps (key lerp, then the season blend weighted by daylight) with the one A-10
    mix, `PC.sky.mix` (`three.mixHex` is an alias).
  - It reproduces the Designer's 16-row table exactly, and `compute(12, 'summer')` equals the former F4-T1 noon look
    (literal goldens). `noonLook` / `noonSunDir` are removed.
  - Also `PC.sky.PRESETS` (8 / 12 / 17.5 / 22) and `DEFAULT` (12:00 summer).
- **Vegetation table.** `PC.data.vegetation` in `look3d.js` (Designer §1): trunk, canopy and shrub sizes, segment
  counts and the scale range. Colours stay in `siteColors.trunk` and `sky.seasons`.
- **Scatter (`core/scatter.js`).** `PC.scatter.vegetation(site, extras)` runs inside `PC.site.analyse`, so stage 2 has
  `site.trees`, `site.shrubs` and `site.vegPlaced`. `PC.house.build` copies them.
  - **Seed:** the plot points (1e-6) and the street edge, never the vegetation %. A Q4 change adds and removes items;
    trees never move.
  - **Candidates:** a 1 m grid jittered ±0.35 m, cached in a one-entry memo keyed on the full seed text (TL finding
    7).
  - **Clearances, all from the table** (clr = canopyR × scale[1] = 1.5525 m):
    - trees ≥ clr + 0.2 m (1.75 m) from every edge, shrubs ≥ 0.7 m;
    - trees clear footprint + 1 m + clr, parking + clr and pool + 1 m + clr;
    - shrubs clear the plain A-9 rectangles (`PC.site.blocked`, exported);
    - both clear the path strip, the seating pad + 0.3 m and the needle circle L / 2 + 0.3.
  - **Spacing:** 2.4 / 1.4 / 1.0 m.
  - **Selection:** trees to 60 % of `veg.area`, then shrubs to the total, each rounded to the nearest item. Caps are
    120 trees and 200 shrubs.
- **Shortfall warning (PM round 11).** `veg-short`, a stage-2 warning (q 4) shown again on Floor plans, with the PM
  text (unit-aware).
  - It shows when `vegPlaced < 0.8 × min(veg.area, 1 020 m²)`. The cap term is the A-9 caps, and the PM and TL ruled
    to keep it (option (a)).
  - Never at 0 %, never on the sample (145.5 of 146 m² placed). It may show together with `veg-reduced`.
- **Meshes (`three/build-site.js`).**
  - InstancedMesh `trunks`, `canopies` and `shrubs`, built from the table (6 / 8 / 7 segments). One instance per item:
    translated, uniform scale s.
  - `frustumCulled = false`; they cast shadows and do not receive them. A kind with no items gets no mesh.
  - Materials: `trunk` (fixed), `canopy` and `shrub` (season).
  - Meshes: the sample has 15 (was 12) and the maximum house 21 (was 18), against the ≤ 40 budget.
- **Look (`three/look.js`, `three/scene.js`).**
  - `PC.three.applyLook(ctx, look)` writes light colours and intensities, the sun position, the raw background, the
    plot ground / canopy / shrub colours and canopy visibility (hidden in winter). It creates and disposes no
    geometry, material or mesh and never touches the camera.
  - `PC.three.shadowFit(house, eye, dir)` refits the shadow camera in light space on build and on every look. It
    covers building plus yard (parking, pool, seating, every tree and shrub), leaves out the boundary wall, adds a
    0.5 m margin and is capped at `shadowR × radius`. One shadow light, 1024 map.
  - `PC.view3d.setLook({ hour, season })` / `look()` hold the session look. A rebuild or context restore re-applies it,
    a store replace keeps it, and a page load gives 12:00 summer. It is not in the draft.
- **Light tab (`ui/stage-3d.js`).**
  - Live: the slider (0–24 h, 0.25), four presets (`aria-pressed` only on the matching hour; Noon on open) and the
    season select.
  - The HH:MM readout runs 00:00–24:00. "approximate — not real solar data" is shown.
  - `v3-time` has the class `pc-range--sky`: a day/night track whose stops are the sky keys (CSS tested against the
    table).
  - The room finder and tour stay disabled (F5).
- **Default camera.** Decision (a): Reset stays on the street side, with no hint line (PM). No A-12 / A-14 change.

## 2. Files

- **Core:**
  - new `core/sky.js`, `core/scatter.js`;
  - changed `site.js` (scatter in `analyse`), `site-outdoor.js` (`blocked` export), `house.js`, `validate.js`
    (`veg-short`), `const.js` (`VEG_SHORT`).
- **Data:** `data/look3d.js` (`PC.data.vegetation`).
- **Three:** new `three/look.js`; changed `build-site.js`, `scene.js`, `util.js` (`mixHex` alias).
- **UI:** `ui/stage-3d.js`, `index.html` (the slider class), `css/44-stage-3d.css` (the track).
- **Manifest:** `src/manifest.json`.
- **Docs:** `plan.md` §0, `impl-notes.md` (+ §3a QA points, §5 memo addendum), architecture A-9 / A-13 "as built"
  notes, `shots/` (real r128: four exteriors at noon, morning, evening, night, autumn, winter).
- **FS tests:**
  - new unit `sky` 9, `scatter` 8;
  - new three `vegetation` 3, `look` 4, `budget` 1;
  - `tests/helpers/look-checks.mjs`, run inside `view3d.spec` (80);
  - updated `data-tables` (+2), `scene`, `site`, `interior`, `house`, `validate`, `view3d.spec` (disabled set),
    `view3d-real` (looks in the existing loads, 46), `questions.spec` (`veg-short`).
- **QA suites:** `tests/qa/f4-t3-model.mjs`, `f4-t3-view.mjs`, `f4-t3-ref.mjs` and `run-f4-t3.mjs`, plus
  version-aware updates to f4-t1-view, the F4-T2 suites, f2-t1-site and stage2kit.

## 3. APIs for F5 (room finder, drone tour, click a room)

- **Look:**
  - `PC.view3d.setLook` / `look()`. A-14: time and season changes go through `applyLook` and never touch the tour; the
    tour must not reset the look.
  - `applyLook` never moves the camera, so a flight or tour in progress is unaffected.
- **Scene names:**
  - site group children: `trunks`, `canopies`, `shrubs`, `siteBatch`, `poolWater`;
  - vegetation materials: `mats.trunk`, `mats.canopy`, `mats.shrub`;
  - the F5 `highlight` mesh is the one budget item still missing. Headroom: 21 of 40 meshes on the maximum house.
- **Model:** `house.site.trees` / `shrubs` (`[u, v, s]` in L) and `vegPlaced`. Canopy tops reach 4.83 m (4.2 × 1.15).
  A-14 tour eye points are at `max(baseY, 0) + storeyH + 2.5` (5.5 m or more at Q8 = 3 m), so they clear the canopies;
  the eye path between stops is not checked against trees.
- **Shadow fit:** `PC.three.shadowFit(house, eye, dir)` is pure. Re-use it if F5 adds content to the scene.
- **Session pattern:** level, Roof and look all live in `PC.view3d`. The finder's "roof off, level = room's level" (A-14)
  follows the same setters.

## 4. How to verify

- Full run: `node build.mjs && node tests/run-all.mjs`, about 395–410 s at `--jobs 3`.
- Focused run: `node tests/run-all.mjs --unit --three --e2e --only view3d,questions,outdoor` (about 45 s).
- QA only: `node tests/run-all.mjs --qa --only f4-t3`.
- Shots: `node tests/e2e/view3d-real.spec.mjs --shots` writes `docs/03-tasks/F4-T3/shots/`.
- By hand, in `dist/index.html`:
  - Load the sample and Skip to 3D: trees and shrubs show.
  - Light tab: Evening shows orange light and long shadows; Night is dark but readable; Winter shows bare trunks and a
    snow plot.
  - Orbit while dragging the slider: the camera stays where you left it.
  - Stage 2 at vegetation 50 %: the "Only … of planting fits …" warning.

## 5. QA sign-off and run times

- **QA** (`qa-report.md`): PASSED, no bugs.
  - Model suite 15 checks, view suite 46 (real r128).
  - Sky oracle: 2 200 cases. Scatter: 44 houses. Shortfall: 50 cases. G6: 24 looks.
  - Mutations: 25 of 26 caught (one equivalent).
  - Full run 393.8 s, exit 0; the slowest runner was f1-t3 at 97.6 s; `run-f4-t3` took 28.4 s.
- **FS:**
  - 20 mutations, all caught (two after added tests: moon direction, the 80 % line).
  - Full run 1: 424.8 s, failed on `questions.spec`'s old warning list.
  - Full run 2: 407.1 s, green, after folding the look checks into `view3d.spec` (TL Q7).
  - After the memo fix: focused run 46.1 s.
- **TL:** focused run 47.0 s (view3d 80, view3d-real 46, outdoor 9, questions 432, site-legend 120, site-tapmode 195).
- **Stage-2 footprint sweep** (10–80 %, after the memo):

  | Plot | FS | QA |
  |---|---|---|
  | sample | 201 ms | 173 ms |
  | 100 × 100 m | 614 ms | 641 ms |

  Before the memo: 335 ms and 2 755 ms. Without the scatter: 143 ms and 507 ms.

## 6. Rulings applied

- **TL plan review:**
  - item 1: the table key and table-driven geometry and clearances;
  - item 2: exact sky values with the two-step rounding;
  - item 3: the Light tab (`aria-pressed`, `pc-range--sky`, select, disabled set);
  - item 4: no hint line;
  - item 5: the seed without the vegetation %;
  - item 6: mock conformance (already covered since F4-T1).
- **TL Q1–Q8:**
  - Q1: tree boundary 1.75 m;
  - Q2: `vegPlaced`, and the PM's warning;
  - Q3: the extra exclusions;
  - Q4: the shadow box without the wall;
  - Q5: the session look;
  - Q6: the sample unchanged, QA gates its signatures;
  - Q7: one browser file at most, then folded;
  - Q8: goldens first, then the helpers removed.
- **TL implementation review:** finding 7, the candidate memo on the seed text (closed). Findings 8–10 were accepted
  with no change: a `Color` allocated per look, `frustumCulled` kept, Reset mostly ground.
- **PM round 11:**
  - the shortfall warning (text, 80 %, stage 2 and Floor plans, never at 0 %, not on the sample);
  - threshold option (a), ruled with the TL;
  - camera decision (a), no hint line.
- **Designer:** vegetation sizes (r 0.12 / 1.35 / 0.7, canopy from 1.4 to 4.2 m, scale 0.85–1.15), 6 / 8 / 7
  segments, the 16-row golden table, the day/night track.

## 7. Known limits

1. **Faint summer-evening shadows (QA O-1, Designer).** At 17.5 h in summer the sun sits at the 0.15 Y clamp and
   grazes the ground, so vegetation shadows on grass are faint. Only 204 px change by more than 30 levels, against
   47 351 at 17 h. Any retune is data-only (`sky.js` intensities or keys). FS's `view3d-real` darkening check is weak
   (luma −0.05); QA's pixel-count check is the stronger one.
2. **A-11 `frustumCulled` rationale (QA O-2, TL doc).** r128's InstancedMesh already sets `frustumCulled = false`, so
   the explicit line only matters to the mock. It is kept, because A-11 and the F4-plan require it.
3. **Shrubs drop out as Q4 rises while trees are still being added.** Trees never move, but new trees take shrub spots:
   on the sample, 25 → 30 % keeps 31 of 37 shrubs and adds 14. From 35 % the sample has no more room for trees and
   shrubs are only added. As designed (the seed excludes Q4).
4. **Shortfall threshold.** It is measured against `min(veg.area, 1 020 m²)`. Gardens above the caps are drawn smaller
   than asked without a warning, by the PM / TL ruling.
5. **Stage-2 cost.** The scatter runs on every new site state: about +60 ms over a full footprint sweep on the sample
   and +110 ms on 100 × 100 m after the memo. Still well inside F2's "catches up within about a second".
6. **Default camera.** The pool is hidden behind the house at Reset; the seating is visible. Accepted by the PM, to be
   restated at the F4 review. The Reset view is mostly the outer ground, so the sky background shows little (as in
   F4-T1); night, evening and winter carry through the lights and the ground.
7. **Small allocation per look.** `applyLook` creates one `THREE.Color` for the background on each call. It is a value
   object, not a GPU resource (TL finding 8, accepted).
8. **Carried-over lint warnings.** `layout.js` 334 and `stage-plans.js` 320 lines, carried from F4-T2.
9. **Sun path is approximate,** not real solar data (labelled in the UI; F4-S3).

## 8. F4 feature-review hand-off (from the TL F4-T2 outcome review)

- **Client phone check (CD-6).** The answers are still needed before the F4 review. The orchestrator republishes
  `dist/index.html` so the check covers roof, furniture, outdoor items, vegetation and the Light tab.
- **Acceptance.** F4-S1 vegetation and F4-S3 are met by this task. G6's final assertion is
  `tests/three/budget.test.mjs`: 21 meshes on the maximum house with capped vegetation, after every look.
- **Limits to restate for the client:**
  - hall pockets (CD-5);
  - the approximate sun;
  - phone plan scale 13.2 px/m on a full large floor;
  - seating tie order;
  - the pool hidden at Reset;
  - gardens above the caps drawn smaller without a warning.
