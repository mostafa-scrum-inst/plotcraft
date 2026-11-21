# F4-T1 plan: THREE mock, house model, renderer and loop, house shell, level selector, camera (FS, 2026-11-21)

Inputs:
- `docs/02-features/F4-plan.md`: the F4-T1 section and both riders (the data-literal lint; H1–H3 and the vendored r128);
- PM stories F4-S1, F4-S2, F1-S5, G1 and G6, and round 8 of `goals-and-stories.md`;
- `client-decisions.md` (CD-1 to CD-3; nothing in them is specific to 3D);
- architecture A-2, A-4 (session state), A-5 (frame T), A-7, A-8 step 1 (the Q14 convention), A-9, A-10, A-11, A-12, A-13 (noon/summer values only), A-15 and A-16 (including "Real r128 in tests");
- `docs/04-feature-reviews/F3.md`: the PM decisions, the F3 follow-up bundle and the CTO's H1–H6;
- `docs/03-tasks/F3-T3/outcome.md` §7 (the 3D art-direction note);
- the current `src/` and `tests/helpers/browser.mjs`.

This is a plan only. No source or test file has changed. Two scratch checks ran outside the repo (§13):
- the npm tarball and its sha512;
- the token rule run on today's five data files.

H5 is already met: the stale-plan draft fix was merged in batch 8 (CTO F3 round 2: APPROVED).

## 0. Summary

Work order. Each step has its own focused run.
1. **Mock first (H1).** Write `tests/three-mock.js` from the whitelist in §1, plus `tests/helpers/load3d.mjs` and `tests/three/mock.test.mjs`. The TL reviews the whitelist in this plan before any scene code exists.
2. **Real r128 for tests (H2).**
   - Vendor `tests/vendor/three-r128.min.js` and `tests/vendor/README`.
   - Add `three: 'real'` routing to `tests/helpers/browser.mjs`.
   - Add `tests/e2e/view3d-real.spec.mjs`. It also checks the mock against real r128: every whitelisted member exists, and the maths results match.
3. **Lint.** Replace the `data-literals-only` regex with the token rule (TL rider, §6).
4. **Pure core.**
   - `core/house.js`: `PC.house.build`, built from the approved plans and `PC.layout.core`, with the H3 tests and the Q14 test in frame T.
   - `core/cam.js`: `PC.cam`.
   - `PC.C.HOUSE` and `PC.C.CAM` in `const.js`.
5. **Three layer.**
   - `three/util.js`: `col`, `BoxBatch`.
   - `three/scene.js`: renderer, on-demand loop, resize, visibility, context loss, lights, open/close.
   - `three/build-shell.js`: ground, slabs, room tints, walls, stair, lift, basement pit.
   - `three/camera.js`: the Pointer Events adapter.
6. **UI.** `ui/stage-3d.js`: stage-5 controller, level selector, Roof state, Reset view, collapsible panel, tabs, Building… and unavailable states. Stage 5 gets a controller, so the "not built yet" banner goes.
7. **Tests.**
   - Unit: `house`, `cam`, lint cases.
   - Three (mock): `mock`, `scene`, `shell`, `camera`.
   - e2e: `view3d.spec` (mock) and `view3d-real.spec` (real r128), plus updates to two existing specs.
   - Then the mutation checks, and a full run.

**F3 follow-up bundle: F4-T2, not F4-T1** (§10). The TL rules.

## 1. The THREE mock and the allowed API (H1, for review first)

### 1.1 Mechanism (`tests/three-mock.js`, UMD)
- **Loading.** In node: `module.exports = THREE`. In the browser: `window.THREE = THREE`. `REVISION = '128'`.
- **Proxies.**
  - The namespace and every instance the mock creates are wrapped in a `Proxy`. Sub-objects are wrapped too (`renderer.shadowMap`, `light.shadow`, `shadow.camera`, `shadow.mapSize`, `rotation`, `position`, `instanceMatrix` and so on).
  - **Reading or writing a string key that is not on the class's whitelist throws** `TypeError('THREE mock: <Class>.<key> is not in the A-10 whitelist')`. This covers the namespace too, e.g. `THREE.Geometry`, `THREE.VertexColors`, `THREE.WebGLRenderTarget`.
  - Symbol keys pass through: `Symbol.toPrimitive`, `Symbol.iterator`, and node's `util.inspect`, so a failing `assert` can still print the object.
  - Two string keys that the JS runtime probes, never our code, read as `undefined` instead of throwing: `then` (Promise resolution of a returned object) and `toJSON` (`JSON.stringify`).
  - The `has` trap answers from the whitelist.
- **Constructor options.** Unknown keys throw, e.g. `outputColorSpace`, `alpha`, `powerPreference`, or `vertexColors: THREE.VertexColors`. `vertexColors` must be the boolean `true`.
- **The five A-10 signatures, enforced:**
  - `Matrix4.makeTranslation(x, y, z)`: exactly three finite numbers, so `makeTranslation(vector)` throws;
  - `new InstancedMesh(geometry, material, count)`: a mock geometry, a mock material and an integer of 1 or more;
  - `new CatmullRomCurve3(points, closed, curveType, tension)`: an array of 2 or more `Vector3`, a boolean, `'centripetal' | 'chordal' | 'catmullrom'`, and an optional number;
  - `new Float32BufferAttribute(array, itemSize)`: exactly two arguments, a `Float32Array` or number array, and an integer from 1 to 4 that divides its length;
  - `renderer.setSize(w, h, updateStyle)`: exactly three arguments, two positive numbers and a boolean, so `setSize(w, h)` throws.
- **Stricter than A-10 (proposed; each one guards a rule A-10 already states):**
  - **Render-time colour audit.** `Color` remembers whether `convertSRGBToLinear()` produced it. `copy`, `set(Color)` and `clone` carry the flag. `set(hex)` and `setHex` clear it. `lerp` keeps it only when both colours had it.
  - `renderer.render(scene, camera)` throws when:
    - any material `color`, or any light `color` / `groundColor`, in the rendered tree lacks the flag (A-10: every colour through `PC.three.col`);
    - or `scene.background` is a converted `Color` (A-10: the background takes the raw hex).
  - So every mock test also proves the colour rule.
  - `new Mesh(geometry, material)` requires both arguments.
  - Material `color` options must be mock `Color`s.
  - `BufferGeometry.setAttribute` accepts only `position`, `normal` and `color`, and all of them must have the same `count`.
  - `setIndex` takes a plain array whose values are all below that count.
- **Maths is real.**
  - `Vector3` is fully computed.
  - `Color` uses the r128 sRGB→linear formula: `c < 0.04045 ? c * 0.0773993808 : (c * 0.9478672986 + 0.0521327014) ^ 2.4`.
  - `Matrix4.compose`, `makeTranslation` and `identity` compute real matrices, as does `Quaternion.setFromAxisAngle`.
  - `CatmullRomCurve3.getPoint` and `getPointAt` are ported from r128: centripetal, chordal and catmullrom, and arc length through `arcLengthDivisions`, default 200.
  - It is ported now, not in F5, because A-16 makes the mock compute real values from its creation. The real spec compares it with r128 (§1.4).
