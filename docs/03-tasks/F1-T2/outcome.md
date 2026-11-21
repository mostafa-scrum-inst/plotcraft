# F1-T2 — App core: store, stage gating, draft autosave, dialogs, sample loader, test runner: outcome

Owner: FS. Step 3f. Plan: `plan.md` (approved round 1). Reviews: `plan-review.md`, `impl-review.md` (approved round 1, no required changes), `qa-report.md` (passed round 1). No code was changed in this step.

## 1. What was built

- **State store** with the A-4 schema (v 1), the 4.1 defaults, clone-on-commit with a frozen state, navigation commits, and the `propose` entry point of the R5 gate (pass-through until F2-T1).
- **Stage gating** as one pure function (R1): reachable / valid / reason per stage; all stage wording in one table.
- **Shell behaviour** on the Designer's static markup: stepper states and taps (locked steps stay tappable and explain themselves in a toast), Back/Next with a label per stage, stage switching, header unit toggle, sample strip on stages 1, 3 and 4, a registry for stage controllers, and the "not built yet: static preview" banner on a stage without a controller.
- **Draft**: strict validation, debounced autosave (400 ms, flushed when the page is hidden), Resume draft / Start new on reload, silent discard of corrupted or old drafts, full operation without `localStorage`.
- **In-page messages** (R3): confirm dialog (promise, focus trap, Esc/backdrop cancel, `inert` background), toasts, banners. No native dialog anywhere.
- **Sample project** exactly as PM 6.2, and "Skip to 3D" for the unmodified sample.
- **Test infrastructure**: `node tests/run-all.mjs` (build, lint, unit, three, e2e), a bare-`vm` loader for core code, a playwright helper, the constraint lint (28 rules) and the machine-readable UI contract under `tests/contract/`.

## 2. Files

| File | Content |
|---|---|
| `src/js/core/const.js` | `PC.C`: every number of PM section 4, in metres |
| `src/js/core/geom.js` | `PC.geom.area` only (F1-T3 extends it) |
| `src/js/core/store.js` | `PC.store` |
| `src/js/core/stages.js` | `PC.stages` |
| `src/js/core/draft.js` | `PC.draft` |
| `src/js/core/sample.js` | `PC.sample` |
| `src/js/ui/dom.js` | `PC.ui.$`, `$$`, `on`, `tpl`, `show` |
| `src/js/ui/storage.js` | `PC.ui.storage` (the only file naming `localStorage`), `PC.ui.autosave` |
| `src/js/ui/dialog.js` | `PC.ui.dialog`, `PC.ui.toast`, `PC.ui.banner` |
| `src/js/ui/shell.js` | `PC.ui.shell` |
| `src/js/ui/start.js` | `PC.ui.start` |
| `src/js/main.js` | boot, `PC.debug` |
| `src/manifest.json` | 14 scripts in load order |
| `tests/run-all.mjs`, `tests/lint-constraints.mjs` | runner, lint |
| `tests/helpers/load.mjs`, `browser.mjs`, `assertions.mjs` | vm loader; playwright launcher and check collector; F1-T1 layout assertions (lifted unchanged) |
| `tests/unit/{const,store,stages,draft,sample,storage,lint}.test.mjs` | 166 tests |
| `tests/e2e/shell.spec.mjs`, `contract.spec.mjs` | 509 + 4 checks |
| `tests/contract/hooks.json`, `values.json` | canonical UI contract (moved from the F1-T1 verify folder) |
| `docs/03-tasks/F1-T2/shots/` | three phone screenshots (resume offer + toast, dialog, stage 2 banner) |

No markup or CSS was changed. Every JS file is under 300 lines (largest: `draft.js`, 127).

## 3. Public APIs later tasks depend on

**`PC.store`**
| Member | Contract |
|---|---|
| `get()` | Current state, deep-frozen. Never mutate it; go through `commit`. |
| `commit(mutator, { nav })` | Clone, mutate, replace, notify. A commit that changes nothing is ignored. Clears `sampleClean` unless `nav: true`. A throwing mutator leaves the state untouched. |
| `propose(mutator)` | `Promise<boolean>`. Every layout-class input must use it (A-7). Pass-through today; F2-T1 puts the R5 gate inside without changing callers. |
| `setConfirmHandler(fn)` / `confirmHandler()` | Set at boot to `PC.ui.dialog.confirm`; for the gate. |
| `replace(state)` | Whole-state swap (resume, start new, sample); `meta.replace = true`; keeps the given `sampleClean`. |
| `go(n)` | Navigation only; `false` when the stage is not reachable. |
| `subscribe(fn)` | `fn(state, prev, meta)`, `meta = { nav, replace }`; returns the unsubscribe function. |
| `defaults()`, `room(id, type, level, size, master)` | Fresh 4.1 state; room literal. |
| `cmpId(a, b)` | Numeric id order (`r8` before `r13`); the only id comparator. |
| `session` | Unsaved flags: `r5Confirmed`, `draftPending`, `invalidFields`. |

