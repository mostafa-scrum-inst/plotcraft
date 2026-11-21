# F2-T2 outcome review — Tech Lead

## Round 1 — 2026-11-20

### What I did
- Read `outcome.md` in full against `plan-review.md`, `impl-review.md` (rounds 1–3), `qa-report.md` (rounds 1–2) and the code I reviewed in those rounds.
- Spot-checked the API section against the source: `PC.store.affected` / `commit(…, { keepSample })` (`store.js`), `PC.units.stepLen` / `fmtDims` / `parseNum`, `PC.frames.backW` / `northToW` / `northStep`, `PC.levels.prune`, `PC.ui.qfields` binding shapes, `PC.debug.siteLabels` / `siteDial` / `siteNorth`, `draw2d` `fmt`-null and `o.force`. They match.
- Checked my gate for this outcome: the F1 real-device gate is recorded in `docs/04-feature-reviews/F1.md` as **"OPEN — awaiting client"** with its list, which is the coordinator's agreed form. Condition met.
- No run: QA's round-2 full run (exit 0 in 329.1 s, its suite 946 / 0, no KNOWN) and the FS's run (exit 0 in 309.8 s) are on the final tree, and no code changed in this step.

### Assessment
Accurate and complete: what was built, files, the APIs F2-T3 and F3 reuse (including the rule "build the `affected` candidate with exactly the mutation you will commit, `prune` included", which is the right instruction for F2-T3's three-way dialog and F3-T2's Clear dialog), how to verify (incl. the seeded-plans console line and the Enter case), QA sign-off for both rounds with mutation results, all rulings and deviations, the two Designer CSS changes, and honest interim limits. Gap 6 of QA's spec review (summary figures compared only with `PC.validate` in the FS spec) is correctly declared as covered by QA's independent model only; acceptable.

### Rulings on the limits section
- **QA observation 1** (Fix on "has no rooms" opens the inert Rooms group): **F2-T3**, binding in its plan: Fix for `floor-empty`, `basement-empty` and `level-over` focuses the room list of that level.
- **Observations 4 and 5** (area label wider than a narrow building; pool-size note wraps inside an entry at 360 px): **Designer, F5-T3** polish, as listed.
- **Observation 8** (Rooms buttons inert): interim; the orchestrator tells the client when he tries the republished preview.
- **Observation 3** goes to the PM (below), with my recommendation: F2-S1's "labels each edge" should allow culling of short non-street edges (as F1-S2 does for lengths), since F2-S4's per-edge list in the Q6 block gives every edge's class as text. F2-T3 note: an **overridden** edge should get the same "always labelled" treatment as the street edge, so the user always sees the `*` they just made.
- CD-1 / CD-2 hook points named by the FS (`frontLabel`, the `fmt` callback) are the right ones.

### PM decisions to carry to the F2 feature review
1. **Obs 2:** a 0.5 m side-setback change re-proportions the building (9.5 x 15 -> 9 x 15.5 m on the sample) and so asks R5, although the old building would still fit. A-6 and R5 work as written (proportions follow the buildable box). Keep, or prefer "keep the previous size while it still fits"? My recommendation: keep (deterministic, one rule).
2. **Obs 3:** short non-street edges carry no class label at small scale; amend F2-S1 to allow it (recommendation above).
3. **Obs 6:** `pool-omitted` gives no hint of what would help; add a fix hint ("lower the footprint %, smaller setbacks, or a smaller pool")? Recommendation: yes, text only.
4. **Obs 7:** a floor without rooms shows "needs 10 m²" (stair allowance) next to "has no rooms". Show "–" for empty levels, or keep? Recommendation: show the needed figure only for levels with rooms.
(F2-T1's observations 1, 4, 5 were decided by the client as CD-1 to CD-3.)

### Required changes
None.

VERDICT: APPROVED
