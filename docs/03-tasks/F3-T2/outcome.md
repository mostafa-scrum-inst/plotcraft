# F3-T2 — Plan editor, approval and interior stage: outcome

Owner: FS. Status: **PASSED QA** (`qa-report.md`, round 1: QA F3-T2 9 + 190, all 9 focus items met). TL implementation review APPROVED with its addendum (`impl-review.md`).

Sources:
- `plan.md` and `plan-review.md`, including the orchestrator note (corner resize out);
- `designer-plan.md`;
- the PM round-6 table (`goals-and-stories.md`);
- architecture A-8 and A-15, updated by the TL.

## 1. What was built
- **Plan editor (stage 3, F3-S2).**
  - **Gestures:**
    - tap a room to select it;
    - a drag that starts on a room selects and moves it;
    - a drag on one of the selected room's **four edge handles** resizes that edge (no corner resize: PM round 6 and the orchestrator note);
    - anything else pans;
    - two fingers pan and zoom, and a second finger cancels an edit;
    - the stair and lift are never hit.
  - **Handles:**
    - drawn as pills;
    - hit radius 22 px on touch and pen (a 44 px target), 10 px with a mouse;
    - on a room under 66 px on screen in a direction, that direction's handles sit 22 px outside the room, so the body keeps its move target.
  - **Snapping** (A-15, TL ruling 9):
    - a moving edge snaps first to a parallel edge within 0.3 m: another room's edge only when its span overlaps the moving edge's span ± 0.3 m, the stair or lift block, or the footprint (those always);
    - otherwise to the grid of the unit (0.5 m, or 1 ft = 0.3048 m), in frame P;
    - the live preview and the release give the same result.
  - **Constraints:** hard clamp to the footprint and to 1.5 m per side. Since the QA bug-1 fix, `resizeRect` clamps the finger position before snapping, as `moveRect` does, so an edge dragged past the wall lands exactly on it, in ft too.
  - **During a drag:**
    - the transient rectangle, a dashed ghost at the start position and green snap guides are drawn;
    - the readout updates live;
    - **no store commit** happens during the drag, then exactly one on release (`PC.plans.applyEdit`).
  - **Overlaps** with rooms or with the stair / lift are allowed while dragging. On release they are marked red and block approval.
  - **Edited:** any committed change to a rectangle sets `edited`, clears approval and recomputes the level's unmet pairs, so the broken-pair warning comes and goes. Other levels are never touched.
- **Approval (F3-S3).**
  - "Approve floor":
    - while the floor has overlaps it is `aria-disabled` and shows the reason (PM texts: one pair, a room on the stairs / lift, or a count);
    - when approved it reads "Approved", carries `is-approved` and `aria-pressed="true"`, and pressing it returns the floor to Draft (TL ruling 6).
  - The tab badge, the counter "n of m floors approved" and the Next lock all follow.
  - An edit on an approved floor returns it to Draft and says so once: "Ground floor is back to Draft. Approve it again when you are done."
- **Messages (PM round 6):**
  - the overlap reasons;
  - "Ground floor approved." and, for the last floor, "All floors approved. Next: Interior.";
  - the back-to-Draft notes;
  - the default hint "Drag a room to move it; tap it, then drag a handle to resize." It fits one line at 360 px: 332 of 336 px, asserted at 360x640.
- **Readout:** drawn vs asked area when they format differently, e.g. "39 m² (asked 42 m²)" / "414 sq ft (asked 452 sq ft)".
- **Labels:** the Designer's `PC.data.roomLabels` forms, from full name with area, to full name, to short, to tiny at 10 px. Every room of a type on a level uses one form (the master counts with the bedrooms); the area line is shown for all of a type or none. The stair and lift use their own rows.
- **Fit margin** 0.5 m (TL ruling 7, A-15).
- **Regenerate this floor** asks only when the floor has manual edits or an approval. Texts per round 6: edited / approved / both, each followed by "It will be laid out again from the room list." An untouched Draft regenerates at once.
- **One R5 sentence builder** (`PC.levels.plansSentence(hit, gone, state)`) for:
  - the general gate dialog;
  - Clear (stage 1, via `PC.store.atRisk`; no sentence when nothing is at risk);
  - the remove-floor dialog.

  It names only what each floor holds: "with its manual edits" / "with its approval" / "with its manual edits and approval", or the union for several floors. It says "lost" for removed floors.
