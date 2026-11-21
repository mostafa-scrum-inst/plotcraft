# F2-T2 implementation review — Tech Lead

## Round 1 — 2026-11-20

Reviewer: Tech Lead (new session; context rebuilt from the files on disk; same standard as the F1-T3 and F2-T1 reviews: code read, full run, own probe, mutation checks where the author did not do them, every stated invariant checked against every operation that can break it).

### What I did
- Read in full: `ui/stage-questions.js`, `q-fields.js`, `q-preview.js`, `summary.js`, `view2d.js` (the `locked` option and the 70 % fit cap), the new `draw2d.setbackZone` and the edge index passed to the `edgeLabels` formatter, `core/store.js` (`keepSample`), `frames.js` (`backW`, `northToW`, `northStep`), `units.js` (`stepLen`, `fmtDims`, `parseNum`), `levels.js` (`prune`), `shell.js`, `main.js`, the stage-plot readout, `41-stage-questions.css`, and `tests/e2e/questions.spec.mjs`.
- Full run: `node build.mjs && node tests/run-all.mjs` **exit 0 in 238 s**: lint 0; unit 248 / 0; e2e contract 4, fit-button 42, questions 595, plot 512, start-card 14, shell 554 (all / 0); QA F1-T1 169 + 1929, F1-T2 792, F1-T3 1022, F2-T1 1124 (2 KNOWN hits, the F2-T1 minors).
- **Mutation checks** (none recorded by FS), each restored and compared byte for byte, then rebuilt:
  1. `locked` wheel guard removed from `View2D._wheel` -> `questions.spec` fails 2 (wheel consumed; view zoomed). Good.
  2. "commit only when the text differs from what was rendered" removed from `q-fields.js` -> fails 3 (10 ft = 3.048 m rewritten to 3 m by a blur). Good.
  3. Q7 own dialog bypassed (plain `propose`) -> fails 3. Good, and the failure output shows the gate's own text naming **Ground floor and First floor** for the same change, which is required change 2 below.
- Screenshots viewed: `site-m`, `site-ft`, `site-edge2-north-ft`, `summary-conflicts-m`, `summary-conflicts-ft`, `building-ft`, `outdoor-ft` at 360 x 640; `site-m-1280x800`, `site-ft-640x360`, `site-edge2-north-m-768x1024`.
- Own probe in headless Chrome (`/tmp/tlprobe/p1–p4.mjs`, using `tests/helpers/`): real mouse drags of the sliders, 16 garbage / half-typed inputs, ft entry, steppers in both units, invalid + unit switch, Q7 lowered with seeded valid plans on both floors, basement removal with rooms, usable roof + Pitched with plans, R5 Cancel / Esc on a stepper, the wheel over the preview, Fix from the open phone sheet, every control of the inert Rooms group, the compass by touch, an edge tap on a short edge at 360 px, the slanted street edge, and the preview measured at 360 x 640 on the sample, a U-plot and a 10 x 50 m plot (as built and with a CSS mock-up of the legend change).

### Findings

**Binding and validation: correct.** One binding per control; the state receives only valid values (A-4). Garbage is held in the field with `aria-invalid`, an `invalidFields` entry and a `field-invalid` conflict: `abc`, empty, `1e2`, `0x10`, `Infinity`, `-1`, `25`, `20.0001`, Arabic digits all refused with "Enter a number from 0.0 m to 20.0 m." and nothing committed; `3,5`, ` 4 `, `+3`, `-0`, `3.`, `.5` accepted sensibly. ft entry: 10 -> 3.048 m, 65.6 -> 19.995 m, 65.7 -> refused. A half-typed "5." followed by "+" commits 5 on blur, then steps to 5.5. Steppers land on the 0.5 m / 1 ft lines in both units. Invalid text survives a unit switch with the error text in the new unit; a stepper tap clears the registration and commits. Cars: "1.5" and "5" refused, error without a unit (condition 2). R5 Cancel (button and Esc) restores the stepper field and leaves the state untouched.

**Preview, summary, riders: as planned, with three defects below.** Edge tap and prev / next set Q6 through `propose`; the drawing turns the new street to the bottom; the compass works by touch and mouse; the summary and conflict rows follow `PC.validate` live, in both units; Fix collapses the phone sheet, opens the group and brings the question into view (probe: focused control at y 412 of 640, above the sheet bar); `keepSample` keeps Skip on a unit change and is otherwise a plain commit; the plot readout says "Snap 0.5 m" / "Snap 1 ft". No page errors, console errors, native dialogs, requests or page scroll in any probe.

