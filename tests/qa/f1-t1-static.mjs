// F1-T1 QA: static checks on dist/index.html + token contrast. Node only (no browser).
// Run: node tests/qa/f1-t1-static.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, readDist, THREE_URL, parseColor, over, contrast, collector } from './lib.mjs';

const R = collector('F1-T1 static');

// ---- build
let buildOut = '';
try { buildOut = execFileSync('node', ['build.mjs'], { cwd: ROOT, encoding: 'utf8' }); R.check('build exits 0', []); }
catch (e) { R.check('build exits 0', ['build failed: ' + e.message]); }
R.note('build: ' + buildOut.trim());
const html = readDist();

// ---- external references
const urls = html.match(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'<>)]*/gi) || [];
R.check('exactly one external URL', urls.length === 1 && urls[0] === THREE_URL ? [] : ['found: ' + JSON.stringify(urls)]);
const tag = '<script src="' + THREE_URL + '"></script>';
R.check('three.js tag is literal and exact', html.split(tag).length === 2 ? [] : ['tag not found exactly once']);
const srcAttrs = html.match(/\s(?:src|href|srcset|poster|data|action|formaction|background|xlink:href)\s*=\s*("[^"]*"|'[^']*')/gi) || [];
const badRefs = srcAttrs.filter((a) => { const v = a.replace(/^[^=]+=\s*/, '').slice(1, -1); return !(v === THREE_URL || v.startsWith('#') || v === 'data:,'); });
R.check('src/href attributes are the three tag, #fragments or data:, only', badRefs);
R.check('three.js tag precedes the inline app scripts and has no defer/async',
  html.indexOf(tag) > 0 && html.indexOf(tag) < html.indexOf('<script>') ? [] : ['order wrong']);
const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]);
R.check('no type=module / defer / async scripts', scripts.filter((a) => /module|defer|async/i.test(a)));

