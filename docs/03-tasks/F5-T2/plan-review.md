# F5-T2 plan review (TL, step 3b), 2026-11-22

Reviewed: `plan.md` (FS, df8b964), against:
- F5-plan F5-T2;
- F5-S2 and G1;
- A-12 (driver as built) and A-14;
- F5-T1 `outcome.md` §3 and my F5-T1 outcome review;
- my F4-T3 riders (tree tops, look, budget);
- PM answers Q10–Q13 (goals-and-stories round 13).

The plan is sound:
- a pure tour plan;
- the tour as a second client of the F5-T1 driver, with no new render path;
- the eye floor derived from the vegetation table;
- full-tour coverage in the mock clock tests, so e2e never waits for real tour time.

The items below go into `plan.md` before code. No re-review: I check them at the implementation review.

## Required items

1. **PM answers (round 13).**
   - Q10: the caption reads "Overview" at the overview stops, and "Room · Level" at room stops.
   - Q11: the current room gets the finder's highlight; overviews get none.
   - Q12: after Stop or a gesture, the camera, level and Roof stay as they are; the caption and highlight are cleared and the select shows "Go to room…".
   - Q13: speed is session state, Normal by default, and not in the draft.
2. **Eye floor from the table.** `eyeFloor = (canopyY0 + canopyH) × scale[1] + TOUR.treeGap` (0.5), read from `PC.data.vegetation`, with no literal 4.83 or 5.33. Add a mutation that changes the table.
3. **Clamp does not bite at stops.** A unit test asserts that every control pose (`fromEyeLook(eye, look)` at each stop) is unchanged by `PC.cam.clamp`. The clamp may only act on curve overshoot, so Stop at a stop never shifts the view.
4. **Programmatic level and Roof changes are silent.** The tour's per-stop `setLevel` and radio sync must not fire the UI's "level change ends the tour / clears the selection" handlers. Setting `.checked` fires no `change` event; keep it that way and test it: a tour across two levels keeps running.
5. **Basement on real r128** (B-1 process rule). The `view3d-real` seek to a basement stop on the maximum house is required, not optional. Assert that the room is the first visible hit and that highlight pixels are drawn.
6. **Full run measured** at `--jobs 3` before the implementation review (target 420 s; 413.0 s now, so the headroom is about 7 s). The browser additions stay at about 2 s of tour wait per viewport in existing loads.
7. **Docs.**
   - A-14 is updated as built: `getPoint` timing, leg times, level switch at leg start, eye floor, look at floorY + 0.5, what ends the tour. I update A-14 and the F5-plan rider in this review.
   - The FS writes the "as built" notes at the end.

## Rulings on §7 (TL)

1. **`getPoint(u)` with time-linear segments: approved.**
   - r128's `CatmullRomCurve3.getPoint` maps `u` uniformly per segment, so stop i is reached exactly at `tᵢ`.
   - Speed varies between legs (fixed leg time, different lengths) and a little within a leg. The smoothness bounds cover it.
   - `getPointAt` and `arcLengthDivisions` are dropped from A-14. The `getPointAt` mutation is kept.
2. **Leg times: FS's arithmetic.**
   - There are `rooms + 1` legs: the 2 overview legs take 4 s each, and the `rooms − 1` room-to-room legs take 3.5 s each. The sample takes 53.5 s.
   - A-14's 57 s example counted 3.5 s per room and was wrong for a path that never stops. It is corrected to 53.5 s.
   - The maximum house takes 144.5 s. F5-S2's 30–90 s applies to the sample.
3. **Level switch at the leg start: approved.** The room being approached is never hidden.
   - On an upward leg the newly shown level may briefly cover the room just left. The view is moving away from it, so this is acceptable.
   - The Designer judges it in F5-T3. A midpoint switch would be a data-free change if needed.
   - The overview leg at the end switches to All at its start.
4. **Eye floor everywhere: approved** (see required item 2). One rule:
   - it lifts only low-ceiling ground eyes;
   - it replaces A-14's 1.5 m runtime clamp;
   - it covers Catmull-Rom overshoot.

   No per-tree floor.
5. **Look point at floorY + 0.5: approved,** the same as the finder. A-14's `baseY` was an error, since the floor sits at `baseY + slab`.
6. **Driver API change: approved.**
   - `step(dt)` returns `{ pose, done }`, and the driver assigns `pose`.
   - `end(reason)` is called exactly once, with `done | input | close | reset | build | replaced | stop`.
   - While `paused`, no frames are requested; Resume's first dt is 0.
   - `flyTo` migrates with behaviour unchanged: the F5-T1 `finder.test` and `camera.test` stay green without edits.
   - A gesture while paused ends the tour (`input`).
7. **Every tour frame clamped** with the orbit limits after the eye floor: approved, with required item 3.
8. **`PC.debug.tourSeek(τ)`: approved** as debug-only.
   - It lives under `PC.debug` like `scene()`, has no UI, and changes only `τ`. Stop visibility follows on the next frame, as in a normal run.
   - No product code may call it, which lint or a grep test checks.
9. **Other controls during the tour: approved.** A level radio, Reset view, Roof on and a finder pick each end the tour (`replaced` for a pick), then apply as usual.
   - The Light tab and the speed radios do not end it.
   - Start clears any finder selection first.

## Other checks (non-blocking)

- **Highlight per stop.** One geometry per stop (42 on the maximum house) is the F5-T1 Q5 rule; dispose counts are tested.
- **Rotation mid-tour.** On a phone, a resize mid-tour keeps the plan's overview pose from Start, which is acceptable. A rebuild ends the tour anyway.
- **G1 tap count.** The tested count (4 on a phone, 3 on desktop) assumes no stored draft. With a draft, Load sample adds a confirm tap: 5 taps, still within the 6-tap limit. Test both.
- **Mutations.** Add to the planned list:
  - the clamp biting at a stop;
  - the programmatic level change ending the tour;
  - `end()` called twice.

VERDICT: APPROVED
