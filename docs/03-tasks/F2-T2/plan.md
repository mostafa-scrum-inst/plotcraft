# F2-T2 implementation plan — questionnaire Q1–Q10 and Q15–Q17, site preview, summary and conflicts (FS)

Scope per `F2-plan.md` F2-T2 and its riders. Stories F2-S1 (Q11–Q14 controls arrive in F2-T3), F2-S3 (display, blocking, live clearing); R4; R5 dialog for Q2, Q3, Q6, Q7. Binding: A-4 (valid-values-only state), A-7 (gate), A-15 (controllers, site preview without pan/zoom), the stage 2 hooks in `tests/contract/`.
All rules already exist as pure code from F2-T1 (`PC.site`, `PC.validate`, `PC.levels`, `PC.sig`, the gate). This task is controllers on the Designer's static markup. No markup or CSS change is planned.

## 1. Files

| File | Responsibility |
|---|---|
| `src/js/ui/stage-questions.js` (new) | `PC.ui.stages.questions`: stage 2 controller; group tabs, Continue buttons, progress; one binding table for all controls; render from state. |
| `src/js/ui/q-fields.js` (new, see Q1) | Reusable control bindings: numeric text field with stepper, slider with value, radio group, switch. Carries the transient-invalid behaviour. |
| `src/js/ui/q-preview.js` (new) | Site preview on `site-canvas` (frame L), Q5 compass and Q6 edge picking. |
| `src/js/ui/summary.js` (new) | Summary numbers, per-level rows, conflict and warning rows, "Fix" navigation, sheet toggle. |
| `src/js/ui/view2d.js` (edit) | Option `locked: true`: no pan, pinch, wheel or keys; taps and handle drags still work. |
| `src/js/ui/draw2d.js` (edit) | `edgeLabels` passes the edge index to its formatter (edge class names); `setbackZone(view, pts, setbackOf)`. |
| `src/js/core/store.js` (edit) | `commit(mutator, { keepSample: true })` (rider). |
| `src/js/core/frames.js` (edit) | `northToW(state, degL)` and `northStep(state, dir)` (pure). |
| `src/js/core/units.js` (edit) | `stepLen(unit)` (0.5 m / 1 ft), `fmtDims(w, d, unit)` ("3.0 × 6.0 m"). |
| `src/js/ui/shell.js`, `stage-plot.js` (edit) | Header unit toggle uses `keepSample`; grid readout becomes "Snap 0.5 m" / "Snap 1 ft" from `PC.C.GRID` (riders). |
| `src/js/main.js`, `src/manifest.json` | Register the controller (the static-preview banner then disappears on stage 2). |
| `tests/unit/store.test.mjs`, `frames.test.mjs`, `units.test.mjs` (extend) | Section 9. |
| `tests/e2e/questions.spec.mjs` (new); `shell.spec.mjs`, `plot.spec.mjs` (adjust for the riders) | Section 9. |

`PC.stages.MAX_BUILT` stays 2 (stage 3 arrives with F3-T1).

## 2. Binding rule (valid-values-only, A-4)

Every control is one row of a table: `{ hook, q, read(state), write(draft, value), gate: 'propose' | 'commit', kind }`.
- **Render** writes the state value into the control. Exception: a field that is registered invalid keeps the user's text.
- **Commit event only** (`change`; for text fields blur or Enter; for steppers the button tap). Sliders also fire `input`: that updates the value label, preview and summary from a **transient view state** (state copy with the pending value) and commits nothing.
- **Invalid text** (empty, not a number, out of range): the field gets `aria-invalid="true"`, its `-err` line shows "Enter a number from 0.0 m to 20.0 m", the entry is put in `PC.store.session.invalidFields` (shape fixed in F2-T1) and the shell re-renders, so `PC.validate` reports `field-invalid` and stage 2 is not valid. Nothing is committed. A valid entry removes the registration and commits.
- A text field commits only when its text differs from what was last rendered, so merely leaving a field never rewrites a stored value (10 ft stays 3.048 m although it shows as "3.0" in metres).
- After an R5 Cancel the store notifies once and every control is rendered back to the stored value (also the focused one).

