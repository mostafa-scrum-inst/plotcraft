# F5-T1: room finder (outcome)

Owner: FS. Status:
- **PASSED QA** (`qa-report.md`).
  - Round 1 failed on B-1: the basement pit was covered by `groundOuter`, a bug present since F4-T1.
  - Round 2 passed: B-1 is fixed, there are no new bugs, and the `groundOuter` leak check found 0 px in 8 views.
  - Full run 413.0 s at `--jobs 3`, exit 0.
- **TL implementation review APPROVED** (`impl-review.md`), with the B-1 addendum approved.
- **Plan APPROVED** with required items 1–6 and rulings Q1–Q5 (`plan-review.md`). They are applied in `plan.md` §11.
- **Commits.**
  - On `f5t1`: 455dee2 (implementation), 92b9bf7 (QA suites merged), 2809f73 (tests, plan amendments, impl-notes),
    9831ea3 (footprint timing best of 3, TL finding 7).
  - Merged into main as 0e2031e. B-1 fix 88dd164, in main.
  - QA reports: round 1 3758a68, round 2 37a28a2. TL addendum: da5b80d.

Sources:
- `plan.md` (§11), `plan-review.md`, `impl-review.md` (+ addendum), `impl-notes.md` (§1–§6), `qa-report.md`;
- PM goals-and-stories round 12 (caption, select state);
- TL F4-T3 `outcome-review.md` riders;
- architecture A-10, A-11, A-12, A-14, A-16.

## 1. What was built

- **Pose and dropdown model (`core/cam.js`, pure).**
  - `roomOf`, `roomGroups` (lowest level first, plan names, full level labels) and `caption` ([name, level label]).
  - `forRoom(house, id, current, limits)` follows A-14: target at floorY + 0.5, theta kept, phi 35° (15° in a
    basement, plan review item 1), radius `clamp(1.6 max(w, d) + storeyH, 6, 3R)`, then clamped.
  - The target's Y floor is now the lowest floorY (ruling Q1), and the eye stays at 1.0 m or more.
  - New `CAM` constants: `finderLift`, `finderK`, `finderRMin`, `finderPhi`, `finderPhiB`, `flightMs` 1200, `dtMax` 100.
- **Animation driver (`three/scene.js`, A-12 as built).**
  - `PC.view3d.animate({ step(dt) })` and `stopAnimation()`. `dt` is the real rAF delta, capped at 100 ms (0 on the
    first frame). The loop is idle once nothing runs.
  - `flyTo(pose, ms)` uses smoothstep from the current interpolated pose (smooth redirect), clamped every frame, and
    ends exactly on `to`. `flying()` reports a flight.
  - Cancelled by an input (before its delta; plan review item 2), `close()`, `resetView()` and any build.
