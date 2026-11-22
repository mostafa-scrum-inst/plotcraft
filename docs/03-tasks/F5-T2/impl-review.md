# F5-T2 — TL implementation review (round 1), 2026-11-22

Scope: worktree /home/user/plotcraft-f5t2, branch `f5t2` at 939deb6. Reviewed against:
- `plan.md` as amended;
- my `plan-review.md` (required items 1–7, rulings Q1–Q9);
- PM round 13;
- F5-S2 and G1;
- A-12 and A-14.

## Evidence
- **Focused run in the worktree.** `--unit --three --e2e --only tourplan,tour,finder,camera,budget,view3d` passed in 31.8 s: unit 420, three 85, view3d 115, view3d-real 53.
- **Real r128, my own frames** (sample, paused after a seek, dpr 1):
  - 360x640 at τ 10.7: "Living · Ground floor". The room and its frame are in view, and the caption pause/stop buttons show.
  - 1280x800 at τ 33.1, mid-leg towards the Office: First is selected, Roof is off, and the highlight is on the Office as the camera approaches.
  - No console errors.
- **Code read:** `tourplan.js`, `tour.js` (soft floors, curves, lead-in, `debugSeek`), and the driver's `end` / `pause`.
- **FS full run:** 458.2 s, FAILED. Only the 4 section-A checks of `qa run-f5-t2` failed (rulings below).

## Plan-review items
1. **PM round 13.** Met:
   - the caption reads "Overview" or "Room · Level";
   - the highlight marks rooms only;
   - after Stop or a gesture, camera, level and Roof stay as they are, and the caption, highlight and select clear;
   - speed is session state, Normal by default.
2. **Eye floor from the table.** Met. The literal-5.33 mutation is killed.
3. **Clamp does not bite at stops.** Met for the hard clamp: tested on 5 houses × 2 aspects. See deviation 2 for the soft lift.
4. **Silent programmatic level changes.** Met. A G → 1 seek keeps the tour running, and the `change`-dispatch mutation is killed.
5. **Basement on real r128.** Met. Two of the 10 basement stops are checked on the maximum house: first visible hit, and ≥ 40 highlight pixels. QA section B passes.
6. **Full run measured.** Met (458.2 s). The merge condition is below.
7. **Docs.** The A-14 as-built text is updated in this review for the deviations.

**Q1–Q9:**
- Q1: stops are exact at tᵢ through `getPoint`.
- Q2: 53.5 / 144.5 / 8 s.
- Q3: the level switches at the leg start.
- Q4: one eye floor.
- Q5: the look point is at floorY + 0.5.
- Q6: the driver gains `{ pose, done }`, `end(reason)` exactly once (tested on every path) and `paused` with no frames; the F5-T1 tests are green and unchanged.
- Q7: every frame is clamped.
- Q8: `debugSeek` is test-only, enforced by a grep test.
- Q9: the ending actions are as ruled; the Light tab and speed do not end the tour.

## Rulings on FS's deviations (impl-notes §2): all four accepted
1. **Uniform Catmull-Rom over the look points, plus a pose-space curve over `(θ unwrapped, φ, radius)`, instead of two centripetal eye/look curves.**
   - The reason is real: time-linear `getPoint` on centripetal curves gave about ×3 speed jumps between legs of different length.
   - The basement leg drove φ into the 5° clamp and spun θ.
   - Stops are still exact at tᵢ (Q1), and the path is smooth and turns round the look point, which meets F5-S2's "one continuous smooth curved path".
   - The A-14 "two curves (eyes, looks)" text is superseded.
2. **Soft floors** (`lo + m·e^((x−lo)/m − 1)` below `lo + m`, so value and slope are continuous) on radius, φ and eye height, with the hard clamp after them.
   - At stops whose eye is within 1 m of the floor, the eye rises by at most `m/e ≈ 0.37 m` along the line of sight. The look point and the stop time stay exact.
   - Accepted: the eye only goes higher, A-14's minimum height still holds, and the view does not change character.
   - Test (QA): the lift at any stop is ≤ 0.4 m.
