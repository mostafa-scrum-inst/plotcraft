# F6-T1c FS plan: roof detail, evening meadow, hall windows

- **Date:** 2026-11-22.
- **Author:** FS.
- **Inputs:**
  - the Designer plan `designer-plan.md` (ae92960);
  - the TL review `designer-plan-review.md` (c0bfd24, APPROVED);
  - the CTO constraints `docs/03-tasks/F6-T1/cto-constraints.md`.
- **Branch:** a new branch from main after the orchestrator merges f6t1 and publishes. Nothing is built before that.
- **Browsers:** none are used for this plan, because QA's timing runs are in progress.

## 0. Scope

**In T1c (the MVP):**
- **R1:** coping and a drip edge.
- **R2:** a `roofDeck` textured mesh.
- **R3:** a parapet shadow band, as strips in `roofBatch`.
- **G1:** the meadow colours (data only).
- **W1:** hall windows (house v 3).

**Out of T1c (TL review items 4 and 5):**
- R4, the roof plant;
- R5, the pitched eaves;
- G2b, the tinted meadow octave (needs the CTO);
- W2, the string course.

G2 is data only (the meadow tileM and octaves). It is not in the TL's MVP list, so I don't take it. If the Designer asks for it, it costs nothing in code and only needs the texgen hash regenerated. That is for the TL to allow (Q-F3).

**Expected budgets, maximum house (terrace, usable):**

| | today | after T1c | limit |
|---|---|---|---|
| meshes | 26 | 27 (28 with the highlight) | 64 |
| draw calls | 26 / 25 | 27 / 26 (the deck draws in the colour pass only) | 160 |
| triangles | 19.4k | about 23k | 300k |
| textures | 4 | 4: terrace / usable reuse the `paving` object | 12 |

- A flat, non-usable roof gets the new `membrane` texture: 5 textures, about 5.4 MB of 16 at 512² (lite 256²: about 4.4 MB).
- Pitched roofs get no deck and no coping, so their counts are unchanged.
- Nothing adds a light, a caster class, a transparent mesh, a shader or post-processing.

## 1. R1: coping and drip edge (`build-roof.js`, `roofBatch`)

**Constants and data:**
- New constants: `PC.C.ROOF.copingT 0.05`, `copingOver 0.03`, `dripOut 0.04`.
- New data `exteriors[*].coping`, the Designer's table:

  | exterior | coping |
  |---|---|
  | sand | #E6DAC4 |
  | white | #F4F2EA |
  | terracotta | #D9CBB8 |
  | grey | #B9BEC1 |

**Coping:**
- Every parapet ring (0.3 m, or 1.0 m when usable or terrace) gets a cap ring: 4 boxes from the parapet top to `+ copingT`.
- Each box spans from `copingOver` outside the outer face to `copingOver` inside the inner face. A new helper `ringOut(k, over, y0, y1, hex)` builds it, beside `ring()`.
- The stair head and the lift overrun get one cap box each, `copingOver` wider on every side. This follows the Designer's rule: every parapet-coloured top gets a cap.
- The pergola gets no cap. It is in `roof`, not `parapet`.

**Drip edge:**
- The flat / terrace slab box widens by `dripOut` on all four sides (u0 − 0.04 .. u1 + 0.04, the same for v). It keeps its height (roof.baseY .. + slab) and its colour (`exteriors.slab`, today `roof`).
- The Designer table says "in `slab`", which changes the slab box colour from `roof` to `slab`. I take it as written, and the box's top face stays under the deck (see R2).
- Readers of the slab colour (A-16): `tests/three/roof.test` (the flat 'slab' row, which holds `exteriors.roof`) and QA f4-t2-model's roof compare. Their x0..x1 extent also grows by 2 × `dripOut`.

**Cost:**
- About 6–8 boxes appended to `roofBatch`, about 100 triangles.
- No new mesh. Casting stays with `roofBatch`.

**Order:** the decals stay last in `roofBatch`. Coping and drip are added before them, so the openings' items stay at the end, which `detail.test` and QA's oracle read.

## 2. R2: `roofDeck` (new mesh in the `roof` group)

**Geometry:**
- One `BoxBatch({ uv: true })` face-up quad over the deck inside the parapet: (u0 + parapetT .. u1 − parapetT) × (v0 + parapetT .. v1 − parapetT).
- Height `top + deckLift`, with a new `PC.C.ROOF.deckLift 0.002`. The slab box is unchanged, so QA's slab-height rows hold.
- World UVs are in metres (the existing `basis` path). One item, kind `deck`.
- Built with `addUpQuad`, so no new vertex code is needed.
- With a stair head or lift overrun, the deck runs under them. It is hidden there, so no holes are cut.

