# F4-T2: Designer input (Undo button, north marker, Q11 wall / pool, 3D art direction)

Owner: Designer, 2026-11-21. Answers FS `plan.md` §14 (the Designer slot of 3.4, Q9, Q11) and gives the FS the art direction for §4–§7. Every colour named here is an existing key of `PC.data` (F3-T3); no table changes.

Plan only, no code. Measurements come from a scratch probe (not in the repo):
- the proposed markup and CSS were injected into the live build at four viewports;
- panel screenshots are in `designer-shots/`;
- the colour figures are from a scratch check on the F3-T3 tables.

## 1. Undo last edit: stage-3 tool row

**Markup** (Designer): one button between Regenerate and Approve.
```html
<button class="pc-btn pc-btn--icon pc-plans__undo" type="button" aria-label="Undo last edit" title="Undo last edit"
        data-pc="plan-undo" hidden><svg class="pc-i" aria-hidden="true"><use href="#i-undo"/></svg></button>
```
- **Hook name: `plan-undo`, not `btn-undo`.** `btn-undo` already exists on stage 1 ("Undo last point", `src/index.html` line 138), and hooks are page-unique. `plan-*` also matches the stage-3 family (`plan-fit`, `plan-msg`…). FS / TL: `hooks.json` gains `plan-undo`.
- **Icon only, 44 × 44.**
  - The label lives in `aria-label` and in `title` (a tooltip on desktop).
  - The PM's confirmation "Last edit undone." appears in `plan-msg` after a press, so the meaning is confirmed in words.
  - The arrow icon is the same one stage 1 uses for undo, so the meaning carries over.
- **`hidden` while nothing can be undone** (FS 3.4). A disabled-but-visible button was considered and rejected: on a fresh plan it would sit there greyed for most of the session, and the row on phones has no spare width for a dead control.
- **Look.** A plain `.pc-btn` (outlined, not primary). Approve stays the one primary action, and Undo is secondary like Regenerate.

**CSS** (`42-stage-plans.css`, about 8 lines):
```css
.pc-plans .pc-toolrow > .pc-plans__undo { padding: 0; width: var(--tap); flex: none; }
@media (min-width: 900px) and (min-height: 481px) {          /* side panel: Regenerate + Undo on one line, Approve below */
  .pc-plans .pc-toolrow { flex-direction: row; flex-wrap: wrap; align-items: stretch; }
  .pc-plans .pc-toolrow > [data-pc="btn-regenerate"] { flex: 1 1 0; }
  .pc-plans .pc-toolrow > .pc-toolrow__end { flex: 1 1 100%; }
}
@media (max-height: 480px) and (orientation: landscape) and (max-width: 899px) {
  .pc-plans .pc-toolrow { flex-wrap: nowrap; }
  .pc-plans .pc-toolrow > .pc-toolrow__end { flex: 1 1 0; min-width: 0; padding: 0 var(--s2); }
}
```

