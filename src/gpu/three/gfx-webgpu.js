/* PC.gfx for the /gpu page (G1, G-plan 3.1 and 3.3 as corrected by the G0 spike notes): three.js 0.180.0 with the
   WebGPU renderer, loaded by the bootstrap script of the page (PC.boot3d). Same shape as js/three/gfx-r128.js; the
   standard page never loads this file. THREE only inside functions, like every three-layer file.
   - make(canvas, pr, done): waits for the bootstrap, then the device gate (G-plan 5): navigator.gpu, an adapter from
     requestAdapter(), renderer.init() on the WebGPU backend (never three's WebGL2 fallback). Anything else ->
     done(error) and the stage shows the unavailable card. done is always called later (asynchronous).
   - Colour (spike items 3-5): output sRGB, colour management on, so col(hex) = new Color(hex) (one conversion) and
     look.js's raw new Color(hex) for the background and the fog colour already gives the hex on screen.
   - Tone mapping and fog as r128 does them: the renderer runs NoToneMapping; materials(mats) gives every material
     that r128 tone-maps or fogs an outputNode: ACES with the shared exposure uniform (when toneMapped), then the fog
     mixed in sRGB after it (when fog: r128 mixes fog into the encoded output), and sets material.fog = false (r180
     would fog before the outputNode). Unlit toneMapped: false materials (sky, UI marks) keep their exact colours.
   - Lights: physically based units, so hemisphere and sun intensities x PI (lightK); emissive unscaled.
   - Shadows on demand: light.shadow.autoUpdate = false + needsUpdate. Anisotropy from the renderer; max texture
     size 8192 (three asks for the default limits).
   - precompile: compileAsync with every precompile mesh shown and frustum culling off for the call (r128's compile
     ignores the frustum), then one hidden warm-up render (compileAsync does not build the shadow-pass pipelines),
     then done(true): scene.js applies visibility and look again.
   - watch: device loss (renderer.onDeviceLost replaces three's handler): the reason 'destroyed' (our own dispose,
     page teardown) is ignored; otherwise h.lost(), a new renderer, h.restored(r); at most MAX_LOSSES a session.
   - capture (tests): the view drawn into a half-float 4x MSAA render target in the next animation frame, read back,
     linear -> sRGB bytes in JS (headless or not, a WebGPU canvas cannot be read back from a test).
   - Known r180 behaviour: WebGPURenderer runs its own requestAnimationFrame loop from init() to advance its node
     frame (per-frame uniforms); it renders nothing, and the app's on-demand loop still draws no idle frames. */