- **Recording, through a side channel the app never names.** `globalThis.__threeMock`:
  - `raw(proxy)`: the unwrapped record. It holds constructor arguments, attributes and counts, renderer calls (`setPixelRatio`, `setSize`, `render` count), and the `dispose` count per geometry and material.
  - `created` / `disposed`: lists of geometries and materials.
  - `failRenderer`: when set, `new WebGLRenderer` throws, as r128 does without WebGL.
  - `WHITELIST`: the table below, as data. `mock.test` and the real spec both read it.
  - A lint rule `mock-backdoor` fails any file under `src/` that mentions `__threeMock`.

### 1.2 Whitelist (A-10 surface, round-2 additions included)

| Class / object | Members (read/write) | Constructor |
|---|---|---|
| namespace `THREE` | `REVISION`, the classes below, `sRGBEncoding` (3001), `PCFSoftShadowMap` (2), `DoubleSide` (2) | |
| `WebGLRenderer` | `setPixelRatio`, `setSize`, `render`, `dispose`, `shadowMap` {`enabled`, `type`}, `outputEncoding`, `domElement` | options `canvas`, `antialias` |
| `Scene` | `background` + Object3D | none |
| `Group` | Object3D | none |
| Object3D (all nodes) | `position`, `rotation`, `quaternion`, `scale`, `visible`, `name`, `userData`, `parent`, `add`, `remove`, `children`, `traverse`, `getObjectByName`, `castShadow`, `receiveShadow`, `frustumCulled`, `renderOrder`, `lookAt`, `updateMatrix`, `matrix` | |
| `Mesh` | `geometry`, `material` + Object3D | `(geometry, material)` |
| `InstancedMesh` | `setMatrixAt`, `instanceMatrix` {`needsUpdate`}, `count` + Mesh | signature above |
| `PerspectiveCamera` | `fov`, `aspect`, `near`, `far`, `updateProjectionMatrix` + Object3D | `(fov, aspect, near, far)` |
| `DirectionalLight` | `color`, `intensity`, `target`, `shadow` {`mapSize`, `camera` {`left`, `right`, `top`, `bottom`, `near`, `far`, `updateProjectionMatrix`}, `bias`, `normalBias`} + Object3D | `(color, intensity)` |
| `HemisphereLight` | `color`, `groundColor`, `intensity` + Object3D | `(sky, ground, intensity)` |
| `BufferGeometry` (and every geometry below) | `setAttribute`, `setIndex`, `computeVertexNormals`, `dispose` | none |
| `Float32BufferAttribute` | none (an opaque value) | signature above |
| `BoxGeometry`, `PlaneGeometry`, `CylinderGeometry`, `ConeGeometry` | as BufferGeometry | numeric parameters, recorded |
| `Shape` | `moveTo`, `lineTo`, `closePath`, `holes` (a real array of `Path`) | none, or an array of `Vector2` |
| `Path` | `moveTo`, `lineTo`, `closePath` | as Shape |
| `ShapeGeometry` | as BufferGeometry | `(shape)` or `(shape, curveSegments)` |
| `MeshLambertMaterial`, `MeshBasicMaterial` | `color`, `vertexColors`, `transparent`, `opacity`, `side`, `dispose` | options with exactly those keys (except `dispose`) |
| `Vector2` | **`x`, `y`, `set`** (proposed addition, below) | `(x, y)` |
| `Vector3` | `x`, `y`, `z`, `set`, `copy`, `clone`, `add`, `sub`, `multiplyScalar`, `normalize`, `length`, `distanceTo`, `lerp` | `(x, y, z)` |
| `Color` | `r`, `g`, `b`, `set`, `setHex`, `copy`, `clone`, `lerp`, `convertSRGBToLinear` | `(hex number or '#RRGGBB')` |
| `Matrix4` | `compose`, `makeTranslation`, `identity` | none |
| `Quaternion` | `identity`, `setFromAxisAngle` | none |
| Euler (`object.rotation`) | **`x`, `y`, `z`** (proposed addition, below) | not constructed by app code |
| `CatmullRomCurve3` | `points`, `getPoint`, `getPointAt`, `getLength`, `arcLengthDivisions`, `updateArcLengths` | signature above |

**Proposed additions** (A-16: each cites its r128 documentation name and needs TL approval):
1. **`Euler.x`, `.y`, `.z`** (r128 docs: *Euler*, properties `.x .y .z`). `Object3D.rotation` is whitelisted, but A-10 never says what may be done with it. `rotation.x = -Math.PI / 2` (A-10, ShapeGeometry and PlaneGeometry) needs them. `Euler.set` and `order` are not requested.
2. **`Vector2.x`, `.y`, `.set`** (r128 docs: *Vector2*, `.x .y .set()`). `shadow.mapSize` is a Vector2 and A-10 itself uses `shadow.mapSize.set(1024, 1024)`.

Nothing else is needed for F4-T1. Things deliberately not used:
- `getPixelRatio`, `info` and `getContext`: only the real spec's test code reads these, on real r128, and never through the mock.
- `setClearColor`, `Material.needsUpdate`, `computeBoundingSphere`, `WebGLRenderTarget`, `OrthographicCamera`, `Raycaster`, textures.

### 1.3 `tests/helpers/load3d.mjs`
- `load3d({ three: true | false, dpr = 1, size = [360, 400] })` evaluates core + data + three files in a bare `vm` context. ui files are not loaded.
- With `three: true`, the context gets the mock as `THREE` and `__threeMock`. With `three: false` it gets neither, which proves the three files load without THREE.
- Stubs:
  - a canvas with `addEventListener`, `removeEventListener`, `dispatch(type)` (records `defaultPrevented`), `clientWidth` / `clientHeight` and `parentElement`;
  - `document` with a settable `visibilityState`, plus `addEventListener` and `dispatchEvent` for `visibilitychange`;
  - `devicePixelRatio`;
  - a manual `ResizeObserver` (`trigger(w, h)`);
  - a manual `requestAnimationFrame` / `cancelAnimationFrame`: `raf.pending()`, `raf.requested` (total calls), `raf.flush(n)`;
  - `setTimeout` for the Building… yield.
- It returns `{ PC, THREE, mock, canvas, doc, raf, ro }`.

### 1.4 `tests/three/mock.test.mjs` (the mock's own tests)
- **Rejects:**
  - unknown members on the namespace, on instances and on nested objects (`renderer.outputColorSpace`, `mesh.geometry.attributes`, `light.shadow.radius`, `THREE.Geometry`);
  - unknown constructor keys;
  - `makeTranslation(new Vector3())`;
  - `setSize(w, h)`;
  - `new InstancedMesh(g, m)`;
  - `new Float32BufferAttribute([1, 2, 3], 2)`;
  - `new CatmullRomCurve3([p])`;
  - `vertexColors: 2`;
  - mismatched attribute counts;
  - an index out of range;
  - a raw-hex material colour at `render`;
  - a converted background at `render`.
- **Accepts** every whitelisted member, as a table-driven loop over `WHITELIST`.
- **Maths:**
  - `Color('#808080').convertSRGBToLinear().r` = 0.2158605 (1e-6);
  - `compose` with a quaternion about Y;
  - `getPointAt(0.5)` on a fixed curve.
