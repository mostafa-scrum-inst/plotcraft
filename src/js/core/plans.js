/* PC.plans: the floor plan of each level (A-7). A stored plan belongs to its level only while its `sig` equals the
   level's current signature; sync() regenerates exactly the missing or stale levels and keeps the others (edits
   and approval). Plans are in frame P (footprint-local, see PC.layout). Pure. */
(function (PC) {
  'use strict';
  var P = PC.plans = {
    // Generator input for one level of a state.
    input: function (state, id) {
      var fp = PC.site.analyse(state).footprint, L = PC.levels;
      return {
        W: fp.w, D: fp.d,
        rooms: L.roomsOn(state, id).map(function (r) { return { id: r.id, area: L.roomArea(r) }; }),
        pairs: L.pairsOn(state, id).map(function (p) { return [p[0], p[1]]; }),
        stairs: L.stairsExist(state), stairPos: state.ans.stairPos, lift: L.liftExists(state)
      };
    },
    // A fresh plan for a level (Draft, not edited).
    make: function (state, id) {
      var res = PC.layout.generate(P.input(state, id));
      return { sig: PC.sig.level(state, id), rooms: res.ok ? res.rooms : [], unmet: res.ok ? res.unmet : [],
        edited: false, approved: false, error: res.ok ? null : 'no-layout' };
    },
    // In-place mutator, always inside a nav commit (Resume, Load sample, Skip, entering stage 3). While a level's
    // signature is 'invalid' (open plot, no footprint) its stored plan is left alone. Plans of removed levels go.
    sync: function (draft) {
      var ids = PC.levels.ids(draft);
      Object.keys(draft.plans).forEach(function (id) { if (ids.indexOf(id) < 0) delete draft.plans[id]; });
      ids.forEach(function (id) {
        var sig = PC.sig.level(draft, id), plan = draft.plans[id];
        if (sig === 'invalid' || (plan && plan.sig === sig)) return;
        draft.plans[id] = P.make(draft, id);
      });
      return draft;
    },
    // "Regenerate this floor": a new Draft layout for one level (its approval and edits go; other levels untouched).
    regenerate: function (draft, id) {
      if (PC.sig.level(draft, id) === 'invalid') return false;
      draft.plans[id] = P.make(draft, id);
      return true;
    },
    // Something the architect would lose (R5 round 5, the predicate of PC.store.atRisk): manual edits or an approval.
    hasWork: function (plan) { return !!plan && (plan.edited || plan.approved); },

    /* ---- editing (F3-S2, A-15), frame P; pure: the canvas controller only translates gestures ---- */
    // Everything an edit of level `id` needs: footprint size, the stair / lift block, the snap grid of the unit.
    ctx: function (state, id) {
      var fp = PC.site.analyse(state).footprint, L = PC.levels;
      if (!fp) return null;
      var c = PC.layout.core(fp.w, fp.d, L.stairsExist(state), state.ans.stairPos, L.liftExists(state));
      return { W: fp.w, D: fp.d, core: { stair: c.stair, lift: c.lift }, grid: PC.C.PLAN_SNAP[state.ans.unit] };
    },
    // Snap candidates for room `id`: for each axis the parallel edges as { v, lo, hi, kind }, where x-edges are the
    // vertical lines x = v spanning y in [lo, hi]. Other rooms ('room'), the stair and lift ('core') and the
    // footprint ('footprint'). Which room edges count depends on the moving edge's span (snapEdge, ruling 9).
    edgeCands: function (rooms, id, ctx) {
      var out = { x: [], y: [] }, W = ctx.W, D = ctx.D;
      function add(b, kind) {
        out.x.push({ v: b.x, lo: b.y, hi: b.y + b.h, kind: kind }, { v: b.x + b.w, lo: b.y, hi: b.y + b.h, kind: kind });
        out.y.push({ v: b.y, lo: b.x, hi: b.x + b.w, kind: kind }, { v: b.y + b.h, lo: b.x, hi: b.x + b.w, kind: kind });
      }
      rooms.forEach(function (r) { if (r.id !== id) add(r, 'room'); });
      [ctx.core.stair, ctx.core.lift].forEach(function (b) { if (b) add(b, 'core'); });
      add({ x: 0, y: 0, w: W, h: D }, 'footprint');
      return out;
    },
    // One moving edge at v (its own span [s0, s1] across the axis), allowed range [lo, hi]. First the nearest
    // candidate within PLAN_EDGE_SNAP (rooms only when their span overlaps the moving span widened by that
    // distance at each end; core and footprint always; ties -> the lower value), else the nearest grid line in
    // range (frame P, from the footprint origin), else v clamped. -> { v, to: 'edge' | 'grid' | 'none', d, at }.
    snapEdge: function (v, s0, s1, cands, grid, lo, hi) {
      var R = PC.C.PLAN_EDGE_SNAP, E = 1e-9, best = null;
      cands.forEach(function (c) {
        if (c.v < lo - E || c.v > hi + E) return;
        if (c.kind === 'room' && (c.hi < s0 - R - E || c.lo > s1 + R + E)) return;
        var d = Math.abs(c.v - v);
        if (d > R + E) return;
        if (!best || d < best.d - E || (Math.abs(d - best.d) <= E && c.v < best.v)) best = { v: c.v, to: 'edge', d: d, at: c };
      });
      if (best) return best;
      var g = Math.round(v / grid) * grid;
      if (g < lo - E) g = Math.ceil((lo - E) / grid) * grid;
      if (g > hi + E) g = Math.floor((hi + E) / grid) * grid;
      if (g < lo - E || g > hi + E) { var cl = Math.min(hi, Math.max(lo, v)); return { v: cl, to: 'none', d: Math.abs(cl - v), at: null }; }
      return { v: g, to: 'grid', d: Math.abs(g - v), at: null };
    },
    // A room dragged by (dx, dy) from `start`: clamped inside the footprint; on each axis the edge (low or high)
    // nearer to a candidate decides the snap (low on ties); without one, the edge needing the smaller grid shift.
    // ctx needs W, D, grid and cands (edgeCands). -> { rect, guides: [{ axis, v, lo, hi }] } (guides for snaps to a
    // room or the core; the footprint outline is drawn anyway).
    moveRect: function (start, dx, dy, ctx) {
      var r = { id: start.id, x: start.x, y: start.y, w: start.w, h: start.h }, guides = [];
      [['x', 'w', 'W', 'h', dx], ['y', 'h', 'D', 'w', dy]].forEach(function (a) {
        var p = a[0], s = a[1], max = ctx[a[2]] - r[s];
        // the moving edges' span across the axis: the clamped position on the other axis (A-15; QA F3-T2 obs 5)
        var v = Math.min(max, Math.max(0, start[p] + a[4])), s0 = p === 'x' ? Math.min(ctx.D - r.h, Math.max(0, start.y + dy)) : Math.min(ctx.W - r.w, Math.max(0, start.x + dx)), s1 = s0 + r[a[3]];
        var lo = P.snapEdge(v, s0, s1, ctx.cands[p], ctx.grid, 0, max);
        var hi = P.snapEdge(v + r[s], s0, s1, ctx.cands[p], ctx.grid, r[s], ctx[a[2]]);
        var useHi = hi.to === 'edge' ? lo.to !== 'edge' || hi.d < lo.d - 1e-9 : lo.to !== 'edge' && hi.d < lo.d - 1e-9;
        var pick = useHi ? hi : lo;
        r[p] = useHi ? hi.v - r[s] : lo.v;
        if (pick.to === 'edge' && pick.at.kind !== 'footprint') guides.push({ axis: p, v: pick.v, lo: Math.min(pick.at.lo, s0), hi: Math.max(pick.at.hi, s1) });
      });
      return { rect: round(r), guides: guides };
    },
    // A room resized by one edge handle: 'e' / 'w' move its right / left edge (high / low x), 'n' / 's' its back /
    // front edge (high / low y). The edge stops at the footprint and 1.5 m from the opposite edge, then snaps.
    resizeRect: function (start, kind, dx, dy, ctx) {
      var MIN = PC.C.ROOM_MIN_SIDE, r = { id: start.id, x: start.x, y: start.y, w: start.w, h: start.h }, x1 = r.x + r.w, y1 = r.y + r.h, sn;
      // the finger position is clamped to the allowed range first (as moveRect does), so an edge dragged past the
      // footprint lands on it, not on the nearest grid line inside it (QA F3-T2 bug 1)
      var snap = function (v, s0, s1, cands, lo, hi) { return P.snapEdge(Math.min(hi, Math.max(lo, v)), s0, s1, cands, ctx.grid, lo, hi); };
      if (kind === 'e' || kind === 'w') {
        sn = kind === 'e' ? snap(x1 + dx, r.y, y1, ctx.cands.x, r.x + MIN, ctx.W) : snap(r.x + dx, r.y, y1, ctx.cands.x, 0, x1 - MIN);
        if (kind === 'e') r.w = sn.v - r.x; else { r.x = sn.v; r.w = x1 - sn.v; }
      } else {
        sn = kind === 'n' ? snap(y1 + dy, r.x, x1, ctx.cands.y, r.y + MIN, ctx.D) : snap(r.y + dy, r.x, x1, ctx.cands.y, 0, y1 - MIN);
        if (kind === 'n') r.h = sn.v - r.y; else { r.y = sn.v; r.h = y1 - sn.v; }
      }
      var axis = kind === 'e' || kind === 'w' ? 'x' : 'y', s0 = axis === 'x' ? r.y : r.x, s1 = s0 + (axis === 'x' ? r.h : r.w);
      return { rect: round(r), guides: sn.to === 'edge' && sn.at.kind !== 'footprint' ? [{ axis: axis, v: sn.v, lo: Math.min(sn.at.lo, s0), hi: Math.max(sn.at.hi, s1) }] : [] };
    },
    // In-place mutator (inside a commit): store the edited rectangle of one room on level `id`. The level becomes
    // edited, loses its approval and gets its unmet pairs recomputed; no other level is touched.
    applyEdit: function (draft, id, rect) {
      var p = draft.plans[id], was = !!(p && p.approved), i = p ? p.rooms.findIndex(function (r) { return r.id === rect.id; }) : -1;
      if (i < 0) return { changed: false, wasApproved: was };
      var o = p.rooms[i], n = round(rect);
      if (o.x === n.x && o.y === n.y && o.w === n.w && o.h === n.h) return { changed: false, wasApproved: was };
      p.rooms[i] = n; p.edited = true; p.approved = false;
      var by = {}; p.rooms.forEach(function (r) { by[r.id] = r; });
      p.unmet = PC.levels.pairsOn(draft, id).map(function (q) { return [q[0], q[1]]; })
        .filter(function (q) { return by[q[0]] && by[q[1]] && !PC.layout.adjacent(by[q[0]], by[q[1]]); });
      return { changed: true, wasApproved: was };
    },
    // Overlaps on a level (rooms with rooms, rooms with the stair / lift), [] when none. Derived, never stored.
    problems: function (state, id) {
      var p = state.plans[id], c = P.ctx(state, id);
      return p && !p.error && c ? PC.layout.overlaps(p.rooms, c.core) : [];
    },
    // '' when level `id` can be approved; else 'none' (no plan / stale / cannot be laid out) or 'overlap'.
    canApprove: function (state, id) {
      var p = state.plans[id];
      if (!p || p.error || p.sig !== PC.sig.level(state, id)) return 'none';
      return P.problems(state, id).length ? 'overlap' : '';
    },
    // In-place mutators. approve refuses (false) unless canApprove is ''; unapprove returns the level to Draft.
    approve: function (draft, id) {
      if (P.canApprove(draft, id)) return false;
      draft.plans[id].approved = true;
      return true;
    },
    unapprove: function (draft, id) {
      var p = draft.plans[id];
      if (!p || !p.approved) return false;
      p.approved = false;
      return true;
    }
  };
  // 0.01 m, as generated plans; + 0 turns -0 into 0.
  function round(r) {
    var q = function (v) { return Math.round(v * 100) / 100 + 0; };
    return { id: r.id, x: q(r.x), y: q(r.y), w: q(r.w), h: q(r.h) };
  }
})(globalThis.PC = globalThis.PC || {});
