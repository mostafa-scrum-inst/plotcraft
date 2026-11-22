# F6-T1c Designer plan: roof detail, evening far grass, far meadow, blank walls (CD-8 close)

Date: 2026-11-22. Author: Designer. Base: f6t1 at d303584 (F6-T1a + b, QA PASSED). Binding constraints: `docs/03-tasks/F6-T1/cto-constraints.md` (with its 2026-11-22 edits). For TL plan review.

No browser runs were made for this plan (QA timing runs in progress). Evidence comes from the T1b after-shots (`docs/03-tasks/F6-T1/shots-t1b/` on f6t1), node runs of the core model and the ACES calculator (`docs/03-tasks/F6-T1/verify/retune.mjs`). Crops of today's look are in `before/`:
- `sample-noon-1280x800-crop.jpg` and `max-noon-1280x800-crop.jpg`: the roof reads as one flat tan plane; the 0.3 m parapet is a hairline; the maximum house's right and back faces are blank.
- `sample-evening-1280x800-crop.jpg`: the far meadow at 17.5 h.

Today's budgets (maximum house, real r128, f6t1): 26 meshes (test limit 64), 26 / 25 draw calls (limit 160), 19.4k triangles (limit 300k), 4 textures + tiles, 4.02 MB (limits 12 / 16 MB), transparent meshes 2 of 2, dist 573.5 kB (limit 627 kB).

## 0. Summary and MVP

Ranked by visual impact per cost. **MVP = R1, R2, R3, G1, W1** (all data or BoxBatch boxes, at most +1 mesh, +1 texture).

| # | Item | Impact | Meshes / calls | Triangles | Texture | Phone risk | Owner |
|---|---|---|---|---|---|---|---|
| R1 | Coping on parapets + a drip edge at the slab | high | 0 / 0 | +~100 | none | none | FS (boxes), Designer (keys) |
| R2 | Roof deck: membrane texture on the flat roof top | high | +1 / +1 | +2..+12 | +1 (256² / 512²) | low | FS, Designer (spec) |
| R3 | Edge shadow: baked contact band inside the parapet | medium-high | 0 / 0 | +~50 | none | none | FS, Designer (k) |
| G1 | Evening meadow: greener summer / spring meadow hex | high at 17.5 h | 0 | 0 | none | none | Designer (data only) |
| W1 | Hall windows on exterior runs no room touches | high on large houses | 0 / 0 | +~3k (max) | none | none | FS (core rule), Designer (consts) |
| R4 | Roof plant: water tank + AC units on flat roofs | medium | 0 / 0 | +~150 | none | none | FS, Designer |
| G2 | Far meadow variation: larger tile, broader octaves | medium | 0 | 0 | same texture, regenerated | none | Designer (data); optional tint needs FS + TL |
| R5 | Pitched roof: eaves overhang + fascia | medium (pitched only) | 0 / 0 | +~50 | none | none | FS |
| W2 | String course at each floor (optional) | low-medium | 0 / 0 | +~50 per level | none | none | FS |

Nothing here adds a light, a shadow caster class, a transparent mesh, a shader or post-processing. Expected maximum house after the MVP: 27 meshes, ≤ 28 draw calls, ~23k triangles, 6 textures, ~4.4 MB (or ~5.4 MB at 512² deck), dist +3 to 5 kB.

## 1. Roof detail (client brief: "roof detail")

