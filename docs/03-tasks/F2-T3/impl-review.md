# F2-T3 implementation review — Tech Lead

## Increment 1 (site), Round 1 — 2026-11-20

### What I did
- Read in full: `core/site-footprint.js` (step 4b, pruning, `clamped`, `reason`), the override parts of `core/site.js` (`edgeAuto`, memo key, `toggleEdge`, `clearOvIfOutlineChanged`), `core/store.js` (normaliser in `commit` and on the gate candidate), `core/draft.js` (v2 checks, `migrate`, `KEYS`), `ui/storage.js` (`readDraft` / `writeDraft` / `removeDraft`), the key calls in `ui/start.js`, `ui/q-preview.js` (`forcedLabel`, focus highlight, draw order), `ui/q-edges.js`.
- Looked at `docs/03-tasks/F2-T3/shots/` (street / class at 360x640, 640x360, 1280x800).
- Own probes (no full run; QA works in `tests/qa/`; the FS's focused run is green and its full run fails only on the two items below):
  - node: QA's pentagon with setbacks 6 / 5 / 4 at 25 %: app gives 23 x 7 m (161 m²), identical with `T.noPrune = true`.
  - Chrome, sample, stage 2, at 360x640 touch, 640x360 touch and 1280x800 mouse: switch to "Back / side" by tapping the control; tap the midpoints of the four non-street edges; read `edgeOv`, `siteLabels()` and `view('site').scale`; then Q6 next.
- Probe results:
  - All four taps toggle the edges at every viewport: `{"1":"back","2":"side","3":"side","4":"back"}`.
  - Q6 next clears the overrides. One toast: "Back / side choices were reset because the street edge changed".
  - No page errors.
  - Scale in street / class mode: 360x640 4.13 / 4.13 px/m; 1280x800 7.21 / 7.14; 640x360 **3.60 / 2.00**.
  - **At 640x360 three pairs of labels overlap** (screenshot `class-640x360.png`: "side*" printed over "143 m²"). 360x640 and 1280x800 have none.

### Findings
**Core: correct.**
- Step 4b follows A-6.
  - Stretch only at the 2:1 limit.
  - 3:1 and 1:3 by literal steps 3–4 (centred first; fallback search only when not enough), with `beat` pruning that cannot change a result: an unrounded area at or below `beat` cannot round above it.
  - Winner and tie order as written.
  - `clamped` from `floor05(A / short)` for every result once 4b ran (PM sentence).
  - `reason` from the PM test.
- Overrides.
  - `edgeAuto` is today's rule; `edgeClass` takes the override.
  - The memo key carries `edgeOv`.
  - `toggleEdge` refuses the street edge, an out-of-range index and an open plot, and drops entries equal to automatic.
  - The normaliser runs in `commit` and on the gate candidate before the no-op test and `affected`: ruling 1 of the plan review as approved.
- Draft v2.
  - Strict `edgeOv` checks; v1 migrated only when both versions are 1 and `edgeOv` is absent.
  - `KEYS` is the single list.
  - Every access goes through `ui.storage` (`removeDraft` removes all keys; the first v2 write removes the older ones).

**UI: correct, with two layout defects.**
- Covered as planned: tap mode (reset on enter and replace), street-edge toast, `*` labels, `q-edges` rows updated in place with full accessible names ("Edge 3, 8.9 m, back: make side"), focus highlight, reset notice ignoring replace / cancelled.
- Defect: **forced labels can overlap other labels** (640x360).
- Defect: **the 640x360 site drawing is too small in "Back / side" mode** (2.0 px/m: the two-line hint at the bottom plus the control at the top leave about 100 px of height).

### Rulings on the five questions
1. **A-6 rounding (QA F2-T1 1137/1): cap the long side, do not reword the bound loosely.**
   - Rule (A-6 step 8, amended): after the final rounding, the long side is at most `limit x (short side + 0.5 m)`, where `limit` is 2 for the step-4 proportions and 3 for the 4b candidates. When it is longer, it is shortened about the same centre to `floor05(limit x (short + 0.5))`.
   - Nested rectangles, so the result still fits. Area only goes down, so the target is never exceeded.
   - Why this form: it is exactly QA's existing property check, so no round-3 (2:1) result changes (QA's 543 footprints already satisfied it). It turns the pentagon's 23 x 7 m into 22.5 x 7 m (157.5 m², still clamped, reason `proportion`). The 2.5 m-wide case (2.5 x 8.5) is inside it and unchanged.
   - FS implements it in `site-footprint.js` (unit cases: the pentagon; one 2:1 clamped case at the bound). QA mirrors it in `f2-t1-ref.mjs`.
   - **PM text change (route to the PM):**
     - 3.1, CD-1 bullet: replace "The final sides may exceed the 2:1 or 3:1 limit by less than one 0.5 m rounding step (as in A-6 step 8)." with "Because width and depth are each rounded down to 0.5 m, the proportions can be slightly beyond 2:1 or 3:1, but the long side is never more than 2 (or 3) times the short side plus 0.5 m."
     - 4.3 "Footprint proportions" row: replace "Plus less than one 0.5 m rounding step" with "long side at most 2 (or 3) x (short side + 0.5 m) after rounding".
     - No example or the sample changes.
