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

test('v2 registration creates a Supabase user and provisions a customer account', async () => {
  let provisioned = false;
  const calls = [];
  const supabaseFetch = async (url, options = {}) => {
    const value = String(url);
    calls.push({ url: value, options });
    if (value.endsWith('/auth/v1/signup')) {
      return new Response(JSON.stringify({ access_token: 'new-access-token', user: { id: 'user-1', email: 'owner@example.com' } }), { status: 200 });
    }
    if (value.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-1', email: 'owner@example.com' }), { status: 200 });
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

  const server = createApp({ env, fetchImpl: supabaseFetch });
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/api/v2/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'a-secure-password' })
    });
    const body = await result.json();
    assert.equal(result.status, 201);
    assert.equal(body.token, 'new-access-token');
    assert.equal(provisioned, true);
    assert.ok(calls.some((call) => call.url.endsWith('/auth/v1/signup')));
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
      return new Response(JSON.stringify({ id: 'user-1', email: 'owner@example.com' }), { status: 200 });
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

test('v2 login provisions the configured Supabase identity as an administrator', async () => {
  let adminProvisioned = false;
  const adminEnv = { ...env, ADMIN_EMAIL: 'admin@example.com' };
  const supabaseFetch = async (url, options = {}) => {
    const value = String(url);
    if (value.endsWith('/auth/v1/token?grant_type=password')) {
      return new Response(JSON.stringify({ access_token: 'admin-token' }), { status: 200 });
    }
    if (value.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'admin-user', email: 'admin@example.com' }), { status: 200 });
    }
    if (value.includes('/rest/v1/tenants?')) {
      return new Response(JSON.stringify([{ id: 'tenant-1', name: 'akinael' }]), { status: 200 });
    }
    if (value.includes('/rest/v1/user_profiles?') && options.method === 'POST') {
      adminProvisioned = true;
      const body = JSON.parse(options.body);
      assert.equal(body.role, 'admin');
      assert.equal(body.tenant_id, 'tenant-1');
      return new Response(JSON.stringify([body]), { status: 201 });
    }
    if (value.includes('/rest/v1/user_profiles?')) {
      return new Response(JSON.stringify(adminProvisioned ? [{ id: 'admin-user', tenant_id: 'tenant-1', role: 'admin', display_name: '管理者' }] : []), { status: 200 });
    }
    throw new Error(`unexpected Supabase request: ${value}`);
  };
  const server = createApp({ env: adminEnv, fetchImpl: supabaseFetch });
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'a-secure-password' })
    });
    assert.equal(result.status, 200);
    assert.equal(adminProvisioned, true);
    assert.deepEqual(await result.json(), { token: 'admin-token' });
  } finally {
    await close(server);
  }
});

test('v2 password recovery sends a fixed same-origin redirect to Supabase Auth', async () => {
  let recoveryBody;
  const supabaseFetch = async (url, options = {}) => {
    const value = String(url);
    if (value.endsWith('/auth/v1/recover')) {
      recoveryBody = JSON.parse(options.body);
      return new Response('{}', { status: 200 });
    }
    throw new Error(`unexpected Supabase request: ${value}`);
  };
  const server = createApp({ env: { ...env, PUBLIC_URL: 'https://akinael-ai.com/' }, fetchImpl: supabaseFetch });
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/api/v2/auth/password-recovery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ADMIN@EXAMPLE.COM' })
    });
    assert.equal(result.status, 202);
    assert.deepEqual(recoveryBody, { email: 'admin@example.com', redirect_to: 'https://akinael-ai.com/mypage' });
  } finally {
    await close(server);
  }
});

test('v2 password update forwards only an authenticated recovery token', async () => {
  let updateRequest;
  const supabaseFetch = async (url, options = {}) => {
    const value = String(url);
    if (value.endsWith('/auth/v1/user') && options.method === 'PUT') {
      updateRequest = options;
      return new Response(JSON.stringify({ id: 'admin-user' }), { status: 200 });
    }
    throw new Error(`unexpected Supabase request: ${value}`);
  };
  const server = createApp({ env, fetchImpl: supabaseFetch });
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/api/v2/auth/password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer recovery-token' },
      body: JSON.stringify({ password: 'a-new-secure-password' })
    });
    assert.equal(result.status, 200);
    assert.equal(updateRequest.headers.authorization, 'Bearer recovery-token');
    assert.deepEqual(JSON.parse(updateRequest.body), { password: 'a-new-secure-password' });
  } finally {
    await close(server);
  }
});

test('v2 admin overview rejects customer identities', async () => {
  const supabaseFetch = async (url) => {
    const value = String(url);
    if (value.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'customer-user', email: 'customer@example.com' }), { status: 200 });
    }
    if (value.includes('/rest/v1/user_profiles?')) {
      return new Response(JSON.stringify([{ id: 'customer-user', tenant_id: 'tenant-1', role: 'customer', display_name: 'Customer' }]), { status: 200 });
    }
    throw new Error(`unexpected Supabase request: ${value}`);
  };
  const server = createApp({ env, fetchImpl: supabaseFetch });
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/api/v2/admin/overview`, {
      headers: { authorization: 'Bearer customer-token' }
    });
    assert.equal(result.status, 403);
    assert.equal((await result.json()).error.code, 'administrators_only');
  } finally {
    await close(server);
  }
});

test('v2 admin overview returns tenant-scoped operational data', async () => {
  const supabaseFetch = async (url) => {
    const value = String(url);
    if (value.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'admin-user', email: 'admin@example.com' }), { status: 200 });
    }
    if (value.includes('/rest/v1/user_profiles?')) {
      return new Response(JSON.stringify([{ id: 'admin-user', tenant_id: 'tenant-1', role: 'admin', display_name: 'Admin' }]), { status: 200 });
    }
    if (value.includes('/rest/v1/customers?')) {
      return new Response(JSON.stringify([{ id: 'customer-1', name: 'E2E TEST Customer' }]), { status: 200 });
    }
    if (value.includes('/rest/v1/projects?')) {
      return new Response(JSON.stringify([{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1', name: 'E2E TEST Project', status: 'active', needs_attention: true }]), { status: 200 });
    }
    if (value.includes('/rest/v1/workflow_runs?')) {
      return new Response(JSON.stringify([{ id: 'workflow-1', status: 'running' }]), { status: 200 });
    }
    if (value.includes('/rest/v1/tasks?')) {
      return new Response(JSON.stringify([{ id: 'task-1', status: 'failed' }]), { status: 200 });
    }
    if (value.includes('/rest/v1/approvals?')) {
      return new Response(JSON.stringify([{ id: 'approval-1', status: 'pending' }]), { status: 200 });
    }
    if (value.includes('/rest/v1/notifications?')) return new Response('[]', { status: 200 });
    throw new Error(`unexpected Supabase request: ${value}`);
  };
  const server = createApp({ env, fetchImpl: supabaseFetch });
  const baseUrl = await listen(server);
  try {
    const result = await fetch(`${baseUrl}/api/v2/admin/overview`, {
      headers: { authorization: 'Bearer admin-token' }
    });
    const body = await result.json();
    assert.equal(result.status, 200);
    assert.equal(body.summary.projects, 1);
    assert.equal(body.summary.needsAttention, 1);
    assert.equal(body.summary.failedTasks, 1);
    assert.equal(body.projects[0].customer_name, 'E2E TEST Customer');
  } finally {
    await close(server);
  }
});
