# F3-T1 implementation review — Tech Lead

## Round 1 — 2026-11-20

### What I did
- **Read:**
  - `core/layout.js` in full;
  - `core/plans.js` in full;
  - the `go(3)` sync and `PC.store.atRisk` in `store.js`;
  - the cap in `site-footprint.js` (as described by FS: `PC.C.FOOTPRINT_STRETCH_EXTRA`);
  - `ui/stage-plans.js` `fit()` and its registration;
  - the stage-3 markup and the banner CSS.
- **No full run.** QA was busy in the tree. The FS reports a full run exit 0 in 504.5 s (8.4 min, under the 10-minute trigger) and 12 mutation checks caught.
- **Verified the "no result change" claim for the speed-ups myself.** 1 335 seeded programmes (1–8 rooms, section 4.2 sizes, stairs / lift / 5 positions, fill 30–100 %, 0–2 pairs), each run through:
  - the spike's `generate`, with the same 0.01 m rounding and the same 0.5 m snap rule applied afterwards;
  - `PC.layout.generate`.

  Result:
  - **`ok` identical in all 1 335**;
  - **unmet-pair counts identical in all**;
  - geometry identical in **1 334**.
- **The one difference** is a 23.5 x 12 m footprint: rooms 16 / 9 / 30 / 30 / 9, the pair r0+r1, centre stair. Both outputs have zero unmet pairs and the same shape score. They differ only in which 9 m² room sits next to the 16 m² room.
  - Cause: the "twin" symmetry pruning removes duplicate equivalent assignments (the two unpaired 30 m² rooms) from the best-60 list. A different, equally good candidate therefore reaches the adjacency stage.
- **Own probe in Chrome, sample → stage 3:**
  - **Scale:** 360x640 touch 10 px/m; 640x360 touch 11.2 px/m; 1280x800 mouse 29.8 px/m.
  - **Room labels:** 3 at 360x640 ("Living", "Majlis", "Kit"), all 7 plus "Stairs" at 1280x800.
  - **Selection and readouts:** tapping the living room shows "Living | 7.0 × 5.5 m | 39 m²".
  - **Approve:** disabled, with "Approval comes with plan editing (next build)".
  - **No-layout:** a single 80 m² room on the first floor shows the banner. "Go to room list" lands on stage 2 with focus on the First floor's `room-type`.
  - **Banner size:** **167 px tall on a 240 px canvas at 360x640** and 167 of 262 px at 640x360; 54 px at 1280x800.
  - **Measurements at 360x640** with the sample strip: canvas 240 px, fit pad 30 px top and bottom, footprint + 1.5 m margin each side (18 m tall) → 10 px/m. At 360x740 the canvas is 340 px and the scale 15.6.
  - No errors, no page scroll.

### Findings
**Core: correct.**
- **Cap:** the corrected cap and its unit cases are as ruled: 2.5 x 8 m, the pentagon 21.5 x 7 m, and a `reason = setbacks` case.
- **Generator** (`core`, cells, partitions with full-span / square-ish and trimmed variants, scale factor, assignment search, best-60 mirror variants, order 2, rounding and snap):
  - follows A-8;
  - deterministic, with `cmpId` order;
  - Q14 corners follow the A-8 convention (left = low x seen from the street).
- **`check`:** names every violation, including `unknown`.
- **`sync`:** follows A-7 exactly, including that it leaves plans alone while a level's signature is `'invalid'`. It runs inside `go(3)`'s nav commit. Measured times are far under my 500 ms threshold (sample 19–46 ms, maximum house 35–55 ms).
- **`PC.store.atRisk`:** implements the PM's round-5 R5 decision (edited or approved plans only). It is used by the gate and by the Q7 dialog.

**The snap pass has one addition beyond A-8 step 7:** the snapped layout is also kept only if it does not lose a shared wall (unmet pairs not worse). Accepted, as a strict improvement. Recorded in A-8.

