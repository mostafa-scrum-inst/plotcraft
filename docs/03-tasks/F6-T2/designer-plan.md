# F6-T2 Designer plan: richer interiors and evening indoor light

Date: 2026-11-23. Author: Designer. Source: client feedback (Mostafa, 2026-11-23): "the interior models are very dull and there is no lighting for evening time in the house too". Binding: `docs/03-tasks/F6-T2/cto-constraints.md` (650dba3) on top of `docs/03-tasks/F6-T1/cto-constraints.md`. For TL plan review.

## 0. Audit of today's interior (before-shots)

48 shots on real r128, base 55d5f7d (F6-T1c merged), in `before/`, made by `verify/shots.mjs` (sample + maximum house, summer; 1280x800 and 360x640):
- Dollhouse views: Roof off, level G and level 1, at noon, dusk 19.5 h and night 22 h: `{house}-lv{G|1}-{noon|dusk|night}-{vp}.jpg`.
- Exteriors after sunset: Roof on, 19.5 h and 22 h: `{house}-ext-{dusk|night}-{vp}.jpg`.
- Room close-ups through "Go to room", highlight hidden: living G, bedroom 1, kitchen G, majlis G, at noon and 22 h: `{house}-room-{type}-{level}-{noon|night}-{vp}.jpg`.

What makes it dull:
1. **Every piece is one box in one flat colour.** A sofa is a dark slab; beds are dark blocks with no mattress, pillows or headboard; tables are solid cubes; armchairs are orange cubes. Nothing has legs, cushions, doors or tops.
2. **One palette for the whole house.** All rooms take the same six Q18 keys (fabric, wood, accent, white, metal, dark), so the living room, bedroom and majlis look alike. The modern style's dark fabric (#3B4652) makes every sofa and bed a black hole from above.
3. **Floors are flat pastel tints** (`roomTints`, the 2D colour code, mixed 10–15 % with wood). They have no material: no boards, tiles or carpet, and no rugs.
4. **At night nothing is lit.** At 19.5 h and 22 h the whole house turns moonlit blue-grey, inside and out. Windows read as dark slate (the opaque glass gradient under a blue hemisphere). There is no sign anyone lives there: no lamps, no glowing windows, no light on the ground.

## 1. Summary, MVP and budget

Ranked by visual impact per cost. **MVP = N1, N2, N3, N4, I1, I2, I3.** Section 5 has the alternatives the TL may prefer.

| # | Item | Impact | Meshes (max house) | Triangles (max) | Texture | Phone risk |
|---|---|---|---|---|---|---|
| N1 | `indoor` 0–1 per sky key: the on/off rule | enables N2–N5 | 0 | 0 | none | none |
| N2 | Lit windows: emissive on a separate `glazing` mesh | very high (exterior at night) | +1 | 0 (moved) | none | low |
| N3 | Night lift: warm emissive on floors and furniture | high (dollhouse at night) | 0 | 0 | none | none |
| N4 | Light pools: `glow-<level>` additive quads (lamp pools, room pools, lit-window patches, ground spill) | very high | +1 per level (+4) | ~+0.8k | reuses `blob` | **medium** (overdraw; lite hides) |
| N5 | Lamp parts: table lamps on side tables and desks, gate lamps; `lamps-<level>` | high | +1 per level (+4) | ~+1.5k | none | low |
| I1 | Furniture parts from shared templates | very high (day and night) | 0 (plain) | ~+16k | none | low |
| I2 | Floor materials (boards / tiles / carpet) and rugs on a `textured-<level>` mesh with one interior atlas | very high | +1 per level (+4) | ~+1k | +1 atlas 512² (1.4 MB) | low |
| I3 | Room palettes: per-room fabric / accent under each Q18 style | high | 0 | 0 | none | none |

**Maximum house totals, full tier, 22 h, Roof on** (CTO §3 targets in brackets):
- meshes 27 → **40** (≤ 40): the per-level additions are textured, lamps and glow (3 × 4 levels), plus glazing;
- draw calls about 27 → **44**, with shadow-update frames about **48** (≤ 80);
- triangles 22.4k → about **42k**, counting parts twice for the shadow pass (≤ 120k);
- textures 4 → **5** (6 with pitched `tiles`), 4.02 → about **5.4 MB** (≤ 6 / 8 MB);
- build: about +40 ms on the C-4.8 solo step (166 → ~210 ms, against ≤ 250 ms). This is my estimate; FS measures it;
- dist: Designer data about +4.5 kB (part templates 2 kB, palettes 1.5 kB, texture spec 0.4 kB, sky `indoor` 0.2 kB).

