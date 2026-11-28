/* PC.gfx for the standard page (G1, G-plan 3.1): every line that depends on three.js r128 lives here; scene.js,
   util.js and look.js call these members instead. The /gpu page has the same shape in src/gpu/three/gfx-webgpu.js.
   Callback style (G-plan 3.3): make() and precompile() call done synchronously here, so the standard page keeps its
   synchronous state machine and every test expectation.
   - available(): the r128 global is loaded.
   - create(canvas, pr) / make(canvas, pr, done(err, r)): the A-10 renderer (antialias, PCF soft shadows on demand,
     sRGB output encoding, ACES tone mapping).
   - watch(canvas, h): once per canvas, h.lost() on webglcontextlost (default prevented), h.restored() on restore.
   - col(hex): sRGB hex -> linear (r128 does no colour management). texSpace(t, srgb): the texture encoding.
   - maxTex(r), maxAniso(r), exposure(r, k), lightK (legacy light units: 1), shadowsDirty(r).
   - materials(mats) / look(ctx): nothing to do on r128 (the /gpu page adds output nodes and fog uniforms).
   - precompile(ctx, done(reapply)): F6-T2 (CTO 1.2, TL): the glow meshes are hidden by day and r128 builds a program
     only for what it draws; they are compiled once at build (shown for the call, then put back), so dusk switches
     nothing and stalls nothing. The same for the furniture and textured-<level>, hidden in exterior mode (TL gate
     ruling): compiled, and their buffers and the atlas uploaded by one draw clipped to a 1 px scissor without a
     shadow pass, so the first Roof-off frame uploads nothing and the renderer's geometry count does not change. */
(function (PC) {
  'use strict';
  var PRE = /^(glow-|textured-|furniture$)/;
  var gfx = PC.gfx = {
    name: 'r128',
    tier: null,
    available: function () { return typeof THREE !== 'undefined'; },
    create: function (canvas, pr) {
      var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      r.setPixelRatio(pr);
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.shadowMap.autoUpdate = false;
      r.outputEncoding = THREE.sRGBEncoding;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      return r;
    },
    make: function (canvas, pr, done) {
      var r = null;
      try { r = gfx.create(canvas, pr); } catch (e) { done(e, null); return; }
      done(null, r);
    },
    watch: function (canvas, h) {
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); h.lost(); });
      canvas.addEventListener('webglcontextrestored', function () { h.restored(null); });
    },
    col: function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); },
    texSpace: function (t, srgb) { t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding; },
    maxTex: function (r) { return r.capabilities.maxTextureSize; },
    maxAniso: function (r) { return r.capabilities.getMaxAnisotropy(); },
    exposure: function (r, k) { r.toneMappingExposure = k; },
    lightK: 1,
    shadowsDirty: function (r) { r.shadowMap.needsUpdate = true; },
    materials: function () {},
    look: function () {},
    // ctx = { renderer, scene, camera, world, mats }
    precompile: function (ctx, done) {
      var R = ctx.renderer;
      if (!R || !R.compile) { done(false); return; }
      var gs = [];
      ctx.world.traverse(function (o) { if (PRE.test(o.name)) { gs.push([o, o.visible]); o.visible = true; } });
      if (!gs.length) { done(false); return; }
      var sm = R.shadowMap, nu = sm.needsUpdate;
      R.compile(ctx.scene, ctx.camera);
      if (R.initTexture && ctx.mats.interior && ctx.mats.interior.map) R.initTexture(ctx.mats.interior.map);   // CTO: the atlas up at build
      if (R.setScissorTest) {
        sm.needsUpdate = false;
        R.setScissor(0, 0, 1, 1); R.setScissorTest(true); R.render(ctx.scene, ctx.camera); R.setScissorTest(false);
        sm.needsUpdate = nu;
      }
      gs.forEach(function (e) { e[0].visible = e[1]; });
      done(false);
    }
  };
})(globalThis.PC = globalThis.PC || {});
