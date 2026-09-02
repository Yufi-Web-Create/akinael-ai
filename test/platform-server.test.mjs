import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createApp } from '../src/platform-server.mjs';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  AKINAEL_TENANT_NAME: 'akinael'
};

const intakeOpenEnv = { ...env, CUSTOMER_INTAKE_ENABLED: 'true' };

// Exercise the production HTTP server's registered request handler directly.
// This keeps the composition test independent of a local TCP listener, which
// is intentionally unavailable in restricted CI sandboxes.
const request = (server, { path, method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const incoming = new EventEmitter();
  incoming.method = method;
  incoming.url = path;
  incoming.headers = { host: 'localhost', ...headers };
  incoming.socket = { remoteAddress: '127.0.0.1' };
  incoming.destroy = () => {};

  const response = {
    headersSent: false,
    status: 200,
    headers: {},
    chunks: [],
    writeHead(status, responseHeaders = {}) {
      this.status = status;
      this.headers = responseHeaders;
      this.headersSent = true;
      return this;
    },
    end(chunk = '') {
      if (chunk) this.chunks.push(Buffer.from(chunk));
      resolve({
        status: this.status,
        headers: this.headers,
        json: async () => JSON.parse(Buffer.concat(this.chunks).toString('utf8'))
      });
    }
  };

  server.emit('request', incoming, response);
  queueMicrotask(() => {
    if (body) incoming.emit('data', Buffer.from(body));
    incoming.emit('end');
  });
  server.once('error', reject);
});

test('platform server keeps legacy health route available', async () => {
  const server = createApp({ env, fetchImpl: async () => { throw new Error('Supabase should not be called'); } });
  const result = await request(server, { path: '/health' });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { status: 'ok' });
});

test('v2 auth endpoint rejects missing bearer token without falling through to legacy API', async () => {
  const server = createApp({ env, fetchImpl: async () => { throw new Error('Supabase should not be called'); } });
  const result = await request(server, { path: '/api/v2/auth/me' });
  const body = await result.json();
  assert.equal(result.status, 401);
  assert.equal(body.error.code, 'authentication_required');
});

test('production entrypoint retires every legacy API route before its handler can process data', async () => {
  const server = createApp({ env, fetchImpl: async () => { throw new Error('legacy routes must not invoke providers'); } });
  for (const [path, body] of [
      ['/api/auth/register', { email: 'owner@example.com', password: 'a-secure-password' }],
      ['/api/public/chat', { message: '相談内容' }],
      ['/api/admin/projects', undefined]
    ]) {
    const result = await request(server, {
      path,
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    assert.equal(result.status, 410, path);
    assert.equal((await result.json()).error.code, 'legacy_api_retired', path);
  }
});

test('v2 auth endpoint verifies Supabase user and returns onboarding state', async () => {
  const supabaseFetch = async (url) => {
    const value = String(url);
    if (value.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-1', email: 'owner@example.com', email_confirmed_at: '2026-09-01T00:00:00Z' }), { status: 200 });
    }
    if (value.includes('/rest/v1/user_profiles?')) {
      return new Response('[]', { status: 200 });
    }
    if (value.includes('/rest/v1/tenants?')) {
      return new Response(JSON.stringify([{ id: 'tenant-1', name: 'akinael' }]), { status: 200 });
    }
    throw new Error(`unexpected Supabase request: ${value}`);
  };

  const server = createApp({ env, fetchImpl: supabaseFetch });
  const result = await request(server, { path: '/api/v2/auth/me', headers: { authorization: 'Bearer access-token' } });
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.equal(body.onboardingRequired, true);
  assert.equal(body.user.email, 'owner@example.com');
});

test('v2 registration rejects direct API calls without legal consent', async () => {
  let called = false;
  const server = createApp({ env: intakeOpenEnv, fetchImpl: async () => { called = true; throw new Error('Supabase must not be called'); } });
  const result = await request(server, { path: '/api/v2/auth/register', method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'a-secure-password' }) });
  assert.equal(result.status, 400);
  assert.equal((await result.json()).error.code, 'legal_consent_required');
  assert.equal(called, false);
});