2. **FS's literal "steps 3–4" for 3:1 / 1:3** (centred try first; fallback search only when the centred result is not enough or under 20 m²): **accepted.** It is what A-6 says and what QA's model does. Running the search always was the earlier, wrong reading.
3. **`fit()` also keeps clear of the collapse toggle (8 px touch margin) and the compass: accepted.**
   - Beyond my binding, but right: Chrome's touch adjustment snapped an edge tap 2 px from the toggle onto the toggle and collapsed the preview.
   - A-15 records it.
4. **640x360 scale: Designer change.** At short landscape the hint is not shown at all.
   - The "Back / side" segment being selected already shows the mode (F2-S4 "current choice always shown").
   - The meaning of `*` is in the Q6 edge list ("set by you"), which sits in the left column there.
   - The legend is already hidden in that layout.
   - Result: both modes draw at the street-mode scale (3.6 px/m today), and nothing else in that layout changes.
5. **Designer's `site-tapmode.spec.mjs` 182/5: Designer change.** The spec empties `q-edges` before appending its 12 template rows (the app now fills the list). It also asserts the FS's choice for the street row, which is accepted: its switch is `hidden`, not `disabled`, because a disabled "Make …" label on the street edge says nothing useful. Pre-step D's "no enabled switch" is met.

A-2 debug list gains `PC.debug.tapMode()` and `PC.debug.siteFocusEdge()`.

### Designer change (CSS + spec)
- **Where:** `src/css/41-stage-questions.css`, in the short-landscape block `@media (max-height: 480px) and (orientation: landscape) and (max-width: 899px)`:
  - `.pc-taphint, .pc-preview.is-collapsed > .pc-taphint { display: none; }`
  - It must win over the earlier `.pc-preview.is-collapsed > .pc-taphint { display: block; }` rules (same or higher specificity, later in the file).
  - No markup, hook or contract change. `hidden` is still toggled by the FS; the CSS only stops it rendering in this layout.