**Measured with Undo shown** (button `left + width`, px; the plan scale is the sample's):

| Viewport | Before | With Undo | Tool row height | Plan scale |
|---|---|---|---|---|
| 360x640 | Regenerate 8+143, Approve 192+160 | Regenerate 8+134, **Undo 150+44**, Approve 202+150 | 52 → 52 | 14.25 → **14.25 px/m** |
| 640x360 | Regenerate (icon) 8+46, Approve 62+201 | Regenerate 8+46, **Undo 62+44**, Approve 114+149 | 56 → 56 | 14.88 → **14.88** |
| 768x1024 | Regenerate 8+143, Approve 600+160 | **Undo 159+44** in the free middle | 56 → 56 | 36.75 → 36.75 |
| 1280x800 (side panel) | Regenerate, Approve stacked, 327 wide | Regenerate 275 + **Undo 44** on line 1, Approve line 2 | 120 → 120 | 35.75 → 35.75 |

- **No height change anywhere,** so the canvas and the ≥ 14 px/m phone target are untouched. No label overflows: "Regenerate" and "Approve floor" were checked by scrollWidth, and the screenshots confirm it.
- **640x360 without the landscape rule** wraps Approve to a second line (tool row 56 → 108 px). That rule is required.
- **Movement when Undo appears:**
  - 360: Regenerate keeps its left edge and Approve keeps its right edge; each gives up about 10 px.
  - 768: nothing else moves.
  - 640: Approve's left edge moves 52 px. Its right edge stays put, so a thumb on Approve (right half) is still on it.
  - 1280: Regenerate's right edge moves. Mouse only, no risk.
- **Focus order** is Regenerate → Undo → Approve. After a press the button hides, so focus is lost to `body`. FS: move focus to `btn-regenerate`, mirroring how stage 1 handles its hidden Undo, so keyboard users don't lose their place.
- **Tests (Designer, in `plans-phone.spec`, where the tool row is already measured):**
  - with Undo shown (after one real drag): one-line tool row and an unchanged canvas height at 360x640 and 640x360, ≥ 14 px/m, 44 px target, no overflow;
  - mutation: drop the landscape rule, and the 640 check fails.
  - The FS's e2e covers behaviour (shown / hidden, press).

## 2. Q9: north marker in 3D

**Shape: a flat two-tone compass needle**, not a plain arrow, so the direction is unambiguous from any orbit angle.
- A diamond of length **L** and width 0.35 L, lying flat.
- North half: the triangle (N tip, E, W) in `siteColors.northMarker` #16212B (the 2D compass ink).
- South half: the triangle (S tip, E, W) in `poolRim` #E6E1D6 (light), as on a real compass.
- It is drawn as two thin prisms 0.04 m high (top faces at Y 0.04, above the 0.01 `groundCap` and the 0.02 parking pads), rotated about Y to `northDeg`, so the N tip points to the scene's north.
- No text: r128 without textures cannot draw an "N", and the two-tone needle is the convention.
- The tests the FS lists stand: it turns by exactly ΔN with Q5, and its N tip vector equals the A-13 north vector.

**Size.** `L = clamp(0.06 × max(plot bbox side), 1.5, 3.0)` m.
- That is 1.5 m on the sample and 3 m on a 50 m plot.
- At the reset pose the needle is about 12–20 px long on a 360 px canvas, the same size as the 2D compass.

**Place** (`site.northMarker: { u, v, L }`, computed in `site-outdoor.js` with the other yard items). Candidates in order:
1. the plot's front-left corner;
2. front-right;
3. back-left;
4. back-right.

Rules for each candidate:
- "Corner" means the bounding-box corner of the plot polygon, moved inward along the bisector until the needle's circle (radius L/2) lies inside the plot with 0.5 m to spare from the boundary wall.
- The first candidate wins whose circle is clear of footprint + 1 m, parking, pool + clearance, seating and the gate-to-entrance strip.
- If none is clear, use front-left anyway (decorative, never omitted: F4-S1 lists the marker, and no warning is wanted).

Front-left first keeps it on the street side, where the reset view looks from, and next to the gate (Left / Centre / Right are seen from the street).

**Colour checks:**
- ink vs the plot ground: ΔE 78 (summer), 82 (spring), 67 (autumn), 83 (winter snow);
- ink vs `poolRim`: 79, so the two halves separate;
- the light half on snow is only ΔE 9.5, but the dark half carries the read there.

## 3. Q11: boundary wall height and pool

**Boundary wall: 1.2 m.** Reasons:
- **One cut language.** Every wall the model draws stops at 1.2 m (house walls A-10, now site walls). A boundary wall taller than the house's cut walls reads as the most important object on the plot, which it is not.
- **The yards stay visible.**
  - Setbacks are often 1–3 m, and a 1.8 m wall hides most of a narrow side yard from the 50° reset pose and from low orbits.
  - At evening presets its shadow would cover the yard: sun at about 15° gives a 6.7 m shadow, against 4.5 m at 1.2 m.
  - The architect is checking parking, pool and seating placement against the setbacks.
- **Realism is not asked for.** No question sets the wall height, and the gate posts at 1.4 m (FS) read as posts only above a lower wall.
- **Retune.** It is a single constant (`C.SITE.wallH` or similar, FS's naming). If the client wants 1.8 m after the phone check, it is one number, and then the posts go to 2.0 m.

**Wall look:**
- **Size and colour:** 0.2 m thick, inside the edge, `siteColors.boundaryWall` #CDC4B2, no coping, top face flat.
- **Contrast with the ground:** ΔE vs grass 46 / spring 40 / autumn 29 / snow 20.
- **Contrast with the house walls:**
  - terracotta, grey and white: ΔE 44 / 19 / 17;
  - **sand: only 10.** That is acceptable, because the boundary wall is a thin ring at the plot edge while the house walls are a block in the middle, and the reset view never puts them side by side.
- **Gate:** a 3 m gap with two posts, 0.4 × 0.4 × 1.4 m in `exteriors.trim`.
  - **No gate leaf** (an open gate reads as the entrance). `siteColors.gate` stays unused, as A-10 allows.
  - I agree with FS Q7: no gate without the wall.

**Pool: yes, a flush water plane.**
- **Water:** `poolWater` #3FA7C9, at Y 0.03, exactly the pool rectangle, Lambert, opaque. It is a separate mesh (FS) so F4-T3 / F5 can tint it.
- **Rim:** a 0.3 m wide, 0.1 m high ring in `poolRim` #E6E1D6, outside the water rectangle with no overlap.
  - With the rim top at 0.10 and the water at 0.03, the 7 cm step casts a thin shadow line on the water's sunward edge from above, enough to read as "sunken" without a hole in the ground.
- **Contrast:** water vs rim ΔE 45; water vs grass 68, vs snow 43.
- **Not wanted:** no transparency, no darker "depth" band and no animated surface. All three cost shader or texture work outside the whitelist and add little from above.

## 4. Art direction for §5–§7 (and vegetation in F4-T3)

These follow the F3-T3 note (`docs/03-tasks/F3-T3/outcome.md` §7), in the A-10 wording. All colours go through `PC.three.col`.

### Roofs (`build-roof.js`)
- **Flat:** slab 0.2 m in `exteriors.roof`, parapet ring 0.3 m high × 0.15 m in `exteriors.parapet`. Roof vs parapet ΔE is 22–34 in every exterior, so the parapet reads as an edge.
- **Terrace:**
  - parapet 1.0 m (it is walkable);
  - pergola posts 0.15 m, 2.4 m high;
  - beams 0.1 m every 0.6 m over the back third, all in `exteriors.roof`, as A-10 assigns the pergola. Beams run across the short side, so there are fewer, longer bars.
- **Pitched:** as the FS proposes:
  - 30°, ridge along the longer side, no overhang;
  - slopes in `roof`, gable triangles in `wall`, so the gable ends read as continuations of the walls below.
  - An overhang is not needed for the read, and the prism stays simple.
- **Usable roof:**
  - stair head: a 2.4 m block in `exteriors.parapet` over `stairHead`;
  - **if a lift exists, a 1.2 m lift overrun block** in the same colour over the lift rectangle. A lift that stops below a usable roof looks wrong; this is optional for the FS, and A-9 does not list it.
- **Roof toggle on:** the roof hides the top floor's dollhouse view; that is the toggle's purpose. It is default off, and finder and tour force it off (A-10).

### Furniture (`build-interior.js`)
- **Boxes:** one box per model piece, bottom at the slab top (`floorY + y0`), cast + receive. The floor-tint quads at +0.015 pass through the boxes' bottoms (hidden), so there is no z-fight to handle.
- **No outlines, bevels or gaps.** The 0.15 m inset and the table colours carry the separation. The piece-vs-floor ΔE is ≥ 10.3 in every style (F3-T3).
- **Q18 rebuild:** colours only, boxes identical. The FS's "boxes deep-equal" test is the right guard.

### Outdoor items (`build-site.js`)
- **Parking:**
  - pads 0.02 m in `paving` (ΔE vs grass 47, vs snow 17);
  - canopy 0.1 m slab at 2.4 m in `carCanopy`;
  - posts 0.1 × 0.1 m in `carCanopy`, so the canopy reads as one object; trim-coloured posts look like a second object.
- **Seating:** pad 3 × 3 × 0.05 m in `paving`, centred on the free rectangle. On it:
  - a table 0.9 × 0.9 × 0.75 m at the centre;
  - two benches 1.6 × 0.45 × 0.45 m, centred 0.9 m either side of the table, parallel to the nearest façade (they face each other across the table);
  - all in `seating` (ΔE vs paving 33).
- **Entrance step:** 1.2 × 0.6 × 0.15 m, `exteriors.trim`. White trim on paving is only ΔE 6.5, but the step sits on grass or the path in front of the door, not on a parking pad.

### Vegetation (F4-T3, for planning)
- **Trees** (ΔE canopy vs ground 15–40 by season, F3-T3):
  - trunk: a cylinder of radius 0.12 m and height 2.6 m in `trunk`;
  - canopy: a cone of radius 1.35 m (≈ the 6 m² A-9 counts per tree), from Y 1.4 to 4.2 m, in the season's `canopy`.
  - The tall trunk is on purpose: in winter (canopies hidden) a 2.6 m trunk still reads as a bare tree, not a stub.
- **Shrubs:** a low cone of radius 0.7 m (≈ 1.5 m²), 0.8 m high, in the season's `shrub` (snow mounds in winter).
- **Variation:** per-instance scale 0.85–1.15 from the seeded PRNG, so rows don't look stamped.
- **Recommendation for the TL (A-9):** for trees, exclude footprint + 1 m **+ the canopy radius**. With only 1 m, a canopy overhangs the walls and hides rooms in the dollhouse view from above. Shrubs keep footprint + 1 m.

## 5. Open points for TL / FS
1. Hook name `plan-undo` (stage 1 owns `btn-undo`).
2. `site.northMarker` carries `L`, and its candidate order is as in §2.
3. Boundary wall 1.2 m (a constant), gate posts 1.4 m, no gate leaf.
4. Optional lift overrun on a usable roof.
5. Tree exclusion: footprint + 1 m + canopy radius (an A-9 change, TL).
