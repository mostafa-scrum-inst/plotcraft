# F1-T1 — Design system, responsive shell and all stage screens (static): implementation plan

Owner: Designer. Step 3a. Inputs: `00-brief.md`, `goals-and-stories.md` (round 2), `architecture.md` (A-1, A-2, A-3, A-15, A-17), `F1-plan.md`.
Scope is the F1-T1 block of `F1-plan.md`: real HTML/CSS/SVG and one data table, no behaviour.

## Round 2 changes (answering `plan-review.md` round 1)

| Review item | Where |
|---|---|
| 1 Short landscape (640x360) layout + assertions | section 3 "Short landscape", section 4 per stage, section 9 |
| 2 "Sample project loaded" strip with the single `btn-skip3d` | section 3 "Sample strip", section 4 stage 1, hook table |
| 3 Hook contract: `btn-q-continue-site/-building/-rooms`; `value` = A-4 state value on every choice; `v3-unavailable-text` | section 8 (hook table + new value table) |
| 4 `palette2d`: `parking`, `pool`, `north` | section 6 |
| 5 Assertions at 360x640, 768x1024, 1280x800, 640x360 | section 9 |
| 6 Meta tags, `data:` favicon, no `xmlns` on inline SVG | section 8 "Document head", section 6, section 9 |
| Rulings and notes adopted | section 10 replaced by the rulings; no `pointer-events: none` on locked steps; unique radio `name`s; assertions as exported functions; Light-tab fallback; caption chip clear of the panel toggle |

## 1. Design direction: "the drawing sheet"

The app should read like a drawing on a drafting table, not like an admin template.

- **Paper and ink.** Warm off-white sheet, near-black blue ink, one accent (drafting blue). Colour is otherwise reserved for meaning: red = blocking/invalid (the "redline"), amber = warning, green = approved.
- **Hairlines, not cards with shadows.** Panels are separated by 1 px rules and sit flat; elevation is used only for things that float (dialog, sheet, toast, 3D overlay). Radius is small (2–4 px).
- **Title-block motifs.** Stage steps are numbered sheet tags (`01`–`05`); question cards carry a `Q7` tag; readouts (area, perimeter, needed / available) are laid out like a drawing title block: small uppercase label over a monospaced tabular figure.
- **Measurements are monospaced** (system mono stack, tabular numerals) everywhere, in HTML and on canvas, so they read as dimensions.
- **Outdoor legibility on a phone.** No grey-on-grey: all text is 4.5:1 or better, most 7:1 or better (table in section 2). Body and control text is 16 px. Canvas strokes are 2 px ink. State is never carried by colour alone (icon + text + colour).
- **Calm.** Motion is limited to 120–180 ms opacity/transform on sheets, dialogs and toasts, and is removed under `prefers-reduced-motion`.

## 2. Tokens (`00-tokens.css`, light theme only)

Dark theme: **not built**. It is not cheap here because the 2D canvases take colours from a JS table, not from CSS. Tokens are semantic so a second theme can be added later without touching components.

**Colour** (contrast computed, WCAG relative luminance):

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--paper` | `#F4F3EE` | app background | |
| `--surface` | `#FFFFFF` | panels, inputs, dialogs | |
| `--sunk` | `#E9E8E1` | stepper track, segmented track, readout cells | |
| `--ink` | `#16212B` | text, canvas outline | 14.7 on paper, 16.3 on surface |
| `--ink-2` | `#46535F` | secondary text, locked steps | 7.1 on paper, 6.4 on sunk |
| `--ink-3` | `#5D6A75` | captions only (12 px uppercase labels) | 5.0 on paper, 4.5 on sunk |
| `--rule` | `#D3D5D0` | hairlines between panels (decorative) | |
| `--border` | `#7C8791` | control borders | 3.7 on surface, 3.3 on paper |
| `--accent` | `#1B4F8F` | primary button, current step, links | white on it 8.2; on paper 7.4 |
| `--accent-strong` | `#143C6E` | pressed / hover | white on it 11.1 |
| `--accent-tint` | `#E2EBF6` | selected segment, info banner | accent on it 6.8 |
| `--danger` / `--danger-text` / `--danger-bg` | `#A8231C` / `#8E1B15` / `#FBE6E3` | blocking, invalid | 7.6 text on bg; white on danger 7.2 |
| `--warn-text` / `--warn-bg` | `#6B4700` / `#FDF0CC` | warnings | 7.3 |
| `--ok` / `--ok-text` / `--ok-bg` | `#1C6B46` / `#17573A` / `#DFF1E6` | approved | 7.3 text on bg; white on ok 6.5 |
| `--focus` | `#C2410C` | focus ring | 4.7 on paper, 5.2 on surface |