- **R5 end to end** with real edits and approvals:
  - a vertex release asks and Cancel returns the vertex (F1-S3);
  - size-keeping vertex and setback moves ask nothing;
  - Q6 resets all levels, Q10 keeps everything;
  - the question comes once per visit.
- **Stage 4 (F3-S4).** `ui/stage-interior.js` wires Q18 / Q19 with plain `commit` (appearance class), defaults Modern / Full. It is locked until every floor is approved. The hint pictures stay the Designer's markup until F3-T3.
- **Stage 5.** `PC.stages.MAX_BUILT` is now 5. "Build 3D model" and Skip to 3D open stage 5, which stays the static preview with the shell banner "This stage is not built yet: static preview" until F4-T1.
- **Generator retry (A-8 step 8):**
  - when the first pass (cell scale 0.8–1.2) finds no layout, steps 3–7 run once more with `PC.C.LAYOUT.retry` = 0.75–1.25;
  - the retried result is kept only if `PC.layout.check` passes;
  - every first-pass success is unchanged.

## 2. Files
- **New:**
  - `src/js/ui/plan-editor.js` (gesture controller and overlay drawing);
  - `src/js/ui/stage-interior.js`;
  - `tests/unit/plans-edit.test.mjs`;
  - `tests/e2e/plans-edit.spec.mjs` (360x640 touch, 1280x800 mouse and keyboard; `SHOTS=1` writes `shots/`);
  - `tests/e2e/r5.spec.mjs`;
  - `tests/helpers/programmes.mjs` (the seeded sweep stream, shared);
  - `tests/unit/fixtures/layout-cases.mjs`, `layout-golden.json` and `make-layout-golden.mjs` (run the last only before a deliberate first-pass change).
- **Changed:**
  - `src/js/core/plans.js`, `layout.js` (range parameter and retry), `const.js` (`PLAN_EDGE_SNAP`, `LAYOUT.retry`), `stages.js` (`MAX_BUILT` 5), `levels.js` (`plansSentence`), `store.js` (gate text);
  - `src/js/ui/stage-plans.js`, `stage-plot.js` (Clear sentence), `q-rooms.js`, `draw2d.js` (generic `labelFits`, `pill`), `main.js`, `manifest.json`;
  - tests: `layout.test`, `layout-sweep.test`, `stages.test`, `rooms.test`, `signature.test`, `plans-view.spec`, `shell.spec`, `rooms.spec`, `questions.spec`, `edges.spec` (visibility wait, section 5).
- **Designer (theirs):** `src/js/data/room-labels.js`, palette entries, `42-stage-plans.css`, `plans-phone.spec`, `interior.spec`.
- **No schema change** (`PC.DRAFT_V` stays 2) and no markup change by the FS.

## 3. APIs F4 builds on
- **`PC.plans` editing (pure, frame P, metres, 0.01 m precision):**
  - `ctx(state, id)` → `{ W, D, core: { stair, lift }, grid }`;
  - `edgeCands(rooms, id, ctx)`;
  - `snapEdge(v, s0, s1, cands, grid, lo, hi)` → `{ v, to: 'edge' | 'grid' | 'none', d, at }`;
  - `moveRect(start, dx, dy, ctx)` and `resizeRect(start, 'n' | 's' | 'e' | 'w', dx, dy, ctx)` → `{ rect, guides }`;
  - `applyEdit(draft, id, rect)` → `{ changed, wasApproved }`;
  - `problems(state, id)` (overlaps, derived);
  - `canApprove(state, id)` → `'' | 'none' | 'overlap'`;
  - `approve` / `unapprove(draft, id)`;
  - `hasWork(plan)` (edited or approved).
  - **Invariant:** an approved plan has no overlaps. Only `approve` and `applyEdit` write `approved`, and the unit tests attack this through every operation.
- **Plans F4 reads:** `state.plans[id].rooms` (frame P) are the approved rooms; `PC.layout.core(W, D, stairs, stairPos, lift)` is the stair / lift block.
- **Q14 convention (binding on A-9 and F4):** front = low y (street side), left = low x as seen from the street looking in; `fl` = the (0, 0) corner.
- **`PC.ui.planEditor(host)`:**
  - `hitTest`, `onDragStart/Move/End`, `drawOverlay`, `rectOf`, `dragging`, `spots`, `cancel`;
  - host: `{ view, level(), selected(), select(id), footprint(), changed(), committed(r) }`.
