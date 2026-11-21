# F2-T3 — Rooms, edge-class overrides and narrow-plot footprints: implementation plan

Owner: FS. Step 3a. One plan covers both increments, with one plan review (CTO D4).

**Order of work:**
1. Increment 1 (site) is implemented first.
2. The TL reviews it, with a green focused run of `node tests/run-all.mjs --unit --e2e --only questions,edges,plot,shell`.
3. Only after increment 1 is approved is any increment 2 (rooms) code written. Both increments touch `stage-questions.js`.
4. QA tests the task once, increment 1 list first.

**Inputs:**
- `docs/02-features/F2-plan.md`: the F2-T3 section, Designer pre-step D, and CTO decisions D1–D6;
- `docs/01-product/client-decisions.md`: CD-1 and CD-2;
- PM stories round 4: the table, 3.1, 4.3, R5 "Edge-class overrides", F2-S2, F2-S3, F2-S4, and the F3-S1 criterion;
- `architecture.md`:
  - A-4: `edgeOv`, its invariant, draft v2;
  - A-6: edge classes, step 4b, `clamped` after 4b, `reason`, `toggleEdge`, the memo key;
  - A-7: overrides go through `propose` and are not in the signature;
  - A-15: tap mode;
- `docs/02-features/cto-review.md`: round 4 and its re-review;
- the TL's binding notes in `docs/03-tasks/F2-T2/outcome-review.md`:
  - Fix on a room conflict focuses that level's room list;
  - overridden edges always keep their label.

Hook names come from pre-step D in F2-plan.md:
- `site-tap-mode`, with values `street` and `class`;
- `site-tap-hint`, `site-legend-mark`;
- `q-edges-toggle`, `q-edges`;
- `tpl-edge-row`, with `edge-name`, `edge-class` and `edge-switch`.

The Rooms hooks are already in the markup from F1-T1: `room-add-*`, `room-list`, `tpl-room-group`, `tpl-room-row`, `pair-a` / `pair-b` / `btn-pair-add` / `pair-list` / `tpl-pair-row`, `q-stair-pos`, `q-lift`, `q-stairs-box`, `q-stairs-none`, `room-msg`, `pair-msg`, and `tpl-level-remove` in `dialog-extra`.

---

## Increment 1 — site (CD-1 narrow-plot footprints, CD-2 edge-class overrides)

### 1.1 Files

| File | Change |
|---|---|
| `src/js/core/const.js` | new `FOOTPRINT_STRETCH_RATIO: 3` (the 3:1 limit; PM 4.3 already states it) |
| `src/js/core/site-footprint.js` | step 4b: the stretch, the pruned 3:1 / 1:3 searches, `clamped` after 4b, `reason` |
| `src/js/core/site.js` | `edgeAuto` beside `edgeClass` (in effect); memo key gains `edgeOv`; `PC.site.toggleEdge(draft, i)`; `PC.site.clearOvIfOutlineChanged(prev, next)` (pure, see 1.3) |
| `src/js/core/validate.js` | `fp-clamped` picks its text from `footprint.reason`; new text key for the proportion wording |
| `src/js/core/store.js` | `defaults()` gains `ans.edgeOv = {}` and `v: 2`; `commit` and the gate's candidate run the override normaliser (1.3, question Q1) |
| `src/js/core/ns.js` | `PC.DRAFT_V = 2` |
| `src/js/core/draft.js` | v2 schema (`edgeOv` checks), v1 migration, `KEY` (v2) and `KEYS` (v2, then v1) |
| `src/js/core/sample.js` | nothing: it is built from `defaults()`, so it gets `edgeOv: {}` and `v: 2` |
| `src/js/ui/storage.js` | `flush`: an emptied state removes **both** keys; the first v2 save removes the v1 key |
| `src/js/ui/start.js` | read v2, else v1; Start new, Load sample over a draft, and discarding a bad draft remove both keys |
| `src/js/ui/stage-plot.js` | no logic change if Q1 is accepted (the store clears overrides); otherwise explicit clearing in `closeShape`, `undo` (reopen), `clearAll` and `dragEnd` |
| `src/js/ui/q-preview.js` | tap mode, toggle by tap, street-edge toast, labels with `*`, forced labels for the street edge and overridden edges, focus highlight, keeping the drawing clear of the mode control |
| `src/js/ui/q-edges.js` (new, ui layer, manifest after `q-preview.js`) | the Q6 edge list: rows, switch buttons, accessible names, focus → preview highlight |
| `src/js/ui/stage-questions.js` | wires `q-edges`, the tap mode, `toggleEdge` through `propose`, and the "choices were reset" notice subscriber; tap mode reset on `replace` |
| `src/manifest.json` | + `js/ui/q-edges.js` |

Tests: `tests/unit/footprint.test.mjs`, `site.test.mjs`, `validate.test.mjs`, `draft.test.mjs`, `storage.test.mjs`, `store.test.mjs` (extend); `tests/e2e/edges.spec.mjs` (new). Files that hard-code v1 are updated in the same change; section 1.6 lists them.

