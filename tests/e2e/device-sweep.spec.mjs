// F5-T3a Designer device sweep (plan §4, TL rulings 1 and 3): every stage x {sample, empty} at 360x640 and 1280x800,
// plus 640x360 and 768x1024 with QA_FULL=1, three.js mock. Layout only: no page scroll or sideways overflow, no clipped
// text, 44 px targets, WCAG AA text contrast, a visible keyboard focus ring, Back / Next in view. Stage 5 adds: the
// expanded panel covers none of the canvas at 640x360 (side by side, TL ruling 1), Reset frames the whole plot in the
// canvas left to it (368 px at 640x360), and the tour caption never meets the panel or its toggle (seeked tour).
// The F3-T3 stage-4 interior checks (was interior.spec.mjs) are folded in under their names (TL ruling 3): 360x640 and
// 1280x800 by default, 360x740, 640x360 and 768x1024 with QA_FULL=1.
import { launch, open, suite, settled, VIEWPORTS, LANDSCAPE } from '../helpers/browser.mjs';
import * as A from '../helpers/assertions.mjs';

const T = suite('e2e device-sweep'), browser = await launch();
const FULL = !!process.env.QA_FULL;
const SWEEP = FULL ? [VIEWPORTS[0], LANDSCAPE, VIEWPORTS[1], VIEWPORTS[2]] : [VIEWPORTS[0], VIEWPORTS[2]];
const INTERIOR = FULL ? [VIEWPORTS[0], { tag: '360x740', w: 360, h: 740, touch: true }, LANDSCAPE, VIEWPORTS[1], VIEWPORTS[2]] : [VIEWPORTS[0], VIEWPORTS[2]];

// The two projects. sample: PC.sample with every level synced and approved. empty: the untouched questionnaire
// (PC.store.defaults(), its six default rooms) on a 20 x 30 m rectangle. Zero rooms has no 3D house at all
// (PC.house.build returns null; F5-T3b list). Built in the page from its own PC.
const project = (page, kind, stage) => page.evaluate(({ kind, stage }) => {
  const s = JSON.parse(JSON.stringify(kind === 'sample' ? PC.sample.state() : PC.store.defaults()));
  if (kind === 'empty') {
    s.plot = { pts: [[0, 0], [20, 0], [20, 30], [0, 30]], closed: true }; s.ans.streetEdge = 0;
  }
  PC.plans.sync(s);
  for (const id in s.plans) if (!s.plans[id].error) s.plans[id].approved = true;
  s.stage = stage;
  PC.store.replace(s);
}, { kind, stage });

const ready3d = (page) => page.waitForFunction(() => { const i = PC.debug.scene(); return i && i.renders > 0 && !i.frame && !i.building; }, null, { timeout: 8000 });

// Clipped text and sideways overflow inside the visible stage, the header and the bar.
const overflow = (page) => page.evaluate(() => {
  const f = [], vis = (e) => !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0;
  const st = document.querySelector('[data-stage]:not([hidden])');
  if (st && st.scrollWidth > st.clientWidth + 0.5) f.push(`stage scrollWidth ${st.scrollWidth} > ${st.clientWidth}`);
  const roots = [st, document.querySelector('.pc-header'), document.querySelector('[data-pc="btn-next"]')?.parentElement].filter(Boolean);
  for (const r of roots) for (const e of r.querySelectorAll('button, label, h1, h2, h3, p, .pc-seg__txt, .pc-card__name, .pc-card__desc, .pc-caption__text')) {
    if (!vis(e) || e.clientWidth <= 1) continue;   // visually hidden (pc-vh, the phone group titles)
    const cs = getComputedStyle(e);
    if (cs.overflowX === 'visible' || cs.textOverflow === 'ellipsis') continue;   // ellipsis is a designed truncation
    if (e.scrollWidth > e.clientWidth + 1) f.push(`text clipped in ${e.dataset.pc || e.className || e.tagName} (${e.scrollWidth} > ${e.clientWidth})`);
  }
  return f;
});

