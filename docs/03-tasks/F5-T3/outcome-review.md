# F5-T3a outcome review (TL, step 3f), 2026-11-22

Reviewed: `outcome.md` (Designer + FS, 7264b32), against:
- `plan-review.md` and `impl-review.md`;
- `qa-report.md`: round 1 FAILED on B-1 (major), B-2 and B-3 (minor); round 2 PASSED, 419.8 s, `QA_FULL=1` sweep 380 / 0;
- CTO gate conditions a–c.

## Verdict on the outcome document

`outcome.md` is complete and accurate.

- **Status and commits.** Match the history:
  - both branches and their merges;
  - the QA fixes in 65e78ca;
  - the TL and QA commits.
- **B-1 fix is the right rule.** `available = canRead && canWrite` restores F1's meaning of "saving works" (my ruling 4 said exactly that). The read-only state stays a separate, non-saving state. The regression is covered in `f1-t2-flows` J at both sizes.
- **B-2 / B-3 fixes.** The area label splits number from unit, and the pool-note rule at 360 is the Designer's. Both were re-tested under `QA_FULL=1` in m and ft.
- **§8 Known limits.** Honest:
  - the zero-room project (A-9 refusal, unreachable through the UI);
  - the 2-line legend at 1280 (measured);
  - the unclamped 640x360 stage-3 message, with Approve in view;
  - 0.2 s run-time headroom.
- **§9 F5-T3b list.** It holds only items that need device evidence (CTO condition a), and RESUME matches it.

**CTO conditions.**
- **a: met.** I verified it at the implementation review; the QA fixes are text and layout at QA viewports only.
- **b: met, except the republish.** The full run is ≤ 420 s and the `QA_FULL=1` sweep is green. The orchestrator republishes `dist/index.html` now, at the end of this batch.
- **c: met.** Nothing here is presented as gate evidence.

**Process note.** B-1 was a regression of an F1 rule that my plan ruling stated correctly. The FS's first cut changed `available` to cover the read-only state, and only QA's F1 suite caught it. When a change touches a long-standing contract (`ui.storage.available`), the FS lists every reader of that contract in impl-notes. I added this to A-16 (contract changes).

## Routing

### 1. Run-time headroom: yes, longest-first scheduling now, as a small FS task (F5-T3c)

- `run-all.mjs` starts browser tasks in alphabetical order. With about 100 s QA runners among them, a long suite that starts late leaves an uneven tail. Longest-processing-time-first is the standard fix: no coverage is lost and nothing gets trimmed.
- **Scope (FS, `tests/run-all.mjs` only, plus A-16):**
  - order the browser tasks by a committed duration table, `tests/durations.json`: label → seconds from the last green full run. Unknown files go first, which is pessimistic;
  - `--write-durations` rewrites the table after a green full run (QA or FS, committed with the run);
  - output stays buffered per task, so the logs keep their per-file blocks;
  - the order is deterministic.
- **Acceptance:**
  - two green full runs at `--jobs 3`, with times recorded;
  - the result must show real headroom: target ≤ 405 s, so about 15 s under the 420 s line;
  - `--only` and the other flags are unchanged;
  - A-16 is updated.
- **If LPT does not reach 405 s:** report it. The next step is QA moving a further real-r128 section behind `QA_FULL=1`, which is QA's call (A-16). The 420 / 480 s lines do not move.
- It runs **before** the feature reviews, so the release-gate runs have room for noise.

### 2. Next batch: F4 and F5 feature reviews, both conditional on the phone gate. Confirmed.

- **F4 feature review (PM + CTO, with TL inputs), written and signed off on everything except the gate**, per CTO ruling 2. TL inputs:
  - the F4 hand-off pack from my F4-T3 outcome review: acceptance matrix, limits, debt list;
  - the B-1 (F5-T1) evidence row for "Basement opens the ground": the fix 88dd164 and QA's `groundOuter` leak check;
  - the F5-T3a changes that touch F4 behaviour: lens shift, O-1 sky retune, 640x360 layout;
  - the CTO verdict line stays **conditional on the gate**.
- **F5 feature review (PM + CTO), same pattern:**
  - **Acceptance:**
    - F5-S1 (F5-T1 + B-1);
    - F5-S2 and G1 (F5-T2);
    - G4 / R2 / R3, the presentation pass at the 4 viewports (F5-T3a sweep, `QA_FULL=1`);
    - the F4-S2 overlay criterion (side by side at 640, lens at 1280).
  - **Limits:**
    - flights and tour stretch below 10 fps;
    - lifted stops;
    - the zero-room project;
    - the legend wrap at 1280;
    - mid-leg framing;
    - the pool hidden at Reset.
  - **Debt:**
    - the lint length warnings (`layout.js` 334, `stage-plans.js` 320);
    - S6;
    - the store-only edge states.
  - Held: the F5-T3b list. Verdict conditional on the gate.
- **Before the reviews:** the `QA_FULL=1` release gate runs green once on the review commit (all trimmed suites plus the device sweep), as my standing condition requires.

### 3. What remains before "release"
1. **The phone gate.** The client answers the open decision card: option 1 (phone check), 2 (desktop Chrome check of the hosted page) or 3 (release with the risk recorded). Nothing else can close it.
2. **Depending on the answer:**
   - Option 1: F5-T3b runs on the findings (bugs on the owning tasks, the T3b list), then QA's round, then the CTO approves F4 / F5.
   - Option 2: the hosted-page check runs. Touch and phone performance are recorded as a known risk, and the T3b items become recorded limits.
   - Option 3: the reviews record "never seen on a real device", and the T3b items become recorded limits.
3. **Release commit:**
   - `QA_FULL=1` green on it;
   - the default run ≤ 420 s;
   - lint 0 violations (the 2 length warnings recorded or fixed, at the release owner's choice; I recommend recording them);
   - `dist/index.html` rebuilt as a single file with three.js r128 from the cdnjs tag only;
   - the final publish.
4. **Docs:** PROJECT-SUMMARY, RESUME and the feature reviews closed with the final verdicts, and CD-6's outcome recorded in `client-decisions.md` and `F1.md`.

VERDICT: APPROVED
