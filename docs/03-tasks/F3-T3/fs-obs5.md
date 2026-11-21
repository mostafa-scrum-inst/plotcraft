# F3-T3 carried item (FS): QA F3-T2 observation 5, moveRect span

**Change** (`src/js/core/plans.js`, `moveRect`, one line). The neighbours' span across the moving axis is now taken from the clamped position on the other axis, not the finger:
`s0 = p === 'x' ? clamp(start.y + dy, 0, D - h) : clamp(start.x + dx, 0, W - w)` (written with `Math.min / Math.max`, `ctx.D - r.h` / `ctx.W - r.w`). No other `plans.js` change.

**Test** (`tests/unit/plans-edit.test.mjs`, new case "a move past the footprint takes the neighbours' span from the clamped room"). On the synthetic floor (W 9.7, D 10), room A 4 x 4 is dragged dx 0.33, dy 9: finger span y 9..13, clamped y 6..10. Neighbour B (x 4.13, y 5..8.5) overlaps only the clamped span (0.5 m from the finger span, beyond 0.3 m). A must land at y 6 with its right edge on 4.13, in the m and ft grids.

**Mutation.** Reverting the line to `start.y + dy : start.x + dx` makes the new case fail (plans-edit 10/1). Restored: 11/0.

**Results** (focused only, no full run, because QA is timing the trim):
- `node build.mjs`: ok.
- `node tests/run-all.mjs --unit`: 320/0.
- `node tests/run-all.mjs --qa --only f3-t2`: edit 9/0, and the note "moves past the footprint where the app takes the neighbours' span at the finger" is **0** (it was 76 of 5 600). Editor 182/0, 36.4 s.
- `node tests/run-all.mjs --e2e --only plans-edit`: 65/0. The counts are lower than the 190 / 110 recorded before, because the QA trim edits are in the working tree. FS did not touch tests/e2e or tests/qa.
