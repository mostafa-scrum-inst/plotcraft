# F5-T3a implementation notes

## Designer (branch f5t3-des)

Owned files only: `src/css/*`, `src/index.html` markup, `src/js/data/*` (`sky.js`, `palette2d.js`), the `sky.test` GOLD
rows (generated), `tests/contract/hooks.json` (three new hooks), `tests/e2e/device-sweep.spec.mjs` (new),
`tests/e2e/interior.spec.mjs` (removed, folded), `tests/e2e/site-legend.spec.mjs` (one filter line), and
`docs/03-tasks/F5-T3/verify/*`. No core / three / ui JS. The FS's lines that use the new hooks are on f5t3-fs.

### 1. O-1, evening shadows (data only)

`sky.js`: the 17 h key goes from sunI 0.62 / hemiI 0.40 to **0.75 / 0.34**, and the 18 h key from 0.42 / 0.36 to
**0.55 / 0.30**. Colours, every other key, and the A-13 rules are unchanged.

QA metric (`verify/o1.mjs`): the number of pixels whose summed |ΔRGB| is above 30 when every shadow caster is turned
off. Real r128, 1280x800, sample house.

| Look | Before | After | Target |
|---|---:|---:|---|
| summer 17.5 h | 204 | **20 824** | ≥ 15 000 |
| summer 17 h | 47 336 | 52 041 | — |
| winter 17.5 h | 32 898 | 66 170 | — |
| summer 12 h | 14 381 | 14 381 | unchanged |
| summer 8 h | 41 250 | 41 250 | unchanged |

- **Noon:** `compute(12, 'summer')` still equals the F4-T1 noon goldens. Neither the 12 h key nor the season blend
  changed, and the 12 h rows of GOLD are byte-identical.
- **sky.test GOLD:** regenerated with `verify/golden.mjs`, which is the A-13 reference. Before the change, `--check`
  reproduced the old GOLD exactly. Only the four 17.5 h rows changed:

  | Season | background | sunColor | sunI | hemiSky | hemiGround | hemiI |
  |---|---|---|---|---|---|---|
  | spring | #E0B088 | #FEB77B | 0.65 | #C5B3BB | #767355 | 0.32 |
  | summer | #DFAA81 | #FFB273 | 0.65 | #C1AEB8 | #6F6E4F | 0.32 |
  | autumn | #E2AE83 | #FEB577 | 0.65 | #C8B1B2 | #786A50 | 0.32 |
  | winter | #DDB496 | #F7BB8B | 0.65 | #C4B7C3 | #887E74 | 0.32 |

  Nothing else in that file changed. The FS acks in review.
- **F3-T3 colour checks still hold:** the evening E_top is about 0.20–0.21, and the night background is L* ≤ 11.5.
  `unit` passes 420/0, and `sky` + `data-tables` pass 20/0.
- The new values went to QA before merge, as the TL required.

### 2. CSS and markup

| Item | Change | Measured |
|---|---|---|
| 640x360 stage 5, side by side (TL ruling 1) | Short landscape, panel expanded: `.pc-v3:has(> .pc-v3panel:not(.is-collapsed)) > canvas { width: calc(100% - var(--panel-w-short)) }`. `.pc-v3__center` gets `right: var(--panel-w-short)`, and the caption is centred over what is left. Collapsed: full width again. The canvas needs an explicit width, not `right`, because it is a replaced element: with `width: auto` it kept its 524 px attribute width. | Canvas 368 x 262, panel 368–640, overlap **0 px²** (was 71 264 px², 42.5 %). Reset frames the whole plot in 368 px: max \|ndc\| ≤ 1. |
| Desktop caption and centre cards | Caption `max-width: calc(100% - 320px - 3 * var(--s4))`, centred left of the card. `.pc-v3__center` stops at the card. Both go back to full width when the panel is collapsed. | The caption never meets the panel or toggle in the seeked tour (sweep). |
| Header no-save chip | `<button data-pc="nosave-chip" hidden>` after the unit seg, 44 px icon button, `#i-nosave`, aria-label and title "Drafts are not saved on this device". The FS shows it when `!ui.storage.available`. | 44 x 44. |
| Legend Parking / Pool | `site-legend-parking` and `site-legend-pool` (hidden), swatches use the palette2d parking / pool fill and stroke. The FS toggles them. They are `display: none` on the 360 phone strip, which has no room for them, just like the mark. | 768x1024: one line with all 8 entries. **1280x800: 2 lines (46 px) with all 8 entries, whether the mark reads "set by you" or "by you".** So the PM text stays "set by you" (plan §8 item 2: change it only if that removes the wrap). |
| palette2d | `font.area` is `500 12px system-ui…`, and `label.area` is `#46535F`. The FS draws with them. | — |
| Stage-4 cards ≥ 600 px (TL F3-T3 note 4) | `.pc-interior .pc-card__name, .pc-card__desc { align-self: stretch }` inside the ≥ 600 block. The phone grid's `end` / `start` had pushed the name and radio to the right of the flex column. | Name and dot now start at the description's edge. Before, they were 113–263 px off at 1280. |
| Stage-3 640x360 readout | `.pc-plans__readout.is-empty .pc-tb__cell + .pc-tb__cell { display: none }`: with no room selected, only "None selected" shows. The FS sets `.is-empty`. | 3 rows → 1 row. |
| Stage-3 640x360 blocking message (plan §8 item 8) | **No change.** Measured with `verify/plans640.mjs`, a 4.5-line block message (longer than any template allows) leaves Approve at 267–311 inside the 119–311 panel, fully in view above the bar (314–358). The panel scrolls 6 px. Clamping to 3 lines would hide part of the reason that blocks approval, so I left it. | Approve in view. |

