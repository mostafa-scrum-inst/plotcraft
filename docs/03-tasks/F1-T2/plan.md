# F1-T2 implementation plan — app core (FS)

Scope per `F1-plan.md` F1-T2: `PC.C`, store, stage gating, draft autosave, dialog/toast/banner, start panel, sample loader, test runner and constraint lint. Stories F1-S4, F1-S5; rules R1, R3, G5. Binding: A-2, A-3, A-4, A-15, A-16, F1-T1 hook contract (`verify/hooks.json`, `values.json`) and the TL rulings in F1-T1 `plan-review.md` / `impl-review.md`.
No CSS and no markup changes are planned; elements are looked up by `data-pc` only.

## 1. Files

| File | Layer | Responsibility |
|---|---|---|
| `src/js/core/const.js` (new) | core | `PC.C`: every number of PM section 4 in metres (4.2 room-size table, 4.3 allowances/limits/snaps, 4.1 ranges and enum lists). Only place they live. |
| `src/js/core/store.js` (new) | core | `PC.store` (state holder, `defaults`, `commit`, `propose`, `replace`, `go`, `subscribe`) and `PC.stages` (`status`, `clamp`, `levelIds`, `MAX_BUILT`, `NEXT_LABEL`). No timers. |
| `src/js/core/geom.js` (new, minimal: see Q4) | core | `PC.geom.area(pts)` (signed shoelace) only; F1-T3 extends this file. |
| `src/js/core/draft.js` (new) | core | `PC.draft`: `KEY`, `serialize(state, savedAt)`, `parse(text)` -> `{ savedAt, state }` or `null`, `validState(state)`, `isEmpty(state)`. |
| `src/js/core/sample.js` (new) | core | `PC.sample.state()`: fresh copy of the 6.2 project (section 6 below). |
| `src/js/ui/dom.js` (new) | ui | `PC.ui.$` (throws on a missing hook), `$$`, `part(el, hook)`, `on`, `tpl(name)` (clone of a `<template>`), `show(el, bool)` (`hidden`). |
| `src/js/ui/storage.js` (new) | ui | `PC.ui.storage`: the only file that names `localStorage`; try/catch adapter with `available`. Also `PC.ui.autosave` (debounced subscriber, section 5). |
| `src/js/ui/dialog.js` (new) | ui | `PC.ui.dialog.confirm`, `PC.ui.toast`, `PC.ui.banner` (section 4). |
| `src/js/ui/shell.js` (new) | ui | `PC.ui.shell`: stepper render + taps, Back/Next, stage switching, header unit toggle, sample strip, stage-controller registry (`register(n, { enter, leave, render })`, A-15). |
| `src/js/ui/start.js` (new, not in the F1 plan list: see Q1) | ui | `PC.ui.start`: start panel (Resume / Start new / Load sample / no-save note), pending-draft guard, Skip to 3D. |
| `src/js/main.js` (replace) | ui | Boot order: storage probe -> `store.init` -> `shell.init` -> `start.init` -> `autosave.start` -> `PC.debug = { state() }` (later tasks add the other helpers). |
| `src/manifest.json` (edit) | | Order: `core/ns, const, geom, store, draft, sample`, `data/palette2d`, `ui/dom, storage, dialog, shell, start`, `main`. |
| `tests/run-all.mjs` | | Runner (section 7). |
| `tests/helpers/load.mjs`, `browser.mjs`, `assertions.mjs` | | vm loader; playwright launcher; F1-T1 layout assertions lifted unchanged (TL note). |
| `tests/lint-constraints.mjs` | | A-3 / A-2 lint over `src/` and `dist/index.html`; exports `scan()` for its own test. |
| `tests/unit/const.test.mjs`, `store.test.mjs`, `stages.test.mjs`, `draft.test.mjs`, `sample.test.mjs`, `storage.test.mjs`, `lint.test.mjs` | | Section 7. |
| `tests/e2e/shell.spec.mjs`, `contract.spec.mjs` | | Section 7. |

