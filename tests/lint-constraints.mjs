// Constraint lint (A-3, A-2). Scans every file under src/ and the built dist/index.html.
// Usage: node tests/lint-constraints.mjs      (exit 1 on any violation)
// Note: patterns also match inside comments, so source comments must not spell the forbidden calls.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const THREE_TAG = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';
const NAT = '(?:alert|confirm|prompt)';

// kind: which text the rule applies to. allow(file): files exempt from the rule.
export const RULES = [
  { id: 'native-dialog', kind: 'js', re: new RegExp(`(?<![.\\w$])${NAT}\\s*\\(`) },   // dialog.confirm( is a member call: allowed
  { id: 'native-dialog-global', kind: 'js', re: new RegExp(`\\b(?:window|self|globalThis|top|parent)\\s*\\.\\s*${NAT}\\b`) },
  { id: 'window-open', kind: 'js', re: /(?:\b(?:window|self|globalThis)\s*\.\s*open\b|(?<![.\w$])open\s*\()/ },
  { id: 'fetch', kind: 'js', re: /\bfetch\s*\(/ },
  { id: 'xhr', kind: 'js', re: /\bXMLHttpRequest\b/ },
  { id: 'beacon', kind: 'js', re: /\bsendBeacon\b/ },
  { id: 'websocket', kind: 'js', re: /\b(?:WebSocket|EventSource)\b/ },
  { id: 'service-worker', kind: 'js', re: /\b(?:serviceWorker|importScripts)\b/ },
  { id: 'import-statement', kind: 'js', re: /(?:^|[;{}])\s*import\s*(?:[\w$*{]|['"])/m },
  { id: 'import-dynamic', kind: 'js', re: /(?<![.\w$])import\s*\(/ },
  { id: 'export-statement', kind: 'js', re: /(?:^|[;{}])\s*export\s+(?:default\b|const\b|let\b|var\b|function\b|class\b|async\b|\{|\*)/m },
  { id: 'eval', kind: 'js', re: /(?:\beval\s*\(|\bnew\s+Function\b)/ },
  { id: 'document-write', kind: 'js', re: /\bdocument\s*\.\s*write(?:ln)?\b/ },
  { id: 'download', kind: 'js', re: /(?:\bcreateObjectURL\b|\.download\s*=|['"]download['"])/ },
  { id: 'other-storage', kind: 'js', re: /(?:\bsessionStorage\b|\bindexedDB\b|\bdocument\s*\.\s*cookie\b)/ },
  { id: 'local-storage', kind: 'js', re: /\blocalStorage\b/, allow: (f) => f === 'js/ui/storage.js' },
  { id: 'three-addons', kind: 'js', re: /(?:\bOrbitControls\b|examples\/js)/ },
  { id: 'js-url', kind: 'any', re: /javascript\s*:/i },
  { id: 'form', kind: 'html', re: /<form\b/i },
  { id: 'inline-handler', kind: 'html', re: /<[a-z][^>]*\son[a-z]+\s*=/i },
  { id: 'module-script', kind: 'html', re: /type\s*=\s*["']?module/i },
  { id: 'download-attr', kind: 'html', re: /<a\b[^>]*\sdownload\b/i },
  { id: 'frame', kind: 'html', re: /<(?:iframe|object|embed)\b/i },
  { id: 'css-import', kind: 'css', re: /@import\b/i },
  { id: 'css-url', kind: 'css', re: /url\s*\(\s*(?!['"]?data:)/i },
  // layer rules (A-2)
  { id: 'core-purity', kind: 'js', layer: 'core', re: /\b(?:window|document|navigator|localStorage|THREE|setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame)\b/ },
  { id: 'data-literals-only', kind: 'js', layer: 'data', find: (t) => dataLiteralViolation(t) },
  { id: 'mock-backdoor', kind: 'any', re: /__threeMock/ },
  { id: 'ui-no-three', kind: 'js', layer: 'ui', re: /\bTHREE\b/ }
];

// data-literals-only (TL F4-T1 rider): a data-layer file, after comments and strings are stripped, holds only the
// IIFE skeleton, `PC.data.<name> =` heads, { } [ ] : , ;, numbers (a leading - only after : [ or ,), true / false /
// null, strings and bare keys (an identifier directly followed by :). No template literals. Returns { index } | null.
const PRE = ['(', 'function', '(', 'PC', ')', '{'];
const POST = ['}', ')', '(', 'globalThis', '.', 'PC', '=', 'globalThis', '.', 'PC', '||', '{', '}', ')', ';'];
const STR = '\u0000S';
export function dataLiteralViolation(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  let t = src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank);
  const tick = t.indexOf('`');
  if (tick >= 0) return { index: tick };
  t = t.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, (m) => STR + ' '.repeat(Math.max(0, m.length - STR.length)));
  const toks = [], re = /\u0000S|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[A-Za-z_$][\w$]*|\|\||\S/g;
  let m;
  while ((m = re.exec(t))) toks.push({ v: m[0], i: m.index });
  const at = (k) => ({ index: k < toks.length ? toks[k].i : t.length });
  for (let k = 0; k < PRE.length; k++) if (!toks[k] || toks[k].v !== PRE[k]) return at(k);
  const end = toks.length - POST.length;
  for (let k = 0; k < POST.length; k++) if (!toks[end + k] || toks[end + k].v !== POST[k]) return at(Math.max(PRE.length, end + k));
  const ident = (v) => /^[A-Za-z_$][\w$]*$/.test(v || '');
  for (let k = PRE.length; k < end; k++) {
    const v = toks[k].v, nx = toks[k + 1] && toks[k + 1].v, pv = toks[k - 1] && toks[k - 1].v;
    if (v === 'PC' && nx === '.' && toks[k + 2]?.v === 'data' && toks[k + 3]?.v === '.' && ident(toks[k + 4]?.v) && toks[k + 5]?.v === '=') { k += 5; continue; }
    if (v.length === 1 && '{}[]:,;'.includes(v)) continue;
    if (v === STR || /^\d/.test(v) || v === 'true' || v === 'false' || v === 'null') continue;
    if (v === '-' && /^\d/.test(nx || '') && (pv === ':' || pv === '[' || pv === ',')) continue;
    if (ident(v) && nx === ':') continue;
    return at(k);
  }
  return null;
}

// Violations of one text. o: { kind: 'js' | 'html' | 'css', file, layer }.
export function scan(text, o) {
  const out = [];
  for (const r of RULES) {
    if (r.kind !== 'any' && r.kind !== o.kind) continue;
    if (r.layer && r.layer !== o.layer) continue;
    if (r.allow && r.allow(o.file || '')) continue;
    const m = r.find ? r.find(text) : r.re.exec(text);
    if (m) out.push(`${o.file || '(text)'}: ${r.id} near "${text.slice(Math.max(0, m.index - 20), m.index + 40).replace(/\s+/g, ' ')}"`);
  }
  return out;
}

const layerOfPath = (f) => f.startsWith('js/core/') ? 'core' : f.startsWith('js/data/') ? 'data' : f.startsWith('js/three/') ? 'three' : 'ui';

// Splits an HTML document into inline scripts, styles and the remaining markup.
export function splitHtml(html) {
  const scripts = [], styles = [];
  let rest = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => { if (body.trim()) scripts.push(body); return `<script${attrs}></script>`; });
  rest = rest.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m, body) => { styles.push(body); return ''; });
  return { scripts, styles, rest };
}

export function scanHtml(html, file, layers = {}) {
  const { scripts, styles, rest } = splitHtml(html), out = [];
  for (const body of scripts) {
    const m = /^\s*\/\* (js\/[\w\-./]+) \*\//.exec(body), f = m ? m[1] : '';
    out.push(...scan(body, { kind: 'js', file: f, layer: layers[f] || (f ? layerOfPath(f) : 'ui') }).map((v) => `${file} > ${v}`));
  }
  for (const body of styles) out.push(...scan(body, { kind: 'css', file }));
  out.push(...scan(rest, { kind: 'html', file }));
  return out;
}

// Exactly one external URL, the three.js tag of the brief, before the first inline script.
export function scanExternal(html, file) {
  const out = [], urls = html.match(/https?:\/\/[^\s"'<>)]+/g) || [];
  if (urls.length !== 1) out.push(`${file}: expected exactly 1 external URL, found ${urls.length}: ${urls.slice(0, 5).join(', ')}`);
  const at = html.indexOf(THREE_TAG);
  if (at < 0 || html.indexOf(THREE_TAG, at + 1) >= 0) out.push(`${file}: the three.js r128 tag must appear exactly once, exactly as in the brief`);
  const firstInline = html.search(/<script>/);
  if (at >= 0 && firstInline >= 0 && firstInline < at) out.push(`${file}: an inline script comes before the three.js tag`);
  return out;
}

// The vendored test copy of three.js (tests/vendor, A-16) must never reach the build: the licence banner is the real
// guard; the size cap is a tripwire (the vendored file alone is 603 445 bytes) — raise it only with that in mind.
// F6-T1c (TL ruling, CTO told): 600 000 -> 700 000; an inlined three.js still puts the build near 1.2 MB. The real
// budget is the C-1.3 line below (dist <= 627 KB), unchanged.
export const DIST_MAX_BYTES = 700000;
// F6 size budget (CTO C-1.3: at most +80 000 bytes over the 547 302 before F6). Over it needs a CTO review.
export const DIST_BUDGET_BYTES = 627302;
export function scanBudget(html, file) {
  const bytes = Buffer.byteLength(html, 'utf8');
  return bytes > DIST_BUDGET_BYTES ? [`${file}: ${bytes} bytes, over the F6 budget of ${DIST_BUDGET_BYTES} bytes (CTO C-1.3: 547 302 + 80 000); going over needs a CTO review`] : [];
}
export function scanVendor(html, file) {
  const out = [];
  if (/Copyright 2010-2021 Three\.js Authors/.test(html)) out.push(`${file}: contains the three.js r128 licence banner: the vendored test copy (tests/vendor) must never be inlined; the app loads r128 from cdnjs only`);
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes >= DIST_MAX_BYTES) out.push(`${file}: ${bytes} bytes >= ${DIST_MAX_BYTES} (tripwire against an inlined three.js; see tests/vendor/README)`);
  return out;
}

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);

export function lintProject(root = ROOT) {
  const src = join(root, 'src'), out = [], warn = [];
  const man = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'));
  const layers = Object.fromEntries(man.js.map((j) => [j.file, j.layer]));
  for (const j of man.js) if (layerOfPath(j.file) !== j.layer) out.push(`manifest: ${j.file} is listed as "${j.layer}" but lives in the ${layerOfPath(j.file)} layer`);
  for (const abs of walk(src)) {
    const f = relative(src, abs).split('\\').join('/'), text = readFileSync(abs, 'utf8');
    if (f.endsWith('.js')) out.push(...scan(text, { kind: 'js', file: f, layer: layers[f] || layerOfPath(f) }));
    else if (f.endsWith('.css')) out.push(...scan(text, { kind: 'css', file: f }));
    else if (f.endsWith('.html')) { out.push(...scanHtml(text, f, layers)); out.push(...scanExternal(text, f)); }
    if (/\.(js|css)$/.test(f) && /https?:\/\//.test(text)) out.push(`${f}: external URL in a source file`);
    if (/\.(js|css)$/.test(f) && text.split('\n').length > 300) warn.push(`${f}: ${text.split('\n').length} lines (target 300)`);
  }
  const dist = join(root, 'dist', 'index.html');
  if (!existsSync(dist)) out.push('dist/index.html is missing: run node build.mjs');
  else {
    const html = readFileSync(dist, 'utf8'); out.push(...scanHtml(html, 'dist/index.html', layers)); out.push(...scanExternal(html, 'dist/index.html'));
    out.push(...scanVendor(html, 'dist/index.html'));
    out.push(...scanBudget(html, 'dist/index.html'));
  }
  return { violations: out, warnings: warn };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { violations, warnings } = lintProject();
  warnings.forEach((w) => console.log('  warn ' + w));
  violations.forEach((v) => console.log('  FAIL ' + v));
  console.log(`[lint] ${violations.length} violation(s), ${warnings.length} warning(s)`);
  process.exit(violations.length ? 1 : 0);
}
