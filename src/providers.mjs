const configured = (value, fallback) => String(value || fallback).trim();
const requestJson = async (url, options) => {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || body.message || `provider request failed: ${response.status}`);
  return body;
};
const formBody = (values) => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== undefined));

export const createProviders = (env = process.env) => ({
  llm: {
    name: configured(env.LLM_PROVIDER, 'mock'),
    mode: env.LLM_API_KEY ? 'connected' : 'simulation',
    generate: async ({ role, input }) => {
      if (!env.LLM_API_KEY) return { role, model: configured(env.LLM_MODEL, 'adapter/mock'), output: `Mock response for ${role}: ${input}`, usage: { inputTokens: 0, outputTokens: 0 } };
      const body = await requestJson(env.LLM_BASE_URL || 'https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${env.LLM_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: configured(env.LLM_MODEL, 'gpt-4o-mini'), messages: [{ role: 'system', content: `You are the ${role} agent. Return concise structured work.` }, { role: 'user', content: input }], temperature: 0.2 }) });
      return { role, model: body.model, output: body.choices?.[0]?.message?.content || '', usage: body.usage || {} };
    }
  },
  payment: {
    name: configured(env.PAYMENT_PROVIDER, 'manual-adapter'),
    mode: env.STRIPE_SECRET_KEY ? 'connected' : 'approval-only',
    createCheckout: async ({ amount, currency, reference, successUrl, cancelUrl }) => {
      if (!env.STRIPE_SECRET_KEY) return { status: 'pending_approval', amount, currency, reference };
      const body = await requestJson('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' }, body: formBody({ mode: 'payment', 'line_items[0][price_data][currency]': currency.toLowerCase(), 'line_items[0][price_data][product_data][name]': reference, 'line_items[0][price_data][unit_amount]': amount, 'line_items[0][quantity]': 1, success_url: successUrl, cancel_url: cancelUrl }) });
      return { status: 'checkout_created', provider: 'stripe', id: body.id, url: body.url, amount, currency, reference };
    }
  },
  notification: {
    name: configured(env.NOTIFICATION_PROVIDER, env.RESEND_API_KEY ? 'resend' : 'log'),
    mode: env.RESEND_API_KEY ? 'connected' : 'local',
    send: async ({ recipient, message, subject = 'ミセサポAIからのお知らせ' }) => {
      if (!env.RESEND_API_KEY) return { delivered: false, recipient, message, reason: 'notification adapter is not connected' };
      const body = await requestJson('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_FROM || 'onboarding@resend.dev', to: [recipient], subject, text: message }) });
      return { delivered: true, provider: 'resend', id: body.id, recipient };
    }
  },
  storage: {
    name: configured(env.OBJECT_STORAGE_PROVIDER, 'local'),
    mode: env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? 'connected' : 'local',
    private: true
  }
});

export const providerStatus = (providers) => Object.fromEntries(Object.entries(providers).map(([name, provider]) => [name, { name: provider.name, mode: provider.mode }]));