// ---- forbidden constructs
const forbid = [
  ['inline event handler attribute', /<[a-z][^>]*\son[a-z]+\s*=/i],
  ['<form>', /<form\b/i], ['<img>', /<img\b/i], ['<iframe>/<object>/<embed>', /<(iframe|object|embed)\b/i],
  ['<link> other than data icon', /<link\b(?![^>]*href="data:,")/i],
  ['@import', /@import/i], ['@font-face', /@font-face/i], ['css url()', /url\s*\(/i],
  ['javascript: URL', /javascript:/i], ['style attribute', /<[a-z][^>]*\sstyle\s*=/i],
  ['window.open', /window\.open|\bopen\s*\(\s*['"]http/], ['fetch(', /\bfetch\s*\(/], ['XMLHttpRequest', /XMLHttpRequest/],
  ['serviceWorker', /serviceWorker/], ['import statement / dynamic import', /^\s*import\s|\bimport\s*\(/m],
  ['download attribute', /\sdownload(\s|=|>)/i], ['xmlns attribute', /xmlns/i], ['eval/new Function', /\beval\s*\(|new\s+Function/],
  ['user-scalable / maximum-scale zoom lock', /user-scalable|maximum-scale/i],
];
// role="alert" must not trip the alert( rule; the regex requires "alert(".
for (const [name, re] of forbid) { const m = re.exec(html); R.check('no ' + name, m ? ['found near: ' + html.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, ' ')] : []); }

// ---- native dialogs (brief: no alert/confirm/prompt). A call is native when it is a bare call or goes through a global object;
// the app's own in-page API PC.ui.dialog.confirm(...) (A-15) is a member call on another object and is allowed.
const stripJs = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
const manifest = JSON.parse(readFileSync(join(ROOT, 'src/manifest.json'), 'utf8'));
const jsFiles = manifest.js.map((j) => ({ ...j, code: stripJs(readFileSync(join(ROOT, 'src', j.file), 'utf8')) }));
const inlineJs = stripJs([...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n'));
const NATIVE = [/(?<![.\w$])(alert|confirm|prompt)\s*\(/g, /\b(window|globalThis|self|top|parent|frames)\s*(\.\s*|\[\s*['"])(alert|confirm|prompt)\b/g, /\b(showModalDialog|print)\s*\(/g];
const nativeHits = (code) => NATIVE.flatMap((re) => [...code.matchAll(re)].map((m) => code.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')));
R.check('no native alert/confirm/prompt call in dist scripts', nativeHits(inlineJs));
for (const f of jsFiles) R.check(`no native alert/confirm/prompt call in src/${f.file}`, nativeHits(f.code));
R.check('no inline handler string calls a native dialog', [...html.matchAll(/(alert|confirm|prompt)\s*\(/g)].filter((m) => html.lastIndexOf('<script', m.index) < html.lastIndexOf('</script>', m.index) && html.lastIndexOf('<style', m.index) < html.lastIndexOf('</style>', m.index)).map((m) => 'markup: ' + html.slice(m.index - 40, m.index + 30)));

// ---- localStorage (A-3): only src/js/ui/storage.js may touch it, and there every access sits inside a try block that has a catch.
const STORAGE_FILE = 'js/ui/storage.js';
const insideTry = (code, idx) => { // is position idx inside the braces of a `try { ... }` that is followed by `catch`?
  const stack = [];
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '{') stack.push({ at: i, isTry: /\btry\s*$/.test(code.slice(Math.max(0, i - 8), i)) });
    else if (c === '}') { const b = stack.pop(); if (b && b.isTry && b.at < idx && idx < i) return /^\s*catch\b/.test(code.slice(i + 1, i + 12)); }
  }
  return false;
};
for (const f of jsFiles) {
  const hits = [...f.code.matchAll(/\blocalStorage\b|\bsessionStorage\b/g)];
  if (f.file !== STORAGE_FILE) R.check(`src/${f.file} does not touch localStorage/sessionStorage`, hits.map((m) => f.code.slice(Math.max(0, m.index - 40), m.index + 30).replace(/\s+/g, ' ')));
  else R.check(`src/${f.file}: every localStorage access is inside try/catch`, hits.filter((m) => !insideTry(f.code, m.index)).map((m) => 'unguarded: ' + f.code.slice(Math.max(0, m.index - 50), m.index + 40).replace(/\s+/g, ' ')));
}
{ const distHits = [...inlineJs.matchAll(/\blocalStorage\b|\bsessionStorage\b/g)].length, srcHits = jsFiles.reduce((n, f) => n + [...f.code.matchAll(/\blocalStorage\b|\bsessionStorage\b/g)].length, 0);
  R.check('dist has no localStorage use beyond what the manifest sources contain', distHits === srcHits ? [] : [`dist ${distHits} vs src ${srcHits}`]); }
R.check('insideTry self-test', insideTry('try { localStorage.x } catch (e) {}', 6) && !insideTry('localStorage.x; try { y } catch (e) {}', 2) && !insideTry('try { a } finally { } localStorage', 22) ? [] : ['helper broken']);

// ---- head
R.check('meta charset', /<meta charset="utf-8">/i.test(html));
R.check('viewport meta', /<meta name="viewport" content="width=device-width, initial-scale=1">/.test(html));
R.check('lang attribute on <html>', /<html[^>]*\slang="en"/.test(html));
R.check('has <title>', /<title>[^<]+<\/title>/.test(html));

// ---- fonts: every font / font-family declaration resolves to the two system stacks
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
const SYSTEM = new Set(['system-ui', '-apple-system', 'segoe ui', 'roboto', 'helvetica neue', 'arial', 'sans-serif', 'ui-monospace', 'sf mono', 'cascadia mono', 'roboto mono', 'menlo', 'consolas', 'monospace', 'inherit']);
const fontProblems = [];
for (const m of css.matchAll(/(--font-[a-z]+|font-family)\s*:\s*([^;}]+)/g)) {
  if (/^var\(--font-(ui|num)\)$/.test(m[2].trim())) continue;
  for (const fam of m[2].split(',')) { const f = fam.trim().replace(/^["']|["']$/g, '').toLowerCase(); if (!SYSTEM.has(f)) fontProblems.push(`${m[1]}: "${fam.trim()}"`); }
}
for (const m of css.matchAll(/[;{\s]font\s*:\s*([^;}]+)/g)) if (!/var\(--font-(ui|num)\)|inherit/.test(m[1])) fontProblems.push('font shorthand without token: ' + m[1].trim());
R.check('system fonts only (CSS)', fontProblems);
const pal = readFileSync(join(ROOT, 'src/js/data/palette2d.js'), 'utf8');
const palFonts = [...pal.matchAll(/\d+px ([^']+(?:'|$))/g)].flatMap((m) => m[1].replace(/'$/, '').split(',').map((s) => s.trim().replace(/"/g, '').toLowerCase()));
R.check('system fonts only (palette2d canvas fonts)', palFonts.filter((f) => !SYSTEM.has(f)));

// ---- tokens and contrast (computed here from 00-tokens.css, not taken from the plan's table)
const tokCss = readFileSync(join(ROOT, 'src/css/00-tokens.css'), 'utf8');
const T = {}; for (const m of tokCss.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) T[m[1]] = m[2].trim();
R.check('--tap token is 44px', T.tap === '44px' ? [] : ['--tap = ' + T.tap]);
const col = (n) => (n.startsWith('#') ? parseColor(n) : parseColor(T[n]));
const cr = (fg, bg) => contrast(over(col(fg), col(bg)), col(bg));
const TEXT = [ // [foreground, background, where used]
  ['ink', 'paper', 'body text'], ['ink', 'surface', 'text on panels'], ['ink', 'sunk', 'stepper / segmented track'], ['ink', 'canvas', 'canvas labels'],
  ['ink-2', 'paper', 'secondary text'], ['ink-2', 'surface', 'secondary text on panels'], ['ink-2', 'sunk', 'locked step'],
  ['ink-3', 'paper', 'captions'], ['ink-3', 'surface', 'captions on panels'], ['ink-3', 'sunk', 'captions on sunk'],
  ['#FFFFFF', 'accent', 'primary button'], ['#FFFFFF', 'accent-strong', 'primary pressed'], ['accent', 'surface', 'current step / links'],
  ['accent', 'paper', 'links on paper'], ['accent', 'accent-tint', 'selected segment / strip'], ['ink', 'accent-tint', 'text on tint'],
  ['danger-text', 'danger-bg', 'blocking banner'], ['danger-text', 'surface', 'error line'], ['danger-text', 'paper', 'error line on paper'], ['#FFFFFF', 'danger', 'danger button'],
  ['warn-text', 'warn-bg', 'warning banner'], ['warn-text', 'surface', 'warning text'],
  ['ok-text', 'ok-bg', 'approved banner'], ['ok-text', 'surface', 'approved text'], ['#FFFFFF', 'ok', 'approved button'],
];
const table = [];
for (const [fg, bg, use] of TEXT) { const c = cr(fg, bg); table.push(`${fg} on ${bg} = ${c.toFixed(2)} (${use})`); R.check(`text contrast ${fg} on ${bg} >= 4.5`, c >= 4.5 ? [] : [c.toFixed(2)]); }
const NONTEXT = [['focus', 'paper'], ['focus', 'surface'], ['focus', 'sunk'], ['focus', 'accent-tint'], ['focus', 'canvas'], ['border', 'surface'], ['border', 'paper'], ['accent', 'sunk'], ['warn', 'surface']];
for (const [fg, bg] of NONTEXT) { const c = cr(fg, bg); table.push(`${fg} on ${bg} = ${c.toFixed(2)} (non-text, needs 3)`); R.check(`non-text contrast ${fg} on ${bg} >= 3`, c >= 3 ? [] : [c.toFixed(2)]); }
// focus ring against the fills it can sit directly next to (ring is offset 2px, so informational)
for (const bg of ['accent', 'ok', 'danger', 'ink']) table.push(`focus vs ${bg} fill = ${cr('focus', bg).toFixed(2)} (info: ring is offset onto the surrounding surface)`);

// ---- palette2d: literals only, required keys, canvas text contrast
const PC = {}; new Function('globalThis', readFileSync(join(ROOT, 'src/js/core/ns.js'), 'utf8') + '\n' + pal)({ PC });
const P = (PC.data || {}).palette2d || new Function('g', `${readFileSync(join(ROOT, 'src/js/core/ns.js'), 'utf8')}\n${pal}\nreturn g.PC.data.palette2d;`)({});
const need = ['canvas', 'grid', 'plot', 'vertex', 'label', 'edge', 'setback', 'buildable', 'footprint', 'hall', 'stair', 'lift', 'parking', 'pool', 'north', 'room', 'state', 'line', 'font'];
R.check('palette2d has all required groups', need.filter((k) => P[k] === undefined).map((k) => 'missing ' + k));
const ROOMS = ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'majlis', 'office', 'maid', 'storage', 'laundry'];
R.check('palette2d has a tint for each of the 10 room types', ROOMS.filter((k) => !P.room[k]).map((k) => 'missing room.' + k));
R.check('palette2d room tints are 10 distinct colours', new Set(ROOMS.map((k) => P.room[k])).size === 10 ? [] : ['duplicates']);
R.check('palette2d state keys', ['selection', 'invalid', 'approved'].filter((k) => !P.state[k]).map((k) => 'missing state.' + k));
const pc = (a, b) => contrast(over(parseColor(a), parseColor(b)), parseColor(b));
for (const k of ROOMS) { const c = pc(P.label.text, P.room[k]); R.check(`palette: label text on room.${k} >= 4.5`, c >= 4.5 ? [] : [c.toFixed(2)]); }
for (const [n, fg, bg] of [['label on canvas', P.label.text, P.canvas], ['muted label on canvas', P.label.muted, P.canvas], ['grid label on canvas', P.grid.label, P.canvas], ['label on hall', P.label.text, P.hall], ['label on stair', P.label.text, P.stair], ['label on lift', P.label.text, P.lift], ['label on parking', P.label.text, P.parking.fill], ['label on pool', P.label.text, P.pool.fill]]) {
  const c = pc(fg, bg); table.push(`palette ${n} = ${c.toFixed(2)}`); R.check(`palette: ${n} >= 4.5`, c >= 4.5 ? [] : [c.toFixed(2)]);
}
for (const [n, fg, bg] of [['plot stroke', P.plot.stroke, P.canvas], ['vertex stroke', P.vertex.stroke, P.canvas], ['first vertex', P.vertex.first, P.canvas], ['setback line', P.setback.line, P.canvas], ['buildable line', P.buildable.line, P.canvas], ['footprint stroke', P.footprint.stroke, P.canvas], ['edge.front', P.edge.front, P.canvas], ['edge.back', P.edge.back, P.canvas], ['edge.side', P.edge.side, P.canvas], ['selection', P.state.selection, P.canvas], ['invalid', P.state.invalid, P.canvas], ['approved', P.state.approved, P.canvas], ['grid.major', P.grid.major, P.canvas]]) {
  const c = pc(fg, bg); table.push(`palette ${n} vs canvas = ${c.toFixed(2)}`);
  if (n !== 'grid.major') R.check(`palette: ${n} vs canvas >= 3`, c >= 3 ? [] : [c.toFixed(2)]);
}
const palBody = pal.replace(/\/\*[\s\S]*?\*\//g, '');
R.check('palette2d.js is literals only (no function calls / DOM)', /document|window|function\s*\(\s*\)|=>|\bnew\b/.test(palBody.replace(/\(function \(PC\) \{|\}\)\(globalThis\.PC = globalThis\.PC \|\| \{\}\);/g, '')) ? ['code found'] : []);

// ---- source layout rules of A-1 that apply now
const man = manifest;
{ // A-1 / A-2: manifest is complete and ordered, layers match folders, one inline script per file (valid for every later task)
  const f = [], walk = (d) => readdirSync(join(ROOT, 'src', d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);
  const listed = new Set([...man.css, ...man.js.map((j) => j.file)]);
  for (const x of [...walk('css'), ...walk('js')]) if (!listed.has(x)) f.push('not in manifest: ' + x);
  for (const x of listed) if (!existsSync(join(ROOT, 'src', x))) f.push('manifest file missing: ' + x);
  if (listed.size !== man.css.length + man.js.length) f.push('duplicate manifest entries');
  for (const j of man.js) { const dir = /^js\/(core|data|ui|three)\//.exec(j.file); const want = dir ? dir[1] : (j.file === 'js/main.js' ? 'ui' : null); if (!want) f.push('unexpected location: ' + j.file); else if (j.layer !== want) f.push(`${j.file}: layer ${j.layer}, folder says ${want}`); }
  if (man.js[0].file !== 'js/core/ns.js') f.push('js/core/ns.js must be first'); if (man.js[man.js.length - 1].file !== 'js/main.js') f.push('js/main.js must be last');
  for (const need of ['js/core/ns.js', 'js/data/palette2d.js', 'js/main.js', 'css/00-tokens.css']) if (!listed.has(need)) f.push('F1-T1 file gone: ' + need);
  if (JSON.stringify(man.css) !== JSON.stringify([...man.css].sort())) f.push('css not in numeric order');
  R.check('manifest complete, ordered, layers match folders', f);
  const order = man.js.map((j) => html.indexOf('/* ' + j.file + ' */')); R.check('dist inlines the JS files in manifest order', order.every((o, k) => o > 0 && (k === 0 || o > order[k - 1])) ? [] : ['order ' + order.join()]);
  // layer rules of A-2 (comments stripped)
  const CORE_BAD = /\b(window|document|navigator|localStorage|THREE|setTimeout|setInterval|requestAnimationFrame)\b/, lf = [];
  for (const j of jsFiles) { if (j.layer === 'core') { const m = CORE_BAD.exec(j.code); if (m) lf.push(`core ${j.file} uses ${m[0]}`); } if (j.layer === 'ui' && /\bTHREE\b/.test(j.code)) lf.push(`ui ${j.file} uses THREE`); if (!/^\s*\(function \(PC\) \{/.test(j.code) || !/\}\)\(globalThis\.PC = globalThis\.PC \|\| \{\}\);\s*$/.test(j.code)) lf.push(`${j.file} is not in the A-2 module form`); }
  R.check('layer rules: core free of DOM/timers/THREE, ui free of THREE, A-2 module form', lf);
}
R.check('one inline <script> per JS file', scripts.length === man.js.length + 1 ? [] : [`${scripts.length} script tags`]);
for (const f of [...man.css, ...man.js.map((j) => j.file)]) { const n = readFileSync(join(ROOT, 'src', f), 'utf8').split('\n').length; if (n > 300) R.note(`${f} has ${n} lines (target 300)`); }

console.log('\nContrast table (computed from src/css/00-tokens.css and palette2d.js):'); for (const t of table) console.log('  ' + t);
process.exit(R.done() ? 0 : 1);
