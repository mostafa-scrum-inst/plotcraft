// Build-time comment strip (CTO F6-T2 constraints §5). Removes from inlined JS only:
//   - whole lines whose first non-blank characters are `//`;
//   - `/* ... */` blocks that start a line after whitespace (the whole lines when nothing follows the `*/`).
// No other minification, no renaming. src/ keeps its comments; CSS and HTML are untouched.
//
// Safety does not rest on a hand-written lexer. Every candidate line is probed with V8 itself: a control
// character (\u0001) is put where the comment starts and the original script is parsed. If the candidate is in
// code (so the `//` or `/*` really opens a comment), the parse fails on exactly that line. If it sits inside a
// template literal, a string or a block comment, the character is legal there and the line is left alone.
// After the strip every script is parsed again with `new vm.Script`; any error fails the build.
import vm from 'node:vm';

const PROBE = '\u0001';

// The line (1-based) of the first syntax error in `code`, or 0 when it parses.
function errorLine(code, file) {
  try { new vm.Script(code, { filename: file }); return 0; }
  catch (e) {
    if (!(e instanceof SyntaxError) && e.name !== 'SyntaxError') throw e;
    const m = String(e.stack).match(new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':(\\d+)'));
    return m ? Number(m[1]) : -1;
  }
}

// True when position `at` (the start of `//` or `/*` on line `line`) is in code, by the probe above.
function inCode(code, at, line, file) {
  return errorLine(code.slice(0, at) + PROBE + code.slice(at), file) === line;
}

export function stripComments(code, file = 'script.js') {
  const before = errorLine(code, file);
  if (before) throw new Error(`${file}: does not parse before the comment strip (line ${before})`);
  const lines = code.split('\n'), out = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i], lead = text.length - text.trimStart().length, rest = text.slice(lead);
    const start = offset + lead;
    if (rest.startsWith('//') && inCode(code, start, i + 1, file)) { offset += text.length + 1; continue; }
    if (rest.startsWith('/*') && inCode(code, start, i + 1, file)) {
      const end = code.indexOf('*/', start + 2);
      if (end < 0) throw new Error(`${file}:${i + 1}: unterminated block comment`);
      // Skip every line the block covers; keep what follows the `*/` on its last line, if anything.
      let j = i, lineEnd = offset + text.length;
      while (lineEnd < end) { j++; lineEnd += lines[j].length + 1; }
      const lastStart = lineEnd - lines[j].length, tail = lines[j].slice(end + 2 - lastStart);
      if (tail.trim()) out.push(text.slice(0, lead) + tail.trimStart());
      for (let k = i; k <= j; k++) offset += lines[k].length + 1;
      i = j; continue;
    }
    out.push(text); offset += text.length + 1;
  }
  const result = out.join('\n'), after = errorLine(result, file);
  if (after) throw new Error(`${file}: does not parse after the comment strip (line ${after})`);
  return { code: result, removed: code.length - result.length };
}
