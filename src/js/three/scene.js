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
   disposing the previous geometry; a build and close() clear it and call the onSelect hook with null.
   F6-T1a (plan sections 2-5 + TL review): ACES tone mapping (exposure per look); the quality tier is picked once when
   the view first opens (pickTier: PC.C.VIEW3D.tier by pointer kind, the shadow map 2048 only on fine pointers with
   maxTextureSize >= 4096 in a tier that allows it, the pixel-ratio caps); the full tier has linear fog (colour and
   range set by applyLook, re-applied on every re-fit); the sky dome is moved to the eye before every render; the
   DataTextures (PC.three.texture, from the PC.texgen cache) are created per build and disposed with it, so a
   context restore re-uploads the cached pixels; the highlight and the north needle use the unlit mats.ui. The Roof
   switch starts at PC.C.VIEW3D.roofOnOpen (one value per page session, A-4).
   On-demand shadow map (TL Q-T8 follow-up, CTO conditions): shadowMap.autoUpdate = false; shadowsDirty() sets
   needsUpdate on every change of a caster or the light: a build (incl. context restore), every applyLook (sun,
   season, canopy visibility; also the re-fit on resize), and every visibility change (level selector, Roof switch,
   including the finder's and the tour's). Camera moves, flights, tour frames and the highlight (no caster) need none.
   info().shadowUpdates counts the requests. */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};
  var S = {
    renderer: null, scene: null, camera: null, world: null, hemi: null, sun: null, mats: null, canvas: null,
    house: null, builtKey: null, pose: null, limits: null, size: [0, 0], occl: { right: 0, bottom: 0 }, view: null,
    active: false, lost: false, dirty: false, frame: 0, building: 0, token: 0, onState: null,
    meshes: [], level: 'all', roof: !!(PC.C && PC.C.VIEW3D && PC.C.VIEW3D.roofOnOpen), renders: 0, builds: 0, restores: 0, looks: 0,
    tier: null, textures: [], shadowUpdates: 0, seq: 0, pending: 0, pendingDone: null, making: false, want: null,
    look: { hour: 12, season: 'summer' },
    anim: null, animT: null, highlight: null, selected: null, onSelect: null, hlMade: 0
  };
  function V() { return PC.C.VIEW3D; }
  function coarse() { return typeof matchMedia === 'function' && !!matchMedia('(pointer: coarse)').matches; }
  function dpr() { var d = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1; return Math.min(d, S.tier ? S.tier.maxDpr : V().maxDpr); }

  // env = { coarse, maxTex } -> the tier record used for this page session (CTO C-4.5 .. C-4.7).
  // G1: env.force (PC.gfx.tier) names the tier outright; the /gpu page runs 'full' only.
  three.pickTier = function (env) {
    var v = V(), name = env.force || v.tier[env.coarse ? 'coarse' : 'fine'], t = v.tiers[name] || v.tiers.full;
    var fine = t.fineShadow && !env.coarse && env.maxTex >= 4096;
    return { name: v.tiers[name] ? name : 'full', tex: t.tex, fog: !!t.fog, treeDetail: t.treeDetail,
      shadowMap: fine ? v.shadowMapFine : v.shadowMap, maxDpr: Math.min(v.maxDpr, t.maxDpr, env.coarse ? v.maxDprCoarse : Infinity) };
  };
  function visible() { return typeof document === 'undefined' || document.visibilityState !== 'hidden'; }

  // The A-10 renderer, synchronously: the standard page only (the /gpu adapter's make() is asynchronous).
  three.makeRenderer = function (canvas) { return PC.gfx.create(canvas, dpr()); };

  function cancelFrame() { if (S.frame) { cancelAnimationFrame(S.frame); S.frame = 0; } }
  function request() {
    if (!S.active || S.lost || S.building || S.pending || S.frame || !S.house || !visible()) return;
    S.frame = requestAnimationFrame(frame);
  }
  function invalidate() { S.dirty = true; request(); }
  function shadowsDirty() { if (S.renderer) { PC.gfx.shadowsDirty(S.renderer, S.sun); S.shadowUpdates++; } }
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
    S.highlight = three.highlight(S.house, id, S.mats.ui);
    S.world.add(S.highlight);
    S.selected = id; S.hlMade++;
    invalidate();
    return true;
  }
  // The camera at the pose and the sky dome at the eye (also before a precompile and a debug capture).
  function place() {
    var p = S.pose, e = PC.cam.position(p), cam = S.camera, n = PC.cam.near(p);
    cam.position.set(e[0], e[1], e[2]);
    cam.lookAt(p.target[0], p.target[1], p.target[2]);
    if (cam.near !== n) { cam.near = n; cam.updateProjectionMatrix(); }
    var sky = S.world.getObjectByName('sky');
    if (sky) sky.position.set(e[0], e[1], e[2]);               // TL required change 2: the dome follows the eye
  }
  function render() {
    place();
    PC.gfx.frame(S.renderer);           // /gpu: the node frame per app render (three's own loop is stopped); r128: nothing
    S.renderer.render(S.scene, S.camera);
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
  // The fog range follows the limits (TL required change 1), so a re-fit re-applies the stored look (creates nothing).
  function refit() {
    if (!S.house) return;
    S.limits = PC.cam.limits(S.house, aspect());
    if (S.pose) S.pose = PC.cam.clamp(S.pose, S.limits);
    if (S.mats) { apply(S.house); shadowsDirty(); }   // a re-fit stays an unconditional update (CTO F6-T1)
  }
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

  // Context / device loss (A-10; G-plan 3.3). r128: the same renderer comes back. /gpu: the adapter makes a new
  // renderer (r), which replaces the lost one (per-renderer state reset: pixel ratio, size); the rebuild runs through
  // the build continuation, so a build that was compiling when the device went completes its opening through it.
  var LOSS = {
    lost: function () { S.lost = true; cancelFrame(); },
    restored: function (r) {
      var old = null;
      if (r && r !== S.renderer) {
        old = S.renderer;
        S.renderer = r; S.pr = 0; S.size = [0, 0];
        r.setPixelRatio(dpr());
      }
      S.lost = false; S.restores++;
      if (S.house) { var d = S.pending ? S.pendingDone : null; S.builtKey = null; build(S.house, d); }
      // the old renderer goes after the rebuild: disposing the old materials notifies it, so it must still be whole
      if (old) { try { old.dispose(); } catch (e) { /* its device is gone already */ } }
      invalidate();
    },
    failed: function () { S.renderer = null; S.builtKey = null; S.building = 0; if (S.onState) S.onState('unavailable'); },
    pr: function () { return dpr(); }
  };
  // Once per canvas (G-plan 3.3): scene, camera, lights, the loss watch, resize / visibility listeners, controls.
  // Swapping the renderer after a device loss (LOSS.restored) attaches nothing again.
  function setup(canvas) {
    S.canvas = canvas;
    S.scene = new THREE.Scene();
    S.camera = new THREE.PerspectiveCamera(PC.C.CAM.fov, 1, PC.C.CAM.nearMin, 100);
    lens();
    S.hemi = new THREE.HemisphereLight(three.col('#FFFFFF'), three.col('#FFFFFF'), 1); S.hemi.name = 'hemi';
    S.sun = new THREE.DirectionalLight(three.col('#FFFFFF'), 1); S.sun.name = 'sun';
    S.sun.castShadow = true;
    S.sun.shadow.mapSize.set(S.tier.shadowMap, S.tier.shadowMap);
    if (S.tier.fog) S.scene.fog = new THREE.Fog(new THREE.Color('#FFFFFF'), 1, 2);   // colour and range: applyLook
    S.sun.shadow.bias = V().shadowBias; S.sun.shadow.normalBias = V().shadowNormalBias;
    S.sun.target.name = 'sunTarget';
    S.world = new THREE.Group(); S.world.name = 'world';
    S.scene.add(S.hemi, S.sun, S.sun.target, S.world);
    PC.gfx.watch(canvas, LOSS, S.renderer);
    // the wrap and the canvas itself (F5-T3a: at 640x360 the canvas narrows beside the panel; a double fire is harmless)
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
    var seen = [];   // F6-T2: the glow meshes share the blobs' plane; each geometry is disposed once
    S.meshes.forEach(function (m) { if (seen.indexOf(m.geometry) < 0) { seen.push(m.geometry); m.geometry.dispose(); } });
    Object.keys(S.mats || {}).forEach(function (k) { S.mats[k].dispose(); });
    S.textures.forEach(function (t) { t.dispose(); });
    S.world.children.slice().forEach(function (c) { S.world.remove(c); });
    S.meshes = []; S.mats = null; S.textures = [];
  }

  function apply(house) {
    var L = PC.sky.compute(S.look.hour, S.look.season, house.northDeg);
    three.applyLook({ scene: S.scene, sun: S.sun, hemi: S.hemi, mats: S.mats, world: S.world, house: house, renderer: S.renderer, limits: S.limits }, L);
    // F6-T2 (TL F4; CTO 4): the shadow map is re-rendered only when what it depends on changed: the sun's direction
    // (position) and intensity, the shadow-camera bounds, the canopies' visibility. An indoor-only change or the same
    // look again does not count. Build, restore, the level selector, Roof and a re-fit stay unconditional.
    var c = S.sun.shadow.camera, p = S.sun.position, can = S.world.getObjectByName('canopies');
    var sig = [p.x, p.y, p.z, S.sun.intensity, c.left, c.right, c.top, c.bottom, c.near, c.far, can ? can.visible : null].join(',');
    if (sig !== S.shadowSig) { S.shadowSig = sig; shadowsDirty(); }
  }
  function lights(house) { apply(house); S.looks++; }
  function tex(kind) { var t = three.texture(kind, S.tier.tex, S.renderer); S.textures.push(t); return t; }

  // done (optional) runs once the build is complete, after the precompile: at once on r128, later on /gpu. A newer
  // build (or close + another house) bumps S.seq first, so a stale continuation does nothing (G-plan 3.3).
  function build(house, done) {
    dispose();
    var SC = PC.data.siteColors;
    var lite = !S.tier.fog;
    S.mats = {
      batch: new THREE.MeshLambertMaterial({ vertexColors: true }),
      ground: new THREE.MeshLambertMaterial({ color: three.col(SC.ground), map: tex('grass') }),
      groundOuter: new THREE.MeshLambertMaterial({ color: three.col(SC.groundOuter), map: tex('meadow'), vertexColors: lite }),
      paving: new THREE.MeshLambertMaterial({ vertexColors: true, map: tex('paving') }),
      ui: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }),
      sky: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false, depthWrite: false }),
      poolWater: new THREE.MeshLambertMaterial({ color: three.col(SC.poolWater) }),
      trunk: new THREE.MeshLambertMaterial({ color: three.col(SC.trunk) }),
      canopy: new THREE.MeshLambertMaterial({ color: three.col(PC.data.sky.seasons.summer.canopy) }),
      shrub: new THREE.MeshLambertMaterial({ color: three.col(PC.data.sky.seasons.summer.shrub) })
    };
    // F6-T1b C4: the footprint ring, the ground's colour and map with a darkening vertex colour (applyLook keeps the colour)
    S.mats.groundRing = new THREE.MeshLambertMaterial({ color: three.col(SC.ground), map: S.mats.ground.map, vertexColors: true });
    // F6-T1b C5: the blob shadows (transparent mesh 1 of 2, TL Q-T5): black x the blob alpha map, no depth write, unlit
    S.mats.blob = new THREE.MeshBasicMaterial({ color: three.col('#000000'), map: three.texture('blob', PC.data.vegetation.blob.size, S.renderer),
      transparent: true, opacity: PC.data.vegetation.blob.opacity, depthWrite: false, toneMapped: false });
    S.textures.push(S.mats.blob.map);
    if (house.roof.type === 'pitched') S.mats.tiles = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex('tiles') });
    else {   // F6-T1c R2 (TL Q-F1 Lambert, Q2 one deck mesh): membrane on flat roofs, the paving texture object on walkable ones
      var walk = house.roof.usable || house.roof.type === 'terrace';
      S.mats.deck = new THREE.MeshLambertMaterial({ color: three.col(PC.data.exteriors[house.exterior].roof), map: walk ? S.mats.paving.map : tex('membrane') });
    }
    // F6-T2 (plan 2-3, CTO 2.3): furniture off the walls' batch material; the interior atlas; the lamp shades. The
    // emissive colours are set at build with intensity 0, so the shader programs never change with the hour (CTO 1.2).
    var IN = PC.data.indoor, glow = function (o, e) { o.emissive = three.col(e); o.emissiveIntensity = 0; return new THREE.MeshLambertMaterial(o); };
    S.mats.furniture = glow({ vertexColors: true }, IN.lift.hex);
    S.mats.interior = glow({ vertexColors: true, map: tex('interior') }, IN.lift.hex);
    S.mats.lamp = glow({ vertexColors: true }, IN.lamp.hex);
    S.mats.glazing = glow({ vertexColors: true }, IN.glazing.hex);
    // N4 glow pools (full tier only; CTO 1.2d, 1.6): additive, no depth write, the blob map (RGB white, alpha falloff)
    if (!lite) S.mats.glow = new THREE.MeshBasicMaterial({ color: three.col('#000000'), map: S.mats.blob.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    PC.gfx.materials(S.mats, S.scene);   // G1: /gpu output nodes (tone mapping + fog as r128 does them); r128: nothing
    S.meshes = three.buildShell(house, S.world, S.mats, { tier: S.tier }).concat(three.buildInterior(house, S.world, S.mats, { cells: three.atlasCells(S.tier.tex) }),
      three.buildRoof(house, S.world, S.mats), three.buildSite(house, S.world, S.mats, { tier: S.tier }));
    S.meshes = S.meshes.concat(three.buildGlow(house, S.world, S.mats, { tier: S.tier }));
    var keep = S.house && S.pose && S.house.radius === house.radius && S.house.center[0] === house.center[0] && S.house.center[1] === house.center[1];
    S.house = house; S.builtKey = house.key; S.builds++;
    S.limits = PC.cam.limits(house, aspect());
    S.pose = keep ? PC.cam.clamp(S.pose, S.limits) : PC.cam.reset(house, aspect());
    S.camera.far = PC.C.CAM.farK * house.radius; S.camera.updateProjectionMatrix();
    lights(house);
    if (!house.levels.some(function (l) { return l.id === S.level; })) S.level = 'all';
    applyVisibility();
    precompile(house, done);
  }
  // F6-T2 precompile (the night-only and interior-only programs at build), done by the adapter (PC.gfx.precompile).
  // r128 shows the meshes for one synchronous call and puts the flags back. /gpu compiles asynchronously, so when it
  // returns (reapply = true) the visibility and the look are applied again instead of restoring saved flags: a level,
  // Roof or Light change made while it compiled is kept (G-plan 3.3).
  function precompile(house, done) {
    var seq = ++S.seq;
    S.pending = seq; S.pendingDone = done || null;
    PC.gfx.precompile({ renderer: S.renderer, scene: S.scene, camera: S.camera, world: S.world, mats: S.mats, place: place,
      live: function () { return seq === S.seq && !S.lost; } }, function (reapply) {
      if (seq !== S.seq) return;            // a newer build disposed this one
      S.pending = 0; S.pendingDone = null;
      if (reapply) { applyVisibility(); apply(house); }
      if (done) done();
      if (reapply) invalidate();
    });
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
    // F6-T2 N4 (TL ruling 3): exterior mode (Roof on, All) draws every glow instance; the dollhouse only the pools
    // and the ground spill (the window patches would float over the 1.2 m cut walls)
    var ext = S.roof && sel === 'all';
    S.world.children.forEach(function (g) { g.children.forEach(function (m) {
      if (m.name.indexOf('glow-') === 0) m.count = ext ? m.userData.ranges.all : m.userData.ranges.pools + m.userData.ranges.spill;
      // F6-T2 (gate time): the furniture and the textured floors / parts are enclosed by the full walls, the opaque
      // glazing and the roof in exterior mode, so they are not drawn there (vertex and shadow-pass cost only)
      if (m.name === 'furniture' || m.name.indexOf('textured-') === 0) m.visible = !ext;
    }); });
    shadowsDirty();
  }

  // The renderer from PC.gfx.make: the tier for this page session, the pixel ratio, the once-per-canvas setup.
  function made(err, r, canvas) {
    if (err || !r) { S.renderer = null; return false; }
    S.renderer = r; S.lost = false;                     // /gpu: a renderer made again after a failed device restore
    S.tier = three.pickTier({ coarse: coarse(), maxTex: PC.gfx.maxTex(r), force: PC.gfx.tier });
    S.renderer.setPixelRatio(dpr());
    if (!S.canvas) setup(canvas);
    return true;
  }
  function go(house) {
    if (house.key === S.builtKey && !S.pending) { S.onState('ready'); invalidate(); return { ok: true }; }   // the frame sizes
    resize();
    S.onState('building');
    var token = ++S.token;
    S.building = token;
    requestAnimationFrame(function () {
      setTimeout(function () {
        if (S.building !== token || !S.active) return;
        build(house, function () {
          if (S.building !== token || !S.active) return;   // closed, or another house, while it compiled (/gpu)
          S.building = 0;
          S.onState('ready');
          resize();
          invalidate();
        });
      }, 0);
    });
    return { ok: true };
  }

  PC.view3d = {
    // onState('building' | 'ready' | 'unavailable'). Returns { ok }.
    open: function (house, canvas, onState) {
      S.onState = onState || function () {};
      if (!PC.gfx.available() || !house) { S.onState('unavailable'); return { ok: false }; }
      if (!S.renderer) {
        // G1 continuation: r128 calls back at once (now = true / false); /gpu after the module, the device gate and
        // renderer.init(), meanwhile the stage shows Building... and the opening waits for the latest house (S.want).
        S.want = house;
        if (S.making) { S.onState('building'); return { ok: true }; }
        var sync = true, now = null;
        S.making = true;
        PC.gfx.make(canvas, dpr(), function (err, r) {
          S.making = false;
          var ok = made(err, r, canvas);
          if (sync) { now = ok; return; }
          var h = S.want;
          S.want = null;
          if (!h) return;                                     // closed while waiting
          if (!ok) { S.onState('unavailable'); return; }
          S.active = true;
          go(h);
        });
        sync = false;
        S.want = null;
        if (now === false) { S.onState('unavailable'); return { ok: false }; }
        if (now === null) { S.want = house; S.onState('building'); return { ok: true }; }
      }
      S.active = true;
      return go(house);
    },
    close: function () { S.active = false; S.building = 0; S.want = null; cancelFrame(); stopAnim('close'); clearSelection(); },
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
    // F5-T3a: canvas px covered by overlays ({ right }; bottom held at 0): re-fits lens + limits, marks dirty.
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
    // G1 test hook: the current view drawn into a render target and read back as sRGB bytes by the adapter (headless
    // WebGPU canvases read back blank). done(null) where the adapter has none (r128 reads its canvas directly).
    // false when three.js itself did not load (/gpu: the import failed or timed out; G1 round 2, N2)
    available: function () { return PC.gfx.available(); },
    capture: function (done) {
      if (!PC.gfx.capture || !S.house || S.lost || !S.renderer || S.building || S.pending) { done(null); return; }
      place();
      PC.gfx.capture(S.renderer, S.scene, S.camera, S.size, done);
    },
    // Read-only snapshot for tests and PC.debug.scene().
    info: function () {
      return { renderer: S.renderer, scene: S.scene, camera: S.camera, world: S.world, house: S.house, active: S.active, lost: S.lost,
        building: !!S.building, frame: !!S.frame, dirty: S.dirty, renders: S.renders, builds: S.builds, restores: S.restores,
        meshCount: S.meshes.length + (S.highlight ? 1 : 0), meshes: S.meshes.concat(S.highlight ? [S.highlight] : []),
        flight: S.anim && S.anim.kind === 'flight' ? { from: PC.cam.copy(S.anim.from), to: PC.cam.copy(S.anim.to), t: S.anim.t, ms: S.anim.ms } : null,
        tier: S.tier ? Object.assign({}, S.tier) : null, textures: S.textures.slice(), shadowUpdates: S.shadowUpdates,
        compiling: !!S.pending, gfx: PC.gfx.name,
        animating: !!S.anim, selected: S.selected, highlight: S.highlight, highlightsMade: S.hlMade, level: S.level, roof: S.roof, look: { hour: S.look.hour, season: S.look.season }, looks: S.looks, size: S.size.slice(), occl: { right: S.occl.right, bottom: S.occl.bottom }, viewOffset: S.view ? S.view.slice() : null, aspect: aspect(), renderNow: function () { if (S.house && !S.lost) render(); } };
    }
  };
})(globalThis.PC = globalThis.PC || {});
