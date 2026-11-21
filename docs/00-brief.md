# PlotCraft — Product Brief (from the client, Mostafa)

Working title: **PlotCraft**. A tool for architects.

## The idea
1. **Draw the plot** — top-down 2D grid; the architect outlines a piece of land as a polygon. Measurements (edge lengths, area) are shown in the unit the user chooses (m / ft).
2. **Questionnaire** — saved questions (below). Rooms are defined by the architect *during the questionnaire*.
3. **Floor-by-floor 2D plans** — the tool auto-generates a 2D layout per floor from the room list, inside the buildable area. The architect can drag/resize rooms and must **approve each floor** before the 3D build.
4. **3D mockup (three.js)** — only after all floor plans are approved: a block-based ("building blocks") house on the plot, **dollhouse style** (walls cut away / no ceilings so interiors are visible), rooms with **interior design** (block furniture per room type), vegetation on the plot.
5. **Explore** — view from any angle (orbit/zoom/pan), **time of day** and **season** controls (visual approximation only — no real solar/climate data; seasons change lighting, sky and vegetation look: green / autumn colours / bare or snow).
6. **Room tours** — pick a room from a **dropdown** to fly the camera to it, or start a **drone-style camera** that explores the house room by room along a **spline flight path**.

## Approved questionnaire
*Plot and site*
1. Measurement unit (m / ft)
2. Setbacks from each boundary (front, back, sides)
3. Building footprint % of plot
4. Vegetation % of plot
5. North direction (for sun and shadows)
6. Street-facing side / main entrance edge

*Building*
7. Number of floors (plus basement and usable roof, yes/no)
8. Floor-to-ceiling height
9. Roof type (flat, pitched, terrace)
10. Exterior style / colour palette (a few presets)

*Rooms (per floor)*
11. Room list: type, count, floor (bedroom, bathroom, kitchen, living, dining, majlis, office, maid's room, storage, laundry)
12. Approximate size per room (S/M/L or exact area)
13. Must-be-adjacent pairs (e.g. kitchen+dining, master bedroom+en-suite)
14. Staircase position preference; lift yes/no

*Outdoor*
15. Parking: number of cars, covered or open
16. Pool yes/no and size
17. Extras: garden seating, boundary wall, gate position

*Interior (asked after floor plans are approved)*
18. Interior style preset (modern, classic, minimal)
19. Furniture density (sparse / full)

## Hard constraints (non-negotiable, set by the environment)
- **Prototype = ONE self-contained HTML file**: `/home/claude/plotcraft/dist/index.html` (inline CSS + JS). It will be published as a hosted page inside a sandboxed iframe with a strict CSP.
- **three.js r128 global build only**, loaded with exactly:
  `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>`
  No other external scripts, no ES-module imports, no `examples/js` add-ons (no OrbitControls import — write our own camera controls). No external images/fonts/fetch. Textures must be procedural (canvas) or absent.
- **Sandbox rules**: no `alert/confirm/prompt`, no downloads, no `window.open`, no forms that submit (use preventDefault), no service workers. `localStorage` may be used only inside try/catch as a convenience (e.g. autosave draft) and the app must work without it.
- **Works on any device from day one**: phone, tablet, desktop. Touch + mouse + (basic) keyboard. Pointer Events. Responsive layout from 360px wide. One-finger orbit, two-finger pinch/pan in 3D. Touch targets >= 44px.
- **Performance**: must run on a mid-range phone. Cap pixel ratio at 2, modest shadow maps, merged/instanced or low mesh counts, pause render loop when 3D view hidden.
- **No network in the build workspace**: three.js cannot be downloaded here. Local tests cannot run the real library. QA tests 2D flows in headless Chrome (`/usr/bin/google-chrome`, playwright at `/opt/npm-tools/node_modules/playwright`) and tests 3D code against a strict THREE r128 mock (`tests/three-mock.js`) that throws on any member not in the real r128 API. Therefore: use only well-known, stable r128 APIs, and be conservative.
- Source layout is the Tech Lead's call, but the deliverable must be the single file above (a tiny build script that inlines `src/` files into `dist/index.html` is recommended so agents edit small files).

## Scope guard
This is a first prototype. Keep the plan to **at most 5 features and at most 3 tasks per feature**. Prefer robust and simple over clever.
