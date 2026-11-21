import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load.mjs';
const PC = loadCore(), S = PC.site;
const rectPlot = (w, h, f) => { const s = PC.store.defaults(); s.plot = { pts: [[0, 0], [w, 0], [w, h], [0, h]], closed: true }; s.ans.streetEdge = 0; if (f) f(s.ans, s); return s; };
const closeTo = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);
// The buildable definition, written again here (independent of site.js).
function buildable(site, p) {
  const pts = plain(site.ptsL), n = pts.length; let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; }
  let ok = inside;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
    if (site.setbackOf[i] > 0 && d < site.setbackOf[i] - 1e-9) ok = false;
    if (site.setbackOf[i] === 0 && d < 1e-9) return true;
  }
  return ok;
}

test('PM 6.2 sample, exact (mandatory)', () => {
  const s = PC.sample.state(), site = S.analyse(s);
  assert.equal(site.plotArea, 584); assert.equal(site.perimeter.toFixed(2), '96.94'); assert.equal(site.edge, 0);
  assert.deepEqual(plain(site.edgeClass), ['front', 'side', 'back', 'back', 'side']);
  assert.deepEqual(plain(site.setbackOf), [3, 2, 2, 2, 2]);
  assert.deepEqual(plain(site.buildable.bbox), { u0: 2, v0: 3, u1: 18, v1: 28 });
  closeTo(site.buildable.area, 389.5, 1.5, 'buildable area'); assert.equal(site.buildable.ok, true);
  const fp = site.footprint;
  assert.deepEqual([fp.u, fp.v, fp.w, fp.d], [5.25, 8, 9.5, 15], 'footprint exactly');
  assert.equal(fp.area, 142.5); assert.equal(fp.pct.toFixed(1), '24.4'); assert.equal(fp.clamped, false); assert.equal(fp.moved, false); assert.equal(site.noFit, false);
  for (const id of ['G', '1']) { assert.equal(PC.levels.needed(s, id), 120); assert.equal(fp.area - PC.levels.needed(s, id), 22.5, 'hall'); }
  // open space of 6.2: front yard 8 m, back yard 7 m, side yards 5.25 m
  assert.deepEqual([fp.v, 30 - (fp.v + fp.d), fp.u, 20 - (fp.u + fp.w)], [8, 7, 5.25, 5.25]);
  // parking: 2 covered cars, 5 x 5 m in the front yard, right of the 2 m entrance strip (TL condition 1)
  assert.deepEqual(plain(site.parking), { u: 11, v: 0.5, w: 5, d: 5, cars: 2, covered: true });
  assert.ok(site.parking.v + site.parking.d <= fp.v, 'between the street and the front wall');
  const cx = fp.u + fp.w / 2; assert.ok(site.parking.u >= cx + 1, 'clear of the entrance strip');
  // pool S: 6 x 3 m centred behind, 1 m clear of the building and inside the plot
  assert.deepEqual(plain(site.pool), { u: 7, v: 24, w: 6, d: 3 });
  for (const c of [[6, 23], [14, 23], [14, 28], [6, 28]]) assert.ok(PC.geom.pointInPoly(c, plain(site.ptsL)), 'pool clearance corner inside the plot');
  assert.equal(site.veg.area, 146); assert.equal(site.veg.pct, 25); assert.equal(site.veg.reduced, false);
  assert.deepEqual(plain(site.omitted), []);
  assert.ok(fp.area + site.veg.area + 25 + 18 === 331.5, 'area budget of 6.2');
  const v = PC.validate(s);
  assert.deepEqual(plain(v.blocking), []); assert.deepEqual(plain(v.warnings), [], 'the sample has no warnings');
  assert.deepEqual(plain(v.summary.levels), [{ id: 'G', name: 'Ground floor', needed: 120, available: 142.5 }, { id: '1', name: 'First floor', needed: 120, available: 142.5 }]);
  assert.deepEqual([v.summary.plotArea, v.summary.footprintArea, v.summary.vegArea, v.summary.vegPct], [584, 142.5, 146, 25]);
});

test('open plot: no site model', () => {
  const s = PC.store.defaults(); assert.equal(S.analyse(s), null);
  s.plot = { pts: [[0, 0], [10, 0], [10, 10]], closed: false }; assert.equal(S.analyse(s), null);
});

