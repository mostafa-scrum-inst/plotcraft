# F4-T2 Step 0 QA report

Date: 2026-11-21. Author: QA. Brief: the QA focus list in `impl-review-step0.md` (items 0–9). Tested at commit `9a70a49`
plus my test changes (not committed).

## Summary

- **Verdict: PASSED. I found no bugs.**
- I wrote two new suites, a shared oracle and a runner:
  - `tests/qa/f4-t2-s0-core.mjs` runs in node: 14 checks, about 30 s.
  - `tests/qa/f4-t2-s0-ui.mjs` runs in the browser: 63 checks over 360x640 and 640x360 (CDP touch) and 1280x800 (mouse),
    about 54 s.
  - `tests/qa/f4-t2-ref.mjs` holds my own CD-5 oracle and the PM's texts.
  - `tests/qa/run-f4-t2.mjs` is the runner. It takes about 91 s in the full run.
- My expectations are my own, from CD-4 / CD-5 and goals-and-stories rounds 8 and 10:
  - the layout oracle;
  - a point-sampling CD-5 oracle (hall, core contact, host table, pairs, fixed point);
  - fill arithmetic;
  - the PM's exact texts;
  - rectangles from my `f3-t2-ref` editor oracle.
- **Full run** (`node tests/run-all.mjs`, `--jobs 3` default): **exit 0 in 409.0 s**, under the 420 s target.
  - That includes the new F4-T2 suite.
  - An earlier run in this round took 457.6 s, also green. My core suite then took 70 s, and the machine was shared with
    FS. I trimmed the core suite's streams before the second run: same checks, smaller seeded counts.
- **Mutations** (throwaway copies; I made no changes in `src/`): 10 tried.
  - 9 are caught:
    - grid-snap keep rule in `generate`;
    - an extra host type;
    - access at `> 0.8`;
    - `LOW_FILL` at `<=`;
    - `applyEdit` without the stale-plan guard;
    - Undo focus;
    - Undo "approved again" text;
    - no hall-access lines in the UI;
    - `minSnap` off.
  - 1 survives, and it is equivalent: Undo not cleared on a tab switch. Render drops the snapshot anyway when
    `undo.level !== level`. This matches TL note 1, which says the case is caught only in combination.

## Results by focus item

