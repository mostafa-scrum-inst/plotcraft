# F3-T3 implementation review — Tech Lead

## Round 1 — 2026-11-21

Scope: (1) the Designer's F3-T3 implementation, (2) the FS obs-5 fix, (3) QA's A-16 trim of FS/Designer-owned e2e specs.
Tree: commit `eeddb90` plus the uncommitted `tests/e2e/interior.spec.mjs` (the Designer's part 2). Baseline for the diff: `9a0f497`.

### What I read and ran
- Code: `src/js/data/look3d.js`, `furniture.js`, `sky.js`; `src/manifest.json`; `src/index.html` (Q10 swatch markup, stage-4 Q18 / Q19 SVGs); `src/css/41-stage-questions.css`, `43-stage-interior.css`; `src/js/core/plans.js` `moveRect`; `tests/unit/data-tables.test.mjs`, `tests/unit/plans-edit.test.mjs` (new case); `tests/e2e/interior.spec.mjs`; `docs/03-tasks/F3-T3/verify/check-colours.mjs` (line by line against the A-11 placement rule); the trimmed e2e specs (`plot`, `questions`, `edges`, `rooms`, `plans-view`, `plans-edit`) and the QA twins they cite (`tests/qa/f1-t3-plot.mjs` sections L and O, `tests/e2e/r5.spec.mjs` viewports).
- Screenshots in `verify/shots/`: 360x640 stage 4 Modern, 360x640 Q19 Classic, 640x360 Q18 Minimal, 360x640 Q10, 1280x800 stage 4 Minimal.
- My own runs:
  - `node tests/run-all.mjs --unit`: 329/0 in 13.2 s (lint 0 violations, `data-literals-only` included);
  - `--e2e --only interior,contract,questions,plans-edit,r5,plot`: all green in 48.0 s (interior 77, contract 4, plans-edit 65, r5 54, questions 432, plot ok);
  - `node docs/03-tasks/F3-T3/verify/check-colours.mjs`: "all binding requirements met" (90 rooms, no sparse piece dropped, full > sparse everywhere, night background L* ≤ 11.5, noon/night ≥ 6.4);
  - two mutations of my own, both restored (`git diff -- src` empty afterwards): obs-5 line reverted → `plans-edit.test` 10/1 (the new case fails); classic `--h-floor` in the Q19 `:has()` rule changed by one unit → `data-tables.test` 8/1.
- Full run: the Designer's `node build.mjs && node tests/run-all.mjs` on this tree, exit 0 in 447.4 s (QA's 442.3 s before part 2). Under the 8-minute target. I did not repeat it: the tree has not changed since, and my focused runs cover every file the task touched.

### 1. Designer — F3-T3

Binding rulings from my plan review:

| Ruling | Where | Result |
|---|---|---|
| 1 floorMix: sRGB lerp, `Math.round`, hall mixed, stair / lift not | `look3d.js` header; `--h-floor` precomputed; unit `mix()` | Met. `--h-floor` #B4C895 / #B5C28F / #C0D29C as I computed at plan review; unit test parses the CSS and compares with `mix(roomTints.living, wood, floorMix)`. |
| 2 roomTints + hall / stair / lift; matching and ≥ 5.5 on the 10 types only | `look3d.js`; unit "roomTints" | Met. Key list asserted exactly; hue within 1.12°, L* −7.8 to −8.1; min type pair ΔE 6.5. |
| 3 Furniture under the A-11 placement rule, 90-room simulation | `furniture.js`; `verify/check-colours.mjs` | Met. I checked `placeOne` against A-11 step by step: 0.15 m inset; `center` with `W >= D` puts `w` along x, otherwise the piece and its offset turn (`cx − b, cy + a`); left / right have `w` along y; offsets in room axes otherwise; s from 1.00 to 0.60 in 0.05 steps, `h` / `y0` unscaled; overlap > 0.01 m on both axes; table order. Room set per type and size: square, 3:1 wide, 3:1 deep. Result: no sparse piece dropped, full > sparse in all 90. My note 3 (dining chairs at s 0.85) holds without a change. **Still due:** the figures go into `outcome.md` (ruling 3). |
| 4 siteColors keys; `ground` = summer ground | `look3d.js`; unit | Met (exact key list; equality test). |
| 5 Season blend day-weighted, `groundBounce` 0.25, night checks for all four seasons | `sky.js`; unit "sky keys" (15-line reference blend) | Met. `groundBounce` is in the key-list test. All four seasons: E_top noon ≥ 5 × every night key, night background L* ≤ 15 (actual ≤ 11.5), presets noon > evening > night. |
| 6 Height cap 1.1 m | unit `y0 + h <= 1.1` | Met (tallest: wardrobe, fridge, pantry, shelves at 1.1). |
| 8 Q19 `:has()` scoped by name | `43-stage-interior.css` | Met: `input[name="q-interior-style"][value="classic"]:checked`. e2e checks the recolour end to end after choosing Classic. |
| 9 Q10 swatches: wall / trim unchanged, third stripe flex, one direct input per label | `41-stage-questions.css`, `index.html` | Met. wall / trim hex identical to the old placeholders. `flex: 2 1 0 / 1 1 0 / 1 1 0` on all three `<i>`. Labels keep `label > input` (questions, r5 and plans-edit select by it and pass). |
| Non-blocking 1 (fold (a) into (b), computed fill) | `interior.spec` | Done: each chip's computed `fill` equals `PC.data.interiors` at 360x640 and 1280x800, proving `var()` resolves. |
| Non-blocking 2 (bathroom mat ≥ 0.05, towel) | `furniture.js` | Done: mat h 0.05, towel replaced by a 0.45 m basket; maid rug h 0.05; unit asserts h ≥ 0.05. |