- **Conformance with real r128** (in `view3d-real.spec`, about 1 s):
  - for every `WHITELIST` row, the member exists on a real instance (`key in obj`), so the mock can never allow something r128 lacks;
  - the maths results above, computed by real r128 in the page and by the mock in node, agree to 1e-9 (the colour to 1e-6).

## 2. Vendored r128 and the real-r128 spec (H2)
- **`tests/vendor/three-r128.min.js`.** This is `package/build/three.min.js` from `three-0.128.0.tgz`: 603 445 bytes, MIT header kept.
  - Tarball integrity (checked here, §13): `sha512-i0ap/E+OaSfzw7bD1TtYnPo3VEplkl70WX5fZqZnfZsE3k3aSFudqrrC9ldFZfYFkn1zwDmBcdGfiIm/hnbyZA==`. It matches `npm view three@0.128.0 dist.integrity` and the CTO's value.
  - `tests/vendor/README` records the tarball integrity, the file's own `sha512sum`, and the refetch steps:

    ```
    npm pack three@0.128.0
    tar -xzf three-0.128.0.tgz package/build/three.min.js
    cp package/build/three.min.js tests/vendor/three-r128.min.js
    ```

    The alternative is `curl https://registry.npmjs.org/three/-/three-0.128.0.tgz`.
  - The README also says that the file is never inlined or referenced by the app.
- **`browser.mjs`:**
  - `open(browser, vp, { three: 'abort' | 'mock' | 'real', dpr })`.
  - `'real'` fulfils **only** the exact `THREE_URL` with the vendored file. Any other request is still aborted and reported.
  - `dpr` sets `deviceScaleFactor`.
  - With `'real'`, the console listener also records `warning` messages that start with `THREE.` as errors.
  - r128 logs "Context Lost." / "Context Restored." through `console.log`, which is not recorded.
- **Build and lint guards (unchanged rules, one addition):**
  - `src/index.html` and `dist/index.html` keep the single cdnjs tag, enforced by today's `scanExternal`.
  - New lint check: `dist/index.html` is under 600 000 bytes (today 395 764; the vendored file alone is 603 445) and does not contain `Copyright 2010-2021 Three.js Authors`.
  - `build.mjs` is not touched.
- **`tests/e2e/view3d-real.spec.mjs`** (≤ 30 s). Two contexts: 360x640 touch at dpr 3, and 1280x800 mouse at dpr 1. Each runs sample → Skip to 3D, then:
  1. **No problems:** zero `pageerror`, zero `console.error`, no `THREE.` warning, and `THREE.REVISION === '128'`.
  2. **Not blank:**
     - `PC.debug.scene().renderNow()` renders, then `gl.readPixels` reads a 9 x 9 grid in the same task (no `preserveDrawingBuffer` needed);
     - at least 30 % of samples differ from the noon background by more than 12 per channel;
     - and at least 3 distinct colours appear.
  3. **Pixel ratio:** `renderer.getPixelRatio() <= 2`. At dpr 3 it is exactly 2, and `canvas.width === round(clientWidth x 2)`.
  4. **Draw calls:** `renderer.info.render.calls <= 80`. That is 2 x the 40-mesh test ceiling, because the shadow pass and the main pass each draw the casters. Mesh count `<= 40`.
  5. **Colour pipeline end to end:**
     - a second small renderer is made by the app's own factory `PC.three.makeRenderer(canvas)`, so it has the same settings, `sRGBEncoding` included;
     - it renders one full-view `PlaneGeometry` quad with `MeshBasicMaterial({ color: PC.three.col(hex) })`, at 64 x 64 px;
     - the centre pixel reads back as `hex` ± 2 per channel for `#D9C7A3`, `#23292F`, `#8EC3EA`, `#C4704F` and `#FFFFFF`.
  6. **Context loss:**
     - `WEBGL_lose_context.loseContext()` → `PC.debug.scene().lost === true` and rAF requests stop;
     - `restoreContext()` → the rebuild counter increases, one frame renders, and the not-blank check passes again.
  7. **Hidden:**
     - with `visibilityState` emulated as `hidden` (`defineProperty` + a dispatched `visibilitychange`) and an orbit key pressed, a wrapped `window.requestAnimationFrame` gets 0 calls over 300 ms;
     - after `visible`, one frame follows.
  8. **Mock conformance:** see §1.4.
  - **Shots,** only with `--shots` (never in `run-all`): the sample at noon in each Q10 exterior at 1280x800, and `sand` at 360x640, into `docs/03-tasks/F4-T1/shots/`. The exterior changes through `PC.store.commit`: Q10 is appearance-class, so approvals stay. The Designer reviews them in the implementation round (CTO "colours never rendered").
  - **Limits:** SwiftShader timings are not phone performance, and touch here is emulated (A-16).

## 3. House model (`core/house.js`, H3)

`PC.house.build(state)`:
- **Refusal:** returns `null` unless `PC.stages.status(state)[3].valid`, meaning every plan level is approved, fresh (`sig` equals the current signature) and without error.
- **Reads:** the approved `state.plans[id].rooms` (frame P) and `PC.layout.core(fp.w, fp.d, stairsExist, stairPos, liftExists)`. It **never calls `PC.layout.generate` or `PC.plans.sync`**. Nothing is mutated.
- **Output: A-9 fields, for F4-T1:**
  - `v: 1`, and `key` = FNV-1a 32-bit hex over `JSON.stringify` of the model without `key`;
  - `center`: the `ptsL` bounding-box centre;
  - `radius`: the largest distance from `center` to a plot vertex;
  - `plot { pts: ptsL, area }`;
  - `northDeg` = `PC.frames.northL(state)`;
  - `footprint {u, v, w, d}` from `PC.site.analyse`;
  - `storeyH = ans.ceilingH`, `pitch = storeyH + PC.C.HOUSE.slab` (0.2);
  - `levels`, lowest first: `{ id, name: PC.C.LEVEL_LABEL[id], index, baseY, rooms, stair, lift }`:
    - `index`: B -1, G 0, '1' 1, '2' 2; `baseY = index x pitch`;
    - each room: `{ id, name (PC.levels.roomNames), type, u: fp.u + x, v: fp.v + y, w, d: h, area: w x h, furniture: [] }`;
    - `stair` / `lift` from the core block, converted the same way, identical on every level, `null` without stairs;
  - `roof { type, usable, baseY: (top index + 1) x pitch, stairHead: null }`. `stairHead` is filled in F4-T2;
  - `exterior`, `interior { style, density }`;
  - `site`:
    - `entrance { u: fp.u + fp.w / 2, v: fp.v, w: PC.C.HOUSE.door }`, with the door 1.2 m;
    - `parking` / `pool` as `PC.site.analyse` places them, or `null` when omitted;
    - `wall`, `gate: null`, `seating: null`, `trees: []`, `shrubs: []`, `vegPct`, `northMarker: null`;
    - F4-T2 fills `gate`, `seating` and `northMarker`, and F4-T3 fills the vegetation.

**3D convention.** Storey `k` occupies `[baseY, baseY + pitch]`:
- the slab is the bottom 0.2 m;
- the floor is at `floorY = baseY + 0.2`;
- the next slab's underside is at `floorY + storeyH`, which is the Q8 height.

