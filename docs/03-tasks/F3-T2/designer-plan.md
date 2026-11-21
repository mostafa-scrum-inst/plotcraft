# F3-T2 Designer plan: phone stage-3 panel, room-label rule, editor visuals, stage 4 (Designer, 2026-11-21)

Covers the F3-plan rider (≥ 14 px/m for the sample at 360x640, with one short-name rule; QA F3-T1 obs 2) and the F3-T1 outcome-review rulings for obs 2 and obs 6. It also covers what F3-T2 adds to stages 3 and 4. This is a plan only; I implement after the TL review, together with the FS plan.

## 1. Measured today (sample, Ground floor, headless Chrome)
| Viewport | Canvas px | px/m | Stage-3 rows above / below the canvas (px) |
|---|---|---|---|
| 360x640 with sample strip | 239.6 | **12.71** | strip 49 · tabs 45 · counter 24.6 · readout 43 · message 32 · actions 56 |
| 360x640 without strip | 288.6 | 15.59 | same minus the strip |
| 360x740 with strip | 339.6 | 18.59 | same as 360x640 |
| 640x360 (strip or not) | 262 | 14.00 | right column: tabs 45 · counter 24.6 · readout 85 · message 42 · actions 56 |
| 768x1024 / 1280x800 | 624 / 596 | 35.3 / 33.7 | not a constraint |

The fit is height-bound on phones. It fits the footprint (15 m deep) plus a 1.0 m margin each side, so 17 m, with 12 px pads: scale = (canvas − 24) / 17. Reaching 14 px/m therefore needs a canvas of 262 px or more.

## 2. Proposed changes for the phone panel (360x640 portrait, tall phones)
- **A. Counter visually hidden below 600 px wide (tall screens), +24.6 px.** It stays in the DOM, so screen readers still announce "0 of 2 floors approved". Each tab already shows its state icon, and Next stays disabled until all floors are approved. CSS only (`.pc-plans__counter` gets the `pc-vh` clip technique in a media block).
- **C. Action row padding 6 → 4 px, +4 px.** The buttons stay 44 px. CSS only.
- **D. (FS, JS one constant) Fit margin around the footprint 1.0 → 0.5 m on every viewport.** The setback band still shows around it, and pan/zoom and Fit view reach the rest.

Measured with A + C injected:

| Viewport | A + C | A + C + D (computed: (canvas − 24) / 16) |
|---|---|---|
| 360x640 with strip | **14.35 px/m** (canvas 268.2) | **15.3** |
| 360x640 without strip | 17.24 | 18.3 |
| 360x740 with strip | 20.24 | 21.5 |
| 640x360 | — (A and C do not apply) | 14.9 (from 14.0) |

A and C alone meet the rider. D adds margin, so the target still holds if F3-T2 makes the message line taller. I recommend all three.

- **Readout that can show drawn vs asked size (obs 6).** The FS writes e.g. "39 m² (asked 42 m²)" into the existing `plan-room-area`; there is no new hook. Fitting the longest ft case ("420 sq ft (asked 452 sq ft)", about 227 px in the mono face) needs the readout re-gridded per viewport, with the same hooks:
  - **phone portrait:** two lines, `"name size" / "area area"`. The dt captions are visually hidden; the values are self-explaining. The height stays about 44 px (today 43).
  - **640x360:** three one-line rows (name, size, area) with captions hidden, about 70 px (today 85, so +15 px of panel room).
  - **768x1024:** columns `1fr 1fr 1.4fr` → `1fr 1fr 1.6fr`, so the area cell holds about 270 px.
  - **desktop panel:** rows already hold about 310 px for the value; no change.
- **Message line:** unchanged height. The "Approval comes with plan editing" text goes in F3-T2, so the FS reuses the line for hints and errors.
- **Not changed:** sample strip (F1-T1 owns it; it goes after the first edit anyway), tabs (fixed in F3-T1), no-layout banner (fixed in F3-T1).

## 3. One short-name rule for room labels (obs 2)
Data table `PC.data.roomLabels` (new Designer data file `src/js/data/room-labels.js`, literals only). It is used for canvas labels only; the readout, summary and lists keep the full names from `PC.levels.roomNames`.

| Key | full (= `PC.C.ROOM_LABEL`) | short | tiny |
|---|---|---|---|
| bedroom | Bedroom | Bed | B |
| master (bedroom with `master`) | Master bedroom | M. bed | MB |
| bathroom | Bathroom | Bath | Ba |
| kitchen | Kitchen | Kit | K |
| living | Living | Liv | L |
| dining | Dining | Din | D |
| majlis | Majlis | Maj | Mj |
| office | Office | Off | O |
| maid | Maid's room | Maid | Md |
| storage | Storage | Stor | Sto |
| laundry | Laundry | Ldry | Ln |
| stair (core) | Stairs | Stair | St |
| lift (core) | Lift | Lift | Lf |

Numbering follows the full name: "Bedroom 2" → "Bed 2" → "B2" (no space in tiny).

