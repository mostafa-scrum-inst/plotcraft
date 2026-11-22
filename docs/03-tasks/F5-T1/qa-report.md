# F5-T1 QA report

## Round 2 (2026-11-22): re-test of B-1 after FS's fix `88dd164`

- **Verdict: PASSED.** B-1 is fixed, and I found no new bugs.
- **B-1, by hand:**
  - The maximum house at 22:00 winter, pick "Maid's room" (B): the pit is open, and the basement walls, the furniture
    and the orange frame are visible.
  - At 360x640, "Master bedroom · Basement": the basement room and its frame are visible inside the plot.
- **B-1, with the suite:** f5-t1-view passes 18 of 18 (model 4 of 4). The basement highlight now changes the real r128
  frame.
- **B-1 class, new check:**
  - **Method.** In the maximum-house part of f5-t1-view, `groundOuter` is painted magenta for one frame. Then I count
    its pixels inside the screen polygon of the footprint.
  - **Views covered.** 8 of them: Basement, All, Ground and Second, with Roof off and on, at Reset and from a low side
    pose (phi 75°).
  - **Result.** 0 px in every view.
  - **The check catches B-1.** With the pre-fix `build-shell.js` on a throwaway copy, it reports 11 543 and 7 987 px
    for Basement at Reset and side.
  - **Wider probe.** A one-off probe (not committed) covered 4 houses (sample, sample + basement, maximum, pitched
    roof + basement), every level choice, Roof off / on and 4 poses: 128 views. It found 0 leaks after the fix and 24
    before, all of them Basement views. So the bug was confined to the Basement view, and nothing similar hides in
    the other F4-T1 views.
- **Suite time:** run-f5-t1 takes 31.0 s on its own and 36.2 s in the full run. This includes the new leak check, and I
  cut the hidden-tab waits to make room for it.
- **Full run** (`node build.mjs && node tests/run-all.mjs --jobs 3`): **exit 0 in 413.0 s**, under the 420 s target.
  - Keyboard-pick flight: 1.25 s of summed capped steps.
  - Mean frame time 118 ms, so the 1.53 s wall clock was not judged (TL ruling 1).

VERDICT: PASSED

---

## Round 1

Date: 2026-11-22. Author: QA. Brief: the 10-item QA focus list in `impl-review.md` (TL rulings 1 and 2), my prepared
suites, exploratory checks and one full run. Tested in the main tree at `0e2031e` (f5t1 merged), plus my test changes
(committed with this report).

## Summary

- **Verdict: FAILED. One bug (B-1, major): the basement cannot be seen from above.** The finder's basement picks land on
  the right pose, but the room and its highlight are hidden under `groundOuter`. Everything else on the focus list passed.
- **Suites** (version-aware on `PC.cam.roomGroups` / `PC.cam.forRoom` / `PC.view3d.flyTo` + `PC.three.finder`):
  - `tests/qa/f5-t1-model.mjs` (node, 4 checks: G groups, P forRoom on every room of 4 houses x 3 thetas, L limits,
    B basement eye line). All pass.
  - `tests/qa/f5-t1-view.mjs` (page, real r128, 18 checks). 17 pass, 1 fails (B-1).
  - Oracle `tests/qa/f5-t1-ref.mjs`; runner `tests/qa/run-f5-t1.mjs`.
- **Trim (TL ruling 2):** the suite went from 79 s to **27 s on its own** (34.5 s in the parallel full run). It loads 2
  pages instead of 3. Real r128 keeps 3 landed sample picks (ground by keyboard, first floor, a redirect) and one
  basement pick on the 40-room house. Room-by-room coverage stays in node (f5-t1-model) and FS's unit tests.
- **Flight timing (TL ruling 1, option a):** progress is the sum of steps capped at `CAM.dtMax`, and must be 1.0-1.5 s.
  Wall clock is judged only when the mean frame time is 100 ms or less.
- **Full run** (`node build.mjs && node tests/run-all.mjs --jobs 3`): **411.4 s, under the 420 s target.** It exits 1
  only on B-1. Every other runner is ok.
- **Mutations** (throwaway copies; no changes in `src/`): **7 tried, 6 caught.** The survivor is equivalent.

## Bug

### B-1 (major): the basement pit is covered by `groundOuter`; basement rooms and their highlight are invisible

