# F2-T3 — Rooms, edge-class overrides and narrow-plot footprints: outcome

Owner: FS. Step 3f.

The task was planned once for both increments (CTO D4).
- **Plan:** `plan.md`, approved with 8 rulings and 6 conditions (`plan-review.md`). Designer pre-step D was reviewed separately (`designer-D-review.md`, approved).
- **Implementation reviews** (`impl-review.md`):
  - increment 1: changes requested in round 1, approved in round 2;
  - increment 2: changes requested in round 1, approved in round 2.
- **QA:** `qa-report.md`, passed.

No code was changed in this step.

## 1. What was built

### Increment 1 — site (client decisions CD-1 and CD-2; draft v2)
- **Narrow-plot footprints (CD-1, A-6 step 4b and step 8).** This runs only when the step-4 footprint is clamped. Unclamped results and the 6.2 sample are byte-identical.
  - **Candidates:**
    - (a) the step-4 result, stretched along its long side in 0.5 m steps up to `min(3 × short, target / short)`, when it is at its 2:1 limit;
    - (b) the 3:1 and the 1:3 proportions, each by steps 3–4 literally: the centred try first, and the fallback lattice search only when the centred result keeps less than half the target or rounds under 20 m².
  - **Winner:** the largest area. Ties keep the step-4 result, then the stretch, then 3:1, then 1:3. Never above the target.
  - **Pruning:** the searches start their running best at the current winner's area. Results are identical; the test-only `PC.site.T.noPrune` proves it.
  - **Long-side cap after rounding (step 8):** the long side is at most `limit × (short + 0.5 m)`, with limit 2 for step-4 results and 3 for the 4b candidates. A longer side is shortened about the same centre.
  - **`clamped` after 4b:** true unless the long side equals `floor05(target / short)`, so rounding alone is never a clamp.
  - **`footprint.reason`:**
    - `'proportion'` when the long side is at least 3 × short − 0.5 and the same rectangle 0.5 m longer would still fit;
    - otherwise `'setbacks'`.
  - **`fp-clamped`** has two wordings. The proportion wording names the 3:1 limit, with dimensions through `fmtDims` ("6.0 × 18.0 m").
  - New constant `PC.C.FOOTPRINT_STRETCH_RATIO = 3` (PM 4.3).
- **Edge-class overrides (CD-2, F2-S4).**
  - `ans.edgeOv` maps an edge index to `'back'` or `'side'`.
  - The site model has `edgeAuto` (the 40-degree rule) and `edgeClass` (the class in effect); the memo key includes `edgeOv`.
  - `PC.site.toggleEdge` is used through `propose` (R5). Overrides are not in the signature: they act through the setbacks.
  - **Clearing:** a store normaliser, `PC.site.clearOvIfOutlineChanged`, runs in `commit` and on the gate's candidate. It empties `edgeOv` when a point moves, the point count changes, `closed` changes or the resolved street edge changes. The gate therefore judges the combined change: one dialog at most.
  - **UI:**
    - tap mode Street / Back-side; it resets to Street on entering stage 2 and on a whole-state replace;
    - a toast for a tap on the street edge;
    - `*` labels; the street and overridden labels are always drawn, never over the tap-mode control, the collapse toggle or the compass;
    - the drawing is kept clear of those three, with an 8 px touch margin for the two page controls;
    - the Q6 edge list (`q-edges.js`) gives the keyboard / no-canvas alternative: rows updated in place, full accessible names ("Edge 4, 8.9 m, back: make side"), and the focused edge highlighted in the drawing;
    - one reset notice ("…because the outline changed" / "…the street edge changed") that never shows on a replace or a Cancel.
- **Draft v2.**
  - `PC.DRAFT_V = 2`, and `PC.draft.KEYS` lists the v2 then the v1 key.
  - A v1 draft is migrated (no overrides). Strict `edgeOv` checks: no override on the street edge, an index out of range, an unknown value, or an open plot. An entry equal to the automatic class is dropped.
  - Every key access goes through `ui.storage` (`readDraft`, `writeDraft`, `removeDraft`). Start new, a discarded draft, Load sample over a draft and an emptied state remove every key.

### Increment 2 — rooms (F2-S2, Q11–Q14)
- **Add form:**
  - type, floor (existing levels only), size S / M / L / Exact;
  - the size hint and the exact-area range shown in the current unit; exact area typed in m² or sq ft and stored in m² to 4 decimals;
  - count 1–8 with steppers.
  - Refusals are inline in `room-msg`, e.g. "The First floor has 7 rooms: 1 more fits (8 per floor)."
- **Room list:**
  - grouped by plan level, "n of 8" per group, auto names;
  - rows edited in place, with focus restored if the list is rebuilt;
  - a row's exact area works like the other number fields (marked invalid, a conflict row, nothing stored); its entry is purged when the room is deleted, set back to S / M / L, or its level removed;
  - one master bedroom per house, offered on bedrooms only;
  - a move to another floor drops the room's pairs and says "Its pairs were removed."
