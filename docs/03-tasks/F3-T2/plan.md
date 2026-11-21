# F3-T2 plan: plan editor, approval, interior stage (FS, 2026-11-21)

Inputs:
- `docs/02-features/F3-plan.md` (the F3-T2 section and the riders table);
- PM stories F3-S2, F3-S3, F3-S4, R5 (incl. the round-5 atRisk decision) and F1-S3 (R5 on vertex release);
- section 1 out of scope ("Undo history beyond … 'regenerate floor' in plans");
- section 4.3 / 4.4 (plan snap 0.5 m / 1 ft, neighbour snap 0.3 m, handle radius 22 / 10 px);
- architecture A-4, A-7, A-8, A-15;
- `docs/03-tasks/F3-T1/outcome.md` and `outcome-review.md`;
- CTO 3b (snapEdge);
- the Designer's `docs/03-tasks/F3-T2/designer-plan.md` ("DP"; the TL reviews both together).

This is a plan only. No code has changed. Measurements in section 10 come from a scratch script outside the repo.

## 0. Summary
- **New:** `ui/plan-editor.js`, the gesture controller for the plan canvas. It owns the transient drag state, the handles, hit testing, the ghost and snap guides.
- **New pure operations in `core/plans.js`:**
  - `snapEdge`, `moveRect`, `resizeRect`, `applyEdit`;
  - `problems`, `approve`, `unapprove`, `canApprove`.
- **`stage-plans.js`** gains:
  - Approve with its states and reasons;
  - the messages;
  - the drawn-vs-asked readout;
  - the label tier rule (DP 3);
  - the fit margin (DP D);
  - Regenerate asking for edited **or** approved plans.
- **New:** `ui/stage-interior.js` (Q18 / Q19).
- **Changed:**
  - `PC.stages.MAX_BUILT` 3 → 5, so stage 5 opens as the static preview with the existing "not built yet" notice;
  - the Clear dialog gains the atRisk plans sentence;
  - `layout.js` gains the failure-only retry.
- **No schema bump.**
- **No markup or CSS change by FS.** Every hook exists (section 12). The Designer's CSS and data land first (DP 8).

## 1. Editor interaction (F3-S2; riders "gestures" and "no commits during a drag")
**Gesture model.** View2D stays generic and unchanged. The plan view supplies `hitTest`, `onTap` and `onDragStart/Move/End`.

| Pointer action | Result |
|---|---|
| Tap on a room (8 px / 700 ms) | selects it; the readout shows it. A tap on empty space, the core or outside the footprint clears the selection. A tab change clears it too. |
| One-finger / mouse drag that **starts on a room** (selected or not) | selects that room and moves it |
| Drag that starts on a **handle of the selected room** | resizes that edge (edge handle) or both edges (corner) |
| Drag that starts on empty space, the core, the hall or outside the footprint | pans (View2D default). One-finger panning is therefore not available over rooms, as the rider states. |
| Two fingers | pinch zoom and pan. A second finger during an edit cancels it: View2D calls `onDragEnd(…, cancelled)` and the room returns to its start. |
| Wheel / `+` `-` / arrows on the focused canvas | zoom and pan (unchanged) |
| `pointercancel` / lost capture | the edit is cancelled and the room returns |

**Handles.**
- **Positions.** One function, `handleSpots(screenRect, pointerType)`, gives the positions for both drawing and hit testing, so a drawn handle is always the hit target.
- **Edge handles** are the four edge midpoints, drawn as the DP pills (18 × 6 px, `state.handleFill` / `state.handleStroke`, `line.handle`).
- **Corners:**
  - The story and F3-plan ask for edges **and** corners (8 handles). DP 4 draws edge pills only.
  - I plan corner targets at the four selection-outline corners, with the same hit radius, plus a small drawn corner mark if the Designer adds a palette entry for it (TL / Designer question Q3).
- **Hit radius:** `View2D.hitRadius(type)`, which is 22 px for touch and pen (a 44 px target) and 10 px for a mouse.
- **Small rooms (DP 4):** when the room is under 66 px on screen in a direction, that direction's two edge handles, and the corners on that axis, sit outside the room by half a target (22 px). Each then keeps its own 44 px target and the body keeps the move target.
- **Hit order:**
  1. corners of the selected room;
  2. its edge handles (nearest within the radius);
  3. the body of any room (move);
  4. otherwise null (pan).
- Large rooms (≥ 66 px) also accept a grab anywhere along an edge, within the radius outside the edge. Inside the edge the band is `min(radius, (size − 44) / 2)`, so the body keeps a 44 px move target.
- The stair and lift are never hit: they are not selectable and cannot be dragged (F3-S2).

