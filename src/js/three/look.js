/* PC.three.applyLook(ctx, look) and PC.three.fitShadow(sun, house, dir) (A-13, A-11; F4-T3 plan section 5; TL plan
   review Q4). ctx = { scene, sun, hemi, mats, world, house }; look = PC.sky.compute(...).
   applyLook writes the light colours (PC.three.col) and intensities, the sun position (target + sunDir x sunDist x
   radius; target = footprint centre at Y 0), scene.background (raw hex), the plot ground / canopy / shrub material
   colours and the canopies' visibility, then refits the shadow camera. It creates and disposes no geometry,
   material or mesh and never touches the camera: the caller only marks the frame dirty. The trunk keeps its build
   colour (the season never touches it; neither do house, furniture or site items); F6-T1b: groundOuter follows
   L.meadowColor (the season's meadow, winter snow).
   fitShadow: the content box (footprint up to the roof top, parking + canopy, pool + rim, seating, every tree and
   shrub at its scale; the boundary wall is left out) as 8 corners in the light's view (the basis three's lookAt
   gives the shadow camera: z = light direction, x = up x z, y = z x x), plus a 0.5 m margin; each side capped at
   shadowR x house.radius. Writes left / right / top / bottom / near / far + updateProjectionMatrix only.
   F6-T1a (plan section A + TL review; ctx also has renderer and limits): toneMappingExposure = L.exposure; the sky
   dome's colour attribute repainted in place (PC.three.skyPaint); the fog (full tier) gets the raw horizon hex (r128
   mixes fog into the encoded output, A-10 second exception) and near = limits.rMax + R, far = min(near + fogSpanK x R,
   0.9 x outerK x R / 2); the lite groundOuter skirt's outer vertices fade to the horizon (colour / meadow colour,
   clamped). Still nothing created or disposed.
   F6-T2: the indoor terms (L.indoor): emissive intensities of glazing / furniture / interior / lamp, the glow colour
   and the glow meshes' visibility; uniforms and visibility only, so no program changes.
   G1: exposure, light units (PC.gfx.lightK) and the output-node uniforms go through the page's adapter (PC.gfx). */
