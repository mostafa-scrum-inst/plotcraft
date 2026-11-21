# F1-T3 implementation plan — plot drawing, measurements, vertex editing (FS)

Scope per `F1-plan.md` F1-T3: stories F1-S1, F1-S2, F1-S3; rules R2 (canvas gestures), R4. Binding: A-2, A-3, A-4, A-5, A-15, A-16, the F1-T1 hook contract, and the three items carried over in `F1-T2/impl-review.md`.
No markup or CSS change is planned (the canvas is already `position: absolute; inset: 0; touch-action: none`). JS only adds `tabindex="0"` and `aria-describedby` to `plot-canvas` at run time.

## 1. Files

| File | Layer | Responsibility |
|---|---|---|
| `src/js/core/units.js` (new) | core | `PC.units`: conversion and formatting (R4). |
| `src/js/core/geom.js` (extend) | core | `PC.geom`: perimeter, bbox, distances, segment intersection, point-in-polygon, centroid. |
| `src/js/core/plot.js` (new) | core | `PC.plot`: every F1 drawing rule as pure functions (section 3). |
| `src/js/core/frames.js` (new) | core | `PC.frames`: `make(pts, edgeIndex)` -> `{ origin, ux, uy, w2l, l2w }`, `northL(state)`, `l2t(center, u, v, h)` (A-5). Used from F2 on; unit-tested here. |
| `src/js/core/draft.js` (edit) | core | `validState` gains the plot checks of section 6. |
| `src/js/core/stages.js` | core | Unchanged: it already calls `PC.units.fmtArea`; only the test is new. |
| `src/js/ui/view2d.js` (new) | ui | `PC.ui.View2D`: transform, DPR canvas, gesture recogniser (section 4). No knowledge of plots. |
| `src/js/ui/draw2d.js` (new) | ui | `PC.ui.draw2d`: grid, bounds, polygon, vertex handles, edge labels, area label, live edge. Reused by F2-T2 / F3-T1. |
| `src/js/ui/stage-plot.js` (new) | ui | `PC.ui.stages.plot`: stage 1 controller (section 5); replaces the empty controller in `main.js`; adds `PC.debug.toScreen`, `PC.debug.plotLabels`. |
| `src/js/main.js`, `src/manifest.json` (edit) | | Register the controller; list the new files. |
| `tests/run-all.mjs` (edit) | | Final step `qa` (section 7). |
| `tests/helpers/touch.mjs` (new) | | Two-finger gestures through CDP `Input.dispatchTouchEvent`; mouse drag and wheel helpers. |
| `tests/unit/units.test.mjs`, `geom.test.mjs`, `plot.test.mjs`, `frames.test.mjs` (new); `draft.test.mjs`, `stages.test.mjs` (extend) | | Section 7. |
| `tests/e2e/plot.spec.mjs` (new); `shell.spec.mjs` (extend: page-hide flush, QA suggestion) | | Section 7. |

## 2. Units and geometry (pure, node-tested)

`PC.units` (1 ft = `PC.C.FT`; stored values are always metres):
- `toDisplay(m, unit)`, `fromDisplay(v, unit)`, `areaToDisplay(m2, unit)`, `areaFromDisplay(v, unit)`
- `fmtLen(m, unit)` -> `"20.0 m"` / `"65.6 ft"` (1 decimal); `fmtArea(m2, unit)` -> `"600 m²"` / `"6458 sq ft"` (whole number); `lenUnit(unit)`, `areaUnit(unit)`
- `parseNum(text)` -> finite number or `null` (trims, accepts a decimal comma); for the F2 numeric fields.

`PC.geom` (points are `[x, y]`; tolerance `EPS = 1e-9`):
- `area(pts)` (exists), `perimeter(pts, closed)`, `bbox(pts)`, `dist(a, b)`, `centroid(pts)`, `pointInPoly(p, pts)`, `distPointSeg(p, a, b)`
- `segRelation(a, b, c, d)` -> `'none' | 'cross' | 'touch' | 'overlap'` (proper crossing; endpoint or T contact; collinear with shared length).
- The rectangle helpers named in A-2 (`segmentRectDistance`, `rectClearOfPolygon`) are left to F2-T1, their only user.

## 3. Plot rules (`PC.plot`, pure)

