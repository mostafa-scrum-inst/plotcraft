// F3-T2 Designer: stage 4 (Interior, Q18-Q19) layout with its controller, reached for real (all floors approved).
// Behaviour (state per choice) is the FS's; this checks the layout at every viewport.
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
