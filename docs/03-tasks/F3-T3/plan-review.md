# F3-T3 plan review — Tech Lead

## Round 1 — 2026-11-21

### What I read and checked
- `plan.md` against F3-plan § F3-T3 (scope, riders, "QA should test"), A-2, A-9, A-10, A-11, A-13, A-15, A-16, F4-plan (what F4-T1..T3 read), F3-S4 / F4-S1 / F4-S3, client decisions (none touch this task) and the F3-T2 outcome review.
- Code the plan refers to:
  - `src/index.html` stage 4: the Q18 / Q19 hints are today presentation-attribute fills (`#E8E6E0` …) and neutral `#C5CBD0` blocks; Q10 swatches have two `<i>`;
  - `src/css/43-stage-interior.css`: 21 lines, hint 112 px column / 96 px from 600 px / 64 px in short landscape;
  - `src/css/41-stage-questions.css` lines 81–84: the placeholder exterior swatches; `30-components.css` `.pc-swatch > i { flex: 1 }`;
  - `src/js/data/palette2d.js` (room tints, hall / stair / lift, selection `#C2410C`);
  - `src/js/core/const.js` (`ROOM_TYPES`, `ROOM_SIZE`, `ENUM`); `src/manifest.json` (data layer after core);
  - `tests/lint-constraints.mjs` `data-literals-only`; `build.mjs`, `tests/helpers/load.mjs` (no basename keying, so `core/sky.js` and `data/sky.js` coexist);
  - `tests/e2e/interior.spec.mjs` (46 lines, one loop over five viewports); `tests/contract/*.json` (no hint or swatch entries; stay unchanged);
  - tests that select Q10 / Q18 labels (`label:has(> input[value=…])` in `plans-edit.spec`, `r5.spec`, `questions.spec`, QA `f3-t2-editor`): the new markup must keep one input as the label's direct child;
  - `src/js/core/plans.js` `moveRect` and QA's `tests/qa/f3-t2-ref.mjs` `myMove` / `f3-t2-edit.mjs` (obs 5).
- Own script (scratchpad, not committed), same formulas as the plan:
  - the 3D room tints: L* −7.8 to −8.1, hue within 1.12°, chroma × 1.57–1.62, as claimed;
  - after `floorMix`, the closest type pair is bedroom / laundry, ΔE 6.5 / 6.7 / 7.4 (modern / classic / minimal); storage / hall 5.7–6.0. As claimed;
  - precomputed `--h-floor` = #B4C895 / #B5C28F / #C0D29C, as in §4;
  - the S-fit rule holds for all 10 sparse sets;
  - the dining sparse set in the narrowest S room (2 × 6 m) under the A-11 scale steps: chairs place at s = 0.85 (0.004 m overlap, within the 0.01 m tolerance). It works, with no margin (see note 3);
  - season tint on the night key: winter background L* 7 → 26, autumn 7 → 20 with the proposed blend. This is the reason for ruling 5.

### Assessment
The plan covers every F3-T3 item, and the numbers I re-ran are right:
- the four tables, with exact key lists;
- all 10 furniture types, each with ≥ 1 sparse and ≥ 2 full-only pieces, 8 at most, S-fit;
- the sky keys meet A-13 (night hemiI 0.30 ≥ 0.25, sunI 0.15 ≤ 0.175; presets noon > evening > night);
- the seasons meet F4-S3 (green / autumn / bare + snow);
- the stage-4 hints are tied to the tables by CSS custom properties and tested (unit static parse + e2e computed values);
- the Q10 swatches are brought in line;
- the art-direction note for F4.

The no-JS approach (`:has()` instead of touching `stage-interior.js`, no new hooks) is the right size for a Designer task. Runtime: unit < 0.5 s, e2e about +2 s on two viewports, within the ≤ 8 min target that QA's trim sets.

Only one point is a correctness issue: the season blend, ruling 5. It needs a small data and test addition, not a plan rewrite. I approve the plan with the rulings below binding at implementation; they are checked at the implementation review.

### Rulings on the open questions (§8)
1. **`floorMix`: accepted as proposed.**
   - A number in [0, 0.3]. Room floor and hall = per-channel sRGB lerp `mix(roomTints[type], interiors[style].wood, floorMix)`, `Math.round` per channel, before `PC.three.col`.
   - Stair and lift are not mixed. This fits F4-S1 "Q18 changes colours/finishes only".
   - This lerp is now the single colour-mix rule of the app (A-10 look tables; A-13 uses the same). F4-T1 `build-shell` implements it; the Designer's test and CSS precompute use the same formula.
