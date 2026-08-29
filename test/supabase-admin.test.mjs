import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseAdmin, getSupabaseServerConfig, verifySupabaseAccessToken } from '../src/supabase-admin.mjs';

test('server config prefers modern secret and publishable keys', () => {
  const config = getSupabaseServerConfig({
    SUPABASE_URL: 'https://example.supabase.co/',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test'
  });
  assert.equal(config.url, 'https://example.supabase.co');
  assert.equal(config.adminConfigured, true);
  assert.equal(config.authConfigured, true);
});

test('admin health check sends secret key only as apikey', async () => {
  let received;
  const admin = createSupabaseAdmin({
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' },
    fetchImpl: async (url, options) => {
      received = { url, options };
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  await admin.healthCheck();
  assert.equal(received.options.headers.apikey, 'sb_secret_test');
  assert.equal(received.options.headers.authorization, undefined);
});

test('access token verification uses publishable key plus user bearer token', async () => {
  let received;
  const user = await verifySupabaseAccessToken('user-token', {
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
    fetchImpl: async (url, options) => {
      received = { url, options };
      return new Response(JSON.stringify({ id: 'user-id' }), { status: 200 });
    }
  });
  assert.equal(user.id, 'user-id');
  assert.equal(received.options.headers.apikey, 'sb_publishable_test');
  assert.equal(received.options.headers.authorization, 'Bearer user-token');
});
