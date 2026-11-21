# F3-T1 — Layout generator, plan sync and plan view: implementation plan

Owner: FS. Step 3a.

**Inputs:**
- `docs/02-features/F3-plan.md`: F3-T1, its first item and the riders;
- `architecture.md`:
  - A-6 step 8, with the corrected cap;
  - A-7: signatures and the sync contract;
  - A-8: the generator;
  - A-15: the plan view and `plan-fit`;
  - A-16: the runner and the 10-minute QA-trim trigger;
- PM stories F3-S1 (with the up-to-3:1 criterion) and the round-5 changes;
- `docs/02-features/spikes/layout-spike.mjs`: a reference only, ported as production code with tests;
- the Designer's stage-3 hooks (`tests/contract/hooks.json`, F1-T1 outcome table: `plan-tabs`, `tpl-plan-tab` with `tab-name` / `tab-state`, `plan-counter`, `plan-canvas`, `plan-fit`, `plan-error`, `plan-error-text`, `btn-goto-rooms`, `plan-warn-panel`, `plan-warn-list`, `tpl-plan-warn` with `warn-text`, `plan-warn-toggle`, `plan-warn-count`, `plan-room-name` / `-dims` / `-area`, `plan-msg`, `btn-regenerate`, `btn-approve`, `btn-approve-label`);
- the existing `PC.plans.sync` call sites (`start.js` `settle()` and `loadSample()`).

**Work order:** section 1 (the cap) lands and is green first; then 2–4; then 5 (riders and spec gaps). Each step ends with a focused run. The hand-over is one full run that exits 0.

---

## 1. First item: the corrected long-side cap (CTO F2 review, debt item 1; A-6 step 8 as corrected)

### 1.1 Change (`src/js/core/site-footprint.js`)
- **Today:** after rounding, the long side is capped at `floor05(limit × (short + 0.5))` for every candidate.
- **Corrected:**
  - the 4b candidates (stretch, 3:1, 1:3) are capped at `floor05(3 × short + 0.5)`;
  - the step-4 (2:1) results keep `floor05(2 × (short + 0.5))`;
  - a longer side is still shortened about the same centre.
- The stretch (a) already stops at `min(3 × short, target / short)`, so the cap only bites on the 3:1 and 1:3 searches. I will make the stretch respect the same bound explicitly anyway, in one shared helper `capLong(w, d, limitKind)`, so no candidate can escape it.
- **New constant** `PC.C.FOOTPRINT_STRETCH_EXTRA = 0.5` (m): the "+ 0.5 m" of the stretched bound. PM 4.3 already states the sentence ("long side at most 3 × short side + 0.5 m when stretched"; PM edits it in this round). It also serves as the marker in 1.3.

### 1.2 Unit cases (`tests/unit/footprint.test.mjs`)
- **CTO case:** the 2.5 m-wide plot at 25 % (2.5 × 40 m, zero setbacks). Before: 2.5 × 8.5 m. After: **2.5 × 8 m**, clamped, reason `proportion`.
- **QA's pentagon** (6 / 5 / 4, 25 %): today 22.5 × 7. It becomes **21.5 × 7 m** (3 × 7 + 0.5), pinned with its area and `reason`.
- **Every PM / CTO / TL example byte-identical:** 10 × 50 at 20 / 24 / 30 %; 50 × 10; 20 × 30 at 80 %; 10 × 20 at 80 %; the L- and U-shapes; the 6.2 sample (whole footprint object).
- **The 2:1 bound cases unchanged:** 10 × 18 at 50 % → 6 × 13; 10 × 19 at 30 % → 5 × 10.5.
- **The missing `reason` case:** a 4b result at its 3:1 bound whose 0.5 m longer rectangle does *not* fit gives `setbacks`. I will find it with a small search over thin rectangles and trapezoids (the longer rectangle hits a back setback), then pin it.
- **Property test (existing sweep):** "long ≤ 3 × short + 0.5" for 4b results and "long ≤ 2 × (short + 0.5)" otherwise.
- **Mutation checks:**
  - cap back to `3 × (short + 0.5)`: the CTO case and the pentagon fail;
  - cap removed from the stretch path: the property test fails if any case reaches it; I will report if none does.

