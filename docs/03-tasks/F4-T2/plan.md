# F4-T2 plan: Step 0 (F3 follow-up bundle, CD-4, CD-5), then roof, furniture and outdoor items (FS, 2026-11-21)

Inputs:
- `docs/02-features/F4-plan.md`: the F4-T2 section, its new **Step 0**, and the F4-T1 rider (the `PC.furnish` 1e-9 slack);
- `docs/04-feature-reviews/F3.md`:
  - PM round 8 decisions 1, 2, 4, 5 and 9 (the bundle);
  - the CTO's debt item 6, his round-2 `applyEdit` guard, and his cost note on 10 rooms;
- `docs/01-product/client-decisions.md` CD-4 (10 rooms per floor) and CD-5 (the hall-access warning);
- `docs/03-tasks/F4-T1/outcome-review.md`:
  - carried items 1–3: TL item 2, Step 0, and `--jobs 3`;
  - the runtime ruling. The orchestrator confirmed that the TL's second `--jobs 3` run is green (384.9 s), so the switch is unconditional.
- architecture A-4, A-5, A-7, A-8, A-9, A-10, A-11 (placement rule, 1e-9 slack), A-13 (only so nothing here blocks F4-T3), A-15, A-16;
- `goals-and-stories.md` 3.3 (roof types), Q15–Q17, and F4-S1;
- `docs/03-tasks/F3-T3/outcome.md` §7, the 3D art-direction note;
- the current `src/` and tests.

This is a plan only. No source or test file in the repo has changed.

Three scratch probes ran outside the repo (§13). For two of them I made temporary edits to `src/js/core/layout.js` and reverted each one; the file is byte-identical to the original, which I checked with `diff`. **They found a latent generator bug that blocks CD-4 as it stands** (§2.2).

## 0. Summary

| Increment | What | Reviewed |
|---|---|---|
| **C0** (first commit) | `tests/run-all.mjs` default `--jobs 3`, the "2 cores" comment corrected, A-16 wording | with Step 0 (trivial) |
| **Step 0** (own TL plan review, own impl review, QA in the F4-T2 round) | 0.1 CD-4 (10 rooms, generator fix and re-proof); 0.2 CD-5 (hall-access warning); 0.3 low-fill hint; 0.4 pair-hint text; 0.5 one-step Undo (Designer slot); 0.6 ft minimum snap; 0.7 `STRIP_STAGES = [1, 3]`; 0.8 CTO debt 6; 0.9 `applyEdit` guard; 0.10 TL item 2 | **now**: this plan, §1–§3 |
| **F4-T2 proper** | `PC.furnish`, house model completed (furniture, stair head, gate, seating, north marker, entrance), `build-roof.js`, `build-interior.js`, `build-site.js`, Roof switch enabled, rebuild on Q18 / Q19 | §4–§8. Reviewed with this plan; no code before Step 0 is approved and landed |

Key choices:
1. **CD-4 needs a generator fix, not just a constant.**
   - `layout.js` `cellLay` memoises by `ci * 256 + mask`. With 9 or more rooms the mask reaches 256, keys from different cells collide, and a cell reuses another subset's layout.
   - Today, at 9 or 10 rooms, `generate` returns **one room fewer** than asked (an invalid plan, which `check` would reject only if called). It **throws** when a pair names the lost room.
   - Fix: key `ci * (1 << n) + mask`. This cannot change any result at n ≤ 8, where no keys collide.
   - With the fix, 10 rooms always lays out valid plans, but the worst case takes **684–745 ms** in node, against the 300 ms bound. So Step 0 also carries a speed-up that keeps every output identical (§2.3), with a measured gate, and a TL fallback ruling if the gate is missed (Q1).
