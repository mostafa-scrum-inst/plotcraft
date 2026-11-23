# F6-T2 Designer plan: TL review, 2026-11-23

Reviewed:
- `designer-plan.md` (3371175), against `cto-constraints.md` (650dba3);
- A-10, A-11 and A-13;
- the 48 before-shots.

The audit is accurate, and the MVP (N1–N5, I1–I3) fits every CTO limit:
- no lights;
- additive glow;
- 3 furniture materials per level;
- 40 meshes.

Approved with the rulings below. FS writes the T2 plan from them. In that plan, the comment-strip build step from CTO §5 comes **first**.

## Rulings
1. **Q1: `indoor` as a value per sky key. Approved.**
   - It blends like every other key (A-13), so it is a look change and creates nothing.
   - The sky golden is regenerated through its generator. The changed rows are only the new `indoor` column; no existing column changes.
   - Mock test (CTO §4): changing `indoor` leaves the shadow-update count unchanged.
2. **Q2: a separate `glazing` mesh. Approved** as the +1 inside the 40-mesh budget.
   - It is Lambert, with `vertexColors` (the glassTop → glassBottom gradient kept), and `emissive` and `emissiveIntensity` present from build time.
   - Its visibility follows `roofBatch` (exterior mode).
   - It receives shadows but does not cast them.
   - **A-16 readers:** the `roofBatch` decal items in `detail.test`, the QA T1b openings and roof-compare rows, and the view3d-real "glass darker than wall" day check, which must stay green at 12 h.
3. **Q3: window patches and ground spill inside `glow-<level>`. Approved, with an ordering rule.**
   - `count` can only show a prefix of the instances, so the order must be **[floor and lamp pools][ground spill][window patches]**.
   - In dollhouse mode, `count` = pools + spill. The patches would float above the 1.2 m cut walls, so they are hidden.
   - In exterior mode, `count` = all. The pools sit inside the closed house and are rejected by the depth test.
   - Ground spill exists only in the ground level's glow. Upper levels hold no spill instances.
   - **Tests:**
     - in dollhouse mode, no patch instance is below `count`;
     - level × Basement × Roof visibility composes (CTO §1.4);
     - QA's magenta leak check stays green.
   - The 75 % lit share is seeded per opening through `PC.house.hash`, so it is the same across rebuilds.
4. **Q4: floors move from pastel tints to materials with a 12 % tint. Approved technically. The PM decides the look.**
   - It changes the A-10 2D↔3D colour link for floors. I have asked the PM, who decides on the T2 before and after shots.
   - If the PM says no, the fallback is data only: raise the tint share (for example to 35 %) so 3D floors still echo the 2D room colours.
   - The 2D plans are unchanged either way.
5. **Q5: the I1 envelope heights. Approved.**
   - Every height is ≤ 1.1 m, so the CTO §2.2 cap holds and needs no PM check. I amend the A-11 schema text with `parts` and the new heights.
   - **Placement is unchanged:** the envelopes are still `w × d`, and QA's placement oracle stays valid.
   - **Unit test:** every part of every type at sizes S, M and L, and at the 1.5 m minimum room, lies inside its envelope.
6. **Q6: one interior atlas. Approved, with conditions.**
   - **Material:** Lambert, not Standard, so there is one lighting model (T1c Q-F1).
   - **Floors:** split at cell-tile boundaries so their UVs stay inside one cell, as planned.
   - **Furniture:** parts map the whole cell once, with no repeat.
   - **Padding:** the 8 px wrapped padding protects mip levels 0 to 3. Beyond that the cells blend, so keep their mean grey values within ±0.05 of each other. Far-mip bleed then stays invisible. texgen gets a unit test for this.
   - **Lite:** 256², as planned.
7. **Q7: restate "night is darkest" as outdoor ground luma at 22 h. Approved.**
   - The pixel probe moves to a region outside the plot (meadow or street).
   - Before and after numbers go in the T2 impl review, and the noon > evening > night order is kept there.
   - Indoor light gets its own check (CTO §8): at 22 h the windows are brighter than at 12 h.

## Other points for the FS plan
- **Program count:** `renderer.info.programs` must be unchanged between 12 h and 22 h on real r128 (CTO §8). Every emissive material needs its `emissive` uniform present from build time.
- **Highlight against lit windows at 22 h:** the highlight renders at about #C2410C and lit glass at about #E8C68A. Add a real-r128 hue/luma check that keeps them distinguishable, as the CTO requires.
- **Dist:** the comment strip lands first, with its own size line. F6-T2 data (part templates, style accents) must still show its own size delta.
- **Run time:**
  - new real-r128 checks fold into `view3d-real` and add at most +10 s;
  - a third release process only under CTO §6.2 conditions a–e;
  - the gate is the median of 3 quiet runs.

VERDICT: APPROVED

## Addendum: the PM on Q4
- **Binding text:** F4-S1, "rooms are distinguishable by type (floor tint and/or a label)". No story text ties the 2D and 3D colours together.
- **PM test:** the sample house at Reset with only Ground shown, at 360 and 1280. Neighbouring rooms of different types must clearly differ, at least bedroom, bathroom, kitchen and living/majlis.
- **Fallback:** about a 35 % tint for the failing types, in data.
- **Shots:** the Designer adds these Ground-only views.

### Addendum 2: PM decision on Q4 (2026-11-23, on the T2 after-shots)
Shots read: `q4-floors-sample-G-labelled.jpg` and the sample Ground-only views at 360x640 and 1280x800 (f6t2 branch, 100dc9d; tint 0.2).

**Decision: approved, with one data change. Floor materials stay at tint 0.2, and the hall moves off planks.** The 0.35 fallback is not used.
- **What passes:**
  - majlis (carpet), kitchen / laundry / bath / maid (tile) and the board-floored rooms clearly differ from each other at both sizes;
  - bedroom, bathroom, kitchen and living / majlis meet my test.
- **The weak pair that matters is hall vs living.** Hall and living are both planks, so the hall reads as part of the living room, and circulation is no longer visible as "hall", against F3-S1's "footprint not used by rooms is shown as hall".
  - Fix, data only: `PC.data.floors.kind.hall` becomes a non-plank kind. Use `tile`, or a plain stone/screed kind if the Designer prefers one, kept neutral (the `hall` tint).
  - The Designer re-shoots the labelled crop for the record. No new PM round is needed unless the hall then reads like the kitchen.
- **Living vs dining (and bedroom / office), all planks: accepted.** They sit behind walls, carry clearly different furniture (sofa vs table vs bed vs desk), keep a 0.2 type tint, and are named by "Go to room" and the tour caption. Raising them to 0.35 would bring back the pastel look the client called "too far from realistic" (CD-8).
- **Story:** F4-S1 is reworded from "floor tint and/or a label" to "floor material and tint, furniture and/or a label" (goals-and-stories round 17).
- **Release notes:** the floor-colour line is reworded.