### 1.2 Footprint step 4b (A-6; CTO round 4 and re-review)

This runs only when the step-4 result is clamped, so the 6.2 sample never reaches it and every unclamped result stays byte-identical.

- **Inputs:** the step-4 result `R4` (centre `c`, sizes `w`, `d`, area), the target area `A`, and `site`. "Long" and "short" refer to `R4`'s own sides, along u or v.
- **(a) Stretch.** This applies only if `R4` is at its proportion limit, i.e. `long >= 2 * short - 0.5`. Keep `c` and the short side, and lengthen the long side in 0.5 m steps, symmetric about `c` (0.25 m each end), while `rectFits` holds, up to `cap = floor05(min(3 * short, A / short))`.
  - Nested rectangles make the test monotonic, so the first failure ends the loop. That is at most `(cap - long) / 0.5` tests, for example 12 on the 10 x 50 m plot.
- **(b) 3:1 and 1:3.** Run `place(r, search = true)` for `r = 3` and `r = 1/3`; it is the existing step 3–4 function with the centred try first, then the lattice fallback.
  - **Pruning:** `place` gets a new argument `beat` = the current winner's area.
  - If `w0 * d0 <= beat + eps`, it returns "no improvement" at once.
  - Otherwise the running best starts at `t0 = sqrt(beat / (w0 * d0))`, not at 0. The centred try and each candidate are tested at `t0 + T.fit`, with the existing cheap mask pre-test first.
  - Strict improvement only, so results are identical to the unpruned search: ties keep the earlier result.
- **Winner:** the largest final area among `R4`, (a), 3:1 and 1:3. Ties go to `R4`, then (a), then 3:1, then 1:3. Never above `A`: every candidate is capped at `A` before rounding.
- **`clamped`** (PM sentence governs): once 4b has run, `clamped = (long !== floor05(A / short))` for the final rectangle, whichever candidate won.
- **`reason`** (set only when clamped):
  - `'proportion'` when `long >= 3 * short - 0.5` **and** the same rectangle 0.5 m longer (0.25 m each end, same centre) still `rectFits`;
  - otherwise `'setbacks'`.
- **`moved`** stays true when the winning centre is not the bounding-box centre.
- **Result shape:** `footprint` gains `reason`. Everything else is unchanged.
- **`validate.js`:** `fp-clamped` keeps its code and question (3).
  - With reason `'proportion'` the text is "The building is limited to {dims} ({a}, {p} % of the plot): on this narrow plot it may be at most 3 times as long as it is wide. Smaller setbacks along its long sides would allow a larger building."
  - `{dims}` is `PC.units.fmtDims(w, d, unit)`; see question Q4 on "x" versus "×".
  - With reason `'setbacks'` the text stays as it is today.

### 1.3 Edge-class overrides: core (A-4, A-6, A-7)

- **State.** `ans.edgeOv` is an object mapping an edge index (string key) to `'back'` or `'side'`.
- **Invariant:**
  1. it is empty unless the plot is closed;
  2. it never names the resolved street edge;
  3. no entry equals that edge's automatic class.
- **`site.js`.**
  - `edgeAuto[i]` is today's 40-degree rule.
  - `edgeClass[i] = edgeOv[i] || edgeAuto[i]`. The street edge is always `'front'`.
  - `setbackOf`, the mask, the footprint, parking and the pool use `edgeClass`, as today.
  - The memo key gains `JSON.stringify(edgeOv)`.
- **`PC.site.toggleEdge(draft, i)`.** This is a pure mutator helper, used inside `propose`.
  - It returns `false` and does nothing for the resolved street edge, an index out of range, or an open plot.
  - Otherwise it sets the class in effect to the other of back / side and deletes the entry when it equals `edgeAuto[i]`.
  - The automatic class comes from `PC.site.analyse(draft)`. The draft is a plain object, and the memo key covers it.
- **Clearing** (3.1: a vertex moves, the count changes, reopen, Q6 change). I propose a single pure normaliser in place of edits to six mutators (question Q1):
  - `PC.site.clearOvIfOutlineChanged(prev, next)` empties `next.ans.edgeOv` when `next.plot.pts` differs from `prev.plot.pts` (any change of a point or the count), `plot.closed` differs, or the resolved street edge differs.
  - `PC.store.commit` and the gate call it on the candidate right after the mutator, before the no-op test and before `affected`. Clearing is therefore part of the causing change, and the gate judges the combined result: one dialog at most, as A-7 requires.
  - `replace` does not run it. Load sample, Start new and Resume swap in states that `parse` / `defaults` have already made valid.
  - With the normaliser, no future mutator can break the invariant by forgetting it.
  - A-4's wording ("empties it in the same mutator") is met in effect: same commit, same candidate. If the TL prefers it literally, the fallback is explicit `d.ans.edgeOv = {}` lines in `closeShape`, `undo` (reopen), `clearAll`, `dragEnd`, `street(dir)` and `setStreet`, with the same tests.
