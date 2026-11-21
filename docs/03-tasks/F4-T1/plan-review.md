# F4-T1 plan review (TL, step 3b) — round 1, 2026-11-21

Reviewed: `docs/03-tasks/F4-T1/plan.md` (FS, 2026-11-21). Read against `00-brief.md` hard constraints, `client-decisions.md` (nothing 3D-specific), F4-S1 / F4-S2 / F1-S5 / G1 / G6 and round 8 of `goals-and-stories.md`, `F4-plan.md` (F4-T1 section + both riders), architecture A-2, A-4, A-7, A-8, A-9, A-10, A-11, A-12, A-13, A-15, A-16, `04-feature-reviews/F3.md` (PM decisions, F3 follow-up bundle, CTO H1–H6, debt 6 and 7).
Code opened to check the plan's claims: `src/index.html` stage-5 markup + `tpl-v3-level`, `src/css/44-stage-3d.css`, `core/stages.js` (MAX_BUILT 5, `status`), `core/layout.js` `core()` (P rects `{x, y, w, h}`, `pos[1] === 'l'` → x 0, `pos[0] === 'f'` → y 0), `core/frames.js` (`l2t` = `[u − cu, h, −(v − cv)]`, `northL`), `core/signature.js` `level`, `core/levels.js` (`stairsExist`, `liftExists`, `name`), `core/const.js` `LEVEL_LABEL`, `core/plans.js` room shape, `site-outdoor.js` parking/pool shape, `tests/helpers/browser.mjs`, `tests/run-all.mjs` (`--three` step already wired, "no tests yet"), and the QA / e2e files that assert stage 5 (list in "For QA").

## Summary

A strong plan. Mock first, real r128 vendored with the CTO's tarball integrity, a pure house model that reads only approved plans + `PC.layout.core`, an on-demand loop that trivially meets "no frames while hidden / idle", an acceptance map that covers every F4-T1 criterion, and 16 named mutations. The P → L → T chain checks out against the code: `core()` puts `fl` at x 0 / y 0, `l2t` maps low u to min X and low v to max Z, so the planned Q14 test (`fl` → min-X / max-Z, `br` → max-X / min-Z) pins the H3 convention exactly. The sun formula with `n = (sin N, 0, −cos N)` agrees with `northL` (clockwise from +v, +v = −Z in T). Mesh counts (sample 7, F4-T1 maximum 11) and the r128 constants (sRGBEncoding 3001, PCFSoftShadowMap 2, DoubleSide 2) are right.

No re-plan round is needed: the rulings below are each fully specified and small. They are binding on the implementation and are checked at the implementation review.

## CTO H1 (mock + allowed-API list before scene code): ruling

**H1 is met by this review: the whitelist in plan §1.2 and the mock mechanism in §1.1 are APPROVED**, with the two additions and the strictness rules as ruled in Q7 below. Order is binding:
- Work-order steps 1–2 (mock, `load3d.mjs`, `mock.test.mjs`, vendored r128, the real-spec conformance check) land and are green **before** any file under `src/js/three/` or `core/house.js` / `cam.js` is written. FS appends one status line when the conformance check passes (every whitelisted member `in` a real r128 instance; maths equal). No separate TL loop for that checkpoint; I read the mock code itself at the implementation review.
- H2 met (tarball sha512 = CTO value; exact-URL routing; `src/` / `dist/` keep the one cdnjs tag; licence-string lint). H3 met (with ruling 1 below). H4 met (lights and colours read the tables as they are; no table edits). H5 met (batch 8). H6 is the orchestrator's: publish right after F4-T1.

## Rulings on the 11 FS questions

