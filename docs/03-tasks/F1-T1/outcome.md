# F1-T1 — Design system, responsive shell and all stage screens (static): outcome

Owner: Designer. Step 3f. Plan: `plan.md` (approved round 2). Reviews: `plan-review.md`, `impl-review.md`, `qa-report.md`.

## 1. What was built

The whole visual layer of PlotCraft as static HTML/CSS, with no behaviour:

- **Design system** ("the drawing sheet"): paper-and-ink light theme, one drafting-blue accent, hairlines instead of shadowed cards, monospaced measurements. Tokens for colour, type (system font stacks only), spacing, radius, elevation, sizes and motion.
- **Shell**: header with wordmark and unit toggle, five-step stepper, sample strip, banner slot, stage container, fixed Back/Next bar, toast region, dialog layer.
- **Five stage screens** as `section[data-stage="1..5"]`: Plot, Questions (Q1–Q17 in four groups, site preview, summary and conflicts), Floor plans, Interior (Q18–Q19), 3D view (canvas, caption chip, overlay panel with View / Light / Tour).
- **Components**: buttons, segmented controls, number steppers, sliders, switches, selects, fields with unit, chips, tabs with approval state, radio cards, title-block readouts, banners, message lines, toasts, dialog, collapsible sheets, progress, busy state.
- **45 inline SVG icons** as one `<symbol>` sprite.
- **2D drawing palette** `PC.data.palette2d` (colours, line widths and fonts in CSS pixels).
- **Build script** `build.mjs`, verbatim from A-17.

Layouts: phone portrait (from 360 px), tablet (from 600 px), desktop two-column (from 900 px), and short landscape (`max-height: 480px`, two columns with a 272 px panel).

## 2. Files

| File | Content |
|---|---|
| `build.mjs` | A-17 reference implementation |
| `src/manifest.json` | CSS and JS order (FS has since added the F1-T2 scripts) |
| `src/index.html` | sprite, shell, five stages, 11 templates, dialog layer; one comment banner per block. Hand-edited from here on |
| `src/css/00-tokens.css` | tokens |
| `src/css/10-base.css` | reset, icons, focus ring, reduced motion, scroll padding |
| `src/css/20-shell.css` | app grid, header, stepper, strip, stages, action bar, breakpoints |
| `src/css/30-components.css` | controls |
| `src/css/31-overlays.css` | message line, banner, toast, dialog, sheet, busy |
| `src/css/40-stage-plot.css` … `44-stage-3d.css` | one file per stage |
| `src/js/core/ns.js` | `PC.VERSION`, `PC.DRAFT_V`, `PC.data` |
| `src/js/data/palette2d.js` | `PC.data.palette2d` |
| `src/js/main.js` | placeholder at hand-over; now owned by FS (F1-T2) |
| `docs/03-tasks/F1-T1/verify/` | `shots.mjs` (runner), `assertions.mjs`, `demo.js` (screenshot-only demo content), `hooks.json`, `values.json` |
| `docs/03-tasks/F1-T1/shots/` | 156 screenshots (26 states at 6 viewports) |

No JS or CSS file is over 300 lines; `src/index.html` is exempt (A-1).

## 3. UI contract: hooks

The machine-readable contract lives in **`tests/contract/hooks.json`** (204 document hooks, 11 templates with 30 parts) and **`tests/contract/values.json`**; the copies under `verify/` are identical. Changing a hook name needs a TL-approved note (A-2).

