# F4-T3 QA report

Date: 2026-11-21. Author: QA. Brief: the 9-item QA focus list in `impl-review.md`, FS's `impl-notes.md` (including
addendum §5, the scatter candidate memo), my prepared suites, exploratory checks and one full run. Tested in the main
tree at `b92aec5`, plus my test changes (committed with this report).

## Summary

- **Verdict: PASSED. I found no bugs.** There is one minor look observation (O-1) for the Designer.
- **Suites** (prepared before the merge as `361deec`, extended in this round; version-aware on `PC.sky.compute`,
  `PC.scatter.vegetation` and `PC.three.applyLook`):
  - `tests/qa/f4-t3-model.mjs` (node, 15 checks), with sections O, K, D, V, W and the new X.
  - `tests/qa/f4-t3-view.mjs` (page, real r128, 46 checks), with sections A, B, C and the new D (focus list 6 and 7)
    and E (exploratory).
  - The oracle is `tests/qa/f4-t3-ref.mjs`. It holds my own A-13 implementation, the Designer's vegetation table and
    16-row golden table (typed in by me), the scatter rules from the TL rulings, and the PM's shortfall text.
  - Runner: `tests/qa/run-f4-t3.mjs`, 28.4 s in the full run.
- **Full run** (`node build.mjs && node tests/run-all.mjs`, `--jobs 3`): **exit 0 in 393.8 s.** That is under the
  420 s target. Nobody else was running tests. The slowest runner was f1-t3 at 97.6 s.
- **Mutations** (throwaway copies; I made no changes in `src/`): **26 tried, 25 caught.**
  - The 24 from the preparation round were run on a snapshot of FS's work in progress:
    - sky: single rounding, no `day` factor, moon not mirrored, mirrored north;
    - scatter: tree edge at 0.7 m, seating not excluded, seed with Q4, a literal clearance, parking without the canopy
      clearance, the stop rule without the half-item;
    - warning: a 0.7 threshold;
    - look: no shadow refit, a rebuild resetting the look, the background through `col`, `frustumCulled` dropped.
  - Three more were run on main in this round: the threshold without the cap term, canopies always visible, and
    vegetation not casting shadows.
  - The one survivor is equivalent: in real r128, `InstancedMesh` sets `frustumCulled = false` in its constructor.
    So FS's explicit line is redundant there. A-11's reason ("r128 culls an InstancedMesh by its base geometry")
    does not hold for r128; only the mock can tell the difference. This is a doc note for the TL, not a bug.

## Focus list

1. **Version markers.** All of the following are gated and pass with the markers present, and were green on main
   before the merge:
   - `f4-t1-view`: the Light hooks leave the "still disabled" set and the disabled-look checks. The room select and the
     tour icons are still judged.
   - `f4-t1-view` section A: the shell and Q10 picture signatures use my own fixture, the sample at vegetation 0 % (Q6).
   - F4-T2 model / view: the mesh budgets allow + 1 mesh per vegetation kind (sample 15, maximum house ≤ 21), and the
     node scene helpers get the vegetation materials.
   - `veg-short`:
     - `f2-t1-site` leaves it out of its "each code alone" lists; it is judged in my W / X sections.
     - `stage2kit` expects it to point at Q4. Its seating row now also expects Q17.
2. **Sky oracle.** `PC.sky.compute` matches my A-13 implementation on 2200 cases: 0–24 h in 0.25 h steps, plus
   off-grid and out-of-range hours × 4 seasons × north 0 / 37 / 90 / 180 / 275.5.
   - Colours are exact with the two rounded mix steps; intensities and `sunDir` match to 1e-9.
   - It also reproduces the Designer's 16 golden rows exactly.
   - North + 90° turns `sunDir` by 90° about Y (1e-9).
   - `compute(12, summer)` equals the F4-T1 noon look as literals.
   - `PC.sky.mix` and `three.mixHex` equal the A-10 rule on 3000 random pairs.
   - The Y clamp holds Y at exactly 0.15 and rescales the horizontal part (A-13 "kept at 0.15 or more"). I accepted
     that over the plan's "clamp then renormalise".
