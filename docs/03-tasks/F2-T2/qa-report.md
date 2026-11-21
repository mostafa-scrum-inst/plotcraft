# F2-T2 QA report — QA Tester

## Round 1 — 2026-11-20

Scope: questionnaire Q1–Q10 and Q15–Q17, site preview (Q5 compass, Q6 edge tap), live summary and conflicts, R5 dialogs; stories F2-S1 and F2-S3, R4, R5, the F2 riders. Checklist: the Tech Lead's "For QA (F2-T2 focus)" list at the end of `impl-review.md` round 2 (9 items). Build: current tree, `dist/index.html` 258.8 kB.

### What I tested and how
- **New suite `tests/qa/f2-t2-questions.mjs`** (runner `tests/qa/run-f2-t2.mjs`, about 80 s, `--no-shots`, `--only=A,...`; no fixed sleeps): 799 checks in sections A–G, at 360x640 touch, 640x360 touch, 768x1024 touch and 1280x800 mouse.
  - **Real input only.** Taps use the touchscreen (or a mouse click at 1280x800), with the tap confirmed by its click. Radios are tapped on their labels and switches tapped. Numbers are typed with the keyboard and then left with Enter or with a tap elsewhere. Sliders are moved by a CDP touch drag of the thumb (and a mouse drag at 1280x800). The compass is dragged by touch and by mouse. Edges are tapped in the preview.
  - **One "sync" check runs after every action** (about 120 times per viewport). It compares everything the page shows with the stored state and with **my own model**: every field, slider thumb and label, Q8 min/max/step in each unit, radio, switch, disabled state, unit suffix, the Q5 and Q6 readouts, the pool-size note, and the roof note.
    - The summary figures come from my F2-T1 reference model, not from `PC.site`: plot area, buildable area (lattice), footprint (exhaustive search), the vegetation budget, and needed / available per level.
    - The conflict rows must equal the current validation and point at the right question (my own table). The status line and `data-kind` must follow the rows.
    - The preview's last frame is read with a canvas spy:
      - "front" is always drawn;
      - no label claims more back or side edges than my classes;
      - the area label is my footprint's area;
      - my footprint rectangle, mapped through the view, is actually stroked;
      - parking and pool are drawn where the site model puts them.
  - **Mutation check:** 10 mutations of the source, each on a throwaway copy, all caught:
    - summary always in m;
    - slider gesture-end listener removed;
    - preview/summary not refreshed on render;
    - Q5 readout not rounded;
    - edge hit radius fixed at 30 px;
    - Q8 max in ft wrong;
    - pool sizes never disabled;
    - footprint drawn 1 m off;
    - Q4 live feedback removed;
    - the field-restore case (that one is only reachable through bug 1).
- Read the code of `q-fields.js`, `stage-questions.js`, `q-preview.js` and `summary.js`, and the relevant parts of `store.js`, `units.js`, `frames.js` and `shell.js`.
- Looked at 60 screenshots in `tests/qa/shots/F2-T2/`:
  - each group in m and ft;
  - the summary sheet with conflicts;
  - the worst-case figures (100 x 100 m in ft, 4 levels);
  - the sample, the U-plot, the thin 10 x 50 m plot and a rotated plot in m and ft, at 360x640, 640x360 and 1280x800;
  - all four viewports for the groups.
- **Full run `node tests/run-all.mjs`: exit 1 in 308.2 s.** Everything green except my new suite (797/2, bug 1):
  - lint: 0 violations;
  - unit: 252/0;
  - e2e: contract 4/0, fit-button 42/0, plot 512/0, questions 711/0, site-legend 120/0, start-card 14/0, shell 554/0;
  - QA: F1-T1 169/0 + 2015/0, F1-T2 792/0, F1-T3 1022/0, F2-T1 1126/0, F2-T2 797/2.

