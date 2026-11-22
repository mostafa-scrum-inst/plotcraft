// Screen projection of a world point (frame T) for the app's camera, as r128's PerspectiveCamera.updateProjectionMatrix
// + Vector3.project compute it, including setViewOffset (F5-T3a lens shift, A-12): pure and self-contained (no closures)
// so view3d-real can ship its source into the page and check it against real r128 (conformance).
//   eye, target: [x, y, z]; fov: vertical degrees; W, H: canvas CSS px; view: the 6 setViewOffset arguments or null;
//   p: the point. Returns [x, y] in canvas px (y down) and the view depth z (> 0 in front of the camera).
export function projectPx(eye, target, fov, W, H, view, p) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const f = nrm(sub(target, eye)), r = nrm(cross(f, [0, 1, 0])), u = cross(r, f), d = sub(p, eye);
  const xc = dot(d, r), yc = dot(d, u), z = dot(d, f);
  // the near-plane window at distance 1 (the scale cancels)
  const fw = view ? view[0] : W, fh = view ? view[1] : H, aspect = fw / fh;
  let top = Math.tan(fov / 2 * Math.PI / 180), height = 2 * top, width = aspect * height, left = -0.5 * width;
  if (view) { left += view[2] * width / fw; top -= view[3] * height / fh; width *= view[4] / fw; height *= view[5] / fh; }
  const xn = xc / z, yn = yc / z;
  return [(xn - left) / width * W, (top - yn) / height * H, z];
}
