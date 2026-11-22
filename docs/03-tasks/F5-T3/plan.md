# F5-T3a plan: presentation and device pass, no phone evidence needed (Designer, with FS for camera code)

Step 3a of F5-T3a. Plan only; nothing is implemented until the TL plan review.

Sources:
- the TL split (`docs/03-tasks/F5-T2/outcome-review.md` §1–2);
- the CTO gate rulings (`docs/04-feature-reviews/F4-cto-gate.md`, ruling 1, conditions a–c);
- F1–F4 feature reviews;
- every task outcome that routed an item to "F5-T3";
- `docs/RESUME.md` "Known limits owned by Designer F5-T3";
- A-10 / A-12 / A-13 / A-14 / A-16;
- my F3-T3, F4-T2 and F4-T3 notes.

**Ground rules:**
- **CTO condition a.** Nothing here is tuned on an assumption about phones: the closing radius, gesture thresholds, pixel ratio, shadow-map size and anything justified as "phones need" stay in **F5-T3b**. Items below that change a phone *layout* are geometry measured in headless Chrome at the phone viewport (overflow, coverage, 44 px targets), not touch or performance tuning.
- **Runtime:** the default full run stays ≤ 420 s at `--jobs 3`; 480 s is never exceeded.
- **Owners:** every item names one. Designer = CSS, markup, data tables (`src/js/data/*`, the `PC.C.TOUR` numbers by proposal), Designer e2e specs and verify scripts. FS = `core/*`, `three/*` and `ui/*.js` logic, each with a unit test.

## 0. Work list and owners

| # | Item | Source | Owner | Kind |
|---|---|---|---|---|
| 1 | Screenshot + layout sweep, 5 stages × {sample, empty} × 4 viewports | TL split | Designer (spec + script), QA runs `QA_FULL=1` | test, verify |
| 2 | Stage-5 panel at 640x360 (42.5 % coverage) | F1 review, F1-T1 outcome | Designer (CSS) | layout |
| 3 | Tour caption / bar placement, never over the panel toggle; "Building…", "3D unavailable" | TL split | Designer (CSS) | layout |
| 4 | Desktop framing under the 320 px panel | F5-T1 finding 8 | **FS** (`core/cam.js`, `three/tour.js`, `ui/stage-3d.js`) + unit test; Designer specifies (§4) | camera |
| 5 | Tour pacing and mid-leg framing | TL split | Designer proposes `PC.C.TOUR` numbers; FS commits (`const.js` is core) | data |
| 6 | O-1 summer-evening shadows | F4-T3 QA O-1 | Designer (`sky.js` + goldens in the same commit) | data |
| 7 | F1 polish: toast on a unit change, lighter area label, toast when saving stops, full quota and the hidden no-save note | F1 review item 7 | split (§7) | UI |
| 8 | Designer known limits (RESUME list and routed polish) | RESUME, F2 / F3 outcomes | Designer, with FS where marked | polish |

The order follows the dependencies: 1 first (it is the baseline the others are judged against), then 2, 3, 6 and 8 (Designer, independent), 4 and 5 (FS / camera), and 7.

## 1. Screenshot and layout sweep

**What it covers.** Every stage (1 – 5) × project state {**sample**: Load sample, everything approved; **empty**: a fresh start, so stage 1 with its start panel and stages 2 – 5 locked in the stepper} × viewport:
- default run: 360x640 and 1280x800;
- under `QA_FULL=1`: also 640x360 and 768x1024 (TL §2 pattern).

**Where it lives:**
- **`tests/e2e/device-sweep.spec.mjs`** (Designer). One page per viewport, stages reached through `PC.store.go` and `btn-skip3d` (no re-load per stage), three.js **mock** (layout only).
- Assertions per stage state, reusing `tests/helpers/assertions.mjs`:
  - no page scroll;
  - Back / Next in view;
  - tap targets ≥ 44 px;
  - no text clipped or overflowing (`scrollWidth ≤ clientWidth + 0.5` on every visible text box);
  - contrast ≥ 4.5 on visible text;
  - focus visible: Tab through each stage; every focused element has a visible outline ≥ 2 px, and the focus order follows the DOM / visual order;
  - pressed / disabled / invalid states have their distinct computed styles;
  - stage 5: panel coverage (§2) and caption-vs-toggle overlap (§3).
