# F2-T3 plan review — Tech Lead

## Round 1 — 2026-11-20

I reviewed `docs/03-tasks/F2-T3/plan.md` (both increments, the 8 questions and the risks) against:
- `F2-plan.md`: F2-T3, pre-step D and the CTO decisions D1–D6;
- the PM stories, round 4: 3.1, 4.3, R5 "Edge-class overrides", F2-S2, F2-S3, F2-S4 and the F3-S1 criterion;
- `architecture.md` A-4, A-6 (step 4b, `clamped` after 4b, `reason`, pruning), A-7 and A-15;
- the CTO's round-4 review and re-review;
- my binding notes in `docs/03-tasks/F2-T2/outcome-review.md`.

I also checked the code the plan changes: `start.js` already reaches storage only through the `ui.storage` adapter, and `storage.js` `flush` removes a single key today. I did no test runs: QA is using the tree.

### Assessment
The plan is complete and faithful, and it is prototype-sized.

**Step 4b** is implemented exactly as A-6 and the PM sentence state:
- the stretch only when the step-4 result is at its 2:1 limit;
- 3:1 and 1:3 searches through the existing `place`;
- tie order: step-4 result, then the stretch, then 3:1, then 1:3;
- `clamped` decided after 4b by the long side equal to `floor05(A / short)`;
- `reason` from the PM test.

The pruning (`beat`, start at `t0 = sqrt(beat / (w0 * d0))`, strict improvement) is safe. It compares unrounded candidate sizes with the winner's rounded area. A candidate whose unrounded area is at or below `beat` can never round above it, so skipping it cannot change the result. All six PM / CTO examples are unit cases, and the 6.2 sample is byte-identical.

**Overrides:**
- the state and the three-rule invariant are as in A-4;
- the memo key gains `edgeOv`;
- `toggleEdge` is pure and refuses the street edge;
- overrides go through `propose` and stay out of the signature (A-7).

**Draft v2:** it covers migration, the strict `edgeOv` checks, dropping entries equal to the automatic class, and removing both keys on Start new, discard and an emptied state. Key access stays inside the storage adapter.

**The UI** covers every F2-S4 criterion:
- the tap mode;
- forced labels;
- the edge list with in-place rows, full accessible names and the focus highlight;
- the notice that ignores `replace` and `cancelled`.

The Fix behaviour from my F2-T2 binding note is in increment 2.

**The test-file audit** is better than my list in A-4 and F2-plan: three more QA files are affected.

**Increment 2** keeps the approved scope. One improvement: the three-way dialog recomputes its plan sentence from `PC.store.affected` for the candidate of the chosen option.

**Mutation lists:** 14 cases for increment 1 and 8 for increment 2, which is the right habit.

### Rulings on the 8 questions
1. **Clearing overrides: the single normaliser is approved.** `PC.site.clearOvIfOutlineChanged(prev, next)` runs inside `PC.store.commit` and in the gate's candidate, after the mutator and before the no-op test and `affected`.
   - It makes the invariant hold by construction: no later mutator can forget it.
   - It keeps the "one dialog at most" property, because the gate judges the combined candidate.
   - Store and site are both core, so no layer rule is broken.
   - It does not run in `replace`: `defaults()` and `parse` already guarantee the invariant there.
   - A-4 is reworded to "the store clears `edgeOv` on the candidate of any change that moves a point, changes the count, changes `closed`, or changes the resolved street edge".
   - The invariant-attack test stays the proof.
2. **QA-first sequence: approved, with the three extra QA files added to the list** (A-4 and F2-plan updated).
   - QA lands version-aware updates first. They branch on the two markers that arrive together in the FS's increment-1 change: `PC.C.FOOTPRINT_STRETCH_RATIO !== undefined` (4b present) and `PC.DRAFT_V` (1 or 2).
   - Wherever possible QA reads the runtime value (`PC.draft.KEY`, `PC.DRAFT_V`) instead of branching, so the check needs no second edit later.
   - QA proves its branch green on today's tree before the FS lands increment 1.
   - At the increment-1 hand-over the FS runs, besides the focused run, **one full `node tests/run-all.mjs`**, which exercises QA's new branch. A KNOWN window is not used.
   - The exact list for QA is at the end of this review.
3. **Pruning equivalence: `PC.site.T.noPrune` is approved** as a test-only flag in the existing exported tolerance object.
   - It defaults to `false`, is read only in `site-footprint.js`, and carries a comment saying it is for the test.
   - The unit test compares pruned with unpruned results on the 40 seeded concave plots.
   - QA's reference model is the independent second check.
