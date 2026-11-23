// F4-T2 roof batch (A-10; plan §5; TL plan review Q10 / Q12 and required item 2; Designer plan 4) against the mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { opened, close } from '../helpers/scene3d.mjs';
import { sampleApproved } from '../helpers/houses.mjs';
import { rgbOf, sameRgb, windingProblems } from '../helpers/batch.mjs';

const R = { slab: 0.2, parapet: 0.3, high: 1.0, dripOut: 0.04, copingT: 0.05 };   // F6-T1c: + drip, coping (Designer R1)
const withRoof = (f) => (PC) => sampleApproved(PC, f);
const top = (items) => Math.max(...items.map((i) => i.y1));

test('F6-T1a: the roof group opens shown (PC.C.VIEW3D.roofOnOpen) and is shown only with the Roof switch on and "All"', () => {
  const E = opened(), g = E.world.getObjectByName('roof');
  assert.deepEqual([E.PC.C.VIEW3D.roofOnOpen, E.info().roof, g.visible], [true, true, true]);
  E.PC.view3d.setRoof(false); assert.equal(g.visible, false);
  E.PC.view3d.setRoof(true); assert.equal(g.visible, true);
  E.PC.view3d.setLevel('G'); assert.equal(g.visible, false, 'a single level selected: hidden');
  E.PC.view3d.setLevel('all'); assert.equal(g.visible, true);
  E.PC.view3d.setRoof(false); assert.equal(g.visible, false);
  assert.equal(g.children.map((c) => c.name).join(), 'roofBatch,glazing,roofDeck', 'F6-T1c: + the deck; F6-T2: + glazing');
});

test('Roof on = a closed exterior: wall bands of every above-ground level from floorY + 1.2 to baseY + pitch, flush, exteriors.wall', () => {
  for (const f of [null, (d) => { d.ans.floors = 3; d.ans.basement = true; d.ans.rooms.push({ id: 'r15', type: 'storage', level: 'B', size: 'M', area: null, master: false }, { id: 'r16', type: 'office', level: '2', size: 'M', area: null, master: false }); d.ans.nextRoomId = 17; }]) {
    const E = opened(f ? withRoof(f) : null), h = E.house, it = E.items('roofBatch'), fp = h.footprint, wall = rgbOf(E.PC, E.PC.data.exteriors[h.exterior].wall);
    for (const lv of h.levels) {
      const y0 = lv.baseY + 0.2 + 1.2, y1 = lv.baseY + h.pitch, band = it.filter((i) => i.kind === 'box' && close(i.y0, y0) && close(i.y1, y1));
      if (lv.index < 0) { assert.equal(band.length, 0, 'no band for the basement'); continue; }
      assert.equal(band.length, 4, `level ${lv.id}: 4 band boxes`);
      assert.ok(band.every((b) => sameRgb(b.side, wall)), 'wall colour');
      const x0 = Math.min(...band.map((b) => b.x0)), x1 = Math.max(...band.map((b) => b.x1)), z0 = Math.min(...band.map((b) => b.z0)), z1 = Math.max(...band.map((b) => b.z1));
      assert.ok(close(x0, E.X(fp.u)) && close(x1, E.X(fp.u + fp.w)) && close(z1, E.Z(fp.v)) && close(z0, E.Z(fp.v + fp.d)), 'flush with the footprint');
    }
    const top2 = h.levels[h.levels.length - 1];
    assert.ok(close(top2.baseY + h.pitch, h.roof.baseY), 'the top band ends at roof.baseY');
  }
});

