# F1-T3 implementation review — Tech Lead

## Round 1 — 2026-11-20

### What I did
- Read in full: `core/units.js`, `geom.js`, `plot.js`, `frames.js`; `ui/view2d.js`, `draw2d.js`, `stage-plot.js`; `main.js`; the changed parts of `shell.js` (focus fix), `dialog.js` (backdrop delay), `draft.js` (`PC.plot.valid`); `tests/helpers/touch.mjs`.
- Ran `node tests/run-all.mjs`: exit 0. Lint 0 violations; unit 196 passed; e2e contract 4/0, plot 370/0, shell 551/0; QA suites run as the final step: F1-T1 static 149/0 and layout 1929/0, F1-T2 flows 759/0.
- Looked at screenshots: `empty-360x640`, `sample-360x640`, `hand-open-360x640`, `hand-closed-ft-360x640`, `sample-640x360`, `hand-closed-1280x800`.
- Ran my own probe (360x640 touch): taps, a pointer whose `pointerup` never arrives, unit change, viewport change to 640x360.

### Findings
**Pure logic: correct.** `segRelation` distinguishes cross / touch / overlap / none with the collinear cases handled; `simple` treats any touch as a crossing and neighbour fold-back as invalid; `canAdd` / `canClose` / `canMove` return reasons as planned; `normalise` keeps the first point; `defaultStreetEdge` has both tie rules; `snap` clamps after snapping (so the last ft column sits at exactly 100 m); `frames.make` matches A-5 (v = u turned +90 degrees), `northL` and `l2t` are right. `units` formats 1 decimal / whole numbers and never touches stored values.

**Controller: matches the plan and the stories.** Tap -> snap -> `canAdd` -> commit; close by first vertex (22 px), by snapped equality, or by button, in one `propose` that normalises, closes and stores `ans.streetEdge`; Undo reopens a closed shape (session-only order flag, as ruled); Clear confirms only when closed; corner drag keeps the last valid position, the release goes through `propose` once and the new position stays on screen until the gate answers; the small-plot message is unit-aware. Screenshots show legible labels in m and ft, culling working, the area label inside an L-shaped plot (`innerPoint`), readouts whole at 360 px.

**Conditions from the plan review**
| Condition | Status |
|---|---|
| 1 Keyboard drawing / vertex editing cut | Met: only `+` `-` arrows (view), `0` fit, Backspace undo |
| 2 Re-fit when the state is replaced | Met (`meta.replace` subscriber; also re-fits an untouched view on resize) |
| 3 `PC.debug` extended, not replaced | Met |
| 4 `View2D` / `draw2d` free of plot knowledge | Met: both are generic (world box, callbacks, palette); F2-T2 and F3-T1 can pass frame-L coordinates as "world". `View2D.named` + `PC.debug.toScreen(name, …)` works for the later views |

**Carried items from F1-T2**: `run-all` runs `tests/qa/run-*.mjs` (seen in my run); guard awaited before the first point with the tap not placed; `streetEdge` stored on close; `validState` calls `PC.plot.valid`; "minimum 538 sq ft" tested. The two F1-T2 minors are fixed (focus restored after keyboard actions; backdrop taps ignored for 300 ms) with cases in `shell.spec.mjs`.

**DPR / resize**: bitmap = CSS size x min(dpr, 2), context pre-scaled, centre kept on resize, zero-size skipped; after my viewport change the canvas was 368 x 262 with a matching bitmap and an auto-fitted view.

### Rulings on the deviations
1. **Focus fix only after keyboard input, via `setTimeout(0)`** — accepted. Moving focus after a tap or click would be wrong; the zero-delay timer is in the ui layer and only orders the check after the render.
2. **`PC.geom.innerPoint`, `PC.debug.view(name)`, `View2D.named`, `fit` with per-side padding** — accepted (A-2 file table to gain `innerPoint` when next edited; no behaviour depends on it elsewhere).
3. **Release point of a corner drag counts as the last move** — accepted.
4. **Grid step minimum: use 6 px** instead of 8. The fitted sample on a phone is 7 px per metre; with 6 px it keeps the 1 m squares of PM 4.3 and the chip reads "1 square = 1 m" in the reference scene. The chip stays truthful when zoomed further out. See required change 3.

