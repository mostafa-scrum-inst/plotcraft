# F3-T2 QA report — QA Tester

## Round 1 — 2026-11-21

Scope: F3-T2, the plan editor, approval, the interior stage and the generator retry. I tested it against:
- the Tech Lead's 9-item "For QA (F3-T2 focus)" list (`impl-review.md`, round 1 and its APPROVED addendum);
- `plan.md` and `plan-review.md`, including the orchestrator note: no corner resize;
- stories F3-S2, F3-S3, F3-S4 and R5;
- the PM's round-6 texts;
- A-8 (retry 0.75–1.25, only after a failed first pass, with the `check` guard);
- A-15 (fit margin 0.5 m; neighbour snapping only for spans that overlap, ± 0.3 m).

Before this round I updated the general R5 wording checks in `f2-t1-site.mjs` (round-6 sentence builder). The full run then exited 0 in 498.1 s.

### What I tested and how

**`tests/qa/f3-t2-ref.mjs`: QA's own oracle.** It imports no app code. I wrote it from A-15 (TL ruling 9), PM 4.3 / 4.4 and F3-S2:
- **Snap order.** An edge first snaps to the nearest candidate within 0.3 m (ties: the lower value). Candidates:
  - parallel edges of other rooms, if their span overlaps the moving edge's span widened by 0.3 m at each end;
  - the stair and lift edges;
  - the footprint edges.
  Without a candidate, the edge snaps to the nearest grid line inside its limits (0.5 m, or 1 ft from the footprint origin).
- **Limits are hard clamps.** Rooms stay inside the footprint, and a resize keeps each side at 1.5 m or more. The clamp comes first, then the snap.
- **A move:** on each axis, the edge with the nearer neighbour decides (the low edge on ties); otherwise the edge that needs the smaller grid shift.
- **Rounding:** 0.01 m.
- **Overlap:** more than 0.011 m on both axes.
- **Adjacency (A-8):** touching within 0.02 m along 0.5 m or more.

**`tests/qa/f3-t2-edit.mjs`** (node, about 2 s):
- **Seeded sweep:** 14 560 edits (5 600 moves, 8 960 edge resizes). They run on 40 sample variants: m / ft, 5 stair positions, with and without lift, footprint 25 / 40 %, both levels. Each app result is compared with my oracle and with the hard limits.
- **Targeted snapping cases:**
  - a neighbour within 0.3 m beats the grid;
  - a span 0.4 m beyond the moving edge's span is ignored;
  - a neighbour 0.4 m away gives way to the grid;
  - a neighbour 0.25 m away beats a grid line 0.05 m away;
  - an off-grid neighbour;
  - ties;
  - the 1 ft grid;
  - stair and footprint edges are always candidates.
- **Shared wall:** the sample First-floor pair is broken by a 1 m move, then restored by a drag back to 0.2 m off.
- **2 400 random operations** (edit, no-op release, approve, un-approve, regenerate) in 60 runs. After every one:
  - `applyEdit` flags are right;
  - `unmet` matches my adjacency;
  - other levels and other rooms are untouched;
  - `problems` / `canApprove` equal my overlaps;
  - the invariant holds: approved means no overlaps (by my overlap), a current signature and no error. It also holds across a draft round trip.
- **Edge cases:** overlap at 0.02 m versus 0.01 m; a room over the stair; stale and no-layout plans.

**`tests/qa/f3-t2-editor.mjs`** (browser, about 35 s). Real CDP touch at 360x640 and 640x360, mouse at 1280x800. The expected rectangles come from my oracle; the pointer's sub-pixel rounding is allowed for (± 0.04 m).
- **Select and readout:**
  - select by tap;
  - readout "39 m² (asked 42 m²)";
  - every room is labelled at the default fit, on both floors, in m and ft.
- **Editing:**
  - a move with no commit while the finger is down, a live readout, and exactly one commit on release;
  - a resize by each of the four edges, including a footprint stop and a 1.5 m stop;
  - the edge handles sit where I compute them (outward on rooms under 66 px; no corner handles);
  - touch press 18 px off a handle grabs it; a mouse press 14 px off does not;
  - in ft: a live readout, the 1 ft grid, each readout value on one line.
- **Gestures and page:**
  - a drag on the stair pans, with no commit;
  - a second finger cancels a move;
  - pinch zooms;
  - the page never scrolls or zooms.
- **Overlaps:**
  - not marked while dragging;
  - marked on release (pixel check) with the PM texts for one pair, two overlaps and the stairs;
  - Approve is `aria-disabled` and pressing it refuses with the reason.
- **Regenerate:** the texts for edited / approved floors; an untouched Draft regenerates without a dialog.
- **Approval:**
  - Approve, then an edit gives the back-to-Draft note once; the next edit shows the default hint;
  - the "Approved" toggle;
  - counter, tab badges, Next and the stage-4 lock;
  - "All floors approved. Next: Interior.";
  - reload + Resume keeps the plans exactly.
