// F3-T1 Designer fix (TL F3-T1 impl review round 1, ruling 2): the stage-3 no-layout banner stays compact on
// phones and in short landscape: at most half the canvas, full text, "Go to room list" on its own 44 px line,
// clear of the Fit view button. Tablet and desktop layout unchanged.
import { launch, open, suite, settled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e plan-banner'), browser = await launch();
const NARROW = [VIEWPORTS[0], { tag: '360x740', w: 360, h: 740, touch: true }, LANDSCAPE];
// Banner boxes relative to the canvas, measured on the tree before this change (must stay the same).
const UNCHANGED = {
  '768x1024': { left: 8, top: 8, w: 700, h: 54, btn: [567.2, 5, 123.8, 44] },
  '1280x800': { left: 8, top: 8, w: 852, h: 54, btn: [719.2, 5, 123.8, 44] }
};

async function noLayout(page) {
  await page.evaluate(() => {
    const st = PC.sample.state(); st.plans = {}; st.stage = 1;
    PC.stages.MAX_BUILT = Math.max(PC.stages.MAX_BUILT, 3); PC.store.replace(st); PC.store.go(2); PC.store.go(3);
  });
  await page.waitForFunction(() => document.querySelectorAll('[data-pc="plan-tabs"] [role="tab"]').length >= 1, null, { timeout: 5000 });
  // every level "cannot be laid out", so the selected one shows the banner whichever it is
  await page.evaluate(() => PC.store.commit((st) => { for (const id in st.plans) st.plans[id].error = 'no-layout'; }, { nav: true }));
  await page.waitForFunction(() => !document.querySelector('[data-pc="plan-error"]').hidden, null, { timeout: 3000 });
  await settled(page);
}

const measure = (page) => page.evaluate(() => {
  const q = (h) => document.querySelector(`[data-pc="${h}"]`), R = (e) => e.getBoundingClientRect();
  const b = R(q('plan-error')), c = R(q('plan-canvas')), f = R(q('plan-fit')), btn = R(q('btn-goto-rooms')), txt = q('plan-error-text'), tr = R(txt);
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    canvasH: c.height, h: b.height, rel: { left: r1(b.left - c.left), top: r1(b.top - c.top), w: r1(b.width), h: r1(b.height), btn: [r1(btn.left - b.left), r1(btn.top - b.top), r1(btn.width), r1(btn.height)] },
    textClipped: txt.scrollWidth > txt.clientWidth + 0.5 || txt.scrollHeight > txt.clientHeight + 0.5 || tr.right > b.right + 0.5 || tr.bottom > b.bottom + 0.5,
    btn: { w: btn.width, h: btn.height, inside: btn.left >= b.left - 0.5 && btn.right <= b.right + 0.5 && btn.top >= b.top - 0.5 && btn.bottom <= b.bottom + 0.5 },
    fitHit: !(b.right <= f.left || f.right <= b.left || b.bottom <= f.top || f.bottom <= b.top),
    inCanvas: b.left >= c.left - 0.5 && b.right <= c.right + 0.5 && b.top >= c.top - 0.5 && b.bottom <= c.bottom + 0.5
  };
});

try {
  for (const vp of [...NARROW, VIEWPORTS[1], VIEWPORTS[2]]) {
    const { ctx, page, problems } = await open(browser, vp), at = vp.tag;
    await noLayout(page);
    const m = await measure(page);
    console.log(`  ${at}: banner ${m.h.toFixed(1)} of ${m.canvasH.toFixed(1)} px canvas, rel ${JSON.stringify(m.rel)}`);
    T.ok(!m.textClipped, `${at}: full banner text visible`);
    T.ok(m.btn.inside && m.btn.h >= 44 - 0.5, `${at}: "Go to room list" ${m.btn.w.toFixed(0)}x${m.btn.h.toFixed(0)} inside the banner`);
    T.ok(!m.fitHit, `${at}: banner clear of Fit view`);
    T.ok(m.inCanvas, `${at}: banner inside the canvas`);
    if (UNCHANGED[at]) {
      const u = UNCHANGED[at], same = (a, b) => Math.abs(a - b) <= 0.5;
      T.ok(same(m.rel.left, u.left) && same(m.rel.top, u.top) && same(m.rel.w, u.w) && same(m.rel.h, u.h) && m.rel.btn.every((v, i) => same(v, u.btn[i])), `${at}: banner layout unchanged (${JSON.stringify(m.rel)})`);
    } else T.ok(m.h <= m.canvasH / 2 + 0.5, `${at}: banner ${m.h.toFixed(1)} px is at most half the ${m.canvasH.toFixed(1)} px canvas`);
    T.none(await A.noPageScroll(page), `${at}: no page scroll`);
    T.none(problems(), `${at}: clean log`);
    await ctx.close();
  }
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