World frame W: metres, y up, drawable area `0..100` on both axes (`PC.C.PLOT.extent`).

| Function | Result |
|---|---|
| `snap(p, unit)` | Nearest lattice point: 0.5 m (m) or 1 ft = 0.3048 m (ft), from the origin, clamped into the area, rounded to 4 decimals. Existing points are never passed through it again. |
| `inBounds(p)` | Inside `0..100` on both axes. |
| `simple(pts, closed)` | True when no vertex repeats, no edge has zero length, non-neighbouring edges are `'none'`, and neighbouring edges do not fold back (`'overlap'`). A touch counts as crossing. |
| `canAdd(pts, p)` | `{ ok }` or `{ ok: false, reason }`: `'same'` (on the previous point: ignored silently), `'max'` (13th), `'outside'`, `'cross'` (new edge crosses or touches an existing edge, or lands on an older vertex). |
| `canClose(pts)` | `'few'` (under 3), `'cross'` (closing edge crosses or touches; also all points on one line). |
| `canMove(pts, i, p)` | `'outside'`, `'cross'` (result not `simple`). The 50 m2 limit is not a move rule: it blocks Next (below). |
| `normalise(pts)` | Counter-clockwise copy (reversed when the signed area is negative, first point kept first). |
| `defaultStreetEdge(pts)` | Edge with the lowest midpoint y; tie: longer; still tied: lowest index. |
| `valid(plot)` | For drafts: `simple`, every point in bounds, and counter-clockwise when closed. |

## 4. Shared 2D view (`PC.ui.View2D`, A-15)

```js
var v = new PC.ui.View2D(canvas, { bounds, minScale, maxScale,
  draw(view),                       // called once per animation frame after invalidate()
  hitTest(sx, sy, pointerType),     // -> handle (any value) or null
  onTap(world, ev), onHover(world | null),              // hover: mouse and pen only
  onDragStart(handle, world), onDragMove(handle, world), onDragEnd(handle, world, cancelled) });
v.toScreen([x, y]) -> [sx, sy];  v.toWorld(sx, sy) -> [x, y];  v.scale /* CSS px per metre */;  v.width, v.height
v.fit(bbox, padPx);  v.zoomAt(sx, sy, factor);  v.panBy(dx, dy);  v.resize();  v.invalidate();  v.ctx;  v.destroy()
```

- **Canvas and DPR.** Bitmap = CSS size x `min(devicePixelRatio, 2)`; the context is pre-scaled so all drawing is in CSS pixels (palette values are CSS pixels). A `ResizeObserver` on the wrapper (fallback `window` `resize`) re-sizes and keeps the world point at the centre. A zero-size canvas (hidden stage) is skipped; `enter()` calls `resize()`. Redraws are coalesced with `requestAnimationFrame` and only happen on change (no idle loop).
- **Pointer Events only**, with `setPointerCapture`; `pointercancel` cancels the gesture. One state machine:
  - 1 pointer down on a handle (`hitTest`) -> possible handle drag; on empty space -> possible tap or pan.
  - Movement over 8 px -> drag: handle drag (`onDrag*`) or pan. Release within 8 px and 400 ms -> `onTap`. A longer still press does nothing. So a drag is never a tap.
  - 2nd pointer down -> any tap/drag in progress is cancelled (`onDragEnd(..., true)`), pinch starts: zoom by the distance ratio about the midpoint, pan by the midpoint movement. The gesture stays "spent" until every pointer is up, so lifting one finger never places a point.
  - Wheel (`{ passive: false }`, `preventDefault`) zooms about the cursor; trackpad pinch arrives as ctrl+wheel and is handled the same.
- **Limits.** Scale between "whole 100 m area fits" and 80 px/m; panning keeps part of the area on screen.
- **Hit targets.** Handle radius 22 px for touch and pen (44 px target), 10 px for mouse; the nearest handle wins.
- `touch-action: none` (already in CSS) plus captured pointers: the page neither scrolls nor zooms while the canvas is touched.

## 5. Stage 1 controller (`ui/stage-plot.js`)

State in the store: `plot.pts`, `plot.closed`, `ans.streetEdge`, `ans.unit`. Transient only: hover point, running drag, keyboard cursor, current message. Everything is redrawn from state.

**View.** Empty project: about 40 m across, origin at the lower left with a margin. With a plot (sample, resume): fitted with 34 px padding. The view is session state and is kept when coming back to stage 1.

