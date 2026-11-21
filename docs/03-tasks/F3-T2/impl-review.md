# F3-T2 implementation review — Tech Lead

## Round 1 — 2026-11-21

### What I did
- **Code read:**
  - `core/plans.js` editing part (`ctx`, `edgeCands`, `snapEdge` with the ruling-9 span rule, `moveRect`, `resizeRect`, `applyEdit`, `problems`, `canApprove`, `approve` / `unapprove`, 0.01 m rounding incl. `-0`);
  - `ui/plan-editor.js` (hit order, outward handles under 66 px, one commit on release, cancel on a second finger / lost pointer, ghost and guides);
  - the stage-3 wiring of Approve / toggle and messages;
  - `stage-interior.js`.
- **Corner resize** is absent by product decision: PM round 6 amended F3-S2 to "by its edges" (corners possibly F5-T3). That supersedes my plan-review ruling 3. Accepted.
- **No full run** while the Designer works. The FS reports: full run exit 0 in 494.9 s (under 10 min); unit 317, plans-edit 108, r5 54, plans-phone 118; 22 mutation checks caught.
- **Own touch probe at 360x640** (sample, stage 3, Ground floor, CDP touch):
  - **Scale:** 14.25 px/m with the sample strip.
  - **Select:** a tap on Living shows "Living | … | 39 m² (asked 42 m²)".
  - **Resize:** dragging its east edge about 25 px left gives w 7.0 → 5.0 m (snapped), `edited` true, no overlap, default hint shown.
  - **Move:** dragging the body 3 m towards the street gives 2 overlaps. The message reads "2 overlaps on this floor. Move or resize the marked rooms to approve it."; Approve is refused and the floor stays Draft.
  - **Regenerate:** asks "Your manual edits to the Ground floor will be lost. It will be laid out again from the room list."; Continue gives `edited` false and 0 overlaps.
  - **Approve:** `approved`, `aria-pressed="true"`, "Ground floor approved.", counter "1 of 2 floors approved".
  - **Toggle:** tapping "Approved" again gives Draft, `aria-pressed="false"`, "Ground floor is back to Draft."; approved again for the next step.
  - **R5 end to end:** Back to stage 1 and drag the corner (20, 30) 3 m. The R5 dialog appears; Cancel returns the vertex exactly and Ground stays approved.
  - No page scroll, no errors.

### Assessment
- The editor meets F3-S2 / F3-S3 as amended in round 6:
  - pure, tested edit operations; the canvas controller only translates gestures;
  - hard clamps to the footprint and the 1.5 m side;
  - overlap allowed while dragging and marked on release;
  - stair and lift never hit;
  - one commit per release; edits clear approval and recompute pairs.
- **Snapping** follows ruling 9: room edges only within the span plus 0.3 m; core and footprint always.
- **Stage 4** commits Q18 / Q19 with plain `commit` (appearance class).
- **`MAX_BUILT` 5**, and stage 5 keeps its banner.
- **The generator retry** is as ruled: golden JSON 0 of 2 355 successes changed; 12 of 45 failures recovered; QA's case 5 x 4.5 m; the boundary case pinned; the failing maximum level under 600 ms.
- No schema or markup change.

### Rulings on the Designer notes
- **(a) Floors with warnings draw at about 13.3 px/m on phones,** because the 44 px warnings button sets the message-row height. **Accepted.** The ≥ 14 px/m target applies to a floor without warnings (the sample). With warnings the floor must stay at **≥ 13.0 px/m**, asserted in `plans-phone.spec.mjs`. The fixed-height message line now in flight should make both the same; if it does, assert ≥ 14 for both.
- **(b) The provisional scale check:** the Designer tightens it to the numbers above as part of the in-flight change.

### Non-blocking note (routed to the PM for wording)
The generic R5 gate dialog still says "Manual room edits and approvals on that level will be lost." even when the floor only has an approval (my probe: Ground approved, not edited). The round-6 correction already names only what a level has for Clear and the other own-confirmation dialogs. The gate could reuse the same per-level wording, e.g. "Floor plans for Ground floor will be regenerated, with its approval." PM to confirm; FS changes one string builder if so. QA records it as an observation.

### Conditions before QA starts (in flight; I check them in a short addendum, focused runs only)
1. Designer: the Approved button colour (`aria-pressed` style no longer overrides `is-approved`).
2. Designer: a fixed-height phone message line, so the canvas never resizes when the message changes. The FS's freeze of the message during drags may then go or stay, whichever is simpler.
3. Designer: the stage-4 checks in its spec.
4. PM: confirms the default hint "Drag a room to move it; drag an edge to resize."
5. The focused run is green with those changes, followed by one full run that exits 0.

### For QA (F3-T2 focus)
1. **Editor by touch** (360x640, 640x360) and mouse (1280x800):
   - select by tap;
   - move;
   - resize by each of the four edges, with live readout in m and ft, incl. "drawn (asked …)";
   - a room stops at the footprint edge and at 1.5 m;
   - handles of rooms under 66 px sit outside with 44 px targets;
   - the stair and lift cannot be dragged (a drag there pans);
   - a second finger cancels an edit;
   - two fingers pan / zoom;
   - no page scroll;
   - no store commit during a drag, exactly one on release.