**Transient state.**
- During a drag the editor holds `{ id, kind: 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw', start, cur, guides }` in frame P. `n` is the back (high y) edge and `e` is the right (high x) edge, matching Q14.
- Drawing uses `cur` for that room plus the DP ghost (`state.ghost`, dashed) at `start`. Snap guides (`state.snap`, dashed) mark every edge that snapped to a neighbour.
- The readout shows `cur` live.
- **No store commit happens until release.** On release with a changed rectangle there is one `PC.store.commit(d => PC.plans.applyEdit(d, level, id, cur))`. This is a plain commit, not `propose`: editing cannot change a signature. A release whose rectangle equals `start` after snap and clamp commits nothing.
- The page does not scroll: the canvas has `touch-action: none` already, and View2D calls `preventDefault` on the wheel.

**Keyboard.**
- No story asks for keyboard room editing. R2 asks for basic keyboard on controls (Tab / Enter / Esc) and F3-S2 lists touch only.
- Planned keyboard coverage: plan tabs (arrows / Home / End, existing), Regenerate, Approve, the dialogs (Esc = Cancel), stage-4 radios (native arrows) and Next / Back.
- A keyboard or no-canvas way to edit rooms would need a new markup hook (for example a per-room list, as `q-edges` is for edges). It is not planned (Q4).

## 2. Snapping (A-15, CTO 3b, 4.3 / 4.4; rider "editor snaps off-grid edges on release")
Pure: `PC.plans.snapEdge(v, cands, grid, lo, hi)` returns `{ v, to: 'edge' | 'grid' | 'none', at }`.
- **Candidates**, collected once per drag (`PC.plans.edgeCands(rooms, id, core, W, D, axis)`):
  - every parallel edge of every other room on the level;
  - the stair and lift blocks;
  - the footprint (0 and W, or 0 and D);
  - the dragged room's own edges are excluded.

  A-15 says "any parallel edge", so alignment with a room that does not touch counts too.
- **Rule:**
  1. the nearest candidate within `PC.C.PLAN_EDGE_SNAP = 0.3` m wins, whether or not a grid line is nearer;
  2. if two are equally near, the lower value wins (deterministic);
  3. if none is within 0.3 m, snap to the grid, `PC.C.PLAN_SNAP[unit]` (0.5 m, or 0.3048 m in ft), measured in frame P from the footprint's origin.
- **Limits** `[lo, hi]` come from the clamp (section 4). A candidate or grid line outside them is skipped. For the grid: the nearest line inside the limits, else the clamped raw value (`to: 'none'`).
- **Move:**
  - The low and high edges on each axis are tested. The one with the nearer neighbour candidate decides the shift (low edge on ties).
  - Without a neighbour, the edge that needs the smaller grid shift decides.
  - The rectangle is then re-clamped. The footprint edges are candidates, so the clamp result is itself a snap.
  - A room whose width is off the grid therefore keeps one off-grid edge after a pure move, unless that edge meets a neighbour. A resize puts each moved edge on a neighbour or on the grid.
- **Resize:** only the moving edge or edges snap. The opposite edge stays where it was.
- **Live = release:** the same functions run on every move and on release, so the committed rectangle is exactly the last preview.
- **New constant:**
  - `PC.C.PLAN_EDGE_SNAP: 0.3`, the 4.4 value "a dragged edge snaps to a neighbouring edge within 0.3 m". It is in the PM table already, so this is a code constant only.
  - `PC.C.PLAN_SNAP` already exists.

## 3. Overlap: marked invalid, blocks approval (F3-S2, F3-S3)
- `PC.plans.problems(state, id)` = `PC.layout.overlaps(plan.rooms, core)`, with the existing 0.011 m tolerance, codes `overlap-room` / `overlap-core`. It is derived and never stored.
- It is evaluated **on release** (after the commit) and on render, not while dragging.
- Every room in a problem is drawn with `state.invalidFill` and a `state.invalid` outline (DP 4).
- `plan-msg` (`data-kind="block"`): "Rooms overlap. Move or resize the marked rooms before approving." This is the wording QA's F1-T1 static mock already uses.
- For an overlap with the core: "A room overlaps the stairs. Move or resize the marked room before approving." The singular or plural follows the count (PM to confirm).

