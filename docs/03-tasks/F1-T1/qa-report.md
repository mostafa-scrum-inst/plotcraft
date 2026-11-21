# F1-T1 QA report — QA Tester

## Round 1 — 2026-11-19

Build under test: `node build.mjs` -> `dist/index.html` 110.9 kB, 3 scripts, 10 stylesheets (exit 0).
Scope: static markup/CSS only, judged against the F1-T1 acceptance list in `F1-plan.md`, the hard constraints of `00-brief.md` and the product-wide rules that apply to static UI (R2, R3). Behaviour belongs to later tasks and was not judged.

### What I tested and how

Own checks, written independently of the Designer's `verify/` scripts (I read those, did not reuse them):

| File | What |
|---|---|
| `tests/qa/lib.mjs` | launcher (headless Chrome, cdnjs request aborted and recorded, console/page errors and native dialogs recorded), WCAG contrast maths |
| `tests/qa/inpage.js` | in-page helpers: force a stage/state, fill every template with realistic and worst-case content, and the layout checks |
| `tests/qa/f1-t1-static.mjs` | node only: build, external references, forbidden constructs, fonts, token and palette contrast |
| `tests/qa/f1-t1-layout.mjs` | browser: markup contract, 29 UI states x 4 viewports, stepper in all 5 positions, sample strip on stages 1/3/4, keyboard focus walk, reduced motion |
| `tests/qa/run-f1-t1.mjs` | runs both |
| `tests/qa/probe.mjs` | one-off measurements |

Run: `cd /home/claude/plotcraft && node tests/qa/run-f1-t1.mjs` (add `--no-shots` to skip screenshots, `--only=360x640` on the layout suite for one viewport). Screenshots and `metrics.json` go to `tests/qa/shots/F1-T1/`.

Viewports: 360x640 touch, 768x1024 touch, 1280x800 mouse, 640x360 touch.
States forced per viewport: stage 1 (start card, resume + no-save note, drawn, sample strip + blocking message + ft values), stage 2 (each of the four groups, error lines shown, preview collapsed, 8 + 3 rooms with pairs, no-stairs note, summary open with 4 levels and 4 conflicts, summary closed with conflicts), stage 3 (2 tabs, 4 tabs with approved/invalid states and a selected room, warnings open, no-layout banner), stage 4, stage 5 (View with 5 levels, Light, Tour with caption Pause/Stop, collapsed, Building, 3D unavailable), confirm dialog, level-removal dialog, toast, banner.
Checks per state: no page scroll (html/body/app sizes, `window.scrollTo` has no effect), every rendered `button, [role=button], input, select, summary, a, [tabindex]` at least 44 x 44, stepper on one line with no spill, Back/Next inside the viewport and not covered, nothing cut off by a non-scrollable box, text fits its box, no two controls intersect, every enabled control can be hit at its centre after scrolling its own scroller, open sheets/panels fully reachable, rendered text contrast against the effective background, computed fonts, canvas size, no console errors or native dialogs.

Result: **static suite 107 passed / 0 failed; layout suite 1661 passed / 16 failed.** All 16 failing checks belong to the four bugs below (nothing else fails).

Screenshots looked at by eye (not only by script): phone portrait for every stage and state listed above (`s1-start`, `s1-resume`, `s1-strip-msg`, `s2-site`, `s2-building`, `s2-rooms` + two scrolled captures, `s2-outdoor`, `s2-summary-open`, `s3`, `s3-max`, `s3-warn-open`, `s4`, `s5-view`, `s5-light`, `s5-tour`, `x-dialog-level-remove`, `x-banners`, all `-360x640`), plus `s2-site-640x360`, `s3-max-640x360`, `s5-tour-640x360`, `s2-site-768x1024`, `s5-tour-768x1024`, `s2-rooms-1280x800`, and focus captures (`focus-*.png`).

### Results per acceptance criterion