A level without pieces or lamps gets no textured / lamps / glow mesh, as furniture works today. No light, no shader, no extra transparency in the C-2 sense (glow is additive, CTO 1.2d).

## 2. Evening / night indoor light

### N1 When the lights are on: `indoor` per sky key (data)
A new key field `indoor` (0–1), blended like the others (A-13). I recommend this over a sun-elevation rule: people switch lights on by clock and daylight together, and the keys already encode daylight per hour.

| h | 0 | 4.5 | 6 | 7.5 | 12 | 16 | 17 | 18 | 19.5 | 21 | 24 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| indoor | 0.6 | 0.3 | 0.2 | 0 | 0 | 0 | 0 | 0.35 | 1 | 1 | 0.6 |

- Presets: morning 8 h → 0, noon → 0, evening 17.5 h → 0.18 (the first lamps at golden hour), night 22 h → **0.87**.
- After midnight, fewer lights: 0.6 at 0 h, falling to 0.3 before dawn. A 6 h kitchen light (0.2) fades out by 7.5 h.
- One factor scales every indoor emission (N2–N5): `emissiveIntensity = base × indoor` and glow `color × indoor`. At 0 the glow meshes are hidden (`visible = indoor > 0`), so day frames cost nothing.

### N2 Lit windows
- **Geometry:** the T1b glass decals (kind 'glass') move out of roofBatch into their own **`glazing`** mesh in the `roof` group, with the same vertex-colour gradient (glassTop → glassBottom) and the same visibility (exterior mode).
  - Reason: emissive is per material, and roofBatch also holds walls, slab and roof.
  - Material: the glazing material, with `emissive` set from build time, `emissiveIntensity` = 0 by day.
