/* PC.ui.qfields: bindings between a control and one value of the state (A-4: the state only ever holds valid
   values). Each binding has render(state); it writes through `apply(value)` given by the owner.
   Invalid text stays in its field, is listed in PC.store.session.invalidFields and is never committed. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {}, U = PC.units;

  function limitText(v, kind, unit) { return kind === 'len' ? U.fmtLen(v, unit) : String(v); }
  function unitOf() { return PC.store.get().ans.unit; }

  ui.qfields = {
    // Numeric text field with - / + buttons. d: { hook, key, q, label, kind: 'len' | 'count', min, max (metres or
    // count), read(state), apply(value) }. Lengths are shown and typed in the current unit, stored in metres.
    number: function (d) {
      var input = ui.$(d.hook), err = ui.$(d.hook + '-err'), unitEl = d.kind === 'len' ? ui.$(d.hook + '-unit') : null, shown = null;
      var invalid = function () { return PC.store.session.invalidFields; };
      function show(v, unit) { return d.kind === 'len' ? U.toDisplay(v, unit).toFixed(1) : String(v); }
      function step(unit) { return d.kind === 'len' ? U.stepLen(unit) : 1; }
      function errText(unit) { return 'Enter a number from ' + limitText(d.min, d.kind, unit) + ' to ' + limitText(d.max, d.kind, unit) + '.'; }
      // Typed text -> value in metres (or a count), or null when it is not acceptable.
      function parse(text, unit) {
        var n = U.parseNum(text);
        if (n === null) return null;
        if (d.kind === 'count' && Math.floor(n) !== n) return null;
        var v = d.kind === 'len' ? U.fromDisplay(n, unit) : n;
        return v >= d.min - 1e-9 && v <= d.max + 1e-9 ? Math.max(d.min, Math.min(d.max, v)) : null;
      }
      function setInvalid() {
        invalid()[d.key] = { q: d.q, label: d.label, min: d.min, max: d.max, unitKind: d.kind };
        ui.shell.render();                                  // conflict row, Next, and this field's error line
      }
      function clearInvalid() { if (invalid()[d.key]) { delete invalid()[d.key]; return true; } return false; }
      function accept(v) {
        clearInvalid(); shown = null;
        Promise.resolve(d.apply(v)).then(function () { ui.shell.render(); });   // also clears the error line when nothing changed
      }
      ui.on(input, 'change', function () {
        if (!invalid()[d.key] && input.value === shown) return;        // untouched: never rewrite a stored value
        var v = parse(input.value, unitOf());
        if (v === null) setInvalid(); else accept(v);
      });
      // Enter finishes the entry. Its default action is cancelled first: the blur commits, which may open the R5
      // dialog with Cancel focused, and the same key press must not then click that button (F2-T2 QA bug 1).
      ui.on(input, 'keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
      [['-dec', -1], ['-inc', 1]].forEach(function (b) {
        ui.on(ui.$(d.hook + b[0]), 'click', function () {
          var unit = unitOf(), s = step(unit), cur = d.read(PC.store.get());
          var v = b[1] > 0 ? Math.floor(cur / s + 1e-9) * s + s : Math.ceil(cur / s - 1e-9) * s - s;   // the next step line
          accept(Math.max(d.min, Math.min(d.max, Math.round(v * 1e6) / 1e6)));
        });
      });
      return {
        render: function (state) {
          var unit = state.ans.unit, bad = !!invalid()[d.key];
          if (unitEl) unitEl.textContent = U.lenUnit(unit);
          if (bad) { input.setAttribute('aria-invalid', 'true'); err.textContent = errText(unit); err.hidden = false; return; }   // the typed text stays
          input.removeAttribute('aria-invalid'); err.hidden = true;
          var t = show(d.read(state), unit);
          if (input.value !== t) input.value = t;
          shown = t;
        }
      };
    },

    // Range slider with a value label. d: { hook, read(state), apply(value), toCtl(v, unit), fromCtl(x, unit),
    // text(v, unit), attrs(unit) -> { min, max, step } | null, live(value | null) }. `input` only reports the
    // pending value through live(); the state changes on `change` (release). The gesture also ends on pointer up /
    // cancel, blur or key up without a `change` (Chrome sends none when the thumb is released on the value it had
    // at pointer down): then the pending value is dropped and the control renders from the state again (A-15).
    slider: function (d) {
      var el = ui.$(d.hook), out = ui.$(d.hook + '-out'), busy = false, committing = false;
      function finish() { busy = false; if (d.live) d.live(null); ui.shell.render(); }
      ui.on(el, 'input', function () {
        var v = d.fromCtl(Number(el.value), unitOf());
        busy = true; out.textContent = d.text(v, unitOf());
        if (d.live) d.live(v);
      });
      ui.on(el, 'change', function () {
        var v = d.fromCtl(Number(el.value), unitOf());
        committing = true;
        Promise.resolve(d.apply(v)).then(function () { committing = false; finish(); });
      });
      // A `change` that does come is dispatched in the same task as the pointer up / blur; a zero timer runs after it.
      function ended() {
        if (!busy || committing) return;
        setTimeout(function () { if (busy && !committing) finish(); }, 0);
      }
      ['pointerup', 'pointercancel'].forEach(function (t) { ui.on(document, t, ended, true); });   // released anywhere
      ['blur', 'keyup'].forEach(function (t) { ui.on(el, t, ended); });
      return {
        render: function (state) {
          if (busy) return;                                  // the thumb belongs to the user until the gesture ends
          var unit = state.ans.unit, a = d.attrs ? d.attrs(unit) : null, v = d.read(state);
          if (a) { el.min = a.min; el.max = a.max; el.step = a.step; }
          el.value = String(d.toCtl(v, unit));
          out.textContent = d.text(v, unit);
        }
      };
    },

    // Radio group. d: { hook, read(state) -> value string, apply(value), disabled(state, value) }.
    radios: function (d) {
      var inputs = ui.$$('input[type="radio"]', ui.$(d.hook));
      inputs.forEach(function (i) { ui.on(i, 'change', function () { if (i.checked) d.apply(i.value); }); });
      return {
        render: function (state) {
          var v = String(d.read(state));
          inputs.forEach(function (i) { i.checked = i.value === v; i.disabled = !!(d.disabled && d.disabled(state, i.value)); });
        }
      };
    },

    // Switch (checkbox). d: { hook, read(state) -> boolean, apply(boolean) }.
    toggle: function (d) {
      var el = ui.$(d.hook);
      ui.on(el, 'change', function () { d.apply(el.checked); });
      return { render: function (state) { el.checked = !!d.read(state); } };
    }
  };
})(globalThis.PC = globalThis.PC || {});