| Criterion (F1-T1) | Result | Evidence |
|---|---|---|
| F1-S4 stepper states exist visually | PASS | current = filled number tag + label + accent underline; done = check icon; locked = lock icon + lighter ink, `aria-disabled`, not `disabled`, pointer events kept. Checked with each of the 5 stages current, 4 viewports (`stepper-<n>-360x640.png`) |
| F1-S4 stepper fits one line at 360 px | PASS | one row, no overlap, no spill, numbers always shown, at all 4 viewports and all 5 positions |
| F1-S4 Back/Next visible without scrolling at 360x640 | PASS | inside the viewport and hittable in every state, also with the sample strip and a banner present |
| R2 no page-level horizontal scroll at 360 / 768 / 1280 (and 640x360) | PASS | no page scroll in either direction in any of the 29 states |
| R2 every interactive element 44 px or more | PASS | 0 undersized targets in any state, including cloned room rows, pair rows, tabs, conflict "Fix", caption Pause/Stop |
| R2 visible focus state | PASS (see bug 5, minor) | keyboard walk over 10 states at 360x640 and 1280x800: every tab stop is rendered, in view and has a 3 px `#C2410C` ring; ring contrast 4.2-5.2 on the surfaces it sits on; a mouse click leaves no ring; tabbing never scrolls the page |
| R3 dialog and message components exist | PASS | `dialog` (role=dialog, aria-modal, labelled, backdrop covers the app, buttons reachable at all viewports, also with the level-removal content), banner template with 4 kinds, toast region (aria-live), inline message lines with `data-kind`. No native dialog opened in any run |
| F4-S2 overlay panel collapsible, covers a third of the canvas at most at 360x640 | PASS | open: View 144 px, Tour 144 px, **Light 162 px of a 490 px canvas = 33.1 %** (limit 163.3 px, margin 1.3 px); collapsed 44 px; `is-collapsed` + `aria-expanded` |
| Brief: no external fonts, images or scripts other than the three.js tag | PASS | exactly one external URL (the literal r128 tag, before the app scripts, no defer/async); the only network request attempted at load is that tag; no `<img>`, `<link>` (other than `data:,` icon), `url()`, `@import`, `@font-face`; computed fonts are the two system stacks everywhere, canvas fonts in `palette2d` too |
| Hook table matches the markup | PASS | all 202 document hooks of `verify/hooks.json` exist exactly once, the 11 templates and their 30 parts exactly once, nothing unlisted, one root element per template, no ids inside templates |
| Choice values match A-4 | PASS | compared with a table I wrote from A-4 (units, floors, roof, exterior, 10 room keys, level ids, sizes, stair positions, pool, gate, interior, seasons, speeds), set-equal with no extras; static defaults equal section 4.1; slider ranges 10-80, 0-80, 2.4-4.5; preset hours 8 / 12 / 17.5 / 22 |
| Text contrast of body text and buttons at least 4.5:1 | PASS | from tokens: 25 text pairs, lowest 4.52 (`--ink-3` on `--sunk`), body 14.7, primary button 8.2; rendered check over every visible text node in all states: lowest 5.0, none below 4.5 (disabled controls included) |
| `node build.mjs` produces one file with one external URL | PASS | |

Further checks, all PASS: no inline event handlers, no `<form>`, no `style=` attributes, no `alert/confirm/prompt`, `window.open`, `fetch`, `XMLHttpRequest`, service worker, `import`, `localStorage`, `xmlns`, no zoom lock in the viewport meta; `prefers-reduced-motion: reduce` leaves no transition or animation on any element or pseudo-element (59 elements have one without the preference, including the busy ticks); all canvases `touch-action: none`; Q1-Q17 in four groups in brief order with the brief's wording, Q18-Q19 only on stage 4; unique ids, every `for` / `aria-controls` / `aria-labelledby` / `aria-describedby` resolves, every `<use>` resolves to a symbol, radio names unique per group, every control has an accessible name, numeric inputs are `type=text inputmode=decimal`, all buttons `type=button`; `palette2d` has every required key, 10 distinct room tints, label text 8.0:1 or better on every fill, strokes 3.5:1 or better on the canvas; page loads with no error when three.js is unavailable; only `PC` is added to the global scope.

### Bugs

