# F3 debt item 1: stale-plan drafts and the rejected-draft side key — QA report

## Round 1 — 2026-11-21

Scope: the FS fix for CTO F3 finding 1 (`src/js/core/draft.js` `plansOk`, commit `fa05ebc`) and TL ruling 2, the rejected-draft side key (`ui.storage.keepRejected`, `start.js` `init`). I tested against the TL's 6-item QA focus list (`fs-draft-fix-review.md`, round 1), A-4 and A-7 as the TL updated them. My expectations are my own:
- **Level fingerprint.** It comes from my reading of A-7: the level's rooms as id / type / area from my own size table, the level's pairs, and stairs / lift by my own level rule. A plan is fresh exactly when its level's fingerprint equals the one it was laid out for. The fingerprint is not `PC.sig`; the run checks that the two agree.
- **Adjacency.** QA's own (`f3-t2-ref.mjs`).
- **Overlap.** QA's own.

### What I tested and how

**`tests/qa/f3-t3-draft.mjs`** (node, about 2 s): a sibling of `f3-t2-edit.mjs` section 4, which I left unchanged.
1. **Random operation run.**
   - **Bases:** 150 runs from three synced bases: the sample; the sample with 3 floors and a basement; the sample in ft with a lift and the stair front-left.
   - **Operations:** 2 456 committed operations. Room-list and level operations:
     - delete a room (426);
     - move a room to another level (280);
     - size / type change (223);
     - add a room (283);
     - pair add / remove (82);
     - remove a level with "delete" (155) and with "move" (83), both on a clone kept only when `ok`, as `q-rooms.js` does; 70 refused moves were not committed;
     - add a floor or a basement (235).
     
     Plan operations, interleaved with those: edit (161), approve (94), un-approve (12), regenerate (157), and `sync` as on stage-3 entry (265).
   - **Checked after every committed state:**
     - `PC.draft.parse(PC.draft.serialize(s))` deep-equals `s`;
     - room-list and level operations never change a plan, except that removed levels' plans go;
     - fresh by my fingerprint = fresh by the signature;
     - a fresh plan lists exactly its level's rooms, and its `unmet` equals my adjacency of the level's pairs;
     - a fresh approved plan has no error and no overlap by my overlap;
     - after `sync` every level is fresh, a fresh plan is unchanged, and an approval survives only on a plan that was approved and stays fresh.
   - 1 428 of the 2 456 states hold a stale plan that lists a room that is gone or on another level. These are exactly the drafts the old validator threw away.
2. **Away and back (node).**
   - Setup: the First floor is edited and approved, and Ground is approved.
   - A First room moved to Ground and back, through two draft round trips, then `sync`: the plans are the originals exactly, with edits and approvals.
   - The app's R5 predicate (`PC.store.atRisk`) names both floors when the room moves away, and nothing when it moves back (stale plans hold nothing at risk).
3. **Forged drafts (node).**
   - Rejected: a fresh-signature First plan listing a Ground room, an unknown room, or an `unmet` pair naming a Ground room.
   - Accepted: the same plan with a stale signature; `sync` then lays it out again for exactly the level's rooms.
   - Still rejected: a malformed id, a room listed twice, a one-room `unmet` pair, `__proto__` as an id, a negative width.

**`tests/qa/f3-t3-draftui.mjs`** (browser, about 34 s). Real input: touch at 360x640, mouse at 1280x800. Both floors are seeded edited (one room 0.5 m narrower) and approved, as in `r5.spec`. Then:
- **A:** delete an unpaired Ground room.
- **B:** move the smallest unpaired Ground room to First (the smallest, so First still fits and stage 3 stays reachable).
- **C:** remove the First floor with "move" (on the sample cut to 3 rooms a floor, so "move" is allowed).
- **D:** remove the First floor with "delete".

For each operation:
- the R5 / remove-level question is asked;
- right after the change, the room list or floors have changed and every plan is untouched;
- autosave flush, reload: Resume is offered, and the stored draft parses to the saved state exactly;
- Resume: answers, plot and stage are equal; the floors whose fingerprint did not change keep their plan exactly, with edits and approval; the changed floors are laid out again (fresh, not edited, not approved, exactly their rooms);
- entering stage 3 changes no plan.

**E (away and back):**
- In one session: a First room moved to Ground (asked once), then back (asked nothing). The plans are the originals, and on stage 3 both floors keep their edits and approvals exactly.
- Across reload + Resume: see observation 1.

**F (360x640): forged drafts, side key, storage throwing.** Each draft is stored by an init script before the app's scripts run, so the page's own autosave cannot overwrite it.
- Fresh-signature plan with a Ground room, or with an unknown room: no Resume card, start panel shown, draft key gone, raw text under `plotcraft.draft.rejected`, clean log.
- The same plan with a stale signature: Resume offered and the side key unchanged; Resume lays First out again (exactly its rooms) and keeps Ground exactly.
- Corrupted JSON: no Resume, and the raw text is under the side key.
- A valid draft afterwards is offered; Start new leaves the side key alone.
- Load sample over an offered draft leaves the side key alone.
- `localStorage` getter throwing, and every write throwing: the sample loads, no Resume card, clean log.
- Every scenario ends with the clean-log check (no console errors, native dialogs or stray requests).

