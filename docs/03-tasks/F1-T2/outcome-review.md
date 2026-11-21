# F1-T2 outcome review — Tech Lead

## Round 1 — 2026-11-20

Read `docs/03-tasks/F1-T2/outcome.md` in full and compared it with the code I reviewed in `impl-review.md`.

- **What was built / files**: accurate (14 scripts, no markup or CSS change, largest JS file 127 lines, tests 166 unit + 513 e2e checks).
- **Public APIs (section 3)**: the contracts of `PC.store`, `PC.stages`, `PC.draft`, `PC.ui.dialog / toast / banner`, `PC.ui.shell.register`, `PC.ui.start.guard`, `PC.ui.storage / autosave`, `PC.debug` and `PC.sample` match the source. The three rules later tasks must follow are stated: layout-class inputs go through `propose`; the state holds only valid values and any schema addition bumps `PC.DRAFT_V`; `PC.plans.sync(draft)` mutates its argument and is called inside a `nav` commit (A-7).
- **Verification**: the commands are right; figures agree with my own run.
- **QA sign-off**: PASSED round 1, 759 / 0, with the two minors recorded as known.
- **Deviations**: the five I accepted.
- **Limits and debt**: every interim limit names the task that ends it, and they agree with the F1-T3 plan I approved (unit-aware reason, `streetEdge` on close, self-intersection check, `run-all` qa step, the two minor fixes, QA's test gaps). The `levelIds` duplication is correctly assigned to F2-T1.

### Non-blocking note
- The PM 4.1 remark ("58 m2" vs 60) is the PM's to correct; nothing to do in code.

### Required changes
None.

VERDICT: APPROVED
