// F3-T1 QA (browser): stage 3 (tabs, counter, plan drawing, labels, tap readouts, warnings, no-layout banner and its
// link, Regenerate, Fit view, scale), plan sync and R5 as the user meets them (PM round 5: only edited or approved
// plans are asked about). Real input; expectations from QA's own reading (names, areas, units, A-7, PM round 5).
// Run: node tests/qa/f3-t1-stage3.mjs [--no-shots] [--only=A,B,...]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VIEWPORTS, launch, collector } from './lib.mjs';
import { sessions, eq, sampleProblems } from './session.mjs';
import * as Q from './f2-t1-ref.mjs';
import { LEVEL, lab, fmtArea, stage2Kit } from './stage2kit.mjs';

const SHOTS = join(ROOT, 'tests/qa/shots/F3-T1'); mkdirSync(SHOTS, { recursive: true });
const noShots = process.argv.includes('--no-shots');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (sec) => (!only.length || only.includes(sec)) && (!RELONLY || ['A', 'B', 'C'].includes(sec));
// TL ruling (F6-T1c run-time debt, before the next feature's first gate): A, B and C at 640x360 / 768x1024 run in the release step only
// (QA_RELEASE=1; f6-t1-leak.mjs --stream-only runs this file with --release-only, which runs just those).
const REL = !!process.env.QA_RELEASE, RELONLY = process.argv.includes('--release-only');
const VS = (...vs) => vs.filter((v) => { const x = v === LAND || v === TAB; return RELONLY ? x : REL || !x; });
const R = collector('F3-T1 stage 3');
// Open minor bugs (docs/03-tasks/F3-T1/qa-report.md): listed as KNOWN, do not fail the run. Remove an entry when fixed.

const session = sessions({ R, shots: SHOTS, noShots });
const { kit } = stage2Kit({ R, session });
const VP = Object.fromEntries(VIEWPORTS.map((v) => [v.tag, v]));
const PHONE = VP['360x640'], LAND = VP['640x360'], TAB = VP['768x1024'], DESK = VP['1280x800'];
const NAMES = { bedroom: 'Bedroom', bathroom: 'Bathroom', kitchen: 'Kitchen', living: 'Living', dining: 'Dining', majlis: 'Majlis', office: 'Office', maid: "Maid's room", storage: 'Storage', laundry: 'Laundry' };
function myNames(a) { const out = {}, num = (id) => parseInt(id.slice(1), 10);
  for (const lv of Q.levelIds(a)) { const g = {}; for (const r of a.rooms.filter((x) => x.level === lv).sort((p, q) => num(p.id) - num(q.id))) { if (r.master) { out[r.id] = 'Master bedroom'; continue; } (g[r.type] = g[r.type] || []).push(r); }
    for (const t in g) g[t].forEach((r, i) => { out[r.id] = NAMES[t] + (g[t].length > 1 ? ' ' + (i + 1) : ''); }); }
  return out; }