All JS files stay under 300 lines; `PC.stages` moves to its own `core/stages.js` if `store.js` passes that.

## 2. Store (`PC.store`) and state

State shape is exactly A-4 (v 1). `PC.store.defaults()` returns the 4.1 defaults: `stage 1`, `sampleClean false`, empty open plot, `ans` as in the A-4 listing with `footprintPct 30`, `vegPct 20`, rooms `r1 living G M`, `r2 kitchen G M`, `r3 bathroom G M`, `r4 bedroom 1 M`, `r5 bedroom 1 M`, `r6 bathroom 1 M` (`master false`, `area null`), `nextRoomId 7`, `pairs []`, `plans {}`.

| API | Behaviour |
|---|---|
| `init(state?)` | Sets the state (defaults when omitted). No notification. |
| `get()` | Current state, deep-frozen (a stray mutation throws in strict mode instead of corrupting silently). |
| `commit(mutator, { nav = false } = {})` | JSON-clone -> `mutator(draft)` -> if the result is JSON-equal to the old state: nothing happens (no notify, `sampleClean` kept). Otherwise: `sampleClean = false` unless `nav`, freeze, replace, notify. A throwing mutator leaves the state untouched and rethrows. Returns the new state. |
| `propose(mutator)` | F1-T2: pass-through, `Promise.resolve(true)` after `commit`. `setConfirmHandler(fn)` is stored now and used by the real R5 gate in F2-T1. |
| `replace(state, { keepSample = false })` | Whole-state swap for Resume, Start new and Load sample; notifies with `meta.replace = true`. |
| `go(n)` | If `PC.stages.status(state)[n].reachable`: `commit(s => { s.stage = n }, { nav: true })`, returns `true`; else `false`. |
| `subscribe(fn)` | `fn(state, prev, meta)`; returns an unsubscribe function. Subscriber errors are isolated (one failing listener does not stop the others; error rethrown after the loop). |
| `session` | Plain object for unsaved flags (A-4): `r5Confirmed` (F2-T1), `draftPending` (section 5). |

Autosave is **not** scheduled inside `commit`: core may not use timers (A-2). `PC.ui.autosave` subscribes and debounces 400 ms. Same observable behaviour as A-4 (Q2).

## 3. Stage gating (`PC.stages`) and the stepper

`PC.stages.status(state)` -> `{ 1..5: { reachable, valid, reason } }`, pure:

| Stage | valid | `reason` when not valid (also the text shown on locked later steps) |
|---|---|---|
| 1 Plot | `plot.closed` and area >= `PC.C.PLOT_MIN_AREA` (50) | open/empty: "Draw and close the plot first"; small: "The plot is too small (minimum 50 m2)" (area limit formatted through `PC.units` once F1-T3 exists) |
| 2 Questions | `PC.validate.blocking(state)` is empty; **treated as valid while `PC.validate` does not exist** (F2-T1) | "Fix the highlighted answers first" |
| 3 Floor plans | every id of `levelIds(state)` has a plan with `approved`, no `error`, and (once `PC.sig` exists) a matching signature | "Approve all floors first" |
| 4 Interior | always | |
| 5 3D view | no Next | |

- `reachable(n)` = every stage before `n` is valid **and** `n <= PC.stages.MAX_BUILT`. A locked step's reason is the reason of the first invalid earlier stage, or "Not available in this build yet" when only `MAX_BUILT` blocks it.
- `MAX_BUILT = 2` in this task (Q3); F4-T1 sets 5. It is a plain property, so e2e sets it to 5 to exercise the full table.
- `levelIds(state)` = `['B']` if basement, then `G`, `1`, `2` up to `floors` (trivial; `PC.levels` takes it over in F2-T1).
- `clamp(state)` -> highest reachable stage not above `state.stage`; applied after Resume and after `plans.sync` so a draft never opens on a stage it may not be in.
- Stage 1 needs a polygon area before `PC.geom` exists: I add `core/geom.js` with `area(pts)` only (signed shoelace); F1-T3 extends that file (Q4).

