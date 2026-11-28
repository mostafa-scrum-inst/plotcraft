# G1 outcome (FS): WebGPU parity page

Status: built, own tests green; waiting for TL implementation review and QA. Numbers below are from this container
(4 CPUs, SwiftShader).

## What was built

- **Adapter `PC.gfx`** with one implementation per page, same shape, callback style:
  - `src/js/three/gfx-r128.js` (standard page only, manifest `targets: ["standard"]`): renderer creation and settings,
    `col()`, texture encoding, max texture size, anisotropy, exposure, light factor 1, `shadowMap.needsUpdate`, the
    F6-T2 precompile (sync compile + 1 px scissor draw, flags saved and restored), the canvas
    `webglcontextlost/restored` listeners. The code is the old code moved, member for member, so the strict mock sees
    the same reads and writes; `make` / `precompile` call `done` synchronously.
  - `src/gpu/three/gfx-webgpu.js` (gpu page only): waits for the bootstrap, device gate (`navigator.gpu`,
    `requestAdapter()`, device from that adapter, `renderer.init()` on the WebGPU backend, never three's WebGL2
    fallback), `NoToneMapping`, per-material `outputNode` = ACES with a shared exposure uniform (for materials r128
    tone-maps) then the fog mixed **in sRGB** after it (as r128 does: fog after encoding) with `material.fog = false`;
    `col = new Color(hex)`; lights x PI; `colorSpace` on textures; `light.shadow.autoUpdate = false / needsUpdate`;
    `compileAsync` + one hidden warm-up render; `onDeviceLost` (ignores `destroyed`, max 3 losses a session); a
    render-target capture hook for tests.
- **scene.js / util.js / look.js**: every version-specific line goes through `PC.gfx`. `build(house, done)` has a
  continuation; a build sequence number makes a stale continuation a no-op; an asynchronous precompile is followed
  by `applyVisibility()` + `apply()` (re-apply, not restore); `setup()` runs once per canvas and the renderer is
  swapped by the loss handler (`LOSS.restored(r)`); frames are not requested while a build compiles
  (`S.pending`). `open()` shows Building... while /gpu waits for the module and the device, and waits for the latest
  house. New: `info().compiling`, `info().gfx`, `PC.view3d.capture(done)`. `pickTier` takes `env.force`
  (`PC.gfx.tier`: `full` on /gpu, `null` = as before on the standard page).
- **Build** (`build.mjs`, new `build-targets.mjs`): `dist/index.html` and `dist/gpu/index.html` from one
  `src/index.html` with `<!--@IF standard-->` / `<!--@IF gpu-->` blocks. External-reference check per target.
- **Bootstrap** (inline in the gpu block of `src/index.html`): classic script, `import()` of
  `https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/three.webgpu.min.js` with `.then/.catch` and a 20 s timeout;
  sets `globalThis.THREE` and settles `PC.boot3d` (`loading | ready | failed | timeout` + waiting callbacks).
- **Lint** (`tests/lint-constraints.mjs`): `src/index.html` is linted once per target; `dist/gpu/index.html` gets the
  same rules, `scanExternalGpu` (no external tag, exactly one URL = the bootstrap's, the bootstrap exactly once and
  before the app scripts, no r128 tag), the budget and the vendor scan (now also the 0.180 licence banner). The exact
  `GPU_BOOT` text is exempt from `import-dynamic` and `ui-no-three` (it assigns the THREE global) on the gpu target
  only; nothing else changed.
- **UI**: stage 5 bar (where Next is hidden): standard page "High-end 3D (WebGPU)" -> `gpu/index.html`, only when
  `navigator.gpu` exists (`shell.js`, feature check only); gpu page "Standard version" -> `../index.html`. The gpu
  unavailable card: "This device or browser does not support WebGPU." + "Open the standard 3D view" ->
  `../index.html` (CD-11). No `data-pc` hooks were added (the hook contract is unchanged).
- **Tests**: `tests/unit/gpu-build.test.mjs`, `tests/three/gfx.test.mjs` (default run); `tests/gpu/parity.mjs`,
  `tests/gpu/flows.mjs`, `tests/helpers/gpu.mjs` (QA_GPU only); `tests/vendor/three-0.180.0/` (two files, README
  entry with hashes); `run-all.mjs` QA_GPU step.

## Files

