# F3-T3 first item: A-16 trim (QA)

Date: 2026-11-21. Author: QA. Asked by the TL F3-T2 outcome review and F3-plan.md F3-T3, first item: remove duplicate
viewport coverage between `tests/e2e` and `tests/qa`, keep each check in one place with a comment, full run 8 min or less.

## Rule I used
A check was a duplicate when an e2e spec function and a QA section test the **same behaviour at the same viewport with
the same input** (touch or mouse). At such a viewport I kept one side and dropped the other:
- I dropped a QA viewport when the e2e function was the only other test at that viewport (QA keeps 360x640 touch and
  1280x800 mouse for its oracle).
- I dropped an e2e viewport (or a whole e2e function) when the QA twin covers the same things or more there.
- Every e2e function keeps at least one viewport, so its checks that QA does not have still run somewhere.
- Every behaviour keeps every viewport it was tested at, in one of the two suites. Touch and mouse both stay covered.
- When I was not sure there was a twin, I kept the run (`scaleAndLabels`, `round2`, `pairLimitsAndPlans`, `r5Rules`,
  `keyboard`, `tiers`, `staleInvalid`, all of f1-t1, f2-t1 and f3-t1).
No source file under `src/` was touched. Each change carries an `A-16 trim` comment that names its twin.

## What was removed and where each behaviour now lives

### QA files (mine)
| File | Removed | The twin that remains |
|---|---|---|
| `tests/qa/f1-t3-plot.mjs` | sections A–G at 768x1024 (new `MAIN_AG` = 360x640, 1280x800) | `tests/e2e/plot.spec.mjs` `drawing`, `gesturesAndUnits`, `ftDrawing`, `draftsAndGuard` at 768x1024 touch (A–C drawing and refusals, D corner editing, E gestures and lost pointers, F sample, chip and labels, G drafts and guard). The same sections still run by touch at 360x640. O, L, N, I keep 768x1024. |
| `tests/qa/f1-t2-flows.mjs` | sections A–H at 768x1024 (`MAIN` = 360x640, 1280x800) | `tests/e2e/shell.spec.mjs` at 768x1024: `gating` (A–D), `skipAndEdit` (E), `drafts` (F, G), `focusAndTaps` (H, keyboard) |
| `tests/qa/f3-t2-editor.mjs` | section 9 "R5 end to end" (4 checks × 360x640, 1280x800) | `tests/e2e/r5.spec.mjs` at the same two viewports, with the same seeded state and more checks (see the sample below). QA's own R5 sentence oracle stays in `f2-t1-site.mjs` section 9. |
| `tests/qa/f3-t2-edit.mjs` | — | KNOWN entry for F3-T2 bug 1: **confirmed gone** (no `R.known` in the file). The header comment now says so. |

