# F2-T3 Designer pre-step D — Tech Lead review (plan + implementation)

## Round 1 — 2026-11-20

### What I did
- Read `designer-D-plan.md` (incl. Result), the new markup in `src/index.html` (`site-tap-mode` radiogroup with `street` / `class`, `site-tap-hint`, `site-legend-mark`, `q-edges-toggle` + `q-edges`, `tpl-edge-row` with `edge-name` / `edge-class` / `edge-switch`), the CSS in `41-stage-questions.css` (tap mode, hint, legend mark, edge rows, focus-within), `palette2d.edge.focus` / `line.edgeFocus`, the contract files.
- Focused run: `node tests/run-all.mjs --e2e --only site-tapmode,contract,site-legend`: contract 4/0, site-legend 120/0, site-tapmode 187/0 (Designer: 47 failures under a three-rule CSS mutation).
- Own screenshots with the hint forced visible on the sample: 360x640 and 640x360.

### Assessment
Matches pre-step D and CTO D6 / item 5: control 145.9 x 44 px at 8 / 8 px in every layout, 44 px segments, clear of compass, toggle and legend; hint one line at 360 px; edge rows 44 px or more, 12 rows without horizontal scroll at 360 px; radios reachable by Tab / arrows and every switch by Tab, with rings; focused row highlighted; `edge-switch` markup leaves the accessible name to the FS as specified; palette entry for the drawing highlight. Contract and the F1-T1 hook table updated.

### Rulings on the deviations
1. **Tap hint shown in the legend's place in every layout (two lines inside the canvas bottom at 640x360) instead of under the control from 600 px: accepted.** A caption under the control meets the compass at 1280x800, and one rule everywhere is simpler. Consequence accepted: while the mode is "Back / side" the legend is hidden; the classes stay readable from the edge labels (forced for the street and overridden edges) and from the per-edge list.
2. **Phone legend strip fixed at 24 px, preview 201.0 px: accepted.** It is inside both limits (>= 200 by the amended F1-T1 rule, <= 201 by my F2-T2 acceptance check).

### Binding on FS increment 1 (from the known interactions)
- `q-preview.js` `overlays()` includes `site-tap-mode` and (when shown) `site-tap-hint`; `fit()` keeps the drawing clear of both the way it does for the compass (pad only when the plot would reach under them).
- Acceptance in `edges.spec.mjs`: with the control present and the hint shown, the whole plot outline and the "front" label are uncovered at 360x640, 640x360 and 1280x800, and the sample stays at 4.0 px per metre or more at 360x640.
- QA's one-line `inpage.js` fix (skip hidden legend items) is QA's, already in its current round.

### Required changes
None.

### Non-blocking notes
- At 640x360 the hint breaks inside "* = set by you"; joining that phrase with non-breaking spaces (`*&nbsp;=&nbsp;set&nbsp;by&nbsp;you`) would keep it together. Take it whenever the markup is next touched.

VERDICT: APPROVED