| Q | Hook(s) | Control | Stored as | Through |
|---|---|---|---|---|
| 1 | `q-unit`, header `unit-toggle` | radios | `ans.unit` | `commit` with `keepSample` (rider) |
| 2 | `q-setback-front / -back / -side` + `-dec`, `-inc`, `-unit`, `-err` | numeric text, stepper 0.5 m or 1 ft | metres, 0–20 | `propose` |
| 3 | `q-footprint`, `-out`, `-err` | slider 10–80, step 1 | percent | `propose` on release |
| 4 | `q-veg`, `-out` | slider 0–80 | percent | `commit` |
| 5 | `q-north-ccw`, `-cw`, `-reset`, `-value`; compass in the preview | steps of 15 degrees | `ans.north` (null = default) | `commit` |
| 6 | `q-street-prev`, `-next`, `-value`; edge tap in the preview | edge index | `ans.streetEdge` | `propose` |
| 7 | `q-floors`, `q-basement`, `q-usable-roof` | radios, switches | as A-4 | `propose` (see Q2 for rooms on a removed level) |
| 8 | `q-ceiling`, `-out`, `-unit` | slider | metres, 2.4–4.5 | `commit` |
| 9 | `q-roof`, `q-roof-note` | radios | `ans.roofType` | `commit` |
| 10 | `q-exterior` | radios | `ans.exterior` | `commit` |
| 15 | `q-parking-cars` + `-dec`, `-inc`, `-err`; `q-parking-covered` | whole number 0–4; switch | as A-4 | `commit` |
| 16 | `q-pool`, `q-pool-size`, `q-pool-size-note` | switch, radios | as A-4 | `commit` |
| 17 | `q-wall`, `q-gate`, `q-seating` | switch, radios, switch | as A-4 | `commit` |

Details:
- **Q7 usable roof on with Pitched**: the same mutator calls `PC.validate.normaliseRoof`; when it switched to Flat, `q-roof-note` is shown until the user next picks a roof. Pitched is `disabled` while usable roof is on.
- **Q16**: size radios are `disabled` while the pool is off (the stored size is kept).
- **Q5 readout**: "0° · toward the back" at the default, otherwise the angle relative to the back of the plot, e.g. "45° clockwise from the back". Reset stores `null`.
- **Q6 readout**: "Edge 2 · 30.0 m" in the current unit.

## 3. Units (R4)

- Display and entry always through `PC.units`; stored values are metres.
- Unit switch = one render: `-unit` suffixes, field texts, error texts and limits, `q-pool-size-note` ("S 3.0 × 6.0 m · …" / "S 9.8 × 19.7 ft · …"), summary, preview labels. No commit of any length happens on a unit switch.
- Setback steppers: 0.5 m in m, 1 ft in ft; the result is snapped to that step and clamped to 0–20 m.
- Ceiling slider (markup is in metres): in ft mode `min`, `max`, `step` are rewritten to 8.0, 14.5, 0.5 ft; the thumb shows the stored height rounded to the step; only a user `change` commits (converted to metres). Back in m: 2.4, 4.5, 0.1.
- Typed values: "10" in ft mode stores 3.048.

## 4. Groups, progress, navigation

- Four tabs in brief order (Site, Building, Rooms, Outdoor); `aria-selected` on tabs, `hidden` on `q-group-*`. `btn-q-continue-*` opens the next group; the last group uses Next in the action bar. The Rooms group shows the Designer's static content until F2-T3.
- Current group is session state (kept when leaving and re-entering the stage, reset by a whole-state replace).
- Progress: "Group 2 of 4 · 11 questions left"; left = questions in the current group and in groups not opened yet (17 at the start; 6, 4, 4, 3 per group). The bar value is 17 minus that. Session only (Q3).

## 5. Site preview (`q-preview.js`)

