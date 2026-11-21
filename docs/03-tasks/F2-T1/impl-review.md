# F2-T1 implementation review — Tech Lead

## Round 1 — 2026-11-20

### What I did
- Read in full: `core/levels.js`, `site.js`, `site-footprint.js`, `site-outdoor.js`, `signature.js`, `validate.js`, the gate in `store.js`, `stages.js`, `plot.js` (`canMove`), and the runner flags in `tests/run-all.mjs`; grepped `src/js` for `levelIds` and for `PC.x &&` guards (none left).
- Ran `node tests/run-all.mjs` **twice**. Run 1: exit 1 after 166 s. Run 2: exit 0 in 257 s (unit 241/0; e2e contract 4, fit-button 42, plot 512, start-card 14, shell 551; QA F1-T1 161 + 1929, F1-T2 765, F1-T3 896). See required change 1.
- Mutation check of the orientation fix: with the new `canMove` line removed, the `canMove` unit test fails (1 of 7). File restored (diff clean), rebuilt.
- **Own probe of the site model** through the test loader on 16 plots, with the buildable definition, plot containment and overlap tests written independently: sample, sample with 4 cars, two L-shapes, U-shape, thin triangle, sliver triangle, 7 x 7.5 m plot with default and with zero setbacks, 20 m setbacks on 30 x 30 m, setbacks leaving a strip, sample rotated 30 degrees, 12-vertex star filling 100 x 100 m, 100 x 100 m square at 80 %, trapezoid with a slanted street edge, 10 x 50 m plot.

### Results of the probe
- **No correctness violation in any case**: every footprint lies in the buildable set (49 sample points per rectangle against my own definition), parking inside the plot and clear of the building, pool clearance inside the plot and clear of building and parking.
- **6.2 reproduced exactly**: 584 m2, classes front/side/back/back/side, bbox 2–18 / 3–28, buildable 389.44, footprint 9.5 x 15 at (5.25, 8), 24.4 %, not clamped; parking u 11–16; pool 6 x 3 at (7, 24); vegetation 146; no blocking, no warnings. The 30-degree rotation gives identical numbers.
- Degenerate inputs behave: sliver triangle, 7 x 7.5 m with default setbacks and 20 m setbacks all give `buildable-small`; zero setbacks give a rounding-only footprint with no warning; 100 x 100 m at 80 % places the footprint, omits the pool with its warning.
- Timing: 27 ms at worst (12-vertex star 23 ms), far inside the 500 ms bound.
- Three results that are correct by the rules but poor or misleading: required changes 2 and 3 and the note to the CTO below.

### Invariants, each checked against every operation that can break it
| Invariant | Operations | Result |
|---|---|---|
| A committed closed plot is counter-clockwise (A-5) | close (normalises; collinear refused by `canClose`), corner move (`canMove` now refuses area <= 0; unit + e2e cases; mutation fails), reopen (not closed), resume / sample (`PC.plot.valid` in `validState`; sample constant) | Holds |
| A plan counts only while `plans[id].sig === PC.sig.level(state, id)` | `PC.stages` stage 3 check uses it; the gate's `affected` uses it; signature has `[w, d, edge]`, core, rooms, pairs in numeric id order, `'invalid'` without footprint or level | Holds; appearance answers proven not to change it (unit) |
| The level list has one owner | `PC.levels.ids` used by `stages`, `draft`, `start`, `validate`, `sig`; `levelIds` gone | Holds |
| Missing modules fail loudly | `stages.js` calls `PC.validate`, `PC.sig`, `PC.levels`, `PC.units` unguarded; unit test deletes each and expects a throw | Holds |
| Cancel in the gate changes nothing | no commit, same state object, one `cancelled` notification | Holds (read + unit) |
| The memo never answers for other inputs | key = points, edge, 3 setbacks, footprint %, vegetation %, cars, covered, pool on, pool size; these are all the inputs `build` reads | Holds |

### The three CTO debt items
1. **Corner drag cannot flip the plot**: done, unit and e2e cases, mutation-checked.
2. **Fail-open guards removed** from `stages.js`: done, with the throw test.
3. **Runner two at a time**: done (`--jobs`, `--only`); A-16 updated with the flags. It exposed required change 1.

