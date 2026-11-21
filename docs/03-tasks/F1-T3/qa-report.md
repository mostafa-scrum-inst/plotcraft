# F1-T3 QA report — QA Tester

## Round 1 — 2026-11-20

Build under test: `node build.mjs` -> `dist/index.html` (current tree, TL-approved round 2 plus the Designer's start-panel change).
Scope: F1-S1, F1-S2, F1-S3 (the R5 confirmation on vertex release is deferred to F3-T2 by plan), R2 on the canvas, R4; re-test of the two F1-T2 minors; the phone start panel in its three states; bad drafts under the new plot rules. Out of scope by TL ruling and not judged: keyboard point placement and keyboard vertex editing, vertex insert/delete on a closed plot, tap limit 700 ms, Undo reopening a closed shape, draft points limited to 0..100 m, closed plots stored counter-clockwise.

### What I tested and how

| File | What |
|---|---|
| `tests/qa/f1-t3-plot.mjs` | own playwright suite; runner `tests/qa/run-f1-t3.mjs [--no-shots]` (exit 0 / 1; about 95 s) |
| `tests/qa/session.mjs` | the scenario session of the F1-T2 suite, factored out so both suites share it |
| `tests/qa/lib.mjs` | additions: `CANVAS_SPY` (init script recording every `fillText`, line segment and circle drawn on a canvas), `touchDriver` (CDP multi-touch, **no** settle delays) |

Independence from the app's own hooks and from the FS tests:
- **Numbers** come from my own shoelace / perimeter / unit code and from PM 6.2 and section 4, never from `PC.geom` / `PC.units`.
- **What is on the canvas** is read from the recorded draw calls (label text, position, font, colour; grid lines; corner handles), not from `PC.debug.plotLabels()`.
- **Input** is real: `touchscreen.tap` and CDP touch sequences at 360x640 and 768x1024, real mouse at 1280x800, always at a point that I first verify to be free canvas. `PC.debug.toScreen` is used to aim, and is itself cross-checked (a corner is drawn where it was tapped).

Scenarios: A draw / close / measure 20 x 30 m in m and ft; B close by button, clockwise input, Undo incl. reopening, Clear with confirmation, street edge; C refusals (crossing vertex, closing across, older vertex, collinear, outside, 13th corner, under 50 m² in both units, exactly 50 m²); D corner drag (live values, snap, refused drag, area limit, hit radius, 5 px wobble, gate stubbed to Cancel, ft lattice); E gestures (pan, 13 px vs 5 px movement, hold 950 / 450 ms, pinch with either finger lifted first, two-finger pan, taps with 0 ms gap after a gesture, wheel about the cursor, zoom limits, right / middle click, live edge on hover, vanished / capture-lost / cancelled pointers); F sample figures in m and ft, label rules, scale chip against the drawn grid at 14 zoom steps per unit, "unmodified" flag; G drafts of a hand-drawn open and closed plot, guard on the first tap (Cancel and OK); H 13 bad drafts under the new rules + 4 legal edge cases; I start panel in three real states; J rotation to 640x360 and back, device pixel ratio 2 and 3, short landscape; K keyboard on the canvas; L a plot started at the origin of the default view; M unit change while drawing, drag below 50 m², corner onto corner. A-G at 360x640 touch, 768x1024 touch and 1280x800 mouse.
Every scenario ends with: no page error, no console error, no native dialog, no request but the three.js tag; live states re-check the F1-T1 layout rules.

Result: **738 checks passed, 6 failed** (all six are bug 1). F1-T2 suite: 765 / 0 with the two KNOWN entries removed. F1-T1 suites: 149 / 0 and 1929 / 0. `node tests/run-all.mjs`: lint 0, unit 196 / 0, e2e contract 4 / 0, plot 388 / 0, shell 551 / 0, start-card 14 / 0, then stops at my F1-T3 step (bug 1). Whole run 6 min 10 s.
Screenshots in `tests/qa/shots/F1-T3/` (47); looked at by eye at 360x640: `F-sample-m`, `F-sample-ft`, `A-rect-ft`, `C-12-corners`, `I-start-no-draft`, `I-start-nosave`, `I-start-draft-waiting`, `bug1-first-edge-no-label`, `bug1-closed-two-labels-missing`.

### Results per acceptance criterion

| Criterion | Result | Evidence |
|---|---|---|
| F1-S1 tap places a snapped vertex, edges join | PASS | (20.2, 0.15) snaps to (20, 0); the handle is drawn within the snap distance of the tap; ft mode snaps to whole feet |
| F1-S1 close by first vertex or "Close shape"; filled | PASS | both paths; clockwise input stored counter-clockwise with the first point kept |
| F1-S1 Close disabled with a hint under 3 points | PASS | |
| F1-S1 zero-length edge ignored | PASS | silently, no message |
| F1-S1 crossing vertex rejected; closing across refused | PASS | "That edge would cross the outline."; closing by vertex and by button; older vertex; three collinear points |
| F1-S1 13th vertex refused; outside 100 x 100 m refused | PASS | "A plot can have at most 12 corners."; "Outside the 100 × 100 m drawing area." / "328.1 × 328.1 ft"; a 12-corner outline still closes |
| F1-S1 Undo last point, Clear with in-page confirmation when closed | PASS | Undo reopens a closed plot in the drawn order; Backspace on the canvas; Clear: Cancel / Esc keep, OK clears |
| F1-S1 under 50 m² blocks Next | PASS | "Plot is too small: 40 m² (minimum 50 m²)." / "431 sq ft (minimum 538 sq ft)."; step 2 locked with the unit-aware reason; exactly 50 m² accepted; also when a drag shrinks the plot |
| F1-S1 touch: tap places, pinch / two-finger drag place nothing, drag is not a tap | PASS | incl. either finger lifted first; 13 px movement is a drag, 5 px a tap; 950 ms hold places nothing |
| F1-S1 desktop: wheel zooms, drag on empty space pans | PASS | world point under the cursor stays within 1.5 px; limits "whole area" .. 80 px/m |
| **F1-S2 each edge shows its length while drawing and after closing** | **FAIL (bug 1)** | plots started at the origin of the default view lose the labels of the edges next to the canvas border |
| F1-S2 live edge to the pointer on desktop | PASS | "6.0 m" on hover, gone on leave |
| F1-S2 closed plot shows area and perimeter | PASS | readouts and area label; 12-corner plot checked against my own shoelace |
| F1-S2 / R4 unit toggle converts every label, vertices do not move | PASS | 20.0 m, 30.0 m, 600 m², 100.0 m <-> 65.6 ft, 98.4 ft, 6458 sq ft, 328.1 ft; sample 584 m², 96.9 m, edges 20.0 / 30.0 / 12.0 / 8.9 / 26.0 m <-> 6286 sq ft, 318.1 ft, 65.6 / 98.4 / 39.4 / 29.3 / 85.3 ft; `plot.pts` identical; no metre text left in ft mode |
| F1-S2 scale indicator correct when zooming, follows the unit | PASS | chip step x view scale equals the spacing of the grid lines actually drawn at every zoom step, both units; "1 square = 1 m" on the fitted phone sample; values seen: 1 m, 5 m, 5 ft, 25 ft |
| F1-S2 labels legible at 360 px | PASS | sample and rectangle in m and ft: no overlap, inside the canvas, clear of the scale chip, ink on halo; short edges cull (12-corner plot at fit shows 1 of 12, as the story allows) |
| F1-S3 drag a vertex with snap, live lengths and area | PASS | readouts and labels follow while the finger is down, store unchanged until release; corner lands on (24, 33); ft lattice in ft mode, other corners not re-snapped |
| F1-S3 self-intersecting drag refused, vertex at its last valid position, message | PASS | "A corner cannot be moved across the outline."; cannot leave the area; cannot land on another corner |
| F1-S3 44 px hit area on touch | PASS | 18 px off the corner grabs it on touch, pans with the mouse (10 px radius); 28 px off pans |
| F1-S3 release follows R5 (staged) | PASS | `propose` called exactly once; with a Cancel answer the state is unchanged and the corner is drawn back |
| F1-S3 street edge returns to default when the plot is redrawn | PASS | stored on close (index 0 for the samples), `null` after Clear and after reopening, new default after redraw |
| R2 no page scroll or zoom while using the canvas | PASS | `scrollX/Y`, visual viewport scale and container scroll unchanged after every gesture |
| Robustness: lost pointers | PASS | vanished pointer, lost capture, cancelled pointer: the next tap is placed |
| Drafts | PASS | open outline and hand-drawn closed plot (edited in ft) resume bit for bit; guard on the first tap: Cancel keeps draft and offer, OK removes the draft, the tap is never placed; 13 bad drafts discarded silently (points at -0.5 / 100.5 / 101, clockwise, bow tie, open outline crossing or touching itself, repeated point, collinear closed, fold-back, `null` coordinate, street edge out of range); border point, single point, 40 m² plot and `streetEdge: null` are kept |
| Rotation, DPR | PASS | 360x640 -> 640x360 -> back: points kept, bitmap matches, taps land; bitmap = CSS x 2 at DPR 2 and 3 |

### Re-test of the F1-T2 minors
| Bug | Result |
|---|---|
| 1 Keyboard focus dropped to `<body>` | **Fixed.** After Enter on Load sample, Next, Skip to 3D, Back, and after confirming Start new, focus is on a visible control at all three viewports. |
| 2 Double tap on a dialog opener | **Fixed.** Two taps 0 ms apart on "Load sample project" over a draft leave the confirmation open; a later tap on the backdrop still cancels. |
Both KNOWN entries are removed from `tests/qa/f1-t2-flows.mjs`; two focus cases (Skip, Back) added there.

### Start panel on phone (Designer change), real states
| State | 360x640 | 768x1024 |
|---|---|---|
| No draft | only the floating button; 52 px of canvas; container passes taps; a tap just above the button draws; origin free | same |
| Storage blocked (getter throws) | one-line note + button; 72 px of canvas (TL accepted about 62; note is one line); note text whole | same |
| Draft waiting (real stored draft, reload) | full card with hint, sample button, Resume, Start new; a tap on the card does not reach the grid; Resume draws the plot | same |
All pass, layout rules included.

### The 350 ms settle in `tests/helpers/touch.mjs`
It does not hide an app bug. Recording the raw events shows that a tap injected 0 ms after a touch gesture reaches the canvas as `pointerdown` / `pointerup` and the point is placed (my suite does exactly that after a pan and after a pinch, with no wait). What Chrome drops for about 100 ms after an injected gesture is the synthesized `click`, which only matters for HTML buttons, not for the pointer-driven canvas. The settle is needed only where a button is tapped right after a gesture.

### Bugs

**1. Major — Edge lengths are missing for edges next to the canvas border; on a phone the first edge drawn from the origin shows no length at all (F1-S2).**
- Steps: fresh start, 360x640, default view. Tap the origin corner (0, 0), then (20, 0).
- Expected (F1-S2): "Each edge shows its length while drawing … and after closing"; only short edges may hide.
- Actual: no label on the 20 m edge. Continue to (20, 20), (0, 20), close: only the top and right edges are labelled; bottom and left (20.0 m each) have none. Same at 640x360. At 768x1024 and 1280x800 the bottom label fits but the left edge (x = 0) is still unlabelled after closing (3 of 4). The area label and the readouts are right.
- Cause: `draw2d.label` drops a label whose rectangle would leave the canvas; labels sit 13 px outside the outline, and the empty view puts the origin 18 px (phone) to 46 px (desktop) from the left and bottom borders. The view is not re-fitted once drawing has started, and touch has no "fit" control (`0` is keyboard only), so the user must pan to see the figures.
- Screenshots: `tests/qa/shots/F1-T3/bug1-first-edge-no-label-360x640.png`, `bug1-closed-two-labels-missing-360x640.png`, `L-first-edge-360x640.png`, `L-closed-360x640.png`. Failing checks: scenario L at all four viewports.
- Suggested fix (any one is enough for the checks): when the outside position does not fit, place the label on the inner side of the edge (or slide it along the edge) instead of dropping it; and/or give the empty view a margin that holds a label (about 50 px left, 30 px bottom); and/or re-fit the view when the shape is closed while the user has not zoomed or panned.

### Review of the FS's own tests (gaps)
- `plot.spec.mjs` checks label overlap on the fitted sample, but nothing asserts that every edge of a hand-drawn plot is labelled; its hand-drawn shapes sit away from the border, which is how bug 1 passed. Add scenario L's assertion when fixing.
- The figures in the FS tests are produced by `PC.units` / `PC.geom`; mine are independent and agree.
- Otherwise the suite is thorough (lost pointers with a proven mutation, pinch with one finger lifted first, guard, unit-aware messages).

### Non-blocking observations
- **Closing radius at low zoom:** with 3 or more points, any tap within 22 px of the first vertex closes the shape. In the default phone view (9 px per metre) that is a 2.4 m circle, so a corner cannot be placed that close to the first one without zooming in. By design; worth a line in the hint text.
- **No on-screen "fit" control:** `0` on the keyboard is the only way back to a fitted view; on touch the user pinches. A small fit button would also soften bug 1.
- **12-corner plot at fit on a phone** shows one edge label of twelve (short edges cull, as allowed). Zooming in brings them back.
- **Undo after a reload** reopens a clockwise-drawn plot in the stored (normalised) order, so the "last point" is not the one drawn last (TL ruling: session-only flag).
- `tests/run-all.mjs` now takes about 6 minutes, of which the three QA runners are about 4. Acceptable; say if a faster `--quick` subset is wanted.
- The sample's perimeter in feet is 318.1 ft (96.94 m / 0.3048); the PM text gives no ft figure for it.

### Verdict
F1-S1 and F1-S3 pass completely, gestures and drafts are solid, both F1-T2 minors and the start panel pass. F1-S2's first criterion is not met for plots drawn near the canvas border, which is the default flow on a phone (bug 1, major). Re-test: scenario L must pass at all four viewports; the rest of `node tests/qa/run-f1-t3.mjs` must stay green.

VERDICT: FAILED

---

## Round 2 — 2026-11-20 (re-test after the label fix and the new "Fit view" control; TL review rounds 3 and 4)

Build under test: `node build.mjs` -> `dist/index.html` 191.1 kB, 20 scripts, 10 stylesheets.

### Changes to the QA suite (`tests/qa/f1-t3-plot.mjs`)
- **Scenario L rewritten**, at all four viewports, in m and in ft: first edge from the origin, two edges while drawing, closed plot from the origin, then the same plot pushed by a pan into the top-right corner (under the fit button) and into the bottom-left corner; plus a right triangle tucked into the origin corner on the phone.
- New check `edgeLabelProblems`: every edge must have **its own** label with the right text within 48 px of that edge (matched one-to-one from the recorded `fillText` calls and my own lengths), so a label that is right in text but parked elsewhere would fail.
- `labelProblems` now also fails a label that lies under the Fit view button.
- **New scenario N** (Fit view) at all four viewports, plus the draft-waiting case on the phone.
- The two round-1 screenshots `bug1-*.png` are kept as round-1 evidence; every other file in `tests/qa/shots/F1-T3/` is from this run.

### Results
`node tests/qa/run-f1-t3.mjs`: **896 checks passed, 0 failed** (exit 0, about 2 min). `node tests/run-all.mjs`: exit 0 — lint 0; unit 196 / 0; e2e contract 4 / 0, fit-button 42 / 0, plot 476 / 0, shell 551 / 0, start-card 14 / 0; QA F1-T1 149 / 0 and 1929 / 0 (contract now 204 hooks, `plan-fit` included), F1-T2 765 / 0, F1-T3 896 / 0. Whole run 6 min 40 s.

| Item | Result | Evidence |
|---|---|---|
| Bug 1: first edge from the origin shows its length while drawing | **Fixed** | all four viewports, m and ft ("20.0 m" / "66.0 ft" above the line on the phone); `L-first-edge-m-360x640.png` |
| Bug 1: closed plot from the origin, every edge labelled | **Fixed** | 4 of 4 edge labels + area at all four viewports, m and ft; each label sits next to its own edge (left and bottom on the inner side on the phone); no overlap; `L-closed-ft-360x640.png`, `L-closed-m-640x360.png` |
| Plot pushed into the top-right corner (under the fit button) and into the bottom-left corner | PASS | every edge with a visible stretch keeps its label; none under the button or the scale chip; panning placed and moved nothing; `L-top-right-m-360x640.png` |
| Triangle in the origin corner (phone) | PASS | 16.0 m, 12.0 m, 20.0 m and 96 m² all drawn; `L-corner-triangle-360x640.png` |
| Fit view: target and placement | PASS | one `plot-fit`, `aria-label="Fit view"`, 44 x 44 px, inside the canvas at the top right, hittable, clear of the scale chip and of the start button / start card, at 360x640, 768x1024, 1280x800, 640x360 |
| Fit view: behaviour | PASS | after pinch + pan (touch) or wheel + drag (mouse) the view differs; one tap returns scale and offset of the fitted view exactly; all corners back on screen; no point placed or moved; sample stays unmodified (Skip to 3D still offered); on an empty project it keeps the default view; with an open outline the tap does not fall through to the grid; with a draft waiting it opens no guard dialog; works with Enter and shows a focus ring; page never scrolls |
| Labels and the button | PASS | no label under the button in any scenario (sample, border plots, zoomed views) |
| Regression: scenarios A-K, M of round 1 | PASS | all criteria of the round-1 table still pass with the same figures (20 x 30 m: 20.0 m, 30.0 m, 600 m², 100.0 m / 65.6 ft, 98.4 ft, 6458 sq ft, 328.1 ft; sample: 584 m², 96.9 m / 6286 sq ft, 318.1 ft; scale chip = drawn grid at every zoom step) |

Screenshots looked at by eye this round: `L-first-edge-m-360x640`, `L-closed-ft-360x640`, `L-top-right-m-360x640`, `L-corner-triangle-360x640`, `N-zoomed-360x640`, `L-closed-m-640x360`.

### Open bugs
None.

### Non-blocking observations
- Inner-side labels share the inside of a small plot with the area label: on the phone the 16 x 12 m corner triangle reads "12.0 m / 96 m² / 16.0 m" stacked closely, and a plot in the top-right corner shows "400 m²  20.0 m" side by side. Nothing overlaps and each label is nearest to its own edge; a slightly lighter weight for the area label would separate them (F5-T3 polish).
- At 640x360 the fitted sample hides the 8.9 m label (51 px edge), which the story allows for short edges.
- `plan-fit` is in the markup and unwired until F3-T1 (by TL ruling); it passes the static layout rules in the F1-T1 suite.
- Still open from round 1, by design: closing radius of 22 px at low zoom; Undo after a reload reopens in the stored order.
- `tests/run-all.mjs` takes about 6 min 40 s.

### Verdict
Bug 1 is fixed at every viewport in both units, the Fit view control works on touch, mouse and keyboard, and the full regression is green. All F1-S1, F1-S2 and F1-S3 criteria claimed by this task pass.

VERDICT: PASSED
