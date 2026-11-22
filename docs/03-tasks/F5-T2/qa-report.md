# F5-T2 QA report

Date: 2026-11-22. Author: QA. Brief: the 8-item QA focus list in `impl-review.md`, the TL's rulings for QA (as-built
curve model, seek and Stop procedures, run time), my prepared suites, and one full run. Tested in main at `e46f533`
(f5t2 merged), plus my test changes (committed with this report).

## Summary

- **Verdict: PASSED. I found no bugs.** Every focus item passes. The first full run after the merge came in over the
  420 s target, so I trimmed the default test streams (see Run time).
- **Suites** (version-aware on `PC.tourplan` / `PC.three.tour`):
  - `tests/qa/f5-t2-model.mjs` (node, 6 checks):
    - S: stops and order;
    - E: eyes and looks (2 checks);
    - T: times;
    - C: `fromEyeLook`, and the clamp at stops (2 checks).

    The checks run on 5 houses: the sample, one room, a basement house, 2.4 m ceilings and the 40-room maximum house.
  - `tests/qa/f5-t2-view.mjs` (real r128, 10 checks). It loads one page per viewport.
  - Oracle `tests/qa/f5-t2-ref.mjs`; runner `tests/qa/run-f5-t2.mjs`.
- **TL rulings applied:**
  - The plan's centripetal reference curve is dropped. At each stop the target must equal the stop's look point (1 mm)
    and the eye may sit at most 0.4 m above the plan eye. The eye floor and the no-jump bound are checked on every frame.
  - Seeks pause the tour, seek, show one dt-0 frame, then read.
  - Stop is checked by reading the pose, clicking and reading again in one task. The two reads are identical.
