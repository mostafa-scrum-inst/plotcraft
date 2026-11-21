/* Boot. Order matters: storage probe, state, test hooks, stage controllers, shell, start panel (reads a saved draft), autosave. */
(function (PC) {
  'use strict';
  var ui = PC.ui;
  ui.storage.probe();
  PC.store.init();
  PC.store.setConfirmHandler(ui.dialog.confirm);
  // Read-only test hooks (A-2). Later tasks add theirs with Object.assign; never replace this object.
  // Stage controllers register before the shell starts, so the first render already has them.
  PC.debug = Object.assign(PC.debug || {}, {
    state: function () { return PC.store.get(); },
    site: function () { return PC.site.analyse(PC.store.get()); },
    // World point of a named 2D view ('plot', later 'site', 'plan') -> viewport coordinates [clientX, clientY].
    toScreen: function (name, x, y) {
      var v = ui.View2D.named[name], r = v.canvas.getBoundingClientRect(), p = v.toScreen([x, y]);
      return [r.left + p[0], r.top + p[1]];
    },
    view: function (name) { var v = ui.View2D.named[name]; return { scale: v.scale, ox: v.ox, oy: v.oy, width: v.width, height: v.height, dpr: v.dpr }; }
  });
  ui.stages.plot.init();
  ui.stages.questions.init();
  ui.stages.plans.init();
  ui.stages.interior.init();
  ui.stages.view3d.init();
  ui.shell.init();
  ui.start.init();
  ui.autosave.start();
})(globalThis.PC = globalThis.PC || {});