**Defect 1 (major): a slider dragged and released on its starting value stays "busy" for the rest of the session.** Chrome fires `change` only when the value differs from the value at pointer-down. `qfields.slider` sets `busy = true` on `input` and clears it only in the `change` handler, so after a drag that ends where it began (common: a user tries the slider and puts it back) the control never renders from state again, and the pending live value is never cleared. Reproduced with a real mouse:
- Q8: drag 3.0 -> 3.8 -> 3.0 m (10 `input`, 0 `change`), switch to ft: the slider keeps its metre attributes (`2.4 / 4.5 / 0.1`, value 3), so one ArrowRight stores **2.4 m** (the label says 7.9 ft); the user's 3.0 m ceiling is silently corrupted.
- Q3: same gesture, then any other change of `footprintPct` (Resume draft, Load sample, F2-T3 code, a later commit) leaves the slider and its label on the old value (state 40 %, slider 25 %), and `pending` keeps overriding what the preview and summary show.

**Defect 2 (major, R5): the "Remove level" dialog does not name every floor plan it destroys.** Q7 2 -> 1 floor with valid plans on Ground and First: the dialog says "…The floor plan of the First floor will be lost too.", then `commit` runs (correctly no second question), but the change also removes the stairs, so Ground's signature changes and its plan, edits and approval are lost without being mentioned (`plans.G` is kept but stale; probe: `sig` no longer matches). R5: an action with its own confirmation "mentions the loss of floor plans in that same dialog". The text lists only removed levels (`gone`) instead of the gate's affected set. The same gap applies to basement removal on a one-floor house (stairs disappear).

**Defect 3 (minor, visible): the Q5 readout prints raw floating point on a slanted street edge.** With the sample's 8.9 m angled edge as the street and one clockwise step: "11.565050999999983° clockwise from the back". `ans.north` is a W angle in 15-degree steps (A-4), so relative to a slanted street the angle is not a whole number; the readout must round.

**Phone preview readability (deviation 3; QA F2-T1 observations 4 and 8).** At 360 x 640 the canvas is 200 px high, the legend overlays its bottom 60 px in two rows, and `fit` keeps 26 px top and bottom for labels, so the sample is drawn at **3.05 px per metre (61 x 91 px)**, the footprint 29 x 46 px, the parking 15 x 15 px. Edge-class labels shown: "side", "side", "front"; **both back edges are unlabelled**. After a Q6 tap on the 8.9 m edge, the edge the user has just chosen carries no "front" label (25 px long; `edgeLabels` needs label width + 20 px). On a U-plot (house in one arm) three back edges are unlabelled; on a 10 x 50 m plot only "side" twice. An architect can still decode the drawing through the legend (front thick blue, back solid dark, side dotted), and the house position and area are readable on the U-plot, so QA observation 8 is met; observation 4 (understanding which edges are "back") is only half met. With the legend moved out of the drawing into one line under a 176 px canvas (my CSS mock-up, same 200 px total height, so the questions lose nothing), the sample draws at **4.13 px per metre (83 x 124 px, +35 %)** and the "back" label appears; all five legend entries fit on one line at 360 px. Decision: a **Designer change** (specified below) plus a small FS change that the street edge is always labelled.

### Conditions of the plan review
| # | Condition | Status |
|---|---|---|
| 1 | At most one `analyse` per frame during a drag; over 50 ms stops live updates for that drag | Met in code (`live()`: one rAF at a time, timed, `liveOff` until release); but release is never seen when `change` does not fire: part of defect 1 |
| 2 | Whole-number fields: "1.5" invalid, no unit in the limit text | Met (probe) |
| 3 | `locked`: no pan / pinch / wheel zoom / keys; taps, `hitTest`, handle drags work; wheel not consumed; shared files generic | Met (code, probe: `defaultPrevented` false, view unchanged; mutation 1). `setbackZone` and `locked` carry no stage 2 knowledge |
| 4 | Rooms group inert and harmless | Met: all 20 enabled controls clicked / changed at 360 and 1280: no state change, no error |
| 5 | `keepSample` is not a second `nav` | Met: notifies with `nav: false`, autosaves; only the two unit controls use it (grep) |
| 6 | Three green full runs at hand-over; no fixed sleeps | Partly: FS's three runs were identical but exited 1 on QA's pre-rider checks (expected; QA has since updated them). QA's run and mine are green on the final tree. The new spec has no fixed sleeps (it uses `settled`). Round 2 hands over with three green runs |

