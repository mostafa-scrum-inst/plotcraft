# F4-T3 outcome review (TL, step 3f), 2026-11-21

Reviewed: `outcome.md` (FS, 16ee4ba), against:
- `plan-review.md`;
- `impl-review.md` and its addendum;
- `qa-report.md` (PASSED, no bugs, 393.8 s, 25/26 mutations, the one survivor equivalent);
- `camera-decision.md`;
- PM round 11;
- commits 0e844e1 … 16ee4ba.

## Verdict on the outcome document

`outcome.md` is complete and accurate.

- **§1 What was built:** matches the code I reviewed, including the finding-7 memo.
- **§2 Files and §5 sign-off:** match the commits and reports. Run times:
  - QA 393.8 s;
  - FS 407.1 s;
  - stage-2 sweep after the memo: 173–201 ms on the sample and 614–641 ms on 100 × 100 m.
- **§3 F5 APIs:** the right hand-off:
  - `setLook` / `look()` and their tour independence;
  - scene names and the mesh headroom (21 of 40; the highlight mesh is the remaining planned item);
  - canopy tops at 4.83 m against the A-14 tour eye heights;
  - the pure `shadowFit`;
  - the session pattern.
- **§6 Rulings:** complete, covering:
  - plan-review items 1–6;
  - Q1–Q8;
  - impl findings 7–10;
  - PM round 11;
  - the Designer values.
- **§7 Known limits:** honest, and none blocks. Shrubs dropping out as Q4 rises while trees are still added is a consequence of the Q4-free seed and is accepted.

**Acceptance.** F4-T3 meets:
- F4-S1, the vegetation criterion as amended in round 11;
- F4-S3, all criteria;
- G6 final, via `tests/three/budget.test.mjs`: maximum house, capped vegetation, every look.

## Routing of QA observations

- **O-1, faint summer-evening shadows → Designer, data only. Not now: in F5-T3's sky-table tuning.**
  - Cause: at 17.5 h in summer the sun sits at the 0.15 Y clamp. That is A-13 working as specified, so it is not a bug.
  - The fix belongs with the tuning F5-T3 already owns ("final tuning of `PC.data.sky` in response to the F4 hosted-page notes"), so the client's phone look can inform it too.
  - Options for the Designer: raise `sunI` at the 17–18 h keys, or move the golden key. Any change regenerates the 16-row golden table in `data-tables.test.mjs` and `sky.test` in the same commit.
  - Changing the 0.15 clamp is an A-13 change and comes back to me.
  - QA's pixel-count check (pixels changing by more than 6 levels) is the reference. FS's weak luma check may stay.
- **O-2, the `frustumCulled` rationale → done.**
  - A-11 is corrected. r128's `InstancedMesh` constructor already sets `frustumCulled = false`, so the line is redundant on r128.
  - It is kept as an explicit, mock-tested contract, because the mock does not imitate the default and a later three.js version may change it.
  - The QA survivor is equivalent.

## F4 feature-review hand-off pack (the 7 items from the F4-T2 outcome review)

| # | Item | State |
|---|---|---|
| 1 | Client phone answers (CD-6) | **Missing:** the only open item. |
| 2 | Republish `dist/index.html` after F4-T3 | **Orchestrator action, due now.** This is the publish the phone check should use, so it covers roof, furniture, outdoor items, vegetation and the Light tab. |
| 3 | Outcomes, outcome reviews and QA reports | Complete. F4-T1, F4-T2 (with Step 0) and F4-T3 each have an outcome, an APPROVED outcome review and a PASSED QA report. Full runs at `--jobs 3`: 409.0 / 414.5 / 393.8 s, all within 420 s. |
| 4 | Acceptance matrix | Complete: below. |
| 5 | Default-camera decision record | Complete: `camera-decision.md`, option (a), no hint line (PM + Designer). |
| 6 | Accepted limits for the client | Complete: outcome §8 (F4-T2 and F4-T3 limits), plus the cap limit above about 1 020 m². |
| 7 | Debt list for F5 | Complete: below. |

**Acceptance matrix** (story → task → main evidence):
- **F4-S1 geometry, storeys, dollhouse, level selector, Basement opening.** F4-T1: `view3d.spec`, `scene` / `house` unit, the QA f4-t1 suites.
- **F4-S1 Roof toggle, closed exterior, roof types, stair head.** F4-T2: `roof` three, QA f4-t2 model / view.
- **F4-S1 furniture, Q18 / Q19, inside the room.** F4-T2: `furnish` unit (A-11 reference, 19 220 rooms), `interior` three.
- **F4-S1 outdoor items, entrance, north marker, omitted items.** F4-T2: `outdoor` / `site` tests, `outdoor.spec`.
- **F4-S1 vegetation (up to the cap).** F4-T3: `scatter` unit, QA scatter on 44 houses, `veg-short` on 50 cases.
- **F4-S1 Building… / unavailable.** F4-T1.
- **F4-S2 all.** F4-T1: camera, clamps, Reset (street side, round 11), canvas, overlay ≤ ⅓, render stop. The overlay is re-measured at 33 % in F4-T3.
- **F4-S3 all.** F4-T3: `sky` unit (16-row golden, north rotation), `look` three, the Light-tab checks in `view3d.spec`, `view3d-real` luma and winter, the QA sky oracle (2 200 cases).
- **G6.** `budget.test`, final: the maximum house with 40 rooms and capped vegetation, 21 meshes, one shadow light, 1024 map, DPR ≤ 2, after every look.

**Debt list for F5** (none blocks):
1. Lint length warnings: `layout.js` 334 lines and `stage-plans.js` 320 lines. Fix when either file is next opened.
2. Mutation S6, accepted as near-equivalent.
3. Store-only edge states that the UI cannot reach: a structural commit on stage 5, and Undo over a stale plan.
4. O-1 shadow tuning, in F5-T3.
5. `applyLook` allocates one `Color` per look (optional `.set()`).
6. The seating tie order is not pinned.

## F5: can planning start now? Yes

- The CD-6 condition binds the **F4 feature review**, not F5 work. The same reasoning held F4-T3 back from nothing (F4-T1 outcome review). Phone findings come back as bugs on the owning F4 task and are fixed alongside F5.
- **F5's first task is F5-T1, the room finder (FS),** per `F5-plan.md`:
  - `flyTo` redirect and cancel;
  - `three/finder.js` with `poseForRoom`, the highlight frame and `goTo`;
  - the grouped room dropdown in `ui/stage-3d.js`;
  - roof off and the room's level on select.

  F5-T2 (drone tour) follows. **F5-T3 (Designer pass) waits for the F4 feature review notes** (its declared dependency, `docs/04-feature-reviews/F4.md`), so it should not start before the phone answers.
- **Riders for the F5-T1 / F5-T2 plans** (I fold them into F5-plan at the plan review):
  - the maximum house is now **40 rooms** (CD-4), not 32, in both QA lists;
  - the finder and tour must not reset the session look (outcome §3);
  - the highlight mesh counts against ≤ 40, with 21 used;
  - the tour eye path between stops is not checked against canopies (4.83 m tops). The F5-T2 plan states the minimum eye height over the yard, or keeps the A-14 construction with a test.

VERDICT: APPROVED
