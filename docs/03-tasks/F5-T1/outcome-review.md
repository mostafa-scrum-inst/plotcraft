# F5-T1 outcome review (TL, step 3f), 2026-11-22

Reviewed: `outcome.md` (FS, f5d2c20), against:
- `plan-review.md`;
- `impl-review.md` with its B-1 addendum;
- `qa-report.md`: round 1 FAILED on B-1; round 2 PASSED, 413.0 s, no new bugs;
- commits 455dee2 … f5d2c20.

## Verdict on the outcome document

`outcome.md` is complete and accurate.

- **§1 What was built.** Matches the code I reviewed and the B-1 fix (the `groundOuter` footprint hole).
- **§2 Files, §5 sign-off and run times.** Match the commits and reports:
  - full run 413.0 s at `--jobs 3`, within the 420 s target;
  - `run-f5-t1` 31.0 s alone, against my 30 s budget. The 1 s over is the new `groundOuter` leak check and is accepted;
  - the keyboard pick takes 1.25 s of summed capped steps, and its wall clock is not judged at a mean frame of 118 ms (ruling 1).
- **§3 APIs for F5-T2.** The right hand-off. It names the one gap honestly: `step` writes the pose through the `scene.js` closure, and the F5-T2 plan proposes the fix, which I rule on in the F5-T2 plan review.
- **§6 Rulings.** Complete: plan items 1–6, Q1–Q5, PM Q6 / Q7, impl rulings 1–2, finding 7 (footprint timing best of 3, 9831ea3) and the B-1 addendum.
- **§7 Known limits.** Honest, and none blocks:
  - flights stretch below 10 fps;
  - desktop framing under the panel (F5-T3);
  - a level change mid-flight;
  - the highlight is darker at night (lit material; it stays visible);
  - repeated room names (told apart by optgroup and caption);
  - the lint warnings carried over.

**Acceptance.** F5-S1 is met in full:
- a dropdown grouped by level with the plan names;
- a 1.2 s flight with no jump cut, Roof off, levels above hidden and the basement opened (now true on real r128 after B-1);
- the highlight plus the "Room · Level" caption;
- smooth redirect;
- gesture cancel;
- a 44 px target on a phone.

G6 holds at 22 of 40 meshes with a room selected.

## B-1 lesson (process)

- B-1 lived from F4-T1 to F5-T1, because no real-r128 check looked into a basement.
- QA's new `groundOuter` leak check (magenta paint, 8 views, proven against the old code) now guards that class of bug. My F4-T1 process note is applied: real-r128 checks of level-dependent views include a basement house. It binds F5-T2: the tour's basement stop is checked on real r128.
- For the F4 feature review: B-1 was an F4-S1 criterion ("Selecting Basement opens the ground") that passed on the mock only. The F4 acceptance matrix in F4-T3 `outcome-review.md` should cite the B-1 fix and QA's leak check as its evidence. Add this to the review pack.

VERDICT: APPROVED
