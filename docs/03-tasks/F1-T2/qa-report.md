# F1-T2 QA report — QA Tester

## Round 1 — 2026-11-20

Build under test: `node build.mjs` -> `dist/index.html` 147.5 kB, 14 scripts, 10 stylesheets.
Scope: the F1-S4 / F1-S5 criteria this task claims (plan section 8), R1, R3, G5, tested through the real UI. Accepted interim limits were not judged as defects: plot canvas and stage-1 readouts blank until F1-T3, `MAX_BUILT = 2` (Skip to 3D stops at stage 2), empty stage-1 controller, "done" only once visited and valid, "plot too small" reason in m² only, the "not built yet" banner on stage 2.

### What I tested and how

| File | What |
|---|---|
| `tests/qa/f1-t2-flows.mjs` | own playwright suite, independent of `tests/e2e/shell.spec.mjs` and `tests/helpers/` |
| `tests/qa/run-f1-t2.mjs` | runner: `node tests/qa/run-f1-t2.mjs [--no-shots]`, exit 0 / 1 (same conventions as `run-f1-t1.mjs`) |
| `tests/qa/lib.mjs` | additions: init scripts per context, seven `localStorage` failure modes, `cleanLog` |

How the suite drives the app: real touch taps (`touchscreen.tap`) at 360x640 and 768x1024 and real mouse clicks at 1280x800, at the control's centre after checking that the control is the hit target there; real keyboard events; real reloads inside one browser context. State is read through `PC.debug.state()` and the raw `plotcraft.draft.v1` key. The sample is compared with a table I wrote from PM 6.2 / 4.1 / 4.2 (not with `sample.js`). Only where the plan itself says so does the test reach inside: `PC.stages.MAX_BUILT = 5` and plans committed from the test, to exercise the full gating table that this build cannot reach yet.

Scenarios (A-H at all three viewports; I-J at 360x640 and 1280x800; K-L at 360x640; M at 640x360):
A fresh load; B locked steps and toasts; C sample, Next / Back / stepper navigation; D full gating table and labels; E Skip to 3D and "unmodified sample"; F autosave, reload, Resume, Start new with Cancel / Esc / backdrop / OK, focus trap; G sample over a draft; H keyboard-only pass; I 40 corrupted, old-format and empty drafts plus 3 drafts saved on a stage that is no longer reachable; J storage unavailable or throwing in 7 ways; K toast limits; L double activation; M short-landscape layout of the live states.
In live states (fresh, toast, sample + strip, stage 2 + banner, stages 4 and 5, resume offer, dialog open, no-save note, two toasts) the F1-T1 layout rules are re-checked: no page scroll, targets 44 px or more, stepper on one line, Back/Next in view, nothing clipped, text fits, no overlap, text contrast 4.5:1.
Every scenario ends with: zero page errors, zero console errors (the aborted three.js load excepted), zero native dialogs, no request other than the three.js tag.

