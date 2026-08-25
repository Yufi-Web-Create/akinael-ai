import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviders } from '../src/providers.mjs';

test('provider keys are trimmed and sent as bearer credentials', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => url.includes('stripe') ? { id: 'checkout-id', url: 'https://checkout.test' } : url.includes('resend') ? { id: 'email-id' } : { model: 'test-model', choices: [{ message: { content: 'ok' } }] }
    };
  };

  try {
    const providers = createProviders({
      LLM_API_KEY: ' llm-key ',
      LLM_BASE_URL: 'https://llm.test',
      STRIPE_SECRET_KEY: ' stripe-key ',
      RESEND_API_KEY: ' resend-key ',
      MAIL_FROM: 'from@example.com',
      R2_ACCOUNT_ID: ' account ',
      R2_BUCKET: ' bucket ',
      R2_ACCESS_KEY_ID: ' access ',
      R2_SECRET_ACCESS_KEY: ' secret '
    });

    await providers.llm.generate({ role: 'test', input: 'hello' });
    await providers.payment.createCheckout({ amount: 100, currency: 'JPY', reference: 'reference', successUrl: 'https://success.test', cancelUrl: 'https://cancel.test' });
    await providers.notification.send({ recipient: 'to@example.com', message: 'message' });

    assert.deepEqual(calls.map(({ url }) => url), ['https://llm.test', 'https://api.stripe.com/v1/checkout/sessions', 'https://api.resend.com/emails']);
    assert.equal(calls[0].options.headers.authorization, 'Bearer llm-key');
    assert.equal(calls[1].options.headers.authorization, 'Bearer stripe-key');
    assert.equal(calls[2].options.headers.authorization, 'Bearer resend-key');
    assert.equal(providers.storage.mode, 'connected');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('blank provider keys use safe local fallbacks', async () => {
  const providers = createProviders({
    LLM_API_KEY: '   ',
    STRIPE_SECRET_KEY: '   ',
    RESEND_API_KEY: '   ',
    R2_ACCOUNT_ID: '   ',
    R2_BUCKET: '   ',
    R2_ACCESS_KEY_ID: '   ',
    R2_SECRET_ACCESS_KEY: '   '
  });

  assert.equal(providers.llm.mode, 'simulation');
  assert.equal(providers.payment.mode, 'approval-only');
  assert.equal(providers.notification.mode, 'local');
  assert.equal(providers.storage.mode, 'local');
  assert.match((await providers.llm.generate({ role: 'test', input: 'hello' })).output, /Mock response/);
  assert.equal((await providers.payment.createCheckout({ amount: 100, currency: 'JPY', reference: 'reference' })).status, 'pending_approval');
  assert.equal((await providers.notification.send({ recipient: 'to@example.com', message: 'message' })).delivered, false);
  assert.deepEqual(await providers.storage.putObject({ key: 'key', body: Buffer.from('body'), contentType: 'text/plain' }), { provider: 'local' });
});