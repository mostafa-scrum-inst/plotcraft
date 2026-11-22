// F6-T1b Designer: the Reset elevation (PC.C.CAM.resetPhi, polar angle from vertical) at candidate values, sample,
// Roof on, real r128, 360x640 / 640x360 / 1280x800 with the panel as it opens. For each: the plot corners and the
// seating pad centre projected with the live camera (r128 Vector3.project, so the desktop lens offset counts) against
// the visible canvas rectangle (left of the panel when it overlaps), and a shot per value (into ../resetphi/).
//   node docs/03-tasks/F6-T1/verify/resetphi.mjs [50,54,58,60,62]
import { launch, open, VIEWPORTS, LANDSCAPE } from '../../../../tests/helpers/browser.mjs';
import { loadCore } from '../../../../tests/helpers/load.mjs';
import { sampleApproved } from '../../../../tests/helpers/houses.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'resetphi');
const PHIS = (process.argv[2] || '50,54,58,60,62').split(',').map(Number);
const st = sampleApproved(loadCore()), browser = await launch();
for (const vp of [VIEWPORTS[0], LANDSCAPE, VIEWPORTS[2]]) {
  const o = await open(browser, vp, { three: 'real' }), { page } = o;
  await page.evaluate((st) => PC.store.replace(st), st);
  await page.waitForFunction(() => { const i = PC.debug.scene(); return i && i.renders > 0 && !i.building; }, null, { timeout: 30000 });
  await page.evaluate(() => { const r = document.querySelector('[data-pc="v3-roof"]'); if (!r.checked) r.click(); });
  if (await o.hook('v3-tab-view').isVisible()) await o.act('v3-tab-view');
  for (const phi of PHIS) {
    await page.evaluate((phi) => { PC.C.CAM.resetPhi = phi; }, phi);
    await o.act('v3-reset');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const i = PC.debug.scene(), cam = i.camera, h = PC.debug.house(), c = document.querySelector('[data-pc="v3-canvas"]'), cr = c.getBoundingClientRect();
      const p = document.querySelector('[data-pc="v3-panel"]'), pr = p.getBoundingClientRect(), open = !p.classList.contains('is-collapsed');
      // visible rectangle in canvas px: left of the panel when it overlaps the canvas from the right (desktop card), above it when it is a bottom dock
      let W = cr.width, H = cr.height;
      if (open && pr.left > cr.left + 1 && pr.left < cr.right - 1 && pr.top <= cr.top + 80) W = pr.left - cr.left;
      if (open && pr.top > cr.top + 1 && pr.top < cr.bottom - 1 && pr.left <= cr.left + 1) H = pr.top - cr.top;
      const px = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * cr.width, (1 - v.y) / 2 * cr.height]; };
      const T = (u, v) => [u - h.center[0], -(v - h.center[1])];
      const corners = h.plot.pts.map((q) => { const t = T(q[0], q[1]); return px(t[0], 0, t[1]); });
      const s = h.site.seating, sc = s ? T(s.u + s.w / 2, s.v + s.d / 2) : null, seat = sc ? px(sc[0], 0.4, sc[1]) : null;
      const inside = (q) => q[0] >= 0 && q[0] <= W && q[1] >= 0 && q[1] <= H;
      return { W: Math.round(W), H: Math.round(H), plotIn: corners.every(inside), margin: Math.round(Math.min(...corners.map((q) => Math.min(q[0], W - q[0], q[1], H - q[1])))), seat: seat ? inside(seat) : 'none', pose: PC.view3d.pose().radius.toFixed(1) };
    });
    await page.screenshot({ path: join(OUT, `phi${phi}-${vp.tag}.jpg`), quality: 80 });
    console.log(vp.tag, 'phi', phi, JSON.stringify(r));
    if (vp.w === 360) {   // the phone dock covers the canvas bottom while open: also measure the full canvas (panel collapsed)
      await o.act('v3-panel-toggle'); await page.waitForTimeout(300);
      const full = await page.evaluate(() => { const cam = PC.debug.scene().camera, h = PC.debug.house(), cr = document.querySelector('[data-pc="v3-canvas"]').getBoundingClientRect();
        const pts = h.plot.pts.map((q) => { const v = new THREE.Vector3(q[0] - h.center[0], 0, -(q[1] - h.center[1])).project(cam); return [(v.x + 1) / 2 * cr.width, (1 - v.y) / 2 * cr.height]; });
        return { W: Math.round(cr.width), H: Math.round(cr.height), margin: Math.round(Math.min(...pts.map((q) => Math.min(q[0], cr.width - q[0], q[1], cr.height - q[1])))) }; });
      await page.screenshot({ path: join(OUT, `phi${phi}-${vp.tag}-collapsed.jpg`), quality: 80 });
      console.log(vp.tag, 'phi', phi, 'collapsed', JSON.stringify(full));
      await o.act('v3-panel-toggle'); await page.waitForTimeout(200);
      if (await o.hook('v3-tab-view').isVisible()) await o.act('v3-tab-view');
    }
  }
  await o.ctx.close();
}
await browser.close();