// a short label is an abbreviation of the name: its letters appear in order in the name, its number equals the name's
// (F3-T2 tiers: short "Bed 2" and tiny "B2" / "Ba"; one letter allowed for tiny forms)
const isShort = (text, name) => { const n1 = (text.match(/\s?(\d+)$/) || [])[1], n2 = (name.match(/ (\d+)$/) || [])[1]; if (n1 !== n2) return false; const t = text.replace(/\s?\d+$/, '').replace(/[^a-z]/gi, '').toLowerCase(), s = name.toLowerCase(); let k = 0; for (const ch of s) if (ch === t[k]) k++; return t.length >= 1 && k === t.length && s[0] === t[0]; };
const tierOf = (text, name) => (text === name ? 'full' : text.replace(/\s?\d+$/, ''));   // abbreviation letters identify short vs tiny
const PLAN = () => { const s = PC.debug.state(), v = PC.debug.planView(), site = PC.debug.site(), c = document.querySelector('[data-pc="plan-canvas"]').getBoundingClientRect();
  const fp = site && site.footprint, toC = (u, w) => { const p = PC.debug.toScreen('plan', u, w); return [p[0] - c.left, p[1] - c.top]; };
  const rect = (r) => { const a = toC(fp.u + r.x, fp.v + r.y), b = toC(fp.u + r.x + r.w, fp.v + r.y + r.h); return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) }; };
  const p = s.plans[v.level], core = fp ? PC.layout.core(fp.w, fp.d, PC.levels.stairsExist(s), s.ans.stairPos, PC.levels.liftExists(s)) : {};
  const q = (h) => document.querySelector(`[data-pc="${h}"]`), t = (h) => q(h).textContent.trim().replace(/\s+/g, ' ');
  return { state: JSON.parse(JSON.stringify(s)), view: v, labels: PC.debug.planLabels(), rooms: p && !p.error ? p.rooms.map((r) => ({ ...r, scr: rect(r) })) : [], core: ['stair', 'lift'].filter((k) => core[k]).map((k) => ({ k, scr: rect(core[k]) })),
    tabs: [...q('plan-tabs').querySelectorAll('[data-level]')].map((b) => ({ id: b.dataset.level, name: b.querySelector('[data-pc="tab-name"]').textContent, st: b.querySelector('[data-pc="tab-state"]').textContent, sel: b.getAttribute('aria-selected') })),
    table: PC.data.roomLabels || null, counter: t('plan-counter'), counterShown: (() => { const r = q('plan-counter').getBoundingClientRect(), cs = getComputedStyle(q('plan-counter')); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && !q('plan-counter').closest('[hidden]'); })(), editor: PC.stages.MAX_BUILT >= 5, approve: q('btn-approve').disabled || q('btn-approve').getAttribute('aria-disabled') === 'true', msg: t('plan-msg'), msgKind: q('plan-msg').dataset.kind, err: !q('plan-error').hidden, errText: t('plan-error-text'), warn: [...q('plan-warn-list').children].map((li) => li.textContent.trim().replace(/\s+/g, ' ')),
    sel: [t('plan-room-name'), t('plan-room-dims'), t('plan-room-area')], banners: [...document.querySelectorAll('[data-pc="banner-slot"] [data-pc="banner-text"]')].map((x) => x.textContent) }; };

