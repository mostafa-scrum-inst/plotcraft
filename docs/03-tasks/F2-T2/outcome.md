# F2-T2 — Questionnaire Q1–Q10 and Q15–Q17, site preview, live summary and conflicts: outcome

Owner: FS. Step 3f. Plan: `plan.md` (approved round 1 with 10 rulings and 6 conditions). Reviews: `plan-review.md`; `impl-review.md` (round 1 changes requested, round 2 approved, round 3 (QA fixes) approved); `qa-report.md` (round 1 failed on one major bug, round 2 passed). This step changed no code.

## 1. What was built

Stage 2 is a working questionnaire for Q1–Q10 and Q15–Q17. The Rooms group (Q11–Q14) is static markup until F2-T3.

- **Groups and progress.** Four groups follow the brief's order (Site, Building, Rooms, Outdoor), with tabs and Continue buttons. The progress line reads "Group n of 4 · k questions left": the questions of the current group plus those of groups not yet opened, counted per session.
- **One binding per control** (A-4: the state holds only valid values).
  - **Number fields (Q2 setbacks, Q15 cars).** They show the current unit, accept typing and the − / + steppers (0.5 m or 1 ft per step), and use `inputmode="decimal"`.
    - Text that is not valid stays in the field. It is marked `aria-invalid`, gets an error line, is listed in `PC.store.session.invalidFields`, and becomes a `field-invalid` conflict that blocks stage 2.
    - Leaving an untouched field never rewrites the stored value.
    - Enter finishes the entry; its default action is cancelled (see round 3).
  - **Sliders (Q3, Q4, Q8).** While dragging, the value under the finger is shown live in the label, the preview and the summary. The rule is at most one site analysis per frame; when one analysis takes over 50 ms, live updates stop for the rest of that drag. The value is stored on `change`.
    - The gesture also ends on pointer up or cancel anywhere, on blur or on key up without a `change` (round 2). Chrome sends no `change` when the thumb is released on its starting value.
    - In ft, Q8 works on 8.0–14.5 ft in 0.5 ft steps and stores metres.
  - **Radios and switches.** These cover Q1, Q7, Q9, Q10, Q15 covered, Q16 and Q17.
    - With a usable roof, Pitched is disabled; a stored Pitched switches to Flat and a note is shown.
    - The pool size is disabled while the pool is off.
- **R5.** Layout-class answers go through `PC.store.propose`: Q2, Q3, Q6 and Q7 when no rooms are lost. Appearance answers go through `commit`. Lowering Q7, or turning the basement off, while the removed level has rooms opens one own dialog (Delete / Cancel). That dialog names every floor plan the change makes stale or removes, taken from `PC.store.affected`; on Delete the change is committed with no second question. F2-T3 replaces it with the move / delete / cancel dialog.
- **Site preview** (`site-canvas`, frame L, street edge at the bottom).
  - **What it draws:** the plot, the setback zone, the footprint with its area, parking, the pool, and the edges by class (front thick, back solid, side dotted).
  - **Labels:** edges carry class labels, culled when short. The street edge is always labelled "front".
  - **View:** always fitted and locked (no pan, pinch, wheel zoom or view keys; the wheel is left to the page).
  - **Q6:** tap an edge, or use prev / next ("Edge i of n · length").
  - **Q5:** drag the compass, or use ↻ / ↺ / reset in 15-degree steps in W. The compass snaps as the stored value does, so the arrow does not jump on release. The readout is in whole degrees: "0° · toward the back", "12° clockwise from the back".
- **Live summary.** It shows plot area, buildable area, footprint (area and %), vegetation (area and %), and needed / available per level. It also lists conflict and warning rows taken from `PC.validate` and a status line ("All clear", "n to fix", "n warnings").
  - "Fix" collapses the phone sheet, opens the group, brings the question into view and focuses its invalid field, or else its first control.
  - Rows are rebuilt only when they change, so a focused Fix button is not replaced under the user.
