/* PC.ui.stages.questions: stage 2 controller for Q1-Q10 and Q15-Q17 (Q11-Q14 controls: F2-T3; their group is
   shown as static markup and has no handlers here). Controls are bound through PC.ui.qfields; layout-class
   answers go through PC.store.propose (R5 gate), appearance answers through commit. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {}, F = null, S = PC.store;
  var GROUPS = [{ id: 'site', qs: [1, 2, 3, 4, 5, 6] }, { id: 'building', qs: [7, 8, 9, 10] }, { id: 'rooms', qs: [11, 12, 13, 14] }, { id: 'outdoor', qs: [15, 16, 17] }];
  var TOTAL = 17, LIVE_MS = 50;
  var group = 0, opened = { 0: true }, binds = [], roofNote = false;
  var tapMode = 'street';                                // what a preview edge tap does (F2-S4); session only
  var pending = null, liveOff = false, liveFrame = 0;     // pending: function (draft) applying a value still being dragged

  function get() { return S.get(); }
  function propose(fn) { return S.propose(fn); }
  function commit(fn) { S.commit(fn); }

  // What preview and summary show: the state, plus the value under the user's finger while a slider or the compass moves.
  function viewState() {
    if (!pending) return get();
    var c = JSON.parse(JSON.stringify(get()));
    pending(c);
    return c;
  }
  function refreshSide() { ui.qpreview.render(); ui.summary.render(viewState()); }
  // Live feedback during a drag: at most one site analysis per frame; when one takes over LIVE_MS the rest of this
  // drag only moves the value label and everything else follows on release.
  function live(fn) {
    pending = fn;
    if (!fn) { liveOff = false; refreshSide(); return; }
    if (liveOff || liveFrame) return;
    liveFrame = requestAnimationFrame(function () {
      liveFrame = 0;
      if (!pending || liveOff) return;
      var t = performance.now();
      PC.site.analyse(viewState());
      if (performance.now() - t > LIVE_MS) { liveOff = true; return; }
      refreshSide();
    });
  }

  /* ---- groups and progress ---- */
  function showGroup(i) {
    group = Math.max(0, Math.min(GROUPS.length - 1, i)); opened[group] = true;
    render(get());
    ui.$('q-group-' + GROUPS[group].id).scrollIntoView({ block: 'start' });
  }
  function renderGroups() {
    var left = 0;
    GROUPS.forEach(function (g, i) {
      ui.$('q-tab-' + g.id).setAttribute('aria-selected', String(i === group));
      ui.$('q-group-' + g.id).hidden = i !== group;
      if (i === group || !opened[i]) left += g.qs.length;
    });
    ui.$('q-progress-text').textContent = 'Group ' + (group + 1) + ' of ' + GROUPS.length + ' · ' + left + ' question' + (left === 1 ? '' : 's') + ' left';
    var bar = ui.$('q-progress-bar'); bar.max = TOTAL; bar.value = TOTAL - left;
  }
  // "Fix" on a conflict: open the question's group, bring the question into view, focus its invalid field, else its
  // first control. A room conflict of one level (empty floor, needed over available) lands on that level's room
  // list: its first room, or the add form set to that level when it has none (F2-T3, TL binding note).
  function goToQuestion(q, level) {
    var i = GROUPS.findIndex(function (g) { return g.qs.indexOf(q) >= 0; });
    if (i >= 0 && i !== group) showGroup(i);
    if (q === 11 && level) {
      var g = ui.$$('[data-level="' + level + '"]', ui.$('room-list'))[0], first = g && ui.$$('[data-pc="room-type"]', g)[0];
      if (first) { g.scrollIntoView({ block: 'start' }); first.focus({ preventScroll: true }); return; }
      ui.$('room-add-level').value = level; ui.qrooms.render(get());
      ui.$$('[data-stage="2"] [data-q="11"]')[0].scrollIntoView({ block: 'start' });
      ui.$('room-add-type').focus({ preventScroll: true });
      return;
    }
    var block = ui.$$('[data-stage="2"] [data-q="' + (q === 12 ? 11 : q) + '"]')[0];
    if (!block) return;
    block.scrollIntoView({ block: 'start' });
    var ctl = ui.$$('[aria-invalid="true"]', block)[0] || ui.$$('input:not([disabled]), select:not([disabled]), button:not([disabled])', block)[0];
    if (ctl) ctl.focus({ preventScroll: true });
  }

  /* ---- Q7: levels ---- */
  // Changes floors / basement / usable roof. Rooms may never sit on a level that no longer exists: when the change
  // removes a level that has rooms, the move / delete / cancel dialog of q-rooms.js asks first (one dialog, R5 text
  // included) and then commits; otherwise the change goes through the R5 gate.
  function setLevels(change) {
    var s = get(), cand = JSON.parse(JSON.stringify(s));
    change(cand.ans);
    var gone = PC.levels.ids(s).filter(function (id) { return PC.levels.ids(cand).indexOf(id) < 0; });
    var withRooms = gone.filter(function (id) { return PC.levels.roomsOn(s, id).length > 0; });
    if (!withRooms.length) return propose(function (d) { if (PC.levels.removeLevels(d, change, 'delete').roofSwitched) roofNote = true; });
    return ui.qrooms.removeLevel(change, withRooms).then(function (res) {
      if (res && res.roofSwitched) roofNote = true;
      render(get());
      return !!res;
    });
  }

  /* ---- bindings: one entry per control ---- */
  function bind() {
    var U = PC.units, R = PC.C.RANGE;
    ['front', 'back', 'side'].forEach(function (k) {
      binds.push(F.number({ hook: 'q-setback-' + k, key: 'setback-' + k, q: 2, label: { front: 'Front', back: 'Back', side: 'Side' }[k] + ' setback', kind: 'len',
        min: R.setback[0], max: R.setback[1], read: function (s) { return s.ans.setbacks[k]; },
        apply: function (v) { return propose(function (d) { d.ans.setbacks[k] = v; }); } }));
    });
    var pctText = function (v) { return v + ' %'; }, same = function (v) { return v; };
    binds.push(F.slider({ hook: 'q-footprint', read: function (s) { return s.ans.footprintPct; }, toCtl: same, fromCtl: same, text: pctText,
      apply: function (v) { return propose(function (d) { d.ans.footprintPct = v; }); }, live: function (v) { live(v === null ? null : function (d) { d.ans.footprintPct = v; }); } }));
    binds.push(F.slider({ hook: 'q-veg', read: function (s) { return s.ans.vegPct; }, toCtl: same, fromCtl: same, text: pctText,
      apply: function (v) { commit(function (d) { d.ans.vegPct = v; }); }, live: function (v) { live(v === null ? null : function (d) { d.ans.vegPct = v; }); } }));
    // Q8: the slider works in the current unit (m: 2.4-4.5 step 0.1; ft: 8.0-14.5 step 0.5) and stores metres.
    binds.push(F.slider({ hook: 'q-ceiling', read: function (s) { return s.ans.ceilingH; },
      attrs: function (unit) { return unit === 'ft' ? { min: 8, max: 14.5, step: 0.5 } : { min: R.ceilingH[0], max: R.ceilingH[1], step: 0.1 }; },
      toCtl: function (v, unit) { var x = U.toDisplay(v, unit), st = unit === 'ft' ? 0.5 : 0.1; return Math.round(Math.round(x / st) * st * 10) / 10; },
      fromCtl: function (x, unit) { return Math.max(R.ceilingH[0], Math.min(R.ceilingH[1], Math.round(U.fromDisplay(x, unit) * 1e4) / 1e4)); },
      text: function (v, unit) { return U.toDisplay(v, unit).toFixed(1); },
      apply: function (v) { commit(function (d) { d.ans.ceilingH = v; }); } }));
    binds.push(F.radios({ hook: 'q-unit', read: function (s) { return s.ans.unit; }, apply: function (v) { S.commit(function (d) { d.ans.unit = v; }, { keepSample: true }); } }));
    binds.push(F.radios({ hook: 'q-floors', read: function (s) { return s.ans.floors; }, apply: function (v) { setLevels(function (a) { a.floors = Number(v); }); } }));
    binds.push(F.toggle({ hook: 'q-basement', read: function (s) { return s.ans.basement; }, apply: function (on) { setLevels(function (a) { a.basement = on; }); } }));
    binds.push(F.toggle({ hook: 'q-usable-roof', read: function (s) { return s.ans.usableRoof; }, apply: function (on) { setLevels(function (a) { a.usableRoof = on; }); } }));
    binds.push(F.radios({ hook: 'q-roof', read: function (s) { return s.ans.roofType; }, disabled: function (s, v) { return v === 'pitched' && s.ans.usableRoof; },
      apply: function (v) { roofNote = false; commit(function (d) { d.ans.roofType = v; }); } }));
    // Q14: stair position and lift (layout class: through the R5 gate); shown only when stairs exist.
    binds.push(F.radios({ hook: 'q-stair-pos', read: function (s) { return s.ans.stairPos; }, apply: function (v) { return propose(function (d) { d.ans.stairPos = v; }); } }));
    binds.push(F.toggle({ hook: 'q-lift', read: function (s) { return s.ans.lift; }, apply: function (on) { return propose(function (d) { d.ans.lift = on; }); } }));
    binds.push(F.radios({ hook: 'q-exterior', read: function (s) { return s.ans.exterior; }, apply: function (v) { commit(function (d) { d.ans.exterior = v; }); } }));
    binds.push(F.number({ hook: 'q-parking-cars', key: 'parking-cars', q: 15, label: 'Number of cars', kind: 'count', min: R.cars[0], max: R.cars[1],
      read: function (s) { return s.ans.parking.cars; }, apply: function (v) { commit(function (d) { d.ans.parking.cars = v; }); } }));
    binds.push(F.toggle({ hook: 'q-parking-covered', read: function (s) { return s.ans.parking.covered; }, apply: function (on) { commit(function (d) { d.ans.parking.covered = on; }); } }));
    binds.push(F.toggle({ hook: 'q-pool', read: function (s) { return s.ans.pool.on; }, apply: function (on) { commit(function (d) { d.ans.pool.on = on; }); } }));
    binds.push(F.radios({ hook: 'q-pool-size', read: function (s) { return s.ans.pool.size; }, disabled: function (s) { return !s.ans.pool.on; },
      apply: function (v) { commit(function (d) { d.ans.pool.size = v; }); } }));
    binds.push(F.toggle({ hook: 'q-wall', read: function (s) { return s.ans.extras.wall; }, apply: function (on) { commit(function (d) { d.ans.extras.wall = on; }); } }));
    binds.push(F.radios({ hook: 'q-gate', read: function (s) { return s.ans.extras.gate; }, apply: function (v) { commit(function (d) { d.ans.extras.gate = v; }); } }));
    binds.push(F.toggle({ hook: 'q-seating', read: function (s) { return s.ans.extras.seating; }, apply: function (on) { commit(function (d) { d.ans.extras.seating = on; }); } }));
  }

  // Q5 and Q6 readouts, notes and other texts that follow the state.
  function renderTexts(s) {
    var U = PC.units, unit = s.ans.unit, site = PC.site.analyse(s), n = s.plot.pts.length;
    var deg = Math.round(PC.frames.northL(s)) % 360;       // whole degrees (on a slanted street it is not whole)
    ui.$('q-north-value').textContent = s.ans.north === null || deg === 0 ? '0° · toward the back' : deg + '° clockwise from the back';
    if (site) {
      var a = s.plot.pts[site.edge], b = s.plot.pts[(site.edge + 1) % n];
      ui.$('q-street-value').textContent = 'Edge ' + (site.edge + 1) + ' of ' + n + ' · ' + U.fmtLen(PC.geom.dist(a, b), unit);
    }
    ui.$('q-ceiling-unit').textContent = U.lenUnit(unit);
    ui.$$('input', ui.$('site-tap-mode')).forEach(function (i) { i.checked = i.value === tapMode; });
    ui.$('site-tap-hint').hidden = tapMode !== 'class';
    ui.$('site-legend-mark').hidden = !Object.keys(s.ans.edgeOv).length;
    ui.qedges.render(s);
    var stairs = PC.levels.stairsExist(s);
    ui.$('q-stairs-box').hidden = !stairs; ui.$('q-stairs-none').hidden = stairs;
    ui.qrooms.render(s);
    ui.$('q-roof-note').hidden = !(roofNote && s.ans.usableRoof);
    ui.$('q-pool-size-note').textContent = PC.C.SIZES.map(function (k) { var p = PC.C.POOL[k]; return k + ' ' + U.fmtDims(p.w, p.d, unit); }).join(' · ');
  }

  function render(s) {
    if (!F) return;
    if (!s.ans.usableRoof) roofNote = false;
    binds.forEach(function (b) { b.render(s); });
    renderGroups();
    renderTexts(s);
    refreshSide();
  }

  ui.stages = ui.stages || {};
  ui.stages.questions = {
    // Fix-style navigation from another stage (F3-T1: the no-layout link opens a level's room list).
    goTo: function (q, level) { goToQuestion(q, level); },
    init: function () {
      F = ui.qfields;
      bind();
      GROUPS.forEach(function (g, i) { ui.on(ui.$('q-tab-' + g.id), 'click', function () { showGroup(i); }); });
      ['site', 'building', 'rooms'].forEach(function (id, i) { ui.on(ui.$('btn-q-continue-' + id), 'click', function () { showGroup(i + 1); }); });
      // Q5: 15 degree steps, reset to the default
      ui.on(ui.$('q-north-cw'), 'click', function () { commit(function (d) { d.ans.north = PC.frames.northStep(d, 1); }); });
      ui.on(ui.$('q-north-ccw'), 'click', function () { commit(function (d) { d.ans.north = PC.frames.northStep(d, -1); }); });
      ui.on(ui.$('q-north-reset'), 'click', function () { commit(function (d) { d.ans.north = null; }); });
      // Q6: step through the edges (the preview offers a tap on the edge itself)
      function street(dir) { var s = get(), n = s.plot.pts.length, e = PC.frames.streetEdge(s); propose(function (d) { d.ans.streetEdge = (e + dir + n) % n; }); }
      ui.on(ui.$('q-street-next'), 'click', function () { street(1); });
      ui.on(ui.$('q-street-prev'), 'click', function () { street(-1); });
      // F2-S4: switch one edge between back and side (through the R5 gate, like a setback).
      function toggleEdge(i) { return propose(function (d) { PC.site.toggleEdge(d, i); }); }
      function setTapMode(m) { tapMode = m === 'class' ? 'class' : 'street'; render(get()); }
      ui.$$('input', ui.$('site-tap-mode')).forEach(function (i) { ui.on(i, 'change', function () { if (i.checked) setTapMode(i.value); }); });
      ui.qedges.init({ toggleEdge: toggleEdge });
      ui.qrooms.init();
      ui.qpreview.init({
        state: viewState,
        tapMode: function () { return tapMode; },
        toggleEdge: toggleEdge,
        streetTapped: function () { ui.toast('The street edge is always front (change it with Q6)'); },
        setStreet: function (i) { propose(function (d) { d.ans.streetEdge = i; }); },
        northLive: function (degL) { var s = get(); live(degL === null ? null : function (d) { d.ans.north = PC.frames.northToW(s, degL); }); },
        northSet: function (degL) { commit(function (d) { d.ans.north = PC.frames.northToW(d, degL); }); }
      });
      ui.summary.init(goToQuestion);
      // A numeric field under the on-screen keyboard is brought back into view.
      ui.$$('[data-stage="2"] input.pc-input').forEach(function (el) { ui.on(el, 'focus', function () { el.scrollIntoView({ block: 'nearest' }); }); });
      S.subscribe(function (s, prev, meta) {
        if (meta.replace) { group = 0; opened = { 0: true }; roofNote = false; tapMode = 'street'; PC.store.session.invalidFields = {}; }
        // Overrides cleared by an outline or street-edge change are announced once (F2-S4); a whole-state replace
        // (Load sample, Start new, Resume) and a cancelled change never are.
        if (!meta.replace && !meta.cancelled && prev && Object.keys(prev.ans.edgeOv).length && !Object.keys(s.ans.edgeOv).length) {
          var outline = JSON.stringify(prev.plot) !== JSON.stringify(s.plot);
          if (outline || PC.frames.streetEdge(prev) !== PC.frames.streetEdge(s))
            ui.toast('Back / side choices were reset because ' + (outline ? 'the outline changed' : 'the street edge changed'));
        }
        if (meta.cancelled || meta.replace) { pending = null; liveOff = false; }      // a cancelled change leaves no pending value behind
      });
      ui.shell.register(2, { enter: function () { tapMode = 'street'; render(get()); }, render: render });
      Object.assign(PC.debug, { tapMode: function () { return tapMode; } });
    }
  };
})(globalThis.PC = globalThis.PC || {});