**Type** (system stacks only):
- `--font-ui: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- `--font-num: ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace` with `font-variant-numeric: tabular-nums`
- Scale: 12 (uppercase caption, weight 600, +0.04em), 14 (secondary), **16** (body, controls, inputs; also stops iOS zoom-on-focus), 18 (panel title), 22 (stage title from 900 px). Line height 1.4; weights 400 / 600 only.

**Spacing** `--s1..--s6`: 4, 8, 12, 16, 24, 32. **Radius** `--r1` 2 (inputs, chips), `--r2` 4 (buttons, panels), `--r3` 10 (top corners of sheets, dialogs). **Elevation** `--e1: 0 1px 2px rgba(22,33,43,.14)` (floating chips, toast), `--e2: 0 8px 28px rgba(22,33,43,.24)` (dialog, sheet, 3D overlay). **Sizes** `--tap: 44px`, `--header-h: 44px`, `--stepper-h: 48px`, `--bar-h: 56px`, `--panel-w: 360px`. **Motion** `--t-fast: 120ms`, `--t-med: 180ms`. **Focus** `outline: 3px solid var(--focus); outline-offset: 2px` on `:focus-visible` (the offset puts the ring on the surrounding paper/surface, so it stays visible around blue buttons).

## 3. Shell and stepper

```
+--------------------------------------+  header   44   wordmark | unit toggle (m / ft)
+--------------------------------------+  stepper  48   01 02 03 04 05
|  banner slot (0 when empty)          |
|  stage container  (1fr, min-height 0)|  exactly one <section data-stage="n"> visible
|  toast region (floats above bar)     |
+--------------------------------------+  action bar 56 + safe-area   [Back]      [Next]
   dialog layer (fixed, above everything)
