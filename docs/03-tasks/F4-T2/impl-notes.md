# F4-T2 proper: implementation notes (for the TL implementation review)

Owner: FS. Tree: worktree `/home/user/plotcraft-f4t2`, branch `f4t2-proper`, on 9a70a49 (Step 0 approved). Not committed and not
yet in the main tree, because QA is testing Step 0 there. Sources: `plan.md` §4–§8, `plan-review.md` (Q10, Q12, required
items 2–3), `designer-plan.md` §2–§4, PM round 10 Q7 / Q8, the TL's non-blocking Step 0 items.

## 1. What was built

- **Furniture (A-11).** New `core/furnish.js`: `PC.furnish.room(room, table, density)` and `pose`. Inset 0.15 m; scales
  1.00 down to 0.60 in steps of 0.05 (the size and the offset scale, h and y0 do not); overlap > 0.01 m + 1e-9 rejects; a
  centre piece turns, and so does its offset, when W < D. It matches QA's F3-T3 reference furnish on 19 220 rooms
  (scratch probe, 0 differences). `PC.house.build` fills `rooms[].furniture` in L, with the colour set to the Q18 hex.
- **Roof (`three/build-roof.js`, "roofBatch").**
  - Wall bands on every above-ground level, from floorY + 1.2 to baseY + pitch (`wall`; required item 2).
  - Pitched: an `addPrism` 30° gable, ridge along the longer side, no overhang, gables in `wall` (Q10, Q12).
  - Flat / terrace: a 0.2 m slab and a 0.15 m parapet, 0.3 m high, or 1.0 m when usable or terrace. The terrace adds a
    pergola over the back third.
  - A usable roof adds the stair head (2.4 m) and the lift overrun (1.2 m, from the new `roof.liftHead`).
  - A usable roof with Pitched is built as flat in the model.
  - The Roof switch is enabled: `v3-roof` is no longer in LATER.
- **Outdoor items (`core/site-outdoor.js`, `three/build-site.js`).**
  - Wall: 1.2 m high, built with `addSeg` 0.1 m inside each edge.
  - Gate: 25 / 50 / 75 % of the street edge, with a 3 m gap and 0.4 × 1.4 m `trim` posts. No leaf, and no gate without
    the wall (`PC.site.gateU`). The Q-gate radios are disabled while the wall is off, and their value is kept.
  - Pool: the `poolWater` plane at Y 0.03 plus a 0.3 × 0.1 m rim. Parking pads, a canopy on 4 posts, the entrance step.
  - Seating: `PC.site.seating`. It looks for a 3 × 3 pad in the back yard first, then the wider side, the other side and
    the front. It stays 0.3 m from the edge and clear of footprint + 1, parking, pool + clearance and the new path strip
    (`PC.site.pathStrip`). The table and benches run along `along`.
  - Seating warning: when no pad fits, `omitted` gets 'seating', validate adds the new warn rule `seating-omitted`
    (q 17, the PM Q8 text), and the item is absent from the scene. The sample's seating fits: 0 warnings.
  - North needle: `PC.site.northMarker` gives `{u, v, L}`, `L = clamp(0.06 × max bbox side, 1.5, 3)`. It takes the first
    clear corner of FL / FR / BL / BR and is never omitted. It is drawn as two `addFlat` triangles 0.04 m high, N half
    `northMarker` and S half `poolRim`; `PC.three.needle(house)` gives its corners.
- **BoxBatch (`three/util.js`).** `addSeg`, `addFlat` and `addPrism` use outward winding against an interior point.
  `userData` carries items, prisms, segs and flats.
- **Interior (`three/build-interior.js`).** One "furniture" batch per level group.
- **Site memo key.** It now includes `extras`.
- **Constants.** `PC.C.FURNISH`, `PC.C.ROOF`, `PC.C.SITE`.
- **Step 0 items.**
  - `access()` is in `core/access.js` and is still called as `PC.layout.access`. layout.js is now 334 lines, so the
    lint warning stays.
  - A dedicated check that a tab switch hides Undo (`plans-step0.spec`).
- **Mesh budget.** The sample has 12 meshes and the maximum house (4 levels, all 10 room types) 18. The maximum house
  builds in under 250 ms in the mock, and its model in under 50 ms.

## 2. Tests

- **New:**
  - unit `furnish` 5/0 and `outdoor` 6/0;
  - three `roof` 5/0, `site` 6/0 and `interior` 4/0;
  - e2e `outdoor.spec` 9/0: Q7 disabled / kept, and a 16 × 18 m plot at 50 % where seating is the only warning (stages
    2 and 3).
- **Updated:**
  - `view3d.spec` 54/0: the Roof switch by touch and keyboard, furniture hidden with its level, a Q19 sparse rebuild;
  - `plans-step0.spec` 57/0;
  - `scene`, `house` and `validate`;
  - the helpers `houses` (maxHouse uses all 10 types), `batch` (`windingProblems`) and the new `scene3d`.
- **Mutations: 11 run, 11 caught.** The mutations were:
  - the overlap slack;
  - an unturned centre offset;
  - Right at 25 %;
  - the ridge on the short side;
  - no wall bands;
  - the wall gap on the wrong edge;
  - pool water left in when the pool is omitted;
  - a mirrored needle;
  - a raw furniture colour;
  - no seating warning;
  - Q7 not disabled.
- **Focused run** (`--unit --three --e2e --only view3d,outdoor,plans,questions,interior,shell,contract`): all steps
  passed in 91.4 s. Lint: 0 violations, 2 length warnings (layout.js 334, stage-plans.js 320).

## 3. Notes and known limits

- **QA impact.** `tests/qa/f4-t1-view.mjs` still counts `v3-roof` as a disabled later-task control (line 344 and the
  `.pc-switch:has(v3-roof)` check at line 369). It is now enabled by design. QA owns that file.
- **Hall pockets (TL Step 0 note).** An isolated hall pocket counts as access under CD-5 (PM round 10, known limit),
  so a room that opens only onto a closed pocket of hall gets no warning.
- **Vegetation (A-9 rules).** Vegetation is left for F4-T3. Its exclusions (path strip, seating pad) are ready in
  `PC.site`.