| # | Item | Result |
|---|---|---|
| 0 | f3-t2 oracle with the ft `min` candidate (marker `PC.plans.ctx(...).minSnap === true`) | done earlier (status line); `--qa --only f3-t2` green |
| 1 | CD-4 at 10 rooms | **pass.** `MAX_ROOMS_PER_LEVEL` is 10 and pairs stay 6. f2-t3 G (11th room refused, "n of 10", "10 more fit" texts) and f2-t2 E (level removal with "more than 10 rooms") pass, version-aware. 300 seeded 9–10-room programmes: 270 laid out, every one passes my oracle (each room once, inside, off stair / lift, no overlaps, sides, area). State path (10 Ground rooms, 5 stair positions × lift × m/ft × 50/60 %): 20 of 20 laid out and correct. At 360x640, 10 rooms in m and ft: every room labelled, labels inside their rooms, no two rooms' labels overlapping. f3-t1-stage3 C (maximum house, four tabs, all viewports) passes at 10 rooms per floor. |
| 2 | Generator identity | **pass.** 400 seeded 1–8-room programmes, 150 of them at 85–110 % fill, produce byte-identical output from Step 0 `generate` and a vm copy of the pre-Step-0 `layout.js` (`git show 726514a`). A further 15 programmes that only the retry range (0.75–1.25) lays out are identical too. Step 0 is about 4× faster on the same stream (1.5 s vs 6.7 s). Maximum house (B + 3 floors × 10 = 40 rooms, lift): all four plans laid out and pass my oracle. `PC.plans.sync` in node takes 230–330 ms. Entering stage 3 with it is covered by f3-t1-stage3 C. |
| 3 | CD-5 | **pass.** The host table equals my reading of the PM text. 38 hand cases match both my oracle and the app: 0.79 / 0.80 m, two 0.4 m gaps, exterior-only, stair 0.80 / 0.79 m, lift, pair partner, every host rule both ways, boxed Bedroom, unreached host, chains through a paired Living. 448 seeded laid-out levels (1–10 rooms, half with one room nudged) give the same list from the app and from my oracle, with 0 borderline cases. Sample: no line on either floor, by the app and by my oracle (Bathroom reached through the Maid's room). Live (360x640, 1280x800): a First-floor drag that boxes a room in shows one line per room in the PM's exact text, e.g. "The Bathroom 2 has no way in from the hall or stairs. Move or resize a neighbouring room to open one." Undo removes it, and Approve still works while it shows. |
| 4 | Low-fill hint | **pass.** Core: 48 % and 49.99 % show 48 / 49 (rounded down); exactly 50 % and 50.01 % show nothing; the sample shows none; default answers on a 40 × 40 m plot show G 12 %, First 10 %; m and ft give the same numbers. UI: "Rooms fill only 12 % of the Ground floor. Add rooms, choose larger sizes, or lower the footprint % (Q3)." is the same in m and ft; a plan set to 48 % shows the line, one at exactly 50 % does not. |
| 5 | Undo (all three viewports) | **pass.** Undo after a move and after a resize restores the plan exactly. Two edits then Undo undoes only the last, and no second Undo is offered. On an approved floor, edit then Undo restores the approval with "Last edit undone. Ground floor approved again."; a plain Undo says "Last edit undone.". Focus lands on Regenerate. The button's `aria-label` and tooltip are "Undo last edit", 44 × 44 px on touch. Undo is hidden after approve, approve + unapprove, a floor-tab switch (and stays hidden back on the floor), Regenerate, an R5 reset (Back, room size changed, Next), leaving stage 3 and Load sample (store replace). With Undo shown vs hidden, the tool row is not taller and the canvas size and scale are equal. They also equal the pre-Step-0 build (same state, one-off probe): rows 52 / 56 / 120 px; scale 17.31 / 14.88 / 38.81 px/m. |
| 6 | ft minimum | **pass.** At all three viewports, dragging the Living's front edge past the minimum stops at exactly 1.50 m in ft ("… × 4.9 ft") and in m. The result equals my oracle, and no guide line is drawn at the minimum. |
| 7 | Sample strip | **pass.** Strip and Skip show on stages 1 and 3 and are absent on stage 4 (f1-t2-flows D, f1-t1-layout, marker `PC.ui.shell.STRIP_STAGES` = [1, 3]). Skip from stage 1 (sample + Skip = 2 taps) and from stage 3 opens stage 5. |
| 8 | CTO items | **pass.** A room moved onto the lift only (sample with lift) is listed by `problems` and gets `canApprove` "overlap"; `approve` is refused; in the UI, Approve is disabled. In a seeded stream of 400 operations, every stale-plan edit (65), w / h ≤ 0 edit (52) and unknown id (46) is refused and changes nothing. The 237 fresh edits are stored with edited = true, Draft, and the unmet list from my adjacency; the other floor never changes. |
| 9 | Full run at `--jobs 3` | **pass: 409.0 s**, exit 0, against the 420 s target (FS: 360.3 s without the new QA suite). |

## Observations (no action needed)

1. **Phone scale with a full, large floor.** With 10 Ground-floor rooms on a 30 × 36 m plot at 60 %, the 360x640 plan
   fits at 13.2 px/m. That is under the 14 px/m the sample keeps, but every room is still labelled and no labels
   overlap. Larger footprints fit smaller, as before Step 0.
2. **Undo over a stale plan, only through a direct store change.** Undo stays offered if a store change makes the shown
   floor stale while stage 3 is open. The UI cannot reach that state: answers change only on stages 1–2, and leaving
   stage 3 drops Undo. Pressing Undo there would still restore only that floor's own earlier plan.
3. **Rate of CD-5 warnings in my stream.** 31.7 % of my seeded levels name a room. The stream includes nudged plans and
   random types. This is consistent with the PM's client note: about 1 in 4 laid-out floors.

VERDICT: PASSED