**1. Major — Stage 2, phone: the open summary sheet is cut off by the action bar, conflicts cannot be read or reached.**
- Steps: 360x640, stage 2, Site group (the default group, site preview open), open the summary (`summary` without `is-collapsed`) with the four fixed rows, two level rows and one conflict.
- Expected: the whole sheet is inside the stage, or its body scrolls so the conflict list and its "Fix" buttons can be reached (F2-S3 messages are blocking; R2 layout works at 360 px).
- Actual: the sheet starts at y = 361 and is 309 px tall; the stage ends at y = 583. The lowest 87 px (with 4 levels + 4 conflicts) are under the Back/Next bar. With a single conflict the body is 240 px (below its 260 px `max-height`, so it does not scroll) and the conflict row and its Fix button sit at y = 600-645, completely hidden. Only 173 px of the body are visible; even with no conflict the second level row is cut (content 187 px).
- Cause: `.pc-sheet__body { max-height: 260px }` (31-overlays.css:71) plus preview (200 px) plus nav exceeds the 490 px stage; the grid row overflows and `.pc-stages` clips it. Fine in the other groups (preview hidden), at 768x1024, 640x360 and 1280x800.
- Screenshots: `tests/qa/shots/F1-T1/bug1-summary-one-conflict-360x640.png`, `s2-summary-open-360x640.png`. Failing checks: `360x640 s2-summary-open` "open sheets and panels lie inside the stage" and "every control hittable".
- Suggested fix: let the summary row take the remaining height (e.g. the sheet body `max-height: min(260px, <available>)` through a `minmax(0, auto)` grid row with `min-height: 0` and the body as the scroller), or collapse the preview while the sheet is open.

**2. Major — Readout values are truncated at 360 px: plot area in ft mode and all three plan readouts.**
- Steps: 360x640. (a) Stage 1, set `plot-area` to `6458 sq ft` (the F1-S2 example value). (b) Stage 3 as shipped (no change). (c) Stage 3 with a selected room: `Master bedroom`, `16.4 × 19.7 ft`, `323 sq ft`.
- Expected: readout values are fully legible at 360 px (they are the measurements the screen exists to show; there is no tooltip on touch).
- Actual: (a) `6458 sq …` (96 px available, text needs a little more; any plot of 10 000 sq ft or more loses more). (b) the default text reads `None select…` in the shipped static state (needs 125 px, has 121). (c) `Master bedr…`, `16.4 × 19.…`, `323 sq …`. At 640x360 the Size cell also truncates (`16.4 × 19.7…`).
- Cause: `.pc-tb dd` is 16 px monospace, `white-space: nowrap; text-overflow: ellipsis` in three equal 120 px cells with 12 px (stage 1) / 8 px (stage 3) padding.
- Screenshots: `s1-strip-msg-360x640.png`, `s3-360x640.png`, `s3-max-360x640.png`, `s3-max-640x360.png`. Failing checks: "text fits" for `plot-area`, `plan-room-name`, `plan-room-dims`, `plan-room-area`.
- Suggested fix: 14 px values and/or tighter padding below 480 px, uneven column widths, or wrap to a second line; the worst cases to fit are `107639 sq ft`, `Master bedroom`, `26.2 × 32.8 ft`.

**3. Minor — Room-row and pair selects truncate their selected text on phone.**
- Steps: 360x640 or 640x360, stage 2 Rooms group with rooms of type Bathroom / Bedroom / Maid's room; 640x360 pair builder.
- Expected: the closed select shows the chosen type / room.
- Actual: `Bathr…`, `Maid'…` (63 px of text width, 69-94 needed). At 640x360 `pair-a` / `pair-b` have 48 px and already cut the placeholder "Room A", so real room names will read as two or three letters. At 1280x800 a row with Exact size cuts "Maid's room" by 2 px. The row's bold name above makes the type inferable, hence minor.
- Screenshot: `s2-rooms-list-scrolled-360x640.png`. Failing checks: "text fits" for `room-type`, `pair-a`, `pair-b`.

**4. Minor — 640x360, stage 3 with four levels: tab labels overflow their tabs.**
- Steps: 640x360, stage 3, tabs Basement (error), Ground (approved), First, Second.
- Expected: four tabs fit the 272 px panel.
- Actual: tabs are 68 px, "Basement" + icon needs 78; the label is cut at the panel edge ("asement"), state icons run into the neighbouring tab, and the tab row is 3 px wider than the stage. Tabs remain tappable. Fits at the other three viewports (at 360x640 with zero spare pixels).
- Screenshot: `s3-max-640x360.png`. Failing checks: `640x360 s3-max` "nothing clipped", "text fits", "every control hittable" (the 3 px overflow).