### Rulings on the deviations
1. **FS edited `tests/qa/f1-t2-flows.mjs`** (seeded plans use the real signature): the change is correct and necessary (a plan with sig `'qa'` is stale by definition now). Accepted this once; rule from here: `tests/qa/` belongs to QA, a developer proposes the change and QA applies or approves it. QA confirms this edit in its F2-T1 round.
2. **Rounding nudge for shrunken footprints** (try the size rounded from `t + 1e-3`, keep only if the exact test accepts): accepted; it is guarded by `rectFits`.
3. **Mask row by row**: accepted; same definition, my independent point check agrees.
4. **Memo of 4, key includes `covered`**: accepted.
5. **`moved` only when the fallback found a better centre**: accepted.
6. **Scan orders**: accepted except the last resort, see required change 2.
7. **`PC.validate` caches only frozen store states**: accepted.
8. **Extra site fields (`edge`, `noFit`, `mask`); `null` for an open plot**: accepted.
9. **Stage 2 really gated while static**: accepted (as ruled in the plan review).

### Required changes
1. **The full run is not stable with two files at a time.** In my first run `tests/qa/f1-t3-plot.mjs` crashed at line 232 (`act(dialog-ok): not shown`: Clear, an 80 ms sleep, then the dialog button is expected) and `run-all` exited 1; alone the suite passes (896/0), and the second full run passed. One failure in two runs makes the mandatory run useless as a gate. Fix at the cause: `tests/qa/session.mjs` `act()` (and any similar helper in `tests/helpers/`) waits for the hook to be shown and enabled, polling up to about 2 s, instead of relying on fixed sleeps (rule added to A-16). This is QA's file: QA makes the change, FS checks its own helpers for the same pattern. Evidence required: three consecutive green full runs.
2. **Parking last resort puts the cars in front of the door.** Sample with 4 cars: the 10 m block lands at u 5–15, centred on the entrance (u 10), because the last-resort scan starts nearest to the entrance. In the last resort, order candidates farthest from the entrance first (smallest overlap with the entrance strip), so the block sits against one side (u 10–20 or 0–10 on the sample) and the door stays as free as it can be. Test: sample with 4 cars; strip overlap is 1 m or less.
3. **`level-over` gives a fix that cannot work when the footprint is clamped.** L-shaped plot at 25 %: footprint is limited to 100 m2 by the plot, the message says "…or raise the footprint %", which changes nothing. When `footprint.clamped`, the text must instead point at what helps: "Remove or shrink rooms, or reduce the setbacks (the building is already as large as this plot allows)." Unit test for both variants.

### For the CTO (decision, not blocking this task)
The fallback keeps the bounding-box proportions, as decided. The probe puts numbers on the known limit: on an L-shaped plot (40 x 12 m arm along the street plus a 14 x 40 m arm), target 218 m2, the result is **10 x 10 m = 100 m2 (11.5 %)**, while a 10 x 20 m rectangle (200 m2, within the 2:1 rule) fits in the long arm. With the sample's rooms this blocks stage 2 on a plot that could hold the house. U-shape: 60 m2 of 288. Suggested cheap change if you want it now: in the fallback only, also try the proportions 1:2 and 2:1 and keep the largest area (about three times the fallback cost, still tens of milliseconds). It changes nothing for convex plots or the sample.

