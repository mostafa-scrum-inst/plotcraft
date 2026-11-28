# PlotCraft /gpu: WebGPU high-end page (design v2, reviewed)

Status: design only, nothing implemented. Based on the current app on branch `claude/project-thread-hmp19t` (batch 18, app v10). Reviewed by a Fable 5.2 agent against the repo and the three.js r180 source; v1 got CHANGES REQUESTED with 7 required items, all addressed below (section 12 lists them).

## 1. Goal

A second page of the same published site that runs the same PlotCraft (same five stages, questions, generated plans, 3D model and tour) but renders stage 5 with three.js's WebGPU renderer and a higher quality tier aimed at desktops, laptops and recent tablets with a capable GPU. The standard page stays exactly as it is for phones and mid-range devices.

"Same logic" is meant literally: stages 1 to 4, the plan generator, the house model, the camera, the tour path, the tree scatter and the look tables are the same source files, not copies. Only the renderer layer and some quality numbers differ.

## 2. Where it lives

- Same artifact (https://claude.ai/artifact/LDbG9XdU1UeAMcVwqmxAB9). Today it publishes `dist/index.html` as the page. The /gpu page is published next to it through the Artifact `files` map, `{"gpu/index.html": "dist/gpu/index.html"}`. G0 checks whether the host serves `gpu/` as a directory index; otherwise links use `gpu/index.html` (fallback name `gpu.html`).
- Both pages are on the same artifact origin, so they share `localStorage`. The draft keys come from `PC.draft.KEYS`, not from the path, so a draft saved on one page is offered for Resume on the other. Two open tabs are last-writer-wins, as today.
- Links: /gpu shows "Standard version" in the shell; the standard page shows "High-end 3D (WebGPU)" only when `navigator.gpu` exists (a feature check, no adapter request).

## 3. What is shared and what is not

| Layer | /gpu page |
|---|---|
| core (26 files) | shared unchanged |
| data | shared; tier records gain per-tier `shadowMap` and `aniso` fields, plus a new `ultra` record |
| ui (18 files incl. stage-3d.js) | shared; stage-3d shows the unavailable state with a link (section 5). The WebGPU check itself lives in the adapter, so the ui layer still never touches the 3D library |
| three: build-shell, build-roof, build-interior, build-site, camera, finder, tour | shared unchanged (no r128-specific calls found by the review) |
| three: scene.js, util.js, look.js | shared, but their version-specific lines move to the adapter |
| new: `three/gfx-r128.js`, `three/gfx-webgpu.js` | one per build target, same shape |

The three.js surface the app uses is small and all of it exists in r180 (BufferGeometry, InstancedMesh with `count`, Lambert and Basic materials with vertex colours and emissive, DataTexture, ShapeGeometry, CatmullRomCurve3, Fog, `setViewOffset`, PCF soft shadows, `getMaxAnisotropy`, `initTexture`, `compileAsync`). WebGPURenderer converts Lambert and Basic materials to node materials by itself, so the builders stay as they are.

### 3.1 The adapter (`PC.gfx`)

| Concern | r128 (today) | r180 WebGPU | adapter member |
|---|---|---|---|
| Create renderer | sync `new WebGLRenderer` | `new WebGPURenderer({ antialias: true })`, then `await renderer.init()`; a failed init counts as no WebGPU | `make(canvas, tier, done(err, r))` |
| Output colour | `outputEncoding = sRGBEncoding` | `outputColorSpace = SRGBColorSpace` | inside `make` |
| sRGB hex to linear (materials, vertex colours, lights) | `new Color(hex).convertSRGBToLinear()` | `new Color(hex)`: colour management is on by default, so converting again would darken every colour twice | `col(hex)`; `PC.three.col` delegates |
| Raw colours (`scene.background`, fog colour in look.js) | `new Color(hex)` taken as raw | `new Color(hex)` now converts; use `setHex(hex, LinearSRGBColorSpace)` where the raw value is meant | `rawColor(hex)`, `background(scene, hex)`, `fogColor(hex)` |
| Unlit, not tone-mapped (sky dome, needle and highlight, blob shadows: `toneMapped: false`) | honoured | ignored: r180 tone-maps the whole frame in one output pass (`toneMapped` does not appear in three.webgpu.js) | see 3.2 |
| Tone mapping exposure | `renderer.toneMappingExposure` | see 3.2 | `exposure(r, k)` |
| Texture colour space | `t.encoding` | `t.colorSpace = SRGBColorSpace / NoColorSpace` | `texSpace(t, srgb)` |
| Light units | legacy lights | physically based only: the same look needs hemisphere and sun intensities x PI; emissive is not scaled | applied inside the adapter's `lights(hemi, sun, L)`, which look.js calls instead of writing intensities |
| Max texture size, anisotropy | `capabilities.*` | `getMaxAnisotropy()`; max texture size is always 8192 (three asks for default limits) | `maxTex(r)`, `maxAniso(r)` |
| On-demand shadows | `shadowMap.autoUpdate / needsUpdate` | `sun.shadow.autoUpdate = false`, `sun.shadow.needsUpdate = true` (confirmed in r180 ShadowNode) | `shadowsDirty(r, sun)` |
| Precompile at build | sync `compile` + 1 px scissor draw | `compileAsync(scene, camera)` + `initTexture`; G0 checks it also builds the shadow-pass pipelines, otherwise one hidden warm-up `render()` | `precompile(ctx, done)` |
| Device / context loss | `webglcontextlost / restored` | `renderer.onDeviceLost` (replaces three's default handler, so it sets `S.lost` itself); ignores the `destroyed` reason from our own dispose; makes a new renderer and rebuilds | `onLost(...)` |

### 3.2 Tone mapping decision

r128 tone-maps lit materials only; r180 tone-maps everything, so the sky dome, the UI colours, the fog and the background would all shift with ACES and the per-look exposure. Chosen fix: on /gpu the renderer runs with `NoToneMapping`, and the adapter gives each lit material an `outputNode` that applies ACES with an exposure uniform (TSL `toneMapping`, from `three.tsl.min.js` on cdnjs). Unlit materials then keep their exact colours, as on the standard page. G0 proves it on one lit and one unlit material and checks where fog is mixed. Fallback if that fails: keep renderer ACES and have the adapter pre-invert ACES at the current exposure for the few unlit colours (three sky rows, the UI colours) on every look change.

### 3.3 Sync where r128 is sync (continuations, not promises)

The existing tests call `open()`, flush the fake rAF and timers, and read `info()` at once; the context-restore test expects a synchronous rebuild. An `await`, even on a resolved promise, would move `ready` to a microtask and break them. So the adapter takes callbacks: on r128 `make` and `precompile` call `done` synchronously, and on WebGPU after their awaits. `scene.js` stays one state machine, and the standard page's behaviour and test expectations do not change (G1's first acceptance check: the whole existing suite green with no edits to expectations).

Async safety on /gpu:
- After every continuation the build token is checked again (`S.building === token && S.active`); a stale result is disposed, never shown. `close()` or `open()` with another house during compilation is therefore safe.
- `precompile` no longer saves and restores visibility flags. After it finishes, `applyVisibility()` and `apply()` run again, so a level, Roof or Light change made during compilation is kept.
- The device-loss rebuild uses the same continuation.
- `setup()` splits into once-per-canvas work (ResizeObserver, visibility listener, controls) and per-renderer work, so swapping the renderer after a device loss does not attach listeners twice.

## 4. Loading three.js r180 on /gpu

- Pinned 0.180.0 from cdnjs (`three.webgpu.min.js` 580 kB, which imports `./three.core.min.js` from the same folder; `three.tsl.min.js` is there too).
- The app's own files stay classic scripts; they only touch `THREE` inside functions. One bootstrap script loads three with a dynamic `import(url)` with `.then`, `.catch` and a timeout, sets `globalThis.THREE` (a frozen module namespace, which is fine: nothing in `src/js` writes to `THREE.*`) and settles `PC.gfx.ready`. A static import would never run its body on failure, so stage 5 would hang. `PC.view3d.open()` waits on `PC.gfx.ready` and reports `unavailable` if it rejects.
- Build: `node build.mjs` still writes `dist/index.html` byte-identical, plus `dist/gpu/index.html`. `manifest.json` gains an optional `targets` field per file (default both); the external-reference check becomes per target (the r128 tag only on standard; only the cdnjs r180 URLs on gpu). The size budget and vendor scan also apply to the gpu file.
- Lint: rules stay for every `src/js` file and for `dist/index.html`. The gpu bootstrap script is the one exemption from `import-dynamic` and `module-script`, matched by exact text as `THREE_TAG` is today. `scanExternal` runs per target.
- Brief: the hard constraint "three.js r128 global build only, no ES-module imports" is amended for the /gpu page only, recorded as client decision CD-9.

## 5. Device gate and fallback

- Checked on entering stage 5, not at page load, so stages 1 to 4 work on any device: `navigator.gpu` present, `requestAdapter()` returns an adapter, and `renderer.init()` succeeds. Otherwise the stage shows "This device or browser does not support WebGPU" and "Open the standard 3D view", which goes to the standard page (the draft is already saved).
- Users never get WebGPURenderer's WebGL2 backend; it would be a slower copy of the standard page. Tests may use it.

## 6. The `ultra` tier (G2)

Same geometry and scatter positions; only resolution and detail rise.

| Setting | full (today) | ultra |
|---|---|---|
| Shadow map | 2048 on fine pointers | 4096, PCF soft (bias re-tuned in G1/G2) |
| Anti-aliasing | on | on (r180 MSAA is 4x either way, so no change) |
| Max pixel ratio | 2 | 2 at rest; 1.5 while orbiting or touring if frames are slow |
| Procedural textures | 512 | 1024 (generation time measured in G0) |
| Anisotropy | up to 4 | up to 16 |
| Tree canopy detail | 1 | 2 (`lumpTris` already loops over detail) |

Choosing ultra: a fine pointer, an adapter that is not a fallback adapter (`adapter.info.isFallbackAdapter`), and a frame-time probe: the first frames are timed and if they are too slow the view drops to `full` once for the page session (it rebuilds, and says nothing). Texture size cannot be the gate because three always reports 8192. A tier override exists for tests.

Memory: WebGPU renders into a half-float buffer with 4x MSAA before the output pass, about 170 MB at 2880 x 1800. That is why the DPR drop while moving and the frame-time downgrade exist; G2 also tries an 8-bit colour buffer (`colorBufferType`). Target: 60 fps while orbiting at 1440p on a recent laptop with integrated graphics, measured in G2, not promised before.

## 7. Optional effects (G3, only if Mostafa wants them)

- Ambient occlusion (GTAO) for corners and under furniture, and bloom on lit glazing and glow pools at night, through r180's TSL post-processing. These add-ons are not on cdnjs; they would load from jsdelivr pinned to 0.180.0 through an import map (allowed at runtime by the artifact; tests use the npm package copy).
- Behind a View-tab switch "Effects", on by default on ultra. Effects only cost while frames are drawn; the idle view still draws nothing.

## 8. Testing

- Standard page: unchanged suite and gate (median of 3 default runs at most 420 s); the adapter refactor must keep every test green with no expectation edits. A mock test checks `PC.three.col` delegates to the adapter.
- /gpu, in a separate capped run `QA_GPU=1`, so it does not eat the default gate:
  - Real WebGPU in headless Chromium works in this container (swiftshader adapter with `--enable-unsafe-webgpu --enable-features=Vulkan --use-angle=swiftshader --use-webgpu-adapter=swiftshader`, on an http origin). cdnjs URLs are routed to copies of 0.180.0 from the npm registry. Tests run at `full` (software rendering at ultra is slow).
  - Parity test, forced to `full` on both pages: the sample project and the house fixtures give the same mesh names, instance counts and vertex counts.
  - Flows: draft from standard resumes on /gpu and back; WebGPU flags off shows the fallback message and link; a failed import shows unavailable; simulated device loss rebuilds once and does not loop; close or another house during compilation leaves no stale build; a Roof or level change during compilation is kept.
  - Image check via `page.screenshot` right after a forced frame (canvas readback is blank on WebGPU): per look preset, mean colours per region against the standard page within a tolerance, including the sky, the north needle and a shadowed area (catches colour-space, light-unit, tone-mapping and shadow-acne mistakes).
- No strict r180 mock: real rendering is available now and is cheaper to keep correct.

## 9. Plan of work (team protocol, one feature "G")

- G0 spike (1 batch): host path; dynamic import from cdnjs and WebGPU inside the artifact iframe on desktop Chrome; page-to-page links and shared draft; the 3.2 tone-mapping approach and fog; `lightK`; whether `compileAsync` covers shadow pipelines; texgen 1024 timing. Output: notes with go / no-go per item.
- G1 parity page (2 batches): adapter with continuations, build target, lint and build checks, device gate, links, QA_GPU suite. /gpu looks like the standard page at `full`. Published to the same artifact.
- G2 ultra tier (1 batch): tier data, gate and frame-time downgrade, shadow 4096, textures 1024, anisotropy, tree detail 2, measurements.
- G3 effects (1 to 2 batches, optional): AO and night bloom behind the Effects switch.

## 10. Risks

- The artifact iframe could block the module import or WebGPU. G0 checks both before build work.
- Colour, light and tone-mapping parity is subtle. The adapter owns every conversion and the image check covers sky, UI and shadow regions.
- WebGPU support: Chrome and Edge desktop, Android Chrome on recent devices, Safari 26+, Firefox 141+ on Windows. Others get the fallback message.
- GPU memory on high-DPR laptops (section 6). Mitigated by the frame-time downgrade.
- Two pages double the publish and test surface. Mitigated by sharing every non-renderer file and the separate QA_GPU run.
- r180 API churn: pinned version; upgrades are deliberate tasks.

## 11. Decisions for Mostafa

1. No WebGPU on the device: message plus link to the standard page (recommended), or fall back to WebGL2 on /gpu.
2. Add the "High-end 3D (WebGPU)" link on the standard page (recommended; shown only where WebGPU exists).
3. Include G3 effects (AO, night bloom), or stop after G2.
4. Record CD-9: the r128-only hard constraint does not apply to the /gpu page.

## 12. Review log (Fable 5.2, round 1: CHANGES REQUESTED)

1. Resolved promises would break the synchronous three tests: now continuations (3.3).
2. Async re-entrancy (stale builds, visibility restore, restore path): token re-checks, re-apply instead of restore (3.3).
3. `toneMapped: false` ignored by r180: tone-mapping decision (3.2) and image check of sky and needle.
4. look.js was outside the boundary (raw background and fog colours, exposure, intensities): added to the adapter (3.1).
5. Ultra gate by texture size and "4 samples" did nothing: real gate, frame-time downgrade, memory note, per-tier fields (6).
6. A failing static import would hang stage 5: dynamic import with catch and timeout (4).
7. Device loss: own `S.lost`, ignore `destroyed`, split `setup()` (3.1, 3.3).
Non-blocking notes adopted: shadow bias re-tune, compileAsync check, parity at `full`, screenshot method, per-target lint and budget, capped QA_GPU, failed init counts as no WebGPU.
