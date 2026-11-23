# F6-T2 richer interiors + evening indoor lights: technical constraints

Date: 2026-11-23. Author: CTO.

- **Source:** the client's feedback that interiors are dull and nothing lights them in the evening.
- **Binding on:** the Designer plan, the TL plan and reviews, FS and QA.
- **Relation to F6-T1:** `docs/03-tasks/F6-T1/cto-constraints.md` (C-1 to C-8) and its amendments stay in force; this file only adds to or tightens them.
- **Who decides:** **must** items need the CTO to change; the rest the TL decides and records in `architecture.md`.

## 0. Baseline (main 6968d00, maximum house, real r128; F6-T1c impl notes and `budget.test`)
| Measure | Now | F6 ceiling (C-4 / C-3) |
|---|---|---|
| Meshes | 27 (28 with highlight) | test line 64, G6 150 |
| Draw calls, Roof on / off, incl. shadow pass | 27 / 25 | 160 |
| Triangles | 22.4k | 300k |
| Textures | 4, 4.02 MB | 12, 16 MB |
| C-4.8 solo build | 166 ms | 400 ms |
| Loaded build guard | ≤ 905 ms | 1200 ms |
| `dist/index.html` | 605 023 B (gzip 171.6 kB) | 627 302 B (C-1.3) |
| Default run (median of 3) | 406.5 s | 420 s |
| Release step processes | 243.5 / 239.7 s | NOTE 260 / limit 300 s each |

There is room on every GPU budget. The two tight resources are **dist size** and **release-step run time** (sections 5 and 6).

## 1. Indoor light: no real lights. Fake glow only. (**must**)
1. **No new `THREE.Light` of any kind.** That means no `PointLight`, `SpotLight` or `RectAreaLight`, with or without shadows, in either tier. The rig stays one `HemisphereLight` plus one `DirectionalLight` sun.
   - **Cost per fragment:** in r128 every light is evaluated in every fragment of every `MeshStandardMaterial`. Forty rooms of lamps would multiply the cost of each pixel on a phone.
   - **Recompile stalls:** the number of lights is part of the shader program key. Switching lamps on at dusk recompiles every program, a visible stall on phones.
   - **Shadow passes:** every light that casts a shadow adds one.
2. **Allowed ways to show indoor light.** Each is a **uniform or visibility change only**, driven by `applyLook` from the hour, so no shader recompiles:
   - a. **Lit windows:** the existing glazing / pane material gets an emissive colour and intensity that rise after dusk. Its `emissive` and `emissiveIntensity` are present from build time (value 0 by day); **never** add or remove an `emissiveMap` at run time.
   - b. **Lamp pieces:** shades, bulbs and under-cabinet strips. They are furniture parts on an emissive "lamp" material, in **one batch per level** (`lamps`, +1 mesh per level, never casts shadows).
   - c. **Interior night lift:** a small emissive term on the floor and furniture materials at night, so rooms read warm from the open dollhouse top. The value comes from data, through `applyLook`.
   - d. **Light pools:** soft warm quads on floors under lamps and on the ground outside lit windows. There is **at most one `glow` mesh per level**, an `InstancedMesh` or batch with `AdditiveBlending`, `depthWrite: false`, `transparent: true`, no shadow cast or receive, and `fog: false` on outdoor pools only if the TL finds the fog washes them out.
     - Additive blending does not depend on draw order, so these meshes are **outside** the C-2 "2 transparent meshes" cap (which stays `poolWater` + `blobs`).
     - The mock asserts every transparent mesh is either one of those two by name or an additive `glow-*`.
3. **When the lights are on** is data, not code: an `indoor` 0–1 value per hour key in `PC.data.sky` (or a dusk/dawn rule on sun elevation that the TL picks), blended like the other keys (A-13).
   - It is a look change: no geometry is created or moved, and the camera is untouched (A-13 semantics, C-6.3).
   - The sky golden is regenerated only through its generator, with the changed rows listed by the TL.
