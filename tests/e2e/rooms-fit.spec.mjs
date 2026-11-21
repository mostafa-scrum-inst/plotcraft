// F2-T3 Designer fix (QA F2-T3 bug 1): every room row shows its full name and area, with the longest realistic
// content ("Master bedroom" at 80 m2 = 861 sq ft, "Maid's room 2"), at every viewport, in m and ft.
import { launch, open, suite, settled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e rooms-fit'), browser = await launch();
const VPS = [VIEWPORTS[0], { tag: '360x740', w: 360, h: 740, touch: true }, LANDSCAPE, VIEWPORTS[1], VIEWPORTS[2]];
// First floor of the sample replaced by the widest rows: exact-area master bedroom, numbered maid's rooms, L sizes.
const FIRST = [
  { type: 'bedroom', size: null, area: 80, master: true }, { type: 'maid', size: 'L' }, { type: 'maid', size: 'L' },
  { type: 'laundry', size: 'L' }, { type: 'storage', size: 'L' }, { type: 'bathroom', size: null, area: 79.5 }, { type: 'bedroom', size: 'L' }
];

const measure = (page) => page.evaluate(() => {
  const R = (e) => e.getBoundingClientRect();
  const hit = (a, b) => !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
  const lines = (el) => { const g = document.createRange(); g.selectNodeContents(el); return new Set([...g.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.bottom))).size; };
  return [...document.querySelectorAll('[data-pc="room-list"] .pc-room')].filter((li) => li.getClientRects().length).map((li) => {
    const $ = (h) => li.querySelector(`[data-pc="${h}"]`), name = $('room-name'), area = $('room-area-hint'), head = name.parentElement;
    const parts = [name, area, $('room-master').closest('label'), $('room-delete')].filter((e) => e.getClientRects().length);
    const overlap = parts.some((a, i) => parts.slice(i + 1).some((b) => hit(R(a), R(b))));
    const hr = R(head);
    return {
      name: name.textContent, area: area.textContent, nameLines: lines(name), areaLines: lines(area),
      clipped: name.scrollWidth > name.clientWidth + 0.5 || area.scrollWidth > area.clientWidth + 0.5,
      outside: parts.some((e) => { const r = R(e); return r.left < hr.left - 0.5 || r.right > hr.right + 0.5; }),
      overlap, headH: hr.height, over: li.scrollWidth > li.clientWidth + 0.5
    };
  });
});

try {
  for (const vp of VPS) for (const unit of ['m', 'ft']) {
    const { ctx, page, act, problems } = await open(browser, vp), at = `${vp.tag} ${unit}`;
    await act('btn-sample');
    await page.evaluate(([first, u]) => PC.store.commit((s) => {
      let n = s.ans.nextRoomId;
      s.ans.rooms = s.ans.rooms.filter((r) => r.level !== '1').concat(first.map((r) => ({ id: 'r' + n++, level: '1', area: null, master: false, ...r })));
      s.ans.nextRoomId = n; s.ans.pairs = s.ans.pairs.filter((p) => s.ans.rooms.some((r) => r.id === p[0]) && s.ans.rooms.some((r) => r.id === p[1]));
      s.ans.unit = u;
    }), [FIRST, unit]);
    await act('btn-next');
    await act('q-tab-rooms');
    await page.waitForFunction(() => document.querySelectorAll('[data-pc="room-list"] .pc-room').length >= 14, null, { timeout: 3000 });
    await settled(page);
    const rows = await measure(page), sfx = unit === 'ft' ? 'sq ft' : 'm²';
    T.ok(rows.length >= 14, `${at}: ${rows.length} room rows`);
    T.ok(rows.some((r) => r.name === 'Master bedroom' && r.area === (unit === 'ft' ? '861 sq ft' : '80 m²')), `${at}: master bedroom row with its exact area (${JSON.stringify(rows.find((r) => /Master/.test(r.name)))})`);
    T.ok(rows.some((r) => r.name === "Maid's room 2"), `${at}: numbered maid's room present`);
    T.ok(rows.every((r) => r.area.endsWith(sfx)), `${at}: areas in ${unit}`);
    for (const r of rows) {
      T.ok(!r.clipped && r.nameLines === 1 && r.areaLines === 1, `${at}: "${r.name}" / "${r.area}" shown in full on one line each (lines ${r.nameLines}/${r.areaLines})`);
      T.ok(!r.outside && !r.overlap && !r.over, `${at}: "${r.name}" row parts inside the row, no overlap`);
      T.ok(r.headH <= 44.5, `${at}: "${r.name}" head ${r.headH.toFixed(1)} px (no taller than its 44 px buttons)`);
    }
    T.none(await A.noPageScroll(page), `${at}: no page scroll`);
    T.none(await A.tapTargets(page), `${at}: tap targets`);
    T.none(problems(), `${at}: clean log`);
    await ctx.close();
  }
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
