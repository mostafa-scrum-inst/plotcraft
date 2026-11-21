# PlotCraft — Product goals and user stories (prototype)

Owner: PM. Source: `docs/00-brief.md`. Status: approved by the CTO (round 2); round 3 edits made at the F1 feature review; round 4 edits apply the client's binding decisions `docs/01-product/client-decisions.md` (CD-1 to CD-3); round 5 edits made at the F2 feature review; rounds 6 and 7 fix user-facing texts at the F3-T2 and F3-T3 plan reviews; round 8 edits made at the F3 feature review; round 9 fixes the stage-5 level selector labels at the F4-T1 plan review; round 10 applies CD-4 / CD-5 and answers the F4-T2 plan questions; round 11 records the default-camera decision and the vegetation-shortfall warning at the F4-T3 start.
This document says **what** and **how we know it works**. How it is built is the Tech Lead's call.

## Changes in round 11 (2026-11-21, F4-T3 start: default camera; F4-S2 / F4-S3 checked; no story IDs changed)

| Item | Decision |
|---|---|
| Default camera (TL F4-T2 outcome review item 6) | PM + Designer: **Reset stays on the street side** (A-12, option (a)); no "Garden" view, no yard-facing Reset. If the F4-T3 sample shots at Reset hide the pool and seating completely, the 3D panel gets one line: "Drag to turn the model and see the garden." Record: `docs/03-tasks/F4-T3/camera-decision.md`. F4-S2 Reset criterion amended. |
| Vegetation shortfall (TL F4-T3 plan review, Q2) | **Yes, a visible non-blocking warning; it is not a client question.** Without it, F4-S1 "vegetation covers roughly the effective %" would fail silently. **Threshold:** placed planting (`site.vegPlaced`, nominal counting areas) **< 80 %** of the effective vegetation area (`veg.area`, after any "reduced" clamp). This is the same 20 % tolerance as A-9. **Text:** "Only {a} ({p} % of the plot) of planting fits around the building, parking and pool: the 3D garden is smaller than the {q} % asked. Try a lower footprint %, fewer cars or a smaller pool." `{a}` is placed area, `{p}` placed %, `{q}` the effective %, all following the unit (R4). **Where:** with the F2-S3 warnings on stage 2, and again on Floor plans like the others. If the placement can only be computed in the 3D layer, it goes in the stage-5 panel instead, in one line (TL decides). **Rules:** it can show together with "Vegetation was reduced to what fits"; at vegetation 0 % it never shows. The sample must not show it (6.2); if it does, FS stops and asks. **Cap (FS impl, PM ruling (a)):** the target is `min(veg.area, 1 020 m²)`, where 1 020 m² is what the A-9 caps cover (120 trees × 6 + 200 shrubs × 1.5). The warning names only a yard shortfall, never the performance cap, so the text is unchanged. A large garden above the cap shows at most 120 trees and 200 shrubs and gives no message: this is a known limit (G6), restated at the F4 review. |
| F4-S1 vegetation, F4-S3 time of day and seasons | Re-read for F4-T3: current. They match the F4-plan / TL F4-T3 hand-off: slider 0–24 h, presets morning / noon / evening / night (8 / 12 / 17.5 / 22 h), Q5-oriented sun, seasons with vegetation and ground tone, no rebuild and no camera move, "approximate — not real solar data", opens at noon in summer, vegetation about the effective % and never in the building, parking, pool, seating or entrance path. No text change. |

## Changes in round 10 (2026-11-21, F4-T2 plan + plan review: CD-4 / CD-5 applied, PM questions Q2, Q3, Q5, Q7, Q8 and the Roof-on view; no story IDs changed)

Answers to `docs/03-tasks/F4-T2/plan.md` §14 (PM) and `plan-review.md` required item 2. Measured on the FS scratch probe (CD-5 literal definition, generator sweep of 2 400 programmes, 2 367 laid out): 26.7 % of levels flag a room (9.2 % of rooms); 5.7 % of levels with 1–3 rooms, 22 % with 4–5, 45 % with 6–8; 15 % below 50 % fill, 66 % above 85 %. Of the 1 068 flagged rooms, 780 are larger than 9.5 m2 (bedrooms, living rooms boxed in), only 288 are service-sized. So the warning is mostly signal, not noise: it marks the floors an architect would fix anyway (the generator has no circulation rule, A-8).

