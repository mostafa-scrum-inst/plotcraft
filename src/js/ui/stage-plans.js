/* PC.ui.stages.plans: stage 3 controller (F3-S1..S3): one tab per plan level, the plan drawn in frame L (plot,
   setback zone, footprint as hall, rooms, stair and lift), room selection with its readouts (drawn vs asked area),
   editing through PC.ui.planEditor (move, edge resize, snap; one commit per release), overlaps marked on release,
   Approve / un-approve per floor, warnings, the no-layout message with its link to the room list, Regenerate.
   Plans are kept current by PC.store.go(3) (A-7). */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {}, L = PC.levels, U = PC.units;
  var view = null, editor = null, level = null, selected = null, labels = [], tabKey = '', note = null, undo = null;
  var NO_LAYOUT = 'This floor could not be laid out. Try fewer or smaller rooms on this level, another stair position, or a larger footprint.';
  // Texts: PM round 6 (goals-and-stories.md). The hint fits one line at 360 px (measured: 332 of 336 px), so the
  // PM's long form is used, not the fallback "Drag to move; tap, then drag a handle to resize.".
  var T = {
    hint: 'Drag a room to move it; tap it, then drag a handle to resize.',
    pair: '{a} and {b} overlap. Move or resize the marked rooms to approve this floor.',
    core: '{a} overlaps {c}. Move or resize it to approve this floor.',
    many: '{n} overlaps on this floor. Move or resize the marked rooms to approve it.',
    approved: '{level} approved.', allApproved: 'All floors approved. Next: Interior.',
    backEdit: '{level} is back to Draft. Approve it again when you are done.', backTap: '{level} is back to Draft.',
    regenTitle: 'Regenerate this floor?', regenTail: ' It will be laid out again from the room list.',
    regenEdited: 'Your manual edits to the {level} will be lost.', regenApproved: "The {level}'s approval will be cleared.",
    regenBoth: 'Your manual edits to the {level} and its approval will be lost.',
    // warnings: PM round 8 (pair, low fill) and round 10 (hall access, CD-5); Undo messages: round 10
    unmet: '{a} and {b} are not next to each other. Drag one against the other to join them.',
    noAccess: 'The {a} has no way in from the hall or stairs. Move or resize a neighbouring room to open one.',
    lowFill: 'Rooms fill only {p} % of the {level}. Add rooms, choose larger sizes, or lower the footprint % (Q3).',
    undone: 'Last edit undone.', undoneApproved: 'Last edit undone. {level} approved again.'
  };
  function fill(t, o) { return t.replace(/\{(\w+)\}/g, function (m, k) { return o[k]; }); }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  function get() { return PC.store.get(); }
  function site() { return PC.site.analyse(get()); }
  function plan() { var s = get(); return level ? s.plans[level] : null; }
  // Plan rectangle (frame P) -> world box in frame L.
  function box(fp, r) { return { x0: fp.u + r.x, y0: fp.v + r.y, x1: fp.u + r.x + r.w, y1: fp.v + r.y + r.h }; }
  // Canvas label forms (DP 3, PC.data.roomLabels): tier 0 full name + area, 1 full name, 2 short, 3 tiny (10 px).
  // A tap shows the full name in the readout either way.
  function forms(name, room, area) {
    var t = PC.data.roomLabels[room.master ? 'master' : room.type], n = name.match(/ (\d+)$/), k = n ? n[1] : '';
    return [[name, area], [name], [t.short + (k ? ' ' + k : '')], [t.tiny + k]];
  }
  function problem(s, id) { var p = s.plans[id]; return !p ? 0 : p.error ? 2 : p.unmet.length ? 1 : 0; }

  // The level shown: the previous one while it exists; else the lowest with a problem (no-layout, then unmet
  // pairs); else Ground (TL plan-review ruling 7).
  function pickLevel(s) {
    var ids = L.ids(s);
    if (level && ids.indexOf(level) >= 0) return level;
    var worst = ids.filter(function (id) { return problem(s, id) === 2; })[0] || ids.filter(function (id) { return problem(s, id) === 1; })[0];
    return worst || (ids.indexOf('G') >= 0 ? 'G' : ids[0]);
  }
  function setLevel(id) {
    if (id === level) return;
    level = id; selected = null; note = null; undo = null; editor.cancel(); render(get()); fit();   // undo: on the floor you see (PM round 10)
  }

  /* ---- drawing ---- */
  function fit() {
    var st = site();
    if (!view || !st || !view.width) return;
    // The plan is what this stage is about: fit the footprint with a 0.5 m margin (F3-T2, DP D) and 12 px pads (the plot shows
    // around it; pan and zoom reach the rest). Without a footprint, the plot. Extra side room only when the
    // footprint would reach under the Fit view button (top right), as the site preview does for its compass.
    var f = st.footprint, M = 0.5, PADPX = 12;
    var b = f ? { x0: f.u - M, y0: f.v - M, x1: f.u + f.w + M, y1: f.v + f.d + M } : PC.geom.bbox(st.ptsL);
    var pad = { t: PADPX, r: PADPX, b: PADPX, l: PADPX };
    view.fit(b, pad);
    var btn = ui.$('plan-fit').getBoundingClientRect(), c = view.canvas.getBoundingClientRect();
    if (!f || !btn.width) return;
    var tl = view.toScreen([f.u, f.v + f.d]), br = view.toScreen([f.u + f.w, f.v]);
    var bx = btn.left - c.left - 6, by = btn.bottom - c.top + 6;
    if (Math.max(tl[0], br[0]) > bx && Math.min(tl[1], br[1]) < by) { pad.r = c.right - btn.left + 8; view.fit(b, pad); }
  }
  // Room ids marked invalid on this level (overlaps, evaluated on the stored plan, i.e. after release).
  function invalidIds(s) {
    var out = {};
    if (level) PC.plans.problems(s, level).forEach(function (q) { q.ids.forEach(function (id) { out[id] = true; }); });
    return out;
  }
  function draw(v) {
    var s = get(), st = site(), D = ui.draw2d, P = PC.data.palette2d, unit = s.ans.unit, p = plan();
    labels = [];
    D.clear(v);
    if (!st || !st.footprint) return;
    var fp = st.footprint, names = L.roomNames(s), core = PC.layout.core(fp.w, fp.d, L.stairsExist(s), s.ans.stairPos, L.liftExists(s));
    D.path(v, st.ptsL, { closed: true, fill: P.plot.fill, stroke: P.plot.stroke, width: P.line.plot });
    D.setbackZone(v, st.ptsL, st.setbackOf, { color: P.setback.line, alpha: 0.12 });
    D.rect(v, box(fp, { x: 0, y: 0, w: fp.w, h: fp.d }), { fill: P.hall, stroke: p && p.approved ? P.state.approved : P.footprint.stroke, width: 2 });
    var rooms = p && !p.error ? p.rooms.map(function (r) { return editor.rectOf(r.id); }) : [], byId = {}, bad = editor.dragging() ? {} : invalidIds(s);
    s.ans.rooms.forEach(function (r) { byId[r.id] = r; });
    rooms.forEach(function (r) {
      var room = byId[r.id];
      D.rect(v, box(fp, r), { fill: room ? P.room[room.type] : P.hall, stroke: P.room.stroke, width: P.line.room });
      if (bad[r.id]) D.rect(v, box(fp, r), { fill: P.state.invalidFill, stroke: P.state.invalid, width: P.line.selection });
    });
    [['stair', 'stair'], ['lift', 'lift']].forEach(function (k) {
      var b = core[k[0]], t = PC.data.roomLabels[k[1]];
      if (!b) return;
      D.rect(v, box(fp, b), { fill: P[k[0]], stroke: P.coreLine, width: 1.5 });
      D.boxLabel(v, box(fp, b), [[t.full], [t.short], [t.tiny]], { color: P.label.muted, placed: labels, smallFont: P.font.roomSmall });
    });
    // One tier per room type per level (DP 3): every room of a type (the master with the bedrooms) uses the
    // highest tier any of them needs; a room that fits no form at all stays unlabelled (a tap names it).
    var tiers = {}, need = {}, fonts = [P.font.room, P.font.room, P.font.room, P.font.roomSmall];
    rooms.forEach(function (r) {
      var room = byId[r.id];
      if (!room) return;
      var f = forms(names[r.id], room, U.fmtArea(r.w * r.h, unit)), b = box(fp, r), k = 0;
      while (k < 4 && !D.labelFits(v, b, f[k], { font: fonts[k] })) k++;
      need[r.id] = k;
      if (k < 4) tiers[room.type] = Math.max(tiers[room.type] || 0, k);
    });
    rooms.forEach(function (r) {
      var room = byId[r.id];
      if (!room || need[r.id] === 4) return;
      var k = Math.max(tiers[room.type], need[r.id]);
      if (k > 3) return;
      D.boxLabel(v, box(fp, r), forms(names[r.id], room, U.fmtArea(r.w * r.h, unit))[k], { font: fonts[k], placed: labels });
    });
    editor.drawOverlay(v);
  }
  function roomAt(world) {
    var st = site(), p = plan();
    if (!st || !st.footprint || !p || p.error) return null;
    var x = world[0] - st.footprint.u, y = world[1] - st.footprint.v;
    var hit = p.rooms.filter(function (r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; });
    return hit.length ? hit[hit.length - 1].id : null;
  }

  /* ---- panel ---- */
  function renderTabs(s) {
    var ids = L.ids(s), wrap = ui.$('plan-tabs'), k = JSON.stringify(ids);
    if (k !== tabKey) {
      tabKey = k; wrap.textContent = '';
      ids.forEach(function (id) {
        var t = ui.tpl('tpl-plan-tab');
        t.setAttribute('data-level', id);
        ui.$('tab-name', t).textContent = L.name(id);
        ui.on(t, 'click', function () { setLevel(id); });
        ui.on(t, 'keydown', function (e) {
          var i = ids.indexOf(id), j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : null;
          if (j === null) return;
          e.preventDefault(); j = (j + ids.length) % ids.length; setLevel(ids[j]);
          ui.$$('[data-level="' + ids[j] + '"]', wrap)[0].focus();
        });
        wrap.appendChild(t);
      });
    }
    ui.$$('[data-level]', wrap).forEach(function (t) {
      var id = t.getAttribute('data-level'), p = s.plans[id], on = id === level;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      t.classList.toggle('is-approved', !!(p && p.approved));
      t.classList.toggle('is-invalid', !!(p && p.error));
      ui.$('tab-state', t).textContent = !p ? '' : p.error ? 'Cannot be laid out' : p.approved ? 'Approved' : 'Draft';
    });
  }
  function warnings(s) {
    var p = plan(), names = L.roomNames(s), out = [];
    if (p && !p.error) p.unmet.forEach(function (q) { out.push({ kind: 'warn', text: fill(T.unmet, { a: names[q[0]], b: names[q[1]] }) }); });
    if (level) {
      PC.plans.noAccess(s, level).forEach(function (id) { out.push({ kind: 'warn', text: fill(T.noAccess, { a: names[id] }) }); });
      var pct = PC.plans.lowFill(s, level);
      if (pct !== null) out.push({ kind: 'warn', text: fill(T.lowFill, { p: pct, level: L.name(level) }) });
    }
    PC.validate(s).warnings.forEach(function (w) { out.push({ kind: 'warn', text: w.text }); });
    return out;
  }
  function renderPanel(s) {
    var ids = L.ids(s), n = ids.filter(function (id) { return s.plans[id] && s.plans[id].approved; }).length, p = plan();
    ui.$('plan-counter').textContent = n + ' of ' + ids.length + ' floor' + (ids.length === 1 ? '' : 's') + ' approved';
    var err = ui.$('plan-error');
    err.hidden = !(p && p.error);
    ui.$('plan-error-text').textContent = NO_LAYOUT;
    var list = ui.$('plan-warn-list'), ws = warnings(s);
    list.textContent = '';
    ws.forEach(function (w) { var li = ui.tpl('tpl-plan-warn'); li.setAttribute('data-kind', w.kind); ui.$('warn-text', li).textContent = w.text; list.appendChild(li); });
    ui.$('plan-warn-toggle').hidden = !ws.length;
    ui.$('plan-warn-count').textContent = String(ws.length);
    // selection readout: the transient rectangle while it is dragged; drawn vs asked area (QA obs 6, PM round 6)
    var r = p && !p.error && selected ? editor.rectOf(selected) : null, unit = s.ans.unit;
    if (!r) selected = null;
    var room = r ? s.ans.rooms.filter(function (q) { return q.id === r.id; })[0] : null;
    var drawn = r ? U.fmtArea(r.w * r.h, unit) : '', asked = room ? U.fmtArea(L.roomArea(room), unit) : '';
    ui.$('plan-room-name').textContent = r ? L.roomNames(s)[r.id] : 'None selected';
    ui.$('plan-room-dims').textContent = r ? U.fmtDims(r.w, r.h, unit) : '–';
    ui.$('plan-room-area').textContent = r ? drawn + (asked && asked !== drawn ? ' (asked ' + asked + ')' : '') : '–';
    // (No freeze during drags is needed: the message line has a fixed height since the Designer's F3-T2 fixes, so
    // a message change never resizes the canvas under the finger.)
    var m = message(s), msg = ui.$('plan-msg');
    msg.textContent = m.text; msg.setAttribute('data-kind', m.kind);
    var why = p ? PC.plans.canApprove(s, level) : 'none', btn = ui.$('btn-approve'), on = !!(p && p.approved);
    btn.disabled = why === 'none' && !on;
    btn.setAttribute('aria-disabled', String(why === 'overlap'));
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('is-approved', on);
    ui.$('btn-approve-label').textContent = on ? 'Approved' : 'Approve floor';
    ui.$('btn-regenerate').disabled = !p;
    if (undo && (undo.level !== level || !PC.plans.undoable(s, undo))) undo = null;
    ui.$('plan-undo').hidden = !undo;
  }
  // One-step "Undo last edit" (PM rounds 8 and 10): the shown floor's plan as it was before the last move / resize,
  // approval included. The snapshot is guarded by content (PC.plans.undoable), so it cannot outlive a new edit,
  // Regenerate, an R5 reset or an approval change; a floor-tab switch and leaving stage 3 drop it too.
  function undoLast() {
    var u = undo, s = get();
    if (!u || u.level !== level || !PC.plans.undoable(s, u)) { undo = null; renderPanel(s); return; }
    undo = null; selected = null;
    var back = u.before.approved && !u.after.approved;
    note = { level: u.level, text: back ? fill(T.undoneApproved, { level: cap(L.name(u.level)) }) : T.undone };
    PC.store.commit(function (d) { PC.plans.undoEdit(d, u); });
    ui.$('btn-regenerate').focus();                     // the pressed button hides; keep the keyboard place (Designer)
  }
  // The stage message line (one at a time): overlap reason (blocks approval), then the latest note on this floor,
  // then "approved", else the hint. Nothing while the no-layout banner speaks.
  function message(s) {
    var p = plan(), names = L.roomNames(s), nm = function (id) { return names[id]; };
    if (!p) return { kind: 'info', text: '' };
    if (p.error) return { kind: 'info', text: '' };
    var probs = PC.plans.problems(s, level);
    if (probs.length) {
      var core = probs.filter(function (q) { return q.code === 'overlap-core'; }), one = probs.length === 1;
      var sameRoomCore = probs.length === 2 && core.length === 2 && core[0].ids[0] === core[1].ids[0];
      if (one && probs[0].code === 'overlap-room') return { kind: 'block', text: fill(T.pair, { a: nm(probs[0].ids[0]), b: nm(probs[0].ids[1]) }) };
      if (one || sameRoomCore) return { kind: 'block', text: fill(T.core, { a: nm(probs[0].ids[0]), c: sameRoomCore ? 'the stairs and lift' : probs[0].ids[1] === 'lift' ? 'the lift' : 'the stairs' }) };
      return { kind: 'block', text: fill(T.many, { n: probs.length }) };
    }
    if (note && note.level === level) return { kind: 'info', text: note.text };
    if (p.approved) return { kind: 'info', text: fill(T.approved, { level: cap(L.name(level)) }) };
    return { kind: 'info', text: T.hint };
  }
  function render(s) {
    if (!view) return;
    level = pickLevel(s);
    renderTabs(s);
    renderPanel(s);
    view.resize();
    view.invalidate();
  }

  // Regenerate this floor: asks only when the floor holds manual edits or an approval (R5 round 5, PM round 6).
  function regenerate() {
    var p = plan(), id = level, nameL = L.name(id);
    if (!p) return Promise.resolve(false);
    var text = p.edited && p.approved ? T.regenBoth : p.edited ? T.regenEdited : T.regenApproved;
    var go = PC.plans.hasWork(p) ? ui.dialog.confirm({ title: T.regenTitle, text: fill(text, { level: nameL }) + T.regenTail, ok: 'Regenerate', cancel: 'Cancel' }) : Promise.resolve(true);
    return go.then(function (ok) {
      if (ok) { selected = null; note = null; undo = null; PC.store.commit(function (d) { PC.plans.regenerate(d, id); }); }
      return ok;
    });
  }
  // Approve floor / tap "Approved" to return it to Draft (F3-S3, TL ruling 6). Refused with the reason while
  // the floor has an overlap (the message line already shows it; the button is aria-disabled, not disabled).
  function approve() {
    var s = get(), id = level, p = plan();
    if (!p) return;
    if (p.approved) {
      note = { level: id, text: fill(T.backTap, { level: cap(L.name(id)) }) };
      PC.store.commit(function (d) { PC.plans.unapprove(d, id); });
      return;
    }
    if (PC.plans.canApprove(s, id)) { renderPanel(s); return; }
    PC.store.commit(function (d) { PC.plans.approve(d, id); });
    var t = get(), all = L.ids(t).every(function (k) { return t.plans[k] && t.plans[k].approved; });
    note = { level: id, text: all ? T.allApproved : fill(T.approved, { level: cap(L.name(id)) }) };
    renderPanel(t);
  }

  ui.stages = ui.stages || {};
  ui.stages.plans = {
    init: function () {
      var canvas = ui.$('plan-canvas');
      view = new ui.View2D(canvas, {
        draw: draw,
        onResize: function () { fit(); },
        onTap: function (world) { var id = roomAt(world); if (id !== selected) { selected = id; renderPanel(get()); view.invalidate(); } },
        hitTest: function (sx, sy, type) { return editor.hitTest(sx, sy, type); },
        onDragStart: function (h, w) { editor.onDragStart(h, w); },
        onDragMove: function (h, w) { editor.onDragMove(h, w); },
        onDragEnd: function (h, w, cancelled) { editor.onDragEnd(h, w, cancelled); }
      });
      editor = ui.planEditor({
        view: view,
        level: function () { return level; },
        selected: function () { return selected; },
        select: function (id) { selected = id; },
        footprint: function () { var st = site(); return st ? st.footprint : null; },
        changed: function () { renderPanel(get()); view.invalidate(); },
        // an edit on an approved floor returns it to Draft: told once, on that transition (F3-S3)
        committed: function (r) {
          note = r.wasApproved ? { level: r.level, text: fill(T.backEdit, { level: cap(L.name(r.level)) }) } : (note && note.level === r.level ? null : note);
          undo = r.before ? { level: r.level, before: r.before, after: r.after } : null;
        }
      });
      ui.View2D.named.plan = view;
      ui.on(ui.$('plan-fit'), 'click', function () { fit(); view.invalidate(); });
      ui.on(ui.$('btn-regenerate'), 'click', regenerate);
      ui.on(ui.$('btn-approve'), 'click', approve);
      ui.on(ui.$('plan-undo'), 'click', undoLast);
      ui.on(ui.$('btn-goto-rooms'), 'click', function () {
        var id = level;
        if (PC.store.go(2)) ui.stages.questions.goTo(11, id);
      });
      ui.on(ui.$('plan-warn-toggle'), 'click', function () {
        var panel = ui.$('plan-warn-panel'), open = panel.classList.contains('is-collapsed');
        panel.classList.toggle('is-collapsed', !open); ui.$('plan-warn-toggle').setAttribute('aria-expanded', String(open));
      });
      PC.store.subscribe(function (s, prev, meta) { if (meta.replace) { level = null; selected = null; tabKey = ''; note = null; undo = null; editor.cancel(); } });
      Object.assign(PC.debug, {
        planLabels: function () { view.drawNow(); return labels.map(function (l) { return { text: l.text, x: l.x, y: l.y, w: l.w, h: l.h }; }); },
        planView: function () { return { level: level, selected: selected, scale: view.scale }; },
        // F3-T2: the editor's handle centres (viewport px) of a room on this level, and the drag in progress
        planHandles: function (id) { var r = view.canvas.getBoundingClientRect(); return editor.spots(id).map(function (h) { return { kind: h.kind, x: r.left + h.x, y: r.top + h.y }; }); },
        planDrag: function () { return editor.dragging(); }
      });
      ui.shell.register(3, { enter: function () { selected = null; note = null; undo = null; editor.cancel(); render(get()); fit(); view.invalidate(); }, render: render });
    }
  };
})(globalThis.PC = globalThis.PC || {});
