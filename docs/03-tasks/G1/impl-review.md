# G1 implementation review (TL): WebGPU parity page

Reviewed: dfba6a7 + 3e7cbe1 against fa1c154 (the commit before dfba6a7), with G-plan v2, the G0 spike notes, the G1
plan and outcome, CD-10..CD-13, the brief and architecture A-10, and the r180 source (three.webgpu.js / three.core.js).

Runs on this container:
- `node build.mjs && node tests/run-all.mjs --unit --three`: all steps passed, 30.8 s (three step 118 tests, 21.4 s).
- `QA_GPU=1 node tests/run-all.mjs --gpu`: flows 57 / 57, parity 47 / 47, 52.4 s. Image deltas as in outcome.md
  (worst: side wall 4.7, needle 0, sky 0.1).
- `dist/index.html` rebuilt from fa1c154 and diffed against the current build: the only differences are the CD-12
  link (markup + `.pc-bar__alt`), the unused `.pc-v3__card a` rule, the inlined `gfx-r128.js`, and the call-site
  indirection in util.js / look.js / scene.js (`PC.gfx.*`, `build(house, done)`, `LOSS`, `go()`, `made()`). Nothing
  else. The full default run was not repeated (FS: 342.9 s green on dfba6a7); nothing found here gives a reason to.
  `tests/qa/shots/F1-T1/metrics.json` was not rewritten (working tree clean after the runs).

## Findings by focus area

1. **Standard page unchanged.** The r128 adapter is the old code moved member for member, `make` / `precompile` call
   `done` synchronously, and `build()`'s continuation runs the old post-build lines (building = 0, ready, resize,
   invalidate) in the old order. `S.pending` is always 0 again before `build()` returns on r128, so `request()` and
   the restore path behave as before. `made()` adds a harmless `S.lost = false`. OK.
2. **Async safety on /gpu.** Checked: close or another house while compiling (token re-check in `go`'s continuation,
   `S.seq` makes a stale precompile a no-op, `live()` skips the warm-up of a stale build), changes made while it
   compiles (re-apply, not restore), open while `make` is pending (`S.want`, latest house wins, close clears it),
   device loss while compiling (the pending continuation is handed to the rebuild, the old one is stale by `S.seq`),
   loss of an old renderer and the `destroyed` reason ignored, `MAX_LOSSES`, `setup()` / `watch()` once per canvas and
   `bind()` per renderer (no listener duplication). OK. Minor ordering notes under N3.
3. **Colour / tone / fog / lights vs r128.** `col = new Color(hex)` with colour management on; background and fog
   colour raw `new Color(hex)` (correct per spike item 5); ACES via TSL `toneMapping` with a shared exposure uniform
   (r180 `acesFilmicToneMapping` has the same `* exposure / 0.6` as r128); fog mixed in sRGB after tone mapping with
   r180 `rangeFogFactor` = `smoothstep(near, far, -viewZ)` (r128 linear fog uses the same depth); `material.fog =
   false` so r180 does not fog first; hemisphere and sun x PI, emissive unscaled; every material lives in `S.mats`
   (no builder creates its own), so `PC.gfx.materials` covers all of them; blob (`toneMapped: false`, fog on) and the
   additive glow get the same treatment r128 gives them. The image check and the planted-mistake runs back this up.
   OK.
