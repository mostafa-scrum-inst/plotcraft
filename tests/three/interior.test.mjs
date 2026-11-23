// F4-T2 furniture batches (A-10; plan §6) and the G6 budget with everything on (plan §8) against the mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened, close } from '../helpers/scene3d.mjs';
import { sampleApproved, maxHouse } from '../helpers/houses.mjs';
import { rgbOf, sameRgb } from '../helpers/batch.mjs';

const st = (f) => (PC) => sampleApproved(PC, f);
const pieces = (h, id) => h.levels.find((l) => l.id === id).rooms.flatMap((r) => r.furniture.map((p) => ({ ...p, room: r })));

test('F6-T2 furniture by material per level: plain parts (and part-less pieces) in "furniture", planks / weave parts in "textured-<id>" (each face on its whole cell), lamp shades in "lamps-<id>" (+ the gate lamps on G); boxes = the model parts in T, colours through col', () => {
  const E = opened(), h = E.house, cells = E.PC.three.atlasCells(512);
  for (const lv of h.levels) {
    const g = E.world.getObjectByName('level-' + lv.id), ps = pieces(h, lv.id), floorY = lv.baseY + 0.2;
    const want = { plain: [], tex: [], lamp: [] };
    ps.forEach((p) => {
      if (!p.parts) want.plain.push(p);
      else p.parts.forEach((t) => want[t.mat === 'plain' ? 'plain' : t.mat === 'lamp' ? 'lamp' : 'tex'].push({ ...t, room: p.room, kind: p.kind }));
    });
    const it = { plain: E.items('furniture', g), tex: E.items('textured-' + lv.id, g).filter((x) => x.kind === 'part'), lamp: E.items('lamps-' + lv.id, g).slice(0, want.lamp.length) };
    for (const k of ['plain', 'tex', 'lamp']) {
      assert.equal(it[k].length, want[k].length, `${lv.id} ${k}`);
      want[k].forEach((p, i) => {
        const b = it[k][i], r = p.room;
        assert.ok(close(b.y0, floorY + p.y0) && close(b.y1, floorY + p.y0 + p.h), `${p.kind} heights`);
        assert.ok(b.x0 >= E.X(r.u) - 2e-5 && b.x1 <= E.X(r.u + r.w) + 2e-5 && b.z1 <= E.Z(r.v) + 2e-5 && b.z0 >= E.Z(r.v + r.d) - 2e-5, `${p.kind} in ${r.id}`);
        assert.ok(close(b.x0, E.X(p.u)) && close(b.z1, E.Z(p.v)), `${p.kind} position`);
        assert.ok(sameRgb(b.side, rgbOf(E.PC, p.color)), `${p.kind} colour`);
      });
    }
    const tm = g.children.find((c) => c.name === 'textured-' + lv.id), uv = E.mock.raw(E.mock.raw(tm).geometry).attrs.uv.array;
    it.tex.forEach((b, i) => {
      const c = cells[want.tex[i].mat];
      for (let v = b.first; v < b.first + 24; v++) assert.ok([c.u0, c.u1].some((x) => close(x, uv[2 * v], 1e-9)) && [c.v0, c.v1].some((x) => close(x, uv[2 * v + 1], 1e-9)), 'part face = its whole cell');
    });
    const fm = g.children.find((c) => c.name === 'furniture'), lm = g.children.find((c) => c.name === 'lamps-' + lv.id);
    assert.ok(fm.castShadow && fm.receiveShadow && tm.castShadow && tm.receiveShadow);
    if (lm) assert.ok(!lm.castShadow && !lm.receiveShadow, 'lamps never cast or receive (CTO 4)');
    const gate = lv.id === 'G' && h.site.wall && h.site.gate ? 2 : 0;
    assert.equal(lm ? E.items('lamps-' + lv.id, g).length : 0, want.lamp.length + gate, lv.id + ' lamps + gate lamps');
  }
});