### Decision on the start card (phone)
The card sits over the lower 150 px of the empty grid, including the origin corner. That is a design defect of the static layout, not of this task. **Designer change, CSS only, logged against F1-T1, to land before the F1 publishing point:**
- Below 900 px wide (not in short landscape, where the card already lives in the panel), when the resume box is hidden: the start panel loses its card chrome and its hint paragraph (the message line under the canvas already says "Place at least 3 points, then close the shape"); only the "Load sample project" button remains, 44 px high, auto width, floating at the bottom centre of the canvas with 8 px margin and `--e1` elevation; the container itself does not take pointer events. The no-save note, when visible, is one small line above the button.
- When the resume box is visible (a draft is waiting), the full card stays as it is: the user has to answer it anyway and a grid tap opens the guard dialog.
- Selector: `.pc-start:has([data-pc="resume-box"][hidden])` (same fallback as the other `:has` rule: older browsers keep today's card). No markup or hook change. Layout assertions unchanged; add one: at 360x640 with no draft the start panel covers 60 px or less of the canvas height.
No FS change is needed for this.

### Required changes (FS)
1. **A lost pointer kills the canvas (`view2d.js`).** If a `pointerup` / `pointercancel` never arrives (capture lost, event dropped by the browser), the stale entry stays in `_ptr`; every later touch is then counted as a second pointer, the view goes pinch -> spent and **no tap is ever accepted again until reload**. Reproduced: one tap (1 point), then a synthetic `pointerdown` with id 77 followed by `lostpointercapture` and no `pointerup`, then two real taps: still 1 point. Fix: (a) treat `lostpointercapture` for a tracked pointer as a cancel (`_up(e, true)`); (b) on a `pointerdown` with `e.isPrimary`, drop any pointers still tracked (cancelling a running drag) before registering the new one. Add this scenario to `plot.spec.mjs`. `View2D` is shared by three stages, so this must be solid now.
2. **R4 in the "outside" message**: "Outside the 100 × 100 m drawing area." is shown in metres in ft mode. Build it through `PC.units` (ft: "328.1 × 328.1 ft"); one e2e or unit assertion.
3. **Grid step minimum 6 px** (ruling 4): the sample at 360x640 must read "1 square = 1 m"; keep the "chip equals drawn spacing" test and add this case.

### Things flagged by FS
- **CDP touch quirk (350 ms settle in the test helper)** — accepted; it is test-only and documented in the helper.
- **Toast auto-dismiss after keyboard activation untested** — non-blocking; QA's suite already covers toast dismissal by timer. Add if `shell.spec.mjs` is opened again.
- **QA's bad-draft set** — QA to add: a point outside 0..100, a clockwise closed plot, a self-crossing closed and open outline (the unit tests already cover them through `validState`).

### Non-blocking notes
- `fit()` for an empty project puts the origin at the lower left; fine once the start card no longer covers it.
- `plot-grid` text is built in the controller ("5 ft, snap 1 ft"); if section 4.3 numbers ever change, derive it from `PC.C.GRID`.
- A change of device pixel ratio without a size change (browser zoom on desktop) is picked up only at the next resize; acceptable.

VERDICT: CHANGES REQUESTED

---

## Round 2 — 2026-11-20

### What I did
- `node tests/run-all.mjs`: exit 0. Lint 0; unit 196/0; e2e contract 4/0, plot 388/0, shell 551/0, start-card 14/0; QA F1-T1 149/0 + 1929/0; QA F1-T2 759/0.
- Re-ran my round-1 reproduction against the fixed build, extended with a second case.
- **Mutation check of the new spec cases** (FS had not done it): removed the two fix lines from `view2d.js`, rebuilt, ran `plot.spec.mjs`: "after a lost pointer capture the next tap still draws" and "a pointer that simply vanished is dropped by the next primary pointer" both fail (as do the later 12-corner cases, since the canvas is dead from then on). Restored the file (diff clean) and rebuilt.
- Viewed `start-a-360x640`, `start-b-360x640`, `start-c-360x640` (no draft; draft waiting; no-save note).

### A) FS changes
| # | Status | Evidence |
|---|---|---|
| 1 Lost pointer | Resolved | `view2d.js`: `lostpointercapture` -> `_up(e, true)`; a primary `pointerdown` clears stale pointers and cancels a running drag. Probe: tap (1 point) -> stale pointer + `lostpointercapture` -> tap gives 2 points; stale pointer with no event at all -> tap gives 3 points. Tests proven to fail without the fix. |
| 2 Unit-aware "outside" message | Resolved | Probe: "Outside the 328.1 × 328.1 ft drawing area." in ft; switches back to "100 × 100 m" on unit change. |
| 3 Grid minimum 6 px | Resolved | Sample at 360x640: chip "1 square = 1 m" at 7.13 px per metre. |

### B) Designer change (start panel on phone; logged against F1-T1)
Resolved as specified, CSS only (`40-stage-plot.css`, `:has([data-pc="resume-box"][hidden])`): with no draft only the floating "Load sample project" button remains (44 px, bottom centre, container without pointer events) and the grid above it is free; with a draft waiting the full card stays; desktop and short landscape unchanged. Rulings:
- **About 62 px with the no-save note** (limit asserted only for the plain case at 44 px): accepted. It is the rare storage-blocked state and the note is one line.
- **"Draft waiting" forced by un-hiding `resume-box`** in `start-card.spec.mjs`: accepted for a layout test; the real path (stored draft -> resume box) is exercised by QA's F1-T2 flows and `shell.spec.mjs`.

### Required changes
None.

### For QA (F1-T3 focus)
1. F1-S1 on touch and mouse at 360x640, 768x1024, 1280x800: place / close (first vertex and button), Close disabled under 3 with hint, duplicate ignored, crossing vertex and crossing closing edge refused with message, 13th vertex and outside-area refused, Undo (incl. reopening a closed shape), Clear with in-page confirmation, under 50 m2 blocks Next in both units.
2. Gestures: a drag is never a tap; one-finger drag pans; two-finger pinch/drag places nothing even when one finger lifts first; wheel zoom; page never scrolls or zooms; **recovery after a lost or vanished pointer**; hold longer than 700 ms places nothing.
3. F1-S2 / R4: 20 x 30 m reads 20.0 m, 30.0 m, 600 m² and 65.6 ft, 98.4 ft, 6458 sq ft with `plot.pts` unchanged; scale chip equals the drawn grid spacing at several zoom levels and in both units; labels do not overlap on the sample at 360 px.
4. F1-S3: corner drag with snap and live values; refused drag returns to the last valid position with a message; 44 px touch hit area; release goes through the gate (stubbed Cancel returns the corner); street edge stored on close and reset by Clear / reopen.
5. Draft: pending-draft guard on the first tap (Cancel and OK paths); bad drafts for the new rules (point outside 0..100 m, clockwise closed plot, self-crossing open and closed outlines) discarded silently; resume restores a hand-drawn plot exactly.
6. The two F1-T2 minors (keyboard focus after stage change / sample / Skip / Start new; double tap on a dialog opener) and the phone start panel (no draft, draft waiting, no-save note).

VERDICT: APPROVED

---

## Round 3 (QA fix) — 2026-11-20

QA failed the task on one major bug: edge lengths missing for edges next to the canvas border (F1-S2), which neither the FS tests nor my screenshot sample caught because all hand-drawn shapes sat away from the border.

### What I did
- `node tests/run-all.mjs`: exit 0. Unit 196/0; e2e contract 4/0, plot 464/0, shell 551/0, start-card 14/0; QA F1-T1 149/0 + 1929/0, F1-T2 765/0, F1-T3 744/0.
- Read the new label code in `draw2d.js` (`clipToView`, `labelRect`, `labelFree`, `label`, `edgeLabels`) and its use in `stage-plot.js`.
- **Mutation check** (FS had not run the new scenarios against the old behaviour): reduced `edgeLabels` to the old single position (midpoint, outer side), rebuilt, ran `plot.spec.mjs`: the border scenarios fail ("the first edge from the origin shows its length: got 0, expected 1", "closed at the border: got [2,1], expected [4,1]", the corner triangle, and more). Restored the file (diff clean), rebuilt.
- Viewed `border-first-edge-360x640.png` and `border-closed-360x640.png`.

### Finding
Fixed. `edgeLabels` now labels the visible part of each edge and tries, in order, the outer side then the inner side at five positions along the edge, taking the first rectangle that is on the canvas and clear of placed labels and of `o.avoid` (the scale chip); the area label is placed first so edge labels move around it. Screenshots: the first edge from the origin shows "20.0 m" above the line; the closed 20 x 20 m square at the border shows all four lengths (left and bottom on the inner side) and the area. The code stays generic (`o.avoid` is a list of rectangles; no plot knowledge in `draw2d.js`), 141 lines. Reverting the wider empty margin and the re-fit on close was right: with inner-side placement neither is needed, and a view that jumps on close would be worse.

### Ruling: an on-screen "fit view" control is required (small Designer change + FS wiring)
QA is right that touch has no way back to a fitted view; after a pinch on a phone the only recovery is more pinching, and the same will be true of the plan editor. Decision:
- **Designer (markup + CSS + contract, logged against F1-T1):** an icon button "Fit view" on the two zoomable canvases.
  - Hooks: **`plot-fit`** (stage 1) and **`plan-fit`** (stage 3). `button.pc-btn.pc-btn--icon`, `type="button"`, `aria-label="Fit view"`, icon `#i-frame` (already in the sprite).
  - Placement: inside the stage's `.pc-canvas-wrap`, floating at the **top right**, 8 px from the edges, 44 x 44 px, `--surface` background with `--e1` elevation (same treatment as the scale chip, which stays top left). In stage 3 it sits under the no-layout banner when that is shown (banner has the higher z-index).
  - The site preview (stage 2) gets **no** button: it is always auto-fitted and does not pan or zoom (binding on F2-T2).
  - Update `tests/contract/hooks.json` (+2 document hooks) and the hook table in the F1-T1 outcome; layout assertions: 44 px target, inside the canvas, no intersection with the scale chip or the start button at 360x640 and 640x360.
- **FS (F1-T3, one small change):** wire `plot-fit` to the existing `fit()`; pass the button's rectangle in `o.avoid` together with the chip so labels keep clear of it; e2e: pinch or pan, tap `plot-fit`, the view equals the fitted one and no point is placed. `plan-fit` is wired in F3-T1.
- A-15 updated. I will look at both changes together in a short round 4, then QA re-tests F1-T3 once, including this control.

### Required changes (for the QA fix itself)
None.

VERDICT: APPROVED

---

## Round 4 (fit control) — 2026-11-20

### What I did
- `node tests/run-all.mjs`: exit 0. Unit 196/0; e2e contract 4/0, fit-button 42/0, plot 476/0, shell 551/0, start-card 14/0; QA F1-T1 149/0 + 1929/0, F1-T2 765/0, F1-T3 744/0.
- Read the changes: `src/index.html` lines 112 and 412 (`plot-fit`, `plan-fit`: `pc-btn--icon`, `aria-label="Fit view"`, `#i-frame`), `.pc-fit` in `20-shell.css` (top right, 8 px inset, `--e1`), `stage-plot.js` (click -> `fit()`, the button's rectangle added to `o.avoid`). Contract has 204 document hooks.
- **Mutation check** (not done by FS): made the click handler a no-op, rebuilt, ran `plot.spec.mjs`: "Fit view changes the view after a pan and pinch" and "every point is back on screen" fail at all three viewports. Restored (diff clean), rebuilt.
- Own probe at 360x640 touch with the sample: zoom x3 and pan, tap `plot-fit` -> scale and offset equal the originally fitted view, still 5 points, no errors. Screenshot taken (FS had none): button at the top right of the canvas, clear of the scale chip, of the outline and of the "12.0 m" label.

### Finding
Both parts are as specified in round 3. `plan-fit` is present in the markup and unwired until F3-T1; the site preview has no button (A-15).

### Required changes
None.

### For QA
Re-test F1-T3 once: bug 1 scenarios (border labels at all four viewports), plus the fit control (44 px target, tap after pinch/pan returns the fitted view and places no point, labels do not run under it), in addition to the round-2 focus list.

VERDICT: APPROVED
