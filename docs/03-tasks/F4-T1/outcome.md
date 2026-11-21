# F4-T1: 3D house shell, camera and stage-5 view (outcome)

Owner: FS. Status:
- **PASSED QA**: `qa-report.md` (QA `f4-t1-model` 10/0 and `f4-t1-view` 163/0, 19 source mutations caught).
  - Its two minor bugs, F4T1-1 and F4T1-2, are fixed (§6). QA's KNOWN entries no longer match anything.
- TL implementation review **APPROVED** (`impl-review.md`). Its round-1 addendum is also APPROVED:
  - the Designer's disabled styles (`designer-fix.md`);
  - FS `outerK` 36 and the double-build test (`fs-outerk.md`).

Sources:
- `plan.md` and `plan-review.md` (TL rulings Q1–Q11, required items 1–9, CTO H1–H5);
- architecture A-5 (frames), A-9 (house model), A-10 (three layer, whitelist, colour rule), A-12 (camera / input), A-16 (tests);
- PM round 9 (level labels);
- the Designer's F3-T3 look tables and art-direction note.

## 1. What was built

Stage 5 is now a live 3D view of the approved plans, built on three.js r128 from the single cdnjs tag. The view shows:
- the plot ground;
- per level: slabs with room tints and the hall colour on the slab top face, exterior walls with an entrance gap on Ground, partitions, and the stair / lift blocks;
- a basement pit when the house has a basement.

The user can:
- orbit, pan and zoom by touch, mouse, wheel and keys;
- reset the view;
- pick the levels to show (All / one level).

Time, presets, season, room finder, tour and the Roof switch are present but disabled (TL Q3), styled disabled by the Designer.

- **House model (core, A-9).** `PC.house.build(state)` returns `null` unless `st[3].reachable && st[3].valid` and a footprint exists. It never generates a layout: it reads the approved plans and `PC.layout.core`.
  - `center` / `radius` come from the plot in frame L.
  - Levels `B, G, 1, 2` have `baseY = index × pitch`.
  - Rooms are given in L metres; `stair` / `lift` come from the core.
  - It also holds the roof descriptor, site rectangles (entrance, parking, pool, wall) and `vegPct`.
  - `key` is an FNV-1a hash of the model.
  - Q14 is pinned by a test in frame T (`fl` = min-X / max-Z, street at +Z).
- **Camera maths (core, A-12).** `PC.cam`:
  - Q1 aspect-aware reset radius `max(2.2R, 1.05R / sin(min half-FOV))`, θ 30°, φ 50°.
  - Limits: φ 5–85°, r 4 … `max(3R, 1.2 × reset)`, target inside the plot box; the eye clamp keeps the eye at least 1 m above ground.
  - `near = max(0.5, 0.02 r)`; `far = 20 R`.
- **Three layer (A-10).**
  - `util.js`:
    - `col` (sRGB → linear);
    - `mixHex`;
    - `BoxBatch`: merged vertex-coloured boxes and quads in one mesh, with a top-face colour (Q6).
  - `build-shell.js`:
    - the ground: `groundOuter` is a 36 R square at −0.05, `groundPlot` has the footprint hole, and `groundCap` sits at 0.01;
    - per level, the `slab` and `walls` meshes;
    - deduped partitions;
    - plain 1.2 m stair / lift boxes (Q9).
    - The sample has 7 meshes and the maximum house 11 (G6 limit 40).
  - `camera.js`: Pointer Events (one pointer orbits; right-drag or Shift pans; two pointers pinch and pan), wheel `passive: false`, the context menu suppressed, arrow keys and `+` / `−`.
  - `scene.js`: `PC.view3d`.
    - Rendering is on demand (Q2): no frames while idle, hidden, closed or lost.
    - Building… shows for one painted frame (rAF → setTimeout 0 → build, guarded by a token).
    - Pixel ratio is capped at 2; a ResizeObserver follows the canvas.
    - Context loss and restore are handled (the restore rebuilds).
    - Disposal covers every tracked mesh and material.
    - One hemisphere light and one sun (the only shadow caster, 1024 map) are fixed at noon in summer.
