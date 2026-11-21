# F3-T3 QA report — QA Tester

## Round 1 — 2026-11-21

Scope: F3-T3, the 3D look / furniture / sky tables, the stage-4 hints and the Q10 swatches (Designer), plus the FS obs-5 fix and my own A-16 trim follow-up. I tested against:
- the TL's 7-item "QA focus for step 3e" list (`impl-review.md`, round 1);
- F3-plan.md F3-T3 "QA should test" and its acceptance criteria (F3-S4 hint; F4-S1 / F4-S3 data preconditions);
- A-10 (look tables, the one sRGB mix rule), A-11 (placement rule), A-13 (key-frame interpolation + day-weighted season blend), A-16;
- PM round 7 (Q18 card texts, one line at 360 px).

My expectations are my own: `tests/qa/f3-t3-ref.mjs` imports no app code and none of the Designer's helpers (`data-tables.test.mjs`, `verify/check-colours.mjs`). It loads the three data files (and `palette2d.js` for the 2D tints) in a bare context and implements, from the architecture text: the A-10 mix, CIELAB, the A-13 key interpolation, season blend, sun-path elevation and a Lambert top-face light sum, and the A-11 placement rule (inset, orientation, anchors, the turned centre offset, scale search 1.00 → 0.60, inside 1e-9, overlap > 0.01 m on both axes).

### What I tested and how

**`tests/qa/f3-t3-data.mjs`** (node, under 0.2 s), 16 checks:
1. **Schema** from the architecture lists (not `PC.C`): 4 exteriors × the six A-10 roles; 3 interiors × fabric..dark + `floorMix` in [0, 0.3]; `roomTints` = 10 types + hall, stair, lift; the 12 `siteColors` keys, `ground` = summer ground; furniture per type 1+ sparse, 2+ full-only, ≤ 8, A-11 keys, `sparse` always written, top ≤ 1.1 m, known anchors / colour keys, |off| ≤ 1.2, no `off` on a first piece; sky key lists, h 0 → 24 strictly increasing with last = first, a noon key, four seasons, elevMax 52/72/52/32, `groundBounce` 0.25. All colours `#RRGGBB` upper case.
   **Literals only** (new, my own reader): each data file must be one IIFE of `PC.data.x = <literal>;` statements, and every literal must parse as JSON once quotes / bare keys are converted. See observation 1 for why the lint is not enough.
2. **Floor mix (A-10)**: my floor for every style × (10 types + hall), stair / lift unmixed; each channel within 0.5 of the exact lerp; type floors ΔE ≥ 5.5 in every style (min 6.5 Modern, 6.7 Classic, 7.4 Minimal; bedroom / laundry). 3D tints follow the 2D tints (hue ≤ 3°, L* 5–12 lower). **CSS = tables** with my own CSS reader of the source files: `.pc-hint--modern/classic/minimal` and the three Q19 rules (default, `:has()` Classic, `:has()` Minimal) equal the interiors + my living floor; `.pc-sw-*` equal exteriors wall / trim / roof.
3. **A-13 blend**, every quarter hour of all four seasons (4 × 97 looks):
   - night (21:00–4:30, between the night keys) background L* ≤ 15: max 9.0 / 7.1 / 10.0 / 11.5 (spring / summer / autumn / winter);
   - noon ≥ 5 × every night hour in top-face light: min ratio 7.21 / 7.55 / 6.83 / 6.42;
   - `hemiI` ≥ 0.25 at every hour (min 0.30); presets noon > evening > night;
   - at noon the tint is exactly `tintAmount` and the ground bounce 0.25; summer is untinted;
   - winter midnight L* 11.5 with the day factor, 25.9 without it (the reason for the rule; my blend applies it).
   - F4-S3 seasons: spring / summer canopies green by hue, autumn warm and ΔE ≥ 20 from summer, winter `canopyVisible` false with snow ground / shrubs.
4. **A-11 simulation** over 3 093 judged rooms: 2 × 1 500 random rooms (area uniform S..L per type, aspect uniform 1:1–3:1, either orientation, sides snapped to the 0.5 m or 1 ft grid, ≥ 1.5 m), plus fixed rooms per type and size (square, 3:1 wide and deep, 1.5 m minimum side), plus three bedrooms the generator really makes (below). Checks: every sparse piece placed; full places more pieces than sparse in every room. A hand-worked pose check pins my rule itself (dining 4 × 3 m full; 3 × 4 m with the table and the chair offset turned). A further 1 000 rooms in the generator's 25 % tolerance band (0.75 S..S) are reported, not judged.