Rules:
- FS looks elements up only by `data-pc`. Hooks are unique in the document outside templates; template parts are unique within their template; each template has one root element.
- State goes through native / ARIA attributes first (`hidden`, `disabled`, `aria-disabled`, `aria-selected`, `aria-pressed`, `aria-expanded`, `aria-invalid`, `checked`, `data-kind`). State classes: `is-current`, `is-done`, `is-locked`, `is-invalid`, `is-approved`, `is-collapsed`.
- Every radio, option and segmented choice carries a `value` equal to the A-4 state value. Two exceptions are session values, not A-4 state: `v3-level` value `all`, and the hours on the `v3-preset-*` buttons.
- Switches are checkboxes read through `checked`. Numeric inputs are `type="text" inputmode="decimal"` and hold display-unit numbers.
- Hooks added during implementation beyond the plan's table: `-dec` / `-inc` on number steppers, `q-stairs-box`, `room-area-box`, `room-area-unit`, `room-add-area-unit`, `room-add-size-hint`, `q-pool-size-note`, `plan-error-text`, and the template parts `toast-text`, `warn-text`, `level-label`.

### 3.1 Document hooks

| Hook | Element | Purpose | Values |
|---|---|---|---|
| `app` | div | app root (grid shell) |  |
| `unit-toggle` | div[radiogroup] | header unit toggle, same setting as Q1 | `m`, `ft` |
| `unit-m` | input[radio] | its metre radio |  |
| `unit-ft` | input[radio] | its feet radio |  |
| `stepper` | nav | stage stepper nav |  |
| `step-1` | button | stage 1 step; `is-current` / `is-done` / `is-locked` (+ `aria-disabled`) |  |
| `step-2` | button | stage 2 step; `is-current` / `is-done` / `is-locked` (+ `aria-disabled`) |  |
| `step-3` | button | stage 3 step; `is-current` / `is-done` / `is-locked` (+ `aria-disabled`) |  |
| `step-4` | button | stage 4 step; `is-current` / `is-done` / `is-locked` (+ `aria-disabled`) |  |
| `step-5` | button | stage 5 step; `is-current` / `is-done` / `is-locked` (+ `aria-disabled`) |  |
| `sample-strip` | div | "Sample project loaded" strip; shown while the sample is unmodified, not on stage 5 |  |
| `sample-strip-text` | span | strip text |  |
| `btn-skip3d` | button | Skip to 3D (only place) |  |
| `banner-slot` | div | shell-level banners (clones of tpl-banner); not for product messages |  |
| `stage-container` | main | holds the five `section[data-stage]` |  |
| `plot-canvas` | canvas | plot grid canvas |  |
| `plot-fit` | button | Fit view: re-fits the plot view (icon button floating top right of the canvas) |  |
| `plot-scale` | span | scale indicator text |  |
| `start-panel` | div | start card (hide once a point is placed) |  |
| `btn-sample` | button | Load sample project |  |
| `resume-box` | div | Resume / Start new block (hidden by default) |  |
| `resume-meta` | span | draft description text |  |
| `btn-resume` | button | Resume draft |  |
| `btn-startnew` | button | Start new |  |
| `note-nosave` | p | "drafts not saved on this device" note (hidden by default) |  |
| `plot-msg` | p[status] | hint / error line; set `data-kind` |  |
| `plot-area` | dd | area readout |  |
| `plot-perimeter` | dd | perimeter readout |  |
| `plot-points` | dd | vertex count |  |
| `plot-grid` | dd | grid / snap readout (shown from 900 px) |  |
| `btn-undo` | button | Undo last point |  |
| `btn-clear` | button | Clear |  |
| `btn-close-shape` | button | Close shape (disabled by default) |  |
| `q-tabs` | div[tablist] | question group tablist |  |
| `q-tab-site` | button | site group tab (`aria-selected`) |  |
| `q-tab-building` | button | building group tab (`aria-selected`) |  |
| `q-tab-rooms` | button | rooms group tab (`aria-selected`) |  |
| `q-tab-outdoor` | button | outdoor group tab (`aria-selected`) |  |
| `q-progress-text` | span | "Group n of 4 · k questions left" |  |
| `q-progress-bar` | progress | progress (set `value`, max 17) |  |
| `q-group-site` | div[tabpanel] | site group panel (toggle `hidden`) |  |
| `q-unit` | div[radiogroup] | Q1 unit | `m`, `ft` |
| `q-setback-front-dec` | button | minus button of `q-setback-front` |  |
| `q-setback-front` | input[text] | Q2 front setback (0–20 m) |  |
| `q-setback-front-unit` | span | unit suffix of `q-setback-front` |  |
| `q-setback-front-inc` | button | plus button of `q-setback-front` |  |
| `q-setback-front-err` | p | error line of (hidden by default) `q-setback-front` |  |
| `q-setback-back-dec` | button | minus button of `q-setback-back` |  |
| `q-setback-back` | input[text] | Q2 back setback (0–20 m) |  |
| `q-setback-back-unit` | span | unit suffix of `q-setback-back` |  |
| `q-setback-back-inc` | button | plus button of `q-setback-back` |  |
| `q-setback-back-err` | p | error line of (hidden by default) `q-setback-back` |  |
| `q-setback-side-dec` | button | minus button of `q-setback-side` |  |
| `q-setback-side` | input[text] | Q2 side setback (0–20 m) |  |
| `q-setback-side-unit` | span | unit suffix of `q-setback-side` |  |
| `q-setback-side-inc` | button | plus button of `q-setback-side` |  |
| `q-setback-side-err` | p | error line of (hidden by default) `q-setback-side` |  |
| `q-footprint` | input[range] | Q3 footprint % slider (10–80) |  |
| `q-footprint-out` | output | value text of `q-footprint` |  |
| `q-footprint-err` | p | error line of (hidden by default) `q-footprint` |  |
| `q-veg` | input[range] | Q4 vegetation % slider (0–80) |  |
| `q-veg-out` | output | value text of `q-veg` |  |
| `q-veg-err` | p | error line of (hidden by default) `q-veg` |  |
| `q-north-ccw` | button | Q5 rotate north -15° |  |
| `q-north-cw` | button | Q5 rotate north +15° |  |
| `q-north-value` | span | Q5 value text |  |
| `q-north-reset` | button | Q5 back to default |  |
| `q-street-prev` | button | Q6 previous edge |  |
| `q-street-next` | button | Q6 next edge |  |
| `q-street-value` | span | Q6 value text |  |
| `q-edges-toggle` | button | Q6 "Back / side of each edge" toggle (`aria-expanded`, collapsed by default); F2-T3 pre-step D |  |
| `q-edges` | ul | Q6 edge list; `is-collapsed`; filled with `tpl-edge-row` clones |  |
| `btn-q-continue-site` | button | in-flow "Continue" at the end of the site group |  |
| `q-group-building` | div[tabpanel] | building group panel (toggle `hidden`) |  |
| `q-floors` | div[radiogroup] | Q7 floors | `1`, `2`, `3` |
| `q-basement` | input[checkbox] | Q7 basement switch |  |
| `q-usable-roof` | input[checkbox] | Q7 usable roof switch |  |
| `q-ceiling` | input[range] | Q8 ceiling height slider (2.4–4.5 m; rewrite min/max/step in ft mode) |  |
| `q-ceiling-out` | output | value text of `q-ceiling` |  |
| `q-ceiling-unit` | span | unit suffix of `q-ceiling` |  |
| `q-ceiling-err` | p | error line of (hidden by default) `q-ceiling` |  |
| `q-roof` | div[radiogroup] | Q9 roof type (disable `pitched` when usable roof is on) | `flat`, `pitched`, `terrace` |
| `q-roof-note` | p | Q9 inline note (hidden by default) |  |
| `q-exterior` | div[radiogroup] | Q10 exterior style cards | `sand`, `white`, `terracotta`, `grey` |
| `btn-q-continue-building` | button | in-flow "Continue" at the end of the building group |  |
| `q-group-rooms` | div[tabpanel] | rooms group panel (toggle `hidden`) |  |
| `room-add-type` | select | Q11 type for new rooms | `bedroom`, `bathroom`, `kitchen`, `living`, `dining`, `majlis`, `office`, `maid`, `storage`, `laundry` |
| `room-add-level` | select | Q11 level for new rooms (hide options of absent levels) | `B`, `G`, `1`, `2` |
| `room-add-size` | div[radiogroup] | Q12 size for new rooms | `S`, `M`, `L`, `exact` |
| `room-add-size-hint` | p | area the chosen S/M/L stands for, in the current unit |  |
| `room-add-area` | input[text] | exact area (disabled unless size = exact) |  |
| `room-add-area-unit` | span | its unit suffix |  |
| `room-add-count-dec` | button | minus button of `room-add-count` |  |
| `room-add-count` | input[text] | how many rooms to add (1–8) |  |
| `room-add-count-inc` | button | plus button of `room-add-count` |  |
| `btn-room-add` | button | Add room |  |
| `room-msg` | p[alert] | room list error line (hidden by default) |  |
| `room-list` | div | container for tpl-room-group clones |  |
| `pair-a` | select | Q13 first room (fill options; placeholder has value "") |  |
| `pair-b` | select | Q13 second room |  |
| `btn-pair-add` | button | Add pair |  |
| `pair-msg` | p[alert] | pair error line (hidden by default) |  |
| `pair-list` | ul | container for tpl-pair-row clones |  |
| `q-stairs-box` | div | wrapper of stair picker + lift; hide when no stairs exist |  |
| `q-stair-pos` | div[radiogroup] | Q14 stair position (footprint diagram) | `bl`, `br`, `centre`, `fl`, `fr` |
| `q-lift` | input[checkbox] | Q14 lift switch |  |
| `q-stairs-none` | p | "single level: no staircase needed" note (hidden by default) |  |
| `btn-q-continue-rooms` | button | in-flow "Continue" at the end of the rooms group |  |
| `q-group-outdoor` | div[tabpanel] | outdoor group panel (toggle `hidden`) |  |
| `q-parking-cars-dec` | button | minus button of `q-parking-cars` |  |
| `q-parking-cars` | input[text] | Q15 cars (0–4) |  |
| `q-parking-cars-inc` | button | plus button of `q-parking-cars` |  |
| `q-parking-cars-err` | p | error line of (hidden by default) `q-parking-cars` |  |
| `q-parking-covered` | input[checkbox] | Q15 covered switch |  |
| `q-pool` | input[checkbox] | Q16 pool switch |  |
| `q-pool-size` | div[radiogroup] | Q16 pool size | `S`, `M`, `L` |
| `q-pool-size-note` | p | pool dimensions in the current unit |  |
| `q-wall` | input[checkbox] | Q17 boundary wall switch |  |
| `q-gate` | div[radiogroup] | Q17 gate position | `left`, `centre`, `right` |
| `q-seating` | input[checkbox] | Q17 garden seating switch |  |
| `site-preview` | div | preview block; `is-collapsed` hides the canvas on phone |  |
| `site-canvas` | canvas | site preview canvas (Q5 compass, Q6 edge picking) |  |
| `site-tap-mode` | div[radiogroup] | what an edge tap does, top left of the canvas; radios `name="site-tap-mode"` (F2-T3 pre-step D) | `street` (default), `class` |
| `site-preview-toggle` | button | collapse toggle (`aria-expanded`) |  |
| `site-tap-hint` | p | caption for mode `class`, drawn at the legend's place (hides the legend); `hidden` in mode `street` |  |
| `site-legend` | ul | static edge legend |  |
| `site-legend-mark` | li | legend entry "* set by you" (600 px and up; never on phone portrait); `hidden` unless an override exists |  |
| `summary` | div | summary sheet; `is-collapsed`, `data-kind` ok / warn / block |  |
| `summary-toggle` | button | sheet toggle (`aria-expanded`) |  |
| `sum-status` | span | one-line status |  |
| `sum-plot` | dd | plot area |  |
| `sum-buildable` | dd | buildable area |  |
| `sum-footprint` | dd | effective footprint area and % |  |
| `sum-veg` | dd | effective vegetation area and % |  |
| `sum-levels` | dl | container for tpl-sum-level clones |  |
| `conflict-list` | ul | container for tpl-conflict clones |  |
| `plan-tabs` | div[tablist] | level tablist; container for tpl-plan-tab clones |  |
| `plan-counter` | span | "n of m floors approved" (set content as a whole) |  |
| `plan-canvas` | canvas | plan editor canvas |  |
| `plan-fit` | button | Fit view: re-fits the plan view (icon button floating top right of the canvas) |  |
| `plan-error` | div[alert] | no-layout banner (hidden by default) |  |
| `plan-error-text` | span | its text |  |
| `btn-goto-rooms` | button | link back to the room list |  |
| `plan-warn-panel` | div | warnings panel; `is-collapsed` on phone |  |
| `plan-warn-list` | ul | container for tpl-plan-warn clones |  |
| `plan-room-name` | dd | selected room name |  |
| `plan-room-dims` | dd | selected room width × depth |  |
| `plan-room-area` | dd | selected room area |  |
| `plan-warn-toggle` | button | warnings chip (hidden by default; `aria-expanded`) |  |
| `plan-warn-count` | span | number on the chip |  |
| `plan-msg` | p[status] | message line; set `data-kind` |  |
| `btn-regenerate` | button | Regenerate this floor |  |
| `btn-approve` | button | Approve floor; `is-approved` when approved |  |
| `btn-approve-label` | span | its label |  |
| `q-interior-style` | div[radiogroup] | Q18 interior style cards | `modern`, `classic`, `minimal` |
| `q-interior-density` | div[radiogroup] | Q19 furniture density cards | `sparse`, `full` |
| `v3-canvas` | canvas | 3D canvas (`tabindex="0"`) |  |
| `v3-building` | div[status] | "Building…" overlay (hidden by default) |  |
| `v3-unavailable` | div[alert] | "3D unavailable" card (hidden by default) |  |
| `v3-unavailable-text` | p | its message |  |
| `v3-caption` | div[status] | room caption chip (hidden by default) |  |
| `v3-caption-text` | span | room name |  |
| `v3-caption-pause` | button | Pause on the chip (hidden by default; F5-T2) |  |
| `v3-caption-stop` | button | Stop on the chip (hidden by default; F5-T2) |  |
| `v3-panel` | div | overlay panel; `is-collapsed` |  |
| `v3-panel-toggle` | button | panel toggle (`aria-expanded`) |  |
| `v3-tab-view` | button | view tab (`aria-selected`) |  |
| `v3-tab-light` | button | light tab (`aria-selected`) |  |
| `v3-tab-tour` | button | tour tab (`aria-selected`) |  |
| `v3-pane-view` | div | view pane; `is-current` on the open one |  |
| `v3-level` | div[radiogroup] | level selector; static `all` radio + tpl-v3-level clones | `all` (session value, not A-4 state) |
| `v3-roof` | input[checkbox] | Roof switch |  |
| `v3-reset` | button | Reset view |  |
| `v3-pane-light` | div | light pane; `is-current` on the open one |  |
| `v3-time` | input[range] | time of day slider (0–24, step 0.25) |  |
| `v3-time-out` | output | time text |  |
| `v3-preset-morning` | button | morning preset | `8` (session value, not A-4 state) |
| `v3-preset-noon` | button | noon preset | `12` (session value, not A-4 state) |
| `v3-preset-evening` | button | evening preset | `17.5` (session value, not A-4 state) |
| `v3-preset-night` | button | night preset | `22` (session value, not A-4 state) |
| `v3-season` | select | season select | `spring`, `summer`, `autumn`, `winter` |
| `v3-pane-tour` | div | tour pane; `is-current` on the open one |  |
| `v3-room` | select | room finder select (fill optgroups per level; placeholder has value "") |  |
| `v3-tour-start` | button | Start tour (accessible name "Start tour") |  |
| `v3-tour-pause` | button | Pause / Resume (`aria-pressed`; disabled by default) |  |
| `v3-tour-stop` | button | Stop (disabled by default) |  |
| `v3-tour-speed` | div[radiogroup] | tour speed | `slow`, `normal`, `fast` |
| `toast-region` | div[status] | live region for tpl-toast clones |  |
| `btn-back` | button | Back |  |
| `btn-next` | button | Next (hidden on stage 5) |  |
| `btn-next-label` | span | Next label, set per stage ("Build 3D model" on stage 4) |  |
| `dialog-layer` | div | backdrop; un-hide to open |  |
| `dialog` | div[dialog] | dialog box (focus target) |  |
| `dialog-title` | h2 | title |  |
| `dialog-text` | p | text |  |
| `dialog-extra` | div | slot for extra content (tpl-level-remove) |  |
| `dialog-cancel` | button | Cancel |  |
| `dialog-ok` | button | OK / Continue |  |

