import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createApp } from '../../src/platform-server.mjs';

const viewports = [
  [360, 800], [375, 812], [390, 844], [430, 932],
  [768, 1024], [1024, 768], [1280, 800], [1440, 900]
];
const chromium = process.env.CHROMIUM_BIN || process.env.CHROME_BIN || 'chromium';
const artifactDirectory = process.env.PORTAL_E2E_ARTIFACT_DIR || await mkdtemp(path.join(os.tmpdir(), 'akinael-portal-e2e-'));
const keepArtifacts = Boolean(process.env.PORTAL_E2E_ARTIFACT_DIR);
const source = await readFile(new URL('../src/Portal.tsx', import.meta.url), 'utf8');

const listen = (server) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    server.off('error', reject);
    resolve(server.address().port);
  });
});
const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} exited ${code}\n${stderr}`)));
});

const server = createApp({
  env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-secret', SUPABASE_PUBLISHABLE_KEY: 'test-publishable', AKINAEL_TENANT_NAME: 'akinael' },
  fetchImpl: async () => { throw new Error('The logged-out portal journey must not call the API'); }
});

try {
  await mkdir(artifactDirectory, { recursive: true });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  const staticInternalPaths = [...source.matchAll(/href="(\/[^"?#]*)/g)].map((match) => match[1]);
  for (const internalPath of new Set(staticInternalPaths)) {
    const response = await fetch(`${baseUrl}${internalPath}`);
    assert.equal(response.status, 200, `broken internal link: ${internalPath}`);
  }

  for (const [width, height] of viewports) {
    const screenshot = path.join(artifactDirectory, `portal-${width}x${height}.png`);
    const profile = await mkdtemp(path.join(os.tmpdir(), `akinael-chrome-${width}x${height}-`));
    try {
      let result;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        result = await run(chromium, [
          '--headless', '--no-sandbox', '--disable-gpu', '--no-first-run', '--enable-logging=stderr', '--log-level=0',
          `--user-data-dir=${profile}`, `--window-size=${width},${height}`, '--virtual-time-budget=3000',
          `--screenshot=${screenshot}`, '--dump-dom', `${baseUrl}/portal/`
        ]);
        if (/ログイン/.test(result.stdout)) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.match(result.stdout, /ログイン/, `login journey did not render at ${width}x${height}`);
      assert.match(result.stdout, /id="email"/, `email field missing at ${width}x${height}`);
      assert.match(result.stdout, /id="password"/, `password field missing at ${width}x${height}`);
      assert.doesNotMatch(result.stderr, /CONSOLE.*(?:ERROR|SEVERE)/i, `browser console error at ${width}x${height}`);
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  }
  console.log(`Portal browser E2E passed for ${viewports.length} viewports. Screenshots: ${artifactDirectory}`);
} finally {
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  if (!keepArtifacts) await rm(artifactDirectory, { recursive: true, force: true });
}
