# PlotCraft — Architecture (shared decisions for F1–F5)

Owner: Tech Lead. Inputs: `docs/00-brief.md`, `docs/01-product/goals-and-stories.md` (round 2), `docs/01-product/cto-review.md` (rounds 1–2, binding notes).
One approach is chosen for each topic.

> **Round 2 changes (2026-11-19, answering `cto-review.md` round 1)**
> 1. A-7: the signature holds footprint size `[w, d]` and the resolved street-edge index, not the footprint corners. A change that only moves the building on the plot resets nothing and asks nothing.
> 2. A-10 / A-16: whitelist extended (`frustumCulled`, `geometry`, `material`, `getObjectByName`, `parent`, `quaternion`, `renderOrder`, `Color.r/g/b/clone`, full `Vector3` list, `updateArcLengths`, `shadow.normalBias`); the mock enforces five call signatures; `ShapeGeometry` plane and rotation stated; vegetation `InstancedMesh` objects are `frustumCulled = false` (A-11).
> 3. A-8: under-filled cells no longer stretch rooms (a column may be thicker than "full span", leaving hall at its end); generated coordinates snap to 0.5 m when the layout still passes `check`; `no-layout` message names fixes. Spike re-run with a seeded sweep: 1.5 % no-layout at 85 % fill or less (ceiling in the test: 5 %).
> 4. A-15: plan-editor edges snap to neighbouring edges within 0.3 m before the grid.
> 5. Adopted non-blocking suggestions: vegetation (scatter + instanced meshes) moved from F4-T2 to F4-T3; WebGL context loss handling (A-10); shadow box fitted to building plus yard (A-11); z-fighting offsets (A-10); parking side-yard candidate (A-6); overhead eye point for basement tour stops (A-14); stair/lift as plain boxes in F4-T1, mock written first.
> 6. CTO decisions recorded: `dist/index.html` is published at the end of F1 and again after F4-T1 (A-16). (The fallback proportions were adopted later: A-6 step 4, CTO decision of 2026-11-20.) Section numbers such as "3.1" or "4.3" without a prefix refer to the PM document; "A-n" refers to sections of this file.

> **Round 4 (2026-11-20, client decisions CD-1 / CD-2, PM stories round 4):** A-4 `ans.edgeOv` + invariant, draft v2 with v1 migration; A-6 automatic vs in-effect edge classes, step 4b (stretch and 3:1 / 1:3 for clamped footprints, `reason`); A-7 overrides through `propose`, not in the signature; A-15 edge tap mode; A-18 F2-T3 scope. Both land in F2-T3 (F2-plan).
>
> **Changes from the F2 task reviews (2026-11-20, Tech Lead):** A-6 step 4: the fallback also runs when the centred result rounds under 20 m2, and the wrong sentence "convex plots never reach this branch" is corrected (F2-T1 outcome review). A-7: own-confirmation dialogs name every level from `PC.store.affected` (F2-T2 implementation review). A-2 / A-5 / A-15: F2-T2 additions (`keepSample`, `prune`, `stepLen`, `fmtDims`, Q5 helpers, `locked` site preview, phone legend strip, slider gesture end, debug hooks).

---

## A-1. Deliverable, source layout, build

- Deliverable: `/home/claude/plotcraft/dist/index.html`, one file, inline CSS + JS, one external tag only:
  `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>` (it lives literally in `src/index.html`, placed **before** the app scripts, without `defer/async`).
- Nobody edits `dist/`. Everyone edits small files under `src/` (target: 300 lines or fewer per JS/CSS file; `src/index.html` is exempt and is organised with one comment banner per stage and template block) and runs `node build.mjs`. A CSS file that outgrows the target is split and listed in the manifest (e.g. `31-overlays.css`).

```
plotcraft/
  build.mjs                 inlines src/ into dist/index.html (reference implementation in A-17)
  src/
    manifest.json           ordered lists: { "css": [...], "js": [ {"file": "...", "layer": "core|data|ui|three"} ] }
    index.html              shell + static markup of all five stages; markers <!--@CSS--> and <!--@JS-->
    css/                    00-tokens.css 10-base.css 20-shell.css 30-components.css 40-stage-plot.css
                            41-stage-questions.css 42-stage-plans.css 43-stage-interior.css 44-stage-3d.css
    js/core/                pure logic. No DOM, no window, no THREE. Runs in node.
    js/data/                object literals only (Designer-owned tables)
    js/ui/                  DOM, 2D canvas, pointer handling, stage controllers
    js/three/               everything that touches THREE
    js/main.js              boot
  tests/                    see A-16
  dist/index.html           build output
```

Build rules (`build.mjs`, node only, no dependencies):
1. Read `src/manifest.json`; concatenate CSS files into one `<style>`; emit **one inline `<script>` per JS file**, in manifest order, each preceded by a `/* path */` comment (a syntax error in one file then cannot take down the 2D stages).
2. Escape `</script` inside JS as `<\/script`.
3. Fail (exit 1) if a manifest file is missing, if a file under `src/js` or `src/css` is not in the manifest, or if the output contains more than one `src=`/`href=http` reference.
4. Print output size. No minification (readable hosted source helps debugging on the published page).

## A-2. Module pattern and global namespace

- Exactly one global: `PC`. Every JS file is a classic script of this form (no ES modules, no bundler):

```js
(function (PC) {
  'use strict';
  PC.geom = { /* ... */ };
})(globalThis.PC = globalThis.PC || {});
```

- Layer rules, enforced by tests (A-16):

| Layer | May use | Must not |
|---|---|---|
| `core` | `PC.*` from core/data, `Math`, `JSON` | `window`, `document`, `navigator`, `localStorage`, `THREE`, timers, `requestAnimationFrame` |
| `data` | nothing | any code other than assigning literals to `PC.data.*` |
| `ui` | DOM, canvas 2D, core, data | `THREE` |
| `three` | `THREE` **inside functions only**, core, data, a canvas element passed in | top-level `THREE` access (the file must load when `THREE` is undefined) |

- Namespace map (file -> namespace). Files are created by the task named in the feature plans.