4. **three's own requestAnimationFrame loop.** r180 `WebGPURenderer.init()` ends with `this._animation.start()`
   (w.js 54484); `Animation.start()` (w.js 27116) re-requests a frame on every tick forever, resetting `info` and
   calling `nodeFrame.update()`, whether or not stage 5 is open. Measured with a counting `requestAnimationFrame`
   wrapper on an idle, ready /gpu view: **63 rAF calls in 2 s**. A-10 says "an idle view requests zero frames"; on a
   laptop this keeps the page waking every vsync for as long as the tab is open, which is the opposite of what a
   high-end page on battery should do. It can be stopped, and it is cheap: the loop only advances the node frame
   (`frameId`), which `render()` itself never does (only `compileAsync` and this loop call `nodeFrame.update()`), so
   the app advances it before each of its own renders. I tried exactly that locally (not committed): stop the loop
   after `init()`, tick the node frame before every app render, the warm-up render and the capture. Result: **0 rAF
   calls in 2 s idle**, and the QA_GPU suite still 104 / 104 green. Stopping it also makes the per-frame updates
   deterministic: r180's `ShadowNode.updateBefore` (w.js 41575) skips a shadow redraw when the camera already drew a
   shadow in the same `frameId`, so today a correct shadow after `shadowsDirty()` depends on three's rAF callback
   being ordered before ours in the tick. -> Required change 1.
5. **QA_GPU harness (headed Chrome on Xvfb).** The reason given (headless SwiftShader devices presenting to a canvas
   are lost as `destroyed` within a few frames) is credible and the choice works here (two runs, no flake). Each file
   owns its Xvfb (`-displayfd`, 10 s start timeout, killed in `finally`). Missing Xvfb is not handled clearly:
   `spawn` fails with `ENOENT`, the top-level `await xvfb()` rejects, and run-all prints a stack and "gpu ... FAILED,
   exit 1". Failing (not skipping) is the right behaviour for an explicitly requested run, but the message should say
   what is missing. The `spawnSync` for the QA_GPU files has no timeout, so a hung Chrome hangs the whole run; the
   G-plan asked for a capped run. -> Non-blocking N1.
6. **CD-10 per-target checks.** build.mjs `external()`: standard = exactly the r128 tag; gpu = no `src`/`href` URL at
   all and exactly one URL anywhere in the page, equal to the cdnjs 0.180.0 `three.webgpu.min.js`. The lint does the
   same on `src/index.html` (per target) and on both dist pages (`scanExternalGpu`: one URL, no tag, no r128 text,
   bootstrap exactly once, exactly `GPU_BOOT`, before the first app script), and `import-dynamic` still applies to every
   script on the standard page and to every script but the exact bootstrap on /gpu. The 0.180 licence banner is added
   to the vendor scan. CD-10 is enforced. OK.
7. **G2 / G3 rework risks.** None blocking; see N4 and N5. `PC.gfx.tier` and `pickTier(env.force)` leave room for the
   ultra gate (the adapter is kept on `PC.gfx.adapter`). For G3 the current design (exactly one URL, gpu-only files
   inlined from `src/gpu/` via `targetFiles`) already supports the vendored-inline route with no change to build or
   lint; the jsdelivr import-map route would need a new client decision (CD-10 names cdnjs), a `module`/`importmap`
   exemption and a second URL in both checks, and the map must point `three/webgpu` at the very same cdnjs URL the
   bootstrap imports, or the add-ons get a second three instance.

## Required changes

