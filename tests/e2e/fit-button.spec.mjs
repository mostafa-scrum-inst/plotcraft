// F1-T1 (Designer): layout of the "Fit view" buttons (plot-fit on stage 1, plan-fit on stage 3). Behaviour is tested by FS.
import { launch, open, suite, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';

const T = suite('e2e fit-button'), browser = await launch();
const measure = (page, stage, fit, canvas, others) => page.evaluate(({ stage, fit, canvas, others }) => {
  const q = (h) => document.querySelector(`[data-pc="${h}"]`);
  for (const s of document.querySelectorAll('[data-stage]')) s.hidden = s.dataset.stage !== String(stage);   // layout only: force the stage
  const shown = (e) => e && !e.closest('[hidden]') && e.getClientRects().length > 0;
  const R = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; };
  const b = q(fit), r = R(b), c = R(q(canvas));
  const hit = (a, o) => !(a.right <= o.left || o.right <= a.left || a.bottom <= o.top || o.bottom <= a.top);
  const e = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
  return {
    tag: b.tagName, type: b.type, name: b.getAttribute('aria-label'), icon: b.querySelector('use')?.getAttribute('href'), w: r.w, h: r.h,
    inside: r.left >= c.left && r.top >= c.top && r.right <= c.right && r.bottom <= c.bottom,
    gapTop: r.top - c.top, gapRight: c.right - r.right,
    overlaps: others.filter((h) => shown(q(h)) && hit(r, R(q(h).closest('.pc-chip') || q(h)))),
    onTop: !!e && (e === b || b.contains(e))
  };
}, { stage, fit, canvas, others });
try {
  for (const vp of [VIEWPORTS[0], LANDSCAPE, VIEWPORTS[2]]) {
    const { ctx, page, problems } = await open(browser, vp);
    const cases = [[1, 'plot-fit', 'plot-canvas', ['plot-scale', 'btn-sample', 'start-panel']], [3, 'plan-fit', 'plan-canvas', ['plan-error']]];
    for (const [stage, fit, canvas, others] of cases) {
      if (stage === 3) await page.evaluate(() => { document.querySelector('[data-pc="plan-error"]').hidden = false; });   // worst case: banner shown
      const m = await measure(page, stage, fit, canvas, others), at = `${vp.tag} ${fit}`;
      T.ok(m.tag === 'BUTTON' && m.type === 'button' && m.name === 'Fit view' && m.icon === '#i-frame', `${at}: button, accessible name "Fit view", frame icon`);
      T.ok(m.w >= 44 && m.h >= 44, `${at}: ${m.w.toFixed(0)}x${m.h.toFixed(0)} target`);
      T.ok(m.inside, `${at}: inside the canvas`);
      T.ok(Math.abs(m.gapTop - 8) <= 1 && Math.abs(m.gapRight - 8) <= 1, `${at}: 8 px from the top right (${m.gapTop.toFixed(1)}, ${m.gapRight.toFixed(1)})`);
      T.ok(m.overlaps.length === 0, `${at}: no overlap (${m.overlaps.join(', ') || 'none'})`);
      T.ok(m.onTop, `${at}: not covered at its centre`);
    }
    T.ok(await page.evaluate(() => !document.querySelector('[data-pc="site-preview"] .pc-fit')), `${vp.tag}: no fit button on the site preview`);
    T.none(problems(), `${vp.tag}: no errors`);
    await ctx.close();
  }
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
