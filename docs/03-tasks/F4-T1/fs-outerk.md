# F4-T1 — FS: outer ground size (TL impl review, FS item 3)

Status: done before the publish. The Designer judges the look from the shots.

## Change
`src/js/core/const.js`: `HOUSE.outerK` goes from 8 to **36**. `groundOuter` is now a 36 R square (half side 18 R) around the plot centre, at Y −0.05.
No other code changed: `build-shell.js` already sizes the plane as `outerK × R`.

## Fit checks
- **Camera far plane** (`far = CAM.farK × R = 20 R`). The plane's edge at 18 R lies just inside the far plane.
  - At the reset pose the top ray of the view meets the ground well inside the plane on both viewports, so the ground fills the view to the top corners.
  - On the phone (360x640, where the reset radius is about 4.6 R), that ray is about 10 R long.
  - The rays that reach the far plane are the ones near the horizon, so the background shows only above the horizon.
  - Worst pose: fully zoomed out at the lowest angle (φ 85°, r ≈ 3.3 R, sample R = 18 m, far 361 m). The 1280x800 probe shows a clean horizon, with sky above and neutral ground below. The plane's far corner just touches the horizon on the left, and no wedge appears.
- **Fog:** there is none in F4-T1, so nothing to check.
- **Shadow camera:** sized from the footprint, `min(2.5 × footprint diagonal / 2, 1.2 R)`, so the ground size does not change it. The outer ground receives shadow only within that box, as before.
- **Depth:** near and far are unchanged (`near = max(0.5, 0.02 R)`). Ground layers are 0.05 m and 0.01 m apart close to the house, and no z-fighting is visible in the shots.
- **G6 budgets:** still one mesh and one draw call. view3d-real is 38/0 in about 3.5 s (draw calls ≤ 80, meshes ≤ 40, pixel ratio ≤ 2, not blank, colour pipeline, sky = raw background, context loss and restore, hidden).

## Shots (re-shot: `node tests/e2e/view3d-real.spec.mjs --shots`)
`shots/1280x800-{sand,white,terracotta,grey}-noon.png` and `shots/360x640-sand-noon.png`.
- I checked by eye and by pixel. The top corners of the canvas are now the lit neutral ground (178,176,164 on both viewports) instead of the noon sky `#8EC3EA`. There is no table edge, and the house and plot read as before.

## Also (TL impl review, FS item 1: trivial, done)
- New test in `tests/three/scene.test.mjs`: close() then open() with the same house inside the Building… yield gives exactly one build and one render.
- Removing the token check (`S.building !== token`) now fails it. I checked this with a temporary edit and reverted it.
- Item 2 (pinning the `reachable` half of the refusal) stays for F4-T2.

## Runs (focused only; QA is testing in parallel)
`node tests/run-all.mjs --unit --three --e2e --only view3d,contract`: all green in 20.4 s. view3d-real (with `--shots`) 38/0, and scene.test 15/0.