test('anchors in T (Q14 mirror guard): a "back" piece touches its room\'s back inset (min Z side), a "front" piece the street side', () => {
  const E = opened(), h = E.house;
  let n = 0;
  for (const lv of h.levels) for (const p of pieces(h, lv.id)) {
    const t = E.PC.data.furniture[p.room.type].find((x) => x.id === p.kind);
    if (t.off) continue;                                   // shifted by its offset: not flush
    if (t.anchor === 'back') { assert.ok(close(E.Z(p.v + p.d), E.Z(p.room.v + p.room.d - 0.15)), p.kind); n++; }
    if (t.anchor === 'front') { assert.ok(close(E.Z(p.v), E.Z(p.room.v + 0.15)), p.kind); n++; }
  }
  assert.ok(n >= 3, `${n} anchored pieces checked`);
});

test('Q19 sparse has fewer boxes; Q18 keeps every box and changes colours; the level selector hides furniture with its level', () => {
  const full = opened(), sp = opened(st((d) => { d.ans.interior.density = 'sparse'; })), cl = opened(st((d) => { d.ans.interior.style = 'classic'; }));
  const n = (E) => E.house.levels.reduce((k, l) => k + E.items('furniture', E.world.getObjectByName('level-' + l.id)).length + E.items('textured-' + l.id, E.world.getObjectByName('level-' + l.id)).filter((x) => x.kind === 'part').length, 0);
  assert.ok(n(sp) < n(full), `sparse ${n(sp)} < full ${n(full)}`);
  const g = (E) => E.items('furniture', E.world.getObjectByName('level-G')).concat(E.items('textured-G', E.world.getObjectByName('level-G')).filter((x) => x.kind === 'part'));
  const a = g(full), b = g(cl);
  assert.deepEqual(a.map((i) => [i.x0, i.x1, i.y0, i.y1, i.z0, i.z1]), b.map((i) => [i.x0, i.x1, i.y0, i.y1, i.z0, i.z1]));
  assert.ok(a.some((i, k) => !sameRgb(i.side, b[k].side)), 'colours change');
  full.PC.view3d.setLevel('G');
  assert.equal(full.world.getObjectByName('level-1').visible, false);
  assert.equal(full.world.getObjectByName('level-G').visible, true);
});

test('G6 budget, maximum house with everything (CD-4: 4 x 10 rooms, full, lift, pool L, 4 covered cars, wall, gate, seating, usable terrace) : 27 meshes (F6-T1c: + roofDeck; F6-T1b: + groundRing, blobs; F4-T3: + 3 instanced; F6-T1a: + sky, paving, northNeedle), one shadow light, map 2048 (fine pointer), audit clean, build < 250 ms', () => {
  const st2 = (PC) => { const s = maxHouse(PC); s.ans.usableRoof = true; s.ans.roofType = 'terrace'; PC.plans.sync(s); for (const id of PC.levels.ids(s)) s.plans[id].approved = true; return s; };
  const E = opened(st2), i = E.info(), h = E.house;
  assert.equal(h.levels.reduce((k, l) => k + l.rooms.length, 0), 40);
  assert.ok(h.roof.usable && h.roof.stairHead && h.roof.liftHead && h.site.seating && h.site.pool && h.site.parking && h.site.gate);
  assert.ok(i.meshCount <= 64); assert.equal(i.meshCount, 40);   // F6-T2: + glazing, 4 x (textured, lamps, glow)
  let shadow = 0; i.scene.traverse((x) => { if ((x.name === 'sun' || x.name === 'hemi') && x.castShadow) shadow++; });
  assert.equal(shadow, 1);
  const sun = i.scene.getObjectByName('sun');
  assert.deepEqual([sun.shadow.mapSize.x, sun.shadow.mapSize.y], [2048, 2048]);
  E.info().renderNow();
  assert.ok(E.mock.raw(i.renderer).renders >= 1, 'rendered through the colour audit');
  const t = [];
  for (let k = 0; k < 3; k++) {                         // a rebuild: a new key forces build() (dispose + all builders)
    const h2 = JSON.parse(JSON.stringify(h)); h2.key = 'budget-' + k;
    E.PC.view3d.close(); E.PC.view3d.open(h2, E.canvas, () => {}); E.raf.flush();
    const t0 = performance.now(); E.timer.flush(); t.push(performance.now() - t0);
    assert.deepEqual([E.info().meshCount, E.info().builds], [40, 2 + k], 'rebuilt inside the timed step');
  }
  assert.ok(Math.min(...t) < 250, `build ${Math.min(...t).toFixed(1)} ms`);
});