// Everything stage 3 shows against the state and QA's expectations.
async function stage3Problems(S) {
  const P = await S.page.evaluate(PLAN), s = P.state, a = s.ans, u = a.unit, names = myNames(a), f = [], ids = Q.levelIds(a);
  if (!eq(P.tabs.map((x) => x.id), ids) || !eq(P.tabs.map((x) => x.name), ids.map((id) => LEVEL[id]))) f.push(`tabs ${JSON.stringify(P.tabs.map((x) => x.name))} vs levels ${ids.map((id) => LEVEL[id])}`);
  for (const tb of P.tabs) { const p = s.plans[tb.id], w = !p ? '' : p.error ? 'Cannot be laid out' : p.approved ? 'Approved' : 'Draft'; if (tb.st !== w) f.push(`tab ${tb.id} state "${tb.st}" vs ${w}`); if ((tb.sel === 'true') !== (tb.id === P.view.level)) f.push(`tab ${tb.id} aria-selected ${tb.sel}`); }
  const n = ids.filter((id) => s.plans[id] && s.plans[id].approved).length; if (P.counter !== `${n} of ${ids.length} floor${ids.length === 1 ? '' : 's'} approved`) f.push(`counter "${P.counter}"`);
  if (!P.editor) { if (!P.approve || !/plan editing/.test(P.msg)) f.push(`Approve disabled=${P.approve}, message "${P.msg}"`); }
  else { // F3-T2: a valid plan can be approved; the message is the default hint (or the approval / back-to-Draft notes)
    const p0 = s.plans[P.view.level]; if (p0 && !p0.error && !p0.approved && P.approve) f.push('Approve not available on a valid plan');
    if (/next build/.test(P.msg)) f.push(`F3-T1 message still shown: "${P.msg}"`);
    if (p0 && !p0.error && !p0.approved && !/^Drag a room/.test(P.msg) && !/back to Draft|approved/.test(P.msg)) f.push(`message "${P.msg}" is not the default hint`);
    if (!P.counterShown) f.push('counter not visible (it stays as one compact line on phones)'); }
  if (P.banners.length) f.push('static banner on stage 3: ' + P.banners);
  for (const id of ids) { const p = s.plans[id]; if (!p) f.push(`${id}: no plan`); else if (p.sig !== await S.page.evaluate((id) => PC.sig.level(PC.debug.state(), id), id)) f.push(`${id}: stale plan shown`); }
  const p = s.plans[P.view.level];
  if (p && p.error) { if (!P.err || !/fewer or smaller rooms/.test(P.errText) || !/stair position/.test(P.errText) || !/larger footprint/.test(P.errText)) f.push(`no-layout banner ${P.err} "${P.errText}"`); if (P.rooms.length) f.push('rooms drawn for a no-layout level'); }
  else if (P.err) f.push('no-layout banner on a laid-out level');
  // labels: each names a room it lies in (full name, short form or area in the current unit), or Stairs / Lift in the core
  for (const l of P.labels) { const cx = l.x + l.w / 2, cy = l.y + l.h / 2, inR = (r) => cx >= r.x0 - 1 && cx <= r.x1 + 1 && cy >= r.y0 - 1 && cy <= r.y1 + 1;
    const room = P.rooms.find((r) => inR(r.scr)), core = P.core.find((c) => inR(c.scr));
    const coreForms = (k) => (P.table && P.table[k] ? [P.table[k].full, P.table[k].short, P.table[k].tiny] : [k === 'stair' ? 'Stairs' : 'Lift']);
    if (core && coreForms(core.k).includes(l.text)) continue;
    if (!room) { f.push(`label "${l.text}" not inside a room`); continue; }
    const nm = names[room.id], ar = fmtArea(room.w * room.h, u);
    if (!(l.text === nm || l.text === ar || isShort(l.text, nm))) f.push(`label "${l.text}" inside ${room.id} (${nm}, ${ar})`); }
  // F3-T2: each type on the level (master with the bedrooms) is drawn at one tier; the area line for all of a type or none
  if (P.editor) { const by = {}, roomOf = (l) => P.rooms.find((r) => { const cx = l.x + l.w / 2, cy = l.y + l.h / 2; return cx >= r.scr.x0 - 1 && cx <= r.scr.x1 + 1 && cy >= r.scr.y0 - 1 && cy <= r.scr.y1 + 1; });
    for (const l of P.labels) { const rm = roomOf(l); if (!rm) continue; const room = a.rooms.find((x) => x.id === rm.id); if (!room) continue; const tp = room.type, nm = names[rm.id], ar = fmtArea(rm.w * rm.h, u);
      const e = (by[tp] = by[tp] || { tiers: new Set(), area: new Set(), rooms: new Set() }); e.rooms.add(rm.id); if (l.text === ar) e.area.add(rm.id); else e.tiers.add(tierOf(l.text, nm)); }
    // tier of an abbreviation from the Designer's table (PC.data.roomLabels): the master's forms count as bedroom forms
    const tierName = (tp, x) => { if (x === 'full') return 'full'; const T = P.table || {}; for (const k of tp === 'bedroom' ? ['bedroom', 'master'] : [tp]) { if (T[k] && x === T[k].short) return 'short'; if (T[k] && x === T[k].tiny) return 'tiny'; } return 'unknown ' + x; };
    for (const [tp, e] of Object.entries(by)) { const kinds = new Set([...e.tiers].map((x) => tierName(tp, x))); if ([...kinds].some((k) => k.startsWith('unknown'))) f.push(`${tp}: label form not in PC.data.roomLabels: ${[...kinds]}`); if (kinds.size > 1) f.push(`${tp} labels drawn at mixed tiers ${[...kinds]}`); if (e.area.size && e.area.size !== e.rooms.size) f.push(`${tp}: area line on ${e.area.size} of ${e.rooms.size} labelled rooms`); } }
  // warnings: unmet pairs of this level, then the F2 warnings
  if (p && !p.error) { const w = p.unmet.map((q) => `${names[q[0]]} and ${names[q[1]]} are not next to each other.`); const pw = P.warn.filter((x) => !/has no way in from the hall or stairs/.test(x)); /* F4-T2 CD-5 access lines (none on the sample, 6.2) are checked in their own suite */ if (!eq(pw.slice(0, w.length), w)) f.push(`unmet warnings ${JSON.stringify(P.warn)} vs ${JSON.stringify(w)}`); }
  return f;
}
const check3 = async (S, label) => { await S.settle(); R.check(`${S.vp.tag} ${label}: stage 3 shows the state (tabs, counter, plan, labels, warnings)`, await stage3Problems(S)); };
const toStage3 = async (S) => { if ((await S.stages()) !== '3') { await S.act('btn-next'); await S.until(() => S.page.evaluate(() => !document.querySelector('[data-stage="3"]').hidden), 3000); } await S.settle(); };
const tapRoom = async (S, id) => { const P = await S.page.evaluate(PLAN), r = P.rooms.find((x) => x.id === id), c = await S.page.evaluate(() => { const b = document.querySelector('[data-pc="plan-canvas"]').getBoundingClientRect(); return [b.left, b.top]; }); await S.tapAt([c[0] + (r.scr.x0 + r.scr.x1) / 2, c[1] + (r.scr.y0 + r.scr.y1) / 2]); };
const selTab = async (S, id) => S.act(`css:[data-pc="plan-tabs"] [data-level="${id}"]`);
const MAXHOUSE = (s) => { s.ans.basement = true; s.ans.floors = 3; s.ans.footprintPct = 50; s.ans.lift = true; let id = s.ans.nextRoomId; const T = ['bedroom', 'bathroom', 'office', 'storage', 'laundry', 'maid'];
  for (const lv of ['B', '2', 'G', '1']) { let k = 0; while (s.ans.rooms.filter((r) => r.level === lv).length < (PC.C.MAX_ROOMS_PER_LEVEL || 8)) s.ans.rooms.push({ id: 'r' + id++, type: T[k++ % T.length], level: lv, size: 'S', area: null, master: false }); } s.ans.nextRoomId = id; s.plans = {}; };