**Grid and scale (4.3, F1-S2).** Base square 1 m (m) or 5 ft (ft). When a square would be under 8 px, the drawn square grows x5, x10, x50; every fifth line is major. `plot-scale` shows the square actually drawn ("1 square = 1 m", "1 square = 5 m", "1 square = 5 ft", "1 square = 25 ft"), so it stays correct while zooming. `plot-grid` shows "1 m, snap 0.5 m" / "5 ft, snap 1 ft". The 100 x 100 m area has a visible border.

**Drawing (F1-S1).**
- Tap -> `snap` -> `canAdd` -> `commit` pushes the point. `'same'` is ignored; other reasons show an inline message in `plot-msg` (`data-kind="warn"`) and place nothing: "That edge would cross the outline", "A plot can have at most 12 corners", "Outside the 100 x 100 m drawing area".
- **Guard (carried item 2):** when `PC.store.session.draftPending`, the tap first awaits `PC.ui.start.guard()`. After OK the draft is gone and the tap is **not** placed; after Cancel nothing changes.
- Close: tap inside the first vertex's hit radius, a snapped point equal to the first vertex, or "Close shape". `canClose` refusal shows the message. On success one commit: `pts = normalise(pts)`, `closed = true`, **`ans.streetEdge = defaultStreetEdge(pts)`** (carried item 2; A-5). "Close shape" is `disabled` under 3 points, with the hint "Place at least 3 points, then close the shape."
- Live edge from the last point to the pointer, with its length, on mouse/pen hover (dashed, `plot.live`); drawn red-dashed when `canAdd` would refuse.
- Undo: open shape -> removes the last point. Closed shape -> reopens it (`closed = false`, `streetEdge = null`, original point order restored when closing reversed it); a further Undo removes the last point. Disabled with no points.
- Clear: removes everything (`streetEdge = null`). With a closed plot it asks through `PC.ui.dialog.confirm` first. Disabled with no points.
- Below 50 m2 after closing: `plot-msg` `data-kind="block"`: "Plot is too small: 42 m² (minimum 50 m²)" in the current unit; Next is already disabled by `PC.stages` (carried item 3).

**Measurements (F1-S2, R4).** All text through `PC.units`. Each edge has a label at its midpoint, offset outward, with a halo; a label is hidden when its edge is shorter on screen than the label plus 12 px, or when it would overlap an already placed label (longer edges first). Closed plot: area label at the centroid when that lies inside the plot; `plot-area`, `plot-perimeter`, `plot-points` readouts always. Unit change redraws labels, grid, scale chip and readouts in one render; `plot.pts` is untouched.

**Vertex editing (F1-S3).**
- Closed plot: every vertex is a handle. Drag -> `snap` -> `canMove`. Valid positions update the transient polygon, so lengths and area follow live. An invalid position is not shown: the vertex stays at its last valid position and `plot-msg` says why.
- Release: unchanged position -> nothing. Otherwise **`PC.store.propose(s => { s.plot.pts[i] = p; })`**; `false` (R5 Cancel) leaves the state as it was, so the vertex is drawn back at its origin. Index order is kept, so `streetEdge` stays valid.
- A 2nd finger or `pointercancel` during a drag cancels it.
- **R5 criterion.** `propose` is a pass-through until F2-T1 and no plans exist before F3-T1, so the confirmation ("Cancel returns the vertex") can only be verified end to end in F3-T2, as the F1 plan says. What is tested now: release goes through `propose` exactly once, and with `propose` stubbed to resolve `false` the vertex returns and the state is unchanged.
- Inserting or deleting a vertex of a closed plot is not in F1-S1..S3 and is not built (Q1).

**Keyboard (R2, basic).** The canvas is focusable. Arrow keys move a visible cross-hair by one snap step (starts at the view centre); Enter or Space acts as a tap there (place, or close on the first vertex); Backspace = Undo; `+` / `-` zoom; Shift+arrows pan; `0` fits. Closed plot: `[` and `]` select the previous/next vertex, arrows move the selected vertex one snap step per press (same `canMove` + `propose` path), Esc deselects. Buttons keep Tab/Enter as today. `plot-msg` (`role="status"`) announces results.

