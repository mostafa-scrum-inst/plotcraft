// Demo content for screenshots only (not shipped): fills templates and paints canvases from PC.data.palette2d.
window.pcDemo = (function () {
  const $ = h => document.querySelector(`[data-pc="${h}"]`);
  const tpl = h => $(h).content.firstElementChild.cloneNode(true);
  const part = (el, h) => el.querySelector(`[data-pc="${h}"]`);
  const P = () => PC.data.palette2d;
  const PLOT = [[0, 0], [20, 0], [20, 30], [8, 30], [0, 26]];

  function ctxOf(hook) {
    const c = $(hook), r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    c.width = Math.round(r.width * d); c.height = Math.round(r.height * d);
    const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
    g.fillStyle = P().canvas; g.fillRect(0, 0, r.width, r.height);
    return { g, w: r.width, h: r.height };
  }
  function fit(w, h, bw, bh, pad) { const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh); return { s, ox: (w - bw * s) / 2, oy: (h + bh * s) / 2 }; }
  function label(g, t, x, y, font) {
    g.font = font || P().font.label; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 4; g.strokeStyle = P().label.halo; g.strokeText(t, x, y); g.fillStyle = P().label.text; g.fillText(t, x, y);
  }
  function poly(g, T, pts) { g.beginPath(); pts.forEach((p, i) => { const [x, y] = T(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); }
  function grid(g, w, h, f) {
    const p = P();
    for (let m = -10; m <= 60; m++) {
      g.strokeStyle = m % 5 === 0 ? p.grid.major : p.grid.minor; g.lineWidth = p.line.grid;
      const x = Math.round(f.ox + m * f.s) + 0.5, y = Math.round(f.oy - m * f.s) + 0.5;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
  }
  function plot(open) {
    const { g, w, h } = ctxOf('plot-canvas'), p = P(), f = fit(w, h, 20, 30, 34), T = q => [f.ox + q[0] * f.s, f.oy - q[1] * f.s];
    grid(g, w, h, f);
    const pts = open ? PLOT.slice(0, 3) : PLOT;
    if (!open) { poly(g, T, pts); g.fillStyle = p.plot.fill; g.fill(); }
    g.beginPath(); pts.forEach((q, i) => { const [x, y] = T(q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); if (!open) g.closePath();
    g.strokeStyle = p.plot.stroke; g.lineWidth = p.line.plot; g.stroke();
    if (open) { g.setLineDash(p.line.dash); g.strokeStyle = p.plot.live; g.beginPath(); g.moveTo(...T(pts[2])); g.lineTo(...T([9, 27])); g.stroke(); g.setLineDash([]); }
    const lens = ['20.0 m', '30.0 m', '12.0 m', '8.9 m', '26.0 m'];
    pts.forEach((q, i) => { const n = pts[(i + 1) % pts.length]; if (open && i === pts.length - 1) return; const [x, y] = T([(q[0] + n[0]) / 2, (q[1] + n[1]) / 2]); label(g, lens[i], x, y); });
    pts.forEach((q, i) => { const [x, y] = T(q); g.beginPath(); g.arc(x, y, 6, 0, 7); g.fillStyle = p.vertex.fill; g.fill(); g.lineWidth = 2; g.strokeStyle = i === 0 && open ? p.vertex.first : p.vertex.stroke; g.stroke(); });
    if (!open) { const [x, y] = T([10, 14]); label(g, '584 m²', x, y); }
  }
  function site() {
    const { g, w, h } = ctxOf('site-canvas'), p = P(), f = fit(w, h, 20, 30, 16), T = q => [f.ox + q[0] * f.s, f.oy - q[1] * f.s];
    poly(g, T, PLOT); g.fillStyle = p.plot.fill; g.fill();
    g.save(); poly(g, T, PLOT); g.clip(); g.strokeStyle = p.setback.fill; g.lineCap = 'round';
    PLOT.forEach((q, i) => { const n = PLOT[(i + 1) % 5]; g.lineWidth = 2 * (i === 0 ? 3 : 2) * f.s; g.beginPath(); g.moveTo(...T(q)); g.lineTo(...T(n)); g.stroke(); }); g.restore();
    g.setLineDash(p.line.dash); g.strokeStyle = p.setback.line; g.lineWidth = 1.5; poly(g, T, [[2, 3], [18, 3], [18, 28], [8.5, 28], [2, 24.7]]); g.stroke(); g.setLineDash([]);
    const cls = ['front', 'side', 'back', 'back', 'side'];
    PLOT.forEach((q, i) => { const n = PLOT[(i + 1) % 5]; g.strokeStyle = p.edge[cls[i]]; g.lineWidth = i === 0 ? 4 : 2; if (cls[i] === 'side') g.setLineDash([2, 3]); g.beginPath(); g.moveTo(...T(q)); g.lineTo(...T(n)); g.stroke(); g.setLineDash([]); });
    let [x, y] = T([5.25, 23]); g.fillStyle = p.footprint.fill; g.strokeStyle = p.footprint.stroke; g.lineWidth = 2; g.fillRect(x, y, 9.5 * f.s, 15 * f.s); g.strokeRect(x, y, 9.5 * f.s, 15 * f.s);
    [x, y] = T([10, 15.5]); label(g, '142.5 m²', x, y);
    [x, y] = T([9.75, 6.5]); g.fillStyle = p.parking.fill; g.strokeStyle = p.parking.stroke; g.setLineDash(p.line.dash); g.lineWidth = 1.5; g.fillRect(x, y, 5 * f.s, 5 * f.s); g.strokeRect(x, y, 5 * f.s, 5 * f.s); g.setLineDash([]);
    [x, y] = T([7, 27]); g.fillStyle = p.pool.fill; g.strokeStyle = p.pool.stroke; g.fillRect(x, y, 6 * f.s, 3 * f.s); g.strokeRect(x, y, 6 * f.s, 3 * f.s);
    const nx = w - 26, ny = 30; g.fillStyle = p.north.fill; g.beginPath(); g.moveTo(nx, ny - 14); g.lineTo(nx + 7, ny + 10); g.lineTo(nx, ny + 5); g.lineTo(nx - 7, ny + 10); g.closePath(); g.fill();
    g.font = p.font.label; g.fillStyle = p.north.text; g.textAlign = 'center'; g.fillText('N', nx, ny + 22);
  }
  const ROOMS = [['living', 'Living', 0, 0, 6, 7], ['majlis', 'Majlis', 0, 7, 4.5, 5.5], ['dining', 'Dining', 6, 10, 3.5, 5], ['kitchen', 'Kitchen', 6, 0, 3.5, 4], ['maid', "Maid's", 0, 12.5, 2.5, 2.5], ['bathroom', 'Bath', 2.5, 12.5, 2, 2], ['laundry', 'Laundry', 4.5, 7, 1.5, 2.5]];
  function plan(mode) {
    const { g, w, h } = ctxOf('plan-canvas'), p = P(), f = fit(w, h, 9.5, 15, 22), T = q => [f.ox + q[0] * f.s, f.oy - q[1] * f.s];
    const rect = (x, y, rw, rh) => { const [a, b] = T([x, y + rh]); return [a, b, rw * f.s, rh * f.s]; };
    g.fillStyle = p.hall; g.fillRect(...rect(0, 0, 9.5, 15)); 
    ROOMS.forEach(([t, n, x, y, rw, rh], i) => {
      let r = rect(x, y, rw, rh); if (mode === 'invalid' && i === 2) r = rect(5, 9, rw, rh);
      g.fillStyle = p.room[t]; g.fillRect(...r); g.strokeStyle = p.room.stroke; g.lineWidth = p.line.room; g.strokeRect(...r);
      if (mode === 'invalid' && i === 2) { g.fillStyle = p.state.invalidFill; g.fillRect(...r); g.strokeStyle = p.state.invalid; g.lineWidth = 3; g.strokeRect(...r); }
      label(g, n, r[0] + r[2] / 2, r[1] + r[3] / 2 - 7, p.font.room); label(g, (rw * rh).toFixed(0) + ' m²', r[0] + r[2] / 2, r[1] + r[3] / 2 + 8);
    });
    let s = rect(6, 5, 2.5, 4); g.fillStyle = p.stair; g.fillRect(...s); g.strokeStyle = p.coreLine; g.lineWidth = 1; g.strokeRect(...s);
    for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(s[0], s[1] + i * s[3] / 8); g.lineTo(s[0] + s[2], s[1] + i * s[3] / 8); g.stroke(); }
    g.strokeStyle = p.footprint.stroke; g.lineWidth = 2.5; g.strokeRect(...rect(0, 0, 9.5, 15));
    if (mode === 'approved') { g.strokeStyle = p.state.approved; g.lineWidth = 4; g.strokeRect(...rect(0, 0, 9.5, 15)); }
    const sel = rect(0, 0, 6, 7); g.strokeStyle = p.state.selection; g.lineWidth = p.line.selection; g.strokeRect(...sel);
    [[0, 0], [1, 0], [0, 1], [1, 1], [.5, 0], [.5, 1], [0, .5], [1, .5]].forEach(([a, b]) => { g.fillStyle = p.state.handleFill; g.fillRect(sel[0] + a * sel[2] - 5, sel[1] + b * sel[3] - 5, 10, 10); g.strokeRect(sel[0] + a * sel[2] - 5, sel[1] + b * sel[3] - 5, 10, 10); });
  }
  function scene() {
    const c = $('v3-canvas'), r = c.getBoundingClientRect(); c.width = r.width; c.height = r.height; const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, r.height); sky.addColorStop(0, '#BFD6EA'); sky.addColorStop(1, '#E9EEF0'); g.fillStyle = sky; g.fillRect(0, 0, r.width, r.height);
    const cx = r.width / 2, cy = r.height * 0.45, u = Math.min(r.width, r.height) / 5;
    const iso = (x, y, z) => [cx + (x - y) * u * 0.8, cy + (x + y) * u * 0.42 - z * u * 0.8];
    const quad = (pts, col) => { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(...q) : g.moveTo(...q)); g.closePath(); g.fillStyle = col; g.fill(); };
    quad([iso(-2, -2, 0), iso(2, -2, 0), iso(2, 2.4, 0), iso(-2, 2.4, 0)], '#9DBB7C');
    quad([iso(-1, -1, 0.9), iso(1, -1, 0.9), iso(1, 1.4, 0.9), iso(-1, 1.4, 0.9)], '#EDE7DA');
    quad([iso(1, -1, 0), iso(1, 1.4, 0), iso(1, 1.4, 0.9), iso(1, -1, 0.9)], '#C9B58F');
    quad([iso(-1, 1.4, 0), iso(1, 1.4, 0), iso(1, 1.4, 0.9), iso(-1, 1.4, 0.9)], '#D9C7A3');
    quad([iso(-0.8, -0.8, 0.9), iso(0, -0.8, 0.9), iso(0, 0.2, 0.9), iso(-0.8, 0.2, 0.9)], '#D6E2F3');
    quad([iso(0.1, -0.8, 0.9), iso(0.9, -0.8, 0.9), iso(0.9, 0.5, 0.9), iso(0.1, 0.5, 0.9)], '#DCEBC8');
  }
  function fillRooms() {
    const list = $('room-list'); list.textContent = '';
    const data = { 'Ground floor': [['Living', '42 m²', 'living', 'G', 'L'], ['Majlis', '24 m²', 'majlis', 'G', 'M'], ['Kitchen', '14 m²', 'kitchen', 'G', 'M']], 'First floor': [['Master bedroom', '24 m²', 'bedroom', '1', 'L'], ['Bedroom 2', '18 m²', 'bedroom', '1', 'exact']] };
    for (const [name, rows] of Object.entries(data)) {
      const gEl = tpl('tpl-room-group'); part(gEl, 'group-name').textContent = name; part(gEl, 'group-count').textContent = rows.length + ' of 8';
      rows.forEach(([n, a, t, l, s]) => { const r = tpl('tpl-room-row'); part(r, 'room-name').textContent = n; part(r, 'room-area-hint').textContent = a; part(r, 'room-type').value = t; part(r, 'room-level').value = l; part(r, 'room-size').value = s;
        if (t !== 'bedroom') part(r, 'room-master').closest('label').hidden = true; if (n.startsWith('Master')) part(r, 'room-master').checked = true;
        if (s === 'exact') { part(r, 'room-area-box').hidden = false; part(r, 'room-area').value = '18'; } part(gEl, 'group-rows').append(r); });
      list.append(gEl);
    }
    ['Kitchen + Dining (Ground)', 'Master bedroom + Bathroom 1 (First)'].forEach(t => { const r = tpl('tpl-pair-row'); part(r, 'pair-text').textContent = t; $('pair-list').append(r); });
  }
  function fillSummary(kind) {
    $('sum-plot').textContent = '584 m²'; $('sum-buildable').textContent = '390 m²'; $('sum-footprint').textContent = '142.5 m² · 24.4 %'; $('sum-veg').textContent = '146 m² · 25 %';
    $('sum-levels').textContent = ''; $('conflict-list').textContent = '';
    [['Ground', kind === 'block' ? '160' : '120', '142.5 m²'], ['First', '120', '142.5 m²']].forEach(([n, a, b]) => { const r = tpl('tpl-sum-level'); part(r, 'level-name').textContent = n; part(r, 'level-needed').textContent = a; part(r, 'level-available').textContent = b; $('sum-levels').append(r); });
    $('summary').dataset.kind = kind;
    $('sum-status').textContent = kind === 'block' ? '1 conflict, 1 warning' : 'All clear · footprint 142.5 m² (24.4 %)';
    if (kind === 'block') [['block', 'Ground floor: needs 160 m², 143 m² available. Remove or shrink rooms (Q11).'], ['warn', 'Pool does not fit behind or beside the building and is left out of the 3D scene.']].forEach(([k, t]) => { const r = tpl('tpl-conflict'); r.dataset.kind = k; part(r, 'conflict-text').textContent = t; $('conflict-list').append(r); });
  }
  function fillPlans(mode) {
    const tabs = $('plan-tabs'); tabs.textContent = '';
    [['Ground', mode === 'approved' ? 'is-approved' : mode === 'invalid' ? 'is-invalid' : '', true], ['First', '', false]].forEach(([n, c, seld]) => { const t = tpl('tpl-plan-tab'); part(t, 'tab-name').textContent = n; if (c) t.classList.add(c); part(t, 'tab-state').textContent = c === 'is-approved' ? 'Approved' : c === 'is-invalid' ? 'Overlap' : 'Draft'; t.setAttribute('aria-selected', seld); tabs.append(t); });
    $('plan-counter').innerHTML = `<strong>${mode === 'approved' ? 1 : 0} of 2</strong> floors approved`;
    $('plan-room-name').textContent = 'Living'; $('plan-room-dims').textContent = '6.0 × 7.0 m'; $('plan-room-area').textContent = '42 m²';
    $('plan-warn-list').textContent = '';
    const warns = mode === 'invalid' ? [['block', 'Dining overlaps Laundry. Move or resize one of them.'], ['warn', 'Kitchen and Dining no longer share a wall.']] : [['warn', 'Kitchen and Dining could not be placed next to each other.']];
    warns.forEach(([k, t]) => { const r = tpl('tpl-plan-warn'); r.dataset.kind = k; part(r, 'warn-text').textContent = t; $('plan-warn-list').append(r); });
    $('plan-warn-toggle').hidden = false; $('plan-warn-count').textContent = warns.length;
    if (mode === 'approved') { $('btn-approve').classList.add('is-approved'); $('btn-approve-label').textContent = 'Approved'; $('plan-msg').dataset.kind = 'ok'; $('plan-msg').textContent = 'Ground floor approved.'; }
    if (mode === 'invalid') { $('plan-msg').dataset.kind = 'block'; $('plan-msg').textContent = 'Fix the overlap before approving.'; $('btn-approve').disabled = true; }
  }
  function fill3d() {
    const seg = $('v3-level'); [...seg.children].slice(1).forEach(c => c.remove());
    [['G', 'Ground'], ['1', 'First']].forEach(([v, n]) => { const o = tpl('tpl-v3-level'); o.querySelector('input').value = v; part(o, 'level-label').textContent = n; seg.append(o); });
    const s = $('v3-room'); s.length = 1; ['Ground', 'First'].forEach(l => { const og = document.createElement('optgroup'); og.label = l; ['Living', 'Kitchen'].forEach(r => og.append(new Option(r))); s.append(og); });
  }
  function steps(cur) { for (let i = 1; i <= 5; i++) { const b = $('step-' + i); b.className = 'pc-step ' + (i < cur ? 'is-done' : i === cur ? 'is-current' : 'is-locked'); i > cur ? b.setAttribute('aria-disabled', 'true') : b.removeAttribute('aria-disabled'); } }
  function show(n) {
    document.querySelectorAll('[data-stage]').forEach(s => { s.hidden = s.dataset.stage !== String(n); });
    steps(n); $('btn-back').disabled = n === 1; $('btn-next').hidden = n === 5; $('btn-next').disabled = false;
    $('btn-next-label').textContent = ['Next: Questions', 'Next: Floor plans', 'Next: Interior', 'Build 3D model'][n - 1] || '';
  }
  function qGroup(g) { ['site', 'building', 'rooms', 'outdoor'].forEach(k => { $('q-group-' + k).hidden = k !== g; $('q-tab-' + k).setAttribute('aria-selected', k === g); }); }
  function banner(kind, text, action) { const b = tpl('tpl-banner'); b.dataset.kind = kind; part(b, 'banner-text').textContent = text; if (action) { part(b, 'banner-action').hidden = false; part(b, 'banner-action').textContent = action; } $('banner-slot').append(b); }
  function toast(t) { const el = tpl('tpl-toast'); part(el, 'toast-text').textContent = t; $('toast-region').append(el); }
  function plotDone() { $('start-panel').hidden = true; $('plot-area').textContent = '584 m²'; $('plot-perimeter').textContent = '96.9 m'; $('plot-points').textContent = '5'; $('btn-close-shape').disabled = false; $('plot-msg').textContent = 'Drag a corner to adjust the outline.'; }
  return { $, plot, site, plan, scene, fillRooms, fillSummary, fillPlans, fill3d, show, qGroup, banner, toast, plotDone, tpl, part };
})();