### e2e specs (FS / Designer owned; removed only as duplicates, listed here for the TL)
| Spec | Removed | The twin that remains |
|---|---|---|
| `plot.spec.mjs` | `borderLabels` (4 viewports) and `noFlip` (3 viewports), both functions deleted | `f1-t3-plot.mjs` L: the same 4 viewports, in m and in ft (first edge from the origin, open and closed edges, area label, plot pushed into the corners so edges run off the canvas, clear of the chip and Fit view, corner triangle). O: the same 3 viewports (apex dragged and thrown across, base corner, message, valid CCW state, then reload + exact resume through `end()`). |
| `questions.spec.mjs` | `keyboardR5` at 360, 640, 1280; `defaultsAndGroups` at 360, 1280; `fieldsAndUnits` at 360, 640; `previewAndConflicts` at 360, 1280; `gateAndRiders` at 360, 1280; `sliderGestureEnd` at 360 | `f2-t2-questions.mjs` K (360, 640, 1280), F (360, 768, 1280) + G layout, A (360, 640 touch) + B (360, 1280), C (360, 1280 with wheel, 640) + D (360, 1280), E (360, 1280), A Q3/Q8 "away and back" (360, 640). Kept here: `keyboardR5`, `defaultsAndGroups`, `previewAndConflicts` at 768; `fieldsAndUnits`, `sliderGestureEnd` at 768 + 1280; `gateAndRiders` at 640 + 768; `round2` at all three. |
| `edges.spec.mjs` | `tapMode` at 360, 640, 1280; `keyboardList`, `liveAndR5`, `clearing` at 360, 1280 | `f2-t3-site-rooms.mjs` B (360, 640 touch; 1280 mouse), C (360, 1280), D (360, 1280). Kept here: `tapMode` at 768; the other three at 640 + 768; `scaleAndLabels` at all four; `badDraft`. |
| `rooms.spec.mjs` | `addAndEdit`, `stairsAndLevels`, `fixAndR5` at 360, 1280 | `f2-t3-site-rooms.mjs` G (add form, 360/640/1280), H/I (rows, master, pairs), J (stairs, lift, single-level note, R5), K (level removal), L (conflicts and Fix), all at 360 + 1280; the R5 room-change question is also in `r5.spec` rooms(). Kept here at 640 + 768; `pairLimitsAndPlans` at all four, `keyboard`, `staleInvalid`. |
| `plans-view.spec.mjs` | `view` at 640; `problems` and `regenerateAndResume` at 360, 640, 1280 | `f3-t1-stage3.mjs` A (4 viewports: tabs, counter, labels, tap readouts m/ft, Fit view), B (no-layout at 360/640/1280: tab, banner text, "Go to room list" focus; unmet-pair warnings through `check3` at every viewport), D (360/1280: Regenerate asks after an edit / Cancel / fresh Draft, reload + Resume, Skip approves both); `f3-t2-editor.mjs` 6 (Regenerate texts, untouched Draft regenerates without a dialog, deterministic). Kept here: `view` at 360 (fit formula), 768, 1280 (labels with area); `problems`, `regenerateAndResume` at 768; `r5Rules` at 360 + 1280. |
| `plans-edit.spec.mjs` | `edit` and `interior` at 1280x800 | `f3-t2-editor.mjs` sections 1–8 by mouse at 1280x800 (QA move/resize oracle, 10 px handle radius, stair pans, overlap texts with aria-disabled Approve, the Approve toggle, back-to-Draft note, Regenerate texts, reload, stage 4 and stage 5, Back). Kept here: `edit`, `interior` at 360x640 touch; `keyboard`, `tiers` at 1280x800. |

### Sample: removed check → surviving check
1. plot.spec "apex dragged across the base: the plot is still counter-clockwise" → f1-t3 "O (m) apex dragged through the opposite edge: refused with a message, apex stays on its side" + "state is still a valid counter-clockwise plot".
2. plot.spec "after a reload the draft is offered, not discarded / and resumes exactly" (noFlip) → f1-t3 O `end()`: "the final state survives a reload (draft offered and resumed exactly)".
3. plot.spec "closed at the border: all four lengths and the area" → f1-t3 "L (m) closed plot from the origin: all four edges show their own length next to the edge" + "label count = 4 edges + area".
4. plot.spec "...also in feet" (border labels) → f1-t3 L (ft), the same checks in feet at all four viewports.
5. f3-t2-editor 9 "First-floor room change ...: one question naming only the First floor and its approval" → r5.spec "First-floor room change: one question naming only the First floor and only its approval".
6. f3-t2-editor 9 "stage-1 vertex drag ...: Cancel returns the vertex and keeps every plan" → r5.spec "size-changing corner release asks (F1-S3)" + "Cancel returns the corner; nothing resets".
7. edges.spec 360x640 "tapping again restores the automatic classes, marks gone" → f2-t3 "B sample: every non-street edge switches to the other class with one tap and back with a second, '*' label while set" (360/640/1280); tapMode still runs at 768.
8. rooms.spec 1280x800 "a 9th room is refused inline, nothing stored" → f2-t3 "G a 9th room on the First floor is refused inline, nothing stored" (1280).
9. questions.spec 360x640 "Enter in a size-changing field opens the R5 question and it stays open" → f2-t2 "K plans: ... + Enter: the R5 question stays open for an answer" (360).
10. f1-t2 768x1024 "G sample over a pending draft asks for confirmation" → shell.spec 768x1024 "sample over a draft opens the in-page dialog" / "dialog title".
11. plans-view 1280x800 "the link opens stage 2 at the First floor room list" → f3-t1-stage3 "B 'Go to room list': stage 2, Rooms group, the First floor's first room control focused" (1280).
12. plans-edit 1280x800 "Approved: pressed state" → f3-t2-editor "7 Approve: 'Ground floor approved.', aria-pressed true, 'Approved', tab badge ..." (1280).

