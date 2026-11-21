/* PC.draft: draft wrapper and strict validation (A-4). parse() returns null on anything unexpected. */
(function (PC) {
  'use strict';
  var has = Object.prototype.hasOwnProperty;
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  // Exactly these keys, no more, no fewer.
  function keys(o, list) {
    return isObj(o) && Object.keys(o).length === list.length && list.every(function (k) { return has.call(o, k); });
  }
  function num(x, r) { return typeof x === 'number' && isFinite(x) && x >= r[0] - 1e-9 && x <= r[1] + 1e-9; }
  function int(x, r) { return num(x, r) && Math.floor(x) === x; }
  function bool(x) { return x === true || x === false; }
  function oneOf(x, list) { return typeof x === 'string' && list.indexOf(x) >= 0; }
  function isId(x) { return typeof x === 'string' && /^r[1-9]\d*$/.test(x); }

  function plotOk(p) {
    var C = PC.C.PLOT;
    if (!keys(p, ['pts', 'closed']) || !bool(p.closed) || !Array.isArray(p.pts) || p.pts.length > C.maxPts) return false;
    if (p.closed && p.pts.length < C.minPts) return false;
    var ok = p.pts.every(function (q) {
      return Array.isArray(q) && q.length === 2 && num(q[0], [-1e6, 1e6]) && num(q[1], [-1e6, 1e6]);
    });
    // No self-contact, every point inside the drawing area, counter-clockwise once closed.
    return ok && PC.plot.valid(p);
  }

  // Rooms and pairs. Returns a map id -> level, or null.
  function roomsOk(a, levels) {
    var C = PC.C, where = {}, perLevel = {}, pairsPer = {}, seen = {};
    if (!Array.isArray(a.rooms) || !Array.isArray(a.pairs) || !int(a.nextRoomId, [1, 1e9])) return null;
    var ok = a.rooms.every(function (r) {
      if (!keys(r, ['id', 'type', 'level', 'size', 'area', 'master'])) return false;
      if (!isId(r.id) || has.call(where, r.id) || parseInt(r.id.slice(1), 10) >= a.nextRoomId) return false;
      if (!oneOf(r.type, C.ROOM_TYPES) || levels.indexOf(r.level) < 0 || !bool(r.master)) return false;
      if (r.master && r.type !== 'bedroom') return false;
      var preset = oneOf(r.size, C.SIZES) && r.area === null, exact = r.size === null && num(r.area, C.RANGE.roomArea);
      if (!preset && !exact) return false;
      where[r.id] = r.level;
      perLevel[r.level] = (perLevel[r.level] || 0) + 1;
      return perLevel[r.level] <= C.MAX_ROOMS_PER_LEVEL;
    });
    if (!ok) return null;
    ok = a.pairs.every(function (p) {
      if (!Array.isArray(p) || p.length !== 2 || !has.call(where, p[0]) || !has.call(where, p[1])) return false;
      if (where[p[0]] !== where[p[1]] || PC.store.cmpId(p[0], p[1]) >= 0) return false;
      var k = p[0] + '+' + p[1], lv = where[p[0]];
      if (seen[k]) return false;
      seen[k] = true;
      pairsPer[lv] = (pairsPer[lv] || 0) + 1;
      return pairsPer[lv] <= C.MAX_PAIRS_PER_LEVEL;
    });
    return ok ? where : null;
  }

  function ansOk(a, nPts) {
    var C = PC.C, E = C.ENUM, R = C.RANGE;
    if (!keys(a, ['unit', 'setbacks', 'footprintPct', 'vegPct', 'north', 'streetEdge', 'floors', 'basement', 'usableRoof',
      'ceilingH', 'roofType', 'exterior', 'rooms', 'nextRoomId', 'pairs', 'stairPos', 'lift', 'parking', 'pool', 'extras', 'edgeOv',
      'interior'])) return false;
    if (!oneOf(a.unit, E.unit)) return false;
    if (!keys(a.setbacks, ['front', 'back', 'side']) || !num(a.setbacks.front, R.setback) || !num(a.setbacks.back, R.setback) ||
        !num(a.setbacks.side, R.setback)) return false;
    if (!num(a.footprintPct, R.footprintPct) || !num(a.vegPct, R.vegPct)) return false;
    if (a.north !== null && !(int(a.north, [0, 360 - C.NORTH_STEP]) && a.north % C.NORTH_STEP === 0)) return false;
    if (a.streetEdge !== null && !int(a.streetEdge, [0, nPts - 1])) return false;
    if (!isObj(a.edgeOv) || !Object.keys(a.edgeOv).every(function (k) {
      return /^(0|[1-9]\d*)$/.test(k) && Number(k) < nPts && oneOf(a.edgeOv[k], ['back', 'side']);
    })) return false;
    if (!int(a.floors, R.floors) || !bool(a.basement) || !bool(a.usableRoof)) return false;
    if (!num(a.ceilingH, R.ceilingH) || !oneOf(a.roofType, E.roofType) || !oneOf(a.exterior, E.exterior)) return false;
    if (!oneOf(a.stairPos, E.stairPos) || !bool(a.lift)) return false;
    if (!keys(a.parking, ['cars', 'covered']) || !int(a.parking.cars, R.cars) || !bool(a.parking.covered)) return false;
    if (!keys(a.pool, ['on', 'size']) || !bool(a.pool.on) || !oneOf(a.pool.size, E.poolSize)) return false;
    if (!keys(a.extras, ['wall', 'gate', 'seating']) || !bool(a.extras.wall) || !oneOf(a.extras.gate, E.gate) ||
        !bool(a.extras.seating)) return false;
    if (!keys(a.interior, ['style', 'density']) || !oneOf(a.interior.style, E.interiorStyle) ||
        !oneOf(a.interior.density, E.density)) return false;
    return true;
  }

  function plansOk(plans, levels, where) {
    if (!isObj(plans)) return false;
    return Object.keys(plans).every(function (id) {
      var p = plans[id], big = [-1e4, 1e4];
      if (levels.indexOf(id) < 0 || !keys(p, ['sig', 'rooms', 'unmet', 'edited', 'approved', 'error'])) return false;
      if (typeof p.sig !== 'string' || !bool(p.edited) || !bool(p.approved)) return false;
      if (p.error !== null && p.error !== 'no-layout') return false;
      if (!Array.isArray(p.rooms) || !Array.isArray(p.unmet)) return false;
      var seen = {};
      return p.rooms.every(function (r) {
        if (!keys(r, ['id', 'x', 'y', 'w', 'h']) || where[r.id] !== id || seen[r.id]) return false;
        seen[r.id] = true;
        return num(r.x, big) && num(r.y, big) && num(r.w, big) && num(r.h, big) && r.w > 0 && r.h > 0;
      }) && p.unmet.every(function (u) {
        return Array.isArray(u) && u.length === 2 && where[u[0]] === id && where[u[1]] === id;
      });
    });
  }

  function validState(s) {
    try {
      if (!keys(s, ['v', 'stage', 'sampleClean', 'plot', 'ans', 'plans'])) return false;
      if (s.v !== PC.DRAFT_V || !int(s.stage, [1, 5]) || !bool(s.sampleClean)) return false;
      if (!plotOk(s.plot) || !ansOk(s.ans, s.plot.pts.length)) return false;
      if (s.ans.streetEdge !== null && !s.plot.closed) return false;
      // Edge overrides (A-4): only on a closed plot, never on the street edge.
      var ov = Object.keys(s.ans.edgeOv);
      if (ov.length && (!s.plot.closed || ov.indexOf(String(PC.frames.streetEdge(s))) >= 0)) return false;
      var levels = PC.levels.ids(s), where = roomsOk(s.ans, levels);
      return !!where && plansOk(s.plans, levels, where);
    } catch (e) { return false; }
  }

  // A version-1 draft (before edge overrides) becomes version 2 with no overrides (A-4). Anything else is left as it is.
  function migrate(d) {
    if (!isObj(d) || d.v !== 1 || !isObj(d.state) || d.state.v !== 1 || !isObj(d.state.ans) || has.call(d.state.ans, 'edgeOv')) return d;
    d.v = 2; d.state.v = 2; d.state.ans.edgeOv = {};
    return d;
  }
  // Overrides equal to the automatic class are dropped (normalised), not rejected.
  function normalise(state) {
    var site = PC.site.analyse(state), ov = state.ans.edgeOv;
    if (site) Object.keys(ov).forEach(function (k) { if (site.edgeAuto[Number(k)] === ov[k]) delete ov[k]; });
    return state;
  }

  PC.draft = {
    KEY: 'plotcraft.draft.v' + PC.DRAFT_V,
    // Every storage key a draft may live under, current first (ui.storage reads, writes and removes only these).
    KEYS: ['plotcraft.draft.v' + PC.DRAFT_V, 'plotcraft.draft.v1'],
    validState: validState,
    // Nothing worth keeping: no plot point placed yet.
    isEmpty: function (s) { return s.plot.pts.length === 0; },
    serialize: function (state, savedAt) { return JSON.stringify({ v: PC.DRAFT_V, savedAt: savedAt, state: state }); },
    parse: function (text) {
      if (typeof text !== 'string') return null;
      var d;
      try { d = JSON.parse(text); } catch (e) { return null; }
      d = migrate(d);
      if (!keys(d, ['v', 'savedAt', 'state']) || d.v !== PC.DRAFT_V) return null;
      if (typeof d.savedAt !== 'number' || !isFinite(d.savedAt) || !validState(d.state)) return null;
      return { savedAt: d.savedAt, state: normalise(d.state) };
    }
  };
})(globalThis.PC = globalThis.PC || {});
