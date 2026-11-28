# G2 outcome (FS): the ultra tier on /gpu

Plan: docs/03-tasks/G2/plan.md. G-plan section 6, plus TL G1 notes N5 and the bias re-tune.

## What was built
- **Tier data** (`PC.C.VIEW3D.tiers`): the per-tier fields `shadowMap` and `aniso` replace `fineShadow` and
  `shadowMapFine`.
  - full and lite give the same shadow maps, pixel ratios, textures and anisotropy as before. Unit-checked in
    tests/three/tier.test.mjs against the old cases.
  - New `ultra` record: shadow 4096 with PCF soft, textures 1024, anisotropy 16, tree detail 2, pixel-ratio cap 2,
    bias -0.0005 and normal bias 0.01, colour buffer half float, plus the `probe` and `moving` thresholds.
- **Gate** (gfx-webgpu.js, once per page session): `PC.gfx.force` (tests) wins. Otherwise ultra when the pointer is
  fine and `adapter.info.isFallbackAdapter` is not true, else full.
  - Measured here: SwiftShader reports `isFallbackAdapter: true`, so QA_GPU runs at full with no override.
  - The ultra checks fake a non-fallback adapter in an init script.
- **Frame probe and pixel ratio** (gfx-webgpu.js, fed by scene.js `frame()`). Thresholds and their reasons are in
  plan.md section 3.
  - The probe times only moving frames: chained by an animation, or within 250 ms of the previous frame.
  - Downgrade: if the median of the first 30 moving frames is over 24 ms, the view drops to full once per page
    session. The drop happens at rest, never while an animation or a build runs.
  - Pixel ratio: if the median of the last 10 moving frames is over 20 ms, the pixel ratio is 1.5 until rest. Rest is
    300 ms with no frame, timed by a timer, so no rAF runs. One frame is then drawn at the tier cap.
  - The downgrade is `VIEW.retier` in scene.js. It is a quiet rebuild of the same house: no Building card; the pose,
    level, Roof, look and selection are kept. The requested frame is cancelled first, so no frame of the old build
    is drawn while the new one compiles; see deviation 3.
- **N5:** the warm-up renders once with the precompile meshes shown, then once with the real visibility, in the same
  task.
  - Sample house: 19 pipelines after compileAsync and 34 after the warm-up. Before, it was 32, plus 2 more on the
    first Roof-off frame.
  - With the Roof off: 34, so nothing new is built.
  - Both warm-up renders together take 16-17 ms at ultra, so this is cheap and it stays.
- **Capture:** the render target now uses the renderer's colour-buffer type, so the image check measures the same
  precision as the canvas.

## Measurements (this container: SwiftShader, headed Chrome on Xvfb)
- **Image, ultra vs r128 full** (sample house, 4 presets, 640x480):
  - Worst values: sky 0.1, ground 0.3, wall 2.9, side 4.0, needle 0. Full measured 4.7 for the side.
  - ULTRA_TOL is 3 for unlit regions and 8 for lit ones (parity.mjs uses 6). ultra's sharper 4096 shadow edge and
    1024 textures can move a box mean more than full's do. 8 is the worst measured value with a margin, and it still
    catches the planted bias mistakes below.
