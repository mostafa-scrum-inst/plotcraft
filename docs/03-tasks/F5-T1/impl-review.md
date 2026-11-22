# F5-T1 — TL implementation review (round 1), 2026-11-22

Scope: worktree /home/user/plotcraft-f5t1, branch `f5t1` at 2809f73. Reviewed against:
- `plan.md` §11 amendments;
- my `plan-review.md` (required items 1–6, rulings Q1–Q5);
- PM round 12 (Q6 caption, Q7 select);
- F5-S1;
- A-12 / A-14 as amended.

## Evidence
- **Focused run in the worktree only.** `--three --e2e --only finder,camera,budget,scene,view3d` passed in 13.6 s:
  - three: 77;
  - e2e: view3d 97, view3d-real 48;
  - `cam.test`: 10/10.
- **Real r128, my own picks** (sample, dpr 1):
  - At 360x640, Bedroom 1 from the Tour tab: caption "Bedroom 1 · First floor".
  - At 1280x800, Living: caption "Living · Ground floor". The Ground level is selected and Roof is off.
  - At both sizes, the orange frame sits inside the walls and the room fills the view. Meshes: 16 (15 + highlight). No console errors.
- **Code read:**
  - the `scene.js` driver, `flyTo`, cancel and selection;
  - `finder.js`;
  - the `camera.js` interrupt order;
  - `PC.cam.forRoom` and `roomGroups`.

## Plan-review items
1. **Basement phi 15°.** Met. The unit test checks the ground crossing inside the footprint for 12 rooms × 16 thetas. The phi-35 mutation is killed.
2. **Cancel before the delta.** Met.
   - `interrupt()` runs before the pose is read, for pointer-down, move, wheel and the canvas keys. Tab does not cancel.
   - The call order is tested, and the mutation is killed.
3. **Caption "Room · Level" (PM Q6).** Met.
   - One `caption(parts)` helper, shared with F5-T2.
   - The level part truncates with an ellipsis and the room name stays whole.
4. **Select state (PM Q7).** Met. The select keeps the chosen room until the selection is cleared.
5. **Naming and docs.** Met: `PC.view3d.flyTo` runs on the shared driver (`animate` / `stopAnimation`).
6. **Full run measured.** Met: 450.2 s, red. See the rulings below.

**Q1–Q5:**
- Q1: the Y floor is the lowest floorY, and Reset is unchanged.
- Q2: smoothstep restarts from the interpolated pose.
- Q3: All, any level change, Reset, Roof on, the placeholder, a rebuild and `close()` clear the selection; orbit, zoom and pan keep it.
- Q4: no new e2e file.
- Q5: one geometry per pick, the old one disposed, counted; nothing left after `close()`.

The highlight casts and receives no shadows. The look is untouched (tested at 22:00 winter). The budget is 22 of 40 on the maximum house with a room selected.

## Rulings on the full run (impl-notes §3–§4)

1. **Flight duration on SwiftShader: option (a).** The 100 ms dt cap stays (A-12). It is the anti-jump rule after a stall or a hidden tab, and the tour uses it too.
   - QA measures flight progress as the sum of capped steps (`info().flight.t`): 1.2 s of steps, landing exactly on `to`.
   - Wall time is checked only when the mean frame time is ≤ 100 ms. Real devices run far above 10 fps, and the mock test pins 1.2 s with a controlled clock.
   - Option (b), a 250 ms cap, is rejected: at 4–8 fps it makes every flight a visible jump.
   - I sent this to QA directly.
2. **Run time.** I gave QA a budget for `run-f5-t1` of **≤ 30 s** (it was 79 s):
   - real-r128 section A keeps 3 picks (ground, first, one mid-flight redirect), plus a basement pick if its fixture has one;
   - the room-by-room coverage stays in the node / mock layer.

   The full run must be back at ≤ 420 s at `--jobs 3` before merge. FS's own additions (about 3 s, no new page loads) are fine.