- **Riders.**
  - F1-S5: switching the unit (header toggle or Q1) keeps `sampleClean`, so Skip to 3D stays.
  - The plot readout now states the snap step only: "Snap 0.5 m" / "Snap 1 ft".
- **F2-T1 minors (fixed in round 2).**
  - The footprint fallback also runs when the centred result rounds under 20 m². QA's thin triangle now gets 8 x 4 = 32 m² with no `no-fit`.
  - The `pool-omitted` clearance is worded through `PC.units` ("1.0 m" / "3.3 ft").

## 2. Files

| File | Content |
|---|---|
| `src/js/ui/q-fields.js` (new) | `PC.ui.qfields`: `number`, `slider`, `radios`, `toggle` bindings |
| `src/js/ui/stage-questions.js` (new) | stage 2 controller: groups / progress, the bindings table, `setLevels` + `plansText`, Q5 / Q6 readouts, live pending value, `goToQuestion` (Fix) |
| `src/js/ui/q-preview.js` (new) | `PC.ui.qpreview`: site preview, `frontLabel`, compass, edge tap, overlay measurement |
| `src/js/ui/summary.js` (new) | `PC.ui.summary`: summary numbers, level rows, conflict rows, sheet collapse |
| `src/js/ui/view2d.js` | `locked` option; the `fit` pad is capped at 70 % of the canvas (was a third) |
| `src/js/ui/draw2d.js` | `setbackZone`; `edgeLabels` passes the edge index to `fmt` and skips an edge whose `fmt` returns `null` / `''`; `label` accepts `o.force` |
| `src/js/ui/stage-plot.js` | readout "Snap 0.5 m" / "Snap 1 ft" |
| `src/js/ui/shell.js`, `src/js/main.js`, `src/manifest.json` | stage 2 registered; unit toggle with `keepSample`; 30 scripts |
| `src/js/core/store.js` | `commit(..., { keepSample })`; `affected(candidate)` exported, and the gate itself calls it |
| `src/js/core/frames.js` | `backW`, `northToW`, `northStep` |
| `src/js/core/units.js` | `stepLen`, `fmtDims`, `parseNum` |
| `src/js/core/levels.js` | `prune` |
| `src/js/core/site-footprint.js`, `validate.js` | the two F2-T1 minors |
| `tests/e2e/questions.spec.mjs` (new) | 926 checks at hand-over: 360x640 touch, 768x1024 touch, 1280x800 mouse, and 640x360 for fields / riders / keyboard R5 |
| `tests/helpers/touch.mjs` | `G.path()`: one pointer along a polyline (drag away and back) |
| `tests/unit/{validate,footprint,signature}.test.mjs` | pool text in both units, the triangle, `PC.store.affected`, "once per visit" for a second still-valid level; 252 unit tests |
| `docs/03-tasks/F2-T2/shots.mjs`, `shots/` | screenshot script and the round-1 screenshots (44 files) |

Designer files in this task (CSS only, not mine): `src/css/41-stage-questions.css`, `tests/e2e/site-legend.spec.mjs` and `tests/e2e/summary-fit.spec.mjs` (section 6).

## 3. Public APIs later tasks reuse

**Stage 2 controller.** `PC.ui.stages.questions.init()` registers stage 2 with the shell (`enter`, `render`). F2-T3 adds its Rooms bindings to the same `binds` table and reuses three things:
- `setLevels`: replace its plain dialog with the three-way one, keep `PC.levels.prune`, and name plans through `PC.store.affected`;
- `goToQuestion(q)`: Q12 maps to the Q11 block;
- the `live()` rule for any dragged value: one analysis per frame, 50 ms cut-off.

