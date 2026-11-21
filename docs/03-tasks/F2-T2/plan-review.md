# F2-T2 plan review — Tech Lead

## Round 1 — 2026-11-20

Reviewed `docs/03-tasks/F2-T2/plan.md` (sections 1–11) against the F2-T2 block and the riders table of `F2-plan.md`, `architecture.md` (A-4 valid-values-only state, A-6 drawing of the setback zone, A-7 gate, A-15 controllers / site preview / fit control), stories F2-S1 and F2-S3, R4, R5, and the stage 2 hooks in `tests/contract/`. Reading only; no test runs (QA is using the machine for its three consecutive full runs).

### Assessment
The plan is complete for the task and consistent with the architecture.
- **Binding rule** (section 2) is exactly A-4: render from state, commit on the control's commit event only, invalid text stays in the field with `aria-invalid`, an `invalidFields` entry and a `field-invalid` conflict, and nothing reaches the state. "Commit only when the text differs from what was rendered" correctly prevents a display-rounded value from overwriting a stored one (10 ft stays 3.048 m).
- **Gate usage per question** matches the R5 table: `propose` for Q2, Q3, Q6, Q7; `commit` for Q4, Q5, Q8, Q9, Q10, Q15–Q17; Q1 with `keepSample` (rider).
- **Units**: one render on a unit switch, no commit of any length; ceiling slider attributes rewritten in ft and converted on commit.
- **Preview**: frame L with the street at the bottom, exact setback shading (A-6), footprint, parking, pool, edge classes, compass; locked view without pan/zoom or fit button (rider); Q6 by edge tap and Q5 by compass drag, each with a button alternative.
- **Summary and conflicts** come straight from `PC.validate`; "Fix" collapses the phone sheet first (rider).
- **Riders**: all five that belong to this task are in (unit change keeps the sample; snap-only readout from constants; locked preview; Fix collapses the sheet; own-confirmation path for level removal). The publishing gate is correctly left to the PM / coordinator; I will not approve this task's outcome before the client's phone observations are recorded in `docs/04-feature-reviews/F1.md`.
- **Tests**: the 16 e2e scenarios cover every F2-S1 / F2-S3 criterion reachable in this task, both units, R5 with real signatures, and the riders.

### Rulings on section 11
1. **`ui/q-fields.js` — approved.**
2. **Q7 lowered while rooms sit on the removed level — the plain confirmation, as proposed.** "The First floor has 3 rooms. They will be deleted." (Delete / Cancel), then `commit`; when that level has a valid plan the text also says its floor plan will be lost (one dialog, A-7). It is about ten throwaway lines, marked with a comment; pulling the three-way dialog forward would drag the move rules and the 8-room limit into this task. F2-T3's plan must list its replacement.
3. **"n questions left" — approved as defined**: questions in the current group and in groups not yet opened, session only. No schema change.
4. **Third floor without rooms can only be undone by going back to two floors until F2-T3 — accepted as interim.**
5. **Preview keeps `touch-action: none`; no Designer change.** On phone and tablet the preview sits in its own grid row outside the questions scroller, so a drag on it would not scroll the questions with `pan-y` either; in the two-column layouts it is in the side column. See condition 3 for the mouse wheel.
6. **Buildable area as "what the shading leaves free" — approved.** That is the A-6 technique and F2-S1 only asks that it is drawn; the legend's "Setback" and "Footprint" entries are enough.
7. **Vegetation not drawn in the preview — approved** (no positions before F4-T3; area and % are in the summary).
8. **Next on stage 2 disabled until F3-T1 — accepted as interim**; tests raise `MAX_BUILT`.
9. **Live slider feedback — approved, with a measured rule instead of a later judgement**, see condition 1.
10. **Q5 readout wording — approved** ("0° · toward the back", "45° clockwise from the back").

### Conditions (binding; checked at the implementation review)
1. **Live preview cost is bounded by measurement.** At most one `PC.site.analyse` per animation frame during a slider or compass drag; the controller times each transient analysis, and when one takes more than 50 ms it stops live updates for the rest of that drag (value label still follows; preview and summary update on release). No device sniffing, no plot-size threshold.
2. **Whole-number fields** (`q-parking-cars`): a non-integer ("1.5") is invalid like any other bad entry; the limit text for counts has no unit.
3. **`View2D` `locked`**: no pan, pinch, wheel zoom or view keys, but taps, `hitTest` and handle drags work, and the **wheel event is not consumed** (no `preventDefault`), so a mouse wheel over the preview still scrolls the column it sits in. `locked` and `draw2d.setbackZone` stay generic (no stage 2 knowledge in the shared files).
4. **Rooms group stays inert and harmless**: until F2-T3 its static controls have no handlers, cause no errors when touched, and nothing in it is rendered from state. No banner on stage 2 (A-15).
5. **`keepSample` is not a second `nav`**: a `keepSample` commit notifies, autosaves and behaves like any other commit except for leaving `sampleClean` alone; only the unit change uses it.
6. Focused run while developing as stated; the full `node tests/run-all.mjs` must be green three times in a row at hand-over (the parallel runner made timing matter; no fixed sleeps in the new spec, A-16).

### Non-blocking notes
- The plot readout will read "GRID · Snap 0.5 m" because the `<dt>` is static. Acceptable; if the Designer touches stage 1 again, the caption can become "Snap".
- With the stage 2 controller registered the "static preview" banner disappears while the Rooms group is still static for one task. Accepted; F2-T3 follows directly.
- After an R5 Cancel on a slider, make sure the transient view state is dropped too, not only the control value.

VERDICT: APPROVED
