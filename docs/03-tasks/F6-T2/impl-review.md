# F6-T2 implementation review (TL), 2026-11-23

Reviewed: branch `f6t2` at 5ccfd2b.
- **Commits:**
  - S1 8133336, S2+S3 d4ce366, S4 58c42bf;
  - Designer retune 100dc9d; PM Q4 hall tile f96aa2e;
  - 0e43802 (shared glow plane);
  - exterior hide 400383c;
  - guard 8a0aab9;
  - release 922b498, 5f5d0d5;
  - QA picks ff2fa74, 93d2c90, 485d72e.
- **Read:** the src diff against ce4c95b (scene, look, build-interior, house, data, texgen) and the end of `impl-notes.md`.
- **Focused node run** (three/*, furnish, sky, texgen, lint): 208 of 208 green.

## Findings

1. **Condition for this verdict.** QA must sign off after 3 consecutive QA_FULL runs with no flakes (CTO §6.2c), on this head or a head that differs only in tests. I record the result as an addendum. If a run flakes, the verdict becomes CHANGES REQUESTED until the cause is fixed.
2. **Gate: met.**
   - Default runs 416.3 / 415.1 / 429.9 s: median 416.3 s, none above 440 s.
   - QA_FULL part 467.5 s.
   - C-4.8 solo 55–71 ms against the T2 budget of 250 ms, so the loaded guard is 1500 ms as ruled.
   - Texgen 87.7 ms.
   - The three-step time is 23.3–23.8 s against about 16 s on main, so the host was slower. The margin is thin, and the next feature needs to bring its own run-time savings.
3. **Release step running its processes one at a time (deviation 922b498): approved.**
   - Run in parallel, each process took 347–378 s and the 200-op stream's picks flaked ("not ready after 12 s"). CTO §6.2c forbids that.
   - Two at a time took 297 / 287 s, over the 260 s NOTE line.
   - One at a time, each process takes 203–226 s, within NOTE 260 s and limit 300 s. The C-4.8 solo step still runs first and alone.
   - **Cost:** the release wall time is about 651 s, run at each impl-review gate and at release. That only slows gates, not iteration.
   - **Kept:** `RELEASE_JOBS=N` for a faster machine. It is opt-in only, and gate runs use 1.
   - The CTO's limits are per process, and running fewer at once is stricter than §6.2d. The CTO is informed.
4. **Indoor real-r128 checks (a)–(e) moved to QA_FULL only (5f5d0d5): accepted.**
   - Moved: lit panes, highlight against lit windows, atlas seams, and the budget record.
   - Their mock-level counterparts stay in the default run: no extra lights, `indoor` creates nothing and leaves the shadow count unchanged, the transparent and additive rule, visibility composition, and lite.
   - Also still in the default run: the real first-Roof-off check (f) and the outdoor ground luma.
   - QA_FULL runs at every gate, so CTO §8 is still enforced before each merge.
5. **Exterior hide (400383c) meets my conditions and the CTO's.**
   - **Trigger:** `S.roof && sel === 'all'`, so it follows actual roof visibility. Only `furniture` and `textured-*` hide; glazing and glow stay.
   - **Shadows:** `applyVisibility` keeps its unconditional `shadowsDirty()`.
   - **Warm-up at build:** `precompile()` shows the hidden meshes for one `compile`, calls `initTexture(atlas)`, does a 1 px scissored draw with no shadow pass, then restores visibility. The first Roof-off frame takes 178 ms against 182 ms steady. Renderer memory is the same before and after.
   - **Mutations:** all four are caught.
   - **Pixel numbers** are recorded. Differences are at shadow edges only, and no interior shows.
6. **Indoor light (N1–N5).**
   - All emissive materials get their `emissive` colour at build, with intensity 0. `applyLook` changes only intensities, the glow colour and visibility, so no shader programs change.
   - The glow meshes sit inside their level groups, so a hidden level hides its glow through the parent (CTO §1.4). QA's magenta leak check is green.
   - The `count` prefix order (pools | spill | patches) follows ruling 3.
   - No `PointLight`, `SpotLight` or `emissiveMap` appears in src.
7. **Shadow signature (F4).**
   - The signature covers sun position and intensity, shadow-camera bounds and canopy visibility. A re-fit stays unconditional.
   - It is acceptable that the "sun fields only" mutation can't be caught on its own, since the shadow camera follows the sun. The "never marks dirty" mutation is caught on real r128.
8. **Disposal.** The glow meshes share the blobs' plane geometry, and `dispose()` frees each geometry once, which fixes the 26 → 28 rise QA found. The leak smoke in the default run (b2477cb) and the 200-op stream cover it.
9. **Budgets.**
   - Calls / triangles: 28 / 19.8k at 12 h and 32 / 20.0k at 22 h, in exterior mode.
   - The dollhouse mode carries the 24k-triangle interior and is within the ≤ 80 calls and ≤ 120k triangles limits.
   - Dist and its size delta are in the impl-notes, under C-1.3.
10. **Phone (CD-7).** The 22 h check must include Roof off (CTO). That goes into the request to the client; it is not a code item.

## Ruling recorded for status
- Deviation 922b498 is approved: release processes run serially by default, `RELEASE_JOBS` is opt-in, and each process stays ≤ 260 / 300 s.

VERDICT: APPROVED
