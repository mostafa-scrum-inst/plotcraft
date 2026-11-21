# CTO review — step 2: `architecture.md`, `F1-plan.md` … `F5-plan.md`, `spikes/layout-spike.mjs`

## Round 1 — 2026-11-19

Read in full: architecture A-1 to A-18, the five feature plans, and the spike source. I also ran the spike and two experiments of my own against it (results under item 3). Nothing here was checked against a real three.js: there is no copy on this machine, so every r128 statement below is from my knowledge of that release, the same footing as the TL's.

### Summary
The plan is sound, prototype-sized and well ordered. Three things need a small edit before tasks start: the R5 signature content, two gaps in the r128 whitelist (one of which hides a real rendering bug the mock cannot catch), and two additions to the F3 plan. No restructuring is needed.

### Coverage, scope, constraints
- **Stories:** all 17 are mapped (A-18 and each plan's "Stories covered"); R1–R5, sections 3.1–3.3, G1, G4–G6 each have an owning task. Deferred criteria are tracked explicitly (F1-S3's R5 criterion lands in F3-T2; Skip to 3D completes in F4-T1).
- **Scope guard:** 5 features, 3 tasks each, 15 tasks (12 FS, 3 Designer).
- **Hard constraints:** single file through `build.mjs` with exactly one external tag (the build fails otherwise); classic scripts on one global; no add-ons; own camera controls; no textures at all; `localStorage` confined to one try/catch adapter; Pointer Events; pixel ratio capped; frames requested only while stage 5 is active and visible; forbidden tokens linted. Nothing violates the brief.
- **My round-2 obligations for `architecture.md`** are all present: footprint fallback (A-6 step 4), per-level signature (A-7), the 6.2 unit test (A-6), street-aligned frame (A-5), pure house model as the only 2D-to-3D hand-off (A-9), versioned draft (A-4), drone height clamp (A-14).
- **Dependencies:** the chain F1-T1 -> … -> F5-T3 is linear and each task's inputs exist when it starts. The staging of `propose` (pass-through in F1-T2, real gate in F2-T1) and of `MAX_BUILT` is workable.

### Decisions on the items the Tech Lead flagged

**1. A-6 buildable lattice and fallback — accepted as written.**
The lattice is used only for the area figure, the bounding box and candidate centres; the footprint itself is always validated by the exact `rectFits` test, so lattice error can never put the building outside the buildable set. Because everything is computed in frame L, a rotated plot gives the same result as its axis-aligned twin. Cost (160 000 nodes x 12 edges, memoised, recomputed on commit events only) is fine. Steps 4 and 6 implement my round-2 decision exactly. One known limit, accepted for the prototype: in the fallback the rectangle keeps the proportions of the whole bounding box, so in a long narrow arm of an L-shaped plot the footprint is smaller than it could be (it is reported as "clamped"). If it looks poor on the hosted page, try the transposed proportions as a second candidate; do not build that now.

**2. A-7 signature — change it: footprint size and street edge, not position.**
Plans are stored in footprint-local coordinates, so a layout stays valid when the rectangle only moves. With corners in the signature, any change that shifts the bounding-box centre (a back-setback change from 2 to 3 m, a small vertex move) wipes every level's manual edits and approvals although no room has to change. That is the most destructive action in the product and it would fire for no benefit. Decision: `fp` = `[w, d]` plus the resolved street-edge index (so Q6 still resets every level, as the PM's R5 table requires). A move of the building on the plot is a site change, shown in the preview and summary, with no dialog. See required change 1.

