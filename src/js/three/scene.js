/* PC.view3d: renderer, on-demand loop, resize, visibility, context loss, lights, open / close (A-10, F4-T1 plan §4).
   THREE only inside functions: the file loads without it, and PC.view3d.open() then reports 'unavailable'.
   Loop (TL ruling 2): invalidate() requests ONE frame, only while open, visible, not lost, not building and none
   pending; an idle view requests no frames. Building... yields one painted frame first: rAF -> setTimeout 0 -> build
   (TL required item 3), guarded by a token so PC.view3d.close() during the yield builds nothing.
   Lights: one hemisphere + one sun (the only shadow caster), fixed at noon / summer from PC.data.sky as it is
   (A-13 rule: hemiGround = mix(noon hemiGround, summer ground, groundBounce)); F4-T3 swaps in PC.sky.compute. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};
  var D = Math.PI / 180;
  var S = {
    renderer: null, scene: null, camera: null, world: null, hemi: null, sun: null, mats: null, canvas: null,
    house: null, builtKey: null, pose: null, limits: null, size: [0, 0],
    active: false, lost: false, dirty: false, frame: 0, building: 0, token: 0, onState: null,
    meshes: [], level: 'all', roof: false, renders: 0, builds: 0, restores: 0
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

  // The opening look (noon, summer) from the tables as they are.
  three.noonLook = function () {
    var sky = PC.data.sky, k = sky.keys.filter(function (x) { return x.h === 12; })[0], su = sky.seasons.summer;
    return { sunColor: k.sunColor, sunI: k.sunI, hemiSky: k.hemiSky, hemiI: k.hemiI, background: k.background,
      hemiGround: three.mixHex(k.hemiGround, su.ground, sky.groundBounce), elevMax: su.elevMax };
  };
  // A-13 at a = PI / 2 (noon): s = y sin E - n cos E, n = (sin N, 0, -cos N).
  three.noonSunDir = function (northDeg, elevDeg) {
    var N = northDeg * D, E = elevDeg * D;
    return [-Math.sin(N) * Math.cos(E), Math.sin(E), Math.cos(N) * Math.cos(E)];
  };

  function cancelFrame() { if (S.frame) { cancelAnimationFrame(S.frame); S.frame = 0; } }
  function request() {
    if (!S.active || S.lost || S.building || S.frame || !S.house || !visible()) return;
    S.frame = requestAnimationFrame(frame);
  }
  function invalidate() { S.dirty = true; request(); }
  // The frame measures the canvas itself (QA F4T1-1): the shell may still be settling its layout when
  // PC.view3d.open() runs (e.g. stage 4's sample strip), so the size is taken when the frame draws.
  function frame() { S.frame = 0; if (!S.dirty || !S.active || S.lost || !visible()) return; resize(true); S.dirty = false; render(); }
  function render() {
    var p = S.pose, e = PC.cam.position(p), cam = S.camera, n = PC.cam.near(p);
    cam.position.set(e[0], e[1], e[2]);
    cam.lookAt(p.target[0], p.target[1], p.target[2]);
    if (cam.near !== n) { cam.near = n; cam.updateProjectionMatrix(); }
    S.renderer.render(S.scene, cam);
    S.renders++;
  }
  function aspect() { return S.size[0] && S.size[1] ? S.size[0] / S.size[1] : 1; }
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
    S.camera.aspect = w / h; S.camera.updateProjectionMatrix();
    if (S.house) { S.limits = PC.cam.limits(S.house, aspect()); if (S.pose) S.pose = PC.cam.clamp(S.pose, S.limits); }
    if (!inFrame) invalidate();
  }

  function setup(canvas) {
    S.canvas = canvas;
    S.scene = new THREE.Scene();
    S.camera = new THREE.PerspectiveCamera(PC.C.CAM.fov, 1, PC.C.CAM.nearMin, 100);
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
    if (typeof ResizeObserver === 'function' && canvas.parentElement) new ResizeObserver(function () { resize(); }).observe(canvas.parentElement);
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
      onInput: function () { if (S.onInput) S.onInput(); }
    });
  }

  // Every geometry and material of the last build, exactly once (the meshes are tracked: nodes are not probed).
  function dispose() {
    S.meshes.forEach(function (m) { m.geometry.dispose(); });
    Object.keys(S.mats || {}).forEach(function (k) { S.mats[k].dispose(); });
    S.world.children.slice().forEach(function (c) { S.world.remove(c); });
    S.meshes = []; S.mats = null;
  }

  function lights(house) {
    var L = three.noonLook(), fp = house.footprint, cu = house.center[0], cv = house.center[1];
    S.hemi.color.copy(three.col(L.hemiSky)); S.hemi.groundColor.copy(three.col(L.hemiGround)); S.hemi.intensity = L.hemiI;
    S.sun.color.copy(three.col(L.sunColor)); S.sun.intensity = L.sunI;
    var tx = fp.u + fp.w / 2 - cu, tz = -(fp.v + fp.d / 2 - cv), s = three.noonSunDir(house.northDeg, L.elevMax), dist = V().sunDist * house.radius;
    S.sun.target.position.set(tx, 0, tz);
    S.sun.position.set(tx + s[0] * dist, s[1] * dist, tz + s[2] * dist);
    var half = Math.min(V().shadowK * Math.hypot(fp.w, fp.d) / 2, V().shadowR * house.radius), c = S.sun.shadow.camera;
    c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 0.5; c.far = dist + 2 * half;
    c.updateProjectionMatrix();
    S.scene.background = new THREE.Color(L.background);
  }

  function build(house) {
    dispose();
    var SC = PC.data.siteColors;
    S.mats = {
      batch: new THREE.MeshLambertMaterial({ vertexColors: true }),
      ground: new THREE.MeshLambertMaterial({ color: three.col(SC.ground) }),
      groundOuter: new THREE.MeshLambertMaterial({ color: three.col(SC.groundOuter) })
    };
    S.meshes = three.buildShell(house, S.world, S.mats);
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
    close: function () { S.active = false; S.building = 0; cancelFrame(); },
    invalidate: invalidate,
    setLevel: function (sel) { S.level = sel; applyVisibility(); invalidate(); },
    setRoof: function (on) { S.roof = !!on; applyVisibility(); invalidate(); },
    resetView: function () { if (!S.house) return; S.pose = PC.cam.reset(S.house, aspect()); invalidate(); },
    setOnInput: function (fn) { S.onInput = fn; },
    pose: function () { return S.pose ? PC.cam.copy(S.pose) : null; },
    // Read-only snapshot for tests and PC.debug.scene().
    info: function () {
      return { renderer: S.renderer, scene: S.scene, camera: S.camera, world: S.world, house: S.house, active: S.active, lost: S.lost,
        building: !!S.building, frame: !!S.frame, dirty: S.dirty, renders: S.renders, builds: S.builds, restores: S.restores,
        meshCount: S.meshes.length, meshes: S.meshes.slice(), level: S.level, roof: S.roof, size: S.size.slice(), renderNow: function () { if (S.house && !S.lost) render(); } };
    }
  };
})(globalThis.PC = globalThis.PC || {});