### 3.2 Templates

| Template | Root and use | Parts (`data-pc` inside the template) |
|---|---|---|
| `tpl-toast` | `div.pc-toast`; append to `toast-region` | `toast-text` toast text |
| `tpl-banner` | `div.pc-banner`; set `data-kind` info / warn / block / ok; append to `banner-slot` | `banner-text` banner text; `banner-action` optional action button (hidden by default) |
| `tpl-room-group` | `section`; one per plan level in `room-list` | `group-name` level name; `group-count` "n of 8"; `group-rows` container for tpl-room-row clones |
| `tpl-room-row` | `li`; into `group-rows` | `room-name` derived room name; `room-area-hint` area the size stands for; `room-master` master checkbox; hide its `closest("label")` for non-bedrooms; `room-delete` remove room; `room-type` type select (`bedroom`, `bathroom`, `kitchen`, `living`, `dining`, `majlis`, `office`, `maid`, `storage`, `laundry`); `room-level` level select (`B`, `G`, `1`, `2`); `room-size` size select (`S`, `M`, `L`, `exact`); `room-area-box` exact-area wrapper (hidden unless size = exact); `room-area` exact area input; `room-area-unit` unit suffix |
| `tpl-pair-row` | `li`; into `pair-list` | `pair-text` pair description; `pair-delete` remove pair |
| `tpl-edge-row` | `li`; one per plot edge into `q-edges` | `edge-name` "Edge 3 · 12.0 m"; `edge-class` class in effect, "(set by you)" when overridden, "front (street)" on the street row; `edge-switch` button "Make side" / "Make back", full `aria-label` set by FS ("Edge 3, 8.9 m, back: make side"), `hidden` on the street row |
| `tpl-sum-level` | `div` (dt/dd); into `sum-levels` | `level-name` level name; `level-needed` needed area; `level-available` available area |
| `tpl-conflict` | `li`; set `data-kind` block / warn; into `conflict-list` | `conflict-text` message; `conflict-goto` "Fix" button (go to the question) |
| `tpl-level-remove` | `div[radiogroup]`; into `dialog-extra`; radios share `name="level-remove"` | `level-remove-text` question text; `level-remove-move` radio: move rooms; `level-remove-delete` radio: delete rooms |
| `tpl-plan-tab` | `button[role=tab]`; set `aria-selected`, `is-approved` / `is-invalid`; into `plan-tabs` | `tab-name` level name; `tab-state` state text (Draft / Approved; shown from 720 px) |
| `tpl-plan-warn` | `li`; set `data-kind` warn / block; into `plan-warn-list` | `warn-text` warning text |
| `tpl-v3-level` | `label` with a radio `name="v3-level"`; set the radio `value` to the level id; into `v3-level` | `level-label` level name |