- **Stages 4 and 5:**
  - stage 4 shows exactly Q18 / Q19 with defaults Modern / Full and no notice;
  - a change keeps every plan;
  - "Build 3D model" opens stage 5 with the notice in view;
  - Back returns to stage 4.
- **R5** (phone and desktop):
  - a First-floor room change asks once, naming only "the First floor … with its approval"; only First returns as a Draft, and Ground keeps its edits and approval exactly;
  - a Q10 change asks nothing;
  - a stage-1 vertex drag asks, naming the Ground floor, and Cancel returns the vertex (state and pixel).
- **Phone panel:**
  - the message line stays 32 px at 360x640, and the canvas never changes size because of a message;
  - a floor with a broken-pair warning is still fitted at ≥ 14 px/m.
- The F1-T1 layout rules run on stage 3 with an overlap, stage 4 and stage 5 (no page scroll, 44 px targets, nothing clipped, contrast).

**`tests/qa/f3-t1-plans.mjs` section 7 (new), retry:**
- My 30 m² room on 5 x 8.5 m with a front-left stair lays out only through the retry, in both orientations, and passes my oracle.
- A failing maximum level (8 rooms + lift) answers in under 1 ms (limit 600 ms).
- Section 4 (from the version-aware round) already checks every first-pass success over 2 000 programmes: each is unchanged with the retry in place, and every retried success passes my oracle.

**Runner:** `tests/qa/run-f3-t2.mjs` (exit code, `--no-shots`). Screenshots are in `tests/qa/shots/F3-T2/`.

**Mutation proof** (each on a throwaway copy, `/tmp/pc-m10`; every one was caught):

| Mutation | Caught by |
|---|---|
| neighbour snap 0.3 → 0.5 m | edit 1 |
| span filter removed | edit 1 |
| ft grid → 0.5 m | edit 1 |
| `applyEdit` keeps the approval | edit 4, editor 7 |
| `unmet` not recomputed | edit 3, 4 |
| `canApprove` ignores core overlaps | edit 4, editor 6 |
| commit on every drag move | editor 2 |
| handles inside small rooms | editor 3 |
| touch hit radius 22 → 10 | editor 3 |
| Regenerate asks only when edited | editor 7 |
| a Q18 change clears an approval | editor 8 |
| `MAX_BUILT` 3 | editor 7 / 8 |
| east clamp removed | edit 1, editor 3 |
| minimum side 1.0 | edit 1 |

### Results per focus item
1. **Editor by touch and mouse: met.** Select, move and resize by each edge with a live m / ft readout; footprint and 1.5 m stops; outward 44 px handles on small rooms; the stair pans; a second finger cancels; pinch; no page scroll; no commit during a drag and exactly one on release. All 3 viewports pass. One exception: bug 1 (an edge dragged past its limit).
2. **Snapping: met for every edit that stays inside its limits.**
   - All 14 560 seeded edits inside the limits equal my oracle.
   - The targeted cases pass: neighbour beats the grid, span ± 0.3 m, 0.4 m goes to the grid, ties, 1 ft grid, stair / footprint.
   - The shared wall is restored and the pair leaves the warning list.
3. **Overlap and approval: met.**
   - The PM texts for one pair, the stairs and several overlaps are correct.
   - Approval is refused while an overlap exists.
   - The back-to-Draft note shows once.
   - The toggle with `aria-pressed` works.
   - Counter, badges and the Next / stage-4 lock are correct.
   - The invariant holds over 2 400 operations and through reload.
4. **Regenerate and Clear: met.** The edited / approved / both texts are right, and only that floor's approval is cleared. An untouched Draft regenerates without a dialog. The Clear sentence names only what each floor has (`f1-t3-plot` B, `f2-t1-site` 9).
5. **R5 end to end: met.**
   - Nothing asks after Load sample (`f3-t1-stage3` A).
   - The gate asks once per visit, naming only the floors at risk and what they have.
   - Only changed levels return as Drafts.
   - Move-only and Q10 changes keep everything; Q6 resets all (node `f3-t1-plans` 5).
   - Vertex drag + Cancel works by touch and mouse.
   - Reload keeps edits and approvals.
6. **Stages 4 / 5: met.** Locked before all approvals; exactly Q18 / Q19 with defaults; a change keeps plans and approvals; "Build 3D model" opens 5 with the notice in view; Skip goes to 5 (`f1-t2-flows`); Back works.
7. **Phone panel: met.**
   - 14.25 px/m on the sample at 360x640 with the strip; 14.88 at 640x360.
   - ≥ 14 on a floor with a warning.
   - The compact counter is visible.
   - Readout values are on one line in m and ft.
   - The message line keeps its height.
   - Labels come from `PC.data.roomLabels`, one tier per type per level, and every room is labelled at the default fit.
8. **Generator retry: met.** First-pass successes are unchanged (2 000 programmes); recovered layouts pass my oracle; my 30 m² case lays out (only through the retry); a failing maximum level answers in under 1 ms.
9. **Runtime:** see the full run below; no trim was needed.

