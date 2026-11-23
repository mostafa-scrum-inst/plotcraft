import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './build-strip.mjs';
const root = dirname(fileURLToPath(import.meta.url)), src = join(root, 'src');
const read = f => readFileSync(join(src, f), 'utf8');
const man = JSON.parse(read('manifest.json'));
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [relative(src, join(d, e.name))]);
const listed = new Set([...man.css, ...man.js.map(j => j.file)]);
const stray = [...walk(join(src, 'css')), ...walk(join(src, 'js'))].filter(f => !listed.has(f));
if (stray.length) { console.error('Not in manifest: ' + stray.join(', ')); process.exit(1); }
const css = man.css.map(f => `/* ${f} */\n${read(f)}`).join('\n');
// CTO F6-T2 §5: whole-line JS comments are stripped (build-strip.mjs); each script must parse before and after.
let stripped = 0;
const js = man.js.map(j => { const s = stripComments(read(j.file), j.file); stripped += s.removed; return `<script>/* ${j.file} */\n${s.code.replace(/<\/script/gi, '<\\/script')}\n</script>`; }).join('\n');
let html = read('index.html');
if (!html.includes('<!--@CSS-->') || !html.includes('<!--@JS-->')) { console.error('Markers missing in src/index.html'); process.exit(1); }
html = html.replace('<!--@CSS-->', () => `<style>\n${css}\n</style>`).replace('<!--@JS-->', () => js);
const ext = html.match(/(?:src|href)\s*=\s*["']https?:[^"']+/g) || [];
if (ext.length !== 1 || !ext[0].includes('cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')) { console.error('External references: ' + ext.join(' | ')); process.exit(1); }
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'index.html'), html);
console.log(`dist/index.html ${(html.length / 1024).toFixed(1)} kB, ${man.js.length} scripts, ${man.css.length} stylesheets; comments stripped ${(stripped / 1024).toFixed(1)} kB`);
