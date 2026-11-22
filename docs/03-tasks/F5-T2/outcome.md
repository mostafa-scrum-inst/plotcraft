# F5-T2: drone tour (outcome)

Owner: FS. Status:
- **PASSED QA** (`qa-report.md`).
  - No bugs. All 8 items on the TL's focus list pass, and QA caught 7 of 7 mutations.
  - QA rebuilt `f5-t2-view` on the as-built model (TL rulings). It now takes 20–22 s alone, down from 47.4 s.
  - Full run 413.3 s at `--jobs 3`, exit 0. QA put extra viewports and streams in f1-t1, f2-t2, f2-t3 and
    f4-t2-step0 behind `QA_FULL=1`. Those 4 suites are green under `QA_FULL=1` (184.4 s).
- **TL implementation review APPROVED** in round 1 (`impl-review.md`). All four deviations were accepted.
- **Plan APPROVED** with required items 1–7 and rulings Q1–Q9 (`plan-review.md`). They are applied in `plan.md` §8.
- **Commits.**
  - On `f5t2`: 54b1fcc (WIP), d379687 (QA suites merged), 0d303e5 (implementation, tests, plan §8, impl-notes),
    939deb6 (full-run notes).
  - Merged into main as e46f533.
  - TL: 9a264c1 (implementation review), 6974e83 (A-14 as built). QA: a8e1028 (report and suite changes).

Sources:
- `plan.md` (§8), `plan-review.md`, `impl-review.md`, `impl-notes.md` (§1–§5), `qa-report.md`;
- PM goals-and-stories round 13 (Q10–Q13), F5-S2 and G1;
- TL F4-T3 riders: tree tops, the look, the budget;
- architecture A-12 and A-14.

## 1. What was built

- **Tour plan (`core/tourplan.js`, pure), `PC.tourplan`.**
  - `eyeFloor()` is `(canopyY0 + canopyH) × scale[1] + TOUR.treeGap`. It is read from `PC.data.vegetation` on every
    call and comes to 5.33 m today.
  - `roomStop(house, lv, r)` follows A-14:
    - the eye sits `0.6 × max(w, d) + 2` m out from the footprint centre, at `max(baseY, 0) + storeyH + 2.5`;
    - for a basement room it sits 1.5 m inward, at `storeyH + 4`;
    - it is never below the eye floor;
    - the look point is floorY + 0.5.
  - `build(house, aspect)`:
    - the overview comes from `PC.cam.reset`, and levels run in ascending order (basement first);
    - within a level, the walk goes to the nearest room in XZ from the previous stop's look point (after an overview,
      the Reset target), with ties in plan order;
    - points closer than 0.5 m are nudged apart;
    - legs take 4 s from or to an overview and 3.5 s between rooms (sample 53.5 s, maximum house 144.5 s, one room
      8 s).
  - `target(plan, τ)` gives the stop being approached. `u(plan, τ)` is linear inside middle legs, eased on the first
    and last legs.
- **`PC.cam.fromEyeLook(eye, look)`** converts an eye and look point to an orbit pose; it round-trips with
  `position`.
- **Driver (`three/scene.js`, A-12 / Q6).**
  - `step(dt)` returns `{ pose, done }`.
  - `end(reason)` is called exactly once, with one of `done | input | close | reset | build | replaced | stop`.
  - A paused animation requests no frames and is not stepped by a repaint. The first dt after Resume is 0.
  - New calls: `stopAnimation()`, `pauseAnimation(on)`, `animation()`. `flyTo` was migrated, and the F5-T1 tests are
    unchanged.
- **Tour runtime (`three/tour.js`), `PC.three.tour`.**
  - API: `start`, `pause`, `resume`, `stop`, `setSpeed`, `speed`, `running`, `state` (`tau`, `duration`, `stop`,
    `lead`, `plan`), and the test-only `debugSeek`.
  - The path is two uniform Catmull-Rom curves, one over the look points and one over the stops' orbit poses
    `(θ unwrapped, φ, radius)`.
  - Soft floors on radius, φ and eye height come first, then `PC.cam.clamp` runs on every frame.
  - If the camera is away from the overview at Start, a 1.2 s lead-in flies it there first.
  - Each leg sets its stop's level, highlight and caption at its start. Start clears the finder selection and turns
    the Roof off.
  - The tour never calls `setLook`.
- **UI (`ui/stage-3d.js`).**
  - Live controls:
    - Start;
    - Pause, with `aria-pressed` and the labels "Pause tour" / "Resume tour", mirrored on the caption's pause button;
    - Stop;
    - the speed radios (slow 0.6, normal 1, fast 1.8).
  - The caption reads "Overview" or "Room · Level" and shows its pause and stop buttons during a tour.
  - A level radio, Reset, Roof on and a finder pick end the tour, then apply. The Light tab and speed do not.
  - At the end, the camera, level and Roof stay as they were. The caption and highlight clear, and the select shows
    "Go to room…".
  - Leaving stage 5 ends the tour, and it does not restart on return. Speed is session state.
  - `PC.debug.tourSeek(τ)` is debug-only, enforced by a grep test.

## 2. Files

- **Source:**
  - new: `src/js/core/tourplan.js`, `three/tour.js`;
  - changed: `core/cam.js`, `core/const.js` (`TOUR`), `three/scene.js`, `ui/stage-3d.js`, `manifest.json`.