So the ground floor stands on a 0.2 m plinth, and the basement floor is at `-pitch + 0.2`. A-9 does not state this; question 5.

**Unit tests (`tests/unit/house.test.mjs`):**
- **Sample:**
  - 2 levels (G, 1) with 7 rooms each;
  - every room equals its plan rectangle plus `(fp.u, fp.v)` exactly;
  - `baseY` = 0 and `pitch`, with `pitch = 3.2`;
  - stair identical on both levels and equal to `core.stair` + origin;
  - `furniture` arrays empty;
  - names as in the plans (`PC.levels.roomNames`).
- **Q14 in frame T (H3):**
  - with `stairPos 'fl'`, the stair's T rectangle, through `PC.frames.l2t` of its corners, has `minX = footprint minX` and `maxZ = footprint maxZ` (the street side);
  - `'br'` gives `maxX` and `minZ`;
  - `'fr'` and `'bl'` give the other two corners;
  - this guards the left/right and front/back mirrors.
- **Refusal:** `null` when one plan is unapproved, stale (Q3 changed without sync), has `error: 'no-layout'`, or the plot is open.
- **Follows edits:**
  - `applyEdit` move and resize, then approve, then build: the moved room's `u` / `v` / `w` / `d` follow, and the other rooms are unchanged;
  - a moved room's tint also moves in the shell test.
- **Basement:**
  - with `basement: true`, the levels are B, G, … with `B.index = -1` and `baseY = -pitch`;
  - `roof.baseY = (floors) x pitch`.
- **Key:**
  - the same state gives the same key;
  - Q10, Q18 and a room edit each change the key;
  - the unit toggle (Q1) and `sampleClean` do not.
- **No generate:** `PC.layout.generate` is replaced with a function that throws, and `build` still works.
- **Purity:** a deep-frozen state passes, and `JSON` round-trips equal.

## 4. Renderer, loop, lights (`three/util.js`, `three/scene.js`)

**`util.js`:**
- **`PC.three.col(hex)`** = `new THREE.Color(hex).convertSRGBToLinear()`. It returns a new Color every call.
- **`BoxBatch`:**
  - `add(cx, cy, cz, sx, sy, sz, hex)`: 24 vertices, 36 indices, face normals, per-vertex colour from the `col` r/g/b, cached per hex;
  - `addQuad(cx, y, cz, sx, sz, hex)`: horizontal, facing up (4 / 6);
  - `addPrism` waits for F4-T2;
  - `count`;
  - `build(material)` → one `Mesh`, or `null` when empty. It holds `Float32BufferAttribute` position, normal and color plus a plain-array index; r128 picks Uint32 above 65 535 vertices;
  - `mesh.userData.boxes` and `.quads` are counts the tests read.

**`scene.js`:**
- **Factory `PC.three.makeRenderer(canvas)`:**
  - `new THREE.WebGLRenderer({ canvas, antialias: true })`;
  - `setPixelRatio(Math.min(devicePixelRatio || 1, PC.C.VIEW3D.maxDpr))` with maxDpr 2;
  - `shadowMap.enabled = true`, `shadowMap.type = PCFSoftShadowMap`, `outputEncoding = sRGBEncoding`.
- **`PC.view3d.open(house, canvas, onState)`.** `onState` receives `'building' | 'ready' | 'unavailable'`. The UI owns the DOM and three touches only the canvas (A-2).
  - If `typeof THREE === 'undefined'`, or `makeRenderer` throws → `'unavailable'`, nothing else happens, and the result is `{ ok: false }`.
  - The renderer is created once and kept across close and open.
  - If `house.key` differs from the built key:
    - `'building'`;
    - one `requestAnimationFrame` yield so the overlay paints;
    - dispose the old world (every geometry and material once);
    - build;
    - `'ready'`.
  - Otherwise it resumes with the same pose.
  - The pose is reset (§7) only on the first open, or when `house.center` / `house.radius` change, i.e. the plot changed. In every other case the kept pose is re-clamped to the new limits.
- **On-demand loop** (key choice; question 2). `invalidate()` sets `dirty` and requests **one** frame, and only if all of these hold:
  - `active` (between `open` and `close`);
  - `document.visibilityState === 'visible'`;
  - not `lost`;
  - and no frame is already pending.

  The frame renders once and clears `dirty`. An idle open view therefore requests **zero** frames after its first render. A-10's "render only when something changed" holds trivially. F5 flights call `invalidate()` per frame.
- **Cancelling:** `close()` sets `active = false` and cancels the pending frame. `visibilitychange` to hidden cancels it; back to visible calls `invalidate()`. The pose, level selector and roof state are kept, as session state (A-4).
- **Resize:**
  - a `ResizeObserver` on `canvas.parentElement`, with a `window` `resize` fallback;
  - it reads `clientWidth` / `clientHeight` and skips 0 x 0 (stage hidden);
  - then re-applies `setPixelRatio(min(dpr, 2))`, `setSize(w, h, false)`, `camera.aspect = w / h`, `updateProjectionMatrix()` and `invalidate()`.
  - It runs before the first render as well.
- **Context loss:**
  - `webglcontextlost` → `preventDefault()`, `lost = true`, cancel the frame;
  - `webglcontextrestored` → `lost = false`, dispose and rebuild from the current house model, then `invalidate()`. This happens after r128's own restore listener, which the renderer registered first in its constructor.
- **Camera:** `PerspectiveCamera(45, aspect, 0.5, 20 x house.radius)`. `far` is updated on rebuild.
- **Lights: fixed noon/summer, from the tables as they are (H4).**
  - Values are taken from `PC.data.sky.keys` at `h = 12`, with summer `tintAmount = 0`, so there is no tint.
  - `hemiGround` uses the A-13 rule: `mix(K.hemiGround, seasons.summer.ground, groundBounce x 1)`, with `groundBounce` read from the table.
  - `HemisphereLight "hemi"(col(hemiSky), col(hemiGround), hemiI)`.
  - `DirectionalLight "sun"(col(sunColor), sunI)` is the only `castShadow` light:
    - `shadow.mapSize.set(1024, 1024)`;
    - `shadow.bias = -0.0005`, `normalBias = 0.02`;
    - orthographic box half-size `min(2.5 x footprint radius, 1.2 x house.radius)` (A-11), centred on the footprint;
    - near 0.5, far `5 x radius`.
  - Sun direction from the A-13 formula at `a = PI / 2`: `s = y sin E - n cos E`, with `E = summer.elevMax` and `n = (sin N, 0, -cos N)` from `northDeg`. Position = target + `s x 2.5 x radius`. `sun.target` sits at the footprint centre and is added to the scene.
  - `scene.background = new THREE.Color(K.background)`, raw (A-10).
  - F4-T3 replaces this with `PC.sky.compute(12, 'summer', …)`. Its test pins equality with these values, so the opening look does not jump.
- **Debug hooks (A-2):**
  - `PC.debug.house()`;
  - `PC.debug.scene()` → `{ renderer, scene, camera, renderNow(), lost, rebuilds, renders, meshCount, level, roof }`;
  - `PC.debug.cam()` → a copy of the pose.

