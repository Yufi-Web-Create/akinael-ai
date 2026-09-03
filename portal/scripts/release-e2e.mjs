import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { hasBrowserConsoleError } from './console-errors.mjs';

const viewports = [
  [360, 800], [375, 812], [390, 844], [430, 932],
  [768, 1024], [1024, 768], [1280, 800], [1440, 900]
];
const chromium = process.env.CHROMIUM_BIN || process.env.CHROME_BIN || 'chromium';
const artifactDirectory = process.env.PORTAL_E2E_ARTIFACT_DIR || await mkdtemp(path.join(os.tmpdir(), 'akinael-portal-e2e-'));
const keepArtifacts = Boolean(process.env.PORTAL_E2E_ARTIFACT_DIR);
const source = await readFile(new URL('../src/Portal.tsx', import.meta.url), 'utf8');
const portalDirectory = new URL('../../public/portal/', import.meta.url);
const observedApiRequests = [];

const json = (response, status, payload, headers = {}) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(payload));
};

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
const fixtureScript = `<script>
(() => {
  const markLayout = () => {
    const next = String(document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (document.documentElement.dataset.e2eOverflow !== next) document.documentElement.dataset.e2eOverflow = next;
  };
  new MutationObserver(markLayout).observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  addEventListener('load', markLayout);
  const mode = new URLSearchParams(location.search);
  if (mode.get('e2eRestored') === '1') {
    document.documentElement.dataset.e2eRestored = 'true';
    return;
  }
  if (mode.get('e2eLogin') !== '1') return;
  const timer = setInterval(() => {
    const email = document.querySelector('#email');
    const password = document.querySelector('#password');
    const form = email?.form;
    if (!email || !password || !form) return;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setValue.call(email, 'e2e@example.test');
    email.dispatchEvent(new Event('input', { bubbles: true }));
    setValue.call(password, 'long-enough-e2e-password');
    password.dispatchEvent(new Event('input', { bubbles: true }));
    clearInterval(timer);
    form.requestSubmit();
    const restorationTimer = setInterval(() => {
      if (!document.body.textContent.includes('E2E verification project')) return;
      clearInterval(restorationTimer);
      location.replace('/portal/?e2eRestored=1');
    }, 50);
  }, 50);
})();
</script>`;
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const authenticated = /akinael_v2_session=e2e-session/.test(request.headers.cookie || '');
  if (url.pathname === '/api/v2/auth/login' && request.method === 'POST') return json(response, 200, { ok: true }, { 'set-cookie': 'akinael_v2_session=e2e-session; HttpOnly; SameSite=Lax; Path=/' });
  if (url.pathname === '/api/v2/auth/logout' && request.method === 'POST') return json(response, 200, { ok: true }, { 'set-cookie': 'akinael_v2_session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/' });
  if (url.pathname.startsWith('/api/v2/')) {
    observedApiRequests.push({ path: url.pathname, cookie: request.headers.cookie || '', authorization: request.headers.authorization || '' });
    if (!authenticated) return json(response, 401, { error: { code: 'authentication_required' } });
    if (url.pathname === '/api/v2/auth/me') return json(response, 200, { user: { email: 'e2e@example.test' }, onboardingRequired: false });
    if (url.pathname === '/api/v2/projects' && request.method === 'GET') return json(response, 200, [{ id: 'project-e2e', name: 'E2E verification project' }]);
    if (url.pathname === '/api/v2/projects' && request.method === 'POST') return json(response, 201, { id: 'project-e2e', name: 'E2E verification project' });
    if (url.pathname === '/api/v2/projects/project-e2e/production') return json(response, 200, { workflows: [{ status: 'in_progress' }], tasks: [], artifacts: [] });
    if (url.pathname === '/api/v2/projects/project-e2e/requests') return json(response, request.method === 'POST' ? 201 : 200, []);
    if (url.pathname === '/api/v2/projects/project-e2e/messages') return json(response, request.method === 'POST' ? 201 : 200, []);
    return json(response, 404, { error: { code: 'not_found' } });
  }
  if (url.pathname === '/legal') return response.end('legal');
  const relativePath = url.pathname === '/portal/' || url.pathname === '/portal' ? 'index.html' : url.pathname.replace(/^\/portal\//, '');
  if (!relativePath || relativePath.includes('..')) return json(response, 404, { error: { code: 'not_found' } });
  try {
    let body = await readFile(new URL(relativePath, portalDirectory));
    if (relativePath === 'index.html') body = Buffer.from(body.toString().replace('</body>', `${fixtureScript}</body>`));
    response.writeHead(200, { 'content-type': relativePath.endsWith('.js') ? 'text/javascript; charset=utf-8' : relativePath.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8' });
    response.end(body);
  } catch {
    json(response, 404, { error: { code: 'not_found' } });
  }
});

try {
  await mkdir(artifactDirectory, { recursive: true });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  await readFile(new URL('index.html', portalDirectory));
  const staticInternalPaths = [...source.matchAll(/href="(\/[^"?#]*)/g)].map((match) => match[1]);
  for (const internalPath of new Set(staticInternalPaths)) {
    const linkResponse = await fetch(`${baseUrl}${internalPath}`);
    assert.equal(linkResponse.status, 200, `broken internal link: ${internalPath}`);
  }

  for (const [width, height] of viewports) {
    const screenshot = path.join(artifactDirectory, `portal-${width}x${height}.png`);
    const profile = await mkdtemp(path.join(os.tmpdir(), `akinael-chrome-${width}x${height}-`));
    try {
      const commonArgs = ['--headless', '--no-sandbox', '--disable-gpu', '--no-first-run', '--enable-logging=stderr', '--log-level=0', `--user-data-dir=${profile}`, `--window-size=${width},${height}`];
      const restored = await run(chromium, [...commonArgs, '--virtual-time-budget=8000', `--screenshot=${screenshot}`, '--dump-dom', `${baseUrl}/portal/?e2eLogin=1`]);
      assert.match(restored.stdout, /E2E verification project/, `authenticated Portal missing at ${width}x${height}`);
      assert.match(restored.stdout, /data-e2e-restored="true"/, `cookie session restoration missing at ${width}x${height}`);
      assert.match(restored.stdout, /data-e2e-overflow="false"/, `horizontal overflow at ${width}x${height}`);
      assert.equal(hasBrowserConsoleError(restored.stderr), false, `browser console error at ${width}x${height}: ${restored.stderr}`);
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  }
  const protectedPaths = ['/api/v2/auth/me', '/api/v2/projects', '/api/v2/projects/project-e2e/production', '/api/v2/projects/project-e2e/requests', '/api/v2/projects/project-e2e/messages'];
  for (const protectedPath of protectedPaths) {
    assert.ok(observedApiRequests.some((request) => request.path === protectedPath && request.cookie.includes('akinael_v2_session=e2e-session')), `Cookie-authenticated browser request missing: ${protectedPath}`);
  }
  assert.equal(observedApiRequests.some((request) => request.authorization), false, 'Portal must not send browser Authorization headers');
  console.log(`Portal browser E2E passed for ${viewports.length} viewports. Screenshots: ${artifactDirectory}`);
} finally {
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  if (!keepArtifacts) await rm(artifactDirectory, { recursive: true, force: true });
}
