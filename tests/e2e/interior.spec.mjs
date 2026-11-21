// F3-T2 Designer: stage 4 (Interior, Q18-Q19) layout with its controller, reached for real (all floors approved).
// Behaviour (state per choice) is the FS's; this checks the layout at every viewport, and (F3-T3) the hint visuals against PC.data.
import { launch, open, suite, settled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e interior'), browser = await launch();
const VPS = [VIEWPORTS[0], { tag: '360x740', w: 360, h: 740, touch: true }, LANDSCAPE, VIEWPORTS[1], VIEWPORTS[2]];

try {
  for (const vp of VPS) {
    const { ctx, page, act, problems } = await open(browser, vp), at = vp.tag;
    await act('btn-sample');
    await page.evaluate(() => { PC.store.go(2); PC.store.go(3); });
    await page.waitForFunction(() => Object.keys(PC.debug.state().plans).length > 0, null, { timeout: 5000 });
    await page.evaluate(() => { PC.store.commit((s) => { for (const id in s.plans) s.plans[id].approved = true; }, { nav: true }); PC.store.go(4); });
    await page.waitForFunction(() => !document.querySelector('[data-stage="4"]').hidden, null, { timeout: 5000 });
    await settled(page);
    const m = await page.evaluate(() => {
      const st = document.querySelector('[data-stage="4"]'), sr = st.getBoundingClientRect();
      const cards = [...st.querySelectorAll('.pc-card')].map((c) => { const r = c.getBoundingClientRect();
        return { w: r.width, h: r.height, over: c.scrollWidth > c.clientWidth + 0.5, inX: r.left >= sr.left - 0.5 && r.right <= sr.right + 0.5,
          text: [...c.querySelectorAll('.pc-card__name, .pc-card__desc')].every((t) => t.scrollWidth <= t.clientWidth + 0.5) }; });
      const checked = [...st.querySelectorAll('input:checked')].map((i) => i.value);
      const scroller = [...st.querySelectorAll('*')].concat(st).find((e) => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY));
      return { cards, checked, scrolls: !!scroller, sideScroll: st.scrollWidth > st.clientWidth + 0.5, banner: document.querySelectorAll('[data-pc="banner-slot"] > *').length };
    });
    T.eq(m.cards.length, 5, `${at}: three style cards and two density cards`);
    T.eq(m.checked, ['modern', 'full'], `${at}: sample answers checked (modern, full)`);
    T.ok(m.cards.every((c) => c.h >= 44 && c.w >= 44 && c.inX && !c.over && c.text), `${at}: cards 44 px or more, inside the stage, texts in full`);
    T.ok(!m.sideScroll, `${at}: no sideways scroll in the stage`);
    T.eq(m.banner, 0, `${at}: no static-preview banner (stage 4 has a controller)`);
    // F3-T3 hints: legible at every viewport (the 64 px hint of 640x360 is the small case); Q18 texts one line at 360 px
    const h = await page.evaluate(() => {
      const st = document.querySelector('[data-stage="4"]'), box = (e) => e.getBoundingClientRect();
      const min = (sel) => Math.min(...[...st.querySelectorAll(sel)].map((e) => Math.min(box(e).width, box(e).height)));
      const chips = [...st.querySelectorAll('.h-chip')].map(box);
      const inCard = [...st.querySelectorAll('.pc-hint')].every((s) => { const r = box(s), c = box(s.closest('.pc-card'));
        return r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5; });
      const lines = [...st.querySelectorAll('[data-pc="q-interior-style"] .pc-card__desc')].map((d) => box(d).height / parseFloat(getComputedStyle(d).lineHeight));
      return { piece: min('.h-piece'), chipW: Math.min(...chips.map((r) => r.width)), chipH: Math.min(...chips.map((r) => r.height)), inCard, lines };
    });
    T.ok(h.piece >= 3, `${at}: every furniture block in the hints 3 px or more (${h.piece.toFixed(1)})`);
    T.ok(h.chipW >= 10 && h.chipH >= 8, `${at}: swatch chips 10 x 8 px or more (${h.chipW.toFixed(1)} x ${h.chipH.toFixed(1)})`);
    T.ok(h.inCard, `${at}: every hint inside its card`);
    if (vp.w === 360) T.ok(h.lines.every((n) => n < 1.5), `${at}: Q18 descriptions on one line`);
    if (vp.w === 360 && vp.h === 640 || vp.w === 1280) {
      // the three style cards draw the PC.data.interiors colours (var() resolved end to end), so they differ visibly;
      // Q19 shows the living table's sparse / full counts and follows the chosen Q18 style (:has())
      const c = await page.evaluate(() => {
        const rgb = (x) => `rgb(${[1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)).join(', ')})`;
        const st = document.querySelector('[data-stage="4"]'), I = PC.data.interiors, keys = ['fabric', 'wood', 'accent', 'metal', 'dark'];
        const styles = Object.keys(I).map((s) => { const svg = st.querySelector('.pc-hint--' + s);
          return keys.every((k) => getComputedStyle(svg.querySelector('.h-chip.h-' + k)).fill === rgb(I[s][k])); });
        const dens = [...st.querySelectorAll('.pc-hint--density')].map((s) => s.querySelectorAll('.h-piece').length);
        const L = PC.data.furniture.living;
        return { styles, dens, want: [L.filter((p) => p.sparse).length, L.length], classic: rgb(I.classic.fabric), modern: rgb(I.modern.fabric) };
      });
      T.eq(c.styles, [true, true, true], `${at}: each style card's chips equal PC.data.interiors`);
      T.ok(c.classic !== c.modern, `${at}: style colours differ`);
      T.eq(c.dens, c.want, `${at}: Q19 vignettes show the living table's sparse and full piece counts`);
      const q19Fabric = () => page.evaluate(() => getComputedStyle(document.querySelector('.pc-hint--density .h-piece.h-fabric')).fill);
      T.eq(await q19Fabric(), c.modern, `${at}: Q19 vignettes in the Modern colours while Modern is chosen`);
      const classic = page.locator('[data-pc="q-interior-style"] label:has(> input[value="classic"])');
      if (vp.touch) await classic.tap(); else await classic.click();
      await page.waitForFunction(() => PC.debug.state().ans.interior.style === 'classic', null, { timeout: 3000 });
      T.eq(await q19Fabric(), c.classic, `${at}: choosing Classic recolours the Q19 vignettes`);
    }
    // the last card can be reached by scrolling the stage and chosen by touch / click; the page itself never scrolls
    const last = page.locator('[data-pc="q-interior-density"] .pc-opt').first();
    await last.scrollIntoViewIfNeeded();
    if (vp.touch) await last.tap(); else await last.click();
    await page.waitForFunction(() => PC.debug.state().ans.interior.density === 'sparse', null, { timeout: 3000 });
    const vis = await page.evaluate(() => { const r = document.querySelector('[data-pc="q-interior-density"] input:checked').closest('.pc-opt').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    T.ok(vis, `${at}: the chosen card is in view`);
    T.none(await A.noPageScroll(page), `${at}: no page scroll`);
    T.none(await A.barInViewport(page), `${at}: Back / Next in view`);
    T.none(await A.tapTargets(page), `${at}: tap targets`);
    T.none(problems(), `${at}: clean log`);
    await ctx.close();
  }
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