**Runner:** both files run from `tests/qa/run-f3-t3.mjs`, so `run-all` runs them; there is no new runner.

### Mutation proof
Each mutation was applied to a throwaway copy of the tree; `src/` here is untouched.

| Mutation | f3-t3-draft (node) | f3-t3-draftui (browser) |
|---|---|---|
| d1: pre-fix `draft.js` (`eeddb90`, membership always required) | caught: **1 428 of 2 456 states not restorable** (58 %), away-and-back and stale-forged fail | caught 7: A / B at both viewports, no Resume; C crashed at both viewports (no Resume card); stale forged draft not offered |
| d2: fresh guard dropped (`fresh = false`) | caught (forged drafts) | caught 2 (fresh forged drafts accepted) |
| d3: per-plan uniqueness dropped | caught (duplicate room accepted) | — |
| d4: `start.js` no `keepRejected` call | — | caught 5 (side key empty) |
| d5: `removeDraft` also clears the side key | — | caught 5 (Start new / Load sample erase it) |
| d6: Resume without `sync` (`settle`) | — | caught 19 (changed floors not laid out again; stale plans reach stage 3) |
| d7: `removeRoom` also strips the room from plans (the "normaliser" the CTO advised against) | caught (room-list operations changed plans) | caught 2 (A: plans not untouched) |

### Results per focus item
1. **Random-operation run with room-list operations and the exact round trip: met.** 0 of 2 456 states are unrestorable, against 1 428 with the old `plansOk`. My invariants hold, and my fingerprint and the signature agree on freshness in every state.
2. **UI reload checks at 360x640 touch and 1280x800 mouse: met.**
   - Delete, move to the other floor, and remove a floor with "move" and with "delete" all reload with Resume offered and the exact state.
   - Only the changed floors are laid out again; the others keep their edits and approvals.
   - Stage 3 changes nothing further.
3. **Away and back: met within a session.** The old plans return with edits and approvals, and moving back asks no R5 question. Across reload + Resume they do not return: see observation 1.
4. **Forged drafts: met.**
   - Fresh-signature foreign / unknown room: discarded silently.
   - Stale signature: offered, resumed, and laid out again.
   - Malformed input stays rejected.
5. **Rejected-draft side key: met.**
   - The raw text is kept under `plotcraft.draft.rejected`, with no Resume.
   - Start new and Load sample leave it alone.
   - With `localStorage` throwing, nothing breaks.
6. **Full run:** see below.

### Bugs
None.

### Observations (for TL / PM)
1. **Away and back across a reload does not restore the old plans.** This is by design, but focus item 3 expects otherwise.
   - Resume runs `sync` (`start.js` `settle`), so a plan that is stale when the draft is saved is laid out again at Resume.
   - Moving the room back after Resume therefore finds generated drafts, not the old edited / approved plans.
   - The draft itself still holds the old plans exactly: the round trip is exact. They are dropped by the Resume `sync`, which A-7 prescribes ("kept unchanged until `sync`").
   - This is consistent with what the user was told: the R5 question on the move away said the floors "will be regenerated".
   - The A-7 sentence "moving a room away and back restores the old plan" holds only within a session, before stage 3 or a Resume. The TL may want to say so in A-7.
2. In the random run, 70 of 153 "remove a level with move" attempts were refused (too many rooms or pairs for the remaining level). The refused clone is never committed, as in `q-rooms.js`, and the state stays restorable.

### Full run
`node build.mjs && node tests/run-all.mjs` (default `--jobs 2`): **exit 0, run-all 459.6 s** (7 min 40 s wall clock including the build). This is under the 8-minute target and 3 s below the previous run, 462.3 s.
- Lint 0 violations; unit 345/0.
- Every e2e spec is green, among them rooms 234 (with the FS `staleDraft`), start-card 28, edges 252, r5 54 and shell 596.
- QA suites, all 0 failed:

  | Suite | Checks |
  |---|---|
  | F1-T1 | 191 + 2015 |
  | F1-T2 | 654 |
  | F2-T1 | 1143 |
  | F1-T3 | 822 |
  | F2-T2 | 959 |
  | F2-T3 | 1136 |
  | F3-T1 | 13 + 205 |
  | F3-T2 | 9 + 182 |
  | F3-T3 | 16 + 234 + **4 + 61 (new)** |

  The `run-f3-t3` runner takes 42.1 s.

### Verdict
All 6 TL focus items are met, and there are no bugs. The fix makes every state the app produces restorable: 0 of 2 456 states lose the draft, against 1 428 before. The fresh-plan guard and the side key bite, as every mutation shows. Observation 1 (away and back does not survive a Resume, per A-7 / `settle`) is for the TL's A-7 wording; the behaviour is correct.

VERDICT: PASSED