### 1.3 Landing without a red full run (proposed sequence)
QA's `tests/qa/f2-t1-ref.mjs` mirrors the cap, and its F2-T1 / F2-T3 suites compare app footprints with the model. Same pattern as the draft-v2 round:
1. **QA first:** the reference model applies `3 × short + 0.5` when the app exposes `PC.C.FOOTPRINT_STRETCH_EXTRA`, and the old `3 × (short + 0.5)` otherwise. QA proves this green on today's tree (marker absent).
2. **FS second:** the cap change and the constant land together. My hand-over full run exercises QA's new branch.
3. A disagreement is a finding for the TL, not something to paper over. A KNOWN window is not used.

Only after this lands is the layout sweep's footprint range fixed to the corrected bound (section 2.5).

---

## 2. Layout generator — `src/js/core/layout.js` (`PC.layout`, core layer, A-8)

### 2.1 API (frame P = footprint-local: x along u from the footprint's left edge, y along v from its street side)
- `PC.layout.core(W, D, stairs, stairPos, lift)` → `{ stair: {x, y, w, h} | null, lift: {x, y, w, h} | null, cells: [{ id, x, y, w, h }] }`. The same block on every level, also used for drawing, `check` and later the house model (A-9).
  - Stair 2.5 × 4.0 m with its long side along the longer footprint axis; the lift 1.5 × 2.0 m beside it across the band.
  - Centre = centred, snapped down to 0.5 m.
  - Corners flush: `fl` / `fr` = street side (y = 0), `bl` / `br` = back; `l` = x = 0, the left as seen from the street looking in (question Q6).
  - Cells: the band before the core, the band after it, and the two side pieces of the core band. Pieces under 1.5 m are dropped (they become hall). Without stairs there is one cell.
- `PC.layout.generate(input)` with `input = { W, D, rooms: [{ id, area }], pairs: [[a, b]], stairs, stairPos, lift }` → `{ ok: true, rooms: [{id, x, y, w, h}], unmet: [[a, b]], core }` or `{ ok: false, core }`.
  - Pure and deterministic: no randomness; stable sorts using `PC.store.cmpId` (numeric id order, not string order as in the spike); strict-improvement comparisons only.
- `PC.layout.check(W, D, core, requested, rooms)` → violations `[{ code, ids }]`. Codes: `missing`, `duplicate`, `outside`, `overlap-room`, `overlap-core` (beyond 0.011 m), `side` (< 1.5 m), `aspect` (> 3), `area` (off by more than 25 %).
- `PC.layout.adjacent(a, b)`: they touch within 0.02 m along 0.5 m or more.
- `PC.layout.overlaps(rooms, core)`: the overlap subset of `check`, for the editor in F3-T2.

### 2.2 Algorithm (port of the spike, written for reading and testing)
1. **Order 1:** rooms by area descending, ties by `cmpId`.
2. **Cells** from `core`.
3. **Per cell and room subset** (memoised by a bitmask key): every column partition (`2^(n-1)`) in both column directions.
   - **Scale factor:** `f = min(FMAX, cellArea / sum)`, and `f = 1` when the cell is under-filled. The cell is infeasible when `cellArea / sum < FMIN`.
   - **Column thickness:** full span, then upgraded to square-ish in order while the cell length allows and the score improves. The CTO round-1 trimmed variants (along w, along h) are kept, as in the spike.
   - **Valid** when every side is 1.5 m or more and no aspect exceeds 3.
   - **Score** = Σ(aspect − 1) + 4 × |f − 1| × n.
4. **Assignment:** a depth-first search over room → cell with capacity pruning. Score = sum of cell scores, minus 2 for an empty cell beside the core.
5. **Adjacency:** for the best 60 assignments, try the four mirror variants per cell and count unmet pairs. Total = shape + 100 × unmet. The first candidate with zero unmet pairs at the best shape score wins.
6. **Order 2** (only when pairs remain unmet): each paired room is moved directly behind its partner. The better total wins.
7. **Rounding:** coordinates to 0.01 m. Then a snap pass to 0.5 m, **kept only if `check` still passes**; otherwise the unsnapped result stays.
8. **No valid assignment:** `{ ok: false }`.

New numbers go into `PC.C` together with the PM's section 4 (A-8 already lists them): `LAYOUT: { fMin: 0.8, fMax: 1.2, adjMin: 0.5, adjTol: 0.02, overlapTol: 0.011, topAssignments: 60 }`. The stair and lift sizes are already `PC.C.STAIR` / `PC.C.LIFT`; the 1.5 m minimum side, the 3:1 aspect and the 25 % area tolerance are already in `PC.C`.