## 5. House shell (`three/build-shell.js`)

All positions go L → T through `PC.frames.l2t(house.center, u, v, y)`. Colours (H4, outcome §7):
- `E = PC.data.exteriors[house.exterior]`;
- `I = PC.data.interiors[house.interior.style]`;
- `RT = PC.data.roomTints`;
- `SC = PC.data.siteColors`;
- `mix` is the one sRGB per-channel lerp with `Math.round`. It lives in `util.js` (`PC.three.mixHex`), is pure, and is shared with F4-T3.

| Node | Geometry | Colour |
|---|---|---|
| `world > ground > groundOuter` | `PlaneGeometry(8R, 8R)`, `rotation.x = -PI/2`, Y = -0.05, receives only | `SC.groundOuter` |
| `groundPlot` | `ShapeGeometry`: the shape `(u - cu, v - cv)` of `ptsL` with the footprint rectangle as a `holes` Path, `rotation.x = -PI/2`, Y = 0, receives only | `SC.ground` |
| `groundCap` | `PlaneGeometry(fp.w, fp.d)` at the footprint centre, rotated, Y = 0.01, receives only | `SC.ground` |
| `level-<id> > slab` (BoxBatch) | slab box `fp.w x 0.2 x fp.d` at `[baseY, baseY + 0.2]`; hall quad (whole footprint) at `floorY + 0.008`; one tint quad per room at `floorY + 0.015` | slab `E.slab`; hall `mix(RT.hall, I.wood, I.floorMix)`; room `mix(RT[type], I.wood, I.floorMix)` |
| `level-<id> > walls` (BoxBatch) | exterior walls; partitions; stair; lift; basement pit walls (all below) | exterior `E.wall`; partitions `E.wallInner`; stair `RT.stair`; lift `RT.lift` (unmixed); pit walls `E.slab` |
| `world > roof` | empty Group in F4-T1, visibility rule wired | |
| `world > site` | empty Group in F4-T1 | |

**Walls** (`PC.C.HOUSE`: height `wallH` 1.2, thickness `wallT` 0.15, from `floorY`):
- **Exterior walls.** The front and back walls span the full `fp.w`. The two side walls are `fp.d - 2 x wallT` long, so there is no overlap at the corners. Each wall's outer face is flush with the footprint edge.
- **Entrance.** The ground level's front wall has a gap of `site.entrance.w` centred at `site.entrance.u`, so it is two boxes.
- **Basement.** It has no exterior walls. Instead, pit walls run from the basement floor up to Y = 0, at the full height so the earth face reads, flush inside the footprint.
- **Partitions.**
  - Every room edge not on the footprint boundary becomes a segment on its line (key: coordinate rounded to 0.01).
  - Collinear segments on the same line are merged into a union of intervals, so a wall shared by two rooms is **one** box.
  - Each segment is trimmed by `wallT` where it meets the exterior wall's inner face.
  - Box thickness `wallT` is centred on the line.
  - Two rooms with a small gap between them, for example after an edit, give two parallel boxes that overlap. Their top faces share colour and height, so the overlap does not show (risk R4).
- **Stair and lift.** Plain boxes of the core rectangles, `wallH` high, on every level (A-10, "stair/lift as plain boxes"). They are not floor quads; the stepped stair is optional F4-T2 polish. A lift is not a full-height shaft, because in "All" a shaft would hide the floors behind it (question 9).

**Shadows (A-11):** the batches cast and receive shadows; the ground only receives.

**Levels and roof:**
- Mesh count for the sample: 3 + 2 x 2 = **7**. For the F4-T1 maximum house: 3 + 4 x 2 = **11**. F4-T2 adds furniture, roof and site.
- **Level selector** `PC.view3d.setLevel(sel)`, with `sel = 'all' | 'B' | 'G' | '1' | '2'`:
  - `'all'`: every level visible;
  - any other `sel`: levels with an index above `sel`'s are hidden;
  - `'B'` additionally hides `groundCap`, which opens the pit.
- **Roof:** `PC.view3d.setRoof(on)`. The `roof` Group is visible only when `on && sel === 'all'`.

## 6. Data-literal lint (TL F4-T1 rider)

**Rule.** In `tests/lint-constraints.mjs`, `data-literals-only` becomes a function rule. `scan()` gains `r.find(text)` → `{ index } | null` next to `r.re`. The rule works in four steps:
1. Strip comments.
2. Reject any template literal (a backtick).
3. Replace every string with a sentinel token.
4. Tokenise into numbers, identifiers, `||` and single characters.

**Accepted structure.** The token stream must start with `( function ( PC ) {` and end with `} ) ( globalThis . PC = globalThis . PC || { } ) ;`. Between them only these are allowed:
- `PC . data . <ident> =` (a statement head);
- `{ } [ ] : , ;`;
- strings;
- `true`, `false`, `null`;
- an identifier directly followed by `:` (a key);
- a number;
- a `-` directly before a number, only after `:`, `[` or `,`. `furniture.js` has `off: [-0.3, -0.6]`; with this rule `w: 2-1` still fails.

**Results** (a scratch run of this rule, §13):
- all five data files pass: `palette2d`, `room-labels`, `look3d`, `furniture`, `sky`;
- `groundBounce: Math.min(0.25, 1)` fails at `Math`.

**`tests/unit/lint.test.mjs` cases:**
- **Must fail:** that `Math.min` case, `[1].map(…)`, an arrow function, `PC.data.a = PC.data.b`, `a: b`, `a: 1 + 2`, `w: 2-1`, a template string, `a ? 1 : 2`, `x: -y`, and a missing skeleton.
- **Must pass:** the five real data files as they are, and `{ '1': 'G', k: -0.5, n: [1e-3, -2] }`.

**Mutation:** the old regex back in place lets the `Math.min` case through.

**Other lint changes:**
- `mock-backdoor`: `__threeMock` anywhere in `src/` fails.
- The dist size and licence-string check (§2).

## 7. Camera (`core/cam.js` pure, `three/camera.js` adapter)

**`PC.cam`** (A-12; frame T; angles in radians):
- pose `{ target: [x, y, z], radius, theta, phi }`;
- `position(p)` = `target + radius x (sin phi sin theta, cos phi, sin phi cos theta)`. `theta = 0` puts the eye on +Z, the street side;
- `orbit(p, dT, dP)`;
- `zoom(p, factor)`;
- `pan(p, dxPx, dyPx, mPerPx)`: on the ground plane, with right `(cos theta, 0, -sin theta)` and forward `(-sin theta, 0, -cos theta)`. The content follows the finger;
- `metresPerPx(p, fovDeg, viewH)` = `2 r tan(fov / 2) / viewH`;
- `limits(house, aspect)`;
- `clamp(p, L)`;
- `reset(house, aspect)`;
- `lerpPose` (shortest arc, smoothstep; used by F5, tested now).

**Limits** (`PC.C.CAM`):
- phi in [5°, 85°];
- radius in [4, `rMax`];
- the target inside the plot bounding box in T, with Y in [0, `roof.baseY`];
- then the eye height is forced to 1.0 m or more by lowering phi: `phi <= acos((1 - ty) / r)`.

