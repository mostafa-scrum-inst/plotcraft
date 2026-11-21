// F4-T1 stage 5 with the strict THREE mock (A-16): Skip to 3D in 2 taps (G1), canvas fills its area and follows
// resize / rotation, touch orbit / pinch / pan without page scroll or zoom, mouse / wheel / keys, Reset view, level
// selector labels (PM round 9) and visibility, disabled later-task controls (TL ruling 3), collapsible panel,
// no frames after leaving or while hidden, pose kept on return; and the three.js-unavailable path (request aborted).
import { launch, open, suite, settled, VIEWPORTS } from '../helpers/browser.mjs';
import { gestures } from '../helpers/touch.mjs';
import { loadCore } from '../helpers/load.mjs';
import { maxHouse } from '../helpers/houses.mjs';

const T = suite('e2e view3d'), browser = await launch();
// Counts the app's animation-frame requests. The tests below never call requestAnimationFrame themselves while
// they measure: they wait with a fixed 300 ms, because "nothing is requested" has no state to poll (A-16 exception).
const countRaf = () => { const o = window.requestAnimationFrame.bind(window); window.__raf = 0; window.requestAnimationFrame = (cb) => { window.__raf++; return o(cb); }; };
const quiet = (page) => page.waitForTimeout(300);
const ready = (page) => page.waitForFunction(() => { const i = PC.debug.scene(); return i.renders > 0 && !i.frame && !i.building; });
const info = (page) => page.evaluate(() => { const i = PC.debug.scene(); return { renders: i.renders, builds: i.builds, size: i.size, active: i.active, frame: i.frame, aspect: i.camera.aspect }; });
const cam = (page) => page.evaluate(() => PC.debug.cam());
const scroll = (page) => page.evaluate(() => [window.scrollX, window.scrollY, document.scrollingElement.scrollTop, window.visualViewport ? window.visualViewport.scale : 1]);
const DISABLED = ['v3-room', 'v3-tour-start', 'v3-tour-pause', 'v3-tour-stop'];   // F5 (room finder, tour)
const ENABLED = ['v3-reset', 'v3-panel-toggle', 'v3-tab-view', 'v3-tab-light', 'v3-tab-tour', 'v3-roof',   // Roof enabled since F4-T2
  'v3-time', 'v3-preset-morning', 'v3-preset-noon', 'v3-preset-evening', 'v3-preset-night', 'v3-season'];   // Light tab since F4-T3

