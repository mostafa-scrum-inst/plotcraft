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
   PC.view3d itself on a rebuild or close (onSelect(null)); orbit / zoom / pan keep it (TL ruling Q3). */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};
  ui.stages = ui.stages || {};
  var LATER = ['v3-tour-start', 'v3-tour-pause', 'v3-tour-stop'];
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
      var a = document.createElement('span'), b = document.createElement('span');
      a.className = 'pc-caption__room'; a.textContent = parts[0];
      b.className = 'pc-caption__level'; b.textContent = ' · ' + parts[1];
      t.appendChild(a); t.appendChild(b);
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
      Array.prototype.slice.call(ui.$('v3-tour-speed').querySelectorAll('input')).forEach(function (i) { i.disabled = true; });
      ui.on(ui.$('v3-level'), 'change', function (e) {
        if (!e.target || e.target.name !== 'v3-level' || !e.target.checked) return;
        level = e.target.value;
        clearRoom();
        PC.view3d.setLevel(level);
      });
      ui.on(ui.$('v3-roof'), 'change', function (e) { if (e.target.checked) clearRoom(); PC.view3d.setRoof(e.target.checked); });
      ui.on(ui.$('v3-reset'), 'click', function () { clearRoom(); PC.view3d.resetView(); });
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
        cam: function () { return PC.view3d.pose(); }
      });
      ui.shell.register(5, {
        enter: function () { open = true; renderLook(); show(PC.store.get()); },
        leave: function () { open = false; PC.view3d.close(); },
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
