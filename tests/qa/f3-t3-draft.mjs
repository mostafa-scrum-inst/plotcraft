// F3 debt item 1 QA (node, about 2 s): stale plans must never make the draft unrestorable (CTO F3 finding 1, FS fix in
// core/draft.js plansOk, TL fs-draft-fix-review focus 1 / 3 / 4). Random operation run: room-list operations (delete,
// move to another level, size / type change, add, pair add / remove, remove levels with move or delete on a clone kept
// only when ok, add levels) interleaved with plan edits, approve / un-approve, regenerate and sync (stage-3 entry).
// After EVERY committed state: parse(serialize(s)) deep-equals s. Invariants from my own reading of A-7: a plan is
// fresh exactly when its level's fingerprint (my own: rooms id / type / area, the level's pairs, stairs / lift) is the
// one it was generated for; room-list operations never edit plans (only removed levels' plans go); after sync every
// plan is fresh and lists exactly its level's rooms; fresh plans' unmet = my adjacency of the level's pairs; approved
// => fresh, no overlap. Plus away-and-back and forged drafts.
// Run: node tests/qa/f3-t3-draft.mjs
import { collector } from './lib.mjs';
import * as Q from './f2-t1-ref.mjs';
import { rng } from './f3-t3-ref.mjs';
import { adj, myOverlaps } from './f3-t2-ref.mjs';

const R = collector('F3-T3 draft round trip');
const PC = Q.loadPC();
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const TYPES = Object.keys(Q.ROOM_AREA), SIZES = ['S', 'M', 'L'];
const myLevels = (a) => [...(a.basement ? ['B'] : []), 'G', ...(a.floors >= 2 ? ['1'] : []), ...(a.floors >= 3 ? ['2'] : [])];
const area = (r) => (r.size === null ? r.area : Q.ROOM_AREA[r.type][r.size]);
// My fingerprint of what a level's plan was laid out for (A-7 list; the footprint does not change in this run)
function fp(s, lv) { const a = s.ans, on = a.rooms.filter((r) => r.level === lv), ids = new Set(on.map((r) => r.id)), num = (id) => +id.slice(1);
  const stairs = myLevels(a).length + (a.usableRoof ? 1 : 0) >= 2;
  return JSON.stringify([on.map((r) => [r.id, r.type, area(r)]).sort((x, y) => num(x[0]) - num(y[0])), a.pairs.filter((p) => ids.has(p[0]) && ids.has(p[1])).map((p) => p.slice().sort((x, y) => num(x) - num(y))).sort(), stairs ? [a.stairPos, a.lift ? 1 : 0] : 0]); }
const myUnmet = (s, lv, rooms) => { const by = Object.fromEntries(rooms.map((r) => [r.id, r])), on = new Set(s.ans.rooms.filter((r) => r.level === lv).map((r) => r.id));
  return s.ans.pairs.filter((p) => on.has(p[0]) && on.has(p[1])).filter((p) => !(by[p[0]] && by[p[1]] && adj(by[p[0]], by[p[1]]))).map(String).sort(); };
const roundTrip = (s) => { const d = PC.draft.parse(PC.draft.serialize(s, 1)); return d ? d.state : null; };
function synced(mut) { const s = Q.plain(PC.sample.state()); if (mut) mut(s); s.plans = {}; PC.plans.sync(s); return s; }

