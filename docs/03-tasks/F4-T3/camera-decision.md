# F4-T3 default camera decision (PM + Designer, 2026-11-21)

Question: TL F4-T2 outcome review, item 6 (and known limit 6b). With the sample's Reset pose, the pool and garden seating sit behind the house. Options: (a) keep the street-side Reset (A-12); (b) turn Reset towards the corner with the most yard; (c) keep Reset and add a separate "Garden" view.

**Decision: (a). Reset stays on the street side, as in A-12. No new control. Owners: PM and Designer (agreed).**

Reasons:
- Reset is the "where am I" pose. A street-side view matches the 2D plans (street at the bottom; Q14 and Q17 left / right as seen from the street) and F4-S1 "the main entrance faces the street", so 2D and 3D read the same way.
- (b) "the corner with the most yard" changes from plot to plot, so the architect could not predict the view.
- (c) costs a control in a phone panel that must cover at most a third of the canvas (F4-S2), for something one finger already does: dragging shows the yard in about a second. The F5 drone tour also covers the whole site.
- (a) keeps the A-12 / A-14 contracts (the tour overview uses the Reset pose) and every pinned Reset test and QA oracle. Nothing changes in F4-T3 scope.

Not a client question: the default view is reversible and costs nothing to change later. The F4 feature review restates it for the client, who can ask for (b) or (c) as a change.

Designer check in F4-T3 (no new control): on the sample shots at 360x640 and 1280x800, check that the pool rim and the seating pad are at least partly visible past the house corners at Reset. If they are not, add one visible line to the 3D panel's View section, PM text: **"Drag to turn the model and see the garden."** (The canvas aria-label stays as it is.) This line is the only possible change, and only if the shots show the yard fully hidden. If it is needed, it goes through the F4-T3 plan review.

## Outcome of the Designer shot check (2026-11-21, PM ruling)
Designer report: sample at Reset, real r128, 360x640 and 1280x800 (`designer-shots/*-reset-real.png`). The seating pad shows past the back-right house corner; the pool (u 7, v 24) is fully hidden behind the house.

**PM ruling: no line added.**
- The trigger was "pool and seating both fully hidden". It is not met: the visible seating pad already tells the viewer there is a yard behind the house.
- The extra line would add about 16 px to a phone panel that is already at the 33 % limit (F4-S2).
- A pool hidden at Reset is accepted. The pool is one drag away, and the F5 tour shows it.
- It is listed with the default-camera limit to restate at the F4 feature review.

Open point closed for `designer-plan.md` §0 / §4.
