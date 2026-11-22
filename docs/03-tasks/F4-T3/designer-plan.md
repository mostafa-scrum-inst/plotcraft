# F4-T3: Designer input (vegetation look, time-of-day / season tables, Light tab)

Owner: Designer, 2026-11-21.
- **For:** the FS's F4-T3 plan and the TL plan review.
- **Sources:**
  - F4-plan F4-T3;
  - F4-T2 `outcome-review.md` routing 1–6;
  - A-9, A-11, A-13;
  - F3-T3 tables (`look3d.js`, `sky.js`) and art-direction note (F3-T3 `outcome.md` §7);
  - my F4-T2 `designer-plan.md` §4;
  - `camera-decision.md` (PM + Designer).
- **Method.** The figures come from scratch probes against the current build, including real r128 (`tests/vendor`) for the Reset shots. Screenshots are in `designer-shots/`.

## 0. Default camera: decision (a), recorded by the PM in `camera-decision.md`
- Reset stays on the street side, with no new control.
- **My shot check** (sample, real r128, Reset, `designer-shots/360x640-reset-real.png`, `1280x800-reset-real.png`):
  - the **seating pad is visible** past the back-right house corner at both sizes;
  - the **pool (u 7, v 24, 6 × 3 m) is fully hidden** behind the house at both sizes.
- **PM ruling (closed; outcome section in `camera-decision.md`): no hint line.** The trigger needed both items hidden, and the visible seating pad already signals the yard. The phone panel is at its 33 % limit (162 of 490 px). A pool hidden at Reset is accepted and is restated at the F4 review.

## 1. Vegetation look: `PC.data.vegetation` (new key, `look3d.js`, Designer)
Sizes live in data, like every other look value, so a retune after the phone check is data-only. Colours are **not** duplicated: they come from the tables that already exist.

| Item | Geometry (r128 whitelist) | Size (scale 1) | Colour |
|---|---|---|---|
| trunk | `CylinderGeometry(r, r, h, 6)` | r 0.12 m, h 2.6 m (Y 0 – 2.6) | `siteColors.trunk` #5B4636 (fixed) |
| canopy | `ConeGeometry(r, h, 8)` | r 1.35 m, h 2.8 m, base at Y 1.4 (top 4.2) | `sky.seasons[s].canopy`; `visible = canopyVisible` |
| shrub | `ConeGeometry(r, h, 7)` | r 0.7 m, h 0.8 m, base at Y 0 | `sky.seasons[s].shrub` |
| per-instance scale | uniform, seeded PRNG | 0.85 – 1.15 (all three axes) | — |

```js
PC.data.vegetation = {
  tree: { trunkR: 0.12, trunkH: 2.6, canopyR: 1.35, canopyY0: 1.4, canopyH: 2.8, trunkSeg: 6, canopySeg: 8 },
  shrub: { r: 0.7, h: 0.8, seg: 7 },
  scale: [0.85, 1.15]
};
```

**Why these numbers:**
- **Footprint area.** The canopy area at scale 1 is π · 1.35² = 5.7 m² and the shrub's π · 0.7² = 1.54 m². These match A-9's counting area of 6 m² per tree and 1.5 m² per shrub, so the drawn cover is roughly what the scatter counts (F4-S1 "roughly the effective %").
- **Clearance.** The largest canopy radius, 1.35 × 1.15 = 1.55 m, is the clearance the TL routed (footprint + 1 m + 1.55 m for trees). The scatter should read it as `canopyR × scale[1]` from this table, not as a literal.
- **Low-poly on purpose** (6 / 8 / 7 segments): it reads as an architect's model tree, the same block language as the furniture. It also keeps three `InstancedMesh` objects cheap at the caps (120 trees, 200 shrubs).
- **Winter.** The canopy is hidden, and the 2.6 m trunk is a bare-tree pole that still reads above the 1.2 m boundary wall. A shorter trunk would read as a stump.
- **Shadows** (A-11): trunks and canopies cast but do not receive; shrubs cast; the ground receives.
- **Materials.** One Lambert material per mesh. The season changes the material colour only (`applyLook`), with no per-instance colour (`setColorAt` is not on the whitelist).

**Contrast per season** (ΔE76, from the existing tables):

| Season | canopy / ground | shrub / ground | trunk / ground | canopy / roof (4 exteriors) |
|---|---|---|---|---|
| spring | 16.7 | 9.7 | 60.5 | 49–70 |
| summer | 15.3 | 10.6 | 58.0 | 45–63 |
| autumn | 39.9 | 29.8 | 40.2 | 38–68 |
| winter | (hidden) | 5.2 | 65.6 | — |