**UI: correct, with two phone-layout shortfalls** (the FS's flags 1 and 2):
- the plan draws at 10 px/m on a 360x640 phone, with most room labels culled;
- the no-layout banner covers 70 % of the canvas at 360x640 and 640x360.

### Rulings on the FS flags
1. **Phone scale: FS change now; Designer layout revisit at F3-T2.**
   - **FS change in `stage-plans.js` `fit()`:**
     - fit margin around the footprint is 1.0 m (was 1.5);
     - top and bottom pad is 12 px (was 30);
     - left / right pad is added only when the footprint would reach under the `plan-fit` button (top right), as the site preview does for its compass (was mirrored left and right always).
   - **Acceptance:** sample at 360x640 with the sample strip shown draws at **12 px/m or more**. Today 10; my estimate is about 12.7. Assert it in `plans-view.spec.mjs`.
   - **For F3-T2's plan:** the editor needs room on a phone. Its plan includes a Designer review of the phone stage-3 panel (sample strip, readouts, message line, action row), aiming at 14 px/m or more at 360x640. Room labels on small rooms may stay culled; the selection readout names any tapped room.
2. **No-layout banner: Designer change now, CSS only.**
   - **Where:** `src/css/42-stage-plans.css`, in a new block `@media (max-width: 899px)`.
   - **Rules:**
     - `.pc-plans__error { flex-wrap: wrap; row-gap: var(--s1); }`
     - `.pc-plans__error > .pc-banner__text { flex: 1 1 calc(100% - 32px); }`
     - `.pc-plans__error > [data-pc="btn-goto-rooms"] { flex: 1 0 100%; min-height: var(--tap); }`
   - The text runs full width with its icon, and the button sits on its own full-width line. The banner keeps its position (top, clear of `plan-fit`). No markup, hook or contract change.
   - **Acceptance** (new or extended spec, e.g. `plan-tabs.spec.mjs`), at 360x640, 360x740 and 640x360 touch with a no-layout level selected:
     - banner height **at most 50 % of the canvas height**;
     - the full text visible (no clipping);
     - "Go to room list" 44 px or more and fully inside the banner;
     - the banner does not intersect `plan-fit`;
     - 768x1024 and 1280x800 unchanged.
3. **Fit to the footprint rather than the whole plot: accepted.** The plan is the subject of this stage, and the plot stays visible around it. `plan-fit` returns to this view, and pan / zoom reach the rest. A-15 notes it.
4. **Speed-ups: accepted, with the claim corrected.** It is not literally "no result change". It is "same validity, same unmet pairs and same scores; 1 in 1 335 seeded programmes picks a different but equally good layout". The generator stays deterministic, and the sweep rates are as reported. The FS states it this way in the outcome.
5. **`PC.debug.planLabels()` / `planView()`:** accepted. Added to A-2.

### Designer tabs fix (42-stage-plans.css)
**Accepted.** The state icon and word sit under the level name. The word is visually hidden but kept in the accessible tab name below 720 px and in short landscape (it had been `display: none`). The tabs may shrink, and the desktop strip is 640 px. `plan-tabs.spec.mjs` 356/0 at five viewports (the old CSS fails 21); QA F1-T1 green again.

### Required changes
1. **FS:** the `fit()` change of ruling 1, with the 12 px/m assertion at 360x640 (and the existing fit-button cases still green).
2. **Designer:** the banner CSS of ruling 2, with its spec.
3. **Hand-over:** focused run (`--unit --e2e --only plans,plan-tabs,questions,rooms,edges,shell`), then one full run with exit 0.

VERDICT: CHANGES REQUESTED

---

## Round 2 — 2026-11-21

### What I did
- **Read the two changes:**
  - `stage-plans.js` `fit()`: footprint + 1.0 m, 12 px padding, extra right padding only when the footprint would sit under `plan-fit`;
  - the Designer's block in `42-stage-plans.css`, scoped to `(max-width: 599px), (max-height: 480px) and (orientation: landscape) and (max-width: 899px)`: the text runs full width at caption size, and the icon sits beside "Go to room list" via `order`.
- **Focused run:** plan-banner 35/0, plan-tabs 356/0.
- **Own measurement:** sample on stage 3 at 360x640 with the sample strip: **12.7 px/m** (was 10). At 360x740: 18.6 px/m.
- **Full run:** the FS reports exit 0 in 513 s (8.6 min, under the 10-minute trigger).

### Required changes from round 1
| # | Status |
|---|---|
| 1 FS fit | Resolved. 12.7 / 14.0 / 33.6 px/m at 360x640 / 640x360 / 1280x800; the footprint is never under Fit view. The FS also added an exact height-bound fit check, because a 1.5 m-margin mutation slipped past the ">= 12" check alone. |
| 2 Designer banner | Resolved, with the deviation below. Banner 106.6 px = 44 % of the canvas at 360x640 and 41 % at 640x360; button 242 x 44, clear of Fit view; 768x1024 and 1280x800 unchanged. |
| 3 Runs | Resolved |

### Ruling on the Designer's deviation
**Accepted.** My rules as written did not meet my own acceptance check (136 px, over 50 %), and `max-width: 899px` also changed the 768x1024 banner (54 → 97 px).
- The Designer's media query targets exactly the phone portrait and short-landscape layouts.
- Caption-size text (12 px / 1.35) is acceptable for a three-line message, and the banner keeps its block colour and icon.
- `plan-banner.spec.mjs` fails on both the old CSS and my literal rules, so it guards the actual requirement.

The speed-up wording in the FS outcome will follow my round-1 verification (same validity, unmet pairs and scores; 1 in 1 335 seeded programmes picks a different but equally good layout).

### Required changes
None.

### For QA (F3-T1 focus)
1. **Cap first.**
   - 4b candidates are capped at `3 x short + 0.5 m`; step-4 results at `2 x (short + 0.5 m)`.
   - CTO case 2.5 x 8.5 → 2.5 x 8 m; pentagon 21.5 x 7 m; the `reason = setbacks` case.
   - Every PM / CTO example and the 6.2 sample are byte-identical.
   - Your reference model agrees.
2. **Generator (F3-S1),** using your own oracle, not `PC.layout.check`:
   - every requested room exactly once;
   - inside the footprint;
   - no overlaps with rooms or the stair / lift;
   - sides 1.5 m or more;
   - aspect 3 or less;
   - area within 25 %;
   - stair / lift identical on every level and in the Q14 part, using the A-8 convention: left = low x seen from the street;
   - deterministic.
   - Sample levels have zero unmet pairs.
   - Maximum levels at all five stair positions.
   - Footprints up to 3:1 plus one step (6 x 18.5, 4 x 12.5, both directions).
   - No-layout only when your search agrees nothing fits, or report rates.
   - Snapped coordinates only when still valid and no shared wall is lost.
3. **Sync and R5** (now visible in the product):
   - Load sample, Resume and Skip produce plans.
   - Entering stage 3 regenerates exactly the stale levels.
   - A first-floor room change regenerates only First.
   - Q3 / Q6 / stair or lift changes regenerate all levels.
   - A move-only setback change regenerates none.
   - A removed level loses its plan.
   - An open plot leaves plans alone.
   - The R5 dialog appears only for levels with edits or approvals (PM round 5): untouched sample plans never ask, Skip-approved plans do.
   - The Q7 dialog's plan sentence names only those levels.
4. **Stage 3 UI,** at 360x640, 640x360, 768x1024 touch and 1280x800 mouse:
   - Tabs match Q7 (basement first, no roof), with states Draft / Cannot be laid out; the default tab follows the ruling.
   - Counter "0 of n floors approved"; Approve disabled with its reason.
   - Room labels in m and ft, with culled or short names on small rooms.
   - Tap selection shows the readouts.
   - Unmet-pair and repeated F2 warnings.
   - No-layout banner text and size (≤ 50 % of the canvas on phones), and its link to that level's room list.
   - Regenerate asks only after an edit and clears that level's approval only.
   - `plan-fit` after pan / zoom.
   - 12 px/m or more at 360x640 with the sample strip.
   - No static banner on stage 3; stages 4–5 keep it.
5. **Riders:** parking / pool fix hints (PM wording, m and ft); "–" for levels without rooms; F2-T3 spec gaps closed.
6. **Regression and runtime:**
   - full run under 10 minutes; if over, trim duplicate viewport coverage per A-16;
   - the unit sweep under 30 s;
   - `go(3)` timing on the maximum house.

VERDICT: APPROVED