- **Runtime budget:** about 4 s per default-run viewport, so +8 s.
  - The last full run was 413.3 s. That is over 420 unless something goes.
  - I will fold the existing `interior.spec` layout loop (5 viewports) into the sweep: its stage-4 hint checks move into the sweep's stage-4 step. The F3-T3 hint assertions keep their names and mutation proofs.
  - I measure before merge. If the run is still > 420 s, I ask QA for a trim under the A-16 rule.
- **`docs/03-tasks/F5-T3/verify/shots.mjs`** (Designer, not in run-all): the same walk with **real r128** (`tests/vendor`). It writes PNGs to `verify/shots/` (sample + empty, 4 viewports; plus stage 5 at the presets and in the tour at fixed τ for §5 / §6). This is my eyes-on pass. It is not part of the test runtime.

**Findings** from the pass become concrete items in §8 (they are listed in `impl-notes.md` with screenshots before the fix and after it).

## 2. Stage-5 panel at 640x360 (42.5 % of the canvas)

- **Today.** The panel is a 272 px absolute overlay over a full-width canvas. The model is framed for 640 px, and 42.5 % of it sits under the panel (F1-T1 outcome).
- **Change (Designer, `44-stage-3d.css`): in short landscape, stage 5 uses the same side-by-side grid as stages 1 – 3.**
  - The canvas is 368 px wide and the panel 272 px beside it (`.pc-stage--canvas` rule in `20-shell.css`). The canvas is never covered: coverage 0 %.
  - Collapsed, the panel is a 44 px strip: the canvas takes the rest of the width.
- **Why this is enough:**
  - The canvas `ResizeObserver` already re-fits aspect, limits and the reset radius (`scene.js` `resize`), and the pose is kept (clamped). No JS change.
  - The camera then frames for the visible canvas automatically, so §4's offset is not needed at 640x360.
  - The 2D stages already use this layout, so landscape behaves the same in every stage.
- **Checks (sweep, `QA_FULL=1` viewport):**
  - canvas ∩ panel = 0 px² expanded;
  - collapsed canvas width = viewport − 44 ± 1;
  - Reset after collapse → the house bounding circle inside the canvas (projected with the mock camera);
  - every pane fits the 272 px column at 44 px targets (already true: F4-T3 measured slider 207, presets 4 × 44, season 255);
  - the 5-level selector of the maximum house without overflow.
- **Phone note (condition a).** This is not a touch or performance tuning, and 640x360 is the QA viewport, not a device claim. A real-phone finding on it is F5-T3b.

## 3. Caption / tour bar, "Building…", "3D unavailable"

- **The caption chip** ("Room · Level", with Pause / Stop during a tour) is centred over the visible canvas, at the top:
  - **360x640 / 768x1024:** the panel docks at the bottom, so there is no conflict. Check that the caption is ≥ 8 px from the header and inside the canvas.
  - **1280x800:** its centre is at `(canvas − 320 − 16) / 2`. Check that it never intersects the panel card (toggle included) for the longest caption of the maximum house ("Master bedroom · Second floor"). If it would, `max-width: calc(100% − 320px − 3 × var(--s4))` with the level part truncating first (F5-T1 rule).
  - **640x360:** after §2 the caption is inside the 368 px canvas, so the existing short-landscape `left` / `max-width` override goes, because the canvas no longer spans the panel.
- **Assertion (sweep and tour state):** caption rect ∩ (`v3-panel-toggle` rect ∪ panel rect) = ∅ at every viewport, expanded and collapsed, while a tour runs (seeked via `PC.debug.tourSeek`).
- **"Building…" and "3D unavailable":**
  - centred over the visible canvas (side-by-side makes this automatic at 640; at 1280 the card is centred in the canvas minus the panel);
  - text ≤ 420 px, no overflow at 360;
  - the unavailable card's "Back" path is in view.
  - Both are swept with the existing hooks (`v3-building` forced visible for the measurement; `three: 'abort'` for unavailable).

