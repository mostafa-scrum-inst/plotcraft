# F1 — Plot drawing and app shell: feature plan

Owner: Tech Lead. Shared decisions: `architecture.md` (A-n). Stories: `../01-product/goals-and-stories.md`.

## Stories covered
F1-S1 Draw the plot outline, F1-S2 See and trust measurements, F1-S3 Adjust the outline, F1-S4 Move between stages, F1-S5 Draft autosave and sample project. Product rules R1–R4 are established here for every later feature.

## Technical approach
- The Designer delivers the whole visual layer first: tokens, responsive shell and the **static markup of all five stages**, with `data-pc` hooks and `<template>` elements (A-2, A-15). FS then wires behaviour without writing layout CSS.
- State lives in `PC.store` with the versioned schema of A-4; draft persistence is an adapter around it (`ui/storage.js`), fully optional.
- Plot rules are pure functions in `PC.plot` / `PC.geom` (node-tested); the canvas stage only draws and forwards gestures through the shared `PC.ui.View2D`.
- Layout: mobile-first single column. Header + stepper at the top, stage content scrolls inside its own container, Back/Next bar fixed at the bottom (always visible at 360x640). From 900 px wide, stages with a canvas use two columns (canvas left, panel right). No page-level horizontal scroll at any width from 360 px.

## Publishing point (CTO decision)
When F1-T3 has passed QA, the orchestrator publishes `dist/index.html` for a hosted check on a real phone: sandboxed iframe and CSP with per-file inline scripts, `localStorage` behaviour, touch gestures on the plot canvas. Findings come back as bugs on the relevant F1 task before the F1 feature review closes. The TL personally runs and inspects the first `node build.mjs` output in the F1-T1 implementation review.

## Tasks (in order)

### F1-T1 — Design system, responsive shell and all stage screens (static) — **Designer**
- **Scope.** Real HTML/CSS, no behaviour:
  - `00-tokens.css`: colour, type scale (system font stack only), spacing, radius, elevation, `--tap: 44px`, focus ring; one light theme.
  - Shell: header with title and unit toggle, 5-step stepper with states `is-current / is-done / is-locked` (fits one line at 360 px using numbers/short labels), stage container, fixed Back/Next bar, dialog layer (confirm dialog), banner/inline-message styles (info, warning, blocking), "drafts not saved on this device" note, start panel ("Load sample project", "Resume draft" / "Start new", "Skip to 3D").
  - Components: button variants, segmented control, number stepper, slider with value, switch, select, text/numeric field with unit suffix, tabs with a state badge (Draft / Approved), card, list row, chip, collapsible panel, progress indication.
  - Static screens for the five stages, each as `<section data-stage="n">`: (1) plot canvas area + toolbar (Close shape, Undo last point, Clear, scale indicator, area/perimeter readout, hint/message line); (2) questionnaire: four groups with every control for Q1–Q17, site preview canvas area with edge legend and compass control, live summary + conflict list, room list with row/pair templates, level-removal dialog content; (3) level tabs, plan canvas area, selected-room readout, warnings list, Approve/Regenerate bar, "n of m floors approved"; (4) Q18 and Q19 option cards with placeholder hint visuals, "Build 3D model"; (5) full-bleed 3D canvas area with a collapsible overlay panel (level selector, Roof toggle, Reset view, time slider + four presets, season control, "approximate — not real solar data" label, room dropdown, tour controls Start / Pause / Stop / speed, room caption, "Building…" state, "3D unavailable" message). The overlay covers a third of the canvas at most at 360x640 when open.
  - Icons as an inline SVG sprite (`<symbol>`), used via `<use>`.
  - `js/data/palette2d.js` -> `PC.data.palette2d`: grid, plot fill/stroke, vertex handle, setback zone, buildable, footprint, stair/lift, hall, selection, invalid, approved, and a 2D tint per room type (10).
  - `build.mjs` exactly as A-17, `src/manifest.json`, and a 3-line `js/main.js` placeholder that shows stage 1.
- **Files.** `build.mjs`, `src/manifest.json`, `src/index.html`, `src/css/*.css` (A-1 list), `src/js/core/ns.js`, `src/js/data/palette2d.js`, `src/js/main.js`.
- **Acceptance criteria.** F1-S4: stepper states exist visually, fits one line at 360 px, Back/Next visible without scrolling at 360x640. R2: no page-level horizontal scroll at 360, 768, 1280; every interactive element 44 px or more; visible focus state. R3: dialog and message components exist (no native dialogs needed later). F4-S2: overlay panel is collapsible and covers a third of the canvas at most at 360x640. Brief: no external fonts, images or scripts other than the three.js tag.
- **Outcome must include** the hook table: every `data-pc` name, element type and purpose, and every template.
- **Dependencies.** None.
- **QA should test.** `node build.mjs` works and produces one file with one external URL. With each stage section forced visible in turn (toggle the `hidden` attribute from the test) at the three viewports: `document.documentElement.scrollWidth <= innerWidth`; bounding boxes of all `button, [role=button], input, select, summary` are 44 px or more in both directions (or have a 44 px hit area by padding); stepper is one line at 360 px; Back/Next inside the viewport at 360x640; overlay panel height at 360x640. Hook table matches the markup (every listed `data-pc` exists exactly as documented). Text contrast of body text and buttons at least 4.5:1 (computed from tokens).

