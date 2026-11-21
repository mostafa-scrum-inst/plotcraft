# F5-T1 plan review (TL, step 3b), 2026-11-21

Reviewed: `plan.md` (FS, af22cd6), against:
- F5-plan F5-T1;
- F5-S1;
- architecture A-10, A-11, A-12 and A-14;
- my F5 riders in F4-T3 `outcome-review.md`;
- PM answers Q6 / Q7 (goals-and-stories round 12).

The plan is sound:
- pure pose and room groups in `core/cam.js`;
- one animation driver that the tour will reuse;
- cancel through the existing `onInput`;
- the on-demand loop kept;
- no new browser file.

All four F5 riders are already in it: 40-room maximum house, look untouched, highlight in the budget, F5-T2 reuse. The tour-eye vs canopy rider is F5-T2's and stays open there. The items below go into `plan.md` before code. No re-review: I check them at the implementation review.

## Required items

1. **Basement view, A-14 amended.** At phi 35° the line from the eye to a basement target at `floorY + 0.5` (about 2.3 m below ground) crosses Y = 0 about `2.3 × tan 35° ≈ 1.6 m` from the target. For a room along the footprint edge that crossing is outside the pit opening, so the ground slab and pit wall hide the room centre.
   - **Rule:** basement rooms use **phi = 15°**. Everything else follows A-14 (theta kept, the same radius).
   - **Unit test:** for every basement room of the test houses (maximum house, plus a basement house with edge rooms), the eye→target segment crosses Y = 0 inside the footprint, and the eye is at 1.0 m or more.
   - Other levels keep 35°.
2. **Cancel order.** An input during a flight must cancel **before** the controls apply their delta. The gesture then acts on the current interpolated pose: no snap to `to`, no lost first delta.
   - Test: a wheel event mid-flight gives the interpolated pose × the zoom factor.
   - Add the mutation "cancel after the delta".
3. **Caption (PM Q6).** The caption reads the room name, " · ", then the full `LEVEL_LABEL` name, e.g. "Bedroom 2 · First floor".
   - It comes from one helper, `caption(room | null)`, shared with F5-T2.
   - CSS: the room name stays whole and the level part truncates with an ellipsis at 360 px. The Designer checks "Master bedroom · Basement".
   - The e2e checks assert the full text.
4. **Select state (PM Q7).** As FS proposed: the select keeps showing the chosen room until the selection is cleared. Choosing the same room again does nothing, which a native `<select>` already does (no `change` event).
5. **Naming and docs.**
   - A-12 named `PC.three.flyTo`; the as-built API is `PC.view3d.flyTo(pose, ms)` on the shared driver. A-12 is updated.
   - The F5-plan "camera.js" file entry becomes `scene.js` (driver) plus `finder.js`.
6. **Full run measured** at `--jobs 3` before the implementation review (target 420 s; 393.8 s now).

## Rulings on §10 (TL)

1. **Basement target below Y 0: approved.**
   - The A-12 target Y range becomes `[lowest floorY of the house, roof base]`, which is `−pitch + 0.2` with a basement and 0 otherwise.
   - The eye ≥ 1.0 m rule is unchanged, so the camera never goes below ground (F4-S2).
   - With the ground closed, a target below ground only looks at the ground slab, which is harmless. No level-dependent limits: they would make a level change re-clamp the pose, and the view would jump.
   - Test: Reset and a manual pan on a no-basement house are unchanged (Y floor 0).
2. **Redirect smoothness: approved as proposed.** Restarting the smoothstep from the interpolated pose keeps position continuous. The brief ease-in is accepted as "redirects smoothly" (F5-S1). The test bounds per-frame distance across the redirect. No Hermite blend.
3. **What clears the selection: approved, plus one case.** These clear the highlight and caption and return the select to "Go to room…":
   - "All";
   - any manual level change;
   - Reset view;
   - **turning the Roof on** (the room is then hidden under the roof, so the caption would be stale);
   - choosing "Go to room…";
   - a rebuild.

   Orbit, zoom and pan keep the selection. This is consistent with PM Q7.
4. **No new e2e file: approved.** The finder checks run in `view3d.spec` through `finder-checks.mjs`, and the real-r128 highlight check runs in the existing loads.
5. **Highlight geometry per selection: approved.**
   - Fixed 0.08 m bar widths rule out scaling a unit frame. One small geometry per user action, with the old one disposed, is fine.
   - The "no create" rule binds `applyLook` only.
   - The test counts one dispose per re-selection and none left over after `close()`.

## Other checks (non-blocking)
- **Hidden tab during a flight.** rAF stops, and on return dt is capped at 100 ms, so the flight resumes and finishes with no jump. One mock case covers it.
- **Context restore mid-flight.** Counts as a rebuild: the flight is cancelled and the selection cleared, as planned.
- **Highlight in the shadow pass.** Make it `castShadow = false` and `receiveShadow = false`. It is a UI mark.
- **Planned mutations.** The list is good. Add: basement phi 35°, Roof-on not clearing, cancel after the delta.

## Architecture / plan updates (done in this review)
- **A-12:** target Y floor = the lowest floorY; `PC.view3d.flyTo` on the shared animation driver (real dt capped at 100 ms, cancel before the input delta, cancelled by close / Reset / rebuild, idle afterwards).
- **A-14:** basement finder phi 15°; the caption format "Room · Level"; what clears the selection.
- **F5-plan:** an F5-T1 rider.

VERDICT: APPROVED