**Reset view** (A-12 says radius `2.2 x R`). Question 1. **Proposal:** make the radius aspect-aware, so the plot is really framed on a portrait phone.
- At 360x640 (aspect 0.56), the horizontal half-angle is only 13.1°, so `2.2 R` shows about half the plot's width.
- Proposed radius: `max(2.2 R, 1.05 R / sin(min(halfFovV, halfFovH)))`.
- `rMax = max(3 R, 1.2 x reset radius)`, so a reset pose is never clamped.
- Unchanged from A-12: target = the plot centre `(0, 0, 0)` in T; theta 30° (from the street side, towards +X); phi 50°.

**Adapter** (`three/camera.js`, `PC.three.controls.attach(canvas, get, set, opts)`; listeners are removed on detach):
- **Pointer Events with `setPointerCapture`:**
  - **one pointer:** mouse button 0 without Shift → orbit; `dTheta = -dx x PI / minSide`, `dPhi = -dy x PI / minSide`;
  - **mouse button 2, or Shift + drag:** pan;
  - **two pointers:** pinch → `zoom(d0 / d1)`, and the midpoint shift → pan, both every move;
  - when a pointer lifts, the remaining pointer's baseline resets, so there is no jump.
- **Wheel:** `zoom(exp(deltaY x 0.0015))`, `{ passive: false }`, `preventDefault`.
- `contextmenu` is suppressed.
- **Keys** on the focused canvas (`tabindex = 0` is already in the markup):
  - arrows orbit 5°; `+` / `=` zoom 0.9 and `-` / `_` zoom 1.1;
  - every handled key calls `preventDefault`, so the page does not scroll.
- Every change → `clamp` → `invalidate()`.
- Any input calls `opts.onInput()`, the cancel hook for F5 flights.
- **No page scroll:** the canvas already has `touch-action: none` (`20-shell.css`), and the handlers call `preventDefault` on wheel and keys.

**Unit tests (`tests/unit/cam.test.mjs`):**
- 1000 seeded random orbit, zoom, pan and pinch operations on the sample and on a 100 x 100 m plot: every pose has phi in range, radius in range, the target in the box, and eye Y ≥ 1 − 1e-9;
- reset at aspect 0.56 and 1.6: the plot's bounding circle fits inside both half-angles;
- pan direction signs; zoom factor maths;
- `lerpPose` takes the shortest arc across ±π.

## 8. UI: `ui/stage-3d.js` (stage-5 controller), plus small changes
- **Registration:** `ui.shell.register(5, { enter, leave, render })`. The "not built yet" banner therefore no longer appears on stage 5. `main.js` calls `ui.stages.view3d.init()`.
- **`enter()`:**
  - `house = PC.house.build(store.get())`;
  - `PC.view3d.open(house, $('v3-canvas'), onState)`;
  - `onState` toggles `v3-building` and `v3-unavailable`, and on `'unavailable'` hides `v3-panel` and the canvas;
  - it fills `v3-level` with "All" plus one `tpl-v3-level` option per plan level, lowest first (question 11 on labels);
  - it keeps the session selection while that level exists, otherwise uses "All".
- **`leave()`:** `PC.view3d.close()`.
- **Opening state:** the view opens on **All with the Roof off** on its first open in a session. The selection is kept while the session lasts (A-4 session state).
- **Controls:**
  - level radios → `setLevel`;
  - `v3-roof` → `setRoof`;
  - `v3-reset` → `PC.view3d.resetView()`;
  - `v3-panel-toggle` → `is-collapsed` + `aria-expanded`, with a resize (the canvas is unchanged; only the overlay changes);
  - tabs View / Light / Tour → `is-current` + `aria-selected`.
- **F4-T3 / F5 controls** (time, presets, season, room select, tour buttons): `disabled` in F4-T1, so the phone check does not meet dead controls (question 3). No markup change; the controller sets the property.
- **Stage-4 and Skip paths:** unchanged. "Build 3D model" and Skip already land on stage 5 with every level approved (`start.js` `skip`, `MAX_BUILT 5`). Only the stage itself becomes live, and the `stages.js` comment is updated.
- **Manifest order:**
  - core `house.js`, `cam.js` after `sample.js`;
  - three `util.js`, `scene.js`, `build-shell.js`, `camera.js` after the data files;
  - ui `stage-3d.js` after `stage-interior.js`.
- **Contract:** no new `data-pc` hooks; `hooks.json` / `values.json` are unchanged.

## 9. Tests, focused runs, mutations

**`tests/three/*` (mock):**
- **`mock.test`** (§1.4).
- **`scene.test`:**
  - all three files load with `THREE` undefined (`load3d({ three: false })`), and `open` → `'unavailable'`;
  - `failRenderer` → `'unavailable'`, with no throw out of `open`;
  - the sample builds with no mock exception;
  - node names: `world`, `ground`, `groundOuter`, `groundPlot`, `groundCap`, `level-G`, `level-1`, `slab`, `walls`, `roof`, `site`, `hemi`, `sun`;
  - mesh count 7 for the sample, and ≤ 40 for the maximum house (3 floors + basement, 8 rooms per level, lift);
  - exactly one `castShadow` light; `mapSize` 1024;
  - `setPixelRatio(2)` at dpr 3, and 1.5 at 1.5;
  - `outputEncoding === sRGBEncoding`; `shadowMap.type === PCFSoftShadowMap`;
  - `setSize` always has 3 arguments with `false`;
  - a resize to 640x360 → `aspect = 640 / 360`;
  - the first open goes building → one yield → ready, with exactly one render after the first frame;
  - **idle → `raf.requested` does not grow** after `flush`;
  - `close()` → no pending frame, and orbit input requests none;
  - reopen → the same pose, and no rebuild for the same key;
  - `visibilityState = 'hidden'` + event → the pending frame is cancelled and input requests none; `visible` → one frame;
  - lost → `defaultPrevented`, no frames; restored → `rebuilds + 1`, every old geometry and material disposed exactly once, one render;
  - a rebuild with a new key (Q10 changed) disposes everything from the first build exactly once;
  - lights' values equal the noon key and the summer bounce mix.
- **`shell.test`:**
  - `groundPlot`, `groundOuter` and `groundCap` have `rotation.x === -PI / 2`;
  - the `groundPlot` shape has the plot's points and exactly one hole equal to the footprint;
  - Y offsets: 0, -0.05, 0.01, tint 0.015, hall 0.008;
  - slab vertex colours equal `col(mix(...))` for a sample room, hall, stair and lift (the stair and lift unmixed);
  - exterior walls use `E.wall`, partitions `E.wallInner`, pit walls `E.slab`, checked for each of the four exteriors;
  - partition dedupe: the sample's Ground has exactly the expected number of partition boxes (computed independently in the test from the plan rectangles), and no two boxes are identical;
  - the entrance gap is present on Ground only, centred at `entrance.u`;
  - stair and lift boxes are identical on every level;
  - with a basement there are pit walls and B's floor at `-pitch + 0.2`;
  - **level selector matrix:** All, B, G, 1, 2 × visible levels and `groundCap`;
  - **roof matrix:** `{off, on} × {all, G}`;
  - a moved room (after an edit) moves its tint quad.
