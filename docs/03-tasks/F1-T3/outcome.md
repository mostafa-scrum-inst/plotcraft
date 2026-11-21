# F1-T3 — Plot drawing, measurements and vertex editing: outcome

Owner: FS. Step 3f. Plan: `plan.md` (approved round 1, 10 rulings + 4 conditions). Reviews: `plan-review.md`, `impl-review.md` (rounds 1–4, approved), `qa-report.md` (round 1 failed on one major bug, round 2 passed). No code was changed in this step.

## 1. What was built

- **Pure core** (node-tested): units and formatting (R4), plane geometry, every plot drawing rule (snap, add / close / move, counter-clockwise normalisation, default street edge, draft validity), and the coordinate frames of A-5.
- **Shared 2D view** `PC.ui.View2D`: world-to-screen transform, canvas bitmap at device pixel ratio capped at 2, redraw on change only, one Pointer Events gesture machine (tap, one-pointer drag or pan, two-finger pinch and pan, wheel zoom about the cursor, keys), recovery from lost or vanished pointers.
- **Shared 2D drawing** `PC.ui.draw2d`: adaptive grid, outlines, handles, labels with collision and border handling.
- **Stage 1 controller**: tap to place snapped points, close by the first corner or the button, Undo (also reopens a closed shape), Clear with in-page confirmation, live edge with its length on mouse, edge lengths, area, perimeter and scale chip in the chosen unit, corner drag with snap and refusal on self-crossing, "plot too small" blocking message, Fit view button, keys `+` `-` arrows `0` Backspace on the focused canvas.
- **Carried from F1-T2**: `run-all` runs QA's suites as its last step; the first grid tap awaits `PC.ui.start.guard()` and is never placed; closing stores `ans.streetEdge`; drafts are rejected for self-crossing outlines, points outside 0..100 m and clockwise closed plots; the small-plot reason follows the unit.
- **Two F1-T2 minor bugs fixed here**: keyboard focus no longer falls to `<body>`; a double tap on a dialog opener no longer cancels the dialog.

## 2. Files

| File | Content |
|---|---|
| `src/js/core/units.js` | `PC.units` |
| `src/js/core/geom.js` | `PC.geom` (extended from `area` only) |
| `src/js/core/plot.js` | `PC.plot` |
| `src/js/core/frames.js` | `PC.frames` |
| `src/js/core/draft.js` | plot checks through `PC.plot.valid` |
| `src/js/ui/view2d.js` | `PC.ui.View2D` |
| `src/js/ui/draw2d.js` | `PC.ui.draw2d` |
| `src/js/ui/stage-plot.js` | `PC.ui.stages.plot` (stage 1 controller) |
| `src/js/ui/shell.js`, `dialog.js`, `start.js` | the two F1-T2 minors (focus; double tap) |
| `src/js/main.js`, `src/manifest.json` | boot order, `PC.debug` additions, 20 scripts |
| `tests/run-all.mjs` | final `qa` step (`--qa`; every `tests/qa/run-*.mjs` with `--no-shots`) |
| `tests/helpers/touch.mjs` | multi-touch through CDP, mouse drags |
| `tests/unit/{units,geom,plot,frames}.test.mjs`; `draft`, `stages`, `storage` extended | 196 unit tests in total |
| `tests/e2e/plot.spec.mjs`; `shell.spec.mjs` extended | 476 and 551 checks |
| `docs/03-tasks/F1-T3/shots.mjs`, `shots/` | screenshot script and 26 images |

Markup and CSS were not changed by FS. The Designer added the `plot-fit` / `plan-fit` buttons and the phone start-card change (logged against F1-T1). Largest JS file: `stage-plot.js`, under 300 lines.

## 3. Public APIs later tasks reuse

**`PC.units`** (stored values are always metres): `toDisplay(m, unit)`, `fromDisplay(v, unit)`, `areaToDisplay`, `areaFromDisplay`, `fmtLen(m, unit)` ("20.0 m" / "65.6 ft"), `fmtArea(m2, unit)` ("600 m²" / "6458 sq ft"), `lenUnit`, `areaUnit`, `parseNum(text)` (number or `null`; for the F2 numeric fields).