### Results per focus item
| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Client report: every control updates value, readout, preview and summary, by touch at 360x640 and 640x360; nothing stale after a unit switch, Load sample, Resume, R5 Cancel | **PASS** | Section A (160 checks) covers every control, each followed by a full sync:<br>• Q1 radios and header toggle;<br>• Q2 typing and both steppers;<br>• Q3 and Q4 dragged, including away and back to the start value (no `change`), then an external commit is shown;<br>• live values while the finger is down: label, preview area and summary at 50 %, state unchanged; Q4 the same;<br>• Q5 cw/ccw/reset and compass drag;<br>• Q6 edge tap and prev/next;<br>• Q7 floors, basement, usable roof;<br>• Q8 in m and ft, including away and back;<br>• Q9 and Q10;<br>• Q15 typed and steppers, covered;<br>• Q16 switch and sizes;<br>• Q17.<br>Then m to ft to m with nothing committed, reload + Resume (answers identical, all controls synced), and Load sample through stage 1 / Clear. R5 Cancel is in item 7. |
| 2 | Groups, brief texts, defaults, progress, keypad, persistence | PASS | Defaults of 4.1 on a hand-made plot; 6.2 values on the sample (my `sampleProblems`). Progress text and bar against my own count (17, 11, 7, 3, 6, 4 left; bar = 17 − left). Every stage-2 text input has `inputmode="decimal"`. Answers survive group changes, stage 1 and back, and reload + Resume, at 3 viewports. Wording and Q18/Q19 absence are covered by the F1-T1 suites. |
| 3 | Bad input | PASS | 23 setback entries in both units, written from 4.1 and R4:<br>• refused: `""`, `abc`, `1e2`, `0x10`, `-1`, `25`, `20.01`, `1.2.3`, `3,5,1`, `- 2`, `65.7 ft`, `-0.1 ft`;<br>• accepted: `3.`, `.5`, `3,5`, ` 4 `, `+2`, `0`, `20`, `65.6 ft`, `10 ft` = 3.048 m, `0,5 ft`.<br>Refused entries keep their text and get `aria-invalid`, an error line with the limits in the current unit, a Q2 row and Next disabled; accepted entries clear all of that live. Cars: `1.5`, `5`, `-1` and `x` refused with "Enter a number from 0 to 4." (no unit); `2,0` stores 2. Invalid text survives other answers, a group change and a unit switch, and is re-worded in ft. Fix focuses the invalid field (phone: sheet closed first). Leaving an untouched field keeps 3.048 m. |
| 4 | R4 | PASS, except bug 2 (display) | Every sync compares lengths, areas and limits in the current unit. Q8 in ft is 8–14.5 step 0.5, and 12 ft stores 3.6576 m. Pool clearance reads "1.0 m" / "3.3 ft". A unit switch never commits a length (explicit check). |
| 5 | Site preview | PASS | Sample, U-plot, thin 10 x 50 m and rotated plot in m and ft at 3 viewports: my footprint is drawn where my model puts it, the labels agree with my classes, and "front" is always shown. Locked: one-finger drag and pinch change neither the view nor the state, and the page does not scroll or zoom. The wheel at 1280x800 is not consumed and does not zoom. Edge-tap reach (touch 18 / 27 px, mouse 8 / 13 px) sets / does not set the street edge. Compass on a slanted street: stored value = my 15° W snap, and the arrow during the drag equals the stored one. Readout in whole degrees. Sample at 360x640 drawn at 4.13 px/m (≥ 4.0). |
| 6 | F2-S3 through the UI | PASS | Each code reached through the UI, with Next disabled for blocks only and re-enabled live:<br>• level-over (Q3 at 10 %, my numbers in m and ft);<br>• fp-veg-over (80 + 30 %);<br>• fp-clamped (my area and %);<br>• veg-reduced (70 %, my budget);<br>• buildable-small (sides 10 m);<br>• floor-empty (3 floors);<br>• basement-empty;<br>• field-invalid;<br>• parking-omitted (8 m wide plot, 4 cars);<br>• pool-omitted in m and ft.<br>Fix: sheet closed, Site group open, Q2 in view and focused. Sample shows "All clear". `no-fit` is not reachable from the sample by the UI; it is covered at model level (F2-T1) and by the FS spec. |
| 7 | R5 with seeded valid plans | **FAIL (bug 1)** | Everything else passes:<br>• the question names Ground and First floor;<br>• Cancel by button and by Esc restores the state exactly, plus field, slider thumb, label, preview and summary (Q2 typed, Q2 side 6 m, Q3 drag, Q6 edge tap);<br>• whether R5 asks follows my model of the footprint size (side 2 → 2.5 m does ask: 9.5 x 15 → 9 x 15.5 m);<br>• back 2 → 2.25 m and Q10 never ask; Continue applies, a later change in the visit does not ask, and a new visit asks again;<br>• Q7 own dialogs: 2 → 1 floor names the 7 rooms and the Ground and First plans; basement off on a one-floor house names Basement and Ground; Cancel keeps the level and the control; Delete leaves floors 1 with no room, pair or plan of the removed level and no second dialog. |
| 8 | Riders | PASS | Unit by header and by Q1 keeps `sampleClean`, and Skip is still offered on stage 1. Q10 ends it. "Snap 0.5 m" / "Snap 1 ft". No banner on stage 2. |
| 9 | Viewports, layout, clean log | PASS, except bug 2 | The F1-T1 layout rules hold at the 4 viewports for every group, site in ft, the open summary with conflicts and the worst-case figures (open sheet judged on its own, plus hittable). Zero page/console errors, native dialogs or stray requests in every session. |