- **`camera.test`:** pointer sequences through the adapter on the stub canvas:
  - 1-pointer drag right → theta decreases;
  - pinch out → radius decreases;
  - 2-pointer parallel drag → target moves, radius unchanged;
  - right-drag and Shift+drag → pan;
  - wheel down → radius increases, `defaultPrevented`;
  - arrows and `+` / `-` → the right direction, `defaultPrevented`;
  - `contextmenu` prevented;
  - each input → exactly one frame request;
  - lifting one of two pointers → no jump on the next move.

**`tests/e2e/view3d.spec.mjs` (mock, about 20 s):**
- **360x640 touch:**
  - Load sample → Skip to 3D = **2 taps** (G1 ≤ 6);
  - stage 5 shows the canvas, with Building… gone and unavailable hidden;
  - the canvas rectangle equals the `.pc-canvas-wrap` rectangle, and the last `setSize` = its client size;
  - `setViewportSize(640, 360)` → the aspect follows;
  - a one-finger drag on the canvas → theta changes, `scrollY` stays 0, `visualViewport.scale` stays 1;
  - a two-finger pinch → radius changes, page scale 1;
  - a two-finger pan → target changes;
  - the expanded panel covers ≤ 1/3 of the canvas height; the toggle collapses it (`aria-expanded = false`, body hidden);
  - the level selector shows All / Ground / First, and Ground → `level-1` hidden;
  - Back → stage 4: the wrapped rAF count is flat over 10 frames; Next → stage 5 keeps the pose;
  - hidden emulation → no rAF.
- **1280x800 mouse:**
  - drag → orbit;
  - right-drag → pan, Shift+drag → pan;
  - wheel → zoom, page not scrolled;
  - canvas focus + arrows / `+` / `-`;
  - Reset view → the reset pose.
- **Abort (one context, 360x640):** Skip → `v3-unavailable` shown, panel hidden; Back → stage 4 and stage 3 still work; no errors except the accepted three.js request.

**Updated existing specs** (they assert the old static preview on stage 5):
- `shell.spec.mjs` (step 10: banner → `v3-unavailable` shown, no banner);
- `plans-edit.spec.mjs` (Build 3D model → stage 5: the same change);
- `tests/unit/stages.test.mjs`: title text only.

**QA files that assert the stage-5 static preview.** Like the draft-v2 precedent, they must be made aware before the FS change lands (A-4 pattern; QA owns them):
- `f1-t2-flows.mjs` (D stage 5 notice);
- `f3-t2-editor.mjs` (step 8: banner);
- `f1-t1-layout.mjs` (stage-5 layout states: under abort the panel is now hidden, so those states need `three: 'mock'`, and `S.v3levels` may duplicate the options the controller fills).

I will list them for QA at hand-off. I do not edit `tests/qa/`.

**Focused runs:**
- `node tests/run-all.mjs --unit --three`;
- `node tests/run-all.mjs --unit --three --e2e --only view3d,shell,plans-edit`;
- plus a full run before review.

**Mutation checks** (on a copy of the tree, each must fail at least one named test):
1. pixel-ratio cap removed → scene;
2. one material without `col` → mock colour audit (scene / shell);
3. background through `col` → audit;
4. a frame requested while hidden → scene + e2e;
5. idle loop (rAF every frame) → scene "idle";
6. Q14 mirror in `house.js` (`fl` ↔ `fr`) → house Q14;
7. `house.js` reads the stored plan without the signature check → house refusal;
8. `groundPlot` rotation `+PI/2` → shell;
9. partition dedupe removed → shell count;
10. eye-height clamp removed → cam random;
11. restore without rebuild → scene;
12. dispose skipped → scene;
13. `setSize(w, h)` → mock throws (scene);
14. the old data-literal regex → lint test;
15. a permissive Proxy (no whitelist check) → mock.test;
16. a passive wheel listener / no `preventDefault` → camera test + e2e page not scrolled.

## 10. F3 follow-up bundle: F4-T2, not F4-T1 (TL rules)

**Recommendation: F4-T2**, agreeing with the PM and the CTO's deferred note. It would run as the **first, separately reviewed step of F4-T2** (FS + a Designer slot for the Undo button), before roof, furniture and site. Reasons:
- **Different code.** F4-T1 carries all of F4's untestable-on-a-phone risk and is already the largest task so far. The bundle touches `plans.js`, `stage-plans.js` and `shell.js`, which is stage-3 code with its own focused words (`plans-edit`, `plans-phone`, `shell`) and QA suites (`f3-t1`, `f3-t2`).
- **A cleaner phone check.** If a finding comes back from the F4-T1 phone check, it then points at one change set.
- **Client answers.** The answers to client questions 1 (rooms per floor) and 2 (hall access) are still pending. Under F4-T2 they can join the bundle without reopening F4-T1.
- **CTO items.** CTO debt item 6 (the lift-only overlap unit case) and the round-2 note (`applyEdit` refuses a stale plan or a side ≤ 0) are attached to "when `plans.js` is next opened". They ride with the bundle.

**Only cost:** the F4-T1 publish still shows the sample strip on stage 4, so "Skip to 3D" and "Build 3D model" appear side by side (decision 9). It is cosmetic, and the G1 tap count is the same.

**Alternative** if the TL wants it gone for the phone check: move only `STRIP_STAGES = [1, 3]` and its two test lines into F4-T1. This is one line, plus `shell.spec` / QA `f1-t2` expectations.

## 11. Acceptance map

| Criterion | Where proven |
|---|---|
| F4-S1 plot at the drawn shape | shell.test (`groundPlot` points = `ptsL - center`, rotation), real-spec shots |
| building at the footprint position | house.test (`footprint` from `analyse`), shell.test (slab box = footprint in T) |
| one storey per plan level at the Q8 height | house.test (`baseY = index x pitch`, `pitch = Q8 + 0.2`), shell.test (slab and wall Y) |
| rooms match the approved plans (position, size), also after an edit | house.test (exact equality + edit), shell.test (tint quads) |
| Q14 orientation in 3D (H3) | house.test Q14 in T (`fl` / `br` / `fr` / `bl`) |
| dollhouse: no ceilings, low walls | shell.test (no ceiling geometry: one slab per level at its floor; walls 1.2 m), shots |
| level selector, opens on All with the roof off | shell.test matrix, view3d.spec (All checked, roof off), stage-3d first open |
| basement opening | shell.test (B hides `groundCap` and the levels above; pit walls) |
| stairs and lift visible | shell.test (boxes on every level, identical), shots |
| Q10 exterior colours | shell.test (four exteriors), real spec colour pipeline, shots for the Designer |
| rooms distinguishable by tint | shell.test (tint = `mix(roomTints[type], wood, floorMix)`), shots |
| "Building…" state | scene.test (`onState` sequence), view3d.spec (overlay gone after build) |
| in-page message when 3D cannot start; stages 1–4 usable | scene.test (no THREE, `failRenderer`), view3d.spec abort context, updated shell / plans-edit specs |
| F4-S2 mouse, touch and keyboard gestures | camera.test (directions), view3d.spec (360 touch, 1280 mouse, keys) |
| no below-ground view, no flip, zoom clamped, Reset frames the plot | cam.test (1000 random operations, reset fit), view3d.spec Reset |
| canvas fills, keeps aspect on resize / rotation, no page scroll or zoom | scene.test resize, view3d.spec (rect, 640x360, `scrollY`, `visualViewport.scale`) |
| panel ≤ about 1/3 at 360x640, collapsible | view3d.spec |
| leaving or hiding stops frames, returning keeps the pose | scene.test, view3d.spec, view3d-real.spec 7 |
| G6 limits (mesh count, one shadow light, 1024 map, pixel ratio ≤ 2, no hidden frames) | scene.test (maximum house ≤ 40, already 11), real spec (calls, pixel ratio). The F4-T2 budget test completes it |
| F1-S5 Skip to 3D complete; G1 ≤ 6 taps | view3d.spec (2 taps to a live 3D view, levels approved) |
| H1 mock first, whitelist reviewed | §1, mock.test, real-spec conformance |
| H2 vendored r128 and real spec | §2 |
| H3 house model | §3 |
| H4 look tables as they are | §4 lights, §5 colours; no table edits |
| TL rider: data-literal lint | §6 |