Stepper rendering (`shell.render`), per step button `step-n`:
- current: `is-current`, `aria-current="step"`; done (valid, reachable, not current): `is-done`; locked (not reachable): `is-locked`, `aria-disabled="true"`; otherwise no state class. Never `disabled`, never `pointer-events: none`.
- Tap/Enter on a reachable step -> `store.go(n)`. On a locked step -> nothing navigates; `PC.ui.toast(reason)` (toast region is `role="status"`, so it is announced) and the reason is also kept in the button's `title`. Repeated taps restart the same toast rather than stacking.
- Back: `disabled` on stage 1, else `go(stage - 1)`. Next: `disabled` unless the current stage is valid and the next is reachable; label from one table `NEXT_LABEL = { 1: 'Next: Questions', 2: 'Next: Floor plans', 3: 'Next: Interior', 4: 'Build 3D model' }`; `hidden` on stage 5.
- Stage switch: exactly one `[data-stage]` without `hidden`; previous controller `leave()`, new `enter()`, then `render(state)`; scroll of the stage container reset; focus moves to the stage section (`tabindex="-1"`) only when the change came from the keyboard.
- Sample strip: visible iff `sampleClean` and stage is 1, 3 or 4 (TL ruling). Header unit toggle: radios reflect `ans.unit`; change -> `commit` (a real change, so it ends `sampleClean`, per A-4).
- Back/forward loses nothing because navigation only changes `stage` (`nav: true`); a unit test proves the rest of the state is identical.

## 4. Dialog, toast, banner (R3; no native dialogs anywhere)

- `PC.ui.dialog.confirm({ title, text, ok = 'Continue', cancel = 'Cancel', extra = null })` -> `Promise<boolean>` (A-15). Fills `dialog-title/text/ok/cancel`, puts `extra` (a node) in `dialog-extra`, un-hides `dialog-layer`, sets `inert` + `aria-hidden` on `app`, focuses Cancel. OK -> `true`; Cancel, Esc, tap on the backdrop -> `false`. Tab cycles inside the dialog. On close: layer hidden, `extra` emptied, `inert` removed, focus back to the opener. A second call while open is queued. This function is the handler passed to `store.setConfirmHandler`.
- `PC.ui.toast(text, { kind = 'info', ms = 3500 })`: clone `tpl-toast` into `toast-region`, set `toast-text` and `data-kind`; at most 2 on screen; same text while visible restarts its timer.
- `PC.ui.banner.show({ id, kind, text, action: { label, fn } | null })` / `hide(id)`: `tpl-banner` into `banner-slot`, one banner per id. Not used by F1-T2 screens; delivered because A-2 puts it here and F2/F3 need it.

## 5. Draft: schema, validation, autosave, start panel

- Key `plotcraft.draft.v1`; value `JSON.stringify({ v: 1, savedAt: <ms since epoch>, state })`. `savedAt` is passed in by the UI (core stays deterministic).
- `PC.draft.parse(text)` returns `null` for: non-string, JSON error, wrapper `v !== 1`, `state.v !== 1`, or any failed check below. Strict: unknown keys at any level are rejected (a schema change means a new `DRAFT_V`).
  - `stage` integer 1–5; `sampleClean` boolean.
  - `plot`: 0–12 points, each two finite numbers; bounding box within 100 x 100 m; `closed` needs 3+ points.
  - `ans`: every enum against the `values.json` / A-4 lists; ranges from `PC.C` (setbacks 0–20, footprint 10–80, vegetation 0–80, ceiling 2.4–4.5, floors 1–3, cars 0–4); `north` null or a multiple of 15 in 0–345; `streetEdge` null or an index below the point count; rooms: ids `r<n>` unique and below `nextRoomId`, type enum, level among `levelIds`, either `size` S/M/L with `area null` or `size null` with area 4–80, at most 8 per level, `master` only on a bedroom; pairs: two different existing ids on one level, sorted, no duplicates, at most 6 per level.
  - `plans`: keys among `levelIds`; `sig` string; rooms `{ id, x, y, w, h }` finite with `w, h > 0` and id on that level; `unmet` pairs of ids; `edited`, `approved` booleans; `error` null or `'no-layout'`.
  - Not checked here: product conflicts (empty floor, area overflow). Those are legal draft states and belong to `PC.validate`.