- **Signature.** Unchanged: overrides act only through the setbacks, which the size-only signature already covers (A-7).
- **Sample.** No overrides. Making one is a real `propose` commit, so `sampleClean` ends and Skip to 3D goes (F1-S5).

### 1.4 Draft v2 (A-4; CTO round 4, item 3)

- `PC.DRAFT_V = 2`.
- `PC.draft.KEY = 'plotcraft.draft.v2'`, and new `PC.draft.KEYS = ['plotcraft.draft.v2', 'plotcraft.draft.v1']`.
- **`parse`:**
  1. A wrapper with `v === 1` and a state with `v === 1` is migrated: add `ans.edgeOv = {}` and set both versions to 2.
  2. Then the state is validated strictly as v2. Any other `v` is discarded.
  3. v2 checks on `edgeOv`: it is a plain object; its keys are integer strings in `[0, n - 1]`; its values are `'back'` or `'side'`; it is empty on an open plot; it never names the resolved street edge. Any violation rejects the draft.
  4. After validation, entries equal to the automatic class are **dropped**, not rejected (CTO note).
- **`start.js`:**
  - On load, read `KEYS[0]`, else `KEYS[1]`. When both exist, v2 wins.
  - Discarding a bad draft, Start new, and Load sample over a draft remove **every** key in `KEYS`.
- **`storage.js` `flush`:**
  - An empty state removes every key in `KEYS`.
  - The first successful v2 write removes the v1 key; a session flag keeps this to one call.
  - Everything stays inside the try/catch adapter.

### 1.5 UI (A-15, F2-S4, pre-step D)

- **Tap mode** (`site-tap-mode` radios, session state in `stage-questions.js`).
  - The mode starts at `street`, and a `replace` resets it to `street`.
  - In `street` the preview tap behaves exactly as today (Q6).
  - In `class`, a tap on a non-street edge (same `edgeAt` hit rules: 22 px touch / pen, 10 px mouse) calls `propose(d => PC.site.toggleEdge(d, i))`.
  - A tap on the street edge shows the toast "The street edge is always front (change it with Q6)" (D5) and changes nothing. A tap far from every edge does nothing.
  - `site-tap-hint` is visible only in `class` mode.
- **Labels.** The class in effect is shown, with `*` on overridden edges ("side*"). `site-legend-mark` is shown while any override exists.
  - The street edge **and every overridden edge** are always labelled. `frontLabel` becomes `forcedLabel(i, text)`, placed first: under or above the visible midpoint of the edge, then forced. This extends the TL's "force only for the street label" ruling to overridden edges, per the binding note in the F2-T2 outcome review; see question Q6.
  - Other edges keep the existing culling.
- **Keeping clear of the mode control.** `site-tap-mode` (top left) joins `overlays()`. `fit()` widens the left / top pad only when the plot would reach under the control, as it already does for the compass. Test: the sample at 360x640 keeps ≥ 4.0 px/m.
- **Edge list (`q-edges.js`).**
  - `q-edges-toggle` expands and collapses `q-edges` (`aria-expanded`).
  - Each row comes from `tpl-edge-row`: `edge-name` "Edge 3 · 8.9 m"; `edge-class` "back", "side (set by you)" or "front (street)"; and `edge-switch` with visible text "Make side" / "Make back", or disabled on the street row.
  - Accessible name, set as `aria-label` from the state with lengths through `PC.units`: "Edge 3, 8.9 m, back: make side", or "Edge 3, 8.9 m, side (set by you): make back".
  - Rows are **updated in place** while the edge count is unchanged, so a keyboard user's focus survives a switch and the dialog's return to its opener. They are rebuilt only when the count changes.
  - Clicking a switch (Enter or Space through the native button) calls the same `propose(toggleEdge)`.
  - `focusin` on a row or its switch calls `qpreview.focusEdge(i)`, and `focusout` calls `focusEdge(null)`. The highlighted edge is drawn in the selection colour, 5 px wide (palette entry from D).
- **Notice.** A store subscriber shows one toast when `prev.ans.edgeOv` was non-empty and `next.ans.edgeOv` is empty, and the notification is neither `replace` nor `cancelled`:
  - "Back / side choices were reset because the outline changed" when the plot points or the `closed` flag differ;
  - otherwise "… because the street edge changed".
- **R5.** Every override goes through `propose`.
  - Equal back and side setbacks change no size, so nothing is asked.
  - A size-changing switch asks once per visit. Cancel restores the class: the subscriber re-renders the labels and the list from state.
- **Debug hooks** (A-2, read-only):
  - `PC.debug.siteLabels()` already returns texts, now including `*`;
  - new `PC.debug.siteFocusEdge()` returns the highlighted index or `null`;
  - new `PC.debug.tapMode()`.

