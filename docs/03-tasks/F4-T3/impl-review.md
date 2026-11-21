# F4-T3 — TL implementation review (round 1), 2026-11-21

Scope: worktree /home/user/plotcraft-f4t3, branch `f4t3` at 7993baf. Reviewed against:
- `plan.md` §0 amendments;
- my `plan-review.md` (required items 1–6, rulings Q1–Q8);
- `designer-plan.md`;
- `camera-decision.md`;
- PM round 11;
- architecture A-9, A-10, A-11, A-13 and A-16.

## Evidence
- **Focused run in the worktree only:**
  - command: `--unit --three --e2e --only view3d,outdoor,questions,sky,scatter,look,vegetation,budget,data-tables,validate,site,house`;
  - all steps passed in 47.0 s;
  - e2e: view3d 80, view3d-real 46, outdoor 9, questions 432, site-legend 120, site-tapmode 195.
- **FS full run:** 407.1 s at `--jobs 3`, green, after folding the look checks into `view3d.spec` (Q7).
- **Real-r128 shots** (FS `shots/`, made by this build through the Light controls): I looked at noon, evening (17:30), night (22:00) and winter at 1280x800 and 360x640.
  - Trees and shrubs read as the Designer's model trees.
  - Evening shadows from the vegetation are visible.
  - Night stays readable.
  - Winter shows bare trunks above the wall, snow ground and snow shrubs.
  - Presets show their pressed state, and the day/night slider track works.
- **My own probes:** the code of scatter.js, sky.js, look.js, the `setLook` part of scene.js, and stage-3d.js. I also timed the scatter on stage 2 (finding 7).

## Plan-review required items
1. **Reconciled with designer-plan.** Met.
   - `PC.data.vegetation` matches Designer §1 and has its schema test.
   - Geometry is built from the table (6 / 8 / 7 segments).
   - The clearance is `canopyR × scale[1]`, with no literal in core or three. The mutation that changes `canopyR` in the table is caught.
2. **Sky values.** Met.
   - Two rounded steps with the one mix (`PC.sky.mix`; `three.mixHex` is an alias).
   - The 16-row Designer golden table is reproduced exactly.
   - The single-rounding mutation is caught.
   - Sun path, moon mirror and Y ≥ 0.15 (rescaled to unit) follow A-13. I checked the basis: N = 0 gives n = −Z and e = +X.
3. **Light tab.** Met.
   - `aria-pressed` only on an exact preset hour, with Noon pressed on open.
   - `pc-range--sky` stops are tested against the sky keys.
   - Season is a `select`.
   - `LATER` is room finder and tour only.
4. **Camera (a), no hint line.** Met. A-12 and A-14 are unchanged.
5. **Seed: plot points and street edge only.** Met. The mutation that adds the % to the seed is caught.
   - The candidates are drawn 3 per grid node, whether kept or not, so the order depends on the plot only.
6. **Mock conformance.** Met.
   - The members were already whitelisted and checked against the vendored r128 since F4-T1.
   - `setColorAt` stays off the whitelist.

## Q1–Q8
1. **Tree boundary distance.** Trees are `clr + 0.2` (1.75 m) from every edge and shrubs 0.7 m. Met, and the mutation is caught.
2. **Shortfall warning.** `veg-short` (warn, q 4) uses the PM text and shows on stage 2 and Floor plans.
   - It never shows at 0 %.
   - The sample places 145.5 of 146 m² and does not warn.
   - Frequency is reported in impl-notes: 2 of 15 cases warn, both on the tight 16 × 18 m plot. See the ruling below.
3. **Extra exclusions.** Met. Seating pad + 0.3 and the needle circle apply to both kinds. Trees also clear parking and pool grown by the clearance.
4. **Shadow fit.** Met.
   - Light-space fit of the content box, without the wall, with a 0.5 m margin, capped at `shadowR × radius`.
   - Refit on build and on every `applyLook`.
   - Only the six fields plus `updateProjectionMatrix` are written.
   - The basis matches three's lookAt for the shadow camera.
5. **Session look.** Met. The look lives in `PC.view3d`, so it survives stage changes and store replaces. `build()` re-applies it on a rebuild or context restore, and a page load gives 12:00 summer.
6. **QA signatures.** The sample is unchanged. The version markers are listed for QA in impl-notes §3.
7. **Run time.** Run 1 took 424.8 s, so the look checks were folded into `view3d.spec` as ruled, and run 2 took 407.1 s. Met.
8. **Noon helpers removed** after the literal noon goldens (N = 0 and N = 90) landed first. Met.

