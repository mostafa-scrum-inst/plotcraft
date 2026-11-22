/* PC.three.tour: the F5-T2 drone tour runtime (F5-S2; A-14 as built; F5-T2 plan + plan review). The second client of
   the F5-T1 animation driver (PC.view3d.animate): one animation, cancelled by the same paths (an input before its
   delta, close, Reset, a rebuild, a finder pick = 'replaced').
   - Plan: PC.tourplan.build(house, aspect) at Start. Curves: two THREE.CatmullRomCurve3(points, false, 'catmullrom')
     (eyes, looks), read with getPoint(u): u is linear in the tour time between stops (PC.tourplan.u), so stop i is
     reached exactly at its time (TL ruling Q1).
   - Tour time tau (s) advances by dt x the speed factor (slow 0.6, normal 1, fast 1.8); a speed change acts on the
     next frame with no jump. Every frame: eye Y kept above the eye floor (tree tops + 0.5 m) by a soft floor (no
     kink in the speed; within TOUR.floorSoft of the floor the eye is lifted smoothly), then
     pose = PC.cam.clamp(PC.cam.fromEyeLook(eye, look), limits). The clamp does not bite at the stops (unit-tested).
   - Lead-in: when the camera is not at the overview (more than TOUR.leadInSkip m from it), a TOUR.leadInMs smoothstep
     flight to the overview pose comes first, so Start never cuts; tau starts after it.
   - From the start of each leg, the stop being approached sets the level (a room's level; All at an overview), the
     highlight (the room; none at an overview) and calls o.onStop(stop) for the caption (TL ruling Q3). Roof off at
     Start. The tour never calls setLook.
   - Pause: the driver requests no frames; Resume continues with dt 0. End: o.onEnd(reason) exactly once; the highlight
     is cleared unless a finder pick replaced the tour (its own highlight) or the scene already cleared it.
   - debugSeek(tau): test-only (PC.debug.tourSeek, TL ruling Q8); changes tau only. THREE only inside functions. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};
  var T = null, speed = 'normal';

  function v3(a) { return new THREE.Vector3(a[0], a[1], a[2]); }
  function arr(v) { return [v.x, v.y, v.z]; }
  function factor() { return PC.C.TOUR.speeds[speed] || 1; }

  function applyStop(i) {
    if (!T || T.cur === i) return;
    T.cur = i;
    var st = T.plan.stops[i], V = PC.view3d;
    V.setLevel(st.level);
    if (st.kind === 'room') V.select(st.id); else if (V.selected() !== null) V.select(null);
    if (T.o.onStop) T.o.onStop(st, i);
  }
  // The stops' orbit poses as (theta unwrapped along the tour, phi, radius) points: the camera path is interpolated in
  // pose space around the look curve, so it never swings through the vertical over a look point (the eye/look pair of
  // curves did, after the steep overview leg into the basement) and matches each stop exactly.
  function spherical(plan) {
    var out = [], th = 0;
    plan.stops.forEach(function (s, i) {
      var p = PC.cam.fromEyeLook(s.eye, s.look);
      if (i) { var d = (p.theta - th) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; th += d; } else th = p.theta;
      out.push(new THREE.Vector3(th, p.phi, p.radius));
    });
    return out;
  }
  // A soft floor: x above lo + m unchanged; below, lo + m e^((x - lo) / m - 1), always above lo, with the slope
  // matching at lo + m, so the path has no kink where it would touch a limit.
  function soft(x, lo, m) { return x < lo + m ? lo + m * Math.exp((x - lo) / m - 1) : x; }
  function poseAt(tau) {
    var u = PC.tourplan.u(T.plan, tau), l = arr(T.looks.getPoint(u)), q = T.sph.getPoint(u), K = PC.C.TOUR;
    var L = PC.view3d.limits(), p = { target: l, theta: q.x, phi: q.y, radius: q.z };
    // orbit radius (rMin) and phi near the vertical (phiMin; a basement stop's overhead eye passing over its look
    // point swings round the axis smoothly), softly, so the hard clamp below does not kink the path
    p.radius = soft(p.radius, L.rMin, K.floorSoft);
    p.phi = soft(p.phi, L.phiMin, K.phiSoft * Math.PI / 180);
    // then the eye floor over the tree tops, softly too, by moving the eye out along its own line of sight (a longer
    // radius, the same theta and phi), so the limits above stay met and the clamp below never bites
    var c = Math.cos(p.phi), y = l[1] + p.radius * c, y2 = soft(y, T.plan.eyeFloor, K.floorSoft);
    if (y2 !== y && c > 1e-6) p.radius = (y2 - l[1]) / c;
    return PC.cam.clamp(p, L);
  }

  three.tour = {
    // o: { onStop(stop, index), onEnd(reason) }. Returns false when there is nothing to tour.
    start: function (o) {
      var V = PC.view3d, h = V.house(), inf = V.info();
      if (!h || !V.pose()) return false;
      var plan = PC.tourplan.build(h, inf.aspect || 1);   // the visible aspect (F5-T3a lens shift)
      if (!plan) return false;
      if (V.selected() !== null) V.select(null);
      V.setRoof(false);
      var t = T = { plan: plan, o: o || {}, tau: 0, cur: -1, lead: null, ended: false,
        sph: new THREE.CatmullRomCurve3(spherical(plan), false, 'catmullrom'),
        looks: new THREE.CatmullRomCurve3(plan.stops.map(function (s) { return v3(s.look); }), false, 'catmullrom') };
      var ov = poseAt(0), now = V.pose(), e0 = PC.cam.position(now), e1 = PC.cam.position(ov);
      var off = Math.max(Math.hypot(e0[0] - e1[0], e0[1] - e1[1], e0[2] - e1[2]), Math.hypot(now.target[0] - ov.target[0], now.target[1] - ov.target[1], now.target[2] - ov.target[2]));
      if (off > PC.C.TOUR.leadInSkip) t.lead = { from: now, to: ov, ms: PC.C.TOUR.leadInMs, t: 0 };
      var anim = {
        kind: 'tour', paused: false,
        step: function (dt) {
          if (t.lead) {
            t.lead.t += dt;
            var k = Math.min(1, t.lead.t / t.lead.ms), p = PC.cam.clamp(PC.cam.lerpPose(t.lead.from, t.lead.to, k), V.limits());
            if (k >= 1) t.lead = null;
            return { pose: p, done: false };
          }
          t.tau = Math.min(plan.duration, t.tau + dt / 1000 * factor());
          applyStop(PC.tourplan.target(plan, t.tau));
          return { pose: poseAt(t.tau), done: t.tau >= plan.duration };
        },
        end: function (reason) {
          if (t.ended) return;
          t.ended = true;
          if (T === t) T = null;
          if (reason !== 'replaced' && reason !== 'build' && reason !== 'close' && PC.view3d.selected() !== null) PC.view3d.select(null);
          if (t.o.onEnd) t.o.onEnd(reason);
        }
      };
      t.anim = anim;
      V.animate(anim);
      applyStop(t.lead ? 0 : 1);                 // the lead-in approaches the overview, the first leg the first room
      return true;
    },
    pause: function () { if (T) PC.view3d.pauseAnimation(true); },
    resume: function () { if (T) PC.view3d.pauseAnimation(false); },
    stop: function () { if (T) PC.view3d.stopAnimation(); },
    setSpeed: function (name) { if (PC.C.TOUR.speeds[name]) speed = name; },
    speed: function () { return speed; },
    running: function () { return !!T; },
    state: function () {
      return T ? { running: true, paused: !!T.anim.paused, speed: speed, tau: T.tau, duration: T.plan.duration, stop: T.cur, lead: !!T.lead, plan: T.plan }
        : { running: false, paused: false, speed: speed };
    },
    // Test-only (TL ruling Q8): sets the tour time; the next frame shows it (stops follow as in a normal run).
    debugSeek: function (tau) { if (!T) return false; T.lead = null; T.tau = Math.max(0, Math.min(T.plan.duration, tau)); PC.view3d.invalidate(); return true; }
  };
})(globalThis.PC = globalThis.PC || {});
