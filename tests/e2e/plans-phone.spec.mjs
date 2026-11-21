// F3-T2 Designer (designer-plan.md, TL plan review): stage-3 panel. Sample drawn at 14 px/m or more at 360x640 with
// the sample strip and at 640x360 (fit margin 0.5 m, FS); compact counter still visible on phones; the readout shows
// the longest drawn-vs-asked text in full without changing height; 44 px action row. Label tiers are the FS's.
import { launch, open, suite, settled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e plans-phone'), browser = await launch();
const VPS = [VIEWPORTS[0], { tag: '360x740', w: 360, h: 740, touch: true }, LANDSCAPE, VIEWPORTS[1], VIEWPORTS[2]];
const SCALE_MIN = { '360x640': 14, '640x360': 14 };
const LONG = { m: ['Master bedroom', '4.9 × 5.0 m', '39 m² (asked 42 m²)'], ft: ['Master bedroom', '16.1 × 16.4 ft', '414 sq ft (asked 452 sq ft)'] };
const phone = (vp) => vp.w < 600 && vp.h > 480;
const MSGS = ["Master bedroom and Maid's room 2 overlap. Move or resize the marked rooms to approve this floor.",
  '12 overlaps on this floor. Move or resize the marked rooms to approve it.', 'Second floor is back to Draft. Approve it again when you are done.'];

const measure = (page) => page.evaluate(() => {
  const q = (h) => document.querySelector(`[data-pc="${h}"]`), R = (e) => e.getBoundingClientRect();
  const lines = (el) => { const g = document.createRange(); g.selectNodeContents(el); return new Set([...g.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.bottom))).size; };
  const c = R(q('plan-canvas')), st = PC.debug.site(), v = PC.debug.view('plan');
  const counter = q('plan-counter').closest('.pc-plans__counter'), cr = R(counter);
  const readout = q('plan-room-name').closest('.pc-plans__readout');
  return {
    scale: v.scale, canvasW: c.width, canvasH: c.height, fp: { w: st.footprint.w, d: st.footprint.d },
    counter: { h: cr.height, text: counter.textContent.replace(/\s+/g, ' ').trim(), shown: cr.height > 1 && getComputedStyle(counter).visibility !== 'hidden', font: parseFloat(getComputedStyle(counter).fontSize) },
    readoutH: R(readout).height,
    dds: ['plan-room-name', 'plan-room-dims', 'plan-room-area'].map((h) => { const d = q(h), r = R(d), cell = R(d.parentElement);
      return { h, text: d.textContent, full: d.scrollWidth <= d.clientWidth + 0.5, lines: lines(d), inside: r.left >= cell.left - 0.5 && r.right <= cell.right + 0.5 }; }),
    buttons: ['btn-regenerate', 'btn-approve'].map((h) => { const r = R(q(h)); return [r.width, r.height]; })
  };
});