## 4. How to verify

1. `node build.mjs` — exits 0 and prints the size; one external URL (the three.js r128 tag).
2. `node docs/03-tasks/F1-T1/verify/shots.mjs` — layout assertions at 360x640, 768x1024, 1280x800 and 640x360, plus screenshots at those and at 360x740 and 1440x900 into `docs/03-tasks/F1-T1/shots/`. A name prefix runs a subset (`shots.mjs s2`). Last full run: 659 passed, 0 failed.
3. `node tests/qa/run-f1-t1.mjs [--no-shots]` — QA's independent suite.
4. `node tests/run-all.mjs` — project runner (build, lint, unit, e2e contract and shell).

## 5. QA sign-off

- **Round 1** (`qa-report.md`): every acceptance row passed; FAILED on two major clipping defects at 360x640 (summary sheet under the action bar, truncated readouts) plus three minors.
- **Round 2** (`qa-report.md`, 2026-11-20): **VERDICT: PASSED.** Static 137 passed / 0 failed; layout 1929 passed / 0 failed over 34 states at 4 viewports; bugs 1–5 fixed; one minor left open (bug 6, pair selects cutting "Master bedroom").
- **After round 2**: bug 6 fixed in CSS (slimmer padding on `pair-a` / `pair-b`) and its known-bug entry removed from `tests/qa/f1-t1-layout.mjs`. Re-run by the Designer: QA suite static 137 / 0, layout 1929 / 0, no known hits; `tests/run-all.mjs` all steps passed (e2e contract 4 / 0, shell 509 / 0). QA has since confirmed that the bug 6 fix holds.

