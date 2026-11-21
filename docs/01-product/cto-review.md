# CTO review — `docs/01-product/goals-and-stories.md`

## Round 1 — 2026-11-19

Reviewed against `docs/00-brief.md` (idea items 1-6, Q1-Q19, hard constraints, scope guard) and the review rules in `TEAM-PROTOCOL.md`.

### What is good (keep as is)
- **Coverage is complete.** All six idea items and all 19 questions are present; the section 5 traceability table maps each question to a story and a visible effect. Q18-Q19 are correctly held back until after approval (F3-S4), and the approve-every-floor gate (R1, F3-S3) matches the brief.
- **Scope guard respected at feature level:** exactly 5 features. 17 stories must fit in at most 15 tasks; that is achievable (see TL notes) and is the TL's call.
- **No contradiction with the hard constraints.** R3 (no native dialogs), F1-S5 (localStorage optional, corrupted draft discarded), F4-S1 (in-page fallback when WebGL/three.js is missing, 2D still usable), F4-S2 (own camera controls, render loop stops when hidden), R2 (360 px, 44 px targets) all line up with the brief. Unit-conversion examples in F1-S2 and the thresholds in F1-S1/F2-S3 are arithmetically correct (checked: 65.6 ft, 98.4 ft, 6458 sq ft, 538 sq ft, 215 sq ft).
- Most acceptance criteria are concrete Given/When/Then statements QA can automate in headless Chrome or against the THREE mock (e.g. F4-S3 "rotate north 90 degrees -> shadow direction rotates 90 degrees" is a clean mock-level assertion on the light position).
- Feasible in one HTML file on r128 core: ShapeGeometry/ExtrudeGeometry for the plot, BoxGeometry blocks, InstancedMesh for vegetation, CatmullRomCurve3 for the drone path, CanvasTexture for labels, one shadow-casting DirectionalLight. Nothing in the stories needs an `examples/js` add-on.

### Problems that must be fixed before the TL plans (each would cause rework if left open)

**1. Footprint and setback geometry is undefined (sections F2-S3, F3-S1, F4-S1).**
The plot is an arbitrary polygon, but the doc never says (a) which edges count as "front / back / sides" for Q2, (b) what shape the footprint is, (c) where it sits inside the buildable area. F3-S1 requires rooms to be "rectangles fully inside the footprint" and F4-S1 says "the approved footprint position", so everything from F2-S3's area summary to the 3D site layout depends on this. Required: state the product rule. Recommended (simple, deterministic, testable):
   - Front = the Q6 street edge. Every other edge is "back" if it faces roughly away from the street edge (outward normal within 45 degrees of opposite), otherwise "side". One value for both sides (three inputs: front, back, sides).
   - Buildable area = the part of the plot at least the relevant setback away from every edge.
   - The footprint is **one rectangle**, aligned to the street edge, area = Q3 % of plot area, **centred in the buildable area**, shrunk to fit if needed (this is the existing "clamped" warning in F2-S3). The user cannot move or reshape it (add to non-goals). All levels, basement included, use the same footprint.
   - Room rectangles are axis-aligned to the footprint (not to the screen grid).
   Centring matters: with the sample (front setback 3 m, footprint about 203 m2) a front-aligned house leaves a 3 m front yard, too shallow for a 5 m car, and the sample would break its own "no warnings" rule. Centred leaves about 8 m front and 7 m back, so parking and pool both fit.

**2. No defaults and numbers table (F2-S1 "sensible default", F2-S2 "S/M/L shows the area", F2-S3 "stair/lift allowance", "parking + pool areas", section 6).**
Section 6 defers these to the TL, but they are product decisions that QA must test against and that the sample project depends on. Without them nobody can check that the sample "passes every validation with no warnings". Required: one table in this doc containing
   - the default answer for each of Q1-Q19 (including the default street edge and default north);
   - S/M/L area per room type (10 types x 3) and the allowed range for an exact area;
   - stair allowance and lift allowance (area and block size);
   - area per parking space and the pool sizes (S/M/L dimensions);
   - grid step and snap step in m mode and in ft mode, maximum plot extent and maximum vertex count;
   - a statement that geometry is stored in metres and only display converts (R4 implies it; say it, so "1.5 m (5 ft)" style pairs are not read as two different limits).
   Then re-check the sample in 4.2 arithmetically against the table and write the numbers in: per-floor requested area versus footprint, and outdoor areas versus plot. Note the consequence of F3-S1's "within 25 %" rule: whatever the rooms do not use becomes hall. With typical S/M/L values the sample's 12 rooms could fill only about half of a 203 m2 footprint, which would look empty in the dollhouse. Tune the sample (lower footprint % or bigger rooms) so rooms plus stairs fill at least about 70 % of each floor.
   The TL may still propose different values; they are changed in this table, in one place.