async function phone() {
  const vp = VIEWPORTS[0], tag = vp.tag + ' mock', o = await open(browser, vp, { three: 'mock', init: countRaf }), { page, act, hook, problems } = o;
  const G = await gestures(page, true);
  // G1 / F1-S5: Load sample + Skip to 3D = 2 taps to a live 3D view
  await act('btn-sample'); await act('btn-skip3d');
  await ready(page);
  const s = await page.evaluate(() => PC.store.get());
  T.eq([s.stage, Object.values(s.plans).every((p) => p.approved)], [5, true], `${tag} 2 taps: stage 5, every level approved`);
  T.eq(await page.evaluate(() => ['v3-building', 'v3-unavailable', 'v3-canvas', 'v3-panel'].map((h) => document.querySelector(`[data-pc="${h}"]`).hidden)), [true, true, false, false], `${tag} Building gone, unavailable hidden, canvas + panel shown`);
  T.eq(await page.evaluate(() => document.querySelectorAll('[data-pc="banner-slot"] > *').length), 0, `${tag} no "not built yet" banner`);
  // canvas fills its area; renderer size = canvas client size
  const fill = await page.evaluate(() => {
    const c = document.querySelector('[data-pc="v3-canvas"]'), w = c.parentElement.getBoundingClientRect(), r = c.getBoundingClientRect(), R = window.__threeMock.raw(PC.debug.scene().renderer);
    return { same: ['left', 'top', 'width', 'height'].every((k) => Math.abs(w[k] - r[k]) < 0.5), size: R.size, client: [c.clientWidth, c.clientHeight] };
  });
  T.ok(fill.same, `${tag} canvas rectangle = its wrap`);
  T.eq(fill.size, [...fill.client, false], `${tag} setSize(clientWidth, clientHeight, false)`);
  // controls: later tasks disabled, these enabled
  T.eq(await page.evaluate((L) => L.map((h) => document.querySelector(`[data-pc="${h}"]`).disabled), DISABLED), DISABLED.map(() => true), `${tag} later-task controls disabled (room, tour; F5)`);
  T.ok(await page.evaluate(() => [...document.querySelectorAll('[data-pc="v3-tour-speed"] input')].every((i) => i.disabled)), `${tag} tour speed disabled`);
  T.eq(await page.evaluate((L) => L.map((h) => document.querySelector(`[data-pc="${h}"]`).disabled), ENABLED), ENABLED.map(() => false), `${tag} Reset, panel toggle, tabs, Roof (F4-T2) and the Light tab (F4-T3) enabled`);
  // Designer (TL F4-T1 condition 1): the disabled controls look disabled (muted set of .pc-btn:disabled: sunk / ink-3)
  T.eq(await page.evaluate(() => {
    const q = (h) => document.querySelector(`[data-pc="${h}"]`), cs = (e, p) => getComputedStyle(e, p), root = cs(document.documentElement);
    const v = (n) => { const d = document.createElement('i'); d.style.color = root.getPropertyValue(n); document.body.append(d); const c = cs(d).color; d.remove(); return c; };
    const sunk = v('--sunk'), ink3 = v('--ink-3');
    // F4-T3 (Designer plan 3): the check moves to the controls that stay disabled; the live Light controls are not muted
    return [cs(q('v3-room')).backgroundColor === sunk && cs(q('v3-room')).color === ink3, cs(q('v3-tour-start')).cursor,
      cs(q('v3-time')).cursor, cs(q('v3-time-out')).color === ink3, cs(q('v3-season')).backgroundColor === sunk, cs(q('v3-preset-noon').querySelector('.pc-i')).opacity];
  }), [true, 'not-allowed', 'pointer', false, false, '1'], `${tag} room finder and tour drawn muted; slider, season and presets live`);   // thumb / track: pseudo-elements, see designer-fix.md shots
  // level selector: PM round 9 labels, aria-labels, no overflow
  const lv = await page.evaluate(() => [...document.querySelectorAll('[data-pc="v3-level"] label')].map((l) => { const i = l.querySelector('input'), t = l.querySelector('.pc-seg__txt'); return [t.textContent, i.getAttribute('aria-label'), i.value, i.checked, i.disabled, t.scrollWidth <= t.clientWidth + 1]; }));
  T.eq(lv, [['All', 'All floors', 'all', true, false, true], ['Ground', 'Ground floor', 'G', false, false, true], ['First', 'First floor', '1', false, false, true]], `${tag} level labels, All selected on open, no overflow`);
  // one-finger orbit, page does not scroll or zoom
  const box = await hook('v3-canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 3;
  let p0 = await cam(page);
  await G.drag([cx - 60, cy], [cx + 60, cy + 30]);
  let p1 = await cam(page);
  T.ok(p1.theta !== p0.theta && p1.radius === p0.radius, `${tag} one finger orbits`);
  T.eq(await scroll(page), [0, 0, 0, 1], `${tag} one-finger drag: no page scroll or zoom`);
  await G.two([cx - 30, cy], [cx + 30, cy], [cx - 90, cy], [cx + 90, cy]);
  const p2 = await cam(page);
  T.ok(p2.radius < p1.radius, `${tag} two-finger spread zooms in`);
  T.eq(await scroll(page), [0, 0, 0, 1], `${tag} pinch: page scale stays 1`);
  await G.two([cx - 40, cy], [cx + 40, cy], [cx - 40, cy + 60], [cx + 40, cy + 60]);
  const p3 = await cam(page);
  T.ok(JSON.stringify(p3.target) !== JSON.stringify(p2.target), `${tag} two-finger drag pans`);
  // panel: at most about a third of the canvas; collapses
  const pr = await page.evaluate(() => { const p = document.querySelector('[data-pc="v3-panel"]').getBoundingClientRect(), c = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect(); return Math.max(0, Math.min(p.bottom, c.bottom) - Math.max(p.top, c.top)) / c.height; });
  T.ok(pr <= 0.34, `${tag} expanded panel covers ${(pr * 100).toFixed(0)} % of the canvas (<= about a third)`);
  await act('v3-panel-toggle');
  T.eq(await page.evaluate(() => [document.querySelector('[data-pc="v3-panel-toggle"]').getAttribute('aria-expanded'), getComputedStyle(document.querySelector('.pc-v3panel__body')).display]), ['false', 'none'], `${tag} panel collapses`);
  await act('v3-panel-toggle');
  // level selector -> visibility
  await page.locator('[data-pc="v3-level"] label:has(> input[value="G"])').tap();
  await ready(page);
  T.eq(await page.evaluate(() => { const w = PC.debug.scene().world; return [w.getObjectByName('level-G').visible, w.getObjectByName('level-1').visible]; }), [true, false], `${tag} Ground hides the First floor`);
  T.eq(await page.evaluate(() => { const w = PC.debug.scene().world, f = w.getObjectByName('level-1').children.find((c) => c.name === 'furniture'); return [!!f, f && f.parent.visible]; }), [true, false], `${tag} ...and its furniture with it (F4-T2)`);
  // F4-T2: the Roof switch by touch (shown only with All: a single level hides it)
  const roofOn = () => page.evaluate(() => [document.querySelector('[data-pc="v3-roof"]').checked, PC.debug.scene().roof, PC.debug.scene().world.getObjectByName('roof').visible]);
  await page.locator('.pc-switch:has([data-pc="v3-roof"])').tap(); await ready(page);
  T.eq(await roofOn(), [true, true, false], `${tag} Roof on with Ground selected: switch on, roof still hidden`);
  await page.locator('[data-pc="v3-level"] label:has(> input[value="all"])').tap();
  await ready(page);
  T.eq(await roofOn(), [true, true, true], `${tag} Roof on + All: the roof is shown`);
  await page.locator('.pc-switch:has([data-pc="v3-roof"])').tap(); await ready(page);
  T.eq(await roofOn(), [false, false, false], `${tag} tap again: Roof off`);
  // leaving stops frames; returning keeps the pose
  const pose = await cam(page);
  await act('btn-back'); await settled(page);
  const before = await info(page);
  await page.evaluate(() => { window.__raf = 0; });
  await quiet(page);
  T.eq([await page.evaluate(() => window.__raf), (await info(page)).renders, before.active], [0, before.renders, false], `${tag} stage 4: no frames requested, nothing rendered`);
  await act('btn-next'); await ready(page);
  T.eq(await cam(page), pose, `${tag} back on stage 5: same camera pose`);
  T.eq((await info(page)).builds, 1, `${tag} same house: no rebuild`);
  // hidden tab: no frames even with input; visible again: one frame
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); window.__raf = 0; });
  await hook('v3-canvas').focus(); await page.keyboard.press('ArrowLeft');
  await quiet(page);
  const hid = await info(page);
  T.eq(await page.evaluate(() => window.__raf), 0, `${tag} hidden: no animation frames requested`);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await ready(page);
  T.eq((await info(page)).renders, hid.renders + 1, `${tag} visible again: exactly one frame`);
  // rotation: the renderer follows the canvas and keeps the aspect
  await page.setViewportSize({ width: 640, height: 360 });
  await page.waitForFunction(() => { const c = document.querySelector('[data-pc="v3-canvas"]'), i = PC.debug.scene(); return i.size[0] === c.clientWidth && i.size[1] === c.clientHeight && !i.frame; });
  const rot = await info(page);
  T.ok(Math.abs(rot.aspect - rot.size[0] / rot.size[1]) < 1e-9 && rot.size[0] > rot.size[1], `${tag} 640x360: aspect ${rot.aspect.toFixed(3)} follows the canvas`);
  T.none(problems(), `${tag} no errors`);
  await o.ctx.close();
}

