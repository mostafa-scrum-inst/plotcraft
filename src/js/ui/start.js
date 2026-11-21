/* PC.ui.start: start panel (Resume draft / Start new / Load sample / no-save note), pending-draft guard, Skip to 3D. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};
  var pending = null;                 // { savedAt, state } found at boot and not yet answered

  function setPending(d) { pending = d; PC.store.session.draftPending = !!d; }

  // After any whole-state load: regenerate stale plans and never sit on an unreachable stage.
  function settle() {
    PC.store.commit(function (s) {
      PC.plans.sync(s);
      s.stage = PC.stages.clamp(s);
    }, { nav: true });
  }

  function render() {
    var s = PC.store.get();
    ui.show(ui.$('start-panel'), s.plot.pts.length === 0);
    ui.show(ui.$('resume-box'), !!pending);
    ui.show(ui.$('note-nosave'), !ui.storage.available);
  }

  function confirmDiscard() {
    return ui.dialog.confirm({
      title: 'Start a new project?', text: 'The saved draft will be deleted. This cannot be undone.',
      ok: 'Start new', cancel: 'Cancel'
    });
  }

  function resume() {
    if (!pending) return;
    var d = pending;
    setPending(null);
    PC.store.replace(d.state);
    settle();
    render();
  }

  function startNew() {
    if (ui.dialog.isOpen()) return Promise.resolve(false);
    return confirmDiscard().then(function (ok) {
      if (!ok) return false;
      setPending(null);
      ui.storage.removeDraft();
      PC.store.replace(PC.store.defaults());
      render();
      return true;
    });
  }

  function loadSample() {
    if (ui.dialog.isOpen()) return Promise.resolve(false);      // a second tap while the question is showing
    var ask = pending || !PC.draft.isEmpty(PC.store.get());
    var go = ask ? ui.dialog.confirm({
      title: 'Load the sample project?', text: 'It replaces your current draft. This cannot be undone.',
      ok: 'Load sample', cancel: 'Cancel'
    }) : Promise.resolve(true);
    return go.then(function (ok) {
      if (!ok) return false;
      setPending(null);
      if (ask) ui.storage.removeDraft();                     // the draft it replaces goes, under every key
      PC.store.replace(PC.sample.state());
      PC.store.commit(function (s) { PC.plans.sync(s); }, { nav: true });     // the sample loads with every level laid out
      render();
      return true;
    });
  }

  // "Skip to 3D": approve every laid-out level, then open the furthest stage this build can reach.
  function skip() {
    PC.store.commit(function (s) {
      PC.plans.sync(s);                                   // current plans first, then approve them
      PC.levels.ids(s).forEach(function (id) { var p = s.plans[id]; if (p && !p.error) p.approved = true; });
      s.stage = PC.stages.skipTarget(s);
    }, { nav: true });
  }

  ui.start = {
    render: render,
    // Resolves true when the current project may be changed. With an unanswered saved draft it first asks the
    // Start-new question. F1-T3 calls this before placing the first plot point (the tap itself is not placed).
    guard: function () { return pending ? startNew() : Promise.resolve(true); },
    init: function () {
      var raw = ui.storage.readDraft();
      if (raw !== null) {
        var d = PC.draft.parse(raw);
        if (!d) ui.storage.keepRejected(raw);          // rejected: keep a copy of the raw text first (A-4)
        if (d && !PC.draft.isEmpty(d.state)) {
          setPending(d);
          var when = new Date(d.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
          ui.$('resume-meta').textContent = 'Saved ' + when + ' · stage ' + d.state.stage + ' of 5.';
        } else ui.storage.removeDraft();               // rejected (copied above) or empty: not offered
      }
      ui.on(ui.$('btn-resume'), 'click', resume);
      ui.on(ui.$('btn-startnew'), 'click', startNew);
      ui.on(ui.$('btn-sample'), 'click', loadSample);
      ui.on(ui.$('btn-skip3d'), 'click', skip);
      PC.store.subscribe(render);
      render();
    }
  };
})(globalThis.PC = globalThis.PC || {});
