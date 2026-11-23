# F6-T2 implementation notes (FS, branch f6t2)

**Base:** main 650dba3.
**Plan:** `plan.md` (511ca40).

## S0: build comment strip (CTO §5), ee6e336

See plan §0 for what is stripped and how it is made safe.

**Size:**

| | before | after |
|---|---|---|
| `dist/index.html` | 605 023 B | **494 146 B** (108.3 kB of comments stripped) |
| gzip | 171.6 kB | 126.3 kB |
| headroom under C-1.3 (627 302 B, unchanged) | 22.3 kB | 133.2 kB |

The build takes 0.14 s.

**Gate on the stripped build** (quiet machine, all green):

| run | wall | three step |
|---|---|---|
| default 1 | 415.6 s | 16.1 s |
| default 2 | 417.1 s | 16.7 s |
| default 3 | 410.0 s | 16.5 s |

- **Default runs:** the median is **415.6 s**, against the limit of 420 s; no run was over 440 s.
  - On main the median was 406.5 s, with three-step times of 15.8 to 16.9 s.
  - These runs are slower in the CPU-only three step as well, so the difference reads as a slower machine. The strip only changes the page bytes.
- **QA_FULL=1 with QA_RELEASE=1:** green, 723.2 s in all, of which the release step took 260.2 s. That puts the QA_FULL part at about 463 s, against the limit of 480 s.
  - The C-4.8 solo step's best of 3 was 147 ms (203, 163, 147).
  - The loaded build was 944 ms, against the 1200 ms guard.
  - Texgen C-3.2's best of 3 was 91.9 ms.
- **Release step on its own (`--only leak-max`):** stream plus stream rows 244.7 s, release rows 240.6 s, wall time 244.7 s.
  - On main the same step took 243.5 s and 239.7 s.
  - The 260.2 s NOTE came only when the release step ran straight after a QA_FULL pool, on a warm machine.

**Readers:** the lint layer scan and QA's f1-t1-static order check use the `/* js/... */` file markers, which are kept. f1-t1-static passes 231/0, including its dist-versus-src `localStorage` count.

## S1: furniture parts, room palettes, indoor key (8133336)

- `PC.house` v4: each furniture piece carries `parts` [{u, v, w, d, y0, h, color, mat}] built from the 19 templates in `PC.data.furnitureParts` ([x0, x1, z0, z1, y0, y1, role, k, mat]).
  - The back comes from the anchor. `face` overrides it (front / left / right).
  - The Designer accepted these deviations: deskLamp 1.1 m, sideLamp 0.95 m, counter faces and bolsters, coplanar trims, chair faces. The shower drain follow-up is 16ec62c.