`View2D` with `locked: true`, world = frame L (u to the right, v up), so the street is always at the bottom. Fitted to the plot's L bounding box on every resize and every data change; no pan, zoom or fit button (rider). Registered as `View2D.named.site` for `PC.debug.toScreen('site', u, v)`. Data: `PC.site.analyse(viewState)`.

Drawn in this order, colours and line styles from `PC.data.palette2d`:
1. Plot fill.
2. Setback zone, exact (A-6): clip to the plot polygon, stroke each edge with round caps at line width 2 × setback × scale in `setback.fill`. What stays unshaded is the buildable area.
3. Footprint (`footprint` fill and stroke) with its area label; nothing when there is no footprint.
4. Parking (dashed, `parking`) and pool (`pool`) when placed.
5. Plot edges by class: front thick in `edge.front`, back in `edge.back`, sides dotted in `edge.side`; one label per edge ("front", "back", "side") through `draw2d.edgeLabels`, which already handles borders and short edges.
6. North: a compass dial (radius 22 px) in the top right corner of the canvas, arrow at `PC.frames.northL`, with "N".
- **Vegetation is not drawn**: it has no positions before the scatter of F4-T3; its effective area and % are in the summary (Q4).

Interaction:
- **Q6, tap an edge**: the nearest edge within 22 px (touch, pen) or 10 px (mouse) of the tap -> `propose(streetEdge = i)`. The drawing then turns so the new street edge is at the bottom. Keyboard and no-pointer alternative: `q-street-prev` / `q-street-next`.
- **Q5, drag the compass**: the dial is a handle (`hitTest`); the arrow follows the pointer in 15-degree steps while dragging (transient), stored on release (`commit`). Alternative: `q-north-ccw` / `q-north-cw` / `q-north-reset`. From the default, the first step starts at the default direction rounded to 15 degrees (`PC.frames.northStep`).
- `site-preview-toggle`: `is-collapsed` on `site-preview` + `aria-expanded`; open by default.

## 6. Summary and conflicts (`summary.js`)

- From `PC.validate(viewState)`: `sum-plot` "584 m²", `sum-buildable` "389 m²", `sum-footprint` "143 m² · 24.4 %", `sum-veg` "146 m² · 25 %"; one `tpl-sum-level` row per plan level "120 m² / 143 m²"; all in the current unit.
- `conflict-list`: one `tpl-conflict` row per item, blocking first, `data-kind="block" | "warn"`, text from `PC.validate`. `sum-status`: "All clear", "2 to fix", "1 warning", "2 to fix · 1 warning"; `data-kind` of `summary` = `block`, `warn` or `ok`.
- **Fix** (`conflict-goto`): collapse the sheet first (rider), open the group of the item's question, scroll its `[data-q]` block into view, focus its first control.
- Sheet toggle: `is-collapsed` + `aria-expanded`. It never opens by itself; the status text on its toggle row is always visible.
- Next: enabled only when stage 2 is valid and stage 3 reachable (unchanged shell rule). Conflicts clear without reload because everything is recomputed on each render.

## 7. R5 confirmation (already wired; verified here)

Handler = `PC.ui.dialog.confirm` (set at boot). Appears when a `propose` from Q2, Q3, Q6 or Q7 (or a plot edit) would make at least one **currently valid** plan stale; once per visit to stages 1–2. Title "Regenerate floor plans?"; text "Floor plans for Ground floor, First floor will be regenerated. Manual room edits and approvals on those levels will be lost."; buttons Continue / Cancel. Cancel: the control shows the old value again. A change that only moves the footprint, and every appearance answer, never asks. No plans exist in the product before F3-T1, so the e2e seeds plans with real signatures.

## 8. Phone layout concerns

