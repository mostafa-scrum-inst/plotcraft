# F5 — Room finder and drone tour: feature plan

Owner: Tech Lead. Shared decisions: `architecture.md` (A-n), especially A-12 and A-14.

## Stories covered
F5-S1 Jump to a room, F5-S2 Take the drone tour. The last task is the Designer's presentation and device pass over the whole product (G4, R2).

## Technical approach
- Both features are consumers of what F4 built: the orbit pose (`PC.cam`), `PC.three.flyTo`, the level selector / roof toggle / basement rule, and the house model.
- **Finder**: compute a pose per room (A-14), set visibility state, move one highlight mesh, fly for 1.2 s; a new selection restarts from the current interpolated pose; any gesture cancels.
- **Tour**: the plan (stops, eye and look points, timings) is pure data from `PC.tourplan.build(house)`; the runtime samples two `THREE.CatmullRomCurve3` curves by arc length, clamps the camera height to 1.5 m or more, and updates caption and level visibility from the current stop. No physics, no collision search: eye points sit above wall tops by construction.
- All time-based motion advances by the frame's real delta (capped at 100 ms) so pause, speed changes and tab switches behave.

## Tasks (in order)

### F5-T1 — Room finder — **FS**
- **Scope.** `PC.three.flyTo` (if not already complete from F4-T1: redirect and cancel semantics), `three/finder.js` (`poseForRoom`, highlight mesh = thin outline frame built with `BoxBatch`, `goTo(roomId)`), `ui/stage-3d.js`: dropdown listing every room grouped by level (`<optgroup>`), names from the plans; selecting switches the roof off, sets the level selector to the room's level (basement opens the ground), shows the caption; choosing "All" in the level selector clears the highlight.
- **Files.** `src/js/three/finder.js`, `camera.js`; `src/js/ui/stage-3d.js`; `tests/three/finder.test.mjs`; `tests/e2e/finder.spec.mjs`.
- **Acceptance criteria.** F5-S1 all.
- **Dependencies.** F4-T3.
- **QA should test.** Mock tests with a controllable clock: dropdown model lists all rooms of the sample (14) and of the maximum house (32) grouped by level, lowest level first; after `goTo` and 1.2 s the pose target equals the room centre (0.01 m), the room's level is the top visible level, the roof group is hidden, `groundCap` hidden for a basement room, the highlight sits on the room rectangle; intermediate frames are monotone (no jump: pose distance per frame bounded); a second `goTo` mid-flight starts from the current interpolated pose; a pointer-down cancels and the pose stops changing; camera eye height never under 1 m. E2E (mock): the select is 44 px high or more at 360 px and operable by touch and keyboard; caption shows the chosen room name; no console errors.
- **Rider (TL, F5-T1 plan review, `docs/03-tasks/F5-T1/plan-review.md`):** maximum house is 40 rooms (CD-4), not 32; files are `three/scene.js` (shared animation driver, `PC.view3d.flyTo`) and `three/finder.js`, pose and groups in `core/cam.js`; basement phi 15 degrees; target Y floor = lowest floorY (A-12); cancel before the input delta; caption "Room · Level" (PM round 12); selection cleared by All / level change / Reset / Roof on / placeholder / rebuild; the session look is never touched; highlight counted in the budget (22 of 40 with a room selected); no new e2e file.

### F5-T2 — Drone tour — **FS**
- **Scope.** `PC.tourplan.build` (A-14: stop order, eye/look points, timings, speed factors, nudge of coincident points), `three/tour.js` (curves, progress, height clamp, current stop -> caption + level visibility, `start / pause / resume / stop / setSpeed`, stop on gesture, stop on leaving stage 5, no auto-restart), tour controls in `ui/stage-3d.js` (Start, Pause/Resume, Stop, speed slow/normal/fast; roof forced off at start; time/season controls stay live).
- **Files.** `src/js/core/tourplan.js`; `src/js/three/tour.js`, `scene.js`; `src/js/ui/stage-3d.js`; `tests/unit/tourplan.test.mjs`; `tests/three/tour.test.mjs`; `tests/e2e/tour.spec.mjs`.
- **Acceptance criteria.** F5-S2 all. G1 reviewer path (Load sample -> Skip to 3D -> Start tour in 6 taps at most).
- **Dependencies.** F5-T1.
- **QA should test.** Unit: stops = overview, every room exactly once, levels in ascending order (basement first), overview last; nearest-neighbour order is deterministic; every eye point is at `max(baseY, 0) + storeyH + 2.5` or higher; sample duration at normal speed between 30 and 90 s; single-room house and maximum house (32 rooms) produce valid plans with no coincident consecutive points. Mock tests with a controllable clock, sampling the whole tour at 60 fps: camera Y is 1.5 m or more everywhere (basement tour included); for each room there is a moment when its look point is the camera target within 0.5 m and levels above it are hidden; consecutive camera positions never jump more than `speed x dt x 3`; direction change between consecutive frames is bounded (no sharp turn); caption equals the current room name; Pause freezes the position, Resume continues from it; speed changes take effect without a jump; Stop and a pointer gesture both end the tour, leave the camera in place and return orbit control; leaving stage 5 stops it and re-entering does not restart; changing hour/season mid-tour does not alter progress; roof hidden at start. E2E (mock): reviewer path tap count; controls 44 px or more; no console errors over a fast-forwarded tour.

### F5-T3 — Presentation and device pass — **Designer**
- **Scope.** A design-quality pass over the finished product, delivered as CSS/markup/data changes (not a report):
  - Screenshot review of all five stages with the sample and with an empty project at 360x640 and 640x360 (landscape), 768x1024, 1280x800 (headless Chrome via the existing e2e helper); fix spacing, overflow, truncation, contrast, focus order and focus visibility, pressed/disabled/invalid states, label legibility on the 2D canvases (palette2d adjustments).
  - Stage 5 overlay: final layout of the collapsible panel in portrait and landscape (a third of the canvas at most at 360x640), tour control bar and room caption placement so they never cover the panel toggle, "Building…" and "3D unavailable" states, the illustrative-data label.
  - Final tuning of `PC.data.look3d`, `furniture` and `sky` tables in response to the F4 hosted-page review notes (values only; schemas are frozen).
  - Updates the hook table if any markup moved (hook names must not change).
  - Polish items deferred to this task by the F1 feature review: closing radius at low zoom (hint line or zoom-dependent radius, only if the hosted phone check shows a problem; FS change if needed); toasts cleared or re-worded on a unit change; a lighter area label so inner-side edge labels separate from it; a toast when saving stops mid-session and the full-quota storage behaviour; the 3D overlay panel covering 42.5 % of the canvas at 640x360.
- **Files.** `src/css/*.css`, `src/index.html`, `src/js/data/*.js`; screenshots under `docs/03-tasks/F5-T3/screens/`.
- **Acceptance criteria.** G4 and R2 for every story at the three reference viewports plus phone landscape; R3 presentation; F4-S2 overlay criterion; F5-S1 dropdown 44 px or more; F5-S2 room name visible during the tour; no regressions (full `node tests/run-all.mjs` green, data-table schema tests green).
- **Dependencies.** F5-T2; notes from the F4 feature review (`docs/04-feature-reviews/F4.md`).
- **QA should test.** Automated device sweep over all stages and both project states at the four viewports: no page-level horizontal scroll, all interactive elements 44 px or more, nothing clipped outside the viewport, Back/Next always visible, overlay coverage limit, caption and tour bar not overlapping the panel toggle (bounding-box intersection test), focus ring visible on Tab for every control, contrast of text tokens 4.5:1 or more; hook table still matches the markup; the whole suite still passes unchanged.