- `PC.ui.storage`: `{ available, get(key), set(key, text) -> bool, remove(key) }`. Probe at boot (set + remove a test key) inside try/catch, including the property access itself (`window.localStorage` can throw). Every call is wrapped; any failure, at any time (quota, revoked), sets `available = false` and the adapter becomes a no-op. Nothing is logged with `console.error`.
- `PC.ui.autosave`: store subscriber -> 400 ms debounce -> `storage.set(KEY, serialize(state, Date.now()))`; flushed immediately on `visibilitychange` (hidden) and `pagehide` (phones kill tabs). An empty project (`isEmpty`: no plot points) is not saved: the key is removed instead, so a reload never offers an empty draft. Suspended while `session.draftPending`.
- Boot and start panel (`PC.ui.start`), panel visible on stage 1 while the plot has no points:
  1. `storage.available === false` -> show `note-nosave`; continue normally.
  2. Read the key. Nothing -> clean start. `parse` gives `null` -> remove the key silently, clean start, no message.
  3. Valid draft -> `draftPending = true`, show `resume-box`, `resume-meta` = "Saved <date, time> — stage n". The app starts on fresh defaults underneath.
  - **Resume draft**: `store.replace(draft.state)`, `PC.plans.sync` if it exists, `clamp`, pending cleared.
  - **Start new**: `dialog.confirm` ("Start a new project? The saved draft will be deleted."); OK -> key removed, defaults, pending cleared, `resume-box` hidden; Cancel -> nothing.
  - **Load sample project**: if a draft is pending or the current project is not empty -> `dialog.confirm` first; then `store.replace(PC.sample.state(), { keepSample: true })`, `PC.plans.sync` if it exists, pending cleared; stage stays 1 with the strip visible.
  - `PC.ui.start.guard()` -> `Promise<boolean>`: resolves `true` at once when nothing is pending, otherwise runs the Start-new confirmation. F1-T3 calls it before placing the first point so that drawing can never silently overwrite an unresolved draft (Q5).
- **Skip to 3D** (`btn-skip3d`): approves every plan level that has a plan without error (none exist before F3-T1), then goes to the highest stage that is reachable and `<= MAX_BUILT`, all in one `commit(..., { nav: true })`.

## 6. Sample data (`PC.sample.state()`, PM 6.2, nothing else differs from 4.1)

```js
{ v: 1, stage: 1, sampleClean: true,
  plot: { pts: [[0,0],[20,0],[20,30],[8,30],[0,26]], closed: true },      // already CCW, 584 m2
  ans: { unit: 'm', setbacks: { front: 3, back: 2, side: 2 }, footprintPct: 25, vegPct: 25,
    north: null, streetEdge: 0,                                           // bottom edge (0,0)-(20,0)   (Q6)
    floors: 2, basement: false, usableRoof: false, ceilingH: 3.0, roofType: 'flat', exterior: 'sand',
    rooms: [ // Ground: 42+24+16+14+6+4+4 = 110
      { id: 'r1', type: 'living',   level: 'G', size: 'L' }, { id: 'r2', type: 'majlis',  level: 'G', size: 'M' },
      { id: 'r3', type: 'dining',   level: 'G', size: 'M' }, { id: 'r4', type: 'kitchen', level: 'G', size: 'M' },
      { id: 'r5', type: 'maid',     level: 'G', size: 'S' }, { id: 'r6', type: 'bathroom', level: 'G', size: 'S' },
      { id: 'r7', type: 'laundry',  level: 'G', size: 'S' },
      // First: 24+16+16+30+12+6+6 = 110
      { id: 'r8', type: 'bedroom',  level: '1', size: 'L', master: true }, { id: 'r9', type: 'bedroom', level: '1', size: 'M' },
      { id: 'r10', type: 'bedroom', level: '1', size: 'M' }, { id: 'r11', type: 'living', level: '1', size: 'M' },
      { id: 'r12', type: 'office',  level: '1', size: 'M' }, { id: 'r13', type: 'bathroom', level: '1', size: 'M' },
      { id: 'r14', type: 'bathroom', level: '1', size: 'M' } ],           // every room: area null, master false unless shown
    nextRoomId: 15,
    pairs: [['r3','r4'], ['r8','r13']],                                   // Kitchen+Dining; Master bedroom+Bathroom 1  (Q7)
    stairPos: 'centre', lift: false,
    parking: { cars: 2, covered: true }, pool: { on: true, size: 'S' },
    extras: { wall: true, gate: 'centre', seating: true },
    interior: { style: 'modern', density: 'full' } },
  plans: {} }                                                             // filled by PC.plans.sync from F3-T1
```

