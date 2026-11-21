# F2-T1 implementation plan — site model, validation, signatures, R5 gate (FS)

Scope per `F2-plan.md` F2-T1: pure logic only, no UI. Stories and rules: F2-S3 (logic), PM 3.1, 3.2, R5, the 6.2 numbers. Binding: A-2, A-4, A-5, A-6, A-7 (round 2: signature = footprint `[w, d]` + resolved street edge), CTO review rounds 1–2.
Everything below is core layer: no DOM, no timers, runs in node. All geometry is in frame L (A-5) unless stated.

## 1. Files

| File | Namespace | Responsibility |
|---|---|---|
| `src/js/core/geom.js` (extend) | `PC.geom` | `segRectDist(a, b, r)`, `segHitsRect(a, b, r)`, `rectInPoly(r, pts)`, `rectsOverlap(r, s)`; rectangles are `{ u, v, w, d }`. |
| `src/js/core/levels.js` (new) | `PC.levels` | Plan levels, stairs/lift presence, room areas and names, needed area. Single owner of the level list. |
| `src/js/core/site.js` (new) | `PC.site` | `analyse(state)` (memo), edge classes, buildable mask, `rectFits`, vegetation budget. |
| `src/js/core/site-footprint.js` (new, see Q1) | `PC.site.footprint` | Footprint algorithm A-6 steps 1–7 incl. the fallback. |
| `src/js/core/site-outdoor.js` (new, see Q1) | `PC.site.parking`, `PC.site.pool` | Parking and pool placement. |
| `src/js/core/signature.js` (new) | `PC.sig` | `level(state, id)`. |
| `src/js/core/validate.js` (new) | `PC.validate` | Blocking and warning lists from one rule table, summary numbers, Q9 normalisation helper. |
| `src/js/core/store.js` (edit) | `PC.store` | Real `propose` gate; cancel notification; `r5Confirmed` reset. |
| `src/js/core/stages.js`, `draft.js`, `src/js/ui/start.js` (edit) | | `PC.stages.levelIds` is **deleted**; its three callers use `PC.levels.ids`. |
| `src/js/main.js` (edit) | | `PC.debug.site()` via `Object.assign`. |
| `src/manifest.json` | | Order: `ns, const, units, geom, plot, frames, levels, site, site-footprint, site-outdoor, signature, validate, store, stages, draft, sample`. |
| `tests/unit/levels.test.mjs`, `site.test.mjs`, `footprint.test.mjs`, `validate.test.mjs`, `signature.test.mjs` (new); `geom`, `stages`, `draft`, `store`, `sample` tests (extend) | | Section 8. |

`PC.sample` needs no data change; a test now proves it validates with no warnings.

## 2. Levels (`PC.levels`)

