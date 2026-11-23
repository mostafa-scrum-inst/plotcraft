# F6-T2 FS plan: richer interiors and evening indoor light

- **Date:** 2026-11-23.
- **Author:** FS.
- **Inputs:**
  - the CTO constraints `cto-constraints.md` (650dba3), on top of the F6-T1 constraints;
  - the Designer plan `designer-plan.md` (3371175, with the amendments up to 16d7bb7, including the CTO atlas-tiling condition);
  - the TL review `designer-plan-review.md` (APPROVED), with its PM addendum.
- **Branch:** `f6t2`, from main 650dba3 (worktree `/home/user/plotcraft-f6t2`).

## 0. Order of work

| step | content | gate before the next step |
|---|---|---|
| **S0** | comment strip in the build (CTO §5) | TL review of S0, with its own size line |
| S1 | data and core: `indoor` key, part templates, room palettes, lamp data, house v 4 | node green |
| S2 | interiors: parts, `textured-<level>` with the atlas, rugs | node green, mutations |
| S3 | evening light: glazing, night lift, `lamps-<level>`, `glow-<level>` | node green, mutations |
| S4 | real-r128 checks in `view3d-real`, budgets, gate | the full gate (§7) |

- S1 to S3 land as separate commits, so the TL can review each one.
- The Designer retunes with `retune.mjs` after S3 and signs off on the shots (designer plan §4).

### S0: comment strip (done on f6t2, ee6e336; for TL review)
- **What is stripped:** `build-strip.mjs` removes, from inlined JS only:
  - whole lines whose first non-blank characters are `//`;
  - `/* … */` blocks that start a line after whitespace. When code follows the `*/` on its last line, that code is kept.
- **What is untouched:** CSS, HTML and `src/`. The `/* js/… */` file markers that `build.mjs` writes stay, because the lint layer scan and QA's order check read them.
- **Safety: V8 judges each candidate, not a hand-written lexer.**
  - The probe: a `\u0001` is put where the candidate comment starts, and the original script is parsed with `new vm.Script`.
  - Only a syntax error on exactly that line counts as code. The probe character is legal inside a string, a template literal or a block comment, so such lines are kept.
  - Every script must parse before and after the strip, or the build exits with an error.
- **Tests (`lint.test`):**
  - strings, template-literal lines, string continuations and regexes that hold `//` or `/*` come through byte for byte;
  - trailing comments are kept;
  - a block that ends mid-line keeps its code;
  - the values are the same before and after (run in a `Function`);
  - a bad script fails the build;
  - every dist script parses and keeps its marker, and nothing is left to strip.
- **Mutations:**

  | mutation | caught by |
  |---|---|
  | probe off, every candidate taken as code | the strings/templates case |
  | the code after `*/` dropped | the same case |

- **Size:**

  | | before | after |
  |---|---|---|
  | dist | 605 023 B | **494 146 B** (108.3 kB stripped) |
  | gzip | 171.6 kB | 126.3 kB |

  That leaves 133 kB under C-1.3 (627 302 B), which stays the limit. F6-T2 reports its own size delta separately (§6).
- **Build time:** 0.14 s.
- **Gate:** the three-run median, QA_FULL and the release step on the stripped build, before any feature code. Numbers go in the impl notes.

## 1. N1: `indoor` per sky key (data, A-13)
- **Data:** `PC.data.sky` keys gain `indoor` with the Designer's row (0 h 0.6 … 24 h 0.6). `PC.sky.compute` blends it like every other field, and `L.indoor` lies in [0, 1].
- **Sky golden:** regenerated through its generator. The only rows that change are the new `indoor` column (TL ruling 1). A test checks that every other column is equal to its pre-T2 value at all preset hours.
- **`applyLook`** sets every indoor term from `L.indoor` (§3). It creates nothing and never touches the camera.
- **Shadow updates (CTO §4).**
  - Today `apply()` calls `shadowsDirty()` on every look.
  - Change: `applyLook` returns `{ shadow }`. It is true when the sun's position, colour or intensity, or the shadow camera, changed against the last applied values (read back from `ctx.sun`, so nothing new is stored).
  - `apply()` marks the shadow map dirty only then. Builds, resizes, the level selector, Roof and restore are unchanged.
  - **Mock test:** applying the same look with only `indoor` changed leaves `shadowUpdates` unchanged.

## 2. Interiors

