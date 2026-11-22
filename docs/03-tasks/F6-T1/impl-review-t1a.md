# F6-T1a implementation review (TL), 2026-11-22

Reviewed: branch `f6t1` at ac985f8.
- **Commits:**
  - FS: 17f291e and 9372dad;
  - Designer: 20c9238;
  - main with QA's rows: 5ab49de.
- **Read:**
  - the src diff against 5ab49de (scene, look, util, texgen, sky, const, build-*);
  - `impl-notes.md`;
  - the after-shots in `shots/`.
- **Focused run** (realism, sky, texgen, budget): 24 of 24 green.
- **FS gate numbers:**
  - default runs: 405.0 s and 400.6 s;
  - `QA_FULL=1`: 545.6 s;
  - C-4.8 solo build: 113 ms.

## Findings

1. **Condition for this verdict:** one green `QA_FULL=1` run of ≤ 480 s, after the leak-max stream moves out and the QA_FULL durations table is added (plan-review addendum). It must be reported with:
   - the leak-max step's time (≤ 240 s);
   - the C-4.8 solo line.

   The default runs pass: two green runs ≤ 420 s. I record the QA_FULL result as an addendum here. If it is over 480 s, the verdict becomes CHANGES REQUESTED until QA's trim lands.
2. **Required change 1 (fog range) is met.**
   - The code: `near = rMax + R`, `far = min(near + 8 R, 0.9 × outerK × R / 2)`, with a `near + 1` guard. It is set in `applyLook` and re-applied by `refit()` through `apply()`, which creates nothing.
   - The test covers the narrowest aspect at Reset and at `rMax`, the re-fit and lite.
   - The fixed-4 R mutation is caught.
3. **Required change 2 (dome follows the eye) is met.**
   - `render()` moves `sky` to the eye before every draw. The radius is 0.9 × far, with `frustumCulled: false`, `depthWrite: false` and `renderOrder: -1`.
   - Beyond `far` the clipped ground shows the dome's horizon row, which has the same hex as the fog. So there is no edge on any aspect.
4. **Q-T6 raw fog colour.**
   - The seam is 0 to 1 per channel at 12, 17.5 and 22 h.
   - The linearise mutation is caught by the mock and by real r128 (0 of 25 columns).
   - `fog.color = new THREE.Color(...)` allocates on each look, the same pattern as `background`. This is acceptable: it is a CPU object, not a GPU object.
5. **On-demand shadow map:**
   - CTO conditions:
     - every trigger is in `shadowsDirty()` (build and restore, `applyLook` and re-fit, `applyVisibility` for level and Roof including the finder and the tour);
     - camera frames don't trigger it;
     - the highlight casts no shadow;
     - `info().shadowUpdates` is exposed.
   - Proven on real r128: the upper-storey luma changes by 63 / 79, and a forced extra update changes 0 px.
   - This is the main run-time win, and the spike-to-T1a numbers support it.
6. **Tiers and textures.**
   - `pickTier` gives 2048 only on fine pointers with `maxTextureSize ≥ 4096`.
   - Coarse pointers get 1024 and DPR ≤ 2.
   - 5 textures at most.
   - Explicit filters and sRGB on the colour maps.
   - Disposed per build, with cached pixels on restore.
   - The 20-rebuild leak test is constant.
   - World UVs in metres via `BoxBatch({uv})` follow C-3.5.
7. **Budgets.**
   - Maximum house: 24 meshes and 24 draw calls, 8.4 k triangles.
   - Dist 573.5 kB (≤ 627, lint line present).
   - C-4.8 solo build 113 ms (note threshold 380).
   - All are far inside the limits.
8. **Mutations:** 13, all caught, including the three TL additions. A-16 reader lists are present (§6). Both are adequate.
9. **QA_FULL moves (§4).**
   - The Roof-by-touch and context-loss checks moved to QA_FULL only, as agreed.
   - The default run still covers context restore via QA f4-t2-view E, f4-t3-view A and `scene.test`.
10. **Watch item, not blocking:** the texgen generation-time test (≤ 150 ms, best of 3) measured 158 ms of test time in my focused run. The test passed, so the best of 3 was under the limit. If it flakes under load, apply the C-4.8 pattern: a default guard and a solo budget under QA_FULL. That needs no CTO change, as it is a run-time placement.

## After-shots against CD-8 (realism)

T1a's scope is the pipeline and the world. Against the before-shots:
- **What improved:**
  - textured grass and meadow;
  - the street strip (footpath, kerb, asphalt) gives scale and context;
  - ACES gives softer highlights;
  - the highlight and the needle keep exact UI colours.
- **What does not yet read as "realistic", all already scheduled:**
  - Plain wall slabs with no windows or door. This is the biggest gap and is T1b (openings, door key).
  - The sky and fog can't be seen at Reset. That is the resetPhi change to 62°, T1b's first commit.
  - No contact darkening or blob shadows under trees and the house (T1b).
- **Designer to check in the T1b shots, no T1a change:**
  - Cast shadows at noon are hard to see at 1280x800 (the sun is high, and soft PCF at a 2048 map spread over the plot). Confirm the house and tree shadows read in the morning and evening shots.
  - The 360x640 evening shot reads muddy brown overall. Look at the evening exposure and ground tint in the T1b retune.

VERDICT: APPROVED