**Material:** `S.mats.deck`, created in the scene build like `mats.tiles` (only when the roof is flat or terrace):
- `MeshLambertMaterial({ color: three.col(exteriors.roof), map })`.
- **Deviation from the Designer plan (MeshStandard, roughness 0.95):** every other surface is Lambert, so Standard would add a second lighting model and a shader program on phones for one quad. I propose Lambert (Q-F1).
- **Map, chosen at build (TL item 2):**
  - flat, not usable: `tex('membrane')`;
  - terrace or usable: the same `paving` texture object `mats.paving.map`. That is no second upload, and tileM 2.4 gives 0.6 m roof tiles.
- `applyLook` never touches it.
- The colour comes from `material.color`, so Q10 stays a rebuild, as today. The stage-2 swatch match (CSS test on `roof`) is unchanged.

**Shadows and visibility:**
- `receiveShadow true`, `castShadow false`.
- It is in the `roof` group, so Roof off and the level selector hide it with the rest.
- `shadowsDirty()` needs no new trigger. It already runs on build, applyVisibility and applyLook.

**Texture `membrane` (`data/textures.js`, Designer spec):**
- Spec: `{ tileM: 4, base: 0.9, sheetW: 1.0, seam: -0.12, mottle: [[2, 0.05], [8, 0.025]], speckle: 0.03 }`.
- `core/texgen.js` gains a `membrane` kind:
  - sheets `tileM / sheetW` wide, so 4 per tile, running along v;
  - a 1 px seam at `seam`;
  - mottle through `addNoise`;
  - speckle per pixel.
- It is tileable and deterministic, sRGB, a colour kind (`COLOUR` in texgen.test).
- Cost:
  - Node time: about +10 ms for one more 512² kind. The C-3.2 test (≤ 150 ms, all kinds) gains it.
  - Size: 1.4 MB with mips at 512², 0.35 MB at 256².
- Context loss: it is in `S.textures`, so restore recreates it from the cached pixels.

## 3. R3: parapet shadow band (strips in `roofBatch`, TL item 1)

**Strips:**
- Four face-up trapezoids along the inside of the parapet, `deckW 0.35` wide: ×`deckK 0.80` at the parapet, ×1 at the band edge.
- They are the same as the T1b floor rings (`addUpQuad`, 4 corner colours). Kind `deckBand`.
- Height: `top + deckLift + bandLift`. With `bandLift 0.003`, that is 0.005 m above the slab top (TL: 0.005 m proud).
- Stair head and lift overrun: 4 strips each around their base, `headW 0.25`, ×`headK 0.85`.
- Corners are mitred, as in the floor rings.

**Constants:** `PC.C.CONTACT.deckW 0.35`, `deckK 0.80`, `headW 0.25`, `headK 0.85`, `bandLift 0.003`.

**Colour:** `exteriors.roof` × k.

**A consequence to check in the Designer's shots:** the strips are untextured vertex colour, so the membrane seams and the paving joints stop 0.35 m short of the parapet. At Reset (phi 62) the band is a few pixels wide. If it reads as a flat rim, the fallback is to build the band into the deck quad instead: a `uv` BoxBatch with a border ring and vertex colours, the groundRing technique. That needs `vertexColors: true` on `mats.deck` and still no new mesh (Q-F2).

**Cost:** about 16–24 quads, about 50 triangles.

## 4. G1: meadow colours (data, Designer)

**New values:**
- `siteColors.groundOuter` and `sky.seasons.summer.meadow` become #6A8550.
- `seasons.spring.meadow` becomes #6F8A58.
- Autumn and winter are unchanged.

**Owner:** the Designer commits the data on the T1c branch. The data-tables invariant "summer meadow = groundOuter" holds.

