# F1-T1 plan review — Tech Lead

## Round 1 — 2026-11-19

Reviewed `docs/03-tasks/F1-T1/plan.md` (sections 1–10) against the F1-T1 block of `F1-plan.md`, `architecture.md` (A-1, A-2, A-3, A-12, A-15, A-17), the stories (F1-S4, F1-S5, F2-S1..S3, F3-S1..S4, F4-S1..S3, F5-S1..S2 for markup coverage) and R2/R3.

### What is right (keep)
- Scope matches the task: tokens, shell, all five stage screens, components, sprite, `palette2d`, `build.mjs` from A-17, `ns.js`, placeholder `main.js`. No behaviour.
- Shell as a grid with `100dvh` and only inner panels scrolling makes "Back/Next always visible" and "no page-level horizontal scroll" true by construction. The stage budget arithmetic (148 px chrome, 492 px stage at 360x640) is correct.
- Stepper rule under 480 px (numbers everywhere, label on the current step only) satisfies F1-S4 "fits on one line".
- Hook coverage: I walked Q1–Q17, F2-S2 (add/edit/remove, count, master, exact area, pairs, stair/lift, level removal), F2-S3 (summary rows, conflict template with `data-kind` and go-to), F3 (tabs with state, counter, readout, warnings, regenerate/approve, no-layout banner + link), F3-S4, F4/F5 controls. Everything has a hook except the items listed under required changes.
- State-by-attribute first, `is-*` only where no attribute fits; native controls, no `<form>`; contrast table and 44 px rule by box size. Good, and it makes QA's checks simple.
- Verification by script with screenshots the Designer actually looks at.

### Rulings on section 10
1. **File size / CSS split — approved.** `src/index.html` is exempt from the 300-line target (the target is for JS and CSS files). Keep one comment banner per stage and per template block so FS can find sections. Splitting `31-overlays.css` out of `30-components.css` is fine; list it in the manifest. Recorded in A-1.
2. **`is-collapsed` — approved** as the sixth state class, with `aria-expanded` on the toggle (FS sets both). Using `is-current` on the 3D panel's panes is also approved. Recorded in A-15.
3. **Stage 4 action = relabelled `btn-next` — approved.** F1-T2's shell sets `btn-next-label` per stage from one table ("Build 3D model" on stage 4) and hides Next on stage 5. I will check this in the F1-T2 plan review.
4. **`aria-disabled="true"` on locked steps — approved, and required** (F1-S4: a locked step must say why when tapped). The CSS must not put `pointer-events: none` on it.
5. **Keyboard alternatives for Q5/Q6 — approved, keep them.** The compass step buttons are already in the F2-T2 scope; previous/next edge is a few lines there.
6. **Tabs in the 3D overlay and Pause/Stop on the caption chip — approved.** `v3-caption-pause` / `v3-caption-stop` are `hidden` by default and wired in F5-T2; each 44 px or more, and the chip must not overlap `v3-panel-toggle` at 360x640 (F5-T3 tests it; lay it out now so that it holds).
7. **Palette carries fonts and line widths (your item 9) — approved.** They are design data. All values are CSS pixels (FS scales the canvas for device pixel ratio, not the values).

Your items 7 and 8 (native range styling on iOS, viewport height in the host iframe) are accepted as stated; both are on the checklist for the F1 publishing point.

### Required changes
1. **Short landscape layout for canvas stages (R2: portrait and landscape).** At 640x360 the stage has about 264 px. The phone layout stacks canvas, readouts and tool rows, and in stage 2 the sticky preview (180) + group tabs (48) + closed summary (48) is already 276 px, so no question is visible. Add a rule for short viewports (`max-height: 480px` and landscape): canvas stages 1, 3 and 5 go two-column (canvas left, panel right, narrower panel, e.g. 260–280 px, scrolling on its own); in stage 2 the site preview is not sticky (or sits beside the questions) so at least one whole question block is visible. Add to the verify script: at every tested viewport each visible stage canvas is 200 px or more in both directions, and in stage 2 at least one `.pc-q` block is fully inside the viewport with the Site group open.
2. **"Skip to 3D" must be reachable after the sample is loaded.** The start card sits over the *empty* canvas; once the sample fills the plot the card has no place on a phone, yet F1-S5 and the reviewer path (Load sample -> Skip to 3D) need the button exactly then. Provide a compact "Sample project loaded" strip (info banner with the `btn-skip3d` action) that FS can show on any stage while the sample is unmodified, and keep `btn-skip3d` unique (one place only). State in the plan where it sits at 360x640 without covering the canvas tools.
3. **Hook contract details.**
   (a) `btn-q-continue` "one per group" breaks your own uniqueness rule: use `btn-q-continue-site` / `-building` / `-rooms` (the last group needs none).
   (b) Every radio, option and segmented choice carries a `value` equal to the state value of A-4 (`m`/`ft`; `flat`/`pitched`/`terrace`; `sand`/`white`/`terracotta`/`grey`; room type keys; level ids `B`/`G`/`1`/`2`; `S`/`M`/`L`/`exact`; `centre`/`fl`/`fr`/`bl`/`br`; `left`/`centre`/`right`; `modern`/`classic`/`minimal`; `sparse`/`full`; seasons `spring`/`summer`/`autumn`/`winter`; speed `slow`/`normal`/`fast`). List the values in the hook table; FS reads them and must not need a mapping.
   (c) Add `v3-unavailable-text` so FS can set the message (F3-T2 shows "3D not built yet" there before F4 lands; F4-T1 uses it for the WebGL/three.js message).
