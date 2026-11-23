# PlotCraft — resume note (2026-11-21, end of batch 9; client asked to continue through all batches)

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

## Batch 9 result: F4-T1 DONE
- First real 3D (house model from approved plans + PC.layout.core, mock-first, vendored r128 tests, render on demand, level selector, camera). TL plan/impl/outcome APPROVED; QA PASSED (F4T1-1/-2 fixed). Full run 487 s at --jobs 2; TL ruling: default --jobs 3 (target 420 s) after a 2nd green --jobs 3 run (QA's first: 366.9 s) — FS switches as first commit of F4-T2.
- Client decisions CD-4 (10 rooms/floor), CD-5 (hall-access warning), CD-6 (phone check after F4-T1). cdnjs now reachable here (identical to vendored r128).
- Republished (same URL): https://claude.ai/artifact/LDbG9XdU1UeAMcVwqmxAB9 ; phone check doc https://claude.ai/artifact/ScLvtVirdhoeCwEwoB1CLv. F4 feature review waits for the client's phone answers (ask again after F4-T3 if missing).
- Client instruction 2026-11-21 18:09: continue through all batches until the full app is done; summary + republish + testing steps at each batch end, no pause.

## Batch 10 result: F4-T2 DONE
- Step 0 (CD-4 10 rooms/floor with layout key fix + exact speed-ups, CD-5 hall-access warning via core/access.js, low-fill hint, one-step Undo, ft min snap, strip on stages 1/3, lift overlap, applyEdit guard, --jobs 3 default) and proper (furniture A-11, roof types, wall/gate/pool/parking/seating/step, north needle). QA PASSED 409.0 s / 414.5 s, no bugs. TL plan/impl/outcome APPROVED.
- Republished same URL (v3): https://claude.ai/artifact/LDbG9XdU1UeAMcVwqmxAB9 ; testing doc https://claude.ai/artifact/8bhboWAnZq2JL9aA977MJj
- Vegetation moved to F4-T3 by plan.

## Batch 11 result: F4-T3 DONE (F4 review pending)
- Vegetation (seeded scatter, PC.data.vegetation, caps 120/200, instanced), sky per A-13 (PC.sky.compute = Designer 16-row table exactly), applyLook recolour-only, Light tab live, seasons, veg-short warning (80 % of min(veg.area, 1020 m2), PM+TL option a). Camera Reset stays street side, no hint line (camera-decision.md).
- TL plan/impl/outcome APPROVED; QA PASSED 393.8 s. App v4 same URL; testing doc https://claude.ai/artifact/TVkPgkC5K4Fbah3cgtEVha (section 6 = phone check).
- F4 feature review (PM + CTO) waits ONLY on the client phone answers (CD-6); hand-off pack, acceptance matrix and F5 debt list are in F4-T3/outcome-review.md.

## Batch 12 result: F5-T1 room finder DONE
- Go to room dropdown (grouped by level), flyTo on shared animation driver (100 ms step cap), highlight mesh, caption "Room · Level", basement 15° pose. QA B-1 (groundOuter covered basement pit since F4-T1) fixed 88dd164 + leak check. QA round 2 PASSED 413.0 s. TL outcome APPROVED.
- App v5 same URL; testing doc https://claude.ai/artifact/RqY92PserUTatAtqGGG5dJ

## Batch 13 result: F5-T2 drone tour DONE
- PC.tourplan + PC.three.tour on the F5-T1 driver; uniform Catmull-Rom curves (TL-accepted deviation), eye floor 5.33 m from vegetation table, 1.2 s lead-in, sample 53.5 s. QA PASSED 413.3 s (extra viewports moved behind QA_FULL=1; QA_FULL green 184.4 s). TL outcome APPROVED.
- App v6 same URL; testing doc https://claude.ai/artifact/Fi6GyeFc5Cyyr4bejW5GUX
- Run-time rule (TL): target 420 s; 420-440 re-run once; 2 in a row >420 or any >440 => trim before merge; hard cap 480 s. QA_FULL=1 list must be green before F5 feature review.

## Batch 14 result: F5-T3a DONE
- Lens-shift framing, 640x360 side-by-side, caption/tour bar placement, O-1 shadow data, tour pacing (overview 4.5 s, bEyeUp 2.5), legend Parking/Pool, A-15 label culling, saving-stopped toast + no-save chip + read-only resume. QA round 2 PASSED 419.8 s. TL outcome APPROVED. App v7; testing doc https://claude.ai/artifact/SCCTR7B12rB9kFeCdKDsUb

## Batch 15 result: F5-T3c + F4/F5 reviews (conditional)
- run-all longest-first (tests/durations.json); default run 398.8 s, QA_FULL=1 450.4 s on aaaddae, 0 failures (docs/04-feature-reviews/qa-full-gate.md).
- F4.md and F5.md: PM APPROVED; CTO VERDICT: CHANGES REQUESTED only for the CD-6 phone gate (no code change). Closing table per gate option in the CTO sections (2c63a0a).

## Batches 16-17 result: F6-T1 realism (CD-8, client brief "too far from realistic")
- T1a textures/tone mapping/sky/fog/street/on-demand shadows; T1b resetPhi 62, window+door decals, contact darkening, blob shadows, lumpy trees, winter meadow, Designer light retune; T1c roof coping/drip/roofDeck/parapet band, meadow #6A8550, hall windows (house v3). TL: CD-8 complete for MVP. Deferred: roof tank/AC (R4), pitched eaves (R5), tinted far meadow (G2b, needs CTO).
- App v8 (T1a+b) and v9 (T1c) same URL; testing docs https://claude.ai/artifact/QrufpUQDKXSzyVP6rtiAGr and https://claude.ai/artifact/BLm3YEvaVGGgwaHrU38GmG.
- Gate now: median of 3 quiet default runs <= 420 s, none > 440 (TEAM-PROTOCOL addendum). Main 6968d00: 401.8/406.5/408.9 s. QA_FULL ~464 s. Release step = 2 parallel processes (stream 243.5 s, rows 239.7 s; NOTE 260, limit 300) - ~16 s room each; next moves need a third process or real cuts. dist ~22 kB under the 627,302-byte C-1.3 budget.
- CD-7 phone check can run on v9; F5-T3b etc. as below.

## Waiting on the client: phone-gate decision card (sent 2026-11-22)
- Option 1 (name phone checker, rec): record CD-6 a-c answers -> F4 APPROVED; run F5-T3b on findings -> QA incl. QA_FULL=1 -> republish -> F5 APPROVED.
- Option 2 (desktop Chrome via Claude in Chrome): check published URL (three.js loads from cdnjs in iframe, stage 5 draws, 0 console errors, mouse orbit/zoom/pan, level, Roof, room pick, tour start/stop, screenshots) -> both APPROVED with risk recorded; F5-T3b items -> limits.
- Option 3 (waive): new CD entry in client-decisions.md -> APPROVED "waived by client"; release note says never seen on a real device.
- Then release commit (checklist in docs/03-tasks/F5-T3/outcome-review.md) + final publish. Release note draft: docs/05-release/release-notes.md (PM).

## Known limits owned by Designer F5-T3b (after F5-T3a; detail in docs/03-tasks/F5-T3/impl-notes.md)
- Legend at 1280x800 wraps to 2 lines (46 px) when Parking, Pool and "* set by you" all show; "* by you" does not fix it, PM text kept. Accepted unless the phone/desktop pass says otherwise.
- Tour: eyes-on frames at stops and leg quartiles not taken (r128 frame capture too slow in CI); numbers only (verify/tour.mjs). Do it in the real-device pass.
- Stage-3 warnings chip vs a label at the default fit: not reproduced in the sweep; re-check on the phone screenshots.
- Stage-3 640x360 blocking message: no clamp (Approve stays in view at 4.5 lines); revisit only if a longer note text appears.
- Not T3b (known limits, F5-T3/outcome.md §8): zero-room house has no 3D (A-9 refusal, unreachable via UI); run-time headroom ~0.2 s (419.8 s).
- Phone-only tuning waits for device evidence (CTO condition a): closing radius, gesture thresholds, pixel ratio, shadow map size, occl.bottom for the phone bottom dock.
