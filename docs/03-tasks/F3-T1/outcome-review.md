# F3-T1 outcome review — Tech Lead

## Round 1 — 2026-11-21

### What I did
- Read `outcome.md` against the plan review (incl. the R5 addendum and the PM's round-5 decision), both implementation-review rounds and `qa-report.md` (PASSED, no bugs; full run exit 0 in 524 s).
- No run (no code changed in this step).

### Assessment
The outcome is accurate and complete:
- **APIs:** `PC.layout` (`core` / `generate` / `check` / `adjacent` / `overlaps`), `PC.plans` (`input` / `make` / `sync` / `regenerate`), `PC.store.affected` vs `atRisk` (stale plans vs plans with the architect's work), the stage-3 controller, and the `draw2d` `rect` / `boxLabel` helpers.
- **The Q14 convention** is stated as binding on F4 (A-8).
- **Timings** (`go(3)`, sweep) are recorded.
- **The speed-up statement** matches my verification: same validity, unmet pairs and scores on 1 335 seeded programmes; one equally good layout differs.
- **Rulings, QA sign-off and the 9 known limits** are recorded, each with an owner.

### Rulings on the routing of QA's observations
- **Obs 1** (small rooms huddle on a big floor; QA suggests a fill warning under about 40 %), **obs 4** (no hint for unmet pairs), **obs 5** (no circulation rule): **PM, at the F3 feature review.** Obs 1 joins the existing rider "default answers leave most of each floor as hall". These are product questions, not generator defects.
- **Obs 2** (phone labels: full and short names mixed; small rooms unlabelled): **F3-T2**, inside the Designer review of the phone stage-3 panel already required (≥ 14 px/m at 360x640). That review also defines one consistent short-name rule (same form for twins).
- **Obs 6** (drawn sizes vs asked sizes, unexplained): **F3-T2.** The selection readout shows both when they differ, e.g. "39 m² (asked 42 m²)". The PM confirms the wording at the F3-T2 plan review. No extra banner.
- **Obs 3** ("Cannot be laid out" in about 23 % of no-layout cases, although a layout within the 25 % rule exists): **TL decision — F3-T2 rider, a generator retry for failures only.**
  - When `generate` finds no layout, it runs once more with the cell scale range widened to **0.77–1.23**. That stays inside the 25 % area rule with room for the 0.01 m rounding.
  - Every result that succeeds today, the sample included, is byte-identical, because the retry runs only on failure. `check` still guards every output.
  - Tests:
    - QA's 30 m² room on 5 x 8.5 m with a front-left stair lays out;
    - the sweep reports how many former failures now succeed;
    - every success passes `check`;
    - the sample and every fixed layout case are unchanged;
    - a failing maximum level (retry included) stays under 600 ms in node.
  - If the retry still fails, the message stays as it is.
  - It goes in F3-T2 because that task already owns the plan editor and touches `layout.js` (overlaps / snap). It is small and keeps F3-T1 closed.
- **Item 8** (about 4 % of layouts keep off-grid edges because the snap is refused): accepted. F3-T2's editor snaps on release.
- **Item 9** (F1 real-device gate OPEN): PM / client, at the republish after F3-T1. Stage 3 is now the first screen the client will judge on a phone.

The F3-T2 items are now in `F3-plan.md` (riders table), not only in the outcome.

### Required changes
None.

VERDICT: APPROVED