**5. Minor — Focus ring partly clipped on some controls.**
- The ring (3 px, offset 2 px) is cut by an `overflow: hidden` parent: `v3-panel-toggle` at 1280x800 shows only its right and bottom sides; `unit-m` loses its top side at every viewport; controls touching the panel edge (setback steppers, tool-row buttons, 3D panel rows, room-row selects) lose one side. Focus is still identifiable everywhere, so not failing the criterion. An inset ring (`outline-offset: -3px`, as already used on steps, tabs and canvases) on those controls fixes it.
- Screenshots: `focus-v3toggle-1280x800.png`, `focus-unit-360x640.png`.

### Non-blocking observations
- 3D Light pane passes the one-third limit by 1.3 px (162 of 163.3). Any added line breaks it; the TL already ruled that nothing may be added there.
- At 640x360 the 3D panel is a 272 px right column = 42.5 % of the canvas area; at 1280x800 the card is 20.8 %. The one-third rule is defined at 360x640 only, so this is noted, not failed. The panel collapses to 44 px in both.
- Stage 2, Site group at 360x640 leaves about 175 px for questions between the preview and the summary row (one question at a time). The preview toggle works and frees the space.
- Stage 3 at 360x640 with four tabs has no spare width ("Basement" touches the tab edges); a longer level name would overflow as in bug 4.
- 640x360, stage 3 worst case (three-line blocking message): the Approve button is half below the fold of the right panel; the panel scrolls, so it is reachable.
- The site-preview auto-hide relies on CSS `:has()`; to be confirmed on the real phone at the F1 publishing point (TL note).
- Static placeholders ("Group 1 of 4 · 17 questions left" under every group, "Master" star on every room row, "16" in the disabled exact-area field) are for FS to drive in F2; not defects of this task.
- `src/index.html` and several CSS files are within the agreed limits (no file over 300 lines apart from the exempt `index.html`).

### Verdict
Every item of the F1-T1 acceptance list passes. The task fails on two major layout defects found under "nothing clipped" at the reference phone viewport (bugs 1 and 2); bugs 3-5 are minor and can be fixed in the same pass or deferred to F5-T3 at the TL's choice. Re-test: `node tests/qa/run-f1-t1.mjs` must report 0 failures for the checks tied to bugs 1 and 2 (the bug 3-4 checks will keep failing until those are fixed or the TL defers them, in which case I will mark them as known).

VERDICT: FAILED

---

## Round 2 — 2026-11-20 (re-test after the Designer's CSS fixes, TL review round 3)

Build under test: `node build.mjs` -> `dist/index.html` 147.3 kB, 14 scripts, 10 stylesheets. The tree now also contains the F1-T2 JavaScript; this round judges F1-T1 only (markup/CSS, contract, constraints). F1-T2 behaviour was not tested.

### Changes to the QA suite
- Three static checks were snapshots of the F1-T1 moment and are re-scoped to the real constraint, valid for later tasks:
  - **Native dialogs**: a call is flagged when it is a bare `alert( / confirm( / prompt(` or goes through `window / globalThis / self / top / parent`; member calls on other objects such as `PC.ui.dialog.confirm(` (A-15) are allowed. Checked per source file and on the built scripts; the browser suite still fails on any native dialog that opens.
  - **localStorage** (A-3): no manifest file other than `src/js/ui/storage.js` may mention `localStorage` / `sessionStorage`; inside that file every occurrence must sit inside a `try { }` that has a `catch`.
  - **Manifest** (A-1 / A-2): every file under `src/js` and `src/css` is listed and exists, layers match folders, `ns.js` first and `main.js` last, JS inlined in manifest order with one `<script>` each, core files free of DOM / timers / THREE, ui files free of THREE, A-2 module form.
  - Mutation-tested on a throwaway copy: a planted `confirm('x')`, `window.alert`, a `localStorage` use in `shell.js`, an unguarded one in `storage.js` and `document` in a core file were each caught.
