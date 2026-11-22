# F5-T1 implementation notes: room finder (FS)

Date: 2026-11-21. Branch `f5t1` (worktree `/home/user/plotcraft-f5t1`), main merged in (QA F5-T1 suites, a9d728c).
Plan: `plan.md` §1–§10 as amended in §11 (TL `plan-review.md`, PM round 12).

## 1. What was built

- **`core/cam.js`** (pure):
  - `roomOf(house, id)` returns `{ room, level, label }`.
  - `roomGroups(house)`: one group per level, lowest first, with the full level names and the plan names in plan
    order.
  - `caption(house, id)` returns `[name, level label]`.
  - `forRoom(house, id, current, limits)`:
    - target = the room centre at floorY + 0.5;
    - theta = the current pose's (the Reset theta when there is no pose);
    - phi = 35°, or 15° in a basement;
    - radius = `clamp(1.6 max(w, d) + storeyH, 6, 3 × house.radius)`, then `clamp(·, limits)`.
  - The limits' target Y floor is the lowest floorY (ruling Q1), so a basement target stays below ground. Without a
    basement the floor is still 0.
  - New constants in `CAM`: `finderLift`, `finderK`, `finderRMin`, `finderPhi`, `finderPhiB`, `flightMs` (1200) and
    `dtMax` (100).
- **`three/scene.js`, the animation driver:**
  - `PC.view3d.animate({ step(dt) -> done })` and `stopAnimation()`.
  - Each frame of a running animation calls `step` with the real rAF delta, capped at 100 ms and 0 on its first frame,
    then requests the next frame. Afterwards the loop is idle.
  - `flyTo(pose, ms)` starts from the current (interpolated) pose and interpolates with smoothstep, clamped every
    frame. It ends exactly on the clamped target.
  - `flying()` reports a flight; `info().flight` gives `{ from, to, t, ms }`.
  - A flight is cancelled by:
    - `api.interrupt()` from the controls, before the delta;
    - `close()`, `resetView()` and any build (rebuild, context restore).
  - **Selection:**
    - `select(id | null)`, `selected()`, `setOnSelect(fn)`;
    - `house()` and `limits()` are new getters;
    - a build and `close()` clear the selection and call `onSelect(null)`;
    - `info().meshCount` and `meshes` include the highlight; `info()` also reports `highlight`, `selected` and
      `highlightsMade`.
- **`three/camera.js`:** pointer-down, each non-zero move, wheel and the canvas keys (arrows, + / -) call
  `api.interrupt()` before reading the pose. Other keys, such as Tab, do nothing, as before.
- **`three/finder.js` (new, in the manifest after look.js):**
  - `PC.three.highlight(house, id, material)`:
    - one BoxBatch Mesh named `highlight`, a direct child of `world`;
    - 4 bars, 0.08 m wide and 0.04 m high, bottom at floorY + 0.02, inset 0.15 m from the room edges;
    - colour `siteColors.highlight` #C2410C through `mats.batch`;
    - no shadows; `userData.room` = id.
  - `PC.three.finder.goTo(id)`: Roof off → the room's level → highlight → a 1.2 s flight to `forRoom` from the
    current pose. It never touches the look.
  - `PC.three.finder.clear()` removes the selection.
- **`ui/stage-3d.js`:**
  - `v3-room` is live: one `<optgroup>` per level, refilled when the rooms change, with "Go to room…" first.
  - A pick syncs the Roof switch and the level radios and shows the caption.
  - **These clear the selection:** any level radio (All included), Reset view, Roof on, "Go to room…", and
    `onSelect(null)` from a rebuild or close. Orbit, zoom and pan keep it.
  - The caption helper `caption(parts | null)` is shared with F5-T2. Its markup is the room in `.pc-caption__room`,
    then " · " and the level in `.pc-caption__level`.
- **`css/44-stage-3d.css`:** the room part does not shrink, and the level part truncates with an ellipsis
  (`white-space: pre` keeps the leading space). `textContent` is "Bedroom 2 · First floor".

## 2. Tests

