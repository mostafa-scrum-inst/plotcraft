/* PC.units: display conversion and formatting (R4). Stored values are always metres and square metres. */
(function (PC) {
  'use strict';
  var FT = PC.C.FT, FT2 = FT * FT;
  PC.units = {
    toDisplay: function (m, unit) { return unit === 'ft' ? m / FT : m; },
    fromDisplay: function (v, unit) { return unit === 'ft' ? v * FT : v; },
    areaToDisplay: function (m2, unit) { return unit === 'ft' ? m2 / FT2 : m2; },
    areaFromDisplay: function (v, unit) { return unit === 'ft' ? v * FT2 : v; },
    lenUnit: function (unit) { return unit === 'ft' ? 'ft' : 'm'; },
    areaUnit: function (unit) { return unit === 'ft' ? 'sq ft' : 'm²'; },
    // "20.0 m" / "65.6 ft": one decimal.
    fmtLen: function (m, unit) { return PC.units.toDisplay(m, unit).toFixed(1) + ' ' + PC.units.lenUnit(unit); },
    // "600 m²" / "6458 sq ft": whole number.
    fmtArea: function (m2, unit) { return Math.round(PC.units.areaToDisplay(m2, unit)) + ' ' + PC.units.areaUnit(unit); },
    // Step of length steppers, in metres: 0.5 m or 1 ft.
    stepLen: function (unit) { return unit === 'ft' ? FT : 0.5; },
    // "3.0 × 6.0 m" / "9.8 × 19.7 ft".
    fmtDims: function (w, d, unit) {
      return PC.units.toDisplay(w, unit).toFixed(1) + ' \u00D7 ' + PC.units.toDisplay(d, unit).toFixed(1) + ' ' + PC.units.lenUnit(unit);
    },
    // Text typed by the user -> finite number, or null. Accepts a decimal comma.
    parseNum: function (text) {
      var t = String(text === null || text === undefined ? '' : text).trim().replace(',', '.');
      if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
      var n = Number(t);
      return isFinite(n) ? n : null;
    }
  };
})(globalThis.PC = globalThis.PC || {});
