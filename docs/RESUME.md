# PlotCraft — resume note (2026-11-21, end of batch 8; client asked to continue straight into batch 9)

Everything lives on disk under /home/claude/plotcraft (cloud sessions: /home/user/plotcraft, repo mostafa-scrum-inst/plotcraft). Read this, then the tail of docs/status.md. All role agents run on **Opus 5.5** (docs/TEAM-PROTOCOL.md, Models section). Client wants work in **batches, pausing after each**.

## Where things stand
| Item | State |
|---|---|
| F1 Plot drawing + app shell | DONE (PM + CTO approved). |
| F1 real-device gate | OPEN — awaiting client phone observations (docs/04-feature-reviews/F1.md). TL recommends one combined phone check of the current build (stage 1 + stage 2). |
| F2-T1 Site model, F2-T2 Questionnaire | DONE. |
| F2-T3 Rooms + edge overrides + narrow-plot footprints | **DONE** — QA passed (1134 checks; full run exit 0 in 465 s), Designer room-row fix (bug 1) in, outcome approved (docs/03-tasks/F2-T3/outcome-review.md). QA confirmed the fix and removed its KNOWN entry (1134/0, no open bugs). |
| Published preview | Republished ~22:15 — full F2 (questionnaire, rooms, 3:1 stretch, edge overrides), QA-passed. Next on stage 2 stays disabled until F3-T1 (no floor plans yet). |

## Batch 5 result: F2 feature review DONE
- PM APPROVED (no debt round; 8 decisions in docs/04-feature-reviews/F2.md and goals-and-stories.md "Changes in round 5").
- CTO APPROVED with debt: the long-side cap broke CD-1 on small narrow plots (e.g. 2.5 × 8.5 m). Corrected rule written (A-6 step 8: 3:1 candidates long ≤ 3 × short + 0.5 m; 2:1 results ≤ 2 × (short + 0.5 m)); PM 3.1/4.3 match; examples and sample unchanged; QA pentagon changes (its 3:1 candidate capped at 21.5 × 7 — final value pinned in F3-T1). A-2 / A-4 (draft-upgrade pattern) / A-16 (QA trim at 10 min) updated.
- Client phone checklist: docs/04-feature-reviews/phone-check.md (16 steps) — sent to the client at the pause. Gate must be answered before F3-T2 is signed off.

## Batch 7 result: F3-T2 DONE
- Plan editor (move/resize by edges with span-limited snapping, overlap blocks Approve, Approve/un-approve toggle, Regenerate asks only for edited/approved floors), stage 4 Interior (Q18–Q19), MAX_BUILT 5 (stage 5 static with notice), generator retry 0.75–1.25 on failure only, room-label tiers, phone panel 14.25 px/m. PM round-6 texts. Corner resize OUT (PM; orchestrator note in F3-T2/plan-review.md).
- QA PASSED (9 + 190); bug 1 (ft resize short of wall) fixed and confirmed; outcome approved (docs/03-tasks/F3-T2/outcome-review.md). Full run 595.7 s — at the 10-minute trigger.
- Republished ~12:22. Client testing guide (Claude Doc, 25 steps + report table): https://claude.ai/artifact/LsqkH2iM1PwLMZ4ag2jaeA
- Client asked for a project zip and a project summary (chat cannot be moved into his "Plot plan" project): docs/PROJECT-SUMMARY.md + plotcraft-*.zip sent at the pause.

## Batch 8 result: QA trim + F3-T3 + F3 feature review DONE
- QA A-16 trim: full run 511 -> 435 s, nothing lost (docs/03-tasks/F3-T3/qa-trim.md); TL accepted; --jobs stays 2.
- F3-T3 (Designer): look3d.js / furniture.js / sky.js tables, stage-4 hint vignettes, Q10 3-stripe swatches, PM round-7 Q18 texts; TL plan + impl APPROVED; QA PASSED (bug 1 wardrobe anchor fixed); outcome approved. FS obs-5 moveRect fix done.
- F3 feature review (docs/04-feature-reviews/F3.md): PM APPROVED (decisions 1,2,4,5,9 = "F3 follow-up bundle", recommended in F4-T2). CTO round 1 found a data-loss bug (stale plans after room delete/move -> draft rejected and silently deleted); FS fixed plansOk + added rejected-draft side key plotcraft.draft.rejected; TL APPROVED, QA PASSED (qa-draft-fix.md), CTO round 2 APPROVED.
- Last full run: exit 0 in 459.6 s.
- Republished: https://claude.ai/artifact/LDbG9XdU1UeAMcVwqmxAB9 (new URL). Testing guide (Claude Doc): https://claude.ai/artifact/DVTuhtQMn5MYhmbEUqMGpD
- Client questions OPEN (cards sent 2026-11-21): (1) 8 rooms per floor enough? PM rec raise to 10; (2) hall access: PM rec non-blocking warning; (3) CTO: phone check right after F4-T1 (rec yes). Answers go into client-decisions.md / F1.md; work from (1)/(2) joins the F3 follow-up bundle.
- CTO conditions for F4: H1-H6 in F3.md (mock first, vendored r128 from npm for tests, house model from approved plans + PC.layout.core, Q14 test, A-11/A-13 rules, phone look at F4-T1 publish before F4 review). F4-plan.md riders added by TL.

## Next batch (batch 9): F4-T1 (first real three.js 3D)
1. TL: place the F3 follow-up bundle (PM rec F4-T2) and the client answers when they arrive.
2. F4-T1 per F4-plan.md + CTO H1-H6: plan -> TL plan review -> implement -> TL review -> QA -> outcome. Environment: cdnjs blocked here, npm registry reachable (tests/vendor/three-r128.min.js).
3. Republish for the phone check; testing-steps doc.

## Known limits owned by Designer F5-T3
Overridden-edge label pile-up; legend wraps at 1280x800 with "* set by you"; area label wider than narrow footprints; no Parking/Pool legend entries; pool-size note wrap at 360 px.
