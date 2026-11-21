// The strict THREE mock's own tests (F4-T1 plan §1.4): it rejects what A-10 does not allow, accepts every whitelisted
// member, enforces the five call signatures and the colour audit, and computes real maths.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMock } from '../helpers/load3d.mjs';
import { FACTORIES, MATHS } from '../helpers/three-factories.mjs';

const fresh = () => loadMock();
const throwsMock = (fn, re, msg) => assert.throws(fn, (e) => /THREE mock/.test(e.message) && (!re || re.test(e.message)), msg);

test('every whitelist row has a factory and every listed member is readable', () => {
  const { THREE, mock } = fresh();
  assert.deepEqual(Object.keys(mock.WHITELIST).sort(), Object.keys(FACTORIES).sort());
  for (const [row, members] of Object.entries(mock.WHITELIST)) {
    const o = FACTORIES[row](THREE, {});
    for (const m of members) { assert.ok(m in o, `${row}.${m} in`); assert.doesNotThrow(() => o[m], `${row}.${m}`); }
  }
});

test('unknown members throw on read and write: namespace, instances, nested objects', () => {
  const { THREE } = fresh();
  throwsMock(() => THREE.Geometry, /THREE\.Geometry/);
  throwsMock(() => THREE.VertexColors);
  throwsMock(() => THREE.WebGLRenderTarget);
  throwsMock(() => THREE.OrbitControls);
  const r = new THREE.WebGLRenderer({ canvas: {} });
  throwsMock(() => r.outputColorSpace);
  throwsMock(() => { r.outputColorSpace = 'srgb'; });
  throwsMock(() => r.getPixelRatio);
  throwsMock(() => r.info);
  throwsMock(() => r.shadowMap.autoUpdate);
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  throwsMock(() => m.geometry.attributes);
  throwsMock(() => m.geometry.computeBoundingSphere);
  throwsMock(() => m.material.needsUpdate);
  throwsMock(() => m.rotation.order);
  throwsMock(() => m.rotation.set);
  throwsMock(() => m.updateMatrixWorld);
  const l = new THREE.DirectionalLight(0xffffff, 1);
  throwsMock(() => l.shadow.radius);
  throwsMock(() => l.shadow.camera.zoom);
  throwsMock(() => new THREE.Vector3().distanceToSquared);
  throwsMock(() => new THREE.Color().getHex);
});

test('runtime probes then / toJSON read as undefined, but writing them throws', async () => {
  const { THREE } = fresh();
  const v = new THREE.Vector3(1, 2, 3);
  assert.equal(v.then, undefined);
  assert.equal(v.toJSON, undefined);
  const got = await Promise.resolve(v);           // a mock object can be returned from a promise
  assert.equal(got.x, 1);
  throwsMock(() => { v.then = 1; });
  throwsMock(() => { v.toJSON = 1; });
});

test('read-only r128 members and type checks on writes', () => {
  const { THREE } = fresh();
  const o = new THREE.Object3D();
  throwsMock(() => { o.position = new THREE.Vector3(); }, /read-only/);
  throwsMock(() => { o.rotation = 1; }, /read-only/);
  throwsMock(() => { o.visible = 0; }, /boolean/);
  throwsMock(() => { o.add = null; }, /method/);
  o.rotation.x = -Math.PI / 2; assert.equal(o.rotation.x, -Math.PI / 2);
  throwsMock(() => o.add({}), /Object3D/);
});

