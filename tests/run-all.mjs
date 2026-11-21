// One command for everything (A-16): build -> lint -> unit -> three -> e2e -> qa. Exit code 1 when anything fails.
//
//   node tests/run-all.mjs                         full run (mandatory at the implementation review and at QA sign-off)
//   node tests/run-all.mjs --unit                  build, lint, unit tests only (a few seconds)
//   node tests/run-all.mjs --unit --e2e --only plot,shell
//                                                  focused run for one task: build, lint, unit, and only the
//                                                  browser files whose name contains one of the given words
//   node tests/run-all.mjs --qa --only f1-t3       one QA suite
//   --jobs N                                       browser files run N at a time (default 3: two green full runs at 3
//                                                  on this 4-core machine, TL F4-T1 outcome review; target <= 420 s)
//
// Steps: --unit, --three, --e2e (tests/e2e/*.spec.mjs), --qa (QA's own suites, tests/qa/run-*.mjs, without
// screenshots). No step flag = all steps. Build and lint always run. Browser files are separate processes with
// their own browser, pages opened from file:// and no shared files, so they can run side by side; their output is
// printed whole, file by file, when each one ends.
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..'), started = Date.now();
const args = process.argv.slice(2), only = ['--unit', '--three', '--e2e', '--qa'].filter((f) => args.includes(f));
const want = (f) => only.length === 0 || only.includes(f);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const words = (opt('--only') || '').split(',').map((w) => w.trim()).filter(Boolean);
const jobs = Math.max(1, parseInt(opt('--jobs') || '3', 10) || 3);
const secs = (ms) => (ms / 1000).toFixed(1) + ' s';
const list = (dir, ext) => existsSync(join(here, dir)) ? readdirSync(join(here, dir)).filter((f) => f.endsWith(ext)).sort().map((f) => join(here, dir, f)) : [];
const picked = (files) => words.length ? files.filter((f) => words.some((w) => f.slice(here.length + 1).includes(w))) : files;
const done = (ok) => { console.log(`\nrun-all: ${ok ? 'all steps passed' : 'FAILED'} in ${secs(Date.now() - started)}`); process.exit(ok ? 0 : 1); };
const run = (label, argv) => {
  console.log(`\n=== ${label} ===`);
  const t = Date.now(), r = spawnSync(process.execPath, argv, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) { console.log(`\nrun-all: FAILED at "${label}"`); done(false); }
  console.log(`(${label}: ${secs(Date.now() - t)})`);
};
// Runs the tasks `jobs` at a time; each task's output is buffered and printed when it ends. Resolves to the failed labels.
function pool(tasks) {
  return new Promise((resolve) => {
    const failed = []; let next = 0, running = 0;
    const start = () => {
      if (next >= tasks.length) { if (!running) resolve(failed); return; }
      const task = tasks[next++], t = Date.now(), out = []; running++;
      const child = spawn(process.execPath, task.argv, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', (d) => out.push(d)); child.stderr.on('data', (d) => out.push(d));
      child.on('close', (code) => {
        console.log(`\n=== ${task.label} ===`); process.stdout.write(Buffer.concat(out));
        console.log(`(${task.label}: ${code === 0 ? 'ok' : 'FAILED, exit ' + code}, ${secs(Date.now() - t)})`);
        if (code !== 0) failed.push(task.label);
        running--; start();
      });
    };
    for (let i = 0; i < Math.min(jobs, tasks.length); i++) start();
    if (!tasks.length) resolve(failed);
  });
}

run('build', [join(root, 'build.mjs')]);
run('lint', [join(here, 'lint-constraints.mjs')]);
if (want('--unit')) { const f = list('unit', '.test.mjs'); if (f.length) run(`unit (${f.length} files)`, ['--test', '--test-reporter=spec', ...f]); }
if (want('--three')) { const f = list('three', '.test.mjs'); if (f.length) run(`three (${f.length} files)`, ['--test', '--test-reporter=spec', ...f]); else console.log('\n=== three === (no tests yet: starts with F4-T1)'); }
const browser = [];
if (want('--e2e')) for (const f of picked(list('e2e', '.spec.mjs'))) browser.push({ label: 'e2e ' + f.slice(here.length + 1), argv: [f] });
if (want('--qa')) for (const f of picked(list('qa', '.mjs').filter((f) => /[\\/]run-[^\\/]+\.mjs$/.test(f)))) browser.push({ label: 'qa ' + f.slice(here.length + 1), argv: [f, '--no-shots'] });
if (browser.length) console.log(`\n${browser.length} browser file(s), ${jobs} at a time`);
const failed = await pool(browser);
if (failed.length) console.log('\nfailed: ' + failed.join(', '));
done(failed.length === 0);