test('flat: 0.2 m slab and a 0.3 m parapet; usable flat 1.0 m; terrace 1.0 m with a 2.4 m pergola over the back third', () => {
  const flat = opened(), y = flat.house.roof.baseY, fi = flat.items('roofBatch');
  const ex = flat.PC.data.exteriors.sand;
  // F6-T1c R1: the slab is the drip edge (exteriors.slab, dripOut proud); the parapet carries a copingT coping
  const fp0 = flat.house.footprint, sl = fi.filter((i) => close(i.y0, y) && close(i.y1, y + R.slab) && sameRgb(i.side, rgbOf(flat.PC, ex.slab)));
  assert.ok(sl.length === 1 && close(sl[0].x1 - sl[0].x0, fp0.w + 2 * R.dripOut) && close(sl[0].z1 - sl[0].z0, fp0.d + 2 * R.dripOut), 'slab');
  assert.ok(close(top(fi), y + R.slab + R.parapet + R.copingT), 'parapet 0.3 m + coping');
  assert.ok(fi.filter((i) => close(i.y1, y + R.slab + R.parapet)).every((i) => sameRgb(i.side, rgbOf(flat.PC, ex.parapet))));
  const uf = opened(withRoof((d) => { d.ans.usableRoof = true; })), ui = uf.items('roofBatch');
  assert.ok(ui.some((i) => close(i.y1, y + R.slab + R.high)), 'usable: 1.0 m parapet');
  const ter = opened(withRoof((d) => { d.ans.roofType = 'terrace'; })), ti = ter.items('roofBatch'), fp = ter.house.footprint;
  assert.ok(ti.some((i) => close(i.y1, y + R.slab + R.high)), 'terrace: 1.0 m parapet');
  assert.ok(close(top(ti), y + R.slab + 2.4), 'pergola at 2.4 m');
  const perg = ti.filter((i) => i.y1 > y + R.slab + R.high + 1e-3 && !sameRgb(i.side, rgbOf(ter.PC, ter.PC.data.exteriors[ter.house.exterior].coping)));   // F6-T1c: not the coping
  assert.ok(perg.length >= 6, `${perg.length} pergola boxes (4 posts + beams)`);
  assert.ok(perg.every((i) => i.z1 <= ter.Z(fp.v + fp.d * 2 / 3) + 2e-5), 'over the back third');
  const posts = perg.filter((i) => close(i.y1 - i.y0, 2.4) && close(i.x1 - i.x0, 0.15));
  assert.equal(posts.length, 4);
});

