// F1-T1 layout assertions. Each export takes a playwright `page` (already on dist/index.html, a stage visible)
// and returns an array of failure strings (empty = pass). Written so FS/QA can lift them into tests/e2e/.

const VIS = `(el) => { if (el.closest('[hidden]')) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }`;

export async function noPageScroll(page) {
  return page.evaluate(() => {
    const d = document.documentElement, f = [];
    if (d.scrollWidth > innerWidth) f.push(`page scrollWidth ${d.scrollWidth} > ${innerWidth}`);
    if (d.scrollHeight > innerHeight) f.push(`page scrollHeight ${d.scrollHeight} > ${innerHeight}`);
    return f;
  });
}

export async function tapTargets(page, min = 44) {
  return page.evaluate(({ min, VIS }) => {
    const vis = eval(VIS), f = [];
    for (const el of document.querySelectorAll('button, [role=button], input, select, summary')) {
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < min - 0.5 || r.height < min - 0.5)
        f.push(`target ${el.dataset.pc || el.name || el.className} is ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
    }
    return f;
  }, { min, VIS });
}

export async function stepperOneLine(page) {
  return page.evaluate(() => {
    const steps = [...document.querySelectorAll('[data-pc^="step-"]')], f = [];
    const tops = new Set(steps.map(s => Math.round(s.getBoundingClientRect().top)));
    if (steps.length !== 5) f.push(`stepper has ${steps.length} steps`);
    if (tops.size !== 1) f.push('stepper wraps: tops ' + [...tops].join(','));
    for (const s of steps) if (s.scrollWidth > s.clientWidth + 1) f.push(`step ${s.dataset.pc} content overflows (${s.scrollWidth} > ${s.clientWidth})`);
    return f;
  });
}

export async function barInViewport(page) {
  return page.evaluate(() => {
    const f = [];
    for (const h of ['btn-back', 'btn-next']) {
      const el = document.querySelector(`[data-pc="${h}"]`);
      if (!el || el.closest('[hidden]')) continue;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) f.push(`${h} outside viewport`);
    }
    return f;
  });
}

export async function canvasMin(page, min = 200) {
  return page.evaluate(({ min, VIS }) => {
    const vis = eval(VIS), f = [];
    for (const c of document.querySelectorAll('[data-stage]:not([hidden]) canvas')) {
      if (!vis(c)) continue;
      const r = c.getBoundingClientRect();
      if (r.width < min || r.height < min) f.push(`canvas ${c.dataset.pc} is ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
    }
    return f;
  }, { min, VIS });
}

// Stage 2, Site group open: at least one whole .pc-q block is inside the viewport and not covered by the bar/summary.
export async function oneQuestionVisible(page) {
  return page.evaluate(() => {
    const sc = document.querySelector('.pc-qs__scroll').getBoundingClientRect();
    const ok = [...document.querySelectorAll('[data-pc="q-group-site"] .pc-q')].some(q => {
      const r = q.getBoundingClientRect();
      return r.top >= sc.top - 0.5 && r.bottom <= sc.bottom + 0.5 && r.bottom <= innerHeight;
    });
    return ok ? [] : [`no whole .pc-q block visible (scroll area ${sc.height.toFixed(0)} px high)`];
  });
}

const hit = `(a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)`;

// Stage 1 with the sample strip shown.
export async function stripClear(page) {
  return page.evaluate((hit) => {
    const X = eval(hit), f = [], q = h => document.querySelector(`[data-pc="${h}"]`);
    const strip = q('sample-strip').getBoundingClientRect(), skip = q('btn-skip3d').getBoundingClientRect();
    for (const h of ['btn-undo', 'btn-clear', 'btn-close-shape', 'plot-area', 'plot-msg', 'btn-back', 'btn-next'])
      if (X(skip, q(h).getBoundingClientRect())) f.push(`btn-skip3d overlaps ${h}`);
    for (const h of ['btn-undo', 'btn-clear', 'btn-close-shape', 'plot-area', 'plot-msg'])
      if (X(strip, q(h).getBoundingClientRect())) f.push(`sample strip overlaps ${h}`);
    if (skip.top < 0 || skip.bottom > innerHeight || skip.left < 0 || skip.right > innerWidth) f.push('btn-skip3d outside viewport');
    if (skip.width < 44 || skip.height < 44) f.push('btn-skip3d under 44 px');
    return f;
  }, hit);
}

// Stage 5, panel open: panel height is a third of the canvas or less (phone portrait layout only).
export async function v3PanelThird(page) {
  return page.evaluate(() => {
    const p = document.querySelector('[data-pc="v3-panel"]').getBoundingClientRect();
    const c = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect();
    return p.height <= c.height / 3 + 0.5 ? [] : [`3D panel ${p.height.toFixed(0)} px > a third of canvas ${c.height.toFixed(0)} px`];
  });
}

