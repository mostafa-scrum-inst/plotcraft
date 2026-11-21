/* PC.furnish.room(room, table, density): the Designer's furniture pieces of one room (A-11 placement rule), pure.
   room: { x, y, w, h } in frame P (front = low y, back = high y, left = low x seen from the street); table:
   PC.data.furniture[type]; density 'full' | 'sparse' (only `sparse: true` pieces, same order).
   -> [{ kind, x, y, w, d, h, y0, color }] in frame P: x, y = the piece's low corner, w along x, d along y (the
   footprint as placed, scale included), color = the PC.data.interiors key (the house model resolves the hex).
   Rule: inner rectangle = room inset by C.FURNISH.inset; orientation (back / front / corners: w along x; left /
   right: w along y; center: w along the longer side, x on ties); flush with the anchor walls (centred along an edge
   wall), then the offset (center pieces: along their own w / d axes, turning with them); scale 1.00 -> 0.60 (size
   and offset; h and y0 never): the first scale inside (1e-9) and overlapping no placed piece by more than the
   overlap tolerance on both axes (1e-9 slack: exactly 0.01 m is allowed) wins; none -> the piece is dropped. */
(function (PC) {
  'use strict';
  var E = 1e-9;

  // The piece at scale s in a W x D room (room-local): { l, r, f, b } (left, right, front, back edges).
  function pose(p, s, W, D) {
    var F = PC.C.FURNISH, x0 = F.inset, x1 = W - F.inset, y0 = F.inset, y1 = D - F.inset, fx, fy, alongX = true;
    if (p.anchor === 'left' || p.anchor === 'right') { fx = p.d * s; fy = p.w * s; }
    else if (p.anchor === 'center') { alongX = W >= D; fx = (alongX ? p.w : p.d) * s; fy = (alongX ? p.d : p.w) * s; }
    else { fx = p.w * s; fy = p.d * s; }
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = p.anchor;
    if (k === 'back' || k === 'bl' || k === 'br') cy = y1 - fy / 2;
    if (k === 'front' || k === 'fl' || k === 'fr') cy = y0 + fy / 2;
    if (k === 'left' || k === 'bl' || k === 'fl') cx = x0 + fx / 2;
    if (k === 'right' || k === 'br' || k === 'fr') cx = x1 - fx / 2;
    var a = p.off ? p.off[0] : 0, b = p.off ? p.off[1] : 0;
    if (k === 'center' && !alongX) { cy += a * s; cx -= b * s; } else { cx += a * s; cy += b * s; }
    return { l: cx - fx / 2, r: cx + fx / 2, f: cy - fy / 2, b: cy + fy / 2 };
  }
  function inside(q, W, D) {
    var i = PC.C.FURNISH.inset;
    return q.l >= i - E && q.r <= W - i + E && q.f >= i - E && q.b <= D - i + E;
  }
  function clash(q, o) {
    var t = PC.C.FURNISH.overlap + E;
    return Math.min(q.r, o.r) - Math.max(q.l, o.l) > t && Math.min(q.b, o.b) - Math.max(q.f, o.f) > t;
  }

  PC.furnish = {
    pose: pose,
    room: function (room, table, density) {
      var W = room.w, D = room.h, placed = [], out = [];
      (table || []).forEach(function (p) {
        if (density === 'sparse' && !p.sparse) return;
        var S = PC.C.FURNISH.scales;
        for (var i = 0; i < S.length; i++) {
          var q = pose(p, S[i], W, D);
          if (!inside(q, W, D) || placed.some(function (o) { return clash(q, o); })) continue;
          placed.push(q);
          out.push({ kind: p.id, x: room.x + q.l, y: room.y + q.f, w: q.r - q.l, d: q.b - q.f, h: p.h, y0: p.y0, color: p.color });
          return;
        }
      });
      return out;
    }
  };
})(globalThis.PC = globalThis.PC || {});