### 2.3 "Cannot be laid out"
The level stores `error: 'no-layout'`. Stage 3 shows the text from one table: "This floor could not be laid out. Try fewer or smaller rooms on this level, another stair position, or a larger footprint." The three fixes are named, and `btn-goto-rooms` opens stage 2 at that level's room list (section 4).

### 2.4 Determinism and timing
- Two runs give deep-equal results, also after a memo reset.
- A maximum level (8 rooms, lift, each of the 5 stair positions) generates in under 300 ms in node.

### 2.5 Seeded sweep (`tests/unit/layout-sweep.test.mjs`, a separate file)
- **At least 2 000 programmes** that pass the area validation:
  - 1–8 rooms with section 4.2 sizes, and some exact areas;
  - 0–6 pairs per level;
  - stairs on / off, the 5 positions, lift on / off;
  - fill 30–100 %.
- **Footprints as the site model can now produce them:**
  - a 2:1-or-less draw;
  - an explicit 2:1–3:1 draw in both directions, up to the corrected bound `long ≤ 3 × short + 0.5` (e.g. 6 × 18.5, 4 × 12.5, 18.5 × 6);
  - every side a multiple of 0.5 m.
- **Every result** is either `ok` and passes `check`, or `ok: false`. Never an invalid layout, never an exception.
- **Printed:** the no-layout rate at fill ≤ 85 % and above, overall and separately for footprints beyond 2:1, plus the worst time.
- **Assertions:**
  - no-layout ≤ 5 % at ≤ 85 % fill, overall and beyond 2:1;
  - worst case under 300 ms (best of 3 if noisy, as A-16 allows).
- **Fixed cases in `tests/unit/layout.test.mjs`:**
  - both sample levels valid with zero unmet pairs;
  - the maximum level at each of the 5 stair positions;
  - a single-room level;
  - a no-stair level;
  - wide (W = 2D) and deep footprints;
  - the 6 × 18, 18 × 6, 15 × 5 and 5 × 15 m footprints with the default room lists and with a full 8-room level that fits by area;
  - the CTO case (no stairs, 8.5 × 16.5, rooms 42/36/16/4/4);
  - the stair and lift rectangles identical on every level and inside the Q14 part of the footprint;
  - a constructed case where snapping would break `check`, so the unsnapped result is kept;
  - the no-layout case (one 60 m² room on the sample footprint).
- **Run time:** the sweep takes about 10–20 s on this 2-core box (spike: average well under 10 ms per programme). The full run is about 7.7 min today, so the A-16 10-minute QA-trim trigger is not reached. I will report the measured time.

---

## 3. Plans — `src/js/core/plans.js` (`PC.plans`, core)

- **`PC.plans.sync(draft)`** is an in-place mutator, used inside a `nav` commit (the F1-T2 contract and A-7). For each plan level:
  - `sig === 'invalid'` (open plot, no footprint): a stored plan is left alone; none is created;
  - no plan, or `plan.sig !== sig`: generate, and store `{ sig, rooms, unmet, edited: false, approved: false, error: ok ? null : 'no-layout' }`;
  - otherwise untouched (edits and approval kept).

  Plans of levels that no longer exist are deleted (Q7 normally prunes them; sync makes it hold whatever path got there).
- **`PC.plans.input(state, id)`** builds the generator input for a level. It is exported so F3-T2 and the tests use the same mapping:
  - footprint `w × d` from `PC.site.analyse`;
  - the level's rooms with `PC.levels.roomArea`;
  - the level's pairs, `stairsExist`, `stairPos`, `liftExists`.
- **`PC.plans.regenerate(draft, id)`** drops that level's plan and generates it again (the "Regenerate this floor" button).
- **Where sync runs:**
  - (a) `PC.store.go(3)`, inside its nav commit, so entering stage 3 always shows current plans. See question Q2;
  - (b) `start.js` `settle()` (Resume) and `loadSample()`. Their `PC.plans && PC.plans.sync` existence checks are removed now that the module exists (the CTO "no fail-open guards" rule).
- **The sample loads with both levels generated** (F1-S5 "all levels generated"). Skip to 3D approves them and lands on the highest reachable stage, stage 3 in this build.
- `PC.stages.MAX_BUILT = 3`, so Next works from stage 2.

