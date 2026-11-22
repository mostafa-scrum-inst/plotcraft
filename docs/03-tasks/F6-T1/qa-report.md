# F6-T1 QA report (T1a + T1b)

Date: 2026-11-22. Author: QA.

**Tested on:** f6t1 at `fa8674d` (T1a, Designer retune c540c49 / e775004, T1b, TL approval), copied to a scratch
directory; QA suites from main (`2aae57d` plus the new `tests/qa/f6-t1-model.mjs` in this commit). The machine had no
other agent's browser runs during the runs below (load average 0.01 at each start).

## Summary

- **Function: all green.** Default run 11 274 checks / 0 failed; `QA_FULL=1` 12 719 / 0; release step 6 / 6.
- **No product bugs found.**
- **T-1 (timing, for the TL):** my two quiet default runs were **425.8 s and 432.8 s**, over the 420 s line (FS's gate
  runs: 417.3 / 418.2 s). Under the re-run rule this does not hold on my side. Details and proposal below.
- **Visual check against CD-8:** the build reads as a house in a garden at every hour and season I looked at. Two
  style observations (V-1, V-2), no defects.

## Coverage

| Area | Where | Result |
|---|---|---|
| T1a materials, textures, sky dome, paving, north needle, roof tiles, budgets | f6-t1-view (B budgets, S/K/H), f4-t2 model/view, f4-t3, f3-t3 data | pass |
| Retune R7 (c540c49) sky / key / site tables, F6 `groundOuter` | f4-t3-model / -ref, f3-t3-data | pass |
| resetPhi 62: Reset pose, fog-near, dome clip | f4-t1-view (RPHI), f4-t2-view | pass |
| **Openings (plan §6.1, Q-D1, Q-D3), new** | f6-t1-model O: 9 named cases + 60 seeded fuzz houses. Kind by room type, sizes, sills, head clamp (ceiling 2.4), 0.6 m end clearance, count `max(1, floor((run - 0.6) / 2.6))`, even spacing / exact centres, stair slot per edge, door 1.0 x 2.2 on `entrance.u`, 0.6 m door clearance, sorted, none in the basement, deterministic, key follows | pass |
| **Decals, new** | f6-t1-model D: one glass quad per pane 0.01 m proud with glassTop / glassBottom gradient, 4 reveals each, door leaf box in `exteriors[x].door`, nothing > 0.09 m outside the footprint | pass |
| Contact darkening: skirts, floor rings, `groundRing` width `min(0.8, free - 0.05)` | f4-t1-ref T1B, f4-t2-model | pass |
| Trees / blobs: taper, lean ≤ 4°, lumps inside canopy envelope, per-item colour, blobs = trees + shrubs, winter count | f4-t3-view INST / instProblems, f4-t3-model D (VEG_T1B) | pass |
| Winter meadow (`#E4E8EA`, summer = `groundOuter`) | f4-t3-view, f3-t3-data | pass |
| Budgets: max house 26 meshes (27 with highlight), sample 20, vegetation 0 % 16, mesh limit 64 | f6-t1-view, f4-t2, f5-t2 | pass |
| Leak: 50-op sample stream (default); 200-op maximum-house stream (release) | f6-t1-leak | pass; max house ends at 27 meshes / 27 geometries / 4 textures |
| C-4.8 build-time solo | `QA_FULL=1` | 146 ms best of 3 (budget 400) |

**f6-t1-model mutation check** (throwaway copies): caught headGap, doorClear, glass offset, small-pane sill, pitch 2.8,
endClear 0.5, pane width 1.1, reveal re-tagged as glass. Survivors: pitch 2.5 and smallMin 0.5, because the plan's run
lengths are quantised and no real run separates them. Accepted.

## Runs

| Run | Result | Wall |
|---|---|---|
| default, 1 | green except f4-t2-step0 B (copy artefact: no `.git` for `git show 726514a`) | 425.8 s |
| default, 2 (git reachable, quiet machine) | **all green, 11 274 / 0** | **432.8 s** |
| `QA_FULL=1` | **all green, 12 719 / 0** | **474.9 s** (≤ 480) |
| release step (`QA_RELEASE=1 f6-t1-leak --max-only`) | **6 / 6** | **192.1 s** (≤ 300, no NOTE) |

- **f5-t2 tour-start flake** (seen once under `QA_FULL` on a724113): did not recur. f5-t2 view green in both runs
  (9 / 0 default, 10 / 0 `QA_FULL`).
- **O-1 shadow probe** (8 h drop from phi 62): accepted by the TL (T1b finding 7); not re-raised.

### T-1 default run timing (for the TL)

Per-file times against the re-timed `tests/durations.json` (FS gate): f5-t1 +14 s (60.3 vs 46.2), f6-t1 +10 s (55.6 vs
45.8; my new f6-t1-model adds about 3 s of work of that), e2e shell +7.5 s, f1-t1 +5 s; about +44 s of work in all,
about +14 s of wall. The QA rows are the ones FS's gate ran (`2aae57d`), apart from f6-t1-model. The same copy set-up
gave 405 / 401 s on T1a, so I read this as run-to-run spread in the 3D-heavy files, not a regression. But it means the
2 to 3 s margin is not real: the TL's 15 s buy-back should be treated as at least 20 to 25 s, and landed before the
next counted gate rather than "before the first gate that adds tests". My proposal follows separately.

## Visual check against CD-8

Shots taken on real r128 at 1280x800 and 360x640 (sample at noon / 17.5 h / 8 h autumn / 22 h and noon winter, a low
pose, a close pose, and the maximum house). Five are in `tests/qa/shots/F6-T1/`. The light panel in them shows a stale
time, because I set the look through `PC.view3d.setLook` directly, which by design does not drive the slider
(stage-3d.js wraps it with `renderLook`). Not a bug.

What now reads as realistic, against CD-8's scope:
- **Window and door detail:** framed, two-pane glazing with a sky-to-dark gradient, sills that cast a small shadow,
  reveals, and a wooden door with a paved step (close shot). Small service windows sit higher, as expected.
- **Lighting and shadows:** clear sun shadows at noon, long shadows from the wall and trees at 8 h, a warm 17.5 h
  evening, a readable blue night.
- **Landscaping:** lumpy, tapered trees with grounded blob shadows; autumn orange; bare winter trunks with snowy
  shrubs on a pale winter meadow.
- **Sky and ground:** horizon and sky gradient at Reset and from the low pose; paving and road read as surfaces.

Observations (style, not defects; none is in CD-8's acceptance list):
- **V-1 Maximum house façades are mostly blank.** The openings follow §6.1 exactly (checked: per storey, front = one
  pane + the door, left = 4 panes + 2 small, back and right none). The cause is the plan layout: the 30 S-size rooms
  fill 97 m² of a 1 194 m² storey footprint, and only room edges get openings. On the 38.5 m front it reads as a
  warehouse. The sample is fine (rooms fill 106 of 143 m²). Idea for the Designer: openings on circulation or empty
  edges, or a blank-run limit. Post-MVP.
- **V-2 As the TL noted:** the flat roof reads as a plain slab, and the far meadow is uniform. At 17.5 h the far meadow
  also turns a dark olive-brown at 1280x800, which is the least realistic part of the evening frame.

## Files in this round (main)

- `tests/qa/f6-t1-model.mjs` (new, node, about 3 s), added to `tests/qa/run-f6-t1.mjs`.
- `tests/qa/shots/F6-T1/` (5 PNGs, 2.2 MB).

VERDICT: PASSED (functional, no bugs). Timing T-1 goes to the TL: my quiet default runs were 425.8 s / 432.8 s.
