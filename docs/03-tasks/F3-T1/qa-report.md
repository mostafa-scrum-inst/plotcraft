# F3-T1 QA report — QA Tester

## Round 1 — 2026-11-21

Scope: F3-T1, tested against the Tech Lead's 6-item "For QA (F3-T1 focus)" list (end of `impl-review.md`, Round 2), story F3-S1, R5 with the PM's round-5 decision, A-7, A-8 and A-15.
- the corrected footprint cap;
- the floor-plan generator (`PC.layout`);
- the plan sync (`PC.plans`);
- stage 3: tabs, readouts, the no-layout banner, Regenerate, Fit view;
- R5 through `PC.store.atRisk`;
- the parking / pool fix hints and "–".

### What I tested and how
- **`tests/qa/f3-t1-plans.mjs`** (node, about 25 s) is an **independent oracle** for the generator, written from A-8 and F3-S1. It does not use `PC.layout.check`. It checks:
  - every requested room exactly once;
  - every room inside the footprint;
  - no overlap with other rooms, the stair or the lift (0.011 m tolerance);
  - sides of 1.5 m or more, aspect 3 or less, area within 25 %;
  - the stair / lift block where A-8 puts it. The stair is 4.0 m along the longer axis, and the lift sits beside it across the band. The block is centred and snapped down to 0.5 m, or flush in the named corner, with Q14 left = low x and front = low y.
  - the unmet pairs equal my own A-8 adjacency (touching within 0.02 m along 0.5 m or more);
  - the 0.5 m snap is kept exactly when the snapped layout is still valid and loses no shared wall (both directions checked);
  - the generator is deterministic.

  On top of the oracle:
  - **My own exhaustive search** over A-8's cells: rooms assigned to cells, columns in either direction, each room's area free within 25 %. It judges every no-layout result.
  - **2 000 seeded programmes:** 1–8 rooms, 0–6 pairs, all 5 stair positions, lift, fill 30–100 %.
  - The 6.2 sample; a maximum level (8 rooms) at every stair position, with and without lift.
  - 120 programmes on footprints up to 3:1 plus one step, both directions (6 x 18.5, 4 x 12.5, 15 x 5, 2.5 x 8, …).
  - Sync and the R5 risk set on states.
  - `go(3)` on the maximum house.
- **`tests/qa/f3-t1-stage3.mjs`** (browser, about 22 s): the sample at 360x640, 640x360, 768x1024 and 1280x800 (touch, mouse at 1280).
  - Every stage-3 element is compared with the state and my expectations: tab names and order, state words, selected tab, counter, Approve and its reason.
  - Every drawn label must lie inside its room and be that room's name, a short form of it, or its area in the current unit (or "Stairs" / "Lift" in the core).
  - Unmet-pair warnings; tapping every room shows my name, size and area, in m and ft.
  - Fit view after pan / zoom; scale with the sample strip.
  - The no-layout banner: size, link, focus target.
  - The maximum house with four tabs; R5 and sync as the user meets them; Regenerate; Resume.
- **Runner:** `tests/qa/run-f3-t1.mjs` runs both suites (about 45 s).
- **The cap (item 1)** is covered by `tests/qa/f2-t1-site.mjs` (round-4 branch, both F3-T1 markers live):
  - pentagon 21.5 x 7 m (check 3c);
  - CTO case 2.5 x 8 m (3d);
  - the six PM / CTO / TL examples in m and ft, with wording (3b), including the `setbacks` reason (20 x 30 m at 80 %, 10 x 20 m);
  - the sample (section 1);
  - every lattice case against my model, with the cap checked per candidate kind.
- **Mutation checks**, each on a throwaway copy, all caught:
  - Q14 corner mirrored;
  - the 0.5 m snap never applied;
  - the snap applied without its check (caught first at programme 1 263, so the sweep is 2 000);
  - unmet pairs reported empty;
  - sync keeping stale plans;
  - `atRisk` counting untouched Drafts;
  - short room labels wrong;
  - the size readout swapped.
- **Phone screenshots** in `tests/qa/shots/F3-T1/`, looked at:
  - sample, both tabs, in m and ft, at 360x640 and 640x360;
  - with the sample strip;
  - the 4-level house: Basement, Second floor, ft;
  - the no-layout level.
- **Full run `node tests/run-all.mjs`: exit 0 in 523.7 s.**
  - lint: 0 violations;
  - unit: 301/0 (19.7 s);
  - e2e: contract 4, fit-button 42, plan-banner 35, plan-tabs 356, plans-view 295, edges 501, plot 512, rooms-fit 490, questions 932, rooms 361, site-legend 120, site-tapmode 195, start-card 14, summary-fit 456, shell 593, all with 0 failed;
  - QA: F1-T1 179 + 2015, F1-T2 828, F2-T1 1140, F1-T3 1022, F2-T2 959, F2-T3 1136, F3-T1 11 + 201, all with 0 failed.

