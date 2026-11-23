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
