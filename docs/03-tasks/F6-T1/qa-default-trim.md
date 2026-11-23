# QA proposal: default-run trim (TL margin ruling, F6-T1b review finding 8)

Date: 2026-11-22. Author: QA. For the TL to agree; nothing is moved yet.

## Why more than 15 s, and why not into QA_FULL

- **Default run:** my two quiet runs on fa8674d were 425.8 s and 432.8 s (qa-report T-1); FS's gate had 417.3 / 418.2 s.
  The real margin is negative on some runs, so I aim for about 60 s of work (about 20 s of wall), not 45 s.
- **QA_FULL has no room:** my `QA_FULL=1` run took 474.9 s (limit 480), not 464 s. Moving 45 s of work into QA_FULL
  would put it near 490 s.
- **Proposed destination: the release step** (`QA_RELEASE=1`, own processes, after the pool), as in the F6-T1a
  Addendum 2 moves. It measured 192.1 s against 300 s (NOTE above 260 s). It runs at every impl-review gate and at
  release, so these rows keep the same cadence QA_FULL gave them. About +55 s puts it near 250 s, still under the
  NOTE line.

## Measured section times (3 suites side by side, as in run-all; f1-t1 scenarios measured alone)

The phone pass (360x640) stays in the default run everywhere (CD-7). So do input-specific passes (mouse, keyboard)
and layout checks that only exist at one size.

| # | File, rows moved to the release step | Why it is a duplicate | Work saved |
|---|---|---|---|
| 1 | f2-t3 at 1280x800: A (4b footprints, m/ft), D (live effect, R5, clearing, invariant attack), E (draft overrides), H/I (rows, pairs), J (Q14 note), K (remove level), L (conflicts, Fix) | Model and flow logic, the same at both sizes. The desktop layout of these screens stays covered by f2-t3 M (every viewport) and f1-t1 layout. B (mouse), C (keyboard) and G (form) keep 1280x800. | 19.3 s |
| 2 | f1-t3 at 1280x800: B (close by button, Undo, Clear), C (refusals), G (drafts / guard) | Button and model logic. Mouse drawing (A), mouse vertex drag (D), wheel and gestures (E), label legibility (F) and keyboard (K) stay at 1280x800. | 9.0 s |
| 3 | f1-t3 O (no inside-out corner drag) at 768x1024 and 1280x800 | A model invariant. The phone pass in m and ft stays. | about 4 s (estimate: the L/O/N passes average 2.1 s each) |
| 4 | f1-t1 layout at 640x360 and 1280x800: s5-building (3.5 s each), x-banners (2.1 s each) | The same overlay and banners as at 360x640. Fit and overlap at those sizes still get checked at each gate. | 11.2 s |
| 5 | f1-t1 layout at 640x360 and 1280x800: s5-light and s5-tour | At these sizes the 3D panel shows all sections at once, so they repeat s5-view (the same 73.9 % panel note at 640x360). | about 2 s |
| | **Total** | | **about 45.5 s of work, about 15 s of wall** |

**Optional, to reach about 20 s of wall:**
- **6.** f2-t3 G (add form) at 1280x800: 4.0 s.
- **7.** f1-t3 F (sample figures) at 1280x800: 4.2 s.

Both have some size-dependent layout, so I list them as options, not as duplicates. With 6 and 7 the total is about
54 s of work.

**Not proposed:** the whole f1-t1 640x360 layout pass (20 s). It is the only default check of short landscape on
every stage, and CD-7 is still open.

## Mechanics (QA files only)

- Each moved row is gated with `FULL = !!process.env.QA_RELEASE`, following f4-t1-view / f5-t3-view.
- `--release-only` runs just those rows. RELEASE_ROWS in f6-t1-leak.mjs gets three entries:
  - `f2-t3-site-rooms.mjs`
  - `f1-t3-plot.mjs`
  - `f1-t1-layout.mjs`
- `QA_FULL=1` does not run them, so QA_FULL time does not grow.
- After the TL agrees, I will:
  - land the change in main;
  - run two quiet default runs, one QA_FULL run and the release step;
  - report the times to the TL and FS.