try {
  for (const vp of VPS) for (const unit of ['m', 'ft']) {
    const { ctx, page, act, problems } = await open(browser, vp), at = `${vp.tag} ${unit}`;
    await act('btn-sample');   // the sample strip stays: unit changes keep the sample unmodified
    if (unit === 'ft') await act('unit-ft');
    await page.evaluate(() => { PC.stages.MAX_BUILT = Math.max(PC.stages.MAX_BUILT, 3); PC.store.go(2); PC.store.go(3); });
    await page.waitForFunction(() => document.querySelectorAll('[data-pc="plan-tabs"] [role="tab"]').length >= 1 && PC.debug.view('plan').width > 0, null, { timeout: 5000 });
    await page.evaluate(() => document.querySelector('[data-pc="plan-fit"]').click());
    await settled(page);
    T.ok(await page.evaluate(() => !document.querySelector('[data-pc="sample-strip"]').closest('[hidden]')), `${at}: sample strip shown (worst case)`);
    const m = await measure(page);

    // drawing scale: the FS fit (footprint + 0.5 m each side, 12 px pads) has landed, so the actual scale counts
    console.log(`  ${at}: canvas ${m.canvasW.toFixed(0)}x${m.canvasH.toFixed(1)}, scale ${m.scale.toFixed(2)}, counter ${m.counter.h.toFixed(1)}, readout ${m.readoutH.toFixed(1)}`);
    if (SCALE_MIN[vp.tag]) T.ok(m.scale >= SCALE_MIN[vp.tag] - 0.005, `${at}: sample drawn at ${m.scale.toFixed(2)} px/m (>= ${SCALE_MIN[vp.tag]})`);

    // counter: visible everywhere; one compact caption line on phones
    T.ok(m.counter.shown && /^\d+ of \d+ floors? approved$/.test(m.counter.text), `${at}: counter visible ("${m.counter.text}")`);
    if (phone(vp)) T.ok(m.counter.h <= 20.5 && m.counter.font <= 12, `${at}: compact counter (${m.counter.h.toFixed(1)} px, ${m.counter.font} px text)`);

    // readout: longest content in full, one line each, same height as with nothing selected (no canvas re-fit)
    T.ok(m.dds.every((d) => d.full && d.lines <= 1 && d.inside), `${at}: readout with nothing selected fits`);
    await page.evaluate((t) => { ['plan-room-name', 'plan-room-dims', 'plan-room-area'].forEach((h, i) => { document.querySelector(`[data-pc="${h}"]`).textContent = t[i]; }); }, LONG[unit]);
    await settled(page);
    const m2 = await measure(page);
    for (const d of m2.dds) T.ok(d.full && d.lines === 1 && d.inside, `${at}: "${d.text}" shown in full on one line (${d.h})`);
    T.ok(Math.abs(m2.readoutH - m.readoutH) <= 0.5 && Math.abs(m2.canvasH - m.canvasH) <= 0.5, `${at}: readout ${m.readoutH.toFixed(1)} -> ${m2.readoutH.toFixed(1)} px, canvas unchanged`);

    T.ok(m.buttons.every(([w, h]) => w >= 44 && h >= 44), `${at}: action buttons 44 px or more`);

    // message line (panel under the canvas): the longest messages fit, and neither they nor the warnings chip
    // change the canvas size; the chip floats over the canvas bottom left, clear of Fit view
    if (vp.h > 480 && vp.w < 900) {
      const res = [];
      for (const t of MSGS) res.push(await page.evaluate((t) => { const el = document.querySelector('[data-pc="plan-msg"]'); el.textContent = t;
        return { fits: el.scrollHeight <= el.clientHeight + 0.5 && el.scrollWidth <= el.clientWidth + 0.5, h: document.querySelector('[data-pc="plan-canvas"]').getBoundingClientRect().height }; }, t));
      T.ok(res.every((r) => r.fits), `${at}: longest messages shown in full in the fixed line`);
      T.ok(res.every((r) => Math.abs(r.h - m2.canvasH) <= 0.5), `${at}: canvas height unchanged by the message (${res.map((r) => r.h.toFixed(1)).join(', ')})`);
      const chip = await page.evaluate(() => { const q = (h) => document.querySelector(`[data-pc="${h}"]`); q('plan-warn-toggle').hidden = false;
        const b = q('plan-warn-toggle').getBoundingClientRect(), c = q('plan-canvas').getBoundingClientRect(), f = q('plan-fit').getBoundingClientRect();
        return { w: b.width, h: b.height, inside: b.left >= c.left && b.right <= c.right && b.top >= c.top && b.bottom <= c.bottom,
          fit: !(b.right <= f.left || f.right <= b.left || b.bottom <= f.top || f.bottom <= b.top), canvasH: c.height }; });
      T.ok(chip.w >= 44 && chip.h >= 44 && chip.inside && !chip.fit, `${at}: warnings chip ${chip.w.toFixed(0)}x${chip.h.toFixed(0)} over the canvas, clear of Fit view`);
      T.ok(Math.abs(chip.canvasH - m2.canvasH) <= 0.5, `${at}: showing the warnings chip keeps the canvas size`);
      await page.evaluate(() => { document.querySelector('[data-pc="plan-warn-toggle"]').hidden = true; });
    }

    // approved: green wins over the pressed tint; the keyboard focus ring stays visible
    const ap = await page.evaluate(() => {
      const b = document.querySelector('[data-pc="btn-approve"]'), probe = document.createElement('i');
      probe.style.cssText = 'position:absolute;background:var(--ok)'; document.body.append(probe);
      const ok = getComputedStyle(probe).backgroundColor; probe.remove();
      b.classList.add('is-approved'); b.setAttribute('aria-pressed', 'true'); b.disabled = false;
      b.getAnimations().forEach((a) => a.finish());   // background-color transition
      const cs = getComputedStyle(b); return { bg: cs.backgroundColor, ok, color: cs.color };
    });
    T.ok(ap.bg === ap.ok && ap.color === 'rgb(255, 255, 255)', `${at}: approved button green (${ap.bg} vs ${ap.ok})`);
    await page.locator('[data-pc="btn-approve"]').focus();
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => { const b = document.activeElement; b.getAnimations().forEach((a) => a.finish()); const cs = getComputedStyle(b); return { id: b.dataset.pc, ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, bg: cs.backgroundColor }; });
    T.ok(ring.id === 'btn-approve' && ring.ring && ring.bg === ap.ok, `${at}: focused approved button keeps green and shows its ring`);
    T.none(await A.noPageScroll(page), `${at}: no page scroll`);
    T.none(await A.tapTargets(page), `${at}: tap targets`);
    T.none(problems(), `${at}: clean log`);
    await ctx.close();
  }
  // TL ruling: a floor with warnings keeps the phone scale too (the chip floats over the canvas, the message line is
  // fixed), so 14 px/m is asserted for it as well. A real warning: vegetation 70 % ("reduced"); the strip goes with it.
  for (const vp of [VIEWPORTS[0], LANDSCAPE]) {
    const { ctx, page, act, problems } = await open(browser, vp), at = `${vp.tag} warnings`;
    await act('btn-sample');
    await page.evaluate(() => { PC.store.commit((s) => { s.ans.vegPct = 70; }); PC.store.go(2); PC.store.go(3); });
    await page.waitForFunction(() => PC.debug.view('plan').width > 0 && !document.querySelector('[data-pc="plan-warn-toggle"]').hidden || getComputedStyle(document.querySelector('[data-pc="plan-warn-panel"]')).display !== 'none', null, { timeout: 5000 });
    await page.evaluate(() => document.querySelector('[data-pc="plan-fit"]').click());
    await settled(page);
    const w = await page.evaluate(() => ({ scale: PC.debug.view('plan').scale, n: document.querySelectorAll('[data-pc="plan-warn-list"] > li').length }));
    T.ok(w.n >= 1, `${at}: the floor has ${w.n} warning(s)`);
    T.ok(w.scale >= 14 - 0.005, `${at}: drawn at ${w.scale.toFixed(2)} px/m (>= 14)`);
    T.none(await A.noPageScroll(page), `${at}: no page scroll`);
    T.none(await A.tapTargets(page), `${at}: tap targets`);
    T.none(problems(), `${at}: clean log`);
    await ctx.close();
  }
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