test('v2 registration is closed by default and does not send personal data to Supabase', async () => {
  let called = false;
  const server = createApp({ env, fetchImpl: async () => { called = true; throw new Error('Supabase must not be called'); } });
  const result = await request(server, { path: '/api/v2/auth/register', method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'a-secure-password', consent: true }) });
  assert.equal(result.status, 503);
  assert.equal((await result.json()).error.code, 'customer_intake_closed');
  assert.equal(called, false);
});

test('v2 registration creates a Supabase user, persists document versions and provisions a customer account', async () => {
  let provisioned = false;
  const calls = [];
  const supabaseFetch = async (url, options = {}) => {
    const value = String(url);
    calls.push({ url: value, options });
    if (value.endsWith('/auth/v1/signup')) {
      return new Response(JSON.stringify({ access_token: 'new-access-token', user: { id: 'user-1', email: 'owner@example.com' } }), { status: 200 });
    }
    if (value.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-1', email: 'owner@example.com', email_confirmed_at: '2026-09-01T00:00:00Z' }), { status: 200 });
    }
    if (value.includes('/rest/v1/tenants?')) {
      return new Response(JSON.stringify([{ id: 'tenant-1', name: 'akinael' }]), { status: 200 });
    }
    if (value.includes('/rest/v1/user_profiles?')) {
      return new Response(JSON.stringify(provisioned ? [{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer', display_name: 'owner' }] : []), { status: 200 });
    }
    if (value.endsWith('/rest/v1/rpc/provision_customer_account')) {
      provisioned = true;
      return new Response('{}', { status: 200 });
    }
    if (value.includes('/rest/v1/customer_members?')) {
      return new Response(JSON.stringify([{ customer_id: 'customer-1', created_at: '2026-08-30T00:00:00Z' }]), { status: 200 });
    }
    if (value.includes('/rest/v1/customers?')) {
      return new Response(JSON.stringify([{ id: 'customer-1', tenant_id: 'tenant-1', name: 'owner' }]), { status: 200 });
    }
    throw new Error(`unexpected Supabase request: ${value}`);
  };

  const server = createApp({ env: intakeOpenEnv, fetchImpl: supabaseFetch });
  const result = await request(server, { path: '/api/v2/auth/register', method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'a-secure-password', consent: true }) });
  const body = await result.json();
  assert.equal(result.status, 201);
  assert.equal(body.token, 'new-access-token');
  assert.equal(provisioned, true);
  assert.ok(calls.some((call) => call.url.endsWith('/auth/v1/signup')));
  const signupBody = JSON.parse(calls.find((call) => call.url.endsWith('/auth/v1/signup')).options.body);
  assert.equal(signupBody.data.legal_consent.termsVersion, '2026-09-02');
  assert.equal(signupBody.data.legal_consent.privacyVersion, '2026-09-02');
  assert.match(signupBody.data.legal_consent.acceptedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('v2 login exchanges credentials for a Supabase access token', async () => {
  const supabaseFetch = async (url) => {
    const value = String(url);
    if (value.endsWith('/auth/v1/token?grant_type=password')) {
      return new Response(JSON.stringify({ access_token: 'access-token' }), { status: 200 });
    }
    if (value.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-1', email: 'owner@example.com', email_confirmed_at: '2026-09-01T00:00:00Z' }), { status: 200 });
    }
    if (value.includes('/rest/v1/user_profiles?')) {
      return new Response(JSON.stringify([{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer', display_name: 'owner' }]), { status: 200 });
    }
    if (value.includes('/rest/v1/customer_members?')) {
      return new Response(JSON.stringify([{ customer_id: 'customer-1', created_at: '2026-08-30T00:00:00Z' }]), { status: 200 });
    }
    if (value.includes('/rest/v1/customers?')) {
      return new Response(JSON.stringify([{ id: 'customer-1', tenant_id: 'tenant-1', name: 'owner' }]), { status: 200 });
    }
    throw new Error(`unexpected Supabase request: ${value}`);
  };

  const server = createApp({ env, fetchImpl: supabaseFetch });
  const result = await request(server, { path: '/api/v2/auth/login', method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'a-secure-password' }) });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { token: 'access-token' });
});