### Rulings on the FS deviations
1. **`PC.levels.prune` drops rooms, pairs and plans of a removed level in the same change: accepted.** It keeps the A-4 rule (the state never points at a missing level) and does what `PC.plans.sync` would do with the plans anyway. F2-T3's move / delete dialog must call it after moving rooms. Listed in A-2.
2. **`View2D.fit` pad cap raised from a third to 70 % of the canvas: accepted.** It only matters when a large pad meets a small canvas (the phone preview's legend allowance); the plot-stage change at 640 x 360 is a few pixels and all plot suites are green. After the Designer change the phone preview no longer needs the large bottom pad.
3. **Phone preview too small: Designer change required** (specified below) plus FS required change 4.
4. **`PC.debug.siteLabels()` / `siteDial()`: accepted** (read-only, added with `Object.assign`); A-2 debug list updated.
5. **Q6 readout "Edge 1 of 5 · 20.0 m": accepted.** The index is stable and matches prev / next; the length tells the user which edge it is.
6. **A whole-state replace resets the group, the progress and the invalid-field list: accepted.** Invalid texts belong to the replaced project; leaving them would block stage 2 of the new one. (`r5Confirmed` is already reset by `replace`.)

### Designer change (logged against F1-T1; CSS only)
- **What:** on phones in portrait, the site-preview legend stops overlaying the drawing: it becomes a single-line strip directly under the canvas, inside `.pc-preview`, and the canvas shrinks so the preview keeps its 200 px total height (the questions column keeps its height).
- **Where:** `src/css/41-stage-questions.css` only. No markup, hook, template or contract change (`site-legend` stays the hook; texts unchanged).
- **CSS:** in a new block `@media (max-width: 599px) and (min-height: 481px)`:
  - `.pc-preview > .pc-canvas-wrap { height: 176px; }`
  - `.pc-legend { position: static; flex-wrap: nowrap; overflow: hidden; gap: 4px; padding: 2px var(--s2) 3px; }`
  - `.pc-legend > li { flex: none; padding: 0 4px; }`
  - Collapsed state unchanged (legend hidden with the canvas). From 600 px up and in short landscape nothing changes.
- **Acceptance check** (Designer adds `tests/e2e/site-legend.spec.mjs`, sample loaded, stage 2, Site group, preview open, at 360 x 640 and 360 x 740 touch, in m and in ft): all five legend items share one top (one line); every item lies inside the legend box and inside the preview horizontally (nothing clipped); legend top >= canvas bottom (no overlap); preview height <= 201 px; the questions scroller is at least as tall as before the change (record the hand-over value in the spec); no page scroll; at 768 x 1024, 1280 x 800 and 640 x 360 the legend position and canvas height are unchanged.
- **FS-side consequence, no FS code needed:** `q-preview.js` measures overlays from the DOM, so the bottom allowance drops to 0 by itself. The FS round-2 spec asserts the outcome: sample at 360 x 640 drawn at 4.0 px per metre or more (3.05 today) and "back" among `PC.debug.siteLabels()`.

### Required changes (FS)
1. **Sliders must leave their transient state when the gesture ends, whether or not `change` fires** (`q-fields.js` slider; defect 1). On `pointerup` / `pointercancel` / `blur` / `keyup` with no `change` following, clear `busy`, call `live(null)` (drops `pending`, resets `liveOff`) and re-render the control from state, so the attributes for the current unit are applied. Tests in `questions.spec.mjs` with **real pointer input** (mouse at 1280 x 800, CDP touch at 360 x 640), not synthetic `input` / `change` events: drag Q3 and Q8 away and back to the start value and release; then (a) an external commit of a new value (e.g. `footprintPct = 40`) is shown by the slider and its label; (b) after switching to ft, Q8 has min 8 / max 14.5 / step 0.5 and one ArrowRight from 3.0 m (thumb on 10.0 ft) stores 10.5 ft = 3.2004 m, not 2.4 m; (c) preview and summary show the stored state. Mutation-check these cases against the current code (they must fail on it).
2. **An own-confirmation level removal names every level whose currently valid plan the change makes stale** (`stage-questions.js` `setLevels`; defect 2). Use exactly the gate's computation: export it from `store.js` as `PC.store.affected(candidate)` (levels whose plan is valid now and whose signature differs in the candidate, removed levels included) and build the sentence from it, e.g. "The First floor has 7 rooms. They will be deleted. The floor plans of the Ground floor and the First floor will be regenerated or lost, with their manual edits and approvals." F2-T3's three-way dialog and F3-T2's Clear dialog use the same function (A-7 updated). Tests: seeded valid plans, 2 -> 1 floor names Ground and First; basement off on a two-floor house names only the Basement; basement off on a one-floor house names Basement and Ground; unit test of `PC.store.affected`.
3. **Q5 readout in whole degrees** (`renderTexts`; defect 3): round the relative angle ("12° clockwise from the back"). Test with the sample's angled edge as the street, one clockwise step.
4. **The street edge always carries its "front" label in the preview** (`q-preview.js`): it is the bottom edge of the drawing with free padding below it, so place "front" centred under its visible midpoint regardless of its length (other edge labels keep the current culling). Test at 360 x 640: sample with `streetEdge` 3 (the 8.9 m edge) and the 10 x 50 m plot: `siteLabels()` contains "front" in both.
5. **F2-T1 minors** (ruled in `docs/03-tasks/F2-T1/outcome-review.md`): run the footprint fallback also when the centred result's final area is under 20 m² (A-6 step 4 updated); word the `pool-omitted` clearance through `PC.units`; add the three unit cases (QA's triangle, ft pool text, "once per visit" for a second still-valid level). Sample assertions unchanged.
6. Round-2 hand-over: the focused run while working, then **three consecutive green full runs**, plus the Designer change's spec in the same tree.