### Bugs

**1. Major — Pressing Enter to finish a size-changing number answers the R5 question with "Cancel" in the same keystroke; the user's value is silently discarded (R5, Q2; desktop and phone keyboards).**
- **Steps:** valid plans exist (seeded, as in the FS spec; in the product from F3-T1). On stage 2, type 4 into the front setback and press Enter. This is the natural way to finish a number, and the phone keyboard's Go/Done key sends it.
- **Expected:** "Regenerate floor plans?" stays open until Continue or Cancel.
- **Actual:** the dialog flashes, its Cancel button receives a keyboard click (`detail = 0`) from the same Enter press, the field goes back to 3.0 and nothing is stored. Seen at 360x640 touch and 1280x800 mouse. Leaving the field by tap or Tab keeps the dialog open.
- **Cause:** the `keydown` Enter handler in `q-fields.js` (`number`) blurs the field. The blur fires `change`, then `propose`, and the dialog opens and focuses Cancel, all before the key's default action. Chrome then delivers the activation of that Enter to the newly focused button.
- **Suggested fix:** call `e.preventDefault()` in that Enter handler before blurring. Alternatively, the dialog could ignore key activations that started before it opened. Test: `E Q2 typed 4 m + Enter` in my suite (failing now).

**2. Minor — Short landscape (640x360) in ft: summary figures are cut off with an ellipsis (R4 display).**
- **Steps:** with 3 floors and footprint 10 % on the sample in ft, the level rows read "1292 sq ft / 614 …" and "1292 sq ft / 614 s…". On a 100 x 100 m plot, the footprint row "85261 sq ft · 79.2 %" and every "needed / available" row are cut as well. `level-available` is clipped to about 42–64 px of its 76–93 px. See `tests/qa/shots/F2-T2/G-summary-conflicts-ft-640x360.png` and `G-summary-worst-ft-640x360.png`.
- 360x640, 768x1024 and 1280x800 are fine with the same figures.
- **Suggested fix (Designer, CSS):** let the value cell wrap, or put the label above the value in the short-landscape side column.
- Marked KNOWN in `tests/qa/f2-t2-questions.mjs`.

