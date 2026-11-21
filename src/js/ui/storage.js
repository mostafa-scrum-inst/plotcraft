/* PC.ui.storage: the only file that touches localStorage (A-3). Every access is guarded; on any failure the
   adapter turns into a no-op with available = false. PC.ui.autosave: debounced draft writer (A-4). */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};

  var S = ui.storage = {
    available: false,
    probe: function () {
      try {
        var ls = window.localStorage, k = 'plotcraft.probe';
        ls.setItem(k, '1'); ls.removeItem(k);
        S.available = true;
      } catch (e) { S.available = false; }
      return S.available;
    },
    get: function (key) {
      if (!S.available) return null;
      try { return window.localStorage.getItem(key); } catch (e) { S.available = false; return null; }
    },
    set: function (key, text) {
      if (!S.available) return false;
      try { window.localStorage.setItem(key, text); return true; } catch (e) { S.available = false; return false; }
    },
    remove: function (key) {
      if (!S.available) return false;
      try { window.localStorage.removeItem(key); return true; } catch (e) { S.available = false; return false; }
    },

    // The draft (A-4). PC.draft.KEYS is the one list of draft keys, current first: read the first one present,
    // write the current one (the first successful write also removes the older keys), remove them all.
    readDraft: function () {
      var keys = PC.draft.KEYS, i, t;
      for (i = 0; i < keys.length; i++) { t = S.get(keys[i]); if (t !== null) return t; }
      return null;
    },
    writeDraft: function (text) {
      var ok = S.set(PC.draft.KEYS[0], text);
      if (ok && !oldGone) { PC.draft.KEYS.slice(1).forEach(S.remove); oldGone = true; }
      return ok;
    },
    removeDraft: function () { PC.draft.KEYS.forEach(S.remove); }
  };
  var oldGone = false;

  var timer = null, dirty = false;
  var A = ui.autosave = {
    DELAY: 400,
    start: function () {
      PC.store.subscribe(function () { dirty = true; A.schedule(); });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') A.flush(); });
      window.addEventListener('pagehide', A.flush);
    },
    schedule: function () {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(A.flush, A.DELAY);
    },
    // Writes now. Nothing is written while a found draft is still unanswered, and an empty project is not kept.
    flush: function () {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      if (!dirty || PC.store.session.draftPending) return;
      dirty = false;
      var s = PC.store.get(), was = S.available;
      if (PC.draft.isEmpty(s)) S.removeDraft();
      else S.writeDraft(PC.draft.serialize(s, Date.now()));
      if (was && !S.available && ui.start) ui.start.render();   // storage just failed: show the note
    }
  };
})(globalThis.PC = globalThis.PC || {});