- **Shadows and acne**: ground points around the house, in a cast shadow or sunlit (raycast on the standard page;
  21 / 12 / 42 shaded points at morning / noon / evening). Means on ultra vs /gpu full:

  | Bias (depth, normal) | Shade and lit ground vs full | Walls vs r128 | Result |
  |---|---|---|---|
  | -0.0005, 0.01 (chosen) | ≤ 2 | ≤ 4.0 | pass |
  | -0.0005, 0.02 (full's) | same | same | pass |
  | -0.00025, 0.005 | same | same | pass |
  | 0, 0.004 | same | same | pass |
  | 0, 0 (`GPU_ACNE=1`, planted) | ground fine | sunlit morning wall 28.5 darker | **fails (i)**: acne |
  | -0.005, 0.3 (planted leak) | morning shade 4.9 brighter | noon wall 9.7 | **fails (s) and (i)** with SHADE_TOL 3 / ULTRA_TOL 8 |

  - Chosen: the same depth bias and half the normal bias. One 4096 texel is half a 2048 texel, so the normal offset
    is the same in texels. It is 2.5 times clear of the first setting that shows acne.
  - Luminance noise (standard deviation in boxes) was tried as an acne measure and dropped. The ground texture and
    the wall openings dominate it, and the planted bias 0 did not raise it. The acne shows as a darker mean, which
    the image check catches.
- **Colour buffer** `UnsignedByteType` (`GPU_CBUF=byte`):
  - It passes every mean check. Worst values: sky 2.0 at night, needle 1.0, ground 2.1.
  - But the night sky bands: the top 30% of the frame has 18 distinct colours (half float: 130). Hour 20.5 gives 23
    vs 163; at noon it is 459 vs 546.
  - The cause is that the buffer holds linear values: below sRGB ~13 there is one 8-bit step.
  - **Kept half float.** The memory cost (G-plan 6: ~170 MB at 2880x1800) is handled by the pixel-ratio drop and the
    downgrade.
- **Frame times**: SwiftShader at 480x360 device px (320x240 css at dpr 1.5) draws at ~50 ms a frame by itself, so
  the probe there downgrades (median 50.0 ms).
  - The pixel-ratio check runs with ultra's probe off on its own page, so it tests the pixel-ratio rule alone.
  - The G-plan target (60 fps orbiting at 1440p on a recent laptop with integrated graphics) cannot be measured in
    this container. It is still open and needs a real device.
- **Run times**:
  - `node build.mjs && node tests/run-all.mjs --unit --three`: green, 29.5 s.
  - QA_GPU (`QA_GPU=1 node tests/run-all.mjs --gpu`): flows 67/67, parity 47/47, ultra 68/68 (182 checks), 106.9 s.
    ultra.mjs alone is ~52 s.
  - Full default run (`node tests/run-all.mjs`): green, 343.6 s, with no test expectations edited.

## Deviations
1. **dist/index.html changes beyond the tier records.** scene.js is shared, so the probe plumbing lands on the
   standard page too:
   - the `frame()` argument, `S.chain`, `S.prCap` in `dpr()`;
   - the `VIEW` handle, including `retier`;
   - two fields in `info()`.

   The retier has to rebuild through scene.js internals, so it cannot live in the gpu adapter. On the standard page
   it is inert: its tiers have no `moving` record, and r128's `frame` ignores the argument. No test expectations were
   edited. The full default run is the check.
2. **The pixel ratio drops after 10 slow frames, not on the first slow frame.** This avoids one hitch changing the
   resolution. The downgrade decision counts the frames already drawn at 1.5. So when 1.5 is enough, ultra stays, and
   the device keeps ultra's shadows and textures with a lower pixel ratio only while moving.
3. **The downgrade waits for rest** (also after a paused tour ends). Rebuilding during a tour would end it: `build()`
   stops animations.
   - Found by the test: a frame already requested before the rebuild drew during `compileAsync`, and r180 threw
     "setPipeline ... not a GPURenderPipeline". So `retier` cancels the requested frame first, and the rest handler
     does the downgrade before the pixel-ratio frame.
   - The same r180 hazard could in principle hit a device-loss restore (TL G1 N3). It was not seen.

## Known limits
- ultra's frame-time behaviour on real GPUs is unmeasured; see Measurements.
- The gate reads `adapter.info.isFallbackAdapter`, which Chrome sets for SwiftShader. Other browsers may not set it,
  in which case they get ultra and the probe decides.
- `tests/gpu/ultra.mjs` knobs for measurement only: `GPU_BIAS`, `GPU_CBUF`, `GPU_ACNE`.
