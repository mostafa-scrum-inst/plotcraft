// QA_GPU image helpers (G1 parity, G2 ultra): the scene as plain data, region means read back from either page, the
// needle close-up, and (G2) ground points around the house, sunlit or in a cast shadow, for the shadow / acne check.
// /gpu reads back through PC.view3d.capture (a render target, converted to sRGB in JS); the standard page reads its
// own WebGL canvas (readPixels). Both pages share pose and size, so pixel positions carry over.

// The scene as plain data: every mesh in world order.
export const meshes = (page) => page.evaluate(() => {
  const out = [];
  PC.debug.scene().world.traverse((m) => {
    if (!m.geometry) return;
    const g = m.geometry, inst = m.isInstancedMesh ? m.count : null;
    out.push([m.name, m.isInstancedMesh ? 'instanced' : 'mesh', g.attributes.position.count, g.index ? g.index.count : 0, inst, m.visible]);
  });
  return out;
});

// Region boxes in canvas pixels (top-left origin), projected with the page's own camera, then the mean colour of each
// box from a full-frame sRGB pixel array. close: only the needle (the close-up pose). pts (G2): [{ px: [x, y] }]
// -> per point the mean colour and the luminance standard deviation of a (2 r + 1)^2 box (r = 3).
export const regions = (page, kind, close, pts) => page.evaluate(async ({ kind, close, pts }) => {
  const i = PC.debug.scene(), W = i.size[0], H = i.size[1], cam = i.camera, h = i.house;
  let px;
  if (kind === 'gpu') {
    const c = await new Promise((r) => PC.view3d.capture(r));
    if (!c) return null;
    px = c.data;
  } else {
    i.renderNow();
    const gl = i.renderer.getContext(), raw = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    px = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) px.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  }
  const at = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  const box = (cx, cy, r) => {
    const s = [0, 0, 0], L = []; let n = 0;
    for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++) for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = (y * W + x) * 4; s[0] += px[k]; s[1] += px[k + 1]; s[2] += px[k + 2]; n++;
      L.push(0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]);
    }
    const m = L.reduce((a, b) => a + b, 0) / Math.max(1, L.length), sd = Math.sqrt(L.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(1, L.length));
    return { mean: s.map((v) => +(v / Math.max(1, n)).toFixed(1)), sd };
  };
  const mean = (cx, cy, r) => box(cx, cy, r).mean;
  if (pts) return pts.map((p) => box(p.px[0], p.px[1], 3));
  const fp = h.footprint, cu = h.center[0], cv = h.center[1], e = cam.position;
  // the exterior wall face that looks most at the camera, its middle at 2 m (ground storey, Roof on)
  const faces = [[fp.u + fp.w / 2, fp.v, 0, 1], [fp.u + fp.w / 2, fp.v + fp.d, 0, -1], [fp.u, fp.v + fp.d / 2, -1, 0], [fp.u + fp.w, fp.v + fp.d / 2, 1, 0]]
    .map(([u, v, nx, nz]) => { const X = u - cu, Z = -(v - cv), n = [nx, -nz], d = [e.x - X, e.z - Z], l = Math.hypot(d[0], d[1]); return { X: X + n[0] * 0.05, Z: Z + n[1] * 0.05, s: (n[0] * d[0] + n[1] * d[1]) / l }; })
    .sort((a, b) => b.s - a.s);
  // the north half of the needle (unlit mats.ui): the centroid of its triangle tipN, east, west (build-site.js); the
  // close-up pose (closeUp below) puts it in the middle of the frame
  const nd = PC.three.needle(h), needle = nd ? at((nd.tipN[0] + nd.east[0] + nd.west[0]) / 3, 0.04, (nd.tipN[1] + nd.east[1] + nd.west[1]) / 3) : null;
  if (close) return { needle: needle ? mean(needle[0], needle[1], 2) : null, needleAt: needle };
  return {
    sky: mean(W / 2, Math.max(4, H * 0.015), 3),
    ground: mean(W * 0.9, H * 0.45, 5),
    wall: mean(...at(faces[0].X, 2, faces[0].Z), 2), side: mean(...at(faces[1].X, 2, faces[1].Z), 2), W, H,
    // G2 acne: the luminance noise of a larger box on the same two (untextured) wall faces
    wallSd: box(...at(faces[0].X, 2, faces[0].Z), 4).sd, sideSd: box(...at(faces[1].X, 2, faces[1].Z), 4).sd
  };
}, { kind, close, pts: pts || null });

// The camera at the closest radius, looking down at the needle's north half (same pose on both pages), or back to the reset view.
export const closeUp = (page, on) => page.evaluate((on) => {
  if (!on) { PC.view3d.resetView(); return; }
  const nd = PC.three.needle(PC.view3d.house()), p = PC.view3d.pose();
  const c = [(nd.tipN[0] + nd.east[0] + nd.west[0]) / 3, 0, (nd.tipN[1] + nd.east[1] + nd.west[1]) / 3];
  PC.view3d.flyTo({ target: c, radius: 0.1, theta: p.theta, phi: 0 }, 1);   // clamped to the closest, steepest pose: from above
}, on);

// G2: ground points on five rings around the footprint (0.5 to 5 m out, 72 per ring), each one visible from the camera
// (the first hit of the eye ray is at the point) and 6 px inside the frame, marked shade when a ray from the point
// towards the sun hits a shadow caster. Computed on one page (raycasting there), used on both (same pose and size).
export const groundPoints = (page) => page.evaluate(() => {
  const i = PC.debug.scene(), h = i.house, fp = h.footprint, cu = h.center[0], cv = h.center[1], cam = i.camera, W = i.size[0], H = i.size[1];
  const sun = i.scene.getObjectByName('sun'), L = sun.position.clone().sub(sun.target.position).normalize();
  i.world.updateMatrixWorld(true);
  const casters = [], all = [];
  i.world.traverse((m) => { if (!m.isMesh || !m.visible || m.name === 'sky') return; all.push(m); if (m.castShadow) casters.push(m); });
  const rc = new THREE.Raycaster(), out = [];
  for (let k = 0; k < 72; k++) {
    const a = k / 72 * 2 * Math.PI;
    for (const off of [0.5, 1, 2, 3.5, 5]) {
      const X = (fp.u + fp.w / 2 - cu) + Math.cos(a) * (fp.w / 2 + off), Z = -((fp.v + fp.d / 2 - cv) + Math.sin(a) * (fp.d / 2 + off));
      const P = new THREE.Vector3(X, 0, Z), up = P.clone(); up.y = 0.05;
      rc.set(cam.position, P.clone().sub(cam.position).normalize()); rc.far = cam.position.distanceTo(P) + 1;
      const first = rc.intersectObjects(all, false)[0];
      if (!first || first.point.distanceTo(P) > 0.3) continue;   // hidden behind something
      P.copy(first.point);
      // shade or lit at the point and 0.3 m around it (away from a penumbra), else skipped
      const hits = [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].map(([dx, dz]) => {
        rc.set(new THREE.Vector3(P.x + dx, P.y, P.z + dz).addScaledVector(L, 0.05), L); rc.far = 500;
        return rc.intersectObjects(casters, false).length > 0;
      });
      if (hits.some((x) => x !== hits[0])) continue;
      const shade = hits[0];
      const v = P.clone().project(cam), px = [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H];
      if (px[0] < 6 || px[1] < 6 || px[0] > W - 6 || px[1] > H - 6) continue;
      out.push({ px, shade, X: +P.x.toFixed(2), Z: +P.z.toFixed(2) });
    }
  }
  return out;
});