### Non-blocking notes
- Fix on a `field-invalid` conflict focuses the first control of the question (the "−" of the front setback). Focusing the invalid input itself would be better; take it in round 2 if it is cheap (the entry already carries its key).
- Compass drag on a slanted street snaps in frame L, but the stored value snaps in W, so the arrow can move by up to 7.5 degrees on release. Snapping the drag through `northToW` / `northL` would make them agree; prototype-acceptable.
- In ft the Q8 thumb sits on the 0.5 ft step (10.0) while the label reads 9.8 ft for 3.0 m: harmless, the stored value is not touched.
- The legend has no Parking / Pool entries (dashed grey and light-blue rectangles). Room for them exists from 600 px up; logged for the Designer's F5-T3 pass, not this task.
- The F1 publishing gate is still unanswered in `docs/04-feature-reviews/F1.md`; per the coordinator ruling it must be answered or recorded as "OPEN — awaiting client" with its list before I approve the F2-T2 outcome.

VERDICT: CHANGES REQUESTED

---

## Round 2 — 2026-11-20

### What I did
- Read the round-2 changes: `q-fields.js` (slider gesture end), `stage-questions.js` (`setLevels` with `PC.store.affected`, `plansText`, Q5 readout, Fix focus), `store.js` (`affected` exported, the gate uses the same function), `q-preview.js` (`frontLabel`, compass snapping through W, `PC.debug.siteNorth`), `draw2d.js` (`fmt` may return null / '', `label` with `o.force`), the F2-T1 minors in `site-footprint.js` / `validate.js`.
- No full run of my own (QA was using the machine). Evidence instead: FS's three full runs (identical; the only failure was QA's stale "1 m clearance" check), then QA's confirming run after its fix: **exit 0 in 292.6 s**, lint 0, unit 252/0, questions 711/0, site-legend 120/0, plot 512/0, shell 554/0, QA F1-T1 169 + 2015, F1-T2 792, F1-T3 1022, F2-T1 1126 (both KNOWN entries removed, fixes confirmed independently and mutation-checked by QA). FS reports 11 mutation checks of its new cases, all failing as expected.
- Re-ran my round-1 probes on the current build (360x640 touch and 1280x800 mouse).

