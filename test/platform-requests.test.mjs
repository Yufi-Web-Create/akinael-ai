import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformStore } from '../src/platform-store.mjs';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  AKINAEL_TENANT_NAME: 'akinael'
};

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json' }
});

const scopedCustomerRoutes = (extraRoutes = []) => {
  const calls = [];
  const routes = [
    {
      match: (url) => url.endsWith('/auth/v1/user'),
      reply: () => ({ id: 'user-1', email: 'owner@example.com' })
    },
    {
      match: (url) => url.includes('/rest/v1/user_profiles?'),
      reply: () => [{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer', display_name: null }]
    },
    {
      match: (url) => url.includes('/rest/v1/customer_members?'),
      reply: () => [{ customer_id: 'customer-1', created_at: '2026-08-29T00:00:00Z' }]
    },
    {
      match: (url, options) => url.includes('/rest/v1/projects?') && (!options.method || options.method === 'GET'),
      reply: () => [{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1', name: '店舗サイト', status: 'intake' }]
    },
    ...extraRoutes
  ];

  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const route = routes.find((candidate) => candidate.match(String(url), options));
    if (!route) throw new Error(`unexpected request: ${url}`);
    return jsonResponse(await route.reply(String(url), options), route.status || 200);
  };
  return { fetchImpl, calls };
};

test('createRequest atomically creates a request and its initial customer message', async () => {
  const { fetchImpl, calls } = scopedCustomerRoutes([
    {
      match: (url, options) => url.endsWith('/rest/v1/rpc/create_customer_request') && options.method === 'POST',
      reply: () => [{ request_id: 'request-1', message_id: 'message-1' }]
    },
    {
      match: (url) => url.includes('/rest/v1/requests?') && url.includes('id=eq.request-1'),
      reply: () => [{ id: 'request-1', project_id: 'project-1', customer_id: 'customer-1', type: 'web_change', title: '営業時間変更', body: '営業時間を19時までにしたい', status: 'new', priority: 'normal' }]
    },
    {
      match: (url) => url.includes('/rest/v1/messages?') && url.includes('id=eq.message-1'),
      reply: () => [{ id: 'message-1', project_id: 'project-1', request_id: 'request-1', author_type: 'customer', content: '営業時間を19時までにしたい' }]
    }
  ]);

  const store = createPlatformStore({ env, fetchImpl });
  const created = await store.createRequest('access-token', 'project-1', {
    type: 'web_change',
    title: '営業時間変更',
    body: '営業時間を19時までにしたい',
    customer_id: 'evil-customer',
    created_by: 'evil-user'
  });

  assert.equal(created.request.id, 'request-1');
  assert.equal(created.initialMessage.id, 'message-1');
  const rpc = calls.find((call) => call.url.endsWith('/rest/v1/rpc/create_customer_request'));
  const payload = JSON.parse(rpc.options.body);
  assert.equal(payload.p_tenant_id, 'tenant-1');
  assert.equal(payload.p_customer_id, 'customer-1');
  assert.equal(payload.p_project_id, 'project-1');
  assert.equal(payload.p_user_id, 'user-1');
  assert.equal(payload.p_type, 'web_change');
});

test('addMessage verifies request belongs to the visible project before inserting', async () => {
  const { fetchImpl, calls } = scopedCustomerRoutes([
    {
      match: (url) => url.includes('/rest/v1/requests?') && url.includes('id=eq.request-1'),
      reply: () => [{ id: 'request-1' }]
    },
    {
      match: (url, options) => url.includes('/rest/v1/messages?') && options.method === 'POST',
      reply: (_url, options) => [{
        id: 'message-2',
        project_id: 'project-1',
        request_id: JSON.parse(options.body).request_id,
        author_user_id: 'user-1',
        author_type: 'customer',
        content: JSON.parse(options.body).content
      }]
    }
  ]);

  const store = createPlatformStore({ env, fetchImpl });
  const message = await store.addMessage('access-token', 'project-1', {
    requestId: 'request-1',
    content: '写真も差し替えたいです',
    author_type: 'admin'
  });

  assert.equal(message.id, 'message-2');
  const insert = calls.find((call) => call.url.includes('/rest/v1/messages?') && call.options.method === 'POST');
  const payload = JSON.parse(insert.options.body);
  assert.equal(payload.author_user_id, 'user-1');
  assert.equal(payload.author_type, 'customer');
  assert.equal(payload.project_id, 'project-1');
  assert.equal(payload.request_id, 'request-1');
});

test('unsupported request type is rejected before request creation RPC', async () => {
  const { fetchImpl, calls } = scopedCustomerRoutes([]);
  const store = createPlatformStore({ env, fetchImpl });

  await assert.rejects(
    store.createRequest('access-token', 'project-1', {
      type: 'unknown_pipeline',
      title: '相談',
      body: '相談内容'
    }),
    (error) => error.status === 400 && error.code === 'validation_error'
  );
  assert.equal(calls.some((call) => call.url.endsWith('/rest/v1/rpc/create_customer_request')), false);
});