3. **Eased first and last legs**, with slope 1 at the join so there is no speed step. Accepted: starting from rest and ending at rest is no "stop-and-snap".
4. **1.2 s lead-in flight** to the overview when Start finds the camera more than 0.5 m away. Accepted: it prevents a cut at Start.
   - It is part of the tour: τ stays 0, the caption reads "Overview", and the same ending actions apply. Pause and Stop work during it (QA checks).

**QA's reference follows the as-built model.** I sent the exact model and the minimum checks to QA directly:
- the look point exact at tᵢ;
- eye ≥ floor on every frame;
- a lift ≤ 0.4 m at stops;
- the smoothness bounds;
- reimplementing the pose curve to 1 mm is optional.

## QA's 4 section-A failures: test procedure, not product faults
- **Curve oracle:** the wrong model (see above).
- **Seek-then-read on real r128:** at about 117 ms frames with the 100 ms cap, τ advances about 0.5 s before the read. Procedure: Pause → seek → Resume → read; the first frame has dt 0.
- **Pause-by-tap and Light preset:** knock-ons of the drift; the tour had already ended.
- **"Stop: the view jumped 1.06 m":** that is the tour's own motion during the click latency. Measure the pose immediately before and after `stop()` in one evaluate, or Pause → read → Stop → read; the reads must be identical. The three test already shows the pose identical across `stop()`.

## Merge conditions
1. QA updates `run-f5-t2` per the above. All its checks pass, and the suite takes ≤ 20 s (it is 47.4 s).
2. The full run is ≤ 420 s at `--jobs 3` (it was 458.2 s).
   - If the `run-f5-t2` trim is not enough, QA moves heavy seeded or real-r128 sweeps in f1-t1, f1-t3, f2-t2 and f2-t3 behind `QA_FULL=1`, as in f4-t2-s0, keeping one representative case each.
   - FS's additions (about 3 s, one extra reload for the G1 draft path) are fine.
3. **Standing condition (restated):**
   - the `f4-t2-s0-core` stream cut (7344339: 300 → 120 and 400 → 140 plans, 15 → 10 retry layouts) is accepted, because CD-4 coverage stays in FS's unit layer (`layout10`: 105-case worst grid and a 300-programme stream, both golden-pinned; `layout-sweep` ≥ 2 000 programmes);
   - QA runs **`QA_FULL=1` once before the F5 feature review**, and whenever `core/layout.js` or `core/access.js` changes (or the code behind any other sweep moved behind `QA_FULL`).

## Findings (non-blocking)
- **API pause and the UI.** `PC.three.tour.pause()` called from outside the UI does not update the buttons' `aria-pressed`, as my scripted frame showed. No user path does this (the buttons and caption sync, as tested), so no action, but tests must pause through the UI or read `state()`.
- **Mid-leg framing.** Mid-leg the camera still shows the previous room while the next one is highlighted at the edge of the view. That is natural for a fly-through; the Designer judges the pacing in F5-T3 (leg times are data in `C.TOUR`).
- **`tour.js` `ended` guard.** It survives its mutation as an equivalent: the driver guarantees one `end`. It may stay as a defence.

## QA focus list
1. The as-built model checks: stops, floor, lift ≤ 0.4 m, smoothness.
2. Coverage: every room visited once, levels ascending (basement first), each room's level on top when it is approached, and the ground opened for B (real r128: 2 basement stops plus a leak check during the tour).
3. Controls:
   - Start (with lead-in after a finder pick or an orbit), Pause/Resume from both button sets, Stop, gesture also while paused;
   - level radio, Reset, Roof on and a finder pick each end the tour;
   - the Light tab and speed do not;
   - leaving stage 5 does not restart it.
4. After the end: camera, level and Roof kept; caption, highlight and select cleared.
5. G1: 4 taps on a phone (5 with a stored draft), 3 on desktop; all controls ≥ 44 px.
6. Budget: ≤ 22 meshes during a tour, every highlight geometry disposed; the look untouched (22:00 winter mid-tour).
7. Durations at slow / normal / fast: sample 53.5 s at normal; maximum house 144.5 s.
8. Full run ≤ 420 s, and the `QA_FULL=1` condition above.

VERDICT: APPROVED
