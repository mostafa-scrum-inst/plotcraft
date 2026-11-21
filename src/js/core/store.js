/* PC.store: the one state object (architecture A-4). Pure: no DOM, no clocks. Autosave is a ui subscriber. */
(function (PC) {
  'use strict';
  var state = null, subs = [], confirmHandler = null, queue = Promise.resolve();

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function freeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(function (k) { freeze(o[k]); }); }
    return o;
  }
  function room(id, type, level, size, master) { return { id: id, type: type, level: level, size: size, area: null, master: !!master }; }

  // Defaults of the PM stories file, 4.1.
  function defaults() {
    return {
      v: PC.DRAFT_V, stage: 1, sampleClean: false,
      plot: { pts: [], closed: false },
      ans: {
        unit: 'm',
        setbacks: { front: 3, back: 2, side: 2 },
        footprintPct: 30, vegPct: 20,
        north: null, streetEdge: null, edgeOv: {},
        floors: 2, basement: false, usableRoof: false,
        ceilingH: 3.0, roofType: 'flat', exterior: 'sand',
        rooms: [room('r1', 'living', 'G', 'M'), room('r2', 'kitchen', 'G', 'M'), room('r3', 'bathroom', 'G', 'M'),
          room('r4', 'bedroom', '1', 'M'), room('r5', 'bedroom', '1', 'M'), room('r6', 'bathroom', '1', 'M')],
        nextRoomId: 7,
        pairs: [],
        stairPos: 'centre', lift: false,
        parking: { cars: 1, covered: false },
        pool: { on: false, size: 'S' },
        extras: { wall: true, gate: 'centre', seating: false },
        interior: { style: 'modern', density: 'full' }
      },
      plans: {}
    };
  }

  function notify(prev, meta) {
    var first = null;
    subs.slice().forEach(function (fn) { try { fn(state, prev, meta); } catch (e) { first = first || e; } });
    if (first) throw first;
  }
  function swap(next, meta) { var prev = state; state = freeze(next); notify(prev, meta); return state; }

  // Levels whose plan is valid now and would not be valid in the candidate state (removed levels included: their
  // signature is 'invalid'). The gate and every own-confirmation dialog use this one function (A-7).
  function affected(cur, cand) {
    return PC.levels.ids(cur).filter(function (id) {
      var plan = cur.plans[id];
      if (!plan) return false;
      var now = PC.sig.level(cur, id);
      return plan.sig === now && PC.sig.level(cand, id) !== now;
    });
  }
  function gate(mutator) {
    var cand = clone(state);
    mutator(cand);
    PC.site.clearOvIfOutlineChanged(state, cand);       // part of the same change: judged together (A-7)
    if (JSON.stringify(cand) === JSON.stringify(state)) return true;
    var hit = PC.store.atRisk(cand), session = PC.store.session;
    if (!hit.length || session.r5Confirmed || !confirmHandler) { PC.store.commit(mutator); return true; }
    // One sentence builder for every R5 dialog (PM round 6, F3-T2 review): it names only what each level holds
    // (manual edits, an approval or both) and says "lost" for levels the change removes.
    var after = PC.levels.ids(cand), gone = hit.filter(function (id) { return after.indexOf(id) < 0; });
    return Promise.resolve(confirmHandler({
      title: 'Regenerate floor plans?',
      text: PC.levels.plansSentence(hit, gone, state),
      ok: 'Continue', cancel: 'Cancel', levels: hit
    })).then(function (ok) {
      if (!ok) { notify(state, { nav: false, replace: false, cancelled: true }); return false; }
      session.r5Confirmed = true;
      PC.store.commit(mutator);
      return true;
    });
  }

  PC.store = {
    room: room,
    defaults: defaults,
    session: { r5Confirmed: false, draftPending: false, invalidFields: {} },   // never saved (A-4)

    // Numeric id order: r8 before r13. Every "sorted by id" uses this.
    cmpId: function (a, b) { return parseInt(String(a).slice(1), 10) - parseInt(String(b).slice(1), 10); },

    init: function (s) { state = freeze(clone(s || defaults())); return state; },
    get: function () { return state; },

    // Clone, mutate, replace, notify. A commit that changes nothing is ignored.
    // Any real commit ends the "unmodified sample" flag unless it is navigation (nav: true) or says keepSample
    // (only the unit change does: switching m / ft is display only, F1-S5). keepSample is otherwise a normal commit.
    commit: function (mutator, opts) {
      var nav = !!(opts && opts.nav), next = clone(state);
      mutator(next);
      PC.site.clearOvIfOutlineChanged(state, next);     // edge overrides never outlive their outline or street edge (A-4)
      if (JSON.stringify(next) === JSON.stringify(state)) return state;
      if (!nav && !(opts && opts.keepSample)) next.sampleClean = false;
      return swap(next, { nav: nav, replace: false, cancelled: false });
    },

    // The R5 gate (A-7). Applies a layout-class change; when it would make a currently valid floor plan stale,
    // the confirm handler is asked first, once per visit to stages 1-2. Resolves true (applied) or false
    // (cancelled: nothing changed; subscribers are told once so controls show the old value again).
    // Proposals are handled one after the other.
    propose: function (mutator) {
      var p = queue.then(function () { return gate(mutator); });
      queue = p.then(function () {}, function () {});
      return p;
    },
    // The gate's computation for a candidate state built from the current one: ids of the levels whose currently
    // valid plan the candidate would make stale or remove, lowest level first.
    affected: function (candidate) { return affected(state, candidate); },
    // R5 (PM round 5, A-7): the affected levels that have something to lose, manual edits or an approval (Skip's
    // approvals count). Only these are asked about and named; untouched generated Drafts regenerate silently and
    // do not use up the once-per-visit question. Own-confirmation dialogs name exactly this set.
    atRisk: function (candidate) {
      return affected(state, candidate).filter(function (id) { var p = state.plans[id]; return p.edited || p.approved; });
    },
    setConfirmHandler: function (fn) { confirmHandler = fn; },
    confirmHandler: function () { return confirmHandler; },

    // Whole-state swap: Resume draft, Start new, Load sample. The given sampleClean flag is kept as is.
    replace: function (s) { PC.store.session.r5Confirmed = false; return swap(clone(s), { nav: false, replace: true, cancelled: false }); },

    // Stage navigation: only the stage number changes.
    go: function (n) {
      if (n === state.stage) return true;
      var st = PC.stages.status(state)[n];
      if (!st || !st.reachable) return false;
      if (n === 3) PC.store.session.r5Confirmed = false;      // a new visit to stages 1-2 will ask again
      // Entering stage 3 brings the plans up to date in the same nav commit (A-7, F3-T1 plan review ruling 2).
      PC.store.commit(function (s) { s.stage = n; if (n === 3) PC.plans.sync(s); }, { nav: true });
      return true;
    },

    subscribe: function (fn) {
      subs.push(fn);
      return function () { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
    }
  };
})(globalThis.PC = globalThis.PC || {});