- **Selection (`three/scene.js` + `three/finder.js`).**
  - `select(id | null)`, `selected()`, `setOnSelect(fn)`. A build and `close()` clear the selection and call
    `onSelect(null)`.
  - `PC.three.highlight` builds the one `highlight` mesh: 4 BoxBatch bars, 0.08 × 0.04 m, inset 0.15 m, #C2410C, no
    shadows. It is a direct child of `world`, rebuilt per pick with the old geometry disposed (ruling Q5).
  - `PC.three.finder.goTo(id)` (Roof off → the room's level → highlight → 1.2 s flight) and `clear()`. It never
    touches the look.
- **Controls (`three/camera.js`).** Pointer-down, each non-zero move, wheel and the canvas keys call
  `api.interrupt()` before they read the pose. Other keys do nothing.
- **UI (`ui/stage-3d.js`, `css/44-stage-3d.css`).**
  - `v3-room` is live, with optgroups per level.
  - A pick syncs the Roof switch and the level radios.
  - The caption reads "Bedroom 2 · First floor" (PM Q6): the room part is whole and the level part truncates. One
    helper, `caption()`, for F5-T2.
  - The select keeps the room (PM Q7).
  - The selection is cleared by All or any manual level change, Reset view, Roof on, "Go to room…", a rebuild and
    close. Orbit, zoom and pan keep it.
- **B-1 fix (`three/build-shell.js`).** `groundOuter` is a ShapeGeometry square of `outerK × R` with the footprint as
  its hole, the same `footHole()` path as `groundPlot`. The basement pit is open from above. Mesh count and material
  are unchanged.

## 2. Files

- **Source:** `src/js/core/cam.js`, `core/const.js`, `three/scene.js`, `three/camera.js`, `three/finder.js` (new),
  `three/build-shell.js`, `ui/stage-3d.js`, `css/44-stage-3d.css`, `manifest.json`.
- **Tests:**
  - unit: `cam.test` +5, `footprint.test` (cold timing, best of 3);
  - three: `finder.test` (10, new), `camera.test` +1, `budget.test` +1, `shell.test` (`groundOuter` hole);
  - helpers: `load3d.mjs` `raf.tick(ms)`, `finder-checks.mjs` (run from `view3d.spec`);
  - e2e: `view3d.spec` 80 → 97, `view3d-real` 46 → 50 (highlight pixels; B-1 raycast + pixels on the maximum house).
- **Docs:** `plan.md`, `impl-notes.md`, this file. The TL updated A-12, A-14 and the F5-plan rider.

## 3. APIs for F5-T2 (drone tour)

- **Driver.** `PC.view3d.animate({ step(dt) -> done })` and `stopAnimation()`. `dt` is capped at 100 ms and the loop
  is idle afterwards. The same cancel paths apply: an input (before its delta), `close()`, Reset and a build.
  - Today `step` writes the pose through the scene's closure (`flyTo` lives in `scene.js`). A client outside
    `scene.js` needs a way to hand the pose back. This is a small change, proposed in the F5-T2 plan.
- **Flights.** `flyTo(pose, ms)` and `flying()`, and `PC.cam.lerpPose`.
- **Caption.** The UI helper `caption([name, label] | null)` in `stage-3d.js`. The pause and stop buttons sit in the
  same caption (hidden today).
- **Visibility.** `setRoof(false)` and `setLevel(id)`, plus the UI sync of the Roof switch and the level radios, as in
  `goRoom`.
- **Selection.** `select(id)` and `PC.three.finder.clear()`. The highlight can mark the tour's current room for one
  mesh (22 of 40 on the maximum house).
- **Model.** `PC.cam.roomGroups` (level order), `roomOf`, `caption`, `forRoom` and `limits` (target Y floor = the
  lowest floorY).
- **Look.** Neither the finder nor the driver touches it; `setLook` never cancels an animation.

## 4. How to verify

- Focused: `node build.mjs && node --test tests/unit/cam.test.mjs tests/three/*.test.mjs` and
  `node tests/e2e/view3d.spec.mjs`, `node tests/e2e/view3d-real.spec.mjs`.
- QA: `node tests/qa/run-f5-t1.mjs` (about 31 s).
- Full run: `node build.mjs && node tests/run-all.mjs`, about 410–415 s at `--jobs 3`.
- By hand, in `dist/index.html`:
  - Load the sample, Skip to 3D, then on the Tour tab use "Go to room…": Bedroom 2 flies in about 1.2 s with the
    Roof off, the First level and an orange frame, and the caption reads "Bedroom 2 · First floor".
  - Drag during a flight: it stops at once.
  - On a house with a basement, a basement room is visible in the open pit.

## 5. QA sign-off and run times

- **QA round 1:** FAILED on B-1, everything else passed. The suite was trimmed from 79 s to 27 s (TL ruling 2), and
  the flight timing measures summed capped steps (TL ruling 1). Full run 411.4 s. Mutations: 7 tried, 6 caught (one
  equivalent).
- **QA round 2:** PASSED.
  - The `groundOuter` leak pixel check covers 8 views with 0 px; with the pre-fix code it finds 11 543 px.
  - A one-off probe covered 128 views: 0 leaks after the fix, 24 before, all of them Basement views.
  - `run-f5-t1` took 31.0 s alone and 36.2 s in the full run. Full run **413.0 s**, exit 0.
- **FS:** 19 mutations, all killed. My full run before the QA trim was 450.2 s, failing only on QA's wall-clock
  duration check, which was ruled (a).
- **Headroom.** The full run is now about 7 s under the 420 s target. F5-T2 browser checks must fold into the
  existing page loads.

## 6. Rulings applied

- **Plan review:**
  - items 1–6: basement phi 15, cancel before the delta, caption format, select state, naming, full run;
  - Q1 the target Y floor; Q2 the smoothstep restart; Q3 what clears the selection, including Roof on; Q4 no new
    e2e file; Q5 one geometry per pick.
- **Implementation review:**
  - ruling 1, option (a): the cap stays 100 ms and QA sums the capped steps;
  - ruling 2: the QA suite budget is 30 s or less;
  - finding 7: the footprint cold timing is best of 3;
  - finding 8, desktop framing under the 320 px panel: passed to F5-T3;
  - finding 9, a level change during a flight lets the flight finish: accepted.
- **PM round 12:** Q6 the caption is "Room · Level"; Q7 the select keeps the room.
- **TL B-1 addendum:** the footprint hole is approved. From now on, real-r128 checks of level-dependent views include
  a basement house.

## 7. Known limits

1. **Flights stretch below 10 fps.** Each frame advances at most 100 ms, so on SwiftShader (about 118 ms per frame) a
   1.2 s flight takes about 1.5 s of wall time. By design (ruling 1).
2. **Desktop framing.** At 1280 px the 320 px side panel can cover the right quarter of a wide room after a pick
   (TL finding 8, for F5-T3).
3. **A level change mid-flight** clears the selection but lets the flight finish (TL finding 9).
4. **The highlight is lit** (shared Lambert batch material), so it is darker at night. It is still visible, since it
   is an orange frame on the floor.
5. **Room names repeat across levels** ("Living" on G and on First). The optgroups and the caption's level part tell
   them apart.
6. **Carried-over lint warnings:** `layout.js` 334 lines, `stage-plans.js` 320 lines.
