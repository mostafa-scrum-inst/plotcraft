# F6-T1 — QA_FULL=1 moves (Q-T8), QA proposal for the TL

Input: FS step-1 spike (worktree plotcraft-f6t1, throwaway, +-15 %). The real-r128 subset goes from 252.6 s to 399 s of work
(+146 s). That is about +50 s wall at --jobs 3 on a 405-412 s base, so about 455-460 s, before FS's ~12 s of view3d-real checks.
New F6 QA suites (gated until the F6 marker `PC.C.VIEW3D.tiers || PC.texgen` exists): f6-t1-view ~6 s and f6-t1-leak 27 s
(50 ops, sample) today, so roughly 10 s + 45 s at the spike's 2.1x frame cost.
Target: buy back about 55-65 s wall, which is about 170-200 s of work.

Section timings on main today (QA machine, quiet, seconds), with the post-spike estimate using the FS per-file factor:

| suite / section | now | after F6 (est.) | move to QA_FULL=1 | saves (est.) |
|---|---|---|---|---|
| f5-t1 A 1280x800 (finder: flights, redirect, 3 cancels) | 30.5 | ~57 | the mouse-down and arrow-key cancels, and the frame-by-frame flight log after the first pick (the wheel cancel and one recorded flight stay) | ~20 |
| f5-t2 A, maximum-house part (same page) | ~9 of 20.1 | ~19 | the maximum-house stops (meshes at 3 stops, basement highlight, groundCap) | ~19 |
| f4-t1 C 640x360 touch gestures | 10.4 | ~16 | all of it (360x640 touch and 1280x800 mouse stay) | ~16 |
| f4-t1 D loop 360x640 | 4.9 | ~7 | all of it (1280x800 loop stays) | ~7 |
| f4-t1 A 360x640 | 3.2 | ~5 | all of it (1280x800 and the mock stay) | ~5 |
| f4-t2 A roof 360x640 + B interior 360x640 | 6.8 | ~12 | both (the 1280x800 passes stay) | ~12 |
| f4-t3 A 32-look matrix (4 seasons x 8 hours) | part of 10.6 | ~8 | the 0 / 6 / 18 / 24 h edge hours (16 looks with the presets stay) | ~4 |
| f4-t3 E 640x360 + 768x1024 | 1.9 | ~3 | both | ~3 |
| f6-t1-leak 200 ops on the maximum house | - | ~110 | already QA_FULL only | - |
| **QA real-r128 total** | | | | **~86 s of work** |

That is about half of the need. The rest has to come from elsewhere, so I propose these too (TL call):
- e2e view3d / view3d-real (FS-owned, +31 s of work in the spike): the FS checks that duplicate a QA section (the roof switch, loop idle, context loss) go QA_FULL only.
- f6-t1-leak default: keep 50 ops (Q-T8), but on a 960x600 viewport. That cuts per-frame fill and saves about 10 s. The 1280x800 maximum-house stream stays in QA_FULL.
- If still short: f1-t1-layout 640x360 is not touched by F6, but it is a 3D-free viewport pass. Measure it first.
- Not proposed: forcing `tier: lite` in behaviour suites through an init script (TL call, ~15 % per frame). It would stop those suites from seeing the full look, and the F6 checks (seam, dome) only run in full.

Every move keeps the check at 1280x800 or on the sample, and QA_FULL=1 restores it. I implement the agreed set when the
F6-T1a build lands, then re-time on that build. The QA_FULL total is checked against 480 s with the new leak stream.