### I1 parts (core, `PC.furnish`)
- **Data:**
  - `PC.data.furnitureParts`: the Designer's templates (`sofa`, `chair1`, `bed`, `bed1`, `table`, `counter`, `chair`, `stool`, `cabinet`, `shelves`, `appliance`, `fridge`, `media`, `floorSeat`, `bath`, `lamp`) as arrays `[x0, x1, z0, z1, y0, y1, role, k, mat]`, in fractions.
  - Furniture rows gain `parts: '<template>'` and the new heights (bed 1.0, tvUnit 1.1, majlis seats 0.7, side tables 0.95; TL ruling 5).
- **Placement:** `PC.furnish.room` is unchanged; it places the envelopes.
- **`PC.house.build`** expands each piece:
  - `parts: [{ u, v, w, d, y0, h, color, mat }]`, in frame L;
  - rotated with the piece's orientation, where `z` = 0 at the front (room side) and 1 at the anchor wall;
  - colours resolved through the style and the I3 room palette, times `k` (`PC.three.col` is not used in core; the hex is scaled in core with a small pure `shade(hex, k)`).
- **House version:** `house.v` becomes 4, because the parts are in the key. The layout golden does not change.
- **Unit tests:**
  - every part of every type, at S/M/L and in the 1.5 m minimum room, lies inside its envelope (1e-9);
  - Q18 changes colours only, never parts or boxes;
  - Q19: sparse has fewer pieces than full for every type;
  - a piece without `parts` stays one box.
- **Readers (A-16):**
  - `furnish`, `house` and `layout` unit tests;
  - QA's placement oracle, which judges envelopes, so it stays valid;
  - the furniture counts in `detail`, `budget` and `interior`;
  - `data-tables`.

### I2 floors, rugs and the interior atlas
- **Texgen kind `interior`:** 512², a 2 × 2 grid of 256² cells. Each cell has 240 px of content plus 8 px of wrapped padding; the cells are `planks`, `tile`, `carpet` and `weave` (Designer table).
  - `PC.texgen.KINDS` gains `interior`.
  - The lite tier gets 256² (128² cells).
  - **texgen.test:** a golden for the kind; every cell mean within ±0.05 of the others (TL Q6); padding equal to the wrapped edge.
- **Mesh `textured-<level>`:** one per level that has rooms, in the level group.
  - Material `mats.interior`: Lambert, with `map` = atlas, `vertexColors`, and an emissive present from build time (§3 N3).
  - Casts and receives shadows.
- **BoxBatch:** gains a cell-UV mode.
  - `addCellQuad(pts, y, rgbs, cell)` maps one face-up quad onto `cell` with a half-texel inset.
  - `addCellBox(…, cell)` maps every face of a box onto `cell` once.
  - The cell rectangles come from `PC.texgen.cells('interior', size)`, so the texture and the UVs share one source.
- **Floors (CTO atlas condition):**
  - The room tint quads and the T1b floor rings leave the slab batch.
  - Every floor is split into `tileM` sub-quads of its cell, each mapped onto the cell with the half-texel inset. Edge quads are clipped, with UVs scaled to match.
  - The ring darkening stays as vertex colours.
  - The floor colour is the Designer's per-style kind colour, mixed with the room tint at `floorTint` 0.12 (PM fallback: 0.35 per failing type, in data only).
  - The hall top face of the slab keeps its tint (slab batch) unless the Designer puts the hall on planks. In that case the hall becomes one more floor in `textured`.
- **Rugs:** carpet-cell quads 0.004 m above the floor, at the Designer's three positions. They are decoration, not A-11 pieces.
- **Furniture parts with `mat: 'tex'`** go to `textured-<level>` (one cell per face); parts with `mat: 'plain'` go to `furniture`.
- **Tests:**
  - mock: every `textured` UV lies inside its cell rectangle minus the inset;
  - mock: floor sub-quads tile the room area exactly (sum of areas, no overlaps);
  - real r128 (§4): no neighbouring-cell seam colour at Reset.

### I3 room palettes
- `PC.data.interiors[style].rooms[type] = { fabric, accent }` overrides the style's fabric and accent per room type. The resolution happens in core, at piece expansion.
- The Q18 chips and the CSS/look3d equality test are unchanged, because the chips show the style base.
- `data-tables` gets the new keys.

## 3. Evening light

**Shared rule:** every emissive material gets its `emissive` colour and `emissiveIntensity` at build time. By day the intensity is 0, so the shader program is the same day and night. No `emissiveMap` is ever set.

