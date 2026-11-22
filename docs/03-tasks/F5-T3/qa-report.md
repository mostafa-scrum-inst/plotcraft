# F5-T3a QA report

## Round 2 (re-test of 65e78ca)

**Tested on:** main at `7974b6d`. This includes the FS fixes in `65e78ca` and the PM's decision to keep "None selected" (O-2).

| Bug | Fix | Re-test | Result |
|---|---|---|---|
| B-1 | `available = canRead && canWrite`, with a unit test | `f1-t2-flows` default run (J at 360x640), and J at 1280x800 under `QA_FULL=1` | **Fixed:** 584 / 0 and 323 / 0. `get-throws` shows the note and turns the adapter off again. |
| B-2 | The area label splits at the first space ("460" / "sq ft") | `f2-t2-questions` and `f2-t3-site-rooms`, all sections and viewports under `QA_FULL=1`, m and ft | **Fixed:** 873 / 0 and 1065 / 0. |
| B-3 | The pool note uses the UI font at 360: 304 / 336 px in m / ft at 14 px | `f5-t3-view` under `QA_FULL=1`, section E | **Fixed:** the ft note is on one line. The whole suite is 28 / 0. |

- **Full run (default, `--jobs 3`):** all steps passed in **419.8 s**, with 0 failures. That is inside the 420 s limit, but only just.
  - My next trim candidate is the run order of long suites (`run-all` takes them in alphabetical order, so the tail is uneven). That is not my file.
- **`QA_FULL=1` device sweep:** 380 / 0 in round 1. The fixes did not touch the sweep's areas (storage adapter, 2D area label, pool-note CSS); its stage-2 content is the pool note, and B-3 was re-checked on its own.
- **Screenshots:** I am committing `tests/qa/shots/F5-T3/` (9 PNGs, 0.9 MB), as earlier rounds did for F3-T3, F4-T3 and F5-T1. These are the round-2 frames: lens, caption, 640x360, chip, read-only resume, area label.
- **Observations:** O-1 is the collapsed 640x360 chip form, accepted by my check. O-2 is closed by the PM.

VERDICT: PASSED

## Round 1

Date: 2026-11-22. Author: QA.

**Brief:**
- the TL's 8-item QA focus list in `impl-review.md`;
- my prepared F5-T3a suites, with the older checks gated;
- the device sweep under `QA_FULL=1` (TL / CTO condition b);
- a default full run.

**Tested on:** main at `49cf316` (both F5-T3a branches merged), plus my test commits `07d3990` (version-aware tour pacing) and the one that carries this report.

## Summary

- **Verdict: FAILED.** I found 3 bugs:
  - **B-1 (major):** a regression of an F1 storage rule;
  - **B-2 (minor):** the two-line area label splits "sq ft";
  - **B-3 (minor):** the pool note in ft wraps at 360 px.
- Everything else in the focus list passes: lens, 640x360, storage, O-1, pacing, labels and the caption.
- **Device sweep, `QA_FULL=1`:** 380 passed, 0 failed (the default run has 186), in 16.3 s.
- **Full run (default, `--jobs 3`):**

  | Run | Time | Notes |
  |---|---|---|
  | 1 | 455.3 s | Before my trim, with my f5-t3 suite at 40 s |
  | 2 | 428.3 s | After the trim (rule: a single run of 420–440 s is re-run once) |
  | 3 | 442.6 s | Over 440, so a trim is required (A-16) |
  | 4 | 428.3 s | After trimming f1-t3 I / L / N and f1-t2 J |
  | 5 | **409.6 s** | After trimming f2-t2 A at 640x360 |

  Every failure in runs 2–5 is B-1, B-2 or B-3: run 5 has 13 FAIL lines, all of them these. See Run time.

## Bugs

### B-1 (major): write-only storage now counts as "saving works"

**Where:** `src/js/ui/storage.js` `probe`.

**What happens:** reads fail and writes work. This is the `get-throws` mode in the F1 storage suite.
- Before F5-T3a: the boot-time draft read failed and turned the adapter off. The "Drafts are not saved on this device" note showed.
- Now:
  - `probe` sets `canRead = false`, `canWrite = true` and `available = canWrite = true`;
  - `get()` returns null without calling `off()`.
