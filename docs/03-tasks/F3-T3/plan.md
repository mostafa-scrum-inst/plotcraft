# F3-T3 plan: 3D look tables, furniture tables, sky/season tables, stage-4 hints (Designer, 2026-11-21)

Step 3a of F3-T3 (F3-plan § F3-T3). This is a plan only; nothing is implemented until the TL plan review.
The QA A-16 trim (first rider) runs in parallel and is QA's (`qa-trim.md` in this folder); my tests land after it.

Sources: F3-plan F3-T3, A-9/A-10/A-11/A-13, F4-plan (what F4-T1..T3 read), F3-S4, F4-S1, F4-S3, palette2d (F1-T1), the stage-4 markup and `interior.spec` of F3-T2.
All proposed values below were checked with a throw-away script (CIELAB ΔE76, WCAG contrast, a Lambert light estimate, and a placement simulation that follows A-9's furnish rules). The numbers quoted come from that script. The script becomes `docs/03-tasks/F3-T3/verify/` at implementation time.

## 0. Scope and files

| File | Change | Layer / owner |
|---|---|---|
| `src/js/data/look3d.js` (new) | `PC.data.exteriors`, `interiors`, `roomTints`, `siteColors` (§1) | data, Designer |
| `src/js/data/furniture.js` (new) | `PC.data.furniture`: 10 types in the A-11 schema (§2) | data, Designer |
| `src/js/data/sky.js` (new) | `PC.data.sky.keys` and `.seasons` (§3) | data, Designer |
| `src/manifest.json` | the three files added to the `data` layer, after `js/data/room-labels.js`, in the order look3d, furniture, sky. Note: `js/core/sky.js` (`PC.sky`, F4-T3) and `js/data/sky.js` (`PC.data.sky`) share a basename, as A-2 names them; the `/* path */` banners keep them apart | Designer |
| `src/index.html` stage 4 | Q18 and Q19 hint SVGs replaced (§4); Q18 card descriptions (PM, §8 Q7) | Designer |
| `src/index.html` stage 2, Q10 | each exterior swatch gets a third `<i>` (wall / trim / roof). F1-T1's outcome assigned the placeholder exterior swatches to F3-T3 | Designer |
| `src/css/43-stage-interior.css` | hint classes and the `--h-*` custom properties (§4); stays under 100 lines | Designer |
| `src/css/41-stage-questions.css` | lines 81–84 become `--x-wall / --x-trim / --x-roof` per exterior, with the stripes using `var()` | Designer |
| `tests/unit/data-tables.test.mjs` (new) | schema + rule test, written with QA (§5) | Designer + QA |
| `tests/e2e/interior.spec.mjs` | extended in the existing loop, with no new spec file or page loads (§6) | Designer |

**No** core, ui-JS, hook or state change:
- no new `data-pc` hooks;
- `tests/contract/hooks.json` and `values.json` stay as they are;
- `stage-interior.js` is untouched (§4 uses CSS `:has()` instead of JS).

**Carried FS item (QA F3-T2 obs 5, `moveRect` span from the clamped room).** F3-T3 does **not** open `core/plans.js`: it touches only data, CSS and markup. The trigger "next time plans.js is opened" therefore does not fire in this task. TL options:
- (a) keep it deferred to the first FS task that opens `plans.js`;
- (b) give the FS a one-line change, with its unit case, alongside F3-T3. It has no dependency on my files.

I recommend (b) only if the TL wants it closed before the F3 feature review; otherwise (a).

## 1. `look3d.js` — proposed values (sRGB hex, upper case; F4 converts through `PC.three.col`)

**How to read the hex values.** Each hex is the colour a horizontal face shows **in sun at noon in summer**: the noon light rig of §3 gives a top-face irradiance E_top ≈ 1.00. A sunlit vertical face gets about 0.6, a face in shade about 0.25, and everything at night about 0.12.

### 1.1 `PC.data.exteriors` (Q10; keys exactly `wall, wallInner, slab, roof, trim, parapet`)
| | wall | wallInner | slab | roof | trim | parapet |
|---|---|---|---|---|---|---|
| sand | #D9C7A3 | #F3EDE0 | #A89F8E | #9C7E5E | #B89F78 | #CDB993 |
| white | #F2F0EA | #F8F7F3 | #B3B5B1 | #7F878C | #C9CCC8 | #E2E0D9 |
| terracotta | #C4704F | #F4E9DE | #A3958A | #6E3A2A | #8F4A32 | #B9654A |
| grey | #9BA1A6 | #EEF0F0 | #8D9398 | #454B51 | #5F676E | #8C9298 |

- `wall` and `trim` are today's Q10 swatch colours. The architect has seen them since F1, so they are kept.
- Use, for the art-direction note:
  - `wall`: exterior walls;
  - `wallInner`: partitions, and the inside of stair and lift walls;
  - `slab`: slab edges and basement pit walls;
  - `roof`: roof slab, gable and pergola;
  - `trim`: entrance step, door reveal and gate posts;
  - `parapet`: parapets and stair head.
- Checks:
  - wall vs grass ΔE ≥ 40 for all four; exterior walls differ pairwise (smallest pair sand/white, ΔE 22);
  - wall/trim ΔE 13–23, roof/trim ≥ 11.6;
  - wallInner (partition tops) vs every floor colour (§1.3) ΔE ≥ 8.4 (worst: terracotta with minimal);
  - **known weak pair:** White walls on winter snow, ΔE 5. Wall faces are vertical and shaded, so they still separate. This is realistic, so I accept it and say so in the art-direction note.

### 1.2 `PC.data.interiors` (Q18; keys exactly `fabric, wood, accent, white, metal, dark, floorMix`)
| | fabric | wood | accent | white | metal | dark | floorMix |
|---|---|---|---|---|---|---|---|
| modern | #3B4652 graphite | #4E3D33 smoked oak | #C8742F copper | #F2F1EC | #8A9299 | #23292F | 0.10 |
| classic | #E3D3B5 cream | #7A4A2E walnut | #8E3B33 burgundy | #F7F1E6 | #B08D45 brass | #3A2A22 | 0.15 |
| minimal | #C9CDCF pale grey | #C8A878 light oak | #8FA698 sage | #FAFAF8 | #AEB3B5 | #6E7477 | 0.10 |

- **`floorMix`** is the one key that is not a colour (proposal; see Q1). It is a number in [0, 0.3]. Each room's floor-tint quad becomes `mix(roomTints[type], interiors[style].wood, floorMix)`: a per-channel sRGB lerp, rounded, so Q18 also "changes the finish" while the room type stays readable.
- **The styles are visibly different:**
  - fabric: modern vs classic ΔE 61, modern vs minimal 53, classic vs minimal 19;
  - accent: ΔE 35–60 between every pair;
  - the hue families differ: dark and cool, warm and cream, pale.
- **Every piece reads on its own floor:** ΔE ≥ 10.3, computed per piece against its own room's floor after the mix. The worst cases are minimal oak on the dining floor and minimal fabric on the bedroom floor.

### 1.3 `PC.data.roomTints` (3D floor tint per room type)
Derived from palette2d's room tints by one rule, so they "visually match":
- same CIELAB hue (within 1.1° for all ten);
- L* 8 lower;
- chroma × 1.6.

The 2D pastels (L* 87–92) would wash out to near-white under the noon light and next to white fixtures.

| type | 2D (F1-T1) | 3D | | type | 2D | 3D |
|---|---|---|---|---|---|---|
| bedroom | #D6E2F3 | #B8CCE7 | | majlis | #E6D6EE | #D5BCE2 |
| bathroom | #C9EBE6 | #A1D8D1 | | office | #E6E3C4 | #D1CD9D |
| kitchen | #F7E7B0 | #E5D179 | | maid | #F4D6DC | #EABBC5 |
| living | #DCEBC8 | #BFD7A0 | | storage | #DEDAD3 | #CAC4B9 |
| dining | #F6D9BF | #EBC097 | | laundry | #CDE6F5 | #A8D2E9 |
| hall | #EFEDE6 | #D9D6CE | | stair / lift | #C5CBD0 / #AEB7BB | same as 2D |

- **Extra keys** `hall`, `stair`, `lift` (proposal Q2). F4-T1 needs a "neutral hall tint" and colours for the stair and lift blocks; keeping them here means one table.
- **Distinctness after the floorMix, all three styles:**
  - every pair of types ΔE ≥ 6.0, except storage vs hall at 5.7–6.0. That pair is just as close in 2D (ΔE 4.5), and the storage room also has walls and shelves;
  - the closest true type pair is bedroom/laundry (6.0–7.4), the same blue family as in 2D.

### 1.4 `PC.data.siteColors` (fixed, not by season, except `ground`)
| key | hex | key | hex |
|---|---|---|---|
| ground (plot grass, = `sky.seasons.summer.ground`) | #7FAE55 | gate | #3B4652 |
| groundOuter (outside the plot; neutral "context", not seasonal) | #B3B0A6 | carCanopy (parking canopy) | #A3ABB1 |
| paving (parking pads, path, seating pad) | #CFC8BA | seating | #9A7A55 |
| poolWater | #3FA7C9 | trunk | #5B4636 |
| poolRim | #E6E1D6 | northMarker | #16212B (the 2D compass ink) |
| boundaryWall | #CDC4B2 | highlight (F5 selected room) | #C2410C (2D selection) |

- **Contrast:**
  - groundOuter vs grass ΔE 47, vs paving 9.3, vs snow 24, so the plot edge reads in every season;
  - paving vs grass 47, paving vs snow 17;
  - trunk vs snow 66, so bare winter trees read.
- **Key names:** the F3-plan list names the items, not the keys. These keys are my proposal (Q4). `canopy` is called `carCanopy` so it is not mistaken for the tree canopy in `seasons`.

## 2. `furniture.js` — piece lists (A-11 schema)

**Keys of each piece:** exactly `id, w, d, h, y0, anchor, color, sparse`, plus an optional `off` (see Q3).
- `sparse` is always written as `true` or `false`, so the "exact keys" test is simple.
- All `y0` are 0.

**Proposed placement convention**, for the FS's `PC.furnish` (Q3):
- **Frame:** the room rectangle in frame P, with the Q14 convention: front = low y (street side), left = low x as seen from the street, `fl` = (0, 0).
- **`w` and `d`:**
  - `w` is the size along the wall the piece is anchored to; `d` is the depth into the room;
  - back/front and the corners: `w` along x;
  - left/right: `w` along y;
  - `center`: `w` along the room's longer side.
- **`off: [a, b]`**, in metres, is a shift applied after anchoring: `a` toward the right and `b` toward the back. For `center` pieces, `a` runs along `w`, so the offset turns with the piece.
  - It is scaled with the piece when furnish shrinks it (down to 60 %, A-9), so chairs stay around a shrunk table.
  - Overlap means more than 0.01 m: pieces may touch.
- **Height cap:** `y0 + h ≤ 1.1 m`. The art-direction rule: nothing rises above the 1.2 m cut walls (A-10), so the dollhouse reads from above (Q6).

**S-fit rule** (tested in §5; placement itself stays F4-T2's furnish test):
- every sparse piece has max(w, d) ≤ √S − 0.3;
- the sparse pieces' summed w·d ≤ 0.4 × S.

**Simulation result** (my furnish model: 0.15 m clearance, scale 1.0 → 0.6, drop on overlap). It covered every type at S, M and L, each as a square and at 3:1 in both orientations, sides ≥ 1.5 m:
- **sparse:** every sparse piece is placed in all 90 rooms. 13 placements need scaling (lowest 0.6: the maid bed in a 4 × 1.5 m room);
- **full vs sparse:** full places more pieces than sparse in all 90 rooms, and in every room at M.

| type (S m²) | pieces: id w × d × h (anchor, colour) — **sparse in bold** | count sparse / full |
|---|---|---|
| bedroom (12) | **bed 1.6×2.0×0.5 (back, fabric)**, **wardrobe 1.2×0.6×1.1 (left, wood)**, sideL 0.45×0.45×0.5 (bl, wood), sideR 0.45×0.45×0.5 (br, wood), dresser 1.0×0.45×0.8 (right, wood), armchair 0.7×0.7×0.8 (fr, accent) | 2 / 6 |
| bathroom (4) | **toilet 0.4×0.65×0.45 (bl, white)**, **shower 0.85×0.85×0.1 (br, metal)**, **basin 0.55×0.45×0.85 (fl, white)**, cabinet 0.45×0.3×0.9 (fr, wood), mat 0.5×0.35×0.02 (center, accent), towel 0.5×0.12×1.1 (front, fabric) | 3 / 6 |
| kitchen (9) | **counter 1.9×0.6×0.9 (bl, white)**, **fridge 0.7×0.7×1.1 (fr, metal)**, island 1.2×0.7×0.9 (center, wood), pantry 0.6×0.6×1.1 (left, wood), sideCounter 1.2×0.6×0.9 (right, white), stoolL 0.4×0.4×0.65 (center, off [−0.3, −0.6], dark), stoolR (same, off [0.3, −0.6]) | 2 / 7 |
| living (20) | **sofa 2.2×0.9×0.75 (back, fabric)**, **coffeeTable 1.1×0.6×0.4 (center, wood)**, tvUnit 1.8×0.45×0.5 (front, dark), armchairL 0.8×0.8×0.8 (left, accent), armchairR (right, accent), sideTable 0.45×0.45×0.5 (bl, wood) | 2 / 6 |
| dining (12) | **table 1.6×0.9×0.75 (center, wood)**, **chairB 0.45×0.45×0.9 (center, off [0, 0.75], fabric)**, **chairF (off [0, −0.75])**, chairL (off [−1.075, 0]), chairR (off [1.075, 0]), sideboard 1.4×0.45×0.8 (back, wood) | 3 / 6 |
| majlis (16) | **seatBack 2.6×0.8×0.35 (back, fabric)**, **lowTable 1.0×0.6×0.3 (center, wood)**, seatLeft 2.0×0.8×0.35 (left, fabric), seatRight (right, fabric), sideFL 0.4×0.4×0.4 (fl, accent), sideFR (fr, accent) | 2 / 6 |
| office (9) | **desk 1.4×0.7×0.75 (back, wood)**, **chair 0.55×0.55×0.9 (back, off [0, −0.75], dark)**, shelf 1.2×0.4×1.1 (left, wood), cabinet 0.45×0.6×0.7 (br, metal), armchair 0.7×0.7×0.8 (fr, accent) | 2 / 5 |
| maid (6) | **bed 0.9×2.0×0.5 (bl, fabric)**, **cupboard 0.8×0.55×1.1 (fr, wood)**, desk 0.9×0.45×0.75 (right, wood), chair 0.45×0.45×0.9 (right, off [−0.5, 0], dark) | 2 / 4 |
| storage (4) | **shelvesBack 1.6×0.45×1.1 (back, metal)**, shelvesLeft 1.2×0.45×1.1 (left, metal), shelvesRight (right, metal), crate 0.5×0.5×0.4 (fl, wood) | 1 / 4 |
| laundry (4) | **washer 0.6×0.6×0.85 (bl, white)**, **dryer 0.6×0.6×0.85 (bl, off [0.65, 0], white)**, basket 0.45×0.35×0.4 (fr, accent), rack 1.0×0.4×1.0 (front, metal) | 2 / 4 |

**Budget:**
- the maximum house's full furniture is at most 8 rooms × 7 pieces = 56 boxes per level batch, against the 256 that A-11 allows;
- the mesh count is unchanged (one batch per level).

**Fallback if the TL rejects `off`** (Q3), which removes the 9 offset pieces:
- dining: table plus a sideboard and benches along the left and right walls;
- kitchen: no stools;
- office: the chair goes to `center`;
- laundry: dryer at `br`;
- maid: the chair is dropped.

Every type still meets "≥ 1 sparse, ≥ 2 full-only", but dining loses its table-and-chairs read.

## 3. `sky.js` — hour keys and seasons (A-13 fields)

### 3.1 `PC.data.sky.keys` (`{ h, background, sunColor, sunI, hemiSky, hemiGround, hemiI }`, strictly increasing h)
| h | background | sunColor | sunI | hemiSky | hemiGround | hemiI | E_top summer |
|---|---|---|---|---|---|---|---|
| 0 night | #0B1626 | #9FB3D9 (moon) | 0.15 | #7083AD | #2A3040 | 0.30 | 0.13 |
| 4.5 night | same as 0 | | | | | | |
| 6 dawn | #E8B08A | #FFB27A | 0.30 | #B6A6C8 | #5A5046 | 0.36 | 0.17 |
| 7.5 morning | #A9CBE6 | #FFE2BC | 0.55 | #C9DCEE | #7F7564 | 0.44 | 0.47 |
| 12 noon | #8EC3EA | #FFF7E8 | 0.70 | #D6E6F5 | #8F8672 | 0.48 | **1.00** |
| 16 afternoon | #9CC5E4 | #FFEBCF | 0.65 | #D2E0EE | #8A7F69 | 0.46 | 0.6 |
| 17 golden | #D8B994 | #FFC98A | 0.60 | #D9C7B8 | #7F6F5C | 0.42 | ≈ 0.3 |
| 18 dusk | #E59A6E | #FF9A5C | 0.40 | #A894B8 | #54463E | 0.36 | ≈ 0.16 |
| 19.5 twilight | #2C3556 | #9FB3D9 | 0.15 | #6E7BA6 | #2A2A38 | 0.32 | ≈ 0.1 |
| 21 night, 24 night | same as 0 | | | | | | |

- **Night** (keys with h < 5 or h > 20) uses hemiI 0.30 ≥ 0.25 and sunI 0.15 ≤ 0.25 × noon 0.70.
- **Night is dark but the model shows:**
  - a sunlit sand floor at the night preset (22 h) is about sRGB 76, against a background of sRGB 22;
  - E_top is 1.00 at noon and 0.12 at night, a factor of 8.
- **Presets** (A-13: 8 / 12 / 17.5 / 22): morning ≈ 0.53, noon 1.00, evening (golden, warm) ≈ 0.25, night 0.12, so noon > evening > night holds.
- **Winter noon** is 0.72 (sun at 32°). It is darker, as it should be.
- **Sun/moon hand-over** at 6 and 18: the direction jump is documented in A-13. The low sunI on those keys keeps it gentle.

### 3.2 `PC.data.sky.seasons` (`{ elevMax, tint, tintAmount, canopy, canopyVisible, shrub, ground }`)
| | elevMax | tint | tintAmount | canopy | canopyVisible | shrub | ground |
|---|---|---|---|---|---|---|---|
| spring | 52 | #F1F7E4 | 0.08 | #6AA442 | true | #8CBF5A | #9DC46F |
| summer | 72 | #FFF4DE | 0 | #4E8A3A | true | #5E9441 | #7FAE55 |
| autumn | 52 | #F6C58E | 0.15 | #C8702A | true | #A8692F | #A59B5C |
| winter | 32 | #D3E0F2 | 0.20 | #6F6A5C (unused) | **false** | #DCE4EA (snow mounds) | #EDF1F4 (snow) |

- **Checks:**
  - canopy vs ground ΔE: spring 16.7, summer 15.3, autumn 40;
  - autumn vs summer canopy ΔE ≈ 45;
  - winter ground L* ≈ 95;
  - trunks vs snow 66.
- **Proposed blend semantics** for `PC.sky.compute` (F4-T3, TL to rule, Q5):
  - `sunColor`, `hemiSky` and `background` are each lerped toward `tint` by `tintAmount`;
  - `hemiGround` is lerped 0.25 toward the season's `ground` (snow bounce);
  - summer (`tintAmount` 0) is the untinted baseline.

## 4. Stage 4 hint visuals (F3-S4 "small visual hint")

**Q18 cards.** One inline SVG per card, `class="pc-hint pc-hint--<style>"`, keeping the current viewBox `0 0 112 72`:
- **Swatch strip:** top row, 5 chips of 18 × 10 (fabric, wood, accent, metal, dark), each with a 1 px ink stroke. The border gives ≥ 3:1 non-text contrast whatever the fill. `white` is left out: the three whites are within ΔE 6 of each other and tell the styles apart least.
- **Room vignette:** below the strip, a top-down M living room (6.4 × 4.7 m at 10 units/m):
  - floor in `--h-floor`, which is `mix(roomTints.living, wood, floorMix)`, precomputed: modern #B4C895, classic #B5C28F, minimal #C0D29C;
  - an ink outline;
  - the six full living pieces, at the positions my furnish simulation gives for that room;
  - each piece is a top rect in its colour plus a front strip (the same fill under a 25 % ink overlay), so it reads as a block, as in the 3D view.

**Colours.** Every fill is CSS (`.pc-hint .h-fabric { fill: var(--h-fabric) }` …), never a presentation attribute. The custom properties are set on `.pc-hint--modern|classic|minimal` in `43-stage-interior.css`, with **the same hex values as `PC.data.interiors`** (tested, §5 and §6).

**Q19 cards (Q19 sparse vs full).** The same living room, larger (no strip):
- Sparse: 2 pieces (sofa, coffee table). Full: 6 pieces.
- Each piece is a `<g class="h-piece">`, so the count is countable, and `data-pieces="2"` / `"6"` sits on the SVG. The counts must equal the `sparse` and full counts of `PC.data.furniture.living` (tested).
- The vignettes take the colours of the **chosen Q18 style**, via `.pc-interior:has(input[value="classic"]:checked) .pc-hint--density { --h-…: … }`. Without `:has()` they stay Modern, which is still a correct hint (Q8).

**Q10 swatches (stage 2).** Three stripes (wall 2 : trim 1 : roof 1) from `--x-wall / --x-trim / --x-roof` on `.pc-sw-<ext>`, equal to `PC.data.exteriors`.

**Card texts.** Unchanged except two Q18 descriptions (PM, Q7). "Cream walls" would be wrong, because walls follow Q10:
- Modern "Graphite, dark wood, copper";
- Classic "Cream fabric, walnut, brass";
- Minimal "White, pale grey, light oak" (unchanged).

**Layout.** Unchanged: the 112 px hint column on phones, full width and 96 px high from 600 px, 64 px in short landscape. The cards keep their 44 px or more, and the hint is `aria-hidden` (meaning is in the name and description text; no colour-only information).

## 5. Unit test `tests/unit/data-tables.test.mjs` (with QA; node, < 0.5 s)
1. **Option keys.** Exteriors = `C.ENUM.exterior`, interiors = `C.ENUM.interiorStyle`, seasons = the four, furniture = `C.ROOM_TYPES`, roomTints = `ROOM_TYPES` + hall, stair, lift. Each entry has exactly its key list (§1–§3).
2. **Value types.**
   - Every colour is `/^#[0-9A-F]{6}$/`.
   - The only non-colour values are:
     - `floorMix` in [0, 0.3];
     - `h`, `sunI` and `hemiI`, finite, with intensities in [0, 1.5];
     - `elevMax` = 52 / 72 / 52 / 32;
     - `tintAmount` in [0, 0.5];
     - `canopyVisible` boolean.
3. **Matching tints.** For each of the 10 types, the 3D tint has the CIELAB hue of `palette2d.room[type]` within 3°, and L* 5–12 lower. After the `floorMix` of every style, every type pair has ΔE ≥ 5.5.
4. **Shared values.** `siteColors.ground === sky.seasons.summer.ground`.
5. **Furniture.**
   - 3–8 pieces per type, ids unique.
   - w, d, h > 0; y0 ≥ 0; y0 + h ≤ 1.1.
   - The anchor is one of the 9 values and the colour one of the 6 keys.
   - `sparse` is boolean.
   - `off`, when present, is two finite numbers with |a|, |b| ≤ 1.2.
   - Each type has ≥ 1 sparse piece and ≥ 2 non-sparse pieces.
   - The S-fit rule of §2 holds (S from `PC.C.ROOM_SIZE`).
6. **Sky keys.**
   - h strictly increasing; first 0, last 24; the last equals the first in every other field.
   - A key at 12 exists.
   - Night keys (h < 5 or h > 20) have hemiI ≥ 0.25 and sunI ≤ 0.25 × the noon key's sunI.
   - Light estimate: E_top at noon ≥ 5 × E_top at every night key (the §3 formula, 15 lines; it guards "night clearly dark but visible" against later table edits).
7. **Seasons.**
   - Winter `canopyVisible === false`, the others true.
   - Autumn canopy ΔE ≥ 20 from summer.
   - Winter ground L* ≥ 90.
   - The four (canopy, ground) pairs are all distinct.
8. **CSS equals the tables** (static parse, no browser).
   - `43-stage-interior.css`: `.pc-hint--<style>` declares `--h-fabric … --h-dark` equal to the table, and `--h-floor` equal to `mix(living, wood, floorMix)`, rounded.
   - `41-stage-questions.css`: `.pc-sw-<ext>` declares `--x-wall`, `--x-trim`, `--x-roof` equal to `exteriors`.
9. **Literals only.** The existing lint rule `data-literals-only` already covers the three new files. The test only asserts that they are in the manifest's `data` layer.

## 6. E2E (extend `tests/e2e/interior.spec.mjs`; no new spec, no extra page loads)
The spec already loads stage 4 at five viewports. Assertions added inside the same loop:
- **All five viewports** (cheap evaluates, no navigation; the small 64 px hint of 640x360 is the case that matters):
  - every `.h-piece` rect renders ≥ 3 px in both directions;
  - every chip renders ≥ 10 × 8 px;
  - the hint stays inside its card.
- **360x640 and 1280x800 only:**
  - (a) the computed `--h-*` values of the three style hints equal `PC.data.interiors` (read in the page);
  - (b) the three style cards are visibly different: the computed `fill` of the fabric, wood and accent chips is distinct across the cards;
  - (c) the Q19 vignettes have `.h-piece` counts 2 and 6, equal to the living table's sparse and full counts, so sparse < full;
  - (d) the Q10 swatches' computed `--x-*` values equal `PC.data.exteriors`. Stage 2 is hidden at that point, but computed custom properties are still readable;
  - (e) choosing Classic makes the Q19 vignette's `--h-fabric` equal `interiors.classic.fabric`. This is one extra tap and wait on these two viewports only.
- **Already in the spec, kept:** no horizontal scroll, cards ≥ 44 px, texts in full, clean log.

**Runtime:** about +2 s on the full run (one extra tap at two viewports, plus evaluates) and < 0.5 s of unit tests, within the ≤ 8 min target that the QA trim sets.

## 7. How I verify (before review)
- **Script.** `docs/03-tasks/F3-T3/verify/check-colours.mjs` (node, not in run-all) reprints every ΔE, contrast and E_top figure in this plan from the final files, and reruns the furnish simulation (all 90 rooms). Its output goes into `outcome.md`.
- **Screenshots.** `verify/shots.mjs` captures stage 4 (each style chosen, with the Q19 vignettes following it) and the Q10 block at **360x640, 640x360, 768x1024 and 1280x800**. I inspect each one for:
  - the chips told apart at a glance;
  - the furniture blocks recognisable (sofa vs table);
  - the vignette not cramped at the 64 px landscape height;
  - selected-card state: the chips stay bordered on the `--accent-tint` background, and ink text there stays 13.6:1;
  - descriptions on one line at 360 (the spec checks there is no overflow).
- **Legibility thresholds** (measured in the spec and the script):
  - smallest piece ≥ 3 px (target 4 px at 640x360);
  - chip ≥ 10 × 8 px;
  - text contrast unchanged (ink on surface 16.3:1, on accent-tint 13.6:1);
  - every chip has an ink border.
- **Runs.** Focused runs: `node tests/run-all.mjs --unit` and `--e2e --only interior,contract,questions`. Then the full `node tests/run-all.mjs`, with its time recorded.
- **Mutation checks** (each must make a test fail; reverted after):
  1. One `--h-accent` hex changed in the CSS: unit §5.8 and e2e (a).
  2. Winter `canopyVisible: true`: §5.7.
  3. Night hemiI 0.2: §5.6.
  4. Last sky key ≠ first: §5.6.
  5. Sky keys out of order: §5.6.
  6. All bathroom pieces `sparse: false`: §5.5.
  7. A 9th bedroom piece: §5.5.
  8. A piece with h 1.5: §5.5.
  9. The bed made 3.5 m wide: S-fit, §5.5.
  10. The kitchen 3D tint set to the bedroom's: hue test, §5.3.
  11. `siteColors.ground` ≠ summer ground: §5.4.
  12. A `.h-piece` removed from the Full vignette: e2e (c).
  13. A key renamed (`carCanopy` → `canopy`): §5.1.
  14. A Q10 stripe hex changed: §5.8 and e2e (d).
  15. `:has()` rule removed: e2e (e).

## 8. Open questions (TL unless marked)
1. **`floorMix`** is a number, and floor = sRGB lerp(roomTint, wood, floorMix). F4-T1 (`build-shell`) applies it to the tint quads and the hall; stair and lift are not mixed. Please confirm, or name another meaning.
2. **`roomTints`** gets three extra keys (`hall`, `stair`, `lift`) beyond the 10 types.
3. **A-11 schema addition:** the optional `off: [a, b]` plus the orientation convention of §2 (w along the anchor wall; `center` along the longer side; scaled with the piece; overlap tolerance 0.01 m). It is needed for chairs around tables, stools at the island and the office chair at the desk. If rejected, the fallback of §2 applies.
4. **`siteColors` key names** (`groundOuter`, `carCanopy`, `northMarker`, `boundaryWall`, `poolWater`, `poolRim`), with `groundOuter` fixed and not seasonal.
5. **Season blend semantics** for `PC.sky.compute` (§3.2). A-13 leaves this open, and F4-T3 needs it.
6. **Furniture height cap** `y0 + h ≤ 1.1 m` (below the 1.2 m cut walls), so wardrobes, fridges and shelves are 1.1 m, not their real height.
7. **PM:** Q18 descriptions "Graphite, dark wood, copper" and "Cream fabric, walnut, brass" (Minimal unchanged).
8. **Q19 vignettes follow the chosen Q18 style** through CSS `:has()`; they stay Modern where it is unsupported. The alternative is fixed Modern colours, which removes e2e (e).
9. **Q10 swatch change in stage 2** (a third stripe for the roof). It is in scope via F1-T1's outcome, but it touches a stage outside F3-T3's file list.
10. **Carried FS obs 5:** not triggered by this task (§0). The ruling is the TL's.

## 9. Risks
- **Real WebGL is not seen until the F4-T1 publish.**
  - The values are tuned with a Lambert estimate (sRGB→linear, sun plus hemisphere) and are not rendered.
  - Mitigation: all of them live in data. The tests guard rules and ranges, not exact hex values, except where the CSS must equal the table. A retune after the phone check is a data-only change.
- **Clipping.** If the FS adds lights or raises intensities beyond the table, pale tints and whites clip to white, because the hex values assume E_top ≈ 1 at noon. The art-direction note states this, and F4-T3's look test could assert the noon sum.
- **`:has()`** needs Safari 15.4+ / Chrome 105+; older phones fall back to Modern colours (accepted, Q8).
- **The `off` field** adds a little furnish logic for the FS (F4-T2); the fallback exists.
- **Narrow rooms** (3:1, 1.5 m side) scale or drop full-only pieces (simulated: full still > sparse everywhere). That is A-9's rule, not a bug.

## 10. Art-direction note (goes into `outcome.md` for the FS, F4)
1. **Blocks.** One box per piece. Never stack boxes inside a room. No piece is taller than 1.1 m, so the cut walls (1.2 m) and the floor tints carry the read from above. Furniture batch: Lambert, vertex colours, `PC.three.col` on every hex.
2. **Floors and walls.**
   - Room floor = §1.2 `floorMix` rule; hall likewise; stair and lift use `roomTints.stair` / `.lift`.
   - Exterior walls use `wall`, partitions `wallInner`. Slab edges use `slab`, so storeys read in "All".
   - Contrast targets: piece vs its own floor ΔE ≥ 10; partition tops vs floors ΔE ≥ 8; exterior wall vs ground ≥ 20 (White on snow is the accepted exception).
3. **Light.**
   - The hex values assume the §3 rig: noon top-face sum ≈ 1.0, one sun plus one hemisphere, nothing else. Extra lights or higher intensities wash out the pastels.
   - `scene.background` takes the raw hex (A-10).
4. **Seasons.** Change only material colours and the canopy's `visible`. `groundOuter` stays neutral, so the plot edge always reads.
5. **Highlight** (F5) uses `siteColors.highlight` (the 2D selection orange), so 2D and 3D share one "selected" colour.