// WCAG AA for every visible text run: 4.5:1, 3:1 for large text (24 px, or 18.67 px bold). The background is the first
// opaque ancestor colour (semi-transparent ones composited on it); text drawn straight over a canvas is skipped (the
// 3D caption and the legend have their own surfaces). Disabled controls are exempt (WCAG 1.4.3).
const contrast = (page) => page.evaluate(() => {
  const P = (c) => { const m = c.match(/[\d.]+/g) || [0, 0, 0, 0]; return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]]; };
  const L = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top, bot) => [0, 1, 2].map((i) => top[i] * top[3] + bot[i] * (1 - top[3])).concat(1);
  const bg = (e) => {
    const stack = [];
    for (let n = e; n; n = n.parentElement) {
      const c = P(getComputedStyle(n).backgroundColor);
      if (c[3] < 1 && n.classList.contains('pc-canvas-wrap')) return null;   // reached the canvas before an opaque surface
      if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; }
    }
    let out = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
    return out;
  };
  const f = [], seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (t) => t.textContent.trim() ? 1 : 3 });
  for (let t; (t = walker.nextNode());) {
    const e = t.parentElement;
    if (seen.has(e) || e.closest('[hidden], svg, template, [aria-hidden="true"]') || e.closest('[data-stage][hidden]')) continue;
    seen.add(e);
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || +cs.opacity === 0 || r.bottom < 0 || r.top > innerHeight) continue;
    if (e.closest(':disabled, [aria-disabled="true"], .is-disabled')) continue;
    const b = bg(e); if (!b) continue;
    const fg = over(P(cs.color), b), l1 = L(fg), l2 = L(b), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5) - 0.005) f.push(`"${t.textContent.trim().slice(0, 24)}" ${ratio.toFixed(2)}:1 (${cs.color} on rgb(${b.slice(0, 3).map(Math.round)}))`);
  }
  return f;
});

// Keyboard focus: the first 16 Tab stops each show a ring while focused: the outline or box-shadow of the element, or
// of the element right after it (a radio / checkbox draws its ring on its card or segment), differs from its unfocused
// look. A checked card's inset accent shadow alone is not a ring.
async function focusRings(page) {
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
  const f = [], seen = [];
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      const look = () => [e, e.nextElementSibling].map((n) => { if (!n) return ''; const cs = getComputedStyle(n); return [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow].join(' '); }).join('|');
      const on = look(); e.blur(); const off = look();
      return { id: e.dataset.pc || e.name || e.className || e.tagName, ok: on !== off };
    });
    if (!r) continue;
    seen.push(r.id);
    // blur() left the sequential focus starting point on the element, so the next Tab moves on from it
    if (!r.ok) f.push(`no focus ring on ${r.id}`);
  }
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
  return seen.length ? f : ['no Tab stop reached'];
}

const R = (page, h) => page.evaluate((h) => { const e = document.querySelector(`[data-pc="${h}"]`); if (!e || e.closest('[hidden]')) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, h);
const meet = (a, b) => !!a && !!b && !(a.r <= b.l + 0.5 || b.r <= a.l + 0.5 || a.b <= b.t + 0.5 || b.b <= a.t + 0.5);
const area = (a, b) => (a && b) ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t)) : 0;

// The plot outline (ground, y = 0) projected with the current pose, PC.C.CAM.fov and the canvas aspect: every corner
// inside the canvas (normalised device coordinates within [-1, 1]).
const plotInView = (page) => page.evaluate(() => {
  const h = PC.debug.house(), p = PC.view3d.pose(), e = PC.cam.position(p), c = document.querySelector('[data-pc="v3-canvas"]');
  const asp = c.clientWidth / c.clientHeight, t = Math.tan(PC.C.CAM.fov / 2 * Math.PI / 180);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nz = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
  const fw = nz(sub(p.target, e)), rt = nz(cr(fw, [0, 1, 0])), up = cr(rt, fw);
  const ndc = h.plot.pts.map((q) => { const v = sub([q[0] - h.center[0], 0, -(q[1] - h.center[1])], e), z = dot(v, fw); return [dot(v, rt) / (z * t * asp), dot(v, up) / (z * t)]; });
  return { w: c.clientWidth, h: c.clientHeight, max: Math.max(...ndc.flat().map(Math.abs)) };
});

async function generic(o, at) {
  const { page, problems } = o;
  // finished CSS transitions (button colours fade in 120 ms); infinite animations (spinners) are not awaited
  await page.evaluate(() => Promise.all(document.getAnimations().filter((x) => x.effect && x.effect.getComputedTiming().endTime !== Infinity).map((x) => x.finished.catch(() => {}))));
  T.none(await A.noPageScroll(page), `${at}: no page scroll`);
  T.none(await overflow(page), `${at}: no sideways overflow or clipped text`);
  T.none(await A.tapTargets(page), `${at}: tap targets 44 px`);
  T.none(await A.barInViewport(page), `${at}: Back / Next in view`);
  T.none(await contrast(page), `${at}: text contrast AA`);
  T.none(await focusRings(page), `${at}: keyboard focus visible`);
  T.none(problems(), `${at}: clean log`);
}

