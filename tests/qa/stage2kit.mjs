// Shared stage-2 test kit (F2-T2 onwards): QA's expectation for a state, a full page read, the sync check and the
// real-input session kit. Used by f2-t2-questions.mjs and f2-t3-site-rooms.mjs.
import { CANVAS_SPY, touchDriver } from './lib.mjs';
import { eq } from './session.mjs';
import * as Q from './f2-t1-ref.mjs';
// F4-T3 vegetation shortfall warning (PM round 11), by its text (same pattern as f4-t3-ref.mjs SHORT_RE)
const SHORT_RE = /^Only .+ of planting fits around the building, parking and pool: /;

export const M2 = 'm²', DOT = ' · ';
export const LEVEL = { B: 'Basement', G: 'Ground floor', 1: 'First floor', 2: 'Second floor' };
export const lab = (hook, v) => `css:[data-pc="${hook}"] label:has(input[value="${v}"])`;       // radio option, tapped on its label
// F5-T3a two-line area label, QA's expectation: the number on line 1, the whole unit on line 2 ("108" / "m²", "1162" / "sq ft")
export const areaLines = (t) => { const i = t.indexOf(' '); return [t.slice(0, i), t.slice(i + 1)]; };
// the drawn texts show the area label: one line, or the two-line split (F5-T3a)
export const hasArea = (texts, t, f53) => texts.includes(t) || (f53 && areaLines(t).every((x) => texts.includes(x)));
export const fmtLen = Q.fmtLen, fmtArea = Q.fmtArea, r1 = (x) => Math.round(x * 10) / 10;

