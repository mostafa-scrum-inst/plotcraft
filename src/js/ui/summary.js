/* PC.ui.summary: live summary numbers, needed / available per level, conflict and warning rows with "Fix"
   (F2-S3). Everything comes from PC.validate; nothing is stored here. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {}, U = PC.units, goTo = null, drawn = '';

  function collapse(yes) {
    ui.$('summary').classList.toggle('is-collapsed', yes);
    ui.$('summary-toggle').setAttribute('aria-expanded', String(!yes));
  }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  ui.summary = {
    // onFix(q, level): called after the sheet has been collapsed.
    init: function (onFix) {
      goTo = onFix;
      ui.on(ui.$('summary-toggle'), 'click', function () { collapse(!ui.$('summary').classList.contains('is-collapsed')); });
    },
    collapse: collapse,

    render: function (state) {
      var v = PC.validate(state), s = v.summary, unit = state.ans.unit, dash = '–';
      var pct = function (x) { return (Math.round(x * 10) / 10) + ' %'; };
      ui.$('sum-plot').textContent = s ? U.fmtArea(s.plotArea, unit) : dash;
      ui.$('sum-buildable').textContent = s ? U.fmtArea(s.buildableArea, unit) : dash;
      ui.$('sum-footprint').textContent = s && s.footprintArea ? U.fmtArea(s.footprintArea, unit) + ' · ' + pct(s.footprintPct) : dash;
      ui.$('sum-veg').textContent = s ? U.fmtArea(s.vegArea, unit) + ' · ' + pct(s.vegPct) : dash;
      var nb = v.blocking.length, nw = v.warnings.length;
      ui.$('sum-status').textContent = !nb && !nw ? 'All clear' : [nb ? nb + ' to fix' : '', nw ? plural(nw, 'warning') : ''].filter(Boolean).join(' · ');
      ui.$('summary').setAttribute('data-kind', nb ? 'block' : nw ? 'warn' : 'ok');
      // Rows are rebuilt only when they change, so a focused "Fix" button is not replaced under the user.
      var key = JSON.stringify([unit, s && s.levels, v.blocking, v.warnings, PC.levels.ids(state).map(function (id) { return PC.levels.roomsOn(state, id).length > 0; })]);
      if (key === drawn) return;
      drawn = key;
      var levels = ui.$('sum-levels'), list = ui.$('conflict-list');
      levels.textContent = ''; list.textContent = '';
      (s ? s.levels : []).forEach(function (lv) {
        var row = ui.tpl('tpl-sum-level');
        ui.$('level-name', row).textContent = lv.name;
        // A level without rooms shows "–" (its stair allowance alone is not a need; the floor-empty row says why).
        ui.$('level-needed', row).textContent = PC.levels.roomsOn(state, lv.id).length ? U.fmtArea(lv.needed, unit) : dash;
        ui.$('level-available', row).textContent = U.fmtArea(lv.available, unit);
        levels.appendChild(row);
      });
      v.blocking.map(function (c) { return [c, 'block']; }).concat(v.warnings.map(function (c) { return [c, 'warn']; })).forEach(function (x) {
        var row = ui.tpl('tpl-conflict'), c = x[0], btn = ui.$('conflict-goto', row);
        row.setAttribute('data-kind', x[1]); row.setAttribute('data-code', c.code);
        ui.$('conflict-text', row).textContent = c.text;
        btn.setAttribute('aria-label', 'Fix: go to question ' + c.q);
        ui.on(btn, 'click', function () { collapse(true); if (goTo) goTo(c.q, c.level); });
        list.appendChild(row);
      });
    }
  };
})(globalThis.PC = globalThis.PC || {});
