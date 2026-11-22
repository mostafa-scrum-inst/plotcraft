# F6-T1b implementation review (TL), 2026-11-22

Reviewed: branch `f6t1` at 72aa281.
- **Commits:**
  - FS: a724113, 5c2cbb8, 031aa5b, e775004;
  - Designer: c540c49, 8a27f00;
  - QA: f987610, 2aae57d.
- **Read:** `impl-notes.md` T1b-1 to T1b-7, the src diff stat against 42bd8ae, and `shots-t1b/`.
- **Focused run** (openings, detail, realism, budget): 24 of 24 green.

## Findings

1. **resetPhi 62: all TL and PM conditions are met.**
   - The A-16 reader list is in T1b-5.
   - The fog-near and dome-clip tests run at 300x900, 360x640 and 1280x800, at Reset and at rMax.
   - The Reset fit is asserted with the dock collapsed at 360x640, 640x360 and 1280x800.
   - The 1 px cut with the dock open is recorded, not asserted.
   - The Designer has signed off.
   - QA's rows are version-aware (f987610).
2. **Openings (Q-T9, Q-D1, Q-D3).**
   - `PC.house.openings` is pure and derived from the approved plans. It sits inside the key, with `house.v = 2`, and the layout golden is unchanged.
   - Every decal is in `roofBatch`, so it adds no draw call. The reveal ring and the `door` key match the Designer's answers.
   - The kind is named `glazed` to satisfy the core-purity lint rule. That is acceptable.
3. **Contact darkening and blobs.**
   - The skirts, floor rings, `groundRing` and wall skirts are appended items. The first-N-unchanged readers are listed.
   - `blobs` is the second of the two transparent meshes (Q-T5). It is ordered shrubs first, and the winter `count` is tested.
   - Deviations T1b-2 (the separate `groundRing` mesh, one opacity, the R/B tilt) are accepted. The Designer agreed, and none of them touches a constraint.
4. **Trees.**
   - The lumps sit inside canopyR and canopyH (Q-D2).
   - The lump geometry is built in-house, with no BufferGeometryUtils.
   - `setColorAt` is seeded per item, so it is the same across rebuilds.
   - The mock rows for `instanceColor` and `ClampToEdgeWrapping` are confirmed on real r128.
5. **Winter meadow.** It is data plus one `meadowColor` field (summer = `groundOuter`), with readers listed. This is acceptable. The lite skirt divides by the season's meadow colour, so the fade stays correct.
6. **Budgets, all far inside the limits:**
   - maximum house: 26 meshes, 26 / 25 draw calls, 19.4 k triangles;
   - 12 materials; textures 4, or 5 with tiles (4.02 MB);
   - transparent meshes: 2 of 2;
   - C-4.8 solo: 139 ms.
7. **O-1 shadow probe (T1b-4).** The probe shows the drop in shadow pixels at 8 h comes from the phi 62 pose, not from T1b, which adds about 1.7 k px. The retune raised the 17.5 h count from 17.5 k to 27.7 k. Accepted.
8. **Gate.**
   - Default runs: 417.3 s and 418.2 s, green.
   - QA_FULL=1: 464.1 s.
   - Release step: 193.3 s, 6 of 6.
   - The 422.0 s run went over the line while other agents' runs were loading the machine (load average about 8.8). Under the noise rule it was the one rerun allowed, and the quiet rerun passed. **The gate is met.**
   - **Margin ruling:** a 2 to 3 s margin under 420 s is too thin to carry into the next feature. Before the **first gate of the next feature that adds tests** (F6-T2 or later), QA and FS buy back at least 15 s of default wall time (about 45 s of work), leaving at least 15 s of margin.
     - Candidates are the longest QA files: f1-t3 (83 s), f2-t3 (77 s) and f1-t1 (72 s). Duplicated viewport passes in those files can move behind QA_FULL=1, and QA_FULL has 16 s of headroom for them.
     - QA proposes the moves and I agree them. This does not block T1b or the publish.
   - **Process rule:** gate timings count only from runs that did not share the machine with another agent's full run. Runs beside another agent's work are informational only.

## Shots against CD-8 (realism)

Compared with T1a, the 1280x800 noon and 360x640 evening shots now read as a house in a garden:
- windows with frames and sills, and a wooden door;
- rounded, lumpy trees with grounded shadows;
- contact darkening at the wall base;
- the horizon and sky visible at Reset;
- an evening that reads warm, not muddy.

What remains is a matter of style, not a defect:
- the flat roof reads as a plain slab;
- the far meadow is uniform.

Neither is in CD-8's acceptance list, so they are post-MVP ideas for the Designer.

The one publish after T1b (Q-T1) may go ahead. The CD-7 phone check runs on this build.

VERDICT: APPROVED