- 360x640, Site group: preview (about 200 px) + tabs + summary toggle leave about 200 px for questions; the preview toggle collapses it. No element is added to the layout.
- The summary sheet overlays the stage and scrolls inside (F1-T1 fix); "Fix" closes it before scrolling, so the target question is not hidden behind it.
- Numeric fields use `inputmode="decimal"`; when the on-screen keyboard shrinks the viewport, the focused field is scrolled into view (`scrollIntoView({ block: 'nearest' })` on focus).
- Short landscape (640x360): the Designer's two-column layout; the preview is 200 px high there, and the fit keeps the plot whole.
- The preview canvas has `touch-action: none`; with `locked` a one-finger drag on it does nothing, so the questions column cannot be scrolled by dragging on the preview (Q5).
- Compass dial and edges have 44 px targets; the dial sits clear of the edge labels (passed to `edgeLabels` as `avoid`).

## 9. Tests

**Unit**: `commit(..., { keepSample: true })` keeps `sampleClean`, any other commit clears it; `northStep` (from the default on an axis-aligned and on a slanted street edge, wrap at 360) and `northToW` round trip with `northL`; `stepLen`, `fmtDims` in both units.

**E2E `questions.spec.mjs`** at 360x640 touch, 768x1024 touch, 1280x800 mouse (sample for most cases; plans seeded with real signatures where needed; `MAX_BUILT = 5` where Next must enable):
1. Stage 2 opens without the static-preview banner; controls show the 4.1 defaults on a hand-made plot and the 6.2 values on the sample; Q18–Q19 are not on this stage.
2. Group order, tab and Continue navigation, progress text and bar; question headings equal the brief.
3. Every numeric text field has `inputmode="decimal"`.
4. Setback: type 4 -> stored 4, preview footprint and summary change; stepper; in ft type 10 -> stored 3.048, field shows "10.0"; unit switch converts every shown value and stores nothing.
5. Invalid entry ("", "abc", "-1", "25"): error text with limits in the current unit, `aria-invalid`, state unchanged, conflict row "… enter a number from …", Next disabled; fixing it clears all of that without reload; invalid text survives a re-render.
6. Sliders: dragging shows live value, preview and summary; state changes only on release; ceiling slider in ft has 8.0–14.5 step 0.5 and stores metres.
7. Q6: tap each edge of the sample in the preview (coordinates from `PC.debug.toScreen('site', …)`) -> `streetEdge`, classes and footprint follow; prev/next buttons do the same; a tap far from any edge does nothing.
8. Q5: cw / ccw step 15 degrees, reset gives `null`; compass drag by touch and mouse lands on a multiple of 15 and commits on release only.
9. Q7 / Q9: usable roof on with Pitched -> Flat, note shown, Pitched disabled; off again enables it.
10. Each blocking condition reachable here (third floor without rooms, buildable under 20 m², building does not fit, footprint % + vegetation % over 100, invalid field): row text, status, Next disabled, then cleared. Each warning (clamped footprint, vegetation reduced, parking omitted, pool omitted) with its effective numbers. Sample: "All clear", no rows.
11. Fix: with the sheet open on the phone, Fix closes it, opens the right group, the question is inside the viewport and focused.
12. R5: seeded valid plans; setback change that alters the size asks once, Cancel restores the field and the state object, Continue applies and the next change does not ask; back setback 2 -> 2.25 m does not ask; Q10 never asks; Q6 by edge tap asks.
13. Riders: unit switch by header toggle and by `q-unit` keeps "Skip to 3D" on the sample; any other answer removes it; plot stage readout reads "Snap 0.5 m" / "Snap 1 ft" and never contradicts the scale chip at three zoom levels.
14. Persistence: answers survive group changes, stage 1 and back, and reload + Resume.
15. Preview: no pan or zoom (drag, pinch, wheel leave `PC.debug.view('site')` unchanged; pinch only on touch); fitted after resize and after a street-edge change; labels front/back/side present for long edges; page does not scroll or zoom while touching it.
16. Every scenario: layout assertions (no page scroll, 44 px targets, bar in view), zero page errors, console errors, native dialogs, extra requests.

`shell.spec.mjs` / `plot.spec.mjs`: the two expectations that the riders change (unit toggle no longer removes Skip; grid readout text). `node tests/run-all.mjs` green; focused run while developing: `node tests/run-all.mjs --unit --e2e --only questions`.

