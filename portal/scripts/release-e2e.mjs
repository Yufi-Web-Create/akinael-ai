import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
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

const websocketFrame = (payload) => {
  const body = Buffer.from(payload);
  const header = body.length < 126 ? Buffer.from([0x81, 0x80 | body.length]) : Buffer.from([0x81, 0xfe, body.length >> 8, body.length & 0xff]);
  const mask = randomBytes(4);
  const maskedBody = Buffer.from(body.map((byte, index) => byte ^ mask[index % 4]));
  return Buffer.concat([header, mask, maskedBody]);
};

const connectDevTools = (port, target) => new Promise((resolve, reject) => {
  const socket = net.connect(port, '127.0.0.1');
  const key = randomBytes(16).toString('base64');
  let buffer = Buffer.alloc(0);
  let upgraded = false;
  let nextId = 0;
  const pending = new Map();
  const consoleErrors = [];
  const command = (method, params = {}) => new Promise((commandResolve, commandReject) => {
    const id = ++nextId;
    pending.set(id, { resolve: commandResolve, reject: commandReject });
    socket.write(websocketFrame(JSON.stringify({ id, method, params })));
  });
  const readFrames = () => {
    while (buffer.length >= 2) {
      const first = buffer[0];
      let length = buffer[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2); offset = 4;
      }
      if (buffer.length < offset + length) return;
      const message = JSON.parse(buffer.subarray(offset, offset + length).toString());
      buffer = buffer.subarray(offset + length);
      if (message.id) {
        const request = pending.get(message.id);
        if (!request) continue;
        pending.delete(message.id);
        message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
      } else if (message.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(message.params.type)) {
        consoleErrors.push(JSON.stringify(message.params.args));
      } else if (message.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(message.params.exceptionDetails.text || 'uncaught exception');
      }
    }
  };
  socket.on('connect', () => socket.write(`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!upgraded) {
      const end = buffer.indexOf('\r\n\r\n');
      if (end < 0) return;
      if (!buffer.subarray(0, end).toString().includes('101 Switching Protocols')) return reject(new Error('Chrome DevTools connection was rejected'));
      upgraded = true;
      buffer = buffer.subarray(end + 4);
      resolve({ command, consoleErrors, close: () => socket.end() });
    }
    if (upgraded) readFrames();
  });
  socket.on('error', reject);
});

const waitFor = async (command, expression, description) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const value = await command('Runtime.evaluate', { expression, returnByValue: true });
      if (value.result.value) return value.result.value;
    } catch {
      // Reloading the page briefly invalidates the execution context.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}`);
};

const waitForDevTools = async (port) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
      if (target) return await connectDevTools(port, new URL(target.webSocketDebuggerUrl).pathname);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Timed out waiting for Chrome DevTools');
};

const listen = (server) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    server.off('error', reject);
    resolve(server.address().port);
  });
});
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
    const body = await readFile(new URL(relativePath, portalDirectory));
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
      const debuggingPort = 9300 + width;
      const browser = spawn(chromium, ['--headless', '--no-sandbox', '--disable-gpu', '--no-first-run', '--enable-logging=stderr', '--log-level=0', `--user-data-dir=${profile}`, `--window-size=${width},${height}`, `--remote-debugging-port=${debuggingPort}`, `${baseUrl}/portal/`], { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      browser.stderr.on('data', (chunk) => { stderr += chunk; });
      try {
        const devtools = await waitForDevTools(debuggingPort);
        await devtools.command('Runtime.enable');
        await devtools.command('Page.enable');
        await waitFor(devtools.command, 'document.querySelector("#email") && document.querySelector("#password")', `login form at ${width}x${height}`);
        await devtools.command('Runtime.evaluate', { expression: 'document.querySelector("#email").value = "e2e@example.test"; document.querySelector("#email").dispatchEvent(new Event("input", { bubbles: true })); document.querySelector("#password").value = "long-enough-e2e-password"; document.querySelector("#password").dispatchEvent(new Event("input", { bubbles: true })); document.querySelector("form").requestSubmit();' });
        await waitFor(devtools.command, 'document.body.textContent.includes("E2E verification project")', `authenticated Portal at ${width}x${height}`);
        await devtools.command('Page.reload', { ignoreCache: true });
        await waitFor(devtools.command, 'document.body.textContent.includes("E2E verification project")', `cookie session restoration at ${width}x${height}`);
        const layout = await devtools.command('Runtime.evaluate', { expression: '({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })', returnByValue: true });
        assert.ok(layout.result.value.scrollWidth <= layout.result.value.clientWidth, `horizontal overflow at ${width}x${height}`);
        const capture = await devtools.command('Page.captureScreenshot', { format: 'png' });
        await writeFile(screenshot, Buffer.from(capture.data, 'base64'));
        assert.equal(devtools.consoleErrors.length, 0, `browser runtime error at ${width}x${height}: ${devtools.consoleErrors.join('\n')}`);
        devtools.close();
      } finally {
        browser.kill();
      }
      assert.equal(hasBrowserConsoleError(stderr), false, `browser console error at ${width}x${height}: ${stderr}`);
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
