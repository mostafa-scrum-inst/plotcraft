// Browser-side QA helpers. Evaluated in the page as window.__qa. Reusable for later tasks.
(() => {
  const q = (h, root) => (root || document).querySelector(`[data-pc="${h}"]`);
  const tpl = (h) => q(h).content.firstElementChild.cloneNode(true);
  const desc = (el) => {
    if (!el || !el.tagName) return String(el);
    const pc = el.getAttribute('data-pc'); if (pc) return pc;
    const p = el.closest('[data-pc]'); const own = el.tagName.toLowerCase() + (el.name ? `[name=${el.name}]` : '') + (el.value && el.type === 'radio' ? `[value=${el.value}]` : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
    return (p ? p.getAttribute('data-pc') + ' > ' : '') + own;
  };
  const rendered = (el) => {
    if (!el.isConnected || el.closest('[hidden]')) return false;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  // Rect of el intersected with every clipping ancestor. reach=true: scrollable axes are not treated as clips (content is reachable by scrolling).
  const clipRect = (el, reach) => {
    const r0 = el.getBoundingClientRect(); let r = { left: r0.left, top: r0.top, right: r0.right, bottom: r0.bottom };
    const fixed = getComputedStyle(el).position === 'fixed'; let freeX = false, freeY = false;
    for (let a = el.parentElement; a && !fixed; a = a.parentElement) {
      const cs = getComputedStyle(a); const b = a.getBoundingClientRect();
      const cx = cs.overflowX !== 'visible', cy = cs.overflowY !== 'visible';
      const sx = /auto|scroll/.test(cs.overflowX), sy = /auto|scroll/.test(cs.overflowY);
      const box = { left: b.left + a.clientLeft, top: b.top + a.clientTop, right: b.left + a.clientLeft + a.clientWidth, bottom: b.top + a.clientTop + a.clientHeight };
      if (reach && sx) freeX = true; if (reach && sy) freeY = true; // inside a scroller: reachable on that axis from here up
      if (cx && !freeX) { r.left = Math.max(r.left, box.left); r.right = Math.min(r.right, box.right); }
      if (cy && !freeY) { r.top = Math.max(r.top, box.top); r.bottom = Math.min(r.bottom, box.bottom); }
      if (cs.position === 'fixed') break;
    }
    if (!freeX) { r.left = Math.max(r.left, 0); r.right = Math.min(r.right, innerWidth); } if (!freeY) { r.top = Math.max(r.top, 0); r.bottom = Math.min(r.bottom, innerHeight); }
    r.width = Math.max(0, r.right - r.left); r.height = Math.max(0, r.bottom - r.top); r.full = r0; return r;
  };
  const INTERACTIVE = 'button, [role=button], input, select, summary, a[href], textarea, [tabindex]:not([tabindex="-1"]):not(canvas)';
  const interactive = () => [...document.querySelectorAll(INTERACTIVE)].filter(rendered);

  // ---------- state forcing (static markup has no logic yet) ----------
  const S = {};
  // F3-T1 (marker PC.layout): stage 3 has a controller and generated content, so a stage-3 state is reached for real:
  // the sample (or the levels a scenario asks for through S.planTabs) is loaded and the app navigates to stage 3, which
  // generates tabs, plan and counter. Stages 4-5 stay static.
  const LAYOUT = () => typeof PC.layout === 'object';
  S.real3 = (levels) => { // levels: ['B', 'G', '1', '2'] subset; every level gets rooms
    const st = PC.sample.state(); st.ans.basement = levels.includes('B'); st.ans.floors = levels.filter((l) => l !== 'B').length || 1;
    let id = st.ans.nextRoomId; for (const l of levels) if (!st.ans.rooms.some((r) => r.level === l)) for (const t of ['storage', 'laundry']) st.ans.rooms.push({ id: 'r' + (id++), type: t, level: l, size: 'S', area: null, master: false });
    st.ans.nextRoomId = id; st.plans = {}; st.stage = 1;
    PC.stages.MAX_BUILT = Math.max(PC.stages.MAX_BUILT, 3); PC.store.replace(st); PC.store.go(2); PC.store.go(3);
  };
  // F3-T2 (marker MAX_BUILT >= 5): stage 4 has a controller too; it is reached for real with every level approved.
  S.real4 = () => { S.real3(['G', '1']); PC.store.commit((st) => { for (const id in st.plans) if (!st.plans[id].error) st.plans[id].approved = true; }, { nav: true }); PC.store.go(4); };
  S.stage = (n) => {
    if (n === 3 && LAYOUT()) { S.real3(['G', '1']); return; }
    if (n === 4 && PC.stages.MAX_BUILT >= 5) { S.real4(); return; }
    for (const s of document.querySelectorAll('[data-stage]')) s.hidden = s.dataset.stage !== String(n);
    for (let i = 1; i <= 5; i++) {
      const b = q('step-' + i); b.classList.remove('is-current', 'is-done', 'is-locked'); b.removeAttribute('aria-current'); b.removeAttribute('aria-disabled');
      if (i < n) b.classList.add('is-done'); else if (i === n) { b.classList.add('is-current'); b.setAttribute('aria-current', 'step'); } else { b.classList.add('is-locked'); b.setAttribute('aria-disabled', 'true'); }
    }
    q('btn-back').disabled = n === 1; q('btn-next').disabled = false; q('btn-next').hidden = n === 5;
    q('btn-next-label').textContent = ['Next: Questions', 'Next: Floor plans', 'Next: Interior', 'Build 3D model', ''][n - 1];
  };
  S.group = (g) => { for (const k of ['site', 'building', 'rooms', 'outdoor']) { q('q-group-' + k).hidden = k !== g; q('q-tab-' + k).setAttribute('aria-selected', String(k === g)); } };
  S.collapse = (hook, toggle, on) => { q(hook).classList.toggle('is-collapsed', on); q(toggle).setAttribute('aria-expanded', String(!on)); };
  S.rooms = (spec) => { // spec: [[levelName, [[name, type, size], ...]], ...]
    const list = q('room-list'); list.textContent = '';
    for (const [lvl, rooms] of spec) {
      const g = tpl('tpl-room-group'); q('group-name', g).textContent = lvl; q('group-count', g).textContent = rooms.length + ' of 8';
      for (const [name, type, size, lv] of rooms) {
        const r = tpl('tpl-room-row'); q('room-name', r).textContent = name; q('room-type', r).value = type; q('room-level', r).value = lv; q('room-size', r).value = size;
        q('room-area-hint', r).textContent = size === 'exact' ? '' : '16 m²';
        if (size === 'exact') { q('room-area-box', r).hidden = false; q('room-area', r).value = '18.5'; }
        if (/Master/.test(name)) q('room-master', r).checked = true;
        q('group-rows', g).appendChild(r);
      }
      list.appendChild(g);
    }
    for (const sel of [q('pair-a'), q('pair-b')]) for (const [, rooms] of spec) for (const [name] of rooms) sel.add(new Option(name, name));
  };
  S.pairs = (pairs) => { const l = q('pair-list'); l.textContent = ''; for (const p of pairs) { const r = tpl('tpl-pair-row'); q('pair-text', r).textContent = p; l.appendChild(r); } };
  S.summary = () => {
    q('sum-plot').textContent = '584 m²'; q('sum-buildable').textContent = '390 m²'; q('sum-footprint').textContent = '143 m² · 24.4 %'; q('sum-veg').textContent = '117 m² · 20 %';
    const lv = q('sum-levels'); lv.textContent = '';
    for (const [n, a, b] of [['Basement', '96 m²', '143 m²'], ['Ground floor', '160 m²', '143 m²'], ['First floor', '120 m²', '143 m²'], ['Second floor', '120 m²', '143 m²']]) { const r = tpl('tpl-sum-level'); q('level-name', r).textContent = n; q('level-needed', r).textContent = a; q('level-available', r).textContent = b; lv.appendChild(r); }
  };
  S.conflicts = (items) => {
    const l = q('conflict-list'); l.textContent = '';
    for (const [kind, text] of items) { const r = tpl('tpl-conflict'); r.dataset.kind = kind; q('conflict-text', r).textContent = text; l.appendChild(r); }
    q('summary').dataset.kind = items.some((i) => i[0] === 'block') ? 'block' : items.length ? 'warn' : 'ok';
    q('sum-status').textContent = items.length ? `${items.filter((i) => i[0] === 'block').length} conflicts, ${items.filter((i) => i[0] === 'warn').length} warnings` : 'All clear · footprint 143 m², 24.4 %';
  };
  S.planTabs = (tabs) => { // [[name, state('draft'|'approved'|'invalid'), selected]]
    if (LAYOUT()) { // the same levels and states on the real stage 3
      const id = { Basement: 'B', Ground: 'G', First: '1', Second: '2' }, ids = tabs.map((x) => id[x[0]]);
      S.real3(ids);
      PC.store.commit((st) => { tabs.forEach(([name, state]) => { const p = st.plans[id[name]]; if (!p) return; p.approved = state === 'approved'; if (state === 'invalid') p.error = 'no-layout'; }); }, { nav: true });
      const k = tabs.findIndex((x) => x[2]), btns = [...q('plan-tabs').querySelectorAll('[role="tab"], button')]; if (k >= 0 && btns[k]) btns[k].click();
      return;
    }
    const t = q('plan-tabs'); t.textContent = '';
    for (const [name, st, sel] of tabs) {
      const b = tpl('tpl-plan-tab'); q('tab-name', b).textContent = name; q('tab-state', b).textContent = st === 'approved' ? 'Approved' : st === 'invalid' ? 'Error' : 'Draft';
      if (st === 'approved') b.classList.add('is-approved'); if (st === 'invalid') b.classList.add('is-invalid'); b.setAttribute('aria-selected', String(!!sel)); t.appendChild(b);
    }
  };
  S.planWarn = (items) => { const l = q('plan-warn-list'); l.textContent = ''; for (const s of items) { const r = tpl('tpl-plan-warn'); q('warn-text', r).textContent = s; l.appendChild(r); } q('plan-warn-toggle').hidden = !items.length; q('plan-warn-count').textContent = String(items.length); };
  S.v3levels = (ids) => { const g = q('v3-level'); for (const [v, label] of ids) { const o = tpl('tpl-v3-level'); o.querySelector('input').value = v; q('level-label', o).textContent = label; g.appendChild(o); } };
  S.v3pane = (p) => { for (const k of ['view', 'light', 'tour']) { q('v3-pane-' + k).classList.toggle('is-current', k === p); q('v3-tab-' + k).setAttribute('aria-selected', String(k === p)); } };
  S.v3rooms = () => { const s = q('v3-room'); for (const [g, rooms] of [['Ground floor', ['Living', 'Kitchen', 'Bathroom']], ['First floor', ['Master bedroom', 'Bedroom 2', 'Bathroom']]]) { const og = document.createElement('optgroup'); og.label = g; for (const r of rooms) og.appendChild(new Option(r, r)); s.appendChild(og); } };
  S.toast = (text) => { const t = tpl('tpl-toast'); q('toast-text', t).textContent = text; q('toast-region').appendChild(t); };
  S.banner = (kind, text, action) => { const b = tpl('tpl-banner'); b.dataset.kind = kind; q('banner-text', b).textContent = text; if (action) { const a = q('banner-action', b); a.hidden = false; a.textContent = action; } q('banner-slot').appendChild(b); };
  S.dialog = (title, text, extra) => { q('dialog-layer').hidden = false; q('dialog-title').textContent = title; q('dialog-text').textContent = text; if (extra) { const e = tpl(extra); const t = q('level-remove-text', e); if (t) t.textContent = 'The first floor has 3 rooms.'; q('dialog-extra').appendChild(e); } };
  S.paint = () => { // neutral marks on canvases so screenshots show their extent (test only)
    for (const c of document.querySelectorAll('canvas')) { if (!rendered(c) || (LAYOUT() && c.dataset.pc === 'plan-canvas')) continue;   /* the real plan drawing stays */ const r = c.getBoundingClientRect(); c.width = r.width; c.height = r.height; const g = c.getContext('2d'); const P = PC.data.palette2d;
      g.fillStyle = P.canvas; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = P.grid.minor; g.lineWidth = 1; for (let x = 0.5; x < c.width; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); } for (let y = 0.5; y < c.height; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
      g.strokeStyle = P.state.selection; g.lineWidth = 2; g.strokeRect(1, 1, c.width - 2, c.height - 2); g.beginPath(); g.moveTo(0, 0); g.lineTo(c.width, c.height); g.moveTo(c.width, 0); g.lineTo(0, c.height); g.stroke(); }
  };

  // ---------- checks: each returns an array of problem strings ----------
  const C = {};
  C.pageScroll = () => {
    const d = document.documentElement, f = [];
    if (d.scrollWidth > innerWidth) f.push(`html scrollWidth ${d.scrollWidth} > ${innerWidth}`);
    if (d.scrollHeight > innerHeight) f.push(`html scrollHeight ${d.scrollHeight} > ${innerHeight}`);
    if (document.body.scrollWidth > innerWidth) f.push(`body scrollWidth ${document.body.scrollWidth} > ${innerWidth}`);
    if (document.body.scrollHeight > innerHeight) f.push(`body scrollHeight ${document.body.scrollHeight} > ${innerHeight}`);
    window.scrollTo(50, 50); if (scrollX || scrollY) f.push(`window scrolled to ${scrollX},${scrollY}`); window.scrollTo(0, 0);
    const app = q('app'); const ar = app.getBoundingClientRect();
    if (Math.abs(ar.width - innerWidth) > 0.5 || Math.abs(ar.height - innerHeight) > 0.5) f.push(`app is ${ar.width}x${ar.height}, viewport ${innerWidth}x${innerHeight}`);
    if (app.scrollHeight > app.clientHeight + 1 || app.scrollWidth > app.clientWidth + 1) f.push(`app content overflows its box (${app.scrollWidth}x${app.scrollHeight} in ${app.clientWidth}x${app.clientHeight})`);
    return f;
  };
  C.targets = (min = 44) => {
    const f = [];
    for (const el of interactive()) { const r = el.getBoundingClientRect(); if (r.width < min - 0.5 || r.height < min - 0.5) f.push(`${desc(el)} is ${r.width.toFixed(1)}x${r.height.toFixed(1)}`); }
    return f;
  };
  C.stepper = () => {
    const steps = [1, 2, 3, 4, 5].map((i) => q('step-' + i)), f = [];
    const rs = steps.map((s) => s.getBoundingClientRect());
    if (new Set(rs.map((r) => Math.round(r.top))).size !== 1) f.push('steps on different lines: tops ' + rs.map((r) => Math.round(r.top)).join(','));
    for (let i = 0; i < 5; i++) {
      if (i && rs[i].left < rs[i - 1].right - 0.5) f.push(`step ${i + 1} overlaps step ${i}`);
      if (rs[i].left < -0.5 || rs[i].right > innerWidth + 0.5) f.push(`step ${i + 1} outside viewport`);
      if (steps[i].scrollWidth > steps[i].clientWidth + 1 || steps[i].scrollHeight > steps[i].clientHeight + 1) f.push(`step ${i + 1} content overflows`);
      for (const ch of steps[i].querySelectorAll('*')) { if (!rendered(ch)) continue; const c = ch.getBoundingClientRect(); if (c.left < rs[i].left - 0.5 || c.right > rs[i].right + 0.5 || c.height > rs[i].height) f.push(`step ${i + 1} child ${ch.className.baseVal || ch.className} spills/wraps`); }
      const no = steps[i].querySelector('.pc-step__no'); if (!rendered(no)) f.push(`step ${i + 1} number not shown`);
    }
    const nav = q('stepper'); if (nav.scrollWidth > nav.clientWidth + 1) f.push(`stepper scrolls horizontally (${nav.scrollWidth} > ${nav.clientWidth})`);
    return f;
  };
  C.bar = () => {
    const f = [];
    for (const h of ['btn-back', 'btn-next']) { const el = q(h); if (!rendered(el)) { if (h === 'btn-back') f.push('btn-back not rendered'); continue; } const r = el.getBoundingClientRect(); if (r.top < 0 || r.left < 0 || r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5) f.push(`${h} outside viewport (${r.left},${r.top},${r.right},${r.bottom})`); const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); if (!hit || !(el === hit || el.contains(hit))) f.push(`${h} covered by ${desc(hit)}`); }
    return f;
  };
  // Elements that are cut off with no way to reach them (clipped by overflow:hidden or outside the viewport).
  C.clipped = () => {
    const f = [], els = [...document.querySelectorAll('[data-stage]:not([hidden]) *, .pc-header *, .pc-bar *, .pc-strip *, .pc-banner-slot *, .pc-toasts *, .pc-dialog-layer *')];
    for (const el of els) {
      if (!rendered(el) || el.closest('svg') && el.tagName !== 'svg' || el.closest('.pc-vh') || el.classList.contains('pc-vh')) continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); const inter = el.matches(INTERACTIVE) || el.tagName === 'svg' || el.tagName === 'CANVAS';
      if (!hasText && !inter) continue;
      if (el.tagName === 'INPUT' && getComputedStyle(el).opacity === '0') continue; // covered inputs: judged through their label
      const r = clipRect(el, true); const fr = r.full;
      if (r.width < fr.width - 1 || r.height < fr.height - 1) f.push(`${desc(el)} clipped: ${fr.width.toFixed(0)}x${fr.height.toFixed(0)} box, ${r.width.toFixed(0)}x${r.height.toFixed(0)} reachable`);
    }
    return f;
  };
  // Text that does not fit its own box.
  C.textFit = () => {
    const f = [];
    for (const el of document.querySelectorAll('button, label, .pc-chip, .pc-tab, .pc-seg__txt, .pc-card, .pc-msg, dd, dt, output, .pc-readout, h2, h3, h4, .pc-note, .pc-err, .pc-banner, .pc-toast, .pc-caption, option')) {
      if (!rendered(el) || el.tagName === 'OPTION') continue; if (el.closest('.pc-vh') || el.clientWidth <= 1) continue;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) f.push(`${desc(el)} text truncated horizontally (${el.scrollWidth} > ${el.clientWidth})${cs.textOverflow === 'ellipsis' ? ' [ellipsis]' : ''}`);
      if (cs.overflowY !== 'visible' && !/auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) f.push(`${desc(el)} text cut vertically (${el.scrollHeight} > ${el.clientHeight})`);
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { if (!n.textContent.trim() || !rendered(n.parentElement) || n.parentElement.closest('.pc-vh')) continue; let vh = false; for (let a = n.parentElement; a && a !== el; a = a.parentElement) if (a.clientWidth <= 1 && getComputedStyle(a).overflow !== 'visible') vh = true; if (vh) continue; /* visually hidden text */ const rg = document.createRange(); rg.selectNodeContents(n); for (const t of rg.getClientRects()) { if (t.width < 1) continue; if (t.left < r.left - 1 || t.right > r.right + 1 || t.top < r.top - 2 || t.bottom > r.bottom + 2) { f.push(`${desc(el)} text "${n.textContent.trim().slice(0, 24)}" spills out of its box`); break; } } }
    }
    for (const s of document.querySelectorAll('select')) { if (!rendered(s)) continue; const o = s.selectedOptions[0]; if (!o) continue; const c = document.createElement('canvas').getContext('2d'); const cs = getComputedStyle(s); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const need = c.measureText(o.textContent).width; const avail = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); if (need > avail + 1) f.push(`${desc(s)} selected text "${o.textContent}" needs ${need.toFixed(0)} px, has ${avail.toFixed(0)} px`); }
    return [...new Set(f)];
  };
  // Interactive elements whose visible parts intersect each other.
  C.overlap = (scope) => {
    const f = [], els = interactive().filter((e) => !scope || e.closest(scope)).filter((e) => !(e.tagName === 'INPUT' && e.disabled)).map((e) => ({ e, r: clipRect(e, false) })).filter((x) => x.r.width > 1 && x.r.height > 1);
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 1.5 && h > 1.5) f.push(`${desc(a.e)} overlaps ${desc(b.e)} by ${w.toFixed(0)}x${h.toFixed(0)}`);
    }
    return f;
  };
  // Every interactive element can actually be hit at its centre (after scrolling its scroll container).
  C.hittable = (scope) => {
    const f = [], hiddenScrollers = [...document.querySelectorAll('*')].filter((a) => { const cs = getComputedStyle(a); return cs.overflowY === 'hidden' || cs.overflowX === 'hidden'; });
    const scrollers = [...document.querySelectorAll('*')].filter((a) => /auto|scroll/.test(getComputedStyle(a).overflowY + getComputedStyle(a).overflowX));
    for (const el of interactive()) {
      if (el.disabled || (scope && !el.closest(scope))) continue;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      for (const a of hiddenScrollers) if (a.scrollTop || a.scrollLeft) { f.push(`${desc(el)}: reaching it scrolled the non-scrollable box ${desc(a)} by ${a.scrollLeft},${a.scrollTop}`); a.scrollTop = 0; a.scrollLeft = 0; }
      if (scrollX || scrollY) { f.push(`${desc(el)}: page scrolled`); window.scrollTo(0, 0); }
      const r = el.getBoundingClientRect(); const x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { f.push(`${desc(el)} centre outside viewport`); continue; }
      const hit = document.elementFromPoint(x, y); const lab = el.closest('label');
      if (!(hit && (hit === el || el.contains(hit) || (lab && lab.contains(hit))))) f.push(`${desc(el)} covered at its centre by ${desc(hit)}`);
    }
    for (const a of scrollers) { a.scrollTop = 0; a.scrollLeft = 0; }
    return f;
  };
  // Computed text contrast against the effective background. Returns {fail:[], low:[] (disabled, informational), min}.
  C.contrast = (min = 4.5) => {
    const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
    const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
    const lum = (c) => { const g = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]); };
    const bgOf = (el) => { const stack = []; let img = false; for (let a = el; a; a = a.parentElement) { const cs = getComputedStyle(a); const c = parse(cs.backgroundColor); if (cs.backgroundImage !== 'none' && a !== el && a.tagName !== 'SELECT') img = true; if (c[3] > 0) { stack.push(c); if (c[3] === 1) break; } } let base = [255, 255, 255, 1]; for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base); return { c: base, img }; };
    const out = { fail: [], low: [], min: 99, n: 0 };
    for (const el of document.querySelectorAll('body *')) {
      if (!rendered(el) || el.closest('svg, .pc-vh, template')) continue;
      const isCtl = /^(INPUT|SELECT)$/.test(el.tagName) && el.type !== 'range' && el.type !== 'radio' && el.type !== 'checkbox';
      if (!isCtl && ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el); let fg = parse(cs.color); let op = 1; for (let a = el; a; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
      const bg = bgOf(el); fg = over([fg[0], fg[1], fg[2], fg[3] * op], bg.c);
      const L1 = lum(fg), L2 = lum(bg.c); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); out.n++;
      const dis = el.closest(':disabled') || (el.previousElementSibling && el.previousElementSibling.matches('input:disabled')) || (el.closest('label') && el.closest('label').querySelector('input:disabled'));
      const line = `${desc(el)} "${(el.textContent || el.value || '').trim().slice(0, 20)}" ${cr.toFixed(2)} (${cs.color} on rgb(${bg.c.slice(0, 3).map(Math.round)}))`;
      if (cr < min - 0.005) (dis ? out.low : out.fail).push(line); else if (!dis) out.min = Math.min(out.min, cr);
    }
    return out;
  };
  // An open sheet/panel must lie fully inside the stage container (otherwise its end cannot be reached).
  C.insideStage = (hooks) => { const f = []; for (const h of hooks) { const el = q(h); if (!rendered(el)) continue; const r = clipRect(el, true), fr = r.full; if (r.height < fr.height - 1 || r.width < fr.width - 1) f.push(`${h} is cut off by the stage: box ${Math.round(fr.width)}x${Math.round(fr.height)}, only ${Math.round(r.width)}x${Math.round(r.height)} reachable (${Math.round(fr.height - r.height)} px lost vertically, ${Math.round(fr.width - r.width)} px horizontally)`); } return f; };
  C.fonts = () => {
    const ok = /^(system-ui|ui-monospace)/; const f = new Set();
    for (const el of document.querySelectorAll('body *')) { if (!rendered(el)) continue; const ff = getComputedStyle(el).fontFamily; if (!ok.test(ff)) f.add(`${desc(el)}: ${ff}`); }
    return [...f].slice(0, 20);
  };
  C.motion = () => { // call with reduced motion emulated
    const f = [];
    for (const el of document.querySelectorAll('body *')) for (const pe of [null, '::before', '::after']) { const cs = getComputedStyle(el, pe); if (cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0)) f.push(`${desc(el)}${pe || ''} transition ${cs.transitionDuration}`); if (cs.animationName !== 'none') f.push(`${desc(el)}${pe || ''} animation ${cs.animationName}`); }
    return f;
  };
  C.motionPresent = () => { let n = 0; for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0) || cs.animationName !== 'none') n++; } return n; };
  // F1-T1 rule, amended by the TL 2026-11-20 (A-15, F1-T1 plan.md): every visible stage canvas >= min both ways, except the
  // stage-2 site canvas while the phone-portrait query matches; that one is checked by C.siteStrip instead.
  C.SITE_STRIP_MQ = '(max-width: 599px) and (min-height: 481px)';
  C.siteStripApplies = () => !document.querySelector('[data-stage="2"]').hidden && matchMedia(C.SITE_STRIP_MQ).matches;
  C.canvasMin = (min = 200) => { const f = [], skip = C.siteStripApplies() ? q('site-canvas') : null; for (const c of document.querySelectorAll('[data-stage]:not([hidden]) canvas')) { if (c === skip || !rendered(c)) continue; const r = clipRect(c, false); if (r.width < min || r.height < min) f.push(`${desc(c)} visible area ${r.width.toFixed(0)}x${r.height.toFixed(0)}`); } return f; };
  // The exception itself: canvas >= 176 px high (visible area) and full preview width; preview box >= 200 px high (visible
  // area); legend rendered as one line, fully inside the preview, all items shown, and intersecting the canvas nowhere.
  C.siteStrip = ({ canvasMin = 176, boxMin = 200 } = {}) => {
    const f = [], cv = q('site-canvas'), pv = q('site-preview'), lg = q('site-legend');
    if (!rendered(cv)) return ['site canvas not rendered'];
    if (!rendered(lg)) return ['legend strip not rendered'];
    const c = clipRect(cv, false), p = clipRect(pv, false), pr = pv.getBoundingClientRect(), l = lg.getBoundingClientRect();
    const ch = c.bottom - c.top, cw = c.right - c.left, ph = p.bottom - p.top;
    if (ch < canvasMin - 0.01) f.push(`site canvas visible height ${ch.toFixed(1)} < ${canvasMin}`);
    if (cw < Math.min(200, canvasMin)) f.push(`site canvas visible width ${cw.toFixed(1)}`);
    if (Math.abs(c.left - pr.left) > 0.5 || Math.abs(c.right - pr.right) > 0.5 || Math.abs(pr.width - innerWidth) > 0.5) f.push(`site canvas not full width: canvas ${c.left.toFixed(1)}-${c.right.toFixed(1)}, preview ${pr.left.toFixed(1)}-${pr.right.toFixed(1)}, viewport ${innerWidth}`);
    if (ph < boxMin - 0.01) f.push(`preview box visible height ${ph.toFixed(1)} < ${boxMin}`);
    const X = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const cr = cv.getBoundingClientRect();
    if (X(l, cr)) f.push(`legend ${l.top.toFixed(1)}-${l.bottom.toFixed(1)} overlaps the canvas ${cr.top.toFixed(1)}-${cr.bottom.toFixed(1)}`);
    // Items hidden by the app (the "* set by you" mark, F2-T3 pre-step D) are not part of the strip; every rendered item is
    // checked strictly. The mark never shows in phone portrait (Designer D plan).
    const items = [...lg.children].filter((li) => rendered(li)), mark = q('site-legend-mark');
    if (mark && rendered(mark)) f.push('"set by you" legend mark shown in phone portrait');
    if (!items.length) f.push('legend strip has no visible item');
    for (const li of items) { const r = li.getBoundingClientRect(); if (X(r, cr)) f.push(`legend item "${li.textContent.trim()}" overlaps the canvas`); if (r.left < pr.left - 0.5 || r.right > pr.right + 0.5 || r.top < pr.top - 0.5 || r.bottom > pr.bottom + 0.5) f.push(`legend item "${li.textContent.trim()}" outside the preview`); if (li.scrollWidth > li.clientWidth + 0.5) f.push(`legend item "${li.textContent.trim()}" clipped`); }
    if (new Set(items.map((li) => Math.round(li.getBoundingClientRect().top))).size !== 1) f.push('legend strip wraps to more than one line');
    if (lg.scrollWidth > lg.clientWidth + 0.5) f.push(`legend content wider than the strip (${lg.scrollWidth} > ${lg.clientWidth})`);
    if (l.top < cr.bottom - 0.5) f.push(`legend starts above the canvas bottom (${l.top.toFixed(1)} < ${cr.bottom.toFixed(1)})`);
    return f;
  };
  C.siteStripMetrics = () => { const R = (h) => { const r = q(h).getBoundingClientRect(); return [+r.top.toFixed(1), +r.bottom.toFixed(1), +r.height.toFixed(1)]; }; return { canvas: R('site-canvas'), legend: R('site-legend'), preview: R('site-preview') }; };
  C.touchAction = () => { const f = []; for (const c of document.querySelectorAll('canvas')) if (getComputedStyle(c).touchAction !== 'none') f.push(`${desc(c)} touch-action ${getComputedStyle(c).touchAction}`); return f; };
  C.v3panel = () => { const p = q('v3-panel').getBoundingClientRect(), c = q('v3-canvas').getBoundingClientRect(); return { panelW: p.width, panelH: p.height, canvasW: c.width, canvasH: c.height, heightShare: p.height / c.height, areaShare: (p.width * p.height) / (c.width * c.height) }; };
  C.focusState = () => { // describes the indicator of document.activeElement
    const el = document.activeElement; if (!el || el === document.body) return null;
    const ind = (e) => { const cs = getComputedStyle(e); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 ? { w: parseFloat(cs.outlineWidth), color: cs.outlineColor, off: parseFloat(cs.outlineOffset) } : null; };
    let target = el, i = ind(el); if (!i && el.nextElementSibling) { i = ind(el.nextElementSibling); target = el.nextElementSibling; }
    let ringVisible = null;
    if (i) { const r = target.getBoundingClientRect(); const g = i.off + i.w; const ring = { left: r.left - g, top: r.top - g, right: r.right + g, bottom: r.bottom + g }; const inner = { left: r.left - Math.min(0, i.off) * -1, top: r.top, right: r.right, bottom: r.bottom };
      // sides of the ring that survive clipping by ancestors
      let cl = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }; for (let a = target.parentElement; a; a = a.parentElement) { const cs = getComputedStyle(a); const b = a.getBoundingClientRect(); if (cs.overflowX !== 'visible') { cl.left = Math.max(cl.left, b.left); cl.right = Math.min(cl.right, b.right); } if (cs.overflowY !== 'visible') { cl.top = Math.max(cl.top, b.top); cl.bottom = Math.min(cl.bottom, b.bottom); } }
      const need = i.off >= 0 ? ring : r; ringVisible = ['left', 'top'].filter((s) => need[s] >= cl[s] - 0.5).length + ['right', 'bottom'].filter((s) => need[s] <= cl[s] + 0.5).length; }
    return { el: desc(el), rendered: rendered(el) || (el.nextElementSibling && rendered(el.nextElementSibling)), indicator: i, sides: ringVisible, inViewport: (() => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; })() };
  };
  window.__qa = { q, tpl, desc, rendered, clipRect, interactive, S, C };
})();