## 4. Constraints while editing
| Constraint | Behaviour |
|---|---|
| Inside the footprint | **Hard clamp.** A move stops at the footprint edge: x in [0, W − w], y in [0, D − h]. A resized edge stops at 0 / W / D. "Outside" therefore cannot happen in a plan the editor wrote. |
| Minimum side 1.5 m (`PC.C.ROOM_MIN_SIDE`) | **Hard clamp.** A resized edge stops 1.5 m from the opposite edge, and snapping never takes it below that. |
| Not over the stair / lift | **Not a clamp.** Overlap is allowed while dragging and marked invalid on release (F3-S2 says this explicitly for the stair and lift). |
| Aspect ≤ 3:1, area within 25 % | **Not enforced.** These are F3-S1 rules for *generated* rooms. F3-S2 lists only the footprint and the 1.5 m side. The readout shows drawn vs asked (section 7). A non-blocking "longer than 3:1" warning is possible (Q5); recommendation: none. |
| Another level | `applyEdit` touches only `plans[level]`. A unit test checks that the other levels stay deep-equal (F3-S2 "Editing one level never changes another level"). |

`moveRect(start, dx, dy, ctx)` and `resizeRect(start, kind, dx, dy, ctx)` take `ctx = { W, D, grid, cands }` and return `{ rect, guides }`. Both round to 0.01 m, as generated plans do.

## 5. What makes a plan "edited"; undo
- `applyEdit(draft, id, roomId, rect)` (in place, inside a commit) does four things:
  - replaces the rectangle;
  - sets `edited = true`;
  - recomputes `unmet` from the level's pairs with `PC.layout.adjacent`, so the existing broken-pair warning appears or disappears;
  - sets `approved = false`.

  It returns `{ wasApproved }`.
- **Edited** means at least one committed move or resize changed a rectangle. Selecting, tapping, cancelled drags, releases that change nothing, Approve, tab changes, pan and zoom do not count.
- `edited` stays true even if the user puts a room back where the generator had it. Only Regenerate or a stale signature (sync) makes a fresh, unedited plan.
- **Undo:** none. It is out of scope per section 1; Regenerate this floor is the reset. A cancelled gesture (second finger, pointercancel) returns the room before anything is committed.

## 6. Approve, counter, un-approve (F3-S3)
- **`canApprove(state, id)` returns `''` (allowed) or the reason:**
  - no plan, a stale plan or `error` → not offered (`btn-approve` `disabled`);
  - overlaps → the section 3 reason (`aria-disabled="true"`, so it is focusable and pressable; a press shows the reason in `plan-msg` and moves nothing).
- `approve(draft, id)` sets `approved = true` only when `canApprove` is `''`. It is a plain commit and, as a user change, clears `sampleClean`.
- **Approved state:**
  - `btn-approve` gets `is-approved` (styled already) and `btn-approve-label` reads "Approved";
  - the tab gets `is-approved` / "Approved" (existing render).
  - Pressing "Approved" un-approves (back to Draft, no dialog, nothing lost). Q6 asks whether the TL wants this toggle or a button that is simply inert once approved.
- **Counter:** `plan-counter` "n of m floors approved" (existing; m = plan levels, the roof is never counted). The DP hides it visually below 600 px; it stays in the DOM.
- **Un-approve on later edits:**
  - an edit on an approved level returns it to Draft;
  - `plan-msg` (`info`) says once: "Ground floor is back to Draft. Approve it again when you are done.";
  - "once" means on that transition only, because later edits find it already Draft. The note stays until the next message replaces it.
- **Next (to Interior):** disabled with "Approve all floors first" until every level is approved, with no error and a matching signature (`PC.stages` unchanged). Stage 4 in the stepper is locked until then.
- **Invariant "approved ⇒ no overlaps":** only `approve` and `applyEdit` write `approved`, and the latter clears it. A unit test checks this through every operation. `PC.stages` does not re-check overlaps.

**`plan-msg` priority (one line, `data-kind`):**
1. no-layout → empty (the banner speaks);
2. overlaps → block reason;
3. the one-time back-to-Draft note → info;
4. this floor approved → info, "Ground floor approved." (or "All floors approved. Next: Interior." when the last one is approved);
5. default → info, the markup text "Drag a room to move it; drag an edge or corner to resize."

The F3-T1 text "Approval comes with plan editing (next build)" goes.

## 7. Rider: drawn vs asked size (QA obs 6)
- `plan-room-area` reads `fmtArea(w × h)`. When the asked area, `PC.levels.roomArea(room)`, formats differently, it adds " (asked " + `fmtArea(asked)` + ")".
- Examples: "39 m² (asked 42 m²)" is the sample's Ground-floor Living, 7 × 5.5 m = 38.5 m², asked 42. In ft the same room reads "414 sq ft (asked 452 sq ft)".
- The readout is live during a drag. There is no banner.
- The Designer re-grids the readout so the longest ft case fits on one line (DP 2).
- **PM confirms the wording** (Q1).

