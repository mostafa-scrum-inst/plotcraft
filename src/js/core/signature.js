/* PC.sig: per-level layout signature (A-7). A stored plan is valid only while its sig equals this string.
   In it: footprint size and street edge, stair/lift, the level's rooms and pairs. Not in it: where the
   footprint sits, names, the master flag, and every appearance answer. */
(function (PC) {
  'use strict';
  PC.sig = {
    level: function (state, id) {
      var L = PC.levels, site = PC.site.analyse(state);
      if (!site || !site.footprint || L.ids(state).indexOf(id) < 0) return 'invalid';
      var cmp = PC.store.cmpId, on = {}, a = state.ans;
      var rooms = L.roomsOn(state, id).map(function (r) { on[r.id] = true; return [r.id, r.type, L.roomArea(r)]; })
        .sort(function (x, y) { return cmp(x[0], y[0]); });
      var pairs = a.pairs.filter(function (p) { return on[p[0]] && on[p[1]]; })
        .map(function (p) { return cmp(p[0], p[1]) <= 0 ? [p[0], p[1]] : [p[1], p[0]]; })
        .sort(function (x, y) { return cmp(x[0], y[0]) || cmp(x[1], y[1]); });
      return JSON.stringify({
        fp: [site.footprint.w, site.footprint.d, site.edge],
        core: L.stairsExist(state) ? [a.stairPos, L.liftExists(state) ? 1 : 0] : 0,
        rooms: rooms, pairs: pairs
      });
    }
  };
})(globalThis.PC = globalThis.PC || {});
