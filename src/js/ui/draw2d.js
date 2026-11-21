/* PC.ui.draw2d: shared 2D drawing on a View2D (grid, outlines, handles, labels). Colours, line widths and
   fonts come from PC.data.palette2d and are CSS pixels. Nothing here knows about stages. */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};
  function pal() { return PC.data.palette2d; }
  function crisp(v) { return Math.round(v) + 0.5; }

  var D = ui.draw2d = {
    clear: function (view) {
      var g = view.ctx;
      g.fillStyle = pal().canvas; g.fillRect(0, 0, view.width, view.height);
    },

    // The square to draw: base, or base x 5, 10, 50, 100 so that one square is at least minPx (default 6) on screen.
    gridStep: function (scale, base, minPx) {
      var m = [1, 5, 10, 50, 100], i;
      for (i = 0; i < m.length; i++) if (base * m[i] * scale >= (minPx || 6)) return base * m[i];
      return base * 100;
    },

    // Grid lines every step metres, every fifth one major. clip: optional world box to stay inside.
    grid: function (view, step, clip) {
      var g = view.ctx, p = pal(), a = view.toWorld(0, view.height), b = view.toWorld(view.width, 0);
      var x0 = a[0], y0 = a[1], x1 = b[0], y1 = b[1];
      if (clip) { x0 = Math.max(x0, clip.x0); y0 = Math.max(y0, clip.y0); x1 = Math.min(x1, clip.x1); y1 = Math.min(y1, clip.y1); }
      if (x1 <= x0 || y1 <= y0) return;
      var top = view.toScreen([x0, y1]), bottom = view.toScreen([x1, y0]), i, s;
      g.lineWidth = p.line.grid;
      [false, true].forEach(function (major) {
        g.strokeStyle = major ? p.grid.major : p.grid.minor;
        g.beginPath();
        for (i = Math.ceil(x0 / step - 1e-9); i * step <= x1 + 1e-9; i++) {
          if ((i % 5 === 0) !== major) continue;
          s = crisp(view.toScreen([i * step, 0])[0]); g.moveTo(s, top[1]); g.lineTo(s, bottom[1]);
        }
        for (i = Math.ceil(y0 / step - 1e-9); i * step <= y1 + 1e-9; i++) {
          if ((i % 5 === 0) !== major) continue;
          s = crisp(view.toScreen([0, i * step])[1]); g.moveTo(top[0], s); g.lineTo(bottom[0], s);
        }
        g.stroke();
      });
    },

    // Outline of a world box.
    box: function (view, b, stroke, width, dash) {
      var g = view.ctx, a = view.toScreen([b.x0, b.y1]), c = view.toScreen([b.x1, b.y0]);
      g.strokeStyle = stroke; g.lineWidth = width || 1; g.setLineDash(dash || []);
      g.strokeRect(crisp(a[0]), crisp(a[1]), Math.round(c[0] - a[0]), Math.round(c[1] - a[1]));
      g.setLineDash([]);
    },

    // Polyline or polygon. o: { closed, fill, stroke, width, dash }.
    path: function (view, pts, o) {
      var g = view.ctx;
      if (pts.length < 2) return;
      g.beginPath();
      pts.forEach(function (p, i) { var s = view.toScreen(p); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); });
      if (o.closed) g.closePath();
      if (o.fill && o.closed) { g.fillStyle = o.fill; g.fill(); }
      g.strokeStyle = o.stroke; g.lineWidth = o.width || 1; g.lineJoin = 'round'; g.setLineDash(o.dash || []);
      g.stroke(); g.setLineDash([]);
    },

    // Round handles. strokeOf(i) may return a colour for one handle.
    handles: function (view, pts, o) {
      var g = view.ctx;
      pts.forEach(function (p, i) {
        var s = view.toScreen(p);
        g.beginPath(); g.arc(s[0], s[1], o.r || 6, 0, Math.PI * 2);
        g.fillStyle = o.fill; g.fill();
        g.lineWidth = 2; g.strokeStyle = (o.strokeOf && o.strokeOf(i)) || o.stroke; g.stroke();
      });
    },

    // Band along the inside of a polygon: for each edge i a strip dist[i] metres deep (0 = none), drawn as one
    // even tint (strips that overlap do not add up). o: { color, alpha }.
    setbackZone: function (view, pts, dist, o) {
      var n = pts.length, c = document.createElement('canvas'), g = c.getContext('2d'), i;
      c.width = Math.max(1, Math.round(view.width * view.dpr)); c.height = Math.max(1, Math.round(view.height * view.dpr));
      g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      g.beginPath();
      pts.forEach(function (p, k) { var s = view.toScreen(p); if (k) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); });
      g.closePath(); g.clip();
      g.strokeStyle = o.color; g.lineCap = 'round';
      for (i = 0; i < n; i++) {
        if (!(dist[i] > 0)) continue;
        var a = view.toScreen(pts[i]), b = view.toScreen(pts[(i + 1) % n]);
        g.lineWidth = 2 * dist[i] * view.scale;
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
      view.ctx.save(); view.ctx.globalAlpha = o.alpha; view.ctx.setTransform(1, 0, 0, 1, 0, 0);
      view.ctx.drawImage(c, 0, 0);
      view.ctx.restore();
    },

    // Rectangle a label would take when centred on a screen point.
    labelRect: function (view, text, sx, sy, o) {
      var g = view.ctx;
      g.font = (o && o.font) || pal().font.label;
      var w = g.measureText(text).width + 8, h = 18;
      return { x: sx - w / 2, y: sy - h / 2, w: w, h: h, text: text, cx: sx, cy: sy };
    },
    // Is the rectangle fully on the canvas and clear of the labels already placed and of o.avoid?
    labelFree: function (view, r, placed, o) {
      if (r.x < 2 || r.y < 2 || r.x + r.w > view.width - 2 || r.y + r.h > view.height - 2) return false;
      var hit = function (q) { return r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h; };
      return !((placed || []).some(hit) || ((o && o.avoid) || []).some(hit));
    },
    // Text centred on a screen point, with a halo. A label that would leave the canvas or overlap a placed one
    // (or a rectangle in o.avoid) is not drawn, unless o.force. Returns its rectangle { x, y, w, h, text } or null.
    label: function (view, text, sx, sy, placed, o) {
      var g = view.ctx, p = pal(), r = D.labelRect(view, text, sx, sy, o);
      if (!(o && o.force) && !D.labelFree(view, r, placed, o)) return null;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = 4; g.strokeStyle = p.label.halo; g.strokeText(text, sx, sy);
      g.fillStyle = (o && o.color) || p.label.text; g.fillText(text, sx, sy);
      if (placed) placed.push(r);
      return r;
    },

    // Filled, outlined world rectangle { x0, y0, x1, y1 }. o: { fill, stroke, width, dash }.
    rect: function (view, b, o) {
      D.path(view, [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], { closed: true, fill: o.fill, stroke: o.stroke || 'rgba(0,0,0,0)', width: o.width || 0, dash: o.dash });
    },
    // Lines of text centred in a world rectangle, as many as fit inside it (from the first); none when the first
    // does not fit. `lines` may also be a list of alternatives (arrays of lines, preferred first): the first
    // alternative whose first line fits is used. Returns the texts drawn. o: { font, color, placed }.
    boxLabel: function (view, b, lines, o) {
      var g = view.ctx, p = view.toScreen([b.x0, b.y1]), q = view.toScreen([b.x1, b.y0]), lh = 15, out = [];
      var x0 = Math.min(p[0], q[0]), x1 = Math.max(p[0], q[0]), y0 = Math.min(p[1], q[1]), y1 = Math.max(p[1], q[1]);
      g.font = (o && o.font) || pal().font.label;
      var fits = function (set) {
        return set.filter(function (t, i) {
          return set.slice(0, i + 1).every(function (u) { return g.measureText(u).width + 6 <= x1 - x0; }) && (i + 1) * lh + 4 <= y1 - y0;
        });
      };
      // o.smallFont: a second font tried for every alternative before giving up (first the normal font for all).
      var sets = Array.isArray(lines[0]) ? lines : [lines], fit = [], fonts = [(o && o.font) || pal().font.label].concat(o && o.smallFont ? [o.smallFont] : []);
      for (var fi = 0; fi < fonts.length && !fit.length; fi++) {
        g.font = fonts[fi];
        fit = fits(sets[0]);
      }
      if (!fit.length) { g.font = fonts[0]; for (var k = 1; k < sets.length && !fit.length; k++) fit = fits(sets[k]); }
      var cy = (y0 + y1) / 2 - (fit.length - 1) * lh / 2;
      fit.forEach(function (t, i) {
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = (o && o.color) || pal().label.text;
        g.fillText(t, (x0 + x1) / 2, cy + i * lh);
        var w = g.measureText(t).width + 4;
        out.push(t);
        if (o && o.placed) o.placed.push({ x: (x0 + x1) / 2 - w / 2, y: cy + i * lh - 9, w: w, h: 18, text: t });
      });
      return out;
    },

    // Whether every line of `lines` fits in a world rectangle as boxLabel would draw it (same measure). o: { font }.
    labelFits: function (view, b, lines, o) {
      var g = view.ctx, p = view.toScreen([b.x0, b.y1]), q = view.toScreen([b.x1, b.y0]), lh = 15;
      var w = Math.abs(q[0] - p[0]), h = Math.abs(q[1] - p[1]);
      g.font = (o && o.font) || pal().font.label;
      return lines.length * lh + 4 <= h && lines.every(function (t) { return g.measureText(t).width + 6 <= w; });
    },
    // A rounded bar centred on screen point (sx, sy), w x h CSS px. o: { fill, stroke, width }.
    pill: function (view, sx, sy, w, h, o) {
      var g = view.ctx, x = sx - w / 2, y = sy - h / 2, r = Math.min(w, h) / 2;
      g.beginPath();                                   // rounded rectangle, radius = half the short side
      g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r); g.lineTo(x + w, y + h - r);
      g.arcTo(x + w, y + h, x + w - r, y + h, r); g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
      g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
      if (o.fill) { g.fillStyle = o.fill; g.fill(); }
      if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.width || 1; g.setLineDash([]); g.stroke(); }
    },

    // The part of screen segment a-b inside the canvas (inset by m), or null. Liang-Barsky.
    clipToView: function (view, a, b, m) {
      var t0 = 0, t1 = 1, dx = b[0] - a[0], dy = b[1] - a[1];
      var P = [-dx, dx, -dy, dy], Q = [a[0] - m, view.width - m - a[0], a[1] - m, view.height - m - a[1]], i, t;
      for (i = 0; i < 4; i++) {
        if (Math.abs(P[i]) < 1e-12) { if (Q[i] < 0) return null; continue; }
        t = Q[i] / P[i];
        if (P[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
      }
      return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
    },

    // One length label per edge, longest edges first. Preferred place: beside the middle of the visible part of
    // the edge, on the right-hand side of the drawing direction (the outside of a counter-clockwise polygon).
    // When that spot is off the canvas or taken, the other side and positions along the edge are tried, so an
    // edge next to the canvas border is still labelled. Only an edge whose visible part is shorter than its
    // label gets none, and one whose fmt returns '' or null (labelled by the caller).
    edgeLabels: function (view, pts, closed, fmt, placed, o) {
      var g = view.ctx, n = pts.length, edges = [], i;
      for (i = 0; i < (closed ? n : n - 1); i++) edges.push([pts[i], pts[(i + 1) % n]]);
      g.font = pal().font.label;
      edges.map(function (e, k) { return { e: e, i: k, len: PC.geom.dist(e[0], e[1]) }; })
        .sort(function (a, b) { return b.len - a.len; })
        .forEach(function (x) {
          var text = fmt(x.len, x.i);                                       // fmt(length, edge index)
          if (text === null || text === undefined || text === '') return;
          var tw = g.measureText(text).width;
          var vis = D.clipToView(view, view.toScreen(x.e[0]), view.toScreen(x.e[1]), 2);
          if (!vis) return;
          var a = vis[0], b = vis[1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy);
          if (l < tw + 20) return;
          var off = 13 + Math.abs(dy / l) * (tw / 2 - 4);                       // clear the line for steep edges
          var along = [0.5, 0.35, 0.65, 0.22, 0.78], sides = [1, -1], k, s2, r;
          for (k = 0; k < along.length; k++) for (s2 = 0; s2 < 2; s2++) {
            var t = along[k], q = sides[s2] * off;
            var sx = a[0] + dx * t - dy / l * q, sy = a[1] + dy * t + dx / l * q;
            r = D.labelRect(view, text, sx, sy, o);
            if (D.labelFree(view, r, placed, o)) { D.label(view, text, sx, sy, placed, o); return; }
          }
        });
    }
  };
})(globalThis.PC = globalThis.PC || {});