New: `build-targets.mjs`, `src/js/three/gfx-r128.js`, `src/gpu/three/gfx-webgpu.js`, `dist/gpu/index.html`,
`tests/helpers/gpu.mjs`, `tests/gpu/parity.mjs`, `tests/gpu/flows.mjs`, `tests/unit/gpu-build.test.mjs`,
`tests/three/gfx.test.mjs`, `tests/vendor/three-0.180.0/*`, `docs/03-tasks/G1/*`.
Changed: `build.mjs`, `src/manifest.json`, `src/index.html`, `src/js/three/scene.js`, `src/js/three/util.js`,
`src/js/three/look.js`, `src/js/ui/shell.js`, `src/css/20-shell.css`, `src/css/44-stage-3d.css`,
`tests/lint-constraints.mjs`, `tests/run-all.mjs`, `tests/vendor/README`, `dist/index.html`.

## How to verify

- `node build.mjs && node tests/run-all.mjs` (default, unchanged expectations).
- `QA_GPU=1 node tests/run-all.mjs --gpu` (only the /gpu suite) or `QA_GPU=1 node tests/run-all.mjs` (everything).
- By hand: serve `dist/` over http (WebGPU needs a secure context), open `/gpu/index.html` in desktop Chrome.

## Results

- Default run `node build.mjs && node tests/run-all.mjs` on dfba6a7: **all steps passed in 342.9 s** (three step
  19.6 s, 17 files); no existing expectation edited. An earlier run failed only QA F1-T1 "src/href attributes are
  the three tag, #fragments or data:, only" (the CD-12 link's `href`): fixed by setting the links' `href` from
  `shell.js` (`data-alt`), not by touching the check.
- `QA_GPU=1 node tests/run-all.mjs --gpu`: **2 files, 104 checks, all passed, wall 51.8 s** (parity ~22 s, flows ~21 s
  plus browser/Xvfb start).
- Parity (a): sample, sample with pitched roof, maximum house: identical mesh lists (name, kind, vertex / index counts,
  instance counts, visibility) on both pages at tier full.