### F1-T2 — App core: store, stage navigation, draft autosave, sample loader, test runner — **FS**
- **Scope.**
  - `PC.C` (section 4 numbers), `PC.store` (default state per 4.1, `commit`, `propose` as a pass-through until F2-T1, `subscribe`), `PC.stages.status` (A-4), `PC.draft` (serialize / parse with validation), `PC.sample` (6.2 plot and all answers as data; plans are produced by `PC.plans.sync` once F3-T1 exists).
  - UI: `ui/dom.js`, `ui/storage.js` (try/catch adapter, `available` flag), `ui/dialog.js`, `ui/shell.js` (stepper rendering, locked-step reason on tap, Back/Next enablement, stage switching, unit toggle in the header), start panel logic (Resume draft / Start new with confirmation / Load sample with confirmation over an existing draft / discreet "not saved" note), autosave (400 ms debounce after `commit`).
  - "Skip to 3D": shown only while `sampleClean`; goes to the latest stage that is built and reachable (constant `PC.stages.MAX_BUILT`, raised by later features; full behaviour is re-tested in F4-T1).
  - Test infrastructure: `tests/run-all.mjs`, `tests/helpers/load.mjs`, `tests/helpers/browser.mjs` (playwright launch + route interception + error collection), `tests/lint-constraints.mjs` (A-16).
- **Files.** `src/js/core/const.js`, `store.js`, `draft.js`, `sample.js`; `src/js/ui/dom.js`, `storage.js`, `dialog.js`, `shell.js`; `src/js/main.js`; `tests/…` as listed; `tests/unit/store.test.mjs`, `draft.test.mjs`; `tests/e2e/shell.spec.mjs`.
- **Acceptance criteria.** F1-S4 all (locked stages not activatable and say why; Next disabled until the stage is valid; back and forward loses nothing). F1-S5 all (autosave; Resume / Start new in-page; works with `localStorage` blocked or throwing; corrupted or old-format draft discarded silently; sample one tap, confirmation over an existing draft; Skip to 3D only for the unmodified sample). R1, R3, G5.
- **Dependencies.** F1-T1 (markup, hooks).
- **QA should test.** Unit: default state equals 4.1; `draft.parse` on valid, truncated, wrong version, wrong types, out-of-range values; `stages.status` table. E2E at the three viewports: stepper locking and reasons; reload -> Resume restores stage and data; Start new clears after confirmation; `localStorage` replaced by a throwing stub (`addInitScript`) -> no errors, note shown, app usable; garbage in the draft key -> clean start, no error; sample over a draft asks first; "Skip to 3D" disappears after any edit; zero console errors; no native dialog ever opens (`page.on('dialog')` fails the test). `node tests/run-all.mjs` is green and fails when a forbidden token is planted.

### F1-T3 — Plot drawing, measurements and vertex editing — **FS**
- **Scope.**
  - Pure: `PC.units`, `PC.geom`, `PC.plot` (`canAdd` -> ok or reason: duplicate point, crossing, 13th vertex, outside 100 x 100 m; `canClose`; `canMove`; CCW normalisation on close; `defaultStreetEdge`), `PC.frames`.
  - `PC.ui.View2D` (A-15) and `ui/draw2d.js` (grid with adaptive density, scale indicator, polygon, vertex handles, edge-length labels that hide when the edge is shorter on screen than its label, area/perimeter).
  - `ui/stage-plot.js`: tap to add, tap first vertex or "Close shape" to close, live edge to the pointer on mouse, Undo last point, Clear (confirmation when closed), vertex drag with snap and refusal on self-intersection (returns to the last valid position, inline message), blocking "plot too small" under 50 m2, unit toggle shared with Q1, grid/snap per 4.3 (1 m / 0.5 m; 5 ft / 1 ft; existing points never re-snapped), pinch/pan without placing points, wheel zoom, drag on empty space pans.
  - Vertex release calls `PC.store.propose` (the R5 gate becomes active in F2-T1; the F1-S3 R5 criterion is tested end-to-end in F3-T2). A vertex-count change resets `ans.streetEdge` to `null`.
  - `PC.debug.toScreen('plot', x, y)` for tests.
- **Files.** `src/js/core/units.js`, `geom.js`, `plot.js`, `frames.js`; `src/js/ui/view2d.js`, `draw2d.js`, `stage-plot.js`; `tests/unit/geom.test.mjs`, `units.test.mjs`, `plot.test.mjs`; `tests/e2e/plot.spec.mjs`.
- **Acceptance criteria.** F1-S1 all, F1-S2 all, F1-S3 all except the R5 confirmation (deferred as above). R2 (no page scroll/zoom while dragging on the canvas), R4.
- **Dependencies.** F1-T2.
- **QA should test.** Unit: 20 x 30 m rectangle -> 20.0 m, 30.0 m, 600 m2 and 65.6 ft, 98.4 ft, 6458 sq ft; sample polygon 584 m2 / 96.9 m; crossing detection incl. closing edge and collinear touch; CW input normalised to CCW; default street edge with ties. E2E, mouse and touch (CDP touch events for two fingers): place/close by first vertex and by button; Close disabled under 3 points with hint; duplicate point ignored; crossing vertex rejected with message; 13th vertex refused; point outside the area refused; Undo, Clear with confirmation; under 50 m2 blocks Next; drag is not a tap; pinch does not place points; unit toggle changes every label and the scale indicator but not `PC.debug.state().plot.pts`; vertex drag updates labels live, refused drag returns; labels do not overlap at 360 px on the sample; page `scrollY` unchanged while dragging.