### Non-blocking notes
- A-5 said the plot is at v >= 0 in frame L; that is only true for convex plots (the star's buildable box starts at v = -22.75). Corrected in A-5; nothing in this code relies on it.
- Thin plots hit the 2:1 cap (10 x 50 m plot: 6 x 12 m, 14.4 %, warning shown). That is the PM's rule working as written.
- `field-invalid` formats length limits as "0.0 m to 20.0 m": fine.

VERDICT: CHANGES REQUESTED

---

## Round 2 — 2026-11-20

### What I did
- `node tests/run-all.mjs`: exit 0 in 235 s. Lint 0; unit 244/0; e2e contract 4, fit-button 42, plot 512, shell 551, start-card 14; QA F1-T1 161 + 1929, F1-T2 765, F1-T3 1022. With QA's three runs (about 240 s each) and FS's three (236, 234, 233 s) that is seven consecutive green full runs on the parallel runner.
- Read the changed code: `site-footprint.js` (three-proportion fallback), `site-outdoor.js` (last resort order), `validate.js` (`level-over` fix text), the synchronous fit in `stage-plot.js`.
- Re-ran my probe, now 19 plots (added 3 cars on the sample, the star at 80 %, and a 12-vertex comb filling 100 x 100 m as the fallback worst case), with the independent buildable / containment / overlap checks, plus determinism (two runs with the memo cleared), "area never above target" and the side ratio.

### Required changes from round 1
| # | Status | Evidence |
|---|---|---|
| 1 Flaky full run | Resolved | QA replaced fixed sleeps with state waits in `tests/qa/`; FS removed them from its helpers (two commented exceptions); A-16 carries the rule. Seven green full runs in a row, mine included. |
| 2 Parking last resort | Resolved | Sample with 4 cars: u 0–10, 1 m of the 2 m entrance strip covered (was 5–15, fully across the door). 3 cars: u 11–18.5, strip free. |
| 3 `level-over` text when clamped | Resolved | "Ground floor: needs 120 m², 72 m² available. Remove or shrink rooms, or reduce the setbacks (the building is already as large as this plot allows)." on the strip plot; the unclamped variant still offers the footprint %. |

### CTO decision (three-proportion fallback)
Implemented as decided: centred try first; only when it keeps less than half the target does the search run for the bounding-box ratio, 1:2 and 2:1, largest final area wins, earlier proportion on ties. Probe results:
- My L-shape (40 x 12 m arm + 14 x 40 m arm): **10 x 20.5 m = 205 m2 (23.5 % of 25 %)**, not clamped (rounding only), no warning, **no blocking conflict** with the sample's rooms (was 100 m2 and blocked).
- My U-shape (40 x 40 m, 12 m arms, 12 m base; FS guessed the dimensions correctly): **8 x 16 m = 128 m2** (was 60). That is the largest 2:1 rectangle an 8 m wide buildable arm allows, so the remaining "clamped" warning is right.
- Sample and its 30-degree rotation: unchanged, 9.5 x 15 at (5.25, 8).
- All 19 cases: footprint inside the buildable set, never above the target area, deterministic, parking and pool valid. Worst time 83 ms (comb), star at 80 % 37 ms.
- One thing my ratio check surfaced, already true in round 1: the 2:1 limit is applied before the 0.5 m rounding, so the final sides can be slightly past 2:1 (10 x 20.5; 11.5 x 5.5). This follows the order of the PM's rule list (proportions, then rounding) and nothing depends on the exact ratio. Recorded as A-6 step 8; no change requested.
- A-6 step 4 rewritten for the three proportions and the "not adopted now" line removed (CTO condition 3). A-6 parking text updated for the last-resort order.

### Other changes in this round
- `stage-plot.js` fits the view synchronously instead of in the next frame: correct direction (a tap arriving before the first frame used an unfitted transform). Not reproduced directly by FS or me; QA's scenario L is green in all seven runs.
- QA confirmed the FS edit to `tests/qa/f1-t2-flows.mjs` and added scenario O (orientation) with per-operation plot invariants and a reload check at the end of every plot scenario, which is exactly the "attack the invariant through every operation" rule.

### Coordination ruling recorded
The coordinator ruled that the F1 publishing gate must not stall the build: if the client has not answered when the F2-T2 outcome is ready, the gate is recorded in `docs/04-feature-reviews/F1.md` as "OPEN — awaiting client" with the list of unverified real-device items and carried into each feature review. `F2-plan.md` rider updated; my F2-T2 outcome check is now "answered, or recorded as open with its list".

### Required changes
None.

### For QA (F2-T1 focus; pure logic, node)
1. 6.2 numbers independently (584, classes, bbox 2–18 / 3–28, footprint 9.5 x 15 at 5.25 / 8, 142.5, 24.4 %, 120 of 142.5 per level, parking u 11–16, pool, vegetation 146, no warnings), also for a rotated copy.
2. Footprint properties over generated plots (convex, L, U, comb, star, thin, tiny): inside the buildable set by your own definition, never above target, `clamped` only when smaller than rounding explains, deterministic; both 20 m2 conflicts; the 2:1 rule before rounding.
3. Every blocking and warning code alone: appears with the right question, level and numbers in m and ft, disappears after the fix; `level-over` in both variants; `field-invalid` from `invalidFields`.
4. Signatures: unchanged by each appearance answer; all levels on size / street edge / stair / lift changes; one level on room, size, pair changes; a move-only change (back setback 2 -> 2.25 m; vertex (8,30) -> (8.5,30)) changes nothing.
5. Gate: asks once per visit and only for currently valid plans; Cancel leaves the identical state and notifies once; Continue; reset by entering stage 3 and by replace; serialised proposals; stale plan never asks; removed level asks.
6. Parking and pool: strip kept free where possible (2, 3, 4 cars on the sample; default car on 20 x 20 m), omitted cases with their warnings, vegetation reduced.
7. Regression: plot orientation invariant through every operation and across reload (your scenario O), stages fail loudly without their modules, full run stable in parallel.

VERDICT: APPROVED
