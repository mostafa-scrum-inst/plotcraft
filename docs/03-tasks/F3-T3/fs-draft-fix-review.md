# F3 debt item 1: stale plans make the draft unrestorable (FS fix) — Tech Lead review

## Round 1 — 2026-11-21

### What I read and ran
- **Read:** `fs-draft-fix.md` (plan and results); the CTO finding 1 and debt items 1 / 8 in `docs/04-feature-reviews/F3.md`.
- **Code:** the diff of `src/js/core/draft.js` (`plansOk`, `validState`); `src/js/ui/start.js` `init`; `src/js/ui/storage.js`; `src/js/core/levels.js` `removeLevels`; A-4 and A-7 (`PC.sig.level` holds the level's room ids).
- **Tests:** the new cases in `tests/unit/draft.test.mjs` and `staleDraft` in `tests/e2e/rooms.spec.mjs`.
- **My runs:**
  - `node tests/run-all.mjs --unit`: 345/0;
  - `--e2e --only rooms.spec,start-card,r5`: rooms 234, start-card 14, r5 54, all 0 failed.
- **My own random probe** (scratchpad, node, not committed):
  - Setup: 300 runs of 8 operations from the synced sample, 2 400 states. The operations are `removeRoom`, `updateRoom` to the other level, `removeLevels` floors 2 → 1 (move or delete, on a clone kept only when `ok`, as `q-rooms.js` does) and `sync`. Plans are marked edited at random.
  - Check: `parse(serialize(s))` deep-equals `s`.
  - **Fixed `draft.js`: 0 of 2 400 not restorable. HEAD `draft.js`: 1 737 of 2 400**, so the fix is the cause. Restored afterwards (`git diff` shows only the FS change).
- **Full run:** the FS's, exit 0 in 444.2 s.

### Assessment
- **Correct and minimal.** Membership of the level moves from "always" to "only for a fresh plan", and validity stays the signature's job, as A-7 already says.
- **No new state is accepted.**
  - The states the validator now accepts are exactly what the app produces in-session: room-list operations never touch plans, and `prune` only deletes the plans of removed levels.
  - The app already handles those states before a reload: stage 3 and every plan reader run after `sync`, which regenerates stale plans.
  - So the fix accepts nothing the running app does not already hold in memory.
- **Not loosened elsewhere:**
  - well-formed ids (`isId`), uniqueness through `has.call` (a `__proto__` key cannot pass), numbers, `error` and the key set are as strict as before;
  - `unmet` gained a "two distinct ids" check;
  - no schema change and no `PC.DRAFT_V` bump, which is right.
- **Calling `PC.sig.level` during validation is safe.** `roomsOk` has already passed, `validState`'s try/catch turns any throw into a rejection, and `sync` calls the same function on load anyway. Cost: one signature per stored plan, at most 4.

### Rulings
1. **The fresh-plan guard: accepted.**
   - A fresh plan's `sig` contains `[id, type, area]` of every room on its level (A-7). Room ids are never reused (`nextRoomId`), and the generator and editor keep ids, so a real fresh plan only lists rooms of its level. The guard cannot reject a draft the app wrote.
   - It is still worth having. `sync` skips a fresh plan, so without the guard a hand-edited or corrupted draft could put a foreign room into a plan that stage 3 and the house model trust.
   - Three mutations (fresh foreign room, unknown room, unmet naming another level) show the guard bites.
2. **`start.js` deleting an unreadable draft silently: change it now. FS, in this batch, before the republish.**
   - This is the second line of defence for the worst failure we can have, losing the client's project. It is one function plus one test, and the client is testing on the published build now.
   - **Rule:**
     - add `ui.storage.keepRejected(raw)`, so that only `storage.js` touches `localStorage` (A-3);
     - it writes the raw text to the single side key `plotcraft.draft.rejected` (overwritten each time, never read by the app, not in `PC.draft.KEYS`), and `start.js` `init` calls it immediately before `removeDraft()` when `parse` returns null;
     - a draft that parses but is empty is removed as today, with no copy;
     - Start new and Load sample do not touch the side key; their dialogs are about the offered draft, and the side key holds only what was never offered;
     - no UI.
   - **Test (e2e, `start-card.spec` or `shell.spec`, one viewport):** store a corrupted draft and reload. Expect no Resume card, the draft key gone, the side key equal to the raw text, a clean log, and nothing thrown when `localStorage` throws.
   - **Docs:** A-4 now carries this sentence.
   - **Review:** I review the change as Round 2 of this file. QA covers it in the focus list below.
   - Why not "never delete" instead: an unparsed draft would stay under the live key and be re-parsed and rejected on every load until the next autosave overwrites it. The side key keeps the live key clean and the copy explicit.
3. **The remove-a-level round trips that do not fail on old code: accepted as guards.**
   - The FS's explanation is right. `prune` deletes the removed level's plan, and moved rooms are *added* to the remaining level, which its plan does not list as missing. So removing a level alone never hit the bug.
   - They pin `prune` and the move path. That is exactly what a future change (the PM bundle's undo, F5) could break. The combined case (delete rooms, then remove a level) does fail on old code. Keep all three.

### Docs updated (CTO debt item 8, TL)
- **A-4** (draft validation): plan and `unmet` ids must be well formed and unique within the plan. They must be on the plan's level only while the plan is fresh, and a stale plan may list deleted or moved rooms. A-4 also states the rejected-draft side key (ruling 2).
- **A-7:** new paragraph under the single rule:
  - stale plans are kept unchanged until `sync`, and may list deleted or moved rooms and `unmet` pairs naming them;
  - room-list operations never edit plans, and `prune` deletes only removed levels' plans;
  - plan readers read fresh plans only, after `sync`; the validator checks membership only for fresh plans;
  - moving a room away and back restores the old plan (accepted).
- **A-16:** new "Real r128 in tests" item (H2):
  - cdnjs is blocked here, npm is reachable, and SwiftShader renders r128;
  - `three@0.128.0` `build/three.min.js` is vendored as `tests/vendor/three-r128.min.js`, with the sha512 and refetch steps recorded;
  - only the exact A-1 cdnjs URL is routed to it, and the app, `dist/index.html` and the build never reference it;
  - `view3d-real.spec` (≤ 30 s) with its assertions and shots;
  - the mock stays mandatory and remains the API guard;
  - SwiftShader is not phone performance.
  
  The "cannot be tested here" sentence now names the iframe / CSP, real GPU, touch and performance.
- ~~`docs/00-brief.md`: a dated team note under the environment constraint (H2).~~ Removed in Round 2 at the orchestrator's request. The client's brief stays untouched, and A-16 holds the note.
- **`docs/02-features/F4-plan.md` F4-T1:** a rider adds `tests/vendor/three-r128.min.js` (+ README with sha512) and `view3d-real.spec.mjs` to the file list. It also requires the mock whitelist first at the plan review (H1) and the H3 house-model tests.

### Required changes
None to the finding-1 fix. Ruling 2 is a separate small FS change in this batch, reviewed as Round 2 here.

### Non-blocking notes
1. `fs-draft-fix.md` says "unmet pair of one room" fails on old code as "a new tightening". That is right: the old code accepted `['r1', 'r1']` on a valid level. No real draft has one, because `unmet` is computed from `ans.pairs`, whose pairs are distinct.
2. CTO debt item 6 (a room overlapping only the lift must block `approve`) is still open for the FS in the PM bundle. It is unrelated to this fix.

### QA focus (CTO: room-list operations + exact round trip in the random-operation run)
1. Extend the 2 400-operation invariant run in `tests/qa/f3-t2-edit.mjs` (or a sibling file) with room-list operations, interleaved with plan edits / approvals and `sync`:
   - `removeRoom`;
   - `updateRoom` to another level, size and type changes;
   - add a room;
   - pair add / remove;
   - `removeLevels` with move and with delete (applied on a clone and kept only when `ok`, as `q-rooms.js` does).
   
   After every committed state, assert `PC.draft.parse(PC.draft.serialize(s))` deep-equals `s`. The target is 0 failures; old `draft.js` gives about 70 % failures in my probe. Keep your invariants: fresh plan ids equal the level's rooms, `unmet` equals the recomputed pairs, approved means no overlap.
2. Through the UI at 360x640 touch and 1280x800 mouse: delete a room, move a room to the other floor, and remove a floor with "move" and with "delete". After each, reload: Resume is offered, the state is exact, and stage 3 then regenerates only the changed floors and keeps the others' edits and approvals.
3. Away and back: ~~save, reload, Resume, and move it back. The old plan returns with its edits and approval~~ [Edit, after QA: within one session the old plan returns; after a reload, Resume regenerates the stale plan (A-7 corrected)]. Check that the R5 dialog's behaviour across the move is as A-7 says (a stale plan never triggers the question).
4. Forged drafts: a fresh-signature plan listing a room of another level, or an unknown room, is discarded silently (no Resume, no error). The same plan with a stale signature is offered and resumes, and stage 3 regenerates it.
5. After FS ruling 2 lands: a corrupted draft leaves its raw text under `plotcraft.draft.rejected` and no Resume card. Start new and Load sample leave the side key alone. With `localStorage` throwing, nothing breaks.
6. Full run `node build.mjs && node tests/run-all.mjs` with its time (≤ 8 min).

VERDICT: APPROVED

## Round 2 — 2026-11-21 (ruling 2: rejected-draft side key)

- **Code read.**
  - `src/js/ui/storage.js` gains `REJECTED_KEY = 'plotcraft.draft.rejected'` and `keepRejected(raw)`, which goes through the guarded `S.set`. A string check comes first, and the function returns false when storage is unavailable.
  - `src/js/ui/start.js` `init` calls `keepRejected(raw)` only when `parse` returns null, then `removeDraft()` as before. An empty but valid draft is removed with no copy.
  - The side key is not in `PC.draft.KEYS`, so Start new, Load sample and the emptied-state flush never touch it.
  - `localStorage` is still used only in `storage.js` (lint 0 violations). The change matches the A-4 sentence and my ruling exactly.
- **A safe property I checked.** If the copy fails because a write throws (quota), `S.set` marks storage unavailable, so the following `removeDraft()` is a no-op. A draft is therefore never removed without its copy: it stays under the live key and is not offered. The quota case in `start-card.spec` exercises this path (no copy, storage unavailable, start panel shown).
- **Tests.**
  - `start-card.spec` adds 14 checks: corrupted v2 draft, unparseable v1 over an older copy, empty draft with no copy, Load sample keeps the copy, storage throwing, quota. Each case has a clean log.
  - `edges.spec` `badDraft` now expects only the side key and checks that it holds the raw text. This is the correct update: the spec asserted the old "nothing left" behaviour.
  - The FS's 4 mutations are all caught. The most important one is `removeDraft` also clearing the side key, which would erase the copy on Start new or Load sample.
- **My runs:** `--e2e --only start-card,edges`: lint 0, start-card 28/0, edges 252/0. The FS's full run was exit 0 in 442.4 s.
- **Brief:** at the orchestrator's request, I removed my team note from `docs/00-brief.md`. The file is back to the client's text, with no diff against HEAD. A-16 "Real r128 in tests" holds the H2 environment fact.

### Required changes
None.

VERDICT: APPROVED
