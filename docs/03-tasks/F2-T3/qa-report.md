# F2-T3 QA report — QA Tester

## Round 1 — 2026-11-20

Scope: both increments of F2-T3, tested against the Tech Lead's 15-item "QA focus list" (end of `impl-review.md`, Increment 2 Round 2), stories F2-S2, F2-S3 and F2-S4, PM 3.1 / 4.3 / 6.2, and client decisions CD-1 and CD-2. Build: current tree, `dist/index.html` about 300 kB.
- **Increment 1:** narrow-plot footprints (A-6 step 4b and the long-side cap), edge-class overrides (tap mode, edge list, clearing, R5) and draft v2.
- **Increment 2:** the room list (Q11–Q14, pairs, the remove-level dialog).

### What I tested and how
- **New suite `tests/qa/f2-t3-site-rooms.mjs`** (runner `tests/qa/run-f2-t3.mjs`; `--no-shots`, `--only=N,A,…`; about 110 s; no fixed sleeps): 1134 checks at 360x640 touch, 640x360 touch, 768x1024 touch and 1280x800 mouse.
  - **Real input:** touch taps, CDP touch drags, keyboard typing with Enter (the phone keyboard's Go), Tab / Enter / Space in the edge list, and mouse at 1280x800. Native `<select>` pickers are set with `selectOption`, which fires the same `change` event. The only state set directly is test setup: a plot to start from, seeded valid plans, a few extra rooms.
  - **Expectations come from my own model, not the app's:**
    - `f2-t1-ref.mjs` now includes step 4b and the long-side cap;
    - my own automatic edge classes and `edgeOv` invariant check;
    - my own room naming rule ("Bedroom 1, Bedroom 2"; one "Master bedroom") and 4.2 area table;
    - my own counts for the 8-room and 6-pair limits;
    - my own reading of which floor plans each choice destroys.
  - After every action the full stage-2 sync check from F2-T2 runs. It is now shared in `tests/qa/stage2kit.mjs`; I refactored it out of `f2-t2-questions.mjs`, which is still 948/0.
  - A new room-list check compares every group count, row name, area, control, master switch, exact field and pair text with the state.
- **Mutation check:** 8 mutations, each on a throwaway copy, all caught:
  - street edge toggled in Back / side mode;
  - second label pass removed;
  - stale invalid-area purge limited to deleted rooms;
  - room names unnumbered;
  - 6-pair move limit removed;
  - reset notice always saying "outline";
  - wrong accessible name on the edge switches;
  - step 4b stretch disabled.
- **Screenshots** in `tests/qa/shots/F2-T3/`, all looked at:
  - Rooms group: empty, sample, full level, list rows in ft, pairs, and the remove-level dialog;
  - preview in both tap modes for the sample, a thin plot and the 12-vertex comb, in m and ft, at all 4 viewports;
  - 4b examples, the edge list with focus, and the second-pass layout.
- **Full run `node tests/run-all.mjs`: exit 0 in 464.7 s.**
  - lint: 0 violations;
  - unit: 283/0;
  - e2e: contract 4, fit-button 42, edges 379, plot 512, rooms 232, questions 932, site-legend 120, shell 587, site-tapmode 195, start-card 14, summary-fit 456, all with 0 failed;
  - QA: F1-T1 173 + 2015, F1-T2 816 (the draft-v2 branch now live), F2-T1 1139 (step-4b branch), F1-T3 1022, F2-T2 948, F2-T3 1134 (2 KNOWN hits of bug 1), all with 0 failed.

### Results per focus item
| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Footprint 4b | PASS | Seven examples in m and ft at 360x640 and 1280x800, each exact. For every clamped one, exactly one `fp-clamped` row, carrying the area and % in the current unit; no footprint above its target.<br>• 10 x 50 m at 30 %: 6 x 18 m, proportion wording with "6.0 × 18.0 m";<br>• 50 x 10 m: 15 x 5 m;<br>• 20 x 30 m at 80 %: 16 x 24.5 m, setbacks wording;<br>• 10 x 20 m at 80 %: 6 x 15 m;<br>• 10 x 50 m at 20 %: 6 x 16.5 m, no warning;<br>• 10 x 50 m at 24 %: 6 x 18.5 m, proportion wording;<br>• pentagon (6 / 5 / 4, 25 %): 22.5 x 7 m.<br>The summary and preview agree with my model at every step. In node, the 100 x 100 m comb runs `analyse` in under 500 ms at 30 % and at 80 % (best of 3). The F2-T1 suite also compares every generated lattice case with my 4b model (`tests/qa/f2-t1-site.mjs`, round-4 branch). |
| 2 | Overrides by touch / mouse | PASS | Tap mode is visible and defaults to Street. It resets to Street on entering stage 2 and on Load sample.<br>Every non-street edge, on the sample (4 edges) and on the 12-vertex comb (11 edges), at 360x640, 640x360 and 1280x800:<br>• one tap gives my "other" class and a `*` label;<br>• a second tap restores automatic, with no `*` left.<br>The street edge shows the toast and changes nothing. A tap on the footprint centre changes nothing. The page never scrolls or zooms.<br>Sample with all 4 overridden: "front" and four `*` labels, no overlap, none over the control, toggle or compass. The legend mark is shown at 1280x800 only (hidden on the phone and with the short-landscape legend).<br>Scales: 4.13 px/m in both modes at 360x640; 3.60 / 3.60 at 640x360; 7.21 / 7.14 at 1280x800 (class mode 1 % smaller, within the TL's 2 %). |
| 3 | Keyboard / no canvas | PASS | At 1280x800 and 360x640, in m and ft:<br>• every row matches my number, length, class and accessible name ("Edge 3, 12.0 m, back: make side"; "(set by you)" when overridden);<br>• the street row has no switch;<br>• Tab from the list toggle reaches the first switch, and the drawing highlights that edge (`siteFocusEdge`);<br>• Enter switches and Space switches back, with focus kept.<br>With back 5 / sides 1 and valid plans, Enter on the angled edge asks R5; Esc restores the state and focus returns to the same switch. The edge list open passes the layout checks (44 px targets and the rest). |
| 4 | Live effect and R5 | PASS | Sample with back 5 / sides 1: switching the angled edge to side changes the buildable area; switching it back restores the summary, level rows and conflict rows exactly.<br>Default setbacks with valid plans: no edge switch asks. Back 5 / sides 1: R5 asks exactly when my model's footprint size changes and names Ground and First; Cancel restores the state, removes the `*` and shows no notice.<br>Each clearing trigger was tested with 2 overrides and valid plans: Q6 next, Q6 tap in Street mode, corner drag on stage 1, Undo (reopen) and Clear. Each gives at most one dialog and exactly one notice with the right reason ("street edge changed" / "outline changed"). Resume, Load sample and Start new give none. |
| 5 | Invariant attack | PASS | After every operation above and after Resume / Start new / Load sample / level removal, my A-4 check of `edgeOv` passes: empty unless closed, only valid non-street indices, never equal to the automatic class. |
| 6 | Draft v2 | PASS | An override survives a unit switch, group changes, stage 1 and back, and reload + Resume (full sync each time); it is saved as v2 with the override. A unit switch keeps Skip to 3D; making an override removes it. Migration, v1 + v2, Start new with v1, the bad `edgeOv` drafts and normalisation are covered by `tests/qa/f1-t2-flows.mjs`, round-4 branch (now live, green). |
| 7 | Second last-resort label pass | **Reached; kept as a test** | Two layouts reach it at all three viewports:<br>• a 30 x 30 m plot with a 1 m corner staircase, 9 edges overridden;<br>• a small 9 x 9 m plot with steps.<br>Proof that the pass ran: labels overlap, which only that pass allows. The check: "front" and every `*` label are still drawn, and none lies over the control, toggle or compass. Removing the pass (mutation) loses 1–2 `*` labels per layout, so **the pass is needed and stays**. |
| 8 | Add form | PASS | Level choices are the existing levels only. Size hints match 4.2 in m and ft (kitchen S, majlis L, maid's room M). Exact "200" sq ft stores 18.5806 m². Enter in the exact field adds nothing and opens nothing. Count steppers stop at 1 and 8, and a typed count of 9 is refused. A 9th room on a full floor, and 3 rooms where only 1 fits, are refused inline with nothing stored. Exact "abc", "2", "200" (m²) and empty are refused with the 4–80 m² range and no dialog. Count 2 bathrooms adds two, numbered by my rule. |
| 9 | Rows | PASS | Type, size and exact-area edits follow live in the list and the summary. Switching to Exact keeps 24 m². Focus stays on the edited control. A level change drops the room's pairs with "Its pairs were removed." A move to a full floor is refused with a message, and the control returns to its level. One master per house. An invalid exact area is cleared by S/M/L and by deleting the room (no ghost conflict). |
| 10 | Pairs | PASS | B lists exactly the other rooms of A's floor. A duplicate gives "That pair already exists." The 7th pair on a floor is refused with "already has 6 pairs". Deleting a room removes its pairs. Self and cross-level pairs cannot be picked. |
| 11 | Q14 | PASS | Exactly five positions. With valid plans, a position change asks R5 (Cancel restores) and the lift asks (Continue stores). Later changes in the visit do not ask. The "single level" note shows exactly when my stairs rule says none (1 floor; then with basement, usable roof, and 2 floors). |
| 12 | Removing a level | PASS | At 360x640, 640x360 and 1280x800:<br>• 3 → 2 floors, 2 rooms + 1 pair on the Second floor, no plans: Move is offered and chosen, the empty plans paragraph is hidden; Cancel keeps the floor; Remove moves both rooms and their pair to the First floor; one dialog.<br>• With valid plans, 4 + 4 rooms and 5 + 1 pairs: Move is enabled by my count. Move names the First and Second floor plans; Delete names only the Second ("lost").<br>• With 6 + 1 pairs: Move is disabled with "more than 6 pairs" and Delete is chosen. Remove leaves a valid v2 draft.<br>F2-T2 section E covers the 8-room refusal on the sample. |
| 13 | Room conflicts | PASS | `floor-empty`: Fix opens Rooms with the add form set to the Second floor and focused; adding a room clears it live. `basement-empty`: the same, for the Basement. `level-over` with an exact 80 m² room shows my needed and available figures in m and ft; Fix focuses the Ground floor's first row control; shrinking the room clears it live. |
| 14 | Sample | PASS | Rooms, pairs and stair equal 6.2 (`sampleProblems`). |
| 15 | Every viewport | PASS, except bug 1 | Layout checks at 4 viewports: Rooms empty, sample and full level, preview in both tap modes for sample / thin / 12-vertex in m and ft, the dialog, and the edge list. Clean logs in every session. |

### Bugs

**1. Minor — In ft, "Master bedroom" is cut off ("Master bed…") in its room row at 360x640 and 640x360.**
- The row header holds the name, "258 sq ft", the Master button and delete. The name gets 107 of the 129 px it needs. It is also cut at the default L size, not only at 80 m². In m, and at 768 / 1280, it fits.
- See `tests/qa/shots/F2-T3/M-rooms-list-ft-360x640.png`.
- My layout checks did not catch it (they do not include `<strong>`); a dedicated check now does.
- **Suggested fix (Designer, CSS):** let the name wrap, or put the area under the name on narrow rows.
- Marked KNOWN in the suite.

### Review of the FS's `rooms.spec.mjs` and `edges.spec.mjs` (gaps)
1. Neither spec runs at 768x1024.
2. `rooms.spec`:
   - no 7th-pair refusal;
   - no move refused by the 6-pair limit (the refusal text is not asserted);
   - no plans sentence compared per choice (Move vs Delete).
3. No check that room-row text fits in ft on a phone: bug 1.
4. The second last-resort label pass is not exercised (as the TL recorded); my section F now does.
5. Names, counts and the dialog's plans are compared with app strings or app helpers. That proves consistency; my suite checks them against an independent rule and count.

### Observations: correct by the rules, but an architect may be surprised (for PM / TL / Designer)
1. **Crowded short edges.** With many short overridden edges (a 1 m staircase corner), the always-drawn `*` labels pile on top of each other and are unreadable (`F-second-pass-360x640.png`). The edge list stays readable. This is the TL's accepted known limit, also reached with 9 edges, not just 11; for Designer F5-T3.
2. **Footprint area label on narrow footprints.** On the 12-vertex comb in ft, "1582 sq ft" is drawn across the footprint's edges and wider than the building (as F2-T2 observation 4); for Designer F5-T3.
3. **1280x800 drawing scale.** The drawing is 1 % smaller in Back / side mode, even with no overrides, because the hint line takes height. It is accepted within 2 %. The round-2 ruling text ("with overrides present, street mode is the smaller one") does not match what I measure; the 2 % bound is what I test.
4. **"Move" costs more plans than "Delete".** When a floor is removed, "Move" also regenerates the floor that receives the rooms (its plan may have been approved minutes ago); "Delete" loses only the removed floor's plan. The dialog's sentence changes with the choice and says so ("regenerated or lost" vs "lost"), but an architect may not expect that keeping the rooms costs an approved plan elsewhere. For the PM at the F2 feature review.
5. **Rooms reach the limits fast.** The sample already has 7 of 8 rooms on each floor, so adding the 8th fills it, and "3 more" is refused with "1 more fits". This is correct (4.3 limits); the PM may judge whether 8 per floor suits villas.

### Verdict
All 15 focus items pass. Item 7 is answered: the second label pass is reachable and needed, and is now a test. One minor display bug remains (KNOWN). The client's CD-1 and CD-2 behave as decided on a phone: narrow plots get the 3:1 building with a wording that names the limit, and every back / side edge can be switched by touch or by the list, with the choice kept in the draft.

Round 1 addendum (2026-11-20): bug 1 fixed and confirmed. In ft, "Master bedroom" at an exact 80 m² is shown in full (nothing cut off) at 360x640 and 640x360, by my own check. KNOWN entry removed; `node tests/run-all.mjs --qa --only f2-t3` exit 0 (1134/0).

VERDICT: PASSED