Acceptance criteria:
- **F3-S4 hint:** each Q18 card shows a five-chip strip (fabric, wood, accent, metal, dark) over a top-down living room in that style's colours. Q19 shows 2 against 6 pieces, equal to `PC.data.furniture.living` sparse / full (e2e asserts the counts against the table). PM round-7 texts are in place, one line at 360 px (e2e). Screenshots confirm that the three styles read differently at a glance (dark / cream / pale). At 640x360 and 768 the descriptions wrap to two lines, which is allowed (the one-line rule is for 360 px).
- **F4-S1 data preconditions:** Q10 has 4 exteriors with every A-10 role. Q18 is colours only: `interiors` holds colour keys plus `floorMix`, and no geometry depends on style. Q19: `sparse` is a strict subset, and the simulation shows full > sparse in every room. A fixed block set exists for all 10 types: ≥ 1 sparse, ≥ 2 full-only, ≤ 8 pieces, matching the F4-S1 examples (bed, counter, sofa, table, floor seating, desk, fixtures, shelves, machines).
- **F4-S3 data preconditions:** spring and summer green, autumn canopy ΔE 66.9 from summer, winter `canopyVisible: false` with snow shrub and ground (L* 94.9). Night hemiI 0.30 ≥ 0.25, and the moon `sunI` 0.15 ≤ 0.25 × 0.70.
- **Lint:** the data files are single IIFEs of literals. `data-literals-only` passes. They are in the manifest data layer after `room-labels.js` (unit-tested order). `contract.spec` stays green with `hooks.json` / `values.json` untouched, as the plan claimed.

### 2. FS — QA F3-T2 obs 5 (`core/plans.js` `moveRect`)
- The change is exactly the one I ruled: `s0` is the other axis's clamped position, `Math.min(ctx.D - r.h, Math.max(0, start.y + dy))` (and the x twin). `r.w` / `r.h` are the start sizes, so this is correct for a move. Nothing else in `plans.js` changed. A move inside the footprint gives clamped = raw, so it behaves as before.
- Unit case: room A dragged 9 m back; neighbour B overlaps only the clamped span. A lands at y 6 with its right edge on B, in both the m and ft grids. I reverted the line myself and the case fails (10/1).
- QA's `f3-t2-edit` "span at the finger" note dropped from 76 to 0 (FS note `fs-obs5.md`). QA re-confirms it in 3e.

### 3. QA — A-16 trim of FS / Designer-owned e2e specs
- **plot.spec `borderLabels` and `noFlip` deleted.** I compared them with `f1-t3-plot.mjs`:
  - L runs the same four viewports in m **and** ft: first edge from the origin while drawing, every edge open and closed, the area label, label count, the plot pushed into the top-right and bottom-left corners so edges run off the canvas (only edges with a visible stretch must keep labels), and clear of the chip and Fit view. It adds a corner triangle at 360x640.
  - O runs the same three viewports (`MAIN` = 360, 768, 1280). It drags the apex through the base, throws it across in one move and drags a base corner through. It checks the refusal message and the valid CCW state, and `end()` reloads and requires an exact resume.
  - What is not carried over: borderLabels' keyboard-zoom variant and its clockwise-drawn triangle along the left border. The pan-into-corner checks cover the "edge runs off the canvas" behaviour, and QA's m1 / m2 mutations were caught by the survivors. Accepted.