**Readers (A-16):**
- `tests/unit/data-tables`, which reads no literal.
- QA f3-t3-data (the groundOuter hex) and the QA f4-t3 oracle (`f4-t3-ref.mjs`, `f4-t3-model.mjs`, which hold #727E58 / #76865A). The Designer sends QA the hexes.
- The Designer's `verify` scripts.

The look test and the lite skirt test read `L.meadowColor`, so they need no change. The fog / seam test is unaffected, because fog uses the horizon hex.

## 5. W1: hall windows (`core/house.js`, house v 3)

**Rule, in `openings(house)`, per level (index ≥ 0) and side, after the room runs:**
1. The free runs are the side's extent (fp.u..fp.u + fp.w, or the v extent) minus the union of every room run, the stair run and the lift run on that side. The lift is subtracted too: a shaft gets no hall pane. This is a detail the Designer plan leaves implicit (Q-F4).
2. Each free run of length L ≥ `win.w + 2 × endClear` gets n = max(1, floor((L − endClear) / hallPitch)) `glazed` panes of the `win` size, evenly spaced and `endClear` clear of each end. This is the room rule with `PC.C.OPEN.hallPitch 3.9`.
3. The door filter (`doorClear`) and the head clamp apply to them as to every opening. The list stays sorted by `a`, and there is no overlap on a side.
4. Basements get none.

**No new kind:** the panes are `glazed`, so they need no new decal kind or key. They are built by the existing `openings(house, b)` decal code.

**Model:**
- `house.v` goes to 3 (TL item 3), because the derived output changes and stored keys must not collide.
- `house.openings` stays inside the key. The layout golden does not change: the rule reads the plans and does not change them.

**Expected counts:**
- Sample: 20 → 24.
- Maximum house: 22 → about 58 by the Designer's prototype. QA's f6-t1-model reports 22 today.
- The decals add about +3k triangles on the maximum house.

**Readers (A-16):**
- the house key / hash and every cache keyed on it (the 3D rebuild follows);
- `tests/unit/openings.test` (v 3, plus the free-run rule tests);
- `tests/three/detail.test`, which counts from `house.openings` and so needs no literal;
- QA `f6-t1-model.mjs`, whose openings oracle takes the `hallPitch` rule (QA owns it);
- QA rows that hold `house.v` 2;
- the Designer's `verify` scripts;
- the F5 tour and finder, which read rooms and not openings, so no change is expected (checked by their tests).

## 6. Tests (node first; real r128 only inside existing pages)

**Unit:**
- `openings.test`:
  - free runs: run lengths 2.39 / 2.4 / 3.9 / 7.8 / 12, so none below 2.4 and pitch 3.9;
  - lift and stair subtracted;
  - door filter;
  - sample 24;
  - maximum house per side > 0 on all four sides at every level ≥ 0;
  - `house.v` 3.
- `texgen.test`:
  - `membrane` in COLOUR: size, range, tileability, determinism;
  - a hash golden generated through the generator;
  - the 150 ms budget including it;
  - sheet seams at every `tileM / sheetW` column, darker by `seam`.
- `data-tables`: `exteriors` gains `coping`, so EXT_KEYS has 9 entries, and `textures` gains `membrane`.

**Three (mock):**
- A new section in `detail.test`:
  - coping: 4 boxes per ring plus 1 per head, in `coping`, `copingOver` outside both faces, on the parapet top;
  - drip: the slab box `dripOut` proud on all sides, in `slab`;
  - deck: one mesh in `roof`, a face-up quad inside the parapet at `top + deckLift`, world UVs in metres, receives and does not cast;
  - deck map: `membrane` for flat, the same `paving` texture object for terrace and usable;
  - no deck and no coping on pitched roofs;
  - band strips: count, colours ×0.80 → 1 and ×0.85 → 1, height 0.005 m.
- Count updates (sample flat):
  - meshes 21 (sample), 27 (maximum), 28 with the highlight;
  - materials +1 (deck) on flat and terrace;
  - textures 5 on a flat sample, 4 on a terrace, 5 on pitched (tiles);
  - budget MB;
  - context loss recreates `membrane`;
  - Roof off hides the deck.
- Mutations, each applied once and reverted:
  - the deck casting shadows;
  - the terrace deck making a second paving texture;
  - `membrane` without sRGB;
  - the free-run rule ignoring the lift.

**Real r128:** inside the existing `detailReal` page, with no new browser context:
- the deck draws (hiding it changes pixels inside the roof outline at Reset);
- the deck pixels vary along u across a seam column, so no z-fight flat patch appears at rMax;
- the maximum-house draw calls and triangles are recorded.
- Expected cost: +1–2 s on view3d-real.

**Timing:** after QA's trim lands, I re-time `tests/durations.json` and `durations-full.json` in the same change (C-6 rule 107). I then run two quiet default runs (≤ 420 s, with no other agent's full run beside them, per the TL ruling), QA_FULL=1 (≤ 480 s) and the release step (≤ 300 s).

## 7. Order of work

1. Branch from main (after the f6t1 merge and publish).
2. W1 with its unit tests and the v 3 bump. I tell QA the rule and the counts.
3. R1 and R3 in `roofBatch`, with the three tests.
4. R2: the texgen kind, the deck mesh and material, and the count updates.
5. G1, when the Designer commits it.
6. `dist` rebuild and lint, then the gate.
7. Impl-notes with the A-16 reader lists, then hand to the TL. The Designer takes the T1c shots, with browser runs cleared with the orchestrator first.

## 8. Questions for the TL

- **Q-F1:** `roofDeck` as Lambert, not MeshStandard (one lighting model, no extra program on phones)?
- **Q-F2:** if the Designer's shots show the untextured R3 band as a flat rim, may I move the band into the deck mesh (vertex colours on `mats.deck`, still 1 mesh) without another plan round?
- **Q-F3:** G2 (meadow tileM 48, broader octaves, data only, texgen hash regenerated) in T1c if the Designer asks, or later?
- **Q-F4:** W1 also subtracts the lift run (no hall pane on a lift shaft). Agreed?