**3. R5 invalidation is incomplete and ambiguous.**
   - Q1, Q6 and Q8 are in neither list. Q6 must be layout-affecting (it decides which setback is "front" and therefore where the footprint sits). Q8 is appearance-only. Q1 changes nothing but labels. List all 19 explicitly.
   - "Regenerates the affected floors" is undefined. Required: say which floors. Recommended rule: a floor is regenerated, and loses approval and manual edits, only if its own inputs changed (footprint rectangle, stair/lift position, the rooms on that floor with their sizes, the adjacency pairs on that floor). Plot shape, Q2, Q3, Q6, Q14 and a change in whether stairs exist therefore reset every floor; adding a bedroom upstairs resets only that floor. This is cheap to build as a per-floor input signature and removes all special cases.
   - Say when the confirmation appears and what Cancel does. Recommended: once, on the first layout-affecting change made while plans exist (not on every slider tick); Cancel restores the previous answer; the message says manual room edits on the affected floors will be lost.

**4. The level model (basement, roof, empty levels) has gaps.**
   - Basement in 3D: F4-S2 and F5-S2 forbid the camera going below ground, yet basement rooms are below ground and must be visible in the dollhouse, the room dropdown and the tour. State how they are seen (recommended: when the basement level is selected or toured, the ground inside the footprint is opened so the camera looks down into it from above ground).
   - "Basement and roof may be empty" (F2-S3) versus "n of m floors approved" (F3-S3): say whether an empty basement or a usable roof has a plan tab and needs approval. Recommended: a usable roof has no rooms, no plan to approve and is not counted in m (F3-S1 currently shows it as a tab, which leaves an unapprovable or meaningless tab); an enabled basement must have at least one room, otherwise it is a blocking conflict.
   - F2-S2 says stairs exist "with more than one level". Define "level" for this purpose (recommended: basement and usable roof both count, so a one-storey house with a usable roof still gets a stair).

**5. Roof rules: one missing conflict and one clash with the dollhouse requirement.**
   - Q7 "usable roof = yes" with Q9 "pitched" is contradictory and not handled in F2-S3. Add the rule (recommended: pitched is unavailable while usable roof is on; switching usable roof on changes a pitched choice to flat, with an inline note). Give one line each on what flat, pitched and terrace look like so they are distinguishable and testable.
   - F4-S1 shows the roof whenever the level selector is on "All", and 4.2 opens the 3D view in that overview. The first thing the client sees is then a closed box, which contradicts the brief ("no ceilings so interiors are visible"). Required: the roof must not hide interiors in the default view (recommended: a separate "Roof" toggle, default off; the tour and the room finder force it off).

**6. Staircase (Q14, F2-S2, F3-S2).**
   - "A small set of positions (e.g. front / centre / back, left / right)" is not a specification. Give the exact option list and the default.
   - F3-S2 lets the user drag the stair on one floor and moves it on all floors, but does not say what happens when the new position lands on rooms of another floor. Either define it (those floors become invalid and unapproved until fixed by hand) or, recommended for the prototype, drop stair dragging: the stair position comes from Q14 only and changing Q14 regenerates (rule 3). This removes the only cross-floor editing dependency in the product.

**7. G6 is not testable where QA works.**
"Orbit responds without visible stalls" can only be judged on the hosted page. Keep it, but add a proxy that QA can assert against the THREE mock for the maximum house (3 floors + basement, 12 rooms per floor, full furniture): a ceiling on scene mesh count / draw calls (suggest 150 or fewer), one shadow-casting light, shadow map 1024 or smaller, pixel ratio 2 or lower. The TL may adjust the numbers; they must exist.

### Non-blocking notes
- F1-S1 ("rejected or flagged invalid") and F3-S2 ("prevented or shown clearly as invalid") each allow two behaviours. Pick one so QA writes one test. Suggested: reject the crossing vertex; allow room overlap during a drag but mark it invalid and block approval (far simpler than collision-stopping drags on touch).
- G3 says no 3D build without individual approval, while "Skip to 3D" (F1-S5) auto-approves the sample. Reasonable for reviewers; word it as an explicit sample-only exception so QA does not log it as a defect.
- G1's "under 10 minutes for a first-time user" is a goal, not something QA can verify; fine as long as it is not treated as an acceptance criterion.
- F3-S1 has no shape criterion. A 25 % area tolerance alone allows 1.5 m slivers; consider "no room longer than 3 times its width".
- 12 rooms per floor times 4 levels is 48 furnished rooms. Acceptable with merged or instanced geometry, but 8 per floor would cut worst-case cost and phone-screen clutter with no loss for a prototype.
- F4-S1 is by far the largest story (house shell, level selector, furniture for 10 room types, stairs, roof types, all outdoor items). Keep Q18 as a palette swap only and furniture as data tables of boxes, as the wording already allows.