4. **Dimensions: use `PC.units.fmtDims`, "6.0 × 18.0 m"**, as in the pool note. The "x" in F2-S3 is plain-text notation for the same thing. I'll ask the PM to note it; no story change is needed.
5. **Move into a full level: disable "move" with a one-line reason and preselect "delete"** (the plan). A partial move would need a second question; that is not worth it in a prototype.
6. **Forced labels: approved for the street edge and overridden edges.** The order is street first, then overrides by edge index. Each tries the normal free spots first (as `frontLabel` does) and is forced only as a last resort.
   - Condition: a forced label never covers the tap-mode control, the compass or the collapse toggle. If the forced spot hits one of them, use the other side of the edge.
   - Test: the sample and a 12-vertex plot at 360x640 with every short edge overridden. No forced label rectangle intersects those three overlays.
7. **Master bedroom: one per house.** F2-S2 says "one bedroom can be marked master", and the 6.2 sample has exactly one. Names are derived per level, so two masters would both read "Master bedroom". The plan's `setMaster` (turning one on turns the others off) is right.
8. **Tap mode: it also resets to `street` each time stage 2 is entered** (and on `replace`). It stays in `class` while the user works in stage 2, across groups. A user coming back later expects a tap to set the street edge, which is the default the story names.

On `PC.C.FOOTPRINT_STRETCH_RATIO = 3`: PM section 4.3 already carries the number ("Footprint proportions … up to 3:1 when clamped"), which is what the "change `PC.C` and section 4 together" rule needs. No PM edit is needed. If the value ever changes, both places change together.

### Conditions (binding; checked at the implementation reviews)
1. **Increment 1 hand-over:** the focused run named in the plan is green, plus one full run with QA's version-aware files. Increment 2 code starts only after my approval of increment 1 (D4).
2. **Normaliser:**
   - unit cases for each trigger (point moved, point added, point removed, `closed` changed, resolved street edge changed) and for "an unrelated change keeps them";
   - the gate case "vertex move plus clearing asks once with the combined `affected`";
   - the e2e invariant attack after every plot and Q6 operation, Start new included (D2).
3. **Storage:** every key read, write and removal goes through `ui.storage`. `PC.draft.KEYS` is the single list of keys. Start new, discarding a bad draft, Load sample over a draft and an emptied state remove every key in it.
4. **Forced labels** keep clear of the three overlays (ruling 6). The sample stays at 4.0 px/m or more at 360x640 with the tap-mode control present.
5. **Tap mode** resets on stage-2 enter and on `replace` (ruling 8). One e2e case each.
6. **Increment 2 notes:**
   - `updateRoom` that moves a room to another level drops its pairs and says so in `room-msg` ("Its pairs were removed.").
   - The `Enter` default is cancelled on every new text field: `room-add-area`, count, row exact-area.

### What QA must change first (before the FS lands increment 1), file by file
Each change keeps today's expectations while the markers are absent, and switches to round-4 expectations when they are present. QA proves it green on the current tree, then the FS's increment-1 full run proves the other branch.
1. **`tests/qa/session.mjs`:** use `PC.draft.KEY` read from the page instead of the literal key (line 7).
2. **`tests/qa/f1-t1-layout.mjs`:** the globals check accepts `PC.DRAFT_V` equal to 1 without the stretch marker and 2 with it (line 75), instead of `!== 1`.
3. **`tests/qa/f1-t2-flows.mjs`:**
   - The wrapper assertion becomes `w.v === PC.DRAFT_V` (line 170).
   - In the bad-draft table (lines 259, 261), "wrapper v 2" and "state.v 2" become "v 3" cases.
   - With `DRAFT_V === 2`, add: a v1 wrapper resumes (migrated, `edgeOv` empty, saved back as v2); v1 + v2 both stored gives v2; v1 stored, then Start new, then reload offers nothing.
4. **`tests/qa/f2-t1-ref.mjs`:** implement A-6 step 4b from the A-6 / PM 3.1 text, independently of `site-footprint.js`: stretch, 3:1 / 1:3, `clamped` after 4b, `reason`. Enable it only when `FOOTPRINT_STRETCH_RATIO` is present.
5. **`tests/qa/f2-t1-site.mjs`:** expectations for clamped thin and concave cases come from the model (both branches); add the six PM / CTO 4b examples under the marker. The sample and unclamped cases are unchanged.
6. **`tests/qa/f2-t2-questions.mjs`:** the summary and footprint model uses the updated reference. The canvas-spy label check accepts a trailing `*` on class labels (it appears only once overrides exist, so this is safe on today's tree).

After increment 1 lands, QA writes its own F2-S4 / 4b scenarios for the task's QA round (increment 1 list first, D4). Those are new work, not part of this sequence.

### Non-blocking notes
- Risk 4 (the three-way dialog's text changes while open): the Designer may put `aria-live="polite"` on `dialog-text` when it next touches the dialog. Not needed for this task.
- `PC.debug.siteFocusEdge()` and `PC.debug.tapMode()` are accepted; they go into the A-2 debug list when increment 1 lands.
- The Designer's pre-step D is reviewed separately when it lands. The FS's increment-1 UI must not start before D is approved, because it binds D's hooks.

VERDICT: APPROVED
