# F3-T1 — Layout generator, plan sync and plan view: outcome

Owner: FS. Step 3f.
- **Plan:** `plan.md`, approved with 7 rulings, 6 conditions and the R5 addendum (`plan-review.md`).
- **Implementation review:** `impl-review.md`, round 1 changes requested, round 2 approved.
- **QA:** `qa-report.md`, passed with no bugs.

No code was changed in this step.

## 1. What was built
- **Corrected footprint cap (A-6 step 8, CTO F2 review debt item 1).**
  - The 4b candidates (stretch, 3:1, 1:3) have their long side capped at `3 × short + 0.5 m` after rounding. Step-4 (2:1) results keep `2 × (short + 0.5 m)`.
  - New constant `PC.C.FOOTPRINT_STRETCH_EXTRA = 0.5`. It was also QA's switch for the version-aware landing.
  - Results: the CTO's 2.5 × 8.5 m case is now 2.5 × 8 m; QA's pentagon is 21.5 × 7 m; the missing `reason: 'setbacks'` case is pinned (7 × 14 m at 30 % gives 3 × 9 m). Every other PM / CTO / TL example and the sample are byte-identical.
- **Floor-plan generator `PC.layout`** (A-8): a production port of the spike. Each step:
  - the stair / lift core and the cells around it;
  - every column partition per cell, with full-span or square-ish thickness and the trimmed variants;
  - a depth-first room-to-cell assignment;
  - the best 60 assignments × mirror variants for adjacency;
  - a second room order with partners pulled together;
  - rounding to 0.01 m, then a 0.5 m snap that is kept only while `check` passes and no shared wall is lost.

  It is deterministic and uses numeric id order. A failure is `{ ok: false }`, never an invalid layout.
- **Plans `PC.plans`** (A-7):
  - `sync` regenerates exactly the missing or stale levels;
  - `regenerate` gives one level a fresh Draft;
  - the sample loads with every level laid out;
  - `PC.store.go(3)` syncs in the same nav commit;
  - `PC.stages.MAX_BUILT = 3`, so Next works from stage 2.