### Bugs
1. **Minor: a resize dragged past its limit stops short of the footprint edge in ft** (KNOWN in `f3-t2-edit.mjs`).
   - **What happens:** `resizeRect` passes the unclamped finger position to `snapEdge`, which measures the candidate distance from it. Once the finger is more than 0.3 m past the footprint edge (or past the 1.5 m limit), the footprint edge or the stair edge at the limit is no longer a candidate. The grid fallback then takes the last grid line inside.
   - **Where it shows:** in ft, every footprint that is not a whole number of feet; the sample's 9.5 x 15 m is affected. Dragging the east or back edge "to the wall" ends 5–6 cm short (9.45 of 9.5, 14.94 of 15). A room that is already flush with the back wall shrinks by 6 cm when its edge is dragged further out.
   - **How common:** 730 of my 8 960 seeded resizes, all in ft. In m the sample footprints are on the 0.5 m grid, so none occurred there; an off-grid m footprint would behave the same.
   - **Effect:** invisible at phone scale (under 1 px). It leaves a hall sliver, and "the room stops at the footprint edge" is not exactly true.
   - **Fix:** clamp `v` to `[lo, hi]` before snapping, as `moveRect` already does.

### Observations: correct by the plan, but an architect may find it odd (for PM / TL / Designer)
1. **A small room's handle can cover the stair.** On phones, a selected small room's outward handle (22 px) can lie over the stair. A press there resizes that room instead of panning. Seen at 360x640 and 640x360 with the Laundry beside the stair. This follows the hit order (plan R2), and the handle is drawn there, but the stair then looks draggable.
2. **One-finger pan is hard on phones.** It works only outside rooms. At the default fit on a phone the plan fills the canvas, leaving narrow margins. A user who tries to pan with one finger over the plan moves a room instead. There is no undo; only Regenerate resets the whole floor (out of scope per plan section 5).
3. **Stage 5 looks interactive.** It shows the View / Light / Tour bar, a Roof toggle and Reset view on an empty grey canvas. The notice above it is clear, but the controls invite taps that do nothing visible until F4-T1.
4. **The 1.5 m minimum is not reachable in ft.** A room shrunk to the minimum stops on the 1 ft grid, e.g. 1.71 m, unless a candidate is near; 1.5 m is 4.92 ft, off the grid.
5. **A move past the footprint uses a different span.** The app takes the neighbours' span at the finger position rather than at the clamped room (76 of 5 600 seeded moves; under 0.5 m difference). This is negligible, but it is not quite A-15's "the moving edge's span".
6. **Labels and handles overlap.**
   - While two rooms overlap, their labels overlap too ("Ldry" over "Bath").
   - In the ft screenshot, a selected room's handle pill covers part of the "Stairs" label.
   - Both are cosmetic, for the Designer's F5-T3 pass.
7. **Readout in landscape.** At 640x360 the readout shows "None selected / – / –" on three lines until a room is tapped. It is fine, but it spends side-panel space.

### Full run
`node build.mjs && node tests/run-all.mjs`: exit 1 in 584.0 s (under the 10-minute A-16 trigger, but close: + 86 s since the 498 s run before this round, mostly the new QA suites and the F3-T2 e2e specs; no trim needed yet).
- **QA suites, all green:**

  | Suite | Checks |
  |---|---|
  | F1-T1 | 185 + 2015 |
  | F1-T2 | 831 |
  | F2-T1 | 1143 |
  | F1-T3 | 1037 |
  | F2-T2 | 959 |
  | F3-T1 | 13 + 205 |
  | F2-T3 | 1136 |
  | F3-T2 | 9 + 190 |

  Every count is 0 failed. Unit and the other e2e specs are green too, including interior 50, plans-edit 110, plans-phone 172 and r5 54.
- **One failure, the FS spec `tests/e2e/edges.spec.mjs`:** 341 passed, then it crashed on a 30 s `locator.tap` timeout. Its `clearing` scenario tried to tap the "site-tap-mode = class" label while that label was "not visible".
  - Run alone right after, it passed 3 times out of 3 (501/0 each).
  - It also passed in the run before this round (501/0).
  - So I treat it as a flake in an F2-T3 spec. It is not an F3-T2 defect, and none of my checks touch it.
  - It is routed to the FS / TL (a visibility wait before the tap). The full run is therefore not green as delivered; a re-run is the coordinator's call.

### Verdict
All 9 focus items are met. One minor bug is open (bug 1, KNOWN); it is not a blocker for the prototype. The one full-run failure is a flake in an FS F2-T3 spec, unrelated to F3-T2; it does not change the verdict on F3-T2.

**Round 1 addendum: bug 1 fixed and confirmed.** `resizeRect` now clamps before snapping. My 14 560-edit sweep finds 0 of 8 960 resizes off my oracle (was 730, all in ft). I removed the KNOWN entry; `run-all --qa --only f3-t2`: 9/0 + 190/0 in 38.4 s.

VERDICT: PASSED
