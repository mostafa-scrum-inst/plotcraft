// Loads PlotCraft source files into a bare vm context (no window, document, console or timers) and returns PC.
// A core file that touches the DOM therefore fails by itself.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SRC = join(ROOT, 'src');
export const manifest = () => JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));

// files: paths relative to src/. globals: extra globals for the context (stubs).
export function loadWith(files, globals = {}) {
  const ctx = vm.createContext({ ...globals });
  for (const f of files) vm.runInContext(readFileSync(join(SRC, f), 'utf8'), ctx, { filename: f });
  return ctx.PC;
}
// Fresh PC with every core + data file of the manifest, in manifest order.
export function loadCore(globals = {}) {
  return loadWith(manifest().js.filter((j) => j.layer === 'core' || j.layer === 'data').map((j) => j.file), globals);
}
// Objects created inside the vm have other prototypes: compare them through this.
export const plain = (x) => JSON.parse(JSON.stringify(x));