### Required changes from round 1
| # | Status | Evidence |
|---|---|---|
| 1 Slider stuck | Resolved | My probe: Q8 dragged 3.0 -> 3.8 -> 3.0 m (10 `input`, 0 `change`), then ft: attributes 8 / 14.5 / 0.5, value 10; ArrowRight stores 3.2004 m (10.5 ft), not 2.4 m. Q3 dragged away and back: an external commit to 40 % is shown by slider and label. FS spec drives real mouse and CDP-touch drags, including away-and-back. |
| 2 Own dialog names every affected plan | Resolved | 2 -> 1 floor with valid plans on both: "The First floor has 7 rooms. They will be deleted. The floor plans of the Ground floor and the First floor will be regenerated or lost, with their manual edits and approvals." Built from `PC.store.affected`, the gate's own function. |
| 3 Q5 whole degrees | Resolved | Angled edge as street, one clockwise step: "12° clockwise from the back". The compass drag now snaps through W, so the arrow no longer jumps on release. |
| 4 "front" always labelled | Resolved | Sample with the 8.9 m edge as street at 360x640: labels `110 m², front, side, side, back`. |
| 5 F2-T1 minors | Resolved | QA's triangle now 8 x 4 = 32 m², no `no-fit`; pool text "1.0 m" / "3.3 ft"; unit 248 -> 252 with the three cases. |
| 6 Green runs | Resolved | FS three identical runs plus QA's confirming green run on the final tree. |

