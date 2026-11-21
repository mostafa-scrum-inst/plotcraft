# PlotCraft — resume note (paused 2026-11-21 ~12:30 Dubai, end of batch 7)

Everything lives on disk under /home/claude/plotcraft. Read this, then the tail of docs/status.md. All role agents run on **Opus 5.5** (docs/TEAM-PROTOCOL.md, Models section). Client wants work in **batches, pausing after each**.

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

## Next batch (batch 8): F3-T3 + F3 feature review
1. **QA A-16 trim FIRST** (target full run ≤ 8 min) and drop nothing that guards behaviour.
2. **F3-T3 (Designer):** 3D look tables (exteriors, interiors Q18 palettes, room tints, site colours), furniture block tables (Q19 density), sky/season tables, stage-4 hint visuals; riders in F3-plan.md (incl. two added by TL). FS one-line fix for QA obs 5 when core/plans.js is next opened.
3. **F3 feature review (PM + CTO):** PM decisions (TL list in docs/03-tasks/F3-T2/outcome-review.md): low-fill warning; unmet-pair hint; no circulation rule; one-step "Undo last edit"?; 1.5 m in ft; client question "is 8 rooms per floor enough?". CTO: F1 real-device gate still OPEN (condition unmet), runtime, F4 hand-off (house model from approved plans + PC.layout.core; Q14 convention; THREE mock first).
4. Then F4 (first real three.js 3D) — first time real WebGL runs; publish for a phone check.

## Known limits owned by Designer F5-T3
Overridden-edge label pile-up; legend wraps at 1280x800 with "* set by you"; area label wider than narrow footprints; no Parking/Pool legend entries; pool-size note wrap at 360 px.
