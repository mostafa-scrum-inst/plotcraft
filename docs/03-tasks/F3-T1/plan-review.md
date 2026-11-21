# F3-T1 plan review — Tech Lead

## Round 1 — 2026-11-20

### What I reviewed
I read `docs/03-tasks/F3-T1/plan.md` (sections 1–11) against:
- `F3-plan.md` F3-T1, including its first item (the corrected cap), the PM riders and the carried FS spec gaps;
- architecture A-5 (frames), A-6 step 8 (as corrected by the CTO), A-7 (sync and signature rules), A-8 (generator), A-15 (plan view, fit control), A-16 (runs, the 10-minute trigger);
- PM F3-S1 (incl. round 4), F1-S5 "all levels generated";
- the F2 feature review (CTO debt items 1–2, PM decisions 3–4).

Reading only. No runs.

### Assessment
The plan is complete for the task, in the right order, and faithful to the architecture.

**Cap first** (section 1). The rule is exactly A-6 step 8 as corrected: 4b candidates at most `3 x short + 0.5 m`, step-4 results keep `2 x (short + 0.5 m)`. There is one shared `capLong` helper.
- Unit cases: the CTO case 2.5 x 8.5 -> 2.5 x 8 m, the pentagon -> 21.5 x 7 m, every documented example and the sample byte-identical, and the two 2:1 bound cases.
- The missing `reason = setbacks` case is found by a search and then pinned.
- The property test is per candidate kind.
- The sweep range is set only after the cap lands.

**Generator** (section 2). It is a faithful port of A-8:
- core block and cells;
- partitions with full-span and square-ish columns, plus the trimmed variants;
- the scale-factor rule and score;
- assignment search;
- 60 best with mirror variants;
- order 2;
- 0.01 m rounding, then a 0.5 m snap kept only if `check` passes.

It is deterministic with `cmpId` ordering. That improves on the spike's string order and is required by A-4. The numbers go into `PC.C.LAYOUT` (A-8). `check` codes are named.

**Sweep** (2.5). It has at least 2 000 programmes, footprints up to the corrected bound in both directions, separate rates beyond 2:1, the 5 % ceiling at 85 % fill or less, and timing. The fixed cases cover everything the F3 plan lists.

**Plans** (section 3).
- `sync` follows A-7 exactly: it leaves plans alone while the signature is `'invalid'`, regenerates only what is stale, and deletes plans of removed levels.
- `input` is shared with F3-T2.
- `regenerate` clears only its level's approval.
- The fail-open guards in `start.js` go.

**Stage 3** (section 4). The plan view is frame L with the street at the bottom (A-15); `plan-fit` is wired with label avoidance; `draw2d` stays generic.

**Riders and gaps** (section 5) are all in. **Mutation checks**: 10, covering cap, snap, adjacency, scale factor, order 2, sync rules, stair mirror, link target and hint.

### Rulings on the 7 questions
1. **`PC.C.FOOTPRINT_STRETCH_EXTRA = 0.5` as the constant and as QA's marker: approved.** It is the "+ 0.5 m" of the PM's stretched-bound sentence, so it belongs in `PC.C` (A-2: every number of section 4 lives there). PM 4.3 names the same bound.
2. **Sync inside `PC.store.go(3)`: approved.** The stage change and the plans go in one nav commit, as `go(3)` already resets `r5Confirmed`. Both are core, so no layer rule is touched.
   - A-7's "always called inside a nav commit" is met.
   - `go` stays the single entrance to stage 3 (Next, stepper, Back from 4).
   - Resume and Load sample call `sync` in `start.js`, as A-7 says. So does Skip to 3D, before it approves.
   - Condition: measure the time `go(3)` takes on the sample and on a maximum house (4 levels x 8 rooms with lift) in node, and report it. If the worst case is over 500 ms, raise it with me before F3-T2: the tap would freeze the phone UI.
3. **Read-only selection in F3-T1: approved.**
   - Selection is session state, cleared on a level change, on `replace` and when the room no longer exists.
   - F3-T2 builds editing on the same selection.
   - Keep the hit test in the controller (`View2D.hitTest`). Nothing about rooms goes into `view2d.js` or `draw2d.js`.