## 10. Acceptance map

| Criterion | Where | Test |
|---|---|---|
| F2-S1 four groups in order, brief texts, Q18–Q19 absent | static markup + tabs | e2e 1, 2 |
| F2-S1 defaults from 4.1; progress | render from state; section 4 | e2e 1, 2 |
| F2-S1 phone-suited inputs, numeric keypad, unit shown and converted | `q-fields`, section 3 | e2e 3, 4, 6 |
| F2-S1 Q5 and Q6 by pointing at the preview; edges labelled; buildable and footprint live with Q2, Q3, Q6 | `q-preview` | e2e 4, 6, 7, 8 |
| F2-S1 Q9 Pitched rule with inline note | `normaliseRoof` + note | e2e 9 |
| F2-S1 Q17 gate Left / Centre / Right | radios | e2e 1 |
| F2-S1 answers persist | store + draft | e2e 14 |
| F2-S3 live summary | `summary.js` | e2e 4, 10 |
| F2-S3 blocking: Next disabled, message names question and fix | `PC.validate` rows + shell | e2e 5, 10 |
| F2-S3 warnings with effective numbers | rows | e2e 10 |
| F2-S3 clears without reload | recomputed per render | e2e 5, 10 |
| R4 | `PC.units` everywhere | e2e 4, 6, 13 |
| R5 for Q2, Q3, Q6, Q7 | gate + dialog | e2e 12 |
| Riders (sample stays unmodified on unit change; snap readout; preview locked; Fix collapses the sheet) | sections 1, 5, 6 | e2e 11, 13, 15 |

Not in this task: Q11–Q14 controls and the room-related conflicts' fixes (F2-T3); the F1 publishing gate (PM / coordinator).

## 11. Risks and questions for the Tech Lead

1. **Extra file `ui/q-fields.js`** (field bindings) beside the three in the F2 plan, to keep `stage-questions.js` under 300 lines. OK?
2. **Q7 lowered while rooms sit on the removed level** (the default project has rooms on the first floor). The move / delete / cancel dialog is F2-T3, but the state may never hold a room on a missing level. Proposed for this task: a plain in-page confirmation "The First floor has 3 rooms. They will be deleted." (Delete / Cancel) followed by `commit` (own confirmation, so no gate question, A-7); F2-T3 replaces it with the three-way dialog. Alternative: pull the three-way dialog forward into this task. Which?
3. **Progress "n questions left"** has no definition in the story (every question has a default). Proposed: questions in the current group and in groups not yet opened, session only (starts again at 17 after a reload). OK, or should it be stored (schema change, `DRAFT_V` 2)?
4. **Adding a third floor in this task leaves a blocking "no rooms" conflict that can only be fixed by going back to two floors**, because rooms are added in F2-T3. Interim; fine?
5. **One-finger drag on the preview does not scroll the questions** (canvas has `touch-action: none`). On the phone the preview is about a third of the stage. If you would rather let the page scroll there, the canvas needs `touch-action: pan-y` (a one-line CSS change for the Designer) and the compass drag keeps working because the dial captures its pointer. Decide.
6. **Buildable area is shown as "what the setback shading leaves free"**, with no outline of its own: A-6 gives the exact shading technique but no exact buildable polygon. The legend has no "Buildable" entry either. OK?
7. **Vegetation is not drawn in the preview** (no positions before F4-T3); only its area and % appear in the summary.
8. **Next on stage 2 is always disabled in the shipped build until F3-T1** (`MAX_BUILT = 2`), so "Next disabled while blocking" is only observable in tests that raise `MAX_BUILT`. Accepted as interim?
9. **Live slider feedback runs `PC.site.analyse` per animation frame** on a candidate state (about 25 ms for the sample, up to about 80 ms on the largest plot). If that feels heavy on a phone I will update the preview on release only for plots above a size threshold; to be judged at the hosted check.
10. **Q5 readout wording** ("45° clockwise from the back") is mine; the Designer's placeholder only shows the default case.
