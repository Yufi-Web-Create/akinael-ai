import crypto from 'node:crypto';
import { businessConfig } from './business-config.mjs';
import { createSupabaseAdmin, verifySupabaseAccessToken } from './supabase-admin.mjs';
import { PlatformStoreError } from './platform-store.mjs';

const PAID_PLAN_IDS = new Set(['mini', 'operations', 'advanced']);
const first = (value) => Array.isArray(value) ? value[0] || null : value || null;

const stripeRequest = async (path, params, { env, fetchImpl }) => {
  const secretKey = String(env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) {
    throw new PlatformStoreError('Stripeがまだ設定されていません。', { status: 503, code: 'stripe_not_configured' });
  }
  const response = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PlatformStoreError(payload?.error?.message || 'Stripeとの通信に失敗しました。', {
      status: 502,
      code: 'stripe_request_failed'
    });
  }
  return payload;
};

const secureEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const verifyStripeSignature = (rawBody, signatureHeader, webhookSecret) => {
  if (!signatureHeader || !webhookSecret) return false;
  const parts = String(signatureHeader).split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex');
  return signatures.some((candidate) => secureEqual(candidate, expected));
};

export const createStripeBilling = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const admin = createSupabaseAdmin({ env, fetchImpl });
  const tenantName = String(env.AKINAEL_TENANT_NAME || 'akinael').trim();

  const resolveTenant = async () => {
    const rows = await admin.request('/rest/v1/tenants', {
      query: `name=eq.${encodeURIComponent(tenantName)}&select=id,name&limit=1`
    });
    const tenant = first(rows);
    if (!tenant) throw new PlatformStoreError('Akinael tenant is not configured', { status: 503, code: 'tenant_not_configured' });
    return tenant;
  };

  const customerForToken = async (accessToken) => {
    const user = await verifySupabaseAccessToken(accessToken, { env, fetchImpl });
    if (!user?.id) throw new PlatformStoreError('authentication required', { status: 401, code: 'authentication_required' });
    const profiles = await admin.request('/rest/v1/user_profiles', {
      query: `id=eq.${encodeURIComponent(user.id)}&select=id,tenant_id,role&limit=1`
    });
    const profile = first(profiles);
    if (!profile || profile.role !== 'customer') {
      throw new PlatformStoreError('customers only', { status: 403, code: 'customers_only' });
    }
    const memberships = await admin.request('/rest/v1/customer_members', {
      query: `tenant_id=eq.${encodeURIComponent(profile.tenant_id)}&user_id=eq.${encodeURIComponent(user.id)}&select=customer_id&order=created_at.asc&limit=1`
    });
    const membership = first(memberships);
    if (!membership?.customer_id) throw new PlatformStoreError('customer not found', { status: 404, code: 'customer_not_found' });
    const customers = await admin.request('/rest/v1/customers', {
      query: `id=eq.${encodeURIComponent(membership.customer_id)}&tenant_id=eq.${encodeURIComponent(profile.tenant_id)}&select=id,tenant_id,name,plan_id,stripe_customer_id&limit=1`
    });
    const customer = first(customers);
    if (!customer) throw new PlatformStoreError('customer not found', { status: 404, code: 'customer_not_found' });
    return { user, customer };
  };

  const createCheckoutSession = async (accessToken, planId) => {
    const normalizedPlanId = String(planId || '').trim();
    if (!PAID_PLAN_IDS.has(normalizedPlanId)) {
      throw new PlatformStoreError('選択したプランでは決済を開始できません。', { status: 400, code: 'unsupported_plan' });
    }
    const plan = businessConfig.pricing[normalizedPlanId];
    const amount = Number(plan?.monthlyAmount || 0);
    if (!amount) throw new PlatformStoreError('プラン料金が設定されていません。', { status: 500, code: 'plan_price_missing' });
    const { user, customer } = await customerForToken(accessToken);
    const publicUrl = String(env.PUBLIC_URL || 'https://akinael-ai.com').replace(/\/+$/, '');
    const params = {
      mode: 'subscription',
      success_url: `${publicUrl}/portal/?screen=plan&checkout=success`,
      cancel_url: `${publicUrl}/portal/?screen=plan&checkout=cancelled`,
      client_reference_id: customer.id,
      'metadata[customer_id]': customer.id,
      'metadata[plan_id]': normalizedPlanId,
      'subscription_data[metadata][customer_id]': customer.id,
      'subscription_data[metadata][plan_id]': normalizedPlanId,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': String(businessConfig.currency || 'JPY').toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(amount),
      'line_items[0][price_data][recurring][interval]': 'month',
      'line_items[0][price_data][product_data][name]': `アキナエルAI ${plan.name}`,
      allow_promotion_codes: 'true'
    };
    if (customer.stripe_customer_id) params.customer = customer.stripe_customer_id;
    else if (user.email) params.customer_email = user.email;
    const session = await stripeRequest('checkout/sessions', params, { env, fetchImpl });
    if (!session?.url) throw new PlatformStoreError('決済画面を開けませんでした。', { status: 502, code: 'stripe_checkout_failed' });
    return { url: session.url, id: session.id };
  };

  const updateCustomer = async (customerId, patch) => {
    if (!customerId) return;
    await admin.request('/rest/v1/customers', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(customerId)}`,
      body: patch
    });
  };

  const customerByStripeId = async (stripeCustomerId) => {
    if (!stripeCustomerId) return null;
    const rows = await admin.request('/rest/v1/customers', {
      query: `stripe_customer_id=eq.${encodeURIComponent(stripeCustomerId)}&select=id,tenant_id,plan_id&limit=1`
    });
    return first(rows);
  };

  const recordInvoice = async (invoice, status) => {
    const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const customer = await customerByStripeId(stripeCustomerId);
    if (!customer) return;
    const providerReference = String(invoice.id || '');
    if (!providerReference) return;
    const existing = await admin.request('/rest/v1/payments', {
      query: `provider=eq.stripe&provider_reference=eq.${encodeURIComponent(providerReference)}&select=id&limit=1`
    });
    const body = {
      tenant_id: customer.tenant_id,
      customer_id: customer.id,
      provider: 'stripe',
      provider_reference: providerReference,
      kind: 'subscription',
      amount: Number(invoice.amount_paid ?? invoice.amount_due ?? 0),
      currency: String(invoice.currency || 'jpy').toUpperCase(),
      status
    };
    const current = first(existing);
    if (current?.id) {
      await admin.request('/rest/v1/payments', { method: 'PATCH', query: `id=eq.${encodeURIComponent(current.id)}`, body });
    } else {
      await admin.request('/rest/v1/payments', {
        method: 'POST',
        query: 'select=id',
        headers: { Prefer: 'return=representation' },
        body
      });
    }
  };

  const handleWebhook = async ({ rawBody, signature }) => {
    const webhookSecret = String(env.STRIPE_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
      throw new PlatformStoreError('Stripe webhook is not configured', { status: 503, code: 'stripe_webhook_not_configured' });
    }
    if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
      throw new PlatformStoreError('Stripe webhook signature is invalid', { status: 400, code: 'invalid_stripe_signature' });
    }
    let event;
    try { event = JSON.parse(rawBody); } catch {
      throw new PlatformStoreError('Stripe webhook payload is invalid', { status: 400, code: 'invalid_stripe_payload' });
    }
    const object = event?.data?.object || {};
    if (event.type === 'checkout.session.completed' && object.mode === 'subscription') {
      const customerId = object.metadata?.customer_id || object.client_reference_id;
      const planId = object.metadata?.plan_id;
      const stripeCustomerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
      if (customerId && PAID_PLAN_IDS.has(planId)) {
        await updateCustomer(customerId, { plan_id: planId, ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}) });
      }
    } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const customerId = object.metadata?.customer_id;
      const planId = object.metadata?.plan_id;
      if (customerId && PAID_PLAN_IDS.has(planId) && ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(object.status)) {
        await updateCustomer(customerId, { plan_id: planId });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const customerId = object.metadata?.customer_id;
      if (customerId) await updateCustomer(customerId, { plan_id: null });
    } else if (event.type === 'invoice.paid') {
      await recordInvoice(object, 'paid');
    } else if (event.type === 'invoice.payment_failed') {
      await recordInvoice(object, 'failed');
    }
    return { received: true, type: event?.type || null };
  };

  const configuration = () => ({
    checkoutAvailable: Boolean(String(env.STRIPE_SECRET_KEY || '').trim()),
    webhookAvailable: Boolean(String(env.STRIPE_WEBHOOK_SECRET || '').trim()),
    paidPlans: [...PAID_PLAN_IDS]
  });

  return { createCheckoutSession, handleWebhook, configuration, resolveTenant };
};