- **Winter shrubs:** snow mounds on snow, ΔE 5.2, on purpose. The cone's shading and shadow carry the shape, as in a real snowy garden.
- **Summer canopy vs shrub** is only 4.7, but the two are never confused: they differ in height and size.

**Unit test** (Designer, added to `data-tables.test.mjs`):
- exact keys, positive sizes;
- `canopyR² · π` within 10 % of 6 and `r² · π` within 10 % of 1.5;
- `canopyY0 < trunkH`, so the canopy sits on its trunk;
- `trunkH > 1.2`, so the bare tree stands above the wall;
- `scale` within [0.5, 1.5].

## 2. Time-of-day and season colours (unchanged tables, as A-13 computes them)
No table changes. `sky.js` and `look3d.js` stay exactly as in F3-T3 (QA-passed). Below is the A-13 output (key lerp, then the day-weighted season blend, `groundBounce` 0.25) at the four presets × four seasons. It comes from my reference implementation (the one in `data-tables.test.mjs`).
- **For the FS:** `PC.sky.compute` must reproduce these hex values exactly.
- **For QA:** a ready golden table for `sky.test` (within 1 per channel if the FS interpolates in floats before rounding once).

> **Superseded at 17.5 h by F5-T3a (O-1 retune of the 17 / 18 h keys).** The current rows are generated by `docs/03-tasks/F5-T3/verify/golden.mjs` and live in `tests/unit/sky.test.mjs` `GOLD`. The 8, 12 and 22 h rows below are unchanged.

| Season | Hour | background (L*) | sunColor | sunI | hemiSky | hemiGround | hemiI |
|---|---|---|---|---|---|---|---|
| spring | 8 | #ABCDE6 (81) | #FEE5C3 | 0.567 | #CDDFEE | #878768 | 0.444 |
| spring | 12 | #96C7EA (78) | #FEF7E8 | 0.7 | #D8E7F4 | #939671 | 0.48 |
| spring | 17.5 | #E0AE87 (75) | #FEB679 | 0.5 | #C4B2BB | #736E53 | 0.39 |
| spring | 22 | #0F1A29 (9) | #A0B4D9 | 0.15 | #7285AE | #303843 | 0.3 |
| summer | 8 | #A6CAE6 (80) | #FFE4C1 | 0.567 | #CADDEF | #818263 | 0.444 |
| summer | 12 | #8EC3EA (77) | #FFF7E8 | 0.7 | #D6E6F5 | #8B906B | 0.48 |
| summer | 17.5 | #DFAA81 (74) | #FFB273 | 0.5 | #C1AEB8 | #6E6A4E | 0.39 |
| summer | 22 | #0B1626 (7) | #9FB3D9 | 0.15 | #7083AD | #2F3741 | 0.3 |
| autumn | 8 | #B0C9DB (80) | #FEE0BB | 0.567 | #CFDAE3 | #887E64 | 0.444 |
| autumn | 12 | #9EC3DC (77) | #FEF0DB | 0.7 | #DBE1E6 | #958B6D | 0.48 |
| autumn | 17.5 | #E1AD82 (75) | #FEB476 | 0.5 | #C7B0B4 | #756650 | 0.39 |
| autumn | 22 | #131C29 (10) | #A2B4D7 | 0.15 | #7485AC | #313642 | 0.3 |
| winter | 8 | #ADCEE8 (81) | #F8E3C9 | 0.567 | #CBDDEF | #979083 | 0.444 |
| winter | 12 | #9CC9EC (79) | #F6F2EA | 0.7 | #D5E5F4 | #A7A193 | 0.48 |
| winter | 17.5 | #DDB291 (76) | #F9B985 | 0.5 | #C4B5C0 | #81766B | 0.39 |
| winter | 22 | #141F2F (12) | #A1B5DA | 0.15 | #7487B0 | #343A4A | 0.3 |

**Material colours per season** (applyLook; from the tables as they are):

| Season | plot ground (`mats.ground`) | canopy (visible) | shrub | groundOuter |
|---|---|---|---|---|
| spring | #9DC46F | #6AA442 (yes) | #8CBF5A | #B3B0A6 always |
| summer | #7FAE55 | #4E8A3A (yes) | #5E9441 | |
| autumn | #A59B5C | #C8702A (yes) | #A8692F | |
| winter | #EDF1F4 (snow) | — (no) | #DCE4EA | |

