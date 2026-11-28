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

## 2026-11-22 08:10 UTC — Phone gate (CTO card, batch 14)

### CD-7 Close the real-device gap with a named phone checker
- Context: CD-6 phone answers had not arrived; the CTO offered three ways to close the gap (docs/04-feature-reviews/F4-cto-gate.md).
- Decision: **the client (or someone he names) does the 5-minute phone check** (testing doc https://claude.ai/artifact/TVkPgkC5K4Fbah3cgtEVha section 6, on app v7).
- Consequence: F4 closes when CD-6 a–c pass; F5 closes after F5-T3b runs on the findings, QA incl. QA_FULL=1, republish (CTO table in F4.md/F5.md).

## 2026-11-22 18:20 UTC — Visual realism (client request)

### CD-8 Upgrade the 3D visuals: current look is "too far from realistic"
- Request (client, verbatim): "do another batch to upgrade the visuals as it is too far from realistic".
- Scope (coordinator brief): 3D view first — materials and textures, lighting and shadows, sky and ground, landscaping, window and roof detail.
- Binding constraints carried over: single-file dist, three.js r128 from cdnjs only (no extra downloads; textures procedural or inline), G6 budgets, test run ≤ 420 s, phone gate CD-7 still open (the phone check should run on the upgraded build).

### CD-9 Stage 5 opens with the Roof on (2026-11-22 19:16 UTC)
- Decision: **open the 3D view with the roof on**, showing the finished house (PC.C.VIEW3D.roofOnOpen: true). Turning Roof off or picking a room shows the inside.
- Consequence: PM round-15 story wording for F4-S1 / §3.3 goes in; roof stays off after a finder pick or tour (PM Q-P2).

## 2026-11-28 13:14 UTC — WebGPU high-end page (client request)

Design: docs/02-features/G-plan.md (Claude Doc https://claude.ai/artifact/A6TJCjy1xpBGgTKhDGSWd5), reviewed by a Fable 5.2 agent (round 1 CHANGES REQUESTED, 7 items folded in). Client: "Approve".

### CD-10 A WebGPU page at gpu/index.html in the same artifact; r128-only rule waived for that page only
- Decision: **the /gpu page loads three.js 0.180.0 (WebGPU build, ES modules) from cdnjs**; the hard constraint "three.js r128 global build only, no ES-module imports" (docs/00-brief.md) does not apply to it. dist/index.html keeps r128 and stays byte-identical in behaviour.
### CD-11 No WebGPU on the device: message + link to the standard page
- Decision: stage 5 on /gpu shows "This device or browser does not support WebGPU" and a link to the standard page (draft carries over). No WebGL2 fallback for users.
### CD-12 Link from the standard page
- Decision: the standard page shows a "High-end 3D (WebGPU)" link, only where the browser has WebGPU.
### CD-13 Effects in scope
- Decision: G3 (ambient occlusion + night bloom behind an Effects switch, on by default on ultra) is in scope.