```

- `.pc-app` is a CSS grid, `height: 100vh; height: 100dvh`, rows `auto auto auto 1fr auto`. `html, body { overflow: hidden }`; only stage panels scroll (`overscroll-behavior: contain`). No page-level scroll in either direction. Action bar pads with `env(safe-area-inset-bottom)`.
- At 360x640 the chrome is 148 px, leaving 492 px for the stage. Back/Next are grid rows, so they are in view by construction.
- **Short landscape** (`@media (max-height: 480px) and (orientation: landscape)`, below 900 px wide): header and stepper share one 48 px row (wordmark hidden, unit toggle at the row's end), action bar 48 px. At 640x360 that leaves a 640 x 264 px stage. Canvas stages become **two columns**: canvas left (368 x 264 at 640x360), panel right at `--panel-w-short: 272px`, scrolling on its own. Per-stage details in section 4.
- **Sample strip** (`sample-strip`, `hidden` by default): its own grid row between the stepper and the stage, shown by FS on any stage while the sample is unmodified. One 48 px row: info icon, "Sample project loaded", and the only **`btn-skip3d`** in the document (44 px high, right-aligned). Being a grid row it pushes the stage down instead of covering anything: at 360x640 the stage becomes 444 px and the plot canvas 360 x 312, with the readout and tool rows untouched. In short landscape the strip is placed in the action bar's grid row, centred between Back and Next, text hidden and button only, so it costs no stage height.
- **Stepper** (`<ol>` of 5 `<button>`s): each step = sheet tag with number + state icon + label.
  - under 480 px: 5 equal columns; every step shows its number, **only the current step shows its label** ("01 Plot"); done shows a check, locked a lock. One line, each button 48 px high and 60 px wide or more.
  - 480–899 px: all short labels (Plot, Questions, Plans, Interior, 3D).
  - 900 px and up: full labels (Plot, Questions, Floor plans, Interior, 3D view), left-aligned, wordmark and stepper on one row.
  - States: `is-current` (accent tag, 3 px accent underline, `aria-current="step"`), `is-done` (check icon, ink), `is-locked` (lock icon, `--ink-2`, `aria-disabled="true"`, **not** `disabled`, and no `pointer-events: none`, so FS can show the reason when it is tapped). The reason appears in the toast region.
- **Breakpoints**: base (360–599, phone), 600 (tablet: wider gutters, two-column control grids), 900 (canvas stages become two columns: canvas left, panel `--panel-w` right, as in `F1-plan.md`). 768x1024 is therefore single-column with a taller canvas.
- **Action bar**: Back = secondary (left), Next = primary (right, wider). One `btn-next` with a label span that FS sets per stage ("Next: Questions", …, stage 4 "Build 3D model"); hidden on stage 5.

## 4. Stage layouts

Common pattern for canvas stages: `.pc-stage--canvas` = `.pc-canvas-wrap` (holds the `<canvas>`, `touch-action: none`, sized by its container) + `.pc-panel`. Phone: canvas on top, panel docked below it. From 900 px: panel is the right column and scrolls on its own.

**Stage 1 Plot**
- Phone, top to bottom: canvas (360 x 360 at 360x640) with a scale chip top-left ("1 square = 1 m"); message line (hint / error, `aria-live`); readout row (Area, Perimeter, Points); tool row: Undo last point, Clear, and **Close shape** (the stage's primary action, right-aligned). Next stays in the action bar.
- Start panel: a card centred over the empty canvas with "Tap the grid to place the corners of your plot", **Load sample project**, the Resume draft / Start new box, and the "drafts not saved on this device" note. Each part has its own hook and `hidden`. "Skip to 3D" is not here: it lives only in the sample strip (section 3), which is visible exactly when the sample is loaded and unmodified.
- Short landscape: canvas left, panel right (message, readout, tools stacked; start card inside the panel instead of over the canvas).
- Desktop: right panel = start card, title-block readout (Area, Perimeter, Points, Grid), tools, message.

**Stage 2 Questions**
- Group tabs (Site, Building, Rooms, Outdoor), sticky at the top, with "Group 2 of 4, 3 questions left" and a thin progress bar. One group section visible at a time; each ends with an in-flow secondary button "Continue to Building".
- Each question is a `.pc-q` block: `Q2` tag, the brief's wording, control(s), inline note / error line.
- Site preview canvas (Q5/Q6, live for Q2/Q3): phone = sticky under the group tabs while the Site group is open, 180 px high (220 px on tablet), with an edge legend (Front / Back / Side, letter + line style), a compass control (rotate -15 / +15 buttons, value, reset) and street-edge previous / next buttons as the keyboard alternative to tapping an edge.
- Summary and conflicts: phone = collapsible sheet docked above the action bar; its closed row (48 px) shows the status ("2 conflicts" in red, or "All clear, footprint 142.5 m2, 24.4 %"). Open: title-block table (plot, buildable, footprint, vegetation, one row per level "needed / available") and the conflict list (blocking first, then warnings).
- Rooms group: add-room block (type, level, size S/M/L/Exact, area, count, Add), room list grouped by level with a "5 of 8" counter, pair builder (two selects + Add) and pair list, stair position as a small footprint diagram with five radio spots plus lift switch, and the "single level: no staircase needed" note.
- Desktop: left column = questions (max 640 px); right column, sticky = preview on top, summary and conflicts always open.
- Short landscape: two columns. Left (368 px): group tabs (sticky, 48 px) and the questions, 216 px visible, enough for one whole question block. Right (272 px): preview canvas 272 x 200, **not sticky over the questions**, and the summary's closed row below it; opening the summary covers the right column only.
- Phone portrait: the preview has a "Hide preview" toggle (`site-preview-toggle`, `is-collapsed`) so the questions can take the full height.

**Stage 3 Floor plans**
- Phone, top to bottom: level tabs (up to 4, equal width) each with a state badge (pencil = Draft, check = Approved; text shown from 480 px, always in the accessible name) and the "1 of 2 floors approved" counter; plan canvas (about 344 px high at 360x640); readout row (selected room name, width x depth, area) with a "2 warnings" chip that opens the warnings sheet over the canvas; action row: Regenerate this floor (secondary), **Approve floor** (primary, green when approved). The no-layout message is a blocking banner over the canvas with a "Go to room list" button.
- Desktop: right panel = counter, selected-room title block, warnings list (open), Regenerate / Approve.
- Short landscape: canvas left; right panel = level tabs (badge icon only), counter, readout, warnings chip, Regenerate / Approve.

**Stage 4 Interior**
- One scrolling column (max 720 px, centred from 900 px). Q18: three radio cards (Modern, Classic, Minimal), each with a placeholder hint (inline SVG: 4-colour swatch strip + block-room pictogram; F3-T3 replaces the visuals). Q19: two radio cards (Sparse, Full) with pictograms of 2 and 5 blocks. Cards are one column on phone, a row from 600 px.
- Primary action = the action bar's Next, labelled "Build 3D model" (single action, as F3-S4 asks).

**Stage 5 3D view**
- Canvas fills the whole stage. Floating on it: room caption chip top-centre, which during a tour also carries Pause and Stop so they are reachable when the panel is closed; "Building…" state centred; "3D unavailable" message card instead of the canvas.
- Overlay panel, phone: docked to the bottom of the canvas. Head row (44 px) = collapse button + three tabs **View / Light / Tour**; body shows one tab:
  - View: level selector (All, B, G, 1, 2 segmented); Roof switch + Reset view.
  - Light: time slider with its value and the "approximate — not real solar data" note in the label line; four preset icon buttons (morning, noon, evening, night) + season select.
  - Tour: room select (grouped by level); Start, Pause/Resume, Stop + speed (Slow / Normal / Fast).
  - Height budget: 44 + 6 + 44 + 4 + 44 + 6 = **148 px open** against a limit of 164 px (a third of 492); 44 px collapsed. Measured by the verify script.
  - If the measured open height exceeds 164 px, the time value and the note move onto the presets row; targets are not shrunk.
- Desktop: same markup; the panel is a 320 px card docked top-right, the tab row is hidden and all three groups are stacked with headings; still collapsible.
- Short landscape: the canvas stays full-bleed (640 x 264); the panel docks to the right edge, 272 px wide, full stage height, tabs kept, body scrolls; still collapsible to a 44 px button.
- The caption chip is centred in the canvas area not covered by the panel and sits at the top, so it never overlaps `v3-panel-toggle` (bottom on phone, right edge in landscape and desktop). `v3-caption-pause` / `v3-caption-stop` are `hidden` by default, 44 px each.
- Action bar: Back only.

## 5. Components (`30-components.css`)

| Component | Markup basis | Notes |
|---|---|---|
| Button | `<button class="pc-btn">` + `--primary`, `--secondary`, `--quiet`, `--danger`, `--icon` | min 44 x 44; disabled = `disabled` or `aria-disabled="true"` |
| Segmented control | `role="radiogroup"` of native radios + labels | keyboard for free; used for unit, S/M/L, roof, gate, levels, speed |
| Number stepper | `[-] <input type="text" inputmode="decimal"> [+]` + unit suffix | A-15 input rule |
| Slider with value | native `<input type="range">` + `<output>` | 44 px hit height, 24 px thumb |
| Switch | `<input type="checkbox" role="switch">` + label | whole row is the target |
| Select | native `<select>`, custom chevron | native pickers on phone; `optgroup` for rooms by level |
| Field with unit | input + suffix span, error line | `aria-invalid`, `aria-describedby` |
| Chip | static (status) and button (removable, count) | |
| Room row, pair row, conflict item, summary level row, level tab | `<template data-pc="tpl-…">` | section 8 |
| Tabs with approval state | `role="tablist"`; tab = label + badge | `aria-selected`; `is-approved`; `is-invalid` when the level has an error |
| Radio card | radio + label card (exterior swatches, Q18, Q19) | |
| Title-block readout | `<dl>` grid of caption / mono value | |
| Banner | `role="status"` / `role="alert"`, `data-kind="info|warn|block|ok"` | icon + text + optional action; inline message line is the compact form |
| Dialog | `<div role="dialog" aria-modal="true">` in the dialog layer, backdrop | bottom-anchored on phone, centred from 600 px; title, text, slot for extra content (level removal), Cancel / OK |
| Toast | `aria-live="polite"` region above the action bar | |
| Collapsible sheet / panel | toggle button with `aria-expanded` + panel class `is-collapsed` | summary sheet, warnings sheet, 3D overlay |
| Progress | text + 4 px bar | questionnaire |
| Busy state | "Building…" with three drafting ticks | static under reduced motion |

State styling rule: native / ARIA attributes first (`hidden`, `disabled`, `aria-disabled`, `aria-selected`, `aria-pressed`, `aria-expanded`, `aria-invalid`, `:checked`, `data-kind`); `is-*` classes only where no attribute fits. `[hidden] { display: none !important }` in `10-base.css`.

## 6. Icons and 2D palette

**Icon sprite**: one hidden `<svg>` at the top of `<body>` (no `xmlns` attribute on any inline SVG) with `<symbol id="i-…" viewBox="0 0 24 24">`; used as `<svg class="pc-i" aria-hidden="true"><use href="#i-…"/></svg>` (same-document reference, nothing external). Drawn on a 24 px grid, 1.75 px stroke, square caps, miter joins, `currentColor`, no fills except small solids. Set (about 40): `check lock chev-left chev-right chev-up chev-down plus minus close undo trash polygon-close ruler grid north info warn block pencil approved refresh layers roof frame sun sunrise sunset moon leaf play pause stop drone target link star stairs lift car pool cube panel nosave`.

**`js/data/palette2d.js` -> `PC.data.palette2d`** (literals only, sRGB strings usable directly as canvas styles):

```js
{ canvas: '#FBFAF6',
  grid:    { minor: '#E1E3E0', major: '#AEB7BB', label: '#46535F', bounds: '#7C8791' },
  plot:    { fill: 'rgba(27,79,143,0.08)', stroke: '#16212B', open: '#16212B', live: '#1B4F8F' },
  vertex:  { fill: '#FFFFFF', stroke: '#1B4F8F', first: '#C2410C', active: '#C2410C' },
  label:   { text: '#16212B', halo: '#FBFAF6', muted: '#46535F' },
  edge:    { front: '#1B4F8F', back: '#46535F', side: '#7C8791' },
  setback: { fill: 'rgba(168,35,28,0.10)', line: '#A8231C' },
  buildable: { line: '#1C6B46' },
  footprint: { fill: 'rgba(27,79,143,0.16)', stroke: '#1B4F8F' },
  hall: '#EFEDE6', stair: '#C5CBD0', lift: '#AEB7BB', coreLine: '#46535F',
  parking: { fill: '#E3E1DA', stroke: '#46535F' },
  pool:    { fill: '#BFE0EE', stroke: '#1B4F8F' },
  north:   { stroke: '#16212B', fill: '#16212B', text: '#16212B' },
  room:    { stroke: '#16212B', bedroom: '#D6E2F3', bathroom: '#C9EBE6', kitchen: '#F7E7B0', living: '#DCEBC8',
             dining: '#F6D9BF', majlis: '#E6D6EE', office: '#E6E3C4', maid: '#F4D6DC', storage: '#DEDAD3', laundry: '#CDE6F5' },
  state:   { selection: '#C2410C', handleFill: '#FFFFFF', invalidFill: 'rgba(168,35,28,0.28)', invalid: '#A8231C',
             approved: '#1C6B46', unmet: '#6B4700' },
  line:    { grid: 1, plot: 2, room: 1.5, selection: 2.5, dash: [6, 4] },
  font:    { label: '600 12px ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace',
             room: '600 12px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' } }