### Review of the FS's `tests/e2e/questions.spec.mjs` (gaps)
1. Radios, switches and the header unit toggle are set with `check({ force: true })` / `setChecked(..., { force: true })`. That bypasses hit testing, so the spec does not prove that a tap reaches them. My suite taps every one.
2. Text fields are filled and blurred by script, and Enter is never pressed. That is how bug 1 slipped through.
3. Apart from the round-2 gesture-end cases, sliders are driven by synthetic `input` / `change` events. Live feedback during a real drag (Q3, Q4, Q8 in ft) is not covered.
4. R5 Cancel by Esc is not tested, and after a Cancel the preview and summary are not compared.
5. No case at 640x360. The short-landscape summary (bug 2) is never laid out in ft.
6. Summary figures are asserted only for the sample, as fixed strings. Other plots and units are compared with `PC.validate` itself, which proves consistency, not correctness. The F2-T1 suite and this suite compare against an independent model.

### Observations: correct by the rules, but an architect may be surprised (for PM / TL / Designer)
1. **Fix on "Second floor has no rooms" / "The basement has no rooms" opens the Rooms group (Q11)**, whose controls do nothing until F2-T3. The only working fix today is Q7, which the text mentions but Fix does not go to. This is interim. F2-T3 should keep Fix pointing at the room list, and the fix works once rooms can be added.
2. **A small side-setback change regenerates plans.** On the sample, sides 2 → 2.5 m change the building from 9.5 x 15 to 9 x 15.5 m, because the target proportion follows the buildable box. So R5 asks, although the old building would still fit. This is correct by A-6 and R5. The PM may want to judge whether this matches the "only if the footprint changes" expectation of an architect.
3. **Short edges carry no class label.** On the thin 10 x 50 m plot the back edge is unlabelled at 360x640, and so are the ends of the U arms, although there is padding above the top edge. F2-S1 says "labels each edge". The TL accepted culling for non-street edges; flagged for the PM.
4. **The footprint area label is wider than a narrow building.** "775 sq ft" on the thin plot is drawn across the footprint and the plot edges. It is legible but cluttered (Designer, F5-T3 pass).
5. **The pool-size note wraps in the middle of an entry** at 360x640 ("… L 5.0 × / 10.0 m", `G-outdoor-m-360x640.png`). Cosmetic.
6. **The pool warning gives no hint.** Pool S does not fit a 16 x 22 m plot at 30 %: it needs 5 x 8 m with its clearance, the back yard is under 5 m deep and the side yards are 3.5 m wide. The warning says it is left out, but not what would help (a lower footprint % or smaller setbacks). For the PM.
7. **A floor without rooms shows "needs 10 m²" (108 sq ft)**, the stair allowance, next to the "has no rooms" block. This is correct, but may read as a contradiction.
8. **The Rooms group's buttons ("Add room", "Add pair") do nothing when tapped** until F2-T3. This is known and interim, and harmless (no errors). Mentioned because the client is trying the republished preview: he will meet it.

### Verdict
Items 1–6, 8 and 9 pass (item 4 and item 9 with the minor bug 2). On the current build every Q1–Q10 and Q15–Q17 control updates its value, its readout, the preview and the summary by real touch at 360x640 and 640x360. Nothing goes stale after a unit switch, Load sample, Resume or a Cancel. This answers the client's report.

Item 7 fails on bug 1: a size-changing answer finished with Enter cannot be confirmed, and the user's value is lost silently. It is not reachable in the shipped build until plans exist (F3-T1), but R5 for Q2 is an acceptance criterion of this task and the fix is one line. Bug 2 is minor and may be fixed in the same round or carried (KNOWN).

VERDICT: FAILED

## Round 2 — 2026-11-20 (re-test after the FS fix for bug 1, the Designer fix for bug 2; TL review round 3)

### What I did
- **Bug 1 re-test.** The fix is in `q-fields.js` `number`: `e.preventDefault()` before `input.blur()`.
  - My failing check `E Q2 typed 4 m + Enter` now passes at 360x640 touch and 1280x800 mouse.
  - The question stays open, nothing is stored while it is open, Esc cancels, and Tab to Continue then Enter stores 4 m.
  - Mutation check: on a throwaway copy without the `preventDefault`, 11 checks of sections E and K fail. The fix is what makes them pass.
