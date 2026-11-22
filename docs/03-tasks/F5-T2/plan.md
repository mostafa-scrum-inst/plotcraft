# F5-T2 plan: drone tour (FS)

Date: 2026-11-22. Owner: FS. Status: **APPROVED by the TL (`plan-review.md`); amended in §8 with the required items,
the rulings on Q1–Q9 and the PM answers Q10–Q13 (round 13).** §1–§7 are the reviewed draft; where §8 differs, §8 holds.

Sources:
- `docs/02-features/F5-plan.md` F5-T2 (scope, files, QA list);
- goals-and-stories F5-S2 and G1;
- architecture A-12 (driver as built) and A-14 (tour plan, runtime);
- F5-T1 `outcome.md` §3 (APIs for the tour);
- TL F4-T3 `outcome-review.md` riders and the orchestrator's riders for this task:
  - the camera stays above the tree tops (4.83 m);
  - the tour never resets the look;
  - the mesh budget;
  - G1: the reviewer path in 6 taps or fewer;
  - run-time headroom of about 7 s.

## 1. Scope

- **`core/tourplan.js`, `PC.tourplan.build(house, aspect)`.** Pure, per A-14:
  - stop order;
  - eye and look points;
  - times and speed factors;
  - the nudge for coincident points;
  - the tree-top eye floor (§2).
- **`three/tour.js`, `PC.three.tour`.** It makes the curves and runs as a client of the F5-T1 animation driver:
  - `start / pause / resume / stop / setSpeed / state`;
  - per stop: the caption, the level visibility and the highlight.
- **`core/cam.js`.** `fromEyeLook(eye, look)` turns an eye and a look point into an orbit pose. The scene keeps one
  render path, and Stop leaves an orbit pose with no jump.
- **`three/scene.js`, small driver changes** (§3).
- **`ui/stage-3d.js`.** The tour controls go live:
  - Start, Pause/Resume (`aria-pressed`), Stop and the speed radios;
  - the caption's pause and stop buttons are shown during the tour;
  - Roof is forced off at Start;
  - the Light tab stays live.
- **Not in scope.** F5-T3's presentation pass (control-bar placement, desktop framing under the panel).

## 2. Tour plan (pure)

- **Stops.**
  - The overview first. Then each level from the lowest (basement first), and on each level every room in
    nearest-neighbour order from the previous stop, using room centres in frame T, with ties broken by plan order.
    The overview last.
  - A level's walk starts from the previous stop (the overview, or the last room of the level below).
  - This walks the same level order as `PC.cam.roomGroups`.
- **Overview stop.** Eye and look come from the Reset pose for the canvas aspect (`PC.cam.reset`).
- **Room stop (A-14).**
  - Eye horizontally `0.6 × max(w, d) + 2 m` from the room centre, away from the footprint centre (street side when
    the room is central). Height `max(baseY, 0) + storeyH + 2.5`.
  - Basement rooms: 1.5 m towards the footprint centre, at `storeyH + 4` above ground. The pit is open since the B-1
    fix.
  - Look point: the room centre at **floorY + 0.5**, as in the finder. A-14 says baseY + 0.5; see Q5.
- **Tree-top eye floor (rider).** Every eye control point has Y of at least
  `TOUR.eyeFloor = canopy top max + 0.5`. The canopy top max is computed from `PC.data.vegetation` (4.2 m × scale max
  1.15 = 4.83 m), so the floor is 5.33 m.
  - Only low ceilings hit it: ground rooms at Q8 = 2.4 m give 4.9 m and are lifted.
  - The runtime clamps every sampled eye to the same floor, which replaces A-14's 1.5 m. That covers the
    Catmull-Rom overshoot between stops, so the path never dips into the canopies.
- **Nudge.** Consecutive points closer than 0.5 m are moved apart along the leg (A-14). With one room the plan is
  overview → room → overview.
- **Times.**
  - Overview legs 4 s (overview → first room, last room → overview); room → room legs 3.5 s; at normal speed.
  - The sample comes to `4 + 13 × 3.5 + 4 = 53.5 s`. A-14's own example counts 14 room slots, 57 s (Q2). Both are
    inside 30–90 s.
  - The maximum house (40 rooms) takes 144.5 s.
  - Speed factors: slow 0.6, normal 1, fast 1.8.
- **Output.** `{ stops: [{ kind: 'overview' | 'room', id, level, eye, look, t }], duration, eyeFloor }`, where `t` is
  the stop's time at normal speed.

## 3. Runtime (`three/tour.js` and driver changes in `scene.js`)

