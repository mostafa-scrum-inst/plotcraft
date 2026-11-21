# F2-T1 QA report — QA Tester

## Round 1 — 2026-11-20

Tested in a snapshot of the tree taken after the Tech Lead's round-2 approval (`/home/claude/plotcraft-qa-f2t1`, deleted afterwards), because F2-T2 work had started in the main tree.
Scope: the pure site model — `PC.levels`, `PC.site.analyse` (edge classes, buildable area, footprint with the three-proportion fallback, parking, pool, vegetation), `PC.validate`, `PC.sig.level`, the `PC.store.propose` gate — and the regressions on the TL's list. No UI in this task (stage 2 is still the static screen), so everything runs in node.

### What I tested and how

| File | What |
|---|---|
| `tests/qa/f2-t1-ref.mjs` | QA's own reference model, written from PM 3.1 / 3.2 / 4 / 6.2 and A-5 / A-6, **not** from `src/js/core`: polygon and rectangle geometry, frame L, edge classes, the buildable definition, an exact "rectangle is buildable" test, lattice figures as A-6 defines them, target sizes, and an exhaustive footprint search (centred rule + three-proportion fallback over every 0.5 m centre). Own loader for the source files |
| `tests/qa/f2-t1-site.mjs` | the checks (1124), about 28 s |
| `tests/qa/run-f2-t1.mjs` | runner; exit 0 / 1; `--no-shots` accepted and ignored |

Nothing from `PC.geom` or `tests/helpers/` is used to judge the app. The reference is itself cross-checked: its exact rectangle test agrees with brute-force sampling on 400 random rectangles in an L-shaped plot.
**Mutation check of the suite** (in the snapshot, each restored): back angle 40 -> 50 degrees (57 checks fail), half-target rule -> quarter (19), setback tolerance loosened by 5 cm (53), pool clearance ignoring the parking (15), footprint position added to the signature (4), "once per visit" flag removed from the gate (1, after I added the case that needs it), last-resort parking nearest-first (18).

Parts:
1. The 6.2 sample figure by figure, and four rotated / shifted copies.
2. Reference self-test.
3. **632 generated cases**: 29 plots (rectangles, thin, tiny, 100 x 100 m, sample, trapezoid with a slanted street, triangles, pentagon, hexagon, rotated copies, four L-shapes, two U-shapes, T, street-side notch, 3-tooth comb, 100 x 100 m comb, two 12-vertex stars) x 4 setback sets (default, zero, 6/5/4, 1/5/3) x footprint 10 / 25 / 30 / 50 / 80 %. Outcomes: 196 plain, 117 clamped at the centre, 230 moved by the fallback, 55 buildable-small, 34 no-fit. On the ten concave plots of moderate size every footprint is compared with my exhaustive search.
4. Edge classes at 0 / 25 / 39 / 40 / 41 / 60 / 90 degrees; street edge on another side; default street edge.
5. Parking, pool, vegetation: named cases plus 360 generated cases (27 plots x 1 / 2 / 4 cars x pool S / L x two setback sets), each checked against the placement rules and against an existence search on the 0.5 m lattice.
6. Levels: all 24 combinations of floors / basement / usable roof / lift; needed areas; names.
7. Every blocking and warning code alone, in m and in ft, with question, level, numbers, fix, and the effect on stage 2.
8. Signatures.
9. The gate (20 cases).
10. Regressions.
Also run in the snapshot: `node tests/run-all.mjs` exit 0 in 235.9 s (unit 244 / 0; e2e contract 4, fit-button 42, plot 512, shell 551, start-card 14; QA F1-T1 161 + 1929, F1-T2 765, F1-T3 1022, F2-T1 1124).

Result: **1124 checks passed, 0 failed; 2 hits on the two minor bugs below (KNOWN, exit code 0).**

