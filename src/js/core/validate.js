/* PC.validate(state): what cannot work together (F2-S3). Returns { blocking, warnings, summary }, recomputed
   from the state each time, so a conflict clears as soon as the answer is fixed. One rule table below. */
(function (PC) {
  'use strict';
  var U = PC.units;
  // code -> kind, question number (for "go to the question"), text with {placeholders}.
  var RULES = {
    'field-invalid':   { kind: 'block', text: '{label}: enter a number from {min} to {max}.' },
    'floor-empty':     { kind: 'block', q: 11, text: '{level} has no rooms: add a room there or reduce the number of floors.' },
    'basement-empty':  { kind: 'block', q: 11, text: 'The basement has no rooms: add a room there or switch the basement off.' },
    'buildable-small': { kind: 'block', q: 2, text: 'Buildable area is {a} (minimum {min}): reduce the setbacks or redraw the plot.' },
    'no-fit':          { kind: 'block', q: 2, text: 'The building does not fit this plot: reduce the setbacks or redraw the plot.' },
    'fp-veg-over':     { kind: 'block', q: 3, text: 'Footprint {x} % + vegetation {y} % is more than 100 %: lower one of them.' },
    'level-over':      { kind: 'block', q: 11, text: '{level}: needs {n}, {a} available. {fix}' },
    'fp-clamped':      { kind: 'warn', q: 3, text: 'The building was reduced to fit inside the setbacks: {a} ({p} % of the plot).',
      // F2-S3 round 4 (CD-1): the wording when the 3:1 proportion limit is what stops the building
      proportion: 'The building is limited to {dims} ({a}, {p} % of the plot): on this narrow plot it may be at most 3 times as long as it is wide. Smaller setbacks along its long sides would allow a larger building.' },
    'veg-reduced':     { kind: 'warn', q: 4, text: 'Vegetation was reduced to what fits: {a} ({p} %).' },
    'parking-omitted': { kind: 'warn', q: 15, text: 'Parking does not fit between the building and the street: it is left out of the 3D scene. Try fewer cars, a lower footprint % or a larger front setback (it moves the building back from the street).' },
    'pool-omitted':    { kind: 'warn', q: 16, text: 'The pool with its {c} clearance does not fit behind or beside the building: it is left out of the 3D scene. Try a smaller pool, a lower footprint % or a larger back setback (it moves the building toward the street).' }
  };
  // What helps when a level needs more than the footprint offers: raising the footprint % only helps while the
  // plot is not already the limit.
  var FIX_FREE = 'Remove or shrink rooms, or raise the footprint %.';
  var FIX_CLAMPED = 'Remove or shrink rooms, or reduce the setbacks (the building is already as large as this plot allows).';
  var last = null;

  function fill(text, vars) { return text.replace(/\{(\w+)\}/g, function (m, k) { return vars[k]; }); }
  function pct(x) { return String(Math.round(x * 10) / 10); }
  // Limit of an input field in the current unit; limits are stored in metres.
  function limit(v, kind, unit) {
    if (kind === 'len') return U.fmtLen(v, unit);
    if (kind === 'area') return U.fmtArea(v, unit);
    return kind === 'pct' ? v + ' %' : String(v);
  }

  function run(state, invalid) {
    var out = { blocking: [], warnings: [], summary: null }, a = state.ans, unit = a.unit, L = PC.levels;
    function add(code, vars, extra) {
      var r = RULES[code], item = { code: code, q: (extra && extra.q) || r.q, level: (extra && extra.level) || null,
        text: fill(extra && extra.variant ? r[extra.variant] : r.text, vars || {}) };
      (r.kind === 'block' ? out.blocking : out.warnings).push(item);
    }
    Object.keys(invalid).sort().forEach(function (k) {
      var f = invalid[k];
      add('field-invalid', { label: f.label, min: limit(f.min, f.unitKind, unit), max: limit(f.max, f.unitKind, unit) }, { q: f.q });
    });
    var site = PC.site.analyse(state);
    if (!site) return out;                              // open plot: stage 1 is the blocker
    var ids = L.ids(state), fp = site.footprint;
    ids.forEach(function (id) {
      if (L.roomsOn(state, id).length) return;
      if (id === 'B') add('basement-empty', null, { level: id }); else add('floor-empty', { level: L.name(id) }, { level: id });
    });
    if (!site.buildable.ok) add('buildable-small', { a: U.fmtArea(site.buildable.area, unit), min: U.fmtArea(PC.C.BUILDABLE_MIN, unit) });
    else if (site.noFit) add('no-fit');
    if (a.footprintPct + a.vegPct > 100 + 1e-9) add('fp-veg-over', { x: pct(a.footprintPct), y: pct(a.vegPct) });
    var levels = ids.map(function (id) { return { id: id, name: L.name(id), needed: L.needed(state, id), available: fp ? fp.area : 0 }; });
    if (fp) levels.forEach(function (lv) {
      if (lv.needed <= lv.available + 1e-6) return;
      var n = U.fmtArea(lv.needed, unit), av = U.fmtArea(lv.available, unit);
      if (n === av) {                                   // same whole number: show one decimal so the two figures differ
        n = U.areaToDisplay(lv.needed, unit).toFixed(1) + ' ' + U.areaUnit(unit);
        av = U.areaToDisplay(lv.available, unit).toFixed(1) + ' ' + U.areaUnit(unit);
      }
      add('level-over', { level: lv.name, n: n, a: av, fix: fp.clamped ? FIX_CLAMPED : FIX_FREE }, { level: lv.id });
    });
    if (fp && fp.clamped) add('fp-clamped', { a: U.fmtArea(fp.area, unit), p: pct(fp.pct), dims: U.fmtDims(fp.w, fp.d, unit) },
      fp.reason === 'proportion' ? { variant: 'proportion' } : null);
    if (fp && site.veg.reduced) add('veg-reduced', { a: U.fmtArea(site.veg.area, unit), p: pct(site.veg.pct) });
    if (site.omitted.indexOf('parking') >= 0) add('parking-omitted');
    if (site.omitted.indexOf('pool') >= 0) add('pool-omitted', { c: U.fmtLen(PC.C.POOL_CLEAR, unit) });
    out.summary = { plotArea: site.plotArea, buildableArea: site.buildable.area, footprintArea: fp ? fp.area : 0,
      footprintPct: fp ? fp.pct : 0, vegArea: site.veg.area, vegPct: site.veg.pct, levels: levels };
    return out;
  }

  PC.validate = function (state) {
    var invalid = PC.store.session.invalidFields || {}, key = JSON.stringify(invalid);
    if (last && last.state === state && last.key === key) return last.result;
    var result = run(state, invalid);
    if (Object.isFrozen(state)) last = { state: state, key: key, result: result };   // only store states are immutable
    return result;
  };
  PC.validate.RULES = RULES;
  PC.validate.blocking = function (state) { return PC.validate(state).blocking; };
  // Q9 with a usable roof: Pitched is not available. Changes ans in place; true when it had to switch to Flat.
  PC.validate.normaliseRoof = function (ans) {
    if (ans.usableRoof && ans.roofType === 'pitched') { ans.roofType = 'flat'; return true; }
    return false;
  };
})(globalThis.PC = globalThis.PC || {});