- **Curves.** Two `THREE.CatmullRomCurve3(points, false, 'centripetal')`, one for the eyes and one for the looks.
- **Progress.**
  - Tour time `τ` advances by `dt × speed` (the driver's dt, capped at 100 ms). A speed change takes effect on the next
    frame with no jump, because the position is a function of `τ`.
  - Between stops i and i+1 the curve parameter is linear in `τ`: `u = (i + (τ − tᵢ) / (tᵢ₊₁ − tᵢ)) / (n − 1)`, read
    with `getPoint(u)`. Catmull-Rom passes through its control points at `u = i / (n − 1)`, so each stop is reached
    exactly at its time.
  - A-14 names `getPointAt` (arc length) with `arcLengthDivisions`. Arc length does not put the stops at their own
    times without an inverse mapping that the mock does not whitelist (Q1).
- **Pose per frame.**
  - The eye is clamped to the eye floor, then `pose = PC.cam.clamp(PC.cam.fromEyeLook(eye, look), limits)`. That keeps
    phi in [5°, 85°], the target in the box and the eye ≥ 1 m.
  - The orbit renderer is unchanged.
  - Stop and any gesture leave that pose as it is, with orbit control from there (F5-S2: "leaves the camera where it
    is").
- **Current stop and visibility.**
  - From the start of each leg, the stop being approached sets the level selector to the room's level (levels above
    are hidden, a basement room opens the ground), the caption, and the highlight on that room.
  - The overview sets the level to All, with the Roof still off.
  - A-14 says "last stop passed". Flying up to a first-floor room while that level is still hidden, then popping it in
    on arrival, looks wrong, so I switch at the leg start (Q3).
- **Driver changes (`scene.js`, used by both clients).**
  - `step(dt)` returns `{ pose, done }`, and the driver assigns the pose. Today `flyTo` writes the closure's pose,
    which a client in another file cannot do. `flyTo` moves to the same form, which is behaviour-neutral (F5-T1 tests
    unchanged).
  - `anim.end(reason)` is called once, with `'done' | 'input' | 'close' | 'reset' | 'build' | 'replaced' | 'stop'`.
    The UI resets the tour buttons from it.
  - `anim.paused`: while it is true the driver requests no frames (the on-demand rule), and on resume the next frame
    has dt 0. A gesture while paused still ends the tour.
- **What ends the tour:**
  - Stop, a gesture, or `close()` (leaving stage 5; it never auto-restarts);
  - Reset view, a rebuild or a context restore;
  - a finder pick, which replaces the animation with its flight.
- **What does not end it:** the Light tab (`setLook` never touches the driver; rider) and a speed change.
- **The tour never calls `setLook`** (rider; tested).
- **Mesh budget.** The tour adds no meshes. The highlight is the one F5-T1 mesh, so the maximum house stays at 22 of
  40 during a tour (tested). Per stop, one highlight geometry is created and the old one disposed: 42 on the maximum
  house over 144 s, the same rule as F5-T1 ruling Q5.

## 4. UI (`ui/stage-3d.js`)

- **Start.** It clears any finder selection, forces the Roof off (and syncs the switch), and starts at the current
  speed. While a tour runs, Start is disabled and Pause/Stop are enabled.
- **Pause/Resume.**
  - The button toggles `aria-pressed`, with `aria-label` "Pause tour" / "Resume tour".
  - The caption's pause button mirrors it, and the caption's stop button is shown, so a phone user with the panel
    collapsed can control the tour.
- **Speed.** The radios are live at all times. The speed is session state (default Normal) and is kept across tours.
- **Caption.** It uses the F5-T1 `caption()` helper, "Room · Level"; the overview text is Q10.
- **Other controls during the tour.** A level radio, Reset view, Roof on, or a finder pick each end the tour, then
  apply as usual (Q9).
- **When the tour ends:**
  - the buttons return to Start;
  - the caption and highlight are cleared;
  - the level and Roof stay as they were at that moment, so the view does not change (Q12).
- **G1 reviewer path:** Load sample → Skip to 3D → (phone: Tour tab) → Start tour. That is 4 taps on a phone and 3 on
  desktop, within the 6-tap limit (tested in e2e).

## 5. Tests

**Unit (`tests/unit/tourplan.test.mjs`, new node file):**
- the stops: the overview, every room exactly once, levels ascending with the basement first, the overview last;
- the nearest-neighbour order is deterministic (the same plan twice, and tie-breaks by plan order);
- every eye is at `max(baseY, 0) + storeyH + 2.5` or higher (the basement rule for B), and at the eye floor or
  higher;
- durations: the sample at normal speed inside 30–90 s; slow / fast scale it;
- a single-room house and the maximum house give valid plans with no consecutive points closer than 0.5 m;
- `fromEyeLook` round-trips with `PC.cam.position`.

**Three (`tests/three/tour.test.mjs`, new; mock clock, the whole tour sampled at 60 fps).** Houses: the sample, the
maximum house, a single room, and a basement house.
- **Height:** camera Y is at the eye floor or higher everywhere, including the basement tour. No sampled eye is inside
  a tree's canopy cylinder below its top.
- **Coverage:** for each room there is a frame where the target is its look point within 0.5 m, its level is the top
  visible one, and `groundCap` is hidden for B.
- **Smoothness:**
  - no step longer than `speed × dt × 3 ×` the leg's mean speed;
  - the direction change between frames is bounded (no sharp turn);
  - the speed change and Resume cause no jump.
- **Caption:** it equals the room being approached.
- **Controls:**
  - Pause freezes the pose and requests no frames; Resume continues from the same point;
  - Stop and a pointer gesture end the tour, leave the pose in place and return orbit control;
  - `close()` stops the tour, and re-opening does not restart it;
  - Reset, a rebuild and a finder pick end it.
- **Look and lights unchanged (rider):** `setLook` mid-tour does not change the progress, and the look is not touched
  by the tour.
- **Budget:** the maximum house has 22 meshes or fewer at every stop, and every highlight geometry is disposed once.
- **Hidden tab:** one capped step on return.
- **Driver refactor:** the F5-T1 `finder.test` / `camera.test` stay green unchanged.

**E2E (mock), run-time headroom about 7 s.**
- `tests/helpers/tour-checks.mjs` runs inside `view3d.spec`'s existing phone and desktop page loads (no new browser
  file, no new page load).
