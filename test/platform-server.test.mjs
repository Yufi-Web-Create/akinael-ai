import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/platform-server.mjs';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  AKINAEL_TENANT_NAME: 'akinael'
};

const listen = async (server) => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
};

const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

test('platform server keeps legacy health route available', async () => {
  const server = createApp({ env, fetchImpl: async () => { throw new Error('Supabase should not be called'); } });
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/health`);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { status: 'ok' });
  } finally {
    await close(server);
  }
});

test('v2 auth endpoint rejects missing bearer token without falling through to legacy API', async () => {
  const server = createApp({ env, fetchImpl: async () => { throw new Error('Supabase should not be called'); } });
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/api/v2/auth/me`);
    const body = await result.json();
    assert.equal(result.status, 401);
    assert.equal(body.error.code, 'authentication_required');
  } finally {
    await close(server);
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
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/api/v2/auth/me`, {
      headers: { authorization: 'Bearer access-token' }
    });
    const body = await result.json();
    assert.equal(result.status, 200);
    assert.equal(body.onboardingRequired, true);
    assert.equal(body.user.email, 'owner@example.com');
  } finally {
    await close(server);
  }
});

test('v2 registration is server-side closed until formal legal documents and consent storage are ready', async () => {
  let called = false;
  const server = createApp({ env, fetchImpl: async () => { called = true; throw new Error('Supabase must not receive registration data'); } });
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/api/v2/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'a-secure-password' })
    });
    const body = await result.json();
    assert.equal(result.status, 503);
    assert.equal(body.error.code, 'consultation_intake_closed');
    assert.equal(called, false);
  } finally {
    await close(server);
  }
});

test('legacy public registration and chat endpoints are also closed and do not fall through', async () => {
  const server = createApp({ env, fetchImpl: async () => { throw new Error('provider must not receive consultation data'); } });
  const baseUrl = await listen(server);
  try {
    for (const path of ['/api/auth/register', '/api/public/chat', '/api/projects']) {
      const result = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'a-secure-password', message: '相談内容' }) });
      assert.equal(result.status, 503);
      assert.equal((await result.json()).error.code, 'consultation_intake_closed');
    }
  } finally {
    await close(server);
  }
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
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'a-secure-password' })
    });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { token: 'access-token' });
  } finally {
    await close(server);
  }
});

test('v2 login rejects an unconfirmed Supabase email before provisioning or returning a token', async () => {
  const supabaseFetch = async (url) => {
    const value = String(url);
    if (value.endsWith('/auth/v1/token?grant_type=password')) return new Response(JSON.stringify({ access_token: 'access-token' }), { status: 200 });
    if (value.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-1', email: 'owner@example.com', email_confirmed_at: null }), { status: 200 });
    throw new Error(`unexpected Supabase request: ${value}`);
  };
  const server = createApp({ env, fetchImpl: supabaseFetch });
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/api/v2/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'a-secure-password' }) });
    assert.equal(result.status, 403);
    assert.equal((await result.json()).error.code, 'email_confirmation_required');
  } finally {
    await close(server);
  }
});

test('v2 API rate-limits repeated requests before authentication or downstream processing', async () => {
  let called = false;
  const server = createApp({ env, fetchImpl: async () => { called = true; throw new Error('request should be rate-limited before Supabase'); } });
  const baseUrl = await listen(server);
  try {
    for (let index = 0; index < 30; index += 1) {
      const result = await fetch(`${baseUrl}/api/v2/auth/me`);
      assert.equal(result.status, 401);
    }
    const limited = await fetch(`${baseUrl}/api/v2/auth/me`);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
    assert.equal((await limited.json()).error.code, 'rate_limit_exceeded');
    assert.equal(called, false);
  } finally {
    await close(server);
  }
});