- **`PC.ui.stages.interior`:** Q18 / Q19 bound through `PC.ui.qfields.radios`; `state.ans.interior = { style, density }`.
- **`PC.data.roomLabels`** (Designer): `{ full, short, tiny }` per type, plus master, stair and lift.
- **`PC.stages.MAX_BUILT = 5`:** stage 5 has no controller yet. F4-T1 registers one through `ui.shell.register(5, …)`, which removes the static banner.
- **`PC.levels.plansSentence(hit, gone, state)`:** the single R5 sentence.
- **`PC.C.LAYOUT.retry`** and **`PC.C.PLAN_EDGE_SNAP`**.
- **Debug hooks:** `PC.debug.planHandles(id)` (viewport px), `PC.debug.planDrag()`.

## 4. How to verify
- `node tests/run-all.mjs --unit --e2e --only plans-edit,r5,plans-view,plans-phone,interior` (about 1 min).
- `SHOTS=1 node tests/e2e/plans-edit.spec.mjs` writes the phone screenshots: select, drag, overlap, resize, approved, interior, stage 5.
- Manual check at 360x640:
  1. Load sample, then Next twice.
  2. Tap Kitchen, then drag it 1 m down: overlap with Majlis, Approve refused.
  3. Drag its front handle up: it snaps to the Majlis wall.
  4. Drag its back handle up: it snaps to the Dining wall and the pair is restored.
  5. Approve, edit again: back to Draft, told once.
  6. Approve both floors, then Next: stage 4. "Build 3D model": stage 5 with its banner.

## 5. QA sign-off and runs
- **QA round 1: PASSED.** QA F3-T2 9 + 190; every other QA suite green.
- **Bug 1** (ft resize past the wall stops 5–6 cm short; 730 of 8 960 seeded resizes): **fixed after QA.** `resizeRect` now clamps before snapping.
  - New unit test: in ft, each of the four edges dragged 0.4 / 1 / 3 m past the footprint lands exactly on 0 / W / D.
  - Mutation check: removing the clamp fails it.
  - QA can drop the KNOWN entry in `f3-t2-edit.mjs`.
