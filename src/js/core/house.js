/* PC.house.build(state): the house model (A-9), the only hand-off from 2D to 3D. Pure.
   Reads the APPROVED plans (frame P) and PC.layout.core only; never generates or syncs. Returns null unless stage 3
   is reachable and valid (CTO H3; TL F4-T1 plan review, item 2).
   Frames: P -> L is u = fp.u + x, v = fp.v + y; the 3D layer maps L -> T with PC.frames.l2t (street at +Z).
   Storey k occupies [baseY, baseY + pitch]: slab = the bottom PC.C.HOUSE.slab, floor at baseY + slab, the next
   slab's underside at floor + storeyH (Q8). F4-T1: levels / rooms / core / roof descriptor / site rectangles.
   F4-T2: furniture per room (PC.furnish, A-11; colour = the resolved Q18 hex, so Q18 changes colours and the key,
   never the boxes), roof.stairHead / liftHead on a usable roof, site.gate (only with the wall, Q7), seating and the
   north marker (site-outdoor.js). Vegetation (F4-T3) stays empty.
   F6-T1b (plan 6.1, Designer A2, TL Q-T9): house v 2 gains `openings` (PC.house.openings, computed before the key so
   the key covers it): glazed openings (kind 'glazed'), small ones, stair slots and the front door on the exterior walls, in L. */
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

  // F6-T1b openings (Designer plan A2 / D-A2). Sizes in PC.C.OPEN. Runs = the room edges on each footprint side of an
  // above-ground level (rooms never overlap, so a room edge is already clipped by the partitions); the stair rectangle
  // on a side gives one slot; the lift none. Habitable rooms get n = max(1, floor((run - endClear) / pitch)) panes
  // evenly spaced endClear clear of each run end, none on a run shorter than the pane + 2 x endClear; service rooms
  // one small pane on a run longer than smallMin. The ground front gets the door at site.entrance; openings closer
  // than doorClear to its frame are dropped. Heads are clamped to storeyH - headGap.
  var HAB = { living: 1, dining: 1, majlis: 1, bedroom: 1, office: 1, kitchen: 1 }, SVC = { bathroom: 1, laundry: 1, maid: 1, storage: 1 };
  var SIDES = ['front', 'back', 'left', 'right'], EPS = 1e-6;
  function openings(house) {
    var O = PC.C.OPEN, fp = house.footprint, sH = house.storeyH, out = [];
    var at = { front: ['v', fp.v], back: ['v', fp.v + fp.d], left: ['u', fp.u], right: ['u', fp.u + fp.w] };
    // the run [a, b] (along u for front / back, along v for left / right) of rectangle r on side s, or null
    function run(r, s) {
      var ax = at[s][0], c = at[s][1], lo = ax === 'v' ? r.v : r.u, hi = ax === 'v' ? r.v + r.d : r.u + r.w;
      if (Math.abs(lo - c) > EPS && Math.abs(hi - c) > EPS) return null;
      return ax === 'v' ? [r.u, r.u + r.w] : [r.v, r.v + r.d];
    }
    function put(list, lv, s, c, w, kind, sill, h) {
      var head = Math.min(sill + h, sH - O.headGap);
      if (head - sill > 0.05) list.push({ level: lv.id, side: s, a: c - w / 2, b: c + w / 2, kind: kind, sill: sill, head: head });
    }
    house.levels.forEach(function (lv) {
      if (lv.index < 0) return;
      SIDES.forEach(function (s) {
        var list = [];
        lv.rooms.forEach(function (r) {
          var q = run(r, s); if (!q) return;
          var L = q[1] - q[0];
          if (HAB[r.type] && L >= O.win.w + 2 * O.endClear) {
            var n = Math.max(1, Math.floor((L - O.endClear) / O.pitch)), span = L - 2 * O.endClear;
            for (var i = 0; i < n; i++) put(list, lv, s, q[0] + O.endClear + span * (i + 0.5) / n, O.win.w, 'glazed', O.win.sill, O.win.h);
          } else if (SVC[r.type] && L > O.smallMin) put(list, lv, s, (q[0] + q[1]) / 2, O.small.w, 'small', O.small.sill, O.small.h);
        });
        var sq = lv.stair && run(lv.stair, s);
        if (sq && sq[1] - sq[0] >= O.slot.w) put(list, lv, s, (sq[0] + sq[1]) / 2, O.slot.w, 'slot', O.slot.sill, O.slot.h);
        if (lv.index === 0 && s === 'front') {
          var e = house.site.entrance, da = e.u - O.door.w / 2, db = e.u + O.door.w / 2;
          list = list.filter(function (o) { return o.b + O.doorClear <= da || o.a - O.doorClear >= db; });
          put(list, lv, s, e.u, O.door.w, 'door', 0, O.door.h);
        }
        list.sort(function (p, q) { return p.a - q.a; });
        out.push.apply(out, list);
      });
    });
    return out;
  }

  PC.house = {
    hash: hash,
    openings: openings,
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
        v: 2, key: '',
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
      house.openings = openings(house);
      house.key = hash(JSON.stringify(house));
      return house;
    }
  };
})(globalThis.PC = globalThis.PC || {});