```

Ink text on every room tint, hall and stair is 9.9:1 or better (computed). Parking and pool: ink text on the fill 12.5 and 11.7; strokes against the canvas 7.6 and 7.8, against their own fill 6.0 and 5.9. Parking is drawn with the dashed line style, the pool solid, so they differ without colour. All `line` and `font` values are CSS pixels. Rooms always carry a name label, and invalid / selected / approved differ by line style as well as colour (invalid = red fill + thick red outline, selection = orange outline + handles, setback = dashed). Room hues are chosen so F3-T3 can derive the 3D floor tints from the same families.

## 7. Accessibility

- Contrast as in sections 2 and 6: text 4.5:1 or better; control borders, icons and focus ring 3:1 or better.
- Targets: every `button, [role=button], input, select, summary, label-for-radio/checkbox` is 44 x 44 px or more by box size (`min-height / min-width: var(--tap)`); small visuals (radio dot, switch, slider thumb) get the size through padding on the label / input box, so QA's bounding-box check passes without special cases.
- Focus: `:focus-visible` ring on everything focusable, including canvases (`tabindex="0"` on the 3D canvas per A-12); never `outline: none` without a replacement.
- Semantics: landmarks (`header`, `nav` for the stepper, `main`), one `h1`, a heading per stage and group; live regions for message lines and toasts; dialog labelled by its title; icons `aria-hidden`, icon-only buttons have `aria-label`.
- `prefers-reduced-motion: reduce`: all transitions and the busy animation off.
- No hover-only information; no colour-only state.

## 8. Files and hooks

**Files created**

| File | Content |
|---|---|
| `build.mjs` | exactly A-17 |
| `src/manifest.json` | 9 CSS files; JS: `js/core/ns.js` (core), `js/data/palette2d.js` (data), `js/main.js` (ui) |
| `src/index.html` | sprite, shell, five stage sections, templates, dialog layer; the three.js tag before `<!--@JS-->`; one comment banner per stage and per template block (file exempt from the 300-line target, A-1) |
| `src/css/00-tokens.css` `10-base.css` `20-shell.css` `30-components.css` `40-stage-plot.css` `41-stage-questions.css` `42-stage-plans.css` `43-stage-interior.css` `44-stage-3d.css` | A-1 list; plus `31-overlays.css` (dialog, toast, banner, sheet) if `30-components.css` passes 300 lines |
| `src/js/core/ns.js` | `PC.VERSION`, `PC.DRAFT_V = 1`, `PC.data = {}` |
| `src/js/data/palette2d.js` | section 6 |
| `src/js/main.js` | 3-line placeholder: un-hide stage 1 |
| `docs/03-tasks/F1-T1/verify/shots.mjs`, `docs/03-tasks/F1-T1/shots/*.png` | section 9 (outside `src/`, so not in the build) |

**Document head.** `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">` (user zoom stays enabled), `<title>`, `<link rel="icon" href="data:,">` (no favicon request). No `xmlns` on inline SVG, so the only `http` string in the output is the three.js tag.

**Hook rules.** kebab-case; unique in the document outside templates; parts inside a `<template>` are unique within that template. Static sample values in the markup (from the 6.2 sample) are placeholders FS overwrites. The full table (name, element, purpose) goes into `outcome.md`; the planned set:

| Area | `data-pc` hooks |
|---|---|
| Shell | `app`, `sample-strip`, `sample-strip-text`, `btn-skip3d`, `unit-toggle` (radios `unit-m`, `unit-ft`), `stepper`, `step-1`…`step-5`, `banner-slot`, `stage-container`, `toast-region`, `tpl-toast`, `tpl-banner` (`banner-text`, `banner-action`), `btn-back`, `btn-next`, `btn-next-label`, `dialog-layer`, `dialog`, `dialog-title`, `dialog-text`, `dialog-extra`, `dialog-ok`, `dialog-cancel` |
| Start | `start-panel`, `btn-sample`, `resume-box`, `resume-meta`, `btn-resume`, `btn-startnew`, `note-nosave` |
| Stage 1 | `plot-canvas`, `plot-scale`, `plot-msg`, `plot-area`, `plot-perimeter`, `plot-points`, `plot-grid`, `btn-undo`, `btn-clear`, `btn-close-shape` |
| Stage 2 groups | `q-tabs`, `q-tab-site` / `-building` / `-rooms` / `-outdoor`, `q-group-site` / …, `q-progress-text`, `q-progress-bar`, `btn-q-continue-site`, `btn-q-continue-building`, `btn-q-continue-rooms` (Outdoor, the last group, has none) |
| Stage 2 site + building | `q-unit`, `q-setback-front`, `q-setback-back`, `q-setback-side`, `q-footprint`, `q-veg`, `site-canvas`, `site-preview`, `site-preview-toggle`, `site-legend`, `q-north-ccw`, `q-north-cw`, `q-north-value`, `q-north-reset`, `q-street-prev`, `q-street-next`, `q-street-value`, `q-floors`, `q-basement`, `q-usable-roof`, `q-ceiling`, `q-roof`, `q-roof-note`, `q-exterior`; each numeric control also has `…-out` (value text), `…-unit` (suffix) and `…-err` |
| Stage 2 rooms | `room-add-type`, `room-add-level`, `room-add-size`, `room-add-area`, `room-add-count`, `btn-room-add`, `room-msg`, `room-list`, `tpl-room-group` (`group-name`, `group-count`, `group-rows`), `tpl-room-row` (`room-name`, `room-type`, `room-level`, `room-size`, `room-area`, `room-area-hint`, `room-master`, `room-delete`), `pair-a`, `pair-b`, `btn-pair-add`, `pair-msg`, `pair-list`, `tpl-pair-row` (`pair-text`, `pair-delete`), `q-stair-pos`, `q-lift`, `q-stairs-none`, `tpl-level-remove` (`level-remove-text`, `level-remove-move`, `level-remove-delete`) |
| Stage 2 outdoor | `q-parking-cars`, `q-parking-covered`, `q-pool`, `q-pool-size`, `q-wall`, `q-gate`, `q-seating` |
| Stage 2 summary | `summary`, `summary-toggle`, `sum-status`, `sum-plot`, `sum-buildable`, `sum-footprint`, `sum-veg`, `sum-levels`, `tpl-sum-level` (`level-name`, `level-needed`, `level-available`), `conflict-list`, `tpl-conflict` (`conflict-text`, `conflict-goto`; `data-kind`) |
| Stage 3 | `plan-tabs`, `tpl-plan-tab` (`tab-name`, `tab-state`), `plan-counter`, `plan-canvas`, `plan-error`, `btn-goto-rooms`, `plan-room-name`, `plan-room-dims`, `plan-room-area`, `plan-warn-toggle`, `plan-warn-count`, `plan-warn-panel`, `plan-warn-list`, `tpl-plan-warn`, `plan-msg`, `btn-regenerate`, `btn-approve`, `btn-approve-label` |
| Stage 4 | `q-interior-style`, `q-interior-density` |
| Stage 5 | `v3-canvas`, `v3-building`, `v3-unavailable`, `v3-unavailable-text`, `v3-caption`, `v3-caption-text`, `v3-caption-pause`, `v3-caption-stop`, `v3-panel`, `v3-panel-toggle`, `v3-tab-view` / `-light` / `-tour`, `v3-pane-view` / `-light` / `-tour`, `v3-level`, `tpl-v3-level`, `v3-roof`, `v3-reset`, `v3-time`, `v3-time-out`, `v3-preset-morning` / `-noon` / `-evening` / `-night`, `v3-season`, `v3-room`, `v3-tour-start`, `v3-tour-pause`, `v3-tour-stop`, `v3-tour-speed` |

**Choice values.** Every radio, `<option>` and segmented choice carries a `value` equal to the A-4 state value, so FS needs no mapping. Each radio group has a unique `name` equal to its hook name.

| Hook(s) | `value`s |
|---|---|
| `unit-toggle`, `q-unit` | `m`, `ft` |
| `q-floors` | `1`, `2`, `3` |
| `q-roof` | `flat`, `pitched`, `terrace` |
| `q-exterior` | `sand`, `white`, `terracotta`, `grey` |
| `room-add-type`, `room-type` | `bedroom`, `bathroom`, `kitchen`, `living`, `dining`, `majlis`, `office`, `maid`, `storage`, `laundry` |
| `room-add-level`, `room-level` | `B`, `G`, `1`, `2` (static markup lists all four; FS hides those that do not exist) |
| `room-add-size`, `room-size` | `S`, `M`, `L`, `exact` |
| `q-stair-pos` | `centre`, `fl`, `fr`, `bl`, `br` |
| `q-pool-size` | `S`, `M`, `L` |
| `q-gate` | `left`, `centre`, `right` |
| `q-interior-style` | `modern`, `classic`, `minimal` |
| `q-interior-density` | `sparse`, `full` |
| `v3-level` | `all`, `B`, `G`, `1`, `2` (`all` is session state, not in A-4) |
| `v3-season` | `spring`, `summer`, `autumn`, `winter` |
| `v3-tour-speed` | `slow`, `normal`, `fast` |
| `v3-preset-*` buttons | `value` = hour of A-13: `8`, `12`, `17.5`, `22` |
| `level-remove-move` / `level-remove-delete` (one radio group `level-remove`) | `move`, `delete` |

Switches (`q-basement`, `q-usable-roof`, `q-lift`, `q-parking-covered`, `q-pool`, `q-wall`, `q-seating`, `v3-roof`, `room-master`) are checkboxes read through `checked`. Numeric controls (`q-setback-*`, `q-footprint`, `q-veg`, `q-ceiling`, `q-parking-cars`, `room-add-area`, `room-add-count`, `room-area`, `v3-time`) hold display-unit numbers.

**State classes FS toggles**: the six of A-15 (`is-current`, `is-done`, `is-locked`, `is-invalid`, `is-approved`, `is-collapsed`); `is-collapsed` is used on sheets, the site preview and the 3D panel, always with `aria-expanded` on the toggle. `is-current` is also used on the 3D panel's pane so that CSS, not `hidden`, decides whether one pane (phone) or all three (desktop) show.

## 9. Verification

1. `node build.mjs` exits 0, prints the size, `dist/index.html` contains exactly one `http(s)` reference (the three.js tag) and no `<link>`, `<img>`, `@import`, `url(http` or `<form>`.
2. `docs/03-tasks/F1-T1/verify/shots.mjs` (node, playwright via `createRequire('/opt/npm-tools/node_modules/')`, `chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })`, the cdnjs request aborted with `page.route`), page = `file://…/dist/index.html`. Each stage 1–5 is forced visible in turn (toggle `hidden` from the script).
   - **Assertion viewports** (project reference): **360x640 touch, 768x1024 touch, 1280x800 mouse, 640x360 touch**. **Screenshot viewports**: those four plus 360x740 and 1440x900. Files: `docs/03-tasks/F1-T1/shots/s<stage>-<w>x<h>.png`; extra shots for dialog open, summary sheet open, 3D panel open/collapsed, sample strip visible, banners of each kind, stepper with done/current/locked.
   - The script paints a demo plot / plan on the canvases from `PC.data.palette2d` (script only, not shipped) so the palette is judged on screen.
   - Assertions, each a plain exported function taking a `page` (`verify/assertions.mjs`) so FS/QA can lift them into `tests/e2e/` in F1-T2:
     - `scrollWidth <= innerWidth`, and no page scroll in height;
     - every visible `button, [role=button], input, select, summary` box is 44 x 44 or more;
     - stepper buttons share one `top`; Back/Next fully inside the viewport;
     - every visible stage canvas is 200 px or more in both directions, at every assertion viewport, with and without the sample strip;
       *Amended by the TL, 2026-11-20 (F2-T2 round 1 Designer change): one exception — the stage-2 site preview in the phone portrait layout (`max-width: 599px` and `min-height: 481px`) has a 176 px canvas plus a one-line legend strip under it; there the check is: canvas 176 px or more high and full width, preview box (canvas + strip) 200 px or more high, legend not overlapping the canvas. Every other canvas, viewport and stage keeps the 200 px rule.*
     - stage 2 with the Site group open: at least one `.pc-q` block is fully inside the viewport;
     - stage 1 with the sample strip shown at 360x640: the strip does not intersect the canvas tools or the readout, and `btn-skip3d` is inside the viewport;
     - 3D panel open height is a third of the canvas or less at 360x640; the caption chip (with Pause/Stop un-hidden) does not intersect `v3-panel-toggle` at 360x640 and 640x360;
     - every hook in the outcome table exists exactly once outside templates (`btn-skip3d` included); every choice control's `value`s equal the value table; radio `name`s are unique per group;
     - `dist/index.html` has charset, viewport (without `user-scalable=no` or `maximum-scale`) and the `data:,` icon; contains no `xmlns=`; the only network request attempted is the three.js script; no `pageerror` / `console.error` other than that aborted request.
3. I look at every screenshot (clipping, wrapping, alignment, legibility) and fix before asking for review. Contrast table re-computed from the final token and palette values by the same script.

## 10. Tech Lead rulings (round 1) and remaining risks

All section-10 items of round 1 were approved and are now part of the plan:
1. `src/index.html` exempt from the 300-line target, with comment banners; `31-overlays.css` allowed (A-1).
2. `is-collapsed` is the sixth state class, with `aria-expanded` set by FS; `is-current` on the 3D panes (A-15).
3. Stage 4's action is `btn-next` relabelled by F1-T2's shell; Next hidden on stage 5.
4. Locked steps: `aria-disabled="true"`, no `pointer-events: none`.
5. Keyboard alternatives for Q5 / Q6 stay.
6. 3D overlay tabs and Pause / Stop on the caption chip stay (`hidden` by default, wired in F5-T2).
7. `palette2d` carries fonts and line widths, in CSS pixels.

Remaining risks, both on the F1 publishing-point checklist: styled range inputs on iOS WebKit (only Chrome can be checked here), and the viewport height inside the host iframe (`100dvh` with `100vh` fallback and the short-landscape rule).
