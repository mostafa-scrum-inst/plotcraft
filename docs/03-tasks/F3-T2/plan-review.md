# F3-T2 plan review — Tech Lead (FS plan + Designer plan together)

## Round 1 — 2026-11-21

### What I read
- `docs/03-tasks/F3-T2/plan.md` (FS, sections 0–19).
- `docs/03-tasks/F3-T2/designer-plan.md` (Designer, sections 1–8).

Checked against:
- the F3-plan F3-T2 block and its riders: gestures, no commits during a drag, phone panel, generator retry, drawn vs asked, off-grid snap, Clear sentence;
- architecture A-7 (`affected` / `atRisk`), A-8, A-15 (`snapEdge`, plan view, fit);
- PM F3-S1 / S2 / S3 / S4, R5, and the round-5 table (R5 asks only for edited or approved plans);
- my F3-T1 outcome-review rulings.

Reading only; no runs.

### Assessment
Both plans are complete, well divided, and consistent with each other and with the architecture.

**Editor**
- View2D stays generic.
- A single `handleSpots` serves both drawing and hit testing.
- No commit while dragging; exactly one commit on release.
- Editing never goes through `propose`. That is right: an edit cannot change a signature.
- Hard clamps on the footprint and the 1.5 m side. Overlap is allowed while dragging, then marked on release and blocks approval.
- `applyEdit` sets `edited`, clears approval and recomputes `unmet`.
- The "approved ⇒ no overlaps" invariant is attacked through every operation.

**Snapping** is pure and live-equals-release, in both units.

**Regenerate** asks for edited or approved plans, matching `atRisk`'s predicate. **Clear** builds its sentence from `atRisk` (round 5).

**R5 end to end** has its own spec.

**Retry** runs on failure only, and every retried result passes `check`.

**Stage 4** is wired with plain `commit`.

**Data and visuals**
- No schema change.
- No new hooks.
- One new Designer data file (`room-labels.js`, `data` layer) plus palette entries.
- Clear landing order: Designer CSS and data first, then FS.
- The mutation list (18 cases) covers every new rule.

### Rulings on the FS questions
1. **PM wording:** the PM is confirming in parallel. The FS uses the PM's final texts (round-6 table) when they land. The plan's drafts serve until then. The F3-T2 hand-over quotes them from the PM table.
2. **Retry range: 0.75–1.25, with the `check` guard. My 0.77–1.23 is withdrawn.**
   - F3-S1's rule is "within 25 % of the requested area"; a room at exactly 0.75 x is within it.
   - `check` accepts `|a − r| / r ≤ 0.25` and rejects anything that rounds past it, as the FS measured: one boundary result rejected, which stays no-layout.
   - The range recovers 12 of 45 former failures (2 of 21 at ≤ 85 % fill) and meets QA's case.
   - Goes into `PC.C.LAYOUT.retry`, A-8 (updated) and a PM 4.4 row ("Generator retry after no layout: cell scale 0.75–1.25; first pass 0.8–1.2"), routed to the PM.
3. **Corners: required.** F3-S2 says "resize it by its edges/corners", and the F3 plan says 8 handles.
   - Corner targets at the selection-outline corners, with the same 22 / 10 px hit radius.
   - Drawn as a small square mark (8 x 8 px), using the existing `state.handleFill` with the new `state.handleStroke`. **Designer adds `line.handleCorner` (or reuses `line.handle`) and states the mark in DP 4.**
   - On a room under 66 px in a direction, the corners of that axis move outward with the edge handles, as the plan says.
   - Hit order as planned: corners, then edges, then body.
4. **Keyboard room editing: out of scope.** R2 is basic keyboard on controls, and F3-S2 names touch and mouse. Keyboard covers the tabs, Regenerate, Approve, dialogs, stage-4 radios and Back / Next, as planned. Logged as a known limit in the outcome.
5. **Aspect over 3:1 after an edit: no warning.** F3-S2 lists only the footprint and the 1.5 m side for edits. The drawn-vs-asked readout tells the user about size.
6. **Approve toggle: approved.** Pressing "Approved" returns the floor to Draft (nothing is lost, no dialog).
   - The button carries `aria-pressed` ("true" when approved), so the toggle is announced.
   - Un-approving clears `sampleClean` like approving does.
7. **Fit margin 1.0 → 0.5 m: approved** (it reverses my F3-T1 ruling). The setback band still shows, and pan, zoom and Fit view reach the rest. A-15 updated. The FS moves its exact-fit assertion to 0.5.
8. **`MAX_BUILT` 5: approved.**
   - "Build 3D model" opens stage 5, as F3-S4 says. Stage 5 shows the existing static-preview banner until F4-T1.
   - Skip to 3D lands there. The banner must remain the unmissable "not built yet" notice (F1 lesson). QA checks it at 360x640.
9. **Neighbour snapping: candidates are edges whose span overlaps the moving edge's span, widened by 0.3 m at each end, plus the stair / lift block and the footprint edges (always).**
   - Aligning with a room on the far side of the floor is not a neighbour. Including it makes edges jump to lines the user cannot see the reason for.
   - The CTO's purpose (restoring a shared wall) is met in full.
   - A-15 updated. Unit cases: a non-overlapping parallel edge 0.2 m away does **not** snap; an overlapping one does.

### Rulings on the Designer plan
- **A. Counter visually hidden below 600 px: not approved as is.**
  - F3-S3's criterion is that "a counter shows n of m floors approved". Visually hiding it on the phone breaks a stated acceptance item.
  - Instead, keep it visible and make it compact: one 20 px line at caption size (`--fs-cap`), no extra padding. It keeps its hook and text.
  - If the PM decides that the tab states suffice as the counter on phones, A can come back. That is the PM's call, not mine. Route it as an optional question.