**`PC.geom`** (points `[x, y]`, `EPS = 1e-9`): `area` (signed, positive = counter-clockwise), `perimeter(pts, closed)`, `bbox`, `dist`, `same`, `centroid`, `innerPoint(pts)` (a label point well inside, also for concave shapes), `pointInPoly` (boundary counts as inside), `distPointSeg`, `segRelation(a, b, c, d)` -> `'none' | 'cross' | 'touch' | 'overlap'`. The rectangle helpers of A-2 arrive with F2-T1.

**`PC.plot`**: `snap(p, unit)` (0.5 m / 1 ft, clamped to the area), `inBounds`, `simple(pts, closed)`, `canAdd`, `canClose`, `canMove` (each `{ ok }` or `{ ok: false, reason }`), `normalise` (counter-clockwise, first point kept), `defaultStreetEdge`, `valid(plot)`.

**`PC.frames`**: `make(pts, edgeIndex)` -> `{ origin, ux, uy, w2l(p), l2w(q) }`; `streetEdge(state)` (stored index, else the default rule); `northL(state)` (degrees clockwise from +v); `l2t(center, u, v, h)`.

**`PC.ui.View2D(canvas, options)`** — knows nothing about what is drawn.
- Options: `bounds`, `maxScale`, `draw(view)`, `onResize(view, first)`, `onView(view)`, `hitTest(sx, sy, pointerType)`, `onTap(world, event)`, `onHover(world | null)`, `onDragStart / onDragMove / onDragEnd(handle, world, cancelled)`.
- Members: `toScreen(p)`, `toWorld(sx, sy)`, `scale`, `ox`, `oy`, `width`, `height`, `dpr`, `ctx`, `fit(box, pad)` (pad: number or `{ t, r, b, l }`), `zoomAt`, `panBy`, `resize()`, `invalidate()`, `drawNow()`.
- Statics: `View2D.hitRadius(pointerType)` (22 px touch and pen, 10 px mouse), `View2D.named` (register a view by name so that `PC.debug.toScreen` finds it: `'plot'` now, `'site'` and `'plan'` later).
- Behaviour to rely on: tap = release within 8 px and 700 ms; a second pointer cancels the running gesture and nothing taps until all pointers are up; `lostpointercapture` is a cancel and a new primary pointer drops stale ones.

**`PC.ui.draw2d`**: `clear`, `gridStep(scale, base, minPx = 6)`, `grid(view, step, clip)`, `box`, `path(view, pts, { closed, fill, stroke, width, dash })`, `handles`, `labelRect`, `labelFree`, `label(view, text, sx, sy, placed, { color, font, avoid })`, `clipToView`, `edgeLabels(view, pts, closed, fmt, placed, { avoid })`. `edgeLabels` labels the visible part of each edge, outer side first, then the inner side and positions along the edge; pass the rectangles of floating controls in `avoid`.

**Fit pattern for the other canvas stages**: the controller owns `fit()` (bounding box + `view.fit(box, PAD)`), re-fits when the whole state is replaced and when the canvas resizes while the user has not panned or zoomed, and wires its Fit view button to it (`plan-fit` in F3-T1).

**`PC.debug`** (extended with `Object.assign`): `state()`, `toScreen(name, x, y)` -> viewport coordinates, `view(name)` -> `{ scale, ox, oy, width, height, dpr }`, `plotLabels()` -> rectangles and texts of the labels of the current frame.

**Store usage fixed by this task**: vertex release, close and reopen go through `PC.store.propose`; adding points to an open outline and Clear (which has its own confirmation) use `commit`. `ans.streetEdge` is the default-rule index from the moment the shape is closed and `null` otherwise.

## 4. How to verify

1. `node tests/run-all.mjs` -> exit 0 (about 6 min 40 s; `--unit` and `--e2e` are the fast subsets). Figures at sign-off are in section 5.
2. `node docs/03-tasks/F1-T3/shots.mjs` regenerates the review screenshots.
3. By hand on `dist/index.html`: tap three or more points, close on the first one; drag a corner; switch m / ft; pinch or wheel, then Fit view; Load sample project (584 m², 96.9 m, "1 square = 1 m" on a phone).