2. **`roomTints` extra keys `hall`, `stair`, `lift`: accepted.** One table for every floor-level tint F4-T1 needs.
   - The hue / L* "matching" test (§5.3) applies to the 10 types only.
   - Distinctness ≥ 5.5 applies to type pairs. Hall is included in the distinctness report but not asserted (storage / hall 5.7–6.0 is fine either way).
   - Written into A-10.
3. **Optional `off` and the orientation convention: accepted, made precise in A-11** (placement rule, steps 1–5). What I fixed beyond §2:
   - `center` with `W >= D` (ties included) puts `w` along x, otherwise along y. The offset turns with the piece: `(a, b)` → `(+y, −x)` when `w` is along y.
   - For every other anchor the offset is in room axes: `a` = +x (right), `b` = +y (back), as your maid chair and laundry dryer assume.
   - Edge anchors are centred along their wall.
   - Scale search `s` = 1.00 → 0.60 in 0.05 steps. The offset scales with the piece's own `s`; `h` and `y0` never scale.
   - Overlap means > 0.01 m on both axes. Pieces are taken in table order, and an `off` piece is listed after the piece it surrounds.
   - **Binding at implementation:** `verify/check-colours.mjs` reruns the 90-room simulation with exactly this rule and reports it in `outcome.md`. Required: every sparse piece is placed in every room, and full > sparse everywhere. The F4-T2 FS implements the same rule. The fallback of §2 is not needed.
4. **`siteColors` key names: accepted** (`ground, groundOuter, paving, poolWater, poolRim, boundaryWall, gate, carCanopy, seating, trunk, northMarker, highlight`).
   - `groundOuter` stays fixed (not seasonal). The plot ground carries the wintry read, which meets F4-S3 "ground also reads as wintry".
   - `ground` duplicates summer's ground on purpose: F4-T1 / T2 build before `applyLook` exists (F4-T3). The equality test (§5.4) keeps the two from drifting.
   - Gate posts use `exteriors.trim`. `siteColors.gate` is for a gate leaf if F4-T2 draws one; if it draws none, the key stays unused. Written into A-10.
5. **Season blending: proposal accepted with one change (correctness).**
   - As proposed, the tint lerp applies at every hour. A winter night background goes from L* 7 to about 26 and an autumn one to about 20, and the moon colour turns orange in autumn. That works against F4-S3 "night is clearly dark".
   - Ruling (A-13): the blend weight is scaled by daylight, `day = min(1, K.sunI / noonKey.sunI)`. So:
     - `sunColor`, `hemiSky`, `background` = `mix(K.x, tint, tintAmount × day)`;
     - `hemiGround` = `mix(K.hemiGround, season.ground, groundBounce × day)`;
     - intensities are the key values unchanged;
     - `canopy` / `canopyVisible` / `shrub` / `ground` are taken as they are;
     - interpolation and blend are both sRGB lerps;
     - `compute` returns hex strings.
   - It is continuous, because `sunI` is interpolated. At night the weight is about 0.21 × tintAmount, which keeps winter night L* ≈ 11–12.
   - **Binding at implementation:**
     - (a) add `PC.data.sky.groundBounce: 0.25` (a data value, so a retune stays data-only, as your §9 promises). The §5 key-list test includes it;
     - (b) §5.6 evaluates its night checks after a 15-line reference blend for **all four seasons**: the E_top ratio ≥ 5 and night `background` L* ≤ 15. F4-T3's `sky.test` then checks `PC.sky.compute` against the same A-13 text.
6. **Height cap `y0 + h ≤ 1.1 m`: accepted.** Written into A-11. Real-height wardrobes would hide the floor read the dollhouse depends on.
7. **Q18 descriptions: for the PM** (below). The Designer may implement the proposed texts; a PM change later is a text-only edit.
8. **Q19 vignettes follow the chosen Q18 style through `:has()`: accepted.**
   - The fallback to Modern colours is still a correct hint. The headless Chrome used by the suite supports `:has()`.
   - Scope the selector by name: `input[name="q-interior-style"][value="classic"]:checked`, not only `[value=…]`.
   - CSS keyed on `:checked` matches A-15 (state lives in native attributes).
9. **Q10 swatch change in stage 2: accepted, in scope.** F1-T1's outcome assigned the placeholder swatches to F3-T3. I added stage-2 swatch markup, `41-stage-questions.css` and `interior.spec.mjs` to the F3-T3 file list in F3-plan.
   - Keep `wall` / `trim` hex identical to today (they are), and keep each Q10 label with its single direct `input` child (tests select `label:has(> input[value=…])`).
   - The 2 : 1 : 1 stripes need a `flex` override on the third `<i>` (or all three) in `41-stage-questions.css`, because `.pc-swatch > i { flex: 1 }` lives in `30-components.css`.