| Item | Decision / final text |
|---|---|
| CD-4 numbers (client decision) | 4.1 Q11, 4.3 "Levels", F3-S1 sweep, F5-S2 and G6 now say **10 rooms per plan level** (maximum house 4 x 10 = 40 rooms). |
| Q2 sample (CD-5) | **Neither (a) nor (b): refine the access definition (c), within CD-5.** 6.2 requires the sample to show **no warnings**, and its boxed-in Bathroom (S 4, between the Maid's room and the Laundry) is the maid's bathroom, a normal Gulf-villa layout, not a defect. Changing the sample breaks goldens for nothing. With the refinement below the sample is clean (probe: Ground and First no flag) and its layout, goldens and approvals are unchanged. |
| CD-5 access definition (PM refinement of the PM definition in CD-5; the client's decision "warn, name each room" is unchanged) | A room **has access** when it shares at least 0.8 m of a non-exterior side with hall (footprint not covered by rooms or the core) or with the stair / lift. A room without it is **reached through** a neighbour that has access or is itself reached, when they share a wall (`PC.layout.adjacent`) and either (1) they are a must-be-adjacent pair (CD-5's en-suite rule), or (2) it is a **Bathroom** and the neighbour is a **Bedroom or Maid's room** (en-suite), or (3) it is a **Storage or Laundry** and the neighbour is any room other than a Bathroom, Storage or Laundry. Chains count (fixed point: a Bathroom through a Bedroom that is reached through its paired Living counts). Every other room without access is named. The host table is data (`PC.C`, one place), unit-tested per rule. Effect on the sweep: at most about 4 points fewer flagged levels (the typeless sweep cannot measure it exactly; small-room proxy 26.7 % -> 22.5 %); a boxed-in Bedroom, Living, Majlis, Office, Kitchen or Dining is always named. |
| Q3 warning text | One line per room, listed with the level's warnings, never blocking Approve, updated after each release: **"The Bathroom has no way in from the hall or stairs. Move or resize a neighbouring room to open one."** The room is named as the pair warning names it (with its number when the floor has two of a type, e.g. "Bathroom 2"). "Drag a room aside" dropped: on a full floor there may be no hall to drag into, so the hint names resize too. |
| Q3 hall pockets | A hall pocket that touches no stair, lift or entrance **counts as hall for now** (FS proposal accepted). Known limit, listed in the F4-T2 outcome; revisit only if the client or the phone check reports it. |
| Q5 Undo | **Dropped on a tab switch to another floor** (accepted: one step, on the floor you see). Button `aria-label` and tooltip "Undo last edit". Confirmation in `plan-msg`: **"Last edit undone."**; when the undo also restores the approval: **"Last edit undone. Ground floor approved again."** (floor name as in the other stage-3 messages). |
| Q7 gate without a wall | **No gate without the wall** (Q17 lists the gate under the wall; Designer agrees). On stage 2 the Gate position control is **disabled while Boundary wall is off** (like Pool size with Pool off); the chosen value is kept and comes back with the wall. The entrance path strip kept free of vegetation (A-13) runs from the entrance to the street edge when there is no gate (TL places it). |
| Q8 seating that does not fit | **Never silent**: a new F2-S3 warning (non-blocking, stage 2 and again on Floor plans, like parking / pool), computed by the same placement as the 3D: **"Garden seating does not fit in the yard: it is left out of the 3D scene. Try a lower footprint %, fewer cars or a smaller pool."** The sample's seating must fit (6.2 no warnings); if it does not, FS stops and asks. |
| Roof on (TL plan review, required item 2) | **Accepted**: with the Roof on (level "All") the house is shown **closed**: the exterior walls continue from the dollhouse cut up under the roof, so the roof never floats; the entrance stays visible. With the Roof off the dollhouse cut is as today. F4-S1 and 3.3 reworded. |

**Client information (non-blocking, with the next client message):** CD-5 warnings will be common on full floors (about 1 in 4 laid-out floors, nearly half of floors with 6 or more rooms). The decision stands; the client may later ask for a generator access rule as its own task (see the card in `status.md` / PM reply).

## Changes in round 9 (2026-11-21, F4-T1 plan review: stage-5 level selector labels and two confirmations; no story IDs changed)

TL recommendations in `docs/03-tasks/F4-T1/plan-review.md` ("For the PM", Q11 and Q3) confirmed. The visible words are the ones the room "Floor" pickers already use on stages 2 and 3 (Basement / Ground / First / Second); the full names match the stage-3 floor tabs ("Ground floor", "First floor").

| Where | Final text |
|---|---|
| Stage-5 level selector (F4-S1), visible labels | "All / Basement / Ground / First / Second" (only the house's levels are shown, in that order, "All" first and selected on open). Confirmed as the TL recommended. |
| Stage-5 level selector, screen-reader names (`aria-label`) | "All floors", "Basement", "Ground floor", "First floor", "Second floor" (the `LEVEL_LABEL` names; each contains its visible word). "All floors" added by the PM so the first option names what it shows; the group keeps its existing name. |
| Fallback, only if the 5-option house overflows at 360 px in the e2e check (Designer judges the shot) | "All / B / G / 1 / 2" for that case only, same screen-reader names. Never the default: "1" and "2" read differently to UK and US clients. |
| Disabled controls not built yet (Light: time, presets, season; Tour: room select, tour buttons; Roof switch until F4-T2) | No new UI text: they are shown disabled, with no "coming soon" note. The phone-check guide sent with the F4-T1 publish says, in one line: "Light, Tour and the Roof switch are greyed out on purpose: they arrive in the next builds." Confirmed as the TL recommended. |
| Stage 4, F4-T1 publish | "Skip to 3D" (sample strip) stays beside "Build 3D model" until F4-T2 applies round-8 decision 9 (strip on stages 1 and 3 only). Accepted as cosmetic: same one tap; the phone-check guide does not mention it. |

F4-S1 amended to name the labels.

## Changes in round 8 (2026-11-21, F3 feature review; no story IDs changed)

Decisions recorded in `docs/04-feature-reviews/F3.md` (PM review). Work goes into one FS rider, the "F3 follow-up bundle" (TL places it; PM recommends F4-T2).

| Item | Change |
|---|---|
| F3-S1 low fill (QA F3-T1 obs 1; rider "defaults leave most of each floor as hall") | New non-blocking per-level hint when rooms + stair + lift fill under 50 % of the footprint (whole %, rounded down): "Rooms fill only 48 % of the Ground floor. Add rooms, choose larger sizes, or lower the footprint % (Q3)." Default room list unchanged; the sample (84 %) shows no hint. Rooms on an under-filled floor are packed, not spread (known limit). |
| F3-S1 / F3-S2 unmet pair (QA F3-T1 obs 4) | Warning text gains the fix: "Kitchen and Dining are not next to each other. Drag one against the other to join them." |
| F3-S2 undo (QA F3-T2 obs 2) | One-step "Undo last edit" on stage 3: restores the current floor's plan as before the last move or resize, approval state included; one step; gone after Regenerate, an R5 reset of that floor or leaving stage 3; 44 px control. Non-goal "Undo history" amended to allow exactly this step. |
| F3-S2 minimum in ft (QA F3-T2 obs 4) | The 1.5 m minimum is a snap candidate for a shrinking edge, so ft users reach 1.5 m (4.9 ft), as R4 requires (one limit, not two). |
| F1-S5 sample strip (QA F3-T3 obs 5) | The strip with "Skip to 3D" shows on stages 1 and 3 only; on stage 4 "Build 3D model" is the same one tap. |
| Known limits acknowledged | Keyboard room editing out of scope; corner resize only if the client asks (F5-T3); Clear then identical redraw keeps the plans; maid bed at 60 % in 1.5 m maid rooms, a few sparse pieces at 0.70 in 3:1 rooms (judged in 3D at F4-T2); no `:has()` shows the Q19 hint in Modern colours. |
| Pending client answers | (1) Is 8 rooms per floor enough? (4.3 "Levels", F2-S2, G6 maximum house follow the answer.) (2) Must every room open onto the hall or stairs? (no circulation rule today, A-8). Recorded in `client-decisions.md` when answered. |

## Changes in round 7 (2026-11-21, F3-T3 plan review: Q18 card descriptions; no story IDs changed)

Q18 is a palette swap of furniture and floor finish only (F4-S1); walls follow Q10. Each description names the fabric, wood and accent/metal colours that the card's swatch strip shows (F3-T3 plan §1.2, §4), in plain words:

| Where | Final text |
|---|---|
| Q18 card description, Modern (F3-S4) | "Graphite, dark wood, copper" (was "Dark wood, graphite, warm accent"). Confirmed as the TL recommended. |
| Q18 card description, Classic (F3-S4) | "Cream fabric, walnut, brass" (was "Cream walls, walnut, brass": wrong, walls follow Q10). Confirmed as the TL recommended. |
| Q18 card description, Minimal (F3-S4) | "Pale grey, light oak, sage" (was "White, pale grey, light oak"). **Changed from the recommendation:** the swatch strip leaves white out (plan §4), and white is shared by all three styles, so it does not describe Minimal; sage is the Minimal accent and is shown. |

Every description stays on one line at 360 px (Designer checks the fit). F3-S4 amended to name them.

## Changes in round 6 (2026-11-21, F3-T2 plan review: user-facing texts and two product answers; no story IDs changed)

Final texts (examples in m; every area and length follows the unit, R4; level and room names are the derived names):

| Where | Final text |
|---|---|
| Selection readout, drawn vs asked (F3-S2) | "39 m² (asked 42 m²)" / "414 sq ft (asked 452 sq ft)", shown only when the two areas format differently; otherwise just the area. Confirmed as proposed. |
| Approve blocked, one overlap between rooms (F3-S2, F3-S3) | "Living and Majlis overlap. Move or resize the marked rooms to approve this floor." |
| Approve blocked, one room over the stair or lift | "Kitchen overlaps the stairs. Move or resize it to approve this floor." ("the lift" / "the stairs and lift" as the case may be) |
| Approve blocked, two or more overlaps | "3 overlaps on this floor. Move or resize the marked rooms to approve it." |
| Approved (F3-S3) | "Ground floor approved." / last one: "All floors approved. Next: Interior." Confirmed. |
| Edit on an approved floor, once (F3-S3) | "Ground floor is back to Draft. Approve it again when you are done." Confirmed. |
| Un-approve by tapping "Approved" | "Ground floor is back to Draft." |
| Regenerate dialog (F3-S1; asks only when edited or approved, R5 round 5) | Title "Regenerate this floor?". Text: edited: "Your manual edits to the Ground floor will be lost." / approved: "The Ground floor's approval will be cleared." / both: "Your manual edits to the Ground floor and its approval will be lost." Each followed by "It will be laid out again from the room list." Buttons "Regenerate" / "Cancel". An untouched Draft regenerates without a dialog. |
| Clear (stage 1) and other own-confirmation dialogs: plans sentence (R5) | "The floor plan of the Ground floor will be regenerated, with its manual edits and approval." / plural "The floor plans of the Ground floor and the First floor will be regenerated, with their manual edits and approvals." **Correction:** name only what those levels really have: "with its manual edits" (edited only), "with its approval" (approved only), "with its manual edits and approval" (both); for several levels the union ("with their manual edits and approvals" when any has both kinds, else the one kind). "lost" / "regenerated or lost" as today when levels are removed. Sentence absent when no level has edits or approval. The case "Clear, then redraw the identical outline keeps the plans" may make "regenerated" overstate; accepted (A-7). |

| 4.4 generator retry (TL adopted the FS range, F3-T2 plan review) | New row: "Generator retry after no layout: cell scale 0.75–1.25 (first pass 0.8–1.2), only when the first pass finds no layout". |

| Stage-3 default hint (F3-S2; replaces the FS's "Drag a room to move it; drag an edge to resize." and the markup's corner mention) | "Drag a room to move it; tap it, then drag a handle to resize." Same text for touch and mouse (resize handles appear only on the selected room, so selecting first is the step users miss; zoom/pan are the standard gestures and need no hint). If it does not fit one line at 360 px, use "Drag to move; tap, then drag a handle to resize." (Designer checks the fit). |

Product answers:
| Question | Answer |
|---|---|
| Corner resize required? | **No.** F3-S2 amended to "by its edges". Two edge drags give any size; on a phone, four edge handles keep 44 px targets clear of each other and of the move target on small rooms, which corner handles would crowd. Corner handles may come later as polish (F5-T3) if the client asks. |
| Should tapping "Approved" un-approve? | **Yes**, as a toggle, without a dialog: nothing is lost and it is undone by tapping Approve again. The button states its state to assistive tech (pressed); the message "Ground floor is back to Draft." confirms it; the counter, tab badge and Next lock update at once. |

## Changes in round 5 (2026-11-20, F2 feature review; no story IDs changed)

| Item | Change |
|---|---|
| R5 per-level rule | Clarified (F2-T2 obs 2, kept as built): proportions follow the buildable box, so a setback change can change the footprint's width and depth (sample, sides 2 -> 2.5 m: 9.5 x 15 -> 9 x 15.5 m) and then resets and asks, even though the old size would still fit. |
| F2-S1 | Edge labels (F2-T2 obs 3): the street edge and every overridden edge are always labelled; other short edges may go unlabelled at small scale, because the F2-S4 edge list gives every edge's class as text. |
| F2-S2 | Remove-level dialog (F2-T3 obs 4, kept as built): "Move" also regenerates the receiving level's plan, "Delete" loses only the removed level's; the dialog text says which. 8 rooms per level confirmed (F2-T3 obs 5; 4.3 unchanged). |
| F2-S3 | Per-level "needed" is shown only for levels with rooms; an empty level shows "–" next to its "has no rooms" block (F2-T2 obs 7). Parking- and pool-omitted warnings carry a fix hint (F2-T2 obs 6). Proportion wording written with "×" as built. |
| F2-S4 | The street-edge hint is a toast (in-page, R3), accepted (CTO D5). |
| R5 confirmation, F1-S3, F2-S2 (F3-T1 QA finding, TL recommendation adopted) | R5 asks only when a level that would be reset has manual room edits or an approval (Skip-to-3D approvals included), and names only those levels; resetting untouched generated Draft plans (e.g. after Load sample) asks nothing and does not use up the once-per-visit question. Own-confirmation dialogs (Q7 remove level, Clear) name only those levels and drop the plans sentence when there are none. Tests: after Load sample a size-changing Q2/Q3/Q6/Q7/room change asks nothing and stage 3 then shows new Draft layouts; one approved + one untouched level -> dialog names only the approved one; after Skip to 3D the first size-changing change asks and names every level. |
| F2-S3 fix hints (TL F3-T1 plan review, "For the PM") | Final wording replaces the round-5 draft: parking "Try fewer cars, a lower footprint % or a larger front setback (it moves the building back from the street)."; pool "Try a smaller pool, a lower footprint % or a larger back setback (it moves the building toward the street)." The TL's proposals named a smaller front setback (parking) and smaller back / side setbacks (pool), which move the building the wrong way under the centred-footprint rule. |
| 3.1 / 4.3 rounding cap (CTO F2 finding 1, A-6 step 8 as corrected by the TL) | Stretched / 3:1 footprints: long side at most 3 x short side + 0.5 m after rounding (was 3 x (short + 0.5 m), which allowed e.g. 2.5 x 8.5 m = 3.4:1; now 2.5 x 8 m). 2:1 footprints keep 2 x (short + 0.5 m). Re-checked: 108 (6 x 18 <= 18.5), 75 (15 x 5 <= 15.5), 392 (2:1), 90 (6 x 15), 99 (6 x 16.5), 111 m2 (6 x 18.5 = the cap exactly) and the sample all unchanged; the 3.1 "7 m wide" illustration now reads 21.5 m. Implemented in F3-T1. |

## Changes in round 4 (2026-11-20, client decisions CD-1 to CD-3 on the F2-T1 QA observations 1, 4, 5; no story IDs changed, one added)

| Item | Change |
|---|---|
| 3.1 footprint proportions (CD-1) | A footprint that the plot clamps (cannot reach its target at up to 2:1) may grow beyond 2:1 **up to 3:1** (stretch of the 2:1 result's long side, plus 3:1 tried in both orientations; see the CTO round-4 rows below); the largest result wins, ties keep the 2:1 result. Unclamped footprints unchanged (bounding-box proportions, 2:1 at most). |
| 3.1 edge classification (CD-2) | The 40-degree rule is now the **automatic** class; the architect can override any non-street edge to back or side. Overrides are cleared when the outline changes, when the closed shape is reopened (even if re-closed identically; changed after TL answer 4, also in F2-S4) or when the street edge (Q6) changes. |
| 4.3 | Footprint proportion row (2:1 normally, 3:1 when clamped); edge-override limits row. |
| R5 | New layout-class input "edge-class override": follows the existing footprint-size signature rule (resets only if the footprint's width or depth changes; moving it resets nothing). Clearing overrides is part of the outline or Q6 change that causes it: one proposal, one dialog. |
| Non-goals (CD-3) | Zero lot line / building on the boundary is out of scope; a 0 m setback keeps the footprint centred. Also recorded: the 40-degree threshold itself is not changed or blended. |
| F2-S1 | Preview labels show the class actually used, with overridden edges marked. |
| **F2-S4 (new)** | Correct an edge's class (back / side): tap, keyboard and phone criteria, labels, saved in the draft, cleared rule, R5, sample. |
| F2-S3 | Footprint-clamped warning has two wordings; the proportion wording names the 3:1 limit and is used only when that limit is what stops the building. |
| F3-S1 | Generator criteria must hold on footprints up to 3:1 (CD-1 consequence). |
| 6.2 | Re-verified: unaffected (footprint not clamped, so the 3:1 rule never runs; the sample has no overrides). |
| 7 | Traceability row for the edge-class override. |
| 3.1 / 4.3 CD-1 wording (CTO round-4 item 2) | "Along the buildable area's long direction" dropped; now described as A-6 step 4b does: stretch the long side of the 2:1 result up to 3:1, and also try 3:1 in both orientations; tie order stated. |
| 3.1 / 4.3 rounding bound (TL F2-T3 increment-1 ruling 1, A-6 step 8) | "Less than one 0.5 m rounding step" replaced by the exact cap: after rounding, long side <= 2 (or 3) x (short side + 0.5 m). Text only; examples and sample unchanged. |
| 3.1 / F2-S3 clamped rule (CTO round-4 item 1) | After the stretch, a footprint is not clamped when its long side = target / short side rounded down to 0.5 m (only rounding lost). Cases: 10 x 50 m at 20 % -> 6 x 16.5 m, no warning; at 24 % -> 6 x 18.5 m = 111 m2, proportion wording. |

## Changes in round 3 (2026-11-20, F1 feature review; no story IDs changed)

| Item | Change |
|---|---|
| 4.1 text error | Default ground floor needs **60 m2** (was written as 58): Living M 30 + Kitchen M 14 + Bathroom M 6 + stair 10. |
| 3.1 concave plots | Added the CTO's fallback bullet (other centres on a 0.5 m grid; blocking conflict if nothing of 20 m2 fits). |
| R5 | Aligned with the CTO decision on the per-level signature: footprint **size** and street edge count, footprint position does not; the confirmation appears only when at least one valid plan would really be reset and names the affected levels. |
| F1-S4 | Fourth stepper state recorded: reachable but not yet visited = plain "available". |
| F1-S5 | Product decision: switching the unit (Q1) does **not** count as modifying the sample, so "Skip to 3D" stays. Scheduled as a rider on F2-T2. |
| F1-S1 / F1-S2 | Recorded as built: Undo reopens a closed shape; Fit view control; edge labels fall back to the inner side; the grid coarsens when zoomed out. |
| 4.3 / new 4.4 | Plot grid row describes the adaptive grid; new 4.4 lists interaction numbers fixed during implementation (tap limit 700 ms, grid minimum 6 px, parking entrance strip 2 m, and others). |

## Changes in round 2 (2026-11-19, answering `cto-review.md` round 1)

| CTO item | How it was addressed |
|---|---|
| 1 Footprint/setback geometry | New section 3.1: edge classification (front / back / side), buildable area, single street-aligned rectangular footprint centred in the buildable area, not user-movable, shared by all levels. Added to non-goals. Recommendation taken in full, plus two additions the rule needed: footprint proportions and rounding to 0.5 m. |
| 2 Defaults and numbers | New section 4: defaults for Q1–Q19, S/M/L areas for 10 room types, exact-area range, stair/lift allowance, parking and pool sizes, grid/snap, plot limits, metres as stored unit. Sample (6.2) retuned and verified by arithmetic: footprint 25 %, 7 rooms per floor, 84 % fill on each floor, no warnings. |
| 3 R5 | Rewritten: all 19 questions classified, per-floor regeneration rule (a floor resets only if its own inputs changed), one confirmation per editing visit, Cancel restores the previous answer. |
| 4 Level model | New section 3.2: plan levels versus roof, basement must have a room, roof has no tab and no approval, stairs exist when there are 2+ levels counting basement and usable roof, basement seen through an opened ground. |
| 5 Roof | Section 3.3: one-line definitions of flat / pitched / terrace; usable roof disables pitched; separate "Roof" toggle, default off, forced off by room finder and tour (F4-S1). |
| 6 Staircase | Fixed list of 5 positions, default Centre (section 4.1, F2-S2). Stair dragging dropped: position comes from Q14 only (F3-S2). |
| 7 Performance proxy | G6 and F4-S2 now carry mock-testable limits for the maximum house: 150 meshes or fewer, one shadow-casting light, shadow map 1024 or smaller, pixel ratio 2 or lower, no frames requested while hidden. |
| Non-blocking | F1-S1: crossing vertex is rejected (one behaviour). F3-S2: overlap allowed while dragging, marked invalid, blocks approval. G3: "Skip to 3D" is a stated sample-only exception. G1: the 10-minute figure is a goal, not an acceptance criterion. F3-S1: no generated room longer than 3 times its width. Maximum 8 rooms per floor (was 12). F4-S1: Q18 is a palette swap only; furniture is a fixed block set per room type. |

## 1. Goals

| # | Goal | Measure |
|---|------|---------|
| G1 | An architect can go from an empty grid to an explorable 3D dollhouse in one sitting. | Testable: with the sample project, 3D is reached in at most 6 taps. Aspirational (not an acceptance criterion): a first-time user finishes all five stages in under 10 minutes. |
| G2 | The whole brief is covered end to end. | All 19 approved questions are asked and each one visibly changes the plans or the 3D scene (traceability table, section 7). |
| G3 | The architect stays in control of the layout. | No 3D build is possible until every plan level is individually approved; any room can be moved/resized before approval. Only exception: "Skip to 3D" on the unmodified sample project (F1-S5). |
| G4 | Works on any device from day one. | Every story passes at 360x640 touch, 768x1024 touch and 1280x800 mouse; no horizontal page scroll; all touch targets >= 44 px. |
| G5 | Robust inside the sandbox. | Zero uncaught console errors on the happy path and on every listed edge case; app fully usable with `localStorage` unavailable; no `alert/confirm/prompt`, downloads, or network calls other than the one three.js script. |
| G6 | Runs on a mid-range phone. | Hosted page: sample scene stays interactive (orbit responds without visible stalls). Locally testable proxy for the **maximum house** (3 floors + basement, 10 rooms per level (CD-4), furniture "full", pool, 4 covered cars, all extras): 150 or fewer meshes in the scene (an instanced mesh counts as one), exactly one shadow-casting light, shadow map 1024 or smaller, pixel ratio 2 or lower, no animation frames requested while the 3D view is hidden. The TL may adjust these numbers in this row. |

### Non-goals (prototype)
- Real solar positions, climate or geographic data (time of day and seasons are visual approximations).
- Structural, code-compliance or cost calculations; construction-grade drawings.
- Export/import, printing, sharing, accounts, multi-project management, collaboration.
- Curved boundaries, plot holes, sloped terrain, imported site surveys or map underlays.
- Moving, rotating or reshaping the building footprint by hand; L-shaped or multi-block buildings; different footprints per level.
- Building on the boundary ("zero lot line", party walls, one-sided placement): a 0 m setback only widens the buildable area; the footprint stays centred in it and is never pushed against an edge (client decision CD-3).
- Changing or blending the 40-degree back / side threshold; the architect corrects a surprising class with an edge-class override instead (CD-2, F2-S4).
- Footprints longer than 3 times their width; overriding the street edge's class (it is always front).
- Free-form room shapes (rooms are rectangles), dragging the staircase or lift, doors/windows editing, custom furniture placement.
- Rooms on the roof.
- Photorealism, external textures/models/fonts; walk-through (first-person) mode.
- Undo history beyond "undo last point" in plot drawing, one-step "Undo last edit" and "regenerate floor" in plans (round 8).
- Languages other than English; RTL.

## 2. Product-wide rules (apply to every story; QA checks them on every task)

- **R1 Stages.** Five stages in fixed order: **1 Plot -> 2 Questions -> 3 Floor plans -> 4 Interior -> 5 3D view**. A stage is reachable only when all earlier stages are valid/complete.
- **R2 Devices.** Layout works from 360 px wide, portrait and landscape; touch, mouse and basic keyboard (Tab/Enter/Esc on controls); targets >= 44 px; no page-level horizontal scroll; no accidental page scroll/zoom while dragging on a canvas.
- **R3 Messages.** All errors, warnings and confirmations are in-page (inline text, banner or in-page dialog). Never native dialogs.
- **R4 Units.** One unit setting (m or ft) for the whole app. **All geometry is stored in metres and every limit in this document is defined in metres**; feet are a display conversion only (so "1.5 m" shown as "4.9 ft" is one limit, not two). Lengths show 1 decimal, areas whole numbers with unit (m2 / sq ft). Switching unit converts displayed values and never changes stored geometry; values typed in ft mode are converted to metres on entry.
- **R5 Downstream invalidation.**
  - *Classification of every input:*

    | Input | Class | Effect on floor plans |
    |---|---|---|
    | Plot shape, Q2 setbacks, Q3 footprint %, edge-class override (F2-S4) | Layout | If the footprint's width or depth changes -> every plan level regenerated. If the footprint only moves on the plot (or nothing changes, e.g. switching an edge between back and side when both setbacks are equal), plans are kept (see per-level rule) |
    | Q6 street edge | Layout | Every plan level regenerated, always |
    | Q14 stair position, lift yes/no | Layout | Every plan level regenerated |
    | Q7 floors / basement / usable roof | Layout | Added level is generated; removed level is deleted; other levels are untouched **unless** the change makes stairs appear or disappear (section 3.2), which regenerates every level |
    | Q11 room list, Q12 sizes, Q13 adjacency | Layout | Only the levels whose rooms, sizes or pairs changed |
    | Q1, Q4, Q5, Q8, Q9, Q10, Q15, Q16, Q17, Q18, Q19 | Appearance / site | None: layouts and approvals are kept |

  - *Per-level rule (the single test):* a plan level is regenerated, losing its manual edits and its approval, **only if one of its own inputs changed**: the footprint's width or depth, the street edge, stair/lift presence or position, the rooms on that level with their sizes, or the adjacency pairs on that level. A level whose inputs are unchanged keeps its layout and approval exactly. Plans are kept relative to the footprint, so a change that only moves the building on the plot (a small vertex move, a setback change that shifts the centre) resets nothing and asks nothing; it shows in the site preview and summary. (CTO decision, step 2.) Because the footprint's proportions follow the buildable area's bounding box (3.1), a setback change can also change its width and depth (sample, sides 2 -> 2.5 m: 9.5 x 15 -> 9 x 15.5 m); that is a size change and resets, even when the old size would still fit (round 5: kept, one deterministic rule).
  - *Confirmation:* shown once per visit to stages 1–2 (it is not repeated until the user has been back to stage 3), on the first change that **would really reset at least one level whose valid plan holds the architect's work: manual room edits or an approval** (round 5 decision: R5 protects the architect's work, not generated output). A change that resets only untouched generated plans (Draft, never edited, e.g. right after Load sample) is applied without asking: those levels are simply regenerated on entering stage 3 (the generator is deterministic, so nothing is lost), and such a change does not use up the once-per-visit question. A layout-class change that resets nothing is likewise applied without asking. Text names **only the levels with edits or an approval** and states that their floor plans will be regenerated and that the manual room edits and approvals on them will be lost. An action with its own confirmation (Clear plot, removing a level that has rooms) mentions the loss of floor plans in that same dialog, naming only those levels, and leaves the plans sentence out when there are none: one dialog, never two. Approvals made by "Skip to 3D" count as approvals and are protected. **Cancel** restores the previous value (for a vertex drag: the vertex returns) and nothing is invalidated. **Continue** applies the change; further layout-class changes in the same visit apply without asking.
  - *Edge-class overrides (round 4):* an override is a setback change for one edge, so it follows the per-level rule exactly: it resets levels only when the footprint's width or depth changes, and then asks per the confirmation rule (Cancel restores the edge's previous class). When an outline change or a Q6 change clears overrides (3.1), the clearing is part of that same change: the gate judges the combined result, so there is one dialog at most, never one for the edit and another for the clearing.
  - *Observable result:* on returning to stage 3, changed levels show a new generated layout in Draft; unchanged levels are as the user left them.

## 3. Site, level and roof model (product rules)

### 3.1 Setbacks, buildable area and footprint
- **Front** edge = the Q6 street edge. Any other edge is **back** if its outward direction is within 40 degrees of pointing straight away from the street edge; otherwise it is a **side**. Q2 has three inputs: front, back, sides (one value for all side edges).
- **Edge-class overrides (CD-2).** The 40-degree rule gives each non-street edge its **automatic** class. The architect may override any non-street edge to the other class (back <-> side) in the stage-2 site preview (F2-S4); the edge then takes that class's setback. The street edge is always front and cannot be overridden. Setting an edge back to its automatic class removes the override (there is no "override equal to automatic"). Overrides are **cleared** (all of them, every edge back to automatic) when:
  - the plot outline changes or is reopened: any vertex moves to a different position, the vertex count changes (Undo, Clear, redraw), or the closed shape is reopened (Undo on a closed shape), even if the identical outline is then re-closed. Overrides therefore exist only on a closed plot (round 4, TL answer 4: reopening already resets Q6, so keeping them would depend on whether Q6 was at its default);
  - the street edge (Q6) changes (classes are relative to the street; Q6 regenerates every level anyway).
  Loading the sample or starting new also leaves no overrides. Everything below ("relevant setback", buildable area, footprint) uses the class actually in effect.
- **Buildable area** = the part of the plot that is at least the relevant setback away from every edge.
- **Footprint** = **one rectangle**:
  - aligned to the street edge (one pair of sides parallel to it);
  - target area = Q3 % of plot area;
  - proportions = those of the buildable area's bounding box measured parallel/perpendicular to the street edge, limited to 2:1 at most;
  - width and depth each rounded down to 0.5 m (always in metres, independent of the display unit);
  - centred on that bounding box;
  - if it does not lie fully inside the buildable area it is shrunk about its centre until it does (this is the "footprint clamped" warning in F2-S3). Rounding alone is not a clamp and gives no warning.
  - **concave plots (CTO decision):** the centred position is the first choice. If the rectangle cannot keep at least half of its target area there (for example an L- or U-shaped plot whose centre lies outside the buildable area), other centres on a 0.5 m grid inside the buildable area are tried and the position giving the largest rectangle wins (ties: nearest to the bounding-box centre). A result smaller than the target is still the "footprint clamped" warning. If no position gives at least 20 m2, it is a blocking conflict: "the building does not fit this plot: reduce setbacks or redraw".
  - **narrow plots: stretch up to 3:1 (client decision CD-1; CTO round-4 wording).** Only when the result of the rules above is **clamped** (smaller than its rounded target), two more candidates are tried, with the same 0.5 m rounding and never above the target area: (a) **stretch** — if that result is at its 2:1 limit, its long side is lengthened in 0.5 m steps, keeping its short side and centre, up to 3 x the short side (or the target area / short side, if less) while it still fits the buildable area; (b) footprints at **3:1 in both orientations** (long side along the street, and across it), placed by the same centred-then-fallback rules as above. Both orientations matter on concave plots, where the buildable area's long direction (an arm) can differ from its bounding box's. The largest final area wins; ties keep the 2:1-limited result, then the stretch, then 3:1, then 1:3. Example of why the stretch matters: buildable 6 x 15 m gives 72 m2 at 2:1, 75 m2 at exactly 3:1, but **6 x 15 m = 90 m2** with the stretch (2.5:1). An unclamped footprint is never stretched, so every unclamped result (the sample included) is exactly as before.
  - **Clamped after the stretch (CTO round-4 item 1):** when these candidates were tried, the final footprint counts as **not clamped** (no warning) when its long side equals the target area / its short side, rounded down to 0.5 m: only rounding was lost. Otherwise it is clamped. Examples (plot 10 x 50 m, default setbacks): 20 % (target 100 m2) -> **6 x 16.5 m = 99 m2, not clamped, no warning**; 24 % (target 120 m2) -> **6 x 18.5 m = 111 m2** (the 3:1 try, 3:1 plus one rounding step), clamped, proportion wording; 30 % -> 6 x 18 m = 108 m2, clamped, proportion wording.
    - Example (testable): plot 10 x 50 m, street on a 10 m edge, default setbacks (buildable 6 x 45 m), 30 % (target 150 m2). Limited to 2:1: 6 x 12 m = 72 m2 (14.4 %). With CD-1: **6 x 18 m = 108 m2 (21.6 %)**, still clamped (warning with the proportion wording, F2-S3).
    - Example (long side along the street): plot 50 x 10 m, street on a 50 m edge, default setbacks (buildable 46 x 5 m), 30 %: before 10 x 5 m = 50 m2; with CD-1 **15 x 5 m = 75 m2 (15 %)**.
    - Example (setbacks are the reason, no stretch wins): plot 20 x 30 m, default setbacks (buildable 16 x 25 m), 80 % (target 480 m2): the 2:1-limited result 16 x 24.5 m = 392 m2 beats the 3:1 try (8 x 25 m = 200 m2); warning with the setbacks wording.
  - Because width and depth are each rounded down to 0.5 m, the proportions can be slightly beyond 2:1 or 3:1, but after rounding the long side is never more than **2 x (short side + 0.5 m)** for a 2:1-limited footprint and never more than **3 x short side + 0.5 m** for a stretched or 3:1 footprint (CD-1 "up to 3:1", plus at most one 0.5 m step; A-6 step 8). E.g. a 7 m wide stretched footprint is at most 21.5 m long; a 2.5 m wide one at most 8 m.
- The summary always shows the **effective** footprint area and %.
- The user cannot move, rotate or reshape the footprint. **All levels, basement included, use the same footprint.**
- Rooms are rectangles aligned to the footprint (not to the screen grid). The plan view may be drawn rotated so the street edge is at the bottom.
- **Available area per level** = effective footprint area.

### 3.2 Levels
- **Plan levels** (have rooms, a plan tab, and need approval): Basement (if enabled), Ground, First, Second (per Q7: 1–3 floors above ground).
- **Roof** is not a plan level: it never has rooms, a tab or an approval, and is not counted in "n of m approved". A *usable* roof only changes the 3D roof (section 3.3) and counts as a level for stairs.
- An enabled basement must contain at least one room (blocking conflict otherwise). Every above-ground floor must contain at least one room.
- **Stairs exist when the house has 2 or more levels, counting basement and usable roof** (so one floor + usable roof has a stair; one floor alone has none). When stairs exist, the stair block is at the same position on every plan level, set by Q14 only. Lift (Q14) is offered only when stairs exist, and sits next to the stair on every plan level.
- **Basement in 3D:** in the default "All" view the basement is not visible. When the Basement level is selected, or the room finder / tour goes to a basement room, all floors above are hidden and the ground inside the footprint is opened so the basement is seen from above. The camera itself always stays above ground level.

### 3.3 Roof
- **Flat:** flat slab with a low parapet (about 0.3 m).
- **Pitched:** two-slope gable roof, ridge along the longer footprint side.
- **Terrace:** flat slab with a tall parapet (about 1 m) and a pergola block.
- **Usable roof = yes** (Q7): Pitched is unavailable; if Pitched was selected it changes to Flat with an inline note. A usable roof shows a stair-head block on the roof and at least the tall parapet.
- **The roof never hides interiors by default:** a separate "Roof" toggle in the 3D view is **off** by default; the roof is drawn only when it is on **and** the level selector is "All", and then the exterior walls are drawn up to it (closed house, round 10). Using the room finder or starting the tour switches it off.

## 4. Defaults and numbers (single source; the TL may propose changes here, in one place)

### 4.1 Default answers

| Q | Default | Allowed |
|---|---|---|
| 1 Unit | m | m, ft |
| 2 Setbacks | front 3 m, back 2 m, sides 2 m | 0–20 m each |
| 3 Footprint % | 30 | 10–80 |
| 4 Vegetation % | 20 | 0–80 |
| 5 North | pointing from the street edge into the plot (straight "back") | any direction, 15-degree steps |
| 6 Street edge | the edge whose midpoint is lowest on the grid as drawn (tie: the longer one) | any one edge |
| 7 Floors | 2 floors, basement no, usable roof no | 1–3 floors; basement yes/no; usable roof yes/no |
| 8 Ceiling height | 3.0 m | 2.4–4.5 m |
| 9 Roof type | Flat | Flat, Pitched, Terrace (section 3.3) |
| 10 Exterior style | Sand | Sand, White, Terracotta, Grey |
| 11 Room list | Ground: Living, Kitchen, Bathroom. First: Bedroom x2, Bathroom | 1–10 rooms per plan level (CD-4), 10 types |
| 12 Room size | M | S / M / L, or exact 4–80 m2 |
| 13 Adjacent pairs | none | up to 6 pairs per level |
| 14 Stairs / lift | Centre; lift no | Centre, Front-left, Front-right, Back-left, Back-right (front = street side; left/right as seen from the street facing the house); lift yes/no |
| 15 Parking | 1 car, open | 0–4 cars; covered / open |
| 16 Pool | no (size S when switched on) | yes/no; S / M / L |
| 17 Extras | boundary wall yes; gate Centre; garden seating no | wall yes/no; gate Left / Centre / Right along the street edge; seating yes/no |
| 18 Interior style | Modern | Modern, Classic, Minimal |
| 19 Furniture density | Full | Sparse, Full |

The default room list needs 60 m2 on the ground floor (Living 30 + Kitchen 14 + Bathroom 6 + stair 10) and 48 m2 on the first floor; on a small plot the defaults can therefore raise the "rooms exceed available area" conflict, which is the intended behaviour.

### 4.2 Room sizes (m2)

| Type | S | M | L |
|---|---|---|---|
| Bedroom | 12 | 16 | 24 |
| Bathroom | 4 | 6 | 9 |
| Kitchen | 9 | 14 | 20 |
| Living | 20 | 30 | 42 |
| Dining | 12 | 16 | 24 |
| Majlis | 16 | 24 | 36 |
| Office | 9 | 12 | 16 |
| Maid's room | 6 | 9 | 12 |
| Storage | 4 | 6 | 9 |
| Laundry | 4 | 6 | 9 |

### 4.3 Other numbers

| Item | Value |
|---|---|
| Stair allowance and block | 2.5 x 4.0 m = 10 m2 per plan level |
| Lift allowance and block | 1.5 x 2.0 m = 3 m2 per plan level |
| Parking space | 2.5 x 5.0 m = 12.5 m2 per car, side by side |
| Pool | S 3 x 6 m = 18 m2; M 4 x 8 m = 32 m2; L 5 x 10 m = 50 m2; needs 1 m clear all round |
| Plot grid | m mode: 1 m squares, snap 0.5 m. ft mode: 5 ft squares, snap 1 ft. Existing points are never re-snapped on unit change. When zoomed out so far that a square would be under 6 px, the drawn grid coarsens (5 m, 25 ft, ...) and the scale indicator states the size actually drawn; the snap step never changes |
| Plan editing snap | 0.5 m (m mode), 1 ft (ft mode) |
| Plot limits | 3–12 vertices; fits inside 100 x 100 m; area at least 50 m2 |
| Minimum buildable area | 20 m2 |
| Footprint proportions (3.1) | bounding-box proportions limited to **2:1**; only when that footprint is clamped: its long side stretched up to **3:1**, and 3:1 tried in both orientations (CD-1). After rounding: long side at most 2 × (short side + 0.5 m) for 2:1-limited footprints, at most 3 × short side + 0.5 m for stretched / 3:1 footprints (A-6 step 8, CTO correction at the F2 review). After these tries a footprint is not clamped when its long side = target / short side rounded down to 0.5 m |
| Edge-class overrides (3.1, F2-S4) | any non-street edge, back <-> side; at most one override per edge (so at most 11 on a 12-vertex plot); street edge never; cleared on any outline change, on reopening the shape, or on a Q6 change |
| Room limits | minimum side 1.5 m; generated rooms within 25 % of requested area and no longer than 3 times their width |
| Levels | 1–3 floors, optional basement, optional usable roof; at most 10 rooms per plan level (CD-4; maximum house: 4 plan levels, 40 rooms) |

### 4.4 Interaction numbers fixed during implementation
Set by the Tech Lead (architecture A-6, A-8, A-15) and listed here so QA and reviewers have one place to look. They are tuning values, not product rules; a change is made in the code constants and in this table together.

| Item | Value |
|---|---|
| Tap | pointer released within 8 px and 700 ms of pressing; anything longer or further is a drag or a hold and places nothing |
| Handle hit radius | 22 px on touch and pen (44 px target), 10 px with a mouse |
| Closing a shape by tapping the first corner | within 22 px of it on screen, at any zoom |
| Smallest drawn grid square | 6 px (below that the grid coarsens, see 4.3); the fitted sample on a 360 px phone reads "1 square = 1 m" |
| Zoom range (2D) | from the whole 100 x 100 m area in view to 80 px per metre |
| Draft autosave | 400 ms after the last change, and at once when the page is hidden |
| Toast | 3.5 s, at most two at a time |
| Parking entrance strip | 2 m wide, on the building's centre line from the front wall to the street, kept free of cars where possible (sample: cars at 11–16 m across, 0.5–5.5 m from the street) |
| Adjacency (Q13) counts as met | shared wall of at least 0.5 m |
| Plan editor | a dragged edge snaps to a neighbouring edge within 0.3 m before it snaps to the grid |
| Generator retry after no layout | cell scale 0.75–1.25 (first pass 0.8–1.2), only when the first pass finds no layout |

## 5. Features and stories

### F1 — Plot drawing and app shell

Draw the land as a polygon with live measurements; includes the stage navigation, responsive frame, draft autosave and the sample project.

**F1-S1 Draw the plot outline.** As an architect, I want to outline my land on a top-down grid so that the tool knows the plot shape and size.
- Given the Plot stage, when I tap/click the grid, then a vertex is placed, snapped per 4.3; consecutive vertices are joined by edges.
- When I tap the first vertex (or press "Close shape") with >= 3 vertices, the polygon closes and is filled.
- "Close shape" is disabled, with a hint, while there are fewer than 3 vertices.
- A vertex placed on top of the previous one (zero-length edge) is ignored.
- A vertex whose new edge would cross an existing edge is **rejected** (not placed) with an inline message; closing is likewise refused if the closing edge would cross another edge. A self-intersecting plot can therefore never exist.
- A 13th vertex is refused with an inline message; points outside the 100 x 100 m area cannot be placed.
- "Undo last point" and "Clear" exist; Clear asks for in-page confirmation when a closed plot exists. Undo on a closed shape reopens it.
- A "Fit view" control (44 px) brings the whole plot back into view after zooming or panning, without placing a point.
- A closed plot smaller than 50 m2 shows a blocking "plot too small" message (Next disabled).
- Touch: one-finger tap places a point; two-finger pinch/drag zooms/pans the grid without placing points; a drag is not treated as a tap.
- Desktop: wheel zooms; drag on empty space pans.

**F1-S2 See and trust measurements.** As an architect, I want edge lengths and total area in my unit so that I can check the outline against the real land.
- Each edge shows its length while drawing (including the live edge to the pointer on desktop) and after closing; the closed plot shows area and perimeter. An edge next to the canvas border keeps its label (placed on the inner side or along the edge).
- A unit toggle (m / ft) is on the Plot stage; it is the same setting as Q1 (R4). Switching converts every label at once: a 20 x 30 m rectangle reads 20.0 m, 30.0 m, 600 m2 and then 65.6 ft, 98.4 ft, 6458 sq ft, and its vertices do not move.
- The grid shows a scale indicator (what one square equals) that stays correct when zooming and changes with the unit (1 m / 5 ft).
- Labels stay legible at 360 px (short-edge labels may hide until zoomed in rather than pile up).

**F1-S3 Adjust the outline.** As an architect, I want to move vertices after closing so that I can correct mistakes without redrawing.
- Dragging a vertex (mouse or one finger) moves it with snap; lengths and area update live.
- A drag that would create a self-intersection is refused (vertex returns to its last valid position) with an inline message.
- Vertex handles have a >= 44 px hit area on touch.
- If floor plans exist, releasing a moved vertex follows R5 (confirmation only when a level with edits or an approval would be reset; Cancel returns the vertex).
- If the Q6 street edge no longer exists after an edit (plot cleared and redrawn), Q6 returns to its default.

**F1-S4 Move between stages.** As an architect, I want a clear step indicator so that I always know where I am and can go back without losing work.
- A stepper shows the 5 stages with states: current, done, locked. A fourth, unmarked state exists: a stage that is reachable but has not been opened yet in this session is plain "available" (no tick, no lock); "done" means opened and valid. Locked stages are not activatable and say why when tapped (e.g. "Approve all floors first").
- Back/Next controls are always visible without scrolling at 360x640; Next is disabled until the current stage is valid.
- Going back and forward without changing anything loses nothing (plot, answers, room positions, approvals).
- At 360 px the stepper fits on one line (numbers/short labels allowed).

**F1-S5 Draft autosave and sample project.** As an architect (or reviewer on a phone), I want my draft kept and a one-tap sample so that I can resume or reach the 3D view quickly.
- The draft (plot, answers, layouts, approvals, current stage) is saved automatically after changes; on reload the app offers "Resume draft" / "Start new" in-page.
- With `localStorage` blocked or throwing, the app starts normally, works fully for the session, and shows no error (at most a discreet "drafts not saved on this device" note).
- A corrupted/old-format saved draft is discarded silently and the app starts clean.
- "Start new" clears the draft after in-page confirmation.
- "Load sample project" is on the first screen (section 6.2). One tap fills the plot and all answers with all levels generated. Loading the sample over an existing draft asks for confirmation.
- "Skip to 3D" is offered only while the sample is loaded and unmodified; it approves all levels and opens the 3D view. This is the single, intentional exception to G3; it disappears as soon as the user changes anything **other than the unit (Q1)**. Switching m / ft is display only (R4) and keeps the sample unmodified (round 3 decision; until F2-T2 lands, the build removes the offer on a unit change too).

### F2 — Site and building questionnaire (Q1–Q17)

**F2-S1 Answer the saved questions.** As an architect, I want to answer the approved questions in clear groups so that the tool has the site and building requirements.
- Q1–Q17 are presented in the four brief groups (Plot and site, Building, Rooms, Outdoor), in order, with question text matching the brief. Q18–Q19 do **not** appear here.
- Every question starts at its default from 4.1; a progress indication shows the group and how many remain.
- Inputs suit a phone: steppers/segmented choices/sliders rather than free text where possible; numeric fields open a numeric keypad; values with units show the current unit and convert on unit change (R4).
- Q5 (north) and Q6 (street edge) are answered by pointing at a plot preview (rotate a compass; tap an edge), not by typing. The preview labels each edge front / back / side with the class **in effect** (3.1, automatic or overridden; overridden edges are visibly marked, F2-S4) and draws the buildable area and footprint, updating live with Q2, Q3, Q6 and edge-class overrides. The street edge and every overridden edge are always labelled; another edge too short to carry a label at the current scale may be unlabelled (round 5), since the F2-S4 edge list states every edge's class as text.
- Q9: Pitched is disabled while usable roof (Q7) is on; switching usable roof on while Pitched is selected changes it to Flat with an inline note (3.3).
- Q17 gate position is Left / Centre / Right along the street edge.
- Answers persist when moving between groups and stages.

**F2-S2 Define rooms.** As an architect, I want to list the rooms per floor with sizes and adjacencies so that plans can be generated from my programme.
- I can add, edit and remove rooms; each has a type (the 10 brief types), a level (only plan levels that exist under Q7), and a size: S/M/L or an exact area (4–80 m2, entered in the current unit). S/M/L shows the area it stands for (4.2) in the current unit.
- "Count" adds several rooms of one type at once; rooms are auto-named (Bedroom 1, Bedroom 2 …) and one bedroom can be marked master. A 9th room on a level is refused with an inline message.
- Q13: I can add must-be-adjacent pairs by picking two rooms. A pair across different levels or a room paired with itself cannot be created; duplicates are ignored. Deleting a room removes its pairs.
- Q14: stair position is one of exactly five options — Centre (default), Front-left, Front-right, Back-left, Back-right — and lift yes/no. Both are shown only when stairs exist (3.2); otherwise the question shows "single level: no staircase needed".
- Removing a floor or the basement when rooms exist on it asks (in-page) to move those rooms to the nearest remaining level or delete them; Cancel keeps the level. Once plans exist, "Move" also regenerates the receiving level's plan (its rooms change, R5) while "Delete" loses only the removed level's; the dialog's plans sentence names the levels with edits or an approval that the option currently chosen would reset, and is absent when there are none (round 5).

**F2-S3 Catch conflicts before generating.** As an architect, I want to be told about answers that cannot work together so that I do not get a broken plan.
- A live summary shows: plot area, buildable area, effective footprint area and %, effective vegetation area and %, and per plan level "needed / available", where needed = room areas + stair allowance + lift allowance and available = effective footprint area. A level with no rooms shows "–" instead of a needed figure (its "has no rooms" block explains it; round 5).
- **Blocking** (Next disabled; message names the question and the fix):
  - an above-ground floor with no rooms, or an enabled basement with no rooms;
  - buildable area below 20 m2;
  - footprint % + vegetation % > 100;
  - needed > available on any level; the message shows both numbers, e.g. "Ground floor: needs 160 m2, 143 m2 available";
  - a numeric answer empty, non-numeric, negative or outside its range in 4.1.
- **Warning** (can continue; shown inline and again on the Floor plans stage):
  - footprint had to be shrunk to fit the buildable area (3.1): effective area and % are shown. Two wordings (round 4, CD-1), chosen by the reason:
    - **proportion limit** — used when the final footprint is at the 3:1 limit (long side at least 3 x short side minus one 0.5 m rounding step) **and** a footprint of the same width and centre but longer (by 0.5 m) would still lie in the buildable area. Text: "The building is limited to {w} × {d} ({a}, {p} % of the plot): on this narrow plot it may be at most 3 times as long as it is wide. Smaller setbacks along its long sides would allow a larger building." It names the 3:1 limit, never suggests raising the footprint %, and its dimensions, area and % follow the unit (R4). Example: the 10 x 50 m plot of 3.1 reads "6.0 × 18.0 m (108 m2, 21.6 % ...)".
    - **setbacks** — every other clamp; today's text is kept: "The building was reduced to fit inside the setbacks: {a} ({p} % of the plot)." Example: the 20 x 30 m plot at 80 % of 3.1.
    - Exactly one of the two is shown for a clamped footprint; neither for an unclamped one. A footprint stretched to its target, short only by the 0.5 m rounding (3.1 "Clamped after the stretch"), is not clamped: 10 x 50 m at 20 % (6 x 16.5 m = 99 m2) shows no warning; at 24 % (6 x 18.5 m = 111 m2) it shows the proportion wording.
  - footprint + vegetation + parking + pool areas exceed the plot area: vegetation is reduced to what fits and the effective % is shown;
  - the yard holds less than 80 % of the effective vegetation area once building, parking, pool, seating and paths are excluded (round 11): "Only {a} ({p} % of the plot) of planting fits around the building, parking and pool: the 3D garden is smaller than the {q} % asked. Try a lower footprint %, fewer cars or a smaller pool.";
  - parking does not fit between the building and the street edge, or the pool (with its 1 m clearance) does not fit in the back or side open area: the item is left out of the 3D scene and the user is told which, with a fix hint (round 5, final wording): parking — "Try fewer cars, a lower footprint % or a larger front setback (it moves the building back from the street)."; pool — "Try a smaller pool, a lower footprint % or a larger back setback (it moves the building toward the street)." Reason: the building is centred between its setbacks, so a *larger* front (back) setback moves it away from the street (back boundary) and deepens the front (back) yard where parking (the pool) goes first, while a smaller one, or smaller side setbacks (a wider building, narrower side yards), can make things worse. Checked on the sample core: 4 cars at 45 % fit with front 3 m and 6 m but are omitted with front 1 m; pool L at 40 % is omitted with back 2, 3, 4 m and fits with back 5 m or at 25 %. "Try" because one step may not be enough.
  - garden seating (Q17) does not fit in the yard (round 10): "Garden seating does not fit in the yard: it is left out of the 3D scene. Try a lower footprint %, fewer cars or a smaller pool."
- Q17: the Gate position control is disabled while Boundary wall is off; its value is kept (round 10).
- Every blocking condition clears as soon as the answer is fixed, without reloading.

**F2-S4 Correct an edge's class (back / side).** (Round 4, client decision CD-2.) As an architect, I want to say which boundaries are back and which are sides when the automatic 40-degree rule gets it wrong, so that the right setback applies to each edge.
- *Where and how:* in the stage-2 site preview, every non-street edge can be switched between back and side. Because tapping an edge also sets Q6, a tap must never be ambiguous: the preview has an explicit, visible choice of what an edge tap does ("set street edge" / "switch back / side"; wording and control are the Designer's), and the current choice is always shown. Default is "set street edge", so Q6 behaves exactly as today until the architect picks the other.
- *Tap:* in "switch back / side", tapping a non-street edge (same hit rules as Q6: nearest edge within 22 px on touch and pen, 10 px with a mouse) switches it back <-> side at once; tapping it again switches it back. Tapping the street edge changes nothing and shows an in-page hint (a toast, round 5) "The street edge is always front (change it with Q6)". A tap far from any edge does nothing.
- *Keyboard and no-pointer alternative:* every non-street edge can be reached with Tab / arrow keys (or a per-edge control list) and switched with Enter or Space; the focused edge is highlighted in the drawing and its number, length and class are readable as text (accessible name). The alternative works without the canvas at all.
- *Phone:* at 360x640 portrait and 640x360 landscape, touch only, every non-street edge of the sample (including the 8.9 m angled edge) and of a 12-vertex plot can be switched, through the tap or through the alternative, with targets of 44 px or more; switching never scrolls or zooms the page.
- *Labels:* each edge label shows the class in effect; an overridden edge is visibly marked as set by the user (e.g. "side*" with the legend explaining the mark; the mark is the Designer's call), automatic edges are unmarked. Switching an overridden edge back to its automatic class removes the mark.
- *Live effect:* the setback zone, buildable area, footprint (size and position), summary figures, parking / pool placement and every F2-S3 conflict update immediately, as for a Q2 change. Test: sample with setbacks back 5 / sides 1 — switching the angled edge from back to side shrinks the setback along it from 5 m to 1 m and the summary changes accordingly; switching it back restores the previous figures exactly.
- *R5:* an override goes through the gate like Q2 (R5 "Edge-class overrides"). Sample with seeded valid plans and default setbacks (back = sides = 2 m): switching any edge changes no footprint size, so nothing resets and nothing is asked. With back 5 / sides 1, a switch that changes the footprint's width or depth asks once, naming the levels; Cancel restores the edge's previous class and label; Continue applies.
- *Draft:* overrides are saved in the draft and restored exactly by "Resume draft" (labels, setbacks, footprint). A draft saved before this story (no overrides) still resumes, with every edge automatic.
- *Cleared (3.1 rule):* moving any vertex to a different position, changing the vertex count (Undo, Clear, redraw) or changing Q6 clears all overrides; if at least one override existed, the user is told once in-page ("Back / side choices were reset because the outline changed" or "... because the street edge changed"). Reopening the closed shape (Undo) also clears them, with the same "outline changed" notice, even if the identical outline is re-closed. Clearing is judged together with the change that caused it (one R5 dialog at most).
- *Sample:* the sample loads with no overrides; making one is a real change and removes "Skip to 3D" (F1-S5).
- *Units:* overrides are unit-independent; switching m / ft keeps them and only converts the displayed setbacks.

### F3 — Floor plans: generate, edit, approve; then interior questions (Q18–Q19)

**F3-S1 Get an automatic plan per floor.** As an architect, I want a 2D layout generated for each floor so that I start from a proposal, not a blank page.
- Entering stage 3 with valid answers shows one tab per plan level (Basement, Ground, First, Second as applicable; never the roof); the plot outline, setback line and footprint are drawn for reference.
- For every level: every room requested for it appears exactly once, labelled with name and area; rooms are rectangles fully inside the footprint; no two rooms overlap each other or the stair/lift block.
- When stairs exist, the stair block (and lift if chosen) is at the same position on every level, in the part of the footprint named by Q14.
- Each generated room's area is within 25 % of the requested area, no side is under 1.5 m, and no room is longer than 3 times its width. Footprint not used by rooms or stairs is shown as hall/circulation, not left blank.
- Each must-be-adjacent pair shares a wall segment where possible; any pair that could not be satisfied is listed as a warning on that level ("Kitchen and Dining are not next to each other. Drag one against the other to join them.", round 8).
- **Hall access (CD-5, round 10):** each room with no way in (rule in the round-10 table: 0.8 m onto hall or stair / lift, or reached through a pair partner, an en-suite host or a storage / laundry host) is named in a non-blocking warning on that level: "The Bathroom has no way in from the hall or stairs. Move or resize a neighbouring room to open one." It is re-checked after every edit. The sample shows none.
- Low fill (round 8): under 50 % fill a non-blocking hint "Rooms fill only 48 % of the Ground floor. Add rooms, choose larger sizes, or lower the footprint % (Q3)."
- Generation never fails silently: if a level cannot be laid out it shows a message with a link back to the room list.
- Generation is deterministic: the same inputs give the same layout.
- The criteria above hold on footprints of every proportion the site model can produce, **up to 3:1** (CD-1): the generator's seeded test sweep includes stretched footprints, at least the 6 x 18 m and 15 x 5 m examples of 3.1 with the default room list and with a full 8-room level that fits by area, and (CD-4) a seeded set of 9- and 10-room levels.
- "Regenerate this floor" re-creates the layout (in-page confirmation only if the level is edited or approved, naming which, round 6 texts; an untouched Draft regenerates at once) and clears that level's approval only.

**F3-S2 Edit the plan.** As an architect, I want to drag and resize rooms so that the layout matches my intent.
- I can drag a room and resize it by its edges with snap (4.3; corner handles are not required, round 6); its dimensions and area update live in the current unit.
- A room cannot be moved or resized outside the footprint (it stops at the footprint edge) and cannot go below 1.5 m per side.
- Overlap is **allowed while dragging**; on release, rooms that overlap another room or the stair/lift block are highlighted as invalid with a message, and the level cannot be approved until fixed.
- The stair and lift blocks are fixed: they cannot be dragged or resized (their position is changed through Q14).
- A broken must-be-adjacent pair or a room left with no hall access after editing shows a warning (does not block approval).
- One-step "Undo last edit" (44 px, round 8): restores the shown floor's plan as before the last move or resize, approval state included; gone after a new edit, Regenerate, an R5 reset, an approve / un-approve, a switch to another floor tab or leaving stage 3. Messages: "Last edit undone." / "Last edit undone. Ground floor approved again." (round 10).
- Editing one level never changes another level.
- Touch: one finger drags the selected room/handle; handles have >= 44 px hit areas; two fingers pan/zoom the plan; the page does not scroll while dragging. Works at 360 px.

**F3-S3 Approve each floor.** As an architect, I want to approve floors one by one so that nothing is built in 3D that I have not signed off.
- Each plan level has an "Approve floor" control and a visible state (Draft / Approved) on its tab; a counter shows "n of m floors approved", where m = number of plan levels (the roof is never counted).
- Approval is refused, with the reason, while the level has any overlap (texts in the round 6 table: names the overlapping rooms or the stairs / lift for a single overlap, the count for several).
- Editing an approved level returns it to Draft (the user is told once: "Ground floor is back to Draft. Approve it again when you are done.").
- Tapping "Approved" returns the level to Draft without a dialog (nothing is lost); "Ground floor is back to Draft." is shown and the counter, tab and Next update (round 6).
- Next (to Interior) is disabled until all plan levels are approved. R5 applies to upstream changes.

**F3-S4 Choose the interior.** As an architect, I want the interior questions asked only once the plans are fixed so that I decide the look after the layout.
- Stage 4 is locked until every plan level is approved; it asks exactly Q18 (modern / classic / minimal) and Q19 (sparse / full), with the defaults from 4.1 and a small visual hint of the difference. Each Q18 card names its furniture colours, never the walls (round 7): Modern "Graphite, dark wood, copper", Classic "Cream fabric, walnut, brass", Minimal "Pale grey, light oak, sage".
- A single "Build 3D model" action opens stage 5.
- Returning from 3D to change Q18/Q19 and rebuilding keeps approvals and updates the furniture.

### F4 — 3D dollhouse, vegetation, free camera, time of day and seasons

**F4-S1 See the house on the plot.** As an architect, I want a block-style dollhouse of the approved plans on my plot so that I and my client can read the design at a glance.
- The 3D view shows the plot at the drawn shape, the building at the footprint position (3.1), and one storey per plan level at the Q8 height; rooms match the approved plans in position and size.
- Dollhouse: no ceilings, and walls are cut away/lowered so room interiors are visible from above. A level selector (All / each plan level, labelled "All / Basement / Ground / First / Second" with the full floor names for screen readers, round 9) hides everything above the chosen level. **The view opens on "All" with the roof off, so the top floor's interiors are visible immediately.**
- A "Roof" toggle (default off) shows the Q9 roof per 3.3 when the level selector is "All"; flat, pitched and terrace are visibly different, and a usable roof shows its stair head. With the roof on the house is shown closed: exterior walls run up to the roof, which never floats (round 10).
- Selecting Basement opens the ground inside the footprint so basement rooms are visible from above (3.2).
- Each room has a fixed set of block furniture for its type (e.g. bed in bedroom, counter in kitchen, sofa in living, table in dining, floor seating in majlis, desk in office, fixtures in bathroom, shelves in storage, machines in laundry). Q18 changes colours/finishes only; Q19 "sparse" shows visibly fewer pieces than "full". Furniture stays inside its room.
- Stairs (and lift if chosen) are visible; exterior colours follow Q10; rooms are distinguishable by type (floor tint and/or a label).
- Outdoor: vegetation covers roughly the effective vegetation % of the plot (up to the G6 cap of 120 trees and 200 shrubs, about 1 020 m², round 11) and never sits inside the building, parking or pool; parking spaces match Q15 (covered shows a canopy) and sit between the building and the street edge; the pool appears if Q16 is yes at its 4.3 size, behind or beside the building; boundary wall, gate (on the street edge at the Q17 position; only with the wall, round 10) and garden seating appear per Q17; the main entrance faces the street edge; a north marker reflects Q5. Items left out by an F2-S3 warning are absent.
- While the scene is being built a "Building…" state is shown; if 3D cannot start (WebGL or three.js unavailable) an in-page message explains it and the 2D stages remain usable.

**F4-S2 Look from any angle.** As an architect, I want free camera control so that I can inspect the model from anywhere.
- Mouse: drag orbits, wheel zooms, right-drag (or Shift+drag) pans. Touch: one finger orbits, two-finger pinch zooms, two-finger drag pans. Keyboard: arrow keys orbit, +/- zoom.
- The camera cannot go below ground level or flip over the top; zoom is clamped so the model can be neither lost nor entered through the ground; a "Reset view" control frames the whole plot from the street side (the view the 3D opens with; the yard behind the house is one drag away; round 11, `docs/03-tasks/F4-T3/camera-decision.md`).
- The 3D canvas fills the available space, keeps the correct aspect ratio on resize and orientation change, and does not scroll or zoom the page while being touched.
- Controls overlay the canvas without covering more than about a third of it at 360x640 (collapsible panel).
- Leaving stage 5 (or hiding the tab) stops rendering (no animation frames requested); returning resumes with the same camera position.
- Performance limits of G6 hold for the maximum house (mesh count, one shadow light, shadow map size, pixel ratio).

**F4-S3 Change time of day and season.** As an architect, I want to see the house at different times and seasons so that I can present its mood and shadows.
- A time-of-day control (continuous slider, 0–24 h, with quick presets morning / noon / evening / night) moves the sun: light direction, brightness, colour and sky change, shadows move, and night is clearly dark with a visible (dimly lit) model.
- The sun's path is oriented by Q5: rotating north by 90 degrees and rebuilding rotates the light direction by 90 degrees.
- A season control (spring / summer / autumn / winter) changes sky/light tone and vegetation: green in spring/summer, autumn colours in autumn, bare and/or snow in winter (ground also reads as wintry).
- Both controls update the scene immediately without rebuilding the house or moving the camera; they are labelled as illustrative ("approximate — not real solar data").
- The view opens at noon, summer.

### F5 — Room finder and drone tour

**F5-S1 Jump to a room.** As an architect, I want to pick a room from a dropdown so that the camera takes me straight to it.
- A dropdown in the 3D view lists every room grouped by level, using the names from the plans.
- Selecting a room flies the camera smoothly (about 1–2 s, no jump cut) to a view where that room is centred and its interior visible; the roof is switched off, levels above the room are hidden (for a basement room the ground is opened, 3.2), and the room is highlighted or labelled.
- Selecting another room during a flight redirects smoothly; any manual camera gesture cancels the flight and gives control back immediately.
- The dropdown is usable on a phone (>= 44 px target).

**F5-S2 Take the drone tour.** As an architect, I want an automatic drone-style flight through the house so that I can present it hands-free.
- "Start tour" switches the roof off and flies the camera along one continuous smooth curved path (no sharp turns or stop-and-snap) that begins with an exterior overview and then visits **every** room, level by level from the lowest (basement first if present) up, ending back at the overview.
- During the tour the current room's name is shown and levels above the current room are hidden so the room is visible; the camera never passes below ground level.
- Controls: Pause/Resume, Stop, and speed (slow / normal / fast). Stop, or any manual camera gesture, ends the tour and leaves the camera where it is under user control.
- Time of day and season can be changed during the tour without interrupting it.
- Works with a single room and with the maximum house (4 plan levels x 10 rooms, CD-4); a normal-speed tour of the sample project lasts 30–90 s.
- Leaving the 3D stage stops the tour; coming back does not auto-restart it.

## 6. Delivery

### 6.1 Suggested build order
1. **F1** shell first (stepper, responsive frame, draft, sample loader stub), then plot drawing. Everything else sits in this frame, so device rules (R2) are proven on day one.
2. **F2** questionnaire, the site model of section 3.1 (buildable area and footprint) and conflict checks. Fill the sample project's answers here.
3. **F3** generation, then editing, then approval + interior step. Highest product risk (auto-layout quality): keep the generator simple and predictable; the architect can fix things by hand.
4. **F4** house shell and camera first, then furniture and outdoor, then time/season. Highest technical risk (three.js cannot be run locally): keep to conservative, well-known APIs and look at the hosted page early.
5. **F5** room dropdown, then drone tour.

"Skip to 3D" for the sample (F1-S5) becomes fully live when F4 lands; until then it stops at the latest built stage.

### 6.2 Sample project ("Load sample project")
One tap on the first screen. It must pass every validation with **no warnings**, and it is the reference scene for hosted-page checks. Everything not listed is the 4.1 default.

**Answers**
- **Plot** (metres, street edge along the bottom): vertices (0,0), (20,0), (20,30), (8,30), (0,26). Edges 20.0, 30.0, 12.0, 8.9, 26.0 m; perimeter 96.9 m; area 600 − (8 x 4 / 2) = **584 m2**.
- **Site:** setbacks front 3 / back 2 / sides 2 m; footprint **25 %**; vegetation **25 %**; north default (toward the back); street edge = bottom edge (0,0)–(20,0).
- **Building:** 2 floors, no basement, no usable roof; 3.0 m; flat roof; Sand.
- **Ground (7 rooms):** Living L 42, Majlis M 24, Dining M 16, Kitchen M 14, Maid's room S 6, Bathroom S 4, Laundry S 4.
- **First (7 rooms):** Master bedroom L 24, Bedroom M 16, Bedroom M 16, Living (family) M 30, Office M 12, Bathroom M 6, Bathroom M 6.
- **Adjacency:** Kitchen + Dining; Master bedroom + Bathroom 1 (first floor). Stair Centre; no lift.
- **Outdoor:** 2 cars, covered; pool yes, S; boundary wall yes, gate Centre, garden seating yes.
- **Interior:** Modern, Full.

**Verification against sections 3 and 4**
- Edge classes: bottom = front; right (x = 20) and left (x = 0) = sides; top (y = 30) = back; angled edge points 26.6 degrees off straight back, inside the 40-degree limit = back. All automatic: the sample has no edge-class overrides (round 4).
- Round 4 re-check (CD-1, CD-2): unaffected. The 3:1 stretch runs only for a clamped footprint, and the sample's is not clamped: proportions 16:25 = 0.64 lie inside the 0.5–2 range, the rounded 9.5 x 15.0 m (ratio 1.58) fits at its centre at full size, so no shrink happens and the 2:1 result stands unchanged. No overrides, so every setback is as before. Footprint, levels, parking, pool and vegetation below are therefore identical, and no warning appears.
- Buildable area: x 2–18, y 3–28 (16 x 25 m = 400 m2) less the corner cut off by the angled edge's 2 m setback (about 10 m2) = **about 390 m2**; bounding box 16 x 25 m, centre (10, 15.5).
- Footprint: target 25 % x 584 = 146 m2; proportions 16:25 give 9.67 x 15.10 m, rounded down to **9.5 x 15.0 m = 142.5 m2 (24.4 %)**; centred: x 5.25–14.75, y 8–23. Lies fully inside the buildable area (nearest corner (5.25, 23) is well inside the angled setback line), so no clamp warning.
- Ground: rooms 42+24+16+14+6+4+4 = 110, + stair 10 = **120 of 142.5 m2 (84 %)**; hall 22.5 m2.
- First: rooms 24+16+16+30+12+6+6 = 110, + stair 10 = **120 of 142.5 m2 (84 %)**; hall 22.5 m2.
- Open space: front yard 8 m deep, back yard 7 m deep, side yards 5.25 m each.
- Parking: 2 x 12.5 = 25 m2 (5 x 5 m) fits the 8 m front yard. Pool S 3 x 6 m with clearance needs 5 x 8 m, fits the 7 m back yard (14.75 − 5.25 = 9.5 m wide behind the house, 20 m wide overall).
- Area budget: footprint 142.5 + vegetation 146 + parking 25 + pool 18 = 331.5 m2 <= 584 m2; footprint % + vegetation % = 50 <= 100. No conflict, no warning.

**Reviewer path on a phone:** Load sample -> Skip to 3D -> (3D opens at noon, summer, "All" levels, roof off, overview) -> Start tour. At most 6 taps. The user can also step back from the sample into any stage and edit it like a normal project (which removes "Skip to 3D").

## 7. Traceability (question -> where asked -> where it shows)

| Q | Asked in | Visible effect |
|---|----------|----------------|
| 1 unit | F1-S2 / F2-S1 | all measurements (R4) |
| 2 setbacks | F2-S1 | buildable area, footprint fit (3.1, F2-S3, F3-S1) |
| 3 footprint % | F2-S1 | footprint size (F3-S1, F4-S1) |
| 4 vegetation % | F2-S1 | vegetation cover (F4-S1) |
| 5 north | F2-S1 | sun path/shadows, north marker (F4-S1, F4-S3) |
| 6 street edge | F2-S1 | front setback, footprint alignment, entrance, parking, gate (3.1, F4-S1) |
| (round 4) edge-class override | F2-S4 | edge labels, setback per edge, buildable area, footprint (3.1, F2-S3) |
| 7 floors, basement, roof | F2-S1 | plan levels, stairs, 3D levels, usable roof (3.2, F3-S1, F4-S1) |
| 8 ceiling height | F2-S1 | storey height (F4-S1) |
| 9 roof type | F2-S1 | roof shape with Roof toggle on (3.3, F4-S1) |
| 10 exterior style | F2-S1 | exterior colours (F4-S1) |
| 11 room list | F2-S2 | rooms in plans, 3D, dropdown, tour |
| 12 room size | F2-S2 | room areas (F3-S1) |
| 13 adjacency | F2-S2 | layout + warnings (F3-S1, F3-S2) |
| 14 stairs, lift | F2-S2 | stair/lift block in plans and 3D |
| 15 parking | F2-S1 | parking spaces, canopy (F4-S1) |
| 16 pool | F2-S1 | pool (F4-S1) |
| 17 extras | F2-S1 | wall, gate, seating (F4-S1) |
| 18 interior style | F3-S4 | furniture/finish colours (F4-S1) |
| 19 furniture density | F3-S4 | number of furniture pieces (F4-S1) |

## 8. Notes for CTO / Tech Lead
- Numbers live in section 4 and in the G6 row. The TL may propose different values; change them there, in one place, and re-run the 6.2 arithmetic if a change touches the sample.
- Two details were added beyond the CTO's footprint recommendation because the rule was not complete without them: the footprint's proportions (follow the buildable bounding box, 2:1 at most; 3:1 when clamped since round 4, CD-1) and rounding to 0.5 m in metres regardless of display unit (so the unit toggle can never change geometry). The back/side threshold is 40 degrees rather than 45 so that a 45-degree chamfer is unambiguously a side.
- Exactly how the footprint is shrunk to fit, how parking/pool/vegetation are positioned inside the yards, and how the generator meets F3-S1 are the TL's call, provided the stated criteria hold and the sample shows no warnings.
- Round 4 (client decisions) — questions for the Tech Lead, product intent stated above, solution is the TL's:
  1. CD-1: is trying exactly 3:1 enough, or should intermediate proportions (2:1 to 3:1) be searched? Product requirement: the result is at least as large as both the 2:1-limited and the 3:1 tries, never above target. For concave plots whose bounding box is near-square, may the stretch be tried in both directions (like the 1:2 / 2:1 fallback)? PM has no objection.
     - **TL answer (2026-11-20):** exactly 3:1 is not enough (buildable 6 x 15 m: 2:1 gives 72 m², 3:1 gives 75 m², but 6 x 15 m = 90 m² fits). Two extra candidates, only for a clamped footprint: (a) **stretch** — when the 2:1-limited result is at its proportion limit (long side at least 2 x short side minus one 0.5 m step), keep its short side and centre and lengthen the long side in 0.5 m steps up to min(3 x short side, target / short side) while it fits; (b) the full search (centred try + fallback) for **3:1 and 1:3**, both directions as you allow. Largest final area wins; ties keep the 2:1-limited result. Your three examples hold (108, 75, and 392 m² because the 16 x 24.5 m result is not at its 2:1 limit). Bound: `analyse` stays under 500 ms on the worst 100 x 100 m concave plot. A-6 step 4b.
  2. CD-1: the exact test for "proportion limit is the reason" (F2-S3): PM definition is "at 3:1 and 0.5 m longer still fits at the same centre"; propose a cheaper equivalent if needed. Does the stretch change any QA F2-T1 expected values on concave plots (it should only enlarge clamped ones)?
     - **TL answer:** your definition is already cheap (one exact rectangle test) and is adopted as written: long side >= 3 x short side minus 0.5 m, and the same short side and centre with the long side 0.5 m longer (0.25 m each end) still fits. Yes, the stretch changes QA's F2-T1 expectations, but only for clamped footprints whose proportion limit binds (they get larger, up to 3:1 plus one rounding step); unclamped results and the 6.2 sample are byte-identical. QA updates its reference model `tests/qa/f2-t1-ref.mjs` to the round-4 rule in the F2-T3 QA round.
  3. CD-2: Q6 and the override share the edge tap. PM requires an explicit visible mode; confirm with the Designer, or propose a better unambiguous gesture.
     - **TL answer:** explicit visible mode confirmed, no gesture tricks (a long press would fight the 700 ms tap limit and is undiscoverable). Designer adds a two-segment control "Tap an edge: Street | Back / side" at the top left of the preview canvas (default Street), plus a collapsible per-edge list in the Q6 block that is the keyboard and no-canvas alternative. Spec in `docs/02-features/F2-plan.md` (F2-T3, Designer pre-step).
  4. CD-2: clearing rule. PM chose "any vertex position or vertex count change, or a Q6 change; identical re-close keeps them". If keeping overrides across a reopen is costly, propose clearing on reopen too and say so here.
     - **TL answer:** I take your offer: **clear on reopen too**. Reason, not cost: reopening already resets Q6 to null and re-closing stores the default street edge (F1 rule, A-4), so "identical re-close keeps them" would hold only when Q6 was at its default — a rule nobody could predict. Clearing on reopen gives one simple invariant (overrides exist only on a closed plot) and the same notice "…because the outline changed". Please change the reopen sentence in 3.1 and F2-S4.
  5. CD-2: draft schema bump: PM asks that v1 drafts migrate (no overrides) rather than being discarded (F2-S4 "Draft"); confirm or explain the cost.
     - **TL answer:** confirmed: `PC.DRAFT_V` becomes 2; `PC.draft.parse` accepts v1 and migrates it (adds `ans.edgeOv = {}`, sets `v: 2`, then validates strictly as v2); the storage adapter reads key `plotcraft.draft.v2`, falling back to `…v1`, and after the first v2 save removes the v1 key. About 20 lines plus tests; worth it. A-4.
  6. CD-2: which task carries F2-S4 (F2-T2 fix round, F2-T3, or a new task within the 3-per-feature limit) and where the 3:1 change lands (A-6, `site-footprint.js`); F3-T1's sweep must include 3:1 footprints.
     - **TL answer:** both go into **F2-T3**, renamed "Rooms, edge-class overrides and narrow-plot footprints" (the feature already has three tasks; nothing goes into the running F2-T2 fix round). One plan, implemented and reviewed in two increments: (1) core + site UI: 3:1 in `site-footprint.js` and the F2-S3 wording in `validate.js`, overrides in state / site model / draft v2 / clearing in the plot and Q6 mutators, the tap mode and edge list; (2) the rooms work as already planned. QA tests the whole task once. F3-T1's sweep includes 3:1 footprints (F3-plan; my spike check: footprints between 2:1 and 3:1 give 0.6 % no-layout at 85 % fill or less, 0 invalid; 6 x 18 / 18 x 6 / 15 x 5 / 5 x 15 m lay out the default room lists).
- Because real three.js cannot run in the workspace, F4/F5 visual criteria (colours, smoothness, shadows) can only be fully confirmed on the hosted page; QA verifies logic and API usage against the mock, and the PM/CTO feature review should include a look at the published page.