4. **Visibility composes.** A `glow` or `lamps` mesh is visible only when its level is visible (level selector, Basement rule) **and** `indoor > 0`.
   - Tests cover level selector × night × Roof.
   - QA's magenta leak check must stay green: no glow above `groundOuter` inside the footprint when the Basement is selected.
5. **Colour:** emissive colours go through `PC.three.col` and are tone-mapped (ACES), so "warm" has to be tuned under ACES. The highlight stays `toneMapped: false` and must stay distinguishable from lit windows at 22 h (a real-r128 pixel check).
6. **Phone tier (`lite`):**
   - **kept:** a, b and c (uniform-only, about free);
   - **hidden:** d (overdraw);
   - **full tier:** everything.
   - Both tiers are mock-tested on the maximum house at 22 h.

## 2. Furniture: richer, inside the A-11 rules
1. **Placement is unchanged.** A-11's envelope rule (anchors, inset, scale steps 1.00 → 0.60, overlap > 0.01 + 1e-9) still runs on each piece's `w × d`. Richness comes from **parts inside the envelope**:
   - the schema gains an optional `parts: [{ x, z, y0, w, d, h, color, mat }]`, relative to the piece and scaled with it;
   - parts stay inside the piece envelope (a unit test checks every part of every type);
   - the TL amends the A-11 schema text;
   - `PC.furnish` returns the boxes, and QA's placement oracle stays valid because it judges envelopes.
2. **The 1.1 m height cap stays.** Nothing rises above the 1.2 m cut walls, so the dollhouse still reads from above, and floor lamps are low or table lamps. Changing it needs a TL ruling with a PM look check.
3. **Furniture still has one batch per level per material.** At most **3 furniture materials** (plain, textured wood/fabric, `lamps`), so at most +2 meshes per level over today.
4. **Q18/Q19 semantics hold.** Q18 changes colours only, never boxes. Q19 sparse has fewer pieces than full for every type. Both are already tested; keep the tests green, unmodified apart from the new counts.

## 3. Budget deltas for F6-T2 (maximum house, full tier, 22 h, Roof on)
| Measure | F6-T2 target | Ceiling unchanged |
|---|---|---|
| Meshes | ≤ **40** (27 + ≤ 3 per level + 1) | 64 test line |
| Draw calls incl. shadow pass | ≤ **80** | 160 |
| Triangles | ≤ **120k** (parts, lamps) | 300k |
| Textures | ≤ **6**, ≤ **8 MB** (e.g. + fabric weave, + glow falloff 64 px) | 12, 16 MB |
| C-4.8 solo build | ≤ **250 ms** | 400 ms |

- `budget.test` asserts the new exact counts as today.
- The real-r128 `view3d-real` check records draw calls and triangles at 12 h and 22 h.
- **Lite tier:** no glow meshes, textures at 256.

## 4. Shadows
- There is no new caster light, so the shadow passes stay as they are (one sun map; 2048 on desktop, 1024 on phones and in lite).
- Lamps and glow meshes **never** cast or receive shadows. Furniture parts cast and receive, as furniture does today; that adds caster triangles, which the ≤ 120k / ≤ 80 limits cover.
- The F6-T1 shadow-update rule holds: `needsUpdate` fires only on build, look, resize, level selector, Roof and restore. The indoor lights change no caster, so turning them on must **not** trigger a shadow update. A mock test checks that an `indoor` change leaves the update count unchanged.
- At night the sun is weak, so shadow quality at 22 h is not a criterion. Do not raise the map size for night.

