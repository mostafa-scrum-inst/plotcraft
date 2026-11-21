# F4-T1: Designer fix for TL impl-review condition 1 (disabled Light controls), and FS item 3

Owner: Designer, 2026-11-21. Source: `impl-review.md` condition 1 and item 3.

## Condition 1: the disabled controls now look disabled
**The problem.** On stage 5, the disabled time slider (blue thumb), the Season and "Go to room" selects, and, faintly, the icon preset buttons still looked live. Only `.pc-btn`, `.pc-opt` and `.pc-switch` had disabled styles.

**The change.** `src/css/30-components.css`, 13 lines, placed after the `.pc-range` rules. Every disabled control now uses the same muted set as `.pc-btn:disabled` (`--sunk` background, `--rule` / `--border` lines, `--ink-3` text, `cursor: not-allowed`):
- **`.pc-range:disabled`:**
  - the track becomes `--rule`;
  - the thumb becomes `--sunk` with a 1 px `--border` ring (was an `--accent` fill and ring);
  - `cursor: not-allowed`;
  - the `output` right after the slider turns `--ink-3`.
- **`.pc-select:disabled`:**
  - `--sunk` background, `--rule` border, `--ink-3` text, `cursor: not-allowed`;
  - the drawn arrow becomes `--ink-3`;
  - `opacity: 1`, so the browser does not fade it a second time.
- **`.pc-btn--icon:disabled`** (and `[aria-disabled="true"]`): the icon is at 0.5 opacity. The button already had the `.pc-btn:disabled` box. Its thin line icons stayed nearly as dark as live ones; they now read as muted as the Tour button. The tour Pause and Stop buttons pick this up too.

**Where it applies.** These are generic component rules; no other stage disables a slider, select or icon button today.

**Tour-speed radios (TL optional point): left as they are.**
- The disabled "Normal" shows struck through on the selected tint. That is the existing `.pc-opt` disabled style, also used on stage 2 (e.g. Pitched when it is unavailable).
- It reads as "this is the setting, not available yet". Changing it here would change stage 2 too.

**Check.** `tests/e2e/view3d.spec.mjs` `phone()` at 360x640 has one added check. Computed styles show:
- slider `cursor: not-allowed`;
- `v3-time-out` colour = `--ink-3`;
- both selects: background = `--sunk` and colour = `--ink-3`;
- preset icon opacity 0.5.

The thumb and track are pseudo-elements: Chrome returns no computed style for `::-webkit-slider-thumb`. They are verified by the screenshots in `designer-shots/` (360x640 Light and Tour tabs, 1280x800 panel).

**Mutations.** Removing the select rule fails the check (2 values), and removing the icon rule fails it (opacity 1).

**Runs.** `--e2e --only view3d,questions,rooms,contract`: all passed, view3d 46/0 and view3d-real 38/0. No full run (QA is testing in parallel).

## TL item 3 (`HOUSE.outerK` 8 → about 36): yes, now (FS)
- In every `shots/` image (360x640 sand, and 1280x800 in all four exteriors), the `groundOuter` edge cuts a sky-blue wedge into the top corners.
- It reads as a table edge, competes with the model and looks like a rendering error on a phone.
- With the ground reaching the far plane, the neutral `groundOuter` (#B3B0A6) fills the view, as A-10 / my F3-T3 art-direction note intend ("groundOuter stays neutral so the plot edge reads").
- The look is unchanged otherwise. It is a one-constant FS change; please include it before the publish.
