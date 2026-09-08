import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const readAsset = (name) => readFileSync(fileURLToPath(new URL(`../public/assets/${name}`, import.meta.url)), 'utf8');

// app.js is a ~900-line file full of DOM manipulation (document.querySelector
// etc.) that this test has no interest in and no DOM to run it against. Only
// its small, DOM-free auth-fragment prologue is relevant to the race this
// test guards against, so extract just that.
const extractAppJsAuthPrologue = (source) => {
  const start = source.indexOf('const customerTokenKey');
  const end = source.indexOf('\n{', start);
  assert.ok(start !== -1 && end !== -1, 'app.js auth prologue markers not found -- update this test if app.js changed shape');
  return source.slice(start, end);
};

test('a recovery link survives app.js running before the async role lookup resolves', async () => {
  const recoveryScript = readAsset('recovery-redirect.js');
  const appJsPrologue = extractAppJsAuthPrologue(readAsset('app.js'));

  let resolveMeResponse;
  const meResponsePromise = new Promise((resolve) => { resolveMeResponse = resolve; });

  const storage = new Map();
  const replacedUrls = [];
  const sandbox = {
    location: {
      hash: '#access_token=recovery-token-abc&type=recovery&expires_in=3600',
      pathname: '/mypage',
      search: '',
      replace(url) { replacedUrls.push(url); }
    },
    localStorage: {
      setItem: (key, value) => storage.set(key, value),
      getItem: (key) => storage.get(key) ?? null
    },
    history: {
      // Mirrors the real browser effect: replacing the URL with one that has
      // no hash component clears location.hash.
      replaceState: (_state, _title, url) => {
        sandbox.location.pathname = url;
        sandbox.location.hash = '';
      }
    },
    fetch: async () => meResponsePromise,
    URLSearchParams,
    console
  };
  vm.createContext(sandbox);

  // recovery-redirect.js starts: captures the hash synchronously, then
  // suspends at `await fetch(...)`, returning control immediately.
  vm.runInContext(recoveryScript, sandbox);

  // This is the actual browser race: app.js is `defer`red on the same page
  // and reliably finishes parsing (and therefore runs) before the network
  // round-trip above resolves.
  vm.runInContext(appJsPrologue, sandbox);

  // Only now does the mocked /api/v2/auth/me respond.
  resolveMeResponse({ ok: true, json: async () => ({ profile: { role: 'customer' } }) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(replacedUrls.length, 1, 'recovery-redirect.js should redirect exactly once');
  assert.match(
    replacedUrls[0],
    /access_token=recovery-token-abc/,
    'the recovery access_token must survive into the final redirect URL despite app.js running first'
  );
  assert.equal(
    storage.get('customer-token'),
    undefined,
    'a recovery-scoped token must never be written into the normal session storage key'
  );
});

test('a non-recovery access_token (e.g. signup confirmation) is still consumed by app.js as before', async () => {
  const appJsPrologue = extractAppJsAuthPrologue(readAsset('app.js'));
  const storage = new Map();
  const sandbox = {
    location: { hash: '#access_token=signup-confirm-token&type=signup', pathname: '/mypage', search: '' },
    localStorage: { setItem: (key, value) => storage.set(key, value), getItem: (key) => storage.get(key) ?? null },
    history: { replaceState: (_state, _title, url) => { sandbox.location.pathname = url; sandbox.location.hash = ''; } },
    URLSearchParams,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(appJsPrologue, sandbox);

  assert.equal(storage.get('customer-token'), 'signup-confirm-token');
  assert.equal(sandbox.location.hash, '', 'the non-recovery fragment should still be stripped as before');
});