- **Look:** `emissive` **#FFB866**, `emissiveIntensity = 0.9 × indoor`. Under ACES at 22 h (exposure 1.3, indoor 0.87) the pane reads about **#E8C68A**, a warm cream. At 1.0 it reads #EBCD93.
  - It stays clearly apart from the highlight (#C2410C, `toneMapped: false`), which is a saturated red-orange (CTO 1.5).
- **Variation** (not every window equally lit) comes from N4's window patches, not from an emissiveMap (CTO 1.2a). Every pane gets the base glow, which reads as curtained windows; the patches make some panes bright.

### N3 Night lift on floors and furniture
- `emissive` **#FFB070** on the plain furniture, textured and floor materials, `emissiveIntensity = 0.08 × indoor`.
- ACES at 22 h: oak floor #2A231E → **#6C4931**, light tile #414F6B (moonlit blue) → **#7A6B75**, dark sofa → #573528. Rooms read as warm interiors instead of blue boxes; the pools (N4) then give the bright spots.
- Walls inside stay unlifted, so the cut tops still read as structure.

### N4 Light pools: `glow-<level>` (full tier only)
- **Mesh:** one InstancedMesh of face-up or wall-facing quads per level.
  - Map: the existing **`blob` texture** (radial (1 − r)^1.5), so there is no new texture.
  - Material: `AdditiveBlending`, `depthWrite: false`, no shadows. Colour **#FFB870** × `poolK` × indoor, set in applyLook.
- **Instance order** sets what each mode draws through `count`, the same pattern as the blobs in winter:
  1. Ground spill outside lit windows on level G: a 2.0 × 1.4 m quad on the ground in front of each lit ground-floor pane, `poolK` 0.12. Shown in both modes.
  2. Floor pools: one per lamp, diameter 2.2 m centred on the lamp, `poolK` 0.20; one per habitable room without a lamp, diameter 0.6 × min(w, d), centred, `poolK` 0.14. Dollhouse mode only.
  3. Lit-window patches: a quad 0.01 m outside each **lit** pane, pane-sized + 0.1 m, `poolK` 0.35. Exterior mode only.
  - Exterior mode: count = 1 + 3. Dollhouse: count = 1 + 2. FS sets the ranges at build; applyLook and the Roof switch only change `count` and `visible`.
- **Which panes are lit:** seeded per opening from `house.key`.
  - Habitable and hall panes: 75 % lit.
  - Service rooms ('small'): 40 %.
  - Stair slots: always lit.
  - The front door's side panes: always lit.
  - Data: `PC.data.indoor.litShare = { glazed: 0.75, small: 0.4, slot: 1 }`.
- **ACES reads** (display-space add; the mean of the falloff is lower than the centre):
  - floor pool centre (0.20): oak at night → **#C28951**, tile → **#D9B59E**;
  - window patch (0.35): the pane → near **#F5DDB0**, lit panes clearly brighter than curtained ones.
- **Lite:** glow hidden (CTO 1.6). The lite night still has N2, N3 and N5.
- **Phone risk: medium.** About 200 instances on the maximum house, mostly small and seen from far off; the overdraw is the cost. That is why lite hides it.

### N5 Lamps: `lamps-<level>`
- **Pieces:** lamp parts sit on existing pieces, inside their envelopes (CTO 2.1 and 2.2; heights ≤ 1.1 m):
  - bedroom `sideL` / `sideR`;
  - living `sideTable`;
  - majlis `sideFL` / `sideFR`;
  - office `desk`;
  - maid `desk`.
  - Each of these pieces' `h` rises to fit the lamp (side tables 0.5 → 0.95; the desk lamp at the back-left corner of the desk top). Placement does not change, because A-11 judges `w × d`.
- **Lamp template:** a base 0.12 × 0.12 × 0.05 (metal), a stem 0.03 × 0.03 × 0.2 (metal), and a shade 0.26 × 0.26 × 0.2 (`lamp` material). Three boxes; only the shade is on the lamps batch.
- **Lamp material:** colour **#F2EBDD** (a linen shade by day), emissive **#FFD9A8**, `emissiveIntensity = 1.4 × indoor`. It reads **#F0E7D6** at 22 h, the brightest warm point in each room. No shadows.
- **Gate lamps:** two shade-only cubes 0.25 m on top of the gate posts (`lamps-G`). Each has a ground spill pool (N4 group 1) at `poolK` 0.12, marking the entrance at night.
- **Phone risk:** low.

## 3. Richer interiors

### I1 Furniture parts from shared templates
- **Schema** (CTO 2.1):
  - a piece names a template, `parts: 'sofa'`, which the core expands into `[{ x, z, y0, w, d, h, color, mat }]` in **fractions of the piece's w, d and h**, scaled with the piece;
  - `x` runs along w; `z` is 0 at the room-facing front and 1 at the anchor wall;
  - `color` is a role (`main` = the piece's Q18 key, or another Q18 key), with optional `k`, a value factor;
  - `mat`: `plain`, `tex` (atlas cell `weave` or `planks`) or `lamp`;
  - a piece without `parts` stays one box, as today.
- **Envelope rule:** every part has 0 ≤ x, x + w ≤ 1, the same for z and y, so parts always stay inside the envelope. A unit test checks every template.

| template | parts (x, z, y as fractions; size) | used by |
|---|---|---|
| `sofa` | plinth dark (0.03–0.97, 0.05–0.95, 0–0.1); seat main tex (0–1, 0–0.8, 0.1–0.55); back main k0.9 tex (0–1, 0.78–1, 0.1–1); arms main k0.9 tex (0–0.1 and 0.9–1, 0–0.78, 0.1–0.8); 2 cushions main k1.08 tex (0.1–0.5, 0.5–0.9 × 0.05–0.75 × 0.55–0.68) | living sofa, armchairs (1 cushion: `chair1`) |
| `bed` | frame wood tex-planks (0–1, 0–1, 0–0.3); mattress white tex (0.03–0.97, 0.03–0.92, 0.3–0.5); duvet main tex (0.02–0.98, 0–0.62, 0.45–0.56); 2 pillows white k1.04 (0.08–0.46 and 0.54–0.92, 0.72–0.9, 0.5–0.62); headboard main k0.85 tex (0–1, 0.94–1, 0–1) | bedroom bed (h 0.5 → 1.0), maid bed (1 pillow: `bed1`) |
| `table` | top wood tex-planks (0–1, 0–1, 0.92–1); 4 legs wood k0.85 (0.06 × 0.06 at the inset corners, 0–0.92) | dining table, coffee table, low table, desk, island (as `counter` when h ≥ 0.85 and placed against a wall) |
| `chair` | 4 legs dark (0.08 sq, 0–0.5); seat main tex (0.05–0.95, 0.05–0.9, 0.5–0.58); back main (0.05–0.95, 0.86–0.96, 0.58–1) | dining chairs, office chair, maid chair, kitchen stools (back omitted: `stool`) |
| `cabinet` | plinth dark (0.03–0.97, 0.1–1, 0–0.05); body main tex-planks (0–1, 0.05–1, 0.05–1); 2 door faces main k1.06 (0.02–0.49 and 0.51–0.98, 0–0.05, 0.07–0.97); 2 handles metal (0.04 × 0.02 × 0.12 at the meeting stiles) | wardrobe, dresser, pantry, cupboard, cabinets, sideboard, shelves (open: 3 shelf boards instead of doors: `shelves`) |
| `counter` | plinth dark (0–1, 0.08–1, 0–0.08); body main (0–1, 0.02–1, 0.08–0.92); worktop dark k1.2 (0–1, 0–1, 0.92–1); door lines main k0.94 (3 faces per 0.6 m of w) | kitchen counter, side counter, washer / dryer (no worktop; a dark round-ish door face: `appliance`) |
| `fridge` | body metal (0–1, 0–1, 0–1); split line dark (0–1, 0–0.02, 0.64–0.66); handle dark (0.85–0.9, 0–0.03, 0.4–0.9) | fridge |
| `media` | unit dark (0–1, 0.2–1, 0–0.45); screen #0E1114 (0.1–0.9, 0.55–0.62, 0.5–1) | tvUnit (h 0.5 → 1.1) |
| `floorSeat` | seat main tex (0–1, 0–1, 0–0.5); back cushions main k0.88 tex (0–1, 0.75–1, 0.5–1); accent bolster cushions every 0.8 m (0.2 w, 0.6–0.75 z, 0.5–0.8) | majlis seats (h 0.35 → 0.7) |
| `bath` | toilet: base white (0.2–0.8, 0–0.7, 0–0.6), tank white (0–1, 0.75–1, 0–1), seat white k0.96; basin: pedestal white (0.3–0.7, 0.4–1, 0–0.85), bowl white (0–1, 0–1, 0.85–1); shower: tray white, drain dark | bathroom set |
| `lamp` | see N5 | added to side tables and desks |

- **Counts:** about 6 boxes per piece on average. The maximum house has 220 pieces, so about 1 300 boxes, ~16k triangles (×2 in the shadow pass).
- **Q19:** sparse and full keep their piece lists, so counts per type change only by parts.
- **Q18:** changes colours only (roles resolve through the style and I3). Boxes never change.
- **Height changes:** bed 1.0, tvUnit 1.1, majlis seats 0.7, side tables 0.95. All stay ≤ 1.1 m.

### I2 Floors and rugs: one interior atlas on a `textured-<level>` mesh
- **Atlas** `interior`: 512², a 2 × 2 grid of 256² cells, each 240 px of tileable content plus 8 px of wrapped padding, so bilinear sampling and the first mip levels never bleed. All cells are neutral grey (C-3.3).

| cell | spec | tileM |
|---|---|---|
| `planks` | boards 0.15 m wide (8 per tile), staggered ends seeded per board, seam −0.25 (1 px), per-board ±0.06, lengthwise grain noise ±0.04 | 1.2 m |
| `tile` | 2 × 2 tiles of 0.6 m, grout −0.30 (2 px), per-tile ±0.03, soft mottle [[3, 0.04]] (marble / concrete) | 1.2 m |
| `carpet` | tufted noise [[16, 0.05], [64, 0.06]], base 0.85 | 0.5 m |
| `weave` | fabric crosshatch ±0.05 at a 2 px period, noise 0.03 | mapped once per face (stretched; see below) |

- **Floors move** from the slab batch's tint quads into `textured-<level>`, split at tile boundaries so UVs stay inside one cell, and keep the T1b ring darkening as vertex colours. Floor kind and colour per room type:

| style | planks (living, dining, bedroom, office, hall) | tile (kitchen, bathroom, laundry, storage, maid) | carpet (majlis) |
|---|---|---|---|
| modern | #8A6E55 smoked oak | #B9B7B2 grey porcelain | #6B5A4C taupe |
| classic | #9A6A44 honey walnut | #D8CBB4 cream marble | #7A2F2C deep red |
| minimal | #C9AE86 light oak | #E3E1DC white-grey | #A89C88 sand |

  The 2D room colour stays as a 12 % tint mix (`floorTint 0.12`), so rooms keep a hint of their plan colour. The finder caption and highlight do the identifying in 3D.

- **Rugs:** a carpet-cell quad 0.004 m above the floor, centred under the living coffee table (0.55 w × 0.5 d of the room, clamped to 2.4 × 1.7 m), at the foot of each bedroom bed (1.6 × 1.0 m), and under the dining table (table + 0.6 m each side). Colour = the room's I3 accent mixed 50 % with its fabric. Rugs are floor decoration, not A-11 pieces, so placement does not change.
- **Furniture tex parts:** on the same mesh, each face maps the whole `weave` or `planks` cell once (stretched, no repeat, no subdivision). At 256 px over a 2.2 m sofa that is under 1 cm per texel, more than enough from the dollhouse.
- **Material:** Lambert or Standard (roughness 0.9) with `map` = atlas, vertex colours (tints and parts), emissive N3. Casts and receives.
- **Colours** are targets under ACES at noon; I retune them with `retune.mjs` in T2a and regenerate any generated literals through their generators.
- **Lite:** the atlas at 256² (128² cells).
- **Phone risk:** low (one textured material per level).

### I3 Room palettes under each Q18 style
- `PC.data.interiors[style].rooms[type] = { fabric, accent }` overrides the style's fabric / accent for that room type. Every other key falls back to the style.
- The Q18 hint chips (43-stage-interior.css) keep showing the style base, so the CSS / look3d equality test is unchanged.

| style | bedroom | living | majlis | dining | office |
|---|---|---|---|---|---|
| modern | #5C6B7A / #D9A441 | (base) #3B4652 / #C8742F | #7A2E2E / #C9A54A | #8A7E70 / (base) | #2F3A44 / #4F7A6A |
| classic | #CDB8A6 / #6E4A6B | (base) | #8E3B33 / #B08D45 | #A6845C / (base) | #4A3A2C / #2F4A3A |
| minimal | #DCD9D2 / #8FA698 | (base) | #B9A48A / #6F8A7A | #E0DDD6 / (base) | #9AA3A8 / #C8A878 |

- **Reading of the table:** each cell gives fabric / accent; "(base)" means the style's own value.
- **Why:** the bedroom duvet, the majlis seating (deep red and gold in modern and classic, the Gulf majlis), the dining chairs and the office each get their own identity.
- **Modern living:** the sofa body takes the cushion tone k1.08 on the dark fabric, so it no longer reads as a hole.
- **Cost:** data only, about 1.5 kB.

## 4. Sign-off checks (Designer, after FS lands; short shot runs as cleared)
I re-run `verify/shots.mjs` into `docs/03-tasks/F6-T2/shots/` and judge:
1. **Day, room close-ups:** every bed shows mattress, duvet, pillows and headboard; sofas show seat, back, arms and cushions; tables have legs; floors show boards, tiles or carpet; rugs under the living and dining tables; rooms differ in palette.
2. **22 h, Roof on:** ~75 % of habitable panes bright warm, the rest a soft glow; ground spill under the ground-floor windows and at the gate. The highlight stays a distinct red-orange.
3. **22 h, dollhouse:** warm floor pools around lamps and room centres; bright lamp shades; the outside stays moonlit blue.
4. **19.5 h and 17.5 h:** the transition reads (some glow at 17.5 h, full at 19.5 h).
5. **Lite tier at 22 h:** no pools, but still clearly lit windows and lamps.

The pixel checks (luma order noon > evening > night, the O-1 shadow check, winter canopy) must hold. The night luma rises with N2–N5, so the TL may need to restate "night is darkest" as the **outdoor** ground luma at 22 h (before/after numbers in the impl review).

## 5. Questions for the TL review
- **Q1:** N1 `indoor` per sky key (recommended) or a sun-elevation rule?
- **Q2:** N2 needs glass out of roofBatch into its own `glazing` mesh (+1). This is within the CTO's "+1" (27 + 3 per level + 1 = 40).
- **Q3:** N4's window patches and ground spill ride in `glow-<level>` with `count` ranges by mode (the blobs pattern). OK, or a separate exterior glow mesh (over the 40 budget)?
- **Q4:** I2 moves floor tints from pastel room colours to real floor materials with a 12 % tint. This is a visible 2D↔3D change (A-10 roomTints); a PM look check is advised.
- **Q5:** the I1 envelope heights rise (bed 1.0, tvUnit 1.1, majlis seats 0.7, side tables 0.95), all ≤ 1.1 m. A-11 text amendment by the TL.
- **Q6:** the one-atlas approach (1 texture, cells with padding) versus separate textures plus more meshes. The atlas is the only way to keep 3 materials per level (CTO 2.3) with three floor kinds.
- **Q7:** "night is darkest" pixel checks: restate as outdoor ground luma (see §4)?
