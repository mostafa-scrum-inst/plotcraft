# F2-T1 plan review — Tech Lead

## Round 1 — 2026-11-20

Reviewed `docs/03-tasks/F2-T1/plan.md` (sections 1–10) against the F2-T1 block of `F2-plan.md`, `architecture.md` A-4 to A-7 (round 2 signature), the CTO decisions (step 1 round 2 fallback; step 2 rounds 1–2), PM sections 3.1–3.3, 4 and 6.2, and F2-S3.

### Assessment
The plan implements A-6 and A-7 as written and is complete for the task.
- **Edge classes**: outward normal `(dv, -du)` for a counter-clockwise polygon, back when within 40 degrees inclusive: correct, with the 45-degree chamfer and the sample's 26.6-degree edge as test cases.
- **Buildable set, mask, `rectFits`, footprint steps 1–7 and the fallback** (nearest-first 0.5 m candidates, pre-test at `best + 1e-6`, strict improvement, both 20 m2 conflicts): as specified; tolerances in one place.
- **Validation**: I checked the rule table against F2-S3 line by line: five blocking conditions plus `no-fit`, four warnings with effective figures, `level-over` with both numbers and the equal-rounding guard, everything recomputed from state. Summary fields match the story.
- **Signature**: `[w, d, edge]` + core + rooms + pairs in numeric id order; `'invalid'` without a footprint.
- **Gate**: candidate-based, serialised, once per visit, Cancel leaves the identical state object.
- **Hand examples (Q12)**: I recomputed them. Back setback 2.25 m: bounding box 16 x 24.75, ratio 0.646, `sqrt(146 x 0.646)` = 9.71 -> 9.5 and `sqrt(146 / 0.646)` = 15.03 -> 15.0, centre v 15.375 -> footprint v 7.875. Vertex (8.5, 30): area 583, target 145.75, 9.66 -> 9.5 and 15.09 -> 15.0. Counter-case back 3 m: 9.87 -> 9.5 and 14.8 -> 14.5. All three are right; note the first is only 0.03 m above the rounding step, which is fine for a deterministic test.
- **Tests**: the mandatory 6.2 assertions are all there, plus an independent re-statement of the buildable definition, rotation invariance, the fallback shapes and the timing bound.

### Rulings on section 10
1. **Three files under `PC.site` — approved** (A-2 updated).
2. **`PC.validate(state)` with `.blocking(state)` — approved** as is.
3. **Only plans that are valid now count as affected — confirmed.** That is the intent of A-7; wording updated.
4. **Open plot: signature `'invalid'`, plans kept — agreed.** `PC.plans.sync` leaves a stored plan alone while the level's signature is `'invalid'` (it still deletes plans of levels Q7 no longer has). A-7 updated; binding on F3-T1.
5. **Cancel notifies once with `meta.cancelled` — approved.** The extra autosave write is harmless.
6. **`r5Confirmed` reset in `PC.store.go(3)` and `replace` — approved.**
7. **Names — confirmed**: "Master bedroom" outside the bedroom numbering; other rooms numbered per level and type in list order; a single room of its type has no number.
8. **Moved but not shrunk: no warning — confirmed** (the CTO decision ties the warning to the result being smaller than the target).
9. **Candidate order — approved with one addition, see condition 1.**
10. **`invalidFields` entry shape — approved** (`{ q, label, min, max, unitKind }`, limits in metres).
11. **Stage 2 really gated while static — no change, keep `MAX_BUILT = 2`.** Next on stage 2 is disabled anyway until stage 3 exists, so the only visible effect is the "done" mark on step 2.
12. Covered above: the examples hold.

### Conditions (binding; checked at the implementation review)
1. **Parking keeps clear of the entrance.** With candidate (i) as written the sample's two cars land at u 9.75–14.75, straight across the path from the centre gate (u 10) to the front door (u 10). Rule added to A-6: an entrance strip 2 m wide, centred on the footprint's centre line from the front wall to the street, is kept free. Order: directly right of the strip, directly left, front-yard scan avoiding the strip, side yards, and only then the front-yard scan without the strip rule. Sample expectation becomes u 11–16, v 0.5–5.5 (inside the plot, 8 m front yard); the 20 x 20 m default case still ends in the side yard or right of the strip, whichever fits first: pin whatever the rule gives in the test.
2. **Actions with their own confirmation do not go through the gate**: Clear (stage 1) and, in F2-T3, removing a level with rooms use `commit` after their dialog (A-7 updated). No API change in this task; just do not add a second question there.
3. `PC.stages.levelIds` is removed, not aliased (as planned), and no other duplicate of the level list remains (grep in the review).
4. The memo must never return a result for different inputs: include every input of `analyse` in the key (points, edge, three setbacks, footprint %, vegetation %, cars, covered is irrelevant, pool on and size) and add a test that toggling each one changes the result object when it should.

### Non-blocking notes
- Reopening a closed plot with valid plans asks, although closing it again unchanged restores them; the dialog text is still true at the moment it is shown. Leave it.
- Keep `PC.site.T` exported so tests use the same tolerances.

VERDICT: APPROVED
