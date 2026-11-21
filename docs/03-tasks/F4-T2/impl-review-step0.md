# F4-T2 Step 0 implementation review (TL, step 3d for Step 0) — round 1, 2026-11-21

Reviewed: commit `f93c3df` (C0 + Step 0), against `plan.md` §C0–§3, my `plan-review.md` (Q1 exactness conditions, Q4, Q6, required items 1 and 4), PM round 10 (`goals-and-stories.md`: CD-5 refined definition with host table, texts, Undo on tab switch, approval-restored message) and the Designer's Undo placement (`designer-plan.md` §1).
Code read: the full `core/layout.js` diff (prefix walk, branch and bound, mask-order replay, column memo across shapes and subsets, size-keyed cell share, f = 1-first phase skip, assignment bound, pair table, `access`), `core/plans.js` (ft `min` candidate, `applyEdit` guard, `noAccess`, `fill` / `lowFill`, `snapshot` / `undoable` / `undoEdit`), `core/const.js` (10 rooms, `HALL_ACCESS`, `LOW_FILL`), `ui/plan-editor.js`, `ui/stage-plans.js`, `ui/shell.js`, the markup and CSS, and `tests/run-all.mjs` (C0).

## Own probes

- **Independent identity check.** On my own seeded stream (seed 777, not the FS streams), I compared the previous `layout.js` (HEAD~1) with the new one.
  - The stream: **3 000 programmes**, 1–8 rooms, footprints 0.4–2.6:1, fill 25–105 %, pairs, every stair position, lift.
  - **About 40 % of the programmes used all-equal room areas**, to provoke the exact score ties the 1e-9 rule decides.
  - Result: **0 differences** in `JSON.stringify(generate(inp))`. Time 4.3 s old against 4.3 s new: no slowdown at n ≤ 8.
- **Focused runs.**
  - `node --test` layout10 + access + house: 15/0 in 7.3 s. This includes the 105-case grid under 300 ms, the 9–10 stream (300) matching the golden within 10 s, and the TL Q6 `reachable` case.
  - `--unit --e2e --only plans-step0,plans-edit,rooms,shell`: all green in 63.4 s (plans-step0 50, plans-edit 65, rooms 234, rooms-fit 490, shell 596).

## Q1 exactness: the two extra FS speed-ups, judged against my conditions

1. **Cell layouts shared by cell size** (`sk = w x h | ids`): exact.
   - `layoutShape` builds cell-local rects (`x: pos / off`) and reads only the shape's `w` / `h`. `variants()` places them with the cell's own `x` / `y`.
   - So two cells of the same size with the same ordered rooms have the same layout by construction. The key uses the stored doubles, so equal sizes give equal strings.
   - The per-order column memo is keyed by `(S, f)` and the group's room-index bitmask. In the order's room list that bitmask determines the contiguous group and its order, so this is exact too.
2. **f = 1 phases first; the fFill phases are skipped when `4 (fFill − 1) n > m + 1e-6 + 1e-9`**, where `m` is the least leaf score of the first f = 1 phase that has a leaf.
   - Every fFill leaf is then worse by more than 1e-6 than an f = 1 leaf that the original order would reach later.
   - In the original order, any fFill result is replaced by the time the run reaches that f = 1 leaf. The two runs (with and without the fFill prefix) can only part on chains of near-ties within 1e-9 *at the optimum*. That is the same tolerance class I accepted for branch and bound with the 1e-6 margin.
   - The replay order of the phases (fFill 0, fFill 1, f1 0, f1 1) is kept, and the f = 1 walks prune with a start ≥ the original's. **Accepted as meeting the conditions.**
   - The evidence for both: the 8-room golden, the 2 400 sweep hashes, the 10-room golden (grid 105 + stream 300) and my 3 000-programme check, all byte-identical.
3. **The other speed-ups** match the ruling: prefix pruning, branch and bound at 1e-6, survivors replayed in mask order with the 1e-9 rule, the column memo across shapes.
   - **The assignment bound** (`score − bonus ≥ worst listed`) is exact: cell scores are ≥ 0 and the hall bonus is at most 2. The comparison keeps the original strict `<` entry rule.
   - **The pair table** gives the same booleans as before, because the same-cell case only ever reads `va = vb`. `unmet` keeps the pair order, and rects are built only for an improving combo.
- **Gate met:** the 10-room grid worst is about 90–160 ms (gate 300 ms), and the 9–10 stream takes about 4 s. No n ≥ 9 fallback was needed, so the 10-room golden is the post-key-fix original.

## Plan rulings and required items: met

