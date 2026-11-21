// F2-T3 Designer pre-step D (logged against F1-T1): layout of the edge tap-mode control, its hint, the legend mark
// and the Q6 edge list. Static markup only: the hint, the mark and 12 edge rows are forced visible by the test;
// behaviour (what a tap does, the switch texts and names) is the FS's, tested in edges.spec.
import { launch, open, suite, settled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e site-tapmode'), browser = await launch();
const VPS = [VIEWPORTS[0], { tag: '360x740', w: 360, h: 740, touch: true }, LANDSCAPE, VIEWPORTS[1], VIEWPORTS[2]];
const phone = (vp) => vp.w < 600 && vp.h > 480;

// Boxes in viewport coordinates; the compass box includes its "N" label (as q-preview.js avoids it).
const boxes = (page) => page.evaluate(() => {
  const q = (h) => document.querySelector(`[data-pc="${h}"]`);
  const R = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; };
  const shown = (e) => !!e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length > 0;
  const d = PC.debug.siteDial();
  const hint = q('site-tap-hint'), g = document.createRange(); g.selectNodeContents(hint);
  return {
    canvas: R(q('site-canvas')), preview: R(q('site-preview')), stage: R(document.querySelector('[data-stage="2"]')),
    mode: R(q('site-tap-mode')), modeShown: shown(q('site-tap-mode')),
    segs: [...q('site-tap-mode').querySelectorAll('.pc-seg__txt')].map(R),
    radios: [...q('site-tap-mode').querySelectorAll('input')].map((i) => ({ value: i.value, checked: i.checked, name: i.name })),
    compass: { left: d.x - d.r - 4, right: d.x + d.r + 4, top: d.y - d.r - 4, bottom: d.y + d.r + 22 },
    toggle: shown(q('site-preview-toggle')) ? R(q('site-preview-toggle')) : null,
    legend: shown(q('site-legend')) ? R(q('site-legend')) : null,
    legendItems: shown(q('site-legend')) ? [...q('site-legend').children].filter(shown).map(R) : [],
    hint: shown(hint) ? R(hint) : null, hintShown: shown(hint),
    hintLines: new Set([...g.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.bottom))).size,
    hintClipped: hint.scrollWidth > hint.clientWidth + 0.5,
    legendVisible: getComputedStyle(q('site-legend')).visibility !== 'hidden' && shown(q('site-legend')),
    markShown: shown(q('site-legend-mark'))
  };
});
const hit = (a, b) => !!a && !!b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
const inside = (a, b, e = 0.5) => a.left >= b.left - e && a.top >= b.top - e && a.right <= b.right + e && a.bottom <= b.bottom + e;
const ring = (page) => page.evaluate(() => {
  const el = document.activeElement, t = el.matches('.pc-opt > input') ? el.nextElementSibling : el, cs = getComputedStyle(t);
  return { pc: el.closest('[data-pc]')?.dataset.pc, value: el.value, ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 };
});
async function tabTo(page, test, max = 250) {
  for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(test)) return true; }
  return false;
}