- **Stage-5 controller (ui, no THREE).** `stage-3d.js`:
  - the Building… and unavailable overlays;
  - the level selector (PM round 9 labels and aria-labels; only the house's own levels; All first and selected on open);
  - Reset, the collapsible panel and its tabs;
  - the disabled later-task controls;
  - a rebuild only when `house.key` changes.
- **Lint.**
  - `data-literals-only` is now a token rule: `Math.min(…)` and similar now fail. This closes QA F3-T3 obs 1.
  - A `mock-backdoor` rule.
  - A vendor licence-banner and size check on dist.

## 2. Files

- New app files:
  - `src/js/core/house.js` and `cam.js`;
  - `src/js/three/util.js`, `build-shell.js`, `camera.js` and `scene.js`;
  - `src/js/ui/stage-3d.js`.
- Changed app files:
  - `src/js/core/const.js` (`HOUSE`, `CAM`, `VIEW3D`);
  - `src/manifest.json`;
  - `src/js/main.js`;
  - `src/index.html` (aria-label "All floors").
- Comment-only edits: `src/js/core/stages.js` and `src/js/ui/stage-interior.js`.
- New test files:
  - `tests/three-mock.js` (strict r128 mock);
  - `tests/vendor/three-r128.min.js` and its `README` (sha512 = CTO value; tests only, never in the build);
  - helpers `load3d.mjs`, `three-factories.mjs`, `houses.mjs` and `batch.mjs`;
  - `tests/three/{mock,scene,shell,camera}.test.mjs`;
  - `tests/unit/{house,cam}.test.mjs`;
  - `tests/e2e/view3d.spec.mjs` (mock) and `view3d-real.spec.mjs` (real r128).
- Changed test files:
  - `tests/helpers/browser.mjs` (`three: 'real'`, `dpr`);
  - `tests/lint-constraints.mjs` and `tests/unit/lint.test.mjs`;
  - the stage-5 assertions in `tests/e2e/shell.spec.mjs` and `plans-edit.spec.mjs`.
- Docs:
  - `plan.md`, `fs-outerk.md` and this file;
  - `shots/` (from `view3d-real --shots`).

## 3. APIs for F4-T2 / F4-T3

- `PC.house.build(state) → model | null`.
  - F4-T2 fills `furniture`, the `roof` geometry and the site fields (`gate`, `seating`, `northMarker`, `trees`, `shrubs`) that are empty or null today.
  - `key` must keep changing whenever the drawn content changes.
- `PC.view3d`:
  - `open(house, canvas, onState) → {ok}`; `onState` receives `'building' | 'ready' | 'unavailable'`;
  - `close()`, `invalidate()`;
  - `setLevel('all' | id)`, `setRoof(bool)` (the logic is wired; the switch stays disabled until F4-T2);
  - `resetView()`;
  - `setOnInput(fn)`: a hook for the F5 flight cancel;
  - `pose()`;
  - `info()`: for tests and `PC.debug.scene()`; includes `renderNow`.
- `PC.three`:
  - `col(hex)`: every material and light colour goes through it; `scene.background` takes the raw hex.
  - `mixHex`, `BoxBatch(add(cx, cy, cz, sx, sy, sz, hex, topHex), addQuad, build)`.
  - `buildShell(house, world, mats)`; empty `'roof'` and `'site'` groups are ready for F4-T2.
  - `partitions(house, level)`.
  - `makeRenderer`, `noonLook()` and `noonSunDir()`. F4-T3 replaces the fixed noon with the time / season tables.
- `PC.cam`: `reset`, `limits`, `clamp`, `orbit`, `zoom`, `pan`, `near`, `lerpPose` (for the F5 tour), `position`.
- Mock: any new r128 member needs a whitelist row in `tests/three-mock.js`, a factory in `three-factories.mjs` and a green `view3d-real` conformance run. The TL approves whitelist additions.

## 4. How to verify

- `node tests/run-all.mjs --unit --three --e2e --only view3d,shell,plans-edit,contract`. Current counts:

  | Suite | Count |
  |---|---|
  | three: mock / scene / shell / camera | 13 / 16 / 6 / 7 |
  | unit: house / cam / lint | 7 / 5 / 64 |
  | e2e view3d (mock) | 46 |
  | e2e view3d-real (real r128) | 38, about 3.5 s |

  view3d-real covers:
  - the mock matching r128;
  - the view not being blank;
  - the pixel ratio and buffer size;
  - draw calls and meshes;
  - the colour pipeline within ±2;
  - the raw sky background;
  - context loss and restore;
  - no frames while hidden.
- `node tests/run-all.mjs --qa --only f4-t1` (QA's suite, no KNOWN match).
- Shots: `node tests/e2e/view3d-real.spec.mjs --shots` writes `docs/03-tasks/F4-T1/shots/` (4 exteriors at 1280x800, sand at 360x640). It is never part of run-all.
- By hand: Load sample → Skip to 3D (2 taps) → drag, pinch, wheel, click then arrows, Ground / First, Reset view.

## 5. TL rulings applied

| Ruling | Applied as |
|---|---|
| Q1 | Aspect-aware reset radius; `rMax = max(3R, 1.2 × reset)` |
| Q2 | On-demand rendering |
| Q3 | Disabled set: time, 4 presets, season, room, tour start / pause / stop, tour speeds, Roof. Level radios, Reset, the panel toggle and the tabs stay enabled |
| Q4 | `groundOuter` 0.05 m below |
| Q5 | Floor at `baseY + 0.2` |
| Q6 | No hall quad: the slab top face takes the hall colour |
| Q7 | Whitelist additions (Euler x/y/z, Vector2 x/y/set), `then` / `toJSON` reads, default-white exemption |
| Q8 | CatmullRom ported, including r128's shared `tmp` |
| Q9 | Stair / lift as 1.2 m boxes |
| Q10 | The F3 bundle goes in F4-T2 Step 0 |
| Q11 | PM round 9 labels |
| Required 2 | Refusal on `reachable && valid` |
| Required 3 | Building… yield with a token |
| Required 9 | `near = max(0.5, 0.02 r)` |
| CTO H1–H5 | Mock and conformance first; vendored r128 with the checked sha512; real-r128 e2e |
| Impl-review item 1 | Close and reopen inside the yield → 1 build, 1 render (test added; removing the token fails it) |
| Impl-review item 3 | `outerK` 36 |

## 6. QA bugs fixed

- **F4T1-1: two frames on returning to stage 5.**
  - Root cause, measured: the shell calls `enter` while stage 4's 49 px sample strip is still shown. `open()` measured a canvas 641 px tall; the strip then hid, and the ResizeObserver reported 690 px, a real size change, so a second frame was drawn.
  - Fix in `scene.js`:
    - `resize()` does nothing when the size and pixel ratio are unchanged;
    - `open()` on an unchanged house no longer measures; the frame measures the canvas itself before drawing (`resize(true)`, no new request).
  - Real browser: 1 rAF and 1 render on return.
  - Test (scene.test): the layout shift between `open` and the frame, then the observer → exactly 1 render at the settled size; an unchanged observer callback → no `setSize` and no frame; a real size change still draws.
  - Mutations: removing the same-size check, or removing the in-frame measure, each fails it.
- **F4T1-2: a mouse click did not focus the canvas.**
  - Fix: `camera.js` `down()` calls `canvas.focus({ preventScroll: true })` for mouse pointers only. Touch does not, so the on-screen keyboard stays closed.
  - Test (camera.test): mouse → focused with `preventScroll: true`; touch → not focused.
  - Mutation: removing the call fails it.
- Re-run `--qa --only f4-t1`: green, and both KNOWN entries match nothing. QA can remove them.

## 7. Measurements

- Real r128 on the sample:
  - 7 meshes and 7 draw calls;
  - pixel ratio 2 at dpr 3, with the drawing buffer = client width × 2;
  - the colour pipeline reads back every test hex within ±2;
  - the maximum house has 11 meshes.
- Five level options (maximum house) fit in one row at 360 px (the last ends at 352 px), so the PM fallback "All / B / G / 1 / 2" is not used.
- Full runs:
  - FS: 493.7 s;
  - TL: 482.3 s;
  - QA: 502.3 s and 509.1 s;
  - FS final, after the bug fixes: 486.9 s;
  - all exit 0.
- QA's f2-t2 / f2-t3 duplicates-only trim did not reach the 450 s target. QA measured `--jobs 3` at 366.9 s. The TL ruling on the runtime option is still open; `--jobs` stays 2.

## 8. Known limits / carried items

1. **TL item 2 → F4-T2:** the refusal's `reachable` half is not pinned by a test (the stage-2 conflict case is also refused by `valid`). Either add a state with fresh stage-3 plans but stage 1 or 2 invalid, or record that none is reachable.
2. **Shadows are faint at summer noon** (sun 72° high; about 0.6 % of pixels change). This is correct for the table. F4-T3's time slider shows them, and the Designer and the phone check judge them.
3. **The F3 follow-up bundle waits in F4-T2 Step 0** (TL Q10), reviewed separately:
   - PM decisions: low-fill hint < 50 %, unmet-pair fix text, one-step Undo, 1.5 m ft snap, sample strip only on stages 1 and 3;
   - CTO debt item 6;
   - the `applyEdit` stale-plan guard;
   - **CD-4:** rooms per floor 8 → 10, with the TL re-proving the generator at 10;
   - **CD-5:** a non-blocking "no hall access" warning.
4. **Wheel during Building…** (about one frame) is not `preventDefault`ed, because the controls are inactive. It is harmless: the stage does not scroll (TL note 5).
5. Furniture, roof, site objects (wall, gate, parking, pool, trees), time / season light and the tour are F4-T2 / F4-T3 / F5. Their controls are disabled now.
6. The empty-sky area at the widest, lowest pose is the true horizon. The far edge of the 36 R ground touches it only at a corner.
7. **Runtime:** see §7.

## 9. Sign-off

- QA: **PASSED** (10 + 163 checks), with F4T1-1 and F4T1-2 fixed as in §6.
- TL: implementation review and addendum APPROVED.
- Final FS full run after the bug fixes (`node build.mjs && node tests/run-all.mjs`): **exit 0 in 486.9 s**. It includes QA F4-T1 model 10/0 and view 163/0 with no KNOWN match, view3d 46/0 and view3d-real 38/0.