- Hook contract is read from `tests/contract/hooks.json` (identical to the F1-T1 copy: 202 hooks, 11 templates).
- New states so the round-1 evidence is regenerated by the suite itself: `s2-summary-one-conflict`, `s2-rooms-list-scrolled`, `s2-rooms-pairs-scrolled`, `s1-worst-readout` (`107639 sq ft`), `s3-worst-readout` (`26.2 × 32.8 ft`, four tabs). The two stale probe screenshots were deleted; all 180 files in `tests/qa/shots/F1-T1/` are from this run.
- `lib.mjs` collector accepts a list of open minor bugs: matching problems are printed as `KNOWN` and do not change the exit code. One entry (bug 6 below).
- Runner contract for `tests/run-all.mjs` (A-16): `node tests/qa/run-f1-t1.mjs [--no-shots]` exits 0 / 1, ignores unknown flags, needs no arguments. `tests/run-all.mjs` does not call `tests/qa/run-*.mjs` yet; that is for FS to add in F1-T2 (noted for the F1-T2 test round).

### Results
`node tests/qa/run-f1-t1.mjs`: **static 137 passed / 0 failed; layout 1929 passed / 0 failed**, 4 known-minor hits (bug 6). 34 states x 4 viewports. Also green: the Designer's `verify/shots.mjs` (659 / 0) and `node tests/run-all.mjs`.

| Round-1 bug | Result | Evidence |
|---|---|---|
| 1 Summary sheet cut off (major) | **Fixed** | 360x640, Site group, preview open. Single conflict: the whole sheet is inside the stage, the conflict row and its Fix button are visible and hittable with no scrolling (`s2-summary-one-conflict-360x640.png`). 4 levels + 4 conflicts: the sheet takes the stage height below the group tabs, its body scrolls, every Fix button is reachable, Back/Next uncovered (`s2-summary-open-360x640.png`). Unchanged and passing at 768x1024, 1280x800, 640x360 |
| 2 Readouts truncated (major) | **Fixed** | 360x640: `6458 sq ft`, `107639 sq ft` / `1312.3 ft`, `None selected`, `Master bedroom`, `16.4 × 19.7 ft`, `26.2 × 32.8 ft`, `323 sq ft` all whole; 640x360 likewise (`s1-worst-readout-360x640.png`, `s3-worst-readout-360x640.png`, `s3-max-640x360.png`) |
| 3 Select text truncated (minor) | **Fixed for room rows**, one residue (bug 6) | "Maid's room", "Bathroom", "Bedroom", "Basement", "Exact" whole at 360x640, 640x360 and 1280x800 (`s2-rooms-list-scrolled-360x640.png`); pair placeholders whole |
| 4 Four level tabs at 640x360 (minor) | **Fixed** | name over state icon, no overflow, row no wider than the panel; also roomier at 360x640 |
| 5 Focus ring clipped (minor) | **Fixed** | keyboard walk: every tab stop has its ring on all four sides at 360x640 and 1280x800 (0 clipped-ring notes; round 1 had dozens) |

Acceptance list: every row of the round-1 table still passes with the same figures (3D panel 144 / 162 / 144 px of 490; lowest rendered text contrast 5.0; one external URL; no page scroll; all targets 44 px or more; stepper on one line in all five positions).

### Open bug
**6. Minor — Pair selects cut the longest room name on phone.** 360x640 and 640x360, Rooms group, `pair-a` or `pair-b` with "Master bedroom" selected: shows `Master bedro…` (text needs 125 px, has 116). The full name is readable in the open picker and in the pair row once added. Screenshot: `s2-rooms-pairs-scrolled-360x640.png`. Suggested: 8 px left padding on these two selects as in the room rows, or 15 px text. Can ride along with any later Designer task (F5-T3 at the latest); remove the `known` entry in `tests/qa/f1-t1-layout.mjs` when fixed.

### Non-blocking observations
- On phone the open summary now covers the questions (intended). As the TL noted, "Fix" must collapse the sheet before scrolling to the question (F2-T2).
- 3D Light pane margin is still 1.3 px under the one-third limit.
- With F1-T2's scripts present, forcing states from the test still works because nothing re-renders without a store commit; from F1-T2 onwards behaviour tests drive the real UI instead.

VERDICT: PASSED