async function stage5(o, vp, at) {
  const { page, act, hook } = o;
  await ready3d(page);
  const expanded = () => page.evaluate(() => !document.querySelector('[data-pc="v3-panel"]').classList.contains('is-collapsed'));
  if (!(await expanded())) { await act('v3-panel-toggle'); await settled(page); }
  if (vp === LANDSCAPE) {
    const cv = await R(page, 'v3-canvas'), pn = await R(page, 'v3-panel');
    T.eq(area(cv, pn), 0, `${at}: expanded panel covers none of the canvas (side by side)`);
    T.ok(Math.abs((cv.r - cv.l) - 368) < 1, `${at}: canvas 368 px wide beside the 272 px panel (${(cv.r - cv.l).toFixed(0)})`);
  }
  await act('v3-reset'); await ready3d(page); await settled(page);
  const f = await plotInView(page);
  T.ok(f.max <= 1, `${at}: Reset frames the whole plot in the ${f.w} x ${f.h} canvas (max |ndc| ${f.max.toFixed(2)})`);
  // tour caption against the panel and its toggle: Start, then seek to stops and mid-legs (debug-only tourSeek)
  if (await hook('v3-tab-tour').isVisible()) { await act('v3-tab-tour'); await settled(page); }
  await act('v3-tour-start'); await settled(page);
  const hits = [];
  for (const tau of [0.5, 3, 6, 10, 15, 25, 40]) {
    await page.evaluate((t) => PC.debug.tourSeek(t), tau);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const cap = await R(page, 'v3-caption'); if (!cap) continue;
    for (const h of ['v3-panel', 'v3-panel-toggle']) { const b = await R(page, h); if (meet(cap, b)) hits.push(`${tau} s: caption meets ${h}`); }
  }
  T.none(hits, `${at}: tour caption clear of the panel and its toggle`);
  if (!(await hook('v3-tour-stop').isDisabled())) await act('v3-tour-stop');
  await settled(page);
}

// ---- folded F3-T3 interior checks (names as in interior.spec.mjs; mutation proofs in F5-T3/impl-notes.md) ----
async function interior(vp) {
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
    return { cards, checked, sideScroll: st.scrollWidth > st.clientWidth + 0.5, banner: document.querySelectorAll('[data-pc="banner-slot"] > *').length };
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
    // F5-T3a (plan §8 item 7): from 600 px the card name, with its radio dot (::before, first in the name), starts at the
    // description's left edge
    const align = [...st.querySelectorAll('.pc-card')].map((c) => { const n = c.querySelector('.pc-card__name'), d = c.querySelector('.pc-card__desc');
      if (!n || !d) return 0; const r = document.createRange(); r.selectNodeContents(n);
      // the name box starts at the description's edge and its text right after the 16 px dot + 8 px gap
      return Math.max(Math.abs(box(n).left - box(d).left), Math.abs(r.getBoundingClientRect().left - box(n).left - 24)); });
    return { piece: min('.h-piece'), chipW: Math.min(...chips.map((r) => r.width)), chipH: Math.min(...chips.map((r) => r.height)), inCard, lines, align };
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
  if (vp.w >= 600) T.ok(h.align.every((d) => d <= 1), `${at}: card name and radio left-aligned with the description (${h.align.map((d) => d.toFixed(0))})`);
  T.none(await A.noPageScroll(page), `${at}: no page scroll`);
  T.none(await A.barInViewport(page), `${at}: Back / Next in view`);
  T.none(await A.tapTargets(page), `${at}: tap targets`);
  T.none(problems(), `${at}: clean log`);
  await ctx.close();
}

try {
  for (const vp of SWEEP) for (const kind of ['sample', 'empty']) {
    const o = await open(browser, vp, { three: 'mock' });
    // stage 1 as the app opens it (start card) for "empty", the sample plot for "sample"
    if (kind === 'sample') await o.act('btn-sample');
    await settled(o.page);
    await generic(o, `${vp.tag} ${kind} stage 1`);
    for (const n of [2, 3, 4, 5]) {
      await project(o.page, kind, n);
      await o.page.waitForFunction((n) => !document.querySelector(`[data-stage="${n}"]`).hidden, n, { timeout: 5000 });
      await settled(o.page);
      const at = `${vp.tag} ${kind} stage ${n}`;
      if (n === 5) await stage5(o, vp, at);
      await generic(o, at);
    }
    await o.ctx.close();
  }
  for (const vp of INTERIOR) await interior(vp);
} finally { await browser.close(); }
process.exit(T.done() ? 1 : 0);
