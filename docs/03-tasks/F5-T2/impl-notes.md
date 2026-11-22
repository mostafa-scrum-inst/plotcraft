# F5-T2 implementation notes: drone tour (FS)

Date: 2026-11-22. Branch `f5t2` (worktree `/home/user/plotcraft-f5t2`), main merged in (QA F5-T2 suites, 7344339 /
8098afa). Plan: `plan.md` §1–§7 as amended in §8 (TL `plan-review.md`, PM round 13).

## 1. What was built

- **`core/const.js`:** `TOUR` (leg times 4 / 3.5 s, speeds 0.6 / 1 / 1.8, the room-stop eye offsets, `treeGap` 0.5,
  the soft-floor margins `floorSoft` 1 m and `phiSoft` 3°, `minGap` 0.5 m, the lead-in 1200 ms / 0.5 m).
- **`core/cam.js`:** `fromEyeLook(eye, look)` returns `{ target: look, radius, theta, phi }`; it round-trips with
  `PC.cam.position`.
- **`core/tourplan.js` (new, pure):** `PC.tourplan`
  - `eyeFloor()`: `(canopyY0 + canopyH) × scale[1] + treeGap`, read from `PC.data.vegetation` on every call (5.33 m
    today).
  - `roomStop(house, lv, r)`: the A-14 eye (outward `0.6 × max(w, d) + 2` m at `max(baseY, 0) + storeyH + 2.5`;
    basement 1.5 m inward at `storeyH + 4`; +Z when central), raised to the eye floor; look at floorY + 0.5.
  - `build(house, aspect)`: the overview from `PC.cam.reset`, levels by index (basement first), the nearest-neighbour
    walk (plan §8), the 0.5 m nudge, leg times. Returns `{ stops, duration, eyeFloor }`, or null with fewer than 2
    stops.
  - `target(plan, τ)`: the stop being approached (the first i with τ < tᵢ). `u(plan, τ)`: the curve parameter.
- **`three/scene.js`, driver (ruling Q6):** `step(dt)` returns `{ pose, done }` and the driver assigns the pose;
  `end(reason)` once with `done | input | close | reset | build | replaced | stop`; `paused` requests no frames and a
  paused animation is not stepped by a repaint; Resume's first dt is 0. `flyTo` migrated (F5-T1 tests unchanged).
  New API: `stopAnimation()` (`stop`), `pauseAnimation(on)`, `animation()`.
- **`three/tour.js` (new):** `PC.three.tour = { start(o), pause, resume, stop, setSpeed, speed, running, state,
  debugSeek }`. `state()` gives `{ running, paused, speed, tau, duration, stop, lead, plan }`. Start clears the
  selection, sets the Roof off, builds the plan for the canvas aspect and runs one driver animation. Per leg it sets
  the level, the highlight and calls `onStop` (caption). End clears the highlight (except `replaced`, `build`,
  `close`, where the finder or the scene owns it) and calls `onEnd(reason)` once. It never calls `setLook`.