4. **`btn-approve` in F3-T1: disabled, with the reason visible in `plan-msg`** ("Approval comes with plan editing (next build)").
   - The client tries the republished preview, and the F1 lesson was that unbuilt parts must say so plainly.
   - A disabled button with its reason also keeps the stage-3 layout identical to F3-T2's, so Designer and QA layout checks do not move twice.
   - The counter reads "0 of n floors approved".
5. **Sweep in the unit step: approved, with a time ceiling.**
   - The plan must print its run time.
   - If the sweep takes more than 30 s on this box, it moves to its own step in `run-all.mjs` (still part of the full run, with its own flag). Do not shrink the programme count.
   - Report the full-run time at hand-over. If it passes 10 minutes, the A-16 trigger applies in this task's QA round.
6. **Q14 left / right: confirmed.**
   - "Left" = low x in frame P = low u in frame L = the left as seen **from the street looking into the plot**. "Front" = low y = the street side.
   - This already follows from A-5 ("seen from the street facing the house, +u is the viewer's right"; "Front-left = low x, low y") and matches the Q14 diagram.
   - Recorded in A-8 as binding on the house model (A-9 / F4-T1), with the plan's unit test as the guard.
7. **Default selected tab: approved, with one addition.**
   - On entering stage 3: keep the user's previous selection if that level still exists.
   - Otherwise select the lowest level with a problem (no-layout, then unmet pairs); otherwise Ground.
   - A `replace` resets the selection.

### PM wording to confirm (route via the coordinator)
The two fix hints in section 5.1:
- "A lower footprint %, a smaller front setback or fewer cars would help."
- "A lower footprint %, smaller back or side setbacks or a smaller pool would help."

They meet the PM's "at least two helpful answers". The PM may reword them; the FS uses these until told otherwise.