test('edge classes: 40 degrees inclusive is back, a 45 degree chamfer is a side', () => {
  const slanted = (deg) => { const r = deg * Math.PI / 180, s = PC.store.defaults(); s.plot = { pts: [[0, 0], [30, 0], [30, 10], [30 - 10 * Math.cos(r), 10 + 10 * Math.sin(r)], [0, 10 + 10 * Math.sin(r)]], closed: true }; s.ans.streetEdge = 0; return plain(S.analyse(s).edgeClass); };
  assert.deepEqual(slanted(26.6), ['front', 'side', 'back', 'back', 'side']);
  assert.equal(slanted(40)[2], 'back', 'exactly 40 degrees'); assert.equal(slanted(39.5)[2], 'back');
  assert.equal(slanted(40.5)[2], 'side'); assert.equal(slanted(45)[2], 'side', '45 degree chamfer');
  const sq = rectPlot(20, 20); assert.deepEqual(plain(S.analyse(sq).edgeClass), ['front', 'side', 'back', 'side']);
  sq.ans.streetEdge = 1; assert.deepEqual(plain(S.analyse(sq).edgeClass), ['side', 'front', 'side', 'back'], 'classes follow Q6');
  sq.ans.setbacks = { front: 4, back: 1, side: 0 }; assert.deepEqual(plain(S.analyse(sq).setbackOf), [0, 4, 0, 1]);
});

test('mask equals the definition on the sample lattice; rectFits is exact', () => {
  const site = S.analyse(PC.sample.state()), m = site.mask; let checked = 0;
  for (let j = 0; j < m.nv; j += 3) for (let i = 0; i < m.nu; i += 3) {
    const p = [(m.i0 + i) * 0.25, (m.j0 + j) * 0.25];
    assert.equal(m.bits[j * m.nu + i] === 1, buildable(site, p), `node ${p}`); assert.equal(S.isBuildable(site, p), buildable(site, p), `isBuildable ${p}`); checked++;
  }
  assert.ok(checked >= 200);
  assert.equal(S.rectFits(site, { u: 2, v: 3, w: 16, d: 20 }), true, 'touching the setback lines is allowed');
  assert.equal(S.rectFits(site, { u: 1.99, v: 3, w: 16, d: 20 }), false, 'into the side setback');
  assert.equal(S.rectFits(site, { u: 2, v: 2.99, w: 5, d: 5 }), false, 'into the front setback');
  assert.equal(S.rectFits(site, { u: 2, v: 20, w: 5, d: 8 }), false, 'into the angled back setback');
  assert.equal(S.rectFits(site, { u: 8.5, v: 23, w: 9.5, d: 5 }), true, 'right of the angled corner');
  assert.equal(S.rectFits(site, { u: 30, v: 5, w: 2, d: 2 }), false, 'outside the plot');
});

test('zero setbacks: the whole plot is buildable, boundary included', () => {
  const s = rectPlot(20, 30, (a) => { a.setbacks = { front: 0, back: 0, side: 0 }; }), site = S.analyse(s);
  assert.deepEqual(plain(site.buildable.bbox), { u0: 0, v0: 0, u1: 20, v1: 30 }); assert.equal(site.buildable.area, 600);
  assert.equal(S.rectFits(site, { u: 0, v: 0, w: 20, d: 30 }), true); assert.equal(S.rectFits(site, { u: 0, v: 0, w: 20.01, d: 30 }), false);
});

test('memo: same inputs give the same object; every input of analyse gives a new one; other answers do not', () => {
  S.clearMemo();
  const base = () => PC.sample.state(), first = S.analyse(base());
  assert.equal(S.analyse(base()), first, 'same inputs');
  const changes = { 'plot point': (s) => { s.plot.pts[2] = [20, 29]; }, 'street edge': (s) => { s.ans.streetEdge = 1; }, 'front setback': (s) => { s.ans.setbacks.front = 4; },
    'back setback': (s) => { s.ans.setbacks.back = 3; }, 'side setback': (s) => { s.ans.setbacks.side = 1; }, 'footprint %': (s) => { s.ans.footprintPct = 30; },
    'vegetation %': (s) => { s.ans.vegPct = 30; }, 'cars': (s) => { s.ans.parking.cars = 1; }, 'covered': (s) => { s.ans.parking.covered = false; },
    'pool on': (s) => { s.ans.pool.on = false; }, 'pool size': (s) => { s.ans.pool.size = 'M'; } };
  for (const [name, f] of Object.entries(changes)) {
    const s = base(); f(s); const site = S.analyse(s);
    assert.notEqual(site, first, name);
    const strip = (x) => { const c = { ...x }; delete c.mask; delete c.frame; return JSON.stringify(c); };
    assert.notEqual(strip(site), strip(first), name + ' changes the result');
    assert.equal(S.analyse(base()), first, 'the first result is still served (' + name + ')');
  }
  const same = { unit: (s) => { s.ans.unit = 'ft'; }, exterior: (s) => { s.ans.exterior = 'grey'; }, rooms: (s) => { s.ans.rooms.pop(); }, north: (s) => { s.ans.north = 90; }, stage: (s) => { s.stage = 2; } };
  for (const [name, f] of Object.entries(same)) { const s = base(); f(s); assert.equal(S.analyse(s), first, name); }
  const nullEdge = base(); nullEdge.ans.streetEdge = null; assert.equal(S.analyse(nullEdge), first, 'null street edge resolves to the same edge');
});