- **Unit (`cam.test`, +5):**
  - room groups: sample 14 in 2 groups, maximum house 40 in 4, plus the sample with a basement;
  - caption parts;
  - the A-14 pose for every above-ground room at 4 thetas, and both radius clamp ends;
  - basement: phi 15 and the ground crossing inside the footprint, for 12 rooms × 16 thetas;
  - the Y floor, with Reset unchanged.
- **Three:**
  - `finder.test` (10, new): landing within 0.01 m after 1.2 s, exactly `to`, then idle; the basement (groundCap
    hidden, eye ≥ 1 m every frame); per-frame bounds and monotonicity; redirect from the interpolated pose; wheel,
    pointer and key cancel before the delta, with Tab not cancelling; the dt cap and a hidden tab; the look untouched
    at 22:00 winter; the highlight geometry; dispose counts, with nothing left after `close()`; rebuild, context
    restore and Reset.
  - `camera.test` (+1): the call order `interrupt, get, set, onInput` for every input.
  - `budget.test` (+1): the maximum house with a room selected on each level has 22 meshes, through the looks.
  - The test clock: `raf.tick(ms)` in `tests/helpers/load3d.mjs`. The default `flush()` is unchanged.
- **E2E:**
  - `tests/helpers/finder-checks.mjs` runs inside `view3d.spec`'s phone and desktop page loads, with no new page or
    file (ruling Q4).
  - At 360 × 640 touch: 44 px, the groups, a tap pick, the caption, the redirect, the caption layout, and "All".
  - At 1280 × 800 keyboard: ArrowDown picks with focus kept; orbit keeps the selection; Reset, Roof on and the
    placeholder each clear it.
  - `view3d.spec` 80 → 97 checks: the room select moved from the disabled list to the enabled one.
  - `view3d-real` 46 → 48: after a pick on Living, the highlight pixels on real r128 (orange share of the pixels that
    change when it is hidden), plus the caption.
- **Mutations (19, all killed):**
  - pose: theta not kept, phi 45, basement phi 35, radius without the cap, Y floor 0;
  - flight: redirect from the old `from`, no cancel on wheel, cancel after the delta, dt not capped;
  - finder: roof left on, level not set, highlight at Y 0, look reset by goTo, highlight casting a shadow, close
    keeping the selection;
  - UI: All, Roof on and Reset not clearing; caption with the name only.

## 3. For QA

The names match QA's markers:
- `PC.cam.roomGroups` and `PC.cam.forRoom(house, roomId, current, limits)`;
- `PC.view3d.flyTo` and `flying()`;
- `PC.three.finder`;
- `highlight` as a direct child of `world`;
- `v3-caption-text`.

Extras QA may use: `PC.view3d.selected()`, `PC.three.finder.clear()`, `PC.cam.caption` and `PC.cam.roomOf`.