- **Full-run flake in `edges.spec.mjs`** (QA's 584 s run: a `site-tap-mode` label tapped while not yet visible under load):
  - the spec's `mode()` helper now waits for the stage to settle, makes sure the site group is shown and waits for the label to be visible (condition waits, no fixed sleeps);
  - the other taps right after stage changes in the `clearing` scenario got the same `settled` wait;
  - two copies run in parallel with `plans-edit` passed 501/0 each.
- **Full runs:**
  - FS hand-over 494.9 s (exit 0);
  - after the review fixes 495.3 s, failing only on QA's two old-wording lines, which QA then updated;
  - QA round 584.0 s (the flake above);
  - after these fixes: **exit 0 in 595.7 s**.
  - All are under the 10-minute A-16 trigger, but the last one is **4.3 s short of it**, so the trigger is effectively reached: QA trims duplicate viewport coverage between `tests/e2e` and `tests/qa` (TL condition 5) before the next feature adds specs.
- **Mutation checks: 27 in total, all caught.**
  - 22 at hand-over (snap rules, clamps, minimum side, approval, unmet pairs, core overlaps, `MAX_BUILT`, sentence union, commit during drag, hit radius, outward handles, Regenerate predicate, `aria-pressed`, un-approve, stage-4 commit, Clear's atRisk, label tier per type, retry ×3).
  - 4 for the review fixes: the gate sentence ×3 and a wrapping hint.
  - 1 for bug 1.

## 6. Tech Lead and product rulings applied
- **Plan review** (`plan-review.md`):
  - retry 0.75–1.25 with the `check` guard (the TL withdrew 0.77–1.23);
  - keyboard room editing out of scope;
  - no aspect warning after edits;
  - the Approve toggle with `aria-pressed`;
  - fit margin 0.5 m;
  - `MAX_BUILT` 5 with the static banner;
  - neighbour snapping only for overlapping spans ± 0.3 m, plus core and footprint.
- **Orchestrator note:** TL ruling 3 ("corners required") crossed the PM's round-6 decision. Product scope is the PM's, so **corner resize is not in F3-T2** (optional later in F5-T3 if the client asks), and condition 2 is void.
- **Implementation review addendum:**
  - the hint's 4 px margin at 360 px is accepted (the fixed-height two-line message line absorbs a wrap);
  - the floating warnings chip is accepted;
  - the drag-time message freeze was removed: with the Designer's fixed-height message line it is no longer needed, as the combined mutation shows.
- **PM round 6:** all user-facing texts (section 1); corner resize not required; tapping "Approved" un-approves; 4.4 row "Generator retry after no layout: cell scale 0.75–1.25 (first pass 0.8–1.2), only when the first pass finds no layout".
- **Designer review rulings:**
  - the counter stays visible on phones as one compact line;
  - action row padding 4 px;
  - readouts re-gridded;
  - `is-approved` green wins over the `aria-pressed` tint;
  - fixed-height phone message line.

  Scale at 360x640 with the strip: 14.25 px/m.

## 7. Generator retry (A-8 step 8)
- The golden JSON records the F3-T1 output before the change:
  - **0 of 2 355** first-pass sweep successes changed;
  - every fixed case (sample levels, maximum levels at five stair positions, stretched footprints, pinned cases) is deep-equal.
- **12 of 45** former failures now lay out (2 of 21 at ≤ 85 % fill).
- QA's 30 m² room on 5 × 8.5 m with a front-left stair lays out as 5 × 4.5 m (exactly −25 %).
- The boundary case `check` rejects after rounding is pinned (stream position 244): it stays "Cannot be laid out".
- A failing maximum level (8 rooms + lift) answers in under 1 ms, against a limit of 600 ms.
- Sweep time about 9–15 s, worst programme 129–250 ms depending on load.

## 8. Known limits and observations (owner)
- **Keyboard room editing:** out of scope (R2 is controls only). Tabs, Approve, Regenerate, dialogs, stage-4 radios and Back / Next work by keyboard. *(PM; known limit.)*
- **No corner resize** (PM round 6). *(PM / Designer: F5-T3 if the client asks.)*
- **QA observations:**
  1. A small room's outward handle can lie over the stair, so a press there resizes instead of panning. This follows the hit order. *(Designer F5-T3 / TL.)*
  2. One-finger pan is hard on phones: it works only outside rooms, and at the default fit the plan fills the canvas. A pan attempt over the plan moves a room, and there is no undo, only Regenerate (out of scope, section 1). *(PM at the F3 feature review.)*
  3. Stage 5 looks interactive: the View / Light / Tour controls on an empty canvas do nothing until F4-T1, though the banner explains it. *(F4-T1.)*
  4. The 1.5 m minimum is not reachable in ft: the edge stops on the 1 ft grid, e.g. 1.71 m, unless a candidate is near. *(PM: accept or allow the minimum as a candidate.)*
  5. A move past the footprint uses the neighbours' span at the finger position, not at the clamped room. The difference is under 0.5 m, in 76 of 5 600 seeded moves. *(FS; a one-line fix if wanted.)*
  6. Labels overlap while rooms overlap, and a handle pill can cover the "Stairs" label. Cosmetic. *(Designer F5-T3.)*
  7. At 640x360 the readout spends three lines on "None selected / – / –". *(Designer F5-T3.)*
- **Clear, then redrawing the identical outline, keeps the plans**, although the dialog says "regenerated". This is A-7 as designed, accepted by the PM in round 6.
- **The 360 px hint fits with 4 px to spare;** a wider system font wraps it to the second line of the fixed-height message line (accepted).
- **Floors with warnings:** the floating chip can cover a room's label at the default fit (Designer F5-T3, per the TL addendum).
- **Runtime:** the full run (595.7 s) is at the 10-minute A-16 trigger. *(QA trims duplicate viewport coverage, TL condition 5.)*
- **F1 real-device gate: OPEN.** The client's testing guide is being sent. The CTO's condition "answers before F3-T2 sign-off" is unmet; the TL records it in `F1.md` as OPEN, and the CTO decides at the F3 feature review.