### 1.6 Test files that hard-code draft v1 or the round-3 footprint (same change, so run-all never goes red)

My audit found more than the list in F2-plan.

| File | Owner | Change |
|---|---|---|
| `tests/unit/draft.test.mjs` | FS | `KEY` is `…v2`; `rejects('state v 2')` becomes `rejects('state v 3')`; wrapper tests on v2; new migration and `edgeOv` cases |
| `tests/e2e/shell.spec.mjs` | FS | `KEY` → v2 (line 5); `raw.v === 2` (line 164); the "old format" case (line 305) keeps `v = 0`; new v1-migration and both-keys cases |
| `tests/e2e/plot.spec.mjs` | FS | `KEY` → v2 (line 6) |
| `tests/e2e/questions.spec.mjs` | FS | the reload wait reads `plotcraft.draft.v1` (line 202) → `PC.draft.KEY`; the "narrow plot" case (9 x 40 m) re-checked for its 4b footprint |
| `tests/unit/footprint.test.mjs`, `validate.test.mjs`, `site.test.mjs` | FS | any thin-plot figure that 4b changes (e.g. the narrow 9 x 40 m warning text) updated to the A-6 round-4 result; sample cases unchanged |
| `tests/qa/session.mjs` | **QA** | `KEY` (line 7) |
| `tests/qa/f1-t1-layout.mjs` | **QA** | globals check `PC.DRAFT_V !== 1` (line 75) |
| `tests/qa/f1-t2-flows.mjs` | **QA** (not in the F2-plan list) | wrapper assertion `w.v === 1` (line 170); bad-draft table (lines 259, 261): "wrapper v 2 (newer format)" and "state.v 2" are now the **current** format (a stored v2 draft mutated to v 2 is unchanged and resumes), so they become "v 3"; a v1 wrapper is now migrated, not rejected |
| `tests/qa/f2-t1-ref.mjs`, `f2-t1-site.mjs` | **QA** (not in the F2-plan list) | the reference model must implement A-6 step 4b, or the generated thin / clamped plot cases (632 plots) disagree with the new footprints |
| `tests/qa/f2-t2-questions.mjs` | **QA** | its summary / footprint model reuses the F2-T1 reference (same 4b update); its canvas spy's label check must allow `*` once overrides exist |

**How the full run stays green (question Q2).** QA's files cannot change in the same commit as mine, so I propose a feature marker that QA can branch on before my change lands: `PC.C.FOOTPRINT_STRETCH_RATIO` (present only with 4b) and `PC.DRAFT_V === 2`.
1. QA lands version-aware versions of the five files first. They are green on today's tree, because without the marker they keep the round-3 expectations.
2. My increment-1 change lands, and the same files switch to the round-4 expectations.

If QA prefers, the alternative is a short window with the affected checks marked KNOWN.

### 1.7 Tests — increment 1

**Unit (node):**
- **4b, the PM / CTO cases exactly:**
  - 10 x 50 m at 30 % → 6 x 18 = 108 m², 21.6 %, clamped, reason `proportion`;
  - 50 x 10 m at 30 % → 15 x 5 = 75 m², `proportion`;
  - 20 x 30 m at 80 % → 16 x 24.5 = 392 m², reason `setbacks`, no stretch;
  - 10 x 20 m at 80 % → 6 x 15 = 90 m², `setbacks`;
  - 10 x 50 m at 20 % → 6 x 16.5 = 99 m², **not clamped**, no warning;
  - 10 x 50 m at 24 % → 6 x 18.5 = 111 m², clamped, `proportion`;
  - the sample and every existing unclamped case byte-identical.
- **4b, properties over the existing generated plots:**
  - the result fits (independent `buildable` check, as in `footprint.test`);
  - area ≤ target;
  - long ≤ 3 x short + 0.5;
  - area ≥ the round-3 result;
  - deterministic: two runs, deep-equal.
- **Pruning equivalence:** for 40 seeded concave plots, `place(r, search, beat)` gives the same result as an unpruned copy run in the test through a test-only switch `PC.site.T.noPrune`. Question Q3: alternatively, compare with QA's reference model.
- **Timing:** the existing 12-vertex 100 x 100 m comb at 30 % and at 80 % (both clamped, so 4b runs), best of three, each under 500 ms.
- **Validate:** both `fp-clamped` wordings in m and ft (dims, area and % through `PC.units`); exactly one wording when clamped, none when unclamped.
- **Site:**
  - `edgeAuto` equals today's classes;
  - an override changes `edgeClass`, `setbackOf` and the footprint;
  - the memo key distinguishes `edgeOv`.
  - `toggleEdge`: street edge is a no-op; back → side → back removes the entry; an open plot is a no-op.
  - The F2-S4 live case: sample with back 5 / sides 1, angled edge back → side gives 10.5 x 13.5 = 141.75 m²; back again restores 10.5 x 13 = 136.5 m² exactly.
