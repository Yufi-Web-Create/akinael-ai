import crypto from 'node:crypto';
import { businessConfig } from './business-config.mjs';
import { createSupabaseAdmin, verifySupabaseAccessToken } from './supabase-admin.mjs';
import { PlatformStoreError } from './platform-store.mjs';

const PAID_PLAN_IDS = new Set(['mini', 'operations', 'advanced']);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['ACTIVE', 'PENDING']);
const first = (value) => Array.isArray(value) ? value[0] || null : value || null;

const planVariationIds = (env) => ({
  mini: String(env.SQUARE_PLAN_VARIATION_MINI || '').trim(),
  operations: String(env.SQUARE_PLAN_VARIATION_OPERATIONS || '').trim(),
  advanced: String(env.SQUARE_PLAN_VARIATION_ADVANCED || '').trim()
});

const squareBaseUrl = (env) => String(env.SQUARE_ENVIRONMENT || 'production').trim().toLowerCase() === 'sandbox'
  ? 'https://connect.squareupsandbox.com'
  : 'https://connect.squareup.com';

const squareRequest = async (path, { env, fetchImpl, method = 'GET', body } = {}) => {
  const accessToken = String(env.SQUARE_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    throw new PlatformStoreError('Squareがまだ設定されていません。', { status: 503, code: 'square_not_configured' });
  }
  const response = await fetchImpl(`${squareBaseUrl(env)}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'square-version': String(env.SQUARE_API_VERSION || '2026-09-16').trim()
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.errors?.[0]?.detail || payload?.errors?.[0]?.code;
    throw new PlatformStoreError(detail || 'Squareとの通信に失敗しました。', {
      status: 502,
      code: 'square_request_failed'
    });
  }
  return payload;
};

const secureEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const verifySquareSignature = (rawBody, signature, webhookSignatureKey, notificationUrl) => {
  if (!rawBody || !signature || !webhookSignatureKey || !notificationUrl) return false;
  const expected = crypto
    .createHmac('sha256', webhookSignatureKey)
    .update(`${notificationUrl}${rawBody}`)
    .digest('base64');
  return secureEqual(signature, expected);
};

const parsePaymentNote = (note) => {
  const values = {};
  for (const part of String(note || '').split(';')) {
    const [key, ...rest] = part.split('=');
    if (key && rest.length) values[key.trim()] = rest.join('=').trim();
  }
  return {
    customerId: values.akinael_customer_id || null,
    planId: values.plan_id || null
  };
};

export const createSquareBilling = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const admin = createSupabaseAdmin({ env, fetchImpl });

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
      query: `id=eq.${encodeURIComponent(membership.customer_id)}&tenant_id=eq.${encodeURIComponent(profile.tenant_id)}&select=id,tenant_id,name,plan_id,square_customer_id,square_subscription_id,notify_by_email&limit=1`
    });
    const customer = first(customers);
    if (!customer) throw new PlatformStoreError('customer not found', { status: 404, code: 'customer_not_found' });
    return { user, customer };
  };

  const updateCustomer = async (customerId, patch) => {
    if (!customerId || !Object.keys(patch || {}).length) return;
    await admin.request('/rest/v1/customers', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(customerId)}`,
      body: patch
    });
  };

  const customerBySquareId = async (squareCustomerId) => {
    if (!squareCustomerId) return null;
    const rows = await admin.request('/rest/v1/customers', {
      query: `square_customer_id=eq.${encodeURIComponent(squareCustomerId)}&select=id,tenant_id,plan_id,square_subscription_id&limit=1`
    });
    return first(rows);
  };

  const customerById = async (customerId) => {
    if (!customerId) return null;
    const rows = await admin.request('/rest/v1/customers', {
      query: `id=eq.${encodeURIComponent(customerId)}&select=id,tenant_id,plan_id,square_customer_id,square_subscription_id&limit=1`
    });
    return first(rows);
  };

  const planIdFromVariation = (variationId) => {
    if (!variationId) return null;
    const entry = Object.entries(planVariationIds(env)).find(([, id]) => id && id === variationId);
    return entry?.[0] || null;
  };

  const createCheckoutSession = async (accessToken, planId) => {
    const normalizedPlanId = String(planId || '').trim();
    if (!PAID_PLAN_IDS.has(normalizedPlanId)) {
      throw new PlatformStoreError('選択したプランでは決済を開始できません。', { status: 400, code: 'unsupported_plan' });
    }
    const variationId = planVariationIds(env)[normalizedPlanId];
    const locationId = String(env.SQUARE_LOCATION_ID || '').trim();
    if (!variationId || !locationId) {
      throw new PlatformStoreError('Squareのプラン設定が完了していません。', { status: 503, code: 'square_plan_not_configured' });
    }
    const plan = businessConfig.pricing[normalizedPlanId];
    const amount = Number(plan?.monthlyAmount || 0);
    if (!amount) throw new PlatformStoreError('プラン料金が設定されていません。', { status: 500, code: 'plan_price_missing' });
    const { user, customer } = await customerForToken(accessToken);
    if (customer.square_subscription_id) {
      throw new PlatformStoreError('すでに有料プランをご契約中です。プラン変更をご利用ください。', {
        status: 409,
        code: 'subscription_already_exists'
      });
    }
    const publicUrl = String(env.PUBLIC_URL || 'https://akinael-ai.com').replace(/\/+$/, '');
    const payload = await squareRequest('/v2/online-checkout/payment-links', {
      env,
      fetchImpl,
      method: 'POST',
      body: {
        idempotency_key: crypto.randomUUID(),
        description: `Akinael AI ${plan.name}`,
        quick_pay: {
          name: `アキナエルAI ${plan.name}`,
          price_money: { amount, currency: String(businessConfig.currency || 'JPY').toUpperCase() },
          location_id: locationId
        },
        checkout_options: {
          subscription_plan_id: variationId,
          redirect_url: `${publicUrl}/portal/?screen=plan&checkout=success`
        },
        ...(user.email ? { pre_populated_data: { buyer_email: user.email } } : {}),
        payment_note: `akinael_customer_id=${customer.id};plan_id=${normalizedPlanId}`
      }
    });
    const paymentLink = payload?.payment_link;
    if (!paymentLink?.url) {
      throw new PlatformStoreError('決済画面を開けませんでした。', { status: 502, code: 'square_checkout_failed' });
    }
    return { url: paymentLink.url, id: paymentLink.id };
  };

  const findSubscriptionForCustomer = async (squareCustomerId) => {
    const locationId = String(env.SQUARE_LOCATION_ID || '').trim();
    if (!squareCustomerId || !locationId) return null;
    const payload = await squareRequest('/v2/subscriptions/search', {
      env,
      fetchImpl,
      method: 'POST',
      body: { query: { filter: { customer_ids: [squareCustomerId], location_ids: [locationId] } } }
    });
    const subscriptions = Array.isArray(payload?.subscriptions) ? payload.subscriptions : [];
    return subscriptions
      .filter((subscription) => ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status) || subscription.status === 'CANCELED')
      .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))[0] || null;
  };

  const recordPayment = async (payment, customer) => {
    if (!payment?.id || !customer?.id) return;
    const existing = await admin.request('/rest/v1/payments', {
      query: `provider=eq.square&provider_reference=eq.${encodeURIComponent(payment.id)}&select=id&limit=1`
    });
    const mappedStatus = payment.status === 'COMPLETED' ? 'paid' : ['FAILED', 'CANCELED'].includes(payment.status) ? 'failed' : 'pending';
    const body = {
      tenant_id: customer.tenant_id,
      customer_id: customer.id,
      provider: 'square',
      provider_reference: payment.id,
      kind: 'subscription',
      amount: Number(payment.amount_money?.amount || 0),
      currency: String(payment.amount_money?.currency || 'JPY').toUpperCase(),
      status: mappedStatus
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

  const handlePaymentUpdated = async (payment) => {
    const note = parsePaymentNote(payment?.note);
    let customer = note.customerId ? await customerById(note.customerId) : null;
    if (!customer && payment?.customer_id) customer = await customerBySquareId(payment.customer_id);
    if (!customer) return;

    const patch = {};
    if (payment.customer_id && payment.customer_id !== customer.square_customer_id) patch.square_customer_id = payment.customer_id;
    if (payment.status === 'COMPLETED' && PAID_PLAN_IDS.has(note.planId)) patch.plan_id = note.planId;
    if (Object.keys(patch).length) await updateCustomer(customer.id, patch);

    if (payment.status === 'COMPLETED' && payment.customer_id) {
      const subscription = await findSubscriptionForCustomer(payment.customer_id);
      if (subscription?.id) {
        const subscriptionPlanId = planIdFromVariation(subscription.plan_variation_id) || note.planId;
        await updateCustomer(customer.id, {
          square_customer_id: payment.customer_id,
          square_subscription_id: subscription.id,
          ...(PAID_PLAN_IDS.has(subscriptionPlanId) ? { plan_id: subscriptionPlanId } : {})
        });
      }
    }
    await recordPayment(payment, customer);
  };

  const handleSubscription = async (subscription) => {
    if (!subscription?.customer_id) return;
    const customer = await customerBySquareId(subscription.customer_id);
    if (!customer) return;
    if (subscription.status === 'CANCELED' || subscription.status === 'DEACTIVATED') {
      await updateCustomer(customer.id, { plan_id: null, square_subscription_id: null });
      return;
    }
    const planId = planIdFromVariation(subscription.plan_variation_id);
    await updateCustomer(customer.id, {
      square_subscription_id: subscription.id || customer.square_subscription_id,
      ...(PAID_PLAN_IDS.has(planId) ? { plan_id: planId } : {})
    });
  };

  const handleWebhook = async ({ rawBody, signature }) => {
    const webhookSignatureKey = String(env.SQUARE_WEBHOOK_SIGNATURE_KEY || '').trim();
    const publicUrl = String(env.PUBLIC_URL || 'https://akinael-ai.com').replace(/\/+$/, '');
    const notificationUrl = String(env.SQUARE_WEBHOOK_NOTIFICATION_URL || `${publicUrl}/api/v2/billing/webhook`).trim();
    if (!webhookSignatureKey) {
      throw new PlatformStoreError('Square webhook is not configured', { status: 503, code: 'square_webhook_not_configured' });
    }
    if (!verifySquareSignature(rawBody, signature, webhookSignatureKey, notificationUrl)) {
      throw new PlatformStoreError('Square webhook signature is invalid', { status: 400, code: 'invalid_square_signature' });
    }
    let event;
    try { event = JSON.parse(rawBody); } catch {
      throw new PlatformStoreError('Square webhook payload is invalid', { status: 400, code: 'invalid_square_payload' });
    }
    if (event?.type === 'payment.updated') {
      await handlePaymentUpdated(event?.data?.object?.payment || event?.data?.object);
    } else if (event?.type === 'subscription.created' || event?.type === 'subscription.updated') {
      await handleSubscription(event?.data?.object?.subscription || event?.data?.object);
    }
    return { received: true, type: event?.type || null };
  };

  const getBillingSummary = async (accessToken) => {
    const { customer } = await customerForToken(accessToken);
    const payments = await admin.request('/rest/v1/payments', {
      query: `tenant_id=eq.${encodeURIComponent(customer.tenant_id)}&customer_id=eq.${encodeURIComponent(customer.id)}&select=id,provider,provider_reference,kind,amount,currency,status,created_at,updated_at&order=created_at.desc&limit=50`
    });
    const planKey = PAID_PLAN_IDS.has(customer.plan_id) ? customer.plan_id : null;
    return {
      currentPlan: planKey ? { id: planKey, ...businessConfig.pricing[planKey] } : null,
      billingPortalAvailable: false,
      provider: 'square',
      notifyByEmail: customer.notify_by_email !== false,
      history: Array.isArray(payments) ? payments : []
    };
  };

  const changePlan = async (accessToken, planId) => {
    const normalizedPlanId = String(planId || '').trim();
    if (!PAID_PLAN_IDS.has(normalizedPlanId)) {
      throw new PlatformStoreError('選択したプランへ変更できません。', { status: 400, code: 'unsupported_plan' });
    }
    const variationId = planVariationIds(env)[normalizedPlanId];
    if (!variationId) {
      throw new PlatformStoreError('Squareのプラン設定が完了していません。', { status: 503, code: 'square_plan_not_configured' });
    }
    const { customer } = await customerForToken(accessToken);
    if (!customer.square_subscription_id) {
      throw new PlatformStoreError('変更できる有料契約が見つかりません。', { status: 409, code: 'subscription_not_found' });
    }
    if (customer.plan_id === normalizedPlanId) {
      throw new PlatformStoreError('現在と同じプランです。', { status: 400, code: 'same_plan' });
    }
    const payload = await squareRequest(`/v2/subscriptions/${encodeURIComponent(customer.square_subscription_id)}/swap-plan`, {
      env,
      fetchImpl,
      method: 'POST',
      body: { new_plan_variation_id: variationId }
    });
    return {
      scheduled: true,
      effectiveDate: payload?.actions?.[0]?.effective_date || null,
      subscriptionId: payload?.subscription?.id || customer.square_subscription_id
    };
  };

  const cancelSubscription = async (accessToken) => {
    const { customer } = await customerForToken(accessToken);
    if (!customer.square_subscription_id) {
      throw new PlatformStoreError('解約できる有料契約が見つかりません。', { status: 409, code: 'subscription_not_found' });
    }
    const payload = await squareRequest(`/v2/subscriptions/${encodeURIComponent(customer.square_subscription_id)}/cancel`, {
      env,
      fetchImpl,
      method: 'POST'
    });
    return {
      scheduled: true,
      canceledDate: payload?.subscription?.canceled_date || payload?.actions?.[0]?.effective_date || null,
      subscriptionId: payload?.subscription?.id || customer.square_subscription_id
    };
  };

  const configuration = () => ({
    checkoutAvailable: Boolean(String(env.SQUARE_ACCESS_TOKEN || '').trim() && String(env.SQUARE_LOCATION_ID || '').trim()),
    webhookAvailable: Boolean(String(env.SQUARE_WEBHOOK_SIGNATURE_KEY || '').trim()),
    paidPlans: [...PAID_PLAN_IDS].filter((planId) => Boolean(planVariationIds(env)[planId])),
    environment: String(env.SQUARE_ENVIRONMENT || 'production').trim().toLowerCase()
  });

  return { createCheckoutSession, handleWebhook, getBillingSummary, changePlan, cancelSubscription, configuration };
};