(function (PC) {
  'use strict';
  var three = PC.three = PC.three || {};
  var MARGIN = 0.5;

  function contentBox(house) {
    var fp = house.footprint, R = PC.C.ROOF, roof = house.roof, Vg = PC.data.vegetation, S = house.site;
    var b = { u0: fp.u, u1: fp.u + fp.w, v0: fp.v, v1: fp.v + fp.d, y1: 0 };
    function add(u0, u1, v0, v1, y1) { b.u0 = Math.min(b.u0, u0); b.u1 = Math.max(b.u1, u1); b.v0 = Math.min(b.v0, v0); b.v1 = Math.max(b.v1, v1); b.y1 = Math.max(b.y1, y1); }
    var rise = roof.type === 'pitched' ? Math.tan(R.pitchDeg * Math.PI / 180) * Math.min(fp.w, fp.d) / 2 : 0;
    add(fp.u, fp.u + fp.w, fp.v, fp.v + fp.d, roof.baseY + R.slab + Math.max(R.stairHead, R.pergolaH, R.parapetHigh, rise));
    if (S.parking) add(S.parking.u, S.parking.u + S.parking.w, S.parking.v, S.parking.v + S.parking.d, 2.4);
    if (S.pool) add(S.pool.u - 0.3, S.pool.u + S.pool.w + 0.3, S.pool.v - 0.3, S.pool.v + S.pool.d + 0.3, 0.1);
    if (S.seating) add(S.seating.u, S.seating.u + S.seating.w, S.seating.v, S.seating.v + S.seating.d, 0.8);
    var tr = Vg.tree.canopyR, th = Vg.tree.canopyY0 + Vg.tree.canopyH;
    S.trees.forEach(function (t) { var r = tr * t[2]; add(t[0] - r, t[0] + r, t[1] - r, t[1] + r, th * t[2]); });
    S.shrubs.forEach(function (t) { var r = Vg.shrub.r * t[2]; add(t[0] - r, t[0] + r, t[1] - r, t[1] + r, Vg.shrub.h * t[2]); });
    var cu = house.center[0], cv = house.center[1], out = [];
    [b.u0, b.u1].forEach(function (u) { [b.v0, b.v1].forEach(function (v) { [0, b.y1].forEach(function (y) { out.push([u - cu, y, -(v - cv)]); }); }); });
    return out;
  }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  // The light-view extents of the content box for a light at eye looking along -dir (plain numbers, also for tests).
  three.shadowFit = function (house, eye, dir) {
    var z = norm(dir), x = cross([0, 1, 0], z);
    x = Math.hypot(x[0], x[1], x[2]) < 1e-6 ? [1, 0, 0] : norm(x);
    var y = cross(z, x), f = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity, near: Infinity, far: -Infinity };
    contentBox(house).forEach(function (p) {
      var r = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], lx = dot(r, x), ly = dot(r, y), d = -dot(r, z);
      f.left = Math.min(f.left, lx); f.right = Math.max(f.right, lx); f.bottom = Math.min(f.bottom, ly); f.top = Math.max(f.top, ly);
      f.near = Math.min(f.near, d); f.far = Math.max(f.far, d);
    });
    var cap = PC.C.VIEW3D.shadowR * house.radius;
    return { left: Math.max(f.left - MARGIN, -cap), right: Math.min(f.right + MARGIN, cap), bottom: Math.max(f.bottom - MARGIN, -cap),
      top: Math.min(f.top + MARGIN, cap), near: Math.max(0.5, f.near - MARGIN), far: f.far + MARGIN, basis: { x: x, y: y, z: z }, corners: contentBox(house) };
  };

  three.applyLook = function (ctx, L) {
    var col = three.col, house = ctx.house, fp = house.footprint, V = PC.C.VIEW3D;
    ctx.hemi.color.copy(col(L.hemiSky)); ctx.hemi.groundColor.copy(col(L.hemiGround)); ctx.hemi.intensity = L.hemiIntensity * PC.gfx.lightK;
    ctx.sun.color.copy(col(L.sunColor)); ctx.sun.intensity = L.sunIntensity * PC.gfx.lightK;
    var tx = fp.u + fp.w / 2 - house.center[0], tz = -(fp.v + fp.d / 2 - house.center[1]), s = L.sunDir, dist = V.sunDist * house.radius;
    var eye = [tx + s[0] * dist, s[1] * dist, tz + s[2] * dist];
    ctx.sun.target.position.set(tx, 0, tz);
    ctx.sun.position.set(eye[0], eye[1], eye[2]);
    var f = three.shadowFit(house, eye, s), c = ctx.sun.shadow.camera;
    c.left = f.left; c.right = f.right; c.top = f.top; c.bottom = f.bottom; c.near = f.near; c.far = f.far;
    c.updateProjectionMatrix();
    ctx.scene.background = new THREE.Color(L.background);
    ctx.mats.ground.color.copy(col(L.groundColor));
    if (L.meadowColor) ctx.mats.groundOuter.color.copy(col(L.meadowColor));
    if (ctx.mats.groundRing) ctx.mats.groundRing.color.copy(col(L.groundColor));
    ctx.mats.canopy.color.copy(col(L.canopyColor));
    ctx.mats.shrub.color.copy(col(L.shrubColor));
    var can = ctx.world.getObjectByName('canopies');
    if (can) can.visible = !!L.canopyVisible;
    var bl = ctx.world.getObjectByName('blobs');   // F6-T1b (Q-T4): winter shows only the shrubs' blobs (a count, no GPU object)
    if (bl) bl.count = L.canopyVisible ? bl.userData.all : bl.userData.shrubs;
    if (ctx.renderer) PC.gfx.exposure(ctx.renderer, L.exposure);
    var sky = ctx.world.getObjectByName('sky');
    if (sky) three.skyPaint(sky.userData.dome, L);
    var fog = ctx.scene.fog, R = house.radius;
    if (fog && ctx.limits) {
      var near = ctx.limits.rMax + R, far = Math.max(near + 1, Math.min(near + V.fogSpanK * R, 0.9 * PC.C.HOUSE.outerK * R / 2));
      fog.color = new THREE.Color(L.skyHorizon); fog.near = near; fog.far = far;
    }
    // F6-T2 N2-N5 (plan 3; CTO 1.2): indoor light as uniforms only. Every emissive intensity = its factor x indoor (0
    // by day), the glow colour = indoor (instances carry pool hex x K), glow shown only when indoor > 0.
    var IN = PC.data.indoor, k = L.indoor || 0, M = ctx.mats;
    if (M.glazing) M.glazing.emissiveIntensity = IN.glazing.k * k;
    if (M.furniture) M.furniture.emissiveIntensity = IN.lift.k * k;
    if (M.interior) M.interior.emissiveIntensity = IN.lift.k * k;
    if (M.lamp) M.lamp.emissiveIntensity = IN.lamp.k * k;
    if (M.glow) { M.glow.color.r = k; M.glow.color.g = k; M.glow.color.b = k; }
    ctx.world.children.forEach(function (g) { g.children.forEach(function (m) { if (m.name.indexOf('glow-') === 0) m.visible = k > 0; }); });
    var outer = ctx.world.getObjectByName('groundOuter'), sk = outer && outer.userData.skirt;
    if (sk) {
      var h = col(L.skyHorizon), m = col(L.meadowColor || PC.data.siteColors.groundOuter), a = sk.colors.array;
      var q = [Math.min(1, h.r / (m.r || 1)), Math.min(1, h.g / (m.g || 1)), Math.min(1, h.b / (m.b || 1))];
      sk.outer.forEach(function (i) { a[i * 3] = q[0]; a[i * 3 + 1] = q[1]; a[i * 3 + 2] = q[2]; });
      sk.colors.needsUpdate = true;
    }
    PC.gfx.look(ctx, L);   // G1: the /gpu page copies fog and exposure into its output-node uniforms
  };
})(globalThis.PC = globalThis.PC || {});