## 4. Desktop framing under the 320 px panel (FS change, Designer spec)

**Problem** (F5-T1 finding 8). At 1280x800 the floating panel covers the right 336 px of the canvas (320 + 16 margin). After a room pick, the room is centred on the full canvas, so a wide room's right quarter can sit under the panel. Reset and the tour have the same bias.

**What I need — one pure helper and three call sites:**
- **`PC.cam.frameShift(pose, fov, viewW, viewH, occl)` → pose.** `occl = { right: px, bottom: px }` is the area covered by overlays.
  - It moves the target so the pose's target lands at the centre of the **uncovered** rectangle: by `−occl.right / 2` px horizontally and `−occl.bottom / 2` px vertically, at the target's depth.
  - The move uses the existing `PC.cam.pan(p, dx, dy, PC.cam.metresPerPx(p, fov, viewH))`, so it is exact for the target plane.
  - Then `C.clamp(…, limits)`.
  - Pure; `occl` all 0 → the same pose (deep-equal).
- **Effective aspect for radius fits.** `resetRadius(house, aspect)` and the finder radius use the visible aspect `(viewW − occl.right) / (viewH − occl.bottom)`, so a wide room fits the visible part, not the whole canvas.
- **Call sites (FS):**
  - `forRoom` (finder flight end pose);
  - `reset` (Reset view and the tour overview stops);
  - `three/tour.js`: per frame, the eye and the look point both move by the same screen-space vector, so the path keeps its shape.
- **Occlusion source (FS, `ui/stage-3d.js`):**
  - `occl.right` = panel width + its right margin when the panel is the **desktop floating card** and expanded; 0 when collapsed, in the bottom dock, or side-by-side (§2).
  - `occl.bottom` = 0 in F5-T3a. The phone bottom dock is a phone question (condition a), so its framing waits for F5-T3b evidence.
  - Re-read on panel toggle and resize. A change marks the frame dirty; the camera is not moved unless an animation or Reset uses it next.
- **Unit test** (`tests/unit/cam.test.mjs`, FS):
  - zero occlusion → identical pose;
  - `occl.right = 336` at 1280x800 → the target projects to x = (1280 − 336) / 2 ± 1 px with the mock camera maths;
  - a pick on the widest room of the maximum house → its four floor corners project inside the uncovered rectangle;
  - clamp respected near the plot edge.
- **E2e** (FS adds one check in `view3d-real`; real r128, 1280x800): after picking the sample's widest room, the highlight's screen bbox lies left of the panel.

## 5. Tour pacing and mid-leg framing (data, `PC.C.TOUR`)

**Method** (`verify/tour.mjs`, real r128, 1280x800 and 360x640, sample + maximum house + a basement house, per the F5-T1 B-1 rule):
- frames at each stop and at **25 / 50 / 75 % of every leg** via `PC.debug.tourSeek`;
- for each frame I record:
  - the current room's floor-quad coverage on screen at the stop (target ≥ 8 % of the visible canvas);
  - whether the look point is hidden behind a wall top or roof edge mid-leg (ray test on the model);
  - the eye height against `treeGap`;
  - the angular speed (degrees of view rotation per second) on every leg.

**Proposed targets** (judged on these frames, not on phone feel):
- **Speed:** view rotation ≤ 45° / s at Normal (no whip pans).
- **Stop framing:** every stop frames its room (coverage ≥ 8 %), and the caption is up for the whole stop.
- **Duration:** stays inside the A-14 30 – 90 s for the sample at Normal (today 53.5 s).
- **Output:** a table of current vs proposed `overviewLeg`, `roomLeg`, `eyeOut`, `eyeOutK`, `eyeUp`, `leadInMs`.
  - Only numbers change. FS commits them to `const.js`, and `tourplan.test` / `tour.test` goldens are regenerated in that commit.
  - The sample duration is restated in the outcome.
  - If the frames show no problem, the numbers stay and I record that.

## 6. O-1: summer-evening shadows (data-only `sky.js`; goldens in the same commit)