| Function | Result |
|---|---|
| `ids(state)` | `['B']` if basement, then `G`, `1`, `2` up to `floors`. The only implementation. |
| `name(id)` | From `PC.C.LEVEL_LABEL` ("Ground floor", ...). |
| `stairsExist(state)` | `ids.length + (usableRoof ? 1 : 0) >= 2` (3.2). |
| `liftExists(state)` | `stairsExist && ans.lift`. |
| `roomArea(room)` | `area` when exact, else `PC.C.ROOM_SIZE[type][size]`. |
| `roomsOn(state, id)` | Rooms of the level, in list order. |
| `roomNames(state)` | `{ id: name }`: per level and type in list order; a single room of its type has no number; the master is "Master bedroom" and is not counted in the bedroom numbering (so the sample's first floor reads Master bedroom, Bedroom 1, Bedroom 2, Bathroom 1, Bathroom 2). Never stored. |
| `needed(state, id)` | Room areas + 10 if stairs exist + 3 if the lift exists. |

## 3. Site model (`PC.site.analyse(state)`)

Returns `null` while the plot is not closed; otherwise the A-6 object:
`{ edge, frame, ptsL, plotArea, perimeter, edgeClass[], setbackOf[], buildable: { area, bbox: { u0, v0, u1, v1 }, ok }, footprint: null | { u, v, w, d, area, pct, clamped, moved }, noFit, parking, pool, veg: { area, pct, reduced }, omitted[] }`.
`edge` = `PC.frames.streetEdge(state)`. Memo: last 4 results keyed by a string of points, edge, setbacks, footprint %, vegetation %, parking and pool answers (the gate compares the current and the candidate state, so one slot is not enough).

**Tolerances (all in one place, `PC.site.T`):** general `1e-9`; `rectFits` `1e-6`; mask lattice `0.25 m`; candidate centres `0.5 m`; bisection 20 steps; `floor05(x) = floor((x + 1e-9) / 0.5) * 0.5`.

1. **Edge classes.** Front = street edge. For every other edge with direction `(du, dv)` the outward unit normal is `(dv, -du) / len` (polygon is counter-clockwise); **back** when `normal.v >= cos(40 deg) - 1e-9` (exactly 40 degrees is back), else **side**. `setbackOf[i]` = Q2 value of the class. Checked cases: sample (front, side, back, back, side; angled edge at 26.6 degrees = back), a 45-degree chamfer = side, a 40-degree edge = back, 40.5 degrees = side.
2. **Buildable set** (definition): inside the plot and at least `setbackOf[i]` away from every edge *segment*.
3. **Mask.** Nodes at multiples of 0.25 m over the plot bounding box. Per row the inside intervals come from the polygon's scan-line crossings; an inside node is "in" when its squared distance to every edge with a setback over 0 is at least `(setback - 1e-9)^2` (edges whose box grown by the setback misses the node are skipped). `bbox` = min/max of the in-nodes; `area` = cells whose centre is buildable x 0.0625; `ok = area >= 20`. The mask is kept (bit array + origin) for the fallback.
4. **`rectFits(site, rect)`**, exact: (a) centre inside the plot, (b) no plot edge hits the rectangle shrunk by `1e-6`, (c) `segRectDist(edge, rect) >= setback - 1e-6` for every edge.
5. **Footprint** (A-6 steps 1–7):
   - `!buildable.ok` -> `footprint = null` (conflict `buildable-small`).
   - Target `A = footprintPct / 100 * plotArea`; `Wb x Db` and centre `c` from `buildable.bbox`; `r = clamp(Wb / Db, 0.5, 2)` (the 2:1 cap); `w0 = max(0.5, floor05(sqrt(A * r)))`, `d0 = max(0.5, floor05(sqrt(A / r)))`.
   - `fit(centre)`: largest `t` in (0, 1] for which the `t`-scaled rectangle passes `rectFits`; `t = 1` tried first, else bisection; 0 when the centre itself fails.
   - Centred: `t = 1` -> `w0 x d0`, `clamped = false`. `t < 1` and `t^2 * w0 * d0 >= A / 2` -> shrunken, `clamped = true`.
   - Otherwise **fallback**: mask nodes on multiples of 0.5 m, sorted by distance from `c` (ties: lower v, then lower u). Running best `t` starts from the centred result; a candidate is first tested at `best + 1e-6` and skipped when that fails, else bisected; only strict improvement replaces the best. Stops early at `t = 1`. Result `moved = true`, `clamped = t < 1`.
   - After any shrink: width and depth floored to 0.5 m again about the chosen centre. `u, v` = centre minus half size.
   - Final area under 20 m2 -> `footprint = null`, `noFit = true` (conflict `no-fit`).
   - `pct = area / plotArea * 100`. Rounding alone never sets `clamped`.
6. **Parking** (`cars > 0`, footprint exists): rectangle `cars * 2.5` along u by 5.0 along v, inside the plot, not overlapping the footprint. Candidates, first fit wins: (i) `v = 0.5` right-aligned with the footprint's right side, (ii) `v = 0.5` left-aligned, (iii) scan `v = 0.5, 1.0, ...` while `v + 5 <= footprint.v`, and for each `u` across the plot bounding box in 0.5 m steps, (iv) side yards at `v = 0.5`: right of the building first (`u >= footprint.u + footprint.w`, scanning outward), then left; these may pass the front wall line. None -> `parking = null`, `omitted` gets `'parking'`.
7. **Pool** (`on`, footprint exists): size from `PC.C.POOL`; long side along u behind the building, along v beside it. Its clearance rectangle (pool grown by 1 m) must be inside the plot and must not overlap the footprint or the parking. Candidates: centred behind the footprint with the clearance touching the back wall, then a 0.5 m scan of the back yard (nearest to the building first), then the right side yard, then the left. None -> `omitted` gets `'pool'`.
8. **Vegetation.** `veg.area = min(vegPct / 100 * plotArea, plotArea - footprint - parking - pool)` over placed items; `reduced` when the second term wins; `veg.pct` from the area.

## 4. Conflicts and warnings (`PC.validate`)

`PC.validate(state)` -> `{ blocking: [...], warnings: [...], summary }`; `PC.validate.blocking(state)` is what `PC.stages` already calls. Each item: `{ code, q, level, text }`. Results are cached per state object and `invalidFields` content. All texts and numbers go through `PC.units` in the current unit (R4). One table drives everything:

| Code | Kind | Q | Condition | Text (pattern) |
|---|---|---|---|---|
| `field-invalid` | block | field's Q | an entry in `PC.store.session.invalidFields` (A-4: the value never reached the state) | "{label}: enter a number from {min} to {max} {unit}." |
| `floor-empty` | block | 11 | an above-ground plan level without rooms | "{Level} has no rooms: add a room there or reduce the number of floors." |
| `basement-empty` | block | 11 | basement on, no room on `B` | "The basement has no rooms: add a room there or switch the basement off." |
| `buildable-small` | block | 2 | `!buildable.ok` | "Buildable area is {a} (minimum {20}): reduce the setbacks or redraw the plot." |
| `no-fit` | block | 2 | `site.noFit` | "The building does not fit this plot: reduce the setbacks or redraw the plot." |
| `fp-veg-over` | block | 3 | `footprintPct + vegPct > 100` | "Footprint {x} % + vegetation {y} % is more than 100 %: lower one of them." |
| `level-over` | block | 11 | `needed > available + 1e-6` on a level (only when a footprint exists) | "{Level}: needs {n}, {a} available. Remove or shrink rooms, or raise the footprint %." |
| `fp-clamped` | warn | 3 | `footprint.clamped` | "The building was reduced to fit inside the setbacks: {a} ({p} % of the plot)." |
| `veg-reduced` | warn | 4 | `veg.reduced` | "Vegetation was reduced to what fits: {a} ({p} %)." |
| `parking-omitted` | warn | 15 | `'parking'` in `omitted` | "Parking does not fit between the building and the street: it is left out of the 3D scene." |
| `pool-omitted` | warn | 16 | `'pool'` in `omitted` | "The pool with its 1 m clearance does not fit behind or beside the building: it is left out of the 3D scene." |

- Nothing is clamped silently: the only "warn and adjust" cases are the four warnings, and each shows the effective figure. Blocking conditions clear by recomputation (no stored flags).
- `level-over` numbers are whole in the current unit; when both round to the same number one decimal is shown, so the message can never read "needs 143, 143 available".
- `summary = { plotArea, buildableArea, footprintArea, footprintPct, vegArea, vegPct, levels: [{ id, name, needed, available }] }` (metres; the UI formats).
- `PC.validate.normaliseRoof(ans)`: when `usableRoof` and `roofType === 'pitched'`, sets `'flat'` and returns `true` (the caller shows the inline note; F2-T2).
- With an open plot `PC.validate` returns empty lists and a null summary (stage 1 is the blocker).

## 5. Signature (`PC.sig.level(state, id)`)

`'invalid'` when the plot is not closed, the level does not exist or the footprint is null; otherwise `JSON.stringify` of
`{ fp: [w, d, edge], core: stairsExist ? [stairPos, liftExists ? 1 : 0] : 0, rooms: [[id, type, areaM2], ...], pairs: [[a, b], ...] }`
with rooms of that level sorted by `PC.store.cmpId`, pairs of that level sorted the same way. Not in it: footprint position, names, master, every appearance answer.

## 6. The R5 gate (`PC.store.propose(mutator)`)

1. Build the candidate (clone + mutator). Identical to the current state -> resolve `true`, nothing happens.
2. `affected` = levels that have a plan **which is valid now** (`plans[id].sig === PC.sig.level(current, id)`) and whose signature differs in the candidate (including levels the candidate removes). A plan that is already stale will be regenerated anyway and never triggers the question (Q3 below).
3. `affected` empty, or `session.r5Confirmed`, or no confirm handler set -> commit, resolve `true`.
4. Otherwise call the handler with `{ title: 'Regenerate floor plans?', text: 'Floor plans for {level names} will be regenerated. Manual room edits and approvals on those levels will be lost.', ok: 'Continue', cancel: 'Cancel', levels: [...] }`.
   - **Continue**: `r5Confirmed = true`, commit, resolve `true`. Further layout changes in the same visit apply without asking.
   - **Cancel**: no commit; the state object is the same one as before (deep-equal and identical). Subscribers are notified once with `meta.cancelled = true` and the unchanged state, so every controller re-renders and the old value reappears without special code. Resolve `false`.
5. Proposals are serialised (a second one waits for the first answer and is evaluated against the then-current state).
6. `r5Confirmed` is cleared by `PC.store.go(3)` (entering stage 3) and by `replace`.
- The gate does not regenerate anything: plans simply become stale by signature; `PC.plans.sync` (F3-T1) regenerates on entering stage 3. `commit` is unchanged and ungated: a unit test proves that Q1, Q4, Q5, Q8, Q9, Q10, Q15, Q16, Q17, Q18, Q19 never alter any signature.

## 7. Performance bounds

| Case | Work | Bound asserted |
|---|---|---|
| Mask, 100 x 100 m, 12 edges | 160 801 nodes + 160 000 cell centres, each against at most 12 segments (interval and box pre-filters) | part of the total below |
| Fallback | at most about 40 000 candidates, one `rectFits` each (12 `segRectDist`), bisection only on improvement | part of the total below |
| `analyse`, 12-vertex concave plot filling 100 x 100 m, first call | | under 500 ms in node (test), expected well under 150 ms |
| `analyse`, same inputs again | memo hit | under 1 ms |
| `validate`, `sig.level` | reuse the memoised site | negligible |

## 8. Tests (node, `tests/unit/`)

**`site.test.mjs` — the 6.2 sample, exact (mandatory):** plot area 584; perimeter 96.94; classes front / side / back / back / side; setbacks 3, 2, 2, 2, 2; buildable bbox u 2–18, v 3–28; buildable area 389.5 +/- 1.5 and `ok`; footprint exactly `{ u: 5.25, v: 8, w: 9.5, d: 15 }`, area 142.5, `pct` 24.4 (1 decimal), `clamped` false, `moved` false; needed 120 and available 142.5 on `G` and `1` (hall 22.5); parking placed 5 x 5 m inside the 8 m front yard; pool 6 x 3 m placed behind with its clearance inside the plot and clear of the building; vegetation 146 m2, not reduced; `omitted` empty; `PC.validate(sample)`: no blocking, **no warnings**; summary figures. Plus: edge-class angle cases of section 3.1; a zero setback; independent buildable check of 200 lattice nodes against the definition written a second time in the test.
**`footprint.test.mjs`:** rounding alone gives no clamp; a narrow plot gives `clamped` with the effective area; L-shaped and U-shaped plots whose bounding-box centre is not buildable -> fallback, `moved`, and all four corners plus 20 seeded interior points satisfy the buildable definition; a plot where nothing of 20 m2 fits -> `no-fit`; buildable under 20 -> `buildable-small`; the sample rotated by 30 degrees (street edge not axis-aligned) gives the same `w`, `d`, area and classes; the 2:1 cap on a long thin plot; determinism (same input twice, memo cleared); the timing bound.
**`site.test.mjs` outdoor part:** default 1 car on a 20 x 20 m plot with a 5.25 m front yard lands in the side yard, not omitted; parking omitted and pool omitted cases; vegetation reduced.
**`levels.test.mjs`:** ids for every Q7 combination; `stairsExist` (one floor: no; one floor + usable roof: yes; one floor + basement: yes); needed with and without stair and lift; names (single, numbered, master, the sample).
**`validate.test.mjs`:** each code alone (present with the right `q`, `level` and numbers, then gone after the fix); `level-over` text in m and ft; the equal-rounding case; `field-invalid` from `invalidFields`; `normaliseRoof`.
**`signature.test.mjs`:**
- unchanged for each appearance question (11 cases);
- all levels change on Q3 (when `w` or `d` changes), Q6, Q14 position, lift, stairs appearing (usable roof on a one-floor house), a plot or setback change that alters `w` or `d`;
- only the touched level changes on Q11, Q12, Q13;
- **moves only, resets nothing, asks nothing:** sample back setback 2 -> 2.25 m (by hand: bounding box depth 24.75, `w0 x d0` still 9.5 x 15.0, footprint `v` 8 -> 7.875): every signature identical, and with valid plans seeded `propose` resolves `true` without calling the handler and the plans are untouched. Same for a vertex move (8,30) -> (8.5,30) (area 583, size still 9.5 x 15.0). Counter-case: back setback 2 -> 3 m changes `d` to 14.5 and does ask.
- gate: no plans -> never asks; valid plans + layout change -> asks once, names the affected levels only; Cancel -> state identical (same object), one `cancelled` notification, resolves `false`; Continue -> committed, a second layout change does not ask; after `go(3)` it asks again; stale plan -> not asked; removed level with a plan -> asked; two proposals in a row are serialised.
**Existing tests updated:** `stages` (stage 2 now really validates: sample valid, an empty floor blocks stage 3), `draft` and `store` (`levelIds` -> `PC.levels.ids`). `node tests/run-all.mjs` must stay green including the QA suites.

## 9. Acceptance map

| Criterion | Where | Test |
|---|---|---|
| F2-S3 summary numbers | `validate.summary`, `site`, `levels.needed` | site, validate |
| F2-S3 each blocking condition, with question and fix, clearing on recompute | rule table | validate |
| F2-S3 "needs X, Y available" with both numbers | `level-over` | validate |
| F2-S3 each warning with effective numbers | rule table | validate, site |
| 3.1 edge classes (40 degrees), buildable area, footprint rules, clamp, CTO fallback, "does not fit" | `site`, `site-footprint` | site, footprint |
| 3.1 same footprint for all levels; available = effective footprint area | `validate.summary` | validate |
| 3.2 plan levels, stairs exist rule, lift only with stairs | `levels` | levels |
| R5 classification and per-level rule | `sig.level` | signature |
| R5 confirmation once per visit, Cancel restores, Continue applies | `store.propose` | signature (gate part) |
| CTO round 2: a move without a size change resets nothing and asks nothing | `fp: [w, d, edge]` | signature |
| 6.2 verification numbers; sample has no warnings | `site`, `validate`, `sample` | site |
| G6-style bound for the site maths | memo, pre-filters | footprint (timing) |

## 10. Risks and questions for the Tech Lead

1. **File split.** A-2 names one `site.js`; mask + footprint + parking/pool will pass 300 lines. Proposed: `site.js`, `site-footprint.js`, `site-outdoor.js`, all under `PC.site`. OK?
2. **`PC.validate` is a function with a `.blocking` property** (`F2-plan` calls `PC.validate(state)`, `stages.js` calls `PC.validate.blocking(state)`). Say if you prefer a plain namespace with `run`.
3. **Which plans count as affected.** I count only plans that are valid now. A-7 says "plan whose signature would differ"; read literally against `plans[id].sig`, an already stale plan would make even a colour change ask. Confirm.
4. **Open plot = signature `'invalid'`.** Reopening a closed plot (Undo) with valid plans therefore asks, and closing it again unchanged makes the plans valid again. For that to survive a reload, `PC.plans.sync` (F3-T1) must leave plans alone while the signature is `'invalid'` instead of deleting them. Agree, or should an open plot drop the plans?
5. **Cancel notifies subscribers** (`meta.cancelled`, same state) so controls snap back without per-control code. It also marks autosave dirty once (harmless). OK?
6. **`r5Confirmed` reset lives in `PC.store.go(3)`**, not in a stage controller, so it also holds in node tests and before the stage 3 controller exists.
7. **Room names:** the master is "Master bedroom" and is left out of the bedroom numbering; 6.2's "Bathroom 1" is the first bathroom in list order. Confirm.
8. **A footprint that was moved by the fallback but not shrunk** raises no warning (the PM lists only "had to be shrunk"). The preview shows where it is. Confirm.
9. **Parking and pool candidate order** beyond what A-6 fixes (scan direction, nearest-to-building first) is my choice; the sample and the 20 x 20 m case pin the results that matter.
10. **`invalidFields` entry shape** for F2-T2, fixed here because `validate` reads it: `{ key: { q, label, min, max, unitKind: 'len' | 'area' | 'pct' | 'count' } }` (min/max in metres).
11. **Stage 2 becomes really gated in this task while its screen is still static** (until F2-T2): with a hand-drawn plot and default answers a conflict can disable Next with no visible reason except the static-preview banner. Interim; say if `MAX_BUILT` should drop to 1 between the two tasks (it would break the current stage 2 e2e and QA flows, so I would rather not).
12. The two "moves only" examples are computed by hand; if the test shows a different size I will pick another pair and report it, not loosen the assertion.
