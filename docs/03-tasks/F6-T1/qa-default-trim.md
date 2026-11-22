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
