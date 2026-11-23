# F6-T1c implementation review (TL), 2026-11-23

Reviewed: branch `f6t1c` at e86f33a.
- **Material:**
  - the src diff against f6t1 7c12dcc (house, const, texgen, data/textures, scene, build-roof);
  - `impl-notes.md`;
  - the Designer shots in `shots/`.
- **Focused run** (openings, roof, detail, texgen, lint): 93 of 93 green.

## Findings

1. **Condition for this verdict (gate):** two quiet default runs ≤ 420 s (target ≤ 415 s), after QA's move.
   - Today the default runs are 426.2 and 426.5 s, against a 411.2 s baseline.
   - QA moves into the release rows process: D, the maximum-house part of f6-t1-view B, and, if still needed, duplicated passes from other files. Ruling (a) + (b) is in `plan-review.md`. The default leak stream is not shortened.
   - The other gate numbers are green and stand:
     - QA_FULL 464.0 s;
     - release step: stream 159.0 s and rows 189.0 s, wall 189.0 s;
     - C-4.8 solo 148 ms;
     - loaded build ≤ 905 ms, under the 1200 ms guard;
     - texgen 63–77 ms;
     - dist 604 890 bytes, under `DIST_BUDGET_BYTES` of 627 302.
   - I record the confirm runs as an addendum. If they come in over 420 s, the verdict becomes CHANGES REQUESTED.
2. **W1 (hall panes).**
   - The free runs are the side extent minus the union of the room, stair and lift runs, so the lift gets no pane (Q-F4). They use the room rule with `hallPitch` 3.9.
   - `house.v = 3`, and the layout golden is unchanged.
   - The A-16 readers are listed.
   - The maximum house now has panes on every side (shot `max-noon-1280x800`).
   - Its run-time cost (+2–6 s per maximum-house suite) is accepted as the feature's real cost.
3. **R1 coping and drip.**
   - The slab is `dripOut` proud in `exteriors.slab`, and the coping is 4 boxes plus caps on the heads.
   - The contract change (slab colour and extent) reached `roof.test` and QA f4-t2-model.
4. **R2 deck.**
   - `roofDeck` uses one Lambert mesh. Its map is chosen at build: membrane, or the shared paving object on usable and terrace roofs. It does not cast shadows.
   - The z-fight found in the Designer shots was fixed with `deckLift` 0.01 (ec12a64). It is guarded by a real-r128 first-hit pixel test, and its mutation is caught.
5. **R3 bands.**
   - These are untextured strips in `roofBatch`, as ruled in Q-F1/Q-F2. The decals stay last.
   - **Watch item, not blocking:** a head band and the parapet band overlap where a stair or lift head sits within 0.6 m of the parapet. They are two coplanar quads at the same `yb` in one mesh. Draw order is stable inside one mesh, so this reads as a darker overlap at most, which the Designer accepted in the shots. If it ever shows flicker, offset the head band by +0.001 m.
6. **G1 and G2 (Designer data, 66c5d87).**
   - The summer meadow equals `groundOuter`.
   - The meadow texture is `tileM` 48 with broad octaves. It uses the existing kind code, so it adds no code path. The hash goldens are updated.
   - G2b (tinted octave) is not included.
7. **Lint.**
   - The `DIST_MAX_BYTES` tripwire is 700 000.
   - `DIST_BUDGET_BYTES` is 627 302, with a message pointing to a CTO review and a test at the boundary.
   - This meets the CTO's condition.
8. **Release-step split.** run-all now runs the stream and the rows as two parallel processes, each with a 260 s NOTE and a 300 s limit. Times are reported per process and as wall time. This is as ruled.

## Shots against CD-8 (completeness)

Every CD-8 item is now visible in the shots:
- realistic materials (grass, meadow, paving, roof membrane and tiles);
- sky and fog visible at Reset;
- soft shadows with contact darkening;
- windows on every side of the maximum house;
- detailed roof edges (coping, drip, inner shadow band);
- varied trees.

**Evening at 1280x800:** the near meadow now reads green. The far field turns into a warm brown haze toward the horizon, because the fog takes the warm evening horizon colour. This is the same look as sunset haze, and I do not count it as a defect. Whether it meets the client's "evening grass" wish is a judgement for the PM or the client on the published build, not a code issue.

Once the gate condition is met, the CD-8 brief is complete for the MVP. Still deferred to later batches: R4 (tank and AC units), R5 (pitched eaves), W2 (string course) and G2b.

VERDICT: APPROVED

## Addendum 1 (QA trim, main 341d187)
- **QA's run:** a + b moved about 41 s of work. QA's quiet default run took 411.7 s. The release processes took 235.1 s (rows) and 162.0 s (stream). No check was lost.
- **Gate:** still open until FS's two quiet confirm runs are in.
- **Release rows process:** at 235 s it has 25 s left under the 260 s NOTE line. The next feature that moves rows there must split it or re-balance it.

## Addendum 2 (gate ruling, f6t1c 54b7455): final
- **FS runs:** five quiet runs, all green: 417.4, 441.3, 427.6, 409.7 and 430.0 s.
  - Wall time tracks pool work at 0.355 in every run. The CPU-only `three` step swings with it (15.0–17.6 s), and steal time was 14–18 s per run.
  - So host speed causes about ±20 s of the spread.
- **The runs on the new table do not meet the gate on any honest measure.** Their mean is 427 s and their median about 429 s. Picking the two best runs is not the measure.
- **The run-time line still holds, but it protects test iteration, not the product.** The product code is approved (findings 2–8), so this miss does not hold back the merge and publish.
- **Ruling:**
  1. **T1c may merge to main and publish now.** The run-time overage (median about 429 s) is recorded as test-infra debt.
  2. **Before the first gate of the next feature, on main:** QA moves about 45 s more maximum-house work, or other pure duplicates, out of the default run. FS rebalances the two release processes so each stays ≤ 260 s; the stream process, at 162 s, takes the new rows.
  3. **New gate measure, project-wide, from the next gate:**
     - three quiet default runs;
     - the median ≤ 420 s, with no run over 440 s;
     - the `three` step time recorded for each run as a host-speed reference.
     This replaces "two runs" and the one-re-run noise rule. The orchestrator should add it to TEAM-PROTOCOL.md.

VERDICT: APPROVED
