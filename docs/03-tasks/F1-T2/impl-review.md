# F1-T2 implementation review — Tech Lead

## Round 1 — 2026-11-20

### What I did
- Read every source file of the task in full: `core/const.js`, `geom.js`, `store.js`, `stages.js`, `draft.js`, `sample.js`; `ui/dom.js`, `storage.js`, `dialog.js`, `shell.js`, `start.js`; `main.js`; and the test infrastructure (`tests/run-all.mjs`, `lint-constraints.mjs`, `helpers/load.mjs`, `helpers/browser.mjs`, `e2e/contract.spec.mjs`), plus the case table of `unit/lint.test.mjs`.
- Ran `node tests/run-all.mjs`: exit 0 (build, lint 0 violations, unit 166 passed, e2e contract 4/0, e2e shell 509/0). Ran QA's `tests/qa/f1-t1-static.mjs`: 137 passed, 0 failed (QA has already re-scoped the three snapshot checks).
- Ran my own browser probe at 360x640 touch, independent of the e2e spec: load sample -> Next -> tap locked step 4 -> Back -> Skip to 3D -> reload -> toggle unit while the draft is pending -> Resume -> toggle unit -> reload -> Start new with Esc, then with OK. Observed states were all correct (details below); zero page errors, console errors, native dialogs or stray requests.

### Findings against the plan, A-4 and the stories
- **Store (A-4).** Shape and defaults match A-4 / 4.1 exactly. State is deep-frozen; `commit` clones, ignores no-op commits, clears `sampleClean` unless `nav`; a throwing mutator leaves the state alone; subscriber errors are isolated. `session` carries `r5Confirmed`, `draftPending`, `invalidFields`. `cmpId` is numeric. No timers, DOM or clock in any core file (also enforced by the `core-purity` lint rule).
- **Gating (R1, F1-S4).** `PC.stages.status` implements the A-4 table; stage 3 validity already checks `error` and the signature when `PC.sig` exists. Probe: locked step 4 on stage 2 gives the toast "Approve all floors first", the step keeps `aria-disabled` and a `title`. Back/forward changes only `stage`.
- **Draft (F1-S5).** `parse` is strict (exact key sets, enums from `PC.C`, 4.1 ranges, id rules, pair rules, plan rooms on their level) and wrapped in try/catch; key derived from `PC.DRAFT_V`. `storage.js` is the only file naming `localStorage`, guards the property access, and degrades to a no-op. Autosave is a ui subscriber with 400 ms debounce, flush on `visibilitychange`/`pagehide`, suspended while a draft is pending, and removes the key for an empty project. Probe: key written after the sample is loaded; after reload the app shows defaults with the resume box ("Saved Nov 20, 2026, 12:05 AM · stage 2 of 5"); a unit change made while the draft is pending does not overwrite the stored draft; Resume restores stage 2, 5 points, `sampleClean` true; Esc keeps the draft; Start new + OK removes the key and the resume box.
- **Sample (6.2).** Checked item by item against the PM text: polygon, 25 % / 25 %, street edge 0, 7 + 7 rooms with the right sizes (110 m2 each level), master on `r8`, pairs `r3+r4` and `r8+r13` in numeric order, 2 covered cars, pool S, wall, gate centre, seating, modern / full. `PC.C` matches 4.2 (30 values) and 4.3.
- **Messages (R3, G5).** Dialog is in-page, queued, Esc/backdrop/Cancel give `false`, focus is trapped and returned, `inert` + `aria-hidden` on the app. No native dialog anywhere; lint covers bare and `window.`-qualified calls and has a positive and a negative case per rule.
- **Hard constraints.** One external URL; classic scripts; handlers are attached with `addEventListener` (the banner action uses the `onclick` property, which is not an inline handler and needs no CSP exception).

### My four conditions from the plan review
| Condition | Status |
|---|---|
| 1 "Not built yet" banner for stages without a controller | Met (`shell.render`; probe shows it on stage 2 and not on stage 1) |
| 2 Contract under `tests/contract/`, spec reads it there | Met |
| 3 Lint: `import`/`export` as JS statements only, positive and negative case per rule | Met (`!important` and "important note" are negative cases) |
| 4 `PC.debug` extended, never replaced | Met (`Object.assign(PC.debug || {}, …)`) |

### Rulings on the deviations
1. **Empty controller registered for stage 1** — accepted. Stage 1 really is wired (start panel); F1-T3 replaces the empty object with the plot controller.
2. **`PC.stages` in `core/stages.js`** — accepted (A-15 updated).
3. **"Done" only once visited this session and valid** — accepted. Showing a check mark on a stage the user has never opened (stage 2 is valid by its defaults) would be wrong. A reachable, unvisited step is plain "available". Recorded in A-15; PM to note that F1-S4's three states have this fourth, unmarked one.
4. **`store.replace(state)` without `keepSample`** — accepted; the flag travels in the state itself, which is simpler.
5. **A stored draft with an empty plot is discarded** — accepted; consistent with autosave never writing one.

### Rulings on the flags
- **Banner on stage 2 at 640x360 clips the summary sheet.** No Designer change. Rule (A-15): the banner slot is for shell-level notices only; product messages live in the stage's own message lines, summary and warning lists. The only banner that can appear on stage 2 is the static-preview notice, which disappears when F2-T2 registers its controller.
- **Lint matches inside comments** — accepted as documented in the file header.
- **PM 4.1 "needs 58 m2" vs 60** — PM text error, already noted by the CTO in step 1 round 2; `PC.C` is right. PM to correct at the next edit.
- **`PC.plans.sync(s)` as an in-place mutator inside a `nav` commit** — adopted as the contract (A-7 updated); F3-T1 must implement it that way.
- **"Plot too small" reason shows m2 in both units until `PC.units.fmtArea` exists** — accepted; the code already switches when `PC.units` appears. F1-T3 must add the test.
- **`run-all` does not yet run `tests/qa/run-*.mjs`** — confirmed missing. My instruction arrived after the plan was approved, so I am not holding this task for it: it is the first item of F1-T3 (a final `--qa` step, also run by default).

### Carried to F1-T3 (I will check them in that plan review)
1. `tests/run-all.mjs` runs `tests/qa/run-*.mjs` as a final step.
2. `PC.ui.start.guard()` is awaited before the first plot point; closing the shape stores `ans.streetEdge`; `validState` gains the self-intersection check.
3. `PC.units.fmtArea` makes the stage 1 reason unit-aware, with a test.

### Non-blocking notes
- Two quick taps on "Load sample project" over an existing project queue two confirmations (the need to ask is evaluated at tap time). Harmless; ignore the second request while a dialog is open if you touch that code again.
- `start.js` has "Start new" only in the resume box, so a project in progress is restarted through Clear or after a reload. That satisfies F1-S5 as written.

### Required changes
None.

VERDICT: APPROVED