**QA F5-T1 view, A 1280x800 real: 18 passed, 2 failed (needs a TL / QA ruling).** Both failures are the flight
duration check (1.0–1.5 s wall clock): the keyboard pick took 1.70 s, and the 13 other picks 2.15–3.48 s.
- **The cause** is the TL-ruled 100 ms dt cap, not the flight code. On SwiftShader at 1280 × 800 real r128 renders
  about 130–250 ms per frame (QA's note: 13 moving frames in 1.70 s). Each frame advances at most 100 ms, so below
  10 fps the flight stretches in wall time; at 10 fps or more it takes 1.2 s. The mock and the per-frame jump bounds
  pass.
- **Options:**
  - (a) QA measures flight time as the sum of the capped steps, or allows the stretch when frames are longer than
    100 ms. This is my proposal: the cap is the rule that prevents jumps after a hidden tab or a stall.
  - (b) Raise the cap, e.g. to 250 ms. Flights keep 1.2 s on slow renderers but take bigger steps.
- I did not change the cap; it is a one-constant change (`CAM.dtMax`) if the TL picks (b).

## 4. Full run

`node build.mjs && node tests/run-all.mjs` (`--jobs 3`), after merging main a9d728c (QA's F5-T1 suites):

**Run 1: 450.2 s, FAILED.** That is over the 420 s target and under the 600 s hard limit.

- **The only failure** is `qa run-f5-t1`, with the 2 duration checks of §3. Everything else passed: build, lint
  (0 violations), unit, three, all 26 e2e files, and every other QA suite, including the finder-gated `run-f4-t1` and
  `run-f4-t3`.
- **The time.** The new QA suite `run-f5-t1` takes 79.0 s. My browser additions are about 3 s:
  - `view3d.spec` 7.0 s, no new page loads;
  - `view3d-real` 12.5 s, against about 10 s before.
- **Slowest files:**
  - qa f1-t3 98.7 s, f2-t3 95.1 s, f4-t2-step0 91.9 s, f1-t1 91.4 s, f2-t2 90.8 s;
  - e2e shell 47.1 s.
- **Keeping under 420 s** needs a trim in QA's suites. Per A-16 that is QA's call (for example `run-f5-t1` section A
  picks 13 rooms on real r128). I did not change `tests/qa`.

## 5. After the TL implementation review (round 1, `impl-review.md`)

- **Flight duration (§3):** the TL ruled option (a). The cap stays at 100 ms and QA adapts its check.
- **Required item:** `tests/unit/footprint.test.mjs` "deterministic; and fast enough on the largest plot" now times
  the cold site analysis as the best of 3 runs (A-6, like the step-4b timing test). The old single cold run flaked at
  531–657 ms under load after F4-T3 added the scatter to `PC.site.analyse`. The 500 ms bound and the memo-hit check are
  unchanged.
  - Focused run: `node --test tests/unit/footprint.test.mjs`, 18 passed.
  - The full run is left to QA, after its trim.

## 6. QA B-1 fix: the basement pit covered by `groundOuter` (for the TL)

- **Bug** (QA `qa-report.md` B-1, present since F4-T1): `groundOuter` was a full `PlaneGeometry(outerK R)` at
  Y −0.05. `groundPlot` has the footprint hole and `groundCap` fills it, but hiding the cap for the basement still left
  `groundOuter` under the hole. Level B and the basement highlight never showed from above.
- **Fix** (`src/js/three/build-shell.js`): `groundOuter` is now a `ShapeGeometry`, the same `outerK × R` square,
  rotated −π/2, 0.05 m down, colour and material unchanged, with the **footprint** as its hole. The footprint Path is
  the same one `groundPlot` uses, built by one helper `footHole()`.
  - **Why the footprint and not the plot outline:**
    - It is the smallest opening that frees the pit.
    - `groundOuter` keeps lying under `groundPlot` everywhere outside the footprint, as before (A-10 offsets). A
      plot-outline hole would leave a 0.05 m step exactly at the plot edge, which can show as a sliver at grazing
      angles.
    - The footprint is always inside the plot, so the hole never touches the square's outline.
  - **Why not hide `groundOuter` with level B:** the plain ground outside the plot would vanish in the basement view.
  - **Unchanged:**
    - the pit walls (basement floor up to ground level);
    - `groundCap`, which is still hidden only for B;
    - the mesh count: same mesh, sample 15 and maximum house 21 (22 with a room selected);
    - QA's F4-T1 oracle ("groundOuter below and around the plot", 174 view checks pass).
- **Tests:**
  - **`tests/three/shell.test.mjs`:** `groundOuter` is a ShapeGeometry with the square outline and exactly the
    footprint hole.
  - **`tests/e2e/view3d-real.spec.mjs`** (real r128, in the existing 1280×800 page load, no new launch), on the
    maximum house:
    - (1) After a finder pick on a basement edge room (Maid's room), the first *visible* object on the eye → highlight
      ray is the highlight or level B, and the highlight draws ≥ 40 orange pixels.
    - (2) With Reset view and the Basement level, the first visible hit from the eye towards the footprint centre at the
      basement floor is in level B, not the ground.
  - Proven against the old `build-shell.js`: both checks fail, with the hit `ground/groundOuter` and 0 orange pixels.
- **Focused runs** (all passed):
  - `node tests/qa/run-f5-t1.mjs`: F5-T1 model 4/4, view 18/18;
  - `node tests/qa/run-f4-t1.mjs`: model 10/10, view 174/174;
  - unit + three: 487;
  - `view3d.spec` 97;
  - `view3d-real` 50 (was 48).
  - The full suite is left to QA.
