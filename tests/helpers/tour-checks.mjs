// F5-T2 drone tour in the browser with the strict THREE mock (F5-S2, G1; PM round 13; TL F5-T2 plan review items 1,
// 4, 6 and rulings Q8 / Q9): run inside view3d.spec's existing page loads (no new page, about 2 s of real tour time
// per viewport); later stops are reached with the debug-only PC.debug.tourSeek. tourChecks(o, vp, T) expects the
// sample on stage 5 (after finderChecks); it leaves no tour running, level All, the View tab current.
//   phone (touch): G1 = 4 taps (the 2 to 3D already taken + Tour tab + Start); controls >= 44 px; Start: Roof off,
//     caption "Room · Level" + its pause / stop shown; the caption pause pauses (aria-pressed, "Resume tour"; the panel
//     mirrors) and resumes; seek across the G -> 1 level switch: the tour keeps running (programmatic radios); seek to
//     the last leg: "Overview", All, no highlight; the caption stop ends it: camera / level kept, caption and
//     highlight cleared, select "Go to room…".
//   desktop (keyboard): Start by Enter; Pause / Resume by Space; Fast; a Light preset keeps it running; a canvas
//     drag ends it; a new tour then leaving stage 5 ends it, and returning does not restart it; the speed is kept.
//   g1Draft(o, vp, T): with a stored draft, Load sample asks first: 5 taps from the start card to a running tour.
import { settled } from './browser.mjs';

const okCap = (c) => c === 'Overview' || / · (Basement|Ground floor|First floor|Second floor)$/.test(c || '');
const st = (page) => page.evaluate(() => {
  const q = (h) => document.querySelector(`[data-pc="${h}"]`), i = PC.debug.scene(), t = PC.three.tour.state();
  return { running: t.running, paused: t.paused, tau: t.tau, speed: t.speed, stop: t.stop, start: q('v3-tour-start').disabled, pause: q('v3-tour-pause').disabled, stopB: q('v3-tour-stop').disabled,
    pressed: q('v3-tour-pause').getAttribute('aria-pressed'), label: q('v3-tour-pause').getAttribute('aria-label'), capPressed: q('v3-caption-pause').getAttribute('aria-pressed'),
    capBtns: ['v3-caption-pause', 'v3-caption-stop'].filter((h) => !q(h).hidden), caption: q('v3-caption').hidden ? null : q('v3-caption-text').textContent,
    roof: i.roof, roofBox: q('v3-roof').checked, level: i.level, radio: (q('v3-level').querySelector('input:checked') || {}).value, sel: PC.view3d.selected(), value: q('v3-room').value,
    pose: JSON.stringify(PC.debug.cam()), look: PC.view3d.look() };
});
const pane = async (o, name) => { if (await o.hook('v3-tab-' + name).isVisible()) { await o.act('v3-tab-' + name); await settled(o.page); } };
const seek = (page, t) => page.evaluate((t) => PC.debug.tourSeek(t), t);
const frames = (page, n = 2) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