Result: **759 checks passed, 0 failed; 11 hits on the two minor bugs below (listed as KNOWN, exit code 0).** Ran three times, stable. `node tests/run-all.mjs`: exit 0 (lint 0 violations, unit 166 / 0, e2e contract 4 / 0, e2e shell 509 / 0). `node tests/qa/run-f1-t1.mjs`: 137 / 0 and 1929 / 0, no known hits (the Designer's bug-6 fix holds).
Screenshots in `tests/qa/shots/F1-T2/`; looked at by eye: `F-resume-offer`, `F-startnew-dialog`, `C-sample-stage1`, `C-stage2`, `K-two-toasts` (all `-360x640`), `M-sample-strip-640x360`.

### Results per acceptance criterion

| Criterion | Result | Evidence |
|---|---|---|
| F1-S4 stepper shows current / done / locked | PASS | fresh `CLLLL`; sample `CaLLL` (a = reachable, not yet visited: the accepted fourth state); after visiting stage 2 `DCLLL` / `CDLLL`; full table with five stages `CaaLL` -> `DDCaa` -> `DDDDC`; a floor with a layout error re-locks 4-5 |
| F1-S4 locked stages not activatable and say why | PASS | tap, Enter and Space on steps 2-5: stage unchanged, toast "Draw and close the plot first"; "Approve all floors first" on step 4 until both floors are approved; same text in `title`; locked steps are `aria-disabled`, never `disabled`, pointer events kept; a small-plot draft gives "The plot is too small (minimum 50 m²)" |
| F1-S4 Back/Next always visible; Next disabled until the stage is valid | PASS | in view and hittable in every live state at all four viewports; Next disabled on an empty plot, enabled by the sample, disabled on stage 3 until all floors approved; a forced click on the disabled Next does nothing |
| F1-S4 Next label per stage | PASS | "Next: Questions", "Next: Floor plans", "Next: Interior", "Build 3D model"; hidden on stage 5 |
| F1-S4 back and forward loses nothing | PASS | Next, Back, and three step round trips leave the state identical except `stage`; exactly one stage section visible at any time |
| F1-S4 one line at 360 px | PASS | in every live state |
| F1-S5 draft saved automatically (plot, answers, stage) | PASS | key written within the debounce after the sample loads, wrapper `{v:1, savedAt, state}` equals the state exactly; stage change saved; a change followed at once by a reload is saved (page-hide flush); an empty project is never saved |
| F1-S5 reload offers Resume draft / Start new in-page | PASS | app starts on defaults with the offer ("Saved <date> · stage 2 of 5."), no dialog; a change made while the offer is unanswered does not overwrite the draft; Resume restores the state exactly, on the saved stage, header unit radio included |
| F1-S5 Start new clears the draft after in-page confirmation | PASS | Cancel, Esc and a tap on the backdrop keep draft and offer; OK removes the key, restores the 4.1 defaults, hides the offer; a further reload shows no offer |
| F1-S5 works with `localStorage` blocked or throwing | PASS | property getter throws / returns `undefined` / returns `null`; every method throws; only `getItem` throws; only `setItem` throws; `setItem` starts throwing mid-session. In all seven: no error, clean start, sample loads, navigation and unit change work, reload is clean; the discreet "Drafts are not saved on this device." note shows when storage is unusable at start |
| F1-S5 corrupted / old-format draft discarded silently | PASS | 40 cases (garbage, truncated, empty, `null`, array, number, string, `{}`, wrapper `v` 0 / 2 / "1", bare state, bad or missing `savedAt`, missing state, unknown or missing keys, out-of-range numbers, bad enums, markup in an enum, bad plots, duplicate ids, pair across levels, room on a missing level, `__proto__` key, 1 MB of junk, valid draft of an empty plot): defaults, stage 1, key removed, no offer, no dialog / toast / banner, no error, no prototype pollution; app usable afterwards. Control: the valid draft is offered |
| F1-S5 Load sample: one tap; confirmation over an existing draft | PASS | one tap, no dialog on an empty project; state equals PM 6.2 item by item (plot 5 points, 25 % / 25 %, 7 + 7 rooms at 110 m² per level, master bedroom, two pairs, 2 covered cars, pool S, wall, gate centre, seating, modern / full); over a pending draft: dialog "Load the sample project?", Cancel keeps everything, OK loads the clean sample and it becomes the stored draft |
| F1-S5 Skip to 3D only while the sample is unmodified | PASS | one Skip button; strip on stages 1, 3, 4 and never on 2 or 5; Skip is navigation (sample stays unmodified, strip still there on return); with all stages opened by the test it approves every level and opens stage 5; unit toggle removes strip and Skip for good (switching back, navigating, reload + Resume do not bring it back); re-selecting the current unit is not a change |
| R1 fixed order, reachable only when earlier stages are valid | PASS | scenarios A-D; drafts saved on stage 5, on stage 2 with an open plot, and on stage 2 with a 6 m² plot resume on stages 2, 1, 1 |
| R3 in-page messages only | PASS | dialog: `role=dialog`, `aria-modal`, labelled, app `inert` + `aria-hidden`, focus starts on Cancel, Tab / Shift+Tab stay inside, Esc cancels, focus returns to the opener after Cancel / Esc, a tap behind it activates nothing; toast region is a polite live region, toast sits above the action bar without covering Back/Next, disappears after 3.5 s, same text does not stack, never more than two |
| G5 zero console errors, no native dialogs, no network | PASS | in all scenarios, storage failure modes included |
| R2 touch, mouse, basic keyboard | PASS (bug 1, minor) | Tab reaches every control; Enter on Load sample, Next, steps; arrow keys on the unit toggle; Esc / Tab / Enter in the dialog |

### Bugs

**1. Minor — Keyboard focus is dropped to `<body>` after four actions.**
- Steps (1280x800 or any viewport, keyboard): (a) Tab to "Load sample project", Enter. (b) Tab to Next, Enter (stage 2 opens and Next becomes disabled). (c) focus "Skip to 3D", Enter. (d) Reload with a draft, Start new, confirm with Enter.
- Expected: focus stays on, or moves to, a visible control (plan section 3: "focus moves to the stage section … when the change came from the keyboard").
- Actual: `document.activeElement` is `<body>` in all four. After (b) the next Tab goes to the top of the page (`unit-m`); after (a) it continues at Undo. Nothing is trapped and Tab still works, so this is not blocking, but a screen-reader user loses their place on every stage change.
- Cause: `shell.switchStage` refocuses only when the stage changes *and* the old control is already inside `[hidden]`; the sample strip is hidden after that test runs, a disabled Next is not `[hidden]`, and loading the sample / Start new do not change the stage. `dialog.close` skips the opener when it has been hidden and focuses nothing else.
- Suggested fix: after `render`, if `document.activeElement` is `<body>`, or is disabled or hidden, focus the current step button (or the stage section).

**2. Minor — A double tap on "Load sample project" over a draft opens and instantly cancels the confirmation.**
- Steps: 360x640 touch, reload with a stored draft, tap "Load sample project" twice quickly.
- Expected: the confirmation stays until the user answers.
- Actual: the second tap lands on the dialog backdrop (the dialog is anchored to the bottom, the button is above it) and counts as Cancel; the dialog flashes and nothing happens. Safe direction (nothing is lost, the sample is never loaded without OK), hence minor. The same applies to any button that opens a dialog and is not covered by the dialog box.
- Suggested fix: ignore backdrop taps for about 300 ms after the dialog opens.

### Review of the FS's own tests (gaps)
The unit tests and `shell.spec.mjs` cover the acceptance map well and are green. What they do not cover, and my suite now does:
- focus after an action (bug 1) and what a tap behind an open dialog does; real double taps (bug 2);
- the page-hide flush (change, then reload inside the 400 ms debounce): `shell.spec.mjs` never reloads before the debounce ends, so removing the `pagehide` listener would not fail it;
- storage modes other than "getter throws" and "quota": `undefined`, `null`, every method throwing, reads throwing, and a failure that begins mid-session;
- corrupted drafts in the browser beyond three shapes (such cases are unit-tested through `parse` only; mine check the boot path, key removal and the silent start for each);
- toast auto-dismiss and that toasts do not cover Back/Next; Space on a locked step;
- inputs in `shell.spec.mjs` go through playwright locators, which refuse `aria-disabled` elements unless forced; mine tap coordinates as a finger would.
Suggested for F1-T3 (not required now): lift the page-hide case into `shell.spec.mjs`.

### Non-blocking observations
- **Storage full with a draft already stored:** when `setItem` throws at start, the adapter turns itself off entirely, so the existing draft is not offered (it stays in storage untouched and the no-save note is shown). Reading could still work in that situation; worth a line in F5-T3 if the hosted check shows a full quota is realistic.
- **No-save note after a mid-session failure** lives in the start panel, which is hidden once a plot exists, so the user is not told that saving has stopped. The story asks for "at most" a note, so this passes; a toast at the moment of failure would be kinder.
- **Step 4 / 5 reason in this build:** with the sample loaded, step 3 says "Not available in this build yet" while steps 4 and 5 say "Approve all floors first" (first invalid earlier stage), although floors cannot be approved yet. Disappears with F3.
- **Next on stage 2 is disabled with no reason shown** (stage 3 is not built). The banner "This stage is not built yet: static preview" is the only hint. Interim.
- **Stage 1 after loading the sample** shows "Place at least 3 points…", Area "–", Points 0 and an empty canvas until F1-T3 registers the plot controller (accepted limit); the stage-2 controls are static and not wired (F2-T2), so its Q1 radio does not follow the header unit toggle yet.
- At 640x360 the sample strip is only the "Skip to 3D" button in the action bar row (F1-T1 design); "Sample project loaded" is not shown there.
- `tests/run-all.mjs` still does not call `tests/qa/run-*.mjs` (carried to F1-T3 by the TL). Both QA runners are ready for it and currently exit 0.

### Verdict
All claimed F1-S4 and F1-S5 criteria pass at 360x640 touch, 768x1024 touch and 1280x800 mouse, with storage working, missing or failing. Two minor bugs (keyboard focus position; double tap on a dialog opener), neither blocking; both are marked as known in `tests/qa/f1-t2-flows.mjs` and should be fixed in F1-T3, which rewires stage 1 anyway.

VERDICT: PASSED