- **Pairs (Q13):**
  - the second list offers only rooms on the first room's floor;
  - a duplicate shows "That pair already exists."; the 7th pair on a floor is refused;
  - deleting a room removes its pairs.
- **Q14:** stair position and lift go through `propose`. The box is shown only when stairs exist; otherwise "Single level: no staircase needed."
- **Removing a level that has rooms** (Q7, or the basement switched off): one dialog with move / delete / cancel (`tpl-level-remove`).
  - `level-remove-text` holds the question.
  - `dialog-text` holds the floor-plans sentence from `PC.store.affected` for the chosen option; it is recomputed when the choice changes and hidden when empty.
  - "Move" is disabled with a one-line reason when the target would pass 8 rooms or 6 pairs; "delete" is then preselected.
  - Remove commits once, never two dialogs. This replaces F2-T2's interim plain dialog.
- **Fix on room conflicts** (TL binding note from the F2-T2 outcome review):
  - `floor-empty` and `basement-empty` set the add form to that floor and focus Type;
  - `level-over` focuses that floor's first room.
- **Enter:** its default action is cancelled on every new text field (F2-T2 bug 1 lesson).

## 2. Files

| File | Change |
|---|---|
| `src/js/core/const.js` | `FOOTPRINT_STRETCH_RATIO: 3` |
| `src/js/core/ns.js` | `PC.DRAFT_V = 2` |
| `src/js/core/site.js` | `edgeAuto`, overrides in `edgeClass`, memo key with `edgeOv`, `toggleEdge`, `clearOvIfOutlineChanged`, `T.noPrune` (test only) |
| `src/js/core/site-footprint.js` | step 4b (`narrow`), pruning (`beat`), step 8 cap, `reason` |
| `src/js/core/validate.js` | `fp-clamped` proportion wording |
| `src/js/core/store.js` | `defaults()` with `v: 2`, `edgeOv: {}`; the normaliser in `commit` and in the gate |
| `src/js/core/draft.js` | v2 schema, v1 migration, normalisation, `KEYS` |
| `src/js/core/levels.js` | room helpers, `removeLevels`, `removalQuestion`, `plansSentence` |
| `src/js/ui/storage.js` | `readDraft`, `writeDraft`, `removeDraft` |
| `src/js/ui/start.js` | draft read and removal through those |
| `src/js/ui/q-preview.js` | tap mode, forced labels, overlay clearance in `fit`, focus highlight, overlays ignore `visibility: hidden` |
| `src/js/ui/q-edges.js` (new) | Q6 edge list |
| `src/js/ui/q-rooms.js` (new) | Rooms group and the remove-level dialog |
| `src/js/ui/stage-questions.js` | wiring: tap mode, notice, Q14, `setLevels` → q-rooms dialog, level-aware Fix |
| `src/js/ui/dialog.js` | empty `dialog-text` hidden |
| `src/manifest.json` | + `q-edges.js`, `q-rooms.js` (32 scripts) |
| `tests/unit/` | new `rooms.test.mjs`; `footprint`, `site`, `signature`, `storage`, `store`, `validate`, `draft` extended (283 tests) |
| `tests/e2e/` | new `edges.spec.mjs` (379) and `rooms.spec.mjs` (232); `questions.spec` (932), `shell.spec` (587), `plot.spec` (512) updated for v2 and the dialog |

Designer files (pre-step D and fixes, CSS / markup / contract): `src/index.html` (D hooks), `src/css/41-stage-questions.css`, `tests/e2e/site-tapmode.spec.mjs`, `tests/contract/`.

QA files: `tests/qa/` (version-aware updates, step 4b and cap in `f2-t1-ref.mjs`, new `f2-t3-site-rooms.mjs`, `stage2kit.mjs`).

## 3. Public APIs later tasks reuse

**Site model**
- `PC.site.analyse(state)` → `site` has `edgeAuto[]`, `edgeClass[]` (in effect) and `footprint.reason` (`'proportion' | 'setbacks'`, only when `clamped`).
- Footprints can now be up to 3:1, plus less than one 0.5 m step after the cap. F3-T1's generator sweep must cover them (F3 plan).
- `PC.site.toggleEdge(draft, i)` returns `false` for the street edge, an index out of range or an open plot. It removes an entry equal to the automatic class.
- `PC.site.clearOvIfOutlineChanged(prev, next)` is called by the store. A new mutator needs nothing extra.
- `PC.site.T.noPrune`: test only.

**Store**
- `commit` and `propose` run the normaliser on the candidate after the mutator, before the no-op test and `affected`; `replace` does not.
- `PC.store.affected(candidate)` is the source of every own-confirmation dialog's plan sentence: F2-T3 uses it, and F3-T2's Clear dialog must too.