- FS then re-times `tests/durations.json`.

## Addendum: landed (TL agreed all 7 rows)

- The f2-t3, f1-t3 and f1-t1 rows are gated as above, and the three files are in RELEASE_ROWS.
- **Measured on f6t1 fa8674d, scratch copy, quiet machine:**

| Run | Result | Wall |
|---|---|---|
| Default, run 1 | all green, 10 822 passed / 0 failed | **411.9 s** |
| Default, run 2 | all green, 10 822 passed / 0 failed | **413.1 s** |
| Release step | 9 of 9 | **246.1 s** |

- Before the trim, the same set-up gave 425.8 s and 432.8 s.
- **Release-step breakdown:**
  - maximum-house stream: 122.3 s
  - f4-t1: 20.3 s
  - f5-t3: 38.7 s
  - f4-t2-s0-ui: 16.8 s
  - f2-t3: 21.4 s
  - f1-t3: 15.4 s
  - f1-t1: 10.7 s
- The release step is under the 260 s NOTE line.
- **QA_FULL:** the moved rows no longer run under QA_FULL=1 alone, so its time goes down.

## Addendum 2: QA_FULL trim before the F6-T1c gate (TL: at least 30 s of QA_FULL work into the release step)

All moved rows are duplicated viewport passes, and every check is kept.

**Rows moved from QA_FULL=1 into the release step:**
- f2-t3: B, F and M at 640x360 / 768x1024.
- f1-t3: I, L and N at 768x1024 / 640x360.
- These are about 33 s of QA_FULL work: +17.7 s and +15.1 s in the QA_FULL pool, and +16.9 s and +15.2 s measured in the release step.

**Release step NOTE line:** raised from 260 s to 280 s (TL). The limit stays at 300 s.

**Measured on the f6t1 copy (7c12dcc), quiet machine:**

| Run | Result | Wall |
|---|---|---|
| Release step | 9 of 9 | **280.8 s** (limit 300; 0.8 s over the 280 s NOTE line, so a NOTE) |
| `QA_FULL=1` | 11 839 / 1 | **450.9 s**, down from 474.9 s |

- **Release-step breakdown:**
  - maximum-house stream: 124.4 s
  - f4-t1: 20.7 s
  - f5-t3: 38.7 s
  - f4-t2-s0-ui: 16.9 s
  - f2-t3: 38.3 s
  - f1-t3: 30.6 s
  - f1-t1: 10.8 s
- **The one QA_FULL failure:** FS's in-pool guard in e2e view3d-real, "maximum house build ≤ 800 ms": 821 ms, best of 3. It is a load-sensitive guard (C-4.8 solo: 146 ms), and on f6t1c FS has raised it to 1200 ms. It is not a QA row.
- **Risk:** the stream varies between 118 and 124 s, so the release step sits on the 280 s NOTE line.

## Addendum 3: F6-T1c default-run trim (TL ruling a + b)

The f6t1c default run took 426 s. Most of the growth comes from W1's extra openings in the existing real-r128 suites.

**(a) Maximum-house parts moved to the release rows process:**
- f6-t1-view B, the maximum-house budgets. The sample budgets in S stay in the default run.
- The maximum house of f6-t1-view D.
- The maximum house of f6-t1-model.

**(b) Duplicated 1280x800 logic passes moved to the release rows process.** Their 360x640 passes stay in the default run:

| Row | Measured |
|---|---|
| f2-t2 B, D, E, F at 1280x800 | 16.4 s |
| f1-t2 C, E, F and I at 1280x800 | 19.1 s |

A, B, D, G and H of f1-t2 stay at both sizes. K (keyboard) and G (layout) of f2-t2 are unchanged. Check counts are kept:
- f2-t2: 476 default + 158 release = 634.
- f1-t2: 432 + 152 = 584.

**Measured on the f6t1c copy (e86f33a + this change), quiet machine:**

| Run | Result | Wall |
|---|---|---|
| Default | all green, 10 513 / 0 | **411.7 s** |
| Release, rows process (parallel side) | 11 / 11 | 235.1 s |
| Release, stream process (parallel side) | 3 / 3 | 162.0 s |

