/* PC.tourplan: the F5-T2 drone tour plan (A-14 as built; F5-T2 plan + plan review). Pure, frame T, seconds.
   build(house, aspect) -> { stops: [{ kind: 'overview' | 'room', id, level, eye, look, t }], duration, eyeFloor } | null
   - Stops: the overview (the Reset pose for the canvas aspect), then each level from the lowest, every room once in
     nearest-neighbour order (XZ distance from the previous stop's look point to the room centre: after an overview
     its look point, the Reset target = the plot centre; ties by plan order), then the overview again.
   - Room eye: 0.6 x max(w, d) + 2 m from the room centre away from the footprint centre (street side, +Z, when the
     room is central), at max(baseY, 0) + storeyH + 2.5; a basement room: 1.5 m towards the footprint centre at
     storeyH + 2.5 (F5-T3a pacing: TOUR.bEyeUp). Look: the room centre at floorY + 0.5 (as the finder).
   - Eye floor: (canopyY0 + canopyH) x scale max of PC.data.vegetation + TOUR.treeGap: every eye is at it or above.
   - Nudge: a point closer than 0.5 m to the one before is moved 0.5 m away along the leg (+X when they coincide).
   - Times: rooms + 1 legs; the two overview legs 4.5 s (F5-T3a pacing), room-to-room legs 3.5 s (normal speed; TL ruling Q2). */
(function (PC) {
  'use strict';
  function K() { return PC.C.TOUR; }
  function dist(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2])); }
  function nudge(list, gap) {
    for (var i = 1; i < list.length; i++) {
      var a = list[i - 1], b = list[i], d = dist(a, b);
      if (d >= gap) continue;
      var u = d > 1e-9 ? [(b[0] - a[0]) / d, (b[1] - a[1]) / d, (b[2] - a[2]) / d] : [1, 0, 0];
      list[i] = [a[0] + u[0] * gap, a[1] + u[1] * gap, a[2] + u[2] * gap];
    }
  }

  var T = PC.tourplan = {
    eyeFloor: function () {
      var v = PC.data.vegetation;
      return (v.tree.canopyY0 + v.tree.canopyH) * v.scale[1] + K().treeGap;
    },
    // Eye and look of one room stop (exported for tests).
    roomStop: function (house, lv, r) {
      var k = K(), fp = house.footprint, cu = house.center[0], cv = house.center[1];
      var c = [r.u + r.w / 2 - cu, -(r.v + r.d / 2 - cv)], f = [fp.u + fp.w / 2 - cu, -(fp.v + fp.d / 2 - cv)];
      var dx = c[0] - f[0], dz = c[1] - f[1], l = Math.sqrt(dx * dx + dz * dz), dir = l < k.centralEps ? [0, 1] : [dx / l, dz / l];
      var floor = T.eyeFloor(), eye;
      if (lv.index < 0) eye = [c[0] - dir[0] * k.bEyeIn, house.storeyH + k.bEyeUp, c[1] - dir[1] * k.bEyeIn];
      else {
        var out = k.eyeOutK * Math.max(r.w, r.d) + k.eyeOut;
        eye = [c[0] + dir[0] * out, Math.max(lv.baseY, 0) + house.storeyH + k.eyeUp, c[1] + dir[1] * out];
      }
      eye[1] = Math.max(eye[1], floor);
      return { eye: eye, look: [c[0], lv.baseY + PC.C.HOUSE.slab + PC.C.CAM.finderLift, c[1]] };
    },
    build: function (house, aspect) {
      var k = K(), reset = PC.cam.reset(house, aspect), ovEye = PC.cam.position(reset), floor = T.eyeFloor();
      ovEye[1] = Math.max(ovEye[1], floor);
      var stops = [{ kind: 'overview', id: null, level: 'all', eye: ovEye, look: reset.target.slice() }], prev = reset.target;
      house.levels.slice().sort(function (a, b) { return a.index - b.index; }).forEach(function (lv) {
        var left = lv.rooms.slice();
        while (left.length) {
          var best = 0, bd = Infinity;
          for (var i = 0; i < left.length; i++) {
            var r = left[i], x = r.u + r.w / 2 - house.center[0] - prev[0], z = -(r.v + r.d / 2 - house.center[1]) - prev[2], d = x * x + z * z;
            if (d < bd - 1e-9) { bd = d; best = i; }
          }
          var room = left.splice(best, 1)[0], s = T.roomStop(house, lv, room);
          stops.push({ kind: 'room', id: room.id, level: lv.id, eye: s.eye, look: s.look });
          prev = s.look;
        }
      });
      if (stops.length < 2) return null;
      stops.push({ kind: 'overview', id: null, level: 'all', eye: ovEye.slice(), look: reset.target.slice() });
      var eyes = stops.map(function (s) { return s.eye; }), looks = stops.map(function (s) { return s.look; });
      nudge(eyes, k.minGap); nudge(looks, k.minGap);
      var t = 0;
      stops.forEach(function (s, i) {
        s.eye = eyes[i]; s.look = looks[i];
        if (i) t += (i === 1 || i === stops.length - 1) ? k.overviewLeg : k.roomLeg;
        s.t = t;
      });
      return { stops: stops, duration: t, eyeFloor: floor };
    },
    // The stop index the camera is flying towards at tour time tau (the last stop at the end).
    target: function (plan, tau) {
      var s = plan.stops;
      for (var i = 1; i < s.length; i++) if (tau < s[i].t) return i;
      return s.length - 1;
    },
    // The curve parameter (CatmullRomCurve3.getPoint, uniform per segment) at tour time tau: stop i at i / (n - 1);
    // linear inside each leg except the first (eases in from rest) and the last (eases out to rest).
    u: function (plan, tau) {
      var s = plan.stops, n = s.length, i = Math.min(T.target(plan, tau), n - 1) - 1;
      if (tau >= plan.duration) return 1;
      if (tau <= 0) return 0;
      var x = (tau - s[i].t) / (s[i + 1].t - s[i].t);
      // the first leg starts and the last leg ends at rest (no start jerk, no dead stop at the final overview): a
      // cubic time warp with slope 0 at the tour's ends and slope 1 where it meets the next / previous leg
      if (i === 0 && n > 2) x = 2 * x * x - x * x * x;
      else if (i === n - 2 && n > 2) x = x + x * x - x * x * x;
      else if (n === 2) x = x * x * (3 - 2 * x);
      return (i + x) / (n - 1);
    }
  };
})(globalThis.PC = globalThis.PC || {});
