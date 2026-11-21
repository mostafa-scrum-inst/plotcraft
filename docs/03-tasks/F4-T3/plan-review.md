# F4-T3 plan review (TL, step 3b), 2026-11-21

Reviewed:
- `plan.md` (FS);
- `designer-plan.md` (Designer);
- `camera-decision.md` (PM + Designer);

against:
- F4-plan F4-T3;
- my F4-T2 `outcome-review.md` routing items 1–7;
- architecture A-9, A-10, A-11, A-13 and A-16.

The plan covers the scope with the right seams: scatter in core, `PC.sky.compute` pure, and `applyLook` recolour-only with no create or dispose. Its tests and mutations aim at the real risks. The only required work is reconciling it with designer-plan, which landed after the FS plan. That work and the rulings below go into `plan.md` before code. No re-review is needed: I check them at the implementation review.

## Required changes (before code)

1. **Reconcile with `designer-plan.md`.** The plan's §3 still uses the F4-T2 sizes and 8 / 10 / 8 segments.
   - **Data key.** `PC.data.vegetation` (Designer §1) is **approved** as a new key in `data/look3d.js`: data layer, literals only. A schema test goes in `data-tables.test.mjs`.
   - **Geometry from the table.** Build it from the table, not from literals:
     - trunk `CylinderGeometry(trunkR, trunkR, trunkH, trunkSeg = 6)`;
     - canopy `ConeGeometry(canopyR, canopyH, canopySeg = 8)` with its base at `canopyY0`;
     - shrub `ConeGeometry(r, h, seg = 7)`;
     - scale range `scale`.
   - **Clearances from the table.** The scatter takes its clearances from the same table: the tree clearance is `canopyR × scale[1]` (1.5525). There must be no literal 1.55 / 1.35 / 1.15 in core or three.
   - **Counting areas.** The A-9 counting areas (6 m² and 1.5 m²) stay as they are. The Designer test keeps the drawn areas within 10 % of them.
2. **Sky values: exact, with the A-10 rounding.**
   - `PC.sky.compute` must reproduce the Designer §2 table **exactly**: 16 rows × background / sunColor / hemiSky / hemiGround, and the intensities to 1e-9.
   - The rule is the reference in `data-tables.test.mjs`:
     - key lerp with the A-10 mix, rounded per channel;
     - then the season blend with the same mix, rounded again.
   - Do not "interpolate in floats and round once". The ±1 tolerance in Designer §2 is not taken. `sky.test` carries the 16 rows as a golden table.
   - Moving the mix to core as `PC.sky.mix`, with `three.mixHex` as an alias, is approved. That keeps one rule and keeps three out of core.
3. **Light tab (Designer §3).**
   - Add the preset `aria-pressed` rule to §6: pressed only while the hour equals the preset value, Noon pressed on open, cleared by dragging off it.
   - Add the `pc-range--sky` class to §6 and §9. The markup is the Designer's.
   - Season stays a `select`.
   - The disabled set in `view3d.spec` shrinks to the room finder and tour, with the Designer's style check moving in the same commit.
4. **Camera.** Decision (a) is recorded and the PM ruled **no hint line**. Delete the hint-line paragraph from §1 and §6. A-12 and A-14 are unchanged.
5. **Seed.**
   - Seed from the plot points (rounded 1e-6) and the street edge only, **not** the vegetation %. A Q4 change then reuses the same shuffled candidate order, and the garden changes by additions and removals instead of a full reshuffle.
   - Determinism is tested as planned.
   - A-9 already says "seeded from the plot points"; the street edge is added because frame L depends on it.
6. **Mock conformance.**
   - Every new mock member is added to the A-16 conformance test against the vendored r128 in the same change as the whitelist entries: `InstancedMesh` with `count`, `setMatrixAt`, `instanceMatrix.needsUpdate`, `castShadow` and `receiveShadow`; `CylinderGeometry`; `ConeGeometry`; `Matrix4.compose`; and the shadow-camera fields the fit writes.
   - `setColorAt` stays off the whitelist (Designer §1).

## Rulings on §11

1. **Tree boundary distance: approved, derived rather than literal.**
   - Tree centres stay ≥ `canopyR × scale[1] + 0.2` (1.75 m) from every plot edge.
   - Shrubs stay at 0.7 m.
   - The rule applies with or without the wall: one rule, and no canopy over the neighbour's plot.
   - A-9 is updated (done, see below).