**`PC.ui.qfields`** (`d` is the binding description; each binding returns `{ render(state) }`):
- `number(d)`: `{ hook, key, q, label, kind: 'len' | 'count', min, max, read(state), apply(v) }`. Lengths are typed and shown in the current unit and stored in metres. Hooks used: `hook`, `hook-err`, `hook-unit` (lengths), `hook-dec`, `hook-inc`.
- `slider(d)`: `{ hook, read, apply, toCtl(v, unit), fromCtl(x, unit), text(v, unit), attrs(unit) -> {min, max, step} | null, live(v | null) }`. `live(null)` marks the end of a gesture. The control does not render from state while the user holds it.
- `radios(d)`: `{ hook, read, apply, disabled(state, value) }`.
- `toggle(d)`: `{ hook, read, apply }`.
- `apply` may return a promise (`propose`). The control re-renders when it settles, so an R5 Cancel restores the field, thumb and label.

**`PC.ui.qpreview`**:
- `init({ state(), setStreet(i), northLive(degL | null), northSet(degL) })`. `state()` may include a pending value.
- `render()` sizes, fits and draws synchronously.
- `View2D.named.site` is the view.

**`PC.ui.summary`**:
- `init(onFix(q, level))`
- `render(state)`: everything comes from `PC.validate(state)`
- `collapse(yes)`

**`PC.store`**:
- `affected(candidate)`: ids of the levels whose plan is valid now and which the candidate would make stale or remove, lowest level first. It is the gate's own computation. F2-T3's three-way dialog and F3-T2's Clear dialog must name their plans from it. Build the candidate with exactly the mutation you will commit (including `prune`).
- `commit(mutator, { keepSample: true })`: a normal commit that leaves `sampleClean` alone. Only the unit change uses it.

**`View2D` option `locked`**:
- no pan, pinch, wheel zoom or view keys, and the wheel is not consumed;
- taps, `hitTest` and handle drags still work.

**`PC.ui.draw2d`**:
- `setbackZone(view, pts, dist[], { color, alpha })` draws an even band inside a polygon;
- an `edgeLabels` `fmt(len, i)` may return `null` / `''` to leave an edge to the caller;
- `label(..., { force: true })` draws even when the spot is taken. TL ruling: use it only for the street label, because it ignores `o.avoid`.

**`PC.frames`**:
- `northL(state)`: the north in L, in degrees, unrounded;
- `backW(state)`;
- `northToW(state, degL)`: snapped to 15° in W;
- `northStep(state, ±1)`.

**`PC.units`**:
- `stepLen(unit)`: 0.5 m or 1 ft, in metres;
- `fmtDims(w, d, unit)`: "3.0 × 6.0 m";
- `parseNum(text)`: a finite number or `null`; accepts a decimal comma and `3.` / `.5`; refuses `1e2`, `0x10` and `Infinity`.

**`PC.levels.prune(draft)`**: drops the rooms, pairs and plans of levels that no longer exist and returns the removed rooms. F2-T3's move / delete dialog calls it after moving rooms.

**`PC.debug` additions** (read-only, added with `Object.assign`):
- `siteLabels()`: draws now and returns the labels placed;
- `siteDial()`: compass centre in viewport coordinates, and its radius;
- `siteNorth()`: the north angle in L that the compass shows, the dragged one while a drag is under way;
- `view('site')`;
- `toScreen('site', u, v)`.

## 4. How to verify

1. `node build.mjs && node tests/run-all.mjs` exits 0. Focused run: `node tests/run-all.mjs --unit --e2e --only questions,shell,plot`. QA suite only: `node tests/run-all.mjs --qa --only f2-t2`.
2. In a browser, open `dist/index.html`, then Load sample and Next. Each slider, field, stepper, radio and switch updates its readout, the preview and the summary. Switch m / ft: nothing is stored and Skip to 3D stays on stage 1.
3. Seed valid plans (in the console: `PC.store.commit(s => PC.levels.ids(s).forEach(id => s.plans[id] = { sig: PC.sig.level(s, id), rooms: [], unmet: [], edited: true, approved: true, error: null }), { nav: true })`).
   - Type 4 in the front setback and press Enter: "Regenerate floor plans?" stays open. Cancel (or Esc) restores everything; Continue stores 4 m.
   - Q7 2 → 1 floor: the own dialog names the Ground and First floor plans.