| core file | namespace | content |
|---|---|---|
| `ns.js` | `PC.VERSION`, `PC.DRAFT_V` (1 until F2-T3, then 2: A-4), `PC.data = {}` | |
| `const.js` | `PC.C` | every number of section 4 (room sizes, allowances, limits, snaps) in metres; the only place they live |
| `units.js` | `PC.units` | `toDisplay`, `fromDisplay`, `fmtLen` (1 decimal), `fmtArea` (whole), `stepLen` (0.5 m / 1 ft), `fmtDims`, `parseNum`, 1 ft = 0.3048 m |
| `geom.js` | `PC.geom` | signed area, perimeter, bbox, point-in-polygon, segment intersection, point/segment/rect distances, `segRelation`, `innerPoint` (label point inside a polygon), rectangle helpers (F2-T1) |
| `plot.js` | `PC.plot` | F1 rules: `canAdd`, `canClose`, `canMove`, `normalise` (CCW), `defaultStreetEdge` |
| `frames.js` | `PC.frames` | A-5 |
| `site.js`, `site-footprint.js`, `site-outdoor.js` | `PC.site` | edge classes, buildable mask, `rectFits`, vegetation budget, `PC.site.analyse(state)` memoised (last 4 inputs) / footprint algorithm (A-6) / parking and pool placement; `toggleEdge`, `clearOvIfOutlineChanged` (store normaliser), `T.noPrune` (test only) (F2-T3) |
| `levels.js` | `PC.levels` | plan-level list, `stairsExist`, derived room names, needed/available areas, `prune(draft)` (F2-T2); room editing helpers returning `{ ok, reason }` and leaving the draft untouched on refusal (F2-T3): `addRooms`, `updateRoom`, `removeRoom`, `setMaster` (one per house), `addPair`, `removePair`, `pairsOn`, `nearestLevel`, `moveRooms`, `removeLevels`, `removalQuestion`, `plansSentence`, `ORDER` |
| `validate.js` | `PC.validate` | blocking list, warning list, summary numbers (F2-S3) |
| `signature.js` | `PC.sig` | A-7 |
| `layout.js` | `PC.layout` | generator, `check`, `adjacent`, `overlaps` (A-8) |
| `plans.js` | `PC.plans` | `sync` (regenerate stale levels), edit operations with clamp/snap, approve |
| `store.js` | `PC.store` | state holder, `commit` (options `nav`, `keepSample`), `propose` (R5 gate), `affected(candidate)` (the gate's affected-level computation, also used by own-confirmation dialogs; F2-T2 round 2), `replace`, `go`, `subscribe`, `cmpId`, `session` |
| `stages.js` | `PC.stages` | stage gating (`status`, `clamp`, `skipTarget`, `MAX_BUILT`, wording table). It calls `PC.validate`, `PC.sig`, `PC.levels` and `PC.units` directly: no existence guards once those modules have landed (F2-T1), so a missing module fails loudly instead of making a stage valid |
| `draft.js` | `PC.draft` | `serialize`, `parse` (migrates older versions, validates, returns `null` on anything unexpected), `validState`, `isEmpty`, `KEY`, `KEYS` (current first) |
| `sample.js` | `PC.sample` | section 6.2 as a state object |
| `house.js` | `PC.house` | A-9 house model builder |
| `access.js` | `PC.layout.access` | CD-5 hall access per level (moved out of `layout.js` in F4-T2; same name and signature) |
| `furnish.js` | `PC.furnish` | furniture boxes per room from the Designer table (`room`, `pose`) |
| `scatter.js` | `PC.scatter` | seeded vegetation positions |
| `cam.js` | `PC.cam` | orbit pose maths, clamps, fly-to interpolation (plain arrays) |
| `sky.js` | `PC.sky` | A-13 time/season model |
| `tourplan.js` | `PC.tourplan` | A-14 drone waypoints and timing |

| data file | namespace | owner |
|---|---|---|
| `palette2d.js` | `PC.data.palette2d` (grid, plot, setback, footprint, room-type tints, states) | Designer (F1-T1) |
| `look3d.js` | `PC.data.exteriors`, `PC.data.interiors`, `PC.data.roomTints`, `PC.data.siteColors` | Designer (F3-T3) |
| `furniture.js` | `PC.data.furniture` | Designer (F3-T3) |
| `sky.js` | `PC.data.sky` | Designer (F3-T3) |

| ui / three file | namespace |
|---|---|
| `ui/dom.js`, `storage.js`, `dialog.js`, `shell.js`, `start.js` | `PC.ui.*` (`$`, `on`, storage adapter (`readDraft`, `writeDraft`, `removeDraft`: the only access to draft keys) + autosave, in-page dialog/toast/banner, stepper + Back/Next + stage-controller registry, start panel + pending-draft guard + Skip to 3D) |
| `ui/view2d.js`, `draw2d.js` | `PC.ui.View2D` (pan/zoom/tap/drag/pinch on a 2D canvas), shared drawing of plot, labels, setback zone, footprint |
| `ui/stage-plot.js`, `stage-questions.js`, `q-fields.js`, `q-preview.js`, `q-edges.js`, `q-rooms.js`, `summary.js`, `stage-plans.js`, `plan-editor.js`, `stage-interior.js`, `stage-3d.js` | `PC.ui.stages.*`; helpers `PC.ui.qfields` (`number`, `slider`, `radios`, `toggle`), `PC.ui.qpreview` (`init`, `render`, `focusEdge`), `PC.ui.qedges` (`init`, `render`), `PC.ui.qrooms` (`init`, `render`, `removeLevel`), `PC.ui.summary` (`init`, `render`, `collapse`) |
| `three/util.js` | `PC.three.col`, `PC.three.BoxBatch` (A-11) |
| `three/scene.js` | `PC.view3d` (renderer, loop, resize, lights rig, open/close) |
| `three/build-shell.js`, `build-roof.js`, `build-interior.js`, `build-site.js` | `PC.three.build*` |
| `three/camera.js`, `look.js`, `finder.js`, `tour.js` | `PC.three.*` |

- Test hooks (always present, read-only helpers, used by playwright): `PC.debug`, created in `main.js` and only ever extended with `Object.assign`. Today: `state()`, `toScreen(viewName, x, y)` (viewport coordinates of a world point in a named `View2D`: `'plot'`, `'site'`, later `'plan'`), `view(viewName)`, `plotLabels()`, `site()` (F2-T1), `siteLabels()`, `siteDial()`, `siteNorth()` (L angle the compass shows, also while dragging) (F2-T2), `tapMode()`, `siteFocusEdge()` (F2-T3), `planLabels()`, `planView()` (F3-T1). Added by later tasks: `house()`, `scene()`, `cam()` (F4-T1).
- Markup contract: the Designer's static markup carries `data-pc="<hook>"` attributes; FS code looks elements up **only** by `data-pc` (never by class). Three further attributes are part of the contract: `data-stage` on stage sections, `data-q` on question blocks, `data-kind` (`info|warn|block|ok`) on messages. Repeated items (room row, level tab, pair row, conflict item) are `<template data-pc="tpl-...">` elements. The hook list is a table in `docs/03-tasks/F1-T1/outcome.md` and is the UI contract for all later tasks; changing a hook name needs a TL-approved note.

## A-3. Hard-constraint checklist (applies to every task)

- No `alert/confirm/prompt`, `window.open`, downloads, `fetch`, `XMLHttpRequest`, service workers, `import`, external URLs other than the three.js tag, `<form>` submission (use `<div role="form">` or `preventDefault`). Checked by `tests/lint-constraints.mjs`.
- `localStorage` is touched only in `ui/storage.js`, every call inside `try/catch`; on failure the adapter flips to a memory no-op and exposes `available = false`.
- Pointer Events only (`pointerdown/move/up/cancel`, `setPointerCapture`), `touch-action: none` on the three canvases, wheel listeners registered `{ passive: false }`.
- Touch targets 44 px or more (`--tap: 44px` token), layout from 360 px.
- Canvases are sized by a `ResizeObserver` on their container (fallback: `window.resize`), device pixel ratio capped at 2 everywhere.

## A-4. App state and draft schema (version 2 from F2-T3; version 1 drafts are migrated)

One plain-JSON state object held by `PC.store`. Geometry in metres. Nothing derived is stored.

```js
state = {
  v: 2,                          // 1 before F2-T3 (no edgeOv); v1 drafts are migrated on load
  stage: 1,                      // 1..5
  sampleClean: false,            // true only while the sample is loaded and untouched (enables "Skip to 3D")
  plot: { pts: [[x, y], ...],    // world frame W (A-5), metres; counter-clockwise once closed
          closed: false },
  ans: {
    unit: 'm',                                   // Q1  'm' | 'ft'
    setbacks: { front: 3, back: 2, side: 2 },    // Q2
    footprintPct: 30, vegPct: 20,                // Q3, Q4
    north: null,                                 // Q5  null = default (street edge inward normal); else degrees clockwise from grid +y, multiple of 15
    streetEdge: null,                            // Q6  index i meaning edge pts[i] -> pts[i+1]; null only while the plot is not closed (see below)
    edgeOv: {},                                  // F2-S4 (draft v2): { '<edge index>': 'back' | 'side' }, overrides of the automatic class only
    floors: 2, basement: false, usableRoof: false,   // Q7
    ceilingH: 3.0, roofType: 'flat', exterior: 'sand',   // Q8 Q9 Q10
    rooms: [ { id: 'r1', type: 'living', level: 'G', size: 'M', area: null, master: false } ],  // Q11 Q12; size null + area in m2 = exact
    nextRoomId: 2,
    pairs: [ ['r1', 'r2'] ],                     // Q13, ids sorted inside a pair
    stairPos: 'centre', lift: false,             // Q14  'centre' | 'fl' | 'fr' | 'bl' | 'br'
    parking: { cars: 1, covered: false },        // Q15
    pool: { on: false, size: 'S' },              // Q16
    extras: { wall: true, gate: 'centre', seating: false },   // Q17
    interior: { style: 'modern', density: 'full' }             // Q18 Q19
  },
  plans: {                       // keyed by plan-level id 'B' | 'G' | '1' | '2'
    G: { sig: '...',             // A-7 signature the layout was generated for
         rooms: [ { id: 'r1', x: 0, y: 0, w: 5, h: 6 } ],   // footprint-local metres (A-5), 0.01 precision
         unmet: [ ['r1', 'r2'] ], edited: false, approved: false,
         error: null }           // 'no-layout' when the generator failed (rooms then empty)
  }
}
```

- Level ids: `'B'` basement, `'G'` ground, `'1'` first, `'2'` second. Room type keys: `bedroom bathroom kitchen living dining majlis office maid storage laundry`.
- Room names are derived (`PC.levels.roomNames`): numbered per level and type ("Bedroom 1", "Bedroom 2"; a single room of its type on a level has no number; the master is "Master bedroom"). Never stored.
- Ids compare numerically (`r8` before `r13`) through one comparator, `PC.store.cmpId`; every "sorted by id" in this document means that order.
- **The state only ever holds valid, in-range values** (enums and the 4.1 ranges). Text that is empty, non-numeric or out of range stays in the input field as transient UI state: the controller marks the field, registers it in the session set `invalidFields` (which `PC.validate` reports as the F2-S3 blocking conflict) and does not commit. `PC.draft.parse` can therefore validate strictly (unknown keys and out-of-range values reject the draft) without ever discarding a draft because of a half-typed number. Any schema addition bumps `PC.DRAFT_V`; the storage key is `'plotcraft.draft.v' + PC.DRAFT_V`.
- **Edge-class overrides (round 4, CD-2; F2-T3).** `ans.edgeOv` maps an edge index (string key) to `'back'` or `'side'`. Invariant: it is empty unless the plot is closed; it never names the resolved street edge; it never holds a value equal to that edge's automatic class (the toggle helper removes such an entry). The store enforces the clearing rule centrally (F2-T3 plan review, ruling 1): `PC.store.commit` and the gate's candidate run `PC.site.clearOvIfOutlineChanged(prev, candidate)` after the mutator and before the no-op test and `affected`, which empties `edgeOv` when any point moved, the vertex count changed, `closed` changed or the resolved street edge changed; so the clearing is part of the causing change and the R5 gate judges the combined result (one dialog at most). `replace` does not run it (`defaults()` and `parse` already satisfy the invariant). One test attacks the invariant through every plot operation (tap, close, drag, undo, reopen, clear, sample, Start new, resume) and Q6. `PC.draft.parse` rejects a v2 draft whose `edgeOv` breaks the first two rules (unknown value, index out of range, street edge).
- **Draft v2 (F2-T3).** `PC.DRAFT_V = 2`, `state.v = 2`. `parse` accepts a v1 wrapper, migrates it (adds `ans.edgeOv = {}`, sets both versions to 2) and then validates strictly as v2; anything else unknown is still discarded. The storage adapter reads `plotcraft.draft.v2`, falling back to `plotcraft.draft.v1`; the first v2 save removes the v1 key (all inside the try/catch adapter). **Removing the draft (Start new, an emptied state in `flush`) removes both keys**, otherwise a not-yet-migrated v1 draft would be offered again after reload (CTO round 4, item 3a). `parse` also rejects a non-empty `edgeOv` on an open plot; an entry equal to the automatic class is dropped (normalised), not rejected. **Pattern for later schema bumps (CTO, F2 feature review):** one pure `migrate` step per version, chained (v1 -> v2 -> v3 …) before strict validation; the old key is appended to `PC.draft.KEYS`; one unit test per historical version (a stored draft of that version resumes, migrated); the QA files that read the version use `PC.DRAFT_V` / `PC.draft.KEY` at run time. Tests: a stored v1 draft resumes with no overrides; v1 + v2 both present -> v2 wins; v1 stored -> Start new -> reload -> nothing offered. `PC.draft.KEYS` (v2, then v1) is the single key list; every read, write and removal goes through `ui.storage`. Test files that hard-code v1 or the round-3 footprint: FS `tests/unit/draft.test.mjs`, `tests/e2e/plot.spec.mjs`, `tests/e2e/shell.spec.mjs`, `tests/e2e/questions.spec.mjs` and the footprint / validate / site unit files (same change); QA `tests/qa/session.mjs`, `f1-t1-layout.mjs`, `f1-t2-flows.mjs`, `f2-t1-ref.mjs`, `f2-t1-site.mjs`, `f2-t2-questions.mjs`, made version-aware **before** the FS change lands, branching on `PC.C.FOOTPRINT_STRETCH_RATIO` / `PC.DRAFT_V` or reading `PC.draft.KEY` at run time (F2-T3 plan review, ruling 2).
- `ans.streetEdge` is `null` only while there is no closed plot: closing the shape stores the default-rule index (A-5), so later vertex drags can never move the street edge silently.
- Session-only state (not saved): R5 "confirmed this visit" flag, 2D view transforms, selected plan tab, 3D camera pose, hour, season, level selector, roof toggle.
- `PC.store.commit(mutator, { nav: false })`: clones, applies, replaces, notifies subscribers, clears `sampleClean` unless `nav` is true (a commit that changes nothing is ignored). Core uses no timers: autosave is a ui-layer store subscriber (`PC.ui.autosave`, 400 ms debounce, flushed on `visibilitychange`/`pagehide`). `Promise` is allowed in core.
- `PC.store.propose(mutator)`: the R5 gate (A-7). Returns a promise of `true` (applied) / `false` (cancelled, state untouched, UI re-renders from state so the old value reappears).
- **Rooms per level (CD-4, F4-T2 step 0).** `C.MAX_ROOMS_PER_LEVEL` went from 8 to 10 without a schema bump: `parse` checks the count against the constant, so every saved draft stays valid. Drafts are forward-only: a draft with 9 or 10 rooms on a level is refused by an older build, which is accepted for this prototype.
- Draft: key `plotcraft.draft.v2`, value `JSON.stringify({ v: 2, savedAt, state })` (before F2-T3: key `…v1`, `v: 1`). `PC.draft.parse` migrates a v1 wrapper first (see "Draft v2" above) and returns `null` (draft discarded silently) when JSON fails, `v` is neither 1 nor 2, or structural validation fails (types, enum values, numeric ranges of 4.1, 3–12 vertices, room ids unique; plan room ids and `unmet` ids well formed and unique within the plan, and on that plan's level **only when the plan is fresh**, i.e. its `sig` equals `PC.sig.level(state, id)`). A stale plan may still list rooms deleted or moved to another level since it was generated (A-7), and `parse` accepts it: the draft must restore every state the app can reach (CTO F3 review, finding 1; TL `docs/03-tasks/F3-T3/fs-draft-fix-review.md`). On load, `PC.plans.sync` runs, so a plan whose signature no longer matches is regenerated rather than trusted. A stored draft that `parse` rejects is not offered; before the key is removed its raw text is copied to the single side key `plotcraft.draft.rejected` (overwritten each time, never read by the app, through `ui.storage`), so a validator bug costs a Resume card, not the project (TL ruling, same review).
- Stage gating is pure: `PC.stages.status(state)` -> for each stage `{ reachable, valid, reason }`:
  1 valid = closed plot, area 50 m2 or more; 2 valid = no blocking conflicts; 3 valid = every plan level approved; 4 valid always; 5 has no Next.

## A-5. Coordinate frames

| Frame | Definition | Used by |
|---|---|---|
| **W** world/grid | metres, x right, y up as drawn on the plot grid. `plot.pts` live here. | stage 1, draft |
| **L** street-local | origin = start vertex A of the street edge A->B (polygon CCW, so the interior is on the left of A->B). `u` = unit(B - A) along the street, `v` = inward normal (u rotated +90 degrees). Street edge lies on v = 0; a convex plot is entirely at v >= 0, a concave plot may also extend to v < 0 beside the street edge (nothing may rely on v >= 0; the buildable bounding box can start below 0). Seen from the street facing the house, +u is the viewer's **right**. | site model, footprint, house model, plan drawing, 3D |
| **P** footprint-local | origin = footprint corner with the lowest (u, v); x along +u, y along +v. `y = 0` is the front wall. "Front-left" in Q14 = low x, low y. | `plans[*].rooms`, generator, plan editor |
| **T** three.js | `X = u - cu`, `Y = height`, `Z = -(v - cv)`, where `(cu, cv)` is the plot bounding-box centre in L. Y up, ground at Y = 0. North default (+v) is -Z, the street is on the +Z side. | 3D only |

- `PC.frames.make(pts, streetEdgeIndex)` -> `{ origin, ux, uy, w2l(p), l2w(p) }`; Q5 helpers (F2-T2): `backW(state)` (direction of +v as a W angle), `northToW(state, degL)`, `northStep(state, dir)` (Q5 is stored in W in 15-degree steps, so relative to a slanted street it is not a whole number: readouts round); `PC.frames.l2t(center, u, v, h)` -> `[X, Y, Z]` with `center = [cu, cv]` (the house model's `center`); `PC.frames.streetEdge(state)` -> the index in use.
- Everything downstream of stage 1 is axis-aligned in L: footprint, rooms, stairs, parking, pool. The plan view (stages 2 and 3) draws in L with the street at the bottom. W appears again only when drawing the plot stage.
- North: `PC.frames.northL(state)` returns degrees clockwise from +v, seen from above (0 when `ans.north` is null). In T the north unit vector is `(sin n, 0, -cos n)`.
- **Invariant: every committed closed plot is counter-clockwise (signed area > 0).** Orientation is normalised when the shape is closed (before any street-edge index exists), and every later operation on a closed plot must preserve it: `PC.plot.canMove` refuses a corner position that makes the signed area zero or negative (a single corner can flip a simple polygon without any edge crossing), and `PC.plot.valid` rejects such a draft. Frame L, the site model and everything after them rely on it. Rule for all invariants in this document: one test must attack the invariant through every operation that can change the data. Vertex drags keep order and indices. If the vertex count changes (clear + redraw), `ans.streetEdge` is reset to `null` and set again from the default rule when the new shape is closed (F1-S3 last criterion).
- Default street edge (4.1 Q6): edge whose midpoint has the lowest W y; tie -> the longer edge; still tied -> lowest index.

## A-6. Site model: edge classes, buildable area, footprint (3.1 + CTO round-2 fallback)

All in L. `PC.site.analyse(state)` returns the memoised site model (cache key = points + street edge + setbacks + footprint % + parking + pool + vegetation %):

```js
site = { frame, ptsL, plotArea, perimeter, edgeClass: ['front'|'back'|'side', ...] /* in effect */, edgeAuto: [...] /* round 4 */, setbackOf: [m per edge],
         buildable: { area, bbox: {u0, v0, u1, v1}, ok },            // ok = area >= 20
         footprint: null | { u, v, w, d, area, pct, clamped, moved, reason /* 'setbacks' | 'proportion', round 4 */ },
         parking: null | { u, v, w, d, cars, covered }, pool: null | { u, v, w, d },
         veg: { area, pct, reduced }, omitted: ['parking' | 'pool'] }
```

**Edge classes.** Front = street edge. For every other edge take its outward unit normal `n`; if the angle between `n` and `(0, +1)` (straight away from the street) is 40 degrees or less -> back; otherwise side. This is the **automatic** class (`site.edgeAuto`); `site.edgeClass` is the class **in effect** = `ans.edgeOv[i]` when present, else automatic (round 4, CD-2), and everything below (`setbackOf`, mask, footprint, parking, pool) uses `edgeClass`. The memo key of `analyse` gains `edgeOv`. Pure helper `PC.site.toggleEdge(draft, i)`: no-op on the street edge, otherwise switch the class in effect and drop the entry when it equals the automatic class.

**Buildable set (definition).** A point is buildable when it is inside the plot and its distance to every edge *segment* is at least that edge's setback (tolerance 1e-9). This definition is exact for convex and concave plots.

**Exact rectangle test** `PC.site.rectFits(rect)`: an L-axis-aligned rectangle lies in the buildable set if and only if (a) its centre is inside the plot, (b) no plot edge intersects the rectangle shrunk by 1e-6 (so it is inside the plot), and (c) for every edge, `segmentRectDistance(edge, rect) >= setback - 1e-6`.

**Buildable mask (for area, bounding box and candidate centres).** Sample the nodes of a 0.25 m lattice in L (multiples of 0.25 in u and v) over the plot bounding box; a node is in when it is buildable. `buildable.bbox` = min/max of the in-nodes (exact whenever setback lines fall on the lattice, which holds for the sample: u 2–18, v 3–28; otherwise within 0.25 m, absorbed by the 0.5 m rounding below). `buildable.area` = number of lattice cells whose centre is buildable x 0.0625. Worst case 100 x 100 m = 160 000 nodes x 12 edges, a few tens of milliseconds, computed once per input change because of the memo.
Drawing does not use the mask: the setback zone is painted exactly on canvas by clipping to the plot polygon and stroking each edge with round caps at line width 2 x setback.

**Footprint algorithm.**
1. If `buildable.area < 20` -> `footprint = null`, blocking conflict "buildable area below 20 m2".
2. Target area `A = footprintPct / 100 x plotArea`. Bounding box size `Wb x Db`, centre `c`. Ratio `r = clamp(Wb / Db, 0.5, 2)`. `w0 = floor05(sqrt(A x r))`, `d0 = floor05(sqrt(A / r))` (`floor05` = round down to 0.5 m; a floor of 0.5 m each).
3. `fit(centre)` = the largest `t` in (0, 1] such that the rectangle `t x w0` by `t x d0` centred there passes `rectFits`; test `t = 1` first, otherwise bisection (20 steps; nested rectangles make the test monotonic); `t = 0` if the centre itself is not buildable.
4. Centred try: `t = fit(c)`.
   - `t = 1` -> footprint `w0 x d0` centred on `c`, `clamped = false`.
   - `t < 1` and `t^2 x w0 x d0 >= A / 2` -> accept the shrunken rectangle, `clamped = true`.
   - otherwise **fallback** (CTO decisions of step 1 round 2 and of 2026-11-20): the search below is run for **three proportions** (width : depth): the bounding-box ratio `r`, then 1:2, then 2:1, each with the same target area and its own `w0 x d0` from step 2. The result with the largest final area wins; ties go to the earlier proportion. Search for one proportion: candidate centres = lattice nodes at multiples of 0.5 m that are in the mask, visited in order of increasing distance from `c` (ties: lower v, then lower u). Keep a running best `t` (starting from the centred result for that proportion); a candidate is first tested at `best + 1e-6` (after a cheap necessary test on mask nodes) and skipped when that fails, otherwise bisected. Strict improvement only, so ties resolve to the candidate nearest `c`. Result: `clamped = (t < 1)`, `moved = true` when a centre other than `c` won. The fallback also runs when the centred result, after the rounding of step 5, is under 20 m2 (F2-T1 QA bug 1, fixed in F2-T2 round 2), so the blocking conflict of step 6 appears only when no position gives 20 m2. The sample with its 6.2 answers never reaches the fallback; convex plots can (QA found 41 cases, e.g. the sample with setbacks 6 / 5 / 4 at 50 %), and their results are valid and at least as large as the centred one.
4b. **Narrow plots (round 4, CD-1; F2-T3).** Only when the result of step 4 is clamped: (a) *stretch* — if that result is at its proportion limit (long side >= 2 x short side - 0.5 m), keep its centre and short side and lengthen the long side in 0.5 m steps (symmetric about the centre) up to `min(3 x short, A / short)` while `rectFits` holds; (b) run steps 3–4 (centred try, then the fallback search) for the proportions **3:1 and 1:3**. The largest final area among the step-4 result, (a) and (b) wins; ties keep the step-4 result, then (a), then 3:1, then 1:3. Never above the target area. **Pruning (performance by design):** the 3:1 and 1:3 searches start their running best at the current winner's area (not at zero): a centre is tested only if a rectangle of that proportion there could strictly beat it, and a search that finds none returns "no improvement"; results are identical because ties keep the earlier result anyway. Timing test: the 12-vertex 100 x 100 m comb at 30 % and at 80 % (both clamped, so 4b runs), each under 500 ms (best of three if the parallel run makes it noisy).
   **`clamped` after 4b** (CTO round 4, item 1; "rounding alone is not a clamp"): whenever 4b has run (that is, the step-4 result was clamped), the final footprint, whichever candidate won, has `clamped = false` if its long side equals `floor05(A / short side)` (only rounding was lost), otherwise `clamped = true` (PM 3.1 / F2-S3 sentence governs, CTO round-4 re-review). QA cases: 10 x 50 m at 20 % -> 6 x 16.5 m = 99 m², not clamped, no warning; at 24 % -> 6 x 18.5 m = 111 m² (the 1:3 try, 3:1 plus one rounding step), clamped, proportion wording; the PM's three examples unchanged. `footprint.reason = 'proportion'` when the final footprint has long >= 3 x short - 0.5 m and the same short side and centre with the long side 0.5 m longer (0.25 m each end) still fits; otherwise `'setbacks'` (only meaningful when `clamped`). `validate` picks the F2-S3 wording from `reason`. `reason` is set only when `clamped`. Unclamped footprints, and therefore the 6.2 sample, are unchanged; PM examples: 10 x 50 m -> 6 x 18 m (108 m², proportion), 50 x 10 m -> 15 x 5 m, 20 x 30 m at 80 % -> 16 x 24.5 m (setbacks; not at its 2:1 limit, so no stretch, and the 3:1 try gives only 200 m²). Bound: `analyse` under 500 ms on the 100 x 100 m concave worst case.
5. After any shrink, width and depth are rounded down to 0.5 m again (still inside, the rectangles are nested) about the chosen centre. `u, v` = centre minus half size.
6. If the final area is under 20 m2 -> `footprint = null`, blocking conflict "the building does not fit this plot: reduce setbacks or redraw".
7. `pct = area / plotArea`. Rounding alone never sets `clamped`.
8. **Long-side cap after rounding** (F2-T3 increment-1 review, corrected by the CTO at the F2 feature review; implemented as the first item of F3-T1): after the final rounding, each candidate is capped and then the winner is chosen. **Step-4 (2:1) results:** long side <= `2 x (short side + 0.5 m)` (unchanged; no round-3 result is affected). **4b candidates (stretch, 3:1, 1:3):** long side <= `3 x short side + 0.5 m` (CD-1: "up to 3:1", plus at most one rounding step). A longer side is shortened about the same centre to the cap (nested, so it still fits; area only goes down, never above target). The stretch candidate is already within `3 x short`. Effects: the PM / CTO examples (108, 75, 392, 90, 99, 111 m²) and the sample are unchanged; the CTO's 2.5 x 8.5 m case becomes 2.5 x 8 m; QA's pentagon (6 / 5 / 4, 25 %) was 22.5 x 7 m under the old cap and its 3:1 candidate is now capped at 21.5 x 7 m (150.5 m²), the final winner being whichever capped candidate is largest (the F3-T1 unit case pins the value the app and QA's model agree on). Before that cap: the 2:1 limit (3:1 in step 4b) applies to the proportions before rounding; because width and depth are each rounded down to 0.5 m afterwards, the final sides can differ from exactly 2:1 by less than one rounding step (e.g. 10 x 20.5 m). The layout generator does not depend on the ratio.

Required unit test (CTO): the 6.2 sample gives plot 584 m2, perimeter 96.94, classes front/side/back/back/side, bbox u 2–18 v 3–28, buildable area 389.5 +/- 1.5, footprint exactly `{ u: 5.25, v: 8, w: 9.5, d: 15 }`, 142.5 m2, 24.4 %, `clamped = false`; needed 120 of 142.5 on both levels. Further tests: L-shaped and U-shaped plots whose bounding-box centre is outside the buildable set (fallback finds a footprint, `moved = true`, result inside the buildable set by an independent point check); a plot where nothing of 20 m2 fits (blocking).

**Parking** (`cars > 0`): rectangle `cars x 2.5` along u by 5.0 along v, fully inside the plot, with `v` range inside `[0.5, footprint.v]`. It keeps clear of the **entrance strip** (2 m wide, centred on the footprint's centre line, from the front wall to the street) so cars never stand in front of the door. Candidates in order: directly right of the strip, directly left of it, then a scan of u at 0.5 m steps that avoids the strip; lowest v first (0.5); then the side yards (below); only if all of these fail, the same front-yard scan again without the strip rule, this time farthest from the entrance first, so the block sits against one side and covers as little of the strip as possible (sample with 4 cars: u 0–10, 1 m of the 2 m strip). Last candidates: the side yards next to the street (rectangle starting at v = 0.5 beside the building, right side first), which may extend past the front wall line. First fit wins; none -> `omitted` + warning.
**Pool** (`on`): size from 4.3, long side along u when placed behind, along v when placed beside. Its clearance rectangle (pool grown by 1 m) must be inside the plot and must not overlap the footprint or the parking. Candidates: centred behind the footprint, then a 0.5 m scan of the back yard, then the right side yard, then the left. None -> `omitted` + warning.
**Vegetation**: `veg.area = min(vegPct x plotArea, plotArea - footprint - parking - pool)` using placed items only; `reduced = true` raises the warning with the effective %.

## A-7. Per-level signature and the R5 gate

`PC.sig.level(state, levelId)` returns a string. It is `'invalid'` when the level does not exist or the footprint is null; otherwise `JSON.stringify` of:

```js
{ fp:   [w, d, resolvedStreetEdgeIndex],                                          // footprint size (m) and the Q6 edge actually in use
  core: stairsExist ? [stairPos, lift ? 1 : 0] : 0,
  rooms: [[id, type, resolvedAreaM2], ...] sorted by id,     // rooms on this level; S/M/L resolved through PC.C
  pairs: [[idA, idB], ...] sorted }                           // pairs whose rooms are both on this level
```

Names and the master flag are not in it (they do not affect layout). Edge-class overrides are not in it either: they act only through the setbacks, so they reset a level exactly when they change the footprint's `[w, d]` (R5 round 4). Footprint **position is deliberately not in it** (CTO decision): plans are stored footprint-local, so a layout stays valid when the rectangle only moves (for example a back-setback change that shifts the bounding-box centre, or a small vertex move). Such a move is a site change, visible in the preview and summary, with no dialog and no reset. The street-edge index is included so that Q6 always resets every level, as the R5 table requires; `resolvedStreetEdgeIndex` is the default-rule result when `ans.streetEdge` is null.

Single rule, used everywhere: **a plan is valid for a level only while `plans[id].sig === PC.sig.level(state, id)`.**
- A stale plan is kept unchanged until `sync` regenerates it, so it may list rooms that were deleted or moved to another level, and `unmet` pairs naming them. Room-list operations (`removeRoom`, `updateRoom` to another level, `moveRooms`, `removeLevels`) never edit plans; `prune` only deletes the plans of removed levels. Code that reads a plan's rooms (stage 3, the house model) reads only fresh plans, after `sync`; the draft validator checks level membership only for fresh plans (A-4). Within one session, moving a room away and back before stage 3 is entered again restores the old signature, so the old plan, with its edits and approval, becomes valid again (accepted, CTO F3 review). A reload in between does not keep it: Resume runs `sync`, which regenerates every stale plan, as the R5 warning says (QA `docs/03-tasks/F3-T3/qa-draft-fix.md`). So a stale plan survives a reload in the draft, but not as a plan.
- While a level's current signature is `'invalid'` (open plot, no footprint), `PC.plans.sync` leaves its stored plan alone (nothing can be generated, and reopening then re-closing an unchanged plot makes the plan valid again); it still deletes plans of levels that Q7 no longer has.
- Where sync runs (F3-T1 plan review): inside `PC.store.go(3)`'s nav commit (stage change and plans in one commit), and in `start.js` after Resume, Load sample and before Skip to 3D approves. No existence guards on `PC.plans` / `PC.layout`.
- `PC.plans.sync(draft)` **mutates the object it is given** and is always called inside a `nav` commit (`PC.store.commit(s => PC.plans.sync(s), { nav: true })`), as `ui/start.js` already does; it never commits by itself. Run on entering stage 3, after draft load, after sample load: delete plans of levels that no longer exist; for each plan level with no plan or a stale signature, generate (A-8) and store with `edited = false, approved = false`.
- The gate, `PC.store.propose(mutator)`: build the candidate state; `affected` = levels whose plan is **valid now** (stored `sig` equals the current signature) and whose signature differs in the candidate, plus validly planned levels the candidate removes. A plan that is already stale never triggers the question. Proposals are serialised. On Cancel nothing is committed and subscribers are notified once with `meta.cancelled = true` and the unchanged state, so controls re-render to the old value. If `affected` is empty, or the session flag `r5Confirmed` is set -> commit. Otherwise ask the confirm handler (in-page dialog naming the affected levels); Continue -> set `r5Confirmed`, commit; Cancel -> nothing changes. The flag is cleared in `PC.store.go(3)` (each time stage 3 is entered) and by `replace`. An action that has its own confirmation (Clear on stage 1, removing a level that has rooms in F2-T2 / F2-T3) uses `commit` after that dialog, whose text names **every** level returned by `PC.store.affected(candidate)` (the gate's own computation: levels whose plan is valid now and whose signature differs in the candidate, removed levels included; e.g. removing the first floor also removes the stairs, so Ground is named too): one dialog, never two. All layout-class inputs (plot vertex release, Q2, Q3, Q6, Q7, Q11–Q14, and the edge-class override of F2-S4) go through `propose`, on the control's commit event (`change`, pointer release), never on every slider tick. Appearance-class inputs use `commit` directly; they cannot alter a signature, which a unit test proves for each of Q1, Q4, Q5, Q8, Q9, Q10, Q15–Q19.
- This resolves the CTO's round-2 note: the dialog appears only when at least one level would really reset.
- **Open product question (F3-T1, routed to the PM):** untouched generated plans (`edited: false`, `approved: false`, e.g. right after Load sample) currently count as valid plans for the gate, so the dialog can appear when no manual work would be lost. TL recommendation: add `PC.store.atRisk(candidate)` = `affected(candidate)` filtered to `edited || approved`; the gate asks only when `atRisk` is non-empty, and own-confirmation dialogs name only those levels; `affected` keeps its meaning (plans that go stale). Today's behaviour follows the literal R5 text until the PM decides (see `docs/03-tasks/F3-T1/plan-review.md`, addendum).

## A-8. Layout generator (`PC.layout`), frame P

Proven by `docs/02-features/spikes/layout-spike.mjs` (run with node): valid layouts with zero unmet pairs for both sample levels, an 8-room level with lift, corner stairs, a wide footprint, a no-stair level and the CTO's low-fill case (8.5 x 16.5 m, rooms 42/36/16/4/4), each in under 30 ms. `node …/layout-spike.mjs --sweep` runs 3 600 seeded validated programmes: no-layout 1.5 % at 85 % fill or less, 16 % above it, zero invalid results, worst case 87 ms. F3-T1 ports the spike; it is a reference, not production code.

**10 rooms per floor (CD-4; TL, F4-T2 plan review).** The cell-layout memo is keyed `ci * (1 << n) + mask` (the old `ci * 256 + mask` collided at n ≥ 9 and lost a room). Proof at 10: worst < 300 ms in node on the 105-case grid (10 rooms + lift + 5 pairs, 7 footprints x 3 fills x 5 stair positions), the 300-programme 9–10 sweep with no invalid result and no-layout ≤ 5 % at ≤ 85 % fill. Speed-ups must keep n ≤ 8 byte-identical: pruning only discards (lower bound > best + 1e-6) and the survivors are compared in the original mask order with the 1e-9 rule. If that is not enough, a search reduction for n ≥ 9 only is allowed (no earlier valid output exists there), with the same proof. Going back to 8 needs the client.

Inputs: footprint `W x D`, the level's rooms (id, type, resolved area), its pairs, `stairsExist`, `stairPos`, `lift`. Output: `{ ok, rooms: [{id, x, y, w, h}], unmet: [[a, b]] }`; deterministic (no randomness, stable sorts, strict-improvement comparisons).

1. **Core block** (`PC.layout.core`, also used by drawing, validation and the house model; identical on every level):
   stair 2.5 x 4.0 with its long side along the longer footprint axis; lift 1.5 x 2.0 beside it across the band. Position: Centre = centred, snapped down to 0.5 m; corners = flush in the named corner. **Q14 convention (binding on the house model A-9 and F4):** front = low y (street side), left = low x = low u = the left as seen **from the street looking into the plot**; so `fl` = (0, 0) corner, `br` = (W, D) corner. Guarded by an F3-T1 unit test.
2. **Cells**: the footprint is cut into bands across its longer axis by the core block: a band before the core, a band after it, and the two pieces of the core band beside the block. Pieces narrower than 1.5 m are dropped (they become hall). No stairs -> one cell, the whole footprint.
3. **Cell layout by column partitions**: rooms of a cell, in the global order, are split into consecutive groups; each group is a column across the cell and its rooms are stacked inside it. All `2^(n-1)` partitions and both column directions are evaluated. The cell's rooms are scaled by one factor `f`: `min(1.2, cellArea / sum)`, and additionally `f = 1` when the cell is under-filled; the cell is infeasible when `cellArea / sum < 0.8`. Each column has two thickness candidates: *full span* (`t = columnArea / crossSize`, rooms fill the cross dimension) and *square-ish* (`t = sqrt(largest room area x f)`, the stack is shorter than the cell and the rest of the column is hall). Full span is the thinnest; columns are upgraded to square-ish in order while the cell length allows and the aspect score improves. This is what keeps a large room from being stretched past 3:1 in an under-filled cell (CTO round-1 finding). A candidate is valid when every side is 1.5 m or more and no room exceeds 3:1. Shape score = sum of (aspect - 1) + 4 x |f - 1| x n; best per (cell, room subset) is memoised.
4. **Assignment**: depth-first search over room -> cell with capacity pruning; an assignment's score is the sum of its cell scores, minus 2 when a core-side cell stays empty (a hall beside the stair).
5. **Adjacency**: for the best 60 assignments, try the four mirror variants of each cell and count unmet pairs (two rectangles are adjacent when they touch within 0.02 m along 0.5 m or more); total score = shape score + 100 x unmet. First candidate with no unmet pairs at the best shape score wins.
6. **Orders**: order 1 is area descending (ties by id). If pairs remain unmet, a second run uses the same order with each paired room moved directly behind its partner; the better total wins.
7. Coordinates rounded to 0.01 m. Then one grid pass: all coordinates are snapped to 0.5 m and the snapped layout is kept **only if it still passes `check` and loses no shared wall** (unmet pairs not more than before; F3-T1), otherwise the unsnapped one stays. Whatever the rooms and core do not cover is hall.
8. **Retry on failure only (F3-T2):** when no valid assignment exists with the cell scale range 0.8–1.2, steps 3–7 run once more with `PC.C.LAYOUT.retry` = 0.75–1.25 (F3-S1's 25 % rule is the bound); a retried result is kept only if `check` passes. Every first-pass success, the sample included, is unchanged.
9. No valid assignment -> `{ ok: false }`; the level stores `error: 'no-layout'` and stage 3 shows the message, which names the concrete fixes ("fewer or smaller rooms on this level, another stair position, or a larger footprint"), with a link to the room list (F3-S1). This happens mostly when a rectangle of the needed size genuinely cannot be placed around the stair (e.g. one 60 m2 room on the sample footprint).

`PC.layout.check(W, D, core, requestedRooms, rooms)` returns the list of violations (missing/duplicate room, outside footprint, overlap room-room or room-core beyond 0.011 m, side under 1.5 m, aspect over 3, area off by more than 25 %). The same function backs the generator tests, the "invalid on release" marking in the editor (overlap subset) and approval.

Numbers added by the TL (prototype choices, in `PC.C`): generator scale range 0.8–1.2; adjacency = 0.5 m shared wall; generated coordinates are on the 0.5 m grid only when that keeps the layout valid (step 7); the editor's neighbour-edge snapping (A-15) is what lets an edit restore a shared wall in either case.

## A-9. House model — the only hand-off from 2D to 3D

`PC.house.build(state)` (pure; callable only when stage 3 is valid) returns plain data, all horizontal coordinates in **L**, heights in metres above ground. `js/three/*` reads this object and nothing else from the state (the 3D layer never looks at `PC.store`).

```js
house = {
  v: 1, key: '<hash of the content, used to skip rebuilds>',
  center: [cu, cv], radius,                       // plot bbox centre in L and bounding radius
  plot: { pts: [[u, v], ...], area },
  northDeg,                                       // clockwise from +v
  footprint: { u, v, w, d },
  storeyH, pitch,                                 // Q8; pitch = storeyH + 0.2 (slab)
  levels: [ { id, name, index,                    // index -1 (basement), 0, 1, 2
              baseY,                              // index x pitch
              rooms: [ { id, name, type, u, v, w, d, area,
                         furniture: [ { kind, u, v, w, d, h, y0, color } ] } ],
              stair: null | { u, v, w, d }, lift: null | { u, v, w, d } } ],   // lowest level first
  roof: { type: 'flat' | 'pitched' | 'terrace', usable, baseY,      // usable + pitched -> 'flat'
          stairHead: null | { u, v, w, d }, liftHead: null | { u, v, w, d } },   // usable roof only
  exterior: 'sand' | ..., interior: { style, density },
  site: { entrance: { u, v, w },                  // door centre on the front wall
          parking: null | { u, v, w, d, cars, covered }, pool: null | { u, v, w, d },
          wall: bool, gate: null | { u, w },      // on v = 0
          seating: null | { u, v, w, d, along: 'u' | 'v' },   // benches parallel to the nearest facade
          trees: [[u, v, s], ...], shrubs: [[u, v, s], ...], vegPct,
          northMarker: { u, v, L } }
}
```

- Furniture: `PC.furnish.room(room, table, density)` places the Designer's pieces (A-11 table schema) against walls/corners/centre with 0.15 m clearance, scales a piece down to 60 % at most to fit, drops a piece that still does not fit or overlaps an earlier one. "Sparse" keeps only pieces flagged `sparse: true`. Every furniture box lies inside its room rectangle (unit-tested for all 10 types at S, M, L and at the 1.5 m minimum side).
- Vegetation: `PC.scatter.vegetation(site, seed)` with a mulberry32 PRNG seeded from the plot points: candidates on a jittered 1 m grid, inside the plot and 0.7 m from the boundary, outside footprint + 1 m, parking, pool clearance, the gate-to-entrance path strip and the seating pad. A tree counts 6 m2, a shrub 1.5 m2; 60 % of `veg.area` goes to trees. Caps: 120 trees, 200 shrubs. Unit test: covered area is within 20 % (relative) of `veg.area` on the sample and no item is inside an excluded rectangle.
- Gate: on the street edge at 25 % / 50 % / 75 % of its length (Left / Centre / Right, left as seen from the street), 3 m wide. Entrance: centre of the front wall. No gate without the wall (`PC.site.gateU`, PM round 10 Q7). Seating (`PC.site.seating`, F4-T2): 3 x 3 m pad, yards in the order back, wider side, other side, front; in each the position nearest the yard's middle on 0.5 m steps, inside the plot with 0.3 m to the edge, clear of footprint + 1 m, parking, pool + clearance and `PC.site.pathStrip` (2 m wide, street to door, widened to the gate); none fits -> `omitted` gets `'seating'` and validate adds the warning `seating-omitted` (q 17, PM round 10 Q8 text). The site memo key includes `extras`.
- Tests on the model replace WebGL checks: rooms match the approved plans in position and size, every level present, omitted site items absent, furniture counts sparse < full.
- **Storey convention (TL, F4-T1 plan review).** Storey k occupies `[baseY, baseY + pitch]`: the slab is its bottom 0.2 m, the floor is at `floorY = baseY + 0.2`, the next slab's underside at `floorY + storeyH` (Q8). The ground floor stands on a 0.2 m plinth; the basement floor is at `−pitch + 0.2` and its ceiling is the ground slab's underside at Y 0; `roof.baseY = (top index + 1) x pitch`.
- **F4-T2 plan review:** `roof.liftHead: null | { u, v, w, d }` (the lift on a usable roof, drawn as a 1.2 m block); `site.northMarker: { u, v, L }` (Designer needle, `L = clamp(0.06 x max bbox side, 1.5, 3)`, first clear corner front-left / front-right / back-left / back-right, never omitted); trees clear footprint + 1 m + canopy radius (1.55 m at the largest scale), shrubs footprint + 1 m. A separating state for the refusal exists: Q4 vegetation so that footprint + vegetation > 100 (`fp-veg-over`) leaves every plan fresh and stage 3 `valid` but not `reachable`.
- **Refusal (F4-T1 plan review):** `build` returns `null` unless `st[3].reachable && st[3].valid` (`st = PC.stages.status(state)`); it reads the approved plans and `PC.layout.core` only, never `generate` / `sync`. `key` = FNV-1a 32-bit hex of the model's JSON without `key` (metres only, so the unit toggle does not change it).

## A-10. 3D scene structure

Scene graph (names are asserted by tests):

```
scene
  lights        HemisphereLight "hemi", DirectionalLight "sun" (the only shadow caster) + its target
  world         Group, position (0, 0, 0); children use T coordinates
    ground      "groundOuter" large plane 0.05 m below the plot, "groundPlot" ShapeGeometry of the plot
                with the footprint as a hole, "groundCap" plane covering the footprint (hidden for basement view)
    level-B/G/1/2   Group per plan level: "slab" batch (floor slab + room tint quads), "walls" batch
                (exterior + partitions + stair + lift), "furniture" batch
    roof        Group, one batch (slab/parapet/pergola/stair head or gable prism); visible only when
                the Roof toggle is on and the level selector is "All"
    site        "siteBatch" (parking pads, canopy, pool rim, boundary wall, gate posts, seating, entrance step,
                north marker), "poolWater", InstancedMesh "trunks", "canopies", "shrubs"
    highlight   one mesh, the selected room outline (F5)
```

- `ShapeGeometry` lies in the XY plane: the `groundPlot` shape is drawn with shape coordinates `(X, -Z)` = `(u - cu, v - cv)` and the mesh is rotated -90 degrees about X (`rotation.x = -Math.PI / 2`), which maps shape y to -Z as frame T requires. `PlaneGeometry` meshes get the same rotation.
- Z-fighting offsets: room-tint quads 0.015 m above the slab, `groundCap` 0.01 m above `groundPlot`, `groundOuter` 0.05 m below it. The hall has **no quad**: the slab box's top face carries the hall tint (`BoxBatch.add` `topHex`, A-11), so there is one coplanar layer only (TL, F4-T1 plan review). The camera near plane follows the orbit radius (A-12) so 0.015 m holds at every zoom.
- F4-T1 shell: stair and lift are plain boxes of their core rectangles, 1.2 m high (wall height) on every level; the lift is not a full-height shaft (it would hide the floors behind it in "All"). Stepped stair optional in F4-T2.
- Roof on (F4-T2 plan review): the `roof` batch also carries the exterior wall bands of every above-ground level, from `floorY + 1.2` to `baseY + pitch`, so the roof sits on a closed exterior rather than floating over 1.2 m walls. Pitched roof: 30° gable, ridge along the longer side, no overhang, slopes `exteriors.roof`, gable triangles `exteriors.wall`. Boundary wall 1.2 m, gate posts 1.4 m (`trim`), no gate leaf; pool = flush opaque `poolWater` plane at Y 0.03 plus a 0.3 x 0.1 m rim.
- F4-T2 as built: flat roof = 0.2 m slab + 0.15 m parapet ring, 0.3 m high, 1.0 m when usable or terrace (`parapet`); terrace pergola over the back third (4 posts 0.15 m, 2.4 m, beams 0.1 m every 0.6 m, `roof`); usable roof: stair head 2.4 m and lift overrun 1.2 m over `roof.stairHead` / `roof.liftHead` (`parapet`). Furniture: one "furniture" batch per level group, a box per model piece from `floorY + y0`, colour = the model's Q18 hex. Site batch: wall segments centred 0.1 m inside each plot edge (`addSeg`), the 3 m street gap with two 0.4 x 0.4 x 1.4 m posts; seating = 0.05 m pad (`paving`), 0.9 m table 0.75 m high, two 1.6 x 0.45 x 0.45 m benches 0.9 m either side along `seating.along` (`seating`); north needle = two `addFlat` triangles 0.04 m high, width 0.35 L, N half `northMarker`, S half `poolRim`, corners from `PC.three.needle(house)` (T, doubles; N tip along `(sin N, -cos N)`). Meshes: sample 12, maximum house 18 (before F4-T3 vegetation). Constants in `PC.C.FURNISH`, `PC.C.ROOF`, `PC.C.SITE`.
- Dollhouse: no ceilings; exterior walls and partitions are 1.2 m high (0.15 m thick) in a storey of `storeyH`, so each floor reads from above and, in "All", lower floors are visible through the open band between wall tops and the slab above. Room type is shown by the floor tint (`PC.data.roomTints`); there are no per-room 3D labels (the selected/toured room name is an HTML caption).
- Level selector: "All" or a plan level `k` -> levels above `k` hidden. Basement: levels above hidden **and** `groundCap` hidden, so the pit (basement walls are in `level-B`) is seen from above. Roof toggle default off; finder and tour force it off.
- Renderer: `new THREE.WebGLRenderer({ canvas, antialias: true })`, `setPixelRatio(Math.min(devicePixelRatio, 2))`, `setSize(w, h, false)`, `shadowMap.enabled = true`, `shadowMap.type = THREE.PCFSoftShadowMap`, sun `shadow.mapSize.set(1024, 1024)`, `outputEncoding = THREE.sRGBEncoding`.
- Colour rule (one helper, `PC.three.col(hex)` = `new THREE.Color(hex).convertSRGBToLinear()`): every material, vertex and light colour goes through it, because r128 does no automatic colour management and the Designer's hex values are sRGB. Exception: `scene.background` takes the raw hex colour (in r128 the clear colour is not passed through the output encoding).
- Look tables (Designer, `js/data/look3d.js`, F3-T3; TL plan review of F3-T3). All colours are `#RRGGBB` upper case, sRGB. Every colour mix in the app (floor mix here, sky key interpolation and season blend in A-13) is one rule: **per-channel lerp of the 0–255 sRGB values, `Math.round` per channel**, done on hex before `PC.three.col`.
  - `PC.data.exteriors[sand|white|terracotta|grey]` = `{ wall, wallInner, slab, roof, trim, parapet }`: `wall` exterior walls; `wallInner` partitions (and any enclosure walls around stair / lift); `slab` slab edges and basement pit walls; `roof` roof slab, gable, pergola; `trim` entrance step, door reveal, gate posts; `parapet` parapets and the stair head.
  - `PC.data.interiors[modern|classic|minimal]` = `{ fabric, wood, accent, white, metal, dark, floorMix }`; `floorMix` is a number in [0, 0.3], the only non-colour key.
  - `PC.data.roomTints` = the 10 room types **plus `hall`, `stair`, `lift`**. Floor-tint quad of a room and the hall: `mix(roomTints[type or 'hall'], interiors[style].wood, interiors[style].floorMix)`. Stair and lift are not mixed: they use `roomTints.stair` / `.lift` as they are. So Q18 changes floor finishes as well as furniture, and Q18 still changes no geometry.
  - `PC.data.siteColors` = `{ ground, groundOuter, paving, poolWater, poolRim, boundaryWall, gate, carCanopy, seating, trunk, northMarker, highlight }`. `ground` is the build-time plot grass and equals `PC.data.sky.seasons.summer.ground` (test); `applyLook` replaces it with the season's `ground` later. `groundOuter` (outside the plot) is fixed and never seasonal. `gate` is for a gate leaf if one is drawn (posts use `exteriors.trim`). `highlight` is the F5 selection colour (= the 2D selection orange).
- Lifecycle: `PC.view3d.open(house, canvas)` shows "Building…", yields one frame, then builds only if `house.key` changed (dispose old geometries/materials first), else resumes with the same camera. If `typeof THREE === 'undefined'` or the renderer constructor throws -> in-page message, stage 5 stays without a canvas, stages 1–4 unaffected.
- Context loss: `webglcontextlost` on the canvas -> `preventDefault()`, stop the loop; `webglcontextrestored` -> rebuild from the current house model, mark dirty, restart the loop if stage 5 is active.
- Render loop: `requestAnimationFrame` is requested only while stage 5 is active **and** `document.visibilityState === 'visible'`; `close()` and `visibilitychange` cancel it. Inside the loop the frame is rendered only when something changed (camera moved, flight/tour running, look changed, resize). **Implemented on demand (TL, F4-T1 plan review):** `invalidate()` requests one frame only when active, visible, not lost and none pending; an idle view requests zero frames; flights and tours call `invalidate()` per frame.
- "Building…" yield: show the overlay, then `requestAnimationFrame(() => setTimeout(build, 0))` so the overlay really paints (a single rAF callback runs before that frame's paint); a token cancels the build if `close()` comes first.

Allowed r128 API surface (anything else needs TL approval, and the mock in A-16 throws on it):
`WebGLRenderer` (setPixelRatio, setSize, render, dispose, shadowMap.enabled/type, outputEncoding, domElement), `Scene` (background), `Group`, `Object3D` members (position, rotation, quaternion, scale, visible, name, userData, parent, add, remove, children, traverse, getObjectByName, castShadow, receiveShadow, frustumCulled, renderOrder, lookAt, updateMatrix, matrix), `Mesh` (geometry, material), `InstancedMesh` (setMatrixAt, instanceMatrix.needsUpdate, count), `PerspectiveCamera` (fov, aspect, near, far, updateProjectionMatrix), `DirectionalLight` (color, intensity, position, target, castShadow, shadow.mapSize, shadow.camera left/right/top/bottom/near/far + updateProjectionMatrix, shadow.bias, shadow.normalBias), `HemisphereLight` (color, groundColor, intensity), `BufferGeometry` (setAttribute, setIndex, computeVertexNormals, dispose), `Float32BufferAttribute`, `BoxGeometry`, `PlaneGeometry`, `CylinderGeometry`, `ConeGeometry`, `Shape` (moveTo, lineTo, closePath, holes), `Path`, `ShapeGeometry`, `MeshLambertMaterial`, `MeshBasicMaterial` (color, vertexColors: true, transparent, opacity, side, dispose), `Vector2` (x, y, set — F4-T1 addition, for `shadow.mapSize`), Euler via `object.rotation` (x, y, z only — F4-T1 addition), `Vector3` (x/y/z, set, copy, clone, add, sub, multiplyScalar, normalize, length, distanceTo, lerp), `Color` (r/g/b, set, setHex, copy, clone, lerp, convertSRGBToLinear), `Matrix4` (compose, makeTranslation, identity), `Quaternion` (identity, setFromAxisAngle), `CatmullRomCurve3` (points, getPoint, getPointAt, getLength, arcLengthDivisions, updateArcLengths; set `arcLengthDivisions` before the first length query, or call `updateArcLengths()` after changing it), constants `sRGBEncoding`, `PCFSoftShadowMap`, `DoubleSide`.
Call signatures the mock enforces (argument count and types): `Matrix4.makeTranslation(x, y, z)` three numbers; `new InstancedMesh(geometry, material, count)`; `new CatmullRomCurve3(points, closed, curveType, tension)`; `new Float32BufferAttribute(array, itemSize)`; `renderer.setSize(w, h, updateStyle)`.
Not used: anything under `examples/js`, `BufferGeometryUtils`, `CapsuleGeometry`, `outputColorSpace`, `Geometry`, `setColorAt`, textures, `Raycaster`, fog, post-processing.

## A-11. Mesh budget strategy (G6: 150 meshes or fewer for the maximum house)

- `PC.three.BoxBatch`: hand-written merge. `add(cx, cy, cz, sx, sy, sz, hex, topHex)` appends 24 vertices / 36 indices with normals and per-vertex colour (optional `topHex` colours the top face only: the slab's hall tint, F4-T1 plan review); `addQuad` and `addPrism` cover floor tints and the gable; `addSeg(x0, z0, x1, z1, thick, y0, y1, hex)` (an oriented box along a segment, e.g. the boundary wall) and `addFlat(pts, y0, y1, hex)` (an extruded convex polygon, e.g. the north needle) cover non-axis-aligned items (F4-T2 plan review); `build(material)` returns **one** `Mesh` with `MeshLambertMaterial({ vertexColors: true })`. No per-box meshes anywhere.
- Vegetation: three `InstancedMesh` objects (trunks = cylinder, canopies = cone, shrubs = low cone), one material each; season colour is a material colour change (no per-instance colour). All three have **`frustumCulled = false`**: r128 culls an `InstancedMesh` by the bounding sphere of its base geometry at the mesh origin, ignoring instances, so without this every tree would vanish (and drop out of the shadow pass) whenever the plot centre leaves the view. Asserted by a mock test (F4-T3).
- Count for the maximum house (4 plan levels, 32 rooms, full furniture, pool, 4 covered cars, all extras): 4 levels x 3 batches = 12, roof 1, ground 3, site batch 1, pool water 1, vegetation 3, highlight 1 = **22 meshes**. The G6 ceiling of 150 stays as the acceptance number; the test asserts 40 or fewer so regressions are caught early.
- Shadows: only `sun` has `castShadow`; batches cast and receive; vegetation casts, does not receive; ground receives only. Shadow camera is an orthographic box centred on the footprint with half-size `min(2.5 x footprint radius, 1.2 x house.radius)` (building plus yard; keeps texel size useful on large plots).
- Designer furniture table schema (`PC.data.furniture[type]`), consumed by `PC.furnish`:

```js
[ { id: 'bed', w: 1.8, d: 2.0, h: 0.5, y0: 0,          // metres; y0 = height above the floor
    anchor: 'back' | 'front' | 'left' | 'right' | 'bl' | 'br' | 'fl' | 'fr' | 'center',
    color: 'fabric' | 'wood' | 'accent' | 'white' | 'metal' | 'dark',   // keys of PC.data.interiors[style]
    sparse: true,                                       // true = also shown in "sparse"; always written (true / false)
    off: [a, b] } ]                                     // optional, metres; see the placement rule below
```
  Each room type has at least 1 `sparse` piece and at least 2 further full-only pieces; 8 pieces at most per type (32 rooms x 8 = 256 boxes, still one batch per level). Height cap: `y0 + h <= 1.1` m, below the 1.2 m cut walls (A-10), so nothing rises above the walls in the dollhouse view (F3-T3 ruling). `|a|, |b| <= 1.2`.
  **Placement rule** (binding on `PC.furnish.room` in F4-T2 and on the Designer's simulation in F3-T3; frame P, Q14 convention: front = low y, back = high y, left = low x seen from the street):
  1. Work in the room rectangle inset by 0.15 m on every side (the "inner rectangle"). Pieces are taken in table order (sparse: only `sparse: true` pieces, same order). A piece with `off` is listed after the piece it is placed around.
  2. Orientation: `back`/`front`, the four corners: `w` along x, `d` along y. `left`/`right`: `w` along y, `d` along x. `center`: `w` along the room's longer side; when `W >= D` (ties included) `w` along x, otherwise `w` along y.
  3. Position: edge anchors are flush with their wall and centred along it; corner anchors flush with both walls; `center` at the inner rectangle's centre. Then the offset is added: for every anchor except `center`, `a` is along +x (to the right) and `b` along +y (to the back). For `center`, `(a, b)` is along (w-axis, d-axis): `(+x, +y)` when `w` is along x, `(+y, -x)` when `w` is along y (the piece and its offset turn together by 90 degrees).
  4. Scale search: for `s` = 1.00, 0.95, …, 0.60, the footprint is `(w s, d s)` and the offset `(a s, b s)`; `h` and `y0` are never scaled. The first `s` at which the footprint lies inside the inner rectangle (1e-9) and overlaps no already placed piece by more than 0.01 m on both axes wins (touching is allowed). Both tolerances are compared with 1e-9 slack: inside = `>= lo - 1e-9` / `<= hi + 1e-9`, overlap = `min(hi) - max(lo) > 0.01 + 1e-9` on each axis, so an overlap of exactly 0.01 m in doubles (e.g. 2.86 − 2.85 = 0.0100000000000002) counts as allowed (TL, F3-T3 outcome review; QA F3-T3 obs 2). If none does, the piece is dropped.
  5. The result is converted to L by the footprint origin (`u = fp.u + x`, `v = fp.v + y`) for the house model.

## A-12. Camera controller

- Pose (pure, `PC.cam`): `{ target: [x, y, z], radius, theta, phi }` (theta = azimuth about Y, phi = angle from the vertical). `PC.cam.position(pose)`; `orbit(pose, dTheta, dPhi)`, `zoom(pose, factor)`, `pan(pose, dxScreen, dyScreen)`; `clamp(pose, limits)`; `lerpPose(a, b, k)` (shortest arc in theta, smoothstep).
- Limits from the house: phi in [5 degrees, 85 degrees]; radius in [4 m, 3 x house.radius]; target inside the plot bounding box and Y in [0, roof base]; after every update the eye height is forced to 1.0 m or more (phi is reduced if needed). The camera therefore never goes below ground, never flips, cannot leave the model.
- Input adapter (`three/camera.js`), Pointer Events on the canvas with pointer capture:
  one pointer drag = orbit; two pointers = pinch (distance ratio -> zoom) and pan (midpoint shift); mouse right button or Shift+drag = pan; wheel = zoom (`preventDefault`, passive false); `contextmenu` suppressed; keys on the focused canvas (`tabindex="0"`): arrows orbit, `+`/`-` zoom.
- "Reset view": target = model centre, theta 30 degrees off the street axis from the street side, phi 50 degrees, radius = `max(2.2 R, 1.05 R / sin(min(halfFovV, halfFovH)))` with R = house.radius and the canvas aspect, so a portrait phone frames the whole plot (TL, F4-T1 plan review). Radius limit `rMax = max(3 R, 1.2 x reset radius)`, so a reset pose is never clamped. Reset is recomputed on Reset, first open and plot change; a resize or rotation re-clamps the kept pose.
- Flights (F5): `PC.three.flyTo(pose, ms)` interpolates from the current pose; a new call restarts from the current interpolated pose (smooth redirect); any pointer/wheel/key input cancels flight and tour immediately.
- Camera: `PerspectiveCamera(45, aspect, 0.5, 20 x house.radius)`; aspect and renderer size updated by the resize observer. `near = max(0.5, 0.02 x pose.radius)` on every pose change (depth precision for the 0.015 m tint offset at full zoom-out; F4-T1 plan review).

## A-13. Time-of-day and season model

Pure function `PC.sky.compute(hour, season, northDeg, tables)` -> `{ sunDir: [x, y, z] (frame T, unit, pointing from the scene to the light), sunColor, sunIntensity, hemiSky, hemiGround, hemiIntensity, background, canopyColor, canopyVisible, shrubColor, groundColor }`.

- Sun path (visual approximation, labelled as such): `a = (hour - 6) / 12 x PI`. With north unit vector `n`, east `e` (n rotated 90 degrees clockwise) and up `y`: `s = e cos(a) + (y sin(E) - n cos(E)) sin(a)`, where `E` is the season's maximum elevation (`tables.seasons[s].elevMax`: summer 72, spring/autumn 52, winter 32 degrees). Sunrise at 6 in the east, noon towards the south at elevation `E`, sunset at 18 in the west. At night (`s.y < 0`) the light is the moon: direction `(-s.x, |s.y|, -s.z)`. The direction's Y is kept at 0.15 or more so shadows stay finite.
  Rotating north by 90 degrees rotates `sunDir` by 90 degrees about Y (unit-tested exactly: F4-S3).
- Colours and intensities are linear interpolations between hour key-frames of `PC.data.sky.keys` (Designer table: `{ h, background, sunColor, sunI, hemiSky, hemiGround, hemiI }`, first key h = 0, last h = 24, equal values), then blended with the season entry (`tint`, `tintAmount`, `canopy`, `canopyVisible`, `shrub`, `ground`). Night keys must keep `hemiI >= 0.25` so the model stays visible (test), and `sunI` at night at most a quarter of noon (test: "night is clearly dark").
- Season blend (TL ruling at the F3-T3 plan review; one rule, sRGB lerp as in A-10's look tables). Let `K` be the key-frame interpolation at `hour` (colours lerped per channel, numbers linearly) and `day = min(1, K.sunI / noonKey.sunI)`, where `noonKey` is the key with `h = 12`. Then `sunColor`, `hemiSky` and `background` = `mix(K.x, season.tint, season.tintAmount x day)`; `hemiGround` = `mix(K.hemiGround, season.ground, tables.groundBounce x day)` with `PC.data.sky.groundBounce` = 0.25 (a data value, so retuning stays data-only); intensities are the key values unchanged; `canopyColor`, `canopyVisible`, `shrubColor`, `groundColor` are the season's `canopy`, `canopyVisible`, `shrub`, `ground` as they are. The `day` factor keeps the season tint from lifting the night sky (without it a winter night background goes from L* 7 to L* 26). Summer has `tintAmount` 0 and is the untinted baseline. `compute` returns hex strings; `applyLook` converts them (`PC.three.col`, background raw).
- `PC.data.sky` = `{ keys: [...], seasons: { spring, summer, autumn, winter }, groundBounce }`; keys strictly increasing in `h`; a key at `h = 12` exists. Night keys are those with `h < 5` or `h > 20`.
- Winter: canopies hidden (bare trees = trunks only), shrubs and ground take the snow colours.
- `PC.three.applyLook(look)` writes light position (`target + sunDir x 2.5 x radius`), colours, intensities, `scene.background`, the three vegetation material colours, canopy visibility and ground material colour. Nothing is rebuilt and the camera is not touched.
- Session defaults: hour 12, season summer. Presets: morning 8, noon 12, evening 17.5, night 22.

## A-14. Room finder and drone tour

- Finder pose for a room: target = room centre at floor height + 0.5; theta = current theta; phi = 35 degrees; radius = `clamp(1.6 x max(w, d) + storeyH, 6, 3 x radius)`. Before flying: roof off, level selector = the room's level (basement opens the ground), highlight mesh moved to the room, caption shows the room name. Flight 1.2 s.
- Tour plan (pure, `PC.tourplan.build(house)`): ordered stops = overview, then for each level from the lowest every room in nearest-neighbour order starting from the previous stop, then overview again.
  - Eye point per room: horizontally 0.6 x max(w, d) + 2 m from the room centre towards the outside of the footprint (away from the footprint centre; a fixed street-side direction when the room is central); height = `max(level.baseY, 0) + storeyH + 2.5` — always above wall tops, and for basement rooms above ground. Basement rooms use a steeper, near-overhead eye point instead (horizontal offset 1.5 m from the room centre towards the footprint centre, height `storeyH + 4` above ground) so the pit wall does not hide the near side of the room.
  - Look point per room: room centre at `baseY + 0.5`.
  - Overview eye/look = the Reset-view pose.
  - Stop times: 4 s overview legs, 3.5 s per room at normal speed (sample: 14 rooms -> 57 s, inside 30–90 s); speed factors slow 0.6, normal 1, fast 1.8.
- Runtime (`three/tour.js`): two `THREE.CatmullRomCurve3(points, false, 'centripetal')` curves (eyes, looks) with `arcLengthDivisions = 20 x points`; progress `s` in [0, 1] is piecewise-linear in time through the stops; camera position = `eyes.getPointAt(s)`, with **Y clamped to 1.5 m or more** (CTO note: Catmull-Rom overshoots its control points); `camera.lookAt(looks.getPointAt(s))`. Current stop = last stop passed -> caption + level selector (levels above hidden; basement opens the ground). Pause freezes `s`; Stop or any gesture ends the tour and converts the current camera into an orbit pose (target = look point). Leaving stage 5 stops the tour; it never auto-restarts. Time/season changes go through `applyLook` and do not touch the tour.
- With one room the curve has 3 points (overview, room, overview); points closer than 0.5 m are nudged apart so the curve is always valid.

## A-15. UI architecture (2D stages)

- Shell: header (title, unit toggle), stepper (5 steps), stage container, bottom bar (Back / Next), dialog layer, banner slot. Stages are `<section data-stage="n">`; exactly one is visible. All stage markup is static in `src/index.html` (Designer); controllers fill templates and toggle state classes (`is-current`, `is-done`, `is-locked`, `is-invalid`, `is-approved`, `is-collapsed`). State is carried by native/ARIA attributes first (`hidden`, `disabled`, `aria-disabled`, `aria-selected`, `aria-expanded`, `aria-invalid`, `:checked`); collapsibles use `is-collapsed` on the panel plus `aria-expanded` on the toggle. Choice controls carry `value`s equal to the A-4 state values, so controllers need no mapping. The action bar's Next label is set per stage ("Build 3D model" on stage 4; hidden on stage 5).
- Each stage controller exposes `enter()`, `leave()`, `render(state)`; it subscribes to the store and re-renders from state (no hidden UI state except transient gestures).
- `PC.ui.View2D` is shared by the plot grid, the Q5/Q6 site preview and the plan editor: world-to-screen transform (scale, offset, y flipped), DPR-aware canvas, gesture recogniser (tap = pointer up within 8 px and 700 ms; one-pointer drag; two-pointer pinch/pan; wheel zoom about the cursor; drag on empty space pans), callbacks `onTap`, `onDragStart/Move/End`, `hitTest` supplied by the stage. Hit radius for handles: 22 px (44 px target).
- Site preview (stage 2): `View2D` option `locked` (no pan, pinch, wheel zoom or view keys; taps, `hitTest` and handle drags work; the wheel event is not consumed). Edge-class labels follow the `edgeLabels` culling, except that the street edge always carries "front" (it is the bottom edge, with free padding under it). On phones in portrait (below 600 px wide, at least 481 px high) the legend is a one-line strip under the canvas, not an overlay (Designer change, F2-T2 round 2): canvas 176 px + strip about 24 px = preview box of 200 px or more. This is the single exception to the F1-T1 rule "every stage canvas is 200 px or more in both directions"; the check there is canvas >= 176 px, preview box >= 200 px, strip not overlapping the canvas (the old overlay left only about 140 px of drawable height, so the drawing gained, not lost). All other canvases keep the 200 px rule.
- Edge tap mode (F2-S4, F2-T3): the preview's `site-tap-mode` radios decide what an edge tap does: `street` (default, Q6 as before) or `class` (`toggleEdge` through `propose`; a tap on the street edge only shows a toast). The mode is session state, reset to `street` by a whole-state replace and each time stage 2 is entered. The street edge and every overridden edge are always labelled (forced only as a last resort, never over the tap-mode control, the compass or the collapse toggle). Overridden edges are labelled with `*`. The keyboard and no-canvas alternative is the per-edge list `q-edges` in the Q6 block (one switch button per non-street edge). The drawing keeps clear of the mode control, the compass and the collapse toggle (8 px touch margin). Forced labels are placed before the footprint-area label and never overlap another label when a free spot exists. In short landscape (640x360) the tap hint is not rendered (the selected segment shows the mode; the edge list explains `*`), so both modes draw at the same scale.
- Sliders (F2-T2): the transient value under the user's finger lives in the controller until the gesture ends; the gesture ends on `change` **or** on pointer up / cancel / blur without a `change` (Chrome sends no `change` when a slider is released on its starting value), after which the control renders from state again.
- Plan view (stage 3, F3-T1; margin 0.5 m from F3-T2): fitted to the footprint plus a 0.5 m margin (the plot shows around it; pan, zoom and `plan-fit` reach the rest), pad 12 px top and bottom, side pad only where the plan would reach under `plan-fit`.
- Fit control: the two zoomable canvases carry a floating "Fit view" icon button at the top right (`plot-fit` in stage 1, `plan-fit` in stage 3) that re-fits the view; labels avoid it like the scale chip. The stage 2 site preview is always auto-fitted, takes no pan or zoom gestures (taps and the compass drag only) and has no fit button.
- Plan-editor snapping (pure, `PC.plans.snapEdge`): a moving edge (each edge of a dragged room, or the resized edge) snaps first to a parallel edge within 0.3 m of: another room whose edge span overlaps the moving edge's span widened by 0.3 m at each end (a neighbour, not an alignment across the floor; F3-T2 plan review), the core block, or the footprint; only when none is in range does it snap to the grid (0.5 m, or 1 ft = 0.3048 m in ft mode, measured in frame P). This lets an edit restore a shared wall even though generated edges and the ft grid do not coincide.
- Stepper states: current, done (valid **and** already visited in this session), locked, and plain "available" (reachable, not yet visited; no state class). `PC.stages` lives in `core/stages.js`.
- The banner slot is for shell-level notices only (currently "This stage is not built yet: static preview", shown for any stage without a registered controller). Stage messages use the stage's own message lines, summary and warning lists, so no product banner ever takes height from a stage.
- In-page dialog (`PC.ui.dialog.confirm({ title, text, ok, cancel })` -> promise), Esc = cancel, focus returns to the opener. It is the confirm handler given to `PC.store`.
- Units: controllers display through `PC.units` only; numeric inputs are `type="text" inputmode="decimal"` and convert to metres on commit.

## A-16. Test strategy

One command: `node tests/run-all.mjs` (flags `--unit`, `--three`, `--e2e`, `--qa` run a subset; build and lint always run). Browser files (e2e specs and QA runners) run three at a time. **The full run is mandatory at the Tech Lead's implementation review and at QA sign-off.** Runner flags: `--unit`, `--three`, `--e2e`, `--qa` choose steps; `--only a,b` keeps the browser files whose name contains one of the words; `--jobs N` sets how many browser files run at once (default 3 since F4-T2: two green full runs at 3, 366.9 s and 384.9 s, TL F4-T1 outcome review). **Full-run target ≤ 420 s at the default, hard limit 600 s.** A flake at 3 is fixed in its spec (no fixed sleeps), never by falling back to 2; it is reported in the status line. For the inner loop a task uses the focused run, e.g. `node tests/run-all.mjs --unit` (build, lint, unit), `node tests/run-all.mjs --unit --e2e --only plot,shell`, `node tests/run-all.mjs --qa --only f1-t3`; each task plan names its words. Because files run in parallel, **no browser test may depend on a fixed sleep to wait for UI** (dialogs, toasts, stage changes): helpers wait for the element's state with a timeout. If the full run passes about **10 minutes** (CTO, F2 feature review; was 15), QA trims overlap between `tests/e2e` and `tests/qa` in that task's QA round, keeping each check in one place with a comment; nobody skips the run. The full run executes, in order, and exits non-zero on any failure:

| Step | What | How |
|---|---|---|
| 1 build | `node build.mjs` | must succeed |
| 2 lint | `tests/lint-constraints.mjs` | forbidden tokens of A-3 in `src/` and `dist/`; layer rules of A-2 (core files free of `window/document/THREE`; three files free of top-level `THREE`); exactly one external URL |
| 3 unit | `tests/unit/*.test.mjs` with `node --test` | `tests/helpers/load.mjs` evaluates the manifest's `core` + `data` files in a bare `vm` context (no `window`, no `document`) and returns `PC`. A core file touching the DOM fails by itself |
| 4 three | `tests/three/*.test.mjs` with `node --test` | loads core + data + `three` files in a `vm` context with `THREE` from `tests/three-mock.js`, a stub canvas and a controllable `requestAnimationFrame`; asserts scene structure, mesh counts, visibility rules, light/shadow settings, pixel-ratio cap, loop start/stop, camera clamps, tour path properties |
| 5 e2e | `tests/e2e/*.spec.mjs` (plain node scripts) | playwright from `/opt/npm-tools/node_modules/playwright` (`createRequire`), `chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })`, page = `file://…/dist/index.html`. The cdnjs request is intercepted with `page.route`: **aborted** in 2D suites (also proves the "3D unavailable" path) and **fulfilled with `tests/three-mock.js`** in stage-5 suites. Viewports: 360x640 touch, 768x1024 touch, 1280x800 mouse. Every suite fails on any `pageerror` or `console.error`; the single exception is the "failed to load resource" message whose URL is exactly the three.js tag, in suites that abort it |

- `tests/three-mock.js` (UMD: `module.exports` in node, `window.THREE` in the browser; `REVISION = '128'`): implements exactly the API surface listed in A-10. Every instance and the namespace itself are wrapped in a `Proxy` that **throws on reading or writing any member not on the whitelist**, and constructors throw on unknown option keys (e.g. `outputColorSpace`, `vertexColors: THREE.VertexColors`). It also enforces the call signatures listed in A-10. Maths classes (`Vector3`, `Color`, `Matrix4.compose`, `CatmullRomCurve3`) compute real values; geometries record their parameters and vertex counts; the renderer records calls. Mock rules approved at the F4-T1 plan review: reads of `then` / `toJSON` return `undefined` (writes throw); `renderer.render` audits colours (every material / light colour must come from `convertSRGBToLinear`, a material's untouched default white counts as converted; `scene.background` must be raw); `Mesh` needs both arguments; `setAttribute` only `position` / `normal` / `color` with equal counts; `setIndex` in range; test-only side channel `globalThis.__threeMock` (lint `mock-backdoor`: never named in `src/`); `view3d-real.spec` checks every whitelisted member exists on real r128 and the maths agree. Created by FS as the **first step** of F4-T1 and reviewed at that task's plan review; any later addition to the whitelist must cite the r128 documentation name in the task's plan and be approved in the TL plan review.
- Mandatory tests named by this document: 6.2 sample numbers (A-6), fallback footprints (A-6), signature invariance for appearance inputs (A-7), generator on sample + maximum level + determinism (A-8), house-model/plan equality and furniture containment (A-9), mesh budget and single shadow light (A-11), no frames requested while hidden (A-10), north rotation (A-13), tour height and coverage (A-14), draft round-trip + corrupted + `localStorage` throwing (A-4).
- The UI contract is machine-readable in `tests/contract/hooks.json` and `tests/contract/values.json` (moved there from the F1-T1 verify folder in F1-T2); `tests/e2e/contract.spec.mjs` checks the built page against them, and any task that changes markup updates them in the same change.
- QA's own suites live in `tests/qa/` (independent of the developers' tests); `tests/run-all.mjs` runs every `tests/qa/run-*.mjs` as a final step (flag `--qa`), so one command still runs everything.
- Each task adds its tests in the same change; QA extends them. A task is not review-ready unless `node tests/run-all.mjs` passes.
- **Real r128 in tests (environment fact, CTO F3 review H2, 2026-11-21).** cdnjs.cloudflare.com is blocked here, but registry.npmjs.org is reachable and headless Chrome renders r128 on SwiftShader (real WebGL 2). `three@0.128.0` `build/three.min.js` is vendored as `tests/vendor/three-r128.min.js` (MIT header kept; tarball sha512 and the `npm pack three@0.128.0` refetch steps recorded next to it; created by FS in F4-T1). Tests fulfil **only the exact A-1 cdnjs URL** with that file through `page.route`; the app, `src/index.html`, `dist/index.html` and `build.mjs` never reference `tests/vendor/` (lint: exactly one external URL; dist size check). `tests/e2e/view3d-real.spec.mjs` (≤ 30 s, 360x640 touch dpr 3 and 1280x800) asserts no page errors / console errors / `THREE.` warnings, a non-blank canvas, pixel ratio ≤ 2, draw calls within G6, the A-10 colour rule end to end (a `MeshBasicMaterial` quad with `PC.three.col(hex)` reads back as `hex` ± 2 per channel), context loss + restore, and no frames while hidden; it saves screenshots per exterior (F4-T3: per season and at 22 h). **The mock stays mandatory** for every `tests/three/*` test and remains the API guard (real r128 silently accepts members A-10 does not allow). SwiftShader timings are not phone performance (G6 stays count-based), touch stays emulated, and the hosted iframe / CSP / real GPU still need the real-device check.
- What cannot be tested here (the hosted sandbox iframe and its CSP, a real mobile GPU, real touch, smoothness, phone performance) is checked on the hosted page. **Publishing points (CTO decision): `dist/index.html` is published at the end of F1** (sandboxed iframe, CSP with per-file inline scripts, `localStorage` behaviour, touch gestures on a real phone; findings return as bugs on the relevant F1 task) **and again right after F4-T1** (first real WebGL), then at the F4 and F5 feature reviews.
- The TL personally runs and inspects the first build output of F1-T1 (the Designer creates `build.mjs` from A-17).

## A-17. Reference `build.mjs` (F1-T1 creates the file from this)

```js
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url)), src = join(root, 'src');
const read = f => readFileSync(join(src, f), 'utf8');
const man = JSON.parse(read('manifest.json'));
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [relative(src, join(d, e.name))]);
const listed = new Set([...man.css, ...man.js.map(j => j.file)]);
const stray = [...walk(join(src, 'css')), ...walk(join(src, 'js'))].filter(f => !listed.has(f));
if (stray.length) { console.error('Not in manifest: ' + stray.join(', ')); process.exit(1); }
const css = man.css.map(f => `/* ${f} */\n${read(f)}`).join('\n');
const js = man.js.map(j => `<script>/* ${j.file} */\n${read(j.file).replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
let html = read('index.html');
if (!html.includes('<!--@CSS-->') || !html.includes('<!--@JS-->')) { console.error('Markers missing in src/index.html'); process.exit(1); }
html = html.replace('<!--@CSS-->', () => `<style>\n${css}\n</style>`).replace('<!--@JS-->', () => js);
const ext = html.match(/(?:src|href)\s*=\s*["']https?:[^"']+/g) || [];
if (ext.length !== 1 || !ext[0].includes('cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')) { console.error('External references: ' + ext.join(' | ')); process.exit(1); }
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'index.html'), html);
console.log(`dist/index.html ${(html.length / 1024).toFixed(1)} kB, ${man.js.length} scripts, ${man.css.length} stylesheets`);
```

## A-18. Task map (15 tasks; details in the feature plans)

| Task | Assignee | Scope | Stories |
|---|---|---|---|
| F1-T1 | Designer | Design system, responsive shell, static markup of all five stages, icons, 2D palette, build script | F1-S4 (visual), R2, R3 |
| F1-T2 | FS | Namespace, store, stage gating, draft autosave, dialogs, sample loader, test runner + lint | F1-S4, F1-S5 |
| F1-T3 | FS | Geometry core, units, View2D, plot drawing/measuring/editing | F1-S1, F1-S2, F1-S3 |
| F2-T1 | FS | Site model, footprint + fallback, levels, validation, signatures and R5 gate (pure) | F2-S3 (logic), 3.1–3.3, R5 |
| F2-T2 | FS | Questionnaire Q1–Q10, Q15–Q17, site preview, live summary and conflicts, R5 dialog | F2-S1, F2-S3 |
| F2-T3 | FS (+ Designer pre-step) | Edge-class overrides, 3:1 narrow-plot footprints (increment 1); rooms, sizes, pairs, stairs/lift, level removal (increment 2) | F2-S4, F2-S2, 3.1 round 4 |
| F3-T1 | FS | Layout generator, plan sync, stage 3 tabs and plan drawing | F3-S1 |
| F3-T2 | FS | Plan editor, approval, regenerate, interior stage wiring | F3-S2, F3-S3, F3-S4 |
| F3-T3 | Designer | 3D look tables (exteriors, interiors, room tints, furniture, sky/season), stage 4 visual hints | F3-S4 (hint), data for F4-S1/S3 |
| F4-T1 | FS | THREE mock, house model, renderer/loop/fallback, shell, level selector, basement, camera | F4-S2, F4-S1 (shell) |
| F4-T2 | FS | Roof, furniture, outdoor items (parking, pool, wall, gate, seating), north marker | F4-S1 (rest except vegetation) |
| F4-T3 | FS | Vegetation (scatter + instanced meshes), time of day and season, final G6 budget test | F4-S1 (vegetation), F4-S3, G6 |
| F5-T1 | FS | Room finder | F5-S1 |
| F5-T2 | FS | Drone tour | F5-S2 |
| F5-T3 | Designer | Presentation and device pass over all stages, look-table tuning | G4, R2, F4-S2 (overlay), F5 presentation criteria |
