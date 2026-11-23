import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RULES, scan, scanHtml, scanExternal, scanVendor, scanBudget, DIST_MAX_BYTES, DIST_BUDGET_BYTES, lintProject, THREE_TAG } from '../lint-constraints.mjs';

// For every rule: texts that must be flagged (pos) and close look-alikes that must not be (neg).
const CASES = {
  'native-dialog': { pos: ['alert("x")', 'if (confirm ("sure?")) go();', 'var n = prompt("name")', ';alert(1)'], neg: ['PC.ui.dialog.confirm({ title: "x" })', 'ui.dialog.confirm(o)', 'var confirmHandler = null;', 'showAlert(1)', 'obj.prompt("x")'] },
  'native-dialog-global': { pos: ['window.alert("x")', 'globalThis.confirm', 'self . prompt("x")'], neg: ['window.alerts = []', 'PC.ui.dialog.confirm(o)'] },
  'window-open': { pos: ['window.open("x")', 'open("page.html")', 'globalThis.open'], neg: ['dialog.open(o)', 'reopen(o)', 'var isOpen = true;', 'window.opener'] },
  'fetch': { pos: ['fetch("/api")', 'window.fetch (u)'], neg: ['var fetched = 1;', 'prefetch = true'] },
  'xhr': { pos: ['new XMLHttpRequest()'], neg: ['var request = {};'] },
  'beacon': { pos: ['navigator.sendBeacon(u, d)'], neg: ['var beacon = 1;'] },
  'websocket': { pos: ['new WebSocket(u)', 'new EventSource(u)'], neg: ['var socket = 1; var eventSource = 2;'] },
  'service-worker': { pos: ['navigator.serviceWorker.register("sw.js")', 'importScripts("a.js")'], neg: ['var worker = "service";'] },
  'import-statement': { pos: ['import x from "./x.js";', 'import { a } from "./a.js"', 'var a = 1;\nimport * as b from "b";', 'import "./side.js";'], neg: ['var important = 1;', '// this is important for layout', 'var s = "display: none !important";', 'x.importance = 2;', 'var reimport = 1;'] },
  'import-dynamic': { pos: ['var m = import("./m.js")', 'await import ("x")'], neg: ['obj.import("x")', 'reimport("x")'] },
  'export-statement': { pos: ['export default function () {}', 'export const a = 1;', 'var a;\nexport { a };', 'export * from "./a.js"'], neg: ['var exported = 1;', 'PC.house.export = 1;', '// export to 3D is not supported', 'var s = "export the model";'] },
  'eval': { pos: ['eval("1 + 1")', 'var f = new Function("a", "return a")'], neg: ['var evaluate = 1; medieval(2);', 'function make() {}'] },
  'document-write': { pos: ['document.write("<p>")', 'document.writeln("x")'], neg: ['doc.rewrite = 1; documentWriter()'] },
  'download': { pos: ['URL.createObjectURL(blob)', 'a.download = "plan.png"', 'a.setAttribute("download", "x")'], neg: ['var downloads = 0;', 'isDownloadable(x)'] },
  'other-storage': { pos: ['sessionStorage.setItem("a", 1)', 'indexedDB.open("db")', 'document.cookie = "a=1"'], neg: ['var storage = PC.ui.storage; var cookies = 0;'] },
  'local-storage': { pos: ['localStorage.setItem("a", 1)', 'window.localStorage'], neg: ['PC.ui.storage.set("a", 1)', 'var localStore = 1;'] },
  'three-addons': { pos: ['new THREE.OrbitControls(cam)', 'load("examples/js/controls.js")'], neg: ['var orbit = PC.cam.orbit();'] },
  'js-url': { pos: ['<a href="javascript:void(0)">', 'location = "javascript:1"'], neg: ['<p>plain javascript here</p>'] },
  'form': { pos: ['<form action="/x">', '<FORM>'], neg: ['<div role="form">', '<p>formal platform</p>'] },
  'inline-handler': { pos: ['<button onclick="go()">', '<div class="a" onpointerdown=x>'], neg: ['<button data-pc="btn-on" type="button">', '<p>turn on = off</p>', '<input name="one" value="on">'] },
  'module-script': { pos: ['<script type="module">', "<script type='module' >"], neg: ['<script>', '<p>a module of rooms</p>'] },
  'download-attr': { pos: ['<a href="x.png" download>', '<a download="plan" href="#">'], neg: ['<a href="#downloads">', '<button>Download</button>'] },
  'frame': { pos: ['<iframe title="x">', '<object data="a">', '<embed>'], neg: ['<div class="pc-frame">', '<p>objects</p>'] },
  'css-import': { pos: ['@import "a.css";', '@IMPORT url(a.css);'], neg: ['.a { color: red !important; }', '/* important note */'] },
  'css-url': { pos: ['.a { background: url(img.png); }', '.a { background: url( "x.svg" ); }'], neg: ['.a { background: url(data:image/png;base64,AA); }', '.a { background: url("data:image/svg+xml,x"); }', '.curl { color: red; }'] },
  'core-purity': { layer: 'core', pos: ['var w = window.innerWidth;', 'document.title', 'navigator.userAgent', 'setTimeout(f, 1)', 'requestAnimationFrame(f)', 'new THREE.Vector3()', 'clearInterval(t)'], neg: ['var windowed = 1; var documents = []; var three = 3;', 'globalThis.PC = globalThis.PC || {};', 'var timeout = 400;'] },
  'data-literals-only': { layer: 'data',
    pos: [
      '(function (PC) { PC.data.a = [1].map(function (x) { return x; }); })(PC);',
      '(function (PC) { PC.data.f = (x) => x; })(globalThis.PC = globalThis.PC || {});',
      "(function (PC) {\n  'use strict';\n  PC.data.sky = { groundBounce: Math.min(0.25, 1) };\n})(globalThis.PC = globalThis.PC || {});",
      '(function (PC) { PC.data.a = PC.data.b; })(globalThis.PC = globalThis.PC || {});',
      '(function (PC) { PC.data.a = { k: b }; })(globalThis.PC = globalThis.PC || {});',
      '(function (PC) { PC.data.a = { k: 1 + 2 }; })(globalThis.PC = globalThis.PC || {});',
      '(function (PC) { PC.data.a = { w: 2-1 }; })(globalThis.PC = globalThis.PC || {});',
      '(function (PC) { PC.data.a = { s: `x` }; })(globalThis.PC = globalThis.PC || {});',
      '(function (PC) { PC.data.a = { k: x ? 1 : 2 }; })(globalThis.PC = globalThis.PC || {});',
      '(function (PC) { PC.data.a = { x: -y }; })(globalThis.PC = globalThis.PC || {});',
      'PC.data.a = { k: 1 };',
      '(function (PC) { PC.data.a = { k: 1 }; PC.other = 1; })(globalThis.PC = globalThis.PC || {});'
    ],
    neg: [
      '(function (PC) { PC.data.a = { fill: "#fff", dash: [4, 3] }; })(globalThis.PC = globalThis.PC || {});',
      "(function (PC) {\n  'use strict';\n  /* a comment with Math.min( and => */\n  PC.data.a = { '1': 'G', k: -0.5, n: [1e-3, -2], t: true, f: false, z: null }; // tail\n  PC.data.b = [];\n})(globalThis.PC = globalThis.PC || {});"
    ] },
  'mock-backdoor': { pos: ['var m = globalThis.__threeMock;', 'if (window.__threeMock) x();'], neg: ['var threeMock = 1; var mock = PC.three;'] },
  'ui-no-three': { layer: 'ui', pos: ['var v = new THREE.Vector3();'], neg: ['var three = PC.view3d; var THREEISH = 1;'] }
};