async function desktop() {
  const vp = VIEWPORTS[2], tag = vp.tag + ' mock', o = await open(browser, vp, { three: 'mock' }), { page, act, hook, problems } = o;
  await act('btn-sample'); await act('btn-skip3d'); await ready(page);
  const box = await hook('v3-canvas').boundingBox(), cx = box.x + box.width / 3, cy = box.y + box.height / 2, M = page.mouse;
  const drag = async (dx, dy, o2 = {}) => { await M.move(cx, cy); await M.down(o2); for (let i = 1; i <= 6; i++) await M.move(cx + dx * i / 6, cy + dy * i / 6); await M.up(o2); await ready(page); };
  let p0 = await cam(page);
  await drag(80, 0);
  let p = await cam(page);
  T.ok(p.theta < p0.theta && JSON.stringify(p.target) === JSON.stringify(p0.target), `${tag} left drag orbits`);
  p0 = p; await drag(80, 0, { button: 'right' }); p = await cam(page);
  T.ok(JSON.stringify(p.target) !== JSON.stringify(p0.target) && p.theta === p0.theta && p.radius === p0.radius, `${tag} right drag pans`);
  T.ok(await page.evaluate(() => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.querySelector('[data-pc="v3-canvas"]').dispatchEvent(e); return e.defaultPrevented; }), `${tag} context menu suppressed on the canvas`);
  p0 = p; await page.keyboard.down('Shift'); await drag(0, 60); await page.keyboard.up('Shift'); p = await cam(page);
  T.ok(JSON.stringify(p.target) !== JSON.stringify(p0.target) && p.theta === p0.theta, `${tag} Shift+drag pans`);
  p0 = p; await M.move(cx, cy); await M.wheel(0, 300); await ready(page); p = await cam(page);
  T.ok(p.radius > p0.radius, `${tag} wheel zooms out`);
  T.eq(await scroll(page), [0, 0, 0, 1], `${tag} wheel on the canvas does not scroll the page`);
  await hook('v3-canvas').focus();
  p0 = await cam(page); await page.keyboard.press('ArrowRight'); await ready(page); p = await cam(page);
  T.ok(p.theta > p0.theta, `${tag} ArrowRight orbits`);
  p0 = p; await page.keyboard.press('ArrowUp'); await ready(page); p = await cam(page);
  T.ok(p.phi < p0.phi, `${tag} ArrowUp orbits up`);
  p0 = p; await page.keyboard.press('+'); await ready(page); p = await cam(page);
  T.ok(p.radius < p0.radius, `${tag} + zooms in`);
  p0 = p; await page.keyboard.press('-'); await ready(page); p = await cam(page);
  T.ok(p.radius > p0.radius, `${tag} - zooms out`);
  T.eq(await scroll(page), [0, 0, 0, 1], `${tag} arrow keys on the canvas do not scroll the page`);
  await act('v3-reset'); await ready(page);
  const rs = await page.evaluate(() => { const i = PC.debug.scene(); return [PC.debug.cam(), PC.cam.reset(PC.debug.house(), i.size[0] / i.size[1])]; });
  T.eq(rs[0], rs[1], `${tag} Reset view = the reset pose for this canvas`);
  // F4-T2: the Roof switch by keyboard (Space toggles the focused switch)
  await hook('v3-roof').focus(); await page.keyboard.press('Space'); await ready(page);
  T.eq(await page.evaluate(() => [document.querySelector('[data-pc="v3-roof"]').checked, PC.debug.scene().world.getObjectByName('roof').visible]), [true, true], `${tag} Space on Roof: roof shown`);
  await page.keyboard.press('Space'); await ready(page);
  T.eq(await page.evaluate(() => PC.debug.scene().world.getObjectByName('roof').visible), false, `${tag} Space again: hidden`);
  // F3-S4 last criterion: Q19 on stage 4 -> stage 5 rebuilds with fewer pieces; approvals kept
  const pieces = () => page.evaluate(() => PC.debug.house().levels.reduce((n, l) => n + l.rooms.reduce((m, r) => m + r.furniture.length, 0), 0));
  const n0 = await pieces(), b0 = (await info(page)).builds;
  await act('btn-back'); await settled(page);
  await page.locator('[data-pc="q-interior-density"] label:has(> input[value="sparse"])').click(); await settled(page);
  await act('btn-next'); await ready(page);
  const after = await page.evaluate(() => { const s = PC.store.get(); return [s.stage, Object.values(s.plans).filter((p) => p.approved).length, Object.keys(s.plans).length]; });
  T.eq(after, [5, 2, 2], `${tag} Q19 Sparse: back on stage 5, approvals still 2 of 2`);
  T.ok((await info(page)).builds === b0 + 1 && (await pieces()) < n0, `${tag} ...rebuilt once with fewer pieces (${await pieces()} < ${n0})`);
  T.none(problems(), `${tag} no errors`);
  await o.ctx.close();
}

