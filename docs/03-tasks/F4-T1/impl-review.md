# F4-T1 implementation review (TL, step 3d) — round 1, 2026-11-21

Reviewed: commit `2ebb9ea` (FS F4-T1 + QA's version-aware updates + PM round-9 labels). Code read in full: `src/js/core/house.js`, `cam.js`, `const.js` (HOUSE / CAM / VIEW3D), `src/js/three/util.js`, `build-shell.js`, `scene.js`, `camera.js`, `src/js/ui/stage-3d.js`, the `stages.js` / `main.js` / `index.html` diffs, `tests/lint-constraints.mjs` (token rule, `mock-backdoor`, `scanVendor`), `tests/helpers/browser.mjs` (`three: 'real'`, `dpr`, `THREE.` warnings as errors), `tests/vendor/README`, and the relevant parts of `tests/three-mock.js` (proxy trap, `then` / `toJSON`, colour flags, `audit`) and of the new tests.

## Own probes

- **Focused runs.** `node tests/run-all.mjs --unit --three`: all steps green (three: 39/0 in 1.7 s). `--e2e --only view3d,shell,plans-edit`: view3d 45/0, view3d-real 38/0 (4.0 s), shell 596/0, plans-edit green, 43.9 s.
- **Real r128 look.** `node tests/e2e/view3d-real.spec.mjs --shots` gave 38/0 and five shots in `docs/03-tasks/F4-T1/shots/`. I read them:
  - the sample sits on its plot with the street side towards the camera; the reset frames the whole plot at 1280x800 and at 360x640;
  - room tints are distinct, the hall reads as a neutral floor, the stair is a grey block, walls are low with the entrance gap on the Ground front wall;
  - the Q10 exteriors differ; there is no z-fighting.
- **My own Playwright script on real r128** (`three: 'real'`; it lives in my scratchpad and is not part of the repo):
  - **Shadows.** Turning the sun's `castShadow` off changes 5 410 of 883 200 px. Shadows are on but small, because the noon summer sun is high (72°).
  - **Level "Ground".** The First floor is hidden and the Ground rooms and stair read clearly.
  - **Zoom out.** Wheel to `rMax` (1.2 x the reset radius): no tint flicker.
  - **Basement + lift + ft.** After the commit, the level selector reads All / Basement / Ground / First on one row at 1280.
  - **Phone 360x640 dpr 2.** I opened the Light and Tour tabs.
  - No page or console errors anywhere.
  - **Raw stale-plan commit on stage 5.** `stages.status` stage 3 becomes invalid, the house is `null` and `v3-unavailable` shows, with no throw.
- **Mutations of my own** on a scratch copy, house + three tests:
  - caught:
    - `topHex` ignored → shell;
    - near plane fixed at 0.5 → scene;
    - no ground bounce in `noonLook` → scene;
    - Q14 front/back mirror in `layout.core` → house Q14;
  - **survived:**
    - the token check removed from the Building… yield (`close()` + reopen inside the yield builds twice) → note 1;
    - the refusal reduced to `st[3].valid` → note 2.
- **Full run** `node build.mjs && node tests/run-all.mjs` (TL, on commit `2ebb9ea` + rebuilt dist): **exit 0, all steps passed in 482.3 s**.

## Plan-review rulings and required items: all met

| Item | Where | Verdict |
|---|---|---|
| H1 order (mock + conformance before scene code) | FS checkpoint status line before the scene line; `view3d-real` part A: every WHITELIST member `in` a real instance, maths = r128 (Color, Matrix4, Vector3, 4 curves) | met |
| Q1 aspect-aware reset, `rMax`, never clamped | `PC.cam.resetRadius` / `limits`; cam.test reset at 0.56 / 1.6 + not clamped | met |
| Q2 on-demand loop | `request()` guards active / lost / building / pending / visible; `frame()` re-checks; scene.test idle, close, hidden | met |
| Q3 disabled set | `stage-3d.js` LATER + tour-speed radios; view3d.spec asserts the set and the enabled ones | met in code. **Visual condition 1 below** |
| Q4 groundOuter 0.05 | `HOUSE.outerDrop` | met |
| Q5 storey convention | `house.js` header, build-shell `floorY = baseY + slab`, pit walls to Y 0 | met |
| Q6 hall on the slab top face | `BoxBatch.add(…, hex, topHex)` (face index 2 = +Y), no hall quad; shell.test top / sides | met |
| Q7 whitelist + strictness + default-white exemption | mock flags `lin` / `dflt`, `audit()` on render; `then` / `toJSON` reads only; `mock-backdoor` lint | met |
| Q8 Catmull-Rom port | mock + real conformance (4 curve cases + 2-point) | met |
| Q9 1.2 m stair / lift boxes | build-shell; partitions never run along the core block (no two-colour coplanar tops) — a sensible addition | met |
| Q10 bundle not in F4-T1 | untouched `plans.js` / `shell.js` STRIP_STAGES | met |
| Q11 labels (PM round 9) | `shortName` + `aria-label` = `LEVEL_LABEL`; "All floors" in the markup; 5-option house fits at 360 (view3d.spec) | met |
| Req 2 refusal `reachable && valid` | `house.js` line 1 of `build` | met (test gap: note 2) |
| Req 3 painted Building… yield + token | `open()`: rAF → setTimeout 0 → token check | met (test gap: note 1) |
| Req 8 QA-first | QA status line precedes the FS implementation line; f1-t2 D, f3-t2 8, f1-t1 s5 states version-aware | met |
| Req 9 near plane | `PC.cam.near`, applied in `render()` | met |
| H2 vendored r128 | README with the tarball integrity = CTO value and the file sha512 (I checked it: `74bc547a…`); exact-URL routing; `scanVendor` licence banner + 600 000-byte tripwire (dist 435 581 bytes) | met |
| H3 house model | approved plans + `PC.layout.core`, never generate / sync (test replaces generate with a thrower); Q14 in T; follows edits | met |
| H4 tables as they are | noon key + summer `groundBounce` mix; exteriors / interiors / roomTints / siteColors; no table edits | met |
| H5 | batch 8 | met |
| Data-literal lint rider | token rule as specified; lint test (64 cases) | met |

Correctness checks I made by hand:
- **Frames.** `ShapeGeometry` maps shape `(u − cu, v − cv)` through `rotation.x = −π/2` to `Z = −(v − cv)`. The holes use the same frame.
- **Box faces.** All six `BoxBatch` faces have outward normals and wind counter-clockwise, so `u × v` = the normal for every row of FACES.
- **Pan.** Right = `(cos θ, 0, −sin θ)`, forward = `(−sin θ, 0, −cos θ)`, so the content follows the finger.
- **Eye-height clamp.** `phi ≤ acos((1 − ty) / r)`.
- **Sun direction.** `(−sin N cos E, sin E, cos N cos E)` = A-13 at noon.
- **Shadow box.** Half-size = `min(2.5 x half-diagonal, 1.2 R)`.
- **Disposal.** Tracked meshes + materials, each exactly once.
- **Context restore.** Rebuilds the scene after r128's own listener has run.
- **Unavailable path.** `open(null | no THREE | renderer throws)` reports `'unavailable'` and never throws.

## Conditions (before the publish; QA can start now)

1. **Designer: the disabled Light controls must look disabled** (Q3 intent: the phone check must meet no dead controls; the PM's guide line says "greyed out on purpose").
   - On my 360x640 and 1280x800 shots, the time slider (blue thumb), the Season and "Go to room" selects, and the preset buttons (only faintly) still look live. The Tour button, speed radios and Roof switch do read disabled.
   - The CSS has disabled rules for `.pc-btn`, `.pc-opt` and `.pc-switch` only.
   - Add `:disabled` styles for `.pc-range` (thumb and track in the muted ink / rule colours, `cursor: not-allowed`) and `.pc-select` (sunk background, `--ink-3` text), and make the disabled `.pc-btn--icon` presets as clearly muted as the Tour button.
   - Optional: the disabled tour-speed radios show the selected "Normal" struck through. That is the existing `.pc-opt` disabled style, so the Designer judges it.
   - One e2e or QA check of the computed style at 360x640. TL addendum.

## Non-blocking notes

1. **Test gap (FS, F4-T2).** Add a scene.test case: `close()` then a reopen with the same house inside the yield → exactly one build (`builds === 1`) and one render. Today the case of removing the token check survives. A double build is waste, not a wrong picture.
2. **Test gap (FS, F4-T2).** The refusal's `reachable` half is not pinned. The stage-2 conflict case also makes G's signature stale, so `valid` alone already refuses it. Add a state where stage 3's plans stay fresh but stage 1 or 2 is not valid (e.g. forge `plot.closed = false` with the stored sigs recomputed by the test's own copy of `sig.level`), or record that none is reachable.
3. **Ground edge (FS one constant + Designer look).** `groundOuter` is 8 R square, so at the reset pose its edge cuts a sky-coloured wedge into the top corners of every shot (a "table edge"). Raise `HOUSE.outerK` to about 36, so the edge lies just inside the camera's far plane (`far` = 20 R). The ground then fills the reset view and the edge is near the horizon. It is a const change and the Designer judges the shot. Fine in F4-T1 before the publish if the Designer is in the file anyway; otherwise F4-T3 (look).
4. **Shadows are faint at noon in summer** (sun 72° high; 0.6 % of pixels change). That is correct for the table, and F4-T3's time slider shows them. The Designer and the phone check judge them, not a test.
5. **Wheel during Building…** is not `preventDefault`ed (controls are inactive while building), so a wheel over the canvas in that ~1 frame may scroll the page. That is harmless because the stage does not scroll.
6. `stage-3d.js` builds the model on every store commit while stage 5 is open, which is cheap (compared by `key`). Only the unit toggle commits there today.

## Runtime

FS full run 493.7 s, over the 450 s target set at the plan review. The overrun is the known QA share, and the trim of f2-t2 / f2-t3 is in QA's F4-T1 round as ruled. FS's own additions are about 10 s (three 1.7 s, view3d 4.1 s, view3d-real 4.0 s). `--jobs` stays 2.

## QA focus list (F4-T1 QA round)

1. **Acceptance map** of plan §11 against the built page, with `three: 'mock'` and `three: 'real'`:
   - plot shape;
   - footprint position;
   - storeys at Q8 + 0.2 pitch;
   - rooms = approved plans (also after an edit + approve, in m and ft);
   - opens on All with the Roof off;
   - level selector matrix incl. Basement opening the ground (a basement + lift + 3-floor house);
   - stair / lift on every level;
   - four Q10 exteriors;
   - tints per room type.
2. **Q14 in 3D with your own oracle.** For `fl` / `fr` / `bl` / `br` / `centre`, the stair box's T corner seen from the street. Use `PC.debug.scene()` meshes or the house model plus `l2t`.
3. **Gestures.** 360x640 and 640x360 touch (CDP touch: one-finger orbit, pinch, two-finger pan, lift one finger with no jump) and 1280x800 mouse (drag, right-drag, Shift+drag, wheel, arrows, `+` / `-`). Also check:
   - clamps after long random gesture runs: phi 5–85°, eye ≥ 1 m, target in the plot box;
   - page `scrollY` 0 and `visualViewport.scale` 1;
   - Reset frames the plot at 360x640, 640x360 and 1280x800.
4. **Loop.**
   - Zero rAF while idle, after Back to stage 4, and while hidden; one frame after returning.
   - Pose kept on return; no rebuild for the same key; a Q10 change → rebuild with the pose kept.
5. **Unavailable path** (abort, and the mock's `failRenderer`): the message, stages 1–4 usable, zero console errors except the accepted request.
6. **G6 on the maximum house:** ≤ 40 meshes (11 today), one shadow light, map 1024, pixel ratio ≤ 2 at dpr 3.
7. **The disabled control set** (condition 1 once landed: computed styles), and level labels at 360 px with 5 options.
8. **The f2-t2 / f2-t3 trim**, target full run ≤ 450 s (plan-review runtime ruling).

VERDICT: APPROVED

## Round 1 addendum — condition 1 and FS items 1 and 3 (TL, 2026-11-21)

Reviewed: commit `e0fd473`, `designer-fix.md`, `fs-outerk.md`, the CSS and const diffs, `designer-shots/` and the re-taken `shots/`.

**Condition 1 (Designer): met.**
- `30-components.css` gives the disabled controls the same muted set as `.pc-btn:disabled`:
  - `.pc-range:disabled`: track, thumb and the following `output`;
  - `.pc-select:disabled`: sunk background, `--ink-3` text, muted arrow, `opacity: 1`;
  - `.pc-btn--icon:disabled` icons at 0.5.
- I read `designer-shots/360x640-light.png` and the new `shots/1280x800-sand-noon.png`. The slider, presets, Season, "Go to room" and the tour buttons all read as unavailable. View, Reset and the level radios stay live.
- The icon rule is generic. It also mutes stage-2 setback / north stepper icons when they are disabled at a limit. That is consistent; QA notes it if any looks wrong.
- Leaving the tour-speed radios as they are is accepted (they share the stage-2 `.pc-opt` disabled style).
- The `view3d.spec` computed-style check is in, and 2 mutations are caught.

**FS item 3 (`HOUSE.outerK` 8 → 36): met.** The ground edge at 18 R lies inside the far plane at 20 R. The new shots have no sky wedge: the top corners are lit neutral ground, the house reads as before, and there is still one mesh.

**FS item 1 (double build): met.** `scene.test` checks that close + reopen inside the Building… yield gives exactly one build and one render. FS reports that removing the token check now fails it. Item 2 (the refusal's `reachable` half) stays for F4-T2.

**Probes.**
- `node build.mjs && node tests/run-all.mjs --unit --three --e2e --only view3d`: all green in 19.6 s (three 0 fail; view3d 46/0; view3d-real 38/0).
- No full run (QA is testing in parallel). QA's sign-off run is the full run for this state.

Nothing blocks the publish.

VERDICT: APPROVED