**Drafts**
- `PC.DRAFT_V` is 2; `PC.draft.KEY`, `PC.draft.KEYS` (current first).
- `parse` migrates v1. Any later schema bump adds its key to `KEYS` and a migration step.
- `ui.storage.readDraft() / writeDraft(text) / removeDraft()` is the only way to touch draft keys.

**Levels (pure; they change the draft, return `{ ok, reason, … }`, and touch nothing when they refuse)**
- `addRooms(d, { type, level, size, area, count })`; `updateRoom(d, id, patch)` → `pairsDropped`; `removeRoom(d, id)`.
- `setMaster(d, id, on)`: one master per house.
- `addPair(d, a, b)` → `dup`, or refused with `'self' | 'levels' | 'max'`; `removePair`; `pairsOn(state, level)`.
- `nearestLevel(gone, remaining)`; `moveRooms(d, from, to)`, refused with `'full' | 'pairs'`.
- `removeLevels(d, change, 'move' | 'delete')` → `{ ok, gone, roofSwitched }`.
- `removalQuestion(state, gone, to, refused)` and `plansSentence(hit, gone)`: texts.
- `ORDER`.

**UI**
- `ui.qrooms`: `init()`, `render(state)`, `removeLevel(change, gone)` (returns a promise of the result, or `false` on Cancel).
- `ui.qedges`: `init({ toggleEdge })`, `render(state)`.
- `ui.qpreview`: `focusEdge(i | null)`; its api gains `tapMode()`, `toggleEdge(i)`, `streetTapped()`.

**`PC.debug`** (A-2): `siteFocusEdge()`, `tapMode()`.

## 4. How to verify
1. `node build.mjs && node tests/run-all.mjs` exits 0.
   - Focused run: `node tests/run-all.mjs --unit --e2e --only questions,edges,plot,shell,rooms`.
   - QA's suite alone: `node tests/run-all.mjs --qa --only f2-t3`.
2. **Narrow plot:** in the console, commit a 10 × 50 m plot at 30 %. The summary shows 108 m² and the warning reads "The building is limited to 6.0 × 18.0 m …".
3. **Overrides:** sample, stage 2, tap Back / side, tap the 8.9 m edge. It reads "side*" and the legend shows "* set by you" (from 600 px wide). Drag a corner on stage 1: the notice "…because the outline changed" appears once.
4. **Rooms:** open the Rooms tab, set Exact, type 200 in ft and press Enter, then Add. Then Building → 1 floor on the sample: "move" is disabled ("…more than 8 rooms"), Remove deletes the rooms.

## 5. QA sign-off
- **QA round 1: PASSED** (`qa-report.md`).
  - New suite `tests/qa/f2-t3-site-rooms.mjs`: 1134 checks at 360x640 touch, 640x360 touch, 768x1024 touch and 1280x800 mouse.
  - Expectations come from QA's own model (4b and the cap, edge classes, naming, counts, plans per choice).
  - 8 source mutations, all caught.
  - Full run exit 0 in 464.7 s:
    - unit 283;
    - e2e: contract 4, fit-button 42, edges 379, plot 512, rooms 232, questions 932, site-legend 120, shell 587, site-tapmode 195, start-card 14, summary-fit 456;
    - QA: F1-T1 173 + 2015, F1-T2 816, F2-T1 1139, F1-T3 1022, F2-T2 948, F2-T3 1134.
- **Bug 1 (minor, Designer, CSS):** "Master bedroom" is cut off in its row in ft at 360x640 and 640x360. It is KNOWN in QA's suite; the Designer is fixing it now.
- **Second last-resort label pass:** QA reached it (corner staircase plot; small stepped plot) and proved it is needed (removing it loses 1–2 `*` labels). It stays, as a QA test (TL ruling 2 of increment 1 round 2).
- **FS mutation checks:**
  - increment 1: 14 planned, plus round 2 (cap, cap without +0.5, area label first, hidden legend counted);
  - increment 2: 8 planned, plus the stale-entry purge.

  All caught. Two needed stronger tests, and the gate test was tightened. Two are only caught in combination, both accepted:
  - row rebuild together with focus restore;
  - both `closed` clauses of the normaliser.

## 6. Tech Lead rulings
**Plan review (round 1, 8 rulings):**
1. Store-level normaliser (in `commit` and on the gate candidate, not on `replace`).
2. QA-first, version-aware sequence for QA's files, with 3 more files added to the list.
3. `T.noPrune` test flag.
4. `fmtDims` "6.0 × 18.0 m" in the proportion wording.
5. Move into a full level: disabled with a reason, delete preselected.
6. Forced labels for the street then overridden edges, never over the overlays.
7. One master per house.
8. Tap mode resets on stage-2 enter and replace.

