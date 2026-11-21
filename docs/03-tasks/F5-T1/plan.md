# F5-T1 plan: room finder (FS)

Date: 2026-11-21. Owner: FS. Status: **APPROVED by the TL with required items 1–6 and rulings Q1–Q5 (`plan-review.md`); PM Q6 / Q7 answered (goals-and-stories round 12). Amended in §11; §11 wins where it differs from §1–§10.**

Sources:
- `docs/02-features/F5-plan.md` F5-T1 (scope, files, QA list);
- goals-and-stories F5-S1;
- architecture A-10 (scene, `highlight`), A-11 (budget), A-12 (camera, flights) and A-14 (finder pose);
- TL F4-T3 `outcome-review.md` riders:
  - maximum house 40 rooms;
  - the finder must not reset the session look;
  - the highlight counts against ≤ 40 meshes, with 21 used;
  - F5-T2 reuse;
- F4-T3 `outcome.md` §3 (APIs for F5).

## 1. Scope

- **Flights.** `PC.view3d.flyTo(pose, ms)` with redirect and cancel (A-12). It does not exist yet: F4-T1 has
  `PC.cam.lerpPose` only.
- **Finder.** `three/finder.js`: `PC.three.finder` with the highlight frame and `goTo(roomId)`. The pure pose and room
  list go in `core/cam.js` (`PC.cam.forRoom`, `PC.cam.roomGroups`) so they are unit-testable.
- **UI** (`ui/stage-3d.js`):
  - the `v3-room` select is filled with one `<optgroup>` per level, lowest first, holding the plan names;
  - it is enabled (it leaves `LATER`);
  - on select: Roof off, level = the room's level, the highlight, the caption, a 1.2 s flight;
  - "All" clears the highlight and caption (see Q3 for other level changes).
- **Not in scope:** the tour (F5-T2). Its buttons stay disabled. What it will reuse is listed in §7.

## 2. Pose for a room (`PC.cam.forRoom(house, room, current, limits)`, pure; A-14)

- `target = [X(room centre u), floorY + 0.5, Z(room centre v)]` in T, with `floorY = level.baseY + slab`.
- `theta = current.theta`, so there is no swing around the model.
- `phi = 35°`.
- `radius = clamp(1.6 × max(w, d) + storeyH, 6, 3 × house.radius)`.
- The result goes through `PC.cam.clamp(·, limits)`, so the eye stays at 1.0 m or more.
- **Basement:** the floor is at `−pitch + 0.2`, so `floorY + 0.5` is below 0. The current limits clamp the target's Y
  to `[0, roof base]`, which would lift a basement target to Y 0 (Q1).
- **Room groups** (`PC.cam.roomGroups(house)`): `[{ level, label (PC.C.LEVEL_LABEL), rooms: [{ id, name }] }]`, levels
  lowest first, rooms in plan order.
  - The sample: G and 1, 14 rooms.
  - The maximum house: B, G, 1, 2 with 10 rooms each, 40 rooms (CD-4 rider).

## 3. Flights (`three/scene.js`; reused by the F5-T2 tour)

- **One animation driver in `scene.js`.** `S.anim = { step(dt) -> done }`. While an animation runs, each frame
  requests the next.
  - `dt` is the real frame delta from the rAF timestamp, capped at 100 ms (F5-plan).
  - When nothing runs, the loop is idle again (the F4-T1 on-demand rule holds).
- **`flyTo(pose, ms)`** sets `from` = the current pose (the current interpolated pose during a flight, which is the
  smooth redirect) and `to` = the clamped target pose. Each frame:
  - `pose = clamp(lerpPose(from, to, t / ms))` (smoothstep, shortest arc in theta);
  - at `t ≥ ms` the pose is exactly `to`, and the flight ends.
- **Cancel.** Any canvas input cancels the flight in place: the existing `api.onInput` from the controls, so pointer,
  wheel and key input all cancel it. The pose stays where it is and orbit control continues from there. Also cancelled
  by:
  - `close()` (leaving stage 5);
  - Reset view (Reset wins);
  - a rebuild.