- **C. Action row padding 6 → 4 px: approved.**
- **D. Fit margin 0.5 m:** approved (ruling 7).
- **Readout re-grids** (phone two lines, 640x360 three one-line rows, 768 column change) for "39 m² (asked 42 m²)": approved.
- **Target recalculated without A:**
  - C + D + compact counter gives about **14.6 px/m** at 360x640 with the sample strip: canvas ≈ 240 + 4 + 4.6 px, i.e. (248.6 − 24) / 16 = 14.0–14.6 depending on the counter's final height.
  - The acceptance is **≥ 14.0 px/m** at 360x640 with the strip, and ≥ 14.0 at 640x360.
  - If the measured value falls short by less than 0.5 px/m, report it. Do not hide the counter.
- **`PC.data.roomLabels` and the tier rule** (one tier per type per level, area line for all or none of a type, tiny at 10 px): approved. Tiny codes must be unique per level as drawn (the table's are). The rule lives in `stage-plans.js`; `draw2d` gains only the generic `labelFits`.
- **Palette additions:** approved, plus the corner mark (ruling 3).
- **Stage 4:** no layout change; approved.

### Conditions (binding at the implementation review)
1. **Order of landing:** Designer CSS / data / palette (incl. the compact counter and the corner mark) first, then FS. QA-first branches as listed below before the FS lands.
2. **Corners in the editor, mutation-checked:** a corner drag moves exactly two edges.
3. **Snap candidates per ruling 9,** unit-tested both ways, m and ft.
4. **Retry:**
   - `PC.C.LAYOUT.retry = { fMin: 0.75, fMax: 1.25 }`;
   - every current success byte-identical, against a golden JSON;
   - QA's case lays out;
   - the boundary rejection case pinned;
   - a failing maximum level under 600 ms.
5. **Runtime:**
   - The new e2e specs (`plans-edit`, `r5`, `plans-phone`, possibly `interior`) run at 360x640 touch and 1280x800 mouse. 640x360 only where layout is the subject.
   - The FS reports the full-run time.
   - If it exceeds 10 minutes, the A-16 trigger applies **in this task's QA round**: QA trims duplicate viewport coverage between `tests/e2e` and `tests/qa`, keeping each check in one place with a comment.
   - Nobody raises the trigger instead.
6. **F1 real-device gate.** The CTO's F2 review asks for the client's answers "before F3-T2 sign-off". If they have not arrived when the F3-T2 outcome is ready, my outcome approval records the gate in `F1.md` as **OPEN — testing guide sent (date)**, as for F2-T2, and states explicitly that the CTO's condition is unmet. The CTO decides at the F3 feature review whether F3 can close without it. The build does not stall (coordinator ruling).

### What QA must change first (before the FS lands F3-T2), file by file
Marker: `PC.stages.MAX_BUILT >= 5` (it lands in the same FS change as everything else). Each file stays green on today's tree, and the FS's hand-over full run proves the other branch.
1. **`tests/qa/f3-t1-stage3.mjs`**, under the marker:
   - Approve is enabled on a valid plan, and its message is the PM's default hint, not "plan editing (next build)";
   - Skip lands on stage 5;
   - the counter is still visible on phones (compact);
   - labels: accept the `PC.data.roomLabels` forms (full / short / tiny with number), with one tier per type per level;
   - the scale assertion becomes ≥ 14 px/m at 360x640 with the strip.
2. **`tests/qa/f1-t2-flows.mjs`**, under the marker:
   - Skip to 3D lands on stage 5 with every level approved;
   - the stepper state strings follow the new reachability (stage 4 reachable after all approvals, stage 5 after stage 4);
   - stage 4 has a controller (no static banner) and stage 5 keeps the banner;
   - Back from stage 5 to stage 4 works.
3. **`tests/qa/f3-t1-plans.mjs`:**
   - The no-layout counts and "my search found a layout in N" notes follow the retry: 0.75–1.25 on failures only.
   - The model applies the same retry rule, and every retried layout must pass QA's own oracle.
   - Sample and successful layouts unchanged.
4. **`tests/qa/f1-t3-plot.mjs`:** the Clear dialog text gains the plans sentence **only** when a plan with edits or an approval exists (`atRisk`). With the clean sample it stays as today. Add the branch so a seeded approved plan expects the sentence.
5. **`tests/qa/f1-t1-layout.mjs` / `inpage.js`:** the stage-3 states now show the compact counter, the re-gridded readout and the 4 px action-row padding; the stage-4 state has a controller. Layout rules (44 px, no overflow, canvas sizes) stay.
6. **`tests/qa/f2-t2-questions.mjs`:** review only. Any "highest built stage" text follows the marker.

After F3-T2 lands, QA writes its own F3-S2 / S3 / S4 and R5 scenarios for the task's QA round. Those are new work, not part of this sequence.

### Non-blocking notes
- R6 (Clear then an identical redraw keeps the plans, although the dialog says "regenerated") is A-7 as designed. Mention it in the outcome's limits.
- R8 (`-0`): fine. `applyEdit`'s rounding normalises it.
- The one-time back-to-Draft note: "once per transition" as planned is right.

VERDICT: APPROVED

## Orchestrator note (2026-11-21) — corner resize conflict
The TL ruling 3 ("corner resize required", based on F3-S2's old "edges/corners" text) and the PM's round-6 decision ("not required; F3-S2 now says by its edges"; corners optional later in F5-T3 if the client asks) crossed. Product scope is the PM's: **corner resize is NOT in F3-T2.** Edge handles only; the Designer adds no corner mark; condition 2 (corner drag mutation check) is void. Keyboard room editing stays out (known limit). The counter stays visible on phones as one compact line, per the TL (the PM did not ask to hide it).
