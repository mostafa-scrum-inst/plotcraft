// Shared stage-5 helpers for QA suites (F6-T1 onwards).
// Roof on at open (F6-T1 plan §2, TL ruling: suites must not depend on PC.C.VIEW3D.roofOnOpen): the scene initialises
// S.roof from roofOnOpen once per page session; before F6-T1 there is no such value and stage 5 opens with the Roof off.
//   roofOpen(page) -> the state a fresh page session opens with (version-aware);
//   roofTo(S, on)  -> taps the Roof switch (Display tab) only when the scene is not already in that state, then waits.
export const roofOpen = (page) => page.evaluate(() => !!(PC.C.VIEW3D && PC.C.VIEW3D.roofOnOpen));
export const roofNow = (page) => page.evaluate(() => ({ scene: !!PC.debug.scene().roof, ui: !!document.querySelector('[data-pc="v3-roof"]').checked }));
export async function roofTo(S, on) {
  const r = await roofNow(S.page); if (r.scene === on) return false;
  if (!(await S.shown('v3-roof')) && (await S.shown('v3-tab-view'))) await S.act('v3-tab-view');
  await S.act('v3-roof');
  await S.until(() => S.page.evaluate((on) => !!PC.debug.scene().roof === on, on), 3000); await S.settle();
  return true;
}
