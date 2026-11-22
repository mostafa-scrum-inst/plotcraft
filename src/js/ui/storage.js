/* PC.ui.storage: the only file that touches localStorage (A-3). Every access is guarded; on any failure the
   adapter turns into a no-op with available = false. A full quota at start (read
   works, the probe write fails) is the read-only state: the stored draft is still offered (F5-T3a, TL ruling 4).
   PC.ui.autosave: debounced draft writer (A-4); one toast when saving stops mid-session (PM round 14). */
(function (PC) {
  'use strict';
  var ui = PC.ui = PC.ui || {};

  // available = saving works (the probe write succeeded and no write failed since). canRead alone is the read-only
  // state of a full quota (F5-T3a, TL ruling 4): a stored draft is still offered for Resume, nothing is ever written.
  var S = ui.storage = {
    available: false, canRead: false, canWrite: false,
    probe: function () {
      var ls = null;
      try { ls = window.localStorage; ls.getItem('plotcraft.probe'); S.canRead = true; } catch (e) { S.canRead = false; }
      try {
        if (!ls) throw new Error('no storage');
        var k = 'plotcraft.probe';
        ls.setItem(k, '1'); ls.removeItem(k);
        S.canWrite = true;
      } catch (e) { S.canWrite = false; }
      // saving works only when a draft can also be read back (F1 rule; QA F5-T3a B-1): write-only = not saving
      S.available = S.canRead && S.canWrite;
      if (!S.canRead) S.canWrite = false;   // never write what can never be read back
      return S.available;
    },
    get: function (key) {
      if (!S.canRead) return null;
      try { return window.localStorage.getItem(key); } catch (e) { off(); return null; }
    },
    set: function (key, text) {
      if (!S.canWrite) return false;
      try { window.localStorage.setItem(key, text); return true; } catch (e) { off(); return false; }
    },
    remove: function (key) {
      if (!S.canWrite) return false;
      try { window.localStorage.removeItem(key); return true; } catch (e) { off(); return false; }
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
    removeDraft: function () { PC.draft.KEYS.forEach(S.remove); },
    // A stored draft that PC.draft.parse rejected: its raw text goes to one side key (overwritten each time, never
    // read by the app, not in PC.draft.KEYS) before the draft keys are removed, so a validator bug costs a Resume
    // card, not the project (A-4). Start new and Load sample leave it alone.
    REJECTED_KEY: 'plotcraft.draft.rejected',
    keepRejected: function (raw) { return typeof raw === 'string' && S.set(S.REJECTED_KEY, raw); }
  };
  var oldGone = false;
  // Any failure after the probe turns the adapter off entirely (F1 behaviour, unchanged).
  function off() { S.canRead = S.canWrite = S.available = false; }

  var timer = null, dirty = false;
  var A = ui.autosave = {
    DELAY: 400,
    // PM round 14, word for word; shown once per session when saving stops after it worked.
    STOPPED: 'Saving has stopped: this browser\'s storage is full or blocked. Your work stays on screen but will be lost when you close or reload the page.',
    stoppedToast: false,
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
      if (was && !S.available) {                                 // storage just failed: the note, the chip, one toast
        if (ui.start) ui.start.render();
        if (!A.stoppedToast && ui.toast) { A.stoppedToast = true; ui.toast(A.STOPPED, { kind: 'warn', ms: 8000 }); }
      }
    }
  };
})(globalThis.PC = globalThis.PC || {});