- **`ui/stage-3d.js`:** Start / Pause (`aria-pressed`, `aria-label` "Pause tour" / "Resume tour", mirrored on the
  caption's pause) / Stop and the speed radios are live. The caption shows "Overview" or "Room · Level" and its
  pause / stop buttons during a tour. Level radio, Reset view, Roof on and a finder pick end the tour, then apply;
  the Light tab and speed do not. End: select "Go to room…", caption cleared, level / Roof / camera kept (Q12).
  Leaving stage 5 ends it; there is no restart on return; the speed is kept (session state, not in the draft).
  `PC.debug.tourSeek(τ)` is defined here only.

## 2. Deviations from the plan, with reasons (for the TL / QA)

1. **Curves in pose space, uniform Catmull-Rom.** The plan had two centripetal curves (eyes, looks). Run at 60 fps
   in the three tests they failed the smoothness bounds:
   - centripetal parameterisation with time-linear `getPoint` gave speed jumps of about ×3 at stops between legs of
     very different chord length;
   - after the steep overview leg into the basement the eye curve passed nearly over the look curve: φ hit the 5°
     clamp and θ spun fast round the vertical.

   As built: one `CatmullRomCurve3(looks, false, 'catmullrom')` and one over the stops' orbit poses as
   `Vector3(θ unwrapped along the tour, φ, radius)`. Both pass through every stop at `u = i / (n − 1)` (ruling Q1
   holds: stop i exactly at tᵢ); the pose between stops turns smoothly round the look point.
2. **Soft floors instead of a hard clamp mid-path.** `soft(x, lo, m) = lo + m·e^((x − lo)/m − 1)` below `lo + m`
   (value and slope continuous), applied to the radius (rMin, m 1 m), φ (phiMin, m 3°) and the eye height (the eye
   floor, m 1 m; applied by lengthening the radius along the line of sight, so θ and φ are unchanged). Then
   `PC.cam.clamp` runs every frame (Q7), but it no longer bites mid-path, so there is no kink in speed. At a stop
   whose eye is within 1 m of the eye floor (low-ceiling ground rooms lifted to 5.33 m), the rendered eye is lifted
   up to about 0.37 m above the plan's eye; the look point and the stop time are exact. Stops never touch the hard
   clamp (unit test, required item 3).
3. **Eased end legs.** `u` is linear inside middle legs. The first leg eases in from rest (`w = 2x² − x³`) and the
   last eases out to rest (`w = x + x² − x³`); both have slope 1 at the join, so there is no speed step. With one
   room (2 legs) both use smoothstep.
4. **Lead-in.** When the camera is more than 0.5 m (eye or target) from the overview pose at Start (e.g. after a
   finder pick or an orbit), a 1.2 s smoothstep flight to the overview comes first so Start never cuts. τ stays 0
   during it, `state().lead` is true, and the caption reads "Overview".

## 3. For QA (hooks and differences from the F5-T2 suites)

- **Hooks, as QA expects:** `PC.tourplan`, `PC.three.tour`, `PC.cam.fromEyeLook`; `state().tau` (s, normal-speed
  tour time); `PC.debug.tourSeek(τ)`; Pause with `aria-pressed` and `aria-label` "Pause tour" / "Resume tour" on
  `v3-tour-pause` and on `v3-caption-pause`. Stop times 53.5 / 144.5 / 8 s match. The walk anchor is
  `look / 2d` (plan §8); `f5-t2-model` passes 6 / 6 and picks that reading.
- **`run-f5-t2` on this branch:** model 6 / 6; view 6 passed, 4 failed. The 4 are oracle or timing differences, not
  product faults as far as I can tell:
  - *A "on my centripetal Catmull-Rom curve … to 1 mm":* the oracle is the plan's centripetal eye / look curves;
    the build uses the pose-space curves of §2.1, and the first 1.2 s are the lead-in (§2.4), off any tour curve.
    The oracle needs the §2 curve, soft floors and lead-in, or a looser check (eye floor, no jump, stops at tᵢ).
  - *A "seeking to legs … caption / highlight":* QA seeks to `tᵢ − 0.3 s` and then reads after `frame2 + settle`.
    On real r128 in this container a 1280×800 frame takes about 117 ms, so with the 100 ms dt cap τ moves about
    0.5 s before the read and is already on the next leg; the caption and highlight shown are then correct for that
    τ. Reproduced: seek 7.2 → read τ 7.77, stop 3. Suggest pausing before the seek (Resume's first frame is dt 0 and
    shows exactly the sought τ; `view3d-real` does this) or seeking further from tᵢ.
  - *A "Pause by tap … paused: aria-pressed false" and "a Light preset ended the tour":* knock-on of the previous
    point. The last-leg seek (`duration − 0.3`) plus the 450 ms wait finishes the tour, so the later `seek(6)` has
    no tour to seek and Pause is disabled. In the mock e2e and three tests a Light preset keeps the tour running.
  - *A "Stop: the view jumped 1.06 m":* QA compares the pose read before the click with the pose after it. The tour
    keeps moving during the click's latency (several slow frames at about 3 m/s chord speed). Stop itself leaves
    the pose untouched (three test: the pose is identical before and after `stop()`).
  - B (maximum house, basement stops with highlight pixels) and C (phone G1 4 taps, caption controls) pass.

## 4. Tests

- **Unit `tests/unit/tourplan.test.mjs` (10):** eye floor from the table, with a table change; stop kinds and order,
  each room once, deterministic; the nearest-neighbour walk from the previous look (Reset target after an
  overview); A-14 eye / look per room; leg times 53.5 / 144.5 / 8 s and the 0.5 m gap; the nudge; `fromEyeLook`
  round-trip; the clamp does not bite at any stop (5 houses × 2 aspects); `u` / `target`; the `tourSeek` /
  `debugSeek` grep.
- **Three `tests/three/tour.test.mjs` (8):** the whole tour at 60 fps on the sample, maximum house, one room and a
  basement house (eye floor, coverage with the level on top and the ground cap hidden for B, stop sequence, step ≤
  3 × the neighbouring legs' mean speed × dt, step change ≤ 25 % + 0.02 m, turn cos > 0.5, ends on All, idle);
  budget ≤ 22 meshes and 40 highlights each disposed once; Pause (pose and τ frozen, no frames requested, a repaint
  does not step), Resume dt 0, Fast ×1.8 with no jump; the driver's `end(reason)` exactly once on every cancel path
  with a plain animation; Stop and gestures (also while paused); close / Reset / rebuild / finder pick reasons and
  the lead-in; the look untouched; the dt cap, `debugSeek`, Roof forced off.
- **E2E mock, `tests/helpers/tour-checks.mjs`** inside `view3d.spec`'s existing loads (about 2 s of tour time per
  viewport):
  - phone: G1 = 4 taps; Start / Pause / Stop and caption pause / stop ≥ 44 px; Start → Roof off, caption, caption
    buttons; caption pause / resume with `aria-pressed` and labels on both buttons; a seek across G → 1 keeps it
    running (required item 4); the last leg shows "Overview", All, no highlight; caption Stop ends it with level
    kept and caption, highlight and select cleared.
  - desktop: Start by Enter, Pause / Resume by Space, Fast, a Light preset keeps it running, a canvas drag ends it,
    leaving stage 5 ends it with no restart and Fast kept.
  - `g1Draft` in `fiveLevels()`: a reload offers the saved draft; Load sample + confirm + Skip + Tour tab + Start =
    5 taps on a phone.
- **Real r128 `view3d-real` `basement()` (required item 5):** the tour on the maximum house, paused at 0.3 s before
  the first and the last of its 10 basement stops (all 10 passed during development; trimmed to 2 for run time): the room is highlighted, level B shown, the first visible hit on the eye →
  highlight ray is the highlight or level B, and the highlight draws ≥ 40 orange pixels.
- **Mutations (each killed unless stated):**
  - eye floor as a literal 5.33 (table test);
  - basement eye over the look, and `bEyeIn` 0.3 (the clamp-at-stop test and the eye test);
  - walk anchor the eye instead of the look;
  - `target` = the stop just passed;
  - the driver calling `end()` twice (plain-animation test);
  - a paused animation stepped by a repaint;
  - Resume keeping the paused gap as dt;
  - speed ignored;
  - a hard eye floor instead of the soft one (smoothness);
  - Roof not forced off;
  - highlight kept at the end;
  - the tour's level sync dispatching `change` (required item 4: the tour ends; several e2e checks fail);
  - caption kept after Stop;
  - the Pause label not toggled;
  - a Light preset ending the tour.
  - Survived, and equivalent: removing `tour.js`'s own `ended` guard. The driver already calls `end` once; the guard
    is defensive.
  - From the plan's list and not run separately: `getPointAt` (covered by the `u` / stop-time tests), levels in plan
    order and no nearest-neighbour ordering (covered by the order tests), and a restart on re-entering stage 5 (e2e).

## 5. Full run

`node build.mjs && node tests/run-all.mjs --jobs 3` on 0d303e5, with main 8098afa merged (QA's F5-T2 suites):

**458.2 s, FAILED.** That is over the 420 s target and under the 600 s hard limit. (A first run before trimming the
real-r128 basement check to 2 stops took 458.8 s.)

- **The only failure** is `qa run-f5-t2`, the 4 section-A view checks of §3. Everything else passed: build, lint,
  unit (32 files), three (12 files), all e2e files, and every other QA suite, including the tour-gated F4-T1 / F4-T3 /
  F5-T1 views.
- **The time.**
  - QA's new `run-f5-t2` takes 47.4 s, and it accounts for the overrun against the 413 s baseline.
  - My browser additions come to about 3 s:
    - `view3d.spec` 8.5 s, with no new page loads except the one reload for the G1 draft path;
    - `view3d-real` 12.7 s alone (18.8 s under `--jobs 3`), against 11.2 s alone on main.
- **Slowest files:** qa f1-t3 101.7 s, f2-t3 100.6 s, f1-t1 98.7 s, f2-t2 95.3 s, f4-t2-step0 83.4 s.
- **Getting back under 420 s** needs a trim in QA's suites. Per A-16 that is QA's call; I did not change `tests/qa`.
  The QA shot and metrics files that a run rewrites were restored, not committed.
