# F5-T2 outcome review (TL, step 3f), 2026-11-22

Reviewed: `outcome.md` (FS, dda4977), against:
- `plan-review.md`;
- `impl-review.md` (all four deviations accepted);
- `qa-report.md` (PASSED, no bugs, 7/7 mutations, full run 413.3 s; `QA_FULL=1` for the 4 trimmed suites green in 184.4 s);
- A-14 as built;
- commits 54b1fcc … dda4977.

## Verdict on the outcome document

`outcome.md` is complete and accurate.

- **§1 What was built.** Matches the code I reviewed: tour plan, as-built curves, soft floors, eased end legs, lead-in, driver `{ pose, done }` / `end` / `paused`, UI and caption controls.
- **Sign-off and run times.** Match the reports. QA rebuilt `f5-t2-view` on the as-built model and met my ≤ 20 s budget (20–22 s alone).
- **`QA_FULL` trims.** The 4 trimmed suites are recorded with what each now omits, and the standing condition was already exercised once (184.4 s, green).
- **Rulings.** Complete: plan items 1–7, Q1–Q9, PM round 13, the four deviations.
- **§7 Known limits.** Honest; none blocks:
  - slow frames stretch the tour;
  - mid-leg framing;
  - upward legs;
  - lifted stops ≤ 0.37 m;
  - API pause not reflected in the UI;
  - rotation mid-tour;
  - desktop framing under the panel.

**Acceptance.** F5-S2 is met in full:
- one continuous smooth path through every room, level by level from the basement, overview to overview;
- the room name shown, levels above hidden, the camera never below ground and above the tree tops;
- Pause, Resume, Stop, speed, gesture cancel, no auto-restart.

G1: 4 taps on a phone (5 with a stored draft), 3 on desktop, all within 6. G6 holds at ≤ 22 meshes during a tour.

## Routing: what is left to finish the app

### 1. F5-T3 (Designer presentation and device pass): start now, in two parts

The F5-plan dependency on "F4 feature review notes" exists so the pass can fold in what the client's phone shows. It does not block work that needs no phone evidence. Feature plans are mine, so I amend F5-T3:

- **F5-T3a, start now (Designer, with FS for camera code):**
  - screenshot pass of all five stages, sample and empty project, at 360x640, 640x360, 768x1024 and 1280x800;
  - spacing, overflow, truncation, contrast, focus order and visibility, pressed / disabled / invalid states, 2D label legibility;
  - stage-5 overlay layout in portrait and landscape, including the 42.5 % panel at 640x360 (F1 review item);
  - tour bar and caption placement (never over the panel toggle);
  - "Building…" and "3D unavailable";
  - **desktop framing under the 320 px panel** (F5-T1 finding 8). This is a `PC.cam.forRoom` / tour target offset, so it is an FS change inside F5-T3, with its own unit test;
  - **tour pacing and the mid-leg framing** (leg times are data in `C.TOUR`);
  - **O-1 summer-evening shadows** (data-only `sky.js` retune, with the golden tables regenerated in the same commit);
  - the F1 polish items not tied to the phone: toasts on a unit change, a lighter area label, the toast when saving stops and the full-quota behaviour.
- **F5-T3b, phone-dependent (folded in when the answers arrive):**
  - the closing radius at low zoom (explicitly gated on the phone check);
  - touch-gesture and performance findings;
  - colour and contrast retunes the client asks for;
  - anything else the F4 feature review raises.

  Phone findings on F4 code come back as bugs on the owning task, as ruled before.
- **CTO.** This does not move the CD-6 gate: the F4 feature review still waits for a real-phone observation, and F5-T3a cannot close F4. The CTO should still weigh in on two points:
  1. That F5-T3a may proceed before any real-device evidence. I recommend yes: its outputs are CSS, markup and data, and they are cheap to adjust.
  2. **What happens if the client never answers.** The CTO set the gate (CTO review, F3 feature review). Only the CTO can accept a substitute, for example an internal real-phone check by someone the client names, or a documented risk acceptance, for the F4 and F5 feature reviews and the release.

  I recommend asking the CTO now rather than after F5-T3a, so the release path is known.

### 2. Test run time for F5-T3

- **The default-run target stays at 420 s at `--jobs 3`.** The never-exceed stays the CTO's 8 minutes (480 s); the 600 s runner hard limit is unchanged.
- **Noise rule.** A single run between 420 and 440 s is re-run once. Two consecutive runs over 420 s, or any run over 440 s, require a trim before merge (A-16: QA's call in `tests/qa`, FS's in its own suites).
- **F5-T3's automated device sweep** (all stages × both project states × 4 viewports):
  - the default run covers 360x640 and 1280x800;
  - 640x360 and 768x1024 go behind `QA_FULL=1`, in the same pattern as the trimmed F1 / F2 suites.
- **The `QA_FULL=1` list becomes the release gate.** It covers f1-t1, f2-t2, f2-t3, f4-t2-step0 and the F5-T3 sweep. It runs green:
  - once before the F5 feature review;
  - whenever the code a trimmed sweep guards changes. For F5-T3 that means any CSS or markup change, so QA runs the F5-T3 sweep with `QA_FULL=1` in its F5-T3 round.

VERDICT: APPROVED
