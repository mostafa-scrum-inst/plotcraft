// The storage adapter is a ui file, but it only needs window.localStorage, so it is unit-tested with stubs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWith } from '../helpers/load.mjs';

const adapter = (win) => loadWith(['js/core/ns.js', 'js/ui/storage.js'], { window: win }).ui.storage;
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, m }; };

test('working storage: probe, set, get, remove; the probe leaves nothing behind', () => {
  const ls = memory(), S = adapter({ localStorage: ls });
  assert.equal(S.available, false, 'not available before the probe');
  assert.equal(S.probe(), true); assert.equal(ls.m.size, 0);
  assert.equal(S.get('k'), null); assert.equal(S.set('k', 'v'), true); assert.equal(S.get('k'), 'v');
  assert.equal(S.remove('k'), true); assert.equal(S.get('k'), null);
});

test('reading the property throws (blocked storage): never throws, stays unavailable', () => {
  const win = {}; Object.defineProperty(win, 'localStorage', { get() { throw new Error('SecurityError'); } });
  const S = adapter(win);
  assert.equal(S.probe(), false); assert.equal(S.available, false);
  assert.equal(S.get('k'), null); assert.equal(S.set('k', 'v'), false); assert.equal(S.remove('k'), false);
});

test('no localStorage at all', () => {
  const S = adapter({});
  assert.equal(S.probe(), false); assert.equal(S.set('k', 'v'), false); assert.equal(S.get('k'), null);
});

test('setItem always throws (quota at the probe)', () => {
  const ls = memory(); ls.setItem = () => { throw new Error('QuotaExceededError'); };
  const S = adapter({ localStorage: ls });
  assert.equal(S.probe(), false); assert.equal(S.set('k', 'v'), false);
});

test('storage that fails later flips to unavailable and becomes a no-op', () => {
  const ls = memory(), S = adapter({ localStorage: ls });
  S.probe(); S.set('k', 'v');
  let calls = 0; ls.setItem = () => { calls++; throw new Error('QuotaExceededError'); };
  assert.equal(S.set('k', 'big'), false); assert.equal(S.available, false);
  assert.equal(S.set('k', 'again'), false); assert.equal(calls, 1, 'no further attempts');
  assert.equal(S.get('k'), null);
  const ls2 = memory(), S2 = adapter({ localStorage: ls2 }); S2.probe();
  ls2.getItem = () => { throw new Error('revoked'); };
  assert.equal(S2.get('k'), null); assert.equal(S2.available, false);
});

test('localStorage is undefined or null (some embedded frames)', () => {
  for (const v of [undefined, null]) {
    const S = adapter({ localStorage: v });
    assert.equal(S.probe(), false); assert.equal(S.get('k'), null); assert.equal(S.set('k', 'v'), false); assert.equal(S.remove('k'), false);
  }
});

test('only reads throw: writes are refused too once a read has failed', () => {
  const ls = memory(), S = adapter({ localStorage: ls });
  S.probe(); ls.getItem = () => { throw new Error('read denied'); };
  assert.equal(S.get('k'), null); assert.equal(S.available, false); assert.equal(S.set('k', 'v'), false);
});

test('draft keys (A-4, F2-T3): read v2 else v1; the first v2 write removes v1; removing the draft removes every key', () => {
  const ls = memory(), PCx = loadWith(['js/core/ns.js', 'js/ui/storage.js'], { window: { localStorage: ls } });
  PCx.draft = { KEYS: ['plotcraft.draft.v2', 'plotcraft.draft.v1'] };
  const S = PCx.ui.storage; S.probe();
  ls.setItem('plotcraft.draft.v1', 'old');
  assert.equal(S.readDraft(), 'old', 'v1 only: read v1');
  ls.setItem('plotcraft.draft.v2', 'new');
  assert.equal(S.readDraft(), 'new', 'both: v2 wins');
  ls.removeItem('plotcraft.draft.v2');
  S.removeDraft();
  assert.equal(ls.m.size, 0, 'Start new over a not yet migrated v1 draft leaves nothing');
  ls.setItem('plotcraft.draft.v1', 'old');
  assert.equal(S.writeDraft('x'), true);
  assert.deepEqual([...ls.m.keys()], ['plotcraft.draft.v2'], 'the first v2 write removes the v1 key');
  assert.equal(S.readDraft(), 'x');
  S.removeDraft(); assert.equal(S.readDraft(), null);
});