test('pitched: one gable prism, 30 degrees, ridge along the longer side (both orientations), slopes roof (in roofTiles since F6-T1a) / gables wall, outward winding', () => {
  for (const swap of [false, true]) {
    const E = opened(withRoof((d) => { d.ans.roofType = 'pitched'; }), swap ? (h) => { const f = h.footprint; h.footprint = { u: f.u, v: f.v, w: f.d, d: f.w }; } : null);
    const h = E.house, fp = h.footprint, it = E.items('roofBatch'), pr = it.filter((i) => i.kind === 'prism');
    assert.equal(pr.length, 1);
    const p = pr[0], rise = Math.tan(Math.PI / 6) * Math.min(fp.w, fp.d) / 2;
    assert.ok(close(p.y0, h.roof.baseY) && close(p.y1 - p.y0, rise, 1e-4), 'rise = tan 30 x short / 2, no overhang');
    assert.ok(close(p.x1 - p.x0, fp.w) && close(p.z1 - p.z0, fp.d), 'over exactly the footprint');
    const g = E.mock.raw(E.mock.raw(E.mesh('roofBatch')).geometry), pos = g.attrs.position.array, col = g.attrs.color.array;
    const ridge = []; for (let i = p.first; i < p.first + p.n; i++) if (close(pos[3 * i + 1], p.y1)) ridge.push([pos[3 * i], pos[3 * i + 2]]);
    const dx = Math.max(...ridge.map((r) => r[0])) - Math.min(...ridge.map((r) => r[0])), dz = Math.max(...ridge.map((r) => r[1])) - Math.min(...ridge.map((r) => r[1]));
    if (fp.w >= fp.d) assert.ok(close(dx, fp.w) && close(dz, 0), `ridge along X (w ${fp.w} >= d ${fp.d})`);
    else assert.ok(close(dz, fp.d) && close(dx, 0), `ridge along Z (w ${fp.w} < d ${fp.d})`);
    assert.deepEqual(windingProblems(E.mock, E.mesh('roofBatch'), p), []);
    const ex = E.PC.data.exteriors[h.exterior], kinds = new Set();
    const nor = g.attrs.normal.array;
    for (let i = p.first; i < p.first + p.n; i++) {
      const c = [col[3 * i], col[3 * i + 1], col[3 * i + 2]], ny = nor[3 * i + 1];
      if (Math.abs(ny) < 1e-6) { assert.ok(sameRgb(c, rgbOf(E.PC, ex.wall)), 'gable triangle: wall'); kinds.add('gable'); }
      else { assert.ok(sameRgb(c, rgbOf(E.PC, ex.roof)), 'slope / base: roof'); if (ny > 0) kinds.add('slope'); }
    }
    assert.deepEqual([...kinds].sort(), ['gable']);
    // F6-T1a: the two slopes are the roofTiles mesh (tile map, world UVs in metres, rows along the eaves)
    const tm = E.mesh('roofTiles'), ti = E.items('roofTiles'), tg = E.mock.raw(E.mock.raw(tm).geometry);
    assert.deepEqual([ti.length, ti[0].kind, tm.material, tm.castShadow], [1, 'slopes', E.info().meshes.find((m) => m.name === 'roofTiles').material, true]);
    assert.equal(E.mock.raw(E.mock.raw(tm.material).map).image.width, 512);
    assert.deepEqual(windingProblems(E.mock, tm, ti[0]), []);
    const tn = tg.attrs.normal.array, tc = tg.attrs.color.array, uv = tg.attrs.uv.array, tp = tg.attrs.position.array;
    for (let i = 0; i < tn.length / 3; i++) {
      assert.ok(tn[3 * i + 1] > 0.8 && sameRgb([tc[3 * i], tc[3 * i + 1], tc[3 * i + 2]], rgbOf(E.PC, ex.roof)), 'slope: up-facing, roof colour');
      const along = fp.w >= fp.d ? Math.abs(tp[3 * i]) : Math.abs(tp[3 * i + 2]);
      assert.ok(close(Math.abs(uv[2 * i]), along, 1e-3), 'u = metres along the ridge (rows along the eaves)');
    }
    assert.equal(tn.length / 3, 8, 'two quads');
    assert.ok(!it.some((i) => i.kind === 'box' && i.y0 >= h.roof.baseY - 1e-6), 'no slab or parapet under a gable');
    assert.equal(E.info().textures.length, 6, 'grass, meadow, paving, blob (F6-T1b), interior (F6-T2) + tiles');
  }
});

test('usable roof: a 2.4 m stair head and a 1.2 m lift overrun over their rectangles (parapet); never on a pitched roof; the three types differ', () => {
  const E = opened(withRoof((d) => { d.ans.usableRoof = true; d.ans.lift = true; })), h = E.house, it = E.items('roofBatch'), y = h.roof.baseY + R.slab;
  const ex = E.PC.data.exteriors[h.exterior];
  for (const [r, ht] of [[h.roof.stairHead, 2.4], [h.roof.liftHead, 1.2]]) {
    const b = it.find((i) => close(i.y0, y) && close(i.y1, y + ht) && close(i.x0, E.X(r.u)) && close(i.x1, E.X(r.u + r.w)));
    assert.ok(b, `head ${ht} m`);
    assert.ok(sameRgb(b.side, rgbOf(E.PC, ex.parapet)), 'parapet colour');
  }
  const sig = (t) => { const x = opened(withRoof((d) => { d.ans.roofType = t; })); const m = x.mock.raw(x.mesh('roofBatch')); return [x.mock.raw(m.geometry).attrs.position.array.length, Math.max(...x.items('roofBatch').map((i) => i.y1)).toFixed(3)].join('/'); };
  const s = ['flat', 'terrace', 'pitched'].map(sig);
  assert.equal(new Set(s).size, 3, s.join(' | '));
});