**`PC.stages`**: `status(state)` -> `{ 1..5: { reachable, valid, reason } }`; `clamp(state)`; `skipTarget(state)`; `levelIds(state)` (F2-T1: `PC.levels` becomes the single implementation and this delegates); `MAX_BUILT` (2 now; a feature raises it when its stage is built; F4-T1 sets 5); `TEXT` (Next labels and reasons). It picks up later modules by name when they exist: `PC.validate.blocking(state)` for stage 2, `PC.sig.level(state, id)` for stage 3, `PC.units.fmtArea(m2, unit)` for the small-plot reason.

**`PC.draft`**: `KEY` (`'plotcraft.draft.v' + PC.DRAFT_V`), `serialize(state, savedAt)`, `parse(text)` -> `{ savedAt, state } | null`, `validState(state)`, `isEmpty(state)`. Validation is strict: exact key sets, enums and ranges from `PC.C`. Any schema addition must bump `PC.DRAFT_V` and extend `validState` in the same change. The state may only ever hold valid, in-range values (A-4).

**`PC.ui.dialog.confirm({ title, text, ok, cancel, extra })`** -> `Promise<boolean>`; calls made while a dialog shows are queued; `extra` is a node placed in `dialog-extra` (level-removal choices in F2-T3). **`PC.ui.toast(text, { kind, ms })`**: at most two, same text does not stack. **`PC.ui.banner.show({ id, kind, text, action })` / `hide(id)`**: shell-level notices only (A-15); product messages belong in the stage's own message lines.

**`PC.ui.shell.register(n, { enter, leave, render })`**: stage controllers; all three optional. Registering removes the static-preview banner for that stage. `PC.ui.shell.render()` re-renders the shell.

**`PC.ui.start.guard()`** -> `Promise<boolean>`: `true` at once when no saved draft is waiting for an answer; otherwise asks the Start-new question. F1-T3 must await it before the first plot point and must not place the tap that triggered it.

**`PC.ui.storage`**: `available`, `probe()`, `get`, `set`, `remove`; never throws. **`PC.ui.autosave`**: `start()`, `flush()`.

**`PC.plans.sync(draft)` contract (A-7), fixed by this task's callers:** it mutates the object it is given and never commits; `ui/start.js` calls it inside `PC.store.commit(s => PC.plans.sync(s), { nav: true })` after Resume and after Load sample. F3-T1 implements it in that shape.

**`PC.debug`**: `state()` today. Later tasks add helpers with `Object.assign(PC.debug, …)` and never replace the object.

**`PC.sample.state()`**: fresh 6.2 state with `sampleClean: true`, `streetEdge: 0`, `plans: {}`.

## 4. How to verify

1. `node tests/run-all.mjs` -> exit 0. Expected at hand-over: lint 0 violations; unit 166 passed; e2e contract 4 / 0; e2e shell 509 / 0 (360x640 touch, 768x1024 touch, 1280x800 mouse, layout at 640x360).
2. `node tests/qa/run-f1-t2.mjs --no-shots` and `node tests/qa/run-f1-t1.mjs --no-shots` -> exit 0.
3. By hand, `dist/index.html` in a browser: Load sample project -> strip with Skip to 3D, Next enabled -> Next -> stage 2 with the static-preview banner -> tap step 4 -> toast -> reload -> Resume draft / Start new.
4. Lint proof: add a forbidden call to any file under `src/`, run `node tests/run-all.mjs` -> fails at the lint step.

## 5. QA sign-off

`qa-report.md` round 1, 2026-11-20: **PASSED.** QA's own suite `tests/qa/f1-t2-flows.mjs`: 759 checks passed, 0 failed, stable over three runs, at 360x640 touch, 768x1024 touch and 1280x800 mouse (layout also at 640x360); 11 hits on the two minor bugs below, recorded as known. It includes 40 corrupted, old-format and empty drafts and 7 `localStorage` failure modes. All claimed F1-S4 and F1-S5 criteria, R1, R3 and G5 pass. In the same session: `run-all` exit 0 (166 / 0, 4 / 0, 509 / 0) and the F1-T1 suite 137 / 0 and 1929 / 0.

## 6. Accepted deviations (Tech Lead, `impl-review.md`)

1. An empty controller is registered for stage 1 so the static-preview banner does not show there; F1-T3 replaces it with the plot controller.
2. `PC.stages` lives in its own `core/stages.js`.
3. A step is "done" only once visited in this session and valid; a reachable, unvisited step is plain (a fourth, unmarked state).
4. `store.replace(state)` has no `keepSample` option; the flag travels in the state.
5. A stored draft with an empty plot is discarded, never offered.

## 7. Known limits and tech debt