### Results per focus item
| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Cap | PASS | The app and my model agree: pentagon 21.5 x 7 m (proportion), 2.5 x 8.5 → 2.5 x 8 m, every PM / CTO example and the sample unchanged; per-kind cap checked on 632 generated cases. |
| 2 | Generator (own oracle) | PASS | **2 000 programmes, every layout valid by my oracle.** Unmet pairs equal my adjacency in every case. Snap kept exactly when valid (1 911 of the layouts are on the 0.5 m grid). Deterministic (200 re-runs). The core is where A-8 puts it at all 5 positions and on all 4 levels of the maximum house.<br>Sample Ground and First: valid, **zero unmet pairs**. Maximum level (8 rooms, 12.5 x 20 m): laid out at all 5 positions, with and without lift. 3:1 footprints: 120 programmes, all valid; 16 no-layout, and my search finds none of those either. Slowest generation 238 ms.<br>**No-layout rates:** 2.1 % at fill ≤ 85 % (38 of 1 827), 27.7 % above (48 of 173). My search, which lets each room vary within 25 % on its own, finds a layout for 20 of the 86 no-layout cases (23 %); with the generator's own 0.8–1.2 range, only 2. By A-8 this is a heuristic's limit, not a rule break (see observation 3). |
| 3 | Sync and R5 | PASS | Load sample, Skip and Resume give plans. Entering stage 3 regenerates exactly the stale levels.<br>• A First-floor room change: First only (Ground keeps approval and edits);<br>• Q3 / Q6 / stair position / lift: all levels;<br>• move-only setback and Q10: none;<br>• a removed level loses its plan; an open plot leaves plans alone.<br>R5: untouched sample Drafts never ask (Q3 change after Load sample); Skip-approved plans ask, naming both levels. With only Ground approved, a First-floor room change asks nothing, and the Q7 removal sentence names only the Ground floor. `atRisk` checked in node too. |
| 4 | Stage 3 UI | PASS | At 4 viewports: tabs in Q7 order (Basement first, no roof tab), Draft / Cannot be laid out, default tab Ground or the problem level, "0 of n floors approved", Approve disabled with "Approval comes with plan editing (next build)".<br>Labels inside their rooms, full or short names, areas in m and ft. Every room's tap readout matches my figures in m and ft; a tap outside clears. Fit view restores the fitted view after pan (and wheel zoom at 1280x800). 15.6 px/m at 360x640 without the strip, **≥ 12 with the strip**. No static banner on stage 3.<br>No-layout banner at most 50 % of the canvas at 360x640 and 640x360, text whole, a 44 px button inside, clear of Fit view; "Go to room list" lands on the First floor's first row control. Regenerate: no question when unedited, approval cleared on that level only; after an edit it asks, Cancel keeps. |
| 5 | Riders | PASS | Hints: the F2-T1 / F2-T2 suites check that each names at least two helpful answers and none that works against it, in m and ft. "–" for a level without rooms (stage-2 sync). The FS closed the F2-T3 spec gaps: 768x1024 in rooms / edges, the 7th pair, the 6-pair move refusal, the plans sentence per choice. |
| 6 | Regression and runtime | PASS | **Full run exit 0 in 523.7 s (8.7 min, under the 10-minute A-16 trigger; no trimming needed).** The unit step, sweep included, takes 19.7 s (under 30 s). `go(3)` on the maximum house (basement + 3 floors, 8 rooms each, lift): 80 ms (best of 3), all levels valid, one identical core. |

### Bugs
None.

### Observations: correct by A-8 / F3-S1, but an architect may find it odd (for PM / TL)
These are the client's first floor plans.
1. **Small rooms on a big floor huddle in one corner.** On the maximum house, each upper floor has 8 S-size rooms (about 60 m²) on a footprint of about 250 m². The rooms are packed along the front-left edge, and three quarters of the floor is empty "hall" around a stair standing alone in the middle (`C-max-2-360x640.png`, `C-max-B-360x640.png`). The cause is the scale cap (1.2) and "f = 1 when the cell is under-filled". An architect would expect the rooms spread around the stair, or the footprint % lowered. Suggest a warning when a level's rooms fill less than about 40 % of the footprint.
2. **Room names change with the space available.** On the phone, the sample's First floor shows "M. bed", "Bed 2" and "Bedroom 1" side by side: one bedroom is labelled in full, its twin abbreviated. The Maid's room, bathrooms and laundry carry no label at 360x640. It is by design (a tap names any room) but reads as inconsistent.
3. **About 1 in 4 "Cannot be laid out" results could be laid out within the 25 % rule.** For example, a single 30 m² room on a 5 x 8.5 m footprint with a front-left stair: my search places it at about 23 m². The generator keeps one scale factor per cell within 0.8–1.2. The message then advises fewer or smaller rooms although the room could simply shrink a little. This happens mostly above 85 % fill. For the TL (no change asked in this task; a candidate for F3-T2 or the F3 review).
4. **Unmet "next to each other" pairs are common on random programmes:** 9 % of the sweep layouts (177 of 2 000), none on the sample. The warning names the rooms, but nothing tells the architect which change would help.
5. **No circulation rule.** A-8 guarantees no corridor or door access; a room can be enclosed by other rooms. This is accepted for a block mockup, but an architect will notice it in the plan view first.
6. **Sizes shown are the generated ones, not the asked ones** (for example Living L asked 42 m², drawn 39 m², within 25 %). The summary on stage 2 still says "needed 120 m²", while the plan's rooms add up differently. It is consistent with F3-S1, but worth a line of explanation on stage 3.

### Verdict
All six focus items pass. The generator is valid by an independent oracle on 2 000 seeded programmes plus every named case. Sync and R5 follow A-7 and the PM's round-5 decision. Stage 3 is correct at four viewports. Six observations for PM / TL.

VERDICT: PASSED
