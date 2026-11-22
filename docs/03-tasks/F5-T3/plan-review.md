# F5-T3a plan review (TL, step 3b), 2026-11-22

Reviewed: `plan.md` (Designer, 20a428d), against:
- my split in F5-T2 `outcome-review.md`;
- the CTO gate rulings in `docs/04-feature-reviews/F4-cto-gate.md` (ruling 1, conditions a–c);
- A-10, A-12, A-13, A-14, A-15 and A-16;
- the routed known limits.

The plan is complete. Every routed item has an owner, the order follows the dependencies, and it keeps to CTO condition a: phone layout is measured as geometry at QA viewports; touch, performance and closing radius stay in T3b. One design change is required (§4: a lens shift instead of moving the camera target). The rest is approved with the conditions below. They go into `plan.md` before work starts. No re-review: I check them at the implementation review.

## Rulings on the TL questions

1. **Stage 5 side by side at 640x360 (§2): approved.**
   - It is the same layout as stages 1–3, coverage drops to 0 %, and no JS is needed (the resize observer re-fits).
   - The canvas is 368 px wide and about 256 px high, which keeps A-15's 200 px rule.
   - Add to the sweep: Reset after the switch frames the whole plot inside the 368 px canvas.
   - A-15 is updated (done).
2. **Desktop framing (§4): approved in intent, but use a lens shift, not `frameShift` on the pose.**
   - **Why.** Panning the target by half the occluded width moves the orbit pivot off the room or model centre. Every later orbit then swings around a point beside the room. The tour would also need per-frame pose surgery, and the F5-T1 / F5-T2 pose goldens and clamps would all move.
   - **The rule (A-12, done):**
     - Keep poses as they are, and shift the projection centre into the uncovered rectangle with r128's `PerspectiveCamera.setViewOffset(W + o, H, o, 0, W, H)`, where `o = occl.right`. That puts the principal point at `x = (W − o) / 2`, with the vertical scale and fov unchanged. Call `clearViewOffset()` when `o = 0`.
     - The pivot stays on the target, and the finder, tour and Reset are untouched. Only the radius fits use the visible aspect `(W − o) / H` (`resetRadius` and the finder radius), as you proposed.
   - **FS work:**
     - add `setViewOffset` / `clearViewOffset` to the mock whitelist with the conformance check against the vendored r128;
     - a pure helper `PC.cam.viewOffset(W, H, occl)` that returns the 6 arguments or null;
     - apply it in `scene.js` on resize and on panel toggle (mark dirty only).
   - **Tests:**
     - unit: the helper's arguments; zero occlusion gives null; the visible-aspect radius;
     - three: with o = 336 at 1280x800, the target projects to x = 472 ± 1 px; the four floor corners of the widest room of the maximum house project into the uncovered rectangle;
     - `view3d-real`: the highlight bbox lies left of the panel;
     - the "`frameShift` sign flipped" mutation becomes "offset sign flipped".
   - `occl.bottom` stays 0 until T3b (condition a): approved.
3. **Fold `interior.spec`'s layout loop into the sweep: approved.**
   - The F3-T3 hint assertions keep their names, and their mutation proofs are re-run once and recorded in impl-notes.
   - Its default-run viewports drop from 5 to the sweep's 2. The other 3 run under `QA_FULL=1`, which is the release-gate pattern, so that is acceptable.
4. **Full-quota read-only resume (§7 row 4): in scope, kept minimal.**
   - Hiding a draft the user owns is a data-access bug, not polish.
   - Scope:
     - `probe` is split into `canRead` / `canWrite`;
     - read works and write fails → Resume is offered, saving stays off, and the no-save chip shows;
     - nothing ever writes in that state;
     - Start new still asks before discarding.
   - Tests:
     - unit: the four probe combinations;
     - e2e: quota-full storage stub → Resume works and the chip shows;
     - the existing F1 storage suites stay green unchanged.
   - Anything beyond that, such as freeing space or exporting, is out of scope.
5. **Handle over the stair (§8 item 6): the selected room's handles win.**
   - Hit test in draw order, topmost first: selected-room handles → rooms → empty canvas (pan). The stair and lift blocks are not hit targets.
   - The handle pill is drawn above the stair and its label.
   - A drag into the stair is still refused by the overlap rule, as today.
   - Test: a handle that overlaps the stair block starts a resize.

## Ownership and data

- **Designer / FS split: approved as in §0.** Designer: CSS, markup, `src/js/data/*`, Designer e2e and verify scripts. FS: `core/*`, `three/*`, `ui/*.js` logic with unit tests.
  - The `PC.C.TOUR` numbers are proposed by the Designer from the §5 frames and committed by the FS, with the `tourplan` / `tour` goldens regenerated in that commit.
  - If eye parameters change, the FS updates A-14's numbers.
- **The Designer editing `sky.test` golden rows (O-1): approved, under conditions.**
  - The rows are **generated**, never hand-typed, by the A-13 reference in `data-tables.test.mjs`.
  - The diff touches only the golden rows.
  - The FS acknowledges the change in the implementation review.
  - QA moves `f4-t3-ref.mjs` in its own commit; tell QA the key values before merge.
  - The superseded F4-T3 designer-plan table is marked, as planned.
- **O-1 retune (§6): approved as data-only**, with the A-13 code and the 0.15 clamp unchanged.
  - Acceptance as planned: at least 15 000 px change on QA's metric, and the F3-T3 invariants pass.
  - Also restate that `compute(12, 'summer')` still equals the literal F4-T1 noon goldens. The 12 h key is untouched, so it must.

## Other conditions

- **A-15 label rule (§8 item 1).** Culling overridden-edge `*` labels with a midpoint tick changes A-15's "every overridden edge is always labelled". It is approved with the street edge still forced and the `q-edges` list as the full reference. A-15 is updated (done).
- **Run time (+8 s).** The default full run must be ≤ 420 s, measured before merge.
  - A single run of 420–440 s is re-run once. Two runs over 420 s in a row, or any run over 440 s, require a trim (A-16), and nothing may exceed 480 s.
  - The `interior.spec` fold is the first offset.
- **CTO conditions.**
  - Condition a: holds; any item justified by "phones need" moves to T3b.
  - Condition b: full run ≤ 420 s, the `QA_FULL=1` sweep green in QA's round, and a republish at the end of the batch.
  - Condition c: F5-T3a is not gate evidence.
- **PM texts.** The toast, chip label, legend and pool-note wording come from the PM in parallel; use them verbatim.

VERDICT: APPROVED