### 3. Device sweep and interior fold (TL rulings 1 and 3)

`tests/e2e/device-sweep.spec.mjs` uses the three mock. It runs stages 1–5 x {sample, empty}:

- **Viewports:** 360x640 and 1280x800 by default; 640x360 and 768x1024 are added with `QA_FULL=1`.
- **Projects:**
  - "empty" is the untouched questionnaire on a 20 x 30 m rectangle: `PC.store.defaults()` with its 6 default rooms.
  - With zero rooms there is no 3D house at all: `PC.house.build` returns null and stage 5 shows "3D view unavailable". This is on the F5-T3b list.
- **Every stage is checked for:**
  - no page scroll;
  - no sideways overflow and no clipped text;
  - 44 px targets;
  - Back / Next in view;
  - WCAG AA text contrast (4.5:1, or 3:1 for large text; disabled controls exempt; text straight over a canvas skipped);
  - a visible keyboard focus ring on the first 16 Tab stops (the focused look differs from the blurred look, on the element or the card / segment after it);
  - a clean log.
- **Stage 5 also checks:**
  - at 640x360, the expanded panel covers 0 px² of the canvas, and the canvas is 368 px wide;
  - Reset frames the whole plot: corners projected with the live pose, `PC.C.CAM.fov` and the canvas aspect, all within ±1;
  - the tour caption never meets `v3-panel` or `v3-panel-toggle` at τ = 0.5, 3, 6, 10, 15, 25 and 40 s (Start, then `PC.debug.tourSeek`).
- **Interior fold:** interior.spec's checks moved into the sweep word for word, under the same names. They run at 360x640 and 1280x800 by default, plus 360x740, 640x360 and 768x1024 with `QA_FULL=1`. One check was added: card name and radio left-aligned with the description, at ≥ 600 px.
- **Runs:**
  - default: 186 / 0 in 8.9 s;
  - `QA_FULL=1`: 380 / 0 in 20.0 s;
  - the removed interior.spec took about 5 s, so the default run grows by about 4 s.

**Mutation proofs** were run on a copy of the tree with `node tests/e2e/device-sweep.spec.mjs` and reverted after; the
diff of the copy against the tree was empty after each one. M1–M4 are the F3-T3 e2e mutations from F3-T3/outcome.md,
re-run on the folded checks.

| # | Mutation | Caught by |
|---|---|---|
| M1 | a piece removed from the Full vignette | "Q19 vignettes show the living table's sparse and full piece counts" (360x640, 1280x800) |
| M2 | the two Q19 `:has()` rules removed | "choosing Classic recolours the Q19 vignettes" (360x640, 1280x800) |
| M3 | phone hint column back to 112 px / 12 px gap | "Q18 descriptions on one line" (360x640) |
| M4 | `.pc-hint .h-accent` fill rule removed | "each style card's chips equal PC.data.interiors" (360x640, 1280x800) |
| N1 | 640x360 side-by-side canvas rule removed (QA_FULL) | "expanded panel covers none of the canvas" and "canvas 368 px wide" (4 fails) |
| N2 | stage-4 `align-self: stretch` removed | "card name and radio left-aligned with the description" (1280x800) |
| N3 | `.pc-opt > input:focus-visible + *` ring removed | "keyboard focus visible" (20 fails: unit-m, q-unit, q-interior-*, v3-tour-speed). An earlier version accepted any box-shadow and missed this; it was tightened to focused ≠ blurred. |
| N3b | global `:focus-visible` outline removed | "keyboard focus visible" (20 fails) |
| N4 | desktop caption pushed right, no max-width | "tour caption clear of the panel and its toggle" (1280x800, sample + empty) |
| N5 | `--ink-2` lightened to #8A949C | "text contrast AA" (18 fails) |
| N6 | `resetFit` x 0.6 (FS constant, copy only) | "Reset frames the whole plot" (4 fails) |

