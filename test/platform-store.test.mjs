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

const approvalHarness = ({ notificationFailure = false } = {}) => {
  const approvals = [];
  const notifications = [];
  const audits = [];
  let shouldFailNotification = notificationFailure;
  let nextApprovalId = 1;
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const value = String(url);
    calls.push({ url: value, options });
    if (value.endsWith('/auth/v1/user')) return response({ id: 'user-1', email: 'owner@example.com' });
    if (value.includes('/rest/v1/user_profiles?')) return response([{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer' }]);
    if (value.includes('/rest/v1/customer_members?')) return response([{ customer_id: 'customer-1' }]);
    if (value.includes('/rest/v1/projects?')) return response([{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1' }]);
    if (value.includes('/rest/v1/approvals?') && options.method === 'POST') {
      const body = JSON.parse(options.body);
      let row = approvals.find((item) => item.idempotency_key === body.idempotency_key);
      const duplicate = Boolean(row);
      if (!row) {
        row = { id: `approval-${nextApprovalId++}`, created_at: new Date().toISOString(), ...body };
        approvals.push(row);
      }
      return response(duplicate && options.headers?.Prefer?.includes('ignore-duplicates') ? [] : [row]);
    }
    if (value.includes('/rest/v1/approvals?')) return response(approvals);
    if (value.includes('/rest/v1/notifications?') && options.method === 'POST') {
      if (shouldFailNotification) return response({ message: 'temporary notification outage' }, 500);
      const body = JSON.parse(options.body);
      let row = notifications.find((item) => item.idempotency_key === body.idempotency_key);
      const duplicate = Boolean(row);
      if (!row) {
        row = { id: `notification-${notifications.length + 1}`, ...body };
        notifications.push(row);
      }
      return response(duplicate && options.headers?.Prefer?.includes('ignore-duplicates') ? [] : [row]);
    }
    if (value.includes('/rest/v1/audit_logs?') && options.method === 'POST') {
      const row = { id: `audit-${audits.length + 1}`, ...JSON.parse(options.body) };
      audits.push(row);
      return response([row]);
    }
    throw new Error(`unexpected request: ${value}`);
  };
  return {
    store: createPlatformStore({ env, fetchImpl }), approvals, notifications, audits, calls,
    setNotificationFailure: (value) => { shouldFailNotification = value; }
  };
};

test('first approval creates one durable approval and one notification; a repeat creates neither', async () => {
  const harness = approvalHarness();
  const firstApproval = await harness.store.createCustomerApproval('access-token', 'project-1', { note: 'E2E TEST PHASE 6 APPROVAL' });
  const duplicate = await harness.store.createCustomerApproval('access-token', 'project-1', { note: 'E2E TEST PHASE 6 APPROVAL' });

  assert.equal(firstApproval.notification.status, 'recorded');
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.notification.status, 'recorded');
  assert.equal(harness.approvals.length, 1);
  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.audits.length, 1);
  const inserts = harness.calls.filter((call) => call.url.includes('/rest/v1/approvals?') && call.options.method === 'POST');
  assert.equal(inserts.length, 1);
  assert.match(inserts[0].url, /on_conflict=idempotency_key/);
});

test('concurrent identical approvals converge on one approval and one notification', async () => {
  const harness = approvalHarness();
  const results = await Promise.all([
    harness.store.createCustomerApproval('access-token', 'project-1', { note: 'E2E TEST concurrent approval' }),
    harness.store.createCustomerApproval('access-token', 'project-1', { note: 'E2E TEST concurrent approval' })
  ]);

  assert.equal(harness.approvals.length, 1);
  assert.equal(harness.notifications.length, 1);
  assert.equal(new Set(results.map((item) => item.id)).size, 1);
});

test('notification failure returns retry evidence without rolling back the approval', async () => {
  const harness = approvalHarness({ notificationFailure: true });
  const approval = await harness.store.createCustomerApproval('access-token', 'project-1', { note: 'E2E TEST notification failure' });

  assert.equal(approval.notification.status, 'pending_retry');
  assert.equal(harness.approvals.length, 1);
  assert.equal(harness.notifications.length, 0);
  assert.equal(harness.audits.length, 1);
  assert.equal(harness.audits[0].action, 'delivery_approval_notification_pending_retry');
});

test('a duplicate approval retries a previously failed notification without duplicating approval or notification', async () => {
  const harness = approvalHarness({ notificationFailure: true });
  const firstApproval = await harness.store.createCustomerApproval('access-token', 'project-1', { note: 'E2E TEST notification retry' });
  assert.equal(firstApproval.notification.status, 'pending_retry');
  harness.setNotificationFailure(false);
  const retry = await harness.store.createCustomerApproval('access-token', 'project-1', { note: 'E2E TEST notification retry' });
  const duplicate = await harness.store.createCustomerApproval('access-token', 'project-1', { note: 'E2E TEST notification retry' });

  assert.equal(retry.duplicate, true);
  assert.equal(retry.notification.status, 'recorded');
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.notification.status, 'recorded');
  assert.equal(harness.approvals.length, 1);
  assert.equal(harness.notifications.length, 1);
});