**Test hooks.** `PC.debug.toScreen('plot', x, y)` -> viewport coordinates; `PC.debug.plotLabels()` -> rectangles of the labels drawn in the last frame.

## 6. Draft validation (carried item 2)

`validState` additionally requires `PC.plot.valid(plot)`: no self-intersection for open and closed outlines, every point inside `0..100`, counter-clockwise when closed. This replaces the looser bounding-box rule. `streetEdge: null` stays legal. No schema change, so `PC.DRAFT_V` stays 1; a draft that breaks the new rules is discarded silently like any other invalid draft.

## 7. Tests

**`tests/run-all.mjs` (carried item 1).** Final step `qa`: every `tests/qa/run-*.mjs`, sorted, each as a child process with `--no-shots`; runs by default and with `--qa`; any non-zero exit fails the run. `--unit` / `--three` / `--e2e` alone still skip it.

**Unit (node).**
- `units`: 20 x 30 m -> "20.0 m", "30.0 m", "600 m²", then "65.6 ft", "98.4 ft", "6458 sq ft"; round trips; `parseNum` cases.
- `geom`: sample polygon 584 m2 and 96.9 m; `segRelation` table (cross, T-touch, endpoint touch, collinear overlap, collinear apart, parallel); `pointInPoly` incl. concave; `distPointSeg`; centroid.
- `plot`: `snap` in m and ft (1 ft lattice, clamp); `canAdd` for same point, 13th vertex, outside, crossing, touching an older vertex and edge; `canClose` under 3, crossing closing edge, collinear touch, all on one line; `canMove` valid, crossing, outside; clockwise input normalised with the first point kept; `defaultStreetEdge` incl. both tie rules; `valid`.
- `frames`: sample frame (origin (0,0), u = +x, v = +y), a rotated street edge, `w2l`/`l2w` round trip, `l2t` axes, `northL`.
- `draft` (extend): rejected: bow-tie closed plot, open outline that crosses itself, clockwise closed plot, point at x = 100.5 or y = -1; sample and an open 2-point outline still accepted.
- `stages` (extend, carried item 3): 49 m2 plot gives "…(minimum 50 m²)" in m and "…(minimum 538 sq ft)" in ft.

**E2E `plot.spec.mjs`** at 360x640 touch, 768x1024 touch, 1280x800 mouse; coordinates from `PC.debug.toScreen`; state from `PC.debug.state()`:
1. Place points; close by tapping the first vertex and, separately, by the button; closed plot is counter-clockwise and `streetEdge` is the default-rule index.
2. Close disabled with the hint under 3 points; duplicate point ignored; crossing vertex rejected with message and not placed; crossing closing edge refused; 13th vertex refused; tap outside the area refused.
3. Undo (open, then reopening a closed shape), Clear with confirmation (Cancel keeps, OK clears), no native dialog.
4. Under 50 m2: blocking message, Next disabled; unit ft changes the message text.
5. Drag is not a tap (touch and mouse); drag on empty space pans; wheel zooms about the cursor; two-finger pinch and two-finger drag (CDP touch) change the view and place no point, also when one finger lifts first.
6. Unit toggle: 20 x 30 m rectangle readouts 600 m² / 100.0 m -> 6458 sq ft / 328.1 ft; labels (via `plotLabels`) and `plot-scale` / `plot-grid` change; `plot.pts` deep-equal before and after. Scale chip changes when zoomed out and stays truthful (measured line spacing = chip value x scale).
7. Vertex drag: labels and readouts change during the drag; release commits the snapped point; a drag into a self-intersection shows the message and the vertex is back at its last valid position; `propose` stubbed to `false` -> vertex returns.
8. Hit area: a touch 20 px away from a vertex starts a drag; at 30 px it does not.
9. Sample at 360x640: no two label rectangles overlap; none outside the canvas.
10. Pending draft: tap on the grid opens the Start-new dialog; Cancel -> no point, draft kept; OK -> draft removed, still no point; next tap places one.
11. Keyboard: arrows + Enter place three points and close; `]` + arrow moves a vertex; Backspace undoes.
12. Reload with a closed hand-drawn plot -> Resume restores it exactly; a draft with a bow-tie plot in storage -> discarded silently.
13. Every scenario: `window.scrollY` and visual-viewport scale unchanged, zero `pageerror` / `console.error`, no native dialog, no request beyond the three.js tag, the F1-T1 layout assertions.

