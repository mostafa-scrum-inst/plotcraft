// Build targets (G1, G-plan 4). One source tree, two pages:
//   standard  dist/index.html      three.js r128 global build from cdnjs (A-1), the page everyone gets
//   gpu       dist/gpu/index.html  three.js 0.180.0 WebGPU build, loaded by the bootstrap script in src/index.html (CD-10)
// src/index.html is shared. A block between a line `<!--@IF <target>-->` and a line `<!--@END-->` is kept only in that
// target's page (the marker lines themselves are dropped); blocks do not nest.
// manifest.json: a `js` entry may carry `targets` (default: both). Files that exist for one target only and are not
// part of the standard page live outside src/js (under src/<target>/) and are listed in `targetFiles`, each with the
// `js` entry it follows (`after`), so `manifest.js` stays exactly the standard page's script list (A-1, A-16 checks).
export const TARGETS = ['standard', 'gpu'];
export const OUT = { standard: 'index.html', gpu: 'gpu/index.html' };
export const GPU_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/three.webgpu.min.js';
export const R128_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

const BLOCK = /^<!--@IF (\w+)-->\n([\s\S]*?)^<!--@END-->\n/gm;

// The shell of one target: its own blocks kept (without the marker lines), the other targets' blocks dropped.
export function shellFor(html, target) {
  return html.replace(BLOCK, (m, t, body) => {
    if (!TARGETS.includes(t)) throw new Error(`src/index.html: unknown target "${t}"`);
    return t === target ? body : '';
  });
}

// Every source file of the manifest with its layer, in page order, for one target (or every target: target null).
export function scriptsFor(man, target) {
  const all = [];
  for (const j of man.js) {
    all.push(j);
    for (const x of man.targetFiles || []) if (x.after === j.file) all.push(x);
  }
  const on = (j) => !target || !j.targets || j.targets.includes(target);
  return all.filter(on);
}