### Rulings on what was asked
- **Slider gesture end through a zero-delay timer** (`ended()`): accepted. It is ordering, not waiting: a `change` that does come is dispatched in the same task as the pointer up / blur, so the timer only lets it run first; `committing` keeps the thumb owned by the user while an R5 dialog is open. Document-level `pointerup` / `pointercancel` (capture phase) also catches a release outside the thumb. It is ui-layer code, so A-2's no-timers rule for core does not apply; A-16's no-fixed-sleeps rule is about tests. A-15 already describes the behaviour.
- **`plansText` wording**: accepted. "regenerated or lost" for a mixed case is slightly blunt but true and names every level; F2-T3's three-way dialog reuses it and may split the sentence ("The First floor's plan will be lost and the Ground floor's regenerated") if the Designer or PM wants it finer.
- **`draw2d` additions** (`fmt` returning null / '' skips an edge; `label(..., { force: true })` draws even when the spot is taken): accepted; both are generic and default to the old behaviour. One limit: a forced label ignores `o.avoid`, so it could sit under an overlay. It is used only for the street label in the bottom padding, which nothing overlays since the phone legend moved into its own strip; keep `force` for that single use.
- **`PC.debug.siteNorth()`**: accepted; added to the A-2 debug list.
- **Phone preview 200 px "only by its 1 px border"** (canvas 176 + strip 23.8 = 199.8 px content, preview box 200.8 px): acceptable. The amended rule measures the preview box (its rendered border box, as QA's check does), and that box is 200.8 px; the drawing itself is what the rule protects, and it is larger than before (4.13 vs 3.05 px/m). No change; QA keeps measuring the border box.

### Required changes
None.

### Non-blocking notes
- F1 real-device gate: recorded as OPEN in `docs/04-feature-reviews/F1.md` per the coordinator ruling, which satisfies my condition for the outcome review.
- The client tried the old F1 page and saw static questionnaire fields (expected then). The current build has been republished; QA's focus item 1 confirms it by touch.

### For QA (F2-T2 focus)
1. **Client report check, touch at 360x640 (and 640x360) on the current build:** every control of Q1–Q10 and Q15–Q17 updates its stored value, its own readout, the site preview and the summary: each slider by a real touch drag (including dragged away and back to its start), each number field by typing and by both steppers, each radio and switch by tap. Nothing stays stale after a unit switch, Load sample, Resume, or an R5 Cancel.
2. F2-S1: four groups in brief order with brief texts; Q18–Q19 absent; defaults of 4.1 on a hand-made plot and 6.2 values on the sample; progress text and bar; `inputmode="decimal"`; answers persist across groups, stages and reload + Resume.
3. Bad input: empty, letters, `1e2`, `0x10`, negative, over range, half-typed values, decimal comma, ft entry (10 ft -> 3.048 m; 65.7 ft refused), whole-number cars ("1.5" refused, no unit in the message); invalid text survives re-renders and a unit switch; Fix focuses the invalid field; clearing it clears the conflict and re-enables Next without reload (tests raise `MAX_BUILT`).
4. R4: every displayed length / area / limit / message in m and ft (incl. "1.0 m" / "3.3 ft" pool clearance, Q8 in ft 8.0–14.5 step 0.5 storing metres); a unit switch never commits a length.
5. Site preview (F2-S1, QA F2-T1 obs. 4 and 8): locked (no pan, pinch, wheel zoom; wheel scrolls the page column on desktop); edge classes labelled, the street edge always "front"; footprint where the site model puts it (U-plot, thin plot, rotated plot); Q6 by edge tap (touch 22 px, mouse 10 px) and by prev / next; Q5 by compass drag (touch and mouse, 15-degree steps in W, no jump on release) and by buttons, readout in whole degrees on a slanted street; phone legend strip on one line, canvas >= 176 px, sample at >= 4.0 px/m.
6. F2-S3: every blocking and warning reachable in this task with its text, question and effective numbers in both units, status line, Next disabled and re-enabled live; Fix collapses the phone sheet, opens the group, the question in view and focused; the sample shows "All clear".
7. R5 with seeded valid plans: a size-changing Q2 / Q3 / Q6 / Q7 change asks once per visit naming the levels; Cancel (button, Esc) restores field / slider / thumb / label / preview / summary and the identical state; Continue applies and later changes do not ask; move-only change (back 2 -> 2.25 m) and Q10 never ask; Q7 lowering with rooms: own dialog naming every affected plan (2 -> 1 floor names Ground and First; basement off on a one-floor house names Basement and Ground), Cancel keeps the level, Delete leaves a valid draft, never a second dialog.
8. Riders: m / ft by header and Q1 radio keeps Skip on the sample, any other answer removes it; plot readout "Snap 0.5 m" / "Snap 1 ft", never contradicting the chip; no static banner on stage 2.
9. Every scenario at 360x640 touch, 768x1024 touch, 1280x800 mouse (+640x360): no page scroll or zoom, 44 px targets, bar in view, zero page / console errors, no native dialogs or requests.

VERDICT: APPROVED

---

## Round 3 (QA fixes) — 2026-11-20

QA failed F2-T2 on bug 1 (Major: Enter in a size-changing number field answered the R5 dialog with Cancel in the same keystroke) and bug 2 (Minor: summary figures ellipsized at 640x360 in ft).

### What I did
- Read the diffs: `q-fields.js` `number` keydown now `e.preventDefault()` before `input.blur()`; the Designer's rule in `41-stage-questions.css`, scoped to `.pc-summary .pc-tb--rows` (cells may wrap, the figure is right-aligned and drops under its label when it does not fit).
- Own probe of the keyboard paths that can open the R5 dialog, with seeded valid plans, at 360x640 touch and 1280x800 mouse: Enter in the front setback after typing 4; Enter and Space on the side-setback "+"; Enter on Q6 "next edge". In every case the dialog **stays open** with focus on Cancel and the state unchanged until the user answers; Esc cancels; Tab then Enter on Continue stores 4 m. No errors.
- Own probe of bug 2 at 640x360 in ft on the worst case (100 x 100 m plot, 80 %, three floors), sheet open: no summary cell has `scrollWidth > clientWidth`; the screenshot shows long figures moved under their labels, readable, right-aligned.
- No full run: the FS's final full run is exit 0 in 309.8 s with every suite at 0 failures and no KNOWN entries, and nothing I read touches other files. The FS mutation (fix removed -> 24 failures) and the Designer's (old CSS fails exactly QA's 8 cases) show the new cases bite.

### Findings
- **Bug 1: fixed at the cause.** Without the default action the Enter keystroke can no longer be delivered to the button that the dialog focused. The FS's sweep of the other key paths (stepper buttons, Q6 next, Q7 radio arrows, basement switch, Q3 slider arrows, stage-1 Backspace) matches what I saw: buttons fire `click` on Enter keydown / Space keyup, the dialog opens after that, so the same keystroke cannot reach it. The new `keyboardR5` case at all four viewports (Esc, Tab + Enter Continue) and real taps on radios, switches and the unit toggle close QA's spec gaps 1, 2, 4 and 5.
- **Bug 2: fixed**, CSS only, scoped to the summary rows; only 640x360 ft renders differently. `summary-fit.spec.mjs` (456/0) asserts no clipping.
- **QA F1-T1 flake** (640x360 `s2-building`, q-floors radio "covered at centre", once, not reproduced): not a blocker for this round. If it recurs, QA looks at whether its centre-point hit test runs before the group's scroll settles; record it in the QA report either way.

### Required changes
None.

### For QA
Re-test bugs 1 and 2 (remove the KNOWN entry for bug 2), plus a short regression of focus items 1, 3, 6 and 7 of Round 2 with the keyboard: Enter / Go on the phone keyboard in every number field, with and without seeded plans.

VERDICT: APPROVED
