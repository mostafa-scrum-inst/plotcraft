// F3-T3 QA (browser, real input): the stage-4 hints and the stage-2 Q10 swatches as an architect meets them.
// Stage 4 at 360x640, 360x740, 640x360, 768x1024, 1280x800 (reached for real: sample -> Skip to 3D -> Back): PM round-7
// Q18 texts exactly and on one line at 360 px; hints inside their cards; F1-T1 layout rules (no page scroll, 44 px
// targets, nothing clipped, contrast); each card chosen by touch (phones, tablet) or mouse (1280) -> state, checked
// radio, the chosen card still in view and the stage not scrolled by the choice; chip and vignette colours (computed,
// so var() resolves) equal QA's expectation from the tables, the floor = my A-10 mix; the Q19 vignettes follow Modern,
// Classic AND Minimal; Q19 piece counts = the living table's sparse / full.
// Stage 2 Q10 at 360x640, 640x360, 768x1024, 1280x800: three stripes 2 : 1 : 1, colours = exteriors wall / trim / roof,
// each card selectable by touch / mouse (label > input), no R5 question for a colour change.
// Run: node tests/qa/f3-t3-look.mjs [--no-shots] [--only=360x640,...]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VIEWPORTS, launch, collector } from './lib.mjs';
import { sessions, eq } from './session.mjs';
import { lab } from './stage2kit.mjs';
import { loadTables, floorOf, rgbCss } from './f3-t3-ref.mjs';

const SHOTS = join(ROOT, 'tests/qa/shots/F3-T3'); mkdirSync(SHOTS, { recursive: true });
const noShots = process.argv.includes('--no-shots');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const R = collector('F3-T3 look');
const session = sessions({ R, shots: SHOTS, noShots });
const D = loadTables();
const VP = Object.fromEntries(VIEWPORTS.map((v) => [v.tag, v]));
// TL ruling (F6-T1c run-time debt, before the next feature's first gate): the 360x740 and 768x1024 passes run in the release step only
// (QA_RELEASE=1; f6-t1-leak.mjs --stream-only runs this file with --release-only, which runs just those).
const REL = !!process.env.QA_RELEASE, RELONLY = process.argv.includes('--release-only');
const RUN_ALL = [VP['360x640'], { tag: '360x740', w: 360, h: 740, touch: true }, VP['640x360'], VP['768x1024'], VP['1280x800']], RELV = ['360x740', '768x1024'];
const RUN = RUN_ALL.filter((v) => (RELONLY ? RELV.includes(v.tag) : REL || !RELV.includes(v.tag))).filter((v) => !only.length || only.includes(v.tag));
// PM round 7 (goals-and-stories.md, F3-S4)
const Q18 = { modern: ['Modern', 'Graphite, dark wood, copper'], classic: ['Classic', 'Cream fabric, walnut, brass'], minimal: ['Minimal', 'Pale grey, light oak, sage'] };
const STY = ['modern', 'classic', 'minimal'], EXT = ['sand', 'white', 'terracotta', 'grey'], KEYS = ['fabric', 'wood', 'accent', 'metal', 'dark'];

// Stage 4 read: cards (text, one-line, hint inside), computed chip / piece / floor fills, Q19 piece counts, scroll.
const READ4 = () => {
  const st = document.querySelector('[data-stage="4"]'), box = (e) => e.getBoundingClientRect(), fill = (e) => getComputedStyle(e).fill;
  const card = (inp) => { const c = inp.closest('label').querySelector('.pc-card'), r = box(c), h = c.querySelector('.pc-hint'), hr = box(h), d = c.querySelector('.pc-card__desc'), lh = parseFloat(getComputedStyle(d).lineHeight);
    return { v: inp.value, checked: inp.checked, name: c.querySelector('.pc-card__name').textContent.trim(), desc: d.textContent.trim(), lines: box(d).height / lh, clip: d.scrollWidth > d.clientWidth + 0.5,
      hintIn: hr.left >= r.left - 0.5 && hr.right <= r.right + 0.5 && hr.top >= r.top - 0.5 && hr.bottom <= r.bottom + 0.5, hintH: hr.height, rect: [r.left, r.top, r.right, r.bottom] }; };
  const pieces = (svg) => [...svg.querySelectorAll('.h-piece')].map((g) => [[...g.classList].find((c) => c !== 'h-piece').slice(2), fill(g.querySelector('.h-top'))]);
  const sc = st, sr = box(sc);
  return { style: [...st.querySelectorAll('input[name="q-interior-style"]')].map(card), dens: [...st.querySelectorAll('input[name="q-interior-density"]')].map(card),
    chips: Object.fromEntries(['modern', 'classic', 'minimal'].map((s) => { const svg = st.querySelector('.pc-hint--' + s); return [s, { chips: Object.fromEntries([...svg.querySelectorAll('.h-chip')].map((c) => [[...c.classList].find((k) => k !== 'h-chip').slice(2), fill(c)])), pieces: pieces(svg), floor: fill(svg.querySelector('.h-floor')) }]; })),
    q19: [...st.querySelectorAll('.pc-hint--density')].map((svg) => ({ n: svg.querySelectorAll('.h-piece').length, pieces: pieces(svg), floor: fill(svg.querySelector('.h-floor')) })),
    scroll: sc.scrollTop, view: [sr.top, sr.bottom, window.innerHeight] };
};
const inView = (rect, view) => rect[1] >= Math.max(view[0], 0) - 0.5 && rect[3] <= Math.min(view[1], view[2]) + 0.5;
const wantFill = (st, k) => rgbCss(D.interiors[st][k]);
function colourProblems(svgRead, st) {   // chips, pieces and floor of one hint in style st
  const f = [];
  if (svgRead.chips) for (const k of KEYS) if (svgRead.chips[k] !== wantFill(st, k)) f.push(`chip ${k} ${svgRead.chips[k]} != ${wantFill(st, k)}`);
  for (const [k, got] of svgRead.pieces) if (got !== wantFill(st, k)) f.push(`piece ${k} ${got} != ${wantFill(st, k)}`);
  if (svgRead.floor !== rgbCss(floorOf(D, st, 'living'))) f.push(`floor ${svgRead.floor} != ${rgbCss(floorOf(D, st, 'living'))} (my mix)`);
  return f;
}