**Cause** (F4-T3 QA O-1). At 17.5 h in summer the sun is at the Y clamp of 0.15. The direct term on horizontal ground (`sunI × 0.15 × lum(sunColor)`) is small against the hemisphere term, so the tree shadows on grass hardly differ from the lit grass. Only 204 px change by more than 30 levels at 1280x800, against 47 351 at 17 h.

**Retune** (data only; the A-13 code and clamp unchanged): raise the share of direct light in the evening keys, keeping the brightness order. Starting point, refined against the frames:

| key | sunI now → proposed | hemiI now → proposed |
|---|---|---|
| 17 golden | 0.60 → 0.75 | 0.42 → 0.34 |
| 18 dusk | 0.40 → 0.55 | 0.36 → 0.30 |

- **Estimate** (Lambert): at 17.5 h summer the direct / total ratio on the ground rises from about 0.19 to about 0.27. E_top stays between noon and night: noon > evening > night holds in all four seasons.

**Acceptance (measured by me with QA's O-1 metric, real r128, 1280x800, the sample):**
- summer 17.5 h: ≥ 15 000 px change by more than 30 levels when all shadow casters are toggled (today 204; 17 h has 47 351);
- the F3-T3 invariants still pass:
  - night hemiI ≥ 0.25 and night sunI ≤ ¼ noon (the night keys are untouched);
  - noon ≥ 5 × night in every season;
  - night background L* ≤ 15;
  - evening sits between noon and night.

**The same commit regenerates** (one data change, every copy of its consequences):
- the 16-row preset golden in `tests/unit/sky.test.mjs` (FS file, golden rows only; FS consents in review);
- the table in `docs/03-tasks/F4-T3/designer-plan.md` §2, marked "superseded by F5-T3";
- my `docs/03-tasks/F3-T3/verify/check-colours.mjs` output in the outcome;
- `data-tables.test.mjs`: unchanged rules, still green.

**Not mine:** QA's `tests/qa/f4-t3-ref.mjs` keeps its own oracle. I tell QA the new key values before merge, so its golden moves in its own commit, as QA owns `tests/qa`.

**Not here:** phone colour or contrast retunes (F5-T3b) and shadow-map size (condition a).

## 7. F1 polish not tied to the phone

| Item | Change | Owner |
|---|---|---|
| **Toast shows the old unit** (F1 note 3: "minimum 538 sq ft" toast after switching back to m) | On a unit change, `PC.ui.toast` drops every toast raised with a measurement. The new API is `toast(text, { units: true })`; the measurement toasts in stage 1 pass it. They are not re-worded, because the message line already shows the current value. | FS (`ui/dialog.js`, call sites) + unit / e2e; Designer reviews |
| **Lighter area label** (inner-side edge labels crowd it on small plots) | New `palette2d.font.area` = `'500 12px <room stack>'` and `palette2d.label.area` = `label.muted` #46535F (7.6:1 on canvas). Edge labels keep 600 weight and ink. | Designer (data); FS swaps one constant in `draw2d` |
| **Toast when saving stops mid-session** | When `storage.set` fails after a success, one toast. PM text needed; proposal: "Saving stopped: this browser's storage is full or blocked. Your work stays open until you close the page." Shown once per session. | PM text; FS (`ui/storage.js`, `PC.ui.autosave`) |
| **Full quota at start** (draft exists but the adapter turns off, so it is not offered) | Read-only fallback: if the probe write fails but `getItem` works, offer **Resume** of the stored draft and show the no-save note. Today it hides a draft the user has. | FS (`ui/storage.js` `probe` split into `canRead` / `canWrite`); TL to rule on scope |
| **Hidden no-save note** (it lives in the start panel, which is hidden once a plot exists) | When saving is off, a small persistent `#i-nosave` icon chip sits in the header beside the unit toggle, `aria-label` "Drafts are not saved on this device", 44 px target, tap → the same text as a toast. Hidden while saving works. | Designer (markup, CSS); FS (one render line) |

## 8. Designer known limits and routed polish

Each item gets a before / after screenshot from §1. I keep it in F5-T3a when its fix is CSS, markup or data. Anything needing phone evidence is marked T3b.

**RESUME list:**
1. **Overridden-edge label pile-up** (9 – 11 short overridden edges on a phone):
   - draw `*` labels with the same culling as other labels, except that the **street** edge stays forced;
   - overridden edges whose label is culled get a small `*` tick at the edge midpoint;
   - the edge list remains the full reference.
   - Designer spec; FS one-liner in `q-preview` label placement. Test: 12-vertex staircase, no two labels overlap.
2. **Legend wraps at 1280x800 with "\* set by you":** shorter entry "\* yours", or legend `font-size` 12 px in the side panel. Pick by measurement: the street-mode and class-mode drawings must be equal in size.
3. **Area label wider than narrow footprints:** when the label's width > footprint width − 8 px, draw it on two lines ("108" / "m²"). If that still does not fit, place it outside the footprint on the street side with a 1 px leader. Designer spec + `palette2d`; FS `draw2d` placement.
4. **No Parking / Pool legend entries:** add two swatch entries, shown only when the item exists (markup + CSS, existing palette colours).
5. **Pool-size note wraps at 360 px:** shorten it with the PM ("Pool S / M / L: 18 / 32 / 50 m²" form), or `pc-note` 12 px. Test: one line at 360.

**Routed from F3-T2 / F3-T3 / F1-T1:**

6. **Stage 3:**
   - the handle pill over "Stairs", and labels overlapping while rooms overlap;
   - the outward handle over the stair (hit order: TL, decided after the screenshots);
   - the 640x360 readout's three empty lines → one line "Tap a room" when none is selected;
   - the warnings chip covering a label at the default fit → the chip moves to the bottom-left corner that has no label under it, or the fit reserves its 32 px.
7. **Stage-4 card alignment ≥ 600 px:** name and radio left-aligned with the description (TL F3-T3 note 4).
8. **Stage-3 worst case at 640x360:** with a three-line blocking message, Approve sits half below the fold. The message gets `max-height` 3 lines with ellipsis plus the full text in the warnings sheet; Approve stays in view.
9. **Stage-2 Site group on phone:** re-measured with real content; it changes only if the sweep shows a clipped control.
10. **Corner resize:** out unless the client asks (PM round 6). Recorded, no work.

**After F5-T3a**, RESUME's "Known limits owned by Designer F5-T3" is rewritten to hold only what is left for T3b.

## 9. Tests, mutations, runs

- **Designer:**
  - `device-sweep.spec.mjs` (§1–3);
  - `data-tables.test` stays green after §6, with goldens regenerated;
  - the palette2d `font.area` / `label.area` keys are added to the room-labels / palette test.
- **FS:**
  - `cam.test` (§4);
  - one `view3d-real` check;
  - toast, autosave and storage unit cases (§7).
- **Mutations (each must fail a test):**
  - stage 5 back to an overlay at 640;
  - the caption `max-width` removed at 1280;
  - `frameShift` sign flipped;
  - `occl.right` ignored on collapse;
  - `sky.js` evening keys reverted (O-1 pixel check);
  - the area label back to 600 ink;
  - the legend entry for Pool shown without a pool;
  - toast `units` ignored.
- **Runs:**
  - focused runs per item;
  - one full run with its time, ≤ 420 s;
  - QA's F5-T3 round runs the sweep with `QA_FULL=1` (release gate);
  - republish at the end of the batch (CTO condition b).

## 10. Questions

**TL:**
1. Stage 5 side-by-side at 640x360 (§2) instead of a narrower overlay. OK?
2. `PC.cam.frameShift` + visible-aspect radius fits (§4), with `occl.bottom` held at 0 until T3b. OK?
3. Fold `interior.spec`'s layout loop into the sweep to pay for its runtime (§1)?
4. Full-quota read-only resume (§7 row 4): in scope, or a recorded limit?
5. The outward-handle-over-stair hit order (§8 item 6).

**PM:**
- the "saving stopped" toast text;
- the no-save chip label;
- shorter legend and pool-note wording (§8 items 2 and 5).

**FS:** consent to the golden-row regeneration in `sky.test.mjs` in the O-1 commit; the `PC.C.TOUR` numbers via my proposal table.

**QA:** the O-1 key values before merge (for `f4-t3-ref.mjs`); the sweep's `QA_FULL=1` viewports.
