// F5-T1 room finder in the browser with the strict THREE mock (F5-S1; PM round 12 Q6 / Q7; TL ruling Q3 / Q4):
// run inside view3d.spec's existing page loads (no new browser file, TL ruling Q4). finderChecks(o, vp, T) expects the
// sample on stage 5 at the start; it leaves the selection cleared, the Roof off, level All and the View tab current.
//   phone (touch): select >= 44 px, optgroups in level order, 14 rooms; tap + pick: Roof off, the room's level, the
//     caption "Room · Level" (room name whole at 360 px, inside the viewport, clear of the panel), the flight lands;
//     another pick redirects; "All" clears; the look is untouched.
//   desktop (keyboard): ArrowDown on the focused select picks the next room; Reset view, Roof on and "Go to room…"
//     each clear; orbit keeps the selection.
import { settled } from './browser.mjs';

const landed = (page) => page.waitForFunction(() => { const i = PC.debug.scene(); return !PC.view3d.flying() && !i.frame && i.renders > 0; });
const st = (page) => page.evaluate(() => {
  const q = (h) => document.querySelector(`[data-pc="${h}"]`), i = PC.debug.scene(), sel = PC.view3d.selected(), p = PC.debug.cam();
  const f = sel && PC.cam.roomOf(PC.debug.house(), sel), h = PC.debug.house();
  const c = f ? [f.room.u + f.room.w / 2 - h.center[0], f.level.baseY + 0.7, -(f.room.v + f.room.d / 2 - h.center[1])] : null;
  return { value: q('v3-room').value, selected: sel, caption: q('v3-caption').hidden ? null : q('v3-caption-text').textContent,
    roofBox: q('v3-roof').checked, roof: i.roof, level: i.level, radio: (q('v3-level').querySelector('input:checked') || {}).value,
    highlight: !!i.world.getObjectByName('highlight'), off: c ? Math.max(...c.map((x, k) => Math.abs(x - p.target[k]))) : null, look: PC.view3d.look() };
});
const pane = async (o, name) => { if (await o.hook('v3-tab-' + name).isVisible()) { await o.act('v3-tab-' + name); await settled(o.page); } };

export async function finderChecks(o, vp, T) {
  const { page, hook, act } = o, tag = vp.tag + ' mock finder';
  try {
    await pane(o, 'tour');
    const m = await page.evaluate(() => {
      const s = document.querySelector('[data-pc="v3-room"]'), r = s.getBoundingClientRect();
      return { disabled: s.disabled, h: r.height, first: [s.options[0].value, s.options[0].textContent], groups: [...s.querySelectorAll('optgroup')].map((g) => [g.label, g.children.length]),
        n: s.querySelectorAll('optgroup option').length, names: [...s.querySelectorAll('optgroup option')].map((x) => x.textContent) };
    });
    T.ok(!m.disabled && m.h >= 44 - 0.5, `${tag} room select enabled, ${m.h.toFixed(1)} px high (>= 44)`);
    T.eq([m.first, m.groups, m.n], [['', 'Go to room…'], [['Ground floor', 7], ['First floor', 7]], 14], `${tag} "Go to room…" first, one optgroup per level, lowest first, 14 rooms`);
    T.eq(m.names.slice(0, 3), ['Living', 'Majlis', 'Dining'], `${tag} plan names`);
    const look0 = await page.evaluate(() => PC.view3d.look());
    if (vp.touch) {
      await page.evaluate(() => { const r = document.querySelector('[data-pc="v3-roof"]'); if (!r.checked) r.click(); });
      await hook('v3-room').tap(); await hook('v3-room').selectOption('r10'); await settled(page);
      let s = await st(page);
      T.eq([s.value, s.selected, s.caption, s.roofBox, s.roof, s.level, s.radio, s.highlight], ['r10', 'r10', 'Bedroom 2 · First floor', false, false, '1', '1', true], `${tag} tap + pick Bedroom 2: Roof off, level First checked, highlight, caption "Bedroom 2 · First floor"`);
      // mid-flight redirect to a longer name, then the flight lands on it
      await hook('v3-room').selectOption('r8'); await landed(page);
      s = await st(page);
      T.ok(s.caption === 'Master bedroom · First floor' && s.off < 0.01 && s.value === 'r8', `${tag} another pick redirects and lands (target off by ${s.off})`);
      const lay = await page.evaluate(() => {
        const q = (h) => document.querySelector(`[data-pc="${h}"]`), c = q('v3-caption').getBoundingClientRect(), p = q('v3-panel').getBoundingClientRect();
        const room = q('v3-caption-text').querySelector('.pc-caption__room');
        return { whole: room.scrollWidth <= room.clientWidth + 1, inside: c.left >= 0 && c.right <= innerWidth, clear: c.bottom <= p.top || c.top >= p.bottom, tall: c.height >= 44 - 0.5 };
      });
      T.eq(lay, { whole: true, inside: true, clear: true, tall: true }, `${tag} caption at ${vp.w} px: room name whole, inside the viewport, clear of the panel`);
      // "All" clears (TL ruling Q3)
      await pane(o, 'view');
      await page.locator('[data-pc="v3-level"] label:has(> input[value="all"])').tap(); await settled(page);
      s = await st(page);
      T.eq([s.value, s.selected, s.caption, s.highlight, s.level], ['', null, null, false, 'all'], `${tag} "All" clears the highlight, caption and select`);
    } else {
      await hook('v3-room').focus(); await page.keyboard.press('ArrowDown'); await settled(page);
      let s = await st(page);
      T.eq([s.value, s.caption, s.radio, s.roof], ['r1', 'Living · Ground floor', 'G', false], `${tag} keyboard: ArrowDown picks Living, caption "Living · Ground floor", level Ground`);
      T.ok(await page.evaluate(() => document.activeElement === document.querySelector('[data-pc="v3-room"]')), `${tag} focus stays on the select`);
      await page.keyboard.press('ArrowDown'); await landed(page);
      s = await st(page);
      T.ok(s.value === 'r2' && s.caption === 'Majlis · Ground floor' && s.off < 0.01, `${tag} ArrowDown again: Majlis, the flight lands (target off by ${s.off})`);
      // orbit keeps it; Reset view, Roof on and "Go to room…" each clear
      const box = await hook('v3-canvas').boundingBox();
      await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 3 + 60, box.y + box.height / 2, { steps: 3 }); await page.mouse.up(); await settled(page);
      T.eq((await st(page)).selected, 'r2', `${tag} an orbit keeps the selection`);
      const cleared = [];
      for (const [name, how] of [['Reset view', async () => act('v3-reset')], ['Roof on', async () => hook('v3-roof').click()], ['Go to room…', async () => hook('v3-room').selectOption('')]]) {
        await hook('v3-room').selectOption('r12'); await settled(page);
        await how(); await settled(page);
        s = await st(page);
        if (s.value !== '' || s.selected !== null || s.caption !== null || s.highlight) cleared.push(`${name}: ${JSON.stringify(s)}`);
        if (s.roofBox) await hook('v3-roof').click();
      }
      T.eq(cleared, [], `${tag} Reset view, Roof on and "Go to room…" each clear the selection`);
      await page.locator('[data-pc="v3-level"] label:has(> input[value="all"])').click(); await settled(page);
    }
    T.eq(await page.evaluate(() => PC.view3d.look()), look0, `${tag} the look is untouched`);
    await pane(o, 'view');
  } catch (e) { T.ok(false, `${tag} crashed: ` + (e && e.stack || e)); }
}
