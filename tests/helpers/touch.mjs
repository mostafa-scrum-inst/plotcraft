// Pointer gestures for e2e: real multi-touch through CDP (Chrome turns them into Pointer Events), and mouse drags.
export async function gestures(page, isTouch) {
  const cdp = isTouch ? await page.context().newCDPSession(page) : null;
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: Math.round(p[0]), y: Math.round(p[1]), id: p[2] === undefined ? i : p[2] })) });
  // The one fixed wait kept on purpose (A-16): for about 100 ms after an injected touch sequence Chrome drops the
  // synthesized click of a tap that follows. Nothing in the page shows when that window is over, so there is no
  // state to poll; 350 ms is a floor, not a race against the app.
  const settle = () => page.waitForTimeout(350);
  // Chrome hands touch moves to the page frame-aligned: wait for frames, not for time.
  const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const G = {
    tap: (p) => (isTouch ? page.touchscreen.tap(p[0], p[1]) : page.mouse.click(p[0], p[1])),
    // One pointer from a to b. before(): runs while the pointer is still down at b.
    drag: async (a, b, before, steps = 8) => {
      if (isTouch) {
        await send('touchStart', [a]);
        for (let i = 1; i <= steps; i++) await send('touchMove', [lerp(a, b, i / steps)]);
        await frames();
        if (before) await before();
        await send('touchEnd', []); await settle();
      } else {
        await page.mouse.move(a[0], a[1]); await page.mouse.down();
        for (let i = 1; i <= steps; i++) { const p = lerp(a, b, i / steps); await page.mouse.move(p[0], p[1]); }
        if (before) await before();
        await page.mouse.up();
      }
    },
    // One pointer along a polyline (e.g. away and back to where it started), steps moves per segment.
    path: async (pts, steps = 6) => {
      const seq = [pts[0]];
      for (let j = 1; j < pts.length; j++) for (let i = 1; i <= steps; i++) seq.push(lerp(pts[j - 1], pts[j], i / steps));
      if (isTouch) {
        await send('touchStart', [seq[0]]);
        for (const p of seq.slice(1)) await send('touchMove', [p]);
        await frames(); await send('touchEnd', []); await settle();
      } else {
        await page.mouse.move(seq[0][0], seq[0][1]); await page.mouse.down();
        for (const p of seq.slice(1)) await page.mouse.move(p[0], p[1]);
        await page.mouse.up();
      }
    },
    // Two fingers: from (a0, b0) to (a1, b1). liftOneFirst: the first finger lifts, the second stays for a moment.
    two: async (a0, b0, a1, b1, liftOneFirst = false, steps = 8) => {
      await send('touchStart', [[...a0, 0]]);
      await send('touchStart', [[...a0, 0], [...b0, 1]]);
      for (let i = 1; i <= steps; i++) await send('touchMove', [[...lerp(a0, a1, i / steps), 0], [...lerp(b0, b1, i / steps), 1]]);
      await frames();
      if (liftOneFirst) { await send('touchEnd', [[...b1, 1]]); await frames(); }
      await send('touchEnd', []); await settle();
    },
    // Press and hold without moving. The wait is the thing under test (tap time limit), not a synchronisation.
    hold: async (p, ms) => {
      if (isTouch) { await send('touchStart', [p]); await page.waitForTimeout(ms); await send('touchEnd', []); await settle(); }
      else { await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); }
    }
  };
  return G;
}
