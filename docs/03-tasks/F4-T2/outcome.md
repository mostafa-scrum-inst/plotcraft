# F4-T2: Step 0 + roof, furniture, outdoor items, north marker (outcome)

Owner: FS. Status:
- **Step 0 PASSED QA** (`qa-report-step0.md`: no bugs, full run 409.0 s). TL review **APPROVED** (`impl-review-step0.md`).
- **F4-T2 proper PASSED QA** (`qa-report.md`: no bugs, full run 414.5 s; 24 of 24 QA mutations caught). TL review
  **APPROVED** (`impl-review.md`).
- **Commits:**
  - f93c3df (Step 0) and 9a70a49 (Step 0 TL approval);
  - 2a465f8 (Step 0 QA);
  - 029d6d9 (proper, merged as ce0849a);
  - 261c54b (proper QA).

Sources:
- `plan.md` §1–§8 and `plan-review.md`: TL rulings Q1–Q12, required items 1–3, CTO items;
- `designer-plan.md` §1–§4;
- PM goals-and-stories round 10 (Q2–Q8; CD-4 rooms 8 → 10; CD-5 host table);
- architecture A-6, A-8 to A-11 and A-16;
- `impl-notes.md` (FS, proper).

## 1. What was built

### Step 0 (2D carry-overs, before the 3D work)
- **0.1 CD-4: 10 rooms per floor.**
  - `MAX_ROOMS_PER_LEVEL` is 10 (pairs stay 6).
  - The layout memo key is now `ci * (1 << n) + mask`.
  - Exact speed-ups:
    - a prefix walk;
    - branch and bound with a 1e-6 margin and a mask-order replay at 1e-9;
    - a column memo across shapes and subsets;
    - a leaf bound and a pair table;
    - a size-keyed cell share;
    - skipping the f = 1-first phase.
  - Every 1–10-room output is byte-identical to before: the goldens, a 2 400-programme sweep, and QA's 400-programme
    identity check against the pre-Step-0 `layout.js`.
  - Worst grid case is about 90–160 ms, against a 300 ms gate.