| material | emissive (via `col`) | intensity | on |
|---|---|---|---|
| `glazing` (N2) | #FFB866 | 0.9 × indoor | `glazing` |
| `furniture` (N3, new; the walls keep `batch`) | #FFB070 | 0.08 × indoor | `furniture-<level>` |
| `interior` (N3) | #FFB070 | 0.08 × indoor | `textured-<level>` |
| `lamp` (N5) | #FFD9A8 | 1.4 × indoor | `lamps-<level>` |

- The factors live in data (`PC.data.indoor = { glazing, lift, lamp, pool, litShare }`), so the Designer can retune them.
- The walls stay on `mats.batch` and are not lifted.

### N2 glazing
- **Geometry:** the `'glass'` decal items move from `roofBatch` into a `glazing` mesh in the `roof` group: a BoxBatch with vertex colours and the same glassTop → glassBottom gradient.
- **Shadows:** it receives shadows and does not cast them. It follows `roofBatch`'s visibility.
- **Readers (TL ruling 2):**
  - the `detail.test` decal order (glass now gone from `roofBatch`; the reveals stay);
  - the QA T1b openings and roof-compare rows;
  - the view3d-real "glass darker than wall" check, which must stay green at 12 h. I'll tell QA the item move before the impl review.

### N3 night lift
- A uniform change only, on the `furniture` and `interior` materials.
- `furniture` is a new Lambert material with `vertexColors`, so the furniture batches stop sharing `mats.batch` with the walls.

### N5 lamps
- **Shades:** lamp-template shade parts go to `lamps-<level>` (`mats.lamp`, Lambert, colour #F2EBDD). Bases and stems are plain parts.
- **Gate lamps:** two shade cubes on the gate posts go to `lamps-G`, or to the ground level's lamps batch when the house has no Ground.
- **Shadows:** neither cast nor received (CTO §4). A level with no lamp gets no lamps mesh.

### N4 glow (full tier only)
- **Mesh `glow-<level>`:** an `InstancedMesh` of unit quads in the level group.
  - Material `mats.glow`: `MeshBasicMaterial`, with `map` = the shared `blob` texture object, `AdditiveBlending`, `transparent`, `depthWrite: false`, and no shadows.
  - The colour is #FFB870 × indoor, through `col`. The per-instance `poolK` is folded into an `instanceColor` built once.
- **Instance order (TL ruling 3):**
  1. floor and lamp pools;
  2. ground spill (Ground only);
  3. window patches.

  `userData.ranges = { pools, spill, all }`, and `count` is set by mode:
  - dollhouse: pools + spill;
  - exterior: all.
- **Lit panes:** seeded per opening through `PC.house.hash(house.key + opening id)`, with `litShare` per opening kind.
- **Visibility:** a glow mesh is visible only when `indoor > 0` (applyLook). Its level group composes with the level selector and Basement, as today.
- **Lite tier:** no glow mesh is built. That is cheaper than hiding it, and the lite budget counts it. Lite keeps N2, N3 and N5.
- **Transparent-mesh rule:** `budget.test` asserts that every transparent mesh is `poolWater`, `blobs`, or an additive `glow-*`.

### Program count unchanged from noon to 22 h (CTO §8, TL)
- **The problem:** an invisible mesh is never compiled. Glow, hidden by day, would compile its program at dusk: a stall, and a changed `renderer.info.programs`.
- **The fix:** after each build (and after a context restore), `scene.js` makes the glow meshes visible for one `renderer.compile(scene, camera)`, then restores visibility.
- **Mock:** `compile` is added to `three-mock.js` and counted.
- **Real r128:** `renderer.info.programs.length` is equal after a 12 h frame and after a 22 h frame, at the maximum house in full and in lite.

### Highlight against lit windows at 22 h (CTO §1.5, TL)
- **real r128:** at 22 h, Roof on, with the finder's highlight on a ground room, I sample the highlight bars and the lit panes.
- **Required:**
  - the highlight's hue stays within 15° of #C2410C;
  - the lit panes' hue is ≥ 20° from the highlight, and their luma is ≥ 0.15 above it;
  - the highlight keeps `toneMapped: false`.

## 4. Real-r128 checks (≤ +10 s in `view3d-real`, TL)

All of these fold into the existing maximum-house page loads in `view3d-real`; there are no new page loads.

| check | rule |
|---|---|
| windows | at 22 h, the mean of the pane pixels is brighter than at 12 h (CTO §8) |
| program count | unchanged from 12 h to 22 h (above) |
| highlight vs lit panes | the hue/luma rule above |
| atlas seams | at Reset, Roof off: no pixel on a floor matches a neighbouring cell's mean colour outside a 2-pixel border of each sub-quad (TL defines the exact threshold in the review; I'll propose the T1c deck pattern: the first raycast hit on `textured`, step 2) |
| night darkest | the outdoor ground luma at 22 h, read outside the plot (TL ruling 7); the noon > evening > night order is kept |
| budgets | draw calls and triangles recorded at 12 h and 22 h |