## 12. Runtime budget
- **Today:** about 460 s (442–460 s in batch 8). Target ≤ 480 s (CTO item 7); the hard line is 10 min.
- **Node additions:** unit `house` + `cam` (about 1.5 s, the 1000-operation probe included) and three (four files, about 3 s). Steps run in series, so +4.5 s.
- **Browser additions,** run 2 at a time: `view3d.spec` (target ≤ 20 s) and `view3d-real.spec` (target ≤ 20 s, cap 30 s). That is +40 browser-seconds, about +20 s wall.
- **Changed specs:** `shell` and `plans-edit` stay the same length.
- **Expected total:** about 485 s, which is just over 8 minutes. If the full run is over 480 s, the agreed trigger applies (CTO item 7): QA trims `f2-t2` / `f2-t3` first in the F4-T1 QA round. I will not shorten my 3D checks below this plan.
- **Ways to keep my own share down:**
  - two viewports, not three, in `view3d.spec` (768x1024 stays with QA);
  - one browser per spec file;
  - the abort-path check shares its context's page load with the stage-4 checks;
  - shots only with `--shots`.

## 13. Measurements (scratch, outside the repo)
- `npm view three@0.128.0 dist.integrity` = `sha512-i0ap/E+OaSfzw7bD1TtYnPo3VEplkl70WX5fZqZnfZsE3k3aSFudqrrC9ldFZfYFkn1zwDmBcdGfiIm/hnbyZA==`. The fetched tarball hashes to the same value (6 543 441 bytes). `package/build/three.min.js` is 603 445 bytes, starts with the MIT `@license` banner, and its `sha512sum` begins `74bc547a5029…` (corrected at implementation: the plan first printed two stray bytes of the banner) (the full value goes in the README).
- The token rule of §6 on today's data files: all five pass; the `Math.min` variant fails at `Math`.
- Sample, from `PC.site.analyse`:
  - footprint `u 5.25, v 8, w 9.5, d 15`;
  - stair centred at P `(3.5, 5.5, 2.5 x 4)`, no lift;
  - Q8 3.0, so `pitch = 3.2`;
  - G and 1 have 7 rooms each;
  - exterior `sand`, roof `flat`.
- `dist/index.html` today: 395 764 bytes.

## 14. Risks
1. **The hosted page and the phone are untested here:** the iframe and CSP loading cdnjs, a real GPU, real touch.
   - The real spec removes the r128 API and colour risk, but not these.
   - Mitigations: the publish right after F4-T1 (H6), and the client phone check (question 3).
   - The "3D unavailable" path is tested, so a failure there degrades to the in-page message.
2. **On-demand rendering and PCF shadows.** r128 redraws the shadow map every `render` call. One render per input event is the same cost as a continuous loop while the user is dragging, and zero when idle. If a phone stalls while orbiting, the first lever is `PC.C.VIEW3D` (a 512 map or `antialias` off), which is data, not code.
3. **Mock drift from r128.** Closed by the conformance check (§1.4): whitelisted members must exist on real r128, and the maths must agree. The mock may still be stricter than r128, which is intended.
4. **Overlapping partitions after edits** (rooms a few cm apart). The same colour and height hide it, and a coplanar same-colour overlap shows no visible z-fighting. Merging near-parallel lines is deliberately left out to keep walls on the room edges.
5. **The runtime budget** is just over 8 minutes (§12): the QA trim trigger is agreed in advance.
6. **QA suites** that assert the stage-5 static preview (§9) fail until QA adapts them. Hand-off order: QA first, as with draft v2.
7. **The aspect-aware reset** (question 1) changes an A-12 number. If the TL rejects it, `2.2 R` stays, and the e2e expectation becomes "the reset pose equals A-12", not "the plot fits".

## 15. Questions for the TL
1. **Reset view:** may the radius be aspect-aware (`max(2.2 R, 1.05 R / sin(min half-angle))`) with `rMax = max(3 R, 1.2 x reset)`, so a portrait phone frames the whole plot (§7)? Recommended: yes.
2. **Render loop:** on-demand (one frame per invalidation, zero while idle), rather than a running rAF loop that skips clean frames? Both satisfy A-10. Recommended: on-demand.
3. **Controls not yet built** (time, presets, season, room select, tour, and the Roof switch until F4-T2 has roof geometry): `disabled` in F4-T1, so the phone check meets no dead controls? Recommended: yes, with the Roof switch disabled too. Its state logic is still wired and mock-tested.
4. **`groundOuter` offset:** A-10 says both "-0.02" (scene graph) and "0.05 m below" (z-fighting). I use 0.05.
5. **Floor convention:** the slab is the bottom 0.2 m of each storey, so the floor is at `baseY + 0.2` (a 0.2 m plinth on the ground floor). A-9 is silent; please confirm, or rule otherwise.
6. **Hall tint:** one whole-footprint hall quad at `floorY + 0.008`, under room quads at `+0.015` (A-10 names only 0.015). OK?
7. **Whitelist:**
   - approve the two additions, Euler `x/y/z` and Vector2 `x/y/set`;
   - the `then` / `toJSON` probe exception;
   - the stricter-than-A-10 mock checks: the render-time colour audit, `Mesh` arity, attribute-count checks;
   - the `__threeMock` side channel with its lint guard.
8. **`CatmullRomCurve3`:** port real r128 maths into the mock now (my plan, about 80 lines, checked against real r128), or leave a stub until F5?
9. **Stair and lift:** plain 1.2 m boxes (wall height) in F4-T1, the lift not a full-height shaft?
10. **F3 follow-up bundle:** F4-T2, as its first separately reviewed step (my recommendation, §10)? Or only the `STRIP_STAGES` line in F4-T1?
11. **Level selector labels** at 360 px, with up to 5 options: "All / Basement / Ground / First / Second" (`LEVEL_LABEL` without " floor") checked for no overflow in e2e, with a full `aria-label` on each. Or short "B / G / 1 / 2"? Recommended: the words, with the Designer judging the shot. The Designer or PM may overrule.