export async function tourChecks(o, vp, T) {
  const { page, hook, act } = o, tag = vp.tag + ' mock tour';
  try {
    await pane(o, 'tour');
    const sizes = await page.evaluate(() => ['v3-tour-start', 'v3-tour-pause', 'v3-tour-stop'].map((h) => { const r = document.querySelector(`[data-pc="${h}"]`).getBoundingClientRect(); return Math.min(r.width, r.height); }));
    T.ok(sizes.every((x) => x >= 44 - 0.5), `${tag} Start / Pause / Stop >= 44 px (${sizes.map((x) => x.toFixed(0))})`);
    const look0 = await page.evaluate(() => PC.view3d.look());
    if (vp.touch) {
      // G1: the 2 taps to 3D were taken at the start of this page; the Tour tab tap was just taken (pane); now Start
      await hook('v3-roof').evaluate((r) => { if (!r.checked) r.click(); });
      await act('v3-tour-start'); await frames(page);
      let s = await st(page);
      T.ok(s.running && s.start && !s.pause && !s.stopB && !s.roof && !s.roofBox && s.capBtns.length === 2 && okCap(s.caption), `${tag} G1: Tour tab + Start = taps 3 and 4: running, Roof off, Start disabled, caption "${s.caption}" with pause / stop`);
      const capSize = await page.evaluate(() => ['v3-caption-pause', 'v3-caption-stop'].map((h) => { const r = document.querySelector(`[data-pc="${h}"]`).getBoundingClientRect(); return [Math.min(r.width, r.height), r.left >= 0 && r.right <= innerWidth]; }));
      T.ok(capSize.every(([m, inside]) => m >= 44 - 0.5 && inside), `${tag} caption pause / stop >= 44 px, inside the viewport`);
      await act('v3-caption-pause'); await frames(page);
      s = await st(page);
      const p0 = s.pose; await frames(page, 3);
      T.ok(s.paused && s.pressed === 'true' && s.capPressed === 'true' && s.label === 'Resume tour' && (await st(page)).pose === p0, `${tag} caption pause: paused, aria-pressed true on both, "Resume tour", pose frozen`);
      await act('v3-caption-pause'); await frames(page);
      s = await st(page);
      T.ok(s.running && !s.paused && s.label === 'Pause tour' && s.pressed === 'false', `${tag} caption pause again: resumed`);
      // seek across the level switch G -> 1 and to the last leg
      const plan = await page.evaluate(() => PC.three.tour.state().plan.stops.map((x) => ({ kind: x.kind, level: x.level, t: x.t })));
      const up = plan.findIndex((x) => x.kind === 'room' && x.level === '1');
      await seek(page, plan[up].t - 0.3); await frames(page);
      s = await st(page);
      T.ok(s.running && s.level === '1' && s.radio === '1' && / · First floor$/.test(s.caption || '') && s.sel, `${tag} seek across G -> 1: still running, level First (radio too), caption "${s.caption}", highlight`);
      await seek(page, plan[plan.length - 1].t - 2); await frames(page);
      s = await st(page);
      T.eq([s.running, s.caption, s.level, s.radio, s.sel], [true, 'Overview', 'all', 'all', null], `${tag} last leg: "Overview", All, no highlight`);
      await seek(page, plan[up].t + 0.2); await frames(page);
      const before = await st(page);
      await act('v3-caption-stop'); await settled(page);
      s = await st(page);
      T.eq([s.running, s.start, s.pause, s.stopB, s.caption, s.sel, s.value, s.level, s.capBtns.length], [false, false, true, true, null, null, '', before.level, 0], `${tag} caption stop: ended; Start back, caption / highlight cleared, select "Go to room…", level kept`);
    } else {
      await hook('v3-tour-start').focus(); await page.keyboard.press('Enter'); await frames(page);
      let s = await st(page);
      T.ok(s.running && okCap(s.caption), `${tag} Start by Enter: running, caption "${s.caption}"`);
      await hook('v3-tour-pause').focus(); await page.keyboard.press('Space'); await frames(page);
      s = await st(page);
      T.ok(s.paused && s.pressed === 'true' && s.label === 'Resume tour', `${tag} Space on Pause: paused, aria-pressed, "Resume tour"`);
      await page.keyboard.press('Space'); await frames(page);
      T.ok(!(await st(page)).paused, `${tag} Space again: resumed`);
      await page.locator('[data-pc="v3-tour-speed"] label:has(> input[value="fast"])').click(); await frames(page);
      s = await st(page);
      T.eq([s.running, s.speed], [true, 'fast'], `${tag} Fast mid-tour: still running`);
      await pane(o, 'light'); await act('v3-preset-night'); await frames(page); await pane(o, 'tour');
      s = await st(page);
      T.ok(s.running && s.look.hour === 22, `${tag} a Light preset mid-tour: still running, look 22:00`);
      const box = await hook('v3-canvas').boundingBox();
      await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 3 + 40, box.y + box.height / 2, { steps: 2 }); await page.mouse.up(); await settled(page);
      s = await st(page);
      T.eq([s.running, s.start, s.caption, s.sel], [false, false, null, null], `${tag} a canvas drag ends it; Start back, caption and highlight cleared`);
      // leaving stage 5 ends it; back: no restart; speed kept
      await act('v3-tour-start'); await frames(page);
      await act('btn-back'); await settled(page);
      await act('btn-next'); await page.waitForFunction(() => { const i = PC.debug.scene(); return i.renders > 0 && !i.frame && !i.building; });
      s = await st(page);
      T.eq([s.running, s.start, s.speed], [false, false, 'fast'], `${tag} leaving stage 5 ends it; returning does not restart it; Fast kept`);
      await page.locator('[data-pc="v3-tour-speed"] label:has(> input[value="normal"])').click();
      await page.evaluate((l) => PC.view3d.setLook(l), look0);
    }
    await pane(o, 'view');
    await page.locator('[data-pc="v3-level"] label:has(> input[value="all"])')[vp.touch ? 'tap' : 'click'](); await settled(page);
  } catch (e) { T.ok(false, `${tag} crashed: ` + (e && e.stack || e)); }
}

// G1 with a stored draft (TL F5-T2 plan review, other checks): Load sample asks first -> 5 taps to a running tour.
export async function g1Draft(o, vp, T) {
  const { page, act } = o, tag = vp.tag + ' mock tour G1 draft';
  try {
    // a reload of this page: the draft it saved is offered on the start card (Resume / Start new), plot empty
    await page.reload(); await settled(page);
    T.ok(await page.evaluate(() => !document.querySelector('[data-pc="resume-box"]').hidden), `${tag}: the saved draft is offered`);
    let taps = 0; const tap = async (h) => { await act(h); taps++; await settled(page); };
    await tap('btn-sample'); await tap('dialog-ok'); await tap('btn-skip3d');
    await page.waitForFunction(() => { const i = PC.debug.scene(); return i.renders > 0 && !i.building; });
    if (await o.hook('v3-tab-tour').isVisible()) await tap('v3-tab-tour');
    await tap('v3-tour-start');
    const run = await page.evaluate(() => PC.three.tour.running());
    T.ok(run && taps === (vp.touch ? 5 : 4), `${tag}: Load sample + its confirm -> Skip to 3D -> (Tour tab) -> Start = ${taps} taps, touring`);
    await page.evaluate(() => PC.three.tour.stop());
  } catch (e) { T.ok(false, `${tag} crashed: ` + (e && e.stack || e)); }
}