## 8. Regenerate and Clear (atRisk wording)
- **Regenerate this floor** (F3-S1 / R5 round 5):
  - it asks when the plan is **edited or approved**, the same predicate as `PC.store.atRisk`. `atRisk` itself cannot be reused: regenerating changes no signature, so `affected` is empty;
  - an untouched Draft regenerates without asking (deterministic, nothing is lost).
  - **Proposed wording** (PM to confirm, Q1). Title "Regenerate this floor?". Text:
    - "Your edits to the Ground floor will be lost." when edited;
    - "The Ground floor's approval will be cleared." when approved;
    - "Your edits to the Ground floor and its approval will be lost." when both.

    OK "Regenerate".
  - It clears that level's approval only (F3-S1).
- **Clear (stage 1):**
  - `clearAll` builds the candidate: a clone with the plot cleared, `streetEdge` null, the normaliser applied;
  - the dialog text becomes "The outline will be removed. This cannot be undone." + " " + `PC.levels.plansSentence(PC.store.atRisk(cand), [])`. That gives for example "The floor plan of the Ground floor will be regenerated, with its manual edits and approval.";
  - the sentence is left out when atRisk is empty: one dialog, never two;
  - an open plot clears without a dialog, as now. Its plans are already stale, so `atRisk` is empty anyway.
  - **Nuance:** sync leaves plans alone while the signature is `'invalid'`. If the user redraws an identical outline, the plans become valid again and their edits survive, so "will be regenerated" overstates it in that one case. I accept this: A-7's rule, the same as reopen and re-close.

## 9. R5 end to end (F1-S3 criterion, R5 "observable result")
The pieces exist:
- `dragEnd` proposes the vertex move;
- Cancel leaves the state unchanged, so the vertex redraws at `orig`;
- `go(3)` clears `r5Confirmed`;
- the gate asks only for atRisk.

F3-T2 adds no new logic. It adds the end-to-end proof now that plans can really be edited and approved: `tests/e2e/r5.spec.mjs` (section 13), covering every F3-plan R5 scenario.

## 10. Rider: generator retry on failure only (QA obs 3) — includes a TL decision
**Implementation.**
- The scale range becomes a parameter. `layoutCell` / `layoutShape` use `range.fMin` / `range.fMax` in place of `K().fMin` / `K().fMax`, and so do the DFS capacity pruning and the fMax trim. The range is threaded through `generateOrdered(…, range)`.
- `generate` first runs exactly as today with `PC.C.LAYOUT` 0.8–1.2.
- **Only if `res.ok` is false**, it runs both orders once more with `PC.C.LAYOUT.retry`, using a fresh shared memo (cell results depend on the range), then rounds and does the snap pass as usual.
- The retried result is kept only if `PC.layout.check` returns no violation; otherwise `{ ok: false }`, and the existing message stays.
- Every result that succeeds today goes through the unchanged first pass, so it is byte-identical; this includes the sample and every pinned case.

**Measured** (scratch copy of the 2 400-programme sweep, same seed, the range swapped only for programmes that fail first):

| Retry range | Former failures recovered (≤ 85 % fill / above) | QA's 30 m² on 5 × 8.5 m, stair `fl` | Retry results rejected by `check` | Worst time incl. retry |
|---|---|---|---|---|
| 0.77–1.23 (TL ruling) | 0 of 21 / 6 of 24 | **still fails** | 0 | failing + retry ≤ 5 ms; sweep worst unchanged (~140–190 ms) |
| 0.75–1.25 | 2 of 21 / 10 of 24 | **lays out** (5 × 4.5 m = 22.5 m², exactly −25 %) | 1 (boundary rounding; stays no-layout) | same |

**Why QA's case fails at 0.77.**
- The front-left stair leaves two free bands: 5 × 4.5 m behind it and 2.5 × 8.5 m beside it.
- The largest room-shaped rectangle that avoids the stair is 22.5 m², so f = 0.75. QA's "about 23 m²" is this rectangle.
- No range above 0.75 can satisfy the acceptance line "QA's 30 m² room … lays out".

**Recommendation.**
- Use `retry: { fMin: 0.75, fMax: 1.25 }`. The `check` guard on the retried result is what makes the boundary safe: one boundary result failed `check` after rounding and was rejected.
- The alternative is to keep 0.77–1.23 and drop the QA case from the acceptance list.
- **TL decides (Q2).** Either way the number goes into `PC.C.LAYOUT.retry` and a new PM 4.4 row together ("Generator retry after no layout: cell scale 0.75–1.25 (first pass 0.8–1.2)"), and into A-8.
- The pinned no-layout cases stay failing under both ranges:
  - unit "one 80 m² room on the sample footprint";
  - QA F3-T1 B, "80 m² on the First floor".

