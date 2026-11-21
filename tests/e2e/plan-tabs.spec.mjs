// F3-T1 Designer fix: the stage-3 level tabs fit with four real levels ("Basement" ... "Second floor") and every
// state ("Draft", "Approved", "Cannot be laid out") at every viewport: 44 px targets, nothing spills, no page scroll.
import { launch, open, suite, settled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e plan-tabs'), browser = await launch();
const VPS = [VIEWPORTS[0], { tag: '360x740', w: 360, h: 740, touch: true }, LANDSCAPE, VIEWPORTS[1], VIEWPORTS[2]];
const CASES = { mixed: { B: 'invalid', G: 'approved', 1: 'draft', 2: 'approved' }, 'all cannot': { B: 'invalid', G: 'invalid', 1: 'invalid', 2: 'invalid' } };
const WORD = { draft: 'Draft', approved: 'Approved', invalid: 'Cannot be laid out' };

// Sample with basement + 3 floors, every level holding rooms, opened on stage 3; then the wanted states.
async function stage3(page, states) {
  await page.evaluate(() => {
    const st = PC.sample.state(); st.ans.basement = true; st.ans.floors = 3;
    let id = st.ans.nextRoomId;
    for (const l of ['B', 'G', '1', '2']) if (!st.ans.rooms.some((r) => r.level === l)) for (const t of ['storage', 'laundry']) st.ans.rooms.push({ id: 'r' + (id++), type: t, level: l, size: 'S', area: null, master: false });
    st.ans.nextRoomId = id; st.plans = {}; st.stage = 1;
    PC.stages.MAX_BUILT = Math.max(PC.stages.MAX_BUILT, 3); PC.store.replace(st); PC.store.go(2); PC.store.go(3);
  });
  await page.waitForFunction(() => document.querySelectorAll('[data-pc="plan-tabs"] [role="tab"]').length === 4, null, { timeout: 5000 });
  await page.evaluate((states) => PC.store.commit((st) => { for (const [l, k] of Object.entries(states)) { const p = st.plans[l]; if (p) { p.approved = k === 'approved'; if (k === 'invalid') p.error = 'no-layout'; } } }, { nav: true }), states);
  await page.waitForFunction((n) => document.querySelectorAll('[data-pc="plan-tabs"] .is-invalid').length === n, Object.values(states).filter((k) => k === 'invalid').length, { timeout: 3000 });
  await settled(page);
}

const measure = (page) => page.evaluate(() => {
  const R = (e) => e.getBoundingClientRect(), list = document.querySelector('[data-pc="plan-tabs"]'), lr = R(list);
  const lines = (el) => { const g = document.createRange(); g.selectNodeContents(el); return new Set([...g.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.bottom))).size; };
  const tabs = [...list.querySelectorAll('[role="tab"]')].map((t) => {
    const r = R(t), name = t.querySelector('[data-pc="tab-name"]'), word = t.querySelector('[data-pc="tab-state"]'), st = word.parentElement;
    const icon = [...st.querySelectorAll('svg')].find((s) => getComputedStyle(s).display !== 'none');
    const inside = (e) => { const b = R(e); return b.left >= r.left - 0.5 && b.right <= r.right + 0.5 && b.top >= r.top - 0.5 && b.bottom <= r.bottom + 0.5; };
    const wr = R(word);
    return {
      name: name.textContent, word: word.textContent, w: r.width, h: r.height, left: r.left, right: r.right,
      nameIn: inside(name), stateIn: inside(st), nameLines: lines(name), icon: !!icon && R(icon).width > 0,
      wordShown: wr.width > 1, wordIn: wr.width <= 1 || inside(word), wordLines: wr.width > 1 ? lines(word) : 0,
      overflow: t.scrollWidth > t.clientWidth + 0.5, label: t.textContent.replace(/\s+/g, ' ').trim()
    };
  });
  const stage = R(document.querySelector('[data-stage="3"]'));
  return { tabs, list: { left: lr.left, right: lr.right, over: list.scrollWidth > list.clientWidth + 0.5 }, stage: { left: stage.left, right: stage.right }, vw: innerWidth };
});

try {
  for (const vp of VPS) for (const [cname, states] of Object.entries(CASES)) {
    const { ctx, page, problems } = await open(browser, vp), at = `${vp.tag} ${cname}`;
    await stage3(page, states);
    const m = await measure(page);
    T.eq(m.tabs.map((t) => t.name), ['Basement', 'Ground floor', 'First floor', 'Second floor'], `${at}: four real level tabs`);
    T.eq(m.tabs.map((t) => t.word), ['B', 'G', '1', '2'].map((l) => WORD[states[l]]), `${at}: state words`);
    m.tabs.forEach((t, i) => {
      const n = `${at} "${t.name}"`;
      T.ok(t.w >= 44 && t.h >= 44, `${n}: target ${t.w.toFixed(0)}x${t.h.toFixed(0)}`);
      T.ok(t.left >= m.list.left - 0.5 && t.right <= m.list.right + 0.5, `${n}: inside the tab strip`);
      if (i) T.ok(t.left >= m.tabs[i - 1].right - 0.5, `${n}: no overlap with the previous tab`);
      T.ok(t.nameIn && t.stateIn && t.wordIn && !t.overflow, `${n}: name and state inside the tab, nothing spills`);
      T.ok(t.nameLines <= 2, `${n}: name on ${t.nameLines} line(s), wrapped at spaces only`);
      T.ok(t.icon, `${n}: state icon shown`);
      T.ok(t.label.includes(t.word), `${n}: the state word is part of the tab's text`);
      if (vp.w >= 720 && vp.h > 480) T.ok(t.wordShown && t.wordLines <= 2, `${n}: state word shown from 720 px (${t.wordLines} line(s))`);
    });
    T.ok(!m.list.over, `${at}: tab strip does not scroll sideways`);
    T.ok(m.stage.left >= -0.5 && m.stage.right <= m.vw + 0.5, `${at}: stage not pushed sideways (${m.stage.left.toFixed(1)}..${m.stage.right.toFixed(1)})`);
    T.none(await A.noPageScroll(page), `${at}: no page scroll`);
    T.none(await A.tapTargets(page), `${at}: tap targets`);
    T.none(problems(), `${at}: clean log`);
    await ctx.close();
  }
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