### Conditions (binding; checked at the implementation review)
1. **QA-first landing order** (below). The hand-over includes the focused run and one full run that exits 0.
2. **Cap before sweep.** The sweep's footprint range uses the corrected bound (A-6 step 8, `3 x short + 0.5 m` for stretched footprints), e.g. 6 x 18.5 and 4 x 12.5 m. The sweep has an explicit test that no generated footprint exceeds that bound.
3. **`go(3)` timing** reported (ruling 2). Sweep time reported (ruling 5).
4. **No fail-open guards** for `PC.plans` / `PC.layout`. A unit test loads the core without `plans.js` and expects stage 3 to throw, not to be valid (as for F2-T1's modules).
5. **Stage 3 has no static banner, and stage 4 still shows it** (it has no controller yet). QA's checks follow that.
6. **No markup or CSS change.** If a hook is missing, stop and report (as the plan says).

### What QA must change first (before the FS lands F3-T1), file by file
Markers:
- `PC.C.FOOTPRINT_STRETCH_EXTRA !== undefined` for the cap;
- `typeof PC.layout === 'object'` for everything else in F3-T1.

They land in the same FS change. Each file must stay green on today's tree and switch when the markers appear. QA proves it green on the current tree first; the FS's hand-over full run then proves the other branch.
1. **`tests/qa/f2-t1-ref.mjs`:** stretched candidates capped at `3 x short + 0.5 m` under the cap marker (the old `3 x (short + 0.5)` otherwise). Step-4 results keep `2 x (short + 0.5)`.
2. **`tests/qa/f2-t1-site.mjs`:**
   - Under the cap marker: the pentagon expects 21.5 x 7 m; a case for the CTO's 2.5 x 8.5 -> 2.5 x 8 m; the property check per candidate kind.
   - Under the layout marker: the `parking-omitted` / `pool-omitted` texts end with a fix hint naming at least two answers, in m and ft.
3. **`tests/qa/f2-t2-questions.mjs`, `tests/qa/f2-t3-site-rooms.mjs`, `tests/qa/stage2kit.mjs`** (under the layout marker):
   - the same two warning texts;
   - the summary row of a level with no rooms shows "–" as needed (the blocking `floor-empty` row is unchanged);
   - stage 2's Next is enabled when stage 2 is valid (`MAX_BUILT` 3).
4. **`tests/qa/f1-t2-flows.mjs`** (under the layout marker):
   - Skip to 3D lands on stage 3, with every level approved;
   - Load sample ends with one valid plan per level (signature equal, `approved: false`);
   - stage 3 is reachable from a valid stage 2 and shows no static banner;
   - stages 4 and 5 still show it;
   - Resume keeps stored plans without regenerating them.
5. **`tests/qa/f1-t1-layout.mjs` / `inpage.js`:** any stage-3 state the suite opens by hand now carries generated content (tabs, plan, counter). Under the layout marker, assert on the real elements rather than on static placeholders. The layout rules themselves (44 px, no overflow, 200 px canvas) stay.

After F3-T1 lands, QA writes its own F3-S1 scenarios for the task's QA round. Those are new work, not part of this sequence.

### Non-blocking notes
- The no-layout link calls `goToQuestion(11, level)`; export it as a small `PC.ui.stages.questions.goTo(q, level)` rather than reaching into the module.
- `PC.debug.planLabels()` / `planView()`: accepted. Added to the A-2 debug list at the implementation review.
- Risk 4 (QA on the critical path) is real. The coordinator should start QA's branch work as soon as this review is out.

VERDICT: APPROVED

---

## Addendum — 2026-11-20: R5 and untouched generated plans (QA finding during implementation)

**Finding.** The plans generated at Load sample are untouched (`edited: false`) and unapproved. They still count as valid plans for the R5 gate. So the first size-changing edit after Load sample shows "Regenerate floor plans? … Manual room edits and approvals on those levels will be lost", although no manual work exists.

**Reading of the PM text.** R5 says the confirmation appears "on the first change that would really reset at least one level that has a **valid plan**". Read literally, that includes an untouched generated plan, so today's behaviour follows the letter of the text. But the dialog's own sentence promises a loss of "manual room edits and approvals", which is false here. And regenerating an untouched plan loses nothing: the generator is deterministic and the plan is redone on entering stage 3. **This is a product question for the PM.**

**TL recommendation.** R5 protects the architect's work, not generated output. Ask only when a level that would be reset has a valid plan with `edited || approved`, and name only those levels.

- **Gate.** In `store.js`, add `PC.store.atRisk(candidate)` = `affected(candidate)` filtered to plans with `edited || approved`. The gate asks when `atRisk` is non-empty, and `r5Confirmed` is set only after such a question. `affected` stays as it is: it still says which plans go stale, which F3-T2 and stage 3 may need.
- **Own-confirmation dialogs.** The Q7 move / delete dialog, and later F3-T2's Clear, build their plan sentence from `atRisk`. Untouched plans are regenerated silently, so they are not mentioned.
- **No change for:** the signature, `sync` (stale plans are still regenerated on entering stage 3), Skip to 3D (its approved plans are protected, as any approval is).

**Until the PM decides,** the FS keeps today's behaviour, because it matches the literal text. The change is about 10 lines plus tests, and fits F3-T1's fix round or F3-T2.

**QA tests, if the PM agrees:**
- After Load sample (untouched Draft plans), a size-changing Q2 / Q3 / Q6 / Q7 / room change asks nothing. On entering stage 3 the affected levels show new Draft layouts.
- With one level approved (or edited) and one untouched, the dialog names only the approved / edited one. Cancel restores the value; Continue applies.
- The Q7 move / delete dialog's plan sentence names only levels with edits or approvals, and is hidden when there are none.
- After Skip to 3D (all approved), the first size-changing change asks and names every level.
- Existing F2 cases with seeded `edited: true, approved: true` plans are unchanged.

**FYI recorded:**
- The PM's final fix hints say a **larger** front / back setback helps, because the building is centred; F2-S3 has the text. The FS uses the PM text, not my draft wording above.
- The Designer is fixing the stage-3 tab overflow with 4 levels in CSS.
