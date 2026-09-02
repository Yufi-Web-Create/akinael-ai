import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('portal release E2E covers the required viewports, rendered login journey, browser console, links, and screenshots', async () => {
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
  assert.match(script, /CONSOLE.*ERROR/);
  assert.match(script, /管理.*ログイン/);
  assert.match(workflow, /npm --prefix portal run build/);
  assert.match(workflow, /npm --prefix portal run test:e2e/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});