- **Tests:**
  - unit: `tourplan.test` (10, new);
  - three: `tour.test` (8, new);
  - helpers: `tour-checks.mjs` (`tourChecks`, `g1Draft`), run from `view3d.spec`;
  - e2e: `view3d.spec` 97 → 115, `view3d-real` 50 → 53 (tour basement stops on the maximum house).
- **Docs:** `plan.md` §8, `impl-notes.md`, this file. The TL updated A-14 to match the build.

## 3. APIs for F5-T3 (presentation pass)

- **Tour.** `PC.three.tour.state()` returns `{ running, paused, speed, tau, duration, stop, lead, plan }`. The plan's
  stops carry `kind`, `id`, `level`, `eye`, `look` and `t`.
- **Pacing data.** Leg times, speeds, eye offsets, `treeGap`, the soft margins and the lead-in live in `PC.C.TOUR`,
  so they can be retuned without code changes.
- **Driver.** `PC.view3d.animate({ step(dt) -> { pose, done }, end(reason), paused })`, plus `stopAnimation`,
  `pauseAnimation` and `animation`.
- **UI hooks.**
  - Panel: `v3-tour-start`, `v3-tour-pause`, `v3-tour-stop`, `v3-tour-speed`.
  - Caption: `v3-caption-pause`, `v3-caption-stop`.
  - Seek in tests: pause, call `PC.debug.tourSeek(τ)`, then resume. The first frame then shows exactly τ.

## 4. How to verify

- **Focused:**
  - `node --test tests/unit/tourplan.test.mjs tests/three/tour.test.mjs`;
  - `node build.mjs && node tests/e2e/view3d.spec.mjs`, then `node tests/e2e/view3d-real.spec.mjs`.
- **QA:** `node tests/qa/run-f5-t2.mjs`, about 20–22 s alone.
- **Full run:** `node build.mjs && node tests/run-all.mjs`, about 413 s at `--jobs 3`.
- **By hand, in `dist/index.html`:**
  - Load the sample, Skip to 3D, then Tour tab → Start tour.
    - The camera leaves the overview and visits every room in level order, never dipping below the tree tops.
    - The caption reads "Room · Level" as each room is approached, and the room gets the orange frame.
    - The tour ends on the overview with All after about 53.5 s at Normal.
  - Pause freezes the camera and Resume continues. Fast is about 1.8 times as quick.
  - A drag ends the tour where the camera is.

## 5. QA sign-off and run times

- **FS:**
  - 16 mutations, 15 killed; the one survivor is equivalent (the `tour.js` `ended` guard).
  - Two full runs on the branch: 458.8 s and 458.2 s, both failing only on QA's 4 pre-ruling section-A checks.
  - My browser additions cost about 3 s.
- **TL rulings for QA** (`impl-review.md`):
  - QA's reference follows the as-built model: the look exact at tᵢ, eye ≥ floor, lift ≤ 0.4 m, the smoothness
    bounds;
  - seeks follow Pause → seek → Resume → read;
  - Stop is measured in one task.
- **QA round 1: PASSED.**
  - 7 of 7 mutations caught.
  - `run-f5-t2` takes 20–22 s alone.
  - Full run **413.3 s**, exit 0. The first post-merge runs took 431.4 s and 436.6 s, before the `QA_FULL=1` trims.
- **Headroom.** About 7 s under the 420 s target. The suites trimmed behind `QA_FULL=1` must run before the F5 feature
  review and whenever the code they guard changes.

## 6. Rulings applied

- **Plan review:**
  - item 1: PM round 13;
  - item 2: the eye floor from the table;
  - item 3: the clamp never bites at a stop;
  - item 4: silent programmatic level changes;
  - item 5: real-r128 basement stops;
  - item 6: full run measured;
  - item 7: as-built docs;
  - Q1–Q9: `getPoint`, 53.5 s, leg-start switch, one eye floor, floorY + 0.5, the driver API, every frame clamped,
    a debug-only seek, the ending controls.
- **Implementation review**, all accepted:
  1. pose-space uniform Catmull-Rom instead of centripetal eye/look curves;
  2. soft floors (lift ≤ m/e ≈ 0.37 m at stops near the floor);
  3. eased first and last legs;
  4. the 1.2 s lead-in.
- **PM round 13:**
  - Q10: "Overview" as the overview caption;
  - Q11: the room highlighted;
  - Q12: camera, level and Roof kept after the end;
  - Q13: speed is session state, Normal by default, not in the draft.

## 7. Known limits

1. **Slow frames stretch the tour.** Each frame advances at most 100 ms (times the speed), so on SwiftShader (about
   117 ms per frame at 1280×800) the tour runs slower than wall time. By design (F5-T1 ruling 1).
2. **Mid-leg framing.** The previous room stays in view while the next one is already highlighted at the edge (TL
   finding). Pacing is for the Designer in F5-T3.
3. **Upward legs.** The newly shown level can briefly cover the room just left (ruling Q3). The camera is moving
   away from it at the time.
4. **Lifted stops.** Near the eye floor the rendered eye is up to about 0.37 m above the plan eye. The look point and
   the stop time are exact.
5. **`PC.three.tour.pause()` called outside the UI** does not update the buttons' `aria-pressed` (TL finding). No
   user path does this.
6. **Rotation mid-tour** keeps the overview pose from Start (plan review, accepted).
7. **Desktop framing under the 320 px panel** is carried over to F5-T3 from F5-T1.