- So the app keeps writing drafts that it can never read back, and the no-save note and chip stay hidden. The user is told nothing, but a reload never offers their draft.

**Evidence:** `f1-t2-flows` J `get-throws` at 360x640 and 1280x800 (unchanged F1 checks):
- `discreet "drafts are not saved" note shown, no resume offer: note=false`;
- `adapter reports unavailable after the failure: failed`.

The TL's ruling 4 requires "the existing F1 storage suites stay green unchanged", and the FS impl-notes say they are.

**Expected:** saving counts as working only when both work: `available = canRead && canWrite`. A write-only store should give the F1 behaviour: the note and chip show, and nothing is offered.

### B-2 (minor): the two-line area label in ft reads "460 sq" / "ft"

**Where:** `src/js/ui/q-preview.js` `areaLabel`.

**What happens:** it splits the text at `lastIndexOf(' ')`. That gives "108" / "m²" in metres, but "460 sq" / "ft" in feet.

**Expected:** the Designer spec's form, the number on line 1 and the unit on line 2: "460" / "sq ft".

**Evidence:** `f2-t2-questions` (A 20 x 30 m and 10 x 20 m at 80 %, ft) and `f2-t3-site-rooms` (B, C, G in ft) report `preview draws "460 sq"` and `preview draws "ft"`.

**Scope:** stage 2 site preview in ft, wherever the footprint is narrower than its one-line label.

### B-3 (minor): the pool note in ft wraps at 360 px

**Where:** `q-pool-size-note` at 360x640.

**What happens:** "S 9.8 × 19.7 · M 13.1 × 26.2 · L 16.4 × 32.8 ft" takes 2 lines. The m text fits on one line.

**What the plan and PM say:**
- Plan §8 item 5: "Test: one line at 360 in m and ft".
- PM round 14: "12 px is allowed for this note only, and only if the ft line wraps at 360 px".

No 12 px rule was added: the impl-notes record only the texts.

**Evidence:** `f5-t3-view` E: `ft: "…" on 2 lines`.

**Expected:** the ft note on one line at 360, at 12 px as the PM allows.

## Focus list

1. **Full run and the `QA_FULL=1` sweep.** See Run time.
   - The device sweep under `QA_FULL=1` passes (380 / 0) at 360x640, 640x360, 768x1024 and 1280x800, with the interior fold at 5 viewports.
   - `QA_FULL=1` runs of my own suites are green, apart from B-2 and B-3:
     - `f5-t3-view` (with C and the collapsed and tour-frame passes);
     - `f2-t3` B, C and F;
     - the f1-t1 / f2-t2 / f4-t2 trims ran in the full runs' default form, which is unchanged.
2. **Lens (1280x800, real r128).** `f5-t3-view` M and A. Every check is against my own oracle `[W + o, H, o, 0, W, H]` (o = canvas right − panel left).
   - **Helper:** `PC.cam.viewOffset` and `visibleAspect` equal the oracle on 180 cases.
   - **Expanded:**
     - `camera.view` and `PC.debug.scene().viewOffset` are `[1616, 690, 336, 0, 1280, 690]`;
     - the orbit target projects to x = 472.0, y = H / 2;
     - the drawing buffer matches the canvas.
   - **Collapsed:** the offset is cleared and the target is at x = 640.
   - **Toggles and orbit:**
     - expanding restores the offset;
     - the pivot and theta are kept by both toggles, and the radius is only re-clamped;
     - a mouse orbit keeps the pivot, and the target stays at the uncovered centre.
   - **Reset, resize and context loss:** the lens holds after Reset, after a resize to 1200x760 and back, and after a WebGL context loss and restore.
   - **Finder:** after picking the widest room, its highlight bbox lies left of the panel.
   - **Tour:**
     - all 109 frames of the sample tour, 0.5 s apart, keep the look point at the uncovered centre (`QA_FULL=1`);
     - on the maximum house (master bedroom on the second floor), the caption never meets the panel or its toggle at the seeked stops, expanded and collapsed. "Master bedroom · Second floor" is among them;
     - a synthetic 100-character caption stays clear of the card. This is the max-width check.
   - "Building…" is centred over the uncovered canvas, and its text is at most 420 px.