2. **Snapping** (your own oracle):
   - neighbour edge within 0.3 m beats the grid;
   - only rooms whose span overlaps (± 0.3 m), plus core and footprint, are candidates;
   - 0.4 m goes to the grid;
   - ft grid 1 ft;
   - a shared wall is restored and the pair leaves the warning list.
3. **Overlap and approval:**
   - overlaps are marked on release with the PM texts (one pair, core, several);
   - Approve is refused with that text;
   - Approve then edit → Draft, with the one-time note;
   - the "Approved" toggle with `aria-pressed` and its message;
   - counter and tab badges;
   - Next to Interior locked until every floor is approved;
   - the invariant "approved ⇒ no overlaps" through every operation, incl. reload.
4. **Regenerate and Clear:**
   - Regenerate asks only when edited or approved, with the PM texts (edited / approved / both), and clears that level's approval only;
   - an untouched Draft regenerates at once;
   - Clear's dialog names only what each floor has, and has no sentence when nothing is at risk.
5. **R5 end to end** (round-5 rule):
   - after Load sample nothing asks;
   - with edits or approvals the gate asks once per visit, naming the levels;
   - only the changed levels return as new Drafts;
   - a move-only setback change keeps everything;
   - Q6 resets all;
   - Q10 keeps approvals;
   - a stage-1 vertex drag → dialog → Cancel returns the vertex (touch and mouse);
   - reload keeps edits and approvals.
6. **Stage 4 / 5:**
   - stage 4 is locked before all approvals;
   - exactly Q18 / Q19 with defaults;
   - a change keeps approvals and signatures;
   - "Build 3D model" opens stage 5 with an unmissable "not built yet" banner;
   - Skip to 3D lands there;
   - Back works.
7. **Phone panel:**
   - ≥ 14 px/m on the sample at 360x640 with the strip, and at 640x360;
   - ≥ 13 px/m on floors with warnings (or 14 once the fixed message line lands);
   - compact counter visible;
   - readout values on one line in m and ft;
   - message line height constant;
   - labels by `PC.data.roomLabels`, one tier per type per level, every room labelled at the default fit.
8. **Generator retry:**
   - every first-pass success is unchanged;
   - recovered failures pass your oracle;
   - QA's 30 m² case lays out;
   - timing.
9. **Runtime:** if the full run passes 10 minutes, trim duplicate viewport coverage in this round (A-16).

VERDICT: APPROVED

---

## Addendum — 2026-11-21 (the five in-flight items)

### What I did
- **Focused run:** interior 50/0, plans-phone 172/0, plans-edit 110/0, r5 54/0.
- **Re-ran my 360x640 touch probe:**
  - Scale is 14.25 px/m, and the hint reads in one line.
  - The Regenerate text is as before.
  - The stage-1 vertex drag now asks "The floor plan of the Ground floor will be regenerated, with its approval." That names only what the floor has.
  - Cancel returns the vertex, and Ground stays approved.
  - No errors, no page scroll.

### Items
| # | Item | Status |
|---|---|---|
| 1 | Approved button colour | Done (`is-approved` green wins over the `aria-pressed` tint; the spec waits for the colour transition) |
| 2 | Fixed-height phone message line | Done (32 px on phones, 44 px on tablets; the longest texts fit in two lines; the canvas no longer resizes, so the FS's drag-time freeze is removed) |
| 3 | Stage-4 checks | Done (`interior.spec` 50/0) |
| 4 | PM default hint | Done; the PM's longer text is used |
| 5 | Runs | Focused green. FS full run 495 s with only QA's two `f2-t1-site.mjs` lines on the old R5 wording failing; QA is fixing them and will run the full suite |

The general R5 dialog now uses the same sentence builder as Clear and the remove-floor dialog. That closes my non-blocking note; 4 mutations were caught.

### Rulings
- **The 360 px hint fits with 4 px to spare (332 of 336 px): accepted.** A wider system font on a real phone would wrap it to a second line. The fixed-height message line holds two lines, so wrapping cannot resize the canvas or clip the text. QA keeps the two-line case in its phone checks. No shorter wording is needed.
- **The warnings chip floats over the canvas's bottom-left corner (44 x 57 px + 8 px inset) and is not avoided by the fit: accepted.**
  - Keeping it out of the fit would make the plan jump when warnings come and go, which is worse.
  - At the default fit on the sample, that corner is the plot margin, not the footprint.
  - Where it does cover a room, a pan or a tap elsewhere reaches it, and the chip itself is 44 px.
  - QA records any default-fit case where the chip covers a room's label as an observation for the Designer's F5-T3 pass.

### Required changes
None. QA may start after its two line updates and a green full run.

VERDICT: APPROVED