10. **Carried FS item (QA F3-T2 obs 5): option (b).** The FS makes the fix now, alongside F3-T3. Reasons:
    - none of F4's tasks lists `core/plans.js` (F4-T1 reads plans through `PC.house`), so "next time it is opened" might never come, and the item would stay a known limit for good;
    - the FS is otherwise idle during this Designer task;
    - QA's oracle `myMove(…, 'room')` already encodes the corrected behaviour, so no QA test changes.

    The change, in `moveRect`, is the span `s0`. It is taken from the other axis's **clamped** position: `p === 'x' ? clamp(start.y + dy, 0, ctx.D - r.h) : clamp(start.x + dx, 0, ctx.W - r.w)`. Plus:
    - one unit case in `tests/unit/plans-edit.test.mjs`: a move past the footprint where the finger span misses a neighbour but the clamped room's span overlaps it, so the edge now snaps to the neighbour;
    - one mutation check (revert → the case fails).

    Inside-the-footprint moves are unchanged (clamped = raw). It is reviewed in my F3-T3 implementation review. QA confirms it with its existing `f3-t2-edit` run (the "span at the finger" note drops to 0 and check 1 still passes). Recorded in F3-plan.

### For the PM
- **Q18 card descriptions (plan Q7).** I recommend accepting:
  - Modern "Graphite, dark wood, copper";
  - Classic "Cream fabric, walnut, brass";
  - Minimal unchanged "White, pale grey, light oak".

  Today's Classic text says "Cream walls", which is wrong: walls follow Q10 (F4-S1: Q18 is a palette swap of furniture and floor finish only). The new texts name exactly the colours shown in the swatch strip. The Designer checks they stay on one line at 360 px.

### For QA
- `tests/qa/` and `tests/e2e/` are yours during the trim. The Designer extends `interior.spec.mjs` only **after** your trim has landed, on top of your version. If your trim moves checks out of `interior.spec`, tell the Designer which ones.
- `tests/unit/data-tables.test.mjs` is new and written with you. Review it in your QA round rather than now.
- The obs-5 fix: no change to your files. Expect the `f3-t2-edit` note "moves past the footprint … span at the finger" to report 0.

### Required changes
None to the plan document. Rulings 3 (simulation under the A-11 rule), 5 (`groundBounce`, day-weighted blend, all-season night checks), 8 (selector scoped by name) and 9 (third-stripe flex) are binding at implementation and checked at the implementation review.

### Non-blocking notes
1. **e2e (a) and (d) duplicate unit §5.8.** Both compare custom properties to the tables, and QA is trimming duplicates. Prefer to fold (a) into (b), with each chip's computed `fill` equal to the table value: that proves `var()` resolves end to end, which the static parse cannot. Drop (d) unless it costs nothing. Computed custom-property strings may keep their whitespace and case, so trim and upper-case them before comparing.
2. **Bathroom pieces.** The `mat` (h 0.02) sits only 5 mm above the 0.015 m tint quad and hardly reads as a block. Use h ≥ 0.05 for every piece. The 1.1 m `towel` slab (0.12 deep) will read as a wall stub from above; a lower towel rail (≤ 0.9 m) or a laundry-style `basket` reads better. Your call.
3. **The dining sparse set** fits the 2 × 6 m S room only at s = 0.85, with 0.004 m to spare. If the simulation under the A-11 rule drops chairB / chairF anywhere, change `off` b to 0.72 or the chair `d` to 0.42 rather than the algorithm.
4. **Stair and lift.** The plan lists `wallInner` for "the inside of stair and lift walls" and `roomTints.stair/lift` for the blocks. I wrote A-10 as: the block or floor quad takes `roomTints`, and any enclosure walls take `wallInner`. Keep the art-direction note in the same words.
5. **§0 table.** `stage-interior.js` untouched and contracts unchanged: confirmed by reading. The plan claims no hook changes, so `contract.spec` must stay green without edits to `hooks.json` / `values.json`.
6. **Focused runs for the task:**
   - `node tests/run-all.mjs --unit` (data tables + the FS's plans-edit case);
   - `--e2e --only interior,contract,questions,plans-edit,r5` (the last two select Q10 / Q18 labels).

   Then one full run with its time.

VERDICT: APPROVED
