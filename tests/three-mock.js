/* Strict THREE r128 mock (A-16, F4-T1). UMD: module.exports in node, globalThis.THREE in a page or vm context.
   - Only the A-10 surface exists (WHITELIST below). Every instance, nested object and the namespace are Proxies
     that throw on reading or writing any other string key. Symbol keys pass; reads of `then` / `toJSON` (runtime
     probes, never app code) give undefined. Constructors throw on unknown option keys.
   - The five A-10 call signatures are enforced (makeTranslation, InstancedMesh, CatmullRomCurve3,
     Float32BufferAttribute, setSize), plus the TL-approved strictness: render-time colour audit (material / light
     colours must come from convertSRGBToLinear or be a material's untouched default white; scene.background must
     be raw), Mesh arity, material colour must be a Color, attribute names / equal counts, index range.
   - Maths is real (Vector3, Color sRGB->linear, Matrix4.compose, Quaternion.setFromAxisAngle, CatmullRomCurve3
     ported from r128) and checked against real r128 by tests/e2e/view3d-real.spec.mjs.
   - Test-only side channel: globalThis.__threeMock { raw, created, failRenderer, WHITELIST, reset }. App code
     must never name it (lint rule mock-backdoor). */
(function (root) {
  'use strict';
  var O3D = ['position', 'rotation', 'quaternion', 'scale', 'visible', 'name', 'userData', 'parent', 'add', 'remove',
    'children', 'traverse', 'getObjectByName', 'castShadow', 'receiveShadow', 'frustumCulled', 'renderOrder', 'lookAt',
    'updateMatrix', 'matrix'];
  var GEO = ['setAttribute', 'setIndex', 'computeVertexNormals', 'dispose'];
  var MAT = ['color', 'vertexColors', 'transparent', 'opacity', 'side', 'dispose', 'map', 'toneMapped', 'fog', 'depthWrite',   // F6-T1a: map .. depthWrite
    'blending'];   // F6-T2 (CTO 1.2d): additive glow
  var LAMBERT = MAT.concat(['emissive', 'emissiveIntensity']);   // F6-T2 (CTO 1.2): emissive colour + intensity (never an emissiveMap)
  var TEX = ['wrapS', 'wrapT', 'repeat', 'encoding', 'magFilter', 'minFilter', 'generateMipmaps', 'anisotropy', 'needsUpdate', 'dispose'];
  var WHITELIST = {
    THREE: ['REVISION', 'WebGLRenderer', 'Scene', 'Group', 'Object3D', 'Mesh', 'InstancedMesh', 'PerspectiveCamera',
      'DirectionalLight', 'HemisphereLight', 'BufferGeometry', 'Float32BufferAttribute', 'BoxGeometry', 'PlaneGeometry',
      'CylinderGeometry', 'ConeGeometry', 'Shape', 'Path', 'ShapeGeometry', 'MeshLambertMaterial', 'MeshBasicMaterial',
      'Vector2', 'Vector3', 'Color', 'Matrix4', 'Quaternion', 'CatmullRomCurve3', 'sRGBEncoding', 'PCFSoftShadowMap',
      'DoubleSide',
      // F6-T2 (CTO 1.2d): the glow pools blend additively
      'AdditiveBlending', 'NormalBlending',
      // F6-T1a (TL plan review: every row approved; conformance-checked on real r128 in view3d-real)
      'ACESFilmicToneMapping', 'LinearEncoding', 'RGBAFormat', 'RepeatWrapping', 'LinearFilter', 'LinearMipmapLinearFilter',
      'DataTexture', 'Fog',
      // F6-T1b (plan 6.2 / 6.3): the blob texture clamps
      'ClampToEdgeWrapping'],
    WebGLRenderer: ['setPixelRatio', 'setSize', 'render', 'dispose', 'shadowMap', 'outputEncoding', 'domElement',
      'toneMapping', 'toneMappingExposure', 'capabilities', 'compile', 'setScissor', 'setScissorTest', 'initTexture'],   // F6-T2: compile (the build precompiles the night-only programs)
    'WebGLRenderer.shadowMap': ['enabled', 'type', 'autoUpdate', 'needsUpdate'],   // F6-T1a: on-demand shadow map
    'WebGLRenderer.capabilities': ['maxTextureSize', 'getMaxAnisotropy'],
    DataTexture: TEX,
    Fog: ['color', 'near', 'far'],
    Object3D: O3D,
    Scene: O3D.concat(['background', 'fog']),
    Group: O3D,
    Mesh: O3D.concat(['geometry', 'material']),
    InstancedMesh: O3D.concat(['geometry', 'material', 'setMatrixAt', 'instanceMatrix', 'count', 'setColorAt', 'instanceColor']),
    'InstancedMesh.instanceMatrix': ['needsUpdate'],
    'InstancedMesh.instanceColor': ['needsUpdate'],   // F6-T1b: per-instance colour variation (setColorAt(i, Color))
    PerspectiveCamera: O3D.concat(['fov', 'aspect', 'near', 'far', 'updateProjectionMatrix', 'setViewOffset', 'clearViewOffset']),
    DirectionalLight: O3D.concat(['color', 'intensity', 'target', 'shadow']),
    'DirectionalLight.shadow': ['mapSize', 'camera', 'bias', 'normalBias'],
    'DirectionalLight.shadow.camera': ['left', 'right', 'top', 'bottom', 'near', 'far', 'updateProjectionMatrix'],
    HemisphereLight: O3D.concat(['color', 'groundColor', 'intensity']),
    BufferGeometry: GEO, BoxGeometry: GEO, PlaneGeometry: GEO, CylinderGeometry: GEO, ConeGeometry: GEO, ShapeGeometry: GEO,
    Float32BufferAttribute: ['array', 'needsUpdate'],
    Shape: ['moveTo', 'lineTo', 'closePath', 'holes'],
    Path: ['moveTo', 'lineTo', 'closePath'],
    MeshLambertMaterial: LAMBERT, MeshBasicMaterial: MAT,
    Vector2: ['x', 'y', 'set'],
    Vector3: ['x', 'y', 'z', 'set', 'copy', 'clone', 'add', 'sub', 'multiplyScalar', 'normalize', 'length', 'distanceTo', 'lerp'],
    Euler: ['x', 'y', 'z'],
    Color: ['r', 'g', 'b', 'set', 'setHex', 'copy', 'clone', 'lerp', 'convertSRGBToLinear'],
    Matrix4: ['compose', 'makeTranslation', 'identity'],
    Quaternion: ['identity', 'setFromAxisAngle'],
    CatmullRomCurve3: ['points', 'getPoint', 'getPointAt', 'getLength', 'arcLengthDivisions', 'updateArcLengths']
  };
  var SETS = {};
  Object.keys(WHITELIST).forEach(function (k) { SETS[k] = new Set(WHITELIST[k]); });
  var READONLY = new Set(['position', 'rotation', 'quaternion', 'scale']);   // r128 defines these non-writable
  var BOOL = new Set(['visible', 'castShadow', 'receiveShadow', 'frustumCulled', 'transparent', 'enabled', 'needsUpdate',
    'toneMapped', 'depthWrite', 'generateMipmaps', 'autoUpdate']);   // Material.fog is checked by the material (Scene.fog is a Fog)

  var RAW = new WeakMap(), PROX = new WeakMap();
  function fail(msg) { throw new TypeError('THREE mock: ' + msg); }
  function raw(x) { return (x && typeof x === 'object' && RAW.has(x)) ? RAW.get(x) : x; }
  function kind(x) { var r = raw(x); return r && r.__kind; }
  function is(x, k) { var r = raw(x); return !!r && !!r.__is && r.__is.indexOf(k) >= 0; }
  function num(x) { return typeof x === 'number' && isFinite(x); }
  function wrap(target, wl) {
    if (PROX.has(target)) return PROX.get(target);
    var set = SETS[wl];
    var p = new Proxy(target, {
      get: function (t, k) {
        if (typeof k === 'symbol') return t[k];
        if (!set.has(k)) {
          if (k === 'then' || k === 'toJSON') return undefined;
          fail(wl + '.' + k + ' is not in the A-10 whitelist');
        }
        var v = t[k];
        if (typeof v === 'function' && !(v.prototype && v.__ctor)) {
          return function () { var r = v.apply(t, arguments); return r === t ? p : r; };
        }
        return v;
      },
      set: function (t, k, v) {
        if (typeof k === 'symbol') { t[k] = v; return true; }
        if (!set.has(k)) fail('writing ' + wl + '.' + k + ' (not in the A-10 whitelist)');
        if (READONLY.has(k)) fail(wl + '.' + k + ' is read-only in r128');
        if (typeof t[k] === 'function') fail(wl + '.' + k + ' is a method');
        if (BOOL.has(k) && typeof v !== 'boolean') fail(wl + '.' + k + ' must be a boolean');
        if (t.__setter) t.__setter(k, v);
        t[k] = v;
        return true;
      },
      has: function (t, k) { return typeof k === 'symbol' ? k in t : set.has(k); },
      deleteProperty: function (t, k) { fail('deleting ' + wl + '.' + String(k)); }
    });
    RAW.set(p, target); PROX.set(target, p);
    return p;
  }
  function hide(o, k, v) { Object.defineProperty(o, k, { value: v, writable: true, enumerable: false }); }
  function base(o, k, isList) { hide(o, '__kind', k); hide(o, '__is', isList || [k]); return o; }
  function opts(o, allowed, cls) {
    if (o === undefined) return {};
    if (!o || typeof o !== 'object') fail(cls + ' options must be an object');
    Object.keys(o).forEach(function (k) { if (allowed.indexOf(k) < 0) fail(cls + ' option "' + k + '" is not allowed'); });
    return o;
  }

  var M = {
    WHITELIST: WHITELIST, raw: raw, failRenderer: false,
    created: { geometries: [], materials: [], renderers: [], textures: [] },
    // F6-T1a: the capabilities a new renderer reports (SwiftShader values by default; tests may change them)
    caps: { maxTextureSize: 8192, maxAnisotropy: 16 },
    reset: function () {
      M.created.geometries.length = 0; M.created.materials.length = 0; M.created.renderers.length = 0; M.created.textures.length = 0;
      M.failRenderer = false; M.caps = { maxTextureSize: 8192, maxAnisotropy: 16 };
    }
  };

  /* ---------------- maths ---------------- */
  function V2(x, y) { var o = base({ x: num(x) ? x : 0, y: num(y) ? y : 0 }, 'Vector2'); o.set = function (a, b) { if (!num(a) || !num(b)) fail('Vector2.set(x, y) needs two numbers'); this.x = a; this.y = b; return this; }; return wrap(o, 'Vector2'); }
  function V3(x, y, z) { var o = base({ x: x || 0, y: y || 0, z: z || 0 }, 'Vector3'); Object.assign(o, V3P); return wrap(o, 'Vector3'); }
  function v3arg(v, where) { var r = raw(v); if (!r || r.__kind !== 'Vector3') fail(where + ' needs a Vector3'); return r; }
  var V3P = {
    set: function (x, y, z) { if (!num(x) || !num(y) || !num(z)) fail('Vector3.set(x, y, z) needs three numbers'); this.x = x; this.y = y; this.z = z; return this; },
    copy: function (v) { v = v3arg(v, 'Vector3.copy'); this.x = v.x; this.y = v.y; this.z = v.z; return this; },
    clone: function () { return V3(this.x, this.y, this.z); },
    add: function (v) { if (arguments.length !== 1) fail('Vector3.add(v) takes one vector'); v = v3arg(v, 'Vector3.add'); this.x += v.x; this.y += v.y; this.z += v.z; return this; },
    sub: function (v) { if (arguments.length !== 1) fail('Vector3.sub(v) takes one vector'); v = v3arg(v, 'Vector3.sub'); this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; },
    multiplyScalar: function (s) { if (!num(s)) fail('multiplyScalar needs a number'); this.x *= s; this.y *= s; this.z *= s; return this; },
    length: function () { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); },
    normalize: function () { var l = this.length() || 1; return this.multiplyScalar(1 / l); },
    distanceTo: function (v) { return Math.sqrt(dist2(this, v3arg(v, 'distanceTo'))); },
    lerp: function (v, a) { v = v3arg(v, 'Vector3.lerp'); this.x += (v.x - this.x) * a; this.y += (v.y - this.y) * a; this.z += (v.z - this.z) * a; return this; }
  };
  function dist2(a, b) { var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return dx * dx + dy * dy + dz * dz; }

  function Euler() { return wrap(base({ x: 0, y: 0, z: 0 }, 'Euler'), 'Euler'); }
  function Quat() {
    var o = base({}, 'Quaternion'); hide(o, '_x', 0); hide(o, '_y', 0); hide(o, '_z', 0); hide(o, '_w', 1); hide(o, 'touched', false);
    o.identity = function () { this._x = this._y = this._z = 0; this._w = 1; this.touched = true; return this; };
    o.setFromAxisAngle = function (axis, angle) {
      var a = v3arg(axis, 'setFromAxisAngle'); if (!num(angle)) fail('setFromAxisAngle(axis, angle)');
      var s = Math.sin(angle / 2); this._x = a.x * s; this._y = a.y * s; this._z = a.z * s; this._w = Math.cos(angle / 2); this.touched = true; return this;
    };
    return wrap(o, 'Quaternion');
  }
  function M4() {
    var o = base({}, 'Matrix4'); hide(o, 'elements', [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    o.identity = function () { this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; return this; };
    o.makeTranslation = function (x, y, z) {
      if (arguments.length !== 3 || !num(x) || !num(y) || !num(z)) fail('Matrix4.makeTranslation(x, y, z) takes three numbers');
      this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; return this;
    };
    o.compose = function (pos, q, sc) {
      var p = v3arg(pos, 'compose'), s = v3arg(sc, 'compose'), r = raw(q);
      if (!r || r.__kind !== 'Quaternion') fail('Matrix4.compose(position, quaternion, scale)');
      composeInto(this.elements, p, r, s); return this;
    };
    return wrap(o, 'Matrix4');
  }
  function composeInto(te, p, q, s) {
    var x = q._x, y = q._y, z = q._z, w = q._w, x2 = x + x, y2 = y + y, z2 = z + z;
    var xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    te[0] = (1 - (yy + zz)) * s.x; te[1] = (xy + wz) * s.x; te[2] = (xz - wy) * s.x; te[3] = 0;
    te[4] = (xy - wz) * s.y; te[5] = (1 - (xx + zz)) * s.y; te[6] = (yz + wx) * s.y; te[7] = 0;
    te[8] = (xz + wy) * s.z; te[9] = (yz - wx) * s.z; te[10] = (1 - (xx + yy)) * s.z; te[11] = 0;
    te[12] = p.x; te[13] = p.y; te[14] = p.z; te[15] = 1;
  }
  function eulerQuat(e) {   // XYZ order, as r128 Quaternion.setFromEuler
    var c1 = Math.cos(e.x / 2), c2 = Math.cos(e.y / 2), c3 = Math.cos(e.z / 2), s1 = Math.sin(e.x / 2), s2 = Math.sin(e.y / 2), s3 = Math.sin(e.z / 2);
    return { _x: s1 * c2 * c3 + c1 * s2 * s3, _y: c1 * s2 * c3 - s1 * c2 * s3, _z: c1 * c2 * s3 + s1 * s2 * c3, _w: c1 * c2 * c3 - s1 * s2 * s3 };
  }

  function SRGBToLinear(c) { return (c < 0.04045) ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4); }
  function parseCol(v, where) {
    if (typeof v === 'number' && isFinite(v)) { var h = Math.floor(v); return [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]; }
    if (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)) return parseCol(parseInt(v.slice(1), 16), where);
    fail(where + ' needs a hex number or "#RRGGBB" (got ' + JSON.stringify(v) + ')');
  }
  // flags: lin = produced by convertSRGBToLinear; dflt = a material's default colour, never set (white, the same in both spaces)
  function Col(v, dflt) {
    var o = base({ r: 1, g: 1, b: 1 }, 'Color'); hide(o, 'lin', false); hide(o, 'dflt', !!dflt);
    Object.assign(o, ColP);
    if (v !== undefined) o.set(v);
    o.dflt = !!dflt;
    return wrap(o, 'Color');
  }
  var ColP = {
    set: function (v) {
      var r = raw(v);
      if (r && r.__kind === 'Color') return this.copy(v);
      var c = parseCol(v, 'Color.set'); this.r = c[0]; this.g = c[1]; this.b = c[2]; this.lin = false; this.dflt = false; return this;
    },
    setHex: function (h) { if (typeof h !== 'number') fail('Color.setHex needs a number'); return this.set(h); },
    copy: function (c) { c = raw(c); if (!c || c.__kind !== 'Color') fail('Color.copy needs a Color'); this.r = c.r; this.g = c.g; this.b = c.b; this.lin = c.lin; this.dflt = c.dflt; return this; },
    clone: function () { var n = Col(); raw(n).copy(PROX.get(this)); return n; },
    lerp: function (c, a) { c = raw(c); if (!c || c.__kind !== 'Color') fail('Color.lerp needs a Color'); this.r += (c.r - this.r) * a; this.g += (c.g - this.g) * a; this.b += (c.b - this.b) * a; this.lin = this.lin && c.lin; this.dflt = false; return this; },
    convertSRGBToLinear: function () { this.r = SRGBToLinear(this.r); this.g = SRGBToLinear(this.g); this.b = SRGBToLinear(this.b); this.lin = true; this.dflt = false; return this; }
  };
  function colArg(v, where) { var c = Col(); raw(c).set(v); return c; }

  /* ---------------- scene graph ---------------- */
  function obj3d(o, k, isList) {
    base(o, k, (isList || [k]).concat(['Object3D']));
    o.position = V3(); o.rotation = Euler(); o.quaternion = Quat(); o.scale = V3(1, 1, 1);
    o.visible = true; o.name = ''; o.userData = {}; o.parent = null; o.children = [];
    o.castShadow = false; o.receiveShadow = false; o.frustumCulled = true; o.renderOrder = 0; o.matrix = M4();
    hide(o, 'lookAtTarget', null);
    o.add = function () {
      for (var i = 0; i < arguments.length; i++) {
        var c = arguments[i], rc = raw(c), me = PROX.get(this);
        if (!is(c, 'Object3D')) fail(k + '.add needs Object3D children');
        if (c === me) fail('an object cannot be added to itself');
        if (rc.parent) raw(rc.parent).remove(c);
        rc.parent = me; this.children.push(c);
      }
      return this;
    };
    o.remove = function () {
      for (var i = 0; i < arguments.length; i++) {
        var c = arguments[i], at = this.children.indexOf(c);
        if (at >= 0) { this.children.splice(at, 1); raw(c).parent = null; }
      }
      return this;
    };
    o.traverse = function (fn) { if (typeof fn !== 'function') fail('traverse(fn)'); fn(PROX.get(this)); this.children.slice().forEach(function (c) { raw(c).traverse(fn); }); };
    o.getObjectByName = function (n) {
      if (this.name === n) return PROX.get(this);
      for (var i = 0; i < this.children.length; i++) { var f = raw(this.children[i]).getObjectByName(n); if (f) return f; }
      return undefined;
    };
    o.lookAt = function (x, y, z) {
      var t = arguments.length === 1 ? v3arg(x, 'lookAt') : { x: x, y: y, z: z };
      if (!num(t.x) || !num(t.y) || !num(t.z)) fail('lookAt(vector) or lookAt(x, y, z)');
      this.lookAtTarget = [t.x, t.y, t.z]; return undefined;
    };
    o.updateMatrix = function () {
      var q = raw(this.quaternion), qq = q.touched ? q : eulerQuat(raw(this.rotation));
      composeInto(raw(this.matrix).elements, raw(this.position), qq, raw(this.scale));
    };
    return o;
  }
  function geoArg(g) { if (!is(g, 'BufferGeometry')) fail('a mock geometry is required'); return g; }
  function matArg(m) { if (!is(m, 'Material')) fail('a mock material is required'); return m; }

  function Ctor(name, make) {
    var f = function () { if (!new.target) fail(name + ' must be called with new'); return make.apply(null, arguments); };
    Object.defineProperty(f, 'name', { value: name });
    f.__ctor = true;
    return f;
  }

  var T = {
    REVISION: '128', sRGBEncoding: 3001, PCFSoftShadowMap: 2, DoubleSide: 2, NormalBlending: 1, AdditiveBlending: 2,
    ACESFilmicToneMapping: 4, LinearEncoding: 3000, RGBAFormat: 1023, RepeatWrapping: 1000, ClampToEdgeWrapping: 1001, LinearFilter: 1006, LinearMipmapLinearFilter: 1008,
    Vector2: Ctor('Vector2', function (x, y) { return V2(x, y); }),
    Vector3: Ctor('Vector3', function (x, y, z) {
      if (arguments.length && (!num(x) || !num(y) || !num(z))) fail('new Vector3(x, y, z) takes three numbers');
      return V3(x, y, z);
    }),
    Color: Ctor('Color', function (v) { if (arguments.length > 1) fail('new Color(hex) takes one hex value'); return v === undefined ? Col() : colArg(v, 'new Color'); }),
    Matrix4: Ctor('Matrix4', function () { if (arguments.length) fail('new Matrix4() takes no arguments'); return M4(); }),
    Quaternion: Ctor('Quaternion', function () { if (arguments.length) fail('new Quaternion() takes no arguments here'); return Quat(); }),
    Object3D: Ctor('Object3D', function () { return wrap(obj3d({}, 'Object3D'), 'Object3D'); }),
    Group: Ctor('Group', function () { return wrap(obj3d({}, 'Group'), 'Group'); }),
    Scene: Ctor('Scene', function () {
      var o = obj3d({}, 'Scene'); o.background = null; o.fog = null;
      hide(o, '__setter', function (k, v) {
        if (k === 'background' && v !== null && kind(v) !== 'Color') fail('Scene.background must be a Color or null');
        if (k === 'fog' && v !== null && kind(v) !== 'Fog') fail('Scene.fog must be a Fog or null');
      });
      return wrap(o, 'Scene');
    }),
    Mesh: Ctor('Mesh', function (g, m) {
      if (arguments.length !== 2) fail('new Mesh(geometry, material) takes both arguments');
      var o = obj3d({}, 'Mesh'); o.geometry = geoArg(g); o.material = matArg(m);
      hide(o, '__setter', function (k, v) { if (k === 'geometry') geoArg(v); if (k === 'material') matArg(v); });
      return wrap(o, 'Mesh');
    }),
    InstancedMesh: Ctor('InstancedMesh', function (g, m, count) {
      if (arguments.length !== 3 || !Number.isInteger(count) || count < 1) fail('new InstancedMesh(geometry, material, count) needs an integer count >= 1');
      var o = obj3d({}, 'InstancedMesh', ['InstancedMesh', 'Mesh']); o.geometry = geoArg(g); o.material = matArg(m); o.count = count;
      hide(o, 'maxCount', count); hide(o, 'matrices', []);
      o.instanceMatrix = wrap(base({ needsUpdate: false }, 'InstanceMatrix'), 'InstancedMesh.instanceMatrix');
      o.setMatrixAt = function (i, mat) {
        if (!Number.isInteger(i) || i < 0 || i >= this.maxCount) fail('setMatrixAt index out of range');
        var r = raw(mat); if (!r || r.__kind !== 'Matrix4') fail('setMatrixAt(i, Matrix4)');
        this.matrices[i] = r.elements.slice();
      };
      // F6-T1b: r128 creates instanceColor on the first setColorAt; the caller sets instanceColor.needsUpdate
      hide(o, 'colors', []);
      o.instanceColor = null;
      o.setColorAt = function (i, c) {
        if (!Number.isInteger(i) || i < 0 || i >= this.maxCount) fail('setColorAt index out of range');
        var r = raw(c); if (!r || r.__kind !== 'Color') fail('setColorAt(i, Color)');
        if (![r.r, r.g, r.b].every(num)) fail('setColorAt: colour channels must be numbers');
        this.colors[i] = [r.r, r.g, r.b];
        if (!this.instanceColor) this.instanceColor = wrap(base({ needsUpdate: false }, 'InstanceColor'), 'InstancedMesh.instanceColor');
      };
      hide(o, '__setter', function (k, v) { if (k === 'count' && (!Number.isInteger(v) || v < 0 || v > o.maxCount)) fail('InstancedMesh.count out of range'); });
      return wrap(o, 'InstancedMesh');
    }),
    PerspectiveCamera: Ctor('PerspectiveCamera', function (fov, aspect, near, far) {
      var o = obj3d({}, 'PerspectiveCamera');
      o.fov = fov === undefined ? 50 : fov; o.aspect = aspect === undefined ? 1 : aspect; o.near = near === undefined ? 0.1 : near; o.far = far === undefined ? 2000 : far;
      [o.fov, o.aspect, o.near, o.far].forEach(function (v) { if (!num(v)) fail('PerspectiveCamera(fov, aspect, near, far) takes numbers'); });
      hide(o, 'projUpdates', 0);
      o.updateProjectionMatrix = function () { this.projUpdates++; };
      // r128: setViewOffset(fullWidth, fullHeight, x, y, width, height) sets .view (enabled) and updates the projection;
      // clearViewOffset() disables it. The mock keeps the same record (hidden: the app never reads .view).
      hide(o, 'view', null);
      o.setViewOffset = function (fw, fh, x, y, w, h) {
        if (arguments.length !== 6 || ![fw, fh, x, y, w, h].every(num) || !(fw > 0 && fh > 0 && w > 0 && h > 0)) fail('setViewOffset(fullWidth, fullHeight, x, y, width, height) takes 6 numbers, sizes > 0');
        raw(this).view = { enabled: true, fullWidth: fw, fullHeight: fh, offsetX: x, offsetY: y, width: w, height: h };
        this.projUpdates++;
      };
      o.clearViewOffset = function () { if (raw(this).view) raw(this).view.enabled = false; this.projUpdates++; };
      hide(o, '__setter', function (k, v) { if (['fov', 'aspect', 'near', 'far'].indexOf(k) >= 0 && !(num(v) && v > 0)) fail('PerspectiveCamera.' + k + ' must be a positive number'); });
      return wrap(o, 'PerspectiveCamera');
    }),
    DirectionalLight: Ctor('DirectionalLight', function (color, intensity) {
      var o = obj3d({}, 'DirectionalLight', ['DirectionalLight', 'Light']);
      o.color = color === undefined ? Col() : colArg(color, 'DirectionalLight'); o.intensity = intensity === undefined ? 1 : intensity;
      raw(o.position).y = 1;
      o.target = T.Object3D ? new T.Object3D() : null;
      var cam = base({ left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 500 }, 'ShadowCamera');
      hide(cam, 'projUpdates', 0); cam.updateProjectionMatrix = function () { this.projUpdates++; };
      o.shadow = wrap(base({ mapSize: V2(512, 512), camera: wrap(cam, 'DirectionalLight.shadow.camera'), bias: 0, normalBias: 0 }, 'LightShadow'), 'DirectionalLight.shadow');
      hide(o, '__setter', function (k, v) { if (k === 'color' && kind(v) !== 'Color') fail('light.color must be a Color'); if (k === 'target' && !is(v, 'Object3D')) fail('light.target must be an Object3D'); });
      return wrap(o, 'DirectionalLight');
    }),
    HemisphereLight: Ctor('HemisphereLight', function (sky, ground, intensity) {
      var o = obj3d({}, 'HemisphereLight', ['HemisphereLight', 'Light']);
      o.color = sky === undefined ? Col() : colArg(sky, 'HemisphereLight'); o.groundColor = ground === undefined ? Col() : colArg(ground, 'HemisphereLight');
      o.intensity = intensity === undefined ? 1 : intensity;
      hide(o, '__setter', function (k, v) { if ((k === 'color' || k === 'groundColor') && kind(v) !== 'Color') fail('light.' + k + ' must be a Color'); });
      return wrap(o, 'HemisphereLight');
    })
  };

  /* ---------------- geometry ---------------- */
  function geometry(k, params, vertexCount) {
    var o = base({}, k, [k, 'BufferGeometry']);
    hide(o, 'params', params); hide(o, 'attrs', {}); hide(o, 'index', null); hide(o, 'disposed', 0); hide(o, 'vertexCount', vertexCount || 0);
    o.setAttribute = function (name, attr) {
      if (['position', 'normal', 'color', 'uv'].indexOf(name) < 0) fail('setAttribute: attribute "' + name + '" is not used by PlotCraft');
      var a = raw(attr); if (!a || a.__kind !== 'Float32BufferAttribute') fail('setAttribute needs a Float32BufferAttribute');
      var self = this;
      Object.keys(this.attrs).forEach(function (n) { if (self.attrs[n].count !== a.count) fail('setAttribute: "' + name + '" count ' + a.count + ' differs from "' + n + '" count ' + self.attrs[n].count); });
      if (this.index && name === 'position' && Math.max.apply(null, this.index.concat([0])) >= a.count) fail('setIndex: index out of range');
      this.attrs[name] = a; this.vertexCount = a.count; return this;
    };
    o.setIndex = function (arr) {
      if (!Array.isArray(arr)) fail('setIndex takes a plain array here');
      var p = this.attrs.position;
      for (var i = 0; i < arr.length; i++) if (!Number.isInteger(arr[i]) || arr[i] < 0 || (p && arr[i] >= p.count)) fail('setIndex: index out of range at ' + i);
      this.index = arr.slice(); return this;
    };
    o.computeVertexNormals = function () { hide(this, 'normalsComputed', true); };
    o.dispose = function () { this.disposed++; };
    M.created.geometries.push(o);
    return wrap(o, k);
  }
  function nums(list, where) { list.forEach(function (v) { if (v !== undefined && !num(v)) fail(where + ' takes numbers'); }); }
  T.BufferGeometry = Ctor('BufferGeometry', function () { if (arguments.length) fail('new BufferGeometry() takes no arguments'); return geometry('BufferGeometry', []); });
  T.BoxGeometry = Ctor('BoxGeometry', function () { var a = [].slice.call(arguments); nums(a, 'BoxGeometry'); return geometry('BoxGeometry', a, 24); });
  T.PlaneGeometry = Ctor('PlaneGeometry', function () {
    var a = [].slice.call(arguments); nums(a, 'PlaneGeometry');
    return geometry('PlaneGeometry', a, ((a[2] || 1) + 1) * ((a[3] || 1) + 1));
  });
  T.CylinderGeometry = Ctor('CylinderGeometry', function () { var a = [].slice.call(arguments); nums(a, 'CylinderGeometry'); return geometry('CylinderGeometry', a); });
  T.ConeGeometry = Ctor('ConeGeometry', function () { var a = [].slice.call(arguments); nums(a, 'ConeGeometry'); return geometry('ConeGeometry', a); });
  T.Float32BufferAttribute = Ctor('Float32BufferAttribute', function (array, itemSize) {
    if (arguments.length !== 2) fail('new Float32BufferAttribute(array, itemSize) takes exactly two arguments');
    var isF32 = Object.prototype.toString.call(array) === '[object Float32Array]';
    if (!isF32 && !Array.isArray(array)) fail('Float32BufferAttribute needs a Float32Array or an array');
    if (!Number.isInteger(itemSize) || itemSize < 1 || itemSize > 4 || array.length % itemSize) fail('Float32BufferAttribute itemSize must be 1..4 and divide the array length');
    var o = base({}, 'Float32BufferAttribute');
    hide(o, 'array', Float32Array.from(array)); hide(o, 'itemSize', itemSize); hide(o, 'count', array.length / itemSize); hide(o, 'needsUpdate', false);
    hide(o, '__setter', function (k) { if (k === 'array') fail('Float32BufferAttribute.array is replaced in place, never reassigned'); });
    return wrap(o, 'Float32BufferAttribute');
  });
  function pathLike(k, wl) {
    var o = base({}, k, [k, 'Path']); hide(o, 'pts', []);
    o.moveTo = function (x, y) { nums([x, y], k + '.moveTo'); this.pts.push([x, y]); return this; };
    o.lineTo = function (x, y) { nums([x, y], k + '.lineTo'); this.pts.push([x, y]); return this; };
    o.closePath = function () { hide(this, 'closed', true); return this; };
    if (k === 'Shape') o.holes = [];
    return wrap(o, wl);
  }
  T.Path = Ctor('Path', function () { if (arguments.length) fail('new Path() takes no arguments here'); return pathLike('Path', 'Path'); });
  T.Shape = Ctor('Shape', function () { if (arguments.length) fail('new Shape() takes no arguments here'); return pathLike('Shape', 'Shape'); });
  T.ShapeGeometry = Ctor('ShapeGeometry', function (shape, segs) {
    if (arguments.length < 1 || arguments.length > 2) fail('new ShapeGeometry(shape[, curveSegments])');
    var s = raw(shape); if (!s || s.__kind !== 'Shape') fail('ShapeGeometry needs a Shape');
    s.holes.forEach(function (h) { if (!is(h, 'Path')) fail('Shape.holes must hold Path objects'); });
    var g = geometry('ShapeGeometry', [segs]);
    var rg = raw(g); hide(rg, 'outline', s.pts.slice()); hide(rg, 'holes', s.holes.map(function (h) { return raw(h).pts.slice(); }));
    rg.vertexCount = s.pts.length + rg.holes.reduce(function (n, h) { return n + h.length; }, 0);
    return g;
  });

  /* ---------------- materials ---------------- */
  function material(k, o0) {
    var op = opts(o0, ['color', 'vertexColors', 'transparent', 'opacity', 'side', 'map', 'toneMapped', 'fog', 'depthWrite', 'emissive', 'emissiveIntensity', 'blending'], k);
    var o = base({}, k, [k, 'Material']);
    if ('vertexColors' in op && op.vertexColors !== true && op.vertexColors !== false) fail(k + ': vertexColors must be a boolean (r128: no THREE.VertexColors)');
    if ('color' in op && kind(op.color) !== 'Color') fail(k + ': color must be a THREE.Color (through PC.three.col)');
    o.color = Col(undefined, true);
    if ('color' in op) raw(o.color).copy(op.color);
    o.vertexColors = !!op.vertexColors; o.transparent = !!op.transparent; o.opacity = 'opacity' in op ? op.opacity : 1; o.side = 'side' in op ? op.side : 0;
    if (!num(o.opacity)) fail(k + ': opacity must be a number');
    if ('map' in op && op.map !== null && kind(op.map) !== 'DataTexture') fail(k + ': map must be a texture or null');
    if ('emissive' in op && kind(op.emissive) !== 'Color') fail(k + ': emissive must be a THREE.Color (through PC.three.col)');
    if ('emissive' in op && k !== 'MeshLambertMaterial') fail(k + ': emissive only on Lambert materials here');
    o.emissive = Col(undefined, true); if ('emissive' in op) raw(o.emissive).copy(op.emissive);
    o.emissiveIntensity = 'emissiveIntensity' in op ? op.emissiveIntensity : 1;
    if (!num(o.emissiveIntensity)) fail(k + ': emissiveIntensity must be a number');
    o.blending = 'blending' in op ? op.blending : 1;
    if ([1, 2].indexOf(o.blending) < 0) fail(k + ': blending must be NormalBlending or AdditiveBlending');
    o.map = op.map || null; o.toneMapped = 'toneMapped' in op ? op.toneMapped : true; o.fog = 'fog' in op ? op.fog : true; o.depthWrite = 'depthWrite' in op ? op.depthWrite : true;
    ['toneMapped', 'fog', 'depthWrite'].forEach(function (b) { if (typeof o[b] !== 'boolean') fail(k + ': ' + b + ' must be a boolean'); });
    if ([0, 1, 2].indexOf(o.side) < 0) fail(k + ': side must be a side constant');
    hide(o, 'disposed', 0);
    o.dispose = function () { this.disposed++; };
    hide(o, '__setter', function (key, v) {
      if (key === 'color' && kind(v) !== 'Color') fail(k + '.color must be a Color');
      if (key === 'side' && [0, 1, 2].indexOf(v) < 0) fail(k + '.side must be a side constant');
      if (key === 'vertexColors' && typeof v !== 'boolean') fail(k + '.vertexColors must be a boolean');
      if (key === 'map' && v !== null && kind(v) !== 'DataTexture') fail(k + '.map must be a texture or null');
      if (key === 'fog' && typeof v !== 'boolean') fail(k + '.fog must be a boolean');
      if (key === 'emissive' && kind(v) !== 'Color') fail(k + '.emissive must be a Color');
      if (key === 'emissiveIntensity' && !num(v)) fail(k + '.emissiveIntensity must be a number');
      if (key === 'blending') fail(k + '.blending is set at creation only');
    });
    M.created.materials.push(o);
    return wrap(o, k);
  }
  T.MeshLambertMaterial = Ctor('MeshLambertMaterial', function (o) { return material('MeshLambertMaterial', o); });
  T.MeshBasicMaterial = Ctor('MeshBasicMaterial', function (o) { return material('MeshBasicMaterial', o); });

  /* ---------------- F6-T1a: textures and fog ---------------- */
  var ENC = [3000, 3001], FILT = [1006, 1008];
  T.DataTexture = Ctor('DataTexture', function (data, w, h, format) {
    if (arguments.length !== 4) fail('new DataTexture(data, width, height, format) takes four arguments here');
    if (Object.prototype.toString.call(data) !== '[object Uint8Array]') fail('DataTexture data must be a Uint8Array');
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || (w & (w - 1)) || (h & (h - 1))) fail('DataTexture sizes must be powers of two');
    if (format !== 1023) fail('DataTexture format must be RGBAFormat');
    if (data.length !== w * h * 4) fail('DataTexture data length must be width x height x 4');
    var o = base({}, 'DataTexture', ['DataTexture', 'Texture']);
    // r128 DataTexture defaults: Nearest filters, no mipmaps, ClampToEdge, LinearEncoding (CTO C-0)
    o.wrapS = 1001; o.wrapT = 1001; o.repeat = V2(1, 1); o.encoding = 3000; o.magFilter = 1003; o.minFilter = 1003;
    o.generateMipmaps = false; o.anisotropy = 1; o.needsUpdate = false;
    hide(o, 'image', { data: data, width: w, height: h }); hide(o, 'disposed', 0); hide(o, 'uploads', 0);
    o.dispose = function () { this.disposed++; };
    hide(o, '__setter', function (k, v) {
      if ((k === 'wrapS' || k === 'wrapT') && v !== 1000 && v !== 1001) fail('DataTexture.' + k + ' must be a wrapping constant');
      if (k === 'encoding' && ENC.indexOf(v) < 0) fail('DataTexture.encoding must be an encoding constant');
      if ((k === 'magFilter' || k === 'minFilter') && FILT.concat([1003]).indexOf(v) < 0) fail('DataTexture.' + k + ' must be a filter constant');
      if (k === 'magFilter' && v === 1008) fail('magFilter cannot be a mipmap filter');
      if (k === 'anisotropy' && !(num(v) && v >= 1)) fail('DataTexture.anisotropy must be a number >= 1');
      if (k === 'needsUpdate' && v) o.uploads++;
    });
    M.created.textures.push(o);
    return wrap(o, 'DataTexture');
  });
  T.Fog = Ctor('Fog', function (color, near, far) {
    if (arguments.length !== 3 || !num(near) || !num(far)) fail('new Fog(color, near, far)');
    var o = base({ color: colArg(color, 'Fog'), near: near, far: far }, 'Fog');
    hide(o, '__setter', function (k, v) { if (k === 'color' && kind(v) !== 'Color') fail('Fog.color must be a Color'); if ((k === 'near' || k === 'far') && !num(v)) fail('Fog.' + k + ' must be a number'); });
    return wrap(o, 'Fog');
  });

  /* ---------------- renderer ---------------- */
  function audit(scene) {
    var bg = raw(scene).background, fog = raw(scene).fog;
    if (bg && raw(bg).lin) fail('scene.background must take the raw hex (A-10), not a linear colour');
    // F6-T1a (A-10, plan review Q-T6): r128 mixes fog into the encoded output, so the fog colour is raw like the background
    if (fog && raw(raw(fog).color).lin) fail('scene.fog.color must take the raw hex (A-10), not a linear colour');
    function ok(c, what) { var r = raw(c); if (!r.lin && !r.dflt) fail(what + ' colour is not linear: pass it through PC.three.col (A-10)'); }
    raw(scene).traverse(function (n) {
      var r = raw(n);
      if (r.material) ok(r.material.color, (r.name || r.__kind) + ' material');
      if (r.__is.indexOf('Light') >= 0) { ok(r.color, (r.name || r.__kind) + ' light'); if (r.groundColor) ok(r.groundColor, (r.name || r.__kind) + ' ground'); }
    });
  }
  T.WebGLRenderer = Ctor('WebGLRenderer', function (o0) {
    var op = opts(o0, ['canvas', 'antialias'], 'WebGLRenderer');
    if (M.failRenderer) throw new Error('Error creating WebGL context.');
    var o = base({}, 'WebGLRenderer');
    o.domElement = op.canvas || null;
    // r128: autoUpdate true, needsUpdate false; render() clears needsUpdate after drawing the shadow map (counted)
    o.shadowMap = wrap(base({ enabled: false, type: 1, autoUpdate: true, needsUpdate: false }, 'ShadowMap'), 'WebGLRenderer.shadowMap');
    hide(o, 'shadowRenders', 0);
    o.outputEncoding = 3000; o.toneMapping = 0; o.toneMappingExposure = 1;
    var caps = base({ maxTextureSize: M.caps.maxTextureSize }, 'Capabilities'), maxA = M.caps.maxAnisotropy;
    caps.getMaxAnisotropy = function () { return maxA; };
    o.capabilities = wrap(caps, 'WebGLRenderer.capabilities');
    hide(o, 'options', op); hide(o, 'calls', []); hide(o, 'renders', 0); hide(o, 'pixelRatio', 1); hide(o, 'size', null); hide(o, 'disposed', 0);
    o.setPixelRatio = function (r) { if (arguments.length !== 1 || !num(r) || r <= 0) fail('setPixelRatio(ratio)'); this.pixelRatio = r; this.calls.push(['setPixelRatio', r]); };
    o.setSize = function (w, h, style) {
      if (arguments.length !== 3 || !num(w) || !num(h) || w <= 0 || h <= 0 || typeof style !== 'boolean') fail('renderer.setSize(w, h, updateStyle) takes two positive numbers and a boolean');
      this.size = [w, h, style]; this.calls.push(['setSize', w, h, style]);
    };
    hide(o, 'scissor', null); hide(o, 'scissorTest', false); hide(o, 'uploads', 0); hide(o, 'uploaded', []);
    hide(o, 'inited', []);
    o.initTexture = function (t) { if (kind(t) !== 'DataTexture') fail('initTexture(texture)'); this.inited.push(t); };
    o.setScissor = function (x, y, w, h) { if (arguments.length !== 4 || ![x, y, w, h].every(num)) fail('setScissor(x, y, w, h)'); this.scissor = [x, y, w, h]; };
    o.setScissorTest = function (on) { if (typeof on !== 'boolean') fail('setScissorTest(boolean)'); this.scissorTest = on; };
    o.render = function (scene, camera) {
      if (kind(scene) !== 'Scene') fail('render(scene, camera) needs a Scene');
      if (kind(camera) !== 'PerspectiveCamera') fail('render(scene, camera) needs a PerspectiveCamera');
      // F6-T2: a draw clipped to a 1 px scissor is the build's upload pass, not a frame: recorded apart (visible names)
      if (this.scissorTest) {
        if (!this.scissor || this.scissor[2] !== 1 || this.scissor[3] !== 1) fail('a scissored render is the 1 px upload pass only');
        var up = []; raw(scene).traverse(function (x) { if (x.name && x.visible !== false) up.push(x.name); });
        this.uploads++; this.uploaded.push(up); var sm0 = raw(this.shadowMap); if (sm0.needsUpdate) fail('the upload pass draws no shadow map'); return;
      }
      audit(scene); this.renders++; this.calls.push(['render']);
      var sm = raw(this.shadowMap);
      if (sm.enabled && (sm.autoUpdate || sm.needsUpdate)) { this.shadowRenders++; sm.needsUpdate = false; }
    };
    hide(o, 'compiles', 0); hide(o, 'compiled', []);
    o.compile = function (scene, camera) {   // F6-T2: records which named meshes were visible (would get a program)
      if (kind(scene) !== 'Scene' || kind(camera) !== 'PerspectiveCamera') fail('compile(scene, camera)');
      var seen = []; raw(scene).traverse(function (x) { if (x.name && x.visible !== false) seen.push(x.name); });
      this.compiles++; this.compiled.push(seen);
    };
    o.dispose = function () { this.disposed++; };
    hide(o, '__setter', function (k, v) {
      if (k === 'outputEncoding' && v !== 3000 && v !== 3001) fail('outputEncoding must be an encoding constant');
      if (k === 'toneMapping' && [0, 4].indexOf(v) < 0) fail('toneMapping must be NoToneMapping or ACESFilmicToneMapping');
      if (k === 'toneMappingExposure' && !(num(v) && v > 0)) fail('toneMappingExposure must be a positive number');
      if (k === 'capabilities') fail('renderer.capabilities is read-only');
    });
    M.created.renderers.push(o);
    return wrap(o, 'WebGLRenderer');
  });

  /* ---------------- CatmullRomCurve3 (port of r128 extras/curves/CatmullRomCurve3.js + core/Curve.js) ---------------- */
  function CubicPoly() {
    var c0 = 0, c1 = 0, c2 = 0, c3 = 0;
    function init(x0, x1, t0, t1) { c0 = x0; c1 = t0; c2 = -3 * x0 + 3 * x1 - 2 * t0 - t1; c3 = 2 * x0 - 2 * x1 + t0 + t1; }
    return {
      initCatmullRom: function (x0, x1, x2, x3, tension) { init(x1, x2, tension * (x2 - x0), tension * (x3 - x1)); },
      initNonuniformCatmullRom: function (x0, x1, x2, x3, dt0, dt1, dt2) {
        var t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
        var t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
        t1 *= dt1; t2 *= dt1; init(x1, x2, t1, t2);
      },
      calc: function (t) { var t2 = t * t, t3 = t2 * t; return c0 + c1 * t + c2 * t2 + c3 * t3; }
    };
  }
  var TYPES = ['centripetal', 'chordal', 'catmullrom'];
  T.CatmullRomCurve3 = Ctor('CatmullRomCurve3', function (points, closed, curveType, tension) {
    if (arguments.length < 1 || arguments.length > 4) fail('new CatmullRomCurve3(points, closed, curveType, tension)');
    if (!Array.isArray(points) || points.length < 2 || !points.every(function (p) { return kind(p) === 'Vector3'; })) fail('CatmullRomCurve3 needs an array of 2 or more Vector3');
    if (closed !== undefined && typeof closed !== 'boolean') fail('CatmullRomCurve3: closed must be a boolean');
    if (curveType !== undefined && TYPES.indexOf(curveType) < 0) fail('CatmullRomCurve3: curveType must be centripetal, chordal or catmullrom');
    if (tension !== undefined && !num(tension)) fail('CatmullRomCurve3: tension must be a number');
    var o = base({}, 'CatmullRomCurve3');
    o.points = points; o.arcLengthDivisions = 200;
    hide(o, 'closed', !!closed); hide(o, 'curveType', curveType || 'centripetal'); hide(o, 'tension', tension === undefined ? 0.5 : tension);
    hide(o, 'cache', null); hide(o, 'needsUpdate', false);
    var px = CubicPoly(), py = CubicPoly(), pz = CubicPoly(), tmp = { x: 0, y: 0, z: 0 };   // one shared vector, as in r128
    function P(i) { return raw(o.points[i]); }
    function ext(a, b) { tmp.x = a.x - b.x + a.x; tmp.y = a.y - b.y + a.y; tmp.z = a.z - b.z + a.z; return tmp; }
    function point(t) {
      var l = o.points.length, p = (l - (o.closed ? 0 : 1)) * t, ip = Math.floor(p), w = p - ip, p0, p3;
      if (o.closed) ip += ip > 0 ? 0 : (Math.floor(Math.abs(ip) / l) + 1) * l;
      else if (w === 0 && ip === l - 1) { ip = l - 2; w = 1; }
      if (o.closed || ip > 0) p0 = P((ip - 1) % l); else p0 = ext(P(0), P(1));
      var p1 = P(ip % l), p2 = P((ip + 1) % l);
      if (o.closed || ip + 2 < l) p3 = P((ip + 2) % l); else p3 = ext(P(l - 1), P(l - 2));
      if (o.curveType === 'centripetal' || o.curveType === 'chordal') {
        var pw = o.curveType === 'chordal' ? 0.5 : 0.25;
        var dt0 = Math.pow(dist2(p0, p1), pw), dt1 = Math.pow(dist2(p1, p2), pw), dt2 = Math.pow(dist2(p2, p3), pw);
        if (dt1 < 1e-4) dt1 = 1.0; if (dt0 < 1e-4) dt0 = dt1; if (dt2 < 1e-4) dt2 = dt1;
        px.initNonuniformCatmullRom(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2);
        py.initNonuniformCatmullRom(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2);
        pz.initNonuniformCatmullRom(p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2);
      } else {
        px.initCatmullRom(p0.x, p1.x, p2.x, p3.x, o.tension); py.initCatmullRom(p0.y, p1.y, p2.y, p3.y, o.tension); pz.initCatmullRom(p0.z, p1.z, p2.z, p3.z, o.tension);
      }
      return { x: px.calc(w), y: py.calc(w), z: pz.calc(w) };
    }
    function lengths() {
      var div = o.arcLengthDivisions;
      if (o.cache && o.cache.length === div + 1 && !o.needsUpdate) return o.cache;
      o.needsUpdate = false;
      var cache = [0], last = point(0), sum = 0;
      for (var i = 1; i <= div; i++) { var cur = point(i / div); sum += Math.sqrt(dist2(cur, last)); cache.push(sum); last = cur; }
      o.cache = cache; return cache;
    }
    function uToT(u) {
      var al = lengths(), il = al.length, target = u * al[il - 1], low = 0, high = il - 1, i = 0, cmp;
      while (low <= high) { i = Math.floor(low + (high - low) / 2); cmp = al[i] - target; if (cmp < 0) low = i + 1; else if (cmp > 0) high = i - 1; else { high = i; break; } }
      i = high;
      if (al[i] === target) return i / (il - 1);
      return (i + (target - al[i]) / (al[i + 1] - al[i])) / (il - 1);
    }
    function out(p, target) { if (target !== undefined) { var r = v3arg(target, 'getPoint target'); r.x = p.x; r.y = p.y; r.z = p.z; return target; } return V3(p.x, p.y, p.z); }
    o.getPoint = function (t, target) { if (!num(t)) fail('getPoint(t)'); return out(point(t), target); };
    o.getPointAt = function (u, target) { if (!num(u)) fail('getPointAt(u)'); return out(point(uToT(u)), target); };
    o.getLength = function () { var l = lengths(); return l[l.length - 1]; };
    o.updateArcLengths = function () { o.needsUpdate = true; lengths(); };
    hide(o, '__setter', function (k, v) { if (k === 'arcLengthDivisions' && (!Number.isInteger(v) || v < 1)) fail('arcLengthDivisions must be a positive integer'); });
    return wrap(o, 'CatmullRomCurve3');
  });

  var NS = wrap(T, 'THREE');
  M.namespace = NS;
  root.__threeMock = M;
  if (typeof module === 'object' && module && module.exports) module.exports = NS;
  else root.THREE = NS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