- **The look is never touched.** No flight path calls `setLook` or `lights()`. The time and season look (F4-T3 session
  state) is kept, and a test asserts the light state is unchanged after `goTo` (rider).
- `PC.view3d.flying()` and `debug.scene().flight` (from, to, t) are exposed for tests.

## 4. Highlight (`three/finder.js`; A-10 `highlight`)

- A thin outline frame on the room rectangle, built with `BoxBatch`:
  - 4 boxes, 0.08 m wide and 0.04 m high, at `floorY + 0.03`;
  - just inside the walls' inner faces, so it does not z-fight the floor tint (+0.015) or hide inside the 0.15 m
    partitions;
  - colour `siteColors.highlight` (#C2410C) through `col`.
- **One mesh named `highlight`,** a direct child of `world`. It stays visible whatever the level selection, but it is
  only shown while a room is selected.
- **On `goTo`** the old highlight geometry is disposed and a new batch is built for the room: one geometry, created
  and disposed per selection (Q5). The mesh itself is created on the first `goTo` and kept.
- **Budget.** With a room selected, the maximum house has 22 meshes (21 + highlight), against ≤ 40. The G6 test
  (`tests/three/budget.test.mjs`) runs one `goTo` before counting.
- **A rebuild** (a Q18 / Q19 / plan change while stage 5 is open, or a context restore) clears the selection:
  - the highlight is disposed with the rest;
  - the select returns to the placeholder;
  - the caption is hidden;
  - the room may not exist any more.

## 5. UI (`ui/stage-3d.js`)

- **Select.**
  - Filled from `PC.cam.roomGroups(house)` whenever the house's level/room key changes (the pattern of `fillLevels`).
  - The first option is "Go to room…" (value "").
  - At least 44 px high (Designer markup since F4-T1).
- **On `change` to a room id:**
  1. `PC.view3d.setRoof(false)` and the Roof switch unchecked;
  2. `level` = the room's level, `PC.view3d.setLevel(level)` and the level radios re-rendered (a basement room opens
     the ground, F4-T1 rule);
  3. `finder.goTo(id)`, which moves the highlight and starts `flyTo(forRoom(...), 1200)`;
  4. the caption is shown (`v3-caption`, the room name in `v3-caption-text`; the pause/stop buttons stay hidden,
     since they belong to the tour).
- **Clearing:**
  - "All" in the level selector clears the highlight and caption and returns the select to "Go to room…" (F5-plan);
  - a change to another level, and Reset view, see Q3;
  - choosing "Go to room…" again clears too.
- **Focus** stays on the select after a choice, so the keyboard can pick the next room. The flight does not move focus.
- **Phone:** the native picker opens over the page; the panel layout is unchanged (Designer F4-T3 §3 measurements
  hold).

## 6. Tests

- **Unit (`tests/unit/cam.test.mjs` additions):**
  - `forRoom`: target, theta, phi and radius per A-14 for every room of the sample and the maximum house, including
    a large room (radius cap) and a small one (6 m floor);
  - eye ≥ 1.0 m after the clamp;
  - basement targets per the Q1 ruling;
  - `roomGroups`: 14 rooms in 2 groups on the sample, 40 in 4 on the maximum house, lowest level first, plan names.
- **Three (`tests/three/finder.test.mjs`, mock with the controllable rAF clock):**
  - After `goTo` and 1.2 s, the pose target equals the room centre (0.01 m), the room's level is the top visible
    level, the roof group is hidden, and `groundCap` is hidden for a basement room.
  - The highlight sits on the room rectangle (each box inside it, on all four sides).
  - Frames are monotone: pose distance per frame ≤ (path length / 1.2 s) × dt × 2, with no jump.
  - A second `goTo` mid-flight starts from the current interpolated pose (frame-to-frame continuity across the
    redirect).
  - Pointer-down, wheel and key cancel the flight: the pose stops changing and no frames are requested.
  - Eye height ≥ 1 m on every frame; dt capped at 100 ms (a 2 s gap is one 100 ms step).
  - The loop is idle after the flight.
  - **Look untouched (rider):** sun / hemi colours, intensities, position, background and `look()` are identical
    before and after `goTo` at 22:00 winter.
  - `close()` mid-flight stops it and re-opening does not resume it.
  - A rebuild clears the highlight.
  - Budget: the maximum house with a room selected has 22 meshes, and the highlight geometry is disposed exactly once
    per re-selection.