- **Run time:**
  - `run-f5-t2` takes 20-22 s alone (47.4 s on FS's branch) and 26-41 s in parallel runs.
  - **Full run** (`node build.mjs && node tests/run-all.mjs --jobs 3`): **exit 0 in 413.3 s**, under 420 s.
  - The first post-merge full run took 431.4 s and a second one 436.6 s, so I trimmed the default streams below.
- **Mutations** (throwaway copies; I made no changes in `src/`): **7 tried, 7 caught.**

## Focus list

1. **As-built model checks.** Pass.
   - Stops:
     - every room once, levels ascending with the basement first, nearest-neighbour order;
     - the nearest-neighbour walk is anchored at the look point, measured in 2D;
     - times 4 / 3.5 s; sample 53.5 s, maximum 144.5 s, one room 8 s.
   - Eye floor: 5.33 m, read from the vegetation table. Every stop eye is at it or above; with 2.4 m ceilings the ground
     eyes sit exactly on it.
   - `PC.cam.clamp` leaves every stop pose unchanged on all 5 houses.
   - In the page, at τ = tᵢ the target equals the stop's look point (1 mm) and the eye is at most 0.4 m above the plan
     eye.
   - Every recorded frame keeps the eye at or above the floor, with no step over 3 x speed x the leg's chord speed.
2. **Coverage.** Pass.
   - Seeking to the leg for the first room upstairs and to the last leg gives the right caption, level (UI and scene) and
     highlight.
   - The programmatic level switch from Ground to First keeps the tour running.
   - Maximum house, 2 basement stops on real r128:
     - groundCap is hidden;
     - the room is the first visible hit from the eye;
     - the highlight changes 1 485 px;
     - no `groundOuter` pixel shows inside the footprint (the B-1 class check, run during the tour).
3. **Controls.** Pass.
   - **Start:**
     - after a finder pick it clears the selection and turns the Roof off;
     - the lead-in caption reads "Overview";
     - the look stays at 22:00 winter, with no `setLook` call.
   - **Pause and Resume:**
     - Pause by tap: `aria-pressed` true, label "Resume tour", the caption button mirrors it, the pose is frozen and no
       frames are requested.
     - Resume by keyboard: no jump.
     - Phone: the caption's pause pauses the tour, and the panel button mirrors it.
   - **Ends.** Each of these ends the tour:
     - a canvas drag while running;
     - a gesture while paused;
     - Stop (both button sets);
     - a level radio (applied);
     - Reset (applied);
     - Roof on (applied);
     - a finder pick (its flight runs).
   - **What does not end it:**
     - A Light preset keeps it running (one `setLook`, the preset's).
     - Fast: τ advances at 1.8 times the capped frame time, with no jump.
   - Leaving stage 5 ends the tour, and it does not restart on return. Fast is kept.
4. **After the end.** Pass.
   - The camera, level and Roof stay as they were.
   - The caption and highlight are cleared, and the select shows "Go to room…".
   - Stop changes nothing in the pose.
5. **G1.** Pass.
   - 3 taps on desktop and 4 on a phone with no draft; 5 with a stored draft (Load sample asks for confirmation).
   - Start is ≥ 44 px. The caption's pause and stop are ≥ 44 px and inside 360 px.
   - A reload gives Normal speed (not stored in the draft).
6. **Budget and look.** Pass.
   - At most 22 meshes at stops on B and 2.
   - The renderer's geometry count is equal between the two basement stops (one highlight alive).
   - The look is untouched at Start (22:00 winter).
7. **Durations.** Pass.
   - Speed factors 0.6 / 1 / 1.8 (`PC.C.TOUR.speeds`).
   - Sample 53.5 s at Normal, maximum house 144.5 s.
   - Fast measured in the page as τ rate 1.8.
8. **Full run.** Pass: 413.3 s. QA_FULL=1 for the trimmed suites: see below.

## Run time: trims behind `QA_FULL=1` (TL ruling 3)

| Suite | Before (full run) | After (full run) | Trimmed by default (QA_FULL=1 restores) |
|---|---|---|---|
| run-f5-t2 | 47.4 s (FS branch) | 41.2 s parallel, 20-22 s alone | one page per viewport, paused seeks, ends from a paused tour except the drag, 2 basement stops (pixels on the first) |
| run-f1-t1 | 95.4 s | 73.9 s | layout sweep without 768x1024 |
| run-f2-t2 | 91.9 s | 78.0 s | sections C, G, K at 360x640 + 1280x800 only |
| run-f2-t3 | 95.8 s | 78.5 s | sections B, F (plot shapes), M at 360x640 + 1280x800 only |
| run-f4-t2-step0 | 81.4 s | 63.1 s | UI without 640x360; core seeded streams 120 / 140 / 10 instead of 300 / 400 / 15 |

**Standing condition (TL):** run `QA_FULL=1 node tests/run-all.mjs --qa --only f1-t1,f2-t2,f2-t3,f4-t2-step0` before
the F5 feature review, and whenever the code those sweeps guard changes. Run in this round on `e46f533` + my test
changes: **all 4 green in 184.4 s** (f1-t1 98.2 s, f2-t2 94.6 s, f2-t3 100.0 s, f4-t2-step0 89.7 s).

## Mutations

| Mutation | Result |
|---|---|
| `TOUR.treeGap` 0.5 → 0 (the eye floor table) | caught (model E, view) |
| levels in descending order | caught (model S, view) |
| Start not forcing the Roof off | caught (view, 2 checks) |
| `speeds.fast` 1.8 → 1 | caught (model T) |
| Roof on not ending the tour | caught (view ends) |
| the tour calling `setLook` at Start | caught (view Start; added in this round) |
| `groundOuter` without the footprint hole (B-1) | caught (view, maximum house) |

## Test changes in this round

- f5-t2-view brought in line with the TL rulings:
  - the as-built stop checks replace my centripetal curve;
  - paused seek-read;
  - Stop read, click and read in one task;
  - the lead-in caption.
- Run-time work: one page per viewport; ends run from a paused tour.
- New checks:
  - desktop G1 (3 taps) and G1 with a stored draft;
  - Roof on ends the tour;
  - the `groundOuter` leak during the tour;
  - no `setLook` at Start.
- Default-run trims in f1-t1-layout, f2-t2-questions, f2-t3-site-rooms and f4-t2-s0-core / -ui (table above).

VERDICT: PASSED