**Tests.**
- the QA case lays out (both orientations), and its result passes `check`;
- the sweep prints "former failures recovered: a of b", and every success passes `check`;
- the sample and every fixed layout case are deep-equal to the stored F3-T1 output (golden JSON in the test);
- a failing maximum level (8 rooms + lift, area-valid, no layout; I will pin one that reaches the retry) stays under 600 ms in node, best of 3 (A-16).

## 11. Rider: phone panel ≥ 14 px/m and one short-name rule (DP 2–3; QA obs 2)
- **The Designer does:** CSS A and C, the readout grids, `src/js/data/room-labels.js` (`PC.data.roomLabels`, manifest `data` layer) and the palette entries.
- **The FS does:**
  - **Fit margin 1.0 → 0.5 m (DP D).** This reverses the TL's F3-T1 ruling of 1.0 m, so the TL rules (Q7). If adopted, A-15 "Plan view" changes in the same step. My F3-T1 exact-fit assertion in `plans-view.spec` moves to 0.5.
  - **The tier rule (DP 3)**, replacing `SHORT` / `shortName`:
    - for each room, the lowest tier (full + area → full → short → tiny) whose text fits its box. This needs a generic `draw2d.labelFits(view, box, lines, o)` that returns whether a set of lines fits, using the existing `boxLabel` measuring;
    - each type on the level (master counted with bedrooms) takes the highest tier any of its rooms needs, and all of them are drawn at it;
    - the area line appears for all of a type or for none;
    - tiny uses `font.roomSmall`;
    - the stair and lift use their own table rows.
  - `planLabels()` keeps its shape. DP 7.4 reads the tier from the label text.
  - Labels are computed with the transient rectangle during a drag. That is cheap: at most 8 rooms.

## 12. Stage 4 (Q18–Q19) and stage 5 gating (F3-S4)
- **`ui/stage-interior.js`**, registered with `ui.shell.register(4, { enter, render })`:
  - the radios in `q-interior-style` and `q-interior-density` commit on `change` with a plain `commit` (appearance class, A-7);
  - render sets `:checked` from `state.ans.interior`, defaults Modern / Full (4.1, already in `defaults()`);
  - a cancelled or replaced state re-renders.
  - Once stage 4 has a controller, the shell's "not built yet" notice no longer shows on stage 4.
- **What stage 4 shows until F3-T3:**
  - the markup's lead line and the two card groups with the Designer's placeholder hint pictures (DP 5);
  - F3-T3 may replace the hint pictures with look-table data. Stage 4's wiring does not depend on that data, so nothing waits;
  - F3-S4's "small visual hint" is accepted at F3-T3, as F3-plan says.
- **Stage 5:**
  - `PC.stages.MAX_BUILT` 3 → 5. "Build 3D model" (the stage-4 Next, label already in `PC.stages.TEXT`) runs `PC.store.go(5)`;
  - stage 5 has no controller, so the shell shows "This stage is not built yet: static preview" above the static markup;
  - Next is hidden on stage 5 and Back returns to stage 4. Changing Q18 / Q19 there keeps every approval (A-7 appearance class; unit-proved in `signature.test`).
  - The F3-plan wording "the '3D not built yet' placeholder state already in the markup" is this shell notice. The markup has no other placeholder (`v3-unavailable` is the WebGL-failure card).
- **Skip to 3D** (`skipTarget` = highest reachable) now lands on stage 5 (the notice), not stage 3. That is closer to G3's "Skip to 3D" and changes QA expectations (section 15). The alternative is to keep `MAX_BUILT` at 4 and show "Build 3D model" disabled with "Not available in this build yet". That would not "open stage 5" as F3-plan says. TL decides (Q8).

## 13. Store / draft impact
- **No schema change.** The plan shape `{ sig, rooms, unmet, edited, approved, error }` is unchanged:
  - edits write rectangles and flags that `PC.draft.parse` already accepts (finite numbers, w / h > 0, ids on the level);
  - overlaps, the one-time note and the drag are derived or session-only.

  `PC.DRAFT_V` stays 2, so there is no A-4 migration. If the TL wants overlaps refused at parse, that would still not be a schema change; I do not recommend it, because a draft saved mid-edit with an overlap is legitimate.
- **Session-only additions** (not saved): the editor's drag, the selected room, and the one-time-note marker. They are reset by `replace` (existing subscriber) and by tab changes.
- **Commit cost:**
  - one commit per release, Approve, un-approve or Regenerate, none during a drag (rider);
  - autosave stays a 400 ms debounce after the commit.
  - I will log the release-to-paint time for the maximum house in the e2e spec, and measure further only if it feels slow (rider).
- **Unchanged:**
  - `PC.store.atRisk` / `affected`, the gate text, `go(3)`;
  - `sync` (an edited plan with a matching signature is kept as is).