Both release processes are under the 260 s NOTE line. FS runs the confirm runs.

## Addendum 4: run-time debt after F6-T1c (TL: about 45 s more maximum-house work or pure duplicates; new rows on the stream side)

**New list, `STREAM_ROWS` in f6-t1-leak.mjs** (the interface agreed with FS):
- `--max-only --stream-only` runs the 200-op stream, then these rows, in the same process.
- `--max-only` alone runs the stream, then RELEASE_ROWS, then STREAM_ROWS.

**Rows moved out of the default run.** Times are from the default run (work):

| Rows | Default-run time |
|---|---|
| f3-t2-editor at 640x360 | 13.8 s |
| f3-t1-stage3 A / B / C at 640x360, and A / C at 768x1024 | 8.9 s |
| f3-t3-look at 360x740 / 768x1024 | 2.3 s |
| f5-t1-view A step 6 (maximum house) | 8.1 s; the release side runs A whole |
| f4-t3-view D, maximum house with the caps (24 looks) | about 7 s; the release side runs D whole |
| f4-t2-view E (maximum-house budget) | 4.0 s |
| f4-t1-view F G6 (maximum house, dpr 3) | 2.3 s; it is added to f4-t1's existing --release-only row on the rows side |

**Check counts are kept** (default + release):

| Suite | Default | Release | Total |
|---|---|---|---|
| f3-t2 | 121 | 63 | 184 |
| f3-t1 | 124 | 81 | 205 |
| f3-t3 | 150 | 84 | 234 |
| f4-t2 | 15 | 2 | 17 |
| f4-t3 | 25 | 1 | 26 |

f5-t1 and f4-t1 keep their checks in full on the release side.

**Measured on the f6t1c copy (44a9f60, the same as main after the merge) with this change, quiet machine:**

| Run | Result | Wall |
|---|---|---|
| Default | all green, 10 279 / 0 | **392.1 s** |
| Rows process | 11 / 11 | **238.7 s** |
| Stream process (stream 157.4 s + 7 stream rows) | 9 / 9 | **240.7 s** |

Both release processes are under the 260 s NOTE line. FS runs the three-run median gate.

## Addendum 5: F6-T2 gate, third release process (TL ruling after 400383c, CTO §6.2 a–e)

| row | from | to | solo time (f6t2 400383c copy) |
|---|---|---|---|
| f6-t1-leak 50-op sample stream, 960x600 (a duplicate of the 200-op maximum-house stream) | default | rows3 | 36 s |
| f4-t1-view C 1280x800 gestures (a duplicate of C 360x640) | default | rows side (f4-t1-view --release-only) | about 5 s |
| f5-t1-view A clearing: another level, Reset view, Q18 rebuild, context restore (the default run keeps "All" and "Go to room…", which carries the disposal check) | default | rows3 (f5-t1-view --release-only) | about 9 s |
| the six former stream rows (f3-t2-editor, f3-t1-stage3, f3-t3-look, f4-t2-view, f4-t3-view, f5-t1-view) | stream side | rows3 | 93 s |

- **Interface:** `f6-t1-leak.mjs --max-only --rows3-only` runs the sample stream, then ROWS3. `--stream-only` is now the 200-op stream alone. `--rows-only` is unchanged. `--max-only` on its own runs everything serially. A default run (no flag) no longer opens a browser in f6-t1-leak; `--sample` runs the sample stream by hand.
- **rows3 measured:** 129.5 s on the f6t2 400383c copy (sample stream 36.6 s, rows 92.8 s).
- **Timing-sensitive checks:** rows3 has none. The leak "slowest operation" is a note only.
- **Expected effects:** the stream side drops to about 274 − 93 ≈ 181 s. The default pool loses about 50 s of solo time, roughly 100 s of pool-step time in the 3-job pool. FS re-times.

## Addendum 6: F6-T2 gate, more rows out of the default run (FS re-time 456.3 s; about 55 s solo needed)

