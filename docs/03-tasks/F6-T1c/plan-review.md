# F6-T1c plan review (TL), 2026-11-22

Reviewed: `plan.md` (FS, 59f5c99), against `designer-plan.md` (ae92960), `designer-plan-review.md` and the F6 constraints.

The plan follows the Designer-plan rulings. The scope is R1, R2, R3, G1 and W1. R4, R5, G2b and W2 are out. The build starts from main after the f6t1 merge and publish. No changes are required.

## Rulings

1. **Q-F1: `roofDeck` uses Lambert. Approved.**
   - Every lit surface uses one lighting model, which adds no second shader program on phones.
   - The membrane look comes from the texture.
   - The Designer judges the result on the shots.
2. **Q-F2: the fallback is approved without another plan round.**
   - If the shots show a flat rim, the R3 band may move into `roofDeck` as vertex colours, still one mesh.
   - Record it in the impl notes as a deviation, with the test adjusted.
   - Keep the roofBatch item order (decals last) either way.
3. **Q-F3: G2 may join T1c, as data only, if the Designer asks.**
   - It covers the meadow `tileM` 48 and broader octaves, in the same commit as the Designer's retune.
   - The texgen hash goldens are updated in that commit, and no new tests are added.
   - G2b, the tinted octave, still needs the CTO.
4. **Q-F4: agreed.** The lift run is subtracted from the free runs, so a lift shaft gets no hall pane. The stair keeps its slot window.
5. **Drip edge in `exteriors.slab`: accepted as a contract change.**
   - The flat slab box changes colour from `roof` to `slab` and grows by 2 × `dripOut`.
   - The readers listed are correct: `roof.test` and QA f4-t2-model's roof compare.
   - QA must get the change before the impl review.
6. **Texgen timing (watch item from T1a, finding 10).** One more 512² kind adds about 10 ms, and the C-3.2 test (≤ 150 ms best of 3) is already close.
   - Report its best-of-3 in the impl notes.
   - If that is over 130 ms, move the check to the C-4.8 pattern before the gate:
     - a default guard of ≤ 300 ms, best of 3;
     - the ≤ 150 ms budget as a solo step under `QA_FULL=1`.
   - Tell the CTO, since only the place the check runs changes.
7. **Run time.** The T1c tests are mostly node tests. Their combined added time must stay ≤ +5 s of default wall time on top of the post-trim baseline. The gate stands as in §6:
   - two quiet default runs ≤ 420 s, with no other agent's full run beside them;
   - `QA_FULL=1` ≤ 480 s;
   - the release step ≤ 300 s;
   - both duration tables re-timed.

VERDICT: APPROVED

## Addendum: dist tripwire (TL)
- The lint `DIST_MAX_BYTES` tripwire (the inlined three.js check) goes from 600 000 to 700 000. T1c brings the dist to 604 890 bytes.
- C-1.3, dist ≤ 627 kB, remains the budget and is unchanged. T1c leaves about 22 kB of it. The CTO was informed.
- CTO condition: the C-1.3 line becomes the exported `DIST_BUDGET_BYTES = 627302`, with a message pointing to a CTO review and a boundary test, landing in T1c. The kB check has existed since T1a.

## Addendum: T1c run time (TL, 2026-11-23)
- **Measured:** default runs took 426.2 s and 426.5 s, +15 s over the 411.2 s baseline. Of that, 13.5 s comes from QA's new T1c rows and the rest is the W1 cost on maximum-house suites.
- **Ruling (a):** QA moves the maximum-house parts of its T1c rows into the release rows process. The sample-house checks stay in the default run.
- **Gate:** the gate stays at 420 s. The target is two quiet runs ≤ 415 s.
- **Accepted:** the per-suite W1 cost.
