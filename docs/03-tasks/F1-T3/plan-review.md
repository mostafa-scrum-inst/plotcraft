# F1-T3 plan review — Tech Lead

## Round 1 — 2026-11-20

Reviewed `docs/03-tasks/F1-T3/plan.md` (sections 1–9) against the F1-T3 block of `F1-plan.md`, `architecture.md` (A-2, A-4, A-5, A-15, A-16), stories F1-S1 / S2 / S3, R2, R4, the three items carried over from `F1-T2/impl-review.md`, and the two open minors in `F1-T2/qa-report.md`.

### Assessment
The plan covers every criterion of F1-S1..S3 (the acceptance map in section 8 is complete; I checked each story bullet against it) and keeps the rules pure and node-testable (`PC.plot`, `PC.geom`, `PC.units`, `PC.frames`) with a thin controller, as the architecture asks.
- **Carried items**: all three are in: `run-all` gains the `qa` step (section 7); the guard is awaited before the first point and the tap is not placed; closing stores `ans.streetEdge`; `validState` gains `PC.plot.valid`; the small-plot reason becomes unit-aware with a test (49 m2 -> "538 sq ft" is the right figure).
- **`View2D`** is plot-agnostic with the callbacks A-15 names, DPR cap 2, Pointer Events with capture, redraw on change only. The gesture machine (8 px slop, second pointer cancels and "spends" the gesture until all pointers are up) is what makes "pinch never places a point" true, including the one-finger-lifts-first case, which is in the tests.
- **Rules**: touch counts as crossing, closing checks the closing edge, CCW normalisation keeps the first point, default street edge with both tie rules: consistent with A-5 and F1-S1.
- **R5 staging**: release goes through `propose` exactly once and a stubbed `false` returns the vertex; end-to-end in F3-T2. Correct.

### Rulings on section 9
1. **No vertex insert/delete on a closed plot — agreed.** Not in the stories; do not build it.
2. **Undo on a closed shape reopens it — approved.** Closing too early would otherwise mean Clear and redraw. The "restore original order" flag is session-only: after a reload the order is simply the stored (normalised) one. Do not persist anything for it.
3. **`propose` vs `commit` — approved as proposed**: vertex release, close and reopen through `propose`; adding points to an open outline through `commit`; Clear keeps its own single confirmation and commits, and its text gains the floor-plan sentence once plans exist (F3-T2 adds that line; one dialog, never two).
4. **Tap time limit — 700 ms.** A-15 updated. The 8 px rule is what separates taps from drags.
5. **Draft points must lie in 0..100 — approved.** It is the same rule the UI enforces ("points outside the 100 x 100 m area cannot be placed"). QA to update its bad-draft set.
6. **Scale chip follows the drawn grid — approved**; that is what "stays correct when zooming" means. `plot-grid` keeps the base grid and snap.
7. **Label culling — approved** (F1-S2 allows it; readouts always carry area and perimeter).
8. **CDP two-finger tests — approved**; the real-phone check at the F1 publishing point is the backstop.
9. **`run-all` duration — accepted**; the `qa` step runs with `--no-shots`.
10. **F1-T2 minors — fix both inside F1-T3**, as a clearly separated part of the change:
    - focus: after `render` and after a dialog closes, if `document.activeElement` is `<body>` or a hidden/disabled element, focus the current step button;
    - double tap: ignore backdrop taps for 300 ms after a dialog opens.
    Each gets a case in `shell.spec.mjs`; QA re-tests them in the F1-T3 round and they are recorded in both tasks' outcome files.

### Conditions (binding; checked at the implementation review, no plan revision needed)
1. **Cut the keyboard drawing and keyboard vertex editing** (cross-hair, Enter to place, `[` / `]` vertex selection, arrow-move). R2 asks for basic keyboard on controls (Tab / Enter / Esc); a second input method for the canvas is not in any story and costs code and a test scenario. Keep only: `+` / `-` zoom, arrow keys pan, `0` fit, Backspace = Undo on the focused canvas. Drop e2e scenario 11 accordingly.
2. The view is re-fitted when the whole state is replaced (sample loaded, draft resumed, Start new), not only on first entry.
3. `PC.debug` is extended with `Object.assign` (as in F1-T2).
4. `View2D` and `draw2d` must stay free of plot-stage knowledge (F2-T2 and F3-T1 reuse them with frame-L coordinates); anything plot-specific lives in `stage-plot.js`.

### Non-blocking notes
- Lift QA's page-hide case into `shell.spec.mjs` as planned.
- In ft mode the 100 m bound is not on the 1 ft lattice; `snap` clamps after snapping, so the last column of points sits at 100 m exactly. That is fine; just make sure the unit test pins it.
- The red-dashed live edge for a refused position is a nice touch; it must use `palette2d.state.invalid`, not a new colour.

VERDICT: APPROVED
