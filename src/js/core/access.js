/* PC.layout.access (CD-5, PM round 10): which rooms of a drawn plan have no way in from the hall or the stairs.
   Pure, frame P. Moved out of layout.js (TL F4-T2 Step 0 review, note 3); the name stays PC.layout.access. */
(function (PC) {
  'use strict';
  // CD-5 (PM round 10): ids of the rooms with no way in from the hall or the stair / lift, in room order. Frame P.
  // A side counts when it is not on the footprint outline; what of it no other room or the core touches (within
  // adjTol) faces hall. Access: >= HALL_ACCESS.min of hall, or of stair / lift contact. A room without it is reached
  // through an adjacent reached room that is its pair partner or listed in HALL_ACCESS.hosts for its type; the
  // rule runs to a fixed point, so chains count. Hall pockets that touch no stair count as hall (known limit).
  PC.layout.access = function access(W, D, rooms, c, pairs, types) {
    var e = PC.C.LAYOUT.adjTol, A = PC.C.HALL_ACCESS, blocks = [];
    rooms.forEach(function (r) { blocks.push({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, core: false }); });
    [c && c.stair, c && c.lift].forEach(function (b) { if (b) blocks.push({ id: '', x: b.x, y: b.y, w: b.w, h: b.h, core: true }); });
    // sides as [axis, at, from, to]: axis 'x' = a vertical side at x = at spanning y
    function sides(b) { return [['x', b.x, b.y, b.y + b.h], ['x', b.x + b.w, b.y, b.y + b.h], ['y', b.y, b.x, b.x + b.w], ['y', b.y + b.h, b.x, b.x + b.w]]; }
    var reached = {};
    rooms.forEach(function (r) {
      var hall = 0, touch = 0;
      sides(r).forEach(function (s) {
        var edge = s[0] === 'x' ? W : D;
        if (Math.abs(s[1]) < e || Math.abs(s[1] - edge) < e) return;            // exterior wall
        var free = [[s[2], s[3]]];
        blocks.forEach(function (b) {
          if (!b.core && b.id === r.id) return;
          sides(b).forEach(function (t) {
            if (t[0] !== s[0] || Math.abs(t[1] - s[1]) >= e) return;
            var lo = Math.max(s[2], t[2]), hi = Math.min(s[3], t[3]);
            if (hi - lo <= 1e-9) return;
            if (b.core) touch += hi - lo;
            free = free.reduce(function (out, f) {
              if (t[3] <= f[0] || t[2] >= f[1]) out.push(f);
              else { if (t[2] > f[0]) out.push([f[0], t[2]]); if (t[3] < f[1]) out.push([t[3], f[1]]); }
              return out;
            }, []);
          });
        });
        free.forEach(function (f) { hall += f[1] - f[0]; });
      });
      reached[r.id] = hall >= A.min - 1e-9 || touch >= A.min - 1e-9;
    });
    var paired = function (a, b) { return (pairs || []).some(function (p) { return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a); }); };
    for (var changed = true; changed;) {
      changed = false;
      rooms.forEach(function (r) {
        if (reached[r.id]) return;
        var hosts = A.hosts[types[r.id]] || [];
        if (rooms.some(function (n) { return n.id !== r.id && reached[n.id] && PC.layout.adjacent(r, n) && (paired(r.id, n.id) || hosts.indexOf(types[n.id]) >= 0); })) {
          reached[r.id] = true; changed = true;
        }
      });
    }
    return rooms.filter(function (r) { return !reached[r.id]; }).map(function (r) { return r.id; });
  };
})(globalThis.PC = globalThis.PC || {});