4. **`palette2d` additions**: `parking` and `pool` (fill + stroke; drawn in the site preview in F2-T2 and the plan view) and `north` (compass/north arrow). Same contrast rule as the rest.
5. **Verification viewports.** Run the assertions at the project's reference viewports: 360x640 (touch), 768x1024 (touch), 1280x800, plus 640x360. Your extra 360x740 and 1440x900 shots are welcome but do not replace them.
6. **No stray requests or false lint hits.** Add `<meta charset>`, `<meta name="viewport" content="width=device-width, initial-scale=1">` (do not disable user zoom) and `<link rel="icon" href="data:,">` so the hosted page makes no favicon request (G5). Do not put `xmlns="http://www.w3.org/2000/svg"` on inline SVG (not needed in HTML, and it would trip the single-external-URL lint of A-16).

### Non-blocking notes
- 3D "Light" tab: the label line above the slider adds height to a 44 px row; your budget of 148 px assumes it does not. If the measured panel exceeds 164 px, put value and note on the same line as the presets rather than shrinking targets.
- Stage 2 at 360x640 with the Site group open leaves roughly 200 px for questions under the sticky preview; consider a "hide preview" toggle if it feels cramped in the screenshots.
- Give every radio group a unique `name`; it is the only thing native radios need without a form.
- Put the verify script's assertions in a shape FS/QA can lift into `tests/e2e/` in F1-T2 (plain exported functions taking a `page`).
- I will run `node build.mjs` and inspect `dist/index.html` myself at the implementation review (CTO instruction).

A short revision of the plan (sections 3, 4, 6, 8, 9) covering the six items is enough; no need to rewrite the rest.

VERDICT: CHANGES REQUESTED

---

## Round 2 — 2026-11-19

Re-read the revised plan: the "Round 2 changes" table, section 3 (short landscape, sample strip), section 4 per-stage landscape notes, section 6 (palette), section 8 (document head, hook table, new value table), section 9 (assertions) and the rewritten section 10.

| # | Status | Where, and what I checked |
|---|---|---|
| 1 Short landscape | Resolved | Section 3: `max-height: 480px` + landscape -> two columns (canvas 368 x 264, panel 272 px at 640x360). Stage 2: questions left with 216 px visible, preview right and not sticky, summary covers the right column only. Stage 5: panel docks right, canvas full-bleed. Section 9 asserts canvases 200 px or more both ways and one whole `.pc-q` block in view. Arithmetic is consistent (640 - 272 = 368; 360 - 48 - 48 = 264). |
| 2 Skip to 3D | Resolved | `sample-strip` as its own grid row (pushes, does not cover: stage 444 px, plot canvas 360 x 312 at 360x640), the only `btn-skip3d`; in short landscape it moves into the action bar row. Assertion added for non-intersection with tools/readout. |
| 3 Hook contract | Resolved | `btn-q-continue-site/-building/-rooms`; value table matches A-4 exactly (units, roof, exterior, 10 room keys, level ids, sizes incl. `exact`, stair positions, gate, interior, seasons, speeds); `v3-unavailable-text` added; unique radio `name`s; switches and numeric controls described. |
| 4 Palette | Resolved | `parking`, `pool`, `north` with contrast figures; parking dashed vs pool solid so they differ without colour. |
| 5 Viewports | Resolved | Assertions at 360x640, 768x1024, 1280x800, 640x360; extra shots at 360x740 and 1440x900. |
| 6 Head / lint | Resolved | charset, viewport without zoom lock, `data:,` icon, no `xmlns`; all asserted in section 9, plus "only network request attempted is the three.js script". |

The round-1 rulings and notes are reflected (no `pointer-events: none` on locked steps, Light-tab fallback, caption chip clear of the panel toggle, assertions as exported functions).

### Non-blocking notes (for implementation and for F1-T2)
- The strip should not show on stage 5 (Skip has nothing to do there, and it would eat canvas height); that is FS's rule in F1-T2, but make sure the stage 5 layout does not depend on the strip row being present or absent.
- `v3-preset-*` carrying the hour as `value` and `v3-level` carrying `all` are fine; note in the outcome hook table that these two are session values, not A-4 state.
- Reminder: the outcome must contain the full hook table (name, element, purpose, values) since it becomes the UI contract (A-2), and I will run `node build.mjs` and read `dist/index.html` at the implementation review.

### Required changes
None.

VERDICT: APPROVED