### Notes for the Tech Lead (not changes to this doc)
- r128 core only: there is no `BufferGeometryUtils` (it lives in `examples/js`), so geometry merging must be hand-written or avoided via `InstancedMesh`. Use `renderer.outputEncoding = THREE.sRGBEncoding` (no `outputColorSpace`), `geometry.setAttribute`, and no `CapsuleGeometry` (added later). Stick to Box/Plane/Cylinder/Cone/Shape/Extrude geometries, Lambert or Standard materials, `CatmullRomCurve3`, `CanvasTexture`, `Raycaster`.
- 17 stories into at most 15 tasks: F1 and F3 need stories combined (PM's 4.1 already suggests how). For F4 consider scene bootstrap + shell + level selector + camera as task 1, furniture + outdoor as task 2, time/season as task 3, so the riskiest untestable-locally code (renderer and controls) lands first and can be checked on the hosted page early.
- Build one pure-data "house model" (levels, room rectangles in metres, stair, site items) as the single hand-off from the 2D stages to the 3D builder; QA can then test F3 output and F4 input without WebGL.
- Version the saved draft schema from the first commit (F1-S5 already expects old formats to be discarded).
- Drone path: keep control points above wall-top height and clamp the camera height, since a Catmull-Rom curve overshoots its control points.

### Required changes
1. Define the setback-to-edge mapping and the footprint shape, alignment and placement rule (single rectangle, street-aligned, centred in the buildable area, not user-movable); state that all levels share it.
2. Add one defaults-and-numbers table (defaults for Q1-Q19, S/M/L areas per room type, exact-area range, stair/lift allowance, parking and pool sizes, grid/snap per unit, plot limits, metres as stored unit) and re-verify the sample project against it with the numbers written out, with rooms filling at least about 70 % of each floor.
3. Complete R5: classify all 19 questions (add Q1, Q6, Q8), define which floors are regenerated, when the confirmation appears and what Cancel does.
4. Define the level model: how the basement is seen in 3D given the no-below-ground camera rule; whether an empty basement and a usable roof have plan tabs and need approval; what counts as a level for the staircase rule.
5. Add the usable-roof versus pitched-roof conflict rule, one-line definitions of the three roof types, and make the roof not hide interiors in the default 3D view.
6. Replace the "e.g." staircase positions with a fixed option list and default; either drop stair dragging in F3-S2 or define its effect on other floors.
7. Add a locally testable performance proxy to G6 (mesh/draw-call ceiling for the maximum house, shadow and pixel-ratio limits).

VERDICT: CHANGES REQUESTED

---

## Round 2 — 2026-11-19

Re-read the whole revised `goals-and-stories.md` (368 lines): the round 2 change table, R5, new sections 3 and 4, all stories, and the sample verification in 6.2.

### Required changes from round 1

| # | Status | Where, and what I checked |
|---|---|---|
| 1 Footprint/setbacks | Resolved | Section 3.1: front/back/side by outward direction (40-degree threshold), buildable area, one street-aligned rectangle centred on the buildable bounding box, shared by all levels, not movable (also in non-goals). The two additions (proportions follow the bounding box up to 2:1; sides rounded down to 0.5 m in metres) are sensible and make the rule deterministic. |
| 2 Numbers | Resolved | Section 4.1-4.3 is complete: defaults and ranges for Q1-Q19, 10 x 3 room sizes, exact range 4-80 m2, stair 10 m2, lift 3 m2, parking, pool, grid/snap per unit, plot limits. R4 now states metres are the stored unit. |
| 3 R5 | Resolved | All 19 questions plus plot shape are classified; the per-level "own inputs changed" rule is the single test; confirmation once per visit; Cancel restores. The Q7 row correctly handles stairs appearing or disappearing. |
| 4 Level model | Resolved | Section 3.2: plan levels versus roof, basement needs a room, roof has no tab or approval, stairs when 2+ levels counting basement and usable roof, basement seen through opened ground with the camera above ground. F3-S1, F3-S3, F5 are consistent with it. |
| 5 Roof | Resolved | Section 3.3 and F2-S1/F4-S1: three definitions, usable roof disables pitched, Roof toggle default off and forced off by finder and tour. |
| 6 Staircase | Resolved | Five fixed positions, default Centre; stair and lift not draggable (F3-S2, non-goals); "editing one level never changes another level". |
| 7 Performance proxy | Resolved | G6 row and F4-S2: 150 meshes, one shadow light, shadow map 1024, pixel ratio 2, no frames while hidden, for a defined maximum house (4 plan levels x 8 rooms). |

Non-blocking items from round 1 were all taken (single behaviour for crossing vertices and overlaps, sample-only Skip exception, 3:1 aspect limit, 8 rooms per level, Q18 palette only).

### Sample arithmetic (6.2), recomputed independently
- Plot: edges 20, 30, 12, 8.94, 26 m; perimeter 96.94 m; area by shoelace 584 m2. Correct.
- Angled edge: outward direction is 26.6 degrees off straight back, so "back". Correct.
- Buildable: 16 x 25 = 400 m2 less a corner triangle of about 10.5 m2 (the 2 m offset line is y = 23.76 + x/2), so about 389.5 m2. Correct.
- Footprint: 25 % x 584 = 146 m2; at 16:25 that is 9.67 x 15.10 m; rounded to 9.5 x 15.0 = 142.5 m2 = 24.4 %; centred at (10, 15.5) gives x 5.25-14.75, y 8-23. Its nearest corner (5.25, 23) is 3.4 m below the angled setback line (limit y = 26.39 there). No clamp. Correct.
- Rooms: ground 110 + 10 stair = 120; first 110 + 10 = 120; both 84.2 % of 142.5. Correct. The room totals leave slack inside the 25 % tolerance (82.5-137.5 m2 against 132.5 m2 available), so the layout is achievable.
- Yards: front 8 m, back 7 m, sides 5.25 m. Parking 5 x 5 m fits in front; pool 3 x 6 m plus 1 m clearance (5 x 8 m) fits behind, and stays inside the plot under the angled edge. Area budget 331.5 of 584 m2. No warning. Correct.

### One hole in section 3.1, settled here by CTO decision (not blocking)
"Centred on the bounding box, shrunk about its centre until it fits" has no answer for a concave plot (L or U shape) whose bounding-box centre lies outside the buildable area: the rectangle would shrink to nothing. Decision, binding on the TL plan and checked at the step 2 review:
- The centred position is the first choice. If the rectangle cannot keep at least half of its target area there, the tool tries other centres on a 0.5 m grid inside the buildable area and takes the position giving the largest rectangle (ties: nearest to the bounding-box centre). This still counts as the "footprint clamped" warning when the result is smaller than the target.
- If no position gives at least 20 m2, it is a blocking conflict ("the building does not fit this plot: reduce setbacks or redraw").
The sample is unaffected (centred fits). PM: please add this as one bullet in 3.1 at the next edit; no re-review needed.

### Non-blocking notes
- Section 4.1, line under the table: the default ground floor needs 60 m2, not 58 (Living M 30 + Kitchen M 14 + Bathroom M 6 + stair 10).
- R5 confirmation: it should appear only when the change would really reset at least one level. As written, a vertex move that leaves the footprint identical "resets nothing" yet is still a layout-class change that could trigger the dialog. TL: decide from the per-level signatures, then ask.
- Default answers under-fill the house: on a 600 m2 plot the default 30 % footprint is 180 m2 while the default rooms need 60 and 48 m2, so most of each floor is hall. Not a defect (the sample is the reference scene), but consider a fuller default room list or an "under-used floor" hint when F3 is reviewed.

### Updated notes for the Tech Lead
- Round 1 notes stand (r128 core only, no BufferGeometryUtils, `outputEncoding`, pure-data house model as the 2D-to-3D hand-off, versioned draft, drone path above wall tops with clamped height).
- `architecture.md` must contain: the footprint algorithm including the fallback above; the per-level input signature used for R5 (footprint rectangle, stair/lift presence and position, rooms with sizes, pairs); and a unit test that reproduces the 6.2 numbers exactly (584 m2, footprint 9.5 x 15.0 at x 5.25-14.75, y 8-23, 120 of 142.5 m2 per level).
- Work in a street-aligned local frame (origin and rotation from the Q6 edge) for footprint, rooms and site items, and transform once for drawing and for 3D.
- Generator: the Centre stair is an obstacle in the middle of the rectangle. A banded layout (front band, middle band holding stair and hall, back band) with rooms sliced along each band is enough to meet F3-S1 and is deterministic. Prove it on the sample and on the maximum level (8 rooms) before building the editor.
- 150-mesh budget with 32 furnished rooms means one merged or instanced mesh per material/kind, not one mesh per furniture block. Room labels as HTML overlay or floor tint rather than 32 sprites.
- Basement view needs the ground mesh built so the footprint area can be hidden (separate ground piece inside the footprint, or a shape with a hole).

### Required changes
None.

VERDICT: APPROVED