3. **640x360 (real r128).** `f5-t3-view` B.
   - **Expanded:** side by side. The canvas is 368 x 262 px and the panel 272 px, they overlap by 0 px², and no lens shift is applied.
   - **Collapsed:** the canvas is full width, under the 45 x 45 collapse chip (observation O-1).
   - **Re-fit:** the drawing buffer is re-fitted at each toggle.
   - **Reset:** after Reset, the house's bounding circle at ground and roof height lies inside the canvas, and so do all 5 plot corners.
   - **Tour:** the caption stays inside the canvas and never meets the panel.
   - **360x640 (`QA_FULL=1`):** the caption is at least 8 px below the header, inside the canvas and off the panel, expanded and collapsed.
4. **Storage and toasts.** `f5-t3-view` D, plus the unchanged F1 suites.
   - **Measurement toasts:** a measurement toast ("The plot is too small (minimum 538 sq ft)") is dropped on a unit change, while the chip's toast stays. The next locked-step toast is in m².
   - **Saving stops mid-session (`late-fail`):** the PM toast shows once over several failed saves, then the chip.
   - **Storage blocked:** the chip shows in the header, on stages 1–5:
     - its aria-label and title are the PM text, and it has no visible text;
     - its target is at least 44 px;
     - a tap shows the PM toast.
   - **Saving works:** the chip stays hidden.
   - **Quota full with a stored draft (read-only):**
     - Resume is offered and restores the draft (unit ft, 5 corners), and Start new asks first;
     - the chip shows;
     - after the probe, the stored draft is never changed or removed. 1 setItem attempt was made, and it failed.
   - **F1 suites:** green, except for B-1.
5. **2D labels.**
   - **A-15** (`f2-t3` F, plus B under F5-T3a). On the 12-vertex staircase and the small plot with every edge overridden:
     - "front" is drawn;
     - labels plus ticks (`PC.debug.siteTicks()`) cover every override;
     - no two labels overlap, and none lies over a control;
     - the edge list holds every edge with "(set by you)".

     A single override on a short comb edge gets a tick instead of a label.
   - **Area label** (`f5-t3-view` E):
     - the sample is on two lines inside the footprint at 360, and the rule holds for it at 1280;
     - a 10 x 40 m plot puts it outside, on the street side;
     - on one or two lines, the label's width is at most the footprint width − 8.

     In ft, see B-2. `f1-t3` checks that #46535F reaches at least 4.5:1 over the plot fill.
   - **Legend:** "Parking" / "Pool" show only while the drawing has them (sample: both; pool off: Parking; no cars: none).
   - **Pool note:** the PM texts, in m and ft. In ft at 360, see B-3.
6. **O-1.**
   - My A-13 oracle on the new 17 h and 18 h keys reproduces the Designer's four 17.5 h rows, and `f4-t3-ref` `skyGold` now selects them. The 8, 12 and 22 h rows are unchanged, so noon is unchanged.
   - My metric (every caster off, more than 30 levels) gives **20 824 px** at summer 17.5 h, at least 15 000. Before O-1 it was 204.
   - `run-f4-t3`: 61 / 0.
7. **Tour pacing.** My `f5-t2` oracle is now version-aware. It selects QA's own literals by the build's `PC.C.TOUR`, and unknown numbers fail.
   - The sample takes 54.5 s, the maximum house 145.5 s, and one room 9 s.
   - The basement eye is at storeyH + 2.5, and the 5.33 m eye floor holds.
   - `run-f5-t2`: 16 / 0.
   - No whip pans: the sample tour peaks at 30.6° / s (near 13.25 s), within 45° / s. Sampled every 0.5 s of tour time under `QA_FULL=1`.
8. **Republish:** this is for after the fixes (CTO condition b). It is not done here.

**Handle over the stair (TL ruling 5):** `f3-t2-editor` 4 passes at 360x640 and 640x360. A press on the Laundry's w handle, which lies over the stair, starts a resize. Moving it along its edge changes nothing.

## Observations (not bugs)

- **O-1:**
  - Plan §2 asked for the collapsed 640x360 canvas to be 640 − 44 ± 1. As built, the collapsed panel is a 45 x 45 chip over the canvas corner, the same as at 1280, and the canvas is full width. That is more canvas and is consistent across viewports. My check accepts either a 44 px strip or the chip.
  - The plan text and A-15's wording may want the as-built form.
