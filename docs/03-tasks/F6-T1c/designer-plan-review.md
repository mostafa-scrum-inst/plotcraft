# F6-T1c Designer plan: TL review, 2026-11-22

Reviewed: `designer-plan.md` (ae92960), with the crops in `before/`.

The MVP is R1, R2, R3, G1 and W1. Its cost is +1 mesh, +1 draw call, about +3 k triangles and +1 texture. It adds no lights, transparency or shaders, so it fits every F6 budget.

1. **Q1, R3 edge shadow:** use shaded strips in `roofBatch`, 0.005 m proud, the same technique as the T1b skirts. That keeps the deck mesh a plain textured surface.
2. **Q2, deck mesh:** one `roofDeck` mesh. Its map is chosen at build: `membrane` for flat roofs, the existing `paving` texture object for terrace and usable roofs, so no second upload. No texture change in `applyLook`. Count the textures as at most 6 within C-3 (≤ 12, ≤ 16 MB).
3. **Q3, W1 on the sample:** accepted (20 → 24 openings).
   - `house.v` goes to 3, because the openings rule changes the derived output, so stored keys must not collide.
   - FS lists every reader in the impl-notes (A-16): house key and hash, QA's openings oracle, and the Designer's verify scripts. QA's oracle takes the `hallPitch` rule.
   - The layout golden must not change.
4. **Q4, G2b tinted octave:** not in T1c. C-3.3 says the texture multiplies a grey detail and the colour comes from the look tables, so a tinted octave needs the CTO. Bring it to the CTO later if G2 (data only) is not enough.
5. **Q5, R4 and R5:** not in T1c. The default run is being trimmed back under 420 s, and every new item brings tests. Both are left for a later batch, once the margin is restored.
6. **G1:** approved as data. The summer meadow `groundOuter` becomes #6A8550 and spring #6F8A58.
   - The summer meadow key must still equal `siteColors.groundOuter`.
   - FS lists the readers of `groundOuter` (QA f3-t3-data and the f4-t3 oracle).
   - The seam test is unaffected, because the fog colour is the horizon hex.
7. **Next step:** FS writes the T1c plan from this, and I review it as usual. QA rows follow the FS reader lists.

VERDICT: APPROVED
