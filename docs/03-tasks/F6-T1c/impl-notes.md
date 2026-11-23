# F6-T1c implementation notes (FS, branch f6t1c)

**Base:** main d8f0ce7 (f6t1 merged, QA trim, re-timed tables), with a9f30c6 (loaded-build guard set to 1200 ms) merged in.

**Approvals:** plan.md (59f5c99) and plan-review.md were approved by the TL.

**Commits:**
- e4eea12: W1
- e79f9fe: R1–R3
- 4d7afa4: lint
- 66c5d87: G1 + G2, the Designer's data and goldens (meadow golden 6e228e05)
- ec12a64: `deckLift` 0.002 to 0.01 (z-fight fix)
- a4f62da, cb8521f: QA merges (b29b95a, 2b8cfa1: T1c rows, `--stream-only` / `--rows-only`)
- a5a6193: run-all release step as two parallel processes
- re-timed `durations.json` and `durations-full.json` (b12e8c4)

**Designer:** signed off all of T1c after the deck fix (44bf589, 03bc9b1).

## 1. What changed

- **W1: hall panes (`core/house.js`, house v 3).**
  - **Rule.** On each side of every above-ground level, take the side's extent and subtract the union of the room, stair and lift runs (TL Q-F4). The free runs left over get `glazed` panes by the room rule, with `PC.C.OPEN.hallPitch` 3.9 m in place of the room pitch.
  - **Unchanged.** The door filter and the head clamp apply as before. `house.openings` stays in the key, and the layout golden does not change.
  - **Counts:**

    | house | openings before | openings after |
    |---|---|---|
    | sample | 20 | 24 |
    | maximum | 22 | 60 |

    Every facade of every level of the maximum house now has openings.
- **R1: coping and drip edge (`roofBatch`).**
  - **Drip edge.** The flat or terrace slab box now uses `exteriors.slab` instead of `roof`, and stands `dripOut` 0.04 m proud on every side.
  - **Coping.** Every parapet ring gets four coping boxes (`copingT` 0.05 thick, `copingOver` 0.03 past both faces), and each stair or lift head gets a cap. The colour is the new `exteriors[*].coping`, with the Designer's hexes.
- **R3: band strips (`roofBatch`, TL Q1).**
  - The strips are `deckBand` face-up quads 0.013 m above the slab top (`deckLift` + `bandLift`).
  - Inside the parapet the band is `deckW` 0.35 wide, ×0.80 at the parapet fading to ×1.
  - Around each head it is `headW` 0.25 wide, ×0.85 fading to ×1.
  - The strips are clipped to the deck rectangle, and fully clipped strips are skipped. Heads flush with a footprint corner therefore get fewer than 4 strips.
  - The decals stay the last `roofBatch` items.