What reads wrong today (crops): the flat roof is one uniformly lit slab in `exteriors.roof` (sand #9C7E5E); the 0.3 x 0.15 m parapet ring in `parapet` is too thin to read from the Reset pose (phi 62); nothing breaks the plane; no edge darkening where parapet meets deck.

### R1 Coping and drip edge (MVP)
- **Coping:** a cap on every parapet ring: 0.05 m thick, 0.03 m overhang each side (width parapetT + 0.06 = 0.21 m), on top of the parapet, in a new exterior key `coping`. Lighter than the parapet so the sunlit top catches a crisp line, the overhang throws a hairline shadow on both faces.
- **Drip edge:** the roof slab's outer edge 0.04 m proud of the wall plane, slab thickness (0.2 m), in `slab`. Reads as the slab line under the parapet from below and at Reset.
- **Values (exteriors[*].coping, upper case sRGB, under ACES at noon):**

  | exterior | parapet (today) | coping |
  |---|---|---|
  | sand | #B49A72 | #E6DAC4 |
  | white | #E3E0C9 | #F4F2EA |
  | terracotta | #995744 | #D9CBB8 |
  | grey | #72787D | #B9BEC1 |

  Coping on terracotta is a stone cap (light), as on real terracotta-plastered houses; the others are the wall tone, lighter.
- **Constants (PC.C.ROOF):** `copingT 0.05`, `copingOver 0.03`, `dripOut 0.04`. Also on the terrace's 1.0 m parapet and the stair head / lift overrun tops (same rule: every parapet-coloured box top gets a cap).
- **Cost:** 4 boxes per ring, + 2 heads: about 8 boxes, ~100 triangles, appended to roofBatch (no new mesh, no draw call). Casts shadow with roofBatch (already a caster).
- **Phone risk:** none.

### R2 Roof deck: membrane texture (MVP)
- **Look:** the flat roof top as a bituminous / liquid membrane: sheets 1.0 m wide with a 1 px lapped seam slightly darker (-0.12), a soft lengthwise mottle (low-frequency noise ±0.05), fine speckle ±0.03. Neutral grey (C-3.3), colour from `exteriors.roof` so Q10 still changes it.
- **Terrace and usable flat roofs:** the same mesh takes the **paving** texture (already generated, 0 new textures) at its own `tileM` 2.4 (4 x 4 slabs, so 0.6 m roof tiles) instead of the membrane: a walkable roof reads as tiles.
- **Geometry:** the top face of the flat / terrace slab moves out of roofBatch into a new mesh `roofDeck` (a single quad inside the parapet, 0.002 m above the slab top; world UVs in metres), MeshStandardMaterial (roughness 0.95) with `map`, in the `roof` group (visibility follows Roof and "All"). Receives shadows, does not cast. Pitched roofs keep `roofTiles` and have no deck.
- **Texture spec (data/textures.js, `membrane`):** `{ tileM: 4, base: 0.9, sheetW: 1.0, seam: -0.12, mottle: [[2, 0.05], [8, 0.025]], speckle: 0.03 }` at 256² (lite) / 512² (full). One new texgen kind; tileable, deterministic, a hash in texgen.test (generated through the generator).
- **Colour:** unchanged `exteriors.roof`. The CSS test ties `roof` to the stage-2 swatches, so the swatch colour stays the roof colour; the texture gives detail only. (A lighter, greyer "real" membrane colour would break the 2D/3D match: not proposed.)
- **Cost:** +1 mesh (27 of 64), +1 draw call (receives only, no shadow-pass call), 2 triangles; +1 texture 0.35 MB (256²) or 1.4 MB (512²), total ≤ 5.4 MB of 16. Texgen time: one more 512² kind, ~10 ms node (C-3.2 budget 150 ms).
- **Phone risk:** low (one textured quad).

### R3 Edge shadow inside the parapet (MVP)
- **Look:** the baked contact darkening already used at wall bases (C4): a band 0.35 m wide on the deck along the inside of every parapet, darkening from x0.80 at the parapet to x1 at the band edge; a 0.25 m band around the stair head / lift overrun bases at x0.85. Reads as the soft shade a parapet always throws, at every hour (the real sun shadow from a 0.3 m parapet is a few cm at noon).
- **Implementation:** vertex colours on `roofDeck` (subdivide the quad into a border ring, as the footprint `groundRing` does), or 4 shaded strips in roofBatch 0.003 m above the deck (as `ringLift`). FS picks; the strips need no new vertex code.
- **Constants (PC.C.CONTACT):** `deckW 0.35`, `deckK 0.80`, `headW 0.25`, `headK 0.85`.
- **Cost:** 0 meshes, ~50 triangles. **Phone risk:** none.

### R4 Roof plant on flat roofs (after MVP)
- **Look:** what a Gulf flat roof carries: one water tank and AC condenser units, giving the roof scale and silhouette.
  - Tank: box 1.2 x 1.2 x 1.0 m on a 0.2 m plinth, `#E8E6E0` (white GRP), placed in the back-right deck corner, 0.6 m clear of the parapet and the stair head.
  - AC units: boxes 0.9 x 0.35 x 0.7 m, `#C9CCC8` with a 0.5 x 0.5 grille face in `#5F676E`, count = clamp(round(deck area / 60), 1, 4), in a row along the back parapet, 0.4 m apart, 0.5 m clear.
  - None on terrace / usable roofs where the pergola or stair head sits in that strip (skip a unit that would overlap a head, the pergola or another unit).
- **Data:** new `siteColors.tank` / `acUnit` / `acGrille`; constants `PC.C.ROOF.plant { tank: [1.2, 1.2, 1.0], plinth: 0.2, ac: [0.9, 0.35, 0.7], acPerM2: 60, acMax: 4, clear: 0.6 }`.
- **Cost:** ~6 boxes, ~150 triangles in roofBatch (casters). **Phone risk:** none. Not house-model data: pure decoration in buildRoof, deterministic from the footprint.

### R5 Pitched roof eaves (after MVP; pitched houses only)
- The model supports `roofType: 'pitched'` (30° gable, no overhang today). Add an eaves overhang 0.40 m on the long sides and 0.25 m at the gables, a 0.18 m fascia board in `trim`, gable bargeboards in `trim`. The overhang throws the eaves shadow line along the top of the walls, the strongest single realism cue on a pitched house.
- **Constants:** `PC.C.ROOF.eave 0.40`, `gableOver 0.25`, `fascia 0.18`. The `roofTiles` UVs extend with the slopes.
- **Cost:** a wider prism + 4 boards, 0 meshes. **Phone risk:** none. Needs the shadow fit (`shadowFit`) to include the overhang (FS check).

## 2. Evening 17.5 h: far grass turning dark olive-brown

**Measured in `sample-evening-1280x800` (T1b, phi 62)**, row averages of the meadow at the screen edges:

| y (px) | noon | morning 8 h | evening 17.5 h |
|---|---|---|---|
| 160 (far) | #83946A | #586648 | #5A5636 |
| 220 | #808D5B | #505A35 | #4C4D2C |
| 300 (near) | #7B8858 | #4D5733 | #494A2A |

The evening meadow has R ≈ G: olive-brown. It is the same at every distance, so the fog (horizon #DFAA81) is not the cause. The plot lawn next to it reads green (#4A6228 in the calculator) because `seasons.summer.ground` #668748 is greener than the meadow `seasons.summer.meadow` = `siteColors.groundOuter` #727E58 (R/G 0.90 against 0.76); under the orange low sun the yellow meadow falls to brown.

### G1 Meadow hexes (MVP, data only)
ACES calculator (`retune.mjs`, top face, sunlit), current keys:

| meadow hex | 8 h | 12 h | 17.5 h |
|---|---|---|---|
| #727E58 (today) | #5D683E | #8E9B68 | #565935 |
| **#6A8550 (proposed)** | #547037 | #85A35F | #4E602F |
| #668748 (= lawn) | #50722F | #81A555 | #4A6228 |

- **Proposal:** `seasons.summer.meadow` = `siteColors.groundOuter` = **#6A8550**; `seasons.spring.meadow` **#6F8A58** (same shift); autumn #857D55 and winter #E4E8EA stay (straw and snow are meant to be warm / pale).
- It keeps the meadow a step duller and lighter than the lawn at noon (#85A35F against #81A555 with the meadow texture base 0.9 against grass 0.86), so the plot edge still reads, and at 17.5 h it reads olive-green instead of brown.
- **Cost:** data only (sky.js, look3d.js). Generated literals that follow: none expected besides data-tables (summer meadow = groundOuter holds); QA oracles that copy groundOuter get the hex from me.
- Sign-off check (when browsers are free): the same row averages at 17.5 h should read G ≥ R + 10 at y 160–300.

## 3. Far meadow looks uniform: subtle variation

Today `textures.meadow = { tileM: 12, base: 0.9, noise: [[3, 0.045], [12, 0.025]] }`: 4 m and 1 m features at ±4.5 % / ±2.5 %. Mipmapping averages the small octave away at distance and the 4 m one repeats every 12 m, so the far field is flat. T1a showed ±8 % at 12 m tiles read as camouflage patches: the fix is bigger features, not more amplitude.

### G2 Larger tile, broader octaves (data only)
- `meadow: { tileM: 48, base: 0.9, noise: [[2, 0.05], [6, 0.035], [24, 0.02]] }`: features 24 m, 8 m and 2 m. One tile covers most of the visible meadow, so no repeat reads; the 24 m swell gives the far field light and dark swathes without patches near the plot.
- Texture size unchanged (512² full / 256² lite): 9.4 cm per texel full, enough for a ground seen past the boundary wall. texgen hash regenerated through its generator.
- **Optional G2b (needs FS + TL ruling on C-3.3 "mostly neutral"):** a ±3 % warm/cool tilt on the 24 m octave only (R +t, B -t), so the swathes also shift hue (dry / lush). Small code in texgen (a `tilt` field per octave); the texture stays near-grey. I recommend G2 alone first and G2b only if the shots still read flat.
- **Cost:** 0 meshes, 0 calls. **Phone risk:** none.

## 4. Maximum house: mostly windowless walls

**Measured (core model, f6t1):** the maximum house footprint is 22.0 x 21.5 m (473 m² per level, 3 above-ground levels). Each level has 10 rooms covering 140 m² in one corner; 54.5 m of each level's 87 m perimeter touches no room (and the brief's 97 of 1194 m² figure points the same way). The T1b rule (Designer A2) only puts openings where a room edge meets the facade, so per level the house has 3 front + 5 left openings and **0 on the back and right**. The sample has 4 gaps (6.0 m on G, 17.5 m on level 1).

### W1 Hall-window rule (MVP)
In `PC.house.openings`, after the room runs on a side: the **free runs** of that side (the side minus the union of room runs and the stair run) are circulation / hall space and get glazed panes too:
- n = max(1, floor((L - endClear) / hallPitch)) panes of the `win` size on a free run of length L ≥ win.w + 2 x endClear, evenly spaced and endClear clear of each run end (the same spacing rule as rooms, a wider pitch);
- **hallPitch 3.9 m** (1.5 x pitch): halls are less glazed than rooms, so a hall run still reads as a hall;
- the door's doorClear filter applies to them as to all openings; heads are clamped as today.
- **Counts (prototype on the core model, scratch only):** maximum house +12 per level (+36, 24 → 60 openings); sample +4 (+1 G, +3 level 1; 20 → 24). At hallPitch 3.2 the maximum house gets +42.
- **Constants:** `PC.C.OPEN.hallPitch 3.9`. Kind 'glazed' (no new decal kind, so no new key).
- **Cost:** each pane is ~8 decal items in roofBatch (glass, reveal, 4 bars, mullion, sill), ~80 triangles: about +3k triangles on the maximum house (19.4k → ~22.5k of 300k), 0 meshes, 0 draw calls.
- **Effects to plan for:** `house.key` changes for any house with a free run (openings are in the key, so caches and the 3D rebuild follow); the house version stays 2 (no new field, TL to confirm); QA's f6-t1-model openings oracle needs the free-run rule (QA owns it).
- **Phone risk:** none.

### W2 String course (optional)
A 0.12 m band 0.02 m proud at every floor line, in `trim`, wrapping the footprint. Breaks a blank facade into storeys even where no window is possible. 4 boxes per level, 0 meshes. Recommended only if W1 shots still show long blank stretches; T1b's slab line already reads as a thin band at Reset (crops), so this is low priority.

## 5. Checks for the T1c gate (Designer sign-off)
After FS lands, I take shots with `verify/shots.mjs --all` into `docs/03-tasks/F6-T1c/shots/` (browser run cleared with the orchestrator first) and sign off:
1. Roof at Reset, 1280x800 and 360x640, sand + white + terracotta, flat and terrace: coping line visible, deck shows seams / tiles, edge band visible, tank and AC read as roof plant.
2. A pitched house at Reset (R5, if taken).
3. Evening 17.5 h: meadow G ≥ R + 10 at y 160–300; O-1 at summer 17.5 h stays ≥ 15 000 px (today 27 746 at phi 62).
4. Far meadow at noon: visible large-scale swathes, no patch repeat near the plot.
5. Maximum house: every facade at Reset has openings; sample unchanged in character.

## 6. Questions for the TL review
- Q1: R3 as deck vertex colours or as shaded strips in roofBatch? (Designer: either; strips are less code.)
- Q2: R2's deck mesh: one mesh for both membrane and terrace tiles (the material swaps the map at build) or two meshes? (Designer: one mesh, the map chosen at build; no texture change in `applyLook`.)
- Q3: W1 changes the sample's `house.key` and openings (20 → 24): acceptable, or limit W1 to free runs ≥ 4 m? (Designer: accept; the 4 sample panes are realistic hall windows.)
- Q4: G2b's tinted octave against C-3.3: allowed as an optional follow-up?
- Q5: R4 and R5 in T1c, or kept for a later batch if the gate time is tight? (Designer: R4 in, R5 in if a pitched house is in the shot set; both are boxes only.)