## 5. QA sign-off

| Round | Suite | Result | Full run |
|---|---|---|---|
| 1 | `tests/qa/f2-t2-questions.mjs` (new, runner `run-f2-t2.mjs`): 799 checks over sections A–G at 360x640 touch, 640x360 touch, 768x1024 touch and 1280x800 mouse. Real input only, a full sync against QA's own model after every action, 10 source mutations all caught | 797 / 2: **FAILED** on bug 1 (Major); bug 2 (Minor) KNOWN | exit 1 in 308.2 s |
| 2 | the same suite plus section K (keyboard regression of focus items 1, 3, 6 and 7, with and without plans) | **946 / 0, no KNOWN: PASSED** | exit 0 in 329.1 s |

- **Bug 1 (Major, fixed by FS in round 3).** Enter in a size-changing number field answered the R5 dialog with Cancel in the same keystroke, so the value was silently dropped.
  - Fix: `e.preventDefault()` before the blur in `q-fields.js` `number`.
  - Every other key path that can open a dialog was probed and is not affected: steppers by Enter / Space, Q6 buttons, Q7 radio arrows, switches, slider keys, Backspace on stage 1.
  - Mutation checks: without the fix my spec has 24 failures and QA's 11.
- **Bug 2 (Minor, fixed by the Designer).** Summary figures were ellipsized at 640x360 in ft.
- The FS's last full run before QA round 2 (after the Designer's summary fix) exited 0 in 309.8 s, with every suite at 0 failures:
  - lint 0, unit 252;
  - e2e: contract 4, fit-button 42, plot 512, questions 926, site-legend 120, start-card 14, shell 554, summary-fit 456;
  - QA: F1-T1 169 + 2015, F1-T2 792, F1-T3 1022, F2-T1 1126, F2-T2 799.
- QA spec gaps 1, 2, 4 and 5 are closed in `questions.spec.mjs`:
  - radios, switches and the unit toggle are tapped on their labels;
  - the keyboard R5 case runs at four viewports;
  - Esc cancels are covered;
  - there are 640x360 runs.

  Gap 6 stays open: summary figures are compared only with `PC.validate` in my spec. QA's independent model covers it.

## 6. Tech Lead rulings across the three rounds

- **Plan review (10 rulings and 6 conditions).**
  - Ten rulings:
    1. `q-fields.js` approved.
    2. A plain delete confirmation for Q7 until F2-T3.
    3. "Questions left" counted per session.
    4. A third floor without rooms can only be undone through Q7, until F2-T3.
    5. The preview keeps `touch-action: none`.
    6. The buildable area is shown as what the shading leaves free.
    7. No vegetation in the preview.
    8. Next on stage 2 stays disabled until F3-T1; tests raise `MAX_BUILT`.
    9. Live slider feedback with the measured 50 ms rule.
    10. Q5 wording.
  - Six conditions, all met at the implementation review:
    1. At most one analysis per frame.
    2. Whole-number fields refuse "1.5" and show no unit in the limit text.
    3. `locked` leaves the wheel alone.
    4. The Rooms group is inert.
    5. `keepSample` is not a second `nav`.
    6. Three green full runs and no fixed sleeps.
- **Implementation review round 1: changes requested** (six items):
  1. stuck slider;
  2. the Q7 dialog must name every lost plan;
  3. raw float in the Q5 readout;
  4. "front" always labelled;
  5. the F2-T1 minors;
  6. green runs.

  It also ordered a Designer change: the phone legend as a strip. All six were resolved in round 2.
- **Round 2: approved.**
  - The zero-delay timer that ends a slider gesture is accepted: it orders events, it does not wait.
  - The `plansText` wording is accepted. "regenerated or lost" is used for a mixed case; F2-T3 may split the sentence.
  - The `draw2d` `fmt`-null / `o.force` additions are accepted, with `force` for the street label only.
  - `siteNorth` was added to A-2.
  - The phone preview box measures 200.8 px, so it meets the 200 px rule by its border box.
