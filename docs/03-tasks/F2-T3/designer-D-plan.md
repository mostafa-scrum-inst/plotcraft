# F2-T3 Designer pre-step D: plan (Designer, 2026-11-20)

Static markup, CSS, one palette entry and the contract. No JS logic: the FS wires everything in increment 1. Spec: F2-plan "Designer pre-step D" (with CTO round-4 item 5), F2-S4, CD-2, A-15.

**Markup** (`src/index.html`, inside `.pc-preview`, in DOM order: canvas, tap mode, collapse toggle, hint, legend):
- `site-tap-mode`: `div.pc-seg.pc-tapmode[role=radiogroup][aria-label="Tap an edge to"]`, two `.pc-opt` radios `name="site-tap-mode"`: `street` "Street" (checked), `class` "Back / side".
- `site-tap-hint`: `p.pc-taphint[hidden]` "Tap a boundary to switch back / side · * = set by you". The FS removes `hidden` in mode `class`.
- `site-legend-mark`: a sixth legend `li.pc-legend__mark[hidden]` with a bold `*` swatch and "set by you".
- Q6 block, under the note: `q-edges-toggle` (`button.pc-btn--quiet`, full width, chevron, `aria-expanded="false"`, `aria-controls`) and `q-edges` (`ul.pc-edges.is-collapsed`, A-15 collapsible pattern: the FS toggles `is-collapsed` and `aria-expanded`).
- `tpl-edge-row`: `li.pc-edge` > `span.pc-edge__txt` (`edge-name`, `edge-class` stacked on two lines) + `button.pc-btn.pc-edge__switch` (`edge-switch`, "Make side", no `aria-label`: the FS sets it). The street row: the FS writes "front (street)" in `edge-class` and sets `hidden` on its switch (the row keeps 44 px).

**Placement per viewport**
| Layout | Tap mode | Hint (mode `class`) |
|---|---|---|
| Phone portrait (< 600 px, tall) | canvas top left, 8 px inset | covers the 24 px legend strip under the canvas (the legend is hidden while the hint shows) |
| 600 px+ (tablet, desktop) | same | at the legend's place, 8 px inside the canvas bottom; the legend is hidden while the hint shows |
| Short landscape 640x360 (no legend) | same | 8 px inside the canvas bottom; may wrap to two lines in the 271 px column |
| Preview collapsed (phone/tablet) | hidden with the canvas | hidden |

The compass and collapse toggle are on the right. At 640x360 the canvas is 271 px wide and the control is ≤ 150 px, so the two never meet.

**Deviations from the spec**
1. The hint is drawn at the legend's place in every layout, not "directly under the control" from 600 px up. At 1280x800 the canvas is 399 px wide. A ~330 px caption under the control would run into the compass and its "N" label, so it would have to wrap. The legend's place is a single rule that works in every layout. It also uses room the drawing already keeps clear. The caption itself explains the `*`, so hiding the colour legend while it shows loses nothing: the edge labels name each class in text.
2. The phone legend strip gets a fixed height of 24 px (it was 23.8 px), so the hint covers it exactly. The preview becomes 201.0 px, which is still within the site-legend limit of 201 px.

**Drawing:** `PC.data.palette2d.edge.focus = '#C2410C'` (the `--focus` / selection hue, 4.9:1 on the canvas) and `line.edgeFocus = 4`. Row focus style: `.pc-edge:focus-within` uses the accent tint plus a 3 px left bar in the same hue, so the row and the highlighted edge read as one. The switch keeps the normal outer focus ring.

**For the FS (increment 1):** add `site-tap-mode` and `site-tap-hint` to `q-preview.js` `overlays()`, so the drawing and the compass keep clear of them. The tap mode needs padding only when the plot would reach under it. The hint matters only at 640x360, where no legend reserves the bottom.

**Contract:** add the nine hooks to `tests/contract/hooks.json` (`tpl-edge-row` with its three parts), add `site-tap-mode: [street, class]` to `values.json`, and update the F1-T1 outcome hook table.

**Tests:** new `tests/e2e/site-tapmode.spec.mjs` covers the acceptance list at 360x640, 360x740, 640x360, 768x1024 and 1280x800. The hint and the 12 rows are forced visible by the test. `site-legend` and `summary-fit` must stay green.

## Result (implemented the same day)
- Files: `src/index.html` (tap mode, hint, legend mark, Q6 toggle + list, `tpl-edge-row`); `src/css/41-stage-questions.css` (212 lines); `src/js/data/palette2d.js` (`edge.focus`, `line.edgeFocus`); `tests/contract/hooks.json`, `values.json`; F1-T1 outcome hook table; new `tests/e2e/site-tapmode.spec.mjs`; `tests/e2e/site-legend.spec.mjs` now skips hidden legend entries.
- Measured: control 145.9 x 44 px at 8 / 8 px in every layout. Segments are at least 44 px wide (both 44 px high). Compass, toggle and legend are all clear. At 360 px the hint is one line, and at 640 x 360 it wraps to two lines. The phone preview is 201.0 px. The 12 rows are each 44 px or more with no horizontal scroll at 360 px. Tab and arrow keys reach both radios and Tab reaches the 11 switches, each with a ring, and the focused row is highlighted.
- Tests: `site-tapmode` 187/0 (47 failures under a three-rule CSS mutation), `site-legend` 120/0, `summary-fit` 456/0, `contract` 4/0, `questions` 926/0. QA F1-T1: static 169/0, layout 2013/2.
- **Needs QA maintenance (one line):** `tests/qa/inpage.js` line 241–242, the amended phone legend-strip check, walks every `li` of `site-legend`, including the hidden `site-legend-mark`. A hidden `li` has a zero box, so the check reports it as "outside the preview" and as a wrapped strip. The fix is to skip hidden entries (`[...lg.children].filter((li) => !li.hidden)`), as `site-legend.spec` now does. I verified it: without the mark, the suite's only failure is the expected missing hook.
- Open for the FS: the control and the 640 x 360 hint overlap the drawing until `overlays()` includes them (see above). Today the sample's top-left corner and "back" label sit under the control at 640 x 360 and 1280 x 800.