`site-legend.spec`: its item filter now also skips entries the CSS hides (`display: none`). With the FS's toggles,
the sample shows Parking. On the phone strip that entry is display none but has a rect at top 0, so the old filter
counted it and the strip read as 2 lines (found by the FS on a test merge).

### 4. Tour pacing (proposal to the FS; the FS commits PC.C.TOUR with regenerated goldens)

`verify/tour.mjs` runs the real tour (core + `three/tour.js`) in node on the strict mock with the 60 fps clock, the
same way `tour.test` does. Canvases: 1280x690 (1280x800) and 360x490 (360x640). Houses: the sample, the G6 maximum,
and the sample with a basement (S storage and laundry).

- **View rotation** is the angle between successive view directions per second.
- **Room coverage** is the room box (floor to storey top) projected at its stop, clipped to the canvas, as a share of
  it. It ignores occlusion, so it is an upper bound.
- **Targets:** rotation ≤ 45°/s, coverage ≥ 8 %, sample tour 30–90 s.

| | Current (overviewLeg 4, bEyeUp 4) | Proposed (overviewLeg 4.5, bEyeUp 2.5) |
|---|---|---|
| Duration: sample / max / basement | 53.5 / 144.5 / 60.5 s | 54.5 / 145.5 / 61.5 s |
| Overview-leg rotation max: sample / max / basement | 30.4 / 31.3 / **46.9**°/s | 27.0 / 27.9 / 41.7°/s |
| Room-leg rotation max | 31.0 / 34.8 / 36.5°/s | 31.0 / 35.0 / 36.7°/s |
| Lowest coverage at 1280: sample / max / basement | 22.9 / 9.1 / **5.8** % (B storage, B laundry 5.9) | 22.9 / 13.0 / 8.3 % |
| Lowest coverage at 360 | 57.1 / 23.0 / 14.7 % | 57.1 / 32.7 / 21.0 % |

- **Proposal sent to the FS:** overviewLeg **4 → 4.5** and bEyeUp **4 → 2.5**. roomLeg 3.5, eyeOut 2, eyeOutK 0.6,
  eyeUp 2.5, bEyeIn 1.5 and leadInMs 1200 are unchanged, because every room-leg value is already within target.
- **Alternatives tried:**
  - bEyeUp 3 gives 7.6 %;
  - bEyeIn 0.5 gives 6.0 %;
  - both together give 7.9 %.
- **Basement eye:** it becomes storeyH + 2.5 m, still above the 5.33 m eye floor (the soft floor holds it there).
- **Check on a copy:** `tour.test` passes 8/0. `tourplan.test` fails on its golden numbers only (tests 4, 5 and 9),
  which the FS regenerates.
- **Not done here:** an eyes-on frame pass. The first r128 frame-by-frame attempt, sampling 0.1 s of tour time with
  real WebGL, timed out at 10 min. It moves to the F5-T3b phone pass.

### 5. Verify scripts (docs/03-tasks/F5-T3/verify)

- `golden.mjs [--check]` prints the 16 sky GOLD rows from the A-13 reference, or diffs them against sky.test.
- `o1.mjs ['{key overrides}']` runs the QA O-1 shadow metric.
- `legend.mjs` reports the legend line count with every optional entry shown.
- `plans640.mjs` checks the stage-3 640x360 panel with the longest block message.
- `tour.mjs ['{TOUR overrides}']` reports tour duration, rotation rate and room coverage, using the real tour code and the mock.

## FS (branch f5t3-fs)