- **Repro:** the maximum house (or any house with a basement), stage 5. Pick a basement room in "Go to room…", or just
  choose the Basement level.
  - The ground cap is hidden as planned (`groundCap.visible === false`).
  - But the view shows a flat grey plane (`siteColors.groundOuter` #B3B0A6) where the pit should be. Nothing of
    level B is visible: no walls, no floors, no orange frame.
  - Hiding `groundOuter` by hand shows the room, its furniture and the highlight correctly.
- **Cause** (`src/js/three/build-shell.js`): `groundOuter` is a full `PlaneGeometry(outerK * R)` at Y −0.05 with no
  hole. `groundPlot` has the footprint hole and `groundCap` covers it, but under that hole `groundOuter` is still there.
- **Evidence:**
  - f5-t1-view check A "maximum house": Maid's room (B), the highlight changes 0 px of the frame.
  - Raycast from the camera to the highlight centre: the first visible object is `ground/groundOuter` at Y −0.05.
  - Same result for Bedroom and Living on B in a probe, and from Reset view with Basement selected.
- **Scope:**
  - The bug dates from F4-T1 (`2ebb9ea`). The Basement level view has always been covered. My F4-T1 suites checked
    group visibility, not pixels from above, so they missed it.
  - F5-T1 relies on it: plan-review item 1 and focus item 4 say "the ground is opened … the highlight shows on real
    r128".
- **Fix (FS's call):** give `groundOuter` a hole: the plot outline, or at least the footprint. Or skip drawing it inside
  the footprint while level B is shown. Then re-run `node tests/qa/run-f5-t1.mjs`.

## Focus list

1. **Flight timing (ruling 1).** Pass.
   - Sample keyboard pick: 1.22-1.30 s of summed capped steps, no step longer than 2x the mean speed for its capped dt,
     eye ≥ 1 m on every frame, lands exactly on my pose.
   - Observation, mean frame time: 72-91 ms with the suite alone (wall clock 1.22-1.37 s, judged); 112-140 ms in
     parallel runs (wall clock 1.57-1.82 s, not judged).
2. **Room groups.** Pass.
   - Model: sample 14 rooms / 2 groups, maximum house 40 / 4, a basement house lowest first, plan names, LEVEL_LABEL
     labels.
   - Page: the `<optgroup>` labels and option texts equal mine; "Go to room…" (value "") comes first.
3. **Pose oracle.** Pass.
   - My own A-14 + A-12 for every room of 4 houses x 3 thetas, to 1e-9: theta kept, phi 35 / 15, radius clamp, target
     Y floor = lowest floorY. Reset is not clamped.
   - Eye ≥ 1 m on every recorded frame.
   - FS's signature is `forRoom(house, roomId, current, limits)`.
4. **Basement.** **Fail: B-1.**
   - The geometry is right: level B selected, groundCap hidden, levels above hidden, phi 15°, and the eye → target line
     crosses Y 0 inside the footprint for every basement room x 8 thetas.
   - But nothing in the pit renders, because `groundOuter` covers it.
5. **Redirect and cancel.** Pass.
   - A pick 0.5 s into a flight continues from the interpolated pose (< 0.2 m) with no per-frame jump, and lands on my
     pose from that moment.
   - Wheel mid-flight: radius = interpolated radius x exp(100 · wheelK), target kept, no snap.
   - Mouse down and ArrowLeft stop the flight at once, and the pose stays.
   - Tab on the focused canvas does not cancel.
   - A hidden tab (visibilityState 'hidden') stops the frames. On return, the first step is exactly one 100 ms capped
     step.
6. **Clearing.** Pass.
   - All, another level, Reset, Roof on (through the switch), "Go to room…", a Q18 rebuild while open, and a context
     restore each clear the highlight, the caption and the select. Reset, the rebuild and the restore also stop the
     flight.
   - After "Go to room…" the renderer's geometry count is back to the no-selection count.
   - Leaving stage 5 mid-flight: no flight and no pose change on return.
   - Orbit, zoom and pan (right drag) keep the selection.
7. **Caption.** Pass, with one note.
   - "Room · Level" text is exact for every pick.
   - At 360x640, "Master bedroom · Basement": inside the viewport, no page scroll, not under the panel toggle, the room
     part whole, the level part with `text-overflow: ellipsis`.
   - Note: at 360 px the level part fits whole (79 px), so the ellipsis never actually triggers here. The CSS is in
     place.
8. **Look and budget.** Pass.
   - At 22:00 winter a pick leaves the lights, the background and `look()` identical.
   - Maximum house with a room selected: 22 meshes (21 + highlight).
   - 2 re-selections keep the geometry count. The highlight casts and receives no shadow and is lin(#C2410C), inside
     the room rectangle just above the floor.
   - On the sample, the highlight changes the real r128 frame.
9. **Version markers.** Pass. `v3-room` is enabled and ≥ 44 px (desk and phone); tour start / pause / stop stay
   disabled. f4-t1-view and f4-t3-view drop `v3-room` from their later-task sets when the finder is live.
10. **Full run.** 411.4 s at `--jobs 3` (≤ 420 s). Red only on B-1.

## Mutations

| Mutation | Result |
|---|---|
| `finderPhiB` 15 → 35 | caught (model P and B, view) |
| `flightMs` 1200 → 2000 | caught (flight duration, view) |
| highlight `castShadow = true` | caught (view, every pick) |
| Reset view without `stopAnim()` | caught (clearing: still flying) |
| `clearSelection` without `geometry.dispose()` | caught (new geometry-count check after "Go to room…") |
| `select` without disposing the old highlight | caught (re-selection geometries) |
| wheel: `stop()` after reading the pose | survived; equivalent (`api.get()` returns `S.pose`, which `stop()` does not change) |

## Test changes in this round

- f5-t1-view rewritten to the 30 s budget: one desk page for the sample and the maximum house, plus one phone page.
- New checks:
  - the duration rule from ruling 1, with the frame time as a note;
  - Tab does not cancel; a hidden tab resumes with one capped step; pan keeps the selection;
  - Roof on through the switch clears the selection (TL Q3); the rebuild is now Q18;
  - 22 meshes exactly; levels above hidden; basement highlight pixels, with a raycast that names the occluder;
  - the cleared highlight is disposed;
  - the phone caption with "Master bedroom · Basement" (pairs that include the moved room are dropped, as the Q-rooms UI
    does).

Round 1 verdict (superseded by round 2): FAILED