test('constructor option keys: unknown keys and THREE.VertexColors-style values throw', () => {
  const { THREE } = fresh();
  throwsMock(() => new THREE.WebGLRenderer({ canvas: {}, alpha: true }), /alpha/);
  throwsMock(() => new THREE.WebGLRenderer({ powerPreference: 'low-power' }));
  throwsMock(() => new THREE.MeshLambertMaterial({ vertexColors: 2 }), /boolean/);
  throwsMock(() => new THREE.MeshLambertMaterial({ map: null }), /map/);
  throwsMock(() => new THREE.MeshBasicMaterial({ color: '#FFFFFF' }), /Color/);
  throwsMock(() => new THREE.MeshBasicMaterial({ side: 7 }), /side/);
  assert.doesNotThrow(() => new THREE.MeshLambertMaterial({ vertexColors: true }));
  assert.doesNotThrow(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFFFFF').convertSRGBToLinear(), transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
});

test('the five A-10 call signatures', () => {
  const { THREE } = fresh();
  throwsMock(() => new THREE.Matrix4().makeTranslation(new THREE.Vector3(1, 2, 3)), /makeTranslation/);
  throwsMock(() => new THREE.Matrix4().makeTranslation(1, 2), /makeTranslation/);
  assert.doesNotThrow(() => new THREE.Matrix4().makeTranslation(1, 2, 3));
  const g = new THREE.BoxGeometry(1, 1, 1), m = new THREE.MeshBasicMaterial();
  throwsMock(() => new THREE.InstancedMesh(g, m), /InstancedMesh/);
  throwsMock(() => new THREE.InstancedMesh(g, m, 0), /InstancedMesh/);
  throwsMock(() => new THREE.InstancedMesh({}, m, 3));
  assert.doesNotThrow(() => new THREE.InstancedMesh(g, m, 3));
  const p = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)];
  throwsMock(() => new THREE.CatmullRomCurve3([p[0]]), /2 or more/);
  throwsMock(() => new THREE.CatmullRomCurve3([[0, 0, 0], [1, 0, 0]]));
  throwsMock(() => new THREE.CatmullRomCurve3(p, 'no'), /closed/);
  throwsMock(() => new THREE.CatmullRomCurve3(p, false, 'bezier'), /curveType/);
  assert.doesNotThrow(() => new THREE.CatmullRomCurve3(p, false, 'centripetal'));
  throwsMock(() => new THREE.Float32BufferAttribute([1, 2, 3], 2), /itemSize/);
  throwsMock(() => new THREE.Float32BufferAttribute([1, 2, 3]), /two arguments/);
  throwsMock(() => new THREE.Float32BufferAttribute([1, 2, 3], 3, false), /two arguments/);
  assert.doesNotThrow(() => new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  const r = new THREE.WebGLRenderer({ canvas: {} });
  throwsMock(() => r.setSize(100, 100), /setSize/);
  throwsMock(() => r.setSize(100, 100, 'no'), /setSize/);
  throwsMock(() => r.setSize(0, 100, false), /setSize/);
  assert.doesNotThrow(() => r.setSize(100, 100, false));
});

test('Mesh arity, geometry attributes and index range', () => {
  const { THREE } = fresh();
  throwsMock(() => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), /both/);
  throwsMock(() => new THREE.Mesh({}, new THREE.MeshBasicMaterial()), /geometry/);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  throwsMock(() => g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0], 3)), /count/);
  throwsMock(() => g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2)), /uv/);
  throwsMock(() => g.setIndex([0, 1, 3]), /range/);
  throwsMock(() => g.setIndex(new Uint16Array([0, 1, 2])), /plain array/);
  assert.doesNotThrow(() => g.setIndex([0, 1, 2]));
});

test('render-time colour audit (A-10): linear materials and lights, raw background; default white exempt', () => {
  const { THREE, mock } = fresh();
  const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
  const setup = () => {
    const r = new THREE.WebGLRenderer({ canvas: {} }), s = new THREE.Scene(), c = new THREE.PerspectiveCamera(45, 1, 0.5, 100);
    return { r, s, c };
  };
  let { r, s, c } = setup();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: lin('#D9C7A3') })));
  s.add(new THREE.HemisphereLight(lin('#D6E6F5'), lin('#8F8672'), 0.48));
  s.background = new THREE.Color('#8EC3EA');
  assert.doesNotThrow(() => r.render(s, c));
  assert.equal(mock.raw(r).renders, 1);
  // untouched default material colour (vertexColors batches) counts as converted
  ({ r, s, c } = setup());
  s.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ vertexColors: true })));
  assert.doesNotThrow(() => r.render(s, c), 'default white exempt');
  // ...but a raw colour set onto it clears the flag
  const m = new THREE.MeshLambertMaterial({ vertexColors: true }); m.color.set('#FFFFFF');
  ({ r, s, c } = setup()); s.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m));
  throwsMock(() => r.render(s, c), /PC\.three\.col/);
  const m2 = new THREE.MeshLambertMaterial(); m2.color.copy(new THREE.Color(0x336699));
  ({ r, s, c } = setup()); s.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m2));
  throwsMock(() => r.render(s, c), /PC\.three\.col/);
  // raw material colour
  ({ r, s, c } = setup()); s.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x336699) })));
  throwsMock(() => r.render(s, c), /PC\.three\.col/);
  // raw light colour, raw hemisphere ground colour
  ({ r, s, c } = setup()); s.add(new THREE.DirectionalLight(0xffeedd, 1));
  throwsMock(() => r.render(s, c), /light/);
  ({ r, s, c } = setup()); s.add(new THREE.HemisphereLight(lin('#FFFFFF'), 0x223344, 1));
  throwsMock(() => r.render(s, c), /ground/);
  // converted background
  ({ r, s, c } = setup()); s.background = lin('#8EC3EA');
  throwsMock(() => r.render(s, c), /background/);
  throwsMock(() => { s.background = '#8EC3EA'; }, /Color/);
  // lerp keeps the flag only when both are linear
  const a = lin('#000000'); a.lerp(new THREE.Color('#FFFFFF'), 0.5);
  ({ r, s, c } = setup()); s.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: a })));
  throwsMock(() => r.render(s, c));
});

