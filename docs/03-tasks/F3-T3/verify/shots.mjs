// F3-T3 Designer verification (not part of run-all): screenshots of stage 4 (each Q18 style chosen; the Q19 vignettes
// follow it) and of the Q10 block, at 360x640, 640x360, 768x1024 and 1280x800, plus the legibility measurements.
// Usage: node build.mjs && node docs/03-tasks/F3-T3/verify/shots.mjs [outDir]   (default: verify/shots next to this file)
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, open, settled, VIEWPORTS, LANDSCAPE } from '../../../../tests/helpers/browser.mjs';

const OUT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(OUT, { recursive: true });
const VPS = [VIEWPORTS[0], LANDSCAPE, VIEWPORTS[1], VIEWPORTS[2]];
const browser = await launch();
try {
  for (const vp of VPS) {
    const { ctx, page, act, problems } = await open(browser, vp), at = vp.tag;
    await act('btn-sample');
    await page.evaluate(() => PC.store.go(2));
    await settled(page);
    if (await page.locator('[data-pc="q-tab-building"]').isVisible()) await act('q-tab-building');
    await settled(page);
    const q10 = page.locator('[data-q="10"]');
    await q10.scrollIntoViewIfNeeded();
    await q10.screenshot({ path: join(OUT, `${at}-q10.png`) });
    const sw = await page.evaluate(() => [...document.querySelectorAll('[data-pc="q-exterior"] .pc-swatch')].map((s) =>
      [...s.children].map((i) => Math.round(i.getBoundingClientRect().width * 10) / 10 + ' ' + getComputedStyle(i).backgroundColor).join(' | ')));
    await page.evaluate(() => PC.store.go(3));
    await page.waitForFunction(() => Object.keys(PC.debug.state().plans).length > 0, null, { timeout: 5000 });
    await page.evaluate(() => { PC.store.commit((s) => { for (const id in s.plans) s.plans[id].approved = true; }, { nav: true }); PC.store.go(4); });
    await page.waitForFunction(() => !document.querySelector('[data-stage="4"]').hidden, null, { timeout: 5000 });
    await settled(page);
    for (const st of ['modern', 'classic', 'minimal']) {
      const opt = page.locator(`[data-pc="q-interior-style"] label:has(> input[value="${st}"])`);
      await opt.scrollIntoViewIfNeeded();
      if (vp.touch) await opt.tap(); else await opt.click();
      await page.waitForFunction((v) => PC.debug.state().ans.interior.style === v, st, { timeout: 3000 });
      await settled(page);
      await page.locator('[data-stage="4"]').screenshot({ path: join(OUT, `${at}-stage4-${st}.png`) });
      await page.locator('[data-q="19"]').scrollIntoViewIfNeeded();
      await page.locator('[data-q="18"]').screenshot({ path: join(OUT, `${at}-q18-${st}.png`) });
      await page.locator('[data-q="19"]').screenshot({ path: join(OUT, `${at}-q19-${st}.png`) });
    }
    const m = await page.evaluate(() => {
      const st = document.querySelector('[data-stage="4"]');
      const mn = (sel) => { let w = Infinity, h = Infinity; for (const e of st.querySelectorAll(sel)) { const r = e.getBoundingClientRect(); w = Math.min(w, r.width); h = Math.min(h, r.height); } return [w, h].map((v) => Math.round(v * 10) / 10); };
      const hints = [...st.querySelectorAll('.pc-hint')].map((s) => { const r = s.getBoundingClientRect(), c = s.closest('.pc-card').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), inside: r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5 }; });
      const desc = [...st.querySelectorAll('.pc-card__desc')].map((d) => { const lh = parseFloat(getComputedStyle(d).lineHeight) || 16; return { t: d.textContent, lines: Math.round(d.getBoundingClientRect().height / lh) }; });
      const fill = (sel) => [...st.querySelectorAll(sel)].map((e) => getComputedStyle(e).fill);
      return { piece: mn('.h-piece'), chip: mn('.h-chip'), hints, desc, pieces: [...st.querySelectorAll('.pc-hint--density')].map((s) => s.querySelectorAll('.h-piece').length),
        chipFabric: fill('.pc-hint:not(.pc-hint--density) .h-chip.h-fabric'), q19Fabric: fill('.pc-hint--density .h-piece.h-fabric').slice(0, 1) };
    });
    console.log(`${at}: smallest piece ${m.piece.join(' x ')} px; smallest chip ${m.chip.join(' x ')} px; hints ${m.hints.map((h) => `${h.w}x${h.h}${h.inside ? '' : ' OUTSIDE'}`).join(', ')}`);
    console.log(`  Q19 pieces ${m.pieces.join(' / ')}; Q18 fabric chips ${m.chipFabric.join(', ')}; Q19 fabric (minimal chosen) ${m.q19Fabric}`);
    console.log(`  descriptions: ${m.desc.map((d) => `"${d.t}" ${d.lines} line(s)`).join('; ')}`);
    console.log(`  Q10 stripes (width colour): ${sw.join(' || ')}`);
    const p = problems(); if (p.length) console.log('  PROBLEMS', p);
    await ctx.close();
  }
} finally { await browser.close(); }
console.log('shots in ' + OUT);