- **O-2:** plan §8 item 6 named the empty 640x360 stage-3 readout "Tap a room". As built it shows "None selected", the existing text, on one line. The one-line part holds; the wording is the PM's call.

## Mutations (each on a throwaway copy)

| Mutation | Caught by |
|---|---|
| lens offset sign flipped (`-o`) | f5-t3 M, A (5 failures) |
| occlusion not cleared on collapse | f5-t3 A |
| 640x360 stage 5 back to an overlay | f5-t3 B |
| desktop caption max-width removed | f5-t3 A (the synthetic long caption) |
| no-save chip never shown | f5-t3 D (3 failures) |
| read-only resume off (no read without write) | f5-t3 D |
| unit change keeps measurement toasts (earlier, on the FS branch) | f5-t3 D |
| A-15 ticks not drawn | f2-t3 F (4 failures) |
| O-1 key partly changed (17 h sunI 0.70) | f4-t3 model O ("QA golden not updated") |
| an unknown tour pacing (`overviewLeg` 5) | f5-t2 model T and E |
| saving-stopped toast shown on every failure | **survives, equivalent**: after the first failure the adapter is off, so no later write can fail again, and the once-only flag cannot be reached from the page |

## Test changes (QA files only)

- **`tests/qa/f5-t3-view.mjs`, `f5-t3-ref.mjs`, `run-f5-t3.mjs`** (prepared in 64fc03f; widened for the TL focus list in this round):
  - additions: Reset, resize and context restore, the drawing buffer, `info().viewOffset`, the tour-frame sweep with angular speed, the long caption, the chip on every stage, toast kept / dropped, and section E;
  - the 640x360 collapsed layout accepts the chip form.
- **`stage2kit.mjs`** (F5-T3a gate): the pool-note PM texts; the two-line area label as number / unit (`areaLines`, `hasArea`).
- **`f2-t2-questions.mjs` A:** live preview area on one or two lines; 640x360 only under `QA_FULL=1`.
- **`f2-t3-site-rooms.mjs` B:** "label or tick" per override, and labels plus ticks for the 4 sample overrides.
- **`f1-t3-plot.mjs` F:** the area label may be #46535F at 4.5:1 or more (F5-T3a). I, L and N are trimmed (see Run time).
- **`f1-t2-flows.mjs` J:** trimmed to 360x640 by default (see Run time).
- **`f5-t2-ref.mjs` / `f5-t2-model.mjs` / `f5-t2-view.mjs`:** version-aware pacing, in 07d3990.

## Run time

- **Run 1** (455.3 s, over 440): my f5-t3 suite took 40.6 s under load. The tour-frame sweep alone took about 20 s.
- **Trim (A-16):** the sweep, C 360x640 and A's collapsed tour pass now run only with `QA_FULL=1`. Default f5-t3 is about 13 s alone.
- **Run 2:** 428.3 s, inside the 420–440 band, so I re-ran it once.
- **Run 3:** 442.6 s. That is over 440, so a trim was required. The total work was about 1215 s over 3 jobs, plus about 17 s of serial unit and three steps.
- **More trims (A-16), all restored by `QA_FULL=1`:**
  - `f1-t3` sections I, L and N run at 360x640 and 1280x800 only (they were at every viewport);
  - `f1-t2` J (seven storage modes) runs at 360x640 only (1280x800 too under `QA_FULL=1`);
  - `f2-t2` A runs at 360x640 only (640x360 under `QA_FULL=1`).
- **Run 4:** 428.3 s.
- **Run 5:** **409.6 s**.
- The trimmed sections ran under `QA_FULL=1` in this round: `f1-t3` 822 / 0, `f2-t2` A 160 / 0. `f1-t2` J at 1280x800 ran in runs 1–3 and fails only on B-1.

The suites that failed in runs 2 and 3 fail on B-1, B-2 and B-3 only. A failing suite does not run longer than a passing one in these runners: they finish every section.

VERDICT: FAILED (B-1 major; B-2, B-3 minor). Re-test after the fixes: f1-t2 J, f2-t2 / f2-t3 in ft, f5-t3 E, one full run.