Owned files only: `src/js/core/cam.js`, `three/scene.js`, `three/tour.js`, `ui/stage-3d.js`, `ui/dialog.js`,
`ui/shell.js`, `ui/storage.js`, `ui/start.js`, `ui/q-preview.js`, `ui/stage-plot.js`, `ui/stage-questions.js`;
`tests/three-mock.js`, `tests/helpers/project.mjs` (new), `tests/three/lens.test.mjs` (new), `tests/unit/cam.test`,
`storage.test`, and the e2e specs `view3d`, `view3d-real`, `start-card`, `edges`, `questions`, `plans-edit`. The
JS that uses the Designer's new hooks (`nosave-chip`, `site-legend-parking` / `-pool`, `palette2d.font.area` /
`label.area`) needs f5t3-des merged. Until then `f5t3-fs` alone fails on those hooks. I tested on a local merge of
both trees.

### 1. Desktop framing: lens shift (TL ruling 2, A-12)

- `PC.cam.viewOffset(W, H, occl)` returns `[W + o, H, o, 0, W, H]` for `o = occl.right` (whole px), or null when
  `o` is 0 or covers the whole width. `occl.bottom` is ignored until F5-T3b. `PC.cam.visibleAspect(W, H, occl)`
  gives `(W − o) / H`.
- `scene.js` `lens()` handles the camera:
  - with an offset: `camera.aspect = (W + o) / H`, then `setViewOffset(...)`, so the vertical scale and fov are
    unchanged and the principal point sits at `(W − o) / 2`;
  - without one: `aspect = W / H` and `clearViewOffset()`.
- `lens()` runs on resize, on `setOcclusion` and when the camera is recreated (context restore).
  `PC.view3d.setOcclusion({ right })` re-fits the lens and the limits and marks the frame dirty. The pose moves only
  if the new limits clamp it.
- The radius fits use the visible aspect: Reset, `limits().rMax` and the tour plan (`info().aspect`). Poses, the
  pivot, the finder and the clamps are unchanged. The finder radius is not aspect-based. On the maximum house the
  widest room's four floor corners already land in the uncovered rectangle (tested), so `forRoom` is unchanged.
- **Occlusion source (`stage-3d.js`, measured):** `o = canvas.right − panel.left` when the panel is expanded,
  overlaps the canvas and does not start at the canvas's left edge. A full-width bottom dock gives 0, and so does a
  panel beside the canvas (the 640x360 side-by-side layout). It is re-read on Start, on the panel toggle and on
  window resize. At 1280x800 it is 336 px.
- `scene.js` also observes the canvas itself, not only its wrap, because at 640x360 the canvas narrows beside the
  expanded panel (Designer CSS).
- `info()` gained `occl`, `viewOffset` and `aspect` (visible).
- **Mock:** `PerspectiveCamera.setViewOffset` / `clearViewOffset` are whitelisted. They record r128's `.view` and
  reject anything but 6 numbers. **Conformance (`view3d-real`):** `tests/helpers/project.mjs` `projectPx` equals
  r128's `Vector3.project` with and without the offset to under 1e-6 px. The mock three tests project with it.
- **Tests:**
  - unit: the arguments, null cases and `visibleAspect`;
  - three `lens.test`:
    - at 1280x800 with o 336, the target projects to x 472 ± 1 and y 400, and the pose is untouched;
    - Reset uses the visible-aspect radius, and the plot circle projects into [0, 944] × [0, 800];
    - the tour plan uses the visible aspect;
    - the widest room of the maximum house projects into the uncovered rectangle;
    - the lens survives a resize and a context restore;
  - `view3d.spec`:
    - 1280x800: offset = `canvas.right − panel.left`; collapsed gives no offset, and expanding brings it back;
    - 640x360: the renderer follows the panel toggle;
  - `view3d-real`: the highlight's changed pixels lie left of the panel.

### 2. F1 items (plan §7, TL ruling 4)

- **Toast in the old unit:** `ui.toast(text, { units: true })` marks a toast that quotes a measurement, and
  `ui.toast.dropUnits()` removes those. The shell calls it when `ans.unit` changes, from the toggle, a Resume or a
  load. The one toast that quotes a measurement today is the locked-step reason ("minimum …").
- **Saving stopped:** when a write fails after saving worked, one toast with the PM round-14 text (warn, 8 s),
  shown once per session. The note and the chip appear too.
- **Read-only resume:** `probe` is split into `canRead` and `canWrite`. `available` still means saving works.
  - Read works and write fails is the read-only state: the stored draft is offered for Resume, the no-save note and
    chip show, and nothing is written or removed after the probe (set and remove are no-ops). Start new still asks.
  - Any failure after the probe still turns the adapter off entirely, as in F1, so the existing storage suites are
    unchanged.
- **No-save chip:** `start.js` `render()` shows it whenever `!ui.storage.available`, on every stage. A tap shows the
  PM round-14 toast.