## 14. Tests (FS files; focused runs while developing; full run before hand-over)
**Unit, `tests/unit/plans-edit.test.mjs` (new):**
- **snapEdge:**
  - an edge released 0.2 m from a neighbour's edge lands exactly on it, restoring the shared wall (`adjacent` true, the pair leaves `unmet`);
  - the same from the stair, from the lift and from the footprint edge;
  - at 0.4 m it goes to the grid;
  - a neighbour 0.25 m away beats a grid line 0.05 m away;
  - equal distances pick the lower value;
  - candidates outside the limits are skipped;
  - all of it repeated in ft mode (grid 0.3048 m) on the sample (its 0.5 m edges are off the 1 ft grid), and in m mode on the pinned off-grid case W 7 × D 16.5 from `layout.test`.
- **moveRect / resizeRect:**
  - the clamp at each footprint side;
  - the minimum side for each of the 8 handle kinds;
  - a corner moves two edges, an edge handle one;
  - the opposite edge never moves;
  - the result is rounded to 0.01;
  - live equals release (the same input gives the same rect).
- **applyEdit:**
  - `edited` and approval cleared, `wasApproved` reported;
  - `unmet` recomputed (break a sample pair, restore it);
  - other levels deep-equal;
  - a no-op rectangle is not committed (controller test through the store).
- **problems / canApprove / approve:**
  - room–room and room–core overlaps found at 0.02 m, not at 0.01 m;
  - approve refused with the reason while an overlap exists, and refused for `error` or stale plans;
  - approve then edit → Draft;
  - the invariant "approved ⇒ no overlaps" holds through every operation;
  - un-approve.
- **Regenerate predicate:** it asks for edited, for approved and for both, and not for an untouched Draft.
- **Clear sentence:** `plansSentence(atRisk(clearCandidate), [])`:
  - sample right after Load → '';
  - one approved level → names only it;
  - after Skip → names both.

**Unit, `layout.test` / `layout-sweep.test` (extended):** the retry cases of section 10. The sweep's existing assertions stay, and it adds the "recovered" line.

**Unit, `stages.test`:** MAX_BUILT default 5; Skip target 5 for the clean sample.

**E2E, `tests/e2e/plans-edit.spec.mjs` (new).** Viewports: touch at 360x640 and 640x360, mouse at 1280x800. Gestures through `tests/helpers/touch.mjs` (`drag`, `two`, `tap`) and Playwright mouse.
- Move a room; each handle kind (n, s, e, w and one corner per viewport); the readout updates live in m and in ft.
- A room stops at the footprint edge.
- An overlap is highlighted on release (state via `PC.debug`, pixel at the room centre in `invalidFill`), and Approve is refused with the reason.
- The stair is not draggable (a drag on it pans).
- A broken pair warns, and Approve still works once there are no overlaps.
- Counter and tab badges; Next locked until all are approved; the one-time back-to-Draft note.
- No page scroll during a drag (`scrollY` and `visualViewport` unchanged).
- Handles are hit-testable at 44 px: a press 20 px off a handle centre on touch grabs it, and a press 12 px off with a mouse does not.
- A second finger cancels the edit; `PC.store` history shows no commit during the drag.
- Reload keeps the layouts, edits and approvals.
- Drawn vs asked text "39 m² (asked 42 m²)".

**Keyboard (1280x800):**
- Tab to the plan tabs; arrows change the level;
- Tab to Approve, Enter approves; Enter on "Approved" un-approves (if Q6 keeps the toggle);
- Regenerate → dialog → Esc cancels and focus returns;
- stage 4 radios by arrows, then Enter on "Build 3D model".

**Stage 4 (in `plans-edit.spec` or a small `interior.spec.mjs`):**
- locked before every level is approved;
- shows exactly Q18 and Q19 with the defaults;
- a change commits and keeps approvals and signatures;
- "Build 3D model" opens stage 5 with the notice; Back works.

**E2E, `tests/e2e/r5.spec.mjs` (new; every F3-plan R5 scenario).** Steps marked † are mouse-only:
- with approved plans, change a first-floor room → one confirmation; only First returns as a new Draft, while Ground keeps its edits and approval;
- Cancel on a setback change restores the value and nothing resets;
- plot vertex drag → confirm → Cancel returns the vertex (pixel and state). Repeated on touch at 360x640;
- a vertex move that keeps the footprint size asks nothing;
- a back-setback change that only moves the footprint asks nothing, every level keeps its edits and approval, and the preview shows the building moved;
- a Q6 change asks and resets every level;
- a Q10 change asks nothing and keeps approvals;
- the next visit asks again after returning to stage 3;
- Clear with an approved plan shows one dialog with the plans sentence; Cancel keeps everything;
- reload keeps layouts and approvals.