**3. A-8 generator — complexity accepted; hall connectivity not required; two conditions.**
It is about 110 lines, deterministic and bounded, and it produces better plans than my banded suggestion. Disconnected hall is acceptable because the prototype has no doors or circulation logic (non-goal). What I measured:
- The spike's own cases: all valid except "1 room, 4 x 6 m with a centre stair", which returns no layout.
- A seeded sweep of 2 722 random programmes that pass the area validation (1–8 rooms, section 4.2 sizes, five stair positions, fill 30–100 %): 206 failures (7.6 %), worst time 23 ms, 63 of 2 102 pairs unmet. Failures concentrate above 85 % fill (92 of 420) but are about 4 % below it (85 of 1 944).
- Cause of the low-fill failures: a column always spans the full cross dimension of its cell while the scale factor is capped at 1.2, so a large room in an under-filled cell is stretched past 3:1 (example: no stairs, 8.5 x 16.5 m, rooms 42, 36, 16, 4, 4: 102 of 140 m2, no layout). Letting a cell be trimmed to about 1.2 x the area of its rooms before partitioning reduced low-fill failures from about 4.4 % to about 3 % in my test. That is a suggestion, not a mandate.
- A validated programme that then fails to lay out is a dead end unless the message says what to do. Condition (a) in required change 3.
- Generated coordinates are off the editing grid (the sample's living room ends at x = 7.13). With grid-only snapping an edited edge can never meet its neighbour again, so every edit leaves a gap or an overlap and breaks adjacency pairs; in ft mode the 1 ft grid never matches the 0.5 m footprint either. Condition (b) in required change 3. Related suggestion: snapping generated coordinates to 0.5 m kept 79 % of layouts valid in my test, so "snap when the result still passes `check`, else keep" is a cheap improvement.

**4. A-10 colour handling — accepted; it matches r128.**
r128 has no colour management: material, vertex and light colours are taken as linear, and `outputEncoding = sRGBEncoding` encodes at output. `Color.convertSRGBToLinear()` exists in r128. The clear colour is not passed through the output encoding in that release, so the raw-hex exception for `scene.background` is right. `MeshLambertMaterial` with `vertexColors: true` (boolean) is correct for r128. Expect light intensities to need tuning on the hosted page; that is what the Designer's tables and F5-T3 are for.

**5. A-11 mesh budget — accepted.**
22 meshes for the maximum house with a test ceiling of 40 is far inside G6. Automatic 32-bit indices are not a concern at these sizes (256 boxes x 24 vertices per batch). Keep room-tint quads 0.01–0.02 m above the slab and `groundOuter` at least 0.05 m below the plot to avoid z-fighting on phones.

**6. A-16 / A-10 whitelist — mostly correct; two gaps, one of them a real bug.**
Every listed class, member and constant exists in r128 under that name (including the post-r125 geometry names, `Quaternion.identity`, `shadow.bias`, `arcLengthDivisions`). Problems:
- **`frustumCulled` is missing, and is needed.** In r128 an `InstancedMesh` is culled using the bounding sphere of its base geometry at the mesh's own position; instances are ignored. The three vegetation meshes sit at the world origin, so when the plot centre leaves the view (zooming on a corner, the room finder, the tour) all trees and shrubs would vanish at once, and likewise drop out of the shadow pass. The mock cannot detect this. Fix: `frustumCulled = false` on the three instanced meshes, asserted by a mock test.
- **Members the code will certainly touch but the list omits:** `Mesh.geometry`, `Mesh.material`, `Object3D.getObjectByName`, `Object3D.parent`, `Object3D.quaternion`, `Object3D.renderOrder`, `Color.r/g/b`, `Color.clone`, `Vector3` arithmetic (`set, copy, clone, add, sub, multiplyScalar, normalize, length, distanceTo, lerp, x/y/z`), `Curve.updateArcLengths`, `DirectionalLight.shadow.normalBias`. All exist in r128. Add them now, otherwise the first plan review of F4-T1 is spent on whitelist paperwork.
- **A name-only whitelist cannot catch wrong call shapes.** The mock should also enforce the few signatures that differ from later releases or are easy to get wrong: `Matrix4.makeTranslation(x, y, z)` takes three numbers; `InstancedMesh(geometry, material, count)`; `CatmullRomCurve3(points, closed, curveType, tension)`; `Float32BufferAttribute(array, itemSize)`; `renderer.setSize(w, h, updateStyle)`. `ShapeGeometry` lies in the XY plane and must be rotated by -90 degrees about X (which maps shape y to -Z, matching frame T); state that in A-10.
- Set `arcLengthDivisions` before the first length query, or call `updateArcLengths()` after changing it.

**7. Task split and publishing.**
- **F4-T1 as the largest task: accepted.** Splitting it would push the first real-WebGL check later, which is worse than a large task. Conditions: the mock and its whitelist are written first within the task and reviewed at the plan review; stair and lift may be plain boxes in T1.
- **Rebalance suggestion (not required):** move `PC.scatter` and the three instanced vegetation meshes from F4-T2 to F4-T3. F4-T2 is otherwise the heaviest geometry task and F4-T3 the lightest, and season colours act on exactly those meshes.
- **Designer's F5-T3 polish pass: accepted.** It is real work with testable criteria (device sweep) and is correctly placed after the F4 hosted review.
- **Publishing: approved after F4-T1, and I am adding an earlier one.** Publish `dist/index.html` at the end of F1 as well. The sandboxed iframe, the CSP with per-file inline scripts, `localStorage` behaviour and touch gestures on a real phone are otherwise first exercised at task 10 of 15. Findings go back as bugs on the relevant F1 task.

### Required changes
1. **A-7 signature.** Replace `fp` (four corners in W) with footprint `[w, d]` and the resolved street-edge index. Update the dependent tests: F2-T1 ("changed for all levels on plot/Q2/Q3/Q6/Q14" becomes "when the footprint size or street edge changes"; add "a setback change that only moves the footprint resets nothing and asks nothing") and the R5 cases in F3-T2.
2. **A-10 / A-16 whitelist and mock.** Add `frustumCulled` and set it to `false` on the three instanced meshes with a mock assertion (A-11, F4-T2 or wherever vegetation lands). Add the omitted members listed under item 6. Have the mock enforce the listed constructor and method signatures. Note the `ShapeGeometry` plane and rotation in A-10.
3. **F3 plan.**
   (a) F3-T1: the `no-layout` message names concrete fixes (fewer or smaller rooms on this level, another stair position, a larger footprint). The seeded sweep asserts, besides "never invalid, never throws", a failure ceiling of 5 % among validated programmes at 85 % fill or less, and prints the rate, so generator regressions are visible.
   (b) F3-T2: while dragging or resizing, a moving edge snaps first to any edge of a neighbouring room, the core block or the footprint within 0.3 m, and only otherwise to the grid; unit-tested, including ft mode. This is what lets an edit restore a shared wall.

### Non-blocking notes
- Handle `webglcontextlost` (prevent default, stop the loop) and `webglcontextrestored` (rebuild, mark dirty) on the canvas. Phones drop contexts when a tab is backgrounded; it is a few lines in `scene.js`.
- Shadow box: on a 100 x 100 m plot a 1024 map over the whole plot is about 17 cm per texel. Consider fitting the shadow camera to the building plus yard (for example 2.5 x the footprint radius, capped at the plot radius).
- Parking is tried only between the building and the street. With default answers on a shallow plot (for example 20 x 20 m, front yard 5.25 m) the default single car is omitted with a warning. Consider the side yard next to the street as a last candidate.
- A-14 basement stops: with the eye offset about 5 m outside the footprint, the pit wall hides part of the near side of basement rooms. Use a steeper, more overhead eye point for basement rooms.
- F1-T1 asks the Designer to create `build.mjs`; fine since A-17 is given verbatim, but the TL should check the first build output personally.
- Default answers still leave most of each floor as hall (PM note from step 1); revisit at the F3 feature review.

VERDICT: CHANGES REQUESTED

---

## Round 2 — 2026-11-19

Re-read the "Round 2 changes" note, the revised A-6, A-7, A-8, A-10, A-11, A-14, A-15 and the changed parts of the F2, F3 and F4 plans; re-ran the revised spike (`node layout-spike.mjs --sweep`).

### Required changes from round 1

| # | Status | Evidence |
|---|---|---|
| 1 Signature | Resolved | A-7: `fp: [w, d, resolvedStreetEdgeIndex]`; position explicitly excluded with the reason. F2-T1 tests now include "a setback change that only moves the footprint leaves every signature identical, resets nothing and asks nothing", and the all-levels case is keyed on size or street-edge change. |
| 2 Whitelist and mock | Resolved | A-10 lists `frustumCulled`, `geometry`, `material`, `getObjectByName`, `parent`, `quaternion`, `renderOrder`, the `Vector3` and `Color` members, `updateArcLengths`, `shadow.normalBias`; five enforced call signatures; `ShapeGeometry` plane and rotation stated. A-11 and F4-T3 set `frustumCulled = false` on the three instanced meshes and the mock test asserts it. |
| 3a No-layout | Resolved | A-8 step 8 message names the three fixes; F3-T1 sweep asserts 5 % or lower at 85 % fill or less and prints both rates. |
| 3b Edge snapping | Resolved | A-15 `PC.plans.snapEdge` (neighbour room, core or footprint edge within 0.3 m, then grid); F3-T2 unit tests cover restoring a shared wall, the 0.4 m case and ft mode. |

### The generator change beyond what I asked
Replacing my "trim the cell" idea with a second column thickness (square-ish column, hall at its end) is the better fix: it removes the stretch at its cause instead of approximating it. My re-run of the spike reproduces the reported numbers: 41 of 2 798 no-layout at 85 % fill or less (1.5 %), 128 of 802 above it (16 %), zero invalid layouts, 39 of 1 575 pairs unmet, worst case 78 ms on this machine (87 ms reported). My round-1 failing case (8.5 x 16.5 m, rooms 42/36/16/4/4) now lays out. Both sample levels remain valid with no unmet pairs. Accepted.

Two observations, neither blocking:
- The 16 % failure rate above 85 % fill is acceptable only because the message now tells the user what to change. If hosted testing shows users hitting it often, the cheap lever is the validation threshold (warn above about 85 % fill), not more generator work.
- The sample levels come out with off-grid coordinates (for example a room starting at x = 2.62), so the 0.5 m snap pass evidently does not hold for them. That is the designed behaviour (keep unsnapped when `check` would fail) and edge snapping covers it, but it means the reference scene will show slightly irregular walls. Worth a glance at the F3 feature review; do not spend task time on it now.

### Adopted suggestions
Vegetation moved to F4-T3, context-loss handling, fitted shadow box, z-fight offsets, side-yard parking candidate with a test for the default 20 x 20 m case, overhead eye point for basement tour stops, plain-box stair in F4-T1 with the mock written first, and the two publish points (end of F1, after F4-T1) are all in the documents. Declining the transposed-proportions fallback for now is the right call.

### Standing instructions for the build phase
- F4-T1's plan review must show the mock before any scene code; any whitelist addition cites its r128 documentation name.
- The hosted-page checks at the end of F1 and after F4-T1 are gates for the feature reviews, not optional: F1 for sandbox, inline scripts, storage and touch; F4-T1 for colour, shadows, orbit feel and phone frame rate.
- Numbers changed during implementation are changed in `PC.C` and in section 4 of the PM document together.

### Required changes
None.

VERDICT: APPROVED

---

## Decision — 2026-11-20: footprint fallback also tries 1:2 and 2:1 (adopt now, in the F2-T1 fix round)

Raised by the Tech Lead in `docs/03-tasks/F2-T1/impl-review.md` ("For the CTO"). In step 2 I accepted the limit that the fallback keeps the bounding-box proportions and said to revisit it only if the hosted page looked poor. The Tech Lead's probe changes that: on an L-shaped plot (40 x 12 m arm plus 14 x 40 m arm, target 218 m2) the fallback gives 10 x 10 m = 100 m2 where 10 x 20 m = 200 m2 fits, and with the sample's rooms stage 2 is blocked on a plot that can hold the house; a U-shape gets 60 of 288 m2. A wrong blocking conflict is a correctness problem, not a cosmetic one, so it is fixed now while the code is open, not deferred. I have not run the probe myself; the decision rests on the Tech Lead's numbers.

**Rule (amends A-6 step 4, fallback branch only):**
- The fallback search is run for three proportions: the bounding-box ratio (as today), 1:2 and 2:1 (width:depth), each with the same target area and 0.5 m rounding.
- The result with the largest final area wins. Ties: the bounding-box ratio first, then 1:2, then 2:1; within one proportion the existing tie rule (nearest to the bounding-box centre) stays. This keeps the result deterministic.
- Unchanged: the centred try comes first and, when it keeps at least half the target area, no fallback runs. So convex plots and the sample give exactly the same footprint as before. `clamped`, `moved`, the 20 m2 blocking rule and the 2:1 limit are unchanged.

**Conditions for the fix round:**
1. Unit tests: the Tech Lead's L-shape reaches at least 180 m2 and his U-shape improves on 60 m2 (assert the measured value once known); every result passes the independent buildable check; the 6.2 sample assertions are byte-identical; two runs are deep-equal.
2. The performance bound of the F2-T1 plan still holds (`analyse` on a 12-vertex 100 x 100 m concave plot under 500 ms in node).
3. The Tech Lead updates A-6 step 4 and removes the "not adopted now: transposed proportions" line from the round-2 note.

No PM text change is needed: section 3.1 already leaves "exactly how the footprint is shrunk to fit" to the Tech Lead, and the 2:1 limit is respected.

---

## Round 4 changes (client decisions CD-1..CD-3) — 2026-11-20

Reviewer: CTO (fresh Opus agent; context rebuilt from the brief, protocol, both earlier CTO reviews, `F1.md`, `status.md`). Reviewed together, as workflow steps 1 and 2 for this change: the PM's round-4 edits to `goals-and-stories.md` (table, 3.1, 4.3, R5, non-goals, F2-S1, F2-S3, new F2-S4, F3-S1, 6.2, section 8 with the TL's answers; the reopen sentence is already changed in both 3.1 and F2-S4), the F2-T3 rewrite and Designer pre-step D in `F2-plan.md`, the F3-T1 sweep in `F3-plan.md`, and the round-4 parts of `architecture.md` (note, A-4, A-6 4b, A-7, A-15, A-18). I read the current `site-footprint.js`, `site.js`, `store.js` (gate), `stage-plot.js` (close, undo, clear), `draft.js` and `ui/storage.js` to judge the plan against the code it changes.