- **R5 as decided by the PM in round 5:** `PC.store.atRisk(candidate)` = the affected levels whose plan is edited or approved (Skip's approvals count).
  - The gate asks only when this set is non-empty and names only those levels. Untouched generated Drafts regenerate silently and do not use up the once-per-visit question.
  - The Q7 remove-level dialog builds its plans sentence from the same set, and hides it when the set is empty.
- **Stage 3 (`stage-plans.js`):**
  - one tab per plan level (B, G, 1, 2; never the roof), showing Draft / Approved / "Cannot be laid out";
  - "n of m floors approved";
  - Approve disabled, with "Approval comes with plan editing (next build)" in `plan-msg`;
  - the plan drawn in frame L: plot, setback zone, footprint as hall, rooms tinted per type with name and area, stair and lift;
  - read-only selection with readouts (name, size, area in the current unit);
  - warnings: unmet pairs, and the F2 warnings repeated;
  - the no-layout message with the three fixes, whose link opens stage 2 at that level's room list;
  - Regenerate, which asks only after an edit;
  - `plan-fit` wired;
  - no static banner.
- **Riders:**
  - the PM's fix hints on `parking-omitted` / `pool-omitted`;
  - "–" as "needed" for a level without rooms;
  - the F2-T3 spec gaps closed: 768x1024 in rooms / edges, the 7th-pair refusal, the 6-pair move refusal, the plans sentence for Move vs Delete, an empty `invalidFields` at the start of each stale case, and expected strings written out in the tests.

## 2. Files

| File | Change |
|---|---|
| `src/js/core/const.js` | `FOOTPRINT_STRETCH_EXTRA`, `LAYOUT { fMin 0.8, fMax 1.2, adjMin 0.5, adjTol 0.02, overlapTol 0.011, topAssignments 60 }` |
| `src/js/core/site-footprint.js` | `longCap` (corrected cap), also applied to the stretch |
| `src/js/core/layout.js` (new) | `PC.layout` |
| `src/js/core/plans.js` (new) | `PC.plans` |
| `src/js/core/store.js` | `go(3)` syncs; `atRisk`; the gate uses `atRisk` |
| `src/js/core/stages.js` | `MAX_BUILT: 3` |
| `src/js/core/validate.js` | parking / pool hints (PM text) |
| `src/js/core/levels.js` | `plansSentence` comment (sentence built from `atRisk`) |
| `src/js/ui/start.js` | sync without guards after Resume / Load sample, and before Skip approves |
| `src/js/ui/stage-plans.js` (new) | stage 3 controller |
| `src/js/ui/draw2d.js` | generic `rect`, `boxLabel` (alternatives, small-font pass) |
| `src/js/ui/stage-questions.js` | `ui.stages.questions.goTo(q, level)` |
| `src/js/ui/q-rooms.js` | plans sentence from `atRisk` |
| `src/js/ui/summary.js` | "–" for levels without rooms |
| `src/js/main.js`, `src/manifest.json` | registration (35 scripts) |
| `tests/unit/` | new `layout.test.mjs`, `layout-sweep.test.mjs`, `plans-sync.test.mjs`; `footprint`, `validate`, `stages`, `store` updated (301 tests) |
| `tests/e2e/` | new `plans-view.spec.mjs` (295); `shell`, `questions`, `rooms` (361), `edges` (501) updated |

Designer, CSS only, in `42-stage-plans.css`:
1. **Tabs fix:** the level tabs fit with 4 real levels and every state.
2. **No-layout banner fix:** compact on phones and in short landscape. It is scoped to `(max-width: 599px)` and short landscape, takes 44 % / 41 % of the canvas, and leaves 768 / 1280 unchanged. Its specs are `plan-tabs.spec.mjs` and `plan-banner.spec.mjs`.

## 3. Public APIs F3-T2 and F4 reuse

**`PC.layout`** (core; frame P = footprint-local: x along u from the footprint's left edge, y from its street side):
- `core(W, D, stairs, stairPos, lift)` → `{ stair, lift, cells }`.
  - The stair is 2.5 × 4.0 m with its long side along the longer axis; the lift is 1.5 × 2.0 m beside it.
  - Centre is centred and snapped down to 0.5 m; corners are flush.
  - **Q14 convention (binding on the F4 house model, A-8):** "left" = low x = the left as seen from the street looking in; "front" = low y.
- `generate({ W, D, rooms: [{id, area}], pairs, stairs, stairPos, lift })` → `{ ok, rooms: [{id, x, y, w, h}], unmet, core }` or `{ ok: false, core }`.
- `check(W, D, core, requested, rooms)` → `[{ code, ids }]`. Codes: `missing`, `duplicate`, `unknown`, `outside`, `side`, `aspect`, `area`, `overlap-room`, `overlap-core`.
- `overlaps(rooms, core)`: the overlap subset of `check`, for the editor's "invalid on release".
- `adjacent(a, b)`: they touch within `adjTol` along `adjMin`.
- **Snap rule:** a 0.5 m snap of every room edge is kept only if `check` passes and no shared wall is lost; otherwise the 0.01 m coordinates stay.
- **Numbers:** `PC.C.LAYOUT`, plus `STAIR`, `LIFT`, `ROOM_MIN_SIDE`, `ROOM_MAX_ASPECT`, `ROOM_AREA_TOL`.

**`PC.plans`:**
- `input(state, id)`: the generator input for a level.
- `make(state, id)` → `{ sig, rooms, unmet, edited: false, approved: false, error: null | 'no-layout' }`.
- `sync(draft)`: an in-place mutator, always inside a nav commit (`go(3)`, Resume, Load sample, Skip).
  - Plans of removed levels are deleted.
  - A level whose signature is `'invalid'` keeps its stored plan.
  - A missing or stale plan is regenerated; everything else is kept, with its edits and approval.
- `regenerate(draft, id)`.

**`PC.store`:**
- `affected(candidate)` is unchanged: every level whose valid plan would go stale or be removed.
- `atRisk(candidate)`: the affected levels that are edited or approved.
- F3-T2's editor, its Clear dialog and any later own-confirmation dialog name plans from `atRisk`.

**Stage 3 (`ui.stages.plans`, `stage-plans.js`):**
- Selection is session state, cleared on a level change, on `replace` and when the room no longer exists. F3-T2 builds editing on it.
- The readouts fill `plan-room-name / -dims / -area`.
- Level choice keeps the previous level while it exists; otherwise the lowest level with a problem; otherwise Ground.
- `fit()`: footprint + 1.0 m, 12 px padding, extra right padding only when the footprint would reach under `plan-fit`.
- The hit test stays in the controller (`View2D.onTap`). `view2d.js` / `draw2d.js` know nothing about rooms.

**`ui.draw2d`:**
- `rect(view, box, o)`.
- `boxLabel(view, box, lines | [alternatives], { font, smallFont, color, placed })`: the first alternative whose first line fits; the normal font first, then `smallFont` for the first alternative, then the others.

**`ui.stages.questions.goTo(q, level)`**: Fix-style navigation from other stages.

**`PC.debug`** (A-2): `planLabels()`, `planView()` (`level`, `selected`, `scale`), `view('plan')`, `toScreen('plan', u, v)`.

## 4. How to verify
1. `node build.mjs && node tests/run-all.mjs` exits 0.
   - Focused: `--unit --e2e --only plans-view,plan-tabs,plan-banner,rooms,questions,shell`.
   - QA: `--qa --only f3-t1`.
2. **Sample:** Load sample, Next, Next. Both tabs read Draft with full layouts, and the counter reads "0 of 2 floors approved". Tap a room to see its name, size and area.
3. **No layout:** on stage 2, keep one exact 80 m² room on the First floor (delete the others). On stage 3 the First floor tab reads "Cannot be laid out"; "Go to room list" lands on that floor's room.
4. **R5:**
   - After Load sample, change the side setback 2 → 2.5 m: no question.
   - After Skip to 3D, the same change asks and names both floors.

## 5. QA sign-off
- **QA round 1: PASSED, no bugs.**
  - `tests/qa/f3-t1-plans.mjs` is an independent oracle written from A-8 / F3-S1 (11 checks). It ran 2 000 seeded programmes, every layout valid by the oracle; unmet pairs matched QA's own adjacency; deterministic.
  - Its own exhaustive search judged every no-layout result.
  - `tests/qa/f3-t1-stage3.mjs`: 201 checks at 4 viewports.
  - 8 source mutations, all caught.
  - QA's no-layout rates: 2.1 % at ≤ 85 % fill, 27.7 % above.
- **Full run (QA):** exit 0 in 523.7 s.
  - unit 301; e2e all green (plans-view 295, plan-tabs 356, plan-banner 35, …);
  - QA: F1-T1 179 + 2015, F1-T2 828, F2-T1 1140, F1-T3 1022, F2-T2 959, F2-T3 1136, F3-T1 11 + 201.
- **FS:**
  - 12 mutation checks in round 1, all caught: cap, snap, adjacency, fMin, order 2, sync on `'invalid'`, sync all, mirror, link level, hint, and the gate / dialog using `affected`;
  - 2 more in round 2: margin 1.5 m and padding 30 px, caught only after the exact-fit assertion was added.

## 6. Timings
- **`go(3)` in node:** sample 19–46 ms; maximum house (basement + 3 floors, 8 rooms each, lift) 35–55 ms in my runs, 80 ms in QA's (best of 3). Before the speed-ups the maximum house took 375–522 ms.
- **Sweep:** 2 400 programmes in 10.6–11 s inside the unit step (under the 30 s ceiling). The worst single programme is 172–249 ms after the best-of-3 retime.
- **Sweep rates (FS):**

  | Footprints | Fill ≤ 85 % | Fill > 85 % |
  |---|---|---|
  | All | 1.0 % | 8.2 % |
  | Beyond 2:1 | 0.0 % | 7.3 % |

- **Full run:** 504.5 s (round 1), 513.0 s (round 2, FS), 523.7 s (QA). All under the 10-minute A-16 trigger.

**Speed-ups, as the TL verified them.** The changes were: one evaluation per contiguous room group, a cell-layout memo shared by both room orders, a bounded best-60 list, and skipping duplicate swaps of interchangeable unpaired rooms. Compared with the spike on 1 335 seeded programmes they give the same validity, the same unmet pairs and the same scores. One programme in 1 335 picks a different but equally good layout, because of the duplicate-swap pruning. The generator stays deterministic.

## 7. Tech Lead rulings
**Plan review (7 rulings):**
1. `FOOTPRINT_STRETCH_EXTRA` as the constant and QA's switch.
2. Sync inside `go(3)` in one nav commit; Resume, Load sample and Skip also sync; timing reported.
3. Read-only selection in F3-T1.
4. Approve disabled with its reason.
5. The sweep in the unit step with a 30 s ceiling.
6. Q14 left = low x seen from the street.
7. Default tab rule, keeping the previous tab.

Conditions: the QA-first landing order, cap before sweep, timings reported, no fail-open guards (unit test), no static banner on stage 3, no markup / CSS change.

**R5 addendum (PM decided, round 5):** `atRisk`, as delivered.

**Implementation round 1:**
1. Phone scale: the FS fit change (1.0 m, 12 px) with ≥ 12 px/m at 360x640.
2. No-layout banner: Designer CSS.
3. Fit to the footprint accepted.
4. Speed-ups accepted, with the wording in section 6.
5. Debug hooks added to A-2.

**Implementation round 2:** approved. The Designer's scoped-media deviation was accepted (the literal rules missed their own 50 % check and changed 768x1024).

## 8. Known limits and observations

| # | Item | Owner / when |
|---|---|---|
| 1 | QA obs. 1: small rooms on a big floor huddle at the front-left, leaving about 3/4 of the floor as hall around a lone stair (scale cap 1.2; f = 1 when under-filled). QA suggests a warning when a level's rooms fill under about 40 % of the footprint | PM, at the F3 feature review (with the existing rider "default answers leave most of each floor as hall") |
| 2 | QA obs. 2: phone labels mix full and short names, and small rooms (maid's room, bathrooms, laundry) are unlabelled at 360x640; a tap names any room | Designer review of the phone stage-3 panel in F3-T2 (TL rider: aim at ≥ 14 px/m at 360x640) |
| 3 | QA obs. 3: in about 23 % of no-layout results a valid layout exists within the 25 % area rule (one scale factor per cell, 0.8–1.2). The message then says "fewer or smaller rooms" when "shrink slightly" would do. Mostly above 85 % fill | TL, candidate for F3-T2 or the F3 feature review (generator per-room slack, or message wording) |
| 4 | QA obs. 4: unmet "next to each other" pairs in 9 % of random layouts (none on the sample); the warning names the rooms but gives no hint of what helps | PM / Designer, F3 feature review (hint text); F3-T2's editor restores walls by snapping |
| 5 | QA obs. 5: no circulation rule; a room can be enclosed by others (A-8 accepted for a block mockup) | PM, F3 feature review (known limit to tell the client) |
| 6 | QA obs. 6: room sizes on stage 3 are the generated ones (within 25 %), not the requested ones, and the stage-2 "needed" total differs from what the plan adds up to; not explained on screen | PM / Designer, F3-T2 (a line on stage 3, or the readout showing "asked / drawn") |
| 7 | TL rider for F3-T2: Designer review of the phone stage-3 panel (sample strip, readouts, message line, action row), aiming at ≥ 14 px/m at 360x640; editing needs the room | Designer with FS, F3-T2 plan |
| 8 | The 0.5 m snap is rejected for about 4 % of layouts (QA: 1 911 of 2 000 on the grid); such plans have off-grid edges until edited | Accepted (A-8 step 7); F3-T2's editor snaps on release |
| 9 | F1 real-device gate still OPEN (`docs/04-feature-reviews/F1.md`); stage 3 is the first screen the client will judge on a phone | PM / client, at the republish after this task |
