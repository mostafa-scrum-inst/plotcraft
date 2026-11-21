// F2-T3 QA: narrow-plot footprints (A-6 step 4b, CD-1), edge-class overrides (F2-S4, CD-2: tap mode, edge list,
// clearing, R5, draft v2) and the room list (F2-S2: Q11-Q14, pairs, remove-level dialog) through the real UI.
// Expectations from QA's own model (f2-t1-ref.mjs incl. 4b and the long-side cap) and QA's reading of the stories.
// Run: node tests/qa/f2-t3-site-rooms.mjs [--no-shots] [--only=A,B,...]   (sections below)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VIEWPORTS, launch, collector } from './lib.mjs';
import { sessions, eq, sampleProblems } from './session.mjs';
import * as Q from './f2-t1-ref.mjs';
import { DOT, LEVEL, lab, fmtLen, fmtArea, r1, streetOf, expectFor, READ, stage2Kit, seedPlans } from './stage2kit.mjs';

const SHOTS = join(ROOT, 'tests/qa/shots/F2-T3'); mkdirSync(SHOTS, { recursive: true });
const noShots = process.argv.includes('--no-shots');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (sec) => !only.length || only.includes(sec);
const R = collector('F2-T3 site and rooms');
// Open minor bugs (docs/03-tasks/F2-T3/qa-report.md): listed as KNOWN, do not fail the run. Remove an entry when fixed.
// (F2-T3 bug 1, "Master bedroom" cut off in ft on phones, was listed here; fixed by the Designer, re-tested 2026-11-20, entry removed.)

const session = sessions({ R, shots: SHOTS, noShots });
const { sync, kit } = stage2Kit({ R, session });
const VP = Object.fromEntries(VIEWPORTS.map((v) => [v.tag, v]));
const PHONE = VP['360x640'], LAND = VP['640x360'], TAB = VP['768x1024'], DESK = VP['1280x800'];
const rect = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];
const SAMPLE = [[0, 0], [20, 0], [20, 30], [8, 30], [0, 26]];
const COMB = [[0, 0], [50, 0], [50, 40], [40, 40], [40, 12], [30, 12], [30, 40], [20, 40], [20, 12], [10, 12], [10, 40], [0, 40]];   // 12 vertices
const other = (c) => (c === 'back' ? 'side' : 'back');