const rule = (id) => RULES.find((r) => r.id === id);
const hits = (id, text) => {
  const r = rule(id), c = CASES[id];
  const kind = r.kind === 'any' ? (text.trim().startsWith('<') ? 'html' : 'js') : r.kind;
  return scan(text, { kind, file: 'x', layer: c.layer || 'ui' }).filter((v) => v.includes(': ' + id + ' near'));
};

test('every rule has positive and negative cases', () => {
  assert.deepEqual(Object.keys(CASES).sort(), RULES.map((r) => r.id).sort());
  for (const [id, c] of Object.entries(CASES)) assert.ok(c.pos.length && c.neg.length, id);
});

for (const id of Object.keys(CASES)) {
  test(`rule ${id}: flags the forbidden forms`, () => { for (const t of CASES[id].pos) assert.equal(hits(id, t).length, 1, t); });
  test(`rule ${id}: accepts the look-alikes`, () => { for (const t of CASES[id].neg) assert.equal(hits(id, t).length, 0, t); });
}

test('layer rules apply only to their layer; localStorage is allowed only in ui/storage.js', () => {
  assert.equal(scan('document.title', { kind: 'js', file: 'js/ui/a.js', layer: 'ui' }).length, 0);
  assert.equal(scan('var x = (a) => a;', { kind: 'js', file: 'js/core/a.js', layer: 'core' }).length, 0);
  assert.equal(scan('window.localStorage.getItem("a")', { kind: 'js', file: 'js/ui/storage.js', layer: 'ui' }).length, 0);
  assert.equal(scan('window.localStorage.getItem("a")', { kind: 'js', file: 'js/ui/start.js', layer: 'ui' }).length, 1);
});

