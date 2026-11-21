# F3-T3 outcome review — Tech Lead

## Round 1 — 2026-11-21

### What I did
- **Read** `outcome.md` (203 lines) against:
  - my `plan-review.md` rulings and `impl-review.md` (rounds 1 and 2);
  - `qa-report.md` (round 1, PASSED, bug 1 and observations 1–5);
  - A-10 / A-11 / A-13.
- **Re-reviewed the bug-1 fix** (wardrobe anchor `fl`). It is in `impl-review.md` round 2, APPROVED.
- **Reran:**
  - `verify/check-colours.mjs`: all binding requirements met;
  - `data-tables.test.mjs`: 9/0;
  - `--qa --only f3-t3`: 16/0 + 234/0, no KNOWN entry.
- **Full run:** QA's mandatory full run, exit 0 in 462.3 s (`--jobs 2`), under the 8-minute target. Since then the tree has changed only in the one-value data fix, which the focused runs above cover.

### Assessment of outcome.md
It is complete and matches the code:
- **What was built:** §1 matches the data files and markup I reviewed (piece counts per type checked against `furniture.js`).
- **Files:** §2's file table is right; the FS item is pointed to `fs-obs5.md`.
- **Tests and how to verify:** §3 gives commands that work as written; I ran them.
- **Figures:** §5 is the current `check-colours` output (ruling 3, binding). It lists the post-plan data changes, all inside the approved rules: mat, basket, maid rug, wardrobe.
- **Bug 1:** §6 records the bug and its fix.
- **Art direction:** §7 is the 3D art-direction note in the A-10 wording I asked for. Block or floor quad = `roomTints`, enclosure walls = `wallInner`, stair and lift unmixed. It also gives light-rig assumptions, the season rules, the highlight colour and A-11 with the overlap epsilon.
- **Known limits:** §8 is honest: tuned without rendering, colour values with no on-screen twin before F4, `:has()` fallback, maid bed at s 0.60, small hints at 640x360, twilight.
- **QA sign-off:** §9 records it, as the protocol requires.

### Rulings
1. **QA obs 1, the `data-literals-only` lint is too loose: agreed; the lint is tightened, not replaced.**
   - Today the rule forbids only `=>` and a second `function`, so `groundBounce: Math.min(0.25, 1)` or `Date.now()` would pass. A-2 promises data files are literals only, and F4 will read these tables at build time.
   - **Owner FS, in F4-T1** (that task already opens `tests/lint-constraints.mjs` for the three-layer rules; no task is reopened). Rule for a `data`-layer file, after comments and string literals are stripped:
     - the only allowed tokens are the IIFE skeleton (`(function (PC) {`, `'use strict';`, `})(globalThis.PC = globalThis.PC || {});`), statements `PC.data.<name> =`, `{ } [ ] : , ;`, numbers (sign included), `true`, `false`, `null` and bare object keys;
     - every other identifier, and every `(` outside the skeleton, is a violation.
   - Bite proof: QA's `groundBounce: Math.min(...)` mutation must fail the lint, and all of today's data files (`palette2d`, `room-labels`, `look3d`, `furniture`, `sky`) must pass.
   - Until then QA's `f3-t3-data` check 1 (literal parse) is the guard. It runs in `run-all`, so nothing is unguarded meanwhile. QA keeps it afterwards as an independent oracle.
2. **QA obs 2, the overlap tolerance sits on a floating-point edge: agreed; A-11 updated.**
   - A-11 step 4 now says both tolerances are compared with 1e-9 slack. Inside is `>= lo − 1e-9` / `<= hi + 1e-9`. Overlap on an axis is `min(hi) − max(lo) > 0.01 + 1e-9`. So an overlap of exactly 0.01 m in doubles counts as allowed.
   - Binding on `PC.furnish.room` (F4-T2). F4-T2's unit test includes one room on the edge; QA's 2.5 × 5.0 m bedroom case works for it.
   - The Designer's `check-colours.mjs` still uses the bare `> 0.01`. No room in its set depends on the edge after the wardrobe fix, so it stays as it is. The suite oracle that counts is QA's `f3-t3-ref.mjs`, which already uses the epsilon.
3. **QA obs 3, twilight lighter than night: accepted as designed.**
   - A-13 defines night keys as `h < 5` or `h > 20`. The 22 h preset and every night key are ≤ L* 11.5.
   - The 19.5–21 h stretch is dusk. F4-T3's tests use A-13's night definition, not "after 20:00".
4. **QA obs 4, small hints at 640x360: accepted** (a hint, ≥ 3 px blocks asserted).
5. **QA obs 5, sample strip still on stage 4: not F3-T3.** It goes to the PM list below (product question; it does no harm).
6. **`--jobs` (impl-review round 1):** stays 2. The QA full run at 462.3 s confirms there is margin.

### Required changes
None.