`sample.test.mjs` re-derives the 6.2 figures from this object and `PC.C` alone: area 584, edges 20.0 / 30.0 / 12.0 / 8.9 / 26.0, perimeter 96.9, 7 + 7 rooms, 110 m2 of rooms and 120 m2 with the stair on each level, footprint + vegetation = 50 %, parking 25 m2, pool 18 m2, and that it passes `draft.validState`.

## 7. Tests

`node tests/run-all.mjs` (`--unit`, `--three`, `--e2e` subsets): build -> lint -> unit (`node --test tests/unit/`) -> three (skipped with a notice until `tests/three/` exists) -> e2e (each `tests/e2e/*.spec.mjs` as a child process). Non-zero exit on the first failing step; one summary line per step.

- **`helpers/load.mjs`**: evaluates the manifest's `core` + `data` files, in order, in a bare `vm` context (no `window`, `document`, `console`, timers) and returns `PC`. `plain(x)` (JSON round trip) is exported because objects from the vm realm fail `deepStrictEqual` against literals. `loadWith(files, globals)` loads named files with stub globals (used for `ui/storage.js`).
- **Unit (node)**
  - `const`: the 30 values of 4.2 and every 4.3 number.
  - `store`: defaults equal 4.1 item by item; commit clones (old state object unchanged and frozen); no-op commit does not notify or clear `sampleClean`; real commit clears it, `nav` keeps it; throwing mutator leaves state; `propose` resolves `true`; `go` refuses a locked stage; back/forward leaves everything but `stage` identical; unsubscribe works.
  - `stages`: status table (empty plot; open plot; closed 49 m2; closed 50 m2; stage 2 with a stubbed `PC.validate` returning one conflict; plans missing / partly approved / all approved / one with `error`; basement adds `B`), reasons text, `MAX_BUILT` cap, `clamp`.
  - `draft`: round trip of defaults and of the sample (deep-equal); `null` for non-string, truncated JSON, `v: 2`, `v` missing, wrong types, each out-of-range number, bad enum, duplicate room id, pair across levels, plan room id not on the level, 13 points, unknown key; `isEmpty`.
  - `sample`: section 6.
  - `storage`: adapter with a working stub, a stub whose getter throws, one whose `setItem` throws (quota), and no `localStorage` at all -> never throws, `available` false, later calls are no-ops.
  - `lint`: `scan()` flags each forbidden token planted in a string and accepts `PC.ui.dialog.confirm(`.
