# G0 spike notes (orchestrator, 2026-11-28)

Scope: docs/02-features/G-plan.md section 9 (G0). Local checks in headless Chromium (playwright, /opt/pw-browsers) with
`--enable-unsafe-webgpu --enable-features=Vulkan --use-angle=swiftshader --use-webgpu-adapter=swiftshader`, page served
over http://localhost (WebGPU needs a secure context: data: and file: give no adapter; file:// untested -> serve over http).

| # | Item | Result |
|---|---|---|
| 1 | three 0.180.0 from cdnjs as ES module | GO. Only `three.webgpu.min.js` is needed (it imports `./three.core.min.js`). `THREE.TSL` is exported by it, so no import map and no `three.tsl.min.js` (that file imports the bare specifier `three/webgpu` and fails without an import map). |
| 2 | Inside the artifact iframe (dynamic import, navigator.gpu, page links, shared localStorage) | PENDING client: probe artifact https://claude.ai/artifact/LmaheB5H7x7dx87CSpgDSC (source in ./probe). Local equivalent all PASS. |
| 3 | Per-material tone mapping (G-plan 3.2) | GO. Renderer `NoToneMapping`; lit material `outputNode = TSL.toneMapping(THREE.ACESFilmicToneMapping, exposureUniform, TSL.output)`. Measured via render-target readback: lit colour changes, unlit MeshBasic and scene.background unchanged. |
| 4 | Fog | r180 applies material fog BEFORE outputNode (w.js setupOutput -> then `if (isCustomOutput) resultNode = this.outputNode`), so fog would be tone-mapped. To match r128 (fog mixed after tone mapping), lit materials get `fog = false` and the outputNode mixes fog itself: `mix(toned.rgb, fogColorUniform, rangeFogFactor(nearU, farU))`; unlit materials already have fog false. Fog colour/near/far are adapter uniforms written by applyLook. |
| 5 | Background / fog colour space | Reviewer item 4 suggested raw (linear) setHex. WRONG for our purpose: r128 showed the raw hex on screen (clear colour / fog after encoding are not re-encoded). r180 output converts linear -> sRGB, so `new THREE.Color(hex)` (which converts sRGB -> linear, ColorManagement on) gives the same on-screen hex. look.js's `new THREE.Color(hex)` stays correct as is. |
| 6 | Light units | x PI for hemisphere and directional (r128 legacy `irradiance *= PI` in both; r180 physical path has no such factor). Emissive unscaled. |
| 7 | Screenshots in headless | Canvas presentation of WebGPU does NOT reach page.screenshot or drawImage in headless (always white / 0). Rendering itself works (render-target readback correct). So image checks use a debug hook: render into a RenderTarget, `readRenderTargetPixelsAsync`, convert linear -> sRGB in JS. Output conversion is screen-only, so the hook applies it itself. |
| 8 | compileAsync | Works on a simple scene (119 ms swiftshader). Shadow-pipeline coverage to confirm on the real house in G1. |
| 9 | texgen at 1024 | All kinds 776 ms in node (512: 257 ms). Acceptable once per page session for ultra. |
| 10 | On-demand shadows | `light.shadow.autoUpdate = false` + `needsUpdate = true` (w.js:41579) - used in probe, no error. |
| 11 | Device lost | `device.lost` fires with reason `destroyed` on page/renderer teardown (seen on every test close): must be ignored. |
| 12 | Hosting path | Probe publishes gpu/index.html, gpu/ and gpu.html variants; client click decides. Default: `gpu/index.html`. |