### Independent checks (scratch scripts in /tmp, nothing in the tree touched)
I modelled A-6 step 4b as written on top of the real core (the current `place()` logic, the real `rectFits`, mask and memo), and simulated `ans.edgeOv` by patching the class in `site.js` in a vm copy.

| Check | Result |
|---|---|
| 10 x 50 m, 30 % | today 6 x 12 = 72 m2 (14.4 %); 4b: stretch -> **6 x 18 = 108 m2, 21.6 %, reason `proportion`**. Matches 3.1. |
| 50 x 10 m, 30 % | today 10 x 5 = 50 m2; 4b: stretch -> **15 x 5 = 75 m2, 15 %, `proportion`**. Matches. |
| 20 x 30 m, 80 % | **16 x 24.5 = 392 m2, `setbacks`**, no stretch (24.5 < 2 x 16 - 0.5); the 1:3 try gives 8 x 25 = 200 m2. Matches. |
| TL's 6 x 15 m buildable (10 x 20 m plot, 80 %) | 72 -> **6 x 15 = 90 m2**, `setbacks` (correct: depth is the limit). Confirms exact 3:1 alone would not be enough. |
| Sample 6.2 | footprint `{5.25, 8, 9.5, 15}`, 142.5 m2, not clamped, so 4b never runs; no warnings. PM's 6.2 reasoning (16:25 = 0.64 inside 0.5–2, full size fits at the centre) is right. |
| Sample, default setbacks, each non-street edge overridden | footprint and signature identical for all four edges: nothing resets, nothing asked. Correct (back = side = 2 m). |
| Sample, back 5 / sides 1 (F2-S4 test) | automatic: 10.5 x 13 = 136.5 m2; angled edge back -> side: 10.5 x 13.5 = 141.75 m2 (size changes, so the R5 dialog appears, as the story's test needs); top edge -> side gives a clamped 128.25 m2. The story's test cases exist and are non-degenerate. |
| Layout spike, footprints 2:1–3:1 both orientations (copy of the spike, ratio drawn from [2, 3] or its inverse) | 21 of 2 749 no-layout at <= 85 % fill (**0.8 %**; TL 0.6 % on his own draw), 10.8 % above, **0 invalid**, worst 72 ms. |
| Fixed cases 6 x 18, 18 x 6, 15 x 5, 5 x 15, 6 x 18.5, 4 x 12 m x {default ground, default first, two full 8-room levels} x 5 stair positions x lift | 185 programmes that fit by area, all valid except 4 x 12 m first floor at 100 % fill (expected). |
| `analyse` timing, 12-vertex 100 x 100 m comb (the existing timing-test plot) at 30 / 50 / 80 % | today 150–390 ms; **4b as written 280–700 ms** (2-core box shared with the FS, noisy). With the pruning in required change 4: 240–390 ms, identical results. |

### Faithfulness to the client decisions
- **CD-1: faithful.** Only clamped footprints change, up to 3:1 (plus less than one rounding step, as already accepted for 2:1), never above target; unclamped results and the sample are byte-identical. Trying 3:1 **and** 1:3 is within the decision: CD-1 says "the buildable area's long direction", and on a concave plot that is the direction of the arm, not necessarily the bounding box's. On convex plots the cross-direction try is tiny and cannot win (e.g. 6 x 2 m on the 10 x 50 plot). The PM text must say so (required change 2). The stretch-plus-search design, the tie order (step-4 result, stretch, 3:1, 1:3) and the `reason` test are accepted. The proportion wording is right in every case I ran.
- **CD-2: faithful.** Default 40-degree class kept; any non-street edge back <-> side; street edge always front; saved in the draft; marked labels; keyboard alternative; cleared on an outline change. The TL's change, clearing on reopen too, is allowed by CD-2 ("another rule the Tech Lead proposes, as long as it is stated and tested") and is the better rule. Reopen already resets Q6 and goes through `propose` (`stage-plot.js` `undo`), so a valid plan is never reset without the dialog. Putting overrides through `propose` and keeping them out of the signature is correct: they act only through setbacks, which the size-only signature already covers.
- **CD-3: recorded** as a non-goal, no change. Correct.

### Required changes
1. **`clamped` after step 4b is undefined, and the obvious reading breaks "rounding alone is not a clamp" (TL: A-6 4b; PM: 3.1 / F2-S3 one sentence).** 10 x 50 m at 20 % (target 100 m2): the 2:1 result is a clamped 6 x 12, and the stretch stops at its target cap `A / short`, giving 6 x 16.5 = 99 m2. That footprint is limited only by 0.5 m rounding, yet as written it keeps `clamped = true` with reason `setbacks` and says "reduced to fit inside the setbacks: 99 m2". Proposed rule (or an equivalent the TL states): after 4b, `clamped = false` when the final long side equals `floor05(A / short side)`, meaning only rounding was lost; otherwise `clamped = true`. QA cases: 10 x 50 at 20 % -> 6 x 16.5, no warning; at 24 % -> 6 x 18.5 = 111 m2 (the 1:3 try, at 3:1 plus one step), proportion wording; the three PM examples unchanged.
2. **PM 3.1, CD-1 bullet:** "along the long direction of the buildable area's bounding box" does not match A-6 4b. Reword: the 2:1 result's long side is lengthened, and footprints at 3:1 in both orientations are also tried (this matters on concave plots, where the buildable area's long direction can differ from its bounding box's). One sentence; 4.3 row likewise.
3. **Draft v2 (TL: A-4 and the F2-T3 file list).**
   (a) Removing the draft must remove **both** keys. `ui/storage.js` `flush` removes only `PC.draft.KEY` when the state is empty. With the v1 fallback read, "Start new" over a not-yet-migrated v1 draft would leave the v1 key, and the next reload would offer the old draft again (F1-S5 broken). Test: v1 draft stored -> Start new -> reload -> nothing offered.
   (b) A-4 still says "(version 1)", `v: 1` in the schema block, and "Draft: key `plotcraft.draft.v1` … `v !== 1`". Update these to v2 with the migration, so the canonical schema section does not contradict itself.
   (c) List in F2-T3 the test files that hard-code v1, so the bump does not leave run-all red as the F2-T2 riders did: `tests/unit/draft.test.mjs` (key test), `tests/e2e/plot.spec.mjs`, `tests/e2e/shell.spec.mjs` (`KEY`) for the FS; `tests/qa/session.mjs` (`KEY`) and `tests/qa/f1-t1-layout.mjs` (`PC.DRAFT_V !== 1`) as QA maintenance in the same round.
4. **Performance bound by design (TL: A-6 4b, one sentence).** In the 3:1 / 1:3 fallback searches, start the running best at the current winner's area: skip any candidate that cannot strictly beat it, and return "no improvement" if none does. Results are identical, because ties keep the earlier result anyway. My model of 4b as written exceeds 500 ms on the comb plot; with this pruning it stays at today's level. The timing test should run the comb at 30 % and 80 % (both clamped, so 4b runs).
5. **F2-S4 keyboard criterion not covered (TL: F2-T3 increment 1 UI + QA list; Designer: D markup).** The story requires that "the focused edge is highlighted in the drawing and its number, length and class are readable as text (accessible name)". Neither increment 1 nor D's acceptance mentions it. Add: focus on an edge row or `edge-switch` highlights that edge in the preview. `edge-switch` gets a full accessible name, e.g. "Edge 3, 8.9 m, back: make side" (`aria-label`, or `aria-describedby` to `edge-name` / `edge-class`); "Make side" alone is not enough.

### Decisions
- **D1 CD-1 direction:** both orientations (stretch, 3:1, 1:3) accepted as faithful to CD-1. See required change 2 for the text.
- **D2 Reopen clears overrides:** the TL's rule is accepted. The invariant "overrides exist only on a closed plot" is tested through every plot operation and Q6, as A-4 lists. Add Start new to that list.
- **D3 Draft v2 with v1 migration:** accepted (about 20 lines, keeps drafts users already have). It is the first schema change since F1, so required change 3 applies.
- **D4 F2-T3 size:** accepted. The 3-tasks-per-feature limit rules out a fourth task, and the running F2-T2 fix round must not grow. Conditions: one `plan.md` covering both increments with one plan review. Increment 1 is approved (TL implementation review, focused green run) before any increment 2 code is written; both touch `stage-questions.js`. QA tests once, with the increment 1 list first. Increment 2's scope is unchanged from the approved plan.
- **D5 Street-edge tap message as a toast:** accepted as the "inline hint" of F2-S4 (in-page, R3). The PM may revisit it at the F2 feature review.
- **D6 Designer pre-step D:** accepted (hooks, values, contract, 44 px, no overlap with compass, collapse toggle or legend, sample scale >= 4.0 px/m at 360 x 640), plus required change 5.

### Non-blocking notes
- `PC.draft.parse`: also reject a non-empty `edgeOv` on an open plot (invariant rule 1). For entries equal to the automatic class, state whether they are dropped or rejected; dropping is simpler.
- The "choices were reset" notice subscriber must ignore `replace` and `cancelled` notifications. Otherwise Load sample, Start new or Resume over a draft with overrides shows a wrong "outline changed" notice. One e2e case.
- F3-T1 sweep: draw ratios up to 3:1 **plus one 0.5 m rounding step**, which real footprints reach (6 x 18.5, 4 x 12.5). My 6 x 18.5 cases pass.
- 4b does not find the largest possible footprint in every case: buildable 7 m wide, target 120 m2 gives 6 x 18.5 = 111 m2 where 6.5 x 18 = 117 m2 fits. This meets the PM's stated requirement (at least as large as both tries, never above target). Accepted; do not chase it.
- The 500 ms timing test runs two-at-a-time beside browser suites. If it flakes, measure the best of three rather than raising the bound.
- Standing risk carried from F1: the real-device publishing gate in `docs/04-feature-reviews/F1.md` is still OPEN. The new tap-mode control and edge list add to the list of things only a real phone will confirm.

VERDICT: CHANGES REQUESTED

---

## Round 4 — re-review — 2026-11-20

Re-read the PM's revised 3.1, 4.3, F2-S3 and round-4 table, A-4 / A-6 4b in `architecture.md`, F2-T3 and pre-step D in `F2-plan.md`, and the F3-T1 sweep in `F3-plan.md`. Docs only; no tests run (QA is in the tree).

| # | Status | Evidence |
|---|---|---|
| 1 `clamped` after 4b | Resolved | PM 3.1 "Clamped after the stretch" and the F2-S3 last bullet; A-6 4b "`clamped` after 4b"; F2-T3 QA list. All three have the same rule (long side = `floor05(A / short)` -> not clamped) and the same cases: 10 x 50 m at 20 % -> 6 x 16.5 = 99 m2 with no warning; at 24 % -> 6 x 18.5 = 111 m2 with the proportion wording; at 30 % -> 108 m2. These match my model from round 4. |
| 2 Direction wording | Resolved | PM 3.1 and the 4.3 row now describe A-6 4b: stretch the 2:1 result's long side, and try 3:1 in both orientations. The reason (on concave plots the arm can differ from the bounding box) and the tie order (2:1 result, stretch, 3:1, 1:3) are identical in A-6. |
| 3 Draft v2 | Resolved | (a) A-4: removing the draft (Start new, an emptied state in `flush`) removes both keys, with the test "v1 stored -> Start new -> reload -> nothing offered". (b) The A-4 heading, schema `v: 2` and the Draft bullet are updated; the `ns.js` row says 1 until F2-T3. (c) The five test files that hard-code v1 are listed with owners (FS three, QA two). |
| 4 Pruning and timing | Resolved | A-6 4b: the 3:1 / 1:3 searches start at the current winner's area, a search that finds nothing returns "no improvement", and results are identical. The timing test covers the comb at 30 % and 80 % (best of three if noisy). F2-T3 QA list matches. |
| 5 Focused edge and accessible name | Resolved | F2-T3 increment 1 UI: focus on a row or its `edge-switch` highlights the edge in the preview, and the FS sets the full accessible name. Pre-step D: visible text stays short and the name carries number, length, class and action. Both are in the QA list. |

Non-blocking notes from round 4 were all taken:
- `parse` rejects overrides on an open plot and drops entries equal to the automatic class.
- The notice ignores `replace` and `cancelled` notifications.
- The F3 sweep goes to 3:1 plus one rounding step (6 x 18.5, 4 x 12.5).
- The invariant test also covers Start new.

D1–D6 are recorded in F2-plan.

**One wording difference left (not blocking; TL aligns A-6 in passing, no re-review).** The PM applies the not-clamped rule whenever the 4b candidates were tried. A-6 applies it only when a 4b candidate wins, and otherwise keeps step 4's flag. They differ only in a rare case: step 4's own clamped result already has long side = `floor05(A / short)`, so only rounding was lost. **Decision: the PM sentence governs.** Once 4b has run, `clamped = (long side != floor05(A / short side))`, whichever candidate won. This is the consistent reading of "rounding alone is not a clamp".

### Required changes
None.

VERDICT: APPROVED
