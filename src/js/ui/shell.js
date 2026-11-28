/* PC.ui.shell: stepper, Back/Next, stage switching, header unit toggle, sample strip, stage-controller registry. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};
  var controllers = {}, shown = 0, ready = false;
  var furthest = 1;                  // furthest stage opened in this session (a step is "done" only once visited)
  var ALT = { gpu: 'gpu/index.html', standard: '../index.html' };   // G1 (CD-11, CD-12): from each page to the other
  var STATIC_ID = 'stage-static', STATIC_TEXT = 'This stage is not built yet: static preview';
  var STRIP_STAGES = [1, 3];         // sample strip (and the only "Skip to 3D") shows here while the sample is untouched (PM round 8: not on 4)

  function call(n, method, arg) { var c = controllers[n]; if (c && c[method]) c[method](arg); }

  function renderStepper(s, st) {
    for (var n = 1; n <= 5; n++) {
      var b = ui.$('step-' + n), cur = n === s.stage, locked = !st[n].reachable && !cur;
      var done = !cur && !locked && st[n].valid && n <= furthest && n < 5;
      b.classList.toggle('is-current', cur);
      b.classList.toggle('is-done', done);
      b.classList.toggle('is-locked', locked);
      if (cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      if (locked) { b.setAttribute('aria-disabled', 'true'); b.title = st[n].reason; }
      else { b.removeAttribute('aria-disabled'); b.removeAttribute('title'); }
    }
  }

  function renderBar(s, st) {
    var back = ui.$('btn-back'), next = ui.$('btn-next'), last = s.stage === 5;
    back.disabled = s.stage === 1;
    next.hidden = last;
    next.disabled = last || !st[s.stage].valid || !st[s.stage + 1].reachable;
    if (!last) ui.$('btn-next-label').textContent = PC.stages.TEXT.next[s.stage];
    // G1 (CD-12): the link to the other page, on stage 5 only (where Next is hidden). The standard page offers the
    // WebGPU page only where the browser has WebGPU (a feature check, no adapter request); /gpu always offers the
    // standard page.
    var alt = document.getElementById('pc-alt-link');
    if (alt) alt.hidden = !last || (alt.getAttribute('data-alt') === 'gpu' && !(typeof navigator !== 'undefined' && navigator.gpu));
  }

  function switchStage(s) {
    if (shown === s.stage) return;
    if (shown) call(shown, 'leave');
    ui.$$('[data-stage]').forEach(function (sec) { sec.hidden = Number(sec.getAttribute('data-stage')) !== s.stage; });
    shown = s.stage;
    ui.$('stage-container').scrollTop = 0;
    call(shown, 'enter');
  }

  var lastUnit = null;
  function render(state, prev, meta) {
    if (!ready) return;
    var s = PC.store.get(), st = PC.stages.status(s);
    furthest = meta && meta.replace ? s.stage : Math.max(furthest, s.stage);
    switchStage(s);
    renderStepper(s, st);
    renderBar(s, st);
    ui.show(ui.$('sample-strip'), s.sampleClean && STRIP_STAGES.indexOf(s.stage) >= 0);
    if (lastUnit !== null && lastUnit !== s.ans.unit) ui.toast.dropUnits();   // F5-T3a: no toast in the old unit
    lastUnit = s.ans.unit;
    ui.$('unit-m').checked = s.ans.unit === 'm';
    ui.$('unit-ft').checked = s.ans.unit === 'ft';
    if (controllers[s.stage]) ui.banner.hide(STATIC_ID);
    else ui.banner.show({ id: STATIC_ID, kind: 'info', text: STATIC_TEXT });
    call(s.stage, 'render', s);
    fixFocusSoon();
  }

  // Keyboard users must not lose their place: when the focused control has just been hidden or disabled (focus
  // then sits on <body>), move focus to the current step. Runs after every render and after a dialog closes.
  var lastInput = '';
  function fixFocus() {
    if (!ready || lastInput !== 'key' || ui.dialog.isOpen()) return;
    var el = document.activeElement;
    if (el && el !== document.body && !el.disabled && !(el.closest && el.closest('[hidden]'))) return;
    ui.$('step-' + PC.store.get().stage).focus({ preventScroll: true });
  }
  function fixFocusSoon() { setTimeout(fixFocus, 0); }

  function stepTap(n) {
    var s = PC.store.get();
    if (n === s.stage) return;
    if (!PC.store.go(n)) ui.toast(PC.stages.status(s)[n].reason, { units: true });   // may quote the minimum area
  }

  ui.stages = ui.stages || {};
  ui.shell = {
    STRIP_STAGES: STRIP_STAGES,       // read-only for tests (QA version marker, F4-T2 Step 0)
    // Stage controllers (A-15): { enter(), leave(), render(state) }, all optional. Later tasks register theirs.
    register: function (n, controller) {
      controllers[n] = controller;
      if (ready && shown === n) { call(n, 'enter'); render(); }
    },
    render: render,
    fixFocusSoon: fixFocusSoon,
    init: function () {
      [1, 2, 3, 4, 5].forEach(function (n) { ui.on(ui.$('step-' + n), 'click', function () { stepTap(n); }); });
      ui.on(ui.$('btn-back'), 'click', function () { PC.store.go(PC.store.get().stage - 1); });
      ui.on(ui.$('btn-next'), 'click', function () { PC.store.go(PC.store.get().stage + 1); });
      ['unit-m', 'unit-ft'].forEach(function (h) {
        ui.on(ui.$(h), 'change', function (e) {
          var v = e.target.value;
          if (e.target.checked) PC.store.commit(function (s) { s.ans.unit = v; }, { keepSample: true });   // display only (F1-S5)
        });
      });
      ui.on(document, 'keydown', function () { lastInput = 'key'; }, true);
      ui.on(document, 'pointerdown', function () { lastInput = 'pointer'; }, true);
      // G1: the links between the two pages get their (relative) targets here, so the markup keeps the A-3 rule of
      // no src / href other than the three.js tag, #fragments and data: (QA F1-T1)
      Array.prototype.forEach.call(document.querySelectorAll('a[data-alt]'), function (el) { el.setAttribute('href', ALT[el.getAttribute('data-alt')]); });
      PC.store.subscribe(render);
      ready = true;
      render();
    }
  };
})(globalThis.PC = globalThis.PC || {});
