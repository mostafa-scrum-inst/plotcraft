/* PC.ui.stages.interior: stage 4 controller (F3-S4): Q18 interior style and Q19 furniture density, appearance
   class (plain commit, A-7: no signature changes, approvals kept). "Build 3D model" is the shell's Next (stage 5,
   a static preview until F4-T1). The hint pictures are the Designer's markup until F3-T3. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {}, fields = [];
  ui.stages = ui.stages || {};
  ui.stages.interior = {
    init: function () {
      var F = ui.qfields;
      fields = [
        F.radios({ hook: 'q-interior-style', read: function (s) { return s.ans.interior.style; },
          apply: function (v) { PC.store.commit(function (d) { d.ans.interior.style = v; }); } }),
        F.radios({ hook: 'q-interior-density', read: function (s) { return s.ans.interior.density; },
          apply: function (v) { PC.store.commit(function (d) { d.ans.interior.density = v; }); } })
      ];
      var render = function (s) { fields.forEach(function (f) { f.render(s); }); };
      ui.shell.register(4, { enter: function () { render(PC.store.get()); }, render: render });
    }
  };
})(globalThis.PC = globalThis.PC || {});