**Rules for `applyLook`** (art direction; the A-13 text stays binding):
- Only colours, intensities, the sun position and canopy visibility change. House, furniture and site-item colours never take the season; summer is the baseline everywhere.
- `groundOuter` never changes, so the plot edge reads in every season (ΔE ≥ 24 to the snow plot).
- `scene.background` takes the raw hex; everything else goes through `PC.three.col`.
- No fog, no tone mapping, no extra lights. The tables assume one sun plus one hemisphere, with a noon top-face sum of about 1.0 (F3-T3 §7).
- **Shadows** (routing item 4): at summer noon (sun at 72°) the shadows are short and faint by design; 17.5 h and the winter presets show them. Any tuning goes through `sky.js` intensities (data), not the code.

## 3. Light tab: control layout
The markup has existed since F4-T1, so no new hooks. F4-T3 enables the slider, the four presets and the season select. I measured the layout with them enabled (scratch: the `disabled` attribute removed in the live build).

| Viewport | Panel | Slider | Presets | Season | Note |
|---|---|---|---|---|---|
| 360x640 | 162 px tall over a 490 px canvas = **33 %** (unchanged) | 296 × 44 + "12:00" 42 px | 4 × 44 px, one row | 144 × 44 on the preset row | one line |
| 640x360 | side column 272 px | 207 × 44 | 4 × 44 | 255 × 44, own row | one line |
| 768x1024 | 162 px | 704 × 44 | 4 × 44 | 552 × 44 | one line |
| 1280x800 | side panel 320 px | 246 × 44 | 4 × 44 | 294 × 44 | one line |

Everything fits in one pass at 44 px targets, with no scroll in the pane. **The layout stays.** Designer additions (CSS / markup only, about 12 lines in `44-stage-3d.css` and 4 attributes):

1. **Preset state.** A preset shows `aria-pressed="true"` while the hour equals its value (8 / 12 / 17.5 / 22). FS: one line in `stage-3d.js` render.
   - The existing `.pc-btn[aria-pressed="true"]` style gives the accent tint, so the user sees which preset is active. Dragging the slider off a preset clears it.
   - `title` and `aria-label` are already "Morning", "Noon", "Evening", "Night".
   - Session default: Noon pressed.
2. **Day / night slider track.**
   - Class `pc-range--sky` on `v3-time`. The track is a 6 px horizontal gradient with stops at `h / 24 × 100 %` in each key's `background` hex (night navy → dawn peach → day blue → golden / dusk → twilight → night), framed by a 1 px `--border` line.
   - It shows where night and dusk fall before the user drags.
   - The thumb keeps the accent fill with its surface ring: ≥ 3:1 against both the navy ends and the day blue.
   - The stops are literal hex in the CSS (no JS). `data-tables.test.mjs` asserts that the stops equal `PC.data.sky.keys` (h and background), as it already does for the stage-4 and Q10 swatches.
   - Disabled styling (F4-T1) keeps precedence: `.pc-range:disabled` is placed after the gradient rule.
3. **Readout.** `v3-time-out` shows `HH:MM` in 24 h (00:00 – 24:00, the end value shown as 24:00), tabular figures. That is unchanged except that it is now live.
4. **Season** stays a `select`. A 4-segment control would need its own row: +52 px of phone panel, which breaks the 33 % limit.
5. **"approximate — not real solar data"** stays as it is under the controls (F4-S3).

**Tests:**
- `view3d.spec` (FS-owned): my F4-T1 disabled-style check moves to the controls that stay disabled after F4-T3 (`v3-room`, tour). The FS updates the DISABLED set; I adjust my check in the same commit.
- **Designer e2e** (one check in `view3d-look.spec` at 360x640):
  - pressing Evening gives `aria-pressed` on Evening only, slider 17.5 and readout 17:30;
  - the panel is still ≤ 34 % of the canvas;
  - one row of presets;
  - every target ≥ 44 px.

## 4. Open points
1. ~~**PM:** does a hidden pool alone trigger the View hint line?~~ Closed: no line (PM ruling, `camera-decision.md` outcome; §0).
2. **TL:** `PC.data.vegetation` as a new key in `look3d.js` (data layer, literals only), and the scatter reading its clearance from the table.
3. **FS:**
   - `aria-pressed` on presets (one render line);
   - the `pc-range--sky` class on `v3-time` is the Designer's markup;
   - `PC.sky.compute` reproduces §2 exactly.
