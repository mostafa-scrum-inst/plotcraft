# F2-T3 outcome review — Tech Lead (includes the Designer fix for QA bug 1)

## Round 1 — 2026-11-20

### A) Designer fix for QA bug 1 ("Master bedroom" cut off in ft on phones)
- **What changed.** `41-stage-questions.css` only. The room-row top is now a two-column grid: name above area on the left, Master and delete on the right. The row top stays 44 px, and long names wrap at every viewport. On tablet and desktop the area therefore also moves under the name.
- **Ruling.** Accepted: one layout rule is simpler than a phone-only variant, and nothing is truncated.
- **Evidence.** My focused run of `rooms-fit.spec.mjs` gives 490/0. The Designer reports that the spec fails exactly QA's three cases on the old CSS. QA's F2-T3 suite reports 1134/0 with no KNOWN hits, and rooms, summary-fit and site-tapmode are green.

### B) F2-T3 outcome
I read `outcome.md` against both increments' reviews, the plan review, the QA report and the code I reviewed.
- **APIs** match the source: site `edgeAuto` / `reason` / `toggleEdge` / normaliser, store `affected`, draft `KEYS` and storage helpers, the `PC.levels` room helpers, `ui.qrooms` / `ui.qedges` / `ui.qpreview.focusEdge`, debug hooks.
- **QA sign-off.** 1134 checks, 8 mutations, full run exit 0 in 464.7 s. QA proved that the second last-resort label pass is reachable and needed; it stays, as a QA test.
- **Rulings and CD-1 to CD-3 as delivered** are recorded faithfully.
- **Known limits** are listed with an owner for each.

**One correction, binding on F3-T1:** section 3 says footprints are up to 3:1 "plus less than one 0.5 m step after the cap". The rule actually in force (A-6 step 8, PM 3.1 / 4.3) is **long side ≤ 3 x (short side + 0.5 m)**, so a 6 m wide footprint can be up to 19.5 m long. I have corrected `F3-plan.md`: F3-T1's sweep covers that range, e.g. 6 x 19.5 and 4 x 13.5 m. The outcome sentence is superseded by A-6; no new round is needed for it.

**QA observation 3:** my increment-1 round-2 wording was wrong in its detail. An erratum is appended to `impl-review.md`; the 2 % guard stays.

**QA's gaps in the FS specs** (no 768x1024 runs in `rooms` / `edges`; 7th-pair and pair-limit move text; Move vs Delete plans sentence; empty `invalidFields` at the start of each case): assigned to the FS for when the specs are next opened in F3-T1. QA's suite covers them meanwhile. Accepted.

### For the F2 feature review (PM + CTO)
**PM decisions**
1. **F2-T2 obs 2.** A small side-setback change re-proportions the building and asks R5, although the old building would still fit. My recommendation: keep it.
2. **F2-T2 obs 3.** Short non-street edges are unlabelled at phone scale. Recommendation: amend F2-S1 to allow it; the F2-S4 edge list gives every class as text.
3. **F2-T2 obs 6.** `pool-omitted` has no fix hint. Recommendation: add a text hint.
4. **F2-T2 obs 7.** An empty floor shows "needs 10 m²". Recommendation: show the needed figure only for floors with rooms.
5. **F2-T3 obs 4.** "Move" also regenerates the receiving floor's plan (its rooms change), while "Delete" loses only the removed floor's. The dialog says so correctly. Keep it, or reword the choice labels?
6. **F2-T3 obs 5.** The sample already uses 7 of the 8 rooms per floor, so the limit is reached quickly. Keep 8 (PM 4.3), or raise it? Raising it touches the F3 generator's proven range (max 8 rooms per level in the spike and sweep): a TL / CTO cost question if chosen.
7. **Street-edge tap message as a toast** (CTO D5: the PM may revisit).
8. **Proportion wording** uses "×" (via `fmtDims`) where F2-S3 writes "x". Information only.

**Known limits to acknowledge** (owners already assigned)
- Label crowding with many overridden short edges on a phone; the edge list stays readable (Designer, F5-T3).
- 1280x800: the legend wraps with the "* set by you" entry, and Back / side mode is about 1 % smaller (Designer, F5-T3).
- The footprint area label is wider than narrow footprints (Designer, F5-T3).
- No Parking / Pool legend entries (Designer, F5-T3).
- The pool-size note wraps inside an entry at 360 px (Designer, F5-T3).
- Interim until F3-T1: Next on stage 2 stays disabled (`MAX_BUILT = 2`). R5, Move / Delete plan effects and the "regenerated" wording cannot be seen in the product until plans exist; they are tested with seeded plans.

**CTO items**
1. **F1 real-device gate still OPEN.** Stage 2 now adds the tap mode, the edge list, room rows, sliders and the on-screen keyboard to what only a real phone confirms. Recommendation: republish the current build for the client at the F2 feature review and ask for one combined phone check (F1's five items plus a short stage-2 list).
2. **Test runtime.** The full run went from about 4 min (F2-T1) to 465 s (about 7.75 min). It is still under the 15-minute trigger in A-16 for trimming overlap between `tests/e2e` and `tests/qa`, but F3 will add more. QA could start trimming duplicate viewport coverage now.
3. **Draft v2** is the first schema change since F1: migration, both keys, and `KEYS` as the single list. A pattern for later bumps is in the outcome.
4. **F3-T1 obligations**: generator sweep up to `3 x (short + 0.5 m)` (corrected above); `PC.store.affected` for F3-T2's Clear dialog; `plan-fit` wiring; FS spec gaps listed above.
5. **Footprint fallback cost.** `analyse` worst case (comb at 30 % and 80 %) stays under 500 ms with pruning. Watch it on a real mid-range phone during the stage-2 slider drag; the live preview stops itself above 50 ms per analysis (F2-T2 condition 1).

### Required changes
None.

VERDICT: APPROVED