1. **Stop three's internal animation loop on /gpu and advance the node frame from the app's own renders.**
   - `src/gpu/three/gfx-webgpu.js:80-90` (after `r.init()` resolves, before `later(done, null, r)`):
     `if (r._animation) r._animation.stop();` (private member of the pinned 0.180.0; comment why).
   - Add an adapter member `frame(r)` (both adapters, same shape): /gpu
     `var n = r._nodes && r._nodes.nodeFrame; if (n) n.update(); if (r.info.autoReset) r.info.reset();`; r128 a no-op
     (`frame: function () {}`, no THREE or renderer reads, so the strict mock sees nothing new).
   - `src/js/three/scene.js:133-135` `render()`: `PC.gfx.frame(S.renderer)` before `S.renderer.render(...)`.
   - `src/gpu/three/gfx-webgpu.js:146` warm-up: `gfx.frame(R)` before `R.render`; `:156` `capture`: tick and call
     `captureNow` directly (the next-rAF wait only existed for three's loop), keeping the `sun.shadow.needsUpdate`.
   - Update the file header (line 23), outcome.md "Known limits" (line 106) and add a QA_GPU check in
     `tests/gpu/flows.mjs`: on a ready, idle /gpu view, a counting `requestAnimationFrame` wrapper (init script) sees 0
     calls over 1-2 s; and after `close()` (stage 4) still 0. The probe I used is
     `/tmp/claude-0/-home-user/5e3a6029-f0bd-5942-befd-6ead8e337094/scratchpad/raf-probe.mjs` (scratch, may be gone).
   - Expect a one-line change in `dist/index.html` (the call in `render()`), which is fine: indirection only.

## Non-blocking notes

- N1 (harness). `tests/helpers/gpu.mjs` `xvfb()`: on `error` with `code === 'ENOENT'`, fail with a message such as
  "QA_GPU needs Xvfb (apt install xvfb); the /gpu suite cannot run headless (device lost)"; run-all should still count
  it as failed, not skipped. Give the QA_GPU `spawnSync` in `tests/run-all.mjs:144` a `timeout` (e.g. 300 s) and
  report a timeout as a failure, as the G-plan's "capped run" intended.
- N2 (copy). The /gpu unavailable card always says "This device or browser does not support WebGPU", also when the
  cdnjs import failed or timed out (`PC.boot3d.state` failed / timeout). CD-11 fixes the no-WebGPU text only; a
  network failure would read better as "The high-end 3D view could not load." with the same link. Optional, PM call.
- N3 (loss ordering). If the old renderer's precompile finishes after `LOSS.lost` but before the new device is up, the
  opening completes ("ready") while `S.lost` is set, and the rebuild then compiles without the Building card over a
  canvas whose device is gone (likely blank for ~0.1-0.3 s). Harmless; could show 'building' from `LOSS.lost` until
  the restored build's continuation. The loss test also only calls `onDeviceLost` by hand; a check with a real
  `device.destroy()` is not possible to tell from `destroyed`, so this is the best available.
- N4 (G3, effects). The per-material `outputNode` bakes ACES and fog into each material's output, so a TSL
  post-processing chain (GTAO, bloom) would get tone-mapped, fogged colours. AO should darken the lit colour before
  ACES and fog; bloom on ACES output still works (thresholded LDR, like the old UnrealBloom). For G3 keep the chain
  inside the adapter: build the lit colour, then AO (if on), then ACES, then fog, so G3 inserts one stage in
  `materials()`, or move ACES + fog into the post chain with a mask for the unlit materials. Decide in the G3 plan;
  nothing to change now. Prefer vendoring the add-ons inline under `src/gpu/` with their imports rewritten to
  `THREE` / `THREE.TSL` (fits the current build and lint as is, one three instance, no new CD); the import-map route
  needs CD-10 amended and lint exemptions (see 7 above).
- N5 (G2). The warm-up render draws only what is visible, so the shadow-pass pipelines of the furniture and
  `textured-<level>` (they cast shadows; hidden with the Roof on) are built on the first Roof-off frame. r128 had the
  same gap (its `compile` builds no depth programs and the scissor draw skips the shadow pass), so this is parity,
  not a regression; with ultra's 4096 map consider doing the warm-up with the precompile meshes shown (synchronous,
  so it can show and restore around the one `render`), then the reapply's `shadowsDirty()` redraws the real shadow.
- N6. `ALT` in `src/js/ui/shell.js:7` hard-codes `gpu/index.html` / `../index.html`; if the G0 item 2 / 12 click test
  picks the `gpu.html` fallback name, both entries and `OUT.gpu` change together. Fine as is.
- N7. `gfx.make` binds `onDeviceLost` twice for a renderer made after a loss (inside `make` because
  `watched.current` is null, then again in `bind(r2)`); idempotent, but one of the two can go.

VERDICT: CHANGES REQUESTED
