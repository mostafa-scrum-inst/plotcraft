/* PC.ui.stages.view3d: stage 5 controller (F4-S1 / F4-S2, F4-T1). Builds the house model from the store, hands it
   to PC.view3d (three layer) and owns the stage-5 DOM: Building... / unavailable overlays, the level selector
   ("All" + the house's own levels, lowest first; PM round 9 labels), Reset view, the collapsible panel and its tabs.
   Session state only (A-4): level selection and roof toggle survive leaving and returning; the view opens on All
   with the roof off. Controls of later tasks (time, presets, season, room finder, tour, Roof until F4-T2) are
   disabled here (TL F4-T1 ruling 3); the Roof state logic is wired. This file never touches three.js (ui layer, A-2). */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};
  ui.stages = ui.stages || {};
  var LATER = ['v3-time', 'v3-preset-morning', 'v3-preset-noon', 'v3-preset-evening', 'v3-preset-night', 'v3-season',
    'v3-room', 'v3-tour-start', 'v3-tour-pause', 'v3-tour-stop', 'v3-roof'];
  var TABS = ['view', 'light', 'tour'];
  var open = false, house = null, level = 'all', levelsKey = '';

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
  function renderLevels() {
    Array.prototype.slice.call(ui.$('v3-level').querySelectorAll('input')).forEach(function (inp) { inp.checked = inp.value === level; });
  }
  function show(state) {
    house = PC.house.build(state);
    if (house) fillLevels(house);
    renderLevels();
    PC.view3d.open(house, ui.$('v3-canvas'), onState);
    if (house) PC.view3d.setLevel(level);
  }
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
        PC.view3d.setLevel(level);
      });
      ui.on(ui.$('v3-roof'), 'change', function (e) { PC.view3d.setRoof(e.target.checked); });
      ui.on(ui.$('v3-reset'), 'click', function () { PC.view3d.resetView(); });
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
        enter: function () { open = true; show(PC.store.get()); },
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
