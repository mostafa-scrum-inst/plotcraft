# F4-T2 QA report (F4-T2 proper)

Date: 2026-11-21. Author: QA. Brief: the 9-item QA focus list in `impl-review.md`, plus FS's `impl-notes.md`. Tested in
the main tree at `ce0849a`, plus my test changes (not committed). The Step 0 round is reported in `qa-report-step0.md`.

## Summary

- **Verdict: PASSED. I found no bugs.**
- **New suites:**
  - `tests/qa/f4-t2-model.mjs`: node, vendored real r128 in a vm, no renderer. 18 checks.
  - `tests/qa/f4-t2-view.mjs`: the built page with the real r128, touch at 360x640 and mouse at 1280x800. 22 checks.
- **Shared oracle:** `tests/qa/f4-t2-ref.mjs` gains my yard, gate and needle oracles (frame L).
- **Runners:**
  - `tests/qa/run-f4-t2.mjs` (F4-T2 proper) runs about 25 s in the full run.
  - `tests/qa/run-f4-t2-step0.mjs` (the Step 0 suites, split off) runs about 92 s. The split lets the two run side by side.
- **My expectations are my own:**
  - A-11 furniture: my F3-T3 `furnish` reference, mapped to L by my own frame.
  - Roof and site geometry: written from plan §4–§7, Designer plan §2–§4 and architecture A-9 / A-10.
  - Closed exterior: three.js `Raycaster` against the shell and roof batches. It hits front faces only, so it also checks
    winding.
  - Seating: my exhaustive 0.5 m pad search per yard.
  - Needle: my own corner walk, plus W north (Q5) mapped to T by my `toL`.
  - Colours: my sRGB → linear conversion of the Designer's hex values.
  - I took the footprint, parking and pool rectangles from `PC.site.analyse` as given (QA'd in F2).
- **Mandatory full run** (`node tests/run-all.mjs`, `--jobs 3`): **exit 0 in 414.5 s**, under the 420 s target. Nobody
  else was running tests.
  - An earlier green run took 446.0 s: the single F4-T2 runner (120 s) was the last task to start. Splitting it brought
    the total under target.
  - The run before that failed in my own `f2-t2` (see §2).
- **Mutations** (throwaway copies; I made no changes in `src/`):
  - **24 tried, 24 caught.**
    - Model (18): FS's list (overlap slack, unturned centre offset, mirrored anchors, ridge on the short side, no wall
      bands, Right at 25 %, raw furniture colour, posts off the wall line) and mine (high parapet not used when usable,
      pergola over the middle third, no `liftHead`, side-yard order not by width, side seating along u, water at 0.05,
      mirrored needle, corner order FR first, canopy at 2.5 m, path strip not blocked).
    - Page (6): roof visible on a single level, Q7 not disabled, no seating warning, no rebuild on context restore,
      Q18 colours from the wrong style, and Undo not dropped on a tab switch (needs both the tab handler and the render
      guard removed; TL Step 0 note 1).
  - Two survived the first attempt. They were caught after I added cases, not by changing the expectations:
    - The overlap slack. My search now finds 40 rooms where two pieces overlap by exactly 0.01 m.
    - The side order. I added 40 side-yard plots, so every yard and the omitted branch are reached.

## 1. Results by focus item

