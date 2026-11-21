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

## 2026-11-21 18:06 UTC — F3 feature-review questions (PM / CTO, batch 8)

### CD-4 Rooms per floor: raise the limit from 8 to 10
- Context: client question at the F3 feature review ("Is 8 rooms per floor enough?"), options keep 8 / raise to 10 / raise to 12; PM recommended 10.
- Decision: **raise to 10 rooms per floor.**
- Consequence accepted: generator re-proven at 10 (TL re-sweep at the new maximum), limits, counters, messages and tests updated; lands with F4-T2 (F3 follow-up bundle), no delay.

### CD-5 Hall access: warn, don't guarantee
- Context: client question at the F3 feature review ("Must every room open onto the hall or stairs?"), options accept as limit / warn / generator guarantee; PM recommended warn.
- Decision: **a non-blocking warning on the floor names each room with no hall access**, like the "not next to each other" warning. No generator change.
- Access (PM definition for TL): the room shares at least 0.8 m of edge with the hall or the stairs / lift; a room touching its paired partner that has access also counts (en-suite through its bedroom).
- Consequence accepted: small change, lands with F4-T2 (F3 follow-up bundle).

### CD-6 Phone check of the first 3D right after F4-T1
- Context: CTO question at the F3 feature review (F1 real-device gate; CTO will not approve the F4 review without one real-phone look).
- Decision: **the client (or someone he names) checks the 3D on a phone right after the F4-T1 publish** (~5 min: loads + Skip to 3D, one-finger orbit / two-finger zoom-pan without page scroll, colours and contrast, room drag/resize, delete a room + reopen -> Resume). Answers go into docs/04-feature-reviews/F1.md / F4 review.