// ---------------- 1. random operation run ----------------
const BASES = [synced(), synced((s) => { s.ans.floors = 3; s.ans.basement = true; }), synced((s) => { s.ans.unit = 'ft'; s.ans.lift = true; s.ans.stairPos = 'fl'; })];
const r = rng(0xD7AF7), notRestorable = [], inv = [], cnt = {}, made = {};
const bump = (k) => { cnt[k] = (cnt[k] || 0) + 1; };
let states = 0, foreign = 0;
for (let run = 0; run < 150; run++) {
  const s = Q.plain(BASES[run % BASES.length]);
  // my record: the fingerprint each plan was generated for (all fresh at the start)
  for (const lv of Object.keys(s.plans)) made[run + lv] = fp(s, lv);
  for (let k = 0; k < 24; k++) {
    const before = Q.plain(s), lvs = myLevels(s.ans), lv = lvs[Math.floor(r() * lvs.length)], rooms = s.ans.rooms, pick = () => rooms[Math.floor(r() * rooms.length)], op = r();
    let kind = null, roomOp = false;
    if (op < 0.14) { const p = s.plans[lv]; if (p && !p.error && p.rooms.length && p.sig === PC.sig.level(s, lv)) { const q = p.rooms[Math.floor(r() * p.rooms.length)], c = PC.plans.ctx(s, lv); c.cands = PC.plans.edgeCands(p.rooms, q.id, c); PC.plans.applyEdit(s, lv, PC.plans.moveRect(q, (r() - 0.5) * 3, (r() - 0.5) * 3, c).rect); kind = 'plan edit'; } }
    else if (op < 0.22) { if (s.plans[lv] && PC.plans.approve(s, lv)) kind = 'approve'; }
    else if (op < 0.26) { if (s.plans[lv] && PC.plans.unapprove(s, lv)) kind = 'un-approve'; }
    else if (op < 0.30) { if (PC.plans.regenerate(s, lv)) { kind = 'regenerate'; made[run + lv] = fp(s, lv); } }
    else if (op < 0.38) { PC.plans.sync(s); kind = 'sync'; for (const id of myLevels(s.ans)) made[run + id] = made[run + id] === fp(s, id) && before.plans[id] ? made[run + id] : fp(s, id); }
    else if (op < 0.50) { if (rooms.length > 1 && PC.levels.removeRoom(s, pick().id).ok) { kind = 'delete room'; roomOp = true; } }
    else if (op < 0.60) { const x = pick(), to = lvs.filter((l) => l !== x.level); if (to.length && PC.levels.updateRoom(s, x.id, { level: to[Math.floor(r() * to.length)] }).ok) { kind = 'move room'; roomOp = true; } }
    else if (op < 0.66) { const x = pick(); if (PC.levels.updateRoom(s, x.id, r() < 0.5 ? { size: SIZES[Math.floor(r() * 3)], area: null } : { type: TYPES[Math.floor(r() * TYPES.length)] }).ok) { kind = 'size / type'; roomOp = true; } }
    else if (op < 0.74) { if (PC.levels.addRooms(s, { level: lv, type: TYPES[Math.floor(r() * TYPES.length)], size: SIZES[Math.floor(r() * 3)], area: null, count: 1 }).ok) { kind = 'add room'; roomOp = true; } }
    else if (op < 0.80) { const on = rooms.filter((x) => x.level === lv); if (on.length >= 2) { const a = on[Math.floor(r() * on.length)], b = on[Math.floor(r() * on.length)]; const res = r() < 0.6 ? PC.levels.addPair(s, a.id, b.id) : PC.levels.removePair(s, a.id, b.id); if (res.ok && !res.dup && !eq(s.ans.pairs, before.ans.pairs)) { kind = 'pair add / remove'; roomOp = true; } } }
    else if (op < 0.90) { // remove a level on a clone, kept only when ok (as q-rooms.js / the Q7 dialog do)
      const c = Q.plain(s), choice = r() < 0.5 ? 'move' : 'delete', change = s.ans.basement && r() < 0.4 ? (a) => { a.basement = false; } : s.ans.floors > 1 ? (a) => { a.floors -= 1; } : null;
      if (change) { const res = PC.levels.removeLevels(c, change, choice); if (res.ok && res.gone.length) { for (const key of Object.keys(s)) delete s[key]; Object.assign(s, c); kind = 'remove level (' + choice + ')'; roomOp = true; } else if (!res.ok) bump('remove level refused (not committed)'); } }
    else { if (s.ans.floors < 3 && r() < 0.6) { s.ans.floors += 1; kind = 'add floor'; } else if (!s.ans.basement) { s.ans.basement = true; kind = 'add basement'; } }
    if (!kind) continue;
    bump(kind); states++;
    if (Object.entries(s.plans).some(([id, p]) => p.rooms.some((x) => !s.ans.rooms.some((y) => y.id === x.id && y.level === id)))) foreign++;
    const tag = `run ${run} step ${k} (${kind})`;
    // the draft round trip, exactly
    const back = roundTrip(s); if (!back) notRestorable.push(`${tag}: parse returned null`); else if (!eq(back, s)) notRestorable.push(`${tag}: the restored state differs`);
    // room-list and level operations never edit plans: only removed levels' plans go
    if (roomOp || /add (floor|basement)/.test(kind)) { const want = Object.fromEntries(Object.entries(before.plans).filter(([id]) => myLevels(s.ans).includes(id))); if (!eq(s.plans, want)) inv.push(`${tag}: plans changed by a room-list operation`); }
    for (const id of Object.keys(s.plans)) {
      const p = s.plans[id], mineFresh = made[run + id] === fp(s, id), appFresh = p.sig === PC.sig.level(s, id);
      if (mineFresh !== appFresh) inv.push(`${tag}: ${id} fresh by my fingerprint ${mineFresh}, by the signature ${appFresh}`);
      if (appFresh && !p.error) { const ids = p.rooms.map((x) => x.id).sort().join(), lvIds = s.ans.rooms.filter((x) => x.level === id).map((x) => x.id).sort().join();
        if (ids !== lvIds) inv.push(`${tag}: fresh ${id} plan lists ${ids}, level has ${lvIds}`);
        if (!eq(p.unmet.map(String).sort(), myUnmet(s, id, p.rooms))) inv.push(`${tag}: fresh ${id} unmet ${JSON.stringify(p.unmet)} vs mine ${JSON.stringify(myUnmet(s, id, p.rooms))}`); }
      // a stale plan keeps its flags untouched until sync (A-7: that is how away-and-back returns them); a fresh approved one is sound
      if (p.approved && appFresh && (p.error || myOverlaps(p.rooms, PC.plans.ctx(s, id).core).length)) inv.push(`${tag}: fresh ${id} approved with error / overlap`);
      if (kind === 'sync' && p.approved && !(before.plans[id] && before.plans[id].approved && before.plans[id].sig === p.sig)) inv.push(`${tag}: ${id} approved after sync without being approved and fresh before`);
    }
    if (kind === 'sync') for (const id of myLevels(s.ans)) { const p = s.plans[id]; if (!p || p.sig !== PC.sig.level(s, id)) inv.push(`${tag}: ${id} not fresh after sync`); else if (before.plans[id] && before.plans[id].sig === p.sig && !eq(before.plans[id], p)) inv.push(`${tag}: sync changed a fresh ${id} plan`); }
  }
}
R.check(`1 ${states} committed states in 150 runs (${Object.entries(cnt).map(([k, v]) => `${v} ${k}`).join(', ')}): parse(serialize(s)) deep-equals s after every one`, notRestorable.slice(0, 6).concat(notRestorable.length > 6 ? [`... ${notRestorable.length} in all`] : []));
R.check('1 invariants: room-list operations never touch plans; fresh by my fingerprint = fresh by the signature; fresh plans list exactly their level\'s rooms with unmet = my adjacency; fresh + approved => no error / overlap; sync keeps an approval only on a plan that stays fresh; sync leaves every level fresh and keeps fresh plans', inv.slice(0, 6).concat(inv.length > 6 ? [`... ${inv.length} in all`] : []));
R.note(`${states} states: ${Object.entries(cnt).map(([k, v]) => `${v} ${k}`).join(', ')}; ${foreign} hold a stale plan listing a room that is gone or on another level (the states the old plansOk rejected)`);