**Interim limits (by plan)**
| Limit | Ends with |
|---|---|
| Plot canvas and stage 1 readouts are blank, also after loading the sample | F1-T3 |
| "Plot too small" reason shows m² in both units | F1-T3 (`PC.units.fmtArea`, with a test) |
| `ans.streetEdge` is not written on closing a shape; `validState` has no self-intersection check | F1-T3 |
| `MAX_BUILT = 2`: Skip to 3D stops at stage 2; step 3 says "Not available in this build yet" while steps 4 and 5 say "Approve all floors first"; Next on stage 2 is disabled with only the banner as a hint | raised per feature; gone with F3 / F4-T1 |
| Stage 2 controls are static; its Q1 radio does not follow the header unit toggle | F2-T2 |
| `propose` asks nothing | F2-T1 (gate), F3-T2 (end-to-end R5 test) |
| `PC.stages.levelIds` duplicates what `PC.levels` will own | F2-T1 (single implementation) |
| "All levels generated" for the sample | F3-T1 (`PC.plans.sync`) |

**Open minor bugs (QA), both fixed inside F1-T3 by Tech Lead ruling (`F1-T3/plan-review.md`)**
1. Keyboard focus falls to `<body>` after four actions (Load sample by keyboard; Next when it becomes disabled; Skip to 3D; Start new confirmed). Fix: after a render, when the focused element is `<body>`, disabled or hidden, focus the current step button; the dialog does the same when its opener is gone.
2. A double tap on a button that opens a dialog cancels it at once (second tap hits the backdrop). Fix: ignore backdrop taps for about 300 ms after opening; also ignore a second "Load sample" request while a dialog is open (TL note).

**Gaps QA found in my tests, and when each is closed**
| Gap | When |
|---|---|
| Page-hide flush (change, then reload inside the debounce) not covered by `shell.spec.mjs` | F1-T3: case added to `shell.spec.mjs` (in that plan) |
| Focus after an action; tap behind an open dialog; real double taps | F1-T3: regression checks added with the two fixes |
| Space on a locked step; toast auto-dismiss position relative to Back/Next | F1-T3: added to `shell.spec.mjs` while it is open |
| Storage modes beyond "getter throws" and "quota" (`undefined`, `null`, every method throwing, reads throwing, failure mid-session) | Covered by QA's suite, which `run-all` runs as its final step from F1-T3; the unit file gets the `undefined` / `null` getter cases then |
| Corrupted drafts through the real boot path beyond a few shapes | Same: QA's 40 cases run in `run-all` from F1-T3; not duplicated in `tests/e2e` |
| My e2e inputs use playwright locators (which refuse `aria-disabled` elements unless forced) | F1-T3: new specs tap coordinates through `PC.debug.toScreen`; `shell.spec.mjs` already taps locked steps by coordinates |
| `run-all` does not run `tests/qa/run-*.mjs` | F1-T3, first item |

**Other debt and observations**
- The lint also matches inside comments; source comments must not spell forbidden calls (documented in the lint header).
- When storage is full at start the adapter switches off entirely, so an existing draft is not offered (it stays stored). When saving fails mid-session the no-save note is in the start panel, which is hidden once a plot exists. Both pass F1-S5; revisit in F5-T3 if the hosted check shows a full quota is realistic.
- The state is deep-frozen on every commit; if plan-editor drags in F3-T2 prove slow, freeze only in debug.
- `inert` needs Chrome 102 / Safari 15.5; older browsers get the focus loop and `aria-hidden`. On the F1 publishing checklist, with `localStorage` behaviour inside the sandboxed iframe.
- PM 4.1 says the default ground floor "needs 58 m2"; by the 4.2 table it is 50 m2 of rooms, 60 with the stair. The code follows the table; the PM text is to be corrected.

## 8. Addendum — 2026-11-20: the two open minors are closed

Both minor bugs of section 7 were fixed inside F1-T3 (Tech Lead ruling in `F1-T3/plan-review.md`) and confirmed by QA in `F1-T3/qa-report.md`.

| Bug | Fix | Evidence |
|---|---|---|
| 1 Keyboard focus falls to `<body>` | `shell.js`: after a render and after a dialog closes, when the last input was the keyboard and the focused element is `<body>`, hidden or disabled, focus moves to the current step button. Pointer and touch users are not affected (accepted by the Tech Lead). | cases in `tests/e2e/shell.spec.mjs` (Load sample, Next, Skip to 3D, Start new by keyboard); QA re-test passed |
| 2 Double tap on a dialog opener cancels the dialog | `dialog.js`: backdrop taps are ignored for 300 ms after opening; `start.js`: a second request while a dialog is open is ignored, so no second question is queued. | case in `shell.spec.mjs`; QA re-test passed |

The test gaps listed in section 7 were closed in F1-T3 as scheduled (page-hide flush, focus, double tap, Space on a locked step, toast above the action bar, two more storage modes; QA's suites run as the last step of `run-all`). One remains: toast auto-dismiss after a keyboard activation has no check in `shell.spec.mjs`. QA's F1-T2 suite stands at 765 checks passed, 0 failed.