- **Viewport loops.** Every function still runs at one viewport or more, and each removed viewport names a QA twin that runs the same input at that viewport. questions keeps `round2` everywhere, edges keeps `scaleAndLabels` everywhere, plans-view keeps the fit formula at 360, plans-edit keeps 360 touch plus `keyboard` / `tiers` at 1280.
- One stale pointer: the `rooms.spec.mjs` trim comment names "f3-t2-editor 9" as an R5 twin, and that section was removed in the same trim. The live twin is `r5.spec` `rooms()` at 360x640 + 1280x800, which `qa-trim.md` itself names. It is a comment only, so non-blocking note 1.
- Nothing that guards behaviour was lost: each behaviour keeps each viewport in one of the two suites, and QA's four mutations, each aimed at a removed duplicate, were caught by the surviving checks. **Trim accepted.**

**Ruling on `--jobs` (QA note):** the default stays **2**. Reasons:
- the full run is 442–447 s, under the 8-minute target, so no speed-up is needed now;
- the suites are touch- and timing-heavy; the only full-run failure of the last batch was a timing flake (`edges.spec`, F3-T2) at 2 jobs, and 4 Chrome instances on 4 CPUs share those CPUs with the browsers' own GPU and renderer processes;
- comparable timings across batches matter more than a minute.

`--jobs 3` stays available for anyone's inner loop. If the full run passes 8 minutes again, the first step is two consecutive green full runs at `--jobs 3` with their times, and the TL changes the default after that. The runner's comment "(default 2: the machine has 2 cores)" is out of date. FS changes it to "(default 2; kept at 2 on a 4-CPU machine for timing stability, TL F3-T3)" the next time `run-all.mjs` is opened (non-blocking note 2).

### Required changes
None.

### Non-blocking notes
1. **QA:** in `tests/e2e/rooms.spec.mjs`, change the trim comment's R5 twin from "f3-t2-editor 9" to "`r5.spec` rooms() at 360x640, 1280x800" during the 3e round. Comment only.
2. **FS:** update the `--jobs` comment in `tests/run-all.mjs` as above, whenever the file is next opened.
3. **Designer, outcome.md** (due at 3f, not at this review). It needs:
   - the check-colours figures (ruling 3);
   - the 3D art-direction note in the A-10 wording (block or floor quad = `roomTints`, enclosure walls = `wallInner`);
   - the list of sparse pieces that scale below 1.0. The maid bed reaches s 0.60 in the 4 × 1.5 m S room, because the A-11 rule never rotates an anchored piece. That is legitimate, but F4 will show a short bed there. Record it as a known limit, not a change.
4. **Cosmetic, F5-T3 list:** at 640x360 and above, the stage-4 card name and radio sit right-aligned under the hint while the description is left-aligned (F3-T2 card grid). This was not introduced here.
5. The unit "sparse set fits the S room" check is a coarse proxy (largest side ≤ √S − 0.3, area ≤ 40 %). The real guarantee is the verify simulation, which is not in `run-all`. F4-T2's `furnish` containment test (A-9) will hold the exact rule in the suite. No action now.

### QA focus for step 3e
1. `data-tables.test.mjs` is the schema test "written with QA": review it against F3-plan "QA should test". Add an independent oracle of your own for the A-13 blend (night background L*, noon/night ratio, all four seasons) and for the A-10 floor mix. Do not reuse the Designer's helpers.
2. Write your own A-11 placement simulation from the architecture text, not from `check-colours.mjs`, over a wider room set: random W × D from the S–L areas, aspect 1:1 to 3:1, both units' grids. Confirm every sparse piece is placed and full > sparse. Report every sparse piece placed below s 0.75.
3. CSS = tables: mutate one hex in each of `look3d.js` (exteriors wall / trim / roof, interiors) and confirm the unit test catches each. Also confirm the Q19 vignettes follow Minimal as well as Classic (the e2e only switches to Classic).
4. Stage 4 at all five viewports (360x640, 360x740, 640x360, 768x1024, 1280x800): Q18 texts are the PM round-7 strings exactly and on one line at 360 px; hints sit inside the cards; tap targets ≥ 44 px; no page scroll; the chosen card stays in view. Check the hints by eye at 640x360, the 64 px case.
5. Q10 swatches at stage 2, four viewports: three stripes 2 : 1 : 1, the colours equal `PC.data.exteriors` wall / trim / roof, and selecting each card still works by touch and mouse (`label > input` selectors).
6. Obs 5: rerun `f3-t2-edit`. The "span at the finger" note must be 0 and check 1 must still pass.
7. Your trim: fix the `rooms.spec` comment (note 1). Then the mandatory full run `node build.mjs && node tests/run-all.mjs` with its time. Target ≤ 8 min at `--jobs 2`.

VERDICT: APPROVED
