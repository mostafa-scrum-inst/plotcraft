# F4-T2 outcome review (TL, step 3f), 2026-11-21

Reviewed:
- `outcome.md` (FS);
- `plan-review.md`, `impl-review-step0.md` and `impl-review.md` (both APPROVED);
- `qa-report-step0.md` (PASSED, 409.0 s, no bugs) and `qa-report.md` (PASSED, 414.5 s, no bugs, 24/24 mutations);
- commits `f93c3df` … `7803833`.

## Verdict on the outcome document

`outcome.md` is complete and accurate.

1. **What was built.** §1 matches the code I reviewed in both parts: Step 0 items 0.1–0.10 plus C0; furniture, roof, outdoor items and needle. The numbers match my own checks:
   - meshes: 12 on the sample, 18 on the maximum house;
   - the roof dimensions;
   - wall and gate sizes;
   - the needle sizing.
2. **Files and tests.** §2 lists every new and changed file, plus the QA suites. That includes the version-aware f4-t1-view update I asked for: `v3-roof` is now enabled, f4-t1-view 175/175.
3. **APIs for F4-T3.** §3 is the right hand-off:
   - the site model fields;
   - `pathStrip`, `gateU` and the existing `blocked()` exclusions;
   - the empty `trees` / `shrubs` arrays;
   - the site group for the instanced meshes;
   - the `lights()` / `noonLook()` seam for `PC.sky.compute`;
   - `mats.ground` / `mats.poolWater`;
   - the needle's north direction, the same as the sun azimuth.
4. **How to verify.** §4 is reproducible. The focused words match what I ran: 17.2 s on my subset, 91.4 s on FS's.
5. **Sign-off.** §5 records the QA and FS sign-off and the run times. Both full runs are under the 420 s target at `--jobs 3`, and the runner split is recorded.
6. **Rulings.** §6 covers Q1, Q10, Q12, required items 2 and 3, the model fields, the tree clearance, the Designer values and PM round 10. My two Step 0 non-blocking items were done in proper. S6 is accepted.
7. **Known limits.** §7 is honest, and none of the limits blocks:
   - hall pockets (PM CD-5 ruling);
   - default camera (my 6b);
   - phone scale at 13.2 px/m, still fully labelled;
   - the 2 lint length warnings (accepted);
   - S6;
   - the untested seating tie order (QA obs. 1; architecture says only "nearest the middle", which is acceptable);
   - the two states reachable only through a direct store change;
   - vegetation, which is F4-T3 by plan.

**Acceptance.** F4-T2 meets its criteria:
- F4-S1: roof and the Roof toggle, furniture with Q18 / Q19, and the outdoor items, except vegetation;
- G6 limits for the maximum house;
- Step 0: CD-4 (10 rooms, generator exact and under 300 ms) and CD-5 (hall access, PM host table);
- the F3 follow-up bundle: PM decisions 1, 2, 4, 5 and 9, CTO debt 6, and the `applyEdit` guard;
- the house reachability refusal (TL item 2 from F4-T1).

What F4-S1 / F4-S3 still need is F4-T3 by plan: vegetation in F4-S1, and the whole of F4-S3.

## Routing for F4-T3 (FS: vegetation, time of day, season)

1. **Vegetation (A-9 / A-11).**
   - `PC.scatter.vegetation(site, seed)` fills `house.site.trees` / `shrubs`. It should reach roughly the effective vegetation % and never sit inside the building, parking or pool (F4-S1).
   - It reuses the outcome §3 exclusions: footprint + 1 m, path strip widened to the gate, parking, pool + clearance. F4-T3 adds:
     - the seating pad;
     - 0.7 m from the boundary, so canopies stay inside the 1.2 m wall;
     - trees clear of footprint + 1 m + canopy radius (1.55 m at the largest scale);
     - shrubs clear of footprint + 1 m.
   - The scatter must be seeded and deterministic for the same state.
   - If the scatter reads new inputs, add them to the site memo key.
   - Meshes: instanced `trunks`, `canopies` and `shrubs` in the site group, each with `frustumCulled = false`. The working budget stays at ≤ 40 meshes (the maximum house is 18 now, plus 3).