**`tests/qa/f3-t3-look.mjs`** (browser, about 7 s), 234 checks. Stage 4 is reached for real: Load sample → Skip to 3D (stage 5, every floor approved) → Back.
- **Stage 4 at 360x640, 360x740, 640x360, 768x1024, 1280x800** (touch, mouse at 1280):
  - defaults Modern / Full;
  - Q18 names and descriptions are the PM round-7 strings exactly; Q19 "Key pieces only" / "Every piece for the room type";
  - at 360 px every description is on one line and not clipped; above 360 px nothing is clipped (wrapping allowed);
  - every hint inside its card, 64 px tall or more;
  - computed fills (so `var()` resolves end to end): Q18 chips, pieces and floor = the tables and **my** floor mix, per style; Q19 shows 2 against 6 pieces (the living table);
  - F1-T1 layout rules before and after the choices: no page scroll, 44 px targets, stepper one line, Back / Next in view, nothing clipped, text fits, no overlapping controls, contrast ≥ 4.5;
  - each of the 5 cards chosen by real tap / click: state, only its radio checked, the card in view, and the stage does not scroll because of the choice;
  - **the Q19 vignettes follow Classic, Minimal and Modern** (pieces and floor), at every viewport.
- **Stage 2, Q10 at 360x640, 640x360, 768x1024, 1280x800**: four cards, three stripes each, 2 : 1 : 1 within 1 px; stripe colours = exteriors wall / trim / roof; each card selected by tap / click (`label > input`): state, one checked radio, no R5 question; the plans stay approved; layout rules.
- Screenshots: `tests/qa/shots/F3-T3/` (stage 4 at all five viewports, Classic and Minimal at 640x360, Q10 at four).

**Runner:** `tests/qa/run-f3-t3.mjs` (exit code, `--no-shots`), picked up by `run-all` as `qa run-f3-t3.mjs`. The two suites together take about 7 s.

**Obs 5:** `node tests/qa/f3-t2-edit.mjs` → 9/0, check 1 passes, the "span at the finger" note is **0** (with the FS line reverted on a copy: 76, as before the fix).

**Trim follow-up (TL note 1):** the `rooms.spec.mjs` trim comment now names "QA J / r5.spec rooms() at 360x640, 1280x800" instead of the removed "f3-t2-editor 9". Comment only.

### Mutation proof
Each on a throwaway copy of the tree (`scratchpad/m-*`, `src/` here untouched). Unit = `tests/unit/data-tables.test.mjs` (focus item 3), data / look = my suites.

| Mutation | Unit | Mine |
|---|---|---|
| exteriors sand `wall` +1 | caught (CSS = tables) | data 2 |
| exteriors white `trim` +1 | caught | data 2 |
| exteriors grey `roof` −1 | caught | data 2 |
| interiors classic `accent` +1 | caught | data 2 |
| interiors minimal `wood` +1 (also moves `--h-floor`) | caught | data 2 |
| interiors minimal `fabric` −1 | caught | data 2 |
| interiors modern `metal` −1 | caught | data 2 |
| interiors classic `dark` +1 | caught | data 2 |
| interiors modern `white` +1 | not caught | not caught (no CSS twin; nothing shows it before F4) |
| exteriors sand `wallInner` +1 | not caught | not caught (same) |
| Q19 Minimal `:has()` rule disabled | caught | data 2, look 2 (3 checks) |
| Q10 wall stripe `flex: 2` → 1.6 | not caught | look 3 (3 viewports) |
| Q18 Minimal text back to "White, pale grey, light oak" | not caught | look 1 |
| phone hint column 100 → 120 px | — | look 1 (360 px one line) |
| floor fill rule → `var(--h-wood)` | not caught | look 1 (15 checks) |
| grey Q10 label not hittable (`pointer-events: none`) | — | look 4 (touch and mouse) |
| winter `tintAmount` 0.20 → 0.60 | caught | data 3 |
| night key 21 `hemiI` 0.30 → 0.22 | caught | data 3 |
| autumn canopy → green | caught | data 3 |
| majlis `lowTable` 2.8 × 1.2 m | not caught | data 4 |
| dining `chairB` offset 0.75 → 0.5 (into the table) | not caught | data 4 (2 checks) |
| `sky.js` `groundBounce: Math.min(0.25, 1)` | lint: **not caught** | data 1 (literals) |
| obs-5 line reverted (`core/plans.js`) | `plans-edit.test` (TL) | f3-t2-edit note 0 → 76 |