Conditions: Enter default cancelled on every new text field; all key access through `ui.storage`.

**Designer pre-step D: approved.** Binding:
- `overlays()` includes the tap-mode control and the hint;
- `edges.spec` asserts the outline and the "front" label uncovered at 3 viewports, and the sample at ≥ 4.0 px/m at 360x640.

**Increment 1, round 1: changes requested.**
1. Long-side cap after rounding (A-6 step 8).
2. Forced labels before the area label, with a free spot preferred.
3. Scale assertions (360x640 ≥ 4.0; 640x360 ≥ 3.5 and equal in both modes; 1280x800 within 2 %).
4. Green full run.

Rulings:
- literal steps 3–4 for 3:1 / 1:3 accepted;
- clearing the collapse toggle and the compass in `fit()` accepted (A-15);
- 640x360 hint hidden in short landscape (Designer);
- Designer spec fix: street switch `hidden`.

**Increment 1, round 2: approved.**
- 1280x800 legend wrap with overrides accepted (Designer F5-T3).
- Second pass deferred to QA (now proven needed).
- 12-vertex all-overridden overlaps accepted as a known limit (Designer F5-T3).

**Increment 2, round 1: changes requested** (stale `room-area-<id>` entries). Rulings:
- wording split between `level-remove-text` and `dialog-text`;
- double protection on row rebuilds;
- the Fix focus fix;
- QA updates its 4 section-E checks;
- non-blocking: hide an empty `dialog-text`.

**Increment 2, round 2: approved.** Non-blocking: assert empty `invalidFields` at the start of each stale case.

## 7. Client decisions as delivered
- **CD-1 (narrow plots up to 3:1 when clamped):** delivered as A-6 step 4b plus the step 8 cap. Every PM / CTO example is exact. The warning names the limit only when the limit is what stops the building. The sample is unchanged.
- **CD-2 (architect overrides back / side):**
  - Delivered by tap (explicit tap mode) and by keyboard / list.
  - Overrides are saved in the draft and marked `*`.
  - They are cleared when the outline changes or is reopened, or when Q6 changes (TL rule), with a single notice.
  - They go through R5, so one dialog at most even when combined with the clearing.
- **CD-3:** non-goal, nothing built.

## 8. Known limits, tech debt and observations

| # | Item | Owner / when |
|---|---|---|
| 1 | QA bug 1: "Master bedroom" cut off in ft on phones | Designer, now (CSS, in parallel) |
| 2 | My specs do not run at 768x1024 (`rooms.spec`, `edges.spec`) | FS, F3-T1 spec work (QA's suite covers it meanwhile) |
| 3 | `rooms.spec` has no 7th-pair refusal and no move refused by the 6-pair limit (text not asserted) | FS, when `rooms.spec` is next opened (F3-T1); covered by QA section 10 / 12 and by `rooms.test` |
| 4 | `rooms.spec` does not compare the plans sentence between Move and Delete | FS, same time; covered by `questions.spec` (basement case) and QA item 12 |
| 5 | My specs compare names, counts and dialog plans with app strings / helpers (consistency, not independent correctness) | Accepted; QA's model is the independent check |
| 6 | Non-blocking TL note: assert `invalidFields` empty at the start of each stale-area case | FS, next time `rooms.spec` is opened |
| 7 | Observation 1: with many short overridden edges (corner staircase, 9–11 edges) the always-drawn `*` labels pile up on a phone; the edge list stays readable | Designer, F5-T3 label-crowding review (TL known limit) |
| 8 | Observation 2: the footprint area label is wider than narrow footprints (comb in ft) | Designer, F5-T3 |
| 9 | Observation 3: at 1280x800 the Back / side drawing is 1 % smaller than Street even without overrides (the hint line takes height); the TL's round-2 text said this happens only with overrides. Within the 2 % bound that is tested | TL: correct the wording in `impl-review.md` if wanted; the 2 % guard stays |
| 10 | Observation 4: "Move" also regenerates the receiving floor's plan, while "Delete" loses only the removed floor's; the dialog sentence says so | PM, F2 feature review |
| 11 | Observation 5: the sample already has 7 of 8 rooms per floor, so the 8-room limit is reached quickly | PM, F2 feature review (4.3 limit) |
| 12 | 1280x800 legend with the "* set by you" entry wraps to a second row, so street mode becomes the smaller drawing when overrides exist (~1 %) | Designer, F5-T3 |
| 13 | F3-T1's generator must be proven on footprints up to 3:1 plus a rounding step (6 × 18, 15 × 5, 6 × 18.5, 4 × 12.5) | FS, F3-T1 (F3 plan) |
| 14 | **F1 real-device gate still OPEN** (`docs/04-feature-reviews/F1.md`). The tap mode, edge list and room rows add to what only a real phone confirms | PM / client, at the F2 feature review |
