# PlotCraft — release notes (draft)

Version: release candidate, 2026-11-22. Status: **draft, waiting for your device-check choice** (see the last section).
Live page: https://claude.ai/artifact/LDbG9XdU1UeAMcVwqmxAB9 (private; the same link is updated with each release).

## What PlotCraft does

PlotCraft takes an architect from an empty plot to a 3D block model of a villa in one sitting, in five stages:

1. **Plot.** Draw the land outline on a grid. Edge lengths and the area update as you draw, in metres or feet.
2. **Questions.** Answer the 17 site and building questions:
   - setbacks, house size (footprint %) and garden size (vegetation %);
   - north direction and street edge;
   - floors, basement, usable roof, ceiling height, roof type and exterior colour;
   - the rooms on each floor (up to 10), their sizes and which rooms must be next to each other;
   - stairs and lift;
   - parking, pool, boundary wall, gate and garden seating.

   A live site preview shows the buildable area and the house. A summary warns about anything that cannot work. You can switch any side boundary between "back" and "side".
3. **Floor plans.** Each floor is laid out for you around the stairs. You drag and resize rooms and can undo the last edit. Warnings tell you about:
   - rooms that should be next to each other but are not;
   - rooms with no way in from the hall;
   - floors that are mostly empty.

   You approve each floor; nothing is built in 3D until every floor is approved.
4. **Interior.** Choose the furniture style (Modern, Classic or Minimal) and how much furniture (Sparse or Full).
5. **3D view.** A dollhouse-style model on your plot, with:
   - furniture, stairs, roof (Roof switch), parking, pool, wall, gate, seating, trees and shrubs, and a north marker;
   - **the view opens on the outside of the house; switch Roof off to see inside** (or pick a floor or a room);
   - free camera: drag or one finger to turn, wheel or pinch to zoom, two fingers to pan, and "Reset view";
   - a floor selector (All / Basement / Ground / First / Second);
   - **Light:** time of day and season (spring, summer, autumn and winter, including bare trees and snow);
   - **Go to room:** flies to any room, highlights it and names it ("Bedroom 2 · First floor");
   - **Tour:** a hands-free drone flight from the outside through every room, floor by floor, with Pause, Stop and Slow / Normal / Fast.

It works on phones, tablets and desktops, by touch, mouse or keyboard. Your work is saved in the browser as you go, and "Resume" brings it back.

## How to use it (quick start)

1. Open the page. Tap **Load sample project** to see a finished example, or start drawing your own plot.
2. With the sample, **Skip to 3D** takes you straight to the model.
3. For your own project:
   1. Close the plot outline.
   2. Answer the questions, and fix anything the summary marks as blocking.
   3. Check and adjust each floor, then press **Approve floor**.
   4. Pick the interior and press **Build 3D model**.
4. In 3D, use **Go to room** to inspect a room or **Tour** to present the house. Change the time and season under **Light**.
5. **Back** returns to earlier stages. Changing an answer that affects a floor you edited or approved asks you first.

## Known limits (accepted)

**Floor plans**
- **Warnings about a way into rooms:**
  - About **1 floor in 4** (nearly half of floors with 6 or more rooms) gets a warning that a room has no way in from the hall or stairs. Fix it by moving or resizing a neighbouring room.
  - A small closed-off piece of hall counts as a way in, even if it does not connect to the stairs or the entrance.
  - A bathroom off a bedroom or maid's room, and a storage room or laundry off another room, are not flagged.
- **On a phone,** a full 10-room floor on a large plot is drawn smaller, but every room keeps its label.
- **Corner handles and keyboard editing of rooms are not included;** rooms are resized by their edges.

**3D view**
- **The default view looks at the house from the street,** so the pool sits behind the house. One drag shows it.
- **Rooms in 3D have realistic floors** (wood, tile or carpet with a hint of the room colour) and their own furniture, but no name labels. Rooms with the same floor (living, dining, bedrooms, office) are told apart by walls and furniture, and their names show in "Go to room" and on the tour. The 3D floor colours no longer match the 2D plan colours.
- **Very large gardens are drawn thinner than asked:** at most 120 trees and 200 shrubs, about 1 020 m² of planting. There is no message.
- **Raising the vegetation % can swap some shrubs for trees;** existing trees never move.
- **The sun is approximate,** not real solar data, as the app says.
- **The room highlight is darker at night,** but still visible.
- **On a very slow device,** flights and the tour take longer than their normal times; nothing is skipped.
- **During the tour,** the next room can sit off-centre for a moment between stops.
- **Changing the floor during a room flight** clears the selection; the flight still finishes.

**Layout and saving**
- On a desktop screen the site legend can take 2 lines; on a landscape phone a long blocking message on the plans stage runs to about 4 lines.
- If the browser cannot save (private mode, or full storage), a small icon in the header says so, and a message appears if saving stops during your work.

**Out of scope for this prototype**
- Zero-lot-line (0 m setback) houses.
- Real solar or climate data.
- Undo beyond the last plot point or the last room edit.

## Device check (to be completed when you choose)

The 3D view has been tested thoroughly in our test browser, including the real 3D library, touch gestures and four screen sizes. **It has not yet been seen on a real device.** Your choice on the open decision card sets the final text of this section. Only the matching text below will remain.

**If you choose option 1 (a named phone check):**
> Checked on a real phone on [date] by [name], [phone model and browser]: the page loads, the 3D house shows, one-finger orbit and two-finger zoom/pan work without scrolling the page, and colours read well. [Findings and fixes, or "No problems found."] Final phone tuning (gesture sensitivity, closing the plot outline, display quality) was done from these results.

**If you choose option 2 (the team checks in your desktop Chrome):**
> Checked on [date] on the published page in a desktop Chrome with a real graphics card: the 3D library loads, the house renders without errors, a room flight and the tour work. **Phones have not been checked:** touch gestures and phone speed are a known risk. If something misbehaves on a phone, tell us and we will fix it in a follow-up round.

**If you choose option 3 (release without a device check):**
> Released without a check on a real device, at your request. Everything passed our automated tests, but **neither the published page nor phone touch and speed have been seen on a real device**. If the 3D does not load or gestures misbehave, tell us and we will fix it in a follow-up round.
