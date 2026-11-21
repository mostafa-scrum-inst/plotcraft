// Loads core + data + three files (manifest order) into a bare vm context with the strict THREE mock
// (tests/three-mock.js) and controllable browser stubs (A-16 step 4). ui files are not loaded.
//   load3d({ three: true|false, dpr, size: [w, h], visible })
//   -> { PC, THREE, mock, canvas, doc, raf, ro, win, ctx }
// three: false loads no THREE at all: proves every three file loads (and fails softly) without it.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SRC, ROOT, manifest } from './load.mjs';

const MOCK = readFileSync(join(ROOT, 'tests', 'three-mock.js'), 'utf8');

function emitter(extra = {}) {
  const ls = {};
  return Object.assign({
    addEventListener(t, f, o) { (ls[t] = ls[t] || []).push({ f, o }); },
    removeEventListener(t, f) { ls[t] = (ls[t] || []).filter((l) => l.f !== f); },
    listeners: (t) => (ls[t] || []).slice(),
    // Dispatches a plain event object; returns it (defaultPrevented recorded).
    dispatch(type, props = {}) {
      const ev = Object.assign({ type, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} }, props);
      for (const l of (ls[type] || []).slice()) l.f.call(this, ev);
      return ev;
    }
  }, extra);
}

export function stubCanvas(w = 360, h = 400) {
  const parent = emitter({ clientWidth: w, clientHeight: h });
  const canvas = emitter({
    clientWidth: w, clientHeight: h, width: w, height: h, parentElement: parent, captured: new Set(),
    setPointerCapture(id) { this.captured.add(id); }, releasePointerCapture(id) { this.captured.delete(id); },
    hasPointerCapture(id) { return this.captured.has(id); },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight }; },
    focus() {}
  });
  canvas.resize = (nw, nh) => { canvas.clientWidth = parent.clientWidth = nw; canvas.clientHeight = parent.clientHeight = nh; };
  return canvas;
}

export function load3d(o = {}) {
  const { three = true, dpr = 1, size = [360, 400], visible = true } = o;
  // requestAnimationFrame under test control
  let seq = 0; const queue = new Map();
  const raf = {
    requested: 0, cancelled: 0,
    request(fn) { raf.requested++; const id = ++seq; queue.set(id, fn); return id; },
    cancel(id) { if (queue.delete(id)) raf.cancelled++; },
    pending: () => queue.size,
    flush(n = 1) { for (let i = 0; i < n && queue.size; i++) { const batch = [...queue.entries()]; queue.clear(); for (const [, fn] of batch) fn(16 * seq); } }
  };
  // timers (the Building… yield) under test control too
  let tseq = 0; const timers = new Map();
  const timer = {
    set(fn) { const id = ++tseq; timers.set(id, fn); return id; },
    clear(id) { timers.delete(id); },
    pending: () => timers.size,
    flush() { while (timers.size) { const b = [...timers.entries()]; timers.clear(); for (const [, fn] of b) fn(); } }
  };
  // ResizeObserver stub: ro.trigger(w, h) resizes the canvas and calls every observer.
  const observers = [];
  function ResizeObserver(cb) { this.cb = cb; this.targets = []; observers.push(this); }
  ResizeObserver.prototype.observe = function (t) { this.targets.push(t); };
  ResizeObserver.prototype.unobserve = function (t) { this.targets = this.targets.filter((x) => x !== t); };
  ResizeObserver.prototype.disconnect = function () { this.targets = []; };
  const canvas = stubCanvas(size[0], size[1]);
  const ro = {
    observers,
    trigger(w, h) { canvas.resize(w, h); for (const ob of observers) if (ob.targets.length) ob.cb(ob.targets.map((t) => ({ target: t }))); }
  };
  const doc = emitter({ visibilityState: visible ? 'visible' : 'hidden' });
  doc.setVisible = (v) => { doc.visibilityState = v ? 'visible' : 'hidden'; doc.dispatch('visibilitychange'); };
  const win = emitter({ devicePixelRatio: dpr });
  const g = {
    document: doc, devicePixelRatio: dpr, ResizeObserver,
    requestAnimationFrame: raf.request, cancelAnimationFrame: raf.cancel,
    setTimeout: (fn) => timer.set(fn), clearTimeout: timer.clear,
    addEventListener: win.addEventListener, removeEventListener: win.removeEventListener,
    console
  };
  const ctx = vm.createContext(g);
  vm.runInContext('globalThis.window = globalThis;', ctx);
  if (three) vm.runInContext(MOCK, ctx, { filename: 'three-mock.js' });
  const files = manifest().js.filter((j) => j.layer === 'core' || j.layer === 'data' || j.layer === 'three').map((j) => j.file);
  for (const f of files) vm.runInContext(readFileSync(join(SRC, f), 'utf8'), ctx, { filename: f });
  return { PC: ctx.PC, THREE: ctx.THREE, mock: ctx.__threeMock, canvas, doc, raf, timer, ro, win, ctx, setDpr: (d) => { ctx.devicePixelRatio = d; } };
}

// Only the mock, in its own context (for tests/three/mock.test.mjs).
export function loadMock() {
  const ctx = vm.createContext({ console });
  vm.runInContext(MOCK, ctx, { filename: 'three-mock.js' });
  return { THREE: ctx.THREE, mock: ctx.__threeMock, ctx };
}