1. **Reset view radius: aspect-aware — yes.** `radius = max(2.2 R, 1.05 R / sin(min(halfFovV, halfFovH)))`, `rMax = max(3 R, 1.2 × reset radius)`, target (0, 0, 0) in T, theta 30°, phi 50° unchanged. The bounding-sphere fit is conservative for a flat plot seen at 50°, which is what "frames the whole plot" needs on a portrait phone. The aspect is the canvas's (the `setSize` values), not the viewport's. Reset is recomputed only on Reset, on first open and when the plot changes; a rotation re-clamps the kept pose against the new `rMax`. A-12 updated.
2. **Render loop: on-demand — yes.** One frame per `invalidate()`, requested only when active ∧ visible ∧ not lost ∧ none pending; zero frames while idle. F5 flights call `invalidate()` per frame. A-10 updated.
3. **Not-yet-built controls: `disabled` — yes, including the Roof switch.** Disabled in F4-T1: `v3-time`, the four `v3-preset-*`, `v3-season`, `v3-room`, `v3-tour-start`, the `v3-tour-speed` radios (pause/stop already disabled), `v3-roof`. Enabled: level radios, Reset view, panel toggle, the three tabs (tab switching is built). Set by the controller (property), no markup or contract change. `view3d.spec` asserts the disabled set at 360x640 so F4-T2 (roof) and F4-T3 / F5 flip it deliberately. No new UI text (no PM loop); the phone-check guide says "Light, Tour and Roof arrive in later builds" (orchestrator). The roof state logic stays wired and mock-tested.
4. **`groundOuter` offset: 0.05 m below `groundPlot`.** The scene-graph line "(-0.02)" in A-10 was the stale number; fixed in A-10.
5. **Floor convention: confirmed.** Storey k occupies `[baseY, baseY + pitch]`; slab is the bottom 0.2 m; `floorY = baseY + 0.2`; the next slab's underside is at `floorY + storeyH` (Q8). Ground floor stands on a 0.2 m plinth; basement floor at `−pitch + 0.2`, its ceiling = the ground slab's underside at Y 0; `roof.baseY = (top index + 1) × pitch`. Written into A-9.
6. **Hall tint: no separate hall quad — the slab box's top face carries the hall colour.** `BoxBatch.add` gains an optional 8th argument `topHex` (top-face vertex colours; the other five faces use `hex`): slab = `add(…, E.slab, mix(RT.hall, I.wood, I.floorMix))`. Room tint quads stay at `floorY + 0.015` (A-10). Reason (correctness): a second coplanar layer at +0.008 halves the depth margin. With a fixed near of 0.5 and a 24-bit depth buffer the depth step at distance d is about d² / (near × 2²⁴): about 5 mm at 200 m and about 11 mm at 300 m (rMax on a 100 x 100 m plot with the aspect-aware reset of Q1 can reach ~4.2 R ≈ 300 m), so 8 mm would shimmer and even 15 mm would be marginal. Hence also required item 9 (near plane follows the orbit radius). It also saves 4 vertices per level and one z-offset rule. `shell.test`: slab top-face colours = `col(mix(hall))`, side faces = `col(E.slab)`; the "hall 0.008" Y check is dropped. A-10 / A-11 updated.
7. **Whitelist and mock strictness: approved, with one correction.**
   - Additions approved: **Euler `x`, `y`, `z`** (via `object.rotation`; no `set`, no `order`) and **Vector2 `x`, `y`, `set`** (`shadow.mapSize`). Written into A-10.
   - The `then` / `toJSON` read-as-`undefined` exception is approved for **reads only**; writing them still throws.
   - Stricter checks approved: render-time colour audit, `Mesh` arity, material `color` must be a mock `Color`, `setAttribute` names / equal counts, `setIndex` range.
   - **Correction (would otherwise throw on the plan's own first render):** a material's *default* colour (never passed, never set: white `#FFFFFF`, identical in sRGB and linear) counts as converted for the audit. `BoxBatch` materials are `MeshLambertMaterial({ vertexColors: true })` with no `color`, so without this the audit rejects every batch. Any `set` / `setHex` / `copy` of a raw colour onto it still clears the flag. One `mock.test` case each way.
   - `globalThis.__threeMock` side channel + `mock-backdoor` lint on `src/`: approved.
8. **CatmullRomCurve3 maths: port now.** A-16 already requires the mock's maths classes to compute real values, and the conformance harness that checks the port against real r128 is being built in this task, so the port is cheapest now (~80 lines, one comparison). Limited to the A-10 members (`points`, `getPoint`, `getPointAt`, `getLength`, `arcLengthDivisions`, `updateArcLengths`) and the three curve types.
9. **Stair and lift: plain 1.2 m boxes, the lift not a full-height shaft — yes.** Same rectangle on every level; stepped stair stays optional F4-T2 polish.
10. **F3 follow-up bundle: F4-T2, as its first separately reviewed step — yes** (PM recommendation, CTO deferred note). It includes PM decisions 1, 2, 4, 5, 9 (the `STRIP_STAGES` line too — not pulled into F4-T1, so the phone check has one change set to blame), the client's answers to questions 1 and 2 if they create work, CTO debt 6 (lift-only overlap unit case) and the CTO round-2 `applyEdit` stale-plan guard. Own `plan.md` section, TL plan review, QA in F4-T2's round. Known cost accepted: the F4-T1 publish still shows "Skip to 3D" next to "Build 3D model" on stage 4 (cosmetic; G1 unchanged). F4-plan.md updated.
11. **Level labels: PM matter** — recommendation under "For the PM". Meanwhile FS implements the recommended words from `PC.C.LEVEL_LABEL` minus " floor" with the full name as `aria-label`, and `view3d.spec` checks no overflow at 360 px with the 5-option house (B, G, 1, 2 + All).

## Runtime ruling (projection ~485 s, over the 8-minute target)

**Yes — QA trims `f2-t2` / `f2-t3` in the F4-T1 QA round**, without waiting to see whether the measured run lands just under 480 s. F4-T2 (furnish, roof, site, budget test + the bundle's stage-3 tests) and F4-T3 (`view3d-look.spec`) still add browser time, so the headroom has to be made now (CTO debt 7). Rules as in `F3-T3/qa-trim.md`: remove only duplicates of a twin that runs at the same viewport with the same input, an A-16 trim comment naming the twin, every behaviour keeps at least one viewport, mutation proof of the survivors. **Target: full run ≤ 450 s after F4-T1.** FS does not shorten the 3D checks below the plan; `view3d-real.spec` stays ≤ 30 s; `--jobs` stays 2.

## Required in the implementation (binding; checked at the implementation review)

1. **H1 order** as ruled above: mock + mock.test + vendored r128 + conformance green before any scene / house / cam code; one status line at that checkpoint.
2. **House-model refusal** uses `st[3].reachable && st[3].valid` (`st = PC.stages.status(state)`), not `valid` alone: `status()` computes `valid` for stage 3 independently of stages 1–2, so `valid` alone does not encode "stages 1–2 are valid". (Today an open plot also fails the signature, since `PC.site.analyse` gives no footprint, but the model must not rely on that.) The plan's refusal tests (unapproved, stale, `no-layout`, open plot) stay, plus one case with a stage-2 blocking conflict.
3. **"Building…" must actually paint:** set the overlay, then `requestAnimationFrame(() => setTimeout(build, 0))` (or two rAFs). A single rAF callback runs before that frame's paint, so building inside it blocks the overlay from ever showing. Guard the yield with a token: `close()` during the yield cancels the build and requests no render; reopening restarts it. `scene.test`: building → (rAF + timeout) → ready; close-during-yield → no build, no frame.
4. **Hall on the slab top face** (Q6): `BoxBatch.add(…, hex, topHex)`; no hall quad; tests as in Q6.
5. **Mock default-colour exemption** (Q7) with its two `mock.test` cases.
6. **Disabled control set** (Q3), asserted in `view3d.spec`.
7. **Reset radius and `rMax`** as in Q1; `cam.test` reset-fit at aspect 0.56 and 1.6 (already planned) plus "the reset pose is never clamped" at both.
8. **QA-first hand-off** (list below): FS lands the stage-5 controller only after QA's version-aware updates are in (A-4 pattern, as with draft v2); FS updates its own `shell.spec`, `plans-edit.spec`, `stages.test` title and the `stages.js` comment in the same change.
9. **Near plane follows the orbit radius:** `camera.near = max(0.5, 0.02 × pose.radius)` (then `updateProjectionMatrix()`) on every pose change; `far = 20 × house.radius` unchanged. The depth step becomes about d / 335 000 (under 1 mm at 300 m), so the 0.015 m tint offset never fights at any zoom. The cost is that geometry within 2 % of the orbit radius of the eye is clipped (at most 1 m at a 50 m orbit), which only happens when the eye skims a wall or the roof and is accepted. `scene.test`: near at radius 4 is 0.5, at radius 300 is 6. A-12 updated.

## Non-blocking notes

- `house.build` returning `null` while stage 5 is open should not happen (stage 5 is reachable only with stage 3 valid); if it does, show `v3-unavailable` rather than throw.
- `groundCap` sits inside the ground slab box in every non-basement view (never seen); that is fine — its only job is the basement rule.
- Partitions enclose every room (no door gaps); acceptable for the dollhouse (doors are a non-goal). Exterior entrance gap only on the ground front wall, as planned.
- The dist size tripwire (< 600 000 bytes) is not the real guard — the licence-string check is. Name the reason in the lint message so whoever raises the cap in F5 knows why it exists.
- On phones the bottom panel covers up to a third of the canvas; Reset frames against the full canvas. Acceptable (the panel collapses); QA notes it if a phone shot looks wrong.
- Shots for the Designer (four exteriors at 1280x800 + `sand` at 360x640) are reviewed in the implementation round, as planned.

## For the PM

- **Level selector labels (Q11), recommendation:** words — "All / Basement / Ground / First / Second" (the `LEVEL_LABEL` names without " floor"), each with the full name as `aria-label` ("Ground floor"). They read without a legend and match the stage-3 tabs. Fallback only if the 5-option house overflows at 360 px in the e2e check: "All / B / G / 1 / 2" for that case only, the Designer judging the shot. Not "B / G / 1 / 2" by default: on a phone shown to a client "1" and "2" are ambiguous (UK/US floor numbering).
- Disabled Light / Tour / Roof controls in the F4-T1 publish (Q3): no product text added; the phone-check guide explains them.
- The F3 follow-up bundle is placed in F4-T2 as its first step (your recommendation). The client's answers to questions 1 and 2 join it when they arrive.
- The F4-T1 publish still shows the stage-4 sample strip (decision 9 lands in F4-T2).

## For QA

- **QA-first updates before FS lands the stage-5 controller** (version-aware; suggested marker `!!(PC.house && PC.house.build)`, which loads under abort too):
  - `tests/qa/f1-t2-flows.mjs` section D (line ~132): "stage 5 (no controller): notice shown" → with the marker, no banner, and under abort `v3-unavailable` shown, `v3-panel` hidden, Back 5 → 4 unchanged;
  - `tests/qa/f3-t2-editor.mjs` step 8 (line ~193): "Build 3D model opens stage 5 with 'This stage is not built yet: static preview'" → stage 5 with no banner and `v3-unavailable` in view (abort);
  - `tests/qa/f1-t1-layout.mjs` stage-5 layout states (`s5-view`, `s5-light`, `s5-tour`, `s5-collapsed`, `s5-building`, `s5-unavailable`, lines ~45–50): under abort the controller now hides the panel, so those states need `three: 'mock'` (or the unavailable state), and `S.v3levels` must not duplicate the options the controller fills (clear `v3-level` first, or use the controller's options);
  - check also that no other suite that Skips to stage 5 expects the banner (`f3-t3-look` 0 only checks the stage — fine).
- **Trim** `f2-t2` / `f2-t3` in the F4-T1 QA round (runtime ruling), target ≤ 450 s.
- In the QA round: the disabled control set, Reset framing at 360x640 / 640x360, level labels at 360 px with the 5-option house, and the `view3d-real` shots.

## For FS

- Proceed with the plan as amended by rulings 1–11 and required items 1–8. Work order unchanged; the H1 checkpoint gates step 4.
- `BoxBatch.add` gains `topHex` (A-11 updated); A-9 / A-10 / A-12 / A-16 carry the rulings.
- The F3 follow-up bundle is not in F4-T1.

VERDICT: APPROVED