test('parking: default 20 x 20 m plot has a 5.25 m front yard, so the car goes to the side yard', () => {
  const site = S.analyse(rectPlot(20, 20));
  assert.deepEqual([site.footprint.u, site.footprint.v, site.footprint.w, site.footprint.d], [4.5, 5.25, 11, 10.5]);
  assert.deepEqual(plain(site.parking), { u: 15.5, v: 0.5, w: 2.5, d: 5, cars: 1, covered: false });
  assert.ok(site.parking.u >= site.footprint.u + site.footprint.w, 'beside the building'); assert.deepEqual(plain(site.omitted), []);
});

test('parking: entrance strip is kept free when there is room, used only as the last resort; omitted when nothing fits', () => {
  const four = PC.sample.state(); four.ans.parking.cars = 4;                      // 10 m of cars on a 20 m street
  const p = S.analyse(four).parking;
  assert.ok(p && p.w === 10 && p.v + p.d <= 8, 'four cars only fit across the front yard');
  const overlap = Math.max(0, Math.min(p.u + p.w, 11) - Math.max(p.u, 9));           // entrance strip of the sample: u 9-11
  assert.ok(overlap <= 1, `last resort sits against one side: ${overlap} m of the 2 m strip covered`);
  assert.deepEqual([p.u, p.v], [0, 0.5]);
  const one = PC.sample.state(); one.ans.parking.cars = 1; assert.deepEqual(plain(S.analyse(one).parking), { u: 11, v: 0.5, w: 2.5, d: 5, cars: 1, covered: true });
  const none = PC.sample.state(); none.ans.parking.cars = 0; assert.equal(S.analyse(none).parking, null); assert.deepEqual(plain(S.analyse(none).omitted), []);
  const narrow = rectPlot(9, 40, (a) => { a.parking.cars = 4; }), site = S.analyse(narrow);
  assert.equal(site.parking, null); assert.deepEqual(plain(site.omitted), ['parking']);
});

test('pool: omitted when its clearance fits nowhere; beside the building when the back yard is too shallow', () => {
  const big = rectPlot(20, 20, (a) => { a.pool = { on: true, size: 'L' }; }), site = S.analyse(big);
  assert.equal(site.pool, null); assert.deepEqual(plain(site.omitted), ['pool']);
  const wide = rectPlot(40, 20, (a) => { a.pool = { on: true, size: 'S' }; a.footprintPct = 15; }), w = S.analyse(wide), fp = w.footprint;
  assert.ok(w.pool, 'placed'); const k = { u: w.pool.u - 1, v: w.pool.v - 1, w: w.pool.w + 2, d: w.pool.d + 2 };
  assert.ok(k.u >= 0 && k.v >= 0 && k.u + k.w <= 40 && k.v + k.d <= 20, 'clearance inside the plot');
  assert.ok(k.u >= fp.u + fp.w || k.u + k.w <= fp.u || k.v >= fp.v + fp.d, 'clear of the building');
  if (w.parking) assert.equal(PC.geom.rectsOverlap(k, w.parking), false, 'clear of the parking');
});

test('vegetation is reduced to what fits beside building, parking and pool', () => {
  const s = rectPlot(20, 20, (a) => { a.vegPct = 80; a.footprintPct = 20; }), site = S.analyse(s);
  const used = site.footprint.area + 12.5;
  assert.equal(site.veg.reduced, true); assert.equal(site.veg.area, 400 - used); closeTo(site.veg.pct, (400 - used) / 4, 1e-9, 'pct');
  assert.equal(S.analyse(rectPlot(20, 20)).veg.reduced, false);
});