## 5. QA sign-off

`qa-report.md` round 2, 2026-11-20: **PASSED, no open bugs.** QA's suite `tests/qa/f1-t3-plot.mjs`: 896 checks passed, 0 failed at 360x640, 768x1024, 1280x800 and 640x360. Full `run-all` in the same session: lint 0; unit 196 / 0; e2e contract 4 / 0, fit-button 42 / 0, plot 476 / 0, shell 551 / 0, start-card 14 / 0; QA F1-T1 149 / 0 and 1929 / 0, F1-T2 765 / 0, F1-T3 896 / 0.
Round 1 had failed on one major bug (edge labels dropped next to the canvas border, F1-S2); fixed in review round 3 and confirmed. QA also confirmed both F1-T2 minors fixed. All F1-S1, F1-S2 and F1-S3 criteria claimed by this task pass.

## 6. Accepted deviations and rulings (Tech Lead)

| Item | Ruling |
|---|---|
| Keyboard point placement and keyboard vertex editing | Cut (plan condition 1). Kept: `+` `-` arrows `0` Backspace. |
| Vertex insert / delete on a closed plot | Not built (not in the stories). |
| Undo on a closed shape reopens it | Approved; the "drawing order" flag is session-only. |
| Tap time limit | 700 ms (A-15 updated). |
| Draft points must lie in 0..100 m | Approved. |
| Scale chip follows the drawn grid; grid square minimum 6 px | Approved; phone sample reads "1 square = 1 m". |
| Label culling for short edges | Approved (F1-S2 allows it). |
| Focus fix only after keyboard input, through a zero-delay timer | Accepted. |
| `PC.geom.innerPoint`, `PC.debug.view`, `View2D.named`, per-side fit padding | Accepted. |
| Release point of a corner drag counts as the last move | Accepted. |
| 350 ms settle after injected touch gestures (test helper only) | Accepted. |
| On-screen Fit view control | Required; Designer added `plot-fit` / `plan-fit`, FS wired `plot-fit`. |
| Wider empty-view margin, re-fit on close | Tried and withdrawn (they moved the view under existing flows); the inner-side label fallback made them unnecessary. |

## 7. Known limits and tech debt

| Item | Where it is resolved |
|---|---|
| `plan-fit` is in the markup and not wired | F3-T1 |
| F1-S3 R5 criterion (confirmation on vertex release, Cancel returns the vertex) is proven only with a stubbed gate | gate in F2-T1; end to end in F3-T2 |
| Clear's confirmation does not yet mention floor plans | F3-T2 adds the sentence (one dialog, never two) |
| Inner-side edge labels sit close to the area label on small plots; a lighter area label would separate them (QA note) | F5-T3 polish |
| `run-all` takes about 6 min 40 s, most of it QA's layout suite | accepted; use `--unit` / `--e2e` while developing |
| Real-phone checks: pinch and pan, tap suppression after a fast drag, `inert`, `:has()` rules, `localStorage` inside the sandboxed iframe | F1 publishing point |
| Closing radius is 22 px at any zoom, so at low zoom a tap near the first corner closes rather than adds | by design; revisit only if the hosted check shows a problem |
| After a reload, Undo reopens a clockwise-drawn plot in the stored (normalised) order | by ruling (session-only flag) |
| At 640x360 the fitted sample hides the 8.9 m label (short edge) | allowed by F1-S2 |
| A device-pixel-ratio change without a size change (desktop browser zoom) is picked up at the next resize | accepted |
| `plot-grid` text ("1 m, snap 0.5 m") is written in the controller, not derived from `PC.C.GRID` | change if 4.3 numbers ever change |
| `PC.geom.innerPoint` is not yet in the A-2 file table | TL adds it at the next edit |
| Toast auto-dismiss after a keyboard activation has no check in `shell.spec.mjs` (QA's suite covers dismissal by timer) | when `shell.spec.mjs` is next opened |
