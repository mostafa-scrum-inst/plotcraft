// Shared by tests/three/mock.test.mjs (on the mock) and tests/e2e/view3d-real.spec.mjs (on real r128 in the page):
// - FACTORIES: one minimal instance per WHITELIST row of tests/three-mock.js; (T, canvas) => instance.
// - MATHS: a fixed probe of the mock's maths classes; (T, raw) => flat number list. raw unwraps a mock object
//   (identity on real r128) so the probe can read Matrix4.elements, which is not on the app whitelist.
// Both are self-contained (no closures) because the spec ships their source text into the page.
// Minimal instance per whitelist row (the same factories as the real-r128 conformance check in view3d-real.spec).
export const FACTORIES = {
  THREE: (T) => T,
  WebGLRenderer: (T, canvas) => new T.WebGLRenderer({ canvas, antialias: true }),
  'WebGLRenderer.shadowMap': (T, canvas) => new T.WebGLRenderer({ canvas }).shadowMap,
  'WebGLRenderer.capabilities': (T, canvas) => new T.WebGLRenderer({ canvas }).capabilities,
  DataTexture: (T) => new T.DataTexture(new Uint8Array(4), 1, 1, T.RGBAFormat),
  Fog: (T) => new T.Fog(new T.Color(0xffffff), 1, 2),
  Object3D: (T) => new T.Object3D(),
  Scene: (T) => new T.Scene(),
  Group: (T) => new T.Group(),
  Mesh: (T) => new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial()),
  InstancedMesh: (T) => new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), 2),
  'InstancedMesh.instanceMatrix': (T) => new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), 2).instanceMatrix,
  PerspectiveCamera: (T) => new T.PerspectiveCamera(45, 1, 0.5, 100),
  DirectionalLight: (T) => new T.DirectionalLight(0xffffff, 1),
  'DirectionalLight.shadow': (T) => new T.DirectionalLight(0xffffff, 1).shadow,
  'DirectionalLight.shadow.camera': (T) => new T.DirectionalLight(0xffffff, 1).shadow.camera,
  HemisphereLight: (T) => new T.HemisphereLight(0xffffff, 0x000000, 1),
  BufferGeometry: (T) => new T.BufferGeometry(),
  BoxGeometry: (T) => new T.BoxGeometry(1, 1, 1),
  PlaneGeometry: (T) => new T.PlaneGeometry(1, 1),
  CylinderGeometry: (T) => new T.CylinderGeometry(1, 1, 1, 6),
  ConeGeometry: (T) => new T.ConeGeometry(1, 1, 6),
  ShapeGeometry: (T) => { const s = new T.Shape(); s.moveTo(0, 0); s.lineTo(1, 0); s.lineTo(0, 1); return new T.ShapeGeometry(s); },
  Float32BufferAttribute: (T) => new T.Float32BufferAttribute([0, 0, 0], 3),
  Shape: (T) => new T.Shape(),
  Path: (T) => new T.Path(),
  MeshLambertMaterial: (T) => new T.MeshLambertMaterial(),
  MeshBasicMaterial: (T) => new T.MeshBasicMaterial(),
  Vector2: (T) => new T.Vector2(1, 2),
  Vector3: (T) => new T.Vector3(1, 2, 3),
  Euler: (T) => new T.Object3D().rotation,
  Color: (T) => new T.Color(0x808080),
  Matrix4: (T) => new T.Matrix4(),
  Quaternion: (T) => new T.Quaternion(),
  CatmullRomCurve3: (T) => new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(1, 0, 0)], false, 'centripetal')
};


export function MATHS(T, raw) {
  const out = [];
  for (const h of ['#000000', '#0A0A0A', '#808080', '#D9C7A3', '#23292F', '#8EC3EA', '#FFFFFF']) {
    const c = new T.Color(h).convertSRGBToLinear(); out.push(c.r, c.g, c.b);
    const d = new T.Color(h).lerp(new T.Color('#3366CC'), 0.3); out.push(d.r, d.g, d.b);
  }
  const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0.6, 0, 0.8), 1.1);
  const m = new T.Matrix4().compose(new T.Vector3(1, -2, 3), q, new T.Vector3(1.5, 0.5, 2));
  out.push(...Array.from(raw(m).elements));
  out.push(...Array.from(raw(new T.Matrix4().makeTranslation(4, 5, -6)).elements));
  const v = new T.Vector3(1, 2, 2).lerp(new T.Vector3(-3, 0, 5), 0.25); out.push(v.x, v.y, v.z, v.length(), v.clone().normalize().z, v.distanceTo(new T.Vector3(9, 9, 9)));
  const pts = [[0, 1.5, 0], [6, 3, -2], [6, 3.5, 8], [-4, 2, 9], [-5, 4, 0]];
  for (const [closed, type] of [[false, 'centripetal'], [false, 'chordal'], [false, 'catmullrom'], [true, 'centripetal']]) {
    const c = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], p[2])), closed, type);
    c.arcLengthDivisions = 60;
    out.push(c.getLength());
    for (let i = 0; i <= 10; i++) { const a = c.getPoint(i / 10), b = c.getPointAt(i / 10); out.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  }
  const two = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(3, 1, 0)], false, 'centripetal');
  for (let i = 0; i <= 4; i++) { const a = two.getPointAt(i / 4); out.push(a.x, a.y, a.z); }
  return out;
}
