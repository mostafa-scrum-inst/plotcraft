# F4-T1 outcome review (TL, step 3f), 2026-11-21

Reviewed: `outcome.md` (FS), against `plan-review.md`, `impl-review.md` (round 1, addendum, Round 2), `qa-report.md` (PASSED, two minor bugs, both now fixed) and the commits `2ebb9ea` … `ff48039`.

## Verdict on the outcome document
`outcome.md` is complete and accurate:
- **What was built.** §1 matches the code I read.
- **Files and APIs.** §2 / §3 match the commits. The §3 API list is what F4-T2 / F4-T3 need: house fields to fill, `view3d` calls, `BoxBatch` with `topHex`, the empty `roof` / `site` groups, and the mock whitelist process.
- **How to verify.** §4 gives the focused words and suite counts, and I reproduced them: view3d 46, view3d-real 38, QA f4-t1 10 + 163.
- **Rulings.** The §5 table is complete: Q1–Q11, required items 2 / 3 / 9, CTO H1–H5, impl items 1 and 3.
- **QA bugs.** §6 gives root cause, fix, tests and mutations for both bugs; my Round 2 approves them.
- **Sign-off.** QA sign-off is recorded in §9.
- **Known limits.** §8 is honest.
  - The refusal's `reachable` half is not pinned (TL item 2 → F4-T2).
  - Shadows are faint at summer noon.
  - The bundle waits in F4-T2 step 0 with CD-4 and CD-5.
  - The wheel during Building… is not prevented.
  - The horizon corner at the widest, lowest pose.

F4-T1's acceptance criteria are met:
- F4-S2 all;
- F4-S1 shell criteria;
- G6 limits;
- F1-S5 / G1 (Skip to 3D in 2 taps).

The roof, furniture, site and vegetation criteria are F4-T2 / F4-T3 by plan.

## Runtime ruling (QA §8)
- **Facts.**
  - Full runs at `--jobs 2`: 482–509 s (FS 486.9 s after the fixes).
  - QA's duplicates-only trim of f2-t2 / f2-t3 is done and cannot reach 450 s.
  - One `--jobs 3` full run: green in 366.9 s (QA).
  - My earlier condition (F3-T3 impl review): change the default only after **two** green `--jobs 3` full runs, because of past timing flakes.
- **Ruling: switch the default to `--jobs 3`, once a second green full run confirms it.**
  - I started that second run on the current tree (`ff48039`). If it is green, FS changes the runner default to 3 as the first commit of F4-T2, with its "2 cores" comment corrected. A-16 is updated in the same change.
  - If it is red with a timing failure, the default stays 2 and the flaky spec is fixed first (no fixed sleeps, A-16).
  - The 600 s hard line and the ≤ 8 min target stay as they are. From then on, measure at `--jobs 3` with a 420 s target.
- **Not chosen.**
  - *Dropping a second touch viewport.* It removes real coverage: 640x360 is where layouts break.
  - *Accepting ~500 s.* F4-T2 adds roof, furniture and site suites plus the bundle's stage-3 tests, and would push the run past 8 minutes.
- **If a flake appears at `--jobs 3`,** the remedy is to fix the flaky spec, not to fall back silently. Report it in the status line.

## F4 feature review and the phone check
- **F4-T2 starts now.**
  - Step 0 is the F3 follow-up bundle with CD-4 (10 rooms per floor; the generator is re-proven at 10) and CD-5 (the hall-access warning), as placed at the plan review.
  - The CTO condition (CD-6, F3.md) binds the **F4 feature review**, not F4-T2 / F4-T3 work.
- **The F4 feature review must wait for at least one real-phone observation** of the F4-T1 publish (items a–c: it loads and Skip to 3D shows the house; one-finger orbit and two-finger zoom / pan without page scroll; colours and contrast). Phone findings come back as bugs on F4-T1 and are fixed in the next task. If the observation is still missing when F4-T3 is done, the orchestrator asks the client again before the F4 review rather than holding F4-T3.

## Carried items
1. F4-T2: the refusal `reachable` test (TL item 2).
2. F4-T2 step 0: the F3 bundle, CTO debt 6, the `applyEdit` guard, CD-4, CD-5.
3. F4-T2 first commit: `--jobs 3` default (if the second run is green), A-16 wording.
4. F4-T3: judge the faint noon shadows with the time slider.
5. Phone check (CD-6): orchestrator / client.

VERDICT: APPROVED
