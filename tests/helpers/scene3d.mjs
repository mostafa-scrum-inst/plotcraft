// F4-T2 three tests: open a house in the mock scene and read its batches back (A-16 step 4).
import { load3d } from './load3d.mjs';
import { sampleApproved } from './houses.mjs';
import { itemsOf } from './batch.mjs';

// stateFn(PC) -> a ready stage-5 state (default: the approved sample); edit(house) may change the model before open.
// o: load3d options (F6-T1a: coarse, maxTex, tier).
export function opened(stateFn, edit, o) {
  const E = load3d(o), s = stateFn ? stateFn(E.PC) : sampleApproved(E.PC);
  E.state = s;
  E.house = E.PC.house.build(s);
  if (edit) edit(E.house);
  E.PC.view3d.open(E.house, E.canvas, () => {});
  E.raf.flush(); E.timer.flush(); E.raf.flush();
  E.info = () => E.PC.view3d.info();
  E.world = E.info().world;
  E.mesh = (name, parent) => { let m = null; (parent || E.world).traverse((x) => { if (!m && x.name === name && x.geometry) m = x; }); return m; };
  E.items = (name, parent) => { const m = E.mesh(name, parent); return m ? itemsOf(E.mock, m) : []; };
  E.X = (u) => u - E.house.center[0];
  E.Z = (v) => -(v - E.house.center[1]);
  return E;
}
export const close = (a, b, e = 2e-5) => Math.abs(a - b) < e;   // batch positions are Float32