- **Optional:** join "* = set by you" with non-breaking spaces in the markup (my earlier non-blocking note).
- **Spec (`site-tapmode.spec.mjs`):**
  - Empty `q-edges` before appending the 12 template rows (or use the app's own rows on a 12-vertex plot).
  - Assert the street row's switch is hidden.
  - At 640x360, with the mode set to "Back / side" by tapping the control: the hint has no rendered box, the canvas is still 200 px high, and nothing else in the layout changes.
- **Acceptance number (FS side, asserted in `edges.spec.mjs`):** at 640x360 the sample's `view('site').scale` is **3.5 px/m or more and equal in both modes**. At 360x640 it stays 4.0 or more; at 1280x800, class mode is within 2 % of street mode.

### Required changes (FS)
1. **Long-side cap after rounding** (ruling 1) in `site-footprint.js`, with unit cases (QA's pentagon 6 / 5 / 4 at 25 % gives 22.5 x 7 m, `proportion`; a 2:1 case at the bound unchanged). Mutation-check them.
2. **Forced labels never overlap another label when a free spot exists** (`q-preview.js`).
   - Place the street and overridden-edge labels **before** the footprint-area label. The area label then takes a free spot or is culled.
   - In `forcedLabel`'s last-resort pass, first try spots clear of the overlays **and** of placed labels. Only then accept a spot that is clear of the overlays alone.
   - Test in `edges.spec.mjs`: sample with all four non-street edges overridden, at 360x640, 640x360 (after the Designer change) and 1280x800. No two rectangles of `siteLabels()` intersect; "front" and the four `*` labels are all present.
3. **Scale assertions** of the Designer acceptance number above, in `edges.spec.mjs`.
4. Hand-over: the focused run, then **one full run exit 0**. It needs QA's model update for ruling 1 and the Designer's two changes in the same tree.

### Work per owner for my increment-1 approval
- **FS:** required changes 1–4.
- **Designer:** the short-landscape hint rule; the `site-tapmode.spec.mjs` fix (empty list, hidden street switch, 640x360 assertions).
- **QA:** `tests/qa/f2-t1-ref.mjs` applies the same long-side cap (A-6 step 8), so the pentagon case expects 22.5 x 7 m. The existing "3:1 plus one rounding step" property check stays as it is.
- **PM:** the two text replacements in ruling 1 (3.1 CD-1 bullet, 4.3 row).

### Non-blocking notes
- `toggleEdge` calls `PC.site.analyse` on the draft inside the mutator. Correct, because the memo key covers the draft's content; it runs twice per proposal (candidate and commit), which is cheap.
- `readDraft` takes the first key present. A corrupt v2 next to a valid v1 discards both. Acceptable: a v2 key only exists after a successful v2 save, which removed v1.

VERDICT: CHANGES REQUESTED

---

## Increment 1, Round 2 — 2026-11-20

### What I did
- Read the changes: the long-side cap in `site-footprint.js` (`lim` = 2, or 3 for the 4b proportions; `top = floor05(lim x (short + 0.5))`), the label order and last-resort passes in `q-preview.js`, the overlay fix (a legend hidden by `visibility` no longer counts as covering the canvas), the Designer's short-landscape rule and spec fix, QA's model update.
- Own re-probes: node, QA's pentagon (6 / 5 / 4, 25 %): **22.5 x 7 m, 157.5 m², clamped, `proportion`**, identical with `T.noPrune`. Chrome, sample with all four non-street edges overridden by touch / mouse taps:
  - 360x640: 4.13 / 4.13 px/m in street / class mode, 0 overlapping label pairs;
  - 640x360: **3.60 / 3.60**, 0 overlapping pairs (the area label is culled; "front" and the four `*` labels are drawn);
  - 1280x800: 7.21 / 7.14, 0 overlapping pairs.
- Evidence of runs: the FS focused run is green, and its full run exits 0 in 368.5 s with every suite at 0 failures (QA's model agrees with the app on the cap; check 3c added; KNOWN entry removed). I did no full run of my own because QA is in the tree.

### Required changes from round 1
| # | Status |
|---|---|
| 1 Long-side cap | Resolved (pentagon 22.5 x 7; the 2:1 cases at or near the bound are unchanged; unit test and mutation checks of the cap and of "cap without +0.5") |
| 2 Forced labels before the area label; no overlap when a free spot exists | Resolved at the three viewports (my probe and `edges.spec`; mutation "area label first" caught) |
| 3 Scale assertions | Resolved, with the deviation below |
| 4 Focused + full run | Resolved |
| Designer: no hint in short landscape; spec fix | Resolved (`site-tapmode` 195/0) |
| QA: the same cap in the reference model | Resolved |
| PM: 3.1 / 4.3 rounding text | Done ("2 (or 3) x (short side + 0.5 m)", which matches A-6 step 8) |

### Rulings on the three open points
1. **1280x800: with overrides present, street mode is the smaller one** (the "* set by you" legend entry wraps the legend to a second row): **accepted.**
   - The difference is about 1 % (7.21 vs 7.14 px/m in my probe), at a scale far above the phone's.
   - The test asserting that Back / side is not the smaller mode is the right guard.
   - Keeping the ≥ 600 px legend on one line with the mark entry is deferred to **Designer, F5-T3** (polish list).
2. **Second last-resort pass not reached by any tested layout (mutation not caught): accepted for now; defer with owner QA, then FS.**
   - In its F2-T3 QA round, QA tries to construct a layout that reaches the pass, e.g. a short overridden edge whose free spots are all taken by other labels while an overlay-only-clear spot exists.
   - If QA finds one, it becomes a test.
   - If QA cannot, the FS removes the pass in increment 2 (dead code is not kept). Recorded here, so neither is forgotten.
3. **A 12-vertex plot with all 11 non-street edges overridden still shows 1–3 label overlaps on a phone: accepted as a known limit.**
   - It is an extreme case.
   - Every class stays readable as text in the Q6 edge list (the F2-S4 keyboard / no-canvas alternative).
   - F1-S2 already accepts culling or crowding of short-edge labels at phone scale.
   - Logged for **Designer, F5-T3** (label crowding review). The PM hears of it at the F2 feature review as a known limit, not as a decision.

### Required changes
None. **Increment 1 is approved: increment 2 (rooms) may start**, as one plan already reviewed (D4). QA tests F2-T3 once, after increment 2, increment 1 list first.

VERDICT: APPROVED

---

## Increment 2 (rooms), Round 1 — 2026-11-20

### What I did
- Read in full: the new `PC.levels` helpers (`addRooms`, `updateRoom`, `removeRoom`, `setMaster`, `addPair` / `removePair` / `pairsOn`, `nearestLevel`, `moveRooms`, `removeLevels`, `removalQuestion`, `plansSentence`), `ui/q-rooms.js` (add form, keyed rows, pairs, three-way dialog), and the stage-questions changes (Q14 through `propose`, Fix targets, Enter default).
- Did not run the full suite (QA is editing `tests/qa/`). FS evidence: focused run green (unit 283, rooms 220/0, questions 932/0). Full run exit 1 only on QA F2-T2 942/4: four section-E checks still assert the interim F2-T2 dialog; QA owns that update.
- Own touch probe (Chrome, sample, 360x640 touch, plus 640x360 for two cases):
  - **Add form.** In ft, an Office, Exact, "200" + Enter, then Add on the First floor. Stored 18.5806 m², no message; Enter did not trigger anything else.
  - **Ninth room.** Refused: "The First floor already has 8 rooms, the most per floor."; nothing stored.
  - **Three-way dialog.** 2 → 1 floor with 15 rooms: "move" is disabled with "They cannot be moved: the Ground floor would have more than 8 rooms. Delete them?"; Remove deletes them; one dialog.
  - **Health.** No page scroll, no horizontal scroll at 360 or 640, no errors.
  - **Layout.** The room list screenshot at 360x640 reads well: group header "7 of 8", name, area, three 44 px selects per row.

### Findings
**Helpers: correct.**
- Each helper refuses before touching the draft, and refusals are tried on a copy before anything is proposed (`attempt`).
- Ids come from `nextRoomId`.
- `updateRoom` drops pairs on a level change and reports `pairsDropped`.
- One master per house (ruling 7).
- `addPair`: self, cross-level and the 7th pair are refused; a duplicate is a no-op; pairs are stored in id order.
- `moveRooms` checks both the 8-room and the 6-pair limit.
- `removeLevels` = change, move or delete, `prune`, and the roof rule. The dialog builds a candidate per choice and recomputes the plans sentence from `PC.store.affected`. A refused move inside the final `commit` throws before the swap, so the state is untouched.

**Defect: a room's invalid exact-area entry outlives the field it belongs to.**
- The row's exact-area field registers `invalidFields['room-area-<id>']` (correct). Nothing removes that entry when the field goes away.
- Reproduced on the phone in two ways:
  - Type "abc" into a row's exact area, then delete that room. `field-invalid` stays, stage 2 stays invalid, and Fix has no field to go to.
  - On the sample's first room: Exact, "x", then size back to L. The same ghost entry stays.
- Removing a level with "delete" would leave the same ghost.
- The only way out is a reload or Load sample.

### Rulings on what was asked
1. **Wording split** (the room question in `level-remove-text`, the plans sentence in `dialog-text`): **accepted.** The question belongs next to the choice; the R5 consequence stays in the dialog's own text, as in every other R5 dialog.
   - Non-blocking: when there is no plans sentence, `dialog-text` renders as an empty paragraph. Hide it when empty.
2. **One master per house**: as ruled in the plan review; implemented in `setMaster`.
3. **Double protection on row rebuilds** (rows keyed by room id and rebuilt only when the list key changes, plus focus restore on rebuild): **accepted.** The mutation that only catches both together is fine, because each mechanism alone keeps focus.
4. **FS bug fix — Fix focused a hidden master checkbox, now the Type select:** **accepted**, correct.
5. **QA F2-T2 section E** (four checks asserting the interim dialog): QA updates them to the three-way dialog (room question in `level-remove-text`, plans sentence in `dialog-text`, button "Remove").

### Required changes (FS)
1. **Purge stale room-area entries.** In the Rooms render (or a store subscriber), delete every `invalidFields` key `room-area-<id>` whose room no longer exists or is no longer exact (`size !== null`), then re-render the shell.
   - Tests in `rooms.spec.mjs`, at 360x640 touch: an invalid exact area followed by (a) deleting the room, (b) switching its size to S / M / L, (c) removing its level with "delete". After each, no `field-invalid` row, and stage 2 is valid again.
   - Mutation-check them.
2. Hand-over: the focused run; then one full run, once QA's section-E update is in.

### Non-blocking notes
- Hide `dialog-text` when it is empty (ruling 1).
- The A-2 file table gains `q-edges.js` and `q-rooms.js` under the ui stage files (done below).

VERDICT: CHANGES REQUESTED

---

## Increment 2, Round 2 — 2026-11-20

### What I did
- Read the fix, `dropStale(s)` in `q-rooms.js`: a store subscriber registered before the shell's. It deletes every `room-area-<id>` entry whose room is gone or no longer exact. `dialog.js` now hides an empty text paragraph.
- Re-ran my round-1 probes:
  - Delete a room with an invalid exact area: no conflict, stage 2 valid.
  - Exact, "x", back to L, at 360x640 and 640x360: `invalidFields` empty.
- Mutation of my own: `dropStale` reduced to "room gone" only, then `rooms.spec.mjs`. **(b) "size back to S" fails**, so (b) is proven on its own. (c) "level removed" also fails, but only because (b)'s leftover entry is carried into it. (c) uses the same "room gone" branch that (a) proves. File restored byte for byte and rebuilt.
- Evidence: the FS's focused run is green (rooms 232/0). Its full run exits 0 in 381.5 s with every suite green, including QA F2-T2 948/0 after QA updated its four section-E checks.

### Required change from round 1
| # | Status |
|---|---|
| 1 Stale room-area entries | Resolved (cases a, b, c; mutation-checked by FS and by me) |
| 2 Runs | Resolved |

### Ruling on the sequence question
The three cases need no isolation now. (a) and (b) are each proven on their own, and (c) exercises the same branch as (a). Non-blocking: when `rooms.spec.mjs` is next opened, assert that `invalidFields` is empty at the start of each case, so a failure points at its own case.

FS's claim that `room-area-<id>` is the only dynamic `invalidFields` key holds in what I read: the edge list and pairs have no text inputs, and the add form reports in `room-msg`.

### Required changes
None. **F2-T3 is approved for QA** (both increments).

### For QA (F2-T3 focus; increment 1 first)
**Increment 1 — site (CD-1, CD-2, draft v2)**
1. **Footprint 4b.**
   - The PM / CTO / TL examples, exactly, in m and ft:
     - 10 x 50 m at 30 % gives 6 x 18 m, proportion wording;
     - 50 x 10 m gives 15 x 5 m;
     - 20 x 30 m at 80 % gives 16 x 24.5 m, setbacks wording;
     - 10 x 20 m at 80 % gives 6 x 15 m;
     - 10 x 50 m at 20 % gives 6 x 16.5 m, not clamped, no warning;
     - at 24 % it gives 6 x 18.5 m, proportion;
     - your pentagon (6 / 5 / 4, 25 %) gives 22.5 x 7 m.
   - Long-side cap `limit x (short + 0.5 m)` after rounding.
   - Never above the target.
   - Sample and unclamped cases byte-identical.
   - Comb at 30 % and 80 % under 500 ms.
   - Exactly one `fp-clamped` wording when clamped.
2. **Edge overrides by touch** at 360x640 and 640x360, and by mouse at 1280x800.
   - Tap mode is visible, defaults to Street, resets on stage-2 enter and on replace.
   - Every non-street edge of the sample and of a 12-vertex plot toggles and toggles back.
   - Tapping the street edge shows a toast and changes nothing.
   - `*` labels and the legend mark (not on phone portrait). Street and overridden labels are always drawn and never over the control, compass or toggle.
   - No label overlap on the sample with all four edges overridden at three viewports.
   - Scales: 360x640 ≥ 4.0 px/m; 640x360 ≥ 3.5 px/m and equal in both modes; 1280x800 Back / side not smaller.
   - No page scroll or zoom.
3. **Keyboard / no-canvas alternative.**
   - `q-edges` reachable by Tab; Enter / Space switch.
   - Focus highlights the edge in the drawing.
   - Accessible names, e.g. "Edge 3, 8.9 m, back: make side", in m and ft.
   - Focus kept after a switch and after an R5 dialog.
   - The street row has no switch.
4. **Live effect and R5.**
   - Sample with back 5 / sides 1: angled edge back → side → back restores every figure.
   - Equal setbacks never ask.
   - A size-changing switch asks once; Cancel restores the class.
   - The clearing triggers (corner drag, Undo/reopen, Clear, Q6 tap and next) with seeded plans: at most one dialog, one notice with the right reason, none after Load sample / Start new / Resume or a Cancel.
5. **Invariant attack.** After every plot and Q6 operation (incl. Start new and resume), `edgeOv` is empty unless the plot is closed, and holds only valid non-street indices.
6. **Draft v2.**
   - Overrides survive unit switch, groups, stages and reload + Resume.
   - A v1 draft resumes migrated.
   - With v1 + v2 stored, v2 wins.
   - v1, then Start new, then reload: nothing offered.
   - Bad `edgeOv` drafts are discarded.
   - An override equal to automatic is normalised.
   - Making an override removes Skip to 3D; a unit switch does not.
7. **Second last-resort label pass** (open item from increment 1, round 2). Try to build a layout that reaches it: a short overridden edge whose free spots are all taken by other labels while a spot clear only of the overlays exists (e.g. a small plot with several short overridden edges at 640x360 or 360x640). If you reach it, keep it as a test. If you cannot, say so in the report, and the FS removes the pass.

**Increment 2 — rooms (F2-S2)**
8. **Add form.**
   - Type, level (existing levels only), S / M / L with its area hint, Exact in the current unit (ft entry stored in m²).
   - Count 1–8 with steppers.
   - A 9th room refused inline, with nothing stored.
   - Bad text (letters, out of range, Enter / Go on the phone keyboard) never opens or answers a dialog.
9. **Rows.**
   - Names renumber per level and type; edits to type / level / size / exact area follow live in the summary.
   - A level change drops pairs with "Its pairs were removed."
   - One master per house.
   - An invalid exact area is cleared by delete / S-M-L / level removal (no ghost conflict).
   - Focus survives edits.
10. **Pairs.**
    - B lists only same-floor rooms.
    - Cross-level and self pairs impossible; duplicates give their message.
    - The 7th pair on a level is refused.
    - Deleting a room removes its pairs.
11. **Q14.** Five positions and lift through R5; "single level: no staircase needed" exactly when stairs do not exist (1 floor, no basement, no usable roof).
12. **Removing a level with rooms.**
    - Move / delete / cancel.
    - Move disabled with its reason at more than 8 rooms or 6 pairs.
    - The dialog names every affected plan per choice (`PC.store.affected`) and hides an empty plans paragraph.
    - One dialog; the state is a valid draft afterwards.
13. **Conflicts.** `floor-empty`, `basement-empty`, `level-over` (both numbers, both units). Fix lands on that level (add form or first row control). They clear live.
14. **Sample.** Rooms, pairs and stair equal 6.2 exactly.
15. **Every scenario** at 360x640 touch, 640x360 touch, 768x1024 touch and 1280x800 mouse: no page scroll, 44 px targets, clean logs.

VERDICT: APPROVED

---

## Erratum — 2026-11-20 (F2-T3 outcome review)
In Increment 1, Round 2, ruling 1 says that street mode becomes the smaller drawing at 1280x800 "with overrides present". QA's observation 3 shows that Back / side mode is about 1 % smaller at 1280x800 **also without overrides**, because the hint line takes height. Both cases are inside the tested 2 % bound, and the guard stays as it is. The one-line legend / hint tidy-up remains with the Designer for F5-T3.