- **E2E (mock).** In `view3d.spec` through a helper module (`tests/helpers/finder-checks.mjs`), not a new browser file
  (run-time budget; Q7). Checks at 360x640 touch and 1280x800 keyboard:
  - the select is 44 px or taller, has optgroups in level order, and offers 14 options on the sample;
  - picking a room by touch and by keyboard shows the caption with the room name, turns Roof off, checks the room's
    level radio and lands the flight on the target;
  - "All" clears the caption and the select;
  - no console errors.
- **Real r128 (`view3d-real`, existing page loads):** after `goTo` on a ground-floor room, the frame has highlight
  pixels (#C2410C ± tolerance in a region around the projected room centre). One render, no new launch.
- **Mutations (planned):**
  - theta not kept;
  - phi 45°;
  - radius without the cap;
  - redirect from the old `from` (jump);
  - no cancel on wheel;
  - dt not capped;
  - roof left on;
  - the basement not opening the ground;
  - the highlight on the wrong level's Y;
  - the look reset by `goTo`;
  - "All" not clearing.

## 7. What F5-T2 (tour) reuses

- **The animation driver** (`S.anim`, real dt capped at 100 ms, cancel on input / close / Reset / rebuild, idle
  afterwards). The tour plugs in its own `step(dt)` that samples its curves; `flyTo` is one client of it.
- **Cancel semantics.** One `onInput` path ends a flight or a tour. The tour's "stop on gesture" is the same hook.
- **Caption.** `v3-caption` show/hide with a room name, from one small UI helper (`caption(name | null)`). The tour adds
  its pause/stop buttons inside it.
- **Visibility setters.** `setRoof(false)` and `setLevel(levelOfRoom)` plus the radio sync, wrapped in one UI helper
  (`showRoomLevel(room)`). The tour calls it per stop.
- **`PC.cam.roomGroups`** gives the per-level room order the tour's level-by-level walk starts from.
- **The highlight.** The tour may show it on the current room (F5-T2 plan decides; it is one call).
- **Look invariance.** The same rule and test pattern: the tour never calls `setLook`.

## 8. Files

- **Changed:** `src/js/core/cam.js` (`forRoom`, `roomGroups`), `src/js/three/scene.js` (`S.anim`, `flyTo`,
  `flying`, cancel), `src/js/ui/stage-3d.js`.
- **New:** `src/js/three/finder.js` (the highlight, `goTo`).
- **Manifest:** `src/manifest.json`.
- **Tests:** `tests/unit/cam.test.mjs`, `tests/three/finder.test.mjs`, `tests/three/budget.test.mjs`,
  `tests/helpers/finder-checks.mjs` (run from `view3d.spec`), `tests/e2e/view3d-real.spec.mjs`.
- **Docs:** A-12 (flights as built), A-14 (finder as built), A-10 (the highlight).
- `tests/qa` is not touched.

## 9. QA markers

- **`PC.three.finder`:** `f4-t1-view` (and any later suite) drops `v3-room` from the "still disabled" set and from the
  disabled-look check. Tour controls stay disabled until F5-T2.
- **Mesh counts with a selection:** +1 (`highlight`).

## 10. Open questions

**For the TL:**
1. **Basement target below Y 0.** The A-12 limits clamp the target's Y to `[0, roof base]`, which lifts a basement
   room's target to ground level, so the camera looks at the ground slab rather than into the pit. **Proposal:** the
   limits' Y floor = the lowest floorY of the house (`−pitch + 0.2` with a basement), with the eye ≥ 1.0 m rule
   unchanged. That is an A-12 change.
2. **Redirect smoothness.** A-12 restarts the smoothstep from the current pose, which keeps position continuous but
   drops the velocity to zero at the redirect (a brief ease-in). Is that "redirects smoothly" enough? **Proposal:**
   yes. The test bounds per-frame distance, not velocity. The alternative (carrying the velocity into a cubic Hermite)
   adds code for little visible gain.
3. **What clears the selection besides "All"?** **Proposal:** any manual level change and Reset view also clear the
   highlight and caption. Once the user leaves the room's view, a stale caption would mislead. Orbit, zoom and pan do
   not clear it.
4. **Run time.** The full run was 393.8 s (QA, F4-T3). **Proposal:** no new e2e file; the finder checks run inside
   `view3d.spec` like the look checks, and the real-r128 check runs in the existing loads.
5. **Highlight geometry per selection.** One BoxBatch geometry per `goTo`, disposed on the next. The F4-T3
   "no create" rule bound `applyLook` only. **Proposal:** accept it (one small geometry per user action), with dispose
   counted in the test.

**For the PM:**
6. **Caption text.** **Proposal:** the room name only ("Bedroom 2"), as on the plans, since names are unique per house.
   The alternative is name plus level ("Bedroom 2 · First floor").
7. **Select after a choice.** **Proposal:** it keeps showing the chosen room until the selection is cleared; then it
   returns to "Go to room…". Choosing the same room again does nothing (Reset view or another room is the way out).

## 11. Amendments after the plan review (TL `plan-review.md`, PM round 12)

1. **Basement view (item 1).** Basement rooms use phi 15° (`CAM.finderPhiB`); other levels keep 35°. Unit test: for
   every basement room of the maximum house and of the sample with two small edge rooms in a basement, at 16 current
   thetas, the eye→target line crosses Y 0 inside the footprint, and the eye is 1.0 m or more above ground.
2. **Cancel order (item 2).** The controls call `api.interrupt()` first, before they read the pose, on pointer-down,
   each non-zero move, wheel and the canvas keys (arrows, + / -; other keys neither cancel nor move). A wheel
   mid-flight therefore gives the interpolated pose × the zoom factor. Tests: the call order
   `interrupt, get, set, onInput`, plus the wheel case on a real flight. Mutation: "cancel after the delta".
3. **Caption (item 3, PM Q6).** "Bedroom 2 · First floor": one UI helper `caption([name, level] | null)`, fed by
   `PC.cam.caption(house, id)`. Markup inside `v3-caption-text`: `.pc-caption__room` (no shrink) and
   `.pc-caption__level` (" · " + the full `LEVEL_LABEL`, `white-space: pre`, ellipsis). The level part truncates
   first. `textContent` is the full text with plain spaces.
4. **Select state (item 4, PM Q7).** As proposed in §5.
5. **Naming (item 5).** The API is `PC.view3d.flyTo(pose, ms)` on the shared driver (`PC.view3d.animate`,
   `stopAnimation`, `flying`). It replaces §1's `PC.three.flyTo`. The TL already updated A-12, A-14 and the F5-plan
   rider.
6. **Full run (item 6)** at `--jobs 3`: see `impl-notes.md`.

**Rulings:**
- **Q1:** limits Y floor = the lowest floorY.
- **Q2:** smoothstep restart.
- **Q3:** these clear the selection: All, any manual level change, Reset view, **Roof on**, "Go to room…", a
  rebuild. `close()` clears it too.
- **Q4:** no new e2e file.
- **Q5:** one geometry per pick, disposed.

**Non-blocking checks:**
- the hidden tab (one capped step on return) and a context restore mid-flight (cancel and clear) are tested;
- the highlight has `castShadow = receiveShadow = false`;
- the extra mutations are in the list.

**Deviations from §4:**
- A new `highlight` Mesh is made per pick, and the old one's geometry is disposed. The plan said the mesh is kept and
  only its geometry swapped. The mock whitelist has no geometry setter.
- Bars are 0.08 × 0.04 m with the bottom at floorY + 0.02, inset 0.15 m from the room edges.
- The material is the shared `mats.batch` (vertex colours), so no new material is created.