| # | Item | Result |
|---|---|---|
| 1 | f4-t1-view lines 344 / 369 | **done.** Marker: `PC.three.buildRoof` exists. With it, `v3-roof` leaves the disabled set and its disabled-pixel check, and a new check asserts the switch is enabled, turns the roof group on with All, and changes the render (real r128). F4-T1 view: 175 / 175. |
| 2 | Roof, every type | **pass.** Node, 15 roofs: flat / pitched / terrace × usable × lift, plus wide and deep pitched footprints and a wide terrace. Model: never pitched when usable; `stairHead` / `liftHead` = my core rectangles. Geometry: wall bands 0.15 m on every above-ground level (floor + 1.2 up to the next slab). Slab 0.2 m. Parapet 0.3 m, or 1.0 m when usable or terrace. Pergola: 4 posts 2.4 m in the back third; beams every 0.6 m along the region's longer side. Pitched: rise tan 30° × short / 2, ridge along the longer side for both orientations, no overhang, gables in `wall`, slopes in `roof`. Usable: stair head 2.4 m, lift overrun 1.2 m. **Closed:** horizontal rays from all four sides at four heights per storey hit the facade, and the door ray passes. Page (real r128, 360x640 and 1280x800, four roofs): Roof is off on open. On shows the roof group with All only (hidden on Ground and First, back on All, off again). The four roofs render pairwise differently. The page's roof batch has my node build's item count. Stage 2: usable on with Pitched switches to Flat and shows the note; Pitched stays disabled and a tap does nothing. Outward winding on every roof and site triangle. |
| 3 | Furniture | **pass.** 369 rooms in 30 houses: the sample × 3 styles × full / sparse, and 24 seeded houses in m and ft. Each room's pieces equal my A-11 placement mapped to L, in the Q18 hex. Each keeps 0.15 m to its walls, enters no other room, the stair or the lift, and stays out of the entrance gap. In T there is one box per piece at floor + y0, with colour col(hex), cast + receive. 40 exact-0.01 m-overlap rooms agree with my reference (allowed). Sparse < full in every style. Q18 changes colours and the key only: boxes and plan signatures are equal. Page: Q18 Classic on stage 4 → one rebuild, same boxes, new colours, approvals kept ("2 of 2"). Q19 Sparse → fewer boxes. |
| 4 | Wall and gate | **pass.** 4 plots: rectangle, rotated 30°, slanted trapezoid, pentagon. Gate Left / Centre / Right is at 25 / 50 / 75 % of the street edge. There is no gate without the wall, and Q17's value is kept. Wall segments sit 0.2 m inside every edge, 1.2 m high, with the 3 m gap only at the gate. Posts are 0.4 × 0.4 × 1.4 m trim, flush with the gap, on the wall line. Page: wall off disables the three Gate radios with Right kept, and a raw tap on Left does nothing. The scene then has no wall segments; wall on enables them again with Right. |
| 5 | Seating | **pass.** 113 sites: sample, 70 seeded, 40 side-yard, a tight plot, seating off. Placements: back 47, right 25, left 17, front 16; omitted 7. The chosen yard is the first with room in my order (back, wider side, other side, front) by my exhaustive search. The pad is valid (0.3 m inside, clear of footprint + 1, parking, pool + 1, path strip). `along` matches the facade axis. Omitted only when my search finds nothing. Warning: on the 16 × 18 m plot at 50 % the text is exact, kind warn, q 17; the sample has no warnings. Page: the stage-2 row's Fix ("go to question 17") opens Outdoor with Q17 in view; the warning appears again on Floor plans. 3D: pad, table and two benches as specified, parallel to the facade. |
| 6 | Pool, parking, needle | **pass.** Water = the pool rectangle at Y 0.03, with the 0.3 × 0.1 m rim flush around it; none when the pool is off. Pads 0.02 m per car. Covered: canopy 0.1 m with its top at 2.4 m on 4 posts; none when open. Needle on 4 plots × 6 Q5 values (unset, 0, 45, 90, 195, 315): place and L equal my corner walk. The N tip sits at L / 2 along Q5's W north mapped to T by my frame (unset = the street edge's inward normal); S tip opposite; 0.04 m high. |
| 7 | Budget | **pass.** Maximum house (4 levels × all 10 types = 40 rooms, full, lift, pool L, 4 covered cars, wall, gate, seating, usable terrace): **18 meshes** in node and in the page (≤ 18). Every item is present and every room furnished. The sample has 12. Page (real r128, 1280x800, roof on): loop idle after the build (0 rAF / 0 renders in 600 ms). `WEBGL_lose_context` lose + restore → one rebuild, the same batches, a byte-identical frame, idle again. No console errors. |
| 8 | Undo across a tab switch | **pass** (touch and mouse). Edit Ground, switch to First: no Undo. Edit First, then Undo: only First is restored and Ground keeps its edit. Back on Ground there is no Undo. The Step 0 UI suite's hide cases still pass. |
| 9 | Regression | **pass.** Full run 414.5 s: F4-T1 view, light and tour suites, Step 0 plan suites, all e2e / unit / three. |

## 2. Test changes for F4-T2 (version-aware, marker-gated)

- **`tests/qa/f4-t1-view.mjs` G.** With `PC.three.buildRoof` present, Roof leaves the later-task set, and its live
  behaviour is checked (focus item 1).
- **`tests/qa/stage2kit.mjs` `syncProblems`.** With `PC.site.gateU` present (PM round 10 Q7), the Gate radios must be
  disabled exactly while the wall is off.
- **`tests/qa/f2-t2-questions.mjs` A.** The old step turned the wall off and then tapped Gate Left. Under Q7 that tap is
  correctly refused, which failed the first full run. Left is now chosen first, then the wall is turned off. The check
  asserts the radios are disabled with Left kept.

## 3. Observations (no action needed)

1. **Seating inside a yard.** The pad's position inside a yard is the first valid 0.5 m row nearest the yard's middle,
   then the nearest column. I checked the yard order and the pad's validity, not this tie order, because architecture
   says only "nearest the yard's middle".
2. **Context restore.** r128 also redraws correctly without the app's rebuild. My check therefore pins the documented
   rebuild (one build on restore) as well as the frame.

VERDICT: PASSED
