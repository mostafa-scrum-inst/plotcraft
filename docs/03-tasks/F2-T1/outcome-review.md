# F2-T1 outcome review — Tech Lead

## Round 1 — 2026-11-20

Reviewer: Tech Lead (new session; context rebuilt from the files on disk, standards of the earlier F2-T1 reviews kept).

### What I did
- Read `outcome.md` in full against `qa-report.md`, `impl-review.md` (rounds 1–2), `plan-review.md` and the CTO decision of 2026-11-20.
- Checked the API section against the source: `PC.site` exports (`T`, `floor05`, `isBuildable`, `rectFits`, `analyse` with the memo key of every input, `clearMemo`), `PC.site.footprint` (centred try, `enough` = half the target, three-proportion fallback, `noFit`), the `PC.validate` rule table (11 codes, kinds and question numbers as in the outcome table, both `level-over` fix texts), `PC.validate.RULES` / `normaliseRoof`, `PC.sig.level`, the gate in `store.js`. They match.
- Full run on the current tree (which also carries F2-T2): `node build.mjs && node tests/run-all.mjs` exit 0 in 238 s; QA F2-T1 1124 / 0 with its two KNOWN hits, unit 248 / 0.
- Re-read QA's two bugs in the code: bug 1 is exactly the `enough` test in `site-footprint.js` (the fallback is skipped when the unrounded centred rectangle keeps half the target, even if the rounded result ends under 20 m²); bug 2 is the literal "1 m" in the `pool-omitted` text of `validate.js`.

### Assessment
The outcome is accurate and complete: what was built, files, public APIs (with the analyse result shape and the gate contract that F2-T2, F2-T3 and F3-T1 build on), how to verify, QA sign-off (1124 / 0, suite mutation-checked), CTO debt closed, rulings, and an honest limits section that includes QA's test-gap findings. `PC.levels.prune` is correctly marked as an F2-T2 addition.

### Rulings
1. **Where the two minors are fixed: in the F2-T2 fix round** (F2-T2 round 2, which my F2-T2 implementation review opens anyway), as the FS proposes. Both are small, in files F2-T2 does not otherwise touch, and neither changes the sample.
   - Bug 1: the fallback search also runs when the centred result's final (rounded) area is under 20 m², not only when it keeps less than half the target. A-6 step 4 updated. Tests: QA's triangle `(0,0) (60,0) (30,12)`, setbacks 1 / 5 / 3, 10 % gives a footprint of at least 20 m² and no `no-fit`; 6.2 assertions unchanged.
   - Bug 2: the clearance in `pool-omitted` is worded through `PC.units` ("1.0 m" / "3.3 ft"); unit test in both units.
   - Plus the three unit cases the FS listed (triangle, ft pool text, "once per visit" for a second still-valid level). QA removes its two KNOWN entries when it re-tests F2-T2.
2. **A-6 sentence corrected.** "Convex plots and the sample never reach this branch" is wrong (QA: 41 convex cases, e.g. the sample with setbacks 6 / 5 / 4 at 50 %). A-6 now reads: the sample with its 6.2 answers never reaches the fallback; convex plots can, whenever the centred shrink keeps less than half the target (or, after the bug 1 fix, ends under 20 m²); results are valid and at least as large as the centred one.

### QA's eight observations: routing
| # | Observation | Owner | Ruling / action |
|---|---|---|---|
| 1 | Thin plots get a small building (2:1 limit); the warning says "reduced to fit inside the setbacks" | **PM decision** | It is the PM's 3.1 rule working as written (on 10 x 50 m the setbacks do clamp the width; the 2:1 cap stops the length growing). PM decides whether the cap stays at 2:1 for clamped footprints and whether the `fp-clamped` wording should name the proportion limit. No code change until then. |
| 2 | Four cars cover 1 m of the entrance strip with no warning; on a tapered plot the last resort prefers nearest-the-street over least coverage | **TL (mine)** | Accepted as is. PM 4.4 says the strip is kept free "where possible"; the A-6 order (lowest v, then farthest from the entrance) is deterministic and pinned by tests. No warning: a car near the door is not a conflict. Revisit only if the hosted 3D (F4-T2) shows a car blocking the gate-to-door path. |
| 3 | A side-yard car can stand past the front wall line (default answers, 20 x 20 m) | **TL (mine)** | Accepted: A-6 allows the side-yard candidate to extend past the front wall; the car is inside the plot and clear of the building. F4-T2 draws it where the site model puts it. It is visible in the F2-T2 preview. |
| 4 | The 40-degree back / side limit is a cliff when back and side setbacks differ | **PM decision** (rule) + **F2-T2 preview** (understanding) | The rule is the PM's (3.1). The preview labels edge classes and draws the setback zone; my F2-T2 review requires the phone preview to be readable enough for that (legend out of the drawing, front edge always labelled). PM decides whether the 40-degree threshold should change (for example a blended setback near the threshold); my recommendation: keep it for the prototype. |
| 5 | Zero setbacks keep the building centred, not on the boundary | **PM decision** | Correct by 3.1 (centred, shrunk about its centre). Building to the boundary ("zero lot line") is a product feature, not a defect. PM decides whether it is in scope; my recommendation: not for the prototype. |
| 6 | Convex plots do reach the fallback | **TL (mine)** | A-6 sentence corrected (ruling 2). Results are valid and larger; no code change. |
| 7 | The footprint % has a ceiling the user sees only through the warning | **F2-T2** | Addressed by F2-T2: while the Q3 slider is dragged the summary shows the effective footprint and % live, so the user sees it stop growing, and the `fp-clamped` warning states the effective figure. No further UI in the prototype. |
| 8 | On a wide U-plot the building sits in one arm; the summary does not say where | **F2-T2 preview** | Addressed: the preview draws the footprint (with its area) and the parking where the site model placed them (checked on a 40 x 40 m U-plot at 360 x 640: house in the left arm, labelled 128 m²). |

**For the PM (F2 feature review): observations 1, 4 and 5.**

### Required changes
None to the outcome document.

### Non-blocking notes
- F2-T2 round 2 carries the two minors and the three unit cases; the F2-T2 outcome should list them as closed.
- Once F2-T2 lands, nothing outside `site-footprint.js` should read `site.mask` (as the outcome says); I will grep for it at later reviews.

VERDICT: APPROVED