| Item | Verdict |
|---|---|
| C0 `--jobs 3` default, comment, A-16 | met |
| 0.1 CD-4: `MAX_ROOMS_PER_LEVEL` 10, key `ci * (1 << n) + mask`, regression test (9 / 10 rooms with pairs naming r9 / r10), 10-room proof (grid, stream, golden), drafts forward-only (A-4 sentence) | met |
| Q4 pairs 6 | met |
| 0.2 CD-5 per PM round 10: hall / core contact ≥ 0.8 m on non-exterior sides; reached through a pair partner or the `HALL_ACCESS.hosts` table (Bathroom ← Bedroom / Maid; Storage / Laundry ← any room other than Bathroom / Storage / Laundry: the table matches the 10 types exactly); fixed point; the sample is clean; derived, never stored; `[]` for a stale plan | met |
| 0.3 low fill (strict `< 0.5`, whole % rounded down, drawn areas + core) and PM text | met |
| 0.4 pair text | met |
| 0.5 Undo: content-guarded (`undoable` = deep-equal `after`); restores the approval; dropped on Regenerate, tab switch, stage entry and replace; hook `plan-undo`; Designer CSS; focus to Regenerate; PM messages incl. "… approved again." | met |
| 0.6 ft minimum as a `min` candidate (ft only, no guide drawn) | met. **QA's f3-t2 oracle needs it (below)** |
| 0.7 `STRIP_STAGES = [1, 3]` (exported read-only for the QA marker) | met |
| 0.8 lift in `overlaps` (CTO debt 6) | met |
| 0.9 `applyEdit` guard (stale plan, w / h ≤ 0) | met |
| 0.10 / Q6 the refusal's `reachable` half, pinned by the Q4-vegetation state | met |

## Non-blocking notes

1. **Undo tab-switch mutation is caught only in combination.** Add one check to `plans-step0.spec`: edit on Ground → switch to First and back → `plan-undo` hidden. That is about 1 s. FS, with F4-T2 proper.
2. **Mutation S6** (choosing `m` as the minimum of both f = 1 phases instead of the first with a leaf) survives. Accepted as near-equivalent: both bound every fFill leaf by a real f = 1 leaf.
3. **Lint length warnings.** `layout.js` is 383 lines and `stage-plans.js` 320, against a target of 300. Move `access` (about 55 lines) to a new core file `core/access.js` (namespace stays `PC.layout.access`) when F4-T2 proper next touches core. `stage-plans.js` can stay; it is only a warning.
4. The hall-pocket limit (CD-5) goes into the F4-T2 outcome as a known limit (PM round 10).

## QA focus list (Step 0, in the F4-T2 QA round)

0. **First:** update `f3-t2-edit` / the `f3-t2-ref` oracle for the ft minimum candidate (marker `PC.plans.ctx(state, id).minSnap === true`). The 6 failing ft checks must pass before your full run.
1. **CD-4 at 10 rooms in the UI.**
   - Add up to 10 rooms per floor; the 11th is refused with the "10" texts; group counters read "n of 10"; the removal question.
   - Stage 3 lays out 10 rooms (with lift, every stair position, m and ft), and the labels stay readable at 360x640.
   - Use your own oracle on generated 9–10-room plans: every room present exactly once, no overlaps, inside the footprint and off the core.
2. **Generator identity.** Your own seeded stream at 1–8 rooms against a pre-Step-0 copy of `layout.js` (byte-identical results), including the retry range, plus the maximum house (4 x 10 + lift) entering stage 3, with the node time logged.
3. **CD-5** per the PM round-10 definition, with your own oracle.
   - Cases: 0.79 / 0.80 m; exterior-only sides; stair / lift contact; pair-partner reach; each host rule (Bathroom ← Bedroom / Maid only; Storage / Laundry ← all but Bathroom / Storage / Laundry); chains.
   - The sample is clean on both floors. The warning appears and disappears live after a drag, never blocks Approve, and uses the PM's exact text with room numbers where names repeat.
4. **Low-fill hint.**
   - It shows at 48 % and not at exactly 50 %.
   - It is absent on the sample.
   - It shows on the default answers on a large plot.
   - m and ft give the same text.
5. **Undo** (touch 360x640 and 640x360, mouse 1280x800).
   - Undo after a move and after a resize.
   - After an edit that un-approved: the approval comes back with "… approved again.".
   - It is hidden after Regenerate, an R5 reset, approve / unapprove, a floor-tab switch, leaving stage 3 and Load sample.
   - One step only. Focus lands on Regenerate.
   - The tool row is not taller and the canvas scale is unchanged (≥ 14 px/m at 360).
6. **ft minimum.** Shrinking an edge stops exactly at 1.5 m (4.9 ft) in ft; m is unchanged; no guide line is drawn for the minimum.
7. **Sample strip.** Absent on stage 4; present on 1 and 3; Skip from 1 and 3 is unchanged (G1 2 taps).
8. **CTO items.**
   - A room overlapping only the lift is reported and blocks Approve.
   - An edit to a stale plan is refused (unit-level: your random-op suite with stale-plan edits).
9. **Full run** at `--jobs 3`, against the 420 s target (FS measured 360.3 s).

VERDICT: APPROVED