### Results against the TL's focus list

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | 6.2 numbers, also rotated | PASS | 584 m², 96.94 m; front / side / back / back / side (angled edge 26.6 degrees); buildable box u 2-18, v 3-28 and 389.44 m² (app = my lattice count); footprint 9.5 x 15 at (5.25, 8), 142.5 m², 24.4 %, not clamped; 120 of 142.5 on both levels; parking 5 x 5 at u 11-16; pool 6 x 3 at (7, 24); vegetation 146 m²; no conflict, no warning. Rotated 30 / 117 / 180 degrees and shifted: identical in frame L |
| 2 | Footprint properties over generated plots | PASS (bug 1) | all 543 footprints: inside the buildable set (exact and sampled), never above the target, sides multiples of 0.5 m, at most 2:1 plus one rounding step, `pct` consistent, deterministic; not clamped => exactly the rounded target of an allowed proportion; clamped at the centre => 0.5 m more does not fit; not moved => centred on the buildable box; every footprint on the ten concave plots equals my exhaustive search in area, clamped flag and nearest-centre tie. Both 20 m² conflicts appear exactly when they should, except bug 1. TL L-shape: 10 x 20.5 = 205 m²; U-shape: 8 x 16 = 128 m². Slowest analysis under 100 ms (bound 500) |
| 3 | Each blocking and warning code alone, m and ft | PASS (bug 2) | floor-empty (first and ground), basement-empty, buildable-small, no-fit, fp-veg-over, level-over free ("raise the footprint %") and clamped ("reduce the setbacks…", never the %), field-invalid (length, percentage and area limits in the current unit), fp-clamped, veg-reduced, parking-omitted, pool-omitted: right question number, right level id, my numbers in the text in both units, gone after the fix; blocking codes make stage 2 invalid and lock stage 3 with "Fix the highlighted answers first", warnings do not. 142.7 vs 142.5 m² is shown with a decimal |
| 4 | Signatures | PASS | unchanged by Q1, Q4, Q5, Q8, Q9, Q10, Q15 (cars, covered), Q16, Q17 (wall, gate, seating), Q18, Q19, usable roof with stairs already present, master flag, room list order, pair order; unchanged by back setback 2 -> 2.25 m (footprint moves from v 8 to 7.875), vertex (8,30) -> (8.5,30), and a rotated / shifted plot; all levels change on footprint %, a setback that changes the size, stair position, lift, street edge (also on a square where the size repeats); one level on room added / removed / type / size / exact area and on pair added / removed; both on a room moved between floors; third floor and basement leave G and 1 alone; one floor makes G change (stairs go) unless the roof is usable; `'invalid'` for open plot, no footprint, missing level; ids in numeric order |
| 5 | Gate | PASS | asks once naming the levels; Cancel = `false`, the same state object, one notification with `cancelled`; asks again after a Cancel; Continue commits and later changes in the visit do not ask, also for a floor whose plan was still valid; one-floor change names one floor; appearance and move-only changes never ask; no-op proposal does nothing; stale plans never ask; mixed stale / valid names only the valid one; removed level asks; flag cleared by entering stage 3 and by `replace`; proposals serialised (second waits, applies on top); first cancelled / second continued; throwing mutator rejects and does not block the queue; `sampleClean` ends only when committed |
| 6 | Parking and pool | PASS | sample with 1 / 2 / 3 cars: strip free (2 cars u 11-16, 3 cars u 11-18.5); 4 cars: u 0-10, 1 m of the strip; default car on 20 x 20 m goes to the side yard at v 0.5; crowded 12 x 14 m plot: both omitted with both warnings; vegetation reduced to the remainder with the effective % in the warning; 360 generated cases: sizes per 4.3, inside the plot, clear of the building, pool clearance clear of building and parking, long side along the street behind / inward beside, strip kept free whenever a strip-free place exists on the lattice, omitted only when my search finds no place |
| 7 | Regressions | PASS | `PC.stages.status` throws when `PC.validate`, `PC.sig`, `PC.levels` or `PC.units` is missing; approved plans with a wrong signature do not validate stage 3; `canMove` refuses the orientation flip; the memo never answers for another input (60 alternating lookups over 6 states); browser suites incl. scenario O and the full parallel run are green in the snapshot |

### Bugs