- **Round 3 (QA fixes): approved.** Bug 1 is fixed at the cause; bug 2 is fixed in CSS only.
- **Accepted deviations (round 1):**
  1. `PC.levels.prune` drops the rooms, pairs and plans of a removed level in the same change.
  2. The `View2D.fit` pad is capped at 70 % instead of a third.
  3. The phone preview was too small, which became the Designer change.
  4. The `PC.debug.siteLabels` / `siteDial` hooks.
  5. The Q6 readout "Edge i of n · length".
  6. A whole-state replace resets the group, the progress and the invalid-field list.

## 7. Designer changes in this task (CSS only)

1. **Phone legend strip** (impl-review round 1). Applies under `@media (max-width: 599px) and (min-height: 481px)` in `41-stage-questions.css`.
   - The legend is a single line under a 176 px canvas instead of overlaying the drawing. The preview keeps about 200 px in total.
   - The sample now draws at 4.13 px/m (was 3.05) and "back" is labelled.
   - The TL ruled an exception to the 200 px canvas rule for this canvas; QA amended `f1-t1-layout.mjs` to match.
   - Spec: `site-legend.spec.mjs` (120 checks).
2. **Summary rows wrap** (QA bug 2). When a figure does not fit beside its label, it drops to its own right-aligned line. Only 640x360 in ft renders differently. Spec: `summary-fit.spec.mjs` (456 checks).

## 8. Known limits and tech debt

**Interim until F2-T3 or F3-T1:**
- The Rooms group is inert: its "Add room" and "Add pair" do nothing. The client will meet this on the republished preview.
- Q7 uses the plain delete dialog (F2-T3: three-way).
- A third floor without rooms can only be undone through Q7.
- Next on stage 2 stays disabled until F3-T1.
- R5 cannot be met in the product before F3-T1 creates plans. Tests seed them with real signatures.

**Not done by design:**
- Vegetation is not drawn in the preview (F4-T3).
- The legend has no Parking / Pool entries (Designer, F5-T3).
- Short non-street edges stay unlabelled.

**QA's eight observations (round 1, still apply in round 2):**

| # | Observation | Owner |
|---|---|---|
| 1 | Fix on "has no rooms" opens the still-inert Rooms group (Q11); the only working fix today is Q7 | F2-T3: keep Fix pointing at the room list. Then it works |
| 2 | A 0.5 m side-setback change resizes the building (9.5 x 15 → 9 x 15.5 m on the sample) and asks R5, although the old building would fit | PM (A-6 / R5 working as written) |
| 3 | Short edges carry no class label (thin plot's back edge, U-arm ends) although F2-S1 says "labels each edge" | PM. TL accepted culling for non-street edges |
| 4 | The footprint area label is wider than a narrow building ("775 sq ft" on the thin plot) | Designer, F5-T3 |
| 5 | The pool-size note wraps inside an entry at 360x640 | Designer, cosmetic |
| 6 | `pool-omitted` gives no hint of what would help (lower footprint %, smaller setbacks) | PM |
| 7 | A floor without rooms shows "needs 10 m²" (the stair allowance) beside "has no rooms" | PM |
| 8 | The Rooms buttons do nothing until F2-T3 | known, interim; tell the client |

**Other items:**
- **Client decisions CD-1..CD-3** (`docs/01-product/client-decisions.md`): 3:1 footprints when forced, and edge-class overrides in the site preview. Not in this task; planned for F2-T3. The preview's `frontLabel` and the `edgeLabels` `fmt` callback are where the override labels will hook in.
- **F1 real-device gate: still OPEN, awaiting the client** (`docs/04-feature-reviews/F1.md`). The five phone observations are still wanted. The republished preview now carries the questionnaire, so the client's first touch check of stage 2 can be part of that answer.
- **One QA F1-T1 layout flake** (640x360 `s2-building`, seen once, not reproduced). QA hardened its hit test and records transient misses as notes.
