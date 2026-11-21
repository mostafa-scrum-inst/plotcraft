# PlotCraft — project summary (for the "Plot plan" project knowledge)

As of 2026-11-21. Owner: Mostafa Farouk Ibraheem. Built by a six-role AI team (CTO, PM, Tech Lead, Designer, Senior Full-Stack Dev, QA), orchestrated in one long Claude chat.

## What it is
A tool for architects, delivered as ONE self-contained HTML page (three.js r128 from cdnjs is the only external file). Five stages:
1. **Plot** — draw the land outline on a top-down grid; edge lengths and area in m or ft.
2. **Questions** — 17 saved questions (setbacks, footprint %, vegetation %, north, street edge, floors, ceiling height, roof, exterior style, rooms per floor with sizes and adjacency, stairs/lift, parking, pool, extras), with a live site preview and a conflict summary.
3. **Floor plans** — rooms laid out automatically per floor around the stair core; the architect drags and resizes rooms, then approves each floor.
4. **Interior** — interior style (modern / classic / minimal) and furniture density (sparse / full).
5. **3D view** — dollhouse-style block model with time of day, seasons, room dropdown and a drone tour along a spline path (not built yet).

Works on phone, tablet and desktop (touch, mouse, keyboard). Visual approximation only (no real solar/climate data).

## Live preview
Published privately: https://claude.ai/artifact/G9KRxuvUSm3MongWXzgfTn (stages 1–4 working; stage 5 is a placeholder).
Testing guide (25 steps + report table): https://claude.ai/artifact/LsqkH2iM1PwLMZ4ag2jaeA

## Status
| Feature | State |
|---|---|
| F1 Plot drawing + app shell | Done, approved by PM and CTO |
| F2 Questionnaire (site model, questions, rooms, narrow plots, edge overrides) | Done, approved by PM and CTO |
| F3 Floor plans: F3-T1 generator + plan view, F3-T2 editor + approval + interior | Done (QA passed) |
| F3-T3 Designer 3D look tables; F3 feature review | Next |
| F4 3D dollhouse model (time of day, seasons, camera) | Not started |
| F5 Room dropdown + drone tour + polish | Not started |
| Real-phone check (F1 gate) | Open — needs the client's answers from the testing guide |

Test suite: about 10,000 automated checks (unit, browser end-to-end at 4 viewports, independent QA suites); full run ~10 minutes.

## Client decisions (binding)
- **CD-1 Narrow plots:** when the plot forces it, the house may stretch up to 3:1 (long side never more than 3 × the short side + 0.5 m). Example: 10 × 50 m plot at 30 % → 6 × 18 m.
- **CD-2 Edge override:** the automatic back/side classification (40° rule) stays the default; the architect can switch any non-street edge between back and side in the site preview (tap mode or edge list); saved in the draft; cleared when the outline or street edge changes.
- **CD-3 Zero lot line:** out of scope; a 0 m setback keeps the house centred.
- Process: every role agent runs on Opus 5.5; Fable 5.2 only orchestrates. Work runs in batches with a pause after each.

## Key product rules (from the PM)
- Max 8 rooms per floor, 6 adjacency pairs per floor; 1–3 floors plus optional basement and usable roof; one master bedroom per house.
- Floor plans are regenerated automatically when inputs change; the app asks first only when a floor has the architect's own edits or approval.
- Rooms resize by edges (no corner handles); no undo yet (Regenerate resets a floor).
- Room labels: one consistent short-name rule per room type per floor.

## Open questions for the client
- Is 8 rooms per floor enough? (to be asked after you have seen generated plans)
- Real-phone results from the testing guide.

## Where things live
The full project (source, tests, all team documents, reviews and the resume note `docs/RESUME.md`) is in the zip sent alongside this summary. `docs/status.md` is the complete step-by-step log; `docs/01-product/goals-and-stories.md` the stories; `docs/02-features/architecture.md` the architecture.