- **Lint (`tests/lint-constraints.mjs`)**, over every `src/` file and `dist/index.html`:
  - forbidden: bare or `window.`/`self.`/`globalThis.` `alert(` / `confirm(` / `prompt(` (a member call such as `dialog.confirm(` is allowed), `window.open`, `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `serviceWorker`, `import` / `export` statements and `import(`, `type="module"`, `eval(`, `new Function`, `document.write`, `createObjectURL`, `download` attribute/property, `<form`, inline `on*=` attributes, `javascript:`, `@import`, CSS `url(`, `sessionStorage`, `indexedDB`, `document.cookie`, `OrbitControls`, `examples/js`;
  - `localStorage` only in `src/js/ui/storage.js`;
  - exactly one `http(s)://` in `dist/index.html`, equal to the brief's three.js tag, placed before the first inline script;
  - layers: manifest layer matches the directory; core files free of `window`, `document`, `navigator`, `localStorage`, `THREE`, `setTimeout`, `setInterval`, `requestAnimationFrame`; data files free of `function` (beyond the wrapper) and `=>`; ui files free of `THREE`; three-layer check is the load-without-THREE test of F4-T1;
  - a JS/CSS file over 300 lines is a warning, not a failure.
  Tokens are matched in comments too (no comment stripping), so source comments must not spell them.
- **`helpers/browser.mjs`**: launch per A-16; `open({ viewport, touch, three: 'abort' | 'mock', storage: 'normal' | 'throw' | 'quota', init })`; collects `pageerror` and `console.error`, fails on any native `dialog` event, and records every request (only the cdnjs URL may be attempted). See Q8 for the one console message an aborted script produces.
- **E2E `shell.spec.mjs`**, at 360x640 touch, 768x1024 touch, 1280x800 mouse (layout assertions also at 640x360):
  1. Fresh load: stage 1 only, step 1 current, steps 2–5 locked with `aria-disabled`, Back and Next disabled, start panel shown, no resume box, no strip.
  2. Tap locked step 2 -> still stage 1, toast "Draw and close the plot first"; Enter on a focused locked step does the same.
  3. Load sample -> strip + Skip visible, Next enabled with "Next: Questions"; Next -> stage 2, strip hidden; Back -> stage 1, state deep-equal to before.
  4. With `MAX_BUILT = 5` and plans committed from the test: step 4 locked with "Approve all floors first" until every level is approved; labels per stage, "Build 3D model" on 4, Next hidden on 5; strip on stages 1, 3, 4 only.
  5. Autosave + resume: sample, go to stage 2, wait for the key, reload -> resume box; Resume -> stage 2 and state deep-equal.
  6. Start new: Cancel keeps the draft; Esc cancels; OK removes the key and a second reload shows no resume box. Focus returns to the opener.
  7. Sample over a pending draft asks first; Cancel leaves it pending.
  8. Storage throwing (getter) and quota (setItem): no errors, `note-nosave` visible, sample + navigation work, no resume after reload.
  9. Garbage, truncated JSON and a `v: 0` object in the key -> clean start, key removed, no message, no error.
  10. Skip to 3D lands on stage `MAX_BUILT`; with 5 and plans present it approves all and lands on 5. Any edit (unit toggle) removes the strip for good; re-selecting the current unit does not.
  11. Every scenario: zero `pageerror` / `console.error`, no native dialog, no request other than the three.js tag, `noPageScroll`, `barInViewport`, `stepperOneLine`, `tapTargets` (toast and open dialog included).
- **E2E `contract.spec.mjs`**: every hook of `docs/03-tasks/F1-T1/verify/hooks.json` exists exactly once and choice values match `values.json` (so a late F1-T1 markup fix that breaks the contract fails here).

## 8. Acceptance criteria -> where satisfied

| Criterion | Piece | Test |
|---|---|---|
| F1-S4 stepper states current / done / locked | `stages.status`, `shell.render` | stages unit; e2e 1, 4 |
| F1-S4 locked not activatable, says why | step handler + toast, `aria-disabled` | e2e 2, 4 |
| F1-S4 Back/Next always visible; Next disabled until valid | F1-T1 layout + `shell.render` | e2e 1, 3, 11 |
| F1-S4 back and forward loses nothing | `go` = stage-only `nav` commit | store unit; e2e 3 |
| F1-S4 one line at 360 px | F1-T1 (re-asserted) | e2e 11 |
| F1-S5 autosave; Resume / Start new in-page | `autosave`, `start`, `dialog` | e2e 5, 6 |
| F1-S5 works with `localStorage` blocked or throwing | `storage` adapter | storage unit; e2e 8 |
| F1-S5 corrupted / old-format draft discarded silently | `draft.parse` | draft unit; e2e 9 |
| F1-S5 Start new clears after confirmation | `start` + `dialog.confirm` | e2e 6 |
| F1-S5 sample: one tap, confirmation over a draft | `sample`, `start` | sample unit; e2e 3, 7 |
| F1-S5 Skip to 3D only for the unmodified sample | `sampleClean` in `commit`, strip rule | store unit; e2e 10 |
| R1 fixed order, reachable only when earlier stages valid | `stages.status` | stages unit |
| R3 / G5 in-page messages, no native dialogs, no network, zero console errors | `dialog.js`, lint, browser helper | lint; e2e 11 |

Known interim limits (by plan, not defects): the plot canvas stays blank until F1-T3 (the sample is visible through the strip, the stepper and `PC.debug.state()`); "all levels generated" arrives with `PC.plans.sync` in F3-T1; Skip reaches 3D in F4-T1.

## 9. Risks and open questions for the Tech Lead

1. **Extra file `ui/start.js`** (start panel, guard, Skip) beside the four ui files named in A-2 / F1 plan, to keep `shell.js` under 300 lines. OK?
2. **Autosave is a ui subscriber, not scheduled by `commit`**, because core may not use timers (A-2 vs the A-4 wording). Also: is `Promise` acceptable in core (`propose`)? I assume yes (language built-in, no timer).
3. **`MAX_BUILT` value now.** Proposed 2 (stage 2 opens as the Designer's static, unwired screen until F2-T2; e2e raises it to 5). Alternative 1 makes Next unusable for F1-T3's QA. Confirm 2, and whether an info banner "This stage is not wired yet" is wanted on unbuilt-but-reachable stages.
4. **`core/geom.js` created here with `area()` only** (stage 1 validity needs it), extended by F1-T3. Alternative: a private shoelace inside `store.js`, deleted in F1-T3. Same pattern for `levelIds` until `PC.levels` (F2-T1).
5. **Pending draft and drawing.** With a draft found, the user can ignore the resume box and tap the grid. Proposed `PC.ui.start.guard()` (confirmation before the first point, wired in F1-T3). Alternative: silently treat the first point as "Start new". Which?
6. **Sample `streetEdge`: `0` or `null`?** 6.2 names the bottom edge; the default rule gives the same edge. I store `0` (explicit, as 6.2 lists it). Say if `null` is preferred.
7. **Id ordering** ("ids sorted inside a pair", A-4; "sorted by id", A-7): string order puts `r13` before `r8`. I propose numeric order everywhere through one comparator `PC.store.cmpId`, giving `['r8','r13']`. Also: 6.2 says "Living (family)" on the first floor, but A-4 has no name field, so it will read "Living"; I assume that is accepted.
8. **Aborting the cdnjs request makes Chrome log "Failed to load resource" as a console error**, which the A-16 rule "fail on any console.error" would trip in every 2D suite. Proposed: the browser helper ignores console errors whose source URL is exactly the three.js tag, nothing else.
9. **Unit toggle ends `sampleClean`** (A-4: any non-nav commit). A reviewer who switches to ft loses Skip to 3D. Literal reading of F1-S5; flagging in case appearance-only changes should be exempt.
10. **Strict draft validation** (unknown keys rejected) means any later schema addition must bump `PC.DRAFT_V` or users' drafts are dropped silently; acceptable for a prototype, and it keeps `parse` honest. Self-intersection of a saved plot is not checked until `PC.plot` exists (F1-T3 adds one call in `validState`).
11. `inert` on the app while a dialog is open needs Chrome 102 / Safari 15.5; older browsers still get the focus loop and `aria-hidden`. To check at the F1 publishing point, with `localStorage` behaviour inside the sandboxed iframe.