**1. Minor — "The building does not fit this plot" is shown although a building of 20 m² or more fits elsewhere (wrong blocking conflict for small targets).**
- Case: triangle (0,0) (60,0) (30,12), 360 m², setbacks front 1 / back 5 / sides 3, footprint 10 % (target 36 m²). Buildable area 78 m², box u 16-44, v 1-6.5.
- Expected (PM 3.1, concave bullet): the blocking conflict only "if no position gives at least 20 m²".
- Actual: the centred try gives 6 x 3 = 18 m². Its unrounded area (20.3 m²) is "at least half the target", so no other centre is tried, the rounded 18 m² is under 20, and stage 2 is blocked with `no-fit`. A 7 x 3.5 m = 24.5 m² rectangle of the same proportion fits at centre (29, 3); the app's own `rectFits` accepts it.
- Reach: only when half the target is under 20 m² (target below 40 m²: small plots or a low footprint %) and the centre is tight. 1 of the 34 no-fit cases in my sweep. The message's advice (reduce setbacks or redraw) also omits the fix that works here, raising the footprint %.
- Suggested fix: run the fallback search also when the centred result ends under 20 m² (one condition in `site-footprint.js`), then the rule matches the PM sentence.

**2. Minor — R4: the pool warning states "1 m clearance" in feet mode.**
- `pool-omitted` reads "The pool with its 1 m clearance does not fit behind or beside the building…" whatever the unit; in ft it should say 3.3 ft, like the other messages (all others follow the unit, including the limits of `field-invalid` and the "outside" message fixed in F1-T3).

Both are marked KNOWN in `tests/qa/f2-t1-site.mjs` (remove the entries when fixed).

### Observations: correct by the rules, but an architect may be surprised
1. **Thin plots get a very small building.** 10 x 50 m at 30 % (150 m² asked): 6 x 12 m = 72 m² (14.4 %), because of the 2:1 limit; the buildable strip is 6 x 45 m. The warning says the building "was reduced to fit inside the setbacks", which does not tell the user that the proportion limit is the reason and that no answer of theirs can change it.
2. **Four cars stand partly in front of the door on the sample** (u 0-10, 1 m of the 2 m entrance strip) with no warning. On a tapered plot (rotated pentagon, setbacks 1/5/3) the last resort covers 1.375 m of the strip at the street although 0.375 m would be possible 2 m further in: the rule prefers nearest-the-street over least coverage.
3. **A car in the side yard can stick out past the front wall**: default answers on 20 x 20 m put the car at v 0.5-5.5 while the front wall is at v 5.25. Allowed by A-6; it will look odd in 3D if the boundary wall and gate are drawn (F4).
4. **The 40-degree limit is a cliff.** A rear boundary tilted 40 degrees takes the back setback, at 41 degrees the side setback. With equal defaults nobody notices; with back 5 m / side 1 m a one-degree change in the outline moves the buildable area by metres. The Q6 preview (F2-T2) labelling each edge front / back / side is what makes this understandable; worth checking there.
5. **Zero setbacks do not put the building on the boundary**: the footprint stays centred (20 x 30 m plot at 80 %: 17.5 x 26.5 m, 1.25 m from each side). And at 80 % the car no longer fits (warning).
6. **Convex plots do reach the fallback.** A-6 says "convex plots and the sample never reach this branch"; 41 of my convex cases did (e.g. the sample itself with setbacks 6/5/4 at 50 %: 10.5 x 16.5 m, off-centre; the trapezoid with a slanted street at 80 %). The results are valid and larger than the centred ones; only the sentence in A-6 is wrong.
7. **Footprint % has a ceiling the user cannot see until the warning**: the sample with setbacks 6/5/4 gives the same 10.5 x 16.5 m at 50 % and at 80 %.
8. **A wide U-shaped plot open to the street** gets its building in one arm (8 x 16 m at u 2) and the parking in the court between the arms (u 7): legal, but the summary gives no hint of where the house went; the preview in F2-T2 must show it.

### Review of the FS's unit tests (gaps)
The unit suite (244) covers the named cases well. Not covered there, now covered here: properties over generated plots (the FS tests check a handful of fixed plots); optimality of the fallback against an exhaustive search; "no-fit only when nothing fits" (bug 1); parking / pool existence (omitted only when no place exists); every message in both units (bug 2); "once per visit" for a second, still valid level (a mutation removing the flag passed every existing test until I added the case).

### Verdict
All seven focus items pass. Two minor bugs (one narrow wrong `no-fit`, one unit wording) and eight observations for PM / TL; none blocks F2-T2, which should however show the footprint position, edge classes and the reason for a small building in its preview and summary.

VERDICT: PASSED