- **Normaliser and store:**
  - each kind of change clears the overrides: a moved point, an added point, a removed point, reopen, Q6 change, and a default-street-edge change through a vertex move;
  - an unrelated change keeps them;
  - the gate with seeded valid plans: a vertex move that also clears an override that changed the size asks **once**, naming the combined `affected`.
- **Draft:**
  - v1 wrapper → migrated, `edgeOv` empty, `v` 2;
  - v2 round trip with overrides;
  - each rejected `edgeOv`: street edge, index out of range, unknown value, non-object, non-empty on an open plot;
  - an entry equal to automatic is dropped;
  - `KEY` / `KEYS`.
- **Storage (stubbed):** an emptied state removes both keys; the first v2 write removes v1.

**E2E `tests/e2e/edges.spec.mjs` (new):** 360x640 touch, 640x360 touch and 1280x800 mouse, real input only.
- **Tap mode:**
  - the control is tapped, not forced;
  - mode `street` behaves as today;
  - in mode `class`, tap every non-street edge of the sample (including the 8.9 m angled edge) and of a 12-vertex plot: each switches and switches back;
  - the label shows `*`, the legend mark appears, and the edge stays labelled even when short;
  - a street-edge tap shows the toast and changes nothing;
  - a far tap does nothing;
  - no page scroll or zoom.
- **Keyboard:**
  - Tab to `q-edges-toggle`, Enter, then Tab through the switches;
  - focus highlights the edge (`siteFocusEdge`);
  - the accessible name reads number, length, class and action, in m and in ft;
  - Enter and Space switch;
  - focus stays on the same switch after the update and after an R5 dialog closes.
- **Live effect:** sample with back 5 / sides 1 — angled edge back → side → back. Summary, preview footprint and conflict rows return to exactly the previous figures.
- **R5, with seeded valid plans:**
  - default setbacks: any switch asks nothing;
  - back 5 / sides 1: a size-changing switch asks once, naming the levels;
  - Cancel restores the class, label and list;
  - Continue applies.
- **Clearing**, with an override made each time:
  - a corner drag, Undo (reopen), Clear, a Q6 tap and Q6 next each clear it;
  - the toast appears once, with the right wording;
  - with seeded plans, the combined change shows at most one dialog;
  - Load sample, Start new and Resume over a draft with overrides show no toast;
  - an R5 Cancel shows no toast.
- **Invariant attack:** after every plot operation (tap, close, drag, undo, reopen, clear, sample, Start new, resume) and every Q6 operation, `edgeOv` is empty unless the plot is closed, and holds only valid non-street indices.
- **Persistence:**
  - overrides survive a unit switch, group and stage changes, and reload + Resume;
  - a stored v1 draft (written raw) resumes with no overrides;
  - v1 + v2 both stored → v2 wins;
  - v1 stored → Start new → reload → nothing offered;
  - bad `edgeOv` (street edge, index out of range, unknown value) → the draft is discarded silently.
- **Sample and Skip:** making an override removes Skip to 3D.
- **Layout:** the sample at 360x640 is drawn at ≥ 4.0 px/m with the mode control present; the mode control does not cover the plot.

`questions.spec.mjs` and `shell.spec.mjs` are updated as listed in 1.6.

### 1.8 Mutation checks I will do (each restored byte for byte)

1. Stretch (a) disabled → the 10 x 50 / 50 x 10 cases fail.
2. The 1:3 try removed → 10 x 50 at 24 % fails.
3. `clamped` keeps the step-4 flag → 10 x 50 at 20 % fails (wrong warning).
4. `reason` always `'setbacks'` → the proportion-wording cases fail.
5. Pruning `beat` off by one step (`>=` instead of strict) → the equivalence test fails.
6. Memo key without `edgeOv` → the override live-effect unit case fails.
7. The normaliser not called in the gate's candidate → "one dialog at most" fails.
8. The normaliser ignores `closed` → the reopen clearing case fails.
9. `toggleEdge` not refusing the street edge → the toast / no-change case fails.
10. `start.js` removes only the v2 key → "v1 → Start new → reload" fails.
11. `parse` accepts an `edgeOv` on an open plot → a draft unit case fails.
12. The notice subscriber not ignoring `replace` → the Load sample / Resume no-toast case fails.
13. Rows rebuilt instead of updated in place → the keyboard focus-kept case fails.
14. No forced label for overridden edges → the short-edge `*` case fails.

### 1.9 Acceptance map — increment 1

