const configured = (value, fallback) => String(value || fallback).trim();
const secret = (value) => String(value || '').trim();
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
    mode: secret(env.LLM_API_KEY) ? 'connected' : 'simulation',
    generate: async ({ role, input, system, messages }) => {
      const conversation = Array.isArray(messages) && messages.length ? messages : [{ role: 'user', content: input }];
      const systemPrompt = system || `You are the ${role} agent. Return concise structured work.`;
      const apiKey = secret(env.LLM_API_KEY);
      if (!apiKey) return { role, model: configured(env.LLM_MODEL, 'adapter/mock'), output: `Mock response for ${role}: ${conversation[conversation.length - 1]?.content ?? input}`, usage: { inputTokens: 0, outputTokens: 0 } };
      const body = await requestJson(env.LLM_BASE_URL || 'https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: configured(env.LLM_MODEL, 'gpt-4o-mini'), messages: [{ role: 'system', content: systemPrompt }, ...conversation], temperature: 0.2 }) });
      return { role, model: body.model, output: body.choices?.[0]?.message?.content || '', usage: body.usage || {} };
    }
  },
  images: {
    name: configured(env.IMAGE_PROVIDER, 'openai-images'),
    mode: secret(env.OPENAI_API_KEY) ? 'connected' : 'not_configured',
    generate: async ({ prompt, size = '1536x1024', quality = 'low' }) => {
      const apiKey = secret(env.OPENAI_API_KEY);
      if (!apiKey) throw new Error('OPENAI_API_KEY is not configured for image generation');
      const body = await requestJson(env.OPENAI_IMAGES_URL || 'https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: configured(env.OPENAI_IMAGE_MODEL, 'gpt-image-1'), prompt, size, quality, output_format: 'png' })
      });
      const encoded = body.data?.[0]?.b64_json;
      if (!encoded) throw new Error('image generation returned no image data');
      return { body: Buffer.from(encoded, 'base64'), contentType: 'image/png', model: body.model || configured(env.OPENAI_IMAGE_MODEL, 'gpt-image-1') };
    }
  },
  payment: {
    name: configured(env.PAYMENT_PROVIDER, 'manual-adapter'),
    mode: secret(env.STRIPE_SECRET_KEY) ? 'connected' : 'approval-only',
    createCheckout: async ({ amount, currency, reference, successUrl, cancelUrl }) => {
      const apiKey = secret(env.STRIPE_SECRET_KEY);
      if (!apiKey) return { status: 'pending_approval', amount, currency, reference };
      const body = await requestJson('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/x-www-form-urlencoded' }, body: formBody({ mode: 'payment', 'line_items[0][price_data][currency]': currency.toLowerCase(), 'line_items[0][price_data][product_data][name]': reference, 'line_items[0][quantity]': 1, success_url: successUrl, cancel_url: cancelUrl }) });
      return { status: 'checkout_created', provider: 'stripe', id: body.id, url: body.url, amount, currency, reference };
    }
  },
  notification: {
    name: configured(env.NOTIFICATION_PROVIDER, secret(env.RESEND_API_KEY) ? 'resend' : 'log'),
    mode: secret(env.RESEND_API_KEY) ? 'connected' : 'local',
    send: async ({ recipient, message, subject = 'アキナエルAIからのお知らせ' }) => {
      const apiKey = secret(env.RESEND_API_KEY);
      if (!apiKey) return { delivered: false, recipient, message, reason: 'notification adapter is not connected' };
      const body = await requestJson('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_FROM || 'onboarding@resend.dev', to: [recipient], subject, text: message }) });
      return { delivered: true, provider: 'resend', id: body.id, recipient };
    }
  },
  storage: {
    name: configured(env.OBJECT_STORAGE_PROVIDER, secret(env.R2_BUCKET) ? 'cloudflare-r2' : 'local'),
    mode: secret(env.R2_ACCOUNT_ID) && secret(env.R2_ACCESS_KEY_ID) && secret(env.R2_SECRET_ACCESS_KEY) && secret(env.R2_BUCKET) ? 'connected' : 'local',
    private: true,
    putObject: async ({ key, body, contentType }) => {
      const accountId = secret(env.R2_ACCOUNT_ID);
      const accessKeyId = secret(env.R2_ACCESS_KEY_ID);
      const secretAccessKey = secret(env.R2_SECRET_ACCESS_KEY);
      const bucket = secret(env.R2_BUCKET);
      if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return { provider: 'local' };
      const client = new S3Client({ region: 'auto', endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'private, max-age=0, no-store' }));
      return { provider: 'cloudflare-r2', key };
    }
  }
});

export const providerStatus = (providers) => Object.fromEntries(Object.entries(providers).map(([name, provider]) => [name, { name: provider.name, mode: provider.mode }]));
