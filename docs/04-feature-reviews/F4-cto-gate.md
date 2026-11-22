# F4 real-device gate (CD-6): CTO rulings

Date: 2026-11-22. Author: CTO.
Asked by: the TL (F5-T2 `outcome-review.md`, section 1) and the orchestrator.
Background:
- The gate comes from my F3 review: I will not approve the F4 review without one real-device look at the 3D view. CD-6 is the client's decision to do that check.
- The client has been asked twice. No answers yet.

## Why the gate exists (unchanged)
Locally we cover almost everything:
- real three.js r128 runs on SwiftShader WebGL in headless Chrome;
- touch is driven through CDP at 4 viewports;
- the mock enforces the r128 API.

Three things no local test can reach:
1. **The hosted page.** The sandboxed claude.ai iframe with its CSP has to load three.js from cdnjs and start WebGL. This was never observed by anyone.
2. **A real GPU and screen.** Frame cost, shadow-map cost and colours on a real display. SwiftShader timings and colours do not count.
3. **A real hand on a real phone.** One-finger orbit, pinch and pan without the page scrolling, the plan editor's drag and resize, the closing radius on stage 1.

If (1) fails, the client sees no 3D at all. That is the one failure that would make F4 and F5 worthless to him, so a substitute must cover (1) at the least.

## Ruling 1: F5-T3a may proceed now, before any real-device evidence. Yes.
- Its outputs are CSS, markup and data tables, plus one unit-tested FS change (`forRoom` / tour target offset for desktop framing).
- Everything is cheap to adjust after the phone answers, and nothing in it is irreversible.
- Real r128 screenshots here are a sound basis for desktop framing, tour pacing and the O-1 shadow data retune.
- **Conditions:**
  - a. Nothing in F5-T3a is tuned on an assumption about phones. That covers the closing radius, gesture thresholds, phone performance settings (pixel ratio, shadow map size) and anything justified as "phones need". Those wait for F5-T3b, as the TL split already says.
  - b. The usual gates hold: the full run stays at or under 420 s and never over 480 s, the `QA_FULL=1` sweep is green in the F5-T3 QA round, and the app is republished at the end of the batch (client rule).
  - c. F5-T3a cannot close F4 and is not evidence for the gate.

## Ruling 2: substitutes I would accept if the client never answers
Today's state stands until the client chooses:
- The F4 review may be written in full and signed off on everything else.
- Its CTO verdict stays **conditional on the gate**, so it is not APPROVED.
- The F5 review and the release carry the same condition.

I accept any of the three options below. Options 2 and 3 need the client's explicit choice. I will not accept the risk on his behalf.

### Decision card for the client (wording for the orchestrator)

**Question:** No one has checked the 3D view on a real device yet. How should we close that gap?

1. **Name someone for the 5-minute phone check** (recommended)
   - What it means: you or anyone you choose opens the published page on a phone and follows the 5 checks in the testing doc.
   - Consequence: the 3D work is confirmed where your clients will use it. Problems found now are fixed in the current polish task at low cost.
2. **Let us open the published page in your desktop Chrome**
   - What it means: with the Claude in Chrome extension connected, the team opens the page and checks that the 3D loads and renders on a real graphics card. Nothing on the phone is needed from you.
   - Consequence: this proves the published page works, which is the biggest risk. Touch gestures and phone speed stay untested and are recorded as a known risk.
3. **Release without any real-device check**
   - What it means: you accept the risk, and the reviews record "never seen on a real device".
   - Consequence: no effort now. If the 3D does not load or the gestures misbehave on phones, you will find out in first use, and a fix round comes later.

**Recommended: option 1.** It is the only option that checks what your users will actually do, it takes about 5 minutes, and the earlier we know, the less any fix costs.

### What each option means for the reviews
- **Option 1:**
  - The answers go into `F1.md` and the F4 review.
  - Anything that fails becomes a bug on the owning task, routed through F5-T3b.
  - I approve F4 once items a–c of CD-6 have been observed (loads and shows the house; orbit, pinch and pan without page scroll; colours). Items d–e feed F5-T3b.
- **Option 2:**
  - The team runs the check in the client's Chrome on the published URL (stage 5 renders, no console errors, three.js loaded from cdnjs inside the iframe, mouse orbit and zoom) and records the result with screenshots.
  - I approve F4 with a recorded risk: phone touch and phone GPU are not verified.
  - F5-T3b's phone-only items (the closing radius) are then dropped or decided by the PM without evidence.
- **Option 3:**
  - I record the risk acceptance in F4 and F5 as the client's decision, and the gate closes as "waived by client".
  - F5-T3b's phone-only items are dropped.

### Timing
- Send the card now, alongside F5-T3a.
- If none of the three is chosen by the F5 feature review, the F4 and F5 reviews stay conditional and the release is reported to the client as "not verified on a real device". The team does not pick an option for him.

VERDICT: APPROVED (ruling 1: F5-T3a may proceed under conditions a–c; ruling 2: the F4 gate stays until the client picks option 1, 2 or 3 above)