// ---------------- QA's own view of overrides ----------------
function autoCls(s) { const e = streetOf(s), pL = Q.toL(s.plot.pts, e); return Q.edgeClasses(pL, e); }
function effCls(s) { const a = autoCls(s), ov = s.ans.edgeOv || {}; return a.map((c, i) => ov[i] || c); }
// A-4 invariant of edgeOv: empty unless closed; keys are valid non-street indices; values back / side, never equal to automatic.
function ovProblems(s) {
  const ov = s.ans.edgeOv, f = []; if (!ov || typeof ov !== 'object' || Array.isArray(ov)) return ['edgeOv missing or not an object'];
  const keys = Object.keys(ov); if (!keys.length) return f; if (!s.plot.closed) return ['edgeOv not empty on an open plot: ' + JSON.stringify(ov)];
  const n = s.plot.pts.length, e = streetOf(s), a = autoCls(s);
  for (const k of keys) { const i = Number(k); if (!(String(i) === k && i >= 0 && i < n)) f.push(`index ${k} out of range`); else if (i === e) f.push(`street edge ${k} overridden`); else if (!['back', 'side'].includes(ov[k])) f.push(`value ${ov[k]}`); else if (ov[k] === a[i]) f.push(`edge ${k} override equals its automatic class`); }
  return f;
}
const inv = async (S, label) => R.check(`${S.vp.tag} ${label}: edgeOv invariant (A-4)`, ovProblems(await S.state()));
// Label rectangles and the floating overlays, in canvas coordinates.
const LABELS = () => {
  const c = document.querySelector('[data-pc="site-canvas"]').getBoundingClientRect(), labels = PC.debug.siteLabels();
  const rel = (el) => { if (!el || el.closest('[hidden]') || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') return null; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null; return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height, name: el.dataset.pc }; };
  const d = PC.debug.siteDial(), ovl = ['site-tap-mode', 'site-preview-toggle'].map((h) => rel(document.querySelector(`[data-pc="${h}"]`))).filter(Boolean);
  ovl.push({ x: d.x - c.left - d.r, y: d.y - c.top - d.r, w: 2 * d.r, h: 2 * d.r, name: 'compass' });
  const lg = document.querySelector('[data-pc="site-legend"]'); if (lg && getComputedStyle(lg).position === 'absolute') { const r = rel(lg); if (r) ovl.push(r); }
  return { labels, ovl, w: c.width, h: c.height };
};
const X = (a, b, m = 0) => a.x < b.x + b.w - m && b.x < a.x + a.w - m && a.y < b.y + b.h - m && b.y < a.y + a.h - m;
function labelProblems(L, { overlapsAllowed = false } = {}) {
  const f = [];
  for (const l of L.labels) for (const o of L.ovl) if (X(l, o, 0.5)) f.push(`label "${l.text}" over ${o.name}`);
  if (!overlapsAllowed) for (let i = 0; i < L.labels.length; i++) for (let j = i + 1; j < L.labels.length; j++) if (X(L.labels[i], L.labels[j], 0.5)) f.push(`labels "${L.labels[i].text}" and "${L.labels[j].text}" overlap`);
  return f;
}
const overlapPairs = (L) => { let n = 0; for (let i = 0; i < L.labels.length; i++) for (let j = i + 1; j < L.labels.length; j++) if (X(L.labels[i], L.labels[j], 0.5)) n++; return n; };
// QA's room naming (F2-S2 "Bedroom 1, Bedroom 2 ..."): per level and type, numbered when there is more than one; the master is "Master bedroom".
function myNames(a) { const out = {}, num = (id) => parseInt(id.slice(1), 10);
  for (const lv of Q.levelIds(a)) { const g = {}; for (const r of a.rooms.filter((x) => x.level === lv).sort((p, q) => num(p.id) - num(q.id))) { if (r.master) { out[r.id] = 'Master bedroom'; continue; } (g[r.type] = g[r.type] || []).push(r); }
    for (const t in g) g[t].forEach((r, i) => { out[r.id] = ({ bedroom: 'Bedroom', bathroom: 'Bathroom', kitchen: 'Kitchen', living: 'Living', dining: 'Dining', majlis: 'Majlis', office: 'Office', maid: "Maid's room", storage: 'Storage', laundry: 'Laundry' })[t] + (g[t].length > 1 ? ' ' + (i + 1) : ''); }); }
  return out; }
const ROOMS = () => ({ rows: [...document.querySelectorAll('[data-pc="room-list"] [data-room]')].map((li) => { const q = (h) => li.querySelector(`[data-pc="${h}"]`); return { id: li.dataset.room, level: li.closest('[data-level]').dataset.level, name: q('room-name').textContent, hint: q('room-area-hint').textContent, type: q('room-type').value, lv: q('room-level').value, size: q('room-size').value, master: q('room-master').checked, masterShown: !q('room-master').closest('label').hidden, exactShown: !q('room-area-box').hidden, area: q('room-area').value }; }),
  groups: [...document.querySelectorAll('[data-pc="room-list"] [data-level]')].map((g) => [g.dataset.level, g.querySelector('[data-pc="group-count"]').textContent]),
  msg: (() => { const m = document.querySelector('[data-pc="room-msg"]'); return m.hidden ? '' : m.textContent; })(), pmsg: (() => { const m = document.querySelector('[data-pc="pair-msg"]'); return m.hidden ? '' : m.textContent; })(),
  pairs: [...document.querySelectorAll('[data-pc="pair-list"] [data-pc="pair-text"]')].map((x) => x.textContent), invalid: Object.keys(PC.store.session.invalidFields) });
// The room list shows the state: one group per existing level with "n of 8", one row per room with my name, area, controls.
async function roomsProblems(S) {
  const s = await S.state(), a = s.ans, u = a.unit, P = await S.page.evaluate(ROOMS), names = myNames(a), f = [];
  const levels = Q.levelIds(a); if (!eq(P.groups.map((g) => g[0]), levels)) f.push(`groups ${P.groups.map((g) => g[0])} vs levels ${levels}`);
  for (const [lv, txt] of P.groups) { const n = a.rooms.filter((r) => r.level === lv).length; if (txt !== `${n} of 8`) f.push(`${lv} count "${txt}" vs ${n} of 8`); }
  if (P.rows.length !== a.rooms.length) f.push(`${P.rows.length} rows for ${a.rooms.length} rooms`);
  for (const r of a.rooms) { const w = P.rows.find((x) => x.id === r.id); if (!w) { f.push('no row for ' + r.id); continue; }
    const area = r.size === null ? r.area : Q.ROOM_AREA[r.type][r.size];
    if (w.level !== r.level || w.lv !== r.level) f.push(`${r.id} shown on ${w.level}/${w.lv}, stored ${r.level}`);
    if (w.name !== names[r.id]) f.push(`${r.id} named "${w.name}", mine "${names[r.id]}"`);
    if (w.hint !== fmtArea(area, u)) f.push(`${r.id} area "${w.hint}" vs ${fmtArea(area, u)}`);
    if (w.type !== r.type || w.size !== (r.size === null ? 'exact' : r.size) || w.master !== r.master) f.push(`${r.id} controls ${w.type}/${w.size}/${w.master} vs ${r.type}/${r.size}/${r.master}`);
    if (w.masterShown !== (r.type === 'bedroom')) f.push(`${r.id} master switch shown=${w.masterShown} for a ${r.type}`);
    if (w.exactShown !== (r.size === null)) f.push(`${r.id} exact box shown=${w.exactShown}`);
    if (r.size === null && !P.invalid.includes('room-area-' + r.id) && w.area !== String(Math.round(u === 'ft' ? r.area / (Q.FT * Q.FT) : r.area))) f.push(`${r.id} exact field "${w.area}"`); }
  if (a.rooms.filter((r) => r.master).length > 1) f.push('more than one master');
  const byId = Object.fromEntries(a.rooms.map((r) => [r.id, r])), pt = a.pairs.map((p) => `${names[p[0]]} + ${names[p[1]]}${DOT}${LEVEL[byId[p[0]].level]}`);
  if (!eq(P.pairs, pt)) f.push(`pairs ${JSON.stringify(P.pairs)} vs ${JSON.stringify(pt)}`);
  for (const p of a.pairs) { const x = byId[p[0]], y = byId[p[1]]; if (!x || !y) f.push('pair with a missing room'); else if (x.level !== y.level) f.push('pair across levels'); else if (p[0] === p[1]) f.push('self pair'); }
  for (const k of P.invalid) if (k.startsWith('room-area-') && !(byId[k.slice(10)] && byId[k.slice(10)].size === null)) f.push('ghost invalid entry ' + k);
  return f;
}
const rooms = async (S, label) => { await S.settle(); R.check(`${S.vp.tag} ${label}: room list follows the state`, await roomsProblems(S)); };
const roomCss = (id, h) => `css:[data-pc="room-list"] [data-room="${id}"] [data-pc="${h}"]`;
// Pick in a <select> like a user (the native picker cannot be driven; selectOption sets it and fires change).
const pick = async (S, css, value) => { await S.page.locator(css.replace(/^css:/, '')).selectOption(value); await S.settle(); };
const toasts = (S) => S.toasts();
const setTap = (S, m) => S.act(lab('site-tap-mode', m === 'class' ? 'class' : 'street'));

const browser = await launch();
const t0 = Date.now();
try {
  // ======================= N. node: comb timing with step 4b (item 1) =======================
  if (want('N')) { const PCn = Q.loadPC(); for (const pct of [30, 80]) { const s = JSON.parse(JSON.stringify(PCn.store.defaults())); s.plot = { pts: COMB.map((p) => [p[0] * 2, p[1] * 2.5]), closed: true }; s.ans.streetEdge = 0; s.ans.footprintPct = pct; let best = 1e9, fp = null;
      for (let k = 0; k < 3; k++) { PCn.site.clearMemo(); const t = process.hrtime.bigint(), site = PCn.site.analyse(s); best = Math.min(best, Number(process.hrtime.bigint() - t) / 1e6); fp = site.footprint; }
      R.check(`N comb 100 x 100 m at ${pct} %: analyse with step 4b under 500 ms (best of 3: ${best.toFixed(0)} ms), clamped so 4b ran`, best < 500 && fp && fp.clamped !== undefined ? [] : [`${best} ms`, JSON.stringify(fp)]); } }

  // ======================= A. Item 1: 4b footprints in the UI, m and ft =======================
  if (want('A')) for (const vp of [PHONE, DESK]) {
    for (let [name, pts, pct, sb, exp] of [
      ['10 x 50 m at 30 %', rect(10, 50), 30, null, [6, 18, 'proportion']], ['50 x 10 m at 30 %', rect(50, 10), 30, null, [15, 5, 'proportion']],
      ['20 x 30 m at 80 %', rect(20, 30), 80, null, [16, 24.5, 'setbacks']], ['10 x 20 m at 80 %', rect(10, 20), 80, null, [6, 15, 'setbacks']],
      ['10 x 50 m at 20 %', rect(10, 50), 20, null, [6, 16.5, null]], ['10 x 50 m at 24 %', rect(10, 50), 24, null, [6, 18.5, 'proportion']],
      ['pentagon 6 / 5 / 4 at 25 %', [[5, 0], [30, 0], [38, 18], [18, 34], [0, 16]], 25, { front: 6, back: 5, side: 4 }, [22.5, 7, 'proportion']]]) {
      const S = await kit(browser, vp, { plot: pts, ans: { footprintPct: pct, vegPct: 0, parking: { cars: 0, covered: false }, pool: { on: false, size: 'S' }, ...(sb ? { setbacks: sb } : {}) } });
      if (name.startsWith('pentagon') && Q.capExtraOn()) exp = [21.5, 7, 'proportion'];   // corrected cap 3 x short + 0.5 m (F3-T1, A-6 step 8)
      for (const u of ['m', 'ft']) {
        if (u === 'ft') await S.act('unit-ft');
        const s = await S.state(), fp = (await S.page.evaluate(() => PC.debug.site().footprint)), P = await S.page.evaluate(READ), w = P.rows.filter((r) => r.code === 'fp-clamped'), pr = [];
        if (!fp || fp.w !== exp[0] || fp.d !== exp[1]) pr.push(`footprint ${fp && fp.w} x ${fp && fp.d}`);
        if (exp[2] === null) { if (w.length) pr.push('warning shown: ' + w[0].text); }
        else { if (w.length !== 1) pr.push(`${w.length} clamped warnings`); else { const t = w[0].text, a = fmtArea(exp[0] * exp[1], u), p = r1(exp[0] * exp[1] / Math.abs(Q.signedArea(pts)) * 100) + ' %';
          if (!t.includes(a) || !t.includes(p)) pr.push(`warning lacks ${a} / ${p}: ${t}`);
          if (exp[2] === 'proportion') { const dims = new RegExp(`${fmtLen(exp[0], u).split(' ')[0].replace('.', '\\.')} [x×] ${fmtLen(exp[1], u).replace('.', '\\.')}`);
            if (!/at most 3 times as long as it is wide/.test(t) || !/Smaller setbacks along its long sides/.test(t) || /footprint %/.test(t) || !dims.test(t)) pr.push('not the proportion wording with the dimensions: ' + t); }
          else if (!/reduced to fit inside the setbacks/.test(t) || /3 times/.test(t)) pr.push('not the setbacks wording: ' + t); } }
        if (fp && fp.area > pct / 100 * Math.abs(Q.signedArea(pts)) + 1e-9) pr.push('above the target');
        R.check(`${vp.tag} A ${name} (${u}): ${exp[0]} x ${exp[1]} m, ${exp[2] ? exp[2] + ' wording, once' : 'no warning'}`, pr);
        await sync(S, `A ${name} (${u})`);
        if (vp === PHONE && /10 x 50 m at 30|pentagon/.test(name) && u === 'm') await S.shot(`A-${name.replace(/\W+/g, '-')}`);
      }
      await S.end(`${vp.tag} A ${name}`);
    }
  }

  // ======================= B. Item 2: edge overrides by touch / mouse =======================
  if (want('B')) for (const vp of [PHONE, LAND, DESK]) {
    const V = vp.tag;
    for (const [pname, plot] of [['sample', null], ['12-vertex comb', COMB]]) {
      const S = await kit(browser, vp, plot ? { plot } : {});
      const mode = async () => [await S.page.evaluate(() => PC.debug.tapMode()), await S.page.evaluate(() => document.querySelector('[data-pc="site-tap-mode"] input:checked').value), await S.shown('site-tap-mode')];
      R.check(`${V} B ${pname}: tap mode visible, Street by default`, eq(await mode(), ['street', 'street', true]) ? [] : [JSON.stringify(await mode())]);
      const scale0 = await S.page.evaluate(() => PC.debug.view('site').scale);
      await setTap(S, 'class'); R.check(`${V} B ${pname}: tapping "Back / side" selects it`, (await mode())[0] === 'class');
      const scale1 = await S.page.evaluate(() => PC.debug.view('site').scale);
      if (pname === 'sample') { const pr = []; if (V === '360x640' && (scale0 < 4 || scale1 < 4)) pr.push(`${scale0} / ${scale1} px/m < 4.0`); if (V === '640x360' && (scale0 < 3.5 || Math.abs(scale0 - scale1) > 1e-9)) pr.push(`${scale0} / ${scale1} px/m (>= 3.5 and equal)`); if (V === '1280x800' && Math.abs(scale1 - scale0) > 0.02 * scale0) pr.push(`class mode differs by more than 2 %: ${scale1} vs ${scale0}`);
        R.check(`${V} B sample: drawing scale street ${scale0.toFixed(2)} / class ${scale1.toFixed(2)} px/m within the agreed bounds (TL: 360x640 >= 4.0; 640x360 >= 3.5 and equal; 1280x800 within 2 %)`, pr); }
      const s0 = await S.state(), n = s0.plot.pts.length, e = streetOf(s0), auto = autoCls(s0), pr = [];
      for (let i = 0; i < n; i++) { if (i === e) continue;
        await S.tapAt(await S.edgeMid(i)); let s = await S.state();
        if ((s.ans.edgeOv || {})[i] !== other(auto[i]) || Object.keys(s.ans.edgeOv).length !== 1) pr.push(`edge ${i + 1}: after one tap edgeOv ${JSON.stringify(s.ans.edgeOv)}, expected {${i}: ${other(auto[i])}}`);
        const L = await S.page.evaluate(LABELS); if (!L.labels.some((l) => l.text === other(auto[i]) + '*')) pr.push(`edge ${i + 1}: no "${other(auto[i])}*" label`);
        pr.push(...ovProblems(s).map((x) => `edge ${i + 1}: ${x}`));
        await S.tapAt(await S.edgeMid(i)); s = await S.state(); if (Object.keys(s.ans.edgeOv).length) pr.push(`edge ${i + 1}: second tap left ${JSON.stringify(s.ans.edgeOv)}`);
        if ((await S.page.evaluate(LABELS)).labels.some((l) => /\*$/.test(l.text))) pr.push(`edge ${i + 1}: a "*" label is left after switching back`); }
      R.check(`${V} B ${pname}: every non-street edge (${n - 1}) switches to the other class with one tap and back with a second, "*" label while set`, pr);
      R.check(`${V} B ${pname}: page never scrolled or zoomed`, await S.page.evaluate(() => (scrollX || scrollY || visualViewport.scale !== 1) ? [`${scrollX},${scrollY} x${visualViewport.scale}`] : []));
      // the street edge: a hint, nothing changes
      const before = await S.state(); await S.tapAt(await S.edgeMid(e));
      R.check(`${V} B ${pname}: tapping the street edge in Back / side mode shows the hint and changes nothing`, eq(await S.state(), before) && (await toasts(S)).includes('The street edge is always front (change it with Q6)') ? [] : [JSON.stringify(await toasts(S))]);
      // a tap far from every edge does nothing
      { const c = await S.page.evaluate(() => { const fp = PC.debug.site().footprint; return PC.debug.toScreen('site', fp.u + fp.w / 2, fp.v + fp.d / 2); }); const b2 = await S.state(); await S.tapAt(c);
        if (pname === 'sample') R.check(`${V} B sample: a tap on the footprint centre (far from every edge) changes nothing`, eq(await S.state(), b2)); }
      if (pname === 'sample') {
        // all four non-street edges overridden: no label overlap, all labels present, none over a control
        for (let i = 1; i < n; i++) await S.tapAt(await S.edgeMid(i));
        const L = await S.page.evaluate(LABELS), stars = L.labels.filter((l) => /\*$/.test(l.text)).length;
        R.check(`${V} B sample, 4 edges overridden: "front" and 4 "*" labels drawn, no overlap, none over the control, toggle or compass`, [...(stars === 4 && L.labels.some((l) => l.text === 'front') ? [] : [`${stars} * labels`]), ...labelProblems(L)]);
        const mark = await S.shown('site-legend-mark');
        R.check(`${V} B sample: the "* set by you" legend mark ${vp === PHONE ? 'never shows in phone portrait' : vp === LAND ? 'is hidden with the legend in short landscape' : 'shows while overrides exist'}`, vp === DESK ? mark : !mark);
        await S.shot(`B-sample-class-4-overrides`); await sync(S, 'B sample 4 overrides');
        // tap mode resets on entering stage 2 and on a whole-state replace
        await S.act('step-1'); await S.act('btn-next'); R.check(`${V} B tap mode back to Street on entering stage 2`, eq(await mode(), ['street', 'street', true]));
        // (the four overrides are cleared by Clear with its own notice; Load sample is a replace and adds none)
        await setTap(S, 'class'); await S.act('step-1'); await S.act('btn-clear'); if (await S.dialogOpen()) await S.act('dialog-ok');
        const nClear = (await toasts(S)).filter((t) => /reset/.test(t)).length;
        await S.act('btn-sample'); if (await S.dialogOpen()) await S.act('dialog-ok');
        await S.act('btn-next'); const m2 = await mode(), ov2 = (await S.ans()).edgeOv, n2 = (await toasts(S)).filter((t) => /reset/.test(t)).length;
        R.check(`${V} B tap mode Street after Clear + Load sample (replace), no overrides, Clear announced once, Load sample adds no notice`, eq(m2, ['street', 'street', true]) && eq(ov2, {}) && nClear === 1 && n2 <= nClear ? [] : [JSON.stringify({ m2, ov2, nClear, n2, toasts: await toasts(S) })]);
      } else { await S.shot('B-comb-class'); }
      await inv(S, `B ${pname} end`); await S.end(`${V} B ${pname}`);
    }
  }

  // ======================= C. Item 3: keyboard / no-canvas alternative =======================
  if (want('C')) for (const vp of [DESK, PHONE]) {
    const V = vp.tag;
    for (const unit of ['m', 'ft']) {
      const S = await kit(browser, vp, { max5: true }); if (unit === 'ft') await S.act('unit-ft');
      await S.act('q-edges-toggle'); R.check(`${V} C (${unit}) the edge list opens (aria-expanded)`, (await S.page.evaluate(() => document.querySelector('[data-pc="q-edges-toggle"]').getAttribute('aria-expanded'))) === 'true');
      const s = await S.state(), pL = Q.toL(s.plot.pts, streetOf(s)), n = pL.length, e = streetOf(s);
      const lens = pL.map((p, i) => fmtLen(Math.hypot(pL[(i + 1) % n][0] - p[0], pL[(i + 1) % n][1] - p[1]), unit));
      const rows = () => S.page.evaluate(() => [...document.querySelectorAll('[data-pc="q-edges"] > li')].map((li) => { const b = li.querySelector('[data-pc="edge-switch"]'); return { name: li.querySelector('[data-pc="edge-name"]').textContent, cls: li.querySelector('[data-pc="edge-class"]').textContent, hidden: b.hidden || getComputedStyle(b).display === 'none', label: b.getAttribute('aria-label'), text: b.textContent.trim() }; }));
      const want1 = (st) => { const a = autoCls(st), ov = st.ans.edgeOv; return pL.map((p, i) => { const c = ov[i] || a[i], mine = !!ov[i]; return i === e ? { name: `Edge ${i + 1}${DOT}${lens[i]}`, cls: 'front (street)', hidden: true } : { name: `Edge ${i + 1}${DOT}${lens[i]}`, cls: c + (mine ? ' (set by you)' : ''), hidden: false, label: `Edge ${i + 1}, ${lens[i]}, ${c}${mine ? ' (set by you)' : ''}: make ${other(c)}`, text: `Make ${other(c)}` }; }); };
      const cmp = async (label) => { const got = await rows(), w = want1(await S.state()); R.check(`${V} C (${unit}) ${label}: edge rows with my number, length, class and accessible name`, got.map((g, i) => { const x = w[i]; return (g.name !== x.name || g.cls !== x.cls || g.hidden !== x.hidden || (!x.hidden && (g.label !== x.label || g.text !== x.text))) ? `row ${i + 1}: ${JSON.stringify(g)} vs ${JSON.stringify(x)}` : null; }).filter(Boolean)); };
      await cmp('initial');
      // Tab from the toggle reaches the first switch (street row has none); its focus highlights that edge
      await S.page.focus('[data-pc="q-edges-toggle"]');
      const firstSw = e === 0 ? 1 : 0; let ok = false, focused = null;
      for (let k = 0; k < 6 && !ok; k++) { await S.page.keyboard.press('Tab'); focused = await S.page.evaluate(() => { const a = document.activeElement, li = a && a.closest('[data-edge]'); return li ? Number(li.dataset.edge) : null; }); ok = focused === firstSw; }
      R.check(`${V} C (${unit}) Tab from the list toggle reaches edge ${firstSw + 1}'s switch, and the drawing highlights that edge`, ok && (await S.page.evaluate(() => PC.debug.siteFocusEdge())) === firstSw ? [] : [`focused ${focused}, highlight ${await S.page.evaluate(() => PC.debug.siteFocusEdge())}`]);
      await S.page.keyboard.press('Enter'); await S.settle();
      R.check(`${V} C (${unit}) Enter switches edge ${firstSw + 1}; focus stays on its switch`, (await S.ans()).edgeOv[firstSw] === other(autoCls(s)[firstSw]) && (await S.page.evaluate(() => document.activeElement.closest('[data-edge]') && Number(document.activeElement.closest('[data-edge]').dataset.edge))) === firstSw);
      await cmp('after Enter'); await inv(S, `C (${unit}) after Enter`);
      await S.page.keyboard.press('Space'); await S.settle();
      R.check(`${V} C (${unit}) Space switches it back; focus kept`, eq((await S.ans()).edgeOv, {}) && (await S.page.evaluate(() => document.activeElement.dataset.pc)) === 'edge-switch');
      await cmp('after Space');
      // after an R5 dialog (valid plans, back 5 / sides 1 so the switch changes the size): Cancel restores, focus returns to the switch
      if (unit === 'm') { await S.page.evaluate(() => PC.store.commit((d) => { d.ans.setbacks = { front: 3, back: 5, side: 1 }; })); await seedPlans(S);
        await S.page.focus(`[data-pc="q-edges"] > li[data-edge="3"] [data-pc="edge-switch"]`); const sb = await S.state(); await S.page.keyboard.press('Enter'); await S.settle();
        const asked = await S.dialogOpen(); if (asked) { await S.page.keyboard.press('Escape'); await S.waitDialog(false); }
        R.check(`${V} C angled edge with back 5 / sides 1 and valid plans: Enter asks (size changes), Esc restores, focus back on its switch`, asked && eq(await S.state(), sb) && (await S.page.evaluate(() => document.activeElement.closest('[data-edge]') && document.activeElement.closest('[data-edge]').dataset.edge)) === '3' ? [] : [`asked ${asked}, focus ${await S.focus()}`]); }
      if (vp === PHONE && unit === 'm') await S.shot('C-edge-list');
      await S.layout(`${V} C (${unit}) edge list open`);
      await S.end(`${V} C ${unit}`);
    }
  }

  // ======================= D. Item 4 + 5: live effect, R5, clearing, invariant attack =======================
  if (want('D')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag;
    { const S = await kit(browser, vp, { max5: true });
      await S.type('q-setback-back', '5'); await S.type('q-setback-side', '1'); await sync(S, 'D back 5 / sides 1');
      const before = await S.page.evaluate(READ); await setTap(S, 'class');
      await S.tapAt(await S.edgeMid(3)); R.check(`${V} D angled edge (8.9 m) back -> side`, (await S.ans()).edgeOv[3] === 'side'); await sync(S, 'D angled edge side');
      const mid = await S.page.evaluate(READ); R.check(`${V} D the switch changes the figures (setback 5 -> 1 m along it)`, mid.sum.buildable !== before.sum.buildable ? [] : ['buildable unchanged']);
      await S.tapAt(await S.edgeMid(3)); const after = await S.page.evaluate(READ);
      R.check(`${V} D switching it back restores every figure exactly`, eq(after.sum, before.sum) && eq(after.levels, before.levels) && eq(after.rows, before.rows) ? [] : [JSON.stringify([before.sum, after.sum])]);
      await S.end(`${V} D live`); }
    // R5: equal setbacks never ask; a size-changing switch asks once, Cancel restores class and label
    { const S = await kit(browser, vp, { max5: true }); await seedPlans(S); await setTap(S, 'class'); const pr = [];
      for (let i = 1; i < 5; i++) { await S.tapAt(await S.edgeMid(i)); if (await S.dialogOpen()) { pr.push(`edge ${i + 1} asked`); await S.act('dialog-cancel'); } }
      R.check(`${V} D default setbacks (back = sides = 2 m) with valid plans: switching each edge never asks`, pr);
      await S.end(`${V} D equal`); }
    { const S = await kit(browser, vp, { max5: true }); await S.page.evaluate(() => PC.store.commit((d) => { d.ans.setbacks = { front: 3, back: 5, side: 1 }; })); await seedPlans(S); await setTap(S, 'class');
      const s0 = await S.state(), asks = (() => { const c = Q.plain(s0); c.ans.edgeOv = { 3: 'side' }; const f = (x) => { const e = streetOf(x), pL = Q.toL(x.plot.pts, e), cl = Q.edgeClasses(pL, e).map((c2, i) => (x.ans.edgeOv[i] || c2)), sb = Q.setbacksOf(cl, x.ans.setbacks), r = Q.refFootprint(pL, sb, x.ans.footprintPct, Q.latticeBuildable(pL, sb)); return r.w + 'x' + r.d; }; return f(s0) !== f(c); })();
      await S.tapAt(await S.edgeMid(3)); const open = await S.dialogOpen(), d = open ? await S.dialogText() : null;
      R.check(`${V} D back 5 / sides 1, angled edge: my model says the size ${asks ? 'changes' : 'stays'}; R5 ${asks ? 'asks once naming Ground and First' : 'does not ask'}`, open === asks && (!asks || (/Ground floor/.test(d.text) && /First floor/.test(d.text))) ? [] : [JSON.stringify(d)]);
      if (open) { await S.act('dialog-cancel'); await S.waitDialog(false); const L = await S.page.evaluate(LABELS);
        R.check(`${V} D Cancel restores the class: state identical, no "*" label, no reset notice`, eq(await S.state(), s0) && !L.labels.some((l) => /\*$/.test(l.text)) && !(await toasts(S)).some((t) => /reset/.test(t))); }
      await S.end(`${V} D R5`); }
    // clearing triggers with valid plans: at most one dialog, one notice with the right reason
    const triggers = [
      ['Q6 next', 'street edge changed', async (S) => { await S.act('q-street-next'); }],
      ['Q6 tap in Street mode', 'street edge changed', async (S) => { await setTap(S, 'street'); await S.tapAt(await S.edgeMid(1)); }],
      ['corner drag on stage 1', 'outline changed', async (S) => { await S.act('step-1'); const a = await S.page.evaluate(() => PC.debug.toScreen('plot', 20, 30)), b = await S.page.evaluate(() => PC.debug.toScreen('plot', 20, 32)); await S.dragPts(a, b); }],
      ['Undo (reopens the shape)', 'outline changed', async (S) => { await S.act('step-1'); await S.act('btn-undo'); }],
      ['Clear', 'outline changed', async (S) => { await S.act('step-1'); await S.act('btn-clear'); }],
    ];
    for (const [tname, reason, run] of triggers) {
      const S = await kit(browser, vp, { max5: true }); await seedPlans(S); await setTap(S, 'class'); await S.tapAt(await S.edgeMid(1)); await S.tapAt(await S.edgeMid(4));
      await S.page.evaluate(() => { window.__dlg = 0; new MutationObserver(() => { if (!document.querySelector('[data-pc="dialog-layer"]').hidden) window.__dlg++; }).observe(document.querySelector('[data-pc="dialog-layer"]'), { attributes: true, attributeFilter: ['hidden'] }); });
      const ov0 = (await S.ans()).edgeOv; await run(S);
      let dialogs = 0; while (await S.dialogOpen()) { dialogs++; await S.act('dialog-ok'); await S.settle(); if (dialogs > 3) break; }
      const s = await S.state(), t = (await toasts(S)).filter((x) => /reset/.test(x)), opened = await S.page.evaluate(() => window.__dlg);
      R.check(`${V} D ${tname} with 2 overrides and valid plans: overrides cleared, at most one dialog, one notice "${reason}"`, Object.keys(ov0).length === 2 && eq(s.ans.edgeOv, {}) && opened <= 1 && t.length === 1 && t[0] === `Back / side choices were reset because the ${reason}` ? [] : [`ov0 ${JSON.stringify(ov0)} now ${JSON.stringify(s.ans.edgeOv)}, dialogs ${opened}, notices ${JSON.stringify(t)}`]);
      await inv(S, `D after ${tname}`);
      await S.end(`${V} D ${tname}`);
    }
    // no notice after Load sample / Start new / Resume or a cancelled change
    { const S = await kit(browser, vp, { max5: true }); await setTap(S, 'class'); await S.tapAt(await S.edgeMid(1)); await S.flush();
      await S.reload(); if (await S.shown('btn-resume')) await S.act('btn-resume'); await S.settle();
      R.check(`${V} D Resume restores the override exactly, no notice`, eq((await S.ans()).edgeOv, { 1: other(autoCls(await S.state())[1]) }) && !(await toasts(S)).some((t) => /reset/.test(t)));
      await inv(S, 'D after Resume'); if ((await S.stages()) !== '2') await S.act('btn-next'); await sync(S, 'D after Resume');
      await S.act('step-1'); await S.act('btn-clear'); if (await S.dialogOpen()) await S.act('dialog-ok'); const tc = (await toasts(S)).filter((t) => /reset/.test(t)).length;
      await S.act('btn-sample'); if (await S.dialogOpen()) await S.act('dialog-ok'); await S.settle();
      R.check(`${V} D Load sample after Clear: no further notice, no overrides`, (await toasts(S)).filter((t) => /reset/.test(t)).length === tc && eq((await S.ans()).edgeOv, {}));
      await S.act('btn-next'); await setTap(S, 'class'); await S.tapAt(await S.edgeMid(1)); await S.flush(); await S.reload();
      await S.act('btn-startnew'); if (await S.dialogOpen()) await S.act('dialog-ok'); await S.settle();
      R.check(`${V} D Start new: defaults, no overrides, no notice`, eq((await S.ans()).edgeOv, {}) && !(await toasts(S)).some((t) => /reset/.test(t)));
      await inv(S, 'D after Start new'); await S.end(`${V} D replace`); }
  }

  // ======================= E. Item 6: overrides in the draft; Skip to 3D =======================
  if (want('E')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag, S = await kit(browser, vp, { max5: true });
    await S.act('unit-ft'); await S.act('step-1'); R.check(`${V} E unit switch keeps the sample unmodified (Skip offered)`, (await S.state()).sampleClean && await S.shown('btn-skip3d'));
    await S.act('btn-next'); await setTap(S, 'class'); await S.tapAt(await S.edgeMid(4)); const ov = (await S.ans()).edgeOv;
    await S.act('step-1'); R.check(`${V} E making an override ends the unmodified sample (Skip gone)`, !(await S.state()).sampleClean && !(await S.shown('btn-skip3d')));
    await S.act('btn-next'); await S.act('unit-m'); await S.openGroup('outdoor'); await S.openGroup('site');
    R.check(`${V} E override survives a unit switch, group changes and stage 1 and back`, eq((await S.ans()).edgeOv, ov)); await sync(S, 'E after unit, groups, stages');
    await S.flush(); const raw = JSON.parse(await S.raw()); R.check(`${V} E saved as draft v2 with the override`, raw.v === 2 && eq(raw.state.ans.edgeOv, ov));
    await S.reload(); await S.act('btn-resume'); if ((await S.stages()) !== '2') await S.act('btn-next');
    R.check(`${V} E reload + Resume restores it exactly`, eq((await S.ans()).edgeOv, ov)); await sync(S, 'E after Resume');
    await S.end(`${V} E`);
  }

  // ======================= F. Item 7: the second last-resort label pass =======================
  // Short overridden edges crowded together: every free spot of a later "*" label is taken by earlier ones, so only the
  // second pass (clear of the overlays, not of placed labels) can place it. Reached = two labels overlap (no other pass
  // allows that). Contract of that pass: every "front" / "*" label is still drawn and none lies over a floating control.
  if (want('F')) {
    const STAIR = [[0, 0], [27, 0], [27, 1], [28, 1], [28, 2], [29, 2], [29, 3], [30, 3], [30, 30], [0, 30]];
    let reached = 0;
    for (const vp of [PHONE, LAND, DESK]) for (const [pname, pts] of [['corner staircase', STAIR], ['small plot steps', [[0, 0], [9, 0], [9, 6], [8, 6], [8, 7], [7, 7], [7, 8], [6, 8], [6, 9], [0, 9]]]]) {
      const S = await kit(browser, vp, { plot: pts }); await setTap(S, 'class');
      // through the edge list (the touch targets of 1 m edges overlap; the list is the F2-S4 alternative)
      await S.act('q-edges-toggle'); const n = pts.length;
      for (let i = 1; i < n; i++) await S.act(`css:[data-pc="q-edges"] > li[data-edge="${i}"] [data-pc="edge-switch"]`);
      const s = await S.state(), L = await S.page.evaluate(LABELS), stars = L.labels.filter((l) => /\*$/.test(l.text)).length, ov = overlapPairs(L);
      if (ov) reached++;
      R.check(`${vp.tag} F ${pname}, ${n - 1} edges overridden: ${Object.keys(s.ans.edgeOv).length} overrides, "front" and every "*" label drawn, none over the control, toggle or compass (second pass ${ov ? 'reached' : 'not needed'}: ${ov} overlapping pairs)`,
        [...(Object.keys(s.ans.edgeOv).length === n - 1 ? [] : ['overrides ' + JSON.stringify(s.ans.edgeOv)]), ...(stars === n - 1 && L.labels.some((l) => l.text === 'front') ? [] : [`${stars} "*" labels for ${n - 1} overrides`]), ...labelProblems(L, { overlapsAllowed: true })]);
      if (vp === PHONE && pname === 'corner staircase') await S.shot('F-second-pass');
      await S.end(`${vp.tag} F ${pname}`);
    }
    R.check(`F the second last-resort pass is reached by these layouts (${reached} of 6)`, reached > 0 ? [] : ['never reached']);
  }

  // ======================= G. Item 8: add form =======================
  // A-16 trim (F4-T1 QA round): 640x360 removed here. Twin: tests/e2e/rooms.spec.mjs addAndEdit at 640x360 (touch; also
  // 768x1024), the twin the F3-T3 trim named for this section. G keeps 360x640 touch and 1280x800 mouse.
  if (want('G')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag, S = await kit(browser, vp, { max5: true }); await S.openGroup('rooms'); await rooms(S, 'G sample');
    R.check(`${V} G sample rooms, pairs, stair = 6.2`, sampleProblems(await S.state()));
    // level options: existing levels only
    const opts = () => S.page.evaluate(() => [...document.querySelectorAll('[data-pc="room-add-level"] option')].filter((o) => !o.disabled).map((o) => o.value));
    R.check(`${V} G level choices = existing levels (G, 1)`, eq(await opts(), ['G', '1']) ? [] : [JSON.stringify(await opts())]);
    // size hints from 4.2 in both units
    for (const [type, size] of [['kitchen', 'S'], ['majlis', 'L'], ['maid', 'M']]) for (const u of ['m', 'ft']) {
      if ((await S.ans()).unit !== u) await S.act('unit-' + u);
      await pick(S, '[data-pc="room-add-type"]', type); await S.act(lab('room-add-size', size));
      const hint = await S.text('room-add-size-hint'), w = `${size} ${({ kitchen: 'kitchen', majlis: 'majlis', maid: "maid's room" })[type]} = ${fmtArea(Q.ROOM_AREA[type][size], u)}`;
      R.check(`${V} G hint ${type} ${size} (${u}): "${w}"`, hint.toLowerCase() === w.toLowerCase() ? [] : [hint]); }
    // exact in ft: 200 sq ft -> 18.5806 m2 on the first floor
    await pick(S, '[data-pc="room-add-type"]', 'office'); await pick(S, '[data-pc="room-add-level"]', '1'); await S.act(lab('room-add-size', 'exact'));
    await S.type('room-add-area', '200'); R.check(`${V} G Enter in the exact area adds nothing and opens nothing`, (await S.ans()).rooms.length === 14 && !(await S.dialogOpen()));
    const n0 = (await S.ans()).rooms.length; await S.act('btn-room-add');
    { const a = await S.ans(), r = a.rooms[a.rooms.length - 1]; R.check(`${V} G Exact 200 sq ft office on the First floor stored as 18.5806 m²`, a.rooms.length === n0 + 1 && r.type === 'office' && r.level === '1' && r.size === null && Math.abs(r.area - 200 * Q.FT * Q.FT) < 1e-3 ? [] : [JSON.stringify(r)]); }
    await rooms(S, 'G after exact add (ft)'); await sync(S, 'G after exact add (ft)');
    // count steppers stay within 1-8
    await S.act('unit-m'); await S.act(lab('room-add-size', 'S'));
    for (let i = 0; i < 9; i++) await S.act('room-add-count-inc'); R.check(`${V} G count + stops at 8`, (await S.page.evaluate(() => document.querySelector('[data-pc="room-add-count"]').value)) === '8');
    for (let i = 0; i < 9; i++) await S.act('room-add-count-dec'); R.check(`${V} G count - stops at 1`, (await S.page.evaluate(() => document.querySelector('[data-pc="room-add-count"]').value)) === '1');
    // the First floor has 8 now (7 + office): a 9th is refused inline, nothing stored, no dialog
    { const b = await S.state(); await S.act('btn-room-add'); const P = await S.page.evaluate(ROOMS);
      R.check(`${V} G a 9th room on the First floor is refused inline, nothing stored`, eq(await S.state(), b) && /First floor already has 8 rooms/.test(P.msg) && !(await S.dialogOpen()) ? [] : [P.msg]); }
    // count 3 on the ground floor (7 rooms): refused, only 1 more fits
    await pick(S, '[data-pc="room-add-level"]', 'G'); await S.act('room-add-count-inc'); await S.act('room-add-count-inc');
    { const b = await S.state(); await S.act('btn-room-add'); const P = await S.page.evaluate(ROOMS); R.check(`${V} G 3 more on the Ground floor (7 of 8): refused, says 1 more fits, nothing stored`, eq(await S.state(), b) && /1 more fits/.test(P.msg) ? [] : [P.msg]); }
    // count adds several rooms at once, auto-named: 1 more bedroom fits on the Ground floor (7 of 8) -> "Bedroom"; then a
    // second level with room: add 2 laundries to the First floor is refused (8 of 8) — so delete one First-floor room and add 1
    await S.type('room-add-count', '1'); await S.act(lab('room-add-size', 'S')); await pick(S, '[data-pc="room-add-type"]', 'bedroom'); await pick(S, '[data-pc="room-add-level"]', 'G'); await S.act('btn-room-add');
    await rooms(S, 'G one bedroom added to the Ground floor (named by my rule)');
    { const a = await S.ans(), office = a.rooms.find((r) => r.type === 'office' && r.size === null); await S.act(roomCss(office.id, 'room-delete')); await S.act(roomCss(a.rooms.find((r) => r.type === 'office' && r.size !== null).id, 'room-delete')); }
    await pick(S, '[data-pc="room-add-type"]', 'bathroom'); await pick(S, '[data-pc="room-add-level"]', '1'); await S.type('room-add-count', '2'); await S.act('btn-room-add');
    { const a = await S.ans(); R.check(`${V} G count 2 bathrooms on the First floor (6 of 8): both added`, a.rooms.filter((r) => r.level === '1' && r.type === 'bathroom').length === 4 ? [] : [JSON.stringify(a.rooms.filter((r) => r.level === '1').map((r) => r.type))]); }
    await rooms(S, 'G count 2 added: Bathroom 1..4 numbered on the First floor'); await sync(S, 'G count 2 added');
    // a row moved to a full level is refused with a message
    { const a = await S.ans(), gr = a.rooms.find((r) => r.level === 'G'); const b = await S.state(); await pick(S, roomCss(gr.id, 'room-level').slice(4), '1');
      R.check(`${V} G moving a room to the full First floor is refused with a message, control back on its level`, eq(await S.state(), b) && /First floor already has 8 rooms/.test((await S.page.evaluate(ROOMS)).msg) ? [] : [(await S.page.evaluate(ROOMS)).msg]); await rooms(S, 'G refused level change'); }
    // bad text + Enter
    await S.act(lab('room-add-size', 'exact'));
    for (const t of ['abc', '2', '200', '']) { const b = await S.state(); await S.type('room-add-area', t); await S.act('btn-room-add'); const P = await S.page.evaluate(ROOMS);
      R.check(`${V} G exact "${t}" m²: refused with the 4-80 m² range, no dialog, nothing stored`, eq(await S.state(), b) && /4 m² to 80 m²/.test(P.msg) && !(await S.dialogOpen()) ? [] : [P.msg]); }
    await S.type('room-add-count', '9'); await S.act(lab('room-add-size', 'M')); { const b = await S.state(); await S.act('btn-room-add'); R.check(`${V} G typed count 9 refused`, eq(await S.state(), b) && /count from 1 to 8/.test((await S.page.evaluate(ROOMS)).msg)); }
    if (vp === PHONE) { await S.shot('G-rooms-sample'); }
    await S.layout(`${V} G rooms group with message`);
    await S.end(`${V} G`);
  }

  // ======================= H, I. Items 9 and 10: rows and pairs =======================
  if (want('H')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag, S = await kit(browser, vp, { max5: true }); await S.openGroup('rooms');
    const a0 = await S.ans(), bed = a0.rooms.filter((r) => r.type === 'bedroom' && r.level === '1' && !r.master);
    // type change renumbers; summary follows (sync)
    await pick(S, roomCss(bed[0].id, 'room-type').slice(4), 'office'); await rooms(S, 'H bedroom -> office'); await sync(S, 'H bedroom -> office');
    await pick(S, roomCss(bed[0].id, 'room-type').slice(4), 'bedroom'); await rooms(S, 'H back to bedroom');
    // size and exact area; summary needed follows
    await pick(S, roomCss(bed[0].id, 'room-size').slice(4), 'L'); await rooms(S, 'H size L'); await sync(S, 'H size L');
    await pick(S, roomCss(bed[0].id, 'room-size').slice(4), 'exact'); await rooms(S, 'H exact (keeps 24 m²)');
    R.check(`${V} H switching to Exact keeps the area (24 m²)`, (await S.ans()).rooms.find((r) => r.id === bed[0].id).area === 24);
    await S.type(roomCss(bed[0].id, 'room-area'), '30'); R.check(`${V} H exact 30 m² stored`, (await S.ans()).rooms.find((r) => r.id === bed[0].id).area === 30); await sync(S, 'H exact 30');
    // focus survives an edit
    await S.page.focus(roomCss(bed[1].id, 'room-size').slice(4)); await pick(S, roomCss(bed[1].id, 'room-size').slice(4), 'S');
    R.check(`${V} H focus stays on the edited control`, (await S.page.evaluate((id) => { const a = document.activeElement; return a && a.dataset.pc === 'room-size' && a.closest('[data-room]').dataset.room === id; }, bed[1].id)));
    // ghost invalid entries: invalid exact, then (a) S/M/L, (b) delete
    await pick(S, roomCss(bed[0].id, 'room-size').slice(4), 'exact'); await S.type(roomCss(bed[0].id, 'room-area'), 'x');
    R.check(`${V} H invalid exact area: field-invalid row`, (await S.page.evaluate(READ)).rows.some((r) => r.code === 'field-invalid'));
    await pick(S, roomCss(bed[0].id, 'room-size').slice(4), 'M'); R.check(`${V} H size back to M clears the invalid entry and its row`, !(await S.page.evaluate(READ)).rows.some((r) => r.code === 'field-invalid') && !(await S.page.evaluate(ROOMS)).invalid.length);
    await pick(S, roomCss(bed[0].id, 'room-size').slice(4), 'exact'); await S.type(roomCss(bed[0].id, 'room-area'), '999'); await S.act(roomCss(bed[0].id, 'room-delete'));
    R.check(`${V} H deleting the room with an invalid area leaves no ghost conflict`, !(await S.page.evaluate(READ)).rows.some((r) => r.code === 'field-invalid') && !(await S.ans()).rooms.some((r) => r.id === bed[0].id));
    await rooms(S, 'H after delete'); await sync(S, 'H after delete');
    // one master per house
    const b2 = (await S.ans()).rooms.find((r) => r.type === 'bedroom' && !r.master); await S.act(roomCss(b2.id, 'room-master'));
    { const a = await S.ans(); R.check(`${V} H marking another bedroom master moves the mark (one per house)`, a.rooms.filter((r) => r.master).length === 1 && a.rooms.find((r) => r.id === b2.id).master); }
    await rooms(S, 'H master moved');
    // ---- pairs (item 10)
    const a1 = await S.ans(), g = a1.rooms.filter((r) => r.level === 'G'), f1 = a1.rooms.filter((r) => r.level === '1');
    await pick(S, '[data-pc="pair-a"]', g[0].id);
    const bOpts = await S.page.evaluate(() => [...document.querySelectorAll('[data-pc="pair-b"] option')].map((o) => o.value).filter(Boolean));
    R.check(`${V} I B lists only the other rooms of the same floor`, eq(bOpts.sort(), g.slice(1).map((r) => r.id).sort()) ? [] : [JSON.stringify(bOpts)]);
    // duplicate (the sample's kitchen + dining)
    const kit2 = g.find((r) => r.type === 'kitchen'), din = g.find((r) => r.type === 'dining'); await pick(S, '[data-pc="pair-a"]', din.id); await pick(S, '[data-pc="pair-b"]', kit2.id);
    { const b = await S.state(); await S.act('btn-pair-add'); R.check(`${V} I a duplicate pair is ignored with its message`, eq((await S.state()).ans.pairs, b.ans.pairs) && /already exists/.test((await S.page.evaluate(ROOMS)).pmsg)); }
    // fill the ground floor to 6 pairs, then the 7th is refused
    let added = (await S.ans()).pairs.filter((p) => g.some((r) => r.id === p[0])).length; const gIds = g.map((r) => r.id);
    outer: for (let i = 0; i < gIds.length; i++) for (let j = i + 1; j < gIds.length; j++) { if (added >= 6) break outer; const a = await S.ans(); if (a.pairs.some((p) => (p[0] === gIds[i] && p[1] === gIds[j]) || (p[0] === gIds[j] && p[1] === gIds[i]))) continue; await pick(S, '[data-pc="pair-a"]', gIds[i]); await pick(S, '[data-pc="pair-b"]', gIds[j]); await S.act('btn-pair-add'); added++; }
    await rooms(S, 'I six ground-floor pairs');
    { let pa = null; for (let i = 0; i < gIds.length && !pa; i++) for (let j = i + 1; j < gIds.length && !pa; j++) if (!(await S.ans()).pairs.some((p) => p.includes(gIds[i]) && p.includes(gIds[j]))) pa = [gIds[i], gIds[j]];
      await pick(S, '[data-pc="pair-a"]', pa[0]); await pick(S, '[data-pc="pair-b"]', pa[1]); const b = await S.state(); await S.act('btn-pair-add');
      R.check(`${V} I a 7th pair on the Ground floor is refused with its message`, eq(await S.state(), b) && /already has 6 pairs/.test((await S.page.evaluate(ROOMS)).pmsg) ? [] : [(await S.page.evaluate(ROOMS)).pmsg]); }
    if (vp === PHONE) { await S.page.evaluate(() => document.querySelector('[data-q="13"]').scrollIntoView()); await S.shot('I-pairs'); }
    // a level change drops that room's pairs with the message; deleting a room removes its pairs
    const withPair = (await S.ans()).pairs.find((p) => gIds.includes(p[0]))[0];
    await pick(S, roomCss(withPair, 'room-level').slice(4), '1');
    { const a = await S.ans(), P = await S.page.evaluate(ROOMS); R.check(`${V} H a level change drops the room's pairs and says so`, !a.pairs.some((p) => p.includes(withPair)) && P.msg === 'Its pairs were removed.' ? [] : [P.msg, JSON.stringify(a.pairs)]); }
    const another = (await S.ans()).pairs[0][0]; await S.act(roomCss(another, 'room-delete'));
    R.check(`${V} I deleting a room removes its pairs`, !(await S.ans()).pairs.some((p) => p.includes(another)));
    await rooms(S, 'I end'); await sync(S, 'I end');
    await S.end(`${V} H/I`);
  }

  // ======================= J. Item 11: Q14 through R5; "single level" note =======================
  if (want('J')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag, S = await kit(browser, vp, { max5: true }); await seedPlans(S); await S.openGroup('rooms');
    const vals = await S.page.evaluate(() => [...document.querySelectorAll('[data-pc="q-stair-pos"] input')].map((i) => i.value));
    R.check(`${V} J exactly five stair positions`, eq(vals.sort(), ['bl', 'br', 'centre', 'fl', 'fr']) ? [] : [JSON.stringify(vals)]);
    const s0 = await S.state(); await S.act(lab('q-stair-pos', 'bl')); const asked = await S.dialogOpen(); if (asked) { await S.act('dialog-cancel'); await S.waitDialog(false); }
    R.check(`${V} J a stair position change with valid plans asks (R5); Cancel restores it`, asked && eq(await S.state(), s0) && (await S.page.evaluate(() => document.querySelector('[data-pc="q-stair-pos"] input:checked').value)) === 'centre');
    await S.act('q-lift'); const asked2 = await S.dialogOpen(); if (asked2) { await S.act('dialog-ok'); await S.waitDialog(false); }
    R.check(`${V} J lift asks too; Continue stores it`, asked2 && (await S.ans()).lift === true);
    await S.act(lab('q-stair-pos', 'fr')); R.check(`${V} J later in the same visit: no question, stored`, !(await S.dialogOpen()) && (await S.ans()).stairPos === 'fr');
    const note = async () => [await S.shown('q-stairs-box'), await S.shown('q-stairs-none')];
    R.check(`${V} J two floors: stair controls shown`, eq(await note(), [true, false]));
    await S.end(`${V} J gate`);
    // single-level rule on a house without rooms on removed levels
    const T = await kit(browser, vp, { plot: rect(20, 20), ans: { rooms: [{ id: 'r1', type: 'living', level: 'G', size: 'M', area: null, master: false }], nextRoomId: 2 } }); await T.openGroup('building');
    const n2 = async () => [await T.shown('q-stairs-box'), await T.shown('q-stairs-none')];
    const steps = [['1 floor', () => T.act(lab('q-floors', '1')), true], ['+ basement', () => T.act('q-basement'), false], ['- basement', () => T.act('q-basement'), true], ['+ usable roof', () => T.act('q-usable-roof'), false], ['- usable roof', () => T.act('q-usable-roof'), true], ['2 floors', () => T.act(lab('q-floors', '2')), false]];
    for (const [nm, act, single] of steps) { await act(); if (await T.dialogOpen()) await T.act('dialog-ok'); await T.openGroup('rooms'); const st = Q.stairsExist((await T.ans())); R.check(`${V} J ${nm}: "single level" note ${single ? 'shown' : 'hidden'} (my rule: stairs ${st})`, st === !single && eq(await n2(), single ? [false, true] : [true, false]) ? [] : [JSON.stringify(await n2())]); await T.openGroup('building'); }
    await T.end(`${V} J single`);
  }

  // ======================= K. Item 12: removing a level with rooms =======================
  // A-16 trim (F4-T1 QA round): 640x360 removed here. Twin: tests/e2e/rooms.spec.mjs stairsAndLevels at 640x360 (touch;
  // also 768x1024: the three-way level-removal dialog), as named by the F3-T3 trim. K keeps 360x640 and 1280x800.
  if (want('K')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag;
    // (1) move allowed: 3 floors, 2 rooms on the second floor, ground and first have 7 -> nearest is First (7 + 2 > 8: refused) ... build a case
    { const S = await kit(browser, vp, { max5: true, plot: rect(20, 30), ans: { floors: 3, rooms: [{ id: 'r1', type: 'living', level: 'G', size: 'M', area: null, master: false }, { id: 'r2', type: 'bedroom', level: '1', size: 'M', area: null, master: false }, { id: 'r3', type: 'bedroom', level: '2', size: 'S', area: null, master: false }, { id: 'r4', type: 'bathroom', level: '2', size: 'S', area: null, master: false }], pairs: [['r3', 'r4']], nextRoomId: 5 } });
      await S.openGroup('building'); await S.act(lab('q-floors', '2')); await S.waitDialog(); let d = await S.dialogText();
      R.check(`${V} K 3 -> 2 floors, 2 rooms on the Second floor, no plans: move offered (1 + 2 <= 8) and chosen, the empty plans paragraph hidden`, d.title === 'Remove Second floor?' && /The Second floor has 2 rooms\./.test(d.rooms) && /First floor/.test(d.rooms) && d.move && !d.move.disabled && d.move.checked && (await S.page.evaluate(() => { const t = document.querySelector('[data-pc="dialog-layer"] [data-pc="dialog-text"]'); return t.hidden || getComputedStyle(t).display === 'none' || !t.getBoundingClientRect().height; })) ? [] : [JSON.stringify(d)]);
      if (vp === PHONE) await S.shot('K-remove-level-dialog');
      await S.layout(`${V} K remove-level dialog`, { dialog: true });
      await S.act('dialog-cancel'); await S.waitDialog(false); R.check(`${V} K Cancel keeps the Second floor`, (await S.ans()).floors === 3 && (await S.page.evaluate(() => document.querySelector('[data-pc="q-floors"] input:checked').value)) === '3');
      await S.act(lab('q-floors', '2')); await S.waitDialog(); await S.act('dialog-ok'); await S.waitDialog(false); await S.settle();
      { const a = await S.ans(), second = await S.until(() => S.dialogOpen(), 600); R.check(`${V} K Remove with Move: rooms r3, r4 now on the First floor, their pair kept, one dialog`, a.floors === 2 && a.rooms.filter((r) => ['r3', 'r4'].includes(r.id)).every((r) => r.level === '1') && a.pairs.some((p) => p.includes('r3') && p.includes('r4')) && !second ? [] : [JSON.stringify(a.rooms)]); }
      await S.openGroup('rooms'); await rooms(S, 'K after move'); await inv(S, 'K after move'); await S.end(`${V} K move`); }
    // (2) move refused by the 6-pair limit: plans named per choice
    { const rms = [], prs = []; for (let i = 1; i <= 4; i++) rms.push({ id: 'r' + i, type: 'storage', level: '1', size: 'S', area: null, master: false }); for (let i = 5; i <= 8; i++) rms.push({ id: 'r' + i, type: 'storage', level: '2', size: 'S', area: null, master: false });
      prs.push(['r1', 'r2'], ['r1', 'r3'], ['r1', 'r4'], ['r2', 'r3'], ['r2', 'r4'], ['r5', 'r6']); rms.push({ id: 'r9', type: 'living', level: 'G', size: 'M', area: null, master: false });
      const S = await kit(browser, vp, { max5: true, plot: rect(20, 30), ans: { floors: 3, rooms: rms, pairs: prs, nextRoomId: 10 } }); await seedPlans(S);
      await S.openGroup('building'); await S.act(lab('q-floors', '2')); await S.waitDialog(); const d = await S.dialogText();
      R.check(`${V} K 3 -> 2 floors, the First floor already has 5 pairs and the Second floor brings 1 (my count 6 ... ) : dialog shown with the plans named`, !!d.rooms && /Second floor/.test(d.text) ? [] : [JSON.stringify(d)]);
      // my expectation of "move": 4 + 4 rooms = 8 fits; 5 + 1 pairs = 6 fits -> allowed. Delete names the Second floor plan as lost; both name the Second floor.
      R.check(`${V} K move possible here by my count (8 rooms, 6 pairs): enabled`, d.move && !d.move.disabled ? [] : [JSON.stringify(d)]);
      // plans per choice (valid plans on G, 1, 2): Move changes the First floor's rooms and loses the Second floor's plan;
      // Delete only loses the Second floor's plan (two floors keep their stairs, G and 1 unchanged)
      R.check(`${V} K Move chosen: the plans sentence names the First and the Second floor`, /First floor/.test(d.text) && /Second floor/.test(d.text) && !/Ground floor/.test(d.text) ? [] : [d.text]);
      await S.act('css:[data-pc="dialog-layer"] label:has([data-pc="level-remove-delete"])'); const dd = await S.dialogText();
      R.check(`${V} K Delete chosen: the plans sentence names only the Second floor (lost)`, /Second floor/.test(dd.text) && !/First floor|Ground floor/.test(dd.text) && /lost/.test(dd.text) ? [] : [dd.text]);
      await S.act('dialog-cancel'); await S.waitDialog(false);
      // one more pair on the first floor makes 7 after a move: refused with the pairs reason
      await S.page.evaluate(() => PC.store.commit((s) => { s.ans.pairs.push(['r3', 'r4']); }));
      await S.act(lab('q-floors', '2')); await S.waitDialog(); const d2 = await S.dialogText();
      R.check(`${V} K with 6 pairs on the First floor and 1 coming: move disabled, reason "more than 6 pairs", Delete chosen`, d2.move && d2.move.disabled && d2.del.checked && /cannot be moved/.test(d2.rooms) && /more than 6 pairs/.test(d2.rooms) ? [] : [JSON.stringify(d2)]);
      await S.act('dialog-ok'); await S.waitDialog(false); await S.settle();
      { const a = await S.ans(); await S.flush(); const raw = JSON.parse(await S.raw()); R.check(`${V} K Remove with Delete: Second floor rooms and their pair gone, draft valid (v2, saved)`, a.floors === 2 && !a.rooms.some((r) => r.level === '2') && !a.pairs.some((p) => ['r5', 'r6'].some((x) => p.includes(x))) && raw.v === 2 && raw.state.ans.floors === 2); }
      await inv(S, 'K after delete'); await S.end(`${V} K pairs`); }
  }

  // ======================= L. Item 13: room conflicts, Fix, live clearing =======================
  if (want('L')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag, S = await kit(browser, vp, { max5: true });
    await S.openGroup('building'); await S.act(lab('q-floors', '3'));
    await sync(S, 'L 3 floors, Second floor empty');
    { const rows = (await S.page.evaluate(READ)).rows; R.check(`${V} L 3 floors: "Second floor has no rooms" blocks (Q11)`, rows.some((r) => r.code === 'floor-empty' && r.q === '11' && /^Second floor has no rooms/.test(r.text)) ? [] : [JSON.stringify(rows)]); }
    if (vp.touch) await S.act('summary-toggle');
    await S.act('css:[data-pc="conflict-list"] > li[data-code="floor-empty"] [data-pc="conflict-goto"]');
    { const g = await S.page.evaluate(() => ({ f: document.activeElement.dataset.pc, lv: document.querySelector('[data-pc="room-add-level"]').value })); R.check(`${V} L Fix on an empty Second floor: Rooms group, the add form set to the Second floor and focused`, (await S.group()) === 'rooms' && g.f === 'room-add-type' && g.lv === '2' ? [] : [JSON.stringify(g)]); }
    await S.act('btn-room-add'); { const rows = (await S.page.evaluate(READ)).rows; R.check(`${V} L adding a room there clears the conflict live`, !rows.some((r) => r.code === 'floor-empty')); }
    await rooms(S, 'L after add'); await sync(S, 'L after add');
    // level-over: make the ground floor need more than the footprint (an exact 80 m² room), both numbers, both units
    const g0 = (await S.ans()).rooms.find((r) => r.level === 'G'); await pick(S, roomCss(g0.id, 'room-size').slice(4), 'exact'); await S.type(roomCss(g0.id, 'room-area'), '80');
    for (const u of ['m', 'ft']) { if (u === 'ft') await S.act('unit-ft'); const s = await S.state(), ex = expectFor(s, (await S.page.evaluate(READ)).app || {}), need = Q.needed(s.ans, 'G'), rows = (await S.page.evaluate(READ)).rows;
      R.check(`${V} L level-over (${u}): "Ground floor: needs ${fmtArea(need, u)}, ${fmtArea(ex.fp.area, u)} available"`, rows.some((r) => r.code === 'level-over' && r.text.startsWith(`Ground floor: needs ${fmtArea(need, u)}, ${fmtArea(ex.fp.area, u)} available`)) ? [] : [JSON.stringify(rows)]); await sync(S, `L level-over ${u}`); }
    if (vp.touch) await S.act('summary-toggle');
    await S.act('css:[data-pc="conflict-list"] > li[data-code="level-over"] [data-pc="conflict-goto"]');
    { const g = await S.page.evaluate(() => { const a = document.activeElement, li = a && a.closest('[data-level]'); return { f: a.dataset.pc, lv: li && li.dataset.level }; }); R.check(`${V} L Fix on level-over: the Ground floor's first row control focused`, g.lv === 'G' && g.f === 'room-type' ? [] : [JSON.stringify(g)]); }
    await S.act('unit-m'); await S.type(roomCss(g0.id, 'room-area'), '20'); R.check(`${V} L shrinking the room clears level-over live`, !(await S.page.evaluate(READ)).rows.some((r) => r.code === 'level-over'));
    await S.openGroup('building'); await S.act('q-basement');
    if (vp.touch) await S.act('summary-toggle');
    await S.act('css:[data-pc="conflict-list"] > li[data-code="basement-empty"] [data-pc="conflict-goto"]');
    R.check(`${V} L Fix on basement-empty lands on the add form set to the Basement`, (await S.page.evaluate(() => [document.activeElement.dataset.pc, document.querySelector('[data-pc="room-add-level"]').value])).join() === 'room-add-type,B');
    await S.act('btn-room-add'); R.check(`${V} L a basement room clears it live`, !(await S.page.evaluate(READ)).rows.some((r) => r.code === 'basement-empty'));
    await rooms(S, 'L end'); await S.end(`${V} L`);
  }

  // ======================= M. Item 15: layout at every viewport; screenshots =======================
  if (want('M')) for (const vp of [PHONE, LAND, TAB, DESK]) {
    const V = vp.tag;
    { const S = await kit(browser, vp, { plot: rect(20, 30), ans: { rooms: [], pairs: [] } }); await S.openGroup('rooms'); await S.layout(`${V} M rooms empty`); await S.shot('M-rooms-empty'); await S.end(`${V} M empty`); }
    // A-16 trim (F4-T1 QA round): the room-row "names and areas not cut off (m, ft; master bedroom at 80 m²)" block is
    // removed here. Twin: tests/e2e/rooms-fit.spec.mjs at 360x640, 640x360, 768x1024, 1280x800 (and 360x740) in m and ft
    // with the same content (master bedroom at an exact 80 m² = 861 sq ft) and stricter checks (one line each, inside the
    // row, head no taller than 44 px).
    { const S = await kit(browser, vp); await S.openGroup('rooms'); await S.layout(`${V} M rooms sample`); await S.shot('M-rooms-sample');
      await S.page.evaluate(() => PC.store.commit((s) => { const have = s.ans.rooms.filter((r) => r.level === 'G').length; for (let i = have; i < 8; i++) s.ans.rooms.push({ id: 'r' + (s.ans.nextRoomId + i - have), type: 'storage', level: 'G', size: 'S', area: null, master: false }); s.ans.nextRoomId += 8 - have; }));
      await S.settle(); await rooms(S, 'M full level'); await S.layout(`${V} M rooms full level`); await S.shot('M-rooms-full'); await S.end(`${V} M sample`); }
    for (const [pname, plot] of [['sample', null], ['thin', rect(10, 50)], ['12-vertex', COMB]]) for (const u of ['m', 'ft']) {
      const S = await kit(browser, vp, plot ? { plot } : {}); if (u === 'ft') await S.act('unit-ft');
      await S.layout(`${V} M ${pname} street mode (${u})`); await S.shot(`M-${pname}-street-${u}`);
      await setTap(S, 'class'); await S.tapAt(await S.edgeMid(1)); await S.layout(`${V} M ${pname} class mode with an override (${u})`); await S.shot(`M-${pname}-class-${u}`);
      R.check(`${V} M ${pname} (${u}): labels clear of the control, toggle and compass`, labelProblems(await S.page.evaluate(LABELS), { overlapsAllowed: pname === '12-vertex' }));
      await S.end(`${V} M ${pname} ${u}`);
    }
  }
} finally { await browser.close(); }
R.note(`runtime ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(R.done() ? 0 : 1);