## Findings
7. **Pre-existing timing flake. Required before merge: a one-line FS fix in this branch.**
   - `tests/unit/footprint.test.mjs` "deterministic; and fast enough on the largest plot" times one cold `analyse` against 500 ms.
   - Since F4-T3 that call also includes the vegetation scatter.
   - Under load (load average about 4 while other runs were going) it failed for me at 531–657 ms on **both** this branch and main.
   - A-6 already allows "best of three if the parallel run makes it noisy". Take the best of 3 cold calls, with `clearMemo()` before each. Keep the 500 ms bound and the memo-hit and determinism asserts.
8. **Desktop framing (non-blocking, Designer F5-T3).** At 1280x800 the picked room is centred on the canvas, but the 320 px side panel covers its right quarter, so the room sits slightly under the panel edge on wide rooms. Possible fix: shift the target towards the free area, or account for the panel in `forRoom`. This is an F5-T3 presentation point, not a correctness issue.
9. **Level change during a flight (non-blocking).** A manual level change clears the selection, but a running flight finishes its path. This is accepted: it is not a camera gesture under F5-S1, and the user lands near the room anyway.

## QA focus list
1. **Flight timing per ruling 1:** summed capped steps; wall time only when frames are ≤ 100 ms; frame time recorded as an observation.
2. **Room groups:** sample 14 in 2 groups; maximum house 40 in 4 (CD-4); a basement house lowest first; plan names; `<optgroup>` labels with the full level names.
3. **Pose oracle:** your own A-14 implementation for every room: theta kept, phi 35 / 15 (basement), radius clamps, target Y floor; eye ≥ 1 m on every frame.
4. **Basement:** the ground is opened, levels above are hidden, the eye-to-target line crosses ground level inside the pit, and the highlight shows on real r128.
5. **Redirect and cancel:**
   - a mid-flight pick continues from the current pose with no per-frame jump;
   - pointer, wheel and key cancel with the gesture applied to the interpolated pose;
   - Tab does not cancel;
   - a hidden tab mid-flight resumes with one 100 ms step.
6. **Clearing:** All, another level, Reset, Roof on, the placeholder, a Q18 rebuild, a context restore and leaving stage 5 each clear the highlight, caption and select. Orbit, zoom and pan keep them.
7. **Caption:** text "Room · Level". At 360 px with "Master bedroom · Basement", the level part is ellipsised and the room part is whole. The caption is not under the panel toggle.
8. **Look and budget:**
   - `goTo` at 22:00 winter leaves the lights, background and `look()` identical;
   - the maximum house with a room selected has 22 meshes;
   - one highlight geometry alive, the old ones disposed.
9. **Version markers:** `v3-room` is enabled. The tour controls stay disabled until F5-T2.
10. **Full run:** ≤ 420 s at `--jobs 3` after your trim and finding 7.

## Addendum (TL, QA B-1), 2026-11-22
- **Fix 88dd164 (main): approved.** `groundOuter` is now a ShapeGeometry square of `outerK x R` with the footprint as its hole, built from the same `footHole()` path as `groundPlot`.
  - The winding is counter-clockwise, so after the −π/2 turn the normal is +Y and the u/v → X/Z mapping matches `groundPlot`.
  - Mesh count, material and the 0.05 m drop are unchanged.
  - With `groundCap` shown (every view except B), the footprint is covered as before.
- **Why the footprint hole:** it is the minimal opening, and it avoids the step a plot-outline hole would leave at the plot edge. Hiding `groundOuter` for B was rejected (the outside ground would vanish).
- **Regression tests:** the `shell.test` outline and hole check, and 2 real-r128 checks. The raycast to the basement highlight and the level-B first hit both fail on the old code.
- **My re-run in main:** `--three --e2e --only shell,view3d-real` passed in 52.7 s (three 77, shell 596, view3d-real 50).
- **Visual check:** the QA shot `A-basement-1280x800.png` shows the Maid's room with its highlight in the open pit.
- **Process note:** the bug dates from F4-T1. My F4-T1 / F4-T2 reviews looked at the basement through the mock and the sample, which has no basement; no real-r128 basement shot was taken. From now on, real-r128 checks of a level-dependent view include a basement house.
- **QA:** re-test B-1 at 360x640 and 1280x800 (finder pick and the Basement level radio), then run the full run at 420 s or less.

VERDICT: APPROVED