(function (PC) {
  'use strict';
  var PRE = /^(glow-|textured-|furniture$)/, MAX_LOSSES = 3;
  var U = null, losses = 0, watched = null;

  function uniforms() {
    if (U) return U;
    var t = THREE.TSL;
    U = { exposure: t.uniform(1), fog: t.uniform(new THREE.Vector3(1, 1, 1)), near: t.uniform(1), far: t.uniform(2), fogOn: t.uniform(0) };
    return U;
  }
  // Calls done outside the promise chain, so an error in it surfaces instead of becoming a silent rejection.
  function later(done, err, r) { setTimeout(function () { done(err, r); }, 0); }
  function ready(cb) {
    var b = PC.boot3d;
    if (!b) { cb('missing'); return; }
    if (b.state !== 'loading') cb(b.state); else b.waiting.push(cb);
  }
  function bind(r) {
    r.onDeviceLost = function (info) {
      if (info && info.reason === 'destroyed') return;            // our own dispose / page teardown (spike item 11)
      if (!watched || r !== watched.current) return;               // an old renderer
      watched.current = null;
      var h = watched.h, canvas = watched.canvas;
      h.lost();
      if (++losses > MAX_LOSSES) { h.failed(); return; }
      gfx.make(canvas, h.pr(), function (err, r2) {
        if (err || !watched) { h.failed(); return; }
        watched.current = r2; bind(r2);
        h.restored(r2);
      });
    };
  }

  var gfx = PC.gfx = {
    name: 'webgpu',
    tier: 'full',                       // G1: the /gpu page runs the full tier only (ultra comes in G2)
    adapter: null,
    available: function () { return !!PC.boot3d && PC.boot3d.state !== 'failed' && PC.boot3d.state !== 'timeout'; },
    make: function (canvas, pr, done) {
      ready(function (state) {
        if (state !== 'ready' || typeof THREE === 'undefined') { later(done, new Error('three.js did not load: ' + state)); return; }
        var gpu = typeof navigator !== 'undefined' ? navigator.gpu : null;
        if (!gpu || typeof gpu.requestAdapter !== 'function') { later(done, new Error('no navigator.gpu')); return; }
        var r = null;
        gpu.requestAdapter().then(function (ad) {
          if (!ad) throw new Error('no WebGPU adapter');
          // The device comes from this adapter, kept on PC.gfx: when the adapter three requests itself is collected,
          // Chrome fails every later buffer map ("A valid external Instance reference no longer exists"), which
          // breaks render-target readback. Same features as three would ask for (all the adapter has).
          gfx.adapter = ad;
          return ad.requestDevice({ requiredFeatures: Array.from(ad.features) });
        }).then(function (device) {
          r = new THREE.WebGPURenderer({ canvas: canvas, antialias: true, device: device });
          r.onDeviceLost = function () {};                          // until watch() binds it
          return r.init();
        }).then(function () {
          if (!r.backend || !r.backend.isWebGPUBackend) throw new Error('not the WebGPU backend');
          r.setPixelRatio(pr);
          r.shadowMap.enabled = true;
          r.shadowMap.type = THREE.PCFSoftShadowMap;
          r.outputColorSpace = THREE.SRGBColorSpace;
          r.toneMapping = THREE.NoToneMapping;
          uniforms();
          if (watched && !watched.current) { watched.current = r; bind(r); }   // a renderer made again after a failure
          later(done, null, r);
        }).catch(function (e) {
          if (r) { try { r.dispose(); } catch (x) { /* nothing to free */ } }
          later(done, e || new Error('WebGPU start failed'));
        });
      });
    },
    watch: function (canvas, h, r) { watched = { canvas: canvas, h: h, current: r }; bind(r); },
    col: function (hex) { return new THREE.Color(hex); },
    texSpace: function (t, srgb) { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; },
    maxTex: function () { return 8192; },
    maxAniso: function (r) { return r.getMaxAnisotropy(); },
    exposure: function (r, k) { uniforms().exposure.value = k; },
    lightK: Math.PI,
    shadowsDirty: function (r, sun) { if (sun) { sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true; } },
    materials: function (mats, scene) {
      var t = THREE.TSL, u = uniforms(), fogged = !!(scene && scene.fog);
      Object.keys(mats).forEach(function (k) {
        var m = mats[k], tone = m.toneMapped !== false, fog = fogged && m.fog !== false;
        if (!tone && !fog) return;
        var rgb = t.output.rgb;
        if (tone) rgb = t.toneMapping(THREE.ACESFilmicToneMapping, u.exposure, rgb);
        if (fog) rgb = t.sRGBTransferEOTF(t.mix(t.sRGBTransferOETF(rgb), u.fog, t.rangeFogFactor(u.near, u.far).mul(u.fogOn)));
        m.outputNode = t.vec4(rgb, t.output.a);
        m.fog = false;
      });
    },
    look: function (ctx) {
      var u = uniforms(), f = ctx.scene.fog;
      u.fogOn.value = f ? 1 : 0;
      if (!f) return;
      var c = f.color.clone().convertLinearToSRGB();
      u.fog.value.set(c.r, c.g, c.b); u.near.value = f.near; u.far.value = f.far;
    },
    // ctx = { renderer, scene, camera, world, mats, place }
    precompile: function (ctx, done) {
      var R = ctx.renderer, gs = [], fc = [], p = null;
      ctx.world.traverse(function (o) {
        if (PRE.test(o.name)) { gs.push([o, o.visible]); o.visible = true; }
        if (o.frustumCulled) { fc.push(o); o.frustumCulled = false; }
        // r180 asks every mesh's geometry for a normal attribute (else a THREE warning per pipeline): the unlit sky
        // dome has none, so it gets a zero one (never read by an unlit material)
        var g = o.isMesh && o.geometry, at = g && g.attributes;
        if (at && at.position && !at.normal) g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(at.position.count * 3), 3));
      });
      ctx.place();
      try { p = R.compileAsync(ctx.scene, ctx.camera); } catch (e) { p = Promise.reject(e); }
      // compileAsync collects its render list synchronously, so the flags go back at once
      gs.forEach(function (e) { e[0].visible = e[1]; });
      fc.forEach(function (o) { o.frustumCulled = true; });
      var t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      Promise.resolve(p).then(function () {
        gfx.stats.compileMs = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
        gfx.stats.pipelinesCompiled = R._pipelines ? R._pipelines.caches.size : -1;
        if (ctx.live()) {
          ctx.place();
          R.render(ctx.scene, ctx.camera);          // warm-up: the shadow pass and the uploads, under the Building card
          gfx.stats.pipelinesWarm = R._pipelines ? R._pipelines.caches.size : -1;
        }
      }).catch(function () { /* a failed compile is not fatal: the first frame compiles what is missing */ }).then(function () {
        setTimeout(function () { done(true); }, 0);
      });
    },
    stats: { compileMs: 0, pipelinesCompiled: 0, pipelinesWarm: 0 },
    // r180 refreshes per-frame uniforms (the light directions among them) once per node frame, which its own
    // requestAnimationFrame loop advances: the capture draws in the next animation frame, as the canvas does.
    capture: function (r, scene, camera, size, done) {
      requestAnimationFrame(function () { gfx.captureNow(r, scene, camera, size, done); });
    },
    captureNow: function (r, scene, camera, size, done) {
      var w = Math.max(1, size[0] | 0), h = Math.max(1, size[1] | 0);
      var rt = new THREE.RenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 }), sun = scene.getObjectByName('sun');   // 4x MSAA like the canvas
      // r180 keeps a shadow map per render context: the canvas frame used up needsUpdate, so the render target's own
      // shadow map is drawn here (test hook only; the page itself only ever renders to its canvas)
      if (sun) sun.shadow.needsUpdate = true;
      r.setRenderTarget(rt);
      r.render(scene, camera);
      r.setRenderTarget(null);
      r.readRenderTargetPixelsAsync(rt, 0, 0, w, h).then(function (px) {
        // rows come padded to WebGPU's 256-byte copy alignment (all but the last row)
        var B = px.BYTES_PER_ELEMENT, stride = Math.ceil(w * 4 * B / 256) * 256 / B;
        var out = new Uint8ClampedArray(w * h * 4), half = THREE.DataUtils.fromHalfFloat;
        var enc = function (v) { v = v <= 0 ? 0 : v >= 1 ? 1 : v; return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
          var i = y * stride + x * 4, o = (y * w + x) * 4;
          out[o] = enc(half(px[i])); out[o + 1] = enc(half(px[i + 1])); out[o + 2] = enc(half(px[i + 2]));
          out[o + 3] = 255 * Math.min(1, half(px[i + 3]));
        }
        rt.dispose();
        done({ w: w, h: h, data: out });
      }, function (e) { rt.dispose(); gfx.stats.captureError = String(e && e.message || e); done(null); });
    }
  };
})(globalThis.PC = globalThis.PC || {});