test('geom rectangle helpers', () => {
  const G = PC.geom, r = { u: 2, v: 2, w: 4, d: 2 };
  assert.equal(G.segHitsRect([0, 0], [10, 10], r), true); assert.equal(G.segHitsRect([0, 5], [10, 5], r), false); assert.equal(G.segHitsRect([0, 4], [10, 4], r), true, 'along the top side');
  assert.equal(G.segRectDist([0, 0], [10, 10], r), 0); assert.equal(G.segRectDist([0, 6], [10, 6], r), 2); assert.equal(G.segRectDist([9, 2], [9, 4], r), 3);
  closeTo(G.segRectDist([7, 5], [9, 7], r), Math.SQRT2, 1e-12, 'corner to end point'); closeTo(G.segRectDist([8, 2], [6, 6], r), 2 / Math.sqrt(5) * 1, 0.9, 'corner to segment');
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(G.rectInPoly({ u: 0, v: 0, w: 10, d: 10 }, sq), true, 'touching is inside'); assert.equal(G.rectInPoly({ u: 5, v: 5, w: 6, d: 2 }, sq), false);
  assert.equal(G.rectInPoly({ u: 1, v: 1, w: 8, d: 8 }, [[0, 0], [10, 0], [10, 10], [5, 5], [0, 10]]), false, 'a concave corner pokes in');
  assert.equal(G.rectsOverlap(r, { u: 6, v: 2, w: 2, d: 2 }), false, 'sharing a side is not overlapping'); assert.equal(G.rectsOverlap(r, { u: 5, v: 3, w: 2, d: 2 }), true);
});

// ---- edge-class overrides (F2-S4, A-4 / A-6) ----
test('overrides: automatic and in-effect classes, setbacks, memo key, toggleEdge', () => {
  const s = plain(PC.sample.state()); s.ans.setbacks = { front: 3, back: 5, side: 1 };
  PC.site.clearMemo(); const a = PC.site.analyse(s);
  assert.deepEqual(plain(a.edgeAuto), ['front', 'side', 'back', 'back', 'side']); assert.deepEqual(plain(a.edgeClass), plain(a.edgeAuto));
  assert.deepEqual([a.footprint.w, a.footprint.d, a.footprint.area], [10.5, 13, 136.5]);
  assert.equal(PC.site.toggleEdge(s, 3), true); assert.deepEqual(s.ans.edgeOv, { 3: 'side' });
  const b = PC.site.analyse(s);
  assert.notEqual(b, a, 'memo key holds edgeOv');
  assert.deepEqual(plain(b.edgeAuto), plain(a.edgeAuto)); assert.equal(b.edgeClass[3], 'side'); assert.equal(b.setbackOf[3], 1);
  assert.deepEqual([b.footprint.w, b.footprint.d, b.footprint.area], [10.5, 13.5, 141.75], 'F2-S4 live case: angled edge back -> side');
  assert.equal(PC.site.toggleEdge(s, 3), true); assert.deepEqual(s.ans.edgeOv, {}, 'back to automatic: the entry goes');
  assert.deepEqual(plain(PC.site.analyse(s).footprint), plain(a.footprint), 'previous figures exactly');
  assert.equal(PC.site.toggleEdge(s, 0), false, 'street edge'); assert.equal(PC.site.toggleEdge(s, 5), false, 'out of range'); assert.equal(PC.site.toggleEdge(s, -1), false);
  assert.deepEqual(s.ans.edgeOv, {});
  const open = plain(s); open.plot.closed = false; open.ans.streetEdge = null;
  assert.equal(PC.site.toggleEdge(open, 1), false, 'open plot');
  PC.site.toggleEdge(s, 1); assert.deepEqual(s.ans.edgeOv, { 1: 'back' }, 'a side made back');
});

test('clearOvIfOutlineChanged: every trigger clears, an unrelated change keeps them', () => {
  const base = () => { const s = plain(PC.sample.state()); s.ans.edgeOv = { 3: 'side' }; return s; };
  const after = (f) => { const p = base(), n = base(); f(n); const hit = PC.site.clearOvIfOutlineChanged(p, n); return [hit, plain(n.ans.edgeOv)]; };
  assert.deepEqual(after((n) => { n.plot.pts[2] = [20, 31]; }), [true, {}], 'a point moved');
  assert.deepEqual(after((n) => { n.plot.pts.splice(4, 0, [0, 28]); }), [true, {}], 'a point added');
  assert.deepEqual(after((n) => { n.plot.pts.pop(); }), [true, {}], 'a point removed');
  assert.deepEqual(after((n) => { n.plot.closed = false; n.ans.streetEdge = null; }), [true, {}], 'reopened');
  assert.deepEqual(after((n) => { n.ans.streetEdge = 2; }), [true, {}], 'street edge changed');
  assert.deepEqual(after((n) => { n.ans.streetEdge = null; }), [false, { 3: 'side' }], 'null resolves to the same default edge 0');
  assert.deepEqual(after((n) => { n.ans.footprintPct = 40; n.ans.unit = 'ft'; n.ans.setbacks.back = 6; }), [false, { 3: 'side' }], 'unrelated changes keep them');
  assert.deepEqual(after((n) => { n.plot.pts[2] = [20, 30]; }), [false, { 3: 'side' }], 'a point set to where it already is');
});