2. **Shortfall warning: a product question, routed to the PM.**
   - FS proceeds with **no warning**. `site.vegPlaced` (m², nominal counting areas) goes into the model so QA can see it, and `veg.reduced` keeps meaning the budget clamp only.
   - **PM question:** when the exclusions leave visibly less planting than the Q4 %, should stage 2 or stage 5 say so? If so, give the text and the threshold (e.g. placed < 80 % of `veg.area`).
   - If the PM says yes, it is one `validate` entry plus the text, added in F4-T3 without a new plan review.
   - FS reports in impl-notes how often a shortfall occurs on the sample, the F4-T2 test plots and a 16 × 18 m plot. The sample must stay within 20 % (A-9).
3. **Extra exclusions: approved.**
   - Both kinds:
     - seating pad + 0.3 m;
     - north-needle circle `L / 2 + 0.3`.
   - Trees only:
     - parking (pads and canopy) and pool + `POOL_CLEAR`, each grown by the tree clearance `canopyR × scale[1]`, so no canopy meets the 2.4 m carport roof or overhangs the water;
     - footprint + 1 m + clearance, as ruled.
   - Shrubs use the A-9 rectangles.
   - The path strip is the same for both kinds: a canopy above the path at 1.4 m or more is allowed.
   - Centre-to-centre spacing as planned. The spacing makes the "rectangles on the item centre" test valid, because the clearances already include the radius.
4. **Shadow box: approved.**
   - The boundary wall is excluded.
   - The fit is in light space and runs on build and on every `applyLook`.
   - Keep the `shadowR × house.radius` cap, the 1024 map and the single shadow light.
   - The fit writes only the existing shadow camera's fields plus `updateProjectionMatrix`, with no new objects (the look test counts this).
   - Hidden winter canopies may stay in the box: one rule, at a small loss of texels.
5. **Session look: confirmed.**
   - Hour and season live in the session, like level and Roof.
   - They are kept across stage changes and across a rebuild or context restore (`build` re-applies the stored look).
   - They reset to 12:00 summer only on a page load.
   - They are not in the draft (A-4), and a whole-state replace (Start new / Resume) does not reset them.
6. **QA's F4-T1 pixel checks.**
   - **The sample stays unchanged.** Its vegetation % is the PM's sample (stories 6.2) and must show trees: that is the F4-S1 criterion.
   - QA's F4-T1 shell and colour signatures become marker-gated on `PC.scatter`. With the marker present, QA either uses its own fixture with vegetation 0 % for shell-only signatures or masks the yard. QA chooses per check, but no FS code path exists only for tests.
   - The FS's own `view3d-real` shots are updated in the same change.
7. **Run time.**
   - One new e2e file (`view3d-look.spec`) is allowed. It uses at most 2 viewports and one page load per viewport.
   - The real-r128 additions go into the **existing** `view3d-real` page loads, with no new launch, and add ≤ 10 s.
   - Gate: the FS measures a full run at `--jobs 3` before the implementation review and records it in impl-notes.
     - Over 420 s: the FS folds the look checks into `view3d.spec` first, then trims duplicates (A-16), before asking for review.
     - The 600 s hard line is unchanged.
   - QA's F4-T3 suite follows the F4-T2 split pattern, with its runner kept short.
8. **Removing `noonLook` / `noonSunDir`: approved, in two commits.**
   - First, a unit test pins `compute(12, 'summer', N)` against **literal goldens** captured from the current helpers: light colours, intensities, `sunDir` at N = 0 and N = 90, and the background.
   - Then remove the helpers. The goldens stay, so continuity is still tested after the removal.

## Other checks (non-blocking)
- **Scatter budget.** The ≤ 50 ms scatter budget on the maximum house is right. The house build must still stay inside its existing budget (state it in impl-notes).
- **`PC.site.blocked` export.** Approved. It returns new arrays, so callers cannot mutate the memoised site.
- **InstancedMesh shadows.** Instanced meshes cast shadows in r128. The real-r128 test asserts one shadow-casting directional light, and that the trunk and canopy pixels darken the ground at 17.5 h.
- **G6 budget test.** As planned. Also assert that the `InstancedMesh` counts equal the model counts after every look.
- **Mutations.** The plan's list is good. Add three:
  - the tree boundary distance at 0.7 m;
  - a hard-coded clearance instead of the table value;
  - single rounding in the sky blend (the golden must catch it).

## Architecture / plan updates (done in this review)
- **A-9** gains an "F4-T3 plan review" note: the seed, the clearances read from `PC.data.vegetation`, tree boundary 1.75 m, the extra exclusions, `vegPlaced`.
- **A-13** gains a note on the rounding rule, the Designer golden table, and the session look.
- **F4-plan** gains an F4-T3 rider.

VERDICT: APPROVED