**Unit tests (`tests/unit/plans-sync.test.mjs`):**
- a first-floor room change regenerates only `'1'`;
- Q3 regenerates all levels; Q6 regenerates all;
- a setback change that only moves the footprint regenerates none;
- removing a level deletes its plan;
- an appearance change regenerates nothing;
- with the plot reopened (`'invalid'`), stored plans stay as they are;
- an edited or approved plan is kept while its signature matches;
- `regenerate` clears that level's approval only;
- the sample after load has two valid plans;
- the draft round trip of plans goes through `PC.draft.parse` (existing `plansOk`).

---

## 4. Stage 3 controller — `src/js/ui/stage-plans.js`

- **Tabs** (`plan-tabs`, `tpl-plan-tab`): one per plan level in the order B, G, 1, 2, never the roof.
  - `tab-name` is the level name; `tab-state` reads "Draft" / "Approved" / "Cannot be laid out" (`is-approved` / `is-invalid`), with `aria-selected`.
  - The selected level is session state (default: the lowest level with a problem, else Ground). Arrow keys move between tabs (tablist pattern).
- **Counter** (`plan-counter`): "0 of 2 floors approved". Approval itself is F3-T2. In F3-T1, `btn-approve` stays disabled with the reason shown in `plan-msg`, unless the TL prefers it hidden (question Q4).
- **Plan view** (`plan-canvas`): a `View2D` with pan and zoom (A-15 plan view; not locked).
  - **Drawn in frame L** (plan coordinates P are offset by the footprint's `u, v`): the plot outline, the setback zone (`draw2d.setbackZone`), the footprint with the hall fill, the rooms tinted per type (`PC.data.palette2d` room tints from F1-T1), each with its name and area label in the current unit, and the stair and lift blocks (hatched or grey per the palette).
  - `draw2d` stays generic: it may gain a `rect(view, r, o)` helper and a label-inside-rectangle helper (shortened to fit, or culled). No stage knowledge in it.
  - **`plan-fit`** calls `fit()` (wired as `plot-fit` is), and labels avoid the button (as on stage 1). The view is fitted on entering stage 3 and on a level change.
  - **Read-only selection** (question Q3): a tap on a room fills `plan-room-name` / `-dims` / `-area` in the current unit; a tap outside clears them ("–"). F3-T2 turns the selection into editing.
- **Warnings** (`plan-warn-panel`, `plan-warn-list`, `tpl-plan-warn`, chip `plan-warn-toggle` / `plan-warn-count` on phones):
  - unmet pairs ("Kitchen and Dining are not next to each other.");
  - the F2 warnings from `PC.validate` repeated (F2-S3: "shown inline and again on the Floor plans stage").
- **No layout** (`plan-error`, `plan-error-text`, `btn-goto-rooms`): the text of 2.3. The button goes to stage 2 and calls the questions controller's `goToQuestion(11, level)` (the F2-T3 level-aware Fix), so the room list of that level is in view.
- **Regenerate** (`btn-regenerate`): when the level is `edited` (only possible from F3-T2), an in-page confirmation first. It goes through `commit` with `PC.plans.regenerate`, which clears that level's approval only.
- **Static banner:** stage 3 now has a controller, so the static-preview banner no longer appears there (as on stage 2 in F2-T2).
- **Units:** every length and area through `PC.units`. A unit switch redraws without regenerating anything (unit is appearance class).
- **Phone:** the canvas, tabs and chip per the Designer's layout. 44 px targets; no page scroll while panning.
- **Debug** (A-2): `PC.debug.planLabels()` and `PC.debug.planView()`, read-only, added with `Object.assign`.

**E2E (`tests/e2e/plans-view.spec.mjs`)** at 360x640 touch, 640x360 touch, 768x1024 touch and 1280x800 mouse:
- Next from stage 2 opens stage 3.
- The tabs match Q7: a basement tab first when enabled, no roof tab. They update after a Q7 change and a return to stage 3.
- Every room label is present once, with name and area in m and in ft.
- The stair is drawn at the Q14 position.
- An unmet-pair warning is listed (a pair that cannot be met).
- The F2 warnings are repeated (narrow plot: `fp-clamped`).
- No layout: one 60 m² room on the sample footprint shows the message with the three fixes; the link lands on stage 2's room list for that level.
- Regenerate asks only after an edit (an edited plan is seeded in this task).
- `plan-fit` after pan / zoom gives back the fitted view, and no label lies under the button.
- Load sample → stage 3: both levels in Draft with layouts, and the counter reads "0 of 2 floors approved".
- Skip to 3D on the sample lands on stage 3 with both approved.
- Reload + Resume keeps the layouts and does not regenerate them.
- Clean log, no page scroll, 44 px targets, tab keyboard navigation.

---

## 5. Riders and carried spec gaps

### 5.1 PM riders from the F2 feature review (decisions 3 and 4)
- **`parking-omitted`** gets a fix hint naming at least two helpful answers: "Parking does not fit between the building and the street: it is left out of the 3D scene. A lower footprint %, a smaller front setback or fewer cars would help."
- **`pool-omitted`**, likewise: "The pool with its 1.0 m clearance does not fit behind or beside the building: it is left out of the 3D scene. A lower footprint %, smaller back or side setbacks or a smaller pool would help." The clearance stays worded through `PC.units` ("3.3 ft").
- The exact wording is the PM's; I will use these unless the PM says otherwise in the plan review.
- **A plan level with no rooms** shows "–" for "needed" in the summary level row (`summary.js`), not "needs 10 m²". The blocking `floor-empty` row is unchanged.
- **Unit and e2e tests:** both texts in m and ft; the "–" row.

### 5.2 FS spec gaps carried from F2-T3 (outcome section 8, items 2–4 and 6)
- `rooms.spec.mjs` and `edges.spec.mjs` also run at 768x1024 touch.
- `rooms.spec.mjs` gains:
  - the 7th-pair refusal text;
  - a move refused by the 6-pair limit ("…would have more than 6 pairs.");
  - the plans sentence compared between Move and Delete with seeded plans;
  - an empty `invalidFields` assertion at the start of each stale-area case.
- Names and counts in these new cases come from my own expected strings, not from app helpers.

---

## 6. Files

| File | Change |
|---|---|
| `src/js/core/const.js` | `FOOTPRINT_STRETCH_EXTRA`, `LAYOUT` numbers |
| `src/js/core/site-footprint.js` | corrected cap |
| `src/js/core/layout.js` (new) | `PC.layout` |
| `src/js/core/plans.js` (new) | `PC.plans` (`sync`, `input`, `regenerate`) |
| `src/js/core/stages.js` | `MAX_BUILT: 3` |
| `src/js/core/store.js` | `go(3)` runs `sync` inside its nav commit (if Q2 is approved) |
| `src/js/core/validate.js` | parking / pool hints |
| `src/js/ui/start.js` | guards removed; `sync` unchanged otherwise |
| `src/js/ui/summary.js` | "–" for levels without rooms |
| `src/js/ui/stage-plans.js` (new) | stage 3 controller |
| `src/js/ui/draw2d.js` | generic `rect` / inside-label helpers |
| `src/js/ui/stage-questions.js` | `goToQuestion` exported for the no-layout link |
| `src/js/main.js`, `src/manifest.json` | registration |
| `tests/unit/` | `layout.test.mjs`, `layout-sweep.test.mjs`, `plans-sync.test.mjs` (new); `footprint`, `validate`, `stages`, `sample` extended |
| `tests/e2e/` | `plans-view.spec.mjs` (new); `rooms.spec`, `edges.spec`, `questions.spec`, `shell.spec` updated (MAX_BUILT, Skip target, hints, "–") |

`src/index.html` and the CSS are not touched. If a hook turns out to be missing, I stop and report.

## 7. QA files that will need updating (QA's, routed by the coordinator)
- `tests/qa/f2-t1-ref.mjs` / `f2-t1-site.mjs`: the corrected cap, behind the marker (1.3).
- `tests/qa/f2-t1-site.mjs`, `f2-t2-questions.mjs`, `f2-t3-site-rooms.mjs`, `stage2kit.mjs`:
  - the `parking-omitted` / `pool-omitted` texts gain the hint;
  - the summary level row for an empty level shows "–".

  They can branch on `typeof PC.layout === 'object'` (present only from F3-T1).
- `tests/qa/f1-t2-flows.mjs`:
  - Skip to 3D now lands on stage 3 (was 2);
  - stage 3 is reachable, and its static-preview banner is gone (it has a controller);
  - Load sample ends with two Draft plans.
- `tests/qa/f1-t1-layout.mjs` / `inpage.js`: the stage-3 states the suite opens by hand now carry generated content (tabs, labels, banner). Any check of the static markup there may need the same branch.

Proposed sequence: as in 1.3, QA lands its branches first (green on today's tree), then my change lands. My hand-over is a full run that exits 0.

## 8. Mutation checks I will do (each restored byte for byte)
1. Cap back to `3 × (short + 0.5)`: CTO case and pentagon unit cases fail.
2. Snap kept even when `check` fails: the snap-break fixed case fails.
3. Adjacency tolerance 0.5 → 0.6 m: the sample-level zero-unmet cases fail.
4. `FMIN` 0.8 → 0.7 (accept squeezed cells): the sweep finds invalid `area` results.
5. Order 2 removed: a pair case that needs it fails. I will pin one from the sweep.
6. Sync regenerates on `'invalid'`: the plans-sync unit case fails.
7. Sync regenerates every level on any change: the "only `'1'`" case fails.
8. Stair position mirrored (`l` ↔ `r`): the Q14-position unit and e2e cases fail.
9. No-layout link without the level: the e2e lands on the wrong group.
10. Hint text missing from `parking-omitted`: the validate unit case fails.

## 9. Acceptance map

| Criterion | Where tested |
|---|---|
| F3-S1: one tab per plan level, never the roof; plot / setback / footprint drawn | plans-view e2e |
| F3-S1: every room exactly once with name and area; inside the footprint; no overlap with rooms or core | layout unit (`check`), sweep, e2e labels |
| F3-S1: the stair (and lift) at the same position on every level, in the Q14 part | layout unit, e2e |
| F3-S1: area within 25 %, sides ≥ 1.5 m, aspect ≤ 3; the rest is hall | `check` in unit and sweep |
| F3-S1: pairs share a wall where possible; unmet listed per level | layout unit (sample zero unmet), e2e warning |
| F3-S1: never fails silently: message with the fixes and a link to the room list | layout unit (no-layout), e2e |
| F3-S1: deterministic | layout unit |
| F3-S1 (round 4): holds on footprints up to 3:1; 6 × 18, 15 × 5 with default lists and a full 8-room level | layout unit, sweep beyond 2:1 |
| R5 observable result: changed levels regenerated in Draft, unchanged kept | plans-sync unit; e2e after a Q11 change |
| F1-S5: sample loads with all levels generated | plans-sync unit, e2e |
| A-6 step 8 (corrected cap), `reason` setbacks case | footprint unit |
| PM riders (hints; "–") | validate / summary unit, e2e |
| F2-T3 spec gaps | rooms.spec / edges.spec |

## 10. Risks
1. **Sweep run time** inside the unit step (10–20 s estimated). If it is slower, the sweep moves to its own runner step, still in the full run. The A-16 trigger is far off.
2. **Generator quality on stretched footprints:** the TL measured 0.6 % no-layout beyond 2:1. The corrected cap makes footprints slightly *less* elongated, so the risk only goes down.
3. **Sync cost at stage entry:** up to 4 levels × the worst case (about 90 ms each in the spike) inside one commit. Acceptable; it is measured in the e2e as "Next opens stage 3 within one frame plus generation".
4. **QA's stage-3 layout checks** were written against static markup. The branch sequence (section 7) avoids a red run, but QA's work is on the critical path.
5. **Stair left / right convention** (question Q6): if the house model in F4 assumes the other mirror, the stair moves sides in 3D. Pinned in a unit test now.

## 11. Questions for the Tech Lead
1. **Cap marker:** is `PC.C.FOOTPRINT_STRETCH_EXTRA = 0.5` acceptable, both as the constant and as QA's branch marker?
2. **Where sync runs on entering stage 3:** inside `PC.store.go(3)` (core, one nav commit: the stage change and the plans together, as the `r5Confirmed` reset already lives there), or in the stage-3 controller's `enter` as a second nav commit? I prefer `go(3)`.
3. **Read-only selection** in F3-T1 (tap a room → name / dims / area): include now (cheap, makes the readouts testable), or leave all selection to F3-T2?
4. **`btn-approve` in F3-T1:** disabled with "Approval comes with plan editing (next build)", or hidden until F3-T2?
5. **Sweep placement:** inside the unit step as `layout-sweep.test.mjs` (my plan), or behind a separate `--sweep` flag that the full run includes?
6. **Q14 left / right:** "left" = x = 0 = the left as seen from the street looking into the plot (the spike's convention, and the Q14 diagram's "Street side (front)" caption at the bottom). Confirm, so F4's house model follows the same.
7. **Default selected tab:** the lowest level with a problem (no-layout, unmet pairs), else Ground. OK?
