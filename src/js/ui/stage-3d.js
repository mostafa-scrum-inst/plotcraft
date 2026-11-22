/* PC.ui.stages.view3d: stage 5 controller (F4-S1 / F4-S2, F4-T1). Builds the house model from the store, hands it
   to PC.view3d (three layer) and owns the stage-5 DOM: Building... / unavailable overlays, the level selector
   ("All" + the house's own levels, lowest first; PM round 9 labels), Reset view, the collapsible panel and its tabs.
   Session state only (A-4): level selection and roof toggle survive leaving and returning; the view opens on All
   with the roof off. Controls of later tasks (room finder, tour) are disabled here (TL F4-T1 ruling 3); the Roof
   switch is enabled since F4-T2. Light tab (F4-T3, A-13; Designer F4-T3 plan 3): the time slider (0-24 h, 0.25), four
   presets (8 / 12 / 17.5 / 22; aria-pressed only while the hour equals the preset) and the season select set the
   session look through PC.view3d.setLook (no rebuild, camera untouched); the readout shows HH:MM. The look lives in
   PC.view3d (session; 12:00 summer on a page load). This file never touches three.js (ui layer, A-2).
   Room finder (F5-T1, F5-S1; A-14 as built): v3-room lists every room in one <optgroup> per level, lowest first
   (PC.cam.roomGroups, plan names), refilled when the house's rooms change. A pick runs PC.three.finder.goTo (Roof
   off, the room's level, highlight, 1.2 s flight), syncs the Roof switch and the level radios, and shows the caption
   "Room · Level" (caption(), shared with the F5-T2 tour; PM round 12). The select keeps the chosen room (PM Q7).
   The selection is cleared by any manual level change (All included), Reset view, Roof on, "Go to room…", and by
   PC.view3d itself on a rebuild or close (onSelect(null)); orbit / zoom / pan keep it (TL ruling Q3).
   Drone tour (F5-T2, F5-S2; A-14 as built; PM round 13): Start (clears the finder selection, Roof off) runs
   PC.three.tour at the session speed (Normal on a page load; kept between tours and stage visits, not in the draft).
   Pause / Resume (aria-pressed; the caption's pause button mirrors it) and Stop in the panel and in the caption, which
   reads "Room · Level" or "Overview". Each stop sets the level radios and the Roof switch through .checked, which fires
   no change event, so it never ends the tour (plan review item 4). A level radio, Reset view, Roof on and a finder
   pick end the tour first; the Light tab and the speed radios do not. When it ends (Stop, a gesture, leaving stage 5,
   a rebuild, the end) the camera, level and Roof stay; the caption and highlight are cleared and the select shows
   "Go to room…" (PM Q12). */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};
  ui.stages = ui.stages || {};
  var LATER = [];                                 // every stage-5 control is live since F5-T2
  var PRESETS = ['morning', 'noon', 'evening', 'night'];
  var TABS = ['view', 'light', 'tour'];
  var open = false, house = null, level = 'all', levelsKey = '', roomsKey = '';

  function shortName(id) { return PC.C.LEVEL_LABEL[id].replace(/ floor$/, ''); }
  function onState(s) {
    ui.show(ui.$('v3-building'), s === 'building');
    ui.show(ui.$('v3-unavailable'), s === 'unavailable');
    ui.show(ui.$('v3-panel'), s !== 'unavailable');
    ui.show(ui.$('v3-canvas'), s !== 'unavailable');
  }
  // "All" stays in the markup; one option per plan level of this house is added from tpl-v3-level.
  function fillLevels(h) {
    var key = h.levels.map(function (l) { return l.id; }).join(',');
    if (key === levelsKey) return;
    levelsKey = key;
    var group = ui.$('v3-level');
    Array.prototype.slice.call(group.querySelectorAll('input[name="v3-level"]')).forEach(function (inp) {
      if (inp.value !== 'all') group.removeChild(inp.closest('label'));
    });
    h.levels.forEach(function (l) {
      var frag = ui.$('tpl-v3-level').content.cloneNode(true), inp = frag.querySelector('input');
      inp.value = l.id; inp.setAttribute('aria-label', PC.C.LEVEL_LABEL[l.id]);
      ui.$('level-label', frag).textContent = shortName(l.id);
      group.appendChild(frag);
    });
    if (level !== 'all' && h.levels.every(function (l) { return l.id !== level; })) level = 'all';
  }
  // One <optgroup> per level (full level name), one <option> per room (plan name); the placeholder stays first.
  function fillRooms(h) {
    var groups = PC.cam.roomGroups(h), key = JSON.stringify(groups);
    if (key === roomsKey) return;
    roomsKey = key;
    var sel = ui.$('v3-room');
    Array.prototype.slice.call(sel.querySelectorAll('optgroup')).forEach(function (g) { sel.removeChild(g); });
    groups.forEach(function (g) {
      var og = document.createElement('optgroup');
      og.label = g.label;
      g.rooms.forEach(function (r) { var o = document.createElement('option'); o.value = r.id; o.textContent = r.name; og.appendChild(o); });
      sel.appendChild(og);
    });
    sel.value = '';
  }
  // The room caption (PM round 12): the room name whole, then " · " + the full level name, which truncates first
  // (CSS). parts = [room name, level label] | null (hidden). Shared with the F5-T2 tour.
  function caption(parts) {
    var box = ui.$('v3-caption'), t = ui.$('v3-caption-text');
    while (t.firstChild) t.removeChild(t.firstChild);
    if (parts) {
      var a = document.createElement('span');
      a.className = 'pc-caption__room'; a.textContent = parts[0];
      t.appendChild(a);
      if (parts[1]) { var b = document.createElement('span'); b.className = 'pc-caption__level'; b.textContent = ' · ' + parts[1]; t.appendChild(b); }
    }
    ui.show(box, !!parts);
  }
  // The selection's UI side: the select back to "Go to room…" and no caption (PC.view3d calls it on a rebuild / close).
  function unselected() { ui.$('v3-room').value = ''; caption(null); }
  function clearRoom() { PC.three.finder.clear(); unselected(); }
  function goRoom(id) {
    if (!id || !house || !PC.three.finder || !PC.three.finder.goTo(id)) { clearRoom(); return; }
    var f = PC.cam.roomOf(house, id);
    level = f.level.id;
    renderLevels();
    ui.$('v3-roof').checked = false;
    caption(PC.cam.caption(house, id));
  }
  // ---- drone tour (F5-T2) ----
  function renderTour() {
    var st = PC.three.tour ? PC.three.tour.state() : { running: false, paused: false }, on = st.running, pz = on && st.paused;
    ui.$('v3-tour-start').disabled = on;
    ['v3-tour-pause', 'v3-tour-stop'].forEach(function (h) { ui.$(h).disabled = !on; });
    ['v3-tour-pause', 'v3-caption-pause'].forEach(function (h) {
      var b = ui.$(h);
      b.setAttribute('aria-label', pz ? 'Resume tour' : 'Pause tour');
      b.setAttribute('aria-pressed', pz ? 'true' : 'false');        // the caption's pause button mirrors the panel's
    });
    ['v3-caption-pause', 'v3-caption-stop'].forEach(function (h) { ui.show(ui.$(h), on); });
    Array.prototype.slice.call(ui.$('v3-tour-speed').querySelectorAll('input')).forEach(function (i) { i.checked = i.value === PC.three.tour.speed(); });
  }
  function tourStop(stop) {
    level = stop.level;
    renderLevels();
    ui.$('v3-roof').checked = false;
    caption(stop.kind === 'room' ? PC.cam.caption(house, stop.id) : ['Overview']);
  }
  function tourEnd(reason) {
    if (reason !== 'replaced') { ui.$('v3-room').value = ''; caption(null); }
    renderTour();
  }
  function startTour() {
    if (!house || PC.three.tour.running()) return;
    clearRoom();
    ui.$('v3-roof').checked = false;
    PC.three.tour.start({ onStop: tourStop, onEnd: tourEnd });
    renderTour();
  }
  function togglePause() {
    var st = PC.three.tour.state();
    if (!st.running) return;
    if (st.paused) PC.three.tour.resume(); else PC.three.tour.pause();
    renderTour();
  }
  function endTour() { if (PC.three.tour.running()) PC.three.tour.stop(); }
  function renderLevels() {
    Array.prototype.slice.call(ui.$('v3-level').querySelectorAll('input')).forEach(function (inp) { inp.checked = inp.value === level; });
  }
  function show(state) {
    house = PC.house.build(state);
    if (house) { fillLevels(house); fillRooms(house); }
    renderLevels();
    PC.view3d.open(house, ui.$('v3-canvas'), onState);
    if (house) PC.view3d.setLevel(level);
  }
  function hhmm(h) {
    var m = Math.round(h * 60), hh = Math.floor(m / 60), mm = m % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function renderLook() {
    var l = PC.view3d.look();
    ui.$('v3-time').value = String(l.hour);
    ui.$('v3-time-out').textContent = hhmm(l.hour);
    ui.$('v3-season').value = l.season;
    PRESETS.forEach(function (p) { ui.$('v3-preset-' + p).setAttribute('aria-pressed', PC.sky.PRESETS[p] === l.hour ? 'true' : 'false'); });
  }
  function setLook(l) { PC.view3d.setLook(l); renderLook(); }
  function tab(name) {
    TABS.forEach(function (t) {
      var on = t === name;
      ui.$('v3-tab-' + t).setAttribute('aria-selected', on ? 'true' : 'false');
      ui.$('v3-pane-' + t).classList.toggle('is-current', on);
    });
  }

  ui.stages.view3d = {
    init: function () {
      LATER.forEach(function (h) { ui.$(h).disabled = true; });
      ui.on(ui.$('v3-level'), 'change', function (e) {
        if (!e.target || e.target.name !== 'v3-level' || !e.target.checked) return;
        level = e.target.value;
        endTour();
        clearRoom();
        PC.view3d.setLevel(level);
      });
      ui.on(ui.$('v3-roof'), 'change', function (e) { if (e.target.checked) { endTour(); clearRoom(); } PC.view3d.setRoof(e.target.checked); });
      ui.on(ui.$('v3-reset'), 'click', function () { endTour(); clearRoom(); PC.view3d.resetView(); });
      ui.on(ui.$('v3-tour-start'), 'click', startTour);
      ui.on(ui.$('v3-tour-pause'), 'click', togglePause);
      ui.on(ui.$('v3-caption-pause'), 'click', togglePause);
      ui.on(ui.$('v3-tour-stop'), 'click', endTour);
      ui.on(ui.$('v3-caption-stop'), 'click', endTour);
      ui.on(ui.$('v3-tour-speed'), 'change', function (e) { if (e.target && e.target.name === 'v3-tour-speed' && e.target.checked) PC.three.tour.setSpeed(e.target.value); });
      renderTour();
      ui.on(ui.$('v3-room'), 'change', function (e) { goRoom(e.target.value); });
      PC.view3d.setOnSelect(function (id) { if (id === null) unselected(); });
      ui.on(ui.$('v3-time'), 'input', function (e) { setLook({ hour: parseFloat(e.target.value) }); });
      ui.on(ui.$('v3-season'), 'change', function (e) { setLook({ season: e.target.value }); });
      PRESETS.forEach(function (p) { ui.on(ui.$('v3-preset-' + p), 'click', function () { setLook({ hour: PC.sky.PRESETS[p] }); }); });
      renderLook();
      ui.on(ui.$('v3-panel-toggle'), 'click', function () {
        var p = ui.$('v3-panel'), collapsed = !p.classList.contains('is-collapsed');
        p.classList.toggle('is-collapsed', collapsed);
        ui.$('v3-panel-toggle').setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
      TABS.forEach(function (t) { ui.on(ui.$('v3-tab-' + t), 'click', function () { tab(t); }); });
      Object.assign(PC.debug = PC.debug || {}, {
        house: function () { return house; },
        scene: function () { return PC.view3d.info(); },
        cam: function () { return PC.view3d.pose(); },
        // test-only (TL F5-T2 ruling Q8): set the running tour's time; no product code calls it
        tourSeek: function (tau) { return PC.three.tour.debugSeek(tau); }
      });
      ui.shell.register(5, {
        enter: function () { open = true; renderLook(); show(PC.store.get()); },
        leave: function () { open = false; PC.view3d.close(); renderTour(); },
        // a store change while the 3D view is open rebuilds only when the model really changed (house.key)
        render: function (s) {
          if (!open) return;
          var h = PC.house.build(s);
          if ((h && h.key) !== (house && house.key)) show(s);
        }
      });
    }
  };
})(globalThis.PC = globalThis.PC || {});
