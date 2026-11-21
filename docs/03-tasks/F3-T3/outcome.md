# F3-T3: 3D look tables, furniture tables, sky/season tables and stage-4 hints (outcome)

Owner: Designer. Status:
- **PASSED QA** (`qa-report.md`, round 1: QA F3-T3 data 16 + look 234 checks, all 7 focus items met). Bug 1 (wardrobe anchor) is fixed and is listed in §6.
- TL implementation review **APPROVED** (`impl-review.md`).
- FS carried item (QA F3-T2 obs 5, `moveRect`) is in `fs-obs5.md`, reviewed in the same impl review and confirmed by QA.

Sources:
- `plan.md` and `plan-review.md` (TL rulings 1–10);
- architecture A-10 (look tables, the one mix rule), A-11 (schema + placement rule), A-13 (season blend);
- PM round 7 (Q18 texts);
- `qa-trim.md` (QA A-16 trim, landed before this task's spec work).

## 1. What was built

### Data tables (data layer, literals only, after `room-labels.js` in the manifest)
- **`PC.data.exteriors`** (Q10): sand, white, terracotta and grey, each with `wall, wallInner, slab, roof, trim, parapet`. `wall` and `trim` are the F1 swatch colours, unchanged.
- **`PC.data.interiors`** (Q18): modern, classic and minimal, each with `fabric, wood, accent, white, metal, dark, floorMix`. `floorMix` is 0.10 / 0.15 / 0.10.
- **`PC.data.roomTints`**: the 10 types plus `hall`, `stair` and `lift`. Each type's 3D tint is its 2D tint at the same CIELAB hue, L* 8 lower and chroma × 1.6.
- **`PC.data.siteColors`**: the 12 keys of A-10. `ground` equals `sky.seasons.summer.ground`.
- **`PC.data.furniture`**, 10 types, A-11 schema:

  | Type | Pieces | Sparse |
  |---|---|---|
  | bedroom | 6 | 2 |
  | bathroom | 6 | 3 |
  | kitchen | 7 | 2 |
  | living | 6 | 2 |
  | dining | 6 | 3 |
  | majlis | 6 | 2 |
  | office | 5 | 2 |
  | maid | 5 | 2 |
  | storage | 4 | 1 |
  | laundry | 4 | 2 |

  - Offsets (`off`): kitchen stools, dining chairs, office chair, maid chair and laundry dryer.
  - Every piece has 0.05 m ≤ h and y0 + h ≤ 1.1 m.
- **`PC.data.sky`**:
  - `keys`: 11 key-frames from h 0 to 24 (night, dawn 6, morning 7.5, noon 12, afternoon 16, golden 17, dusk 18, twilight 19.5, night);
  - `seasons`: spring, summer, autumn and winter; winter has `canopyVisible: false` and snow on the shrubs and ground;
  - `groundBounce: 0.25` (TL ruling 5).

### Stage 4 (Q18 / Q19) and stage 2 (Q10) visuals
- **Q18 cards:** a chip strip (fabric, wood, accent, metal, dark, each with an ink border) over a top-down living room, 6.4 × 4.7 m, full set.
  - The pieces sit at the positions the A-11 simulation gives.
  - Each piece is a top rect plus a front strip under a 25 % ink overlay, so it reads as a block.
- **Q19 cards:** the same room, 2 pieces against 6 (`data-pieces`), equal to the living table.
  - The vignettes take the chosen Q18 style through `.pc-interior:has(input[name="q-interior-style"][value=…]:checked)`.
  - Where `:has()` is unsupported they stay Modern.
- **Colours:** every fill comes from `--h-*` custom properties with the same hex as the tables. `--h-floor` = `mix(roomTints.living, wood, floorMix)`.
- **Phone layout:** the card hint column is 100 px (was 112) with an 8 px gap (was 12). This puts every Q18 / Q19 description on one line at 360 px (PM round 7).
- **Q18 texts (PM round 7):**
  - Modern "Graphite, dark wood, copper";
  - Classic "Cream fabric, walnut, brass";
  - Minimal "Pale grey, light oak, sage".
- **Q10 swatches:** three stripes, wall 2 : trim 1 : roof 1, from `--x-wall/trim/roof` on `.pc-sw-<ext>`. A flex override is used because `.pc-swatch > i { flex: 1 }` lives in `30-components.css`.
- **Unchanged:** no JS, hook, contract or state change (`hooks.json` / `values.json` untouched).

## 2. Files
| File | Change |
|---|---|
| `src/js/data/look3d.js` | new: exteriors, interiors, roomTints, siteColors |
| `src/js/data/furniture.js` | new: furniture tables (wardrobe anchor `fl` after QA bug 1) |
| `src/js/data/sky.js` | new: keys, seasons, groundBounce |
| `src/manifest.json` | the three files in the `data` layer, in that order |
| `src/index.html` | Q18 / Q19 hint SVGs, Q18 texts, the third Q10 stripe `<i>` |
| `src/css/43-stage-interior.css` | `--h-*` per style, Q19 `:has()` rules, hint classes, phone hint column 100 px / gap 8 px (41 lines) |
| `src/css/41-stage-questions.css` | Q10 `--x-*` per exterior, 2 : 1 : 1 stripes |
| `tests/unit/data-tables.test.mjs` | new, 9 tests (below) |
| `tests/e2e/interior.spec.mjs` | extended on QA's trimmed version: 50 → 77 checks, no extra page loads |
| `docs/03-tasks/F3-T3/verify/check-colours.mjs` | Designer verification: figures, A-11 simulation (not in run-all) |
| `docs/03-tasks/F3-T3/verify/shots.mjs`, `verify/shots/` | screenshots + legibility measurements at 4 viewports |

**FS carried item** (separate note `fs-obs5.md`): `src/js/core/plans.js` `moveRect`, plus a unit case in `tests/unit/plans-edit.test.mjs`.

## 3. Tests and how to verify
- **`node --test tests/unit/data-tables.test.mjs`** (9 tests, < 0.2 s):
  - exact key lists, value types;
  - 3D tint vs 2D (hue ≤ 3°, L* 5–12 lower); type floors ΔE ≥ 5.5 after every `floorMix`;
  - `ground` = summer ground;
  - furniture schema / counts / height cap / S-fit;
  - sky keys (order, 0 … 24 closed loop, noon key, night hemiI / sunI). After a reference A-13 blend in **all four seasons**: noon ≥ 5 × each night key, night background L* ≤ 15, noon > evening > night;
  - seasons;
  - CSS = tables by static parse (both `:has()` rules included);
  - manifest order.
- **`tests/e2e/interior.spec.mjs`**:
  - at five viewports: hint blocks ≥ 3 px, chips ≥ 10 × 8 px, hints inside their cards;
  - at 360 px: Q18 descriptions on one line;
  - at 360x640 and 1280x800: computed chip fills = `PC.data.interiors`, Q19 counts = the living sparse / full counts, Q19 recoloured by tapping Classic.
- **QA suites:** `node tests/run-all.mjs --qa --only f3-t3` (QA's own A-10 / A-11 / A-13 oracle, 3 093 judged rooms, browser look at five viewports).
- **`node docs/03-tasks/F3-T3/verify/check-colours.mjs [-v]`** reprints §5 and exits 1 on a binding failure. `node build.mjs && node docs/03-tasks/F3-T3/verify/shots.mjs` takes the screenshots.
- **Mutation checks:**
  - 15 unit mutations, all caught: a CSS accent hex, winter canopyVisible, night hemiI, last key ≠ first, keys out of order, bathroom without sparse, a 9th piece, h 1.5, bed 3.5 m, kitchen tint = bedroom, site ground, key rename, Q10 stripe hex, groundBounce, winter tintAmount;
  - 4 e2e mutations, all caught: a piece removed from Full, the two `:has()` rules removed, the phone hint column back to 112 px / 12 px, the accent fill rule removed;
  - QA's own mutation table is in `qa-report.md`.
- **Runs:**
  - Designer full run after the spec extension: exit 0 in 447.4 s;
  - QA full run: exit 0, 462.3 s (under the 8-minute A-16 target);
  - after the bug-1 fix (`furniture.js` only): data-tables 9/0, check-colours all binding met, `--qa --only f3-t3` 16/0 + 234/0 with no KNOWN line.

## 4. Measurements (stage-4 hints, `verify/shots.mjs`)
| Viewport | Hint | Smallest block | Smallest chip | Q18 descriptions |
|---|---|---|---|---|
| 360x640 | 100 × 72 | 3.9 px | 15.8 × 8.8 px | one line each |
| 640x360 | 174 × 64 (Q19 278 × 64) | 3.9 px | 15.5 × 8.6 px | Modern, Classic two lines (allowed) |
| 768x1024, 1280x800 | 198 × 96 (Q19 314 × 96) | 5.9 px | 23.5 × 13.1 px | one line each |

- Text contrast is unchanged: ink on surface 16.3:1.
- Every chip and block has an ink border.

## 5. `check-colours.mjs` output (final tables)
```
== 1.1 exteriors
  sand       wall/grass 40.5  wall/trim 14.8  roof/trim 12.6  wall/snow 26.4
  white      wall/grass 56.3  wall/trim 13.2  roof/trim 26.4  wall/snow 5.1
  terracotta wall/grass 62.6  wall/trim 17.6  roof/trim 12.8  wall/snow 60.5
  grey       wall/grass 53.1  wall/trim 22.8  roof/trim 11.6  wall/snow 29.1
  smallest exterior wall pair ΔE 22.2 sand/white
== 1.2 / 1.3 interiors, floors (floor = mix(roomTint, wood, floorMix))
  bedroom..laundry: hue Δ 0.01-1.12°, L* −7.8 to −8.1, chroma × 1.57-1.62
  modern   type pairs min ΔE 6.5 (bedroom/laundry); incl. hall 6.0 (storage/hall); piece vs own floor min 18.5 storage.shelvesBack (metal); wallInner vs floors min 12.9; --h-floor #B4C895
  classic  type pairs min ΔE 6.7 (bedroom/laundry); incl. hall 5.7 (storage/hall); piece vs own floor min 17.5 dining.chairB (fabric); wallInner vs floors min 14.3; --h-floor #B5C28F
  minimal  type pairs min ΔE 7.4 (bedroom/laundry); incl. hall 5.8 (storage/hall); piece vs own floor min 10.3 dining.table (wood); wallInner vs floors min 9.1; --h-floor #C0D29C
  style ΔE fabric: modern/classic 61.5, modern/minimal 53.4, classic/minimal 18.7
  style ΔE wood: modern/classic 21.9, modern/minimal 47.8, classic/minimal 36.6
  style ΔE accent: modern/classic 35.4, modern/minimal 60.5, classic/minimal 57.3
== 1.4 site
  groundOuter/grass 46.7 /paving 9.3 /snow 24.3; paving/grass 47.4 /snow 17.2; trunk/snow 65.6
== 3 sky (A-13 day-weighted season blend, groundBounce 0.25)
  spring E_top 8h 0.50  12h 0.89  17.5h 0.23  22h 0.12  noon/night ≥ 7.2  night background L* ≤ 9.0
  summer E_top 8h 0.53  12h 1.00  17.5h 0.22  22h 0.12  noon/night ≥ 7.6  night background L* ≤ 7.1
  autumn E_top 8h 0.48  12h 0.85  17.5h 0.22  22h 0.12  noon/night ≥ 6.8  night background L* ≤ 10.0
  winter E_top 8h 0.43  12h 0.70  17.5h 0.23  22h 0.10  noon/night ≥ 6.4  night background L* ≤ 11.5
  canopy/ground ΔE spring 16.7 summer 15.3 autumn 39.9; autumn/summer canopy 66.9; winter ground L* 94.9
== 2 furnish simulation (A-11 rule: 0.15 m inset, s 1.00 -> 0.60 by 0.05, overlap > 0.01 m on both axes)
  rooms 90; sparse pieces dropped: none; full not > sparse: none
  sparse placements scaled: 21 (lowest 0.60)
    bedroom S 6.00x2.00 bed 0.85          majlis S 6.93x2.31 lowTable 0.70
    bathroom S 1.50x2.67 shower 0.95      majlis S 2.31x6.93 seatBack 0.75
    bathroom M 1.50x4.00 shower 0.95      majlis M 2.83x8.49 seatBack 0.95
    kitchen S 1.73x5.20 counter 0.75      maid S 4.00x1.50 bed 0.60
    kitchen M 2.16x6.48 counter 0.95      maid M 5.20x1.73 bed 0.70
    living S 7.75x2.58 coffeeTable 0.80   maid L 6.00x2.00 bed 0.85
    dining S 6.00x2.00 chairB 0.85        storage S 1.50x2.67 shelvesBack 0.75
    dining S 6.00x2.00 chairF 0.85        storage M 1.50x4.00 shelvesBack 0.75
    dining S 2.00x6.00 chairB 0.85        storage L 1.73x5.20 shelvesBack 0.85
    dining S 2.00x6.00 chairF 0.85        laundry S 1.50x2.67 dryer 0.95
                                          laundry M 1.50x4.00 dryer 0.95
all binding requirements met
```
- **The 90 rooms:** 10 types × S / M / L × (square, 3:1 wide, 3:1 deep), short side ≥ 1.5 m. The rule is exactly A-11 (TL ruling 3).
- **Result:** every sparse piece is placed in every room, and full has more pieces than sparse in all 90.
- **QA's larger set:** 3 093 judged rooms, random S–L sizes on the m / ft grids plus generator layouts. After the fix: 0 sparse drops, and the wardrobe never goes below s 0.75 (QA's probe).

**Data changes after the plan, all within the approved rules:**
- bathroom `mat` h 0.02 → 0.05, and `towel` replaced by a 0.4 × 0.35 × 0.45 `basket` (TL note 2);
- maid gained a full-only `rug` 1.0 × 0.6 × 0.05: without it the 4 × 1.5 m maid room had full = sparse;
- bedroom `wardrobe` anchor `left` → `fl` (QA bug 1).

## 6. QA bug 1: fixed
- **Bug:** the bedroom `wardrobe` was anchored `left`. In narrow deep bedrooms (2.5 × 4, 2.5 × 4.5 m, 8 × 16 ft), the 2.0 m bed's foot blocked the middle of the left wall, so A-11 dropped the wardrobe from sparse.
- **Fix:** anchor `fl`, which is QA's probed fix. It gives 0 sparse drops in QA's 3 093 rooms and in the tolerance band, and the wardrobe never goes below s 0.75. The `fr` corner stays with the full-only armchair.
- **Re-run:** check-colours all met (90/90), data-tables 9/0, QA F3-T3 16/0 + 234/0, and QA's KNOWN entry matches nothing (QA removes it).

## 7. 3D art-direction note (for the FS, F4-T1..T3)
1. **Blocks.** One box per piece, never stacked inside a room.
   - No piece is taller than 1.1 m, so the 1.2 m cut walls and the floor tints carry the read from above.
   - Furniture batch: Lambert, vertex colours, `PC.three.col` on every hex.
2. **Floors and walls (A-10 wording).**
   - Room floor and hall: the tint quad = `mix(roomTints[type or 'hall'], interiors[style].wood, floorMix)`, using the one sRGB lerp with `Math.round`.
   - Stair and lift: the block or floor quad takes `roomTints.stair` / `.lift` unmixed, and any enclosure walls take `wallInner`.
   - Exterior walls use `wall`, partitions `wallInner`, slab edges and basement pit walls `slab` (so storeys read in "All").
   - Roof, gable and pergola use `roof`; entrance step, door reveal and gate posts use `trim`; parapets and the stair head use `parapet`.
   - Measured contrasts: piece vs its own floor ΔE ≥ 10.3; partition tops vs floors ≥ 9.1; exterior wall vs grass ≥ 40.5.
   - Accepted exception: White walls on winter snow, ΔE 5.1. The wall faces are vertical and shaded, so they still separate, and it is realistic.
3. **Light.**
   - The hex values assume the `PC.data.sky` rig: one sun plus one hemisphere, nothing else, with a noon top-face sum ≈ 1.0. Extra lights or higher intensities clip the pastels and whites.
   - `scene.background` takes the raw hex (A-10).
4. **Seasons.**
   - Change only material colours, the canopy's `visible` and the plot `ground`. `groundOuter` stays neutral, so the plot edge reads in every season.
   - The A-13 blend is day-weighted. Without that weight, a winter night background reaches L* 26.
5. **Highlight.** F5 uses `siteColors.highlight`, the 2D selection orange, so 2D and 3D share one "selected" colour.
6. **Furniture placement.** Implement A-11 exactly, as the simulation did (inset 0.15, orientation, the turned centre offset, s 1.00 → 0.60 by 0.05). Use an overlap test of `> 0.01 + 1e-9` (QA obs 2, below).

## 8. Known limits / tech debt
1. **Maid bed in 1.5 m-wide maid rooms.** It is placed at s 0.60 in the 4 × 1.5 m S room (0.70 at M 5.2 × 1.73), because A-11 never rotates an anchored piece. F4 will show a short bed there. This is legitimate under the rule (TL impl-review note 3).
2. **Low-scale sparse pieces** (QA obs, focus item 2): living `coffeeTable` s 0.70 in 7.5 × 2.5 m; majlis `lowTable` s 0.70 in the 3:1 S majlis. In the generator's tolerance band, dining chairs, the office chair and the majlis lowTable drop in rooms too narrow for them; that is A-11's intended drop. Full-only pieces reach s 0.60 in narrow rooms, which A-11 allows.
3. **QA obs 1 (FS / TL):** the `data-literals-only` lint forbids only arrow functions and a second `function`, so `Math.min(...)` would pass. QA's `f3-t3-data` check 1 guards the literals until the rule is tightened.
4. **QA obs 2 (FS F4-T2 / TL A-11 wording):** "overlap > 0.01 m" sits on a floating-point edge. `furnish` should use `> 0.01 + 1e-9`, as "inside (1e-9)" does. My `check-colours.mjs` uses the literal `> 0.01`; no room in its 90 depends on the edge after the wardrobe fix.
5. **TL impl-review note 4 → F5-T3:** at 640x360 and above, the stage-4 card name and radio sit right-aligned under the hint while the description is left-aligned (F3-T2 card grid; not introduced here).
6. **Small hints at 640x360:** the vignette blocks are 3.9 px. They show "more vs fewer" but not which piece is which (QA obs 4). Accepted for a hint.
7. **Twilight is lighter than night:** between 19.5 and 21 h the background reaches L* 15–19 (QA obs 3). This is by design (dusk). The night keys and the 22 h preset are ≤ 11.5.
8. **Values tuned without rendering.** The colours are tuned with a Lambert estimate, not rendered WebGL. The first real look is the F4-T1 publish. A retune is data-only; the tests guard rules and ranges, plus CSS = table.
9. **Values with no on-screen counterpart before F4:** `interiors.white`, `exteriors.wallInner/slab/parapet` and most of `siteColors` are checked for format and keys only (QA mutation table). The F4 mock tests will read them.
10. **`:has()` fallback:** browsers without `:has()` (Safari < 15.4, Chrome < 105) show the Q19 vignettes in Modern colours.

## 9. QA sign-off
QA round 1: **VERDICT: PASSED** (`qa-report.md`):
- 7 / 7 focus items met;
- the F3-plan acceptance criteria met (F3-S4 hint; F4-S1 / F4-S3 data preconditions);
- QA full run exit 0, 462.3 s.

Bug 1 (minor) is fixed in `furniture.js` as above and re-run with `--qa --only f3-t3` (16/0 + 234/0, no KNOWN match). QA confirms and removes its KNOWN entry.