const browser = await launch();
const t0 = Date.now();
try {
  // ======================= A. sample on stage 3 at every viewport (focus items 3, 4) =======================
  if (want('A')) for (const vp of VS(PHONE, LAND, TAB, DESK)) {
    const V = vp.tag, S = await kit(browser, vp, { keepPlans: true });
    // Load sample produced one Draft plan per level; untouched Drafts never ask (PM round 5)
    { const s = await S.state(); R.check(`${V} A Load sample: Ground and First laid out as Drafts`, ['G', '1'].every((id) => s.plans[id] && !s.plans[id].error && !s.plans[id].approved && !s.plans[id].edited) && sampleProblems(s).length === 0); }
    // scale with the sample strip (untouched sample) at 360x640
    if (V === '360x640') { await toStage3(S); const P0 = await S.page.evaluate(PLAN), sc = P0.view.scale, min = P0.editor ? 14 : 12; R.check(`${V} A untouched sample with its strip: plan drawn at ${min} px/m or more (${sc.toFixed(1)})`, (await S.shown('sample-strip')) && sc >= min - 1e-9); await S.shot('A-sample-strip'); await S.act('step-2'); }
    await S.slide('q-footprint', 30); R.check(`${V} A Q3 change on the untouched sample plans: no R5 question`, !(await S.dialogOpen()) && (await S.ans()).footprintPct === 30);
    await toStage3(S);
    { const s = await S.state(); R.check(`${V} A entering stage 3 regenerated both stale levels (signature current)`, await S.page.evaluate(() => ['G', '1'].every((id) => PC.debug.state().plans[id].sig === PC.sig.level(PC.debug.state(), id)))); void s; }
    await S.act('step-2'); await S.slide('q-footprint', 25); await toStage3(S);
    R.check(`${V} A default tab Ground (no problem level), counter, Approve disabled with its reason`, (await S.page.evaluate(PLAN)).view.level === 'G');
    await check3(S, 'A sample, Ground');
    // scale at 360x640 with the sample strip shown
    // tap selection: every room, my name, dims and area; a tap outside clears
    { const P = await S.page.evaluate(PLAN), names = myNames(P.state.ans), pr = [];
      for (const r of P.rooms) { await tapRoom(S, r.id); const sel = (await S.page.evaluate(PLAN)).sel, room = P.state.ans.rooms.find((x) => x.id === r.id), asked = room.size === null ? room.area : Q.ROOM_AREA[room.type][room.size];
        const drawn = fmtArea(r.w * r.h, 'm'), area = P.editor && fmtArea(asked, 'm') !== drawn ? `${drawn} (asked ${fmtArea(asked, 'm')})` : drawn;   // F3-T2 rider: drawn vs asked
        const w = [names[r.id], `${r.w.toFixed(1)} × ${r.h.toFixed(1)} m`, area]; if (!eq(sel, w)) pr.push(`${r.id}: ${JSON.stringify(sel)} vs ${JSON.stringify(w)}`); }
      const c = await S.page.evaluate(() => { const b = document.querySelector('[data-pc="plan-canvas"]').getBoundingClientRect(); return [b.left + 6, b.top + b.height - 6]; }); await S.tapAt(c);
      if (!eq((await S.page.evaluate(PLAN)).sel, ['None selected', '–', '–'])) pr.push('tap outside: ' + JSON.stringify((await S.page.evaluate(PLAN)).sel));
      R.check(`${V} A tapping each Ground room shows its name, size and area; a tap outside clears`, pr); }
    if (vp.touch && V !== '768x1024') await S.shot('A-sample-G-m');
    await S.layout(`${V} A sample stage 3 (Ground)`);
    await selTab(S, '1'); await check3(S, 'A sample, First'); if (vp.touch && V !== '768x1024') await S.shot('A-sample-1-m');
    await S.act('unit-ft'); await check3(S, 'A sample, First, ft');
    { const P = await S.page.evaluate(PLAN); if (P.rooms[0]) { await tapRoom(S, P.rooms[0].id); const sel = (await S.page.evaluate(PLAN)).sel, r = P.rooms[0], room = P.state.ans.rooms.find((x) => x.id === r.id), asked = room.size === null ? room.area : Q.ROOM_AREA[room.type][room.size], drawn = fmtArea(r.w * r.h, 'ft');
      R.check(`${V} A readout in ft`, eq(sel.slice(1), [`${(r.w / Q.FT).toFixed(1)} × ${(r.h / Q.FT).toFixed(1)} ft`, P.editor && fmtArea(asked, 'ft') !== drawn ? `${drawn} (asked ${fmtArea(asked, 'ft')})` : drawn]) ? [] : [JSON.stringify(sel)]); } }
    if (vp.touch && V !== '768x1024') await S.shot('A-sample-1-ft');
    // Fit view after pan / zoom
    { const v0 = await S.page.evaluate(() => PC.debug.view('plan')), c = await S.page.evaluate(() => { const b = document.querySelector('[data-pc="plan-canvas"]').getBoundingClientRect(); return [b.left + b.width * 0.06, b.top + b.height * 0.5]; });   // beside the footprint: a drag on a room would move it (F3-T2)
      await S.dragPts(c, [c[0] + 40, c[1] + 30]); if (!vp.touch) { await S.page.mouse.move(c[0], c[1]); await S.page.mouse.wheel(0, -300); await S.settle(); }
      const v1 = await S.page.evaluate(() => PC.debug.view('plan')); await S.act('plan-fit'); const v2 = await S.page.evaluate(() => PC.debug.view('plan'));
      R.check(`${V} A pan${vp.touch ? '' : ' and zoom'} move the plan; Fit view returns to the fitted view`, !eq(v0, v1) && eq(v0, v2) ? [] : [JSON.stringify([v0, v1, v2])]); }
    // no banner on stage 3; stages 4-5 are not reachable without approvals
    R.check(`${V} A no "not built yet" banner on stage 3`, (await S.banners()).length === 0);
    await S.end(`${V} A`);
  }

  // ======================= B. no-layout level (focus item 4) =======================
  if (want('B')) for (const vp of VS(PHONE, LAND, DESK)) {
    const V = vp.tag, S = await kit(browser, vp, { keepPlans: true, stage2: false });
    // the TL's case: a single 80 m² room on the First floor
    await S.page.evaluate(() => PC.store.commit((s) => { s.ans.rooms = s.ans.rooms.filter((r) => r.level !== '1'); s.ans.pairs = s.ans.pairs.filter((p) => p.every((id) => s.ans.rooms.some((r) => r.id === id))); s.ans.rooms.push({ id: 'r90', type: 'living', level: '1', size: null, area: 80, master: false }); s.ans.nextRoomId = 91; }));
    await S.act('btn-next'); await toStage3(S);
    { const P = await S.page.evaluate(PLAN); R.check(`${V} B a single 80 m² room on the First floor: "Cannot be laid out", stage 3 opens on that tab`, P.view.level === '1' && P.state.plans['1'].error === 'no-layout' ? [] : [JSON.stringify(P.view), P.state.plans['1'].error]); }
    await check3(S, 'B no-layout First');
    { const g = await S.page.evaluate(() => { const r = (h) => document.querySelector(`[data-pc="${h}"]`).getBoundingClientRect(); const b = r('plan-error'), c = r('plan-canvas'), btn = r('btn-goto-rooms'), fit = r('plan-fit'), t = document.querySelector('[data-pc="plan-error-text"]');
        return { bh: b.height, ch: c.height, btn: [btn.width, btn.height], inside: btn.left >= b.left - 0.5 && btn.right <= b.right + 0.5 && btn.top >= b.top - 0.5 && btn.bottom <= b.bottom + 0.5, fit: !(fit.right <= b.left || b.right <= fit.left || fit.bottom <= b.top || b.bottom <= fit.top), clip: t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1 }; });
      const phone = vp !== DESK; R.check(`${V} B banner ${g.bh.toFixed(0)} px on a ${g.ch.toFixed(0)} px canvas${phone ? ' (at most 50 %)' : ''}, text whole, button ${g.btn.map(Math.round).join(' x ')} px inside it, clear of Fit view`, (!phone || g.bh <= 0.5 * g.ch + 0.5) && g.btn[1] >= 44 - 0.5 && g.inside && !g.fit && !g.clip ? [] : [JSON.stringify(g)]); }
    if (vp.touch) await S.shot('B-no-layout');
    await S.layout(`${V} B no-layout banner`);
    await S.act('btn-goto-rooms');
    { const g = await S.page.evaluate(() => { const a = document.activeElement, lv = a && a.closest('[data-level]'); return { stage: PC.debug.state().stage, f: a && a.dataset.pc, lv: lv && lv.dataset.level }; });
      R.check(`${V} B "Go to room list": stage 2, Rooms group, the First floor's first room control focused`, g.stage === 2 && (await S.group()) === 'rooms' && g.lv === '1' && g.f === 'room-type' ? [] : [JSON.stringify(g)]); }
    await S.end(`${V} B`);
  }

  // ======================= C. maximum house: four tabs (focus item 4) =======================
  if (want('C')) for (const vp of VS(PHONE, LAND, TAB, DESK)) {
    const V = vp.tag, S = await kit(browser, vp, { keepPlans: true, stage2: false });
    await S.page.evaluate((src) => PC.store.commit((0, eval)('(' + src + ')')), MAXHOUSE.toString());
    await S.act('btn-next'); await toStage3(S);
    const P = await S.page.evaluate(PLAN); R.check(`${V} C maximum house: tabs Basement, Ground, First, Second floor (basement first, no roof tab)`, eq(P.tabs.map((t) => t.id), ['B', 'G', '1', '2']));
    for (const id of ['B', 'G', '1', '2']) { await selTab(S, id); await check3(S, `C max house ${id}`); if (vp === PHONE && (id === 'B' || id === '2')) await S.shot(`C-max-${id}`); }
    await S.layout(`${V} C maximum house, Second floor`);
    if (vp === PHONE) { await S.act('unit-ft'); await check3(S, 'C max house ft'); await S.shot('C-max-2-ft'); }
    await S.end(`${V} C`);
  }

  // ======================= D. R5 and sync as the user meets them (focus item 3) =======================
  if (want('D')) for (const vp of [PHONE, DESK]) {
    const V = vp.tag;
    // Skip approves every level: then a Q3 change asks, naming both
    { const S = await kit(browser, vp, { keepPlans: true, stage2: false });
      await S.act('btn-skip3d'); await S.settle(); const to = (await S.page.evaluate(() => PC.stages.MAX_BUILT >= 5)) ? '5' : '3';
      R.check(`${V} D Skip lands on stage ${to} with both levels approved`, (await S.stages()) === to && await S.page.evaluate(() => ['G', '1'].every((id) => PC.debug.state().plans[id].approved)));
      if (to === '3') await check3(S, 'D after Skip'); else { await S.act('step-3'); await check3(S, 'D after Skip, stage 3'); }
      await S.act('step-2'); await S.openGroup('site'); await S.slide('q-footprint', 30);
      const open = await S.waitDialog(); const d = open ? await S.dialogText() : null;
      R.check(`${V} D Q3 change with Skip-approved plans asks, naming Ground and First`, open && /Ground floor/.test(d.text) && /First floor/.test(d.text) ? [] : [JSON.stringify(d)]);
      if (open) { await S.act('dialog-cancel'); await S.waitDialog(false); }
      await S.end(`${V} D skip`); }
    // only Ground approved: a first-floor room change asks nothing (First untouched); Q7 sentence names only Ground
    { const S = await kit(browser, vp, { keepPlans: true });
      await toStage3(S); await S.page.evaluate(() => PC.store.commit((s) => { s.plans.G.approved = true; }, { nav: true }));
      const before = await S.state(); await S.act('step-2'); await S.openGroup('rooms');
      const r1 = before.ans.rooms.find((r) => r.level === '1' && r.type === 'bathroom');
      await S.page.locator(`[data-pc="room-list"] [data-room="${r1.id}"] [data-pc="room-size"]`).selectOption('L'); await S.settle();
      R.check(`${V} D First-floor room change with only Ground approved: no question (First was an untouched Draft)`, !(await S.dialogOpen()) && (await S.ans()).rooms.find((r) => r.id === r1.id).size === 'L');
      await toStage3(S); { const s = await S.state(); R.check(`${V} D entering stage 3 regenerated only First; Ground kept as approved, unchanged`, eq(s.plans.G, before.plans.G) && !eq(s.plans['1'], before.plans['1']) && s.plans['1'].sig === await S.page.evaluate(() => PC.sig.level(PC.debug.state(), '1'))); }
      await S.act('step-2'); await S.openGroup('building'); await S.act(lab('q-floors', '1')); await S.waitDialog(); const d = await S.dialogText();
      R.check(`${V} D removing the First floor: plans sentence names only the approved Ground floor (First was an untouched Draft)`, /Ground floor/.test(d.text) && !/First floor/.test(d.text) ? [] : [JSON.stringify(d)]);
      await S.act('dialog-cancel'); await S.waitDialog(false);
      // Regenerate: not edited -> no question; clears that level's approval only
      await toStage3(S); await selTab(S, 'G'); const g0 = (await S.state()).plans, ed = await S.page.evaluate(() => PC.stages.MAX_BUILT >= 5); await S.act('btn-regenerate'); await S.settle();
      // F3-T1: no question for an unedited plan. F3-T2 (PM round 6): asks for an approved one too, naming the approval
      if (ed) { const open = await S.waitDialog(), d = open ? await S.dialogText() : null; R.check(`${V} D Regenerate on an unedited approved Ground asks (PM round 6): "The Ground floor's approval will be cleared. It will be laid out again from the room list."`, open && d.title === 'Regenerate this floor?' && d.text === "The Ground floor's approval will be cleared. It will be laid out again from the room list." && d.ok === 'Regenerate' ? [] : [JSON.stringify(d)]); if (open) { await S.act('dialog-ok'); await S.waitDialog(false); } }
      { const s = await S.state(); R.check(`${V} D Regenerate on an unedited approved Ground: ${ed ? 'after Regenerate' : 'no question'}, Ground back to Draft, First untouched`, !(await S.dialogOpen()) && s.plans.G.approved === false && eq(s.plans['1'], g0['1'])); }
      await S.page.evaluate(() => PC.store.commit((s) => { s.plans.G.edited = true; s.plans.G.approved = true; }, { nav: true }));
      await S.act('btn-regenerate'); const asked = await S.waitDialog();
      if (asked && ed) { const d = await S.dialogText(); R.check(`${V} D Regenerate on an edited and approved Ground: "Your manual edits to the Ground floor and its approval will be lost. ..."`, d.text === 'Your manual edits to the Ground floor and its approval will be lost. It will be laid out again from the room list.' ? [] : [d.text]); }
      if (asked) await S.act('dialog-cancel'); await S.waitDialog(false);
      R.check(`${V} D Regenerate after an edit asks; Cancel keeps the edited, approved plan`, asked && (await S.state()).plans.G.edited && (await S.state()).plans.G.approved);
      await S.act('btn-regenerate'); await S.waitDialog(); await S.act('dialog-ok'); await S.waitDialog(false);
      R.check(`${V} D Regenerate confirmed: Ground a fresh Draft, First untouched`, (await S.state()).plans.G.edited === false && (await S.state()).plans.G.approved === false && eq((await S.state()).plans['1'], g0['1']));
      // Resume keeps the stored plans
      await S.page.evaluate(() => PC.store.commit((s) => { s.plans.G.approved = true; }, { nav: true })); await S.flush(); const keep = (await S.state()).plans;
      await S.reload(); await S.act('btn-resume'); await S.settle();
      R.check(`${V} D reload + Resume keeps the stored plans exactly`, eq((await S.state()).plans, keep));
      await S.end(`${V} D partial`); }
  }
} finally { await browser.close(); }
R.note(`runtime ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (!REL) R.note('A, B and C at 640x360 / 768x1024 run in the release step only (QA_RELEASE=1; TL run-time ruling F6-T1c)');
process.exit(R.done() ? 0 : 1);