| Criterion | Where tested |
|---|---|
| F2-S4 where / how: explicit tap mode, default `street`, mode always shown | edges.spec tap mode; D's spec for the layout |
| F2-S4 tap (hit rules, toggle and back, street-edge hint, far tap) | edges.spec at 3 viewports |
| F2-S4 keyboard / no-pointer (list, Enter / Space, highlight, accessible name) | edges.spec keyboard |
| F2-S4 phone (360x640, 640x360 touch, sample + 12-vertex plot, 44 px, no scroll or zoom) | edges.spec + D's spec |
| F2-S4 labels (`*`, legend mark, back to automatic removes the mark) | edges.spec |
| F2-S4 live effect (back 5 / sides 1, exact restore) | site unit + edges.spec |
| F2-S4 R5 / R5 "Edge-class overrides" (equal setbacks never ask; Cancel restores; one dialog with clearing) | store unit + edges.spec |
| F2-S4 draft (saved, resumed exactly; pre-v2 drafts resume) | draft unit + edges.spec persistence |
| F2-S4 cleared (vertex move, count, reopen, Q6; notice once; never on replace or Cancel) | store unit + edges.spec clearing + invariant attack |
| F2-S4 sample (no overrides; one removes Skip) / units (kept across m / ft) | edges.spec |
| 3.1 round 4 (stretch, 3:1 / 1:3, clamped after 4b, never above target) and the PM examples | footprint unit |
| F2-S3 clamped wordings (two texts, exactly one, R4) | validate unit + edges.spec summary row |
| A-6 timing bound (comb at 30 % and 80 %) | footprint unit |
| 6.2 sample unchanged | existing sample, footprint and site unit cases |

---

## Increment 2 — rooms (F2-S2; scope unchanged)

Written only after increment 1 is approved.

### 2.1 Files

| File | Change |
|---|---|
| `src/js/core/levels.js` | pure helpers (2.2) |
| `src/js/ui/q-rooms.js` (new, manifest after `q-edges.js`) | the Rooms group: add form, grouped list with editable rows, pairs, Q14 |
| `src/js/ui/stage-questions.js` | Rooms bindings registered; `setLevels` uses the three-way dialog from `q-rooms.js`; `goToQuestion(q, level)` gets level-aware focus for room conflicts |
| `src/js/ui/summary.js` | passes `level` to `onFix` (it already does); no other change |
| `src/manifest.json` | + `js/ui/q-rooms.js` |

Tests: `tests/unit/rooms.test.mjs` (new), `tests/e2e/rooms.spec.mjs` (new); `questions.spec.mjs`: the "Rooms group is inert" case is replaced and the Q7 dialog cases are updated to the three-way dialog.

### 2.2 Core helpers (`PC.levels`, pure, return `{ ok, reason }` and mutate the draft)

- **`addRooms(draft, { type, level, size, area, count })`.**
  - `count` is 1–8. It refuses with `'full'` (plus the free number) when the level would exceed `MAX_ROOMS_PER_LEVEL`, and with `'level'` when the level does not exist.
  - `size` is `'S' | 'M' | 'L'` with `area = null`, or `null` with `area` in `RANGE.roomArea` (4–80 m², stored in m², rounded to 1e-4).
  - Ids come from `nextRoomId` (unique and never reused). Rooms are appended in list order.
- **`updateRoom(draft, id, patch)`** covers type, level, size / area and master.
  - A type change away from bedroom clears `master`.
  - A level change drops the room's pairs (they would cross levels) and refuses a full target level.
- **`removeRoom(draft, id)`** also removes its pairs.
- **`setMaster(draft, id, on)`.** Bedrooms only. One master per house: turning one on turns the others off (question Q7).
- **`addPair(draft, a, b)`.**
  - It refuses `'self'`, `'levels'` (different levels) and `'max'` (6 per level).
  - A duplicate returns `{ ok: true, dup: true }` and changes nothing.
  - The pair is stored in id order (as `draft.js` requires).
- **`removePair(draft, a, b)`.**
- **`nearestLevel(state, goneId, remaining)`.** The nearest remaining level by order B, G, 1, 2; ties go downwards (there are none in practice, since levels only go at the ends).
- **`moveRooms(draft, fromIds, to)`.** Moves the rooms and keeps their pairs. It is refused with `'full'` / `'pairs'` when the target would exceed 8 rooms or 6 pairs (question Q5).
- `prune` (F2-T2) stays.

### 2.3 UI (`q-rooms.js`)

- **Add form.**
  - Type select; level select (only existing plan levels enabled); S / M / L / Exact radios. `room-add-size-hint` shows "M bedroom = 16 m²" in the current unit.
  - Exact area: `room-add-area` is enabled only for Exact. It is typed in the current unit, its suffix is `m²` or `sq ft`, and its limits are the 4–80 m² range shown in the unit.
  - Count: field plus steppers, 1–8.
  - "Add room" calls `propose(addRooms)`.
  - Refusals are shown in `room-msg` (`role="alert"`) and nothing is committed, e.g. "Ground floor has 7 rooms: 1 more fits (8 per floor)." Invalid typed text stays in its field, the same way as in `qfields.number`.
  - The Enter handler cancels the key's default action (F2-T2 bug 1 lesson).