try {
  for (const vp of VPS) {
    const { ctx, page, act, problems } = await open(browser, vp), at = vp.tag;
    await act('btn-sample'); await act('btn-next');
    await page.waitForFunction(() => document.querySelector('[data-pc="site-canvas"]').getBoundingClientRect().height > 0, null, { timeout: 3000 });
    await settled(page);

    // defaults
    let b = await boxes(page);
    T.eq(b.radios, [{ value: 'street', checked: true, name: 'site-tap-mode' }, { value: 'class', checked: false, name: 'site-tap-mode' }], `${at}: two radios, Street checked`);
    T.ok(!b.hintShown && !b.markShown, `${at}: hint and legend mark hidden by default`);
    T.ok(await page.evaluate(() => document.querySelector('[data-pc="q-edges"]').getClientRects().length === 0 && document.querySelector('[data-pc="q-edges-toggle"]').getAttribute('aria-expanded') === 'false'), `${at}: edge list collapsed by default`);

    // tap-mode control
    T.ok(b.modeShown && inside(b.mode, b.canvas), `${at}: tap mode inside the canvas`);
    T.ok(Math.abs(b.mode.left - b.canvas.left - 8) <= 0.5 && Math.abs(b.mode.top - b.canvas.top - 8) <= 0.5, `${at}: 8 px from the canvas top left (${(b.mode.left - b.canvas.left).toFixed(1)}, ${(b.mode.top - b.canvas.top).toFixed(1)})`);
    T.ok(b.mode.w <= 150, `${at}: control ${b.mode.w.toFixed(1)} px wide (<= 150)`);
    T.ok(b.segs.length === 2 && b.segs.every((s) => s.w >= 44 && s.h >= 44), `${at}: segments ${b.segs.map((s) => s.w.toFixed(0) + 'x' + s.h.toFixed(0)).join(', ')} (>= 44)`);
    T.ok(!hit(b.mode, b.compass), `${at}: clear of the compass`);
    T.ok(!hit(b.mode, b.toggle), `${at}: clear of the collapse toggle`);
    T.ok(!hit(b.mode, b.legend), `${at}: clear of the legend`);
    T.ok(inside(b.mode, b.stage) && b.mode.left - b.stage.left >= 8 - 0.5 && b.mode.top - b.stage.top >= 8 - 0.5, `${at}: clear of the stage edges`);

    if (vp.h <= 480) {
      // short landscape: no hint at all (TL F2-T3 inc 1, ruling 4); Back / side draws at the street-mode size
      const mode = (v) => page.locator(`[data-pc="site-tap-mode"] input[value="${v}"]`).check({ force: true });
      await mode('class');
      await page.waitForFunction(() => document.querySelector('[data-pc="site-tap-mode"] input[value="class"]').checked, null, { timeout: 3000 });
      await settled(page);
      const c = await page.evaluate(() => ({ boxes: document.querySelector('[data-pc="site-tap-hint"]').getClientRects().length, h: document.querySelector('[data-pc="site-canvas"]').getBoundingClientRect().height }));
      T.ok(c.boxes === 0, `${at}: Back / side mode, hint has no rendered box`);
      T.ok(Math.abs(c.h - 200) <= 0.5, `${at}: Back / side mode, canvas stays 200 px high (${c.h})`);
      await page.evaluate(() => { document.querySelector('[data-pc="site-tap-hint"]').hidden = false; });
      await settled(page);
      T.eq(await page.evaluate(() => document.querySelector('[data-pc="site-tap-hint"]').getClientRects().length), 0, `${at}: hint not rendered even without hidden`);
      await mode('street');
      await page.waitForFunction(() => document.querySelector('[data-pc="site-tap-mode"] input[value="street"]').checked, null, { timeout: 3000 });
    } else {
      // hint (mode "class") and legend mark, forced visible
      await page.evaluate(() => { document.querySelector('[data-pc="site-tap-hint"]').hidden = false; document.querySelector('[data-pc="site-legend-mark"]').hidden = false; });
      await settled(page);
      b = await boxes(page);
      T.ok(b.hintShown && !b.hintClipped, `${at}: hint shown in full`);
      if (vp.w === 360) T.eq(b.hintLines, 1, `${at}: hint on one line`);
      T.ok(inside(b.hint, b.preview), `${at}: hint inside the preview`);
      T.ok(!hit(b.hint, b.mode) && !hit(b.hint, b.compass) && !hit(b.hint, b.toggle), `${at}: hint clear of tap mode, compass and toggle`);
      T.ok(!b.legendVisible, `${at}: legend hidden while the hint shows`);
      if (phone(vp)) {
        T.ok(b.hint.top >= b.canvas.bottom - 0.5, `${at}: hint in the strip under the canvas (${b.hint.top.toFixed(1)} vs ${b.canvas.bottom.toFixed(1)})`);
        T.ok(!b.markShown, `${at}: no legend mark on phone portrait`);
      } else T.ok(inside(b.hint, b.canvas), `${at}: hint inside the canvas`);
    }
    await page.evaluate(() => { document.querySelector('[data-pc="site-tap-hint"]').hidden = true; });
    await settled(page);
    b = await boxes(page);
    if (b.legend) {
      T.ok(b.legendVisible, `${at}: legend back when the hint hides`);
      for (const r of b.legendItems) T.ok(inside(r, b.preview) && !hit(r, b.mode), `${at}: legend items inside the preview, clear of tap mode`);
      if (!phone(vp)) T.ok(b.markShown, `${at}: legend mark shown from 600 px`);
    }
    if (phone(vp)) T.ok(b.preview.h <= 201.5, `${at}: preview ${b.preview.h.toFixed(1)} px`);
    await page.evaluate(() => { document.querySelector('[data-pc="site-legend-mark"]').hidden = true; });

    // keyboard: both radios by Tab / arrows, with a visible ring
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    T.ok(await tabTo(page, () => document.activeElement?.name === 'site-tap-mode'), `${at}: Tab reaches the tap mode`);
    let f = await ring(page);
    T.ok(f.value === 'street' && f.ring, `${at}: Street focused with a ring`);
    await page.keyboard.press('ArrowRight');
    f = await ring(page);
    T.ok(f.value === 'class' && f.ring, `${at}: arrow moves to Back / side with a ring`);
    await page.keyboard.press('ArrowLeft');

    // the app's own list (sample, 5 edges): one street row, its switch hidden (FS choice accepted by the TL)
    const own = await page.evaluate(() => [...document.querySelectorAll('[data-pc="q-edges"] > li')].map((li) => ({
      cls: li.querySelector('[data-pc="edge-class"]').textContent, hidden: li.querySelector('[data-pc="edge-switch"]').hidden })));
    T.eq(own.length, 5, `${at}: the app lists the sample's 5 edges`);
    T.ok(own.filter((r) => /street/.test(r.cls)).length === 1 && own.every((r) => r.hidden === /street/.test(r.cls)), `${at}: only the street row's switch is hidden`);
    // edge list: 12 rows of the longest texts (one street row), forced open; the app's rows are removed first
    await page.evaluate(() => {
      const list = document.querySelector('[data-pc="q-edges"]'), tpl = document.querySelector('[data-pc="tpl-edge-row"]');
      list.replaceChildren();
      list.classList.remove('is-collapsed'); document.querySelector('[data-pc="q-edges-toggle"]').setAttribute('aria-expanded', 'true');
      for (let i = 1; i <= 12; i++) {
        const row = tpl.content.firstElementChild.cloneNode(true), $ = (h) => row.querySelector(`[data-pc="${h}"]`);
        $('edge-name').textContent = `Edge ${i} · ${i === 12 ? '1312.3' : '123.4'} ft`;
        $('edge-class').textContent = i === 1 ? 'front (street)' : i % 2 ? 'back (set by you)' : 'side';
        $('edge-switch').textContent = i % 2 ? 'Make side' : 'Make back';
        if (i === 1) $('edge-switch').hidden = true;
        list.append(row);
      }
    });
    await page.locator('[data-pc="q-edges-toggle"]').scrollIntoViewIfNeeded();
    await settled(page);
    const L = await page.evaluate(() => {
      const q = (h) => document.querySelector(`[data-pc="${h}"]`), t = q('q-edges-toggle').getBoundingClientRect();
      const rows = [...q('q-edges').children].map((li) => {
        const r = li.getBoundingClientRect(), s = li.querySelector('[data-pc="edge-switch"]'), sr = s.getBoundingClientRect(), n = li.querySelector('[data-pc="edge-name"]'), c = li.querySelector('[data-pc="edge-class"]');
        return { h: r.height, sw: s.hidden ? null : [sr.width, sr.height], clipped: n.scrollWidth > n.clientWidth + 0.5 || c.scrollWidth > c.clientWidth + 0.5, over: li.scrollWidth > li.clientWidth + 0.5 };
      });
      const sc = document.querySelector('[data-stage="2"] .pc-qs__scroll');
      return { toggleH: t.height, rows, sideScroll: sc.scrollWidth > sc.clientWidth + 0.5 };
    });
    T.ok(L.toggleH >= 44, `${at}: list toggle ${L.toggleH.toFixed(0)} px high`);
    T.eq(L.rows.length, 12, `${at}: 12 rows`);
    T.ok(L.rows.every((r) => r.h >= 44), `${at}: rows 44 px or more (${Math.min(...L.rows.map((r) => r.h)).toFixed(1)})`);
    T.ok(L.rows.every((r) => !r.sw || (r.sw[0] >= 44 && r.sw[1] >= 44)), `${at}: switches 44 px or more`);
    T.ok(L.rows[0].sw === null, `${at}: street row has no switch`);
    T.ok(L.rows.every((r) => !r.clipped && !r.over), `${at}: row texts shown in full, nothing overflows`);
    T.ok(!L.sideScroll, `${at}: no horizontal scroll in the questions`);
    T.none(await A.noPageScroll(page), `${at}: no page scroll`);
    // every switch by Tab, ring on the switch, row highlighted
    await page.locator('[data-pc="q-edges-toggle"]').focus();
    const seen = [];
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('Tab');
      seen.push(await page.evaluate(() => { const el = document.activeElement, cs = getComputedStyle(el), row = el.closest('.pc-edge');
        return { sw: el.dataset.pc === 'edge-switch', ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, row: !!row && getComputedStyle(row).backgroundColor !== 'rgba(0, 0, 0, 0)' }; }));
    }
    T.ok(seen.every((s) => s.sw), `${at}: Tab walks the 11 switches in order`);
    T.ok(seen.every((s) => s.ring && s.row), `${at}: each focused switch has a ring and highlights its row`);

    // collapsed preview hides the control (where the canvas collapses)
    if (b.toggle) {
      await act('site-preview-toggle');
      await page.waitForFunction(() => document.querySelector('[data-pc="site-preview"]').classList.contains('is-collapsed'), null, { timeout: 3000 });
      const c = await boxes(page);
      T.ok(!c.modeShown, `${at}: tap mode hidden with the canvas`);
    }
    T.none(problems(), `${at}: clean log`);
    await ctx.close();
  }
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
