# F5-T3c implementation notes (FS)

Task: TL F5-T3 outcome review, routing item 1. Change `tests/run-all.mjs` so that browser files start longest first, using a committed duration table.

## Change

- `tests/run-all.mjs`:
  - Before the pool starts, the browser tasks (e2e specs and QA runners) are sorted: files missing from `tests/durations.json` come first (pessimistic), then the rest by descending seconds, with ties broken by label. The order is deterministic.
  - Output stays buffered per task.
  - `--only`, `--jobs` and the step flags are unchanged. A missing or unreadable table means every file is unknown, which falls back to alphabetical order.
  - New flag `--write-durations`: at the end of a green full run (all steps, no `--only`), it rewrites `tests/durations.json` with label → seconds (0.1 s, keys sorted). Otherwise it prints "durations not written" and leaves the table as it is.
- `tests/durations.json`: seeded from a green full run with `--write-durations` (419.4 s, alphabetical order because every file was unknown). The table has 39 files.
- `docs/02-features/architecture.md` A-16: the scheduling rule and the table refresh rule were added to the runner-flags paragraph. The 420 s target and the other lines are unchanged.

## Runs (`--jobs 3`, main, nobody else running suites)

| Run | Order | Result | Time |
|---|---|---|---|
| seed | alphabetical (table empty) | green | 419.4 s |
| 1 | longest first | green | **405.3 s** |
| 2 | longest first | green | **412.2 s** |

- The target was ≤ 405 s. **Run 1 meets it; run 2 misses it by 7 s.**
- LPT is already at its floor:
  - In run 1, the browser files took 1166.6 s of work in total. Divided by 3, that is 388.9 s, and unit + three add 16.1 s, for 405.0 s. The wall time was 405.3 s, so the three slots stayed busy until the end, with no idle tail left to remove.
  - In run 2 the work was 1181.6 s (393.9 s per slot) and unit + three took 17.9 s.
- So the remaining spread comes from per-file run-time noise, not from scheduling.
- Per the routing, the next step is QA's call: move a further real-r128 section behind `QA_FULL=1`. The 420 s and 480 s lines do not move.

## Contract changes (A-16 rule)

The runner's command line, exit code and per-file output lines are unchanged. Only the start order of the browser files changes. Every reader:

- Humans and agents reading the log (TL, QA, FS, the orchestrator) are affected only in that files now appear in a different order. The final "run-all: all steps passed in X s" line is unchanged.
- No script parses the run-all output or relies on the file order. I grepped `tests/` and `docs/` and found none.
- The browser files are independent processes (A-16), so the order cannot change a result.

QA shot and metrics files rewritten by the runs (`tests/qa/shots/F1-T1/metrics.json`) were restored and are not committed.

## TL ruling (2026-11-22)

**Accepted as is.**
- **Result.** Two green full runs at `--jobs 3`: 405.3 s and 412.2 s.
  - Run 1 is at the scheduling floor: 1166.6 s of work / 3 slots, plus 16.1 s for unit and three, gives 405.0 s.
  - The 7 s gap between the runs is per-file noise.
  - Real headroom to the 420 s line is 8–15 s.
- **No QA trim now.** Moving a real-r128 section behind `QA_FULL=1` would give up default coverage with no time problem to solve. The next batch is reviews, with no new tests.
- **Standing rules:**
  - Any later task that adds test time buys it back in the same task (outcome F5-T3a §8 item 4).
  - The noise rule stands: a single run of 420–440 s is re-run once; two in a row over 420 s, or any run over 440 s, require a trim.
  - 480 s is never exceeded.
  - `tests/durations.json` is refreshed with `--write-durations` after the green release-gate run.
- **Contract check (A-16 rule):** done and sufficient. The output format and exit code are unchanged, and no script parses the order.

VERDICT: APPROVED
