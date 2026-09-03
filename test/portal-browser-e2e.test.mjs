import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('portal release E2E covers required viewports, authenticated cookie restoration, browser console, links, and screenshots', async () => {
  const [packageJson, script, workflow] = await Promise.all([
    readFile(new URL('../portal/package.json', import.meta.url), 'utf8'),
    readFile(new URL('../portal/scripts/release-e2e.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/core-quality.yml', import.meta.url), 'utf8')
  ]);
  assert.match(packageJson, /"test:e2e":"node scripts\/release-e2e\.mjs"/);
  for (const viewport of ['[360, 800]', '[375, 812]', '[390, 844]', '[430, 932]', '[768, 1024]', '[1024, 768]', '[1280, 800]', '[1440, 900]']) {
    assert.match(script, new RegExp(viewport.replace(/[\[\]]/g, '\\$&')));
  }
  assert.match(script, /broken internal link/);
  assert.match(script, /--screenshot=/);
  assert.match(script, /--dump-dom/);
  assert.match(script, /hasBrowserConsoleError/);
  assert.match(script, /document\.querySelector\('#email'\)/);
  assert.match(script, /\/api\/v2\/auth\/login/);
  assert.match(script, /e2eLogin=1/);
  assert.match(script, /cookie session restoration/);
  assert.match(script, /Cookie-authenticated browser request missing/);
  assert.match(script, /data-e2e-overflow/);
  assert.match(workflow, /npm --prefix portal run build/);
  assert.match(workflow, /npm --prefix portal run test:e2e/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});
