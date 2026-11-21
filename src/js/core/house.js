/* PC.house.build(state): the house model (A-9), the only hand-off from 2D to 3D. Pure.
   Reads the APPROVED plans (frame P) and PC.layout.core only; never generates or syncs. Returns null unless stage 3
   is reachable and valid (CTO H3; TL F4-T1 plan review, item 2).
   Frames: P -> L is u = fp.u + x, v = fp.v + y; the 3D layer maps L -> T with PC.frames.l2t (street at +Z).
   Storey k occupies [baseY, baseY + pitch]: slab = the bottom PC.C.HOUSE.slab, floor at baseY + slab, the next
   slab's underside at floor + storeyH (Q8). F4-T1: levels / rooms / core / roof descriptor / site rectangles.
   F4-T2: furniture per room (PC.furnish, A-11; colour = the resolved Q18 hex, so Q18 changes colours and the key,
   never the boxes), roof.stairHead / liftHead on a usable roof, site.gate (only with the wall, Q7), seating and the
   north marker (site-outdoor.js). Vegetation (F4-T3) stays empty. */
(function (PC) {
  'use strict';
  var INDEX = { B: -1, G: 0, 1: 1, 2: 2 };

  // FNV-1a 32-bit over a string, as 8 hex digits.
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function rect(fp, r) { return r ? { u: fp.u + r.x, v: fp.v + r.y, w: r.w, d: r.h } : null; }

  PC.house = {
    hash: hash,
    build: function (state) {
      var st = PC.stages.status(state);
      if (!st[3].reachable || !st[3].valid) return null;
      var site = PC.site.analyse(state), fp = site.footprint, a = state.ans, L = PC.levels, H = PC.C.HOUSE;
      if (!fp) return null;
      var b = PC.geom.bbox(site.ptsL), cu = (b.x0 + b.x1) / 2, cv = (b.y0 + b.y1) / 2;
      var radius = site.ptsL.reduce(function (m, p) { return Math.max(m, Math.hypot(p[0] - cu, p[1] - cv)); }, 0);
      var core = PC.layout.core(fp.w, fp.d, L.stairsExist(state), a.stairPos, L.liftExists(state));
      var names = L.roomNames(state), types = {};
      a.rooms.forEach(function (r) { types[r.id] = r.type; });
      var storeyH = a.ceilingH, pitch = storeyH + H.slab, style = PC.data.interiors[a.interior.style];
      // A usable roof is never pitched (validation switches it to flat); the model applies the same rule.
      var roofType = a.usableRoof && a.roofType === 'pitched' ? 'flat' : a.roofType, gu = PC.site.gateU(site, a.extras);
      var levels = L.ids(state).map(function (id) {
        var index = INDEX[id];
        return {
          id: id, name: L.name(id), index: index, baseY: index * pitch,
          rooms: state.plans[id].rooms.map(function (r) {
            var pieces = PC.furnish.room(r, PC.data.furniture[types[r.id]], a.interior.density).map(function (q) {
              return { kind: q.kind, u: fp.u + q.x, v: fp.v + q.y, w: q.w, d: q.d, h: q.h, y0: q.y0, color: style[q.color] };
            });
            return { id: r.id, name: names[r.id], type: types[r.id], u: fp.u + r.x, v: fp.v + r.y, w: r.w, d: r.h, area: r.w * r.h, furniture: pieces };
          }),
          stair: rect(fp, core.stair), lift: rect(fp, core.lift)
        };
      });
      var top = levels[levels.length - 1].index;
      var copy = function (o) { return o ? JSON.parse(JSON.stringify(o)) : null; };
      var house = {
        v: 1, key: '',
        center: [cu, cv], radius: radius,
        plot: { pts: site.ptsL.map(function (p) { return [p[0], p[1]]; }), area: site.plotArea },
        northDeg: PC.frames.northL(state),
        footprint: { u: fp.u, v: fp.v, w: fp.w, d: fp.d },
        storeyH: storeyH, pitch: pitch,
        levels: levels,
        roof: { type: roofType, usable: !!a.usableRoof, baseY: (top + 1) * pitch,
          stairHead: a.usableRoof ? rect(fp, core.stair) : null, liftHead: a.usableRoof ? rect(fp, core.lift) : null },
        exterior: a.exterior, interior: { style: a.interior.style, density: a.interior.density },
        site: {
          entrance: { u: fp.u + fp.w / 2, v: fp.v, w: H.door },
          parking: copy(site.parking), pool: copy(site.pool),
          wall: !!a.extras.wall, gate: gu === null ? null : { u: gu, w: PC.C.SITE.gateW }, seating: copy(site.seating),
          trees: site.trees.map(function (t) { return t.slice(); }), shrubs: site.shrubs.map(function (t) { return t.slice(); }),
          vegPct: site.veg ? site.veg.pct : 0, vegPlaced: site.vegPlaced,
          northMarker: copy(site.northMarker)
        }
      };
      house.key = hash(JSON.stringify(house));
      return house;
    }
  };
})(globalThis.PC = globalThis.PC || {});
