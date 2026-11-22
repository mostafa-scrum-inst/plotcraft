# PlotCraft — project summary (for the "Plot plan" project knowledge)

As of 2026-11-22. Owner: Mostafa Farouk Ibraheem. Built by a six-role AI team (CTO, PM, Tech Lead, Designer, Senior Full-Stack Dev, QA), orchestrated in one long Claude chat.

## What it is
A tool for architects, delivered as ONE self-contained HTML page (three.js r128 from cdnjs is the only external file). Five stages:
1. **Plot** — draw the land outline on a top-down grid; edge lengths and area in m or ft.
2. **Questions** — 17 saved questions (setbacks, footprint %, vegetation %, north, street edge, floors, ceiling height, roof, exterior style, rooms per floor with sizes and adjacency, stairs/lift, parking, pool, extras), with a live site preview and a conflict summary.
3. **Floor plans** — rooms laid out automatically per floor around the stair core; the architect drags and resizes rooms, then approves each floor.
4. **Interior** — interior style (modern / classic / minimal) and furniture density (sparse / full).
5. **3D view** — dollhouse-style block model (furniture, roof switch, parking, pool, wall, gate, seating, trees and shrubs, north marker) with free camera, floor selector, time of day, seasons, a "Go to room" finder and a drone tour along a smooth path.

Works on phone, tablet and desktop (touch, mouse, keyboard). Visual approximation only (no real solar/climate data).

## Live preview
Published privately (same link updated each batch, now v7): https://claude.ai/artifact/LDbG9XdU1UeAMcVwqmxAB9 (all five stages working).
Latest testing guide: https://claude.ai/artifact/SCCTR7B12rB9kFeCdKDsUb. Release-notes draft for the client: `docs/05-release/release-notes.md`.

## Status
| Feature | State |
|---|---|
| F1 Plot drawing + app shell | Done, approved by PM and CTO |
| F2 Questionnaire (site model, questions, rooms, narrow plots, edge overrides) | Done, approved by PM and CTO |
| F3 Floor plans (generator, editor, approval, interior; follow-up bundle: 10 rooms, hall-access warning, low-fill hint, undo) | Done, approved by PM and CTO |
| F4 3D dollhouse (shell, roof, furniture, outdoor, vegetation, time of day, seasons, camera) | Done; PM APPROVED; CTO conditional on the phone gate only |
| F5 Room finder, drone tour, presentation/device pass (F5-T3a), runner scheduling (F5-T3c) | Done; PM APPROVED; CTO conditional on the phone gate only. F5-T3b (phone-only tuning) held for the gate |
| Real-device check (CD-6 phone gate) | **Open** — decision card with the client: 1 name a phone checker (recommended) / 2 team checks the published page in his desktop Chrome / 3 release without a device check |

Test suite: unit 422, three.js 89, browser 4 774 checks (e2e + independent QA suites, 4 viewports, real three.js r128 in headless Chrome); default full run 398.8 s, release gate (`QA_FULL=1`) 450.4 s, 0 failures on aaaddae.

## Client decisions (binding)
- **CD-1 Narrow plots:** when the plot forces it, the house may stretch up to 3:1 (long side never more than 3 × the short side + 0.5 m). Example: 10 × 50 m plot at 30 % → 6 × 18 m.
- **CD-2 Edge override:** the automatic back/side classification (40° rule) stays the default; the architect can switch any non-street edge between back and side in the site preview (tap mode or edge list); saved in the draft; cleared when the outline or street edge changes.
- **CD-3 Zero lot line:** out of scope; a 0 m setback keeps the house centred.
- **CD-4 Rooms per floor:** raised from 8 to 10 (generator re-proven at 10).
- **CD-5 Hall access:** a non-blocking warning names each room with no way in from the hall or stairs (no generator guarantee). It shows on about 1 floor in 4; listed in the release notes.
- **CD-6 Phone check of the 3D:** agreed, not yet done — now the open decision card above.
- Process: every role agent runs on Opus 5.5; Fable 5.2 only orchestrates. Work runs in batches with a pause after each.

## Key product rules (from the PM)
- Max 10 rooms per floor, 6 adjacency pairs per floor; 1–3 floors plus optional basement and usable roof; one master bedroom per house.
- Floor plans are regenerated automatically when inputs change; the app asks first only when a floor has the architect's own edits or approval.
- Rooms resize by edges (no corner handles); one-step "Undo last edit" on the plans; Regenerate resets a floor.
- 3D Reset view looks from the street (pool behind the house is one drag away); gate only with a boundary wall; garden seating and vegetation shortfalls are warned on stage 2.
- Room labels: one consistent short-name rule per room type per floor.

## Open questions for the client
- The phone-gate decision card (CD-6): option 1, 2 or 3. It closes the F4/F5 reviews and sets the device-check text in the release notes.

## What remains before release
1. Client picks a gate option; then F5-T3b on phone findings (option 1) or the phone items become recorded limits (options 2/3).
2. CTO round 2 on F4.md and F5.md.
3. Release commit: `QA_FULL=1` green, default run ≤ 420 s, lint clean, `dist/index.html` single file with three.js r128 from cdnjs, final publish; release notes finalised.

## Where things live
The full project (source, tests, all team documents, reviews and the resume note `docs/RESUME.md`) is in the zip sent alongside this summary. `docs/status.md` is the complete step-by-step log; `docs/01-product/goals-and-stories.md` the stories; `docs/02-features/architecture.md` the architecture.