| row | from | to | default solo time saved (f6t2 bcd837e copy) |
|---|---|---|---|
| f4-t1-view A2 1280x800: four Q10 exterior rebuilds and Q14 in 3D (5 rebuilds). The same geometry is judged in node by f4-t1-model 3a and 2. | default | rows3 (f4-t1-view --release-only) | f4-t1-view 64 → 40 s (with D loop) |
| f4-t1-view D loop 1280x800. It duplicates D loop 360x640, and the default run keeps the idle checks of the leak smoke. | default | rows3 | (in the line above) |
| f4-t2-view A roof 1280x800. It duplicates f4-t2-model (geometry), the f4-t1 A level matrix and f6-t1 D. | default | rows3 (f4-t2-view --release-only) | 20 → 13 s |
| f4-t2-s0-ui 1280x800, the desktop twin of 360x640 (as in rows 1-7). This one is 2D. | default | rows side (`--only=640x360,1280x800`) | 38.7 → 24 s |
| The f4-t1-view --release-only row (59 s → 64 s with A2 and the desk D loop). | rows side | rows3 | balance |

- **Total:** about 46 s solo from QA. FS offered its view3d-real indoor checks (about 7 s), which would make about 53 s.
- **Tried and reverted:** splitting the f4-t3 A seasons saved nothing (A stayed at 17.6 s), so it stays in the default run.
- **Solo times of the three release processes:**
  - rows3: 208.4 s (sample stream 36.6 s, rows 171.8 s);
  - rows side: 224.7 s;
  - stream side: about 181 s.
  - When the three run in parallel, they will be slower. FS re-times.
- **Timing-sensitive checks:** none of the moved rows has one. The f4-t3 setLook check stays in the default run.

## Addendum 7: after F6-T2, QA_FULL-only duplicates cut by at least 20 s (TL ruling)

Every check is kept. Each row below now runs once per gate in the release step instead of in the QA_FULL pool.

| row | from | to | solo time (main copy) |
|---|---|---|---|
| f2-t2-questions twins (A, C, G, K at 640x360 / 768x1024 / landscape): QA_FULL keeps 360x640 and 1280x800 | QA_FULL | stream side (`--no-shots --twins-only`) | 24 s, 239 checks |
| f4-t2-view A roof and B interior at 360x640 (desktop twins stay in QA_FULL) | QA_FULL | rows3 (f4-t2-view --release-only) | in its 37 s row |
| f4-t3-view E 640x360 and 768x1024 (the edge hours stay in QA_FULL) | QA_FULL | rows3 (f4-t3-view --release-only) | in its 20 s row |
| f1-t1-layout 768x1024 pass (scenes, stepper, strip) | QA_FULL | rows side (f1-t1-layout --release-only) | in its 34 s row, 592 checks |
| f4-t2-s0-core A/B large samples (A 300, B 400 with 250 high, retry hunt 15). QA_FULL now runs the default 120 / 140 / 80 / 10; `--big-only` runs only the extra cases | QA_FULL | stream side (`--big-only`) | 24.2 s (QA_FULL s0-core 34.2 → 22.9 s) |

- **Before (5ccfd2b):** QA_FULL part 476.5 / 496.1 / 478.4 s, median 478.4 s.
- **After (three QA_FULL + QA_RELEASE runs):** QA_FULL part (run-all total minus release wall time) 457.9 / 454.5 / 464.2 s, median 457.9 s: **−20.5 s** on the median, −24.8 s on the mean.
- **Release step:** wall time 724.2 / 736.0 / 743.4 s (was about 651 s; under the 800 s line). Rows 243.0 / 247.1 / 248.0 s, stream 253.9 / 253.8 / 253.7 s, rows3 227.3 / 235.1 / 241.8 s; all ≤ 260 s, no NOTE. The stream side is close to 260 s, so the next move goes to rows3.
- **Flake seen:** run 1 failed e2e/questions.spec.mjs 768x1024 "back to the sample answers" (north stayed 90 after q-north-reset following the compass drag); runs 2 and 3 passed. This spec and src are unchanged by this cut, so it is a load race; reported to FS and TL.
