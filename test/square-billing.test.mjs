import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createSquareBilling } from '../src/square-billing.mjs';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' }
});

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'service-secret',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  SQUARE_ENVIRONMENT: 'sandbox',
  SQUARE_ACCESS_TOKEN: 'sandbox-token',
  SQUARE_LOCATION_ID: 'location-1',
  SQUARE_WEBHOOK_SIGNATURE_KEY: 'signature-key',
  SQUARE_PLAN_VARIATION_MINI: 'variation-mini',
  SQUARE_PLAN_VARIATION_OPERATIONS: 'variation-operations',
  SQUARE_PLAN_VARIATION_ADVANCED: 'variation-advanced',
  PUBLIC_URL: 'https://akinael-ai.com'
};

const customerIdentityFetch = (requests, customer = {}) => async (url, options = {}) => {
  requests.push({ url: String(url), options });
  const parsed = new URL(String(url));
  if (parsed.pathname === '/auth/v1/user') return jsonResponse({ id: 'user-1', email: 'owner@example.com' });
  if (parsed.pathname === '/rest/v1/user_profiles') return jsonResponse([{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer' }]);
  if (parsed.pathname === '/rest/v1/customer_members') return jsonResponse([{ customer_id: 'customer-1' }]);
  if (parsed.pathname === '/rest/v1/customers') return jsonResponse([{
    id: 'customer-1',
    tenant_id: 'tenant-1',
    name: '店舗',
    plan_id: null,
    square_customer_id: null,
    square_subscription_id: null,
    notify_by_email: true,
    ...customer
  }]);
  throw new Error(`unexpected request: ${url}`);
};

test('creates a Square subscription checkout link for an authenticated customer', async () => {
  const requests = [];
  const identityFetch = customerIdentityFetch(requests);
  const fetchImpl = async (url, options = {}) => {
    if (String(url) === 'https://connect.squareupsandbox.com/v2/online-checkout/payment-links') {
      requests.push({ url: String(url), options });
      return jsonResponse({ payment_link: { id: 'link-1', url: 'https://square.link/u/test' } });
    }
    return identityFetch(url, options);
  };

  const billing = createSquareBilling({ env: baseEnv, fetchImpl });
  const result = await billing.createCheckoutSession('access-token', 'operations');

  assert.equal(result.id, 'link-1');
  assert.equal(result.url, 'https://square.link/u/test');
  const squareCall = requests.find((request) => request.url.endsWith('/v2/online-checkout/payment-links'));
  assert.ok(squareCall);
  const body = JSON.parse(squareCall.options.body);
  assert.equal(body.quick_pay.price_money.amount, 7980);
  assert.equal(body.quick_pay.price_money.currency, 'JPY');
  assert.equal(body.checkout_options.subscription_plan_id, 'variation-operations');
  assert.equal(body.checkout_options.redirect_url, 'https://akinael-ai.com/portal/?screen=plan&checkout=success');
  assert.equal(body.pre_populated_data.buyer_email, 'owner@example.com');
  assert.equal(body.payment_note, 'akinael_customer_id=customer-1;plan_id=operations');
});

test('rejects free trial as a Square checkout target', async () => {
  const billing = createSquareBilling({ env: baseEnv, fetchImpl: async () => { throw new Error('should not call fetch'); } });
  await assert.rejects(
    () => billing.createCheckoutSession('access-token', 'trial'),
    (error) => error?.code === 'unsupported_plan' && error?.status === 400
  );
});

test('verifies Square signature and syncs successful payment and subscription', async () => {
  const patches = [];
  const paymentPosts = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === '/rest/v1/customers' && options.method === 'PATCH') {
      patches.push(JSON.parse(options.body));
      return new Response(null, { status: 204 });
    }
    if (parsed.pathname === '/rest/v1/customers') {
      return jsonResponse([{ id: 'customer-1', tenant_id: 'tenant-1', plan_id: null, square_customer_id: null, square_subscription_id: null }]);
    }
    if (parsed.pathname === '/rest/v1/payments' && (!options.method || options.method === 'GET')) return jsonResponse([]);
    if (parsed.pathname === '/rest/v1/payments' && options.method === 'POST') {
      paymentPosts.push(JSON.parse(options.body));
      return jsonResponse([{ id: 'payment-row-1' }]);
    }
    if (String(url) === 'https://connect.squareupsandbox.com/v2/subscriptions/search') {
      return jsonResponse({ subscriptions: [{ id: 'subscription-1', customer_id: 'sq-customer-1', plan_variation_id: 'variation-mini', status: 'ACTIVE', created_at: '2026-09-17T00:00:00Z' }] });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const event = {
    event_id: 'evt-1',
    type: 'payment.updated',
    data: {
      object: {
        payment: {
          id: 'sq-payment-1',
          customer_id: 'sq-customer-1',
          status: 'COMPLETED',
          amount_money: { amount: 3980, currency: 'JPY' },
          note: 'akinael_customer_id=customer-1;plan_id=mini'
        }
      }
    }
  };
  const rawBody = JSON.stringify(event);
  const notificationUrl = 'https://akinael-ai.com/api/v2/billing/webhook';
  const signature = crypto
    .createHmac('sha256', baseEnv.SQUARE_WEBHOOK_SIGNATURE_KEY)
    .update(`${notificationUrl}${rawBody}`)
    .digest('base64');

  const billing = createSquareBilling({ env: baseEnv, fetchImpl });
  const result = await billing.handleWebhook({ rawBody, signature });

  assert.equal(result.received, true);
  assert.equal(result.type, 'payment.updated');
  assert.ok(patches.some((patch) => patch.square_customer_id === 'sq-customer-1' && patch.plan_id === 'mini'));
  assert.ok(patches.some((patch) => patch.square_subscription_id === 'subscription-1'));
  assert.equal(paymentPosts.length, 1);
  assert.equal(paymentPosts[0].provider, 'square');
  assert.equal(paymentPosts[0].status, 'paid');
  assert.equal(paymentPosts[0].amount, 3980);
});

test('rejects webhook with an invalid Square signature', async () => {
  const billing = createSquareBilling({ env: baseEnv, fetchImpl: async () => { throw new Error('should not call fetch'); } });
  const rawBody = JSON.stringify({ event_id: 'evt-bad', type: 'payment.updated', data: { object: {} } });
  await assert.rejects(
    () => billing.handleWebhook({ rawBody, signature: 'invalid' }),
    (error) => error?.code === 'invalid_square_signature' && error?.status === 400
  );
});

test('changes and cancels an existing Square subscription', async () => {
  const requests = [];
  const identityFetch = customerIdentityFetch(requests, {
    plan_id: 'mini',
    square_customer_id: 'sq-customer-1',
    square_subscription_id: 'subscription-1'
  });
  const fetchImpl = async (url, options = {}) => {
    const value = String(url);
    if (value.endsWith('/v2/subscriptions/subscription-1/swap-plan')) {
      requests.push({ url: value, options });
      return jsonResponse({ subscription: { id: 'subscription-1' }, actions: [{ effective_date: '2026-10-01' }] });
    }
    if (value.endsWith('/v2/subscriptions/subscription-1/cancel')) {
      requests.push({ url: value, options });
      return jsonResponse({ subscription: { id: 'subscription-1', canceled_date: '2026-10-01' } });
    }
    return identityFetch(url, options);
  };

  const billing = createSquareBilling({ env: baseEnv, fetchImpl });
  const changed = await billing.changePlan('access-token', 'advanced');
  assert.equal(changed.scheduled, true);
  assert.equal(changed.effectiveDate, '2026-10-01');
  const swapCall = requests.find((request) => request.url.endsWith('/swap-plan'));
  assert.equal(JSON.parse(swapCall.options.body).new_plan_variation_id, 'variation-advanced');

  const canceled = await billing.cancelSubscription('access-token');
  assert.equal(canceled.scheduled, true);
  assert.equal(canceled.canceledDate, '2026-10-01');
});
