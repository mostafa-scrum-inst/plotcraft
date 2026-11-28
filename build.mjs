import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './build-strip.mjs';
import { TARGETS, OUT, GPU_URL, shellFor, scriptsFor } from './build-targets.mjs';
const root = dirname(fileURLToPath(import.meta.url)), src = join(root, 'src');
const read = f => readFileSync(join(src, f), 'utf8');
const man = JSON.parse(read('manifest.json'));
const walk = d => !existsSync(d) ? [] : readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [relative(src, join(d, e.name))]);
const every = scriptsFor(man, null);
const listed = new Set([...man.css, ...every.map(j => j.file)]);
// G1: gpu-only sources live under src/gpu (build-targets.mjs); every file there must be listed too
const stray = [...walk(join(src, 'css')), ...walk(join(src, 'js')), ...walk(join(src, 'gpu'))].filter(f => !listed.has(f));
if (stray.length) { console.error('Not in manifest: ' + stray.join(', ')); process.exit(1); }
for (const x of man.targetFiles || []) if (!man.js.some(j => j.file === x.after) || !x.targets || !x.targets.length) { console.error('targetFiles entry needs targets and an "after" that is a js entry: ' + x.file); process.exit(1); }
const css = man.css.map(f => `/* ${f} */\n${read(f)}`).join('\n');
const shell = read('index.html');
if (!shell.includes('<!--@CSS-->') || !shell.includes('<!--@JS-->')) { console.error('Markers missing in src/index.html'); process.exit(1); }
// CTO F6-T2 §5: whole-line JS comments are stripped (build-strip.mjs); each script must parse before and after.
const code = {};
let stripped = 0;
for (const j of every) { const s = stripComments(read(j.file), j.file); stripped += s.removed; code[j.file] = s.code.replace(/<\/script/gi, '<\\/script'); }
// External references per target (A-1 / G-plan 4): standard = exactly the r128 tag; gpu = no tag, and the only URL
// is the bootstrap's import of three.js 0.180.0.
function external(html, target) {
  const tags = html.match(/(?:src|href)\s*=\s*["']https?:[^"']+/g) || [];
  if (target === 'standard') return tags.length === 1 && tags[0].includes('cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js') ? [] : tags;
  const urls = html.match(/https?:\/\/[^\s"'<>)]+/g) || [];
  return tags.length === 0 && urls.length === 1 && urls[0] === GPU_URL ? [] : tags.concat(urls);
}
for (const target of TARGETS) {
  const js = scriptsFor(man, target).map(j => `<script>/* ${j.file} */\n${code[j.file]}\n</script>`).join('\n');
  const html = shellFor(shell, target).replace('<!--@CSS-->', () => `<style>\n${css}\n</style>`).replace('<!--@JS-->', () => js);
  const bad = external(html, target);
  if (bad.length) { console.error(`External references (${target}): ` + bad.join(' | ')); process.exit(1); }
  const out = join(root, 'dist', OUT[target]);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`dist/${OUT[target]} ${(html.length / 1024).toFixed(1)} kB, ${scriptsFor(man, target).length} scripts, ${man.css.length} stylesheets` + (target === 'standard' ? `; comments stripped ${(stripped / 1024).toFixed(1)} kB` : ''));
}
