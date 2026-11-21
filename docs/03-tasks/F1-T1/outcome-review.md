# F1-T1 outcome review — Tech Lead

## Round 1 — 2026-11-20

Read `docs/03-tasks/F1-T1/outcome.md` in full and checked it against the tree.

- **What was built / files**: matches the implementation I reviewed (shell, five stages, components, 45 icons, `palette2d`, `build.mjs` from A-17; 10 CSS files, none over 300 lines).
- **Hook contract (the part later tasks depend on)**: the outcome table names all 202 document hooks of `tests/contract/hooks.json` (checked by script: 0 missing) and the 11 templates with their parts; `verify/hooks.json` and `verify/values.json` are byte-identical to the canonical copies in `tests/contract/`. Rules (lookup by `data-pc` only, attribute-first state, six `is-*` classes, values equal to A-4, the two session-value exceptions) are stated as ruled. The hooks added during implementation are listed.
- **Verification**: the four commands are the right ones and I have run each of them during the reviews.
- **QA sign-off**: round 2 PASSED is recorded with the figures (static 137 / 0, layout 1929 / 0). Bug 6 (pair selects) fixed afterwards in CSS.
- **Deviations**: the six listed are the ones I accepted in `impl-review.md`.
- **Known limits / tech debt**: complete and each item has an owner task: Light pane margin and landscape panel (F5-T3), iOS range styling (F1 publishing point), banner-slot rule, stage 2 space on phone, summary covering questions (F2-T2), placeholder visuals (F3-T3), placeholder text (F2), no dark theme.

### Non-blocking note
- Section 5 ends with "QA has not yet re-confirmed bug 6 independently". QA has since confirmed it during the F1-T2 test run; update that sentence when the file is next touched.

### Required changes
None.

VERDICT: APPROVED
