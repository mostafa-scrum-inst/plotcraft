# F2-T1 — Site model, validation, signatures and R5 gate (pure logic): outcome

Owner: FS. Step 3f. Plan: `plan.md` (approved round 1, 12 rulings + 4 conditions). Reviews: `plan-review.md`, `impl-review.md` (round 1 changes requested, round 2 approved), `qa-report.md` (passed). CTO decision: `docs/02-features/cto-review.md`, 2026-11-20 (three fallback proportions). No code was changed in this step.

## 1. What was built

All pure core code (no DOM, no timers, node-tested), in frame L (A-5):
- **Levels**: which plan levels exist, stairs and lift presence, room areas and names, needed area per level.
- **Site model**: edge classes (front / back / side, 40 degrees inclusive), the buildable set with its 0.25 m lattice mask, the exact rectangle test, the footprint (target from Q3, proportions of the buildable box capped at 2:1, 0.5 m rounding, centred, shrunk about its centre, fallback search on 0.5 m centres for three proportions), parking with the 2 m entrance strip, pool with 1 m clearance, vegetation budget.
- **Validation**: seven blocking codes and four warnings from one rule table, with texts in the current unit, and the summary numbers.
- **Signatures and the R5 gate**: per-level signature (footprint size + street edge, core, rooms, pairs) and the real `PC.store.propose`.
- **CTO debt from the F1 review**, folded in: a corner drag can no longer turn a closed plot clockwise; the fail-open guards in `stages.js` are gone; `run-all` runs browser files two at a time with a focused mode.

## 2. Files

| File | Content |
|---|---|
| `src/js/core/levels.js` | `PC.levels` |
| `src/js/core/site.js` | `PC.site` (`analyse`, classes, mask, `rectFits`, vegetation, tolerances) |
| `src/js/core/site-footprint.js` | `PC.site.footprint` |
| `src/js/core/site-outdoor.js` | `PC.site.parking`, `PC.site.pool` |
| `src/js/core/signature.js` | `PC.sig` |
| `src/js/core/validate.js` | `PC.validate` |
| `src/js/core/geom.js` | + `segHitsRect`, `segRectDist`, `rectInPoly`, `rectsOverlap` |
| `src/js/core/plot.js` | `canMove` refuses a closed plot with non-positive signed area |
| `src/js/core/store.js` | the gate in `propose`; `meta.cancelled`; `r5Confirmed` reset |
| `src/js/core/stages.js`, `draft.js`, `src/js/ui/start.js` | `PC.stages.levelIds` removed (callers use `PC.levels.ids`); no existence guards |
| `src/js/ui/stage-plot.js` | plot view fitted at once, not in the next frame (flake found in the fix round) |
| `src/js/main.js`, `src/manifest.json` | `PC.debug.site()`; 26 scripts at hand-over |
| `tests/unit/{levels,site,footprint,validate,signature}.test.mjs` (new); `stages`, `plot` extended | 244 unit tests at hand-over |
| `tests/e2e/plot.spec.mjs`, `shell.spec.mjs`, `tests/helpers/browser.mjs`, `touch.mjs` | no-flip case; real signatures in seeded plans; fixed sleeps replaced |
| `tests/run-all.mjs` | two browser files at a time, `--only`, `--jobs`, total time |
| `tests/qa/f1-t2-flows.mjs` | four seeding calls use the real signature (accepted once; from now on `tests/qa/` changes go through QA) |

## 3. Public APIs

**`PC.levels`**: `ids(state)` (`'B'`, `'G'`, `'1'`, `'2'`; the only level list), `name(id)`, `stairsExist(state)` (2+ levels counting basement and usable roof), `liftExists(state)`, `roomArea(room)`, `roomsOn(state, id)`, `roomNames(state)` (master = "Master bedroom", outside the numbering), `needed(state, id)` (rooms + 10 for stairs + 3 for a lift).
`PC.levels.prune(draft)` is **not** part of this task: it was added in F2-T2 (drops rooms, pairs and plans of levels that Q7 removed).

**`PC.site.analyse(state)`** -> `null` while the plot is open, otherwise (memoised on every input: points, street edge, three setbacks, footprint %, vegetation %, cars, covered, pool on and size; last 4 results kept):

```js
{ edge,                       // resolved street-edge index
  frame, ptsL,                // PC.frames.make(...) and the plot in frame L
  plotArea, perimeter,
  edgeClass: ['front' | 'back' | 'side', ...], setbackOf: [metres per edge],
  buildable: { area, bbox: { u0, v0, u1, v1 } | null, ok },      // ok: area >= 20
  footprint: null | { u, v, w, d, area, pct, clamped, moved },
  noFit,                      // true when the buildable area is fine but no 20 m2 building fits
  parking: null | { u, v, w, d, cars, covered }, pool: null | { u, v, w, d },
  veg: { area, pct, reduced }, omitted: ['parking' | 'pool'],
  mask: { bits, i0, j0, nu, nv, bbox, area, has(i, j) } }       // 0.25 m lattice; internal, not for drawing
```
Also: `PC.site.isBuildable(site, [u, v])`, `PC.site.rectFits(site, { u, v, w, d })`, `PC.site.T` (all tolerances), `PC.site.floor05`, `PC.site.clearMemo()`.

