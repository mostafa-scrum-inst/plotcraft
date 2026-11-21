# F4-T1 QA report (step 3e)

Date: 2026-11-21. Author: QA. Brief: the 8-item QA focus list in `impl-review.md` and its addendum (Designer disabled
styles, FS `outerK` 36), plus the orchestrator's extra point (the generic disabled icon-button style on stage 2).
Tested at commit `e0fd473` plus my test changes.

## Summary

- **Verdict: PASSED, with two minor bugs (KNOWN) and one open runtime point for the TL.**
- New suite: `tests/qa/f4-t1-model.mjs` (node, 10 checks over 160 + 20 houses), `tests/qa/f4-t1-view.mjs` (browser, 163
  checks), oracle `tests/qa/f4-t1-ref.mjs`, runner `tests/qa/run-f4-t1.mjs` (about 52 s in the full run).
- My expectations are my own:
  - frames W → L → T from A-5 (my `toL` from F2, my bounding-box centre, `X = u − cu`, `Z = −(v − cv)`);
  - the A-8 stair/lift core;
  - storeys from A-9 (pitch = Q8 + 0.2);
  - colours from the A-10 sRGB mix plus my own sRGB → linear conversion;
  - camera limits, reset radius and a perspective projection from A-12.
- Inputs I take as given: the state, `PC.site.analyse` footprint (QA'd in F2) and the Designer's tables. I use no FS or
  Designer helper for an expectation.
- **Real r128**:
  - `openPage(..., { three: 'real' })` (`tests/qa/lib.mjs`) answers the cdnjs URL with `tests/vendor/three-r128.min.js`,
    which is byte-identical to the cdnjs file. The page stays offline.
  - `THREE.*` warnings are now problems in `cleanLog`. There were none.
  - The node suite runs `PC.three.buildShell` on the same vendored r128 in a vm. There is no renderer, so 180 houses
    take 2.4 s.
- **Mandatory full run** (`node build.mjs && node tests/run-all.mjs`): **exit 0 in 509.1 s.**
  - That is over the 450 s target; see section 8.
  - An earlier run in this round (502.3 s) failed once in `f3-t3-draftui` F. That was a test race under load, fixed below.

## 1. Acceptance map (plan §11), mock and real

| Criterion | Where proven (QA) | Result |
|---|---|---|
| Plot at the drawn shape | model 1b: `groundPlot` contains every plot corner in T, its triangle area = plot − footprint, no triangle outside the plot or inside the footprint; view A (real, 1280x800 and 360x640) the same on the live scene | pass |
| Building at the footprint position | slab box per level = footprint in T (my `l2t`); `groundCap` = footprint at 0.01 m | pass |
| One storey per level at Q8 + 0.2 | model 1a/1b: `baseY = index × (Q8 + 0.2)`, slab bottom at baseY, floor at baseY + 0.2, nothing above the 1.2 m walls; Q8 2.4 and 4.5 | pass |
| Rooms = approved plans, after an edit + approve, m and ft | one tint quad per plan room at its T rectangle (exact) in every state; model 4a and view A: smallest First-floor room shrunk 0.5 m, edited + approved → model and scene show it; header ft toggle: same key, same geometry, no rebuild and no frame | pass |
| Opens on All with the Roof off | view A real + mock: All checked, scene level `all`, roof off (switch and scene) | pass |
| Level selector matrix, Basement opening | Basement + 3 floors + lift, real input on each option: level k visible iff k ≤ selected, Basement hides `groundCap` and the levels above, roof group hidden, exactly one frame per change (real 1280x800 and 360x640, mock 360x640 scene graph) | pass |
| Stair / lift on every level | one stair box and one lift box per level at my A-8 core, floor to wall top; none on a single floor; one floor + usable roof has a stair | pass |
| Four Q10 exteriors | model 3a: 4 exteriors × 3 interior styles, walls / slab / tints in my colours, no wall in another exterior's colour; view A: each change while open = one rebuild with the pose kept, and four different pictures | pass |
| Tints per room type | model 3b: a house with all 10 types shows 10 distinct tints, each = linear(mix(roomTints[type], wood, floorMix)) | pass |
| Entrance, dollhouse | ground front wall has the 1.2 m door gap; no geometry above 1.2 m walls; basement pit walls in the slab colour up to Y 0 | pass |
| Refusal | null for an unapproved level, a stale plan (room added, not synced), an open plot; key deterministic and changes with Q10 | pass |

## 2. Q14 in 3D (own oracle)

- **Model, 160 states:**
  - plots: sample (deep footprint), 40 × 22 (wide), the sample rotated 0.5 rad (slanted street), and the sample with
    its street on edge 1;
  - fl / fr / bl / br / centre, lift on and off, 2 floors or basement + 3 floors, Q8 2.4 and 4.5.
- **What I check:** I find the stair and lift boxes **in the real r128 geometry, by their vertex colour**. Seen from the
  street (the +Z side, facing −Z), the stair + lift block is:

  | Position | X | Z |
  |---|---|---|
  | `fl` | min | max |
  | `fr` | max | max |
  | `bl` | min | min |
  | `br` | max | min |

  `centre` is centred within the 0.5 m snap. This holds on every level, and every box equals my A-8 core through my own
  `l2t`.
- **All 10 position × aspect cases are covered.**
- **In the built page (real r128, 1280x800):** the same check on the live scene for all five positions with the lift on.
- Result: pass.

## 3. Gestures

The gestures run on `three: 'mock'`. The pose does not depend on the renderer, and the mock keeps the run short.

**Touch at 360x640 and 640x360** (CDP touch, only on the part of the canvas the panel does not cover):
- One finger: a horizontal drag changes only theta, and the near side of the model follows the finger. A vertical drag
  changes only phi.
- Pinch out × 2 → radius / 2, and pinch in → × 2, both within 5 %. The target stays fixed.
- Two-finger pan: the ground point under the fingers moves 40–60 px for a 50 px pan, with no zoom or orbit.
- Lifting one of two fingers changes nothing. The next 3 px move is a 3 px orbit, so there is no jump.

**Mouse at 1280x800:**
- Drag orbits.
- Right-drag and Shift+drag pan, and the content follows the pointer.
- The context menu is suppressed.
- Wheel down zooms out and wheel up zooms in, without scrolling the page.
- On the focused canvas, the arrow keys orbit exactly 5° each way, `+` divides the radius by exactly 1.1 and `-`
  multiplies it by exactly 1.1.

**Clamps, scrolling, Reset:**
- I ran 20 random gestures per viewport: drags, pinches, pans, wheels of up to ±1200, and key bursts. After every one:
  - phi stays within 5–85°;
  - the eye is at 1 m or higher;
  - the radius stays within 4 m and my rMax;
  - the target stays inside my plot box, between 0 and the roof base.
- After all gestures: `scrollY` 0 and `visualViewport.scale` 1.
- First open, and Reset after the random run, give exactly my reset pose:
  - target at the plot centre, theta 30°, phi 50°, radius = my aspect-aware radius;
  - every plot corner and the footprint at the roof base project inside the view at all three viewports;
  - the plot fills at least 60 % of the half-view.
- Stage 5 passes the F1-T1 layout rules after the gestures.

Result: pass, except bug F4T1-2 below.

## 4. Loop (real r128, rAF counted by an init-script wrapper)

- **Idle:** with the view open, 600 ms show 0 rAF and 0 renders.
- **Back to stage 4:** the view is inactive, with 0 rAF and 0 renders.
- **Return:** no rebuild (same key) and the pose is kept. It draws **2** frames, not one. That is bug F4T1-1.
- **Hidden:** override `visibilityState` and fire the event. A wheel input then changes the pose but requests no frame
  (0 rAF, 0 renders). Visible again → exactly one frame.
- **Q10 changed through stage 2:** real taps on step 2, Building, Terracotta, step 5. Result: one rebuild, pose kept,
  walls terracotta (full geometry oracle), then 0 rAF and 0 renders while idle.
- Result: pass, except F4T1-1.

## 5. 3D unavailable

I tested three causes:
1. three.js aborted;
2. the mock's `failRenderer`;
3. real r128 with `getContext('webgl*')` returning null.

For all three:
- The message is shown in view, and the canvas, panel and "Building…" are hidden.
- The text says the 3D view is unavailable and that the earlier stages still work.
- The F1-T1 layout rules pass on stage 5.
- Back works, and the stepper reaches stages 3, 2 and 1.
- A stage-2 answer (Q10 grey) can still be changed.
- Step 5 shows the message again.
- There are no console errors, dialogs or other requests.

Note: with real r128 and no WebGL, **r128 itself** logs `THREE.WebGLRenderer: Error creating WebGL context.` as a
`console.error` before it throws. The app catches the throw correctly. I accept this as a library message, and the suite
prints it as a note. Result: pass.

## 6. G6 on the maximum house (real r128, 360x640, dpr 3)

- House: Basement + 3 floors + lift, 8 rooms each (32 rooms).
- Geometry = my oracle.
- **11 meshes** (≤ 40); every mesh is tracked for disposal.
- One shadow-casting light: the sun (`DirectionalLight`, map 1024 × 1024).
- Pixel ratio 2 at dpr 3, so the backing store is 2× the CSS size. At dpr 1 the ratio is 1.
- Result: pass.

## 7. Disabled controls, level labels, stage-2 icons (360x640, after the Designer's fix)

**Disabled set:**
- These are all disabled: time, the 4 presets, season, room finder, tour start / pause / stop, the 3 speed radios, and
  Roof.
- Reset, the panel toggle and the tabs are live.

**Computed styles (TL condition 1):**
- slider `cursor: not-allowed`;
- `v3-time-out` colour = `--ink-3`;
- Season and Go-to-room selects: background `--sunk`, colour `--ink-3`, cursor `not-allowed`;
- preset, tour-pause and tour-stop icons at opacity ≤ 0.5.

**Slider thumb (a pseudo-element, checked by pixels):**
- Enabled for the test, the slider shows more than 50 accent-blue pixels.
- Disabled, it shows fewer than 5.

**Look and behaviour:**
- Each disabled control renders differently from itself when enabled: presets, season, room finder, tour start / pause,
  speed radios and Roof.
- Tapping the disabled slider and the Night preset changes nothing (12, "12:00").
- The F1-T1 layout rules pass on the View, Light and Tour tabs.
- The shots read as greyed out on purpose.

**Level labels with 5 options:**
- Labels All / Basement / Ground / First / Second, with full aria-labels ("Ground floor" and so on).
- Each label is on one line, not truncated, and inside the viewport.
- The F1-T1 layout rules pass.

**Stage-2 icons (orchestrator point):**
- The setback and north steppers are **never disabled**. At a limit they clamp: with front 0 and back 20, every stepper
  is enabled and its icon is at opacity 1. Minus at 0 stores nothing.
- No `.pc-btn--icon` outside stage 5 is disabled anywhere in the app today. Of the `.disabled =` writers in `src/js/ui`,
  only stage 5 touches icon buttons.
- So the generic `.pc-btn--icon:disabled` rule reaches only the stage-5 controls today.
- I took one shot of a stepper forced to disabled (`g-stage2-stepper-forced-disabled`). It reads as muted and still
  legible, so the rule would look right if it is ever used there.
- Nothing to flag.

Result: pass.

## 8. f2-t2 / f2-t3 trim and runtime

**Rule** (as in `F3-T3/qa-trim.md`): remove only a duplicate of a twin at the same viewport with the same input, with
an A-16 comment naming the twin.

| File | Removed | Twin that remains |
|---|---|---|
| `f2-t3-site-rooms.mjs` M | Room-row "names and areas not cut off" block (m and ft, 4 viewports). | `e2e/rooms-fit.spec.mjs`: same 4 viewports + 360x740, m and ft, same content, stricter checks. |
| `f2-t3-site-rooms.mjs` G | 640x360. | `e2e/rooms.spec.mjs` `addAndEdit` at 640x360 (twin named by the F3-T3 trim). |
| `f2-t3-site-rooms.mjs` K | 640x360. | `e2e/rooms.spec.mjs` `stairsAndLevels` at 640x360. |
| `f2-t2-questions.mjs` F | 768x1024. | `e2e/questions.spec.mjs` `defaultsAndGroups` + `gateAndRiders` at 768x1024. |
| `f2-t2-questions.mjs` G | Site and Rooms groups of the sample in m (4 viewports). | f2-t3 M "sample street mode (m)" and "rooms sample": same sample, same S.layout rules, same viewports. |
| `f4-t1-view.mjs` (mine) | Random gesture run 40 → 20 per viewport. | Not a trim of coverage; every gesture kind is still in the run. |

**Mutation proofs:** throwaway copies, `src/` untouched.

| Mutation | Check run | Result |
|---|---|---|
| Room area cell 30 px with overflow hidden | `rooms-fit.spec` | caught |
| Add form ignores the count | `rooms.spec` | caught at 640x360 (count 3, group counts, 9th room) |
| Level-removal text "has" → "holds" | `rooms.spec` | caught at 360x640 and 640x360 |
| Progress text always "question" | `questions.spec` | caught at 768x1024 |
| Add room button 30 px high | f2-t3 M | caught: "rooms empty / sample / full level", every viewport |
| North Reset 30 px high | f2-t3 M | caught: "sample street mode", m and ft |

**Runtime:**
- f2-t2: 94.8 → 87.7 s uncontended. f2-t3: about 103 → 90.9 s.
- f4-t1 adds 52 s.
- **Full run 509.1 s (exit 0)**: still over the 450 s target. Runs vary by about ±10 s; the previous one was 502.3 s.
- **The target cannot be met with duplicates only.** I compared every f2-t2 / f2-t3 section with the e2e specs and the
  other QA files, and these are all the twins I found. Without the trim and my 20-op cut the run would be about 525 s.
- The remaining sections have no same-viewport twin, for example f2-t2 A/B/C/K and f2-t3 B/D, which test with QA's
  own oracle at 360x640 / 640x360 / 1280x800.
- **Needed from the TL — a ruling on one of these:**
  1. `--jobs 3` (this machine has 4 cores; measured below);
  2. allow QA to drop a **second touch viewport** (640x360) in sections where 360x640 touch and an e2e spec at 640x360
     already cover the input, about 25 s of browser time;
  3. accept about 510 s until F4-T2.
- **Measured with `--jobs 3`:** exit 0 in **366.9 s**, all green, no flakes. That is the same tree right after the 509.1 s `--jobs 2` run.

## Bugs

| Id | Severity | What | Repro / evidence | Suggested fix |
|---|---|---|---|---|
| **F4T1-1** | minor (one wasted frame) | Returning to stage 5 from stage 4 draws **two** identical frames, not one (TL focus 4: "one frame after returning"). `open()` → `resize()` → `invalidate()` draws one; then the canvas parent becomes visible and the ResizeObserver callback runs `resize()` → `invalidate()` and draws a second. | f4-t1-view D: `renders +2, builds 1 -> 1`, pose identical. Probe: with `ResizeObserver` removed, exactly 1. | In `scene.js` `resize()`, call `invalidate()` only when the size or pixel ratio really changed, or skip it while a frame is pending (dirty and frame set). |
| **F4T1-2** | minor (keyboard after mouse) | A mouse click on the model does not focus the canvas, so arrow keys and `+` / `-` do nothing until the canvas is reached by Tab. `pointerdown` calls `preventDefault()`, which also cancels the focus default action. A-12: "keys on the focused canvas". | f4-t1-view C 1280x800: after a click, `document.activeElement` is not `v3-canvas`. With `canvas.focus()` the keys work exactly. | In `three/camera.js` `down()`, call `canvas.focus({ preventScroll: true })` for mouse pointers. |

Both are marked KNOWN in `f4-t1-view.mjs` (`R.known`), so they are listed and do not fail the run.

## Test fixes in this round (QA files)

- **`f3-t3-draftui.mjs` F (forged drafts / side key), flaky under full-run load.**
  - Cause: the draft and side keys were handed from one page to the next across a reload. Chrome shares `localStorage`
    between renderer processes asynchronously, so a new page sometimes read an older side key. In one run the next page
    read the side key of the case before last.
  - Fix: every case now runs in a fresh context whose two keys are seeded by an init script before the app's scripts
    run. No page depends on a key written by an earlier page.
  - Stability: 16 of 16 runs green under an 8× parallel load.
  - Mutations still caught: no side copy (3 failed), rejected draft not removed (3 failed).
  - `openPage` `init` entries may now be `[fn, arg]`.
- **`lib.mjs`:** adds `three: 'real'`, `log.threeWarnings`, and a `cleanLog` that includes three.js warnings.

## Mutations of the new suite (throwaway copies, all caught)

**Model suite:**
- `build-shell.js`:
  - Z sign flipped (Q14 front/back): 7 failed;
  - tint mix weight 0: 6;
  - stair only on the ground floor: 6;
  - entrance gap removed: 6;
  - footprint hole removed: 6;
  - lift drawn in the stair colour: 2.
- `layout.js`: core left/right swapped: 4.
- `house.js`:
  - pitch without the slab: 7;
  - refusal ignores `valid`: 1.

**View suite:**
- `scene.js`:
  - level visibility "only the selected level": A 3 failed;
  - `groundCap` never hidden: A 3;
  - frames requested while hidden: D 1;
  - renderer creation not caught: E 2;
  - pixel ratio not capped: F 1.
- `cam.js`:
  - eye-height clamp removed: C 3;
  - pan sign flipped: C 3.
- `stage-3d.js`:
  - later controls not disabled: G 3;
  - re-open on every store commit: A 1, after I added "no frame on the unit toggle". The first version of the check
    missed it.
- `30-components.css`: disabled select rule removed: G 1.

## Shots

`tests/qa/shots/f4-t1/` (not written with `--no-shots`):
- `a-sample` (1280x800, 360x640);
- `b-q14-fl`;
- `f-max-dpr3`;
- `g-view-5levels`;
- `g-light-disabled`;
- `g-tour-disabled`;
- `g-stage2-steppers-limit`;
- `g-stage2-stepper-forced-disabled`.

VERDICT: PASSED