- **Start card change after F1-T3** (TL decision in `docs/03-tasks/F1-T3/impl-review.md`, logged against F1-T1; CSS only, no markup or hook change): below 900 px wide and outside short landscape, when no draft is waiting (`resume-box` hidden) the start panel has no card and no hint; only the "Load sample project" button floats at the bottom centre of the canvas (44 px high, 8 px margin) and the container takes no pointer events, so first taps reach the grid. The no-save note, when shown, is one small line above the button. With a draft waiting the full card stays. Selector: `.pc-start:has([data-pc="resume-box"][hidden])` in `40-stage-plot.css`. New test `tests/e2e/start-card.spec.mjs` (run by `tests/run-all.mjs`): at 360x640 with no draft the panel covers 44 px of canvas height (limit 60), the grid is reachable beside and above the button, and the full card shows when the resume box is visible. `node tests/run-all.mjs`: all steps passed.

- **Fit view buttons** (TL ruling, `docs/03-tasks/F1-T3/impl-review.md` round 3 and A-15; logged against F1-T1): two new hooks, `plot-fit` (stage 1) and `plan-fit` (stage 3), a 44 x 44 icon button with the accessible name "Fit view", floating 8 px from the top right of the canvas and styled like the scale chip. The stage 2 site preview has none. The stage 3 no-layout banner now stops short of the button. Contract updated to 204 hooks. New test `tests/e2e/fit-button.spec.mjs`.

