// F5-T3a Designer: stage 3 at 640x360, the panel with the longest blocking message: Approve stays in view.
// node docs/03-tasks/F5-T3/verify/plans640.mjs
import { launch, open, settled, LANDSCAPE } from '../../../../tests/helpers/browser.mjs';
const browser = await launch(), o = await open(browser, LANDSCAPE);
await o.act('btn-sample'); await o.page.evaluate(() => { PC.store.go(2); PC.store.go(3); }); await settled(o.page);
const m = (label) => o.page.evaluate((label) => {
  const q = (h) => document.querySelector(`[data-pc="${h}"]`), R = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; };
  const msg = q('plan-msg'), lh = parseFloat(getComputedStyle(msg).lineHeight) || 16;
  return { label, msg: R(msg), lines: +(msg.getBoundingClientRect().height / lh).toFixed(1), readout: R(document.querySelector(".pc-plans__readout")), panel: R(document.querySelector("[data-stage=\"3\"] .pc-panel")), bar: R(q("btn-next")), scrollH: [document.querySelector("[data-stage=\"3\"] .pc-panel").scrollHeight, document.querySelector("[data-stage=\"3\"] .pc-panel").clientHeight], approve: R(q('btn-approve')), vh: innerHeight };
}, label);
console.log(JSON.stringify(await m('as shipped')));
await o.page.evaluate(() => { const e = document.querySelector('[data-pc="plan-msg"]'); e.dataset.kind = 'block';
  e.textContent = 'Approve is blocked: Bedroom 2 overlaps Bathroom 1 and the stair, and Kitchen is smaller than its minimum size. Move or resize these rooms first.'; });
console.log(JSON.stringify(await m('long block message')));
await browser.close();