The interiors `white` and exteriors `wallInner` / `slab` / `parapet` values have no stage-2 / stage-4 twin, so no CSS test can see them; their format and key lists are checked. That is by design (the F4 mock tests will read them).

### Results per focus item
1. **Schema test reviewed + own oracle: met.** `data-tables.test.mjs` covers every "QA should test" unit line except one: its "sparse set fits the S room" is a coarse proxy (largest side, 40 % area), and it misses placement errors (the lowTable and chairB mutations above). My A-11 simulation is now in the suite, so the exact rule runs in `run-all` before F4-T2's `furnish` test exists. My own A-10 mix and A-13 blend agree with every table value and CSS property.
2. **Own A-11 simulation: met within S–L, with one minor bug.** Every sparse piece is placed in all 3 000 random S–L rooms and in the fixed square / 3:1 / 1.5 m rooms; full > sparse in every room. Exception: bug 1 (bedroom wardrobe in narrow deep bedrooms, KNOWN). **Sparse pieces placed below s 0.75** (S–L set):
   - `maid.bed`: 13 rooms, down to s 0.60 (3.5 × 1.5 m and other 1.5 m-wide maid rooms: an anchored piece never turns; the Designer's known limit);
   - `bedroom.wardrobe`: 4 rooms, down to s 0.60 (2.5 × 5.0 m: placed at s 0.60 only because an overlap of exactly 0.01 m is allowed, see observation 2);
   - `living.coffeeTable`: 1 room, s 0.70 (7.5 × 2.5 m);
   - `majlis.lowTable`: 1 room, s 0.70 (the 3:1 S majlis, 6.93 × 2.31 m).
   Full-set pieces reach s 0.60 in narrow rooms too (side tables, shelves, rack…), which A-11 allows.
   Tolerance band (0.75 S..S, not judged): sparse drops for bedroom.wardrobe 20×, dining chairs in 1.83 m-wide 9 m² rooms 9×, office chair in 1.5 m-wide offices 7×, majlis lowTable 5×, living coffeeTable 3×, maid cupboard 1×. Apart from the wardrobe, these are rooms too narrow for the piece (a table with chairs on both sides in 1.83 m), where A-11's "drop" is the intended result.
3. **CSS = tables: met.** One hex mutated in each of exteriors wall / trim / roof and in every shown interiors key; the unit test catches each one. The Q19 vignettes follow **Minimal** as well as Classic (computed fills at all five viewports, and my CSS reader checks the Minimal `:has()` rule).
4. **Stage 4 at five viewports: met.** PM round-7 texts exactly, one line at 360 px (360x640 and 360x740), hints inside the cards, 44 px targets, no page scroll, the chosen card stays in view without a scroll jump, by touch and by mouse. By eye at 640x360 (the 64 px hint): the five chips and the three styles read clearly differently (dark / cream / pale); the furniture blocks are small but distinct. The cards' name and radio sit right-aligned under the hint while the description is left-aligned (TL note 4, F5-T3 list).
5. **Q10 swatches: met.** 2 : 1 : 1 within 1 px at four viewports, colours = exteriors wall / trim / roof, each card selectable by touch and mouse, no R5 question, plans kept.
6. **Obs 5: met.** `f3-t2-edit` 9/0, check 1 passes, "span at the finger" note 0.
7. **Trim comment fixed; full run:** see below.

### Bugs
1. **Minor (Designer, `src/js/data/furniture.js`): the bedroom wardrobe is dropped in sparse in narrow deep bedrooms** (KNOWN in `f3-t3-data.mjs`).
   - **What happens:** the wardrobe is anchored `left`, centred along the left wall. In a bedroom 2–2.5 m wide and 3.75–5 m deep, the 2.0 m bed at the back wall covers the middle of that wall, and even at s 0.60 the wardrobe overlaps the bed's foot. So A-11 drops it, and the sparse bedroom is a bed alone. In full the wardrobe is dropped as well; full still shows more pieces than sparse.
   - **Rooms:** 2.5 × 4.0 m and 2.5 × 4.5 m (m), 8 × 16 ft = 2.44 × 4.88 m (ft). These are S bedrooms that are 6–17 % under 12 m², inside the generator's 25 % tolerance.
   - **How common:** in a probe of 2 934 layouts from the real F3-T1 generator (19 948 rooms), these bedrooms were the **only** sparse drops of any type (6 rooms). In the tolerance band, 20 of 100 random bedrooms. In the 3 000 S–L rooms, none (the 2.5 × 5.0 m room survives by exactly 0.01 m).
   - **Effect:** none yet; F4-T2 is the first to place furniture. Then a few sparse bedrooms show no wardrobe. It also breaks the "no sparse piece dropped" goal of TL ruling 3 for rooms the generator produces.
   - **Fix (data only, Designer's choice):** anchor the wardrobe in a front corner. I probed this on copies. With `fl` (or `fr`) there are 0 sparse drops in all 3 093 judged rooms and in the tolerance band, and the wardrobe never goes below s 0.75. `front` is worse: it drops the wardrobe in 2–2.5 m-deep wide bedrooms (40 band drops). Once the fix is in, the KNOWN lines in my suite disappear and I remove the entry.

### Observations (correct by the plan; for TL / FS / Designer)
1. **The `data-literals-only` lint does not enforce "literals only"** (FS / TL, `tests/lint-constraints.mjs`). Its regex forbids only arrow functions and a second `function`, so `groundBounce: Math.min(0.25, 1)` (or `Date.now()`, or any identifier) passes the lint. Today's files are pure literals (my new check 1 proves it and catches the mutation). Either the rule is tightened, or my check stays as the guard.
2. **A-11's "overlap > 0.01 m" sits on a floating-point edge** (FS for F4-T2, TL for the A-11 wording). In the 2.5 × 5.0 m bedroom, the wardrobe at s 0.60 overlaps the bed by exactly 0.01 m (2.86 − 2.85). In doubles that difference is 0.010000000000000231, so a literal `> 0.01` drops the wardrobe. With a naive comparison, my simulation finds extra drops in 2.0 × 5.0, 2.25 × 5.0 and 2.5 × 5.0 m bedrooms. I use `> 0.01 + 1e-9`, as A-11 already does for "inside (1e-9)". `furnish` should do the same, and A-11 could say so.
3. **Twilight is lighter than night** (Designer, informational). Between the dusk key (19.5) and the first night key (21), the background interpolates up to L* 15.4–19.1 at 20:15. That is by design (dusk), but anyone judging "night" as "h > 20" will see L* above the 15 I use for night. The presets (22) and night keys are all ≤ 11.5.
4. **Stage 4 at 640x360** shows the vignettes at 64 px. The chips read well; the furniture blocks are 3–4 px, enough to see "more vs fewer" but not to recognise the pieces. Acceptable for a hint.
5. **The sample strip ("Sample project loaded · Skip to 3D") stays on stage 4** after every floor is approved. Skip then goes to stage 5, as it does from any stage. Not new, not F3-T3.

### Full run
`node build.mjs && node tests/run-all.mjs` (default `--jobs 2`), on the tree with all F3-T3 work and my new suite: **exit 0, run-all 462.3 s** (7 min 42 s wall clock including the build). This is under the 8-minute A-16 target, +20 s over the 442 s trim run (Designer interior.spec extension + my F3-T3 suites, about 7 s).
- Lint 0 violations. Unit and every e2e spec are green, among them interior 77, plans-edit 65, r5 54, rooms 221 and questions 432.
- QA suites, all 0 failed:

  | Suite | Checks |
  |---|---|
  | F1-T1 | 191 + 2015 |
  | F1-T2 | 654 |
  | F2-T1 | 1143 |
  | F1-T3 | 822 |
  | F2-T2 | 959 |
  | F2-T3 | 1136 |
  | F3-T1 | 13 + 205 |
  | F3-T2 | 9 + 182 |
  | **F3-T3 (new)** | **16 + 234** |

  F3-T3 data reports bug 1 as KNOWN (3 rooms).

### Verdict
All 7 focus items and the F3-plan acceptance criteria are met: F3-S4 hint, and the F4-S1 / F4-S3 data preconditions. One minor bug is open, bug 1 (Designer, bedroom wardrobe anchor, KNOWN). It has no effect until F4-T2 and should be fixed before F4-T2 consumes the table. Observation 1 (the lint gap, FS / TL) and observation 2 (the overlap epsilon for `furnish`, FS F4-T2 / TL A-11) are routed for action. Neither blocks F3-T3.

VERDICT: PASSED
