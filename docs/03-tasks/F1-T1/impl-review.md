# F1-T1 implementation review — Tech Lead

## Round 1 — 2026-11-19

### What I did
- Ran `node build.mjs` myself: exit 0, `dist/index.html` 110.7 kB, 3 scripts, 10 stylesheets. `build.mjs` is byte-identical to the A-17 reference (diffed against the code block in `architecture.md`).
- Read `src/index.html` end to end (shell, five stages, dialog layer, all templates), the three JS files, and the CSS for the rules that matter to the constraints (`10-base`, `20-shell`, locked-step and disabled styles, media queries, `:has`).
- Checked `dist/index.html` mechanically: exactly one `http(s)` string (the three.js r128 tag, placed before the app scripts); no `on*=` handler attributes; no `style="…"` attributes; no `<form>`, `<img>`, `@import`, `url(…)`, `javascript:`; the only `<link>` is the `data:,` icon; fonts are the two system stacks only.
- Ran `node docs/03-tasks/F1-T1/verify/shots.mjs`: **659 passed, 0 failed** (reproduces the Designer's figure). Read `assertions.mjs`: the checks are real (page scroll width/height, 44 px boxes on `button, [role=button], input, select, summary`, stepper on one line and not overflowing, bar in viewport, canvas minimum, one whole question visible, strip/caption intersection tests).
- Looked at screenshots: `s1-start-360x640`, `s2-site-strip-360x640`, `s2-rooms-list-360x640`, `s3-360x640`, `s4-360x640`, `s5-light-360x640`, `s5-tour-360x640`, `s2-site-640x360`, `s5-640x360`, `s2-rooms-1280x800`.

### Findings
**Constraints: pass.** Single external URL; classic inline scripts in manifest order; `ns.js` follows the A-2 module form; `palette2d.js` is literals only; no inline handlers or style attributes (nothing here needs a CSP exception beyond the inline `<script>`/`<style>` blocks that a single-file deliverable implies); `touch-action: none` on canvases inside `.pc-canvas-wrap`; `:focus { outline: none }` is paired with a `:focus-visible` ring; locked steps are `aria-disabled` buttons without `pointer-events: none` (they stay tappable, as F1-S4 needs).

**Layout: pass.** The screenshots show a coherent, legible design at all three classes of viewport. Back/Next are grid rows and always in view; the stepper is one line at 360 px; the 3D panel is within the one-third limit; the short-landscape two-column layout works (stage 2 shows a whole question, stage 5 keeps a usable canvas).

**Hook contract: complete for F1-T2 and F1-T3** (stepper, toast region for the locked reason, dialog with extra slot, start panel parts, sample strip, `btn-next-label`, both unit groups, all plot hooks, message lines with `data-kind`). Choice `value`s match A-4. Templates cover every repeated item. Three gaps for later tasks are listed under required changes.

### Rulings on the reported deviations
| Deviation | Ruling |
|---|---|
| Start card docked to the bottom of the plot canvas on phone | Accepted. It leaves the top of the grid free; FS hides `start-panel` when the first point is placed or a plot exists (F1-T2/T3). |
| Stepper: all labels from 720 px, full labels from 1100 px | Accepted (F1-S4 only requires one line at 360 px; the verify script checks overflow at every viewport). |
| Stage 3 warnings chip moved to the message row | Accepted. |
| Room rows use `<select>` for size | Accepted; values unchanged, and it removes the radio-name problem in cloned rows. |
| Site preview hidden via CSS `:has()` when another group is open (phone/tablet) | Accepted. Needs Chrome 105 / Safari 15.4 / Firefox 121 or later; without it the preview simply stays visible, which costs space but breaks nothing. Check on the real phone at the F1 publishing point. |
| Question group titles visually hidden below 900 px | Accepted; the tabs carry the names and the headings stay in the accessibility tree. |
| Extra hooks (`-dec`/`-inc`, `q-stairs-box`, `room-area-box`, `room-area-unit`, `room-add-area-unit`, `plan-error-text`, template parts) | Accepted; all go into the outcome hook table. |
| Only sliders have an `-out` hook | Accepted; text inputs show their own value. |

Rulings on the flags:
- **Stage 2 with the sample strip leaves 124 px for questions at 360x640.** Decision for F1-T2 (FS): the strip is shown on stages 1, 3 and 4 only, never on stage 2 or 5. No design change needed.
- **3D Light pane passes the one-third limit by 1 px.** Accepted as is. Nothing may be added to that pane; F5-T3 owns any rebalancing.
- **`v3-level` ships only the `all` radio.** Correct: the other choices are cloned from `tpl-v3-level` per existing level.
- **`index.html` authored with a throwaway generator not in the repo.** Accepted: `src/index.html` is the source of truth and is hand-edited from now on. It is readable (stage and template banners; 7 lines over 400 characters, all option lists or SVG).
- Additional contract attributes I am accepting besides `data-pc`: `data-stage` (stage sections), `data-q` (question blocks, used by "Fix" to scroll to a question) and `data-kind` (message kind). Recorded in A-2.

### Required changes
1. **Pool size labels hard-code metres** (`S · 3 × 6 m`, …, inside `q-pool-size`), with no hook on the text. In ft mode FS cannot convert them without looking elements up by class, and R4 requires every unit-bearing value to follow the unit. Either give the three label texts hooks (`q-pool-size-s-text`, `-m-text`, `-l-text`) or reduce the labels to S / M / L and add one `q-pool-size-note` line that FS fills with the dimensions in the current unit.
2. **Add-room block has no place for "S/M/L shows the area it stands for" (F2-S2)**; only the room rows have `room-area-hint`. Add a hook for it (`room-add-size-hint`), or relabel the "Exact area" field to "Area" and state in the hook table that FS shows the S/M/L area there (disabled) and enables it for Exact. Your choice; say which in the hook table.
3. **Tour start button reads "Tour"**; the story and QA's script call it "Start tour". Give `v3-tour-start` the accessible name "Start tour" (`aria-label`, or the visible text from 480 px).

Re-run `shots.mjs` after the edits; `hooks.json` / `values.json` updated accordingly.

### Non-blocking notes
- For FS (F1-T2): `room-master` is the checkbox inside a label with no hook of its own; hide it for non-bedrooms through `input.closest('label')`, not a class lookup. Slider `min/max/step` for `q-ceiling` are in metres and must be rewritten by FS in ft mode.
- `plan-counter` contains a `<strong>`; FS sets its content as a whole.
- The verify assertions are in good shape to be lifted into `tests/e2e/` in F1-T2; do that rather than rewriting them.
- Phone stage 2, Site group: the preview takes about 200 px; the collapse toggle exists (`site-preview-toggle`) and should default to open. Revisit in F5-T3 with real content.

VERDICT: CHANGES REQUESTED

---

## Round 2 — 2026-11-19

Rebuilt (`node build.mjs`: 110.9 kB, one external URL), re-read the three changed places in `src/index.html`, re-ran `verify/shots.mjs`: 659 passed, 0 failed.

| # | Status | Evidence |
|---|---|---|
| 1 Pool labels | Resolved | `q-pool-size` choices read S / M / L; new `q-pool-size-note` line carries the dimensions for FS to rewrite per unit (line 354). |
| 2 Add-room size hint | Resolved | `room-add-size-hint` under the size control ("M bedroom = 16 m2" placeholder, line 290). |
| 3 Start tour | Resolved | `aria-label="Start tour"` on `v3-tour-start` (line 520). |

Both new hooks are in `verify/hooks.json`.

### Required changes
None.

### For QA
Focus on the F1-T1 acceptance list at 360x640, 768x1024, 1280x800 and 640x360 with each stage forced visible: no page scroll, 44 px targets, stepper on one line, Back/Next in view, 3D panel within a third of the canvas; then check independently of the Designer's script that every hook in `hooks.json` exists once and choice values match A-4, that `dist/index.html` has one external URL and no handlers/forms, and body-text/button contrast of 4.5:1 from the tokens.

VERDICT: APPROVED

---

## Round 3 (QA fixes) — 2026-11-19

QA failed the task on two major clipping defects at 360x640 and three minors (`qa-report.md` round 1). My round-1 screenshot sample did not include an open summary sheet or worst-case readout values, which is how these got past me; QA's state matrix is the right standard and I will use its states in later UI reviews.

### What I did
- Rebuilt: `dist/index.html` 113.4 kB, still one external URL. CSS files all under 300 lines (largest 199).
- Ran `node docs/03-tasks/F1-T1/verify/shots.mjs`: 659 passed, 0 failed. Ran `node tests/qa/run-f1-t1.mjs`: "all checks passed" (the 16 earlier failures are gone; only the informational notes remain).
- Read the changed rules: summary sheet (`41-stage-questions.css` 92–105, 143–146, 161–162), room-row grid and pair builder (69–76, 129–130), focus rules (`10-base.css`, `30-components.css` 47–48, 148, 199, `44-stage-3d.css` 44, `31-overlays.css` 67), `scroll-padding` (`10-base.css` 39). Confirmed no markup, hook or value change (the contract check in the QA suite passes with the same 202 hooks).
- Looked at fresh screenshots: `s2-summary-open-360x640`, `s3-max-360x640`, `s3-max-640x360`, `s1-strip-msg-360x640`, and two captures of my own of cloned room rows with the longest type names at 360x640 and 640x360 (QA's `s2-rooms-list-scrolled-360x640.png` on disk is a stale round-1 file, so I did not rely on it).

### Per bug
| Bug | Status | Evidence |
|---|---|---|
| 1 Summary sheet cut off (major) | Fixed | Open sheet is now an absolutely positioned bottom overlay inside `.pc-qs` with `max-height: calc(100% - 48px)`, a flex column whose body is the scroller (`min-height: 0`). Screenshot: all rows visible, conflicts with their Fix buttons reachable by scrolling, toggle stays at the top, Back/Next uncovered. Desktop and short-landscape overrides keep their static/full-column behaviour. |
| 2 Readouts truncated (major) | Fixed | Stage 1 shows `6458 sq ft`, `318.0 ft`, `12` in full; stage 3 shows `Master bedroom`, `16.4 × 19.7 ft`, `323 sq ft` in full at 360x640 and (stacked) at 640x360. |
| 3 Select text truncated (minor) | Fixed | Room-row grid 1.3 / 1.08 / 0.82 with tighter select padding: "Maid's room", "Bathroom", "Basement", "Exact" all whole at 130 / 108 / 82 px; pair builder is two columns with the button on its own row on phone. |
| 4 Four level tabs at 640x360 (minor) | Fixed | State icon sits under the name on narrow/short viewports; "Basement" fits, row no longer wider than the panel. |
| 5 Focus ring clipped (minor) | Fixed | Inset rings (`outline-offset: -3px`) on the controls that sit against clipping parents; `scroll-padding: 8px` on the scrollers. |

### Notes for later tasks (not blocking)
- F2-T2 (FS): on phone the open summary covers the questions, so tapping a conflict's "Fix" must collapse the sheet before scrolling to the question.
- QA's suite lives in `tests/qa/` with its own runner. F1-T2's `tests/run-all.mjs` should run `tests/qa/run-*.mjs` as a further step so there is still one command (A-16 updated).

### Required changes
None.

VERDICT: APPROVED
