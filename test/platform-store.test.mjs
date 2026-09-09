import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformStore } from '../src/platform-store.mjs';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  AKINAEL_TENANT_NAME: 'akinael'
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
    if (!route) throw new Error(`unexpected request: ${url}`);
    return response(await route.reply(String(url), options, calls.length), route.status || 200);
  };
  return { fetchImpl, calls };
};

test('getMe returns onboardingRequired for a valid Auth user without a profile', async () => {
  const { fetchImpl } = routeFetch([
    {
      match: (url) => url.endsWith('/auth/v1/user'),
      reply: async () => ({ id: 'user-1', email: 'owner@example.com' })
    },
    {
      match: (url) => url.includes('/rest/v1/user_profiles?'),
      reply: async () => []
    },
    {
      match: (url) => url.includes('/rest/v1/tenants?'),
      reply: async () => [{ id: 'tenant-1', name: 'akinael' }]
    }
  ]);

  const store = createPlatformStore({ env, fetchImpl });
  const me = await store.getMe('access-token');
  assert.equal(me.onboardingRequired, true);
  assert.equal(me.user.id, 'user-1');
  assert.equal(me.tenant.name, 'akinael');
});

test('provisionCustomer creates profile/customer membership through the transaction RPC', async () => {
  let profileReads = 0;
  const { fetchImpl, calls } = routeFetch([
    {
      match: (url) => url.endsWith('/auth/v1/user'),
      reply: async () => ({ id: 'user-1', email: 'owner@example.com' })
    },
    {
      match: (url) => url.includes('/rest/v1/user_profiles?'),
      reply: async () => {
        profileReads += 1;
        return profileReads === 1 ? [] : [{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer', display_name: '山田' }];
      }
    },
    {
      match: (url) => url.includes('/rest/v1/tenants?'),
      reply: async () => [{ id: 'tenant-1', name: 'akinael' }]
    },
    {
      match: (url, options) => url.endsWith('/rest/v1/rpc/provision_customer_account') && options.method === 'POST',
      reply: async () => [{ user_id: 'user-1', tenant_id: 'tenant-1', customer_id: 'customer-1' }]
    },
    {
      match: (url) => url.includes('/rest/v1/customer_members?'),
      reply: async () => [{ customer_id: 'customer-1', created_at: '2026-08-29T00:00:00Z' }]
    },
    {
      match: (url) => url.includes('/rest/v1/customers?'),
      reply: async () => [{ id: 'customer-1', tenant_id: 'tenant-1', name: '山田商店' }]
    }
  ]);

  const store = createPlatformStore({ env, fetchImpl });
  const me = await store.provisionCustomer('access-token', { displayName: '山田', businessName: '山田商店' });
  assert.equal(me.onboardingRequired, false);
  assert.equal(me.customer.id, 'customer-1');
  const rpcCall = calls.find((call) => call.url.endsWith('/rest/v1/rpc/provision_customer_account'));
  assert.ok(rpcCall);
  assert.equal(rpcCall.options.headers.apikey, 'sb_secret_test');
  assert.deepEqual(JSON.parse(rpcCall.options.body), {
    p_tenant_id: 'tenant-1',
    p_user_id: 'user-1',
    p_email: 'owner@example.com',
    p_display_name: '山田',
    p_business_name: '山田商店'
  });
});

test('customer project reads are scoped to customer memberships', async () => {
  const { fetchImpl, calls } = routeFetch([
    {
      match: (url) => url.endsWith('/auth/v1/user'),
      reply: async () => ({ id: 'user-1', email: 'owner@example.com' })
    },
    {
      match: (url) => url.includes('/rest/v1/user_profiles?'),
      reply: async () => [{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer', display_name: null }]
    },
    {
      match: (url) => url.includes('/rest/v1/customer_members?'),
      reply: async () => [{ customer_id: 'customer-1', created_at: '2026-08-29T00:00:00Z' }]
    },
    {
      match: (url) => url.includes('/rest/v1/projects?'),
      reply: async () => [{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1', name: '店舗サイト', status: 'intake' }]
    }
  ]);

  const store = createPlatformStore({ env, fetchImpl });
  const projects = await store.listProjects('access-token');
  assert.equal(projects.length, 1);
  const projectCall = calls.find((call) => call.url.includes('/rest/v1/projects?'));
  assert.match(projectCall.url, /tenant_id=eq\.tenant-1/);
  assert.match(projectCall.url, /customer_id=in\.\(customer-1\)/);
});

test('createProject derives tenant and customer from the verified user instead of request input', async () => {
  const { fetchImpl, calls } = routeFetch([
    {
      match: (url) => url.endsWith('/auth/v1/user'),
      reply: async () => ({ id: 'user-1', email: 'owner@example.com' })
    },
    {
      match: (url) => url.includes('/rest/v1/user_profiles?'),
      reply: async () => [{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer', display_name: null }]
    },
    {
      match: (url) => url.includes('/rest/v1/customer_members?'),
      reply: async () => [{ customer_id: 'customer-1', created_at: '2026-08-29T00:00:00Z' }]
    },
    {
      match: (url, options) => url.includes('/rest/v1/projects?') && options.method === 'POST',
      reply: async () => [{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1', name: '店舗サイト', status: 'intake' }]
    }
  ]);

  const store = createPlatformStore({ env, fetchImpl });
  const project = await store.createProject('access-token', { name: '店舗サイト', tenant_id: 'evil', customer_id: 'evil' });
  assert.equal(project.id, 'project-1');
  const createCall = calls.find((call) => call.url.includes('/rest/v1/projects?') && call.options.method === 'POST');
  const payload = JSON.parse(createCall.options.body);
  assert.equal(payload.tenant_id, 'tenant-1');
  assert.equal(payload.customer_id, 'customer-1');
  assert.equal(payload.name, '店舗サイト');
  assert.equal(Object.hasOwn(payload, 'ownerId'), false);
});

test('customer delivery approval is idempotent and notification failure does not undo durable approval', async () => {
  const { fetchImpl, calls } = routeFetch([
    { match: (url) => url.endsWith('/auth/v1/user'), reply: async () => ({ id: 'user-1', email: 'owner@example.com' }) },
    { match: (url) => url.includes('/rest/v1/user_profiles?'), reply: async () => [{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer' }] },
    { match: (url) => url.includes('/rest/v1/customer_members?'), reply: async () => [{ customer_id: 'customer-1' }] },
    { match: (url, options) => url.includes('/rest/v1/projects?') && (!options.method || options.method === 'GET'), reply: async () => [{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1' }] },
    { match: (url, options) => url.includes('/rest/v1/approvals?') && (!options.method || options.method === 'GET'), reply: async () => [] },
    { match: (url, options) => url.includes('/rest/v1/approvals?') && options.method === 'POST', reply: async () => [{ id: 'approval-1', project_id: 'project-1', type: 'delivery', status: 'approved' }] },
    { match: (url, options) => url.includes('/rest/v1/notifications?') && options.method === 'POST', status: 500, reply: async () => ({ message: 'temporary notification outage' }) },
    { match: (url, options) => url.includes('/rest/v1/audit_logs?') && options.method === 'POST', reply: async () => [{ id: 'audit-1' }] }
  ]);

  const approval = await createPlatformStore({ env, fetchImpl }).createCustomerApproval('access-token', 'project-1', { note: 'E2E TEST approval' });
  assert.equal(approval.id, 'approval-1');
  assert.equal(approval.notification.status, 'pending_retry');
  const insert = calls.find((call) => call.url.includes('/rest/v1/approvals?') && call.options.method === 'POST');
  assert.match(insert.url, /on_conflict=idempotency_key/);
  assert.equal(JSON.parse(insert.options.body).idempotency_key, 'delivery_approved:project-1:project');
});

test('CASE A: resending an approval that already exists but has no notification/audit yet recovers both', async () => {
  const auditRows = [];
  const { fetchImpl, calls } = routeFetch([
    { match: (url) => url.endsWith('/auth/v1/user'), reply: async () => ({ id: 'user-1', email: 'owner@example.com' }) },
    { match: (url) => url.includes('/rest/v1/user_profiles?'), reply: async () => [{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer' }] },
    { match: (url) => url.includes('/rest/v1/customer_members?'), reply: async () => [{ customer_id: 'customer-1' }] },
    { match: (url, options) => url.includes('/rest/v1/projects?') && (!options.method || options.method === 'GET'), reply: async () => [{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1' }] },
    // Baseline production state this fix targets: the approval already exists (a prior call
    // succeeded before service_role lacked notifications/audit_logs INSERT), but nothing else does.
    { match: (url, options) => url.includes('/rest/v1/approvals?') && (!options.method || options.method === 'GET'), reply: async () => [{ id: 'approval-1', project_id: 'project-1', type: 'delivery', status: 'approved' }] },
    { match: (url, options) => url.includes('/rest/v1/notifications?') && options.method === 'POST', reply: async () => [{ id: 'notification-1' }] },
    { match: (url, options) => url.includes('/rest/v1/audit_logs?') && (!options.method || options.method === 'GET'), reply: async () => auditRows.slice() },
    { match: (url, options) => url.includes('/rest/v1/audit_logs?') && options.method === 'POST', reply: async () => { auditRows.push({ id: 'audit-1' }); return [{ id: 'audit-1' }]; } }
  ]);

  const approval = await createPlatformStore({ env, fetchImpl }).createCustomerApproval('access-token', 'project-1', { note: 'E2E TEST approval' });
  assert.equal(approval.id, 'approval-1');
  assert.equal(approval.duplicate, true);
  assert.equal(approval.notification.status, 'recorded');
  assert.equal(auditRows.length, 1);
  const approvalInsert = calls.find((call) => call.url.includes('/rest/v1/approvals?') && call.options.method === 'POST');
  assert.equal(approvalInsert, undefined, 'an existing approval must not be re-inserted');
  const auditInsert = calls.find((call) => call.url.includes('/rest/v1/audit_logs?') && call.options.method === 'POST');
  assert.equal(JSON.parse(auditInsert.options.body).action, 'delivery_approval_recorded');
});

test('CASE B: resending an already-fully-recorded approval is a clean no-op duplicate', async () => {
  const auditRows = [{ id: 'audit-1' }];
  const { fetchImpl, calls } = routeFetch([
    { match: (url) => url.endsWith('/auth/v1/user'), reply: async () => ({ id: 'user-1', email: 'owner@example.com' }) },
    { match: (url) => url.includes('/rest/v1/user_profiles?'), reply: async () => [{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer' }] },
    { match: (url) => url.includes('/rest/v1/customer_members?'), reply: async () => [{ customer_id: 'customer-1' }] },
    { match: (url, options) => url.includes('/rest/v1/projects?') && (!options.method || options.method === 'GET'), reply: async () => [{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1' }] },
    { match: (url, options) => url.includes('/rest/v1/approvals?') && (!options.method || options.method === 'GET'), reply: async () => [{ id: 'approval-1', project_id: 'project-1', type: 'delivery', status: 'approved' }] },
    // Notification already exists; the idempotent upsert must still succeed (merge-duplicates), not fail.
    { match: (url, options) => url.includes('/rest/v1/notifications?') && options.method === 'POST', reply: async () => [{ id: 'notification-1' }] },
    { match: (url, options) => url.includes('/rest/v1/audit_logs?') && (!options.method || options.method === 'GET'), reply: async () => auditRows.slice() },
    { match: (url, options) => url.includes('/rest/v1/audit_logs?') && options.method === 'POST', reply: async () => { auditRows.push({ id: 'audit-2' }); return [{ id: 'audit-2' }]; } }
  ]);

  const approval = await createPlatformStore({ env, fetchImpl }).createCustomerApproval('access-token', 'project-1', { note: 'E2E TEST approval' });
  assert.equal(approval.id, 'approval-1');
  assert.equal(approval.duplicate, true);
  assert.equal(approval.notification.status, 'recorded');
  assert.equal(auditRows.length, 1, 'an already-recorded approval must not accumulate duplicate audit rows on repeated resends');
  const auditInsert = calls.find((call) => call.url.includes('/rest/v1/audit_logs?') && call.options.method === 'POST');
  assert.equal(auditInsert, undefined, 'no new audit row should be inserted once one already exists for this approval');
});