## 6. Deviations from the plan (accepted by the TL in `impl-review.md`)

- Start card docked to the bottom of the plot canvas on phone (not centred), so the grid stays tappable.
- All step labels from 720 px (plan: 480) and full labels from 1100 px (plan: 900).
- Stage 3: warnings chip in the message row; on desktop the level tabs and counter span the top row.
- Room rows use a `<select>` for size, to avoid radio-name collisions between cloned rows.
- Question group titles are visually hidden below 900 px.
- Phone site preview is 200 px high (plan: 180) to meet the 200 px canvas minimum.

## 7. Known limits and tech debt

| Item | Detail | When to revisit |
|---|---|---|
| 3D Light pane margin | 162 px open against a limit of 163.3 px (a third of the 490 px canvas at 360x640). Nothing may be added to this pane (TL ruling). If it must grow, move the time value and note onto the presets row | F5-T3 |
| `:has()` for the site preview | On phone and tablet the preview hides when another question group is open, through CSS `:has()`. Without support the preview simply stays visible (the collapse toggle still works) | F1 publishing point, real phone |
| `:has()` for the compact start panel | Without `:has()` support the full start card stays over the lower part of the empty grid on phone (the pre-F1-T3 behaviour: first taps there can hit the card) | F1 publishing point, real phone |
| iOS range styling | Sliders are styled native `input[type=range]`; only Chrome could be checked here | F1 publishing point |
| `100dvh` in the host iframe | Shell uses `100dvh` with a `100vh` fallback; the iframe's real height is unknown | F1 publishing point |
| Banner slot on stage 2 in landscape | A shell banner at 640x360 on stage 2 pushes the stage down and clips the summary sheet. Rule (A-15, F1-T2 review): the banner slot is for shell-level notices only; product messages go to the stage's own message lines, summary and warning lists | Keep as a rule; re-check in F2-T2 |
| Stage 2, Site group on phone | About 175 px for questions between preview and summary row (124 px with the sample strip); one question at a time. The preview toggle frees the space | F5-T3 with real content |
| Open summary covers the questions on phone | Intended. "Fix" must collapse the sheet before scrolling to the question | F2-T2 (FS) |
| 3D panel in landscape | 272 px right column = 42.5 % of the canvas area at 640x360 (the one-third rule is defined at 360x640 only); collapses to 44 px | F5-T3 |
| Stage 3 at 640x360, worst case | With a three-line blocking message the Approve button is half below the fold of the right panel; the panel scrolls | F5-T3 |
| Placeholder visuals | Exterior swatches and the Q18 / Q19 hint pictures are placeholders | F3-T3 |
| Static placeholder text | Progress text, "Master" on every room row, default readouts are for FS to drive | F2 |
| No dark theme | Canvas colours come from a JS table, so a second theme is not cheap | Not planned |
| `q-ceiling` in ft mode | Slider `min` / `max` / `step` are in metres; FS rewrites them in ft mode | F2-T2 (FS) |