- **Tests:**
  - unit `storage.test`: the four probe combinations, and no write in the read-only state;
  - `start-card.spec`, read-only with a valid stored draft:
    - Resume works;
    - the chip is 44 px with the PM aria-label and title, and its tap shows the PM toast;
    - only the probe ever attempted a write;
    - Start new asks;
  - `start-card.spec`, saving stopping mid-session: the PM toast, the chip, shown once; a unit change drops a units
    toast and keeps the others.

### 3. Labels and texts in the 2D views (Designer spec)

- **Area label:** `palette2d.font.area` / `label.area` for the footprint area (site preview) and the plot area
  (stage 1).
  - When one line is wider than the footprint less 8 px, the label takes two lines ("143" / "m²", 14 px apart).
  - When two lines do not fit either, it goes outside on the street side: centred, 4 px off the footprint's street
    edge, no leader.
  - `PC.debug.siteArea()` reports the mode.
- **Overridden edges (A-15 as updated):** a `*` label now uses the normal edge-label culling: no label when the edge
  is too short for it or no spot is free. The street edge stays forced.
  - A culled one gets a tick: 6 px, perpendicular, on the inner side at the midpoint, the edge's class colour, 2 px
    wide.
  - `PC.debug.siteTicks()` lists the ticks.
- **Legend:** `site-legend-parking` / `-pool` are hidden unless the drawing has parking / a pool.
- **Pool note:** "S 3 × 6 · M 4 × 8 · L 5 × 10 m" and "S 9.8 × 19.7 · M 13.1 × 26.2 · L 16.4 × 32.8 ft".
- **Tests (`edges.spec`, 360x640 in `scaleAndLabels`' page):**
  - the 12-vertex staircase with every edge overridden: no overlaps, "front" labelled, labels + ticks = 11, ticks
    inside the polygon;
  - a narrow footprint takes two lines or the street side;
  - the style keys, the legend toggles and the pool note in m and ft.
- **Older assertions updated (FS files):**
  - "every overridden edge keeps its label" becomes "label or tick";
  - `questions.spec`'s area label may be two lines (the sample footprint at 768x1024);
  - the pool-note texts.

### 4. Handle over the stair (TL ruling 5)

The hit order was already selected-room handles, then rooms, then pan, with the stair and lift never hit. The pill is
drawn in the overlay after the stair and its label. `plans-edit.spec` now asserts that the Kitchen's e-handle pill
overlaps the stair block before the existing drags on it resize the room. No code change.

### 5. Designer's `sky.test` golden edit: acknowledged

I checked 331707f:
- only the four 17.5 h GOLD rows changed (8 diff lines);
- `verify/golden.mjs --check` reproduces GOLD from the A-13 reference;
- `sky.test` + `data-tables.test` pass 20/0;
- the 12 h rows are byte-identical.

### 6. Tour pacing

The Designer's proposal (§4) is committed in 0e84a6d: `TOUR.overviewLeg` 4 → 4.5 and `bEyeUp` 4 → 2.5, nothing else.
The `tourplan.test` goldens are regenerated in the same commit:
- the basement eye is at `storeyH + 2.5`;
- overview legs are 4.5 s;
- sample 54.5 s, maximum house 145.5 s, one room 9 s;
- the `target` / slope checks move to the 4.5 s join.

`tour.test` passes unchanged. A-14 gets an "F5-T3a pacing" line in `architecture.md`.

**For QA:** `tests/qa/f5-t2-ref.mjs` / `f5-t2-model.mjs` still encode 4 s, 53.5 / 144.5 s and `storeyH + 4`. On the
merge, `run-f5-t2` model fails E and T until QA moves those values in its own commit.

### 7. Mutations (on the local merge)

Killed:
- offset sign flipped (unit, three);
- occlusion ignoring the collapse (view3d);
- toast `units` ignored (start-card);
- reads requiring `canWrite` (unit);
- the saving-stopped toast never shown (start-card);
- no tick for a culled `*` label (edges);
- `*` labels forced again (edges: overlaps on the staircase);
- the area label always on one line (edges);
- the Pool legend always shown (edges);
- no canvas ResizeObserver (view3d, 640x360 toggle).

Equivalent: "the saving-stopped toast every time". The adapter never becomes available again in a session, so a
second failure cannot occur.

### 8. Runs

- Focused, on the local merge: unit + three 511/0 (also after the TOUR commit); e2e all files green, including `device-sweep`.
- `view3d-real` 55/0 (12.7 s alone).
- The full run is the orchestrator's, after merging both branches.