- The checks:
  - the G1 tap count;
  - controls of 44 px or more and enabled correctly;
  - Start → caption + Roof off;
  - Pause / Resume by tap and by keyboard;
  - a speed change;
  - a canvas gesture ends the tour;
  - leaving stage 5 and returning does not restart it;
  - no console errors.
- These checks wait at most about 2 s of real tour time in each viewport. Full-tour coverage stays in the three
  tests.
- To check later stops without waiting, a debug-only `PC.debug.tourSeek(τ)` (Q8).

**Real r128 (`view3d-real`, existing loads).**
- On the sample: Start, then two frames at different times differ and are not blank; Stop.
- On the maximum house, already loaded for the B-1 checks: seek to a basement stop. The room is the first visible hit
  and is drawn (TL B-1 process note: real-r128 checks of level-dependent views include a basement house).

**Planned mutations:**
- the eye floor at 1.5 m;
- the levels in plan order rather than ascending;
- no nearest-neighbour ordering;
- `getPointAt` instead of `getPoint` (stops off their times);
- dt not scaled by speed;
- Pause still requesting frames;
- no end on gesture;
- the level switched on the stop passed;
- the tour calling `setLook`;
- Roof not forced off;
- a restart on re-entering stage 5;
- the highlight geometry not disposed.

## 6. Files

- **New:** `src/js/core/tourplan.js`, `src/js/three/tour.js`, `tests/unit/tourplan.test.mjs`,
  `tests/three/tour.test.mjs`, `tests/helpers/tour-checks.mjs`.
- **Changed:** `src/js/core/cam.js` (`fromEyeLook`), `core/const.js` (`TOUR`), `three/scene.js` (driver changes),
  `ui/stage-3d.js`, `manifest.json`, `tests/e2e/view3d.spec.mjs`, `tests/e2e/view3d-real.spec.mjs`,
  `tests/three/budget.test.mjs`.
- **Docs:** A-14 as built, plus the F5-plan file list (`tests/e2e/tour.spec.mjs` is replaced by the helper).
- `tests/qa` is not touched.
- **QA markers:** `PC.tourplan`, `PC.three.tour`. The tour controls leave the disabled set.

## 7. Open questions

**For the TL:**
1. **`getPoint(u)` with time-linear segments instead of `getPointAt` (arc length).** With `getPoint` every stop is
   reached exactly at its time; arc-length progress does not, without an inverse u→t mapping. **Proposal:**
   `getPoint`. The speed varies a little within a leg, and the smoothness bounds are tested.
2. **Leg times.** Overview legs 4 s and room legs 3.5 s give the sample 53.5 s. A-14's example (57 s) counts a 3.5 s
   slot for each of the 14 rooms. Which arithmetic? Both are inside 30–90 s.
3. **When the level switches.** **Proposal:** at the start of the leg towards the next room, not on the stop passed
   (A-14), so the room being approached is never hidden.
4. **Eye floor 5.33 m everywhere** (canopy top + 0.5 m, computed from the vegetation table), replacing A-14's 1.5 m,
   even on houses without trees. **Proposal:** yes. It is one rule, and it lifts only low-ceiling ground eyes. The
   alternative is the floor only within a canopy radius of a tree.