### Mutation proofs (throwaway copies of the tree, `src/` untouched)
Each mutation breaks a behaviour whose duplicate I removed. The check that remains has to fail.
| Mutation | Surviving check run | Result |
|---|---|---|
| m1 `core/plot.js` canMove: the counter-clockwise guard deleted | f1-t3 `--only=360x640` (O) | caught: 16 failed (O apex / thrown / base corner, invariants) |
| m2 `ui/draw2d.js` edgeLabels: one position, one side only | f1-t3 `--only=360x640` (L) | caught: 9 failed (L m and ft: edge has no label, label count) |
| m3 `core/levels.js` plansSentence: a single floor always says "manual edits and approval" | e2e r5.spec | caught: 2 failed (360x640, 1280x800 First-floor room change) |
| m4 `core/site.js` toggleEdge: a second tap never clears the override | f2-t3 `--only=B`; e2e edges.spec | caught: QA 9 failed (360x640 B); e2e 3 failed (768 tapMode, 640/768 liveAndR5) |

## Timings (this machine, 4 CPUs, browser files 2 at a time; same command `node build.mjs && node tests/run-all.mjs`)
The orchestrator's baseline today was 525.0 s. My own baseline run on the untouched tests gave 511.1 s.

| Suite | Before (s) | After (s) | Checks before → after |
|---|---|---|---|
| unit (22 files) | 16.0 | 12.8 | unchanged |
| e2e plot | 37.0 | 29.9 | 512 → 400 |
| e2e questions | 65.5 | 32.6 | 932 → 432 |
| e2e edges | 48.7 | 24.5 | 501 → 249 |
| e2e rooms | 35.8 | 21.9 | 361 → 221 |
| e2e plans-view | 26.9 | 15.6 | 299 → 191 |
| e2e plans-edit | 17.5 | 12.6 | 110 → 65 |
| e2e shell | 46.1 | 43.1 | 596 (unchanged) |
| e2e r5 | 10.6 | 10.3 | 54 (unchanged) |
| e2e others (contract, fit-button, interior, plan-banner, plan-tabs, plans-phone, rooms-fit, site-legend, site-tapmode, start-card, summary-fit) | 42.8 | 38.4 | unchanged |
| QA F1-T1 | 74.1 | 73.2 | 185 + 2015 (unchanged) |
| QA F1-T2 | 93.6 | 72.5 | 831 → 654 |
| QA F2-T1 | 51.9 | 48.9 | 1143 (unchanged) |
| QA F1-T3 | 124.5 | 97.8 | 1037 → 822 |
| QA F2-T2 | 93.9 | 95.6 | 959 (unchanged) |
| QA F2-T3 | 102.3 | 103.3 | 1136 (unchanged) |
| QA F3-T1 | 72.4 | 73.8 | 13 + 205 (unchanged) |
| QA F3-T2 | 36.8 | 35.0 | 9 + 190 → 9 + 182 |
| **Full run** | **511.1** | **434.9** | all 0 failed |

Browser time summed over files fell from about 980 s to about 829 s. The margin under 480 s is 45 s; the F3-T3 plan
adds about 2 s. Final run after this report, with the in-flight F3-T3 work (Designer data tables, FS obs-5 unit case) in
the tree: exit 0 in 442.3 s, 0 failed in every file (unit 23 files 14.7 s).

## Notes for the TL (not blocking)
- Six FS/Designer specs changed, all in their run loops (plus two deleted functions in plot.spec). Each has an
  `A-16 trim` comment naming the twin. A focused FS run (`--e2e --only rooms`) now covers fewer viewports. The full
  run still covers every viewport.
- Not done and not needed: raising `--jobs` (the runner comment still says "2 cores"; the machine has 4). That would be
  a TL call, not a trim.
- The next trim, if one is needed: f2-t2 / f2-t3 (95–103 s) keep all of their sections; only e2e was trimmed against them.

VERDICT: APPROVED
