# F3-T2 outcome review — Tech Lead

## Round 1 — 2026-11-21

### What I did
- Read `outcome.md` against the plan review, implementation review (round 1 and its addendum), `qa-report.md` (PASSED, all 9 focus items met) and the post-QA fixes:
  - bug 1: `resizeRect` clamps before snapping, with a new ft unit case and a mutation check;
  - the `edges.spec` flake: settle and visibility waits, no sleeps.
- The FS's last full run exits 0 in 595.7 s. No run of my own (no new code since QA's round apart from the two fixes, both covered by FS tests).

### Assessment
The outcome is accurate and complete:
- **APIs F4 builds on:** the pure edit operations, the "approved ⇒ no overlaps" invariant and who writes `approved`, the Q14 convention, `MAX_BUILT` 5 with stage 5 awaiting F4-T1's controller, `plansSentence` as the single R5 sentence, the retry constant, the debug hooks.
- **Verification steps.**
- **QA sign-off,** with bug 1 fixed after QA. QA drops its KNOWN entry in `f3-t2-edit.mjs` in its next maintenance step.
- **27 mutation checks.**
- **All rulings, including the PM's round-6 corner decision** superseding my plan-review ruling 3. The outcome records that correctly: product scope is the PM's.
- **Retry results:** 0 of 2 355 successes changed.
- **Known limits,** each with an owner.

### Rulings
1. **QA observation 5** (a move past the footprint uses the neighbours' span at the finger, not at the clamped room): **deferred, accepted as a known limit.**
   - Effect: under 0.5 m difference in 76 of 5 600 seeded moves, and only for which neighbour counts.
   - Changing `moveRect` now would reopen a QA-passed task for no visible gain.
   - Owner FS: make the one-line fix, with a unit case, the next time `core/plans.js` is opened for any reason. Recorded in the F3-plan riders.
2. **Runtime at the trigger** (595.7 s, 4.3 s under 10 minutes): **the A-16 trim is scheduled now.**
   - It is a **QA maintenance step before F3-T3's tests land**. F3-T3 is next and adds data-table and stage-4 tests.
   - QA trims duplicate viewport coverage between `tests/e2e` and `tests/qa`, keeping each check in one place with a comment.
   - Target: the full run at **8 minutes or less**, so F4's mock-based suites have room.
   - Recorded as the first rider of F3-T3 in `F3-plan.md`. Nobody raises the trigger.
3. **F1 real-device gate:** recorded in `docs/04-feature-reviews/F1.md` as **"OPEN — testing guide sent 2026-11-21"**, with the new unverified items.
   - The CTO's F2-review condition ("answers before F3-T2 sign-off") is **unmet**.
   - This approval is at task level. The CTO decides at the F3 feature review whether F3 can close without the answers.

### For the F3 feature review (PM + CTO)
**PM decisions**
1. **QA F3-T1 obs 1:** low-fill warning when rooms huddle on a big floor. This goes together with the older rider "default answers leave most of each floor as hall".
2. **QA F3-T1 obs 4:** a hint for unmet "next to each other" pairs.
3. **QA F3-T1 obs 5:** no circulation rule. This is a known limit to tell the client.
4. **QA F3-T2 obs 2:** one-finger pan is hard on phones (the plan fills the canvas, and a pan over a room moves it). There is no undo, only Regenerate. Options:
   - an "Undo last edit" (one level of undo);
   - a pan-only mode;
   - accept the two-finger pan.
   - My recommendation: one-step undo is the cheap, high-value one if any.
5. **QA F3-T2 obs 4:** the 1.5 m minimum is not reachable in ft (the edge stops on the 1 ft grid, e.g. 1.71 m). Accept it, or let the minimum be a snap candidate (a small FS change).
6. **Known limits to acknowledge:** keyboard room editing out of scope; corner resize only if the client asks (F5-T3); Clear followed by an identical redraw keeps the plans (A-7, accepted in round 6).
7. **Stories now end to end, for re-check:** F1-S3 R5 on vertex release; F1-S5 "all levels generated"; Skip to 3D lands on the static stage 5 (the G1 tap count waits for F4-T1).

**CTO items**
1. **F1 real-device gate:** OPEN, with the condition unmet (above). The stage-3 editor by touch is now the main unverified area.
2. **Runtime:** 595.7 s; the QA trim is scheduled before F3-T3 (target ≤ 8 min). F4 adds mock-based 3D suites.
3. **Hand-off to F4:**
   - the house model (A-9) reads the approved `plans[*].rooms` (frame P) and `PC.layout.core`;
   - the Q14 convention is binding;
   - stage 5 gets its controller in F4-T1, which removes the static banner;
   - F4-T1's plan review must show the THREE mock first (CTO standing instruction).
4. **Store commit cost:** one commit per release; nothing measured as slow. Revisit only if real phones feel slow.
5. **Republishing:** the current build (stages 1–4, editor included) should be republished for the client together with the testing guide, if that has not happened yet.

### Designer F5-T3 polish list (from this task)
- an outward handle over the stair;
- labels overlapping while rooms overlap, and a handle pill over "Stairs";
- the 640x360 readout's three empty lines;
- the warnings chip covering a label at the default fit;
- corner handles only if the client asks.

### Required changes
None.

VERDICT: APPROVED
