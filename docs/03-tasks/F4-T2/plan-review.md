# F4-T2 plan review (TL, step 3b) — round 1, 2026-11-21

Reviewed: `docs/03-tasks/F4-T2/plan.md` (FS), against CD-4 / CD-5 (binding), `F3.md` (PM decisions 1, 2, 4, 5, 9; CTO debt 6, round-2 guard, 10-room cost note), F4-S1 / F3-S4, A-4, A-7, A-8, A-9, A-10, A-11, A-16, `F4-plan.md` and the F4-T1 outcome review.
Code opened: `core/layout.js` (`layoutShape`, `column` key `i * 16 + j`, the mask loop and its 1e-9 rule, `cellLay` key `ci * 256 + mask`), `core/validate.js` (blocking rules), `three/util.js` (`BoxBatch`), `three/build-shell.js`, `core/house.js`.
`docs/03-tasks/F4-T2/designer-plan.md` (Designer) arrived during the review and is ruled on below. PM round 10 did not exist when I finished, so Q2 / Q3 / Q5 / Q7 / Q8 are left to the PM.

## Summary

The plan is good and carefully measured. The probe found a real generator bug that blocks the client's CD-4. I confirmed it in the code: `cellLay` keys its memo by `ci * 256 + mask`, so at n ≥ 9 the keys of two cells collide and a room is lost. The fix keeps every result at n ≤ 8 (no collisions there), and the regression test with its mutation is right.
- The Undo design is the right one: a content guard (the snapshot's `after` must still deep-equal the plan), so it cannot survive an R5 regeneration or a resync.
- CD-5 is a pure function over the drawn plan.
- F4-T2 proper needs no new r128 API, keeps the mesh count at 18 and keeps C0 first.

The rulings below settle the questions and add four required items. Approved: no re-plan round. Step 0 lands and gets its own implementation review before any F4-T2-proper code, as the plan says.

## Rulings on the TL questions

**Q1 — 10-room speed: the gate stays at worst < 300 ms in node (best of 3) on the 105-case grid. CD-4 is binding, so "stay at 8" is not a fallback.** The order is:
1. **Output-identical speed-ups 1–4** (score first, prefix pruning, branch and bound, a shared column memo). They are accepted with two exactness conditions:
   - **Tie order.** The mask loop's rule "replace only when better by more than 1e-9, in mask order" is order-dependent when near-ties chain. Pruning (2, 3) may only *discard* partitions. Every surviving partition is compared in the **original mask order** with the unchanged 1e-9 rule. Either the enumeration visits partitions in increasing mask order, or the survivors are collected with their mask and replayed in that order.
   - **Prune margin.** Branch and bound discards a partition only when its lower bound exceeds the best so far by more than **1e-6**, a thousand times the tie tolerance. Then a discarded partition can never have been the one the sequential rule keeps.
   - The proof stays empirical *and* structural: the golden fixture, the 2 400 per-programme hashes, the new 10-room golden recorded after the key fix, and one mutation per speed-up.
   - The shared column memo (4) is keyed on `(S, f, i, j)` and the room list. `column` reads nothing else (no `L`), so this is exact.
2. **If the gate is still missed:** at n ≥ 9 there are **no existing outputs to preserve**, because every 9- and 10-room result was invalid before the key fix. So a search reduction **for n ≥ 9 only** is allowed. Examples: a lower `topAssignments` cap, one room order instead of two, or the `f = 1` pass skipped when `fFill ≤ 1`.
   - It must still pass the full 10-room re-proof: every grid case lays out and is valid by `check`, worst < 300 ms, and the 9–10 sweep has no invalid result and no-layout ≤ 5 % at ≤ 85 % fill.
   - n ≤ 8 stays byte-identical (golden + hashes).
   - The 10-room golden is re-recorded after this step and named as such in the impl notes.
3. **Only if both fail:** stop and report to me and the CTO with the measured numbers. The options are then a raised node bound for n ≥ 9 with a stage-3 "Laying out…" state, or the client is told. Going back to 8 needs the client.
- **Stage-3 "Laying out…" state:** not in Step 0. The plan's `go(3)` maximum-house bound (< 1 200 ms in node, logged) stays as written. The phone check judges entry time.
- **9–10 sweep (300 programmes):** in the unit step if it takes ≤ 10 s after the speed-ups. If not, its own run-all step under `--unit`, never skipped.

**Q4 — `MAX_PAIRS_PER_LEVEL` stays 6.** CD-4 does not ask for more, and the 10-room grid already uses 5 pairs.

**Q6 — no proof needed: a separating state exists.**
- `validate` rule `fp-veg-over` (Q3 footprint % + Q4 vegetation % > 100) is blocking.
- Q4 is not a signature input (A-7: vegetation is appearance / site class), so raising Q4 vegetation on an approved, fresh sample makes stage 2 invalid while every plan stays fresh. That is exactly the state that pins `reachable`.
- `field-invalid` on a non-layout field (e.g. Q8) is a second candidate.
- **Verified in node:** the approved sample with Q4 vegetation at 80 % (footprint 25 %) gives the blocking `fp-veg-over`, stage 3 `valid: true, reachable: false`, and `PC.house.build` → `null`.
- Test: approved sample + vegetation so that footprint + vegetation > 100 → `PC.stages.status(s)[3].valid === true`, `.reachable === false`, and `PC.house.build(s) === null`. The mutation "drop `reachable`" must fail it.

**Q10 — gable: 30° pitch, no overhang — accepted.**
- The ridge runs along the longer footprint side; the rise is `tan 30° x short / 2`.
- The two sloped faces use `exteriors.roof`; the two gable triangles use `exteriors.wall`, since they are wall surfaces. A-10's key list is updated to say so.
- The terrace pergola over the back third at 2.4 m is accepted. The Designer judges the shots.

**Q12 — `BoxBatch.addPrism` with hand-built triangles: accepted; the whitelist is unchanged.**
- Flat shading: each face gets its own vertices and its face normal.
- The vertex count is tracked like `add` (`userData.prisms`).
- Winding is outward and tested: each face's normal must point away from the prism centre.

## Required (binding; checked at the implementation reviews)

1. **Q1 exactness conditions** as above: mask-order comparison of survivors, 1e-6 prune margin, a mutation per speed-up, and the n ≥ 9-only fallback with the full re-proof.
2. **Roof on = a closed exterior** (correctness of the Roof view).
   - With 1.2 m dollhouse walls and `roof.baseY` at the top storey's full height, the roof would float 1.8 m above the wall tops (Q8 3.0 m: walls end at `floorY + 1.2`, the roof starts at `floorY + 3.0`).
   - So the `roof` batch also carries the **exterior wall bands** of every above-ground level: from `floorY + wallH` up to `baseY + pitch`, flush with the exterior walls, colour `exteriors.wall`.
   - With Roof on and "All", the house therefore reads as a closed building with its roof. With Roof off it is the dollhouse.
   - The bands add boxes, not meshes (one roof batch).
   - `roof.test`: the band tops equal `roof.baseY` for every above-ground level; there are no bands with Roof off or with a single level selected (the group is hidden).
   - The Designer judges the shots; windows are a non-goal.
3. **Oriented geometry for `build-site.js`.** `BoxBatch.add` is axis-aligned in T, but the boundary wall runs along arbitrary plot edges and the north marker turns with Q5.
   - Add `BoxBatch.addSeg(x0, z0, x1, z1, thick, y0, y1, hex)`: an oriented box along a segment, 24 vertices with computed face normals. Walls use the inside offset of the plot edge. Corner overlaps at vertices are accepted.
   - Add `addFlat(pts, y0, y1, hex)`: a convex polygon in XZ, extruded from `y0` to `y1` (top fan, bottom fan, side quads). The Designer's north needle is two of them, 0.04 m high.
   - Both stay in `util.js`, so the whitelist is unchanged.
   - `site.test`: each wall segment's centre line is within 0.2 m inside its plot edge, and the gate gap is on the street edge (as planned). The marker direction equals `northDeg` to 1e-9.
4. **TL item 2 test** as in Q6 (in Step 0).

## Rulings on the Designer input (`designer-plan.md`)

- **Hook `plan-undo`, not `btn-undo`: accepted.** Stage 1 already owns `btn-undo` and hooks are page-unique.
  - FS uses `plan-undo` everywhere the plan says `btn-undo` (`hooks.json`, `stage-plans.js`, tests).
  - Icon-only 44 px, `hidden` while nothing can be undone, placed between Regenerate and Approve with the Designer's measured CSS (no tool-row height change; the 640x360 landscape rule is required).
  - After a press, focus moves to `btn-regenerate`.
- **North marker: accepted.** A two-tone needle (N half `siteColors.northMarker`, S half `poolRim`), 0.04 m high, `L = clamp(0.06 x max bbox side, 1.5, 3)`.
  - The candidate corners are front-left, front-right, back-left, back-right, each moved in until clear. It is never omitted.
  - A-9 `site.northMarker` becomes `{ u, v, L }`, computed in `site-outdoor.js`.
  - Tests: it turns by exactly ΔN, and the N tip vector equals the A-13 north vector.
- **Boundary wall 1.2 m** (one constant) **and gate posts 1.4 m in `exteriors.trim`: accepted.** There is no gate leaf (`siteColors.gate` stays unused). The Designer agrees with FS Q7 (no gate without the wall), which is still the PM's to confirm.
- **Pool: accepted.** A flush opaque `poolWater` plane at Y 0.03 over exactly the pool rectangle, plus a 0.3 m wide, 0.1 m high rim outside it. No transparency.
- **Roof art direction: accepted as written.** It is compatible with required item 2: the wall bands sit under the roof, so the roof does not float. The Designer judges the band shots.
- **Lift overrun: accepted, not optional.** On a usable roof with a lift, A-9 `roof.liftHead` is the lift rectangle, drawn as a 1.2 m block in `exteriors.parapet` in the roof batch. It is one box, and a lift ending under a usable roof reads wrong. Test with the stair head.
- **Tree exclusion: accepted for F4-T3.** Trees clear footprint + 1 m **+ the canopy radius at its largest scale** (1.35 x 1.15 ≈ 1.55 m); shrubs keep footprint + 1 m. A-9 is updated; F4-T3's vegetation test uses it.
- The furniture, outdoor-item and vegetation shapes in the Designer's §4 are the reference for `build-interior` / `build-site` and for F4-T3.

## Non-blocking notes

- The A-4 sentence on forward-only drafts (a 9–10-room draft is refused by an older build): accepted. FS writes it with C0 / Step 0.
- `column`'s key `i * 16 + j` is safe up to 16 rooms. The comment the plan proposes is enough.
- CD-5: the partner rule is a fixed point, so a chain counts. Whether the hall pocket counts is the PM's call (Q3). The function takes `HALL_ACCESS_MIN` from `PC.C`, as planned.
- Furniture `color` stored as resolved hex in the model is accepted (it keys the rebuild on Q18).
- Pool as a flush water plane: the Designer decides (Q11). `poolWater` needs `rotation.x = −π/2` like the other planes, and the mock checks the Euler.

## Settled in architecture.md / F4-plan.md

- A-8: the memo key `ci * (1 << n) + mask`; the 10-room proof rule (gate, exactness conditions, n ≥ 9-only fallback).
- A-9: the refusal has a separating state (Q4 vegetation).
- A-10: gable triangles in `exteriors.wall`; Roof on carries the exterior wall bands; 30° gable, no overhang.
- A-11: `BoxBatch.addPrism`, `addSeg` and `addFlat`.
- F4-plan F4-T2 rider.

## For the PM / Designer / QA

- **PM:** Q2, Q3, Q5, Q7 and Q8 are yours. Required item 2 changes what "Roof on" shows (a closed exterior). It is a natural reading of 3.3 ("the Q9 roof"), but tell me if you want the dollhouse walls kept under a floating roof.
- **Designer:** your input is ruled above. Remaining: judge the roof-band, gable, pergola, wall and pool shots in the implementation round.
- **QA (QA-first, as in F4-T1):** the suites that hard-code 8 rooms per floor, and the strip on stage 4, become version-aware before Step 0 items 0.1 and 0.7 land.

VERDICT: APPROVED