3. **Scatter.** Checked on 36 houses (4 plot shapes × 10 / 25 / 45 % × 3 outdoor sets) plus 8 houses on concave plots
   (L, U and an L rotated 50°):
   - every centre is inside the plot;
   - trees are at least 1.7525 m and shrubs at least 0.7 m from every edge;
   - no centre is in footprint + 1 m (+ c for trees), the path strip to the gate, parking (+ c), pool + 1 m (+ c),
     seating + 0.3 m or the needle circle;
   - spacing is 2.4 / 1.4 / 1.0 m; scale is 0.85–1.15;
   - `vegPlaced` = 6 nT + 1.5 nS, and the stop rule holds, with exact counts on roomy plots;
   - 100 × 100 m at 80 % reaches 120 trees and 200 shrubs;
   - the output is deterministic.

   **Q4 sweep from 5 to 60 % on the sample: no tree ever moves or disappears.**
   - **Observation (shrubs):** while trees are still being added, a few shrubs disappear when the % rises. For
     example, 25 → 30 % keeps 31 of 37 shrubs and adds 14. This is because new trees take candidate spots and their
     1.4 m spacing; the kept shrubs never move.
   - From 35 % on, the sample has no more room for trees (18), and shrubs are only added. As designed.
4. **Shortfall** (threshold per the PM / TL ruling (a): 80 % of min(veg.area, 1020 m²)):
   - It shows exactly when my rule says so on 50 cases (11 short, 23 not, 16 at 0 %), with the exact PM text in m and
     ft, as a warning.
   - It never shows at 0 %, nor above the cap line on 100 × 100 m at 20 / 50 / 80 %.
   - It shows together with `veg-reduced` (16 of 16 reduced states also short).
   - It is not on the sample.
   - In the page it is a stage-2 warn row ("Fix: go to question 4") and again on Floor plans.
5. **Light tab** (1280x800 mouse and keyboard, 360x640 touch, plus 640x360 and 768x1024 in E):
   - presets by click, tap and Space;
   - arrows step 0.25 h and clear the pressed preset; Home gives 00:00 and End gives 24:00;
   - only the matching preset has `aria-pressed`, and Noon is pressed on open;
   - the season select works; the `pc-range--sky` class is present; the "approximate — not real solar data" label is
     shown;
   - on the phone the panel is at most 34 % of the canvas, the presets are on one row, and every control is at least 44 px;
   - the look is kept across stage 4 and back, a Q18 rebuild, a context loss + restore and a whole-state replace, and a
     reload opens at 12:00 summer;
   - the camera never moves on a look change, and orbit drags between slider steps change only the pose.
6. **Real r128:**
   - every look in the scene equals my oracle: light colours, intensities, sun direction and 2.5 × radius distance from
     the footprint centre, raw background, plot ground / canopy / shrub colours, trunk and `groundOuter` unchanged;
   - mean luma: noon > evening > night;
   - winter shows no canopy pixels: the frame equals the one with canopies forced hidden, and 26 573 px differ when
     they are forced shown;
   - at 17.5 h the trees' shadows darken the frame (see O-1);
   - there is one shadow light with a 1024 map;
   - the shadow box, read from r128's own light-view matrix after a render, holds all content on the sample at all 32
     looks. On the 100 × 100 m garden the house is never clipped at 6 / 8 / 12 / 17.5 / 18 / 22 h; the box was fitted,
     not capped, at all of them.
7. **G6** (maximum house, 40 rooms, 100 × 100 m at 80 %, caps reached):
   - 24 looks, with the same meshes and materials and unchanged renderer memory (no create or dispose);
   - at most 40 meshes;
   - `setLook` mean under 5 ms (sample: max < 16 ms).
8. **Finding 7.** Stage-2 footprint sweep 10–80 % (analyse + validate, node, best of 3):
   - sample: 173 ms, worst tick 4.6 ms;
   - 100 × 100 m: 641 ms, worst tick 12.3 ms.

   This matches FS's table. With a warm memo, the scatter output equals a fresh load on 16 states.
9. **Regression:** the full run is green in 393.8 s (above).

## Observations (minor, not bugs)

- **O-1 (Designer; data-only):** in summer at the Evening preset (17.5 h) shadows are faint. The sun sits at the 0.15 Y
  clamp and grazes the ground. Toggling every shadow caster changes about 60 000 px of the canvas by more than 6 levels,
  but by at most 32 (summed over RGB). Only 204 px change by more than 30. For comparison: 17 h summer changes 47 351 px
  by more than 30, and 17.5 h winter (snow) changes 32 911. Designer plan §2 says "17.5 h and the winter presets show
  them". On grass at summer 17.5 h they barely do. Any retune is data-only (`sky.js`). FS's `view3d-real` check (luma
  0.05 lower) passes but is very weak. My check counts pixels that change by more than 6 levels.
- **O-2 (TL doc note):** the `frustumCulled` rationale in A-11, see the mutations above.

VERDICT: PASSED
