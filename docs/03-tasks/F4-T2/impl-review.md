# F4-T2 proper — TL implementation review (round 1)

Scope: the worktree /home/user/plotcraft-f4t2 (branch f4t2-proper on 9a70a49, uncommitted), against plan.md, designer-plan.md, the plan-review rulings and architecture A-8..A-12/A-16.

## Evidence

- Focused run in the worktree: `node build.mjs && node tests/run-all.mjs --unit --three --e2e --only view3d,outdoor` passed in 17.2 s. Results: unit 386/0, three 57/0, e2e outdoor 9, view3d 54, view3d-real 38. Lint: 0 violations, 2 length warnings. No full run here (QA owns that, in the main tree).
- Real r128 renders, dpr 1, sample project, 1280x800 and 360x640:
  - roof off; flat on; pitched on; terrace + usable + lift on;
  - furniture full/modern (the default) and sparse/classic;
  - gate right;
  - a back view orbited 180°, showing pool, seating and needle.
  - Every shot has 12 meshes, 11 draw calls (12 with the roof), and no console errors. The pool water is present (#0c6294 linear).

## Findings

1. **Roof, correct and as ruled.**
   - Flat roof: slab, parapet and wall bands, which close the storey gap with Roof on.
   - Pitched roof: a 30° gable with no overhang. The ridge runs along the long side (alongX = w >= d), and the gable triangles use the wall colour. The prism faces are planar and wound outward (inner-point flip in util.poly).
   - Terrace + usable: high parapet, a pergola over the back third, the stair head, and the lift overrun box. All read correctly at both sizes.
   - usable + pitched → flat holds (house.js).
2. **Furniture.**
   - PC.furnish follows the A-11 rule, including the centre piece's offset turned when W < D, with a 1e-9 inside test and `> overlap + 1e-9` for clashes. FS also matches the QA F3-T3 reference on 19 220 rooms.
   - Renders: sparse/classic visibly thins the pieces and changes their colours. Full/modern furnishes every room, with no piece crossing a wall in the shots.
3. **Outdoor.**
   - Wall: 1.2 m via addSeg, 0.1 m inside the edge. The gate gap sits at 25/50/75 % with posts straddling the wall; the render shows the gate moving to the right.
   - There is no gate without the wall, and q-gate is disabled while the wall is off.
   - Parking pads and the 2.4 m canopy, the pool rim and flush water, the seating pad, table and benches, the entrance step, and the north needle (two addFlat triangles) all render. The new seating-omitted warning uses the PM text.
4. **Budget and loop.** 12 meshes on the sample and 18 on the maximum house, against a budget of ≤ 40. There is still one shadow light and the render loop stays on demand.
5. **Brief constraints.**
   - The deliverable is still a single file with r128 from the cdnjs tag only.
   - Every colour goes through PC.three.col.
   - The site memo key now includes wall, gate and seating; the house key changes with Q18, so a rebuild follows.
   - access.js split and the Undo tab-switch check are both done, as asked in the Step 0 review.
6. **Non-blocking.**
   - (a) The hall-pocket limit is recorded in impl-notes; accepted.
   - (b) With the sample camera, the pool and seating sit behind the house. They are visible only after orbiting. This is not a defect, but it is a point for the client demo.
   - (c) A store commit of a structural answer made directly on stage 5, with no plan sync, shows "3D view unavailable" (house = null). The UI cannot reach this, because the stage guards lock stage 5, so no action is needed.
   - (d) The 2 lint length warnings may stay.

## QA focus list

1. **tests/qa/f4-t1-view.mjs lines 344 and 369.** These lines list `v3-roof` as LATER (disabled) and check that its switch looks disabled. The switch is now enabled by design. Make both checks version-aware: in F4-T2 and later, expect it enabled and expect the toggle to change the render.
2. **Roof switch, every roof type.** Test flat, pitched and terrace. Test usable with and without the lift. Combine with All / Ground / First, and check the bands, the overrun and the pergola at 360x640 and 1280x800. Pitched must be unavailable while usable is on.
3. **Furniture.** Test sparse and full in each Q18 style. Check that no piece crosses a wall or door. Check that a Q18 change rebuilds the colours, and that the A-11 reference stays the oracle.
4. **Wall and gate.**
   - Test the gate at left, centre and right, on non-axis street edges too.
   - With the wall off: no gate, and q-gate disabled.
   - Gate posts sit on the wall line.
5. **Seating.** Check the placement order (back, wider side, other side, front). Check the seating-omitted warning text and its question link on a tight plot.
6. **Pool, parking and needle.**
   - Check the pool water flush with the rim.
   - Check the canopy at 2.4 m.
   - The needle sits in a free corner pointing to true north; follow PM north for a rotated plot.
7. **Budget.** On the maximum house, check ≤ 18 meshes, no console errors, the on-demand loop idle after a build, and a context-loss restore with the new batches.
8. **Undo.** Make a plan edit, switch to another tab, then Undo. The undo must not apply to the wrong level.
9. **Regression.** Run the F4-T1 view, light and tour suites and the Step 0 plan suites in a full run, as QA's run in the main tree does.

VERDICT: APPROVED