const browser = await launch();
try {
  for (const vp of RUN) {
    const V = vp.tag, S = await session(browser, vp);
    try {
      await S.act('btn-sample'); await S.act('btn-skip3d'); await S.settle();
      R.check(`${V} 0 sample -> Skip to 3D lands on stage 5 with every floor approved`, (await S.stages()) === '5' && Object.values((await S.state()).plans).every((p) => p.approved) ? [] : [await S.stages()]);
      await S.act('btn-back'); await S.settle();
      let X = await S.page.evaluate(READ4);
      R.check(`${V} 1 Back opens stage 4 with defaults Modern / Full`, (await S.stages()) === '4' && eq(X.style.filter((c) => c.checked).map((c) => c.v), ['modern']) && eq(X.dens.filter((c) => c.checked).map((c) => c.v), ['full']) ? [] : [JSON.stringify([await S.stages(), X.style.map((c) => c.checked), X.dens.map((c) => c.checked)])]);
      R.check(`${V} 1 Q18 cards: PM round-7 names and descriptions exactly`, X.style.filter((c) => !eq([c.name, c.desc], Q18[c.v])).map((c) => `${c.v}: "${c.name}" / "${c.desc}"`).concat(X.style.length === 3 ? [] : ['cards ' + X.style.length]));
      R.check(`${V} 1 Q19 cards: Sparse "Key pieces only", Full "Every piece for the room type"`, eq(X.dens.map((c) => [c.v, c.name, c.desc]), [['sparse', 'Sparse', 'Key pieces only'], ['full', 'Full', 'Every piece for the room type']]) ? [] : [JSON.stringify(X.dens.map((c) => [c.name, c.desc]))]);
      if (vp.w === 360) R.check(`${V} 1 every stage-4 description on one line, nothing clipped`, [...X.style, ...X.dens].filter((c) => c.lines >= 1.5 || c.clip).map((c) => `${c.v}: ${c.lines.toFixed(2)} lines${c.clip ? ', clipped' : ''}`));
      else R.check(`${V} 1 stage-4 descriptions not clipped (wrapping allowed above 360 px)`, [...X.style, ...X.dens].filter((c) => c.clip).map((c) => c.v));
      R.check(`${V} 1 every hint inside its card, ${Math.min(...[...X.style, ...X.dens].map((c) => c.hintH)).toFixed(0)} px tall or more`, [...X.style, ...X.dens].filter((c) => !c.hintIn || c.hintH < 60).map((c) => c.v));
      R.check(`${V} 1 Q18 hints: computed chip, piece and floor fills = PC.data.interiors and my floor mix, per style`, STY.flatMap((st) => colourProblems(X.chips[st], st).map((p) => `${st} ${p}`)));
      { const L = D.furniture.living; R.check(`${V} 1 Q19 vignettes: ${L.filter((p) => p.sparse).length} against ${L.length} pieces (the living table)`, eq(X.q19.map((q) => q.n), [L.filter((p) => p.sparse).length, L.length]) ? [] : [JSON.stringify(X.q19.map((q) => q.n))]); }
      R.check(`${V} 1 Q19 vignettes in Modern colours by default`, X.q19.flatMap((q, i) => colourProblems(q, 'modern').map((p) => `${i} ${p}`)));
      await S.layout(`${V} 1 stage 4`); await S.shot('stage4');
      // choose every card by real input: state, checked radio, card still in view, stage not scrolled by the choice
      for (const [hook, name, vals, key] of [['q-interior-style', 'q-interior-style', ['classic', 'minimal', 'modern'], 'style'], ['q-interior-density', 'q-interior-density', ['sparse', 'full'], 'density']]) {
        for (const v of vals) {
          await S.page.evaluate(([n, v]) => document.querySelector(`input[name="${n}"][value="${v}"]`).closest('label').scrollIntoView({ block: 'nearest' }), [name, v]); await S.settle();
          const before = (await S.page.evaluate(READ4)).scroll;
          await S.act(lab(hook, v));
          X = await S.page.evaluate(READ4); const c = [...X.style, ...X.dens].find((x) => x.v === v), ans = (await S.state()).ans.interior;
          R.check(`${V} 2 ${vp.touch ? 'tap' : 'click'} ${v}: state ${key} = ${v}, radio checked, card in view, no scroll jump`, ans[key] === v && c.checked && inView(c.rect, X.view) && Math.abs(X.scroll - before) < 1 ? [] : [JSON.stringify({ ans, checked: c.checked, rect: c.rect, view: X.view, scroll: [before, X.scroll] })]);
          if (key === 'style') {
            R.check(`${V} 2 Q19 vignettes follow ${v} (pieces and floor)`, X.q19.flatMap((q, i) => colourProblems(q, v).map((p) => `${i} ${p}`)));
            if (vp.tag === '640x360' && v !== 'modern') await S.shot('stage4-' + v);
          }
        }
      }
      await S.layout(`${V} 2 stage 4 after choices`);
      if (V === '360x740') { await S.end(`${V} stage 4`); continue; }   // 360x740: stage 4 only (Q10 runs at the four standard viewports)
      // ---- stage 2, Q10 swatches ----
      await S.act('step-2'); await S.settle(); if ((await S.page.evaluate(() => document.querySelector('[data-pc="q-group-building"]').hidden))) await S.act('q-tab-building');
      const sw = () => S.page.evaluate(() => [...document.querySelectorAll('[data-pc="q-exterior"] input')].map((inp) => { const s = inp.closest('label').querySelector('.pc-swatch'), is = [...s.children];
        return { v: inp.value, checked: inp.checked, cls: s.className, w: is.map((i) => i.getBoundingClientRect().width), h: is.map((i) => i.getBoundingClientRect().height), bg: is.map((i) => getComputedStyle(i).backgroundColor) }; }));
      let W = await sw();
      R.check(`${V} 3 Q10: four cards sand, white, terracotta, grey, three stripes each`, eq(W.map((x) => x.v), EXT) && W.every((x) => x.w.length === 3) ? [] : [JSON.stringify(W.map((x) => [x.v, x.w.length]))]);
      R.check(`${V} 3 Q10 stripes 2 : 1 : 1 (within 1 px) and visible`, W.filter((x) => !(Math.abs(x.w[1] - x.w[2]) <= 1 && Math.abs(x.w[0] - 2 * x.w[1]) <= 1 && x.w[1] >= 4 && x.h.every((h) => h >= 4))).map((x) => `${x.v} ${x.w.map((n) => n.toFixed(1))} x ${x.h[0].toFixed(1)}`));
      R.check(`${V} 3 Q10 stripe colours = exteriors wall / trim / roof`, W.filter((x) => !eq(x.bg, [D.exteriors[x.v].wall, D.exteriors[x.v].trim, D.exteriors[x.v].roof].map(rgbCss))).map((x) => `${x.v}: ${x.bg}`));
      for (const v of ['white', 'terracotta', 'grey', 'sand']) {
        await S.act(lab('q-exterior', v)); W = await sw();
        R.check(`${V} 4 ${vp.touch ? 'tap' : 'click'} ${v}: state exterior = ${v}, only its radio checked, no R5 question`, (await S.state()).ans.exterior === v && eq(W.filter((x) => x.checked).map((x) => x.v), [v]) && !(await S.dialogOpen()) ? [] : [JSON.stringify({ ext: (await S.state()).ans.exterior, checked: W.filter((x) => x.checked).map((x) => x.v), dialog: await S.dialogOpen() })]);
      }
      R.check(`${V} 4 plans kept and still approved after the Q10 changes`, Object.values((await S.state()).plans).every((p) => p.approved) ? [] : ['plans changed']);
      await S.layout(`${V} 4 stage 2 building group`); await S.shot('q10');
      await S.end(`${V} stage 4 + Q10`);
    } catch (e) { R.check(`${V} crashed`, [String(e && e.stack || e)]); await S.ctx.close().catch(() => {}); }
  }
} finally { await browser.close(); }
if (!REL) R.note('the 360x740 and 768x1024 passes run in the release step only (QA_RELEASE=1; TL run-time ruling F6-T1c)');
process.exit(R.done() ? 0 : 1);