// ---------------- QA's own expectation for a state ----------------
export function streetOf(s) { return s.ans.streetEdge === null ? Q.defaultStreetEdge(s.plot.pts) : s.ans.streetEdge; }
export function expectFor(s, app) {   // app: { parking, pool } placed by the app (verified in F2-T1), used only for the vegetation budget
  const pts = s.plot.pts, e = streetOf(s), pL = Q.toL(pts, e), cls = Q.edgeClasses(pL, e).map((c, i) => (s.ans.edgeOv && s.ans.edgeOv[i]) || c), sb = Q.setbacksOf(cls, s.ans.setbacks);   // classes in effect (F2-S4 overrides)
  const area = Math.abs(Q.signedArea(pL)), lat = Q.latticeBuildable(pL, sb), fp = Q.refFootprint(pL, sb, s.ans.footprintPct, lat);
  const fpA = fp.conflict ? 0 : fp.area, used = fpA + (app.parking ? app.parking.w * app.parking.d : 0) + (app.pool ? app.pool.w * app.pool.d : 0);
  const veg = Math.min(s.ans.vegPct / 100 * area, Math.max(0, area - used));
  const levels = Q.levelIds(s.ans).map((id) => ({ id, needed: Q.needed(s.ans, id), avail: fpA }));
  return { e, pL, cls, sb, area, buildable: lat.area, fp: fp.conflict ? null : { ...fp, u: fp.centre[0] - fp.w / 2, v: fp.centre[1] - fp.d / 2, pct: fp.area / area * 100 }, veg, vegPct: veg / area * 100, levels };
}
// Q5 readout from QA's own geometry: angle of north relative to straight back from the street, clockwise, whole degrees.
export function northText(s) {
  if (s.ans.north === null) return '0°' + DOT + 'toward the back';
  const p = s.plot.pts, e = streetOf(s), a = p[e], b = p[(e + 1) % p.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const vx = -(b[1] - a[1]) / l, vy = (b[0] - a[0]) / l, back = Math.atan2(vx, vy) * 180 / Math.PI;    // +v as clockwise-from-+y
  const rel = Math.round((((s.ans.north - back) % 360) + 360) % 360) % 360;
  return rel === 0 ? '0°' + DOT + 'toward the back' : `${rel}° clockwise from the back`;
}
// QA's own 15-degree snapping of a compass direction given in L (clockwise from straight back) -> stored W value.
export function northStored(s, degL) { const p = s.plot.pts, e = streetOf(s), a = p[e], b = p[(e + 1) % p.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); const back = Math.atan2(-(b[1] - a[1]) / l, (b[0] - a[0]) / l) * 180 / Math.PI; return ((Math.round((degL + back) / 15) * 15) % 360 + 360) % 360; }

// Does a change alter the footprint size (my model)? R5 asks for valid plans exactly then (Q2/Q3/Q6 inputs).
export function sizeChanges(s, mut) { const c = Q.plain(s); mut(c.ans); const f = (x) => { const e = streetOf(x), pL = Q.toL(x.plot.pts, e), sb = Q.setbacksOf(Q.edgeClasses(pL, e).map((c, i) => (x.ans.edgeOv && x.ans.edgeOv[i]) || c), x.ans.setbacks), r = Q.refFootprint(pL, sb, x.ans.footprintPct, Q.latticeBuildable(pL, sb)); return r.conflict ? r.conflict : r.w + 'x' + r.d; }; return f(s) !== f(c) || streetOf(s) !== streetOf(c); }
// Stored W value -> L angle (clockwise from straight back), QA's geometry.
export function lOf(s, w) { const p = s.plot.pts, e = streetOf(s), a = p[e], b = p[(e + 1) % p.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); const back = Math.atan2(-(b[1] - a[1]) / l, (b[0] - a[0]) / l) * 180 / Math.PI; return (((w - back) % 360) + 360) % 360; }

// Everything the page shows that follows the state, in one read.
export const READ = () => {
  const q = (h) => document.querySelector(`[data-pc="${h}"]`), t = (h) => q(h).textContent.trim().replace(/\s+/g, ' ');
  const radio = (h) => { const c = q(h).querySelector('input:checked'); return c ? c.value : null; };
  const dis = (h) => Object.fromEntries([...q(h).querySelectorAll('input')].map((i) => [i.value, i.disabled]));
  const site = PC.debug.site(), c = q('site-canvas').getBoundingClientRect(), fr = window.__spy ? __spy.frame('site-canvas') : null;
  const scr = (u, v) => { const p = PC.debug.toScreen('site', u, v); return [p[0] - c.left, p[1] - c.top]; };
  const rectScr = (r) => r && [[r.u, r.v], [r.u + r.w, r.v], [r.u + r.w, r.v + r.d], [r.u, r.v + r.d]].map((p) => scr(p[0], p[1]));
  return {
    state: JSON.parse(JSON.stringify(PC.debug.state())), invalid: Object.keys(PC.store.session.invalidFields),
    f: Object.fromEntries(['q-setback-front', 'q-setback-back', 'q-setback-side', 'q-parking-cars'].map((h) => [h, { v: q(h).value, inv: q(h).getAttribute('aria-invalid'), err: q(h + '-err').hidden ? null : t(h + '-err') }])),
    units: ['q-setback-front-unit', 'q-setback-back-unit', 'q-setback-side-unit', 'q-ceiling-unit'].map(t),
    sl: Object.fromEntries(['q-footprint', 'q-veg', 'q-ceiling'].map((h) => [h, { v: q(h).value, out: t(h + '-out'), min: q(h).min, max: q(h).max, step: q(h).step }])),
    radios: Object.fromEntries(['q-unit', 'unit-toggle', 'q-floors', 'q-roof', 'q-exterior', 'q-pool-size', 'q-gate'].map((h) => [h, radio(h)])),
    disabled: { roof: dis('q-roof'), pool: dis('q-pool-size'), gate: dis('q-gate') }, q7: typeof PC.site.gateU === 'function',
    sw: Object.fromEntries(['q-basement', 'q-usable-roof', 'q-parking-covered', 'q-pool', 'q-wall', 'q-seating'].map((h) => [h, q(h).checked])),
    north: t('q-north-value'), street: t('q-street-value'), poolNote: t('q-pool-size-note'), f53: !!(PC.cam && PC.cam.viewOffset), roofNote: !q('q-roof-note').hidden,
    sum: { plot: t('sum-plot'), buildable: t('sum-buildable'), fp: t('sum-footprint'), veg: t('sum-veg'), status: t('sum-status'), kind: q('summary').dataset.kind },
    levels: [...q('sum-levels').children].map((r) => r.textContent.trim().replace(/\s+/g, ' ')),
    rows: [...q('conflict-list').children].map((li) => ({ kind: li.dataset.kind, code: li.dataset.code, text: li.querySelector('[data-pc="conflict-text"]').textContent, q: (li.querySelector('[data-pc="conflict-goto"]').getAttribute('aria-label') || '').replace(/\D+/g, '') })),
    validate: (() => { const v = PC.validate(PC.debug.state()); return [...v.blocking.map((x) => ({ kind: 'block', code: x.code, text: x.text, q: String(x.q) })), ...v.warnings.map((x) => ({ kind: 'warn', code: x.code, text: x.text, q: String(x.q) }))]; })(),
    texts: fr ? fr.texts.map((x) => x.text) : null, segs: fr ? fr.segs : null,
    app: site && { parking: site.parking, pool: site.pool, fpScr: rectScr(site.footprint), parkScr: rectScr(site.parking), poolScr: rectScr(site.pool) },
    scr: null, layout: typeof PC.layout === 'object',
  };
};

// Compare the page with QA's expectation. Returns a problem list. Checks every control, readout, summary, rows, preview.
export async function syncProblems(page) {
  const P = await page.evaluate(READ), s = P.state, a = s.ans, u = a.unit, f = [], ex = s.plot.closed ? expectFor(s, P.app || {}) : null;
  const len = (m) => Q.plain(u === 'ft' ? (m / Q.FT).toFixed(1) : m.toFixed(1));
  // controls
  for (const k of ['front', 'back', 'side']) { const h = `q-setback-${k}`, c = P.f[h]; if (P.invalid.includes('setback-' + k)) { if (c.inv !== 'true' || !c.err) f.push(`${h} registered invalid but not marked`); continue; } if (c.v !== len(a.setbacks[k])) f.push(`${h} shows "${c.v}", state ${a.setbacks[k]} m -> "${len(a.setbacks[k])}"`); if (c.inv || c.err) f.push(`${h} marked invalid while valid`); }
  { const c = P.f['q-parking-cars']; if (P.invalid.includes('parking-cars')) { if (c.inv !== 'true' || !c.err) f.push('cars registered invalid but not marked'); } else if (c.v !== String(a.parking.cars) || c.inv || c.err) f.push(`cars field "${c.v}" (${c.inv}) vs ${a.parking.cars}`); }
  if (!P.units.every((x) => x === u)) f.push(`unit suffixes ${P.units} in ${u}`);
  const sl = P.sl; if (sl['q-footprint'].v !== String(a.footprintPct) || sl['q-footprint'].out !== a.footprintPct + ' %') f.push(`Q3 slider ${sl['q-footprint'].v} / "${sl['q-footprint'].out}" vs ${a.footprintPct}`);
  if (sl['q-veg'].v !== String(a.vegPct) || sl['q-veg'].out !== a.vegPct + ' %') f.push(`Q4 slider ${sl['q-veg'].v} / "${sl['q-veg'].out}" vs ${a.vegPct}`);
  { const c = sl['q-ceiling'], ft = u === 'ft', x = ft ? a.ceilingH / Q.FT : a.ceilingH, st = ft ? 0.5 : 0.1, thumb = Math.round(Math.round(x / st) * st * 10) / 10;
    const att = ft ? ['8', '14.5', '0.5'] : ['2.4', '4.5', '0.1'];
    if (Math.abs(Number(c.v) - thumb) > 1e-9) f.push(`Q8 thumb ${c.v}, expected ${thumb} ${u}`); if (c.out !== x.toFixed(1)) f.push(`Q8 label "${c.out}", expected ${x.toFixed(1)}`);
    if (!eq([c.min, c.max, c.step], att)) f.push(`Q8 attributes ${[c.min, c.max, c.step]} in ${u}`); }
  const rw = { 'q-unit': u, 'unit-toggle': u, 'q-floors': String(a.floors), 'q-roof': a.roofType, 'q-exterior': a.exterior, 'q-pool-size': a.pool.size, 'q-gate': a.extras.gate };
  for (const [h, v] of Object.entries(rw)) if (P.radios[h] !== v) f.push(`${h} shows ${P.radios[h]}, state ${v}`);
  if (P.disabled.roof.pitched !== a.usableRoof) f.push(`Pitched disabled=${P.disabled.roof.pitched} with usable roof ${a.usableRoof}`);
  if (Object.values(P.disabled.pool).some((d) => d !== !a.pool.on)) f.push(`pool sizes disabled ${JSON.stringify(P.disabled.pool)} with pool ${a.pool.on}`);
  // F4-T2 (PM round 10 Q7; marker PC.site.gateU): no gate without the wall, so the Gate radios are disabled while the wall is off
  if (Object.values(P.disabled.gate).some((d) => d !== (P.q7 ? !a.extras.wall : false))) f.push(`gate radios disabled ${JSON.stringify(P.disabled.gate)} with wall ${a.extras.wall}`);
  const sw = { 'q-basement': a.basement, 'q-usable-roof': a.usableRoof, 'q-parking-covered': a.parking.covered, 'q-pool': a.pool.on, 'q-wall': a.extras.wall, 'q-seating': a.extras.seating };
  for (const [h, v] of Object.entries(sw)) if (P.sw[h] !== v) f.push(`${h} checked=${P.sw[h]}, state ${v}`);
  // F5-T3a (PM round 14, binding): the pool note in dimensions, "S 3 × 6 · M 4 × 8 · L 5 × 10 m" / ft to one decimal, unit once
  const pn = P.f53 ? (u === 'ft' ? 'S 9.8 × 19.7 · M 13.1 × 26.2 · L 16.4 × 32.8 ft' : 'S 3 × 6 · M 4 × 8 · L 5 × 10 m')
    : ['S', 'M', 'L'].map((k) => { const [w, d] = Q.POOL[k]; return `${k} ${len(w)} × ${len(d)} ${u}`; }).join(DOT); if (P.poolNote !== pn) f.push(`pool note "${P.poolNote}" vs "${pn}"`);
  if (P.roofNote && !a.usableRoof) f.push('roof note shown without usable roof');
  if (!s.plot.closed) return f;
  // readouts
  if (P.north !== northText(s)) f.push(`Q5 readout "${P.north}" vs mine "${northText(s)}"`);
  { const p = s.plot.pts, e = ex.e, st = `Edge ${e + 1} of ${p.length}${DOT}${fmtLen(Math.hypot(p[(e + 1) % p.length][0] - p[e][0], p[(e + 1) % p.length][1] - p[e][1]), u)}`; if (P.street !== st) f.push(`Q6 readout "${P.street}" vs "${st}"`); }
  // summary from QA's model
  const sm = P.sum, fpTxt = ex.fp ? `${fmtArea(ex.fp.area, u)}${DOT}${r1(ex.fp.pct)} %` : '–';
  if (sm.plot !== fmtArea(ex.area, u)) f.push(`sum-plot "${sm.plot}" vs ${fmtArea(ex.area, u)}`);
  if (sm.buildable !== fmtArea(ex.buildable, u)) f.push(`sum-buildable "${sm.buildable}" vs ${fmtArea(ex.buildable, u)}`);
  if (sm.fp !== fpTxt) f.push(`sum-footprint "${sm.fp}" vs mine "${fpTxt}"`);
  if (sm.veg !== `${fmtArea(ex.veg, u)}${DOT}${r1(ex.vegPct)} %`) f.push(`sum-veg "${sm.veg}" vs mine "${fmtArea(ex.veg, u)}${DOT}${r1(ex.vegPct)} %"`);
  // PM round 5 (F3-T1, with PC.layout): a level without rooms shows "–" as needed (its floor-empty block explains it)
  const lv = ex.levels.map((l) => `${LEVEL[l.id]} ${P.layout && !a.rooms.some((r) => r.level === l.id) ? '–' : fmtArea(l.needed, u)} / ${fmtArea(l.avail, u)}`);
  if (ex.fp && !eq(P.levels, lv)) f.push(`level rows ${JSON.stringify(P.levels)} vs ${JSON.stringify(lv)}`);
  // rows: the current validation, never stale; status line and kind follow them
  const QOF = { 'floor-empty': '11', 'basement-empty': '11', 'buildable-small': '2', 'no-fit': '2', 'fp-veg-over': '3', 'level-over': '11', 'fp-clamped': '3', 'veg-reduced': '4', 'parking-omitted': '15', 'pool-omitted': '16' };
  // F4-T2 seating (q 17); F4-T3 vegetation shortfall (PM round 11; recognised by its text, points at Q4 vegetation)
  QOF['seating-omitted'] = '17';
  for (const r of P.rows) { const want = SHORT_RE.test(r.text) ? '4' : QOF[r.code]; if (r.code !== 'field-invalid' && r.q !== want) f.push(`${r.code} row points at Q${r.q}, expected Q${want}`); }
  if (!eq(P.rows, P.validate)) f.push(`conflict rows ${JSON.stringify(P.rows)} differ from the current validation ${JSON.stringify(P.validate)}`);
  const nb = P.rows.filter((r) => r.kind === 'block').length, nw = P.rows.length - nb;
  const st = !nb && !nw ? 'All clear' : [nb ? `${nb} to fix` : '', nw ? `${nw} warning${nw === 1 ? '' : 's'}` : ''].filter(Boolean).join(DOT);
  if (sm.status !== st || sm.kind !== (nb ? 'block' : nw ? 'warn' : 'ok')) f.push(`status "${sm.status}" (${sm.kind}) vs "${st}"`);
  if (!ex.fp && P.rows.every((r) => !['no-fit', 'buildable-small'].includes(r.code))) f.push('my model has no footprint, but no 20 m² conflict is shown');
  // preview (drawn content of the last frame)
  if (P.texts) {
    if (!P.texts.includes('front')) f.push('preview: street edge not labelled "front"');
    // class labels may carry a trailing "*" for an edge the user overrode (F2-S4, from F2-T3 on)
    // F5-T3a: a footprint area label wider than the footprint goes on two lines ("143" / "m²") or outside on the street side
    const areaParts = ex.fp && P.f53 ? areaLines(fmtArea(ex.fp.area, u)) : [];
    for (const x of P.texts) if (!['front', 'back', 'side', 'back*', 'side*', 'N'].includes(x) && !(ex.fp && x === fmtArea(ex.fp.area, u)) && !areaParts.includes(x)) f.push(`preview draws "${x}" (my footprint ${ex.fp ? fmtArea(ex.fp.area, u) : 'none'})`);
    const counts = (arr) => arr.reduce((o, x) => ((o[x] = (o[x] || 0) + 1), o), {}), mine = counts(ex.cls), drawn = counts(P.texts.map((x) => x.replace(/\*$/, '')).filter((x) => ['back', 'side'].includes(x)));
    for (const k in drawn) if (drawn[k] > (mine[k] || 0)) f.push(`preview labels ${drawn[k]} "${k}" edges, my classes have ${mine[k] || 0}`);
    if (ex.fp) { const fr = P.app.fpScr; if (!fr) f.push('preview: app has no footprint, mine has one'); else {
      // the drawn footprint is where my model puts it: compare the app's screen rect with my rect through the same transform
      const mineScr = await page.evaluate((r) => { const c = document.querySelector('[data-pc="site-canvas"]').getBoundingClientRect(); return [[r.u, r.v], [r.u + r.w, r.v], [r.u + r.w, r.v + r.d], [r.u, r.v + r.d]].map((p) => { const q = PC.debug.toScreen('site', p[0], p[1]); return [q[0] - c.left, q[1] - c.top]; }); }, ex.fp);
      const hasSeg = (a, b) => P.segs.some((g) => (Math.hypot(g[0] - a[0], g[1] - a[1]) < 1 && Math.hypot(g[2] - b[0], g[3] - b[1]) < 1) || (Math.hypot(g[0] - b[0], g[1] - b[1]) < 1 && Math.hypot(g[2] - a[0], g[3] - a[1]) < 1));
      const drawnEdges = [0, 1, 2, 3].filter((i) => hasSeg(mineScr[i], mineScr[(i + 1) % 4])).length;
      if (drawnEdges < 3) f.push(`preview: my footprint ${ex.fp.w} x ${ex.fp.d} at (${ex.fp.u}, ${ex.fp.v}) is not drawn (${drawnEdges} of 4 edges found)`); } }
    for (const [name, scr] of [['parking', P.app && P.app.parkScr], ['pool', P.app && P.app.poolScr]]) if (scr) { const n = [0, 1, 2, 3].filter((i) => P.segs.some((g) => Math.hypot(g[0] - scr[i][0], g[1] - scr[i][1]) < 1 || Math.hypot(g[2] - scr[i][0], g[3] - scr[i][1]) < 1)).length; if (n < 3) f.push(`preview: ${name} not drawn where the site model puts it`); }
  }
  return f;
}

// sync and kit need the suite's collector and session factory.
export const hintProblems = Q.hintProblems;   // parking / pool fix hints (PM round 5), see f2-t1-ref.mjs
export const layoutOn = (page) => page.evaluate(() => typeof PC.layout === 'object');

export function stage2Kit({ R, session }) {
  const sync = async (S, label) => { await S.settle(); R.check(`${S.vp.tag} ${label}: every control, readout, preview and summary follows the state`, await syncProblems(S.page)); };

  // ---------------- input helpers (real input only) ----------------
  async function kit(browser, vp, opts = {}) {
    const S = await session(browser, vp, { init: [CANVAS_SPY, ...(opts.init || [])] });
    Q.setStretch(await S.page.evaluate(() => PC.C.FOOTPRINT_STRETCH_RATIO !== undefined)); Q.setCapExtra(await S.page.evaluate(() => PC.C.FOOTPRINT_STRETCH_EXTRA !== undefined));   // corrected cap (F3-T1)   // my model follows the rule version of the build (A-6 step 4b)
    S.T = vp.touch ? await touchDriver(S.page) : null;
    // Type into a numeric field like a user: tap it, select its text, type, Enter (the field leaves on Enter).
    S.type = async (h, text) => { await S.act(h); await S.page.keyboard.press('Control+A'); await S.page.keyboard.press('Delete'); if (text) await S.page.keyboard.type(text); await S.page.keyboard.press('Enter'); await S.settle(); };
    // Same, but the field is left by tapping a neutral spot (the progress line) instead of Enter.
    S.typeAway = async (h, text) => { await S.act(h); await S.page.keyboard.press('Control+A'); await S.page.keyboard.press('Delete'); if (text) await S.page.keyboard.type(text); await S.act('q-progress-text'); await S.settle(); };
    // Slider: real pointer drag of the thumb from its value to another (thumb 16 px, centre travels width - 16).
    S.slide = async (h, to, { via = null, from = null } = {}) => {
      const g = await S.page.evaluate((h) => { const e = document.querySelector(`[data-pc="${h}"]`); e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width, min: +e.min, max: +e.max, v: +e.value }; }, h);
      const pos = (v) => [g.x + 8 + (v - g.min) / (g.max - g.min) * (g.w - 16), g.y], pts = [pos(from === null ? g.v : from), ...(via === null ? [] : [pos(via)]), pos(to)];
      if (vp.touch) { await S.T.send('touchStart', [pts[0]]); for (let j = 1; j < pts.length; j++) for (let i = 1; i <= 8; i++) { const a = pts[j - 1], b = pts[j]; await S.T.send('touchMove', [[a[0] + (b[0] - a[0]) * i / 8, a[1]]]); await S.page.evaluate(() => new Promise((r) => requestAnimationFrame(r))); } await S.T.send('touchEnd', []); }
      else { await S.page.mouse.move(...pts[0]); await S.page.mouse.down(); for (let j = 1; j < pts.length; j++) for (let i = 1; i <= 8; i++) { const a = pts[j - 1], b = pts[j]; await S.page.mouse.move(a[0] + (b[0] - a[0]) * i / 8, a[1]); } await S.page.mouse.up(); }
      await S.settle();
    };
    S.tapAt = async (p) => { if (vp.touch) await S.T.tap(p); else await S.page.mouse.click(p[0], p[1]); await S.settle(); };
    S.dragPts = async (a, b, whileDown) => { if (vp.touch) await S.T.drag(a, b, { steps: 10, whileDown }); else { await S.page.mouse.move(...a); await S.page.mouse.down(); for (let i = 1; i <= 10; i++) await S.page.mouse.move(a[0] + (b[0] - a[0]) * i / 10, a[1] + (b[1] - a[1]) * i / 10); if (whileDown) await whileDown(); await S.page.mouse.up(); } await S.settle(); };
    S.ans = async () => (await S.state()).ans;
    S.dialogText = () => S.page.evaluate(() => { const q = (h) => document.querySelector(`[data-pc="dialog-layer"] [data-pc="${h}"]`), mv = q('level-remove-move'), del = q('level-remove-delete'), lt = q('level-remove-text');
      return { title: q('dialog-title').textContent, text: q('dialog-text').textContent, ok: q('dialog-ok').textContent, cancel: q('dialog-cancel').textContent,
        rooms: lt ? lt.textContent : null, move: mv ? { disabled: mv.disabled, checked: mv.checked } : null, del: del ? { disabled: del.disabled, checked: del.checked } : null }; });
    S.waitDialog = (open = true) => S.until(async () => (await S.dialogOpen()) === open, 3000);
    S.rows = () => S.page.evaluate(() => [...document.querySelectorAll('[data-pc="conflict-list"] > li')].map((li) => ({ kind: li.dataset.kind, code: li.dataset.code, text: li.querySelector('[data-pc="conflict-text"]').textContent })));
    S.group = () => S.page.evaluate(() => ['site', 'building', 'rooms', 'outdoor'].find((g) => !document.querySelector(`[data-pc="q-group-${g}"]`).hidden));
    S.openGroup = async (g) => { if ((await S.group()) !== g) await S.act('q-tab-' + g); };
    // Edge midpoint of edge i in the preview (frame L of the current street edge), viewport coordinates.
    S.edgeMid = async (i, off = 0) => { const s = await S.state(), e = streetOf(s), pL = Q.toL(s.plot.pts, e), a = pL[i], b = pL[(i + 1) % pL.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];  // inward normal (CCW)
      const [p, q] = await S.page.evaluate(([m, n]) => [PC.debug.toScreen('site', m[0], m[1]), PC.debug.toScreen('site', m[0] + n[0], m[1] + n[1])], [mid, n]);
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]); return [p[0] + (q[0] - p[0]) / d * off, p[1] + (q[1] - p[1]) / d * off]; };
    if (opts.plot) await S.page.evaluate(([pts, ans]) => PC.store.commit((s) => { s.plot = { pts, closed: true }; s.ans.streetEdge = 0; Object.assign(s.ans, ans || {}); }), [opts.plot, opts.ans]);
    else if (opts.sample !== false) await S.act('btn-sample');
    // With PC.layout (F3-T1) the sample loads with generated draft plans. Scenarios of stages 1-2 that are not about plans
  // start without them, as before F3-T1 (navigation commit; sampleClean kept); R5 scenarios seed their own valid plans.
  S.hasLayout = await layoutOn(S.page);
  if (S.hasLayout && !opts.keepPlans) await S.page.evaluate(() => PC.store.commit((s) => { s.plans = {}; }, { nav: true }));
  if (opts.max5) await S.page.evaluate(() => { PC.stages.MAX_BUILT = 5; PC.ui.shell.render(); });
    if (opts.stage2 !== false) { await S.act('btn-next'); await S.until(() => S.page.evaluate(() => !document.querySelector('[data-stage="2"]').hidden), 3000); await S.settle(); }
    return S;
  }
  return { sync, kit };
}
// Valid plans with real signatures (no plan stage exists before F3-T1; this is the only seeded state, as in the FS spec).
export const seedPlans = (S) => S.page.evaluate(() => PC.store.commit((s) => { PC.levels.ids(s).forEach((id) => { s.plans[id] = { sig: PC.sig.level(s, id), rooms: [], unmet: [], edited: true, approved: true, error: null }; }); }));