**`PC.sig.level(state, id)`** -> `'invalid'` (open plot, no footprint, level does not exist) or `JSON.stringify({ fp: [w, d, edge], core: [stairPos, lift] | 0, rooms: [[id, type, areaM2], ...], pairs: [[a, b], ...] })` in numeric id order. A stored plan is valid only while `plans[id].sig` equals it.

**`PC.validate(state)`** -> `{ blocking: [...], warnings: [...], summary }`, each item `{ code, q, level, text }`; `PC.validate.blocking(state)`; `PC.validate.RULES`; `PC.validate.normaliseRoof(ans)` (usable roof + Pitched -> Flat, returns `true` when it changed). `summary = { plotArea, buildableArea, footprintArea, footprintPct, vegArea, vegPct, levels: [{ id, name, needed, available }] }` in metres. An open plot gives empty lists and a `null` summary.

| Code | Kind | Q | When |
|---|---|---|---|
| `field-invalid` | block | field's | an entry in `PC.store.session.invalidFields` (`{ q, label, min, max, unitKind }`, limits in metres) |
| `floor-empty` | block | 11 | an above-ground level without rooms |
| `basement-empty` | block | 11 | basement on without rooms |
| `buildable-small` | block | 2 | buildable area under 20 m² |
| `no-fit` | block | 2 | no building of 20 m² fits |
| `fp-veg-over` | block | 3 | footprint % + vegetation % over 100 |
| `level-over` | block | 11 | needed over available; fix text names the footprint % while the plot is not the limit, the setbacks once the footprint is clamped |
| `fp-clamped` | warn | 3 | footprint shrunk to fit |
| `veg-reduced` | warn | 4 | vegetation reduced to what fits |
| `parking-omitted` | warn | 15 | no place for the cars |
| `pool-omitted` | warn | 16 | no place for the pool with its clearance |

**Gate contract (`PC.store.propose(mutator)` -> `Promise<boolean>`)**:
- Builds the candidate; a no-op resolves `true`.
- Affected = levels whose plan is valid now and whose signature differs in the candidate (removed levels included). None, or `session.r5Confirmed`, or no handler -> commit, `true`.
- Otherwise the confirm handler gets `{ title, text, ok, cancel, levels }`. Continue: sets `r5Confirmed`, commits, `true`. Cancel: no commit, the state object is unchanged, subscribers are notified once with `meta.cancelled = true`, `false`.
- Proposals are serialised. `r5Confirmed` is cleared by `PC.store.go(3)` and by `replace`.
- The gate regenerates nothing; plans become stale by signature and `PC.plans.sync` (F3-T1) regenerates on entering stage 3. While a level's signature is `'invalid'`, `sync` must leave its stored plan alone (A-7).
- Actions with their own confirmation (Clear, removing a level with rooms) use `commit`, never a second question.

**`PC.debug.site()`**: the site model of the current state.

## 4. How to verify

1. `node tests/run-all.mjs --unit` (seconds): includes the mandatory PM 6.2 test in `site.test.mjs`.
2. `node tests/run-all.mjs --qa --only f2-t1` (about 30 s): QA's generated-plot suite with its independent reference model.
3. Full run: `node tests/run-all.mjs` (about 4 minutes, two browser files at a time).
4. In the page console on the sample: `PC.debug.site().footprint` -> `{ u: 5.25, v: 8, w: 9.5, d: 15, area: 142.5, … }`.

PM 6.2 as reproduced: 584 m², perimeter 96.94 m; front, side, back, back, side; buildable box u 2–18, v 3–28, 389.44 m²; footprint 9.5 × 15 at (5.25, 8), 142.5 m², 24.4 %, not clamped; 120 of 142.5 on both levels; parking u 11–16; pool 6 × 3 at (7, 24); vegetation 146 m²; no blocking, no warnings.

## 5. QA sign-off

`qa-report.md`, 2026-11-20: **PASSED.** QA's suite `tests/qa/f2-t1-site.mjs` with the reference model `f2-t1-ref.mjs`: 1124 checks passed, 0 failed, over generated plots (543 footprints checked for containment, target, rounding, proportion and determinism); 2 hits on the two minor bugs of section 8, recorded as KNOWN. QA mutation-checked its suite. All seven focus items pass (6.2 numbers also rotated; footprint properties; every code in both units; signatures; gate; corner flip; no fail-open guards).
At the Tech Lead's approval (round 2) three consecutive full runs were green: 235.6 s, 234.2 s, 232.8 s, with unit 244 / 0, e2e contract 4 / 0, fit-button 42 / 0, plot 512 / 0, shell 551 / 0, start-card 14 / 0, QA F1-T1 161 / 0 and 1929 / 0, F1-T2 765 / 0, F1-T3 1022 / 0.

## 6. CTO debt items closed here (F1 feature review)

