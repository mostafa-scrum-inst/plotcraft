# Client decisions (binding)

Decisions made directly by the client (Mostafa). They override any conflicting text in stories, plans or architecture; the PM and Tech Lead amend their documents to match.

## 2026-11-20 06:50 — three product questions from the F2-T1 QA observations (routed by the Tech Lead)

### CD-1 Narrow plots: allow up to 3:1 when the plot forces it
- Context: QA F2-T1 observation 1. Footprint proportion is capped at 2:1, so a 10 x 50 m plot asked for 30 % (150 m²) gets 6 x 12 m = 72 m², and the warning does not say why.
- Decision: when the 2:1 footprint is clamped by the plot (it cannot reach its target), the footprint may stretch up to **3:1** along the buildable area's long direction. Example: 6 x 18 m = 108 m².
- Unclamped footprints keep today's behaviour (bounding-box proportions, max 2:1). The sample's numbers must not change.
- The clamped warning names the reason (proportion limit) when the limit is what stops it.
- Consequence accepted: the room-layout generator (F3-T1) must be proven on footprints up to 3:1 (its seeded sweep must include them).

### CD-2 Architect can override edge classes
- Context: QA F2-T1 observation 4. An edge up to 40° from straight-back is "back", at 41° it is "side"; with different back/side setbacks a 1° change moves the buildable area by metres.
- Decision: keep the automatic 40° classification as the default, and let the architect **override any non-street edge between back and side** in the stage-2 site preview (tap an edge to switch; keyboard alternative required). The street edge stays "front" and is set by Q6 as today.
- Overrides are saved in the draft, shown in the preview labels, cleared when the plot outline changes shape (vertex count or a vertex moves) — or another rule the Tech Lead proposes, as long as it is stated and tested.
- Consequence accepted: a new control, saved state (draft schema bump) and tests.

### CD-3 Zero setbacks: zero lot line is out of scope
- Context: QA F2-T1 observation 5. A 0 m setback still keeps the house centred.
- Decision: out of scope for the prototype; record it as a non-goal. No change.