// ---------------- 2. away and back (A-7): the old plan returns with its edits and approval ----------------
{ const f = [], s = synced(), lv = '1', p = s.plans[lv], q = p.rooms[0], c = PC.plans.ctx(s, lv); c.cands = PC.plans.edgeCands(p.rooms, q.id, c);
  PC.plans.applyEdit(s, lv, { ...q, w: Math.round((q.w - 0.5) * 100) / 100 }); PC.plans.approve(s, 'G'); PC.plans.approve(s, lv);   // a shrink cannot overlap
  const orig = Q.plain(s), mover = s.ans.rooms.find((x) => x.level === lv && !s.ans.pairs.some((pp) => pp.includes(x.id)) && !x.master);
  if (!(orig.plans[lv].edited && orig.plans[lv].approved)) f.push('setup: First not edited + approved');
  PC.levels.updateRoom(s, mover.id, { level: 'G' });
  let t = roundTrip(s); if (!t) f.push('away: draft not restorable'); else {
    if (!eq(t.plans, orig.plans)) f.push('away: plans changed by the move');
    PC.levels.updateRoom(t, mover.id, { level: lv }); const t2 = roundTrip(t); if (!t2) f.push('back: draft not restorable'); else {
      PC.plans.sync(t2); if (!eq(t2.plans, orig.plans)) f.push('back + sync: the old plans did not return exactly'); if (!eq(t2.ans, orig.ans)) f.push('back: answers differ'); } }
  // a stale plan carries no work at risk: after the move away, atRisk no longer names it (A-7: a stale plan never asks)
  const away = Q.plain(orig); PC.levels.updateRoom(away, mover.id, { level: 'G' });
  // my A-7 reading: only a fresh plan (my fingerprint unchanged since it was made) can be put at risk, so moving the room
  // back asks nothing; the app's R5 predicate on the store must agree
  { const cand = Q.plain(away); PC.levels.updateRoom(cand, mover.id, { level: lv }); PC.store.replace(away);
    const risk = PC.store.atRisk(cand), first = Q.plain(orig), cand1 = Q.plain(orig); PC.levels.updateRoom(cand1, mover.id, { level: 'G' }); PC.store.replace(first);
    const risk1 = PC.store.atRisk(cand1).slice().sort();
    if (risk.length) f.push('moving back asks R5 about stale plans: ' + risk);
    if (!eq(risk1, ['1', 'G'])) f.push('moving away should name both fresh worked-on floors, got ' + risk1); }
  R.check('2 away and back: a room moved off an edited + approved First floor and back (through two draft round trips) brings the old plans back exactly with edits and approvals; the stale plans put nothing at risk', f); }

