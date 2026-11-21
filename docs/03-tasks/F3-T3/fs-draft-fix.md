# F3 debt item 1 (FS): stale plans make the autosaved draft unrestorable

Source: CTO review, docs/04-feature-reviews/F3.md, finding 1. Fix recommended by the CTO; TL to confirm.

## Plan

**Cause.** `PC.draft.validState` → `plansOk` (src/js/core/draft.js) requires every room id of every stored plan
(and of its `unmet` pairs) to be a room on that plan's level (`where[r.id] !== id`). Since F3-T1 a plan is kept
while stale (A-7: it is regenerated on the next entry to stage 3, not at the change), so after `removeRoom`, an
`updateRoom` to another level or a `removeLevels` (move) the stored plan still lists a room that is gone or
elsewhere. `serialize` writes the draft, `parse` returns null, and `ui.start.init` removes it: no Resume card,
project lost. Reproduced in node: sample + sync, `removeRoom r5` → `validState` false.

**Fix (draft.js `plansOk` only, no schema change, no `PC.DRAFT_V` bump).**
- Plan rooms: well-formed ids (`isId`), unique within the plan, numbers as today. Membership of the level is no
  longer required.
- `unmet`: each entry a pair of well-formed, distinct ids (membership no longer required).
- Whether a plan belongs to its level stays the signature's job (A-7). One guard kept: a plan whose `sig` equals
  the level's current signature (a *fresh* plan) must still list only rooms of that level, as before. A real fresh
  plan always does (the signature holds the level's room ids), so this never rejects a real draft; it keeps a
  forged fresh plan with a foreign room from being trusted by `sync` (which would skip it).
- Side effect kept on purpose (CTO): moving a room away and back restores the old signature and the old plan.
- No store normaliser (CTO advises against a second staleness mechanism).

**start.js.** Not changed. View for the TL: deleting an unparseable draft silently is what lost this project;
a safer policy would be to keep the raw text under a side key (or simply not delete it, and let the next save
overwrite it) so a future bug cannot destroy data. It is outside this fix's scope, so I only note it.

**Tests.**
- Unit (`tests/unit/draft.test.mjs`): on the synced sample, with plans edited/approved,
  (1) `removeRoom`, (2) `updateRoom` to the other level, (3) `removeLevels` (floors 2 → 1) with move and with
  delete; each `parse(serialize(s))` deep-equals `s`. Each fails before the fix (verified by reverting).
  Plus: a forged fresh plan (current sig) with a foreign room / unknown room is rejected; the same plan with a
  stale sig is accepted; malformed ids in rooms / unmet are still rejected. The two old "rejected: plan room from
  another level / does not exist" cases (stale sig '') are rewritten as the fresh-sig rejections.
- E2E (one check, 360x640 only, in `tests/e2e/rooms.spec.mjs`): sample → stage 2 → Delete a room → wait for
  autosave → reload → Resume card shown → Resume → state equals the pre-reload state.
- Mutation check: revert the membership relaxation → the new unit cases fail; drop the fresh guard → the forged
  case fails; e2e fails on the old `plansOk`.
- Runs: `node build.mjs`, unit suite, focused e2e, one full `node tests/run-all.mjs`.

## Results (2026-11-21)

**Code.** `src/js/core/draft.js` only: `plansOk(s, levels, where)` (now given the state, to compute the level's
signature). Room ids in `rooms` and `unmet` must be well formed (`isId`) and unique within the plan (`has.call(seen, …)`,
so a key like `__proto__` cannot slip through); an `unmet` entry must be two distinct ids; membership of the level
is required only when `p.sig === PC.sig.level(s, id)` (fresh plan). Numbers, keys, `error`, levels unchanged.
No `PC.DRAFT_V` bump, no store change, `start.js` unchanged. A-4's "plan room ids exist" and A-7 wording are the
TL's doc update (CTO finding 8); not edited by FS.

**Unit tests** (`tests/unit/draft.test.mjs`, 113/0; suite 345/0):
- Round trips on the synced sample with every plan edited + approved, stage 2, `parse(serialize(s))` deep-equals `s`:
  delete a room (r5); delete a paired room (stale `unmet`); move a room to the other level (r13 → G); remove a
  level with rooms moved (floors 2 → 1); remove the basement with rooms deleted; delete rooms then remove a level.
- A room moved away and back (r12 → G → First, through a saved draft): `sync` keeps the First floor plan with its
  edits and approval (old signature restored).
- Fresh plan (current sig) listing a room of another level, an unknown room, or an unmet pair naming another
  level: rejected. Same plan with a stale sig: accepted. Malformed room id, non-string id, malformed unmet id,
  unmet pair of one room, unmet entry of one id: rejected. The two old cases "plan room from another level / that
  does not exist" (sig '') became the fresh-sig rejections, since a stale plan may now list them.

**Which fail before the fix** (HEAD `draft.js` on a copy of the tree): 8 — delete a room, delete a paired room,
move to another level, delete rooms then remove a level, move away and back, the two stale-accept cases, and
unmet pair of one room (a new tightening). **Not failing before the fix: the two pure remove-level round trips.**
Removing a level never triggered the bug by itself: `prune` deletes the removed level's plan, and the remaining
levels' plans list only their own rooms (moved rooms are *added* to a level, not missing from its plan). They stay
as guards; the remove-level path breaks only when combined with an earlier delete / move (covered by its own case).

**E2E** (`tests/e2e/rooms.spec.mjs`, new `staleDraft`, 360x640 touch only): Load sample (plans laid out) →
stage 2 Rooms → tap Delete on r5 (no dialog: untouched plans) → flush autosave → stored Ground plan still lists r5
→ reload → Resume card shown → stored draft parses to the saved state exactly → Resume → First floor plan kept,
Ground plan regenerated (current sig, no r5) → everything else equal → clean log / layout checks. rooms.spec
234/0 in 23.7 s (about +4 s). With HEAD `draft.js` built: 2 failures ("Resume is offered", "parses … exactly"),
no crash.

**Mutations** (unit, copy of the tree):
| Mutation | Result |
|---|---|
| HEAD `plansOk` (membership always) | 8 failures (above); e2e 2 |
| fresh guard dropped (`fresh = false`) | 3 (fresh foreign / unknown room / unmet) |
| uniqueness dropped | 1 (plan room listed twice) |
| `isId` dropped | 3 (malformed / non-string / unmet id) |
| unmet `u[0] !== u[1]` dropped | 1 |
| membership kept on `unmet` only | 3 (stale accepts, paired-room delete) |
All caught.

**Runs.** `node build.mjs` ok (385.9 kB); `node tests/run-all.mjs --unit` 345/0; focused
`--e2e --only rooms,r5,start-card,shell,plans-view` all 0 failed (rooms 234, rooms-fit 490, r5 54, plans-view 191,
start-card 14, shell 596); full `node build.mjs && node tests/run-all.mjs` **exit 0 in 444.2 s** (every e2e and QA
suite 0 failed; tests/qa untouched).

**start.js view (no change made).** The loss was total only because `init` deletes any draft `parse` rejects.
Suggestion for the TL/CTO: stop deleting on a parse failure (the next autosave overwrites the key anyway once the
user starts again), or copy the raw text to a side key `plotcraft.draft.rejected` before removing it, so a future
validator bug costs a Resume card, not the project. Small (one line + one test), but outside this item's scope.

**For QA:** CTO asked QA to add room-list operations and the exact draft round trip to the 2 400-op invariant run in
`tests/qa/f3-t2-edit.mjs` (QA-owned, not touched).

## Round 2 (2026-11-21): TL ruling 2, rejected-draft side key

**Code.**
- `src/js/ui/storage.js`: `ui.storage.REJECTED_KEY = 'plotcraft.draft.rejected'`, `keepRejected(raw)` writes the raw text there through the guarded `S.set` (returns false and is a no-op when storage is unavailable or the write throws). Not in `PC.draft.KEYS`, so `readDraft` / `writeDraft` / `removeDraft` (Start new, Load sample, emptied state) never touch it. The app never reads it. No UI.
- `src/js/ui/start.js` `init`: when `parse` returns null, `keepRejected(raw)` runs, then `removeDraft()` as before. A draft that parses but is empty is removed with no copy.
- A-4 wording checked (TL, architecture.md "Draft" bullet): it matches the code (single side key, overwritten, never read, through `ui.storage`).

**Tests.** `tests/e2e/start-card.spec.mjs` 28/0 (+14 checks, about +1 s, 360x640):
- a stored v2 draft with an invalid room type, then reload: no Resume card, draft key gone, side key = the raw text exactly;
- Load sample afterwards leaves the side key alone;
- an unparseable v1 draft with an older side copy present: copied over it, both draft keys gone;
- an empty draft: removed, no copy;
- `localStorage` property throws: `keepRejected` is a no-op returning false, clean log;
- reads work but every write throws (quota), with a corrupted draft stored: not offered, start panel shown, no copy, storage marked unavailable, clean log.

Each case also checks a clean log.

**Existing FS spec adjusted:** `tests/e2e/edges.spec.mjs` `badDraft` expected no `plotcraft.draft*` key at all after a rejected draft. That is now the side key only, and the spec also checks it holds the raw text; 252/0. The full run caught this (3 failures, deterministic), and the spec was fixed before the final run. No QA file needed a change: all QA suites were green on both full runs.

**Mutations** (start-card.spec):

| Mutation | Result |
|---|---|
| no `keepRejected` call | 3 failures |
| copy empty drafts too | 1 failure |
| unguarded `localStorage.setItem` in `keepRejected` | spec fails (SecurityError, exit 1) |
| `removeDraft` also clears the side key (Start new / Load sample would erase it) | 3 failures |

All caught.

**Runs.**
- `node build.mjs` ok (386.5 kB).
- Unit 345/0.
- Focused `--unit --e2e --only start-card,shell,rooms,plot`: all 0 failed.
- First full run: exit 1 in 444.9 s, only `edges.spec` `badDraft` (above).
- Final full `node build.mjs && node tests/run-all.mjs`: **exit 0 in 442.4 s**.
