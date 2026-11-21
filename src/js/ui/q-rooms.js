/* PC.ui.qrooms: the Rooms group of stage 2 (Q11-Q14, F2-S2): add form, room list grouped by plan level (rows
   edited in place), must-be-adjacent pairs, and the move / delete / cancel dialog for removing a level that has
   rooms. Every change goes through the R5 gate (PC.store.propose); the rules live in PC.levels. Q14 controls are
   bound by stage-questions.js. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {}, L = PC.levels, U = PC.units, S = PC.store;
  var form = { size: 'M' }, listKey = '', pairKey = '', rows = {}, lastUnit = null;

  function get() { return S.get(); }
  function unit() { return get().ans.unit; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function say(hook, text) { var el = ui.$(hook); el.textContent = text || ''; el.hidden = !text; }
  function area(m2, u) { return U.fmtArea(m2, u); }
  function rangeText(u) { var R = PC.C.RANGE.roomArea; return 'Enter an area from ' + area(R[0], u) + ' to ' + area(R[1], u) + '.'; }
  // Typed area in the current unit -> m2, or null when not acceptable.
  function parseArea(text, u) {
    var n = U.parseNum(text), R = PC.C.RANGE.roomArea;
    if (n === null) return null;
    var m2 = U.areaFromDisplay(n, u);
    return m2 >= R[0] - 1e-6 && m2 <= R[1] + 1e-6 ? Math.max(R[0], Math.min(R[1], m2)) : null;
  }
  function showArea(m2, u) { return String(Math.round(U.areaToDisplay(m2, u))); }
  // Enter finishes a text entry without its default action (F2-T2 QA bug 1: a dialog opened by the commit must not
  // receive the same key press).
  function enterBlurs(el) { ui.on(el, 'keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } }); }
  function fullText(level, r, u) {
    return r.free > 0 ? 'The ' + L.name(level) + ' has ' + r.have + ' rooms: ' + r.free + ' more fit' + (r.free === 1 ? 's' : '') + ' (' + PC.C.MAX_ROOMS_PER_LEVEL + ' per floor).'
      : 'The ' + L.name(level) + ' already has ' + PC.C.MAX_ROOMS_PER_LEVEL + ' rooms, the most per floor.';
  }
  // Try a helper on a copy first: a refusal is shown and nothing is proposed.
  function attempt(fn, onRefused) {
    var r = fn(clone(get()));
    if (!r.ok) { onRefused(r); return Promise.resolve(false); }
    return Promise.resolve(S.propose(function (d) { fn(d); })).then(function (done) { return done ? r : false; });
  }

  /* ---- add form (Q11 type, level, count; Q12 size) ---- */
  function formSize() { var c = ui.$$('input:checked', ui.$('room-add-size'))[0]; return c ? c.value : 'M'; }
  function renderForm(s) {
    var u = s.ans.unit, ids = L.ids(s), lv = ui.$('room-add-level'), type = ui.$('room-add-type').value, size = formSize();
    ui.$$('option', lv).forEach(function (o) { o.disabled = ids.indexOf(o.value) < 0; });
    if (ids.indexOf(lv.value) < 0) lv.value = ids.indexOf('G') >= 0 ? 'G' : ids[0];
    var R = PC.C.RANGE.roomArea, exact = size === 'exact', box = ui.$('room-add-area');
    ui.$('room-add-size-hint').textContent = exact ? 'Exact area: ' + area(R[0], u) + ' to ' + area(R[1], u)
      : size + ' ' + PC.C.ROOM_LABEL[type].toLowerCase() + ' = ' + area(PC.C.ROOM_SIZE[type][size], u);
    ui.$('room-add-area-unit').textContent = U.areaUnit(u);
    box.disabled = !exact;
    if (lastUnit !== null && lastUnit !== u) {                     // the unit changed: convert what is typed
      var m2 = parseArea(box.value, lastUnit);
      if (m2 !== null) box.value = showArea(m2, u);
    }
    lastUnit = u;
  }
  function add() {
    var u = unit(), count = U.parseNum(ui.$('room-add-count').value), size = formSize(), a = null;
    if (!(count >= 1 && count <= PC.C.MAX_ROOMS_PER_LEVEL && Math.floor(count) === count)) { say('room-msg', 'Enter a count from 1 to ' + PC.C.MAX_ROOMS_PER_LEVEL + '.'); return Promise.resolve(false); }
    if (size === 'exact') { a = parseArea(ui.$('room-add-area').value, u); if (a === null) { say('room-msg', rangeText(u)); return Promise.resolve(false); } }
    var o = { type: ui.$('room-add-type').value, level: ui.$('room-add-level').value, size: size === 'exact' ? null : size, area: a, count: count };
    return attempt(function (d) { return L.addRooms(d, o); }, function (r) {
      say('room-msg', r.reason === 'full' ? fullText(o.level, r, u) : r.reason === 'area' ? rangeText(u) : 'This room cannot be added.');
    }).then(function (r) { if (r) { say('room-msg', ''); ui.$('room-add-count').value = '1'; } return r; });
  }

  /* ---- room list ---- */
  function key(s) { return JSON.stringify(L.ids(s).map(function (id) { return [id, L.roomsOn(s, id).map(function (r) { return r.id; })]; })); }
  function buildList(s) {
    var focus = document.activeElement, fRoom = focus && focus.closest ? focus.closest('[data-room]') : null;
    var fHook = fRoom && focus.getAttribute('data-pc'), fId = fRoom && fRoom.getAttribute('data-room');
    var list = ui.$('room-list'); list.textContent = ''; rows = {};
    L.ids(s).forEach(function (id) {
      var g = ui.tpl('tpl-room-group'); g.setAttribute('data-level', id);
      ui.$('group-name', g).textContent = L.name(id);
      L.roomsOn(s, id).forEach(function (r) { ui.$('group-rows', g).appendChild(row(r.id)); });
      list.appendChild(g);
    });
    if (fId && rows[fId]) { var el = ui.$$('[data-pc="' + fHook + '"]', rows[fId].li)[0]; if (el) el.focus({ preventScroll: true }); }
  }
  function row(id) {
    var li = ui.tpl('tpl-room-row'), $ = function (h) { return ui.$(h, li); };
    li.setAttribute('data-room', id);
    var R = { li: li, shown: null };
    rows[id] = R;
    function change(patch, after) {
      return attempt(function (d) { return L.updateRoom(d, id, patch); }, function (r) {
        say('room-msg', r.reason === 'full' ? 'The ' + L.name(patch.level) + ' already has ' + PC.C.MAX_ROOMS_PER_LEVEL + ' rooms, the most per floor.' : rangeText(unit()));
        render(get(), true);
      }).then(function (r) { if (r && after) after(r); if (!r) render(get(), true); return r; });
    }
    ui.on($('room-type'), 'change', function () { change({ type: $('room-type').value }); });
    ui.on($('room-level'), 'change', function () {
      change({ level: $('room-level').value }, function (r) { say('room-msg', r.pairsDropped ? 'Its pairs were removed.' : ''); });
    });
    ui.on($('room-size'), 'change', function () {
      var v = $('room-size').value, cur = find(id);
      if (v === 'exact') change({ size: null, area: L.roomArea(cur) }); else change({ size: v, area: null });
    });
    var inp = $('room-area');
    enterBlurs(inp);
    ui.on(inp, 'change', function () {
      var bad = PC.store.session.invalidFields, k = 'room-area-' + id;
      if (!bad[k] && inp.value === R.shown) return;
      var m2 = parseArea(inp.value, unit());
      if (m2 === null) { bad[k] = { q: 12, label: 'Exact area', min: PC.C.RANGE.roomArea[0], max: PC.C.RANGE.roomArea[1], unitKind: 'area' }; ui.shell.render(); return; }
      delete bad[k]; R.shown = null;
      change({ size: null, area: m2 }).then(function () { ui.shell.render(); });
    });
    ui.on($('room-master'), 'change', function () { change({ master: $('room-master').checked }); });
    ui.on($('room-delete'), 'click', function () { attempt(function (d) { return L.removeRoom(d, id); }, function () {}); });
    return li;
  }
  function find(id) { return get().ans.rooms.filter(function (r) { return r.id === id; })[0]; }
  function renderRows(s) {
    var names = L.roomNames(s), u = s.ans.unit, ids = L.ids(s), bad = PC.store.session.invalidFields;
    ui.$$('[data-level]', ui.$('room-list')).forEach(function (g) {
      var id = g.getAttribute('data-level'), n = L.roomsOn(s, id).length;
      ui.$('group-count', g).textContent = n + ' of ' + PC.C.MAX_ROOMS_PER_LEVEL;
    });
    s.ans.rooms.forEach(function (r) {
      var R = rows[r.id]; if (!R) return;
      var $ = function (h) { return ui.$(h, R.li); }, exact = r.size === null;
      if ($('room-name').textContent !== names[r.id]) $('room-name').textContent = names[r.id];
      $('room-area-hint').textContent = area(L.roomArea(r), u);
      $('room-type').value = r.type;
      ui.$$('option', $('room-level')).forEach(function (o) { o.disabled = ids.indexOf(o.value) < 0; });
      $('room-level').value = r.level;
      $('room-size').value = exact ? 'exact' : r.size;
      $('room-master').checked = r.master;
      $('room-master').closest('label').hidden = r.type !== 'bedroom';
      $('room-area-box').hidden = !exact;
      $('room-area-unit').textContent = U.areaUnit(u);
      var k = 'room-area-' + r.id, inp = $('room-area');
      if (bad[k]) { inp.setAttribute('aria-invalid', 'true'); return; }
      inp.removeAttribute('aria-invalid');
      if (exact) { var t = showArea(r.area, u); if (inp.value !== t) inp.value = t; R.shown = t; }
    });
  }

  /* ---- pairs (Q13) ---- */
  function renderPairs(s) {
    var names = L.roomNames(s), a = ui.$('pair-a'), b = ui.$('pair-b'), k = JSON.stringify([s.ans.rooms.map(function (r) { return [r.id, r.level, names[r.id]]; }), s.ans.pairs, a.value]);
    if (k === pairKey) return;
    pairKey = k;
    var keepA = a.value, keepB = b.value, opt = function (sel, r) { var o = document.createElement('option'); o.value = r.id; o.textContent = names[r.id] + ' · ' + L.name(r.level); sel.appendChild(o); };
    a.length = 1; b.length = 1;
    s.ans.rooms.forEach(function (r) { opt(a, r); });
    a.value = s.ans.rooms.some(function (r) { return r.id === keepA; }) ? keepA : '';
    var ra = s.ans.rooms.filter(function (r) { return r.id === a.value; })[0];
    if (ra) L.roomsOn(s, ra.level).forEach(function (r) { if (r.id !== ra.id) opt(b, r); });
    b.value = ui.$$('option', b).some(function (o) { return o.value === keepB; }) ? keepB : '';
    var list = ui.$('pair-list'); list.textContent = '';
    s.ans.pairs.forEach(function (p) {
      var li = ui.tpl('tpl-pair-row'), lv = s.ans.rooms.filter(function (r) { return r.id === p[0]; })[0].level;
      ui.$('pair-text', li).textContent = names[p[0]] + ' + ' + names[p[1]] + ' · ' + L.name(lv);
      ui.$('pair-delete', li).setAttribute('aria-label', 'Remove pair ' + names[p[0]] + ' + ' + names[p[1]]);
      ui.on(ui.$('pair-delete', li), 'click', function () { attempt(function (d) { return L.removePair(d, p[0], p[1]); }, function () {}); });
      list.appendChild(li);
    });
  }
  function addPair() {
    var a = ui.$('pair-a').value, b = ui.$('pair-b').value;
    if (!a || !b) { say('pair-msg', 'Pick two rooms of the same floor.'); return Promise.resolve(false); }
    return attempt(function (d) { return L.addPair(d, a, b); }, function (r) {
      say('pair-msg', r.reason === 'max' ? 'The ' + L.name(r.level) + ' already has ' + PC.C.MAX_PAIRS_PER_LEVEL + ' pairs, the most per floor.'
        : r.reason === 'levels' ? 'Both rooms must be on the same floor.' : 'Pick two different rooms.');
    }).then(function (r) {
      if (r) { say('pair-msg', r.dup ? 'That pair already exists.' : ''); ui.$('pair-b').value = ''; pairKey = ''; render(get(), true); }
      return r;
    });
  }

  // An invalid exact area belongs to its row: when the room is gone or no longer has an exact size (deleted, set
  // to S / M / L, its level removed), the entry goes too, so no conflict is left that nothing on screen can fix.
  // This subscriber is registered before the shell's, so the shell renders the cleaned list.
  function dropStale(s) {
    var bad = PC.store.session.invalidFields;
    Object.keys(bad).forEach(function (k) {
      if (k.indexOf('room-area-') !== 0) return;
      var id = k.slice('room-area-'.length), r = s.ans.rooms.filter(function (x) { return x.id === id; })[0];
      if (!r || r.size !== null) delete bad[k];
    });
  }

  /* ---- render ---- */
  function render(s, force) {
    renderForm(s);
    var k = key(s);
    if (k !== listKey || force) { buildList(s); listKey = k; }
    renderRows(s);
    renderPairs(s);
  }

  ui.qrooms = {
    init: function () {
      ui.on(ui.$('room-add-type'), 'change', function () { renderForm(get()); });
      ui.$$('input', ui.$('room-add-size')).forEach(function (i) { ui.on(i, 'change', function () { renderForm(get()); }); });
      var count = ui.$('room-add-count');
      enterBlurs(count); enterBlurs(ui.$('room-add-area'));
      [['room-add-count-dec', -1], ['room-add-count-inc', 1]].forEach(function (b) {
        ui.on(ui.$(b[0]), 'click', function () {
          var n = U.parseNum(count.value); n = n === null ? 1 : Math.round(n);
          count.value = String(Math.max(1, Math.min(PC.C.MAX_ROOMS_PER_LEVEL, n + b[1])));
        });
      });
      ui.on(ui.$('btn-room-add'), 'click', add);
      ui.on(ui.$('pair-a'), 'change', function () { pairKey = ''; renderPairs(get()); });
      ui.on(ui.$('btn-pair-add'), 'click', addPair);
      S.subscribe(function (s, prev, meta) {
        if (meta.replace) { say('room-msg', ''); say('pair-msg', ''); listKey = ''; pairKey = ''; }
        dropStale(s);
      });
    },
    render: render,

    // Q7 lowered (or the basement switched off) while a removed level has rooms: one dialog, move / delete / cancel,
    // naming every floor plan with edits or an approval the chosen option destroys (PC.store.atRisk). Resolves true when applied.
    removeLevel: function (change, gone) {
      var s = get(), after = L.ids((function () { var c = clone(s); change(c.ans); return c; })());
      var to = L.nearestLevel(gone[0], after);
      var cands = {}, refused = null;
      ['move', 'delete'].forEach(function (choice) { var c = clone(s), r = L.removeLevels(c, change, choice); cands[choice] = r.ok ? c : null; if (!r.ok) refused = r.reason; });
      var all = L.ids(s).filter(function (id) { return after.indexOf(id) < 0; });
      var plans = function (choice) { return cands[choice] ? L.plansSentence(PC.store.atRisk(cands[choice]), all, s) : ''; };
      var extra = ui.tpl('tpl-level-remove'), mv = ui.$('level-remove-move', extra), del = ui.$('level-remove-delete', extra);
      ui.$('level-remove-text', extra).textContent = L.removalQuestion(s, gone, to, cands.move ? null : refused);
      mv.disabled = !cands.move; if (!cands.move) { mv.checked = false; del.checked = true; }
      var choice = function () { return mv.checked && !mv.disabled ? 'move' : 'delete'; };
      var p = ui.dialog.confirm({ title: 'Remove ' + gone.map(L.name).join(' and ') + '?', text: plans(choice()), ok: 'Remove', cancel: 'Cancel', extra: extra });
      [mv, del].forEach(function (i) { ui.on(i, 'change', function () { var t = ui.$('dialog-text'); t.textContent = plans(choice()); t.hidden = !t.textContent; }); });
      return p.then(function (ok) {
        if (!ok) return false;
        var c = choice(), res = null;
        try { S.commit(function (d) { res = L.removeLevels(d, change, c); if (!res.ok) throw new Error('refused'); }); }
        catch (e) { return false; }                               // a refused move leaves the state untouched
        return res;
      });
    }
  };
})(globalThis.PC = globalThis.PC || {});
