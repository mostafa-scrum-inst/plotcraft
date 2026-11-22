# QA full gate before the F4 and F5 feature reviews

Date: 2026-11-22. Author: QA.

**Commit:** `aaaddae` (main). It contains F5-T3c: run-all now starts the longest files first, using `tests/durations.json`. I changed no product code or tests.

**Command:** `node build.mjs`, then `node tests/run-all.mjs --jobs 3`. The second run sets `QA_FULL=1`. Each run has the same steps:
- build;
- lint;
- unit tests (32 files);
- three.js tests (13 files);
- 39 browser files (e2e and QA suites), 3 at a time.

## Results

| Run | Time | Checks | Result |
|---|---|---|---|
| `QA_FULL=1` (release gate) | 450.4 s | 4774 passed, 0 failed (browser suites); unit 422 / 0, three 89 / 0 | **all steps passed** |
| Default | **398.8 s** (≤ 420) | 4580 passed, 0 failed (browser suites) | **all steps passed** |

The `QA_FULL=1` run is not held to the 420 s target, because it is the release gate and not the default run. It is still under the 480 s cap.

## What `QA_FULL=1` added

Each item below was confirmed from the run output.

- **CD-4 streams at full size** (`f4-t2-s0-core`):
  - 300 seeded 9–10-room states (120 by default);
  - 400 generate programmes, 250 of them at high fill (140 / 80 by default): "Step 0 1665 ms vs pre-Step-0 7051 ms over 400 programmes";
  - the seeded-level sample at full size;
  - 14 / 0.
- **Device sweep (Designer):** 360x640, 640x360, 768x1024 and 1280x800, with the interior fold at 5 viewports. 380 / 0 (186 by default).
- **Trimmed QA viewports and sections, all restored:**
  - `f1-t1` layout: 768x1024;
  - `f1-t2` J: the seven storage modes at 1280x800;
  - `f1-t3` I, L and N: every viewport;
  - `f2-t2` A: 640x360. C, G and K: every listed viewport;
  - `f2-t3` B, F and M: every listed viewport;
  - `f4-t2-s0-ui`: 640x360. 63 / 0, against 53 by default;
  - `f5-t3`: C 360x640, the collapsed-panel tour pass, and the tour-frame sweep with its 45° / s check.
- **Slowest files under `QA_FULL=1`:**

  | File | Time |
  |---|---|
  | f1-t3 | 99.6 s |
  | f2-t3 | 97.1 s |
  | f1-t1 | 93.9 s |
  | f4-t2-step0 | 91.4 s |
  | f2-t2 | 91.3 s |

## Findings

None. No bugs and no flaky results: every step passed on the first run in both modes.

The default run at 398.8 s gives back about 20 s of headroom compared with the 419.8 s run in the F5-T3a round 2, which is the effect of the F5-T3c longest-first scheduling.

VERDICT: PASSED