- **List.**
  - One `tpl-room-group` per existing plan level, in level order, with `group-name` and `group-count` ("3 of 8"). An empty level shows its empty group, so Fix has a target.
  - Rows (`tpl-room-row`):
    - the derived name (`PC.levels.roomNames`);
    - the area hint in the current unit;
    - type, level and size selects, and an exact-area field shown only for Exact;
    - the master checkbox, whose label is hidden for non-bedrooms;
    - delete.
  - Every edit calls `propose`.
  - Rows are keyed by room id and **updated in place**. The list is rebuilt only when the set of ids or their levels change, and then focus goes back to the same control of the same room when it still exists.
- **Pairs.**
  - `pair-a` lists every room (option text "Kitchen · Ground floor").
  - `pair-b` lists only rooms on A's level, minus A. The self and cross-level pairs therefore cannot be chosen, and `addPair` still refuses them.
  - "Add pair" calls `propose(addPair)`. A duplicate shows "That pair already exists." in `pair-msg` with no change; the 7th pair on a level is refused there too.
  - `pair-list` rows read "Kitchen + Dining · Ground floor" and have a delete button.
- **Q14.**
  - `q-stair-pos` radios and the `q-lift` switch go through `propose`.
  - `q-stairs-box` is hidden and `q-stairs-none` shown when `!PC.levels.stairsExist(state)`.
