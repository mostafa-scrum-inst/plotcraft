/* PC.ui DOM helpers. Elements are found by data-pc hook only (A-2). */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};
  // The element carrying data-pc="hook" (inside root, default: the document). A missing hook is a contract bug: throw.
  ui.$ = function (hook, root) {
    var el = (root || document).querySelector('[data-pc="' + hook + '"]');
    if (!el) throw new Error('PlotCraft: missing hook "' + hook + '"');
    return el;
  };
  ui.$$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  ui.on = function (el, type, fn, opts) { el.addEventListener(type, fn, opts || false); return el; };
  // A fresh copy of a <template data-pc="tpl-...">.
  ui.tpl = function (name) { return ui.$(name).content.firstElementChild.cloneNode(true); };
  ui.show = function (el, visible) { el.hidden = !visible; return el; };
})(globalThis.PC = globalThis.PC || {});