async function unavailable() {
  const vp = VIEWPORTS[0], tag = vp.tag + ' abort', o = await open(browser, vp), { page, act, problems } = o;
  await act('btn-sample'); await act('btn-skip3d');
  await page.waitForFunction(() => !document.querySelector('[data-pc="v3-unavailable"]').hidden);
  T.eq(await page.evaluate(() => ['v3-unavailable', 'v3-panel', 'v3-canvas', 'v3-building'].map((h) => document.querySelector(`[data-pc="${h}"]`).hidden)), [false, true, true, true], `${tag} three.js missing: in-page message, no panel, no canvas`);
  await act('btn-back'); await settled(page);
  T.eq(await page.evaluate(() => [PC.store.get().stage, document.querySelector('[data-stage="4"]').hidden]), [4, false], `${tag} Back: stage 4 works`);
  await act('step-3'); await settled(page);
  T.eq(await page.evaluate(() => [PC.store.get().stage, document.querySelector('[data-stage="3"]').hidden]), [3, false], `${tag} stage 3 works`);
  T.none(problems(), `${tag} no errors except the aborted three.js request`);
  await o.ctx.close();
}

// PM round 9 fallback rule: the full words stay unless the 5 options (max house: All + B, G, 1, 2) overflow at 360 px.
async function fiveLevels() {
  const vp = VIEWPORTS[0], tag = vp.tag + ' max house', o = await open(browser, vp, { three: 'mock' }), { page, problems } = o;
  const st = maxHouse(loadCore());
  await page.evaluate((st) => PC.store.replace(st), st);
  await ready(page);
  const r = await page.evaluate(() => {
    const g = document.querySelector('[data-pc="v3-level"]'), labs = Array.from(g.querySelectorAll('label'));
    const gb = g.getBoundingClientRect();
    return {
      text: labs.map((l) => l.textContent.trim()), aria: labs.map((l) => l.querySelector('input').getAttribute('aria-label')),
      clipped: labs.filter((l) => l.scrollWidth > l.clientWidth + 1 || l.getBoundingClientRect().right > gb.right + 0.5 || l.getBoundingClientRect().left < gb.left - 0.5).length,
      page: document.scrollingElement.scrollWidth <= window.innerWidth
    };
  });
  T.eq(r.text, ['All', 'Basement', 'Ground', 'First', 'Second'], `${tag} five options, full PM round 9 words`);
  T.eq(r.aria, ['All floors', 'Basement', 'Ground floor', 'First floor', 'Second floor'], `${tag} aria-labels`);
  T.eq([r.clipped, r.page], [0, true], `${tag} 5 options fit at 360 px (no fallback needed), no horizontal page scroll`);
  T.none(problems(), `${tag} no page errors`);
  await o.ctx.close();
}

try {
  await Promise.all([phone(), desktop(), unavailable(), fiveLevels()]);
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