- **Bug 2 re-test.** The Designer's change is in `41-stage-questions.css`.
  - I removed the KNOWN entry from `tests/qa/f2-t2-questions.mjs`. The 640x360 ft summary (3 floors at 10 %) and the worst case (100 x 100 m, 80 %, basement + 3 floors) now pass the clipping and text-fit checks.
  - In `G-summary-worst-ft-640x360.png` the long figures sit under their labels, readable and right-aligned. The other viewports are unchanged and green.
- **New section K: keyboard regression of round-2 focus items 1, 3, 6 and 7.** It uses Enter, which is what a phone keyboard's Go / Done key sends. It runs at 360x640 touch, 640x360 touch and 1280x800 mouse, with and without seeded valid plans.
  - **Item 1, every number field (three setbacks and cars):** a value finished with Enter is stored at once when there are no plans, and a full sync follows.
  - **Item 3, bad text + Enter** (`25`, cars `1.5`): refused, marked, a conflict row, Next disabled, no dialog, state unchanged. A valid value + Enter clears it.
  - **Item 6:** side 10 + Enter gives buildable-small with Next disabled; side 2 + Enter clears it with Next enabled.
  - **Item 7, with plans:**
    - Enter on a size-changing value (front 4 m, side 6 m; whether it asks follows my model of the footprint size): the question stays open, nothing is stored, and Esc restores the state exactly.
    - Back 2.25 m (the footprint only moves) and cars 3 + Enter: stored without a question.
    - Enter, then Tab + Enter on Continue: stored.
- **F1-T1 layout flake** (640x360 `s2-building`, a q-floors radio "covered at centre", seen once by the Designer).
  - I could not reproduce it: 6 runs of the 640x360 layout pass, three at a time in parallel, all 501/0.
  - The Tech Lead's hypothesis does not hold as stated:
    - `C.hittable` scrolls and hit-tests inside one synchronous evaluate;
    - no CSS smooth scrolling exists in `src/`;
    - my probe of the static setup over 1.5 s saw no late controller render that could switch the group back.
  - I hardened the check anyway, in `tests/qa/f1-t1-layout.mjs`:
    - before the hit test, the suite waits until every scroll offset and every control box are identical over two animation frames (at most 2 s);
    - a miss is tried once more after the page settles again;
    - a miss that then passes is printed as a `note … transient hit-test miss` with the covering element, so it is recorded rather than hidden;
    - a miss that repeats still fails.
  - No such note appeared in this round's full run.

### Results
- **`tests/qa/f2-t2-questions.mjs`: 946/0, no KNOWN entries** (sections A–G plus the new K).
- **Full run `node tests/run-all.mjs`: exit 0 in 329.1 s.**
  - lint: 0 violations;
  - unit: 252/0;
  - e2e: contract 4/0, fit-button 42/0, plot 512/0, questions 926/0, site-legend 120/0, start-card 14/0, shell 554/0, summary-fit 456/0;
  - QA: F1-T1 169/0 + 2015/0, F1-T2 792/0, F1-T3 1022/0, F2-T1 1126/0, F2-T2 946/0.
- The FS's spec now taps radios and switches, has a keyboard R5 case at four viewports, and runs at 640x360. That closes my spec gaps 1, 2, 4 and 5. Gap 6 (figures checked only against `PC.validate`) is still open; QA's own model covers it.

### Open bugs
None.

### Observations
The eight observations of round 1 still apply. They are not bugs and are for the PM / TL / Designer, in particular:
- Fix on "has no rooms" opens the still inert Rooms group;
- a 0.5 m side-setback change resizes the building and asks R5;
- short non-street edges are unlabelled;
- the client will meet the inert Rooms buttons on the republished preview.

### Verdict
Both bugs are fixed and verified independently, with the fix mutation-checked. The keyboard regression of items 1, 3, 6 and 7 passes with and without plans, and the full run is green. All nine focus items pass.

VERDICT: PASSED
