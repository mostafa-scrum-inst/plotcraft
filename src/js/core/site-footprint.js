/* PC.site.footprint: the building footprint (3.1, A-6 steps 1-7): one street-aligned rectangle, sized from the
   footprint %, proportioned like the buildable bounding box (2:1 at most), rounded down to 0.5 m, centred;
   shrunk about its centre when it does not fit. When the centre is no good, other centres on a 0.5 m lattice
   are searched, for three proportions (bounding-box ratio, 1:2, 2:1), and the largest result is kept. */
(function (PC) {
  'use strict';

  // Fills site.footprint (or leaves it null and sets site.noFit).
  PC.site.footprint = function (site, footprintPct) {
    var T = PC.site.T, f05 = PC.site.floor05, C = PC.C, m = site.mask;
    if (!site.buildable.ok) return;                                      // conflict: buildable area under 20 m2
    var bb = site.buildable.bbox, A = footprintPct / 100 * site.plotArea, cap = C.FOOTPRINT_MAX_RATIO;
    var Wb = bb.u1 - bb.u0, Db = bb.v1 - bb.v0, c = [(bb.u0 + bb.u1) / 2, (bb.v0 + bb.v1) / 2];
    var rb = Db > 0 ? Math.max(1 / cap, Math.min(cap, Wb / Db)) : cap;
    var cand = null;                                                     // fallback centres, built once when needed
    // A-6 step 8 (corrected, CTO F2 review): the longest side allowed after rounding.
    function longCap(short, stretched) {
      return stretched ? f05(C.FOOTPRINT_STRETCH_RATIO * short + C.FOOTPRINT_STRETCH_EXTRA) : f05(cap * (short + T.round));
    }

    function candidates() {
      var step = Math.round(T.centres / T.lattice), out = [], i, j, u, v;
      for (j = 0; j < m.nv; j++) for (i = 0; i < m.nu; i++) {
        if (!m.bits[j * m.nu + i] || (m.i0 + i) % step !== 0 || (m.j0 + j) % step !== 0) continue;
        u = (m.i0 + i) * T.lattice; v = (m.j0 + j) * T.lattice;
        out.push([u, v, (u - c[0]) * (u - c[0]) + (v - c[1]) * (v - c[1])]);
      }
      return out.sort(function (a, b) { return a[2] - b[2] || a[1] - b[1] || a[0] - b[0]; });   // nearest first; ties: lower v, lower u
    }

    // Best placement for the proportion r = width : depth. search = also try the fallback centres.
    // beat (step 4b): only a result whose unrounded area strictly exceeds this can win, so the search starts its
    // running best there and returns area 0 ("no improvement") when nothing beats it (A-6 pruning; same results).
    function place(r, search, beat) {
      var w0 = Math.max(T.round, f05(Math.sqrt(A * r))), d0 = Math.max(T.round, f05(Math.sqrt(A / r)));
      function at(ctr, t) { return PC.site.rectFits(site, { u: ctr[0] - w0 * t / 2, v: ctr[1] - d0 * t / 2, w: w0 * t, d: d0 * t }); }
      // Largest t in [lo, 1] that fits, knowing lo fits (nested rectangles: the test is monotonic).
      function grow(ctr, lo) {
        if (at(ctr, 1)) return 1;
        var hi = 1, i, mid;
        for (i = 0; i < T.bisect; i++) { mid = (lo + hi) / 2; if (at(ctr, mid)) lo = mid; else hi = mid; }
        return lo;
      }
      var prune = beat !== undefined && !T.noPrune, t0 = 0, best, found = true;
      if (prune) {
        if (w0 * d0 <= beat + T.eps) return { enough: false, area: 0 };
        t0 = Math.sqrt(beat / (w0 * d0));
        var p0 = Math.min(1, t0 + T.fit);
        found = at(c, p0);
        best = found ? grow(c, p0) : t0;
      } else best = at(c, 1) ? 1 : (PC.site.isBuildable(site, c) ? grow(c, 0) : 0);
      var centre = c, moved = false, i;
      var enough = best >= 1 || best * best * w0 * d0 >= A / 2;          // centred result keeps at least half the target
      if (search) {
        cand = cand || candidates();
        for (i = 0; i < cand.length && best < 1; i++) {
          var probe = Math.min(1, best + T.fit);
          // Cheap necessary test first: lattice nodes inside the probe rectangle (towards its corners and edge
          // middles) must be buildable. Most candidates stop here.
          var ci = Math.round(cand[i][0] / T.lattice), cj = Math.round(cand[i][1] / T.lattice);
          var hi2 = Math.floor(w0 * probe / 2 / T.lattice + T.eps), hj = Math.floor(d0 * probe / 2 / T.lattice + T.eps);
          if (!(m.has(ci - hi2, cj - hj) && m.has(ci + hi2, cj - hj) && m.has(ci - hi2, cj + hj) && m.has(ci + hi2, cj + hj) &&
                m.has(ci, cj - hj) && m.has(ci, cj + hj) && m.has(ci - hi2, cj) && m.has(ci + hi2, cj))) continue;
          if (!at(cand[i], probe)) continue;
          best = grow(cand[i], probe); centre = [cand[i][0], cand[i][1]]; moved = true; found = true;   // strict improvement only
        }
      }
      if (best <= 0 || !found) return { enough: false, area: 0 };
      var w = w0, d = d0;
      if (best < 1) {
        // Round the shrunken size down to 0.5 m. The bisection stops a hair below the true limit, so a limit that
        // lies exactly on the 0.5 m grid is tried first and kept when the exact test accepts it.
        w = f05(w0 * best + 1e-3); d = f05(d0 * best + 1e-3);
        if (!PC.site.rectFits(site, { u: centre[0] - w / 2, v: centre[1] - d / 2, w: w, d: d })) { w = f05(w0 * best); d = f05(d0 * best); }
      }
      // A-6 step 8: after rounding, the long side is capped about the same centre (nested: it still fits, area only
      // goes down): 2 x (short + 0.5 m) for the step-4 proportions, 3 x short + 0.5 m for the 4b tries.
      var top = longCap(Math.min(w, d), r > cap || r < 1 / cap);
      if (w > d && w > top + T.eps) w = top; else if (d > w && d > top + T.eps) d = top;
      return { enough: enough, area: w * d, u: centre[0] - w / 2, v: centre[1] - d / 2, w: w, d: d, clamped: best < 1, moved: moved };
    }

    var res = place(rb, false);                                          // the centred try always comes first
    if (!res.enough || res.area < C.BUILDABLE_MIN - T.eps) {
      // Fallback (CTO decisions, step 1 round 2 and 2026-11-20): search other centres for the bounding-box ratio,
      // then 1:2, then 2:1; the largest final area wins, ties go to the earlier one. Also when the centred result
      // keeps half the target but rounds under 20 m2 (A-6 step 4; F2-T1 QA bug 1), so no-fit means nothing fits.
      res = { area: 0 };
      [rb, 1 / cap, cap].forEach(function (r) { var x = place(r, true); if (x.area > res.area + T.eps) res = x; });
    }
    if (res.clamped) res = narrow(res);                                  // step 4b (CD-1)
    if (res.area < C.BUILDABLE_MIN - T.eps) { site.noFit = true; return; }   // conflict: the building does not fit this plot
    site.footprint = { u: res.u, v: res.v, w: res.w, d: res.d, area: res.area, pct: res.area / site.plotArea * 100,
      clamped: res.clamped, moved: res.moved };
    if (res.clamped) site.footprint.reason = res.reason;

    // Step 4b (A-6, round 4): a clamped footprint may stretch to 3:1. Candidates: the step-4 result r4, its stretch,
    // the 3:1 and the 1:3 searches; the largest area wins, ties keep the earlier one. Then `clamped` is decided
    // anew (rounding alone is not a clamp) and `reason` says what stops the building.
    function narrow(r4) {
      var S = C.FOOTPRINT_STRETCH_RATIO, win = r4;
      var alongU = r4.w >= r4.d, lng = alongU ? r4.w : r4.d, sht = alongU ? r4.d : r4.w, cu = r4.u + r4.w / 2, cv = r4.v + r4.d / 2;
      function rect(l) { var w = alongU ? l : sht, d = alongU ? sht : l; return { u: cu - w / 2, v: cv - d / 2, w: w, d: d }; }
      if (sht > 0 && lng >= cap * sht - T.round - T.eps) {               // (a) stretch, at the 2:1 limit only
        var top = Math.min(f05(Math.min(S * sht, A / sht)), longCap(sht, true)), l = lng;
        while (l + T.round <= top + T.eps && PC.site.rectFits(site, rect(l + T.round))) l += T.round;
        if (l > lng + T.eps) {
          var x = rect(l);
          if (x.w * x.d > win.area + T.eps) win = { area: x.w * x.d, u: x.u, v: x.v, w: x.w, d: x.d, moved: r4.moved };
        }
      }
      [S, 1 / S].forEach(function (r) {                                  // (b) 3:1, then 1:3, each by steps 3-4:
        var y = place(r, false);                                         // the centred try; the fallback search only
        if (!y.enough || y.area < C.BUILDABLE_MIN - T.eps) y = place(r, true, win.area);   // when it is not enough
        if (y.area > win.area + T.eps) win = y;
      });
      var L = Math.max(win.w, win.d), Sh = Math.min(win.w, win.d);
      var out = { area: win.area, u: win.u, v: win.v, w: win.w, d: win.d, moved: win.moved,
        clamped: Math.abs(L - f05(A / Sh)) > T.eps };
      if (out.clamped) {
        var longer = win.w >= win.d ? { u: win.u - T.round / 2, v: win.v, w: win.w + T.round, d: win.d }
          : { u: win.u, v: win.v - T.round / 2, w: win.w, d: win.d + T.round };
        out.reason = L >= S * Sh - T.round - T.eps && PC.site.rectFits(site, longer) ? 'proportion' : 'setbacks';
      }
      return out;
    }
  };
})(globalThis.PC = globalThis.PC || {});
