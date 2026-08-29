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
      return new Response(JSON.stringify({ id: 'user-1', email: 'owner@example.com' }), { status: 200 });
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
