# G2 plan (FS): the ultra tier on /gpu

Scope: G-plan section 6, TL G1 notes N5 (warm-up shadow pipelines) and the shadow-bias re-tune for 4096. /gpu only;
the standard page keeps its tiers and its behaviour (default suite green with no expectation edits).

## 1. Tier data (`PC.C.VIEW3D.tiers`, core/const.js)
- Per-tier `shadowMap` and `aniso` fields replace `fineShadow` / `shadowMapFine`. full keeps 2048 on fine pointers
  with maxTextureSize >= 4096, and 1024 otherwise (`VIEW3D.shadowMap`). lite keeps 1024. Anisotropy stays 4 on both.
- New `ultra`: tex 1024, shadow 4096 (PCF soft as full), aniso 16, treeDetail 2, maxDpr 2, its own `shadowBias` /
  `shadowNormalBias`, `colorBuffer` ('half' | 'byte'), and `probe` / `moving` records (thresholds as data).
- `pickTier` reads these fields from the tier record. Optional fields fall back to the VIEW3D bias and to null.
  `three.texture` takes the tier's aniso, and leaving it out still gives 4.

## 2. Gate (gpu adapter, once per page session at the first `make()`)
- The tier is `PC.gfx.force`, set by tests before stage 5. Otherwise it is ultra when `matchMedia('(pointer: fine)')`
  matches and `adapter.info.isFallbackAdapter` is not true, and full in every other case.
- scene.js already passes `PC.gfx.tier` to pickTier as `force`.
- SwiftShader reports `isFallbackAdapter: true`, so QA_GPU runs at full with no override. The ultra checks report the
  same adapter as not a fallback through an init script.

## 3. Frame probe and pixel ratio (gpu adapter; scene.js gives it a small handle)
- scene.js `frame(ts)` passes `{ ts, chained, tier, view }` to `PC.gfx.frame`. `chained` means the previous frame
  requested this one (an animation). r128's `frame` ignores the argument.
- What counts as a moving frame, and what is timed:
  - A frame moves when it is chained, or when it comes within `moving.gapMs` (250 ms) of the previous drawn frame.
  - Only moving frames are timed, as rAF timestamp deltas.
  - An idle view draws nothing, so it is never timed.
- **Downgrade:**
  - If the median of the first `probe.frames` (30) moving frames is over `probe.slowMs` (24 ms), the view drops to
    `probe.down` (full), once per page session.
  - The drop waits for rest, and never happens during an animation or a build.
  - 24 ms sits between one 60 Hz vsync (16.7 ms) and two (33.3 ms). A median above it means most frames miss
    60 Hz, about 40 fps or less.
- **Pixel ratio while moving:**
  - If the median of the last `moving.frames` (10) moving frames is over `moving.slowMs` (20 ms), the pixel ratio
    drops to `moving.dpr` (1.5) at once, in that same frame.
  - At rest (`moving.restMs`, 300 ms without a frame, measured by a timer so no rAF runs), one frame is drawn at the
    tier cap.
  - This step is cheaper, so it reacts sooner (10 frames rather than 30) and to a lower threshold.
- **The handle `VIEW` in scene.js:**
  - `dpr(k, draw)` sets the pixel-ratio cap (`S.prCap` in `dpr()`).
  - `busy()` reports whether a rebuild now would clash with an animation, a build, a close or a loss.
  - `retier(name)` swaps in the tier record, the shadow map size and the bias. It then cancels any requested frame
    and rebuilds the same house: pose, level, Roof, look and selection are kept (the ui gets no null selection),
    there is no Building card, and the old frame stays on the canvas while the new build compiles.

## 4. Shadows
- The bias is re-tuned for 4096 by measurement (section 5, check (s)). The starting point is the same depth bias and
  half the normal bias (half the texel size).
- N5: the warm-up renders once with the precompile meshes shown, so the furniture and textured-part shadow pipelines
  get built. A second render follows with the real visibility. Both run in one task, so only the second is presented.
  Checked by the pipeline count with the Roof off.

## 5. Colour buffer
- Try `colorBufferType: UnsignedByteType` on ultra through `tiers.ultra.colorBuffer = 'byte'`.
- The test capture uses the renderer's own colour buffer type, so it measures the same precision as the canvas.
- Keep whichever passes the image check without visible banding (count the distinct sky levels at night).

## 6. Tests
- **Unit (tests/three/tier.test.mjs):**
  - pickTier gives the old values on full and lite, plus the ultra record.
  - The probe runs in a vm with a fake renderer, view and timers: the pixel-ratio drop and its return at rest; one
    downgrade at rest, held back while busy, never repeated; gaps between frames are not timed.
- **QA_GPU tests/gpu/ultra.mjs:**
  - (t) The gate.
  - (p) Parity: ultra vs full differ only in the canopies' vertex counts (and texture sizes).
  - (i) The image check against r128 full, run once, with the wider ULTRA_TOL documented in the file.
  - (s) Shade and lit ground points, ultra vs /gpu full.
  - (N5) No new pipelines with the Roof off.
  - (d) Forced slow frames (a busy loop in an rAF wrapper): 1.5 while flying, 2 at rest with one frame; one quiet
    downgrade (one rebuild, no card, pose and selection kept) and no second one; 0 idle rAF.
- The image helpers move to tests/helpers/gpu-image.mjs so parity.mjs and ultra.mjs share them.
- The whole QA_GPU run stays under about 120 s.