| Item | Result |
|---|---|
| Corner drag can turn a closed plot clockwise | `PC.plot.canMove` refuses a non-positive signed area; unit cases (triangle, square on a 21 × 21 grid) and an e2e case (apex across the base, reload, draft still offered); both fail without the fix |
| Fail-open guards in `stages.js` | removed; a test expects a throw when `PC.validate` or `PC.sig` is missing |
| Runner | browser files two at a time; focused run `node tests/run-all.mjs --unit --e2e --only <words>`; full run from about 6 min 40 s to about 4 min |

## 7. Accepted deviations and rulings

| Item | Ruling |
|---|---|
| Three files under `PC.site` | approved |
| `PC.validate(state)` with `.blocking` | approved |
| Only currently valid plans count as affected | confirmed (A-7 reworded) |
| Open plot = `'invalid'` signature, plans kept | agreed; binding on F3-T1 |
| Cancel notifies once with `meta.cancelled` | approved |
| `r5Confirmed` reset in `go(3)` and `replace` | approved |
| Room names (master outside the numbering) | confirmed |
| Moved but not shrunk: no warning | confirmed |
| Parking keeps a 2 m entrance strip free; last resort farthest from the entrance first | condition 1 and required change 2 |
| Rounding nudge for shrunken footprints, guarded by `rectFits` | accepted |
| Mask computed row by row | accepted |
| Memo of 4, key includes `covered` | accepted |
| `moved` only when the fallback found a better centre | accepted |
| `PC.validate` caches only frozen store states | accepted |
| Extra site fields `edge`, `noFit`, `mask`; `null` for an open plot | accepted |
| Stage 2 really gated while its screen was static | accepted (interim, ended by F2-T2) |
| Fallback tries bounding-box ratio, 1:2, 2:1 and keeps the largest | CTO decision 2026-11-20 (L-plot 100 -> 205 m², U-plot 60 -> 128 m²) |
| `level-over` fix text depends on `clamped` | required change 3 |
| FS edit of `tests/qa/f1-t2-flows.mjs` | accepted once; QA confirmed; `tests/qa/` changes go through QA from now on |

## 8. Known limits and tech debt

**Open minor bugs (QA), both KNOWN in `tests/qa/f2-t1-site.mjs`. Proposed: fix in the F2-T2 fix round, Tech Lead to confirm.**
1. **Wrong `no-fit` for small targets.** When the centred result keeps half the target but rounds to under 20 m², no other centre is tried and stage 2 is blocked although a building of 20 m² or more fits elsewhere (QA's triangle: 18 m² centred, 24.5 m² available at another centre). Fix: one condition in `site-footprint.js`, run the fallback search also when the centred result ends under 20 m². Tests to add: QA's triangle, and "no-fit only when nothing fits".
2. **Pool warning says "1 m clearance" in ft mode** (R4). Fix: build the clearance through `PC.units` in `validate.js` (3.3 ft), with a test in both units.

**QA's observations (correct by the rules; for PM / TL to decide)**
| # | Observation | Suggested owner |
|---|---|---|
| 1 | Thin plots get a small building because of the 2:1 limit; the warning says "reduced to fit inside the setbacks", not that the proportion limit is the reason | PM (rule or wording) |
| 2 | Four cars on the sample cover 1 m of the entrance strip with no warning; on a tapered plot the last resort prefers nearest-the-street over least coverage | TL (A-6 rule) |
| 3 | A car in the side yard can stand past the front wall line (default answers on 20 × 20 m) | TL; visible in F4 with wall and gate |
| 4 | The 40-degree back / side limit is a cliff when back and side setbacks differ | PM; the F2-T2 preview labels each edge |
| 5 | Zero setbacks do not put the building on the boundary (it stays centred) | PM |
| 6 | Convex plots do reach the fallback (41 of QA's convex cases, e.g. the sample with setbacks 6 / 5 / 4 at 50 %) | TL: see below |
| 7 | Footprint % has a ceiling the user sees only through the warning | PM / F2-T2 summary |
| 8 | On a wide U-shaped plot the building goes into one arm and the summary does not say where | covered by the F2-T2 preview |

**A-6 text is wrong in one sentence.** "Convex plots and the sample never reach this branch" (fallback): the sample never does with its 6.2 answers, but convex plots do whenever the centred shrink keeps less than half the target (observation 6). The results are valid and larger than the centred ones. The sentence should go or read "the sample with its 6.2 answers never reaches this branch". Tech Lead to correct.

**Gaps QA found in my unit tests, now covered by QA's suite (which `run-all` runs)**: properties over generated plots; optimality of the fallback against an exhaustive search; "no-fit only when nothing fits"; parking and pool omitted only when no place exists; every message in both units; "once per visit" for a second, still valid level (a mutation removing the flag passed my tests). When the two bugs are fixed I add the triangle case, the ft pool message and the second-level "once per visit" case to `tests/unit/`.

**Other**
- The mask is kept on the site object for the fallback; nothing outside `site-footprint.js` should read it.
- Parking and pool scan orders beyond what A-6 fixes are implementation choices, pinned by tests for the sample and the 20 × 20 m default.
- `PC.plans.sync` does not exist yet; the gate's "regenerated on entering stage 3" becomes observable in F3-T1, and the R5 flow end to end in F3-T2.