- **0.2 CD-5 hall access.**
  - `PC.layout.access(W, D, rooms, core, pairs, types)` is now in `core/access.js`. It moved there from layout.js in
    proper, for the TL note.
  - Rule: hall or core contact of 0.8 m or more, or reached through a pair partner or a host from `C.HALL_ACCESS`
    (Bathroom via Bedroom or Maid's room; Storage or Laundry via any non-service room), chained.
  - Warning text (PM round 10 Q3): "The <room> has no way in from the hall or stairs. Move or resize a neighbouring
    room to open one."
- **0.3 Low-fill hint.** `PC.plans.lowFill` shows a hint below 50 %, rounded down.
- **0.4 Pair text.** Updated.
- **0.5 One-step Undo.**
  - The `plan-undo` button sends focus to Regenerate.
  - It shows "Last edit undone." or "Last edit undone. Ground floor approved again.".
  - It is dropped on approve or unapprove, a floor-tab switch, Regenerate, an R5 reset, leaving stage 3, and a store
    replace.
- **0.6 ft minimum.** In ft the snap also stops at the 1.5 m minimum (`PC.plans.ctx(s, id).minSnap`).
- **0.7 Sample strip.** The strip shows on stages 1 and 3 only (`PC.ui.shell.STRIP_STAGES = [1, 3]`).
- **0.8 Lift overlap.** A room on the lift now counts as an overlap.
- **0.9 `applyEdit` guard.** It refuses edits to a stale plan, sizes of 0 or below, and unknown ids.
- **0.10 House reachability.** `PC.house.build` needs stage 3 to be reachable.
- **C0 test runner.** `run-all` runs at `--jobs 3` by default (A-16).

### F4-T2 proper (3D)
- **Furniture (A-11).**
  - `PC.furnish.room(room, table, density)` and `PC.furnish.pose` in `core/furnish.js`:
    - inset 0.15 m;
    - scales from 1.00 down to 0.60 in steps of 0.05;
    - a clash is an overlap greater than 0.01 m + 1e-9;
    - a centre piece and its offset turn when W < D;
    - sparse keeps only the sparse pieces.
  - `PC.house.build` fills `rooms[].furniture` in frame L with the Q18 hex colours.
  - `three/build-interior.js` builds one "furniture" batch per level group.
- **Roof (`three/build-roof.js`, one "roofBatch").**
  - Wall bands from floor + 1.2 m up to the next slab on every above-ground level, so Roof on shows a closed exterior.
  - Pitched: a 30° gable, ridge along the longer side, no overhang, slopes in `roof` and gables in `wall`.
  - Flat: a 0.2 m slab with a 0.15 m parapet, 0.3 m high, or 1.0 m when usable or terrace.
  - Terrace: a pergola over the back third.
  - Usable: a 2.4 m stair head and a 1.2 m lift overrun (`roof.stairHead` / `roof.liftHead`).
  - A usable roof is never pitched in the model.
  - The Roof switch (`v3-roof`) is enabled. It shows the roof with All only.
- **Outdoor items** (`core/site-outdoor.js` and the "siteBatch" in `three/build-site.js`).
  - **Wall:** 1.2 × 0.2 m, centred 0.1 m inside each plot edge (`addSeg`).
  - **Gate:** at Left / Centre / Right, which is 25 / 50 / 75 % of the street edge. It is a 3 m gap with two
    0.4 × 0.4 × 1.4 m trim posts and no leaf. There is no gate without the wall (`PC.site.gateU`), and the Q-gate radios
    are disabled while the wall is off, with their value kept (PM Q7).
  - **Pool:** a flush `poolWater` plane at Y 0.03 plus a 0.3 × 0.1 m rim.
  - **Parking:** pads, plus a canopy with its top at 2.4 m on 4 posts when covered.
  - **Entrance step.**
  - **Seating:**
    - `PC.site.seating` looks for a 3 × 3 m pad in the back yard, the wider side yard, the other side yard, then the
      front;
    - it keeps 0.3 m from the edge and stays clear of footprint + 1 m, parking, pool + clearance and the path strip;
    - the table and benches run along `along`;
    - when no pad fits, the new warning `seating-omitted` (q 17) shows the PM Q8 text. The sample fits and has no
      warnings.
  - **North needle:**
    - `PC.site.northMarker` gives `{u, v, L}` with `L = clamp(0.06 × max bbox side, 1.5, 3)`;
    - it takes the first clear corner of FL / FR / BL / BR and is never omitted;
    - it is drawn as two `addFlat` triangles 0.04 m high, N half in `northMarker` and S half in `poolRim`.
- **BoxBatch.** New `addSeg`, `addFlat` and `addPrism`, all with outward winding.
- **Site memo key.** It now includes `extras` (wall, gate, seating).
- **Constants.** `PC.C.FURNISH`, `PC.C.ROOF`, `PC.C.SITE`.
- **Meshes.** The sample has 12; the maximum house has 18 (4 levels × 10 types, everything on). The render loop is
  still on demand, and a context restore does one rebuild.

## 2. Files

- **Core:**
  - new `core/access.js` and `core/furnish.js`;
  - changed: const, layout, levels, plans, house, site, site-outdoor, validate.
- **Three:**
  - new `three/build-roof.js`, `three/build-interior.js` and `three/build-site.js`;
  - changed: util (BoxBatch), scene, build-shell.
- **UI:** stage-3d (Roof enabled), stage-questions (Q-gate disabled rule), stage-plans and plan-editor (Undo, low
  fill, ft minimum), shell (`STRIP_STAGES`), `css/42-stage-plans.css`, `index.html`.
- **Manifest:** `src/manifest.json` (the new files).
- **Docs:** architecture A-2 file map, A-9 model fields, A-10 as-built notes.
- **FS tests:**
  - unit: layout10, access, furnish 5, outdoor 6;
  - three: roof 5, site 6, interior 4;
  - e2e: plans-step0.spec 57, outdoor.spec 9, view3d.spec 54;
  - helpers: `scene3d.mjs`, `batch.mjs` (`windingProblems`), `houses.mjs` (maxHouse with all 10 types).
- **QA suites:**
  - `tests/qa/f4-t2-s0-core.mjs`, `f4-t2-s0-ui.mjs` and `run-f4-t2-step0.mjs`;
  - `f4-t2-model.mjs`, `f4-t2-view.mjs` and `run-f4-t2.mjs`;
  - `f4-t2-ref.mjs` (oracles);
  - version-aware updates to f4-t1-view, stage2kit and f2-t2-questions.

## 3. APIs for F4-T3 (vegetation, sky, season)

- **Site model (frame L, `PC.site.analyse(state)`).** It gives `footprint`, `parking`, `pool`, `seating`
  (`{u, v, w, d, along}` or null), `northMarker` (`{u, v, L}`), `veg` (`{area, pct, reduced}`), `omitted`, `ptsL`,
  `edge`.
- **Exclusion areas for vegetation (A-9).**
  - `PC.site.pathStrip(site, extras)` is the 2 m strip from the street to the door, widened to the gate.
  - The internal `blocked()` in site-outdoor.js already collects footprint + 1, the path strip, parking and pool +
    `POOL_CLEAR`.
  - F4-T3 adds:
    - the seating pad;
    - 0.7 m from the boundary;
    - trees clear of footprint + 1 m + the canopy radius (1.55 m at the largest scale, TL ruling);
    - shrubs clear of footprint + 1 m.
  - `PC.site.gateU(site, extras)` gives the gate centre, or null.
- **House model.**
  - `house.site.trees` and `house.site.shrubs` are still `[]`, and `vegPct` is filled. F4-T3 fills the arrays from
    `PC.scatter.vegetation(site, seed)`.
  - The site memo key already covers the extras. Add the vegetation inputs if the scatter reads anything new.
- **Scene hooks.**
  - The site group is `world.getObjectByName('site')`. Vegetation goes there as InstancedMesh "trunks", "canopies" and
    "shrubs" (A-10).
  - Mesh budget headroom: 18 of the G6 limit of 150. The TL's working budget is ≤ 40.
  - `three.buildSite` returns its meshes for `S.meshes` and disposal.
- **Lights.**
  - `scene.js` `lights(house)` takes the fixed `three.noonLook()` and `three.noonSunDir(northDeg, elev)`. F4-T3 swaps in
    `PC.sky.compute` (A-13).
  - The plot grass material is `mats.ground` (`SC.ground` = summer). `applyLook` should set its colour per season.
    `groundOuter` never changes with the season.
  - `poolWater` has its own material, `mats.poolWater`.
- **North.** `PC.three.needle(house)` gives the needle corners in T. The N tip points along (sin N, −cos N), the same
  north the sun azimuth uses.

## 4. How to verify

- `node build.mjs && node tests/run-all.mjs` is the full run, about 410–415 s at `--jobs 3`.
- A focused run: `node tests/run-all.mjs --unit --three --e2e --only view3d,outdoor,plans,questions,interior,shell,contract`
  (about 90 s).
- QA only: `node tests/run-all.mjs --qa --only f4-t2`.
- By hand, in `dist/index.html`:
  - Load the sample and Skip to 3D.
  - Turn Roof on: flat roof, closed walls. Try Pitched, then Terrace + usable + lift.
  - Orbit 180° to see the pool, seating and needle.
  - Turn the wall off on stage 2: the Gate radios are disabled.
  - On a 16 × 18 m plot at 50 % with seating on: the seating warning.

## 5. QA sign-off and run times

- **Step 0** (`qa-report-step0.md`):
  - PASSED, no bugs: 14 core checks and 63 UI checks;
  - 9 of 10 mutations caught; the tenth, Undo on a tab switch, is equivalent (render drops the snapshot anyway);
  - full run 409.0 s, exit 0.
- **Proper** (`qa-report.md`):
  - PASSED, no bugs: model 18 checks, view 22, f4-t1-view 175/175;
  - 24 of 24 mutations caught;
  - full run 414.5 s, exit 0 (target 420 s). Splitting the runner into `run-f4-t2` (about 25 s) and
    `run-f4-t2-step0` (about 92 s) brought it under target from 446.0 s.
- **FS:**
  - Step 0: 27 mutations, 25 caught and 2 explained; full run 360.3 s without the new QA suite;
  - proper: 11 of 11 mutations caught; focused run 91.4 s.
- **TL:** focused run 17.2 s (unit 386, three 57, e2e outdoor 9, view3d 54, view3d-real 38).

## 6. TL rulings applied

- **Q1:** Step 0 output is exact (byte-identical layouts).
- **Q10:** 30° gable, no overhang, gables in `exteriors.wall`.
- **Q12:** `addPrism` with outward winding.
- **Required item 2:** wall bands, so Roof on is a closed exterior (PM accepted).
- **Required item 3:** `addSeg` / `addFlat`; marker direction to 1e-9.
- **Model fields:** `roof.liftHead`, `northMarker {u, v, L}`.
- **Trees:** clear of footprint + 1 m + canopy radius (for F4-T3).
- **Designer:**
  - wall 1.2 m, gate posts 1.4 m, no leaf;
  - pool water at Y 0.03 plus the rim;
  - lift overrun 1.2 m;
  - seating per designer-plan §4;
  - needle sizing.
- **PM round 10:**
  - Q2 CD-5 host table;
  - Q3 text;
  - Q5 Undo;
  - Q7 no gate without the wall;
  - Q8 seating warning; the sample must fit.
- **TL Step 0 non-blocking items, both done in proper:** a dedicated check that a tab switch drops Undo, and
  `access()` moved to `core/access.js`. S6 was accepted as near-equivalent.

## 7. Known limits

1. **Hall pockets.** An isolated pocket of hall counts as access under CD-5 (PM round 10). A room that opens only onto
   a closed hall pocket gets no warning.
2. **Default camera.** With the sample's reset pose the pool and seating sit behind the house and show only after
   orbiting (TL 6b). This is not a defect, but worth knowing for the client demo.
3. **Phone scale.** A full 10-room Ground floor (30 × 36 m plot at 60 %) fits at 13.2 px/m at 360x640, under the
   14 px/m the sample keeps. Every room is still labelled and no labels overlap. Larger footprints fit smaller, as
   before Step 0.
4. **Lint length warnings.** `core/layout.js` is 334 lines and `ui/stage-plans.js` 320 (target 300). The TL accepted
   both.
5. **Mutation S6.** It survives. Choosing `m` as the minimum of both f = 1 phases instead of the first with a leaf is
   accepted as near-equivalent: both bound every fill leaf by a real f = 1 leaf.
6. **Seating position.** Inside the chosen yard, the pad goes to the 0.5 m position nearest the yard's middle. No test
   pins that tie order; QA checks the yard order and the pad's validity only.
7. **Unreachable states.** A structural answer committed directly on stage 5 shows "3D view unavailable" (TL 6c).
   Undo over a stale plan arises only through a direct store change (QA Step 0 observation 2). Neither is reachable
   from the UI.
8. **Vegetation.** Not built yet: `trees` and `shrubs` stay empty until F4-T3.