// Stage 5 with caption (Pause/Stop shown): the chip does not intersect the panel toggle or the panel.
export async function captionClear(page) {
  return page.evaluate((hit) => {
    const X = eval(hit), f = [], q = h => document.querySelector(`[data-pc="${h}"]`);
    const cap = q('v3-caption').getBoundingClientRect();
    if (X(cap, q('v3-panel-toggle').getBoundingClientRect())) f.push('caption overlaps v3-panel-toggle');
    if (X(cap, q('v3-panel').getBoundingClientRect())) f.push('caption overlaps v3-panel');
    if (cap.left < 0 || cap.right > innerWidth) f.push('caption outside viewport');
    return f;
  }, hit);
}

// Hook contract: every hook of hooks.json exists exactly as listed; nothing unlisted; unique outside templates.
export async function hookContract(page, contract) {
  return page.evaluate((contract) => {
    const f = [], count = {};
    for (const el of document.querySelectorAll('[data-pc]')) count[el.dataset.pc] = (count[el.dataset.pc] || 0) + 1;
    for (const h of contract.document) if (count[h] !== 1) f.push(`hook ${h} occurs ${count[h] || 0} times`);
    for (const h in count) if (!contract.document.includes(h)) f.push(`unlisted hook ${h}`);
    for (const [tpl, parts] of Object.entries(contract.templates)) {
      const t = document.querySelector(`template[data-pc="${tpl}"]`);
      if (!t) { f.push(`template ${tpl} missing`); continue; }
      const c = {};
      for (const el of t.content.querySelectorAll('[data-pc]')) c[el.dataset.pc] = (c[el.dataset.pc] || 0) + 1;
      for (const p of parts) if (c[p] !== 1) f.push(`${tpl}: part ${p} occurs ${c[p] || 0} times`);
      for (const p in c) if (!parts.includes(p)) f.push(`${tpl}: unlisted part ${p}`);
      if (t.content.children.length !== 1) f.push(`${tpl}: ${t.content.children.length} root elements`);
    }
    return f;
  }, contract);
}

// Choice controls carry the A-4 state values; radio names are unique per group.
export async function choiceValues(page, values) {
  return page.evaluate((values) => {
    const f = [], same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const roots = [document, ...[...document.querySelectorAll('template')].map(t => t.content)];
    const find = h => { for (const r of roots) { const el = r.querySelector(`[data-pc="${h}"]`); if (el) return el; } return null; };
    for (const [hook, want] of Object.entries(values)) {
      const el = find(hook);
      if (!el) { f.push(`choice ${hook} missing`); continue; }
      let got;
      if (el.tagName === 'SELECT') got = [...el.options].map(o => o.value).filter(v => v !== '');
      else if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') got = [el.value];
      else got = [...el.querySelectorAll('input[type=radio]')].map(i => i.value);
      if (!same(got, want)) f.push(`choice ${hook}: values [${got}] expected [${want}]`);
    }
    const groups = {};
    for (const r of roots) for (const i of r.querySelectorAll('input[type=radio]')) {
      const g = i.closest('[role=radiogroup]');
      if (!i.name) f.push('radio without name'); if (!g) { if (r === document) f.push(`radio ${i.name} outside a radiogroup`); continue; }
      (groups[i.name] = groups[i.name] || new Set()).add(g);
    }
    for (const n in groups) if (groups[n].size !== 1) f.push(`radio name ${n} used by ${groups[n].size} groups`);
    return f;
  }, values);
}

// Static checks on the built file.
export function documentHead(html) {
  const f = [];
  if (!/<meta charset="utf-8">/i.test(html)) f.push('meta charset missing');
  const vp = html.match(/<meta name="viewport" content="([^"]*)"/i);
  if (!vp) f.push('viewport meta missing');
  else if (/user-scalable\s*=\s*no|maximum-scale/i.test(vp[1])) f.push('viewport locks zoom');
  if (!/<link rel="icon" href="data:,">/.test(html)) f.push('data: favicon missing');
  if (/xmlns=/.test(html)) f.push('xmlns attribute present');
  const http = html.match(/https?:\/\/[^\s"'<>)]+/g) || [];
  if (http.length !== 1 || !http[0].includes('cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')) f.push('http strings: ' + http.join(' | '));
  for (const [re, n] of [[/<link\b(?![^>]*rel="icon")/i, '<link>'], [/<img\b/i, '<img>'], [/@import/i, '@import'], [/url\(\s*["']?https?:/i, 'url(http'], [/<form\b/i, '<form>'], [/\sstyle="/i, 'inline style attribute']])
    if (re.test(html)) f.push(`${n} present`);
  return f;
}