**Change after sign-off: phone site-preview legend (F2-T2 TL implementation review, round 1; Designer, 2026-11-20).** In `41-stage-questions.css` only, a new block `@media (max-width: 599px) and (min-height: 481px)` turns the stage-2 legend from an overlay on the bottom of the drawing into a one-line strip under the canvas, inside `.pc-preview`: canvas 176 px (was 200), legend `position: static; flex-wrap: nowrap; overflow: hidden; gap: 4px`. The side paddings are 6 px on the strip and 3 px on each item instead of the specified 8 px / 4 px: with the specified values the five items ended 1.6 px from the right screen edge (inside the strip's own padding), so a system font about 1 % wider on a real phone would clip "Footprint"; now the slack is 7.6 px and the insets are symmetric. No markup, hook or contract change; collapsed state, 600 px and up, and short landscape unchanged (layout boxes compared before / after at 768x1024, 1280x800 and 640x360: identical). Measured on the sample at 360x640 and 360x740, m and ft: preview 200.8 px (201 before), questions scroller 173.4 / 273.4 px (173.2 / 273.2 before), drawing scale 3.05 -> 4.13 px per metre, "back" edge label now drawn. Test: `tests/e2e/site-legend.spec.mjs` (fails 16 checks on the old CSS). **Resolved (TL ruling, 2026-11-20):** the 200 px canvas rule is amended for this one case (stage-2 phone portrait preview: canvas >= 176 px, preview box >= 200 px, strip below the canvas; plan.md acceptance list amended, A-15 records it); QA updates `f1-t1-layout.mjs` accordingly. Original note: this F1-T1 acceptance item "every visible stage canvas is 200 px or more" no longer holds for the stage-2 phone preview (176 px canvas + 24 px legend strip); QA's `f1-t1-layout` check fails at 360x640 `s2-site` / `s2-site-errors` until the TL amends the criterion and QA updates the check. Screenshots: `docs/03-tasks/F2-T2/shots/designer-legend-*.png`.