test('external references: exactly the three.js tag, once, before the inline scripts', () => {
  const ok = `<html><body>${THREE_TAG}\n<script>/* js/main.js */\nvar a = 1;\n</script></body></html>`;
  assert.deepEqual(scanExternal(ok, 'x'), []);
  assert.equal(scanExternal(ok.replace('</body>', '<img src="https://example.com/a.png"></body>'), 'x').length, 1);
  assert.equal(scanExternal(ok.replace('r128', 'r150'), 'x').length, 1);
  assert.ok(scanExternal(ok.replace(THREE_TAG, ''), 'x').length >= 1);
  assert.equal(scanExternal(`<script>/* a */ var a;</script>${THREE_TAG}`, 'x').length, 1);
});

test('the project is clean, and a token planted in the built page is caught', () => {
  const res = lintProject();
  assert.deepEqual(res.violations, []);
  const dist = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');
  const layers = { 'js/core/store.js': 'core' };
  const plant = (needle, add) => { assert.ok(dist.includes(needle), needle); return scanHtml(dist.replace(needle, needle + add), 'dist', layers); };
  assert.equal(scanHtml(dist, 'dist', layers).length, 0);
  assert.ok(plant('/* js/main.js */', '\nalert("x");').some((v) => v.includes('native-dialog')));
  assert.ok(plant('/* js/main.js */', '\nfetch("/x");').some((v) => v.includes('fetch')));
  assert.ok(plant('/* js/main.js */', '\nwindow.localStorage.clear();').some((v) => v.includes('local-storage')));
  assert.ok(plant('/* js/core/store.js */', '\nvar d = document;').some((v) => v.includes('core-purity')));
  assert.ok(plant('<body>', '<form>').some((v) => v.includes('form')));
  assert.ok(plant('<body>', '<button onclick="x()">').some((v) => v.includes('inline-handler')));
});

test('data-literals-only: today\'s five data files pass as they are (TL F4-T1 rider)', () => {
  for (const f of ['palette2d', 'room-labels', 'look3d', 'furniture', 'sky']) {
    const t = readFileSync(new URL(`../../src/js/data/${f}.js`, import.meta.url), 'utf8');
    assert.deepEqual(scan(t, { kind: 'js', file: f, layer: 'data' }), [], f);
  }
});

test('the vendored three.js never reaches the build: licence banner and size tripwire', () => {
  assert.deepEqual(scanVendor('<html>small</html>', 'x'), []);
  assert.equal(scanVendor('/** Copyright 2010-2021 Three.js Authors */', 'x').length, 1);
  assert.equal(scanVendor('x'.repeat(DIST_MAX_BYTES), 'x').length, 1);
  const vendored = readFileSync(new URL('../vendor/three-r128.min.js', import.meta.url), 'utf8');
  // F6-T1c (TL / CTO): the tripwire is 700 000 bytes; the vendored file alone (603 445) trips the banner, and inlined into
  // the built page (app + three) it trips both
  assert.equal(DIST_MAX_BYTES, 700000);
  assert.equal(scanVendor(vendored, 'x').length, 1, 'the vendored file alone: the banner');
  const dist = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');
  assert.equal(scanVendor(dist + vendored, 'x').length, 2, 'the build with three inlined trips both checks');
});

test('F6 dist budget (CTO C-1.3, F6-T1c): DIST_BUDGET_BYTES = 547 302 + 80 000; budget - 1 passes, budget + 1 fails naming C-1.3 and a CTO review', () => {
  assert.equal(DIST_BUDGET_BYTES, 547302 + 80000);
  assert.deepEqual(scanBudget('x'.repeat(DIST_BUDGET_BYTES - 1), 'd'), []);
  assert.deepEqual(scanBudget('x'.repeat(DIST_BUDGET_BYTES), 'd'), []);
  const over = scanBudget('x'.repeat(DIST_BUDGET_BYTES + 1), 'd');
  assert.ok(over.length === 1 && /C-1\.3/.test(over[0]) && /CTO review/.test(over[0]), over[0]);
});
