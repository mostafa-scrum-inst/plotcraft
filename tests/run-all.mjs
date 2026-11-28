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
//   QA_FULL=1 node tests/run-all.mjs               release gate: the QA_FULL-only checks too, and first, alone, the C-4.8
//                                                  build-time step (tests/solo/build-time.mjs); its number is reprinted
//                                                  at the end; --write-durations under QA_FULL=1 writes
//                                                  tests/durations-full.json, which orders QA_FULL runs
//   QA_RELEASE=1 or --only leak-max                 also the release step, after the pool: QA's 200-op maximum-house
//                                                  leak stream plus QA's STREAM_ROWS, and the release rows
//                                                  (tests/qa/f6-t1-leak.mjs --max-only --stream-only / --rows-only / --rows3-only),
//                                                  three processes, one at a time (F6-T2: + --rows3-only; RELEASE_JOBS=N), each limit 300 s (NOTE above 260 s);
//                                                  times and wall time reprinted at the end
//   --write-durations                              after a green full run, rewrite tests/durations.json (commit it
//                                                  with the run)
//   QA_GPU=1 node tests/run-all.mjs [--gpu]        G1: also the /gpu page's suite (tests/gpu/*.mjs: real WebGPU on
//                                                  SwiftShader in a headed Chrome on its own Xvfb display), after
//                                                  everything else, one file at a time; --gpu alone runs only it.
//                                                  Without QA_GPU=1 nothing of it runs (the default run is untouched)
//
// Steps: --unit, --three, --e2e (tests/e2e/*.spec.mjs), --qa (QA's own suites, tests/qa/run-*.mjs, without
// screenshots). No step flag = all steps. Build and lint always run. Browser files are separate processes with
// their own browser, pages opened from file:// and no shared files, so they can run side by side; their output is
// printed whole, file by file, when each one ends. They start longest first (F5-T3c), by tests/durations.json
// (tests/durations-full.json under QA_FULL=1)
// (label -> seconds from the last green full run); files not in the table start first, ties by label.
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..'), started = Date.now();
const args = process.argv.slice(2), only = ['--unit', '--three', '--e2e', '--qa', '--gpu'].filter((f) => args.includes(f));
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
// Two duration tables (TL ruling, F6-T1a): the default run and QA_FULL=1 order files by their own last green run.
const table = join(here, process.env.QA_FULL ? 'durations-full.json' : 'durations.json'), took = {};
const known = (() => { try { return JSON.parse(readFileSync(table, 'utf8')); } catch { return {}; } })();
const longestFirst = (tasks) => tasks.slice().sort((a, b) => {
  const da = known[a.label], db = known[b.label];
  if ((da === undefined) !== (db === undefined)) return da === undefined ? -1 : 1;
  if (da !== undefined && da !== db) return db - da;
  return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
});
// Runs the tasks `jobs` at a time; each task's output is buffered and printed when it ends. Resolves to the failed labels.
function pool(tasks) {
  return new Promise((resolve) => {
    const failed = []; let next = 0, running = 0;
    const start = () => {
      if (next >= tasks.length) { if (!running) resolve(failed); return; }
      const task = tasks[next++], t = Date.now(), out = []; running++;
      // QA_RELEASE belongs to the release step alone: pool files never see it (run-f6-t1 would switch streams)
      const env = Object.assign({}, process.env); delete env.QA_RELEASE;
      const child = spawn(process.execPath, task.argv, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', (d) => out.push(d)); child.stderr.on('data', (d) => out.push(d));
      child.on('close', (code) => {
        console.log(`\n=== ${task.label} ===`); process.stdout.write(Buffer.concat(out));
        console.log(`(${task.label}: ${code === 0 ? 'ok' : 'FAILED, exit ' + code}, ${secs(Date.now() - t)})`);
        if (code !== 0) failed.push(task.label); else took[task.label] = Math.round((Date.now() - t) / 100) / 10;
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
// C-4.8 solo step (CTO / TL, F6-T1a): under QA_FULL=1 the build-time budget runs alone, to its end, before the
// browser pool starts, so nothing else runs beside it; its number is printed again at the end of the report.
const soloFailed = [], soloLines = [];
if (process.env.QA_FULL && want('--e2e') && (!words.length || words.some((w) => 'solo/build-time'.includes(w)))) {
  const f = join(here, 'solo', 'build-time.mjs'), label = 'solo solo/build-time.mjs', t = Date.now();
  console.log(`\n=== ${label} (alone, before the pool) ===`);
  const r = spawnSync(process.execPath, [f], { cwd: root, encoding: 'utf8' });
  process.stdout.write((r.stdout || '') + (r.stderr || ''));
  soloLines.push(...(r.stdout || '').split('\n').filter((l) => l.includes('[C-4.8]')));
  console.log(`(${label}: ${r.status === 0 ? 'ok' : 'FAILED, exit ' + r.status}, ${secs(Date.now() - t)})`);
  if (r.status !== 0) soloFailed.push(label);
}
if (browser.length) console.log(`\n${browser.length} browser file(s), ${jobs} at a time`);
const failed = soloFailed.concat(await pool(longestFirst(browser)));
// Release step (TL ruling, F6-T1a; split in two parallel processes, TL F6-T1c): after the pool, with QA_RELEASE=1 or
// --only leak-max (at release, and when src/js/three/** or the leak suite changes), QA's tests/qa/f6-t1-leak.mjs runs
// as three processes side by side: the 200-operation maximum-house stream (--stream-only; until F6-T2 followed by QA STREAM_ROWS,
// rows moved there after T1c, QA 51f5861, TL Addendum 2) and QA's RELEASE_ROWS, the other rows moved out of the default
// and QA_FULL runs (--rows-only). F6-T2 gate ruling (TL, CTO §6.2 a-e): a third process, --rows3-only = the 50-op
// sample stream (out of the default run) + QA's ROWS3 (the former stream rows); --stream-only is now the 200-op stream
// alone; no timing-sensitive checks in any of them. Keep the sides balanced: each stays <= 260 s. Each has its own limit of 300 s (NOTE above 260 s, TL); each time and the
// wall time are printed again at the end like the C-4.8 line.
if (process.env.QA_RELEASE || words.includes('leak-max')) {
  const leak = join(here, 'qa', 'f6-t1-leak.mjs'), t = Date.now();
  // F6-T2 gate: three processes, one at a time by default (RELEASE_JOBS=N for more). On this 4-core machine three side
  // by side read 347-378 s each (the 200-op stream's picks timed out under that load) and two at a time 287 / 297 s
  // (NOTE), against 203-225 s solo; CTO §6.2 wants each <= 260 s
  const parts = [['release rows', '--rows-only'], ['leak-max stream', '--stream-only'], ['sample stream + rows3', '--rows3-only']];
  const RJ = Math.max(1, +(process.env.RELEASE_JOBS || 1));
  console.log(`\n=== release step: ${parts.map((p) => p[0]).join(' + ')}, ${RJ} at a time (own processes, after the pool) ===`);
  const one = ([name, flag]) => new Promise((res) => {
    const t0 = Date.now(), child = spawn(process.execPath, [leak, '--max-only', flag, '--no-shots'], { cwd: root, env: Object.assign({}, process.env, { QA_RELEASE: '1' }), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => res({ name, flag, code, out, sec: (Date.now() - t0) / 1000 }));
  });
  const runs = new Array(parts.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(RJ, parts.length) }, async () => { while (next < parts.length) { const k = next++; runs[k] = await one(parts[k]); } }));
  for (const r of runs) {
    const label = `release qa/f6-t1-leak.mjs --max-only ${r.flag}`, over = r.sec > 300;
    console.log(`\n=== ${label} ===`); process.stdout.write(r.out);
    console.log(`(${label}: ${r.code === 0 && !over ? 'ok' : 'FAILED' + (over ? ', over 300 s' : ', exit ' + r.code)}, ${r.sec.toFixed(1)} s)`);
    soloLines.push(`  [leak-max] release step, ${r.name}: ${r.sec.toFixed(1)} s, limit 300 s, ${r.code === 0 ? 'checks passed' : 'checks FAILED'}${over ? ' — OVER the limit' : r.sec > 260 ? ' — NOTE above 260 s: TL review' : ''}`);
    if (r.code !== 0 || over) failed.push(label);
  }
  soloLines.push(`  [leak-max] release step wall time: ${((Date.now() - t) / 1000).toFixed(1)} s (${parts.length} processes, ${RJ} at a time)`);
}
// G1 QA_GPU step: after the pool, alone, one file at a time (each starts its own Xvfb + headed Chrome on SwiftShader).
if (process.env.QA_GPU && want('--gpu')) {
  const files = picked(list('gpu', '.mjs')), t = Date.now();
  console.log(`\n=== QA_GPU step: ${files.length} file(s), one at a time ===`);
  for (const f of files) {
    const label = 'gpu ' + f.slice(here.length + 1), t1 = Date.now(), r = spawnSync(process.execPath, [f], { cwd: root, encoding: 'utf8' });
    console.log(`\n=== ${label} ===`); process.stdout.write((r.stdout || '') + (r.stderr || ''));
    console.log(`(${label}: ${r.status === 0 ? 'ok' : 'FAILED, exit ' + r.status}, ${secs(Date.now() - t1)})`);
    if (r.status !== 0) failed.push(label);
  }
  soloLines.push(`  [QA_GPU] /gpu suite wall time: ${secs(Date.now() - t)} (${files.length} files)`);
} else if (args.includes('--gpu')) console.log('\n=== QA_GPU step skipped: set QA_GPU=1 ===');
if (soloLines.length) console.log('\n' + soloLines.join('\n'));
if (failed.length) console.log('\nfailed: ' + failed.join(', '));
if (args.includes('--write-durations')) {
  if (failed.length || only.length || words.length) console.log('\nrun-all: durations not written (needs a green full run)');
  else {
    const out = {}; for (const k of Object.keys(took).sort()) out[k] = took[k];
    writeFileSync(table, JSON.stringify(out, null, 2) + '\n'); console.log(`\nrun-all: ${table.slice(root.length + 1)} written (${Object.keys(out).length} files)`);
  }
}
done(failed.length === 0);
