# F6-T2 plan review and S0 review (TL), 2026-11-23

Reviewed:
- `plan.md` (FS, 511ca40);
- S0, `build-strip.mjs`, on f6t2 at ee6e336 (head fa5dbd4);
- against `cto-constraints.md` (650dba3) and `designer-plan-review.md`.

I rebuilt the dist on f6t2 locally. It came out byte-identical to the committed dist, and the build took 0.2 s.

## S0: comment strip, approved
1. **Correctness.** The method is sound. V8 decides every candidate: a `\u0001` probe causes a syntax error on the same line only when the `//` or `/*` is in code. Inside a string, template, string continuation or block comment the character is legal, so those lines are kept.
   - A regex literal cannot start with `//` or `/*` and cannot span lines, so regexes are safe.
   - The script must parse before the strip, so the probe is the only possible error.
   - Every removed comment was a whole line, so no line terminator is lost and automatic semicolon insertion is unchanged.
   - A block comment with code after it keeps that code on its own line.
2. **Tests and mutations** cover the risky cases: strings, templates, string continuations, regexes, trailing comments and code after `*/`. A value-equality check and a dist that parses complete the evidence. Both mutations are caught.
3. **Size:** 605 023 → 494 146 B (gzip 126.3 kB). C-1.3 stays at 627 302 B, as the CTO required.
4. **Gate on the stripped build:**
   - median 415.6 s (the "three" step at 16.1–16.7 s shows a slower host than main's runs);
   - QA_FULL about 463 s;
   - C-4.8 solo 147 ms;
   - loaded build 944 ms against the 1200 ms guard;
   - texgen 91.9 ms.
   The release stream hit its 260.2 s NOTE only when it ran straight after the QA_FULL pool; run on its own it took 244.7 s. **Gate met.**
   - **Note for the T2 gate:** the margin is about 4 s, and the release stream is at its NOTE line. T2's checks must buy back their own time (CTO §6). Use the third release process only under conditions a–e.
5. Error stack line numbers in `dist` no longer match `src`. That is acceptable: source maps are out of scope, and the `/* js/... */` markers stay.

## Plan: approved, with these rulings

The plan covers every item from the Designer-plan review and CTO §8. That includes the program count from 12 h to 22 h through `renderer.compile`, the highlight against lit windows at 22 h, the ≤ +10 s limit in `view3d-real`, and the median-of-3 gate.

1. **F1, hall floor: planks in `textured`,** as the Designer's table reads. It costs no extra mesh. The PM's Ground-only test covers hall against room contrast, using the same shots.
2. **F2, gate lamps in the ground level's `lamps` batch: accepted.**
   - One visible side effect: when the level selector hides Ground, the gate lamps go dark while the gate stays.
   - The Designer judges this in the 22 h shots. If it reads wrong, move the gate lamp heads into `glazing` instead (it is emissive and always present in exterior mode), at no mesh cost.
   - Record the choice in the impl notes.
3. **F3, the atlas-seam threshold:**
   - **Where:** at 1280x800, dollhouse, Ground, noon, on real r128.
   - **What:** across every cell-tile boundary inside a floor, compare the mean luma of the boundary pixel column with the mean of the two columns on each side.
   - **Pass:** the difference is ≤ 4 levels (8-bit), and ≤ 1.5 × the in-cell column-to-column spread measured on the same floor.
   - The mutation "padding 0" must fail it.
4. **F4, shadows marked dirty only on a relevant change: approved, with a precise rule.**
   - Mark dirty when any of these differs from the last update:
     - sun direction or intensity;
     - shadow-camera bounds;
     - canopy visibility.
   - Keep these as unconditional triggers (CTO F6-T1): build, restore, level selector and Roof.
   - An `indoor`-only change, or an identical look, does not count.
   - The `scene.test` count rows get the new expected numbers, with the reason in the impl notes (A-16).
   - Add a mutation: a sun change no longer marks shadows dirty. The real-r128 stale-map check must catch it.

## Build order
S1 → S2 → S3 → S4 as in §0. Each step lands as its own commit, with node tests green and its mutations listed. The Designer retunes after S3. The impl review comes after the S4 gate.

VERDICT: APPROVED
