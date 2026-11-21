/* PC.layout: the floor-plan generator (A-8), frame P = footprint-local (x along u from the footprint's left edge,
   y along v from its street side; "left" is low x as seen from the street looking in). Pure and deterministic:
   no randomness, stable sorts in numeric id order, strict-improvement comparisons only.
   core -> cells -> per cell every column partition -> room-to-cell assignment -> mirror variants for adjacency
   -> a second room order when pairs stay unmet -> 0.01 m rounding -> a 0.5 m snap kept only while `check` passes;
   no layout at all -> the same once more with the wider retry range, kept only if `check` passes. */
(function (PC) {
  'use strict';
  function K() { return PC.C.LAYOUT; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function snap(x) { return Math.round(x * 2) / 2; }
  function floorHalf(x) { return Math.floor(x * 2 + 1e-9) / 2; }

  // The stair / lift block and the free cells around it. Same block on every level (also drawn and used in 3D).
  function core(W, D, stairs, pos, lift) {
    if (!stairs) return { stair: null, lift: null, cells: [{ id: 'A', x: 0, y: 0, w: W, h: D }] };
    var S = PC.C.STAIR, Lf = PC.C.LIFT, MIN = PC.C.ROOM_MIN_SIDE, alongV = D >= W;   // stair long side along the longer axis
    var sw = alongV ? S.w : S.d, sd = alongV ? S.d : S.w, lw = alongV ? Lf.w : Lf.d, ld = alongV ? Lf.d : Lf.w;
    var cw = alongV ? sw + (lift ? lw : 0) : sw, cd = alongV ? sd : sd + (lift ? ld : 0), cx, cy;
    if (pos === 'centre') { cx = floorHalf((W - cw) / 2); cy = floorHalf((D - cd) / 2); }
    else { cx = pos[1] === 'l' ? 0 : W - cw; cy = pos[0] === 'f' ? 0 : D - cd; }
    var stair = { x: cx, y: cy, w: sw, h: sd };
    var lf = lift ? (alongV ? { x: cx + sw, y: cy, w: lw, h: ld } : { x: cx, y: cy + sd, w: lw, h: ld }) : null;
    var cells = [];
    function add(id, x, y, w, h) { if (w >= MIN - 1e-9 && h >= MIN - 1e-9) cells.push({ id: id, x: x, y: y, w: w, h: h }); }
    if (alongV) { add('F', 0, 0, W, cy); add('CL', 0, cy, cx, cd); add('CR', cx + cw, cy, W - cx - cw, cd); add('B', 0, cy + cd, W, D - cy - cd); }
    else { add('F', 0, 0, cx, D); add('CL', cx, 0, cw, cy); add('CR', cx, cy + cd, cw, D - cy - cd); add('B', cx + cw, 0, W - cx - cw, D); }
    return { stair: stair, lift: lf, cells: cells };
  }

  // Best column-partition layout of `rooms` (already ordered) in a cell, or null. An under-filled cell is also
  // tried trimmed to fMax x the rooms' area along each axis (CTO round 1), so a big room is not stretched across
  // a cell it cannot fill.
  function layoutCell(cell, rooms, R) {
    if (!rooms.length) return { score: 0, rects: [] };
    var sum = rooms.reduce(function (s, r) { return s + r.area; }, 0), MIN = PC.C.ROOM_MIN_SIDE, shapes = [cell], best = null;
    if (cell.w * cell.h > R.fMax * sum) {
      var tw = R.fMax * sum / cell.h, th = R.fMax * sum / cell.w;
      if (tw >= MIN) shapes.push({ x: cell.x, y: cell.y, w: tw, h: cell.h });
      if (th >= MIN) shapes.push({ x: cell.x, y: cell.y, w: cell.w, h: th });
    }
    shapes.forEach(function (sh) { var l = layoutShape(sh, rooms, R); if (l && (!best || l.score < best.score - 1e-9)) best = l; });
    return best;
  }
  function layoutShape(cell, rooms, R) {
    var MIN = PC.C.ROOM_MIN_SIDE, ASP = PC.C.ROOM_MAX_ASPECT, sum = rooms.reduce(function (s, r) { return s + r.area; }, 0);
    var fFill = Math.min(R.fMax, cell.w * cell.h / sum + 1e-12), n = rooms.length, best = null;
    if (fFill < R.fMin - 1e-9) return null;
    (fFill > 1 ? [fFill, 1] : [fFill]).forEach(function (f) {
      for (var axis = 0; axis < 2; axis++) {                     // 0: columns advance along x; 1: along y
        var L = axis ? cell.h : cell.w, S = axis ? cell.w : cell.h, groups = {};
        // One column = a contiguous group of rooms [i..j]; its two thickness candidates depend only on the group,
        // so they are evaluated once per group (n(n+1)/2 groups) instead of once per partition.
        var column = function (i, j) {
          var key = i * 16 + j;
          if (key in groups) return groups[key];
          var grp = rooms.slice(i, j + 1), A = grp.reduce(function (s, r) { return s + r.area * f; }, 0);
          var evalT = function (t) {                               // one column thickness: valid shapes, aspect score
            var sc = 0;
            for (var q = 0; q < grp.length; q++) {
              var len = grp[q].area * f / t, a = Math.max(t, len) / Math.min(t, len);
              if (t < MIN - 1e-6 || len < MIN - 1e-6 || a > ASP + 1e-6) return null;
              sc += a - 1;
            }
            return { t: t, sc: sc };
          };
          var full = evalT(A / S), tsq = Math.sqrt(grp[0].area * f), sq = A / tsq <= S + 1e-9 && tsq > A / S ? evalT(tsq) : null;
          return (groups[key] = full || sq ? { grp: grp, full: full, sq: sq } : null);
        };
        for (var mask = 0; mask < (1 << (n - 1)); mask++) {
          var cols = [], ok = true, i = 0, minTotal = 0;
          while (i < n && ok) {
            var j = i; while (j < n - 1 && !(mask & (1 << j))) j++;
            var col = column(i, j);
            if (!col) { ok = false; break; }
            cols.push(col); minTotal += (col.full || col.sq).t; i = j + 1;
            if (minTotal > L + 1e-6) { ok = false; break; }
          }
          if (!ok || minTotal > L + 1e-6) continue;
          // full span first; upgrade a column to square-ish (rest of the column is hall) while the cell allows it
          var total = minTotal, pick = cols.map(function (c) { return c.full || c.sq; });
          cols.forEach(function (c, k) {
            if (c.full && c.sq && c.sq.sc < c.full.sc - 1e-9 && total - c.full.t + c.sq.t <= L + 1e-6) { total += c.sq.t - c.full.t; pick[k] = c.sq; }
          });
          var pos = 0, score = 4 * Math.abs(f - 1) * n, rects = [];
          cols.forEach(function (c, k) {
            var t = pick[k].t, off = 0; score += pick[k].sc;
            c.grp.forEach(function (r) {
              var len = r.area * f / t;
              rects.push(axis ? { id: r.id, x: off, y: pos, w: len, h: t } : { id: r.id, x: pos, y: off, w: t, h: len });
              off += len;
            });
            pos += t;
          });
          if (!best || score < best.score - 1e-9) best = { score: score, rects: rects };
        }
      }
    });
    return best;
  }
  // The four mirror variants of a cell layout, placed in the cell.
  function variants(cell, lay) {
    return [0, 1, 2, 3].map(function (m) {
      return lay.rects.map(function (r) {
        return { id: r.id, w: r.w, h: r.h, x: cell.x + (m & 1 ? cell.w - r.x - r.w : r.x), y: cell.y + (m & 2 ? cell.h - r.y - r.h : r.y) };
      });
    });
  }
  // Share a wall: touching within adjTol along adjMin or more.
  function adjacent(a, b) {
    var e = K().adjTol, m = K().adjMin;
    function ov(a0, a1, b0, b1) { return Math.min(a1, b1) - Math.max(a0, b0); }
    if (Math.abs(a.x + a.w - b.x) < e || Math.abs(b.x + b.w - a.x) < e) return ov(a.y, a.y + a.h, b.y, b.y + b.h) >= m - 1e-9;
    if (Math.abs(a.y + a.h - b.y) < e || Math.abs(b.y + b.h - a.y) < e) return ov(a.x, a.x + a.w, b.x, b.x + b.w) >= m - 1e-9;
    return false;
  }

  // shared: cell layouts by cell and ordered room ids, reused by the second room order (same subset, same order).
  // R: the cell scale range { fMin, fMax } (first pass PC.C.LAYOUT, retry PC.C.LAYOUT.retry).
  function generateOrdered(W, D, rs, pairs, c, shared, R) {
    var cells = c.cells, n = rs.length, k = cells.length, memo = {}, cands = [], asg = [], used = [], i;
    var top = pairs.length ? K().topAssignments : 1, paired = {};
    pairs.forEach(function (p) { paired[p[0]] = paired[p[1]] = true; });
    var twin = rs.map(function (r, q) { return q > 0 && !paired[r.id] && !paired[rs[q - 1].id] && Math.abs(r.area - rs[q - 1].area) < 1e-9; });
    for (i = 0; i < k; i++) used.push(0);
    function cellLay(ci, mask) {
      var key = ci * 256 + mask;
      if (!(key in memo)) {
        var sub = rs.filter(function (r, q) { return mask & (1 << q); }), sk = ci + '|' + sub.map(function (r) { return r.id; }).join(',');
        memo[key] = sk in shared ? shared[sk] : (shared[sk] = layoutCell(cells[ci], sub, R));
      }
      return memo[key];
    }
    (function dfs(q) {
      if (q === n) {
        var masks = cells.map(function () { return 0; }), score = 0, ci;
        asg.forEach(function (cc, r) { masks[cc] |= 1 << r; });
        for (ci = 0; ci < k; ci++) { var l = cellLay(ci, masks[ci]); if (!l) return; score += l.score; }
        if (c.stair && cells.some(function (cl, x) { return cl.id[0] === 'C' && !masks[x]; })) score -= 2;   // keep a hall beside the stair
        // keep only the best `top` in (score, discovery order): the same list a full sort would give
        if (cands.length < top || score < cands[cands.length - 1].score) {
          var at = cands.length;
          while (at > 0 && cands[at - 1].score > score) at--;
          cands.splice(at, 0, { score: score, masks: masks });
          if (cands.length > top) cands.pop();
        }
        return;
      }
      // Two consecutive unpaired rooms of the same area are interchangeable: only non-decreasing cells are tried
      // for them (the first of each set of equivalent assignments, which is the one the search kept anyway).
      for (var cc = q > 0 && twin[q] ? asg[q - 1] : 0; cc < k; cc++) {
        if ((used[cc] + rs[q].area) * R.fMin > cells[cc].w * cells[cc].h + 1e-9) continue;
        asg[q] = cc; used[cc] += rs[q].area; dfs(q + 1); used[cc] -= rs[q].area;
      }
    })(0);
    if (!cands.length) return { ok: false };
    var best = null;
    cands.some(function (cd) {
      var vs = cd.masks.map(function (m, ci) { return variants(cells[ci], cellLay(ci, m)); }), combos = pairs.length ? Math.pow(4, k) : 1;
      for (var cb = 0; cb < combos; cb++) {
        var rects = [], by = {};
        for (var ci = 0; ci < k; ci++) rects = rects.concat(vs[ci][(cb >> (2 * ci)) & 3]);
        rects.forEach(function (r) { by[r.id] = r; });
        var unmet = pairs.filter(function (p) { return !adjacent(by[p[0]], by[p[1]]); }), score = cd.score + 100 * unmet.length;
        if (!best || score < best.score - 1e-9) best = { score: score, rects: rects, unmet: unmet };
        if (!unmet.length) break;
      }
      return best && !best.unmet.length && best.score <= cd.score + 1e-9;
    });
    return { ok: true, score: best.score, rooms: best.rects, unmet: best.unmet };
  }

  // Violations of a layout against its programme (A-8): [] when valid.
  function check(W, D, c, requested, rooms) {
    var errs = [], MIN = PC.C.ROOM_MIN_SIDE, ASP = PC.C.ROOM_MAX_ASPECT, TOL = PC.C.ROOM_AREA_TOL, ov = K().overlapTol;
    requested.forEach(function (r) {
      var g = rooms.filter(function (q) { return q.id === r.id; });
      if (g.length !== 1) { errs.push({ code: g.length ? 'duplicate' : 'missing', ids: [r.id] }); return; }
      var q = g[0], a = q.w * q.h;
      if (Math.abs(a - r.area) / r.area > TOL + 1e-9) errs.push({ code: 'area', ids: [r.id] });
      if (Math.min(q.w, q.h) < MIN - 1e-6) errs.push({ code: 'side', ids: [r.id] });
      if (Math.max(q.w, q.h) / Math.min(q.w, q.h) > ASP + 1e-6) errs.push({ code: 'aspect', ids: [r.id] });
      if (q.x < -1e-6 || q.y < -1e-6 || q.x + q.w > W + ov || q.y + q.h > D + ov) errs.push({ code: 'outside', ids: [r.id] });
    });
    rooms.forEach(function (q) { if (!requested.some(function (r) { return r.id === q.id; })) errs.push({ code: 'unknown', ids: [q.id] }); });
    return errs.concat(PC.layout.overlaps(rooms, c));
  }
  // Rectangles that overlap one another or the stair / lift by more than overlapTol (also the editor's subset).
  function overlaps(rooms, c) {
    var ov = K().overlapTol, out = [], all = rooms.map(function (r) { return { id: r.id, x: r.x, y: r.y, w: r.w, h: r.h }; });
    if (c && c.stair) all.push({ id: 'stair', x: c.stair.x, y: c.stair.y, w: c.stair.w, h: c.stair.h });
    if (c && c.lift) all.push({ id: 'lift', x: c.lift.x, y: c.lift.y, w: c.lift.w, h: c.lift.h });
    for (var i = 0; i < all.length; i++) for (var j = i + 1; j < all.length; j++) {
      var a = all[i], b = all[j];
      if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > ov && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > ov)
        out.push({ code: b.id === 'stair' || b.id === 'lift' ? 'overlap-core' : 'overlap-room', ids: [a.id, b.id] });
    }
    return out;
  }

  PC.layout = {
    core: core,
    adjacent: adjacent,
    check: check,
    overlaps: overlaps,
    // input: { W, D, rooms: [{ id, area }], pairs: [[a, b]], stairs, stairPos, lift } ->
    // { ok: true, rooms: [{ id, x, y, w, h }], unmet, core } | { ok: false, core }.
    generate: function (inp) {
      var c = core(inp.W, inp.D, inp.stairs, inp.stairPos, inp.lift), cmp = PC.store.cmpId, pairs = inp.pairs || [];
      var out = { core: { stair: c.stair, lift: c.lift } };
      if (!inp.rooms.length) { out.ok = true; out.rooms = []; out.unmet = []; return out; }
      var desc = inp.rooms.slice().sort(function (a, b) { return b.area - a.area || cmp(a.id, b.id); });
      // One pass with a cell scale range: the area-descending order, then (pairs unmet) partners pulled together.
      function pass(R) {
        var shared = {}, res = generateOrdered(inp.W, inp.D, desc, pairs, c, shared, R);
        if (pairs.length && !(res.ok && !res.unmet.length)) {
          var bumped = desc.slice();                                      // order 2: partners pulled together
          pairs.forEach(function (p) {
            var i = bumped.findIndex(function (r) { return r.id === p[0]; }), j = bumped.findIndex(function (r) { return r.id === p[1]; });
            var lo = Math.min(i, j), hi = Math.max(i, j), m = bumped.splice(hi, 1)[0];
            bumped.splice(lo + 1, 0, m);
          });
          var b = generateOrdered(inp.W, inp.D, bumped, pairs, c, shared, R);
          if (b.ok && (!res.ok || b.score < res.score - 1e-9)) res = b;
        }
        return res;
      }
      var res = pass(K()), retried = false;
      // Retry on failure only (A-8 step 8, F3-T2): the wider range 0.75-1.25 (F3-S1's 25 % rule); a success of the
      // first pass never reaches this line, so it is unchanged. The retried result must still pass check (below).
      if (!res.ok) { res = pass(K().retry); retried = true; }
      if (!res.ok) { out.ok = false; return out; }
      var rooms = res.rooms.map(function (r) { return { id: r.id, x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h) }; })
        .sort(function (a, b) { return cmp(a.id, b.id); });
      // one 0.5 m grid pass, kept only while the layout stays valid (A-8 step 7)
      // (and only when it does not lose a shared wall)
      function unmetOf(list) {
        var by = {}; list.forEach(function (r) { by[r.id] = r; });
        return pairs.filter(function (p) { return !adjacent(by[p[0]], by[p[1]]); });
      }
      var snapped = rooms.map(function (r) { var x = snap(r.x), y = snap(r.y); return { id: r.id, x: x, y: y, w: snap(r.x + r.w) - x, h: snap(r.y + r.h) - y }; });
      if (!PC.layout.check(inp.W, inp.D, out.core, inp.rooms, snapped).length && unmetOf(snapped).length <= unmetOf(rooms).length) rooms = snapped;
      if (retried && PC.layout.check(inp.W, inp.D, out.core, inp.rooms, rooms).length) { out.ok = false; return out; }
      out.ok = true; out.rooms = rooms; out.unmet = unmetOf(rooms);
      return out;
    }
  };
})(globalThis.PC = globalThis.PC || {});