**Rule (the FS implements it in `stage-plans.js`, replacing `SHORT` / `shortName`):**
1. **Tiers:** full with area line → full → short → tiny. Full and short use `font.room` (12 px); tiny may use the new `font.roomSmall` (10 px).
2. **One tier per room type per level:** every room of a type on a level (master included with bedrooms) uses the lowest tier that any of them needs. Twins always match ("M. bed / Bed 1 / Bed 2", never "Bedroom 1" beside "Bed 2"). Different types may use different tiers (a large Living stays "Living").
3. **Area line:** shown only at the full tier, and then for every room of that type on the level, or for none of them.
4. **Never unlabelled at the default fit:** tiny needs about 20 × 14 px. At ≥ 14 px/m that covers every room 1.5 m or more wide, which includes every room size in the sample. A room that is still too small (zoomed far out) stays unlabelled, and a tap still names it in the readout.
5. The new debug hook `planLabels()` output stays as is; the tests read the tier from it.

## 4. F3-T2 editor visuals (palette `PC.data.palette2d`, all on canvas; no markup)
| Element | Look | Palette |
|---|---|---|
| Selected room | 2.5 px outline | existing `state.selection` (#C2410C), `line.selection` |
| Resize handles | one pill per edge midpoint, 18 × 6 px, white fill with a selection-colour stroke. On a room smaller than 66 px in a direction, the two handles of that direction are drawn just outside the room, so each keeps its own 44 px target (hit radius 22 px, A-15) and the body keeps the move target | `state.handleFill` (exists), **new** `state.handleStroke` = #C2410C, **new** `line.handle: 1.5` |
| Drag ghost | the room's start position: dashed outline | **new** `state.ghost: 'rgba(22,33,43,0.45)'` with `line.dash` |
| Snap guide | dashed line along the edge a moved edge has snapped to (A-15 `snapEdge`) | **new** `state.snap: '#1C6B46'` (the buildable green, 4.9:1 on the canvas) |
| Overlap / outside the footprint | red tint over the room plus a red outline, on every room involved | existing `state.invalidFill`, `state.invalid` |
| Approved floor | rooms drawn as usual, footprint outline in the approved green | existing `state.approved` |

New palette entries total: `state.handleStroke`, `state.ghost`, `state.snap`, `line.handle`, `font.roomSmall`. QA's static palette check (required groups, literals only) is unaffected.

**Approve floor:** existing `btn-approve` with `is-approved` (green, "Approved"). No CSS change needed; I check it at 360 / 640 / 1280 in the spec below.

## 5. Stage 4 (Interior, Q18–Q19)
- The markup is complete (hooks `q-interior-style`, `q-interior-density`, values from A-4). F3-T2 only wires it (FS).
- Measured: the stage scrolls internally (360x640: 490 px stage, 764 px content; 640x360: 262 / 498) with no page scroll, and the radio cards are 44 px or more. No layout change is needed.
- The hint pictures stay as placeholders until my F3-T3 (look tables).

## 6. New hooks
None. The readout keeps `plan-room-name`, `plan-room-dims` and `plan-room-area`, and the counter keeps `plan-counter` (visually hidden on phones, not removed). The only new file is the data file `room-labels.js`, which goes in the manifest's `data` layer.

## 7. Acceptance (new `tests/e2e/plans-phone.spec.mjs` plus unit checks; Designer)
1. Sample, stage 3, Ground and First floor, Fit view:
   - at 360x640 with the sample strip, `PC.debug.view('plan').scale` is ≥ 14.0, or ≥ 15.0 if D is adopted;
   - at 640x360 it is ≥ 14.0;
   - there is no page scroll and every target is 44 px or more.
2. The counter has no visible box below 600 px (tall), but its text is in the DOM. From 600 px and in short landscape it is visible and unchanged.
3. Readout with a room selected, at all five viewports, in m and ft, with the longest content ("Master bedroom", "16.1 × 16.4 ft", "420 sq ft (asked 452 sq ft)"): every value is shown in full on one line, and the readout height does not change between nothing selected and a room selected (no canvas re-fit).
4. Labels on the sample's First floor at 360x640 (and on QA's max-2 floor):
   - all bedrooms share one tier, all bathrooms share one tier;
   - every room carries a label;
   - each label text is one of the table's forms for its room (full / short / tiny, with its number).
   - Unit: `roomLabels` has every room type plus master, stair and lift; `full` equals `PC.C.ROOM_LABEL`; tiny codes are unique.
5. 768x1024 and 1280x800: stage-3 boxes are unchanged except the 768 readout columns.
6. Stage 4 at the five viewports, with the real state: no page scroll, cards ≥ 44 px, and the selected card is visible.
7. Existing specs (`plan-tabs`, `plan-banner`, `plans-view`) and QA F1-T1 stay green.

## 8. Split of work
- **Designer:** CSS A, C and the readout grids; `room-labels.js` and the palette entries; the spec above.
- **FS:** margin D; the tier rule of section 3; handles, ghost and snap drawing with the palette entries; the asked-size text (wording confirmed by the PM); stage 4 wiring.
- **Order:** the Designer CSS and data land first, so the FS draws against final entries.