- **R2: `roofDeck` (TL Q-F1 and Q2).**
  - **Geometry.** One `BoxBatch({ uv: true })` face-up quad inside the parapet, `deckLift` 0.01 m above the slab top (first 0.002, which z-fought the slab top and made the Designer's corner patch; fixed in ec12a64), with world UVs in metres. It is in the `roof` group, so Roof off and the level selector hide it.
  - **Material.** `mats.deck`: Lambert with `color = exteriors.roof`, no vertex colours.
  - **Map.** A new `membrane` texgen kind on flat roofs. On usable or terrace roofs it reuses the `paving` texture object (`mats.paving.map`), so there is no second upload.
  - **Shadows.** It receives shadows and does not cast them.
  - **Lifetime.** It is created in the scene build, as `mats.tiles` is, so disposal and context-loss restore follow the existing paths.

## 2. Numbers

**Texgen C-3.2** (all kinds at 512, plus the blob, best of 3, alone): 66–77 ms. That is under the TL's 130 ms line, so the check stays in the default run. The number under the gate is in §4.

**Maximum house on real r128:**

| measure | before T1c | after T1c |
|---|---|---|
| draw calls (Roof on / off) | 26 / 25 | 27 / 25 |
| triangles | 19.4k | 22.4k |
| meshes | 26 | 27 |
| textures | 4 | 4 (walkable roof) |
| loaded build, best of 3 | 414–970 | 905 ms (guard 1200 ms) |
| C-4.8 solo build | 159 ms | 166 ms (budget 400 ms) |

The loaded build is higher because the maximum house now has 60 openings, each made of decal boxes.

**Dist:** 604 890 bytes.
- The lint tripwire went from 600 000 to 700 000 (TL, CTO).
- The real budget is now the exported `DIST_BUDGET_BYTES` = 627 302 (547 302 + 80 000, CTO C-1.3). Going over it fails with a message that asks for a CTO review.
- That leaves about 22.4 kB of headroom.

## 3. Contract changes and readers (A-16)

- **`house.v` 3 and the W1 openings.**
  - Readers: the house key and hash (with the 3D rebuild that follows it), `tests/unit/openings`, QA f6-t1-model (it takes the hallPitch rule), QA rows that hold v 2, and the Designer's verify scripts.
  - `tests/three/detail` counts from `house.openings`, so it needs no change.
- **Roof slab colour and size.** It is now `exteriors.slab` and ±0.04 m outside the footprint.
  - Readers: `tests/three/roof` (the 'slab' row) and QA f4-t2-model's roof compare.
- **`exteriors.coping`.** `EXT_KEYS` now has 9 entries.
  - Readers: `tests/unit/data-tables` and QA f3-t3-data.
- **`roofBatch` items.** It gains coping boxes and `deckBand` quads ahead of the decals. The parapet top is now plus `copingT`.
  - Readers: `tests/three/roof` (the parapet top, and the pergola filter now excludes the coping) and the QA roof oracle.
- **New mesh `roofDeck`** (in the `roof` group, now `roofBatch`, then `roofDeck`, then `roofTiles` when pitched).
  - Meshes: sample 21, maximum 27, 28 with the highlight; vegetation at 0 % gives 17.
  - Materials: 13 on flat and terrace roofs.
  - Textures: 5 on a flat roof (membrane added), 4 on usable or terrace roofs. Lite widths are [256, 256, 256, 64, 256].
  - Readers: the budget, scene, finder, tour, interior, vegetation and realism tests, view3d-real lite, and the QA mesh, material and texture rows.
- **`PC.texgen.KINDS`** gains `membrane`.
  - Readers: texgen.test (golden 9c057960, seams, C-3.2) and QA texture rows.
- **Lint.** `DIST_MAX_BYTES` is now 700 000, and `DIST_BUDGET_BYTES` / `scanBudget` are new.
  - Reader: lint.test.
- **G1 (Designer data).** Once committed, `groundOuter` and the summer meadow become #6A8550, and the spring meadow #6F8A58.
  - Readers: QA f3-t3-data and the f4-t3 oracle (they get the hexes from the Designer). `data-tables` needs no change, since summer still equals `groundOuter`.

## 4. Tests and mutations

**New tests:**
- `openings` hall rule: run lengths, even spacing, the stair and lift subtracted, the door filter, the head clamp, sample 24, every side of the maximum house.
- `detail` R1: coping counts and overhangs, the head caps, the drip edge, decals last, and pitched roofs get none of it.
- `detail` R3: band height, colours, deckW, clipping, including heads flush with a corner.
- `detail` R2: the deck's quad, UVs, material, map choice, texture counts and Roof off.
- `texgen` membrane: golden, seam columns, and the recorded C-3.2 time.
- `lint`: the budget at −1, 0 and +1, and the tripwire with three inlined.
- view3d-real: `roofDeck` draws over the slab top at Reset and at rMax, counting only pixels whose first raycast hit is the deck, with at most 0.1 % unchanged (no z-fight).

**Mutations** (each applied once and reverted; every one is caught):

| mutation | caught by |
|---|---|
| deck casts shadows | detail R2 |
| parapet band ×1 | detail R3 |
| no clamping to the deck | detail R3 (corner heads) |
| no drip edge | detail R1 |
| W1 ignores the lift | openings |
| terrace makes a second paving texture | detail R2 |
| membrane not tracked or disposed | detail R2 and realism |
| `deckLift` 0, the z-fight | view3d-real roofDeck, 1534 / 2187 pixels unchanged at rMax |
| `deckLift` 0.002 (the shipped bug) | view3d-real roofDeck after the first-hit filter, 13 / 3291 pixels unchanged (limit 0.1 %) |

## 5. Deviations

- **The R3 band** is strips in `roofBatch` (TL Q1). The membrane seams and the paving joints stop 0.35 m short of the parapet. If the Designer's shots read that as a flat rim, the TL has pre-approved a fallback (Q-F2): the band as vertex colours in `roofDeck`.

## 6. Gate (quiet machine, f6t1c)

| step | result | limit |
|---|---|---|
| node | 546 / 0 | |
| lint | clean; dist 604 890 bytes, about 22.4 kB under `DIST_BUDGET_BYTES` 627 302 | tripwire 700 000 |
| default run, old table | 417.7 s green | 420 s |
| default run, re-timed table | 426.2 s, 426.5 s green | **420 s: not met (open item)** |
| QA_FULL `--write-durations` | 464.0 s green | 480 s |
| C-4.8 solo build | 148 ms (203, 160, 148) | 400 ms, review line 380 |
| loaded build, maximum house | 746 ms in QA_FULL; 736 to 905 ms across runs | guard 1200 ms, did not trip |
| texgen C-3.2 best of 3 | 63 to 77 ms | 130 ms line, stays in the default run |
| release step, stream process | 159.0 s | 300 s, NOTE above 260 |
| release step, rows process | 189.0 s | 300 s, NOTE above 260 |
| release step wall time | 189.0 s (in parallel) | |

**Open item: default run time.** The post-trim baseline on main is 411.2 s, and the cap is +5 s. Measured runs come to 426 s, which is +15 s and over the 420 s gate. Pool work grew by about 40 s (1164.3 to 1204.7 s):
- qa/run-f6-t1: +13.5 s (QA's new T1c rows, f6-t1-view D and f6-t1-model W1).
- Maximum-house suites: +2 to +6 s each (f5-t2 +6.2, f4-t3 +6.1, e2e/shell +4.9, f4-t2 +4.6, f1-t2 +2.8, view3d-real +2.4, edges +2.2). The maximum house went from 22 to 60 openings, so every build costs more.
- The three step: +2.5 s.

The TL decides which moves to make (for example, moving T1c rows into the release step or a QA trim).

**After the QA trim 341d187** (merged as 336435b, table re-timed in 54b7455), all runs green:

| run | table | wall | pool work | three step |
|---|---|---|---|---|
| d1 (the writing run) | old | 417.4 s | 1177.6 s | 15.4 s |
| d2 | new | 441.3 s | 1246.4 s | 16.4 s |
| d3 | new | 427.6 s | 1198.9 s | 17.6 s |
| d4 | new | 409.7 s | 1156.9 s | 15.0 s |
| d5 | new | 430.0 s | 1212.4 s | 16.0 s |

- Wall time is 0.354 to 0.355 of pool work in every run, so the ordering is fine.
- The spread comes from the machine: the CPU-only three step moves with the pool work.

**TL ruling (impl-review.md, Addendum 2):**
- T1c is approved without further confirm runs.
- The new project gate is the median of three quiet runs ≤ 420 s, with no run over 440 s, and the three step recorded for each run.
- QA moves about 45 s more maximum-house work out of the default run. FS rebalances the release processes, with the moved rows on the stream side and each process ≤ 260 s.
- Both happen on main, before the next feature's first gate.