2. **CD-5 as a pure core function** `PC.layout.access(W, D, rooms, core, pairs)`, implementing the PM's definition literally. It flags the **sample's Ground-floor Bathroom** (r6, 2 × 2 m, boxed in by the Maid's room and the Laundry), and about **27 % of laid-out sweep levels**. The PM must decide the sample case and the text (Q2, Q3).
3. **Undo is guarded by content, not by events.**
   - The snapshot holds the level's plan before and after the edit.
   - Undo is offered only while the plan still deep-equals the "after" copy. So Regenerate, an R5 change, a resync, an approval toggle or a second edit invalidate it by construction, and it can never survive an R5 regeneration.
   - It lives in session state only; nothing goes into the draft (A-4).
4. **F4-T2 proper needs no new r128 API.** Prism, ring and arrow are hand-built geometry in `BoxBatch`; pool water is a `PlaneGeometry`. The mock whitelist is unchanged.
   - Maximum house at 10 rooms per level: 4 levels × 3 batches + roof 1 + ground 3 + site 2 = **18 meshes** (limit 40). Furniture is at most 40 × 8 = 320 boxes, still one batch per level.
5. **Runtime at `--jobs 3`:** about 385 s today against the 420 s target. FS additions are estimated at about 20 s for Step 0 + F4-T2 (§11).
   - The 9–10-room sweep is the expensive one: about 44 s at today's speed, about 7 s if the speed gate is met (§2.4). It is a **fixed 300-programme stream**, and it only runs inside the time budget once the speed gate is met.

## C0. `--jobs 3` default (first commit of F4-T2)

- `tests/run-all.mjs`:
  - `const jobs = Math.max(1, parseInt(opt('--jobs') || '3', 10) || 3);`
  - Header comment: `--jobs N  browser files run N at a time (default 3: measured green at 3 on this 4-core machine, TL F4-T1 outcome review)`. It replaces the wrong "2 cores" claim.
- A-16: "(default 2)" becomes "(default 3, TL F4-T1 outcome review: two green full runs, 366.9 s and 384.9 s)". Add: "target ≤ 420 s at the default, hard limit 600 s; a flake at 3 is fixed in its spec, never by falling back to 2".
- Check: one focused run (`--unit`) prints "3 at a time". The Step 0 full run is the first measured one at the new default.

## 1. Step 0 overview: files and contract

- **Files**
  - Core:
    - `src/js/core/const.js`: `MAX_ROOMS_PER_LEVEL: 10`, `HALL_ACCESS_MIN: 0.8`, `LOW_FILL: 0.5`;
    - `layout.js`: memo key, speed-up, `access`;
    - `plans.js`: `fill`, `applyEdit` guard, `undoable` / `undoEdit`, the `resizeRect` minimum candidate.
  - UI:
    - `stage-plans.js`: warnings, the Undo button controller;
    - `plan-editor.js`: passes the before / after snapshot through `host.committed`;
    - `shell.js`: `STRIP_STAGES`;
    - `src/index.html`: the Undo button, placed by the Designer.
  - Contract: `tests/contract/hooks.json` (`btn-undo`).
- **Texts**: all new strings sit in `TEXT` tables (`stage-plans.js` `T`), not inline.
- **A-7 sync contract kept.** Nothing new mutates plans outside `commit`. `access` and `fill` are derived and never stored. The undo snapshot is UI session state.

## 2. CD-4: 10 rooms per floor

### 2.1 Constants, texts, counters, drafts
- `MAX_ROOMS_PER_LEVEL: 8 → 10`. Every UI text already reads the constant:
  - `q-rooms.js` "n more fit (10 per floor)", "already has 10 rooms, the most per floor", "Enter a count from 1 to 10", group counter "3 of 10";
  - `levels.js` `removalQuestion` "… would have more than 10 rooms".
  - The one stale comment (`levels.js:143` "8 rooms or 6 pairs") reads the constant name instead.
- `MAX_PAIRS_PER_LEVEL` stays 6. Not asked; Q4.
- **Drafts:** no schema bump (CTO cost note). `draft.js` validates `≤ C.MAX_ROOMS_PER_LEVEL`, so every saved draft (≤ 8) stays valid. A 9–10-room draft would be refused by an older build, which is normal for a forward-only prototype; one sentence in A-4.
- **Tests that hard-code 8, updated in the same change:**
  - `tests/unit/const.test.mjs` (the constant row);
  - `rooms.test.mjs:108` and the `rooms.spec` / `questions.spec` "more than 8 rooms" text;
  - `rooms.spec:55` group counts "3 of 8" / "6 of 8";
  - the `layout.test` names.
- **QA suites that hard-code 8** (QA's files; I do not edit `tests/qa`): `f2-t2-questions`, `f2-t3-site-rooms`, `f3-t1-plans`, `f3-t1-stage3`, `f3-t2-edit`, `f4-t1-model`, `f1-t1-layout`, and `inpage.js` (grep hits; QA confirms which are the limit).
  - **QA-first**, as in F4-T1: QA makes them read `PC.C.MAX_ROOMS_PER_LEVEL` (version-aware) before the constant lands.
- **Test house:** `tests/helpers/houses.mjs` `maxHouse` grows to 10 rooms per level (the G6 maximum house per CD-4). The F4-T1 tests that count its meshes stay at 11, because the shell is per level, not per room.

### 2.2 The latent bug (found by the probe)
- `generateOrdered` → `cellLay(ci, mask)`: `var key = ci * 256 + mask`.
  - For n ≥ 9, masks run up to `2^n − 1 ≥ 256`, so `(ci, mask)` and `(ci + 1, mask − 256)` share a key.
  - The memo then returns another subset's cell layout, so a room disappears.
- Measured on 10 × 15, lift, centre stair, 60 % fill:

| Rooms | Pairs | Result |
|---|---|---|
| 8 | 0 / 1 / 3 | correct |
| 9 | 0 | 8 rooms returned |
| 10 | 0 | 9 rooms returned |
| 9 | 1, 3 or 4 | TypeError in `adjacent` |
| 10 | 3 or 5 | TypeError in `adjacent` |

- **Fix:** `var key = ci * (1 << n) + mask;`.
  - n ≤ 8 keys are unique before and after, so every existing output is unchanged; proved by the F3-T1 golden fixture and the sweep's per-programme hashes, both of which were green in the probe.
  - `column`'s key `i * 16 + j` is safe up to 16 rooms. I'll leave a comment naming the bound.
- **Regression test (`layout.test`):** 9 and 10 rooms, with pairs naming r9 / r10, return every room once and are valid by `check`. Mutation: the old key fails it.

### 2.3 Speed: the gate and the plan
- **Measured with the key fixed** (node, best of 3). Worst-case grid: 7 footprints (10×15, 12×16, 15×10, 8×20, 14×14, 6×18, 18×6) × fills 0.60 / 0.75 / 0.85 × 5 stair positions, 10 rooms + lift + 5 pairs, 105 cases:
  - all laid out and valid by `check`;
  - **worst 745 ms** (12 × 16 or 10 × 15, 60 % fill, centre).
  - Without pairs, the 10-room case takes 198 ms; the second room order and the 60 candidates roughly double the cell work.
- **Profile:** about 80 % of the time is in `layoutShape`'s partition loop (`evalT`, `column`, rect building). It runs once per (cell, room subset), with up to 2^(n−1) partitions × 2 axes × 2 scale factors × up to 3 shapes.
- **Planned speed-ups, all output-identical.** The proof for each is the golden fixture (every fixed case deep-equal), the sweep's 2 400 per-programme hashes, and a new 10-room golden recorded **after** the key fix and **before** any speed-up.
  1. Score first, build `rects` only for an improving partition. Probe: −8 %, still identical. Small.
  2. **Prefix-pruned recursive enumeration of partitions** in place of the `0 … 2^(n−1)` mask loop. A first column that fails (side, aspect, or the running thickness over `L`) prunes every partition that starts with it.
     - The tie rule "first strictly better by 1e-9 in mask order" is kept by comparing `(score, mask)` the same way: each partition keeps its mask number, and ties go to the lower mask.
  3. **Branch and bound on the score.** Every column's score is ≥ `min(full.sc, sq.sc)` ≥ 0, so a partial sum plus `4|f−1|n` that already exceeds the best (plus 1e-9) prunes. This is valid for the "upgrade in order" step, because an upgrade only lowers a column's score towards that minimum.
  4. Share the per-group column memo across the shapes of one cell when `S` and `f` agree (key on `S`, `f`, `i`, `j`).
- **Gate (in Step 0's impl review):** 10 rooms + lift + 5 pairs × the 105-case grid, worst < 300 ms in node (best of 3), and the existing 8-room timing tests unchanged.
  - If 1–4 do not reach it, I stop and report the measured worst for a TL ruling (Q1). I won't change the algorithm's results to get speed.

### 2.4 Re-proof at 10 (TL re-proves; FS provides the tools)
- **Worst case** (CTO): the 105-case grid above as `layout.test` "maximum level at 10 rooms":
  - every case `ok`, valid by `check`, and worst < 300 ms;
  - one 10-room case per stair position pinned in the golden fixture.
- **Seeded sweep at 9–10 rooms:** `tests/helpers/programmes.mjs` gets a second stream, `programmes10(C)` (own seed; n = 9 or 10; the same footprint and area rules).
  - **The existing 2 400-programme stream stays byte-identical**, so its golden hashes keep proving "no output changed".
  - The new stream: 300 programmes, no invalid result, no-layout ≤ 5 % at ≤ 85 % fill, worst < 300 ms (best of 3 when ≥ 300).
  - Probe at 600 programmes with the key fixed: 0 % no-layout (0 / 498 at ≤ 85 %, 0 / 102 above), 0 invalid, worst 1 148 ms in a single run, 44 s in total. After the speed-ups the 300-programme stream should take about 7 s (Q1).
- **House level:** `plans-sync.test` timing of `go(3)` on the maximum house, now 4 levels × 10 rooms + lift, logged with a bound of < 1 200 ms in node (4 × 300).
  - Phones are 3–5× slower, so in the worst case the stage-3 entry could take several seconds. Q1 asks whether stage 3 needs a "Laying out…" state like F4-T1's "Building…". I propose: not in Step 0; measured on the phone check.
- **Labels at 10 rooms:** the stage-3 canvas labels and the 2D plan at 360 px with 10 S rooms. One e2e shot plus a no-overlap check of the label boxes (the rule `room-labels.js` already enforces). The Designer judges the shot.

## 3. Step 0: the other items

### 3.1 CD-5 hall-access warning
- **Core:** `PC.layout.access(W, D, rooms, core, pairs) → [ids without access]`, frame P, pure.
  - **Hall contact of a room.** For each of its 4 sides not on the footprint boundary (within 0.02 m), the length of the side not covered by another room's or the core's touching side (within the A-8 adjacency tolerance 0.02 m). What is left faces hall, since hall is everything the rooms and core do not cover (A-8 step 7).
  - **Core contact:** the length shared with the stair or lift.
  - **Access** = hall contact ≥ `HALL_ACCESS_MIN` (0.8 m) **or** core contact ≥ 0.8 m (PM definition).
  - **Partner rule:** a room without access that is `PC.layout.adjacent` to a pair partner with access is reached. Applied to a fixed point, so chains count (Q3).
  - It reads the drawn plan, so edits update the warning live, after release.
- **UI:** one warning per boxed-in room, listed with the level's warnings, never blocking approval. Proposed text (PM, Q3): "The Bathroom has no way in from the hall or stairs. Drag a room aside to open one."
- **Probe:**
  - **sample Ground r6 (Bathroom) is flagged**: right and front sides are exterior; left side fully on the Maid's room, back side fully on the Laundry. The sample First floor is clean.
  - Defaults on 20 × 30: clean.
  - Sweep: 632 of 2 367 laid-out levels (26.7 %) have at least one flagged room; 1 068 of 11 568 rooms.
- **Not in the definition (Q3):** a hall pocket that touches no stair, lift or entrance still counts as "hall". I propose to keep it literal now and record it as a limit.
- **Tests:**
  - unit: hand-made cases at 0.79 / 0.80 m, exterior-only sides, core-only access, the partner chain, the sample;
  - e2e: the text appears and disappears after a drag (360x640 touch);
  - mutations: threshold, exterior skip, partner rule.

### 3.2 Low-fill hint (PM decision 1)
- `PC.plans.fill(state, id)` = (sum of drawn room areas + stair + lift) / footprint area, from the plan as drawn.
- The hint shows when `fill < LOW_FILL` (0.5) on the unrounded value; the text shows the whole percent rounded down. The text is the PM's: "Rooms fill only 48 % of the Ground floor. Add rooms, choose larger sizes, or lower the footprint % (Q3)."
- It is a warning, never blocks Approve, and shows the same in m and ft.
- The sample (81.1 % / 84.2 %) never shows it.
- Tests: 48 % shows; exactly 50 % does not (a constructed plan); the sample does not; defaults on a large plot do; ft gives the same text.

### 3.3 Pair-hint text (PM decision 2)
- `stage-plans.js` `warnings`: "Kitchen and Dining are not next to each other. Drag one against the other to join them." Unit and e2e assert the full string.

### 3.4 One-step Undo last edit (PM decision 4; Designer slot)
- **Core (pure, `plans.js`):**
  - `undoable(state, snap)`: true when `snap.level` still has a plan that deep-equals `snap.after`.
  - `undoEdit(draft, snap)`: in a commit, replaces the plan with `snap.before` (rooms, `edited`, `approved`, `unmet`) only when `undoable`; else changes nothing.
  - `before` is a deep copy of the plan just before the edit's commit; `after` is the plan after it.
- **What this gives by construction (PM list):**
  - It restores the approval state; an edit that un-approved comes back Approved.
  - One step only: a new edit replaces the snapshot.
  - Gone after Regenerate, an R5 regeneration (the plan's `sig` or rooms change, so `after` no longer matches), an approve / unapprove (`approved` changed), or a sync.
  - Leaving stage 3 drops the snapshot explicitly (PM: "gone after leaving stage 3"), and so does a tab switch to another level (Q5).
- **UI:**
  - `plan-editor.js` already makes exactly one commit per release. `host.committed` gets `{ level, before, after }`.
  - `stage-plans.js` keeps one snapshot and shows `btn-undo` only while `undoable`. A press commits `undoEdit`, clears the snapshot, keeps the selection, and announces "Last edit undone." in `plan-msg` (PM text, Q5).
- **Designer:** places a 44 px icon button (`#i-undo` exists in the sprite) in the stage-3 tool row, with `aria-label="Undo last edit"`. It must fit at 360 px with "Regenerate" and "Approve floor". The Designer does the markup and CSS; I do the hooks and logic. `tests/contract/hooks.json` gains `btn-undo`.
- **Tests:**
  - unit: undo after a move, after a resize, after an edit that un-approved (approval restored); not undoable after Regenerate, after an R5 change, after approve.
  - e2e: touch at 360x640 and mouse at 1280x800; the button is hidden when nothing can be undone.
  - mutation: undo without the `after` check fails the R5 case.

### 3.5 1.5 m minimum as a ft snap candidate (PM decision 5)
- `resizeRect`: the shrinking edge's allowed limit (`r.x + MIN`, `x1 − MIN`, and the y equivalents) is passed to `snapEdge` as one extra candidate `{ v: limit, kind: 'min' }`, always eligible (like 'core'), with no guide drawn.
  - Within `PLAN_EDGE_SNAP` of the limit, the edge lands exactly on 1.5 m.
  - In m, the 0.5 m grid already lands there, so nothing changes (the existing m tests and QA's 14 560-edit oracle stay valid).
- Test: in ft, dragging to 1.6 m lands at 1.5 m (shown as 4.9 ft); in m, unchanged.

### 3.6 `STRIP_STAGES = [1, 3]` (PM decision 9)
- `shell.js` gets the one constant. The e2e tests that expect the strip on stage 4 are updated (`shell.spec`; my grep finds the cases).
- QA's suites that expect it on 4 are QA-first.
- Skip from 1 and 3 is unchanged, and G1 stays at 2 taps.

### 3.7 CTO debt 6
- `plans-edit.test`: a room overlapping only the lift is reported by `PC.layout.overlaps`, and `approve` refuses it (`canApprove` gives `'overlap'`). Mutation: leaving the lift out of `overlaps` fails it.

### 3.8 `applyEdit` guard (CTO round 2)
- `applyEdit` returns `{ changed: false }` when the level's plan is stale (`p.sig !== PC.sig.level(draft, id)`) or `rect.w <= 0 || rect.h <= 0`.
- Unit test for both; the CTO's probe case (an edit of a stale plan at stage 3) becomes a unit case. Mutation: removing the guard fails it.

### 3.9 TL item 2: the `reachable` half of the house refusal
- `stages.status`: stage 3 is reachable only when stages 1 and 2 are valid. A state with fresh, approved stage-3 plans but stage 1 or 2 invalid is therefore the only way to pin `reachable` independently of `valid`.
- **Stage 1:** `plot.closed = false` makes `sig.level` return `'invalid'`, so plans can't be fresh: not usable.
- **Stage 2:** a **blocking validation conflict that does not change any level's signature** is reachable.
  - Candidates: the plot area below the minimum? No, that is stage 1. A Q15 parking that does not fit? That is a warning.
  - I will list the `validate.blocking` rules and find one independent of the A-7 signature inputs (e.g. a non-layout input such as Q4 / Q5 if any blocks).
  - If one exists, the test: approved, fresh plans + that conflict → `PC.house.build` returns `null`, and the mutation "drop `reachable`" fails it.
  - If none exists, I record in `house.js` and A-9 that `valid` already implies stage 2 valid ("no reachable state separates them"), with the proof (the rule list). The TL accepts that or not (Q6).

## 4. F4-T2 proper: house model completion (`core/house.js`, `core/furnish.js`)

- **`PC.furnish.room(room, table, density)` → pieces in frame P**, exactly A-11:
  - inset 0.15;
  - table order, sparse filter;
  - orientation rule with `center` turning;
  - offsets scaled with `s`;
  - `s` from 1.00 down to 0.60 in 0.05 steps;
  - inside with 1e-9;
  - overlap `> 0.01 + 1e-9` on both axes;
  - else drop.
  - **Unit room on the edge** (rider): two pieces overlapping by exactly 2.86 − 2.85 → allowed.
- **Model:** each room's `furniture: [{ kind, u, v, w, d, h, y0, color }]`.
  - `color` is the resolved hex from `PC.data.interiors[style][key]`, so Q18 changes the hex and the key, never the boxes.
  - `house.interior` is already in the model, so Q18 / Q19 changes give a new `key` and a rebuild with approvals untouched (F3-S4).
- **Roof:** `stairHead` = the stair rectangle in L when `usable` and stairs exist (A-9). `roof.type` is never `'pitched'` when `usable`; validation already switches it, and I'll add an assert in `build`.
- **Site (A-9):**
  - `gate: { u, w: 3 }` at 25 / 50 / 75 % of the street edge (Left / Centre / Right as seen from the street, Q14 convention), only when `extras.wall`. Q7: is there a gate without a wall?
  - `seating`: a 3 × 3 pad in the largest free yard rectangle, back yard first. Free means outside footprint + 1 m, parking, pool clearance and the gate-to-entrance strip.
    - It is computed in `core/site-outdoor.js` next to parking and pool, so the 2D summary can use it too.
    - If none fits, it is `null` and added to `site.omitted`. That needs warning text from the PM (Q8).
  - `northMarker: { u, v }`: a fixed spot outside the footprint near the front-left plot corner, inset 1.5 m, clamped inside the plot (Designer, Q9).
  - `entrance` stays as built in F4-T1 (door centre, 1.2 m).
- **Tests (`furnish.test.mjs`, `house.test.mjs`):**
  - every piece inside its room for 10 types × S / M / L and at the 1.5 m side;
  - no two pieces of a room overlap by more than 0.01;
  - sparse count < full count for every type at M;
  - Q18 changes colours only (boxes deep-equal);
  - gate at 25 / 50 / 75 %;
  - omitted parking / pool absent;
  - the maximum house has 40 rooms with furniture, built in < 50 ms.

## 5. `three/build-roof.js`

- **Group `roof` (exists, empty since F4-T1).** It holds one batch, `roofBatch`, at `roof.baseY`, visible only with Roof on + "All" (`applyVisibility` already does this).
- **Flat:** a 0.2 m slab over the footprint (`exteriors.roof`) and a 0.3 m parapet ring, 0.15 thick (`exteriors.parapet`).
- **Terrace:** the slab, a 1.0 m parapet, and a pergola:
  - 4 posts, 0.15 m, 2.4 m high;
  - 0.1 m beams every 0.6 m over the back third of the roof (`exteriors.roof`).
- **Pitched:** the gable prism `BoxBatch.addPrism(u0, v0, w, d, y0, rise, axis, hex)`.
  - The ridge runs along the longer footprint side, centred.
  - Rise = `tan(30°) × short / 2` (Q10).
  - The 2 sloped faces take `exteriors.roof`, the 2 gable triangles `exteriors.wall`.
  - No overhang.
  - Hand-built triangles: position, normal and colour attributes; the mock already enforces attribute counts.
- **Usable** (flat or terrace): parapet at least 1.0 m, plus the stair head: a block over `stairHead`, 2.4 m high, `exteriors.parapet`.
- **Tests (`roof.test.mjs`, mock):**
  - hidden by default, visible only with the toggle + All;
  - the three types differ (vertex counts and bounding heights);
  - usable → stair head present and never pitched;
  - ridge along the longer side for both footprint orientations;
  - parapet heights 0.3 / 1.0.
- **UI:** `v3-roof` is enabled, so it leaves TL ruling 3's disabled list. `view3d.spec`'s DISABLED / ENABLED sets are updated, and the Designer's disabled-style check drops it.

## 6. `three/build-interior.js`

- One `furniture` batch per level (name `furniture`, A-10), from the model's pieces.
- Each piece is a box at `floorY + y0 + h/2`, colour `PC.three.col(hex)`, cast + receive.
- An empty level gives no mesh (`BoxBatch.build` returns null).
- **Tests:**
  - box counts per level equal the model counts;
  - sparse < full;
  - Q18 → same boxes, different colours;
  - every box inside its room in T;
  - mutation: the Q14 mirror of the anchors.

## 7. `three/build-site.js` (vegetation stays in F4-T3)

- **`siteBatch` (one mesh):**
  - parking pads: 0.02 m paving per car;
  - covered parking: canopy 0.1 m at 2.4 m on 4 posts (`carCanopy`), between the building and the street, as placed;
  - pool rim: a 0.3 m ring, 0.1 m high (`poolRim`);
  - boundary wall along every plot edge, 0.2 m thick, inside the edge, with a 3 m gap at the gate on the street edge (`boundaryWall`). Height is Q11: I propose 1.2 m (the dollhouse cut height, so the yard stays visible), against a realistic 1.8 m.
  - gate posts: 0.4 × 0.4 × 1.4 m (`exteriors.trim`);
  - seating: pad 0.05 m (`paving`) plus 2 bench blocks and a table block (`seating`);
  - entrance step: 1.2 × 0.6 × 0.15 m in front of the door (`exteriors.trim`);
  - north marker: a flat arrow, 0.03 m high, 1.5 m long, rotated to `northDeg` (`northMarker`).
- **`poolWater`:** a `PlaneGeometry` at Y 0.03 inside the rim, `MeshLambertMaterial({ color: col(poolWater) })`.
  - The ground has no hole for a sunken pool; a flush water plane reads as a pool from above (Q11).
  - It goes in its own mesh so F4-T3 / F5 can tint it.
- **Items omitted by an F2-S3 warning** (`site.omitted`) are absent.
- **Tests (`site.test.mjs`, mock):**
  - covered parking adds 5 boxes per canopy;
  - the gate gap sits at 25 / 50 / 75 % of the street edge in T;
  - wall off → no wall boxes;
  - pool off / omitted → no `poolWater`;
  - the entrance step is on the street side of the front wall (+Z in T), centred on the door;
  - the north marker turns with Q5 by exactly ΔN.

## 8. Budget, real r128, e2e

- **`tests/three/budget.test.mjs`**, maximum house (CD-4: 4 levels × 10 rooms, full, lift, pool L, 4 covered cars, wall, gate, seating, usable terrace):
  - ≤ 40 meshes (18 expected);
  - one shadow light;
  - map 1024;
  - every material colour converted (the mock audit);
  - build < 250 ms in node.
- **`view3d-real.spec`** (≤ 30 s):
  - adds the maximum house at 1280x800: not blank, draw calls ≤ 80;
  - Roof on for flat / pitched / terrace: three different pixel signatures in the roof region;
  - `--shots`: the 3 roofs, Modern / Classic / Minimal on the sample, full / sparse.
- **`view3d.spec` (mock):**
  - change Q19 on stage 4 → stage 5 rebuilds, approvals still "2 of 2";
  - the Roof switch works by touch and keyboard;
  - the level selector still hides furniture with its level.

## 9. Step 0 tests and focused runs

- **Focused words:**
  - Step 0: `node tests/run-all.mjs --unit --three --e2e --only plans,rooms,questions,shell,contract`;
  - F4-T2: `--unit --three --e2e --only view3d`.
- **Mutations (Step 0):**
  - old memo key;
  - each speed-up broken (golden + hashes fail);
  - `HALL_ACCESS_MIN` 0.5;
  - exterior sides counted as hall;
  - partner rule off;
  - `fill` with requested instead of drawn areas;
  - `<=` instead of `<` 50 %;
  - undo without the `after` check;
  - the min candidate missing;
  - `STRIP_STAGES` with 4;
  - lift left out of `overlaps`;
  - the `applyEdit` guard off;
  - `reachable` dropped (if §3.9 finds a state).
- **Mutations (F4-T2):**
  - overlap without the slack;
  - the centre offset not turned;
  - the anchors mirrored;
  - the roof visible with a single level selected;
  - the ridge on the short side;
  - the gate at the left on Right;
  - furniture colour without `col`;
  - the wall gap on the wrong edge;
  - pool water left in when omitted.

## 10. Acceptance map

| Item | Where it is met |
|---|---|
| CD-4 | 10 per floor in every limit and text; generator re-proven (worst case, 9–10 sweep, timing, `go(3)`); drafts compatible; G6 maximum house at 10 |
| CD-5 | the warning per room, live after edits, non-blocking |
| PM 1, 2, 4, 5, 9 | §3.2–§3.6 |
| CTO 6 | §3.7 |
| CTO round 2 | §3.8 |
| TL item 2 | §3.9 |
| F4-S1 | roof criteria (§5), furniture (§4, §6), outdoor items (§7), omitted items absent |
| F3-S4 last criterion | Q18 / Q19 rebuild keeps approvals (§8) |
| G6 | budget test |

## 11. Runtime (target 420 s at `--jobs 3`, today about 385 s)

| Addition | Estimate |
|---|---|
| unit: 10-room worst-case grid | about 3 s after the speed-up; 75 s at today's speed, which is why the gate matters |
| 9–10 sweep, 300 programmes | about 7 s after the speed-up; about 22 s at today's speed |
| access / undo / fill units | < 1 s |
| three: roof / site / budget / interior | about 2 s |
| e2e: Step 0 cases inside existing specs | about 5 s |
| view3d-real additions (inside its own 30 s) | about 6 s |

- **Total FS: about 20 s.**
- If the speed gate is missed, the two generator tests move to their own run-all step, or run with a smaller grid (TL, Q1).

## 12. Risks

- **The speed-up may not reach 300 ms.** It is a measured gate with a stop-and-ask, never a silent bound change.
- **CD-5 noise:** 27 % of levels flagged, including the sample's Ground floor. The PM may want a narrower rule (Q2, Q3). The function takes the threshold from `PC.C`, so tuning is one constant.
- **Undo across tab switches:** decided in Q5.
- **Phone time at stage-3 entry with 4 × 10 rooms:** measured at the next phone check (Q1).

## 13. Scratch measurements (outside the repo)

- `gen10.mjs` / `crash.mjs` (temporary key fix in `layout.js`, reverted):
  - the 9 / 10-room crash and room loss;
  - the 105-case grid, worst 745 ms;
  - with the score-first change: 684 ms, and `layout.test` + `layout-sweep.test` 14/0 (output identical);
  - the 600-programme 9–10 sweep (0 % no-layout, 0 invalid, worst 1 148 ms single run).
- `prof.mjs`: CPU profile; 80 % in `layoutShape` (`evalT` 1 102 ms, `column` 430, `layoutShape` 332 over 4 runs).
- `access.mjs`: the CD-5 definition on the sample (G r6 flagged), defaults (clean) and the 2 400 sweep (26.7 % of levels).
- `layout.js` was restored and checked with `diff` against the backup.

## 14. Questions

**For the TL:**
1. **10-room speed.** Do you accept the gate (worst < 300 ms in node on the 105-case grid, with output-identical speed-ups 1–4)? If it is missed, which ruling: a raised bound at 10 rooms (e.g. 600 ms), or a stage-3 "Laying out…" state? Should the 9–10 sweep run in the unit step (about 7 s if the gate is met)?
4. Should `MAX_PAIRS_PER_LEVEL` stay 6 with 10 rooms? I recommend yes; CD-4 does not ask for a change.
6. **TL item 2.** If no state with fresh plans and an invalid stage 2 exists, is the recorded proof enough?
10. **Gable rise.** Is a 30° pitch, no overhang, gable ends in `exteriors.wall` acceptable? The pergola is over the back third at 2.4 m.
12. Is `BoxBatch.addPrism` (hand-built triangles) acceptable in place of any new r128 geometry, keeping the whitelist unchanged?

**For the PM:**
2. **Sample.** CD-5 flags the sample's Ground-floor Bathroom. Choose one:
   - (a) accept one warning on Load sample;
   - (b) change the sample (a new sample layout breaks many golden tests);
   - (c) narrow the definition.
   I recommend (a): it is honest and shows the feature.
3. **CD-5 text and rule.** Text: "The Bathroom has no way in from the hall or stairs. Drag a room aside to open one." Should the partner rule chain through several pairs (I propose yes)? Should a hall pocket that touches no stair, lift or entrance count as hall (I propose yes for now, listed as a limit)?
5. **Undo.** Is the snapshot dropped on a tab switch to another floor (I propose yes: one step, on the floor you see)? Is "Last edit undone." the right confirmation?
7. **Gate without a wall:** is a gate drawn when the wall is off? I propose no, since Q17 lists the gate under the wall.
8. **Seating that does not fit:** what is the warning text (a new F2-S3-style warning), or is it silently left out?

**For the Designer:**
- The Undo button's place in the stage-3 tool row at 360 px.
9. **North marker:** where it sits and its size.
11. **Boundary wall:** 1.2 m (dollhouse cut, yard visible) or 1.8 m (realistic)? Pool as a flush water plane?

**For QA (QA-first):**
- Make the suites that hard-code 8 rooms per floor, and the strip on stage 4, version-aware before 0.1 and 0.7 land.