`shell.spec.mjs` is updated where stage 1 now renders (readouts after the sample) and gains the page-hide flush case QA suggested.

## 8. Acceptance map

| Criterion | Where | Test |
|---|---|---|
| F1-S1 place/snap/join; close by first vertex or button | `plot.snap`, `canAdd`, controller | plot unit; e2e 1 |
| F1-S1 Close disabled under 3 with hint; duplicate ignored | `canClose`, `canAdd 'same'` | e2e 2 |
| F1-S1 crossing vertex and crossing closing edge rejected | `simple`, `segRelation` | geom/plot unit; e2e 2 |
| F1-S1 13th vertex refused; outside 100 x 100 m refused | `canAdd` | plot unit; e2e 2 |
| F1-S1 Undo, Clear (confirmation when closed) | controller + `dialog.confirm` | e2e 3 |
| F1-S1 under 50 m2 blocks Next | `PC.stages` + message | stages unit; e2e 4 |
| F1-S1 touch: tap places, pinch/drag does not; desktop wheel and pan | `View2D` | e2e 5 |
| F1-S2 lengths while drawing (live edge on desktop) and after; area, perimeter | `draw2d`, `units` | units unit; e2e 6, 7 |
| F1-S2 unit toggle converts everything, vertices do not move | render from state through `PC.units` | e2e 6 |
| F1-S2 scale indicator correct when zooming, per unit | adaptive grid | e2e 6 |
| F1-S2 labels legible at 360 px | label culling | e2e 9 |
| F1-S3 drag with snap, live values | controller + `canMove` | e2e 7 |
| F1-S3 self-intersecting drag refused, vertex returns, message | `canMove` | plot unit; e2e 7 |
| F1-S3 handles with a 44 px hit area on touch | `hitTest` radius 22 | e2e 8 |
| F1-S3 R5 on release | `propose` on release | stub test now; end to end in F3-T2 |
| F1-S3 Q6 back to default after clear and redraw | `streetEdge` set on close, `null` on clear/reopen | e2e 1, 3 |
| R2 no page scroll/zoom while dragging; keyboard basics | `View2D`, key handling | e2e 11, 13 |
| R4 metres stored, display conversion only | `PC.units`, `snap` | units/plot unit; e2e 6 |

## 9. Risks and questions for the Tech Lead

1. **Vertex insert/delete on a closed plot** is not in F1-S1..S3 (the stories give move, Undo and Clear) and has no markup hook. I do not build it. If it is wanted it needs a PM line and two Designer hooks; say so now.
2. **Undo on a closed shape reopens it** (then removes points). The story only says the button exists; the alternative is to disable Undo once closed. Reopening clears `streetEdge` and, later, is a layout change.
3. **Which plot changes go through `propose`?** Proposed: vertex release, close, and reopen use `propose`; adding points to an open outline uses `commit` (no plan can be valid without a closed plot). **Clear** already has its own confirmation, so it would use `commit` and, once plans exist, its dialog text adds "Floor plans will be regenerated" (one dialog, not two). Confirm.
4. **Tap limit of 400 ms (A-15)**: a slow, deliberate press with a mouse places nothing. I follow A-15; raising it to about 700 ms would be kinder and still separates taps from drags by the 8 px rule. Your call.
5. **Draft points must now lie in `0..100`** (was: bounding box up to 100 m). QA's bad-draft set may need one case updated. The sample and everything the UI can produce already comply.
6. **Scale chip wording when zoomed out** ("1 square = 5 m"): F1-S2 says the indicator must stay correct when zooming; I read that as the chip following the drawn grid. `plot-grid` keeps showing the base grid and snap.
7. **Label culling** hides labels of short edges until zoomed in (allowed by F1-S2). Area and perimeter are always in the readout, so nothing is lost at 360 px.
8. **Two-finger tests** use raw CDP touch events; if headless Chrome maps them differently from a phone, the F1 publishing check on a real device is the backstop (already planned).
9. **`run-all` duration**: the QA layout suite adds a few minutes to the default run; `--unit` and `--e2e` stay fast for the inner loop.
10. **F1-T2 QA minors** (keyboard focus position after a stage change; double tap on a dialog opener) touch `shell.js` / `start.js`; I can fix them inside this task if you prefer one change over a separate fix round.
