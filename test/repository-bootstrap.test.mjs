import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapProjectRepository, canBootstrapRepository, repositoryNameForProject } from '../src/repository-bootstrap.mjs';

const context = (overrides = {}) => ({
  task: { mode: 'build' },
  request: { type: 'web_new' },
  workflow: { id: 'wf-1', tenant_id: 'tenant-1', project_id: 'project-1', metadata: {} },
  project: { id: '12345678-abcd-efgh-ijkl-123456789012', name: '喫茶 テスト店' },
  repository: null,
  ...overrides
});

test('repository names are stable and GitHub-safe even for Japanese project names', () => {
  assert.equal(repositoryNameForProject(context().project), 'client-project-12345678');
  assert.equal(repositoryNameForProject({ id: 'abcdef12-3456', name: 'Sample Store' }), 'client-sample-store-abcdef12');
});

test('only a new-web build without an existing repository is eligible for bootstrap', () => {
  assert.equal(canBootstrapRepository(context()), true);
  assert.equal(canBootstrapRepository(context({ request: { type: 'web_change' } })), false);
  assert.equal(canBootstrapRepository(context({ task: { mode: 'visual_review' } })), false);
  assert.equal(canBootstrapRepository(context({ repository: { repository_full_name: 'owner/existing' } })), false);
  assert.equal(canBootstrapRepository(context({ request: { type: 'general' }, workflow: { id: 'wf-1', tenant_id: 'tenant-1', project_id: 'project-1', metadata: { expansion_route: 'web_new' } } })), true);
});

test('bootstrap without a template creates, seeds, verifies and then registers a private repository', async () => {
  const calls = [];
  const github = {
    mode: 'connected',
    createPrivateRepository: async (input) => { calls.push(['create', input]); return { full_name: 'owner/client-project-12345678', default_branch: 'main' }; },
    seedRepository: async (input) => { calls.push(['seed', input]); return { fileCount: Object.keys(input.files).length }; },
    verifyAppRepositoryAccess: async (name) => { calls.push(['verify', name]); return true; },
    createFromTemplate: async () => { throw new Error('template should not be used'); }
  };
  const store = {
    registerRepository: async (input) => { calls.push(['register', input]); return { id: 'repo-1', repository_full_name: input.repositoryFullName, default_branch: input.defaultBranch }; }
  };

  const repo = await bootstrapProjectRepository({
    context: context(), github, store,
    env: { GITHUB_REPO_OWNER: 'owner', GITHUB_REPO_OWNER_TYPE: 'user', GITHUB_CUSTOMER_REPO_PREFIX: 'client' }
  });

  assert.equal(repo.repository_full_name, 'owner/client-project-12345678');
  assert.deepEqual(calls.map(([name]) => name), ['create', 'seed', 'verify', 'register']);
  const seed = calls.find(([name]) => name === 'seed')[1];
  assert.ok(seed.files['package.json']);
  assert.ok(seed.files['AGENTS.md']);
  assert.ok(seed.files['playwright.config.ts']);
  assert.ok(seed.files['tests/smoke.spec.ts']);
});

test('configured template repository is preferred and skips bundled starter seeding', async () => {
  const calls = [];
  const github = {
    mode: 'connected',
    createFromTemplate: async (input) => { calls.push(['template', input]); return { full_name: 'owner/client-project-12345678', default_branch: 'main' }; },
    createPrivateRepository: async () => { throw new Error('direct create should not be used'); },
    seedRepository: async () => { throw new Error('starter seeding should not be used'); },
    verifyAppRepositoryAccess: async (name) => { calls.push(['verify', name]); return true; }
  };
  const store = {
    registerRepository: async (input) => { calls.push(['register', input]); return { repository_full_name: input.repositoryFullName, default_branch: input.defaultBranch }; }
  };

  await bootstrapProjectRepository({
    context: context(), github, store,
    env: { GITHUB_REPO_OWNER: 'owner', GITHUB_TEMPLATE_REPO: 'owner/template' }
  });
  assert.deepEqual(calls.map(([name]) => name), ['template', 'verify', 'register']);
});
