# F1-T2 plan review — Tech Lead

## Round 1 — 2026-11-19

Reviewed `docs/03-tasks/F1-T2/plan.md` (sections 1–9) against the F1-T2 block of `F1-plan.md`, `architecture.md` (A-2, A-3, A-4, A-7, A-15, A-16), stories F1-S4 / F1-S5, R1, R3, G5, and my F1-T1 rulings (strip on stages 1, 3, 4; Next label per stage; hook-only lookups).

### Assessment
The plan is complete and correct for the task. Points I checked specifically:
- **State and store**: shape is A-4 exactly; defaults match 4.1 (six default rooms, `nextRoomId 7`). Frozen state + clone-on-commit, no-op commits ignored, `nav` commits keeping `sampleClean`, `replace` for whole-state swaps: all sound. `propose` as a pass-through with the confirm handler stored now is the staging the F1 plan asks for.
- **Gating**: the status table equals A-4; stage 3 validity already includes "no error" and the signature match, which is right. Reasons for locked steps come from the first invalid earlier stage. Locked steps stay `aria-disabled` and tappable.
- **Draft**: wrapper with `v`, strict `parse`, storage adapter that also guards the property access, autosave suspended while a draft is pending, empty project never saved, flush on `pagehide`. The boot sequence covers every F1-S5 criterion; e2e scenarios 5–9 test them, including the throwing getter and quota cases.
- **Sample**: matches 6.2 item by item (I re-added the areas: 110 + 10 on each level); pairs and master flag correct.
- **Tests and lint**: runner order per A-16; bare-vm loader; the lint list covers A-3. The acceptance table in section 8 maps every criterion to code and a test.

### Rulings on section 9
1. **`ui/start.js` — approved.** Added to the A-2 file table.
2. **Autosave as a ui subscriber; `Promise` in core — both approved.** A-4 reworded: core has no timers, `PC.ui.autosave` owns the debounce.
3. **`MAX_BUILT = 2` — approved.** And yes to a notice, but without a new constant: when the shell switches to a stage that has **no registered controller**, it shows an info banner through `PC.ui.banner` ("This stage is not built yet: static preview") and hides it otherwise. It disappears by itself as later tasks register their controllers, and the F1 hosted check will not be mistaken for a broken questionnaire.
4. **Minimal `core/geom.js` now — approved** (no private shoelace). Same for `PC.stages.levelIds`; F2-T1 must make `PC.levels` the single implementation and have `PC.stages` call it (no duplicate left behind).
5. **Pending draft — the guard.** `PC.ui.start.guard()` with the Start-new confirmation before the first point; silently discarding a draft would break "Start new clears the draft after in-page confirmation". After OK the tap that triggered it is not placed (the user taps again); after Cancel nothing changes. F1-T3 wires the call.
6. **Sample `streetEdge: 0` — approved, and generalised.** A `null` street edge would let a vertex drag silently change which edge the default rule picks, and with it every plan. New rule (A-4, A-5): `streetEdge` is `null` only while there is no closed plot; closing the shape stores the default-rule index. That write belongs to F1-T3; `draft.validState` keeps `null` legal (the sample and any draft saved before F1-T3 adds the write must not be discarded).
7. **Numeric id order through `PC.store.cmpId` — approved**; A-4 now says so and A-7's "sorted" means this order. **"Living (family)" reads "Living"** — accepted: names are derived from type (A-4), and 6.2's wording is descriptive.
8. **Console-error exception — approved, exactly as narrow as proposed**: only the failed-load message whose URL is the three.js tag, only in suites that abort it. A-16 updated.
9. **Unit toggle ends `sampleClean` — keep the literal rule.** F1-S5 says the offer disappears "as soon as the user changes anything", Q1 is an answer, and one rule without exemptions is what QA can test. If the hosted review finds it annoying, the PM changes the story first.
10. **Strict draft validation — approved**, with one architectural consequence I have now written into A-4: **the state only ever holds valid, in-range values.** Half-typed or out-of-range input stays in the field as transient UI state (session `invalidFields`, reported by `PC.validate` from F2-T1/T2) and is never committed, so strict range checks can never throw away a draft because of one bad field. Schema additions bump `PC.DRAFT_V`; derive the key from it (`'plotcraft.draft.v' + PC.DRAFT_V`). The deferred self-intersection check (F1-T3) is fine.
11. **`inert` — approved** with the stated fallback; on the F1 publishing checklist.

### Conditions (binding; no plan revision needed, I will check them at the implementation review)
1. The "no registered controller" banner of ruling 3.
2. The machine-readable contract moves to `tests/contract/hooks.json` and `tests/contract/values.json` (canonical from now on; the F1-T1 verify folder becomes history). `contract.spec.mjs` reads them from there, so the test suite does not depend on a `docs/` path. A-16 updated.
3. Lint precision: `import`/`export` are matched as statements in JS only (so CSS `!important` and words like "important" in text do not trip it), and each forbidden pattern has a positive and a negative case in `lint.test.mjs`.
4. `PC.debug` is created in `main.js` as planned, but as an object later tasks extend (`Object.assign`), never replace.

### Non-blocking notes
- `NEXT_LABEL` is UI text living in core; acceptable, but keep reasons and labels in one small table so F5-T3 can adjust wording in one place.
- Deep-freezing every commit is fine at this state size; if F3 drag performance suffers, freeze only in debug.
- In e2e scenario 10, also assert that "Skip to 3D" leaves `sampleClean` true (it is a `nav` commit) so the strip is still there when the user comes back to stage 1.

VERDICT: APPROVED
