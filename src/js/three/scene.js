/* PC.view3d: renderer, on-demand loop, resize, visibility, context loss, lights, open / close (A-10, F4-T1 plan §4).
   THREE only inside functions: the file loads without it, and PC.view3d.open() then reports 'unavailable'.
   Loop (TL ruling 2): invalidate() requests ONE frame, only while open, visible, not lost, not building and none
   pending; an idle view requests no frames. Building... yields one painted frame first: rAF -> setTimeout 0 -> build
   (TL required item 3), guarded by a token so PC.view3d.close() during the yield builds nothing.
   Lights: one hemisphere + one sun (the only shadow caster). The look (F4-T3, A-13) is the session's { hour, season }
   (12:00 summer on a page load): setLook stores it and applies PC.sky.compute through PC.three.applyLook (look.js),
   which recolours and moves lights only; every build (rebuild, context restore) re-applies the stored look.
   Animation driver (F5-T1, A-12 as built; the F5-T2 tour is its second client): animate({ step(dt) -> done }) runs
   one animation; while it runs each frame calls step with the real rAF delta (ms, capped at CAM.dtMax = 100; 0 on
   its first frame) and requests the next frame; when it is done the loop is idle again. flyTo(pose, ms) is one
   client: from = the current pose (during a flight, the interpolated one: the smooth redirect), to = the clamped
   pose, smoothstep through PC.cam.lerpPose, clamped every frame, exactly `to` at the end. An input cancels it BEFORE
   the controls apply their delta (controls api.interrupt, plan review item 2); close(), resetView() and a build
   (rebuild, context restore) cancel it too. Flights never touch the session look.
   F5-T2 (plan review Q6): step(dt) returns { pose, done } and the driver assigns the pose; end(reason) is called
   exactly once with done | input | close | reset | build | replaced | stop; while anim.paused no frames are requested
   and the first frame after pauseAnimation(false) has dt 0. The tour (three/tour.js) is the second client.
   Selection (A-14): select(roomId | null) puts the one `highlight` mesh (PC.three.highlight, finder.js) on the room,
   disposing the previous geometry; a build and close() clear it and call the onSelect hook with null. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};
  var S = {
    renderer: null, scene: null, camera: null, world: null, hemi: null, sun: null, mats: null, canvas: null,
    house: null, builtKey: null, pose: null, limits: null, size: [0, 0], occl: { right: 0, bottom: 0 }, view: null,
    active: false, lost: false, dirty: false, frame: 0, building: 0, token: 0, onState: null,
    meshes: [], level: 'all', roof: false, renders: 0, builds: 0, restores: 0, looks: 0,
    look: { hour: 12, season: 'summer' },
    anim: null, animT: null, highlight: null, selected: null, onSelect: null, hlMade: 0
  };
  function V() { return PC.C.VIEW3D; }
  function dpr() { var d = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1; return Math.min(d, V().maxDpr); }
  function visible() { return typeof document === 'undefined' || document.visibilityState !== 'hidden'; }

  three.makeRenderer = function (canvas) {
    var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    r.setPixelRatio(dpr());
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputEncoding = THREE.sRGBEncoding;
    return r;
  };

  function cancelFrame() { if (S.frame) { cancelAnimationFrame(S.frame); S.frame = 0; } }
  function request() {
    if (!S.active || S.lost || S.building || S.frame || !S.house || !visible()) return;
    S.frame = requestAnimationFrame(frame);
  }
  function invalidate() { S.dirty = true; request(); }
  // The frame measures the canvas itself (QA F4T1-1): the shell may still be settling its layout when
  // PC.view3d.open() runs (e.g. stage 4's sample strip), so the size is taken when the frame draws.
  function frame(ts) {
    S.frame = 0;
    if (!S.active || S.lost || !visible()) return;
    if (S.anim && !S.anim.paused) {
      var now = typeof ts === 'number' ? ts : 0, dt = S.animT === null ? 0 : Math.min(PC.C.CAM.dtMax, Math.max(0, now - S.animT));
      S.animT = now;
      var r = S.anim.step(dt);
      if (r && r.pose) S.pose = r.pose;
      if (r && r.done) stopAnim('done');
      S.dirty = true;
    }
    if (!S.dirty) return;
    resize(true); S.dirty = false; render();
    if (S.anim && !S.anim.paused) { S.dirty = true; request(); }
  }
  function animate(a) { if (S.anim) stopAnim('replaced'); S.anim = a; S.animT = null; invalidate(); }
  // Ends the running animation (if any) and calls its end(reason) exactly once (F5-T2 plan review Q6).
  function stopAnim(reason) {
    var a = S.anim;
    S.anim = null; S.animT = null;
    if (a && typeof a.end === 'function') a.end(reason || 'stop');
  }
  function pauseAnim(on) {
    if (!S.anim) return;
    S.anim.paused = !!on;
    if (!on) { S.animT = null; invalidate(); }
  }
  function flyTo(pose, ms) {
    if (!S.house || !S.pose || !S.limits || !pose) return false;
    var f = { kind: 'flight', from: PC.cam.copy(S.pose), to: PC.cam.clamp(pose, S.limits), ms: ms > 0 ? ms : PC.C.CAM.flightMs, t: 0 };
    f.step = function (dt) {
      f.t += dt;
      var k = Math.min(1, f.t / f.ms);
      return { pose: k >= 1 ? PC.cam.copy(f.to) : PC.cam.clamp(PC.cam.lerpPose(f.from, f.to, k), S.limits), done: k >= 1 };
    };
    animate(f);
    return true;
  }
  function clearSelection() {
    var had = S.selected !== null;
    if (S.highlight) { if (S.highlight.parent) S.highlight.parent.remove(S.highlight); S.highlight.geometry.dispose(); S.highlight = null; }
    S.selected = null;
    if (had && S.onSelect) S.onSelect(null);
  }
  function select(id) {
    if (id === null || id === undefined || !S.house || !PC.cam.roomOf(S.house, id)) { clearSelection(); invalidate(); return false; }
    if (S.highlight) { S.world.remove(S.highlight); S.highlight.geometry.dispose(); S.highlight = null; }
    S.highlight = three.highlight(S.house, id, S.mats.batch);
    S.world.add(S.highlight);
    S.selected = id; S.hlMade++;
    invalidate();
    return true;
  }
  function render() {
    var p = S.pose, e = PC.cam.position(p), cam = S.camera, n = PC.cam.near(p);
    cam.position.set(e[0], e[1], e[2]);
    cam.lookAt(p.target[0], p.target[1], p.target[2]);
    if (cam.near !== n) { cam.near = n; cam.updateProjectionMatrix(); }
    S.renderer.render(S.scene, cam);
    S.renders++;
  }
  // The radius fits use the aspect of the canvas part the panel leaves uncovered (F5-T3a, TL ruling 2).
  function aspect() { return S.size[0] && S.size[1] ? PC.cam.visibleAspect(S.size[0], S.size[1], S.occl) : 1; }
  // The lens shift: the projection centre in the uncovered rectangle; poses, pivot and clamps are unchanged.
  function lens() {
    var w = S.size[0], h = S.size[1], cam = S.camera;
    if (!cam || !w || !h) return;
    var v = PC.cam.viewOffset(w, h, S.occl);
    if (v) { cam.aspect = v[0] / v[1]; cam.setViewOffset(v[0], v[1], v[2], v[3], v[4], v[5]); }
    else { cam.aspect = w / h; cam.clearViewOffset(); }
    S.view = v;
    cam.updateProjectionMatrix();
  }
  function refit() { if (S.house) { S.limits = PC.cam.limits(S.house, aspect()); if (S.pose) S.pose = PC.cam.clamp(S.pose, S.limits); } }
  function resize(inFrame) {
    var c = S.canvas;
    if (!c || !S.renderer) return;
    var w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;                                        // stage hidden
    // QA F4T1-1: an unchanged size / pixel ratio (e.g. the ResizeObserver firing when the stage reappears) changes
    // nothing and draws nothing; PC.view3d.open() requests its own frame. Also avoids setSize clearing the drawing buffer.
    if (w === S.size[0] && h === S.size[1] && dpr() === S.pr) return;
    S.pr = dpr();
    S.renderer.setPixelRatio(dpr());
    S.renderer.setSize(w, h, false);
    S.size = [w, h];
    lens(); refit();
    if (!inFrame) invalidate();
  }

  function setup(canvas) {
    S.canvas = canvas;
    S.scene = new THREE.Scene();
    S.camera = new THREE.PerspectiveCamera(PC.C.CAM.fov, 1, PC.C.CAM.nearMin, 100);
    lens();
    S.hemi = new THREE.HemisphereLight(three.col('#FFFFFF'), three.col('#FFFFFF'), 1); S.hemi.name = 'hemi';
    S.sun = new THREE.DirectionalLight(three.col('#FFFFFF'), 1); S.sun.name = 'sun';
    S.sun.castShadow = true;
    S.sun.shadow.mapSize.set(V().shadowMap, V().shadowMap);
    S.sun.shadow.bias = V().shadowBias; S.sun.shadow.normalBias = V().shadowNormalBias;
    S.sun.target.name = 'sunTarget';
    S.world = new THREE.Group(); S.world.name = 'world';
    S.scene.add(S.hemi, S.sun, S.sun.target, S.world);
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); S.lost = true; cancelFrame(); });
    canvas.addEventListener('webglcontextrestored', function () {
      S.lost = false; S.restores++;
      if (S.house) { S.builtKey = null; build(S.house); }
      invalidate();
    });
    // the wrap and the canvas itself: at 640x360 the canvas narrows beside the expanded panel (F5-T3a, Designer CSS)
    // while the wrap keeps its size; a double fire is harmless (resize() returns early on an unchanged size)
    if (typeof ResizeObserver === 'function' && canvas.parentElement) { var ro = new ResizeObserver(function () { resize(); }); ro.observe(canvas.parentElement); ro.observe(canvas); }
    else if (typeof addEventListener === 'function') addEventListener('resize', function () { resize(); });
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () { if (visible()) invalidate(); else cancelFrame(); });
    }
    S.detach = three.controls.attach(canvas, {
      active: function () { return S.active && !!S.house && !S.building; },
      get: function () { return S.pose; },
      set: function (p) { S.pose = PC.cam.clamp(p, S.limits); invalidate(); },
      size: function () { return S.size[0] ? S.size : [canvas.clientWidth || 1, canvas.clientHeight || 1]; },
      fov: PC.C.CAM.fov,
      interrupt: function () { stopAnim('input'); },
      onInput: function () { if (S.onInput) S.onInput(); }
    });
  }

  // Every geometry and material of the last build, exactly once (the meshes are tracked: nodes are not probed).
  function dispose() {
    stopAnim('build');
    clearSelection();
    S.meshes.forEach(function (m) { m.geometry.dispose(); });
    Object.keys(S.mats || {}).forEach(function (k) { S.mats[k].dispose(); });
    S.world.children.slice().forEach(function (c) { S.world.remove(c); });
    S.meshes = []; S.mats = null;
  }

  function lights(house) {
    var L = PC.sky.compute(S.look.hour, S.look.season, house.northDeg);
    three.applyLook({ scene: S.scene, sun: S.sun, hemi: S.hemi, mats: S.mats, world: S.world, house: house }, L);
    S.looks++;
  }

  function build(house) {
    dispose();
    var SC = PC.data.siteColors;
    S.mats = {
      batch: new THREE.MeshLambertMaterial({ vertexColors: true }),
      ground: new THREE.MeshLambertMaterial({ color: three.col(SC.ground) }),
      groundOuter: new THREE.MeshLambertMaterial({ color: three.col(SC.groundOuter) }),
      poolWater: new THREE.MeshLambertMaterial({ color: three.col(SC.poolWater) }),
      trunk: new THREE.MeshLambertMaterial({ color: three.col(SC.trunk) }),
      canopy: new THREE.MeshLambertMaterial({ color: three.col(PC.data.sky.seasons.summer.canopy) }),
      shrub: new THREE.MeshLambertMaterial({ color: three.col(PC.data.sky.seasons.summer.shrub) })
    };
    S.meshes = three.buildShell(house, S.world, S.mats).concat(three.buildInterior(house, S.world, S.mats),
      three.buildRoof(house, S.world, S.mats), three.buildSite(house, S.world, S.mats));
    var keep = S.house && S.pose && S.house.radius === house.radius && S.house.center[0] === house.center[0] && S.house.center[1] === house.center[1];
    S.house = house; S.builtKey = house.key; S.builds++;
    S.limits = PC.cam.limits(house, aspect());
    S.pose = keep ? PC.cam.clamp(S.pose, S.limits) : PC.cam.reset(house, aspect());
    S.camera.far = PC.C.CAM.farK * house.radius; S.camera.updateProjectionMatrix();
    lights(house);
    if (!house.levels.some(function (l) { return l.id === S.level; })) S.level = 'all';
    applyVisibility();
  }

  function applyVisibility() {
    if (!S.house) return;
    var sel = S.level, lv = S.house.levels.filter(function (l) { return l.id === sel; })[0], top = lv ? lv.index : Infinity;
    S.world.children.forEach(function (g) {
      if (g.name.indexOf('level-') === 0) g.visible = g.userData.index <= top;
      if (g.name === 'roof') g.visible = S.roof && sel === 'all';
    });
    var cap = S.world.getObjectByName('groundCap');
    if (cap) cap.visible = sel !== 'B';
  }

  PC.view3d = {
    // onState('building' | 'ready' | 'unavailable'). Returns { ok }.
    open: function (house, canvas, onState) {
      S.onState = onState || function () {};
      if (typeof THREE === 'undefined' || !house) { S.onState('unavailable'); return { ok: false }; }
      if (!S.renderer) {
        try { S.renderer = three.makeRenderer(canvas); } catch (e) { S.renderer = null; S.onState('unavailable'); return { ok: false }; }
        setup(canvas);
      }
      S.active = true;
      if (house.key === S.builtKey) { S.onState('ready'); invalidate(); return { ok: true }; }   // the frame sizes
      resize();
      S.onState('building');
      var token = ++S.token;
      S.building = token;
      requestAnimationFrame(function () {
        setTimeout(function () {
          if (S.building !== token || !S.active) return;
          build(house);
          S.building = 0;
          S.onState('ready');
          resize();
          invalidate();
        }, 0);
      });
      return { ok: true };
    },
    close: function () { S.active = false; S.building = 0; cancelFrame(); stopAnim('close'); clearSelection(); },
    invalidate: invalidate,
    setLevel: function (sel) { S.level = sel; applyVisibility(); invalidate(); },
    setRoof: function (on) { S.roof = !!on; applyVisibility(); invalidate(); },
    // Session look (A-13, TL F4-T3 Q5): kept across stages, rebuilds and context restores; no rebuild, camera untouched.
    setLook: function (l) {
      if (l && typeof l.hour === 'number' && isFinite(l.hour)) S.look.hour = Math.min(24, Math.max(0, l.hour));
      if (l && PC.data.sky.seasons[l.season]) S.look.season = l.season;
      if (S.house && S.mats) { lights(S.house); invalidate(); }
    },
    look: function () { return { hour: S.look.hour, season: S.look.season }; },
    // F5-T3a: the canvas area covered by overlays, in CSS px ({ right, bottom }; bottom held at 0). Re-fits the lens
    // and the limits and marks the frame dirty; the pose moves only if the new limits clamp it.
    setOcclusion: function (o) {
      var r = o && o.right > 0 ? Math.round(o.right) : 0;
      if (r === S.occl.right) return;
      S.occl = { right: r, bottom: 0 };
      lens(); refit(); invalidate();
    },
    resetView: function () { if (!S.house) return; stopAnim('reset'); S.pose = PC.cam.reset(S.house, aspect()); invalidate(); },
    setOnInput: function (fn) { S.onInput = fn; },
    // F5-T1: the animation driver, flights and the room selection (A-12, A-14 as built).
    animate: function (a) { if (S.house && a && typeof a.step === 'function') animate(a); },
    stopAnimation: function () { stopAnim('stop'); },
    pauseAnimation: pauseAnim,
    animation: function () { return S.anim; },
    flyTo: flyTo,
    flying: function () { return !!(S.anim && S.anim.kind === 'flight'); },
    select: select,
    selected: function () { return S.selected; },
    setOnSelect: function (fn) { S.onSelect = fn; },
    house: function () { return S.house; },
    limits: function () { return S.limits; },
    pose: function () { return S.pose ? PC.cam.copy(S.pose) : null; },
    // Read-only snapshot for tests and PC.debug.scene().
    info: function () {
      return { renderer: S.renderer, scene: S.scene, camera: S.camera, world: S.world, house: S.house, active: S.active, lost: S.lost,
        building: !!S.building, frame: !!S.frame, dirty: S.dirty, renders: S.renders, builds: S.builds, restores: S.restores,
        meshCount: S.meshes.length + (S.highlight ? 1 : 0), meshes: S.meshes.concat(S.highlight ? [S.highlight] : []),
        flight: S.anim && S.anim.kind === 'flight' ? { from: PC.cam.copy(S.anim.from), to: PC.cam.copy(S.anim.to), t: S.anim.t, ms: S.anim.ms } : null,
        animating: !!S.anim, selected: S.selected, highlight: S.highlight, highlightsMade: S.hlMade, level: S.level, roof: S.roof, look: { hour: S.look.hour, season: S.look.season }, looks: S.looks, size: S.size.slice(), occl: { right: S.occl.right, bottom: S.occl.bottom }, viewOffset: S.view ? S.view.slice() : null, aspect: aspect(), renderNow: function () { if (S.house && !S.lost) render(); } };
    }
  };
})(globalThis.PC = globalThis.PC || {});