// ---------------- 3. forged drafts ----------------
{ const f = [], base = synced(), rG = base.ans.rooms.find((x) => x.level === 'G').id;
  const forge = (mut) => { const s = Q.plain(base); mut(s); return PC.draft.parse(PC.draft.serialize(s, 1)); };
  if (!forge(() => {})) f.push('the untouched sample is rejected');
  if (forge((s) => { s.plans['1'].rooms[0].id = rG; })) f.push('fresh First plan listing a Ground room is accepted');
  if (forge((s) => { s.plans['1'].rooms[0].id = 'r99'; s.ans.nextRoomId = 100; })) f.push('fresh plan listing an unknown room is accepted');
  if (forge((s) => { s.plans['1'].unmet = [[s.plans['1'].rooms[0].id, rG]]; })) f.push('fresh plan with an unmet pair naming a Ground room is accepted');
  const stale = forge((s) => { s.plans['1'].rooms[0].id = rG; s.plans['1'].sig = 'old'; });
  if (!stale) f.push('the same plan with a stale signature is rejected'); else { const t = stale.state; PC.plans.sync(t); const ids = t.plans['1'].rooms.map((x) => x.id).sort().join(), want = t.ans.rooms.filter((x) => x.level === '1').map((x) => x.id).sort().join(); if (ids !== want || t.plans['1'].sig !== PC.sig.level(t, '1')) f.push('stale forged plan not regenerated by sync'); }
  for (const [what, mut] of [['malformed room id', (s) => { s.plans.G.rooms[0].id = 'room1'; s.plans.G.sig = 'old'; }], ['duplicate room in a plan', (s) => { s.plans.G.rooms[1].id = s.plans.G.rooms[0].id; s.plans.G.sig = 'old'; }], ['unmet pair of one room', (s) => { s.plans.G.unmet = [['r1', 'r1']]; s.plans.G.sig = 'old'; }], ['__proto__ id', (s) => { s.plans.G.rooms[0].id = '__proto__'; s.plans.G.sig = 'old'; }], ['negative width', (s) => { s.plans.G.rooms[0].w = -1; s.plans.G.sig = 'old'; }]])
    if (forge(mut)) f.push(what + ' accepted');
  R.check('3 forged drafts: a fresh-signature plan with a room of another level, an unknown room or a foreign unmet pair is rejected; the same plan with a stale signature is accepted and regenerated by sync; malformed / duplicate / one-room-pair / __proto__ ids and bad numbers stay rejected', f); }

process.exit(R.done() ? 0 : 1);