- **Removing a level with rooms** (replaces F2-T2's plain dialog in `setLevels`).
  - It uses `ui.dialog.confirm` with `extra = tpl-level-remove`. Title "Remove First floor?", buttons "Remove" / "Cancel".
  - `level-remove-text` names the rooms and the target, e.g. "The First floor has 7 rooms. Move them to the Ground floor, or delete them?"
  - `dialog-text` carries the plans sentence from `plansText(PC.store.affected(candidate), gone)`. It is **recomputed when the radio changes**: "move" and "delete" give different candidates, and with valid plans on both floors Ground is affected either way.
  - "move" is disabled, with a one-line reason, when `moveRooms` would refuse (more than 8 rooms or 6 pairs). "delete" is then preselected.
  - On Remove: `commit` of the change + `moveRooms` or nothing + `prune` + the roof normalisation; one dialog, never two. On Cancel: nothing changes and the control shows the old value.
- **Fix (TL binding note).**
  - `floor-empty` and `basement-empty` with level L: open Rooms, set `room-add-level` to L and focus `room-add-type`, with that level's empty group in view.
  - `level-over` with level L: focus the first row control of L's group.
  - Q12 conflicts map to the Q11 block as today.
- **Summary.** needed / available already follow `PC.validate` live; nothing changes there.
- **Phone.** Rows wrap (Designer CSS from F1-T1). Tests check that there is no horizontal scroll at 360 px with 8 rooms on a level and 6 pairs.

### 2.4 Tests — increment 2

**Unit `rooms.test.mjs`:**
- `addRooms`:
  - count 3 gives "Bedroom 1..3", ids unique and increasing, `nextRoomId` advanced;
  - the 9th room is refused with the free count;
  - exact area: 4 and 80 accepted, 3.99 and 80.01 refused;
  - an exact area typed in ft converts to the same m² (through `PC.units.areaFromDisplay`) whatever the unit.
- `updateRoom`:
  - type away from bedroom clears master;
  - a level change drops the room's pairs and refuses a full level.
- `removeRoom` removes its pairs.
- `setMaster` allows one per house.
- `addPair`: self, cross-level and 7th pair refused; a duplicate is a no-op; stored in id order.
- `nearestLevel`:
  - basement → G;
  - 3 → 2 floors: '2' → '1';
  - 2 → 1 floor: '1' → G.
- `moveRooms` keeps the pairs and refuses past 8 rooms or 6 pairs.
- Every helper's result passes `PC.draft.validState`, over a seeded series of 200 random operations.

**E2E `rooms.spec.mjs`:** 360x640 touch, 640x360 touch, 768x1024 touch and 1280x800 mouse; real taps and typing; Enter on fields.
- Add with count 3 → three rows named Bedroom 1–3, and the summary's needed figure grows by 3 x the M area.
- Exact area typed in ft stores m².
- The 9th room is refused inline and nothing is stored.
- Edit type, level and size in a row: names renumber and the summary follows.
- Master on one bedroom, then on another: the first is turned off.
- Pairs:
  - across levels impossible (`pair-b` offers only same-level rooms);
  - duplicate ignored with its message;
  - deleting a room removes its pair.
- Q14:
  - hidden for one floor without basement or usable roof;
  - shown when the usable roof is switched on;
  - the stair position and lift ask R5 with seeded plans.
- Basement on without rooms blocks (`basement-empty`). Fix lands on the Basement in the add form.
- `level-over`, "Ground floor: needs X, Y available", shows both numbers. Fix focuses Ground's first row; shrinking a room clears it.
- Removing a floor with rooms:
  - move, delete and cancel paths;
  - "move" disabled when the target would exceed 8;
  - the dialog names every affected plan (from `PC.store.affected`) and its text changes with the radio;
  - one dialog only;
  - after it, the state is a valid draft.
- With seeded plans: room edits ask R5 only for the touched level; Cancel restores the row.
- Load sample: the room list, pairs and stair equal 6.2 exactly.
- Each scenario ends with: no page scroll, 44 px targets, clean log.

### 2.5 Mutation checks (increment 2)

1. `addRooms` without the 8-per-level check → 9th-room cases fail.
2. `removeRoom` keeps pairs → the pair-removal cases fail.
3. `addPair` accepts cross-level pairs → unit fails (the UI filter alone would hide it).
4. The three-way dialog text not recomputed on the radio → the "text changes with choice" case fails.
5. "move" not disabled when full → the disabled-move case fails.
6. Fix without the level → the Fix-lands-on-level cases fail.
7. Rows rebuilt on every render → the focus-kept case fails.
8. Exact area stored in display units → the ft case fails.

### 2.6 Acceptance map — increment 2

| Criterion | Where tested |
|---|---|
| F2-S2 add / edit / remove; type, level (existing levels only), S / M / L or exact 4–80 m² in the current unit; S / M / L shows its area in the unit | rooms unit + rooms.spec |
| F2-S2 count, auto-names, one master, 9th room refused inline | rooms unit + rooms.spec |
| F2-S2 Q13 pairs (no cross-level, no self, duplicates ignored, deleting a room removes its pairs) | rooms unit + rooms.spec |
| F2-S2 Q14 five positions + lift; "single level" text when no stairs | rooms.spec |
| F2-S2 removing a floor or basement with rooms: move / delete / cancel | rooms.spec |
| R5 rows: Q11–Q13 touched level only, Q14 every level, Q7 own dialog naming every affected plan | rooms.spec with seeded plans; `PC.store.affected` unit (F2-T2) |
| F2-S3 room conflicts (empty floor, empty basement, needed over available with both numbers) visible and cleared live; Fix lands on that level's room list | rooms.spec |
| 6.2 sample room list, pairs and stair | rooms.spec + `sample.test` |
| Phone usability (rows wrap, no horizontal scroll, 44 px) | rooms.spec at 360x640 and 640x360 |

---

## Risks

1. **QA files that hard-code v1 or the round-3 footprint.** There are five, two more than F2-plan lists: `f1-t2-flows.mjs` and the F2-T1 reference model. Without the marker sequence of 1.6 the full run goes red on the day increment 1 lands.
2. **4b timing on the 2-core machine** while browser suites run beside it. Best of three is planned; the pruning is the real bound.
3. **The normaliser in `store.js`** puts site knowledge into the store's commit path (question Q1). Its cost is one comparison of points per commit, cheap.
4. **The three-way dialog's text changes while it is open** (radio). The dialog keeps focus on the radio and announces nothing new. Acceptable for the prototype; the Designer may want `aria-live` on `dialog-text`.
5. **Increment 2 grows the stage-2 render.** Rows updated in place keep it cheap. The live slider rule (one analysis per frame, 50 ms cut-off) is unchanged.
6. **The F3-T1 generator** must be proven up to 3:1 plus one rounding step (F3 plan); this is not in this task.
7. **Real-device gate still OPEN.** The tap mode, the edge list and the room rows add more things only a real phone will confirm.

## Questions for the Tech Lead

1. **Clearing overrides:** may I use the single normaliser in `PC.store.commit` and in the gate's candidate (1.3), or must each of the six mutators clear `edgeOv` explicitly? Results and tests are the same either way.
2. **Green-run sequence for QA's files (1.6):** may QA land version-aware updates first, branching on `PC.C.FOOTPRINT_STRETCH_RATIO` / `PC.DRAFT_V`, before my increment-1 change? Or do you prefer a KNOWN window? Either way, `f1-t2-flows.mjs` and the F2-T1 / F2-T2 reference models need adding to the A-4 / F2-plan list.
3. **Pruning equivalence test:** a test-only `PC.site.T.noPrune` switch (core, read only by the test), or rely on QA's reference model for equivalence?
4. **Dimensions in the proportion wording:** use `PC.units.fmtDims` ("6.0 × 18.0 m", as in the pool note), or a plain "x" as written in F2-S3?
5. **Moving rooms when the target is full:** disable "move" with a reason (my plan), or move the rooms that fit and ask about the rest? Keeping the 8-room and 6-pair rules is needed for `validState`.
6. **Forced labels:** confirm that `o.force` is extended from the street label to overridden edges (outcome-review note), placed street first, then overrides in edge order.
7. **Master bedroom:** one per house (my plan; F2-S2 says "one bedroom can be marked master") or one per level?
8. **Tap mode after a toggle:** it stays in `class` until the user switches back or a `replace` happens (my plan). Should it also return to `street` on leaving stage 2?