- Room palettes: `PC.data.interiors[style].rooms`. Sky keys gain `indoor`; `PC.sky.compute().indoor` is a lerp with no season blend.
- Tests: furnish.test (template z-fight, envelope, orientation on the maximum house's dining rooms, palettes), the sky.test indoor row, data-tables, and openings at v 4.

## S2 + S3: atlas floors, glazing, night lift, lamps, glow (d4ce366)

S2 and S3 landed as **one commit**, not two. The glazing split and the floor split both touch build-roof/build-shell and the same test files (detail, budget, interior), so neither half was green on its own.

- **Interior atlas** (texgen kind `interior`): 2 x 2 cells (planks, tile, carpet, weave) with 240/256 px of content and 8 px of wrapped padding. `PC.texgen.cells(size)` gives the layout, and `three.atlasCells` insets it by half a texel.
  - Goldens: 512 `33c6a948`, 256 `1d6e64ef`.
- **textured-&lt;level&gt;:**
  - hall planks (TL F1);
  - room floors 0.01 m above the hall, split on the tile grid, with the ring as a vertex-colour factor;
  - rugs another 0.01 m above;
  - tex parts mapped with addCellBox.
  - Floor tints and rings are no longer in the slab batch.
- **Glazing:** a mesh in the roof group, with the glass moved out of roofBatch. It receives shadows and does not cast. `userData.panes`; `three.litPane` is seeded per opening.
- **Furniture:** its own Lambert material.
- **lamps-&lt;level&gt;:** no shadows. The gate lamps are in **lamps-G** (TL F2 first choice). The glazing fallback was not needed, and the Designer has not objected.
- **glow-&lt;level&gt;:** full tier only, additive, on the blob map. The blob texture is now RGB 255, and the blob shadows keep their black through their colour. Instances are [pools][spill][patches]. The count is pools+spill in dollhouse or with a level selected, and all instances in exterior.
- **Emissive:** set at build. intensity = factor x indoor, so it is 0 by day. No new lights.
- **Precompile:** `renderer.compile` runs after build with the glow shown.
- **Shadows (TL F4):** apply() marks them dirty only when the signature changes (sun position, intensity, shadow-camera bounds, canopy visibility). Build, restore, level, Roof and re-fit stay unconditional.
- **Counts:**

  | measure | value |
  |---|---|
  | max house meshes | 40 (41 with the highlight) |
  | lite meshes | 36 |
  | sample meshes | 28 |
  | veg0 meshes | 24 |
  | materials | 18 |
  | textures | flat roof 6, walkable 5 |
  | real r128 calls, 12 h / 22 h | 36 / 40 |
  | triangles | 40.5k |
  | programs | 11 |

- **Mutations caught (mock):** no half-texel inset; an indoor-only change updating shadows; no precompile; patches in dollhouse; glow in lite; glow outside its level; glow not additive; a lamp not driven.

## S4: real-r128 checks (58c42bf)

These run in view3d-real, in the 1280x800 max-house scene.
- **Program count** unchanged from 12 h to 22 h, in full and in lite.
- **Lit panes** brighter at 22 h, over 48 first-hit pane points.
- **Highlight:** hue #C2410C ±15, luma at least 0.15 away from the lit panes (3384 px).
- **Atlas seams (TL F3):** Ground living room at noon, Roof off. The boundary is **2.97** levels over 8 lines, within the limit of 4 and of 1.5 x the in-cell max (7.65).
- **Outdoor ground luma (TL ruling 7):** noon > evening > night, read outside the plot. The whole-frame order check is kept as well.
- **Budget record:** 36 / 40520 at 12 h, 40 / 40720 at 22 h.
- **Mock:** the Lambert whitelist is split, so only MeshLambertMaterial takes `emissive`.

**Time:** view3d-real solo went from 32.8 s (main 6968d00, twice) to 39.5–40.2 s, **+7 s**, within the +10 s budget.
- The T2 scene alone costs about +2.7 s.
- The checks were trimmed to fit: the ground points are raycast once and reused across the hours, the room flight is 1 ms, and the seam sampling step is 0.15 m.

**Mutations (real r128):**
- **Interior pad 0:** caught. The seam check fails at **4.11** > 4. The margin is thin (2.97 against 4.11), so the seam rule mostly catches the mip bleed at this pose.
- **apply() never marking shadows dirty:** caught by the on-demand stale check (2281 px at 1280, 3446 px at phone@3).
- **Only the sun fields dropped from the signature:** *not* caught, and no check can tell. The shadow camera re-fits to the sun, so its bounds change with the sun direction and the signature still changes. The sun fields are kept as a guard.

**Dist:** 494 146 B after S0, **519 432 B** at T2 (+25 286 B).

## Designer retune (100dc9d) and PM Q4

- **Designer retune:** indoor.lift is #FFC08A x 0.06 and floors.tint is 0.2. The real-r128 seams are 2.90.
- **PM Q4:** approved at tint 0.2. The hall moves off planks: `PC.data.floors.kind.hall = 'tile'`. The Designer picked tile with no hex change, and the hall keeps its neutral #D9D6CE tint against the kitchen's yellow.
  - build-interior now follows `FL.kind.hall`. The detail test asserts that the hall is not planks and that its UVs sit in that kind's cell.
  - This replaces TL F1 ("the hall gets planks") by the PM's decision.
