import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createStripeBilling } from '../src/stripe-billing.mjs';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' }
});

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'service-secret',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  STRIPE_SECRET_KEY: 'sk_test_example',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_example',
  PUBLIC_URL: 'https://akinael-ai.com'
};

test('creates a Stripe subscription checkout session for an authenticated customer', async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    const parsed = new URL(String(url));
    if (parsed.pathname === '/auth/v1/user') return jsonResponse({ id: 'user-1', email: 'owner@example.com' });
    if (parsed.pathname === '/rest/v1/user_profiles') return jsonResponse([{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer' }]);
    if (parsed.pathname === '/rest/v1/customer_members') return jsonResponse([{ customer_id: 'customer-1' }]);
    if (parsed.pathname === '/rest/v1/customers') return jsonResponse([{ id: 'customer-1', tenant_id: 'tenant-1', name: '店舗', plan_id: null, stripe_customer_id: null }]);
    if (String(url) === 'https://api.stripe.com/v1/checkout/sessions') {
      return jsonResponse({ id: 'cs_test_1', url: 'https://checkout.stripe.com/test' });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const billing = createStripeBilling({ env: baseEnv, fetchImpl });
  const result = await billing.createCheckoutSession('access-token', 'operations');

  assert.equal(result.id, 'cs_test_1');
  assert.equal(result.url, 'https://checkout.stripe.com/test');
  const stripeCall = requests.find((request) => request.url === 'https://api.stripe.com/v1/checkout/sessions');
  assert.ok(stripeCall);
  const body = stripeCall.options.body;
  assert.equal(body.get('mode'), 'subscription');
  assert.equal(body.get('line_items[0][price_data][unit_amount]'), '7980');
  assert.equal(body.get('line_items[0][price_data][currency]'), 'jpy');
  assert.equal(body.get('metadata[customer_id]'), 'customer-1');
  assert.equal(body.get('metadata[plan_id]'), 'operations');
  assert.equal(body.get('customer_email'), 'owner@example.com');
  assert.equal(body.get('success_url'), 'https://akinael-ai.com/portal/?screen=plan&checkout=success');
});

test('rejects free trial as a checkout target', async () => {
  const billing = createStripeBilling({ env: baseEnv, fetchImpl: async () => { throw new Error('should not call fetch'); } });
  await assert.rejects(
    () => billing.createCheckoutSession('access-token', 'trial'),
    (error) => error?.code === 'unsupported_plan' && error?.status === 400
  );
});

test('verifies Stripe signature and syncs checkout plan/customer id into Supabase', async () => {
  const patches = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === '/rest/v1/customers' && options.method === 'PATCH') {
      patches.push({ url: String(url), body: JSON.parse(options.body) });
      return new Response(null, { status: 204 });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const event = {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'subscription',
        customer: 'cus_123',
        client_reference_id: 'customer-1',
        metadata: { customer_id: 'customer-1', plan_id: 'mini' }
      }
    }
  };
  const rawBody = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', baseEnv.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const billing = createStripeBilling({ env: baseEnv, fetchImpl });
  const result = await billing.handleWebhook({ rawBody, signature: `t=${timestamp},v1=${signature}` });

  assert.equal(result.received, true);
  assert.equal(result.type, 'checkout.session.completed');
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0].body, { plan_id: 'mini', stripe_customer_id: 'cus_123' });
  assert.match(patches[0].url, /id=eq\.customer-1/);
});

test('rejects webhook with an invalid Stripe signature', async () => {
  const billing = createStripeBilling({ env: baseEnv, fetchImpl: async () => { throw new Error('should not call fetch'); } });
  const rawBody = JSON.stringify({ id: 'evt_bad', type: 'checkout.session.completed', data: { object: {} } });
  const timestamp = Math.floor(Date.now() / 1000);
  await assert.rejects(
    () => billing.handleWebhook({ rawBody, signature: `t=${timestamp},v1=invalid` }),
    (error) => error?.code === 'invalid_stripe_signature' && error?.status === 400
  );
});