- The 12 h "glass darker than wall" check stays.
- I'll time `view3d-real` before and after and record the delta in the impl notes.
- If the checks go over +10 s, the slowest one moves to the release step's stream rows, with the TL told.

## 5. Budgets (maximum house, full tier, 22 h, Roof on)

| measure | now | expected | CTO target |
|---|---|---|---|
| meshes | 27 | 27 + 3 × 4 levels + glazing = 40 | ≤ 40 |
| draw calls incl. shadow pass | 27 | about 44 (about 48 on shadow-update frames) | ≤ 80 |
| triangles | 22.4k | about 42k | ≤ 120k |
| textures | 4 | 5, about 5.4 MB | ≤ 6, ≤ 8 MB |
| materials | 13 | 13 + furniture, interior, lamp, glazing, glow = 18 | n/a |
| C-4.8 solo build | 148–166 ms | about 210 ms | ≤ 250 ms |
| lights | hemi + sun | hemi + sun | no others |

- **Lite tier:** 36 meshes, because there is no glow; textures at 256.
- **Tests:** `budget.test` asserts the exact new counts for sample, maximum and lite.
- **Light test:** a mock test (all tiers × 12/17.5/22 h) asserts that the only lights are `hemi` and `sun`.

## 6. Dist
- The comment strip lands first, with its own size line (S0).
- The F6-T2 delta is reported on its own:
  - Designer data, about +4.5 kB;
  - code, about +6 kB (parts expansion, cell UVs, glow, lamps), stripped of comments.
- The impl notes list both sizes against C-1.3.

## 7. Gate and run time
- **Default run:** the median of 3 quiet runs ≤ 420 s, none over 440 s, with the three step recorded per run (protocol).
- **Release step:** QA_FULL ≤ 480 s. Each release process ≤ 260 s (NOTE) and ≤ 300 s.
- **Mock and unit checks:** free. The new real-r128 work is ≤ +10 s in `view3d-real` (§4).
- **Third release process:** only under CTO §6.2 a–e:
  - no timing-sensitive check in it;
  - C-4.8 still runs alone before the pool;
  - three consecutive QA_FULL runs with three processes and no flake before the QA sign-off;
  - at most three browser processes plus the pool;
  - QA's duplicate cuts first.

  If QA's new T2 rows don't fit the two processes (each is at about 240 s today), I'll add it to run-all as a third spawn on the same pattern, and tell the TL first.
- **Loaded-build guard:** 1200 ms; the C-4.8 solo step's best-of-3 is recorded.
- **Texgen best-of-3** (with `interior`): ≤ 130 ms stays in the default run, as in T1c.

## 8. Mutations (each caught by a test)

| mutation | caught by |
|---|---|
| a `PointLight` added | the light test |
| `emissiveMap` set at dusk | mock: program key / material fields unchanged by a look |
| glow left visible on a hidden level | the visibility composition test |
| a glow mesh not additive | the transparent rule |
| a shadow update triggered by `indoor` | the `shadowUpdates` test |
| a part outside its envelope | the envelope test |
| no precompile at build | real r128: the program count |
| no half-texel inset | the mock UV test |
| window patches inside the dollhouse count | the glow range test |
| lite builds glow | the lite budget test |

## 9. Open points for the TL
- **F1:** the hall floor. It stays a slab tint, or it becomes planks in `textured` if the Designer's table puts the hall on planks; that costs no mesh either way. My reading of the table is planks.
- **F2:** gate lamps go to the ground-level `lamps` batch. They are site items in a level group; the alternative is `siteBatch`, which is not emissive.
- **F3:** the atlas-seam check threshold, to be set in the plan review.
- **F4:** `apply()` marks shadows dirty only when the sun changed. That changes the T1 shadow-update counts in `scene.test`: identical looks no longer count. Those rows get the new expected numbers.