- Image (g), worst per-channel difference of the region means over the four presets: sky 0.1, outer ground 0.3,
  front wall 2.8, side wall 4.7, north needle 0 (exact #16212B). Tolerances 3 (unlit) / 6 (lit). Planted mistakes
  (`GPU_MUTATE=lightK|exposure|col|tone`) move lit regions by 76 / 33 / 105 / 28 and all fail the check.
- compileAsync does not cover the shadow pass: sample 19 pipelines after it, 32 after the warm-up render (maximum
  house +16 more after warm-up); compileAsync 50-130 ms on SwiftShader.

## Deviations from the design (and why)

1. **Manifest**: gpu-only files cannot be in `manifest.js` (the existing lint unit test and QA f1-t1-static require
   every `manifest.js` entry inlined in `dist/index.html`, and every file under `src/js` listed there). So
   `manifest.js` entries take `targets` (gfx-r128.js: standard), and gpu-only files live under `src/gpu/` and are
   listed in a new `targetFiles` list with `after` (the slot they take).
2. **`PC.gfx.ready` is `PC.boot3d`**: the bootstrap runs before any app script, so it cannot settle a member of
   `PC.gfx`; it owns `PC.boot3d`, and `PC.gfx.make` waits on it (so `PC.view3d.open` does).
3. **Headed Chrome on Xvfb for QA_GPU** (not headless): measured here, in headless Chrome a WebGPU device that presents
   to a canvas is lost with reason `destroyed` within a few frames (SwiftShader adapter, every flag combination
   tried); a headed Chrome on a private Xvfb display with `--use-vulkan=swiftshader` keeps it. Each QA_GPU file starts
   its own Xvfb. The fallback test (c) runs headless without the WebGPU flags.
4. **Device from our own adapter**: the renderer gets `device` from the adapter the gate requested (all its features),
   so the gate and three use the same adapter.
5. **Fog mixed in sRGB inside the outputNode** (spike item 4 said `mix` in linear): r128 mixes fog into the encoded
   output, so the node converts to sRGB, mixes with the raw horizon colour, converts back. Fully fogged ground then
   reads the horizon hex as on the standard page.
6. **Capture hook**: 4x MSAA half-float render target (like the canvas), drawn as a frame of its own
   (`PC.gfx.frame`, round 2; it was the next animation frame before), with the sun's
   `shadow.needsUpdate` set (r180 keeps one shadow map per render context), and the rows un-padded (256-byte copy
   alignment).
7. **compileAsync and shadows**: it does not build the shadow-pass pipelines (sample house: 19 pipelines after
   `compileAsync`, 32 after one render), so the hidden warm-up render before 'ready' is always done. compileAsync is
   called with frustum culling off for the call (r128's `compile` ignores the frustum) and the precompile meshes shown.
8. The sky dome (unlit, no normals) gets a zero `normal` attribute on /gpu: r180 otherwise warns
   "Vertex attribute normal not found" for it.

## Known limits

- (Round 2: resolved.) r180's own `requestAnimationFrame` loop from `init()` is stopped; `PC.gfx.frame(r)` does
  its work per app render. It uses two private members of the pinned 0.180.0 (`renderer._animation`,
  `renderer._nodes.nodeFrame`); a three.js upgrade must re-check them (the QA_GPU (i) check fails if the loop runs).
- The /gpu page is published only as files (`dist/gpu/index.html`); publishing and the real-device / iframe check
  (G0 item 2) are the orchestrator's.
- Shadow bias is unchanged (`-0.0005` / `0.02`); the image check shows no acne difference that matters at tier full
  (walls within 4.7 per channel). Re-tune with the 4096 map in G2.
- The QA_GPU suite needs `Xvfb` (present here); without it the run fails with that message (round 2).

## Round 2 (TL impl review: CHANGES REQUESTED)

- **Required change 1 (three's own frame loop).** `gfx-webgpu.js` `make()` stops `renderer._animation` after
  `init()`. The new adapter member `PC.gfx.frame(r)` does one tick of that loop: on /gpu it runs `info.reset()` when
  `autoReset`, then `nodeFrame.update()` and `info.frame`; on r128 it does nothing. It is called before scene.js
  `render()`, before the warm-up render and in `capture`, and capture's next-frame wait is gone. New QA_GPU flows
  check (i): a counting `requestAnimationFrame` wrapper sees **0 calls in 2 s** on an idle ready /gpu view and
  **0 after Back to stage 4**, and three's loop is stopped. Planted mistake: without the `stop()` the check fails,
  with 122 and 120 calls. The image deltas did not change (worst: side 4.7, wall 2.8, ground 0.3, sky 0.1,
  needle 0).
- **N1.** `xvfb()` rejects with "QA_GPU needs Xvfb (apt install xvfb); the /gpu suite cannot run headless (device
  lost)" on `ENOENT` (checked with Xvfb off the PATH: exit 1, so the run fails and does not skip). Each QA_GPU file
  in run-all is capped at 300 s (`spawnSync` timeout, SIGKILL), and a timeout is reported as "FAILED, timed out".
- **N2 (PM call via orchestrator).** The /gpu card has a second, gpu-only text,
  `data-pc="v3-unavailable-load"`: "The high-end 3D view could not load. Check your connection and reload, or open
  the standard 3D view." It has the same link. stage-3d.js shows it in place of the WebGPU text when
  `PC.view3d.available()` is false. That function is new: it passes through `PC.gfx.available()`, so the ui layer
  does not read `PC.boot3d`, and the standard page keeps no bootstrap text. On /gpu it is false only when the
  import failed or timed out. With no adapter, or a failed init, the card still says "This device or browser does
  not support WebGPU." Flows (d) checks the new copy for 404 and hang, and (c) still checks the WebGPU text.
- **N7.** A renderer is bound once. `watch()` binds the first one. `make()` binds every later one, both after a
  restore and when adopted after a failure. The loss handler no longer calls `bind(r2)` again.
- **Standard page**:
  - In `dist/index.html`, the only changes are `frame: function () {}` in gfx-r128.js, the `PC.gfx.frame` call in
    `render()`, `PC.view3d.available`, and the stage-3d block. That block does nothing there, because the page has
    no load-text element.
  - No test expectations were edited.
  - `tests/three/gfx.test.mjs` now spies on `frame` too, and has a unit check of the /gpu `frame()` order.
- **Runs**:
  - `node build.mjs && node tests/run-all.mjs --unit --three`: green, 29.8 s.
  - `QA_GPU=1 node tests/run-all.mjs --gpu`: flows 67/67 and parity 47/47 (114 checks), 54.1 s.
  - Focused e2e + QA (`--e2e --qa --only view3d,device-sweep,contract,shell,f1-t1,f4-t1,f4-t3,f5-t1,f5-t2,f5-t3,f6-t1`):
    green, 110.6 s.
  - The full default run was not repeated. The scene.js changes are a no-op call on r128 and one new read-only
    function.