2. **Time of day and sky blend (A-13, as written; no new ruling).**
   - `PC.sky.compute(hour, season, northDeg, tables)` is pure:
     - sun path `a = (hour − 6)/12·π` with the season's elevMax of 72 / 52 / 32°;
     - moon direction when `s.y < 0`;
     - direction Y kept at 0.15 or more.
   - Key-frame lerp over `PC.data.sky.keys`, which F3-T3 already delivered.
   - Season blend:
     - `day = min(1, K.sunI / noonKey.sunI)`;
     - `sunColor`, `hemiSky` and `background` = `mix(K, tint, tintAmount·day)`;
     - `hemiGround` = `mix(K, season.ground, groundBounce·day)` with `groundBounce` 0.25 from data;
     - intensities stay at the key values;
     - summer is the untinted baseline.
   - Unit tests pin:
     - north rotated 90° rotates `sunDir` by 90° about Y, exactly (F4-S3);
     - night `hemiI` ≥ 0.25 and night `sunI` ≤ ¼ of noon;
     - a winter night background stays dark, because the `day` factor applies;
     - all output colours go through `PC.three.col`, with the background raw.
3. **Look and UI.**
   - `three/look.js` `applyLook` swaps in for `noonLook()` / `noonSunDir()` in `scene.js`. It sets:
     - the light position (target + sunDir × 2.5 × radius);
     - colours and intensities;
     - the background;
     - the vegetation and `mats.ground` colours, with `groundOuter` unchanged;
     - canopy visibility (hidden in winter).
   - Nothing is rebuilt and the camera is not touched: the frame is marked dirty only.
   - Enable the Light tab controls that F4-T1 left disabled: slider 0–24 h in 0.25 steps, presets 8 / 12 / 17.5 / 22, season select, the "approximate" label. The session opens at noon in summer.
   - QA makes f4-t1-view version-aware for these, as was done for `v3-roof`.
4. **Shadows (carried from F4-T1, item 4).**
   - Fit the shadow camera to building plus yard (A-11), now including the wall, pool and vegetation.
   - Judge the faint noon shadows with the slider. Any tuning goes through the Designer's sky data, not the code.
   - Keep one shadow light and a map of 1024 or smaller.
5. **Budget assertion.** The final G6 assertion runs in `tests/three/budget.test.mjs` on the maximum house with look changes applied (F4-plan). The runtime target stays 420 s at `--jobs 3`, with 600 s as the hard limit.
6. **Default camera: a PM / Designer call, to be settled before the F4-T3 plan review.** With the sample's Reset pose the pool and seating sit behind the house (my 6b). The options are:
   - **(a)** keep A-12 as it is: a street-side view, which matches "the entrance faces the street";
   - **(b)** turn the Reset azimuth towards the corner that shows the most of the yard;
   - **(c)** keep the Reset pose and add a second framed view, for example "Garden".

   My recommendation is (a) for Reset, which keeps the A-12 / A-14 contracts and every pinned Reset test. If PM / Designer choose (b) or (c), it becomes an F4-T3 scope item with an A-12 update in the plan review:
   - the tour overview uses the Reset pose (A-14);
   - QA's Reset oracles change.

   It must not be changed ad hoc inside F4-T3.
7. **Carry-overs that are not F4-T3 work:** the lint length warnings (`layout.js` 334, `stage-plans.js` 320) wait for the next task that opens those files.

## F4 feature-review hand-off list

The review is held for the CTO condition (CD-6): at least one real-phone observation of the published 3D. As ruled at the F4-T1 outcome:
- F4-T3 is not held for it;
- if the answers are still missing when F4-T3 is done, the orchestrator asks the client again before the F4 review.

What the review needs:
1. **Client phone answers** (CD-6, `docs/04-feature-reviews/phone-check.md`), at minimum:
   - loads, and Skip to 3D shows the house;
   - one-finger orbit and two-finger zoom / pan without page scroll;
   - colours and contrast.

   Phone findings come back as bugs on the task that owns the code.

   Ideally the observation is repeated on the F4-T2 or F4-T3 publish, so it covers roof, furniture and outdoor items.
2. **Publish:** the orchestrator republishes `dist/index.html` after F4-T3 for the client and phone look.
3. **Outcomes and reviews:** F4-T1, F4-T2 and F4-T3 outcomes with outcome reviews; QA reports at PASSED; full run times at `--jobs 3`, all ≤ 420 s.
4. **Acceptance matrix:** F4-S1 to F4-S3 and G6 against tests. G6 means the final budget assertion with look changes, on the maximum house.
5. **Decision record:** the default-camera decision (item 6 above), with its owner and outcome.
6. **Accepted limits to restate for the client:**
   - hall pockets count as access (CD-5);
   - the sun path is approximate, not real solar data;
   - phone plan scale is 13.2 px/m at a full large floor;
   - seating tie order.
7. **Debt list for F5:** the lint length warnings, S6 (accepted), and the store-only edge states (none reachable from the UI).

VERDICT: APPROVED