## Ruling: shortfall threshold (impl-notes §3a.1), agreed with the PM
**Option (a): keep `vegPlaced < 0.8 × min(veg.area, capArea)`, with `capArea` = 120 × 6 + 200 × 1.5 = 1 020 m², as built.**
- The 120 / 200 caps are the G6 performance budget, not "the building, parking and pool" that the warning text names. Without the cap term, every garden above about 1 275 m² would warn, and the warning would blame the wrong cause.
- The PM ruled (a) independently, keeps the text, and amended F4-S1: "up to the G6 cap of 120 trees and 200 shrubs, about 1 020 m²". Above the cap there is no message. That is a known limit, restated at the F4 review.
- **Caps stay at 120 / 200 (TL, performance).** They are not raised now. Instancing makes more instances cheap on the GPU, but scatter time and shadow fill on phones are not measured. Revisit only after the CD-6 phone check, as a data change plus the budget test.

## Findings
7. **Stage-2 cost of the scatter.**
   - The scatter runs inside `PC.site.analyse`, so every new stage-2 state pays for it. That includes each tick of the footprint-% slider. My sweep, footprint 10–80 % in 1 % steps on desktop node:
     - sample: 407 ms against 143 ms without the scatter, worst tick 22.6 ms against 4.2 ms;
     - 100 × 100 m: 2 870 ms against 507 ms, worst tick 55 ms against 11 ms.
   - On a phone that is roughly 3–5 × slower, so it is still inside F2's "catches up within about a second", but the slider becomes visibly heavier.
   - Nearly all of the cost is `candidates()`. Per call, candidates alone against the whole scatter: 4.1 against 3.8 ms on the sample (timing noise), 29.3 against 30.2 ms on 100 × 100. Those depend on the plot and street edge only.
   - **Required before QA (small; I check it in an addendum, with no new round):** keep a one-entry memo of `candidates(site)`.
     - Key it on the seed **string** (the JSON of the rounded points and the edge), not the 32-bit hash, so a hash collision cannot reuse the wrong candidates.
     - Return the same frozen array. The selection only reads it.
     - Output must stay byte-identical: the existing determinism tests, plus one test that two states differing only in footprint % reuse the memo.
     - Report the new sweep numbers in impl-notes.
8. **`applyLook`** sets `scene.background = new THREE.Color(...)` on each call. That is a plain value object, not a GPU resource, so the no-create rule (geometry, material, mesh) holds. It is accepted. `.set()` on the existing colour would avoid the allocation and is optional.
9. **`frustumCulled = false`** is redundant on r128 InstancedMesh (QA note 3). It is kept as A-11 / F4-plan require. Accepted.
10. **The Reset view is mostly ground** (the outer ground plane), so the sky background shows little at Reset. This is as in F4-T1. The night, evening and winter tones still carry through the lights and the ground, and the Designer accepted the F3-T3 tables. No action.
11. **Process note.** FS killed stray headless-Chrome processes during cleanup (impl-notes §4). If another session's run was in progress at that time, it must be repeated. The orchestrator should check with QA.

## QA focus list
1. **Version markers** (impl-notes §3):
   - `f4-t1-view` lines 346 / 371: Light hooks are live;
   - F4-T2 model / view: `trees` / `shrubs` are no longer empty; meshes are 15 on the sample and 21 on the maximum house;
   - the F4-T1 shell signatures with vegetation 0 % or yard masks (Q6);
   - `veg-short` in the warning lists of f2-t1-site, f2-t2-questions and stage2kit.
2. **Sky oracle:** your own A-13 implementation against `PC.sky.compute` over 0–24 h in 0.25 h steps, 4 seasons and north 0 / 37 / 90. Colours exact with the two-step rounding; directions to 1e-9.
3. **Scatter:**
   - no centre in any exclusion: tree clearance, seating + 0.3, needle circle, path strip to the gate;
   - trees ≥ 1.75 m and shrubs ≥ 0.7 m from every edge on concave and rotated plots;
   - spacing;
   - determinism;
   - a change of Q4 only adds or removes items and never moves a kept one. Check whether that holds for the tree set; report the shrub behaviour as an observation;
   - the caps on 100 × 100 m.
4. **Shortfall:**
   - the 80 % line with the cap term: no warning above the cap;
   - the PM text in m and ft;
   - shown together with `veg-reduced`;
   - never at 0 %;
   - not on the sample.
5. **Light tab** at 360x640 and 1280x800:
   - slider by touch and by keyboard;
   - presets and `aria-pressed`;
   - season;
   - HH:MM, with 24:00 at the end;
   - the panel ≤ 34 % on a phone;
   - the look kept across leaving stage 5, a Q18 rebuild and a context restore;
   - the camera never moves on a look change.
6. **Real r128:**
   - luma noon > evening > night;
   - winter has no canopy pixels;
   - vegetation shadows at 17.5 h;
   - shadows not clipped at 6 / 18 h on the 100 × 100 m plot, where the cap applies;
   - one shadow light.
7. **G6:** the maximum house with the caps and all looks: meshes ≤ 40, no create or dispose on a look change, `applyLook` mean < 5 ms.
8. **Finding 7 after the fix:** stage-2 slider sweep timing and an identical scatter output.
9. **Regression:** full run at `--jobs 3`, with 420 s as the target and 600 s as the hard limit.

VERDICT: APPROVED
