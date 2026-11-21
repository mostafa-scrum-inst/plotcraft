/* PC.stages: pure stage gating (R1, A-4). All stage wording lives in TEXT so it can be tuned in one place. */
(function (PC) {
  'use strict';
  var TEXT = {
    next: { 1: 'Next: Questions', 2: 'Next: Floor plans', 3: 'Next: Interior', 4: 'Build 3D model' },
    name: { 1: 'Plot', 2: 'Questions', 3: 'Floor plans', 4: 'Interior', 5: '3D view' },
    noPlot: 'Draw and close the plot first',
    smallPlot: 'The plot is too small (minimum {a})',
    conflicts: 'Fix the highlighted answers first',
    approve: 'Approve all floors first',
    notBuilt: 'Not available in this build yet'
  };

  function minAreaText(state) { return PC.units.fmtArea(PC.C.PLOT.minArea, state.ans.unit); }

  // Why each stage is not valid ('' when it is).
  function invalid(state) {
    var r = { 1: '', 2: '', 3: '', 4: '', 5: '' }, p = state.plot;
    if (!p.closed || p.pts.length < PC.C.PLOT.minPts) r[1] = TEXT.noPlot;
    else if (Math.abs(PC.geom.area(p.pts)) < PC.C.PLOT.minArea - 1e-9) r[1] = TEXT.smallPlot.replace('{a}', minAreaText(state));
    if (PC.validate.blocking(state).length) r[2] = TEXT.conflicts;
    var ok = PC.levels.ids(state).every(function (id) {
      var pl = state.plans[id];
      return !!pl && pl.approved && !pl.error && pl.sig === PC.sig.level(state, id);
    });
    if (!ok) r[3] = TEXT.approve;
    return r;
  }

  PC.stages = {
    MAX_BUILT: 5,            // highest stage that can be opened (F3-T1: 3; F3-T2: 5, stage 5 a static preview until F4-T1)
    TEXT: TEXT,

    // { 1..5: { reachable, valid, reason } }. reason: why it is locked, else why it is not valid, else ''.
    status: function (state) {
      var bad = invalid(state), out = {}, blocker = '', n;
      for (n = 1; n <= 5; n++) {
        var reachable = !blocker && n <= PC.stages.MAX_BUILT;
        out[n] = { reachable: reachable, valid: !bad[n], reason: reachable ? bad[n] : (blocker || TEXT.notBuilt) };
        if (!blocker && bad[n]) blocker = bad[n];
      }
      return out;
    },

    // Highest reachable stage that is not above the stored one (after Resume, after a plan sync).
    clamp: function (state) {
      var st = PC.stages.status(state), n = Math.min(5, Math.max(1, state.stage));
      while (n > 1 && !st[n].reachable) n--;
      return n;
    },

    // Where "Skip to 3D" lands: the highest reachable stage.
    skipTarget: function (state) {
      var st = PC.stages.status(state), n = 5;
      while (n > 1 && !st[n].reachable) n--;
      return n;
    }
  };
})(globalThis.PC = globalThis.PC || {});