**Designer's `plans-phone.spec.mjs`:** theirs (DP 7). I run it in the full run.

**Timing:** three new specs at about 40–60 s each. The full run was 523.7 s. If it passes 10 minutes, I raise the A-16 trigger with the TL instead of trimming silently.

## 15. Mutation checks (each new test: remove the fix, see it fail, restore)
| Mutation | Caught by |
|---|---|
| snapEdge prefers the nearer grid line over a neighbour within 0.3 m | unit "neighbour beats grid" |
| neighbour threshold 0.3 → 0.5 | unit "0.4 m goes to the grid" |
| ft grid replaced by 0.5 m | unit ft case |
| clamp removed on one side (x + w ≤ W) | unit clamp, plus e2e "stops at the footprint edge" |
| min side 1.5 → 1.0 | unit min side |
| `applyEdit` keeps `approved` | unit, plus e2e back-to-Draft note |
| `applyEdit` does not recompute `unmet` | unit pair restore, plus e2e warning |
| `canApprove` ignores `overlap-core` | unit core overlap |
| commit on every `onDragMove` | e2e "no commit during a drag" |
| hit radius 22 → 10 on touch | e2e 44 px handle check |
| handles inside a small room (no outward offset) | e2e small-room handle (sample Bathroom 2 × 2 m at 360x640) |
| Regenerate asks only when `edited` (F3-T1 rule) | unit predicate, plus e2e approved-only regenerate |
| Clear dialog uses `affected` instead of `atRisk` | unit "after Load sample → ''" |
| retry always runs (not only on failure) | golden sample / fixed cases |
| retry result not passed through `check` | unit boundary case (the one sweep programme rejected by `check`) |
| stage 4 Q18 change via `propose` / sig touched | `signature.test`, plus the stage-4 e2e "keeps approvals" |
| MAX_BUILT left at 3 | stages unit, plus the stage-4 e2e "Build 3D model opens 5" |
| tier rule per room instead of per type | DP 7.4 (Designer spec) and a unit check on the tier choice |

## 16. Acceptance map
| Criterion | Where |
|---|---|
| F3-S2 drag / resize edges and corners with snap, live dims and area in the unit | sections 1, 2, 7; plans-edit unit + e2e |
| F3-S2 cannot leave the footprint, ≥ 1.5 m per side | section 4; unit clamp + e2e |
| F3-S2 overlap allowed while dragging, invalid on release, blocks approval | sections 3, 6; unit + e2e |
| F3-S2 stair and lift fixed | section 1 hit test; e2e |
| F3-S2 broken pair warns, does not block | section 5 `unmet`; e2e |
| F3-S2 one level never changes another | unit deep-equal |
| F3-S2 touch: one finger drags, ≥ 44 px handles, two fingers pan / zoom, no page scroll, works at 360 px | section 1; e2e touch 360x640 / 640x360 |
| F3-S3 Approve per level, tab state, "n of m" | section 6; e2e |
| F3-S3 refused with reason while overlaps exist | sections 3, 6; unit + e2e |
| F3-S3 editing an approved level → Draft, told once | sections 5, 6; unit + e2e |
| F3-S3 Next disabled until all approved | `PC.stages` (existing); e2e |
| F3-S4 stage 4 locked until approved, exactly Q18 / Q19 with defaults | section 12; e2e |
| F3-S4 "Build 3D model" opens stage 5 | section 12 (static stage 5 until F4) |
| F3-S4 change Q18 / Q19 after 3D, approvals kept | section 12; signature unit + e2e. "Updates the furniture" waits for F4. |
| F3-S4 visual hint final look | **F3-T3** (excluded here per F3-plan) |
| F3-S1 Regenerate asks if edited (round 5: or approved), clears that level only | section 8; unit + e2e |
| R5 all, observable result on return to stage 3 | section 9; r5.spec |
| F1-S3 R5 on vertex release (Cancel returns the vertex) | section 9; r5.spec mouse + touch |
| Rider: Clear's plans sentence (atRisk, one dialog) | section 8; unit + r5.spec |
| Rider: gestures stated | section 1 |
| Rider: no commits during a drag | sections 1, 13; e2e |
| Rider: phone ≥ 14 px/m, one short-name rule | section 11 + DP; Designer spec |
| Rider: retry on failure only | section 10; unit |
| Rider: drawn vs asked readout | section 7; e2e (PM wording) |
| Rider: off-grid edges snap on release | section 2; unit |

