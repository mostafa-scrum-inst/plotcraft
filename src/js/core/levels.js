/* PC.levels: plan levels (3.2), stairs and lift presence, room areas and names, needed area per level.
   The only place that knows which levels exist. */
(function (PC) {
  'use strict';
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function find(d, id) { return d.ans.rooms.filter(function (r) { return r.id === id; })[0] || null; }
  // Stored area for a size: null for S / M / L, the exact area (m2, 4 decimals) for null, false when invalid.
  function sizeArea(size, area) {
    if (PC.C.SIZES.indexOf(size) >= 0) return null;
    if (size !== null) return false;
    var R = PC.C.RANGE.roomArea;
    return typeof area === 'number' && area >= R[0] - 1e-9 && area <= R[1] + 1e-9 ? Math.round(Math.max(R[0], Math.min(R[1], area)) * 1e4) / 1e4 : false;
  }
  var L = PC.levels = {
    // Plan levels under Q7, lowest first: 'B' (if enabled), 'G', '1', '2'. The roof is never a plan level.
    ids: function (state) {
      var a = state.ans;
      return (a.basement ? ['B'] : []).concat(['G', '1', '2'].slice(0, a.floors));
    },
    name: function (id) { return PC.C.LEVEL_LABEL[id]; },

    // Stairs exist when the house has 2 or more levels, counting the basement and a usable roof.
    stairsExist: function (state) { return L.ids(state).length + (state.ans.usableRoof ? 1 : 0) >= 2; },
    liftExists: function (state) { return L.stairsExist(state) && !!state.ans.lift; },

    // Room area in m2: the exact value, else the S/M/L table.
    roomArea: function (room) { return room.size === null ? room.area : PC.C.ROOM_SIZE[room.type][room.size]; },
    roomsOn: function (state, id) { return state.ans.rooms.filter(function (r) { return r.level === id; }); },

    // { roomId: name }. Per level and type, in list order: a single room of its type has no number; the master
    // bedroom is "Master bedroom" and is not counted in the bedroom numbering.
    roomNames: function (state) {
      var out = {};
      L.ids(state).forEach(function (id) {
        var groups = {};
        L.roomsOn(state, id).forEach(function (r) {
          if (r.master) { out[r.id] = 'Master bedroom'; return; }
          (groups[r.type] = groups[r.type] || []).push(r);
        });
        Object.keys(groups).forEach(function (t) {
          groups[t].forEach(function (r, i) { out[r.id] = PC.C.ROOM_LABEL[t] + (groups[t].length > 1 ? ' ' + (i + 1) : ''); });
        });
      });
      return out;
    },

    // After Q7 changed in a draft: drop what belongs to levels that no longer exist (rooms, their pairs, plans),
    // so the state never points at a missing level. Returns the removed rooms.
    prune: function (draft) {
      var ids = L.ids(draft), gone = {}, removed = [];
      draft.ans.rooms = draft.ans.rooms.filter(function (r) { if (ids.indexOf(r.level) >= 0) return true; gone[r.id] = true; removed.push(r); return false; });
      draft.ans.pairs = draft.ans.pairs.filter(function (p) { return !gone[p[0]] && !gone[p[1]]; });
      Object.keys(draft.plans).forEach(function (id) { if (ids.indexOf(id) < 0) delete draft.plans[id]; });
      return removed;
    },

    /* ---- room list editing (F2-S2, F2-T3). Pure helpers for store mutators: they change the draft and return
       { ok: true, ... } or { ok: false, reason } with the draft untouched. ---- */
    ORDER: ['B', 'G', '1', '2'],
    // Add `count` rooms of one type to a level: size 'S' | 'M' | 'L', or null with an exact area in m2.
    addRooms: function (d, o) {
      var C = PC.C, have = L.roomsOn(d, o.level).length, free = C.MAX_ROOMS_PER_LEVEL - have, ids = [], k;
      if (L.ids(d).indexOf(o.level) < 0) return { ok: false, reason: 'level' };
      if (C.ROOM_TYPES.indexOf(o.type) < 0) return { ok: false, reason: 'type' };
      if (!(o.count >= 1 && o.count <= C.MAX_ROOMS_PER_LEVEL && Math.floor(o.count) === o.count)) return { ok: false, reason: 'count' };
      var area = sizeArea(o.size, o.area);
      if (area === false) return { ok: false, reason: 'area' };
      if (o.count > free) return { ok: false, reason: 'full', free: free, have: have };
      for (k = 0; k < o.count; k++) {
        var id = 'r' + d.ans.nextRoomId++;
        d.ans.rooms.push(PC.store.room(id, o.type, o.level, o.size, false));
        d.ans.rooms[d.ans.rooms.length - 1].area = area;
        ids.push(id);
      }
      return { ok: true, ids: ids };
    },
    // Change one room: patch { type, level, size, area, master } (any subset; size null = exact area).
    // A move to another level drops the room's pairs (they would cross levels): result.pairsDropped.
    updateRoom: function (d, id, patch) {
      var r = find(d, id), dropped = 0;
      if (!r) return { ok: false, reason: 'missing' };
      if (patch.type !== undefined && PC.C.ROOM_TYPES.indexOf(patch.type) < 0) return { ok: false, reason: 'type' };
      if (has(patch, 'size') || has(patch, 'area')) {
        var size = has(patch, 'size') ? patch.size : r.size, area = sizeArea(size, has(patch, 'area') ? patch.area : r.area);
        if (area === false) return { ok: false, reason: 'area' };
      }
      if (patch.level !== undefined && patch.level !== r.level) {
        if (L.ids(d).indexOf(patch.level) < 0) return { ok: false, reason: 'level' };
        if (L.roomsOn(d, patch.level).length >= PC.C.MAX_ROOMS_PER_LEVEL) return { ok: false, reason: 'full', free: 0 };
        var before = d.ans.pairs.length;
        d.ans.pairs = d.ans.pairs.filter(function (p) { return p[0] !== id && p[1] !== id; });
        dropped = before - d.ans.pairs.length;
        r.level = patch.level;
      }
      if (patch.type !== undefined) { r.type = patch.type; if (r.type !== 'bedroom') r.master = false; }
      if (has(patch, 'size') || has(patch, 'area')) { r.size = size; r.area = area; }
      if (patch.master !== undefined) L.setMaster(d, id, patch.master);
      return { ok: true, pairsDropped: dropped };
    },
    removeRoom: function (d, id) {
      if (!find(d, id)) return { ok: false, reason: 'missing' };
      d.ans.rooms = d.ans.rooms.filter(function (r) { return r.id !== id; });
      d.ans.pairs = d.ans.pairs.filter(function (p) { return p[0] !== id && p[1] !== id; });
      return { ok: true };
    },
    // One master bedroom per house (TL ruling 7): turning one on turns the others off.
    setMaster: function (d, id, on) {
      var r = find(d, id);
      if (!r || (on && r.type !== 'bedroom')) return { ok: false, reason: 'type' };
      if (on) d.ans.rooms.forEach(function (x) { x.master = false; });
      r.master = !!on;
      return { ok: true };
    },
    // Must-be-adjacent pair (Q13): two different rooms of one level; stored in id order; a duplicate is ignored.
    addPair: function (d, a, b) {
      var ra = find(d, a), rb = find(d, b), cmp = PC.store.cmpId;
      if (!ra || !rb) return { ok: false, reason: 'missing' };
      if (a === b) return { ok: false, reason: 'self' };
      if (ra.level !== rb.level) return { ok: false, reason: 'levels' };
      var p = cmp(a, b) < 0 ? [a, b] : [b, a];
      if (d.ans.pairs.some(function (q) { return q[0] === p[0] && q[1] === p[1]; })) return { ok: true, dup: true };
      if (L.pairsOn(d, ra.level).length >= PC.C.MAX_PAIRS_PER_LEVEL) return { ok: false, reason: 'max', level: ra.level };
      d.ans.pairs.push(p);
      return { ok: true };
    },
    removePair: function (d, a, b) {
      var n = d.ans.pairs.length;
      d.ans.pairs = d.ans.pairs.filter(function (q) { return !((q[0] === a && q[1] === b) || (q[0] === b && q[1] === a)); });
      return { ok: d.ans.pairs.length < n };
    },
    pairsOn: function (state, id) {
      var on = {};
      L.roomsOn(state, id).forEach(function (r) { on[r.id] = true; });
      return state.ans.pairs.filter(function (p) { return on[p[0]]; });
    },
    // The remaining level nearest to a removed one (order B, G, 1, 2; a tie goes down).
    nearestLevel: function (gone, remaining) {
      var O = L.ORDER, g = O.indexOf(gone), best = null, bd = Infinity;
      remaining.forEach(function (id) { var dd = Math.abs(O.indexOf(id) - g); if (dd < bd || (dd === bd && O.indexOf(id) < O.indexOf(best))) { bd = dd; best = id; } });
      return best;
    },
    // Move every room of level `from` to level `to`, keeping their pairs. Refused when `to` would get more than
    // 8 rooms or 6 pairs.
    moveRooms: function (d, from, to) {
      var C = PC.C, moving = L.roomsOn(d, from), pairs = L.pairsOn(d, from).length;
      if (L.roomsOn(d, to).length + moving.length > C.MAX_ROOMS_PER_LEVEL) return { ok: false, reason: 'full' };
      if (L.pairsOn(d, to).length + pairs > C.MAX_PAIRS_PER_LEVEL) return { ok: false, reason: 'pairs' };
      moving.forEach(function (r) { r.level = to; });
      return { ok: true, moved: moving.length };
    },

    // A Q7 change that removes levels (F2-S2): change(ans), then the rooms of every removed level are moved to the
    // nearest remaining level (choice 'move') or deleted ('delete'), then prune and the usable-roof rule.
    // Returns { ok, reason, gone, roofSwitched }; with ok false the draft must be thrown away.
    removeLevels: function (d, change, choice) {
      var before = L.ids(d), was = d.ans.roofType;
      change(d.ans);
      var after = L.ids(d), gone = before.filter(function (id) { return after.indexOf(id) < 0; }), i, r;
      if (choice === 'move') for (i = 0; i < gone.length; i++) {
        if (!L.roomsOn(d, gone[i]).length) continue;
        r = L.moveRooms(d, gone[i], L.nearestLevel(gone[i], after));
        if (!r.ok) return { ok: false, reason: r.reason, gone: gone };
      }
      L.prune(d);
      return { ok: true, gone: gone, roofSwitched: PC.validate.normaliseRoof(d.ans) && was === 'pitched' };
    },

    // Texts of the remove-level dialog (F2-S2 / R5 / A-7). gone: removed levels that have rooms; to: where "move"
    // would put them; moveRefused: null | 'full' | 'pairs'.
    removalQuestion: function (state, gone, to, moveRefused) {
      var n = gone.reduce(function (k, id) { return k + L.roomsOn(state, id).length; }, 0), one = n === 1;
      var who = 'The ' + gone.map(L.name).join(' and the ') + (gone.length > 1 ? ' have ' : ' has ') + n + ' room' + (one ? '' : 's') + '.';
      if (moveRefused) return who + ' ' + (one ? 'It' : 'They') + ' cannot be moved: the ' + L.name(to) + ' would have more than ' +
        (moveRefused === 'pairs' ? PC.C.MAX_PAIRS_PER_LEVEL + ' pairs' : PC.C.MAX_ROOMS_PER_LEVEL + ' rooms') + '. Delete ' + (one ? 'it' : 'them') + '?';
      return who + ' Move ' + (one ? 'it' : 'them') + ' to the ' + L.name(to) + ', or delete ' + (one ? 'it' : 'them') + '?';
    },
    // The floor plans a change destroys (R5): every level of PC.store.atRisk, lost when the level goes,
    // regenerated when it stays; naming only what those plans really hold (PM round 6): manual edits, an approval
    // or both (several levels: the union). '' when there is none. state: the current state (default the store's).
    plansSentence: function (hit, gone, state) {
      if (!hit.length) return '';
      var s = state || PC.store.get(), lost = hit.filter(function (id) { return gone.indexOf(id) >= 0; }).length;
      var fate = lost === hit.length ? 'lost' : lost ? 'regenerated or lost' : 'regenerated', one = hit.length === 1;
      var ed = hit.some(function (id) { return s.plans[id] && s.plans[id].edited; }), ap = hit.some(function (id) { return s.plans[id] && s.plans[id].approved; });
      var what = one ? (ed && ap ? 'its manual edits and approval' : ed ? 'its manual edits' : 'its approval')
        : (ed && ap ? 'their manual edits and approvals' : ed ? 'their manual edits' : 'their approvals');
      return 'The floor plan' + (one ? '' : 's') + ' of the ' + hit.map(L.name).join(' and the ') + ' will be ' + fate + ', with ' + what + '.';
    },

    // Area a level needs: its rooms plus the stair and lift allowances.
    needed: function (state, id) {
      var sum = 0;
      L.roomsOn(state, id).forEach(function (r) { sum += L.roomArea(r); });
      return sum + (L.stairsExist(state) ? PC.C.STAIR.area : 0) + (L.liftExists(state) ? PC.C.LIFT.area : 0);
    }
  };
})(globalThis.PC = globalThis.PC || {});