5. **Look point at floorY + 0.5** (as the finder) rather than A-14's baseY + 0.5.
6. **Driver API.** `step` returns `{ pose, done }`, `end(reason)`, and a paused state that requests no frames. Approve
   the change to F5-T1's driver; `flyTo` is migrated.
7. **Clamp every tour frame** with the orbit limits (and the eye floor), so Stop never jumps.
8. **A debug-only seek** (`PC.debug.tourSeek`) for e2e and real-r128 checks, so that no test waits for real tour time.
   It is not a product API.
9. **Other controls during the tour** (a level radio, Reset, Roof on, a finder pick) end the tour before they apply.
   Agreed?

**For the PM:**

10. **Caption at the overview stops.** "Overview", hidden, or the house name? **Proposal:** "Overview", so the pause and
    stop buttons in the caption stay reachable.
11. **Highlight the current room during the tour?** **Proposal:** yes, the same orange frame as the finder.
12. **After Stop or a gesture.** **Proposal:** the camera, level and Roof stay as they are, and the caption and
    highlight are cleared. The alternative is to return to level All.
13. **Speed.** **Proposal:** it is session state (default Normal) and is kept between tours and stage visits.

## 8. Amendments after the plan review (TL `plan-review.md`, PM round 13)

**PM answers (required item 1).**
- Q10: the caption reads "Overview" at both overview stops, and "Room · Level" at room stops.
- Q11: the room being approached gets the finder's highlight; overviews get none.
- Q12: after Stop or a gesture, the camera, level and Roof stay as they are; the caption and highlight are cleared and
  the select shows "Go to room…".
- Q13: speed is session state, Normal by default, kept across tours and stage visits, and not in the draft.

**Rulings Q1–Q9 as adopted.**
- Q1: `getPoint(u)` with u linear in τ inside each leg; `getPointAt` / `arcLengthDivisions` are not used.
- Q2: `rooms + 1` legs, overview legs 4 s, room legs 3.5 s: sample 53.5 s, maximum house 144.5 s, one room 8 s.
- Q3: the level, caption and highlight switch at the start of each leg, to the stop being approached; the last leg
  switches to All at its start.
- Q4 / required item 2: `eyeFloor = (canopyY0 + canopyH) × scale[1] + TOUR.treeGap`, read from `PC.data.vegetation`
  each time (no literal 4.83 or 5.33); unit test with a table mutation. It replaces A-14's 1.5 m clamp.
- Q5: look point at floorY + 0.5 (`baseY + 0.2 + 0.5`).
- Q6: driver API as in §3; `flyTo` migrated; a gesture while paused ends the tour with `input`.
- Q7 / required item 3: every frame is clamped; a unit test asserts `PC.cam.clamp` leaves every stop's
  `fromEyeLook(eye, look)` unchanged (5 houses × 2 aspects).
- Q8: `PC.debug.tourSeek(τ)` is debug-only; a grep test checks that only `stage-3d.js` defines it and no product code
  calls it or `debugSeek`.
- Q9: a level radio, Reset view, Roof on and a finder pick end the tour (`replaced` for a pick) and then apply; the
  Light tab and the speed radios do not. Start clears any finder selection first.

**Required items 4–6.**
- Item 4: the tour sets the level radios and the Roof switch with `.checked` (no `change` event), so the UI's
  "level change ends the tour" handlers never fire from the tour. Tested in e2e: a seek across the G → 1 switch keeps
  the tour running; mutation: dispatching `change` from the tour's level sync is killed.
- Item 5: `view3d-real` on the maximum house seeks to the first and last basement stops (paused just before each): the first visible
  hit on the eye → highlight ray is the highlight or level B, and the highlight draws orange pixels.
- Item 6: full run at `--jobs 3` (recorded in `impl-notes.md`).

**Nearest-neighbour walk, exact reading (for QA's model).** The distance is horizontal (XZ, frame T) from the
*previous stop's look point* to each remaining room's look point (the room centre); ties go to plan order. After an
overview, the walk starts from the overview's look point, which is the Reset target. Each level's walk starts from
the last stop before it (the overview for the lowest level, else the last room of the level below). This is QA's
`anchor: 'look', metric: '2d'` reading.

**G1 with a stored draft.** Load sample first asks to replace the draft: 5 taps on a phone (Load sample, its confirm,
Skip to 3D, Tour tab, Start), 4 on desktop. Both counts are tested.

**Changes made during implementation** (justified in `impl-notes.md` §2):
- the curves are uniform Catmull-Rom in pose space (a look-point curve plus a (θ unwrapped, φ, radius) curve), not
  centripetal eye / look curves;
- soft floors on the radius, φ and the eye height, so the hard clamp never bites mid-path;
- the first and last legs ease in from and out to rest;
- a 1.2 s lead-in flight to the overview when the camera is elsewhere at Start (τ stays 0 during it).
