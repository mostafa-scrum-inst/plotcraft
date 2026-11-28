# G1 plan (FS): WebGPU parity page

Scope: G-plan sections 2-5 and 8 as corrected by docs/03-tasks/G0/spike-notes.md. No ultra tier, no effects.

## 1. Adapter `PC.gfx`
- `src/js/three/gfx-r128.js` (standard target only) holds every r128-specific line now in scene.js / util.js / look.js:
  renderer creation and settings, `col()`, texture colour space, anisotropy, max texture size, exposure, light factor
  (1), on-demand shadows (`shadowMap.needsUpdate`), the precompile (sync `compile` + 1 px scissor draw, saved and
  restored flags) and the canvas `webglcontextlost/restored` listeners. Same member reads in the same order, so the
  strict mock sees nothing new. `make` and `precompile` call `done` synchronously.
- `src/gpu/three/gfx-webgpu.js` (gpu target only), same shape: waits on the bootstrap, device gate (`navigator.gpu`,
  `requestAdapter()`, `renderer.init()`), `NoToneMapping`, per-lit-material `outputNode` (ACES with an exposure
  uniform, then the fog mix in sRGB as r128 does, `material.fog = false`), lights x PI, `col = new Color(hex)`,
  `texture.colorSpace`, `light.shadow.needsUpdate`, `compileAsync` (+ a hidden warm-up render if the shadow pipelines
  are not covered), `onDeviceLost` (ignores `destroyed`), a debug render-target capture.
- scene.js: `build(house, done)` with a continuation; build sequence number so a stale continuation does nothing;
  after an async precompile `applyVisibility()` + `apply()` again; `setup()` split into once-per-canvas and
  per-renderer parts; device loss = own `S.lost`, new renderer, rebuild through the same continuation.

## 2. Build target
- Why gpu-only files are not in `manifest.js`: the existing lint unit test and QA f1-t1-static require every
  `manifest.js` entry to be inlined in `dist/index.html` (and every file under `src/js` to be in `manifest.js`).
  So: `manifest.js` entries may carry `targets` (default both; gfx-r128.js is `["standard"]`), and a new
  `manifest.gpu` list holds gpu-only files (under `src/gpu/`, outside `src/js`), each with `after` (the
  `manifest.js` file it follows). Both outputs keep one inline script per file.
- `src/index.html` gets `<!--@IF standard-->...<!--@END-->` / `<!--@IF gpu-->...<!--@END-->` blocks: the r128 tag and
  the CD-12 link on standard; the bootstrap script, the "Standard version" link and the WebGPU unavailable text on
  gpu. `dist/index.html` changes only by the CD-12 link (+ its CSS/JS lines).
- Lint per target: standard exactly as today; gpu: no external tag, exactly one URL (the bootstrap's), the bootstrap
  text (exact match, constant in the lint) is the only script exempt from `import-dynamic`. Budget and vendor scan on
  both outputs.

## 3. UI
- Stage 5 bar (Next is hidden there): standard shows "High-end 3D (WebGPU)" -> `gpu/index.html` only when
  `navigator.gpu` exists (feature check only); gpu shows "Standard version" -> `../index.html`. No `data-pc` hook so
  the hook contract is untouched. gpu unavailable overlay: "This device or browser does not support WebGPU." + link
  "Open the standard 3D view".

## 4. Tests
- Existing suite untouched; new mock test: `PC.three.col` delegates to `PC.gfx.col`, the r128 adapter is the one loaded.
- `tests/gpu/*.mjs` run by run-all only with `QA_GPU=1`: local http server over dist, chromium with the swiftshader
  WebGPU flags, cdnjs 0.180.0 URL routed to `tests/vendor/three-0.180.0/`. Checks (a)-(g) of the task.