### For the F3 feature review (PM + CTO)
Carried from `docs/03-tasks/F3-T2/outcome-review.md` and RESUME batch-8 item 3, plus F3-T3 items (marked **new**).

**PM decisions**
1. **Low-fill warning** (QA F3-T1 obs 1): rooms huddle on a big floor. Decide together with the older rider "default answers leave most of each floor as hall".
2. **Unmet "next to each other" pairs** (QA F3-T1 obs 4): add a hint, or accept the silent miss.
3. **No circulation rule** (QA F3-T1 obs 5): a known limit to tell the client.
4. **Editing comfort on phones** (QA F3-T2 obs 2): one-finger pan is hard, and the only undo is Regenerate. The options are a one-step "Undo last edit", a pan-only mode, or accepting the two-finger pan. TL recommends the one-step undo if anything (FS, small, before F5).
5. **1.5 m minimum in ft** (QA F3-T2 obs 4): the edge stops on the 1 ft grid, at 1.71 m. Accept it, or make the minimum a snap candidate (small FS change).
6. **Client question: is 8 rooms per floor enough?** Answer it or ask the client. A higher cap changes generator runtime and the A-11 mesh count (8 pieces × rooms per level, still one batch).
7. **Known limits to acknowledge:**
   - keyboard room editing is out of scope;
   - corner resize only if the client asks (F5-T3);
   - Clear followed by an identical redraw keeps the plans (A-7, round 6).
8. **Stories now end to end, for re-check:**
   - F1-S3: R5 on vertex release;
   - F1-S5: all levels generated;
   - F3-S4: Q18 / Q19 hints with the round-7 texts (**new**);
   - Skip to 3D lands on the static stage 5; the G1 tap count waits for F4-T1.
9. **New: the sample strip** ("Sample project loaded · Skip to 3D") stays visible on stage 4 after every floor is approved (QA F3-T3 obs 5). Keep it or hide it beyond stage 3. Either is a small change.
10. **New, F3-T3 known limits to acknowledge** (outcome §8):
    - the maid bed shows at 60 % size in 1.5 m-wide maid rooms (anchored pieces never rotate);
    - a few sparse pieces scale to 0.70 in 3:1 rooms;
    - browsers without `:has()` show the Q19 hint in Modern colours.

**CTO items**
1. **F1 real-device gate: still OPEN** ("testing guide sent 2026-11-21", no answers recorded). The CTO's F2-review condition is unmet. The CTO decides whether F3 closes without the answers. The unverified areas are the stage-3 editor by touch and now the stage-4 hints on a real phone.
2. **Runtime:**
   - the QA trim took the full run from 511 s to 435 s; with F3-T3 it is 462.3 s, under the 8-minute target;
   - `--jobs` stays 2 (TL ruling: a timing-stability trade-off on 4 CPUs; it changes only after two green full runs at `--jobs 3`);
   - F4 adds mock-based 3D suites, so the next trim candidates are f2-t2 / f2-t3 (95–103 s each; `qa-trim.md`).
3. **Hand-off to F4:**
   - the house model (A-9) reads the approved `plans[*].rooms` (frame P) and `PC.layout.core`;
   - the Q14 convention is binding;
   - stage 5 gets its controller in F4-T1 (removes the static banner);
   - **F4-T1's plan review must show the THREE mock first** (CTO standing instruction);
   - **new**, the look tables are ready for F4 in the A-10 / A-11 / A-13 schemas, with outcome §7 as the art-direction note:
     - F4-T1 reads `exteriors`, `roomTints` + `floorMix` and `siteColors`;
     - F4-T2 implements A-11 exactly, with the new 1e-9 slack;
     - F4-T3 implements the day-weighted A-13 blend with `groundBounce` from data.
4. **New, the first real look at the colours.** Every hex was tuned with a Lambert estimate, not rendered WebGL. The F4-T1 publish (A-16) is where the client and the team first see them. A retune is data-only and the tests guard rules, not exact hex values. Recommend the phone check after F4-T1 explicitly covers "colours / contrast / dark at night".
5. **New, lint gap** (ruling 1): data files are not yet enforced as literals by the lint. The FS tightens the lint in F4-T1, and QA's check guards it meanwhile.
6. **Store commit cost:** one commit per release; nothing measured as slow. Revisit only if real phones feel slow.
7. **Republishing:** the current build (stages 1–4 with the F3-T3 hints and the Q10 swatches) can be republished with the batch, or held until F4-T1 brings real 3D. Orchestrator's call; TL recommends holding for F4-T1 unless the client is testing now.

### Designer F5-T3 polish list (added by this task)
- Stage-4 cards at ≥ 640 px: name and radio right-aligned under the hint, description left-aligned (F3-T2 grid).
- 640x360 hint blocks at 3.9 px: legible as "more vs fewer" only.

VERDICT: APPROVED