test('render needs a Scene and a PerspectiveCamera; failRenderer makes the constructor throw like r128 without WebGL', () => {
  const { THREE, mock } = fresh();
  const r = new THREE.WebGLRenderer({ canvas: {} });
  throwsMock(() => r.render(new THREE.Group(), new THREE.PerspectiveCamera()), /Scene/);
  throwsMock(() => r.render(new THREE.Scene(), new THREE.Object3D()), /PerspectiveCamera/);
  throwsMock(() => { r.outputEncoding = 1; }, /encoding/);
  mock.failRenderer = true;
  assert.throws(() => new THREE.WebGLRenderer({ canvas: {} }), /WebGL context/);
  assert.throws(() => THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()), /new/);
});

test('scene graph: add / remove / traverse / getObjectByName, re-parenting', () => {
  const { THREE } = fresh();
  const s = new THREE.Scene(), a = new THREE.Group(), b = new THREE.Group();
  a.name = 'a'; b.name = 'b'; s.add(a); a.add(b);
  assert.equal(b.parent, a); assert.equal(s.getObjectByName('b'), b);
  const names = []; s.traverse((n) => names.push(n.name)); assert.deepEqual(names, ['', 'a', 'b']);
  s.add(b); assert.equal(a.children.length, 0); assert.equal(b.parent, s);
  s.remove(b); assert.equal(b.parent, null); assert.equal(s.getObjectByName('b'), undefined);
});

test('maths: sRGB -> linear, compose, setFromAxisAngle, Vector3, Catmull-Rom (r128 values)', () => {
  const { THREE, mock } = fresh();
  assert.ok(Math.abs(new THREE.Color('#808080').convertSRGBToLinear().r - 0.2158605) < 1e-6);
  assert.equal(new THREE.Color(0x000000).convertSRGBToLinear().r, 0);
  assert.equal(new THREE.Color('#FFFFFF').convertSRGBToLinear().g, 1);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(1, 2, 3), q, new THREE.Vector3(2, 2, 2));
  const e = [...mock.raw(m).elements].map((x) => Math.round(x * 1e9) / 1e9 + 0);
  assert.deepEqual(e, [0, 0, -2, 0, 0, 2, 0, 0, 2, 0, 0, 0, 1, 2, 3, 1]);
  const v = new THREE.Vector3(3, 4, 0);
  assert.equal(v.length(), 5); assert.ok(Math.abs(v.clone().normalize().x - 0.6) < 1e-12);
  assert.equal(v.distanceTo(new THREE.Vector3(0, 0, 0)), 5);
  assert.equal(v.add(new THREE.Vector3(1, 1, 1)), v, 'chaining returns the proxy');
  const pts = [[0, 0, 0], [4, 0, 0], [4, 0, 4], [8, 2, 4]].map((p) => new THREE.Vector3(...p));
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const p0 = c.getPoint(0), p1 = c.getPoint(1);
  assert.deepEqual([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z], [0, 0, 0, 8, 2, 4]);
  const mid = c.getPointAt(0.5); assert.ok(mid.x > 2 && mid.x < 6);
  c.arcLengthDivisions = 40; c.updateArcLengths();
  const len = c.getLength(); assert.ok(len > 12.47 && len < 14, String(len));   // at least the polyline 4 + 4 + sqrt(20)
});

test('recording: created geometries / materials and dispose counts', () => {
  const { THREE, mock } = fresh();
  const g = new THREE.BoxGeometry(1, 2, 3), m = new THREE.MeshLambertMaterial();
  g.dispose(); m.dispose(); m.dispose();
  assert.equal(mock.created.geometries.length, 1); assert.equal(mock.raw(g).disposed, 1); assert.equal(mock.raw(m).disposed, 2);
  assert.deepEqual([...mock.raw(g).params], [1, 2, 3]);
});

test('maths probe used by the real-r128 conformance check runs on the mock', () => {
  const { THREE, mock } = fresh();
  const out = MATHS(THREE, mock.raw);
  assert.ok(out.length > 100 && out.every((x) => Number.isFinite(x)));
});
