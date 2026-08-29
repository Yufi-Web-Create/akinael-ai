import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createGitHubRuntime } from '../src/github-runtime.mjs';

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json' }
});

const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey
  .export({ type: 'pkcs8', format: 'pem' });

test('customer organization repositories use their own GitHub App installation without a bootstrap PAT', async () => {
  const calls = [];
  const runtime = createGitHubRuntime({
    env: {
      GITHUB_APP_ID: '123',
      GITHUB_APP_INSTALLATION_ID: '456',
      GITHUB_APP_PRIVATE_KEY: privateKey,
      GITHUB_REPO_OWNER: 'akinael-clients',
      GITHUB_REPO_OWNER_TYPE: 'org'
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith('/orgs/akinael-clients/installation')) {
        return jsonResponse({ id: 777 });
      }
      if (String(url).endsWith('/app/installations/777/access_tokens')) {
        return jsonResponse({ token: 'org-installation-token', expires_at: '2099-01-01T00:00:00Z' }, 201);
      }
      if (String(url).endsWith('/orgs/akinael-clients/repos')) {
        assert.equal(options.headers.authorization, 'Bearer org-installation-token');
        return jsonResponse({ full_name: 'akinael-clients/client-demo', default_branch: 'main' }, 201);
      }
      if (String(url).includes('/repos/akinael-clients/client-demo/contents/README.md')) {
        assert.equal(options.headers.authorization, 'Bearer org-installation-token');
        return jsonResponse({ content: { path: 'README.md' } }, 201);
      }
      throw new Error(`unexpected request: ${url}`);
    }
  });

  const repo = await runtime.createPrivateRepository({
    owner: 'akinael-clients',
    ownerType: 'org',
    name: 'client-demo'
  });
  assert.equal(repo.full_name, 'akinael-clients/client-demo');

  await runtime.putRepositoryFile({
    repositoryFullName: repo.full_name,
    path: 'README.md',
    content: '# Demo'
  });

  assert.equal(calls.filter((call) => call.url.endsWith('/orgs/akinael-clients/installation')).length, 1);
  assert.equal(calls.filter((call) => call.url.endsWith('/app/installations/777/access_tokens')).length, 1);
});