## 5. Dist size: C-1.3 is not raised. Buy room by stripping comments in the build (**must**)
- **The headroom is about 22 kB.** Richer furniture tables, lamp data and texgen kinds will not fit reliably.
- **Where the bytes are:** of the 605 kB in `dist`, about **121 kB is source comments** (63 kB whole-line `//`, 58 kB `/* */` blocks) and about 40 kB is indentation.
- **Raising the limit is the wrong fix.** The comments help the people editing `src/` and do nothing for the person loading the page.
- **Ruling:** `C-1.3 stays 627 302 B` and **F6-T2 must fit under it**. The sanctioned way to make room is a **first FS step in F6-T2** (before any feature code), reviewed by the TL:
  1. `build.mjs` removes from inlined **JS** only:
     - whole lines whose first non-blank characters are `//`;
     - `/* … */` blocks that start a line after whitespace.
     No other minification and no renaming. CSS and HTML are untouched, and `src/` keeps its comments.
  2. **Safety:**
     - the build parses every resulting script with `new vm.Script` and fails on any error;
     - unit `lint.test` gets cases for strings containing `//` and `/*`;
     - the full default run and the release gate must be green on the stripped build;
     - the lint still scans both `src/` and `dist/`.
  3. Record the new dist size. The ~100 kB gained is **not** a licence to spend: the next feature still needs to show its own size line, and C-1.3 stays the limit.
- If the TL finds the strip unsafe for some file, the fallback is cuts inside F6-T2's own data (shared part templates instead of per-type lists), never a raised limit without me.

## 6. Run time: default ≤ 420 s; a third release process is allowed under conditions
1. **Default gate unchanged:** median of 3 quiet runs ≤ 420 s, none over 440 s. F6-T2's new checks buy back their own time:
   - mock and unit checks are free;
   - new real-r128 checks fold into `view3d-real` (≤ +10 s) and existing QA page loads;
   - anything more moves to the release step.
2. **Release step:** the two processes are at 243.5 / 239.7 s against the NOTE line of 260. A **third parallel process is allowed** on these conditions:
   - a. **No timing-sensitive check** goes into it. Frame or flight durations, build-time guards and the C-4.8 solo step stay where they are, and the C-4.8 step still runs **alone** before the pool.
   - b. Each process ≤ 260 s (NOTE) and ≤ 300 s (limit), with the release wall time printed.
   - c. **Before the F6-T2 QA sign-off:** 3 consecutive `QA_FULL=1` runs with three processes and no flake. If anything flakes, go back to two processes and cut instead.
   - d. On 4 CPUs with SwiftShader, three browser processes plus the pool is the maximum. **A fourth needs me.**
   - e. QA prefers cuts to growth: duplicates first (the F3 rows QA already identified), then a third process.

## 7. Unchanged (from F6-T1 C-6)
- APIs: `PC.house` (additive: `parts`, lamp data; bump `v`, key covers them), `PC.view3d`, finder, tour, `PC.cam`.
- Scene names stay; new names are `lamps-<level>` and `glow-<level>`.
- A-13 look semantics.
- The layout golden is frozen.
- Pixel thresholds change only with TL approval and before/after numbers.
- The contract hooks.
- Leak suite: geometry and texture counts constant over the 200-op maximum-house stream, now including 22 h looks.

## 8. Required tests and mutation proofs (the TL completes the list)
**Tests**
- No light other than `hemi` / `sun` in the scene, in any tier or look.
- An `indoor` change creates nothing, recompiles nothing (program count from `renderer.info.programs` unchanged on real r128 between 12 h and 22 h) and leaves the shadow-update count unchanged.
- Parts inside the envelopes for all types × S/M/L, and at the 1.5 m minimum room.
- The transparent-mesh rule asserted by name.
- Glow visibility composes with the level selector and Basement.
- `lite` hides glow.
- At 22 h the windows are brighter than at 12 h (real-r128 pixel read).

**Mutations, each caught by a test**
- a `PointLight` added;
- `emissiveMap` toggled at dusk;
- glow left visible on a hidden level;
- a glow mesh not additive;
- shadow update triggered by `indoor`;
- a part outside its envelope.

## 9. Phone gate (CD-7)
- The client's phone check still applies. It should include one evening look (time preset 22 h) on the F6-T2 build, because night interiors are the new GPU cost.
- If phones stall at night, the first response is data only: the `lite` tier for phones (C-4.7). Do not drop features in code.

VERDICT: APPROVED (constraints set; the Designer and TL plans are reviewed against them)