## 17. QA files likely affected (QA owns `tests/qa/`; I do not edit it)
Suggested marker for version-aware branches: `typeof PC.plans.approve === 'function'`, or `PC.stages.MAX_BUILT >= 5`.
- **`f3-t1-stage3.mjs`:**
  - line 46 expects Approve disabled with the "plan editing" message;
  - D expects "Skip lands on stage 3" (now 5);
  - A asserts ≥ 12 px/m (still true; ≥ 14 with the DP);
  - the label check accepts "an abbreviation of the name", which still holds for the tiny forms "B2" / "Ba" if its rule allows one-letter forms — QA to confirm;
  - the counter is visually hidden on phones.
- **`f1-t2-flows.mjs`:**
  - E "Skip lands on stage 3 = highest built stage" (now 5);
  - the stepper strings (`CaaLL` …) where stage 4 / 5 reachability changes;
  - D "stage 4 (no controller): notice shown" — stage 4 has a controller now; stage 5 keeps the notice;
  - L3 / Back after Skip.
- **`f2-t2-questions.mjs`:** line 383 (Next on stage 2) is unchanged; review any "highest built stage" text.
- **`f1-t3-plot.mjs`:** B Clear dialog. Title and buttons are unchanged; the text gains a sentence only with edited or approved plans. With a clean sample it is unchanged.
- **`f3-t1-plans.mjs`:**
  - sweep notes (no-layout counts drop slightly with the retry; its "my search found a layout in N" note shrinks);
  - the max-level timing is unchanged.
- **`f1-t1-layout.mjs`:** static mocks (`s3-max` already uses the "Rooms overlap…" text and `is-approved`). Its layout checks may see the hidden counter and the re-gridded readout from the Designer CSS.
- **`session.mjs`, `inpage.js`, `stage2kit.mjs`:** use `Math.max(MAX_BUILT, 3)` or set 5, so no change is expected.

My own specs that change:
- `plans-view.spec` (Approve message, fit margin);
- `shell.spec` (MAX_BUILT 5 default, Skip target, stage 4 banner);
- `stages.test`, `plans-sync.test`, `plan-banner.spec`, `plan-tabs.spec` (MAX_BUILT pins).

## 18. Risks
- **R1 — the retry range does not meet its own acceptance case at 0.77** (section 10). This needs a TL decision before implementation.
- **R2 — small rooms on phones.** At 14–15 px/m a 2 × 2 m bathroom is about 30 px. The outward handles (DP) keep the targets separate, but neighbouring rooms' handles can sit over each other. Only the selected room has handles, so a press resolves to the selected room first. A hard-to-grab room can be reached by pinch-zooming.
- **R3 — corners.** The F3-plan / story asks for corners; DP draws edge handles only (Q3).
- **R4 — Skip and stage 5.** Skip now lands on a static stage with a notice. The client will see this on the republish (Q8).
- **R5 — run time.** Three new e2e specs plus the Designer's may push the full run near the 10-minute A-16 trigger.
- **R6 — Clear then an identical redraw keeps the plans** (section 8 nuance). This is A-7 as designed, but the dialog says "regenerated".
- **R7 — the F1 real-device gate is still OPEN** and must be answered before F3-T2 sign-off (RESUME). Stage 3 editing by touch is now the main thing the client will judge on a phone.
- **R8 — `-0` in generated coordinates** (the sample's Dining has x = −0). It is harmless in JSON and in `check`. `applyEdit` rounding normalises it; noted so nobody chases it.

## 19. Questions for the TL (and the PM / Designer where named)
1. **PM wording:**
   - readout "39 m² (asked 42 m²)";
   - the overlap reasons (section 3);
   - the back-to-Draft note, the approved messages (section 6);
   - the Regenerate texts (section 8);
   - the Clear sentence, reusing `plansSentence`.
2. **Retry range:** 0.75–1.25 with the `check` guard (meets the QA case, recovers 12 of 45), or 0.77–1.23 as ruled (recovers 6 of 45; the QA case is dropped)?
3. **Corners (Designer):** corner targets at the selection corners with a small drawn mark (a new palette entry), or no corner resize (an F3-S2 / F3-plan deviation)?
4. **Keyboard room editing:** confirm it is out of scope (R2 is controls only), or schedule a no-canvas room list (it needs a markup hook from the Designer).
5. **Aspect over 3:1 after an edit:** no warning (recommended), or a non-blocking warning line?
6. **Approve toggle:** pressing "Approved" un-approves (recommended), or the button is inert once approved?
7. **Fit margin 1.0 → 0.5 m (DP D):** it reverses the F3-T1 ruling; adopt it, and update A-15?
8. **MAX_BUILT 5** (Skip lands on the static stage 5 with its notice), or 4 with "Build 3D model" disabled until F4?
9. **Neighbour snapping:** count any parallel edge (A-15 literal, including alignment with rooms that do not touch), or only edges whose span overlaps?
