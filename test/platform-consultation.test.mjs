import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformStore } from '../src/platform-store.mjs';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  AKINAEL_TENANT_NAME: 'akinael',
  OPENAI_API_KEY: 'test-key'
};

const response = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json' }
});

const routeFetch = (routes) => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const route = routes.find((candidate) => candidate.match(String(url), options, calls.length));
    if (!route) throw new Error(`unexpected request: ${url} ${options.method || 'GET'}`);
    return response(await route.reply(String(url), options, calls.length), route.status || 200);
  };
  return { fetchImpl, calls };
};

const customerIdentityRoutes = () => [
  { match: (url) => url.endsWith('/auth/v1/user'), reply: async () => ({ id: 'user-1', email: 'owner@example.com' }) },
  { match: (url) => url.includes('/rest/v1/user_profiles?'), reply: async () => [{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer', display_name: '山田' }] },
  { match: (url) => url.includes('/rest/v1/customer_members?'), reply: async () => [{ customer_id: 'customer-1', created_at: '2026-09-01T00:00:00Z' }] },
  { match: (url, options) => url.includes('/rest/v1/projects?') && url.includes('id=eq.project-1') && options.method === 'GET', reply: async () => [{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1', name: 'テスト案件', status: 'intake' }] }
];

const adminIdentityRoutes = () => [
  { match: (url) => url.endsWith('/auth/v1/user'), reply: async () => ({ id: 'admin-1', email: 'admin@example.com' }) },
  { match: (url) => url.includes('/rest/v1/user_profiles?'), reply: async () => [{ id: 'admin-1', tenant_id: 'tenant-1', role: 'admin', display_name: '管理者' }] },
  { match: (url, options) => url.includes('/rest/v1/projects?') && url.includes('id=eq.project-1') && options.method === 'GET', reply: async () => [{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1', name: 'テスト案件', status: 'intake' }] }
];

const openAiRoute = (outputText) => ({
  match: (url) => url.includes('/v1/responses'),
  reply: async () => ({ output_text: outputText, id: 'resp_1', model: 'gpt-5.6-luna', usage: {} })
});

test('sendConsultationMessage persists the user turn, calls the AI, and persists a parsed assistant reply', async () => {
  const insertedRows = [];
  const { fetchImpl, calls } = routeFetch([
    ...customerIdentityRoutes(),
    {
      match: (url, options) => url.includes('/rest/v1/ai_chat_messages') && options.method === 'POST',
      reply: async (url, options) => {
        const body = JSON.parse(options.body);
        const row = { id: `msg-${insertedRows.length + 1}`, created_at: '2026-09-16T00:00:00Z', ...body };
        insertedRows.push(row);
        return [row];
      }
    },
    {
      match: (url) => url.includes('/rest/v1/ai_chat_messages') && url.includes('order=created_at.asc'),
      reply: async () => insertedRows
    },
    openAiRoute('内容が分かりました。\n{"ready":false}')
  ]);

  const store = createPlatformStore({ env, fetchImpl });
  const result = await store.sendConsultationMessage('token', 'project-1', { content: 'ホームページを新しく作りたいです' });

  assert.equal(result.ready, false);
  assert.equal(result.reply.content, '内容が分かりました。');
  assert.equal(insertedRows.length, 2);
  assert.equal(insertedRows[0].role, 'user');
  assert.equal(insertedRows[0].channel, 'customer_consultation');
  assert.equal(insertedRows[1].role, 'assistant');

  const aiCall = calls.find((call) => call.url.includes('/v1/responses'));
  assert.ok(aiCall, 'the OpenAI Responses API must actually be called, not mocked/skipped');
  const aiBody = JSON.parse(aiCall.options.body);
  assert.ok(aiBody.input.includes('ホームページを新しく作りたいです'));
});

test('sendConsultationMessage without OPENAI_API_KEY configured throws a distinguishable, honest error instead of fabricating a reply', async () => {
  const insertedRows = [];
  const { fetchImpl } = routeFetch([
    ...customerIdentityRoutes(),
    {
      match: (url, options) => url.includes('/rest/v1/ai_chat_messages') && options.method === 'POST',
      reply: async (url, options) => {
        const row = { id: `msg-${insertedRows.length + 1}`, created_at: '2026-09-16T00:00:00Z', ...JSON.parse(options.body) };
        insertedRows.push(row);
        return [row];
      }
    },
    { match: (url) => url.includes('/rest/v1/ai_chat_messages') && url.includes('order=created_at.asc'), reply: async () => insertedRows }
  ]);
  const store = createPlatformStore({ env: { ...env, OPENAI_API_KEY: '' }, fetchImpl });
  await assert.rejects(
    store.sendConsultationMessage('token', 'project-1', { content: 'こんにちは' }),
    (error) => error.code === 'ai_not_configured' && error.status === 503
  );
});

test('finalizeConsultationRequest reuses the real request-creation RPC and rejects a stale/mismatched thread', async () => {
  const insertedRequests = [];
  const consultationRows = [
    { id: 'm1', role: 'user', content: '相談したいです', metadata: { threadId: 'thr_1' }, created_at: '2026-09-16T00:00:00Z' },
    { id: 'm2', role: 'assistant', content: 'まとまりました', metadata: { threadId: 'thr_1', ready: true, summary: { title: 'Webサイト制作', category: 'web_new', overview: '店舗サイトを作ります。' } }, created_at: '2026-09-16T00:01:00Z' }
  ];
  const { fetchImpl } = routeFetch([
    ...customerIdentityRoutes(),
    { match: (url) => url.includes('/rest/v1/ai_chat_messages') && url.includes('order=created_at.asc'), reply: async () => consultationRows },
    {
      match: (url, options) => url.endsWith('/rest/v1/rpc/create_customer_request') && options.method === 'POST',
      reply: async (url, options) => {
        const body = JSON.parse(options.body);
        insertedRequests.push(body);
        return [{ request_id: 'req-1', message_id: 'msg-1' }];
      }
    },
    { match: (url) => url.includes('/rest/v1/requests?') && url.includes('id=eq.req-1'), reply: async () => [{ id: 'req-1', title: 'Webサイト制作', type: 'web_new' }] },
    { match: (url) => url.includes('/rest/v1/messages?') && url.includes('id=eq.msg-1'), reply: async () => [{ id: 'msg-1' }] }
  ]);
  const store = createPlatformStore({ env, fetchImpl });

  await assert.rejects(
    store.finalizeConsultationRequest('token', 'project-1', { threadId: 'thr_wrong', summary: { title: 'x', overview: 'y' } }),
    (error) => error.code === 'consultation_stale'
  );

  const finalized = await store.finalizeConsultationRequest('token', 'project-1', {
    threadId: 'thr_1',
    summary: { title: 'Webサイト制作', category: 'web_new', overview: '店舗サイトを作ります。', scopeItems: ['トップページ'], priceBand: '19,800円〜' }
  });
  assert.equal(finalized.request.id, 'req-1');
  assert.equal(insertedRequests[0].p_type, 'web_new');
  assert.ok(insertedRequests[0].p_body.includes('19,800円〜'));
});

test('sendAdminChat with createRequest creates a real request via the same RPC path used by customers', async () => {
  const insertedRows = [];
  const insertedRequests = [];
  const { fetchImpl } = routeFetch([
    ...adminIdentityRoutes(),
    {
      match: (url, options) => url.includes('/rest/v1/ai_chat_messages') && options.method === 'POST',
      reply: async (url, options) => {
        const row = { id: `msg-${insertedRows.length + 1}`, created_at: '2026-09-16T00:00:00Z', ...JSON.parse(options.body) };
        insertedRows.push(row);
        return [row];
      }
    },
    { match: (url) => url.includes('/rest/v1/ai_chat_messages') && (url.includes('order=created_at.desc') || url.includes('order=created_at.asc')), reply: async () => insertedRows },
    openAiRoute('承知しました。修正内容を確認します。'),
    {
      match: (url, options) => url.endsWith('/rest/v1/rpc/create_customer_request') && options.method === 'POST',
      reply: async (url, options) => { insertedRequests.push(JSON.parse(options.body)); return [{ request_id: 'req-2', message_id: 'msg-2' }]; }
    },
    { match: (url) => url.includes('/rest/v1/requests?') && url.includes('id=eq.req-2'), reply: async () => [{ id: 'req-2', title: 'トップの写真を差し替えてほしい', type: 'web_change' }] },
    { match: (url) => url.includes('/rest/v1/messages?') && url.includes('id=eq.msg-2'), reply: async () => [{ id: 'msg-2' }] }
  ]);
  const store = createPlatformStore({ env, fetchImpl });
  const result = await store.sendAdminChat('token', 'project-1', { content: 'トップの写真を差し替えてほしい', createRequest: true });
  assert.ok(result.createdRequest);
  assert.equal(result.createdRequest.id, 'req-2');
  assert.equal(insertedRequests[0].p_type, 'web_change');
});

test('getBillingSummary reports billingPortalAvailable=false honestly when Stripe is not connected, without fabricating a plan', async () => {
  const { fetchImpl } = routeFetch([
    ...customerIdentityRoutes(),
    { match: (url) => url.includes('/rest/v1/customers?') && url.includes('id=eq.customer-1'), reply: async () => [{ id: 'customer-1', tenant_id: 'tenant-1', name: '山田商店', plan_id: null, stripe_customer_id: null, notify_by_email: true }] },
    { match: (url) => url.includes('/rest/v1/payments?'), reply: async () => [] }
  ]);
  const store = createPlatformStore({ env, fetchImpl });
  const summary = await store.getBillingSummary('token');
  assert.equal(summary.currentPlan, null);
  assert.equal(summary.billingPortalAvailable, false);
  assert.deepEqual(summary.history, []);
});

test('acknowledgeAdminProject records a real approval, clears needs_attention, and writes an audit entry', async () => {
  const writes = [];
  const { fetchImpl } = routeFetch([
    ...adminIdentityRoutes(),
    {
      match: (url, options) => url.includes('/rest/v1/approvals') && options.method === 'POST',
      reply: async (url, options) => { writes.push(['approval', JSON.parse(options.body)]); return [{ id: 'appr-1' }]; }
    },
    {
      match: (url, options) => url.includes('/rest/v1/projects?') && options.method === 'PATCH',
      reply: async (url, options) => { writes.push(['project_patch', JSON.parse(options.body)]); return [{}]; }
    },
    {
      match: (url, options) => url.includes('/rest/v1/audit_logs') && options.method === 'POST',
      reply: async (url, options) => { writes.push(['audit', JSON.parse(options.body)]); return [{ id: 'audit-1' }]; }
    }
  ]);
  const store = createPlatformStore({ env, fetchImpl });
  const result = await store.acknowledgeAdminProject('token', 'project-1', { note: '進めてください' });
  assert.deepEqual(result, { ok: true });
  const approvalWrite = writes.find(([kind]) => kind === 'approval');
  assert.equal(approvalWrite[1].type, 'admin_proceed');
  assert.equal(approvalWrite[1].status, 'approved');
  const projectPatch = writes.find(([kind]) => kind === 'project_patch');
  assert.equal(projectPatch[1].needs_attention, false);
});
